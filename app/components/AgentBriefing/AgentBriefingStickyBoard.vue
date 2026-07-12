<template>
  <div
    class="briefing-board relative flex h-full flex-col overflow-hidden rounded-2xl bg-white/60 p-4 ring-1 ring-black/5"
    aria-label="ヒアリングボード"
  >
    <div class="mb-3 flex items-center gap-2">
      <UIcon
        name="material-symbols:edit-square-outline"
        class="h-5 w-5 text-neutral-600"
      />
      <h3 class="text-sm font-extrabold tracking-tight text-neutral-700">
        ヒアリングボード
      </h3>
    </div>

    <div
      :class="[
        'grid gap-5',
        notes.length <= 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
      ]"
    >
      <AgentBriefingStickyNote
        v-for="note in notes"
        :key="note.key"
        :index="note.index"
        :label="note.label"
        :value="note.value"
        :state="note.state"
        :editable="editable"
        :tone="note.tone"
        @edit="$emit('edit', note.step)"
      />
    </div>

    <div class="mt-auto pt-4">
      <div class="flex items-center gap-2">
        <span class="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
          進捗
        </span>
        <div
          class="relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-200/70"
        >
          <div
            :class="[
              'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
              accentBar,
            ]"
            :style="{ width: `${progressPct}%` }"
          />
        </div>
        <span class="text-xs font-bold tabular-nums text-neutral-700">
          {{ filledCount }}/{{ notes.length }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AgentBriefingStickyNote from "./AgentBriefingStickyNote.vue";
import type { AgentBriefingHandle } from "@composables/agentBriefing/useAgentBriefing";
import type { BriefingFieldDef } from "@composables/agentBriefing/types";

const props = withDefaults(
  defineProps<{
    briefing: AgentBriefingHandle;
    editable?: boolean;
  }>(),
  {
    editable: false,
  },
);

defineEmits<{ (e: "edit", step: number): void }>();

const defaultTone = computed(() => {
  switch (props.briefing.config.accent) {
    case "emerald":
      return "lime";
    case "sky":
      return "sky";
    case "violet":
      return "violet";
    case "purple":
    default:
      return "purple";
  }
});

const accentBar = computed(() => {
  switch (props.briefing.config.accent) {
    case "emerald":
      return "bg-gradient-to-r from-emerald-400 to-teal-500";
    case "sky":
      return "bg-gradient-to-r from-sky-400 to-blue-500";
    case "violet":
      return "bg-gradient-to-r from-violet-400 to-purple-500";
    case "purple":
    default:
      return "bg-gradient-to-r from-purple-400 to-violet-500";
  }
});

interface NoteVm {
  key: string;
  step: number;
  index: number;
  label: string;
  value: string | string[] | undefined;
  state: "empty" | "active" | "filled";
  tone: "purple" | "lime" | "sky" | "rose" | "violet";
}

const isGroupFilled = (fields: BriefingFieldDef[]): boolean =>
  fields.every(
    (field) => field.optional === true || props.briefing.isFieldFilled(field),
  );

const buildGroupedValue = (fields: BriefingFieldDef[]): string[] => {
  const lines: string[] = [];
  for (const field of fields) {
    const raw = props.briefing.draft[field.key];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) {
        lines.push(`[${field.stickyLabel}] ${item.trim()}`);
      }
    }
  }
  return lines;
};

const notes = computed<NoteVm[]>(() => {
  const result: NoteVm[] = [];
  const seenGroups = new Set<string>();
  let index = 0;

  for (const field of props.briefing.config.fields) {
    if (field.stickyGroup) {
      if (seenGroups.has(field.stickyGroup)) continue;
      seenGroups.add(field.stickyGroup);
      const groupFields = props.briefing.config.fields.filter(
        (f) => f.stickyGroup === field.stickyGroup,
      );
      const filled = isGroupFilled(groupFields);
      const active =
        !props.editable &&
        groupFields.some((f) => f.step === props.briefing.step.value);
      index += 1;
      result.push({
        key: `group:${field.stickyGroup}`,
        step: Math.min(...groupFields.map((f) => f.step)),
        index,
        label: field.stickyGroupLabel ?? field.stickyLabel,
        value: filled ? buildGroupedValue(groupFields) : undefined,
        state: filled ? "filled" : active ? "active" : "empty",
        tone: field.stickyTone ?? defaultTone.value,
      });
      continue;
    }

    const value = props.briefing.draft[field.key];
    const filled = props.briefing.isFieldFilled(field);
    const active =
      !props.editable && field.step === props.briefing.step.value;
    index += 1;
    result.push({
      key: field.key,
      step: field.step,
      index,
      label: field.stickyLabel,
      value,
      state: filled ? "filled" : active ? "active" : "empty",
      tone: field.stickyTone ?? defaultTone.value,
    });
  }

  return result;
});

const filledCount = computed(
  () => notes.value.filter((n) => n.state === "filled").length,
);
const progressPct = computed(() =>
  notes.value.length === 0
    ? 0
    : Math.round((filledCount.value / notes.value.length) * 100),
);
</script>
