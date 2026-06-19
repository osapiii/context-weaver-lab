<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-slate-900">ソース設定</h2>
        <p class="mt-1 text-xs text-slate-500">
          選択中アプリのFileSpaceをTo-Be、GitHubをAs-IsとしてSSOTを生成します
        </p>
      </div>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">FileSpace ID</span>
        <input
          v-model="localInput.fileSpaceId"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="w-default"
        >
      </label>
      <div class="block min-w-0 xl:col-span-2">
        <span class="text-xs font-medium text-slate-600">GitHub repo</span>
        <div class="mt-1 flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
          {{ localInput.repoFullName }}
        </div>
      </div>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Default branch</span>
        <input
          v-model="localInput.defaultBranch"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="main"
          disabled
        >
      </label>
    </div>

    <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
      <div class="flex flex-wrap gap-2">
        <EnBadge
          v-for="source in sourceConnections"
          :key="source.id"
          :color="source.status === 'connected' ? 'success' : source.status === 'error' ? 'error' : 'warning'"
          variant="soft"
        >
          {{ source.displayName }}
        </EnBadge>
      </div>
      <div class="flex flex-wrap gap-2">
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:save-outline"
          @click="$emit('persist')"
        >
          Snapshot保存
        </EnButton>
        <EnButton
          variant="ai"
          size="sm"
          leading-icon="material-symbols:auto-awesome"
          :loading="isGenerating"
          @click="$emit('generate', { ...localInput })"
        >
          SSOT生成
        </EnButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  DecodedVibeControlApplication,
  DecodedVibeControlSourceConnection,
} from "@models/vibeControl";
import type { VibeControlGenerationInput } from "@stores/vibeControl";

const props = defineProps<{
  selectedApplication: DecodedVibeControlApplication | null;
  sourceConnections: DecodedVibeControlSourceConnection[];
  isGenerating: boolean;
}>();

defineEmits<{
  generate: [input: VibeControlGenerationInput];
  persist: [];
}>();

const localInput = reactive<VibeControlGenerationInput>({
  applicationId: props.selectedApplication?.id,
  applicationKey: props.selectedApplication?.applicationKey ?? "VC",
  applicationName: props.selectedApplication?.name ?? "アプリ名未設定",
  fileSpaceId:
    props.selectedApplication?.fileSpaceId ??
    props.sourceConnections.find((item) => item.provider === "file_space")
      ?.fileSpaceId ??
    "w-default",
  repoFullName:
    props.selectedApplication?.repoFullName ?? "repository未選択",
  defaultBranch:
    props.selectedApplication?.defaultBranch ??
    props.sourceConnections.find((item) => item.provider === "github")
      ?.defaultBranch ??
    "main",
});

watch(
  () => props.selectedApplication,
  (application) => {
    if (!application) return;
    localInput.applicationId = application.id;
    localInput.applicationKey = application.applicationKey;
    localInput.applicationName = application.name;
    localInput.fileSpaceId = application.fileSpaceId ?? localInput.fileSpaceId;
    localInput.repoFullName = application.repoFullName;
    localInput.defaultBranch = application.defaultBranch ?? localInput.defaultBranch;
  }
);
</script>
