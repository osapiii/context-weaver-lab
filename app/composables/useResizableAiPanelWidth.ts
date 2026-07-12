import { computed, onBeforeUnmount, onMounted, ref } from "vue";

export const AI_PANEL_WIDTH_DEFAULT = 360;
export const AI_PANEL_WIDTH_MIN = 280;
/** ビューポート幅に対する AI パネル最大比率 */
export const AI_PANEL_WIDTH_MAX_VIEWPORT_RATIO = 0.55;

export const AI_PANEL_WIDTH_STORAGE_KEY = "en-aistudio:ai-assistant-panel-width:v1";

function clampWidth(value: number, max: number): number {
  return Math.min(Math.max(value, AI_PANEL_WIDTH_MIN), max);
}

export function getAiPanelMaxWidth(viewportWidth = window.innerWidth): number {
  return Math.max(
    AI_PANEL_WIDTH_MIN,
    Math.floor(viewportWidth * AI_PANEL_WIDTH_MAX_VIEWPORT_RATIO)
  );
}

export function useResizableAiPanelWidth(
  storageKey: string = AI_PANEL_WIDTH_STORAGE_KEY
) {
  const width = ref(AI_PANEL_WIDTH_DEFAULT);
  const isResizing = ref(false);

  let startX = 0;
  let startWidth = AI_PANEL_WIDTH_DEFAULT;

  const maxWidth = ref(
    typeof window !== "undefined" ? getAiPanelMaxWidth() : 720
  );

  const syncMaxAndClamp = (): void => {
    if (typeof window === "undefined") return;
    maxWidth.value = getAiPanelMaxWidth();
    width.value = clampWidth(width.value, maxWidth.value);
  };

  const persistWidth = (): void => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, String(width.value));
  };

  const restoreWidth = (): void => {
    if (typeof window === "undefined") return;
    const saved = Number(window.localStorage.getItem(storageKey));
    if (Number.isFinite(saved)) {
      width.value = clampWidth(saved, maxWidth.value);
    }
  };

  onMounted(() => {
    syncMaxAndClamp();
    restoreWidth();
    window.addEventListener("resize", syncMaxAndClamp);
  });

  onBeforeUnmount(() => {
    if (typeof window === "undefined") return;
    window.removeEventListener("resize", syncMaxAndClamp);
    stopResizeListeners();
  });

  const panelWidthStyle = computed(() => ({
    width: `${width.value}px`,
  }));

  const stopResizeListeners = (): void => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    isResizing.value = false;
  };

  const onPointerMove = (event: PointerEvent): void => {
    const delta = startX - event.clientX;
    width.value = clampWidth(startWidth + delta, maxWidth.value);
  };

  const onPointerUp = (): void => {
    stopResizeListeners();
    persistWidth();
  };

  const onResizePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    isResizing.value = true;
    startX = event.clientX;
    startWidth = width.value;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  const resetWidth = (): void => {
    width.value = AI_PANEL_WIDTH_DEFAULT;
    persistWidth();
  };

  return {
    width,
    isResizing,
    panelWidthStyle,
    onResizePointerDown,
    resetWidth,
  };
}
