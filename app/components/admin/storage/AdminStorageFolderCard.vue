<template>
  <EnCard
    custom-class="cursor-pointer transition-shadow hover:shadow-md"
    @click="emit('click')"
  >
    <div class="flex flex-col items-center gap-3 p-4">
      <Icon :name="fileIcons.folder" class="w-12 h-12 text-primary-600" />

      <div class="flex flex-col items-center gap-1 w-full">
        <p class="text-sm font-medium text-center" :title="folderName">
          {{ folderName }}
        </p>
        <p v-if="formattedTimestamp" class="text-xs text-gray-500">
          {{ formattedTimestamp }}
        </p>
      </div>
    </div>
  </EnCard>
</template>

<script setup lang="ts">
// #region Imports - Composables
import { extractAndFormatTimestampFromName } from '@utils/date'

// #region Props & Emits
interface Props {
  /** フォルダ名 */
  folderName: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** フォルダクリックイベント */
  click: []
}>()

// #region Composables
const fileIcons = useFileIcons()

// #region Computed
/**
 * フォルダ名からタイムスタンプを抽出してフォーマット
 *
 * @remarks
 * - {prefix}_{13桁タイムスタンプ} 形式のフォルダ名を想定
 * - タイムスタンプが見つからない場合はnull
 */
const formattedTimestamp = computed(() => {
  return extractAndFormatTimestampFromName(props.folderName)
})
</script>
