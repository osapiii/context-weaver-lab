/**
 * CHART-03 横棒 (BAR / bar)
 * =========================
 * 長いカテゴリ名のランキング、トップ N 比較。
 *
 * chartJson:
 *   {
 *     categories: ["A 部門", "B 部門", "C 部門", ...],
 *     series: [{ name: "売上", values: [120, 95, 80, ...] }]
 *   }
 */
'use strict';
const S = require('./_chart-style');

function drawCHART03BarHoriz(slide, chartJson, area, ctx) {
  const { C, F, pres } = ctx;
  const series = (chartJson.series || []).map(s => ({
    name: s.name || '',
    labels: chartJson.categories || [],
    values: s.values || [],
  }));
  if (series.length === 0) return;

  const opts = {
    x: area.x, y: area.y, w: area.w, h: area.h,
    barDir: 'bar',
    chartColors: S.chartPalette(C, series.length),
    showValue: !!chartJson.show_value,
    dataLabelPosition: 'outEnd',
    ...S.axisStyle(C, F),
    ...S.dataLabelStyle(C, F),
    ...S.legendStyle(C, F, series.length > 1),
    ...S.areaStyle(C),
  };
  slide.addChart(pres.charts.BAR, series, opts);
}

module.exports = { drawCHART03BarHoriz };
