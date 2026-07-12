<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { defineProps, withDefaults } from "vue";
import "vue-loaders/dist/vue-loaders.css";
//#endregion

//#region Props
/**
 * コンポーネントのProps定義
 *
 * @property {boolean} [active=false] - ローディング表示の有効/無効
 * @property {string} [variant="spinner"] - ローディングアニメーションのバリアント
 * @property {string} [color="#008080"] - ローディングアニメーションの色
 */
export interface Props {
  active: boolean;
  message?: string;
  variant?: "spinner" | "ring";
  color?: string;
}

withDefaults(defineProps<Props>(), {
  active: false,
  message: "",
  variant: "spinner",
  color: "#008080",
});
//#endregion
</script>

<template>
  <transition name="fade">
    <div v-if="active" class="fullscreen-loading">
      <div class="loading-panel">
        <vue-loaders name="ball-scale-ripple" color="#34ebc0" scale="1" />
        <p v-if="message" class="loading-message">
          {{ message }}
        </p>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fullscreen-loading {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.1);
  z-index: 9999;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

.loading-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 2rem;
  border-radius: 0.75rem;
  background-color: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.loading-message {
  margin: 0;
  max-width: 20rem;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  line-height: 1.5;
}
</style>
