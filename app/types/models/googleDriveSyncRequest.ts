import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestMetadataSchema } from "./core/operationMetadata";
import { RequestStatusEnum } from "./core/requestStatus";

/**
 * GoogleDriveSyncRequest (Workflows architecture)
 *
 * 1 RequestDoc = 1 GCP Workflows execution.
 * - Input は GCS YAML に逃がし、RequestDoc には `inputArtifactUri` だけ残す
 * - 進捗・各ステップ・成果物 (mirror / register) を Workflow から書き戻し
 * - UI はこの 1 doc を購読して Mirror / Register の 2 ステージを表示
 *
 * Stored at:
 *   organizations/{orgId}/spaces/{spaceId}/requests/googleDriveSyncRequests/logs/{requestId}
 */

export const GoogleDriveSyncOperationTypeEnum = z.enum([
  /** root 配下を再帰的に走査する手動取り込み (UI から発行) */
  "syncFolder",
  /** Web クロール完了直後にサブフォルダだけ同期する (backend から発行) */
  "syncSingleFolder",
]);
export type GoogleDriveSyncOperationType = z.infer<
  typeof GoogleDriveSyncOperationTypeEnum
>;

/**
 * Workflow が踏むステップ。`steps[].id` と完全一致。
 * 並列 branch は同じ rank の id を持つ (Workflow YAML 側で定義)。
 */
export const KNOWN_GOOGLE_DRIVE_SYNC_STEPS = [
  "loadInput",
  "listDriveFolder",
  "diffWithMirror",
  "mirrorAdd",
  "mirrorRemove",
  "diffWithFileSpace",
  "registerAdd",
  "registerRemove",
  "finalize",
] as const;
export type KnownGoogleDriveSyncStep =
  (typeof KNOWN_GOOGLE_DRIVE_SYNC_STEPS)[number];

/** `steps[]` の各ステータス */
export const GoogleDriveSyncStepStatusEnum = z.enum([
  "pending",
  "running",
  "completed",
  "skipped",
  "error",
]);
export type GoogleDriveSyncStepStatus = z.infer<
  typeof GoogleDriveSyncStepStatusEnum
>;

/** `progress.currentStage` */
export const GoogleDriveSyncStageEnum = z.enum(["mirror", "register"]);
export type GoogleDriveSyncStage = z.infer<typeof GoogleDriveSyncStageEnum>;

/** Workflow execution の生 state (GCP Workflows.executions.state) */
export const GoogleDriveSyncWorkflowStateEnum = z.enum([
  "ACTIVE",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "UNAVAILABLE",
]);
export type GoogleDriveSyncWorkflowState = z.infer<
  typeof GoogleDriveSyncWorkflowStateEnum
>;

export const GoogleDriveSyncInputSchema = z.object({
  operationType: GoogleDriveSyncOperationTypeEnum,
  rootFolderId: z.string(),
  /** syncSingleFolder の場合: 同期したいサブフォルダ (root の子孫). syncFolder の場合は null */
  targetFolderId: z.string().nullable().optional(),
  /** 同期先 FileSpace (= default FileSpace の Gemini storeId) */
  fileSpaceId: z.string(),
  /** UI 表示用の自由文 */
  description: z.string().nullable().optional(),
  /**
   * Workflow が読み込む input artifact (YAML) の GCS URI.
   * kicker microservice が PUT してから RequestDoc に patch する。
   * 未 patch のうち (RequestDoc 作成直後 / kicker 失敗) は null。
   */
  inputArtifactUri: z.string().nullable().optional(),
  /** importIds の件数 (詳細は inputArtifactUri YAML 内) */
  importCount: z.number().int().nonnegative().optional().default(0),
  /** removeIds の件数 (詳細は inputArtifactUri YAML 内) */
  removeCount: z.number().int().nonnegative().optional().default(0),
});

export type GoogleDriveSyncInput = z.infer<typeof GoogleDriveSyncInputSchema>;

/**
 * kicker microservice が GCS YAML 化するまで RequestDoc に一時保持する payload。
 * trigger が読み取ったあと kicker が `_kickerPayload` を DELETE する。
 */
export const GoogleDriveSyncKickerPayloadSchema = z.object({
  importIds: z.array(z.string()).default([]),
  removeIds: z.array(z.string()).default([]),
});

export type GoogleDriveSyncKickerPayload = z.infer<
  typeof GoogleDriveSyncKickerPayloadSchema
>;

/** Workflow / Firestore が空文字を書くケースを null に正規化 */
function emptyStringToNull(value: unknown): unknown {
  if (value === "") return null;
  return value;
}

