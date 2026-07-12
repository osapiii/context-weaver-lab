/**
 * SCENE-05 システム構成図
 * ========================
 * 横一列に並んだ 3-5 ノード (例: ブラウザ → API → DB) と、それらを
 * リクエスト/レスポンス流れで結ぶ典型的なシステムアーキテクチャ。
 *
 * 各ノードに「種別」を指定するだけで該当する atom (drawServer / drawDatabase /
 * drawBrowser / drawCloud / ...) を描く。アクター/インフラの違いは kind で吸収。
 *
 * sceneJson:
 *   {
 *     boundary?: { label, labelPos? },
 *     nodes: [
 *       {
 *         kind: 'browser'|'pc'|'mobile'|'server'|'api'|'database'|'cloud'|
 *               'network'|'folder'|'container'|'switch'|'user',
 *         label, sub?,
 *         emphasis?: true   // 強調 (accent color)
 *       }
 *     ],
 *     flows: [
 *       {
 *         from: 0, to: 1,         // nodes[] の index
 *         type: 'request'|'response'|'data'|'sync',
 *         label?: string
 *       }
 *     ]
 *   }
 */
'use strict';
const A = require('../atoms-shape');

// kind → atom 関数のマッピング
const KIND_DRAW = {
  browser:   A.drawBrowser,
  pc:        A.drawPC,
  mobile:    A.drawMobile,
  server:    A.drawServer,
  api:       A.drawAPI,
  database:  A.drawDatabase,
  cloud:     A.drawCloud,
  network:   A.drawNetwork,
  folder:    A.drawFolder,
  container: A.drawContainer,
  switch:    A.drawSwitch,
  user:      A.drawUserSystem,
};

function drawScene05SystemArch(slide, sceneJson, area, ctx) {
  const nodes = sceneJson.nodes || [];
  const flows = sceneJson.flows || [];
  const n = nodes.length;
  if (n === 0) return;

  // 境界 (任意、全体を囲う)
  if (sceneJson.boundary) {
    A.drawBoundary(slide,
      { x: area.x + 0.10, y: area.y + 0.20, w: area.w - 0.20, h: area.h - 0.40 },
      {
        label: sceneJson.boundary.label,
        labelPos: sceneJson.boundary.labelPos || 'top',
        color: 'gray400',
      }, ctx);
  }

  // ノードを横一列に等間隔で並べる
  const totalGap = (n - 1) * 0.55;  // 各ノード間 0.55" (ラベル余白を確保)
  const nodeW = (area.w * 0.92 - totalGap) / n;
  const nodeH = Math.min(area.h * 0.65, 1.50);
  const nodeY = area.y + (area.h - nodeH) / 2;
  const startX = area.x + (area.w - nodeW * n - totalGap) / 2;

  // ノード描画 + anchor 保存
  const anchors = [];
  nodes.forEach((node, i) => {
    const x = startX + i * (nodeW + 0.35);
    const drawFn = KIND_DRAW[node.kind];
    if (!drawFn) {
      // 未知 kind のフォールバック: drawNode
      const a = A.drawNode(slide,
        { x, y: nodeY, w: nodeW, h: nodeH },
        {
          shape: 'round',
          fill: 'canvas', stroke: 'gray400',
          label: node.label || '?', sub: node.sub,
        }, ctx);
      anchors.push(a);
      return;
    }
    const a = drawFn(slide,
      { x, y: nodeY, w: nodeW, h: nodeH },
      {
        label: node.label || '',
        sub: node.sub,
        accentColor: node.emphasis ? 'accent' : 'brand',
      }, ctx);
    anchors.push(a);
  });

  // フロー描画 (横一列なので left/right の anchor を使う)
  flows.forEach(flow => {
    const fromAnchor = anchors[flow.from];
    const toAnchor   = anchors[flow.to];
    if (!fromAnchor || !toAnchor) return;

    // 順方向なら from.right → to.left、逆方向なら from.left → to.right
    const forward = flow.from < flow.to;
    const fromPoint = forward ? fromAnchor.right : fromAnchor.left;
    const toPoint   = forward ? toAnchor.left   : toAnchor.right;

    // 複数フローが同じペアにあるなら少しずらす (request → 上、response → 下)
    // ノード本体に重ならないよう十分にオフセット
    let yOffset = 0;
    if (flow.type === 'response') yOffset = 0.40;
    else if (flow.type === 'request') yOffset = -0.40;

    const from = { cx: fromPoint.cx, cy: fromPoint.cy + yOffset };
    const to   = { cx: toPoint.cx,   cy: toPoint.cy   + yOffset };

    if (flow.type === 'request') {
      A.drawServiceFlow(slide, from, to,
        { label: flow.label, color: 'brand', width: 1.5 }, ctx);
    } else if (flow.type === 'response') {
      A.drawServiceFlow(slide, from, to,
        { label: flow.label, color: 'gray500', width: 1.2 }, ctx);
    } else if (flow.type === 'data') {
      A.drawDataFlow(slide, from, to,
        { label: flow.label }, ctx);
    } else if (flow.type === 'sync') {
      A.drawArrow(slide, from, to,
        { color: 'accent', width: 1.5 }, ctx);
      if (flow.label) {
        const mx = (from.cx + to.cx) / 2;
        const my = (from.cy + to.cy) / 2;
        slide.addText(flow.label, {
          x: mx - 0.80, y: my - 0.13, w: 1.60, h: 0.26,
          fontSize: 9, color: ctx.C.accent, fontFace: ctx.F.jp,
          bold: true, align: 'center', valign: 'middle', margin: 0,
        });
      }
    } else {
      A.drawServiceFlow(slide, from, to,
        { label: flow.label }, ctx);
    }
  });
}

module.exports = { drawScene05SystemArch };
