'use strict';

// =============================================================
// templates/visual.js
// -------------------------------------------------------------
// Consolidated from templates/visual/*.js.
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

// ─── visual-1-profile.js ─────────────────────────────────────────
const { renderVisual1Profile } = (function () {
  /**
   * VISUAL-1 プロフィール (Category D: PITCH)
   * =======================================
   * 左: 顔写真 + 名前、右: 強みカード 3 枚、下: 取引先ロゴ帯。
   * 期待 JSON:
   *   {
   *     person: { name_kana, name, age?, photo_path? },
   *     strengths: [{ title, body }],   // 3 件推奨
   *     logos?: [{ label }]              // 4-5 件
   *   }
   */


  const atoms = require('../atoms');

  function renderVisual1Profile(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    const person = slideJson.person || {};
    const strengths = Array.isArray(slideJson.strengths) ? slideJson.strengths : [];
    const logos = Array.isArray(slideJson.logos) ? slideJson.logos : [];

    // 左: 顔写真 + 名前
    const lx = L.marginX, ly = L.contentY + 0.1;
    if (person.photo_path) {
      slide.addImage({
        path: person.photo_path,
        x: lx + 0.3, y: ly, w: 1.9, h: 2.1,
        sizing: { type: 'cover', w: 1.9, h: 2.1 },
      });
    } else {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: lx + 0.3, y: ly, w: 1.9, h: 2.1,
        fill: { color: C.gray100 },
        line: { color: C.gray300, width: 0.25, dashType: 'dash' },
      });
      slide.addText('[ 顔写真 ]', {
        x: lx + 0.3, y: ly, w: 1.9, h: 2.1,
        fontSize: 10, color: C.gray400, fontFace: F.jp,
        align: 'center', valign: 'middle', margin: 0,
      });
    }
    if (person.name_kana) {
      slide.addText(person.name_kana, {
        x: lx, y: ly + 2.2, w: 2.5, h: 0.22,
        fontSize: 10, color: C.gray500, fontFace: F.jp,
        align: 'center', margin: 0,
      });
    }
    slide.addText([
      { text: person.name || '', options: { bold: true, color: C.ink, fontSize: 17 } },
      { text: person.age ? `  （${person.age} 歳）` : '', options: { color: C.gray500, fontSize: 11 } },
    ], {
      x: lx, y: ly + 2.45, w: 2.5, h: 0.3,
      fontFace: F.jp, align: 'center', margin: 0,
    });

    // 右: 強みカード
    const rx = 3.3;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: rx, y: ly, w: 2.2, h: 0.28,
      fill: { color: C.ink }, line: { type: 'none' },
    });
    slide.addText('プロジェクトでの強み', {
      x: rx, y: ly, w: 2.2, h: 0.28,
      fontSize: 10, color: C.white, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
    strengths.slice(0, 3).forEach((st, i) => {
      const cardH = 0.72, cardGap = 0.12;
      const cy = ly + 0.4 + i * (cardH + cardGap);
      const badgeColor = C.brand;  // v11.4: 3 件並列は全 brand 統一 (旧 1/3=brand / 2=accent 不規則)
      const badgeD = 0.40;
      const textY = cy + 0.06;
      const textH = cardH - 0.12;
      const badgeY = cy + (cardH - badgeD) / 2;

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: rx, y: cy, w: 6.2, h: cardH, rectRadius: L.cardRadius,
        fill: { color: C.white }, line: { color: C.gray200, width: L.lineWidth },
      });
      slide.addShape(pres.shapes.OVAL, {
        x: rx + 0.20, y: badgeY, w: badgeD, h: badgeD,
        fill: { color: badgeColor }, line: { type: 'none' },
      });
      slide.addText(String(i + 1), {
        x: rx + 0.20, y: badgeY, w: badgeD, h: badgeD,
        fontSize: 14, color: C.white, fontFace: F.jp,
        bold: true, align: 'center', valign: 'middle', margin: 0,
      });
      slide.addText([
        { text: st.title || '', options: { fontSize: 11.5, bold: true, color: C.ink, breakLine: true } },
        { text: st.body || '', options: { fontSize: 9.5, color: C.gray700 } },
      ], {
        x: rx + 0.74, y: textY, w: 5.36, h: textH,
        fontFace: F.jp, valign: 'middle', margin: 0,
        lineSpacingMultiple: L.lineSpacingMultiple,
      });
    });

    // 取引先ロゴ帯
    if (logos.length > 0) {
      slide.addShape(pres.shapes.LINE, {
        x: L.marginX, y: 4.85, w: 10 - L.marginX * 2, h: 0,
        line: { color: C.gray200, width: L.lineWidth },
      });
      slide.addText(slideJson.logos_label || 'データ活用支援実績（抜粋）', {
        x: L.marginX, y: 4.93, w: 2, h: 0.22,
        fontSize: 9, color: C.gray500, fontFace: F.jp, margin: 0,
      });
      logos.slice(0, 5).forEach((l, i) => {
        const slotW = 1.35, gap = 0.1;
        const slotX = 2.55 + i * (slotW + gap);
        slide.addShape(pres.shapes.RECTANGLE, {
          x: slotX, y: 4.92, w: slotW, h: 0.3,
          fill: { color: C.gray100 },
          line: { color: C.gray300, width: L.lineWidth, dashType: 'dash' },
        });
        slide.addText(l.label || `Logo ${i + 1}`, {
          x: slotX, y: 4.92, w: slotW, h: 0.3,
          fontSize: 9, color: C.gray400, fontFace: F.jp,
          align: 'center', valign: 'middle', margin: 0,
        });
      });
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'VISUAL-1（プロフィール）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual1Profile };
})();

