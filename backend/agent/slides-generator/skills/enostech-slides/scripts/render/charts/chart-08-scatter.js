/**
 * CHART-08 散布図 (SCATTER)
 * =========================
 * 2 変量の相関、技術選定マッピング、顧客セグメント分布など。
 *
 * chartJson:
 *   {
 *     x_axis_title?: "コスト",
 *     y_axis_title?: "性能",
 *     series: [
 *       { name: "A 案", points: [{x: 10, y: 30}, ...] },
 *       { name: "B 案", points: [{x: 20, y: 50}, ...] }
 *     ]
 *   }
 */
'use strict';
const S = require('./_chart-style');

function drawCHART08Scatter(slide, chartJson, area, ctx) {
  const { C, F, pres } = ctx;
  const seriesIn = chartJson.series || [];
  if (seriesIn.length === 0) return;

  // pptxgenjs の SCATTER スキーマ: 第1要素が "X 軸"、以降が系列名
  // [{ name: "X-Axis", values: [x1, x2, ...] }, { name: "S1", values: [y1, y2, ...] }, ...]
  const allX = [];
  seriesIn.forEach(s => (s.points || []).forEach(p => allX.push(p.x)));

  // 全系列共通の X 軸を作るのは複雑なので、各系列を順次描く方式
  // → ここでは "全系列が同じ X 値" を期待するシンプル版
  const xValues = (seriesIn[0].points || []).map(p => p.x);
  const data = [
    { name: 'X-Axis', values: xValues },
    ...seriesIn.map(s => ({
      name: s.name || '',
      values: (s.points || []).map(p => p.y),
    })),
  ];

  const opts = {
    x: area.x, y: area.y, w: area.w, h: area.h,
    chartColors: S.chartPalette(C, seriesIn.length),
    lineSize: 0,           // 点だけ表示
    showMarker: true,
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 8,
    valAxisTitle: chartJson.y_axis_title || '',
    showValAxisTitle: !!chartJson.y_axis_title,
    catAxisTitle: chartJson.x_axis_title || '',
    showCatAxisTitle: !!chartJson.x_axis_title,
    valAxisTitleFontFace: F.jp,
    valAxisTitleFontSize: 9,
    catAxisTitleFontFace: F.jp,
    catAxisTitleFontSize: 9,
    ...S.axisStyle(C, F),
    ...S.legendStyle(C, F, seriesIn.length > 1),
    ...S.areaStyle(C),
  };
  slide.addChart(pres.charts.SCATTER, data, opts);
}

module.exports = { drawCHART08Scatter };
