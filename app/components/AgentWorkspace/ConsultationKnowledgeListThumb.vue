<template>
  <div
    class="relative flex shrink-0 items-center justify-center overflow-hidden ring-1"
    :class="[sizeClass, boxClass]"
  >
    <img
      v-if="displayMode === 'image' && previewUrl"
      :src="previewUrl"
      :alt="knowledgeDocumentName(document)"
      class="h-full w-full object-cover"
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="onPreviewError"
    >
    <iframe
      v-else-if="displayMode === 'pdf' && previewUrl"
      :src="`${previewUrl}#page=1&view=FitH`"
      class="pointer-events-none absolute left-0 top-0 h-[220%] w-[220%] origin-top-left scale-[0.45] border-0 bg-white"
      title=""
      tabindex="-1"
    />
    <img
      v-else-if="displayMode === 'external' && externalUrl && !externalFailed"
      :src="externalUrl"
      :alt="knowledgeDocumentName(document)"
      class="h-full w-full object-cover"
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="onExternalError"
    >
    <UIcon
      v-else
      :name="typeIcon"
      :class="iconClass"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Document } from "@models/document";
import { useFirebaseStorageOperations } from "@composables/firebase-storage-operations";
import {
  knowledgeDocumentName,
  knowledgeDocumentTypeIcon,
  knowledgeDocumentVisualKind,
  resolveKnowledgeThumbnailPlan,
  type KnowledgeVisualKind,
} from "@utils/consultationKnowledge";

const signedUrlCache = new Map<string, string>();

const props = withDefaults(
  defineProps<{
    document: Document;
    /** banner = カード上部いっぱい (最近教えた知識マーキー等) */
    size?: "sm" | "lg" | "banner";
  }>(),
  {
    size: "sm",
  }
);

const storageOps = useFirebaseStorageOperations();
const previewUrl = ref<string | null>(null);
const externalFailed = ref(false);
const previewFailed = ref(false);

const visualKind = computed(() => knowledgeDocumentVisualKind(props.document));
const typeIcon = computed(() => knowledgeDocumentTypeIcon(props.document));

const sizeClass = computed(() => {
  if (props.size === "banner") return "h-full w-full rounded-none ring-0";
  return props.size === "lg" ? "h-16 w-16 rounded-xl" : "h-11 w-11 rounded-lg";
});

const iconClass = computed(() => {
  if (props.size === "banner") return "h-10 w-10";
  return props.size === "lg" ? "h-8 w-8" : "h-6 w-6";
});

const thumbnailPlan = computed(() => resolveKnowledgeThumbnailPlan(props.document));

const externalUrl = computed(() => {
  const plan = thumbnailPlan.value;
  if (plan.mode !== "external") return null;
  return plan.externalUrl ?? null;
});

const displayMode = computed((): "image" | "pdf" | "external" | "icon" => {
  if (previewFailed.value) {
    if (externalUrl.value && !externalFailed.value) return "external";
    return "icon";
  }
  const plan = thumbnailPlan.value;
  if (plan.mode === "pdf" && previewUrl.value) return "pdf";
  if (plan.mode === "image" && previewUrl.value) return "image";
  if (plan.mode === "external" && externalUrl.value && !externalFailed.value) {
    return "external";
  }
  return "icon";
});

const boxClass = computed(() => {
  if (props.size === "banner" && displayMode.value !== "icon") {
    return "bg-slate-100 ring-0";
  }
  const tone: Record<KnowledgeVisualKind, string> = {
    image: "bg-purple-50 text-purple-700 ring-purple-100",
    pdf: "bg-rose-50 text-rose-600 ring-rose-100",
    spreadsheet: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    document: "bg-blue-50 text-blue-700 ring-blue-100",
    markdown: "bg-sky-50 text-sky-700 ring-sky-100",
    web: "bg-violet-50 text-violet-700 ring-violet-100",
    archive: "bg-slate-100 text-slate-600 ring-slate-200",
    other: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return tone[visualKind.value];
});

const cacheKey = (bucket: string, filePath: string): string =>
  `${bucket}/${filePath}`;

const loadSignedPreview = async (): Promise<void> => {
  previewUrl.value = null;
  previewFailed.value = false;
  externalFailed.value = false;

  const plan = thumbnailPlan.value;
  if (plan.mode !== "image" && plan.mode !== "pdf") return;
  if (!plan.bucket || !plan.filePath) return;

  const key = cacheKey(plan.bucket, plan.filePath);
  const cached = signedUrlCache.get(key);
  if (cached) {
    previewUrl.value = cached;
    return;
  }

  try {
    const url = await storageOps.getAuthenticatedUrl({
      bucketName: plan.bucket,
      filePath: plan.filePath,
    });
    if (!url) {
      previewFailed.value = true;
      return;
    }
    signedUrlCache.set(key, url);
    previewUrl.value = url;
  } catch {
    previewFailed.value = true;
  }
};

watch(
  () => props.document.id ?? props.document.filePath ?? props.document.name,
  () => {
    void loadSignedPreview();
  },
  { immediate: true }
);

const onPreviewError = (): void => {
  previewFailed.value = true;
};

const onExternalError = (): void => {
  externalFailed.value = true;
};
</script>