// ─── visual-10-svg-3step.js ──────────────────────────────────────
const { renderVisual10Svg3Step } = (function () {
  /**
   * VISUAL-10 横3コマSVG + ステップ説明 (Category P: VISUAL ハイブリッド)
   * ================================================================
   * 添付「はんだ付けは『温める→流す→離す』の3秒」型。
   * 3 つの「SVG + 番号 + タイトル + 本文」のカードを横並び + 下部にフッター帯。
   *
   * 期待 JSON:
   *   {
   *     title: "...",
   *     subtitle: "...",
   *     steps: [
   *       {
   *         badge: "1s",            // 上部小ラベル (任意)
   *         title: "温める",
   *         body: "コテ先で...",
   *         svg / svg_file / image_path: "...",  // カード内画像
   *         placeholder_label: "..."
   *       },
   *       ... (3 件固定)
   *     ],
   *     footer_note: {
   *       label: "NG",
   *       text: "温めずに..."
   *     }   // optional
   *   }
   */


  const atoms = require('../atoms');

  function renderVisual10Svg3Step(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
    );

    const steps = Array.isArray(slideJson.steps) ? slideJson.steps.slice(0, 3) : [];
    if (steps.length === 0) return;

    const footer = slideJson.footer_note;
    const startY = titleBottomY + 0.10;
    const endY = footer ? (L.contentBot - 0.50) : L.contentBot;
    const cardH = endY - startY;
    const cardGap = 0.16;
    const cardW = (10 - L.marginX * 2 - cardGap * (steps.length - 1)) / steps.length;

    steps.forEach((s, i) => {
      const cx = L.marginX + i * (cardW + cardGap);
      // 全体カード (border + 薄背景)
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: cx, y: startY, w: cardW, h: cardH, rectRadius: 0.08,
        fill: { color: C.gray50 }, line: { color: C.gray300, width: 0.25 },
      });

      const padX = 0.20;
      const innerX = cx + padX;
      const innerW = cardW - padX * 2;

      const badgeY = startY + 0.16;
      slide.addText(s.badge || `${i + 1}s`, {
        x: innerX, y: badgeY, w: innerW, h: 0.30,
        fontSize: 18, color: C.gray700, fontFace: F.jp, bold: true,
        align: 'left', valign: 'top', margin: 0,
      });
      // タイトル
      const titleY = badgeY + 0.34;
      slide.addText(s.title || '', {
        x: innerX, y: titleY, w: innerW, h: 0.36,
        fontSize: 16, color: C.ink, fontFace: F.jp, bold: true,
        align: 'left', valign: 'top', margin: 0,
      });
      // 本文 (3 行程度)
      const bodyY = titleY + 0.40;
      const bodyH = 0.80;
      slide.addText(s.body || '', {
        x: innerX, y: bodyY, w: innerW, h: bodyH,
        fontSize: 11, color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0,
        lineSpacingMultiple: 1.40,
      });
      // SVG / 画像領域 (下半分)
      const imgY = bodyY + bodyH + 0.10;
      const imgH = startY + cardH - imgY - 0.20;
      if (s.image_path) {
        slide.addImage({
          path: s.image_path,
          x: innerX, y: imgY, w: innerW, h: imgH,
          sizing: { type: 'contain', w: innerW, h: imgH },
        });
      } else {
        slide.addShape(pres.shapes.RECTANGLE, {
          x: innerX, y: imgY, w: innerW, h: imgH,
          fill: { color: C.canvas },
          line: { color: C.gray300, width: 0.25, dashType: 'dash' },
        });
        slide.addText(s.placeholder_label || '[ SVG ]', {
          x: innerX, y: imgY + imgH / 2 - 0.12, w: innerW, h: 0.24,
          fontSize: 10, color: C.gray400, fontFace: F.jp,
          align: 'center', valign: 'middle', italic: true, margin: 0,
        });
      }
    });

    // フッター帯
    if (footer) {
      const footerY = endY + 0.10;
      const footerH = 0.40;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: L.marginX, y: footerY, w: 0.05, h: footerH,
        fill: { color: C.brand }, line: { type: 'none' },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: L.marginX + 0.05, y: footerY, w: 10 - L.marginX * 2 - 0.05, h: footerH,
        fill: { color: C.gray50 }, line: { color: C.gray200, width: 0.4 },
      });
      slide.addText([
        { text: (footer.label || 'NG') + '  ——  ', options: { color: C.brand, bold: true } },
        { text: footer.text || '', options: { color: C.ink } },
      ], {
        x: L.marginX + 0.20, y: footerY, w: 10 - L.marginX * 2 - 0.30, h: footerH,
        fontSize: 11, fontFace: F.jp,
        align: 'left', valign: 'middle', margin: 0,
      });
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'VISUAL-10（横3コマSVG + ステップ）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual10Svg3Step };
})();

// ─── visual-11-svg-top-3card.js ──────────────────────────────────
const { renderVisual11SvgTop3Card } = (function () {
  /**
   * VISUAL-11 上SVG + 下3カード説明 (Category P: VISUAL ハイブリッド)
   * ============================================================
   * 添付「ブレッドボードで『壊さず試す』」型。上に大きな SVG、下に 3 枚の小カード。
   *
   * 期待 JSON:
   *   {
   *     title: "...",
   *     subtitle: "...",
   *     svg / svg_file / image_path: "...",   // 上の大ビジュアル
   *     placeholder_label: "...",
   *     cards: [
   *       { eyebrow: "+", title: "繰り返し試せる", body: "回路を何度でも組み直せる" },
   *       ... (3 件)
   *     ]
   *   }
   */


  const atoms = require('../atoms');

  function renderVisual11SvgTop3Card(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
    );

    const cards = Array.isArray(slideJson.cards) ? slideJson.cards.slice(0, 3) : [];
    const startY = titleBottomY + 0.10;
    const endY = L.contentBot;
    const totalH = endY - startY;

    // 上 SVG : 下 3 カード = 約 60% : 40%
    const svgH = totalH * 0.58;
    const cardsTop = startY + svgH + 0.16;
    const cardsH = endY - cardsTop;

    // ── 上: SVG / 画像領域 (フル幅) ──
    const w = 10 - L.marginX * 2;
    if (slideJson.image_path) {
      slide.addImage({
        path: slideJson.image_path,
        x: L.marginX, y: startY, w: w, h: svgH,
        sizing: { type: 'contain', w: w, h: svgH },
      });
    } else {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: L.marginX, y: startY, w: w, h: svgH,
        fill: { color: C.gray50 },
        line: { color: C.gray300, width: 0.25, dashType: 'dash' },
      });
      slide.addText(slideJson.placeholder_label || '[ SVG / 図 ]', {
        x: L.marginX, y: startY + svgH / 2 - 0.20, w: w, h: 0.40,
        fontSize: 12, color: C.gray400, fontFace: F.jp,
        align: 'center', valign: 'middle', italic: true, margin: 0,
      });
    }

    // ── 下: 3 カード ──
    if (cards.length === 0) return;
    const cardGap = 0.18;
    const cardW = (w - cardGap * (cards.length - 1)) / cards.length;
    cards.forEach((cd, i) => {
      const cx = L.marginX + i * (cardW + cardGap);
      // カード背景 (border-only)
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: cx, y: cardsTop, w: cardW, h: cardsH, rectRadius: 0.08,
        fill: { color: C.canvas }, line: { color: C.gray300, width: 0.25 },
      });
      const padX = 0.18;
      const innerX = cx + padX;
      const innerW = cardW - padX * 2;
      // eyebrow (任意、brand 色 +/+ などのマーク or 短いラベル)
      if (cd.eyebrow) {
        slide.addText(cd.eyebrow, {
          x: innerX, y: cardsTop + 0.10, w: innerW, h: 0.24,
          fontSize: 14, color: C.brand, fontFace: F.jp, bold: true,
          align: 'left', valign: 'top', margin: 0,
        });
      }
      // タイトル
      const titleFs = atoms.shrinkFontSize(cd.title || '', 13, 24, { minFs: 10 });
      slide.addText(cd.title || '', {
        x: innerX, y: cardsTop + 0.34, w: innerW, h: 0.30,
        fontSize: titleFs, color: C.ink, fontFace: F.jp, bold: true,
        align: 'left', valign: 'top', margin: 0,
      });
      // 本文
      slide.addText(cd.body || '', {
        x: innerX, y: cardsTop + 0.66, w: innerW, h: cardsH - 0.78,
        fontSize: 10.5, color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0,
        lineSpacingMultiple: 1.40,
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
        template: 'VISUAL-11（上SVG + 下3カード）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual11SvgTop3Card };
})();

