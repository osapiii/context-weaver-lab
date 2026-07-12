#!/usr/bin/env node
/**
 * build-showcase.js
 * =========================
 * 各 category 配下の `templates/{category}/showcase-seed.json` を集約して
 * 1 つの showcase plan.json を組み立て、build-deck.js を呼んで pptx を生成する。
 *
 * 新規テンプレ追加時の運用:
 *   1. templates/{cat}/{new-id}.js を作る
 *   2. templates/{cat}/index.js の registry に追加
 *   3. templates/{cat}/showcase-seed.json に 1 枚分のサンプルを追加
 *   4. node scripts/build-showcase.js  ← 自動的に showcase に乗る
 *
 * 使い方:
 *   node scripts/build-showcase.js                                 # default → decks/template-showcase/
 *   node scripts/build-showcase.js --out decks/foo/plan.json       # plan の出力先指定
 *   node scripts/build-showcase.js --pptx decks/foo/showcase.pptx  # pptx の出力先指定
 *   node scripts/build-showcase.js --no-pptx                       # plan のみ
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ─── CLI ───────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') out.out = argv[++i];
    else if (a === '--pptx' || a === '-p') out.pptx = argv[++i];
    else if (a === '--no-pptx') out.skipPptx = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function help() {
  console.log(`build-showcase.js — v8.0 全テンプレ展示デッキ自動生成

  --out  <path>   showcase plan.json の出力先 (default: decks/template-showcase/plan.json)
  --pptx <path>   pptx の出力先 (default: <out と同じ dir>/draft.pptx)
  --no-pptx       plan.json のみ生成 (build-deck.js 呼ばない)
`);
}

// ─── カテゴリ設定 ───────────────────────────────────────
const TEMPLATES_DIR = path.join(__dirname, '..', 'scripts', 'render', 'templates');
const { CATEGORIES } = require(path.join(TEMPLATES_DIR, 'index.js'));

const CATEGORY_LABELS = {
  section:  { code: 'SECTION',  name: '構造系: 表紙 / 章扉 / 目次 / 閉じ', tagline: '読み手の現在地を示す枠組み' },
  list:     { code: 'LIST',     name: '本文系: 箇条書き / カラム / カード', tagline: '情報を並べて見せる定番' },
  compare:  { code: 'COMPARE',  name: '比較系: Before/After / 対比 / トレードオフ', tagline: '差分を一目で伝える' },
  data:     { code: 'DATA',     name: 'データ系: 表 / 数字 / 用語集', tagline: '事実を整理して並べる' },
  project:  { code: 'PROJECT',  name: 'プロジェクト系: フェーズ / スケジュール', tagline: '時間軸の見える化' },
  diagram:  { code: 'DIAGRAM',  name: '定型図解: マトリクス / フロー / 意思決定木', tagline: '構造を絵で見せる' },
  chart:    { code: 'CHART',    name: '定量データ: グラフ + 解釈', tagline: '数字を物語に変える' },
  visual:   { code: 'VISUAL',   name: 'ビジュアル: 画像 / SVG ハイブリッド', tagline: '絵で説得する' },
  framing:  { code: 'FRAMING',  name: '序盤・締めの固定枠', tagline: '読み始めと読み終わりを支える' },
  free:     { code: 'FREE',     name: '自由レイアウト', tagline: 'カスタムシェイプの逃げ道' },
};

// ─── 集約ロジック ───────────────────────────────────────
function loadCategorySeeds() {
  const result = [];
  for (const cat of CATEGORIES) {
    const seedPath = path.join(TEMPLATES_DIR, cat, 'showcase-seed.json');
    if (!fs.existsSync(seedPath)) {
      console.log(`[build-showcase] skip ${cat} (no showcase-seed.json)`);
      continue;
    }
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const slides = Array.isArray(seed.slides) ? seed.slides : [];
    if (!slides.length) {
      console.log(`[build-showcase] skip ${cat} (empty)`);
      continue;
    }
    result.push({ category: cat, slides });
  }
  return result;
}

function buildShowcasePlan(seeds) {
  const today = new Date().toISOString().slice(0, 10);
  const doc = {
    title: 'enostech-slides v8.0 — 全テンプレ展示デッキ',
    subtitle: 'カテゴリ別に 1 ページずつ全 56 テンプレを並べる',
    version: 'v8.0',
    date: today,
    theme: 'enostech',
    purpose: '新 ID 体系 (SECTION-1 / LIST-3 / CHART-A1 等) で全テンプレを一覧する',
    reader: 'デッキ作成者 / レビュワー / 新規テンプレ設計者',
    before_after: 'テンプレ ID と見た目の対応が頭に入っていない → カテゴリ単位で全テンプレを把握できる',
    deck_type: 'report',
    decision_focused: false,
    summary_required: false,
  };

  const sections = seeds.map((s, i) => {
    const label = CATEGORY_LABELS[s.category] || { code: s.category.toUpperCase(), name: s.category };
    const sectionId = `S${i + 1}`;
    const opener = {
      id: `${sectionId}_opener`,
      section_id: sectionId,
      template_id: 'SECTION-2',
      number: String(i + 1).padStart(2, '0'),
      title: `${label.code} カテゴリ`,
      subtitle: label.name,
      page_label: label.tagline || '',
    };
    // 各 slide にも id / section_id が無ければ付与する (seed 側に既にある場合は尊重)
    const normalized = s.slides.map((sl, j) => {
      const out = Object.assign({}, sl);
      if (!out.id) out.id = `${sectionId}_${j + 1}`;
      if (!out.section_id) out.section_id = sectionId;
      return out;
    });
    return {
      id: sectionId,
      code: label.code,
      name: label.name,
      slides: [opener, ...normalized],
    };
  });

  return { doc, sections };
}

// ─── メイン ─────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);
  if (args.help) return help();

  const projectRoot = path.join(__dirname, '..');
  const defaultOut = path.join(projectRoot, '..', '..', 'decks', 'template-showcase', 'plan.json');
  const outPath = path.resolve(args.out || defaultOut);
  const outDir = path.dirname(outPath);
  fs.mkdirSync(outDir, { recursive: true });

  const seeds = loadCategorySeeds();
  if (!seeds.length) {
    console.error('[build-showcase] !! どの category にも showcase-seed.json が無い');
    process.exit(2);
  }
  console.log(`[build-showcase] ${seeds.length} categories aggregated:`);
  for (const s of seeds) {
    console.log(`    ${s.category}: ${s.slides.length} slides`);
  }

  const plan = buildShowcasePlan(seeds);
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2), 'utf-8');
  const total = plan.sections.reduce((a, s) => a + s.slides.length, 0);
  console.log(`[build-showcase] wrote plan: ${outPath}  (${plan.sections.length} sections, ${total} slides)`);

  if (args.skipPptx) return;

  const pptxPath = path.resolve(args.pptx || path.join(outDir, 'draft.pptx'));
  const buildDeck = path.join(projectRoot, 'scripts', 'render', 'build-deck.js');
  console.log(`[build-showcase] running build-deck.js → ${pptxPath}`);
  const r = spawnSync('node', [buildDeck, '-i', outPath, '-o', pptxPath], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`[build-showcase] !! build-deck.js exit ${r.status}`);
    process.exit(r.status || 1);
  }
  console.log(`[build-showcase] done: ${pptxPath}`);
}

if (require.main === module) main();
