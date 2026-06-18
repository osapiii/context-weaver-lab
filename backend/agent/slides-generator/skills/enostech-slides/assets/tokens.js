/**
 * ─────────────────────────────────────────────
 *   - layout.cardRadius / layout.cardRadiusSmall : 角丸
 *   - layout.lineWidth / layout.lineWidthStrong  : 薄罫線・強調罫 (0.25 / 0.5)
 *   - layout.cardPad / layout.cardPadCompact     : カード内 padding 標準値
 *   - layout.lineSpacingMultiple                 : 本文の行間
 *   ※ 既存テンプレ (個別実装) のハードコードはこのリリースでは触らず、
 *
 *  ─────────────────────────────────────────────
 * 色はテーマに応じて差し替わる (5 テーマ内蔵、詳細は themes.js)。
 * レイアウト・フォント・サイズはテーマ横断で共通。
 *
 * v3.1 追加:
 *   - `diagramPalette`: ダイアグラム用の 6 トラック × 3 階調パレット (テーマ横断で固定)
 *   - `diagramSize`: ドット半径・軸太さ等、ダイアグラム共通サイズ
 *   - `diagramTrack(i)`: トラックを順番に取り出すヘルパー
 *
 *   - `useDesignFile(path)`: 外部 design.md を読み込んで色・タイポを上書き
 *   - `useDesignTokens(obj)`: パース済みオブジェクトを直接渡す版
 *   - `clearDesignOverrides()`: 上書きをすべて剥がす
 *   - `font` / `size` を Proxy 化して、design.md の上書きに追従
 *   - 上書き対象: 役割色 / グレースケール / fontFace / 各サイズ
 *   - 上書き対象外: diagramPalette / レイアウト / セマンティック色 / FRAMING-3 Twilight Forge
 *
 * ## 使い方（推奨 — Theme-aware）
 *
 *   const T = require('./tokens');
 *   T.useTheme('corporate');        // テーマ切替
 *   const C = T.color;
 *   slide.addText("見出し", {
 *     color: C.brand,               // → ネイビー
 *     fontFace: T.font.jp,
 *   });
 *
 *
 *   T.useTheme('mono');                       // ベース
 *   T.useDesignFile('./design.md');           // 個別トークンを上書き
 *   // → C.brand / F.jp が design.md の値に切り替わる
 *
 *   T.clearDesignOverrides();                 // 上書きを剥がす（テーマだけに戻す）
 *
 * ## 色の役割（テーマ横断）
 *
 *   C.brand         ← 主張・強調（例: 旧 purple）
 *   C.brandSoft     ← brand の薄色（例: 旧 purpleSoft）
 *   C.brandDeep     ← brand の濃色（例: 旧 purpleDeep）
 *   C.accent        ← アクセント・達成感（例: 旧 amber）
 *   C.accentSoft    ← accent の薄色
 *   C.accentDeep    ← accent の濃色
 *   C.ink           ← 本文・濃い文字（黒系）
 *   C.gray50〜700   ← グレースケール
 *   C.canvas        ← スライド背景
 *   C.white         ← 白
 *
 * ## ダイアグラム色の役割
 *
 *   diagramPalette[trackKey].deep   ← メイン・文字色（濃）
 *   diagramPalette[trackKey].mid    ← 塗り（中）
 *   diagramPalette[trackKey].bg     ← 背景・ハロー（淡）
 *
 *   trackKey: 'navy' | 'teal' | 'purp' | 'gold' | 'sage' | 'rose'
 *
 * ## 互換
 *
 *   v2 までのコードで使われていた以下の名前は、
 *   ENOSTECH テーマ選択時に動作するように alias されている:
 *     C.purple / C.purpleSoft / C.purpleDeep
 *     C.accent / C.accentSoft / C.accentDeep / C.accentHi
 *     C.magenta / C.magentaSoft
 */

const path = require('path');
const THEMES = require('./themes');
const designLoader = require('./design-md-loader');

let _currentTheme = 'default';

// 外部 design.md による上書き dict
// shape: { meta:{}, colors:{}, typography:{}, warnings:[] }
let _designOverrides = {
  meta: {},
  colors: {},
  typography: {},
  warnings: [],
};

function _getTheme() {
  const t = THEMES[_currentTheme];
  if (!t) {
    console.warn(`[tokens] Unknown theme: ${_currentTheme}. Falling back to default.`);
    return THEMES.default;
  }
  return t;
}

/**
 * Proxy 化された color オブジェクト。
 * プロパティ参照のたびに現在のテーマから値を解決する。
 * これによって、useTheme() で切り替えるとすべての参照箇所に自動で反映される。
 */
