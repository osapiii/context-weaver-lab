/**
 * SCENE-04 ビジネスモデル図
 * =========================
 * 中央にプラットフォーム/事業主体、その周囲に 3-4 アクターを配置し、
 * money / service / data の流れを示す。BizGram 風のフォーマット。
 *
 * sceneJson:
 *   {
 *     center: { label, role?, sub? },             // 中央: 会社・プラットフォーム
 *     boundary?: { label?, labelPos?: 'top'|'bottom' },  // 中央を囲う境界 (任意)
 *     actors: [
 *       {
 *         label, sub?, position: 'left'|'right'|'top'|'bottom',
 *         flows: [
 *           {
 *             type: 'money'|'service'|'data',
 *             direction: 'in'|'out',  // center 視点
 *             label?: string
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * direction: 'in'  → アクター → 中央
 * direction: 'out' → 中央 → アクター
 */
'use strict';
const A = require('../atoms-shape');

function drawScene04BusinessModel(slide, sceneJson, area, ctx) {
  // 中央プラットフォーム
  const centerW = 2.40;
  const centerH = 1.20;
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;

  // 境界 (任意)
  if (sceneJson.boundary) {
    const padX = 0.55;
    const padY = 0.30;
    A.drawBoundary(slide,
      { x: cx - centerW/2 - padX, y: cy - centerH/2 - padY,
        w: centerW + padX * 2, h: centerH + padY * 2 },
      { label: sceneJson.boundary.label, labelPos: sceneJson.boundary.labelPos || 'top',
        color: 'gray400' }, ctx);
  }

  // アクター位置を計算する: position から座標を出す
  function actorPos(position) {
    const dist = 2.40;
    if (position === 'left')   return { cx: cx - dist, cy };
    if (position === 'right')  return { cx: cx + dist, cy };
    if (position === 'top')    return { cx, cy: cy - 1.95 };
    if (position === 'bottom') return { cx, cy: cy + 1.95 };
    return { cx: cx - dist, cy };
  }

  // アクター描画
  const actors = sceneJson.actors || [];
  const actorPositions = {};
  actors.forEach((act, i) => {
    const pos = actorPos(act.position);
    actorPositions[i] = pos;
    A.drawActor(slide, pos.cx, pos.cy,
      { label: act.label, sub: act.sub, color: act.color || 'gray500' }, ctx);
  });

  // 中央ブロック (アクターの上に被さらないよう最後に描く)
  const centerBlock = A.drawOrgBlock(slide,
    { x: cx - centerW/2, y: cy - centerH/2, w: centerW, h: centerH },
    {
      role: (sceneJson.center || {}).role || '',
      label: (sceneJson.center || {}).label || '',
      sub: (sceneJson.center || {}).sub,
      fill: 'canvas',
      stroke: 'brand',
      headerColor: 'brand',
    }, ctx);

  // フロー描画 (各アクター → 中央 / 中央 → アクター)
  // 中央ブロックの接続点を選ぶ: アクター位置に応じて top/bottom/left/right
  function centerAnchor(position) {
    if (position === 'left')   return centerBlock.left;
    if (position === 'right')  return centerBlock.right;
    if (position === 'top')    return centerBlock.top;
    if (position === 'bottom') return centerBlock.bottom;
    return centerBlock.left;
  }
  // アクター側の接続点 (中央寄り)
  function actorAnchor(actor, idx) {
    const pos = actorPositions[idx];
    const offset = 0.40;
    if (actor.position === 'left')   return { cx: pos.cx + offset, cy: pos.cy };
    if (actor.position === 'right')  return { cx: pos.cx - offset, cy: pos.cy };
    if (actor.position === 'top')    return { cx: pos.cx, cy: pos.cy + offset };
    if (actor.position === 'bottom') return { cx: pos.cx, cy: pos.cy - offset };
    return { cx: pos.cx + offset, cy: pos.cy };
  }

  actors.forEach((act, i) => {
    const flows = act.flows || [];
    const aAnchor = actorAnchor(act, i);
    const cAnchor = centerAnchor(act.position);

    // 複数フローがある時、開始/終了点を少しずつずらして並べる
    flows.forEach((flow, j) => {
      // 縦に並べる (Y 方向にずらす)
      const offset = (j - (flows.length - 1) / 2) * 0.28;
      const isHoriz = act.position === 'left' || act.position === 'right';
      const sx = aAnchor.cx;
      const sy = aAnchor.cy + (isHoriz ? offset : 0);
      const sx2 = cAnchor.cx;
      const sy2 = cAnchor.cy + (isHoriz ? offset : 0);
      const ex = aAnchor.cx + (isHoriz ? 0 : offset);
      const ey = aAnchor.cy;

      const from = flow.direction === 'in'  ? { cx: sx,  cy: sy } : { cx: sx2, cy: sy2 };
      const to   = flow.direction === 'in'  ? { cx: sx2, cy: sy2 } : { cx: sx,  cy: sy };

      if (flow.type === 'money') {
        A.drawMoneyFlow(slide, from, to,
          { amount: flow.label || '¥', color: 'accent' }, ctx);
      } else if (flow.type === 'data') {
        A.drawDataFlow(slide, from, to,
          { label: flow.label, color: 'gray500' }, ctx);
      } else {
        // service (default)
        A.drawServiceFlow(slide, from, to,
          { label: flow.label, color: 'brand' }, ctx);
      }
    });
  });
}

module.exports = { drawScene04BusinessModel };
