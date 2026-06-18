<template>
  <div class="space-y-4">
    <!-- ローディング状態 -->
    <div
      v-if="isLoading"
      :class="documentGridClass"
    >
      <EnCard
        v-for="i in 8"
        :key="i"
        custom-class="overflow-hidden p-0"
      >
        <USkeleton class="h-24 w-full rounded-none" />
        <div class="space-y-2 p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-wrap gap-1.5">
              <USkeleton class="h-5 w-20 rounded-md" />
              <USkeleton class="h-5 w-16 rounded-md" />
            </div>
            <USkeleton class="h-6 w-6 rounded-md" />
          </div>
          <USkeleton class="h-4 w-4/5 rounded" />
          <USkeleton class="h-4 w-full rounded" />
          <div class="flex items-center gap-2">
            <USkeleton class="h-4 w-9 rounded" />
            <USkeleton class="h-3 w-10 rounded" />
          </div>
          <USkeleton class="h-3 w-32 rounded" />
        </div>
      </EnCard>
    </div>

    <!-- コンパクトグリッド (画像ビュー / プレビューモーダル系) -->
    <div
      v-else-if="filteredDocuments.length > 0 && layout === 'compact'"
      :class="documentGridClass"
    >
      <KnowledgeDocumentCompactCard
        v-for="(document, index) in filteredDocuments"
        :key="documentKey(document) || index"
        :document="document"
        :enable-selection="enableSelection"
        :selected="isSelected(document)"
        @click="handleDocumentClick(document)"
        @delete="handleDocumentDelete(document)"
        @toggle="toggleSelection(document)"
      />
    </div>

    <!-- 標準グリッド (AdminStorageFileCard) -->
    <div
      v-else-if="filteredDocuments.length > 0"
      :class="documentGridClass"
    >
      <div
        v-for="(document, index) in filteredDocuments"
        :key="document.name || index"
        class="relative group"
        :class="
          isSelected(document)
            ? 'rounded-2xl ring-2 ring-purple-400 ring-offset-2 ring-offset-transparent'
            : ''
        "
      >
        <UTooltip
          v-if="document.description"
          :text="document.description"
          :popper="{ placement: 'top' }"
        >
          <template #default>
            <AdminStorageFileCard
              compact
              :file="toStorageFile(document)"
              :file-url="getDocumentFileUrl(document)"
              :description="document.description || null"
              :drive-file-id="document.driveFileId || null"
              :thumbnail-link-prop="document.thumbnailLink || null"
              @click="handleDocumentClick(document)"
            />
          </template>
        </UTooltip>
        <AdminStorageFileCard
          v-else
          compact
          :file="toStorageFile(document)"
          :file-url="getDocumentFileUrl(document)"
          :drive-file-id="document.driveFileId || null"
          :description="null"
          @click="handleDocumentClick(document)"
        />
        <KnowledgeDocumentStatusBadges
          :document="document"
          :quiet="quietBadges"
        />

        <button
          v-if="enableSelection"
          type="button"
          :aria-label="
            isSelected(document) ? '選択を解除' : '一括削除のために選択'
          "
          :aria-pressed="isSelected(document)"
          :class="[
            'absolute top-2 right-2 z-20 flex h-6 w-6 items-center justify-center rounded-md ring-1 backdrop-blur-sm shadow-sm transition-all duration-150',
            isSelected(document)
              ? 'bg-purple-500 ring-purple-500 text-white'
              : quietActions
                ? 'bg-white/95 ring-gray-300 text-gray-300 opacity-0 hover:ring-purple-400 hover:text-purple-500 group-hover:opacity-100 focus-visible:opacity-100'
                : 'bg-white/95 ring-gray-300 text-gray-300 hover:ring-purple-400 hover:text-purple-500',
          ]"
          @click.stop="toggleSelection(document)"
        >
          <UIcon name="i-heroicons-check" class="h-4 w-4" />
        </button>

        <UButton
          v-if="true"
          icon="i-heroicons-trash"
          color="error"
          variant="soft"
          size="xs"
          :class="[
            'absolute top-2 z-10 transition-opacity',
            quietActions
              ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
              : 'opacity-70 hover:opacity-100',
            enableSelection ? 'right-10' : 'right-2',
          ]"
          @click.stop="handleDocumentDelete(document)"
        />
      </div>
    </div>

    <!-- 空状態 -->
    <div v-else class="text-center py-12 text-gray-500">
      <UIcon
        name="i-heroicons-document-text"
        class="w-16 h-16 mx-auto mb-4 text-gray-300"
      />
      <p>Documentが登録されていません</p>
      <p class="text-sm mt-2">
        ファイルをアップロードしてDocumentを追加してください
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Document } from "@models/geminiFileSpaceRequest";
import AdminStorageFileCard from "@components/admin/storage/AdminStorageFileCard.vue";
import KnowledgeDocumentCompactCard from "@components/knowledge/KnowledgeDocumentCompactCard.vue";
import KnowledgeDocumentStatusBadges from "@components/knowledge/KnowledgeDocumentStatusBadges.vue";
import { useFirebaseStorageOperations } from "@composables/firebase-storage-operations";
import { useKnowledgePreview } from "@composables/useKnowledgePreview";
import log from "@utils/logger";
import { FILE_SPACE_DOCUMENT_GRID_CLASS } from "@utils/resolveStorageFileIcon";
import type { StorageFileMetadata } from "@models/storageFileMetadata";

