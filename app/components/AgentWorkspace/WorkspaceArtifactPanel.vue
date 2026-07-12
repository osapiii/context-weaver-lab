<template>
  <div
    class="flex h-full min-h-0 flex-col bg-[#ececee]"
    data-testid="workspace-artifact-panel"
  >
    <header
      class="flex flex-shrink-0 items-center gap-2 border-b border-neutral-300/60 bg-[#ebebeb] px-2 py-1.5"
    >
      <button
        type="button"
        class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-200/80"
        title="パネルを閉じる"
        @click="emit('close')"
      >
        <UIcon name="material-symbols:chevron-right" class="h-5 w-5" />
      </button>

      <button
        v-if="showImageFocus"
        type="button"
        class="inline-flex h-8 flex-shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200/80"
        data-testid="workspace-artifact-back-to-gallery"
        title="ギャラリーに戻る"
        @click="emit('open-image-gallery')"
      >
        <UIcon name="material-symbols:arrow-back" class="h-4 w-4" />
        ギャラリー
      </button>

      <div
        v-if="showImageList"
        class="flex min-w-0 flex-1 items-center gap-2"
      >
        <div
          class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-neutral-200/80"
        >
          <UIcon
            name="material-symbols:image-outline"
            class="h-4 w-4 text-neutral-700"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-neutral-900">
            生成画像（{{ imageEntries.length }}）
          </p>
          <p class="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            IMAGE
          </p>
        </div>
      </div>

      <div
        v-else-if="selectedEntry?.meta"
        class="flex min-w-0 flex-1 items-center gap-2"
      >
        <div
          class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-neutral-200/80"
        >
          <UIcon
            :name="selectedEntry.meta.icon"
            class="h-4 w-4 text-neutral-700"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-neutral-900">
            {{ selectedEntry.meta.title }}
          </p>
          <p class="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            {{ selectedEntry.meta.typeLabel }}
          </p>
        </div>
      </div>
      <p
        v-else
        class="min-w-0 flex-1 text-sm text-neutral-500"
      >
        ファイル出力
      </p>

      <div
        v-if="showHeaderNav"
        class="flex flex-shrink-0 items-center gap-0.5 rounded-lg bg-neutral-200/50 p-0.5"
      >
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-white/80"
          title="前のファイル"
          @click="onSelectRelative(-1)"
        >
          <UIcon name="material-symbols:chevron-left" class="h-4 w-4" />
        </button>
        <span class="min-w-[3rem] text-center text-[11px] tabular-nums text-neutral-600">
          {{ navSelectedIndex >= 0 ? navSelectedIndex + 1 : "—" }} / {{ navEntryCount }}
        </span>
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-white/80"
          title="次のファイル"
          @click="onSelectRelative(1)"
        >
          <UIcon name="material-symbols:chevron-right" class="h-4 w-4" />
        </button>
      </div>

      <div class="flex flex-shrink-0 items-center gap-0.5">
        <button
          v-if="canCopy"
          type="button"
          class="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200/80"
          title="コピー"
          @click="onCopy"
        >
          <UIcon
            :name="
              copied
                ? 'material-symbols:check'
                : 'material-symbols:content-copy'
            "
            class="h-4 w-4"
          />
          {{ copied ? "コピー済" : "コピー" }}
        </button>
        <UButton
          v-if="canDownload"
          color="neutral"
          variant="soft"
          size="sm"
          icon="material-symbols:download"
          label="ダウンロード"
          :disabled="downloading"
          :loading="downloading"
          title="ダウンロード"
          @click="onDownload"
        />
        <button
          v-if="canOpenExternal"
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-200/80"
          title="新しいタブで開く"
          @click="onOpenExternal"
        >
          <UIcon name="material-symbols:open-in-new" class="h-4 w-4" />
        </button>
      </div>
    </header>

    <WorkspaceArtifactImageList
      v-if="showImageList"
      :entries="imageEntries"
      :selected-key="selectedKey"
      :session-id="sessionId"
      :primary="imagePrimary"
      :disabled="store.isStreaming"
      @preview="onImagePreview"
      @retouch="onImageRetouch"
    />

    <WorkspaceArtifactViewer
      v-else
      :entry="selectedEntry"
      :session-id="sessionId"
    />

    <footer
      v-if="showLegacyFooter"
      class="flex flex-shrink-0 gap-1 overflow-x-auto border-t border-neutral-300/60 bg-[#e4e4e6] px-2 py-2"
    >
      <button
        v-for="entry in entries"
        :key="entry.meta?.key ?? entry.artifact.kind"
        type="button"
        class="flex max-w-[200px] flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition"
        :class="
          entry.meta?.key === selectedKey
            ? 'border-neutral-400 bg-white text-neutral-900 shadow-sm'
            : 'border-transparent bg-transparent text-neutral-600 hover:bg-white/60'
        "
        @click="onSelectEntry(entry)"
      >
        <UIcon
          :name="entry.meta?.icon ?? 'material-symbols:draft'"
          class="h-3.5 w-3.5 flex-shrink-0"
        />
        <span class="truncate font-medium">{{ entry.meta?.title ?? 'ファイル' }}</span>
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import WorkspaceArtifactImageList from "@components/AgentWorkspace/WorkspaceArtifactImageList.vue";
import WorkspaceArtifactViewer from "@components/AgentWorkspace/WorkspaceArtifactViewer.vue";
import { useResolvedJsonDocumentBody } from "@composables/useResolvedJsonDocumentBody";
import type { WorkspaceArtifactEntry } from "@composables/useWorkspaceArtifactPanel";
import { useAiStudioStore } from "@stores/aiStudio";
import { downloadAdkImageArtifact } from "@utils/artifactDownload";

