<template>
  <section :class="rootClass">
    <div :class="toolbarClass">
      <div class="flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-center">
        <div class="flex min-w-0 items-center gap-2 xl:w-[18rem]">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-600">
            <UIcon name="material-symbols:account-tree-outline" class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <h2 class="truncate text-base font-bold text-slate-950">
              動画別ユーザーストーリー
            </h2>
            <p class="truncate text-xs font-medium text-slate-500">
              操作動画をEpic、抽出USをIssueとして確認します
            </p>
          </div>
        </div>

        <label class="relative block min-w-0 flex-1 xl:max-w-[34rem]">
          <UIcon
            name="material-symbols:search"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            v-model="query"
            type="search"
            class="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            placeholder="動画タイトル・概要・US候補で検索"
          >
        </label>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <div class="hidden items-center gap-1.5 text-xs lg:flex">
          <span class="rounded-md bg-slate-50 px-2.5 py-1 font-bold text-slate-500">
            Video <b class="ml-1 tabular-nums text-slate-950">{{ displayedVideoGroups.length }}</b>
          </span>
          <span class="rounded-md bg-slate-50 px-2.5 py-1 font-bold text-slate-500">
            US <b class="ml-1 tabular-nums text-slate-950">{{ visibleStoryCount }}</b>
          </span>
          <span class="rounded-md bg-slate-50 px-2.5 py-1 font-bold text-slate-500">
            Analyzed <b class="ml-1 tabular-nums text-slate-950">{{ analyzedVideoCount }}</b>
          </span>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            type="button"
            class="h-8 rounded-md px-2.5 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            :class="statusFilter === option.value ? 'bg-slate-950 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            @click="statusFilter = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <button
          type="button"
          class="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-violet-200 hover:text-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          @click="focusMode = !focusMode"
        >
          <UIcon
            :name="focusMode ? 'material-symbols:close-fullscreen' : 'material-symbols:open-in-full'"
            class="h-4 w-4"
          />
          {{ focusMode ? "戻る" : "集中表示" }}
        </button>
      </div>
    </div>

    <div
      v-if="videos.length === 0"
      class="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center"
    >
      <UIcon name="material-symbols:videocam-off-outline" class="h-10 w-10 text-slate-300" />
      <p class="mt-3 text-sm font-bold text-slate-800">
        操作動画がまだありません
      </p>
      <p class="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
        ザッピングで操作動画を録画すると、動画ごとのUS候補をここで確認できます。
      </p>
    </div>

    <div
      v-else-if="filteredVideoGroups.length === 0"
      class="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center"
    >
      <UIcon name="material-symbols:filter-alt-off-outline" class="h-10 w-10 text-slate-300" />
      <p class="mt-3 text-sm font-bold text-slate-800">
        条件に一致する動画がありません
      </p>
      <p class="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
        検索語または解析ステータスを変更してください。
      </p>
    </div>

    <div
      v-else
      :class="contentGridClass"
    >
      <aside class="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
        <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div class="min-w-0">
            <p class="text-xs font-bold uppercase text-slate-500">Epics</p>
            <p class="text-sm font-bold text-slate-900">操作動画</p>
          </div>
          <EnBadge variant="tag" size="xs">{{ filteredVideoGroups.length }}</EnBadge>
        </div>

        <div :class="epicListClass">
          <button
            type="button"
            class="mb-1 flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            :class="selectedVideoId === '' ? 'bg-violet-100 text-violet-900' : 'text-slate-600 hover:bg-white'"
            @click="selectedVideoId = ''"
          >
            <span>All issues</span>
            <span class="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-slate-600">
              {{ filteredStoryCount }}
            </span>
          </button>

          <button
            v-for="group in filteredVideoGroups"
            :key="group.video.id"
            type="button"
            class="group mb-1 grid w-full gap-2 rounded-md px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            :class="selectedVideoId === group.video.id ? 'bg-white text-slate-950 shadow-sm ring-1 ring-violet-100' : 'text-slate-600 hover:bg-white'"
            @click="selectedVideoId = group.video.id"
          >
            <div class="flex min-w-0 items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-2">
                <UIcon name="material-symbols:keyboard-arrow-right" class="h-4 w-4 shrink-0 text-slate-400" />
                <span class="truncate text-sm font-bold">
                  {{ displayVideoTitle(group.video) }}
                </span>
              </div>
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="statusDotClass(group.status.color)" />
            </div>
            <div class="ml-6 flex items-center justify-between gap-2">
              <span class="font-mono text-[11px] font-bold text-slate-400">
                {{ group.displayId }}
              </span>
              <span class="text-xs font-bold tabular-nums text-slate-500">
                {{ group.storyCount }} US
              </span>
            </div>
            <div class="ml-6 h-1 overflow-hidden rounded-full bg-slate-200">
              <div
                class="h-full rounded-full bg-violet-500"
                :style="{ width: `${Math.min(group.averageConfidence, 100)}%` }"
              />
            </div>
          </button>
        </div>
      </aside>

      <div class="min-w-0">
        <div class="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-500">
              Backlog / {{ selectedVideoId ? "Selected Epic" : "All issues" }}
            </p>
            <h3 class="mt-1 truncate text-lg font-bold text-slate-950">
              {{ selectedVideoTitle }}
            </h3>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-if="selectedVideoGroup"
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              @click="openSelectedVideoDetail"
            >
              <UIcon name="material-symbols:open-in-new" class="h-4 w-4" />
              詳細を見る
            </button>
            <EnBadge variant="tag" size="xs">
              {{ visibleStoryCount }} issues
            </EnBadge>
            <EnBadge color="success" variant="soft" size="xs">
              {{ displayedAnalyzedCount }} analyzed
            </EnBadge>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-[58rem] w-full border-collapse text-left text-sm">
            <thead class="bg-slate-50 text-[11px] font-bold uppercase tracking-normal text-slate-500">
              <tr>
                <th class="w-28 border-b border-slate-200 px-4 py-2">Key</th>
                <th class="border-b border-slate-200 px-4 py-2">Story</th>
                <th class="w-40 border-b border-slate-200 px-4 py-2">Capture</th>
                <th class="w-36 border-b border-slate-200 px-4 py-2">Evidence</th>
                <th class="w-24 border-b border-slate-200 px-4 py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="group in displayedVideoGroups"
                :key="group.video.id"
              >
                <tr class="bg-slate-50/80">
                  <td colspan="5" class="border-b border-slate-200 px-4 py-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="rounded-md border border-slate-200 bg-slate-950 px-2 py-0.5 font-mono text-xs font-bold text-white">
                        {{ group.displayId }}
                      </span>
                      <span class="min-w-0 truncate text-sm font-bold text-slate-900">
                        {{ displayVideoTitle(group.video) }}
                      </span>
                      <EnBadge :color="group.status.color" variant="soft" size="xs">
                        {{ group.status.label }}
                      </EnBadge>
                      <EnBadge variant="tag" size="xs">{{ group.storyCount }} US</EnBadge>
                      <span class="text-xs font-medium text-slate-400">
                        {{ formatRecordedAt(group.video.recordedAt) }}
                      </span>
                    </div>
                    <p
                      v-if="group.video.analysisErrorMessage"
                      class="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                    >
                      {{ group.video.analysisErrorMessage }}
                    </p>
                  </td>
                </tr>

                <tr v-if="!isVideoAnalyzed(group.video)">
                  <td colspan="5" class="border-b border-slate-100 px-3 py-8 text-center text-sm text-slate-500">
                    {{ emptyStatusMessage(group.video) }}
                  </td>
                </tr>
                <tr v-else-if="group.stories.length === 0">
                  <td colspan="5" class="border-b border-slate-100 px-3 py-8 text-center text-sm text-slate-500">
                    {{ group.storyCount === 0 ? "この動画からUS候補は生成されませんでした。" : "検索条件に一致するUS候補がありません。" }}
                  </td>
                </tr>

                <template v-else>
                  <tr
                    v-for="(story, storyIndex) in group.stories"
                    :key="story.id"
                    class="bg-white align-top transition hover:bg-slate-50"
                  >
                    <td class="border-b border-slate-100 px-4 py-3">
                      <div class="flex flex-col gap-1">
                        <span class="font-mono text-xs font-bold text-slate-700">
                          {{ displayStoryKey(story, storyIndex) }}
                        </span>
                        <span class="text-[11px] font-semibold text-slate-400">
                          #{{ storyIndex + 1 }}
                        </span>
                      </div>
                    </td>
                    <td class="border-b border-slate-100 px-4 py-3">
                      <div class="flex min-w-0 items-start gap-3">
                        <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-emerald-100 text-emerald-700">
                          <UIcon name="material-symbols:bookmark-outline" class="h-4 w-4" />
                        </span>
                        <div class="min-w-0">
                          <p class="line-clamp-1 text-base font-bold leading-snug text-slate-950">
                            {{ story.title }}
                          </p>
                          <p class="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">
                            {{ story.role?.value || story.asA || story.goal || story.iWant || "対象ユーザー未生成" }}
                          </p>
                          <p
                            v-if="story.acceptanceCriteria.length > 0"
                            class="mt-1 line-clamp-1 text-xs leading-relaxed text-slate-500"
                          >
                            {{ story.acceptanceCriteria[0] }}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td class="border-b border-slate-100 px-4 py-3">
                      <figure
                        v-if="storyThumbnailUrl(group.video, story)"
                        class="overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm"
                      >
                        <img
                          :src="storyThumbnailUrl(group.video, story)"
                          class="aspect-video w-full object-cover"
                          :alt="`${displayStoryKey(story, storyIndex)} のキャプチャ`"
                        >
                        <figcaption class="truncate bg-white px-2 py-1 font-mono text-[11px] font-bold text-violet-600">
                          {{ formatEvidenceRange(primaryEvidence(story)?.tRange ?? [0, 0]) }}
                        </figcaption>
                      </figure>
                      <div
                        v-else
                        class="flex aspect-video items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-300"
                      >
                        <UIcon name="material-symbols:image-not-supported-outline" class="h-5 w-5" />
                      </div>
                    </td>
                    <td class="border-b border-slate-100 px-4 py-3">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <EnBadge color="neutral" variant="soft" size="xs">
                          {{ story.evidence.length }}件
                        </EnBadge>
                        <EnBadge
                          v-if="story.role"
                          :color="story.role.grounding === 'explicit' ? 'success' : 'warning'"
                          variant="soft"
                          size="xs"
                        >
                          {{ story.role.grounding === "explicit" ? "発話" : "推定" }}
                        </EnBadge>
                      </div>
                      <p
                        v-if="primaryEvidence(story)"
                        class="mt-2 line-clamp-1 text-xs leading-relaxed text-slate-500"
                      >
                        {{ primaryEvidence(story)?.title || primaryEvidence(story)?.summary || "動画根拠" }}
                      </p>
                    </td>
                    <td class="border-b border-slate-100 px-4 py-3">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-bold tabular-nums" :class="confidenceTextClass(storyConfidence(story))">
                          {{ storyConfidence(story) }}%
                        </span>
                        <EnBadge
                          v-if="story.unverified"
                          color="warning"
                          variant="soft"
                          size="xs"
                        >
                          未検証
                        </EnBadge>
                      </div>
                      <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          class="h-full rounded-full"
                          :class="confidenceBarClass(storyConfidence(story))"
                          :style="{ width: `${storyConfidence(story)}%` }"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { getDownloadURL } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import type {
  DecodedVibeControlOperationVideo,
  VibeControlZappingAnalysisStatus,
  VibeControlZappingAnalysisStoryCandidate,
} from "@models/vibeControl";

