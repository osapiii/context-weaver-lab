<template>
  <div data-testid="writing-json-artifact-card">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <UIcon
          name="material-symbols:data-object"
          class="h-4 w-4 text-emerald-600"
        />
        <span class="text-xs font-semibold text-neutral-700">
          {{ artifact.title || "生成 JSON" }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <EnButton
          variant="ghost"
          size="xs"
          leading-icon="material-symbols:content-copy"
          :disabled="!resolvedBody"
          @click="copyText(resolvedBody ?? '')"
        >
          JSON コピー
        </EnButton>
      </div>
    </div>

    <div
      v-if="loading"
      class="rounded bg-neutral-50 p-2.5 text-[11px] text-neutral-500"
    >
      読み込み中…
    </div>
    <pre
      v-else-if="resolvedBody"
      class="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-50 p-2.5 text-[11px] leading-relaxed text-neutral-800"
    >{{ resolvedBody }}</pre>
    <p
      v-else
      class="rounded bg-neutral-50 p-2.5 text-[11px] text-neutral-500"
    >
      Artifact を同期中です…
    </p>

    <div
      v-if="entries.length > 0"
      class="mt-2 space-y-2 border-t border-neutral-100 pt-2"
    >
      <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        フィールド別コピー
      </p>
      <div
        v-for="entry in entries"
        :key="entry.key"
        class="flex items-start justify-between gap-2 rounded-md bg-neutral-50 p-2"
      >
        <div class="min-w-0 flex-1">
          <p class="text-[10px] font-semibold text-neutral-700">
            {{ entry.key }}
          </p>
          <p class="mt-0.5 whitespace-pre-wrap text-[11px] text-neutral-800 line-clamp-4">
            {{ entry.value }}
          </p>
        </div>
        <EnButton
          variant="ghost"
          size="xs"
          leading-icon="material-symbols:content-copy"
          @click="copyText(entry.value)"
        >
          コピー
        </EnButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from "vue";
import EnButton from "@components/EnButton.vue";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import { useResolvedJsonDocumentBody } from "@composables/useResolvedJsonDocumentBody";
import { parseWritingJsonPayload } from "@utils/writingWorkspaceState";

const props = defineProps<{
  artifact: AgentSseArtifact;
}>();

const toast = useToast();
const { body: resolvedBody, loading } = useResolvedJsonDocumentBody({
  artifact: toRef(props, "artifact"),
});

const entries = computed(() => {
  if (!resolvedBody.value) return [];
  const payload = parseWritingJsonPayload(resolvedBody.value);
  return Object.entries(payload).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : String(value),
  }));
});

const copyText = async (text: string): Promise<void> => {
  if (!text.trim()) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.add({ title: "コピーしました", color: "success" });
  } catch {
    toast.add({ title: "コピーに失敗しました", color: "error" });
  }
};
</script>
