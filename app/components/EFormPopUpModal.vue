<script setup lang="ts">
import EnModal from "@components/EnModal.vue";

//#region Props
/**
 * コンポーネントのプロパティ
 *
 * @property title - モーダルのタイトル
 * @property iconName - アイコン名
 * @property iconColor - アイコンの色
 */
export interface Props {
  title?: string;
  iconName?: string;
  iconColor?: string;
}

withDefaults(defineProps<Props>(), {
  title: "フォームインプットのタイトルを入力します",
  iconName: "i-heroicons-information-circle-20-solid",
  iconColor: "background",
});
//#endregion

//#region State
/**
 * モーダルの開閉状態
 */
const modalIsOpen = defineModel<boolean>("modalIsOpen");
//#endregion
</script>

<template>
  <EnModal
    v-model:open="modalIsOpen"
    :title="title"
    :title-icon="iconName"
    size="3xl"
    header-variant="default"
    padding="md"
  >
    <slot />

    <template #footer>
      <slot name="left-button" />
      <slot name="right-button" />
    </template>
  </EnModal>
</template>
