<template>
  <nav class="flex items-center gap-2 text-sm">
    <template v-for="(breadcrumb, index) in breadcrumbs" :key="breadcrumb.path">
      <!-- パンくずアイテム -->
      <button
        class="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        :class="{
          'font-semibold text-gray-900 dark:text-white': index === breadcrumbs.length - 1,
        }"
        @click="handleNavigate(breadcrumb.path)"
      >
        {{ breadcrumb.label }}
      </button>

      <!-- セパレータ -->
      <Icon
        v-if="index < breadcrumbs.length - 1"
        name="i-lucide-chevron-right"
        class="w-4 h-4 text-gray-400"
      />
    </template>
  </nav>
</template>

<script setup lang="ts">
// #region Imports - 型定義
import type { BreadcrumbItem } from '@models/storageFileMetadata'

// #region Props & Emits
interface Props {
  /** パンくずリスト */
  breadcrumbs: BreadcrumbItem[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** パス移動イベント */
  navigate: [path: string]
}>()

// #region Composables
const actionIcons = useActionIcons()

// #region Methods
/**
 * パス移動ハンドラー
 *
 * @param path - 移動先パス
 */
const handleNavigate = (path: string) => {
  emit('navigate', path)
}
</script>
