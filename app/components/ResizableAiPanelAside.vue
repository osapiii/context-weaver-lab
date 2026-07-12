<template>
  <Transition :name="transitionName">
    <aside
      v-if="open"
      class="ai-panel-aside relative flex flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
      :class="[
        expanded
          ? 'min-w-0 flex-1 basis-0 w-full max-w-none self-stretch'
          : 'flex-shrink-0',
        isResizing && 'ai-panel-aside--resizing',
        asideClass,
      ]"
      :style="expanded ? undefined : panelWidthStyle"
    >
      <div
        v-if="resizable"
        role="separator"
        aria-orientation="vertical"
        aria-label="AI アシスタントパネルの幅を変更"
        :aria-valuenow="width"
        aria-valuemin="280"
        :aria-valuemax="maxWidthLabel"
        tabindex="0"
        class="ai-panel-resize-handle"
        :class="{ 'ai-panel-resize-handle--active': isResizing }"
        @pointerdown="onResizePointerDown"
        @dblclick.prevent="resetWidth"
        @keydown.left.prevent="nudgeWidth(16)"
        @keydown.right.prevent="nudgeWidth(-16)"
        @keydown.home.prevent="resetWidth"
      />
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <slot />
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import {
  AI_PANEL_WIDTH_STORAGE_KEY,
  getAiPanelMaxWidth,
  useResizableAiPanelWidth,
} from "@composables/useResizableAiPanelWidth";

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** true: AI のみレイアウト — 全幅表示・リサイズハンドル非表示 */
    expanded?: boolean;
    /** false: 固定幅のみ (expanded と併用不可) */
    resizable?: boolean;
    /** Transition 名 (親の ai-panel-slide と揃える) */
    transitionName?: string;
    asideClass?: string;
    storageKey?: string;
  }>(),
  {
    expanded: false,
    resizable: true,
    transitionName: "ai-panel-slide",
    asideClass: "",
    storageKey: AI_PANEL_WIDTH_STORAGE_KEY,
  }
);

const {
  width,
  isResizing,
  panelWidthStyle,
  onResizePointerDown,
  resetWidth,
} = useResizableAiPanelWidth(props.storageKey);

const maxWidthLabel = getAiPanelMaxWidth();

const nudgeWidth = (delta: number): void => {
  const max = getAiPanelMaxWidth();
  width.value = Math.min(
    Math.max(width.value + delta, 280),
    max
  );
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      props.storageKey ?? AI_PANEL_WIDTH_STORAGE_KEY,
      String(width.value)
    );
  }
};
</script>

<style scoped>
.ai-panel-aside {
  max-width: 55vw;
}

.ai-panel-aside--resizing {
  transition: none !important;
}

.ai-panel-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 30;
  width: 6px;
  transform: translateX(-50%);
  cursor: col-resize;
  touch-action: none;
  background: transparent;
}

.ai-panel-resize-handle::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  border-radius: 1px;
  background: transparent;
  transition: background 120ms ease;
}

.ai-panel-resize-handle:hover::after,
.ai-panel-resize-handle--active::after,
.ai-panel-resize-handle:focus-visible::after {
  background: rgb(56 189 248 / 0.75);
}

.ai-panel-resize-handle:focus-visible {
  outline: none;
}
</style>
