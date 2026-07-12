/**
 * master-layouts.js (v10.0-β)
 * ============================
 * PowerPoint「ホーム → 新しいスライド ▼」ドロップダウンに ENOSTECH テンプレを
 * 直接並べる SlideMaster (= 内部実体は SlideLayout) 群を一括定義する。
 *
 * 思想:
 *   - 既存の build-deck.js は addSlide() (master 指定なし) で raw shape を描き続ける
 *     ので、ここで定義した master を **使わない** = 既存スライドへの干渉なし
 *   - PowerPoint は登録された SlideLayout 全てを「新しいスライド ▼」に並べる仕様
 *   - 命名規約: `ENOSTECH NN-カテゴリ — テンプレID 説明`
 *
 * opt-out:
 *   doc.embed_master_layouts: false → registerEnostechMasters は呼ばれない
 *
 * 必須 (16+SECTION-1 系 6 = 22 種) と 可能なら追加 (12〜18 種) で 30〜40 種を狙う。
 * SCENE / DIAGRAM / CHART / SVG / QA-INDEX / PROJECT / CODE は Layer 1 (catalog.pptx) に残置。
 */

'use strict';

const T = require(require('path').join(__dirname, '..', '..', '..', 'assets', 'tokens'));

// ─── helpers ──────────────────────────────────────────────────────────
const W = 10.0;       // slideW (T.layout.slideW)
const H = 5.625;      // slideH (T.layout.slideH)

/**
 * brand chrome: 左ストリップ、ナビバー領域、ページ番号エリア
 *
 * 既存テンプレの addNavChips / addStrip / addFooter と同じ位置に
 * 静的な装飾を仕込む。placeholder は別途 objects[] に追加する。
 */
function chromeObjects(opts = {}) {
  const { variant = 'standard', brandColor, accentColor, fgColor, navTitle = '' } = opts;
  const brand = brandColor || T.color.brand;
  const accent = accentColor || T.color.accent;
  const ink = fgColor || T.color.ink;

  if (variant === 'cover') {
    // 表紙系: 左 strip + 下に brand text
    return [
      { rect: { x: 0,   y: 0,    w: 0.18, h: H,    fill: { color: brand },     line: { type: 'none' } } },
      { rect: { x: 0,   y: H-0.30, w: W, h: 0.30, fill: { color: 'F5F3FF' },   line: { type: 'none' } } },
      { text: {
        text: 'ENOSTECH',
        options: {
          x: 0.4, y: H-0.30, w: 3.0, h: 0.30,
          fontSize: 9, fontFace: T.font.en, color: brand, bold: true, charSpacing: 3,
          valign: 'middle',
        },
      } },
    ];
  }
  if (variant === 'section-divider') {
    // 章扉: 全面 brand 背景 + 中央寄せ
    return [
      { rect: { x: 0, y: 0, w: W, h: H, fill: { color: brand }, line: { type: 'none' } } },
      { rect: { x: 0, y: H-0.30, w: W, h: 0.30, fill: { color: brand, transparency: 30 }, line: { type: 'none' } } },
    ];
  }
  // standard: ナビバー + 左 accent strip + フッター
  const objs = [
    { rect: { x: 0,   y: 0,   w: 0.06, h: H,    fill: { color: brand },           line: { type: 'none' } } },
    { rect: { x: 0,   y: 0,   w: W,    h: 0.04, fill: { color: brand },           line: { type: 'none' } } },
    { rect: { x: 0,   y: H-0.22, w: W, h: 0.22, fill: { color: 'F5F3FF' },        line: { type: 'none' } } },
    { text: { text: 'ENOSTECH',
      options: { x: 0.20, y: H-0.22, w: 1.6, h: 0.22, fontSize: 7.5, fontFace: T.font.en, color: brand, bold: true, charSpacing: 2.5, valign: 'middle' } } },
  ];
  if (navTitle) {
    objs.push({ text: { text: navTitle,
      options: { x: 0.30, y: 0.10, w: 6.0, h: 0.26, fontSize: 9, fontFace: T.font.jp, color: ink, valign: 'middle' } } });
  }
  return objs;
}

/**
 * placeholder ヘルパー
 * type: title / body / image
 */
function ph(name, type, x, y, w, h, opts = {}) {
  return {
    placeholder: {
      options: Object.assign({
        name, type,
        x, y, w, h,
        fontFace: T.font.jp,
        color: T.color.ink,
        valign: 'top',
      }, opts),
      text: opts._defaultText || '',
    },
  };
}

