<template>
  <div
    v-if="showMenu"
    :class="
      variant === 'kiosk'
        ? 'bg-transparent'
        : 'rounded-xl border border-emerald-200/70 bg-white p-3 shadow-sm ring-1 ring-emerald-100/80'
    "
    data-testid="writing-reference-menu"
  >
    <div
      v-if="variant !== 'kiosk'"
      class="flex items-start justify-between gap-2"
    >
      <div class="min-w-0">
        <p class="text-xs font-bold text-slate-900">
          参考資料
        </p>
        <p class="mt-0.5 text-[11px] leading-snug text-slate-600">
          {{
            hasReferences
              ? "内容を確認して「参照を確定」を押してください"
              : "補助金申請書・会社項目シートなどを追加してください"
          }}
        </p>
      </div>
      <EnBadge variant="tag" size="xs" class="flex-shrink-0">
        {{ statusLabel }}
      </EnBadge>
    </div>
    <div
      v-else
      class="mb-2 flex items-center justify-end"
    >
      <EnBadge variant="tag" size="xs" class="flex-shrink-0">
        {{ statusLabel }}
      </EnBadge>
    </div>

    <p
      v-if="streamingHint"
      class="mt-2 text-[11px] leading-snug text-emerald-800"
    >
      {{ streamingHint }}
    </p>

    <div
      v-if="hasReferences"
      class="mt-3 space-y-2"
      data-testid="writing-reference-preview"
    >
      <div
        v-for="ref in state.attachments"
        :key="ref.id"
        class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-2"
      >
        <div
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white"
        >
          <UIcon
            :name="iconForMime(ref.mimeType)"
            class="h-7 w-7 text-emerald-600"
            aria-hidden="true"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-semibold text-slate-900">
            {{ ref.name }}
          </p>
          <p class="mt-0.5 text-[10px] text-slate-500">
            {{ sourceLabel(ref.source) }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-800"
          title="削除"
          :data-testid="`writing-reference-remove-${ref.id}`"
          @click="emit('remove', ref.id)"
        >
          <UIcon name="i-heroicons-trash-20-solid" class="h-4 w-4" />
        </button>
      </div>

      <p class="text-[10px] font-medium text-slate-500">
        別の資料に差し替える
      </p>
      <div
        class="flex flex-wrap gap-1.5"
        role="group"
        aria-label="参考資料の差し替え"
      >
        <button
          type="button"
          :class="replaceSourceButtonClass"
          :disabled="isUploading"
          @click="emit('open-knowledge')"
        >
          <UIcon name="material-symbols:menu-book-outline" class="h-3.5 w-3.5 shrink-0" />
          ナレッジ
        </button>
        <button
          type="button"
          :class="replaceSourceButtonClass"
          :disabled="isUploading"
          data-testid="writing-reference-paste"
          @click="emit('paste-from-clipboard')"
        >
          <UIcon name="material-symbols:content-paste" class="h-3.5 w-3.5 shrink-0" />
          {{ pasteLabel }}
        </button>
        <label
          :class="[replaceSourceButtonClass, isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer']"
        >
          <input
            ref="fileInputRef"
            type="file"
            class="sr-only"
            :accept="acceptMimeTypes"
            multiple
            :disabled="isUploading"
            data-testid="writing-reference-file-input"
            @change="onFilesSelected"
          >
          <UIcon
            v-if="!isUploading"
            name="material-symbols:upload"
            class="h-3.5 w-3.5 shrink-0"
          />
          <UIcon
            v-else
            name="material-symbols:progress-activity"
            class="h-3.5 w-3.5 shrink-0 animate-spin"
          />
          ファイル
        </label>
      </div>
    </div>

    <template v-else>
      <div
        class="mt-3 flex flex-wrap gap-1.5"
        role="group"
        aria-label="参考資料の追加方法"
      >
        <button
          type="button"
          :class="addSourceButtonClass"
          :disabled="isUploading"
          @click="emit('open-knowledge')"
        >
          <UIcon name="material-symbols:menu-book-outline" class="h-4 w-4 shrink-0 text-emerald-600" />
          ナレッジ
        </button>
        <button
          type="button"
          :class="addSourceButtonClass"
          :disabled="isUploading"
          data-testid="writing-reference-paste"
          @click="emit('paste-from-clipboard')"
        >
          <UIcon name="material-symbols:content-paste" class="h-4 w-4 shrink-0 text-emerald-600" />
          {{ pasteLabel }}
        </button>
        <label
          :class="[addSourceButtonClass, isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer']"
        >
          <input
            ref="fileInputRef"
            type="file"
            class="sr-only"
            :accept="acceptMimeTypes"
            multiple
            :disabled="isUploading"
            data-testid="writing-reference-file-input"
            @change="onFilesSelected"
          >
          <UIcon
            v-if="!isUploading"
            name="material-symbols:upload"
            class="h-4 w-4 shrink-0 text-emerald-600"
          />
          <UIcon
            v-else
            name="material-symbols:progress-activity"
            class="h-4 w-4 shrink-0 animate-spin text-emerald-600"
          />
          ファイル
        </label>
      </div>

      <div
        class="mt-3 flex min-h-[5.5rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center"
        data-testid="writing-reference-empty-hint"
      >
        <UIcon
          name="material-symbols:description-outline"
          class="h-8 w-8 text-slate-300"
          aria-hidden="true"
        />
        <p class="mt-2 text-[11px] font-medium text-slate-600">
          上のボタンから資料を追加
        </p>
        <p class="mt-0.5 text-[10px] text-slate-400">
          PDF・Word・Excel・画像などに対応。スクリーンショットは「{{ pasteLabel }}」でも OK
        </p>
      </div>
    </template>

    <EnButton
      v-if="state.status === 'draft' && hasReferences"
      variant="solid"
      color="success"
      size="sm"
      class="mt-3"
      leading-icon="material-symbols:check-circle-outline"
      :disabled="disableConfirm || isUploading"
      data-testid="writing-reference-confirm"
      @click="emit('confirm')"
    >
      参照を確定
    </EnButton>
  </div>

  <div
    v-else-if="showCompactBar"
    class="space-y-2"
    data-testid="writing-reference-compact"
  >
    <div
      class="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-2"
    >
      <UIcon
        name="material-symbols:check-circle"
        class="h-4 w-4 flex-shrink-0 text-emerald-600"
      />
      <p class="min-w-0 flex-1 text-xs font-semibold text-emerald-900">
        参考資料 {{ state.attachments.length }} 件 · フォーマットを抽出できます
      </p>
      <EnButton
        variant="ghost"
        size="xs"
        :disabled="disableConfirm"
        @click="emit('edit')"
      >
        変更
      </EnButton>
    </div>
    <EnButton
      v-if="showExtract"
      variant="solid"
      size="sm"
      class="w-full sm:w-auto"
      :disabled="disableExtract || isExtracting"
      :loading="isExtracting"
      data-testid="writing-extract-schema"
      @click="emit('extract')"
    >
      フォーマットを抽出
    </EnButton>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import type {
  WritingReferenceSource,
  WritingReferenceState,
} from "@models/writingForm";
import { writingReferenceStatusLabel } from "@utils/writingWorkspaceState";

const props = withDefaults(
  defineProps<{
    state: WritingReferenceState;
    acceptMimeTypes?: string;
    chipIconFor: (mimeType: string) => string;
    disableConfirm?: boolean;
    disableExtract?: boolean;
    isUploading?: boolean;
    isExtracting?: boolean;
    showExtract?: boolean;
    streamingHint?: string;
    /** kiosk: 外側パネルが見出しを持つため内側ヘッダーを簡略化 */
    variant?: "default" | "kiosk";
  }>(),
  { variant: "default" }
);

const emit = defineEmits<{
  "open-knowledge": [];
  "paste-from-clipboard": [];
  confirm: [];
  edit: [];
  extract: [];
  remove: [id: string];
  "upload-files": [files: File[]];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);

const pasteLabel = "クリップボードから貼り付け";

const iconForMime = (mime: string): string => props.chipIconFor(mime);

const showMenu = computed(() => props.state.status !== "complete");
const showCompactBar = computed(
  () => props.state.status === "complete" && props.state.attachments.length > 0
);
const hasReferences = computed(() => props.state.attachments.length > 0);
const statusLabel = computed(() => writingReferenceStatusLabel(props.state.status));
const acceptMimeTypes = computed(() => props.acceptMimeTypes ?? "*/*");

const addSourceButtonClass =
  "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/80 disabled:cursor-not-allowed disabled:opacity-50";

const replaceSourceButtonClass =
  "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const SOURCE_LABELS: Record<WritingReferenceSource, string> = {
  knowledge: "ナレッジ",
  clipboard: pasteLabel,
  upload: "ファイル",
};

const sourceLabel = (source: WritingReferenceSource): string =>
  SOURCE_LABELS[source] ?? source;

const onFilesSelected = (event: Event): void => {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = "";
  if (files.length > 0) emit("upload-files", files);
};
</script>
