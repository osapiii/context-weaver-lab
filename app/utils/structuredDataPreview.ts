import type { ColDef } from "ag-grid-community";
import { parseCsvPreviewTable } from "@utils/storageFilePreview";

/** CSV テキスト → AG Grid 用 columnDefs / rowData */
export const csvTextToAgGridModel = (params: {
  text: string;
  maxRows?: number;
}): { columnDefs: ColDef[]; rowData: Record<string, string>[] } | null => {
  const table = parseCsvPreviewTable(params.text, params.maxRows ?? 500);
  if (!table) return null;

  const columnDefs: ColDef[] = table.columns.map((col) => ({
    field: col.accessorKey,
    headerName: col.header,
    flex: 1,
    minWidth: 112,
    sortable: true,
    filter: true,
    resizable: true,
  }));

  return {
    columnDefs,
    rowData: table.rows,
  };
};

/** JSON テキストをパース（BOM 除去）。失敗時 null */
export const parseStructuredJsonText = (params: {
  text: string;
}): unknown | null => {
  const trimmed = params.text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
};