const colorProxy = new Proxy({}, {
  get(_target, prop) {
    // design.md 上書きが先勝ち（役割色 / グレースケール / canvas / white のみ）
    if (typeof prop === 'string' && _designOverrides.colors && _designOverrides.colors[prop]) {
      return _designOverrides.colors[prop];
    }

    const th = _getTheme();

    // ─── role-based (推奨) ───
    if (prop === 'brand')          return th.brand.base;
    if (prop === 'brandSoft')      return th.brand.soft;
    if (prop === 'brandDeep')      return th.brand.deep;
    if (prop === 'brandContrast')  return th.brand.contrast;

    if (prop === 'accent')         return th.accent.base;
    if (prop === 'accentSoft')     return th.accent.soft;
    if (prop === 'accentDeep')     return th.accent.deep;
    if (prop === 'accentContrast') return th.accent.contrast;
    if (prop === 'accentHi')       return th.accent.soft;  // alias

    // ─── highlight ───
    // brand が主役、accent が並列対比、highlight が「色相を意図的にずらした」スパイス。
    // CTA バッジ、featured マーク、ハイライト枠線などに使う。テンプレが highlight を
    // 参照していなくても accent.base にフォールバックして壊れないようにする。
    if (prop === 'highlight') {
      return th.highlight ? th.highlight.base : th.accent.base;
    }
    if (prop === 'highlightSoft') {
      return th.highlight ? th.highlight.soft : th.accent.soft;
    }
    if (prop === 'highlightDeep') {
      return th.highlight ? th.highlight.deep : th.accent.deep;
    }
    if (prop === 'highlightContrast') {
      return th.highlight ? th.highlight.contrast : th.accent.contrast;
    }

    // brand を意味色として参照する旧コード対応。purple = brand を強制マッピング。
    // テーマが mono なら brand は黒、enostech なら紫、corporate ならネイビー等。
    if (prop === 'purple')         return th.brand.base;
    if (prop === 'purpleSoft')     return th.brand.soft;
    if (prop === 'purpleDeep')     return th.brand.deep;

    // ─── grayscale ───
    if (prop === 'ink')         return th.neutral['900'];
    if (prop === 'inkSoft')     return th.neutral['700'];
    if (prop === 'gray700')     return th.neutral['700'];
    if (prop === 'gray500')     return th.neutral['500'];
    if (prop === 'gray400')     return th.neutral['400'];
    if (prop === 'gray300')     return th.neutral['300'];
    if (prop === 'gray200')     return th.neutral['200'];
    if (prop === 'gray100')     return th.neutral['100'];
    if (prop === 'gray50')      return th.neutral['50'];

    // ─── canvas / white ───
    if (prop === 'canvas')      return th.canvas;
    if (prop === 'white')       return th.white;

    // ─── code / dark namespaces (v11.3、テーマ横断固定) ───
    if (prop === 'code')         return CODE_PALETTE;
    if (prop === 'dark')         return DARK_PALETTE;

    // ─── link (ハイパーリンク色、テーマ横断固定) ───
    if (prop === 'link')         return '0563C1';

    // ─── semantic (テーマ横断で固定。design.md でも触れない) ───
    if (prop === 'semanticDanger') return 'B91C1C';  // CHART / DIAGRAM fallback
    if (prop === 'positive')    return '059669';
    if (prop === 'positiveBg')  return 'ECFDF5';
    if (prop === 'warning')     return 'D97706';
    if (prop === 'warningBg')   return 'FFFBEB';
    if (prop === 'negative')    return 'DC2626';
    if (prop === 'negativeBg')  return 'FEF2F2';

    return undefined;
  }
});

/* =========================================================
   FONT / SIZE Proxies — design.md 上書きに対応
   ──────────────────────────────────────────────────
   従来は plain object だったため、design.md で fontFace を
   上書きしても一度参照済みの const F に値が固定されてしまう恐れがあった。
   Proxy 化することで、設計書を切り替えるたびに参照側へ自動で反映される。
   ======================================================== */

const FONT_DEFAULTS = {
  jp:   'Noto Sans JP',
  en:   'Noto Sans JP',
  mono: 'Consolas',
};

const fontProxy = new Proxy({}, {
  get(_target, prop) {
    // design.md で fontFace が指定されていれば jp/en に同時反映（mono は守る）
    if (_designOverrides.typography && _designOverrides.typography.fontFace) {
      if (prop === 'jp' || prop === 'en') {
        return _designOverrides.typography.fontFace;
      }
    }
    if (prop in FONT_DEFAULTS) return FONT_DEFAULTS[prop];
    return undefined;
  }
});

