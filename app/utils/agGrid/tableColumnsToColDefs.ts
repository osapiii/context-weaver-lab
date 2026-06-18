import type { ColDef } from "ag-grid-community";

export type TableSchemaColumn = {
  accessorKey: string;
  header: string;
  sortable?: boolean;
};

/** TanStack / table-schema 形式の列定義を AG Grid ColDef に変換 */
export function tableColumnsToColDefs(params: {
  columns: TableSchemaColumn[];
  overrides?: Record<string, Partial<ColDef>>;
}): ColDef[] {
  const { columns, overrides = {} } = params;
  return columns.map((column) => {
    const base: ColDef = {
      field: column.accessorKey,
      headerName: column.header,
      sortable: column.sortable ?? true,
      minWidth: 96,
    };
    const extra = overrides[column.accessorKey];
    return extra ? { ...base, ...extra } : base;
  });
}
