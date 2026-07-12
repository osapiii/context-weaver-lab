#!/usr/bin/env node
/**
 * build-deck.js
 * ==========================
 * Phase 2 JSON を読み込み、テンプレ純粋関数群にディスパッチして .pptx を出力する。
 *
 * 旧 example-deck.js の置き換え。
 *
 * 使い方:
 *   node scripts/render/build-deck.js -i deck.json -o out.pptx
 *   node scripts/render/build-deck.js -i deck.json -o out.pptx --theme=mono
 *   cat deck.json | node scripts/render/build-deck.js -o out.pptx
 *
 * 期待 JSON 構造:
 *   {
 *     doc: { title, theme, ... },
 *     sections: [
 *       { id, code, name, slides: [...] },
 *       ...
 *     ]
 *   }
 *
 * sections[] を平坦化して slides を並べ、template_id でテンプレ関数を呼ぶ。
 */

'use strict';

const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');

// ─── トークン (テーマ適用) ───
const T = require(path.join(__dirname, '..', '..', 'assets', 'tokens'));

// ─── palette.yml SSOT ───
const paletteYml = require(path.join(__dirname, '..', '..', 'assets', 'palette-yml'));

// ─── Atoms 層 ───
const atoms = require('./atoms');
const schemas = require('./schemas');
const structureQa = require('./lib/structure-qa');

// ─── Template 層 ───
//   templates/{category}/index.js が registry を export する
//   build-deck.js はそれを集約して使う (require 行を 60+ 個並べる必要なし)
const { TEMPLATE_REGISTRY } = require('./templates');

// ─── Diagram / Chart / Scene atoms (テンプレ内部から呼ばれる) ───
const { drawDIAG02Cycle }       = require('./diagrams/diag-02-cycle');
const { drawDIAG03Stepup }      = require('./diagrams/diag-03-stepup');
const { drawDIAG04BeforeAfter } = require('./diagrams/diag-04-before-after');
const { drawDIAG05Pyramid }     = require('./diagrams/diag-05-pyramid');
const { drawDIAG06Timeline }    = require('./diagrams/diag-06-timeline');
const { drawDIAG07Radial }      = require('./diagrams/diag-07-radial');
const { drawDIAG08Matrix }      = require('./diagrams/diag-08-matrix');
const { drawDIAG09Scatter }     = require('./diagrams/diag-09-scatter');

const { drawCHART01BarCol }    = require('./charts/chart-01-bar-col');
const { drawCHART02BarStacked } = require('./charts/chart-02-bar-stacked');
const { drawCHART03BarHoriz }  = require('./charts/chart-03-bar-horiz');
const { drawCHART04Line }      = require('./charts/chart-04-line');
const { drawCHART05Combo }     = require('./charts/chart-05-combo');
const { drawCHART06Waterfall } = require('./charts/chart-06-waterfall');
const { drawCHART07Doughnut }  = require('./charts/chart-07-doughnut');
const { drawCHART08Scatter }   = require('./charts/chart-08-scatter');
const { drawCHART09Radar }     = require('./charts/chart-09-radar');

const { drawScene01ThreeActors }   = require('./scenes/scene-01-three-actors');
const { drawScene02HubSpoke }      = require('./scenes/scene-02-hub-spoke');
const { drawScene03StageFlow }     = require('./scenes/scene-03-stage-flow');
const { drawScene04BusinessModel } = require('./scenes/scene-04-business-model');
const { drawScene05SystemArch }    = require('./scenes/scene-05-system-arch');
const { drawScene06FlowChart }     = require('./scenes/scene-06-flowchart');

const DIAGRAM_REGISTRY = {
  'DIAG-02': drawDIAG02Cycle,
  'DIAG-03': drawDIAG03Stepup,
  'DIAG-04': drawDIAG04BeforeAfter,
  'DIAG-05': drawDIAG05Pyramid,
  'DIAG-06': drawDIAG06Timeline,
  'DIAG-07': drawDIAG07Radial,
  'DIAG-08': drawDIAG08Matrix,
  'DIAG-09': drawDIAG09Scatter,
};

// ───────────────────────────────────────────────────────
// Chart レジストリ
// ───────────────────────────────────────────────────────
const CHART_REGISTRY = {
  'CHART-01': drawCHART01BarCol,
  'CHART-02': drawCHART02BarStacked,
  'CHART-03': drawCHART03BarHoriz,
  'CHART-04': drawCHART04Line,
  'CHART-05': drawCHART05Combo,
  'CHART-06': drawCHART06Waterfall,
  'CHART-07': drawCHART07Doughnut,
  'CHART-08': drawCHART08Scatter,
  'CHART-09': drawCHART09Radar,
};

// ───────────────────────────────────────────────────────
// Scene レジストリ
// ───────────────────────────────────────────────────────
// shape Atom を組み合わせたプリセットシーン。SECSUMMARY-1 から diagram キー経由で呼べる。
const SCENE_REGISTRY = {
  'SCENE-01': drawScene01ThreeActors,
  'SCENE-02': drawScene02HubSpoke,
  'SCENE-03': drawScene03StageFlow,
  'SCENE-04': drawScene04BusinessModel,
  'SCENE-05': drawScene05SystemArch,
  'SCENE-06': drawScene06FlowChart,
};

// ───────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────

// 1 ページに収まる ref_table 行数の上限 (8 行に保守的設定、9 行ギリギリは DATA-4 のフッター注記と干渉する経験則)。
// slideH=5.625 / contentBot=5.15 / footerY=5.28 / タイトルブロック概算 1.05
// → 利用可能 4.10" 内に header(0.38) + body(0.40 * N) を収めると N ≤ 9.
// 9 行を越えると、本文がフッター領域 (5.28) に被って、ページ番号と重なる。
const DATA4_MAX_ROWS_PER_PAGE = 8;

/**
 * deckJson を走査し、template_id="DATA-4" かつ ref_table が
 * DATA4_MAX_ROWS_PER_PAGE を超えるスライドを、複数スライドに自動分割する。
 *
 * 1 ページ目は元のタイトル、2 ページ目以降は「タイトル（続き 2/3）」のように
 * 通し番号を付ける。slide.id は "S17", "S17b", "S17c" のサフィックス命名。
 *
 * 副作用なし — 新しい deckJson を返す (元は変更しない)。
 */

// ───────────────────────────────────────────────────────
// v10.1.4: visual_assets[] を VISUAL-3 スライドに展開
// ───────────────────────────────────────────────────────
//
// 各 slide が `visual_assets: [{kind: 'braindump-illust', src, caption}]` を持つ場合、
// その slide の直後に VISUAL-3 (画像主体) を 1 枚自動挿入する。
//
// braindump-illust.py が生成した PNG (decks/{slug}/braindump_assets/QN.png) を
// VISUAL-3 で全画面表示し、osanai 氏の「Q 単位 visual を本文ページ近傍に配置したい」
// 要望 (2026-05-08) を構造で解決する。
//
// schema には visual_assets を残し、build-deck で展開時に取り除く (slide 本体の
// 描画には影響させない)。
function expandVisualAssetsToVisualSlides(deckJson) {
  if (!deckJson || !Array.isArray(deckJson.sections)) return deckJson;
  const newSections = deckJson.sections.map(sec => {
    const newSlides = [];
    for (const slide of (sec.slides || [])) {
      const assets = Array.isArray(slide.visual_assets) ? slide.visual_assets : [];
      // 元 slide は visual_assets を残したまま push (描画 template には影響しない)
      newSlides.push(slide);
      for (const a of assets) {
        if (!a || !a.src) continue;
        const visualSlide = {
          id: `${slide.id || 'visual'}-vis-${(a.kind || 'asset').replace(/[^a-zA-Z0-9-]/g, '')}`,
          section_id: slide.section_id,
          template_id: 'VISUAL-3',
          title: a.caption || slide.title || '',
          subtitle: '',
          image_path: a.src,
          // 元 chapter のナビ情報を継承 (subsection 等)
          subsection: slide.subsection,
        };
        newSlides.push(visualSlide);
      }
    }
    return Object.assign({}, sec, { slides: newSlides });
  });
  return Object.assign({}, deckJson, { sections: newSections });
}

