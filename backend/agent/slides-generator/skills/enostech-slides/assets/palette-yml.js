/**
 * palette-yml.js — palette.yml SSOT モジュール
 * ──────────────────────────────────────────────────────
 *
 * `decks/{slug}/palette.yml` を **唯一のカラー真実情報 (SSOT)** として
 * 読み書きするモジュール。
 *
 * 設計:
 *   - palette.yml が無ければ DESIGN.md / design.md から生成 (ensurePaletteYml)
 *   - palette.yml があれば読むだけ。design.md が後から更新されても palette.yml を信じる
 *   - 明示的に再生成したい時は呼び出し側で削除するか --regenerate フラグを使う
 *
 * 依存:
 *   - design-md-loader.js (DESIGN.md → tokens 抽出 + HSL 自動補完)
 *   - 標準 fs / path のみ。js-yaml 等の外部 YAML ライブラリは使わず、
 *     palette.yml のシンプルなスキーマに合わせた最小パーサで対応する
 *
 * palette.yml スキーマ (フラットな 3 セクション):
 *
 *   meta:
 *     name: "Zenn Blue"
 *     generated_at: "2026-04-29T18:00:00Z"
 *     generated_from: "DESIGN.md"          # "default" | "DESIGN.md" | "manual"
 *     source_path: "/path/to/DESIGN.md"
 *   colors:
 *     brand: "3EA8FF"
 *     accent: "2481CC"
 *     highlight: "EC131E"
 *     ink: "2E2E2E"
 *     canvas: "FFFFFF"
 *     ...
 *   typography:
 *     fontFace: "Hiragino Kaku Gothic ProN"
 *     body: 16
 *
 * すべての colors の値は **6 文字 16 進** (PptxGenJS 形式、# 無し)。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const designLoader = require('./design-md-loader');

/* =========================================================
   YAML 入出力 (最小実装)
   ──────────────────────────────────────────────────
   このモジュールが扱う palette.yml は構造が一定なので、外部依存を増やさず
   フラット 2 階層 (section: + 各キー) だけサポート。値はクオート有無両対応。
   ======================================================== */

/**
 * 簡易 YAML パーサ。section: -> { key: value } の 2 階層フラット構造のみ対応。
 *
 * @param {string} text
 * @returns {object} { meta?, colors?, typography? }
 */
