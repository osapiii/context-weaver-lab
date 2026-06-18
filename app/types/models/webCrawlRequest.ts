import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestMetadataSchema } from "./core/operationMetadata";
import { RequestStatusEnum } from "./core/requestStatus";

/**
 * WebCrawlRequest (Workflows architecture)
 *
 * 1 RequestDoc = 1 GCP Workflows execution (`web-crawl`).
 * - Input は GCS YAML に逃がし、RequestDoc には `input.inputArtifactUri` を残す
 * - 進捗・各ステップ・output を Workflow / microservice から書き戻し
 * - UI はこの 1 doc を購読 (モーダル + フッター常駐インジケータ)
 *
 * Stored at:
 *   organizations/{orgId}/requests/webCrawlRequests/logs/{requestId}
 */

export const KNOWN_WEB_CRAWL_STEPS = [
  "loadInput",
  "crawl",
  "uploadToGcs",
  "registerToFileSpace",
  "finalize",
] as const;

export type KnownWebCrawlStep = (typeof KNOWN_WEB_CRAWL_STEPS)[number];

export const WebCrawlStepStatusEnum = z.enum([
  "pending",
  "running",
  "completed",
  "skipped",
  "error",
]);

export type WebCrawlStepStatus = z.infer<typeof WebCrawlStepStatusEnum>;

export const WebCrawlWorkflowStateEnum = z.enum([
  "ACTIVE",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "UNAVAILABLE",
]);

export type WebCrawlWorkflowState = z.infer<typeof WebCrawlWorkflowStateEnum>;

export const WebCrawlInputSchema = z.object({
  url: z.string().url(),
  bucketName: z.string(),
  folderPath: z.string(),
  maxDepth: z.number().int().min(1).max(10),
  maxUrls: z.number().int().min(1).max(10000),
  fileSpaceId: z.string(),
  description: z.string().nullable().optional(),
  includeImages: z.boolean().optional().default(true),
  /**
   * kicker が PUT する input artifact (YAML/JSON) の GCS URI。
   */
  inputArtifactUri: z.string().nullable().optional(),
});

export type WebCrawlInput = z.infer<typeof WebCrawlInputSchema>;

export const SavedFileSchema = z.object({
  filePath: z.string(),
  gcsUrl: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  metadata: z.record(z.any()).optional(),
});

export type SavedFile = z.infer<typeof SavedFileSchema>;

export const WebCrawlImageSchema = z.object({
  filename: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  alt: z.string().nullable().optional(),
  page: z.number().nullable().optional(),
  gcsPath: z.string().nullable().optional(),
  pageUrl: z.string().nullable().optional(),
  pageTitle: z.string().nullable().optional(),
  contentHash: z.string().nullable().optional(),
});

export type WebCrawlImage = z.infer<typeof WebCrawlImageSchema>;

export const WebCrawlOutputSchema = z.object({
  totalPages: z.number().nullable().optional(),
  savedFiles: z.array(SavedFileSchema).nullable().optional(),
  gcsBucketName: z.string().nullable().optional(),
  gcsPrefix: z.string().nullable().optional(),
  markdownCount: z.number().nullable().optional(),
  imageCount: z.number().nullable().optional(),
  skippedImageCount: z.number().nullable().optional(),
  images: z.array(WebCrawlImageSchema).nullable().optional(),
  filespaceRegisteredCount: z.number().nullable().optional(),
  filespaceRegisterFailed: z.number().nullable().optional(),
  filespaceImageDocCount: z.number().nullable().optional(),
});

export type WebCrawlOutput = z.infer<typeof WebCrawlOutputSchema>;

export const WebCrawlProgressSchema = z.object({
  currentStep: z.string().nullable().optional(),
  totalPages: z.number().int().nonnegative().optional().default(0),
  processedPages: z.number().int().nonnegative().optional().default(0),
  totalImages: z.number().int().nonnegative().optional().default(0),
  processedImages: z.number().int().nonnegative().optional().default(0),
});

