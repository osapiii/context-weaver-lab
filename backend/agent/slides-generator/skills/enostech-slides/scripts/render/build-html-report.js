#!/usr/bin/env node
/* eslint-disable no-console */
// ==========================================================================
// --------------------------------------------------------------------------
//  PPTX 補足 HTML レポートのビルド + レンダ。
//
//    1. card.js を完全純粋化: ctx の mutation を廃止し、戻り値で集計を返す
//       (renderCard(card, deckCtx) => { html, usedTypes, widgetCount })
//    2. 2 段パイプラインを明示的に分離:
//         BUILD phase  : plan.json + palette.yml + thumbnails
//                        → decks/<slug>/build/report-dto.json (ディスク書き出し)
//         RENDER phase : build/report-dto.json を読み直し → zod.parse →
//                        renderHtmlReport(dto) → レポート.html 書き出し
//    3. zod schema を .strict() 化、各スキーマに schemaVersion: '9.11' フィールド
//
//  CLI:
//    node build-html-report.js <deck-slug>            # build → render 一気通貫
//    node build-html-report.js <deck-slug> --build-only
//    node build-html-report.js <deck-slug> --skip-build
//    node build-html-report.js --plan path/to/plan.json    # 旧 CLI 互換 (互換)
//    node build-html-report.js --plan ... --skip-build     # 同上
// ==========================================================================

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { HtmlReportSchema } = require('./lib/html-report-schema');
const { buildReportDto } = require('./lib/build-report-dto');
const { renderHtmlReport } = require('./lib/render-html');

// プロジェクトルートから decks/<slug>/ を解決するため、skill フォルダの
// 2 つ上を decks の親と見なす。
function resolveDeckDirFromSlug(slug) {
  // 1) {cwd}/decks/<slug>
  const cwdCand = path.resolve(process.cwd(), 'decks', slug);
  if (fs.existsSync(path.join(cwdCand, 'plan.json'))) return cwdCand;
  // 2) ../../decks/<slug> (skill の中から実行された場合)
  const fromSkill = path.resolve(__dirname, '..', '..', '..', '..', 'decks', slug);
  if (fs.existsSync(path.join(fromSkill, 'plan.json'))) return fromSkill;
  // 3) スラッグそのものがディレクトリパスとして与えられた場合
  if (fs.existsSync(path.join(slug, 'plan.json'))) return path.resolve(slug);
  return null;
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------
function parseCli(argv) {
  const opts = {
    quiet: false, thumbnails: true, embedThumbnails: true,
    buildOnly: false, skipBuild: false,
  };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--plan' || k === '-i') opts.planPath = argv[++i];
    else if (k === '--out' || k === '-o') opts.outPath = argv[++i];
    else if (k === '--dto') opts.dtoPath = argv[++i];
    else if (k === '--title') opts.titleOverride = argv[++i];
    else if (k === '--quiet' || k === '-q') opts.quiet = true;
    else if (k === '--no-thumbnails') opts.thumbnails = false;
    else if (k === '--external-thumbnails') opts.embedThumbnails = false;
    else if (k === '--build-only') opts.buildOnly = true;
    else if (k === '--skip-build') opts.skipBuild = true;
    else if (k === '--help' || k === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 30).join('\n'));
      process.exit(0);
    } else if (k.startsWith('-')) {
      console.error(`Unknown flag: ${k}`); process.exit(2);
    } else {
      positional.push(k);
    }
  }
  // <deck-slug> 位置引数があれば planPath を補完
  if (!opts.planPath && positional.length) {
    const slug = positional[0];
    const deckDir = resolveDeckDirFromSlug(slug);
    if (!deckDir) {
      console.error(`デッキが見つかりません: <deck-slug>=${slug} (decks/${slug}/plan.json なし)`);
      process.exit(2);
    }
    opts.deckSlug = slug;
    opts.deckDir = deckDir;
    opts.planPath = path.join(deckDir, 'plan.json');
  }
  if (!opts.planPath && !opts.dtoPath) {
    console.error('使い方: node build-html-report.js <deck-slug> [--build-only|--skip-build]');
    console.error('       node build-html-report.js --plan path/to/plan.json (互換)');
    process.exit(2);
  }
  if (opts.buildOnly && opts.skipBuild) {
    console.error('--build-only と --skip-build は同時指定できません');
    process.exit(2);
  }
  return opts;
}

