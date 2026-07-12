<template>
  <div class="space-y-5">
    <!-- 確認ビュー操作面 -->
    <div
      class="rounded-xl bg-white/85 p-4 shadow-sm ring-1 ring-slate-900/[0.05] backdrop-blur-sm dark:bg-gray-900/60 dark:ring-white/10"
    >
      <div
        v-if="isLoadingDocuments"
        class="space-y-5"
        aria-busy="true"
        aria-label="知識一覧を読み込み中"
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-4">
            <USkeleton class="h-12 w-12 rounded-xl" />
            <div class="space-y-2">
              <USkeleton class="h-3 w-28 rounded" />
              <USkeleton class="h-7 w-24 rounded" />
            </div>
            <div class="hidden h-10 w-px bg-gray-200 dark:bg-gray-700 sm:block" />
            <div class="space-y-2">
              <USkeleton class="h-3 w-24 rounded" />
              <USkeleton class="h-7 w-16 rounded" />
            </div>
            <div class="space-y-2">
              <USkeleton class="h-3 w-24 rounded" />
              <USkeleton class="h-7 w-16 rounded" />
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <USkeleton class="h-8 w-20 rounded-lg" />
            <USkeleton class="h-8 w-36 rounded-lg" />
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <USkeleton
            v-for="i in 6"
            :key="`category-${i}`"
            class="h-8 w-28 rounded-full"
          />
        </div>

        <div class="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/40">
          <div class="grid gap-4 sm:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]">
            <div class="space-y-2">
              <USkeleton class="h-3 w-16 rounded" />
              <div class="flex flex-wrap gap-1.5">
                <USkeleton
                  v-for="i in 3"
                  :key="`ai-${i}`"
                  class="h-7 w-28 rounded-full"
                />
              </div>
            </div>
            <div class="space-y-2">
              <USkeleton class="h-3 w-20 rounded" />
              <div class="flex flex-wrap gap-1.5">
                <USkeleton
                  v-for="i in 5"
                  :key="`source-${i}`"
                  class="h-7 w-28 rounded-full"
                />
              </div>
            </div>
          </div>
        </div>

        <USkeleton class="h-10 w-full max-w-72 rounded-xl" />
      </div>

      <template v-else>
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div class="flex items-baseline gap-1.5">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                表示中
              </span>
              <span class="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                {{ filteredAndSearchedDocuments.length }}
              </span>
              <span class="text-xs text-slate-400">/ {{ documents.length }} 件</span>
            </div>
            <div class="hidden h-5 w-px bg-slate-200 sm:block" />
            <div class="flex items-center gap-2 text-slate-500">
              <UIcon name="i-heroicons-sparkles" class="h-3.5 w-3.5 text-slate-400" />
              <span>AI登録済み</span>
              <span class="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                {{ indexedCount }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-slate-500">
              <UIcon name="i-heroicons-photo" class="h-3.5 w-3.5 text-slate-400" />
              <span>対象外</span>
              <span class="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                {{ nonIndexableCount }}
              </span>
            </div>
            <div
              v-if="pendingCount > 0"
              class="flex items-center gap-2 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200"
              title="索引できるはずなのに未登録のファイル。同期失敗の可能性"
            >
              <UIcon name="i-heroicons-exclamation-triangle" class="h-3.5 w-3.5" />
              登録待ち {{ pendingCount }}
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-heroicons-arrow-path"
              :loading="isLoadingDocuments"
              @click="$emit('refresh')"
            >
              更新
            </UButton>
            <UButton
              v-if="fileSpaceId"
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-heroicons-cloud-arrow-down"
              :loading="isLoadingDocuments"
              @click="onSyncAgentSearch"
            >
              同期
            </UButton>
          </div>
        </div>

        <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="opt in filterOptions"
              :key="opt.value"
              type="button"
              :class="categoryChipClass(filter === opt.value)"
              @click="filter = opt.value"
            >
              <span class="tabular-nums">{{ opt.label }}</span>
            </button>
          </div>

          <UInput
            v-model="searchQuery"
            placeholder="ファイル名で検索"
            icon="i-heroicons-magnifying-glass"
            size="sm"
          />
        </div>

        <div>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-800"
            @click="showAdvancedFilters = !showAdvancedFilters"
          >
            <UIcon
              name="i-heroicons-adjustments-horizontal"
              class="h-3.5 w-3.5"
            />
            詳細フィルタ
            <span v-if="hasExtraFiltersActive" class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
              適用中
            </span>
            <UIcon
              name="i-heroicons-chevron-down"
              class="h-3 w-3 transition-transform"
              :class="showAdvancedFilters ? 'rotate-180' : ''"
            />
          </button>
        </div>

        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="showAdvancedFilters"
            class="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/40 md:grid-cols-2"
          >
            <div class="min-w-0">
              <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                AI 登録
              </p>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  v-for="opt in aiStatusFilterOptions"
                  :key="opt.value"
                  type="button"
                  :class="secondaryChipClass(aiStatusFilter === opt.value)"
                  @click="aiStatusFilter = opt.value"
                >
                  <span class="tabular-nums">{{ opt.label }}</span>
                </button>
              </div>
            </div>
            <div class="min-w-0">
              <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                取り込み元
              </p>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  v-for="opt in sourceFilterOptions"
                  :key="opt.value"
                  type="button"
                  :class="secondaryChipClass(sourceFilter === opt.value)"
                  @click="sourceFilter = opt.value"
                >
                  <span class="tabular-nums">{{ opt.label }}</span>
                </button>
              </div>
            </div>
            <button
              v-if="hasExtraFiltersActive"
              type="button"
              class="self-start text-left text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline md:col-span-2"
              @click="resetExtraFilters"
            >
              条件をクリア
            </button>
          </div>
        </Transition>
      </div>

      </template>
    </div>

    <!-- カテゴリ別セクション (ローディング中は単一の skeleton セクション) -->
    <template v-if="isLoadingDocuments">
      <FileSpaceDocumentList
        :documents="[]"
        :is-loading="true"
        @delete="onDocumentDelete"
      />
    </template>
    <template v-else>
      <section
        v-for="group in groupedDocuments"
        v-show="group.docs.length > 0"
        :key="group.key"
        class="space-y-3"
      >
        <div class="flex items-center gap-2">
          <UIcon
            :name="group.icon"
            class="w-4 h-4"
            :class="group.key === filter ? 'text-slate-700' : 'text-slate-400'"
          />
          <h3 class="text-sm font-bold text-gray-700 dark:text-gray-200 tracking-tight">
            {{ group.label }}
          </h3>
          <span
            class="text-xs font-semibold text-gray-400 tabular-nums px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800"
          >
            {{ group.docs.length }}
          </span>
          <span
            v-if="group.hint"
            class="text-[11px] text-gray-400 ml-1"
          >
            {{ group.hint }}
          </span>
        </div>
        <!-- Web バケットだけは crawl 単位でグループ化したカードを出す -->
        <WebCrawlGroupList
          v-if="group.key === 'web'"
          :documents="webCrawlSessionDocumentsForGrouping"
          :is-loading="false"
          :file-space-id="fileSpaceId"
          @delete="onDocumentDelete"
          @refresh="emit('refresh')"
        />
        <FileSpaceDocumentList
          v-else
          :documents="group.docs"
          :is-loading="false"
          :layout="group.key === 'image' ? 'compact' : 'default'"
          :enable-selection="true"
          quiet-actions
          quiet-badges
          :selected-keys="selectedKeys"
          @delete="onDocumentDelete"
          @toggle="onToggleSelection"
        />
      </section>

      <!-- 全 0 件のときの empty 表示 -->
      <div
        v-if="filteredAndSearchedDocuments.length === 0"
        class="text-center py-12 text-gray-500"
      >
        <UIcon
          name="i-heroicons-document-text"
          class="w-16 h-16 mx-auto mb-4 text-gray-300"
        />
        <p>条件に一致するファイルがありません</p>
      </div>
    </template>

    <!-- 一括アクションバー (選択中のみ, 画面上部に固定で気付きやすく) -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-4"
    >
      <div
        v-if="selectedKeys.size > 0"
        class="fixed top-20 left-1/2 z-30 -translate-x-1/2 px-4 w-full max-w-full sm:w-auto sm:px-0"
      >
        <div
          class="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-purple-200 bg-white px-4 py-3 shadow-[0_8px_24px_-8px_rgba(139,92,246,0.35)]"
        >
          <div class="flex items-center gap-2">
            <span
              class="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-purple-500 px-2 text-xs font-bold text-white tabular-nums"
            >
              {{ selectedKeys.size }}
            </span>
            <span class="text-sm font-semibold text-neutral-700">
              件を選択中
            </span>
          </div>
          <div class="h-5 w-px bg-neutral-200" />
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            :disabled="selectableInFilter.length === 0"
            @click="selectAllInFiltered"
          >
            フィルタ結果を全選択
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            @click="clearSelection"
          >
            選択解除
          </UButton>
          <div class="h-5 w-px bg-neutral-200" />
          <UButton
            color="error"
            variant="solid"
            size="sm"
            icon="i-heroicons-trash"
            :loading="isBulkDeleting"
            @click="onBulkDeleteRequest"
          >
            {{ selectedKeys.size }} 件を一括削除
          </UButton>
        </div>
      </div>
    </Transition>

    <!-- 一括削除確認モーダル -->
    <UModal v-model:open="isBulkDeleteModalOpen">
      <template #content>
        <div class="p-6 space-y-4">
          <div class="flex items-start gap-3">
            <div
              class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rose-50 ring-1 ring-rose-200"
            >
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="h-5 w-5 text-rose-600"
              />
            </div>
            <div class="min-w-0">
              <h3 class="text-base font-bold text-neutral-900">
                {{ selectedKeys.size }} 件のファイルを削除しますか?
              </h3>
              <p class="mt-1 text-sm text-neutral-600">
                AI 索引 / 内部ストレージ / メタデータ を削除します.
                <span class="font-semibold">Google Drive 側のファイル本体は無傷</span>
                なので、Drive に元ファイルが残っていれば再同期で復活します.
              </p>
            </div>
          </div>

          <!-- 対象ファイルプレビュー (最大 5 件) -->
          <div
            class="max-h-40 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700"
          >
            <ul class="space-y-1">
              <li
                v-for="(doc, i) in selectedDocumentsPreview"
                :key="i"
                class="truncate"
              >
                · {{ getDocumentDisplayName(doc) }}
              </li>
              <li
                v-if="selectedKeys.size > selectedDocumentsPreview.length"
                class="text-neutral-400"
              >
                … 他 {{ selectedKeys.size - selectedDocumentsPreview.length }} 件
              </li>
            </ul>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              :disabled="isBulkDeleting"
              @click="isBulkDeleteModalOpen = false"
            >
              キャンセル
            </UButton>
            <UButton
              color="error"
              variant="solid"
              :loading="isBulkDeleting"
              icon="i-heroicons-trash"
              @click="onBulkDeleteConfirm"
            >
              {{ selectedKeys.size }} 件を削除
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import FileSpaceDocumentList from "@components/FileSpaceDocumentList.vue";
import WebCrawlGroupList from "@components/dataSource/WebCrawlGroupList.vue";
import {
  classifyWebCrawlDocumentCategory,
  isWebCrawlSessionDocument,
} from "@utils/webCrawlDocumentKind";
import {
  countForAiStatusFilter,
  countForCategoryFilter,
  countForSourceFilter,
  filterKnowledgeDocuments,
  type KnowledgeAiStatusFilter,
  type KnowledgeCategoryFilter,
  type KnowledgeSourceFilter,
} from "@utils/knowledgeDocumentFilters";
import { useKnowledgeOperator } from "@composables/useKnowledgeOperator";
import type { Document } from "@models/geminiFileSpaceRequest";
import {
  isKnowledgeIndexed,
  isKnowledgePlaceholder,
} from "@utils/knowledge";
import { useAgentSearchSync } from "@composables/useAgentSearchSync";

