import { doc, onSnapshot } from "firebase/firestore";
import { parseGoogleSheetUrl } from "@composables/useEnAiStudioAssistantContext";
import { googleSheetDataFetchRequestZodObject } from "@models/googleSheet";
import type { z } from "zod";
import createRandomDocId from "@utils/createRandomDocId";
import log from "@utils/logger";

export type GoogleSheetConnectionStatus = "idle" | "checking" | "ok" | "failed";

const REQUEST_WAIT_TIMEOUT_MS = 120_000;

type FetchRequestDoc = z.infer<typeof googleSheetDataFetchRequestZodObject>;

/**
 * 任意のスプレッドシート URL に対する接続確認・シート取得。
 */
export function useGoogleSheetSpreadsheetAccess(workspaceId: Ref<string>) {
  const googleSheetStore = useGoogleSheetStore();
  const contextStore = useContextStore();
  const config = useRuntimeConfig();
  const storageOps = useFirebaseStorageOperations();

  const waitForRequest = (requestId: string): Promise<FetchRequestDoc> => {
    const db = useFirestore();
    const collectionPath = contextStore.baseFirestorePath(
      "requests/googleSheetDataFetchRequests/logs"
    );
    const docRef = doc(db, collectionPath, requestId);

    return new Promise((resolve, reject) => {
      let settled = false;
      let unsubscribe: (() => void) | undefined;

      const finish = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        unsubscribe?.();
        fn();
      };

      const timeoutId = setTimeout(() => {
        finish(() => {
          reject(
            new Error(
              "接続確認がタイムアウトしました。Functions の起動とサービスアカウント共有を確認してください。"
            )
          );
        });
      }, REQUEST_WAIT_TIMEOUT_MS);

      unsubscribe = onSnapshot(
        docRef,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          const status = data?.status;
          if (status === "completed") {
            finish(() => {
              resolve(googleSheetDataFetchRequestZodObject.parse(data));
            });
          } else if (status === "failed") {
            finish(() => {
              reject(
                new Error(data.errorMessage || "Gシート接続に失敗しました")
              );
            });
          }
        },
        (err) => {
          finish(() => {
            reject(err);
          });
        }
      );
    });
  };

  const runAccessCheck = async (
    sheetUrl: string
  ): Promise<{
    ok: boolean;
    message: string;
    sheetNames: string[];
    spreadsheetId: string;
  }> => {
    const parsed = parseGoogleSheetUrl(sheetUrl.trim());
    if (!parsed) {
      return {
        ok: false,
        message: "URL を確認してください",
        sheetNames: [],
        spreadsheetId: "",
      };
    }
    if (!workspaceId.value) {
      return {
        ok: false,
        message: "ワークスペースが未選択です",
        sheetNames: [],
        spreadsheetId: "",
      };
    }

    const requestId = createRandomDocId();
    const created = await googleSheetStore.createGoogleSheetDataFetchRequest({
      requestId,
      input: {
        connectedGSheetId: parsed.spreadsheetId,
        workspaceId: workspaceId.value,
        accessCheckOnly: true,
      },
    });
    if (!created) {
      return {
        ok: false,
        message: "接続確認リクエストの作成に失敗しました",
        sheetNames: [],
        spreadsheetId: parsed.spreadsheetId,
      };
    }

    try {
      const result = await waitForRequest(requestId);
      const output = result.output;
      if (output?.accessStatus === "ok" && output.sheetNames?.length) {
        return {
          ok: true,
          message:
            output.accessMessage || "スプレッドシートに接続できました",
          sheetNames: output.sheetNames,
          spreadsheetId: parsed.spreadsheetId,
        };
      }
      return {
        ok: false,
        message:
          output?.accessMessage ||
          "シートにアクセスできません。サービスアカウントを編集者として共有してください",
        sheetNames: [],
        spreadsheetId: parsed.spreadsheetId,
      };
    } catch (error) {
      log("ERROR", "GSheet access check failed", error);
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "接続確認に失敗しました",
        sheetNames: [],
        spreadsheetId: parsed.spreadsheetId,
      };
    }
  };

  const fetchSheetRows = async (
    sheetUrl: string,
    sheetName: string
  ): Promise<Record<string, unknown>[]> => {
    const parsed = parseGoogleSheetUrl(sheetUrl.trim());
    if (!parsed || !sheetName.trim()) {
      throw new Error("URL とシート名を指定してください");
    }
    if (!workspaceId.value) {
      throw new Error("ワークスペースが未選択です");
    }

    const requestId = createRandomDocId();
    const created = await googleSheetStore.createGoogleSheetDataFetchRequest({
      requestId,
      input: {
        connectedGSheetId: parsed.spreadsheetId,
        workspaceId: workspaceId.value,
        targetSheetNames: [sheetName],
      },
    });
    if (!created) {
      throw new Error("シート取得リクエストの作成に失敗しました");
    }

    const result = await waitForRequest(requestId);
    const gcsPaths = result.output?.gcsPaths ?? [];
    const target = gcsPaths.find(
      (p) => p.sheetName === sheetName && p.status === "success" && p.gcsPath
    );
    if (!target?.gcsPath) {
      const failed = gcsPaths.find((p) => p.sheetName === sheetName);
      const detail =
        failed?.error ||
        (failed && failed.status !== "success"
          ? `ステータス: ${failed.status}`
          : null);
      throw new Error(
        detail
          ? `シート「${sheetName}」の取得に失敗しました: ${detail}`
          : `シート「${sheetName}」のデータを取得できませんでした。タブ名がテンプレートと一致しているか確認してください`
      );
    }

    const bucketName =
      config.public.firebase.storageBucket ||
      "en-aistudio-development.firebasestorage.app";
    const csvText = await storageOps.downloadCsvFileFromGcs({
      bucketName,
      filePath: target.gcsPath,
    });
    if (!csvText?.trim()) {
      throw new Error("シートの内容が空です");
    }

    const rows = storageOps.parseCsvText(csvText);
    if (!rows.length) {
      throw new Error("シートにデータ行がありません");
    }
    return rows as Record<string, unknown>[];
  };

  return {
    runAccessCheck,
    fetchSheetRows,
    parseSheetUrl: parseGoogleSheetUrl,
  };
}
