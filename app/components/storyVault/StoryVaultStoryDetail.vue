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

        <section v-else-if="activeTab === 'report'" class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <p class="text-sm font-bold text-slate-900">レポートプレビュー</p>
              <p class="mt-1 text-xs leading-5 text-slate-500">
                選択中のStory、根拠、SourceAsset、クリップ、スクリーンショットをまとめて確認します。
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <div class="inline-flex rounded-md border border-slate-200 bg-white p-1">
                <button
                  v-for="mode in reportModes"
                  :key="mode.value"
                  type="button"
                  class="rounded px-3 py-1.5 text-xs font-bold"
                  :class="reportMode === mode.value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-950'"
                  @click="reportMode = mode.value"
                >
                  {{ mode.label }}
                </button>
              </div>
              <EnButton
                v-if="reportMode !== 'excel'"
                variant="outline"
                color="neutral"
                size="xs"
                leading-icon="material-symbols:open-in-new"
                @click="openReport"
              >
                開く
              </EnButton>
              <EnButton
                v-if="reportMode !== 'excel'"
                variant="outline"
                color="neutral"
                size="xs"
                leading-icon="material-symbols:download"
                @click="downloadReport"
              >
                保存
              </EnButton>
              <EnButton
                variant="outline"
                color="neutral"
                size="xs"
                leading-icon="material-symbols:content-copy"
                @click="copyReport"
              >
                コピー
              </EnButton>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-4">
            <div
              v-for="metric in reportMetrics"
              :key="metric.label"
              class="rounded-lg border border-slate-200 bg-white p-3"
            >
              <p class="text-xs font-semibold text-slate-500">{{ metric.label }}</p>
              <p class="mt-1 text-lg font-bold tabular-nums text-slate-950">{{ metric.value }}</p>
            </div>
          </div>

          <iframe
            v-if="reportMode === 'html' && reportHtmlUrl"
            :src="reportHtmlUrl"
            title="Story report HTML preview"
            class="h-[44rem] w-full rounded-lg border border-slate-200 bg-white"
          />

          <div
            v-else-if="reportMode === 'markdown'"
            class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]"
          >
            <div class="min-h-[36rem] rounded-lg border border-slate-200 bg-white p-4">
              <EnMarkdown
                :markdown-text="reportMarkdown"
                :enable-router-links="false"
              />
            </div>
            <textarea
              readonly
              class="min-h-[36rem] w-full resize-y rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 font-mono text-xs leading-5 text-slate-50 shadow-inner"
              :value="reportMarkdown"
            />
          </div>

          <section
            v-else-if="reportMode === 'excel'"
            class="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-bold text-slate-950">Excelブック</p>
                <p class="mt-1 text-xs leading-5 text-slate-500">
                  顧客共有・進捗会議向けに、ストーリー、AC、証跡、素材、クリップ、コード参照をシート別に保存します。
                </p>
              </div>
              <EnBadge color="success" size="xs">
                .xlsx
              </EnBadge>
            </div>
            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <div
                v-for="sheet in reportExcelSheets"
                :key="sheet.name"
                class="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <p class="text-xs font-bold text-slate-950">{{ sheet.name }}</p>
                <p class="mt-1 text-xs leading-5 text-slate-500">{{ sheet.description }}</p>
              </div>
            </div>
          </section>
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
                <EnBadge :color="trace.actor === 'agent' ? 'primary' : 'neutral'" size="xs">
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
import * as XLSX from "xlsx";
import type {
  DecodedStoryVaultApplication,
  DecodedStoryVaultClip,
  DecodedStoryVaultSourceAsset,
  DecodedStoryVaultStory,
  DecodedStoryVaultStoryEvidence,
  StoryVaultEvidenceType,
} from "@models/storyVault";
import { getDownloadURL } from "firebase/storage";
import EnMarkdown from "@components/EnMarkdown.vue";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import { STORYVAULT_DRIFT_LABELS } from "@models/storyVault";
import { storyTicketKey } from "@utils/storyVaultStoryKeys";

