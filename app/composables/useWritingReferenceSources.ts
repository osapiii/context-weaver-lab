import { ref } from "vue";
import { useAgentAttachments } from "@composables/agentAttachments/useAgentAttachments";
import type { SelectedKnowledgeRef } from "@utils/consultationKnowledge";
import type {
  WritingReferenceAttachment,
  WritingReferenceSource,
  WritingReferenceState,
} from "@models/writingForm";
import {
  extractClipboardAttachmentFiles,
  readClipboardImageFiles,
} from "@utils/clipboardImages";
import {
  MAX_WRITING_REFERENCES,
  coalesceWritingReferenceState,
  recomputeWritingReferenceState,
} from "@utils/writingWorkspaceState";

const knowledgeToWritingReference = (
  item: SelectedKnowledgeRef
): WritingReferenceAttachment => ({
  id: item.id,
  source: "knowledge",
  name: item.name,
  mimeType: item.mimeType || "application/octet-stream",
  gcsPath: item.gcsPath,
  knowledgeDocId: item.id,
});

export const useWritingReferenceSources = (params: {
  getState: () => WritingReferenceState;
  setState: (state: WritingReferenceState) => void;
}) => {
  const { getState, setState } = params;
  const attachmentsApi = useAgentAttachments({ maxBytes: 25 * 1024 * 1024 });
  const isUploading = ref(false);

  const readState = (): WritingReferenceState =>
    coalesceWritingReferenceState(getState());

  const mergeAttachments = (incoming: WritingReferenceAttachment[]): void => {
    const current = readState();
    const byId = new Map(current.attachments.map((r) => [r.id, r]));
    for (const ref of incoming) {
      if (byId.size >= MAX_WRITING_REFERENCES) break;
      byId.set(ref.id, ref);
    }
    const attachments = Array.from(byId.values()).slice(0, MAX_WRITING_REFERENCES);
    const next =
      current.status === "complete"
        ? recomputeWritingReferenceState({
            attachments,
            selectedKnowledge: current.selectedKnowledge,
            forceStatus: "complete",
          })
        : recomputeWritingReferenceState({
            attachments,
            selectedKnowledge: current.selectedKnowledge,
          });
    setState(next);
  };

  const addFromKnowledge = (items: SelectedKnowledgeRef[]): void => {
    const refs = items.map(knowledgeToWritingReference);
    if (refs.length === 0) return;
    mergeAttachments(refs);
  };

  const addFromUploadFiles = async (
    files: File[],
    options?: { source?: WritingReferenceSource }
  ): Promise<void> => {
    const source = options?.source ?? "upload";
    isUploading.value = true;
    try {
      const refs: WritingReferenceAttachment[] = [];
      for (const file of files) {
        if (readState().attachments.length + refs.length >= MAX_WRITING_REFERENCES) {
          break;
        }
        const uploaded = await attachmentsApi.upload(file);
        refs.push({
          id: uploaded.id,
          source,
          name: uploaded.name,
          mimeType: uploaded.mimeType,
          storageUrl: uploaded.url,
          gcsPath: uploaded.gcsPath,
        });
      }
      if (refs.length > 0) mergeAttachments(refs);
    } finally {
      isUploading.value = false;
    }
  };

  const addFromClipboardEvent = async (event: ClipboardEvent): Promise<boolean> => {
    const files = extractClipboardAttachmentFiles(event);
    if (files.length === 0) return false;
    await addFromUploadFiles(files, { source: "clipboard" });
    return true;
  };

  const addFromClipboardRead = async (): Promise<boolean> => {
    const files = await readClipboardImageFiles();
    if (files.length === 0) return false;
    await addFromUploadFiles(files, { source: "clipboard" });
    return true;
  };

  const removeReference = (id: string): void => {
    const current = readState();
    const attachments = current.attachments.filter((r) => r.id !== id);
    if (attachments.length === 0 && current.selectedKnowledge.length === 0) {
      setState(recomputeWritingReferenceState({ attachments: [], selectedKnowledge: [] }));
      return;
    }
    if (current.status === "complete") {
      setState(
        recomputeWritingReferenceState({
          attachments,
          selectedKnowledge: current.selectedKnowledge,
          forceStatus: "draft",
        })
      );
      return;
    }
    setState(
      recomputeWritingReferenceState({
        attachments,
        selectedKnowledge: current.selectedKnowledge,
      })
    );
  };

  const confirmReferences = (): void => {
    const current = readState();
    if (current.attachments.length < 1) return;
    setState(
      recomputeWritingReferenceState({
        attachments: current.attachments,
        selectedKnowledge: current.selectedKnowledge,
        forceStatus: "complete",
      })
    );
  };

  const editReferences = (): void => {
    const current = readState();
    if (current.attachments.length === 0) {
      setState(recomputeWritingReferenceState({ attachments: [], selectedKnowledge: [] }));
      return;
    }
    setState(
      recomputeWritingReferenceState({
        attachments: current.attachments,
        selectedKnowledge: current.selectedKnowledge,
        forceStatus: "draft",
      })
    );
  };

  return {
    isUploading,
    addFromKnowledge,
    addFromUploadFiles,
    addFromClipboardEvent,
    addFromClipboardRead,
    removeReference,
    confirmReferences,
    editReferences,
  };
};