function splitOversizedReferenceSlides(deckJson) {
  if (!deckJson || !Array.isArray(deckJson.sections)) return deckJson;

  const newSections = deckJson.sections.map(sec => {
    const newSlides = [];
    for (const slide of (sec.slides || [])) {
      if (slide.template_id !== 'DATA-4') {
        newSlides.push(slide);
        continue;
      }
      const refs = Array.isArray(slide.ref_table) ? slide.ref_table : [];
      if (refs.length <= DATA4_MAX_ROWS_PER_PAGE) {
        newSlides.push(slide);
        continue;
      }

      // 分割
      const totalPages = Math.ceil(refs.length / DATA4_MAX_ROWS_PER_PAGE);
      const baseTitle = slide.title || '本資料の主要な参考情報';
      const suffixes = ['', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      for (let p = 0; p < totalPages; p++) {
        const start = p * DATA4_MAX_ROWS_PER_PAGE;
        const chunk = refs.slice(start, start + DATA4_MAX_ROWS_PER_PAGE);
        const newSlide = Object.assign({}, slide, {
          id: (slide.id || 'SR') + (suffixes[p] || `_p${p+1}`),
          title: p === 0
            ? baseTitle
            : `${baseTitle}（続き ${p + 1}/${totalPages}）`,
          ref_table: chunk,
        });
        // 2 ページ目以降は subtitle を「前ページからの続き」に差し替え
        if (p > 0) {
          newSlide.subtitle = `前ページに続く ${chunk.length} 件の参考情報。`;
        }
        newSlides.push(newSlide);
      }
      console.log(`[build-deck] DATA-4 分割: ${slide.id || '?'} (${refs.length} 行) → ${totalPages} ページ`);
    }
    return Object.assign({}, sec, { slides: newSlides });
  });

  return Object.assign({}, deckJson, { sections: newSections });
}

// ctx 初期化
// ───────────────────────────────────────────────────────

function initContext(deckJson, pres, opts) {
  // v10.1.4: visual_assets[] → VISUAL-3 スライド自動展開 (DATA-4 分割の前に実施)
  deckJson = expandVisualAssetsToVisualSlides(deckJson);
  deckJson = expandVisualAssetsToVisualSlides(deckJson);
  deckJson = splitOversizedReferenceSlides(deckJson);

  const C = T.color;
  const L = T.layout;
  const F = T.font;
  const SZ = T.size;

  // 章リストを抽出して setDeckSections に渡す
  const sections = Array.isArray(deckJson.sections) ? deckJson.sections : [];
  const sectionsForReg = sections.map(s => ({
    id: s.id || '',
    name: s.name || s.code || '(no-name)',
    lead: s.lead,
    // v9 → v8 normalize 時に付与された _v9_role を引き継ぐ。
    _v9_role: s._v9_role || null,
  }));

  // 総ページ数 = 全 slides の総和
  const totalPages = sections.reduce(
    (sum, sec) => sum + (Array.isArray(sec.slides) ? sec.slides.length : 0),
    0,
  );

  const ctx = {
    T, L, C, F, SZ,
    pres,
    deckSections: [],
    sectionsMap: {},
    totalPages,
    refsByNum: _buildRefsByNum(deckJson),
    pageNum: { value: 0 },
    assetsRoot: opts.assetsRoot || path.join(__dirname, '..', '..'),
    diagramRegistry: DIAGRAM_REGISTRY,
    chartRegistry: CHART_REGISTRY,
    sceneRegistry: SCENE_REGISTRY,
    // 既存テンプレは ctx.doc を参照していないため副作用なし。
    doc: deckJson.doc || {},
  };

  // 章リスト確定
  if (sectionsForReg.length > 0) {
    atoms.setDeckSections(ctx, sectionsForReg);
  }

  return ctx;
}

/**
 * doc.references[] からインライン参照番号 → URL のマップを構築。
 * raw_text_runs の {ref: N} が ctx.refsByNum[N] で URL 解決できるようにする。
 */
function _buildRefsByNum(deckJson) {
  const out = {};

  // (a) doc.references[] から取り込む (新形式)
  const refs = (deckJson.doc && deckJson.doc.references) || [];
  refs.forEach(r => {
    if (r && typeof r === 'object' && r.num != null && r.url) {
      out[r.num] = r.url;
    }
  });

  // (b) 全スライドの ref_table[] からも (N) → URL を集積。
  //   各スライドが ref_table を持つ ENOSTECH 標準フローでは
  //   doc.references[] が無いケースが多いため、ref_table.title の
  //   "(N) ページタイトル" 形式から N を抜き出して URL マップを補完する。
  //   既に out[N] が doc.references で埋まっていればそちらを優先。
  const sections = Array.isArray(deckJson.sections) ? deckJson.sections : [];
  for (const sec of sections) {
    for (const slide of (sec.slides || [])) {
      const table = Array.isArray(slide.ref_table) ? slide.ref_table : [];
      for (const row of table) {
        if (!row || !row.title || !row.url) continue;
        const m = String(row.title).match(/^\s*\((\d+)\)/);
        if (m) {
          const num = parseInt(m[1], 10);
          if (out[num] === undefined) {
            out[num] = row.url;
          }
        }
      }
    }
  }

  return out;
}

// ───────────────────────────────────────────────────────
// メインビルド
// ───────────────────────────────────────────────────────

function buildDeck(deckJson, opts = {}) {
  const theme = opts.theme || (deckJson.doc && deckJson.doc.theme) || 'mono';
  T.useTheme(theme);
  //   1. plan.json と同じディレクトリの palette.yml が存在 → そのまま読む (SSOT)
  //   2. 存在しない → opts.design / 親方向 DESIGN.md / default の順で生成して保存
  //   3. opts.regeneratePalette (CLI --regenerate-palette) → 強制再生成
  //
  // これにより、ユーザーが palette.yml を手編集していれば DESIGN.md より優先される。
  // 「DESIGN.md を変えたから palette を作り直したい」時は palette.yml を rm するか
  // --regenerate-palette フラグを使う。
  if (opts.inputPath) {
    const planDir = path.dirname(path.resolve(opts.inputPath));
    const paletteYmlPath = path.join(planDir, 'palette.yml');

    const result = paletteYml.ensurePaletteYml(paletteYmlPath, {
      designPath: opts.design || (deckJson.doc && deckJson.doc.design),
      startDir: planDir,
      regenerate: !!opts.regeneratePalette,
      verbose: opts.verbose,
    });
    const overrides = paletteYml.paletteToOverrides(result.palette);
    T.useDesignTokens(overrides);
  } else {
    // stdin 経由で plan.json が来た場合は palette.yml の場所が決まらないので、
    const designPath = opts.design || (deckJson.doc && deckJson.doc.design);
    if (designPath) {
      try { T.useDesignFile(designPath); }
      catch (e) { console.warn('[build-deck] failed to apply design.md:', e.message); }
    } else {
      T.clearDesignOverrides();
    }
  }

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';  // 13.33 x 7.5 ではなく ENOSTECH 仕様 (10 x 5.625)
  pres.defineLayout({ name: 'ENOSTECH', width: 10, height: 5.625 });
  pres.layout = 'ENOSTECH';

  // v10.0-β: ENOSTECH SlideMaster 群を一括登録 (PowerPoint「新しいスライド ▼」に並ぶ)
  // doc.embed_master_layouts: false で opt-out。default = true。
  // 既存の pres.addSlide() は masterName を渡さないので干渉ゼロ (= 既存描画 100% 維持)
  if (deckJson.doc && deckJson.doc.embed_master_layouts === false) {
    if (process.env.ENOSTECH_VERBOSE) {
      console.log('[v10b] embed_master_layouts: false — SlideMaster 登録スキップ');
    }
  } else {
    try {
      const { registerEnostechMasters } = require('./lib/master-layouts');
      const count = registerEnostechMasters(pres, { includeOptional: true });
      if (process.env.ENOSTECH_VERBOSE) {
        console.log(`[v10b] registered ${count} ENOSTECH SlideMasters`);
      }
    } catch (e) {
      console.warn(`[v10b] master-layouts 登録失敗 (継続): ${e.message}`);
    }
  }

  const ctx = initContext(deckJson, pres, opts);

  // v10.1.4: visual_assets[] → VISUAL-3 スライド自動展開 (buildDeck 側)
  deckJson = expandVisualAssetsToVisualSlides(deckJson);
  deckJson = splitOversizedReferenceSlides(deckJson);

  const sections = Array.isArray(deckJson.sections) ? deckJson.sections : [];
  let pageCounter = 0;
  const validationErrors = [];
  const validationSkips = [];

  sections.forEach(sec => {
    const slides = Array.isArray(sec.slides) ? sec.slides : [];
    slides.forEach(slideJson => {
      pageCounter++;
      ctx.pageNum.value = pageCounter;

      const tid = slideJson.template_id;
      const renderFn = TEMPLATE_REGISTRY[tid];

      if (!renderFn) {
        console.warn(`[build-deck] 未登録テンプレ "${tid}" (slide ${slideJson.id || pageCounter}) — スキップ`);
        return;
      }
      const validation = schemas.validateSlideByTemplateId(slideJson);
      if (!validation.ok) {
        validationErrors.push(validation.error.toReportObject());
        console.error(`[build-deck] ⚠ Zod 検証 fatal: ${validation.error.message}`);
      } else if (validation.skipped) {
        validationSkips.push(tid);
      }
      if (slideJson.diagram && slideJson.diagram.template_id) {
        const dv = schemas.validateSlideByTemplateId(slideJson.diagram);
        if (!dv.ok) {
          // ネストエラーは slide_id にネストパスを付ける
          const rep = dv.error.toReportObject();
          rep.slide_id = `${slideJson.id || '?'} > diagram`;
          validationErrors.push(rep);
          console.error(`[build-deck] ⚠ Zod 検証 fatal (nested diagram): ${dv.error.message}`);
        }
      }

      const slide = pres.addSlide();
      // 自動でハイパーリンク (青文字 + 下線) に変換する。
      //
      // これにより、subcopy (addTitleBlock 経由) だけでなく、本文・カード本文・
      // テーブルセル・キャプション・脚注ラベルなど全テンプレの全 addText 呼び出しが
      // 一箇所で参照リンク化される。expandRunsInlineRefs / expandInlineRefs は
      // (N) パターンが無い run / string をそのまま返すため、装飾ラベル
      // (Before / After / 01 / 02 等) には副作用ゼロ。
      const __origAddText = slide.addText.bind(slide);
      slide.addText = function patchedAddText(content, opts) {
        let processed = content;
        if (typeof content === 'string') {
          processed = atoms.expandInlineRefs(content, ctx, {});
        } else if (Array.isArray(content)) {
          processed = atoms.expandRunsInlineRefs(content, ctx);
        }
        return __origAddText(processed, opts);
      };
      // 自動でハイパーリンク (青文字 + 下線) に変換する。
      //
      // DATA-2 / COMPARE-3 / DATA-3 / DATA-4 など addTable 経由のテンプレでは
      // (N) が黒文字のまま残ってしまっていた (R-DESIGN-11 ベアフット S15 で発覚)。
      //
      // セルの形式は pptxgenjs 仕様で以下のいずれか:
      //   - 文字列 (plain string)
      //   - { text: string, options?: {...} }
      //   - { text: Array<{text, options}>, options?: {...} }
      // text フィールドだけを (N) 展開し、options は元のまま渡す。
      // 規則テキスト用に cell-level の text props (color/fontSize/fontFace/bold/italic/
      // underline/charSpacing/align/lang) を baseOptions として継承する。
      const __origAddTable = slide.addTable.bind(slide);
      const TEXT_PROPS_FOR_RUN = ['color', 'fontSize', 'fontFace', 'bold', 'italic',
        'underline', 'charSpacing', 'align', 'lang', 'subscript', 'superscript', 'strike'];
      function __pickRunBaseOpts(cellOpts) {
        if (!cellOpts || typeof cellOpts !== 'object') return {};
        const out = {};
        for (const k of TEXT_PROPS_FOR_RUN) {
          if (cellOpts[k] !== undefined) out[k] = cellOpts[k];
        }
        return out;
      }
      function __processTableCell(cell) {
        // plain string cell
        if (typeof cell === 'string') {
          const expanded = atoms.expandInlineRefs(cell, ctx, {});
          if (typeof expanded === 'string') return cell;
          return { text: expanded };
        }
        if (!cell || typeof cell !== 'object') return cell;
        const inner = cell.text;
        const cellOpts = cell.options || {};
        if (typeof inner === 'string') {
          const baseOpts = __pickRunBaseOpts(cellOpts);
          const expanded = atoms.expandInlineRefs(inner, ctx, baseOpts);
          if (typeof expanded === 'string') return cell;
          return Object.assign({}, cell, { text: expanded });
        }
        if (Array.isArray(inner)) {
          const expanded = atoms.expandRunsInlineRefs(inner, ctx);
          // expandRunsInlineRefs は常に新配列を返すが、副作用ゼロ (no-ref時は同等の runs)
          return Object.assign({}, cell, { text: expanded });
        }
        return cell;
      }
      slide.addTable = function patchedAddTable(rows, opts) {
        if (!Array.isArray(rows)) return __origAddTable(rows, opts);
        const processedRows = rows.map(row => {
          if (!Array.isArray(row)) return row;
          return row.map(__processTableCell);
        });
        return __origAddTable(processedRows, opts);
      };

      try {
        renderFn(slide, slideJson, ctx);
        // (osanai 指示): footer_url が JSON にあれば全テンプレ共通でフッタに「タイトル | URL」を表示
        if (slideJson.footer_url) {
          atoms.addFootnote(ctx, slide, [{
            label: slideJson.footer_label || slideJson.footer_url,
            url:   slideJson.footer_url,
          }]);
        }
      } catch (e) {
        console.error(`[build-deck] ${tid} (${slideJson.id || pageCounter}) でエラー:`, e.message);
        if (opts.verbose) console.error(e.stack);
      }
    });
  });
  const globalIssues = validateDeckGlobal(deckJson);
  for (const g of globalIssues) {
    if (g.level === 'fatal') {
      validationErrors.push({
        template_id: g.rule,
        slide_id: g.target,
        issues: [{ path: ['deck'], message: g.message }],
      });
    } else {
      console.warn(`[build-deck] ⚠ ${g.message}`);
    }
  }
  if (validationErrors.length > 0) {
    console.error(`\n🚨 Zod 検証 fatal: ${validationErrors.length} 件`);
    for (const e of validationErrors) {
      console.error(`  - ${e.template_id} (slide ${e.slide_id})`);
      for (const i of e.issues) {
        console.error(`      ${i.path.join('.')} → ${i.message}`);
      }
    }
    //   - 明示で外したい時のみ NO_STRICT_VALIDATE=1 / --no-strict-validate を使う
    //   - opts.strictValidate === false が「外す意思表示」と扱われる
    const strictDisabled = process.env.NO_STRICT_VALIDATE === '1' || opts.strictValidate === false;
    if (!strictDisabled) {
      throw new Error(`Zod 検証 fatal ${validationErrors.length} 件で停止 (default strict / NO_STRICT_VALIDATE=1 で無効化)`);
    }
  }
  if (validationSkips.length > 0) {
    const uniq = Array.from(new Set(validationSkips));
    console.warn(`[build-deck] Zod スキーマ未登録のためスキップ: ${uniq.join(', ')} (${validationSkips.length} スライド)`);
  }
  if (validationErrors.length === 0 && validationSkips.length === 0) {
    console.log('[build-deck] ✓ Zod 検証 全スライド pass');
  }
  // 検証エラーを JSON ファイルにダンプ (Phase 2 自己修復ループ用)
  if (opts.validationReportPath) {
    const fs = require('fs');
    fs.writeFileSync(opts.validationReportPath, JSON.stringify({
      ok: validationErrors.length === 0,
      errors: validationErrors,
      skipped_template_ids: Array.from(new Set(validationSkips)),
    }, null, 2));
    console.log(`[build-deck] 検証レポート: ${opts.validationReportPath}`);
  }

  return pres;
}

// ───────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────

/**
 * SchemaQA-09: DATA-4 ref_table 1 ページ上限 8 行を超えたら warn
 * SchemaQA-10: 本文中 (N) と ref_table の対応整合
 *
 * 旧 schema-qa.py の Python 実装を JS に移植し、build-deck.js 単一の検証フローに集約。
 *
 * 旧 SchemaQA-12 (FlowChart 必須) / SchemaQA-17 (HubSpoke 上限) は
 * 削除し、StructureQA-21 / StructureQA-22 に移管した
 * (`scripts/render/lib/structure-qa.js` + `deck-structures/learning-deck.js`)。
 * Template に依存する検査は StructureQA に集約、Template 非依存の構造ルール
 * (DATA-4 の物理上限 / (N) ↔ ref_table 整合) のみ本関数に残す。
 *
 * @param {object} deckJson
 * @returns {Array<{rule, level, message, target}>}
 */
function validateDeckGlobal(deckJson) {
  const issues = [];
  const allSlides = [];
  for (const sec of (deckJson.sections || [])) {
    for (const sl of (sec.slides || [])) {
      allSlides.push(sl);
    }
  }

  // v10.1.5: SchemaQA-08 — braindump 起点デッキは crystallization_status: 'crystallized' 必須
  //   plan.json が braindump-to-plan.py の下地のまま (crystallization_status: 'draft')
  //   でビルドされる事故を防ぐ。skip_braindump=true なら除外。
  //   旧式 deck (compact_mode 未指定 / draft マーカーなし) は影響なし。
  const doc = deckJson.doc || {};
  const isBraindumpDriven = !!doc.compact_mode;
  const skipBraindump = !!doc.skip_braindump;
  if (isBraindumpDriven && !skipBraindump) {
    const status = doc.crystallization_status || null;
    if (status === 'draft') {
      issues.push({
        rule: 'SchemaQA-08',
        level: 'fatal',
        target: 'doc.crystallization_status',
        message: (
          'doc.crystallization_status が \'draft\' のまま (braindump-to-plan.py の下地が結晶化されていない)。 ' +
          'plan.draft.json を読んで結晶化作業を行い、doc.crystallization_status を \'crystallized\' に更新してから build してください (Step 2-2)。'
        ),
      });
    } else if (!status) {
      issues.push({
        rule: 'SchemaQA-08',
        level: 'fatal',
        target: 'doc.crystallization_status',
        message: (
          'doc.compact_mode: true なのに doc.crystallization_status が未設定。 ' +
          '結晶化済みなら \'crystallized\' / 未着手なら \'draft\' を明示してください。'
        ),
      });
    }
  }

  // SchemaQA-09: DATA-4 ref_table 9 行超で warn (build-deck.js が自動分割するため warn)
  for (const sl of allSlides) {
    if (sl.template_id !== 'DATA-4') continue;
    const refTable = Array.isArray(sl.ref_table) ? sl.ref_table : [];
    if (refTable.length > 8) {
      issues.push({
        rule: 'SchemaQA-09',
        level: 'warn',
        target: sl.id,
        message: `SchemaQA-09: ${sl.id} (DATA-4) ref_table ${refTable.length} 行 (1 ページ上限 8)。build-deck.js が自動分割するが、論理分割を推奨`,
      });
    }
  }

  // SchemaQA-10: 本文中 (N) と ref_table の対応整合 (両方向 warn)
  const REF_PAREN_RE = /\((\d+)\)/g;
  const SKIP_TIDS = new Set(['DATA-4', 'SECTION-6', 'SECTION-1', 'SECTION-2', 'SECTION-4', 'SECTION-5', 'FRAMING-3', 'VISUAL-8']);
  for (const sl of allSlides) {
    if (SKIP_TIDS.has(sl.template_id)) continue;
    // 本文文字列を集める (subtitle / bullets / cards / cols / items / blocks 等から再帰)
    const textParts = [];
    function collect(v) {
      if (!v) return;
      if (typeof v === 'string') { textParts.push(v); return; }
      if (Array.isArray(v)) { v.forEach(collect); return; }
      if (typeof v === 'object') { Object.values(v).forEach(collect); }
    }
    for (const k of Object.keys(sl)) {
      if (k === 'template_id' || k === 'id' || k === 'ref_table' || k === 'slide_goal' || k === 'illustration_decision' || k === 'illustration') continue;
      collect(sl[k]);
    }
    const fullText = textParts.join(' ');
    const inBody = new Set();
    let m;
    while ((m = REF_PAREN_RE.exec(fullText))) inBody.add(m[1]);

    // ref_table の (N) を抽出
    const inTable = new Set();
    for (const r of (sl.ref_table || [])) {
      const t = (r && r.title) || '';
      let mm;
      const re2 = /\((\d+)\)/g;
      while ((mm = re2.exec(t))) inTable.add(mm[1]);
    }

    // 本文 - ref_table
    for (const n of inBody) {
      if (!inTable.has(n)) {
        issues.push({
          rule: 'SchemaQA-10',
          level: 'warn',
          target: sl.id,
          message: `SchemaQA-10: ${sl.id} 本文に (${n}) があるが ref_table に対応行なし — ハイパーリンク化されず黒文字残り`,
        });
      }
    }
    // ref_table - 本文
    for (const n of inTable) {
      if (!inBody.has(n)) {
        issues.push({
          rule: 'SchemaQA-10',
          level: 'warn',
          target: sl.id,
          message: `SchemaQA-10: ${sl.id} ref_table に (${n}) があるが本文で参照されていない`,
        });
      }
    }
  }

  return issues;
}

// ───────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────

/**
 * 全スライドを走査し、`svg` (文字列) または `svg_file` (パス) が指定されている
 * 場合に SVG → PNG 変換 → image_path にパスを書き込む。
 *
 * 出力先: {planDir}/assets/svg-rendered/{slide_id}.png
 *
 * - svg: SVG 文字列を直接受け取る (plan.json に embed)
 * - svg_file: SVG ファイルパス (planDir 基準の相対 or 絶対)
 * - image_path が既にあるなら何もしない (ユーザー指定を尊重)
 *
 * SVG → PNG 変換は enostech-svg-diagram の svgToPng を呼ぶ。
 * 失敗時は警告して該当スライドの SVG 経路を諦め、placeholder_label に降格。
 */

// ───────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────

function aliasDiagram4ToSecsummary1(deckJson) {
  let aliased = 0;
  for (const sec of (deckJson.sections || [])) {
    for (const sl of (sec.slides || [])) {
      if (sl && sl.template_id === 'DIAGRAM-4') {
        sl.template_id = 'SECSUMMARY-1';
        aliased += 1;
      }
    }
  }
  if (aliased > 0) {
    console.error(`[build-deck] ⚠ alias: template_id "DIAGRAM-4" を ${aliased} 枚分 "SECSUMMARY-1" に正規化しました。plan.json の表記も更新を推奨。`);
  }
  return deckJson;
}

// ───────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────
//
// inject していたが、最終確定仕様 (= 主役ビジュアル一発のみ、SVG 内部にも
// タイトル / サブ / chips を描かない) になったため inject は不要化。
// SVG は中央の主役ビジュアル単体を表現するだけで、章ナビゲーション情報は
// SECSUMMARY-1 では持たせない方針。
//
// 章リストを使いたい別テンプレ (例: SECTION-6 統合目次) が必要になった
// 時点で改めてヘルパー化する。それまではこのコメントだけ残す。

// ───────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────

/**
 *   - v8.x: トップレベルに sections[] のみ
 *
 * @param {object} deckJson
 * @returns {boolean}
 */
function isV9Format(deckJson) {
  if (!deckJson || typeof deckJson !== 'object') return false;
  const hasHeader = Array.isArray(deckJson.header);
  const hasBody = deckJson.body && Array.isArray(deckJson.body.chapters);
  const hasFooter = Array.isArray(deckJson.footer);
  return hasHeader || hasBody || hasFooter;
}

/**
 * sections[] 構造に内部的に正規化する。
 *
 * 既存パイプライン (validateDeckGlobal / preprocessSvgIllustrations 等) が
 * sections[] を前提に書かれているため、render 直前に v8.x 形式へ変換する経路。
 *
 * 章構造: { id, code, name, slides: [...head, ...content, ...tail] } を生成。
 * 序盤は擬似 section { id: '_header', code: 'H', name: '序盤' }、
 * 末尾は擬似 section { id: '_footer', code: 'F', name: '末尾' } として詰める。
 *
 * 元の deckJson は破壊しない (新オブジェクトを返す)。
 *
 * @returns {object} sections[] が詰められた v8.x 互換 deckJson
 */
function normalizeV9ToV8Sections(deckJson) {
  // 2026-05-16 緊急修正: v8 形式 (sections[] 直書き, header/body/footer なし) の入力で
  // 呼ばれると header/body/footer が undefined のため空 sections[] で上書きしてしまい、
  // **全 slide ロスト** で空 pptx が生成される事故が発生していた.
  // v8 形式と判定したら即パススルー.
  const alreadyV8 = Array.isArray(deckJson.sections) && deckJson.sections.length > 0
    && !deckJson.header && !deckJson.body && !deckJson.footer;
  if (alreadyV8) return deckJson;

  const sections = [];
  const header = Array.isArray(deckJson.header) ? deckJson.header : [];
  const chapters = (deckJson.body && Array.isArray(deckJson.body.chapters))
    ? deckJson.body.chapters : [];
  const footer = Array.isArray(deckJson.footer) ? deckJson.footer : [];

  if (header.length > 0) {
    sections.push({
      id: '_header',
      code: 'H',
      name: '序盤',
      slides: header,
      _v9_role: 'header',
    });
  }

  for (const ch of chapters) {
    const slides = [
      ...(Array.isArray(ch.head) ? ch.head : []),
      ...(Array.isArray(ch.content) ? ch.content : []),
      ...(Array.isArray(ch.tail) ? ch.tail : []),
    ];
    sections.push({
      id: ch.id,
      code: ch.code,
      name: ch.name,
      slides,
      _v9_role: 'chapter',
      _v9_head_count: Array.isArray(ch.head) ? ch.head.length : 0,
      _v9_content_count: Array.isArray(ch.content) ? ch.content.length : 0,
      _v9_tail_count: Array.isArray(ch.tail) ? ch.tail.length : 0,
    });
  }

  if (footer.length > 0) {
    sections.push({
      id: '_footer',
      code: 'F',
      name: '末尾',
      slides: footer,
      _v9_role: 'footer',
    });
  }

  return Object.assign({}, deckJson, {
    sections,
    _v9_original: {
      header: deckJson.header,
      body: deckJson.body,
      footer: deckJson.footer,
    },
  });
}

/**
 * v8 形式 (sections 直書き) を v9 形式 (header / body.chapters / footer) に
 * 逆正規化する. StructureQA は v9 前提なので、v8 の plan.json も検証できるよう
 * auto-convert する.
 *
 * 識別ルール:
 *   - section.id ∈ {_header, header, intro, introduction} or code='H' or 配列先頭 → header
 *   - section.id ∈ {_footer, footer, closing, summary, conclusion} or code='F' or 配列末尾 → footer
 *   - それ以外 → body chapter (head/content/tail に振り分け)
 *
 * 章内振り分け:
 *   - head[0]: 章扉 (SECTION-2 / SECTION-4 / SECTION-5 のいずれか)
 *   - head[1]: SECSUMMARY-1 / DIAGRAM-4
 *   - tail:    FRAMING-5 (末尾連続)
 *   - 残り:    content
 *
 * 2026-05-15 追加. ADK の plan_builder は v8 形式 (sections 直書き) で出すため
 * StructureQA の前段で v9 へ正規化する.
 */
function normalizeV8ToV9(deckJson) {
  if (deckJson.header || deckJson.body || deckJson.footer) return deckJson;
  const sections = Array.isArray(deckJson.sections) ? deckJson.sections : [];
  if (sections.length === 0) return deckJson;

  const HEADER_IDS = new Set(['_header', 'header', 'intro', 'introduction']);
  const FOOTER_IDS = new Set(['_footer', 'footer', 'closing', 'summary', 'conclusion']);
  const SECTION_DOOR = new Set(['SECTION-2', 'SECTION-4', 'SECTION-5']);
  const SECSUMMARY = new Set(['SECSUMMARY-1', 'DIAGRAM-4']);
  const TAIL_TEMPLATES = new Set(['FRAMING-5']);

  const header = [];
  const chapters = [];
  const footer = [];

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (!sec) continue;
    const id = (sec.id || '').toLowerCase();
    const code = sec.code || '';
    const slides = sec.slides || [];

    if (HEADER_IDS.has(id) || code === 'H' || (i === 0 && !FOOTER_IDS.has(id))) {
      header.push(...slides);
    } else if (FOOTER_IDS.has(id) || code === 'F' || (i === sections.length - 1)) {
      footer.push(...slides);
    } else {
      const head = [];
      const tail = [];
      let s_i = 0;
      if (s_i < slides.length && SECTION_DOOR.has(slides[s_i].template_id)) {
        head.push(slides[s_i]); s_i++;
      }
      if (s_i < slides.length && SECSUMMARY.has(slides[s_i].template_id)) {
        head.push(slides[s_i]); s_i++;
      }
      let end_i = slides.length;
      while (end_i > s_i && TAIL_TEMPLATES.has(slides[end_i - 1].template_id)) {
        tail.unshift(slides[end_i - 1]);
        end_i--;
      }
      const content = slides.slice(s_i, end_i);
      chapters.push({
        id: sec.id,
        code: sec.code,
        name: sec.name,
        head,
        content,
        tail,
      });
    }
  }

  return Object.assign({}, deckJson, {
    header,
    body: { chapters },
    footer,
  });
}

