<template>
  <img
    v-if="displaySrc && !loadError"
    v-bind="$attrs"
    :src="displaySrc"
    :alt="alt"
    @error="onImgError"
    @click="emit('click')"
  >
  <div
    v-else-if="loadError"
    class="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700"
  >
    画像の読み込みに失敗しました
  </div>
  <div
    v-else
    class="flex h-24 items-center justify-center rounded-md border border-dashed border-neutral-200 bg-neutral-50 text-[11px] text-neutral-500"
  >
    {{ loadingLabel }}
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useAdkSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import { useAiStudioStore } from "@stores/aiStudio";
import { resolveAdkImageDisplayUrl } from "@utils/adkArtifactUrl";
import { revokeArtifactDisplayUrl } from "@utils/artifactDisplayUrl";

const props = withDefaults(
  defineProps<{
    artifactId?: string;
    url?: string;
    transientDisplayUrl?: string;
    sessionId?: string;
    adkFilename?: string;
    artifactVersion?: number;
    alt?: string;
  }>(),
  {
    artifactId: undefined,
    url: undefined,
    transientDisplayUrl: undefined,
    sessionId: undefined,
    adkFilename: undefined,
    artifactVersion: undefined,
    alt: "生成画像",
  }
);

const emit = defineEmits<{
  click: [];
}>();

const { getArtifact, artifactsById } = useAdkSessionArtifacts();
const aiStudioStore = useAiStudioStore();

const displaySrc = ref("");
const loadError = ref(false);
let loadGeneration = 0;

const record = computed(() =>
  props.artifactId ? getArtifact({ artifactId: props.artifactId }) : undefined
);

const loadingLabel = computed(() => {
  const status = record.value?.status;
  if (status === "failed") return "画像の同期に失敗しました";
  if (status === "syncing" || !record.value?.storageGcsPath) {
    return "画像を同期中…";
  }
  return "画像を読み込み中…";
});

const load = async (): Promise<void> => {
  const generation = ++loadGeneration;
  loadError.value = false;
  displaySrc.value = "";
  if (record.value?.status === "failed") {
    loadError.value = true;
    return;
  }
  try {
    const resolved = await resolveAdkImageDisplayUrl({
      url: props.url,
      transientDisplayUrl: props.transientDisplayUrl,
      artifactId: props.artifactId,
      sessionId: props.sessionId ?? aiStudioStore.sessionId ?? undefined,
      adkFilename: props.adkFilename ?? record.value?.adkFilename,
      artifactVersion:
        props.artifactVersion ??
        record.value?.adkVersion ??
        (record.value?.adkFilename != null ? 0 : undefined),
      storageGcsPath: record.value?.storageGcsPath,
      contentType: record.value?.contentType,
      getStorageGcsPath: ({ artifactId }) =>
        getArtifact({ artifactId })?.storageGcsPath,
    });
    if (generation !== loadGeneration) return;
    if (!resolved) {
      loadError.value = true;
      return;
    }
    if (displaySrc.value) {
      revokeArtifactDisplayUrl({ url: displaySrc.value });
    }
    displaySrc.value = resolved;
  } catch {
    if (generation !== loadGeneration) return;
    loadError.value = true;
  }
};

const onImgError = (): void => {
  loadError.value = true;
  displaySrc.value = "";
};

onMounted(() => {
  void load();
});

watch(
  () =>
    [
      props.url,
      props.transientDisplayUrl,
      props.artifactId,
      props.sessionId,
      props.adkFilename,
      props.artifactVersion,
      record.value?.storageGcsPath,
      record.value?.status,
      artifactsById.value.size,
    ] as const,
  () => {
    void load();
  }
);

onBeforeUnmount(() => {
  if (displaySrc.value) {
    revokeArtifactDisplayUrl({ url: displaySrc.value });
  }
  displaySrc.value = "";
});
</script>
