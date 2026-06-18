/**
 * DIAG-08 2×2 マトリクス (Category I: DIAGRAM)
 * ===========================================
 * 4 象限分類。X 軸・Y 軸それぞれにラベル。各象限にラベル + 説明。
 *
 * diagramJson:
 *   {
 *     x_axis: { low, high },
 *     y_axis: { low, high },
 *     quadrants: {
 *       tl: { label, body? },   // top-left
 *       tr: { label, body? },
 *       bl: { label, body? },
 *       br: { label, body? }
 *     }
 *   }
 */

'use strict';

function drawDIAG08Matrix(slide, diagramJson, area, ctx) {
  const { L, C, F, pres } = ctx;
  const xAxis = diagramJson.x_axis || {};
  const yAxis = diagramJson.y_axis || {};
  const q = diagramJson.quadrants || {};
  const labelH = 0.32;
  const matX = area.x + 0.5;
  const matY = area.y + 0.3;
  const matW = area.w - 0.7;
  const matH = area.h - labelH * 2 - 0.2;
  const cellW = matW / 2;
  const cellH = matH / 2;
  const cellPad = 0.22;

  // 4 セル
  // 象限の差は線とラベルで作る。将来「特定象限だけ強調」したくなったら quadrants.{pos}.emphasis
  // フィールドで opt-in できるようにする (現状は未実装)。
  const cells = [
    { pos: 'tl', col: 0, row: 0, fill: C.canvas },
    { pos: 'tr', col: 1, row: 0, fill: C.canvas },
    { pos: 'bl', col: 0, row: 1, fill: C.canvas },
    { pos: 'br', col: 1, row: 1, fill: C.canvas },
  ];
  cells.forEach(c => {
    const cx = matX + c.col * cellW;
    const cy = matY + c.row * cellH;
    const cell = q[c.pos] || {};

    slide.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: cy, w: cellW, h: cellH,
      fill: { color: c.fill }, line: { color: C.gray200, width: (L && L.lineWidth) || 0.25 },
    });
    slide.addText(cell.label || '', {
      x: cx + cellPad, y: cy + cellPad, w: cellW - cellPad * 2, h: 0.42,
      fontSize: 14, color: C.ink, fontFace: F.jp, bold: true, charSpacing: -0.3,
      align: 'left', valign: 'top', margin: 0,
    });
    if (cell.body) {
      slide.addText(cell.body, {
        x: cx + cellPad, y: cy + cellPad + 0.42, w: cellW - cellPad * 2, h: cellH - cellPad * 2 - 0.42,
        fontSize: 10, color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0,
        lineSpacingMultiple: (L && L.lineSpacingMultiple) || 1.40,
      });
    }
  });

  slide.addText(xAxis.low || '', {
    x: matX, y: matY + matH + 0.07, w: cellW, h: labelH,
    fontSize: 11, color: C.gray700, fontFace: F.jp, bold: true,
    align: 'center', valign: 'middle', margin: 0, charSpacing: 1,
  });
  slide.addText(xAxis.high || '', {
    x: matX + cellW, y: matY + matH + 0.07, w: cellW, h: labelH,
    fontSize: 11, color: C.gray700, fontFace: F.jp, bold: true,
    align: 'center', valign: 'middle', margin: 0, charSpacing: 1,
  });

  // Y 軸ラベル (左)
  slide.addText(yAxis.high || '', {
    x: area.x, y: matY, w: 0.45, h: cellH,
    fontSize: 11, color: C.gray700, fontFace: F.jp, bold: true,
    align: 'center', valign: 'middle', margin: 0, charSpacing: 1,
  });
  slide.addText(yAxis.low || '', {
    x: area.x, y: matY + cellH, w: 0.45, h: cellH,
    fontSize: 11, color: C.gray700, fontFace: F.jp, bold: true,
    align: 'center', valign: 'middle', margin: 0, charSpacing: 1,
  });
}

module.exports = { drawDIAG08Matrix };
