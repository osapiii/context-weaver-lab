'use strict';

// =============================================================
// templates/diagram.js
// -------------------------------------------------------------
// Consolidated from templates/diagram/*.js.
// Each original subfile is wrapped in an IIFE so its internal
// scope (helpers, constants like MARK_COLORS / MONO_FONT) stays
// private. Only the exports of the original `module.exports = {...}`
// are destructured into module-scope constants — exactly mirroring
// what `require('./xxx')` produced at runtime. The category's
// index.js (registry) is appended verbatim at the bottom.
// File contents are not modified beyond:
//   - stripping per-file `'use strict'` (one at top of merged file)
//   - stripping intra-category `require('./X')` (X is now in scope)
//   - rewriting `'../../X'` paths to `'../X'`
//   - extracting `module.exports = {...}` into IIFE return value
// =============================================================

// ─── diagram-1-matrix.js ─────────────────────────────────────────
const { renderDiagram1Matrix } = (function () {
  /**
   * DIAGRAM-1 マトリクス図（2×2）テンプレ — Category I: DIAGRAM (Template 化)
   * ====================================================================
   * 1 枚丸ごとマトリクスのスライド。drawDIAG08Matrix を full bleed で呼び出す。
   * 期待 JSON: { x_axis, y_axis, quadrants } (DIAG-08 と同じ)
   */


  const atoms = require('../atoms');
  const { drawDIAG08Matrix } = require('../diagrams/diag-08-matrix');

  function renderDiagram1Matrix(slide, slideJson, ctx) {
    const { L } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    // full bleed エリア（タイトル下〜contentBot）
    const area = {
      x: L.marginX,
      y: L.contentY + 0.05,
      w: 10 - L.marginX * 2,
      h: L.contentBot - L.contentY - 0.10,
    };
    drawDIAG08Matrix(slide, slideJson, area, ctx);

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'DIAGRAM-1（マトリクス図）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderDiagram1Matrix };
})();

// ─── diagram-2-flow.js ───────────────────────────────────────────
const { renderDiagram2Flow } = (function () {
  /**
   * DIAGRAM-2 フロー図（横一列）(Category I: DIAGRAM Template)
   * =====================================================
   * 一方通行ステップ。box → box → box の横並び + 矢印。
   * 期待 JSON: { steps: [{ label, body }] } (3-5 件)
   */


  const atoms = require('../atoms');

  function renderDiagram2Flow(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const steps = Array.isArray(slideJson.steps) ? slideJson.steps : [];
    if (steps.length === 0) return;

    const n = steps.length;
    const arrowW = 0.30;
    const totalW = 10 - L.marginX * 2;
    const stepW = (totalW - arrowW * (n - 1)) / n;
    const stepH = Math.min(2.0, L.contentBot - L.contentY - 0.30);
    const stepY = L.contentY + (L.contentBot - L.contentY - stepH) / 2;
    steps.forEach((step, i) => {
      const x = L.marginX + i * (stepW + arrowW);
      const isLast = i === n - 1;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: stepY, w: stepW, h: stepH, rectRadius: L.cardRadius,
        fill: { color: isLast ? C.brand : C.white },
        line: { color: isLast ? C.brand : C.gray300, width: isLast ? 0 : 0.5 },
      });
      slide.addText(String(i + 1).padStart(2, '0'), {
        x, y: stepY + 0.22, w: stepW, h: 0.30,
        fontSize: 11, color: isLast ? C.white : C.gray500, fontFace: F.jp,
        bold: true, charSpacing: 1, align: 'center', valign: 'top', margin: 0,
      });
      slide.addText(step.label || '', {
        x: x + 0.15, y: stepY + 0.58, w: stepW - 0.30, h: 0.50,
        fontSize: 14, color: isLast ? C.white : C.ink, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
      slide.addText(step.body || '', {
        x: x + 0.18, y: stepY + 1.14, w: stepW - 0.36, h: stepH - 1.24,
        fontSize: 10, color: i === n - 1 ? C.white : C.gray700, fontFace: F.jp,
        align: 'center', valign: 'top', margin: 0,
        lineSpacingMultiple: L.lineSpacingMultiple,
      });

      // 矢印 (最後以外、細く軽やかに)
      if (i < n - 1) {
        slide.addShape(pres.shapes.RIGHT_ARROW, {
          x: x + stepW, y: stepY + stepH / 2 - 0.12, w: arrowW, h: 0.24,
          fill: { color: C.gray300 }, line: { type: 'none' },
        });
      }
    });

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'DIAGRAM-2（フロー図）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderDiagram2Flow };
})();

// ─── diagram-3-flowchart.js ──────────────────────────────────────
const { renderDiagram3FlowChart } = (function () {
  /**
   * DIAGRAM-3 FlowChart 専用スライド (Category J: VISUAL / DECISION)
   * ===============================================================
   * 「意思決定の自動化」を図像化した SCENE-06 を、スライド全体を使って
   * フルブリードで描画する専用テンプレ。
   * SECSUMMARY-1 のグレー背景フレーム・章扉ヘッダー・キャプション帯を全部外し、
   * クローム要素（左サイド色帯 / ナビ chip / フッター）だけ残す。
   *
   * 設計思想:
   *   - 1 スライド = 1 つの意思決定木。FlowChart は文字より絵で覚えさせる
   *   - 余白は最小限。本文領域 4.80" 縦をフルに使って情報を配置
   *   - タイトルは「左下にひとこと」だけ。ヘッダー領域も解放
   *
   * 期待 JSON:
   *   {
   *     template_id: "DIAGRAM-3",
   *     section_id?: "...",            // ナビ chip のセクション選定用 (任意)
   *     section_idx?: 0,
   *     subsection?: "...",
   *     title?: "課税対象の判定フロー",  // 上端ラベル (任意、20px 太字)
   *     caption?: "全 NO クリアで課税取引",  // 下端の一言キャプション (任意)
   *     diagram: {                       // 必須: SCENE-06 の JSON
   *       template_id: "SCENE-06",
   *       layout: "vertical-decision" | "horizontal-flow" | "simple-vertical",
   *       start: {...}, steps: [...], side_results: [...], end: {...}
   *     },
   *     slide_goal?: "...",              // speaker notes 用 (任意)
   *   }
   */


  const atoms = require('../atoms');

  function renderDiagram3FlowChart(slide, slideJson, ctx) {
    const { L, C, F, SZ, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);

    // ── タイトル (任意): スライド上端に細く ──
    const titleY = 0.55;
    const titleH = 0.34;
    const hasTitle = !!slideJson.title;
    if (hasTitle) {
      slide.addText(slideJson.title, {
        x: L.marginX, y: titleY, w: L.slideW - L.marginX * 2, h: titleH,
        fontSize: 16, color: C.ink, fontFace: F.jp,
        bold: true, align: 'left', valign: 'middle', margin: 0, charSpacing: -0.3,
      });
      // タイトル直下に薄い divider (L.lineWidth)
      slide.addShape(pres.shapes.LINE, {
        x: L.marginX, y: titleY + titleH + 0.04,
        w: L.slideW - L.marginX * 2, h: 0,
        line: { color: C.gray200, width: L.lineWidth },
      });
    }

    // ── キャプション (任意): スライド下端に左バー付きで ──
    const hasCaption = !!slideJson.caption;
    const capH = 0.40;
    const capY = L.footerY - capH - 0.05; // フッターのすぐ上
    if (hasCaption) {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: L.marginX, y: capY, w: 0.05, h: capH,
        fill: { color: C.highlight }, line: { type: 'none' },
      });
      slide.addText(slideJson.caption, {
        x: L.marginX + 0.18, y: capY,
        w: L.slideW - L.marginX * 2 - 0.20, h: capH,
        fontSize: 12, color: C.ink, fontFace: F.jp,
        bold: true, valign: 'middle', margin: 0,
      });
    }

    // ── FlowChart 描画領域 (フルブリード) ──
    // 上端: タイトルがあれば titleY + titleH + 0.10、無ければ navY + navH + 0.18
    const topClearance = hasTitle ? (titleY + titleH + 0.10) : (L.navY + L.navH + 0.18);
    // 下端: キャプションがあれば capY - 0.10、無ければ footerY - 0.10
    const botClearance = hasCaption ? (capY - 0.10) : (L.footerY - 0.10);
    const area = {
      x: L.marginX,
      y: topClearance,
      w: L.slideW - L.marginX * 2,
      h: botClearance - topClearance,
    };

    // ── SCENE-06 (または他の SCENE/DIAG) を描画 ──
    const diag = slideJson.diagram;
    if (!diag) {
      slide.addText(
        '（diagram フィールドが未指定です — SCENE-06 の JSON を渡してください）',
        {
          x: area.x, y: area.y + area.h / 2 - 0.20, w: area.w, h: 0.40,
          fontSize: 11, color: C.gray500, fontFace: F.jp,
          italic: true, align: 'center', valign: 'middle', margin: 0,
        },
      );
    } else {
      const id = diag.template_id;
      let drawFn = null;
      if (id && id.startsWith('SCENE-') && ctx.sceneRegistry) {
        drawFn = ctx.sceneRegistry[id];
      } else if (id && id.startsWith('DIAG-') && ctx.diagramRegistry) {
        drawFn = ctx.diagramRegistry[id];
      }
      if (drawFn) {
        try {
          drawFn(slide, diag, area, { C, F, SZ, pres });
        } catch (e) {
          console.error(`[DIAGRAM-3] ${id} 描画エラー:`, e.message);
          slide.addText(
            '（' + id + ' の描画に失敗しました: ' + e.message + '）',
            {
              x: area.x, y: area.y + area.h / 2 - 0.20, w: area.w, h: 0.40,
              fontSize: 11, color: C.semanticDanger, fontFace: F.jp,
              italic: true, align: 'center', valign: 'middle', margin: 0,
            },
          );
        }
      } else {
        slide.addText(
          '（未知の ID: ' + id + ' — SCENE-06 を指定してください）',
          {
            x: area.x, y: area.y + area.h / 2 - 0.20, w: area.w, h: 0.40,
            fontSize: 11, color: C.gray500, fontFace: F.jp,
            italic: true, align: 'center', valign: 'middle', margin: 0,
          },
        );
      }
    }

    // ── クローム (左帯 + ナビ + フッター) ──
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum,
        slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum,
        slideJson.section_idx || 0, slideJson.subsection || null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'DIAGRAM-3（FlowChart 専用 / フルブリード）',
        goal: slideJson.slide_goal,
        readingPath: slideJson.reading_path,
        sourceData: slideJson.source_data,
      });
    }
  }
  return { renderDiagram3FlowChart };
})();

