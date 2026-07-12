'use strict';

// =============================================================
// templates/qa.js
// -------------------------------------------------------------
// 序盤の固定枠 (header[]) の 5 枚目に挿入される「解決したい疑問・懸念」の早見表。
//
// 構造的に framing カテゴリと近いが、QA 駆動モード (opt-in) でのみ
// 使う特殊枠なので独立カテゴリ qa として切り出した。
// 今後 QA-DETAIL / QA-MATRIX 等の派生テンプレが増える可能性があるため。
// =============================================================

// ─── qa-index.js ─────────────────────────────────────────────
const { renderQAIndex } = (function () {
  /**
   * QA-INDEX 解決したい疑問・懸念の早見表 (Category Q: QA)
   * ===================================================
   * 序盤の固定枠 5 枚目に配置する 1 問 1 答インデックス。
   *
   * 期待 JSON 構造:
   *   {
   *     id: "S5",
   *     template_id: "QA-INDEX",
   *     title: "解決したい疑問・懸念",
   *     subtitle: "このデッキを読み終えると、5 つの疑問が解消されます",
   *     section_id: "intro",
   *     // questions 自体は doc.questions[] を参照する (重複定義を避ける)
   *     // ただし表示用に各 Q の section ラベルを上書きしたい場合は
   *     // questions_overrides を持つことができる:
   *     // questions_overrides: [{ id: "Q1", sectionLabel: "2 章" }, ...]
   *   }
   *
   * 必須フィールド: title (default あり)
   * doc.questions[] の件数 N (StructQA-50 で 2-15 を強制) に応じて
   * 行高 / フォントサイズが自動調整される。
   */

  const atoms = require('../atoms');

  /**
   * Q.sectionIndex から表示用の章ラベルを導出する。
   *
   * 優先順位:
   *   1. ctx.bodyChapterNumMap で section id (例: "ch2") を直接解決 → "2 章" (確実)
   *   2. ctx.sectionsMap + deckSections で章名フォールバック取得 → "ch1: 抵抗" 等 (id が見つかる)
   *   3. 正規表現で "body.chN" / "chN" / "ch.N" から章番号抽出 → "N 章"
   *   4. その他の id (短ければそのまま、長ければ省略)
   *
   * 例:
   *   ["body.ch2"] + ctx.bodyChapterNumMap = {ch1:1, ch2:2, ...} → "2 章"
   *   ["ch3"]     + 未登録                                       → "3 章" (regex)
   *   ["intro-section"] + 未登録                                  → "intro-section"
   */
  function deriveSectionLabel(sectionIndex, ctx) {
    if (!Array.isArray(sectionIndex) || sectionIndex.length === 0) return '—';
    const first = sectionIndex[0];
    if (typeof first !== 'string') return '—';

    // (1) ctx.bodyChapterNumMap で直接解決 (推奨経路)
    // "body.ch2" / "chapters.ch2" → "ch2" に正規化してから引く
    const cleaned = first
      .replace(/^body\./, '')
      .replace(/^chapters?\./, '');
    if (ctx) {
      const num = (ctx.bodyChapterNumMap || {})[cleaned];
      if (num) return `${num} 章`;
    }

    // (2) 正規表現フォールバック: "body.chN" / "chapter-N" / "ch.N" から数字抽出
    let m = first.match(/(?:^|[.\-_])ch(?:apter)?[.\-_]?(\d+)/i);
    if (m) return `${m[1]} 章`;
    m = first.match(/^ch(\d+)/i);
    if (m) return `${m[1]} 章`;

    // (3) その他の id: 12 字超は省略
    return first.length > 12 ? first.slice(0, 12) + '…' : first;
  }

  /**
   * 件数 N に応じてレイアウトプリセットを返す。
   * 行高 / フォントサイズを N で auto-fit。
   */
  function getLayoutPreset(n, availH) {
    // header 行 0.34" 固定 + データ行 N 行で残りを等分
    const headerH = 0.34;
    const rowH = Math.max(0.20, (availH - headerH) / Math.max(1, n));

    let bodyFs, headerFs;
    if (n <= 5)       { bodyFs = 12; headerFs = 11; }
    else if (n <= 8)  { bodyFs = 11; headerFs = 11; }
    else if (n <= 12) { bodyFs = 10; headerFs = 10; }
    else              { bodyFs = 9.5;  headerFs = 10; }  // v11.3: 9pt → 9.5pt 死守

    return { headerH, rowH, bodyFs, headerFs };
  }

  /**
   * doc.questions[] を resolve して表示用の rows を組み立てる。
   * 各 row: { qid, qtext, shortSummary, sectionLabel }
   */
  function buildRows(ctx, slideJson) {
    const doc = (ctx && ctx.doc) || {};
    const questions = Array.isArray(doc.questions) ? doc.questions : [];

    // overrides マップ
    const overrides = {};
    if (Array.isArray(slideJson.questions_overrides)) {
      for (const o of slideJson.questions_overrides) {
        if (o && typeof o.id === 'string') overrides[o.id] = o;
      }
    }

    return questions.map((q) => {
      const ov = overrides[q.id] || {};
      return {
        qid: q.id || '?',
        qtext: q.text || '',
        shortSummary: q.shortSummary || '(Phase 2 で確定)',
        sectionLabel: ov.sectionLabel || deriveSectionLabel(q.sectionIndex, ctx),
      };
    });
  }

  function renderQAIndex(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);

    const rows = buildRows(ctx, slideJson);
    const n = rows.length;

    // タイトル + サブコピー
    const subtitle = slideJson.subtitle ||
      (n > 0 ? `このデッキを読み終えると、${n} つの疑問が解消されます` : '');
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || '解決したい疑問・懸念',
      subtitle,
    );

    // 表領域 (タイトル直下から contentBot まで)
    const tableX = L.marginX;
    const tableW = 10 - L.marginX * 2;     // = 9.2 (marginX 0.4 想定)
    const tableY = (typeof titleBottomY === 'number' ? titleBottomY : L.contentY) + 0.04;
    const availH = (L.contentBot || 5.15) - tableY;

    const preset = getLayoutPreset(n, availH);

    // 列幅配分: [Q番号 | 疑問・懸念 | 短い答え | 該当章] = [0.6, 4.0, 3.5, 1.1] = 9.2
    const colWs = [0.6, 4.0, 3.5, 1.1];
    // tableW != 9.2 の時は等比スケール
    const totalCol = colWs.reduce((a, b) => a + b, 0);
    const scaledColWs = colWs.map(w => w * tableW / totalCol);

    // ── header 行 ──
    let curY = tableY;
    drawHeaderRow(slide, pres, tableX, curY, scaledColWs, preset.headerH, preset.headerFs, C, F);
    // header 下のアンバー強調罫 (1.5pt)
    slide.addShape(pres.shapes.LINE, {
      x: tableX, y: curY + preset.headerH,
      w: tableW, h: 0,
      line: { color: C.brand, width: 1.5 },
    });
    curY += preset.headerH;

    // ── データ行 ──
    for (let i = 0; i < n; i++) {
      const row = rows[i];
      const isZebra = (i % 2 === 1);
      drawDataRow(slide, pres, tableX, curY, scaledColWs, preset.rowH, preset.bodyFs, row, isZebra, C, F);
      curY += preset.rowH;
    }

    // 表の下罫線 (gray300, 0.5pt)
    slide.addShape(pres.shapes.LINE, {
      x: tableX, y: curY,
      w: tableW, h: 0,
      line: { color: C.gray300, width: 0.5 },
    });

    // Chrome (ナビ)
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    // Speaker notes
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, {
        slideJson,
        template: 'QA-INDEX (解決したい疑問・懸念の早見表)',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || subtitle,
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }

  // ───────── helper: header 行を描く ─────────
  function drawHeaderRow(slide, pres, x, y, colWs, h, fs, C, F) {
    let cx = x;
    const headers = ['#', '疑問・懸念', '答え', '該当章'];
    const aligns  = ['center', 'left', 'left', 'center'];
    const totalW = colWs.reduce((a, b) => a + b, 0);

    // 背景: ink (slate-800 系)
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: totalW, h,
      fill: { color: C.ink },
      line: { type: 'none' },
    });

    for (let i = 0; i < colWs.length; i++) {
      slide.addText(headers[i], {
        x: cx + 0.10, y: y, w: colWs[i] - 0.20, h,
        fontSize: fs, color: C.white, fontFace: F.jp, bold: true,
        align: aligns[i], valign: 'middle', margin: 0,
      });
      cx += colWs[i];
    }
  }

  // ───────── helper: データ行を描く ─────────
  function drawDataRow(slide, pres, x, y, colWs, h, fs, row, isZebra, C, F) {
    const totalW = colWs.reduce((a, b) => a + b, 0);

    // zebra 背景 (奇数行)
    if (isZebra) {
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y, w: totalW, h,
        fill: { color: C.gray50 },
        line: { type: 'none' },
      });
    }

    // 行下罫線
    slide.addShape(pres.shapes.LINE, {
      x, y: y + h, w: totalW, h: 0,
      line: { color: C.gray200, width: 0.25 },
    });

    let cx = x;
    // [0] Q番号 (太字 ink)
    slide.addText(row.qid, {
      x: cx + 0.06, y: y, w: colWs[0] - 0.12, h,
      fontSize: fs, color: C.ink, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });
    cx += colWs[0];

    // [1] 疑問・懸念 (本文)
    slide.addText(row.qtext, {
      x: cx + 0.10, y: y, w: colWs[1] - 0.20, h,
      fontSize: fs, color: C.ink, fontFace: F.jp,
      align: 'left', valign: 'middle', margin: 0,
      lineSpacingMultiple: 1.20,
      shrinkText: true,
    });
    cx += colWs[1];

    // [2] 短い答え (灰色寄り)
    slide.addText(row.shortSummary, {
      x: cx + 0.10, y: y, w: colWs[2] - 0.20, h,
      fontSize: fs, color: C.gray700, fontFace: F.jp,
      align: 'left', valign: 'middle', margin: 0,
      lineSpacingMultiple: 1.20,
      shrinkText: true,
    });
    cx += colWs[2];

    // [3] 該当章 (ピル風)
    slide.addText(row.sectionLabel, {
      x: cx + 0.06, y: y, w: colWs[3] - 0.12, h,
      fontSize: Math.max(8, fs - 1), color: C.gray700, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });
  }

  return { renderQAIndex };
})();

// ─── index.js (registry export) ──────────────────────────────

module.exports.registry = {
  'QA-INDEX': renderQAIndex,
};
