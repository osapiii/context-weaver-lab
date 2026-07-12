/**
 * DIAG-05 ピラミッド図 (Category I: DIAGRAM)
 * ==========================================
 * 3 層階層構造。上から順に小→大、上位は brand、下位ほど薄く。
 *
 * diagramJson:
 *   { layers: [{ label, body? }] }   // 上から順、3 層推奨
 */

'use strict';

function drawDIAG05Pyramid(slide, diagramJson, area, ctx) {
  const { C, F, pres } = ctx;
  const layers = Array.isArray(diagramJson.layers) ? diagramJson.layers : [];
  if (layers.length === 0) return;

  const n = layers.length;
  const gap = 0.05;
  const layerH = (area.h - gap * (n - 1)) / n;

  // 中央 x
  const cx = area.x + area.w / 2;
  const colors = [C.brand, C.brandSoft, C.gray300, C.gray200];

  layers.forEach((layer, i) => {
    const ratio = (i + 1) / n;  // 上=狭、下=広
    const lw = area.w * (0.30 + ratio * 0.45);
    const lx = cx - lw / 2;
    const ly = area.y + i * (layerH + gap);
    const color = colors[i] || C.gray300;

    slide.addShape(pres.shapes.RECTANGLE, {
      x: lx, y: ly, w: lw, h: layerH,
      fill: { color }, line: { type: 'none' },
    });
    slide.addText(layer.label || '', {
      x: lx, y: ly, w: lw, h: layerH * 0.55,
      fontSize: 13, color: i < 2 ? C.white : C.ink, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
    if (layer.body) {
      slide.addText(layer.body, {
        x: lx, y: ly + layerH * 0.55, w: lw, h: layerH * 0.45,
        fontSize: 9.5, color: i < 2 ? C.white : C.gray700, fontFace: F.jp,
        align: 'center', valign: 'top', margin: 0,
      });
    }
  });
}

module.exports = { drawDIAG05Pyramid };
