/**
 * _chart-style.js — チャート共通スタイルファクトリ
 * =================================================
 * pptxgenjs ネイティブ addChart で再利用するスタイル。
 *
 * ⚠️ 重要 (slides-maker 記事より): pptxgenjs はオプションオブジェクトを
 *   インプレースで変更するため、複数チャート間で同じ opts を使い回すと
 *   破壊される。**毎回ファクトリ関数で新規生成** すること。
 */

'use strict';

/** チャート用パレット (ENOSTECH ブランドトークンを継承)
 *  - 単一系列のときは brand 1 色
 *  - 複数系列のときは brand → brandSoft → gray の順 + 強調は accent
 */
// チャート専用: brand が黒のテーマ (mono) でもチャートが「黒の壁」にならないよう
// マイルドなスレートを 1 色目に固定する。
// ・slate (#2A2D34) はチャート上のテキストとも違いが出る濃グレー
// ・brand が既にアンバーや紫など差別化色なら brand を尊重 (テーマ判定で切替)
// ・accent (アンバー) はテーマのまま使う (#F59E0B / コントラスト良好)
const CHART_SLATE = '#2A2D34';

function _isMonoLikeBrand(C) {
  // brand が黒系 (#000000 / #111 等の超低明度) かを判定
  const v = (C.brand || '').replace('#', '').toLowerCase();
  if (v.length < 6) return false;
  const r = parseInt(v.slice(0,2), 16);
  const g = parseInt(v.slice(2,4), 16);
  const b = parseInt(v.slice(4,6), 16);
  // 平均明度が 0x30 以下なら「黒すぎ」とみなしてスレートに置き換え
  return (r + g + b) / 3 < 0x30;
}

function chartPalette(C, n) {
  const lead = _isMonoLikeBrand(C) ? CHART_SLATE : C.brand;
  // 1 系列: lead
  // 2 系列: + accent (アンバー)
  // 3 系列: + brandSoft (薄)
  // 4 系列: + gray500
  // 5 系列: + accentSoft
  const base = [
    lead,
    C.accent,
    C.brandSoft,
    C.gray500,
    C.accentSoft,
    C.brandDeep || lead,
    C.gray300,
  ];
  return base.slice(0, Math.max(1, n));
}

/** コンサル品質の共通軸スタイル */
function axisStyle(C, F) {
  return {
    catAxisLabelFontFace: F.jp,
    catAxisLabelFontSize: 9,
    catAxisLabelColor: C.ink,
    valAxisLabelFontFace: F.jp,
    valAxisLabelFontSize: 9,
    valAxisLabelColor: C.gray500,
    valGridLine:  { color: C.gray200, size: 0.5 },
    catGridLine:  { style: 'none' },
  };
}

/** データラベル共通 */
function dataLabelStyle(C, F) {
  return {
    dataLabelFontFace: F.jp,
    dataLabelFontSize: 9,
    dataLabelColor: C.ink,
  };
}

/** 凡例共通 */
function legendStyle(C, F, show) {
  if (!show) return { showLegend: false };
  return {
    showLegend: true,
    legendPos: 'b',
    legendFontFace: F.jp,
    legendFontSize: 9,
    legendColor: C.ink,
  };
}

/** 全チャート共通の chartArea / plotArea (背景・余白) */
function areaStyle(C) {
  return {
    chartArea: { fill: { color: C.canvas } },
    plotArea:  { fill: { color: C.canvas } },
  };
}

/**
 * 強調系列を brand カラーで、それ以外は ink に。
 * series 配列 (chartJson.series) を受けて、各系列に highlight: true があれば
 * brand を、それ以外は ink (slate-800) を割り当てた色配列を返す。
 *
 * @param {Array<{name, values, highlight?}>} series
 * @param {object} C  ctx.color
 * @returns {string[]}
 */
function emphasisChartColors(series, C) {
  const ink = C.ink || '#1F2937';
  const brand = C.brand || '#F59E0B';
  return series.map(s => (s && s.highlight ? brand : ink));
}

/**
 * チャートに annotation (吹き出し / コールアウトボックス) を描く。
 *
 * annotations: [
 *   {
 *     kind: 'callout' | 'box' | 'arrow_label',
 *     x, y, w, h,                  // inch 単位 (slide 全体座標)
 *     text: string,
 *     color?: 'brand' | 'accent' | 'ink' | hex,
 *     anchor?: { x, y }            // arrow_label でリーダー線を引く先
 *   }, ...
 * ]
 *
 * チャート系 (CHART-A1/81/82/83) で plotArea に説明を重ねる時に使う。
 */
function drawChartAnnotations(slide, annotations, ctx) {
  if (!Array.isArray(annotations) || annotations.length === 0) return;
  const { C, F, pres } = ctx;
  for (const a of annotations) {
    const fillColor = _resolveAnnoColor(C, a.color, 'fill');
    const textColor = _resolveAnnoColor(C, a.color, 'text');
    const x = a.x || 0;
    const y = a.y || 0;
    const w = a.w || 1.8;
    const h = a.h || 0.50;
    if (a.kind === 'arrow_label' && a.anchor) {
      // リーダー線 + 角丸ラベル
      slide.addShape(pres.shapes.LINE, {
        x: a.anchor.x, y: a.anchor.y, w: x - a.anchor.x, h: y - a.anchor.y,
        line: { color: C.brand, width: 1.5 },
      });
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w, h, rectRadius: 0.06,
        fill: { color: fillColor }, line: { color: C.brand, width: 1 },
      });
      slide.addText(a.text || '', {
        x: x + 0.08, y, w: w - 0.16, h,
        fontSize: 10, color: textColor, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
    } else if (a.kind === 'box') {
      // 矩形ボックス (太枠強調)
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w, h, rectRadius: 0.06,
        fill: { color: fillColor },
        line: { color: C.brand, width: 1.5 },
      });
      slide.addText(a.text || '', {
        x: x + 0.10, y, w: w - 0.20, h,
        fontSize: 10, color: textColor, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
        lineSpacingMultiple: 1.20,
      });
    } else {
      // callout (default): ピル風の薄塗り + brand バー
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.05, h,
        fill: { color: C.brand }, line: { type: 'none' },
      });
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: x + 0.05, y, w: w - 0.05, h, rectRadius: 0.06,
        fill: { color: fillColor }, line: { type: 'none' },
      });
      slide.addText(a.text || '', {
        x: x + 0.18, y, w: w - 0.30, h,
        fontSize: 10, color: textColor, fontFace: F.jp,
        align: 'left', valign: 'middle', margin: 0,
        lineSpacingMultiple: 1.40,
      });
    }
  }
}

function _resolveAnnoColor(C, name, kind) {
  // kind = 'fill' / 'text'
  // name = 'brand' / 'accent' / 'ink' / 任意 hex / undefined
  if (typeof name === 'string') {
    if (/^#?[0-9A-Fa-f]{6}$/.test(name)) {
      return kind === 'fill' ? name.replace('#', '') + '20' : name.replace('#', '');
    }
    const map = {
      brand:  { fill: C.brandSoft || C.gray100, text: C.ink },
      accent: { fill: C.accentSoft || C.gray100, text: C.accentDeep || C.ink },
      ink:    { fill: C.gray100, text: C.ink },
    };
    if (map[name]) return map[name][kind];
  }
  return kind === 'fill' ? (C.gray100 || '#F4F4F5') : (C.ink || '#1F2937');
}

module.exports = {
  chartPalette,
  emphasisChartColors,
  axisStyle,
  dataLabelStyle,
  legendStyle,
  areaStyle,
  drawChartAnnotations,
};
