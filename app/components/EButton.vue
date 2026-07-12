<script setup lang="ts">
//#region Props
/**
 * コンポーネントのProps定義
 *
 * @property {string} label - ボタンのラベルテキスト
 * @property {string} [variant="solid"] - ボタンのバリアント（表示スタイル）
 * @property {string} [color="primary"] - ボタンの色
 * @property {string} [size="lg"] - ボタンのサイズ
 * @property {string} [icon=""] - ボタンに表示するアイコン
 * @property {boolean} [disabled=false] - ボタンの無効化状態
 * @property {string} [type=""] - ボタンのtype属性
 */
export interface Props {
  label: string;
  variant?: "solid" | "outline" | "soft" | "link" | "ghost";
  color?:
    | "primary"
    | "secondary"
    | "warning"
    | "success"
    | "info"
    | "error"
    | "neutral";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  icon?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset" | "";
}

const {
  label = "Click me!",
  color = "primary",
  size = "lg",
  disabled = false,
  variant = "solid",
  type = "",
  icon = "",
} = defineProps<Props>();
//#endregion

//#region Store Access
/**
 * グローバルローディング状態の管理
 */
const globalLoading = useGlobalLoadingStore();
//#endregion
</script>

<template>
  <UButton
    class="justify-center"
    :label="label"
    :color="color"
    :variant="variant"
    :disabled="disabled"
    :size="size"
    :icon="icon"
    :type="type"
    :loading="globalLoading.isLoading"
  />
</template>
