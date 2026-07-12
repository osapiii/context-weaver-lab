<template>
  <EnModal
    v-model:open="isOpen"
    :title="file?.name ?? 'ファイルプレビュー'"
    size="full"
    header-variant="default"
    padding="md"
    :ui="{ content: 'max-w-4xl' }"
  >
    <div
      v-if="file"
      class="space-y-4"
    >
      <div class="flex flex-wrap items-center gap-2">
        <EnBadge
          variant="soft"
          color="neutral"
          size="xs"
        >
          {{ fileTypeLabel }}
        </EnBadge>
        <span class="text-xs text-slate-500">{{ formattedFileSize }}</span>
      </div>

      <StorageFilePreviewBody
        :mode="previewMode"
        :file-name="file.name"
        :extension="fileExtension"
        :mime-type="file.contentType || ''"
        :preview-url="previewUrl"
        :text-content="textContent"
        :google-open-url="googleOpenUrl"
        :google-workspace-kind="googleWorkspaceKind"
        :shortcut-email="shortcutEmail"
        :loading="isLoading"
        :error-message="errorMessage"
        error-description="ダウンロードしてローカルで開くか、Google で直接開いてください。"
        :fallback-icon="fileTypeIcon"
      />

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-200 pt-4 dark:border-gray-800">
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            ファイル名
          </p>
          <p class="text-sm font-medium">
            {{ file.name }}
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            更新日時
          </p>
          <p class="text-sm font-medium">
            {{ formattedUpdateDate }}
          </p>
        </div>
        <div class="sm:col-span-2">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            パス
          </p>
          <p class="text-sm font-medium break-all">
            {{ file.fullPath }}
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <EnButton
        v-if="googleOpenUrl"
        variant="outline"
        color="primary"
        leading-icon="material-symbols:open-in-new"
        @click="openGoogleWorkspace"
      >
        {{ googleOpenButtonLabel }}
      </EnButton>
      <EnButton
        v-if="canDownload"
        variant="outline"
        color="neutral"
        leading-icon="i-heroicons-arrow-down-tray"
        @click="handleDownload"
      >
        ダウンロード
      </EnButton>
      <EnButton
        variant="ghost"
        color="neutral"
        @click="isOpen = false"
      >
        閉じる
      </EnButton>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import type { StorageFileMetadata } from "@models/storageFileMetadata";
import { extractFileExtension } from "@models/storageFileMetadata";
import { formatTimestamp } from "@utils/date";
import {
  resolveGoogleWorkspaceKind,
  resolveStorageFileIcon,
  type GoogleWorkspaceKind,
} from "@utils/resolveStorageFileIcon";
import {
  googleWorkspaceOpenButtonLabel,
  parseGoogleShortcutPayload,
  resolveGoogleWorkspaceOpenUrl,
  resolveStorageFileTypeLabel,
  resolveStoragePreviewMode,
  shouldOfferStorageDownload,
  type StoragePreviewMode,
} from "@utils/storageFilePreview";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import EnModal from "@components/EnModal.vue";
import StorageFilePreviewBody from "@components/storage/StorageFilePreviewBody.vue";

interface Props {
  open: boolean;
  file: StorageFileMetadata | null;
  bucketName: string;
  driveFileId?: string | null;
  driveWebViewLink?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  driveFileId: null,
  driveWebViewLink: null,
});

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const fileIcons = useFileIcons();
const store = useFileStorageViewerStore();
const storageOps = useFirebaseStorageOperations();

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit("update:open", value),
});

const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const previewUrl = ref<string | null>(null);
const textContent = ref<string | null>(null);
const googleOpenUrl = ref<string | null>(null);
const shortcutEmail = ref<string | null>(null);

const fileExtension = computed(() => {
  if (!props.file) return "";
  return extractFileExtension(props.file.name);
});

const previewMode = computed((): StoragePreviewMode => {
  if (!props.file) return "binary";
  return resolveStoragePreviewMode(
    fileExtension.value,
    props.file.contentType || ""
  );
});

const googleWorkspaceKind = computed((): GoogleWorkspaceKind | null =>
  resolveGoogleWorkspaceKind(
    fileExtension.value,
    props.file?.contentType || ""
  )
);

const fileTypeIcon = computed(() => {
  if (!props.file) return fileIcons.file;
  return resolveStorageFileIcon(
    fileIcons,
    fileExtension.value,
    props.file.contentType || ""
  );
});

