/**
 * DIAG-09 2 軸プロット (Category I: DIAGRAM)
 * ==========================================
 * X-Y 軸上にアイテムを配置（競合ポジショニング・技術選定等）。
 *
 * diagramJson:
 *   {
 *     x_axis: { low, high, label? },
 *     y_axis: { low, high, label? },
 *     items: [{ label, x: 0.0-1.0, y: 0.0-1.0, color? }]   // x/y は正規化座標
 *   }
 */

'use strict';

function drawDIAG09Scatter(slide, diagramJson, area, ctx) {
  const { C, F, pres } = ctx;
  const xAxis = diagramJson.x_axis || {};
  const yAxis = diagramJson.y_axis || {};
  const items = Array.isArray(diagramJson.items) ? diagramJson.items : [];

  // プロット領域
  const plotX = area.x + 0.6;
  const plotY = area.y + 0.3;
  const plotW = area.w - 0.8;
  const plotH = area.h - 0.7;

  // 背景 (薄)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: plotX, y: plotY, w: plotW, h: plotH,
    fill: { color: C.gray50 }, line: { color: C.gray300, width: 0.25 },
  });
  // X / Y 軸線
  slide.addShape(pres.shapes.LINE, {
    x: plotX, y: plotY + plotH, w: plotW, h: 0,
    line: { color: C.gray400, width: 1 },
  });
  slide.addShape(pres.shapes.LINE, {
    x: plotX, y: plotY, w: 0, h: plotH,
    line: { color: C.gray400, width: 1 },
  });
  // 中央クロスヘア (4 象限の境界)
  slide.addShape(pres.shapes.LINE, {
    x: plotX + plotW / 2, y: plotY, w: 0, h: plotH,
    line: { color: C.gray200, width: 0.25, dashType: 'dash' },
  });
  slide.addShape(pres.shapes.LINE, {
    x: plotX, y: plotY + plotH / 2, w: plotW, h: 0,
    line: { color: C.gray200, width: 0.25, dashType: 'dash' },
  });

  // アイテム (散布点 + ラベル)
  items.forEach(item => {
    const px = plotX + plotW * Math.max(0, Math.min(1, item.x || 0.5));
    const py = plotY + plotH * (1 - Math.max(0, Math.min(1, item.y || 0.5)));  // y 反転
    const dot = 0.22;
    const color = item.color === 'accent' ? C.accent : C.brand;

    slide.addShape(pres.shapes.OVAL, {
      x: px - dot / 2, y: py - dot / 2, w: dot, h: dot,
      fill: { color }, line: { color: C.white, width: 1.5 },
    });
    slide.addText(item.label || '', {
      x: px + 0.15, y: py - 0.12, w: 1.5, h: 0.25,
      fontSize: 10, color: C.ink, fontFace: F.jp, bold: true,
      align: 'left', valign: 'middle', margin: 0,
    });
  });

  // 軸ラベル
  slide.addText(xAxis.low || '低', {
    x: plotX, y: plotY + plotH + 0.05, w: 1.0, h: 0.25,
    fontSize: 9, color: C.gray500, fontFace: F.jp,
    align: 'left', valign: 'middle', margin: 0,
  });
  slide.addText(xAxis.high || '高', {
    x: plotX + plotW - 1.0, y: plotY + plotH + 0.05, w: 1.0, h: 0.25,
    fontSize: 9, color: C.gray500, fontFace: F.jp,
    align: 'right', valign: 'middle', margin: 0,
  });
  if (xAxis.label) {
    slide.addText(xAxis.label, {
      x: plotX, y: plotY + plotH + 0.30, w: plotW, h: 0.22,
      fontSize: 10, color: C.gray700, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });
  }
  slide.addText(yAxis.high || '高', {
    x: area.x, y: plotY, w: 0.5, h: 0.25,
    fontSize: 9, color: C.gray500, fontFace: F.jp,
    align: 'center', valign: 'middle', margin: 0,
  });
  slide.addText(yAxis.low || '低', {
    x: area.x, y: plotY + plotH - 0.25, w: 0.5, h: 0.25,
    fontSize: 9, color: C.gray500, fontFace: F.jp,
    align: 'center', valign: 'middle', margin: 0,
  });
}

module.exports = { drawDIAG09Scatter };
