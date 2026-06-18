<template>
  <div class="flex items-center gap-3 w-full">
    <!-- 検索ボックスのみ -->
    <UInput
      v-model="searchQueryLocal"
      placeholder="ファイル名で検索..."
      :icon="actionIcons.search"
      size="xl"
      class="w-full max-w-md"
    />
  </div>
</template>

<script setup lang="ts">
// #region Store Access
const store = useFileStorageViewerStore()

// #region Composables
const actionIcons = useActionIcons()

// #region State
/**
 * ローカル検索クエリ
 *
 * @remarks
 * - Store の値を直接バインドせず、ローカルrefを使用
 * - watchでStore更新
 */
const searchQueryLocal = ref(store.searchQuery)

// #region Watch
/**
 * 検索クエリの変更を監視してStoreを更新
 */
watch(searchQueryLocal, (newQuery) => {
  store.setSearchQuery(newQuery)
})
</script>
