<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { defineModel, defineProps, withDefaults } from "vue";
import EnModal from "@components/EnModal.vue";
//#endregion

//#region Props
/**
 * コンポーネントのプロパティ
 *
 * @property type - モーダルのタイプ ("default" | "popup")
 */
export interface Props {
  type?: "default" | "popup";
}

withDefaults(defineProps<Props>(), {
  type: "default",
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
  <!-- Default -->
  <EnModal
    v-if="type == 'default'"
    v-model:open="modalIsOpen"
    title="デフォルトモーダル"
    size="3xl"
    header-variant="default"
    padding="md"
  >
    <div class="space-y-4">
      <p>モーダルの中身</p>
      <slot />
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        size="lg"
        @click="modalIsOpen = false"
      >
        キャンセル
      </UButton>
      <UButton color="primary" size="lg">
        確認
      </UButton>
    </template>
  </EnModal>

  <!-- Popup -->
  <EnModal
    v-if="type == 'popup'"
    v-model:open="modalIsOpen"
    title="お知らせ"
    size="3xl"
    header-variant="default"
    padding="md"
  >
    <div class="space-y-4">
      <div class="text-center">
        <Icon size="60" name="🚀" />
      </div>
      <div class="text-center">
        <p>
          ここに沢山テキスト入れたいと思いますここに沢山テキスト入れたいと思いますここに沢山テキスト入れたいと思いますここに沢山テキスト入れたいと思いますここに沢山テキスト入れたいと思いますここに沢山テキスト入れたいと思います
        </p>
      </div>
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        size="lg"
        @click="modalIsOpen = false"
      >
        キャンセル
      </UButton>
      <UButton color="primary" size="lg" @click="modalIsOpen = false">
        確認
      </UButton>
    </template>
  </EnModal>
</template>
