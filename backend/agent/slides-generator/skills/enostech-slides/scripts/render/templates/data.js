'use strict';

// =============================================================
// templates/data.js
// -------------------------------------------------------------
// Consolidated from templates/data/*.js.
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

// ─── data-1-keyvalue.js ──────────────────────────────────────────
const { renderData1KeyValueTable } = (function () {
  /**
   * DATA-1 項目-値テーブル (Category C: PROJECT)
   * ============================================
   * 定型情報の整理 (目的・内容・期間・予算など)。ラベル(左) + 値(右) の縦並び。
   * 期待 JSON: { rows: [{ label, value }] } (3-6 件推奨)
   */


  const atoms = require('../atoms');

  function renderData1KeyValueTable(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const rows = Array.isArray(slideJson.rows) ? slideJson.rows : [];
    if (rows.length === 0) return;

    const tableX = L.marginX + 0.1;
    const tableW = 9.0;
    const tableTop = L.contentY + 0.1;
    const availH = L.contentBot - tableTop - 0.1;
    const rowH = Math.min(0.85, availH / rows.length);
    slide.addShape(pres.shapes.LINE, {
      x: tableX, y: tableTop, w: tableW, h: 0,
      line: { color: C.gray700, width: 1.0 },
    });

    rows.forEach((r, i) => {
      const y = tableTop + i * rowH;
      const label = (Array.isArray(r) ? r[0] : (r && r.label)) || '';
      const value = (Array.isArray(r) ? r[1] : (r && r.value)) || '';
      slide.addShape(pres.shapes.RECTANGLE, {
        x: tableX, y, w: 1.9, h: rowH,
        fill: { color: C.gray50 }, line: { type: 'none' },
      });
      slide.addText(label, {
        x: tableX, y, w: 1.9, h: rowH,
        fontSize: 13, color: C.ink, fontFace: F.jp,
        bold: true, align: 'center', valign: 'middle', margin: 0,
      });
      slide.addText(value, {
        x: tableX + 2.1, y, w: tableW - 2.2, h: rowH,
        fontSize: 12, fontFace: F.jp, valign: 'middle', margin: 0,
        color: C.gray700,
        lineSpacingMultiple: L.lineSpacingMultiple,
      });
      if (i < rows.length - 1) {
        slide.addShape(pres.shapes.LINE, {
          x: tableX, y: y + rowH, w: tableW, h: 0,
          line: { color: C.gray200, width: L.lineWidth },
        });
      }
    });

    // 下罫
    slide.addShape(pres.shapes.LINE, {
      x: tableX, y: tableTop + rows.length * rowH, w: tableW, h: 0,
      line: { color: C.gray700, width: 1.0 },
    });

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'DATA-1（項目-値テーブル）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderData1KeyValueTable };
})();

// ─── data-2-table.js ─────────────────────────────────────────────
const { renderData2Table } = (function () {
  /**
   * DATA-2 データテーブル (Category H: DATA / REFERENCE)
   * ====================================================
   * 複数列×複数行の表。pptxgenjs の addTable を使用。
   * 期待 JSON:
   *   {
   *     headers: ["列1", "列2", "列3"],
   *     rows: [["A1", "B1", "C1"], ["A2", "B2", "C2"], ...],
   *     col_widths?: [1.6, 3.5, 4.1]
   *   }
   */


  const atoms = require('../atoms');

  function renderData2Table(slide, slideJson, ctx) {
    const { L, C, F } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const headers = Array.isArray(slideJson.headers) ? slideJson.headers : [];
    const rows = Array.isArray(slideJson.rows) ? slideJson.rows : [];
    if (headers.length === 0 || rows.length === 0) return;

    const colCount = headers.length;
    const tableW = 10 - L.marginX * 2;
    const colW = Array.isArray(slideJson.col_widths) && slideJson.col_widths.length === colCount
      ? slideJson.col_widths
      : Array(colCount).fill(tableW / colCount);
    //   旧: font 固定 (header 13 / label 12.5 / body 12) で、長文セルがあると行が
    //       auto-expand してテーブル末尾が contentBot を超えてはみ出していた
    //   新: 行数 (header 含む) に応じて 4 段階のサイズプリセットで縮小
    const totalRows = rows.length + 1;
    let preset;
    if (totalRows <= 5) {
      preset = { headerFs: 13, labelFs: 12.5, bodyFs: 12, headerH: 0.52, rowH: 0.62 };
    } else if (totalRows <= 7) {
      preset = { headerFs: 12, labelFs: 11.5, bodyFs: 11, headerH: 0.46, rowH: 0.50 };
    } else if (totalRows <= 9) {
      preset = { headerFs: 11, labelFs: 10.5, bodyFs: 10, headerH: 0.40, rowH: 0.42 };
    } else {
      preset = { headerFs: 10, labelFs: 9.5, bodyFs: 9.5, headerH: 0.36, rowH: 0.36 };
    }

    const headerRow = headers.map(h => ({
      text: String(h || ''),
      options: {
        fill: { color: C.ink }, color: C.white, bold: true,
        fontSize: preset.headerFs, align: 'center', valign: 'middle', fontFace: F.jp,
      },
    }));

    const bodyRows = rows.map((row, ri) => {
      return row.map((cell, ci) => {
        // 1 列目はラベル扱い (gray50 背景 + bold)
        if (ci === 0) {
          return {
            text: String(cell || ''),
            options: {
              fill: { color: C.gray50 }, bold: true,
              align: 'center', valign: 'middle',
              color: C.ink, fontSize: preset.labelFs, fontFace: F.jp,
            },
          };
        }
        // 2 列目以降は通常 (text run 配列も受ける)
        if (Array.isArray(cell)) {
          return { text: cell, options: { valign: 'middle', fontFace: F.jp, fontSize: preset.bodyFs } };
        }
        return {
          text: String(cell || ''),
          options: {
            color: C.gray700, fontSize: preset.bodyFs, valign: 'middle', fontFace: F.jp,
          },
        };
      });
    });

    // contentBot 内に収まるように rowH を最終調整
    const availH = L.contentBot - (L.contentY + 0.05) - preset.headerH;
    const finalRowH = Math.min(preset.rowH, availH / bodyRows.length);

    slide.addTable([headerRow, ...bodyRows], {
      x: L.marginX, y: L.contentY + 0.05, w: tableW,
      colW,
      rowH: [preset.headerH, ...bodyRows.map(() => finalRowH)],
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
        template: 'DATA-2（データテーブル）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderData2Table };
})();

// ─── data-3-number-graph.js ──────────────────────────────────────
const { renderData3NumberGraph } = (function () {
  /**
   * DATA-3 数字 + グラフ (Category H: DATA / REFERENCE)
   * ===================================================
   * 大きな金額・数値を強調しつつ内訳テーブルを並置。
   * 期待 JSON:
   *   {
   *     hero: { label, prefix?, value, unit, suffix? },     // 強調する数値
   *     breakdown: [{ label, sub?, value, value_color? }]   // 内訳行
   *   }
   */


  const atoms = require('../atoms');

  function renderData3NumberGraph(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    const hero = slideJson.hero || {};
    const budgetY = L.contentY + 0.05;
    const budgetH = 0.92;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: L.marginX, y: budgetY, w: 4.6, h: budgetH, rectRadius: L.cardRadius,
      fill: { color: C.gray50 }, line: { type: 'none' },
    });
    slide.addText(hero.label || '', {
      x: L.marginX + 0.22, y: budgetY, w: 1.05, h: budgetH,
      fontSize: 11, color: C.gray500, fontFace: F.jp,
      bold: false, align: 'left', valign: 'middle', margin: 0,
      charSpacing: 1,
    });
    slide.addText([
      { text: hero.prefix ? `${hero.prefix} ` : '', options: { color: C.gray700, fontSize: 12 } },
      { text: hero.value || '', options: { bold: true, color: C.accentDeep, fontSize: 42, charSpacing: -1 } },
      { text: `  ${hero.unit || ''}`, options: { color: C.gray700, fontSize: 13 } },
      { text: hero.suffix || '', options: { color: C.gray500, fontSize: 10 } },
    ], {
      x: L.marginX + 1.30, y: budgetY, w: 3.2, h: budgetH,
      fontFace: F.jp, valign: 'middle', margin: 0,
    });

    // 内訳テーブル
    const breakdown = Array.isArray(slideJson.breakdown) ? slideJson.breakdown : [];
    if (breakdown.length === 0) {
      if (slideJson.section_id) {
        atoms.addChromeWithNavById(ctx, slide, ctx.pageNum.value, slideJson.section_id, slideJson.subsection || null);
      } else {
        atoms.addChromeWithNav(ctx, slide, ctx.pageNum.value, 0, null);
      }
      return;
    }

    const tableData = [
      [
        { text: '項目', options: { fill: { color: C.gray100 }, bold: true, align: 'center', valign: 'middle', color: C.ink, fontSize: 12 } },
        { text: '金額',  options: { fill: { color: C.gray100 }, bold: true, align: 'center', valign: 'middle', color: C.ink, fontSize: 12 } },
      ],
      ...breakdown.map(b => [
        {
          text: [
            { text: (b.label || '') + '\n', options: { bold: true, color: C.ink, fontSize: 13 } },
            { text: b.sub || '',           options: { color: C.gray500, fontSize: 10 } },
          ],
          options: { valign: 'middle', fontFace: F.jp },
        },
        {
          text: [
            { text: b.prefix ? `${b.prefix} ` : '', options: { color: C.gray500, fontSize: 11 } },
            {
              text: b.value || '',
              options: { bold: true, color: b.value_color === 'accent' ? C.accentDeep : C.ink, fontSize: 24 },
            },
          ],
          options: { align: 'center', valign: 'middle', fontFace: F.jp },
        },
      ]),
    ];
    slide.addTable(tableData, {
      x: L.marginX, y: budgetY + budgetH + 0.22,
      w: 10 - L.marginX * 2,
      colW: [6.3, 2.9],
      rowH: [0.46, ...breakdown.map(() => 0.58)],
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
        template: 'DATA-3（数字+グラフ）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderData3NumberGraph };
})();

// ─── data-4-references.js ────────────────────────────────────────
const { renderData4References } = (function () {
  /**
   * DATA-4 参考情報集 / 長尺データテーブル (Category H: DATA / REFERENCE)
   * ===================================================================
   * デッキ末尾の固定枠。本編各スライドで埋めた inlineRef (1)(2)(3)... の参照先を一覧化。
   * 期待 JSON:
   *   { ref_table: [{ category, title, url?, source }] }
   *
   * SchemaQA-05 で ref_table 必須化。
   */


  const atoms = require('../atoms');


  function renderData4References(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || '本資料の主要な参考情報',
      slideJson.subtitle || '本文中の上付き番号で参照した一次資料を、このページに集約しています。',
    );

    const rows = Array.isArray(slideJson.ref_table) ? slideJson.ref_table : [];

    // ── 3 列テーブル: カテゴリ / タイトル / 出典・年 ──
    const x = L.marginX;
    const y = titleBottomY - 0.10;
    const w = 10 - L.marginX * 2;
    const colW = [1.8, 4.6, 2.8];

    const header = [
      { text: 'カテゴリ', options: { fill: { color: C.ink }, color: C.white, bold: true, fontSize: 11.5, align: 'center', valign: 'middle' } },
      { text: 'タイトル', options: { fill: { color: C.ink }, color: C.white, bold: true, fontSize: 11.5, align: 'left',   valign: 'middle' } },
      { text: '出典・年', options: { fill: { color: C.ink }, color: C.white, bold: true, fontSize: 11.5, align: 'left',   valign: 'middle' } },
    ];

    const bodyRows = rows.map(r => {
      const titleCell = r.url
        ? {
            text: [{
              text: r.title || '',
              options: {
                color: C.link,
                hyperlink: { url: r.url, tooltip: r.title || '' },
                underline: { style: 'sng' },
                fontSize: 11, fontFace: F.jp,
              },
            }],
            options: { valign: 'middle' },
          }
        : { text: r.title || '', options: { color: C.ink, fontSize: 11, valign: 'middle', fontFace: F.jp } };

      return [
        { text: r.category || '', options: { fill: { color: C.gray50 }, color: C.ink, bold: true, fontSize: 11, align: 'center', valign: 'middle' } },
        titleCell,
        { text: r.source || '', options: { color: C.gray700, fontSize: 10.5, valign: 'middle', fontFace: F.jp } },
      ];
    });

    if (bodyRows.length > 0) {
      slide.addTable([header, ...bodyRows], {
        x, y, w, colW,
        rowH: [0.36, ...bodyRows.map(() => 0.40)],
        border: { pt: 0.25, color: C.gray200 },
        fontFace: F.jp,
      });
    }

    if (slideJson.footnote || rows.length > 0) {
      atoms.addFootnote(
        ctx, slide,
        slideJson.footnote || '全てのソースは作成時点で確認済み。最新版が発表された場合はソースリンク先を参照してください。',
      );
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'DATA-4（参考情報集）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderData4References };
})();

// ─── data-5-glossary.js ──────────────────────────────────────────
const { renderData5Glossary } = (function () {
  /**
   * DATA-5 用語集 (Category H: DATA / REFERENCE)
   * ============================================
   * DATA-4 派生。「用語 / 読み / 説明」3 列構造。
   * 締めの固定枠中、参考情報集 (DATA-4) の直後・お土産 (FRAMING-4) の前に配置。
   * 用語が 0-2 件はスキップ、3 件以上で配置。
   *
   * 期待 JSON: { terms: [{ term, reading?, desc }] } (3-10 件)
   * SchemaQA-04 で 3-10 件必須。
   */


  const atoms = require('../atoms');

  function renderData5Glossary(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || '本資料に登場した専門用語',
      slideJson.subtitle || '聞き慣れない言葉や社内固有の略語を、読み方と一緒にまとめました。',
    );

    const rows = Array.isArray(slideJson.terms) ? slideJson.terms : [];
    if (rows.length === 0) return;

    const x = L.marginX;
    const y = L.contentY + 0.05;
    const w = 10 - L.marginX * 2;
    const colW = [2.0, 1.2, 5.8];

    const n = rows.length;
    const bodyFs = n <= 7 ? 11 : (n <= 9 ? 10 : 9.5);
    const termFs = n <= 7 ? 11.5 : (n <= 9 ? 10.5 : 10);
    const readFs = n <= 7 ? 9.5 : 9.5;

    const tableH = (L.contentBot ?? 5.15) - y - 0.55;
    const headerH = 0.34;
    const rowH = Math.max(0.30, (tableH - headerH) / n);

    const header = [
      { text: '用語', options: { fill: { color: C.ink }, color: C.white, bold: true, fontSize: 11, align: 'left', valign: 'middle' } },
      { text: '読み', options: { fill: { color: C.ink }, color: C.white, bold: true, fontSize: 11, align: 'left', valign: 'middle' } },
      { text: '説明', options: { fill: { color: C.ink }, color: C.white, bold: true, fontSize: 11, align: 'left', valign: 'middle' } },
    ];
    // brand 色は読みにくく、本文として読む列はインクで濃くする。
    const bodyRows = rows.map(r => [
      { text: r.term || '',           options: { color: C.ink, bold: true, fontSize: termFs, valign: 'middle', fontFace: F.jp } },
      { text: r.reading || '',         options: { color: C.gray500, italic: true, fontSize: readFs, valign: 'middle', fontFace: F.jp } },
      { text: r.desc || '',           options: { color: C.gray700, fontSize: bodyFs, valign: 'middle', fontFace: F.jp } },
    ]);
    slide.addTable([header, ...bodyRows], {
      x, y, w, colW,
      rowH: [headerH, ...bodyRows.map(() => rowH)],
      border: { pt: 0.25, color: C.gray200 },
      fontFace: F.jp,
    });

    atoms.addFootnote(
      ctx, slide,
      slideJson.footnote || '上記の用語が 3 件以上登場した時のみこのページを配置する（条件付き必須）。',
    );

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'DATA-5（用語集）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderData5Glossary };
})();

// ─── longtext-1-quote.js ─────────────────────────────────────────
const { renderLongtext1Quote } = (function () {
  /**
   * ============================================================
   * スライド主体だと取りこぼす「長文での豊かな情報量」を 1 枚で渡す枠。
   * GitHub README.md の重要節、白書の核となる段落、技術記事の本質的な
   * 1 ページなど、引用元の本文をそのまま読ませたい時に使う。LLM が自前で
   * 長めのパラグラフを生成して読者に伝える用途にも適する。
   *
   * 期待 JSON:
   *   {
   *     title:    string,                // スライドタイトル (24-36 字推奨)
   *     subtitle: string?,               // リード (60-200 字)
   *     eyebrow:  string?,               // 上部バッジ (例: "引用 / 一次情報")
   *     source:   {                      // 引用元情報 (任意)
   *       label:  string,                // 例: "rtk-ai/rtk README"
   *       url:    string?,               // ハイパーリンク
   *       author: string?,
   *       year:   string?,
   *     },
   *     paragraphs: [{                   // 1〜4 段落
   *       head: string?,                 // 段落見出し (短い、20 字以内)
   *       body: string,                  // 段落本文 (60-400 字)
   *     }],
   *   }
   *
   * レイアウト思想:
   *   - 「読み物として読ませる」のが目的なので、左にカラフルなアクセントは置かず、
   *     太い amber 縦罫 (引用記号代わり) + ink (slate-800) の本文という Editorial 寄り
   *   - 段落 head は太字 13pt、本文は 12pt 1.4 line-height で「ブログ的な可読性」
   *   - 出典は下部に小さく — 視線の流れを「タイトル → 本文 → 出典」に保つ
   */

  const atoms = require('../atoms');

  function renderLongtext1Quote(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx,
      slide,
      slideJson.title || '',
      slideJson.subtitle || '',
      { eyebrow: slideJson.eyebrow || undefined }
    );

    const paragraphs = Array.isArray(slideJson.paragraphs) ? slideJson.paragraphs : [];
    if (paragraphs.length === 0) {
      // 段落ゼロは schema で fatal だが、render の防御として早期 return
      return;
    }

    // 描画領域 (ENOSTECH レイアウト: 10 x 5.625)
    const startX = L.marginX + 0.10;
    const startY = L.contentY + 0.10;
    const fullW = 10 - L.marginX * 2 - 0.20;
    const bottomLimit = L.contentBot - 0.20;

    // 左の amber 縦罫 (引用バー、太め 0.06")
    const barX = startX;
    const barW = 0.06;
    const bodyX = startX + barW + 0.30;
    const bodyW = fullW - barW - 0.30;

    // 出典スペース確保用に、本文の下端を計算しながら配置
    let cursorY = startY + 0.05;

    paragraphs.forEach((p, i) => {
      const head = (p && p.head) || '';
      const body = (p && p.body) || '';
      // 段落見出し (任意)
      if (head) {
        slide.addText(head, {
          x: bodyX, y: cursorY, w: bodyW, h: 0.30,
          fontSize: 13, bold: true, color: C.brandDeep,
          fontFace: F.body || 'Noto Sans JP', align: 'left', valign: 'middle', margin: 0,
        });
        cursorY += 0.32;
      }
      // 段落本文
      // 字数で行高を概算 (12pt × 約 1.55 行ピッチ × 横 60-65 字/行 想定)
      const charsPerLine = Math.max(40, Math.floor(bodyW * 7.5)); // 経験則: 1 inch ≒ 7-8 字
      const estLines = Math.max(1, Math.ceil(body.length / charsPerLine));
      const lineH = 0.27;
      const blockH = Math.max(0.40, estLines * lineH + 0.10);
      slide.addText(body, {
        x: bodyX, y: cursorY, w: bodyW, h: blockH,
        fontSize: 12, color: C.ink, fontFace: F.body || 'Noto Sans JP',
        align: 'left', valign: 'top', margin: 0,
        paraSpaceAfter: 4, lineSpacingMultiple: 1.4,
        shrinkText: true,
      });
      cursorY += blockH + 0.18;

      // bottomLimit 超えたら以降の段落は描画スキップ (シュリンクは shrinkText 任せ)
      if (cursorY > bottomLimit - 0.40 && i < paragraphs.length - 1) {
        // 残りを 1 段落だけ書きとめる用に下端を残しておく
      }
    });

    // amber 縦罫を最終位置から逆算して描く (タイトルブロック直下から最後の段落下端まで)
    const barTop = startY;
    const barBottom = Math.min(cursorY - 0.10, bottomLimit - 0.50);
    if (barBottom > barTop + 0.20) {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: barX, y: barTop, w: barW, h: barBottom - barTop,
        fill: { color: C.brand }, line: { type: 'none' },
      });
    }

    // 出典フッタ (右下)
    const src = slideJson.source || null;
    if (src && (src.label || src.url || src.author || src.year)) {
      const srcParts = [];
      if (src.label) srcParts.push(src.label);
      const meta = [src.author, src.year].filter(Boolean).join(' / ');
      if (meta) srcParts.push(meta);
      const srcText = '出典: ' + srcParts.join(' — ');
      const srcY = bottomLimit - 0.35;
      // 左に細罫 (gray)
      slide.addShape(pres.shapes.LINE, {
        x: bodyX, y: srcY - 0.08, w: bodyW, h: 0,
        line: { color: C.gray300, width: 0.25 },
      });
      const srcOpts = {
        x: bodyX, y: srcY, w: bodyW - 0.10, h: 0.30,
        fontSize: 9.5, color: C.gray500,
        fontFace: F.body || 'Noto Sans JP', align: 'left', valign: 'top', margin: 0,
      };
      if (src.url) {
        srcOpts.hyperlink = { url: src.url, tooltip: src.label || src.url };
      }
      slide.addText(srcText, srcOpts);
    }

    // クローム
    const pageNum = ctx.pageNum.value;
    const sectionIdx = atoms.getSectionIdx(ctx, slideJson.section_id);
    atoms.addChromeFull(ctx, slide, pageNum, {
      withNav: true, sectionIdx, subsection: slideJson.subsection,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'LONGTEXT-1（引用パラグラフ主役）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderLongtext1Quote };
})();


// ─── data-7-timeline-log.js (v11.6 新規 / Phase γ) ────────────────
const { renderData7TimelineLog } = (function () {
  /**
   * DATA-7 タイムスタンプ付きログテーブル (v11.6 新規)
   * =================================================
   * 「時刻 + イベント + 詳細」3 列の時系列ログ。障害タイムライン、議事録、
   * リリース履歴等に。
   *
   * 期待 JSON:
   *   { entries: [{ time, event, detail?, severity?: 'info' | 'warn' | 'error' }] }
   */
  const atoms = require('../atoms');
  function renderData7TimelineLog(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const entries = Array.isArray(slideJson.entries) ? slideJson.entries.slice(0, 10) : [];
    if (entries.length === 0) return;
    const topY = L.contentY + 0.05;
    const totalH = L.contentBot - topY;
    const headerH = 0.34;
    const rowH = Math.min(0.50, (totalH - headerH) / entries.length);
    const tableX = L.marginX, tableW = 10 - L.marginX * 2;
    const timeW = 1.6, eventW = 2.8;
    const detailW = tableW - timeW - eventW;

    // ヘッダ
    slide.addShape(pres.shapes.RECTANGLE, {
      x: tableX, y: topY, w: tableW, h: headerH,
      fill: { color: C.ink }, line: { type: 'none' },
    });
    ['時刻', 'イベント', '詳細'].forEach((h, i) => {
      const w = [timeW, eventW, detailW][i];
      const x = tableX + (i === 0 ? 0 : i === 1 ? timeW : timeW + eventW);
      slide.addText(h, {
        x: x + 0.10, y: topY, w: w - 0.20, h: headerH,
        fontSize: 11, color: C.white, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
    });

    const sevColors = {
      info:  { bar: C.gray400, text: C.gray700 },
      warn:  { bar: C.accent, text: C.accentDeep },
      error: { bar: C.semanticDanger, text: C.semanticDanger },
    };
    entries.forEach((e, i) => {
      const y = topY + headerH + i * rowH;
      const sev = sevColors[e.severity || 'info'] || sevColors.info;
      // zebra
      if (i % 2 === 1) {
        slide.addShape(pres.shapes.RECTANGLE, {
          x: tableX, y, w: tableW, h: rowH,
          fill: { color: C.gray50 }, line: { type: 'none' },
        });
      }
      // 左に severity バー
      slide.addShape(pres.shapes.RECTANGLE, {
        x: tableX, y, w: 0.05, h: rowH,
        fill: { color: sev.bar }, line: { type: 'none' },
      });
      // 時刻
      slide.addText(e.time || '', {
        x: tableX + 0.15, y, w: timeW - 0.15, h: rowH,
        fontSize: 10.5, color: C.ink, fontFace: 'JetBrains Mono',
        align: 'left', valign: 'middle', margin: 0,
      });
      // イベント
      slide.addText(e.event || '', {
        x: tableX + timeW, y, w: eventW, h: rowH,
        fontSize: 11, color: sev.text, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      // 詳細
      slide.addText(e.detail || '', {
        x: tableX + timeW + eventW, y, w: detailW - 0.10, h: rowH,
        fontSize: 10.5, color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'middle', margin: 0, lineSpacingMultiple: 1.20,
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
        template: 'DATA-7（タイムスタンプ付きログ）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderData7TimelineLog };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'DATA-1': renderData1KeyValueTable,
  'DATA-2': renderData2Table,
  'DATA-3': renderData3NumberGraph,
  'DATA-4': renderData4References,
  'DATA-5': renderData5Glossary,
  'LONGTEXT-1': renderLongtext1Quote,
  'DATA-7': renderData7TimelineLog,  // v11.6: タイムスタンプログ
};
