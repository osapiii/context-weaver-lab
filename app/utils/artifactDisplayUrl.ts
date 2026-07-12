import { getBytes, getDownloadURL } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import { resolveStorageBucketName } from "@utils/adkAttachments";
import { fetchArtifactSignedUrl } from "@utils/artifactSignedUrl";
import log from "@utils/logger";

const storageBytesToArrayBuffer = (
  bytes: ArrayBuffer | Uint8Array
): ArrayBuffer => {
  if (bytes instanceof ArrayBuffer) return bytes;
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );
};

const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 45 * 60 * 1000;

export const parseGsPath = (
  gcsPath: string
): { bucket: string; path: string } | null => {
  const trimmed = gcsPath.trim();
  if (!trimmed.startsWith("gs://")) return null;
  const without = trimmed.slice("gs://".length);
  const slash = without.indexOf("/");
  if (slash <= 0) return null;
  return {
    bucket: without.slice(0, slash),
    path: without.slice(slash + 1),
  };
};

const cacheArtifactUrl = (params: {
  gcsPath: string;
  url: string;
}): string => {
  urlCache.set(params.gcsPath, {
    url: params.url,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return params.url;
};

const storageRefFromGcsPath = (
  gcsPath: string
): ReturnType<typeof storageRefForBucketPath> | null => {
  const parsed = parseGsPath(gcsPath.trim());
  if (!parsed) return null;
  return storageRefForBucketPath({
    bucketName: parsed.bucket,
    filePath: parsed.path,
  });
};

const isDefaultStorageBucket = (bucket: string): boolean =>
  bucket === resolveStorageBucketName();

/**
 * guide_09 準拠 — Firebase Storage `getDownloadURL`
 * (`useFirebaseStorageOperations().getAuthenticatedUrl` と同等)
 */
export const resolveAuthenticatedUrlFromGcs = async (params: {
  storageGcsPath: string;
}): Promise<string | null> => {
  const parsed = parseGsPath(params.storageGcsPath.trim());
  if (!parsed || !isDefaultStorageBucket(parsed.bucket)) {
    return null;
  }

  const storageRef = storageRefFromGcsPath(params.storageGcsPath);
  if (!storageRef) return null;

  try {
    return await getDownloadURL(storageRef);
  } catch (error) {
    log("WARN", "[artifactDisplayUrl] getAuthenticatedUrl failed", {
      gcsPath: params.storageGcsPath,
      error,
    });
    return null;
  }
};

/** ADK Artifact のテキスト本文（JSON / markdown 等）を Storage から取得 */
export const fetchArtifactTextContent = async (params: {
  storageGcsPath: string;
  contentType?: string | null;
}): Promise<string | null> => {
  const gcsPath = params.storageGcsPath.trim();
  if (!gcsPath) return null;

  const buffer = await fetchArtifactBytes({ storageGcsPath: gcsPath });
  if (buffer) {
    return new TextDecoder("utf-8").decode(buffer);
  }

  const parsed = parseGsPath(gcsPath);
  if (parsed && !isDefaultStorageBucket(parsed.bucket)) {
    const signedUrl = await fetchArtifactSignedUrl({ storageGcsPath: gcsPath });
    if (signedUrl) {
      try {
        const response = await fetch(signedUrl);
        if (response.ok) {
          return await response.text();
        }
      } catch (error) {
        log("WARN", "[artifactDisplayUrl] signed URL text fetch failed", {
          gcsPath,
          error,
        });
      }
    }
  }

  const authenticatedUrl = await resolveAuthenticatedUrlFromGcs({
    storageGcsPath: gcsPath,
  });
  if (authenticatedUrl) {
    try {
      const response = await fetch(authenticatedUrl);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      log("WARN", "[artifactDisplayUrl] authenticated URL text fetch failed", {
        gcsPath,
        error,
      });
    }
  }

  return null;
};

/** Firebase Storage SDK `getBytes` — CORS 不要（canvas crop 向け） */
export const fetchArtifactBytes = async (params: {
  storageGcsPath: string;
}): Promise<ArrayBuffer | null> => {
  const parsed = parseGsPath(params.storageGcsPath.trim());
  if (!parsed || !isDefaultStorageBucket(parsed.bucket)) {
    return null;
  }

  const storageRef = storageRefFromGcsPath(params.storageGcsPath);
  if (!storageRef) return null;

  try {
    const bytes = await getBytes(storageRef);
    return storageBytesToArrayBuffer(bytes);
  } catch (error) {
    log("WARN", "[artifactDisplayUrl] getBytes failed", {
      gcsPath: params.storageGcsPath,
      error,
    });
    return null;
  }
};

/** 画像 blob — getBytes のみ（HTTP fetch / callable は使わない） */
export const fetchArtifactImageBlob = async (params: {
  storageGcsPath: string;
  contentType?: string | null;
}): Promise<Blob | null> => {
  const buffer = await fetchArtifactBytes({
    storageGcsPath: params.storageGcsPath,
  });
  if (!buffer) return null;
  const contentType = params.contentType?.trim() || "image/png";
  return new Blob([buffer], { type: contentType });
};

/** Canvas crop 用 — getBytes → blob: URL */
export const resolveArtifactBlobUrl = async (params: {
  storageGcsPath: string;
  contentType?: string | null;
}): Promise<string | null> => {
  const gcsPath = params.storageGcsPath.trim();
  if (!gcsPath) return null;

  const cacheKey = `blob:${gcsPath}`;
  const cached = urlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const blob = await fetchArtifactImageBlob({
    storageGcsPath: gcsPath,
    contentType: params.contentType,
  });
  if (!blob) return null;

  const objectUrl = URL.createObjectURL(blob);
  return cacheArtifactUrl({ gcsPath: cacheKey, url: objectUrl });
};

export const resolveArtifactDisplayUrl = async (params: {
  storageGcsPath?: string | null;
  contentType?: string | null;
}): Promise<string | null> => {
  const gcsPath = params.storageGcsPath?.trim();
  if (!gcsPath) return null;

  const cached = urlCache.get(gcsPath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const contentType = params.contentType?.trim() || "application/octet-stream";
  const buffer = await fetchArtifactBytes({ storageGcsPath: gcsPath });
  if (buffer) {
    const objectUrl = URL.createObjectURL(
      new Blob([buffer], { type: contentType })
    );
    return cacheArtifactUrl({ gcsPath, url: objectUrl });
  }

  const authenticatedUrl = await resolveAuthenticatedUrlFromGcs({
    storageGcsPath: gcsPath,
  });
  if (authenticatedUrl) {
    return cacheArtifactUrl({ gcsPath, url: authenticatedUrl });
  }

  const parsed = parseGsPath(gcsPath);
  if (parsed && !isDefaultStorageBucket(parsed.bucket)) {
    const signedUrl = await fetchArtifactSignedUrl({ storageGcsPath: gcsPath });
    if (signedUrl) {
      return cacheArtifactUrl({ gcsPath, url: signedUrl });
    }
    log("WARN", "[artifactDisplayUrl] ADK artifact URL unavailable", {
      gcsPath,
      bucket: parsed.bucket,
    });
  }

  return null;
};

export const revokeArtifactDisplayUrl = (params: { url: string }): void => {
  if (params.url.startsWith("blob:")) {
    URL.revokeObjectURL(params.url);
  }
};
