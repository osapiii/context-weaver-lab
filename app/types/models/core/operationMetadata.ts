import { z } from "zod";

/**
 * RequestedBy Schema
 * 
 * リクエスト実行者情報
 */
export const RequestedBySchema = z.object({
  userId: z.string().optional(),
  email: z.string().email(),
  role: z.number().int().min(1).max(3),
});

export type RequestedBy = z.infer<typeof RequestedBySchema>;

/**
 * RequestMetadata Schema (OperationMetadata共通型)
 * 
 * 全RequestDocで統一して使用するoperationMetadataフィールドの型定義
 * 
 * 重要原則:
 * - このスキーマは.extend()による拡張を禁止
 * - 独自フィールド（videoId, projectId等）は必ずinputセクションに配置
 * - 全RequestDocで同一の構造を使用することで、オブザーバビリティと検索性を確保
 * 
 * 参照: DOC_06_RequestDoc_RequestMetadata共通型ガイドライン.md
 */
export const RequestMetadataSchema = z.object({
  // 組織ID（マルチテナント対応）
  organizationId: z.string(),

  // Space ID（Space-scoped データ分離）
  spaceId: z.string(),

  // Firebase Logging用コレクションID
  loggingCollectionId: z.string(),

  // Firebase Logging用ドキュメントID
  loggingDocumentId: z.string(),

  // リクエスト実行者情報
  requestedBy: RequestedBySchema,

  // 操作種別フラグ
  isCommand: z.boolean(),
  isOouiCrud: z.boolean(),
  isLlmCall: z.boolean(),
  isAdminCrud: z.boolean(),
});

export type RequestMetadata = z.infer<typeof RequestMetadataSchema>;

