<template>
  <div
    class="mx-auto w-full max-w-2xl"
    data-testid="image-reference-kiosk-panel"
  >
    <div class="mb-5 text-center">
      <h2 class="text-lg font-bold tracking-tight text-violet-950 sm:text-xl">
        お手本画像を追加してください
      </h2>
      <p class="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
        ビラ・ポスターなどを1枚追加して「参照を確定」を押してください
      </p>
    </div>

    <ImageReferenceMenu
      layout="kiosk"
      :state="state"
      :disable-confirm="disableConfirm"
      :is-uploading="isUploading"
      :streaming-hint="streamingHint"
      @open-knowledge="emit('open-knowledge')"
      @confirm="emit('confirm')"
      @edit="emit('edit')"
      @remove="(id) => emit('remove', id)"
      @upload-files="(files) => emit('upload-files', files)"
      @paste-from-clipboard="emit('paste-from-clipboard')"
    />
  </div>
</template>

<script setup lang="ts">
import ImageReferenceMenu from "@components/AgentWorkspace/ImageReferenceMenu.vue";
import type { ImageReferenceState } from "@utils/imageReference";

defineProps<{
  state: ImageReferenceState;
  disableConfirm?: boolean;
  isUploading?: boolean;
  streamingHint?: string;
}>();

const emit = defineEmits<{
  "open-knowledge": [];
  confirm: [];
  edit: [];
  remove: [id: string];
  "upload-files": [files: File[]];
  "paste-from-clipboard": [];
}>();
</script>
