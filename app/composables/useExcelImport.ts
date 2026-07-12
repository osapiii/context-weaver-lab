/**
 * Excel (.xlsx / .xls) Import Composable
 *
 * 個別マスタ取り込みモーダル(ProductionLine / ShippingEvent /
 * ProductionCalendar / MaterialCalendar 等)から、ローカルの
 * Excel ファイルを CSV と同じ行配列に変換するための共通処理。
 *
 * - preferredSheetName と一致するシートを優先選択
 * - 一致シートが無ければ最初のシートを使う
 * - パース結果は `Record<string, unknown>[]` で返り、既存の
 *   validateUploadedRawCsvData 系に直接乗せられる形式
 */

import * as XLSX from "xlsx";
import log from "@utils/logger";

export interface ExcelImportResult {
  rows: Record<string, unknown>[];
  sheetName: string;
  fileName: string;
}

export const useExcelImport = () => {
  /**
   * File オブジェクトを読み込み、対象シートを行配列に変換する
   *
   * @returns 成功時は { rows, sheetName, fileName }、失敗時は null
   *          (失敗理由は引数 onError コールバックで通知)
   */
  const readExcelFile = async (params: {
    file: File;
    preferredSheetName?: string;
    onError?: (message: string, description?: string) => void;
  }): Promise<ExcelImportResult | null> => {
    const { file, preferredSheetName, onError } = params;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      if (!workbook.SheetNames.length) {
        onError?.("Excelファイルにシートが含まれていません");
        return null;
      }

      const sheetName =
        (preferredSheetName &&
          workbook.SheetNames.find((s) => s === preferredSheetName)) ||
        workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        onError?.("シートを読み込めませんでした", sheetName);
        return null;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        { defval: "" }
      );

      if (!rows.length) {
        onError?.("シートにデータがありません", sheetName);
        return null;
      }

      return {
        rows,
        sheetName,
        fileName: file.name,
      };
    } catch (error) {
      log("ERROR", "useExcelImport.readExcelFile failed", error);
      onError?.("Excelファイルの読み込みに失敗しました");
      return null;
    }
  };

  /**
   * <input type="file"> の change イベントから最初のファイルを取り出す
   */
  const pickFileFromEvent = (event: Event): File | null => {
    const target = event.target as HTMLInputElement | null;
    if (!target || !target.files || target.files.length === 0) return null;
    return target.files[0];
  };

  /**
   * input.value をクリアして同じファイルを再選択可能にする
   */
  const resetFileInput = (event: Event): void => {
    const target = event.target as HTMLInputElement | null;
    if (target) target.value = "";
  };

  return {
    readExcelFile,
    pickFileFromEvent,
    resetFileInput,
  };
};
