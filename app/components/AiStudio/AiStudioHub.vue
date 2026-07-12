<template>
  <div class="flex w-full min-w-0 flex-col gap-4">
    <EnAiPageHeader
      title="AIスタジオ"
      subtitle="経営相談・書類・画像・調査レポートのセッションを一覧し、続きから再開できます"
      icon="flat-color-icons:combo-chart"
    >
      <template #trailing>
        <div class="flex flex-wrap items-center gap-2">
          <EnButton
            variant="outline"
            color="neutral"
            size="sm"
            leading-icon="material-symbols:refresh"
            :disabled="listLoading"
            @click="onRefresh"
          >
            更新
          </EnButton>
          <EnButton
            variant="ai"
            size="sm"
            leading-icon="material-symbols:add"
            @click="onNewSession"
          >
            新しいセッション
          </EnButton>
        </div>
      </template>
    </EnAiPageHeader>

    <AiStudioModeSegmentBar
      v-model="kindFilter"
      :items="kindTabItems"
      size="sm"
      density="compact"
      label-mode="label"
      class="w-full min-w-0"
      aria-label="セッション種別"
      data-testid="ai-studio-hub-kind-tabs"
    />

    <section :class="ADMIN_COLLECTION_PANEL_CLASS">
      <div
        class="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <div class="relative min-w-0 flex-1 sm:max-w-md">
          <UIcon
            name="material-symbols:search"
            class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="履歴を検索…"
            class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          >
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <button
            v-for="f in statusFilters"
            :key="f.key"
            type="button"
            :class="[
              'rounded-full px-3 py-1 text-xs font-semibold transition',
              statusFilter === f.key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            ]"
            @click="statusFilter = f.key"
          >
            {{ f.label }}
            <span
              class="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
              :class="
                statusFilter === f.key ? 'bg-white/20' : 'bg-slate-100'
              "
            >
              {{ f.count }}
            </span>
          </button>
        </div>
      </div>

      <div
        v-if="listLoading"
        class="px-4 py-4"
        data-testid="ai-studio-hub-skeleton"
        aria-busy="true"
        aria-label="セッション履歴を読み込み中"
      >
        <div :class="[ADMIN_AUTO_FILL_GRID_CLASS, 'gap-3']">
          <div
            v-for="index in skeletonCardCount"
            :key="index"
            class="flex min-h-[10.875rem] flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
          >
            <div class="flex items-center gap-2">
              <USkeleton class="h-4 w-4 rounded" />
              <USkeleton class="h-3 w-20 rounded" />
            </div>

            <div class="flex min-w-0 flex-1 items-start gap-2.5">
              <USkeleton class="h-12 w-12 shrink-0 rounded-lg" />
              <div class="min-w-0 flex-1 space-y-2 pt-0.5">
                <USkeleton class="h-4 w-full rounded" />
                <USkeleton class="h-4 w-3/4 rounded" />
              </div>
            </div>

            <div class="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
              <div class="flex items-center gap-3">
                <USkeleton class="h-3 w-14 rounded" />
                <USkeleton class="h-3 w-8 rounded" />
              </div>
              <USkeleton class="h-7 w-16 rounded-md" />
            </div>
          </div>
        </div>

        <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <USkeleton class="h-3 w-28 rounded" />
          <div class="flex gap-1">
            <USkeleton
              v-for="index in 3"
              :key="index"
              class="h-7 w-7 rounded-md"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="filteredRows.length === 0"
        class="flex flex-col items-center px-6 py-14 text-center"
      >
        <UIcon
          :name="emptyStateIcon"
          class="mb-4 h-16 w-16 opacity-90"
        />
        <p class="text-base font-semibold text-slate-800">
          {{ emptyStateHeading }}
        </p>
        <p class="mt-2 max-w-md text-sm text-slate-500">
          {{ emptyStateDescription }}
        </p>
        <EnButton
          class="mt-6"
          variant="ai"
          size="md"
          leading-icon="material-symbols:add"
          @click="onNewSession"
        >
          {{ newSessionButtonLabel }}
        </EnButton>
      </div>

      <template v-else>
        <div
          :class="[ADMIN_AUTO_FILL_GRID_CLASS, 'gap-3 px-4 py-4']"
        >
          <div
            v-for="row in paginatedRows"
            :key="row.sessionId"
            :class="[
              'group relative flex cursor-pointer flex-col gap-2.5 rounded-xl border p-3.5 transition hover:shadow-md',
              jobTone(row.jobKind).card,
            ]"
            @click="openSession(row.sessionId)"
          >
            <div class="flex items-center gap-2">
              <div class="flex min-w-0 items-center gap-1.5">
                <UIcon
                  :name="row.jobMeta?.icon ?? 'material-symbols:chat'"
                  class="h-4 w-4 shrink-0"
                  :class="row.jobMeta ? '' : 'text-slate-400'"
                />
                <span class="truncate text-xs font-medium text-slate-500">
                  {{ row.jobLabel }}
                </span>
              </div>
            </div>

            <div class="flex min-w-0 items-start gap-2.5">
              <AgentWorkspaceSessionThumbnail
                v-if="row.imageThumbnail"
                :session-id="row.sessionId"
                :thumbnail="row.imageThumbnail"
                class="!h-12 !w-12"
              />
              <div
                v-else-if="researchPreviews[row.sessionId]?.imageUrl"
                class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/5"
              >
                <img
                  :src="researchPreviews[row.sessionId]?.imageUrl ?? ''"
                  :alt="`${hubRowTitle(row)}の図解`"
                  class="h-full w-full object-cover"
                  loading="lazy"
                >
              </div>
              <div
                v-else-if="row.jobKind === 'research'"
                :class="[
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1',
                  jobTone(row.jobKind).thumbnail,
                ]"
                aria-hidden="true"
              >
                <UIcon
                  name="material-symbols:auto-stories"
                  class="h-6 w-6 text-slate-600"
                />
              </div>
              <p
                :class="[
                  'line-clamp-2 min-h-[2.5rem] flex-1 text-sm font-semibold leading-snug text-slate-900',
                  jobTone(row.jobKind).titleHover,
                ]"
              >
                {{ hubRowTitle(row) }}
              </p>
            </div>

            <div
              :class="[
                'flex items-center justify-between gap-2 border-t pt-2',
                jobTone(row.jobKind).footerBorder,
              ]"
            >
              <div class="flex items-center gap-3 text-xs text-slate-500">
                <span class="inline-flex items-center gap-1 tabular-nums">
                  <UIcon
                    name="material-symbols:schedule-outline"
                    class="h-3.5 w-3.5"
                  />
                  {{ formatRelativeTime({ timestampMs: row.updatedAt }) }}
                </span>
                <span class="inline-flex items-center gap-1 tabular-nums">
                  <UIcon
                    name="material-symbols:chat-bubble-outline"
                    class="h-3.5 w-3.5"
                  />
                  {{ row.messageCount }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <EnButton
                  v-if="row.jobKind === 'research'"
                  variant="soft"
                  color="neutral"
                  size="xs"
                  leading-icon="material-symbols:download"
                  :disabled="!researchPreviews[row.sessionId]?.htmlArtifact"
                  :loading="researchDownloadSessionId === row.sessionId"
                  custom-class="whitespace-nowrap"
                  title="調査レポートをHTMLでダウンロード"
                  @click.stop="downloadResearchHtml(row)"
                >
                  HTML
                </EnButton>
                <EnButton
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  leading-icon="material-symbols:delete-outline"
                  @click.stop="onDelete(row.sessionId)"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          class="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-xs text-slate-500">
            <template v-if="filteredRows.length > 0">
              {{ paginationLabel }}
            </template>
          </p>
          <UPagination
            v-if="filteredRows.length > pageSize"
            v-model:page="page"
            :total="filteredRows.length"
            :items-per-page="pageSize"
            :sibling-count="1"
            show-controls
            show-edges
          />
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import EnAiPageHeader from "@components/ai/EnAiPageHeader.vue";
import AiStudioModeSegmentBar from "@components/AiStudio/AiStudioModeSegmentBar.vue";
import AgentWorkspaceSessionThumbnail from "@components/AgentWorkspace/AgentWorkspaceSessionThumbnail.vue";
import EnButton from "@components/EnButton.vue";
import {
  ADMIN_AUTO_FILL_GRID_CLASS,
  ADMIN_COLLECTION_PANEL_CLASS,
} from "@composables/useAdminViewport";
import {
  AI_STUDIO_HUB_JOB_META,
  AI_STUDIO_HUB_KIND_FILTER_ALL,
  AI_STUDIO_HUB_VISIBLE_JOB_KINDS,
  aiStudioHubKindToQuery,
  jobKindForNewSession,
  parseAiStudioHubKindFilter,
  resolveAiStudioHubJobMeta,
  type AiStudioHubJobMeta,
  type AiStudioHubKindFilter,
} from "@constants/aiStudioHub";
import {
  aiStudioSessionsReady,
  aiStudioSessionsRevision,
  subscribeAiStudioSessions,
  useAiStudioSessions,
  type AiStudioSessionListItem,
} from "@composables/useAiStudioSessions";
import { fetchSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import { useAiStudioStore } from "@stores/aiStudio";
import type { AiStudioJobKind } from "@stores/aiStudio";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import type { DecodedAdkSessionArtifact } from "@models/adkSessionArtifact";
import {
  hasStartedAiStudioSession,
  matchesAiStudioCompletionFilter,
  type AiStudioCompletionFilter,
} from "@utils/aiStudioHubSessionFilter";
import { resolveAiStudioResearchArtifacts } from "@utils/aiStudioResearchPreview";
import {
  fetchArtifactTextContent,
  resolveArtifactDisplayUrl,
} from "@utils/artifactDisplayUrl";
import { downloadHtmlDocument } from "@utils/consultingReportHtml";
import { formatRelativeTime } from "@utils/formatRelativeTime";
import log from "@utils/logger";

const emit = defineEmits<{
  "open-session": [sessionId: string];
  "new-session": [jobKind: AiStudioJobKind | null];
}>();

const route = useRoute();
const router = useRouter();
const store = useAiStudioStore();
const sessionsApi = useAiStudioSessions();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
const toast = useToast();

const listLoading = ref(true);
const searchQuery = ref("");
const statusFilter = ref<AiStudioCompletionFilter>("all");
const page = ref(1);
const pageSize = 20;
const skeletonCardCount = 10;
const researchDownloadSessionId = ref<string | null>(null);

type ResearchPreviewState = {
  htmlArtifact: DecodedAdkSessionArtifact | null;
  imageUrl: string | null;
  loaded: boolean;
  sourceUpdatedAt: number;
};

const researchPreviews = ref<Record<string, ResearchPreviewState>>({});
const loadingResearchPreviews = new Set<string>();

const JOB_TONES = {
  consultation: {
    card: "border-violet-200/70 bg-violet-50/45 hover:border-violet-300",
    thumbnail: "bg-violet-50 ring-violet-100",
    titleHover: "group-hover:text-violet-800",
    footerBorder: "border-violet-100",
  },
  writing: {
    card: "border-lime-200/70 bg-lime-50/40 hover:border-lime-300",
    thumbnail: "bg-lime-50 ring-lime-100",
    titleHover: "group-hover:text-lime-800",
    footerBorder: "border-lime-100",
  },
  sheet: {
    card: "border-cyan-200/70 bg-cyan-50/40 hover:border-cyan-300",
    thumbnail: "bg-cyan-50 ring-cyan-100",
    titleHover: "group-hover:text-cyan-800",
    footerBorder: "border-cyan-100",
  },
  image: {
    card: "border-violet-200/70 bg-violet-50/40 hover:border-violet-300",
    thumbnail: "bg-violet-50 ring-violet-100",
    titleHover: "group-hover:text-violet-800",
    footerBorder: "border-violet-100",
  },
  data_analysis: {
    card: "border-teal-200/70 bg-teal-50/40 hover:border-teal-300",
    thumbnail: "bg-teal-50 ring-teal-100",
    titleHover: "group-hover:text-teal-800",
    footerBorder: "border-teal-100",
  },
  web_page: {
    card: "border-cyan-200/70 bg-cyan-50/40 hover:border-cyan-300",
    thumbnail: "bg-cyan-50 ring-cyan-100",
    titleHover: "group-hover:text-cyan-800",
    footerBorder: "border-cyan-100",
  },
  application_scan: {
    card: "border-amber-200/70 bg-amber-50/40 hover:border-amber-300",
    thumbnail: "bg-amber-50 ring-amber-100",
    titleHover: "group-hover:text-amber-800",
    footerBorder: "border-amber-100",
  },
  research: {
    card: "border-slate-300/70 bg-slate-50/70 hover:border-slate-400",
    thumbnail: "bg-slate-100 ring-slate-200",
    titleHover: "group-hover:text-slate-700",
    footerBorder: "border-slate-200",
  },
  default: {
    card: "border-slate-200 bg-white hover:border-slate-300",
    thumbnail: "bg-slate-50 ring-slate-100",
    titleHover: "group-hover:text-slate-700",
    footerBorder: "border-slate-100",
  },
} as const;

const jobTone = (jobKind: AiStudioJobKind) =>
  (jobKind && JOB_TONES[jobKind]) || JOB_TONES.default;

const kindFilter = ref<AiStudioHubKindFilter>(
  parseAiStudioHubKindFilter(route.query.kind ?? route.query.preferred)
);

let unsubscribeSessions: (() => void) | null = null;

const resubscribeSessions = (): void => {
  unsubscribeSessions?.();
  unsubscribeSessions = subscribeAiStudioSessions();
};

onMounted(() => {
  resubscribeSessions();
  listLoading.value = !aiStudioSessionsReady.value;
});

onUnmounted(() => {
  unsubscribeSessions?.();
  unsubscribeSessions = null;
});

watch(
  aiStudioSessionsReady,
  (ready) => {
    listLoading.value = !ready;
  },
  { immediate: true }
);

watch(
  () => [
    organizationStore.loggedInOrganizationInfo?.id,
    spaceStore.selectedSpace?.id,
  ],
  () => {
    resubscribeSessions();
    listLoading.value = !aiStudioSessionsReady.value;
  }
);

watch(
  () => [route.query.kind, route.query.preferred],
  () => {
    const next = parseAiStudioHubKindFilter(
      route.query.kind ?? route.query.preferred
    );
    if (next !== kindFilter.value) {
      kindFilter.value = next;
    }
  }
);

watch(kindFilter, (next) => {
  page.value = 1;
  const query: Record<string, string> = {};
  for (const [key, val] of Object.entries(route.query)) {
    if (key === "kind" || key === "preferred") continue;
    if (typeof val === "string") query[key] = val;
  }
  const kindQuery = aiStudioHubKindToQuery(next);
  if (kindQuery?.kind) {
    query.kind = kindQuery.kind;
  }
  void router.replace({ query });
});

type HubSessionRow = AiStudioSessionListItem & {
  jobMeta: AiStudioHubJobMeta | null;
  jobLabel: string;
};

const hubSessions = computed(() => {
  void aiStudioSessionsRevision.value;
  return sessionsApi.list();
});

const startedHubSessions = computed(() =>
  hubSessions.value.filter(hasStartedAiStudioSession)
);

const hubRowTitle = (row: AiStudioSessionListItem): string => {
  const theme = row.researchTheme?.trim();
  if (row.jobKind === "research" && theme) {
    return theme.length > 48 ? `${theme.slice(0, 48)}…` : theme;
  }
  return row.title?.trim() || "(無題)";
};

const sessionsForKindTab = computed(() => {
  if (kindFilter.value === AI_STUDIO_HUB_KIND_FILTER_ALL) {
    return startedHubSessions.value;
  }
  return startedHubSessions.value.filter((s) => s.jobKind === kindFilter.value);
});

const countByKindFilter = (filter: AiStudioHubKindFilter): number => {
  if (filter === AI_STUDIO_HUB_KIND_FILTER_ALL) {
    return startedHubSessions.value.length;
  }
  return startedHubSessions.value.filter((s) => s.jobKind === filter).length;
};

const kindTabItems = computed(() => {
  const allItem = {
    label: "すべて",
    shortLabel: "すべて",
    value: AI_STUDIO_HUB_KIND_FILTER_ALL,
    icon: "flat-color-icons:combo-chart",
    count: countByKindFilter(AI_STUDIO_HUB_KIND_FILTER_ALL),
  };
  const kindItems = AI_STUDIO_HUB_VISIBLE_JOB_KINDS.map((kind) => ({
    label: AI_STUDIO_HUB_JOB_META[kind].label,
    shortLabel: AI_STUDIO_HUB_JOB_META[kind].shortLabel,
    value: kind,
    icon: AI_STUDIO_HUB_JOB_META[kind].icon,
    count: countByKindFilter(kind),
  }));
  return [allItem, ...kindItems];
});

const statusFilters = computed(() => {
  const scoped = sessionsForKindTab.value;
  const counts = { all: 0, incomplete: 0, completed: 0 } as Record<
    AiStudioCompletionFilter,
    number
  >;
  for (const s of scoped) {
    counts.all += 1;
    counts[s.status === "completed" ? "completed" : "incomplete"] += 1;
  }
  return [
    { key: "all" as const, label: "すべて", count: counts.all },
    { key: "incomplete" as const, label: "未完了", count: counts.incomplete },
    { key: "completed" as const, label: "完了", count: counts.completed },
  ];
});

const filteredRows = computed<HubSessionRow[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return sessionsForKindTab.value
    .filter((s) => {
      if (!matchesAiStudioCompletionFilter(s, statusFilter.value)) {
        return false;
      }
      if (
        q &&
        !s.title.toLowerCase().includes(q) &&
        !(s.researchTheme ?? "").toLowerCase().includes(q) &&
        !s.sessionId.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    })
    .map((s) => ({
      ...s,
      jobMeta: resolveAiStudioHubJobMeta({ jobKind: s.jobKind }),
      jobLabel:
        resolveAiStudioHubJobMeta({ jobKind: s.jobKind })?.label ?? "未分類",
    }));
});

watch([searchQuery, statusFilter, kindFilter], () => {
  page.value = 1;
});

const paginatedRows = computed(() => {
  const start = (page.value - 1) * pageSize;
  return filteredRows.value.slice(start, start + pageSize);
});

const loadResearchPreview = async (
  row: AiStudioSessionListItem
): Promise<void> => {
  const sessionId = row.sessionId;
  const current = researchPreviews.value[sessionId];
  if (
    (current?.loaded && current.sourceUpdatedAt === row.updatedAt) ||
    loadingResearchPreviews.has(sessionId)
  ) {
    return;
  }
  loadingResearchPreviews.add(sessionId);
  try {
    const artifacts = await fetchSessionArtifacts({ sessionId });
    const resolved = resolveAiStudioResearchArtifacts({
      artifacts: artifacts.values(),
    });
    const imageUrl = resolved.imageArtifact
      ? await resolveArtifactDisplayUrl({
          storageGcsPath: resolved.imageArtifact.storageGcsPath,
          contentType: resolved.imageArtifact.contentType,
        })
      : null;
    researchPreviews.value = {
      ...researchPreviews.value,
      [sessionId]: {
        htmlArtifact: resolved.htmlArtifact,
        imageUrl,
        loaded: true,
        sourceUpdatedAt: row.updatedAt,
      },
    };
  } catch (error) {
    log("WARN", "[AiStudioHub] research preview load failed", {
      sessionId,
      error,
    });
  } finally {
    loadingResearchPreviews.delete(sessionId);
  }
};

watch(
  paginatedRows,
  (rows) => {
    for (const row of rows) {
      if (row.jobKind === "research") {
        void loadResearchPreview(row);
      }
    }
  },
  { immediate: true }
);

const paginationLabel = computed(() => {
  const total = filteredRows.value.length;
  if (total === 0) return "";
  const start = (page.value - 1) * pageSize + 1;
  const end = Math.min(page.value * pageSize, total);
  return `${start}〜${end} 件 / 全 ${total} 件`;
});

const emptyMeta = computed(() => {
  if (kindFilter.value !== AI_STUDIO_HUB_KIND_FILTER_ALL) {
    return AI_STUDIO_HUB_JOB_META[kindFilter.value];
  }
  return null;
});

const emptyStateIcon = computed(
  () => emptyMeta.value?.icon ?? "flat-color-icons:combo-chart"
);
const emptyStateHeading = computed(
  () => emptyMeta.value?.emptyHeading ?? "セッションはまだありません"
);
const emptyStateDescription = computed(
  () =>
    emptyMeta.value?.emptyDescription ??
    "右上の「新しいセッション」から、経営相談・書類・画像・調査レポートのいずれかを開始できます。"
);

const newSessionButtonLabel = computed(() => {
  if (kindFilter.value === AI_STUDIO_HUB_KIND_FILTER_ALL) {
    return "新しいセッションを開始";
  }
  return `${AI_STUDIO_HUB_JOB_META[kindFilter.value].label}をはじめる`;
});

const onRefresh = (): void => {
  listLoading.value = true;
  researchPreviews.value = {};
  loadingResearchPreviews.clear();
  resubscribeSessions();
  for (const row of paginatedRows.value) {
    if (row.jobKind === "research") {
      void loadResearchPreview(row);
    }
  }
  listLoading.value = !aiStudioSessionsReady.value;
};

const openSession = (sessionId: string): void => {
  emit("open-session", sessionId);
};

const onNewSession = (): void => {
  emit("new-session", jobKindForNewSession(kindFilter.value));
};

const onDelete = (sessionId: string): void => {
  if (
    !confirm(
      "このセッション履歴を削除しますか？\n（会話内容は復元できません）"
    )
  ) {
    return;
  }
  void store.deleteSession(sessionId);
};

const downloadResearchHtml = async (
  row: AiStudioSessionListItem
): Promise<void> => {
  const artifact = researchPreviews.value[row.sessionId]?.htmlArtifact;
  if (!artifact || researchDownloadSessionId.value) return;

  researchDownloadSessionId.value = row.sessionId;
  try {
    const html = await fetchArtifactTextContent({
      storageGcsPath: artifact.storageGcsPath,
      contentType: artifact.contentType,
    });
    if (!html) {
      toast.add({
        title: "HTMLを取得できませんでした",
        description: "少し待ってから、もう一度お試しください。",
        color: "error",
      });
      return;
    }
    downloadHtmlDocument({
      html,
      title: hubRowTitle(row),
    });
  } catch (error) {
    log("WARN", "[AiStudioHub] research HTML download failed", {
      sessionId: row.sessionId,
      error,
    });
    toast.add({
      title: "HTMLのダウンロードに失敗しました",
      description: "成果物の同期状態を確認して、もう一度お試しください。",
      color: "error",
    });
  } finally {
    researchDownloadSessionId.value = null;
  }
};
</script>

<style scoped>
.ai-studio-hub-tab-icon--multicolor {
  color: unset;
}
</style>
