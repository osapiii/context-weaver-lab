#!/usr/bin/env node
/**
 * svg-to-png.js — SVG 文字列 / SVG ファイルを PNG に変換する
 *
 * 変換経路 (上から優先順):
 *   1. @resvg/resvg-js  (Pure Rust、高速・依存少)
 *   2. sharp            (libvips、画像処理ライブラリ)
 *   3. ImageMagick      (CLI fallback、convert / magick コマンド)
 *
 * 使い方:
 *   node svg-to-png.js -i input.svg -o output.png [--dpi 300] [--width 2400]
 *   echo '<svg ...>' | node svg-to-png.js -o output.png
 *
 * プログラムから:
 *   const { svgToPng } = require('./svg-to-png');
 *   const buf = await svgToPng(svgString, { width: 2400 });
 *   // buf は Buffer (PNG)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

/**
 * SVG → PNG (Buffer) に変換
 *
 * @param {string} svgString  SVG 文字列
 * @param {object} opts
 *   - width:  出力 PNG の長辺 px (default 2400 ≒ 300dpi @ 8inch)
 *   - dpi:    指定すれば width より優先 (内部的に viewBox から幅算出)
 *   - background: 背景色 (default null = SVG 側の塗りに任せる)
 * @returns {Promise<Buffer>}
 */
async function svgToPng(svgString, opts = {}) {
  const width = opts.width || 2400;
  const background = opts.background || null;
  const errors = [];

  // v1.6 (2026-05-03): enostech-slides v9.3 連携。
  //   1) 同居プロジェクトに enostech-slides/scripts/render/lib/svg-render.js があれば
  //      それを優先的に使う (Noto Sans JP 同梱フォントを確実にロード + SVG 正規化)。
  //   2) 単体運用 (enostech-slides 不在) の場合は素の resvg-js 経路にフォールバック。
  let unifiedRenderer = null;
  try {
    const candidates = [
      path.resolve(__dirname, '..', '..', '..', 'enostech-slides', 'scripts', 'render', 'lib', 'svg-render.js'),
      path.resolve(__dirname, '..', '..', '..', '..', 'enostech-slides', 'scripts', 'render', 'lib', 'svg-render.js'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        unifiedRenderer = require(p);
        break;
      }
    }
  } catch { /* ignore */ }
  if (unifiedRenderer && typeof unifiedRenderer.renderSvgToPng === 'function') {
    try {
      return await unifiedRenderer.renderSvgToPng(svgString, { width, background });
    } catch (e) {
      errors.push(`enostech-slides/svg-render: ${e.message}`);
    }
  }

  // 1次: @resvg/resvg-js (素経路 / 単体運用時のフォールバック)
  try {
    const { Resvg } = require('@resvg/resvg-js');
    const resvgOpts = {
      fitTo: { mode: 'width', value: width },
      font: {
        loadSystemFonts: true,
        defaultFontFamily: 'Noto Sans JP',
        sansSerifFamily: 'Noto Sans JP',
        serifFamily: 'Noto Sans JP',
        monospaceFamily: 'Noto Sans JP',
      },
    };
    if (background) resvgOpts.background = background;
    const resvg = new Resvg(svgString, resvgOpts);
    const pngData = resvg.render();
    return Buffer.from(pngData.asPng());
  } catch (e) {
    errors.push(`resvg-js: ${e.message}`);
  }

  // 2次: sharp フォールバック
  try {
    const sharp = require('sharp');
    let pipeline = sharp(Buffer.from(svgString), { density: opts.dpi || 300 });
    if (background) {
      pipeline = pipeline.flatten({ background });
    }
    return await pipeline.resize({ width, withoutEnlargement: false }).png().toBuffer();
  } catch (e) {
    errors.push(`sharp: ${e.message}`);
  }

  // 3次: ImageMagick CLI フォールバック
  try {
    return convertWithImageMagick(svgString, { width, background, dpi: opts.dpi || 200 });
  } catch (e) {
    errors.push(`imagemagick: ${e.message}`);
  }

  throw new Error(
    `SVG → PNG 変換失敗。利用可能な変換経路がありません。\n` +
    errors.map(s => '  - ' + s).join('\n') + '\n' +
    `→ npm install @resvg/resvg-js  または  npm install sharp  または  apt install imagemagick`
  );
}

/**
 * ImageMagick (convert / magick) で SVG → PNG 変換
 */
function convertWithImageMagick(svgString, opts) {
  // tmp ファイル経由で convert に渡す (stdin の SVG 受け付けが古い ImageMagick だと不安定)
  const tmpIn = path.join(os.tmpdir(), `svg-to-png-${process.pid}-${Date.now()}.svg`);
  const tmpOut = path.join(os.tmpdir(), `svg-to-png-${process.pid}-${Date.now()}.png`);
  fs.writeFileSync(tmpIn, svgString);

  try {
    // magick (IMv7) を優先、なければ convert (IMv6) を試す
    const cmds = [
      ['magick', ['-density', String(opts.dpi), tmpIn, '-resize', `${opts.width}x`, tmpOut]],
      ['convert', ['-density', String(opts.dpi), tmpIn, '-resize', `${opts.width}x`, tmpOut]],
    ];
    let lastError = null;
    for (const [cmd, args] of cmds) {
      const res = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      if (res.error) { lastError = res.error; continue; }
      if (res.status === 0) {
        return fs.readFileSync(tmpOut);
      }
      lastError = new Error(`${cmd} exit=${res.status}: ${res.stderr.toString()}`);
    }
    throw lastError || new Error('ImageMagick が利用できません');
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

/**
 * SVG ファイル → PNG ファイル
 */
async function svgFileToPngFile(inputPath, outputPath, opts = {}) {
  const svg = fs.readFileSync(inputPath, 'utf-8');
  const png = await svgToPng(svg, opts);
  fs.writeFileSync(outputPath, png);
  return outputPath;
}

// ─────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let inputPath = null;
  let outputPath = null;
  let width = 2400;
  let dpi = null;
  let background = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-i' || args[i] === '--input') inputPath = args[++i];
    else if (args[i] === '-o' || args[i] === '--output') outputPath = args[++i];
    else if (args[i] === '--width') width = parseInt(args[++i], 10);
    else if (args[i] === '--dpi') dpi = parseInt(args[++i], 10);
    else if (args[i] === '--background') background = args[++i];
    else if (args[i] === '-h' || args[i] === '--help') {
      console.log('Usage: node svg-to-png.js -i input.svg -o output.png [--width 2400] [--dpi 300] [--background "#FAFAF7"]');
      console.log('       echo "<svg ...>" | node svg-to-png.js -o output.png');
      process.exit(0);
    }
  }

  if (!outputPath) {
    console.error('Error: -o <output.png> is required');
    process.exit(1);
  }

  let svg;
  if (inputPath) {
    svg = fs.readFileSync(inputPath, 'utf-8');
  } else {
    svg = fs.readFileSync(0, 'utf-8');
  }

  const opts = { width };
  if (dpi) opts.dpi = dpi;
  if (background) opts.background = background;

  const png = await svgToPng(svg, opts);
  fs.writeFileSync(outputPath, png);
  console.log(`OK: ${outputPath} (${png.length} bytes, width=${width}px)`);
}

if (require.main === module) {
  main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}

module.exports = { svgToPng, svgFileToPngFile };
