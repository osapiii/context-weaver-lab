import { breakpointsTailwind, useBreakpoints } from "@vueuse/core";

/**
 * デバイス種別判定の共通 composable。
 *
 * EN AIstudio は元々 PC ブラウザ専用だったが、社長がタブレット 1 台で全機能を
 * 完結できるようにするため、画面幅を「スマホ / タブレット / PC」の 3 段階で
 * 判定する。Tailwind の標準ブレークポイント (md=768 / xl=1280) を境界に使う。
 *
 *   - スマホ (phone)   : 幅 < 768px  → 専用の簡易レイアウト (MobileHomePage 等)
 *   - タブレット (tablet): 768px 〜 1279px → PC と同じ admin レイアウトを
 *                          タッチ最適化して提供する (iPad 縦 768 / 横 1024 を含む)
 *   - デスクトップ (desktop): 幅 >= 1280px → 従来どおり
 *
 * 旧 `useIsMobile` (<=768 をモバイル扱い) では iPad 縦 (ちょうど 768px) が
 * スマホ簡易画面に落ちてしまい「タブレットで全機能」が成立しなかった。
 * 本 composable は <768 のみをスマホ、768〜 をタブレット以上として扱う。
 */

/** スマホ / タブレットの境界 (px)。これ未満を「スマホ」とみなす。 */
export const PHONE_MAX_WIDTH = 768;

/** タブレット / デスクトップの境界 (px)。これ以上を「デスクトップ」とみなす。 */
export const DESKTOP_MIN_WIDTH = 1280;

export type DeviceType = "phone" | "tablet" | "desktop";

export const useDeviceType = () => {
  const breakpoints = useBreakpoints(breakpointsTailwind);

  /** 幅 < 768px (md 未満) */
  const isPhone = breakpoints.smaller("md");
  /** 768px 〜 1279px (md 以上 xl 未満) */
  const isTablet = breakpoints.between("md", "xl");
  /** 幅 >= 1280px (xl 以上) */
  const isDesktop = breakpoints.greaterOrEqual("xl");
  /** タブレット以下 (= PC でない). サイドバー自動折りたたみ等の判定に使う */
  const isTabletOrBelow = breakpoints.smaller("xl");

  /**
   * タッチ主体デバイスか (pointer: coarse)。
   * 画面幅とは独立に「指で操作する端末」かを見るため、タップ領域の拡大や
   * マウス前提 UI (ブラウザズーム操作など) の出し分けに使う。
   */
  const isTouch = ref(false);
  if (import.meta.client) {
    const mql = window.matchMedia("(pointer: coarse)");
    const sync = () => {
      isTouch.value = mql.matches;
    };
    sync();
    // Safari 旧仕様の addListener も考慮しつつ標準 API を優先
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", sync);
      onUnmounted(() => mql.removeEventListener("change", sync));
    }
  }

  const deviceType = computed<DeviceType>(() => {
    if (isPhone.value) return "phone";
    if (isTablet.value) return "tablet";
    return "desktop";
  });

  return {
    isPhone,
    isTablet,
    isDesktop,
    isTabletOrBelow,
    isTouch,
    deviceType,
  };
};
