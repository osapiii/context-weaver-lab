<template>
  <button
    type="button"
    class="group w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition hover:border-purple-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
    @click="emit('click')"
  >
    <div class="flex min-h-28 items-stretch">
      <div
        class="relative grid w-28 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden border-r border-purple-100 bg-purple-50 p-0.5 text-purple-700 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-300"
      >
        <template v-if="visibleUrls.length > 0">
          <div
            v-for="(url, i) in displayUrls"
            :key="`${url}-${i}`"
            class="relative overflow-hidden bg-purple-100"
          >
            <img
              :src="url"
              alt=""
              class="h-full w-full object-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onImgError(i)"
            >
            <div
              v-if="i === 3 && overflowCount > 0"
              class="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-bold tabular-nums text-white"
            >
              +{{ overflowCount }}
            </div>
          </div>
        </template>
        <template v-else>
          <div class="col-span-2 row-span-2 flex flex-col items-center justify-center gap-2">
            <USkeleton v-if="loadingThumbnails" class="h-full w-full rounded-none" />
            <template v-else>
              <UIcon name="i-heroicons-photo" class="h-8 w-8 text-purple-400/80" />
              <span class="text-[10px] font-bold tabular-nums">{{ folder.jobs.length }}</span>
            </template>
          </div>
        </template>
      </div>
      <div class="min-w-0 flex-1 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate text-sm font-bold text-slate-900 dark:text-white">
              {{ folder.folder.name }}
            </h3>
            <p class="mt-1 text-xs text-slate-500">
              {{ folder.jobs.length }}回の取り込み
            </p>
            <p
              v-if="folder.folder.description"
              class="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500"
            >
              {{ folder.folder.description }}
            </p>
          </div>
          <UIcon
            name="i-heroicons-chevron-right"
            class="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-500"
          />
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <span class="inline-flex items-center gap-1">
            <UIcon name="i-heroicons-document-text" class="h-3.5 w-3.5" />
            <b class="tabular-nums text-slate-700 dark:text-slate-200">{{ folder.pageCount }}</b>
            ページ
          </span>
          <span class="inline-flex items-center gap-1">
            <UIcon name="i-heroicons-photo" class="h-3.5 w-3.5" />
            <b class="tabular-nums text-slate-700 dark:text-slate-200">{{ folder.imageCount }}</b>
            画像
          </span>
          <span class="ml-auto text-[11px] text-slate-400">
            {{ latestText }}
          </span>
        </div>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { WebCrawlFolderGroup } from "../../types/webCrawlGroup";
import {
  collectWebCrawlGroupThumbnailSources,
  type WebCrawlThumbnailSource,
} from "@utils/webCrawlGroupThumbnails";

const props = defineProps<{ folder: WebCrawlFolderGroup }>();
const emit = defineEmits<{ click: [] }>();
const firebaseStorageOps = useFirebaseStorageOperations();
const loadingThumbnails = ref(false);
const resolvedUrls = ref<string[]>([]);
const failedIndexes = ref<Set<number>>(new Set());

const latestText = computed(() => {
  if (!props.folder.latestAt) return "";
  return props.folder.latestAt.toLocaleDateString("ja-JP");
});

const thumbnailSources = computed(() => {
  const sources: WebCrawlThumbnailSource[] = [];
  const seen = new Set<string>();
  for (const job of props.folder.jobs) {
    for (const source of collectWebCrawlGroupThumbnailSources(job, 4).sources) {
      const key =
        source.kind === "url"
          ? `url:${source.url}`
          : `gcs:${source.bucket}/${source.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push(source);
      if (sources.length >= 4) return sources;
    }
  }
  return sources;
});

const overflowCount = computed(() => Math.max(0, props.folder.imageCount - 4));

const visibleUrls = computed(() =>
  resolvedUrls.value.filter((_, i) => !failedIndexes.value.has(i))
);

const displayUrls = computed(() => visibleUrls.value.slice(0, 4));

const onImgError = (index: number) => {
  failedIndexes.value = new Set([...failedIndexes.value, index]);
};

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
      // Broken thumbnails should not block the folder list.
    }
  }
  return urls;
}

watch(
  () => props.folder.folder.id,
  async () => {
    failedIndexes.value = new Set();
    resolvedUrls.value = [];
    if (thumbnailSources.value.length === 0) return;
    loadingThumbnails.value = true;
    try {
      resolvedUrls.value = await resolveThumbnailSources(thumbnailSources.value);
    } finally {
      loadingThumbnails.value = false;
    }
  },
  { immediate: true }
);
</script>