/**
 * 各 slide に `section_id` を自動付与する.
 *
 * 理由: 各テンプレ (framing.js / qa.js / list.js 等) の chrome 描画コードは
 * `slideJson.section_id` を見て章ナビゲーション ("2/5 章タイトル") を組み立てる.
 * `section_id` が無い場合 hardcoded の 0 (= 最初の章 = "はじめに") にフォールバック
 * してしまい、全スライドのナビが「1/5 はじめに」固定になる事故が起きていた.
 *
 * normalizeV9ToV8Sections / v8 直書きどちらの形式でも、render 直前にここで section_id
 * を補完する.
 */
function inheritSectionIdToSlides(deckJson) {
  const sections = Array.isArray(deckJson.sections) ? deckJson.sections : [];
  for (const sec of sections) {
    if (!sec || !Array.isArray(sec.slides)) continue;
    const secId = sec.id;
    if (!secId) continue;
    for (const sl of sec.slides) {
      if (sl && typeof sl === 'object' && !sl.section_id) {
        sl.section_id = secId;
      }
    }
  }
  return deckJson;
}

async function preprocessSvgIllustrations(deckJson, planDir) {
  if (!planDir) return deckJson;
  const sections = Array.isArray(deckJson.sections) ? deckJson.sections : [];
  //   - assets/fonts/ の Noto Sans JP を確実にロード
  //   - SVG 内の font-family を単一値に正規化
  //   - 失敗時のみ enostech-svg-diagram skill 側の svgToPng (sharp/IM フォールバック付き)
  //     にフェイルオーバ
  let svgToPng = null;
  try {
    ({ renderSvgToPng: svgToPng } = require('./lib/svg-render'));
  } catch (e) {
    console.warn('[svg-preprocess] lib/svg-render のロードに失敗 (enostech-svg-diagram にフォールバック):', e.message);
  }
  if (!svgToPng) {
    try {
      const svgSkillRel = path.resolve(__dirname, '..', '..', '..', 'enostech-svg-diagram', 'scripts', 'convert', 'svg-to-png.js');
      if (fs.existsSync(svgSkillRel)) {
        ({ svgToPng } = require(svgSkillRel));
      }
    } catch (e) {
      console.warn('[svg-preprocess] svgToPng のロードに失敗:', e.message);
    }
  }

  let processed = 0;
  let failed = 0;
  // v10.4.0 (2026-05-11): 各 SVG の文字数 + PNG バイト数を記録して
  //   build 完了後に「中身が薄い (= placeholder の疑い)」を warn 表示する
  const svgStats = []; // [{slideId, idxKey, svgLen, pngLen}]
  const PLACEHOLDER_CHAR_THRESHOLD = 1200; // これ未満は placeholder の可能性が高い
  // 任意 object に svg / svg_file が含まれていれば変換し image_path に書き戻す
  async function walkAndConvert(node, slideId, idxKey) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        await walkAndConvert(node[i], slideId, `${idxKey || ''}[${i}]`);
      }
      return;
    }
    // image_path 既設なら個別 svg/svg_file はスキップ
    if (!node.image_path) {
      const hasSvg = typeof node.svg === 'string' && node.svg.length > 0;
      const hasSvgFile = typeof node.svg_file === 'string' && node.svg_file.length > 0;
      if (hasSvg || hasSvgFile) {
        if (!svgToPng) {
          console.warn(`[svg-preprocess] svgToPng 未ロードで ${slideId}${idxKey || ''} の SVG 変換をスキップ`);
          failed++;
        } else {
          try {
            let svgString = node.svg;
            if (!svgString) {
              const svgPath = path.isAbsolute(node.svg_file) ? node.svg_file : path.join(planDir, node.svg_file);
              svgString = fs.readFileSync(svgPath, 'utf-8');
            }
            const png = await svgToPng(svgString, { width: 2400 });
            const outDir = path.join(planDir, 'assets', 'svg-rendered');
            fs.mkdirSync(outDir, { recursive: true });
            // ファイル名: {slideId}{idxKey}.png 形式 (角括弧/ドットを _ に置換)
            const safeIdx = (idxKey || '').replace(/[\[\].]/g, '_');
            const outPath = path.join(outDir, `${slideId || 'slide'}${safeIdx}.png`);
            fs.writeFileSync(outPath, png);
            node.image_path = outPath;
            processed++;
            // v10.4.0: 文字数 + バイト数を記録 (build 完了後に薄さ警告に使う)
            svgStats.push({
              slideId: slideId || 'slide',
              idxKey: idxKey || '',
              svgLen: svgString.length,
              pngLen: png.length,
            });
            // 1 枚ごとに per-line ログを出す (中身が見えるので placeholder 疑いを即時検知できる)
            const sLabel = `${slideId || 'slide'}${idxKey || ''}`;
            const svgLenStr = svgString.length.toLocaleString();
            const pngLenStr = png.length.toLocaleString();
            console.log(`[svg-preprocess] ${sLabel}: SVG ${svgLenStr} chars → PNG ${pngLenStr} bytes`);
          } catch (e) {
            console.warn(`[svg-preprocess] ${slideId}${idxKey || ''} の SVG → PNG 変換失敗: ${e.message}`);
            failed++;
          }
        }
      }
    }
    // 子フィールドを再帰
    for (const k of Object.keys(node)) {
      if (k === 'svg' || k === 'svg_file' || k === 'image_path') continue;
      const v = node[k];
      if (v && typeof v === 'object') {
        await walkAndConvert(v, slideId, idxKey ? `${idxKey}.${k}` : `.${k}`);
      }
    }
  }

  for (const sec of sections) {
    const slides = Array.isArray(sec.slides) ? sec.slides : [];
    for (const slide of slides) {
      await walkAndConvert(slide, slide.id, '');
    }
  }
  if (processed > 0 || failed > 0) {
    console.log(`[svg-preprocess] ✓ ${processed} 枚を PNG 化 (失敗 ${failed} 枚)`);
  }
  // v10.4.0: 中身が薄い SVG (= placeholder の疑い) を warn で見える化
  //   1,200 chars 未満の SVG は通常 placeholder (灰色背景 + 番号文字だけ) 相当の構造しか持たない。
  //   本物の SECSUMMARY-1 SVG は通常 4,000-10,000 chars 程度になる (カード/テキスト/罫線が複数)。
  //   閾値を超えていればだいたい本物、未満なら手抜きの可能性 → 人間レビュー誘発のためのサイン。
  const thinSvgs = svgStats.filter(s => s.svgLen < PLACEHOLDER_CHAR_THRESHOLD);
  if (thinSvgs.length > 0) {
    const labels = thinSvgs.map(s => `${s.slideId}${s.idxKey} (${s.svgLen} chars)`).join(', ');
    console.warn(
      `[svg-preprocess] ⚠ SVG 中身が薄い (${PLACEHOLDER_CHAR_THRESHOLD} chars 未満) スライド: ${labels}\n` +
      `             → placeholder の疑いがあります。本物の SECSUMMARY-1 SVG は通常 4,000-10,000 chars 程度です。\n` +
      `             → enostech-svg-diagram スキルで主役ビジュアルを書き直してください (CLAUDE.md C-15)。`
    );
  }
  return deckJson;
}