type StatusFilter = VibeControlZappingAnalysisStatus | "all";
type BadgeColor = "neutral" | "primary" | "info" | "success" | "warning" | "error";

type VideoGroup = {
  video: DecodedVibeControlOperationVideo;
  displayId: string;
  status: {
    label: string;
    color: BadgeColor;
  };
  stories: VibeControlZappingAnalysisStoryCandidate[];
  storyCount: number;
  evidenceCount: number;
  averageConfidence: number;
};

const props = defineProps<{
  applicationId?: string;
  videos: DecodedVibeControlOperationVideo[];
}>();

const route = useRoute();
const router = useRouter();
const query = ref("");
const statusFilter = ref<StatusFilter>("all");
const selectedVideoId = ref("");
const focusMode = ref(false);
const frameUrls = reactive<Record<string, string>>({});

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "すべて", value: "all" },
  { label: "未解析", value: "not_analyzed" },
  { label: "解析中", value: "running" },
  { label: "解析済み", value: "completed" },
  { label: "エラー", value: "error" },
];

const rootClass = computed(() =>
  focusMode.value
    ? "fixed inset-0 z-[70] min-w-0 space-y-3 overflow-auto bg-slate-50 p-3"
    : "min-w-0 space-y-3"
);

const toolbarClass = computed(() =>
  [
    "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm xl:flex-row xl:items-center xl:justify-between",
    focusMode.value ? "sticky top-0 z-10" : "",
  ].filter(Boolean).join(" ")
);

