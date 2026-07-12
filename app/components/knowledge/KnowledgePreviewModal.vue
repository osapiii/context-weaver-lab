<template>
  <EnModal
    v-model:open="isOpen"
    size="full"
    header-variant="default"
    padding="lg"
    close-aria-label="知識プレビューを閉じる"
    :ui="{
      overlay: 'z-[80]',
      content: 'z-[80] sm:max-w-4xl',
    }"
    @update:open="onOpenChange"
  >
    <template #title>
      <div
        v-if="meta"
        class="flex min-w-0 w-full items-start gap-3"
      >
        <ConsultationKnowledgeListThumb
          v-if="thumbDocument"
          :document="thumbDocument"
          size="lg"
        />
        <div
          v-else
          class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200"
        >
          <UIcon
            :name="headerIcon"
            class="h-8 w-8 text-slate-500"
          />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-base font-bold text-slate-900 dark:text-slate-100">
            {{ meta.title }}
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-1.5">
            <EnBadge
              :variant="meta.sourceLabel === 'Web' ? 'assistant' : 'tag'"
              size="xs"
            >
              {{ meta.sourceLabel }}
            </EnBadge>
            <EnBadge
              variant="soft"
              color="neutral"
              size="xs"
            >
              {{ typeLabel }}
            </EnBadge>
          </div>
          <p
            v-if="meta.subtitle"
            class="mt-0.5 truncate text-xs text-slate-500"
          >
            {{ meta.subtitle }}
          </p>
        </div>
      </div>
    </template>

    <UTabs
      v-model="activeTab"
      :items="tabItems"
      class="w-full"
      :ui="{ content: 'pt-3 min-h-[280px]' }"
    >
      <template #preview>
        <div
          class="min-h-[280px]"
          role="document"
          aria-live="polite"
        >
          <div
            v-if="isLoading"
            class="flex h-[280px] items-center justify-center text-sm text-slate-500"
          >
            <UIcon
              name="material-symbols:hourglass-empty"
              class="mr-2 h-5 w-5 animate-pulse text-sky-500"
            />
            プレビューを読み込み中…
          </div>

          <EnAlert
            v-else-if="errorMessage"
            icon="material-symbols:error-outline"
            color="error"
            :title="errorMessage"
            description="設定値タブでメタデータを確認するか、ダウンロード・外部リンクから開いてください。"
          />

          <div
            v-else-if="previewMode === 'image' && resolvedUrl"
            class="flex justify-center rounded-lg bg-slate-50 p-2 dark:bg-slate-900"
          >
            <img
              :src="resolvedUrl"
              :alt="meta?.title || ''"
              class="max-h-[60vh] w-auto object-contain"
              referrerpolicy="no-referrer"
            >
          </div>

          <div
            v-else-if="previewMode === 'pdf' && resolvedUrl"
            class="h-[min(70vh,640px)] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700"
          >
            <PdfPreview
              :url="resolvedUrl"
              :is-loading="false"
              :error="null"
            />
          </div>

          <div
            v-else-if="markdownPreviewText"
            class="max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <EnMarkdown
              :markdown-text="markdownPreviewText"
              variant="help"
            />
            <p
              v-if="meta?.webUrl"
              class="mt-4 truncate border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800"
            >
              {{ meta.webUrl }}
            </p>
          </div>

          <pre
            v-else-if="plainTextPreview"
            class="max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed font-mono text-slate-800 whitespace-pre-wrap break-words dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >{{ plainTextPreview }}</pre>

          <StorageFilePreviewBody
            v-else-if="previewMode === 'google-workspace'"
            mode="google-workspace"
            :file-name="meta?.title"
            :extension="previewExtension"
            :mime-type="meta?.mimeType || ''"
            :google-open-url="googleOpenUrl"
            :google-workspace-kind="meta?.googleWorkspaceKind ?? null"
            :shortcut-email="shortcutEmail"
            :loading="false"
            :fallback-icon="headerIcon"
          />

          <div
            v-else-if="previewMode === 'csv' && csvPreviewText"
            class="max-h-[min(70vh,640px)] overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          >
            <EnCsvPreviewGrid
              :text="csvPreviewText"
              :grid-height-px="480"
            />
          </div>

          <div
            v-else-if="jsonPreviewText"
            class="max-h-[min(70vh,640px)] overflow-hidden"
          >
            <EnJsonPreview
              :text="jsonPreviewText"
              :expand-depth="3"
            />
          </div>

          <div
            v-else-if="previewMode === 'binary'"
            class="flex h-[240px] flex-col items-center justify-center gap-3 rounded-lg bg-slate-50 text-center dark:bg-slate-900"
          >
            <UIcon
              :name="headerIcon"
              class="h-12 w-12 text-slate-400"
            />
            <p class="text-sm font-medium text-slate-700 dark:text-slate-200">
              このファイルはブラウザでプレビューできません
            </p>
            <p class="text-xs text-slate-500">
              設定値タブで保存情報を確認するか、ダウンロードしてローカルで開いてください
            </p>
          </div>
        </div>
      </template>

      <template #rawData>
        <div class="space-y-2">
          <p class="text-xs text-slate-500">
            Firestore / 参照オブジェクトの生データ（デバッグ・確認用）
          </p>
          <pre
            class="max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-[11px] leading-relaxed font-mono text-slate-800 whitespace-pre-wrap break-words dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >{{ rawJson }}</pre>
        </div>
      </template>
    </UTabs>

    <template #footer>
      <EnButton
        variant="ghost"
        size="lg"
        @click="close"
      >
        閉じる
      </EnButton>
      <UButton
        v-if="meta?.webUrl"
        color="neutral"
        variant="outline"
        size="lg"
        icon="material-symbols:open-in-new"
        :href="meta.webUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        元ページを開く
      </UButton>
      <UButton
        v-if="googleOpenUrl && previewMode === 'google-workspace'"
        color="primary"
        variant="solid"
        size="lg"
        icon="material-symbols:open-in-new"
        :href="googleOpenUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ googleOpenButtonLabel }}
      </UButton>
      <UButton
        v-else-if="resolvedUrl && previewMode !== 'image' && previewMode !== 'google-workspace'"
        color="primary"
        variant="solid"
        size="lg"
        icon="material-symbols:download"
        :href="resolvedUrl"
        :download="meta?.title || 'download'"
        target="_blank"
        rel="noopener noreferrer"
      >
        ダウンロード
      </UButton>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Document as EnAiStudioDocument } from "@models/document";