const props = defineProps<{
  fileSpaceId: string | null;
  documents: Document[];
  isLoadingDocuments: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const toast = useToast();
const { deleteKnowledge, deleteKnowledgeBulk } = useKnowledgeOperator();
const { syncFileSpaceWithAgentSearch } = useAgentSearchSync();

const onSyncAgentSearch = async () => {
  if (!props.fileSpaceId) return;
  await syncFileSpaceWithAgentSearch(props.fileSpaceId, {
    onCompleted: () => emit("refresh"),
  });
};
// 種別フィルタは category ベース (ファイル拡張子で判定)
type FilterValue = KnowledgeCategoryFilter;

// デフォルトは「すべて」(ユーザー指示: ドキュメント / Web / 画像 / 動画 を横断で
// 一覧したい場面が多いため、特定種別に絞らない方が初期状態として自然).
const filter = ref<FilterValue>("all");
const aiStatusFilter = ref<KnowledgeAiStatusFilter>("all");
const sourceFilter = ref<KnowledgeSourceFilter>("all");
const searchQuery = ref("");
const showAdvancedFilters = ref(false);

const FILTER_OPTION_DEFS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "document", label: "ドキュメント" },
  { value: "image", label: "画像" },
  { value: "video", label: "動画" },
  { value: "web", label: "Web" },
];