const props = defineProps<{
  application: DecodedStoryVaultApplication | null;
  story: DecodedStoryVaultStory | null;
  evidence: DecodedStoryVaultStoryEvidence[];
  sourceAssets: DecodedStoryVaultSourceAsset[];
  clips: DecodedStoryVaultClip[];
}>();

type DetailTab = "spec" | "evidence" | "code" | "report" | "trace";
type ReportMode = "html" | "markdown" | "excel";

const activeTab = ref<DetailTab>("spec");
const reportMode = ref<ReportMode>("html");
const videoUrls = reactive<Record<string, string>>({});
const frameUrls = reactive<Record<string, string>>({});
const reportHtmlUrl = ref("");

const tabs = [
  { value: "spec", label: "仕様・AC", icon: "material-symbols:fact-check-outline" },
  { value: "evidence", label: "根拠", icon: "material-symbols:source-outline" },
  { value: "code", label: "コード", icon: "material-symbols:code-blocks-outline" },
  { value: "report", label: "レポートプレビュー", icon: "material-symbols:preview-outline" },
  { value: "trace", label: "生成履歴", icon: "material-symbols:timeline-outline" },
] as const;

const reportModes = [
  { value: "html", label: "HTML" },
  { value: "markdown", label: "Markdown" },
  { value: "excel", label: "Excel" },
] as const;

const reportExcelSheets = [
  { name: "サマリー", description: "案件、ストーリー状態、信頼度、件数をまとめた表紙です。" },
  { name: "ユーザーストーリー", description: "タイトル、本文、ステータス、ドメイン、マイルストーンを一覧化します。" },
  { name: "受け入れ条件", description: "ACごとの状態と紐付く証跡IDを確認できます。" },
  { name: "証跡リンク", description: "証跡、引用、Source URL、SourceAssetとの対応をまとめます。" },
  { name: "Source Assets", description: "素材のURI、Storage、FileSpace、GitHub参照をまとめます。" },
  { name: "クリップ", description: "関連クリップと動画URL、スクリーンショット数をまとめます。" },
  { name: "スクリーンショット", description: "フレーム時刻、画像URL、保存先を一覧化します。" },
  { name: "Code References", description: "Repository、PR、Commit、パス、行番号を一覧化します。" },
] as const;

const coveredAcCount = computed(
  () =>
    props.story?.acceptanceCriteria.filter((item) => item.state === "covered")
      .length ?? 0
);

