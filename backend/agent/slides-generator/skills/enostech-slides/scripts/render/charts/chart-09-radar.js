/**
 * CHART-09 レーダー (RADAR)
 * =========================
 * 多軸スコア比較。製品評価・スキル評価・競合比較 (5-8 軸が読みやすい)。
 *
 * chartJson:
 *   {
 *     axes: ["品質", "価格", "サポート", "機能", "速度"],
 *     series: [
 *       { name: "A 社", values: [4, 3, 5, 4, 3] },
 *       { name: "B 社", values: [3, 5, 3, 4, 5] }
 *     ]
 *   }
 */
'use strict';
const S = require('./_chart-style');

function drawCHART09Radar(slide, chartJson, area, ctx) {
  const { C, F, pres } = ctx;
  const series = (chartJson.series || []).map(s => ({
    name: s.name || '',
    labels: chartJson.axes || [],
    values: s.values || [],
  }));
  if (series.length === 0) return;

  const opts = {
    x: area.x, y: area.y, w: area.w, h: area.h,
    radarStyle: 'standard',
    chartColors: S.chartPalette(C, series.length),
    lineSize: 2,
    showMarker: true,
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 5,
    catAxisLabelFontFace: F.jp,
    catAxisLabelFontSize: 9,
    catAxisLabelColor: C.ink,
    ...S.legendStyle(C, F, series.length > 1),
    ...S.areaStyle(C),
  };
  slide.addChart(pres.charts.RADAR, series, opts);
}

module.exports = { drawCHART09Radar };
