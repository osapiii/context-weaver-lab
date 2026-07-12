<template>
  <div
    class="w-full min-w-0 space-y-2"
    data-testid="ai-studio-form-context"
  >
    <!-- 画像: 作成方法確定後 -->
    <template v-if="store.activeAgent === 'image' && store.imageCreationMode">
      <div
        v-if="store.imageCreationMode === 'scratch'"
        class="rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 text-[11px] leading-snug text-slate-600"
        data-testid="image-scratch-hint"
      >
        下の入力欄に、生成したい画像のスタイル・用途・構図などを書いて送信してください。
      </div>

      <div
        v-else-if="store.imageWorkflowPhase === 'retouch'"
        class="rounded-lg border border-purple-200/80 bg-purple-50/50 px-3 py-2 text-[11px] leading-snug text-purple-900"
        data-testid="image-retouch-hint"
      >
        右の OUT で範囲を指定するか、下の入力欄に全体の修正指示を書いて送信してください。
      </div>

      <ImageReferenceMenu
        v-if="
          store.imageCreationMode === 'reference' &&
            coalesceImageReferenceState(store.imageReferenceState).status ===
              'complete'
        "
        :state="store.imageReferenceState"
        :disable-confirm="imageRefSources.isUploading.value"
        :is-uploading="imageRefSources.isUploading.value"
        :streaming-hint="
          store.isStreaming
            ? '応答生成中もリファレンスの追加・確定ができます。送信だけ完了後に行ってください。'
            : undefined
        "
        @open-knowledge="emit('open-image-knowledge')"
        @confirm="emit('confirm-image-references')"
        @edit="imageRefSources.editReferences()"
        @remove="imageRefSources.removeReference"
        @upload-files="(files) => emit('image-upload-files', files)"
        @paste-from-clipboard="emit('image-paste-clipboard')"
      />
    </template>

    <!-- シート -->
    <template v-else-if="store.activeAgent === 'sheet'">
      <SheetConnectionPicker
        v-if="!store.sheetModeSelected"
        :disabled="store.isStreaming"
      />
      <div
        v-else
        class="flex items-center justify-between gap-2 rounded-lg border border-green-200/80 bg-green-50/60 px-2.5 py-1.5"
        data-testid="sheet-connection-summary"
      >
        <div class="min-w-0">
          <p class="truncate text-[11px] font-semibold text-slate-800">
            {{ store.targetSheetName }}
          </p>
          <p
            v-if="sheetConnectionUrlLabel"
            class="truncate text-[10px] text-slate-500"
          >
            {{ sheetConnectionUrlLabel }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 text-[11px] font-semibold text-green-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="store.isStreaming"
          data-testid="sheet-connection-change"
          @click="emit('change-sheet-connection')"
        >
          変更
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import ImageReferenceMenu from "@components/AgentWorkspace/ImageReferenceMenu.vue";
import SheetConnectionPicker from "@components/AgentWorkspace/SheetConnectionPicker.vue";
import { useImageReferenceSources } from "@composables/useImageReferenceSources";
import { useAiStudioStore } from "@stores/aiStudio";
import type { ImageCreationMode } from "@utils/imageReference";
import { coalesceImageReferenceState } from "@utils/imageReference";

const props = defineProps<{
  acceptMimeTypes: string;
  chipIconFor: (mimeType: string) => string;
  sheetConnectionUrlLabel: string;
}>();

const emit = defineEmits<{
  "image-creation-mode": [mode: ImageCreationMode];
  "change-image-creation-mode": [];
  "open-image-knowledge": [];
  "confirm-image-references": [];
  "image-upload-files": [files: File[]];
  "image-paste-clipboard": [];
  "change-sheet-connection": [];
}>();

const store = useAiStudioStore();

const imageRefSources = useImageReferenceSources({
  getState: () => coalesceImageReferenceState(store.imageReferenceState),
  setState: (state) => store.setImageReferenceState(state),
});

</script>
