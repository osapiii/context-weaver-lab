import type { Document } from "@models/document";
import { isKnowledgeIndexed } from "@utils/knowledge";
import { knowledgeSourceMeta } from "@utils/consultationKnowledge";
import { isWebCrawlMarkdownDocument } from "@utils/webCrawlDocumentKind";

export type KnowledgeCategoryFilter =
  | "all"
  | "document"
  | "image"
  | "video"
  | "web";

export type KnowledgeAiStatusFilter = "all" | "indexed" | "unregistered";

export type KnowledgeSourceFilter =
  | "all"
  | "upload"
  | "drive"
  | "web";

export type KnowledgeDocumentFilterState = {
  category: KnowledgeCategoryFilter;
  aiStatus: KnowledgeAiStatusFilter;
  source: KnowledgeSourceFilter;
  searchQuery?: string;
};

export function resolveKnowledgeSourceFilter(
  doc: Document
): Exclude<KnowledgeSourceFilter, "all"> {
  const meta = knowledgeSourceMeta(doc);
  if (meta.label === "Drive") return "drive";
  if (meta.label === "Web") return "web";
  return "upload";
}

export function matchesAiStatusFilter(
  doc: Document,
  aiStatus: KnowledgeAiStatusFilter
): boolean {
  if (aiStatus === "all") return true;
  const indexed = isKnowledgeIndexed(doc);
  return aiStatus === "indexed" ? indexed : !indexed;
}

export function matchesSourceFilter(
  doc: Document,
  source: KnowledgeSourceFilter
): boolean {
  if (source === "all") return true;
  return resolveKnowledgeSourceFilter(doc) === source;
}

export function matchesSearchQuery(doc: Document, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (doc.displayName || doc.name || "").toLowerCase();
  const desc = (doc.description || "").toLowerCase();
  return name.includes(q) || desc.includes(q);
}

/** 種別フィルタ (classifyDocument と同じルールを外部から注入) */
export function matchesCategoryFilter(
  doc: Document,
  category: KnowledgeCategoryFilter,
  classifyDocument: (doc: Document) => string
): boolean {
  if (category === "all") return true;
  if (category === "web") return isWebCrawlMarkdownDocument(doc);
  return classifyDocument(doc) === category;
}

export function filterKnowledgeDocuments(
  docs: readonly Document[],
  state: KnowledgeDocumentFilterState,
  classifyDocument: (doc: Document) => string
): Document[] {
  return docs.filter((d) => {
    if (!matchesCategoryFilter(d, state.category, classifyDocument)) return false;
    if (!matchesAiStatusFilter(d, state.aiStatus)) return false;
    if (!matchesSourceFilter(d, state.source)) return false;
    if (!matchesSearchQuery(d, state.searchQuery ?? "")) return false;
    return true;
  });
}

type CrossFilterState = Pick<
  KnowledgeDocumentFilterState,
  "aiStatus" | "source"
>;

export function countForCategoryFilter(
  docs: readonly Document[],
  category: KnowledgeCategoryFilter,
  cross: CrossFilterState,
  classifyDocument: (doc: Document) => string
): number {
  return docs.filter(
    (d) =>
      matchesCategoryFilter(d, category, classifyDocument) &&
      matchesAiStatusFilter(d, cross.aiStatus) &&
      matchesSourceFilter(d, cross.source)
  ).length;
}

export function countForAiStatusFilter(
  docs: readonly Document[],
  aiStatus: KnowledgeAiStatusFilter,
  cross: Pick<KnowledgeDocumentFilterState, "category" | "source">,
  classifyDocument: (doc: Document) => string
): number {
  return docs.filter(
    (d) =>
      matchesCategoryFilter(d, cross.category, classifyDocument) &&
      matchesAiStatusFilter(d, aiStatus) &&
      matchesSourceFilter(d, cross.source)
  ).length;
}

export function countForSourceFilter(
  docs: readonly Document[],
  source: KnowledgeSourceFilter,
  cross: Pick<KnowledgeDocumentFilterState, "category" | "aiStatus">,
  classifyDocument: (doc: Document) => string
): number {
  return docs.filter(
    (d) =>
      matchesCategoryFilter(d, cross.category, classifyDocument) &&
      matchesAiStatusFilter(d, cross.aiStatus) &&
      matchesSourceFilter(d, source)
  ).length;
}
