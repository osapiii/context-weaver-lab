<template>
  <EnModal
    v-model:open="modalOpen"
    size="full"
    header-variant="default"
    padding="lg"
    :ui="{
      overlay: 'z-[60]',
      content: 'z-[60] sm:max-w-4xl',
    }"
  >
    <template #title>
      <div class="flex items-center gap-3 min-w-0 w-full">
        <div
          class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md"
          :class="badgeClass"
        >
          <UIcon :name="iconName" class="h-5 w-5" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-base font-bold text-slate-900">
            {{ artifact?.name }}
          </div>
          <div class="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span>{{ formatBytes(artifact?.bytes ?? 0) }}</span>
            <span>·</span>
            <span>{{ formatTime(artifact?.generatedAt ?? 0) }}</span>
            <span v-if="artifact?.contentType">·</span>
            <span v-if="artifact?.contentType" class="truncate">
              {{ artifact.contentType }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <div class="min-h-[280px]">
        <!-- ローディング -->
        <div
          v-if="isLoading"
          class="flex h-[280px] items-center justify-center text-sm text-neutral-500"
        >
          <UIcon
            name="material-symbols:hourglass-empty"
            class="mr-2 h-5 w-5 animate-pulse text-purple-500"
          />
          中身を読み込み中…
        </div>

        <!-- エラー -->
        <EnAlert
          v-else-if="errorMessage"
          icon="material-symbols:error-outline"
          color="error"
          :title="errorMessage"
          description="ダウンロードボタンから直接取得してみてください。"
        />

        <!-- 画像プレビュー -->
        <div
          v-else-if="previewMode === 'image'"
          class="flex justify-center bg-neutral-50 rounded-lg p-2"
        >
          <img
            v-if="resolvedUrl"
            :src="resolvedUrl"
            :alt="artifact?.name || ''"
            class="max-h-[60vh] w-auto object-contain"
          >
        </div>

        <!-- HTML 単一ファイルプレビュー (research.html などは iframe で実 render) -->
        <iframe
          v-else-if="previewMode === 'html-iframe' && textContent !== null"
          :srcdoc="textContent"
          sandbox="allow-same-origin"
          class="block h-[70vh] w-full rounded-lg border border-neutral-200 bg-white"
          referrerpolicy="no-referrer"
        />

        <!-- テキスト系プレビュー (md / json / txt / csv) -->
        <pre
          v-else-if="previewMode === 'text' && textContent !== null"
          class="max-h-[60vh] overflow-auto rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-800 whitespace-pre-wrap break-words"
        >{{ textContent }}</pre>

        <!-- バイナリ (pptx / zip など): プレビュー不可表示 -->
        <div
          v-else-if="previewMode === 'binary'"
          class="flex h-[240px] flex-col items-center justify-center gap-3 rounded-lg bg-neutral-50 text-center"
        >
          <UIcon
            :name="iconName"
            class="h-12 w-12"
            :class="badgeClass.split(' ')[1]"
          />
          <div class="text-sm font-medium text-neutral-700">
            このファイルはブラウザでプレビューできません
          </div>
          <div class="text-xs text-neutral-500">
            下のボタンからダウンロードして開いてください
          </div>
        </div>
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        size="lg"
        @click="modalOpen = false"
      >
        閉じる
      </UButton>
      <UButton
        v-if="resolvedUrl"
        color="primary"
        icon="material-symbols:download"
        size="lg"
        :href="resolvedUrl"
        :download="artifact?.name || ''"
        target="_blank"
        rel="noopener noreferrer"
      >
        ダウンロード
      </UButton>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, defineModel, ref, watch } from "vue";
import type { ResearchAgentArtifact } from "@stores/researchAgent";
import { useFirebaseStorageOperations } from "@composables/firebase-storage-operations";
import EnModal from "@components/EnModal.vue";

const { getAuthenticatedUrl } = useFirebaseStorageOperations();

const props = defineProps<{
  artifact: ResearchAgentArtifact | null;
}>();

const modalOpen = defineModel<boolean>("open");

const textContent = ref<string | null>(null);
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const resolvedUrl = ref<string | null>(null);

/**
 * gs://bucket/key を {bucket, path} に分解
 */