export type WebCrawlProgress = z.infer<typeof WebCrawlProgressSchema>;

export const WebCrawlLogEntrySchema = z.object({
  at: z.string(),
  level: z.enum(["info", "warn", "error"]).default("info"),
  message: z.string(),
  stepId: z.string().optional(),
});

export type WebCrawlLogEntry = z.infer<typeof WebCrawlLogEntrySchema>;

export const WebCrawlStepLogsSchema = z
  .record(
    z.union([
      z.array(WebCrawlLogEntrySchema),
      z.string(),
    ])
  )
  .nullable()
  .optional();

export type WebCrawlStepLogs = z.infer<typeof WebCrawlStepLogsSchema>;

export const WebCrawlStepSchema = z.object({
  id: z.string(),
  label: z.string().nullable().optional(),
  status: WebCrawlStepStatusEnum,
  startedAt: z.any().nullable().optional(),
  endedAt: z.any().nullable().optional(),
  attempts: z.number().int().nonnegative().optional().default(0),
  error: z.string().nullable().optional(),
  detail: z
    .union([z.record(z.any()), z.string()])
    .nullable()
    .optional(),
});

export type WebCrawlStep = z.infer<typeof WebCrawlStepSchema>;

export const WebCrawlStepsByIdSchema = z
  .record(WebCrawlStepSchema)
  .nullable()
  .optional();

export type WebCrawlStepsById = z.infer<typeof WebCrawlStepsByIdSchema>;

export const WebCrawlWorkflowMetaSchema = z.object({
  executionName: z.string().nullable().optional(),
  executionId: z.string().nullable().optional(),
  consoleUrl: z.string().nullable().optional(),
  state: WebCrawlWorkflowStateEnum.nullable().optional(),
  startedAt: z.any().nullable().optional(),
  endedAt: z.any().nullable().optional(),
});

export type WebCrawlWorkflowMeta = z.infer<typeof WebCrawlWorkflowMetaSchema>;

export const WebCrawlUiFlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().default("jobFlow"),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    kind: z.string(),
    label: z.string(),
    stepId: z.string().optional(),
  }),
});

export const WebCrawlUiFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  dashed: z.boolean().optional(),
});

export const WebCrawlUiFlowSchema = z.object({
  version: z.literal(1),
  nodes: z.array(WebCrawlUiFlowNodeSchema),
  edges: z.array(WebCrawlUiFlowEdgeSchema),
});

export type WebCrawlUiFlow = z.infer<typeof WebCrawlUiFlowSchema>;

export const WebCrawlImportFolderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

export type WebCrawlImportFolder = z.infer<
  typeof WebCrawlImportFolderSchema
>;

export const WebCrawlUiMetadataSchema = z.object({
  importFolder: WebCrawlImportFolderSchema.nullable().optional(),
});

/**
 * RequestDoc黄金テンプレート準拠 + Workflow writeback フィールド
 */
export const WebCrawlRequestSchema = z.object({
  input: WebCrawlInputSchema,
  operationMetadata: RequestMetadataSchema,
  output: WebCrawlOutputSchema.nullable().optional(),
  status: RequestStatusEnum.default("pending"),
  errorMessage: z.string().nullable().optional(),
  workflow: WebCrawlWorkflowMetaSchema.nullable().optional(),
  progress: WebCrawlProgressSchema.nullable().optional(),
  steps: WebCrawlStepsByIdSchema,
  uiFlow: WebCrawlUiFlowSchema.nullable().optional(),
  uiMetadata: WebCrawlUiMetadataSchema.nullable().optional(),
  stepLogs: WebCrawlStepLogsSchema,
});

export type WebCrawlRequest = z.infer<typeof WebCrawlRequestSchema>;

export const DecodedWebCrawlRequestSchema = WebCrawlRequestSchema.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});

export type DecodedWebCrawlRequest = z.infer<
  typeof DecodedWebCrawlRequestSchema
>;

export const webCrawlRequestConverter = firestoreTypeConverter(
  DecodedWebCrawlRequestSchema
);
