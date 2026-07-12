<template>
  <div class="flex flex-col h-full">
    <div class="flex flex-col gap-6 flex-1 min-h-0 lg:flex-row">
      <!-- Left Sidebar -->
      <aside class="w-full flex-shrink-0 flex flex-col gap-6 lg:w-64">
        <!-- Refresh Button -->
        <UButton
          :icon="actionIcons.refresh"
          color="primary"
          block
          size="xl"
          :loading="store.isLoading"
          @click="handleRefresh"
        >
          更新
        </UButton>

        <!-- Folder Tree -->
        <AdminStorageFolderTree
          :current-path="store.currentPath"
          :folders="store.folders"
          :organization-id="organizationId"
          @navigate="handleNavigate"
        />
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col gap-6 min-w-0">
        <!-- Breadcrumb -->
        <AdminStorageFileBreadcrumb
          :breadcrumbs="store.breadcrumbPaths"
          @navigate="handleNavigate"
        />

        <!-- Filter Bar -->
        <AdminStorageFileFilterBar
          v-model:search-query="searchQuery"
          v-model:file-type-filter="fileTypeFilter"
          v-model:sort-by="sortBy"
          v-model:sort-order="sortOrder"
          @clear="handleClearFilters"
        />

        <!-- File Grid -->
        <div class="flex-1 overflow-auto min-h-0">
          <AdminStorageFileGrid
            :files="store.paginatedFiles"
            :folders="store.folders"
            :is-loading="store.isLoading"
            :error="store.error"
            @file-click="handleFileClick"
            @folder-click="handleFolderClick"
          />
        </div>

        <!-- Pagination -->
        <div v-if="store.paginationInfo.totalPages > 1" class="flex items-center justify-center gap-2">
          <UButton
            :icon="actionIcons.back"
            color="gray"
            variant="outline"
            size="sm"
            :disabled="store.currentPage === 1"
            @click="handlePreviousPage"
          />
          <span class="text-sm text-gray-600">
            {{ store.paginationInfo.startIndex }}-{{ store.paginationInfo.endIndex }}件を表示
            （全{{ store.paginationInfo.totalFiles }}件）
          </span>
          <UButton
            :icon="actionIcons.forward"
            color="gray"
            variant="outline"
            size="sm"
            :disabled="store.currentPage >= store.paginationInfo.totalPages"
            @click="handleNextPage"
          />
        </div>
      </main>
    </div>

    <!-- File Preview Modal -->
    <AdminStorageFilePreviewModal
      v-model:open="isPreviewOpen"
      :file="store.selectedFile"
      :bucket-name="bucketName"
    />
  </div>
</template>

<script setup lang="ts">
// #region Imports - 型定義
import type { FileTypeFilter, SortBy, SortOrder } from '@models/storageFileMetadata'

// #region Store Access
const store = useFileStorageViewerStore()
const organizationStore = useOrganizationStore()

// #region Composables
const actionIcons = useActionIcons()
const runtimeConfig = useRuntimeConfig()

// #region Computed
/**
 * Organization ID
 */
const organizationId = computed(() => {
  return organizationStore.getLoggedInOrganizationId || ''
})

/**
 * バケット名
 *
 * @remarks
 * - runtimeConfigから取得（環境変数経由）
 * - フォールバック: contextStore.bucketName
 */
const bucketName = computed(() => {
  return (
    runtimeConfig.public.firebase?.storageBucket ||
    'enostech-sandbox.appspot.com'
  )
})

// #region State
/**
 * ローカル検索クエリ
 *
 * @remarks
 * - Store Stateを直接v-modelにバインドしない（ガイドライン準拠）
 * - watchでStore更新
 */
const searchQuery = ref(store.searchQuery)

/**
 * ローカルファイルタイプフィルタ
 */
const fileTypeFilter = ref<FileTypeFilter>(store.fileTypeFilter)

/**
 * ローカルソート対象
 */
const sortBy = ref<SortBy>(store.sortBy)

/**
 * ローカルソート順
 */
const sortOrder = ref<SortOrder>(store.sortOrder)

/**
 * プレビューモーダル表示状態
 */
const isPreviewOpen = ref(false)

// #region Watch
/**
 * 検索クエリ変更をStoreに反映
 */
watch(searchQuery, (newQuery) => {
  store.setSearchQuery(newQuery)
})

/**
 * ファイルタイプフィルタ変更をStoreに反映
 */
watch(fileTypeFilter, (newFilter) => {
  store.setFileTypeFilter(newFilter)
})

/**
 * ソート対象変更をStoreに反映
 */
watch(sortBy, (newSortBy) => {
  store.setSortBy(newSortBy)
})

/**
 * ソート順変更をStoreに反映
 */
watch(sortOrder, (newSortOrder) => {
  store.setSortOrder(newSortOrder)
})

// #region Methods
/**
 * ファイル一覧を更新
 */
const handleRefresh = async () => {
  const rootPath = `organizations/${organizationId.value}/`
  await store.loadFiles(rootPath, bucketName.value)
}

/**
 * パス移動ハンドラー
 *
 * @param path - 移動先パス
 */
const handleNavigate = async (path: string) => {
  await store.navigateToPath(path, bucketName.value)
}

/**
 * フォルダクリックハンドラー
 *
 * @param folderName - フォルダ名
 */
const handleFolderClick = async (folderName: string) => {
  await store.navigateToFolder(folderName, bucketName.value)
}

/**
 * ファイルクリックハンドラー
 *
 * @param file - ファイルメタデータ
 */
const handleFileClick = (file: typeof store.selectedFile) => {
  store.selectedFile = file
  isPreviewOpen.value = true
}

/**
 * フィルタクリアハンドラー
 */
const handleClearFilters = () => {
  searchQuery.value = ''
  fileTypeFilter.value = 'all'
  sortBy.value = 'name'
  sortOrder.value = 'asc'
}

/**
 * 前のページに移動
 */
const handlePreviousPage = () => {
  if (store.currentPage > 1) {
    store.setPage(store.currentPage - 1)
  }
}

/**
 * 次のページに移動
 */
const handleNextPage = () => {
  if (store.currentPage < store.paginationInfo.totalPages) {
    store.setPage(store.currentPage + 1)
  }
}

// #region Lifecycle
const route = useRoute();

onMounted(async () => {
  const queryPrefix = route.query.gcsPrefix;
  if (typeof queryPrefix === "string" && queryPrefix.trim()) {
    const path = queryPrefix.endsWith("/") ? queryPrefix : `${queryPrefix}/`;
    await store.navigateToPath(path, bucketName.value);
    return;
  }
  const rootPath = `organizations/${organizationId.value}/`;
  if (organizationId.value) {
    await store.loadFiles(rootPath, bucketName.value);
  }
});
</script>

