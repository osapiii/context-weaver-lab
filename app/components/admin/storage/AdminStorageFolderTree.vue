<template>
  <div class="flex flex-col gap-2">
    <!-- ルートフォルダ -->
    <button
      class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
      :class="{
        'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300':
          isRootPath,
        'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800':
          !isRootPath,
      }"
      @click="handleNavigateToRoot"
    >
      <Icon :name="fileIcons.folder" class="w-5 h-5" />
      <span class="font-medium">My Files</span>
    </button>

    <!-- フォルダ一覧 -->
    <div v-if="folders.length > 0" class="flex flex-col gap-1 pl-4">
      <button
        v-for="folder in folders"
        :key="folder"
        class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left"
        :class="{
          'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300':
            isCurrentFolder(folder),
          'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800':
            !isCurrentFolder(folder),
        }"
        @click="handleNavigateToFolder(folder)"
      >
        <Icon :name="fileIcons.folder" class="w-5 h-5 flex-shrink-0" />
        <span class="truncate" :title="folder">{{ folder }}</span>
      </button>
    </div>

    <!-- フォルダなし -->
    <div
      v-else
      class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
    >
      フォルダがありません
    </div>
  </div>
</template>

<script setup lang="ts">
// #region Props & Emits
interface Props {
  /** 現在のパス */
  currentPath: string
  /** フォルダ一覧 */
  folders: string[]
  /** Organization ID */
  organizationId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** パス移動イベント */
  navigate: [path: string]
}>()

// #region Composables
const fileIcons = useFileIcons()

// #region Computed
/**
 * ルートパスかどうか
 */
const rootPath = computed(() => {
  return `organizations/${props.organizationId}/`
})

/**
 * 現在ルートパスかどうか
 */
const isRootPath = computed(() => {
  return props.currentPath === rootPath.value
})

// #region Methods
/**
 * ルートパスに移動
 */
const handleNavigateToRoot = () => {
  emit('navigate', rootPath.value)
}

/**
 * フォルダに移動
 *
 * @param folderName - フォルダ名
 */
const handleNavigateToFolder = (folderName: string) => {
  const newPath = `${props.currentPath}${folderName}/`
  emit('navigate', newPath)
}

/**
 * 現在のフォルダかどうか
 *
 * @param folderName - フォルダ名
 * @returns 現在のフォルダかどうか
 */
const isCurrentFolder = (folderName: string): boolean => {
  const folderPath = `${props.currentPath}${folderName}/`
  return folderPath === props.currentPath
}
</script>