// ───────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────

/**
 * doc.references[] を走査し、image.enabled=true のレコードに対して
 * Web 画像を DL → 結果を image.local_path / image.fetch_status / image.fetched_at
 * に書き戻す。decks/{slug}/assets/images/{hash}.{ext} に保存。
 *
 * 失敗してもデッキビルドは継続する (fetch_status='failed' をセット)。
 *
 * @param {object} deckJson
 * @param {string|null} planDir   plan.json と同じディレクトリ。assets/images/ の親。
 *                                 stdin 経由で planDir 不明な時は null → DL スキップ。
 */
async function enrichReferenceImages(deckJson, planDir) {
  const refs = (deckJson.doc && deckJson.doc.references) || [];
  if (refs.length === 0) return deckJson;
  if (!planDir) {
    // stdin で planDir が分からない場合は DL を諦める
    refs.forEach(r => {
      if (r.image && r.image.enabled === true && !r.image.local_path) {
        r.image.fetch_status = 'skipped';
        r.image.fetch_reason = 'planDir unknown (stdin mode)';
      }
    });
    return deckJson;
  }

  const path = require('path');
  const cacheDir = path.join(planDir, 'assets', 'images');

  for (const ref of refs) {
    if (!ref || typeof ref !== 'object') continue;
    if (!ref.image || ref.image.enabled !== true) continue;
    if (!ref.image.source_url) {
      ref.image.fetch_status = 'failed';
      ref.image.fetch_reason = 'image.source_url is empty';
      continue;
    }
    // 既に local_path が指定されていてファイルが存在するならスキップ (再 DL しない)
    if (ref.image.local_path) {
      const abs = path.isAbsolute(ref.image.local_path)
        ? ref.image.local_path
        : path.join(planDir, ref.image.local_path);
      try {
        require('fs').accessSync(abs);
        ref.image._abs_local_path = abs;
        ref.image.fetch_status = ref.image.fetch_status || 'ok';
        continue;
      } catch (_) { /* fall through to fetch */ }
    }

    const result = await fetchAndCache(ref.image.source_url, cacheDir, {
      ref_num: ref.num,
      ref_title: ref.title,
      caption: ref.image.caption,
      source: ref.source,
    });

    if (result.ok) {
      ref.image.local_path = path.relative(planDir, result.local_path);
      ref.image._abs_local_path = result.local_path; // PptxGenJS は cwd 起点なので絶対パスを併記
      ref.image.content_type = result.content_type;
      ref.image.fetched_at = result.fetched_at;
      ref.image.fetch_status = 'ok';
      delete ref.image.fetch_reason;
      console.log(`[build-deck] image fetched: ref(${ref.num}) ← ${ref.image.source_url}${result.cached ? ' (cached)' : ''}`);
    } else {
      ref.image.fetch_status = 'failed';
      ref.image.fetch_reason = result.reason;
      console.warn(`[build-deck] image FAILED: ref(${ref.num}) ${ref.image.source_url} — ${result.reason}`);
    }
  }
  return deckJson;
}

