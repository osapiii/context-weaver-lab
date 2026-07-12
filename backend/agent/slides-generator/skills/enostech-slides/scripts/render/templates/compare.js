'use strict';

// =============================================================
// templates/compare.js
// -------------------------------------------------------------
// Consolidated from templates/compare/*.js.
// Each original subfile is wrapped in an IIFE so its internal
// scope (helpers, constants like MARK_COLORS / MONO_FONT) stays
// private. Only the exports of the original `module.exports = {...}`
// are destructured into module-scope constants — exactly mirroring
// what `require('./xxx')` produced at runtime. The category's
// index.js (registry) is appended verbatim at the bottom.
// File contents are not modified beyond:
//   - stripping per-file `'use strict'` (one at top of merged file)
//   - stripping intra-category `require('./X')` (X is now in scope)
//   - rewriting `'../../X'` paths to `'../X'`
//   - extracting `module.exports = {...}` into IIFE return value
// =============================================================

// ─── compare-1-before-after.js ───────────────────────────────────
const { renderCompare1BeforeAfter } = (function () {
  /**
   * COMPARE-1 Before/After リッチ 3 行 (Category B: CONTENT)
   * ====================================================
   * 各行: 項目名（左）/ これまで（中・gray）→ これから（右・accent）
   * 期待 JSON: { items: [{ label, sub, before, beforeSub, after, afterSub }] } (3 件推奨)
   *
   * 動的フォントサイズ対応
   *   - before / after が長文 (16字 以上) の場合に fontSize を 14 → 12 → 10 に自動縮小
   *   - 文字長制限を超えた場合は console.warn で render 側からモデルに警告
   */


  const atoms = require('../atoms');
  //   全角 12 字までは 14pt 1 行に収まる / 16 字までは 12pt / 20 字までは 10pt
  //   それ以上は自動的に折り返すが、隣接行と被るので推奨しない
  function pickValueFontSize(text) {
    const len = (text || '').length;
    if (len <= 12) return 14;
    if (len <= 16) return 12;
    if (len <= 20) return 10;
    return 9.5;  // 9.5pt 死守ライン。20 字超は本来 plan.json で短縮すべき
  }

  function pickSubFontSize(text) {
    const len = (text || '').length;
    if (len <= 24) return 9.5;
    if (len <= 32) return 9.5;
    return 9.5;
  }

  function renderCompare1BeforeAfter(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || '',
      slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    const items = Array.isArray(slideJson.items) ? slideJson.items : [];
    if (items.length === 0) return;
    items.forEach((it, i) => {
      const fields = [
        ['before', it.before, 20],
        ['after', it.after, 20],
        ['beforeSub', it.beforeSub, 32],
        ['afterSub', it.afterSub, 32],
      ];
      fields.forEach(([name, val, max]) => {
        const len = (val || '').length;
        if (len > max) {
          console.warn(
            `[COMPARE-1] slide ${slideJson.id || '?'} items[${i}].${name} が ${len} 字 ` +
            `(推奨上限 ${max} 字)。動的縮小は効くが ${len > max + 8 ? '描画破綻リスクあり' : '見栄え劣化'}。` +
            `plan.json で短縮することを推奨。`
          );
        }
      });
    });

    const labelW = 2.70;
    const valueW = 2.95;
    const arrowW = 0.40;
    const innerGap = 0.10;
    const labelX = L.marginX;
    const beforeX = labelX + labelW + 0.15;
    const arrowX = beforeX + valueW + innerGap;
    const afterX = arrowX + arrowW + innerGap;

    // ヘッダ
    const headerY = L.contentY;
    const headerH = 0.36;
    slide.addText('これまで', {
      x: beforeX, y: headerY, w: valueW, h: headerH,
      fontSize: 11, color: C.gray500, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', charSpacing: 0, margin: 0,
    });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: afterX, y: headerY, w: valueW, h: headerH, rectRadius: L.cardRadiusSmall,
      fill: { color: C.accentSoft }, line: { type: 'none' },
    });
    slide.addText('これから', {
      x: afterX, y: headerY, w: valueW, h: headerH,
      fontSize: 11, color: C.accentDeep, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', charSpacing: 2, margin: 0,
    });

    const rowsTop = headerY + headerH + 0.16;
    const rowH = 0.86;
    const rowGap = 0.14;

    items.forEach((it, i) => {
      const ry = rowsTop + i * (rowH + rowGap);

      if (i > 0) {
        slide.addShape(pres.shapes.LINE, {
          x: labelX, y: ry - rowGap / 2, w: 9.2, h: 0,
          line: { color: C.gray200, width: L.lineWidth },
        });
      }
      slide.addText(String(i + 1).padStart(2, '0'), {
        x: labelX, y: ry + 0.04, w: 0.50, h: 0.32,
        fontSize: 18, color: C.gray700, fontFace: F.jp, bold: true,
        align: 'left', valign: 'top', margin: 0, charSpacing: 1,
      });
      slide.addText(it.label || '', {
        x: labelX + 0.55, y: ry + 0.06, w: labelW - 0.55, h: 0.34,
        fontSize: 13, color: C.ink, fontFace: F.jp, bold: true,
        align: 'left', valign: 'top', margin: 0,
      });
      slide.addText(it.sub || '', {
        x: labelX + 0.55, y: ry + 0.42, w: labelW - 0.55, h: 0.40,
        fontSize: 9.5, color: C.gray500, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0,
      });
      // v11.4: Before カード塗り gray100 → white border (「失敗感」解消、After 強調を保つ)
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: beforeX, y: ry, w: valueW, h: rowH, rectRadius: L.cardRadius,
        fill: { color: C.white }, line: { color: C.gray300, width: 0.5 },
      });
      const beforeFs = pickValueFontSize(it.before);
      slide.addText(it.before || '', {
        x: beforeX + 0.18, y: ry + 0.10, w: valueW - 0.36, h: 0.36,
        fontSize: beforeFs, color: C.gray700, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      slide.addText(it.beforeSub || '', {
        x: beforeX + 0.18, y: ry + 0.46, w: valueW - 0.36, h: 0.36,
        fontSize: pickSubFontSize(it.beforeSub), color: C.gray500, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0,
      });
      slide.addText('→', {
        x: arrowX, y: ry, w: arrowW, h: rowH,
        fontSize: 24, color: C.accent, fontFace: F.jp,
        bold: true, align: 'center', valign: 'middle', margin: 0,
      });
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: afterX, y: ry, w: valueW, h: rowH, rectRadius: L.cardRadius,
        fill: { color: C.accentSoft }, line: { type: 'none' },
      });
      const afterFs = pickValueFontSize(it.after);
      slide.addText(it.after || '', {
        x: afterX + 0.18, y: ry + 0.10, w: valueW - 0.36, h: 0.36,
        fontSize: afterFs, color: C.accentDeep, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      slide.addText(it.afterSub || '', {
        x: afterX + 0.18, y: ry + 0.46, w: valueW - 0.36, h: 0.36,
        fontSize: pickSubFontSize(it.afterSub), color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0,
      });
    });

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'COMPARE-1（Before/After リッチ）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCompare1BeforeAfter };
})();

