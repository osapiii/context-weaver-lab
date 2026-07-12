/**
 * ブランド・サービス関連アイコン定義
 *
 * 外部サービスやブランドのロゴアイコン。
 * Google、Slack、その他のサービス連携時に使用。
 *
 * @example
 * ```vue
 * const brandIcons = useBrandIcons()
 * <Icon :name="brandIcons.google" size="24" />
 * ```
 *
 * 参照: https://icon-sets.iconify.design/logos/
 */
export const useBrandIcons = () => {
  return {
    // サービスブランド
    google: 'logos:google-icon',
    slack: 'logos:slack-icon',

    // その他（既存プロジェクト互換性のため維持）
    // 注意: flat-color-iconsは段階的にVSCode Icons/Material Symbolsに移行推奨
    deployment: 'material-symbols:rocket-launch',
  } as const
}
