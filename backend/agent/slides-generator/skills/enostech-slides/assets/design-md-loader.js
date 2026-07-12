/**
 * design-md-loader.js — 外部 design.md パーサ
 * ──────────────────────────────────────────────────
 * 外部から渡された Markdown 形式の design.md を読み込んで、
 * tokens の上書き用 dict (colors / typography) に変換する。
 *
 * 2 つのフォーマットをサポート:
 *
 * (A) 構造化トークン形式 — 厳密スキーマ:
 *
 *     # Design Tokens
 *     ## Meta
 *     - name: Tailwind Slate × Amber
 *     ## Colors
 *     - brand:     "#475569"
 *     - accent:    "#F59E0B"
 *     ## Typography
 *     - fontFace:  "Inter, sans-serif"
 *     - body:      11
 *
 * (B) 自然文型 9 セクション仕様書 — AI Agent 向け Design Spec:
 *
 *     実サイトの computed style から起こした 9 セクション構成。
 *     "Color Palette & Roles" / "Typography Rules" 等のセクション内に、
 *     `**ラベル名** (`#xxx`): 説明` / 表 / コードブロックが混ざる人読み形式。
 *
 *     例:
 *       ## 2. Color Palette & Roles
 *       ### Primary
 *       - **Zenn Blue** (`#3ea8ff`): メインのブランドカラー。
 *       ### Neutral
 *       - **Text Primary** (`rgba(0,0,0,0.82)`): 本文テキスト。
 *
 *       ## 3. Typography Rules
 *       ### 3.3 font-family 指定
 *       ```css
 *       font-family: -apple-system, "Hiragino Kaku Gothic ProN", sans-serif;
 *       ```
 *       ### 3.4 文字サイズ・ウェイト階層
 *       | Body | system | 16px | 400 | ...
 *
 * パース戦略:
 * 1. parseDesignMd() — まず (A) 厳密形式で読む
 * 2. (A) で colors/typography が両方空 → (B) ヒューリスティック抽出にフォールバック
 * 3. (B) で取れた分だけ overrides に積む。落ちた項目は warnings に記録
 * 4. meta.format に 'structured' / 'natural-9section' / 'unknown' を立てる
 *
 * (B) の役割マッピング (ラベル → tokens.js のロール):
 *   brand:      Primary / ブランド / brand / Brand Color
 *   brandSoft:  Surface / 薄色 / Light / カード背景
 *   brandDeep:  Primary Dark / ホバー / プレス / Deep / Dark
 *   accent:     Accent / アクセント
 *   accentSoft: Accent Light / Warning Bg
 *   ink:        Text Primary / 本文 / Heading
 *   gray700:    Text Secondary / 補足 / Sub
 *   gray500:    Text Tertiary / Disabled / 注釈
 *   gray300:    Border / 区切り
 *   gray200:    Border Light / 薄ボーダー
 *   canvas:     Background / 背景 / Page Background
 *
 * 上書き対象（tokens.js が許容するもの）:
 *   colors:     brand / brandSoft / brandDeep / brandContrast
 *               accent / accentSoft / accentDeep / accentContrast / accentHi
 *               ink / inkSoft / gray50 / gray100 / gray200 / gray300
 *               gray400 / gray500 / gray700 / canvas / white
 *   typography: fontFace, titleXL, titleL, lead, h2, h3,
 *               body, bodySm, caption, numLarge, numMed
 *   meta:       name / baseTheme / source / format
 *
 * 上書き対象外:
 *   diagramPalette, layout 寸法, semantic 色, FRAMING-3 Twilight Forge カラー
 */

const fs = require('fs');
const path = require('path');

// 上書き許容リスト
// highlight 系 (true accent / スパイス色) を追加
const ALLOWED_COLOR_KEYS = new Set([
  'brand', 'brandSoft', 'brandDeep', 'brandContrast',
  'accent', 'accentSoft', 'accentDeep', 'accentContrast', 'accentHi',
  'highlight', 'highlightSoft', 'highlightDeep', 'highlightContrast',
  'ink', 'inkSoft',
  'gray50', 'gray100', 'gray200', 'gray300', 'gray400', 'gray500', 'gray700',
  'canvas', 'white',
]);

/**
 * design.md の外向きキー名 → 内部 token キー名のエイリアスマップ。
 * 受け付けるようにした。内部実装は brand / accent / highlight。
 *
 * 注意: design.md で `accent:` と書かれた場合は **そのまま内部 accent = secondary**
 * として扱う (既存 Tailwind 系 design.md との互換のため)。osanai さんの言う
 * 「真のスパイス accent」は design.md では `highlight:` で指定する。
 */