// ─── visual-12-svg-pair.js ───────────────────────────────────────
const { renderVisual12SvgPair } = (function () {
  /**
   * VISUAL-12 左右SVG2連 + 下フッター注釈 (Category P: VISUAL ハイブリッド)
   * =================================================================
   * 添付「姿勢はIMU=加速度＋ジャイロで測る」型。
   * 左右に「eyebrow + タイトル + 本文 + SVG」のカードを 2 枚並べ、下にフッター注釈帯。
   *
   * 期待 JSON:
   *   {
   *     title: "...",
   *     subtitle: "...",
   *     panes: [
   *       {
   *         eyebrow: "SENSOR A",
   *         title: "加速度センサー",
   *         body: "重力ベクトルから...",
   *         svg / svg_file / image_path: "...",
   *         placeholder_label: "..."
   *       },
   *       { ... } (左右 2 件固定)
   *     ],
   *     footer_note: {
   *       label: "DEFACTO",
   *       text: "MPU-6050 (加速度3軸 + ..."
   *     }   // optional
   *   }
   */


  const atoms = require('../atoms');

  function renderVisual12SvgPair(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
    );

    const panes = Array.isArray(slideJson.panes) ? slideJson.panes.slice(0, 2) : [];
    if (panes.length === 0) return;
    const footer = slideJson.footer_note;
    const startY = titleBottomY + 0.10;
    const endY = footer ? (L.contentBot - 0.50) : L.contentBot;
    const paneH = endY - startY;
    const paneGap = 0.20;
    const paneW = (10 - L.marginX * 2 - paneGap) / 2;

    panes.forEach((p, i) => {
      const px = L.marginX + i * (paneW + paneGap);
      // ペイン背景 (border + 薄背景)
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: px, y: startY, w: paneW, h: paneH, rectRadius: 0.08,
        fill: { color: C.gray50 }, line: { color: C.gray300, width: 0.25 },
      });

      const padX = 0.26;
      const innerX = px + padX;
      const innerW = paneW - padX * 2;

      // eyebrow
      const eyebrowY = startY + 0.20;
      if (p.eyebrow) {
        slide.addText(p.eyebrow, {
          x: innerX, y: eyebrowY, w: innerW, h: 0.24,
          fontSize: 10, color: C.brand, fontFace: F.jp, bold: true,
          charSpacing: 1, align: 'left', valign: 'top', margin: 0,
        });
      }
      // タイトル
      const titleY = eyebrowY + 0.30;
      const titleFs = atoms.shrinkFontSize(p.title || '', 18, 28, { minFs: 14 });
      slide.addText(p.title || '', {
        x: innerX, y: titleY, w: innerW, h: 0.40,
        fontSize: titleFs, color: C.ink, fontFace: F.jp, bold: true,
        align: 'left', valign: 'top', margin: 0,
      });
      // 本文 (2-3 行)
      const bodyY = titleY + 0.46;
      const bodyH = 0.80;
      slide.addText(p.body || '', {
        x: innerX, y: bodyY, w: innerW, h: bodyH,
        fontSize: 11, color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0,
        lineSpacingMultiple: 1.40,
      });
      // SVG / 画像
      const imgY = bodyY + bodyH + 0.10;
      const imgH = startY + paneH - imgY - 0.20;
      if (p.image_path) {
        slide.addImage({
          path: p.image_path,
          x: innerX, y: imgY, w: innerW, h: imgH,
          sizing: { type: 'contain', w: innerW, h: imgH },
        });
      } else {
        slide.addShape(pres.shapes.RECTANGLE, {
          x: innerX, y: imgY, w: innerW, h: imgH,
          fill: { color: C.canvas },
          line: { color: C.gray300, width: 0.25, dashType: 'dash' },
        });
        slide.addText(p.placeholder_label || '[ SVG ]', {
          x: innerX, y: imgY + imgH / 2 - 0.12, w: innerW, h: 0.24,
          fontSize: 10, color: C.gray400, fontFace: F.jp,
          align: 'center', valign: 'middle', italic: true, margin: 0,
        });
      }
    });

    // フッター帯
    if (footer) {
      const footerY = endY + 0.10;
      const footerH = 0.40;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: L.marginX, y: footerY, w: 0.05, h: footerH,
        fill: { color: C.brand }, line: { type: 'none' },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: L.marginX + 0.05, y: footerY, w: 10 - L.marginX * 2 - 0.05, h: footerH,
        fill: { color: C.gray50 }, line: { color: C.gray200, width: 0.4 },
      });
      slide.addText([
        { text: (footer.label || 'NOTE') + '  ——  ', options: { color: C.brand, bold: true } },
        { text: footer.text || '', options: { color: C.ink } },
      ], {
        x: L.marginX + 0.20, y: footerY, w: 10 - L.marginX * 2 - 0.30, h: footerH,
        fontSize: 11, fontFace: F.jp,
        align: 'left', valign: 'middle', margin: 0,
      });
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'VISUAL-12（左右SVG2連 + フッター）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual12SvgPair };
})();

