/**
 * MasterEditorDataSource
 *
 * 「マスタの行データ」を Editor に流し込む抽象アダプタ。
 *
 * 同じ MasterEditor コンポーネントを以下の文脈で再利用するため、
 * Editor 内に `if (mode === "draft")` 等の分岐を入れずに済む:
 *
 *   - Draft 文脈 (AIマスタ登録)  -> DraftMasterDataSource
 *   - 本番マスタ管理画面          -> ProductionMasterDataSource (Phase 2)
 *
 * 設計原則:
 *   - DataSource は「現在の行集合」と「列定義」と「commit/AI 受け入れ」だけを持つ
 *   - Editor は DataSource の意味論 (全置換 vs patch) を一切知らない
 *   - AI 連携は acceptAIRevision で 1 つの口にする (chatRevise 等の実装を隠蔽)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** セル/列の型ヒント。Editor 内のセルレンダラ/エディタの選択に使う */
export type MasterEditorColumnKind =
  | "text"
  | "number"
  | "select"
  /** 取引先など: ロゴ + 名称 + 検索付き USelectMenu エディタ */
  | "partnerSelect"
  | "date"
  | "datetime";

export interface MasterEditorSelectOption {
  value: string;
  label: string;
}

/** partnerSelect 列の選択肢 (value-key=id) */
export interface MasterEditorPartnerSelectOption {
  id: string;
  label: string;
  code: string;
  brandImageUrl?: string;
}

/**
 * セルレンダラーが受け取るパラメータ (AG Grid から薄くマップ)。
 * フレームワーク非依存にするため value と data だけを公開する。
 */
export interface MasterEditorCellRendererParams {
  value: unknown;
  data: Record<string, unknown>;
}

/** セルレンダラーの戻り値 — HTML 文字列 / DOM ノード */
export type MasterEditorCellRendererResult = string | HTMLElement;

/**
 * 1 列の定義。AG Grid の ColDef に変換される (Editor 側で吸収)。
 * AG Grid 依存はここに漏らさない — フレームワーク差し替えに備える。
 */
export interface MasterEditorColumnDef {
  /** 行データ内のキー */
  field: string;
  /** 列ヘッダ */
  headerName: string;
  /** セル型ヒント (デフォルト text) */
  kind?: MasterEditorColumnKind;
  /** select 型の選択肢 */
  options?: MasterEditorSelectOption[];
  /** partnerSelect 型の選択肢 */
  partnerOptions?: MasterEditorPartnerSelectOption[];
  /** 必須列。空文字は許可しないバリデーションが効く */
  required?: boolean;
  /** デフォルト width (px)。指定なしは自動 */
  width?: number;
  /** Editor モード時にも編集不可にするか (例: 自動採番 ID) */
  readonly?: boolean;
  /** 表示時のテキストフォーマッタ */
  formatter?: (value: unknown, row: Record<string, unknown>) => string;
  /**
   * 表示時のカスタムレンダラ (HTML を返す)。
   * formatter と両方指定された場合は cellRenderer が優先。
   * セル編集中は AG Grid が cellEditor に切替える。
   */
  cellRenderer?: (
    params: MasterEditorCellRendererParams
  ) => MasterEditorCellRendererResult;
  /**
   * セル単位のバリデーション
   * 返り値が null なら valid、文字列ならエラーメッセージ。
   */
  validator?: (
    value: unknown,
    row: Record<string, unknown>
  ) => string | null;
  /** AG Grid 側に渡したい追加 props (escape hatch) */
  agOverride?: Record<string, any>;
}

/**
 * Editor がコミットする 1 件の変更。
 * type === 'update' の場合は rowId が必須。
 */
export type MasterEditorRowChange =
  | {
      type: "update";
      rowId: string;
      patch: Record<string, unknown>;
    }
  | {
      type: "add";
      rowData: Record<string, unknown>;
    }
  | {
      type: "delete";
      rowId: string;
    };

/** 更新 1 行分のフィールド差分 */
export interface MasterEditorOperationPreviewFieldDiff {
  field: string;
  fieldLabel: string;
  before: string;
  after: string;
  /** 取引先など画像付き表示用 */
  beforeImageUrl?: string;
  afterImageUrl?: string;
}

/** 更新セクション: 行単位にグループ */
export interface MasterEditorOperationPreviewUpdateRow {
  rowId: string;
  rowLabel: string;
  /** 製品サムネイル (productImageUrl) */
  productImageUrl?: string;
  changes: MasterEditorOperationPreviewFieldDiff[];
}

/** 追加セクション: 新規行の主要項目 */
export interface MasterEditorOperationPreviewAddRow {
  rowId: string;
  rowLabel: string;
  productImageUrl?: string;
  /** 一覧用の 1 行サマリ */
  summary: string;
  highlights: Array<{ fieldLabel: string; value: string }>;
}

