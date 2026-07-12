import { ref } from "vue";
import { useAgentAttachments } from "@composables/agentAttachments/useAgentAttachments";
import type { SelectedKnowledgeRef } from "@utils/consultationKnowledge";
import {
  MAX_IMAGE_REFERENCES,
  recomputeImageReferenceStatus,
  type ImageReference,
  type ImageReferenceState,
} from "@utils/imageReference";
import {
  extractClipboardImageFiles,
  readClipboardImageFiles,
} from "@utils/clipboardImages";

const knowledgeToImageReference = (item: SelectedKnowledgeRef): ImageReference => ({
  id: item.id,
  source: "knowledge",
  name: item.name,
  mimeType: item.mimeType || "image/png",
  gcsPath: item.gcsPath,
  knowledgeDocId: item.id,
});

export const useImageReferenceSources = (params: {
  getState: () => ImageReferenceState;
  setState: (state: ImageReferenceState) => void;
}) => {
  const { getState, setState } = params;
  const attachmentsApi = useAgentAttachments({ maxBytes: 10 * 1024 * 1024 });
  const isUploading = ref(false);

  const mergeReferences = (incoming: ImageReference[]): void => {
    const current = getState();
    const byId = new Map(current.references.map((r) => [r.id, r]));
    for (const ref of incoming) {
      if (byId.size >= MAX_IMAGE_REFERENCES) break;
      byId.set(ref.id, ref);
    }
    const references = Array.from(byId.values()).slice(0, MAX_IMAGE_REFERENCES);
    const next =
      current.status === "complete"
        ? recomputeImageReferenceStatus(references, "complete")
        : recomputeImageReferenceStatus(references);
    setState(next);
  };

  const addFromKnowledge = (items: SelectedKnowledgeRef[]): void => {
    const refs = items
      .filter((item) => (item.mimeType || "").startsWith("image/"))
      .map(knowledgeToImageReference);
    if (refs.length === 0) return;
    mergeReferences(refs);
  };

  const addFromUploadFiles = async (files: File[]): Promise<void> => {
    isUploading.value = true;
    try {
      const refs: ImageReference[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        if (getState().references.length + refs.length >= MAX_IMAGE_REFERENCES) {
          break;
        }
        const uploaded = await attachmentsApi.upload(file);
        refs.push({
          id: uploaded.id,
          source: "upload",
          name: uploaded.name,
          mimeType: uploaded.mimeType,
          storageUrl: uploaded.url,
          gcsPath: uploaded.gcsPath,
        });
      }
      if (refs.length > 0) mergeReferences(refs);
    } finally {
      isUploading.value = false;
    }
  };

  const addFromClipboardEvent = async (event: ClipboardEvent): Promise<boolean> => {
    const files = extractClipboardImageFiles(event);
    if (files.length === 0) return false;
    await addFromUploadFiles(files);
    return true;
  };

  const addFromClipboardRead = async (): Promise<boolean> => {
    const files = await readClipboardImageFiles();
    if (files.length === 0) return false;
    await addFromUploadFiles(files);
    return true;
  };

  const removeReference = (id: string): void => {
    const current = getState();
    const references = current.references.filter((r) => r.id !== id);
    if (references.length === 0) {
      setState(recomputeImageReferenceStatus([]));
      return;
    }
    if (current.status === "complete") {
      setState(recomputeImageReferenceStatus(references, "draft"));
      return;
    }
    setState(recomputeImageReferenceStatus(references));
  };

  const confirmReferences = (): void => {
    const current = getState();
    if (current.references.length < 1) return;
    setState(recomputeImageReferenceStatus(current.references, "complete"));
  };

  const editReferences = (): void => {
    const current = getState();
    if (current.references.length === 0) {
      setState(recomputeImageReferenceStatus([]));
      return;
    }
    setState(recomputeImageReferenceStatus(current.references, "draft"));
  };

  const resetReferences = (): void => {
    setState(recomputeImageReferenceStatus([]));
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
    resetReferences,
  };
};