/**
 * v10.6.0 (2026-05-11): WEBPAGE-1 / WEBPAGE-2 の article_url から OG image を
 * 自動取得して image_path に書き戻す。
 *
 * 背景: WEBPAGE-1 (単独 URL 解説) / WEBPAGE-2 (関連 URL カードグリッド) の
 *   image_path はスキーマ上 optional のため、Phase 2 で plan.json に書かないと
 *   render 時に「[ 画像 ]」「[ サムネ ]」プレースホルダで描画されていた。
 *   article_url から OG image (Open Graph protocol の og:image) を抽出して
 *   自動 DL する経路を新設し、人間が image_path を手書きする必要を無くす。
 *
 * 流れ:
 *   1. fetchArticleOgImage(article_url) — HTML 取得 → og:image URL 抽出 → 画像 DL
 *   2. 成功なら image_path に local_path (絶対パス) を書き込む
 *   3. 失敗なら fetch_status='failed' + fetch_reason を set し、render 側で
 *      従来通りプレースホルダ描画 (build を止めない)
 *
 * 対応スライド:
 *   - WEBPAGE-1: slide.article_url (or source_url) → slide.image_path
 *   - WEBPAGE-2: slide.items[].article_url → slide.items[].image_path
 *
 * 既に image_path が指定されているスライドは触らない (人間の override を尊重)。
 */
