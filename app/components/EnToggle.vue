<template>
  <UTabs
    :model-value="selectedValue"
    :items="tabItems"
    :content="false"
    variant="pill"
    :size="size"
    :color="tabsColor"
    value-key="value"
    label-key="label"
    :class="['en-aistudio-toggle inline-flex', customClass]"
    :ui="mergedUi"
    @update:model-value="onUpdate"
  >
    <template #leading="{ item }">
      <UIcon
        v-if="item.icon"
        :name="String(item.icon)"
        class="h-4 w-4 shrink-0"
        aria-hidden="true"
      />
    </template>
    <template #default="{ item }">
      <span class="whitespace-nowrap" :title="String(item.label)">
        {{ resolveLabel(item as EnToggleItem) }}
      </span>
    </template>
    <template #trailing="{ item }">
      <EnBadge
        v-if="item.count !== undefined"
        size="sm"
        :color="selectedValueText === String(item.value) ? 'primary' : 'neutral'"
        variant="soft"
        custom-class="tabular-nums"
      >
        {{ item.count }}
      </EnBadge>
    </template>
  </UTabs>
</template>

<script setup lang="ts">
/**
 * EN AIstudio 共通セグメントトグル（モード切替用）.
 *
 * Nuxt UI USelectMenu ではなく UTabs を `content=false` で使い、
 * 横並びの pill トグルとして表示する（公式: Toggle-only control）。
 *
 * @see https://ui.nuxt.com/components/tabs#content
 */
import { computed } from "vue";
import EnBadge from "@components/EnBadge.vue";

export type EnToggleItem = {
  value: string;
  label: string;
  shortLabel?: string;
  icon?: string;
  count?: number;
  disabled?: boolean;
};

type ToggleSize = "xs" | "sm" | "md";
/** default = 明るい背景 / inverse = ダークヘッダー上 */
type ToggleTone = "default" | "inverse";
type ToggleLabelMode = "label" | "shortLabel";

const modelValue = defineModel<string | number | undefined>();

const props = withDefaults(
  defineProps<{
    items: EnToggleItem[];
    size?: ToggleSize;
    tone?: ToggleTone;
    labelMode?: ToggleLabelMode;
    customClass?: string;
  }>(),
  {
    size: "sm",
    tone: "default",
    labelMode: "label",
    customClass: "",
  }
);

const tabItems = computed(() =>
  props.items.map((item) => ({
    value: item.value,
    label: item.label,
    shortLabel: item.shortLabel,
    icon: item.icon,
    count: item.count,
    disabled: item.disabled,
  }))
);

const selectedValue = computed(() =>
  modelValue.value == null ? undefined : String(modelValue.value)
);

const selectedValueText = computed(() => selectedValue.value ?? "");

const tabsColor = computed(() =>
  props.tone === "inverse" ? "neutral" : "primary"
);

const mergedUi = computed(() => {
  if (props.tone === "inverse") {
    return {
      root: "inline-flex flex-row items-center",
      list: "inline-flex flex-row items-center gap-0.5 rounded-lg bg-white/10 p-0.5 ring-1 ring-white/15",
      trigger:
        "shrink-0 grow-0 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white/70 hover:text-white data-[state=inactive]:text-white/70 data-[state=active]:text-white",
      indicator: "rounded-md bg-white/20 shadow-none inset-y-0.5",
      label: "whitespace-nowrap",
    };
  }

  return {
    root: "inline-flex flex-row items-center",
    list: "inline-flex flex-row items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700",
    trigger:
      "shrink-0 grow-0 px-2.5 py-1 text-xs font-medium whitespace-nowrap",
    indicator: "inset-y-0.5 rounded-md",
    label: "whitespace-nowrap",
  };
});

const resolveLabel = (item: EnToggleItem): string =>
  props.labelMode === "shortLabel"
    ? item.shortLabel?.trim() || item.label
    : item.label;

const onUpdate = (value: string | number): void => {
  modelValue.value = value;
};
</script>