const driftBadge = computed(() => {
  const drift = props.story?.driftLevel ?? "none";
  return {
    label: STORYVAULT_DRIFT_LABELS[drift],
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

const linkedSourceAssetIds = computed(() => {
  const ids = new Set<string>();
  for (const item of props.evidence) {
    if (item.sourceAssetId) ids.add(item.sourceAssetId);
  }
  return ids;
});

const linkedSourceAssets = computed(() =>
  props.sourceAssets.filter((asset) => linkedSourceAssetIds.value.has(asset.id))
);

const linkedOperationVideos = computed(() => {
  const sourceAssetIds = linkedSourceAssetIds.value;
  const operationVideoIds = new Set(
    linkedSourceAssets.value
      .map((asset) => metadataString(asset.metadata, "operationVideoId"))
      .filter(Boolean)
  );
  return props.clips.filter(
    (video) =>
      sourceAssetIds.has(video.sourceAssetId || "") ||
      sourceAssetIds.has(video.journeySourceAssetId || "") ||
      operationVideoIds.has(video.id)
  );
});

const reportMetrics = computed(() => [
  { label: "Evidence", value: props.evidence.length },
  { label: "Source assets", value: linkedSourceAssets.value.length },
  { label: "Videos", value: linkedOperationVideos.value.length },
  {
    label: "Screenshots",
    value: linkedOperationVideos.value.reduce(
      (sum, video) => sum + (video.frameCaptures?.length ?? 0),
      0
    ),
  },
]);

const reportFileStem = computed(() => {
  const key = props.story?.storyKey || props.story?.id || "story-report";
  return sanitizeFileStem(key);
});

const reportMarkdown = computed(() => {
  const story = props.story;
  if (!story) return "";
  const lines = [
    `# StoryVault Story Context: ${story.storyKey || story.id}`,
    "",
    "## Application",
    `- Name: ${props.application?.name || "n/a"}`,
    `- Application ID: ${props.application?.id || story.applicationId || "n/a"}`,
    `- Repository: ${story.repoFullName || props.application?.repoFullName || "n/a"}`,
    "",
    "## Story",
    `- Title: ${story.title}`,
    `- Summary: ${story.summary || "n/a"}`,
    `- User story: ${story.userStory || "n/a"}`,
    `- Status: ${story.status}`,
    `- Review state: ${story.reviewState}`,
    `- Drift: ${story.driftLevel}`,
    `- Confidence: ${story.confidenceScore}`,
    "",
    "## Acceptance Criteria",
    ...story.acceptanceCriteria.map(
      (ac, index) =>
        `${index + 1}. [${ac.state}] ${ac.text} (evidence: ${ac.evidenceIds.join(", ") || "n/a"})`
    ),
    "",
    "## Evidence",
    ...props.evidence.flatMap((item) => [
      `### ${item.title || item.id}`,
      `- Evidence ID: ${item.id}`,
      `- Type: ${item.type}`,
      `- Freshness: ${item.freshness}`,
      `- Excerpt: ${item.excerpt || "n/a"}`,
      `- Observed user action: ${item.observedUserAction || "n/a"}`,
      `- Observed UI surface: ${item.observedUiSurface || "n/a"}`,
      `- Source URL: ${item.sourceUrl || item.citation.uri || "n/a"}`,
      `- Source asset ID: ${item.sourceAssetId || "n/a"}`,
      `- Citation: ${item.citation.snippet || "n/a"}`,
      "",
    ]),
    "## Source Assets",
    ...linkedSourceAssets.value.flatMap((asset) => [
      `### ${asset.title || asset.id}`,
      `- Source asset ID: ${asset.id}`,
      `- Type: ${asset.sourceType}`,
      `- Summary: ${asset.summary || "n/a"}`,
      `- URI: ${asset.uri || "n/a"}`,
      `- GCS path: ${asset.gcsPath || "n/a"}`,
      `- Storage path: ${asset.storagePath || "n/a"}`,
      "",
    ]),
    "## Operation Videos",
    ...linkedOperationVideos.value.flatMap((video) => [
      `### ${video.title || video.id}`,
      `- Video URL: ${videoUrls[video.id] || "not resolved"}`,
      `- Storage path: ${video.storagePath}`,
      `- Screenshots: ${video.frameCaptures?.length ?? 0}`,
      ...(video.frameCaptures ?? []).slice(0, 24).map((frame) => {
        const url = frameUrls[frameKey(video.id, frame.id)] || frame.storagePath || "n/a";
        return `- Frame ${frame.id} at ${formatMilliseconds(frame.timestampMs)}: ${url}`;
      }),
      "",
    ]),
    "## Code References",
    ...story.codeRefs.map(
      (ref) =>
        `- ${ref.repoFullName || story.repoFullName || "repo"} ${ref.path || "(no path)"}${ref.lineStart ? `:${ref.lineStart}` : ""}${ref.pullRequest ? ` PR ${ref.pullRequest}` : ""}${ref.summary ? ` - ${ref.summary}` : ""}`
    ),
    "",
    "## Agent Instructions",
    "- Use this report as read-only implementation context.",
    "- Preserve cited evidence IDs in local implementation plans, pull request descriptions, and commit notes.",
  ];
  return lines.join("\n").trim() + "\n";
});

const reportHtml = computed(() => {
  const story = props.story;
  if (!story) return "";
  const evidenceChips = props.evidence.length
    ? props.evidence.map((item) => `<span class="chip">${escapeHtml(item.id)}</span>`).join("")
    : '<span class="chip">No evidence IDs</span>';
  const criteria = story.acceptanceCriteria.length
    ? story.acceptanceCriteria
        .map(
          (ac) => `<li><span class="state">${escapeHtml(ac.state)}</span><span>${escapeHtml(ac.text)}<br><small>evidence: ${escapeHtml(ac.evidenceIds.join(", ") || "n/a")}</small></span></li>`
        )
        .join("")
    : '<li><span class="state">n/a</span><span>No acceptance criteria recorded.</span></li>';
  const evidenceCards = props.evidence.length
    ? props.evidence
        .map(
          (item) => `<article class="panel item"><h3>${escapeHtml(item.title || item.id)}</h3><div class="kv"><b>Evidence ID</b><span>${escapeHtml(item.id)}</span></div><div class="kv"><b>Type</b><span>${escapeHtml(item.type)}</span></div><div class="kv"><b>Excerpt</b><span>${escapeHtml(item.excerpt || "n/a")}</span></div><div class="kv"><b>Observed action</b><span>${escapeHtml(item.observedUserAction || "n/a")}</span></div><div class="kv"><b>UI surface</b><span>${escapeHtml(item.observedUiSurface || "n/a")}</span></div><div class="kv"><b>Source asset</b><span>${escapeHtml(item.sourceAssetId || "n/a")}</span></div>${linkRow("Source URL", item.sourceUrl || item.citation.uri)}</article>`
        )
        .join("")
    : '<div class="panel"><p class="muted">No evidence is linked.</p></div>';
  const assetCards = linkedSourceAssets.value.length
    ? linkedSourceAssets.value
        .map(
          (asset) => `<article class="panel item"><h3>${escapeHtml(asset.title || asset.id)}</h3><div class="kv"><b>Type</b><span>${escapeHtml(asset.sourceType)}</span></div><div class="kv"><b>Summary</b><span>${escapeHtml(asset.summary || "n/a")}</span></div><div class="kv"><b>URI</b><span>${escapeHtml(asset.uri || "n/a")}</span></div><div class="kv"><b>GCS path</b><span>${escapeHtml(asset.gcsPath || "n/a")}</span></div><div class="kv"><b>Storage path</b><span>${escapeHtml(asset.storagePath || "n/a")}</span></div></article>`
        )
        .join("")
    : '<div class="panel"><p class="muted">No linked source assets.</p></div>';
  const videos = linkedOperationVideos.value.length
    ? linkedOperationVideos.value.map((video) => videoHtml(video)).join("")
    : '<div class="panel"><p class="muted">No linked operation videos.</p></div>';
  const codeRefs = story.codeRefs.length
    ? story.codeRefs
        .map(
          (ref) => `<li><strong>${escapeHtml(ref.repoFullName || story.repoFullName || "repo")}</strong> ${escapeHtml(ref.path || "(no path)")}${ref.lineStart ? `:${ref.lineStart}` : ""}${ref.pullRequest ? ` / PR ${escapeHtml(ref.pullRequest)}` : ""}</li>`
        )
        .join("")
    : '<li class="muted">No code references recorded.</li>';

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(story.storyKey || story.id)} StoryVault Story Context</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#fff;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}.page{max-width:1120px;margin:0 auto;padding:28px 22px 44px}.top{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #dbe3ef;padding-bottom:18px}.eyebrow{margin:0 0 4px;color:#64748b;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:0;font-size:38px;line-height:1.1}h2{margin:30px 0 12px;font-size:22px}h3{margin:0 0 8px;font-size:16px}a{color:#4f46e5;text-decoration:none}.summary{margin-top:10px;color:#334155}.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{border-radius:999px;background:#eef2ff;color:#3730a3;padding:3px 9px;font-size:12px;font-weight:800}.grid{display:grid;gap:12px}.cols4{grid-template-columns:repeat(4,minmax(0,1fr))}.cols2{grid-template-columns:repeat(2,minmax(0,1fr))}.metric,.panel{border:1px solid #dbe3ef;border-radius:8px;background:#fff;padding:14px}.metric{background:#f8fafc}.metric span{display:block;color:#64748b;font-size:12px;font-weight:800}.metric strong{display:block;font-size:18px}.criteria{margin:0;padding:0;list-style:none}.criteria li{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;border-top:1px solid #dbe3ef;padding:12px 0}.criteria li:first-child{border-top:0}.state{color:#047857;font-size:12px;font-weight:900;text-transform:uppercase}.item{margin-bottom:12px}.kv{display:grid;grid-template-columns:150px minmax(0,1fr);gap:8px;font-size:13px}.kv b,.muted,small{color:#64748b}.frames{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}video,img{width:100%;max-height:480px;border:1px solid #dbe3ef;border-radius:8px;background:#f1f5f9;object-fit:contain}.refs{padding-left:18px}li{overflow-wrap:anywhere}@media(max-width:860px){.page{padding:20px 14px}.top,.cols4,.cols2,.frames{display:grid;grid-template-columns:1fr}.criteria li,.kv{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main class="page">
    <header class="top"><div><p class="eyebrow">StoryVault Story Context Report</p><h1>${escapeHtml(story.storyKey || story.id)}</h1><p class="summary">${escapeHtml(story.title)}</p></div><div class="chips">${evidenceChips}</div></header>
    <section><h2>基本情報</h2><div class="grid cols4"><div class="metric"><span>Application</span><strong>${escapeHtml(props.application?.name || story.applicationId)}</strong></div><div class="metric"><span>Status</span><strong>${escapeHtml(story.status)}</strong></div><div class="metric"><span>Review</span><strong>${escapeHtml(story.reviewState)}</strong></div><div class="metric"><span>Confidence</span><strong>${story.confidenceScore}%</strong></div></div></section>
    <section class="grid cols2"><div><h2>ユーザーストーリー</h2><div class="panel">${escapeHtml(story.userStory || "No user story recorded.")}<p class="muted">${escapeHtml(story.summary || "")}</p></div></div><div><h2>素材</h2><div class="grid cols2"><div class="metric"><span>Evidence</span><strong>${props.evidence.length}</strong></div><div class="metric"><span>Source Assets</span><strong>${linkedSourceAssets.value.length}</strong></div><div class="metric"><span>Videos</span><strong>${linkedOperationVideos.value.length}</strong></div><div class="metric"><span>Screenshots</span><strong>${linkedOperationVideos.value.reduce((sum, video) => sum + (video.frameCaptures?.length ?? 0), 0)}</strong></div></div></div></section>
    <section><h2>受け入れ条件</h2><div class="panel"><ol class="criteria">${criteria}</ol></div></section>
    <section><h2>証跡</h2>${evidenceCards}</section>
    <section><h2>Source Assets</h2>${assetCards}</section>
    <section><h2>メディア</h2>${videos}</section>
    <section><h2>Code References</h2><div class="panel"><ul class="refs">${codeRefs}</ul></div></section>
  </main>
</body>
</html>`;
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

function evidenceColor(type: StoryVaultEvidenceType): "primary" | "info" | "success" | "warning" | "neutral" {
  if (type === "knowledge") return "primary";
  if (type === "code" || type === "commit") return "info";
  if (type === "pr") return "primary";
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

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function frameKey(videoId: string, frameId: string): string {
  return `${videoId}:${frameId}`;
}

function formatMilliseconds(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  const seconds = value / 1000;
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
  }
  return `${seconds.toFixed(1)}s`;
}

function sanitizeFileStem(value: string): string {
  return (
    value
      .trim()
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "story-report"
  );
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linkRow(label: string, url?: string): string {
  if (!url?.trim()) return "";
  const safeUrl = escapeHtml(url.trim());
  return `<div class="kv"><b>${escapeHtml(label)}</b><span><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a></span></div>`;
}

function videoHtml(video: DecodedStoryVaultClip): string {
  const videoUrl = videoUrls[video.id] || "";
  const frames = (video.frameCaptures ?? [])
    .slice(0, 24)
    .map((frame) => {
      const url = frameUrls[frameKey(video.id, frame.id)] || "";
      if (!url) return "";
      return `<figure><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(url)}" alt="${escapeHtml(frame.id)}"></a><figcaption class="muted">${escapeHtml(frame.id)} / ${escapeHtml(formatMilliseconds(frame.timestampMs))}</figcaption></figure>`;
    })
    .filter(Boolean)
    .join("");
  return `<article class="panel item"><h3>${escapeHtml(video.title || video.id)}</h3>${videoUrl ? `<video controls preload="metadata" src="${escapeHtml(videoUrl)}"></video><p><a href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer">クリップファイルを開く</a></p>` : `<p class="muted">${escapeHtml(video.storagePath || "No video URL")}</p>`}${frames ? `<div class="frames">${frames}</div>` : ""}</article>`;
}