const contentGridClass = computed(() =>
  [
    "grid min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[18rem_minmax(0,1fr)]",
    focusMode.value ? "min-h-[calc(100vh-5.25rem)]" : "",
  ].filter(Boolean).join(" ")
);

const epicListClass = computed(() =>
  [
    "overflow-y-auto p-2",
    focusMode.value ? "max-h-[calc(100vh-9rem)]" : "max-h-[34rem]",
  ].join(" ")
);

const filteredVideoGroups = computed<VideoGroup[]>(() => {
  const normalizedQuery = query.value.trim().toLowerCase();

  return props.videos
    .map((video, index) => buildVideoGroup(video, index, normalizedQuery))
    .filter((group) => {
      if (statusFilter.value !== "all") {
        const status = normalizedAnalysisStatus(group.video);
        if (statusFilter.value === "running") {
          if (status !== "queued" && status !== "running") return false;
        } else if (status !== statusFilter.value) {
          return false;
        }
      }

      if (!normalizedQuery) return true;
      return videoMatchesQuery(group.video, normalizedQuery) || group.stories.length > 0;
    });
});

const displayedVideoGroups = computed(() => {
  if (!selectedVideoId.value) return filteredVideoGroups.value;
  return filteredVideoGroups.value.filter(
    (group) => group.video.id === selectedVideoId.value
  );
});