const filterState = computed(() => ({
  category: filter.value,
  aiStatus: aiStatusFilter.value,
  source: sourceFilter.value,
  searchQuery: searchQuery.value,
}));

const filteredAndSearchedDocuments = computed(() =>
  filterKnowledgeDocuments(
    props.documents,
    filterState.value,
    classifyDocument
  )
);

const hasExtraFiltersActive = computed(
  () => aiStatusFilter.value !== "all" || sourceFilter.value !== "all"
);

const resetExtraFilters = (): void => {
  aiStatusFilter.value = "all";
  sourceFilter.value = "all";
};

const categoryChipClass = (active: boolean): string => [
  "group/chip relative rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-all duration-150",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
  active
    ? "bg-slate-900 text-white ring-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-100"
    : "bg-white/80 text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-gray-800/70 dark:text-gray-400 dark:ring-gray-700",
].join(" ");

type SecondaryChipTone = "purple" | "sky" | "violet" | "cyan" | "slate";

const secondaryChipClass = (
  active: boolean
): string => {
  return [
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1",
    active
      ? "bg-slate-800 text-white ring-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-100"
      : "bg-white/80 text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-gray-800/70 dark:text-gray-400 dark:ring-gray-700",
  ].join(" ");
};

const crossFilterForCategory = computed(() => ({
  aiStatus: aiStatusFilter.value,
  source: sourceFilter.value,
}));