/** 削除セクション */
export interface MasterEditorOperationPreviewDeleteRow {
  rowId: string;
  rowLabel: string;
  productImageUrl?: string;
  summary: string;
}

/** Structured operations preview for review before applying edits. */
export interface MasterEditorOperationPreview {
  comment: string;
  /** AI が解釈した操作の要約（任意） */
  items: Array<{
    kind: "filter" | "update" | "add" | "delete";
    description: string;
  }>;
  sections: {
    updates: MasterEditorOperationPreviewUpdateRow[];
    adds: MasterEditorOperationPreviewAddRow[];
    deletes: MasterEditorOperationPreviewDeleteRow[];
  };
  stats: {
    updates: number;
    adds: number;
    deletes: number;
    filterApplied: boolean;
  };
  filterDescription?: string;
}

/** プレビューでユーザーが承認した行（行 ID 単位。更新は field 行ではなくマスタ行） */
export interface MasterEditorOperationPreviewSelection {
  updates: string[];
  adds: string[];
  deletes: string[];
}

export interface ApplyPendingAIRevisionOptions {
  selection: MasterEditorOperationPreviewSelection;
}

/** 部分適用後に残ったプレビュー（なければ全件適用済み） */
export interface MasterEditorApplyPendingResult {
  appliedCount: number;
  remainingPreview: MasterEditorOperationPreview | null;
}

/** AI による全置換リビジョン適用結果 */
export interface MasterEditorAIRevisionResult {
  revisionId: string | null;
  summary: string;
  /** true のときエディタ表を dataSource から再読み込み (表示絞り込み等) */
  refreshEditor?: boolean;
  /** データ変更なし (表示絞り込みのみ等) */
  noDataChanges?: boolean;
  /** ユーザー承認待ちの変更プラン */
  pendingApproval?: boolean;
  operationPreview?: MasterEditorOperationPreview;
}

/** AI 修正アシスタントに渡す添付ファイル 1 件 */
export interface AttachedFile {
  /** GCS 上のパス (gs://bucket/...) */
  gcsPath: string;
  /** MIME type (例: "application/pdf", "image/png") */
  mimeType: string;
  /** 表示用の元ファイル名 */
  fileName: string;
}

/** AI 適用に必要な最小限の文脈 (DataSource 内部で利用) */
export interface MasterEditorAIContext {
  userMessage: string;
  /** ユーザーがチャットから添付したファイル群 (multimodal context) */
  attachedFiles?: AttachedFile[];
  /**
   * 稼働カレンダー UI で表示中の月 (YYYY-MM)。
   * 設定時は AI 修正をこの月に属する行・日付に限定する。
   */
  operatingCalendarVisibleMonth?: string;
  /**
   * Table AI mode: analysis = 集計・分析 / filter = 表示絞り込み / edit = データ更新
   */
  shippingWorkspaceMode?: "analysis" | "edit" | "filter";
  /**
   * Master editor AI mode.
   */
  masterEditorWorkspaceMode?: "analysis" | "edit" | "filter";
}

/**
 * バリアント (= マスタ「タイプ」) を持つ DataSource に付与する context。
 *
 * `masterItems/{kind}/{typeName}` のように
 * type 軸を持つマスタは、編集中に「どの type を編集対象にするか」をエディタ
 * 内部で切替えたい。`MasterEditorVariantContext` を実装した DataSource は、
 * Toolbar に variant ドロップダウン + 追加ボタンを表示する。
 *
 * 取得系メソッド (getCurrent / getList) は Pinia store の reactive state を
 * 返すことを想定する。呼び出し側 (Toolbar) で computed() に包めば
 * 変更が UI に伝播する。
 */
export interface MasterEditorVariantContext {
  /** 現在編集中のバリアント */
  getCurrent(): { type: string; label: string };
  /** 利用可能な全バリアント */
  getList(): Array<{ type: string; label: string }>;
  /**
   * 指定 type の登録件数。未取得時は undefined。
   * 表示中 type は store の最新件数を返す実装が望ましい。
   */
  getItemCountForType?(type: string): number | undefined;
  /** 全 type の件数キャッシュを更新 (ドロップダウン表示前など) */
  refreshItemCounts?(): Promise<void>;
  /** バリアントを切替える (内部で items の再取得まで行う) */
  setVariant(type: string): Promise<void>;
  /**
   * 新しいバリアントを追加する。
   * 成功時は新規 variant、失敗時は throw。
   * 追加後にそのバリアントへの切替も内部で行う実装が望ましい。
   */
  addVariant(params: {
    type: string;
    label: string;
    /** 指定時は当該 type のマスタ行 / ルール内容を新 type へ複製する */
    copyFromType?: string;
  }): Promise<{ type: string; label: string }>;
  /**
   * 指定パターンを削除する。サブコレクションのデータも削除する。
   * 成功時は `default` へ切替済みの variant を返す。`default` は削除不可。
   */
  deleteVariant(params: { type: string }): Promise<{ type: string; label: string }>;
}

