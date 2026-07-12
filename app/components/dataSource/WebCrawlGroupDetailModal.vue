<template>
  <EnModal
    v-model:open="isOpen"
    size="full"
    header-variant="dark"
    padding="none"
    fullscreen
  >
    <template #title>
      <span class="inline-flex min-w-0 items-center gap-2.5">
        <UIcon
          name="i-heroicons-globe-alt"
          class="h-[18px] w-[18px] shrink-0 text-violet-400"
        />
        <span class="truncate">
          {{ group?.title || group?.hostname || "(無題)" }}
        </span>
      </span>
    </template>

    <template #subtitle>
      <span
        v-if="group"
        class="inline-flex flex-wrap items-center gap-2"
      >
        <a
          v-if="group.entryUrl"
          :href="group.entryUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="max-w-[min(100%,28rem)] truncate font-mono text-[11px] text-white/70 hover:text-white hover:underline"
        >
          {{ group.entryUrl }}
        </a>
        <EnBadge variant="soft" color="warning" size="xs">
          {{ group.markdownCount }} ページ
        </EnBadge>
        <EnBadge variant="soft" color="neutral" size="xs">
          {{ displayImageCount }} 画像
        </EnBadge>
        <EnBadge
          v-if="group.indexedCount > 0"
          variant="soft"
          color="success"
          size="xs"
        >
          AI {{ group.indexedCount }}
        </EnBadge>
      </span>
    </template>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        v-if="group"
        class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[340px_1fr]"
      >
        <!-- 左カラム: ページリスト -->
        <aside
          class="min-h-0 overflow-y-auto border-r border-slate-200/80 bg-slate-50/50 dark:border-white/10 dark:bg-slate-900/40"
        >
          <header
            class="sticky top-0 z-10 space-y-2 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/95"
          >
            <div class="flex items-center gap-2">
              <UIcon
                name="i-heroicons-document-text"
                class="h-4 w-4 text-purple-600"
              />
              <h3 class="text-xs font-semibold tracking-wide text-gray-900 dark:text-white">
                取り込んだページ
              </h3>
              <EnBadge variant="tag" size="xs">
                {{ pages.length }}
              </EnBadge>
            </div>
            <div
              v-if="unregisteredCount > 0"
              class="flex items-center gap-2 rounded-xl bg-rose-50 px-2.5 py-2 ring-1 ring-rose-200/70 dark:bg-rose-950/20 dark:ring-rose-800/40"
            >
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="h-3.5 w-3.5 shrink-0 text-rose-500"
              />
              <span class="flex-1 text-[11px] text-rose-700 dark:text-rose-300">
                <span class="font-bold tabular-nums">{{ unregisteredCount }}</span>
                ページ未登録
              </span>
              <EnButton
                variant="soft"
                color="error"
                size="xs"
                leading-icon="i-heroicons-arrow-path"
                @click="retryAllUnregistered"
              >
                一括再取り込み
              </EnButton>
            </div>
            <EnButton
              variant="soft"
              color="neutral"
              size="xs"
              class="w-full"
              leading-icon="i-heroicons-cloud-arrow-down"
              :loading="fileSpaceStore.isLoadingDocuments"
              @click="syncWithAgentSearch"
            >
              Agent Search と同期
            </EnButton>
          </header>
          <ul
            v-if="pages.length > 0"
            class="divide-y divide-slate-100 dark:divide-white/5"
          >
            <li
              v-for="page in pages"
              :key="page.markdownFilename"
              class="group/page transition-colors"
              :class="[
                selectedPage?.markdownFilename === page.markdownFilename
                  ? 'bg-purple-50/80 ring-1 ring-inset ring-purple-200 dark:bg-purple-950/20 dark:ring-purple-800/40'
                  : page.registered
                    ? 'hover:bg-white/80 dark:hover:bg-white/[0.03]'
                    : 'bg-rose-50/30 hover:bg-rose-50/50 dark:bg-rose-950/10',
              ]"
            >
              <div class="flex items-center pr-2">
                <button
                  type="button"
                  class="min-w-0 flex-1 px-3 py-2.5 text-left"
                  @click="selectedPage = page"
                >
                  <WebCrawlPagePreviewCell
                    :label="page.previewLabel"
                    :url="page.url"
                    :description="page.description"
                    :image-url="page.imageUrl"
                    :thumbnail-gcs-path="page.thumbnailGcsPath"
                    :thumbnail-bucket="page.thumbnailBucket"
                    :index="page.index"
                    :muted="!page.registered"
                    size="sm"
                  >
                    <template #badges>
                      <UIcon
                        :name="
                          page.registered
                            ? 'i-heroicons-check-circle'
                            : 'i-heroicons-exclamation-circle'
                        "
                        class="h-3.5 w-3.5 shrink-0"
                        :class="
                          page.registered ? 'text-emerald-500' : 'text-rose-400'
                        "
                      />
                    </template>
                    <template v-if="!page.registered" #footer>
                      <p
                        class="mt-0.5 flex items-center gap-0.5 text-[10px] font-semibold text-rose-500"
                      >
                        <UIcon
                          name="i-heroicons-minus-circle"
                          class="h-2.5 w-2.5"
                        />
                        AI に未登録 (取りこぼし)
                      </p>
                    </template>
                  </WebCrawlPagePreviewCell>
                </button>
                <EnButton
                  v-if="!page.registered"
                  :loading="page.retrying"
                  variant="ghost"
                  color="error"
                  size="xs"
                  leading-icon="i-heroicons-arrow-path"
                  class="shrink-0 opacity-70 transition-opacity group-hover/page:opacity-100"
                  :title="`「${page.previewLabel}」を AI に再登録`"
                  @click.stop="retryOnePage(page)"
                />
              </div>
            </li>
          </ul>
          <div
            v-else-if="isLoadingManifest"
            class="text-center py-8 text-xs text-gray-400"
          >
            読み込み中...
          </div>
          <div
            v-else
            class="text-center py-8 text-xs text-gray-400"
          >
            ページがありません
          </div>
        </aside>

        <!-- 右カラム: プレビュー + 画像ギャラリー -->
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <UTabs
            :items="tabs"
            :model-value="activeTab"
            class="flex min-h-0 flex-1 flex-col"
            :ui="{
              list: 'shrink-0 border-b border-gray-200 px-4 dark:border-gray-800',
              content: 'flex min-h-0 flex-1 flex-col overflow-hidden',
            }"
            @update:model-value="onTabChange"
          >
            <!-- Markdown プレビュータブ -->
            <template #markdown>
              <div class="min-h-0 flex-1 overflow-y-auto">
                <div
                  v-if="!selectedPage"
                  class="h-full flex items-center justify-center text-gray-400 text-sm p-8"
                >
                  左から取り込んだページを選んでください
                </div>
                <div
                  v-else-if="markdownLoading"
                  class="p-6 text-center text-gray-400 text-sm"
                >
                  <UIcon
                    name="i-heroicons-arrow-path"
                    class="w-5 h-5 animate-spin mx-auto mb-2"
                  />
                  読み込み中...
                </div>
                <div
                  v-else-if="markdownError"
                  class="p-6 text-rose-500 text-sm"
                >
                  {{ markdownError }}
                </div>
                <div
                  v-else-if="markdownContent"
                  class="p-6"
                >
                  <EnMarkdown
                    :markdown-text="markdownContent"
                    variant="default"
                    :enable-router-links="false"
                  />
                </div>
              </div>
            </template>

            <!-- 画像ギャラリータブ -->
            <template #images>
              <div class="min-h-0 flex-1 overflow-y-auto p-3">
                <!-- dedup された件数を控えめに表示 (重複が 0 のときは出さない) -->
                <div
                  v-if="imageDedupRemoved > 0"
                  class="mb-3 text-[11px] text-gray-500 flex items-center gap-1.5"
                >
                  <UIcon
                    name="i-heroicons-funnel"
                    class="w-3.5 h-3.5 text-gray-400"
                  />
                  重複画像 <span class="font-semibold tabular-nums">{{ imageDedupRemoved }}</span> 枚を自動で除外しました
                </div>
                <div
                  v-if="dedupedImageDocs.length === 0"
                  class="text-center text-gray-400 text-sm py-12"
                >
                  画像はありません
                </div>
                <div
                  v-else
                  class="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12"
                >
                  <a
                    v-for="(img, idx) in dedupedImageDocs"
                    :key="img.name || img.filePath || idx"
                    :href="imageUrls.get(getImgKey(img)) || '#'"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group/img relative aspect-square overflow-hidden rounded-md bg-gray-100 ring-1 ring-slate-200/80 transition-all hover:ring-purple-300 dark:bg-gray-800 dark:ring-white/10"
                    :title="imageHoverTitle(img)"
                  >
                    <img
                      v-if="imageUrls.get(getImgKey(img))"
                      :src="imageUrls.get(getImgKey(img)) || ''"
                      :alt="img.displayName || ''"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    >
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center text-gray-300"
                    >
                      <UIcon name="i-heroicons-photo" class="w-6 h-6" />
                    </div>
                    <!-- hover overlay: 元ページ情報を優先表示 (フォールバックでファイル名) -->
                    <div
                      class="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/75 via-black/40 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity"
                    >
                      <div
                        v-if="img.sourcePageTitle || img.sourcePageUrl"
                        class="text-[9px] text-white truncate font-semibold leading-tight"
                      >
                        {{
                          img.sourcePageTitle ||
                            extractHostnameFromImageMeta(img.sourcePageUrl)
                        }}
                      </div>
                      <div
                        v-else
                        class="text-[9px] text-white truncate font-semibold leading-tight"
                      >
                        {{ img.displayName }}
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </template>
          </UTabs>
        </div>
      </div>
    </div>

    <template #footer>
      <EnButton
        variant="ghost"
        color="error"
        size="sm"
        leading-icon="i-heroicons-trash"
        class="mr-auto"
        @click="onDeleteAll"
      >
        この取り込みを削除
      </EnButton>
      <EnButton variant="outline" color="neutral" @click="isOpen = false">
        閉じる
      </EnButton>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import type { Document } from "@models/document";
