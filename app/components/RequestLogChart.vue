<template>
  <div ref="chartRef" class="chart-container" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { getLogTypeLabel, type LogType } from "@utils/requestLogHelpers";
import { TABLEAU_10_PALETTE } from "@constants/tableauPalette";

// EChartsに必要なコンポーネントとレンダラーを登録
echarts.use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

interface Props {
  logs: any[];
  startDate: string;
  endDate: string;
}

const props = defineProps<Props>();

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

// カラーパレット
const colors = [...TABLEAU_10_PALETTE];

// チャートデータを生成
const chartData = computed(() => {
  if (!props.startDate || !props.endDate || props.logs.length === 0) {
    return {
      dates: [],
      requestTypes: [],
      seriesData: {} as Record<string, number[]>,
    };
  }

  // 日付範囲を生成（全日付を補完、今日 + 1日先まで表示）
  const start = new Date(props.startDate);
  start.setHours(0, 0, 0, 0);
  
  // 終了日を今日 + 1日先まで拡張
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // props.endDateと今日+1日のうち、より後の日付を使用
  const endDateFromProps = new Date(props.endDate);
  endDateFromProps.setHours(23, 59, 59, 999);
  const end = endDateFromProps > tomorrow ? endDateFromProps : tomorrow;

  const dates: string[] = [];
  const currentDate = new Date(start);
  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // RequestType別にデータを集計
  const requestTypes = new Set<string>();
  const dateTypeMap: Record<string, Record<string, number>> = {};

  // 日付ごとのマップを初期化
  dates.forEach((date) => {
    dateTypeMap[date] = {};
  });

  // ログデータを集計
  props.logs.forEach((log: any) => {
    const requestType = log.requestType as string | undefined;
    if (!requestType) return;

    requestTypes.add(requestType);

    const createdAt =
      log.createdAt instanceof Date
        ? log.createdAt
        : log.createdAt?.toDate
        ? log.createdAt.toDate()
        : new Date(log.createdAt);

    const dateKey = createdAt.toISOString().split("T")[0];

    if (dateTypeMap[dateKey]) {
      dateTypeMap[dateKey][requestType] =
        (dateTypeMap[dateKey][requestType] || 0) + 1;
    }
  });

  // 系列データを生成
  const seriesData: Record<string, number[]> = {};
  const requestTypesArray = Array.from(requestTypes);

  requestTypesArray.forEach((requestType) => {
    seriesData[requestType] = dates.map((date) => {
      return dateTypeMap[date]?.[requestType] || 0;
    });
  });

  return {
    dates,
    requestTypes: requestTypesArray,
    seriesData,
  };
});

// EChartsオプション
const chartOption = computed(() => {
  const data = chartData.value;

  if (data.dates.length === 0 || data.requestTypes.length === 0) {
    return null;
  }

  return {
    backgroundColor: "transparent",
    title: {
      text: "",
      left: "left",
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
      backgroundColor: "rgba(255, 255, 255, 0.98)",
      borderColor: "#e5e7eb",
      borderWidth: 1,
      borderRadius: 8,
      textStyle: {
        color: "#111827",
      },
      formatter: (params: any) => {
        let result = `<div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #111827;">${params[0].axisValue}</div>`;
        params.forEach((param: any) => {
          result += `<div style="margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color}; margin-right: 8px;"></span>
            ${param.seriesName}: <strong style="color: #111827;">${param.value}</strong>
          </div>`;
        });
        return result;
      },
    },
    legend: {
      data: data.requestTypes.map((type) => getLogTypeLabel(type as LogType)),
      bottom: 0,
      textStyle: {
        fontSize: 12,
        color: "#374151",
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "15%",
      top: "10%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.dates.map((date) => {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }),
      axisLabel: {
        rotate: -45,
        fontSize: 11,
        color: "#6b7280",
      },
      axisLine: {
        lineStyle: {
          color: "#e5e7eb",
        },
      },
    },
    yAxis: {
      type: "value",
      name: "リクエスト回数",
      nameTextStyle: {
        fontSize: 12,
        color: "#6b7280",
        fontWeight: 600,
      },
      min: 0,
      allowDecimals: false,
      axisLabel: {
        fontSize: 11,
        color: "#6b7280",
      },
      splitLine: {
        lineStyle: {
          type: "dashed",
          color: "#f3f4f6",
        },
      },
    },
    series: data.requestTypes.map((requestType, index) => {
      const color = colors[index % colors.length];
      return {
        name: getLogTypeLabel(requestType as LogType),
        type: "line",
        smooth: true,
        data: data.seriesData[requestType],
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: color + "26", // 15% opacity
              },
              {
                offset: 1,
                color: color + "00", // 0% opacity
              },
            ],
          },
        },
        lineStyle: {
          width: 3,
          color: color,
        },
        itemStyle: {
          color: color,
          borderWidth: 2,
          borderColor: "#ffffff",
        },
        symbol: "circle",
        symbolSize: 6,
        emphasis: {
          focus: "series",
        },
      };
    }),
  };
});

// チャートを初期化・更新
const initChart = async () => {
  if (!chartRef.value) return;

  await nextTick();

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }

  if (chartOption.value) {
    chartInstance.setOption(chartOption.value, true);
  }

  // リサイズハンドラー
  const handleResize = () => {
    chartInstance?.resize();
  };

  window.addEventListener("resize", handleResize);

  return () => {
    window.removeEventListener("resize", handleResize);
  };
};

// チャートオプションの変更を監視
watch(
  chartOption,
  () => {
    if (chartInstance && chartOption.value) {
      chartInstance.setOption(chartOption.value, true);
    }
  },
  { deep: true }
);

onMounted(async () => {
  await initChart();
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
});
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 400px;
}
</style>
