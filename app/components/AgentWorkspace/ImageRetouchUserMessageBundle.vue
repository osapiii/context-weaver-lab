<template>
  <div
    class="flex max-w-[min(100%,20rem)] flex-col items-end gap-1.5"
    data-testid="image-retouch-user-message"
  >
    <ImageRetouchContextChip
      :context="context"
      :session-id="sessionId"
      data-testid="image-retouch-message-chip"
    />
    <div
      v-if="instruction.trim()"
      class="w-full whitespace-pre-wrap rounded-2xl bg-violet-50 px-3.5 py-2 text-[13px] text-gray-900 shadow-[0_1px_2px_rgba(124,58,237,0.06)] ring-1 ring-violet-100/80 dark:bg-violet-950/40 dark:text-gray-100 dark:ring-violet-800/30"
      data-testid="image-retouch-message-instruction"
    >
      {{ instruction }}
    </div>
    <ul
      v-if="regionInstructionLines.length > 0"
      class="w-full space-y-1 rounded-lg border border-purple-100 bg-purple-50/60 px-2.5 py-2 text-left text-[11px] text-purple-950"
      data-testid="image-retouch-message-regions"
    >
      <li
        v-for="line in regionInstructionLines"
        :key="line.id"
        class="leading-snug"
      >
        <span class="font-bold">範囲 {{ line.index }}</span>
        <span v-if="line.instruction"> — {{ line.instruction }}</span>
        <span v-else class="text-purple-800/80">（指示なし・bbox のみ）</span>
        <span
          v-if="line.hasReference"
          class="text-violet-800/90"
        > · 参照画像あり</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ImageRetouchContextChip from "@components/AgentWorkspace/ImageRetouchContextChip.vue";
import type { ImageRetouchMessageContext } from "@utils/imageStudioState";

const props = defineProps<{
  context: ImageRetouchMessageContext;
  instruction: string;
  sessionId?: string | null;
}>();

const regionInstructionLines = computed(() =>
  props.context.regions.map((region, index) => ({
    id: region.id,
    index: index + 1,
    instruction: region.instruction.trim(),
    hasReference: Boolean(region.referenceImage?.gcsPath?.trim()),
  }))
);
</script>
