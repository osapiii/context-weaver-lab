<template>
  <article class="flex min-h-[36rem] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div class="border-b border-slate-100 bg-slate-950 px-4 py-4 text-white">
      <template v-if="story">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded bg-white/10 px-2 py-1 font-mono text-xs font-bold text-emerald-200">
                [{{ storyTicketKey(story) }}]
              </span>
              <EnBadge
                :color="story.reviewState === 'needs_review' ? 'warning' : 'success'"
                size="xs"
              >
                {{ story.reviewState === "needs_review" ? "要レビュー" : "根拠充足" }}
              </EnBadge>
              <EnBadge :color="driftBadge.color" size="xs" variant="soft">
                {{ driftBadge.label }}
              </EnBadge>
            </div>
            <h2 class="mt-3 text-xl font-bold tracking-tight">
              {{ story.title }}
            </h2>
            <p class="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">
              {{ story.summary }}
            </p>
          </div>
          <div class="grid grid-cols-3 gap-2 text-right">
            <div
              v-for="metric in headerMetrics"
              :key="metric.label"
              class="rounded-md bg-white/10 px-3 py-2"
            >
              <p class="text-[10px] font-semibold uppercase text-slate-400">
                {{ metric.label }}
              </p>
              <p class="text-lg font-bold tabular-nums">
                {{ metric.value }}
              </p>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <p class="text-sm font-semibold">ストーリー未選択</p>
        <p class="mt-1 text-xs text-slate-400">左のボードから確認対象を選んでください。</p>
      </template>
    </div>

    <template v-if="story">
      <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-bold transition"
            :class="
              activeTab === tab.value
                ? 'bg-slate-950 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-950'
            "
            @click="activeTab = tab.value"
          >
            <UIcon :name="tab.icon" class="h-4 w-4" />
            {{ tab.label }}
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <section v-if="activeTab === 'spec'" class="space-y-4">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-bold uppercase text-slate-500">User Story</p>
            <p class="mt-2 text-sm leading-relaxed text-slate-700">
              {{ story.userStory }}
            </p>
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <div
              v-for="item in contextFacts"
              :key="item.label"
              class="rounded-lg border border-slate-200 p-3"
            >
              <p class="text-xs font-semibold text-slate-500">{{ item.label }}</p>
              <p class="mt-1 truncate text-sm font-bold text-slate-900">
                {{ item.value }}
              </p>
            </div>
          </div>

          <section>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-xs font-bold uppercase text-slate-500">
                Acceptance Criteria
              </h3>
              <EnBadge variant="tag" size="xs">
                {{ coveredAcCount }}/{{ story.acceptanceCriteria.length }} covered
              </EnBadge>
            </div>
            <div class="mt-2 space-y-2">
              <div
                v-for="ac in story.acceptanceCriteria"
                :key="ac.id"
                class="flex gap-3 rounded-lg border border-slate-200 p-3"
              >
                <UIcon
                  :name="acIcon(ac.state)"
                  :class="acIconClass(ac.state)"
                  class="mt-0.5 h-4 w-4 shrink-0"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-slate-800">
                    {{ ac.text }}
                  </p>
                  <p class="mt-1 text-[11px] text-slate-500">
                    {{ ac.id }} / {{ ac.state }} / evidence {{ ac.evidenceIds.length }}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </section>

        <section v-else-if="activeTab === 'evidence'" class="space-y-3">
          <div
            v-if="evidence.length === 0"
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500"
          >
            根拠はまだ紐付いていません
          </div>
          <template v-else>
            <article
              v-for="item in evidence"
              :key="item.id"
              class="rounded-lg border border-slate-200 p-4"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <EnBadge :color="evidenceColor(item.type)" size="xs">
                      {{ item.type }}
                    </EnBadge>
                    <EnBadge variant="tag" size="xs">{{ item.freshness }}</EnBadge>
                    <span class="text-xs font-bold tabular-nums text-slate-500">
                      impact {{ signedNumber(item.confidenceImpact) }}
                    </span>
                  </div>
                  <h3 class="mt-2 text-sm font-bold text-slate-950">
                    {{ item.title }}
                  </h3>
                </div>
                <a
                  v-if="item.citation.uri"
                  :href="item.citation.uri"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-primary-800"
                >
                  Source
                  <UIcon name="material-symbols:open-in-new-rounded" class="h-3.5 w-3.5" />
                </a>
              </div>
              <p class="mt-3 text-sm leading-relaxed text-slate-700">
                {{ item.excerpt }}
              </p>
              <p class="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                {{ item.citation.snippet }}
              </p>
            </article>
          </template>
        </section>

        <section v-else-if="activeTab === 'code'" class="space-y-3">
          <div
            v-if="story.codeRefs.length === 0"
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500"
          >
            コード紐付けはまだありません
          </div>
          <template v-else>
            <article
              v-for="ref in story.codeRefs"
              :key="`${ref.repoFullName}-${ref.path}-${ref.pullRequest}-${ref.commit}`"
              class="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div class="flex flex-wrap items-center gap-2">
                <EnBadge leading-icon="i-simple-icons-github" variant="tag" size="xs">
                  {{ ref.repoFullName }}
                </EnBadge>
                <EnBadge v-if="ref.branch" variant="tag" size="xs">
                  {{ ref.branch }}
                </EnBadge>
                <EnBadge v-if="ref.pullRequest" color="info" size="xs">
                  {{ ref.pullRequest }}
                </EnBadge>
                <EnBadge v-if="ref.commit" color="neutral" size="xs">
                  {{ ref.commit }}
                </EnBadge>
              </div>
              <p class="mt-3 font-mono text-xs font-bold text-slate-900">
                {{ ref.path || "path未設定" }}
                <span v-if="ref.lineStart" class="text-slate-500">
                  :{{ ref.lineStart }}{{ ref.lineEnd ? `-${ref.lineEnd}` : "" }}
                </span>
              </p>
              <p class="mt-2 text-sm leading-relaxed text-slate-600">
                {{ ref.summary || "コード上の対応箇所として紐付けられています。" }}
              </p>
            </article>
          </template>
        </section>

        <section v-else class="space-y-3">
          <div
            v-if="story.generationTrace.length === 0"
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500"
          >
            生成履歴はまだありません
          </div>
          <ol v-else class="relative space-y-3">
            <li
              v-for="trace in story.generationTrace"
              :key="`${trace.at}-${trace.message}`"
              class="rounded-lg border border-slate-200 p-4"
            >
              <div class="flex flex-wrap items-center gap-2">
                <EnBadge :color="trace.actor === 'agent' ? 'purple' : 'neutral'" size="xs">
                  {{ trace.actor }}
                </EnBadge>
                <span class="text-xs font-semibold text-slate-500">
                  {{ formatDate(trace.at) }}
                </span>
              </div>
              <p class="mt-2 text-sm leading-relaxed text-slate-700">
                {{ trace.message }}
              </p>
            </li>
          </ol>
        </section>
      </div>
    </template>
  </article>
