/**
 * Agent Search (Discovery Engine) ↔ Firestore Document 突合ユーティリティ。
 */

import type { Knowledge } from "@models/document";

export type AgentSearchApiDocument = {
  id?: string | null;
  name?: string | null;
  structData?: Record<string, unknown> | null;
};

export type AgentSearchReconcilePatch = {
  docId: string;
  agentSearchDocumentId: string;
  status: "connected" | "disconnected";
  registrationStage?: "indexed" | "failed";
};

/** Agent Search にのみ存在し Firestore に無い行を materialize するための payload */
export type AgentSearchOrphanCreate = {
  docId: string;
  docData: Record<string, unknown>;
};

export type AgentSearchOrphanContext = {
  storeId: string;
  organizationId: string;
  spaceId: string;
};

const structString = (
  struct: Record<string, unknown> | null | undefined,
  key: string
): string | null => {
  const raw = struct?.[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
};

/** API 行から Firestore documents/{id} を解決 */
export const resolveFirestoreDocIdFromApiDoc = (
  apiDoc: AgentSearchApiDocument
): string | null => {
  const fromStruct = structString(apiDoc.structData ?? undefined, "firestoreDocId");
  if (fromStruct) return fromStruct;
  const id = apiDoc.id?.trim();
  return id || null;
};

/** Firestore 行と API 行のマッチング */
export const matchApiDocumentForFirestore = (
  firestoreDoc: Knowledge,
  apiDocs: AgentSearchApiDocument[]
): AgentSearchApiDocument | null => {
  const fsId = firestoreDoc.id?.trim();
  if (!fsId) return null;

  const byStruct = apiDocs.find(
    (api) => resolveFirestoreDocIdFromApiDoc(api) === fsId
  );
  if (byStruct) return byStruct;

  const agentId = firestoreDoc.agentSearchDocumentId?.trim();
  if (agentId) {
    const byAgent = apiDocs.find((api) => api.id?.trim() === agentId);
    if (byAgent) return byAgent;
  }

  const gcsUri =
    firestoreDoc.bucketName && firestoreDoc.filePath
      ? `gs://${firestoreDoc.bucketName}/${firestoreDoc.filePath}`
      : null;
  if (gcsUri) {
    const byUri = apiDocs.find(
      (api) => structString(api.structData ?? undefined, "gcsUri") === gcsUri
    );
    if (byUri) return byUri;
  }

  const filePath = firestoreDoc.filePath?.trim();
  if (filePath) {
    const byPath = apiDocs.find(
      (api) => structString(api.structData ?? undefined, "filePath") === filePath
    );
    if (byPath) return byPath;
  }

  return null;
};

/** Firestore 更新用パッチ一覧を生成 */
export const buildAgentSearchReconcilePatches = (
  firestoreDocs: Knowledge[],
  apiDocs: AgentSearchApiDocument[]
): AgentSearchReconcilePatch[] => {
  const patches: AgentSearchReconcilePatch[] = [];

  for (const fsDoc of firestoreDocs) {
    const docId = fsDoc.id?.trim();
    if (!docId) continue;

    const apiDoc = matchApiDocumentForFirestore(fsDoc, apiDocs);
    if (apiDoc) {
      const agentSearchDocumentId =
        apiDoc.id?.trim() || resolveFirestoreDocIdFromApiDoc(apiDoc) || "";
      if (!agentSearchDocumentId) continue;
      patches.push({
        docId,
        agentSearchDocumentId,
        status: "connected",
        registrationStage: "indexed",
      });
    } else {
      patches.push({
        docId,
        agentSearchDocumentId: fsDoc.agentSearchDocumentId?.trim() || "",
        status: "disconnected",
        registrationStage: "failed",
      });
    }
  }

  return patches;
};

export const parseGcsUri = (
  gcsUri: string | null | undefined
): { bucketName: string; filePath: string } | null => {
  if (!gcsUri?.startsWith("gs://")) return null;
  const withoutScheme = gcsUri.slice("gs://".length);
  const slash = withoutScheme.indexOf("/");
  if (slash <= 0) return null;
  return {
    bucketName: withoutScheme.slice(0, slash),
    filePath: withoutScheme.slice(slash + 1),
  };
};

const inferMimeFromPath = (filePath: string): string => {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "application/octet-stream";
};

const inferGcsPrefix = (filePath: string): string | null => {
  const m = filePath.match(/^(.*\/web-crawl\/[^/]+)/);
  return m?.[1] ?? null;
};

/** Web クロール由来で Firestore に未作成の Agent Search 行か */
export const isWebCrawlAgentSearchOrphanCandidate = (
  apiDoc: AgentSearchApiDocument
): boolean => {
  const struct = apiDoc.structData ?? undefined;
  const docId = resolveFirestoreDocIdFromApiDoc(apiDoc);
  if (structString(struct, "webCrawlRequestId")) return true;
  if (docId?.startsWith("webcrawl_")) return true;
  const filePath = structString(struct, "filePath");
  return Boolean(filePath?.includes("/web-crawl/"));
};

/**
 * DE 一覧にあって Firestore に無い Web クロール素材を documents/{id} として作成する payload。
 * (step3 で DE import のみ成功し Firestore write が漏れたケースの修復)
 */
export const buildAgentSearchOrphanCreates = (
  apiDocs: AgentSearchApiDocument[],
  existingDocIds: Set<string>,
  ctx: AgentSearchOrphanContext
): AgentSearchOrphanCreate[] => {
  const nowIso = new Date().toISOString();
  const creates: AgentSearchOrphanCreate[] = [];

  for (const apiDoc of apiDocs) {
    if (!isWebCrawlAgentSearchOrphanCandidate(apiDoc)) continue;

    const docId = resolveFirestoreDocIdFromApiDoc(apiDoc);
    if (!docId || existingDocIds.has(docId)) continue;

    const struct = apiDoc.structData ?? undefined;
    const agentSearchDocumentId = apiDoc.id?.trim() || docId;
    const gcsParts = parseGcsUri(structString(struct, "gcsUri"));
    const filePath = structString(struct, "filePath") || gcsParts?.filePath;
    const bucketName = gcsParts?.bucketName || structString(struct, "bucketName");
    if (!filePath || !bucketName) continue;

    const mimeType = inferMimeFromPath(filePath);
    const isMarkdown =
      mimeType === "text/markdown" || filePath.toLowerCase().endsWith(".md");
    const isImage = mimeType.startsWith("image/");
    if (!isMarkdown && !isImage) continue;

    const webCrawlRequestId = structString(struct, "webCrawlRequestId");
    const displayName =
      structString(struct, "pageFilename") ||
      filePath.split("/").pop() ||
      docId;

    creates.push({
      docId,
      docData: {
        name: `fileSearchStores/${ctx.storeId}/documents/${agentSearchDocumentId}`,
        agentSearchDocumentId,
        indexBackend: "agent_search",
        registration: {
          stage: "indexed",
          gcsUploaded: true,
          geminiRegistered: true,
        },
        displayName,
        description: isMarkdown
          ? `Web 取り込み: ${displayName}`
          : `Web 取り込み画像: ${displayName}`,
        createTime: nowIso,
        updateTime: nowIso,
        state: "STATE_ACTIVE",
        subCategory: isMarkdown ? "urlMarkdown" : "fileUpload",
        bucketName,
        filePath,
        mimeType,
        status: "connected",
        storeId: ctx.storeId,
        organizationId: ctx.organizationId,
        spaceId: ctx.spaceId,
        sourceUrl: structString(struct, "sourcePageUrl") || null,
        sourcePageUrl: structString(struct, "sourcePageUrl") || null,
        webCrawlRequestId,
        gcsPrefix: inferGcsPrefix(filePath),
      },
    });
    existingDocIds.add(docId);
  }

  return creates;
};