async function resolveReportMediaUrls(): Promise<void> {
  await Promise.all(
    linkedOperationVideos.value.map(async (video) => {
      if (!videoUrls[video.id] && video.bucketName && video.storagePath) {
        try {
          const storageRef = storageRefForBucketPath({
            bucketName: video.bucketName,
            filePath: video.storagePath,
          });
          videoUrls[video.id] = await getDownloadURL(storageRef);
        } catch {
          videoUrls[video.id] = "";
        }
      }
      await Promise.all(
        (video.frameCaptures ?? []).map(async (frame) => {
          const key = frameKey(video.id, frame.id);
          if (frameUrls[key] || !frame.bucketName || !frame.storagePath) return;
          try {
            const storageRef = storageRefForBucketPath({
              bucketName: frame.bucketName,
              filePath: frame.storagePath,
            });
            frameUrls[key] = await getDownloadURL(storageRef);
          } catch {
            frameUrls[key] = "";
          }
        })
      );
    })
  );
}

function refreshReportHtmlUrl(): void {
  if (reportHtmlUrl.value) {
    URL.revokeObjectURL(reportHtmlUrl.value);
    reportHtmlUrl.value = "";
  }
  if (!reportHtml.value) return;
  reportHtmlUrl.value = URL.createObjectURL(
    new Blob([reportHtml.value], { type: "text/html;charset=utf-8" })
  );
}