// ─── diagram-4-illustration.js ───────────────────────────────────
(function () {
// 後継: secsummary-1.js (template_id: 'SECSUMMARY-1')
// このファイルは registry に未登録で実コードからは参照されない。
// 物理削除は Finder から実施してください。
})();

// ─── secsummary-1.js ─────────────────────────────────────────────
const { renderSecsummary1Illustration } = (function () {
  /**
   * SECSUMMARY-1 セクション見取り図
   * ====================================================================
   * v9.4 (2026-05-03 osanai 指示) の最終方針:
   *   - SVG を画面 (10" × 5.625") の 100% に貼り付ける full-bleed SVG-only テンプレ
   *   - テンプレは「SVG を貼るだけ」の最小の器
   *   - 章タイトル / サブ / 全章 chips / 中央ビジュアル / 結論バーはすべて SVG 内部で完結
   *   - addTitleBlock / chrome (footer logo / page / left strip) も呼ばない
   *
   * 経緯:
   *   v9.4 第一案でテンプレが上部 amber 帯 + 章タイトル + 章 chip ナビを描いていたが、
   *   既存 SVG が上部要素を内包しているため二重表示が発生し osanai NG。
   *   SVG only に振り切ることで dbt-semantic 既存デッキともそのまま整合する。
   *
   * LLM が SVG を書く時のレイアウト規範 (役割分担 / NG・OK パターン) は
   * `enostech-svg-diagram/references/pattern-catalog.md` を参照。
   *
   * build-deck.js は `_chapters` / `_chapter_idx` を inject するが、
   * テンプレ側では使わない。LLM が plan.json 生成時に章リストを参照するためのメタ情報。
   */


  const atoms = require('../atoms');

  const SLIDE_W = 10;
  const SLIDE_H = 5.625;

  function renderSecsummary1Illustration(slide, slideJson, ctx) {
    const { C, F } = ctx;

    atoms.setCanvasBg(ctx, slide);

    if (slideJson.image_path) {
      slide.addImage({
        path: slideJson.image_path,
        x: 0, y: 0,
        w: SLIDE_W, h: SLIDE_H,
        sizing: { type: 'contain', w: SLIDE_W, h: SLIDE_H },
      });
    } else {
      slide.addText(
        slideJson.placeholder_label
          || '（章の見取り図 SVG がまだ用意されていません — svg または svg_file を指定してください）',
        {
          x: 0.40, y: SLIDE_H / 2 - 0.30,
          w: SLIDE_W - 0.80, h: 0.60,
          fontSize: 14, color: C.gray400, fontFace: F.jp,
          italic: true, align: 'center', valign: 'middle', margin: 0,
        },
      );
    }

    // chrome は呼ばない (full-bleed SVG only)。

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'SECSUMMARY-1（セクション見取り図 / v9.4 full-bleed SVG only）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.one_line || slideJson.section_title || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderSecsummary1Illustration };
})();


// ─── diagram-5-cycle.js (v11.5 新規) ─────────────────────────────
const { renderDiagram5Cycle } = (function () {
  /**
   * DIAGRAM-5 サイクル図 (v11.5 新規 / Category I: DIAGRAM Template)
   * ============================================================
   * 4 段階の反復プロセス (PDCA 等) を 1 枚で表示。
   * drawDIAG02Cycle を full bleed で呼ぶラッパーテンプレ。
   *
   * 期待 JSON:
   *   {
   *     template_id: "DIAGRAM-5",
   *     title: "...",
   *     subtitle: "...",
   *     center_label: "...\n...",  // optional
   *     nodes: [
   *       { pos: 'tl', label, sub?, body?, color? },
   *       { pos: 'tr', ... },
   *       { pos: 'br', ... },
   *       { pos: 'bl', ... },
   *     ]
   *   }
   */
  const atoms = require('../atoms');
  const { drawDIAG02Cycle } = require('../diagrams/diag-02-cycle');

  function renderDiagram5Cycle(slide, slideJson, ctx) {
    const { L } = ctx;
    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const area = {
      x: L.marginX,
      y: L.contentY + 0.05,
      w: 10 - L.marginX * 2,
      h: L.contentBot - L.contentY - 0.10,
    };
    drawDIAG02Cycle(slide, slideJson, area, ctx);
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'DIAGRAM-5（サイクル図 PDCA 型）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderDiagram5Cycle };
})();

// ─── diagram-6-pyramid.js (v11.5 新規) ───────────────────────────
const { renderDiagram6Pyramid } = (function () {
  /**
   * DIAGRAM-6 ピラミッド図 (v11.5 新規 / Category I: DIAGRAM Template)
   * ============================================================
   * 階層構造 (上から狭→広)。3 層推奨。drawDIAG05Pyramid を full bleed で。
   *
   * 期待 JSON:
   *   {
   *     template_id: "DIAGRAM-6",
   *     title: "...",
   *     subtitle: "...",
   *     layers: [
   *       { label, body? },  // 上から (狭い側)
   *       ...
   *     ]
   *   }
   */
  const atoms = require('../atoms');
  const { drawDIAG05Pyramid } = require('../diagrams/diag-05-pyramid');

  function renderDiagram6Pyramid(slide, slideJson, ctx) {
    const { L } = ctx;
    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const area = {
      x: L.marginX,
      y: L.contentY + 0.05,
      w: 10 - L.marginX * 2,
      h: L.contentBot - L.contentY - 0.10,
    };
    drawDIAG05Pyramid(slide, slideJson, area, ctx);
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'DIAGRAM-6（ピラミッド図）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderDiagram6Pyramid };
})();

// ─── diagram-7-stepup.js (v11.5 新規) ────────────────────────────
const { renderDiagram7Stepup } = (function () {
  /**
   * DIAGRAM-7 ステップアップ図 (v11.5 新規 / Category I: DIAGRAM Template)
   * ================================================================
   * 段階的成熟度 / 成長ロードマップ。3-5 段の昇順バー。drawDIAG03Stepup を。
   *
   * 期待 JSON:
   *   {
   *     template_id: "DIAGRAM-7",
   *     title: "...",
   *     subtitle: "...",
   *     steps: [
   *       { label, body? },  // 3-5 件、左から右へ昇順
   *       ...
   *     ]
   *   }
   */
  const atoms = require('../atoms');
  const { drawDIAG03Stepup } = require('../diagrams/diag-03-stepup');

  function renderDiagram7Stepup(slide, slideJson, ctx) {
    const { L } = ctx;
    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const area = {
      x: L.marginX,
      y: L.contentY + 0.05,
      w: 10 - L.marginX * 2,
      h: L.contentBot - L.contentY - 0.10,
    };
    drawDIAG03Stepup(slide, slideJson, area, ctx);
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'DIAGRAM-7（ステップアップ図 / 成長ロードマップ）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderDiagram7Stepup };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'DIAGRAM-1': renderDiagram1Matrix,
  'DIAGRAM-2': renderDiagram2Flow,
  'DIAGRAM-3': renderDiagram3FlowChart,
  'DIAGRAM-5': renderDiagram5Cycle,    // v11.5: DIAG-02 ラッパー
  'DIAGRAM-6': renderDiagram6Pyramid,  // v11.5: DIAG-05 ラッパー
  'DIAGRAM-7': renderDiagram7Stepup,   // v11.5: DIAG-03 ラッパー
  'SECSUMMARY-1': renderSecsummary1Illustration,
};
