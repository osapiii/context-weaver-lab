/**
 * CHART-01 縦棒 (BAR / col)
 * =========================
 * 期間や項目ごとの量比較。コンサル定番の最頻使用チャート。
 *
 * chartJson:
 *   {
 *     categories: ["2022", "2023", "2024", "2025"],
 *     series: [
 *       { name: "売上", values: [120, 145, 180, 210] },
 *       { name: "粗利", values: [40,  55,  72,  88] }
 *     ],
 *     y_axis_title?: "億円",
 *     show_value?: true,        // データラベル
 *   }
 */
'use strict';
const S = require('./_chart-style');

function drawCHART01BarCol(slide, chartJson, area, ctx) {
  const { C, F, pres } = ctx;
  const series = (chartJson.series || []).map(s => ({
    name: s.name || '',
    labels: chartJson.categories || [],
    values: s.values || [],
  }));
  if (series.length === 0) return;

  const showLegend = series.length > 1;
  //        highlight: true の系列は brand カラー、それ以外は ink (slate-800)
  const showValue = chartJson.show_value !== false;
  const hasEmphasis = series.some(s => chartJson.series.find(o => o.name === s.name && o.highlight));
  const colors = hasEmphasis
    ? S.emphasisChartColors(chartJson.series, C)
    : S.chartPalette(C, series.length);
  const opts = {
    x: area.x, y: area.y, w: area.w, h: area.h,
    barDir: 'col',
    chartColors: colors,
    showValue,
    dataLabelPosition: 'outEnd',
    valAxisTitle: chartJson.y_axis_title || '',
    showValAxisTitle: !!chartJson.y_axis_title,
    valAxisTitleFontFace: F.jp,
    valAxisTitleFontSize: 9,
    valAxisTitleColor: C.gray500,
    ...S.axisStyle(C, F),
    ...S.dataLabelStyle(C, F),
    ...S.legendStyle(C, F, showLegend),
    ...S.areaStyle(C),
  };
  slide.addChart(pres.charts.BAR, series, opts);
}

module.exports = { drawCHART01BarCol };
