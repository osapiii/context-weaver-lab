/**
 * svg-render.js — enostech-slides の SVG → PNG 変換ヘルパー
 * =====================================================================
 *
 * 日本語フォント環境差で壊れていた問題を根本解決するための共通レイヤー。
 *
 * 旧経路:
 *   build-deck.js → enostech-svg-diagram/scripts/convert/svg-to-png.js
 *     → resvg-js (loadSystemFonts: true, defaultFontFamily: 'Noto Sans JP')
 *
 *   問題: 環境依存 (Linux sandbox に Noto Sans JP が無い等) で
 *         loadSystemFonts が頼りにならず、Latin と日本語が混在する <text>
 *         で日本語側の glyph が脱落する事故が散発。
 *
 *   1. assets/fonts/ に Noto Sans JP Regular/Bold (OFL 1.1) を同梱
 *   2. resvg-js の `font.fontFiles` で常にこの 2 つを明示ロード
 *   3. SVG 側の `font-family="'Noto Sans JP', sans-serif"` のような
 *      コンマ区切り fallback リストを単一値に正規化してから渡す
 *      (resvg-js は値そのものを文字列マッチに使うため、コンマ区切りが
 *       defaultFontFamily との直接一致を妨げる)
 *   4. これらすべてを 1 関数 renderSvgToPng() に集約し、build-deck.js も
 *      enostech-svg-diagram の svg-to-png.js (CLI) も同じ実装を使う
 *
 * このファイルが SVG レンダリング経路の "single source of truth"。
 * フォントの環境差で困ったらまずここを読むこと。
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 同梱フォントの絶対パス (skills/enostech-slides/assets/fonts/)
const FONT_DIR = path.resolve(__dirname, '..', '..', '..', 'assets', 'fonts');
const BUNDLED_FONTS = [
  path.join(FONT_DIR, 'NotoSansJP-Regular.ttf'),
  path.join(FONT_DIR, 'NotoSansJP-Bold.ttf'),
];

// resvg に渡す唯一の font-family。ブランド標準であり、SchemaQA の R-SVG-7 とも整合。
const SAFE_FONT_FAMILY = 'Noto Sans JP';

// resvg は generic family (sans-serif, serif, monospace 等) も解決対象として扱う。
// 全部 Noto Sans JP に揃えれば「fallback 側に飛んだら日本語が消える」事故が起きない。
const GENERIC_FAMILY_DEFAULTS = {
  serifFamily: SAFE_FONT_FAMILY,
  sansSerifFamily: SAFE_FONT_FAMILY,
  cursiveFamily: SAFE_FONT_FAMILY,
  fantasyFamily: SAFE_FONT_FAMILY,
  monospaceFamily: SAFE_FONT_FAMILY,
};

// ────────────────────────────────────────────────────────
// SVG プリプロセッサ
// ────────────────────────────────────────────────────────

/**
 * SVG 内の `font-family="..."` を resvg-js が安全に処理できる単一値に正規化する。
 *
 * 例:
 *   font-family="'Noto Sans JP', sans-serif"           → font-family="Noto Sans JP"
 *   font-family="'JetBrains Mono', monospace"          → font-family="Noto Sans JP"
 *   font-family="Arial, Helvetica, sans-serif"         → font-family="Noto Sans JP"
 *   font-family="serif"                                → font-family="Noto Sans JP"
 *   font-family="Noto Sans JP"                         → font-family="Noto Sans JP" (no change)
 *
 * 設計判断:
 *   英数字専用のセリフ・等幅などは諦める (ブランドガイドにも記載なし)。
 *
 * 副作用:
 *   - `<text font-family="...">` 属性、`<svg font-family="...">` 属性、
 *     style 属性内の `font-family: ...;` の 3 形式すべてに対応。
 *   - 既に SAFE_FONT_FAMILY 単一値ならスキップ (羃等)。
 *
 * @param {string} svgString
 * @returns {{svg: string, replacements: number}}
 */
function normalizeSvgFontFamily(svgString) {
  if (typeof svgString !== 'string' || svgString.length === 0) {
    return { svg: svgString, replacements: 0 };
  }
  let count = 0;

  // 1) font-family="..." 属性 (シングル/ダブルクォート両対応、コンマ区切りを含む値)
  let out = svgString.replace(/font-family\s*=\s*"([^"]*)"/g, (m, val) => {
    if (val.trim() === SAFE_FONT_FAMILY) return m;
    count += 1;
    return `font-family="${SAFE_FONT_FAMILY}"`;
  });
  out = out.replace(/font-family\s*=\s*'([^']*)'/g, (m, val) => {
    if (val.trim() === SAFE_FONT_FAMILY) return m;
    count += 1;
    return `font-family='${SAFE_FONT_FAMILY}'`;
  });

  // 2) style="...font-family: ...;..." (style 属性内の font-family)
  out = out.replace(/style\s*=\s*"([^"]*)"/g, (m, styleVal) => {
    if (!/font-family\s*:/i.test(styleVal)) return m;
    const next = styleVal.replace(/font-family\s*:\s*[^;"]*/gi, () => {
      count += 1;
      return `font-family: ${SAFE_FONT_FAMILY}`;
    });
    return `style="${next}"`;
  });
  out = out.replace(/style\s*=\s*'([^']*)'/g, (m, styleVal) => {
    if (!/font-family\s*:/i.test(styleVal)) return m;
    const next = styleVal.replace(/font-family\s*:\s*[^;']*/gi, () => {
      count += 1;
      return `font-family: ${SAFE_FONT_FAMILY}`;
    });
    return `style='${next}'`;
  });

  return { svg: out, replacements: count };
}

