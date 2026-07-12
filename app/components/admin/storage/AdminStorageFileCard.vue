<template>
  <EnCard
    :custom-class="
      compact
        ? 'cursor-pointer transition-shadow hover:shadow-md overflow-hidden'
        : 'cursor-pointer transition-shadow hover:shadow-md'
    "
    @click="emit('click')"
  >
    <!-- サムネイルまたはアイコン -->
    <div
      class="w-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden"
      :class="compact ? 'h-20' : 'h-32'"
    >
      <!-- 画像ファイルの場合はサムネイル表示 -->
      <img
        v-if="isImageFile && thumbnailUrl"
        :src="thumbnailUrl"
        :alt="file.name"
        class="w-full h-full object-cover"
        loading="lazy"
      >

      <!-- それ以外はアイコン表示 -->
      <div v-else class="flex items-center justify-center w-full h-full">
        <Icon
          :name="fileTypeIcon"
          :class="[
            compact ? 'w-12 h-12' : 'w-20 h-20',
            usesBrandFileIcon ? '' : 'text-gray-400',
          ]"
        />
      </div>
    </div>

    <!-- ファイル情報 -->
    <div :class="compact ? 'p-2 space-y-1' : 'p-3 space-y-1.5'">
      <div class="flex items-center gap-2">
        <p
          class="font-medium truncate flex-1"
          :class="compact ? 'text-xs' : 'text-sm'"
          :title="file.name"
        >
          {{ file.name }}
        </p>
        <!-- ダウンロードボタン -->
        <UButton
          v-if="fileUrl"
          icon="i-heroicons-arrow-down-tray"
          color="primary"
          variant="ghost"
          size="xs"
          @click.stop="handleDownload"
        />
      </div>

      <!-- Description表示 -->
      <p
        v-if="description"
        class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2"
        :title="description"
      >
        {{ description }}
      </p>

      <div class="flex items-center gap-2 flex-wrap">
        <EnBadge :color="fileTypeBadgeColor" variant="soft" size="xs">
          {{ fileTypeLabel }}
        </EnBadge>
        <span class="text-xs text-gray-500">{{ formattedFileSize }}</span>
      </div>

      <p class="text-xs text-gray-500">
        {{ formattedUpdateDate }}
      </p>
    </div>
  </EnCard>
</template>

<script setup lang="ts">
// #region Imports - 型定義
import type { StorageFileMetadata } from "@models/storageFileMetadata";
import { extractFileExtension } from "@models/storageFileMetadata";
import { formatTimestamp } from "@utils/date";
import {
  getFileTypeFromMetadata,
  isColoredStorageFileIcon,
  resolveStorageFileIcon,
} from "@utils/resolveStorageFileIcon";
import { resolveStorageFileTypeLabel } from "@utils/storageFilePreview";

// #region Props & Emits
interface Props {
  /** ファイルメタデータ */
  file: StorageFileMetadata;
  /** ファイルURL（ダウンロード・プレビュー用） */
  fileUrl?: string | null;
  /** 説明 */
  description?: string | null;
  /** Drive 連携由来の Document の場合に渡される (GCS に無くてもサムネイルを Drive 直 URL で出すため) */
  driveFileId?: string | null;
  /** Drive API が返す署名付きサムネイル URL (lh3.googleusercontent.com 系)。これがあれば最優先で使う */
  thumbnailLinkProp?: string | null;
  /** FileSpace 一覧向けのコンパクト表示 */
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  fileUrl: null,
  description: null,
  driveFileId: null,
  thumbnailLinkProp: null,
  compact: false,
});

const emit = defineEmits<{
  /** ファイルクリックイベント */
  click: [];
  /** ダウンロードイベント */
  download: [];
}>();

// #region Composables
const fileIcons = useFileIcons();
const store = useFileStorageViewerStore();
const storageOps = useFirebaseStorageOperations();

// #region State
/**
 * サムネイルURL
 *
 * @remarks
 * - プレースホルダー画像を初期値として設定
 * - Signed URL取得成功後に更新
 */
