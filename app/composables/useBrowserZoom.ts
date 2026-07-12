/**
 * ブラウザ標準のページズームを案内・補助する。
 *
 * 旧実装の `document.body.style.zoom` は viewport 計算と相性が悪く
 * スクロール領域が欠けるため廃止。表示倍率はブラウザに任せる。
 * (JS からブラウザズームを確実に変更する標準 API はない)
 */

export const LEGACY_APP_ZOOM_STORAGE_KEY = "zoomLevel";

export type BrowserZoomAction = "in" | "out" | "reset";

export function clearLegacyAppZoom(): void {
  if (typeof document === "undefined") return;
  document.body.style.zoom = "";
  document.body.style.minHeight = "";
  try {
    localStorage.removeItem(LEGACY_APP_ZOOM_STORAGE_KEY);
  } catch {
    /* private mode 等 */
  }
}

function dispatchBrowserZoomShortcut(
  action: BrowserZoomAction,
  isMac: boolean
): void {
  if (typeof document === "undefined") return;

  const metaKey = isMac;
  const ctrlKey = !isMac;

  const spec: Record<
    BrowserZoomAction,
    { key: string; code: string; shiftKey?: boolean }
  > = {
    in: { key: "=", code: "Equal" },
    out: { key: "-", code: "Minus" },
    reset: { key: "0", code: "Digit0" },
  };

  const { key, code, shiftKey = false } = spec[action];
  const init: KeyboardEventInit = {
    key,
    code,
    ctrlKey,
    metaKey,
    shiftKey,
    bubbles: true,
    cancelable: true,
  };

  // ブラウザが合成イベントを無視する場合もあるが、横取りしない実装のため送るのみ
  document.dispatchEvent(new KeyboardEvent("keydown", init));
  document.dispatchEvent(new KeyboardEvent("keyup", init));
}

export function useBrowserZoom() {
  const isMac = computed(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
  });

  const modKey = computed(() => (isMac.value ? "⌘" : "Ctrl"));

  const zoomIn = (): void => {
    dispatchBrowserZoomShortcut("in", isMac.value);
  };

  const zoomOut = (): void => {
    dispatchBrowserZoomShortcut("out", isMac.value);
  };

  const resetZoom = (): void => {
    dispatchBrowserZoomShortcut("reset", isMac.value);
  };

  onMounted(() => {
    clearLegacyAppZoom();
  });

  return {
    modKey,
    zoomIn,
    zoomOut,
    resetZoom,
    clearLegacyAppZoom,
  };
}