const props = defineProps<{
  entries: WorkspaceArtifactEntry[];
  selectedEntry: WorkspaceArtifactEntry | null;
  selectedKey: string | null;
  selectedIndex: number;
  sessionId?: string | null;
  imageViewMode?: "list" | "focus";
}>();

const emit = defineEmits<{
  close: [];
  select: [key: string];
  "select-relative": [delta: number];
  "open-image-gallery": [];
  "open-image-focus": [];
}>();

const store = useAiStudioStore();

const imageEntries = computed(() =>
  props.entries.filter((entry) => entry.meta.panelKind === "image")
);

const isImageGalleryMode = computed(
  () => store.activeAgent === "image" && imageEntries.value.length > 0
);

const showImageList = computed(
  () => isImageGalleryMode.value && props.imageViewMode === "list"
);

const showImageFocus = computed(
  () => isImageGalleryMode.value && props.imageViewMode === "focus"
);

const showLegacyFooter = computed(
  () => !isImageGalleryMode.value && props.entries.length > 1
);

const navEntries = computed(() =>
  showImageFocus.value ? imageEntries.value : props.entries
);

const navSelectedIndex = computed(() => {
  if (!props.selectedKey) return -1;
  return navEntries.value.findIndex((entry) => entry.meta.key === props.selectedKey);
});

const navEntryCount = computed(() => navEntries.value.length);

const showHeaderNav = computed(() => {
  if (showImageList.value) return false;
  return navEntryCount.value > 1;
});

const selectedDocumentArtifact = computed(
  () => props.selectedEntry?.artifact ?? null
);
const { body: selectedDocumentBody } = useResolvedJsonDocumentBody({
  artifact: selectedDocumentArtifact,
});

const imagePrimary = computed(() => ({
  artifactId: store.primaryArtifactId,
  adkFilename: store.primaryAdkFilename,
  artifactVersion: store.primaryArtifactVersion,
}));

const syncPrimaryFromEntry = async (
  entry: WorkspaceArtifactEntry
): Promise<void> => {
  if (entry.meta.panelKind !== "image") return;
  await store.setImagePrimaryFromArtifact({
    artifactId: entry.artifact.artifactId,
    adkFilename: entry.artifact.adkFilename,
    artifactVersion: entry.artifact.artifactVersion,
  });
};

const onImagePreview = async (entry: WorkspaceArtifactEntry): Promise<void> => {
  const key = entry.meta?.key;
  if (!key) return;
  emit("select", key);
  emit("open-image-focus");
  await syncPrimaryFromEntry(entry);
};

const onImageRetouch = async (entry: WorkspaceArtifactEntry): Promise<void> => {
  const key = entry.meta?.key;
  if (key) emit("select", key);
  emit("open-image-focus");
  await store.advanceToRetouch({
    artifactId: entry.artifact.artifactId,
    adkFilename: entry.artifact.adkFilename,
    artifactVersion: entry.artifact.artifactVersion,
  });
};

const onSelectEntry = (entry: WorkspaceArtifactEntry): void => {
  const key = entry.meta?.key;
  if (key) emit("select", key);
};

const onSelectRelative = async (delta: number): Promise<void> => {
  if (showImageFocus.value) {
    const current = navSelectedIndex.value;
    if (navEntries.value.length === 0) return;
    const next =
      current < 0
        ? delta > 0
          ? 0
          : navEntries.value.length - 1
        : (current + delta + navEntries.value.length) % navEntries.value.length;
    const entry = navEntries.value[next];
    if (!entry?.meta.key) return;
    emit("select", entry.meta.key);
    if (showImageFocus.value) {
      await syncPrimaryFromEntry(entry);
    }
    return;
  }
  emit("select-relative", delta);
  await nextTick();
  const entry = props.selectedEntry;
  if (entry?.meta.panelKind === "image") {
    await syncPrimaryFromEntry(entry);
  }
};

