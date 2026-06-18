import { computed, ref, type Ref } from "vue";
import { useGoogleSheetSpreadsheetAccess } from "@composables/googleSheet/useGoogleSheetSpreadsheetAccess";
import { normalizeSpreadsheetId } from "@constants/googleSheet";
import { buildSpreadsheetUrl } from "@utils/sheetWorkspaceState";
import log from "@utils/logger";

export interface VerifiedSheetTab {
  title: string;
  sheetId?: number;
}

export interface VerifySpreadsheetResult {
  ok: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheetNames?: VerifiedSheetTab[];
  error?: string;
}

/** モジュール単位で共有（ピッカー再マウント時も検証結果を保持） */
const isVerifying = ref(false);
const lastError = ref<string | null>(null);
const verifiedSpreadsheetId = ref<string | null>(null);
const verifiedSpreadsheetUrl = ref<string | null>(null);
const sheetTabs = ref<VerifiedSheetTab[]>([]);

const resolveSpreadsheetUrl = (params: {
  spreadsheetUrl?: string;
  spreadsheetId?: string;
}): string => {
  const rawUrl = params.spreadsheetUrl?.trim() ?? "";
  if (rawUrl) return rawUrl;
  const id = params.spreadsheetId?.trim() ?? "";
  if (id) return buildSpreadsheetUrl({ spreadsheetId: normalizeSpreadsheetId(id) });
  return "";
};

export const useAiStudioSheetConnection = () => {
  const sheetScopeId = ref("en-aistudio");
  const gsheetAccess = useGoogleSheetSpreadsheetAccess(
    sheetScopeId as Ref<string>
  );

  const resetVerification = (): void => {
    lastError.value = null;
    verifiedSpreadsheetId.value = null;
    verifiedSpreadsheetUrl.value = null;
    sheetTabs.value = [];
  };

  const parseSpreadsheetId = (raw: string): string =>
    normalizeSpreadsheetId(raw);

  /**
   * マスタ生成・一括取込と同じ RequestDoc 経路で接続確認する.
   * (verify_ai_studio_spreadsheet Callable は使わない)
   */
  const verifySpreadsheet = async (params: {
    spreadsheetUrl?: string;
    spreadsheetId?: string;
  }): Promise<VerifySpreadsheetResult> => {
    const spreadsheetUrl = resolveSpreadsheetUrl(params);
    const spreadsheetId = spreadsheetUrl
      ? normalizeSpreadsheetId(spreadsheetUrl)
      : "";

    if (!spreadsheetId) {
      const message = "有効なスプレッドシート URL を入力してください";
      lastError.value = message;
      resetVerification();
      return { ok: false, error: message };
    }

    isVerifying.value = true;
    lastError.value = null;

    try {
      const result = await gsheetAccess.runAccessCheck(spreadsheetUrl);
      if (result.ok && result.sheetNames.length > 0) {
        verifiedSpreadsheetId.value = result.spreadsheetId || spreadsheetId;
        verifiedSpreadsheetUrl.value = buildSpreadsheetUrl({
          spreadsheetId: verifiedSpreadsheetId.value,
        });
        sheetTabs.value = result.sheetNames.map((title) => ({ title }));
        lastError.value = null;
        return {
          ok: true,
          spreadsheetId: verifiedSpreadsheetId.value,
          spreadsheetUrl: verifiedSpreadsheetUrl.value,
          sheetNames: sheetTabs.value,
        };
      }

      const message =
        result.message ||
        "シートにアクセスできません。サービスアカウントを編集者として共有してください。";
      lastError.value = message;
      resetVerification();
      return { ok: false, error: message };
    } catch (error) {
      log("WARN", "[useAiStudioSheetConnection] verify failed", error);
      const message =
        error instanceof Error ? error.message : "接続確認に失敗しました";
      lastError.value = message;
      resetVerification();
      return { ok: false, error: message };
    } finally {
      isVerifying.value = false;
    }
  };

  const buildOpenUrl = (params: {
    spreadsheetId: string;
    targetSheetGid?: number | null;
  }): string => buildSpreadsheetUrl(params);

  return {
    isVerifying,
    lastError,
    verifiedSpreadsheetId,
    verifiedSpreadsheetUrl,
    sheetTabs,
    resetVerification,
    parseSpreadsheetId,
    verifySpreadsheet,
    buildOpenUrl,
    sheetScopeId,
  };
};
