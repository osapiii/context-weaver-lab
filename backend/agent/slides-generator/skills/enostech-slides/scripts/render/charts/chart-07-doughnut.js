/**
 * CHART-07 ドーナツ (DOUGHNUT)
 * ============================
 * 構成比の比較。コンサル品質では使い処を選ぶ (3-5 セグメントまで・差が
 * 大きいときに限る)。一般用途・社内資料では分かりやすさが勝つので採用。
 *
 * chartJson:
 *   {
 *     items: [
 *       { name: "新規",  value: 60 },
 *       { name: "継続",  value: 25 },
 *       { name: "再開",  value: 15 }
 *     ]
 *   }
 */
'use strict';
const S = require('./_chart-style');

function drawCHART07Doughnut(slide, chartJson, area, ctx) {
  const { C, F, pres } = ctx;
  const items = chartJson.items || [];
  if (items.length === 0) return;

  // pptxgenjs の DOUGHNUT は 1 系列のみ
  const series = [{
    name: chartJson.title || '構成比',
    labels: items.map(i => i.name || ''),
    values: items.map(i => i.value || 0),
  }];

  const opts = {
    x: area.x, y: area.y, w: area.w, h: area.h,
    chartColors: S.chartPalette(C, items.length),
    showLegend: true,
    legendPos: 'b',
    legendFontFace: F.jp,
    legendFontSize: 9,
    legendColor: C.ink,
    showPercent: true,
    dataLabelFontFace: F.jp,
    dataLabelFontSize: 9,
    dataLabelColor: C.ink,
    holeSize: 60,
    ...S.areaStyle(C),
  };
  slide.addChart(pres.charts.DOUGHNUT, series, opts);
}

module.exports = { drawCHART07Doughnut };
