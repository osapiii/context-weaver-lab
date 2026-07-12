/**
 * CHART-02 積み上げ縦棒 (BAR / stacked)
 * ====================================
 * 構成比の推移。シリーズ合計が同期間内で意味を持つときに使う。
 *
 * chartJson:
 *   {
 *     categories: ["2022", "2023", "2024", "2025"],
 *     series: [
 *       { name: "新規", values: [40, 50, 60, 70] },
 *       { name: "継続", values: [80, 95, 120, 140] }
 *     ]
 *   }
 */
'use strict';
const S = require('./_chart-style');

function drawCHART02BarStacked(slide, chartJson, area, ctx) {
  const { C, F, pres } = ctx;
  const series = (chartJson.series || []).map(s => ({
    name: s.name || '',
    labels: chartJson.categories || [],
    values: s.values || [],
  }));
  if (series.length === 0) return;

  const opts = {
    x: area.x, y: area.y, w: area.w, h: area.h,
    barDir: 'col',
    barGrouping: 'stacked',
    chartColors: S.chartPalette(C, series.length),
    showValue: false,
    ...S.axisStyle(C, F),
    ...S.dataLabelStyle(C, F),
    ...S.legendStyle(C, F, true),
    ...S.areaStyle(C),
  };
  slide.addChart(pres.charts.BAR, series, opts);
}

module.exports = { drawCHART02BarStacked };
