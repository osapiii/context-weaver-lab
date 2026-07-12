/** Artifact (画像等) のダウンロード helper */
import { getBytes } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import { resolveStorageBucketName } from "@utils/adkAttachments";
import { parseGsPath } from "@utils/artifactDisplayUrl";
import { fetchArtifactSignedUrl } from "@utils/artifactSignedUrl";
import log from "@utils/logger";

const sanitizeFilename = (name: string, fallback: string): string => {
  const base = name.trim() || fallback;
  return base.replace(/[^\w\u3040-\u30ff\u4e00-\u9faf.-]+/g, "_").slice(0, 80);
};

const extensionFromContentType = (contentType?: string | null): string => {
  const lower = (contentType ?? "").toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("webp")) return "webp";
  return "png";
};

export const buildArtifactImageFilename = (params: {
  adkFilename?: string | null;
  prompt?: string;
  index?: number;
  contentType?: string | null;
}): string => {
  const ext = extensionFromContentType(params.contentType);
  const rawName = params.adkFilename?.trim();
  if (rawName) {
    const base = rawName.split("/").pop() || rawName;
    if (/\.(png|jpe?g|webp)$/i.test(base)) {
      return sanitizeFilename(base, `en-aistudio-image.${ext}`);
    }
    return `${sanitizeFilename(base, "en-aistudio-image")}.${ext}`;
  }
  const label = params.prompt
    ? sanitizeFilename(params.prompt, "en-aistudio-image")
    : `en-aistudio-image-${(params.index ?? 0) + 1}`;
  return `${label}.${ext}`;
};

export const triggerBlobDownload = (params: {
  blob: Blob;
  filename: string;
}): void => {
  const objectUrl = URL.createObjectURL(params.blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = params.filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

/** Firebase Storage / GCS から blob 経由で保存（fetch CORS を避ける） */
export async function downloadImageFromGcsPath(params: {
  storageGcsPath: string;
  contentType?: string | null;
  adkFilename?: string | null;
  prompt?: string;
  index?: number;
}): Promise<void> {
  const gcsPath = params.storageGcsPath.trim();
  const parsed = parseGsPath(gcsPath);
  if (!parsed) {
    throw new Error("無効な storageGcsPath です");
  }

  const filename = buildArtifactImageFilename({
    adkFilename: params.adkFilename,
    prompt: params.prompt,
    index: params.index,
    contentType: params.contentType,
  });
  const contentType = params.contentType?.trim() || "image/png";
  const defaultBucket = resolveStorageBucketName();

  if (parsed.bucket === defaultBucket) {
    const storageRef = storageRefForBucketPath({
      bucketName: parsed.bucket,
      filePath: parsed.path,
    });
    const bytes = await getBytes(storageRef);
    triggerBlobDownload({
      blob: new Blob([bytes], { type: contentType }),
      filename,
    });
    return;
  }

  const signedUrl = await fetchArtifactSignedUrl({ storageGcsPath: gcsPath });
  if (!signedUrl) {
    throw new Error("画像 URL を取得できませんでした");
  }

  try {
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`画像の取得に失敗しました (HTTP ${response.status})`);
    }
    triggerBlobDownload({
      blob: await response.blob(),
      filename,
    });
  } catch (error) {
    log("WARN", "[artifactDownload] fetch signed URL failed, opening tab", {
      gcsPath,
      error,
    });
    const anchor = document.createElement("a");
    anchor.href = signedUrl;
    anchor.download = filename;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }
}

export async function downloadImageArtifact(
  url: string,
  options?: {
    prompt?: string;
    index?: number;
    adkFilename?: string | null;
    contentType?: string | null;
  }
): Promise<void> {
  const filename = buildArtifactImageFilename({
    adkFilename: options?.adkFilename,
    prompt: options?.prompt,
    index: options?.index,
    contentType: options?.contentType,
  });

  if (url.startsWith("data:") || url.startsWith("blob:")) {
    if (url.startsWith("blob:")) {
      const response = await fetch(url);
      triggerBlobDownload({ blob: await response.blob(), filename });
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`画像の取得に失敗しました (HTTP ${response.status})`);
    }
    triggerBlobDownload({ blob: await response.blob(), filename });
  } catch (error) {
    log("WARN", "[artifactDownload] fetch display URL failed, opening tab", {
      url: url.slice(0, 80),
      error,
    });
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }
}

export async function downloadAdkImageArtifact(params: {
  storageGcsPath?: string | null;
  displayUrl?: string | null;
  contentType?: string | null;
  adkFilename?: string | null;
  prompt?: string;
  index?: number;
}): Promise<void> {
  const gcsPath = params.storageGcsPath?.trim();
  if (gcsPath) {
    await downloadImageFromGcsPath({
      storageGcsPath: gcsPath,
      contentType: params.contentType,
      adkFilename: params.adkFilename,
      prompt: params.prompt,
      index: params.index,
    });
    return;
  }

  const displayUrl = params.displayUrl?.trim();
  if (!displayUrl) {
    throw new Error("ダウンロードできる画像がありません");
  }

  await downloadImageArtifact(displayUrl, {
    prompt: params.prompt,
    index: params.index,
    adkFilename: params.adkFilename,
    contentType: params.contentType,
  });
}