// ─── SECTION 系 (表紙 + 章扉 + 目次) — 必須 ────────────────────────────
function sectionMasters(opts) {
  const masters = [];

  // SECTION-1 標準表紙
  masters.push({
    title: 'ENOSTECH 01-表紙 — 標準 (SECTION-1)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'cover' }),
      ph('eyebrow', 'body', 0.6, 1.4, 8.8, 0.32, { fontSize: 11, color: T.color.brand, bold: true, charSpacing: 2, _defaultText: 'ENOSTECH BRAND DECK' }),
      ph('title', 'title', 0.6, 1.85, 8.8, 1.4, { fontSize: 36, bold: true, color: T.color.ink, _defaultText: 'タイトルを入力' }),
      ph('subtitle', 'body', 0.6, 3.4, 8.8, 0.6, { fontSize: 16, color: T.color.gray700, _defaultText: 'サブコピー (40-80字)' }),
      ph('issued', 'body', 0.6, 4.6, 4.0, 0.3, { fontSize: 10, color: T.color.gray500, _defaultText: '2026.05' }),
      ph('producer', 'body', 5.4, 4.6, 4.0, 0.3, { fontSize: 10, color: T.color.gray500, align: 'right', _defaultText: '株式会社 ENOSTECH' }),
    ],
  });

  // SECTION-1A 〜 1G — リードコピー位置/フォント差バリアント
  const variants = [
    { sfx: 'A', label: 'A バリアント (大タイトル中央)', titleY: 1.6, titleSize: 44, subY: 3.5 },
    { sfx: 'B', label: 'B バリアント (左寄せ強)',     titleY: 1.9, titleSize: 32, subY: 3.6 },
    { sfx: 'C', label: 'C バリアント (短縮タイトル)', titleY: 2.0, titleSize: 28, subY: 3.2 },
    { sfx: 'D', label: 'D バリアント (1 行ピッチ)',   titleY: 2.2, titleSize: 30, subY: 3.5 },
    { sfx: 'E', label: 'E バリアント (3 行サブ)',    titleY: 1.7, titleSize: 32, subY: 3.0 },
    { sfx: 'F', label: 'F バリアント (アクセント大)', titleY: 1.9, titleSize: 34, subY: 3.5 },
    { sfx: 'G', label: 'G バリアント (シンプル)',    titleY: 2.3, titleSize: 28, subY: 3.7 },
  ];
  for (const v of variants) {
    masters.push({
      title: `ENOSTECH 01-表紙 — ${v.label} (SECTION-1${v.sfx})`,
      background: { color: T.color.canvas },
      objects: [
        ...chromeObjects({ variant: 'cover' }),
        ph('eyebrow', 'body', 0.6, 1.0, 8.8, 0.32, { fontSize: 11, color: T.color.brand, bold: true, charSpacing: 2, _defaultText: 'ENOSTECH BRAND DECK' }),
        ph('title', 'title', 0.6, v.titleY, 8.8, 1.4, { fontSize: v.titleSize, bold: true, color: T.color.ink, _defaultText: 'タイトル' }),
        ph('subtitle', 'body', 0.6, v.subY, 8.8, 0.8, { fontSize: 14, color: T.color.gray700, _defaultText: 'サブコピー' }),
      ],
    });
  }

  // SECTION-2 章扉 標準
  masters.push({
    title: 'ENOSTECH 02-章扉 — 標準 (SECTION-2)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'section-divider' }),
      ph('chapter_no', 'body', 0.6, 1.6, 4.0, 0.5, { fontSize: 14, color: T.color.white, charSpacing: 4, _defaultText: 'CHAPTER 01' }),
      ph('title', 'title', 0.6, 2.2, 8.8, 1.0, { fontSize: 36, bold: true, color: T.color.white, _defaultText: '章タイトル' }),
      ph('subtitle', 'body', 0.6, 3.4, 8.8, 0.8, { fontSize: 14, color: 'F5F3FF', _defaultText: 'この章で扱う論点を 1 行で' }),
    ],
  });

  // SECTION-3 Closing
  masters.push({
    title: 'ENOSTECH 02-章扉 — クロージング (SECTION-3)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'section-divider' }),
      ph('title', 'title', 0.6, 2.0, 8.8, 1.0, { fontSize: 32, bold: true, color: T.color.white, align: 'center', _defaultText: '結論を 1 文で' }),
      ph('subtitle', 'body', 0.6, 3.2, 8.8, 0.8, { fontSize: 16, color: 'F5F3FF', align: 'center', _defaultText: '結論を補強する 1 行' }),
    ],
  });

  // SECTION-4 Variant A
  masters.push({
    title: 'ENOSTECH 02-章扉 — バリアント A (SECTION-4)',
    background: { color: T.color.brand },
    objects: [
      ph('chapter_no', 'body', 0.6, 0.6, 4.0, 0.4, { fontSize: 14, color: T.color.white, charSpacing: 4, _defaultText: 'CHAPTER 02' }),
      ph('title', 'title', 0.6, 2.4, 8.8, 1.6, { fontSize: 40, bold: true, color: T.color.white, _defaultText: '章タイトル' }),
    ],
  });

  // SECTION-5 Variant B
  masters.push({
    title: 'ENOSTECH 02-章扉 — バリアント B (SECTION-5)',
    background: { color: T.color.canvas },
    objects: [
      { rect: { x: 0, y: 0, w: 4.0, h: H, fill: { color: T.color.brand }, line: { type: 'none' } } },
      ph('chapter_no', 'body', 0.4, 2.4, 3.4, 0.4, { fontSize: 13, color: T.color.white, charSpacing: 4, _defaultText: 'CHAPTER 03' }),
      ph('title', 'title', 0.4, 3.0, 3.4, 1.4, { fontSize: 26, bold: true, color: T.color.white, _defaultText: '章\nタイトル' }),
      ph('subtitle', 'body', 4.4, 2.4, 5.2, 1.6, { fontSize: 14, color: T.color.ink, _defaultText: 'この章で扱う 2 行サブコピー' }),
    ],
  });

  // SECTION-6 目次
  masters.push({
    title: 'ENOSTECH 03-目次 (SECTION-6)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard', navTitle: '目次' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.6, { fontSize: 22, bold: true, color: T.color.ink, _defaultText: '目次' }),
      ph('toc_1', 'body', 0.6, 1.4, 8.8, 0.5, { fontSize: 14, color: T.color.ink, _defaultText: '01  第 1 章タイトル' }),
      ph('toc_2', 'body', 0.6, 2.0, 8.8, 0.5, { fontSize: 14, color: T.color.ink, _defaultText: '02  第 2 章タイトル' }),
      ph('toc_3', 'body', 0.6, 2.6, 8.8, 0.5, { fontSize: 14, color: T.color.ink, _defaultText: '03  第 3 章タイトル' }),
      ph('toc_4', 'body', 0.6, 3.2, 8.8, 0.5, { fontSize: 14, color: T.color.ink, _defaultText: '04  第 4 章タイトル' }),
      ph('toc_5', 'body', 0.6, 3.8, 8.8, 0.5, { fontSize: 14, color: T.color.gray500, _defaultText: '(任意) 第 5 章タイトル' }),
    ],
  });

  return masters;
}