const filteredStoryCount = computed(() =>
  filteredVideoGroups.value.reduce((sum, group) => sum + group.stories.length, 0)
);

const visibleStoryCount = computed(() =>
  displayedVideoGroups.value.reduce((sum, group) => sum + group.stories.length, 0)
);

const analyzedVideoCount = computed(
  () => props.videos.filter((video) => isVideoAnalyzed(video)).length
);

const displayedAnalyzedCount = computed(
  () => displayedVideoGroups.value.filter((group) => isVideoAnalyzed(group.video)).length
);

const selectedVideoGroup = computed(() => {
  if (!selectedVideoId.value) return null;
  return filteredVideoGroups.value.find(
    (item) => item.video.id === selectedVideoId.value
  ) ?? null;
});

const selectedVideoTitle = computed(() => {
  if (!selectedVideoId.value) return "All issues";
  const group = selectedVideoGroup.value;
  return group ? displayVideoTitle(group.video) : "All issues";
});

watch(filteredVideoGroups, (groups) => {
  if (!selectedVideoId.value) return;
  if (groups.some((group) => group.video.id === selectedVideoId.value)) return;
  selectedVideoId.value = "";
});

watch(
  () => props.videos,
  (videos) => {
    void resolveFrameUrls(videos);
  },
  { immediate: true, deep: true }
);

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  focusMode.value = false;
}

function openSelectedVideoDetail(): void {
  const group = selectedVideoGroup.value;
  if (!group) return;
  const href = router.resolve({
    path: route.path,
    query: {
      ...route.query,
      view: "application-zapping",
      applicationId: props.applicationId || route.query.applicationId,
      operationVideoId: group.video.id,
      operationVideoTab: "storyAnalysis",
      action: undefined,
    },
  }).href;
  window.open(href, "_blank", "noopener,noreferrer");
}

