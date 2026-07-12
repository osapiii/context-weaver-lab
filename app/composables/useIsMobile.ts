import { PHONE_MAX_WIDTH } from "./useDeviceType";

/**
 * スマホ (= 簡易レイアウト対象) 判定の composable。
 *
 * 「スマホかどうか」= 画面幅が 768px 未満。768px ちょうど (iPad 縦) を含む
 * タブレットは PC と同じ admin レイアウト (タッチ最適化済み) を使うため、
 * ここでは「スマホ専用」だけを true にする。デバイス 3 段階の細かい判定が
 * 必要な場合は `useDeviceType` を使う。
 *
 * 旧実装は `window.innerWidth <= 768` で iPad 縦をスマホ扱いしていたが、
 * タブレットで全機能を使えるようにするため `< 768` (strict) に変更した。
 */
export const useIsMobile = () => {
  const isMobile = ref(false);

  // クライアントサイドでのみ実行
  if (import.meta.client) {
    const checkMobile = () => {
      isMobile.value = window.innerWidth < PHONE_MAX_WIDTH;
    };

    // 初回チェック
    checkMobile();

    // リサイズ時に再チェック
    window.addEventListener("resize", checkMobile);

    // クリーンアップ
    onUnmounted(() => {
      window.removeEventListener("resize", checkMobile);
    });
  }

  return {
    isMobile: readonly(isMobile),
  };
};
