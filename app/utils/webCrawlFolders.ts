import type { Document } from "@models/document";
import type { DecodedWebCrawlRequest } from "@models/webCrawlRequest";
import type { WebCrawlFolderGroup, WebCrawlGroup } from "../types/webCrawlGroup";
import { isKnowledgeIndexed } from "@utils/knowledge";
import {
  isWebCrawlImageDocument,
  isWebCrawlMarkdownDocument,
} from "@utils/webCrawlDocumentKind";
import { resolveWebCrawlImportFolder } from "@utils/webCrawlImportFolder";

const extractHostname = (url: string | null | undefined): string => {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const formatRelative = (d: Date | null): string => {
  if (!d) return "";
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  return `${day}日前`;
};

const toDocDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

export const buildWebCrawlGroups = (
  documents: Document[],
  hiddenKeys: Set<string> = new Set()
): WebCrawlGroup[] => {
  const byKey = new Map<string, WebCrawlGroup>();
  for (const doc of documents) {
    const key = doc.webCrawlRequestId || doc.gcsPrefix;
    if (!key || hiddenKeys.has(key)) continue;

    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        title: "",
        hostname: "",
        entryUrl: null,
        createdAt: null,
        createdAtText: "",
        markdownCount: 0,
        imageCount: 0,
        indexedCount: 0,
        markdownDocs: [],
        imageDocs: [],
        otherDocs: [],
      });
    }
    const group = byKey.get(key)!;
    const docUrl = doc.sourceUrl || doc.url || doc.entryUrl || null;
    if (docUrl && !group.entryUrl) {
      try {
        const u = new URL(docUrl);
        group.entryUrl = `${u.protocol}//${u.host}/`;
        group.hostname = u.hostname;
      } catch {
        group.entryUrl = docUrl;
      }
    }

    if (!group.title && isWebCrawlMarkdownDocument(doc)) {
      group.title = doc.title || doc.displayName || "";
    }

    const createdDate = toDocDate(doc.createdAt);
    if (createdDate && (!group.createdAt || createdDate < group.createdAt)) {
      group.createdAt = createdDate;
    }

    if (isWebCrawlMarkdownDocument(doc)) {
      group.markdownCount++;
      group.markdownDocs.push(doc);
      if (isKnowledgeIndexed(doc)) group.indexedCount++;
      continue;
    }

    if (isWebCrawlImageDocument(doc)) {
      const imageKey =
        doc.contentHash || doc.sourceUrl || doc.filePath || doc.name || "";
      const alreadyCounted =
        imageKey &&
        group.imageDocs.some(
          (d) =>
            (d.contentHash || d.sourceUrl || d.filePath || d.name) === imageKey
        );
      group.imageDocs.push(doc);
      if (!alreadyCounted) group.imageCount++;
      continue;
    }

    group.otherDocs.push(doc);
  }

  for (const group of byKey.values()) {
    if (!group.hostname && group.entryUrl) {
      group.hostname = extractHostname(group.entryUrl);
    }
    if (!group.title && group.hostname) {
      group.title = group.hostname;
    }
    group.createdAtText = formatRelative(group.createdAt);
  }

  return Array.from(byKey.values()).sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  );
};

export const buildWebCrawlFolders = (params: {
  groups: WebCrawlGroup[];
  requests: DecodedWebCrawlRequest[];
  fileSpaceId?: string | null;
  spaceId?: string | null;
}): WebCrawlFolderGroup[] => {
  const byFolder = new Map<string, WebCrawlFolderGroup>();
  const relevantRequests = params.requests.filter(
    (request) =>
      (!params.fileSpaceId || request.input.fileSpaceId === params.fileSpaceId) &&
      (!params.spaceId || request.operationMetadata.spaceId === params.spaceId)
  );
  const requestById = new Map(relevantRequests.map((request) => [request.id, request]));

  for (const request of relevantRequests) {
    const importFolder = resolveWebCrawlImportFolder(request);
    if (!byFolder.has(importFolder.id)) {
      byFolder.set(importFolder.id, {
        folder: importFolder,
        jobs: [],
        requests: [],
        latestAt: null,
        pageCount: 0,
        imageCount: 0,
      });
    }
    const folder = byFolder.get(importFolder.id)!;
    folder.requests.push(request);
    const requestDate = request.createdAt.toDate();
    if (!folder.latestAt || requestDate > folder.latestAt) {
      folder.latestAt = requestDate;
    }
  }

  for (const job of params.groups) {
    const request = requestById.get(job.key);
    const importFolder = request
      ? resolveWebCrawlImportFolder(request)
      : {
          id: `webFolder_legacy_${encodeURIComponent(
            job.hostname || job.title || job.key
          )}`,
          name: job.hostname || job.title || "従来の取り込み",
          description: null,
        };
    if (!byFolder.has(importFolder.id)) {
      byFolder.set(importFolder.id, {
        folder: importFolder,
        jobs: [],
        requests: request ? [request] : [],
        latestAt: job.createdAt,
        pageCount: 0,
        imageCount: 0,
      });
    }
    const folder = byFolder.get(importFolder.id)!;
    folder.jobs.push(job);
    folder.pageCount += job.markdownCount;
    folder.imageCount += job.imageCount;
    if (job.createdAt && (!folder.latestAt || job.createdAt > folder.latestAt)) {
      folder.latestAt = job.createdAt;
    }
  }

  return Array.from(byFolder.values())
    .map((folder) => ({
      ...folder,
      jobs: [...folder.jobs].sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
      ),
      requests: [...folder.requests].sort(
        (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()
      ),
    }))
    .sort((a, b) => (b.latestAt?.getTime() ?? 0) - (a.latestAt?.getTime() ?? 0));
};