async function enrichWebpageImages(deckJson, planDir) {
  if (!planDir) return deckJson;
  const path = require('path');
  const fs = require('fs');
  const cacheDir = path.join(planDir, 'assets', 'images');

  let fetchModule;
  try {
    fetchModule = require('./lib/fetch-image');
  } catch (e) {
    console.warn('[build-deck] fetch-image.js のロードに失敗 (WEBPAGE OG image 取得スキップ):', e.message);
    return deckJson;
  }
  if (typeof fetchModule.fetchArticleOgImage !== 'function') {
    // 旧版の fetch-image.js (v10.5.0 以前) — OG image 抽出機能なし
    console.warn('[build-deck] fetch-image.js が旧版 (fetchArticleOgImage 未実装) — WEBPAGE OG image 取得スキップ');
    return deckJson;
  }

  // すべてのスライドを再帰走査して WEBPAGE-1 / WEBPAGE-2 を集める
  const targets = [];  // [{ slide, item?, article_url, label }]
  function walk(slidesArray, ctx) {
    if (!Array.isArray(slidesArray)) return;
    for (const slide of slidesArray) {
      if (!slide || typeof slide !== 'object') continue;
      const tid = slide.template_id;
      if (tid === 'WEBPAGE-1') {
        const url = slide.article_url || slide.source_url;
        if (url && !slide.image_path) {
          targets.push({ slide, article_url: url, label: `${slide.id || 'WEBPAGE-1'}` });
        }
      } else if (tid === 'WEBPAGE-2') {
        const items = Array.isArray(slide.items) ? slide.items : [];
        items.forEach((item, idx) => {
          if (item && item.article_url && !item.image_path) {
            targets.push({ slide, item, article_url: item.article_url, label: `${slide.id || 'WEBPAGE-2'}.items[${idx}]` });
          }
        });
      }
    }
  }

  // v9 形式があれば v8 sections[] は normalizeV9ToV8Sections で生えた重複なので skip
  // (v9 と v8 の両方走査すると同じ slide を 2 回処理してしまう)
  const hasV9 = Array.isArray(deckJson.header)
    || (deckJson.body && Array.isArray(deckJson.body.chapters))
    || Array.isArray(deckJson.footer);
  if (hasV9) {
    if (Array.isArray(deckJson.header)) walk(deckJson.header, 'header');
    if (deckJson.body && Array.isArray(deckJson.body.chapters)) {
      for (const ch of deckJson.body.chapters) {
        if (Array.isArray(ch.head)) walk(ch.head, 'chapter.head');
        if (Array.isArray(ch.content)) walk(ch.content, 'chapter.content');
        if (Array.isArray(ch.tail)) walk(ch.tail, 'chapter.tail');
      }
    }
    if (Array.isArray(deckJson.footer)) walk(deckJson.footer, 'footer');
  } else if (Array.isArray(deckJson.sections)) {
    // v8 互換 (sections[]) — v9 が無い時のみ
    for (const sec of deckJson.sections) {
      if (Array.isArray(sec.slides)) walk(sec.slides, 'section');
    }
  }

  if (targets.length === 0) return deckJson;

  fs.mkdirSync(cacheDir, { recursive: true });

  let okCount = 0;
  let failCount = 0;
  for (const t of targets) {
    const result = await fetchModule.fetchArticleOgImage(t.article_url, cacheDir, {
      slide_id: t.slide.id,
      template_id: t.slide.template_id,
    });
    const carrier = t.item || t.slide;
    if (result.ok) {
      // PptxGenJS は cwd 起点なので絶対パスで書き込む (VISUAL-7 と同じ流儀)
      carrier.image_path = result.local_path;
      carrier.fetch_status = 'ok';
      delete carrier.fetch_reason;
      okCount++;
      console.log(`[build-deck] OG image fetched: ${t.label} ← ${t.article_url}${result.cached ? ' (cached)' : ''}`);
    } else {
      carrier.fetch_status = 'failed';
      carrier.fetch_reason = result.reason;
      failCount++;
      console.warn(`[build-deck] OG image FAILED: ${t.label} ${t.article_url} — ${result.reason}`);
    }
  }
  console.log(`[build-deck] WEBPAGE OG images: ${okCount} ok / ${failCount} failed (total ${targets.length})`);
  return deckJson;
}