export const GoogleDriveSyncProgressSchema = z.object({
  currentStep: z.preprocess(
    emptyStringToNull,
    z.string().nullable().optional()
  ),
  currentStage: z.preprocess(
    emptyStringToNull,
    GoogleDriveSyncStageEnum.nullable().optional()
  ),
  totalFiles: z.number().int().nonnegative().default(0),
  processedFiles: z.number().int().nonnegative().default(0),
  totalBatches: z.number().int().nonnegative().default(0),
  completedBatches: z.number().int().nonnegative().default(0),
  failedBatches: z.number().int().nonnegative().default(0),
});

export type GoogleDriveSyncProgress = z.infer<
  typeof GoogleDriveSyncProgressSchema
>;

/** ファイル行 UI / Workflow writeback 用の段階ステータス */
export const GoogleDriveSyncFileStageStatusEnum = z.enum([
  "pending",
  "running",
  "completed",
  "error",
  "skipped",
]);
export type GoogleDriveSyncFileStageStatus = z.infer<
  typeof GoogleDriveSyncFileStageStatusEnum
>;

/** RequestDoc.fileItems.{driveFileId} — 1 行 = 1 ファイルの進捗 */
export const GoogleDriveSyncFileItemSchema = z.object({
  driveFileId: z.string(),
  kind: z.enum(["import", "remove"]),
  displayName: z.string().nullable().optional(),
  prepare: GoogleDriveSyncFileStageStatusEnum.default("pending"),
  mirror: GoogleDriveSyncFileStageStatusEnum.default("pending"),
  register: GoogleDriveSyncFileStageStatusEnum.default("pending"),
  complete: GoogleDriveSyncFileStageStatusEnum.default("pending"),
  errorMessage: z.string().nullable().optional(),
});

export type GoogleDriveSyncFileItem = z.infer<
  typeof GoogleDriveSyncFileItemSchema
>;

export const GoogleDriveSyncFileItemsByIdSchema = z
  .record(GoogleDriveSyncFileItemSchema)
  .nullable()
  .optional();

export type GoogleDriveSyncFileItemsById = z.infer<
  typeof GoogleDriveSyncFileItemsByIdSchema
>;

/** Workflow が stepLogs.{stepId} に書き込む 1 行分のログ */
export const GoogleDriveSyncLogEntrySchema = z.object({
  at: z.string(),
  level: z.enum(["info", "warn", "error"]).default("info"),
  message: z.string(),
  stepId: z.string().optional(),
});

export type GoogleDriveSyncLogEntry = z.infer<
  typeof GoogleDriveSyncLogEntrySchema
>;

export const GoogleDriveSyncStepLogsSchema = z
  .record(
    z.union([
      z.array(GoogleDriveSyncLogEntrySchema),
      /** Workflow が json.encode_to_string した配列 */
      z.string(),
    ])
  )
  .nullable()
  .optional();

export type GoogleDriveSyncStepLogs = z.infer<
  typeof GoogleDriveSyncStepLogsSchema
>;

/** FE 作成時に seed する Vue Flow レイアウト (status は steps からマージ) */
export const GoogleDriveSyncUiFlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().default("jobFlow"),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    kind: z.string(),
    label: z.string(),
    stepId: z.string().optional(),
    stage: GoogleDriveSyncStageEnum.nullable().optional(),
  }),
});

export const GoogleDriveSyncUiFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  dashed: z.boolean().optional(),
});

export const GoogleDriveSyncUiFlowSchema = z.object({
  version: z.literal(1),
  nodes: z.array(GoogleDriveSyncUiFlowNodeSchema),
  edges: z.array(GoogleDriveSyncUiFlowEdgeSchema),
});

export type GoogleDriveSyncUiFlow = z.infer<typeof GoogleDriveSyncUiFlowSchema>;

/**
 * Workflow が書き戻す step の中身。
 * `detail` は Workflow YAML 上で JSON 文字列化されて Firestore stringValue として
 * 入っているケースがあるため、Record でも String でも受け取れるようにしておく。
 * FE 側 (`normalizeStepDetail`) で常に Record に正規化する。
 */
export const GoogleDriveSyncStepSchema = z.object({
  id: z.string(),
  label: z.string().nullable().optional(),
  status: GoogleDriveSyncStepStatusEnum,
  stage: GoogleDriveSyncStageEnum.nullable().optional(),
  startedAt: z.any().nullable().optional(),
  endedAt: z.any().nullable().optional(),
  attempts: z.number().int().nonnegative().optional().default(0),
  error: z.string().nullable().optional(),
  detail: z
    .union([z.record(z.any()), z.string()])
    .nullable()
    .optional(),
});

export type GoogleDriveSyncStep = z.infer<typeof GoogleDriveSyncStepSchema>;

