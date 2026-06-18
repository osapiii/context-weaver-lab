<template>
  <EnModal
    v-model:open="modalOpen"
    :title="modeConfig.title"
    :subtitle="modeConfig.subtitle"
    :title-icon="modeConfig.titleIcon"
    size="full"
    :header-variant="modeConfig.headerVariant"
    padding="md"
    :ui="{
      overlay: 'z-[70]',
      content: 'z-[70] sm:max-w-5xl lg:max-w-6xl',
    }"
  >
    <div class="flex min-h-[420px] flex-col gap-4 lg:min-h-[520px]">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="relative min-w-0 flex-1">
          <UIcon
            name="material-symbols:search"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="search"
            placeholder="資料名・説明・URL で検索…"
            class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
        </div>
        <p class="text-xs text-slate-500">
          最大 {{ maxSelection }} 件 · 索引済み {{ selectableCount }} 件
        </p>
      </div>

      <div
        v-if="!imagesOnly"
        class="flex flex-wrap gap-2"
      >
        <button
          v-for="chip in filterChips"
          :key="chip.key"
          type="button"
          class="rounded-full px-3 py-1 text-xs font-semibold transition"
          :class="
            activeFilter === chip.key
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          "
          @click="activeFilter = chip.key"
        >
          {{ chip.label }}
        </button>
      </div>

      <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div
          class="min-h-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div
            v-if="isLoading"
            class="space-y-2 p-3"
          >
            <USkeleton
              v-for="i in 6"
              :key="i"
              class="h-14 w-full rounded-xl"
            />
          </div>
          <div
            v-else-if="filteredDocuments.length === 0"
            class="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center"
          >
            <UIcon
              name="material-symbols:folder-off-outline"
              class="mb-3 h-12 w-12 text-slate-300"
            />
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">
              該当する資料がありません
            </p>
            <p class="mt-1 text-xs text-slate-500">
              検索条件を変えるか、データソースで索引登録を完了してください
            </p>
          </div>
          <ul
            v-else
            class="max-h-[min(52vh,520px)] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800"
          >
            <li
              v-for="doc in filteredDocuments"
              :key="knowledgeDocumentKey(doc)"
            >
              <button
                type="button"
                class="flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-sky-50/70 dark:hover:bg-sky-950/20"
                :class="[
                  isSelected(doc) && 'bg-sky-50 dark:bg-sky-950/30',
                  !isSelectable(doc) && 'cursor-not-allowed opacity-45 hover:bg-transparent',
                ]"
                :disabled="!isSelectable(doc)"
                @click="toggleDocument(doc)"
                @mouseenter="focusedDocKey = knowledgeDocumentKey(doc)"
              >
                <span
                  class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border"
                  :class="
                    isSelected(doc)
                      ? 'border-sky-500 bg-sky-500 text-white'
                      : 'border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-900'
                  "
                >
                  <UIcon name="material-symbols:check" class="h-3.5 w-3.5" />
                </span>
                <button
                  type="button"
                  class="mt-0.5 flex-shrink-0 rounded-lg ring-offset-2 transition hover:ring-2 hover:ring-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  title="プレビュー"
                  aria-label="プレビュー"
                  @click.stop="openDocumentPreview(doc)"
                >
                  <ConsultationKnowledgeListThumb
                    :document="doc"
                  />
                </button>
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-1.5">
                    <span class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {{ knowledgeDocumentName(doc) }}
                    </span>
                    <EnBadge
                      variant="tag"
                      size="xs"
                    >
                      {{ knowledgeSourceMeta(doc).label }}
                    </EnBadge>
                    <EnBadge
                      variant="soft"
                      color="neutral"
                      size="xs"
                    >
                      {{ knowledgeDocumentTypeLabel(doc) }}
                    </EnBadge>
                  </span>
                  <span class="mt-0.5 block truncate text-xs text-slate-500">
                    {{ formatKnowledgeBytes(knowledgeDocumentSizeBytes(doc)) }}
                    · {{ doc.mimeType || "unknown" }}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </div>

        <aside
          class="flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-950"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {{ modeConfig.selectionBasketLabel }}
            </p>
            <EnButton
              v-if="draftSelection.length > 0"
              variant="ghost"
              size="xs"
              class="text-slate-500"
              @click="clearDraftSelection"
            >
              選択解除
            </EnButton>
          </div>
          <div
            v-if="draftSelection.length === 0"
            class="flex flex-1 flex-col items-center justify-center text-center"
          >
            <UIcon
              :name="emptyBasketIcon"
              class="mb-2 h-10 w-10 text-slate-300"
            />
            <p class="text-sm text-slate-600 dark:text-slate-300">
              左の一覧から資料を選ぶと、<br>ここに表示されます
            </p>
          </div>
          <ul
            v-else
            class="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto"
          >
            <li
              v-for="item in draftSelection"
              :key="item.id"
              class="flex items-start gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2 shadow-sm dark:border-sky-900/40 dark:bg-slate-900"
            >
              <button
                v-if="draftDocumentFor(item.id)"
                type="button"
                class="mt-0.5 flex-shrink-0 rounded-lg"
                title="プレビュー"
                @click.stop="openDocumentPreview(draftDocumentFor(item.id)!)"
              >
                <ConsultationKnowledgeListThumb
                  :document="draftDocumentFor(item.id)!"
                />
              </button>
              <UIcon
                v-else
                name="material-symbols:description-outline"
                class="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {{ item.name }}
                </p>
                <p class="truncate text-[10px] text-slate-500">
                  {{ item.gcsPath }}
                </p>
              </div>
              <button
                type="button"
                class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="選択解除"
                @click="removeDraft(item.id)"
              >
                <UIcon name="material-symbols:close" class="h-4 w-4" />
              </button>
            </li>
          </ul>

          <div
            v-if="focusedDocument"
            class="mt-4 rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/80"
          >
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              プレビュー
            </p>
            <div class="mt-2 flex items-start gap-3">
              <button
                type="button"
                class="flex-shrink-0 rounded-xl ring-offset-2 transition hover:ring-2 hover:ring-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                title="フルプレビューを開く"
                @click="openDocumentPreview(focusedDocument)"
              >
                <ConsultationKnowledgeListThumb
                  :document="focusedDocument"
                  size="lg"
                />
              </button>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {{ knowledgeDocumentName(focusedDocument) }}
                </p>
                <p class="mt-0.5 text-[11px] text-slate-500">
                  {{ knowledgeDocumentTypeLabel(focusedDocument) }}
                  · {{ knowledgeSourceMeta(focusedDocument).label }}
                </p>
              </div>
            </div>
            <p
              v-if="focusedDocument.description"
              class="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300"
            >
              {{ focusedDocument.description }}
            </p>
            <p
              v-else-if="focusedDocument.sourceUrl"
              class="mt-2 truncate text-xs text-slate-500"
            >
              {{ focusedDocument.sourceUrl }}
            </p>
          </div>
        </aside>
      </div>
    </div>

    <template #footer>
      <p class="mr-auto text-xs text-slate-500">
        {{
          draftSelection.length > 0
            ? modeConfig.selectionFooterHint(draftSelection.length)
            : modeConfig.emptySelectionFooterHint
        }}
      </p>
      <EnButton
        v-if="draftSelection.length > 0"
        variant="ghost"
        size="sm"
        @click="clearDraftSelection"
      >
        選択解除
      </EnButton>
      <EnButton
        variant="ghost"
        size="sm"
        @click="cancel"
      >
        キャンセル
      </EnButton>
      <EnButton
        variant="solid"
        color="primary"
        size="sm"
        leading-icon="material-symbols:check-circle-outline"
        @click="confirm"
      >
        {{ modeConfig.confirmLabel(draftSelection.length) }}
      </EnButton>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useToast } from "#imports";