type ExcelCellValue = string | number | boolean;
type ExcelRow = Record<string, ExcelCellValue>;

function excelCell(value: unknown): ExcelCellValue {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => excelCell(item)).join("\n");
  if (value === null || value === undefined) return "";
  return String(value);
}

function appendExcelSheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: ExcelRow[],
  linkColumns: string[] = []
): void {
  const data = rows.length ? rows : [{ メモ: "該当データなし" }];
  const sheet = XLSX.utils.json_to_sheet(data);
  const headers = Object.keys(data[0] ?? {});
  sheet["!cols"] = headers.map((header) => ({
    wch: Math.min(Math.max(header.length + 6, 14), 48),
  }));
  for (const linkColumn of linkColumns) {
    const columnIndex = headers.indexOf(linkColumn);
    if (columnIndex < 0) continue;
    data.forEach((row, rowIndex) => {
      const target = String(row[linkColumn] ?? "").trim();
      if (!/^https?:\/\//i.test(target)) return;
      const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex });
      const cell = sheet[address];
      if (!cell) return;
      cell.l = { Target: target, Tooltip: target };
    });
  }
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

function buildStoryReportWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const story = props.story;
  if (!story) {
    appendExcelSheet(workbook, "サマリー", [{ メモ: "ストーリーが選択されていません" }]);
    return workbook;
  }
  appendExcelSheet(workbook, "サマリー", [
    { 項目: "Application", 値: excelCell(props.application?.name || story.applicationKey) },
    { 項目: "Application ID", 値: excelCell(props.application?.id || story.applicationId) },
    { 項目: "Story Key", 値: excelCell(story.storyKey) },
    { 項目: "Story ID", 値: excelCell(story.id) },
    { 項目: "Title", 値: excelCell(story.title) },
    { 項目: "Status", 値: excelCell(story.status) },
    { 項目: "Review State", 値: excelCell(story.reviewState) },
    { 項目: "Drift", 値: excelCell(story.driftLevel) },
    { 項目: "Confidence", 値: excelCell(story.confidenceScore) },
    { 項目: "Evidence", 値: props.evidence.length },
    { 項目: "Source Assets", 値: linkedSourceAssets.value.length },
    { 項目: "Clips", 値: linkedOperationVideos.value.length },
    {
      項目: "Screenshots",
      値: linkedOperationVideos.value.reduce(
        (sum, video) => sum + (video.frameCaptures?.length ?? 0),
        0
      ),
    },
  ]);
  appendExcelSheet(workbook, "ユーザーストーリー", [
    {
      StoryKey: excelCell(story.storyKey),
      StoryID: excelCell(story.id),
      Title: excelCell(story.title),
      Summary: excelCell(story.summary),
      UserStory: excelCell(story.userStory),
      Domain: excelCell(story.domain),
      Milestone: excelCell(story.milestone),
      Labels: excelCell(story.labels),
      Repository: excelCell(story.repoFullName || props.application?.repoFullName),
      FileSpaceID: excelCell(story.fileSpaceId || props.application?.fileSpaceId),
      GeneratedAt: excelCell(story.generatedAt),
      KnowledgeCheckedAt: excelCell(story.sourceFreshness.knowledgeCheckedAt),
      GitHubCheckedAt: excelCell(story.sourceFreshness.githubCheckedAt),
      StaleSources: excelCell(story.sourceFreshness.staleSources),
    },
  ]);
  appendExcelSheet(
    workbook,
    "受け入れ条件",
    story.acceptanceCriteria.map((ac, index) => ({
      No: index + 1,
      ACID: excelCell(ac.id),
      Text: excelCell(ac.text),
      State: excelCell(ac.state),
      EvidenceIDs: excelCell(ac.evidenceIds),
    }))
  );
  appendExcelSheet(
    workbook,
    "証跡リンク",
    props.evidence.map((item) => ({
      EvidenceID: excelCell(item.id),
      Title: excelCell(item.title),
      Type: excelCell(item.type),
      Freshness: excelCell(item.freshness),
      ConfidenceImpact: excelCell(item.confidenceImpact),
      Excerpt: excelCell(item.excerpt),
      ObservedUserAction: excelCell(item.observedUserAction),
      ObservedUISurface: excelCell(item.observedUiSurface),
      SourceURL: excelCell(item.sourceUrl || item.citation.uri),
      SourceAssetID: excelCell(item.sourceAssetId),
      GCSPath: excelCell(item.gcsPath),
      FileSpaceDocumentID: excelCell(item.fileSpaceDocumentId),
      Repository: excelCell(item.repoFullName || item.codeRef?.repoFullName),
      PullRequest: excelCell(item.pullRequest || item.codeRef?.pullRequest),
      Commit: excelCell(item.commit || item.codeRef?.commit),
      Path: excelCell(item.path || item.codeRef?.path),
      CitationTitle: excelCell(item.citation.title),
      CitationSnippet: excelCell(item.citation.snippet),
    })),
    ["SourceURL"]
  );
  appendExcelSheet(
    workbook,
    "Source Assets",
    linkedSourceAssets.value.map((asset) => ({
      SourceAssetID: excelCell(asset.id),
      Title: excelCell(asset.title),
      SourceType: excelCell(asset.sourceType),
      Summary: excelCell(asset.summary),
      URI: excelCell(asset.uri),
      GCSPath: excelCell(asset.gcsPath),
      StoragePath: excelCell(asset.storagePath),
      FileSpaceID: excelCell(asset.fileSpaceId),
      FileSpaceDocumentID: excelCell(asset.fileSpaceDocumentId),
      Repository: excelCell(asset.repoFullName),
      Path: excelCell(asset.path),
      PullRequest: excelCell(asset.pullRequest),
      Commit: excelCell(asset.commit),
      DiscoveryStatus: excelCell(asset.discoveryStatus),
      DiscoveryDocumentID: excelCell(asset.discoveryDocumentId),
      DiscoveryError: excelCell(asset.discoveryErrorMessage),
    })),
    ["URI"]
  );
  appendExcelSheet(
    workbook,
    "クリップ",
    linkedOperationVideos.value.map((video) => ({
      ClipID: excelCell(video.id),
      Title: excelCell(video.title),
      VideoURL: excelCell(videoUrls[video.id]),
      StoragePath: excelCell(video.storagePath),
      Duration: excelCell(formatMilliseconds(video.durationMs)),
      DurationMs: excelCell(video.durationMs),
      Screenshots: excelCell(video.frameCaptures?.length ?? 0),
      AnalysisStatus: excelCell(video.analysisStatus),
      AnalyzedAt: excelCell(video.analyzedAt),
      SourceAssetID: excelCell(video.sourceAssetId),
      JourneySourceAssetID: excelCell(video.journeySourceAssetId),
    })),
    ["VideoURL"]
  );
  appendExcelSheet(
    workbook,
    "スクリーンショット",
    linkedOperationVideos.value.flatMap((video) =>
      (video.frameCaptures ?? []).map((frame) => ({
        ClipID: excelCell(video.id),
        FrameID: excelCell(frame.id),
        Timestamp: excelCell(formatMilliseconds(frame.timestampMs)),
        TimestampMs: excelCell(frame.timestampMs),
        URL: excelCell(frameUrls[frameKey(video.id, frame.id)]),
        StoragePath: excelCell(frame.storagePath),
        Width: excelCell(frame.width),
        Height: excelCell(frame.height),
      }))
    ),
    ["URL"]
  );
  appendExcelSheet(
    workbook,
    "Code References",
    story.codeRefs.map((ref) => ({
      Repository: excelCell(ref.repoFullName || story.repoFullName),
      Branch: excelCell(ref.branch),
      PullRequest: excelCell(ref.pullRequest),
      Commit: excelCell(ref.commit),
      Path: excelCell(ref.path),
      LineStart: excelCell(ref.lineStart),
      LineEnd: excelCell(ref.lineEnd),
      Summary: excelCell(ref.summary),
    }))
  );
  return workbook;
}

