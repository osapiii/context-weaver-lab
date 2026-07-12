/** ADK session.state ゴールデンエンベロープ + タスクバケット (v1). */

import type { AiStudioMessage } from "@stores/aiStudio";

export type EnAiStudioActiveTask =
  | "image"
  | "writing"
  | "consultation"
  | "research"
  | "data_analysis"
  | "web_page"
  | "application_scan"
  | "business_partner"
  | "storyvault_related_context"
  | "storyvault_zapping_analysis"
  | "storyvault_capability_structuring"
  | "storyvault_story_generation"
  | "guide"
  | "sheet";

export type TaskInvokeStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "error";

export interface TaskInvokeLogEntry {
  ts: number;
  message: string;
  type: "info" | "error";
}

export interface TaskInvokeState {
  status: TaskInvokeStatus;
  request_id?: string;
  linked_response_id?: string;
  logs: TaskInvokeLogEntry[];
  error_message?: string;
}

export interface SessionMeta {
  title: string;
  status: "active" | "archived" | "deleted";
}

export interface StateContextAsset {
  role: string;
  gcs_path?: string;
  storage_url?: string;
  name?: string;
  mime_type?: string;
}

export interface TaskBucketBase<TSetup, TPayload, TArtifact> {
  phase: string;
  setup: TSetup & { confirmed: boolean };
  payload: TPayload;
  artifact?: TArtifact | null;
  invoke: TaskInvokeState;
}

export type ImageTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
> & {
  primary?: Record<string, unknown> | null;
  retouch_regions?: unknown[];
};

export type WritingTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type ResearchTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type DataAnalysisTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type WebPageTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type ApplicationScanTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type BusinessPartnerTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type StoryVaultRelatedContextTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type StoryVaultCapabilityStructuringTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type StoryVaultZappingAnalysisTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type StoryVaultStoryGenerationTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type GuideTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export type ConsultationTaskBucket = TaskBucketBase<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown
>;

export interface EnAiStudioSessionState {
  active_task?: EnAiStudioActiveTask;
  session_meta?: SessionMeta;
  transcript?: TranscriptMessage[];
  context_assets?: StateContextAsset[];
  turn_context_assets?: StateContextAsset[];
  grounding_by_response_id?: Record<string, unknown>;
  image?: ImageTaskBucket;
  writing?: WritingTaskBucket;
  consultation?: ConsultationTaskBucket;
  research?: ResearchTaskBucket;
  data_analysis?: DataAnalysisTaskBucket;
  web_page?: WebPageTaskBucket;
  application_scan?: ApplicationScanTaskBucket;
  business_partner?: BusinessPartnerTaskBucket;
  storyvault_related_context?: StoryVaultRelatedContextTaskBucket;
  storyvault_zapping_analysis?: StoryVaultZappingAnalysisTaskBucket;
  storyvault_capability_structuring?: StoryVaultCapabilityStructuringTaskBucket;
  storyvault_story_generation?: StoryVaultStoryGenerationTaskBucket;
  guide?: GuideTaskBucket;
}

/** FE 表示用 transcript 行 — AiStudioMessage と互換 */
export type TranscriptMessage = AiStudioMessage;

export const emptyTaskInvokeState = (): TaskInvokeState => ({
  status: "idle",
  logs: [],
});

const EN_AISTUDIO_ACTIVE_TASKS = new Set<EnAiStudioActiveTask>([
  "image",
  "writing",
  "consultation",
  "research",
  "data_analysis",
  "web_page",
  "application_scan",
  "business_partner",
  "storyvault_related_context",
  "storyvault_zapping_analysis",
  "storyvault_capability_structuring",
  "storyvault_story_generation",
  "guide",
  "sheet",
]);

export const isEnAiStudioActiveTask = (value: unknown): value is EnAiStudioActiveTask =>
  typeof value === "string" &&
  EN_AISTUDIO_ACTIVE_TASKS.has(value as EnAiStudioActiveTask);
