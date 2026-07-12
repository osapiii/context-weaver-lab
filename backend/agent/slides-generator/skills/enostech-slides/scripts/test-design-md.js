/**
 * test-design-md.js — design.md 機能の動作検証用 5 枚デッキ生成
 * ──────────────────────────────────────────────────────────
 * 実 PPTX レンダリングで確認するためのスクリプト。
 *
 * 使い方:
 *   node scripts/test-design-md.js                      # mono のみ（baseline）
 *   node scripts/test-design-md.js --design=tailwind    # mono + tailwind-slate-amber.md
 *   node scripts/test-design-md.js --design=carbon      # mono + ibm-carbon-blue.md
 *   node scripts/test-design-md.js --design=spotify     # mono + spotify-green.md
 *
 * 出力: tmp/test-design-md/test-{label}.pptx
 */

const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');
const T = require('../assets/tokens');

// ─── 引数 ───
const designArg = process.argv.find(a => a.startsWith('--design='));
const designKey = designArg ? designArg.split('=')[1] : null;

const DESIGN_FILES = {
  tailwind: { path: '../assets/test-design-files/tailwind-slate-amber.md', label: 'tailwind-slate-amber' },
  carbon:   { path: '../assets/test-design-files/ibm-carbon-blue.md',      label: 'ibm-carbon-blue' },
  spotify:  { path: '../assets/test-design-files/spotify-green.md',        label: 'spotify-green' },
};

// ─── テーマ + design.md セットアップ ───
T.useTheme('mono');
let label = 'baseline-mono';
if (designKey) {
  if (!DESIGN_FILES[designKey]) {
    console.error(`Unknown design key: ${designKey}. Choose from: ${Object.keys(DESIGN_FILES).join(', ')}`);
    process.exit(1);
  }
  const fp = path.resolve(__dirname, DESIGN_FILES[designKey].path);
  T.useDesignFile(fp);
  label = DESIGN_FILES[designKey].label;
}
console.log(`→ label: ${label}, theme: ${T.currentTheme()}`);

// ─── トークン参照 ───
const L = T.layout;
const C = T.color;
const F = T.font;
const SZ = T.size;

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';

// ═══════════════════════════════════════════════════════════
// 共通ヘルパー（必要最小限）
// ═══════════════════════════════════════════════════════════

function setCanvasBg(slide) {
  slide.background = { color: C.canvas };
}

function addChromeLeftStrip(slide) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: L.stripeW, h: L.slideH,
    fill: { color: C.brandSoft }, line: { type: 'none' },
  });
}

function addLabel(slide, text) {
  slide.addText(text, {
    x: 0.40, y: 0.18, w: 6, h: 0.24,
    fontSize: SZ.caption, color: C.gray500, fontFace: F.jp, charSpacing: 1,
  });
}

function addFooter(slide) {
  slide.addText(`design.md test — ${label}`, {
    x: 0.40, y: 5.30, w: 9, h: 0.20,
    fontSize: SZ.caption, color: C.gray400, fontFace: F.jp,
  });
}

function addTitleBlock(slide, title, sub) {
  // 引用カード風の薄い brandSoft 背景
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.30, y: 0.55, w: 9.40, h: 1.10,
    fill: { color: C.brandSoft }, line: { type: 'none' },
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.30, y: 0.55, w: 0.05, h: 1.10,
    fill: { color: C.brand }, line: { type: 'none' },
  });
  slide.addText(title, {
    x: 0.45, y: 0.62, w: 9.20, h: 0.40,
    fontSize: SZ.titleL, bold: true, color: C.ink, fontFace: F.jp,
  });
  slide.addText(sub, {
    x: 0.45, y: 1.04, w: 9.20, h: 0.55,
    fontSize: SZ.lead, color: C.gray700, fontFace: F.jp,
  });
}

// ═══════════════════════════════════════════════════════════
// Slide 1 — 表紙
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setCanvasBg(s);
  addChromeLeftStrip(s);

  // タイトル + サブ
  s.addText('design.md 機能 動作検証', {
    x: 0.60, y: 1.80, w: 9, h: 0.80,
    fontSize: 36, bold: true, color: C.brand, fontFace: F.jp,
  });
  s.addText('外部スタイル定義から色・タイポを差し替えられるかを 5 枚で確認する', {
    x: 0.60, y: 2.70, w: 9, h: 0.50,
    fontSize: SZ.lead, color: C.ink, fontFace: F.jp,
  });

  // accent バー
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.60, y: 3.35, w: 1.20, h: 0.06,
    fill: { color: C.accent }, line: { type: 'none' },
  });

  s.addText(`label: ${label}`, {
    x: 0.60, y: 4.80, w: 8, h: 0.30,
    fontSize: SZ.body, color: C.gray500, fontFace: F.jp,
  });
}

// ═══════════════════════════════════════════════════════════
// Slide 2 — 標準コンテンツ（カード並列）
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setCanvasBg(s);
  addChromeLeftStrip(s);
  addLabel(s, '01  色の使われ方');
  addTitleBlock(s,
    'brand と accent が役割で動く',
    '主張・強調は brand、達成感・スパイスは accent。テーマ選択でも design.md でも、参照側のコードは何も変えずに切り替わる。');

  const cardW = 2.95, cardH = 2.40, gap = 0.25, y = 1.85;
  const cards = [
    { title: 'brand', desc: '主張・強調', sample: C.brand },
    { title: 'accent', desc: '達成感・スパイス', sample: C.accent },
    { title: 'ink', desc: '本文', sample: C.ink },
  ];
  let x = 0.40;
  cards.forEach(card => {
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.gray50 }, line: { color: C.gray200, width: 1 },
    });
    // 色サンプル帯
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: 0.50,
      fill: { color: card.sample }, line: { type: 'none' },
    });
    s.addText(card.title, {
      x: x + 0.20, y: y + 0.70, w: cardW - 0.40, h: 0.40,
      fontSize: SZ.h2, bold: true, color: C.ink, fontFace: F.jp,
    });
    s.addText(card.desc, {
      x: x + 0.20, y: y + 1.10, w: cardW - 0.40, h: 0.40,
      fontSize: SZ.body, color: C.gray700, fontFace: F.jp,
    });
    s.addText(`#${card.sample}`, {
      x: x + 0.20, y: y + 1.70, w: cardW - 0.40, h: 0.40,
      fontSize: SZ.caption, color: C.gray500, fontFace: 'Consolas',
    });
    x += cardW + gap;
  });

  addFooter(s);
}

