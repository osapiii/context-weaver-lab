/**
 * CHART-05 複合チャート (BAR + LINE)
 * ===================================
 * 棒+線の二軸ビジュアライズ。例: 棒で売上額、線で成長率。
 * pptxgenjs では addChart 第1引数を multi-type 配列にして型混在で渡す。
 *
 * chartJson:
 *   {
 *     categories: ["Q1", "Q2", ...],
 *     bar_series: [{ name: "売上", values: [...] }],
 *     line_series: [{ name: "成長率", values: [...] }],
 *     secondary_val_axis?: true   // 線を第2軸に
 *   }
 */
'use strict';
const S = require('./_chart-style');

function drawCHART05Combo(slide, chartJson, area, ctx) {
  const { C, F, pres } = ctx;
  const cats = chartJson.categories || [];
  const bars = (chartJson.bar_series || []).map(s => ({
    name: s.name || '', labels: cats, values: s.values || [],
  }));
  const lines = (chartJson.line_series || []).map(s => ({
    name: s.name || '', labels: cats, values: s.values || [],
  }));
  if (bars.length === 0 && lines.length === 0) return;

  const types = [];
  if (bars.length > 0) {
    types.push({
      type: pres.charts.BAR,
      data: bars,
      options: {
        barDir: 'col',
        chartColors: S.chartPalette(C, bars.length),
      },
    });
  }
  if (lines.length > 0) {
    // 折れ線パレット: bar とは別系で accent + brandDeep
    const linePalette = [C.accent, S.chartPalette(C, 1)[0], C.gray500];
    types.push({
      type: pres.charts.LINE,
      data: lines,
      options: {
        chartColors: linePalette.slice(0, lines.length),
        lineSize: 2,
        lineSmooth: false,
        showMarker: true,
        lineDataSymbol: 'circle',
        lineDataSymbolSize: 6,
        secondaryValAxis: !!chartJson.secondary_val_axis,
        secondaryCatAxis: !!chartJson.secondary_val_axis,
      },
    });
  }

  const opts = {
    x: area.x, y: area.y, w: area.w, h: area.h,
    ...S.axisStyle(C, F),
    ...S.dataLabelStyle(C, F),
    ...S.legendStyle(C, F, true),
    ...S.areaStyle(C),
    valAxes: chartJson.secondary_val_axis ? [
      { showValAxisTitle: false, ...S.axisStyle(C, F) },
      { showValAxisTitle: false, valAxisOrientation: 'maxMin' === 'never' ? 'minMax' : 'minMax', ...S.axisStyle(C, F) },
    ] : undefined,
    catAxes: chartJson.secondary_val_axis ? [
      { ...S.axisStyle(C, F) },
      { catAxisHidden: true },
    ] : undefined,
  };
  slide.addChart(types, opts);
}

module.exports = { drawCHART05Combo };
