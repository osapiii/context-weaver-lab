import type { AiStudioMessage } from "@stores/aiStudio";
import {
  imagePrimaryHasReference,
  resolveImageStudioFieldsFromRecord,
} from "@utils/imageStudioState";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";

/** 履歴一覧用 — 生成画像の表示参照 (ADK artifact または一時 URL) */
export interface AiStudioSessionImageThumbnail {
  artifactId?: string | null;
  adkFilename?: string | null;
  artifactVersion?: number | null;
  url?: string | null;
  transientDisplayUrl?: string | null;
}

const artifactToThumbnail = (
  artifact: AgentSseArtifact
): AiStudioSessionImageThumbnail | null => {
  if (artifact.kind !== "image") return null;
  const adkFilename = artifact.adkFilename?.trim() || null;
  const artifactId = artifact.artifactId?.trim() || null;
  const url = artifact.url?.trim() || null;
  const transientDisplayUrl = artifact.transientDisplayUrl?.trim() || null;
  if (!adkFilename && !artifactId && !url && !transientDisplayUrl) {
    return null;
  }
  return {
    artifactId,
    adkFilename,
    artifactVersion:
      typeof artifact.artifactVersion === "number"
        ? artifact.artifactVersion
        : adkFilename
          ? 0
          : null,
    url,
    transientDisplayUrl,
  };
};

const findLatestImageArtifact = (
  messages: AiStudioMessage[]
): AgentSseArtifact | null => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const artifacts = messages[i]?.artifacts;
    if (!artifacts?.length) continue;
    for (let j = artifacts.length - 1; j >= 0; j -= 1) {
      const artifact = artifacts[j];
      if (artifact?.kind === "image") return artifact;
    }
  }
  return null;
};

/** Firestore session state から一覧サムネ用の画像参照を解決 */
export const resolveSessionImageThumbnail = (params: {
  state: Record<string, unknown>;
  messages: AiStudioMessage[];
}): AiStudioSessionImageThumbnail | null => {
  const studio = resolveImageStudioFieldsFromRecord({
    state: params.state,
  });
  const primary = studio.primaryArtifact;
  if (imagePrimaryHasReference(primary)) {
    return {
      artifactId: primary.artifactId,
      adkFilename: primary.adkFilename,
      artifactVersion: primary.artifactVersion ?? 0,
    };
  }

  const fromMessage = findLatestImageArtifact(params.messages);
  if (!fromMessage) return null;
  return artifactToThumbnail(fromMessage);
};
