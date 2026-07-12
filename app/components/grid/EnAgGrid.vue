<template>
  <div class="w-full" :class="wrapperClass" :style="wrapperStyle">
    <AgGridVue
      class="en-aistudio-ag-grid ag-theme-quartz h-full w-full"
      :class="gridClass"
      theme="legacy"
      :row-data="rowData"
      :column-defs="columnDefs"
      :default-col-def="mergedDefaultColDef"
      :get-row-id="getRowId"
      :components="components"
      :context="context"
      :dom-layout="domLayout"
      :pagination="pagination"
      :pagination-page-size="paginationPageSize"
      :pagination-page-size-selector="paginationPageSizeSelector"
      :row-height="rowHeight"
      :header-height="headerHeight"
      :suppress-cell-focus="suppressCellFocus"
      :enable-cell-text-selection="enableCellTextSelection"
      :animate-rows="animateRows"
      :auto-size-strategy="autoSizeStrategy"
      @grid-ready="onGridReady"
      @row-clicked="onRowClicked"
      @cell-value-changed="onCellValueChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
import { AgGridVue } from "ag-grid-vue3";
import type {
  CellValueChangedEvent,
  ColDef,
  DomLayoutType,
  GetRowIdFunc,
  GridApi,
  GridReadyEvent,
  RowClickedEvent,
  SizeColumnsToContentStrategy,
  SizeColumnsToFitGridStrategy,
  SizeColumnsToFitProvidedWidthStrategy,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import "~/assets/css/en-aistudio-ag-grid.css";
import { registerAgGridModules } from "@utils/agGrid/registerAgGridModules";
import { useEnAgGridDefaults } from "@composables/useEnAgGridDefaults";

registerAgGridModules();

const props = withDefaults(
  defineProps<{
    rowData: unknown[];
    columnDefs: ColDef[];
    defaultColDef?: ColDef;
    getRowId?: GetRowIdFunc;
    components?: Record<string, Component>;
    context?: Record<string, unknown>;
    gridHeightPx?: number;
    domLayout?: DomLayoutType;
    pagination?: boolean;
    paginationPageSize?: number;
    paginationPageSizeSelector?: number[] | boolean;
    rowHeight?: number;
    headerHeight?: number;
    suppressCellFocus?: boolean;
    enableCellTextSelection?: boolean;
    animateRows?: boolean;
    wrapperClass?: string;
    gridClass?: string;
    autoSizeStrategy?:
      | SizeColumnsToFitGridStrategy
      | SizeColumnsToFitProvidedWidthStrategy
      | SizeColumnsToContentStrategy;
  }>(),
  {
    domLayout: "normal",
    pagination: false,
    paginationPageSize: 25,
    paginationPageSizeSelector: () => [25, 50, 100],
    rowHeight: 48,
    headerHeight: 44,
    suppressCellFocus: true,
    enableCellTextSelection: true,
    animateRows: true,
    gridHeightPx: 420,
  }
);

const emit = defineEmits<{
  "grid-ready": [event: GridReadyEvent];
  "row-clicked": [event: RowClickedEvent];
  "cell-value-changed": [event: CellValueChangedEvent];
}>();

const { defaultColDef: baseDefaultColDef } = useEnAgGridDefaults();

const mergedDefaultColDef = computed(() => ({
  ...baseDefaultColDef,
  ...props.defaultColDef,
}));

const wrapperStyle = computed(() => {
  if (props.domLayout === "autoHeight") return undefined;
  return { height: `${props.gridHeightPx}px` };
});

const onGridReady = (event: GridReadyEvent): void => {
  emit("grid-ready", event);
};

const onRowClicked = (event: RowClickedEvent): void => {
  emit("row-clicked", event);
};

const onCellValueChanged = (event: CellValueChangedEvent): void => {
  emit("cell-value-changed", event);
};

defineExpose({
  getGridApi: (): GridApi | undefined => undefined,
});
</script>
