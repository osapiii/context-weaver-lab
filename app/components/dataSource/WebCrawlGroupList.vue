<template>
  <div class="space-y-4">
    <!-- ローディング -->
    <div
      v-if="isLoading"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <EnCard v-for="i in 3" :key="i" custom-class="overflow-hidden p-0">
        <USkeleton class="aspect-[16/10] w-full rounded-none" />
        <div class="space-y-2 p-3">
          <USkeleton class="h-4 w-3/4" />
          <USkeleton class="h-3 w-1/2" />
        </div>
      </EnCard>
    </div>

    <!-- 空状態 -->
    <div
      v-else-if="folders.length === 0"
      class="text-center py-12 text-gray-500"
    >
      <UIcon
        name="i-heroicons-globe-alt"
        class="w-16 h-16 mx-auto mb-4 text-gray-300"
      />
      <p>Web 取り込みはまだありません</p>
      <p class="text-sm mt-2">「知識を教える」タブから URL を投入してください</p>
    </div>

    <!-- 取り込みフォルダ -->
    <div
      v-else
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <WebCrawlFolderCard
        v-for="folder in folders"
        :key="folder.folder.id"
        :folder="folder"
        @click="onFolderClick(folder)"
      />
    </div>

  </div>
</template>

<script setup lang="ts">
import type { Document } from "@models/document";
import type {
  WebCrawlFolderGroup,
  WebCrawlGroup,
} from "../../types/webCrawlGroup";
import WebCrawlFolderCard from "./WebCrawlFolderCard.vue";
import { useSpaceStore } from "@stores/space";
import { useWebCrawlRequestStore } from "@stores/webCrawlRequest";
import { useRouter } from "vue-router";
import {
  buildWebCrawlFolders,
  buildWebCrawlGroups,
} from "@utils/webCrawlFolders";

interface Props {
  documents: Document[];
  isLoading?: boolean;
  fileSpaceId?: string | null;
}
const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  fileSpaceId: null,
});

defineEmits<{
  delete: [doc: Document]; // (互換) per-doc delete: 個別削除する場合
  refresh: []; // 一覧再取得を親に要求
}>();

const spaceStore = useSpaceStore();
const webCrawlStore = useWebCrawlRequestStore();
const router = useRouter();

onMounted(() => {
  void webCrawlStore.fetchRecentRequests();
});

// 楽観 UI: すでに削除完了して隠す key
const hiddenKeys = ref<Set<string>>(new Set());

//#region Group 型 — types/webCrawlGroup へ移動
export type { WebCrawlGroup as CrawlGroup } from "../../types/webCrawlGroup";
//#endregion

//#region 派生
const groups = computed<WebCrawlGroup[]>(() =>
  buildWebCrawlGroups(props.documents, hiddenKeys.value)
);

const relevantRequests = computed(() =>
  webCrawlStore.recentRequests.filter(
    (request) =>
      request.input.fileSpaceId === props.fileSpaceId &&
      request.operationMetadata.spaceId === spaceStore.selectedSpace?.id
  )
);

const folders = computed<WebCrawlFolderGroup[]>(() => {
  return buildWebCrawlFolders({
    groups: groups.value,
    requests: relevantRequests.value,
    fileSpaceId: props.fileSpaceId,
    spaceId: spaceStore.selectedSpace?.id,
  });
});
//#endregion

//#region モーダル
const onFolderClick = (folder: WebCrawlFolderGroup) => {
  void router.push({
    path: `/admin/data-source/web-folders/${encodeURIComponent(folder.folder.id)}`,
    query: props.fileSpaceId ? { fileSpaceId: props.fileSpaceId } : undefined,
  });
};
//#endregion
</script>
