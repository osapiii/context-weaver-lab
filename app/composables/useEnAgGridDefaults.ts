import type { ColDef } from "ag-grid-community";

/** 一覧系 AG Grid の defaultColDef */
export function useEnAgGridDefaults() {
  const defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    minWidth: 72,
    suppressMovable: false,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  };

  return { defaultColDef };
}
