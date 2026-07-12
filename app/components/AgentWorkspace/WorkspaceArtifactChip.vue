<template>
  <button
    type="button"
    class="group flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-[#faf9f6] px-3 py-2.5 text-left shadow-sm transition hover:border-neutral-300 hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
    :class="{ 'ring-2 ring-violet-400/50 border-violet-200': active }"
    data-testid="workspace-artifact-chip"
    @click="emit('open')"
  >
    <div
      class="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200/80"
    >
      <AdkArtifactImage
        v-if="artifact.kind === 'image'"
        :artifact-id="artifact.artifactId"
        :url="artifact.url"
        :adk-filename="artifact.adkFilename"
        :artifact-version="artifact.artifactVersion"
        :alt="meta.title"
        class="h-full w-full object-cover"
      />
      <UIcon
        v-else
        :name="meta.icon"
        class="h-4 w-4 text-neutral-600"
      />
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-xs font-semibold text-neutral-900">
        {{ meta.title }}
      </p>
      <p class="text-[10px] text-neutral-500">
        {{ meta.typeLabel }} · プレビューで開く
      </p>
    </div>
    <UIcon
      name="material-symbols:chevron-right"
      class="h-4 w-4 flex-shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-600"
    />
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import AdkArtifactImage from "@components/AgentWorkspace/AdkArtifactImage.vue";
import { workspaceArtifactMeta } from "@utils/workspaceArtifactMeta";

const props = defineProps<{
  artifact: AgentSseArtifact;
  messageId: string;
  index: number;
  active?: boolean;
  sessionId?: string | null;
}>();

const emit = defineEmits<{
  open: [];
}>();

const meta = computed(() =>
  workspaceArtifactMeta({
    artifact: props.artifact,
    messageId: props.messageId,
    index: props.index,
  })
);

</script>
