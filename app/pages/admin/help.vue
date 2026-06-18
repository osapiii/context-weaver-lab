<template>
  <div class="relative flex h-full min-h-0 overflow-hidden">
    <div class="pointer-events-none absolute inset-0 bg-white/60" />
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_16%,rgba(59,130,246,0.12),transparent_28%),linear-gradient(90deg,rgba(248,250,252,0.96)_0%,rgba(248,250,252,0.76)_34%,rgba(255,255,255,0.62)_100%)]"
    />

    <div class="relative z-10 flex min-h-0 w-full flex-col">
      <section class="shrink-0 border-b border-slate-200/80 bg-white/54 px-5 py-5 backdrop-blur-sm lg:px-8">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div class="min-w-0">
            <div class="flex items-center gap-2 text-sm font-semibold text-sky-700">
              <UIcon name="material-symbols:help-outline" class="h-5 w-5" />
              <span>EN AIstudio Help</span>
            </div>
            <h1 class="mt-1 text-2xl font-extrabold tracking-normal text-slate-950 sm:text-3xl">
              ヘルプセンター
            </h1>
          </div>

          <form
            class="flex w-full min-w-0 flex-col gap-2 sm:flex-row xl:max-w-[48rem]"
            @submit.prevent="askGuide(searchQuery || selectedArticle?.title || '')"
          >
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              size="xl"
              class="min-w-0 flex-1 help-search-input"
              placeholder="機能名・困りごと・設定名で検索"
            />
            <UButton
              type="submit"
              color="info"
              size="xl"
              icon="material-symbols:assistant-navigation-outline"
              :disabled="!canAskFromSearch"
              class="justify-center px-5 font-bold"
            >
              AIに聞く
            </UButton>
          </form>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button
            v-for="item in categoryTabs"
            :key="item.value"
            type="button"
            :class="[
              'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-bold shadow-sm transition-colors',
              selectedCategory === item.value
                ? 'border-sky-300 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white/90 text-slate-600 hover:border-slate-300 hover:bg-white',
            ]"
            @click="selectedCategory = item.value"
          >
            <UIcon :name="item.icon" class="h-4 w-4" />
            {{ item.label }}
          </button>
          <USelect
            v-model="selectedTag"
            :items="tagOptions"
            size="md"
            class="ml-0 w-52 sm:ml-2"
          />
        </div>
      </section>

      <section class="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[28rem_minmax(0,1fr)]">
        <aside class="min-h-0 border-r border-slate-200/80 bg-slate-50/54 px-4 py-4 backdrop-blur-sm lg:overflow-y-auto lg:px-6">
          <div class="mb-3 flex items-center justify-between text-sm text-slate-500">
            <span>{{ filteredArticles.length }} 件</span>
            <button
              v-if="searchQuery || selectedCategory !== 'all' || selectedTag !== 'all'"
              type="button"
              class="font-bold text-slate-500 hover:text-slate-900"
              @click="resetFilters"
            >
              絞り込み解除
            </button>
          </div>

          <div class="grid gap-3">
            <button
              v-for="article in filteredArticles"
              :key="article.id"
              type="button"
              :class="[
                'group block w-full rounded-lg border p-4 text-left shadow-sm transition-all',
                selectedArticle?.id === article.id
                  ? 'border-sky-300 bg-sky-50/95 shadow-sky-100'
                  : 'border-slate-200 bg-white/94 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:shadow-md',
              ]"
              @click="selectArticle(article.slug)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="line-clamp-1 text-base font-extrabold tracking-normal text-slate-950">
                    {{ article.title }}
                  </div>
                  <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                    {{ article.description }}
                  </p>
                </div>
                <span class="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 group-hover:bg-sky-50 group-hover:text-sky-700">
                  {{ categoryLabel(article.category) }}
                </span>
              </div>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <span
                  v-for="tag in article.tags.slice(0, 4)"
                  :key="`${article.id}-${tag}`"
                  class="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200"
                >
                  {{ tag }}
                </span>
              </div>
            </button>
          </div>
        </aside>

        <article class="min-h-0 overflow-y-auto px-5 py-5 lg:px-10">
          <div v-if="selectedArticle" class="mx-auto max-w-5xl pb-14">
            <header class="border-b border-slate-200/90 pb-6">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span class="rounded-md bg-sky-50 px-2.5 py-1 font-bold text-sky-700">
                      {{ categoryLabel(selectedArticle.category) }}
                    </span>
                    <span v-if="selectedArticle.updatedAt">
                      更新 {{ selectedArticle.updatedAt }}
                    </span>
                  </div>
                  <h2 class="mt-3 text-2xl font-extrabold tracking-normal text-slate-950 sm:text-3xl">
                    {{ selectedArticle.title }}
                  </h2>
                  <p class="mt-2 text-base leading-relaxed text-slate-600">
                    {{ selectedArticle.description }}
                  </p>
                </div>
                <UButton
                  color="info"
                  variant="soft"
                  icon="material-symbols:assistant-navigation-outline"
                  class="shrink-0 font-bold"
                  @click="askGuide(`${selectedArticle.title} について教えて`)"
                >
                  AIに聞く
                </UButton>
              </div>

              <form
                class="mt-6 flex flex-col gap-2 rounded-lg border border-slate-200/90 bg-white/72 p-3 shadow-sm backdrop-blur-sm sm:flex-row"
                @submit.prevent="askGuide(guideQuestion)"
              >
                <UInput
                  v-model="guideQuestion"
                  icon="i-heroicons-sparkles"
                  size="lg"
                  class="min-w-0 flex-1 help-article-question"
                  :placeholder="`${selectedArticle.title} について質問`"
                />
                <UButton
                  type="submit"
                  color="info"
                  size="lg"
                  icon="i-heroicons-paper-airplane"
                  :disabled="!guideQuestion.trim()"
                  class="justify-center font-bold"
                >
                  ガイドを開く
                </UButton>
              </form>
            </header>

            <EnMarkdown
              class="mt-7"
              :markdown-text="selectedArticle.body"
              variant="help"
            />
          </div>
          <div
            v-else
            class="flex h-full min-h-[24rem] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/70 text-sm text-slate-500"
          >
            条件に合うヘルプが見つかりませんでした
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  allHelpTags,
  findHelpArticleBySlug,
  helpArticleCategoryLabels,
  searchHelpArticles,
  type HelpArticle,
  type HelpArticleCategory,
} from "@utils/helpContent";