const KEY_ALIASES = {
  primary: 'brand',
  primarySoft: 'brandSoft',
  primaryDeep: 'brandDeep',
  primaryContrast: 'brandContrast',
  secondary: 'accent',
  secondarySoft: 'accentSoft',
  secondaryDeep: 'accentDeep',
  secondaryContrast: 'accentContrast',
};

const ALLOWED_TYPOGRAPHY_KEYS = new Set([
  'fontFace',
  'titleXL', 'titleL', 'lead', 'h2', 'h3',
  'body', 'bodySm', 'caption', 'numLarge', 'numMed',
]);

const ALLOWED_META_KEYS = new Set([
  'name', 'baseTheme', 'source', 'format',
]);

const SIZE_KEYS = new Set([
  'titleXL', 'titleL', 'lead', 'h2', 'h3',
  'body', 'bodySm', 'caption', 'numLarge', 'numMed',
]);

/**
 * "#475569" → "475569"   (PptxGenJS 形式に正規化)
 * rgba()/rgb() も受け付けて HEX に変換する (alpha は捨てる)
 * 不正なら null を返す
 */
function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  let v = value.trim().replace(/^["'`]|["'`]$/g, '');

  // rgba(0,0,0,0.82) / rgb(255,128,0) のサポート
  // alpha が 1 未満なら、白背景合成で近似 HEX を作る (PowerPoint には透過がないため)
  const rgbMatch = v.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i);
  if (rgbMatch) {
    let r = parseInt(rgbMatch[1], 10);
    let g = parseInt(rgbMatch[2], 10);
    let b = parseInt(rgbMatch[3], 10);
    const a = rgbMatch[4] != null ? parseFloat(rgbMatch[4]) : 1.0;
    if ([r, g, b].every(n => n >= 0 && n <= 255) && a >= 0 && a <= 1) {
      // 白背景 (255,255,255) との alpha 合成で近似 HEX を作る
      // result = src*a + bg*(1-a)
      if (a < 1) {
        r = Math.round(r * a + 255 * (1 - a));
        g = Math.round(g * a + 255 * (1 - a));
        b = Math.round(b * a + 255 * (1 - a));
      }
      return [r, g, b].map(n => n.toString(16).padStart(2, '0').toUpperCase()).join('');
    }
    return null;
  }

  if (v.startsWith('#')) v = v.slice(1);
  if (/^[0-9A-Fa-f]{3}$/.test(v)) {
    v = v.split('').map(c => c + c).join('');
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(v)) return null;
  return v.toUpperCase();
}

/* =========================================================
   HSL ユーティリティ
   ────────────────────────────────────────────────
   design.md で primary だけ指定されて secondary / highlight が
   足りない時に、primary から派生色を生成するため。色相回転と
   明度シフトで「同色相だがトーン違い」または「補色」を作る。
   ======================================================== */

/** "1F2937" → [r, g, b] (0-255) */
function hexToRgb(hex) {
  const v = hex.replace(/^#/, '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

/** [r, g, b] (0-255) → "1F2937" */
function rgbToHex(r, g, b) {
  return [r, g, b].map(n => {
    const x = Math.round(Math.max(0, Math.min(255, n)));
    return x.toString(16).padStart(2, '0').toUpperCase();
  }).join('');
}

/** [r, g, b] (0-255) → [h, s, l] (h: 0-360, s/l: 0-1) */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return [h, s, l];
}

/** [h, s, l] → [r, g, b] */
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hh = h / 360;
  return [
    Math.round(hue2rgb(p, q, hh + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hh) * 255),
    Math.round(hue2rgb(p, q, hh - 1 / 3) * 255),
  ];
}

/**
 * primary HEX から secondary 色を派生させる。
 * 戦略: 同色相のままで明度を 1 段階シフト (L: ±0.15) し、彩度を少し落とす。
 * primary が暗ければ少し明るく、明るければ少し暗くする。
 * → 「主役と並んでも喧嘩しない、同系統だがトーン違いの並列対比色」を作る。
 *
 * @param {string} primaryHex  6文字 HEX (大文字)
 * @returns {string} secondary HEX
 */
