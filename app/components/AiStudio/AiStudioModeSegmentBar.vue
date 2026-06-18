<template>
  <div
    class="ai-studio-mode-segment-bar w-full min-w-0 bg-gradient-to-b from-white to-slate-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_-4px_rgba(15,23,42,0.12)]"
    :class="barShellClass"
    role="radiogroup"
    :aria-label="ariaLabel"
    data-testid="ai-studio-mode-segment-bar"
  >
    <div
      class="flex w-full min-w-0 items-stretch overflow-x-auto"
      :class="density === 'compact' ? 'gap-0.5 p-0.5' : 'gap-1 p-1'"
    >
      <button
        v-for="item in items"
        :key="item.value"
        type="button"
        role="radio"
        :aria-checked="modelValue === item.value"
        :disabled="disabled"
        :title="displayLabel(item)"
        :data-testid="`ai-studio-mode-${item.value}`"
        class="ai-studio-mode-segment min-w-0 border-2 border-transparent transition-[transform,box-shadow,background-color,border-color] duration-200 disabled:cursor-not-allowed disabled:opacity-50"
        :class="[segmentButtonClass, segmentClass(item.value)]"
        @click="onSelect(item.value)"
      >
        <UIcon
          :name="item.icon"
          class="shrink-0"
          :class="[
            density === 'compact' ? 'h-4 w-4 sm:h-[18px] sm:w-[18px]' : 'h-5 w-5 sm:h-6 sm:w-6',
            {
              'ai-studio-mode-segment-icon--multicolor': isMulticolorNavIcon(
                item.icon
              ),
            },
          ]"
          aria-hidden="true"
        />
        <span
          class="min-w-0 whitespace-nowrap font-bold leading-tight text-slate-800"
          :class="
            density === 'compact'
              ? 'text-[10px] sm:text-[11px]'
              : 'text-xs sm:text-sm'
          "
        >
          {{ displayLabel(item) }}
        </span>
        <EnBadge
          v-if="showCounts && item.count !== undefined"
          size="sm"
          :color="modelValue === item.value ? 'primary' : 'neutral'"
          variant="soft"
          custom-class="tabular-nums"
        >
          {{ item.count }}
        </EnBadge>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { isMulticolorNavIcon } from "@composables/useNavModeIcons";
import EnBadge from "@components/EnBadge.vue";

export type AiStudioModeSegmentItem = {
  value: string;
  label: string;
  shortLabel?: string;
  icon: string;
  count?: number;
};

const ACTIVE_SEGMENT_CLASS: Record<string, string> = {
  all: "border-violet-200/90 bg-slate-100 text-violet-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_-6px_rgba(124,58,237,0.35)] ring-2 ring-violet-100",
  consultation:
    "border-sky-200/90 bg-slate-100 text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_-6px_rgba(14,165,233,0.35)] ring-2 ring-sky-100",
  writing:
    "border-emerald-200/90 bg-slate-100 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_-6px_rgba(16,185,129,0.35)] ring-2 ring-emerald-100",
  sheet:
    "border-green-200/90 bg-slate-100 text-green-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_-6px_rgba(34,197,94,0.35)] ring-2 ring-green-100",
  image:
    "border-violet-200/90 bg-slate-100 text-violet-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_-6px_rgba(124,58,237,0.35)] ring-2 ring-violet-100",
  research:
    "border-slate-300/90 bg-slate-100 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_-6px_rgba(71,85,105,0.28)] ring-2 ring-slate-200",
};

const props = withDefaults(
  defineProps<{
    modelValue: string;
    items: AiStudioModeSegmentItem[];
    disabled?: boolean;
    ariaLabel?: string;
    /** workspace ヘッダー向けの低い横並びレイアウト */
    density?: "default" | "compact";
    /** true のとき count badge を表示する */
    showCounts?: boolean;
    /** `label` か `shortLabel` のどちらを表示するか */
    labelMode?: "label" | "shortLabel";
  }>(),
  {
    disabled: false,
    ariaLabel: "モード",
    density: "default",
    showCounts: true,
    labelMode: "label",
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const barShellClass = computed(() =>
  props.density === "compact"
    ? "rounded-xl border border-slate-200/90 p-1"
    : "rounded-2xl border-2 border-slate-200/90 p-2"
);

const segmentButtonClass = computed(() =>
  props.density === "compact"
    ? "flex flex-row items-center gap-1.5 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
    : "flex flex-row items-center gap-1.5 rounded-xl px-3 py-2 whitespace-nowrap"
);

const displayLabel = (item: AiStudioModeSegmentItem): string =>
  props.labelMode === "shortLabel"
    ? item.shortLabel?.trim() || item.label
    : item.label;

const segmentClass = (value: string): string =>
  props.modelValue === value
    ? (ACTIVE_SEGMENT_CLASS[value] ??
        "border-slate-300 bg-slate-100 text-slate-900 shadow-md ring-2 ring-slate-100")
    : "text-slate-600 hover:border-slate-200/80 hover:bg-white/90 hover:shadow-sm";

const onSelect = (value: string): void => {
  if (props.disabled || props.modelValue === value) return;
  emit("update:modelValue", value);
};
</script>

<style scoped>
.ai-studio-mode-segment-icon--multicolor {
  color: unset;
}
</style>
