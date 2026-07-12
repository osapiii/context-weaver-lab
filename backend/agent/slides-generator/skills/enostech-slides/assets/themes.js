/**
 * ----------------------------------------
 *
 * 「ENOSTECH らしさ＝温度感のある琥珀」を default のスタート地点にする。
 *
 * v5.0 で導入した 3 色構造はそのまま:
 *
 *   brand     — 主役 (primary)。ヘッダー帯、強調語、メインの強い面
 *   accent    — 並列対比 (secondary)。Before/After の After 側、
 *               「もう一方の系列」を表す。primary と並んだ時に対比軸として機能
 *   highlight — スパイス (true accent)。少面積でハイライト。
 *               primary/secondary とは色相が違う方が効く。CTA の星マーク・
 *               カードの「featured」マーク等で使う
 *
 * default の 3 色は Amber を主役に組み直したパレット:
 *   brand     = #F59E0B (Amber 500)        — 主役。エネルギーと温かみ
 *   accent    = #B45309 (Amber 700 / Burnt) — brand を深く落とした並列対比
 *   highlight = #1F2937 (Slate 800)        — 黒側のスパイス。締めに使う
 *
 * ink (本文色) は引き続き Slate-800。本文・見出しが黒一色だと印象がきつく
 * 単調になるため、Tailwind / Notion と同じ温度感のスタンダードな slate に寄せる。
 *
 * これにより default で生成しても、Before/After や 4 カードグリッドが
 * 単色潰しにならず、自然に系列差が出る。design.md で 3 色を明示すれば
 * その色に上書きされる。
 *
 * すべての値は「# なし 6 文字 16 進」(PptxGenJS 形式)。
 */

const THEMES = {
  /* =========================================================
     DEFAULT — Amber × Burnt-Amber × Slate on Off-White
     3 色構造の default。Amber 主役 + 同系統の対比 + スパイスに黒。
     色を変えたい時は design.md で上書き。
     ======================================================== */
  default: {
    id: 'default',
    name: 'Default',
    description: 'Amber 500 主役 × Amber 700 対比 × Slate スパイス on Off-White。色は design.md で上書き',
    usage: '通常の ENOSTECH デッキ。色を変えたい時は design.md を渡す',
    brand: {
      base:    'F59E0B',  // Amber 500 — 主役
      soft:    'FEF3C7',  // Amber 100 — 薄い背景・ハロー
      deep:    'B45309',  // Amber 700 — 強調・濃い面
      contrast: 'FFFFFF',
    },
    accent: {
      base:    'B45309',  // Amber 700 — 並列対比軸 (brand と同系統だが深い)
      soft:    'FDE68A',  // Amber 200 相当 — 薄い背景
      deep:    '7C2D12',  // Orange 900 — もっとも濃い側
      contrast: 'FFFFFF',
    },
    highlight: {
      base:    '1F2937',  // Slate 800 — 黒側スパイス (色相を意図的に外す)
      soft:    'E5E7EB',  // Gray 200
      deep:    '111827',  // Slate 900
      contrast: 'FFFFFF',
    },
    neutral: {
      50:  'FAFAFA',
      100: 'F5F5F5',
      200: 'E5E5E5',
      300: 'D4D4D4',
      400: 'A3A3A3',
      500: '737373',
      700: '404040',
      900: '1F2937',  // ink と同じ slate-800
    },
    canvas: 'FAFAF7',     // off-white
    white:  'FFFFFF',
  },
};

// エクスポート (Node.js / ブラウザ両対応)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = THEMES;
}
if (typeof window !== 'undefined') {
  window.ENOSTECH_THEMES = THEMES;
}
