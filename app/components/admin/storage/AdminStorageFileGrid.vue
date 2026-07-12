<template>
  <div class="space-y-8">
    <!-- ローディング表示 -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon :name="loadingIcons.spinner" class="w-8 h-8 text-primary-600 animate-spin" />
    </div>

    <!-- エラー表示 -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-12 gap-4">
      <Icon :name="statusIcons.error" class="w-12 h-12 text-red-600" />
      <p class="text-sm text-red-600">{{ error }}</p>
    </div>

    <!-- 空状態 -->
    <div
      v-else-if="folders.length === 0 && files.length === 0"
      class="flex flex-col items-center justify-center py-12 gap-4"
    >
      <Icon :name="fileIcons.folder" class="w-16 h-16 text-gray-400" />
      <p class="text-sm text-gray-600 dark:text-gray-400">ファイルが見つかりません</p>
    </div>

    <!-- ファイルグリッド -->
    <div v-else class="space-y-8">
      <!-- フォルダセクション -->
      <div v-if="folders.length > 0" class="space-y-4">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
          フォルダ ({{ folders.length }})
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AdminStorageFolderCard
            v-for="folder in folders"
            :key="folder"
            :folder-name="folder"
            @click="emit('folder-click', folder)"
          />
        </div>
      </div>

      <!-- ファイルセクション -->
      <div v-if="files.length > 0" class="space-y-4">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
          ファイル ({{ files.length }})
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AdminStorageFileCard
            v-for="file in files"
            :key="file.fullPath"
            :file="file"
            @click="emit('file-click', file)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// #region Imports - 型定義
import type { StorageFileMetadata } from '@models/storageFileMetadata'

// #region Props & Emits
interface Props {
  /** ファイル一覧 */
  files: StorageFileMetadata[]
  /** フォルダ一覧 */
  folders: string[]
  /** ローディング状態 */
  isLoading: boolean
  /** エラーメッセージ */
  error: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** ファイルクリックイベント */
  'file-click': [file: StorageFileMetadata]
  /** フォルダクリックイベント */
  'folder-click': [folder: string]
}>()

// #region Composables
const fileIcons = useFileIcons()
const statusIcons = useStatusIcons()
const loadingIcons = useLoadingIcons()
</script>
