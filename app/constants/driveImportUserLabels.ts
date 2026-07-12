/**
 * Drive 取り込み進捗 UI — 非エンジニア向け表示ラベル.
 * 内部 step id (mirrorAdd / registerAdd 等) とは別に、画面文言だけここで管理する。
 */
export const DRIVE_IMPORT_USER_LABELS = {
  /** EnStepper のマクロ段階 */
  stepper: {
    prepare: "準備",
    mirror: "クラウド保存",
    register: "素材プールへ反映",
    complete: "完了",
  },
  /** サマリカード見出し */
  summary: {
    mirror: "クラウド保存",
    register: "素材プールへの反映",
    mirrorOpenStorage: "保存先を開く",
  },
  /** Workflow step id → ユーザー向けラベル */
  steps: {
    loadInput: "取り込み内容の読み込み",
    listDriveFolder: "Drive ファイル一覧",
    diffWithMirror: "保存対象の確認",
    mirrorAdd: "クラウドへ保存",
    mirrorRemove: "クラウドから削除",
    diffWithFileSpace: "反映対象の確認",
    registerAdd: "素材プールへ追加",
    registerRemove: "素材プールから削除",
    finalize: "完了処理",
  },
  flow: {
    source: "Google Drive",
    sourceSublabel: "対象ファイル",
    sink: "素材プール",
    sinkSublabel: "ナレッジ素材として利用",
  },
  errors: {
    mirrorFailed: "クラウド保存で",
    registerFailed: "素材プールへの反映で",
  },
} as const;

export function driveImportStepUserLabel(stepId: string): string {
  return (
    DRIVE_IMPORT_USER_LABELS.steps[
      stepId as keyof typeof DRIVE_IMPORT_USER_LABELS.steps
    ] ?? stepId
  );
}