// ─── FRAMING 系 (背景/会社概要/おみやげ等) — 必須 5 ────────────────────
function framingMasters(opts) {
  const masters = [];

  // FRAMING-1 背景
  masters.push({
    title: 'ENOSTECH 04-フレーミング — 制作背景 (FRAMING-1)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard', navTitle: '制作背景' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'なぜこの資料を作ったか' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.5, { fontSize: 13, color: T.color.gray700, _defaultText: '誰が・何で詰まって・どう動こうとしているか' }),
      ph('body_1', 'body', 0.4, 1.7, 9.0, 1.5, { fontSize: 12, color: T.color.ink, _defaultText: '段落 1: 業種 / 規模 / 担当者を具体的に書く。' }),
      ph('body_2', 'body', 0.4, 3.4, 9.0, 1.5, { fontSize: 12, color: T.color.ink, _defaultText: '段落 2: 既存案では何故詰まったかを具体的に書く。' }),
    ],
  });

  // FRAMING-2 Before/After
  masters.push({
    title: 'ENOSTECH 04-フレーミング — Before/After (FRAMING-2)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard', navTitle: 'Before / After' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'Before → After' }),
      { rect: { x: 0.4, y: 1.4, w: 4.4, h: 3.6, fill: { color: 'F3F4F6' }, line: { color: T.color.gray300, width: 0.5 } } },
      { text: { text: 'BEFORE', options: { x: 0.6, y: 1.5, w: 4.0, h: 0.4, fontSize: 11, color: T.color.gray700, bold: true, charSpacing: 3 } } },
      ph('before', 'body', 0.6, 2.0, 4.0, 2.8, { fontSize: 12, color: T.color.ink, _defaultText: '今の状態を箇条で書く' }),
      { rect: { x: 5.2, y: 1.4, w: 4.4, h: 3.6, fill: { color: T.color.brand }, line: { type: 'none' } } },
      { text: { text: 'AFTER', options: { x: 5.4, y: 1.5, w: 4.0, h: 0.4, fontSize: 11, color: T.color.white, bold: true, charSpacing: 3 } } },
      ph('after', 'body', 5.4, 2.0, 4.0, 2.8, { fontSize: 12, color: T.color.white, _defaultText: '到達したい状態を箇条で書く' }),
    ],
  });

  // FRAMING-3 会社概要
  masters.push({
    title: 'ENOSTECH 04-フレーミング — 会社概要 (FRAMING-3)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard', navTitle: '会社概要' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: '株式会社 ENOSTECH のご紹介' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.5, { fontSize: 12, color: T.color.gray700, _defaultText: 'プロフィール / 受賞歴 / 連絡先' }),
      ph('body', 'body', 0.4, 1.8, 9.0, 3.2, { fontSize: 12, color: T.color.ink, _defaultText: '会社概要を箇条書きで' }),
    ],
  });

  // FRAMING-4 おみやげ
  masters.push({
    title: 'ENOSTECH 04-フレーミング — おみやげ (FRAMING-4)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard', navTitle: 'おみやげ' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'この資料の持ち帰り' }),
      ph('item_1', 'body', 0.4, 1.4, 9.0, 0.6, { fontSize: 13, color: T.color.ink, _defaultText: '① 1 行で持ち帰れる結論' }),
      ph('item_2', 'body', 0.4, 2.1, 9.0, 0.6, { fontSize: 13, color: T.color.ink, _defaultText: '② 1 行で持ち帰れる結論' }),
      ph('item_3', 'body', 0.4, 2.8, 9.0, 0.6, { fontSize: 13, color: T.color.ink, _defaultText: '③ 1 行で持ち帰れる結論' }),
      ph('item_4', 'body', 0.4, 3.5, 9.0, 0.6, { fontSize: 13, color: T.color.ink, _defaultText: '④ 1 行で持ち帰れる結論' }),
      ph('item_5', 'body', 0.4, 4.2, 9.0, 0.6, { fontSize: 13, color: T.color.gray500, _defaultText: '(任意) ⑤ 1 行' }),
    ],
  });

  // FRAMING-5 チェックリスト
  masters.push({
    title: 'ENOSTECH 04-フレーミング — チェックリスト (FRAMING-5)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard', navTitle: 'チェックリスト' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'チェックリスト' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.4, { fontSize: 12, color: T.color.gray700, _defaultText: '進めながら / 後で見返しながら' }),
      ph('check_1', 'body', 0.4, 1.7, 9.0, 0.5, { fontSize: 13, color: T.color.ink, _defaultText: '☐ チェック項目 1' }),
      ph('check_2', 'body', 0.4, 2.3, 9.0, 0.5, { fontSize: 13, color: T.color.ink, _defaultText: '☐ チェック項目 2' }),
      ph('check_3', 'body', 0.4, 2.9, 9.0, 0.5, { fontSize: 13, color: T.color.ink, _defaultText: '☐ チェック項目 3' }),
      ph('check_4', 'body', 0.4, 3.5, 9.0, 0.5, { fontSize: 13, color: T.color.ink, _defaultText: '☐ チェック項目 4' }),
      ph('check_5', 'body', 0.4, 4.1, 9.0, 0.5, { fontSize: 13, color: T.color.ink, _defaultText: '☐ チェック項目 5' }),
    ],
  });

  return masters;
}