// ─── compare-2-before-after-compact.js ───────────────────────────
const { renderCompare2BeforeAfterCompact } = (function () {
  /**
   * COMPARE-2 コンパクト Before/After (Category B: CONTENT)
   * ===================================================
   * 2 列 × 6 行。各行 1 行テキストで観点の網羅性を表現。
   * 期待 JSON: { items: [{ before, after }] } (4-6 件推奨)
   */


  const atoms = require('../atoms');

  function renderCompare2BeforeAfterCompact(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    const items = Array.isArray(slideJson.items) ? slideJson.items : [];
    if (items.length === 0) return;

    const beforeX = L.marginX;
    const colW = 4.40;
    const arrowX = beforeX + colW + 0.05;
    const arrowW = 0.30;
    const afterX = arrowX + arrowW + 0.05;

    // ヘッダ
    const headerY = L.contentY;
    const headerH = 0.32;
    slide.addText('これまで', {
      x: beforeX, y: headerY, w: colW, h: headerH,
      fontSize: 11, color: C.gray500, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', charSpacing: 0, margin: 0,
    });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: afterX, y: headerY, w: colW, h: headerH, rectRadius: L.cardRadius,
      fill: { color: C.accentSoft }, line: { type: 'none' },
    });
    slide.addText('これから', {
      x: afterX, y: headerY, w: colW, h: headerH,
      fontSize: 11, color: C.accentDeep, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', charSpacing: 2, margin: 0,
    });

    const rowsY = headerY + headerH + 0.12;
    const rowH = 0.44;
    const rowGap = 0.07;

    items.slice(0, 6).forEach((it, i) => {
      const ry = rowsY + i * (rowH + rowGap);
      const num = String(i + 1).padStart(2, '0');

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: beforeX, y: ry, w: colW, h: rowH, rectRadius: L.cardRadius,
        fill: { color: C.gray100 }, line: { color: C.gray200, width: L.lineWidth },
      });
      slide.addText(num, {
        x: beforeX + 0.22, y: ry, w: 0.45, h: rowH,
        fontSize: 12, color: C.gray400, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0, charSpacing: 1,
      });
      slide.addText(it.before || '', {
        x: beforeX + 0.70, y: ry, w: colW - 0.85, h: rowH,
        fontSize: 12, color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'middle', margin: 0,
      });

      slide.addText('→', {
        x: arrowX, y: ry, w: arrowW, h: rowH,
        fontSize: 16, color: C.accent, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: afterX, y: ry, w: colW, h: rowH, rectRadius: L.cardRadius,
        fill: { color: C.accentSoft }, line: { type: 'none' },
      });
      slide.addText(it.after || '', {
        x: afterX + 0.24, y: ry, w: colW - 0.48, h: rowH,
        fontSize: 12, color: C.accentDeep, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
    });

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'COMPARE-2（コンパクト Before/After）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCompare2BeforeAfterCompact };
})();

