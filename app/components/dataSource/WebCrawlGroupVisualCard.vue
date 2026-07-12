<template>
  <div
    class="relative group/card"
    :class="{ 'pointer-events-none': deleting }"
  >
    <button
      type="button"
      class="block w-full cursor-pointer overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-purple-300 dark:bg-gray-900 dark:ring-gray-800"
      :class="{ 'ring-rose-300 dark:ring-rose-700': deleting }"
      @click="emit('click')"
    >
      <!-- サムネモザイク -->
      <div
        class="relative aspect-[16/10] w-full overflow-hidden border-b border-slate-100 bg-slate-100 dark:border-gray-800 dark:bg-gray-800"
      >
        <div
          v-if="visibleUrls.length === 0 && !loadingThumbnails"
          class="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/30"
        >
          <UIcon
            name="i-heroicons-globe-alt"
            class="h-10 w-10 text-purple-400/80"
          />
          <span class="text-[10px] font-medium text-purple-700/70 dark:text-purple-300/70">
            プレビューなし
          </span>
        </div>

        <div
          v-else-if="loadingThumbnails && visibleUrls.length === 0"
          class="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 p-0.5"
        >
          <USkeleton
            v-for="i in 4"
            :key="i"
            class="h-full w-full rounded-sm"
          />
        </div>

        <!-- 1 枚: 全面 -->
        <div
          v-else-if="visibleUrls.length === 1"
          class="h-full w-full"
        >
          <img
            :src="visibleUrls[0]"
            alt=""
            class="h-full w-full object-cover"
            loading="lazy"
            referrerpolicy="no-referrer"
            @error="onImgError(0)"
          />
        </div>

        <!-- 2 枚: 左右 -->
        <div
          v-else-if="visibleUrls.length === 2"
          class="grid h-full w-full grid-cols-2 gap-0.5 p-0.5"
        >
          <div
            v-for="(url, i) in visibleUrls"
            :key="i"
            class="overflow-hidden bg-slate-200 dark:bg-gray-700"
          >
            <img
              :src="url"
              alt=""
              class="h-full w-full object-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onImgError(i)"
            />
          </div>
        </div>

        <!-- 3 枚以上: 2x2 タイル (+N) -->
        <div
          v-else
          class="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 p-0.5"
        >
          <div
            v-for="(url, i) in displayUrls"
            :key="i"
            class="relative overflow-hidden bg-slate-200 dark:bg-gray-700"
          >
            <img
              v-if="url"
              :src="url"
              alt=""
              class="h-full w-full object-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onImgError(i)"
            />
            <div
              v-if="i === 3 && overflowCount > 0"
              class="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-bold tabular-nums text-white"
            >
              +{{ overflowCount }}
            </div>
          </div>
        </div>

        <!-- 上端アクセント -->
        <div
          class="pointer-events-none absolute inset-x-0 top-0 h-0.5"
          :class="
            deleting
              ? 'bg-rose-500'
              : 'bg-gradient-to-r from-purple-400 to-violet-500'
          "
        />
      </div>

      <!-- テキスト + メタ -->
      <div class="space-y-1 px-3.5 py-3">
        <h3
          class="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-white"
          :title="group.title"
        >
          {{ group.title || group.hostname || "(無題)" }}
        </h3>
        <p
          class="truncate font-mono text-[11px] text-gray-400"
          :title="group.entryUrl ?? ''"
        >
          {{ group.hostname || group.entryUrl || "" }}
        </p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-gray-500">
          <span
            v-if="group.markdownCount > 0"
            class="inline-flex items-center gap-1"
            :title="`${group.markdownCount} ページ`"
          >
            <UIcon
              name="i-heroicons-document-text"
              class="h-3 w-3 text-gray-400"
            />
            <span class="font-medium tabular-nums">{{ group.markdownCount }}</span>
          </span>
          <span
            v-if="group.imageCount > 0"
            class="inline-flex items-center gap-1"
            :title="`${group.imageCount} 画像`"
          >
            <UIcon
              name="i-heroicons-photo"
              class="h-3 w-3 text-gray-400"
            />
            <span class="font-medium tabular-nums">{{ group.imageCount }}</span>
          </span>
          <span
            v-if="group.indexedCount > 0"
            class="inline-flex items-center gap-1"
            :title="`${group.indexedCount} 件が AI 検索可`"
          >
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" />
            <span class="font-medium tabular-nums text-purple-700 dark:text-purple-400">
              AI {{ group.indexedCount }}
            </span>
          </span>
          <span
            v-if="group.createdAtText"
            class="ml-auto text-[10px] text-gray-400"
          >
            {{ group.createdAtText }}
          </span>
        </div>
      </div>
    </button>

    <!-- 削除中オーバーレイ -->
    <div
      v-if="deleting"
      class="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-white/80 backdrop-blur-[1px] dark:bg-gray-900/80"
    >
      <UIcon
        name="i-heroicons-trash"
        class="h-4 w-4 animate-pulse text-rose-600"
      />
      <span class="text-sm font-semibold text-rose-700 dark:text-rose-300">
        削除中...
      </span>
      <UIcon
        name="svg-spinners:3-dots-bounce"
        class="h-4 w-4 text-rose-600"
      />
    </div>

    <EnButton
      variant="ghost"
      color="error"
      size="xs"
      leading-icon="i-heroicons-trash"
      class="absolute right-2 top-2 z-20 opacity-40 transition-opacity group-hover/card:opacity-100"
      :loading="deleting"
      @click.stop="emit('delete')"
    />
  </div>
</template>

<script setup lang="ts">
import type { WebCrawlGroup } from "@types/webCrawlGroup";
import {
  collectWebCrawlGroupThumbnailSources,
  type WebCrawlThumbnailSource,
} from "@utils/webCrawlGroupThumbnails";

const props = defineProps<{
  group: WebCrawlGroup;
  deleting?: boolean;
}>();

const emit = defineEmits<{
  click: [];
  delete: [];
}>();

const firebaseStorageOps = useFirebaseStorageOperations();
const loadingThumbnails = ref(false);
const resolvedUrls = ref<string[]>([]);
const failedIndexes = ref<Set<number>>(new Set());

const tileMeta = computed(() =>
  collectWebCrawlGroupThumbnailSources(props.group, 4)
);

const overflowCount = computed(() =>
  Math.max(0, props.group.imageCount - 4)
);

const visibleUrls = computed(() =>
  resolvedUrls.value.filter((_, i) => !failedIndexes.value.has(i))
);

const displayUrls = computed(() => visibleUrls.value.slice(0, 4));

async function resolveThumbnailSources(
  sources: WebCrawlThumbnailSource[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const source of sources) {
    if (source.kind === "url") {
      urls.push(source.url);
      continue;
    }
    try {
      const url = await firebaseStorageOps.getAuthenticatedUrl({
        bucketName: source.bucket,
        filePath: source.path,
      });
      if (url) urls.push(url);
    } catch {
      // skip broken tile
    }
  }
  return urls;
}

const onImgError = (index: number) => {
  failedIndexes.value = new Set([...failedIndexes.value, index]);
};

watch(
  () => props.group.key,
  async () => {
    failedIndexes.value = new Set();
    resolvedUrls.value = [];
    const { sources } = tileMeta.value;
    if (sources.length === 0) return;
    loadingThumbnails.value = true;
    try {
      resolvedUrls.value = await resolveThumbnailSources(sources);
    } finally {
      loadingThumbnails.value = false;
    }
  },
  { immediate: true }
);
</script>
