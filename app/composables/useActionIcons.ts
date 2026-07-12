/**
 * 操作アクション関連アイコン定義
 *
 * Material Symbolsを中心に、UIに組み込むアクションアイコンを定義。
 * ボタン・操作アクション・UI統合に適している。
 *
 * @example
 * ```vue
 * const actionIcons = useActionIcons()
 * <UButton :icon="actionIcons.add" label="追加" />
 * ```
 *
 * 参照: https://github.com/material-icons/material-icons
 */
export const useActionIcons = () => {
  return {
    // CRUD操作
    add: 'material-symbols:add-circle-outline',
    edit: 'material-symbols:edit',
    delete: 'material-symbols:delete',
    save: 'material-symbols:save',
    create: 'material-symbols:note-add',
    duplicate: 'material-symbols:content-copy',

    // ナビゲーション
    close: 'material-symbols:close',
    cancel: 'material-symbols:cancel',
    back: 'material-symbols:arrow-back',
    forward: 'material-symbols:arrow-forward',
    menu: 'material-symbols:menu',
    openBrowserTab: 'material-symbols:open-in-new',

    // 表示切り替え
    expand: 'material-symbols:expand-more',
    collapse: 'material-symbols:expand-less',
    visibility: 'material-symbols:visibility',
    visibilityOff: 'material-symbols:visibility-off',
    preview: 'material-symbols:preview',

    // 検索・フィルタ
    search: 'material-symbols:search',
    filter: 'material-symbols:filter-list',
    sort: 'material-symbols:sort',

    // アクション
    download: 'material-symbols:download',
    upload: 'material-symbols:upload',
    share: 'material-symbols:share',
    copy: 'material-symbols:content-copy',
    refresh: 'material-symbols:refresh',
    publish: 'material-symbols:cloud-upload',
    import: 'material-symbols:upload-file',

    // 確認・通知
    check: 'material-symbols:check-circle',
    error: 'material-symbols:error',
    warning: 'material-symbols:warning',
    info: 'material-symbols:info',

    // 認証
    login: 'material-symbols:login',
    logout: 'material-symbols:logout',

    // その他
    trash: 'material-symbols:delete',
    update: 'material-symbols:sync',
    random: 'material-symbols:shuffle',
    reserve: 'material-symbols:schedule',
    max: 'material-symbols:last-page',
    min: 'material-symbols:first-page',
    swap: 'material-symbols:swap-horiz',

    // 実行・計算
    play: 'material-symbols:play-arrow',
    calculator: 'material-symbols:calculate',
    list: 'material-symbols:list',
    settings: 'flat-color-icons:settings', // 設定（色付き）
  } as const
}
