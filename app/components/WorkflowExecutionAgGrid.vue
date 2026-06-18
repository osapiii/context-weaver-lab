<template>
  <div
    class="workflow-execution-grid w-full"
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
      :context="gridContext"
      @grid-ready="onGridReady"
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
  type GetRowIdParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import "~/assets/css/en-aistudio-ag-grid.css";
import type { WorkflowItem, WorkflowItemStatus } from "@models/workflowItem";
import { formatTimestamp } from "@utils/requestLogHelpers";
import WorkflowExecutionActionCell from "@components/workflow/WorkflowExecutionActionCell.vue";

ModuleRegistry.registerModules([AllCommunityModule]);

export type WorkflowExecutionGridRow = {
  id: string;
  sourceKindLabel: string;
  label: string;
  status: WorkflowItemStatus;
  statusLabel: string;
  progressLabel: string;
  createdAt: string;
  updatedAt: string;
  errorMessage: string;
  navigable: boolean;
};

const props = withDefaults(
  defineProps<{
    items: WorkflowItem[];
    gridHeightPx?: number;
  }>(),
  { gridHeightPx: 480 }
);

const emit = defineEmits<{
  "open-result": [item: WorkflowItem];
  "open-detail": [item: WorkflowItem];
}>();

const SOURCE_KIND_LABELS: Record<WorkflowItem["sourceKind"], string> = {
  adkSession: "AIスタジオ",
  workflowRequest: "ワークフロー",
};

const STATUS_LABELS: Record<WorkflowItemStatus, string> = {
  pending: "待機中",
  running: "実行中",
  completed: "完了",
  error: "エラー",
};

const gridApi = ref<GridApi<WorkflowExecutionGridRow> | null>(null);
const itemByRowId = computed(
  () => new Map(props.items.map((item) => [item.id, item]))
);

const rowData = computed((): WorkflowExecutionGridRow[] => {
  return props.items.map((item) => {
    return {
      id: item.id,
      sourceKindLabel: SOURCE_KIND_LABELS[item.sourceKind],
      label: item.label,
      status: item.status,
      statusLabel: STATUS_LABELS[item.status],
      progressLabel: item.progressLabel ?? "",
      createdAt: formatTimestamp(item.createdAt),
      updatedAt: formatTimestamp(item.updatedAt),
      errorMessage: item.errorMessage?.trim() || "",
      navigable: !!item.navigateTarget,
    };
  });
});

const defaultColDef: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  minWidth: 90,
};

const columnDefs = computed((): ColDef<WorkflowExecutionGridRow>[] => [
  {
    headerName: "操作",
    width: 132,
    minWidth: 132,
    maxWidth: 132,
    pinned: "left",
    sortable: false,
    filter: false,
    resizable: false,
    cellRenderer: WorkflowExecutionActionCell,
  },
  {
    field: "sourceKindLabel",
    headerName: "種別",
    width: 120,
    pinned: "left",
  },
  {
    field: "label",
    headerName: "内容",
    minWidth: 180,
  },
  {
    field: "statusLabel",
    headerName: "ステータス",
    width: 110,
    cellClass: (p) => {
      const s = p.data?.status;
      if (s === "completed") return "text-emerald-700 font-medium";
      if (s === "error") return "text-red-600 font-medium";
      if (s === "running") return "text-sky-700 font-medium";
      return "text-gray-600";
    },
  },
  { field: "progressLabel", headerName: "進捗", minWidth: 160 },
  { field: "createdAt", headerName: "開始", minWidth: 168 },
  { field: "updatedAt", headerName: "更新", minWidth: 168 },
  {
    field: "errorMessage",
    headerName: "エラー",
    flex: 1,
    minWidth: 160,
    tooltipField: "errorMessage",
  },
]);

const emitItem = (
  rowId: string,
  event: "open-result" | "open-detail"
): void => {
  const item = itemByRowId.value.get(rowId);
  if (!item) return;
  if (event === "open-result") {
    emit("open-result", item);
  } else {
    emit("open-detail", item);
  }
};

const gridContext = {
  onOpenResult: (rowId: string) => emitItem(rowId, "open-result"),
  onOpenDetail: (rowId: string) => emitItem(rowId, "open-detail"),
};

const getRowId = (params: GetRowIdParams<WorkflowExecutionGridRow>): string =>
  params.data.id;

const onGridReady = (event: GridReadyEvent<WorkflowExecutionGridRow>): void => {
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

</script>

<style scoped>
.workflow-execution-grid :deep(.ag-root-wrapper) {
  border-radius: 0.75rem;
  border: 1px solid rgb(229 231 235);
}
</style>
