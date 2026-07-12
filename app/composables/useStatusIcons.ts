/**
 * ステータス・状態表示関連アイコン定義
 *
 * VSCode Icons（色付き）とMaterial Symbols（シンプル）を併用。
 * ステータス表示・進行状況・状態表現に適している。
 *
 * @example
 * ```vue
 * const statusIcons = useStatusIcons()
 * // 大きく表示する場合は色付きVSCode Icons
 * <Icon :name="statusIcons.success" size="48" />
 * // バッジ・インラインの場合はシンプルなMaterial
 * <UBadge :icon="statusIcons.successSimple" color="success">完了</UBadge>
 * ```
 *
 * 参照: https://icon-sets.iconify.design/vscode-icons/
 * 参照: https://github.com/material-icons/material-icons
 */
export const useStatusIcons = () => {
  return {
    // 処理ステータス（VSCode: 色付き）
    success: 'vscode-icons:file-type-checkstyle',
    error: 'vscode-icons:file-type-testlint',
    warning: 'vscode-icons:file-type-light-stylelintrc',
    pending: 'vscode-icons:file-type-clock',

    // シンプルステータス（Material: UIに組み込み）
    successSimple: 'material-symbols:check-circle',
    errorSimple: 'material-symbols:error',
    warningSimple: 'material-symbols:warning',
    infoSimple: 'material-symbols:info',

    // 進行状況
    inProgress: 'vscode-icons:file-type-hourglass',
    completed: 'material-symbols:check-circle-outline',
    cancelled: 'material-symbols:cancel',
    finish: 'material-symbols:check-circle',
    complete: 'material-symbols:task-alt',

    // 選択状態・チェック
    checked: 'material-symbols:check-circle',
    unchecked: 'material-symbols:radio-button-unchecked',
    checkmark: 'material-symbols:check',
    cross: 'material-symbols:close',
    alert: 'material-symbols:error',
  } as const
}
