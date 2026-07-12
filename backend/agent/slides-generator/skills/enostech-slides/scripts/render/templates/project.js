'use strict';

// =============================================================
// templates/project.js
// -------------------------------------------------------------
// Consolidated from templates/project/*.js.
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

// ─── project-1-phase-flow.js ─────────────────────────────────────
const { renderProject1PhaseFlow } = (function () {
  /**
   * PROJECT-1 フェーズフロー (Category C: PROJECT)
   * ===========================================
   * 4 フェーズを横並びカードで表示。各カード: 黒ヘッダ + タイトル + 本文 + アウトプット + 時期ピル。
   * 期待 JSON: { phases: [{ name, title, body, output, time }] } (4 件推奨、最大 5)
   *
   * 動的フォントサイズ対応
   *   - phases 数 (3/4/5) と body 文字数で fontSize を 11.5 → 10 → 9 に自動縮小
   *   - title / output / name も同様に列幅と文字数で動的調整
   *   - 推奨上限を超えると console.warn で model に警告 (本文 60字 / output 30字)
   *   - 5 列構成では本文が短くないと潰れる: 推奨は title 12字以内 / body 50字以内
   */


  const atoms = require('../atoms');
  function pickPhaseTitleFontSize(text, colCount) {
    const len = (text || '').length;
    if (colCount >= 5) {
      if (len <= 8) return 12;
      if (len <= 12) return 11;
      return 10;
    }
    if (colCount >= 4) {
      if (len <= 10) return 13;
      if (len <= 14) return 12;
      return 11;
    }
    return len <= 14 ? 14 : 12;
  }
  function pickPhaseBodyFontSize(text, colCount) {
    const len = (text || '').length;
    if (colCount >= 5) {
      if (len <= 35) return 10.5;
      if (len <= 50) return 9.5;
      return 9.5;  // v11.3: 9.5pt 死守
    }
    if (colCount >= 4) {
      if (len <= 50) return 10.5;
      if (len <= 75) return 9.5;
      return 9.5;  // v11.3: 9.5pt 死守
    }
    if (len <= 80) return 11;
    if (len <= 120) return 10;
    return 9;
  }
  function pickPhaseOutputFontSize(text, colCount) {
    const len = (text || '').length;
    if (colCount >= 5) {
      if (len <= 12) return 10;
      if (len <= 18) return 9;
      return 8;
    }
    if (colCount >= 4) {
      if (len <= 18) return 10;
      if (len <= 25) return 9;
      return 8;
    }
    return len <= 25 ? 11 : 10;
  }

  function renderProject1PhaseFlow(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const phases = Array.isArray(slideJson.phases) ? slideJson.phases : [];
    if (phases.length === 0) return;
    const N = phases.length;
    phases.forEach((p, i) => {
      const titleMax = N >= 5 ? 12 : N >= 4 ? 16 : 20;
      const bodyMax = N >= 5 ? 50 : N >= 4 ? 80 : 120;
      const outputMax = N >= 5 ? 18 : N >= 4 ? 25 : 30;
      if (p.title && p.title.length > titleMax) {
        console.warn(`[PROJECT-1] slide ${slideJson.id || '?'} phases[${i}].title が ${p.title.length} 字 (列数 ${N}、推奨 ${titleMax} 字以内)。動的縮小は効くが見栄え劣化。`);
      }
      if (p.body && p.body.length > bodyMax) {
        console.warn(`[PROJECT-1] slide ${slideJson.id || '?'} phases[${i}].body が ${p.body.length} 字 (列数 ${N}、推奨 ${bodyMax} 字以内)。アウトプット領域に侵食する可能性。`);
      }
      if (p.output && p.output.length > outputMax) {
        console.warn(`[PROJECT-1] slide ${slideJson.id || '?'} phases[${i}].output が ${p.output.length} 字 (列数 ${N}、推奨 ${outputMax} 字以内)。`);
      }
    });
    const topY = L.contentY + 0.05;
    const gap = 0.16;
    const colW = (10 - L.marginX * 2 - gap * (N - 1)) / N;
    const cardH = L.contentBot - topY - 0.05;

    phases.forEach((p, i) => {
      const x = L.marginX + i * (colW + gap);

      // 統合カード
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: topY, w: colW, h: cardH, rectRadius: L.cardRadius,
        fill: { color: C.white }, line: { color: C.gray200, width: L.lineWidth },
      });
      // 黒ヘッダ帯（角丸対策で 2 重描画）
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: topY, w: colW, h: 0.42, rectRadius: L.cardRadius,
        fill: { color: C.ink }, line: { type: 'none' },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: topY + 0.21, w: colW, h: 0.21,
        fill: { color: C.ink }, line: { type: 'none' },
      });
      slide.addText(p.name || `フェーズ ${i + 1}`, {
        x, y: topY, w: colW, h: 0.42,
        fontSize: 13, color: C.white, fontFace: F.jp,
        bold: true, align: 'center', valign: 'middle', margin: 0,
      });
      // タイトル
      slide.addText(p.title || '', {
        x: x + 0.12, y: topY + 0.58, w: colW - 0.24, h: 0.32,
        fontSize: pickPhaseTitleFontSize(p.title, N), color: C.ink, fontFace: F.jp,
        bold: true, align: 'center', margin: 0,
      });
      // 本文
      slide.addText(p.body || '', {
        x: x + 0.15, y: topY + 0.96, w: colW - 0.3, h: 0.70,
        fontSize: pickPhaseBodyFontSize(p.body, N), color: C.gray700, fontFace: F.jp, margin: 0, valign: 'top',
        align: 'center', lineSpacingMultiple: L.lineSpacingMultiple,
      });
      // 区切り線 (極薄)
      slide.addShape(pres.shapes.LINE, {
        x: x + 0.15, y: topY + 1.74, w: colW - 0.3, h: 0,
        line: { color: C.gray200, width: L.lineWidth },
      });
      // アウトプット (70-25-5 — brand → gray700 で控えめに)
      if (p.output) {
        slide.addText('アウトプット', {
          x: x + 0.12, y: topY + 1.84, w: colW - 0.24, h: 0.22,
          fontSize: 9, color: C.gray700, fontFace: F.jp,
          bold: true, align: 'center', margin: 0, charSpacing: 0,
        });
        slide.addText(p.output, {
          x: x + 0.15, y: topY + 2.06, w: colW - 0.3, h: 0.58,
          fontSize: pickPhaseOutputFontSize(p.output, N), color: C.gray700, fontFace: F.jp,
          align: 'center', valign: 'top', margin: 0,
          lineSpacingMultiple: L.lineSpacingMultiple,
        });
      }
      // 時期ピル (全 phase が brand 色だと派手 → ink 統一)
      if (p.time) {
        const timePillY = topY + cardH - 0.48;
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: x + 0.20, y: timePillY, w: colW - 0.40, h: 0.32, rectRadius: 0.16,
          fill: { color: C.ink }, line: { type: 'none' },
        });
        slide.addText(p.time, {
          x: x + 0.20, y: timePillY, w: colW - 0.40, h: 0.32,
          fontSize: 10, color: C.white, fontFace: F.jp,
          bold: true, align: 'center', valign: 'middle', margin: 0,
        });
      }
    });

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'PROJECT-1（フェーズフロー）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderProject1PhaseFlow };
})();

