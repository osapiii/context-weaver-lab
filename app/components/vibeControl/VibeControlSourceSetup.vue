<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-slate-900">Source Setup</h2>
        <p class="mt-1 text-xs text-slate-500">
          FileSpaceをTo-Be、GitHubをAs-IsとしてSSOTを生成します
        </p>
      </div>
      <EnButton
        variant="soft"
        color="neutral"
        size="sm"
        leading-icon="material-symbols:folder-open"
        :to="{ name: 'admin-data-source' }"
      >
        ナレッジを開く
      </EnButton>
    </div>

    <div class="mt-4 grid gap-3 lg:grid-cols-3">
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">FileSpace ID</span>
        <input
          v-model="localInput.fileSpaceId"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="w-default"
        >
      </label>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">GitHub repo</span>
        <input
          v-model="localInput.repoFullName"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="org/repo"
        >
      </label>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Default branch</span>
        <input
          v-model="localInput.defaultBranch"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="main"
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
import type { DecodedVibeControlSourceConnection } from "@models/vibeControl";
import type { VibeControlGenerationInput } from "@stores/vibeControl";

const props = defineProps<{
  sourceConnections: DecodedVibeControlSourceConnection[];
  isGenerating: boolean;
}>();

defineEmits<{
  generate: [input: VibeControlGenerationInput];
  persist: [];
}>();

const localInput = reactive<VibeControlGenerationInput>({
  fileSpaceId:
    props.sourceConnections.find((item) => item.provider === "file_space")
      ?.fileSpaceId ?? "w-default",
  repoFullName:
    props.sourceConnections.find((item) => item.provider === "github")
      ?.repoFullName ?? "enostech/vibe-control-demo",
  defaultBranch:
    props.sourceConnections.find((item) => item.provider === "github")
      ?.defaultBranch ?? "main",
});
</script>
