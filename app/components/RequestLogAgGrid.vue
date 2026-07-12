<template>
  <div
    class="request-log-grid w-full"
    :style="{ height: `${gridHeightPx}px` }"
  >
    <AgGridVue
      class="en-aistudio-ag-grid ag-theme-quartz h-full w-full"
      theme="legacy"
      :row-data="rowData"
      :column-defs="columnDefs"
      :default-col-def="defaultColDef"
      :get-row-id="getRowId"
      dom-layout="normal"
      :pagination="true"
      :pagination-page-size="25"
      :pagination-page-size-selector="[25, 50, 100]"
      :animate-rows="true"
      :suppress-cell-focus="true"
      @grid-ready="onGridReady"
      @row-clicked="onRowClicked"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { AgGridVue } from "ag-grid-vue3";
import {
  ModuleRegistry,
  AllCommunityModule,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type RowClickedEvent,
  type GetRowIdParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import "~/assets/css/en-aistudio-ag-grid.css";
import type { RequestLog } from "@stores/requestLogHistory";
import {
  formatDurationMs,
  formatTimestamp,
  getLogTypeLabel,
  parseRequestLogDate,
} from "@utils/requestLogHelpers";
import { resolveWorkflowInputArtifactUri } from "@utils/workflowRequestLog";

ModuleRegistry.registerModules([AllCommunityModule]);

export type RequestLogGridRow = {
  id: string;
  requestType: string;
  requestTypeLabel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  duration: string;
  artifactHint: string;
  errorMessage: string;
};

const props = withDefaults(
  defineProps<{
    logs: RequestLog[];
    gridHeightPx?: number;
    workflowMode?: boolean;
  }>(),
  { gridHeightPx: 480, workflowMode: false }
);

const emit = defineEmits<{
  "select-log": [log: RequestLog];
}>();

const gridApi = ref<GridApi<RequestLogGridRow> | null>(null);
const logByRowId = ref<Map<string, RequestLog>>(new Map());

const rowData = computed((): RequestLogGridRow[] => {
  const map = new Map<string, RequestLog>();
  const rows = props.logs.map((log) => {
    const rowId = `${log.requestType}_${log.id}`;
    map.set(rowId, log);
    const start = parseRequestLogDate(log.createdAt);
    const end = parseRequestLogDate(log.updatedAt);
    const durationMs =
      start && end ? Math.max(0, end.getTime() - start.getTime()) : 0;
    return {
      id: log.id,
      requestType: log.requestType,
      requestTypeLabel: getLogTypeLabel(log.requestType),
      status: log.status,
      createdAt: formatTimestamp(log.createdAt),
      updatedAt: formatTimestamp(log.updatedAt),
      duration: durationMs > 0 ? formatDurationMs(durationMs) : "-",
      artifactHint: (() => {
        const uri = resolveWorkflowInputArtifactUri({
          originalDoc: log.originalDoc,
        });
        if (!uri) return "—";
        const name = uri.split("/").pop() ?? uri;
        return name.length > 36 ? `${name.slice(0, 33)}…` : name;
      })(),
      errorMessage: log.errorMessage?.trim() || "",
    };
  });
  logByRowId.value = map;
  return rows;
});

const defaultColDef: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  minWidth: 90,
};

const columnDefs = computed((): ColDef<RequestLogGridRow>[] => {
  const cols: ColDef<RequestLogGridRow>[] = [
    {
      field: "requestTypeLabel",
      headerName: "種類",
      minWidth: 150,
      pinned: "left",
    },
    {
      field: "status",
      headerName: "ステータス",
      width: 110,
      cellClass: (p) => {
        const s = p.value as string;
        if (s === "completed") return "text-emerald-700 font-medium";
        if (s === "error") return "text-red-600 font-medium";
        if (s === "processing") return "text-sky-700 font-medium";
        return "text-gray-600";
      },
    },
    { field: "createdAt", headerName: "開始", minWidth: 168 },
    { field: "updatedAt", headerName: "終了", minWidth: 168 },
    { field: "duration", headerName: "所要", width: 88 },
    { field: "id", headerName: "Request ID", minWidth: 200 },
  ];
  if (props.workflowMode) {
    cols.push({
      field: "artifactHint",
      headerName: "Input (.yml)",
      minWidth: 140,
    });
  }
  cols.push({
    field: "errorMessage",
    headerName: "エラー",
    flex: 1,
    minWidth: 160,
    tooltipField: "errorMessage",
  });
  return cols;
});

const getRowId = (params: GetRowIdParams<RequestLogGridRow>): string =>
  `${params.data.requestType}_${params.data.id}`;

const onGridReady = (event: GridReadyEvent<RequestLogGridRow>): void => {
  gridApi.value = event.api;
  event.api.sizeColumnsToFit();
};

watch(rowData, (rows) => {
  gridApi.value?.setGridOption("rowData", rows);
});

watch(columnDefs, (cols) => {
  gridApi.value?.setGridOption("columnDefs", cols);
  gridApi.value?.sizeColumnsToFit();
});

const onRowClicked = (event: RowClickedEvent<RequestLogGridRow>): void => {
  if (!event.data) return;
  const key = `${event.data.requestType}_${event.data.id}`;
  const log = logByRowId.value.get(key);
  if (log) emit("select-log", log);
};
</script>

<style scoped>
.request-log-grid :deep(.ag-root-wrapper) {
  border-radius: 0.75rem;
  border: 1px solid rgb(229 231 235);
}

</style>