// ─── project-2-schedule.js ───────────────────────────────────────
const { renderProject2Schedule } = (function () {
  /**
   * PROJECT-2 スケジュール (Category C: PROJECT)
   * =========================================
   * 簡易ガントチャート。月軸 + 行ごとのバー。
   * 期待 JSON:
   *   {
   *     months: ["4月", "5月", ..., "12月"],
   *     monthly_label?: "月額稼働費 ...",
   *     rows: [{ label, barStart, barSpan, barText, milestones?, phases? }]
   *   }
   */


  const atoms = require('../atoms');

  function renderProject2Schedule(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    const months = Array.isArray(slideJson.months) ? slideJson.months : ['Q1', 'Q2', 'Q3', 'Q4'];
    const rows = Array.isArray(slideJson.rows) ? slideJson.rows : [];

    const tableX = L.marginX;
    const tableY = L.contentY + 0.05;
    const tableW = 10 - L.marginX * 2;
    const labelW = 0.9;
    const monthW = (tableW - labelW) / months.length;

    // 月額帯 (オプション)
    if (slideJson.monthly_label) {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: tableX + labelW, y: tableY, w: tableW - labelW, h: 0.24,
        fill: { color: C.brand }, line: { type: 'none' },
      });
      slide.addText(slideJson.monthly_label, {
        x: tableX + labelW, y: tableY, w: tableW - labelW, h: 0.24,
        fontSize: 11, color: C.white, fontFace: F.jp,
        bold: true, align: 'center', valign: 'middle', margin: 0,
      });
    }

    const headY = tableY + (slideJson.monthly_label ? 0.28 : 0);
    const headH = 0.28;

    months.forEach((m, i) => {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: tableX + labelW + i * monthW, y: headY, w: monthW, h: headH,
        fill: { color: C.brandSoft }, line: { color: C.white, width: 0.25 },
      });
      slide.addText(m, {
        x: tableX + labelW + i * monthW, y: headY, w: monthW, h: headH,
        fontSize: 11, color: C.ink, fontFace: F.jp,
        bold: true, align: 'center', valign: 'middle', margin: 0,
      });
    });

    if (rows.length === 0) return;
    const rowsTop = headY + headH + 0.10;
    const rowH = (L.contentBot - rowsTop) / rows.length - 0.04;

    rows.forEach((r, i) => {
      const y = rowsTop + i * (rowH + 0.04);
      slide.addShape(pres.shapes.RECTANGLE, {
        x: tableX, y, w: labelW, h: rowH,
        fill: { color: C.ink }, line: { type: 'none' },
      });
      slide.addText(r.label || '', {
        x: tableX, y, w: labelW, h: rowH,
        fontSize: 11, color: C.white, fontFace: F.jp,
        bold: true, align: 'center', valign: 'middle', margin: 0,
      });
      months.forEach((_, j) => {
        slide.addShape(pres.shapes.RECTANGLE, {
          x: tableX + labelW + j * monthW, y, w: monthW, h: rowH,
          fill: { color: C.white }, line: { color: C.gray200, width: L.lineWidth },
        });
      });

      const barStart = r.barStart != null ? r.barStart : 0;
      const barSpan = r.barSpan != null ? r.barSpan : 1;
      const barX = tableX + labelW + barStart * monthW;
      const barW = barSpan * monthW;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: barX, y: y + 0.06, w: barW, h: rowH - 0.12,
        rectRadius: L.cardRadiusSmall,
        fill: { color: C.brandSoft }, line: { type: 'none' },
      });
      slide.addText(r.barText || '', {
        x: barX + 0.10, y: y + 0.08, w: barW - 0.20, h: 0.28,
        fontSize: 10, color: C.gray700, fontFace: F.jp,
        valign: 'top', margin: 0,
        lineSpacingMultiple: L.lineSpacingMultiple,
      });

      (r.milestones || []).forEach(m => {
        const pillW = 0.75;
        const mx = barX + barW * (m.at || 0.5) - pillW / 2;
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: mx, y: y + rowH - 0.46, w: pillW, h: 0.22, rectRadius: 0.04,
          fill: { color: C.accent }, line: { type: 'none' },
        });
        slide.addText(m.text || '', {
          x: mx, y: y + rowH - 0.46, w: pillW, h: 0.22,
          fontSize: 9.5, color: C.white, fontFace: F.jp,
          bold: true, align: 'center', valign: 'middle', margin: 0,
        });
      });
      (r.phases || []).forEach(p => {
        const pillW = 0.9;
        const px = barX + barW * (p.at || 0.5) - pillW / 2;
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: px, y: y + rowH - 0.22, w: pillW, h: 0.20, rectRadius: 0.08,
          fill: { color: C.ink }, line: { type: 'none' },
        });
        slide.addText(p.text || '', {
          x: px, y: y + rowH - 0.22, w: pillW, h: 0.20,
          fontSize: 9.5, color: C.white, fontFace: F.jp,
          bold: true, align: 'center', valign: 'middle', margin: 0,
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
        template: 'PROJECT-2（スケジュール）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderProject2Schedule };
})();