import ConsultationKnowledgeListThumb from "@components/AgentWorkspace/ConsultationKnowledgeListThumb.vue";
import EnAlert from "@components/EnAlert.vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import EnMarkdown from "@components/EnMarkdown.vue";
import EnModal from "@components/EnModal.vue";
import EnJsonPreview from "@components/structured/EnJsonPreview.vue";
import EnCsvPreviewGrid from "@components/structured/EnCsvPreviewGrid.vue";
import PdfPreview from "@components/PdfPreview.vue";
import { useFirebaseStorageOperations } from "@composables/firebase-storage-operations";
import { useKnowledgePreview } from "@composables/useKnowledgePreview";
import {
  knowledgeDocumentExtension,
  knowledgeDocumentTypeLabel,
} from "@utils/consultationKnowledge";
import {
  buildKnowledgePreviewRawPayload,
  looksLikeMarkdownContent,
  parseKnowledgeGsPath,
  stringifyKnowledgePreviewRaw,
  type KnowledgePreviewMode,
} from "@utils/knowledgePreview";
import {
  googleWorkspaceOpenButtonLabel,
  googleWorkspaceTypeLabel,
  parseGoogleShortcutPayload,
  resolveGoogleWorkspaceOpenUrl,
} from "@utils/storageFilePreview";
import StorageFilePreviewBody from "@components/storage/StorageFilePreviewBody.vue";

const { isOpen, target, meta, close } = useKnowledgePreview();
const { getAuthenticatedUrl } = useFirebaseStorageOperations();

