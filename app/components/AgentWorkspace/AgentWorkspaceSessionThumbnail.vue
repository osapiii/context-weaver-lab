<template>
  <div
    :class="[
      'mt-0.5 flex h-7 w-7 flex-shrink-0 overflow-hidden rounded-lg ring-1 ring-inset',
      ringClass,
    ]"
  >
    <img
      v-if="displaySrc && !loadError"
      :src="displaySrc"
      alt=""
      loading="lazy"
      class="h-full w-full object-cover"
      @error="onImgError"
    >
    <div
      v-else
      :class="[
        'flex h-full w-full items-center justify-center',
        fallbackChipClass,
      ]"
    >
      <UIcon :name="fallbackIcon" class="h-3.5 w-3.5" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { AiStudioSessionImageThumbnail } from "@utils/aiStudioSessionThumbnail";
import { resolveAdkImageDisplayUrl } from "@utils/adkArtifactUrl";
import { revokeArtifactDisplayUrl } from "@utils/artifactDisplayUrl";

const props = defineProps<{
  sessionId: string;
  thumbnail: AiStudioSessionImageThumbnail;
}>();

const displaySrc = ref("");
const loadError = ref(false);
let loadGeneration = 0;

const fallbackIcon = "material-symbols:image";
const fallbackChipClass = "bg-violet-50 text-violet-600";
const ringClass = "ring-violet-200/80";

const load = async (): Promise<void> => {
  const generation = ++loadGeneration;
  loadError.value = false;
  if (displaySrc.value) {
    revokeArtifactDisplayUrl({ url: displaySrc.value });
    displaySrc.value = "";
  }
  try {
    const version =
      props.thumbnail.artifactVersion ??
      (props.thumbnail.adkFilename?.trim() ? 0 : undefined);
    const resolved = await resolveAdkImageDisplayUrl({
      url: props.thumbnail.url ?? undefined,
      transientDisplayUrl: props.thumbnail.transientDisplayUrl ?? undefined,
      artifactId: props.thumbnail.artifactId ?? undefined,
      sessionId: props.sessionId,
      adkFilename: props.thumbnail.adkFilename ?? undefined,
      artifactVersion: version,
    });
    if (generation !== loadGeneration) return;
    if (!resolved) {
      loadError.value = true;
      return;
    }
    displaySrc.value = resolved;
  } catch {
    if (generation !== loadGeneration) return;
    loadError.value = true;
  }
};

const onImgError = (): void => {
  loadError.value = true;
  if (displaySrc.value) {
    revokeArtifactDisplayUrl({ url: displaySrc.value });
    displaySrc.value = "";
  }
};

onMounted(() => {
  void load();
});

watch(
  () => [props.sessionId, props.thumbnail] as const,
  () => {
    void load();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  loadGeneration += 1;
  if (displaySrc.value) {
    revokeArtifactDisplayUrl({ url: displaySrc.value });
  }
});
</script>