// ─── LIST 系 — 必須 3 + 追加 5 ──────────────────────────────────────
function listMasters(opts) {
  const masters = [];

  // LIST-1 本文
  masters.push({
    title: 'ENOSTECH 05-リスト — 本文 (LIST-1)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'タイトル (60字以内)' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.5, { fontSize: 12, color: T.color.gray700, _defaultText: 'サブコピー (40-80字)' }),
      ph('body', 'body', 0.4, 1.7, 9.0, 3.2, { fontSize: 13, color: T.color.ink, _defaultText: '本文を 2-4 段落で。\n\n読み手が次の行動を取れる具体性で書く。' }),
    ],
  });

  // LIST-2 3カラム
  masters.push({
    title: 'ENOSTECH 05-リスト — 3 カラム (LIST-2)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: '3 カラム比較タイトル' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.5, { fontSize: 12, color: T.color.gray700, _defaultText: 'サブコピー' }),
      // 3 カラム
      { rect: { x: 0.4, y: 1.7, w: 3.0, h: 3.2, fill: { color: 'F9FAFB' }, line: { color: T.color.gray300, width: 0.5 } } },
      { rect: { x: 3.5, y: 1.7, w: 3.0, h: 3.2, fill: { color: 'F9FAFB' }, line: { color: T.color.gray300, width: 0.5 } } },
      { rect: { x: 6.6, y: 1.7, w: 3.0, h: 3.2, fill: { color: 'F9FAFB' }, line: { color: T.color.gray300, width: 0.5 } } },
      ph('col1_title', 'body', 0.6, 1.85, 2.7, 0.4, { fontSize: 13, bold: true, color: T.color.brand, _defaultText: '見出し 1' }),
      ph('col1_body', 'body', 0.6, 2.3, 2.7, 2.5, { fontSize: 11, color: T.color.ink, _defaultText: '本文 1' }),
      ph('col2_title', 'body', 3.7, 1.85, 2.7, 0.4, { fontSize: 13, bold: true, color: T.color.brand, _defaultText: '見出し 2' }),
      ph('col2_body', 'body', 3.7, 2.3, 2.7, 2.5, { fontSize: 11, color: T.color.ink, _defaultText: '本文 2' }),
      ph('col3_title', 'body', 6.8, 1.85, 2.7, 0.4, { fontSize: 13, bold: true, color: T.color.brand, _defaultText: '見出し 3' }),
      ph('col3_body', 'body', 6.8, 2.3, 2.7, 2.5, { fontSize: 11, color: T.color.ink, _defaultText: '本文 3' }),
    ],
  });

  // LIST-3 カードグリッド (3 cards)
  masters.push({
    title: 'ENOSTECH 05-リスト — カードグリッド (LIST-3)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'カードグリッド タイトル' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.5, { fontSize: 12, color: T.color.gray700, _defaultText: 'サブコピー' }),
      // 3 cards with brand top stripe
      { rect: { x: 0.4, y: 1.7, w: 3.0, h: 3.2, fill: { color: T.color.canvas }, line: { color: T.color.gray300, width: 0.5 } } },
      { rect: { x: 0.4, y: 1.7, w: 3.0, h: 0.10, fill: { color: T.color.brand }, line: { type: 'none' } } },
      { rect: { x: 3.5, y: 1.7, w: 3.0, h: 3.2, fill: { color: T.color.canvas }, line: { color: T.color.gray300, width: 0.5 } } },
      { rect: { x: 3.5, y: 1.7, w: 3.0, h: 0.10, fill: { color: T.color.brand }, line: { type: 'none' } } },
      { rect: { x: 6.6, y: 1.7, w: 3.0, h: 3.2, fill: { color: T.color.canvas }, line: { color: T.color.gray300, width: 0.5 } } },
      { rect: { x: 6.6, y: 1.7, w: 3.0, h: 0.10, fill: { color: T.color.brand }, line: { type: 'none' } } },
      ph('card1_title', 'body', 0.6, 2.0, 2.7, 0.4, { fontSize: 13, bold: true, color: T.color.ink, _defaultText: 'カード 1 見出し' }),
      ph('card1_body', 'body', 0.6, 2.5, 2.7, 2.3, { fontSize: 11, color: T.color.ink, _defaultText: 'カード 1 本文' }),
      ph('card2_title', 'body', 3.7, 2.0, 2.7, 0.4, { fontSize: 13, bold: true, color: T.color.ink, _defaultText: 'カード 2 見出し' }),
      ph('card2_body', 'body', 3.7, 2.5, 2.7, 2.3, { fontSize: 11, color: T.color.ink, _defaultText: 'カード 2 本文' }),
      ph('card3_title', 'body', 6.8, 2.0, 2.7, 0.4, { fontSize: 13, bold: true, color: T.color.ink, _defaultText: 'カード 3 見出し' }),
      ph('card3_body', 'body', 6.8, 2.5, 2.7, 2.3, { fontSize: 11, color: T.color.ink, _defaultText: 'カード 3 本文' }),
    ],
  });

  if (!opts.includeOptional) return masters;

  // LIST-4 カードスタック (4 縦)
  masters.push({
    title: 'ENOSTECH 05-リスト — カードスタック (LIST-4)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'スタック タイトル' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.5, { fontSize: 12, color: T.color.gray700, _defaultText: 'サブコピー' }),
      ph('card1', 'body', 0.4, 1.7, 9.0, 0.7, { fontSize: 12, color: T.color.ink, _defaultText: '① カード 1' }),
      ph('card2', 'body', 0.4, 2.5, 9.0, 0.7, { fontSize: 12, color: T.color.ink, _defaultText: '② カード 2' }),
      ph('card3', 'body', 0.4, 3.3, 9.0, 0.7, { fontSize: 12, color: T.color.ink, _defaultText: '③ カード 3' }),
      ph('card4', 'body', 0.4, 4.1, 9.0, 0.7, { fontSize: 12, color: T.color.ink, _defaultText: '④ カード 4' }),
    ],
  });

  // LIST-5 タイル 2x2
  masters.push({
    title: 'ENOSTECH 05-リスト — タイル 2x2 (LIST-5)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'タイル 2x2' }),
      ...[[0,0],[1,0],[0,1],[1,1]].map(([cx, cy], i) => {
        const x = 0.4 + cx*4.6;
        const y = 1.4 + cy*1.7;
        return { rect: { x, y, w: 4.4, h: 1.5, fill: { color: 'F9FAFB' }, line: { color: T.color.gray300, width: 0.5 } } };
      }),
      ph('tile1', 'body', 0.6, 1.5, 4.0, 1.3, { fontSize: 12, color: T.color.ink, _defaultText: 'タイル 1' }),
      ph('tile2', 'body', 5.2, 1.5, 4.0, 1.3, { fontSize: 12, color: T.color.ink, _defaultText: 'タイル 2' }),
      ph('tile3', 'body', 0.6, 3.2, 4.0, 1.3, { fontSize: 12, color: T.color.ink, _defaultText: 'タイル 3' }),
      ph('tile4', 'body', 5.2, 3.2, 4.0, 1.3, { fontSize: 12, color: T.color.ink, _defaultText: 'タイル 4' }),
    ],
  });

  // LIST-6 タイル 3x2
  masters.push({
    title: 'ENOSTECH 05-リスト — タイル 3x2 (LIST-6)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'タイル 3x2' }),
      ...[0,1,2,3,4,5].map(i => {
        const cx = i % 3, cy = Math.floor(i/3);
        return { rect: { x: 0.4 + cx*3.07, y: 1.4 + cy*1.7, w: 2.85, h: 1.5, fill: { color: 'F9FAFB' }, line: { color: T.color.gray300, width: 0.5 } } };
      }),
      ph('tile1', 'body', 0.5, 1.5, 2.7, 1.3, { fontSize: 11, color: T.color.ink, _defaultText: 'タイル 1' }),
      ph('tile2', 'body', 3.6, 1.5, 2.7, 1.3, { fontSize: 11, color: T.color.ink, _defaultText: 'タイル 2' }),
      ph('tile3', 'body', 6.7, 1.5, 2.7, 1.3, { fontSize: 11, color: T.color.ink, _defaultText: 'タイル 3' }),
      ph('tile4', 'body', 0.5, 3.2, 2.7, 1.3, { fontSize: 11, color: T.color.ink, _defaultText: 'タイル 4' }),
      ph('tile5', 'body', 3.6, 3.2, 2.7, 1.3, { fontSize: 11, color: T.color.ink, _defaultText: 'タイル 5' }),
      ph('tile6', 'body', 6.7, 3.2, 2.7, 1.3, { fontSize: 11, color: T.color.ink, _defaultText: 'タイル 6' }),
    ],
  });

  // LIST-8 詳細カード (1 大カード)
  masters.push({
    title: 'ENOSTECH 05-リスト — 詳細カード (LIST-8)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: '詳細カード タイトル' }),
      { rect: { x: 0.4, y: 1.4, w: 9.0, h: 3.4, fill: { color: 'F9FAFB' }, line: { color: T.color.gray300, width: 0.5 } } },
      { rect: { x: 0.4, y: 1.4, w: 9.0, h: 0.10, fill: { color: T.color.brand }, line: { type: 'none' } } },
      ph('card_title', 'body', 0.6, 1.6, 8.6, 0.5, { fontSize: 16, bold: true, color: T.color.ink, _defaultText: 'カード見出し' }),
      ph('card_body', 'body', 0.6, 2.2, 8.6, 2.4, { fontSize: 12, color: T.color.ink, _defaultText: 'カード本文 (4-6 段落)' }),
    ],
  });

  // LIST-9 アイコン 3カラム
  masters.push({
    title: 'ENOSTECH 05-リスト — アイコン 3 カラム (LIST-9)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'アイコン 3 カラム' }),
      ...[0,1,2].map(i => ({
        rect: { x: 0.4 + i*3.07, y: 1.7, w: 2.85, h: 3.0, fill: { color: T.color.canvas }, line: { color: T.color.gray300, width: 0.5 } }
      })),
      // brand circle for icon area
      ...[0,1,2].map(i => ({
        rect: { x: 0.4 + i*3.07 + 1.0, y: 1.9, w: 0.85, h: 0.85, fill: { color: T.color.brandSoft || 'F5F3FF' }, line: { type: 'none' } }
      })),
      ph('col1_title', 'body', 0.5, 2.95, 2.7, 0.4, { fontSize: 13, bold: true, color: T.color.ink, align: 'center', _defaultText: '見出し 1' }),
      ph('col1_body', 'body', 0.5, 3.4, 2.7, 1.2, { fontSize: 10, color: T.color.ink, align: 'center', _defaultText: '本文 1' }),
      ph('col2_title', 'body', 3.6, 2.95, 2.7, 0.4, { fontSize: 13, bold: true, color: T.color.ink, align: 'center', _defaultText: '見出し 2' }),
      ph('col2_body', 'body', 3.6, 3.4, 2.7, 1.2, { fontSize: 10, color: T.color.ink, align: 'center', _defaultText: '本文 2' }),
      ph('col3_title', 'body', 6.7, 2.95, 2.7, 0.4, { fontSize: 13, bold: true, color: T.color.ink, align: 'center', _defaultText: '見出し 3' }),
      ph('col3_body', 'body', 6.7, 3.4, 2.7, 1.2, { fontSize: 10, color: T.color.ink, align: 'center', _defaultText: '本文 3' }),
    ],
  });

  return masters;
}

