import type { Document } from "@models/document";
import type { SelectedKnowledgeRef } from "@utils/consultationKnowledge";
import {
  knowledgeDocumentExtension,
  knowledgeDocumentName,
  knowledgeDocumentVisualKind,
  knowledgeSourceMeta,
  type KnowledgeVisualKind,
} from "@utils/consultationKnowledge";
import { resolveGoogleWorkspaceKind } from "@utils/resolveStorageFileIcon";
import { resolveGoogleWorkspaceOpenUrl } from "@utils/storageFilePreview";
import type { GoogleWorkspaceKind } from "@utils/resolveStorageFileIcon";
import type { ResolvedConsultationSource } from "@utils/consultationSourceReferences";

export type KnowledgePreviewTarget =
  | { kind: "document"; document: Document }
  | { kind: "ref"; ref: SelectedKnowledgeRef; document?: Document | null }
  | { kind: "source"; source: ResolvedConsultationSource };

export type KnowledgePreviewMode =
  | "image"
  | "pdf"
  | "text"
  | "web"
  | "google-workspace"
  | "binary";

export type KnowledgePreviewMeta = {
  title: string;
  subtitle?: string;
  sourceLabel: string;
  sourceTone: string;
  visualKind: KnowledgeVisualKind;
  mimeType: string;
  previewMode: KnowledgePreviewMode;
  webUrl?: string | null;
  reasonText?: string | null;
  /** GCS 取得前に表示する本文 (grounding snippet 等) */
  inlineText?: string | null;
  /** 認証不要の外部 URL (画像プレビュー等) */
  externalUrl?: string | null;
  bucket?: string;
  filePath?: string;
  gcsPath?: string | null;
  googleWorkspaceKind?: GoogleWorkspaceKind | null;
  googleOpenUrl?: string | null;
  driveFileId?: string | null;
};

const TEXT_EXTENSIONS = [
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".csv",
  ".log",
  ".yaml",
  ".yml",
  ".xml",
  ".html",
  ".htm",
];

const IMAGE_URL_PATTERN =
  /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i;

export const parseKnowledgeGsPath = (
  gcsPath: string | null | undefined
): { bucket: string; path: string } | null => {
  if (!gcsPath || !gcsPath.startsWith("gs://")) return null;
  const without = gcsPath.slice("gs://".length);
  const slash = without.indexOf("/");
  if (slash <= 0) return null;
  return { bucket: without.slice(0, slash), path: without.slice(slash + 1) };
};

export const isKnowledgeImageUrl = (
  url: string | null | undefined
): boolean => {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    return IMAGE_URL_PATTERN.test(new URL(url).pathname);
  } catch {
    return IMAGE_URL_PATTERN.test(url);
  }
};

export const looksLikeMarkdownContent = (
  text: string | null | undefined
): boolean => {
  if (!text || text.trim().length < 12) return false;
  return /(^|\n)#{1,6}\s|!\[[^\]]*\]\(|```|^\s*[-*]\s+\S/m.test(text);
};

export const isKnowledgeTextMime = (
  mimeType: string | null | undefined,
  fileName?: string | null
): boolean => {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("markdown")
  ) {
    return true;
  }
  const lower = (fileName || "").toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

export const resolveKnowledgeStorageLocation = (
  doc: Document
): { bucket?: string; filePath?: string; gcsPath?: string | null } => {
  if (doc.bucketName && doc.filePath) {
    return {
      bucket: doc.bucketName,
      filePath: doc.filePath,
      gcsPath: knowledgeDocumentGcsPathFromDoc(doc),
    };
  }
  const fromGcsUrl = parseKnowledgeGsPath(doc.gcsUrl);
  if (fromGcsUrl) {
    return {
      bucket: fromGcsUrl.bucket,
      filePath: fromGcsUrl.path,
      gcsPath: doc.gcsUrl ?? null,
    };
  }
  return { gcsPath: doc.gcsUrl ?? null };
};

export const resolveKnowledgePreviewMode = (params: {
  visualKind: KnowledgeVisualKind;
  mimeType?: string | null;
  fileName?: string | null;
  isWebSource?: boolean;
  hasStoredContent?: boolean;
}): KnowledgePreviewMode => {
  if (params.hasStoredContent) {
    if (params.visualKind === "image") return "image";
    if (
      params.visualKind === "markdown" ||
      params.visualKind === "web" ||
      isKnowledgeTextMime(params.mimeType, params.fileName)
    ) {
      return "text";
    }
    if (params.visualKind === "pdf") return "pdf";
  }
  if (params.isWebSource || params.visualKind === "web") return "web";
  if (params.visualKind === "image") return "image";
  if (params.visualKind === "pdf") return "pdf";
  if (
    params.visualKind === "markdown" ||
    isKnowledgeTextMime(params.mimeType, params.fileName)
  ) {
    return "text";
  }
  return "binary";
};

const hostnameFromUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