const thumbnailUrl = ref<string>("https://via.placeholder.com/200");

// #region Computed
/**
 * ファイル拡張子
 */
const fileExtension = computed(() => {
  return extractFileExtension(props.file.name);
});

/**
 * ファイルタイプ
 */
const fileType = computed(() => {
  return getFileTypeFromMetadata(
    fileExtension.value,
    props.file.contentType || ""
  );
});

/**
 * 画像ファイルかどうか
 */
const isImageFile = computed(() => {
  return fileType.value === "image";
});

/**
 * ファイルタイプアイコン
 */
const fileTypeIcon = computed(() =>
  resolveStorageFileIcon(
    fileIcons,
    fileExtension.value,
    props.file.contentType || ""
  )
);

const usesBrandFileIcon = computed(() =>
  isColoredStorageFileIcon(
    fileIcons,
    fileExtension.value,
    props.file.contentType || ""
  )
);

/**
 * ファイルタイプラベル
 */
const fileTypeLabel = computed(() =>
  resolveStorageFileTypeLabel(
    fileExtension.value,
    props.file.contentType || ""
  )
);

/**
 * ファイルタイプバッジカラー
 */
const fileTypeBadgeColor = computed(() => {
  switch (fileType.value) {
    case "image":
      return "primary";
    case "video":
      return "info";
    case "audio":
      return "secondary";
    case "document":
      return "success";
    default:
      return "neutral";
  }
});

/**
 * ファイルサイズをフォーマット
 */
const formattedFileSize = computed(() => {
  const bytes = props.file.size;
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
});

/**
 * 更新日時をフォーマット
 */
const formattedUpdateDate = computed(() => {
  return formatTimestamp(props.file.updated);
});

// #region Methods
/**
 * ダウンロードハンドラ
 */
const handleDownload = () => {
  if (props.fileUrl) {
    const link = document.createElement("a");
    link.href = props.fileUrl;
    link.download = props.file.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  emit("download");
};
// #endregion

// #region Lifecycle
/**
 * コンポーネントマウント時にサムネイルURLを取得
 *
 * @remarks
 * - 画像ファイルの場合のみ実行
 * - キャッシュチェック → キャッシュミス時のみAPI呼び出し
 * - エラー時はプレースホルダー画像を維持
 * - ガイドライン準拠: guide_09_INFRA_firebase_storage.md セクション1（getAuthenticatedUrl使用）
 */
onMounted(async () => {
  if (!isImageFile.value) return;

  // 1) Drive 由来で signed thumbnailLink (lh3.googleusercontent.com) があれば最優先
  // → Drive API が返した署名付き URL なので <img src> でそのまま読める
  if (props.thumbnailLinkProp) {
    thumbnailUrl.value = props.thumbnailLinkProp;
    return;
  }

  // 2) GCS にある場合: Signed URL でサムネ表示
  if (props.file.bucket && props.file.fullPath) {
    try {
      const cachedUrl = store.getCachedSignedUrl(props.file.fullPath);
      if (cachedUrl) {
        thumbnailUrl.value = cachedUrl;
        return;
      }
      const authenticatedUrl = await storageOps.getAuthenticatedUrl({
        bucketName: props.file.bucket,
        filePath: props.file.fullPath,
      });
      if (authenticatedUrl) {
        thumbnailUrl.value = authenticatedUrl;
        store.setCachedSignedUrl(props.file.fullPath, authenticatedUrl);
        return;
      }
    } catch {
      // 失敗時は Drive fallback に流す
    }
  }

  // 3) Drive 連携由来 (GCS 無し かつ thumbnailLink も無い) の最終 fallback:
  // Drive thumbnail エンドポイント (ブラウザのログイン Cookie に依存)
  if (props.driveFileId) {
    thumbnailUrl.value = `https://drive.google.com/thumbnail?id=${props.driveFileId}&sz=w400`;
  }
});
</script>