//#region Props & Emits
interface Props {
  documents: Document[];
  isLoading?: boolean;
  /** 一括選択モード有効化 (チェックボックス表示) */
  enableSelection?: boolean;
  /** 親で管理する選択キー集合 (= documentKey の Set) */
  selectedKeys?: Set<string>;
  /** compact = プレビューモーダル系の簡素グリッド (主に画像) */
  layout?: "default" | "compact";
  /** 確認ビューで常時表示の操作UIを抑える */
  quietActions?: boolean;
  /** 確認ビューでステータスバッジの彩度と常時表示を抑える */
  quietBadges?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  enableSelection: false,
  selectedKeys: () => new Set<string>(),
  layout: "default",
  quietActions: false,
  quietBadges: false,
});

const emit = defineEmits<{
  delete: [document: Document];
  preview: [document: Document];
  toggle: [document: Document];
}>();

/** 親と一致する一意キー (doc.id or doc.name) */
const documentKey = (doc: Document): string =>
  (doc.id as string | undefined) || doc.name || "";

const isSelected = (doc: Document): boolean =>
  props.selectedKeys.has(documentKey(doc));

const toggleSelection = (doc: Document) => {
  emit("toggle", doc);
};
//#endregion

//#region Composables
const firebaseStorageOps = useFirebaseStorageOperations();
const { open: openKnowledgePreview } = useKnowledgePreview();
//#endregion

//#region State
const documentFileUrls = ref<Map<string, string>>(new Map());
//#endregion

//#region Computed
const documentGridClass = FILE_SPACE_DOCUMENT_GRID_CLASS;

/**
 * entryUrlのDocumentのみをフィルタリング
 * urlMarkdownは非表示
 */
const filteredDocuments = computed(() => {
  return props.documents.filter((doc) => {
    if (!doc.subCategory) return true;
    if (doc.subCategory === "fileUpload") return true;
    if (doc.subCategory === "entryUrl") return true;
    if (doc.subCategory === "urlMarkdown") {
      const hasParentEntry = props.documents.some(
        (d) => d.subCategory === "entryUrl"
      );
      return !hasParentEntry;
    }
    return true;
  });
});
//#endregion

//#region Methods
const toStorageFile = (document: Document): StorageFileMetadata => ({
  name: getDocumentFileName(document),
  fullPath: document.filePath || document.name || "",
  bucket: document.bucketName || "",
  size: getDocumentFileSize(document),
  contentType: document.mimeType || "",
  timeCreated: document.createTime || "",
  updated: document.updateTime || document.createTime || "",
});

const getDocumentFileName = (document: Document): string => {
  if (document.originalFileInfo?.fileName) {
    return document.originalFileInfo.fileName;
  }
  if (document.displayName) {
    return document.displayName;
  }
  if (document.name) {
    const parts = document.name.split("/");
    return parts[parts.length - 1] || document.name;
  }
  return "無題";
};

const getDocumentFileSize = (document: Document): number => {
  if (
    document.originalFileInfo?.bytes !== undefined &&
    document.originalFileInfo?.bytes !== null
  ) {
    const bytes = Number(document.originalFileInfo.bytes);
    if (!Number.isNaN(bytes) && bytes > 0) {
      return bytes;
    }
  }
  if (document.sizeBytes) {
    const parsed = parseInt(String(document.sizeBytes), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 0;
};

const getDocumentFileUrl = (document: Document): string | null => {
  if (!document.bucketName || !document.filePath) {
    return null;
  }
  const cacheKey = `${document.bucketName}/${document.filePath}`;
  return documentFileUrls.value.get(cacheKey) || null;
};
//#endregion

//#region Watchers
watch(
  () => props.documents,
  async (newDocuments) => {
    if (!Array.isArray(newDocuments)) return;

    for (const document of newDocuments) {
      if (!document.bucketName || !document.filePath) continue;

      const cacheKey = `${document.bucketName}/${document.filePath}`;
      if (documentFileUrls.value.has(cacheKey)) continue;

      try {
        const url = await firebaseStorageOps.getAuthenticatedUrl({
          bucketName: document.bucketName,
          filePath: document.filePath,
        });
        if (url) {
          documentFileUrls.value.set(cacheKey, url);
        }
      } catch (error) {
        log("ERROR", "Failed to get authenticated URL", error);
      }
    }
  },
  { immediate: true }
);
//#endregion

//#region Methods (continued)
const handleDocumentDelete = (document: Document) => {
  emit("delete", document);
};

const handleDocumentClick = (document: Document) => {
  openKnowledgePreview(document);
  emit("preview", document);
};
//#endregion
</script>