function deriveSecondary(primaryHex) {
  const [r, g, b] = hexToRgb(primaryHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  // primary が明るい → secondary は少し暗く (-0.15)
  // primary が暗い → secondary は少し明るく (+0.18)
  const newL = l > 0.55 ? Math.max(0.20, l - 0.15) : Math.min(0.85, l + 0.18);
  // 彩度を 0.7 倍にして、対比を喧嘩させない
  const newS = s * 0.7;
  const [nr, ng, nb] = hslToRgb(h, newS, newL);
  return rgbToHex(nr, ng, nb);
}

/**
 * primary HEX から highlight (スパイス) 色を派生させる。
 * 戦略: 色相を補色寄りに大きく回転 (+150deg、ただし時計回り) させて、
 * 彩度をやや上げ、明度は中庸 (0.5±) に揃える。少面積前提で目立つ色。
 * primary が彩度ゼロ (グレー / 黒) の場合は固定の Amber (#F59E0B) を返す。
 *
 * @param {string} primaryHex  6文字 HEX
 * @returns {string} highlight HEX
 */
function deriveHighlight(primaryHex) {
  const [r, g, b] = hexToRgb(primaryHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  // 彩度ゼロ近辺 (グレー系) は色相に意味がないので、Amber を返す
  if (s < 0.08) return 'F59E0B';
  // 補色寄りに 150deg 回転 (反対色だと喧嘩しすぎるので少しずらす)
  const newH = (h + 150) % 360;
  // 彩度を上げる (スパイスらしさ)
  const newS = Math.min(0.85, Math.max(0.55, s + 0.15));
  // 明度は読みやすい中庸 (0.50±)
  const newL = 0.50;
  const [nr, ng, nb] = hslToRgb(newH, newS, newL);
  return rgbToHex(nr, ng, nb);
}

/**
 * HEX → 同色相の soft 版 (より明るい / 彩度低め)
 */
function deriveSoft(baseHex) {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb(h, s * 0.4, Math.min(0.95, Math.max(0.85, l + 0.30)));
  return rgbToHex(nr, ng, nb);
}

/**
 * HEX → 同色相の deep 版 (より暗い / 彩度ほぼ維持)
 */
function deriveDeep(baseHex) {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb(h, Math.min(0.9, s + 0.05), Math.max(0.15, l - 0.15));
  return rgbToHex(nr, ng, nb);
}

/**
 * CSS フォントスタックから PowerPoint 用の単一フォント名を 1 つ抽出する。
 *
 * PowerPoint / LibreOffice の OOXML スキーマでは、`<rPr>` の `typeface` 属性に
 * 単一フォント名しか入れられない。CSS の `font-family: A, B, sans-serif`
 * のような複数フォント候補を文字列のままセットすると、フォント解決に失敗して
 * 本文テキストが描画されない (空白スライド) ことがあるので、先頭から
 * 「実体のある」フォント名を 1 つ拾って返す。
 *
 * 戦略:
 *   1. カンマで split
 *   2. 各候補から両端クオートを剥がす
 *   3. システム予約名 (-apple-system, system-ui, BlinkMacSystemFont 等) と
 *      generic family (sans-serif/serif/monospace) はスキップ
 *   4. 残った最初の候補を採用
 *   5. 全部スキップ済みなら null を返す（呼び出し側でデフォルトに任せる）
 *
 * @param {string} stack  "Inter, Noto Sans JP, sans-serif" のような文字列
 * @returns {string|null} 抽出された単一フォント名 / 該当無し時 null
 */
function pickSingleFontFromStack(stack) {
  if (typeof stack !== 'string') return null;

  // カンマ区切り。ただしクオート内のカンマは split しないようにしたいが、
  // CSS font-family に「クオート内カンマ」を含むケースは事実上ないので素直に split。
  const candidates = stack.split(',').map(s => s.trim()).filter(Boolean);

  // システム予約名 / generic family はスキップ
  const RESERVED = new Set([
    '-apple-system', 'apple-system',
    'system-ui', 'systemui',
    'blinkmacsystemfont',
    'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-fallback',
    'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
    'segoe ui',  // Windows のシステム UI フォント — PowerPoint 上では指定しない方が無難
  ]);

  for (const raw of candidates) {
    // クオート剥がし
    const v = raw.replace(/^["'`]+|["'`]+$/g, '').trim();
    if (!v) continue;
    const lower = v.toLowerCase();
    if (RESERVED.has(lower)) continue;
    return v;
  }
  return null;
}

/**
 * クオート剥がし + 行末コメント削除
 */
function stripValue(raw) {
  if (typeof raw !== 'string') return raw;
  let v = raw.trim();
  const inQuoteMatch = v.match(/^(["'])(.*?)\1\s*(?:#.*)?$/);
  if (inQuoteMatch) return inQuoteMatch[2];
  const hashIdx = v.indexOf('#');
  if (hashIdx > 0) {
    v = v.slice(0, hashIdx).trim();
  }
  return v;
}

/* =========================================================
   (A) 構造化トークン形式パーサ — v6.18 互換
   ======================================================== */

function parseStructured(md) {
  const result = {
    meta: {},
    colors: {},
    typography: {},
    warnings: [],
  };

  if (typeof md !== 'string') {
    result.warnings.push('design.md content is not a string');
    return result;
  }

  const lines = md.split(/\r?\n/);
  let currentSection = null;

  const SECTION_MAP = {
    'meta':       'meta',
    'colors':     'colors',
    'color':      'colors',
    'typography': 'typography',
    'fonts':      'typography',
    'font':       'typography',
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');

    const headMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headMatch) {
      const head = headMatch[1].trim().toLowerCase();
      currentSection = SECTION_MAP[head] || null;
      continue;
    }

    if (/^#\s/.test(line) || /^#$/.test(line)) {
      currentSection = null;
      continue;
    }

    const itemMatch = line.match(/^\s*[-*+]\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/);
    if (!itemMatch || !currentSection) continue;

    const key = itemMatch[1];
    const rawVal = itemMatch[2];
    const val = stripValue(rawVal);

    if (currentSection === 'meta') {
      if (ALLOWED_META_KEYS.has(key)) {
        result.meta[key] = val;
      } else {
        result.warnings.push(`[meta] unknown key '${key}' — skipped`);
      }
      continue;
    }

    if (currentSection === 'colors') {
      // primary/secondary を内部キーに正規化
      const resolvedKey = KEY_ALIASES[key] || key;
      if (!ALLOWED_COLOR_KEYS.has(resolvedKey)) {
        result.warnings.push(`[colors] unknown key '${key}' — skipped (not in tokens role-color list)`);
        continue;
      }
      const hex = normalizeHex(val);
      if (!hex) {
        result.warnings.push(`[colors] '${key}' has invalid hex '${val}' — skipped`);
        continue;
      }
      result.colors[resolvedKey] = hex;
      if (resolvedKey !== key) {
        result.warnings.push(`[colors] '${key}' → mapped to internal key '${resolvedKey}'`);
      }
      continue;
    }

    if (currentSection === 'typography') {
      if (!ALLOWED_TYPOGRAPHY_KEYS.has(key)) {
        result.warnings.push(`[typography] unknown key '${key}' — skipped`);
        continue;
      }
      if (key === 'fontFace') {
        if (!val || val.length === 0) {
          result.warnings.push(`[typography] fontFace empty — skipped`);
          continue;
        }
        // CSS フォントスタックなら単一フォント名に正規化
        const single = pickSingleFontFromStack(val);
        if (single) {
          result.typography.fontFace = single;
          if (single !== val) {
            result.warnings.push(`[typography] fontFace normalized: '${val}' → '${single}'`);
          }
        } else {
          result.warnings.push(`[typography] fontFace '${val}' contains only reserved/generic names — skipped`);
        }
        continue;
      }
      if (SIZE_KEYS.has(key)) {
        const num = Number(val);
        if (!Number.isFinite(num) || num <= 0 || num > 200) {
          result.warnings.push(`[typography] '${key}' has invalid size '${val}' — skipped`);
          continue;
        }
        result.typography[key] = num;
        continue;
      }
    }
  }

  return result;
}

/* =========================================================
   (B) 自然文型 9 セクション仕様書ヒューリスティック抽出 — v6.57 新規
   ======================================================== */

/**
 * ラベル文字列 → ロール名のマッピング。
 * 文字列を小文字化して include() で判定。優先度は配列の先頭が高い。
 */
const ROLE_RULES = [
  // === highlight 系 ===
  // highlight が先頭 (brand より先に highlight キーワードを拾うため)
  { role: 'highlightDeep', patterns: ['highlight dark', 'highlight deep', 'spice deep'] },
  { role: 'highlightSoft', patterns: ['highlight light', 'highlight soft'] },
  { role: 'highlight',     patterns: ['highlight', 'spice', 'cta highlight', 'スパイス'] },

  // === brand 系 ===
  // brandDeep が先 (Primary Dark を Primary より先に拾うため)
  { role: 'brandDeep',  patterns: ['primary dark', 'brand dark', 'brand deep', 'プライマリーダーク', 'ブランドダーク'] },
  { role: 'brand',      patterns: ['primary', 'brand color', 'ブランドカラー', 'ブランド色', 'メインカラー', 'main color'] },

  // === accent 系 ===
  { role: 'accentSoft', patterns: ['accent soft', 'accent light', 'warning bg', 'accent bg'] },
  { role: 'accentDeep', patterns: ['accent dark', 'accent deep'] },
  { role: 'accent',     patterns: ['accent', 'アクセント', 'highlight'] },

  // === text / ink ===
  { role: 'inkSoft',     patterns: ['text heading', 'heading color', '見出しテキスト', '見出し色'] },
  { role: 'ink',         patterns: ['text primary', 'body text', '本文テキスト', '本文色', 'primary text', 'main text'] },
  { role: 'gray700',     patterns: ['text secondary', '補足テキスト', 'sub text', 'subtle text'] },
  { role: 'gray500',     patterns: ['text tertiary', 'text disabled', 'caption', '注釈', '無効'] },

  // === border / surface / canvas ===
  { role: 'gray300',     patterns: ['border strong', 'border dark', '強調ボーダー'] },
  { role: 'gray200',     patterns: ['border', 'ボーダー', '区切り', 'divider'] },
  { role: 'brandSoft',   patterns: ['surface', 'card background', 'section background', 'カード背景', 'セクション背景', 'background secondary'] },
  { role: 'canvas',      patterns: ['background', '背景', 'page background', 'ページ背景'] },
];

/**
 * 文字列内の最初の HEX (#RRGGBB / #RGB / rgba(...)) を返す。
 */
function findFirstColor(s) {
  if (typeof s !== 'string') return null;

  // バッククオート優先
  const back = s.match(/`([^`]+)`/);
  if (back) {
    const candidate = back[1];
    const hex = normalizeHex(candidate);
    if (hex) return hex;
  }

  // 直接 #RRGGBB
  const hexMatch = s.match(/#([0-9A-Fa-f]{3,8})/);
  if (hexMatch) {
    const v = hexMatch[1];
    if (v.length === 3 || v.length === 6) {
      const hex = normalizeHex('#' + v);
      if (hex) return hex;
    }
  }

  // rgba()/rgb()
  const rgb = s.match(/rgba?\s*\([^)]+\)/);
  if (rgb) {
    const hex = normalizeHex(rgb[0]);
    if (hex) return hex;
  }

  return null;
}

/**
 * 一行から「ラベル名」を抽出する。
 * 想定パターン:
 *   - **Zenn Blue** (`#3ea8ff`): メインのブランドカラー
 *   - 食べログオレンジ (`#f09000`): ブランドカラー
 *   - Primary Dark (`#0f83fd`): ホバー時
 */
function extractLabel(line) {
  if (typeof line !== 'string') return '';
  // bold ラベル
  const bold = line.match(/\*\*([^*]+)\*\*/);
  if (bold) return bold[1].trim();

  // 「- ラベル名 (`#xxx`)」 風
  const m = line.match(/^\s*[-*+]\s+([^(`]+?)\s*[(`]/);
  if (m) return m[1].trim();

  // 「- ラベル名: ...」風
  const m2 = line.match(/^\s*[-*+]\s+([^:]+?)\s*:/);
  if (m2) return m2[1].trim();

  return '';
}

/**
 * ラベル + 説明テキストから tokens のロール名を判定。
 * マッチしなければ null。
 */
function inferRole(label, descriptionText) {
  const haystack = ((label || '') + ' ' + (descriptionText || '')).toLowerCase();
  for (const { role, patterns } of ROLE_RULES) {
    for (const p of patterns) {
      if (haystack.includes(p)) return role;
    }
  }
  return null;
}

/**
 * セクション見出し ##/### の中身を取り出して、現在の「上位セクション名」を判定。
 * 9 セクション形式は:
 *   ## 1. Visual Theme & Atmosphere
 *   ## 2. Color Palette & Roles
 *   ## 3. Typography Rules
 *   ## 4. Component Stylings
 *   ## 5. Layout Principles
 *   ## 6. Depth & Elevation
 *   ## 7. Do's and Don'ts
 *   ## 8. Responsive Behavior
 *   ## 9. Agent Prompt Guide
 */
function classifyHeading(headingText) {
  const t = headingText.toLowerCase();
  if (t.includes('color palette') || t.includes('カラー') || t.includes('色')) return 'colors';
  if (t.includes('typography') || t.includes('タイポ') || t.includes('font') || t.includes('書体')) return 'typography';
  if (t.includes('agent prompt guide') || t.includes('クイックリファレンス') || t.includes('quick reference')) return 'agent_prompt';
  if (t.includes('visual theme') || t.includes('atmosphere') || t.includes('テーマ') || t.includes('雰囲気')) return 'visual';
  return null;
}

/**
 * ## の見出しが 9 セクション形式 (Color Palette & Roles 等) を含むか判定して、
 * フォーマット種別を返す。
 */
function detectFormat(md) {
  if (typeof md !== 'string') return 'unknown';
  // (A) — `# Design Tokens` のヘッダがあるか
  if (/^#\s+Design Tokens\b/im.test(md) && /^##\s+(Colors?|Typography)\b/im.test(md)) {
    return 'structured';
  }
  // (B) — 9 セクション形式の特徴
  const has9Section = /^##\s+\d?\.?\s*(Color Palette|Typography Rules|Visual Theme|Agent Prompt Guide)/im.test(md);
  const hasAgentGuide = /^##\s+\d?\.?\s*Agent Prompt Guide/im.test(md);
  if (has9Section || hasAgentGuide) return 'natural-9section';
  return 'unknown';
}

/**
 * (B) 自然文型 9 セクション仕様書からヒューリスティックに抽出
 */
function parseNatural9Section(md) {
  const result = {
    meta: { format: 'natural-9section' },
    colors: {},
    typography: {},
    warnings: [],
  };

  if (typeof md !== 'string') {
    result.warnings.push('design.md content is not a string');
    return result;
  }

  const lines = md.split(/\r?\n/);

  // ─── meta.name 推定: 先頭の "# DESIGN.md — Zenn" のようなヘッダから
  for (const line of lines.slice(0, 10)) {
    const m = line.match(/^#\s+(?:DESIGN\.md\s*[—\-]\s*|Design Spec\s*[—\-]\s*)(.+?)\s*$/i);
    if (m) {
      result.meta.name = m[1].trim();
      break;
    }
  }

  // ─── 色抽出: ## Color Palette & Roles 配下の "- **ラベル** (`#xxx`): 説明" 行 ───
  let inColors = false;
  let inAgentGuide = false;
  let inTypography = false;
  let inCodeBlock = false;
  // 先勝ちだが、後続のロール一致が同一ロールに対して既に値があれば上書きしない
  const colorClaims = {}; // role -> { hex, lineNo }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\s+$/, '');

    // コードブロック検知
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2 && !inCodeBlock) {
      const cls = classifyHeading(h2[1]);
      inColors = cls === 'colors';
      inTypography = cls === 'typography';
      inAgentGuide = cls === 'agent_prompt';
      continue;
    }

    // ─── colors ───
    if (inColors && !inCodeBlock) {
      // - **ラベル** (`#xxx`): 説明
      // - ラベル (`#xxx`): 説明
      // - **ラベル** (`rgba(...)`): 説明
      if (/^\s*[-*+]\s+/.test(line)) {
        const hex = findFirstColor(line);
        if (!hex) continue;

        const label = extractLabel(line);
        if (!label) continue;

        // 説明テキスト: ":" 以降
        const colonIdx = line.indexOf(':');
        const desc = colonIdx >= 0 ? line.slice(colonIdx + 1) : '';

        const role = inferRole(label, desc);
        if (role && !colorClaims[role]) {
          colorClaims[role] = { hex, label, lineNo: i + 1 };
        } else if (!role) {
          result.warnings.push(`[colors:natural] '${label}' (${hex}) — no role match, skipped (line ${i + 1})`);
        }
      }
    }

    // ─── typography: font-family を CSS ブロック / 行から拾う ───
    if (inTypography) {
      // font-family: が出てきたら、セミコロンか } まで複数行マージして取る
      if (!result.typography.fontFace && /font-family\s*:/i.test(line)) {
        // line から `font-family:` 以降を切り出し、
        // ; や } が出るまで後続行を連結
        let buffer = line.replace(/^.*?font-family\s*:\s*/i, '');
        let j = i;
        while (!/[;}]/.test(buffer) && j < lines.length - 1) {
          j++;
          // コードブロック区切りに当たったら終了
          if (/^```/.test(lines[j])) break;
          buffer += ' ' + lines[j].trim();
        }
        // 末尾の ; / } を剥がす
        let value = buffer.replace(/[;}].*$/, '').trim();
        // 複数スペースを 1 つに
        value = value.replace(/\s+/g, ' ').trim();
        // 末尾の ", " を剥がす
        value = value.replace(/[,\s]+$/, '').trim();
        if (value) {
          // CSS フォントスタックを単一フォント名に正規化
          const single = pickSingleFontFromStack(value);
          if (single) {
            result.typography.fontFace = single;
            if (single !== value) {
              result.warnings.push(`[typography:natural] fontFace normalized: '${value}' → '${single}'`);
            }
          } else {
            result.warnings.push(`[typography:natural] fontFace '${value}' contains only reserved/generic names — skipped`);
          }
        }
      }
    }

    // Agent Prompt Guide のクイックリファレンス内の `Body Size: 16px` / `Line Height: 1.8` /
    // `Primary Color: #xxx` / `Font: ...` を拾う
    if (inAgentGuide) {
      // Primary Color
      if (!colorClaims.brand) {
        const m = line.match(/Primary\s*(?:Color)?\s*:\s*(.+?)(?:\s|$)/i);
        if (m) {
          const hex = findFirstColor(m[1]);
          if (hex) colorClaims.brand = { hex, label: 'Primary (agent-guide)', lineNo: i + 1 };
        }
      }
      // Background
      if (!colorClaims.canvas) {
        const m = line.match(/Background\s*:\s*(.+?)(?:\s|$)/i);
        if (m) {
          const hex = findFirstColor(m[1]);
          if (hex) colorClaims.canvas = { hex, label: 'Background (agent-guide)', lineNo: i + 1 };
        }
      }
      // Surface
      if (!colorClaims.brandSoft) {
        const m = line.match(/Surface\s*:\s*(.+?)(?:\s|$)/i);
        if (m) {
          const hex = findFirstColor(m[1]);
          if (hex) colorClaims.brandSoft = { hex, label: 'Surface (agent-guide)', lineNo: i + 1 };
        }
      }
      // Text Color
      if (!colorClaims.ink) {
        const m = line.match(/Text\s*Color\s*:\s*(.+?)(?:\s|$)/i);
        if (m) {
          const hex = findFirstColor(m[1]);
          if (hex) colorClaims.ink = { hex, label: 'Text Color (agent-guide)', lineNo: i + 1 };
        }
      }
      // Heading Color
      if (!colorClaims.inkSoft) {
        const m = line.match(/Heading\s*Color\s*:\s*(.+?)(?:\s|$)/i);
        if (m) {
          const hex = findFirstColor(m[1]);
          if (hex) colorClaims.inkSoft = { hex, label: 'Heading Color (agent-guide)', lineNo: i + 1 };
        }
      }
      // Border
      if (!colorClaims.gray200) {
        const m = line.match(/Border\s*:\s*(.+?)(?:\s|$)/i);
        if (m) {
          const hex = findFirstColor(m[1]);
          if (hex) colorClaims.gray200 = { hex, label: 'Border (agent-guide)', lineNo: i + 1 };
        }
      }
      // Font:
      if (!result.typography.fontFace) {
        const m = line.match(/^Font\s*:\s*(.+?)\s*$/i);
        if (m) {
          const raw = m[1].trim();
          const single = pickSingleFontFromStack(raw);
          if (single) result.typography.fontFace = single;
        }
      }
      // Body Size: 16px
      if (!result.typography.body) {
        const m = line.match(/Body\s*Size\s*:\s*(\d+)\s*px/i);
        if (m) {
          const num = Number(m[1]);
          if (Number.isFinite(num) && num > 0 && num <= 200) {
            result.typography.body = num;
          }
        }
      }
    }
  }

  // colorClaims を colors に flush
  for (const [role, claim] of Object.entries(colorClaims)) {
    if (ALLOWED_COLOR_KEYS.has(role)) {
      result.colors[role] = claim.hex;
    }
  }

  // brand が取れていて brandSoft / brandDeep が取れていない場合は warnings 補足
  if (!result.colors.brand) {
    result.warnings.push("[colors:natural] 'brand' role not detected — heuristic could not match a Primary color");
  }

  return result;
}

/* =========================================================
   公開 API
   ======================================================== */

/**
 * Markdown 文字列をパースしてセクション dict にする。
 * (A) 構造化 → 結果が空なら (B) 自然文型へフォールバック。
 *
 * 返り値:
 *   {
 *     meta:       { name?, baseTheme?, source?, format? },
 *     colors:     { brand?, accent?, ... },
 *     typography: { fontFace?, titleXL?, ... },
 *     warnings:   [string, ...],
 *   }
 */
function parseDesignMd(md) {
  const fmt = detectFormat(md);

  let r;
  if (fmt === 'structured') {
    r = parseStructured(md);
    if (!r.meta.format) r.meta.format = 'structured';
  } else if (fmt === 'natural-9section') {
    r = parseNatural9Section(md);
    if (!r.meta.format) r.meta.format = 'natural-9section';
  } else {
    // 不明形式: 構造化として試して取れなければ自然文型にフォールバック
    r = parseStructured(md);
    if (Object.keys(r.colors).length === 0 && Object.keys(r.typography).length === 0) {
      const fb = parseNatural9Section(md);
      if (Object.keys(fb.colors).length > 0 || Object.keys(fb.typography).length > 0) {
        fb.meta.format = 'natural-9section-fallback';
        fb.warnings.unshift('[detect] format unclear — used natural-9section heuristic as fallback');
        r = fb;
      } else {
        r.warnings.unshift('[detect] could not detect any tokens (neither structured nor natural-9section)');
      }
    }
  }

  // 3 色 (brand / accent / highlight) の自動補完
  autoFillTriadColors(r);
  return r;
}

/**
 *
 * design.md で brand しか指定されていない場合、accent と highlight を
 * HSL ベースのトーン変換で自動生成する。これにより:
 *   - Primary だけ書いてある design.md (Zenn / 食べログ等) でも自然に
 *     並列対比 + スパイスが効いた配色になる
 *   - design.md で 3 色全部明示すれば自動補完はスキップ
 *
 * soft / deep バリエーションも、明示が無ければ HSL 派生で埋める。
 *
 * @param {{ colors: object, warnings: string[] }} parsed  parseDesignMd の戻り値
 */
function autoFillTriadColors(parsed) {
  if (!parsed || !parsed.colors) return;
  const C = parsed.colors;

  // brand が無ければ自動補完不可。何もしない (warnings は既に出ている)
  if (!C.brand) return;

  // brand の派生 (soft/deep が無ければ作る)
  if (!C.brandSoft) {
    C.brandSoft = deriveSoft(C.brand);
    parsed.warnings.push(`[autofill] brandSoft derived from brand: ${C.brand} → ${C.brandSoft}`);
  }
  if (!C.brandDeep) {
    C.brandDeep = deriveDeep(C.brand);
    parsed.warnings.push(`[autofill] brandDeep derived from brand: ${C.brand} → ${C.brandDeep}`);
  }

  // accent (= secondary、並列対比) が無ければ brand から派生
  if (!C.accent) {
    C.accent = deriveSecondary(C.brand);
    parsed.warnings.push(`[autofill] accent (secondary) derived from brand: ${C.brand} → ${C.accent}`);
  }
  if (!C.accentSoft) {
    C.accentSoft = deriveSoft(C.accent);
  }
  if (!C.accentDeep) {
    C.accentDeep = deriveDeep(C.accent);
  }

  // highlight (= true accent、スパイス) が無ければ brand から補色寄りに派生
  if (!C.highlight) {
    C.highlight = deriveHighlight(C.brand);
    parsed.warnings.push(`[autofill] highlight (spice) derived from brand: ${C.brand} → ${C.highlight}`);
  }
  if (!C.highlightSoft) {
    C.highlightSoft = deriveSoft(C.highlight);
  }
  if (!C.highlightDeep) {
    C.highlightDeep = deriveDeep(C.highlight);
  }
}

/**
 * design.md ファイルを読み込んでパース結果を返す
 *
 * @param {string} filePath  絶対 or 相対パス
 * @returns parseDesignMd() と同じ shape
 */
function loadDesignMd(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return {
      meta: {},
      colors: {},
      typography: {},
      warnings: [`design.md not found at '${resolved}'`],
    };
  }
  const md = fs.readFileSync(resolved, 'utf8');
  const parsed = parseDesignMd(md);
  parsed.meta._sourcePath = resolved;
  return parsed;
}

module.exports = {
  parseDesignMd,
  loadDesignMd,
  // for tests
  _internal: {
    normalizeHex,
    stripValue,
    pickSingleFontFromStack,
    detectFormat,
    parseStructured,
    parseNatural9Section,
    findFirstColor,
    extractLabel,
    inferRole,
    classifyHeading,
    autoFillTriadColors,
    deriveSecondary,
    deriveHighlight,
    deriveSoft,
    deriveDeep,
    hexToRgb,
    rgbToHex,
    rgbToHsl,
    hslToRgb,
    ALLOWED_COLOR_KEYS,
    ALLOWED_TYPOGRAPHY_KEYS,
    SIZE_KEYS,
    ROLE_RULES,
    KEY_ALIASES,
  },
};
