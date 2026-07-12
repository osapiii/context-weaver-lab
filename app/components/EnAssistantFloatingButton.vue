<template>
  <Transition name="fade-scale">
    <div
      v-if="isVisible"
      class="fixed right-6 bottom-6 z-50 flex flex-col items-center gap-1.5"
    >
      <!-- ショートカットキー (KBD) -->
      <div
        class="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[10px] whitespace-nowrap pointer-events-none"
      >
        <UKbd class="text-[10px]">{{ isMac ? "⌘" : "Ctrl" }}</UKbd>
        <span>+</span>
        <UKbd class="text-[10px]">/</UKbd>
      </div>

      <!-- フローティングボタン -->
      <UTooltip :text="tooltipText" :delay-duration="200">
        <button
          type="button"
          class="en-aistudio-assistant-float-btn relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center"
          :aria-label="tooltipText"
          @click="onClick"
        >
          <!-- 多重 pulse ring (sky 系で「操作ガイド (案内)」を視覚化) -->
          <span
            class="absolute inset-0 rounded-full bg-sky-300/40 ring-pulse"
            aria-hidden="true"
          />
          <span
            class="absolute inset-0 rounded-full bg-blue-400/30 ring-pulse-2"
            aria-hidden="true"
          />

          <!-- グラデ本体: sky → blue (= MEMORY 規約: 操作アシスタント / 案内 = sky/blue) -->
          <span
            class="relative inline-flex w-full h-full rounded-full bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 shadow-[0_8px_24px_-4px_rgba(14,165,233,0.45)] items-center justify-center transition-transform duration-300"
          >
            <UIcon
              name="material-symbols:menu-book-rounded"
              class="w-7 h-7 text-white transition-transform duration-300"
            />
          </span>
        </button>
      </UTooltip>

      <!-- ラベル -->
      <div
        class="px-1.5 py-0.5 rounded-md bg-white/85 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm text-[10px] font-semibold text-sky-700 dark:text-sky-300 leading-none pointer-events-none"
      >
        操作ガイド
      </div>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
/**
 * EN AIstudio 操作ガイド FAB.
 *
 * 役割: EN AIstudio の使い方を AI に質問する「操作ガイド専用」エントリ.
 * 経営相談・文書生成・画像生成等の業務系 AI ジョブは AIスタジオから起動するため、
 * この FAB は **操作ガイドだけ** を扱う (MEMORY 規約: 操作アシスタント = sky/blue).
 *
 * - Cmd+/ / Ctrl+/ で toggle (経営相談の Cmd+K と競合しない)
 * - 配色 sky → blue + 本アイコン (`menu-book`) で「ガイド / マニュアル」を明示
 */

const store = useEnAiStudioAssistantStore();

const isMac = computed(() => {
  if (typeof navigator === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
});

// パネルが開いている時はその overlay がこのボタンを覆うので非表示。
const isVisible = computed(() => !store.isOpen);

const tooltipText = computed(
  () => `操作ガイドを開く — EN AIstudio の使い方を質問 (${isMac.value ? "⌘" : "Ctrl"}+/)`
);

const onClick = () => {
  store.openFreshGuide();
};

const onKeydown = (e: KeyboardEvent) => {
  if (!(e.metaKey || e.ctrlKey)) return;
  if (e.key !== "/" && e.code !== "Slash") return;
  if (e.isComposing) return;

  e.preventDefault();
  if (store.isOpen) {
    store.close();
  } else {
    store.openFreshGuide();
  }
};

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onKeydown);
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", onKeydown);
  }
});
</script>

<style scoped>
.en-aistudio-assistant-float-btn {
  transition: transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.en-aistudio-assistant-float-btn:hover {
  transform: scale(1.06);
}
.en-aistudio-assistant-float-btn:active {
  transform: scale(0.96);
}

.ring-pulse {
  animation: ring-pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.ring-pulse-2 {
  animation: ring-pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  animation-delay: 1.2s;
}
@keyframes ring-pulse {
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  80%,
  100% {
    transform: scale(1.65);
    opacity: 0;
  }
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

@media (prefers-reduced-motion: reduce) {
  .ring-pulse,
  .ring-pulse-2 {
    animation: none;
  }
  .en-aistudio-assistant-float-btn,
  .en-aistudio-assistant-float-btn:hover,
  .en-aistudio-assistant-float-btn:active {
    transition: none;
    transform: none;
  }
}
</style>