function parseYaml(text) {
  const result = {};
  if (typeof text !== 'string') return result;

  let currentSection = null;
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    // 空行
    if (line.trim() === '') continue;
    // フルコメント行
    if (/^\s*#/.test(line)) continue;

    // section ヘッダー (左端、コロン終わり、値なし)
    const sectionMatch = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(?:#.*)?$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      result[currentSection] = result[currentSection] || {};
      continue;
    }

    // key-value (インデント有り、コロン区切り、値あり)
    const kvMatch = line.match(/^\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+?)\s*(?:#.*)?$/);
    if (kvMatch && currentSection) {
      const key = kvMatch[1];
      let val = kvMatch[2].trim();
      // クオート剥がし (これがあれば明示的に文字列扱い)
      const wasQuoted = /^["']/.test(val);
      val = val.replace(/^["']|["']$/g, '');

      // 数値判定: クオート無し、かつ colors セクション以外でのみ Number 化。
      // colors の値は HEX (例: 737373) が数字オンリーになり得るので、
      // セクション名で判定して Number 化を抑制する。
      const isColorsSection = (currentSection === 'colors');
      if (!wasQuoted && !isColorsSection && /^-?\d+(\.\d+)?$/.test(val)) {
        result[currentSection][key] = Number(val);
      } else {
        result[currentSection][key] = val;
      }
      continue;
    }
  }

  return result;
}

/**
 * palette dict から YAML 文字列を生成。
 * 出力順は meta → colors → typography で固定 (人間に読みやすく)。
 *
 * @param {{ meta?: object, colors?: object, typography?: object }} palette
 * @returns {string}
 */
function dumpYaml(palette) {
  const lines = [];
  lines.push('# decks/{slug}/palette.yml — SSOT for this deck');
  lines.push('# このファイルが pptx と plan.html の両方の色情報元です。');
  lines.push('# 編集して再ビルドすれば即反映されます。');
  lines.push('# DESIGN.md を再解釈したい時は palette.yml を削除して再ビルドしてください。');
  lines.push('');

  const order = ['meta', 'colors', 'typography'];
  for (const section of order) {
    const obj = palette[section];
    if (!obj || typeof obj !== 'object') continue;
    lines.push(`${section}:`);
    for (const [k, v] of Object.entries(obj)) {
      // colors セクションは常にクオートで囲む (数字オンリー HEX が Number にされるのを防ぐ)。
      // 数字オンリー HEX (例: 737373) を裸で書くと再 parse 時に Number 化される。
      const formatted = (section === 'colors' && typeof v === 'string')
        ? `"${v}"`
        : _formatValue(v);
      lines.push(`  ${k}: ${formatted}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function _formatValue(v) {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return JSON.stringify(v);
  // 半角英数 + ハイフンだけならクオート不要、それ以外は "" で囲む
  if (/^[A-Za-z0-9_\-./:+]+$/.test(v)) return v;
  return `"${v.replace(/"/g, '\\"')}"`;
}

/* =========================================================
   palette.yml 解決パイプライン
   ======================================================== */

/**
 * default パレット (themes.js の default テーマと一致させる)。
 * design.md が無いケースでも 3 色構造を持たせるため、ハードコード。
 */
const DEFAULT_PALETTE = Object.freeze({
  meta: {
    name: 'ENOSTECH Default',
    generated_from: 'default',
  },
  colors: {
    brand:             'F59E0B',  // Amber 500 — 主役
    brandSoft:         'FEF3C7',  // Amber 100
    brandDeep:         'B45309',  // Amber 700
    brandContrast:     'FFFFFF',
    accent:            'B45309',  // Amber 700 / Burnt — 並列対比
    accentSoft:        'FDE68A',  // Amber 200
    accentDeep:        '7C2D12',  // Orange 900
    accentContrast:    'FFFFFF',
    highlight:         '1F2937',  // Slate 800 — 黒側スパイス
    highlightSoft:     'E5E7EB',
    highlightDeep:     '111827',
    highlightContrast: 'FFFFFF',
    ink:               '1F2937',
    canvas:            'FAFAF7',
    gray700:           '404040',
    gray500:           '737373',
    gray200:           'E5E5E5',
  },
  typography: {
    fontFace: 'Noto Sans JP',
  },
});

/**
 * DESIGN.md を起点に palette オブジェクトを組み立てる (HSL 自動補完済み)。
 *
 * @param {string} designPath  DESIGN.md / design.md の絶対パス
 * @returns {object}  palette dict
 */
function buildPaletteFromDesignMd(designPath) {
  const parsed = designLoader.loadDesignMd(designPath);
  const colors = parsed.colors || {};
  const typography = parsed.typography || {};

  // colors を default で穴埋め (DESIGN.md に書かれてないキーは default を継承)
  const fullColors = { ...DEFAULT_PALETTE.colors, ...colors };

  return {
    meta: {
      name: parsed.meta && parsed.meta.name ? parsed.meta.name : path.basename(designPath),
      generated_from: 'DESIGN.md',
      source_path: designPath,
      format: parsed.meta && parsed.meta.format ? parsed.meta.format : 'unknown',
    },
    colors: fullColors,
    typography: {
      fontFace: typography.fontFace || DEFAULT_PALETTE.typography.fontFace,
      ...(typography.body ? { body: typography.body } : {}),
      ...(typography.titleL ? { titleL: typography.titleL } : {}),
    },
  };
}

/**
 * default パレットを返す (deep copy)。
 */
function buildDefaultPalette() {
  return JSON.parse(JSON.stringify(DEFAULT_PALETTE));
}

/**
 * decks/{slug}/palette.yml を確実に存在させて返す。
 *
 * 動作:
 *   1. paletteYmlPath が存在 → 読んでそのまま返す (SSOT は palette.yml)
 *   2. 存在しない → 以下の優先順で生成:
 *      a. opts.designPath が指定されていればそれをパース
 *      b. plan.json の親方向に DESIGN.md / design.md を探して見つかればそれ
 *      c. どちらもなければ default パレット
 *      生成した palette を YAML として書き出して返す
 *
 * @param {string} paletteYmlPath  decks/{slug}/palette.yml の絶対パス
 * @param {object} opts
 * @param {string} [opts.designPath]  明示的な DESIGN.md パス
 * @param {string} [opts.startDir]    DESIGN.md 自動検出の起点 (なければ paletteYmlPath の親)
 * @param {boolean} [opts.regenerate] true なら既存 palette.yml を破棄して再生成
 * @param {boolean} [opts.verbose]
 * @returns {{ palette: object, paletteYmlPath: string, generated: boolean }}
 */
function ensurePaletteYml(paletteYmlPath, opts = {}) {
  // 1. 既存があり、--regenerate でなければ読むだけ
  if (!opts.regenerate && fs.existsSync(paletteYmlPath)) {
    const text = fs.readFileSync(paletteYmlPath, 'utf8');
    const palette = parseYaml(text);
    if (opts.verbose) {
      console.log(`[palette] loaded existing palette.yml: ${paletteYmlPath}`);
    }
    return { palette, paletteYmlPath, generated: false };
  }

  // 2. 生成パス: 明示 designPath > 自動検出 > default
  let palette;
  let designPath = opts.designPath;
  if (!designPath) {
    designPath = _autoDetectDesignMd(opts.startDir || path.dirname(paletteYmlPath), opts.verbose);
  }
  if (designPath && fs.existsSync(designPath)) {
    palette = buildPaletteFromDesignMd(designPath);
    if (opts.verbose) {
      console.log(`[palette] generated from DESIGN.md: ${designPath}`);
    }
  } else {
    palette = buildDefaultPalette();
    if (opts.verbose) {
      console.log(`[palette] generated from default (no DESIGN.md found)`);
    }
  }

  // 生成日時を記録
  palette.meta = palette.meta || {};
  palette.meta.generated_at = new Date().toISOString();

  // 書き出し (decks/{slug}/ がまだ無いケースは想定しない — build-deck.js 側で先に作成済み)
  const yaml = dumpYaml(palette);
  try {
    fs.mkdirSync(path.dirname(paletteYmlPath), { recursive: true });
    fs.writeFileSync(paletteYmlPath, yaml, 'utf8');
    if (opts.verbose) {
      console.log(`[palette] wrote palette.yml: ${paletteYmlPath}`);
    }
  } catch (e) {
    console.warn(`[palette] failed to write palette.yml at ${paletteYmlPath}: ${e.message}`);
  }

  return { palette, paletteYmlPath, generated: true };
}

/**
 * plan.json から起点ディレクトリ → 親方向に DESIGN.md / design.md を探す。
 */
function _autoDetectDesignMd(startDir, verbose) {
  const CANDIDATES = ['DESIGN.md', 'design.md'];
  const STOP_MARKERS = ['package.json', '.git'];
  let dir = startDir;
  let depth = 0;
  const maxDepth = 8;

  while (depth < maxDepth) {
    for (const fn of CANDIDATES) {
      const candidate = path.join(dir, fn);
      if (fs.existsSync(candidate)) {
        if (verbose) console.log(`[palette] auto-detected design file: ${candidate}`);
        return candidate;
      }
    }
    let isRoot = false;
    for (const m of STOP_MARKERS) {
      if (fs.existsSync(path.join(dir, m))) {
        isRoot = true;
        break;
      }
    }
    if (isRoot) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    depth++;
  }
  return null;
}

/**
 * palette オブジェクトを T.useDesignTokens に渡せる shape に変換 (互換用)。
 */
function paletteToOverrides(palette) {
  return {
    meta: palette.meta || {},
    colors: palette.colors || {},
    typography: palette.typography || {},
    warnings: [],
  };
}

module.exports = {
  parseYaml,
  dumpYaml,
  ensurePaletteYml,
  buildPaletteFromDesignMd,
  buildDefaultPalette,
  paletteToOverrides,
  DEFAULT_PALETTE,
  _internal: {
    _autoDetectDesignMd,
    _formatValue,
  },
};
