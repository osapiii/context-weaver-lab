import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestMetadataSchema } from "./core/operationMetadata";
import { RequestStatusEnum, RequestLogSchema } from "./core/requestStatus";
// Document関連の型とconverterは別ファイルからインポート
import type {
  Document,
  DecodedDocument,
  DocumentSubCategory,
} from "./document";
import {
  DocumentSchema,
  DecodedDocumentSchema,
  DocumentSubCategoryEnum,
  documentConverter,
} from "./document";

// Document関連の型とconverterを再エクスポート（後方互換性のため）
export type { Document, DecodedDocument, DocumentSubCategory };
export {
  DocumentSchema,
  DecodedDocumentSchema,
  DocumentSubCategoryEnum,
  documentConverter,
};

/**
 * FileSpaceOperationType Enum
 *
 * operationTypeのUnion型定義
 */
export const FileSpaceOperationTypeEnum = z.union([
  z.literal("fileSpaceCreate"),
  z.literal("fileSpaceList"),
  z.literal("fileSpaceGet"),
  z.literal("fileSpaceUpload"),
  z.literal("fileSpaceDocumentList"),
  z.literal("fileSpaceDelete"),
  z.literal("documentDelete"),
]);

export type FileSpaceOperationType = z.infer<typeof FileSpaceOperationTypeEnum>;

/**
 * FileSpaceType Enum
 *
 * FileSpaceの生成タイプを表すUnion型
 */
export const FileSpaceTypeEnum = z.union([
  z.literal("system"), // システム生成
  z.literal("manual"), // 手動生成
]);

export type FileSpaceType = z.infer<typeof FileSpaceTypeEnum>;

/**
 * FileSpaceOperationInput Schema
 *
 * operationTypeに応じて異なるフィールドを持つInput型定義
 */
export const FileSpaceOperationInputSchema = z.discriminatedUnion(
  "operationType",
  [
    z.object({
      operationType: z.literal("fileSpaceCreate"),
      displayName: z.string().optional(),
      description: z.string().optional(),
      fileSpaceType: FileSpaceTypeEnum.optional(), // 生成タイプ（system or manual、デフォルト: manual）
    }),
    z.object({
      operationType: z.literal("fileSpaceList"),
    }),
    z.object({
      operationType: z.literal("fileSpaceGet"),
      storeId: z.string(), // FileSearchStoreのID（パスから`fileSearchStores/`プレフィックスを除いた部分）
    }),
    z.object({
      operationType: z.literal("fileSpaceUpload"),
      storeId: z.string(), // FileSearchStoreのID（パスから`fileSearchStores/`プレフィックスを除いた部分）
      bucketName: z.string(), // GCSバケット名
      filePath: z.string(), // GCS内のファイルパス（バケット名を除く）
      customMetadata: z
        .array(
          z.object({
            key: z.string(),
            value: z.string(),
          })
        )
        .optional(), // カスタムメタデータ（key-value形式の配列）
      mimeType: z.string().optional(), // ファイルのMIMEタイプ
      documentId: z.string().optional(), // Agent Search document ID (= Firestore docId 推奨)
      description: z.string().optional(), // Documentの説明
      originalFileInfo: z
        .object({
          fileName: z.string().nullable().optional(), // オリジナルのファイル名
          bytes: z.number().nullable().optional(), // オリジナルのファイルサイズ（バイト）
        })
        .optional(), // オリジナルファイル情報（fileUpload時に保存）
    }),
    z.object({
      operationType: z.literal("fileSpaceDocumentList"),
      storeId: z.string(), // FileSearchStoreのID（パスから`fileSearchStores/`プレフィックスを除いた部分）
    }),
    z.object({
      operationType: z.literal("fileSpaceDelete"),
      storeId: z.string(), // FileSearchStoreのID（パスから`fileSearchStores/`プレフィックスを除いた部分）
      force: z.boolean().optional().default(true), // 強制削除フラグ（デフォルト: true）
    }),
    z.object({
      operationType: z.literal("documentDelete"),
      storeId: z.string(), // FileSearchStoreのID（パスから`fileSearchStores/`プレフィックスを除いた部分）
      documentId: z.string(), // DocumentのID（パスから`fileSearchStores/{storeId}/documents/`プレフィックスを除いた部分）
    }),
  ]
);

export type FileSpaceOperationInput = z.infer<
  typeof FileSpaceOperationInputSchema
>;

/**
 * FileSpaceOperationOutput Schema
 *
 * operationTypeに応じて異なる構造を持つOutput型定義
 * Cloud RunのレスポンスのoutputをそのままRequestDocのoutputに設定するため、
 * Cloud Run側で返されるoutput構造をそのまま定義
 *
 * BG関数がCloud Runレスポンスを以下のように処理:
 * response_data = response.json()  # {"status": "success", "requestId": "...", "output": {...}}
 * output = response_data.get("output")  # Cloud Runのoutputをそのまま設定
 *
 * 実際のoutput構造:
 * {
 *   "response": {
 *     "name": "...",
 *     "displayName": "...",
 *     "createTime": "...",
 *     "updateTime": "..."
 *   },
 *   "statusCode": 200
 * }
 */
