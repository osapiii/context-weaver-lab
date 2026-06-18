import type { AttachedFile } from "@adapters/masterEditor/types";
import type { AdkInvokeInput } from "@models/adkInvokeRequest";
import type { AdkAgentMode } from "@composables/useAgentSseClient";
import type { AgentSseHistoryTurn } from "@composables/useAgentSseClient";
import type { LlmModelSelection } from "@models/llmModelSelection";
import type { SelectedKnowledgeRef } from "@utils/consultationKnowledge";
import { toApiSelectedKnowledge } from "@utils/consultationKnowledge";
import { resolveStorageBucketName } from "@utils/adkAttachments";

const toGsPath = (path: string): string => {
  const trimmed = path.trim();
  if (trimmed.startsWith("gs://")) return trimmed;
  const bucket = resolveStorageBucketName();
  return `gs://${bucket}/${trimmed.replace(/^\/+/, "")}`;
};

export const buildAdkInvokeAttachments = (
  files: AttachedFile[]
): AdkInvokeInput["attachments"] =>
  files
    .filter((f) => !f.localFile && (f.gcsPath?.trim() || false))
    .map((f, index) => ({
      id: `att_${index}_${f.fileName}`.slice(0, 80),
      name: f.fileName,
      gcsPath: toGsPath(f.gcsPath),
      mimeType: f.mimeType || "application/octet-stream",
      size: 0,
    }));

export const buildAdkInvokeInput = (params: {
  mode: AdkAgentMode;
  sessionId: string;
  organizationId: string;
  spaceId: string;
  userId: string;
  prompt: string;
  responseId: string;
  model?: LlmModelSelection | null;
  fileSpaceId?: string | null;
  workspaceId?: string | null;
  history: AgentSseHistoryTurn[];
  modeState: Record<string, unknown>;
  systemPrompt?: string | null;
  attachments?: AttachedFile[];
  selectedKnowledge?: SelectedKnowledgeRef[];
  referenceImages?: AdkInvokeInput["referenceImages"];
  notificationEmail?: string | null;
}): AdkInvokeInput => ({
  mode: params.mode,
  sessionId: params.sessionId,
  organizationId: params.organizationId,
  spaceId: params.spaceId,
  userId: params.userId,
  prompt: params.prompt,
  responseId: params.responseId,
  model: params.model ?? undefined,
  fileSpaceId: params.fileSpaceId ?? null,
  workspaceId: params.workspaceId ?? null,
  history: params.history.map((h) => ({
    role: h.role,
    text: h.text,
  })),
  modeState: params.modeState,
  systemPrompt: params.systemPrompt?.trim() || null,
  attachments: buildAdkInvokeAttachments(params.attachments ?? []),
  selectedKnowledge: toApiSelectedKnowledge(params.selectedKnowledge ?? []),
  referenceImages: params.referenceImages ?? [],
  notificationEmail: params.notificationEmail?.trim() || undefined,
});
