import type { Timestamp } from "firebase/firestore";

export const STORYVAULT_CLIP_PIPELINE_STEPS = [
  "upload",
  "trimSilence",
  "transcribe",
  "section",
  "split",
  "registerClips",
  "quickScan",
  "zappingAnalysis",
  "capabilityStructuring",
  "storyGeneration",
  "verifyUiAssets",
  "notification",
] as const;

export type StoryVaultClipPipelineStepId = typeof STORYVAULT_CLIP_PIPELINE_STEPS[number];
export type StoryVaultClipPipelineStatus =
  | "pending"
  | "processing"
  | "completed"
  | "partial_error"
  | "error";

export type StoryVaultClipPipelineStepState = {
  status?: string;
  progress?: number;
  startedAt?: Timestamp | Date | string | null;
  endedAt?: Timestamp | Date | string | null;
  completedAt?: Timestamp | Date | string | null;
  requestDocId?: string;
  emailRequestId?: string;
  message?: string;
  retryCount?: number;
  errorMessage?: string;
  output?: Record<string, unknown>;
};

export type StoryVaultClipPipelineClipState = {
  clipId: string;
  title?: string;
  status?: string;
  quickScanStatus?: string;
  zappingStatus?: string;
  storyCandidateCount?: number;
  failedStep?: string;
  errorMessage?: string;
};

export type StoryVaultClipPipelineEvent = {
  id: string;
  level?: "debug" | "info" | "warning" | "error";
  message: string;
  step?: string;
  clipId?: string;
  requestDocId?: string;
  retryCount?: number;
  createdAt?: Timestamp | Date | string | null;
};

export type StoryVaultClipPipelineRequest = {
  id: string;
  title?: string;
  applicationId?: string;
  applicationName?: string;
  clipGroupId?: string;
  clipGroupName?: string;
  status: StoryVaultClipPipelineStatus;
  currentStep?: StoryVaultClipPipelineStepId;
  progress?: number;
  input?: {
    sourceDraftId?: string;
    sourceGcsUri?: string;
    sourceContentType?: string;
    durationMs?: number;
    notificationEmail?: string;
  };
  steps?: Partial<Record<StoryVaultClipPipelineStepId, StoryVaultClipPipelineStepState>>;
  clips?: StoryVaultClipPipelineClipState[];
  counters?: {
    total?: number;
    completed?: number;
    processing?: number;
    failed?: number;
  };
  notification?: { status?: string; requestId?: string; emailRequestId?: string; message?: string; errorMessage?: string };
  workflow?: { executionName?: string; consoleUrl?: string; state?: string };
  latestLogs?: StoryVaultClipPipelineEvent[];
  createdAt?: Timestamp | Date | string | null;
  updatedAt?: Timestamp | Date | string | null;
  completedAt?: Timestamp | Date | string | null;
};

export const STORYVAULT_CLIP_PIPELINE_COLLECTION =
  "requests/storyVaultClipPipelineRequests/logs";