function buildVideoGroup(
  video: DecodedVibeControlOperationVideo,
  index: number,
  normalizedQuery: string
): VideoGroup {
  const stories = video.analysisResult?.storyCandidates ?? [];
  const videoHit = normalizedQuery
    ? videoMatchesQuery(video, normalizedQuery)
    : true;
  const visibleStories =
    normalizedQuery && !videoHit
      ? stories.filter((story) => storyMatchesQuery(story, normalizedQuery))
      : stories;
  const confidenceValues = visibleStories.map(storyConfidence);
  return {
    video,
    displayId: `VID${index + 1}`,
    status: statusMeta(video),
    stories: visibleStories,
    storyCount: stories.length,
    evidenceCount: visibleStories.reduce(
      (sum, story) => sum + story.evidence.length,
      0
    ),
    averageConfidence:
      confidenceValues.length === 0
        ? 0
        : Math.round(
            confidenceValues.reduce((sum, value) => sum + value, 0) /
              confidenceValues.length
          ),
  };
}

function normalizedAnalysisStatus(
  video: DecodedVibeControlOperationVideo
): VibeControlZappingAnalysisStatus {
  if (video.analysisStatus === "completed" || video.analysisResult) {
    return "completed";
  }
  return video.analysisStatus;
}

function isVideoAnalyzed(video: DecodedVibeControlOperationVideo): boolean {
  return normalizedAnalysisStatus(video) === "completed";
}

function statusMeta(video: DecodedVibeControlOperationVideo): {
  label: string;
  color: BadgeColor;
} {
  const status = normalizedAnalysisStatus(video);
  if (status === "completed") return { label: "解析済み", color: "success" };
  if (status === "queued") return { label: "待機中", color: "info" };
  if (status === "running") return { label: "解析中", color: "warning" };
  if (status === "error") return { label: "エラー", color: "error" };
  return { label: "未解析", color: "neutral" };
}

function emptyStatusMessage(video: DecodedVibeControlOperationVideo): string {
  const status = normalizedAnalysisStatus(video);
  if (status === "queued") return "解析リクエストは待機中です。";
  if (status === "running") return "動画とナレッジを照合して解析しています。";
  if (status === "error") return "解析に失敗しました。";
  return "この動画はまだ解析されていません。";
}

function displayVideoTitle(video: DecodedVibeControlOperationVideo): string {
  return video.quickScan?.title?.trim() || video.title;
}

function displayStoryKey(
  story: VibeControlZappingAnalysisStoryCandidate,
  index: number
): string {
  return story.storyKey?.trim() || `US-${String(index + 1).padStart(3, "0")}`;
}

function storyConfidence(
  story: VibeControlZappingAnalysisStoryCandidate
): number {
  return Math.round(story.confidence ?? story.confidenceScore ?? 0);
}

function confidenceTextClass(confidence: number): string {
  if (confidence >= 85) return "text-emerald-700";
  if (confidence >= 70) return "text-sky-700";
  if (confidence >= 50) return "text-amber-700";
  return "text-rose-700";
}