// ═══════════════════════════════════════════════════════════
// Slide 3 — Before / After 比較（fontFace 違いがわかる）
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setCanvasBg(s);
  addChromeLeftStrip(s);
  addLabel(s, '02  これまで／これから');
  addTitleBlock(s,
    'テーマだけでは届かない世界観を design.md で寄せる',
    'これまではテーマ ID 一発切替が中心だった。これからは外部から渡される設計トークンで brand と書体を瞬時に取り替えられる。');

  const colW = 4.50, colY = 1.85, colH = 2.80;
  // Before
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.40, y: colY, w: colW, h: colH,
    fill: { color: C.gray100 }, line: { type: 'none' },
  });
  s.addText('これまで', {
    x: 0.60, y: colY + 0.15, w: colW - 0.40, h: 0.35,
    fontSize: SZ.h2, bold: true, color: C.gray500, fontFace: F.jp,
  });
  s.addText(
    'テーマ ID で切替（mono / corporate / nature / warm）\n  → 5 通りの中から選ぶ\n  → 個別カラー調整は不可',
    {
      x: 0.60, y: colY + 0.65, w: colW - 0.40, h: colH - 0.80,
      fontSize: SZ.body, color: C.gray700, fontFace: F.jp,
    });

  // After
  const ax = 0.40 + colW + 0.20;
  s.addShape(pres.shapes.RECTANGLE, {
    x: ax, y: colY, w: colW, h: colH,
    fill: { color: C.brandSoft }, line: { type: 'none' },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: ax, y: colY, w: 0.06, h: colH,
    fill: { color: C.brand }, line: { type: 'none' },
  });
  s.addText('これから', {
    x: ax + 0.20, y: colY + 0.15, w: colW - 0.40, h: 0.35,
    fontSize: SZ.h2, bold: true, color: C.brand, fontFace: F.jp,
  });
  s.addText(
    'design.md を渡すだけで個別トークン上書き\n  → 任意のブランドに即追従\n  → 既存テーマもそのまま使える',
    {
      x: ax + 0.20, y: colY + 0.65, w: colW - 0.40, h: colH - 0.80,
      fontSize: SZ.body, color: C.ink, fontFace: F.jp,
    });

  addFooter(s);
}

// ═══════════════════════════════════════════════════════════
// Slide 4 — タイポグラフィ確認
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setCanvasBg(s);
  addChromeLeftStrip(s);
  addLabel(s, '03  書体とサイズ');
  addTitleBlock(s,
    'fontFace と各サイズが design.md に追従する',
    'fontFace を上書きすると F.jp / F.en に同時反映。サイズは titleXL〜caption まで個別に上書き可能。Noto Sans JP デフォルトは触らなければ維持される。');

  const items = [
    { label: 'titleXL',  size: SZ.titleXL,  text: '見出しタイトル' },
    { label: 'titleL',   size: SZ.titleL,   text: 'スライドタイトル' },
    { label: 'h2',       size: SZ.h2,       text: '小見出し' },
    { label: 'body',     size: SZ.body,     text: '本文サンプル: 外部 design.md による上書きが、書体と数値サイズの両方を素直に反映するか確認します。' },
    { label: 'caption',  size: SZ.caption,  text: 'caption: 注釈・脚注など' },
  ];
  let yy = 1.85;
  items.forEach(it => {
    s.addText(`${it.label} (${it.size}pt)`, {
      x: 0.40, y: yy, w: 1.8, h: 0.45,
      fontSize: SZ.caption, color: C.gray500, fontFace: 'Consolas',
    });
    s.addText(it.text, {
      x: 2.30, y: yy - 0.05, w: 7.30, h: 0.55,
      fontSize: it.size, color: C.ink, fontFace: F.jp, bold: it.label.startsWith('title'),
    });
    yy += 0.55;
  });

  addFooter(s);
}

// ═══════════════════════════════════════════════════════════
// Slide 5 — 閉じ
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setCanvasBg(s);
  addChromeLeftStrip(s);

  s.addText('検証用 design.md デッキ', {
    x: 0.60, y: 2.20, w: 9, h: 0.60,
    fontSize: 28, bold: true, color: C.ink, fontFace: F.jp,
  });

  // 横長の accent バー
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.60, y: 2.95, w: 8.80, h: 0.04,
    fill: { color: C.accent }, line: { type: 'none' },
  });

  s.addText(`generated with: label=${label}, theme=${T.currentTheme()}`, {
    x: 0.60, y: 3.20, w: 9, h: 0.40,
    fontSize: SZ.body, color: C.gray500, fontFace: F.jp,
  });
}

// ─── 出力 ───
const outDir = path.resolve(__dirname, '../tmp/test-design-md');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `test-${label}.pptx`);

pres.writeFile({ fileName: outPath })
  .then(() => console.log(`✓ wrote ${outPath}`))
  .catch(err => { console.error(err); process.exit(1); });