// ─── visual-2-evidence.js ────────────────────────────────────────
const { renderVisual2Evidence } = (function () {
  /**
   * VISUAL-2 エビデンス + 結論 (Category B: CONTENT)
   * ==============================================
   * 左に証拠 (グラフ風表) + 右に結論バナー。
   * 期待 JSON:
   *   {
   *     evidence: { label, items: [{ name, ratio, accent? }] },
   *     conclusion: { title, body, tone? }   // tone: 'amber' (default) | 'brand'
   *   }
   */


  const atoms = require('../atoms');

  function renderVisual2Evidence(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const evidence = slideJson.evidence || {};
    const items = Array.isArray(evidence.items) ? evidence.items : [];
    const conclusion = slideJson.conclusion || {};

    // 左: 帯グラフ風
    const lx = L.marginX;
    const ly = L.contentY + 0.10;
    const lw = 5.3;
    const lh = L.contentBot - ly - 0.10;

    if (evidence.label) {
      slide.addText(evidence.label, {
        x: lx, y: ly, w: lw, h: 0.30,
        fontSize: 11, color: C.gray500, fontFace: F.jp, bold: true,
        charSpacing: 2, align: 'left', valign: 'middle', margin: 0,
      });
    }

    if (items.length > 0) {
      const itemTop = ly + 0.40;
      const itemH = (lh - 0.40) / items.length - 0.06;
      items.forEach((it, i) => {
        const y = itemTop + i * (itemH + 0.06);
        slide.addText(it.name || '', {
          x: lx, y, w: 1.7, h: itemH,
          fontSize: 10.5, color: C.gray700, fontFace: F.jp,
          align: 'left', valign: 'middle', margin: 0,
        });
        const barX = lx + 1.8;
        const barW = lw - 1.8 - 0.5;
        const ratio = Math.max(0, Math.min(1, it.ratio || 0.5));
        slide.addShape(pres.shapes.RECTANGLE, {
          x: barX, y: y + itemH * 0.30, w: barW, h: itemH * 0.40,
          fill: { color: C.gray100 }, line: { type: 'none' },
        });
        slide.addShape(pres.shapes.RECTANGLE, {
          x: barX, y: y + itemH * 0.30, w: barW * ratio, h: itemH * 0.40,
          fill: { color: it.accent ? C.accent : C.brand }, line: { type: 'none' },
        });
        slide.addText(`${Math.round(ratio * 100)}%`, {
          x: lx + lw - 0.5, y, w: 0.5, h: itemH,
          fontSize: 11, color: C.ink, fontFace: F.jp, bold: true,
          align: 'right', valign: 'middle', margin: 0,
        });
      });
    }

    // 右: 結論
    const rx = lx + lw + 0.30;
    const rw = 10 - L.marginX - rx;
    const ry = ly + 0.40;
    const rh = lh - 0.40;
    const tone = conclusion.tone || 'amber';
    const bgColor = tone === 'brand' ? C.brandSoft : C.accentSoft;
    const textColor = tone === 'brand' ? C.brandDeep : C.accentDeep;
    //   旧: amberSoft / brandSoft の塗り潰し背景で野暮ったい印象になっていた
    //   新: white 背景 + 罫線 1.0pt + 左 amber バー (0.06") で品よく強調
    const accentStrokeColor = tone === 'brand' ? C.brand : C.accent;  // v11.8: F005 三項両分岐同一バグ修正
    const pad = L.cardPad;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: rx, y: ry, w: rw, h: rh, rectRadius: L.cardRadius,
      fill: { color: C.white }, line: { color: accentStrokeColor, width: 0.5 },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: rx, y: ry, w: 0.06, h: rh,
      fill: { color: accentStrokeColor }, line: { type: 'none' },
    });
    slide.addText('▼ 結論', {
      x: rx + pad, y: ry + 0.22, w: rw - pad * 2, h: 0.32,
      fontSize: 11, color: textColor, fontFace: F.jp, bold: true,
      charSpacing: 2, align: 'left', valign: 'middle', margin: 0,
    });
    slide.addText(conclusion.title || '', {
      x: rx + pad, y: ry + 0.58, w: rw - pad * 2, h: 0.92,
      fontSize: 16, color: C.ink, fontFace: F.jp, bold: true,
      align: 'left', valign: 'top', margin: 0,
      lineSpacingMultiple: L.lineSpacingMultiple,
    });
    slide.addText(conclusion.body || '', {
      x: rx + pad, y: ry + 1.58, w: rw - pad * 2, h: rh - 1.78,
      fontSize: 11, color: C.gray700, fontFace: F.jp,
      align: 'left', valign: 'top', margin: 0,
      lineSpacingMultiple: L.lineSpacingMultiple,
    });

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'VISUAL-2（エビデンス+結論）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual2Evidence };
})();

// ─── visual-3-visual.js ──────────────────────────────────────────
const { renderVisual3Visual } = (function () {
  /**
   * VISUAL-3 ビジュアル主体 (Category F: VISUAL)
   * ==========================================
   * 中央に大ビジュアル領域（画像 or プレースホルダー）。
   * 期待 JSON:
   *   {
   *     image_path?: "...",
   *     placeholder_label?: "...",
   *     caption?: "..."
   *   }
   */


  const atoms = require('../atoms');

  function renderVisual3Visual(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    // 中央大ビジュアル領域
    const vizX = L.marginX + 0.4;
    const vizY = L.contentY + 0.05;
    const vizW = 10 - L.marginX * 2 - 0.8;
    const vizH = L.contentBot - vizY - 0.05;

    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: vizX, y: vizY, w: vizW, h: vizH, rectRadius: L.cardRadius,
      fill: { color: C.gray50 }, line: { color: C.gray200, width: L.lineWidth },
    });

    if (slideJson.image_path) {
      slide.addImage({
        path: slideJson.image_path,
        x: vizX + 0.20, y: vizY + 0.20,
        w: vizW - 0.40, h: vizH - 0.40,
        sizing: { type: 'contain', w: vizW - 0.40, h: vizH - 0.40 },
      });
    } else {
      slide.addText(
        slideJson.placeholder_label || '（ビジュアルをここに配置）',
        {
          x: vizX + 0.40, y: vizY + vizH / 2 - 0.30, w: vizW - 0.80, h: 0.60,
          fontSize: 13, color: C.gray500, fontFace: F.jp,
          italic: true, align: 'center', valign: 'middle', margin: 0,
        },
      );
    }

    // キャプション (画像下部に薄く)
    if (slideJson.caption) {
      slide.addText(slideJson.caption, {
        x: vizX + 0.50, y: vizY + vizH - 0.40, w: vizW - 1.00, h: 0.30,
        fontSize: 9.5, color: C.gray500, fontFace: F.jp,
        align: 'left', valign: 'middle', margin: 0,
        lineSpacingMultiple: L.lineSpacingMultiple,
      });
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'VISUAL-3（ビジュアル主体）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual3Visual };
})();