const activeTab = ref<string | number>("0");
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const resolvedUrl = ref<string | null>(null);
const textContent = ref<string | null>(null);
const googleOpenUrl = ref<string | null>(null);
const shortcutEmail = ref<string | null>(null);

const tabItems = [
  {
    label: "プレビュー",
    slot: "preview",
    icon: "i-heroicons-eye",
  },
  {
    label: "設定値",
    slot: "rawData",
    icon: "i-heroicons-code-bracket-square",
  },
];

const previewMode = computed((): KnowledgePreviewMode | null =>
  meta.value?.previewMode ?? null
);

const markdownPreviewText = computed((): string | null => {
  if (isLoading.value || errorMessage.value) return null;
  if (previewMode.value === "google-workspace" || csvPreviewText.value) {
    return null;
  }
  const mode = previewMode.value;
  if (mode === "text" || mode === "web") {
    const body = textContent.value?.trim();
    if (!body) {
      const reason = meta.value?.reasonText?.trim();
      if (reason) return reason;
      return null;
    }
    if (
      meta.value?.title?.toLowerCase().endsWith(".csv") ||
      meta.value?.mimeType?.includes("csv")
    ) {
      return null;
    }
    if (
      meta.value?.visualKind === "markdown" ||
      meta.value?.mimeType?.includes("markdown") ||
      meta.value?.title?.toLowerCase().endsWith(".md")
    ) {
      return body;
    }
    if (mode === "web") return body;
    if (looksLikeMarkdownContent(body)) return body;
    return null;
  }
  return null;
});

const rawJson = computed(() => {
  const t = target.value;
  const m = meta.value;
  if (!t) return "{}";
  return stringifyKnowledgePreviewRaw(buildKnowledgePreviewRawPayload(t, m));
});

const thumbDocument = computed((): EnAiStudioDocument | null => {
  const t = target.value;
  if (!t) return null;
  if (t.kind === "document") return t.document;
  if (t.kind === "ref" && t.document) return t.document;
  if (t.kind === "source" && t.source.document) return t.source.document;
  return null;
});

const typeLabel = computed(() => {
  if (thumbDocument.value) {
    return knowledgeDocumentTypeLabel(thumbDocument.value);
  }
  const m = meta.value;
  if (m?.googleWorkspaceKind) {
    return googleWorkspaceTypeLabel(m.googleWorkspaceKind);
  }
  const kind = m?.visualKind ?? "other";
  const map: Record<string, string> = {
    image: "画像",
    pdf: "PDF",
    markdown: "Markdown",
    web: "Web",
    other: "ファイル",
  };
  return map[kind] ?? "ファイル";
});

const previewExtension = computed(() => {
  if (thumbDocument.value) {
    return knowledgeDocumentExtension(thumbDocument.value);
  }
  const title = meta.value?.title ?? "";
  const dot = title.lastIndexOf(".");
  return dot >= 0 ? title.slice(dot + 1).toLowerCase() : "";
});

const googleOpenButtonLabel = computed(() => {
  const kind = meta.value?.googleWorkspaceKind;
  if (!kind) return "Google で開く";
  return googleWorkspaceOpenButtonLabel(kind);
});

const csvPreviewText = computed((): string | null => {
  if (isLoading.value || errorMessage.value) return null;
  const body = textContent.value?.trim();
  if (!body) return null;
  const title = meta.value?.title?.toLowerCase() ?? "";
  const mime = meta.value?.mimeType?.toLowerCase() ?? "";
  if (!title.endsWith(".csv") && !mime.includes("csv")) return null;
  return body;
});

const jsonPreviewText = computed((): string | null => {
  if (isLoading.value || errorMessage.value) return null;
  if (csvPreviewText.value) return null;
  const body = textContent.value?.trim();
  if (!body) return null;
  const title = meta.value?.title?.toLowerCase() ?? "";
  const mime = meta.value?.mimeType?.toLowerCase() ?? "";
  if (!title.endsWith(".json") && !mime.includes("json")) return null;
  return body;
});