function confidenceBarClass(confidence: number): string {
  if (confidence >= 85) return "bg-emerald-500";
  if (confidence >= 70) return "bg-sky-500";
  if (confidence >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function statusDotClass(color: BadgeColor): string {
  if (color === "success") return "bg-emerald-500";
  if (color === "info") return "bg-sky-500";
  if (color === "warning") return "bg-amber-500";
  if (color === "error") return "bg-rose-500";
  if (color === "primary") return "bg-violet-500";
  return "bg-slate-300";
}

function primaryEvidence(
  story: VibeControlZappingAnalysisStoryCandidate
): VibeControlZappingAnalysisStoryCandidate["evidence"][number] | undefined {
  return story.evidence[0];
}

function frameKey(videoId: string, frameId: string): string {
  return `${videoId}:${frameId}`;
}

function savedFrameUrl(
  video: DecodedVibeControlOperationVideo,
  frameId?: string
): string {
  if (!frameId) return "";
  return frameUrls[frameKey(video.id, frameId)] ?? "";
}

function storyThumbnailFrame(
  video: DecodedVibeControlOperationVideo,
  story: VibeControlZappingAnalysisStoryCandidate
): DecodedVibeControlOperationVideo["frameCaptures"][number] | undefined {
  const evidence = primaryEvidence(story);
  if (!evidence) return undefined;
  return storyEvidenceFrames(video, evidence)[0];
}

function storyThumbnailUrl(
  video: DecodedVibeControlOperationVideo,
  story: VibeControlZappingAnalysisStoryCandidate
): string {
  return savedFrameUrl(video, storyThumbnailFrame(video, story)?.id);
}

function storyEvidenceFrames(
  video: DecodedVibeControlOperationVideo,
  evidence: VibeControlZappingAnalysisStoryCandidate["evidence"][number]
): DecodedVibeControlOperationVideo["frameCaptures"] {
  const evidenceIds = new Set(
    [
      evidence.representativeScreenshotId,
      ...evidence.screenshotIds,
    ].filter(Boolean)
  );
  const byId = video.frameCaptures.filter((frame) => evidenceIds.has(frame.id));
  if (byId.length > 0) {
    return byId.sort((a, b) => {
      const aRepresentative = a.id === evidence.representativeScreenshotId ? 0 : 1;
      const bRepresentative = b.id === evidence.representativeScreenshotId ? 0 : 1;
      return aRepresentative - bRepresentative || a.timestampMs - b.timestampMs;
    });
  }

  const startMs = Math.max(0, (evidence.tRange[0] ?? 0) * 1000);
  const endMs = Math.max(startMs, (evidence.tRange[1] ?? evidence.tRange[0] ?? 0) * 1000);
  const withinRange = video.frameCaptures.filter(
    (frame) => frame.timestampMs >= startMs && frame.timestampMs <= endMs
  );
  return withinRange.length > 0 ? withinRange : nearestFrames(video, startMs, 1);
}

function nearestFrames(
  video: DecodedVibeControlOperationVideo,
  timestampMs: number,
  maxCount: number
): DecodedVibeControlOperationVideo["frameCaptures"] {
  return [...video.frameCaptures]
    .sort(
      (a, b) =>
        Math.abs(a.timestampMs - timestampMs) - Math.abs(b.timestampMs - timestampMs)
    )
    .slice(0, maxCount)
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

async function resolveFrameUrls(
  videos: DecodedVibeControlOperationVideo[]
): Promise<void> {
  await Promise.all(
    videos.flatMap((video) =>
      video.frameCaptures.map(async (frame) => {
        if (!frame.storagePath || !frame.bucketName) return;
        const key = frameKey(video.id, frame.id);
        if (frameUrls[key] !== undefined) return;
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
    )
  );
}

function videoMatchesQuery(
  video: DecodedVibeControlOperationVideo,
  normalizedQuery: string
): boolean {
  return [
    video.title,
    video.description,
    video.transcriptSummary,
    video.quickScan?.title,
    video.quickScan?.description,
    video.quickScan?.operationMemo,
    video.quickScan?.transcriptSummary,
    ...(video.quickScan?.operationSteps ?? []),
    video.analysisResult?.operationIntent,
    video.analysisResult?.productContextSummary,
    video.analysisResult?.transcriptSummary,
    ...(video.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function storyMatchesQuery(
  story: VibeControlZappingAnalysisStoryCandidate,
  normalizedQuery: string
): boolean {
  return [
    story.id,
    story.storyKey,
    story.title,
    story.role?.value,
    story.goal,
    story.benefit,
    story.summary,
    story.userStory,
    story.asA,
    story.iWant,
    story.soThat,
    ...story.acceptanceCriteria,
    ...story.evidence.flatMap((item) => [item.title, item.summary]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function formatEvidenceRange(range: [number, number] | number[]): string {
  const [start, end] = range;
  return `${formatDuration(start * 1000)} - ${formatDuration(end * 1000)}`;
}

function formatDuration(durationMs?: number): string {
  if (!durationMs || durationMs <= 0) return "0:00";
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatRecordedAt(value?: string): string {
  if (!value) return "録画日時なし";
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
