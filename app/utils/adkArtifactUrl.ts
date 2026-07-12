import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import { getAuth } from "firebase/auth";
import {
  adkSourceGcsPath,
  computeAdkArtifactId,
  EN_AISTUDIO_ADK_APP_NAME,
} from "@utils/adkArtifactCatalog";
import {
  parseGsPath,
  resolveArtifactDisplayUrl,
} from "@utils/artifactDisplayUrl";
import { resolveStorageBucketName } from "@utils/adkAttachments";

const isEphemeralImageUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return (
    lower.includes("x-goog-signature") ||
    lower.includes("x-goog-algorithm") ||
    lower.includes("googleaccessid=")
  );
};

export const stabilizeImageArtifact = (
  artifact: AgentSseArtifact,
  fallbackSessionId?: string | null
): AgentSseArtifact => {
  if (artifact.kind !== "image") return artifact;
  const sessionId = artifact.sessionId ?? fallbackSessionId ?? undefined;
  const artifactId = artifact.artifactId?.trim();
  const url = artifact.url?.trim();
  if (artifactId) {
    const ephemeral =
      url && isEphemeralImageUrl(url) ? url : artifact.transientDisplayUrl;
    const { url: _drop, transientDisplayUrl: _td, ...rest } = artifact;
    return {
      ...rest,
      artifactId,
      sessionId,
      ...(ephemeral ? { transientDisplayUrl: ephemeral } : {}),
    };
  }
  if (url && isEphemeralImageUrl(url)) {
    const { url: _drop, ...rest } = artifact;
    return {
      ...rest,
      sessionId,
      transientDisplayUrl: url,
    };
  }
  return artifact;
};

const resolveAdkArtifactBucket = (): string => {
  const config = useRuntimeConfig();
  const fromPublic = config.public.enAiStudioAdkArtifactBucket;
  if (typeof fromPublic === "string" && fromPublic.trim()) {
    return fromPublic.trim();
  }
  return "";
};

export const resolveAdkImageDisplayUrl = async (params: {
  url?: string;
  transientDisplayUrl?: string;
  artifactId?: string;
  storageGcsPath?: string;
  contentType?: string;
  sessionId?: string;
  adkFilename?: string;
  artifactVersion?: number;
  getStorageGcsPath?: (params: { artifactId: string }) => string | undefined;
}): Promise<string | null> => {
  const direct = params.url?.trim();
  const transient = params.transientDisplayUrl?.trim();
  if (direct?.startsWith("data:")) {
    return direct;
  }
  if (transient?.startsWith("data:")) {
    return transient;
  }
  if (transient?.startsWith("http")) {
    return transient;
  }

  // FE → ADK REST は使わない。L2/L3 の gs:// パス → signed URL callable / Storage SDK のみ。
  const pathsToTry: string[] = [];
  const canonical =
    params.storageGcsPath?.trim() ||
    (params.artifactId && params.getStorageGcsPath
      ? params.getStorageGcsPath({ artifactId: params.artifactId })?.trim()
      : undefined);
  if (canonical) {
    pathsToTry.push(canonical);
  }

  const uid = getAuth().currentUser?.uid;
  const bucket =
    params.sessionId &&
    params.adkFilename?.trim() &&
    params.artifactVersion != null &&
    uid
      ? resolveAdkArtifactBucket()
      : "";
  if (
    params.sessionId &&
    params.adkFilename?.trim() &&
    params.artifactVersion != null &&
    bucket &&
    uid
  ) {
    const sourcePath = adkSourceGcsPath({
      bucket,
      appName: EN_AISTUDIO_ADK_APP_NAME,
      userId: uid,
      sessionId: params.sessionId,
      filename: params.adkFilename.trim(),
      version: params.artifactVersion,
    });
    if (!pathsToTry.includes(sourcePath)) {
      pathsToTry.push(sourcePath);
    }
  }

  const defaultBucket = resolveStorageBucketName();
  const sortedPaths = [...pathsToTry].sort((a, b) => {
    const aDefault = parseGsPath(a)?.bucket === defaultBucket ? 0 : 1;
    const bDefault = parseGsPath(b)?.bucket === defaultBucket ? 0 : 1;
    return aDefault - bDefault;
  });

  for (const path of sortedPaths) {
    const resolved = await resolveArtifactDisplayUrl({
      storageGcsPath: path,
      contentType: params.contentType,
    });
    if (resolved) return resolved;
  }

  if (direct?.startsWith("http") && isEphemeralImageUrl(direct)) {
    return direct;
  }

  return null;
};

/** Resolve artifactId when SSE only sent adkFilename + version. */
export const resolveAdkArtifactId = async (params: {
  artifactId?: string;
  sessionId?: string;
  adkFilename?: string;
  artifactVersion?: number;
}): Promise<string | undefined> => {
  const existing = params.artifactId?.trim();
  if (existing) return existing;
  if (
    !params.sessionId ||
    !params.adkFilename?.trim() ||
    params.artifactVersion == null
  ) {
    return undefined;
  }
  return computeAdkArtifactId({
    sessionId: params.sessionId,
    filename: params.adkFilename.trim(),
    version: params.artifactVersion,
  });
};
