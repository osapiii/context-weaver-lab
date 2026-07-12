/**
 * DIAG-06 タイムライン (Category I: DIAGRAM)
 * ==========================================
 * 横ライン上にイベントマーカーを配置。
 *
 * diagramJson:
 *   { events: [{ at_label, title, body? }] }   // 3-6 件
 */

'use strict';

function drawDIAG06Timeline(slide, diagramJson, area, ctx) {
  const { C, F, pres } = ctx;
  const events = Array.isArray(diagramJson.events) ? diagramJson.events : [];
  if (events.length === 0) return;

  const n = events.length;
  const lineY = area.y + area.h * 0.55;
  const lineX1 = area.x + 0.3;
  const lineX2 = area.x + area.w - 0.3;
  const lineW = lineX2 - lineX1;

  // ライン
  slide.addShape(pres.shapes.RECTANGLE, {
    x: lineX1, y: lineY - 0.02, w: lineW, h: 0.04,
    fill: { color: C.gray300 }, line: { type: 'none' },
  });

  events.forEach((ev, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const ex = lineX1 + lineW * t;
    const dot = 0.22;

    // ドット (濃くしてリング付き)
    const ring = dot + 0.10;
    slide.addShape(pres.shapes.OVAL, {
      x: ex - ring / 2, y: lineY - ring / 2, w: ring, h: ring,
      fill: { color: C.canvas }, line: { color: C.brand, width: 1 },
    });
    slide.addShape(pres.shapes.OVAL, {
      x: ex - dot / 2, y: lineY - dot / 2, w: dot, h: dot,
      fill: { color: i === 0 || i === n - 1 ? C.brand : C.accent },
      line: { type: 'none' },
    });
    // 上下交互配置: 偶数 i → 上、奇数 → 下
    const isUpper = i % 2 === 0;
    const blockH = 1.0;
    const blockW = Math.min(2.2, lineW / Math.max(2, n) - 0.2);
    const bx = ex - blockW / 2;
    const by = isUpper ? area.y + 0.1 : lineY + 0.4;

    slide.addText(ev.at_label || '', {
      x: bx, y: isUpper ? by + blockH - 0.40 : by, w: blockW, h: 0.25,
      fontSize: 10, color: C.brand, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', margin: 0, charSpacing: 1,
    });
    slide.addText(ev.title || '', {
      x: bx, y: isUpper ? by + 0.05 : by + 0.30, w: blockW, h: 0.30,
      fontSize: 12, color: C.ink, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });
    if (ev.body) {
      slide.addText(ev.body, {
        x: bx, y: isUpper ? by + 0.40 : by + 0.65, w: blockW, h: 0.40,
        fontSize: 9, color: C.gray700, fontFace: F.jp,
        align: 'center', valign: 'top', margin: 0,
      });
    }
  });
}

module.exports = { drawDIAG06Timeline };
