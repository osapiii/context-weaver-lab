<script setup lang="ts">
//#region Imports - 外部ライブラリ
import {
  computed,
  defineModel,
  defineProps,
  toRefs,
  withDefaults,
} from "vue";
import EnModal from "@components/EnModal.vue";
//#endregion

//#region Props
/**
 * コンポーネントのプロパティ
 *
 * @property mainText - メインテキスト
 * @property iconName - アイコン名
 * @property iconColor - アイコンの色
 */
export interface Props {
  mainText?: string;
  iconName?: string;
  iconColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  mainText: "好きなテキストを入力できます。",
  iconName: "i-heroicons-x-circle-16-solid",
  iconColor: "background",
});

const { mainText, iconName, iconColor } = toRefs(props);

const iconColorClass = computed(() => {
  if (!iconColor.value) {
    return "";
  }
  return iconColor.value.startsWith("text-")
    ? iconColor.value
    : `text-${iconColor.value}-500`;
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
    size="3xl"
    header-variant="default"
    padding="md"
  >
    <template #title>
      <div class="flex items-center gap-3">
        <UIcon
          v-if="iconName"
          :name="iconName"
          :class="['w-5 h-5', iconColorClass]"
        />
        <h2 class="text-base font-bold text-slate-900 whitespace-pre-line">
          {{ mainText }}
        </h2>
      </div>
    </template>

    <div class="space-y-4">
      <slot name="main-content" />
    </div>

    <template #footer>
      <slot name="left-button" />
      <slot name="right-button" />
    </template>
  </EnModal>
</template>