// ─── COMPARE 系 — 必須 1 + 追加 4 ─────────────────────────────────
function compareMasters(opts) {
  const masters = [];

  // COMPARE-2 Before/After 簡易
  masters.push({
    title: 'ENOSTECH 06-比較 — Before/After 簡易 (COMPARE-2)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: '簡易 Before/After' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.4, { fontSize: 12, color: T.color.gray700, _defaultText: '一文サブコピー' }),
      { rect: { x: 0.4, y: 1.6, w: 4.4, h: 3.4, fill: { color: 'F3F4F6' }, line: { color: T.color.gray300, width: 0.5 } } },
      { text: { text: 'BEFORE', options: { x: 0.6, y: 1.7, w: 4.0, h: 0.4, fontSize: 11, color: T.color.gray700, bold: true, charSpacing: 3 } } },
      ph('before', 'body', 0.6, 2.2, 4.0, 2.6, { fontSize: 12, color: T.color.ink, _defaultText: 'before 状態' }),
      { rect: { x: 5.2, y: 1.6, w: 4.4, h: 3.4, fill: { color: T.color.brand }, line: { type: 'none' } } },
      { text: { text: 'AFTER', options: { x: 5.4, y: 1.7, w: 4.0, h: 0.4, fontSize: 11, color: T.color.white, bold: true, charSpacing: 3 } } },
      ph('after', 'body', 5.4, 2.2, 4.0, 2.6, { fontSize: 12, color: T.color.white, _defaultText: 'after 状態' }),
    ],
  });

  if (!opts.includeOptional) return masters;

  // COMPARE-1 Before/After 詳細
  masters.push({
    title: 'ENOSTECH 06-比較 — Before/After 詳細 (COMPARE-1)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'Before / After 詳細' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.4, { fontSize: 12, color: T.color.gray700, _defaultText: 'サブコピー' }),
      ph('before_title', 'body', 0.4, 1.6, 4.4, 0.4, { fontSize: 14, bold: true, color: T.color.gray700, _defaultText: 'BEFORE 見出し' }),
      ph('before_body', 'body', 0.4, 2.05, 4.4, 2.8, { fontSize: 11, color: T.color.ink, _defaultText: 'before 本文' }),
      ph('after_title', 'body', 5.2, 1.6, 4.4, 0.4, { fontSize: 14, bold: true, color: T.color.brand, _defaultText: 'AFTER 見出し' }),
      ph('after_body', 'body', 5.2, 2.05, 4.4, 2.8, { fontSize: 11, color: T.color.ink, _defaultText: 'after 本文' }),
    ],
  });

  // COMPARE-3 Icon
  masters.push({
    title: 'ENOSTECH 06-比較 — アイコン (COMPARE-3)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'アイコン比較' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.4, { fontSize: 12, color: T.color.gray700, _defaultText: 'サブコピー' }),
      { rect: { x: 0.4, y: 1.6, w: 4.4, h: 3.4, fill: { color: 'F9FAFB' }, line: { color: T.color.gray300, width: 0.5 } } },
      { rect: { x: 5.2, y: 1.6, w: 4.4, h: 3.4, fill: { color: 'F9FAFB' }, line: { color: T.color.gray300, width: 0.5 } } },
      ph('left_label', 'body', 0.6, 1.7, 4.0, 0.4, { fontSize: 12, bold: true, color: T.color.brand, _defaultText: '左ラベル' }),
      ph('left_body', 'body', 0.6, 2.2, 4.0, 2.6, { fontSize: 11, color: T.color.ink, _defaultText: '左本文' }),
      ph('right_label', 'body', 5.4, 1.7, 4.0, 0.4, { fontSize: 12, bold: true, color: T.color.brand, _defaultText: '右ラベル' }),
      ph('right_body', 'body', 5.4, 2.2, 4.0, 2.6, { fontSize: 11, color: T.color.ink, _defaultText: '右本文' }),
    ],
  });

  // COMPARE-4 Tradeoff
  masters.push({
    title: 'ENOSTECH 06-比較 — トレードオフ (COMPARE-4)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'トレードオフ' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.4, { fontSize: 12, color: T.color.gray700, _defaultText: '何 vs. 何のトレードオフか' }),
      ph('option_a', 'body', 0.4, 1.6, 4.4, 1.5, { fontSize: 11, color: T.color.ink, _defaultText: '選択肢 A: 利点 / 欠点' }),
      ph('option_b', 'body', 5.2, 1.6, 4.4, 1.5, { fontSize: 11, color: T.color.ink, _defaultText: '選択肢 B: 利点 / 欠点' }),
      ph('verdict', 'body', 0.4, 3.3, 9.2, 1.5, { fontSize: 12, color: T.color.ink, _defaultText: '結論: どっちを取るか / 取らないか' }),
    ],
  });

  // COMPARE-5 Grouped
  masters.push({
    title: 'ENOSTECH 06-比較 — グルーピング (COMPARE-5)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'グルーピング比較' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.4, { fontSize: 12, color: T.color.gray700, _defaultText: '何で軸切りしているか' }),
      ph('body', 'body', 0.4, 1.7, 9.0, 3.2, { fontSize: 11, color: T.color.ink, _defaultText: 'グループ A / B / C で分類した比較表 or 箇条書き' }),
    ],
  });

  return masters;
}

