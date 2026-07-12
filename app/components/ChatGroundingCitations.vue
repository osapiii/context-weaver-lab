<template>
  <div v-if="hasAnyCitation" class="space-y-3">
    <!-- ============================================================ -->
    <!-- 関連パッケージ (Web 取り込み単位、 webCrawlRequestId でグルーピング) -->
    <!-- ============================================================ -->
    <div v-if="relatedPackages.length > 0" class="space-y-2">
      <div class="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
        <UIcon name="i-heroicons-folder-open" class="w-3.5 h-3.5 text-purple-500" />
        関連パッケージ
        <span class="text-gray-400 font-mono">({{ relatedPackages.length }})</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div
          v-for="pkg in relatedPackages"
          :key="pkg.key"
          class="group/pkg rounded-lg bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-purple-300 hover:shadow-sm transition-all overflow-hidden"
        >
          <!-- 上端アクセント -->
          <div class="h-0.5 bg-gradient-to-r from-purple-400 to-violet-500" />
          <div class="flex items-center gap-2.5 px-3 py-2.5">
            <div
              class="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0"
            >
              <UIcon
                name="i-heroicons-globe-alt"
                class="w-4 h-4 text-purple-600 dark:text-purple-300"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div
                class="text-xs font-semibold text-gray-900 dark:text-white truncate"
                :title="pkg.title"
              >
                {{ pkg.title }}
              </div>
              <div
                v-if="pkg.hostname"
                class="text-[10px] text-gray-400 font-mono truncate"
              >
                {{ pkg.hostname }}
              </div>
              <div class="text-[10px] text-purple-700 dark:text-purple-400 font-semibold mt-0.5">
                {{ pkg.citedPageCount }} ページから引用
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 引用 (ファイル単位、chip 形式)                                    -->
    <!-- ============================================================ -->
    <div v-if="citationChips.length > 0" class="space-y-1.5">
      <div class="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
        <UIcon name="i-heroicons-bookmark" class="w-3.5 h-3.5 text-purple-500" />
        引用
        <span class="text-gray-400 font-mono">({{ citationChips.length }})</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="(c, idx) in citationChips"
          :key="`cite-${idx}`"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 ring-1 ring-gray-200/70 dark:ring-gray-700/40"
          :title="c.fullTitle || c.label"
        >
          <UIcon :name="c.icon" class="w-3 h-3 text-gray-400" />
          <span class="truncate max-w-[200px]">{{ c.label }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Document } from "@models/document";

//#region Props
interface GroundingChunk {
  web?: { uri?: string };
  file?: { displayName?: string; uri?: string };
}
interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

interface Props {
  /** Gemini API の groundingMetadata */
  groundingMetadata: GroundingMetadata | null;
  /** 突合対象 - 現在の FileSpace に属する Document リスト */
  documents: Document[];
}
const props = defineProps<Props>();
//#endregion

//#region 突合ロジック
// chunk.file.displayName から Document を探す
// displayName は "page-001.md" / "page-001" / "PDFファイル名" などのケースあり
const _resolveDoc = (chunk: GroundingChunk): Document | null => {
  if (!chunk.file?.displayName) return null;
  const target = chunk.file.displayName.trim().toLowerCase();
  // 1) displayName が完全一致
  for (const d of props.documents) {
    if ((d.displayName || "").toLowerCase() === target) return d;
  }
  // 2) filePath の末尾と一致 (page-001.md など)
  for (const d of props.documents) {
    const fp = (d.filePath || "").toLowerCase();
    if (fp.endsWith("/" + target) || fp.endsWith(target)) return d;
  }
  // 3) title 一致 (webcrawl で title が page タイトル)
  for (const d of props.documents) {
    if ((d.title || "").toLowerCase() === target) return d;
  }
  return null;
};
//#endregion

//#region 関連パッケージ
interface PackageInfo {
  key: string;
  title: string;
  hostname: string;
  citedPageCount: number;
}

const extractHostname = (url: string | null | undefined): string => {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

const relatedPackages = computed<PackageInfo[]>(() => {
  const chunks = props.groundingMetadata?.groundingChunks || [];
  // webCrawlRequestId でグルーピング
  const byKey = new Map<string, { docs: Document[]; sample: Document }>();
  for (const chunk of chunks) {
    const doc = _resolveDoc(chunk);
    if (!doc) continue;
    const key = doc.webCrawlRequestId || doc.gcsPrefix;
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, { docs: [], sample: doc });
    }
    byKey.get(key)!.docs.push(doc);
  }
  return Array.from(byKey.entries()).map(([key, v]) => {
    const sample = v.sample;
    const url = sample.sourceUrl || sample.url || "";
    const hostname = extractHostname(url) || extractHostname(sample.entryUrl);
    // 同じ webCrawlRequestId の Document を documents 全体から探して総数を取る
    // (引用された数ではなく、パッケージ全体のページ数)
    const totalInPackage = props.documents.filter(
      (d) => d.webCrawlRequestId === sample.webCrawlRequestId
    ).length;
    return {
      key,
      title:
        sample.title ||
        sample.displayName ||
        hostname ||
        "(無題)",
      hostname,
      citedPageCount: v.docs.length,
      _totalInPackage: totalInPackage, // future use (展開時のサブカウント)
    } as PackageInfo & { _totalInPackage: number };
  });
});
//#endregion

//#region 引用 chips
interface CitationChip {
  label: string;
  fullTitle: string;
  icon: string;
}

const citationChips = computed<CitationChip[]>(() => {
  const chunks = props.groundingMetadata?.groundingChunks || [];
  return chunks
    .map((chunk) => {
      const doc = _resolveDoc(chunk);
      if (doc) {
        return {
          label: doc.title || doc.displayName || "(無題)",
          fullTitle:
            (doc.title || doc.displayName || "") +
            (doc.sourceUrl ? ` — ${doc.sourceUrl}` : ""),
          icon: doc.subCategory === "urlMarkdown"
            ? "i-heroicons-globe-alt"
            : "i-heroicons-document-text",
        } as CitationChip;
      }
      // Document が見つからない: chunk.file.displayName か web.uri をそのまま見せる
      if (chunk.file?.displayName) {
        return {
          label: chunk.file.displayName,
          fullTitle: chunk.file.displayName,
          icon: "i-heroicons-document-text",
        } as CitationChip;
      }
      if (chunk.web?.uri) {
        return {
          label: extractHostname(chunk.web.uri) || chunk.web.uri,
          fullTitle: chunk.web.uri,
          icon: "i-heroicons-link",
        } as CitationChip;
      }
      return null;
    })
    .filter((c): c is CitationChip => c !== null);
});
//#endregion

const hasAnyCitation = computed(
  () => relatedPackages.value.length > 0 || citationChips.value.length > 0
);
</script>
