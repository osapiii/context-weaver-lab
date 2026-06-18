<template>
  <USelectMenu
    :model-value="modelValue as any"
    :items="(items as any)"
    :multiple="multiple"
    :size="size"
    :placeholder="placeholder"
    :value-key="valueKey"
    :label-key="labelKey"
    :filter-fields="filterFields"
    :search-input="searchInput"
    :default-open="defaultOpen"
    :open="open"
    :disabled="disabled"
    :loading="loading"
    :ui="mergedUi"
    :class="['w-full', customClass]"
    @update:model-value="(v: unknown) => $emit('update:modelValue', v)"
    @update:open="(v: boolean) => $emit('update:open', v)"
  >
    <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps" />
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
/**
 * EN AIstudio 共通セレクトメニュー.
 *
 * USelectMenu の繰り返し設定:
 *   - trailingIcon の rotate-180 アニメーション (3 箇所で同一)
 *   - `class="w-full"` (analysis 系で頻出)
 *   - multiple selection の boilerplate
 * を集約した薄ラッパー.
 *
 * 利用例:
 *   <EnSelectMenu
 *     v-model="selectedItems"
 *     :items="items"
 *     :multiple="true"
 *     placeholder="選択"
 *   />
 *
 *   <!-- rotate アニメーションを切る (静的アイコン) -->
 *   <EnSelectMenu
 *     v-model="value"
 *     :items="items"
 *     :animated-icon="false"
 *   />
 */

type SelectMenuSize = "xs" | "sm" | "md" | "lg" | "xl";

interface Props {
  modelValue: unknown;
  items: unknown[];
  multiple?: boolean;
  size?: SelectMenuSize;
  placeholder?: string;
  valueKey?: string;
  labelKey?: string;
  /** trailing アイコンの開閉アニメーション (rotate-180). デフォルト有効 */
  animatedIcon?: boolean;
  /** :ui の追加マージ (ui 内 trailingIcon は internal で上書きされる) */
  ui?: Record<string, string>;
  /** w-full は内部固定. layout 系の追加 class のみ受け付ける */
  customClass?: string;
  /** Combobox の検索対象フィールド (USelectMenu filter-fields) */
  filterFields?: string[];
  /**
   * 検索入力の表示・カスタム (USelectMenu search-input).
   * false で非表示。未指定時は Nuxt UI デフォルト（検索あり）。
   */
  searchInput?: boolean | Record<string, unknown>;
  /** 初回表示でメニューを開く */
  defaultOpen?: boolean;
  /** 開閉状態 (v-model:open) */
  open?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  size: "md",
  placeholder: "",
  valueKey: undefined,
  labelKey: undefined,
  animatedIcon: true,
  ui: () => ({}),
  customClass: "",
  filterFields: undefined,
  searchInput: undefined,
  defaultOpen: false,
  open: undefined,
  disabled: false,
  loading: false,
});

defineEmits<{
  "update:modelValue": [value: unknown];
  "update:open": [value: boolean];
}>();

const mergedUi = computed<Record<string, string>>(() => {
  const ui: Record<string, string> = { ...props.ui };
  if (props.animatedIcon && !ui.trailingIcon) {
    ui.trailingIcon =
      "group-data-[state=open]:rotate-180 transition-transform duration-200";
  }
  return ui;
});
</script>