// ─── compare-3-icon.js ───────────────────────────────────────────
const { renderCompare3Icon } = (function () {
  /**
   * COMPARE-3 比較表（星取り表 / 長文セル対応） (Category H: DATA / REFERENCE)
   * ========================================================
   * 複数製品 × 複数評価軸の比較マトリクス。
   *
   * 「長文セル」も同じテンプレで安定描画できるように動的フォントサイズを導入。
   *
   * 期待 JSON:
   *   {
   *     items: ["項目1", "項目2", ...],   // 行 (評価軸)
   *     cols:  ["A 社", "B 社", "当社"],   // 列 (比較対象)
   *     matrix: [["◎", "◯", "△"], ...]   // items 行 × cols 列の評価
   *               // または ["短い説明", "短い説明", "短い説明"] の長文セル
   *   }
   *
   * 動的フォントサイズ:
   *   - mark 記号 (◎○△×) → fontSize 18 (従来通り)
   *   - 文字列 (5 字以下)  → fontSize 14 (短いラベル)
   *   - 文字列 (8 字以下)  → fontSize 12
   *   - 文字列 (12 字以下) → fontSize 10
   *   - 文字列 (15 字以下) → fontSize  9
   *   - それ以上は warn を出して fontSize 9 で続行 (描画破綻リスクあり)
   */


  const atoms = require('../atoms');

  const MARK_COLORS = {
    '◎': 'brand',
    '○': 'gray700',
    '◯': 'gray700',
    '△': 'accent',
    '×': 'gray400',
  };
  const MARK_CHARS = new Set(Object.keys(MARK_COLORS));

  function isMark(text) {
    // 1 文字でかつ評価記号セットに含まれる
    return typeof text === 'string' && text.length === 1 && MARK_CHARS.has(text);
  }
  function pickCellFontSize(text, colCount) {
    if (isMark(text)) return 18;
    const len = (text || '').length;
    // 列数が多いほどセル幅が狭まるので、より小さく
    if (colCount >= 5) {
      if (len <= 4) return 12;
      if (len <= 8) return 10;
      if (len <= 12) return 9;
      return 8;
    }
    if (colCount >= 4) {
      if (len <= 5) return 14;
      if (len <= 8) return 12;
      if (len <= 12) return 10;
      if (len <= 15) return 9;
      return 8;
    }
    // colCount <= 3
    if (len <= 6) return 14;
    if (len <= 10) return 12;
    if (len <= 15) return 10;
    if (len <= 20) return 9;
    return 8;
  }

  function renderCompare3Icon(slide, slideJson, ctx) {
    const { L, C, F } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const items = Array.isArray(slideJson.items) ? slideJson.items : [];
    const cols = Array.isArray(slideJson.cols) ? slideJson.cols : [];
    const matrix = Array.isArray(slideJson.matrix) ? slideJson.matrix : [];
    if (items.length === 0 || cols.length === 0) return;
    const colWarnLimit = cols.length >= 4 ? 8 : 12;
    cols.forEach((c, ci) => {
      if (typeof c === 'string' && c.length > colWarnLimit) {
        console.warn(
          `[COMPARE-3] slide ${slideJson.id || '?'} cols[${ci}] が ${c.length} 字 ` +
          `(列数 ${cols.length}、推奨上限 ${colWarnLimit} 字)。動的縮小は効くが見栄え劣化。`
        );
      }
    });
    matrix.forEach((row, ri) => {
      if (!Array.isArray(row)) return;
      row.forEach((cell, ci) => {
        if (typeof cell === 'string' && !isMark(cell)) {
          const cellLimit = cols.length >= 5 ? 12 : cols.length >= 4 ? 15 : 20;
          if (cell.length > cellLimit) {
            console.warn(
              `[COMPARE-3] slide ${slideJson.id || '?'} matrix[${ri}][${ci}] が ${cell.length} 字 ` +
              `(列数 ${cols.length}、推奨上限 ${cellLimit} 字)。短縮または COMPARE-5/6 への変更を推奨。`
            );
          }
        }
      });
    });

    const tableW = 10 - L.marginX * 2;
    const itemColW = 3.0;
    const cellW = (tableW - itemColW) / cols.length;

    // ヘッダ列のフォントサイズも動的
    const colFs = pickCellFontSize(cols[0] || '', cols.length);
    // ヘッダ行
    const header = [
      { text: '', options: { fill: { color: C.gray100 } } },
      ...cols.map((c, i) => ({
        text: c,
        options: {
          fill: { color: C.ink },
          color: C.white, bold: true,
          fontSize: Math.max(10, Math.min(12, colFs + 2)),
          align: 'center', valign: 'middle', fontFace: F.jp,
        },
      })),
    ];

    // ボディ行
    const bodyRows = items.map((it, ri) => [
      {
        text: it,
        options: {
          fill: { color: C.gray50 },
          color: C.ink, bold: true, fontSize: 11.5,
          align: 'left', valign: 'middle', fontFace: F.jp,
        },
      },
      ...cols.map((_, ci) => {
        const cell = (matrix[ri] || [])[ci] || '';
        const colorTok = isMark(cell) ? MARK_COLORS[cell] : 'ink';
        const fs = pickCellFontSize(cell, cols.length);
        return {
          text: cell,
          options: {
            color: C[colorTok] || C.ink,
            bold: true,
            fontSize: fs,
            align: 'center', valign: 'middle', fontFace: F.jp,
          },
        };
      }),
    ]);

    const availH = L.contentBot - (L.contentY + 0.05);
    const hasLongText = matrix.some(row =>
      Array.isArray(row) && row.some(c => typeof c === 'string' && !isMark(c) && c.length > 5)
    );
    const baseRowH = hasLongText ? 0.65 : 0.5;
    const rowH = Math.min(baseRowH, (availH - 0.45) / items.length);
    slide.addTable([header, ...bodyRows], {
      x: L.marginX, y: L.contentY + 0.05, w: tableW,
      colW: [itemColW, ...cols.map(() => cellW)],
      rowH: [0.50, ...bodyRows.map(() => rowH)],
      border: { pt: 0.25, color: C.gray200 },
      fontFace: F.jp,
    });

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'COMPARE-3（比較表 / 長文セル対応 v8.8）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCompare3Icon };
})();

// ─── compare-4-tradeoff.js ───────────────────────────────────────
const { renderCompare4Tradeoff } = (function () {
  /**
   * COMPARE-4 トレードオフスライダー (Category H: DATA / REFERENCE)
   * ==========================================================
   * 複数の選択肢を「軸の上の位置」で表現。各スライダーに左右ラベル + 候補位置。
   * 期待 JSON:
   *   {
   *     sliders: [{ label, left, right, items: [{ name, position, accent? }] }]
   *   }
   */


  const atoms = require('../atoms');

  function renderCompare4Tradeoff(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const sliders = Array.isArray(slideJson.sliders) ? slideJson.sliders : [];
    if (sliders.length === 0) return;

    const startY = L.contentY + 0.10;
    const availH = L.contentBot - startY - 0.10;
    const sliderH = availH / sliders.length;

    sliders.forEach((sl, i) => {
      const y = startY + i * sliderH;

      // ラベル
      slide.addText(sl.label || '', {
        x: L.marginX, y, w: 9.20, h: 0.30,
        fontSize: 12, color: C.ink, fontFace: F.jp, bold: true,
        align: 'left', valign: 'top', margin: 0,
      });

      // スライダー軸
      const axY = y + sliderH * 0.55;
      const axX1 = L.marginX + 1.0;
      const axX2 = L.marginX + 9.20 - 1.0;
      const axW = axX2 - axX1;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: axX1, y: axY - 0.02, w: axW, h: 0.04,
        fill: { color: C.gray200 }, line: { type: 'none' },
      });
      // 左キャップ
      slide.addShape(pres.shapes.OVAL, {
        x: axX1 - 0.04, y: axY - 0.04, w: 0.08, h: 0.08,
        fill: { color: C.gray300 }, line: { type: 'none' },
      });
      // 右キャップ
      slide.addShape(pres.shapes.OVAL, {
        x: axX2 - 0.04, y: axY - 0.04, w: 0.08, h: 0.08,
        fill: { color: C.gray300 }, line: { type: 'none' },
      });

      // 左ラベル
      slide.addText(sl.left || '', {
        x: L.marginX, y: axY - 0.20, w: 1.0, h: 0.30,
        fontSize: 10, color: C.gray500, fontFace: F.jp,
        align: 'right', valign: 'middle', margin: 0,
      });
      // 右ラベル
      slide.addText(sl.right || '', {
        x: axX2, y: axY - 0.20, w: 1.0, h: 0.30,
        fontSize: 10, color: C.gray500, fontFace: F.jp,
        align: 'left', valign: 'middle', margin: 0,
      });

      // 候補位置
      const items = Array.isArray(sl.items) ? sl.items : [];
      items.forEach(it => {
        const pos = Math.max(0, Math.min(1, it.position || 0.5));
        const px = axX1 + axW * pos;
        const dot = 0.24;

        slide.addShape(pres.shapes.OVAL, {
          x: px - dot / 2, y: axY - dot / 2, w: dot, h: dot,
          fill: { color: it.accent ? C.accent : C.brand },
          line: { color: C.white, width: 2 },
        });
        slide.addText(it.name || '', {
          x: px - 0.75, y: axY + 0.20, w: 1.5, h: 0.25,
          fontSize: 9.5, color: it.accent ? C.accentDeep : C.brand,
          fontFace: F.jp, bold: true,
          align: 'center', valign: 'middle', margin: 0,
        });
      });
    });

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'COMPARE-4（トレードオフ）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCompare4Tradeoff };
})();