const crossFilterForAi = computed(() => ({
  category: filter.value,
  source: sourceFilter.value,
}));

const crossFilterForSource = computed(() => ({
  category: filter.value,
  aiStatus: aiStatusFilter.value,
}));

// 内訳 (documents 全体ベース)
// Phase R-1c で 3 分類化, Phase R-1d で knowledge helper に統一:
//   1. AI に登録済み: isKnowledgeIndexed(d) === true
//   2. AI 検索対象外: 動画 / 音声、および Agent Search 非対応の画像形式 (webp/svg 等)
//   3. 登録待ち: indexable 形式なのに placeholder のまま (= 同期で何か失敗した状態) — 要対応
const _isIndexableType = (d: Document): boolean => {
  const c = classifyDocument(d);
  if (c === "video" || c === "audio") return false;
  if (c === "image") {
    const mime = (d.mimeType || "").toLowerCase();
    const name = (d.displayName || d.name || "").toLowerCase();
    if (/\.(webp|svg|heic|heif|avif)$/.test(name)) return false;
    if (
      mime === "image/webp" ||
      mime === "image/svg+xml" ||
      mime === "image/avif"
    ) {
      return false;
    }
    return true;
  }
  return true;
};

const indexedCount = computed(
  () => props.documents.filter((d) => isKnowledgeIndexed(d)).length
);

