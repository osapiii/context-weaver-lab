<template>
  <div
    role="alert"
    :class="[rootClass, customClass]"
  >
    <UIcon
      v-if="resolvedIcon"
      :name="resolvedIcon"
      :class="[iconClass, ui?.icon]"
      aria-hidden="true"
    />
    <div class="min-w-0 flex-1 space-y-0.5">
      <p
        v-if="title || $slots.title"
        :class="[titleClass, ui?.title]"
      >
        <slot name="title">{{ title }}</slot>
      </p>
      <p
        v-if="description && !$slots.description"
        :class="[descriptionClass, ui?.description]"
      >
        {{ description }}
      </p>
      <div
        v-if="$slots.description"
        :class="[descriptionClass, ui?.description]"
      >
        <slot name="description" />
      </div>
      <slot />
      <div
        v-if="normalizedActions.length > 0"
        class="mt-2 flex flex-wrap gap-2"
      >
        <slot name="actions">
          <UButton
            v-for="(action, index) in normalizedActions"
            :key="index"
            size="xs"
            :color="(action.color as 'neutral') || 'neutral'"
            :variant="(action.variant as 'outline') || 'outline'"
            @click="invokeAction(action)"
          >
            {{ action.label }}
          </UButton>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * EN AIstudio 共通アラート — フラット・モノトーン基調.
 *
 * UAlert は使わず、目立ちすぎない業務 UI 向けに自前実装.
 *
 * 利用例:
 *   <EnAlert title="補足" description="..." />
 *   <EnAlert color="warning" title="注意" />
 *   <EnAlert color="error" title="エラー" description="..." />
 *   <EnAlert variant="ai" title="AI 処理中" />
 *   <EnAlert variant="assistant" title="ヒント" />
 */

type AlertVariant =
  | "soft"
  | "outline"
  | "subtle"
  | "solid"
  | "ai"
  | "assistant";

/** info / primary は neutral と同系 (目立たないデフォルト) */
type AlertColor =
  | "neutral"
  | "info"
  | "primary"
  | "success"
  | "warning"
  | "error";

interface AlertUiOverride {
  icon?: string;
  title?: string;
  description?: string;
}

export interface EnAlertAction {
  label: string;
  click?: () => void;
  onClick?: () => void;
  color?: string;
  variant?: string;
}

interface Props {
  variant?: AlertVariant;
  color?: AlertColor;
  title?: string;
  description?: string;
  icon?: string;
  actions?: EnAlertAction[];
  customClass?: string;
  ui?: AlertUiOverride;
}

const normalizedActions = computed(() =>
  (props.actions ?? []).filter((action) => Boolean(action?.label))
);

const invokeAction = (action: EnAlertAction): void => {
  action.click?.();
  action.onClick?.();
};

const props = withDefaults(defineProps<Props>(), {
  variant: "soft",
  color: "neutral",
  title: "",
  description: "",
  icon: "",
  actions: () => [],
  customClass: "",
  ui: () => ({}),
});

/** 表示トーン (色の意味) */
const tone = computed(() => {
  if (props.variant === "ai") return "ai" as const;
  if (props.variant === "assistant") return "assistant" as const;
  switch (props.color) {
    case "warning":
      return "warning" as const;
    case "error":
      return "error" as const;
    case "success":
      return "success" as const;
    case "info":
    case "primary":
    case "neutral":
    default:
      return "neutral" as const;
  }
});

const defaultIcons: Record<string, string> = {
  neutral: "i-heroicons-information-circle",
  warning: "i-heroicons-exclamation-triangle",
  error: "i-heroicons-x-circle",
  success: "i-heroicons-check-circle",
  ai: "i-heroicons-sparkles",
  assistant: "material-symbols:menu-book-outline",
};

const resolvedIcon = computed(() => props.icon || defaultIcons[tone.value] || "");

const rootClass = computed(() => {
  const base =
    "flex gap-2.5 border border-slate-200 bg-white px-3 py-2.5 text-left shadow-none";
  const accent: Record<string, string> = {
    neutral: "border-l-[3px] border-l-slate-300 rounded-sm",
    warning: "border-l-[3px] border-l-purple-400 rounded-sm",
    error: "border-l-[3px] border-l-red-400 rounded-sm",
    success: "border-l-[3px] border-l-emerald-400 rounded-sm",
    ai: "border-l-[3px] border-l-violet-400 rounded-sm bg-violet-50/30",
    assistant: "border-l-[3px] border-l-sky-400 rounded-sm bg-sky-50/25",
  };
  const byVariant: Record<string, string> = {
    outline: "",
    subtle: "!bg-slate-50/50 border-dashed",
    solid: "bg-slate-50",
    soft: "bg-slate-50/60",
  };
  return [
    base,
    accent[tone.value],
    byVariant[props.variant] ?? byVariant.soft,
  ].join(" ");
});

const iconClass = computed(() => {
  const map: Record<string, string> = {
    neutral: "size-4 shrink-0 text-slate-400",
    warning: "size-4 shrink-0 text-purple-600",
    error: "size-4 shrink-0 text-red-500",
    success: "size-4 shrink-0 text-emerald-600",
    ai: "size-4 shrink-0 text-violet-500",
    assistant: "size-4 shrink-0 text-sky-500",
  };
  return map[tone.value];
});

const titleClass = computed(() => {
  const map: Record<string, string> = {
    neutral: "text-sm font-semibold leading-snug text-slate-800",
    warning: "text-sm font-semibold leading-snug text-slate-800",
    error: "text-sm font-semibold leading-snug text-slate-800",
    success: "text-sm font-semibold leading-snug text-slate-800",
    ai: "text-sm font-semibold leading-snug text-slate-800",
    assistant: "text-sm font-semibold leading-snug text-slate-800",
  };
  return map[tone.value];
});

const descriptionClass = computed(() => {
  const map: Record<string, string> = {
    neutral: "text-xs leading-relaxed text-slate-500",
    warning: "text-xs leading-relaxed text-slate-600",
    error: "text-xs leading-relaxed text-slate-600",
    success: "text-xs leading-relaxed text-slate-600",
    ai: "text-xs leading-relaxed text-slate-600",
    assistant: "text-xs leading-relaxed text-slate-600",
  };
  return map[tone.value];
});
</script>
