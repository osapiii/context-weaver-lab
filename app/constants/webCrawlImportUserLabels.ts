/**
 * Web ページ取り込み進捗 UI — ユーザー向け表示ラベル
 */
export const WEB_CRAWL_IMPORT_USER_LABELS = {
  stepper: {
    prepare: "準備",
    crawl: "ページ読み込み",
    upload: "クラウド保存",
    register: "AI 登録",
    complete: "完了",
  },
  summary: {
    storage: "クラウド保存",
    register: "AI への登録",
    storageOpen: "保存先を開く",
  },
  steps: {
    loadInput: "取り込み内容の読み込み",
    crawl: "ページを読み込み",
    uploadToGcs: "クラウドへ保存",
    registerToFileSpace: "AI に登録",
    finalize: "完了処理",
  },
  flow: {
    source: "Web ページ",
    sink: "AI ナレッジ",
  },
  discovering: {
    banner:
      "サイト内のリンクをたどり、取得するページを選定しています",
    entryLabel: "開始 URL",
    entryHint: "この URL からリンクをたどって対象ページを選定します",
    placeholder: "取得候補を探索中…",
    stepper: "サイト内のページを探索中…",
    subtitle: "取得対象ページを探索しています",
    pageCount: "探索中…",
    badge: "探索中",
  },
  preparing: {
    banner:
      "取り込み内容を確認しています。完了後、サイト内のページ探索を開始します",
    subtitle: "取り込みを準備しています",
    pageCount: "準備中…",
    badge: "準備中",
  },
  cancel: {
    button: "取り込みを中止",
    confirm: "進行中の Web ページ取り込みを中止しますか？",
    inProgress: "中止しています…",
  },
} as const;

export function webCrawlStepUserLabel(stepId: string): string {
  return (
    WEB_CRAWL_IMPORT_USER_LABELS.steps[
      stepId as keyof typeof WEB_CRAWL_IMPORT_USER_LABELS.steps
    ] ?? stepId
  );
}
