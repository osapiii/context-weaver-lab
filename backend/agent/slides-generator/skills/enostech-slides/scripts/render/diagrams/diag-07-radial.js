/**
 * =========================================================
 * 機能が完全重複していたため、DIAG-07 → SCENE-02 へのリダイレクト
 * (薄いラッパ) として残してある。新規デッキでは SCENE-02 を直接使う。
 *
 * 互換: 既存デッキで diagram_id: "DIAG-07" を使っているスライドは
 * そのままビルドできる (内部で SCENE-02 にマップされる)。
 *
 * SCENE-02 の方が機能が広い:
 *   - 各スポークに sub (説明 1 行) を付けられる
 *   - 強調したいスポークだけ accent 色にできる (emphasis: true)
 *
 * 入力スキーマ (DIAG-07 形式):
 *   {
 *     center: { label, body? },
 *     spokes: [{ label, body? }]   // 4-8 件
 *   }
 *
 * このラッパは body → sub にマップして SCENE-02 に委譲する。
 */

'use strict';

const { drawScene02HubSpoke } = require('../scenes/scene-02-hub-spoke');

function drawDIAG07Radial(slide, diagramJson, area, ctx) {
  // DIAG-07 形式 → SCENE-02 形式に変換
  // - DIAG-07 の `body` は SCENE-02 の `sub` (説明 1 行) に対応
  const sceneJson = {
    center: {
      label: (diagramJson.center && diagramJson.center.label) || '',
      sub:   (diagramJson.center && diagramJson.center.body)  || undefined,
    },
    spokes: (Array.isArray(diagramJson.spokes) ? diagramJson.spokes : []).map(sp => ({
      label: sp.label || '',
      sub:   sp.body  || undefined,
      // emphasis は DIAG-07 には無いキーなので未指定 (= 通常表示)
    })),
  };
  return drawScene02HubSpoke(slide, sceneJson, area, ctx);
}

module.exports = { drawDIAG07Radial };