// --------------------------------------------------------------------------
// BUILD phase: plan.json → decks/<slug>/build/report-dto.json
// --------------------------------------------------------------------------
function runBuildPhase({ planPath, deckDir, slug, opts, titleOverride, log }) {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const dto = buildReportDto({
    plan,
    deckDir,
    slug,
    opts: { embedThumbnails: opts.embedThumbnails, thumbnails: opts.thumbnails },
    titleOverride,
    generatedAt: new Date().toISOString(),
  });
  // ディスク書き出し: decks/<slug>/build/report-dto.json
  const buildDir = path.join(deckDir, 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  const dtoPath = path.join(buildDir, 'report-dto.json');
  fs.writeFileSync(dtoPath, JSON.stringify(dto, null, 2), 'utf8');
  const dtoBytes = fs.statSync(dtoPath).size;
  log(`📦 BUILD: ${dtoPath} を書き出しました (${(dtoBytes / 1024).toFixed(1)} KB)`);
  log(`   カード ${dto.cards.length} 件 / サムネ ${dto.cards.filter((c) => c.thumbnail).length} 枚`);
  return { dtoPath, dto };
}

// --------------------------------------------------------------------------
// RENDER phase: build/report-dto.json → zod.parse → render → レポート.html
// --------------------------------------------------------------------------
function runRenderPhase({ dtoPath, outPath, log }) {
  // ① ディスクから読み直し (純粋に DTO を信じるため)
  if (!fs.existsSync(dtoPath)) throw new Error(`report-dto.json が見つかりません: ${dtoPath}`);
  const raw = JSON.parse(fs.readFileSync(dtoPath, 'utf8'));
  // ② zod 厳格検証
  let dto;
  try {
    dto = HtmlReportSchema.parse(raw);
  } catch (e) {
    if (e && e.issues) {
      console.error('[build-html-report] ❌ DTO の zod 検証に失敗しました:');
      e.issues.forEach((iss) => console.error(`   - ${iss.path.join('.')} : ${iss.message}`));
    }
    throw e;
  }
  // ③ 補足ゼロならレポート生成しない
  if (dto.cards.length === 0) {
    log(`⏭  補足カード 0 件のためレポート.html は生成しません。`);
    return { skipped: true, outPath: null };
  }
  // ④ 純粋関数で HTML 生成
  const rendered = renderHtmlReport(dto);
  // ⑤ ファイル書き出し
  const out = outPath || path.join(path.dirname(path.dirname(dtoPath)), 'レポート.html');
  fs.writeFileSync(out, rendered.html, 'utf8');
  const sizeKB = (Buffer.byteLength(rendered.html, 'utf8') / 1024).toFixed(1);
  log(`🖼  RENDER: ${out} (${sizeKB} KB)`);
  log(`   PPTX ${dto.deckMeta.totalSlides} 枚中 ${dto.deckMeta.slideCount} 枚 + 章レベル ${dto.deckMeta.chapterCount} 件に補足`);
  if (rendered.thumbCount) {
    log(`   サムネ ${rendered.thumbCount} 枚 (画像合計 ${(rendered.thumbBytes / 1024).toFixed(0)} KB)`);
  }
  if (rendered.widgetCount) {
    log(`   ウィジェット ${rendered.widgetCount} 個 (${rendered.widgetTypes.join(', ')})`);
  }
  if (dto.palette) {
    log(`   palette: ${dto.palette.name} → accent ${dto.palette.accent}`);
  }
  return { skipped: false, outPath: out, sizeKB, ...rendered, dto };
}

// --------------------------------------------------------------------------
// メインフロー
// --------------------------------------------------------------------------
function buildHtmlReport(opts) {
  const log = (msg) => { if (!opts.quiet) console.error(`[build-html-report] ${msg}`); };

  // パスの解決
  let planAbs = opts.planPath ? path.resolve(opts.planPath) : null;
  let deckDir = opts.deckDir || (planAbs ? path.dirname(planAbs) : null);
  let slug = opts.deckSlug || (deckDir ? path.basename(deckDir) : 'unknown');

  // dtoPath が直接指定されている場合 (--dto), それを尊重
  let dtoPath = opts.dtoPath ? path.resolve(opts.dtoPath) : (deckDir ? path.join(deckDir, 'build', 'report-dto.json') : null);

  // ── BUILD phase ──
  if (!opts.skipBuild) {
    if (!planAbs || !fs.existsSync(planAbs)) throw new Error(`plan.json が見つかりません: ${planAbs}`);
    const buildResult = runBuildPhase({
      planPath: planAbs, deckDir, slug, opts, titleOverride: opts.titleOverride, log,
    });
    dtoPath = buildResult.dtoPath;
  } else {
    log(`⏭  BUILD phase をスキップして既存 ${dtoPath} を使います`);
  }

  if (opts.buildOnly) {
    log(`🛑 --build-only 指定のため RENDER phase は実行しません`);
    return { phase: 'build-only', dtoPath };
  }

  // ── RENDER phase ──
  return { phase: 'rendered', dtoPath, ...runRenderPhase({ dtoPath, outPath: opts.outPath, log }) };
}

if (require.main === module) {
  try {
    const opts = parseCli(process.argv);
    buildHtmlReport(opts);
    process.exit(0);
  } catch (e) {
    console.error('[build-html-report] ❌', e.stack || e.message || e);
    process.exit(1);
  }
}

module.exports = {
  buildHtmlReport,
  // 各フェーズも単独で呼べるように
  runBuildPhase,
  runRenderPhase,
};
