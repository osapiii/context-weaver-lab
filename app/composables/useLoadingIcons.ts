/**
 * ローディング・アニメーション関連アイコン定義
 *
 * SVG Spinnersを使用した動的なローディング表現。
 * ローディング表示・処理中アニメーション・非同期待機UIに適している。
 *
 * @example
 * ```vue
 * const loadingIcons = useLoadingIcons()
 * // ボタンローディング
 * <UButton :icon="isLoading ? loadingIcons.buttonSpinner : actionIcons.save" :loading="isLoading">
 *   保存
 * </UButton>
 * // 全画面ローディング
 * <Icon :name="loadingIcons.fullScreen" size="64" class="text-primary" />
 * ```
 *
 * 参照: https://www.npmjs.com/package/@iconify-json/svg-spinners
 */
export const useLoadingIcons = () => {
  return {
    // 基本ローディング
    spinner: 'svg-spinners:ring-resize',          // リングタイプ（汎用）
    dots: 'svg-spinners:3-dots-bounce',           // ドットアニメーション
    pulse: 'svg-spinners:pulse-3',                // パルスアニメーション

    // ボタン用（小さめ）
    buttonSpinner: 'svg-spinners:ring-resize',    // ボタン内ローディング

    // 全画面ローディング（大きめ）
    fullScreen: 'svg-spinners:ring-resize',       // フルスクリーンローディング

    // 特殊アニメーション
    bars: 'svg-spinners:bars-rotate-fade',        // バーローテーション
    eclipse: 'svg-spinners:eclipse-half',         // エクリプスアニメーション
    gooey: 'svg-spinners:gooeyBalls-1',          // グーイーボール
  } as const
}
