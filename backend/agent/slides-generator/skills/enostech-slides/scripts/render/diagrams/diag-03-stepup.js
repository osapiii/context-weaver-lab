/**
 * DIAG-03 ステップアップ図 (Category I: DIAGRAM)
 * ==============================================
 * 段階的成熟度・成長ロードマップ。3〜5 段の昇順バー。
 *
 * diagramJson:
 *   {
 *     steps: [{ label, body? }]   // 3-5 件
 *   }
 */

'use strict';

function drawDIAG03Stepup(slide, diagramJson, area, ctx) {
  const { C, F, pres } = ctx;
  const steps = Array.isArray(diagramJson.steps) ? diagramJson.steps : [];
  if (steps.length === 0) return;

  const n = steps.length;
  const gap = 0.10;
  const stepW = (area.w - gap * (n - 1)) / n;
  const baseY = area.y + area.h - 0.5;
  const labelH = 0.40;
  const minBarH = 0.6;
  const maxBarH = area.h - labelH - 0.4;

  const colorTable = [C.gray300, C.gray400, C.brand, C.accent, C.accentDeep];

  steps.forEach((step, i) => {
    const x = area.x + i * (stepW + gap);
    const ratio = (i + 1) / n;
    const barH = minBarH + (maxBarH - minBarH) * ratio;
    const y = baseY - barH;
    const color = colorTable[i] || C.brand;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: stepW, h: barH,
      fill: { color }, line: { type: 'none' },
    });
    slide.addText(step.label || '', {
      x, y: baseY + 0.05, w: stepW, h: labelH,
      fontSize: 12, color: C.ink, fontFace: F.jp, bold: true,
      align: 'center', valign: 'top', margin: 0,
    });
    if (step.body) {
      slide.addText(step.body, {
        x: x + 0.05, y: y + barH / 2 - 0.20, w: stepW - 0.10, h: 0.50,
        fontSize: 9.5, color: C.white, fontFace: F.jp,
        align: 'center', valign: 'middle', margin: 0,
      });
    }
  });
}

module.exports = { drawDIAG03Stepup };