// 仕様上 AI 検索の対象外 (画像/動画/音声): 残留扱いしない
const nonIndexableCount = computed(
  () =>
    props.documents.filter(
      (d) => isKnowledgePlaceholder(d) && !_isIndexableType(d)
    ).length
);

// 本来 AI 索引できるはずなのに未登録 = 実際の action item
const pendingCount = computed(
  () =>
    props.documents.filter(
      (d) => isKnowledgePlaceholder(d) && _isIndexableType(d)
    ).length
);

// (旧 `placeholderCount` を削除した。テンプレからの参照は無し)

// === ファイル種別ごとの分類 ===
type FileCategory =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "web"
  | "other";

const classifyDocument = (doc: Document): FileCategory => {
  const name = (doc.displayName || doc.name || "").toLowerCase();
  const mime = (doc.mimeType || "").toLowerCase();

  // 1) Web クローラ由来: Markdown ページのみ "web"、画像は "image" (カードプレビュー用に同一セッションは別途渡す)
  const webCrawlKind = classifyWebCrawlDocumentCategory(doc);
  if (webCrawlKind === "web" || webCrawlKind === "image" || webCrawlKind === "other") {
    return webCrawlKind;
  }

  // 2) 拡張子で確定する
  if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif|tiff?)$/.test(name)) return "image";
  if (/\.(mp4|mov|avi|mkv|webm|m4v)$/.test(name)) return "video";
  if (/\.(mp3|wav|m4a|ogg|flac|aac)$/.test(name)) return "audio";
  if (/\.(zip|rar|7z|tar|gz|tgz)$/.test(name)) return "archive";
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|md|html?|csv|json|xml|odt|ods|odp|rtf)$/.test(name))
    return "document";

  // 3) 拡張子で確定しない場合は mime で
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/zip" || mime === "application/x-tar") return "archive";
  if (
    mime === "application/pdf" ||
    mime.startsWith("text/") ||
    mime.includes("officedocument") ||
    mime.includes("msword") ||
    mime.includes("ms-excel") ||
    mime.includes("ms-powerpoint") ||
    mime === "application/json"
  )
    return "document";

  return "other";
};

const filterOptions = computed(() =>
  FILTER_OPTION_DEFS.map((opt) => ({
    value: opt.value,
    label: `${opt.label} (${countForCategoryFilter(
      props.documents,
      opt.value,
      crossFilterForCategory.value,
      classifyDocument
    )})`,
  }))
);

const aiStatusFilterOptions = computed(() => {
  const defs: {
    value: KnowledgeAiStatusFilter;
    label: string;
    icon?: string;
    activeTone: SecondaryChipTone;
  }[] = [
    { value: "all", label: "すべて", activeTone: "slate" },
    {
      value: "indexed",
      label: "AI登録済み",
      icon: "i-heroicons-sparkles",
      activeTone: "purple",
    },
    {
      value: "unregistered",
      label: "未登録",
      icon: "i-heroicons-minus-circle",
      activeTone: "slate",
    },
  ];
  return defs.map((opt) => ({
    ...opt,
    label: `${opt.label} (${countForAiStatusFilter(
      props.documents,
      opt.value,
      crossFilterForAi.value,
      classifyDocument
    )})`,
  }));
});