// ─── DATA 系 — 必須 1 + 追加 3 ─────────────────────────────────
function dataMasters(opts) {
  const masters = [];

  // DATA-1 Key/Value
  masters.push({
    title: 'ENOSTECH 07-データ — キー/値 (DATA-1)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: '主要数値' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.4, { fontSize: 12, color: T.color.gray700, _defaultText: '数値の意味を 1 行で' }),
      ...[0,1,2,3].map(i => {
        const cx = i % 2, cy = Math.floor(i/2);
        const x = 0.4 + cx*4.6;
        const y = 1.6 + cy*1.7;
        return { rect: { x, y, w: 4.4, h: 1.5, fill: { color: 'F9FAFB' }, line: { color: T.color.gray300, width: 0.5 } } };
      }),
      ph('kv1_value', 'body', 0.6, 1.75, 4.0, 0.7, { fontSize: 28, bold: true, color: T.color.brand, _defaultText: '99%' }),
      ph('kv1_label', 'body', 0.6, 2.5, 4.0, 0.5, { fontSize: 11, color: T.color.gray700, _defaultText: 'ラベル 1' }),
      ph('kv2_value', 'body', 5.2, 1.75, 4.0, 0.7, { fontSize: 28, bold: true, color: T.color.brand, _defaultText: '12x' }),
      ph('kv2_label', 'body', 5.2, 2.5, 4.0, 0.5, { fontSize: 11, color: T.color.gray700, _defaultText: 'ラベル 2' }),
      ph('kv3_value', 'body', 0.6, 3.45, 4.0, 0.7, { fontSize: 28, bold: true, color: T.color.brand, _defaultText: '3.4M' }),
      ph('kv3_label', 'body', 0.6, 4.2, 4.0, 0.5, { fontSize: 11, color: T.color.gray700, _defaultText: 'ラベル 3' }),
      ph('kv4_value', 'body', 5.2, 3.45, 4.0, 0.7, { fontSize: 28, bold: true, color: T.color.brand, _defaultText: '85h' }),
      ph('kv4_label', 'body', 5.2, 4.2, 4.0, 0.5, { fontSize: 11, color: T.color.gray700, _defaultText: 'ラベル 4' }),
    ],
  });

  if (!opts.includeOptional) return masters;

  // DATA-2 Table
  masters.push({
    title: 'ENOSTECH 07-データ — 表 (DATA-2)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: '表タイトル' }),
      ph('subtitle', 'body', 0.4, 1.05, 9.0, 0.4, { fontSize: 12, color: T.color.gray700, _defaultText: 'サブコピー' }),
      ph('body', 'body', 0.4, 1.7, 9.0, 3.2, { fontSize: 11, color: T.color.ink, _defaultText: '表データを行/列で書く' }),
    ],
  });

  // DATA-4 References
  masters.push({
    title: 'ENOSTECH 07-データ — 参考文献 (DATA-4)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard', navTitle: '参考文献' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: '参考文献' }),
      ph('body', 'body', 0.4, 1.4, 9.0, 3.6, { fontSize: 10, color: T.color.ink, _defaultText: '(1) 著者 / タイトル / 出典 / 日付\n(2) ...' }),
    ],
  });

  // DATA-5 Glossary
  masters.push({
    title: 'ENOSTECH 07-データ — 用語集 (DATA-5)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard', navTitle: '用語集' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: '用語集' }),
      ph('body', 'body', 0.4, 1.4, 9.0, 3.6, { fontSize: 11, color: T.color.ink, _defaultText: '用語 1: 説明\n用語 2: 説明' }),
    ],
  });

  return masters;
}

