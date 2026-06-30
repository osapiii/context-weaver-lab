import type { Document } from "@models/document";
import { useFileIcons } from "@composables/useFileIcons";
import { isKnowledgeIndexed } from "@utils/knowledge";
import { isWebCrawlSessionDocument } from "@utils/webCrawlDocumentKind";
import {
  resolveGoogleWorkspaceKind,
  resolveStorageFileIcon,
} from "@utils/resolveStorageFileIcon";
import {
  googleWorkspaceTypeLabel,
  resolveStorageFileTypeLabel,
} from "@utils/storageFilePreview";

export interface SelectedKnowledgeRef {
  id: string;
  name: string;
  gcsPath: string;
  mimeType: string;
}

export const MAX_SELECTED_KNOWLEDGE = 5;
export const MAX_PINNED_KNOWLEDGE = 10;

export type KnowledgeVisualKind =
  | "image"
  | "pdf"
  | "spreadsheet"
  | "document"
  | "markdown"
  | "web"
  | "archive"
  | "other";

const KNOWLEDGE_TYPE_ICONS: Record<KnowledgeVisualKind, string> = {
  image: "vscode-icons:file-type-image",
  pdf: "vscode-icons:file-type-pdf2",
  spreadsheet: "vscode-icons:file-type-excel2",
  document: "vscode-icons:file-type-word2",
  markdown: "vscode-icons:file-type-markdown",
  web: "material-symbols:language",
  archive: "vscode-icons:file-type-zip",
  other: "vscode-icons:default-file",
};

const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeVisualKind, string> = {
  image: "画像",
  pdf: "PDF",
  spreadsheet: "表計算",
  document: "文書",
  markdown: "Markdown",
  web: "Web",
  archive: "アーカイブ",
  other: "ファイル",
};

export const knowledgeDocumentExtension = (doc: Document): string => {
  const name = knowledgeDocumentName(doc).toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot >= 0) return name.slice(dot + 1);
  return "";
};

export const knowledgeDocumentVisualKind = (doc: Document): KnowledgeVisualKind => {
  const mime = (doc.mimeType || "").toLowerCase();
  const ext = knowledgeDocumentExtension(doc);
  const googleKind = resolveGoogleWorkspaceKind(ext, mime);

  if (mime.startsWith("image/")) return "image";
  if (mime.includes("pdf") || ext === "pdf") return "pdf";

  if (googleKind === "sheets" || ext === "gsheet") return "spreadsheet";
  if (
    googleKind === "docs" ||
    googleKind === "slides" ||
    googleKind === "drawing" ||
    googleKind === "form" ||
    ext === "gdoc" ||
    ext === "gslides"
  ) {
    return "document";
  }

  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "csv"
  ) {
    return "spreadsheet";
  }
  if (
    mime.includes("word") ||
    (mime.includes("document") && !mime.includes("google-apps")) ||
    ext === "doc" ||
    ext === "docx"
  ) {
    return "document";
  }
  if (
    mime.includes("markdown") ||
    ext === "md" ||
    ext === "markdown"
  ) {
    return "markdown";
  }
  if (
    doc.webCrawlRequestId ||
    doc.subCategory === "urlMarkdown" ||
    doc.sourceUrl ||
    doc.entryUrl
  ) {
    return "web";
  }
  if (ext === "zip" || ext === "tar" || ext === "gz") return "archive";
  return "other";
};

export const knowledgeDocumentTypeIcon = (doc: Document): string => {
  const ext = knowledgeDocumentExtension(doc);
  const mime = doc.mimeType || "";
  if (resolveGoogleWorkspaceKind(ext, mime)) {
    return resolveStorageFileIcon(useFileIcons(), ext, mime);
  }
  return KNOWLEDGE_TYPE_ICONS[knowledgeDocumentVisualKind(doc)];
};

export const knowledgeDocumentTypeLabel = (doc: Document): string => {
  const ext = knowledgeDocumentExtension(doc);
  const mime = doc.mimeType || "";
  const googleKind = resolveGoogleWorkspaceKind(ext, mime);
  if (googleKind) return googleWorkspaceTypeLabel(googleKind);
  return resolveStorageFileTypeLabel(ext, mime) !== "ファイル"
    ? resolveStorageFileTypeLabel(ext, mime)
    : KNOWLEDGE_TYPE_LABELS[knowledgeDocumentVisualKind(doc)];
};

export type KnowledgeThumbnailMode = "none" | "image" | "pdf" | "external";

export const resolveKnowledgeThumbnailPlan = (
  doc: Document
): {
  mode: KnowledgeThumbnailMode;
  bucket?: string;
  filePath?: string;
  externalUrl?: string;
} => {
  const visualKind = knowledgeDocumentVisualKind(doc);

  if (doc.thumbnailLink?.trim()) {
    return { mode: "external", externalUrl: doc.thumbnailLink.trim() };
  }

  if (doc.driveFileId && (visualKind === "pdf" || visualKind === "image")) {
    return {
      mode: "external",
      externalUrl: `https://drive.google.com/thumbnail?id=${doc.driveFileId}&sz=w400`,
    };
  }

  const og = doc.ogImage?.trim();
  if (og && /^https?:\/\//i.test(og)) {
    return { mode: "external", externalUrl: og };
  }

  if (doc.thumbnailBucket && doc.thumbnailGcsPath) {
    return {
      mode: "image",
      bucket: doc.thumbnailBucket,
      filePath: doc.thumbnailGcsPath,
    };
  }

  if (doc.bucketName && doc.filePath) {
    if (visualKind === "image") {
      return {
        mode: "image",
        bucket: doc.bucketName,
        filePath: doc.filePath,
      };
    }
    if (visualKind === "pdf") {
      return {
        mode: "pdf",
        bucket: doc.bucketName,
        filePath: doc.filePath,
      };
    }
  }

  return { mode: "none" };
};

