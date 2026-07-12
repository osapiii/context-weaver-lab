import type { Document } from "@models/document";

/** ADK grounding / citation が載せる参照情報 */
export type ConsultationSourceReference = {
  sourceType: "fileSearch" | "webSearch";
  documentId?: string | null;
  displayName?: string | null;
  uri?: string | null;
  reason?: string | null;
};

export type ResolvedConsultationSource = {
  key: string;
  sourceType: "fileSearch" | "webSearch";
  documentId?: string;
  title: string;
  subtitle?: string;
  reason?: string;
  icon: string;
  thumbnailUrl?: string | null;
  href?: string | null;
  document?: Document;
};

export function parseFileSearchDocumentId(
  uriOrName: string | null | undefined
): string | null {
  if (!uriOrName) return null;
  const marker = "/documents/";
  const idx = uriOrName.indexOf(marker);
  if (idx < 0) return null;
  const tail = uriOrName.slice(idx + marker.length);
  const id = tail.split("/")[0]?.split("?")[0];
  return id || null;
}

export function normalizeFileSearchDocumentId(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  return parseFileSearchDocumentId(raw) || raw.trim() || null;
}

function chunkToReference(chunk: Record<string, unknown>): ConsultationSourceReference | null {
  const file = chunk.file as Record<string, unknown> | undefined;
  const web = chunk.web as Record<string, unknown> | undefined;
  const retrieved = (chunk.retrieved_context ||
    chunk.retrievedContext) as Record<string, unknown> | undefined;

  if (file?.displayName || file?.uri) {
    const uri = typeof file.uri === "string" ? file.uri : null;
    const displayName =
      typeof file.displayName === "string" ? file.displayName : null;
    return {
      sourceType: "fileSearch",
      documentId:
        normalizeFileSearchDocumentId(
          typeof file.documentId === "string" ? file.documentId : null
        ) ||
        normalizeFileSearchDocumentId(uri) ||
        normalizeFileSearchDocumentId(displayName),
      displayName,
      uri,
      reason: typeof file.reason === "string" ? file.reason : null,
    };
  }

  if (retrieved) {
    const documentName =
      typeof retrieved.document_name === "string"
        ? retrieved.document_name
        : typeof retrieved.documentName === "string"
          ? retrieved.documentName
          : null;
    let title =
      typeof retrieved.title === "string" ? retrieved.title : documentName;
    let uri = typeof retrieved.uri === "string" ? retrieved.uri : null;
    const text =
      typeof retrieved.text === "string" ? retrieved.text : null;
    if ((!title || !uri) && text) {
      const urlMatch = text.match(/https?:\/\/[^\s)\]"'<>]+/);
      if (!uri && urlMatch?.[0]) {
        uri = urlMatch[0].replace(/[.,)]+$/, "");
      }
      if (!title) {
        const headingMatch = text.match(/^##\s+(.+)$/m);
        if (headingMatch?.[1]) {
          title = headingMatch[1].trim();
        } else if (uri) {
          try {
            title = new URL(uri).hostname;
          } catch {
            title = "参照資料";
          }
        }
      }
    }
    return {
      sourceType: uri && /^https?:\/\//i.test(uri) ? "webSearch" : "fileSearch",
      documentId:
        normalizeFileSearchDocumentId(documentName) ||
        normalizeFileSearchDocumentId(uri),
      displayName: title || "参照資料",
      uri,
      reason: text,
    };
  }

  if (web?.uri && typeof web.uri === "string") {
    return {
      sourceType: "webSearch",
      uri: web.uri,
      displayName:
        typeof web.title === "string" ? web.title : web.uri,
    };
  }

  return null;
}

