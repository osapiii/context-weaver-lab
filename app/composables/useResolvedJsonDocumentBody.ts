/**
 * json_document / csv_document Artifact — inline body または Firestore catalog + Storage から本文を解決.
 */
import { ref, watch, type Ref } from "vue";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import { useAdkSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import type { DecodedAdkSessionArtifact } from "@models/adkSessionArtifact";
import { fetchArtifactTextContent } from "@utils/artifactDisplayUrl";
import log from "@utils/logger";

const findCatalogRecord = (params: {
  artifact: AgentSseArtifact;
  getArtifact: (params: { artifactId: string }) => DecodedAdkSessionArtifact | undefined;
  artifactsById: Map<string, DecodedAdkSessionArtifact>;
}): DecodedAdkSessionArtifact | undefined => {
  const artifactId = params.artifact.artifactId?.trim();
  if (artifactId) {
    const byId = params.getArtifact({ artifactId });
    if (byId) return byId;
  }

  const filename = params.artifact.adkFilename?.trim();
  if (!filename) return undefined;

  let latest: DecodedAdkSessionArtifact | undefined;
  for (const record of params.artifactsById.values()) {
    if (record.adkFilename !== filename) continue;
    if (params.artifact.kind && record.kind !== params.artifact.kind) continue;
    if (
      !latest ||
      record.adkVersion > latest.adkVersion ||
      (record.status === "ready" && latest.status !== "ready")
    ) {
      latest = record;
    }
  }
  return latest;
};

export const useResolvedJsonDocumentBody = (params: {
  artifact: Ref<AgentSseArtifact | null | undefined>;
}): { body: Ref<string | null>; loading: Ref<boolean>; error: Ref<string | null> } => {
  const { artifactsById, getArtifact } = useAdkSessionArtifacts();
  const body = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  watch(
    [params.artifact, artifactsById],
    async () => {
      const artifact = params.artifact.value;
      if (
        !artifact ||
        (artifact.kind !== "json_document" && artifact.kind !== "csv_document")
      ) {
        body.value = null;
        error.value = null;
        return;
      }
      if (artifact.body?.trim()) {
        body.value = artifact.body.trim();
        error.value = null;
        return;
      }

      loading.value = true;
      error.value = null;
      try {
        const record = findCatalogRecord({
          artifact,
          getArtifact,
          artifactsById: artifactsById.value,
        });
        if (!record?.storageGcsPath?.trim()) {
          body.value = null;
          if (record?.status === "error") {
            error.value = record.syncError?.trim() || "Artifact の同期に失敗しました";
          }
          return;
        }
        if (record.status === "syncing") {
          body.value = null;
          return;
        }
        const text = await fetchArtifactTextContent({
          storageGcsPath: record.storageGcsPath,
          contentType: record.contentType,
        });
        body.value = text?.trim() ? text : null;
        if (!body.value && record.status === "ready") {
          error.value = "ファイル本文の取得に失敗しました";
        }
      } catch (err) {
        log("WARN", "[useResolvedJsonDocumentBody] fetch failed", err);
        body.value = null;
        error.value = "Artifact の読み込みに失敗しました";
      } finally {
        loading.value = false;
      }
    },
    { immediate: true, deep: true }
  );

  return { body, loading, error };
};
