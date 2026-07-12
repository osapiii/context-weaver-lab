<template>
  <EnModal
    v-model:open="modalOpen"
    title="既存資料から添付"
    subtitle="現在の FileSpace から複数選択して添付できます"
    title-icon="material-symbols:library-books-outline"
    size="full"
    header-variant="default"
    padding="md"
    :ui="{
      overlay: 'z-[60]',
      content: 'z-[60] sm:max-w-4xl lg:max-w-5xl',
    }"
  >
    <div class="space-y-4">
        <UInput
          v-model="search"
          placeholder="資料名で絞り込む…"
          icon="i-heroicons-magnifying-glass"
        />

        <!-- ローディング: FileSpaceDocumentList と同じ skeleton グリッド -->
        <div
          v-if="isLoading"
          :class="documentGridClass"
        >
          <EnCard v-for="i in 6" :key="i" custom-class="space-y-2">
            <div class="flex items-start justify-between">
              <USkeleton class="h-6 w-3/4" />
              <USkeleton class="h-6 w-6 rounded" />
            </div>
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-3 w-2/3" />
            <USkeleton class="h-3 w-2/3" />
          </EnCard>
        </div>

        <!-- 空状態 -->
        <div
          v-else-if="filtered.length === 0"
          class="text-center py-12 text-gray-500"
        >
          <UIcon
            name="i-heroicons-document-text"
            class="w-16 h-16 mx-auto mb-4 text-gray-300"
          />
          <p v-if="documents.length === 0">
            この FileSpace にはまだ資料がありません
          </p>
          <p v-else>該当する資料が見つかりません</p>
        </div>

        <!-- タイル: AdminStorageFileCard を使って FileSpaceDocumentList と統一感 -->
        <div
          v-else
          :class="[documentGridClass, 'max-h-[60vh] overflow-y-auto']"
        >
          <div
            v-for="(doc, index) in filtered"
            :key="doc.id || doc.name || index"
            class="relative group"
          >
            <AdminStorageFileCard
              compact
              :file="{
                name: getDocumentFileName(doc),
                fullPath: doc.filePath || doc.name || '',
                bucket: doc.bucketName || '',
                size: getDocumentFileSize(doc),
                contentType: doc.mimeType || '',
                timeCreated: doc.createTime || '',
                updated: doc.updateTime || doc.createTime || '',
              }"
              :file-url="null"
              :description="doc.description || null"
              :drive-file-id="doc.driveFileId || null"
              :thumbnail-link-prop="doc.thumbnailLink || null"
              :class="[
                isSelected(doc) && 'ring-2 ring-purple-400 rounded-lg',
                !isAttachable(doc) && 'opacity-40 pointer-events-none',
              ]"
              @click="toggle(doc)"
            />

            <!-- 選択中チェック (右上) -->
            <span
              v-if="isSelected(doc)"
              class="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500 text-white shadow-md"
              aria-label="選択中"
            >
              <UIcon name="i-heroicons-check-20-solid" class="w-4 h-4" />
            </span>

            <!-- 添付不可ラベル (左下) -->
            <span
              v-if="!isAttachable(doc)"
              class="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 text-red-600 ring-1 ring-red-200"
              :title="'GCS パスが未登録のため添付できません'"
            >
              <UIcon name="i-heroicons-no-symbol" class="w-3 h-3" />
              添付不可
            </span>
          </div>
        </div>
    </div>

    <template #footer>
      <p class="text-xs text-gray-500 mr-auto">
        {{ selected.length > 0 ? `${selected.length} 件 選択中` : "未選択" }}
      </p>
      <UButton color="neutral" variant="soft" size="sm" @click="cancel">
        キャンセル
      </UButton>
      <UButton
        color="primary"
        size="sm"
        icon="i-heroicons-paper-clip"
        :disabled="selected.length === 0"
        @click="confirm"
      >
        添付する
      </UButton>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Document } from "@models/document";
import type { AttachedFile } from "@adapters/masterEditor/types";
import AdminStorageFileCard from "@components/admin/storage/AdminStorageFileCard.vue";
import EnModal from "@components/EnModal.vue";
import { FILE_SPACE_DOCUMENT_GRID_CLASS } from "@utils/resolveStorageFileIcon";

const props = defineProps<{
  /** 現在の FileSpace のドキュメント一覧 */
  documents: Document[];
  /** 既に添付済みのファイル (重複防止用、gcsPath で比較) */
  alreadyAttached?: AttachedFile[];
  /** ロード中表示 */
  isLoading?: boolean;
}>();

const modalOpen = defineModel<boolean>("open");

const emit = defineEmits<{
  /** 選択した資料を AttachedFile[] に変換して通知 */
  (e: "attach", files: AttachedFile[]): void;
}>();

const search = ref("");
const selected = ref<Document[]>([]);
const documentGridClass = FILE_SPACE_DOCUMENT_GRID_CLASS;

watch(modalOpen, (open) => {
  if (open) {
    selected.value = [];
    search.value = "";
  }
});

/* -------------------------------------------------------------------------- */
/* Helpers — FileSpaceDocumentList のロジックと同じ                              */
/* -------------------------------------------------------------------------- */

const getDocumentFileName = (doc: Document): string => {
  if (doc.originalFileInfo?.fileName) return doc.originalFileInfo.fileName;
  if (doc.displayName) return doc.displayName;
  if (doc.name) {
    const parts = doc.name.split("/");
    return parts[parts.length - 1] || doc.name;
  }
  return "無題";
};

const getDocumentFileSize = (doc: Document): number => {
  if (
    doc.originalFileInfo?.bytes !== undefined &&
    doc.originalFileInfo?.bytes !== null
  ) {
    const bytes = Number(doc.originalFileInfo.bytes);
    if (!isNaN(bytes) && bytes > 0) return bytes;
  }
  if (doc.sizeBytes) {
    const parsed = parseInt(String(doc.sizeBytes), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

/** GCS パスが組み立てられる Document のみ添付可能 */
const isAttachable = (doc: Document): boolean => {
  return !!doc.bucketName && !!doc.filePath;
};

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.documents;
  return props.documents.filter((d) =>
    getDocumentFileName(d).toLowerCase().includes(q)
  );
});

const isSelected = (doc: Document): boolean => {
  return selected.value.some((s) => s.id === doc.id);
};

const toggle = (doc: Document): void => {
  if (!isAttachable(doc)) return;
  const i = selected.value.findIndex((s) => s.id === doc.id);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(doc);
};

const cancel = (): void => {
  modalOpen.value = false;
};

const confirm = (): void => {
  const alreadyPaths = new Set(
    (props.alreadyAttached ?? []).map((f) => f.gcsPath)
  );
  const files: AttachedFile[] = selected.value
    .map<AttachedFile | null>((d) => {
      if (!d.bucketName || !d.filePath) return null;
      const gcsPath = `gs://${d.bucketName}/${d.filePath}`;
      if (alreadyPaths.has(gcsPath)) return null;
      return {
        gcsPath,
        mimeType: d.mimeType || "application/octet-stream",
        fileName: getDocumentFileName(d),
      };
    })
    .filter((f): f is AttachedFile => f !== null);

  emit("attach", files);
  modalOpen.value = false;
};
</script>
