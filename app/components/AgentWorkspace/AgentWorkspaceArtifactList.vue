<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto px-3 py-3">
      <!-- 空状態 -->
      <div
        v-if="artifacts.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <UIcon
          name="material-symbols:folder-open"
          class="h-10 w-10 text-neutral-300"
        />
        <p class="mt-3 text-sm font-semibold text-neutral-600">
          まだファイル出力はありません
        </p>
        <p class="mt-1 text-xs text-neutral-400">
          チャットが進むとここに表示されます
        </p>
      </div>

      <div v-else class="space-y-3">
        <EnCard
          v-for="(a, i) in artifacts"
          :key="`artifact-${i}`"
          variant="default"
          padding="snug"
        >
          <!-- image -->
          <template
            v-if="a.kind === 'image' && (a.artifactId || a.url)"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <UIcon
                  name="material-symbols:image"
                  class="h-4 w-4 text-violet-500"
                />
                <span class="text-xs font-semibold text-neutral-700">
                  生成画像
                </span>
              </div>
              <div class="flex items-center gap-1">
                <EnButton
                  variant="ghost"
                  size="xs"
                  leading-icon="material-symbols:zoom-in"
                  @click="openImagePreview(a, i)"
                >
                  プレビュー
                </EnButton>
                <EnButton
                  variant="ghost"
                  size="xs"
                  leading-icon="material-symbols:download"
                  :loading="downloadingIndex === i"
                  @click="downloadImage(a, i)"
                >
                  DL
                </EnButton>
              </div>
            </div>
            <button
              type="button"
              class="group relative block w-full overflow-hidden rounded-md border border-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              @click="openImagePreview(a, i)"
            >
              <AdkArtifactImage
                :artifact-id="a.artifactId"
                :url="a.url"
                :adk-filename="a.adkFilename"
                :artifact-version="a.artifactVersion"
                :alt="a.prompt || 'generated image'"
                class="w-full transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <span
                class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100"
              >
                <UIcon
                  name="material-symbols:zoom-in"
                  class="h-8 w-8 text-white drop-shadow"
                />
              </span>
            </button>
            <p
              v-if="a.prompt"
              class="mt-2 text-[11px] text-neutral-500 line-clamp-2"
            >
              {{ a.prompt }}
            </p>
          </template>

          <!-- markdown_document -->
          <template v-else-if="a.kind === 'markdown_document' && a.body">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <UIcon
                  name="material-symbols:markdown"
                  class="h-4 w-4 text-violet-500"
                />
                <span class="text-xs font-semibold text-neutral-700">
                  {{ a.title || "Markdown" }}
                </span>
              </div>
              <EnButton
                variant="ghost"
                size="xs"
                leading-icon="material-symbols:content-copy"
                @click="copyText(a.body!)"
              >
                コピー
              </EnButton>
            </div>
            <EnMarkdown
              :markdown-text="a.body"
              variant="ai"
              compact
              class="max-h-64 overflow-y-auto rounded bg-neutral-50 p-2.5"
            />
          </template>

          <!-- html_document -->
          <template v-else-if="a.kind === 'html_document' && a.body">
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon
                  name="material-symbols:analytics"
                  class="h-4 w-4 text-slate-600"
                />
                <span class="text-xs font-semibold text-neutral-800">
                  {{ a.title || "レポート" }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <EnButton
                  variant="ghost"
                  size="xs"
                  leading-icon="material-symbols:open-in-new"
                  @click="onOpenHtmlReport({ html: a.body!, title: a.title })"
                >
                  開く
                </EnButton>
                <EnButton
                  variant="ghost"
                  size="xs"
                  leading-icon="material-symbols:download"
                  @click="onDownloadHtmlReport({ html: a.body!, title: a.title })"
                >
                  DL
                </EnButton>
              </div>
            </div>
            <ConsultingReportHtmlFrame
              :html="a.body"
              :title="a.title || 'レポート'"
              compact
              :show-toolbar="false"
              :allow-fullscreen="false"
              class="overflow-hidden rounded-lg ring-1 ring-neutral-200"
            />
          </template>

          <!-- json_document -->
          <WritingJsonArtifactCard
            v-else-if="a.kind === 'json_document'"
            :artifact="a"
          />

          <!-- text_block -->
          <template v-else-if="a.kind === 'text_block' && a.body">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <UIcon
                  name="material-symbols:content-copy"
                  class="h-4 w-4 text-emerald-500"
                />
                <span class="text-xs font-semibold text-neutral-700">
                  {{ a.title || "テキスト" }}
                </span>
              </div>
              <EnButton
                variant="ghost"
                size="xs"
                leading-icon="material-symbols:content-copy"
                @click="copyText(a.body!)"
              >
                コピー
              </EnButton>
            </div>
            <pre
              class="whitespace-pre-wrap break-words rounded bg-neutral-50 p-2.5 text-[12px] leading-relaxed text-neutral-800"
            >{{ a.body }}</pre>
          </template>

          <!-- sheet_op -->
          <SheetOperationArtifact
            v-else-if="a.kind === 'sheet_op' && a.summary"
            :artifact="a"
            :fallback-spreadsheet-url="sheetFallbackUrl"
            :fallback-sheet-gid="sheetFallbackGid"
          />

          <!-- citation -->
          <template v-else-if="a.kind === 'citation' && a.title">
            <div class="flex items-center gap-2 mb-2">
              <UIcon
                name="material-symbols:bookmark"
                class="h-4 w-4 text-sky-500"
              />
              <span class="text-xs font-semibold text-neutral-700">
                {{ a.title }}
              </span>
            </div>
            <p
              v-if="a.snippet"
              class="text-[12px] leading-relaxed text-neutral-700 line-clamp-3"
            >
              {{ a.snippet }}
            </p>
            <a
              v-if="a.citationUri"
              :href="a.citationUri"
              target="_blank"
              rel="noopener"
              class="mt-2 inline-flex items-center gap-1 text-[11px] text-sky-600 hover:underline"
            >
              元資料を開く
              <UIcon
                name="material-symbols:open-in-new"
                class="h-3 w-3"
              />
            </a>
          </template>
        </EnCard>
      </div>
    </div>

    <EnModal
      v-model:open="previewOpen"
      :title="previewTitle"
      size="4xl"
      header-variant="brand"
      padding="compact"
    >
      <div
        v-if="previewArtifact && (previewArtifact.artifactId || previewArtifact.url)"
        class="space-y-3"
      >
        <AdkArtifactImage
          :artifact-id="previewArtifact.artifactId"
          :url="previewArtifact.url"
          :adk-filename="previewArtifact.adkFilename"
          :artifact-version="previewArtifact.artifactVersion"
          :alt="previewArtifact.prompt || 'generated image'"
          class="mx-auto max-h-[70vh] w-full rounded-lg border border-neutral-200 object-contain bg-neutral-50"
        />
        <p
          v-if="previewArtifact.prompt"
          class="text-xs text-neutral-600 whitespace-pre-wrap"
        >
          {{ previewArtifact.prompt }}
        </p>
      </div>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <EnButton
            variant="outline"
            @click="previewOpen = false"
          >
            閉じる
          </EnButton>
          <EnButton
            v-if="previewArtifact?.url"
            variant="solid"
            leading-icon="material-symbols:download"
            :loading="previewDownloading"
            @click="downloadPreviewImage"
          >
            ダウンロード
          </EnButton>
        </div>
      </template>
    </EnModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useAiStudioStore } from "@stores/aiStudio";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import { downloadAdkImageArtifact } from "@utils/artifactDownload";
