<template>
  <div class="w-full h-full flex flex-col">
    <!-- ローディング状態 -->
    <div
      v-if="isLoading"
      class="flex items-center justify-center h-full"
    >
      <div class="text-center">
        <vue-loaders name="ball-pulse" color="#00BBA7" scale="1.2" />
        <p class="mt-4 text-sm text-gray-500">PDFを読み込み中...</p>
      </div>
    </div>

    <!-- エラー状態 -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center h-full p-8"
    >
      <UIcon
        name="i-heroicons-exclamation-triangle"
        class="w-16 h-16 text-red-500 mb-4"
      />
      <p class="text-lg font-semibold text-gray-900 mb-2">エラーが発生しました</p>
      <p class="text-sm text-gray-600 mb-4">{{ error }}</p>
      <UButton color="primary" @click="$emit('retry')">再試行</UButton>
    </div>

    <!-- PDFプレビュー（HTML5標準ビューワー） -->
    <div
      v-else-if="url"
      class="flex-1 overflow-hidden bg-gray-100"
    >
      <iframe
        :src="url"
        class="w-full h-full border-0"
        type="application/pdf"
        @load="onPdfLoad"
        @error="onPdfError"
      />
    </div>

    <!-- URL未設定の場合 -->
    <div
      v-else
      class="flex flex-col items-center justify-center h-full p-8"
    >
      <UIcon
        name="i-heroicons-document-text"
        class="w-16 h-16 text-gray-400 mb-4"
      />
      <p class="text-lg font-semibold text-gray-900 mb-2">
        PDFを読み込めませんでした
      </p>
      <p class="text-sm text-gray-600">
        PDFファイルのURLが設定されていません
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import log from "@utils/logger";

//#region Props & Emits
interface Props {
  url: string | null;
  isLoading?: boolean;
  error?: string | null;
}

withDefaults(defineProps<Props>(), {
  isLoading: false,
  error: null,
});

const emit = defineEmits<{
  load: [];
  error: [error: Error];
  retry: [];
}>();
//#endregion

//#region Methods
/**
 * PDF読み込み完了時のコールバック
 */
const onPdfLoad = () => {
  log("INFO", "PDF loaded successfully");
  emit("load");
};

/**
 * PDF読み込み失敗時のコールバック
 */
const onPdfError = (event: Event) => {
  log("ERROR", "PDF load error", event);
  const error = new Error("PDFの読み込みに失敗しました");
  emit("error", error);
};
//#endregion
</script>

<style scoped>
/* PDFビューワーのスタイル調整 */
iframe {
  min-height: 600px;
}
</style>