// ─── visual-4-image-card-2x2.js ──────────────────────────────────
const { renderVisual4ImageCard2x2 } = (function () {
  /**
   * VISUAL-4 イメージカード 2×2 (Category F: VISUAL)
   * =============================================
   * 4 件 × 画像 + キャプション。各カードにラベル / タイトル / 説明。
   * 期待 JSON: { cards: [{ image_path?, label?, title, body }] } (4 件)
   */


  const atoms = require('../atoms');

  function renderVisual4ImageCard2x2(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const cards = Array.isArray(slideJson.cards) ? slideJson.cards : [];
    if (cards.length === 0) return;
    const topY = L.contentY;
    const gap = 0.28;
    const colW = (10 - L.marginX * 2 - gap) / 2;
    const rowH = (L.contentBot - topY - gap) / 2;
    const imgH = rowH * 0.50;

    cards.slice(0, 4).forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = L.marginX + col * (colW + gap);
      const y = topY + row * (rowH + gap);

      // 画像 or プレースホルダー
      if (c.image_path) {
        slide.addImage({
          path: c.image_path,
          x, y, w: colW, h: imgH,
          sizing: { type: 'cover', w: colW, h: imgH },
        });
      } else {
        slide.addShape(pres.shapes.RECTANGLE, {
          x, y, w: colW, h: imgH,
          fill: { color: C.gray100 }, line: { color: C.gray300, width: L.lineWidth, dashType: 'dash' },
        });
        slide.addText(c.label || '[ 画像 ]', {
          x, y, w: colW, h: imgH,
          fontSize: 10, color: C.gray400, fontFace: F.jp,
          align: 'center', valign: 'middle', margin: 0,
        });
      }

      // テキスト部
      if (c.label) {
        slide.addText(c.label, {
          x: x + 0.08, y: y + imgH + 0.08, w: colW - 0.16, h: 0.22,
          fontSize: 9, color: C.brand, fontFace: F.jp, bold: true,
          charSpacing: 1, align: 'left', valign: 'top', margin: 0,
        });
      }
      slide.addText(c.title || '', {
        x: x + 0.08, y: y + imgH + 0.32, w: colW - 0.16, h: 0.32,
        fontSize: 13, color: C.ink, fontFace: F.jp, bold: true,
        valign: 'top', margin: 0,
      });
      slide.addText(c.body || '', {
        x: x + 0.08, y: y + imgH + 0.66, w: colW - 0.16, h: rowH - imgH - 0.72,
        fontSize: 10, color: C.gray700, fontFace: F.jp, valign: 'top', margin: 0,
        lineSpacingMultiple: L.lineSpacingMultiple,
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
        template: 'VISUAL-4（イメージカード 2×2）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual4ImageCard2x2 };
})();

// ─── visual-5-split-image-text.js ────────────────────────────────
const { renderVisual5SplitImageText } = (function () {
  /**
   * VISUAL-5 左画像 + 右テキスト (Category F: VISUAL)
   * ==============================================
   * 50:50 split。左に画像 (or プレースホルダー)、右にテキストブロック。
   * 期待 JSON:
   *   {
   *     image_path?: "...",
   *     image_label?: "...",
   *     bullets: [{ head, body }]   // 3-4 件
   *   }
   */


  const atoms = require('../atoms');

  function renderVisual5SplitImageText(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const topY = L.contentY;
    const totalH = L.contentBot - topY;
    const halfW = (10 - L.marginX * 2 - 0.40) / 2;

    // 左: 画像
    if (slideJson.image_path) {
      slide.addImage({
        path: slideJson.image_path,
        x: L.marginX, y: topY, w: halfW, h: totalH,
        sizing: { type: 'cover', w: halfW, h: totalH },
      });
    } else {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: L.marginX, y: topY, w: halfW, h: totalH, rectRadius: L.cardRadius,
        fill: { color: C.gray100 },
        line: { color: C.gray300, width: L.lineWidth, dashType: 'dash' },
      });
      slide.addText(slideJson.image_label || '[ 画像 ]', {
        x: L.marginX, y: topY, w: halfW, h: totalH,
        fontSize: 13, color: C.gray500, fontFace: F.jp,
        italic: true, align: 'center', valign: 'middle', margin: 0,
      });
    }

    // 右: テキストブロック
    const rx = L.marginX + halfW + 0.40;
    const rW = halfW;
    const bullets = Array.isArray(slideJson.bullets) ? slideJson.bullets : [];

    if (bullets.length > 0) {
      const itemH = totalH / bullets.length;
      bullets.forEach((b, i) => {
        const y = topY + i * itemH;
        slide.addShape(pres.shapes.OVAL, {
          x: rx, y: y + 0.22, w: 0.12, h: 0.12,
          fill: { color: C.brand }, line: { type: 'none' },
        });
        slide.addText([
          { text: b.head || '', options: { fontSize: 14, bold: true, color: C.ink, breakLine: true } },
          { text: '　',         options: { fontSize: 6, breakLine: true } },
          { text: b.body || '',  options: { fontSize: 11, color: C.gray700 } },
        ], {
          x: rx + 0.30, y, w: rW - 0.30, h: itemH - 0.10,
          fontFace: F.jp, valign: 'top', margin: 0,
          lineSpacingMultiple: L.lineSpacingMultiple,
        });
      });
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'VISUAL-5（左画像+右テキスト）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual5SplitImageText };
})();

// ─── visual-6-fullvisual.js ──────────────────────────────────────
const { renderVisual6FullVisual } = (function () {
  /**
   * VISUAL-6 フルビジュアル + オーバーレイ (Category F: VISUAL)
   * =======================================================
   * 全画面画像 + 上に半透明テキストオーバーレイ。Cinematic な印象。
   * 期待 JSON:
   *   {
   *     image_path?: "...",
   *     overlay_title: "...",
   *     overlay_sub?: "..."
   *   }
   */


  const atoms = require('../atoms');

  function renderVisual6FullVisual(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    // canvas 全面（ナビなし扱い）
    atoms.setCanvasBg(ctx, slide);

    // 画像 or 暗背景
    if (slideJson.image_path) {
      slide.addImage({
        path: slideJson.image_path,
        x: 0, y: 0, w: L.slideW, h: L.slideH,
        sizing: { type: 'cover', w: L.slideW, h: L.slideH },
      });
    } else {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: L.slideW, h: L.slideH,
        fill: { color: C.dark.bgAlt }, line: { type: 'none' },
      });
    }

    // 下部半透明黒オーバーレイ
    const overlayY = L.slideH * 0.55;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: overlayY, w: L.slideW, h: L.slideH - overlayY,
      fill: { color: C.dark.overlay, transparency: 35 },
      line: { type: 'none' },
    });

    slide.addText(slideJson.overlay_title || '', {
      x: L.marginX, y: overlayY + 0.40, w: 10 - L.marginX * 2, h: 0.80,
      fontSize: 28, color: C.white, fontFace: F.jp, bold: true,
      align: 'left', valign: 'middle', margin: 0,
    });

    if (slideJson.overlay_sub) {
      slide.addText(slideJson.overlay_sub, {
        x: L.marginX, y: overlayY + 1.30, w: 10 - L.marginX * 2, h: 0.50,
        fontSize: 13, color: C.dark.text, fontFace: F.jp,
        align: 'left', valign: 'middle', margin: 0,
      });
    }

    // ナビなし、ページ番号のみ右下に薄く
    slide.addText(String(ctx.pageNum.value).padStart(2, '0') + ` / ${ctx.totalPages}`, {
      x: 8.3, y: L.footerY, w: 1.3, h: L.footerH,
      fontSize: 9, color: C.dark.sub, fontFace: F.jp,
      align: 'right', margin: 0,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'VISUAL-6（フルビジュアル）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.overlay_title || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual6FullVisual };
})();

// ─── visual-7-reference-image.js ─────────────────────────────────
const { renderVisual7ReferenceImage } = (function () {
  /**
   * VISUAL-7 リファレンス画像補足 (Category H: DATA / REFERENCE)
   * ===========================================================
   * 本文中で参照したリファレンス (doc.references[]) のうち、画像を伴うものに対して
   *
   *   - タイトル行を復活。表示内容は「画像タイトル」(画像が何を描いた図か)
   *   - 優先順位: image.title (Claude が文脈に合わせて命名) →
   *               image.description → image.alt → image.caption
   *   - サブコピーは引き続き「画像の要約・伝えたい内容」(caption + rationale)
   *
   *   - 出典クレジットのリンク先 = 元記事 URL (article_url または ref.url)
   *   - 章ナビ chip 撤去 (出典補足は章本文の流れに含めない)
   *
   * 期待 JSON:
   *   {
   *     id: "S5b",
   *     template_id: "VISUAL-7",
   *     ref_num: 3,
   *     title?: "...",               // build-deck.js が image.title 等から組み立て
   *     subtitle?: "...",            // 画像の要約 (caption + rationale 結合)
   *     image_path: "assets/images/abc123.png",
   *     source: "...",
   *     article_url?: "https://...", // 出典クレジット行のリンク先 (元記事 URL)
   *     source_url?: "https://...",  // 画像直接 URL (互換維持、article_url が無い時のフォールバック)
   *     year?: 2026,
   *     fetch_status?: "ok" | "failed" | "skipped"
   *   }
   *
   * SchemaQA-15: image.source_url 必須は維持。
   */


  const atoms = require('../atoms');
  const fs = require('fs');

  let imageSize;
  try {
    ({ imageSize } = require('image-size'));
  } catch (_) {
    imageSize = null;
  }

  function fitImageInBox(boxX, boxY, boxW, boxH, imgW, imgH) {
    if (!imgW || !imgH) {
      return { x: boxX, y: boxY, w: boxW, h: boxH };
    }
    const scale = Math.min(boxW / imgW, boxH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = boxX + (boxW - drawW) / 2;
    const drawY = boxY + (boxH - drawH) / 2;
    return { x: drawX, y: drawY, w: drawW, h: drawH };
  }

  function renderVisual7ReferenceImage(slide, slideJson, ctx) {
    const { L, C, F, SZ, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);

    // ── eyebrow (黒ラベル: 出典補足 / 参考情報 (N)) ──
    const eyebrowText = slideJson.ref_num
      ? `出典補足 / 参考情報 (${slideJson.ref_num})`
      : '出典補足';
    const eyebrowY = 0.30;
    const eyebrowH = 0.26;
    const eyebrowW = Math.max(1.0, eyebrowText.length * 0.17 + 0.40);
    slide.addShape(pres.shapes.RECTANGLE, {
      x: L.marginX, y: eyebrowY, w: eyebrowW, h: eyebrowH,
      fill: { color: C.ink }, line: { type: 'none' },
    });
    slide.addText(eyebrowText, {
      x: L.marginX, y: eyebrowY, w: eyebrowW, h: eyebrowH,
      fontSize: 10, color: C.white, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });

    // ── タイトル ──
    // build-deck.js が image.title (Claude命名) / image.description / image.alt /
    // image.caption の優先順で title フィールドを組み立てる
    const title = slideJson.title || '';
    const titleY = eyebrowY + eyebrowH + 0.10; // eyebrow 直下に 0.10" 余白
    const w = 10 - L.marginX * 2;
    const titleFontSize = 18; // 1 行に収めるため SZ.titleL (20pt) より少し小さめ
    // 動的高さ: 文字数 ÷ 35 字/行で行数推定 (18pt × 9.20" 幅で 35 字/行が目安)
    const titleLines = title ? Math.max(1, Math.min(2, Math.ceil(title.length / 35))) : 0;
    const titleH = titleLines === 0 ? 0 : (titleLines === 1 ? 0.42 : 0.78);
    //        18pt × 1.25 = 22.5pt = 0.31"/line で 2 行 0.62"+パディングで収まる。
    if (title) {
      slide.addText(title, {
        x: L.marginX, y: titleY, w, h: titleH,
        fontSize: titleFontSize, color: C.ink, fontFace: F.jp,
        bold: true, valign: 'top', margin: 0,
        lineSpacingMultiple: 1.25,
      });
    }

    // ── サブコピー (Amber 太罫線 + 灰色細罫線 + 平文リード) ──
    const subtitle = slideJson.subtitle || slideJson.caption || '';
    const subRuleY = titleY + titleH + 0.05;
    const subTextY = subRuleY + 0.07;

    // Amber 太罫線 + 灰色細罫線
    slide.addShape(pres.shapes.RECTANGLE, {
      x: L.marginX, y: subRuleY, w: 0.55, h: 0.04,
      fill: { color: C.brand }, line: { type: 'none' },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: L.marginX + 0.55, y: subRuleY + 0.018, w: w - 0.55, h: 0.005,
      fill: { color: C.gray300 }, line: { type: 'none' },
    });

    // サブコピー本文 (動的高さ、最大 3 行)
    const maxLines = 3;
    const subLines = subtitle ? Math.max(1, Math.min(maxLines, Math.ceil(subtitle.length / 60))) : 0;
    const subTextH = subLines === 0 ? 0 : (0.30 + 0.22 * subLines);

    if (subtitle) {
      slide.addText(subtitle, {
        x: L.marginX, y: subTextY, w, h: subTextH,
        fontSize: SZ.lead, color: C.gray700, fontFace: F.jp,
        bold: true, valign: 'top',
        lineSpacingMultiple: 1.40, margin: 0,
      });
    }

    // ── 画像配置領域 (動的: タイトル+サブコピーの実高に応じて起点を下げる) ──
    const subBlockBottomY = subtitle ? subTextY + subTextH : subRuleY + 0.04;
    const topY = subBlockBottomY + 0.10;
    const boxW = 10 - L.marginX * 2;
    const creditH = 0.30;
    const boxH = (L.contentBot - topY) - creditH - 0.08;
    const boxX = L.marginX;
    const boxY = topY;

    const fetchStatus = slideJson.fetch_status || (slideJson.image_path ? 'ok' : 'skipped');

    if (fetchStatus === 'ok' && slideJson.image_path) {
      let imgW = null, imgH = null;
      if (imageSize) {
        try {
          const buf = fs.readFileSync(slideJson.image_path);
          const sz = imageSize(buf);
          imgW = sz.width; imgH = sz.height;
        } catch (e) { /* fallback to box-fill */ }
      }
      const fit = fitImageInBox(boxX, boxY, boxW, boxH, imgW, imgH);

      slide.addImage({
        path: slideJson.image_path,
        x: fit.x, y: fit.y, w: fit.w, h: fit.h,
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: fit.x, y: fit.y, w: fit.w, h: fit.h,
        fill: { type: 'none' },
        line: { color: C.gray200, width: 0.25 },
      });
    } else {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: boxX, y: boxY, w: boxW, h: boxH, rectRadius: 0.12,
        fill: { color: C.gray100 },
        line: { color: C.gray300, width: 0.25, dashType: 'dash' },
      });
      const placeholderMsg = fetchStatus === 'failed'
        ? `画像取得失敗 — 出典 URL から画像を取得できませんでした\n${slideJson.fetch_reason ? '理由: ' + slideJson.fetch_reason : ''}`
        : '［ 画像 ］';
      slide.addText(placeholderMsg, {
        x: boxX, y: boxY, w: boxW, h: boxH,
        fontSize: 12, color: C.gray500, fontFace: F.jp,
        italic: true, align: 'center', valign: 'middle', margin: 0,
      });
    }

    const creditY = boxY + boxH + 0.08;
    const yearText = slideJson.year ? ` (${slideJson.year})` : '';
    const sourceLabel = (slideJson.source || '出典') + yearText;
    const articleUrl = slideJson.article_url || slideJson.source_url;

    const creditRuns = [
      { text: '出典: ', options: { fontSize: 10.5, bold: true, color: C.gray700 } },
    ];
    if (articleUrl) {
      creditRuns.push({
        text: sourceLabel,
        options: {
          fontSize: 10.5,
          color: C.link,
          hyperlink: { url: articleUrl, tooltip: slideJson.source || articleUrl },
          underline: { style: 'sng' },
        },
      });
    } else {
      creditRuns.push({
        text: sourceLabel,
        options: { fontSize: 10.5, color: C.gray700 },
      });
    }

    slide.addText(creditRuns, {
      x: L.marginX, y: creditY, w: boxW, h: creditH,
      fontFace: F.jp, valign: 'top', margin: 0,
    });

    // ── chrome (ナビ chip 撤去) ──
    const pageNum = ctx.pageNum.value;
    atoms.addChromeFull(ctx, slide, pageNum);

    // ── speaker notes ──
    atoms.addSpeakerNotes(ctx, slide, { slideJson,
      template: `VISUAL-7（リファレンス画像補足: 参考情報(${slideJson.ref_num || '?'}))`,
      goal: '本文で引用したリファレンスの図表を、出典のまま読者に見せる',
      message: title || subtitle || `参考情報 (${slideJson.ref_num || '?'})`,
      design: slideJson.image_path
        ? `画像 ${slideJson.image_path} を ${slideJson.source_url || '(URL未設定)'} から取得 / 出典リンク先: ${articleUrl || '(なし)'}`
        : '画像未取得 (fetch_status: ' + fetchStatus + ')',
    });
  }
  return { renderVisual7ReferenceImage };
})();

// ─── visual-8-summary-image.js ───────────────────────────────────
const { renderVisual8SummaryImage } = (function () {
  /**
   * =========================================================
   * 目次 (SECTION-6) の直後に必ず 1 枚配置する「グラレコ調デッキ全体まとめ画像」。
   * Nano Banana Pro (gemini-3-pro-image-preview) で生成したグラフィックレコーディング
   * 風画像をフルブリード（ヘッダーバー下〜キャプションバー上の最大領域）で配置する。
   *
   * 役割:
   *   - 読み手にデッキ全体の世界観・登場人物・主要メッセージを 1 枚絵で先渡し
   *   - 目次の文字情報を視覚的に補強し、各章を読む前の「全体像の地図」を作る
   *   - SECSUMMARY-1 (章ごとの見取り図) の上位互換 = 「デッキ全体の見取り図」
   *
   * 期待 JSON:
   *   {
   *     id: "S5",
   *     template_id: "VISUAL-8",
   *     title:    "本日お伝えしたいこと、1 枚で",      // ヘッダーバー左
   *     eyebrow?: "デッキ全体のサマリー",              // ヘッダーバー右 (default: "デッキ全体のサマリー")
   *     image_path: "decks/{slug}/assets/summary.png",  // 必須。Nano Banana 生成画像
   *     caption:  "このデッキで伝えたいことを1行で言うと...",  // 下部キャプションバー
   *
   *     // 任意: 画像生成失敗時のフォールバック
   *     placeholder_label?: "中央: ○○、周囲: ××、矢印で△△...",
   *
   *     slide_goal: { title, subtitle }
   *   }
   *
   * 画像比率: 16:9 想定 (Nano Banana --aspect-ratio 16:9 で生成)。
   * フルブリード領域も 16:9 に近い (W: 9.20 / H: 3.85, 約 2.39:1) ため
   * sizing: 'cover' で中心トリミング。
   *
   * ナビは「目次直後の固定枠」として noNav 扱い (章リストには属さない)。
   */


  const atoms = require('../atoms');

  function renderVisual8SummaryImage(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);

    const title = slideJson.title || '本日お伝えしたいこと、1 枚で';
    const eyebrow = slideJson.eyebrow || 'デッキ全体のサマリー';
    const caption = slideJson.caption || slideJson.subtitle || '';

    // ── 上部: 細いヘッダーバー (タイトル + eyebrow ラベル) ──
    const headerY = 0.55;
    const headerH = 0.42;

    // 左の縦アクセント帯
    slide.addShape(pres.shapes.RECTANGLE, {
      x: L.marginX, y: headerY, w: 0.06, h: headerH,
      fill: { color: C.brand }, line: { type: 'none' },
    });

    // タイトル (左)
    slide.addText(title, {
      x: L.marginX + 0.18, y: headerY, w: 6.80, h: headerH,
      fontSize: 16, color: C.ink, fontFace: F.jp,
      bold: true, valign: 'middle', margin: 0,
    });

    // eyebrow (右、文字間スペーシングで識別子感)
    slide.addText(eyebrow, {
      x: 7.20, y: headerY, w: 2.40, h: headerH,
      fontSize: 9, color: C.gray500, fontFace: F.jp,
      align: 'right', valign: 'middle', charSpacing: 1, margin: 0,
    });

    // ── 中央: フルブリード画像領域 ──
    const imgX = L.marginX;
    const imgY = 1.05;
    const imgW = 10 - L.marginX * 2;
    const imgH = 3.78;

    if (slideJson.image_path) {
      // 画像周囲に薄い枠 + 影風の下罫線
      slide.addShape(pres.shapes.RECTANGLE, {
        x: imgX - 0.02, y: imgY - 0.02, w: imgW + 0.04, h: imgH + 0.04,
        fill: { color: C.gray100 }, line: { type: 'none' },
      });
      slide.addImage({
        path: slideJson.image_path,
        x: imgX, y: imgY, w: imgW, h: imgH,
        sizing: { type: 'cover', w: imgW, h: imgH },
      });
    } else {
      // フォールバック: プレースホルダー
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: imgX, y: imgY, w: imgW, h: imgH, rectRadius: 0.18,
        fill: { color: C.brandSoft }, line: { color: C.gray200, width: 0.8, dashType: 'dash' },
      });
      slide.addText(
        slideJson.placeholder_label
          ? '（グラレコ画像 未生成）\n' + slideJson.placeholder_label
          : '（グラレコ画像をここに配置 — image_path を指定するか、Phase 2 で vertex-nanobanana-image スキルを呼んで生成してください）',
        {
          x: imgX + 0.60, y: imgY + imgH / 2 - 0.50,
          w: imgW - 1.20, h: 1.00,
          fontSize: 12, color: C.gray500, fontFace: F.jp,
          italic: true, align: 'center', valign: 'middle', margin: 0,
        },
      );
    }

    // ── 下部: キャプションバー (アンバー左バー + 1 行説明、footerY=5.28 より上に収める) ──
    const capY = 4.92;
    const capH = 0.30;

    slide.addShape(pres.shapes.RECTANGLE, {
      x: L.marginX, y: capY, w: 0.06, h: capH,
      fill: { color: C.highlight || C.accent }, line: { type: 'none' },
    });
    slide.addText(caption, {
      x: L.marginX + 0.20, y: capY, w: 10 - L.marginX * 2 - 0.20, h: capH,
      fontSize: 11, color: C.ink, fontFace: F.jp,
      bold: true, valign: 'middle', margin: 0,
    });

    // ── ページ番号のみ (ナビなし扱い、目次直後の固定枠は章リストに属さない) ──
    atoms.addChrome(ctx, slide, ctx.pageNum.value);

    // ── Speaker Notes ──
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'VISUAL-8（グラレコサマリー / 目次直後の固定枠）',
        goal: slideJson.slide_goal.title || '',
        message: caption || title,
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual8SummaryImage };
})();

