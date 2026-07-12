import type { Document } from "@models/document";

export type WebCrawlThumbnailSource =
  | { kind: "url"; url: string }
  | { kind: "gcs"; bucket: string; path: string };

/** Detail modal / list で共通利用する image doc dedup */
export function dedupeWebCrawlImageDocs(docs: Document[]): Document[] {
  const seen = new Set<string>();
  const result: Document[] = [];
  for (const d of docs) {
    const key = d.contentHash || d.sourceUrl || d.filePath || d.name || "";
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(d);
  }
  return result;
}

function pushUniqueSource(
  list: WebCrawlThumbnailSource[],
  seen: Set<string>,
  source: WebCrawlThumbnailSource
) {
  const key =
    source.kind === "url"
      ? `url:${source.url}`
      : `gcs:${source.bucket}/${source.path}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(source);
}

/** VisualCard 用: 画像 doc → markdown OGP/thumbnail の順でタイル候補を集める */
export function collectWebCrawlGroupThumbnailSources(
  group: {
    imageDocs: Document[];
    markdownDocs: Document[];
  },
  limit = 4
): { sources: WebCrawlThumbnailSource[]; totalCount: number } {
  const seen = new Set<string>();
  const sources: WebCrawlThumbnailSource[] = [];

  for (const img of dedupeWebCrawlImageDocs(group.imageDocs)) {
    if (sources.length >= limit) break;
    if (img.bucketName && img.filePath) {
      pushUniqueSource(sources, seen, {
        kind: "gcs",
        bucket: img.bucketName,
        path: img.filePath,
      });
    }
  }

  for (const doc of group.markdownDocs) {
    if (sources.length >= limit) break;
    const og = doc.ogImage?.trim();
    if (og?.startsWith("http")) {
      pushUniqueSource(sources, seen, { kind: "url", url: og });
      continue;
    }
    if (doc.thumbnailGcsPath && doc.thumbnailBucket) {
      pushUniqueSource(sources, seen, {
        kind: "gcs",
        bucket: doc.thumbnailBucket,
        path: doc.thumbnailGcsPath,
      });
    }
  }

  const totalCount = Math.max(
    dedupeWebCrawlImageDocs(group.imageDocs).length,
    group.markdownDocs.filter(
      (d) =>
        d.ogImage?.trim()?.startsWith("http") ||
        (d.thumbnailGcsPath && d.thumbnailBucket)
    ).length,
    sources.length
  );

  return { sources, totalCount };
}
