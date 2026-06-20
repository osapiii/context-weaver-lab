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
      </div>

      <div class="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section class="min-w-0 space-y-4">
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <p class="text-xs font-semibold text-slate-500">Start URL</p>
              <p class="mt-1 truncate text-sm font-semibold text-slate-900">
                {{ run?.startUrl ?? "-" }}
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
              class="mt-4 flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center"
            >
              <UIcon
                name="material-symbols:hourglass-top"
                class="h-10 w-10 text-slate-300"
              />
              <p class="mt-3 text-sm font-semibold text-slate-700">
                Artifactの到着を待っています
              </p>
              <p class="mt-1 text-xs text-slate-500">
                巡回が進むとスクリーンショットやsitemapがここに並びます
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
            <p class="text-sm font-bold text-slate-900">Latest Output</p>
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
import AdkArtifactImage from "@components/AgentWorkspace/AdkArtifactImage.vue";
import { useAdkSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import type { DecodedAdkSessionArtifact } from "@models/adkSessionArtifact";
import type {
  DecodedVibeControlApplication,
  VibeControlApplicationScanRun,
} from "@models/vibeControl";
import type { RequestStatus } from "@models/core/requestStatus";
import { fetchArtifactTextContent } from "@utils/artifactDisplayUrl";

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

const artifacts = ref<DecodedAdkSessionArtifact[]>([]);
const textByArtifactId = ref<Record<string, string>>({});
const previewArtifactId = ref("");
let stopArtifacts: (() => void) | null = null;

const { subscribe } = useAdkSessionArtifacts();

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
  if (screenshotCards.value.length > 0) {
    return `ページを巡回しながら ${screenshotCards.value.length} 枚のスクリーンショットを保存しています`;
  }
  if (props.run?.status === "processing") {
    return "Agentが対象サイトを解析しています";
  }
  return "RequestDocを発行してAgentの起動を待っています";
});

const latestEvents = computed(() => {
  const events: string[] = [];
  if (props.run?.requestId) events.push(`RequestDoc: ${props.run.requestId}`);
  if (props.run?.startUrl) events.push(`開始URL: ${props.run.startUrl}`);
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
});

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
</script>