const plainTextPreview = computed((): string | null => {
  if (isLoading.value || errorMessage.value) return null;
  if (markdownPreviewText.value || csvPreviewText.value || jsonPreviewText.value) {
    return null;
  }
  if (previewMode.value !== "text" && previewMode.value !== "web") return null;
  const body = textContent.value?.trim();
  if (body) return body;
  return meta.value?.reasonText?.trim() || null;
});

const headerIcon = computed(() => {
  const kind = meta.value?.visualKind ?? "other";
  if (kind === "web") return "material-symbols:language";
  if (kind === "pdf") return "vscode-icons:file-type-pdf2";
  if (kind === "image") return "material-symbols:image";
  return "material-symbols:description-outline";
});

const resetState = (): void => {
  isLoading.value = false;
  errorMessage.value = null;
  resolvedUrl.value = null;
  textContent.value = null;
  googleOpenUrl.value = null;
  shortcutEmail.value = null;
  activeTab.value = "0";
};

const resolveStorageUrl = async (): Promise<string | null> => {
  const m = meta.value;
  if (!m) return null;
  if (m.bucket && m.filePath) {
    try {
      return await getAuthenticatedUrl({
        bucketName: m.bucket,
        filePath: m.filePath,
      });
    } catch {
      return null;
    }
  }
  const parsed = parseKnowledgeGsPath(m.gcsPath);
  if (!parsed) return null;
  try {
    return await getAuthenticatedUrl({
      bucketName: parsed.bucket,
      filePath: parsed.path,
    });
  } catch {
    return null;
  }
};

const fetchTextContent = async (url: string): Promise<void> => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    textContent.value = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!meta.value?.inlineText?.trim()) {
      errorMessage.value = `本文の読み込みに失敗しました (${msg})`;
    }
  }
};

const loadPreview = async (): Promise<void> => {
  resetState();
  const m = meta.value;
  if (!m) return;

  activeTab.value = "0";
  isLoading.value = true;

  if (m.inlineText?.trim()) {
    textContent.value = m.inlineText.trim();
  }

  if (m.externalUrl && m.previewMode === "image") {
    resolvedUrl.value = m.externalUrl;
    isLoading.value = false;
    return;
  }

  if (m.previewMode === "google-workspace") {
    googleOpenUrl.value = m.googleOpenUrl ?? null;
    const url = await resolveStorageUrl();
    if (url) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const raw = await res.text();
          textContent.value = raw;
          const parsed = parseGoogleShortcutPayload(raw);
          shortcutEmail.value = parsed?.email ?? null;
          googleOpenUrl.value = resolveGoogleWorkspaceOpenUrl({
            kind: m.googleWorkspaceKind!,
            docId: parsed?.docId,
            driveFileId: m.driveFileId,
            webViewLink: m.webUrl,
          });
        }
      } catch {
        if (!googleOpenUrl.value) {
          errorMessage.value = "Google ドキュメントのリンクを解決できませんでした";
        }
      }
    } else if (!googleOpenUrl.value) {
      errorMessage.value = "ファイル URL を取得できませんでした";
    }
    isLoading.value = false;
    return;
  }

  const needsStorage =
    m.previewMode === "image" ||
    m.previewMode === "pdf" ||
    m.previewMode === "text";

  if (!needsStorage) {
    isLoading.value = false;
    return;
  }

  const url = await resolveStorageUrl();
  if (!url) {
    isLoading.value = false;
    if (textContent.value) return;
    if (m.previewMode !== "binary") {
      errorMessage.value =
        "ファイル URL を取得できませんでした (GCS パス未設定またはアクセス不可)";
    }
    return;
  }

  if (m.previewMode === "image" || m.previewMode === "pdf") {
    resolvedUrl.value = url;
    isLoading.value = false;
    return;
  }

  if (m.previewMode === "text") {
    resolvedUrl.value = url;
    await fetchTextContent(url);
    isLoading.value = false;
    return;
  }

  isLoading.value = false;
};

const onOpenChange = (open: boolean): void => {
  if (!open) close();
};

watch(
  () => [isOpen.value, target.value] as const,
  ([open]) => {
    if (!open || !target.value) {
      resetState();
      return;
    }
    void loadPreview();
  },
  { immediate: true }
);
</script>
