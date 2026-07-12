<template>
  <article
    :class="[
      'rounded-2xl border-2 p-4 transition-all duration-200 md:p-5',
      cardClass,
    ]"
    :aria-current="state === 'active' ? 'step' : undefined"
  >
    <header class="mb-3 flex items-start gap-3">
      <span
        :class="[
          'inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold ring-1 ring-black/5',
          indexBadgeClass,
        ]"
      >
        {{ index }}
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="text-base font-bold text-neutral-800">{{ title }}</h3>
          <EnBadge
            v-if="state === 'active'"
            variant="soft"
            color="warning"
            size="xs"
          >
            編集中
          </EnBadge>
          <EnBadge
            v-else-if="state === 'completed'"
            variant="soft"
            color="success"
            size="xs"
          >
            完了
          </EnBadge>
        </div>
        <p
          v-if="state === 'upcoming' && subtitle"
          class="mt-1 text-sm text-neutral-400"
        >
          {{ subtitle }}
        </p>
      </div>
      <div
        v-if="$slots['header-meta'] || state === 'completed'"
        class="ml-auto flex shrink-0 items-start gap-2"
      >
        <slot name="header-meta" />
        <EnButton
          v-if="state === 'completed'"
          variant="soft"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:edit-outline"
          class="flex-shrink-0"
          :aria-label="`${title} を編集`"
          @click="$emit('edit')"
        >
          編集
        </EnButton>
      </div>
    </header>

    <div v-if="state === 'upcoming'" class="py-2">
      <p class="text-sm text-neutral-400">次のステップで入力します</p>
    </div>

    <div v-else-if="state === 'completed'" class="space-y-3">
      <template v-for="field in fields" :key="field.key">
        <div v-if="fields.length > 1" class="space-y-2">
          <p class="text-xs font-bold uppercase tracking-wider text-neutral-500">
            {{ field.stickyLabel }}
          </p>
          <AgentBriefingStepCardSummary :field="field" :briefing="briefing" />
        </div>
        <AgentBriefingStepCardSummary
          v-else
          :field="field"
          :briefing="briefing"
        />
      </template>
    </div>

    <div v-else class="space-y-4">
      <p
        v-if="fields.length === 1 && fields[0]?.hint"
        class="text-sm text-neutral-500"
      >
        {{ fields[0].hint }}
      </p>
      <AgentBriefingFields
        :briefing="briefing"
        :fields="fields"
        :show-field-headings="fields.length > 1"
        :autofocus="true"
        @enter-advance="$emit('enter-advance')"
      />
    </div>

    <div v-if="$slots.footer" class="mt-4 border-t border-neutral-100 pt-3">
      <slot name="footer" />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AgentBriefingFields from "./AgentBriefingFields.vue";
import AgentBriefingStepCardSummary from "./AgentBriefingStepCardSummary.vue";
import type { AgentBriefingHandle } from "@composables/agentBriefing/useAgentBriefing";
import type { BriefingFieldDef } from "@composables/agentBriefing/types";

type StepState = "upcoming" | "active" | "completed";

const props = defineProps<{
  index: number;
  title: string;
  subtitle?: string;
  fields: BriefingFieldDef[];
  briefing: AgentBriefingHandle;
  state: StepState;
}>();

defineEmits<{
  (e: "edit" | "enter-advance"): void;
}>();

const accent = computed(() => props.briefing.config.accent ?? "purple");

const cardClass = computed(() => {
  switch (props.state) {
    case "active":
      switch (accent.value) {
        case "emerald":
          return "border-emerald-300 bg-gradient-to-br from-emerald-50/80 to-white shadow-md";
        case "sky":
          return "border-sky-300 bg-gradient-to-br from-sky-50/80 to-white shadow-md";
        case "violet":
          return "border-violet-300 bg-gradient-to-br from-violet-50/80 to-white shadow-md";
        case "purple":
        default:
          return "border-purple-300 bg-gradient-to-br from-purple-50/80 to-white shadow-md";
      }
    case "completed":
      return "border-neutral-200 bg-white/90 shadow-sm";
    case "upcoming":
    default:
      return "border-dashed border-neutral-200 bg-neutral-50/50";
  }
});

const indexBadgeClass = computed(() => {
  if (props.state === "upcoming") {
    return "bg-white/80 text-neutral-400";
  }
  switch (accent.value) {
    case "emerald":
      return "bg-emerald-100 text-emerald-800";
    case "sky":
      return "bg-sky-100 text-sky-800";
    case "violet":
      return "bg-violet-100 text-violet-800";
    case "purple":
    default:
      return "bg-purple-100 text-purple-800";
  }
});
</script>