// ─── project-3-schedule-5track.js ────────────────────────────────
const { renderProject3Schedule5Track } = (function () {
  /**
   * PROJECT-3 スケジュール 5 トラック (Category C: PROJECT)
   * ====================================================
   * v11.8: 「実装は PROJECT-2 と共通だが用途を明示するための alias」として正当化。
   * 5 トラック前提でガントを組む時のテンプレ ID として PROJECT-3 を選択することで、
   * Phase 2 設計時の意図 (5 トラック使用) が plan.json から読み取れる。実装の差別化
   * (色帯付き等) は Phase γ 第 4 弾以降の課題。
   *
   * 期待 JSON: PROJECT-2 と同じ + rows 5 件
   */


  // PROJECT-2 と挙動は同じで、tracks 数 5 を許容するだけ。
  function renderProject3Schedule5Track(slide, slideJson, ctx) {
    // PROJECT-2 のそのままのレイアウトで動く（rows 数が増えるだけ）
    renderProject2Schedule(slide, slideJson, ctx);
  }
  return { renderProject3Schedule5Track };
})();

// ─── project-4-schedule-2tier.js ─────────────────────────────────
const { renderProject4Schedule2Tier } = (function () {
  /**
   * PROJECT-4 スケジュール 2 層トラック (Category C: PROJECT)
   * =====================================================
   * 親トラック (プロダクト) + 子トラック (設計/開発/テスト) の 2 層ガント。
   * 期待 JSON:
   *   {
   *     months: [...],
   *     groups: [
   *       { parent_label, children: [{ label, barStart, barSpan, barText }] }
   *     ]
   *   }
   */


  const atoms = require('../atoms');

  function renderProject4Schedule2Tier(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const months = Array.isArray(slideJson.months) ? slideJson.months : ['Q1', 'Q2', 'Q3', 'Q4'];
    const groups = Array.isArray(slideJson.groups) ? slideJson.groups : [];

    const tableX = L.marginX;
    const tableY = L.contentY + 0.05;
    const tableW = 10 - L.marginX * 2;
    const labelW = 1.4;
    const monthW = (tableW - labelW) / months.length;

    const headY = tableY;
    const headH = 0.32;
    months.forEach((m, i) => {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: tableX + labelW + i * monthW, y: headY, w: monthW, h: headH,
        fill: { color: C.brandSoft }, line: { color: C.white, width: L.lineWidth },
      });
      slide.addText(m, {
        x: tableX + labelW + i * monthW, y: headY, w: monthW, h: headH,
        fontSize: 10.5, color: C.ink, fontFace: F.jp,
        bold: true, align: 'center', valign: 'middle', margin: 0,
      });
    });

    let cy = headY + headH + 0.10;
    const totalRowsH = L.contentBot - cy - 0.10;
    const groupGap = 0.10;
    const totalChildren = groups.reduce((s, g) => s + (g.children ? g.children.length : 0), 0);
    const childRowH = totalChildren > 0 ? (totalRowsH - groupGap * groups.length) / totalChildren : 0.30;

    groups.forEach(g => {
      const children = Array.isArray(g.children) ? g.children : [];
      const groupH = childRowH * children.length;

      // 親ラベル (ink バー)
      slide.addShape(pres.shapes.RECTANGLE, {
        x: tableX, y: cy, w: labelW, h: groupH,
        fill: { color: C.ink }, line: { type: 'none' },
      });
      slide.addText(g.parent_label || '', {
        x: tableX, y: cy, w: labelW, h: groupH,
        fontSize: 11, color: C.white, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0, charSpacing: 0.5,
      });

      children.forEach((ch, i) => {
        const ry = cy + i * childRowH;

        // 子ラベル (gray50)
        slide.addShape(pres.shapes.RECTANGLE, {
          x: tableX + labelW, y: ry, w: 0.0, h: childRowH,  // 子ラベルは月セル前に出さず統合
          fill: { color: C.gray50 }, line: { type: 'none' },
        });

        months.forEach((_, j) => {
          slide.addShape(pres.shapes.RECTANGLE, {
            x: tableX + labelW + j * monthW, y: ry, w: monthW, h: childRowH,
            fill: { color: C.white }, line: { color: C.gray200, width: L.lineWidth },
          });
        });

        const barStart = ch.barStart != null ? ch.barStart : 0;
        const barSpan = ch.barSpan != null ? ch.barSpan : 1;
        const barX = tableX + labelW + barStart * monthW;
        const barW = barSpan * monthW;
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: barX + 0.02, y: ry + 0.05, w: barW - 0.04, h: childRowH - 0.10,
          rectRadius: L.cardRadiusSmall,
          fill: { color: C.brandSoft }, line: { type: 'none' },
        });
        slide.addText(`${ch.label || ''} ${ch.barText ? ' — ' + ch.barText : ''}`, {
          x: barX + 0.10, y: ry, w: barW - 0.20, h: childRowH,
          fontSize: 10, color: C.gray700, fontFace: F.jp,
          valign: 'middle', margin: 0,
        });
      });

      cy += groupH + groupGap;
    });

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'PROJECT-4（スケジュール 2 層）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderProject4Schedule2Tier };
})();