const parseGsPath = (
  gcsPath: string,
): { bucket: string; path: string } | null => {
  if (!gcsPath || !gcsPath.startsWith("gs://")) return null;
  const without = gcsPath.slice("gs://".length);
  const slash = without.indexOf("/");
  if (slash <= 0) return null;
  return { bucket: without.slice(0, slash), path: without.slice(slash + 1) };
};

const resolveDownloadUrl = async (
  a: ResearchAgentArtifact,
): Promise<string | null> => {
  const path = a.storageGcsPath || a.gcsPath || "";
  const { resolveArtifactDisplayUrl } = await import("@utils/artifactDisplayUrl");
  return resolveArtifactDisplayUrl({ storageGcsPath: path });
};

const TEXT_EXT = [
  ".md",
  ".json",
  ".txt",
  ".html",
  ".htm",
  ".csv",
  ".log",
  ".yaml",
  ".yml",
  ".xml",
];

const isTextArtifact = (a: ResearchAgentArtifact): boolean => {
  if (a.kind === "plan_json" || a.kind === "narration" || a.kind === "html") {
    return true;
  }
  const ct = (a.contentType || "").toLowerCase();
  if (ct.startsWith("text/") || ct.includes("json") || ct.includes("xml")) {
    return true;
  }
  const lower = (a.name || "").toLowerCase();
  return TEXT_EXT.some((ext) => lower.endsWith(ext));
};

const isHtmlArtifact = (a: ResearchAgentArtifact): boolean => {
  if (a.kind === "html") return true;
  const ct = (a.contentType || "").toLowerCase();
  if (ct.includes("html")) return true;
  const lower = (a.name || "").toLowerCase();
  return lower.endsWith(".html") || lower.endsWith(".htm");
};

const previewMode = computed<
  "image" | "html-iframe" | "text" | "binary" | null
>(() => {
  if (!props.artifact) return null;
  if (props.artifact.kind === "image") return "image";
  if (isHtmlArtifact(props.artifact)) return "html-iframe";
  if (isTextArtifact(props.artifact)) return "text";
  return "binary";
});

const iconName = computed(() => {
  switch (props.artifact?.kind) {
    case "html":
      return "material-symbols:menu-book";  // research.html = Notion 風読み物
    case "plan_json":
      return "material-symbols:data-object";
    case "image":
      return "material-symbols:image";
    case "pptx":
      return "material-symbols:slideshow";
    case "narration":
      return "material-symbols:description";
    case "package":
      return "material-symbols:folder-zip";
    default:
      return "material-symbols:draft";
  }
});

const badgeClass = computed(() => {
  switch (props.artifact?.kind) {
    case "html":
      // research.html (一級成果物) は purple/violet の gradient ぽく
      return "bg-purple-50 text-purple-600";
    case "plan_json":
      return "bg-sky-50 text-sky-600";
    case "image":
      return "bg-violet-50 text-violet-600";
    case "narration":
      return "bg-emerald-50 text-emerald-600";
    case "pptx":
      return "bg-purple-50 text-purple-600";
    case "package":
      return "bg-rose-50 text-rose-600";
    default:
      return "bg-neutral-50 text-neutral-600";
  }
});

const formatBytes = (n: number): string => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

const formatTime = (ms: number) => {
  if (!ms) return "";
  const d = new Date(ms);
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const fetchTextContent = async (url: string) => {
  isLoading.value = true;
  errorMessage.value = null;
  textContent.value = null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    textContent.value = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errorMessage.value = `読み込みに失敗しました (${msg})`;
  } finally {
    isLoading.value = false;
  }
};

const onModalOpen = async () => {
  const a = props.artifact;
  if (!a) return;
  isLoading.value = true;
  errorMessage.value = null;
  textContent.value = null;
  resolvedUrl.value = null;

  const url = await resolveDownloadUrl(a);
  if (!url) {
    isLoading.value = false;
    errorMessage.value =
      "ファイル URL を取得できませんでした (署名 URL も GCS フォールバックも失敗)";
    return;
  }
  resolvedUrl.value = url;

  if (previewMode.value === "text" || previewMode.value === "html-iframe") {
    await fetchTextContent(url);
  } else {
    isLoading.value = false;
  }
};

watch(
  () => [modalOpen.value, props.artifact?.gcsPath] as const,
  ([open]) => {
    if (!open || !props.artifact) {
      textContent.value = null;
      errorMessage.value = null;
      isLoading.value = false;
      resolvedUrl.value = null;
      return;
    }
    void onModalOpen();
  },
  { immediate: true },
);
</script>
