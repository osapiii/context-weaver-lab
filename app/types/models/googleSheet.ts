import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestMetadataSchema } from "./core/operationMetadata";
import { RequestStatusEnum, RequestLogSchema } from "./core/requestStatus";

//#region シート検証の型を定義
export const sheetValidattionRulesetResultZodObject = z.array(
  z.object({
    isValid: z.boolean(),
    message: z.string(),
  })
);

/**
 * Google Sheet Validate Input Schema
 */
export const GoogleSheetValidateInputSchema = z.object({
  connectedGSheetId: z.string(),
});

export type GoogleSheetValidateInput = z.infer<typeof GoogleSheetValidateInputSchema>;

/**
 * Google Sheet Validate Output Schema
 */
export const GoogleSheetValidateOutputSchema = z.object({
  status: z.union([
    z.literal("completed"),
    z.literal("failed"),
  ]).nullable().optional(),
  message: z.string().nullable().optional(),
  all_validation_results: sheetValidattionRulesetResultZodObject.nullable().optional(),
});

export type GoogleSheetValidateOutput = z.infer<typeof GoogleSheetValidateOutputSchema>;

/**
 * Google Sheet Validate Request Schema
 * 
 * RequestDoc黄金テンプレート準拠
 */
export const googleSheetValidateRequestZodObject = z.object({
  // === Command: Input ===
  input: GoogleSheetValidateInputSchema,

  // === Command: RequestMetadata（共通型のみ、拡張禁止） ===
  operationMetadata: RequestMetadataSchema,

  // === Query: Output ===
  output: GoogleSheetValidateOutputSchema.nullable().optional(),

  // === Query: Status & Logs ===
  status: RequestStatusEnum.default("pending"),
  logs: z.array(RequestLogSchema).default([]),
  errorMessage: z.string().optional(),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedGoogleSheetValidateRequestZodObject =
  googleSheetValidateRequestZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// スキーマをもとに型を作成
export type decodedGoogleSheetValidateRequest = z.infer<
  typeof decodedGoogleSheetValidateRequestZodObject
>;

// FirestoreのTypeConverterを作成
export const googleSheetValidateRequestConverter = firestoreTypeConverter(
  decodedGoogleSheetValidateRequestZodObject
);
//#endregion シート検証の型を定義

//#region シートデータ取得の型を定義
/**
 * Google Sheet Data Fetch GCS Path Info Schema (Output用)
 * Firestoreの1MB制約を回避するため、GCSパスのみを返す
 */
/** GCS 取込成功時は全フィールドあり。失敗時は sheetName + status (+ error) のみのことがある */
export const googleSheetDataFetchGcsPathZodObject = z.object({
  sheetName: z.string(),
  gcsPath: z.string().optional(),
  gcsUri: z.string().optional(),
  tableName: z.string().optional(),
  status: z.string(),
  error: z.string().optional(),
});

/**
 * Google Sheet Data Fetch Input Schema
 */
export const GoogleSheetDataFetchInputSchema = z.object({
  connectedGSheetId: z.string(),
  workspaceId: z.string(),
  /** AIマスタ登録: 指定タブのみ取得（未指定時は従来の許可リスト） */
  targetSheetNames: z.array(z.string()).optional(),
  /** true のときタブ名一覧のみ返し GCS/BQ は行わない */
  accessCheckOnly: z.boolean().optional(),
});

export type GoogleSheetDataFetchInput = z.infer<typeof GoogleSheetDataFetchInputSchema>;

/**
 * Google Sheet Data Fetch Output Schema
 * GCSパス情報のみを含む（実際のデータはGCSからダウンロード）
 */
export const GoogleSheetDataFetchOutputSchema = z.object({
  gcsPaths: z.array(googleSheetDataFetchGcsPathZodObject).nullable().optional(),
  /** accessCheckOnly 時の接続確認結果 */
  accessStatus: z.union([z.literal("ok"), z.literal("failed")]).optional(),
  accessMessage: z.string().optional(),
  sheetNames: z.array(z.string()).optional(),
});

export type GoogleSheetDataFetchOutput = z.infer<typeof GoogleSheetDataFetchOutputSchema>;

/**
 * Google Sheet Data Fetch Request Schema
 * 
 * RequestDoc黄金テンプレート準拠
 */
export const googleSheetDataFetchRequestZodObject = z.object({
  // === Command: Input ===
  input: GoogleSheetDataFetchInputSchema,

  // === Command: RequestMetadata（共通型のみ、拡張禁止） ===
  operationMetadata: RequestMetadataSchema,

  // === Query: Output ===
  output: GoogleSheetDataFetchOutputSchema.nullable().optional(),

  // === Query: Status & Logs ===
  status: RequestStatusEnum.default("pending"),
  logs: z.array(RequestLogSchema).default([]),
  errorMessage: z.string().optional(),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedGoogleSheetDataFetchRequestZodObject =
  googleSheetDataFetchRequestZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// スキーマをもとに型を作成
export type decodedGoogleSheetDataFetchRequest = z.infer<
  typeof decodedGoogleSheetDataFetchRequestZodObject
>;

// FirestoreのTypeConverterを作成
export const googleSheetDataFetchRequestConverter = firestoreTypeConverter(
  decodedGoogleSheetDataFetchRequestZodObject
);
//#endregion シートデータ取得の型を定義
