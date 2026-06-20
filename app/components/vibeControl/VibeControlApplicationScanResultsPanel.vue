<template>
  <section class="rounded-lg border border-slate-200 bg-white">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Scan Results
        </p>
        <h2 class="mt-1 truncate text-base font-semibold text-slate-900">
          {{ application?.name ?? "Application" }}
        </h2>
        <p class="mt-1 text-xs text-slate-500">
          取得したsitemap・スクリーンショット・summaryを確認します
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <EnBadge v-if="run" :color="statusBadge.color" variant="soft">
          {{ statusBadge.label }}
        </EnBadge>
        <EnBadge v-if="application?.applicationKey" variant="tag">
          {{ application.applicationKey }}
        </EnBadge>
      </div>
    </div>

    <div v-if="!run" class="flex min-h-72 flex-col items-center justify-center px-4 py-12 text-center">
      <UIcon
        name="material-symbols:radar"
        class="h-12 w-12 text-slate-300"
      />
      <p class="mt-3 text-sm font-semibold text-slate-700">
        まだスキャン結果がありません
      </p>
      <p class="mt-1 text-xs text-slate-500">
        基本情報タブからApplication Scanを実行すると、結果がここに保存されます
      </p>
    </div>

    <div v-else class="space-y-4 p-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-xs font-semibold text-slate-500">Start URL</p>
          <p class="mt-1 truncate text-sm font-semibold text-slate-900">
            {{ run.startUrl }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-xs font-semibold text-slate-500">Screenshots</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">
            {{ screenshotCards.length }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-xs font-semibold text-slate-500">Sitemap</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">
            {{ sitemapSummary }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-xs font-semibold text-slate-500">Artifacts</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">
            {{ artifactCards.length }}
          </p>
        </div>
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="min-w-0 space-y-4">
          <div class="rounded-lg border border-slate-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-sm font-bold text-slate-900">スクリーンショット</p>
                <p class="text-xs text-slate-500">
                  巡回中に保存された画面キャプチャ
                </p>
              </div>
              <EnBadge v-if="syncingCount > 0" color="info" variant="soft">
                同期中 {{ syncingCount }}
              </EnBadge>
            </div>

            <div
              v-if="screenshotCards.length === 0"
              class="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500"
            >
              スクリーンショットはまだ同期されていません
            </div>
            <div v-else class="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              <button
                v-for="card in screenshotCards"
                :key="card.artifact.artifactId"
                type="button"
                class="group overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                @click="previewArtifactId = card.artifact.artifactId"
              >
                <div class="aspect-video overflow-hidden bg-slate-100">
                  <AdkArtifactImage
                    :artifact-id="card.artifact.artifactId"
                    :session-id="run.sessionId"
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
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-900">Artifact一覧</p>
            <div
              v-if="artifactCards.length === 0"
              class="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500"
            >
              Artifactを同期中です
            </div>
            <div v-else class="mt-4 grid gap-3 md:grid-cols-2">
              <article
                v-for="card in nonScreenshotCards"
                :key="card.artifact.artifactId"
                class="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div class="flex items-center gap-2">
                  <UIcon :name="card.icon" class="h-4 w-4" :class="card.iconClass" />
                  <p class="truncate text-xs font-bold text-slate-900">
                    {{ card.title }}
                  </p>
                </div>
                <p class="mt-2 line-clamp-5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
                  {{ card.preview }}
                </p>
              </article>
            </div>
          </div>
        </div>

        <aside class="min-w-0 space-y-4">
          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-900">Sitemap URL一覧</p>
            <div
              v-if="sitemapUrls.length === 0"
              class="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-500"
            >
              sitemap JSONを待っています
            </div>
            <ol v-else class="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              <li
                v-for="url in sitemapUrls"
                :key="url"
                class="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
              >
                <a
                  :href="url"
                  target="_blank"
                  rel="noopener"
                  class="break-all hover:text-primary-600 hover:underline"
                >
                  {{ url }}
                </a>
              </li>
            </ol>
          </div>

          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-900">Summary</p>
            <EnMarkdown
              v-if="summaryBody"
              :markdown-text="summaryBody"
              variant="ai"
              compact
              class="mt-3 max-h-[28rem] overflow-y-auto rounded-md bg-slate-50 p-3"
            />
            <p v-else class="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
              summary markdownを待っています
            </p>
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
        v-if="previewArtifact && run"
        :artifact-id="previewArtifact.artifactId"
        :session-id="run.sessionId"
        :adk-filename="previewArtifact.adkFilename"
        :artifact-version="previewArtifact.adkVersion"
        :alt="previewArtifact.name ?? 'Application screenshot'"
        class="max-h-[70vh] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
      />
    </EnModal>
  </section>
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
  application: DecodedVibeControlApplication | null;
  run: VibeControlApplicationScanRun | null;
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

const nonScreenshotCards = computed(() =>
  artifactCards.value.filter((card) => card.kind !== "screenshot")
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

const summaryBody = computed(() =>
  summaryCard.value
    ? textByArtifactId.value[summaryCard.value.artifact.artifactId] ?? ""
    : ""
);

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
