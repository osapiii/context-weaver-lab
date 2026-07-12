<template>
  <div class="flex min-w-0 items-start gap-3">
    <div
      class="flex shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1"
      :class="[
        thumbnailSizeClass,
        thumbnailBoxClass,
      ]"
    >
      <UIcon
        v-if="isPlaceholder"
        name="i-heroicons-ellipsis-horizontal"
        class="h-5 w-5 text-slate-300"
      />
      <UIcon
        v-else-if="isEntrySeed"
        name="i-heroicons-map-pin"
        class="h-5 w-5"
      />
      <img
        v-else-if="resolvedImageUrl"
        :src="resolvedImageUrl"
        :alt="label"
        class="h-full w-full object-cover"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="onThumbnailError"
      />
      <UIcon
        v-else
        name="i-heroicons-link"
        class="h-5 w-5"
      />
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 items-center gap-2">
        <span
          v-if="index != null"
          class="shrink-0 text-[10px] font-mono tabular-nums text-gray-400"
        >
          {{ index }}
        </span>
        <p
          class="min-w-0 truncate font-medium leading-snug text-gray-900 dark:text-gray-100"
          :class="[
            titleSizeClass,
            isPlaceholder ? 'text-gray-400' : '',
            muted ? 'text-gray-500 dark:text-gray-400' : '',
          ]"
          :title="label"
        >
          {{ label }}
        </p>
        <EnBadge
          v-if="isEntrySeed"
          variant="soft"
          color="info"
          size="xs"
        >
          入口
        </EnBadge>
        <slot name="badges" />
      </div>
      <p
        v-if="displayDescription"
        class="mt-0.5 line-clamp-1 text-[11px] leading-snug text-gray-500"
        :title="description ?? undefined"
      >
        {{ displayDescription }}
      </p>
      <p
        v-if="url"
        class="mt-0.5 truncate font-mono text-[10px] text-gray-400"
        :title="url"
      >
        {{ truncateWebCrawlDisplayUrl(url) }}
      </p>
      <p
        v-else-if="isPlaceholder"
        class="mt-1 h-2.5 w-40 max-w-full animate-pulse rounded bg-slate-200/80 dark:bg-white/10"
        aria-hidden="true"
      />
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import EnBadge from "@components/EnBadge.vue";
import { useFirebaseStorageOperations } from "@composables/firebase-storage-operations";
import {
  truncateWebCrawlDisplayUrl,
  truncateWebCrawlPageDescription,
} from "@utils/webCrawlPageRows";

const props = withDefaults(
  defineProps<{
    label: string;
    url?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    thumbnailGcsPath?: string | null;
    thumbnailBucket?: string | null;
    isPlaceholder?: boolean;
    isEntrySeed?: boolean;
    muted?: boolean;
    index?: number | null;
    size?: "md" | "sm";
  }>(),
  {
    url: null,
    description: null,
    imageUrl: null,
    thumbnailGcsPath: null,
    thumbnailBucket: null,
    isPlaceholder: false,
    isEntrySeed: false,
    muted: false,
    index: null,
    size: "md",
  }
);

const firebaseStorageOps = useFirebaseStorageOperations();
const gcsThumbnailUrl = ref<string | null>(null);
const ogImageFailed = ref(false);

const displayDescription = computed(() => {
  const raw = props.description?.trim();
  if (!raw) return null;
  return truncateWebCrawlPageDescription(raw);
});

const thumbnailSizeClass = computed(() =>
  props.size === "sm" ? "h-9 w-9" : "h-10 w-10"
);

const titleSizeClass = computed(() =>
  props.size === "sm" ? "text-[12px]" : "text-[13px]"
);

const thumbnailBoxClass = computed(() => {
  if (props.isPlaceholder) {
    return "animate-pulse bg-slate-100 ring-slate-200 dark:bg-white/5 dark:ring-white/10";
  }
  if (props.isEntrySeed) {
    return "bg-sky-50 text-sky-600 ring-sky-100";
  }
  return "bg-purple-50 text-purple-600 ring-purple-100";
});

const resolvedImageUrl = computed((): string | null => {
  if (props.isPlaceholder || props.isEntrySeed) return null;
  const og = props.imageUrl?.trim();
  if (og && /^https?:\/\//i.test(og) && !ogImageFailed.value) return og;
  return gcsThumbnailUrl.value;
});

function onThumbnailError() {
  if (props.imageUrl && !ogImageFailed.value) {
    ogImageFailed.value = true;
  }
}

watch(
  () => [props.thumbnailBucket, props.thumbnailGcsPath] as const,
  async ([bucket, path]) => {
    gcsThumbnailUrl.value = null;
    ogImageFailed.value = false;
    if (!bucket || !path) return;
    try {
      const url = await firebaseStorageOps.getAuthenticatedUrl({
        bucketName: bucket,
        filePath: path,
      });
      if (url) gcsThumbnailUrl.value = url;
    } catch {
      // アイコン表示のまま
    }
  },
  { immediate: true }
);
</script>