const metaFromDocument = (doc: Document): KnowledgePreviewMeta => {
  const source = knowledgeSourceMeta(doc);
  const visualKind = knowledgeDocumentVisualKind(doc);
  const title = knowledgeDocumentName(doc);
  const mimeType = doc.mimeType || "application/octet-stream";
  const ext = knowledgeDocumentExtension(doc);
  const googleKind = resolveGoogleWorkspaceKind(ext, mimeType);
  const webUrl =
    doc.sourceUrl || doc.url || doc.entryUrl || doc.driveWebViewLink || null;
  const storage = resolveKnowledgeStorageLocation(doc);
  const hasStoredContent = Boolean(storage.bucket && storage.filePath);
  const nameHint = `${title} ${doc.filePath ?? ""} ${doc.gcsUrl ?? ""}`;

  if (googleKind) {
    const googleOpenUrl = resolveGoogleWorkspaceOpenUrl({
      kind: googleKind,
      driveFileId: doc.driveFileId,
      webViewLink: doc.driveWebViewLink,
    });
    return {
      title,
      subtitle: hostnameFromUrl(webUrl) || doc.description || undefined,
      sourceLabel: source.label,
      sourceTone: source.tone,
      visualKind,
      mimeType,
      previewMode: "google-workspace",
      webUrl: googleOpenUrl ?? webUrl,
      googleWorkspaceKind: googleKind,
      googleOpenUrl,
      driveFileId: doc.driveFileId ?? null,
      gcsPath: storage.gcsPath ?? knowledgeDocumentGcsPathFromDoc(doc),
      bucket: storage.bucket,
      filePath: storage.filePath,
    };
  }

  let previewMode = resolveKnowledgePreviewMode({
    visualKind,
    mimeType,
    fileName: nameHint,
    isWebSource:
      visualKind === "web" && Boolean(webUrl) && !hasStoredContent,
    hasStoredContent,
  });

  if (
    hasStoredContent &&
    previewMode === "binary" &&
    isKnowledgeTextMime(mimeType, nameHint) &&
    !nameHint.toLowerCase().includes(".gdoc") &&
    !nameHint.toLowerCase().includes(".gsheet") &&
    !nameHint.toLowerCase().includes(".gslides")
  ) {
    previewMode = "text";
  }

  return {
    title,
    subtitle: hostnameFromUrl(webUrl) || doc.description || undefined,
    sourceLabel: source.label,
    sourceTone: source.tone,
    visualKind,
    mimeType,
    previewMode,
    webUrl,
    gcsPath: storage.gcsPath ?? knowledgeDocumentGcsPathFromDoc(doc),
    bucket: storage.bucket,
    filePath: storage.filePath,
    driveFileId: doc.driveFileId ?? null,
  };
};

const metaFromUnresolvedSource = (
  source: ResolvedConsultationSource
): KnowledgePreviewMeta => {
  const uri = source.href ?? null;
  const reason = source.reason ?? null;

  if (reason && looksLikeMarkdownContent(reason)) {
    return {
      title: source.title,
      subtitle: hostnameFromUrl(uri) || source.subtitle,
      sourceLabel: source.sourceType === "webSearch" ? "Web" : "FileSpace",
      sourceTone: source.sourceType === "webSearch" ? "violet" : "slate",
      visualKind: "markdown",
      mimeType: "text/markdown",
      previewMode: "text",
      inlineText: reason,
      webUrl: uri,
      reasonText: reason,
    };
  }

  if (uri && isKnowledgeImageUrl(uri)) {
    return {
      title: source.title,
      subtitle: hostnameFromUrl(uri) || source.subtitle,
      sourceLabel: "FileSpace",
      sourceTone: "slate",
      visualKind: "image",
      mimeType: "image/*",
      previewMode: "image",
      externalUrl: uri,
      webUrl: uri,
      reasonText: reason,
    };
  }

  if (source.sourceType === "webSearch" || (uri && /^https?:\/\//i.test(uri))) {
    const host = hostnameFromUrl(uri);
    return {
      title: source.title,
      subtitle: host || source.subtitle,
      sourceLabel: "Web",
      sourceTone: "violet",
      visualKind: "web",
      mimeType: "text/html",
      previewMode: reason ? "text" : "web",
      webUrl: uri,
      reasonText: reason,
      inlineText: reason,
    };
  }

  return {
    title: source.title,
    subtitle: source.subtitle,
    sourceLabel: "FileSpace",
    sourceTone: "slate",
    visualKind: "other",
    mimeType: "application/octet-stream",
    previewMode: reason ? "text" : "binary",
    inlineText: reason,
    reasonText: reason,
    webUrl: uri,
  };
};

export const buildKnowledgePreviewMeta = (
  target: KnowledgePreviewTarget
): KnowledgePreviewMeta => {
  if (target.kind === "source") {
    const { source } = target;
    const doc = source.document;
    if (doc) {
      const docMeta = metaFromDocument(doc);
      const reason = source.reason?.trim();
      if (reason && looksLikeMarkdownContent(reason)) {
        return {
          ...docMeta,
          inlineText: reason,
          reasonText: reason,
          previewMode:
            docMeta.previewMode === "binary" ? "text" : docMeta.previewMode,
        };
      }
      return docMeta;
    }
    if (source.sourceType === "webSearch") {
      return metaFromUnresolvedSource(source);
    }
    return metaFromUnresolvedSource(source);
  }

  if (target.kind === "ref") {
    const doc = target.document;
    if (doc) {
      return metaFromDocument(doc);
    }
    const refName = target.ref.name;
    const refMime = target.ref.mimeType;
    const refExt = refName.includes(".")
      ? refName.slice(refName.lastIndexOf(".") + 1).toLowerCase()
      : "";
    const googleKind = resolveGoogleWorkspaceKind(refExt, refMime);
    if (googleKind) {
      const gcsPath = target.ref.gcsPath;
      const parsed = parseKnowledgeGsPath(gcsPath);
      return {
        title: refName,
        sourceLabel: "FileSpace",
        sourceTone: "slate",
        visualKind: knowledgeDocumentVisualKindFromMime(refMime, refName),
        mimeType: refMime,
        previewMode: "google-workspace",
        googleWorkspaceKind: googleKind,
        googleOpenUrl: null,
        gcsPath,
        bucket: parsed?.bucket,
        filePath: parsed?.path,
      };
    }
    const visualKind = knowledgeDocumentVisualKindFromMime(refMime, refName);
    const gcsPath = target.ref.gcsPath;
    const parsed = parseKnowledgeGsPath(gcsPath);
    const hasStoredContent = Boolean(parsed?.bucket && parsed?.path);
    return {
      title: refName,
      sourceLabel: "FileSpace",
      sourceTone: "slate",
      visualKind,
      mimeType: refMime,
      previewMode: resolveKnowledgePreviewMode({
        visualKind,
        mimeType: refMime,
        fileName: refName,
        hasStoredContent,
      }),
      gcsPath,
      bucket: parsed?.bucket,
      filePath: parsed?.path,
    };
  }

  return metaFromDocument(target.document);
};

const knowledgeDocumentGcsPathFromDoc = (doc: Document): string | null => {
  if (!doc.bucketName || !doc.filePath) return null;
  return `gs://${doc.bucketName}/${doc.filePath}`;
};

const knowledgeDocumentVisualKindFromMime = (
  mimeType: string,
  fileName: string
): KnowledgeVisualKind => {
  const mime = mimeType.toLowerCase();
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase()
    : "";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("pdf") || ext === "pdf") return "pdf";
  if (mime.includes("markdown") || ext === "md") return "markdown";
  return "other";
};

