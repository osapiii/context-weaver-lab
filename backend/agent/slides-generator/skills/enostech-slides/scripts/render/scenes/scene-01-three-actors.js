/**
 * SCENE-01 3者関係図
 * ===================
 * 中央 (橋渡し役) + 左 (送り手) + 右 (受け手) の関係を 1 枚で示すシーン。
 *
 * よくある例:
 *   - データ Agent が事業部の質問者と従来 BI を翻訳する
 *   - 営業が顧客とエンジニアの言語をつなぐ
 *
 * sceneJson:
 *   {
 *     center: { label, sub? },
 *     left:   { label, sub? },
 *     right:  { label, sub? },
 *     left_to_center_label?:  "翻訳",
 *     center_to_right_label?: "数字に変換"
 *   }
 */
'use strict';
const A = require('../atoms-shape');

function drawScene01ThreeActors(slide, sceneJson, area, ctx) {
  const { C } = ctx;

  // ノード配置: 左 0.20w / 中央 0.50w / 右 0.80w
  const cy = area.y + area.h / 2;
  const nodeR = Math.min(area.h * 0.45, 0.85);

  const leftCx   = area.x + area.w * 0.18;
  const centerCx = area.x + area.w * 0.50;
  const rightCx  = area.x + area.w * 0.82;

  // リンク (背面)
  A.drawArrow(slide,
    { cx: leftCx + nodeR, cy },
    { cx: centerCx - nodeR, cy },
    { color: 'gray400', width: 1.5 }, ctx);
  A.drawArrow(slide,
    { cx: centerCx + nodeR, cy },
    { cx: rightCx - nodeR, cy },
    { color: 'gray400', width: 1.5 }, ctx);

  // リンクラベル
  if (sceneJson.left_to_center_label) {
    A.drawTagPill(slide,
      (leftCx + centerCx) / 2 - 0.50, cy - 0.50, sceneJson.left_to_center_label,
      { fill: 'canvas', textColor: 'gray500', w: 1.00 }, ctx);
  }
  if (sceneJson.center_to_right_label) {
    A.drawTagPill(slide,
      (centerCx + rightCx) / 2 - 0.50, cy - 0.50, sceneJson.center_to_right_label,
      { fill: 'canvas', textColor: 'gray500', w: 1.00 }, ctx);
  }

  // 左ノード (中立 — canvas + gray400 細線)
  A.drawNode(slide,
    { x: leftCx - nodeR, y: cy - nodeR, w: nodeR * 2, h: nodeR * 2 },
    {
      shape: 'oval',
      fill: 'canvas', stroke: 'gray400', strokeWidth: 1,
      label: (sceneJson.left || {}).label || '',
      sub:   (sceneJson.left || {}).sub,
      labelSize: 11,
    }, ctx);

  // 右ノード (中立 — canvas + gray400 細線)
  A.drawNode(slide,
    { x: rightCx - nodeR, y: cy - nodeR, w: nodeR * 2, h: nodeR * 2 },
    {
      shape: 'oval',
      fill: 'canvas', stroke: 'gray400', strokeWidth: 1,
      label: (sceneJson.right || {}).label || '',
      sub:   (sceneJson.right || {}).sub,
      labelSize: 11,
    }, ctx);

  // 中央ノード (brand 強調)
  A.drawNode(slide,
    { x: centerCx - nodeR, y: cy - nodeR, w: nodeR * 2, h: nodeR * 2 },
    {
      shape: 'oval',
      fill: 'brand', stroke: 'brand', strokeWidth: 0,
      textColor: 'white', subColor: 'white',
      label: (sceneJson.center || {}).label || '',
      sub:   (sceneJson.center || {}).sub,
      labelSize: 12,
    }, ctx);
}

module.exports = { drawScene01ThreeActors };
