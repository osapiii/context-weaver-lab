<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-white">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div
        v-if="!entry"
        class="flex h-full min-h-[200px] flex-col items-center justify-center px-6 text-center text-sm text-neutral-500"
      >
        <UIcon
          name="material-symbols:draft-outline"
          class="mb-3 h-10 w-10 text-neutral-300"
        />
        ファイルを選択してください
      </div>

      <template v-else>
        <!-- Image -->
        <div
          v-if="entry.meta.panelKind === 'image'"
          class="flex min-h-full flex-col gap-4 bg-gradient-to-b from-purple-50/40 via-[#f6f6f7] to-[#f6f6f7] p-4 sm:p-6"
        >
          <header
            v-if="isImageRetouchPhase"
            class="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100/80 pb-3"
            data-testid="image-studio-panel-header"
          >
            <div class="min-w-0">
              <p
                class="text-[10px] font-semibold uppercase tracking-[0.12em] text-purple-800/80"
              >
                OUT · 画像スタジオ（プレビュー）
              </p>
              <h2 class="truncate text-sm font-bold text-slate-900">
                {{ entry.meta.title || "生成画像" }}
              </h2>
            </div>
            <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
              <EnBadge
                color="warning"
                variant="soft"
                :label="`v${store.primaryArtifactVersion ?? entry.artifact.artifactVersion ?? 1}`"
              />
              <EnButton
                variant="ai"
                size="xs"
                data-testid="image-studio-open-retouch-modal"
                :disabled="store.isStreaming || !imageDisplayUrl"
                @click="retouchModalOpen = true"
              >
                レタッチ編集を開く
              </EnButton>
            </div>
          </header>
          <div
            v-if="
              !isImageRetouchPhase &&
                store.imageWorkflowPhase === 'create' &&
                store.hasRetouchableImageArtifact
            "
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-200/90 bg-purple-50/90 px-3 py-2"
            data-testid="image-enter-retouch-banner"
          >
            <p class="text-[11px] font-medium text-purple-950">
              自動でレタッチに入らない場合は、ここからレタッチモードを ON にできます。
            </p>
            <EnButton
              variant="ai"
              size="xs"
              data-testid="image-enter-retouch-from-panel"
              :disabled="store.isStreaming"
              @click="onEnterRetouchFromPanel"
            >
              レタッチモードへ
            </EnButton>
          </div>
          <div
            v-if="isImageRetouchPhase && imageUrlLoading"
            class="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-purple-200 bg-white/80 px-4 py-10"
            data-testid="image-studio-url-loading"
          >
            <UIcon
              name="material-symbols:progress-activity"
              class="h-8 w-8 animate-spin text-purple-600"
            />
            <p class="text-xs font-medium text-slate-600">画像を読み込み中…</p>
          </div>
          <div
            v-else-if="isImageRetouchPhase"
            class="flex flex-col items-center gap-3"
            data-testid="image-studio-view-only"
          >
            <AdkArtifactImage
              v-if="imageDisplayUrl"
              :artifact-id="entry.artifact.artifactId"
              :url="imageDisplayUrl"
              :transient-display-url="entry.artifact.transientDisplayUrl"
              :adk-filename="entry.artifact.adkFilename"
              :artifact-version="entry.artifact.artifactVersion"
              :session-id="sessionId ?? store.sessionId"
              :alt="entry.meta.title"
              class="max-h-[calc(100vh-14rem)] w-full max-w-full object-contain shadow-lg"
            />
            <AdkArtifactImage
              v-else
              :artifact-id="entry.artifact.artifactId"
              :url="entry.artifact.url"
              :transient-display-url="entry.artifact.transientDisplayUrl"
              :adk-filename="entry.artifact.adkFilename"
              :artifact-version="entry.artifact.artifactVersion"
              :session-id="sessionId ?? store.sessionId"
              :alt="entry.meta.title"
              class="max-h-[calc(100vh-14rem)] w-full max-w-full object-contain shadow-lg"
            />
            <p
              v-if="imageResolveError && !imageUrlLoading"
              class="max-w-md text-center text-[11px] text-purple-800"
            >
              画像の取得に失敗しました。しばらく待ってから再読み込みするか、セッションを開き直してください。
            </p>
            <p
              v-else-if="store.retouchRegions.length > 0"
              class="text-center text-[11px] text-slate-600"
            >
              修正範囲 {{ store.retouchRegions.length }} 件 —
              「レタッチ編集を開く」で大画面の編集モーダルを開けます。
            </p>
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center gap-2"
          >
            <AdkArtifactImage
              :artifact-id="entry.artifact.artifactId"
              :url="entry.artifact.url"
              :transient-display-url="entry.artifact.transientDisplayUrl"
              :adk-filename="entry.artifact.adkFilename"
              :artifact-version="entry.artifact.artifactVersion"
              :session-id="sessionId ?? store.sessionId"
              :alt="entry.meta.title"
              class="max-h-[calc(100vh-12rem)] w-full max-w-full object-contain shadow-lg"
            />
          </div>
          <p
            v-if="imageUserCaption && !isImageRetouchPhase"
            class="max-w-lg text-center text-xs leading-relaxed text-neutral-600"
          >
            {{ imageUserCaption }}
          </p>

          <ImageStudioRetouchModal
            v-if="isImageRetouchPhase && imageDisplayUrl"
            v-model:open="retouchModalOpen"
            :image-url="imageDisplayUrl"
            :storage-gcs-path="imageArtifactRecord?.storageGcsPath"
            :source-gcs-path="imageArtifactRecord?.sourceGcsPath"
            :content-type="imageArtifactRecord?.contentType"
            :regions="store.retouchRegions"
            :title="entry.meta.title || '生成画像'"
            :disabled="store.isStreaming"
            :is-running-retouch="store.isStreaming"
            @update:regions="onRegionsUpdate($event)"
            @run-retouch="onRunRetouch"
            @reset-to-create="onResetToCreate"
          />
        </div>

        <!-- Markdown document (consulting prose) -->
        <article
          v-else-if="entry.meta.panelKind === 'markdown'"
          class="artifact-document-canvas mx-auto w-full max-w-3xl px-8 py-10 sm:px-12"
        >
          <header class="mb-8 border-b border-neutral-200 pb-6">
            <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Report
            </p>
            <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {{ entry.meta.title }}
            </h1>
          </header>
          <EnMarkdown
            :markdown-text="entry.artifact.body!"
            variant="default"
            :enable-router-links="false"
          />
        </article>

        <!-- Plain text block -->
        <article
          v-else-if="entry.meta.panelKind === 'text'"
          class="artifact-document-canvas mx-auto w-full max-w-3xl px-8 py-10 sm:px-12"
        >
          <pre
            class="whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.75] text-neutral-800"
          >{{ entry.artifact.body }}</pre>
        </article>

        <!-- JSON / CSV document -->
        <article
          v-else-if="entry.meta.panelKind === 'json' || entry.meta.panelKind === 'csv'"
          class="artifact-document-canvas mx-auto w-full max-w-3xl px-4 py-6 sm:px-8"
        >
          <header class="mb-4 border-b border-neutral-200 pb-4">
            <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {{ entry.meta.typeLabel }}
            </p>
            <h1 class="mt-1 text-lg font-bold tracking-tight text-slate-900">
              {{ entry.meta.title }}
            </h1>
          </header>

          <EnJsonPreview
            v-if="entry.meta.panelKind === 'json'"
            :text="documentBody"
            :loading="documentBodyLoading"
            :error-message="documentBodyError"
            :expand-depth="3"
            :empty-message="documentEmptyMessage"
          />

          <EnCsvPreviewGrid
            v-else
            :text="documentBody"
            :loading="documentBodyLoading"
            :error-message="documentBodyError"
            :grid-height-px="480"
            :empty-message="documentEmptyMessage"
          />
        </article>

        <!-- HTML consulting report -->
        <ConsultingReportHtmlFrame
          v-else-if="entry.meta.panelKind === 'html'"
          :html="entry.artifact.body!"
          :title="entry.meta.title"
          class="h-full min-h-[480px]"
        />

        <!-- Sheet operation -->
        <div
          v-else-if="entry.meta.panelKind === 'sheet'"
          class="mx-auto w-full max-w-lg px-6 py-10"
        >
          <SheetOperationArtifact
            :artifact="entry.artifact"
            :fallback-spreadsheet-url="sheetFallbackUrl"
            :fallback-sheet-gid="sheetFallbackGid"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import EnMarkdown from "@components/EnMarkdown.vue";
