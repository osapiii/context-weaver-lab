/**
 * ADK artifact path helpers (mirrors backend/app/lib/adk_artifact_catalog.py).
 */
export const EN_AISTUDIO_ADK_APP_NAME = "en-aistudio-adk-agent";

export const computeAdkArtifactId = async (params: {
  sessionId: string;
  filename: string;
  version: number;
}): Promise<string> => {
  const raw = `${params.sessionId}:${params.filename}:${params.version}`;
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
};

export const adkSourceBlobPath = (params: {
  appName?: string;
  userId: string;
  sessionId: string;
  filename: string;
  version: number;
}): string => {
  const app = params.appName ?? EN_AISTUDIO_ADK_APP_NAME;
  return `${app}/${params.userId}/${params.sessionId}/${params.filename}/${params.version}`;
};

export const adkSourceGcsPath = (params: {
  bucket: string;
  appName?: string;
  userId: string;
  sessionId: string;
  filename: string;
  version: number;
}): string => `gs://${params.bucket.trim()}/${adkSourceBlobPath(params)}`;

export const canonicalArtifactBlobPath = (params: {
  organizationId: string;
  spaceId: string;
  sessionId: string;
  filename: string;
  version: number;
}): string => {
  const safeName = params.filename.split("/").pop()?.replace(/[^a-zA-Z0-9._-]+/g, "_") || "artifact";
  return `organizations/${params.organizationId}/spaces/${params.spaceId}/adkSessions/${params.sessionId}/artifacts/${safeName}/v${params.version}`;
};