// ────────────────────────────────────────────────────────
// resvg オプションのファクトリ
// ────────────────────────────────────────────────────────

/**
 * 同梱フォントの存在確認 + 利用可能パスの抽出。
 *
 * v9.40 (2026-05-11) で「ファイルは存在するがサイズ 0 バイト (= packing 漏れ /
 * Drive 同期未完了の placeholder)」を検出して除外するように強化。
 *
 * 背景:
 *   2026-05-11 の osanai 氏のセッションで、Cowork 配信版の
 *   assets/fonts/NotoSansJP-*.ttf がいずれも 0 バイトになっていた
 *   (pack-skill.py の --max-files 200 制約か binary フィルタが原因と推測)。
 *   resvg-js は 0 バイトファイルを fontFiles に渡されると黙ってロードを失敗し、
 *   その結果 SVG の <text> 要素を一切描画しない (shape は描画する) という
 *   「左の amber 帯と中央の罫線だけが残る空白スライド」事故を起こしていた。
 *
 * 設計判断:
 *   - 0 バイトファイルは存在しないものとして扱う (found に入れない)
 *   - 0 バイトを検出した事実は console.warn で fail loud する
 *     (静かに fallback すると「空白スライド」が完成するまで気付けない)
 *   - 全部 0 バイトなら resvg は loadSystemFonts: true で system に頼ることになるが、
 *     その時にも警告が必ず出るので、調査の起点になる
 *
 * @returns {string[]} 実体のある (= サイズ > 0 の) フォントファイル絶対パス配列
 */
function resolveBundledFontFiles() {
  const found = [];
  for (const p of BUNDLED_FONTS) {
    try {
      if (!fs.existsSync(p)) continue;
      const st = fs.statSync(p);
      if (st.size === 0) {
        // packing 漏れ or Drive 同期未完了。SVG レンダリングが必ず壊れるので大声で警告。
        console.warn(
          `[svg-render] ⚠ font file is 0 bytes (placeholder): ${p}\n` +
          `             → SECSUMMARY-1 / SVG の <text> が消失する可能性が高い。\n` +
          `             → skill packaging で binary が脱落していないか確認してください\n` +
          `               (assets/fonts/*.ttf は実 TTF でないと resvg-js が文字を描画しません)`
        );
        continue;
      }
      found.push(p);
    } catch { /* ignore */ }
  }
  return found;
}

/**
 * resvg-js の Resvg コンストラクタに渡すオプションを組み立てる。
 *
 * @param {object} opts
 *   - width:    出力 PNG の長辺 px (default 2400)
 *   - background: 背景色 (default null)
 *   - fontFiles:  追加で読みたいフォントファイルパスの配列 (任意)
 */
function buildResvgOptions(opts = {}) {
  const width = opts.width || 2400;
  const fontFiles = resolveBundledFontFiles();
  if (Array.isArray(opts.fontFiles)) {
    for (const p of opts.fontFiles) {
      if (typeof p === 'string' && fs.existsSync(p) && !fontFiles.includes(p)) {
        fontFiles.push(p);
      }
    }
  }

  const resvgOpts = {
    fitTo: { mode: 'width', value: width },
    font: {
      // 同梱フォントが見つかれば loadSystemFonts は不要 (環境差排除のため false)。
      // 同梱フォントが無い (= dev 環境で assets/fonts/ を消した等) なら、
      // 最後の頼みの綱として system fallback も読ませる。
      loadSystemFonts: fontFiles.length === 0,
      fontFiles,
      defaultFontFamily: SAFE_FONT_FAMILY,
      ...GENERIC_FAMILY_DEFAULTS,
    },
  };
  if (opts.background) resvgOpts.background = opts.background;
  return resvgOpts;
}

// ────────────────────────────────────────────────────────
// メイン: SVG 文字列 → PNG Buffer
// ────────────────────────────────────────────────────────

/**
 * SVG 文字列を PNG Buffer に変換する。
 *
 * 経路:
 *   1) SVG 文字列の font-family を SAFE_FONT_FAMILY に正規化
 *   2) 同梱 Noto Sans JP を fontFiles に渡して resvg-js で render
 *   3) 失敗時は呼び出し元で sharp / ImageMagick にフォールバックさせる
 *      (このヘルパー自体は単一経路に集中)
 *
 * @param {string} svgString
 * @param {object} opts (width / background / fontFiles)
 * @returns {Promise<Buffer>}
 */
async function renderSvgToPng(svgString, opts = {}) {
  const { Resvg } = require('@resvg/resvg-js');
  const { svg: normalized, replacements } = normalizeSvgFontFamily(svgString);
  if (replacements > 0 && process.env.ENO_SVG_DEBUG) {
    console.warn(`[svg-render] normalized ${replacements} font-family declarations to "${SAFE_FONT_FAMILY}"`);
  }
  const resvgOpts = buildResvgOptions(opts);
  const resvg = new Resvg(normalized, resvgOpts);
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

// ────────────────────────────────────────────────────────
// 公開 API
// ────────────────────────────────────────────────────────

module.exports = {
  SAFE_FONT_FAMILY,
  BUNDLED_FONTS,
  resolveBundledFontFiles,
  normalizeSvgFontFamily,
  buildResvgOptions,
  renderSvgToPng,
};