const SIZE_DEFAULTS = {
  titleXL:   32,
  titleL:    20,
  lead:      11,
  h2:        16,
  h3:        13,
  body:      11,
  bodySm:    10,
  caption:   9,
  numLarge:  40,
  numMed:    20,
};

const sizeProxy = new Proxy({}, {
  get(_target, prop) {
    if (typeof prop === 'string'
        && _designOverrides.typography
        && Object.prototype.hasOwnProperty.call(_designOverrides.typography, prop)
        && prop !== 'fontFace') {
      return _designOverrides.typography[prop];
    }
    if (prop in SIZE_DEFAULTS) return SIZE_DEFAULTS[prop];
    return undefined;
  }
});

/* =========================================================
   DIAGRAM PALETTE — テーマ横断で固定（ダイアグラム専用）
   ========================================================
   ダイアグラムで複数系列・象限・ノードを区別する時に使う
   6 トラックのカラーカタログ。各トラックに deep/mid/bg の 3 階調。
   テーマが切り替わっても色は固定（可読性と一貫性を優先）。

   使い方:
     const D = T.diagramPalette;
     D.navy.deep  // → '1F3A5C'
     D.purp.bg    // → 'F2ECFA'

   トラックを順番に回す:
     const track = T.diagramTrack(i);   // i=0..5 で navy→rose、以降循環
*/
const CODE_PALETTE = {
  bg:         '1F2937',
  headerBg:   '1A2233',
  headerLine: '374151',
  fileLabel:  '9CA3AF',
  lineNumber: '4B5563',
  text:       'F3F4F6',
  prompt:     '34D399',
  promptAlt:  '10B981',
  output:     'D1D5DB',
  comment:    '9CA3AF',
  highlight:  'F59E0B',
  dir:        '93C5FD',
  muted:      '6B7280',
};

const DARK_PALETTE = {
  bg:      '1F2937',
  bgAlt:   '1E1E2E',
  text:    'D0D0D0',
  sub:     'B8B8B8',
  mute:    'A0A0A0',
  faint:   '7A7A7A',
  page:    '808080',
  overlay: '000000',
};

const DIAGRAM_PALETTE = {
  navy: { deep: '1F3A5C', mid: '4A6A8E', bg: 'EDF1F7' },
  teal: { deep: '2A6B6B', mid: '5B9A9A', bg: 'E6F0F0' },
  purp: { deep: '6B3AA8', mid: '9B6FC7', bg: 'F2ECFA' },
  gold: { deep: 'A67A2E', mid: 'C9994D', bg: 'F7EEDB' },
  sage: { deep: '4F7D5E', mid: '7DA087', bg: 'EAF1EC' },
  rose: { deep: 'A34A5E', mid: 'C27B8B', bg: 'F5E6E9' },
};
const DIAGRAM_TRACK_ORDER = ['navy', 'teal', 'purp', 'gold', 'sage', 'rose'];

