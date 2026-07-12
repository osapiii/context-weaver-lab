/**
 * SCENE-03 ステージ遷移
 * ======================
 * 3-5 段の横フロー。各段が状態を示すカード、段の間に矢印。
 * よくある例:
 *   - 初期検証 → 実装 → ベータ → 本番
 *   - データ収集 → 整形 → 学習 → 推論
 *
 * sceneJson:
 *   {
 *     stages: [
 *       { label, sub?, emphasis?: true|false }   // 3-5 段
 *     ]
 *   }
 */
'use strict';
const A = require('../atoms-shape');

function drawScene03StageFlow(slide, sceneJson, area, ctx) {
  const stages = Array.isArray(sceneJson.stages) ? sceneJson.stages : [];
  const n = stages.length;
  if (n === 0) return;

  // カード高 + 矢印 (45% を矢印帯に充てる)
  const cardH = Math.min(area.h * 0.55, 1.20);
  const cy = area.y + area.h / 2;
  const cardY = cy - cardH / 2;

  // 各カードの幅: n 個 + (n-1) 矢印帯
  const arrowGap = 0.45;
  const totalArrowW = arrowGap * (n - 1);
  const cardW = (area.w - totalArrowW) / n;

  // カード描画
  // 強調 (emphasis) カードだけ accentSoft の薄塗りを残す。
  const cards = [];
  stages.forEach((st, i) => {
    const x = area.x + i * (cardW + arrowGap);
    A.drawNode(slide,
      { x, y: cardY, w: cardW, h: cardH },
      {
        shape: 'round',
        fill: st.emphasis ? 'accentSoft' : 'canvas',
        stroke: st.emphasis ? 'accent' : 'gray300',
        strokeWidth: 1,
        textColor: st.emphasis ? 'accentDeep' : 'ink',
        subColor: 'gray500',
        label: st.label || '',
        sub: st.sub,
        labelSize: 12,
        radius: 0.10,
      }, ctx);
    cards.push({ x, y: cardY, w: cardW, h: cardH });
  });

  // カード間の矢印
  for (let i = 0; i < n - 1; i++) {
    const fromCard = cards[i];
    const toCard = cards[i + 1];
    const ax1 = fromCard.x + fromCard.w + 0.02;
    const ax2 = toCard.x - 0.02;
    A.drawArrow(slide,
      { cx: ax1, cy },
      { cx: ax2, cy },
      { color: 'brand', width: 1.5 }, ctx);
  }
}

module.exports = { drawScene03StageFlow };
