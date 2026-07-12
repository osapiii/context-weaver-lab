<template>
  <div class="flex flex-col gap-4">
    <EnRadioGroup
      v-model="activeTab"
      :items="tabOptions"
      variant="card"
      :columns="3"
      class="w-full"
    />

    <div v-if="activeTab === 'yaml'" class="space-y-3">
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p v-if="artifactMeta.gsUri" class="break-all font-mono">
          {{ artifactMeta.gsUri }}
        </p>
        <p v-else class="text-slate-400">inputArtifactUri 未設定</p>
        <p v-if="artifactMeta.updatedAt" class="mt-1">
          更新: {{ artifactMeta.updatedAt }}
          <span v-if="artifactMeta.sizeBytes != null">
            · {{ artifactMeta.sizeBytes }} bytes
          </span>
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <EnButton
          v-if="storageExplorerPrefix"
          variant="outline"
          size="xs"
          icon="i-heroicons-folder-open"
          :to="storageExplorerLink"
        >
          Storage で開く
        </EnButton>
        <EnButton
          v-if="artifactMeta.gsUri"
          variant="ghost"
          size="xs"
          icon="i-heroicons-arrow-top-right-on-square"
          :href="gcsConsoleUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          GCS コンソール
        </EnButton>
        <EnButton
          variant="soft"
          size="xs"
          icon="i-heroicons-arrow-path"
          :loading="artifactLoading"
          @click="loadArtifact"
        >
          YAML を再取得
        </EnButton>
      </div>

      <EnAlert
        v-if="artifactError"
        color="error"
        :title="artifactError"
      />

      <div
        v-else-if="artifactLoading"
        class="flex items-center gap-2 py-8 text-sm text-slate-500"
      >
        <UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin" />
        Input artifact を読み込み中…
      </div>

      <JsonViewer
        v-else-if="artifactManifest"
        :value="artifactManifest"
        :expand-depth="3"
        theme="dark"
        :copyable="true"
        class="rounded-lg"
      />

      <p v-else class="text-sm text-slate-500">
        artifact が見つかりませんでした（TTL 削除済みの可能性があります）
      </p>
    </div>

    <div v-else-if="activeTab === 'requestDoc'" class="space-y-3">
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
        <p class="font-mono text-slate-700 break-all">
          {{ firestorePath }}
        </p>
        <p v-if="workflowConsoleUrl" class="mt-2">
          <a
            :href="workflowConsoleUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-sky-600 hover:underline"
          >
            GCP Workflow 実行を開く
            <UIcon name="i-heroicons-arrow-top-right-on-square" class="size-3.5" />
          </a>
        </p>
      </div>
      <JsonViewer
        v-if="log.originalDoc"
        :value="log.originalDoc"
        :expand-depth="2"
        theme="dark"
        :copyable="true"
        class="rounded-lg"
      />
    </div>

    <div v-else class="space-y-2">
      <p v-if="stepLogRows.length === 0" class="text-sm text-slate-500">
        stepLogs はまだ記録されていません
      </p>
      <div v-else class="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
        <table class="min-w-full text-left text-xs">
          <thead class="sticky top-0 bg-slate-800 text-slate-100">
            <tr>
              <th class="px-3 py-2">時刻</th>
              <th class="px-3 py-2">Step</th>
              <th class="px-3 py-2">Level</th>
              <th class="px-3 py-2">メッセージ</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in stepLogRows"
              :key="`${row.at}-${idx}`"
              class="border-t border-slate-100 odd:bg-white even:bg-slate-50"
            >
              <td class="whitespace-nowrap px-3 py-1.5 font-mono text-slate-600">
                {{ row.at }}
              </td>
              <td class="px-3 py-1.5 text-slate-700">{{ row.stepId }}</td>
              <td class="px-3 py-1.5">{{ row.level }}</td>
              <td class="px-3 py-1.5 text-slate-800">{{ row.message }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { RequestLog } from "@stores/requestLogHistory";
import { fetchWorkflowInputArtifact } from "@utils/fetchWorkflowInputArtifact";
import {
  buildWorkflowRequestDocFirestorePath,
  buildWorkflowStorageExplorerPrefix,
  extractWorkflowConsoleUrl,
  extractWorkflowStepLogs,
  isWorkflowRequestLogType,
  resolveWorkflowInputArtifactUri,
} from "@utils/workflowRequestLog";
import { flattenStepLogs } from "@utils/truncateStepLogs";
import type { GoogleDriveSyncStepLogs } from "@models/googleDriveSyncRequest";
import { gcsBrowserUrlFromGsUri } from "@utils/knowledgeStoragePaths";

const props = defineProps<{
  log: RequestLog;
}>();

const activeTab = ref<"yaml" | "requestDoc" | "stepLogs">("yaml");
const tabOptions = [
  { value: "yaml", label: "Input YAML (SSOT)" },
  { value: "requestDoc", label: "RequestDoc" },
  { value: "stepLogs", label: "Step Logs" },
];

const artifactLoading = ref(false);
const artifactError = ref<string | null>(null);
const artifactManifest = ref<Record<string, unknown> | null>(null);
const artifactMeta = ref({
  gsUri: "",
  sizeBytes: null as number | null,
  updatedAt: null as string | null,
});

const firestorePath = computed(() => {
  if (!isWorkflowRequestLogType(props.log.requestType)) return "";
  return buildWorkflowRequestDocFirestorePath({
    requestType: props.log.requestType,
    requestId: props.log.id,
  });
});

const workflowConsoleUrl = computed(() =>
  extractWorkflowConsoleUrl({ originalDoc: props.log.originalDoc })
);

const gcsConsoleUrl = computed(() => {
  const uri = artifactMeta.value.gsUri;
  return uri ? gcsBrowserUrlFromGsUri(uri) ?? "" : "";
});

const storageExplorerPrefix = computed(() => {
  if (!isWorkflowRequestLogType(props.log.requestType)) return null;
  return buildWorkflowStorageExplorerPrefix({
    requestType: props.log.requestType,
    requestId: props.log.id,
    originalDoc: props.log.originalDoc,
    gsUri: artifactMeta.value.gsUri || resolveWorkflowInputArtifactUri({
      originalDoc: props.log.originalDoc,
    }),
  });
});

const storageExplorerLink = computed(() => {
  const prefix = storageExplorerPrefix.value;
  if (!prefix) return undefined;
  return {
    name: "admin-storage" as const,
    query: { gcsPrefix: prefix },
  };
});

const stepLogRows = computed(() => {
  const raw = extractWorkflowStepLogs(props.log.originalDoc);
  if (!raw) return [];
  const flat = flattenStepLogs(raw as GoogleDriveSyncStepLogs);
  return flat.map((entry) => ({
    at: entry.at,
    stepId: entry.stepId ?? "—",
    level: entry.level ?? "info",
    message: entry.message,
  }));
});

const loadArtifact = async (): Promise<void> => {
  if (!isWorkflowRequestLogType(props.log.requestType)) return;
  artifactLoading.value = true;
  artifactError.value = null;
  try {
    const result = await fetchWorkflowInputArtifact({ log: props.log });
    artifactMeta.value = {
      gsUri: result.gsUri,
      sizeBytes: result.sizeBytes ?? null,
      updatedAt: result.updatedAt ?? null,
    };
    artifactManifest.value = result.found ? result.manifest : null;
  } catch (err) {
    artifactError.value =
      err instanceof Error ? err.message : "artifact の取得に失敗しました";
    artifactManifest.value = null;
  } finally {
    artifactLoading.value = false;
  }
};

watch(
  () => props.log.id,
  () => {
    activeTab.value = "yaml";
    void loadArtifact();
  },
  { immediate: true }
);
</script>
