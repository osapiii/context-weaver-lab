<template>
  <EnModal
    :open="open"
    title="アプリスキャン"
    title-icon="material-symbols:radar"
    header-variant="dark"
    size="full"
    padding="none"
    :close-on-backdrop="false"
    :ui="{ content: 'w-[min(1120px,calc(100vw-32px))] h-[min(820px,calc(100vh-32px))]' }"
    @update:open="emit('update:open', $event)"
  >
    <template #subtitle>
      <span class="block truncate">
        {{ application?.name ?? "Application" }} / {{ run?.startUrl ?? "URL未設定" }}
      </span>
    </template>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
      <div class="border-b border-slate-200 bg-white px-5 py-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <EnBadge :color="statusBadge.color" variant="soft">
                {{ statusBadge.label }}
              </EnBadge>
              <EnBadge v-if="application?.applicationKey" variant="tag">
                {{ application.applicationKey }}
              </EnBadge>
              <span class="text-xs text-slate-500">
                {{ artifactCards.length }} artifacts
              </span>
            </div>
            <p class="mt-2 truncate text-sm font-semibold text-slate-900">
              {{ headline }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <EnButton
              variant="outline"
              color="neutral"
              size="sm"
              leading-icon="material-symbols:work-history-outline"
              @click="emit('openJobLog')"
            >
              仕事ログ
            </EnButton>
            <EnButton
              variant="ghost"
              color="neutral"
              size="sm"
              leading-icon="material-symbols:keyboard-arrow-down"
              @click="emit('update:open', false)"
            >
              最小化
            </EnButton>
          </div>
        </div>

        <div class="mt-4">
          <EnStepper
            v-model="activeStep"
            :items="stepperItems"
            :color="stepperColor"
            size="sm"
          />
        </div>

        <div class="mt-4 grid gap-2 sm:grid-cols-4">
          <div
            v-for="phase in phaseCards"
            :key="phase.label"
            class="rounded-md border px-3 py-2"
            :class="phase.active ? 'border-primary-200 bg-primary-50' : 'border-slate-200 bg-slate-50'"
          >
            <div class="flex items-center gap-2">
              <UIcon
                :name="phase.icon"
                class="h-4 w-4"
                :class="phase.active ? 'text-primary-600' : 'text-slate-400'"
              />
              <p class="text-xs font-bold" :class="phase.active ? 'text-primary-800' : 'text-slate-500'">
                {{ phase.label }}
              </p>
            </div>
            <p class="mt-1 truncate text-[11px]" :class="phase.active ? 'text-primary-700' : 'text-slate-400'">
              {{ phase.caption }}
            </p>
          </div>
        </div>
      </div>

      <div class="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section class="min-w-0 space-y-4">
          <div class="grid gap-3 sm:grid-cols-4">
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <p class="text-xs font-semibold text-slate-500">Start URL</p>
              <p class="mt-1 truncate text-sm font-semibold text-slate-900">
                {{ displayStartUrl }}
              </p>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <p class="text-xs font-semibold text-slate-500">Screenshots</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">
                {{ screenshotCards.length }} / {{ run?.maxPages ?? "-" }}
              </p>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <p class="text-xs font-semibold text-slate-500">Sitemap</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">
                {{ sitemapSummary }}
              </p>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <p class="text-xs font-semibold text-slate-500">Current</p>
              <p class="mt-1 truncate text-sm font-semibold text-slate-900">
                {{ currentUrlLabel }}
              </p>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-bold text-slate-900">Artifact Stream</p>
                <p class="text-xs text-slate-500">
                  保存された出力をリアルタイムに反映します
                </p>
              </div>
              <EnBadge v-if="syncingCount > 0" color="info" variant="soft">
                同期中 {{ syncingCount }}
              </EnBadge>
            </div>

            <div
              v-if="artifactCards.length === 0"
              class="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4"
            >
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div
                  v-for="i in 6"
                  :key="i"
                  class="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <USkeleton class="aspect-video w-full rounded-md" />
                  <USkeleton class="mt-3 h-3 w-4/5 rounded" />
                  <USkeleton class="mt-2 h-3 w-1/2 rounded" />
                </div>
              </div>
              <p class="mt-4 text-center text-xs font-semibold text-slate-500">
                巡回・ログイン・撮影の完了を待っています
              </p>
            </div>

            <div v-else class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <article
                v-for="card in artifactCards"
                :key="card.artifact.artifactId"
                class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <button
                  v-if="card.kind === 'screenshot'"
                  type="button"
                  class="group block w-full text-left"
                  @click="previewArtifactId = card.artifact.artifactId"
                >
                  <div class="aspect-video overflow-hidden bg-slate-100">
                    <AdkArtifactImage
                      :artifact-id="card.artifact.artifactId"
                      :session-id="run?.sessionId"
                      :adk-filename="card.artifact.adkFilename"
                      :artifact-version="card.artifact.adkVersion"
                      :alt="card.title"
                      class="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div class="p-3">
                    <p class="truncate text-xs font-bold text-slate-900">
                      {{ card.title }}
                    </p>
                    <p class="mt-1 text-[11px] text-slate-500">
                      {{ formatBytes(card.artifact.bytes) }}
                    </p>
                  </div>
                </button>

                <div v-else class="p-3">
                  <div class="flex items-center gap-2">
                    <UIcon
                      :name="card.icon"
                      class="h-4 w-4"
                      :class="card.iconClass"
                    />
                    <p class="truncate text-xs font-bold text-slate-900">
                      {{ card.title }}
                    </p>
                  </div>
                  <p class="mt-2 line-clamp-4 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
                    {{ card.preview }}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <aside class="min-w-0 space-y-4">
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <p class="text-sm font-bold text-slate-900">Live Trace</p>
            <p class="mt-1 text-xs text-slate-500">
              RequestDoc と ADK state から読み取った進行状況
            </p>
            <div class="mt-3 space-y-2">
              <div
                v-for="item in latestEvents"
                :key="item"
                class="flex gap-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700"
              >
                <UIcon
                  name="material-symbols:check-circle"
                  class="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-500"
                />
                <span class="min-w-0 break-words">{{ item }}</span>
              </div>
              <div
                v-if="latestEvents.length === 0"
                class="space-y-2 rounded-md bg-slate-50 p-3"
              >
                <USkeleton class="h-3 w-full rounded" />
                <USkeleton class="h-3 w-5/6 rounded" />
                <USkeleton class="h-3 w-2/3 rounded" />
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <p class="text-sm font-bold text-slate-900">RequestDoc</p>
            <dl class="mt-3 space-y-2 text-xs">
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Status</dt>
                <dd class="font-semibold text-slate-900">{{ requestDocStatusLabel }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Request</dt>
                <dd class="truncate font-mono text-[11px] text-slate-700">
                  {{ run?.requestId || "-" }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Session</dt>
                <dd class="truncate font-mono text-[11px] text-slate-700">
                  {{ run?.sessionId || "-" }}
                </dd>
              </div>
            </dl>
            <div
              v-if="requestDocLogs.length > 0"
              class="mt-3 max-h-44 space-y-2 overflow-y-auto rounded-md bg-slate-950 p-3"
            >
              <div
                v-for="log in requestDocLogs.slice(-8)"
                :key="`${log.timestampLabel}-${log.message}`"
                class="text-[11px] leading-relaxed"
              >
                <span class="font-mono text-slate-500">{{ log.timestampLabel }}</span>
                <span
                  class="ml-2"
                  :class="log.type === 'error' ? 'text-rose-300' : log.type === 'warning' ? 'text-amber-300' : 'text-slate-200'"
                >
                  {{ log.message }}
                </span>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <p class="text-sm font-bold text-slate-900">Sitemap Preview</p>
            <div
              v-if="sitemapUrls.length === 0"
              class="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-500"
            >
              sitemap JSONを待っています
            </div>
            <ol v-else class="mt-3 space-y-2">
              <li
                v-for="url in sitemapUrls.slice(0, 8)"
                :key="url"
                class="truncate rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
              >
                {{ url }}
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </div>

    <EnModal
      :open="Boolean(previewArtifact)"
      title="Screenshot Preview"
      size="3xl"
      padding="sm"
      @update:open="previewArtifactId = $event ? previewArtifactId : ''"
    >
      <AdkArtifactImage
        v-if="previewArtifact"
        :artifact-id="previewArtifact.artifactId"
        :session-id="run?.sessionId"
        :adk-filename="previewArtifact.adkFilename"
        :artifact-version="previewArtifact.adkVersion"
        :alt="previewArtifact.name ?? 'Application screenshot'"
        class="max-h-[70vh] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
      />
    </EnModal>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { useFirestore } from "vuefire";
import AdkArtifactImage from "@components/AgentWorkspace/AdkArtifactImage.vue";
import { useAdkSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import type { DecodedAdkSessionArtifact } from "@models/adkSessionArtifact";
import type {
  DecodedVibeControlApplication,
  VibeControlApplicationScanRun,
} from "@models/vibeControl";
import type { RequestStatus } from "@models/core/requestStatus";
import { fetchArtifactTextContent } from "@utils/artifactDisplayUrl";
import { ADK_INVOKE_REQUEST_COLLECTION } from "@models/adkInvokeRequest";
import { useContextStore } from "@stores/context";

const props = defineProps<{
  open: boolean;
  application: DecodedVibeControlApplication | null;
  run: VibeControlApplicationScanRun | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  openJobLog: [];
}>();

type ArtifactCardKind = "screenshot" | "sitemap" | "summary" | "other";
type RequestDocLog = {
  message: string;
  type: "info" | "warning" | "error";
  timestamp?: unknown;
};

const artifacts = ref<DecodedAdkSessionArtifact[]>([]);
const textByArtifactId = ref<Record<string, string>>({});
const previewArtifactId = ref("");
const requestDoc = ref<Record<string, unknown> | null>(null);
const sessionState = ref<Record<string, unknown> | null>(null);
let stopArtifacts: (() => void) | null = null;
let stopRequestDoc: Unsubscribe | null = null;
let stopSessionState: Unsubscribe | null = null;

const { subscribe } = useAdkSessionArtifacts();
const db = useFirestore();
const contextStore = useContextStore();

const statusLabels: Record<RequestStatus, string> = {
  pending: "待機中",
  processing: "実行中",
  completed: "完了",
  error: "失敗",
};

const statusColors = {
  pending: "warning",
  processing: "info",
  completed: "success",
  error: "error",
} as const;

const statusBadge = computed(() => {
  const status = props.run?.status ?? "pending";
  return {
    label: statusLabels[status],
    color: statusColors[status],
  };
});

const artifactCards = computed(() =>
  artifacts.value.map((artifact) => {
    const filename = artifact.adkFilename || artifact.name || artifact.artifactId;
    const lower = filename.toLowerCase();
    const kind: ArtifactCardKind = lower.includes("screenshot")
      ? "screenshot"
      : lower.includes("sitemap")
        ? "sitemap"
        : lower.includes("summary")
          ? "summary"
          : "other";
    const text = textByArtifactId.value[artifact.artifactId] ?? "";
    return {
      artifact,
      kind,
      title: artifact.name || artifact.prompt || filename,
      preview: previewText({ artifact, kind, text }),
      icon:
        kind === "sitemap"
          ? "material-symbols:account-tree-outline"
          : kind === "summary"
            ? "material-symbols:article-outline"
            : "material-symbols:insert-drive-file-outline",
      iconClass:
        kind === "sitemap"
          ? "text-sky-500"
          : kind === "summary"
            ? "text-emerald-500"
            : "text-slate-500",
    };
  })
);

const screenshotCards = computed(() =>
  artifactCards.value.filter((card) => card.kind === "screenshot")
);

const sitemapCard = computed(() =>
  artifactCards.value.find((card) => card.kind === "sitemap")
);

const summaryCard = computed(() =>
  artifactCards.value.find((card) => card.kind === "summary")
);

const syncingCount = computed(
  () => artifacts.value.filter((artifact) => artifact.status === "syncing").length
);

const applicationScanState = computed(() => {
  const bucket = sessionState.value?.application_scan;
  return bucket && typeof bucket === "object" && !Array.isArray(bucket)
    ? (bucket as Record<string, unknown>)
    : {};
});

const scanProgress = computed(() => {
  const progress = applicationScanState.value.progress;
  return progress && typeof progress === "object" && !Array.isArray(progress)
    ? (progress as Record<string, unknown>)
    : {};
});

const processedPages = computed(() =>
  typeof scanProgress.value.processed_pages === "number"
    ? scanProgress.value.processed_pages
    : screenshotCards.value.length
);

const totalPages = computed(() =>
  typeof scanProgress.value.total_pages === "number"
    ? scanProgress.value.total_pages
    : props.run?.maxPages ?? 0
);

const currentUrlLabel = computed(() => {
  const value = scanProgress.value.current_url;
  return typeof value === "string" && value.trim() ? value.trim() : "-";
});

const displayStartUrl = computed(() => {
  if (props.run?.startUrl) return props.run.startUrl;
  const setup = applicationScanState.value.setup;
  if (
    setup &&
    typeof setup === "object" &&
    !Array.isArray(setup) &&
    (setup as Record<string, unknown>).auth_mode === "email_link_manual"
  ) {
    return "メールリンク認証";
  }
  return "-";
});

const sitemapUrls = computed(() => {
  const text = sitemapCard.value
    ? textByArtifactId.value[sitemapCard.value.artifact.artifactId]
    : "";
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as {
      pages?: Array<{ url?: unknown }>;
    };
    return (parsed.pages ?? [])
      .map((page) => (typeof page.url === "string" ? page.url : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
});

const sitemapSummary = computed(() => {
  if (sitemapUrls.value.length > 0) return `${sitemapUrls.value.length} URLs`;
  return sitemapCard.value ? "同期中" : "未生成";
});

const activeStep = computed({
  get: () => {
    if (props.run?.status === "error") return 4;
    if (props.run?.status === "completed") return 4;
    if (summaryCard.value || sitemapCard.value) return 3;
    if (screenshotCards.value.length > 0) return 2;
    if (processedPages.value > 0) return 2;
    if (props.run?.status === "processing") return 1;
    return props.run?.requestId ? 0 : 0;
  },
  set: () => {},
});

const stepperColor = computed(() =>
  props.run?.status === "error"
    ? "error"
    : props.run?.status === "completed"
      ? "success"
      : "primary"
);

const stepperItems = computed(() => [
  {
    title: "RequestDoc",
    description: props.run?.requestId ? "発行済み" : "準備中",
    icon: "material-symbols:receipt-long-outline",
  },
  {
    title: "Agent",
    description: props.run?.status === "processing" ? "起動中" : "待機",
    icon: "material-symbols:smart-toy-outline",
  },
  {
    title: "巡回・撮影",
    description:
      screenshotCards.value.length > 0
        ? `${screenshotCards.value.length}枚`
        : processedPages.value > 0
          ? `${processedPages.value}/${totalPages.value || "-"} pages`
        : "ページ解析中",
    icon: "material-symbols:photo-camera-outline",
  },
  {
    title: "Artifact",
    description:
      artifactCards.value.length > 0
        ? `${artifactCards.value.length}件`
        : "同期待ち",
    icon: "material-symbols:folder-open-outline",
  },
  {
    title: props.run?.status === "error" ? "失敗" : "完了",
    description: props.run?.completedAt ? "完了済み" : "あと少し",
    icon:
      props.run?.status === "error"
        ? "material-symbols:error-outline"
        : "material-symbols:check-circle-outline",
  },
]);

const headline = computed(() => {
  if (props.run?.status === "error") {
    return props.run.errorMessage || "スキャンでエラーが発生しました";
  }
  if (props.run?.status === "completed") {
    return "スキャン結果の同期が完了しました";
  }
  if (currentUrlLabel.value !== "-") {
    return `現在 ${currentUrlLabel.value} を解析しています`;
  }
  if (screenshotCards.value.length > 0) {
    return `ページを巡回しながら ${screenshotCards.value.length} 枚のスクリーンショットを保存しています`;
  }
  if (props.run?.status === "processing") {
    return "Agentが対象サイトを解析しています";
  }
  return "RequestDocを発行してAgentの起動を待っています";
});

const phaseCards = computed(() => [
  {
    label: "Request",
    caption: props.run?.requestId ? "RequestDoc発行済み" : "発行待ち",
    icon: "material-symbols:receipt-long-outline",
    active: activeStep.value === 0,
  },
  {
    label: "Login",
    caption:
      displayStartUrl.value === "メールリンク認証"
        ? "メールリンク認証を確認"
        : "アクセス準備",
    icon: "material-symbols:passkey-outline",
    active: activeStep.value === 1,
  },
  {
    label: "Capture",
    caption:
      processedPages.value > 0
        ? `${processedPages.value}/${totalPages.value || "-"} pages`
        : "Playwright巡回",
    icon: "material-symbols:screenshot-monitor-outline",
    active: activeStep.value === 2,
  },
  {
    label: "Atlas",
    caption:
      artifactCards.value.length > 0
        ? `${artifactCards.value.length} artifacts`
        : "Artifact生成",
    icon: "material-symbols:dataset-outline",
    active: activeStep.value >= 3,
  },
]);

const latestEvents = computed(() => {
  const events: string[] = [];
  if (props.run?.requestId) events.push(`RequestDoc: ${props.run.requestId}`);
  if (displayStartUrl.value !== "-") events.push(`起点: ${displayStartUrl.value}`);
  if (currentUrlLabel.value !== "-") events.push(`現在URL: ${currentUrlLabel.value}`);
  if (processedPages.value > 0) {
    events.push(`巡回 ${processedPages.value}/${totalPages.value || "-"} pages`);
  }
  if (screenshotCards.value.length > 0) {
    events.push(`スクリーンショット ${screenshotCards.value.length} 件を検出`);
  }
  if (sitemapCard.value) events.push("sitemap JSONを検出");
  if (summaryCard.value) events.push("summary markdownを検出");
  if (props.run?.status === "completed") events.push("Application Scan完了");
  if (props.run?.status === "error") {
    events.push(props.run.errorMessage || "Application Scan失敗");
  }
  return events.slice(-6).reverse();
});

const requestDocStatus = computed(() => {
  const status = requestDoc.value?.status;
  return typeof status === "string" ? status : props.run?.status ?? "pending";
});

const requestDocStatusLabel = computed(
  () => statusLabels[requestDocStatus.value as RequestStatus] ?? requestDocStatus.value
);

const requestDocLogs = computed(() => {
  const rawLogs = requestDoc.value?.logs;
  if (!Array.isArray(rawLogs)) return [];
  return rawLogs
    .filter((item): item is RequestDocLog =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as RequestDocLog).message === "string"
    )
    .map((item) => ({
      message: item.message,
      type: item.type ?? "info",
      timestampLabel: formatLogTimestamp(item.timestamp),
    }));
});

const previewArtifact = computed(() =>
  artifacts.value.find((artifact) => artifact.artifactId === previewArtifactId.value)
);

watch(
  () => props.run?.sessionId,
  (sessionId) => {
    stopArtifacts?.();
    stopArtifacts = null;
    artifacts.value = [];
    textByArtifactId.value = {};
    previewArtifactId.value = "";
    if (!sessionId) return;
    stopArtifacts = subscribe({
      sessionId,
      onUpdate: (next) => {
        artifacts.value = [...next.values()].sort((a, b) =>
          (a.adkFilename || a.artifactId).localeCompare(
            b.adkFilename || b.artifactId
          )
        );
        void loadTextArtifacts();
      },
    });
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopArtifacts?.();
  stopRequestDoc?.();
  stopSessionState?.();
});

watch(
  () => props.run?.requestId,
  (requestId) => {
    stopRequestDoc?.();
    stopRequestDoc = null;
    requestDoc.value = null;
    if (!requestId) return;
    const ref = doc(
      db,
      contextStore.baseFirestorePath(`${ADK_INVOKE_REQUEST_COLLECTION}/${requestId}`)
    );
    stopRequestDoc = onSnapshot(ref, (snap) => {
      requestDoc.value = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
    });
  },
  { immediate: true }
);

watch(
  () => props.run?.sessionId,
  (sessionId) => {
    stopSessionState?.();
    stopSessionState = null;
    sessionState.value = null;
    if (!sessionId) return;
    const ref = doc(db, contextStore.baseFirestorePath(`adkSessions/${sessionId}`));
    stopSessionState = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
      const state = data?.state;
      sessionState.value =
        state && typeof state === "object" && !Array.isArray(state)
          ? (state as Record<string, unknown>)
          : null;
    });
  },
  { immediate: true }
);

async function loadTextArtifacts(): Promise<void> {
  const textArtifacts = artifacts.value.filter((artifact) => {
    const contentType = artifact.contentType.toLowerCase();
    const filename = artifact.adkFilename.toLowerCase();
    return (
      artifact.storageGcsPath &&
      artifact.status !== "failed" &&
      (contentType.includes("json") ||
        contentType.includes("markdown") ||
        contentType.includes("text") ||
        filename.endsWith(".json") ||
        filename.endsWith(".md"))
    );
  });
  for (const artifact of textArtifacts) {
    if (textByArtifactId.value[artifact.artifactId]) continue;
    const text = await fetchArtifactTextContent({
      storageGcsPath: artifact.storageGcsPath,
      contentType: artifact.contentType,
    });
    if (text) {
      textByArtifactId.value = {
        ...textByArtifactId.value,
        [artifact.artifactId]: text,
      };
    }
  }
}

function previewText(params: {
  artifact: DecodedAdkSessionArtifact;
  kind: ArtifactCardKind;
  text: string;
}): string {
  if (params.text) {
    if (params.kind === "sitemap") {
      try {
        const parsed = JSON.parse(params.text) as {
          summary?: { pageCount?: number; screenshotCount?: number; failureCount?: number };
        };
        const summary = parsed.summary;
        if (summary) {
          return `${summary.pageCount ?? 0} pages / ${summary.screenshotCount ?? 0} screenshots / ${summary.failureCount ?? 0} failures`;
        }
      } catch {
        return params.text.slice(0, 240);
      }
    }
    return params.text.replace(/\s+/g, " ").trim().slice(0, 260);
  }
  if (params.artifact.status === "failed") {
    return params.artifact.syncError || "同期に失敗しました";
  }
  return "Artifactを同期中です";
}

function formatBytes(bytes: number): string {
  if (!bytes) return "syncing";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatLogTimestamp(value: unknown): string {
  const maybeTimestamp = value as { toDate?: () => Date } | undefined;
  const date =
    maybeTimestamp && typeof maybeTimestamp.toDate === "function"
      ? maybeTimestamp.toDate()
      : value instanceof Date
        ? value
        : null;
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
</script>
