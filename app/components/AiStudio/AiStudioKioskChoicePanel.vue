<template>
  <div
    class="mx-auto w-full max-w-2xl"
    :data-testid="testId"
  >
    <div v-if="showHeader" class="mb-5 text-center">
      <h2
        class="text-lg font-bold tracking-tight sm:text-xl"
        :class="themeClasses.heading"
      >
        {{ title }}
      </h2>
      <p
        v-if="subtitle"
        class="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm"
      >
        {{ subtitle }}
      </p>
    </div>

    <div
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
      role="radiogroup"
      :aria-label="ariaLabel"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="modelValue === option.value"
        :disabled="disabled"
        :data-testid="optionTestId(option.value)"
        class="ai-studio-kiosk-choice flex min-h-[7.5rem] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 px-4 py-5 text-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[8.5rem] sm:px-5 sm:py-6"
        :class="choiceClass(option.value)"
        @click="onSelect(option.value)"
      >
        <span
          class="flex h-14 w-14 items-center justify-center rounded-2xl sm:h-16 sm:w-16"
          :class="iconStageClass(option.value)"
          aria-hidden="true"
        >
          <UIcon
            v-if="option.icon"
            :name="option.icon"
            class="h-8 w-8 sm:h-9 sm:w-9"
            :class="{
              'ai-studio-kiosk-choice-icon--multicolor': isMulticolorNavIcon(
                option.icon
              ),
            }"
          />
        </span>
        <span class="space-y-1">
          <span class="block text-sm font-bold leading-snug text-slate-900 sm:text-base">
            {{ option.label }}
          </span>
          <span
            v-if="option.description"
            class="block text-[11px] leading-snug text-slate-600 sm:text-xs"
          >
            {{ option.description }}
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { isMulticolorNavIcon } from "@composables/useNavModeIcons";

export type AiStudioKioskChoiceOption = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
};

export type AiStudioKioskTheme = "image" | "writing" | "sheet";

const THEME_CLASSES: Record<
  AiStudioKioskTheme,
  {
    heading: string;
    selected: string;
    idle: string;
    iconSelected: string;
    iconIdle: string;
    focusRing: string;
  }
> = {
  image: {
    heading: "text-violet-950",
    selected:
      "border-violet-400 bg-violet-50 shadow-md ring-2 ring-violet-200/80",
    idle:
      "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50/40 hover:shadow-md",
    iconSelected: "bg-violet-100 ring-1 ring-violet-200",
    iconIdle: "bg-slate-50 ring-1 ring-slate-200/80",
    focusRing: "focus-visible:ring-violet-400",
  },
  writing: {
    heading: "text-emerald-950",
    selected:
      "border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-200/80",
    idle:
      "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-md",
    iconSelected: "bg-emerald-100 ring-1 ring-emerald-200",
    iconIdle: "bg-slate-50 ring-1 ring-slate-200/80",
    focusRing: "focus-visible:ring-emerald-400",
  },
  sheet: {
    heading: "text-green-950",
    selected:
      "border-green-400 bg-green-50 shadow-md ring-2 ring-green-200/80",
    idle:
      "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-green-300 hover:bg-green-50/40 hover:shadow-md",
    iconSelected: "bg-green-100 ring-1 ring-green-200",
    iconIdle: "bg-slate-50 ring-1 ring-slate-200/80",
    focusRing: "focus-visible:ring-green-400",
  },
};

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    options: readonly AiStudioKioskChoiceOption[];
    modelValue: string | null;
    disabled?: boolean;
    theme?: AiStudioKioskTheme;
    ariaLabel?: string;
    testId?: string;
    optionTestIdPrefix?: string;
    showHeader?: boolean;
  }>(),
  {
    disabled: false,
    subtitle: "",
    theme: "image",
    ariaLabel: "選択肢",
    testId: "ai-studio-kiosk-choice-panel",
    optionTestIdPrefix: "ai-studio-kiosk-choice",
    showHeader: true,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const themeClasses = computed(() => THEME_CLASSES[props.theme]);

const choiceClass = (value: string): string => {
  const theme = themeClasses.value;
  const selected = props.modelValue === value;
  return [
    selected ? theme.selected : theme.idle,
    theme.focusRing,
  ].join(" ");
};

const iconStageClass = (value: string): string => {
  const theme = themeClasses.value;
  return props.modelValue === value ? theme.iconSelected : theme.iconIdle;
};

const optionTestId = (value: string): string =>
  `${props.optionTestIdPrefix}-${value}`;

const onSelect = (value: string): void => {
  if (props.disabled || props.modelValue === value) return;
  emit("update:modelValue", value);
};
</script>

<style scoped>
.ai-studio-kiosk-choice-icon--multicolor {
  color: unset;
}
</style>
