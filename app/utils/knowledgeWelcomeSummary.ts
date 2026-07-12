import type { Document } from "@models/document";
import {
  knowledgeDocumentVisualKind,
  type KnowledgeVisualKind,
} from "@utils/consultationKnowledge";
import { resolveKnowledgeSourceFilter } from "@utils/knowledgeDocumentFilters";
import { classifyWebCrawlDocumentCategory } from "@utils/webCrawlDocumentKind";

export type KnowledgeWelcomeBucket =
  | "document"
  | "spreadsheet"
  | "web"
  | "drive"
  | "upload"
  | "image";

export interface KnowledgeWelcomeCategoryRow {
  id: KnowledgeWelcomeBucket;
  label: string;
  icon: string;
  count: number;
}

const WELCOME_CATEGORY_META: Record<
  KnowledgeWelcomeBucket,
  { label: string; icon: string; order: number }
> = {
  spreadsheet: {
    label: "表・カタログ",
    icon: "vscode-icons:file-type-excel2",
    order: 1,
  },
  document: {
    label: "PDF・文書",
    icon: "vscode-icons:file-type-pdf2",
    order: 2,
  },
  web: {
    label: "Web・サイト",
    icon: "material-symbols:language",
    order: 3,
  },
  drive: {
    label: "Google Drive",
    icon: "logos:google-drive",
    order: 4,
  },
  upload: {
    label: "アップロード",
    icon: "material-symbols:upload-file",
    order: 5,
  },
  image: {
    label: "画像",
    icon: "material-symbols:image-outline",
    order: 6,
  },
};

const classifyWelcomeBucket = (doc: Document): KnowledgeWelcomeBucket => {
  const webKind = classifyWebCrawlDocumentCategory(doc);
  if (webKind === "web") return "web";
  if (webKind === "image") return "image";

  const visual: KnowledgeVisualKind = knowledgeDocumentVisualKind(doc);
  if (visual === "spreadsheet") return "spreadsheet";
  if (visual === "pdf" || visual === "document" || visual === "markdown") {
    return "document";
  }

  const source = resolveKnowledgeSourceFilter(doc);
  if (source === "drive") return "drive";
  if (source === "web") return "web";
  return "upload";
};

/** 経営相談ウェルカムカード用 — 資料プールをカテゴリ別件数に集計 */
export const summarizeKnowledgeDocumentsForWelcome = (
  documents: readonly Document[]
): KnowledgeWelcomeCategoryRow[] => {
  const counts = new Map<KnowledgeWelcomeBucket, number>();

  for (const doc of documents) {
    const bucket = classifyWelcomeBucket(doc);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return (Object.keys(WELCOME_CATEGORY_META) as KnowledgeWelcomeBucket[])
    .map((id) => ({
      id,
      label: WELCOME_CATEGORY_META[id].label,
      icon: WELCOME_CATEGORY_META[id].icon,
      count: counts.get(id) ?? 0,
      order: WELCOME_CATEGORY_META[id].order,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...row }) => row);
};
