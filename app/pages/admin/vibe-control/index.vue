<template>
  <div class="space-y-5">
    <AdminModePageNav current-page-label="VibeControl" />

    <EnAiPageHeader
      title="VibeControl"
      subtitle="ユーザーストーリーをSSOT化し、仕様・根拠・コード状態のズレを管理します"
      icon="flat-color-icons:flow-chart"
    >
      <template #trailing>
        <div class="flex flex-wrap items-center gap-2">
          <EnButton
            variant="outline"
            color="neutral"
            size="sm"
            leading-icon="material-symbols:refresh"
            :loading="store.isLoading"
            @click="store.fetchFromFirestore()"
          >
            再読込
          </EnButton>
          <EnButton
            variant="soft"
            color="neutral"
            size="sm"
            leading-icon="material-symbols:content-copy"
            :disabled="!selectedStory"
            @click="copySelectedStory"
          >
            Markdown
          </EnButton>
        </div>
      </template>
    </EnAiPageHeader>

    <EnAlert
      v-if="store.error"
      color="warning"
      :title="store.error"
    />

    <div class="grid gap-3 md:grid-cols-4">
      <div
        v-for="metric in metrics"
        :key="metric.label"
        class="rounded-lg border border-slate-200 bg-white p-4"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-medium text-slate-500">
            {{ metric.label }}
          </p>
          <UIcon
            :name="metric.icon"
            class="h-5 w-5 text-slate-400"
          />
        </div>
        <p class="mt-2 text-2xl font-bold tabular-nums text-slate-900">
          {{ metric.value }}
        </p>
        <p class="mt-1 text-xs text-slate-500">
          {{ metric.caption }}
        </p>
      </div>
    </div>

    <VibeControlSourceSetup
      :source-connections="store.sourceConnections"
      :is-generating="store.isGenerating"
      @generate="store.runMockGeneration($event)"
      @persist="store.persistCurrentSnapshot()"
    />

    <section class="rounded-lg border border-slate-200 bg-white p-4">
      <div class="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_11rem_11rem_11rem_11rem_10rem]">
        <label class="block min-w-0">
          <span class="text-xs font-medium text-slate-600">検索</span>
          <input
            :value="store.filters.query"
            type="search"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            placeholder="story / domain / label"
            @input="store.setFilter('query', ($event.target as HTMLInputElement).value)"
          >
        </label>
        <label class="block">
          <span class="text-xs font-medium text-slate-600">Status</span>
          <select
            :value="store.filters.status"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            @change="onStatusChange"
          >
            <option value="all">すべて</option>
            <option value="discovery">検討中</option>
            <option value="ready_for_dev">設計完了</option>
            <option value="implemented">実装済み</option>
            <option value="released">リリース済み</option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs font-medium text-slate-600">Domain</span>
          <select
            :value="store.filters.domain"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            @change="store.setFilter('domain', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">すべて</option>
            <option
              v-for="domain in store.domains"
              :key="domain"
              :value="domain"
            >
              {{ domain }}
            </option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs font-medium text-slate-600">Milestone</span>
          <select
            :value="store.filters.milestone"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            @change="store.setFilter('milestone', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">すべて</option>
            <option
              v-for="milestone in store.milestones"
              :key="milestone"
              :value="milestone"
            >
              {{ milestone }}
            </option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs font-medium text-slate-600">Drift</span>
          <select
            :value="store.filters.drift"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            @change="onDriftChange"
          >
            <option value="all">すべて</option>
            <option value="none">差分なし</option>
            <option value="low">軽微</option>
            <option value="medium">要確認</option>
            <option value="high">高リスク</option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs font-medium text-slate-600">Min conf.</span>
          <input
            :value="store.filters.minConfidence"
            type="number"
            min="0"
            max="100"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            @input="store.setFilter('minConfidence', Number(($event.target as HTMLInputElement).value))"
          >
        </label>
      </div>
      <div class="mt-3 flex justify-end">
        <EnButton
          variant="ghost"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:filter-alt-off"
          @click="store.clearFilters()"
        >
          クリア
        </EnButton>
      </div>
    </section>

    <div class="grid min-h-[42rem] gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <VibeControlStoryBoard
        :stories="store.filteredStories"
        :evidence-count-by-story="store.evidenceCountByStory"
        :selected-story-id="store.selectedStoryId"
        @select-story="store.selectStory($event)"
      />
      <div class="grid min-h-0 gap-4">
        <VibeControlStoryDetail
          :story="selectedStory"
          :evidence="selectedEvidence"
        />
        <VibeControlAgentRunCenter :logs="store.lastRunLog" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useVibeControlStore } from "@stores/vibeControl";
import type {
  VibeControlDriftLevel,
  VibeControlStoryStatus,
} from "@models/vibeControl";

defineOptions({
  name: "AdminVibeControlIndexPage",
});

definePageMeta({
  name: "admin-vibe-control",
  layout: "admin",
  middleware: ["admin-logged-in-check"],
});

const store = useVibeControlStore();
const toast = useToast();

const selectedStory = computed(() => store.selectedStory);
const selectedEvidence = computed(() => store.selectedEvidence);

const metrics = computed(() => [
  {
    label: "Stories",
    value: store.stories.length,
    caption: "SSOT化済み",
    icon: "material-symbols:article-outline",
  },
  {
    label: "Average confidence",
    value: `${store.averageConfidence}%`,
    caption: "根拠・AC・コード対応から算出",
    icon: "material-symbols:verified-outline",
  },
  {
    label: "Needs review",
    value: store.needsReviewCount,
    caption: "推測せず確認待ちにした項目",
    icon: "material-symbols:rate-review-outline",
  },
  {
    label: "High drift",
    value: store.highDriftCount,
    caption: "仕様とコード状態の高リスク差分",
    icon: "material-symbols:warning-outline",
  },
]);

onMounted(() => {
  void store.fetchFromFirestore();
});

async function copySelectedStory(): Promise<void> {
  if (!selectedStory.value) return;
  const body = store.exportStoryMarkdown(selectedStory.value.id);
  await navigator.clipboard.writeText(body);
  toast.add({
    title: "Story SSOT Markdownをコピーしました",
    color: "success",
  });
}

function onStatusChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  store.setFilter("status", value as VibeControlStoryStatus | "all");
}

function onDriftChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  store.setFilter("drift", value as VibeControlDriftLevel | "all");
}
</script>