export const GoogleDriveSyncMirrorSummarySchema = z.object({
  /** gs://{bucket}/{orgId}/{spaceId}/{fileSpaceId}/  (UI から GCS ブラウザを開くため) */
  gcsPrefixUri: z.string().nullable().optional(),
  addedCount: z.number().int().nonnegative().optional().default(0),
  updatedCount: z.number().int().nonnegative().optional().default(0),
  removedCount: z.number().int().nonnegative().optional().default(0),
  skippedCount: z.number().int().nonnegative().optional().default(0),
  failedCount: z.number().int().nonnegative().optional().default(0),
});

export type GoogleDriveSyncMirrorSummary = z.infer<
  typeof GoogleDriveSyncMirrorSummarySchema
>;

export const GoogleDriveSyncRegisterSummarySchema = z.object({
  addedCount: z.number().int().nonnegative().optional().default(0),
  updatedCount: z.number().int().nonnegative().optional().default(0),
  removedCount: z.number().int().nonnegative().optional().default(0),
  failedCount: z.number().int().nonnegative().optional().default(0),
  /** 失敗した driveFileId と理由 (デバッグ用) */
  failedItems: z
    .array(
      z.object({
        driveFileId: z.string().nullable().optional(),
        reason: z.string().nullable().optional(),
      })
    )
    .optional()
    .default([]),
});

export type GoogleDriveSyncRegisterSummary = z.infer<
  typeof GoogleDriveSyncRegisterSummarySchema
>;

export const GoogleDriveSyncWorkflowMetaSchema = z.object({
  /** projects/.../locations/.../workflows/gdrive-sync/executions/{id} (Workflows API name) */
  executionName: z.string().nullable().optional(),
  /** 末尾の execution id 部分のみ */
  executionId: z.string().nullable().optional(),
  /** GCP Console で開ける URL */
  consoleUrl: z.string().nullable().optional(),
  state: GoogleDriveSyncWorkflowStateEnum.nullable().optional(),
  startedAt: z.any().nullable().optional(),
  endedAt: z.any().nullable().optional(),
});

export type GoogleDriveSyncWorkflowMeta = z.infer<
  typeof GoogleDriveSyncWorkflowMetaSchema
>;

/**
 * Workflow が書き戻す `steps` のサーバ側表現:
 *   Firestore 上は `{ [stepId]: { id, status, ... } }` の map で保持する
 *   (Workflow YAML から map.put() で動的キーに更新するため)。
 * FE では `projectRequestToSession()` でこの map と `KNOWN_GOOGLE_DRIVE_SYNC_STEPS`
 * を突き合わせて固定順の配列に並べ替える。
 */
export const GoogleDriveSyncStepsByIdSchema = z
  .record(GoogleDriveSyncStepSchema)
  .nullable()
  .optional();

export type GoogleDriveSyncStepsById = z.infer<
  typeof GoogleDriveSyncStepsByIdSchema
>;

export const GoogleDriveSyncRequestSchema = z.object({
  input: GoogleDriveSyncInputSchema,
  operationMetadata: RequestMetadataSchema,
  status: RequestStatusEnum.default("pending"),
  errorMessage: z.string().nullable().optional(),
  workflow: GoogleDriveSyncWorkflowMetaSchema.nullable().optional(),
  progress: GoogleDriveSyncProgressSchema.nullable().optional(),
  /**
   * Firestore-native 形式 (Workflow が直接 PATCH する).
   * UI 側は `projectRequestToSession()` で配列化する。
   */
  steps: GoogleDriveSyncStepsByIdSchema,
  /** FE 作成時に seed する Vue Flow レイアウト雛形 */
  uiFlow: GoogleDriveSyncUiFlowSchema.nullable().optional(),
  /** Workflow が各 step で追記する実行ログ */
  stepLogs: GoogleDriveSyncStepLogsSchema,
  /** 1 行 = 1 ファイルの進捗 (Workflow が PATCH) */
  fileItems: GoogleDriveSyncFileItemsByIdSchema,
  mirror: GoogleDriveSyncMirrorSummarySchema.nullable().optional(),
  register: GoogleDriveSyncRegisterSummarySchema.nullable().optional(),
  /** @see GoogleDriveSyncKickerPayloadSchema — kicker が処理後に削除 */
  _kickerPayload: GoogleDriveSyncKickerPayloadSchema.optional(),
});

export const DecodedGoogleDriveSyncRequestSchema =
  GoogleDriveSyncRequestSchema.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

export type DecodedGoogleDriveSyncRequest = z.infer<
  typeof DecodedGoogleDriveSyncRequestSchema
>;

export const googleDriveSyncRequestConverter = firestoreTypeConverter(
  DecodedGoogleDriveSyncRequestSchema
);

export {
  buildDriveMirrorPrefix,
  driveMirrorListPrefix,
  driveSyncMirrorListPrefix,
  manualUploadRelativePath,
  manualUploadGcsPath,
  driveSyncWorkflowInputGcsPath,
  gcsBrowserUrlFromGsUri,
} from "~/utils/knowledgeStoragePaths";
