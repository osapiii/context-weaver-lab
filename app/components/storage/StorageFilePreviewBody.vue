<template>
  <div
    class="min-h-[400px]"
    role="document"
    aria-live="polite"
  >
    <div
      v-if="loading"
      class="flex h-[400px] items-center justify-center text-sm text-slate-500"
    >
      <UIcon
        name="material-symbols:hourglass-empty"
        class="mr-2 h-5 w-5 animate-pulse text-sky-500"
      />
      プレビューを読み込み中…
    </div>

    <EnAlert
      v-else-if="errorMessage"
      icon="material-symbols:error-outline"
      color="error"
      :title="errorMessage"
      :description="errorDescription"
    />

    <div
      v-else-if="mode === 'google-workspace'"
      class="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-lg bg-slate-50 px-6 py-10 text-center dark:bg-slate-900"
    >
      <Icon
        :name="workspaceIcon"
        class="h-16 w-16"
      />
      <div class="max-w-md space-y-2">
        <p class="text-base font-semibold text-slate-800 dark:text-slate-100">
          {{ workspaceTitle }}
        </p>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ googleWorkspaceShortcutHint() }}
        </p>
        <p
          v-if="shortcutEmail"
          class="text-xs text-slate-500"
        >
          リンク先アカウント: {{ shortcutEmail }}
        </p>
      </div>
      <UButton
        v-if="googleOpenUrl"
        color="primary"
        variant="solid"
        size="lg"
        icon="material-symbols:open-in-new"
        :href="googleOpenUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ workspaceOpenLabel }}
      </UButton>
      <p
        v-else
        class="text-sm text-purple-700 dark:text-purple-400"
      >
        ドキュメント ID を取得できませんでした。Drive の共有設定を確認するか、Google Drive から直接開いてください。
      </p>
    </div>

    <div
      v-else-if="mode === 'image' && previewUrl"
      class="flex justify-center rounded-lg bg-slate-50 p-2 dark:bg-slate-900"
    >
      <img
        :src="previewUrl"
        :alt="fileName"
        class="max-h-[min(70vh,640px)] w-auto object-contain"
      >
    </div>

    <div
      v-else-if="mode === 'pdf' && previewUrl"
      class="h-[min(70vh,640px)] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700"
    >
      <PdfPreview
        :url="previewUrl"
        :is-loading="false"
        :error="null"
      />
    </div>

    <div
      v-else-if="mode === 'markdown' && textContent"
      class="max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <EnMarkdown
        :markdown-text="textContent"
        variant="help"
      />
    </div>

    <div
      v-else-if="mode === 'csv' && csvTable"
      class="max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <UTable
        :data="csvTable.rows"
        :columns="csvTable.columns"
      />
    </div>

    <pre
      v-else-if="mode === 'text' && textContent"
      class="max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed font-mono text-slate-800 whitespace-pre-wrap break-words dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
    >{{ textContent }}</pre>

    <div
      v-else
      class="flex h-[400px] flex-col items-center justify-center gap-3 rounded-lg bg-slate-50 text-center dark:bg-slate-900"
    >
      <Icon
        :name="fallbackIcon"
        class="h-16 w-16 text-slate-400"
      />
      <p class="text-sm font-medium text-slate-700 dark:text-slate-200">
        このファイルはブラウザでプレビューできません
      </p>
      <p class="max-w-sm text-xs text-slate-500">
        {{ binaryHint }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EnAlert from "@components/EnAlert.vue";
import EnMarkdown from "@components/EnMarkdown.vue";
import PdfPreview from "@components/PdfPreview.vue";
import type { GoogleWorkspaceKind } from "@utils/resolveStorageFileIcon";
import { resolveStorageFileIcon } from "@utils/resolveStorageFileIcon";
import {
  googleWorkspaceOpenButtonLabel,
  googleWorkspaceShortcutHint,
  googleWorkspaceTypeLabel,
  parseCsvPreviewTable,
  type StoragePreviewMode,
} from "@utils/storageFilePreview";

const props = withDefaults(
  defineProps<{
    mode: StoragePreviewMode;
    fileName?: string;
    extension?: string;
    mimeType?: string;
    previewUrl?: string | null;
    textContent?: string | null;
    googleOpenUrl?: string | null;
    googleWorkspaceKind?: GoogleWorkspaceKind | null;
    shortcutEmail?: string | null;
    loading?: boolean;
    errorMessage?: string | null;
    errorDescription?: string;
    fallbackIcon?: string | null;
  }>(),
  {
    fileName: "",
    extension: "",
    mimeType: "",
    previewUrl: null,
    textContent: null,
    googleOpenUrl: null,
    googleWorkspaceKind: null,
    shortcutEmail: null,
    loading: false,
    errorMessage: null,
    errorDescription:
      "ダウンロードしてローカルで開くか、外部リンクから開いてください。",
    fallbackIcon: null,
  }
);

const fileIcons = useFileIcons();

const workspaceIcon = computed(() => {
  if (props.fallbackIcon) return props.fallbackIcon;
  return resolveStorageFileIcon(
    fileIcons,
    props.extension,
    props.mimeType
  );
});

const workspaceTitle = computed(() => {
  if (props.googleWorkspaceKind) {
    return googleWorkspaceTypeLabel(props.googleWorkspaceKind);
  }
  return props.fileName || "Google Workspace";
});

const workspaceOpenLabel = computed(() => {
  if (props.googleWorkspaceKind) {
    return googleWorkspaceOpenButtonLabel(props.googleWorkspaceKind);
  }
  return "Google で開く";
});

const csvTable = computed(() => {
  if (props.mode !== "csv" || !props.textContent) return null;
  return parseCsvPreviewTable(props.textContent);
});

const binaryHint = computed(() => {
  if (props.mode === "google-workspace") return googleWorkspaceShortcutHint();
  return "Office 形式などはダウンロードしてローカルのアプリで開いてください。";
});
</script>
