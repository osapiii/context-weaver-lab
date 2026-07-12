/**
 * ファイル・データタイプ関連アイコン定義
 *
 * VSCode Iconsを中心に、色付きアイコンを優先的に使用。
 * ファイル拡張子・技術スタックの視覚的表現に適している。
 *
 * @example
 * ```vue
 * const fileIcons = useFileIcons()
 * <Icon :name="fileIcons.pdf" size="24" />
 * ```
 *
 * 参照: https://icon-sets.iconify.design/vscode-icons/
 */
export const useFileIcons = () => {
  return {
    // ドキュメントファイル
    pdf: 'vscode-icons:file-type-pdf2',
    word: 'vscode-icons:file-type-word2',
    excel: 'vscode-icons:file-type-excel2',
    powerpoint: 'vscode-icons:file-type-powerpoint2',
    document: 'vscode-icons:file-type-word2',

    // Google Workspace (Drive ショートカット .gdoc / MIME vnd.google-apps.*)
    googleDocs: 'simple-icons:googledocs',
    googleSheets: 'simple-icons:googlesheets',
    googleSlides: 'simple-icons:googleslides',
    googleDrawing: 'material-symbols:draw-outline',
    googleForms: 'simple-icons:googleforms',
    googleDrive: 'logos:google-drive',

    // メディアファイル
    video: 'vscode-icons:file-type-video',
    audio: 'vscode-icons:file-type-audio',
    image: 'vscode-icons:file-type-image',

    // データフォーマット
    json: 'vscode-icons:file-type-json',
    markdown: 'vscode-icons:file-type-markdown',
    // CSV は vscode-icons の現行 set に存在しないので Excel アイコンを流用 (表形式データなので意味も近い)
    csv: 'vscode-icons:file-type-excel2',
    xml: 'vscode-icons:file-type-xml',
    yaml: 'vscode-icons:file-type-yaml',

    // アーカイブ
    zip: 'vscode-icons:file-type-zip',

    // コードファイル
    typescript: 'vscode-icons:file-type-typescript-official',
    javascript: 'vscode-icons:file-type-js-official',
    vue: 'vscode-icons:file-type-vue',
    python: 'vscode-icons:file-type-python',

    // その他
    folder: 'vscode-icons:default-folder',
    folderOpen: 'vscode-icons:default-folder-opened',
    file: 'vscode-icons:default-file',
    requestLog: 'flat-color-icons:list', // リクエストログ（色付き）
  } as const
}