</template>

<script setup lang="ts">
import type {
  DecodedVibeControlStory,
  DecodedVibeControlStoryEvidence,
  VibeControlEvidenceType,
} from "@models/vibeControl";
import { VIBE_CONTROL_DRIFT_LABELS } from "@models/vibeControl";
import { storyTicketKey } from "@utils/vibeControlStoryKeys";

const props = defineProps<{
  story: DecodedVibeControlStory | null;
  evidence: DecodedVibeControlStoryEvidence[];
}>();

type DetailTab = "spec" | "evidence" | "code" | "trace";

const activeTab = ref<DetailTab>("spec");

const tabs = [
  { value: "spec", label: "仕様・AC", icon: "material-symbols:fact-check-outline" },
  { value: "evidence", label: "根拠", icon: "material-symbols:source-outline" },
  { value: "code", label: "コード", icon: "material-symbols:code-blocks-outline" },
  { value: "trace", label: "生成履歴", icon: "material-symbols:timeline-outline" },
] as const;

const coveredAcCount = computed(
  () =>
    props.story?.acceptanceCriteria.filter((item) => item.state === "covered")
      .length ?? 0
);

const driftBadge = computed(() => {
  const drift = props.story?.driftLevel ?? "none";
  return {
    label: VIBE_CONTROL_DRIFT_LABELS[drift],
    color:
      drift === "high"
        ? "error"
        : drift === "medium"
          ? "warning"
          : drift === "low"
            ? "info"
            : "success",
  } as const;
});

const headerMetrics = computed(() => {
  const story = props.story;
  if (!story) return [];
  return [
    { label: "Confidence", value: `${story.confidenceScore}%` },
    { label: "Evidence", value: props.evidence.length },
    { label: "Code refs", value: story.codeRefs.length },
  ];
});

const contextFacts = computed(() => {
  const story = props.story;
  if (!story) return [];
  return [
    { label: "Domain", value: story.domain },
    { label: "Milestone", value: story.milestone },
    { label: "Repository", value: story.repoFullName || "未設定" },
    { label: "FileSpace", value: story.fileSpaceId || "未設定" },
    {
      label: "Knowledge checked",
      value: formatDate(story.sourceFreshness.knowledgeCheckedAt),
    },
    {
      label: "GitHub checked",
      value: formatDate(story.sourceFreshness.githubCheckedAt),
    },
  ];
});

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

function evidenceColor(type: VibeControlEvidenceType): "primary" | "info" | "success" | "warning" | "neutral" | "purple" {
  if (type === "knowledge") return "primary";
  if (type === "code" || type === "commit") return "info";
  if (type === "pr") return "purple";
  if (type === "ticket") return "warning";
  if (type === "agent") return "success";
  return "neutral";
}

function signedNumber(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatDate(value?: string): string {
  if (!value) return "未確認";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>