/** 楽観ロックトークン (Production Adapter で利用予定。Draft では noop) */
export interface MasterEditorEditingLock {
  /** ロック保持者の表示名 */
  heldByDisplayName?: string;
  /** ロック取得時刻 (ms) */
  acquiredAtMs: number;
  /** ロックを解放する */
  release(): Promise<void>;
}

/**
 * MasterEditor の唯一の入力ポート。
 *
 * Editor は Vue/Pinia/Firestore を知らない:
 *   - 行を fetchRows() で受け取り
 *   - 編集を commitChanges() で書き戻し
 *   - AI 修正を acceptAIRevision() で発火
 *
 * Adapter 実装側でストア/Firestore/Cloud Run を叩く。
 */
export interface MasterEditorDataSource<TRow extends { id: string } = { id: string }> {
  /** 表示名 (タブ/タイトル用) */
  readonly displayName: string;

  /** 列定義 */
  getColumnDefs(): MasterEditorColumnDef[];

  /** 現在の行データ (reactive ref-like; 呼び出しごとに最新を返す) */
  getRows(): TRow[];

  /**
   * 初回ロード or リフレッシュ。
   * Editor のマウント時 & 外部から再取得したい時に呼ぶ。
   */
  fetchRows(): Promise<TRow[]>;

  /**
   * Editor から人手の編集をコミット。
   *
   * Draft 文脈: 1 件ずつ updateDraftItem を順に呼ぶ
   * Production 文脈: 行単位 patch + 監査ログ
   *
   * 失敗時は throw して Editor 側に伝える。
   */
  commitChanges(changes: MasterEditorRowChange[]): Promise<void>;

  /**
   * AI 修正の発火 (chatRevise 等)。
   * 戻り値の Promise は「リクエスト送信完了」で resolve する。
   * 実際の行データ反映は backing store の reactivity に任せる。
   */
  triggerAIRevision(
    ctx: MasterEditorAIContext
  ): Promise<MasterEditorAIRevisionResult>;

  /** AI 修正が今この瞬間進行中かどうか */
  isAIRevisionInFlight(): boolean;

  /**
   * 編集ロック取得 (Production のみ)。
   * Draft では undefined を返すか、no-op の Lock を返す。
   */
  acquireEditingLock?(): Promise<MasterEditorEditingLock | null>;

  /** 行の追加が許可されるか (Draft では true / Production マスタは false の可能性) */
  readonly allowAddRow: boolean;

  /** 行の削除が許可されるか */
  readonly allowDeleteRow: boolean;

  /**
   * 現在の編集スコープ (選択中 variant 等) の全行を Firestore から削除する。
   * allowDeleteRow が true の MasterEditor では通常実装する。
   */
  deleteAllRows?(): Promise<void>;

  /** AI 修正が許可されるか (DataSource によっては AI 連携 OFF にしたい場合あり) */
  readonly allowAI: boolean;

  /** 承認待ちの AI 変更があるか */
  hasPendingAIRevision?: () => boolean;

  /** プレビュー承認後に変更をコミット（選択行のみ。未選択は pending に残る） */
  applyPendingAIRevision?: (
    options: ApplyPendingAIRevisionOptions
  ) => Promise<MasterEditorApplyPendingResult>;

  /** 承認待ちの AI 変更を破棄 */
  discardPendingAIRevision?: () => void;

  /**
   * revision (履歴) UI を出すか。値があれば対応する revision composable
   * を使って Drawer 内で commit / list / restore できる。
   * null/undefined なら履歴ボタン非表示。
   *
   * material / product 以外も含む全 master kind に対応。
   * 値は @composables/useMasterRevisionByKind の MasterRevisionKind と一致する。
   */
  readonly revisionKind?:
    | "product"
    | "material"
    | "productionLineEvent"
    | "ruleset"
    | "costCalendar"
    | "masterCalendarMapping"
    | null;

  /**
   * バリアント (type 軸) を持つマスタ用の context。
   * 設定された DataSource では Toolbar に variant 切替プルダウンと追加ボタンを表示する。
   * null/undefined なら variant UI 非表示。
   */
  readonly variantContext?: MasterEditorVariantContext | null;

  /**
   * 行が 0 件のときグリッド中央に出す登録導線。
   * supportsGenerateFromDocuments が false のときは ① を手入力 (onManualStart) に差し替える。
   */
  readonly emptyStateActions?: MasterEditorEmptyStateActions | null;
}

export type MasterBulkImportSource = "csv" | "gSheet";

/** MasterEditor グリッド空状態（AI 登録 / 一括取込 / 手入力） */
export interface MasterEditorEmptyStateActions {
  readonly supportsGenerateFromDocuments: boolean;
  openGenerateFromDocuments?: () => void;
  /** CSV / Google スプレッドシートからの一括取込 */
  readonly supportsBulkImport?: boolean;
  openBulkImport?: (source: MasterBulkImportSource) => void;
}