import type { Document } from "@models/document";
import ConsultationKnowledgeListThumb from "@components/AgentWorkspace/ConsultationKnowledgeListThumb.vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import EnModal from "@components/EnModal.vue";
import {
  knowledgePickerModeConfig,
  type KnowledgePickerMode,
} from "@constants/knowledgePickerModes";
import { useKnowledgePreview } from "@composables/useKnowledgePreview";
import {
  documentToSelectedKnowledge,
  filterKnowledgeDocuments,
  formatKnowledgeBytes,
  knowledgeDocumentKey,
  knowledgeDocumentName,
  knowledgeDocumentSizeBytes,
  knowledgeDocumentTypeLabel,
  knowledgeSourceMeta,
  selectableIndexedDocuments,
  type KnowledgeFilterKey,
  type SelectedKnowledgeRef,
} from "@utils/consultationKnowledge";

const props = withDefaults(
  defineProps<{
    mode: KnowledgePickerMode;
    documents: Document[];
    isLoading?: boolean;
    /** mode の既定上限を上書きする場合のみ */
    maxSelection?: number;
  }>(),
  {
    isLoading: false,
  }
);

const modelValue = defineModel<SelectedKnowledgeRef[]>({ required: true });
const modalOpen = defineModel<boolean>("open", { default: false });

