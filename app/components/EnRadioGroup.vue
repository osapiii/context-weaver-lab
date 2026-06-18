<template>
  <UCheckboxGroup
    v-if="multiple"
    :model-value="modelValue"
    :items="items"
    :variant="variant"
    :color="color"
    :value-key="valueKey"
    :label-key="labelKey"
    :description-key="descriptionKey"
    :ui="mergedUi"
    @update:model-value="onCheckboxModelUpdate"
  />
  <!--
    URadioGroup (Nuxt UI 4.0.1) は update:modelValue を親へ再 emit しないため
    RadioGroupRoot を直接利用する (https://ui.nuxt.com/components/radio-group)
  -->
  <RadioGroupRoot
    v-else
    :id="radioId"
    :model-value="modelValue"
    :orientation="orientation"
    :disabled="disabled"
    class="w-full"
    @update:model-value="onRadioModelUpdate"
  >
    <fieldset :class="mergedUi.fieldset" class="w-full border-0 p-0 m-0 min-w-0">
      <Label
        v-for="item in normalizedRadioItems"
        :key="String(item.value)"
        :for="item.id"
        :class="radioItemClass(item)"
      >
        <div
          class="flex gap-2"
          :class="item.description ? 'items-start' : 'items-center'"
        >
          <RadioGroupItem
            :id="item.id"
            :value="item.value"
            :disabled="item.disabled"
            :class="[
              'size-4 shrink-0 rounded-full border border-accented text-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning data-[state=checked]:border-warning',
              item.description ? 'mt-1' : '',
            ]"
          >
            <RadioGroupIndicator
              class="flex size-full items-center justify-center after:size-1.5 after:rounded-full after:bg-warning"
            />
          </RadioGroupItem>

          <div v-if="item.label || item.description" class="min-w-0 flex-1">
            <p
              v-if="item.label"
              :class="mergedUi.label"
            >
              {{ item.label }}
            </p>
            <p
              v-if="item.description"
              :class="mergedUi.description"
            >
              {{ item.description }}
            </p>
          </div>
        </div>
      </Label>
    </fieldset>
  </RadioGroupRoot>
</template>

<script setup lang="ts">
/**
 * EnRadioGroup — 「複数 or 単一選択」のラジオ/チェックボックス系を 1 つの
 * API で扱う共通コンポーネント.
 *
 *  - `multiple=false` (default): RadioGroupRoot (単一選択)
 *  - `multiple=true`           : UCheckboxGroup (複数選択)
 */
import { computed, useId } from "vue";
import {
  RadioGroupRoot,
  RadioGroupItem,
  RadioGroupIndicator,
  Label,
} from "reka-ui";

type AcceptableValue = string | number | boolean;
type CheckboxGroupColor =
  | "primary"
  | "secondary"
  | "success"
  | "info"
  | "warning"
  | "error"
  | "neutral"
  | (string & {});
type Variant = "list" | "card" | "table";
type Columns = 1 | 2 | 3 | 4;
type Orientation = "horizontal" | "vertical";

interface Props {
  modelValue: AcceptableValue | AcceptableValue[] | null | undefined;
  items: Array<Record<string, unknown>>;
  multiple?: boolean;
  variant?: Variant;
  columns?: Columns;
  color?: CheckboxGroupColor;
  valueKey?: string;
  labelKey?: string;
  descriptionKey?: string;
  emphasizeLabel?: boolean;
  orientation?: Orientation;
  disabled?: boolean;
  ui?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  variant: "card",
  columns: 1,
  color: "primary",
  valueKey: "value",
  labelKey: "label",
  descriptionKey: "description",
  emphasizeLabel: true,
  orientation: "vertical",
  disabled: false,
  ui: () => ({}),
});

const emit = defineEmits<{
  "update:modelValue": [
    value: AcceptableValue | AcceptableValue[] | null | undefined,
  ];
}>();

const radioId = useId();

const gridClass = computed(() => {
  if (props.orientation === "horizontal") {
    if (props.columns === 1) {
      return "flex flex-row flex-wrap items-stretch gap-3 w-full";
    }
    const horizontalMap: Record<Exclude<Columns, 1>, string> = {
      2: "grid grid-cols-2 gap-3 w-full",
      3: "grid grid-cols-2 md:grid-cols-3 gap-3 w-full",
      4: "grid grid-cols-2 lg:grid-cols-4 gap-3 w-full",
    };
    return horizontalMap[props.columns as Exclude<Columns, 1>];
  }

  if (props.columns === 1) return "flex flex-col gap-3 w-full";
  const map: Record<Exclude<Columns, 1>, string> = {
    2: "grid grid-cols-1 sm:grid-cols-2 gap-3 w-full",
    3: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full",
    4: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full",
  };
  return map[props.columns as Exclude<Columns, 1>];
});

const mergedUi = computed<Record<string, string>>(() => {
  const base: Record<string, string> = {
    fieldset: gridClass.value,
    label: props.emphasizeLabel
      ? "block text-base font-bold text-default leading-snug"
      : "block font-medium text-default",
    description: props.emphasizeLabel
      ? "text-xs text-muted leading-relaxed mt-1"
      : "text-sm text-muted",
  };
  return { ...base, ...props.ui };
});

interface NormalizedRadioItem {
  id: string;
  value: AcceptableValue;
  label?: string;
  description?: string;
  disabled?: boolean;
  class?: string;
}

function readField(item: Record<string, unknown>, key: string): unknown {
  return item[key];
}

function normalizeRadioItem(
  item: Record<string, unknown> | string | number | null
): NormalizedRadioItem {
  if (item === null) {
    return { id: `${radioId}:null`, value: "" };
  }
  if (typeof item === "string" || typeof item === "number" || typeof item === "bigint") {
    const s = String(item);
    return { id: `${radioId}:${s}`, value: s, label: s };
  }
  const value = readField(item, props.valueKey) as AcceptableValue;
  const label = readField(item, props.labelKey) as string | undefined;
  const description = readField(item, props.descriptionKey) as string | undefined;
  return {
    id: `${radioId}:${String(value)}`,
    value,
    label,
    description,
    disabled: item.disabled as boolean | undefined,
    class: item.class as string | undefined,
  };
}

const normalizedRadioItems = computed(() =>
  (props.items ?? []).map((item) =>
    normalizeRadioItem(item as Record<string, unknown>)
  )
);

function radioItemClass(item: NormalizedRadioItem): string {
  const parts = [
    props.orientation === "horizontal" && props.columns === 1
      ? "block flex-1 min-w-[min(100%,14rem)]"
      : "block w-full",
  ];
  if (props.variant === "card") {
    parts.push(
      "cursor-pointer rounded-lg border border-muted p-3 transition-colors",
      "hover:border-warning/60 data-[state=checked]:border-warning data-[state=checked]:bg-warning/5"
    );
  }
  if (item.class) parts.push(item.class);
  if (props.ui?.item) parts.push(props.ui.item);
  return parts.join(" ");
}

const onRadioModelUpdate = (
  value: AcceptableValue | null | undefined
): void => {
  emit("update:modelValue", value ?? undefined);
};

const onCheckboxModelUpdate = (
  value: AcceptableValue | AcceptableValue[] | null | undefined
): void => {
  emit("update:modelValue", value);
};
</script>
