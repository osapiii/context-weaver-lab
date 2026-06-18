/**
 * CHART-06 ウォーターフォール (積み上げ棒の応用)
 * ============================================
 * 起点 → 増減推移 → 着地点を可視化。
 *
 * 実装: 3 系列の積み上げ棒 (base / 増加 / 減少)。
 *   - base   = canvas 色 (背景に溶け込ませる)
 *   - 増加   = brand
 *   - 減少   = accent
 * pptxgenjs の showValue は系列毎に分けられないため、上端のラベルは
 * shape ベースの addText で別途描画する。
 *
 * chartJson:
 *   {
 *     categories: ["FY24", "新規", "解約", "値上げ", "FY25"],
 *     items: [
 *       { type: "start", value: 100 },
 *       { type: "plus",  value: 30 },
 *       { type: "minus", value: 15 },
 *       { type: "plus",  value: 10 },
 *       { type: "end",   value: 125 }
 *     ]
 *   }
 */
'use strict';
const S = require('./_chart-style');
// 増加バーの色は chartPalette と同じリード色を使う (mono テーマではスレート)
function _leadColor(C) {
  return S.chartPalette(C, 1)[0];
}

function drawCHART06Waterfall(slide, chartJson, area, ctx) {
  const { C, F, pres } = ctx;
  const cats = chartJson.categories || [];
  const items = chartJson.items || [];
  if (items.length === 0) return;

  // 累積値 + 各バー上端 (= 値表示位置の Y 値) を計算
  const bases = [];
  const positives = [];
  const negatives = [];
  const tops = [];   // 各バーの上端値 (実数値)
  const labels = []; // [{ text, kind: 'plus'|'minus' }]
  let cum = 0;
  let yMax = 0;

  items.forEach(it => {
    if (it.type === 'start') {
      bases.push(0);  positives.push(it.value); negatives.push(0);
      tops.push(it.value);
      labels.push({ text: String(it.value), kind: 'plus' });
      cum = it.value;
    } else if (it.type === 'plus') {
      bases.push(cum); positives.push(it.value); negatives.push(0);
      tops.push(cum + it.value);
      labels.push({ text: '+' + it.value, kind: 'plus' });
      cum += it.value;
    } else if (it.type === 'minus') {
      cum -= it.value;
      bases.push(cum); positives.push(0); negatives.push(it.value);
      tops.push(cum + it.value);  // 減少前の高さに表示
      labels.push({ text: '−' + it.value, kind: 'minus' });
    } else if (it.type === 'end') {
      bases.push(0); positives.push(it.value); negatives.push(0);
      tops.push(it.value);
      labels.push({ text: String(it.value), kind: 'plus' });
    }
    yMax = Math.max(yMax, cum, it.value);
  });
  // 最大値に余白を加えて軸スケール (pptxgenjs に直接渡せないが値の正規化に使う)
  const ySpan = yMax * 1.10;

  const series = [
    { name: 'base',  labels: cats, values: bases },
    { name: '増加',  labels: cats, values: positives },
    { name: '減少',  labels: cats, values: negatives },
  ];

  const opts = {
    x: area.x, y: area.y, w: area.w, h: area.h,
    barDir: 'col',
    barGrouping: 'stacked',
    chartColors: [C.canvas, _leadColor(C), C.accent],
    showValue: false,
    ...S.axisStyle(C, F),
    ...S.dataLabelStyle(C, F),
    showLegend: false,
    ...S.areaStyle(C),
  };
  slide.addChart(pres.charts.BAR, series, opts);

  // ── ラベルを上に shape で描画 ──
  // pptxgenjs のチャートのプロット領域は内部マージンがあるため概算で配置。
  // 上下マージン: top ≈ 0.20 / bottom ≈ 0.55 (軸ラベル + categoryAxis 分)
  // 左右マージン: left ≈ 0.55 (Y 軸ラベル) / right ≈ 0.10
  const plotX = area.x + 0.55;
  const plotY = area.y + 0.20;
  const plotW = area.w - 0.65;
  const plotH = area.h - 0.75;
  const n = items.length;
  const colW = plotW / n;

  labels.forEach((lab, i) => {
    if (!lab.text) return;
    const cx = plotX + colW * i + colW / 2;
    // 値を Y 座標へ変換 (上が正)
    const topVal = tops[i];
    const yPos = plotY + plotH * (1 - topVal / ySpan) - 0.30; // バー上端より少し上
    slide.addText(lab.text, {
      x: cx - 0.40, y: yPos, w: 0.80, h: 0.24,
      fontSize: 10, fontFace: F.jp, bold: true,
      color: lab.kind === 'minus' ? C.accent : _leadColor(C),
      align: 'center', valign: 'middle', margin: 0,
    });
  });
}

module.exports = { drawCHART06Waterfall };
