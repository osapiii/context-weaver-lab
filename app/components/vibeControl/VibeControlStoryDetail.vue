<template>
  <aside class="flex min-h-0 min-w-0 flex-col rounded-lg border border-slate-200 bg-white">
    <div class="border-b border-slate-100 px-4 py-3">
      <template v-if="story">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-xs font-semibold text-slate-500">
                {{ story.storyKey }}
              </span>
              <EnBadge
                :color="story.reviewState === 'needs_review' ? 'warning' : 'success'"
                size="xs"
              >
                {{ story.reviewState === "needs_review" ? "要レビュー" : "根拠充足" }}
              </EnBadge>
            </div>
            <h2 class="mt-1 text-base font-bold leading-snug text-slate-900">
              {{ story.title }}
            </h2>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-xl font-bold tabular-nums text-slate-900">
              {{ story.confidenceScore }}%
            </p>
            <p class="text-[11px] text-slate-500">confidence</p>
          </div>
        </div>
        <p class="mt-2 text-xs leading-relaxed text-slate-600">
          {{ story.summary }}
        </p>
      </template>
      <template v-else>
        <p class="text-sm font-semibold text-slate-700">ストーリー未選択</p>
        <p class="mt-1 text-xs text-slate-500">左のボードから確認対象を選んでください。</p>
      </template>
    </div>

    <template v-if="story">
      <div class="border-b border-slate-100 px-2 py-2">
        <div class="grid grid-cols-5 gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            :class="[
              'rounded-md px-2 py-1.5 font-semibold transition',
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800',
            ]"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <div v-if="activeTab === 'spec'" class="space-y-4">
          <section>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              User Story
            </h3>
            <p class="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
              {{ story.userStory }}
            </p>
          </section>
          <section>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Acceptance Criteria
            </h3>
            <div class="mt-2 space-y-2">
              <div
                v-for="ac in story.acceptanceCriteria"
                :key="ac.id"
                class="flex gap-2 rounded-lg border border-slate-200 p-3"
              >
                <UIcon
                  :name="acIcon(ac.state)"
                  :class="acIconClass(ac.state)"
                  class="mt-0.5 h-4 w-4 shrink-0"
                />
                <div class="min-w-0">
                  <p class="text-sm font-medium text-slate-800">
                    {{ ac.text }}
                  </p>
                  <p class="mt-1 text-[11px] text-slate-500">
                    {{ ac.id }} / {{ ac.state }} / evidence {{ ac.evidenceIds.length }}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div v-else-if="activeTab === 'evidence'" class="space-y-3">
          <div
            v-for="item in evidence"
            :key="item.id"
            class="rounded-lg border border-slate-200 p-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <EnBadge variant="tag" size="xs">{{ item.type }}</EnBadge>
              <EnBadge
                :color="item.freshness === 'fresh' ? 'success' : item.freshness === 'stale' ? 'warning' : 'neutral'"
                size="xs"
              >
                {{ item.freshness }}
              </EnBadge>
            </div>
            <p class="mt-2 text-sm font-semibold text-slate-800">
              {{ item.title }}
            </p>
            <p class="mt-1 text-xs leading-relaxed text-slate-600">
              {{ item.excerpt }}
            </p>
            <p class="mt-2 rounded bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-500">
              {{ item.citation.snippet }}
            </p>
          </div>
        </div>

        <div v-else-if="activeTab === 'tickets'" class="space-y-3">
          <div class="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <p class="font-semibold text-slate-900">
              MVPではチケットはFileSpace取り込み済み文書として扱います
            </p>
            <p class="mt-1 text-xs leading-relaxed text-slate-500">
              Jira / Linear の直接OAuth連携は後続。現時点では、要件・AC・チケット相当の資料をAgent Searchで根拠化します。
            </p>
          </div>
          <div
            v-for="item in ticketEvidence"
            :key="item.id"
            class="rounded-lg border border-slate-200 p-3"
          >
            <p class="text-sm font-semibold text-slate-800">{{ item.title }}</p>
            <p class="mt-1 text-xs text-slate-600">{{ item.excerpt }}</p>
          </div>
        </div>

        <div v-else-if="activeTab === 'code'" class="space-y-3">
          <div
            v-if="story.driftReason"
            class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {{ story.driftReason }}
          </div>
          <div
            v-for="ref in story.codeRefs"
            :key="`${ref.repoFullName}-${ref.path}-${ref.commit}`"
            class="rounded-lg border border-slate-200 p-3"
          >
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <EnBadge variant="tag" size="xs">GitHub</EnBadge>
              <span>{{ ref.repoFullName }}</span>
              <span v-if="ref.branch">branch: {{ ref.branch }}</span>
              <span v-if="ref.pullRequest">{{ ref.pullRequest }}</span>
            </div>
            <p class="mt-2 font-mono text-xs text-slate-700">
              {{ ref.path || "(repository context)" }}
            </p>
            <p class="mt-1 text-xs text-slate-600">{{ ref.summary }}</p>
          </div>
          <div
            v-if="story.codeRefs.length === 0"
            class="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400"
          >
            このストーリーにはまだコード根拠が紐付いていません。
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="trace in story.generationTrace"
            :key="`${trace.at}-${trace.message}`"
            class="flex gap-3 rounded-lg border border-slate-200 p-3"
          >
            <UIcon
              name="material-symbols:smart-toy-outline"
              class="mt-0.5 h-4 w-4 shrink-0 text-primary-500"
            />
            <div class="min-w-0">
              <p class="text-xs font-semibold text-slate-500">
                {{ trace.actor }} / {{ formatDate(trace.at) }}
              </p>
              <p class="mt-1 text-sm text-slate-700">{{ trace.message }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import type {
  DecodedVibeControlStory,
  DecodedVibeControlStoryEvidence,
} from "@models/vibeControl";

const props = defineProps<{
  story: DecodedVibeControlStory | null;
  evidence: DecodedVibeControlStoryEvidence[];
}>();

type DetailTab = "spec" | "evidence" | "tickets" | "code" | "log";

const tabs: Array<{ key: DetailTab; label: string }> = [
  { key: "spec", label: "仕様・背景" },
  { key: "evidence", label: "根拠" },
  { key: "tickets", label: "チケット/要件" },
  { key: "code", label: "コード状態" },
  { key: "log", label: "生成ログ" },
];

const activeTab = ref<DetailTab>("spec");

watch(
  () => props.story?.id,
  () => {
    activeTab.value = "spec";
  }
);

const ticketEvidence = computed(() =>
  props.evidence.filter((item) => item.type === "ticket" || item.type === "knowledge")
);

function acIcon(state: string): string {
  if (state === "covered") return "material-symbols:check-circle-outline";
  if (state === "conflict") return "material-symbols:warning-outline";
  if (state === "missing") return "material-symbols:error-outline";
  return "material-symbols:help-outline";
}

function acIconClass(state: string): string {
  if (state === "covered") return "text-emerald-500";
  if (state === "conflict") return "text-amber-500";
  if (state === "missing") return "text-rose-500";
  return "text-slate-400";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>
