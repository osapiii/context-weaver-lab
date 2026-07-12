<template>
  <div class="briefing-attachments space-y-2 rounded-2xl bg-white/60 p-3 ring-1 ring-black/5">
    <!-- 見出し -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <UIcon
          name="material-symbols:attach-file"
          class="h-4 w-4 text-neutral-600"
        />
        <h3 class="text-[12px] font-extrabold tracking-tight text-neutral-700">
          参考資料 ({{ attachments.length }})
        </h3>
      </div>
      <span class="text-[10px] text-neutral-400">任意 / 最大 25MB</span>
    </div>
    <p v-if="hint" class="text-[10px] leading-snug text-neutral-500">
      {{ hint }}
    </p>

    <!-- ドロップゾーン -->
    <label
      :class="[
        'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-3 text-center transition',
        dragOver
          ? 'border-emerald-400 bg-emerald-50'
          : 'border-neutral-300 bg-white hover:border-neutral-400',
        uploading ? 'pointer-events-none opacity-60' : '',
      ]"
      @dragenter.prevent="dragOver = true"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <UIcon
        :name="
          uploading
            ? 'material-symbols:progress-activity'
            : 'material-symbols:cloud-upload-outline'
        "
        :class="[
          'h-6 w-6 text-neutral-500',
          uploading ? 'animate-spin' : '',
        ]"
      />
      <span class="text-[11px] font-semibold text-neutral-700">
        {{ uploading ? "アップロード中..." : "ドロップまたはクリックで追加" }}
      </span>
      <span class="text-[10px] text-neutral-400">{{ acceptHint }}</span>
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        :multiple="multiple"
        :disabled="uploading"
        class="hidden"
        @change="onPickerChange"
      >
    </label>

    <!-- エラー -->
    <p
      v-if="errorMessage"
      class="rounded-md bg-rose-50 px-2 py-1 text-[10px] text-rose-700"
    >
      ⚠️ {{ errorMessage }}
    </p>

    <!-- 添付一覧 -->
    <ul v-if="attachments.length > 0" class="space-y-1.5">
      <li
        v-for="a in attachments"
        :key="a.id"
        class="flex items-start gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1.5"
      >
        <!-- thumbnail (image) or icon -->
        <img
          v-if="a.mimeType.startsWith('image/')"
          :src="a.url"
          :alt="a.name"
          class="h-9 w-9 flex-shrink-0 rounded object-cover"
        >
        <div
          v-else
          class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-neutral-100"
        >
          <UIcon
            name="material-symbols:description"
            class="h-5 w-5 text-neutral-500"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p
            class="truncate text-[11px] font-semibold text-neutral-800"
            :title="a.name"
          >
            {{ a.name }}
          </p>
          <p class="text-[10px] text-neutral-500">
            {{ formatSize(a.size) }} · {{ a.mimeType }}
          </p>
        </div>
        <button
          type="button"
          class="flex-shrink-0 rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
          aria-label="削除"
          @click="$emit('remove', a)"
        >
          <UIcon name="i-heroicons-x-mark" class="h-3.5 w-3.5" />
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { AttachmentRef } from "@composables/agentAttachments/types";

interface Props {
  attachments: AttachmentRef[];
  /** input[type=file] の accept 属性. 例: "image/*" / ".pdf,.txt" */
  accept?: string;
  /** プレースホルダ下の小さい注記 (例: "アイコン作成の参考画像") */
  acceptHint?: string;
  /** ヒント文 (見出し下) */
  hint?: string;
  /** 複数ファイル可? */
  multiple?: boolean;
  /** アップロード中フラグ (親が管理) */
  uploading?: boolean;
}

withDefaults(defineProps<Props>(), {
  accept: "*/*",
  acceptHint: "PDF / 画像 / テキスト など",
  hint: "",
  multiple: true,
  uploading: false,
});

const emit = defineEmits<{
  (e: "add", files: File[]): void;
  (e: "remove", attachment: AttachmentRef): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const errorMessage = ref<string | null>(null);

const onDrop = (event: DragEvent) => {
  dragOver.value = false;
  errorMessage.value = null;
  const dt = event.dataTransfer;
  if (!dt) return;
  const files = Array.from(dt.files ?? []);
  if (files.length === 0) return;
  emit("add", files);
};

const onPickerChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  errorMessage.value = null;
  const files = Array.from(target.files ?? []);
  target.value = ""; // 同じファイル再選択を許可
  if (files.length === 0) return;
  emit("add", files);
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

/** 親から「ファイル追加エラー」を出したい時に呼べる public method */
defineExpose({
  setError(msg: string | null) {
    errorMessage.value = msg;
  },
});
</script>