export const FileSpaceOperationOutputSchema = z
  .union([
    // fileSpaceCreate用のoutput
    // 実際の構造: フラットな構造（responseでラップされていない）
    z.object({
      name: z.string().nullable(),
      displayName: z.string().nullable(),
      createTime: z.string().nullable(),
      updateTime: z.string().nullable(),
    }),
    // fileSpaceList用のoutput
    // 実際の構造: {stores: [...]}
    z.object({
      stores: z.array(
        z.object({
          name: z.string().nullable(),
          displayName: z.string().nullable().optional(),
          description: z.string().nullable().optional(),
          createTime: z.string().nullable(),
          updateTime: z.string().nullable(),
        })
      ),
    }),
    // fileSpaceGet用のoutput
    // 実際の構造: {response: {...}, statusCode: 200}
    z.object({
      response: z.object({
        name: z.string().nullable(),
        displayName: z.string().nullable().optional(),
        createTime: z.string().nullable(),
        updateTime: z.string().nullable(),
        fileCount: z.number().optional(),
      }),
      statusCode: z.number(),
    }),
    // fileSpaceUpload用のoutput
    // 実際の構造: {statusCode: 200, response: {name: "operations/...", done: false, metadata: {...}}}
    z.object({
      statusCode: z.number(),
      response: z.object({
        name: z.string().nullable().optional(), // Operation名（例: "operations/upload_789"）
        done: z.boolean().optional(), // 完了フラグ
        metadata: z.any().optional(), // メタデータ
      }),
    }),
    // fileSpaceDocumentList用のoutput
    // 実際の構造: {documents: [...]} (output.responseの中身のみ)
    z.object({
      documents: z.array(
        z.object({
          name: z.string().nullable(),
          displayName: z.string().nullable().optional(),
          createTime: z.string().nullable(),
          updateTime: z.string().nullable(),
          state: z.string().nullable().optional(), // STATE_ACTIVE等
          sizeBytes: z.string().nullable().optional(), // サイズ（文字列形式）
          mimeType: z.string().nullable().optional(), // MIMEタイプ
        })
      ),
    }),
  ])
  .nullable();

export type FileSpaceOperationOutput = z.infer<
  typeof FileSpaceOperationOutputSchema
>;

/**
 * FileSpace Base Schema
 *
 * fileSpaceListのoutputから取得されるFileSearchStore情報
 * output構造: response.output.stores.response.fileSearchStores配列の各要素
 *
 * 注意: このスキーマはAPIレスポンス用。Firestore永続化にはFileSpacePersistedSchemaを使用
 */
export const FileSpaceSchema = z.object({
  name: z.string().nullable(), // FileSearchStore名（例: "fileSearchStores/w705zpywmey1-7rc9avfyza22"）
  displayName: z.string().nullable().optional(), // 表示名
  description: z.string().nullable().optional(), // 説明
  createTime: z.string().nullable(), // 作成日時（ISO 8601形式）
  updateTime: z.string().nullable(), // 更新日時（ISO 8601形式）
  fileSpaceType: FileSpaceTypeEnum.default("manual"), // 生成タイプ（system or manual、デフォルト: manual）
});

export type FileSpace = z.infer<typeof FileSpaceSchema>;

/**
 * Document Persisted Schema
 *
 * Firestoreに永続化されるDocument情報
 * organizationId, spaceId, createdAt, updatedAtを含む
 */
export const DocumentPersistedSchema = z.object({
  name: z.string().nullable(), // Document名（例: "fileSearchStores/abc123/documents/doc1"）
  displayName: z.string().nullable().optional(), // 表示名
  description: z.string().nullable().optional(), // 説明
  createTime: z.string().nullable(), // 作成日時（ISO 8601形式）
  updateTime: z.string().nullable(), // 更新日時（ISO 8601形式）
  state: z.string().nullable().optional(), // STATE_ACTIVE等
  sizeBytes: z.string().nullable().optional(), // サイズ（文字列形式）
  mimeType: z.string().nullable().optional(), // MIMEタイプ
  bucketName: z.string().nullable().optional(), // GCSバケット名
  filePath: z.string().nullable().optional(), // GCSファイルパス
  status: z.string().nullable().optional(), // 接続ステータス（"connected", "disconnected"等）
  subCategory: DocumentSubCategoryEnum.nullable().optional(), // サブカテゴリ（fileUpload, entryUrl, urlMarkdown）
  originalFileInfo: z
    .object({
      fileName: z.string().nullable().optional(), // オリジナルのファイル名
      bytes: z.number().nullable().optional(), // オリジナルのファイルサイズ（バイト）
    })
    .nullable()
    .optional(), // オリジナルファイル情報（fileUpload時に保存）
  // エントリーURL Document固有のフィールド
  entryUrl: z.string().nullable().optional(), // エントリーURL（entryUrl subCategory時）
  maxDepth: z.number().nullable().optional(), // 探索の深さ（entryUrl subCategory時）
  maxUrls: z.number().nullable().optional(), // 上限ページ数（entryUrl subCategory時）
  totalPages: z.number().nullable().optional(), // 総ページ数（entryUrl subCategory時）
  // URL Markdown Document固有のフィールド
  url: z.string().nullable().optional(), // クロール元URL（urlMarkdown subCategory時）
  gcsUrl: z.string().nullable().optional(), // GCS URL（urlMarkdown subCategory時）
  title: z.string().nullable().optional(), // ページタイトル（urlMarkdown subCategory時）
  // Phase R-1b: Drive 同期由来の Document に付くフィールド
  driveFileId: z.string().nullable().optional(), // Drive 上のファイル ID (画像/動画など GCS に置かないもの用に最低限これだけは保持)
  driveFolderId: z.string().nullable().optional(),
  driveModifiedTime: z.string().nullable().optional(),
  driveWebViewLink: z.string().nullable().optional(), // Drive で開くリンク
  thumbnailLink: z.string().nullable().optional(), // Drive 提供のサムネイル URL
  storeId: z.string(), // FileSearchStoreのID
  organizationId: z.string(), // 所属Organization ID
  spaceId: z.string(), // 所属Space ID
  createdAt: z.instanceof(Timestamp), // Firestore作成日時
  updatedAt: z.instanceof(Timestamp), // Firestore更新日時
});

