<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center justify-between gap-2 px-1">
      <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">
        リクエスト件数（日別）
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        種類ごとの積み上げ棒グラフ
      </p>
    </div>
    <div
      v-if="!hasChartData"
      class="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 text-gray-500 dark:border-gray-700"
    >
      <UIcon name="i-heroicons-chart-bar" class="mb-2 h-10 w-10 text-gray-300" />
      <p class="text-sm">表示するデータがありません</p>
    </div>
    <div v-else ref="chartRef" class="bar-chart" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RequestLog } from "@stores/requestLogHistory";
import type { LogType } from "@utils/requestLogHelpers";
import {
  enumerateCalendarDateKeys,
  getLogTypeLabel,
  parseRequestLogDate,
  toJstDateKey,
} from "@utils/requestLogHelpers";
import {
  TABLEAU_10_PALETTE,
  tableauColorAt,
} from "@constants/tableauPalette";

echarts.use([
  CanvasRenderer,
  BarChart,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

const props = defineProps<{
  logs: RequestLog[];
  startDate: string;
  endDate: string;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

const chartData = computed(() => {
  if (!props.startDate || !props.endDate || props.logs.length === 0) {
    return { dates: [] as string[], requestTypes: [] as LogType[], seriesData: {} as Record<string, number[]> };
  }

  const dates = enumerateCalendarDateKeys(props.startDate, props.endDate);

  const dateTypeMap: Record<string, Record<string, number>> = {};
  for (const date of dates) {
    dateTypeMap[date] = {};
  }

  const requestTypes = new Set<LogType>();
  for (const log of props.logs) {
    const type = log.requestType;
    requestTypes.add(type);
    const created = parseRequestLogDate(log.createdAt);
    if (!created) continue;
    const dateKey = toJstDateKey(created);
    if (!dateTypeMap[dateKey]) continue;
    dateTypeMap[dateKey][type] = (dateTypeMap[dateKey][type] ?? 0) + 1;
  }

  const requestTypesArray = Array.from(requestTypes);
  const seriesData: Record<string, number[]> = {};
  for (const type of requestTypesArray) {
    seriesData[type] = dates.map((d) => dateTypeMap[d]?.[type] ?? 0);
  }

  return { dates, requestTypes: requestTypesArray, seriesData };
});

const hasChartData = computed(
  () => chartData.value.dates.length > 0 && chartData.value.requestTypes.length > 0
);

const chartOption = computed(() => {
  const data = chartData.value;
  if (!hasChartData.value) return null;

  return {
    backgroundColor: "transparent",
    color: [...TABLEAU_10_PALETTE],
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { fontSize: 11, color: "#374151" },
    },
    grid: {
      left: 12,
      right: 16,
      top: 16,
      bottom: 56,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: data.dates.map((date) => {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }),
      axisLabel: {
        rotate: data.dates.length > 14 ? -45 : 0,
        fontSize: 10,
        color: "#6b7280",
      },
    },
    yAxis: {
      type: "value",
      name: "件数",
      minInterval: 1,
      nameTextStyle: { fontSize: 11, color: "#6b7280" },
      splitLine: { lineStyle: { type: "dashed", color: "#f3f4f6" } },
    },
    series: data.requestTypes.map((type, index) => ({
      name: getLogTypeLabel(type),
      type: "bar",
      stack: "total",
      emphasis: { focus: "series" },
      barMaxWidth: 28,
      itemStyle: { color: tableauColorAt(index) },
      data: data.seriesData[type],
    })),
  };
});

const renderChart = async (): Promise<void> => {
  if (!chartRef.value || !chartOption.value) return;
  await nextTick();
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }
  chartInstance.setOption(chartOption.value, true);
  chartInstance.resize();
};

watch(chartOption, () => {
  void renderChart();
});

const onResize = (): void => {
  chartInstance?.resize();
};

onMounted(() => {
  void renderChart();
  window.addEventListener("resize", onResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", onResize);
  chartInstance?.dispose();
  chartInstance = null;
});
</script>

<style scoped>
.bar-chart {
  width: 100%;
  height: 360px;
}
</style>
