/** AI Studio シートモード — golden `state.sheet` のみ */

import { readTaskBucketFromSessionState } from "@utils/workspaceSessionBuckets";

export interface SheetConnectionFields {
  sheetModeSelected: boolean;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  targetSheetName: string | null;
  targetSheetGid: number | null;
}

export const emptySheetConnectionFields = (): SheetConnectionFields => ({
  sheetModeSelected: false,
  spreadsheetId: null,
  spreadsheetUrl: null,
  targetSheetName: null,
  targetSheetGid: null,
});

export const buildSpreadsheetUrl = (params: {
  spreadsheetId: string;
  targetSheetGid?: number | null;
}): string => {
  const base = `https://docs.google.com/spreadsheets/d/${params.spreadsheetId}/edit`;
  if (params.targetSheetGid != null && Number.isFinite(params.targetSheetGid)) {
    return `${base}#gid=${params.targetSheetGid}`;
  }
  return base;
};

export const resolveSheetModeSelectedFromSessionState = (params: {
  state: Record<string, unknown>;
}): boolean => {
  const bucket = readTaskBucketFromSessionState(params.state, "sheet");
  return bucket.sheet_mode_selected === true;
};

export const resolveSheetFieldsFromRecord = (params: {
  state: Record<string, unknown>;
}): SheetConnectionFields => {
  const apiSheet = readTaskBucketFromSessionState(params.state, "sheet");

  const sheetModeSelected = resolveSheetModeSelectedFromSessionState({
    state: params.state,
  });

  if (!sheetModeSelected) {
    return emptySheetConnectionFields();
  }

  const spreadsheetId =
    (typeof apiSheet.spreadsheet_id === "string" && apiSheet.spreadsheet_id) ||
    null;

  const spreadsheetUrl =
    (typeof apiSheet.spreadsheet_url === "string" && apiSheet.spreadsheet_url) ||
    (spreadsheetId ? buildSpreadsheetUrl({ spreadsheetId }) : null);

  const targetSheetName =
    (typeof apiSheet.target_sheet_name === "string" &&
      apiSheet.target_sheet_name) ||
    null;

  const gidRaw = apiSheet.target_sheet_gid;
  const targetSheetGid =
    typeof gidRaw === "number" && Number.isFinite(gidRaw) ? gidRaw : null;

  return {
    sheetModeSelected,
    spreadsheetId,
    spreadsheetUrl,
    targetSheetName,
    targetSheetGid,
  };
};

export const sheetModeStateToApi = (
  sheet: SheetConnectionFields
): Record<string, unknown> => ({
  sheet_mode_selected: sheet.sheetModeSelected,
  spreadsheet_id: sheet.spreadsheetId,
  spreadsheet_url: sheet.spreadsheetUrl,
  target_sheet_name: sheet.targetSheetName,
  target_sheet_gid: sheet.targetSheetGid,
});

export const clearedSheetModeStateFragment = (): Record<string, unknown> => ({
  sheet: {
    sheet_mode_selected: false,
    spreadsheet_id: null,
    spreadsheet_url: null,
    target_sheet_name: null,
    target_sheet_gid: null,
  },
});