export type KnowledgeFilterKey = "all" | "pdf" | "sheet" | "other";

export const isIndexedKnowledgeSelectable = (doc: Document): boolean =>
  isKnowledgeIndexed(doc) && Boolean(knowledgeDocumentGcsPath(doc));

export const selectableIndexedDocuments = (documents: Document[]): Document[] =>
  documents.filter(isIndexedKnowledgeSelectable);

export const knowledgeDocumentKey = (doc: Document): string =>
  doc.id || doc.name || doc.filePath || "";

export const knowledgeDocumentName = (doc: Document): string => {
  if (doc.originalFileInfo?.fileName) return doc.originalFileInfo.fileName;
  if (doc.displayName) return doc.displayName;
  if (doc.title) return doc.title;
  if (doc.name) {
    const parts = doc.name.split("/");
    return parts[parts.length - 1] || doc.name;
  }
  return "無題";
};

export const knowledgeDocumentGcsPath = (doc: Document): string | null => {
  if (!doc.bucketName || !doc.filePath) return null;
  return `gs://${doc.bucketName}/${doc.filePath}`;
};

export const isKnowledgeSelectable = (doc: Document): boolean =>
  isIndexedKnowledgeSelectable(doc);

export type KnowledgeSourceTone = "violet" | "sky" | "cyan" | "slate";

export const knowledgeSourceMeta = (
  doc: Document
): { label: string; icon: string; tone: KnowledgeSourceTone } => {
  if (
    doc.uploadedVia === "remote_mcp" ||
    doc.sourceKind === "en-aistudioData"
  ) {
    return {
      label: "AIエディター",
      icon: "material-symbols:code-blocks-outline",
      tone: "violet",
    };
  }
  if (doc.driveFileId) {
    return {
      label: "Drive",
      icon: "logos:google-drive",
      tone: "sky",
    };
  }
  if (
    isWebCrawlSessionDocument(doc) ||
    doc.subCategory === "urlMarkdown" ||
    doc.subCategory === "entryUrl"
  ) {
    return {
      label: "Web",
      icon: "material-symbols:language",
      tone: "cyan",
    };
  }
  if (doc.subCategory === "fileUpload") {
    return {
      label: "アップロード",
      icon: "material-symbols:upload-file",
      tone: "slate",
    };
  }
  return {
    label: "アップロード",
    icon: "material-symbols:upload-file",
    tone: "slate",
  };
};

export const knowledgeMimeCategory = (
  mimeType: string | null | undefined
): KnowledgeFilterKey => {
  const mime = (mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    mime.includes("spreadsheet")
  ) {
    return "sheet";
  }
  if (
    mime.startsWith("text/") ||
    mime.includes("markdown") ||
    mime.includes("json") ||
    mime.includes("word")
  ) {
    return "other";
  }
  return "other";
};

export const knowledgeDocumentSizeBytes = (doc: Document): number => {
  if (
    doc.originalFileInfo?.bytes !== undefined &&
    doc.originalFileInfo?.bytes !== null
  ) {
    const bytes = Number(doc.originalFileInfo.bytes);
    if (!Number.isNaN(bytes) && bytes > 0) return bytes;
  }
  if (doc.sizeBytes) {
    const parsed = parseInt(String(doc.sizeBytes), 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

export const formatKnowledgeBytes = (bytes: number): string => {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const documentToSelectedKnowledge = (
  doc: Document
): SelectedKnowledgeRef | null => {
  if (!isIndexedKnowledgeSelectable(doc)) return null;
  const gcsPath = knowledgeDocumentGcsPath(doc);
  if (!gcsPath) return null;
  const id = knowledgeDocumentKey(doc);
  if (!id) return null;
  return {
    id,
    name: knowledgeDocumentName(doc),
    gcsPath,
    mimeType: doc.mimeType || "application/octet-stream",
  };
};

export const filterKnowledgeDocuments = (
  documents: Document[],
  query: string,
  filter: KnowledgeFilterKey
): Document[] => {
  const q = query.trim().toLowerCase();
  return documents.filter((doc) => {
    if (!isIndexedKnowledgeSelectable(doc)) return false;
    if (filter === "pdf" && knowledgeMimeCategory(doc.mimeType) !== "pdf") {
      return false;
    }
    if (filter === "sheet" && knowledgeMimeCategory(doc.mimeType) !== "sheet") {
      return false;
    }
    if (filter === "other") {
      const cat = knowledgeMimeCategory(doc.mimeType);
      if (cat === "pdf" || cat === "sheet") return false;
    }
    if (!q) return true;
    const haystack = [
      knowledgeDocumentName(doc),
      doc.description ?? "",
      doc.sourceUrl ?? "",
      doc.driveWebViewLink ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
};

export const toApiSelectedKnowledge = (
  items: SelectedKnowledgeRef[]
): Array<{
  id: string;
  name: string;
  gcs_path: string;
  mime_type: string;
}> =>
  items.map((item) => ({
    id: item.id,
    name: item.name,
    gcs_path: item.gcsPath,
    mime_type: item.mimeType,
  }));
