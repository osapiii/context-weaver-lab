import type { DecodedAdkSessionArtifact } from "@models/adkSessionArtifact";

export interface AiStudioResearchArtifacts {
  htmlArtifact: DecodedAdkSessionArtifact | null;
  imageArtifact: DecodedAdkSessionArtifact | null;
}

const artifactFilename = (artifact: DecodedAdkSessionArtifact): string =>
  (artifact.name || artifact.adkFilename || artifact.artifactId).trim();

const isReadyArtifact = (artifact: DecodedAdkSessionArtifact): boolean =>
  artifact.status === "ready" && !!artifact.storageGcsPath.trim();

const isResearchHtml = (artifact: DecodedAdkSessionArtifact): boolean => {
  const filename = artifactFilename(artifact);
  return (
    artifact.kind === "html" ||
    artifact.contentType.toLowerCase().includes("text/html") ||
    /research\.html$/i.test(filename)
  );
};

const isResearchImage = (artifact: DecodedAdkSessionArtifact): boolean => {
  const filename = artifactFilename(artifact);
  const contentType = artifact.contentType.toLowerCase();
  return (
    artifact.kind === "image" ||
    contentType.startsWith("image/") ||
    /\.(svg|png|jpe?g|webp)$/i.test(filename)
  );
};

/** 調査一覧カードに出す HTML と代表図解を成果物一覧から選ぶ。 */
export const resolveAiStudioResearchArtifacts = (params: {
  artifacts: Iterable<DecodedAdkSessionArtifact>;
}): AiStudioResearchArtifacts => {
  const readyArtifacts = Array.from(params.artifacts).filter(isReadyArtifact);
  return {
    htmlArtifact: readyArtifacts.find(isResearchHtml) ?? null,
    imageArtifact: readyArtifacts.find(isResearchImage) ?? null,
  };
};
