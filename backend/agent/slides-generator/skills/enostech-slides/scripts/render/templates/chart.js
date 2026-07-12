'use strict';

// =============================================================
// templates/chart.js
// -------------------------------------------------------------
// Consolidated from templates/chart/*.js.
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

// ─── chart-a1-only.js ────────────────────────────────────────────
const { renderChartA1Only } = (function () {
  /**
   * CHART-A1 チャート単体 (Category J: CHART)
   * ========================================
   * 1 スライド = 1 チャート。大きく見せて 1 つの読みを伝えるとき。
   * 例: 「3 年でユーザーが 5 倍になった」「市場シェアの推移」
   *
   * 期待 JSON:
   *   {
   *     title: "...",
   *     subtitle: "...",
   *     section_id?, subsection?, slide_goal?,
   *     chart: {
   *       template_id: "CHART-01" | ... | "CHART-09",
   *       // CHART-XX 固有のフィールド (categories/series/items/...)
   *     },
   *     chart_caption?: "出典: ... / 注: ..."  // 下部に小さく
   *   }
   */

  const atoms = require('../atoms');
  const S = require('../charts/_chart-style');

  function renderChartA1Only(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || '',
      slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    // チャート領域 (タイトルブロック直下から下端 5.05 まで使う)
    const chartY = (titleBottomY || L.contentY) + 0.10;
    const chartX = L.marginX;
    const chartW = 10 - L.marginX * 2;
    const chartH = 5.05 - chartY;

    if (slideJson.chart && ctx.chartRegistry) {
      const chartJson = slideJson.chart;
      const chartId = chartJson.template_id;
      const drawChart = ctx.chartRegistry[chartId];
      if (drawChart) {
        try {
          drawChart(slide, chartJson, { x: chartX, y: chartY, w: chartW, h: chartH }, ctx);
          if (Array.isArray(slideJson.annotations) && slideJson.annotations.length > 0) {
            S.drawChartAnnotations(slide, slideJson.annotations, ctx);
          }
        } catch (e) {
          console.error(`[CHART-A1] chart ${chartId} 描画エラー:`, e.message);
          slide.addText(
            '（' + chartId + ' の描画に失敗: ' + e.message + '）',
            {
              x: chartX, y: chartY + chartH / 2 - 0.2, w: chartW, h: 0.4,
              fontSize: 11, color: C.semanticDanger, fontFace: F.jp,
              italic: true, align: 'center', valign: 'middle', margin: 0,
            },
          );
        }
      } else {
        slide.addText(
          '（未知のチャート ID: ' + chartId + ' — CHART-01〜09 のいずれか）',
          {
            x: chartX, y: chartY + chartH / 2 - 0.2, w: chartW, h: 0.4,
            fontSize: 11, color: C.gray500, fontFace: F.jp,
            italic: true, align: 'center', valign: 'middle', margin: 0,
          },
        );
      }
    } else {
      slide.addText('（chart が未指定）', {
        x: chartX, y: chartY + chartH / 2 - 0.2, w: chartW, h: 0.4,
        fontSize: 11, color: C.gray400, fontFace: F.jp,
        italic: true, align: 'center', valign: 'middle', margin: 0,
      });
    }

    // 下部キャプション (Genspark 風に gray500→gray400 で muted、
    // charSpacing 0.5 + lineSpacingMultiple 1.30 で出典文を読みやすく)
    if (slideJson.chart_caption) {
      slide.addText(slideJson.chart_caption, {
        x: L.marginX, y: 5.10, w: 10 - L.marginX * 2, h: 0.20,
        fontSize: 9.5, color: C.gray500, fontFace: F.jp,
        charSpacing: 0.5, align: 'left', valign: 'middle', margin: 0,
        lineSpacingMultiple: 1.30,
      });
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CHART-A1（チャート単体）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderChartA1Only };
})();

// ─── chart-a2-text.js ────────────────────────────────────────────
const { renderChartA2Text } = (function () {
  /**
   * CHART-A2 左チャート + 右テキスト (Category J: CHART)
   * ===================================================
   * 左にチャート、右にチャートから読み取れる要点 (3〜4 個) を配置。
   * 例: 「右肩上がりだが、Q4 だけ失速」「市場シェアの 80% は上位 3 社」
   *
   * 期待 JSON:
   *   {
   *     title: "...",
   *     subtitle: "...",
   *     chart: { template_id: "CHART-XX", ...固有フィールド },
   *     insights: [
   *       { headline: "右肩上がり", body: "3 年で 5 倍に成長" },
   *       { headline: "Q4 失速",   body: "新機能の出遅れが要因" },
   *       ...
   *     ],
   *     chart_caption?: "出典..."
   *   }
   */

  const atoms = require('../atoms');
  const S = require('../charts/_chart-style');

  function renderChartA2Text(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || '',
      slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    const contentTop = (titleBottomY || L.contentY) + 0.10;
    const contentBottom = 5.05;
    const contentH = contentBottom - contentTop;

    // 左チャート 60% / 右テキスト 40%
    const totalW = 10 - L.marginX * 2;
    const gap = 0.24;
    const chartW = totalW * 0.60 - gap / 2;
    const textW = totalW * 0.40 - gap / 2;

    const chartX = L.marginX;
    const chartY = contentTop;
    const chartH = contentH;

    // 左: チャート
    if (slideJson.chart && ctx.chartRegistry) {
      const chartJson = slideJson.chart;
      const chartId = chartJson.template_id;
      const drawChart = ctx.chartRegistry[chartId];
      if (drawChart) {
        try {
          drawChart(slide, chartJson, { x: chartX, y: chartY, w: chartW, h: chartH }, ctx);
          if (Array.isArray(slideJson.annotations) && slideJson.annotations.length > 0) {
            S.drawChartAnnotations(slide, slideJson.annotations, ctx);
          }
        } catch (e) {
          console.error(`[CHART-A2] chart ${chartId} エラー:`, e.message);
        }
      }
    }

    // 右: 要点リスト
    const textX = L.marginX + chartW + gap;
    const insights = slideJson.insights || [];
    const itemH = Math.min(0.95, (contentH - 0.10) / Math.max(1, insights.length));

    insights.forEach((it, i) => {
      const y = contentTop + i * itemH;
      // アクセント縦帯 (L.accentBarW でトークン化)
      slide.addShape(pres.shapes.RECTANGLE, {
        x: textX, y: y + 0.05, w: L.accentBarW || 0.05, h: itemH - 0.20,
        fill: { color: C.accent }, line: { type: 'none' },
      });
      // headline
      slide.addText(it.headline || '', {
        x: textX + 0.15, y: y + 0.02, w: textW - 0.20, h: 0.32,
        fontSize: 13, color: C.ink, fontFace: F.jp,
        bold: true, charSpacing: -0.3, valign: 'top', margin: 0,
      });
      // body
      if (it.body) {
        slide.addText(it.body, {
          x: textX + 0.15, y: y + 0.34, w: textW - 0.20, h: itemH - 0.40,
          fontSize: 10, color: C.gray700, fontFace: F.jp,
          valign: 'top', margin: 0, lineSpacingMultiple: 1.40,
        });
      }
    });
    if (slideJson.chart_caption) {
      slide.addText(slideJson.chart_caption, {
        x: L.marginX, y: 5.10, w: 10 - L.marginX * 2, h: 0.20,
        fontSize: 9.5, color: C.gray500, fontFace: F.jp,
        charSpacing: 0.5, align: 'left', valign: 'middle', margin: 0,
        lineSpacingMultiple: 1.30,
      });
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CHART-A2（左チャート + 右テキスト）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderChartA2Text };
})();

// ─── chart-a3-3col.js ────────────────────────────────────────────
const { renderChartA3ThreeCol } = (function () {
  /**
   * CHART-A3 上チャート + 下 3 カラムコメント (Category J: CHART)
   * =========================================================
   * チャートの上部表示と、その下に 3 つの観点コメントを横並び。
   * 例: グラフの「Why」「So What」「Now What」を 3 角度から論じるコンサル定番。
   *
   * 期待 JSON:
   *   {
   *     title, subtitle,
   *     chart: { template_id: "CHART-XX", ... },
   *     comments: [
   *       { headline: "Why", body: "..." },
   *       { headline: "So What", body: "..." },
   *       { headline: "Now What", body: "..." }
   *     ]
   *   }
   */

  const atoms = require('../atoms');
  const S = require('../charts/_chart-style');

  function renderChartA3ThreeCol(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || '',
      slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    const contentTop = (titleBottomY || L.contentY) + 0.10;
    const contentBottom = 5.05;
    const totalW = 10 - L.marginX * 2;

    // チャート: 上 2.55" / コメント: 下 残り
    const chartH = 2.55;
    const chartX = L.marginX;
    const chartY = contentTop;
    const chartW = totalW;

    if (slideJson.chart && ctx.chartRegistry) {
      const chartJson = slideJson.chart;
      const drawChart = ctx.chartRegistry[chartJson.template_id];
      if (drawChart) {
        try {
          drawChart(slide, chartJson, { x: chartX, y: chartY, w: chartW, h: chartH }, ctx);
          if (Array.isArray(slideJson.annotations) && slideJson.annotations.length > 0) {
            S.drawChartAnnotations(slide, slideJson.annotations, ctx);
          }
        } catch (e) {
          console.error(`[CHART-A3] chart エラー:`, e.message);
        }
      }
    }

    // 下: 3 カラムコメント
    const commentY = chartY + chartH + 0.20;
    const commentH = contentBottom - commentY;
    const comments = (slideJson.comments || []).slice(0, 3);
    const colGap = 0.22;
    const colW = (totalW - colGap * 2) / 3;

    comments.forEach((cm, i) => {
      const cx = L.marginX + i * (colW + colGap);
      // 上端アクセントバー (h 0.04→0.05 で視認性を一段上げる)
      slide.addShape(pres.shapes.RECTANGLE, {
        x: cx, y: commentY, w: colW, h: 0.05,
        fill: { color: i === 0 ? C.brand : (i === 1 ? C.accent : C.highlight) },  // v11.4: 3 番目 gray500 → highlight (等価 3 色)
        line: { type: 'none' },
      });
      slide.addText(cm.headline || '', {
        x: cx, y: commentY + 0.10, w: colW, h: 0.30,
        fontSize: 12, color: C.ink, fontFace: F.jp,
        bold: true, charSpacing: -0.3, valign: 'top', margin: 0,
      });
      if (cm.body) {
        slide.addText(cm.body, {
          x: cx, y: commentY + 0.42, w: colW, h: commentH - 0.50,
          fontSize: 10, color: C.gray700, fontFace: F.jp,
          valign: 'top', margin: 0, lineSpacingMultiple: 1.40,
        });
      }
    });
    if (slideJson.chart_caption) {
      slide.addText(slideJson.chart_caption, {
        x: L.marginX, y: 5.10, w: totalW, h: 0.20,
        fontSize: 9.5, color: C.gray500, fontFace: F.jp,
        charSpacing: 0.5, align: 'left', valign: 'middle', margin: 0,
        lineSpacingMultiple: 1.30,
      });
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CHART-A3（上チャート + 下 3 カラム）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderChartA3ThreeCol };
})();

// ─── chart-a4-pair.js ────────────────────────────────────────────
const { renderChartA4Pair } = (function () {
  /**
   * CHART-A4 上下 2 チャート並列 (Category J: CHART)
   * ==============================================
   * 1 つの主張を 2 つの角度で見せる。例:
   *   - 上=推移グラフ / 下=最新スナップショットの構成比
   *   - 上=自社推移 / 下=競合推移
   *   - 左=収益 / 右=コスト
   *
   * 期待 JSON:
   *   {
   *     title, subtitle,
   *     layout?: "vertical" | "horizontal",   // default vertical
   *     chart_top:    { template_id, ..., caption? },
   *     chart_bottom: { template_id, ..., caption? }
   *   }
   */

  const atoms = require('../atoms');
  const S = require('../charts/_chart-style');

  function renderChartA4Pair(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || '',
      slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    const contentTop = (titleBottomY || L.contentY) + 0.10;
    const contentBottom = 5.05;
    const totalW = 10 - L.marginX * 2;
    const totalH = contentBottom - contentTop;
    const layout = slideJson.layout || 'vertical';
    const gap = 0.24;

    function drawSubChart(chartJson, area, label) {
      if (!chartJson || !ctx.chartRegistry) return;
      const drawChart = ctx.chartRegistry[chartJson.template_id];
      if (!drawChart) return;
      // チャートの上に小さなラベル
      if (chartJson.caption) {
        slide.addText(chartJson.caption, {
          x: area.x, y: area.y, w: area.w, h: 0.20,
          fontSize: 10, color: C.gray400 || C.gray500, fontFace: F.jp,
          bold: true, charSpacing: 0.5, align: 'left', valign: 'middle', margin: 0,
        });
      }
      const padTop = chartJson.caption ? 0.20 : 0;
      try {
        drawChart(slide, chartJson, {
          x: area.x, y: area.y + padTop,
          w: area.w, h: area.h - padTop,
        }, ctx);
      } catch (e) {
        console.error(`[CHART-A4] ${label} chart エラー:`, e.message);
      }
    }

    if (layout === 'horizontal') {
      const subW = (totalW - gap) / 2;
      drawSubChart(slideJson.chart_top,    { x: L.marginX, y: contentTop, w: subW, h: totalH }, 'left');
      drawSubChart(slideJson.chart_bottom, { x: L.marginX + subW + gap, y: contentTop, w: subW, h: totalH }, 'right');
    } else {
      const subH = (totalH - gap) / 2;
      drawSubChart(slideJson.chart_top,    { x: L.marginX, y: contentTop, w: totalW, h: subH }, 'top');
      drawSubChart(slideJson.chart_bottom, { x: L.marginX, y: contentTop + subH + gap, w: totalW, h: subH }, 'bottom');
    }
    if (Array.isArray(slideJson.annotations) && slideJson.annotations.length > 0) {
      S.drawChartAnnotations(slide, slideJson.annotations, ctx);
    }
    if (slideJson.chart_caption) {
      slide.addText(slideJson.chart_caption, {
        x: L.marginX, y: 5.10, w: totalW, h: 0.20,
        fontSize: 9.5, color: C.gray500, fontFace: F.jp,
        charSpacing: 0.5, align: 'left', valign: 'middle', margin: 0,
        lineSpacingMultiple: 1.30,
      });
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CHART-A4（2 チャート並列）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderChartA4Pair };
})();


// ─── chart-a6-kpi.js (v11.7 新規 / Phase γ) ──────────────────────
const { renderChartA6KPI } = (function () {
  /**
   * CHART-A6 KPI ダッシュボード (v11.7 新規 / Category J: CHART)
   * ============================================================
   * 4 つの KPI 数値カード (大数字 + ラベル + 前期比) + 1 メイン chart (任意)。
   *
   * 期待 JSON:
   *   {
   *     kpis: [
   *       { label, value, unit?, delta?, delta_dir?: 'up' | 'down' | 'flat' }
   *     ] (4 件推奨),
   *     chart?: { template_id: "CHART-XX", ...固有 }  // optional, 下半分に小さく表示
   *   }
   */
  const atoms = require('../atoms');
  function renderChartA6KPI(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' });
    const topY = (titleBottomY || L.contentY) + 0.10;
    const totalH = 5.05 - topY;
    const hasChart = !!slideJson.chart;
    const kpiH = hasChart ? totalH * 0.42 : totalH;
    const chartH = hasChart ? totalH - kpiH - 0.20 : 0;
    const kpis = (slideJson.kpis || []).slice(0, 4);
    const gap = 0.18;
    const totalW = 10 - L.marginX * 2;
    const cardW = (totalW - gap * (Math.max(1, kpis.length - 1))) / Math.max(1, kpis.length);
    kpis.forEach((k, i) => {
      const x = L.marginX + i * (cardW + gap);
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: topY, w: cardW, h: kpiH, rectRadius: L.cardRadius,
        fill: { color: C.white }, line: { color: C.gray200, width: L.lineWidth },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: topY, w: cardW, h: 0.05,
        fill: { color: C.brand }, line: { type: 'none' },
      });
      // label
      slide.addText(k.label || '', {
        x: x + 0.18, y: topY + 0.20, w: cardW - 0.36, h: 0.28,
        fontSize: 10, color: C.gray500, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      // value (大きく)
      slide.addText([
        { text: k.value || '', options: { fontSize: 28, bold: true, color: C.ink } },
        { text: k.unit ? '  ' + k.unit : '', options: { fontSize: 12, color: C.gray700 } },
      ], {
        x: x + 0.18, y: topY + 0.52, w: cardW - 0.36, h: 0.60,
        fontFace: F.jp, align: 'left', valign: 'middle', margin: 0,
      });
      // delta
      if (k.delta) {
        const dirSym = k.delta_dir === 'up' ? '▲' : (k.delta_dir === 'down' ? '▼' : '・');
        const dirColor = k.delta_dir === 'up' ? C.brand : (k.delta_dir === 'down' ? C.accent : C.gray500);
        slide.addText(`${dirSym} ${k.delta}`, {
          x: x + 0.18, y: topY + kpiH - 0.40, w: cardW - 0.36, h: 0.28,
          fontSize: 10, color: dirColor, fontFace: F.jp, bold: true,
          align: 'left', valign: 'middle', margin: 0,
        });
      }
    });
    if (hasChart && ctx.chartRegistry) {
      const drawChart = ctx.chartRegistry[slideJson.chart.template_id];
      if (drawChart) {
        try {
          drawChart(slide, slideJson.chart, {
            x: L.marginX, y: topY + kpiH + 0.20, w: totalW, h: chartH,
          }, ctx);
        } catch (e) {
          console.error('[CHART-A6] chart error:', e.message);
        }
      }
    }
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CHART-A6（KPI ダッシュボード）',
        goal: slideJson.slide_goal.title || '', message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderChartA6KPI };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'CHART-A1': renderChartA1Only,
  'CHART-A2': renderChartA2Text,
  'CHART-A3': renderChartA3ThreeCol,
  'CHART-A4': renderChartA4Pair,
  'CHART-A6': renderChartA6KPI,  // v11.7: KPI ダッシュボード
};