import EnCard from "@components/EnCard.vue";
import EnButton from "@components/EnButton.vue";
import EnMarkdown from "@components/EnMarkdown.vue";
import EnModal from "@components/EnModal.vue";
import AdkArtifactImage from "@components/AgentWorkspace/AdkArtifactImage.vue";
import ConsultingReportHtmlFrame from "@components/AgentWorkspace/ConsultingReportHtmlFrame.vue";
import SheetOperationArtifact from "@components/AgentWorkspace/SheetOperationArtifact.vue";
import WritingJsonArtifactCard from "@components/AgentWorkspace/WritingJsonArtifactCard.vue";
import { useAdkSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import { resolveAdkImageDisplayUrl } from "@utils/adkArtifactUrl";
import {
  downloadHtmlDocument,
  openHtmlDocumentInNewTab,
} from "@utils/consultingReportHtml";

const store = useAiStudioStore();
const sheetFallbackUrl = computed(() => store.spreadsheetUrl);
const sheetFallbackGid = computed(() => store.targetSheetGid);
const { getArtifact } = useAdkSessionArtifacts();

const artifacts = computed<AgentSseArtifact[]>(() => {
  const collected: AgentSseArtifact[] = [];
  for (const m of store.messages) {
    if (m.artifacts && m.artifacts.length > 0) {
      collected.push(...m.artifacts);
    }
  }
  return collected;
});

const previewOpen = ref(false);
const previewArtifact = ref<AgentSseArtifact | null>(null);
const previewIndex = ref(0);
const downloadingIndex = ref<number | null>(null);
const previewDownloading = ref(false);

const previewTitle = computed(() => {
  const title = previewArtifact.value?.prompt?.trim();
  return title ? `生成画像 — ${title.slice(0, 40)}` : "生成画像プレビュー";
});

const openImagePreview = (artifact: AgentSseArtifact, index: number) => {
  previewArtifact.value = artifact;
  previewIndex.value = index;
  previewOpen.value = true;
};

const runArtifactDownload = async (params: {
  artifact: AgentSseArtifact;
  index: number;
}): Promise<void> => {
  const { artifact, index } = params;
  const record = artifact.artifactId
    ? getArtifact({ artifactId: artifact.artifactId })
    : undefined;
  if (record?.storageGcsPath?.trim()) {
    await downloadAdkImageArtifact({
      storageGcsPath: record.storageGcsPath,
      contentType: record.contentType,
      adkFilename: artifact.adkFilename ?? record.adkFilename,
      prompt: artifact.prompt,
      index,
    });
    return;
  }
  const url = await resolveAdkImageDisplayUrl({
    url: artifact.url,
    transientDisplayUrl: artifact.transientDisplayUrl,
    artifactId: artifact.artifactId,
    sessionId: artifact.sessionId,
    adkFilename: artifact.adkFilename ?? record?.adkFilename,
    artifactVersion: artifact.artifactVersion ?? record?.adkVersion,
    contentType: record?.contentType,
    storageGcsPath: record?.storageGcsPath,
    getStorageGcsPath: ({ artifactId }) =>
      getArtifact({ artifactId })?.storageGcsPath,
  });
  if (!url) return;
  await downloadAdkImageArtifact({
    displayUrl: url,
    contentType: record?.contentType,
    adkFilename: artifact.adkFilename ?? record?.adkFilename,
    prompt: artifact.prompt,
    index,
  });
};

const downloadImage = async (artifact: AgentSseArtifact, index: number) => {
  downloadingIndex.value = index;
  try {
    await runArtifactDownload({ artifact, index });
  } finally {
    downloadingIndex.value = null;
  }
};

const downloadPreviewImage = async () => {
  const artifact = previewArtifact.value;
  if (!artifact) return;
  previewDownloading.value = true;
  try {
    await runArtifactDownload({ artifact, index: previewIndex.value });
  } finally {
    previewDownloading.value = false;
  }
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
};

const onOpenHtmlReport = (params: { html: string; title?: string }): void => {
  openHtmlDocumentInNewTab(params);
};

const onDownloadHtmlReport = (params: { html: string; title?: string }): void => {
  downloadHtmlDocument(params);
};
</script>
