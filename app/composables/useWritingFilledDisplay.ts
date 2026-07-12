/**
 * 書類記入 — json_document Artifact (Firestore onSnapshot + Storage) から結果フィールドを表示用に解決.
 */
import { computed, ref, watch, type Ref } from "vue";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import { useAdkSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import type { WritingFormField } from "@models/writingForm";
import { fetchArtifactTextContent } from "@utils/artifactDisplayUrl";
import {
  findLatestWritingJsonArtifact,
  mergeWritingFieldsWithJsonPayload,
  parseWritingJsonPayload,
} from "@utils/writingWorkspaceState";
import log from "@utils/logger";

export const useWritingFilledDisplay = (params: {
  fields: Ref<WritingFormField[]>;
  messages: Ref<
    ReadonlyArray<{
      role: string;
      artifacts?: AgentSseArtifact[];
    }>
  >;
}): {
  displayFields: Ref<WritingFormField[]>;
  loading: Ref<boolean>;
  jsonArtifact: Ref<AgentSseArtifact | null>;
  jsonBody: Ref<string | null>;
} => {
  const { artifactsById, getArtifact } = useAdkSessionArtifacts();
  const loading = ref(false);
  const jsonBody = ref<string | null>(null);
  const payloadValues = ref<Record<string, unknown>>({});

  const jsonArtifact = computed(() =>
    findLatestWritingJsonArtifact({ messages: params.messages.value })
  );

  const resolveInlineOrFetchedBody = async (): Promise<string | null> => {
    const artifact = jsonArtifact.value;
    if (!artifact) return null;
    if (artifact.body?.trim()) return artifact.body.trim();

    const artifactId = artifact.artifactId?.trim();
    if (!artifactId) return null;

    const record = getArtifact({ artifactId });
    if (!record?.storageGcsPath?.trim()) return null;
    if (record.status === "syncing") return null;
    if (record.status === "error") return null;

    return fetchArtifactTextContent({
      storageGcsPath: record.storageGcsPath,
      contentType: record.contentType,
    });
  };

  watch(
    [jsonArtifact, artifactsById, () => params.messages.value.length],
    async () => {
      loading.value = true;
      try {
        const body = await resolveInlineOrFetchedBody();
        jsonBody.value = body;
        payloadValues.value = body ? parseWritingJsonPayload(body) : {};
      } catch (error) {
        log("WARN", "[useWritingFilledDisplay] resolve json artifact failed", error);
        jsonBody.value = null;
        payloadValues.value = {};
      } finally {
        loading.value = false;
      }
    },
    { immediate: true, deep: true }
  );

  const displayFields = computed(() =>
    mergeWritingFieldsWithJsonPayload({
      fields: params.fields.value,
      payload: payloadValues.value,
    })
  );

  return {
    displayFields,
    loading,
    jsonArtifact,
    jsonBody,
  };
};