// ─── project-5-timeline.js (v11.7 新規 / Phase γ) ────────────────
const { renderProject5Timeline } = (function () {
  /**
   * PROJECT-5 マイルストーン年表 (v11.7 新規 / Category C: PROJECT)
   * ============================================================
   * 時系列に重要イベントを並列。DIAG-06 タイムライン ラッパー。
   * 期待 JSON: { events: [{ date, label, body? }] } (3-7 件)
   */
  const atoms = require('../atoms');
  const { drawDIAG06Timeline } = require('../diagrams/diag-06-timeline');
  function renderProject5Timeline(slide, slideJson, ctx) {
    const { L } = ctx;
    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const area = {
      x: L.marginX, y: L.contentY + 0.05,
      w: 10 - L.marginX * 2, h: L.contentBot - L.contentY - 0.10,
    };
    // template_id を DIAG-06 に書き換えて DIAG-06 へ
    drawDIAG06Timeline(slide, Object.assign({}, slideJson, { template_id: 'DIAG-06' }), area, ctx);
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'PROJECT-5（マイルストーン年表）',
        goal: slideJson.slide_goal.title || '', message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderProject5Timeline };
})();

// ─── project-6-kanban.js (v11.7 新規 / Phase γ) ──────────────────
const { renderProject6Kanban } = (function () {
  /**
   * PROJECT-6 カンバン風 3 カラム (v11.7 新規)
   * ============================================
   * Todo / Doing / Done の 3 カラムに付箋カードを並べる。
   * 期待 JSON: { todo: [], doing: [], done: [] } (各カラム 2-5 件)
   */
  const atoms = require('../atoms');
  function renderProject6Kanban(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const cols = [
      { key: 'todo',  label: '未着手 (Todo)',  items: Array.isArray(slideJson.todo)  ? slideJson.todo  : [], color: C.gray400 },
      { key: 'doing', label: '進行中 (Doing)', items: Array.isArray(slideJson.doing) ? slideJson.doing : [], color: C.brand },
      { key: 'done',  label: '完了 (Done)',    items: Array.isArray(slideJson.done)  ? slideJson.done  : [], color: C.accent },
    ];
    const topY = L.contentY + 0.05;
    const totalH = L.contentBot - topY;
    const gap = 0.18;
    const colW = (10 - L.marginX * 2 - gap * 2) / 3;
    cols.forEach((col, i) => {
      const x = L.marginX + i * (colW + gap);
      // カラム背景
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: topY, w: colW, h: totalH, rectRadius: L.cardRadius,
        fill: { color: C.gray50 }, line: { color: C.gray200, width: L.lineWidth },
      });
      // ヘッダ
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: topY, w: colW, h: 0.36,
        fill: { color: col.color }, line: { type: 'none' },
      });
      slide.addText(col.label, {
        x, y: topY, w: colW, h: 0.36,
        fontSize: 12, color: C.white, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
      // カード
      const cardItems = col.items.slice(0, 5);
      const cardArea = totalH - 0.50;
      const cardH = Math.min(0.70, (cardArea - 0.10 * (cardItems.length - 1)) / Math.max(1, cardItems.length));
      cardItems.forEach((item, j) => {
        const cy = topY + 0.46 + j * (cardH + 0.10);
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: x + 0.10, y: cy, w: colW - 0.20, h: cardH, rectRadius: 0.05,
          fill: { color: C.white }, line: { color: col.color, width: 0.5 },
        });
        slide.addText(typeof item === 'string' ? item : (item.text || ''), {
          x: x + 0.20, y: cy, w: colW - 0.40, h: cardH,
          fontSize: 10.5, color: C.ink, fontFace: F.jp,
          align: 'left', valign: 'middle', margin: 0, lineSpacingMultiple: 1.30,
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
        template: 'PROJECT-6（カンバン風）',
        goal: slideJson.slide_goal.title || '', message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderProject6Kanban };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'PROJECT-1': renderProject1PhaseFlow,
  'PROJECT-2': renderProject2Schedule,
  'PROJECT-3': renderProject3Schedule5Track,
  'PROJECT-4': renderProject4Schedule2Tier,
  'PROJECT-5': renderProject5Timeline,  // v11.7: マイルストーン年表
  'PROJECT-6': renderProject6Kanban,    // v11.7: カンバン風
};
