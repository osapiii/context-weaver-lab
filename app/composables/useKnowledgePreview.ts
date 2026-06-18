import { computed, ref } from "vue";
import type { Document } from "@models/document";
import type { SelectedKnowledgeRef } from "@utils/consultationKnowledge";
import {
  buildKnowledgePreviewMeta,
  buildKnowledgePreviewRawPayload,
  openKnowledgePreviewTarget,
  type KnowledgePreviewMeta,
  type KnowledgePreviewTarget,
} from "@utils/knowledgePreview";
import type { ResolvedConsultationSource } from "@utils/consultationSourceReferences";

const previewOpen = ref(false);
const previewTarget = ref<KnowledgePreviewTarget | null>(null);

export function useKnowledgePreview() {
  const meta = computed((): KnowledgePreviewMeta | null => {
    if (!previewTarget.value) return null;
    return buildKnowledgePreviewMeta(previewTarget.value);
  });

  const rawPayload = computed((): Record<string, unknown> | null => {
    if (!previewTarget.value) return null;
    return buildKnowledgePreviewRawPayload(previewTarget.value, meta.value);
  });

  const open = (
    input:
      | Document
      | SelectedKnowledgeRef
      | ResolvedConsultationSource
      | KnowledgePreviewTarget,
    options?: { document?: Document | null }
  ): void => {
    previewTarget.value = openKnowledgePreviewTarget(input, options);
    previewOpen.value = true;
  };

  const openFromRef = (
    ref: SelectedKnowledgeRef,
    documents: Document[] = []
  ): void => {
    const doc =
      documents.find((d) => d.id === ref.id) ??
      documents.find((d) => d.filePath && ref.gcsPath.includes(d.filePath)) ??
      null;
    open(ref, { document: doc });
  };

  const close = (): void => {
    previewOpen.value = false;
    previewTarget.value = null;
  };

  return {
    isOpen: previewOpen,
    target: previewTarget,
    meta,
    rawPayload,
    open,
    openFromRef,
    close,
  };
}
