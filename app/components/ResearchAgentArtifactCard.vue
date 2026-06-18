<template>
  <button
    type="button"
    class="group flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left transition hover:border-purple-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
    @click="$emit('select', artifact)"
  >
    <div
      class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
      :class="badgeClass"
    >
      <UIcon :name="iconName" class="h-5 w-5" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium text-neutral-800">
        {{ artifact.name }}
      </div>
      <div class="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
        <span>{{ formatBytes(artifact.bytes) }}</span>
        <span>·</span>
        <span>{{ formatTime(artifact.generatedAt) }}</span>
      </div>
    </div>
    <UIcon
      name="material-symbols:visibility-outline"
      class="h-5 w-5 flex-shrink-0 text-neutral-400 transition group-hover:text-purple-500"
    />
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ResearchAgentArtifact } from "@stores/researchAgent";

const props = defineProps<{ artifact: ResearchAgentArtifact }>();

defineEmits<{
  (e: "select", artifact: ResearchAgentArtifact): void;
}>();

const iconName = computed(() => {
  switch (props.artifact.kind) {
    case "pptx":
      return "material-symbols:slideshow";
    case "plan_json":
      return "material-symbols:data-object";
    case "narration":
      return "material-symbols:description";
    case "html":
      return "material-symbols:html";
    case "package":
      return "material-symbols:folder-zip";
    case "image":
      return "material-symbols:image";
    default:
      return "material-symbols:draft";
  }
});

const badgeClass = computed(() => {
  switch (props.artifact.kind) {
    case "pptx":
      return "bg-purple-50 text-purple-600";
    case "plan_json":
      return "bg-sky-50 text-sky-600";
    case "narration":
      return "bg-emerald-50 text-emerald-600";
    case "html":
      return "bg-violet-50 text-violet-600";
    case "package":
      return "bg-rose-50 text-rose-600";
    case "image":
      return "bg-neutral-50 text-neutral-600";
    default:
      return "bg-neutral-50 text-neutral-600";
  }
});

const formatBytes = (n: number): string => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

const formatTime = (ms: number) => {
  const d = new Date(ms);
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};
</script>