/**
 * doc.references[] のうち image.enabled=true && fetch_status==='ok' のものに
 * 対して、VISUAL-7 スライドを自動生成して本文初引用スライドの直後に挿入する。
 *
 * 画像取得に失敗した場合 (fetch_status==='failed' or 'skipped') は
 *        VISUAL-7 を作成せず、そのリファレンスは画像なしで本文 + ref_table のみで扱う。
 *        失敗プレースホルダのスライドはデッキとして無価値なので、変に粘らずに
 *        「素直にソース追加を諦める」のが正しい挙動。
 *
 * 引用スライドの判定優先順位:
 *   (a) ref.cited_by[0] が指定されていれば、その slide id を使う
 *   (b) なければ、全スライドの raw_text_runs を走査して {ref: N} を初めて含む
 *       スライド id を探す
 *   (c) どちらも見つからなければ、DATA-4 (参考情報集) スライドの直前に挿入。
 *       それも無ければデッキ末尾の最終セクションに追加
 *
 * 同じ section 配下に挿入するので章 chrome (ナビ) は元スライドと同じ章を
 * 引き継ぐ。slide.id は "{元id}-imgRefN" (例: "S5-imgRef3")。
 */
function injectReferenceImageSlides(deckJson) {
  const refs = (deckJson.doc && deckJson.doc.references) || [];
  //        プレースホルダだけのスライドはデッキとして無価値なので、
  //        失敗したリファレンスは ref_table 側 (DATA-4) でのテキスト引用のみで扱う。
  const skippedRefs = [];
  const targets = refs.filter(r => {
    if (!r || !r.image || r.image.enabled !== true) return false;
    if (r.image.fetch_status === 'ok') return true;
    // failed / skipped / その他 → VISUAL-7 作成しない
    skippedRefs.push({
      num: r.num,
      reason: r.image.fetch_reason || `fetch_status=${r.image.fetch_status || 'unknown'}`,
    });
    return false;
  });
  // 失敗時はコンソールで明示 (デッキビルドは継続)
  for (const s of skippedRefs) {
    console.warn(`[build-deck] VISUAL-7 skipped: ref(${s.num}) — ${s.reason}`);
  }
  if (targets.length === 0) return deckJson;

  const sections = Array.isArray(deckJson.sections) ? deckJson.sections : [];

  // (b) のために raw_text_runs を走査して ref → slideId マップを作る
  const firstCiterByRef = {};
  for (const sec of sections) {
    for (const slide of (sec.slides || [])) {
      const sid = slide.id || null;
      if (!sid) continue;
      const findRefs = (obj) => {
        if (!obj) return;
        if (Array.isArray(obj)) { obj.forEach(findRefs); return; }
        if (typeof obj !== 'object') return;
        if (obj.ref != null && firstCiterByRef[obj.ref] === undefined) {
          firstCiterByRef[obj.ref] = sid;
        }
        for (const k of Object.keys(obj)) findRefs(obj[k]);
      };
      findRefs(slide);
    }
  }

  for (const ref of targets) {
    // 既に同 ref の VISUAL-7 が手で配置されていればスキップ
    let alreadyExists = false;
    for (const sec of sections) {
      for (const sl of (sec.slides || [])) {
        if (sl.template_id === 'VISUAL-7' && sl.ref_num === ref.num) {
          alreadyExists = true; break;
        }
      }
      if (alreadyExists) break;
    }
    if (alreadyExists) {
      console.log(`[build-deck] VISUAL-7 already present for ref(${ref.num}) — skip auto-insert`);
      continue;
    }

    const citerSlideId =
      (Array.isArray(ref.cited_by) && ref.cited_by[0]) ||
      firstCiterByRef[ref.num] ||
      null;
    //   優先順位: image.title (Claude命名) → image.description → image.alt → image.caption
    //   どれも無ければ ref.title をフォールバック
    const titleLine =
      ref.image.title ||
      ref.image.description ||
      ref.image.alt ||
      ref.image.caption ||
      ref.title ||
      `参考情報 (${ref.num})`;

    // サブコピー組み立て: caption (画像が何か) + rationale (なぜ補足したか)
    // 両方ある場合: "{caption}。{rationale}" / 片方なら片方そのまま
    const captionPart = (ref.image.caption || '').trim();
    const rationalePart = (ref.image.rationale || '').trim();
    let subtitleLine = '';
    if (captionPart && rationalePart) {
      // caption が文末記号で終わっていなければ「。」を補う
      const sep = /[。．.!?！？]$/.test(captionPart) ? '' : '。';
      subtitleLine = `${captionPart}${sep}${rationalePart}`;
    } else {
      subtitleLine = captionPart || rationalePart || '';
    }

    const newSlide = {
      id: `${citerSlideId || 'auto'}-imgRef${ref.num}`,
      template_id: 'VISUAL-7',
      ref_num: ref.num,
      title: titleLine,
      subtitle: subtitleLine,
      source: ref.source,
      source_url: ref.image.source_url || ref.url,    // 画像直接 URL (互換維持)
      article_url: ref.url || ref.image.source_url,
      year: ref.year,
      // _sources.json には残るので追跡は維持。
      fetch_status: ref.image.fetch_status,
      fetch_reason: ref.image.fetch_reason,
    };

    let inserted = false;

    // (a)/(b): citer の直後に挿入
    if (citerSlideId) {
      for (const sec of sections) {
        const slides = sec.slides || [];
        const idx = slides.findIndex(s => s.id === citerSlideId);
        if (idx >= 0) {
          // 章 chrome を継承
          if (!newSlide.section_id && sec.id) newSlide.section_id = sec.id;
          slides.splice(idx + 1, 0, newSlide);
          inserted = true;
          console.log(`[build-deck] VISUAL-7 auto-insert: ref(${ref.num}) after slide ${citerSlideId}`);
          break;
        }
      }
    }

    // (c): DATA-4 直前に挿入
    if (!inserted) {
      for (const sec of sections) {
        const slides = sec.slides || [];
        const idx = slides.findIndex(s => s.template_id === 'DATA-4');
        if (idx >= 0) {
          if (!newSlide.section_id && sec.id) newSlide.section_id = sec.id;
          slides.splice(idx, 0, newSlide);
          inserted = true;
          console.log(`[build-deck] VISUAL-7 auto-insert: ref(${ref.num}) before DATA-4`);
          break;
        }
      }
    }

    // (d): 最終セクションの末尾
    if (!inserted) {
      const lastSec = sections[sections.length - 1];
      if (lastSec) {
        if (!Array.isArray(lastSec.slides)) lastSec.slides = [];
        if (!newSlide.section_id && lastSec.id) newSlide.section_id = lastSec.id;
        lastSec.slides.push(newSlide);
        console.log(`[build-deck] VISUAL-7 auto-insert: ref(${ref.num}) at deck tail`);
      }
    }
  }

  return deckJson;
}