// ─── compare-5-grouped.js ────────────────────────────────────────
const { renderCompare5Grouped } = (function () {
  /**
   * COMPARE-5 グルーピング付き比較表 (Category H: DATA / REFERENCE)
   * ============================================================
   * 列をグループ (国内/国外、自社/他社 等) のピルで束ね、下に評価表を出す。
   *
   * 期待 JSON:
   *   {
   *     title: "...",
   *     subtitle: "...",
   *     groups: [
   *       { name: "国内", color: "brand", cols: ["A 社", "B 社"] },
   *       { name: "国外", color: "accent", cols: ["C 社", "D 社", "E 社"] }
   *     ],
   *     items: ["費用の安さ", "範囲の広さ", ...]   // 行 (評価軸)
   *     matrix: [
   *       ["◎", "○", "○", "△", "○"],   // 行 1: items[0]
   *       ["○", "○", "○", "○", "△"],   // 行 2: items[1]
   *       ...
   *     ]
   *   }
   */


  const atoms = require('../atoms');

  const MARK_COLORS = {
    '◎': 'brand',
    '○': 'gray700',
    '◯': 'gray700',
    '△': 'accent',
    '×': 'gray400',
  };

  function renderCompare5Grouped(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
    );

    const groups = Array.isArray(slideJson.groups) ? slideJson.groups : [];
    const items = Array.isArray(slideJson.items) ? slideJson.items : [];
    const matrix = Array.isArray(slideJson.matrix) ? slideJson.matrix : [];
    if (groups.length === 0 || items.length === 0) return;

    // 列の総数 (各 group の cols を flat 化)
    const allCols = [];
    groups.forEach(g => {
      (g.cols || []).forEach(c => allCols.push({ name: c, group: g }));
    });

    const tableX = L.marginX;
    const tableW = 10 - L.marginX * 2;
    const itemColW = 1.8;
    const cellW = (tableW - itemColW) / allCols.length;

    // ── レイアウト ──
    const startY = titleBottomY + 0.10;  // 0.20 → 0.10 (sub-copy 直下スペース圧縮)
    const groupPillH = 0.32;
    const colHeaderH = 0.30;
    const rowGap = 0.06;
    const headerBottom = startY + groupPillH + 0.10 + colHeaderH;
    const availH = L.contentBot - headerBottom - 0.10;
    const rowH = Math.min(0.55, availH / items.length - rowGap);

    // ── 1. グループピル (上段) ──
    let pillX = tableX + itemColW;
    groups.forEach(g => {
      const groupColCount = (g.cols || []).length;
      const pillW = cellW * groupColCount - 0.10;  // 端のマージン
      const pillColor = _resolveGroupColor(C, g.color);
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: pillX + 0.05, y: startY, w: pillW, h: groupPillH, rectRadius: 0.16,
        fill: { color: pillColor.bg }, line: { type: 'none' },
      });
      slide.addText(g.name || '', {
        x: pillX + 0.05, y: startY, w: pillW, h: groupPillH,
        fontSize: 13, color: pillColor.text, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: pillX + 0.05, y: startY + groupPillH + 0.08,
        w: pillW, h: 0.02,
        fill: { color: pillColor.bg }, line: { type: 'none' },
        transparency: 70,
      });
      pillX += cellW * groupColCount;
    });

    // ── 2. 列ヘッダー (各列名、グループ色で文字着色) ──
    const colHdrY = startY + groupPillH + 0.10;
    allCols.forEach((col, i) => {
      const cx = tableX + itemColW + i * cellW;
      const grpColor = _resolveGroupColor(C, col.group.color);
      slide.addText(col.name || '', {
        x: cx, y: colHdrY, w: cellW, h: colHeaderH,
        fontSize: 12, color: grpColor.bg, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
    });

    // ── 3. ボディ行 (各 item × 各列の評価) ──
    items.forEach((it, ri) => {
      const ry = headerBottom + ri * (rowH + rowGap);
      // 行ラベル
      slide.addText(it, {
        x: tableX, y: ry, w: itemColW, h: rowH,
        fontSize: 12, color: C.gray700, fontFace: F.jp,
        align: 'center', valign: 'middle', margin: 0,
      });
      slide.addShape(pres.shapes.LINE, {
        x: tableX, y: ry, w: tableW, h: 0,
        line: { color: C.gray200, width: L.lineWidth },
      });
      // 各セルに評価マーク
      allCols.forEach((_, ci) => {
        const cx = tableX + itemColW + ci * cellW;
        const mark = (matrix[ri] || [])[ci] || '';
        const colorTok = MARK_COLORS[mark] || 'ink';
        slide.addText(mark, {
          x: cx, y: ry, w: cellW, h: rowH,
          fontSize: 22, color: C[colorTok] || C.ink, fontFace: F.jp, bold: true,
          align: 'center', valign: 'middle', margin: 0,
        });
      });
    });
    const lastY = headerBottom + items.length * (rowH + rowGap);
    slide.addShape(pres.shapes.LINE, {
      x: tableX, y: lastY, w: tableW, h: 0,
      line: { color: C.gray200, width: L.lineWidth },
    });

    // chrome
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'COMPARE-5（グルーピング付き比較表）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }

  function _resolveGroupColor(C, name) {
    // 'brand' / 'accent' / 'highlight' / 'ink' / 任意 hex
    if (typeof name === 'string') {
      if (/^#?[0-9A-Fa-f]{6}$/.test(name)) return { bg: name.replace('#', ''), text: C.white };
      const map = {
        brand:     { bg: C.brand,     text: C.white },
        accent:    { bg: C.accent,    text: C.white },
        highlight: { bg: C.highlight, text: C.white },
        ink:       { bg: C.ink,       text: C.white },
      };
      if (map[name]) return map[name];
    }
    return { bg: C.brand, text: C.white };
  }
  return { renderCompare5Grouped };
})();

// ─── compare-6-detail.js ─────────────────────────────────────────
const { renderCompare6Detail } = (function () {
  /**
   * COMPARE-6 テキスト補足メインの比較表 (Category H: DATA / REFERENCE)
   * ===============================================================
   * 各セルに「大きな ○△× アイコン + 詳細テキスト 2-3 行」。
   * COMPARE-3 (アイコンのみ) より説明力が高く、なぜそう評価したかを書ける。
   *
   * 期待 JSON:
   *   {
   *     title: "...",
   *     subtitle: "...",
   *     cols: ["A 社", "B 社"],          // 比較対象 (2-3 件推奨)
   *     items: [                          // 行 (評価軸)
   *       {
   *         name: "管理画面の操作性",
   *         cells: [
   *           { mark: "△", text: "マウス操作のみで..." },
   *           { mark: "○", text: "直観的な操作が..." }
   *         ]
   *       }
   *     ]
   *   }
   */


  const atoms = require('../atoms');

  const MARK_COLORS = {
    // v11.3 で COMPARE-3/5 と統一 (atoms.MARK_PALETTE 規約)
    '◎': 'brand',
    '○': 'gray700',
    '◯': 'gray700',
    '△': 'accent',
    '×': 'gray400',
  };

  function renderCompare6Detail(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
    );

    const cols = Array.isArray(slideJson.cols) ? slideJson.cols : [];
    const items = Array.isArray(slideJson.items) ? slideJson.items : [];
    if (cols.length === 0 || items.length === 0) return;

    const tableX = L.marginX;
    const tableW = 10 - L.marginX * 2;
    const itemColW = 1.8;
    const cellW = (tableW - itemColW) / cols.length;

    const startY = titleBottomY + 0.04;  // 0.10 → 0.04 (sub-copy 直下スペース圧縮)
    const headerH = 0.36;
    const rowsTop = startY + headerH + 0.04;
    const availH = L.contentBot - rowsTop - 0.10;
    const rowH = availH / items.length - 0.04;

    // ── ヘッダー: 比較項目 + 列名 ──
    // 比較項目セル
    slide.addShape(pres.shapes.RECTANGLE, {
      x: tableX, y: startY, w: itemColW, h: headerH,
      fill: { color: C.gray100 }, line: { type: 'none' },
    });
    slide.addText('比較項目', {
      x: tableX, y: startY, w: itemColW, h: headerH,
      fontSize: 13, color: C.gray700, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });
    // 各列ヘッダー
    cols.forEach((col, i) => {
      const cx = tableX + itemColW + i * cellW;
      slide.addText(col, {
        x: cx, y: startY, w: cellW, h: headerH,
        fontSize: 14, color: C.brand, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
    });

    // ── 行 (各 item は cells[] を 2-3 列に展開) ──
    items.forEach((item, ri) => {
      const ry = rowsTop + ri * (rowH + 0.06);

      // 行ラベル (左)
      slide.addShape(pres.shapes.RECTANGLE, {
        x: tableX, y: ry, w: itemColW, h: rowH,
        fill: { color: C.gray50 }, line: { color: C.gray200, width: L.lineWidth },
      });
      slide.addText(item.name || '', {
        x: tableX + 0.10, y: ry, w: itemColW - 0.20, h: rowH,
        fontSize: 13, color: C.ink, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
        lineSpacingMultiple: 1.20,
      });

      // 各セル
      const cells = Array.isArray(item.cells) ? item.cells : [];
      cells.forEach((cell, ci) => {
        const cx = tableX + itemColW + ci * cellW;
        slide.addShape(pres.shapes.RECTANGLE, {
          x: cx, y: ry, w: cellW, h: rowH,
          fill: { color: C.canvas }, line: { color: C.gray200, width: L.lineWidth },
        });
        const mark = cell.mark || '';
        const colorTok = MARK_COLORS[mark] || 'ink';
        slide.addText(mark, {
          x: cx, y: ry + 0.06, w: cellW, h: rowH * 0.30,
          fontSize: 32, color: C[colorTok] || C.ink, fontFace: F.jp, bold: true,
          align: 'center', valign: 'middle', margin: 0,
        });
        // 下半分: 詳細テキスト (2-3 行)
        slide.addText(cell.text || '', {
          x: cx + 0.18, y: ry + rowH * 0.40, w: cellW - 0.36, h: rowH * 0.55,
          fontSize: 11, color: C.gray700, fontFace: F.jp,
          align: 'left', valign: 'top', margin: 0,
          lineSpacingMultiple: L.lineSpacingMultiple,
        });
      });
    });

    // chrome
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'COMPARE-6（テキスト補足比較表）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCompare6Detail };
})();


// ─── compare-7-pros-cons.js (v11.6 新規 / Phase γ) ───────────────
const { renderCompare7ProsCons } = (function () {
  /**
   * COMPARE-7 Pros/Cons 3 選択肢並列 (v11.6 新規 / Category B: COMPARE)
   * =================================================================
   * 3 つの選択肢を「Pros (◯) / Cons (×)」で並列比較。各列に Pros 2-3 件 + Cons 2-3 件。
   *
   * 期待 JSON:
   *   {
   *     options: [
   *       { title: '選択肢A', pros: ['◯ ...', '◯ ...'], cons: ['× ...'] },
   *       ...
   *     ] (3 件推奨、最大 4)
   *   }
   */
  const atoms = require('../atoms');
  function renderCompare7ProsCons(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const options = Array.isArray(slideJson.options) ? slideJson.options.slice(0, 4) : [];
    if (options.length === 0) return;
    const topY = L.contentY + 0.05;
    const totalH = L.contentBot - topY;
    const gap = 0.20;
    const colW = (10 - L.marginX * 2 - gap * (options.length - 1)) / options.length;
    options.forEach((opt, i) => {
      const x = L.marginX + i * (colW + gap);
      // カード
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: topY, w: colW, h: totalH, rectRadius: L.cardRadius,
        fill: { color: C.white }, line: { color: C.gray200, width: L.lineWidth },
      });
      // タイトル帯
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: topY, w: colW, h: 0.40,
        fill: { color: C.ink }, line: { type: 'none' },
      });
      slide.addText(opt.title || `選択肢 ${i + 1}`, {
        x, y: topY, w: colW, h: 0.40,
        fontSize: 14, color: C.white, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
      // Pros セクション
      const pros = Array.isArray(opt.pros) ? opt.pros.slice(0, 4) : [];
      const cons = Array.isArray(opt.cons) ? opt.cons.slice(0, 4) : [];
      const sectionH = (totalH - 0.40 - 0.30) / 2;
      const prosY = topY + 0.50;
      const consY = prosY + sectionH + 0.10;
      // Pros header
      slide.addText('Pros (◯)', {
        x: x + 0.14, y: prosY, w: colW - 0.28, h: 0.24,
        fontSize: 10, color: C.brand, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      pros.forEach((p, j) => {
        const py = prosY + 0.28 + j * 0.30;
        slide.addText('◯ ' + p, {
          x: x + 0.14, y: py, w: colW - 0.28, h: 0.28,
          fontSize: 10.5, color: C.gray700, fontFace: F.jp,
          align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 1.30,
        });
      });
      // Cons header
      slide.addText('Cons (×)', {
        x: x + 0.14, y: consY, w: colW - 0.28, h: 0.24,
        fontSize: 10, color: C.gray500, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      cons.forEach((c, j) => {
        const cy = consY + 0.28 + j * 0.30;
        slide.addText('× ' + c, {
          x: x + 0.14, y: cy, w: colW - 0.28, h: 0.28,
          fontSize: 10.5, color: C.gray700, fontFace: F.jp,
          align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 1.30,
        });
      });
    });
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'COMPARE-7（3 選択肢 Pros/Cons 並列）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCompare7ProsCons };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'COMPARE-1': renderCompare1BeforeAfter,
  'COMPARE-2': renderCompare2BeforeAfterCompact,
  'COMPARE-3': renderCompare3Icon,
  'COMPARE-4': renderCompare4Tradeoff,
  'COMPARE-5': renderCompare5Grouped,
  'COMPARE-6': renderCompare6Detail,
  'COMPARE-7': renderCompare7ProsCons,  // v11.6: Pros/Cons 並列
};