import AdkArtifactImage from "@components/AgentWorkspace/AdkArtifactImage.vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import ImageStudioRetouchModal from "@components/AgentWorkspace/ImageStudioRetouchModal.vue";
import ConsultingReportHtmlFrame from "@components/AgentWorkspace/ConsultingReportHtmlFrame.vue";
import SheetOperationArtifact from "@components/AgentWorkspace/SheetOperationArtifact.vue";
import EnJsonPreview from "@components/structured/EnJsonPreview.vue";
import EnCsvPreviewGrid from "@components/structured/EnCsvPreviewGrid.vue";
import { useResolvedJsonDocumentBody } from "@composables/useResolvedJsonDocumentBody";
import { useAdkSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import type { WorkspaceArtifactEntry } from "@composables/useWorkspaceArtifactPanel";
import { useAiStudioStore } from "@stores/aiStudio";
import { resolveAdkImageDisplayUrl } from "@utils/adkArtifactUrl";
import { revokeArtifactDisplayUrl } from "@utils/artifactDisplayUrl";
import { imagePrimaryHasReference } from "@utils/imageStudioState";
import type { ImageRetouchRegion } from "@utils/imageStudioState";

const props = defineProps<{
  entry: WorkspaceArtifactEntry | null;
  sessionId?: string | null;
}>();

const documentArtifact = computed(() => props.entry?.artifact ?? null);
const {
  body: documentBody,
  loading: documentBodyLoading,
  error: documentBodyError,
} = useResolvedJsonDocumentBody({
  artifact: documentArtifact,
});

const documentEmptyMessage = computed((): string => {
  if (documentBodyError.value) return documentBodyError.value;
  return "Artifact を同期中です…";
});

const store = useAiStudioStore();
const toast = useToast();
const { getArtifact } = useAdkSessionArtifacts();
const sheetFallbackUrl = computed(() => store.spreadsheetUrl);
const sheetFallbackGid = computed(() => store.targetSheetGid);
const retouchModalOpen = ref(false);

const isImageRetouchPhase = computed(
  () =>
    store.activeAgent === "image" &&
    store.imageWorkflowPhase === "retouch" &&
    imagePrimaryHasReference({
      artifactId: store.primaryArtifactId,
      adkFilename: store.primaryAdkFilename,
      artifactVersion: store.primaryArtifactVersion,
    })
);

const imageDisplayUrl = ref("");
const imageUrlLoading = ref(false);
const imageResolveError = ref(false);

const imageArtifactRecord = computed(() => {
  const artifactId = props.entry?.artifact.artifactId?.trim();
  if (!artifactId) return undefined;
  return getArtifact({ artifactId });
});

watch(
  () =>
    [
      props.entry?.meta.key,
      props.entry?.artifact.url,
      props.entry?.artifact.transientDisplayUrl,
      props.entry?.artifact.artifactId,
      props.entry?.artifact.adkFilename,
      props.entry?.artifact.artifactVersion,
      props.sessionId,
      store.sessionId,
      imageArtifactRecord.value?.storageGcsPath,
      imageArtifactRecord.value?.status,
      imageArtifactRecord.value?.adkFilename,
      imageArtifactRecord.value?.adkVersion,
    ] as const,
  async () => {
    if (!props.entry || props.entry.meta.panelKind !== "image") {
      if (imageDisplayUrl.value) {
        revokeArtifactDisplayUrl({ url: imageDisplayUrl.value });
      }
      imageDisplayUrl.value = "";
      imageUrlLoading.value = false;
      imageResolveError.value = false;
      return;
    }
    const artifact = props.entry.artifact;
    const record = imageArtifactRecord.value;
    imageUrlLoading.value = true;
    imageResolveError.value = false;
    try {
      const resolved = await resolveAdkImageDisplayUrl({
        url: artifact.url,
        transientDisplayUrl: artifact.transientDisplayUrl,
        artifactId: artifact.artifactId,
        sessionId: props.sessionId ?? store.sessionId ?? undefined,
        adkFilename: artifact.adkFilename ?? record?.adkFilename,
        artifactVersion:
          artifact.artifactVersion ??
          record?.adkVersion ??
          (artifact.adkFilename?.trim() || record?.adkFilename
            ? 0
            : undefined),
        contentType: record?.contentType,
        storageGcsPath: record?.storageGcsPath,
        getStorageGcsPath: ({ artifactId }) =>
          getArtifact({ artifactId })?.storageGcsPath,
      });
      if (imageDisplayUrl.value && imageDisplayUrl.value !== resolved) {
        revokeArtifactDisplayUrl({ url: imageDisplayUrl.value });
      }
      imageDisplayUrl.value = resolved ?? "";
      imageResolveError.value = !resolved;
    } catch {
      if (imageDisplayUrl.value) {
        revokeArtifactDisplayUrl({ url: imageDisplayUrl.value });
      }
      imageDisplayUrl.value = "";
      imageResolveError.value = true;
    } finally {
      imageUrlLoading.value = false;
    }
  },
  { immediate: true }
);

watch(isImageRetouchPhase, (active, wasActive) => {
  if (active && !wasActive && imageDisplayUrl.value) {
    retouchModalOpen.value = true;
  }
  if (!active) {
    retouchModalOpen.value = false;
  }
});

onBeforeUnmount(() => {
  if (imageDisplayUrl.value) {
    revokeArtifactDisplayUrl({ url: imageDisplayUrl.value });
  }
});

const onRegionsUpdate = (params: {
  regions: ImageRetouchRegion[];
  persist?: boolean;
}): void => {
  store.setRetouchRegions(params.regions, { persist: params.persist ?? false });
};

const onRunRetouch = async (params: {
  prompt: string;
  regions: ImageRetouchRegion[];
}): Promise<void> => {
  store.setRetouchRegions(params.regions, { persist: false });
  const committed = await store.commitImageRetouchStateToFirestore();
  if (!committed) {
    const description = !store.sessionId
      ? "セッションが開始されていません。"
      : "組織またはスペースが未選択の可能性があります。画面上部でスペースを選んでから再度お試しください。";
    toast.add({
      title: "レタッチを開始できません",
      description,
      color: "error",
    });
    return;
  }
  await store.send(params.prompt);
  if (store.lastError) {
    toast.add({
      title: "レタッチに失敗しました",
      description: store.lastError,
      color: "error",
    });
    return;
  }
  retouchModalOpen.value = false;
};

const onResetToCreate = (): void => {
  store.resetImageStudioToCreate();
  retouchModalOpen.value = false;
};

const onEnterRetouchFromPanel = async (): Promise<void> => {
  const artifact = props.entry?.artifact;
  if (artifact?.adkFilename?.trim()) {
    await store.advanceToRetouch({
      artifactId: artifact.artifactId,
      adkFilename: artifact.adkFilename,
      artifactVersion: artifact.artifactVersion,
    });
    return;
  }
  await store.enterImageRetouchMode();
};

/** edit 用の長い英語プロンプトはキャプションに出さない */
const imageUserCaption = computed((): string => {
  const prompt = props.entry?.artifact.prompt?.trim();
  if (!prompt) return "";
  if (prompt.length > 240) return "";
  if (prompt.startsWith("Edit the attached reference image")) return "";
  return prompt;
});
</script>

<style scoped>
.artifact-document-canvas :deep(.en-aistudio-prose) {
  font-size: 15px;
  line-height: 1.75;
  color: rgb(30 41 59);
}

.artifact-document-canvas :deep(.en-aistudio-prose h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  color: rgb(15 23 42);
}

.artifact-document-canvas :deep(.en-aistudio-prose h2) {
  font-size: 1.125rem;
  font-weight: 600;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgb(226 232 240);
  color: rgb(30 58 95);
}

.artifact-document-canvas :deep(.en-aistudio-prose h3) {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 1.5rem;
  color: rgb(51 65 85);
}

.artifact-document-canvas :deep(.en-aistudio-prose p) {
  margin: 0.75rem 0;
}

.artifact-document-canvas :deep(.en-aistudio-prose ul),
.artifact-document-canvas :deep(.en-aistudio-prose ol) {
  margin: 0.75rem 0;
  padding-left: 1.35rem;
}

.artifact-document-canvas :deep(.en-aistudio-prose table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  margin: 1rem 0;
}

.artifact-document-canvas :deep(.en-aistudio-prose th),
.artifact-document-canvas :deep(.en-aistudio-prose td) {
  border: 1px solid rgb(226 232 240);
  padding: 0.5rem 0.75rem;
}

.artifact-document-canvas :deep(.en-aistudio-prose th) {
  background: rgb(248 250 252);
  font-weight: 600;
  color: rgb(30 58 95);
}

.artifact-document-canvas :deep(.en-aistudio-prose hr) {
  margin: 2rem 0;
  border-color: rgb(226 232 240);
}

.artifact-document-canvas :deep(.en-aistudio-prose strong) {
  color: rgb(15 23 42);
}
</style>