// ─── VISUAL 系 (image placeholder のみ) — 追加 ─────────────────────
function visualMasters(opts) {
  if (!opts.includeOptional) return [];
  const masters = [];

  // VISUAL-1 Profile (image + body)
  masters.push({
    title: 'ENOSTECH 08-ビジュアル — プロフィール (VISUAL-1)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'プロフィール' }),
      { rect: { x: 0.4, y: 1.4, w: 3.6, h: 3.6, fill: { color: 'F3F4F6' }, line: { color: T.color.gray300, width: 0.5 } } },
      { text: { text: '[ 画像 ]', options: { x: 0.4, y: 1.4, w: 3.6, h: 3.6, fontSize: 14, color: T.color.gray500, align: 'center', valign: 'middle' } } },
      ph('subtitle', 'body', 4.2, 1.4, 5.4, 0.5, { fontSize: 14, bold: true, color: T.color.brand, _defaultText: '肩書 / 役割' }),
      ph('body', 'body', 4.2, 2.0, 5.4, 3.0, { fontSize: 11, color: T.color.ink, _defaultText: '本文 (経歴 / プロフ等)' }),
    ],
  });

  // VISUAL-3 Visual (大画像 + 短いコピー)
  masters.push({
    title: 'ENOSTECH 08-ビジュアル — メインビジュアル (VISUAL-3)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'タイトル' }),
      { rect: { x: 0.4, y: 1.4, w: 9.0, h: 3.0, fill: { color: 'F3F4F6' }, line: { color: T.color.gray300, width: 0.5 } } },
      { text: { text: '[ メインビジュアル ]', options: { x: 0.4, y: 1.4, w: 9.0, h: 3.0, fontSize: 14, color: T.color.gray500, align: 'center', valign: 'middle' } } },
      ph('caption', 'body', 0.4, 4.5, 9.0, 0.5, { fontSize: 11, color: T.color.gray700, _defaultText: 'キャプション' }),
    ],
  });

  // VISUAL-5 Split Image/Text
  masters.push({
    title: 'ENOSTECH 08-ビジュアル — 分割 画像/本文 (VISUAL-5)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: '分割タイトル' }),
      { rect: { x: 0.4, y: 1.4, w: 4.4, h: 3.6, fill: { color: 'F3F4F6' }, line: { color: T.color.gray300, width: 0.5 } } },
      { text: { text: '[ 画像 ]', options: { x: 0.4, y: 1.4, w: 4.4, h: 3.6, fontSize: 14, color: T.color.gray500, align: 'center', valign: 'middle' } } },
      ph('subtitle', 'body', 5.2, 1.4, 4.4, 0.5, { fontSize: 14, bold: true, color: T.color.brand, _defaultText: '見出し' }),
      ph('body', 'body', 5.2, 2.0, 4.4, 3.0, { fontSize: 11, color: T.color.ink, _defaultText: '本文' }),
    ],
  });

  return masters;
}

