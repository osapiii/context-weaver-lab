/**
 * Minimal Vega-Lite -> ECharts converter.
 *
 * The Conversational Analytics API returns Vega-Lite specs. Embedding a full
 * Vega-Lite runtime would balloon the bundle; EN AIstudio already depends on
 * echarts, so we translate the handful of shapes the agent actually emits
 * (bar / line / point with a single x + y encoding, optional color grouping).
 *
 * If the spec doesn't fit the supported shape, the converter returns ``null``
 * and the caller falls back to displaying the raw JSON.
 */

import type { EChartsOption } from "echarts";
import {
  TABLEAU_10_PALETTE,
  TABLEAU_CHART_NEUTRALS,
} from "@constants/tableauPalette";

type VLValue = Record<string, unknown>;

type VLEncodingChannel = {
  field?: string;
  type?: "quantitative" | "nominal" | "ordinal" | "temporal";
  aggregate?: string;
  title?: string;
};

type VLSpec = {
  title?: string | { text?: string };
  data?: { values?: VLValue[] };
  mark?: string | { type?: string };
  encoding?: {
    x?: VLEncodingChannel;
    y?: VLEncodingChannel;
    color?: VLEncodingChannel;
  };
};

type ChartKind = "bar" | "line" | "scatter";

const KIND_MAP: Record<string, ChartKind> = {
  bar: "bar",
  line: "line",
  point: "scatter",
  circle: "scatter",
  square: "scatter",
};

const extractMark = (spec: VLSpec): ChartKind | null => {
  const raw = typeof spec.mark === "string" ? spec.mark : spec.mark?.type;
  if (!raw) return null;
  return KIND_MAP[raw] ?? null;
};

const extractTitle = (spec: VLSpec): string | undefined => {
  if (typeof spec.title === "string") return spec.title;
  return spec.title?.text;
};

const sortableByType = (
  type: VLEncodingChannel["type"] | undefined
): boolean => {
  return type === "temporal" || type === "quantitative" || type === "ordinal";
};

const coerce = (value: unknown): string | number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value == null) return "";
  return String(value);
};

export const vegaLiteToECharts = (spec: VLSpec): EChartsOption | null => {
  try {
    if (!spec || typeof spec !== "object") return null;
    const kind = extractMark(spec);
    if (!kind) return null;

    const values = spec.data?.values;
    if (!Array.isArray(values) || values.length === 0) return null;

    const xField = spec.encoding?.x?.field;
    const yField = spec.encoding?.y?.field;
    if (!xField || !yField) return null;

    const colorField = spec.encoding?.color?.field;

    // Build the x-axis category list (unique, in order).
    const xValues: (string | number)[] = [];
    const seenX = new Set<string>();
    for (const row of values) {
      const v = coerce(row[xField]);
      const key = String(v);
      if (!seenX.has(key)) {
        seenX.add(key);
        xValues.push(v);
      }
    }

    if (sortableByType(spec.encoding?.x?.type)) {
      xValues.sort((a, b) => {
        if (typeof a === "number" && typeof b === "number") return a - b;
        return String(a).localeCompare(String(b));
      });
    }

    // Build series. Group by color field if present.
    const seriesMap = new Map<string, Map<string, number | null>>();
    for (const row of values) {
      const x = String(coerce(row[xField]));
      const yRaw = row[yField];
      const y =
        typeof yRaw === "number"
          ? yRaw
          : typeof yRaw === "string" && yRaw.trim() !== ""
          ? Number(yRaw)
          : null;
      const seriesKey = colorField
        ? String(coerce(row[colorField]) || "")
        : yField;
      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, new Map());
      }
      seriesMap.get(seriesKey)!.set(x, Number.isFinite(y as number) ? (y as number) : null);
    }

    const series = Array.from(seriesMap.entries()).map(([name, points]) => ({
      name,
      type: kind,
      data: xValues.map((x) => points.get(String(x)) ?? null),
      smooth: kind === "line",
      symbol: kind === "scatter" ? "circle" : "emptyCircle",
      barGap: kind === "bar" ? "10%" : undefined,
    }));

    const option: EChartsOption = {
      color: [...TABLEAU_10_PALETTE],
      title: extractTitle(spec)
        ? {
            text: extractTitle(spec)!,
            left: "left",
            textStyle: {
              color: TABLEAU_CHART_NEUTRALS.text,
              fontSize: 13,
              fontWeight: 600,
            },
          }
        : undefined,
      tooltip: {
        trigger: kind === "scatter" ? "item" : "axis",
        backgroundColor: TABLEAU_CHART_NEUTRALS.background,
        borderColor: TABLEAU_CHART_NEUTRALS.tooltipBorder,
        textStyle: { color: TABLEAU_CHART_NEUTRALS.text },
      },
      legend:
        seriesMap.size > 1
          ? {
              type: "scroll",
              bottom: 0,
              textStyle: {
                color: TABLEAU_CHART_NEUTRALS.mutedText,
                fontSize: 11,
              },
            }
          : undefined,
      grid: { left: 40, right: 16, top: 30, bottom: seriesMap.size > 1 ? 32 : 24 },
      xAxis: {
        type: spec.encoding?.x?.type === "temporal" ? "category" : "category",
        data: xValues.map((v) => String(v)),
        name: spec.encoding?.x?.title ?? xField,
        nameLocation: "middle",
        nameGap: 24,
        axisLine: { lineStyle: { color: TABLEAU_CHART_NEUTRALS.axis } },
        axisLabel: {
          color: TABLEAU_CHART_NEUTRALS.mutedText,
          fontSize: 10,
        },
      },
      yAxis: {
        type: "value",
        name: spec.encoding?.y?.title ?? yField,
        axisLine: { lineStyle: { color: TABLEAU_CHART_NEUTRALS.axis } },
        axisLabel: {
          color: TABLEAU_CHART_NEUTRALS.mutedText,
          fontSize: 10,
        },
        splitLine: {
          lineStyle: {
            color: TABLEAU_CHART_NEUTRALS.grid,
            type: "dashed",
          },
        },
      },
      series: series as EChartsOption["series"],
    };

    return option;
  } catch {
    return null;
  }
};
