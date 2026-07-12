import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import log from "@utils/logger";

const FUNCTIONS_REGION = "asia-northeast1";

export const fetchArtifactSignedUrl = async (params: {
  storageGcsPath: string;
}): Promise<string | null> => {
  const gcsPath = params.storageGcsPath.trim();
  if (!gcsPath.startsWith("gs://")) return null;

  try {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION);
    const callable = httpsCallable<
      { storageGcsPath: string },
      { url: string }
    >(functions, "get_artifact_signed_url");
    const result = await callable({ storageGcsPath: gcsPath });
    const url = result.data?.url?.trim();
    return url || null;
  } catch (error) {
    log("WARN", "[artifactSignedUrl] callable failed", { gcsPath, error });
    return null;
  }
};