import { useFirebaseStorageOperations } from "@composables/firebase-storage-operations";
import EnMarkdown from "@components/EnMarkdown.vue";
import EnModal from "@components/EnModal.vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import WebCrawlPagePreviewCell from "@components/dataSource/WebCrawlPagePreviewCell.vue";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import { useToast } from "#imports";
import log from "@utils/logger";
import { extractWebCrawlSessionPrefixFromFilePath } from "@utils/knowledgeStoragePaths";
import { isKnowledgeIndexed } from "@utils/knowledge";
import { useAgentSearchSync } from "@composables/useAgentSearchSync";
import {
  buildWebCrawlUploadMetadata,
  webCrawlMarkdownFirestoreDocId,
} from "@utils/webCrawlFirestoreDocIds";

import type { WebCrawlGroup } from "@types/webCrawlGroup";

interface Props {
  open: boolean;
  group: WebCrawlGroup | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  "delete-group": [group: WebCrawlGroup];
  refresh: [];
}>();

const isOpen = computed<boolean>({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

const firebaseStorageOps = useFirebaseStorageOperations();
const fileSpaceStore = useGeminiFileSpaceOperatorStore();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
const toast = useToast();
const { syncFileSpaceWithAgentSearch } = useAgentSearchSync();

/** ページが Agent Search に載っているか (markdown または当該 URL の画像) */
function isPageRegisteredInAgentSearch(
  pageUrl: string | null,
  doc: Document | null,
  imageDocs: Document[]
): boolean {
  if (doc && isKnowledgeIndexed(doc)) return true;
  if (!pageUrl) return false;
  return imageDocs.some(
    (img) => img.sourcePageUrl === pageUrl && isKnowledgeIndexed(img)
  );
}

//#region 統合ページリスト: manifest.json + 登録済 Document を突合
type PageItem = {
  index: number;
  title: string;
  previewLabel: string;
  description: string | null;
  imageUrl: string | null;
  thumbnailGcsPath: string | null;
  thumbnailBucket: string | null;
  url: string | null;
  markdownFilename: string;
  gcsPath: string | null;
  doc: Document | null;
  registered: boolean;
  retrying: boolean;
};

function pagePreviewFromDoc(
  doc: Document | null,
  fallbackTitle: string,
  pageUrl: string | null,
  markdownFilename: string,
  imageDocs: Document[],
  bucketFallback: string | null,
  markdownMeta: Map<string, MarkdownPathMeta>
): Pick<
  PageItem,
  "previewLabel" | "description" | "imageUrl" | "thumbnailGcsPath" | "thumbnailBucket"
> {
  const meta = markdownMeta.get(markdownFilename);
  const previewLabel =
    doc?.ogTitle?.trim() ||
    meta?.ogTitle?.trim() ||
    doc?.title?.trim() ||
    fallbackTitle;
  const imageUrl = doc?.ogImage?.trim() || meta?.ogImage?.trim() || null;
  let thumbnailGcsPath =
    doc?.thumbnailGcsPath ?? meta?.thumbnailGcsPath ?? null;
  let thumbnailBucket =
    doc?.thumbnailBucket ??
    (meta?.thumbnailGcsPath ? bucketFallback : null);

  if (!imageUrl && !thumbnailGcsPath && pageUrl) {
    const pageImage = imageDocs.find((img) => img.sourcePageUrl === pageUrl);
    if (pageImage?.filePath) {
      thumbnailGcsPath = pageImage.filePath;
      thumbnailBucket = pageImage.bucketName ?? bucketFallback;
    }
  }

  return {
    previewLabel,
    description:
      doc?.ogDescription?.trim() || meta?.ogDescription?.trim() || null,
    imageUrl,
    thumbnailGcsPath,
    thumbnailBucket,
  };
}

type ManifestEntry = {
  index?: number;
  url?: string;
  title?: string;
  markdownFilename?: string;
};

type MarkdownPathMeta = {
  filename?: string;
  url?: string;
  title?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  thumbnailGcsPath?: string;
};

const manifestEntries = ref<ManifestEntry[]>([]);
const markdownMetaByFilename = ref<Map<string, MarkdownPathMeta>>(new Map());
const isLoadingManifest = ref(false);
const manifestError = ref<string | null>(null);

// gcsPrefix を group から取得 (markdownDocs の filePath は `{prefix}/page-NNN.md`)
const groupGcsPrefix = computed<string | null>(() => {
  const g = props.group;
  if (!g) return null;
  // markdownDocs か imageDocs から gcsPrefix を取得
  for (const d of [...g.markdownDocs, ...g.imageDocs]) {
    if (d.gcsPrefix) return d.gcsPrefix;
    if (d.filePath) {
      const fromPath = extractWebCrawlSessionPrefixFromFilePath(d.filePath);
      if (fromPath) return fromPath;
    }
  }
  return null;
});

const groupBucketName = computed<string | null>(() => {
  const g = props.group;
  if (!g) return null;
  for (const d of [...g.markdownDocs, ...g.imageDocs, ...g.otherDocs]) {
    if (d.bucketName) return d.bucketName;
  }
  return null;
});

/** Firestore imageDocs が無いとき GCS images/ から一覧 (DE のみ登録済みの修復表示) */
const gcsImageCatalog = ref<Document[]>([]);

const groupImageDocs = computed<Document[]>(() => {
  const g = props.group;
  if (!g) return [];
  if (g.imageDocs.length > 0) return g.imageDocs;
  return gcsImageCatalog.value;
});

const loadGcsImageCatalog = async () => {
  gcsImageCatalog.value = [];
  const g = props.group;
  if (!g || g.imageDocs.length > 0) return;

  const bucket = groupBucketName.value;
  const prefix = groupGcsPrefix.value;
  const orgId =
    g.markdownDocs[0]?.organizationId || g.otherDocs[0]?.organizationId;
  if (!bucket || !prefix || !orgId) return;

  const imagePrefix = prefix.endsWith("/")
    ? `${prefix}images/`
    : `${prefix}/images/`;

  try {
    const { files } = await firebaseStorageOps.listFiles({
      bucketName: bucket,
      path: imagePrefix,
      organizationId: orgId,
    });
    const imageExt = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
    gcsImageCatalog.value = files
      .filter((f) => imageExt.test(f.name))
      .map(
        (f) =>
          ({
            id: `gcs-catalog-${f.fullPath}`,
            name: f.fullPath,
            displayName: f.name.split("/").pop() || f.name,
            bucketName: bucket,
            filePath: f.fullPath,
            mimeType: f.contentType,
            webCrawlRequestId: g.key,
            gcsPrefix: prefix,
            createTime: null,
            updateTime: null,
            organizationId: orgId,
            spaceId: g.markdownDocs[0]?.spaceId,
            storeId: g.markdownDocs[0]?.storeId,
          }) as Document
      );
  } catch (e) {
    log("WARN", "GCS image catalog load failed", e);
  }
};

const loadWorkflowPageMeta = async () => {
  const bucket = groupBucketName.value;
  const prefix = groupGcsPrefix.value;
  markdownMetaByFilename.value = new Map();
  if (!bucket || !prefix) return;
  try {
    const statePath = `${prefix}/.web-crawl/workflow-state.json`;
    const url = await firebaseStorageOps.getAuthenticatedUrl({
      bucketName: bucket,
      filePath: statePath,
    });
    if (!url) return;
    const resp = await fetch(url);
    if (!resp.ok) return;
    const state = await resp.json();
    const paths = Array.isArray(state?.gcs_markdown_paths)
      ? state.gcs_markdown_paths
      : [];
    const next = new Map<string, MarkdownPathMeta>();
    for (const entry of paths) {
      if (entry?.filename) next.set(entry.filename, entry);
    }
    markdownMetaByFilename.value = next;
  } catch {
    // workflow-state が無い旧 crawl では manifest / Document のみ
  }
};

const loadManifest = async () => {
  const bucket = groupBucketName.value;
  const prefix = groupGcsPrefix.value;
  manifestEntries.value = [];
  manifestError.value = null;
  if (!bucket || !prefix) return;
  isLoadingManifest.value = true;
  try {
    const manifestPath = `${prefix}/manifest.json`;
    const url = await firebaseStorageOps.getAuthenticatedUrl({
      bucketName: bucket,
      filePath: manifestPath,
    });
    if (!url) {
      manifestError.value = "manifest.json の URL 取得に失敗";
      return;
    }
    const resp = await fetch(url);
    if (!resp.ok) {
      manifestError.value = `manifest.json 取得失敗: HTTP ${resp.status}`;
      return;
    }
    const json = await resp.json();
    manifestEntries.value = Array.isArray(json.pages) ? json.pages : [];
  } catch (e) {
    manifestError.value = `manifest 読み込みエラー: ${(e as Error).message || e}`;
  } finally {
    isLoadingManifest.value = false;
  }
};

// 統合ページリスト: manifest が空なら登録済 Document だけで構成
const pages = computed<PageItem[]>(() => {
  const g = props.group;
  if (!g) return [];
  const prefix = groupGcsPrefix.value;
  const bucket = groupBucketName.value;
  const markdownMeta = markdownMetaByFilename.value;

  // Document の filePath 末尾 (page-NNN.md) → Document の map
  const docByFilename = new Map<string, Document>();
  for (const d of g.markdownDocs) {
    const fp = d.filePath || "";
    const m = fp.match(/(page-\d+\.md)$/);
    if (m) docByFilename.set(m[1] || "", d);
  }

  // manifest がある場合: それを真実の source としつつ Document を突合
  if (manifestEntries.value.length > 0) {
    return manifestEntries.value
      .map((e, idx) => {
        const filename = e.markdownFilename || `page-${(idx + 1).toString().padStart(3, "0")}.md`;
        const doc = docByFilename.get(filename) || null;
        const gcsPath = prefix ? `${prefix}/${filename}` : null;
        const title = e.title || doc?.title || doc?.displayName || filename;
        const url = e.url ?? doc?.sourceUrl ?? doc?.url ?? null;
        return {
          index: (e.index ?? idx) + 1,
          title,
          ...pagePreviewFromDoc(
            doc,
            title,
            url,
            filename,
            groupImageDocs.value,
            bucket,
            markdownMeta
          ),
          url,
          markdownFilename: filename,
          gcsPath,
          doc,
          registered: isPageRegisteredInAgentSearch(
            url,
            doc,
            groupImageDocs.value
          ),
          retrying: retryingFilenames.value.has(filename),
        };
      })
      .sort((a, b) => a.index - b.index);
  }

  // manifest が読めない場合のフォールバック: 登録済 Document だけを並べる
  return g.markdownDocs.map((doc, idx) => {
    const filename = (doc.filePath || "").split("/").pop() || `page-${idx + 1}.md`;
    const title = doc.title || doc.displayName || filename;
    const url = doc.sourceUrl || doc.url || null;
    return {
      index: idx + 1,
      title,
      ...pagePreviewFromDoc(
        doc,
        title,
        url,
        filename,
        groupImageDocs.value,
        bucket,
        markdownMeta
      ),
      url,
      markdownFilename: filename,
      gcsPath: doc.filePath || null,
      doc,
      registered: isPageRegisteredInAgentSearch(
        url,
        doc,
        groupImageDocs.value
      ),
      retrying: false,
    };
  });
});

const unregisteredCount = computed(
  () => pages.value.filter((p) => !p.registered).length
);
//#endregion

//#region タブ
const tabs = computed(() => [
  {
    slot: "markdown",
    value: "markdown",
    label: `Markdown (${props.group?.markdownDocs.length ?? 0})`,
    icon: "i-heroicons-document-text",
  },
  {
    slot: "images",
    value: "images",
    label: `画像 (${groupImageDocs.value.length})`,
    icon: "i-heroicons-photo",
  },
]);

const activeTab = ref<string>("markdown");
const onTabChange = (v: string | number) => {
  activeTab.value = String(v);
};
//#endregion

//#region Markdown selection + content load
const selectedPage = ref<PageItem | null>(null);
const markdownContent = ref<string | null>(null);
const markdownLoading = ref(false);
const markdownError = ref<string | null>(null);

// 再取り込み中の filename 集合 (retry button のローディング表示用)
const retryingFilenames = ref<Set<string>>(new Set());

const loadMarkdownByGcsPath = async (
  bucketName: string | null,
  filePath: string | null
) => {
  markdownContent.value = null;
  markdownError.value = null;
  if (!bucketName || !filePath) {
    markdownError.value = "GCS パス情報がありません";
    return;
  }
  markdownLoading.value = true;
  try {
    const url = await firebaseStorageOps.getAuthenticatedUrl({
      bucketName,
      filePath,
    });
    if (!url) {
      markdownError.value = "ファイル URL を取得できませんでした";
      return;
    }
    const resp = await fetch(url);
    if (!resp.ok) {
      markdownError.value = `ファイル取得失敗: HTTP ${resp.status}`;
      return;
    }
    const text = await resp.text();
    markdownContent.value = text;
  } catch (e) {
    markdownError.value = `エラー: ${(e as Error).message || e}`;
  } finally {
    markdownLoading.value = false;
  }
};

watch(selectedPage, (p) => {
  if (!p) {
    markdownContent.value = null;
    return;
  }
  loadMarkdownByGcsPath(groupBucketName.value, p.gcsPath);
});

// group が変わったときに manifest を fetch + 先頭ページを自動選択
watch(
  () => props.group,
  async (g) => {
    activeTab.value = "markdown";
    if (!g) {
      selectedPage.value = null;
      manifestEntries.value = [];
      markdownMetaByFilename.value = new Map();
      return;
    }
    // manifest 取得 (登録済ページの順番もこれで決まる)
    await Promise.all([
      loadManifest(),
      loadWorkflowPageMeta(),
      loadGcsImageCatalog(),
    ]);
    // 自動選択: 登録済の先頭 (無ければ pages の先頭)
    const firstRegistered = pages.value.find((p) => p.registered);
    selectedPage.value = firstRegistered || pages.value[0] || null;
  },
  { immediate: true }
);

const resolveGroupFileSpaceId = (): string | null => {
  const g = props.group;
  if (!g) return null;
  return (
    g.markdownDocs[0]?.storeId ||
    g.imageDocs[0]?.storeId ||
    g.otherDocs[0]?.storeId ||
    null
  );
};

const syncWithAgentSearch = async () => {
  const storeId = resolveGroupFileSpaceId();
  if (!storeId) return;
  await syncFileSpaceWithAgentSearch(storeId, {
    onCompleted: () => emit("refresh"),
  });
};

//#region 再取り込み (fileSpaceUpload RequestDoc 発行)
const retryOnePage = async (page: PageItem) => {
  if (!page.gcsPath || page.registered) return;
  const bucket = groupBucketName.value;
  const fileSpaceId = props.group?.markdownDocs[0]?.storeId || null;
  const orgId = organizationStore.getLoggedInOrganizationId;
  const spaceId = spaceStore.selectedSpace?.id;
  if (!bucket || !fileSpaceId || !orgId || !spaceId) {
    toast.add({
      title: "再取り込みコンテキスト不足",
      description: "bucket / fileSpaceId / org / space のいずれかが未取得",
      color: "error",
    });
    return;
  }

  retryingFilenames.value.add(page.markdownFilename);
  try {
    const firestoreDocId = await webCrawlMarkdownFirestoreDocId(
      page.gcsPath,
      page.markdownFilename
    );
    const req = await fileSpaceStore.createFileSpaceRequest({
      operationType: "fileSpaceUpload",
      storeId: fileSpaceId,
      bucketName: bucket,
      filePath: page.gcsPath,
      mimeType: "text/markdown",
      documentId: firestoreDocId,
      customMetadata: buildWebCrawlUploadMetadata({
        firestoreDocId,
        bucketName: bucket,
        filePath: page.gcsPath,
        webCrawlRequestId: props.group?.key ?? null,
        pageFilename: page.markdownFilename,
        sourcePageUrl: page.url,
        subCategory: "urlMarkdown",
      }),
      description: `Web 取り込み再登録: ${page.title}`,
      organizationId: orgId,
      spaceId,
    });
    if (req) {
      toast.add({
        title: `「${page.previewLabel}」を再登録しています`,
        description:
          "AI に登録され次第、自動でリストに反映されます (10-30秒)",
        color: "info",
      });
    } else {
      toast.add({
        title: "再登録リクエストの作成に失敗",
        color: "error",
      });
    }
  } catch (e) {
    log("ERROR", "retryOnePage failed", e);
    toast.add({ title: "再取り込みに失敗", color: "error" });
  } finally {
    // 一定時間 retrying 表示を残してから解除 (UI 体感)
    setTimeout(() => {
      retryingFilenames.value.delete(page.markdownFilename);
    }, 8000);
  }
};

const retryAllUnregistered = async () => {
  const targets = pages.value.filter((p) => !p.registered);
  if (targets.length === 0) return;
  if (
    !window.confirm(
      `未登録 ${targets.length} ページをすべて再取り込みします。よろしいですか?`
    )
  ) {
    return;
  }
  // 同時に多数 RequestDoc を立てると backend が詰まるので、少しずつ ramping
  for (const p of targets) {
    void retryOnePage(p);
    await new Promise((r) => setTimeout(r, 200));
  }
  toast.add({
    title: `${targets.length} ページの再登録を開始`,
    description: "順次バックグラウンドで処理されます",
    color: "info",
  });
};
//#endregion
//#endregion

//#region 画像の dedup + Signed URL 取得
// 同 contentHash / sourceUrl を持つ Document が複数あれば最初の 1 件だけ採用.
// 古い crawl で backend 側 dedup が無かったため UI 側でも安全網を張る.
// 優先キー: contentHash (bytes 同一) > sourceUrl (URL 同一) > filePath (fallback)
const dedupedImageDocs = computed<Document[]>(() => {
  const imgs = groupImageDocs.value;
  const seen = new Set<string>();
  const result: Document[] = [];
  for (const d of imgs) {
    const key = d.contentHash || d.sourceUrl || d.filePath || d.name || "";
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(d);
  }
  return result;
});

const displayImageCount = computed(() =>
  Math.max(props.group?.imageCount ?? 0, dedupedImageDocs.value.length)
);

const imageDedupRemoved = computed<number>(() => {
  return groupImageDocs.value.length - dedupedImageDocs.value.length;
});

const extractHostnameFromImageMeta = (
  url: string | null | undefined
): string => {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const imageHoverTitle = (img: Document): string => {
  const parts: string[] = [];
  if (img.displayName) parts.push(img.displayName);
  if (img.sourcePageTitle) {
    parts.push(`元ページ: ${img.sourcePageTitle}`);
  } else if (img.sourcePageUrl) {
    parts.push(`元ページ: ${img.sourcePageUrl}`);
  }
  if (img.sourceUrl) parts.push(img.sourceUrl);
  return parts.join("\n");
};

const imageUrls = ref<Map<string, string>>(new Map());

const getImgKey = (doc: Document): string =>
  `${doc.bucketName || ""}/${doc.filePath || ""}`;

watch(
  groupImageDocs,
  async (imgs) => {
    if (!imgs) {
      imageUrls.value = new Map();
      return;
    }
    const m = new Map<string, string>();
    // 50 件ずつ並列で Signed URL 取得
    const tasks = imgs.map(async (img) => {
      if (!img.bucketName || !img.filePath) return;
      const key = getImgKey(img);
      try {
        const url = await firebaseStorageOps.getAuthenticatedUrl({
          bucketName: img.bucketName,
          filePath: img.filePath,
        });
        if (url) m.set(key, url);
      } catch {
        // skip
      }
    });
    await Promise.all(tasks);
    imageUrls.value = m;
  },
  { immediate: true }
);
//#endregion

//#region 削除
const onDeleteAll = () => {
  if (!props.group) return;
  if (
    !window.confirm(
      `この取り込み (${props.group.markdownDocs.length} ページ + ${props.group.imageDocs.length} 画像) をすべて削除しますか?`
    )
  ) {
    return;
  }
  emit("delete-group", props.group);
};
//#endregion
</script>

<style scoped>
/* UTabs パネルに flex 高さ制約を伝播し、右カラム内スクロールを有効化 */
:deep([role="tabpanel"]) {
  display: flex;
  flex: 1 1 0%;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
</style>