// ─── visual-9-svg-numbered-cards.js ──────────────────────────────
const { renderVisual9SvgNumberedCards } = (function () {
  /**
   * VISUAL-9 SVG + 番号付きカード 4 行 (Category F: VISUAL)
   * ====================================================
   * 左: SVG (image_path 指定 — preprocessSvgIllustrations が svg/svg_file から PNG 化)
   * 右: 番号 + タイトル + 本文の 4 行 (添付3枚目「機体は4つのブロック」型)
   *
   * 期待 JSON:
   *   {
   *     image_path: "...",  // svg / svg_file から自動変換される
   *     items: [
   *       { num: "01", title: "...", body: "..." },
   *       ... (3-5 件)
   *     ]
   *   }
   */


  const atoms = require('../atoms');

  function renderVisual9SvgNumberedCards(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || '',
      slideJson.subtitle || '',
    );

    const items = Array.isArray(slideJson.items) ? slideJson.items.slice(0, 5) : [];
    const startY = titleBottomY + 0.10;
    const endY = L.contentBot;
    const totalH = endY - startY;

    // ── 左: SVG / 画像領域 (幅 4.4") ──
    const leftW = 4.40;
    const leftX = L.marginX;
    if (slideJson.image_path) {
      slide.addImage({
        path: slideJson.image_path,
        x: leftX, y: startY, w: leftW, h: totalH,
        sizing: { type: 'contain', w: leftW, h: totalH },
      });
    } else {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: leftX, y: startY, w: leftW, h: totalH,
        fill: { color: C.gray100 },
        line: { color: C.gray300, width: 0.25, dashType: 'dash' },
      });
      slide.addText(slideJson.placeholder_label || '[ SVG / 図 ]', {
        x: leftX, y: startY + totalH / 2 - 0.20, w: leftW, h: 0.40,
        fontSize: 12, color: C.gray400, fontFace: F.jp,
        align: 'center', valign: 'middle', italic: true, margin: 0,
      });
    }

    // ── 右: 番号付き 4 行カード (幅 4.7") ──
    const rightX = leftX + leftW + 0.20;
    const rightW = 10 - L.marginX - rightX;
    if (items.length === 0) return;
    const cardGap = 0.10;
    const cardH = (totalH - cardGap * (items.length - 1)) / items.length;

    items.forEach((it, i) => {
      const cy = startY + i * (cardH + cardGap);
      // カード (border-only)
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: rightX, y: cy, w: rightW, h: cardH, rectRadius: 0.06,
        fill: { color: C.canvas }, line: { color: C.gray300, width: 0.25 },
      });
      // 左 brand バー
      slide.addShape(pres.shapes.RECTANGLE, {
        x: rightX, y: cy, w: 0.05, h: cardH,
        fill: { color: C.brand }, line: { type: 'none' },
      });
      // タイトル / body の高さを上下マージン込みで cardH 内に収める
      const numW = 0.70;
      const padTop = 0.14;
      const padBottom = 0.14;
      const titleH = 0.34;
      const titleY = cy + padTop;
      const bodyY  = titleY + titleH;
      const bodyH  = cardH - padTop - titleH - padBottom;

      // 番号 (タイトルと同じ y / h で middle 揃え)
      slide.addText(it.num || String(i + 1).padStart(2, '0'), {
        x: rightX + 0.10, y: titleY, w: numW, h: titleH,
        fontSize: 22, color: C.brand, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
      // タイトル
      slide.addText(it.title || '', {
        x: rightX + numW + 0.20, y: titleY, w: rightW - numW - 0.30, h: titleH,
        fontSize: 14, color: C.ink, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      // 本文 (タイトル直下)
      if (it.body) {
        slide.addText(it.body, {
          x: rightX + numW + 0.20, y: bodyY, w: rightW - numW - 0.30, h: bodyH,
          fontSize: 10.5, color: C.gray700, fontFace: F.jp,
          align: 'left', valign: 'top', margin: 0,
          lineSpacingMultiple: 1.20,
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
        template: 'VISUAL-9（SVG + 番号付きカード）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderVisual9SvgNumberedCards };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'VISUAL-1':  renderVisual1Profile,
  'VISUAL-2':  renderVisual2Evidence,
  'VISUAL-3':  renderVisual3Visual,
  'VISUAL-4':  renderVisual4ImageCard2x2,
  'VISUAL-5':  renderVisual5SplitImageText,
  'VISUAL-6':  renderVisual6FullVisual,
  'VISUAL-7':  renderVisual7ReferenceImage,
  'VISUAL-8':  renderVisual8SummaryImage,
  'VISUAL-9':  renderVisual9SvgNumberedCards,
  'VISUAL-10': renderVisual10Svg3Step,
  'VISUAL-11': renderVisual11SvgTop3Card,
  'VISUAL-12': renderVisual12SvgPair,
};
