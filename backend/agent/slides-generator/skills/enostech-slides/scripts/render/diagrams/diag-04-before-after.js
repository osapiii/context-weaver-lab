/**
 * DIAG-04 Before/After 比較 (Category I: DIAGRAM)
 * ===============================================
 * 2 つの状態を矢印で結ぶ。Before (gray) → After (accent)。
 *
 * diagramJson:
 *   { before: { title, body }, after: { title, body } }
 */

'use strict';

function drawDIAG04BeforeAfter(slide, diagramJson, area, ctx) {
  const { C, F, pres } = ctx;
  const before = diagramJson.before || {};
  const after = diagramJson.after || {};

  const arrowW = 1.0;
  const boxW = (area.w - arrowW - 0.4) / 2;
  const boxH = Math.min(2.6, area.h - 0.4);
  const boxY = area.y + (area.h - boxH) / 2;

  // Before
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: area.x, y: boxY, w: boxW, h: boxH, rectRadius: 0.08,
    fill: { color: C.gray100 }, line: { color: C.gray300, width: 0.25 },
  });
  slide.addText('Before', {
    x: area.x + 0.20, y: boxY + 0.20, w: boxW - 0.40, h: 0.30,
    fontSize: 11, color: C.gray500, fontFace: F.jp, bold: true,
    charSpacing: 2, align: 'left', valign: 'top', margin: 0,
  });
  slide.addText(before.title || '', {
    x: area.x + 0.20, y: boxY + 0.55, w: boxW - 0.40, h: 0.50,
    fontSize: 16, color: C.ink, fontFace: F.jp, bold: true,
    align: 'left', valign: 'top', margin: 0,
  });
  slide.addText(before.body || '', {
    x: area.x + 0.20, y: boxY + 1.10, w: boxW - 0.40, h: boxH - 1.30,
    fontSize: 11, color: C.gray700, fontFace: F.jp,
    align: 'left', valign: 'top', margin: 0,
  });

  // 矢印 (太く、視認性アップ)
  slide.addShape(pres.shapes.RIGHT_ARROW, {
    x: area.x + boxW + 0.20, y: boxY + boxH / 2 - 0.35, w: arrowW - 0.10, h: 0.70,
    fill: { color: C.accent }, line: { type: 'none' },
  });

  // After
  // 「After は強い」を表現。
  const afterX = area.x + boxW + arrowW + 0.30;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: afterX, y: boxY, w: boxW, h: boxH, rectRadius: 0.08,
    fill: { color: C.canvas }, line: { color: C.accent, width: 1.5 },
  });
  slide.addText('After', {
    x: afterX + 0.20, y: boxY + 0.20, w: boxW - 0.40, h: 0.30,
    fontSize: 11, color: C.accentDeep, fontFace: F.jp, bold: true,
    charSpacing: 2, align: 'left', valign: 'top', margin: 0,
  });
  slide.addText(after.title || '', {
    x: afterX + 0.20, y: boxY + 0.55, w: boxW - 0.40, h: 0.50,
    fontSize: 16, color: C.ink, fontFace: F.jp, bold: true,
    align: 'left', valign: 'top', margin: 0,
  });
  slide.addText(after.body || '', {
    x: afterX + 0.20, y: boxY + 1.10, w: boxW - 0.40, h: boxH - 1.30,
    fontSize: 11, color: C.gray700, fontFace: F.jp,
    align: 'left', valign: 'top', margin: 0,
  });
}

module.exports = { drawDIAG04BeforeAfter };