// ───────────────────────────────────────────────────────
// CLI
// ───────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    input: null, output: null, theme: null, design: null,
    regeneratePalette: false, writeEnriched: false, verbose: false,
    validateOnly: false, strictValidate: true, validationReport: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-i' || a === '--input')      args.input = argv[++i];
    else if (a === '-o' || a === '--output') args.output = argv[++i];
    else if (a.startsWith('--theme='))       args.theme = a.split('=')[1];
    else if (a.startsWith('--design='))      args.design = a.split('=')[1];
    else if (a === '--design')               args.design = argv[++i];
    else if (a === '--regenerate-palette')   args.regeneratePalette = true;
    else if (a === '--write-enriched')       args.writeEnriched = true;
    else if (a === '--verbose')              args.verbose = true;
    else if (a === '--validate-only')        args.validateOnly = true;
    else if (a === '--strict-validate')      args.strictValidate = true;   // 旧フラグ (no-op, default true)
    else if (a === '--no-strict-validate')   args.strictValidate = false;
    else if (a === '--validation-report')    args.validationReport = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('Usage: node build-deck.js -i deck.json -o out.pptx [--design=design.md] [--regenerate-palette]');
      console.log('  --design=path           外部 design.md を読み込んで palette.yml を生成 (なければ)');
      console.log('  --regenerate-palette    既存 palette.yml を破棄して DESIGN.md / default から再生成');
      console.log('                          palette.yml は decks/{slug}/palette.yml に保存され SSOT として扱う');
      process.exit(0);
    }
  }
  return args;
}

function readJson(inputPath) {
  if (inputPath) {
    return JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  }
  // stdin
  const data = fs.readFileSync(0, 'utf-8');
  return JSON.parse(data);
}

async function main() {
  const args = parseArgs(process.argv);
  let deckJson = readJson(args.input);

  // ───────────────────────────────────────────
  //
  // v10.7.0 (2026-05-11): StructureQA 呼び出し条件を緩和。
  //   旧: `isV9Format(deckJson)` が true (= header[]/body/footer[] が存在) でないと
  //       StructureQA 全体が skip されていた。osanai 氏のセッションで v8 sections[] +
  //       _v9_role 形式の plan.json (本来 structure-qa.js 側は対応済み) が無音で
  //       skip され、StructQA-70/71/72 の fatal が見えない事故が発生。
  //   新: doc.deck_structure が指定されていれば形式に関わらず StructureQA を呼ぶ。
  //       deck_structure を書いた = ユーザーが「StructureQA を走らせて」と意思表示。
  //       structure-qa.js の _collectBodySlides() は v9 / v8 sections[] (`_v9_role`)
  //       両対応済みなので、形式判定を build-deck.js 側でする必要はない。
  //   未指定: doc.deck_structure 無し + v9 形式でもない場合のみ skip (旧仕様通り)。
  // ───────────────────────────────────────────
  const isV9 = isV9Format(deckJson);
  const hasDeckStructure = deckJson && deckJson.doc &&
    (typeof deckJson.doc.deck_structure === 'string' || typeof deckJson.doc.deck_structure_template === 'string');
  if (isV9 || hasDeckStructure) {
    // 2026-05-15: v8 形式 (sections 直書き) の plan.json が来た場合は ここで v9 に
    // 正規化する. StructureQA は v9 (header/body/footer) を期待するため.
    // ADK plan_builder は現状 v8 で出すので、この自動変換が無いと header/body/footer
    // undefined fatal で必ず停止していた.
    const deckJsonForStructQA = isV9 ? deckJson : normalizeV8ToV9(deckJson);
    // (a) StructureQA 実行 (Wave 1 仕様準拠)
    //           新 field `deck_structure` に自動 alias する。alias が使われた場合は
    const structResult = structureQa.validateDeckStructure(deckJsonForStructQA);
    if (structResult.legacyFields && structResult.legacyFields.length > 0) {

      for (const f of structResult.legacyFields) {
        const next = f.replace('deck_structure_template', 'deck_structure');
        console.warn(`[build-deck]   doc.${f} → doc.${next}`);
      }
    }
    if (structResult.skipped) {
      console.warn('[build-deck] ⚠ StructureQA: doc.deck_structure が未指定のためスキップ');


    } else {
      console.log(structureQa.formatValidationReport(structResult));
      if (!structResult.ok) {
        // fatal あり → build 中断
        const reportPath = args.input
          ? args.input.replace(/\.json$/, '.structure-qa-report.json')
          : null;
        if (reportPath) {
          fs.writeFileSync(reportPath, JSON.stringify({
            ok: structResult.ok,
            deckStructureId: structResult.deckStructureId,
            templateId: structResult.templateId,   // 互換 (= deckStructureId)
            summary: structResult.summary,
            issues: structResult.issues,
          }, null, 2));
          console.error(`[build-deck] StructureQA レポート: ${reportPath}`);
        }
        throw new Error(
          `StructureQA fatal ${structResult.summary.fatal} 件で停止 ` +
          `(deckStructure: ${structResult.deckStructureId}, --validate-only でも同じエラーが出ます)`
        );
      }
    }

    // v9 (header/body/footer) で来てる時だけ v8 sections[] に正規化する.
    // v8 で来てる場合は既に renderer が期待する形なので touch しない
    // (関数内にも passthrough ガードあり. 二重防御).
    if (isV9) {
      deckJson = normalizeV9ToV8Sections(deckJson);
    }
  }
  // 各 slide に section_id を継承 (テンプレ側のナビ描画が依存. v9/v8 どちらの形式でも必須)
  deckJson = inheritSectionIdToSlides(deckJson);
  const planDir = args.input ? path.dirname(path.resolve(args.input)) : null;
  deckJson = await enrichReferenceImages(deckJson, planDir);
  // v10.6.0: WEBPAGE-1 / WEBPAGE-2 の article_url から OG image を自動取得
  deckJson = await enrichWebpageImages(deckJson, planDir);
  deckJson = injectReferenceImageSlides(deckJson);
  deckJson = aliasDiagram4ToSecsummary1(deckJson);

  //  章ナビメタ inject 処理は廃止。SVG は中央の主役ビジュアル単体を表現するだけ。)
  //   enostech-svg-diagram skill の svgToPng を経由する。
  //   生成 PNG は decks/{slug}/assets/svg-rendered/{slide_id}.png に保存される。
  //   既に image_path が直接指定されている場合は何もしない。
  deckJson = await preprocessSvgIllustrations(deckJson, planDir);

  // (オプション) 拡張後の deckJson を plan.enriched.json として書き戻す。
  //   --write-enriched フラグ指定時のみ。Phase 2 の plan.html レンダリングが
  //   この拡張済み JSON を使う。
  if (args.writeEnriched && args.input) {
    const enrichedPath = args.input.replace(/\.json$/, '.enriched.json');
    fs.writeFileSync(enrichedPath, JSON.stringify(deckJson, null, 2));
    console.log(`[build-deck] enriched plan written: ${enrichedPath}`);
  }

  const pres = buildDeck(deckJson, {
    theme: args.theme,
    design: args.design,
    inputPath: args.input,
    regeneratePalette: args.regeneratePalette,
    verbose: args.verbose,
    strictValidate: args.strictValidate,
    validationReportPath: args.validationReport,
  });
  if (args.validateOnly) {
    console.log('[build-deck] --validate-only モード: pptx 出力なし');
    return;
  }

  const out = args.output || `deck-${(deckJson.doc && deckJson.doc.theme) || 'mono'}.pptx`;
  await pres.writeFile({ fileName: out });
  console.log(`wrote: ${out}`);
}

if (require.main === module) {
  main().catch(e => {
    console.error('Build failed:', e);
    process.exit(1);
  });
}

module.exports = {
  buildDeck,
  isV9Format,
  normalizeV9ToV8Sections,
  normalizeV8ToV9,
  inheritSectionIdToSlides,
  validateDeckStructure: structureQa.validateDeckStructure,
};
