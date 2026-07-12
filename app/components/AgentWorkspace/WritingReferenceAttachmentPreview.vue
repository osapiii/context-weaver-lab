<template>
  <div
    class="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm ring-1 ring-emerald-50"
    data-testid="writing-reference-attachment-preview"
  >
    <header class="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-50 px-3 py-2.5">
      <div class="min-w-0">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80">
          参考資料プレビュー
        </p>
        <p class="truncate text-xs font-medium text-slate-800">
          {{ activeAttachment?.name ?? "資料なし" }}
        </p>
      </div>
      <div
        v-if="attachments.length > 1"
        class="flex flex-wrap gap-1"
      >
        <EnButton
          v-for="(item, index) in attachments"
          :key="item.id"
          variant="soft"
          :color="index === selectedIndex ? 'success' : 'neutral'"
          size="xs"
          @click="selectedIndex = index"
        >
          {{ index + 1 }}
        </EnButton>
      </div>
    </header>

    <div
      class="relative min-h-[200px] flex-1 bg-slate-50/80"
      role="document"
      aria-live="polite"
    >
      <div
        v-if="!activeAttachment"
        class="flex h-[220px] items-center justify-center px-4 text-center text-xs text-slate-500"
      >
        参考資料がありません
      </div>

      <div
        v-else-if="loading"
        class="flex h-[220px] items-center justify-center text-xs text-slate-500"
      >
        <UIcon
          name="material-symbols:progress-activity"
          class="mr-2 h-4 w-4 animate-spin text-emerald-600"
        />
        プレビューを読み込み中…
      </div>

      <EnAlert
        v-else-if="errorMessage"
        color="warning"
        class="m-3"
        :title="errorMessage"
      />

      <div
        v-else-if="previewMode === 'image' && previewUrl"
        class="flex h-[min(70vh,42rem)] items-center justify-center p-3"
      >
        <img
          :src="previewUrl"
          :alt="activeAttachment.name"
          class="max-h-full max-w-full object-contain"
          referrerpolicy="no-referrer"
        >
      </div>

      <div
        v-else-if="previewMode === 'pdf' && previewUrl"
        class="h-[min(70vh,42rem)] overflow-hidden"
      >
        <PdfPreview
          :url="previewUrl"
          :is-loading="false"
          :error="null"
        />
      </div>

      <div
        v-else-if="previewMode === 'text' && textContent"
        class="max-h-[min(70vh,42rem)] overflow-auto p-3"
      >
        <EnMarkdown
          v-if="isMarkdown"
          :markdown-text="textContent"
          variant="help"
          compact
        />
        <pre
          v-else
          class="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-800"
        >{{ textContent }}</pre>
      </div>

      <div
        v-else
        class="flex h-[220px] flex-col items-center justify-center gap-2 px-4 text-center"
      >
        <UIcon
          name="material-symbols:description-outline"
          class="h-8 w-8 text-slate-400"
        />
        <p class="text-xs text-slate-600">
          ブラウザでプレビューできない形式です
        </p>
        <EnButton
          v-if="previewUrl"
          variant="soft"
          color="neutral"
          size="xs"
          leading-icon="material-symbols:open-in-new"
          :href="previewUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          別タブで開く
        </EnButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EnAlert from "@components/EnAlert.vue";
import EnButton from "@components/EnButton.vue";
import EnMarkdown from "@components/EnMarkdown.vue";
import PdfPreview from "@components/PdfPreview.vue";
import { useFirebaseStorageOperations } from "@composables/firebase-storage-operations";
import type { WritingReferenceAttachment } from "@models/writingForm";
import { looksLikeMarkdownContent } from "@utils/knowledgePreview";
import log from "@utils/logger";
import { parseGsPath } from "@utils/artifactDisplayUrl";

const props = defineProps<{
  attachments: WritingReferenceAttachment[];
}>();

const { getAuthenticatedUrl } = useFirebaseStorageOperations();

const selectedIndex = ref(0);
const loading = ref(false);
const errorMessage = ref<string | null>(null);
const previewUrl = ref<string | null>(null);
const textContent = ref<string | null>(null);

const attachments = computed(() => props.attachments ?? []);

const activeAttachment = computed(
  () => attachments.value[selectedIndex.value] ?? null
);

const previewMode = computed((): "image" | "pdf" | "text" | "binary" => {
  const att = activeAttachment.value;
  if (!att) return "binary";
  const mime = att.mimeType.toLowerCase();
  const name = att.name.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("csv") ||
    mime.includes("markdown") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".txt")
  ) {
    return "text";
  }
  return "binary";
});

const isMarkdown = computed(() => {
  const att = activeAttachment.value;
  if (!att || !textContent.value) return false;
  const name = att.name.toLowerCase();
  const mime = att.mimeType.toLowerCase();
  return (
    name.endsWith(".md") ||
    mime.includes("markdown") ||
    looksLikeMarkdownContent(textContent.value)
  );
});

const resolvePreviewUrl = async (
  att: WritingReferenceAttachment
): Promise<string | null> => {
  if (att.storageUrl?.trim()) return att.storageUrl.trim();
  if (!att.gcsPath?.trim()) return null;
  const parsed = parseGsPath(att.gcsPath);
  if (!parsed) return null;
  try {
    return await getAuthenticatedUrl({
      bucketName: parsed.bucket,
      filePath: parsed.path,
    });
  } catch (error) {
    log("WARN", "[WritingReferenceAttachmentPreview] url resolve failed", error);
    return null;
  }
};

watch(
  [activeAttachment],
  async () => {
    const att = activeAttachment.value;
    previewUrl.value = null;
    textContent.value = null;
    errorMessage.value = null;
    if (!att) return;

    loading.value = true;
    try {
      const url = await resolvePreviewUrl(att);
      if (!url) {
        errorMessage.value = "プレビュー URL を取得できませんでした";
        return;
      }
      previewUrl.value = url;
      if (previewMode.value === "text") {
        const response = await fetch(url);
        if (!response.ok) {
          errorMessage.value = "テキストの読み込みに失敗しました";
          return;
        }
        textContent.value = await response.text();
      }
    } catch (error) {
      log("WARN", "[WritingReferenceAttachmentPreview] load failed", error);
      errorMessage.value = "プレビューの読み込みに失敗しました";
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);

watch(
  () => attachments.value.length,
  (count) => {
    if (selectedIndex.value >= count) {
      selectedIndex.value = Math.max(0, count - 1);
    }
  }
);
</script>
