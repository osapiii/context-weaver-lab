/**
 * add-svg-diagram.js — pptx スライドに SVG ダイアグラムを埋め込む
 *
 * enostech-slides (build-deck.js) から呼ばれる薄いラッパ。
 * SVG 文字列 → svgToPng で Buffer 化 → addImage で埋め込み、までを 1 関数にまとめる。
 *
 * 使い方:
 *   const { addSvgDiagram } = require('enostech-svg-diagram/scripts/render/add-svg-diagram');
 *   await addSvgDiagram(slide, svgString, { x: 0.5, y: 1.6, w: 9, h: 4.8 });
 */

'use strict';

const path = require('path');
const { svgToPng } = require('../convert/svg-to-png');

/**
 * SVG 文字列をスライドに画像として埋め込む
 *
 * @param {object} slide  pptxgenjs の slide オブジェクト
 * @param {string} svgString  SVG 文字列
 * @param {object} opts
 *   - x, y, w, h: 配置 (inch 単位、pptxgenjs と同じ)
 *   - sizing:     'contain' | 'cover' | 'crop' (default 'contain')
 *   - hyperlink:  リンク (任意)
 * @returns {Promise<void>}
 */
async function addSvgDiagram(slide, svgString, opts = {}) {
  // 1. SVG を PNG に変換 (内部経路: resvg-js → sharp フォールバック)
  //    PNG 解像度は w (inch) × 300dpi をベースに、最低 1200px を保証
  const targetWidthPx = Math.max(1200, Math.round((opts.w || 9) * 300));
  const png = await svgToPng(svgString, { width: targetWidthPx });

  // 2. base64 エンコードして data URL 化
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;

  // 3. addImage で埋め込み
  slide.addImage({
    data: dataUrl,
    x: opts.x != null ? opts.x : 0.5,
    y: opts.y != null ? opts.y : 1.6,
    w: opts.w != null ? opts.w : 9,
    h: opts.h != null ? opts.h : 4.8,
    sizing: opts.sizing ? { type: opts.sizing, w: opts.w, h: opts.h } : undefined,
    hyperlink: opts.hyperlink || undefined,
  });
}

/**
 * SVG ファイルパスを受け取って同様に埋め込み
 */
async function addSvgDiagramFromFile(slide, svgFilePath, opts = {}) {
  const fs = require('fs');
  const svg = fs.readFileSync(svgFilePath, 'utf-8');
  return addSvgDiagram(slide, svg, opts);
}

module.exports = { addSvgDiagram, addSvgDiagramFromFile };