const sourceFilterOptions = computed(() => {
  const defs: {
    value: KnowledgeSourceFilter;
    label: string;
    icon?: string;
    activeTone: SecondaryChipTone;
  }[] = [
    { value: "all", label: "すべて", activeTone: "slate" },
    {
      value: "upload",
      label: "アップロード",
      icon: "material-symbols:upload-file",
      activeTone: "slate",
    },
    {
      value: "drive",
      label: "Drive",
      icon: "logos:google-drive",
      activeTone: "sky",
    },
    {
      value: "web",
      label: "Web",
      icon: "material-symbols:language",
      activeTone: "cyan",
    },
  ];
  return defs.map((opt) => ({
    ...opt,
    label: `${opt.label} (${countForSourceFilter(
      props.documents,
      opt.value,
      crossFilterForSource.value,
      classifyDocument
    )})`,
  }));
});

type DocumentGroup = {
  key: FileCategory;
  label: string;
  icon: string;
  iconColor: string;
  hint?: string;
  docs: Document[];
};

/** Web カード用: フィルタに合うセッションの markdown+画像をすべて渡す (プレビュー用) */
const webCrawlSessionDocumentsForGrouping = computed(() => {
  const sessions = props.documents.filter(isWebCrawlSessionDocument);
  const visibleKeys = new Set<string>();
  for (const d of filteredAndSearchedDocuments.value) {
    if (!isWebCrawlSessionDocument(d)) continue;
    const key = d.webCrawlRequestId || d.gcsPrefix;
    if (key) visibleKeys.add(key);
  }
  if (visibleKeys.size === 0) return [];
  return sessions.filter((d) => {
    const key = d.webCrawlRequestId || d.gcsPrefix;
    return key ? visibleKeys.has(key) : false;
  });
});

const groupedDocuments = computed<DocumentGroup[]>(() => {
  const buckets: Record<FileCategory, Document[]> = {
    document: [],
    image: [],
    video: [],
    audio: [],
    archive: [],
    web: [],
    other: [],
  };
  for (const doc of filteredAndSearchedDocuments.value) {
    const category = classifyDocument(doc);
    buckets[category].push(doc);
  }
  const groups: DocumentGroup[] = [];
  groups.push(
    {
      key: "document",
      label: "ドキュメント",
      icon: "i-heroicons-document-text",
      iconColor: "text-purple-500",
      hint: "PDF / Office / テキスト・Gemini で本文検索可能",
      docs: buckets.document,
    },
    {
      key: "web",
      label: "Web ページ",
      icon: "i-heroicons-globe-alt",
      iconColor: "text-sky-500",
      docs: buckets.web,
    },
    {
      key: "image",
      label: "画像",
      icon: "i-heroicons-photo",
      iconColor: "text-violet-500",
      hint: "Drive / Web 取り込みの画像 (プレビュー・閲覧用)",
      docs: buckets.image,
    },
    {
      key: "video",
      label: "動画",
      icon: "i-heroicons-video-camera",
      iconColor: "text-rose-500",
      hint: "AI 検索の対象外",
      docs: buckets.video,
    },
    {
      key: "audio",
      label: "音声",
      icon: "i-heroicons-musical-note",
      iconColor: "text-violet-500",
      hint: "AI 検索の対象外",
      docs: buckets.audio,
    },
    {
      key: "archive",
      label: "アーカイブ",
      icon: "i-heroicons-archive-box",
      iconColor: "text-purple-500",
      hint: "AI 検索の対象外",
      docs: buckets.archive,
    },
    {
      key: "other",
      label: "その他",
      icon: "i-heroicons-document",
      iconColor: "text-gray-400",
      docs: buckets.other,
    }
  );
  return groups;
});

