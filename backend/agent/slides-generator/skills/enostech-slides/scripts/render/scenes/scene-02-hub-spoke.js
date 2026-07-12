/**
 * SCENE-02 ハブ&スポーク拡張
 * ===========================
 * 中心 + 4-8 周辺ノード。DIAG-07 (放射図) との違い:
 *   - 各スポークに sub (説明 1 行) を付けられる
 *   - 強調したいスポークだけ accent 色にできる
 *
 * sceneJson:
 *   {
 *     center: { label, sub? },
 *     spokes: [
 *       { label, sub?, emphasis?: true|false }  // emphasis で accent 色に
 *     ]
 *   }
 */
'use strict';
const A = require('../atoms-shape');

function drawScene02HubSpoke(slide, sceneJson, area, ctx) {
  const center = sceneJson.center || {};
  const spokes = Array.isArray(sceneJson.spokes) ? sceneJson.spokes : [];
  const n = spokes.length;
  if (n === 0) return;

  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const radius = Math.max(Math.min(area.w * 0.30, area.h * 0.42), 0.95);
  const centerR = 0.50;
  const spokeR = 0.40;

  // スポーク (線 + ノード)
  spokes.forEach((sp, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const sx = cx + Math.cos(angle) * radius;
    const sy = cy + Math.sin(angle) * radius;

    // 接続線
    A.drawLink(slide, { cx, cy }, { cx: sx, cy: sy },
      { color: 'gray300', width: 1 }, ctx);

    // 周辺ノード (label + sub を drawNode 内に二段表示)
    // 強調 (emphasis) ノードだけ accentSoft の薄塗りを残す。
    A.drawNode(slide,
      { x: sx - spokeR, y: sy - spokeR, w: spokeR * 2, h: spokeR * 2 },
      {
        shape: 'oval',
        fill: sp.emphasis ? 'accentSoft' : 'canvas',
        stroke: sp.emphasis ? 'accent' : 'brand',
        strokeWidth: sp.emphasis ? 1.25 : 0.75,
        textColor: sp.emphasis ? 'accentDeep' : 'brandDeep',
        subColor: sp.emphasis ? 'accentDeep' : 'gray700',
        label: sp.label || '',
        sub: sp.sub,
        labelSize: 9,
        subSize: 7,
        bold: true,
      }, ctx);
  });

  // 中心
  A.drawNode(slide,
    { x: cx - centerR, y: cy - centerR, w: centerR * 2, h: centerR * 2 },
    {
      shape: 'oval',
      fill: 'brand', stroke: 'brand', strokeWidth: 0,
      textColor: 'white', subColor: 'white',
      label: center.label || '',
      sub: center.sub,
      labelSize: 11,
    }, ctx);
}

module.exports = { drawScene02HubSpoke };
