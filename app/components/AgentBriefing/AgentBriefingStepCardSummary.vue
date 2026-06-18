<template>
  <div>
    <p
      v-if="field.kind === 'text' && textValue"
      class="inline-flex max-w-full items-center rounded-full border px-3 py-1 text-sm font-medium"
      :class="chipClass"
    >
      <span class="truncate">{{ textValue }}</span>
    </p>
    <div
      v-else-if="field.kind === 'chips' && chipValues.length > 0"
      class="flex flex-wrap gap-1.5"
    >
      <span
        v-for="(c, i) in chipValues"
        :key="`${field.key}-${i}`"
        class="inline-flex max-w-full items-center rounded-full border px-3 py-1 text-sm font-medium"
        :class="chipClass"
      >
        <span class="truncate">{{ c }}</span>
      </span>
    </div>
    <p
      v-else-if="field.optional"
      class="text-sm italic text-neutral-400"
    >
      （未入力）
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AgentBriefingHandle } from "@composables/agentBriefing/useAgentBriefing";
import type { BriefingFieldDef } from "@composables/agentBriefing/types";

const props = defineProps<{
  field: BriefingFieldDef;
  briefing: AgentBriefingHandle;
}>();

const textValue = computed(() => {
  const v = props.briefing.draft[props.field.key];
  return typeof v === "string" ? v.trim() : "";
});

const chipValues = computed(() => {
  const v = props.briefing.draft[props.field.key];
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
});

const accent = computed(() => props.briefing.config.accent ?? "purple");

const chipClass = computed(() => {
  switch (accent.value) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "violet":
      return "border-violet-200 bg-violet-50 text-violet-900";
    case "purple":
    default:
      return "border-purple-200 bg-purple-50 text-purple-900";
  }
});
</script>
