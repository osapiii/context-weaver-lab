import type { Timestamp } from "firebase/firestore";

export const STORYVAULT_CLIP_COMMAND_OPERATIONS = [
  "registerClips",
  "quickScan",
  "zappingAnalysis",
  "capabilityStructuring",
  "storyGeneration",
  "verifyUiAssets",
] as const;

export type StoryVaultClipCommandOperation =
  typeof STORYVAULT_CLIP_COMMAND_OPERATIONS[number];

export type StoryVaultClipCommandRequest = {
  id: string;
  input: {
    operation: StoryVaultClipCommandOperation;
    pipelineRequestId?: string;
    applicationId: string;
    clipGroupId?: string;
    clipIds?: string[];
    payload?: Record<string, unknown>;
  };
  status: "pending" | "processing" | "completed" | "partial_error" | "error";
  output?: Record<string, unknown> | null;
  errorMessage?: string;
  logs?: Array<{ message: string; type?: string; timestamp?: unknown }>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export const STORYVAULT_CLIP_COMMAND_COLLECTION =
  "requests/storyVaultClipCommandRequests/logs";
