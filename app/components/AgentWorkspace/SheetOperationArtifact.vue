<template>
  <div
    class="rounded-lg border border-slate-200 bg-slate-50/90 p-2.5"
    data-testid="sheet-operation-artifact"
  >
    <div class="flex items-start gap-2">
      <UIcon
        :name="statusIcon"
        class="mt-0.5 h-4 w-4 flex-shrink-0"
        :class="statusIconClass"
      />
      <div class="min-w-0 flex-1">
        <p class="text-[11px] font-semibold text-slate-800">
          {{ statusLabel }}
          <span v-if="artifact.range" class="font-mono font-normal text-slate-500">
            · {{ artifact.range }}
          </span>
        </p>
        <p v-if="artifact.summary" class="mt-0.5 text-[11px] text-slate-600">
          {{ artifact.summary }}
        </p>
        <a
          v-if="openUrl"
          :href="openUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          data-testid="sheet-open-link"
        >
          <UIcon name="material-symbols:open-in-new" class="h-3.5 w-3.5" />
          スプレッドシートで開く
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";
const props = defineProps<{
  artifact: AgentSseArtifact;
  fallbackSpreadsheetUrl?: string | null;
  fallbackSheetGid?: number | null;
}>();

const statusLabel = computed(() => {
  switch (props.artifact.status) {
    case "applied":
      return "シート操作（適用済）";
    case "failed":
      return "シート操作（失敗）";
    case "proposed":
      return "シート操作（提案）";
    default:
      return "シート操作";
  }
});

const statusIcon = computed(() => {
  if (props.artifact.status === "failed") return "material-symbols:error-outline";
  if (props.artifact.status === "proposed") return "material-symbols:edit-note";
  return "material-symbols:check-circle";
});

const statusIconClass = computed(() => {
  if (props.artifact.status === "failed") return "text-rose-600";
  if (props.artifact.status === "proposed") return "text-purple-600";
  return "text-emerald-600";
});

const openUrl = computed((): string | null => {
  const direct = props.artifact.spreadsheetUrl?.trim();
  if (direct) return direct;
  const fallback = props.fallbackSpreadsheetUrl?.trim();
  if (!fallback) return null;
  if (
    props.fallbackSheetGid != null &&
    Number.isFinite(props.fallbackSheetGid) &&
    !fallback.includes("#gid=")
  ) {
    const base = fallback.split("#")[0]!;
    return `${base}#gid=${props.fallbackSheetGid}`;
  }
  return fallback;
});
</script>