const fileTypeLabel = computed(() => {
  if (!props.file) return "ファイル";
  return resolveStorageFileTypeLabel(
    fileExtension.value,
    props.file.contentType || ""
  );
});

const formattedFileSize = computed(() => {
  if (!props.file) return "0 B";
  const bytes = props.file.size;
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
});

const formattedUpdateDate = computed(() => {
  if (!props.file) return "";
  return formatTimestamp(props.file.updated);
});

const canDownload = computed(
  () =>
    Boolean(props.file) &&
    shouldOfferStorageDownload(previewMode.value) &&
    previewMode.value !== "google-workspace"
);

const googleOpenButtonLabel = computed(() => {
  const kind = googleWorkspaceKind.value;
  if (!kind) return "Google で開く";
  return googleWorkspaceOpenButtonLabel(kind);
});

const resetPreviewState = (): void => {
  isLoading.value = false;
  errorMessage.value = null;
  previewUrl.value = null;
  textContent.value = null;
  googleOpenUrl.value = null;
  shortcutEmail.value = null;
};

const resolveSignedUrl = async (): Promise<string | null> => {
  if (!props.file) return null;
  const cachedUrl = store.getCachedSignedUrl(props.file.fullPath);
  if (cachedUrl) return cachedUrl;
  try {
    const signedUrl = await storageOps.getAuthenticatedUrl({
      bucketName: props.bucketName,
      filePath: props.file.fullPath,
    });
    store.setCachedSignedUrl(props.file.fullPath, signedUrl);
    return signedUrl;
  } catch {
    return null;
  }
};

const fetchTextFromUrl = async (url: string): Promise<void> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  textContent.value = await res.text();
};

const resolveGoogleOpenFromContent = (): void => {
  const kind = googleWorkspaceKind.value;
  if (!kind) return;

  googleOpenUrl.value = resolveGoogleWorkspaceOpenUrl({
    kind,
    driveFileId: props.driveFileId,
    webViewLink: props.driveWebViewLink,
    docId: parseGoogleShortcutPayload(textContent.value || "")?.docId,
  });

  shortcutEmail.value =
    parseGoogleShortcutPayload(textContent.value || "")?.email ?? null;
};

const loadPreview = async (): Promise<void> => {
  resetPreviewState();
  if (!props.file) return;

  const mode = previewMode.value;
  isLoading.value = true;

  if (mode === "google-workspace") {
    googleOpenUrl.value = resolveGoogleWorkspaceOpenUrl({
      kind: googleWorkspaceKind.value!,
      driveFileId: props.driveFileId,
      webViewLink: props.driveWebViewLink,
    });
    const url = await resolveSignedUrl();
    if (url) {
      try {
        await fetchTextFromUrl(url);
        resolveGoogleOpenFromContent();
      } catch {
        if (!googleOpenUrl.value) {
          errorMessage.value = "ショートカット情報の読み込みに失敗しました";
        }
      }
    } else if (!googleOpenUrl.value) {
      errorMessage.value = "Google ドキュメントのリンクを解決できませんでした";
    }
    isLoading.value = false;
    return;
  }

  if (mode === "image" || mode === "pdf") {
    previewUrl.value = await resolveSignedUrl();
    if (!previewUrl.value) {
      errorMessage.value = "プレビュー URL を取得できませんでした";
    }
    isLoading.value = false;
    return;
  }

  if (mode === "markdown" || mode === "csv" || mode === "text") {
    const url = await resolveSignedUrl();
    if (!url) {
      errorMessage.value = "ファイル内容を読み込めませんでした";
      isLoading.value = false;
      return;
    }
    try {
      await fetchTextFromUrl(url);
    } catch {
      errorMessage.value = "ファイル内容の読み込みに失敗しました";
    }
    isLoading.value = false;
    return;
  }

  isLoading.value = false;
};

const handleDownload = async (): Promise<void> => {
  if (!props.file || !canDownload.value) return;
  try {
    await store.downloadFile(props.file, props.bucketName);
  } catch (error) {
    console.error("Failed to download file:", error);
  }
};

const openGoogleWorkspace = (): void => {
  if (!googleOpenUrl.value) return;
  window.open(googleOpenUrl.value, "_blank", "noopener,noreferrer");
};

watch(
  () => [props.file, props.open] as const,
  ([file, open]) => {
    if (!open || !file) {
      resetPreviewState();
      return;
    }
    void loadPreview();
  },
  { immediate: true }
);
</script>
