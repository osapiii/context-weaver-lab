<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { defineProps, withDefaults, defineModel, defineEmits, watch } from "vue";
//#endregion

//#region State
/**
 * テキストエリアの入力値
 */
const formValue = defineModel<string>();
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
 * @property {string} [label="入力フォーム"] - テキストエリアのラベル
 * @property {string} [formTopLabel=""] - フォーム上部のラベル
 * @property {string} [placeholder="入力してください"] - プレースホルダーテキスト
 * @property {boolean} [disabled=false] - テキストエリアの無効化状態
 * @property {string} [width="w-full"] - テキストエリアの幅
 */
export interface Props {
  label?: string;
  formTopLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  width?: string;
}

withDefaults(defineProps<Props>(), {
  placeholder: "入力してください",
  label: "入力フォーム",
  disabled: false,
  formTopLabel: "",
  width: "w-full",
});
//#endregion
</script>

<template>
  <span v-if="formTopLabel" class="text-xs font-bold text-slate-400">{{
    formTopLabel
  }}</span>
  <UTextarea
    v-model="formValue"
    :placeholder="placeholder"
    :disabled="disabled"
  />
</template>