definePageMeta({
  layout: "admin",
  adminPageContainer: "flush",
  adminPageFillHeight: true,
  adminPageStack: false,
});

type CategoryFilter = HelpArticleCategory | "all";

const route = useRoute();
const router = useRouter();
const assistant = useEnAiStudioAssistantStore();

const searchQuery = ref("");
const selectedCategory = ref<CategoryFilter>("all");
const selectedTag = ref("all");
const selectedSlug = ref<string>(
  typeof route.query.article === "string" ? route.query.article : ""
);
const guideQuestion = ref("");

const categoryTabs: Array<{
  value: CategoryFilter;
  label: string;
  icon: string;
}> = [
  { value: "all", label: "すべて", icon: "i-heroicons-squares-2x2" },
  { value: "manual", label: "操作ガイド", icon: "material-symbols:menu-book-outline" },
  { value: "schema", label: "画面・データ", icon: "material-symbols:database-outline" },
  { value: "reference", label: "リファレンス", icon: "i-heroicons-list-bullet" },
];

const tagOptions = computed(() => [
  { label: "すべてのタグ", value: "all" },
  ...allHelpTags.map((tag) => ({ label: tag, value: tag })),
]);

const filteredArticles = computed(() =>
  searchHelpArticles({
    query: searchQuery.value,
    category: selectedCategory.value,
    tag: selectedTag.value,
  })
);

const selectedArticle = computed<HelpArticle | null>(() => {
  const byQuery = selectedSlug.value
    ? findHelpArticleBySlug(selectedSlug.value)
    : null;
  if (byQuery && filteredArticles.value.some((a) => a.id === byQuery.id)) {
    return byQuery;
  }
  return filteredArticles.value[0] ?? null;
});

const canAskFromSearch = computed(() => {
  return Boolean(searchQuery.value.trim() || selectedArticle.value?.title);
});

watch(
  () => route.query.article,
  (value) => {
    selectedSlug.value = typeof value === "string" ? value : "";
  }
);

watch(
  selectedArticle,
  (article) => {
    if (!article) return;
    if (selectedSlug.value === article.slug) return;
    selectedSlug.value = article.slug;
    void router.replace({ query: { ...route.query, article: article.slug } });
  },
  { immediate: true }
);

const categoryLabel = (category: HelpArticleCategory): string =>
  helpArticleCategoryLabels[category] ?? category;

const selectArticle = (slug: string): void => {
  selectedSlug.value = slug;
  guideQuestion.value = "";
  void router.replace({ query: { ...route.query, article: slug } });
};

const resetFilters = (): void => {
  searchQuery.value = "";
  selectedCategory.value = "all";
  selectedTag.value = "all";
};

const askGuide = (rawPrompt: string): void => {
  const prompt = rawPrompt.trim();
  if (!prompt) return;
  const article = selectedArticle.value;
  const enriched = article
    ? [
        prompt,
        "",
        `参考ヘルプ: ${article.title}`,
        `カテゴリ: ${categoryLabel(article.category)}`,
      ].join("\n")
    : prompt;
  assistant.launchGuideSession(enriched);
  guideQuestion.value = "";
};
</script>

<style scoped>
:deep(.help-search-input input) {
  height: 3.75rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.94);
  font-size: 1.0625rem;
  font-weight: 650;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
}

:deep(.help-article-question input) {
  font-weight: 650;
}
</style>
