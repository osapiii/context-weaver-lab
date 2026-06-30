import { z } from "zod";
import { Timestamp } from "firebase/firestore";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

/**
 * Document SubCategory Enum
 *
 * Documentのサブカテゴリ定義
 */
export const DocumentSubCategoryEnum = z.enum([
  "fileUpload",
  "entryUrl",
  "urlMarkdown",
]);

export type DocumentSubCategory = z.infer<typeof DocumentSubCategoryEnum>;

/**
 * Document Schema
 *
 * FileSpaceDocumentListのoutputから取得されるDocument情報
 * Firestoreから取得したDocumentの全フィールドを含む
 */
export const DocumentSchema = z.object({
  name: z.string().nullable(), // Document名（例: "fileSearchStores/abc123/documents/doc1"）
  displayName: z.string().nullable().optional(), // 表示名
  description: z.string().nullable().optional(), // 説明
  createTime: z.string().nullable(), // 作成日時（ISO 8601形式）
  updateTime: z.string().nullable(), // 更新日時（ISO 8601形式）
  state: z.string().nullable().optional(), // STATE_ACTIVE等
  sizeBytes: z.string().nullable().optional(), // サイズ（文字列形式）
  mimeType: z.string().nullable().optional(), // MIMEタイプ
  bucketName: z.string().nullable().optional(), // GCSバケット名（fileSpaceUpload時に保存）
  filePath: z.string().nullable().optional(), // GCSファイルパス（fileSpaceUpload時に保存）
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
  driveFileId: z.string().nullable().optional(), // Drive 上のファイル ID
  driveFolderId: z.string().nullable().optional(),
  driveModifiedTime: z.string().nullable().optional(),
  driveWebViewLink: z.string().nullable().optional(), // Drive で開くリンク
  thumbnailLink: z.string().nullable().optional(), // Drive 提供のサムネイル URL
  // Phase R-1c: Web クローラ (GCS 直書き) 由来の Document に付くフィールド
  webCrawlRequestId: z.string().nullable().optional(), // 元 WebCrawlRequest doc ID (グルーピング用)
  gcsPrefix: z.string().nullable().optional(), // GCS prefix (同 crawl session の素材を集約するキー)
  sourceUrl: z.string().nullable().optional(), // urlMarkdown: 元 Web ページの URL / 画像: 元 Web の画像 URL
  // 画像 Document 専用 (Phase R-1d, 2026-05-20):
  // 「この画像はどのページに載っていたか」を保持。マスタ自動生成などの参考用。
  sourcePageUrl: z.string().nullable().optional(),
  sourcePageTitle: z.string().nullable().optional(),
  // 画像 bytes の sha256. cross-session dedup, master 生成での同一画像判定に使う.
  contentHash: z.string().nullable().optional(),
  // Phase R-1e (2026-05-20): OGP / Twitter Card メタタグ. urlMarkdown doc 専用.
  // og:image があれば優先サムネ、無ければページで最初に取れた画像を fallback として
  // thumbnailGcsPath に入れる. UI はこれを使って page list view にサムネ表示する.
  ogImage: z.string().nullable().optional(),
  ogTitle: z.string().nullable().optional(),
  ogDescription: z.string().nullable().optional(),
  // ページサムネの GCS 内パス (bucket は thumbnailBucket).
  // og:image > fallback (ページ最初の画像) の順で 1 枚を選ぶ.
  thumbnailGcsPath: z.string().nullable().optional(),
  thumbnailBucket: z.string().nullable().optional(),
  // Phase R-1d / Knowledge consolidation (2026-05-20):
  // 「この素材は今どこまで処理されたか」を明示的に持つ optional field.
  // 既存 doc は undefined のままで判定 helper (isKnowledgeIndexed) が
  // name の prefix にフォールバックする. 新規 doc から書き始める.
  registration: z
    .object({
      stage: z.enum(["placeholder", "uploading", "indexed", "failed"]),
      gcsUploaded: z.boolean(),
      geminiRegistered: z.boolean(),
      lastError: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  // Agent Search 移行後: Discovery Engine 上の document ID (削除 API 用)
  agentSearchDocumentId: z.string().nullable().optional(),
  indexBackend: z.enum(["agent_search", "gemini_file_search"]).optional(),
  // EN AIstudio マスタ / 実績 CSV SSOT 由来 (export ジョブ + Discovery 登録)
  sourceKind: z.enum(["en-aistudioData", "drive", "upload", "web"]).optional(),
  enAiStudioDataKind: z.literal("en-aistudioData").optional(),
  enAiStudioDataset: z.string().nullable().optional(),
  workspaceId: z.string().nullable().optional(),
  exportedAt: z.string().nullable().optional(),
  uploadedVia: z.string().nullable().optional(),
  externalAgent: z.string().nullable().optional(),
  mcpConnectionId: z.string().nullable().optional(),
  applicationId: z.string().nullable().optional(),
  storyId: z.string().nullable().optional(),
  operationVideoId: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  sourceNote: z.string().nullable().optional(),
  // Firestore docID をフロント経由でも参照できるよう保持
  // (Document.name の末尾は Gemini ID、Firestore docID は別物のため、削除等で別途必要)
  id: z.string().optional(),
  // DocumentPersisted固有のフィールド
  storeId: z.string().optional(), // FileSearchStoreのID
  organizationId: z.string().optional(), // 所属Organization ID
  spaceId: z.string().optional(), // 所属Space ID
  createdAt: z.instanceof(Timestamp).optional(), // Firestore作成日時
  updatedAt: z.instanceof(Timestamp).optional(), // Firestore更新日時
});

export type Document = z.infer<typeof DocumentSchema>;

/**
 * DecodedDocument Schema
 *
 * Firestoreフィールド（id）を含む完全なスキーマ
 */
export const DecodedDocumentSchema = DocumentSchema.extend({
  id: z.string(), // FirestoreドキュメントID（nameから抽出したID部分）
});

export type DecodedDocument = z.infer<typeof DecodedDocumentSchema>;

/**
 * Firestore Converter for Document
 */
export const documentConverter = firestoreTypeConverter(DecodedDocumentSchema);

/**
 * Knowledge — EN AIstudio が扱う「素材」概念の正式名 (Phase R-1d 命名整理).
 *
 * Document は Gemini API の Document object と命名が衝突するため、EN AIstudio 側の
 * 素材を指すコードでは Knowledge 型を使う方針. schema 本体は DocumentSchema を
 * そのまま流用 (alias). 既存 import { Document } はそのまま動き続ける.
 *
 * 例:
 *   import type { Knowledge } from "@models/document";
 *   const k: Knowledge = await getKnowledge(id);
 */
export type Knowledge = Document;
export type DecodedKnowledge = DecodedDocument;
export const KnowledgeSchema = DocumentSchema;
export const DecodedKnowledgeSchema = DecodedDocumentSchema;
export const knowledgeConverter = documentConverter;