const modeConfig = computed(() => knowledgePickerModeConfig(props.mode));

const maxSelection = computed(
  () => props.maxSelection ?? modeConfig.value.maxSelection
);

const emptyBasketIcon = computed(() => {
  if (props.mode === "global-pinned") {
    return "material-symbols:push-pin-outline";
  }
  if (props.mode === "ai-master-pool") {
    return "material-symbols:folder-open-outline";
  }
  if (props.mode === "image-reference") {
    return "material-symbols:image-outline";
  }
  return "material-symbols:touch-app-outline";
});

const toast = useToast();
const { open: openKnowledgePreview } = useKnowledgePreview();

const openDocumentPreview = (doc: Document): void => {
  openKnowledgePreview(doc);
};
const searchInputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref("");
const activeFilter = ref<KnowledgeFilterKey>("all");
const draftSelection = ref<SelectedKnowledgeRef[]>([]);
const focusedDocKey = ref<string>("");

const filterChips: Array<{ key: KnowledgeFilterKey; label: string }> = [
  { key: "all", label: "すべて" },
  { key: "pdf", label: "PDF" },
  { key: "sheet", label: "表計算" },
  { key: "other", label: "その他" },
];

const selectableCount = computed(
  () => selectableIndexedDocuments(props.documents).length
);

const imagesOnly = computed(() => props.mode === "image-reference");

const indexedDocuments = computed(() => {
  const base = selectableIndexedDocuments(props.documents);
  if (!imagesOnly.value) return base;
  return base.filter((doc) => (doc.mimeType || "").toLowerCase().startsWith("image/"));
});

const filteredDocuments = computed(() => {
  const filterKey = imagesOnly.value ? "all" : activeFilter.value;
  return filterKnowledgeDocuments(
    indexedDocuments.value,
    searchQuery.value,
    filterKey
  );
});

const focusedDocument = computed(() =>
  indexedDocuments.value.find(
    (doc) => knowledgeDocumentKey(doc) === focusedDocKey.value
  ) ?? null
);

watch(modalOpen, async (open) => {
  if (!open) return;
  searchQuery.value = "";
  activeFilter.value = "all";
  draftSelection.value = modelValue.value.filter((item) =>
    indexedDocuments.value.some((doc) => knowledgeDocumentKey(doc) === item.id)
  );
  focusedDocKey.value = draftSelection.value[0]?.id ?? "";
  await nextTick();
  searchInputRef.value?.focus();
});

const isSelectable = (doc: Document): boolean => {
  if (imagesOnly.value && !(doc.mimeType || "").toLowerCase().startsWith("image/")) {
    return false;
  }
  return Boolean(documentToSelectedKnowledge(doc));
};

const isSelected = (doc: Document): boolean => {
  const key = knowledgeDocumentKey(doc);
  return draftSelection.value.some((item) => item.id === key);
};

const toggleDocument = (doc: Document): void => {
  const refItem = documentToSelectedKnowledge(doc);
  if (!refItem) return;
  const existingIndex = draftSelection.value.findIndex(
    (item) => item.id === refItem.id
  );
  if (existingIndex >= 0) {
    draftSelection.value.splice(existingIndex, 1);
    return;
  }
  if (draftSelection.value.length >= maxSelection.value) {
    toast.add({
      title: modeConfig.value.maxSelectionToastTitle,
      color: "warning",
    });
    return;
  }
  draftSelection.value.push(refItem);
  focusedDocKey.value = refItem.id;
};

const removeDraft = (id: string): void => {
  draftSelection.value = draftSelection.value.filter((item) => item.id !== id);
};

const draftDocumentFor = (id: string): Document | null =>
  indexedDocuments.value.find((doc) => knowledgeDocumentKey(doc) === id) ?? null;

const clearDraftSelection = (): void => {
  draftSelection.value = [];
  focusedDocKey.value = "";
};

const cancel = (): void => {
  modalOpen.value = false;
};

const confirm = (): void => {
  modelValue.value = [...draftSelection.value];
  modalOpen.value = false;
};
</script>
