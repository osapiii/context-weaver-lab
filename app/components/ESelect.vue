<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { defineProps, withDefaults, defineModel, defineEmits, watch } from "vue";
//#endregion

//#region State
/**
 * フォームの選択値
 */
const formValue = defineModel<
  | string
  | { label: string; id: string }
  | { name: string; id: string }
  | { value: string; label: string }
  | string[]
>();
//#endregion

//#region Emits
/**
 * コンポーネントのEmits定義
 */
const emit = defineEmits(["changeFormValue"]);
//#endregion

//#region Watch
/**
 * フォーム値の変更を監視し、親コンポーネントに通知
 */
watch(formValue, (newValue) => {
  emit("changeFormValue", newValue);
});
//#endregion

//#region Props
/**
 * コンポーネントのProps定義
 *
 * @property {string} [label="選択フォーム"] - セレクトのラベル
 * @property {Array} options - セレクトの選択肢
 * @property {string} [size="md"] - セレクトのサイズ
 * @property {string} [icon=""] - セレクトに表示するアイコン
 * @property {boolean} [disabled=false] - セレクトの無効化状態
 * @property {string} [placeholder="選択してください"] - プレースホルダーテキスト
 * @property {string} [formTopLabel=""] - フォーム上部のラベル
 */
export interface Props {
  label?: string;
  options:
    | string[]
    | {
        id: string;
        label: string;
        href?: string;
        target?: string;
        avatar?: { src: string };
      }[]
    | {
        id: string;
        name: string;
      }[]
    | {
        value: string;
        label: string;
      }[];
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  icon?: string;
  disabled?: boolean;
  placeholder?: string;
  formTopLabel?: string;
}

withDefaults(defineProps<Props>(), {
  size: "md",
  options: () => ["Option 1", "Option 2", "Option 3"],
  icon: "",
  label: "選択フォーム",
  disabled: false,
  placeholder: "選択してください",
  formTopLabel: "",
});
//#endregion
</script>

<template>
  <span v-if="formTopLabel" class="text-xs font-bold text-slate-400">{{
    formTopLabel
  }}</span>
  <EnSelectMenu
    v-model="formValue"
    :options="options"
    :size="size"
    :icon="icon"
    :disabled="disabled"
    :ui="{
      input:
        'bg-red-100 border-red-500 text-red-900 placeholder-red-500 focus:ring-red-500 focus:border-red-500',
    }"
  />
</template>