function currentReportText(): string {
  if (reportMode.value === "excel") {
    return reportExcelSheets
      .map((sheet) => `${sheet.name}: ${sheet.description}`)
      .join("\n");
  }
  return reportMode.value === "html" ? reportHtml.value : reportMarkdown.value;
}

function openReport(): void {
  if (reportMode.value === "excel") {
    downloadReport();
    return;
  }
  refreshReportHtmlUrl();
  if (reportMode.value === "html" && reportHtmlUrl.value) {
    window.open(reportHtmlUrl.value, "_blank", "noopener,noreferrer");
    return;
  }
  const url = URL.createObjectURL(
    new Blob([reportMarkdown.value], { type: "text/markdown;charset=utf-8" })
  );
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadReport(): void {
  if (reportMode.value === "excel") {
    const excelBuffer = XLSX.write(buildStoryReportWorkbook(), {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer;
    const url = URL.createObjectURL(
      new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reportFileStem.value}-storyvault-report.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }
  const text = currentReportText();
  if (!text) return;
  const isHtml = reportMode.value === "html";
  const url = URL.createObjectURL(
    new Blob([text], {
      type: isHtml ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8",
    })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${reportFileStem.value}-storyvault-report.${isHtml ? "html" : "md"}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyReport(): Promise<void> {
  await navigator.clipboard.writeText(currentReportText());
}

watch(
  () => [props.story?.id, activeTab.value],
  () => {
    if (activeTab.value === "report") {
      void resolveReportMediaUrls().then(refreshReportHtmlUrl);
    }
  },
  { immediate: true }
);

watch(
  reportHtml,
  () => {
    refreshReportHtmlUrl();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (reportHtmlUrl.value) {
    URL.revokeObjectURL(reportHtmlUrl.value);
  }
});
</script>