// ─── WEBPAGE 系 — 追加 ────────────────────────────────────────
function webpageMasters(opts) {
  if (!opts.includeOptional) return [];
  const masters = [];

  // WEBPAGE-1 サマリー
  masters.push({
    title: 'ENOSTECH 09-Web — サマリー (WEBPAGE-1)',
    background: { color: T.color.canvas },
    objects: [
      ...chromeObjects({ variant: 'standard' }),
      ph('title', 'title', 0.4, 0.5, 9.0, 0.55, { fontSize: 20, bold: true, color: T.color.ink, _defaultText: 'Web ページ サマリー' }),
      ph('url', 'body', 0.4, 1.05, 9.0, 0.4, { fontSize: 11, color: T.color.brand, _defaultText: 'https://example.com' }),
      ph('body', 'body', 0.4, 1.6, 9.0, 3.4, { fontSize: 12, color: T.color.ink, _defaultText: '記事 / ドキュメント / 仕様の要約 (300-500 字)' }),
    ],
  });

  return masters;
}

// ─── public API ───────────────────────────────────────────────
function buildMasters(opts = {}) {
  const allMasters = [
    ...sectionMasters(opts),
    ...framingMasters(opts),
    ...listMasters(opts),
    ...compareMasters(opts),
    ...dataMasters(opts),
    ...visualMasters(opts),
    ...webpageMasters(opts),
  ];
  return allMasters;
}

/**
 * registerEnostechMasters(pres, opts)
 *
 * @param {pptxgen} pres   PptxGenJS presentation instance
 * @param {object}  opts   { includeOptional?: boolean = true }
 * @returns {number}  registered master count
 */
function registerEnostechMasters(pres, opts = {}) {
  const optsResolved = Object.assign({ includeOptional: true }, opts);
  const masters = buildMasters(optsResolved);
  for (const m of masters) {
    pres.defineSlideMaster(m);
  }
  return masters.length;
}

module.exports = {
  registerEnostechMasters,
  buildMasters,    // for testing
};