export function extractSourceReferences(payload: {
  sourceReferences?: unknown;
  groundingMetadata?: unknown;
}): ConsultationSourceReference[] {
  const merged: ConsultationSourceReference[] = [];
  const seen = new Set<string>();

  const push = (ref: ConsultationSourceReference | null) => {
    if (!ref || !isSourceReference(ref)) return;
    const key =
      ref.documentId ||
      ref.uri ||
      ref.displayName ||
      ref.reason?.slice(0, 80) ||
      "";
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push({
      ...ref,
      documentId: normalizeFileSearchDocumentId(ref.documentId),
    });
  };

  const direct = payload.sourceReferences;
  if (Array.isArray(direct)) {
    for (const item of direct) push(item as ConsultationSourceReference);
  }

  const gm = payload.groundingMetadata as
    | {
        sourceReferences?: unknown;
        groundingChunks?: unknown[];
      }
    | null
    | undefined;

  if (Array.isArray(gm?.sourceReferences)) {
    for (const item of gm.sourceReferences) {
      push(item as ConsultationSourceReference);
    }
  }

  const chunks =
    (Array.isArray(gm?.groundingChunks) && gm.groundingChunks) ||
    (Array.isArray(gm?.grounding_chunks) && gm.grounding_chunks) ||
    [];
  if (chunks.length > 0) {
    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== "object") continue;
      push(chunkToReference(chunk as Record<string, unknown>));
    }
  }

  return merged;
}

function isSourceReference(v: unknown): v is ConsultationSourceReference {
  if (!v || typeof v !== "object") return false;
  const t = (v as ConsultationSourceReference).sourceType;
  return t === "fileSearch" || t === "webSearch";
}

const hostnameFromUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

const resolveDocument = (
  ref: ConsultationSourceReference,
  documents: Document[]
): Document | null => {
  if (ref.documentId) {
    const normalizedId = normalizeFileSearchDocumentId(ref.documentId);
    const byId = documents.find(
      (d) => d.id === normalizedId || d.id === ref.documentId
    );
    if (byId) return byId;
  }
  const target = (ref.displayName || "").trim().toLowerCase();
  if (!target) return null;
  for (const d of documents) {
    if ((d.displayName || "").toLowerCase() === target) return d;
    const fp = (d.filePath || d.name || "").toLowerCase();
    if (fp.endsWith(`/${target}`) || fp.endsWith(target)) return d;
    if ((d.title || "").toLowerCase() === target) return d;
  }
  return null;
};

const iconForDocument = (doc: Document | null): string => {
  if (!doc) return "i-heroicons-document-text";
  if (doc.subCategory === "urlMarkdown") return "i-heroicons-globe-alt";
  if (doc.driveFileId) return "i-heroicons-cloud";
  const mime = (doc.mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "vscode-icons:file-type-pdf2";
  return "i-heroicons-document-text";
};

/** FileSpace Document 一覧と突合し、UI 表示用に整形 */
export function resolveConsultationSources(params: {
  references: ConsultationSourceReference[];
  documents: Document[];
}): ResolvedConsultationSource[] {
  const seen = new Set<string>();
  const resolved: ResolvedConsultationSource[] = [];

  for (const ref of params.references) {
    const doc =
      ref.sourceType === "fileSearch"
        ? resolveDocument(ref, params.documents)
        : null;
    const key =
      ref.documentId ||
      ref.uri ||
      ref.displayName ||
      doc?.id ||
      "";
    if (!key || seen.has(key)) continue;
    seen.add(key);

    if (ref.sourceType === "webSearch") {
      const uri = ref.uri || "";
      resolved.push({
        key,
        sourceType: "webSearch",
        title: ref.displayName || hostnameFromUrl(uri) || "Web 検索",
        subtitle: hostnameFromUrl(uri) || uri,
        reason: ref.reason || undefined,
        icon: "i-heroicons-link",
        href: uri || null,
      });
      continue;
    }

    const title =
      doc?.title ||
      doc?.displayName ||
      ref.displayName ||
      ref.documentId ||
      "参照資料";
    const url = doc?.sourceUrl || doc?.url || doc?.entryUrl || null;
    resolved.push({
      key,
      sourceType: "fileSearch",
      documentId: ref.documentId || doc?.id,
      title,
      subtitle:
        hostnameFromUrl(url) ||
        (ref.documentId ? `ID: ${ref.documentId}` : undefined),
      reason: ref.reason || undefined,
      icon: iconForDocument(doc),
      thumbnailUrl: doc?.thumbnailLink || doc?.ogImage || null,
      href: url || doc?.driveWebViewLink || null,
      document: doc || undefined,
    });
  }

  return resolved;
}
