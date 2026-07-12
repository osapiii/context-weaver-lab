import type { ConsultationSourceReference } from "@utils/consultationSourceReferences";
import {
  normalizeFileSearchDocumentId,
  parseFileSearchDocumentId,
} from "@utils/consultationSourceReferences";

/** Gemini / ADK grounding_metadata (camelCase / snake_case 両対応) */
export type AdkGroundingMetadata = Record<string, unknown>;

export type GroundingChunkDisplay = {
  index: number;
  kind: "retrieved" | "web" | "other";
  title: string;
  uri?: string;
  documentName?: string;
  documentId?: string;
  text?: string;
};

export type GroundingSupportDisplay = {
  segmentText: string;
  chunkIndices: number[];
  confidenceScores?: number[];
  linkedChunks: GroundingChunkDisplay[];
};

export type GroundingDisplayModel = {
  retrievalQueries: string[];
  chunks: GroundingChunkDisplay[];
  supports: GroundingSupportDisplay[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const readArray = (payload: Record<string, unknown>, ...keys: string[]): unknown[] => {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

export function mergeGroundingMetadata(params: {
  base: AdkGroundingMetadata | null | undefined;
  incoming: AdkGroundingMetadata | null | undefined;
}): AdkGroundingMetadata {
  const { base, incoming } = params;
  if (!base && !incoming) return {};
  if (!base) return { ...(incoming ?? {}) };
  if (!incoming) return { ...base };

  const merged: AdkGroundingMetadata = { ...base, ...incoming };
  const baseChunks = readArray(base, "groundingChunks", "grounding_chunks");
  const incomingChunks = readArray(
    incoming,
    "groundingChunks",
    "grounding_chunks"
  );
  const chunkMap = new Map<string, Record<string, unknown>>();
  for (const chunk of [...baseChunks, ...incomingChunks]) {
    const record = asRecord(chunk);
    if (!record) continue;
    chunkMap.set(chunkIdentity(record), record);
  }
  if (chunkMap.size > 0) {
    merged.groundingChunks = [...chunkMap.values()];
  }

  const baseSupports = readArray(base, "groundingSupports", "grounding_supports");
  const incomingSupports = readArray(
    incoming,
    "groundingSupports",
    "grounding_supports"
  );
  const supports: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const support of [...baseSupports, ...incomingSupports]) {
    const record = asRecord(support);
    if (!record) continue;
    const segment = asRecord(record.segment);
    const segmentText = asString(segment?.text) ?? "";
    const indices =
      record.groundingChunkIndices ?? record.grounding_chunk_indices;
    const signature = `${segmentText}|${JSON.stringify(indices)}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    supports.push(record);
  }
  if (supports.length > 0) {
    merged.groundingSupports = supports;
  }

  const mergeQueries = (snake: string, camel: string): string[] => {
    const values = [
      ...readArray(base, camel, snake),
      ...readArray(incoming, camel, snake),
    ];
    const out: string[] = [];
    const seenQueries = new Set<string>();
    for (const value of values) {
      const text = asString(value);
      if (!text || seenQueries.has(text)) continue;
      seenQueries.add(text);
      out.push(text);
    }
    return out;
  };

  const retrievalQueries = mergeQueries(
    "retrieval_queries",
    "retrievalQueries"
  );
  if (retrievalQueries.length > 0) merged.retrievalQueries = retrievalQueries;

  const webSearchQueries = mergeQueries(
    "web_search_queries",
    "webSearchQueries"
  );
  if (webSearchQueries.length > 0) merged.webSearchQueries = webSearchQueries;

  return merged;
}

const chunkIdentity = (chunk: Record<string, unknown>): string => {
  const rc = asRecord(chunk.retrievedContext) ?? asRecord(chunk.retrieved_context);
  if (rc) {
    return (
      asString(rc.documentName) ??
      asString(rc.document_name) ??
      asString(rc.uri) ??
      asString(rc.title) ??
      JSON.stringify(rc)
    );
  }
  const web = asRecord(chunk.web);
  if (web) return asString(web.uri) ?? JSON.stringify(web);
  return JSON.stringify(chunk);
};

export function parseGroundingChunk(params: {
  chunk: unknown;
  index: number;
}): GroundingChunkDisplay | null {
  const { chunk, index } = params;
  const record = asRecord(chunk);
  if (!record) return null;

  const rc = asRecord(record.retrievedContext) ?? asRecord(record.retrieved_context);
  if (rc) {
    const documentName = asString(rc.documentName) ?? asString(rc.document_name);
    const title =
      asString(rc.title) ??
      asString(rc.displayName) ??
      documentName ??
      "参照資料";
    const uri = asString(rc.uri);
    const text = asString(rc.text) ?? asString(record.text);
    const documentId =
      normalizeFileSearchDocumentId(documentName) ??
      normalizeFileSearchDocumentId(uri) ??
      parseFileSearchDocumentId(documentName ?? "") ??
      undefined;
    return {
      index,
      kind: "retrieved",
      title,
      uri,
      documentName,
      documentId,
      text,
    };
  }

  const web = asRecord(record.web);
  if (web) {
    const uri = asString(web.uri);
    return {
      index,
      kind: "web",
      title: asString(web.title) ?? uri ?? "Web",
      uri,
      text: asString(record.text),
    };
  }

  return {
    index,
    kind: "other",
    title: "参照資料",
    text: asString(record.text),
  };
}

export function buildGroundingDisplayModel(
  metadata: AdkGroundingMetadata | null | undefined
): GroundingDisplayModel {
  if (!metadata) {
    return { retrievalQueries: [], chunks: [], supports: [] };
  }

  const retrievalQueries = readArray(
    metadata,
    "retrievalQueries",
    "retrieval_queries"
  )
    .map(asString)
    .filter((value): value is string => !!value);

  const rawChunks = readArray(metadata, "groundingChunks", "grounding_chunks");
  const chunks = rawChunks
    .map((chunk, index) => parseGroundingChunk({ chunk, index }))
    .filter((chunk): chunk is GroundingChunkDisplay => chunk !== null);

  const chunkByIndex = new Map(chunks.map((chunk) => [chunk.index, chunk]));
  const supports = readArray(metadata, "groundingSupports", "grounding_supports")
    .map((support) => {
      const record = asRecord(support);
      if (!record) return null;
      const segment = asRecord(record.segment);
      const indicesRaw =
        record.groundingChunkIndices ?? record.grounding_chunk_indices;
      const chunkIndices = Array.isArray(indicesRaw)
        ? indicesRaw.filter((value): value is number => typeof value === "number")
        : [];
      const confidenceRaw =
        record.confidenceScores ?? record.confidence_scores;
      const confidenceScores = Array.isArray(confidenceRaw)
        ? confidenceRaw.filter((value): value is number => typeof value === "number")
        : undefined;
      return {
        segmentText: asString(segment?.text) ?? "",
        chunkIndices,
        confidenceScores,
        linkedChunks: chunkIndices
          .map((idx) => chunkByIndex.get(idx))
          .filter((chunk): chunk is GroundingChunkDisplay => !!chunk),
      } satisfies GroundingSupportDisplay;
    })
    .filter((support): support is GroundingSupportDisplay => support !== null);

  return { retrievalQueries, chunks, supports };
}

/** ADK SSE grounding event → UI citation 形式 (full text 保持) */
export function groundingToSourceReferences(
  payload: AdkGroundingMetadata
): ConsultationSourceReference[] {
  const model = buildGroundingDisplayModel(payload);
  const out: ConsultationSourceReference[] = [];
  const seen = new Set<string>();

  for (const chunk of model.chunks) {
    const key = chunk.documentId ?? chunk.uri ?? chunk.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      sourceType: chunk.kind === "web" ? "webSearch" : "fileSearch",
      displayName: chunk.title,
      documentId: chunk.documentId ?? chunk.documentName ?? null,
      uri: chunk.uri ?? null,
      reason: chunk.text ?? null,
    });
  }
  return out;
}

export function hasGroundingMetadata(
  metadata: AdkGroundingMetadata | null | undefined
): boolean {
  const model = buildGroundingDisplayModel(metadata);
  return model.chunks.length > 0 || model.supports.length > 0;
}
