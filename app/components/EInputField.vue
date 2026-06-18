<script lang="ts" setup>
//#region Props
/**
 * コンポーネントのProps定義
 *
 * @property {string} label - インプットフィールドのラベル（id属性として使用）
 * @property {string | undefined} modelValue - インプットフィールドの値
 * @property {string} type - インプットフィールドのtype属性
 * @property {string} placeholder - プレースホルダーテキスト
 * @property {string} formTopLabel - フォーム上部のラベル表示テキスト
 */
defineProps<{
  label: string;
  modelValue: string | undefined;
  type: string;
  placeholder: string;
  formTopLabel: string;
}>();
//#endregion

//#region Emits
/**
 * コンポーネントのEmits定義
 */
defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
//#endregion
</script>

<template>
  <div class="flex flex-col">
    <label :for="label" class="text-sm font-bold text-gray-700 mb-1">{{
      formTopLabel
    }}</label>
    <input
      :id="label"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      class="border border-gray-400 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    >
  </div>
</template>
