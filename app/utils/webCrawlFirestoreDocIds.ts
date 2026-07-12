/**
 * webCrawler step3 と同じ Firestore document ID 規則（SHA-256 suffix）。
 */

const stableDocSuffix = async (seed: string, modulo: number): Promise<number> => {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(seed)
  );
  const hex = Array.from(new Uint8Array(hashBuffer).slice(0, 4))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return parseInt(hex, 16) % modulo;
};

export const webCrawlMarkdownFirestoreDocId = async (
  gcsPath: string,
  markdownFilename: string
): Promise<string> => {
  const base = markdownFilename.replace(/\.md$/i, "");
  const suffix = await stableDocSuffix(gcsPath, 100_000);
  return `webcrawl_${base}_${suffix}`;
};

export const webCrawlImageFirestoreDocId = async (
  gcsPath: string
): Promise<string> => {
  const suffix = await stableDocSuffix(gcsPath, 1_000_000);
  return `webcrawl_img_${suffix}`;
};

export const buildWebCrawlUploadMetadata = (params: {
  firestoreDocId: string;
  bucketName: string;
  filePath: string;
  webCrawlRequestId?: string | null;
  pageFilename?: string | null;
  sourcePageUrl?: string | null;
  subCategory?: string | null;
}): Array<{ key: string; value: string }> => {
  const rows: Array<{ key: string; value: string }> = [
    { key: "firestoreDocId", value: params.firestoreDocId },
    { key: "gcsUri", value: `gs://${params.bucketName}/${params.filePath}` },
    { key: "filePath", value: params.filePath },
  ];
  if (params.webCrawlRequestId) {
    rows.push({ key: "webCrawlRequestId", value: params.webCrawlRequestId });
  }
  if (params.pageFilename) {
    rows.push({ key: "pageFilename", value: params.pageFilename });
  }
  if (params.sourcePageUrl) {
    rows.push({ key: "sourcePageUrl", value: params.sourcePageUrl });
  }
  if (params.subCategory) {
    rows.push({ key: "subCategory", value: params.subCategory });
  }
  return rows;
};