const copied = ref(false);
const downloading = ref(false);

const canCopy = computed(() => {
  if (showImageList.value) return false;
  const kind = props.selectedEntry?.meta.panelKind;
  if (kind === "json" || kind === "csv") {
    return Boolean(selectedDocumentBody.value?.trim());
  }
  const body = props.selectedEntry?.artifact.body;
  return Boolean(body?.trim());
});

const canDownload = computed(() => {
  if (showImageList.value) return false;
  const kind = props.selectedEntry?.meta.panelKind;
  if (kind === "json" || kind === "csv") {
    return Boolean(selectedDocumentBody.value?.trim());
  }
  return kind === "image" || kind === "html";
});

const canOpenExternal = computed(
  () => !showImageList.value && props.selectedEntry?.meta.panelKind === "html"
);

const copyText = async (text: string): Promise<void> => {
  await navigator.clipboard.writeText(text);
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 2000);
};

const onCopy = async (): Promise<void> => {
  const kind = props.selectedEntry?.meta.panelKind;
  const body =
    kind === "json" || kind === "csv"
      ? selectedDocumentBody.value
      : props.selectedEntry?.artifact.body;
  if (!body) return;
  try {
    await copyText(body);
  } catch {
    // ignore
  }
};

const onOpenExternal = async (): Promise<void> => {
  const entry = props.selectedEntry;
  if (!entry?.artifact.body) return;
  const { openHtmlDocumentInNewTab } = await import("@utils/consultingReportHtml");
  openHtmlDocumentInNewTab({
    html: entry.artifact.body,
    title: entry.meta.title,
  });
};

const onDownload = async (): Promise<void> => {
  const entry = props.selectedEntry;
  if (!entry) return;
  const kind = entry.meta.panelKind;
  if ((kind === "json" || kind === "csv") && selectedDocumentBody.value) {
    const ext = kind === "csv" ? "csv" : "json";
    const mime = kind === "csv" ? "text/csv;charset=utf-8" : "application/json";
    const blob = new Blob([selectedDocumentBody.value], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      entry.artifact.adkFilename?.trim() ||
      `${entry.meta.title.replace(/\s+/g, "_")}.${ext}`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (entry.meta.panelKind === "html" && entry.artifact.body) {
    const { downloadHtmlDocument } = await import("@utils/consultingReportHtml");
    downloadHtmlDocument({
      html: entry.artifact.body,
      title: entry.meta.title,
    });
    return;
  }
  if (entry.meta.panelKind !== "image") return;
  downloading.value = true;
  try {
    const { resolveAdkImageDisplayUrl } = await import("@utils/adkArtifactUrl");
    const { useAdkSessionArtifacts } = await import(
      "@composables/useAdkSessionArtifacts"
    );
    const { getArtifact } = useAdkSessionArtifacts();
    const record = entry.artifact.artifactId
      ? getArtifact({ artifactId: entry.artifact.artifactId })
      : undefined;
    if (record?.storageGcsPath?.trim()) {
      await downloadAdkImageArtifact({
        storageGcsPath: record.storageGcsPath,
        contentType: record.contentType,
        adkFilename: entry.artifact.adkFilename ?? record.adkFilename,
        prompt: entry.artifact.prompt,
        index: entry.index,
      });
      return;
    }

    const url = await resolveAdkImageDisplayUrl({
      url: entry.artifact.url,
      transientDisplayUrl: entry.artifact.transientDisplayUrl,
      artifactId: entry.artifact.artifactId,
      sessionId: entry.artifact.sessionId ?? props.sessionId ?? undefined,
      adkFilename: entry.artifact.adkFilename ?? record?.adkFilename,
      artifactVersion:
        entry.artifact.artifactVersion ?? record?.adkVersion ?? undefined,
      contentType: record?.contentType,
      storageGcsPath: record?.storageGcsPath,
      getStorageGcsPath: ({ artifactId }) =>
        getArtifact({ artifactId })?.storageGcsPath,
    });
    if (!url) return;
    await downloadAdkImageArtifact({
      displayUrl: url,
      contentType: record?.contentType,
      adkFilename: entry.artifact.adkFilename ?? record.adkFilename,
      prompt: entry.artifact.prompt,
      index: entry.index,
    });
  } finally {
    downloading.value = false;
  }
};
</script>
