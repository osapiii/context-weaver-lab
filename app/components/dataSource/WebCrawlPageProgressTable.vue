<template>
  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900/40 dark:ring-white/10"
  >
    <div
      class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-slate-50/90 to-white px-5 py-3.5 dark:border-white/10 dark:from-slate-900/60 dark:to-slate-900/40"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:ring-white/10"
        >
          <UIcon
            name="i-heroicons-globe-alt"
            class="h-4 w-4 text-purple-600 dark:text-purple-400"
          />
        </div>
        <div>
          <p class="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
            ページごとの進捗
          </p>
          <p class="text-[11px] text-gray-500">
            各 URL が 4 段階を順に通過します
          </p>
        </div>
        <EnBadge variant="soft" color="warning" size="xs">
          {{
            isPreparing
              ? WEB_CRAWL_IMPORT_USER_LABELS.preparing.badge
              : isDiscovering
                ? WEB_CRAWL_IMPORT_USER_LABELS.discovering.badge
                : `${rows.length} 件`
          }}
        </EnBadge>
      </div>
    </div>

    <div
      v-if="isAwaitingPageList"
      class="flex shrink-0 items-start gap-2 border-b px-5 py-2.5"
      :class="
        isPreparing
          ? 'border-slate-200/80 bg-slate-50/90 dark:border-white/10 dark:bg-white/5'
          : 'border-purple-100/80 bg-purple-50/70 dark:border-purple-900/30 dark:bg-purple-950/20'
      "
    >
      <UIcon
        :name="
          isPreparing
            ? 'i-heroicons-cog-6-tooth'
            : 'i-heroicons-magnifying-glass-circle'
        "
        class="mt-0.5 h-4 w-4 shrink-0"
        :class="
          isPreparing
            ? 'animate-spin text-slate-500'
            : 'animate-pulse text-purple-600'
        "
      />
      <p
        class="text-[11px] leading-snug"
        :class="
          isPreparing
            ? 'text-slate-700 dark:text-slate-200'
            : 'text-purple-900 dark:text-purple-100'
        "
      >
        {{
          isPreparing
            ? WEB_CRAWL_IMPORT_USER_LABELS.preparing.banner
            : WEB_CRAWL_IMPORT_USER_LABELS.discovering.banner
        }}
      </p>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <table class="w-full min-w-[860px] xl:min-w-0 table-fixed border-collapse text-left">
        <colgroup>
          <col class="w-auto" />
          <col
            v-for="col in columns"
            :key="`col-${col.id}`"
            class="w-[6.5rem]"
          />
        </colgroup>
        <thead class="sticky top-0 z-10 bg-white/95 backdrop-blur dark:bg-slate-900/95">
          <tr class="border-b border-slate-100 dark:border-white/10">
            <th
              scope="col"
              class="max-w-0 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
            >
              URL / ページ
            </th>
            <th
              v-for="col in columns"
              :key="col.id"
              scope="col"
              class="w-[6.5rem] shrink-0 px-2 py-3 text-center text-[10px] font-semibold leading-tight tracking-wide text-gray-500"
            >
              <span class="block whitespace-nowrap">{{ col.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.pageId"
            class="group border-b border-slate-100/80 transition-colors last:border-b-0 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.02]"
            :class="[
              webCrawlPageRowIsActive(row)
                ? 'bg-purple-50/40 dark:bg-purple-950/20'
                : '',
              row.isPlaceholder ? 'opacity-70' : '',
            ]"
          >
            <td class="max-w-0 overflow-hidden px-5 py-3.5 align-middle">
              <WebCrawlPagePreviewCell
                :label="row.label"
                :url="row.url"
                :description="row.description"
                :image-url="row.imageUrl"
                :thumbnail-gcs-path="row.thumbnailGcsPath"
                :thumbnail-bucket="row.thumbnailBucket"
                :is-placeholder="row.isPlaceholder"
                :is-entry-seed="row.isEntrySeed"
              >
                <template
                  v-if="
                    row.errorMessage ||
                    (!row.url && !row.isPlaceholder && !row.label.includes('…'))
                  "
                  #footer
                >
                  <p
                    v-if="!row.url && !row.isPlaceholder && !row.label.includes('…')"
                    class="mt-0.5 font-mono text-[10px] text-gray-400"
                  >
                    {{ shortWebCrawlPageId(row.pageId) }}
                  </p>
                  <p
                    v-if="row.errorMessage"
                    class="mt-1 break-words text-[11px] leading-snug text-rose-600"
                  >
                    {{ row.errorMessage }}
                  </p>
                </template>
              </WebCrawlPagePreviewCell>
            </td>
            <td
              v-for="(col, colIndex) in columns"
              :key="`${row.pageId}-${col.id}`"
              class="w-[6.5rem] shrink-0 px-2 py-3.5 text-center align-middle"
            >
              <div class="relative inline-flex items-center justify-center">
                <span
                  v-if="colIndex > 0"
                  class="pointer-events-none absolute right-[calc(50%+1.375rem)] top-1/2 hidden h-px w-6 -translate-y-1/2 bg-slate-200 sm:block"
                  aria-hidden="true"
                />
                <div
                  class="relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300"
                  :class="webCrawlPageColumnCellClass(row.columns[col.id])"
                  :title="`${col.label}: ${stageStatusLabel(row.columns[col.id])}`"
                >
                  <span
                    v-if="row.columns[col.id] === 'running'"
                    class="absolute inset-0 animate-ping rounded-full bg-purple-200/60"
                    aria-hidden="true"
                  />
                  <UIcon
                    :name="webCrawlPageColumnIcon(row.columns[col.id])"
                    class="relative h-4 w-4"
                    :class="[
                      webCrawlPageColumnTone(row.columns[col.id]),
                      row.columns[col.id] === 'running' ? 'animate-spin' : '',
                    ]"
                  />
                </div>
              </div>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td
              :colspan="columns.length + 1"
              class="px-5 py-16 text-center"
            >
              <div class="mx-auto flex max-w-sm flex-col items-center gap-2">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"
                >
                  <UIcon name="i-heroicons-globe-alt" class="h-6 w-6" />
                </div>
                <p class="text-sm font-medium text-gray-700">
                  対象ページを確認しています
                </p>
                <p class="text-[11px] text-gray-500">
                  取り込み開始後、ここに 1 行 = 1 URL で進捗が表示されます
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import EnBadge from "@components/EnBadge.vue";
import WebCrawlPagePreviewCell from "@components/dataSource/WebCrawlPagePreviewCell.vue";
import { WEB_CRAWL_IMPORT_USER_LABELS } from "@constants/webCrawlImportUserLabels";
import {
  WEB_CRAWL_PAGE_COLUMNS,
  shortWebCrawlPageId,
  webCrawlPageColumnCellClass,
  webCrawlPageColumnIcon,
  webCrawlPageColumnTone,
  webCrawlPageRowIsActive,
  type WebCrawlPageColumnStatus,
  type WebCrawlPageRow,
} from "@utils/webCrawlPageRows";

defineProps<{
  rows: WebCrawlPageRow[];
  isAwaitingPageList?: boolean;
  isDiscovering?: boolean;
  isPreparing?: boolean;
}>();

const columns = WEB_CRAWL_PAGE_COLUMNS;

function stageStatusLabel(status: WebCrawlPageColumnStatus): string {
  switch (status) {
    case "completed":
      return "完了";
    case "running":
      return "処理中";
    case "error":
      return "失敗";
    case "skipped":
      return "スキップ";
    default:
      return "待機";
  }
}
</script>
