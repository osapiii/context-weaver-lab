/**
 * CHART-04 折れ線 (LINE)
 * ======================
 * 時系列の推移、傾向。コンサル流儀: smooth=false で角ばった線にする。
 *
 * chartJson:
 *   {
 *     categories: ["1月", "2月", ...],
 *     series: [
 *       { name: "売上", values: [...] },
 *       { name: "コスト", values: [...] }
 *     ],
 *     show_marker?: true
 *   }
 */
'use strict';
const S = require('./_chart-style');

function drawCHART04Line(slide, chartJson, area, ctx) {
  const { C, F, pres } = ctx;
  const series = (chartJson.series || []).map(s => ({
    name: s.name || '',
    labels: chartJson.categories || [],
    values: s.values || [],
  }));
  if (series.length === 0) return;
  const showValue = chartJson.show_value !== false;
  const hasEmphasis = chartJson.series.some(s => s.highlight);
  const colors = hasEmphasis
    ? S.emphasisChartColors(chartJson.series, C)
    : S.chartPalette(C, series.length);

  const opts = {
    x: area.x, y: area.y, w: area.w, h: area.h,
    lineSize: 2,
    lineSmooth: false,  // コンサル品質: 角ばった線
    chartColors: colors,
    showLegend: series.length > 1,
    showMarker: chartJson.show_marker !== false,
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 6,
    showValue,
    dataLabelPosition: 't',
    ...S.axisStyle(C, F),
    ...S.dataLabelStyle(C, F),
    ...S.legendStyle(C, F, series.length > 1),
    ...S.areaStyle(C),
  };
  slide.addChart(pres.charts.LINE, series, opts);
}

module.exports = { drawCHART04Line };