module.exports = {
  /* =========================================================
     THEME API
     ======================================================== */

  /**
   * 旧テーマ名 ('mono', 'corporate', 'nature', 'warm', 'enostech') を
   * 渡しても受け付けるが、内部では `default` を使う。色を切り替えたい時は
   * `T.useDesignFile('./design.md')` を使う。
   *
   * 旧コード (build-deck.js / generate-catalog.js / plan.json の doc.theme 等)
   * を壊さないため、引数チェックは緩く、未知の名前でも受ける。
   */
  useTheme(themeId) {
    // _currentTheme は常に 'default' のまま (no-op)。
    return this;
  },

  /**
   * test-design-md.js / generate-catalog.js が表示用に呼んでいるため互換維持。
   */
  currentTheme() {
    return _currentTheme;
  },

  /**
   * generate-catalog.js が UI のテーマ切替 chip 描画に使っているが、
   * default 1 個に絞られたので chip は実質非表示になる。
   */
  listThemes() {
    return Object.keys(THEMES).map(id => ({
      id,
      name: THEMES[id].name,
      description: THEMES[id].description,
      usage: THEMES[id].usage,
    }));
  },

  getThemes() {
    return THEMES;
  },

  /* =========================================================
     DESIGN.MD OVERRIDE API
     ──────────────────────────────────────────────────
     外部から渡された design.md を読み込んで色・タイポを上書きするオプション機能。
     ベーステーマは事前に useTheme() で選び、その上に design.md を載せる。
     Noto Sans JP デフォルトを残しつつ、design.md で fontFace を明示した時のみ上書き。

     使い方:
       T.useTheme('mono');
       T.useDesignFile('./design.md');
       // → C.brand / F.jp が design.md の値に切り替わる

     対象: brand / brandSoft / brandDeep / accent / gray* / ink / canvas / white,
           fontFace, titleXL / titleL / lead / h2 / h3 / body / bodySm / caption など
     対象外: diagramPalette, layout 寸法, semantic 色, FRAMING-3 Twilight Forge
     ======================================================== */

  /**
   * 外部 design.md を読み込んで上書き dict に登録。
   * 既存の上書きは破棄される（重ねたいなら useDesignTokens を直接呼ぶ）。
   *
   * フィールドは情報として保持するだけ。
   * 実際のテーマ切替は行わない。
   *
   * @param {string} filePath  design.md の絶対 or 相対パス
   * @returns {{ meta, colors, typography, warnings }}  パース結果
   */
  useDesignFile(filePath) {
    const parsed = designLoader.loadDesignMd(filePath);

    if (parsed.warnings && parsed.warnings.length > 0) {
      for (const w of parsed.warnings) {
        console.warn(`[tokens.useDesignFile] ${w}`);
      }
    }

    // baseTheme 指定があっても _currentTheme は変えない (default 固定)。
    // 旧 design.md (baseTheme: mono / corporate 等) は warning なしで黙って受ける。

    _designOverrides = parsed;
    const colorCount = Object.keys(parsed.colors || {}).length;
    const typoCount = Object.keys(parsed.typography || {}).length;
    console.log(`[tokens.useDesignFile] applied '${parsed.meta.name || filePath}' — ${colorCount} colors, ${typoCount} typography overrides`);
    return parsed;
  },

  /**
   * パース済みオブジェクトを直接渡す版。テストや動的構築用。
   *
   * @param {{ meta?, colors?, typography? }} obj
   */
  useDesignTokens(obj) {
    _designOverrides = {
      meta: obj.meta || {},
      colors: obj.colors || {},
      typography: obj.typography || {},
      warnings: obj.warnings || [],
    };
    return _designOverrides;
  },

  /** 上書きをすべて剥がす（テーマだけに戻す） */
  clearDesignOverrides() {
    _designOverrides = { meta: {}, colors: {}, typography: {}, warnings: [] };
    return this;
  },

  /** 現在の上書き内容を取得（デバッグ用） */
  currentDesignOverrides() {
    return _designOverrides;
  },

  /* =========================================================
     COLOR (Proxy) — テーマ連動 + design.md 上書き対応
     ======================================================== */
  color: colorProxy,

  /* =========================================================
     FONTS, SIZES — Proxy 化 で design.md 上書き対応
     LAYOUT — テーマ横断で共通 (上書き対象外)
     ======================================================== */
  font: fontProxy,

  size: sizeProxy,

  layout: {
    slideW:       10.0,
    slideH:       5.625,

    marginX:      0.40,
    marginTop:    0.30,
    marginBot:    0.30,

    /* =========================================================
       v9.26 横断デザイン改善トークン (Genspark refine 先行投入)
       ──────────────────────────────────────────────────
       73 テンプレに薄く効かせる「角丸 / 罫線 / 余白 / 行間」の
       4 軸を Single Source of Truth として明示。
       atoms 層は本トークンを参照。templates 層は v9.27+ で順次移行。
       ──────────────────────────────────────────────────
       cardRadius     : 0.10 → 0.08 (角丸を一段抑えて知的な印象に)
       lineWidth      : 0.5  → 0.25 (薄罫線。区切りは余白で表現)
       lineWidthStrong: 1.0  → 0.5  (強調罫も比例縮小)
       cardPad        : +0.05" (カード内余白を増やして読みやすく)
       lineSpacingMultiple: 1.25 → 1.40 (本文の行間を整える)
       ======================================================== */
    cardRadius:           0.08,    // v9.26。角丸の標準値
    cardRadiusSmall:      0.06,    // 小バッジ・小カード用 (scale 比保持)
    lineWidth:            0.25,    // v9.26 薄罫線。card / table grid のデフォルト
    lineWidthStrong:      0.5,     // v9.26 強調罫線
    cardPad:              0.30,    // v9.26。カード内 padding 標準
    cardPadCompact:       0.22,    // タイル / 小カード用 padding
    lineSpacingMultiple:  1.40,    // v9.26。本文の行間。subtitle / body / sub-cards 共通

    titleBlockY:        0.41,        // ナビ chip 下端と密着して凝縮 (osanai 指定)
    titleBlockH:        1.00,        // 1 行サブコピー時の最小値。実高は addTitleBlock が動的算出
    titleBlockHRoomy:   1.40,        // 2 行サブコピー想定の参考値（Phase 2 設計時の目安）
    titleBlockYNoNav:   0.30,

    contentY:           1.65,        // 1 行サブコピー時の本文開始 y（既存テンプレ互換）
    contentYRoomy:      1.95,        // 2 行サブコピー時の本文開始 y。新規テンプレ・伸ばすケースで参照
    contentYNoNav:      1.40,
    contentBot:         5.15,

    titleY:             0.58,
    titleH:             0.40,
    titleYNoNav:        0.32,
    leadY:              0.96,
    leadH:              0.26,
    leadYNoNav:         0.70,

    navY:               0.15,
    navH:               0.26,

    // sections.length >= navSimpleThreshold で「[ 3 / 8  解決策 ]」型の単一チップ表示。
    // セクション数が多くて全列挙が窮屈なデッキで使う。デフォルト 6。
    navSimpleThreshold: 6,

    titleYWithNav:      0.58,
    leadYWithNav:       0.96,
    contentYWithNav:    1.70,

    gutter:       0.22,
    accentBarW:   0.05,
    stripeW:      0.12,

    footerY:      5.28,
    footerH:      0.22,
  },

  chrome: {
    brandText:    'ENOSTECH',
    brandSpacing: 3,
  },

  logoDir: path.join(__dirname, 'logos'),
  logo: {
    horizontalColor: 'horizontal-color.jpg',
    horizontalBlack: 'horizontal-black.jpg',
    horizontalWhite: 'horizontal-white.png',   // dark canvas 用 (alpha 透過 PNG)
    verticalColor:   'vertical-color.jpg',
    verticalBlack:   'vertical-black.jpg',
    symbolColor:     'symbol-color.jpg',
    symbolBlack:     'symbol-black.jpg',
    logotypeColor:   'logotype-color.jpg',
    logotypeBlack:   'logotype-black.jpg',
  },

  logoPath(name) {
    if (!this.logo[name]) throw new Error(`Unknown logo: ${name}`);
    return path.join(this.logoDir, this.logo[name]);
  },

  // FRAMING-3 (会社紹介・Twilight Forge 版) 専用アセット
  eno45Asset(name) {
    return path.join(__dirname, 'eno45', name);
  },

  /* =========================================================
     CODE / DARK TOKENS (v11.3) — 上の colorProxy 経由でも C.code / C.dark で取れる
     ======================================================== */
  code: CODE_PALETTE,
  dark: DARK_PALETTE,

  /* =========================================================
     DIAGRAM TOKENS (v3.1 新規) — テーマ横断で固定
     ======================================================== */
  diagramPalette: DIAGRAM_PALETTE,

  diagramTrackOrder: DIAGRAM_TRACK_ORDER,

  /**
   * インデックス i に対応するトラックを返す。6 を超えたら循環。
   * @param {number} i
   * @returns {{ deep: string, mid: string, bg: string }}
   */
  diagramTrack(i) {
    const key = DIAGRAM_TRACK_ORDER[i % DIAGRAM_TRACK_ORDER.length];
    return DIAGRAM_PALETTE[key];
  },

  diagramSize: {
    // データドット（プロット・タイムライン・放射）
    dotR:            0.15,   // 標準ドット半径
    dotRHi:          0.22,   // ハイライトドット半径
    dotHaloOut:      0.14,   // ハロー外側の膨らみ
    dotHaloIn:       0.07,   // ハロー内側の膨らみ
    dotBorderWidth:  1.5,    // ドットの白枠太さ（ポイント指定）

    // 軸（プロット・マトリクス）
    axisWidth:       1.5,    // 中央十字線の太さ
    axisColor:       '6B7280', // gray500 固定

    // コネクタ（放射・フェーズフロー）
    connectorWidth:      1.3,
    connectorDashWidth:  1.0,

    // バッジ（ステップ番号等）
    stepBadgeR:          0.21,  // 階段ステップの丸バッジ半径
    stepBadgeBorder:     2,     // 白枠太さ

    // カード (角丸を 0.10 → 0.08 に統一)
    cardRadius:      0.08,
    cardBarW:        0.06,     // 左色バー幅
    cardTopBarH:     0.08,     // 上色バー高さ

    // ノード（放射・サイクル）
    hubR:            0.45,     // 中央ハブ半径
    spokeR:          1.75,     // 周辺ノード配置半径

    // インサイトパネル
    insightTopBarH:  0.08,
    insightRadius:   0.08,
    insightBorder:   1.3,
  },
};