export const serializeKnowledgePreviewJson = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return String(value);
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeKnowledgePreviewJson(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>
    )) {
      out[key] = serializeKnowledgePreviewJson(entry);
    }
    return out;
  }
  return value;
};

/** 設定値タブ用: Firestore / 参照の生データ */
export const buildKnowledgePreviewRawPayload = (
  target: KnowledgePreviewTarget,
  meta: KnowledgePreviewMeta | null
): Record<string, unknown> => {
  const base: Record<string, unknown> = {
    previewMeta: meta ? serializeKnowledgePreviewJson(meta) : null,
  };

  if (target.kind === "document") {
    return {
      ...base,
      kind: "document",
      firestore: serializeKnowledgePreviewJson(target.document),
    };
  }

  if (target.kind === "ref") {
    return {
      ...base,
      kind: "selectedKnowledgeRef",
      ref: serializeKnowledgePreviewJson(target.ref),
      firestore: target.document
        ? serializeKnowledgePreviewJson(target.document)
        : null,
    };
  }

  return {
    ...base,
    kind: "consultationSource",
    source: serializeKnowledgePreviewJson(target.source),
    firestore: target.source.document
      ? serializeKnowledgePreviewJson(target.source.document)
      : null,
  };
};

/** 設定値タブ表示用 (循環参照・非 JSON 値を安全に文字列化) */
export const stringifyKnowledgePreviewRaw = (
  payload: Record<string, unknown>
): string => {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      payload,
      (_key, value: unknown) => {
        if (value === undefined) return null;
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular]";
          seen.add(value);
          if (
            "toDate" in value &&
            typeof (value as { toDate: () => Date }).toDate === "function"
          ) {
            try {
              return (value as { toDate: () => Date }).toDate().toISOString();
            } catch {
              return String(value);
            }
          }
        }
        if (typeof value === "function") return "[Function]";
        if (typeof value === "bigint") return value.toString();
        return value;
      },
      2
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ error: `JSON 化に失敗: ${msg}` }, null, 2);
  }
};

export const openKnowledgePreviewTarget = (
  input:
    | Document
    | SelectedKnowledgeRef
    | ResolvedConsultationSource
    | KnowledgePreviewTarget,
  options?: { document?: Document | null }
): KnowledgePreviewTarget => {
  if (typeof input === "object" && input !== null && "kind" in input) {
    return input as KnowledgePreviewTarget;
  }
  if (typeof input === "object" && "sourceType" in input) {
    return { kind: "source", source: input as ResolvedConsultationSource };
  }
  if (typeof input === "object" && "gcsPath" in input && "mimeType" in input) {
    return {
      kind: "ref",
      ref: input as SelectedKnowledgeRef,
      document: options?.document ?? null,
    };
  }
  return { kind: "document", document: input as Document };
};