export type DocumentPersisted = z.infer<typeof DocumentPersistedSchema>;

/**
 * FileSpace Persisted Schema
 *
 * Firestoreに永続化されるFileSpace情報
 * organizationId, spaceId, createdAt, updatedAtを含む
 */
export const FileSpacePersistedSchema = z.object({
  name: z.string().nullable(), // FileSearchStore名（例: "fileSearchStores/w705zpywmey1-7rc9avfyza22"）
  displayName: z.string().nullable().optional(), // 表示名
  description: z.string().nullable().optional(), // 説明
  createTime: z.string().nullable(), // 作成日時（ISO 8601形式）
  updateTime: z.string().nullable(), // 更新日時（ISO 8601形式）
  fileSpaceType: FileSpaceTypeEnum.default("manual"), // 生成タイプ（system or manual、デフォルト: manual）
  organizationId: z.string(), // 所属Organization ID
  spaceId: z.string(), // 所属Space ID
  createdAt: z.instanceof(Timestamp), // Firestore作成日時
  updatedAt: z.instanceof(Timestamp), // Firestore更新日時
});

export type FileSpacePersisted = z.infer<typeof FileSpacePersistedSchema>;

/**
 * DecodedFileSpace Schema
 *
 * Firestoreフィールド（id）を含む完全なスキーマ
 */
export const DecodedFileSpaceSchema = FileSpacePersistedSchema.extend({
  id: z.string(), // FirestoreドキュメントID（nameから抽出したID部分）
});

export type DecodedFileSpace = z.infer<typeof DecodedFileSpaceSchema>;

/**
 * Firestore Converter for FileSpace
 */
export const fileSpaceConverter = firestoreTypeConverter(
  DecodedFileSpaceSchema
);

/**
 * FileSpaceOperationRequest Schema
 *
 * RequestDoc型定義（単一型に集約）
 * operationTypeにより、fileSpaceCreateとfileSpaceListの両方に対応
 */
export const FileSpaceOperationRequestSchema = z.object({
  // === Command: Input ===
  input: FileSpaceOperationInputSchema,

  // === Command: RequestMetadata（共通型のみ、拡張禁止） ===
  operationMetadata: RequestMetadataSchema,

  // === Query: Output ===
  output: FileSpaceOperationOutputSchema.optional(),

  // === Query: Status & Logs ===
  status: RequestStatusEnum.default("pending"),
  logs: z.array(RequestLogSchema).default([]),
  errorMessage: z.string().optional(),

  // === Query: microServicePayload（デバッグ用記録フィールド） ===
  // ⚠️ isCommand=True かつ microserviceCall型のRequestの場合は必須
  // フロントエンドでは表示のみで値にアクセスしない（any型でOK）
  microServicePayload: z
    .object({
      name: z.any().nullable(), // マイクロサービス名（例: "gemini-file-search"）
      endpoint: z.any().nullable(), // エンドポイントパス（例: "/file-search-store/create"）
      payload: z.any().nullable(), // 送信するペイロード全体
    })
    .optional(),
});

export type FileSpaceOperationRequest = z.infer<
  typeof FileSpaceOperationRequestSchema
>;

/**
 * DecodedFileSpaceOperationRequest Schema
 *
 * Firestoreフィールド（id, createdAt, updatedAt）を含む完全なスキーマ
 */
export const DecodedFileSpaceOperationRequestSchema =
  FileSpaceOperationRequestSchema.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

export type DecodedFileSpaceOperationRequest = z.infer<
  typeof DecodedFileSpaceOperationRequestSchema
>;

/**
 * Firestore Converter
 */
export const fileSpaceOperationRequestConverter = firestoreTypeConverter(
  DecodedFileSpaceOperationRequestSchema
);
