<template>
  <div
    v-if="showMenu"
    class="rounded-xl border border-violet-200/70 bg-white p-3 shadow-sm ring-1 ring-violet-100/80"
    data-testid="image-reference-menu"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-xs font-bold text-slate-900">
          お手本画像
        </p>
        <p class="mt-0.5 text-[11px] leading-snug text-slate-600">
          {{
            hasReferences
              ? "プレビューを確認して「参照を確定」を押してください"
              : "ビラ・ポスターなどを1枚追加して確定してください"
          }}
        </p>
      </div>
      <EnBadge variant="tag" size="xs" class="flex-shrink-0">
        {{ statusLabel }}
      </EnBadge>
    </div>

    <p
      v-if="streamingHint"
      class="mt-2 text-[11px] leading-snug text-purple-800"
    >
      {{ streamingHint }}
    </p>

    <div
      v-if="hasReferences"
      class="mt-3 space-y-2"
      data-testid="image-reference-preview"
    >
      <div
        v-for="ref in state.references"
        :key="ref.id"
        class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-2"
      >
        <div
          class="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
        >
          <img
            v-if="previewUrl(ref)"
            :src="previewUrl(ref)"
            :alt="ref.name"
            class="h-full w-full object-cover"
          >
          <div
            v-else
            class="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400"
          >
            <UIcon
              name="material-symbols:image-outline"
              class="h-6 w-6"
              aria-hidden="true"
            />
            <span class="text-[9px]">読込中</span>
          </div>
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
          :data-testid="`image-reference-remove-${ref.id}`"
          @click="emit('remove', ref.id)"
        >
          <UIcon name="i-heroicons-trash-20-solid" class="h-4 w-4" />
        </button>
      </div>

      <p class="text-[10px] font-medium text-slate-500">
        別の画像に差し替える
      </p>
      <div
        class="flex flex-wrap gap-1.5"
        role="group"
        aria-label="画像の差し替え"
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
          data-testid="image-reference-paste"
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
            accept="image/*"
            multiple
            :disabled="isUploading"
            data-testid="image-reference-file-input"
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
        aria-label="画像の追加方法"
      >
        <button
          type="button"
          :class="addSourceButtonClass"
          :disabled="isUploading"
          @click="emit('open-knowledge')"
        >
          <UIcon name="material-symbols:menu-book-outline" class="h-4 w-4 shrink-0 text-violet-600" />
          ナレッジ
        </button>
        <button
          type="button"
          :class="addSourceButtonClass"
          :disabled="isUploading"
          data-testid="image-reference-paste"
          @click="emit('paste-from-clipboard')"
        >
          <UIcon name="material-symbols:content-paste" class="h-4 w-4 shrink-0 text-violet-600" />
          {{ pasteLabel }}
        </button>
        <label
          :class="[addSourceButtonClass, isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer']"
        >
          <input
            ref="fileInputRef"
            type="file"
            class="sr-only"
            accept="image/*"
            multiple
            :disabled="isUploading"
            data-testid="image-reference-file-input"
            @change="onFilesSelected"
          >
          <UIcon
            v-if="!isUploading"
            name="material-symbols:upload"
            class="h-4 w-4 shrink-0 text-violet-600"
          />
          <UIcon
            v-else
            name="material-symbols:progress-activity"
            class="h-4 w-4 shrink-0 animate-spin text-violet-600"
          />
          ファイル
        </label>
      </div>

      <div
        class="mt-3 flex min-h-[5.5rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center"
        data-testid="image-reference-empty-hint"
      >
        <UIcon
          name="material-symbols:add-photo-alternate-outline"
          class="h-8 w-8 text-slate-300"
          aria-hidden="true"
        />
        <p class="mt-2 text-[11px] font-medium text-slate-600">
          上のタブから画像を追加
        </p>
        <p class="mt-0.5 text-[10px] text-slate-400">
          スクリーンショットをコピーして「{{ pasteLabel }}」でも OK
        </p>
      </div>
    </template>

    <EnButton
      v-if="state.status === 'draft' && hasReferences"
      variant="ai"
      size="sm"
      class="mt-3"
      leading-icon="material-symbols:check-circle-outline"
      :disabled="disableConfirm || isUploading"
      data-testid="image-reference-confirm"
      @click="emit('confirm')"
    >
      参照を確定
    </EnButton>
  </div>

  <EnBadge
    v-else-if="showCompactBar"
    variant="soft"
    color="neutral"
    size="sm"
    custom-class="inline-flex w-fit max-w-full items-center gap-2 py-1 pl-1 pr-2.5"
    data-testid="image-reference-compact"
  >
    <div
      class="flex shrink-0 items-center gap-0.5"
      data-testid="image-reference-compact-thumbs"
      :aria-label="`お手本画像 ${state.references.length} 枚`"
    >
      <div
        v-for="ref in state.references"
        :key="ref.id"
        class="h-9 w-9 overflow-hidden rounded-md border border-slate-200/90 bg-slate-100"
        :data-testid="`image-reference-compact-thumb-${ref.id}`"
      >
        <img
          v-if="previewUrl(ref)"
          :src="previewUrl(ref)"
          :alt="ref.name"
          class="h-full w-full object-cover"
        >
        <div
          v-else
          class="flex h-full w-full items-center justify-center text-slate-400"
        >
          <UIcon
            name="material-symbols:image-outline"
            class="h-4 w-4"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
    <span class="text-xs font-medium text-slate-700">
      お手本 {{ state.references.length }} 枚
    </span>
    <button
      type="button"
      class="shrink-0 text-xs font-semibold text-neutral-600 underline-offset-2 hover:text-neutral-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="disableConfirm"
      data-testid="image-reference-compact-edit"
      @click="emit('edit')"
    >
      変更
    </button>
  </EnBadge>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import { useImageReferenceThumbUrls } from "@composables/useImageReferenceThumbUrls";
import {
  imageReferenceStatusLabel,
  type ImageReference,
  type ImageReferenceSource,
  type ImageReferenceState,
} from "@utils/imageReference";

const props = defineProps<{
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

const fileInputRef = ref<HTMLInputElement | null>(null);

const showMenu = computed(() => props.state.status !== "complete");
const showCompactBar = computed(
  () => props.state.status === "complete" && props.state.references.length > 0
);
const hasReferences = computed(() => props.state.references.length > 0);
const statusLabel = computed(() =>
  imageReferenceStatusLabel(props.state.status)
);

const pasteLabel = "クリップボードから貼り付け";

const addSourceButtonClass =
  "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50/80 disabled:cursor-not-allowed disabled:opacity-50";

const replaceSourceButtonClass =
  "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const { thumbUrls } = useImageReferenceThumbUrls({
  references: () => props.state.references,
});

const previewUrl = (ref: ImageReference): string | undefined =>
  thumbUrls.value[ref.id];

const SOURCE_LABELS: Record<ImageReferenceSource, string> = {
  knowledge: "ナレッジ",
  clipboard: pasteLabel,
  upload: "ファイル",
};

const sourceLabel = (source: ImageReferenceSource): string =>
  SOURCE_LABELS[source] ?? source;

const onFilesSelected = (event: Event): void => {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = "";
  if (files.length > 0) emit("upload-files", files);
};
</script>
