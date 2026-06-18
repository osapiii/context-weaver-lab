/**
 * DIAG-02 サイクル図 (Category I: DIAGRAM)
 * ========================================
 * 4 段階の反復プロセス・継続改善・PDCA 型の表現。
 *
 * 領域引数 area = {x, y, w, h} で配置場所を受け取る。
 * 1 枚丸ごとなら area = full bleed (0.4, 1.65, 9.2, 3.5)、
 * テンプレ内に埋め込む時はコンテンツエリアを渡される。
 *
 * 期待 diagramJson 構造:
 *   {
 *     center_label: "分析の\n改善サイクル",   // optional
 *     nodes: [
 *       { pos: 'tl', label: '計画', sub: 'Plan',  body: '本文', color: 'purple' },
 *       { pos: 'tr', label: '実行', sub: 'Do',    body: '本文', color: 'accent' },
 *       { pos: 'br', label: '評価', sub: 'Check', body: '本文', color: 'purple' },
 *       { pos: 'bl', label: '改善', sub: 'Act',   body: '本文', color: 'accent' },
 *     ]
 *   }
 *
 * color はトークン名 ('purple' | 'accent' | 'brand' 等)。直接 hex は使わない。
 */

'use strict';

function drawDIAG02Cycle(slide, diagramJson, area, ctx) {
  const { C, F, pres } = ctx;

  const nodes = Array.isArray(diagramJson.nodes) ? diagramJson.nodes : [];
  if (nodes.length !== 4) {
    console.warn('[DIAG-02] nodes must have exactly 4 items, got', nodes.length);
    return;
  }

  const totalH = area.h - 0.05;
  const cy = area.y + totalH / 2;
  const cx = area.x + area.w / 2;
  const r = Math.min(1.28, totalH * 0.36);
  const nodeSize = 1.10;

  const positions = {
    tl: { x: cx - r - nodeSize / 2, y: cy - r - nodeSize / 2 },
    tr: { x: cx + r - nodeSize / 2, y: cy - r - nodeSize / 2 },
    br: { x: cx + r - nodeSize / 2, y: cy + r - nodeSize / 2 },
    bl: { x: cx - r - nodeSize / 2, y: cy + r - nodeSize / 2 },
  };

  // 接続線（矢印）— 時計回り
  slide.addShape(pres.shapes.LINE, {
    x: positions.tl.x + nodeSize, y: cy - r,
    w: positions.tr.x - (positions.tl.x + nodeSize), h: 0,
    line: { color: C.gray300, width: 2, endArrowType: 'triangle' },
  });
  slide.addShape(pres.shapes.LINE, {
    x: cx + r, y: positions.tr.y + nodeSize,
    w: 0, h: positions.br.y - (positions.tr.y + nodeSize),
    line: { color: C.gray300, width: 2, endArrowType: 'triangle' },
  });
  slide.addShape(pres.shapes.LINE, {
    x: positions.br.x, y: cy + r,
    w: -(positions.br.x - (positions.bl.x + nodeSize)), h: 0,
    line: { color: C.gray300, width: 2, beginArrowType: 'triangle' },
  });
  slide.addShape(pres.shapes.LINE, {
    x: cx - r, y: positions.bl.y,
    w: 0, h: -(positions.bl.y - (positions.tl.y + nodeSize)),
    line: { color: C.gray300, width: 2, beginArrowType: 'triangle' },
  });

  // 中央ラベル
  if (diagramJson.center_label) {
    slide.addShape(pres.shapes.OVAL, {
      x: cx - 0.52, y: cy - 0.32, w: 1.04, h: 0.64,
      fill: { color: C.ink }, line: { type: 'none' },
    });
    slide.addText(diagramJson.center_label, {
      x: cx - 0.52, y: cy - 0.32, w: 1.04, h: 0.64,
      fontSize: 8.5, color: C.white, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }

  // 4 ノード描画
  nodes.forEach((n) => {
    const p = positions[n.pos];
    if (!p) {
      console.warn('[DIAG-02] unknown pos:', n.pos);
      return;
    }
    const nodeColor = _resolveColor(C, n.color || 'purple');

    slide.addShape(pres.shapes.OVAL, {
      x: p.x, y: p.y, w: nodeSize, h: nodeSize,
      fill: { color: nodeColor }, line: { type: 'none' },
    });
    slide.addText(n.label || '', {
      x: p.x, y: p.y + 0.22, w: nodeSize, h: 0.38,
      fontSize: 16, color: C.white, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
    if (n.sub) {
      slide.addText(n.sub, {
        x: p.x, y: p.y + 0.62, w: nodeSize, h: 0.22,
        fontSize: 8.5, color: C.white, fontFace: F.jp,
        charSpacing: 2, align: 'center', valign: 'middle', margin: 0,
      });
    }

    // 説明テキスト: 上ノードは下、下ノードは上に配置
    if (n.body) {
      const descH = 0.44;
      const descY = n.pos.startsWith('t')
        ? Math.min(p.y + nodeSize + 0.08, area.y + area.h - descH)
        : Math.max(p.y - descH - 0.08, area.y);
      slide.addText(n.body, {
        x: p.x - 0.45, y: descY, w: nodeSize + 0.90, h: descH,
        fontSize: 10, color: C.gray700, fontFace: F.jp,
        align: 'center', margin: 0, valign: 'top',
      });
    }
  });
}

/**
 * トークン名 → 実色解決。"purple" / "accent" / "brand" / "gray700" など。
 * 不明な値は purple にフォールバック + 警告。
 */
function _resolveColor(C, name) {
  if (typeof name !== 'string') return C.brand;
  // C は Proxy なので `in` ではなく直接アクセスして undefined チェック
  const v = C[name];
  if (v !== undefined && v !== null && v !== '') return v;
  console.warn(`[DIAG-02] unknown color token "${name}", fallback to purple`);
  return C.brand;
}

module.exports = { drawDIAG02Cycle };
