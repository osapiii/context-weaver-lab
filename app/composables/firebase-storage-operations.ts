import { getApp } from "firebase/app";
import {
  getBytes,
  getDownloadURL,
  getMetadata,
  getStorage,
  listAll,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import { resolveStorageBucketName } from "@utils/adkAttachments";
import log from "@utils/logger";
import { ZodError, type z } from "zod";
import Papa, { parse } from "papaparse";
import type { errorCodeKeys } from "@models/errorCode";
import type { StorageFileMetadata } from "@models/storageFileMetadata";

/** Bucket ごとに正しい Storage インスタンスへ ref を作る（非デフォルトバケット対応） */
export const storageRefForBucketPath = (params: {
  bucketName: string;
  filePath: string;
}): ReturnType<typeof ref> => {
  const defaultBucket = resolveStorageBucketName();
  const app = getApp();
  const storage: FirebaseStorage =
    params.bucketName === defaultBucket
      ? getStorage(app)
      : getStorage(app, `gs://${params.bucketName}`);
  return ref(storage, params.filePath);
};

export function useFirebaseStorageOperations() {
  /**
   * 指定したバケット名とファイルパスからCSVファイルをダウンロードする
   */
  async function downloadCsvFileByBlobPath(params: {
    bucketName: string;
    filePath: string;
  }): Promise<string | undefined> {
    log(
      "INFO",
      "downloadCsvFileByBlobPath triggered🔥",
      "params is....",
      params
    );
    try {
      const storage = getStorage();
      const gerUrl = `gs://${params.bucketName}/${params.filePath}`;
      const gsReference = ref(storage, gerUrl);
      const url = await getDownloadURL(gsReference);

      log("INFO", "downloadCsvFileByBlobPath result📗 is...", url);
      return url;
    } catch (e) {
      log("ERROR", "downloadCsvFileByBlobPath error", e);
    }
  }

  /**
   * GCSからCSVファイルをダウンロードする（シンプル版）
   * @param params.bucketName GCSバケット名
   * @param params.filePath GCSファイルパス（バケット名を除く）
   * @returns CSVテキストデータ
   */
  async function downloadCsvFileFromGcs(params: {
    bucketName: string;
    filePath: string;
  }): Promise<string | undefined> {
    log(
      "INFO",
      "downloadCsvFileFromGcs triggered🔥",
      "params is....",
      params
    );
    try {
      const storage = getStorage();
      const gerUrl = `gs://${params.bucketName}/${params.filePath}`;
      const gsReference = ref(storage, gerUrl);
      const url = await getDownloadURL(gsReference);

      log("INFO", "downloadUrl result📗 is...", url);

      const response = await fetch(url);
      const textData = await response.text();
      
      log("INFO", "Raw CSV text data downloaded (length):", textData.length);
      return textData;
    } catch (e) {
      log("ERROR", "downloadCsvFileFromGcs error", e);
      return undefined;
    }
  }

  /**
   * CSVテキストをパースしてオブジェクト配列に変換する
   * @param csvText CSVテキストデータ
   * @returns パースされたCSVデータ（オブジェクト配列）
   */
  function parseCsvText(csvText: string): object[] {
    try {
      log("INFO", "Parsing CSV text...");
      
      const parsedData = parse(csvText, { 
        header: true,
        skipEmptyLines: false,
      }).data as Record<string, any>[];

      log("INFO", "Parsed CSV data (first 10 rows):", parsedData.slice(0, 10));
      log("INFO", "CSV headers:", parsedData.length > 0 ? Object.keys(parsedData[0]) : []);

      // undefinedの値を空文字列に変換（Zodバリデーションエラーを防ぐため）
      const normalizedData = parsedData.map((row) => {
        const normalizedRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          normalizedRow[key] = value === undefined || value === null ? "" : value;
        }
        return normalizedRow;
      });

      log("INFO", "Normalized CSV data (first 10 rows):", normalizedData.slice(0, 10));
      log("INFO", "Parsed CSV data", {
        rowCount: normalizedData.length,
      });
      return normalizedData as object[];
    } catch (e) {
      log("ERROR", "parseCsvText error", e);
      throw e;
    }
  }

  async function downloadCsvFileWithParse<T extends z.AnyZodObject>(params: {
    bucketName: string;
    filePath: string;
    zodObject: T;
    parseErrorCode: z.infer<typeof errorCodeKeys>;
  }): Promise<z.infer<T>[] | undefined> {
    log(
      "INFO",
      "downloadCsvFileWithParse triggered🔥",
      "params is....",
      params
    );
    const storage = getStorage();
    const globalError = useGlobalErrorStore();
    const gerUrl = `gs://${params.bucketName}/${params.filePath}`;
    const gsReference = ref(storage, gerUrl);
    try {
      const url = await getDownloadURL(gsReference);

      log("INFO", "downloadUrl result📗 is...", url);

      const response = await fetch(url);
      const textData = await response.text();
      const parsedData = parse(textData, { header: true }).data;

      const parsedObjects = [];
      for (const row of parsedData) {
        const parsedObject = params.zodObject.parse(row);
        parsedObjects.push(parsedObject);
      }
      log("INFO", "downloaded parsed object is...", parsedObjects);
      return parsedObjects;
    } catch (error) {
      if (error instanceof ZodError) {
        error.errors.forEach((err) => {
          log("ERROR", "Zod validation error:", err);
        });
      } else {
        log("ERROR", "Unexpected error:", error);
      }
      globalError.createNewGlobalError({
        globalErrorCode: params.parseErrorCode,
      });
    }
  }

  /**
   * 指定したバケット名とファイルパスのPdfファイルをダウンロードする
   *
   * @remarks
   * - ガイドライン準拠: guide_09_INFRA_firebase_storage.md
   * - getAuthenticatedUrlを使用してSigned URLを取得
   * - <a>要素を使用してブラウザダウンロード（window.open()はポップアップブロックのリスクあり）
   */
  async function downloadPdfFile(params: {
    bucketName: string;
    filePath: string;
  }): Promise<string | undefined> {
    log("INFO", "downloadPdfFile triggered🔥", "params is....", params);

    try {
      // ✅ CORRECT: getAuthenticatedUrlを使用
      const url = await getAuthenticatedUrl({
        bucketName: params.bucketName,
        filePath: params.filePath,
      });

      // ✅ CORRECT: <a>要素でダウンロード（window.open()よりも確実）
      const link = document.createElement("a");
      link.href = url;
      link.download = params.filePath.split("/").pop() || "download.pdf";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      log("INFO", "downloadPdfFile success📗", url);
      return url;
    } catch (error) {
      log("ERROR", "downloadPdfFile error", error);
      const globalError = useGlobalErrorStore();
      globalError.createNewGlobalError({
        selectedErrorMessage: "PDFファイルのダウンロードに失敗しました。",
      });
      return undefined;
    }
  }

  /**
   * 指定したバケット名とファイルパスにファイルをアップロードする
   *
   * @remarks
   * - PDF以外のファイルタイプにも対応（mimeTypeパラメータで指定）
   * - mimeTypeが指定されない場合は、rawDataのMIMEタイプを使用
   */
  async function uploadPdfFile(params: {
    bucketName: string;
    filePath: string;
    rawData: Blob;
    mimeType?: string;
  }): Promise<boolean> {
    log("INFO", "uploadPdfFile triggered🔥", "params is....", params);
    const globalError = useGlobalErrorStore();
    try {
      // Blobを作成（mimeTypeが指定されている場合はそれを使用、そうでなければrawDataのMIMEタイプを使用）
      const blobType = params.mimeType || params.rawData.type || "application/octet-stream";
      const blob = new Blob([params.rawData], { type: blobType });

      // 指定されたバケット名を使用してStorageインスタンスを取得
      // Firebase Storage SDKは、getStorage()にappとbucketNameを指定することでカスタムバケットを使用可能
      const { getApp } = await import("firebase/app");
      const app = getApp();
      // バケット名をgs://形式で指定（Firebase Storage SDKの仕様）
      const storage = getStorage(app, `gs://${params.bucketName}`);

      // filePathをそのまま使用（gs://形式は不要、ref関数が自動的に処理）
      const gsReference = ref(storage, params.filePath);

      log("INFO", "Uploading file to GCS", {
        bucketName: params.bucketName,
        filePath: params.filePath,
        referencePath: gsReference.fullPath,
      });

      // Blobをアップロード
      await uploadBytes(gsReference, blob);

      log("INFO", "uploadPdfFile success🎉", {
        bucketName: params.bucketName,
        filePath: params.filePath,
      });
      return true;
    } catch (e) {
      log("ERROR", "uploadPdfFile error", e, {
        bucketName: params.bucketName,
        filePath: params.filePath,
      });
      globalError.createNewGlobalError({
        selectedErrorMessage: globalError.errorCodeList.gcsFileDownload.E701,
      });
      return false;
    }
  }

  /**
   * 指定したバケット名とファイルパスにCSVファイルをアップロードする
   */
  async function uploadCsvFile(params: {
    bucketName: string;
    filePath: string;
    rawData: object[];
  }): Promise<boolean> {
    log("INFO", "uploadCsvFile triggered🔥", "params is....", params);
    const globalError = useGlobalErrorStore();
    try {
      // rawDataをCSV形式に変換
      const csv = Papa.unparse(params.rawData);

      // Blobを作成
      const blob = new Blob([csv], { type: "text/csv" });

      const storage = getStorage();
      const gsUrl = `gs://${params.bucketName}/${params.filePath}`;
      const gsReference = ref(storage, gsUrl);

      // Blobをアップロード
      await uploadBytes(gsReference, blob);

      log("INFO", "uploadCsvFile success🎉");
      return true;
    } catch (e) {
      log("ERROR", "uploadCsvFile error", e);
      globalError.createNewGlobalError({
        selectedErrorMessage: globalError.errorCodeList.gcsFileDownload.E701,
      });
      return false;
    }
  }

  /**
   * 指定したバケット名とファイルパスにJSONファイルをアップロードする
   */
  async function uploadJsonFile(params: {
    bucketName: string;
    filePath: string;
    rawData: object[] | object;
  }): Promise<boolean> {
    log("INFO", "uploadJsonFile triggered🔥", "params is....", params);
    const globalError = useGlobalErrorStore();
    try {
      // rawDataをJSON形式に変換
      const json = JSON.stringify(params.rawData);

      // Blobを作成
      const blob = new Blob([json], { type: "application/json" });

      const storage = getStorage();
      const gsUrl = `gs://${params.bucketName}/${params.filePath}`;
      const gsReference = ref(storage, gsUrl);

      // Blobをアップロード
      await uploadBytes(gsReference, blob);

      log("INFO", "uploadJsonFile success🎉");
      return true;
    } catch (e) {
      log("ERROR", "uploadJsonFile error", e);
      globalError.createNewGlobalError({
        selectedErrorMessage: globalError.errorCodeList.gcsFileDownload.E701,
      });
      return false;
    }
  }

  /**
   * 指定したバケット名とファイルパスにJSONファイルを型付けしてアップロードする
   */
  async function uploadJsonFileWithParse(params: {
    bucketName: string;
    filePath: string;
    zodObject: z.AnyZodObject;
    parseErrorCode: z.infer<typeof errorCodeKeys>;
    rawData: object[] | object;
  }): Promise<boolean> {
    log("INFO", "uploadJsonFile triggered🔥", "params is....", params);
    const globalError = useGlobalErrorStore();
    try {
      // JSONをZodObjectによるParse
      try {
        // zod parseする処理を記述
        const zodParsedJson = params.zodObject.parse(params.rawData);
        log("INFO", "zodParsedJson result📗 is...", zodParsedJson);

        // Blobを作成
        const blob = new Blob([JSON.stringify(zodParsedJson)], {
          type: "application/json",
        });

        const storage = getStorage();
        const gsUrl = `gs://${params.bucketName}/${params.filePath}`;
        const gsReference = ref(storage, gsUrl);

        // Blobをアップロード
        await uploadBytes(gsReference, blob);

        log("INFO", "uploadJsonFile success🎉");
        return true;
      } catch (error) {
        if (error instanceof ZodError) {
          error.errors.forEach((err) => {
            log("ERROR", "Zod validation error:", err);
          });
        } else {
          log("ERROR", "Unexpected error:", error);
        }
        globalError.createNewGlobalError({
          globalErrorCode: params.parseErrorCode,
        });
        return false;
      }
    } catch (e) {
      log("ERROR", "uploadJsonFile error", e);
      globalError.createNewGlobalError({
        globalErrorCode: params.parseErrorCode,
      });
      return false;
    }
  }

  /**
   * 指定したバケット名とファイルパスからJSONファイルを受け取って、引数の任意のzodObjectによるParseを実行→成功したら返却する
   */
  async function fetchJsonFileByBlobPathWithParse<
    T extends z.AnyZodObject,
  >(params: {
    bucketName: string;
    filePath: string;
    zodObject: T;
    parseErrorCode: z.infer<typeof errorCodeKeys>;
  }): Promise<z.infer<T> | undefined> {
    log(
      "INFO",
      "fetchJsonFileByBlobPathWithParse triggered🔥",
      "params is....",
      params
    );

    const storage = getStorage();
    const globalError = useGlobalErrorStore();
    try {
      // Blobを取得
      const gerUrl = `gs://${params.bucketName}/${params.filePath}`;
      const gsReference = ref(storage, gerUrl);
      log("INFO", "file fetch by getBytes🔥");
      const blob = await getBytes(gsReference);
      log("INFO", "file fetch completed!");

      // BlobをJSONに変換
      const json = new TextDecoder("utf-8").decode(blob);
      const parsedJson = JSON.parse(json);
      log("INFO", "parsedJson result📗 is...", parsedJson);

      // JSONをZodObjectによるParse
      try {
        // zod parseする処理を記述
        const zodParsedJson = params.zodObject.parse(parsedJson);
        log("INFO", "zodParsedJson result📗 is...", zodParsedJson);
        return zodParsedJson;
      } catch (error) {
        if (error instanceof ZodError) {
          error.errors.forEach((err) => {
            log("ERROR", "Zod validation error:", err);
          });
        } else {
          log("ERROR", "Unexpected error:", error);
        }
        globalError.createNewGlobalError({
          globalErrorCode: params.parseErrorCode,
        });
      }
    } catch (e) {
      log("ERROR", "downloadJsonFileByBlobPath error", e);
      globalError.createNewGlobalError({
        globalErrorCode: params.parseErrorCode,
      });
    }
  }
  async function downloadJsonFile(params: {
    bucketName: string;
    filePath: string;
  }) {
    try {
      const storage = getStorage();
      const gerUrl = `gs://${params.bucketName}/${params.filePath}`;
      const gsReference = ref(storage, gerUrl);
      const url = await getDownloadURL(gsReference);
      const response = await fetch(url);
      const jsonData = await response.json();
      return jsonData;
    } catch (error) {
      log("ERROR", "Error downloading JSON file:", error);
    }
  }

  /**
   * 指定パス配下のファイル一覧とフォルダ一覧を取得
   *
   * @remarks
   * - organization境界検証を実施
   * - エラー時はthrow
   */
  async function listFiles(params: {
    bucketName: string;
    path: string;
    organizationId: string;
  }): Promise<{
    files: StorageFileMetadata[];
    folders: string[];
  }> {
    log("INFO", "listFiles triggered🔥", "params is....", params);

    // ✅ CORRECT: organization境界検証
    const expectedPrefix = `organizations/${params.organizationId}/`;
    const isRoot = params.path === expectedPrefix;
    const isValid = isRoot || params.path.startsWith(expectedPrefix);

    if (!isValid) {
      throw new Error(
        `Access denied: Path '${params.path}' is outside organization '${params.organizationId}' boundary`
      );
    }

    const storage = getStorage();
    const gsUrl = `gs://${params.bucketName}/${params.path}`;
    const gsReference = ref(storage, gsUrl);

    const listResult = await listAll(gsReference);

    // ファイルメタデータを取得
    const filesPromises = listResult.items.map(async (item) => {
      const metadata = await getMetadata(item);
      return {
        name: metadata.name,
        fullPath: metadata.fullPath,
        bucket: metadata.bucket,
        size: metadata.size,
        contentType: metadata.contentType || "application/octet-stream",
        timeCreated: metadata.timeCreated,
        updated: metadata.updated,
      } as StorageFileMetadata;
    });

    const files = await Promise.all(filesPromises);
    const folders = listResult.prefixes.map((prefix) => prefix.name);

    log("INFO", "listFiles result📗", {
      filesCount: files.length,
      foldersCount: folders.length,
    });

    return { files, folders };
  }

  /**
   * 認証済みURLを生成（有効期限1時間）
   *
   * @remarks
   * - Firebase Storage APIでgetDownloadURLを呼び出し
   * - キャッシュはStoreで管理
   * - ガイドライン準拠: guide_09_INFRA_firebase_storage.md セクション1
   */
  async function getAuthenticatedUrl(params: {
    bucketName: string;
    filePath: string;
  }): Promise<string> {
    log("INFO", "getAuthenticatedUrl triggered🔥", "params is....", params);

    const gsReference = storageRefForBucketPath({
      bucketName: params.bucketName,
      filePath: params.filePath,
    });

    const url = await getDownloadURL(gsReference);

    log("INFO", "getAuthenticatedUrl result📗", url);

    return url;
  }

  return {
    downloadCsvFileByBlobPath,
    downloadCsvFileWithParse,
    downloadCsvFileFromGcs,
    parseCsvText,
    downloadJsonFile,
    downloadPdfFile,
    uploadCsvFile,
    uploadPdfFile,
    uploadJsonFile,
    uploadJsonFileWithParse,
    fetchJsonFileByBlobPathWithParse,
    listFiles,
    getAuthenticatedUrl,
  };
}