// === Single document delete (個別削除ボタン経由) ===
// Phase R-1d: useKnowledgeOperator に委譲. 内部で Gemini 索引 + GCS 原ファイル +
// Firestore メタデータ を 3 層カスケード削除する. Drive 側のファイル本体は触らない.
const onDocumentDelete = async (doc: Document) => {
  if (!props.fileSpaceId) return;
  const result = await deleteKnowledge(doc, { storeId: props.fileSpaceId });
  if (result.ok) {
    toast.add({
      title: "削除リクエストを送信しました",
      color: "info",
    });
    emit("refresh");
  } else {
    toast.add({
      title: "削除に失敗しました",
      description: result.error.slice(0, 160),
      color: "error",
    });
  }
};

// === Bulk selection ===
/** 親と一致する一意キー (FileSpaceDocumentList.documentKey と同じロジック) */
const documentKey = (doc: Document): string =>
  (doc.id as string | undefined) || doc.name || "";

const selectedKeys = ref<Set<string>>(new Set());

const onToggleSelection = (doc: Document) => {
  const key = documentKey(doc);
  if (!key) return;
  const next = new Set(selectedKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  selectedKeys.value = next;
};

const clearSelection = () => {
  selectedKeys.value = new Set();
};

/** 現在のフィルタ + 検索結果から、選択可能なものを抽出 */
const selectableInFilter = computed<Document[]>(() => {
  return filteredAndSearchedDocuments.value;
});

const selectAllInFiltered = () => {
  const next = new Set(selectedKeys.value);
  for (const d of selectableInFilter.value) {
    const k = documentKey(d);
    if (k) next.add(k);
  }
  selectedKeys.value = next;
};

/** 選択中の Document インスタンス (props.documents から逆引き) */
const selectedDocuments = computed<Document[]>(() =>
  props.documents.filter((d) => selectedKeys.value.has(documentKey(d)))
);

const selectedDocumentsPreview = computed<Document[]>(() =>
  selectedDocuments.value.slice(0, 5)
);

const getDocumentDisplayName = (doc: Document): string => {
  return (
    doc.originalFileInfo?.fileName ||
    doc.displayName ||
    (doc.name ? doc.name.split("/").pop() || doc.name : "無題")
  );
};

const isBulkDeleteModalOpen = ref(false);
const isBulkDeleting = ref(false);

const onBulkDeleteRequest = () => {
  if (selectedKeys.value.size === 0) return;
  isBulkDeleteModalOpen.value = true;
};

const onBulkDeleteConfirm = async () => {
  if (!props.fileSpaceId) {
    toast.add({ title: "FileSpace 未解決", color: "error" });
    return;
  }
  const targets = selectedDocuments.value;
  if (targets.length === 0) {
    isBulkDeleteModalOpen.value = false;
    return;
  }

  isBulkDeleting.value = true;
  // Phase R-1d: useKnowledgeOperator.deleteKnowledgeBulk に委譲. context 解決 +
  // 並列実行 + 集計を内部でやってくれる.
  const { success: okCount, fail: failCount } = await deleteKnowledgeBulk(
    targets,
    { storeId: props.fileSpaceId }
  );

  isBulkDeleting.value = false;
  isBulkDeleteModalOpen.value = false;
  clearSelection();
  emit("refresh");

  if (failCount === 0) {
    toast.add({
      title: `${okCount} 件の削除リクエストを送信しました`,
      color: "info",
    });
  } else if (okCount === 0) {
    toast.add({
      title: `${failCount} 件すべて削除に失敗しました`,
      color: "error",
    });
  } else {
    toast.add({
      title: `${okCount} 件成功 / ${failCount} 件失敗`,
      color: "warning",
    });
  }
};

// 種別フィルタ切替時は選択を空にする (表示外の選択を残すと "5 件選択中" の
// カウントとカード上の選択状態がズレてユーザーが混乱するため).
// 検索クエリ変更ではクリアしない (キーストロークごとに消えると不快).
watch(
  () => filter.value,
  () => {
    if (selectedKeys.value.size > 0) clearSelection();
  }
);

</script>
