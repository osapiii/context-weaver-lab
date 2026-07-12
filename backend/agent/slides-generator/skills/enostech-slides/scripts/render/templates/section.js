'use strict';

// =============================================================
// templates/section.js
// -------------------------------------------------------------
// Consolidated from templates/section/*.js.
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

const { renderSection1ACover } = (function () {
  /**
   * SECTION-1A 表紙 (Category A: STRUCTURE) — Twilight Forge シンプル版
   * =============================================================
   * signature gradient pill。テーマ非依存（常に企業ブランドの dark hero 配色で固定）。
   * FRAMING-3 と同じ Twilight Forge 世界観で「ブックエンド」を構成。
   *
   * (新規バリアント 1B / 1D / 1F / 1G を追加するため)
   *
   * 期待 JSON:
   *   { id, template_id: "SECTION-1A", title, subtitle?, issued? }
   *
   * 表紙はナビ・サイドストライプ・ページ番号を置かない（ブックエンド思想）。
   */
  const atoms = require('../atoms');
  const TF = atoms.TWILIGHT_FORGE;

  function renderSection1ACover(slide, slideJson, ctx) {
    const { L, F, T, pres } = ctx;
    slide.background = { color: TF.canvas };
    const W = L.slideW, H = L.slideH;
    const MX = 0.42;
    // v11.4: orb 4 → 2 に削減 (装飾過多解消、表紙の主張を残す)
    atoms.addAtmosphericOrb(ctx, slide, -0.4, -0.3, 4.6, TF.brandSoft);
    atoms.addAtmosphericOrb(ctx, slide, 10.4,  5.9, 4.4, TF.accentSoft);
    const headerY = 0.32;
    const headerLogoH = 0.36;
    const headerLogoW = headerLogoH * (824 / 152);
    slide.addImage({ path: T.logoPath('horizontalWhite'), x: MX, y: headerY, w: headerLogoW, h: headerLogoH });
    const issued = slideJson.issued || '2026.04';
    slide.addText(`制作日 ／ ${issued}`, {
      x: W - MX - 3.4, y: headerY + 0.08, w: 3.4, h: 0.24,
      fontSize: 9, color: TF.inkMute, fontFace: F.jp, bold: false, charSpacing: 1,
      align: 'right', valign: 'middle', margin: 0,
    });
    slide.addText(slideJson.title || '', {
      x: MX, y: 2.55, w: W - MX * 2, h: 1.40,
      fontSize: 36, color: TF.ink, fontFace: F.jp,
      bold: true, margin: 0, valign: 'top', align: 'left', charSpacing: 0, fit: 'shrink',
    });
    if (slideJson.subtitle) {
      slide.addText(slideJson.subtitle, {
        x: MX, y: 4.05, w: W - MX * 2, h: 0.78,
        fontSize: 12, color: TF.inkSoft, fontFace: F.jp,
        bold: false, charSpacing: 1, align: 'left', valign: 'top', margin: 0,
      });
    }
    const horizonY = 4.95;
    atoms.addGradientPill(ctx, slide, MX, horizonY);
    atoms.addSpeakerNotes(ctx, slide, { slideJson,
      template: 'SECTION-1A（表紙・Twilight Forge シンプル版 v6.69 / リネーム）',
      goal: (slideJson.slide_goal && slideJson.slide_goal.title) || '',
      message: slideJson.subtitle || '',
      design: (slideJson.slide_goal && slideJson.slide_goal.subtitle) || '',
    });
  }
  return { renderSection1ACover };
})();


// ─── section-1b-cover-editorial.js ───────────────────
const { renderSection1BCover } = (function () {
  /**
   * SECTION-1B 表紙 — エディトリアル分割型
   * =================================================
   * 雑誌的な左右 2 分割表紙。左半分に大画像（フルブリード）、右半分に
   * eyebrow + タイトル + サブタイトル + メタ情報を配置する。
   * 落ち着いた読み物系・学習系デッキ向け。
   *
   * 期待 JSON:
   *   {
   *     id, template_id: "SECTION-1B",
   *     title:    "オニールのCANSLIMを完全理解する",
   *     subtitle: "投資中級者向け、7要素の正確な算出方法...",
   *     image_path: "...",          // optional. 無ければ brand 色のプレースホルダ
   *     placeholder_label: "...",   // image_path 未指定時に左面に出す説明テキスト
   *     eyebrow: "Learning Note",   // optional, 右面の上部小チップ
   *     issued:  "2026.04",         // optional
   *     author:  "ENOSTECH 編集部",  // optional, 右面の下部メタ
   *   }
   */
  const atoms = require('../atoms');

  function renderSection1BCover(slide, slideJson, ctx) {
    const { L, C, F, T, pres } = ctx;
    const W = L.slideW, H = L.slideH;
    const SPLIT = 5.0;          // 左半分の幅
    const PANEL_X = SPLIT + 0.0;
    const PAD = 0.42;

    // 背景: canvas (white)
    atoms.setCanvasBg(ctx, slide);

    // 左半分: 画像 (or プレースホルダ)
    if (slideJson.image_path) {
      slide.addImage({
        path: slideJson.image_path,
        x: 0, y: 0, w: SPLIT, h: H,
        sizing: { type: 'cover', w: SPLIT, h: H },
      });
    } else {
      // brand 色のソフトな塗り + 中央にプレースホルダ
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: SPLIT, h: H,
        fill: { color: C.brandSoft || C.brand }, line: { type: 'none' },
      });
      slide.addText(slideJson.placeholder_label || '（image_path を指定してください）', {
        x: 0.30, y: H / 2 - 0.30, w: SPLIT - 0.60, h: 0.60,
        fontSize: 12, color: C.white, fontFace: F.jp,
        italic: true, align: 'center', valign: 'middle', margin: 0,
      });
    }

    // 中央 brand カラーの細い縦アクセント (左右の境目)
    slide.addShape(pres.shapes.RECTANGLE, {
      x: SPLIT, y: 0, w: 0.04, h: H,
      fill: { color: C.brand }, line: { type: 'none' },
    });

    // 右半分: テキストパネル
    // 右上: ENOSTECH ロゴ (黒)
    const headerY = 0.36;
    const headerLogoH = 0.32;
    const headerLogoW = headerLogoH * (824 / 152);
    slide.addImage({
      path: T.logoPath('horizontalBlack'),
      x: W - PAD - headerLogoW, y: headerY, w: headerLogoW, h: headerLogoH,
    });

    // eyebrow (任意, brand 色の小チップ)
    let titleY = 1.55;
    if (slideJson.eyebrow) {
      slide.addText(slideJson.eyebrow, {
        x: PANEL_X + PAD, y: 1.10, w: W - PANEL_X - PAD * 2, h: 0.30,
        fontSize: 10, color: C.brand, fontFace: F.jp,
        bold: true, charSpacing: 2, align: 'left', valign: 'middle', margin: 0,
      });
      titleY = 1.55;
    }

    // タイトル (大、左寄せ、最大 3 行)
    slide.addText(slideJson.title || '', {
      x: PANEL_X + PAD, y: titleY, w: W - PANEL_X - PAD * 2, h: 1.85,
      fontSize: 28, color: C.ink, fontFace: F.jp,
      bold: true, margin: 0, valign: 'top', align: 'left',
      charSpacing: 0, fit: 'shrink',
    });

    // サブタイトル (中、最大 4 行)
    if (slideJson.subtitle) {
      slide.addText(slideJson.subtitle, {
        x: PANEL_X + PAD, y: 3.55, w: W - PANEL_X - PAD * 2, h: 1.20,
        fontSize: 12, color: C.gray700, fontFace: F.jp,
        bold: false, charSpacing: 1, align: 'left', valign: 'top', margin: 0,
      });
    }

    // 下部 brand 細い横線
    slide.addShape(pres.shapes.RECTANGLE, {
      x: PANEL_X + PAD, y: 4.95, w: 1.20, h: 0.030,
      fill: { color: C.brand }, line: { type: 'none' },
    });

    // 下部メタ: 制作日 / 著者
    const issued = slideJson.issued || '2026.04';
    const author = slideJson.author || '';
    const metaParts = [];
    if (author) metaParts.push(author);
    metaParts.push(`制作日 ／ ${issued}`);
    slide.addText(metaParts.join('　・　'), {
      x: PANEL_X + PAD, y: 5.10, w: W - PANEL_X - PAD * 2, h: 0.28,
      fontSize: 9.5, color: C.gray500, fontFace: F.jp,
      bold: false, charSpacing: 2, align: 'left', valign: 'top', margin: 0,
    });

    atoms.addSpeakerNotes(ctx, slide, { slideJson,
      template: 'SECTION-1B（表紙・エディトリアル分割 v9.21）',
      goal: (slideJson.slide_goal && slideJson.slide_goal.title) || '',
      message: slideJson.subtitle || '',
      design: (slideJson.slide_goal && slideJson.slide_goal.subtitle) || '',
    });
  }
  return { renderSection1BCover };
})();

// ─── section-1d-cover-minimal.js ─────────────────────
const { renderSection1DCover } = (function () {
  /**
   * SECTION-1D 表紙 — ミニマル・タイポグラフィ型
   * =====================================================
   * 装飾を最小限にし、大見出し + 細い罫線 + 短いサブで「読ませる表紙」。
   * コンサル・調査レポート系（case-study-deck / company-research）向け。
   *
   * 期待 JSON:
   *   {
   *     id, template_id: "SECTION-1D",
   *     title:    "業界別 AI 導入事例 25 社レビュー",
   *     subtitle: "2025 年の SaaS / 業務 / 流通 セクター横断調査",
   *     issued:  "2026.04",
   *     author:  "ENOSTECH リサーチ室",   // optional
   *     dept:    "Research & Insight",  // optional, eyebrow に使う
   *   }
   */
  const atoms = require('../atoms');

  function renderSection1DCover(slide, slideJson, ctx) {
    const { L, C, F, T, pres } = ctx;
    const W = L.slideW, H = L.slideH;
    const PAD = 0.50;

    atoms.setCanvasBg(ctx, slide);

    // 左上: 部署名 (eyebrow, optional)
    if (slideJson.dept) {
      slide.addText(slideJson.dept, {
        x: PAD, y: 0.50, w: 6.0, h: 0.30,
        fontSize: 10, color: C.brand, fontFace: F.jp,
        bold: true, charSpacing: 2, align: 'left', valign: 'middle', margin: 0,
      });
    }

    // 中央左寄せ: 大タイトル (60pt, fit: shrink で 2-3 行許容)
    slide.addText(slideJson.title || '', {
      x: PAD, y: 1.40, w: W - PAD * 2, h: 1.85,
      fontSize: 44, color: C.ink, fontFace: F.jp,
      bold: true, margin: 0, valign: 'top', align: 'left',
      charSpacing: 0, fit: 'shrink',
    });

    // 細い brand 横線 (タイトルとサブの境)
    slide.addShape(pres.shapes.RECTANGLE, {
      x: PAD, y: 3.45, w: 1.20, h: 0.030,
      fill: { color: C.brand }, line: { type: 'none' },
    });

    // サブタイトル (中)
    if (slideJson.subtitle) {
      slide.addText(slideJson.subtitle, {
        x: PAD, y: 3.65, w: W - PAD * 2, h: 0.90,
        fontSize: 13, color: C.gray700, fontFace: F.jp,
        bold: false, charSpacing: 0.5, align: 'left', valign: 'top', margin: 0,
        lineSpacingMultiple: L.lineSpacingMultiple,
      });
    }

    // 下部左: 著者 + 制作日 (1 行に並べる)
    const issued = slideJson.issued || '2026.04';
    const author = slideJson.author || '';
    const metaParts = [];
    if (author) metaParts.push(author);
    metaParts.push(`制作日 ／ ${issued}`);
    slide.addText(metaParts.join('　・　'), {
      x: PAD, y: H - 0.85, w: 6.5, h: 0.28,
      fontSize: 10, color: C.gray500, fontFace: F.jp,
      bold: false, charSpacing: 2, align: 'left', valign: 'middle', margin: 0,
    });

    // 下部右: 黒ロゴ (小)
    const footerLogoH = 0.30;
    const footerLogoW = footerLogoH * (824 / 152);
    slide.addImage({
      path: T.logoPath('horizontalBlack'),
      x: W - PAD - footerLogoW, y: H - 0.85, w: footerLogoW, h: footerLogoH,
    });

    atoms.addSpeakerNotes(ctx, slide, { slideJson,
      template: 'SECTION-1D（表紙・ミニマル・タイポグラフィ v9.21）',
      goal: (slideJson.slide_goal && slideJson.slide_goal.title) || '',
      message: slideJson.subtitle || '',
      design: (slideJson.slide_goal && slideJson.slide_goal.subtitle) || '',
    });
  }
  return { renderSection1DCover };
})();

// ─── section-1f-cover-quote.js ───────────────────────
const { renderSection1FCover } = (function () {
  /**
   * SECTION-1F 表紙 — 引用主導型
   * ==========================================
   * デッキの核となる「一言」を表紙の主役に置き、タイトルは小さく下部に。
   * 哲学的・問いかけ系（proposal-deck の冒頭）向け。
   *
   * 期待 JSON:
   *   {
   *     id, template_id: "SECTION-1F",
   *     quote:             "速さは正義ではない。間違いの量を増やすだけだ。",
   *     quote_attribution: "— Donald Knuth",          // optional
   *     title:             "プロダクト開発における品質と速度",
   *     subtitle:          "Q3 戦略レビュー (2026.04)",  // optional
   *     issued:            "2026.04",
   *   }
   */
  const atoms = require('../atoms');

  function renderSection1FCover(slide, slideJson, ctx) {
    const { L, C, F, T, pres } = ctx;
    const W = L.slideW, H = L.slideH;
    const PAD = 0.55;

    atoms.setCanvasBg(ctx, slide);

    // 左上: ENOSTECH ロゴ (黒・小)
    const headerLogoH = 0.30;
    const headerLogoW = headerLogoH * (824 / 152);
    slide.addImage({
      path: T.logoPath('horizontalBlack'),
      x: PAD, y: 0.40, w: headerLogoW, h: headerLogoH,
    });

    // 大きな引用記号 (brand 色 / 装飾)
    slide.addText('「', {
      x: PAD - 0.10, y: 0.95, w: 1.40, h: 1.60,
      fontSize: 150, color: C.brand, fontFace: F.jp,
      bold: true, align: 'left', valign: 'top', margin: 0,
    });

    // 引用文 (中央寄せ・大きめ)
    slide.addText(slideJson.quote || '（quote を指定してください）', {
      x: PAD + 0.55, y: 1.60, w: W - PAD * 2 - 0.55, h: 1.95,
      fontSize: 28, color: C.ink, fontFace: F.jp,
      bold: true, margin: 0, valign: 'top', align: 'left',
      charSpacing: -0.3, fit: 'shrink', italic: false,
      lineSpacingMultiple: 1.30,
    });

    // 引用元 (右寄せ、小)
    if (slideJson.quote_attribution) {
      slide.addText(slideJson.quote_attribution, {
        x: PAD + 0.55, y: 3.62, w: W - PAD * 2 - 0.55, h: 0.30,
        fontSize: 11, color: C.gray500, fontFace: F.jp,
        italic: true, align: 'right', valign: 'top', margin: 0,
      });
    }

    // 細い brand 横線 (引用と本タイトルの境)
    slide.addShape(pres.shapes.RECTANGLE, {
      x: PAD, y: 4.20, w: 1.20, h: 0.030,
      fill: { color: C.brand }, line: { type: 'none' },
    });

    // 下部: 本タイトル (小、左寄せ)
    slide.addText(slideJson.title || '', {
      x: PAD, y: 4.40, w: W - PAD * 2, h: 0.45,
      fontSize: 16, color: C.ink, fontFace: F.jp,
      bold: true, margin: 0, valign: 'top', align: 'left',
      fit: 'shrink',
    });

    // 下部: サブタイトル (極小、左寄せ)
    if (slideJson.subtitle) {
      slide.addText(slideJson.subtitle, {
        x: PAD, y: 4.92, w: W - PAD * 2, h: 0.30,
        fontSize: 11, color: C.gray700, fontFace: F.jp,
        bold: false, charSpacing: 1, align: 'left', valign: 'top', margin: 0,
      });
    }

    // 右下: 制作日
    const issued = slideJson.issued || '2026.04';
    slide.addText(`制作日 ／ ${issued}`, {
      x: W - PAD - 2.5, y: H - 0.50, w: 2.5, h: 0.28,
      fontSize: 9, color: C.gray500, fontFace: F.jp,
      bold: false, charSpacing: 1, align: 'right', valign: 'middle', margin: 0,
    });

    atoms.addSpeakerNotes(ctx, slide, { slideJson,
      template: 'SECTION-1F（表紙・引用主導 v9.21）',
      goal: (slideJson.slide_goal && slideJson.slide_goal.title) || '',
      message: slideJson.quote || '',
      design: (slideJson.slide_goal && slideJson.slide_goal.subtitle) || '',
    });
  }
  return { renderSection1FCover };
})();

// ─── section-1g-cover-svg-fullbleed.js ───────────────
const { renderSection1GCover } = (function () {
  /**
   * SECTION-1G 表紙 — full-bleed SVG-only 型
   * ====================================================
   * SECSUMMARY-1 と同じ思想で、画面全体 (10" × 5.625") を 1 枚の SVG で覆う。
   * 図で表紙が成立するデッキ（learning-deck の冒頭）向け。
   *
   * 期待 JSON:
   *   {
   *     id, template_id: "SECTION-1G",
   *     svg:        "...",                  // SVG 文字列を直接渡す, または
   *     svg_file:   "assets/cover.svg",     // SVG ファイルパス (planDir 基準)
   *     placeholder_label: "...",           // svg 未指定時のフォールバック表示
   *     title:      "(任意, 使われない / メタ情報)",
   *   }
   *
   * 注意: build-deck.js の preprocessSvgIllustrations が svg/svg_file を
   *       image_path に自動変換する。テンプレ自身は image_path だけを見る。
   */
  const atoms = require('../atoms');

  const SLIDE_W = 10;
  const SLIDE_H = 5.625;

  function renderSection1GCover(slide, slideJson, ctx) {
    const { C, F } = ctx;

    atoms.setCanvasBg(ctx, slide);

    if (slideJson.image_path) {
      slide.addImage({
        path: slideJson.image_path,
        x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
        sizing: { type: 'contain', w: SLIDE_W, h: SLIDE_H },
      });
    } else {
      slide.addText(
        slideJson.placeholder_label
          || '（表紙 SVG がまだ用意されていません — svg または svg_file を指定してください）',
        {
          x: 0.40, y: SLIDE_H / 2 - 0.30,
          w: SLIDE_W - 0.80, h: 0.60,
          fontSize: 14, color: C.gray400, fontFace: F.jp,
          italic: true, align: 'center', valign: 'middle', margin: 0,
        },
      );
    }

    // chrome は呼ばない (full-bleed SVG only / SECSUMMARY-1 と同じ流儀)

    atoms.addSpeakerNotes(ctx, slide, { slideJson,
      template: 'SECTION-1G（表紙・full-bleed SVG only v9.21）',
      goal: (slideJson.slide_goal && slideJson.slide_goal.title) || '',
      message: slideJson.title || '',
      design: (slideJson.slide_goal && slideJson.slide_goal.subtitle) || '',
    });
  }
  return { renderSection1GCover };
})();

// ─── section-2-section.js ────────────────────────────────────────
const { renderSection2Section } = (function () {
  /**
   * SECTION-2 セクション扉 (Category A: STRUCTURE)
   * ===========================================
   * 黒背景 + 巨大番号。章の切り替えで使う。
   * 期待 JSON: { number, title, subtitle?, page_label? }
   */


  const atoms = require('../atoms');

  function renderSection2Section(slide, slideJson, ctx) {
    const { L, C, F, SZ } = ctx;

    slide.background = { color: C.ink };

    // 巨大番号
    slide.addText(slideJson.number || '01', {
      x: 0.5, y: 1.0, w: 4, h: 1.9,
      fontSize: 120, color: C.brand, fontFace: F.jp,
      bold: true, margin: 0,
    });

    // タイトル
    slide.addText(slideJson.title || '', {
      x: 0.55, y: 3.1, w: 9, h: 0.8,
      fontSize: 36, color: C.white, fontFace: F.jp,
      bold: true, margin: 0, valign: 'top',
    });

    if (slideJson.subtitle) {
      slide.addText(slideJson.subtitle, {
        x: 0.55, y: 4.15, w: 9, h: 0.4,
        fontSize: 13, color: C.dark.sub, fontFace: F.jp, margin: 0,
      });
    }

    // ページ番号
    slide.addText([
      { text: slideJson.page_label || String(ctx.pageNum.value).padStart(2, '0'),
        options: { color: C.dark.sub, bold: true } },
      { text: ` / ${ctx.totalPages}`, options: { color: C.dark.faint } },
    ], {
      x: 8.3, y: L.footerY, w: 1.3, h: L.footerH,
      fontSize: SZ.caption, fontFace: F.jp, charSpacing: 1, align: 'right', margin: 0,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'SECTION-2（セクション扉）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderSection2Section };
})();

// ─── section-3-closing.js ────────────────────────────────────────
const { renderSection3Closing } = (function () {
  /**
   * SECTION-3 クロージング (Category A: STRUCTURE)
   * ==========================================
   * 中央にロゴ + ご清聴感謝メッセージ + 連絡先 + 下辺 2 色バー。
   * 期待 JSON: { thanks?, sub?, contact_left?, contact_right? }
   */


  const atoms = require('../atoms');

  function renderSection3Closing(slide, slideJson, ctx) {
    const { L, C, F, T, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addChromeLeftStrip(ctx, slide);

    // 中央ロゴ
    slide.addImage({
      path: T.logoPath('verticalColor'),
      x: (10 - 1.5) / 2, y: 1.3,
      sizing: { type: 'contain', w: 1.5, h: 1.5 },
    });

    slide.addText(slideJson.thanks || 'ご清聴、ありがとうございました。', {
      x: 0, y: 3.3, w: 10, h: 0.6,
      fontSize: 30, color: C.ink, fontFace: F.jp,
      bold: true, align: 'center', margin: 0,
    });
    slide.addText(slideJson.sub || 'ご質問・ご相談など、お気軽にお声がけください。', {
      x: 0, y: 3.95, w: 10, h: 0.35,
      fontSize: 13, color: C.gray500, fontFace: F.jp,
      align: 'center', margin: 0,
    });

    const contactLeft = slideJson.contact_left || 'enostech.co.jp';
    const contactRight = slideJson.contact_right || 'info@enostech.co.jp';
    slide.addText([
      { text: contactLeft, options: { color: C.gray700 } },
      { text: '　／　', options: { color: C.gray300 } },
      { text: contactRight, options: { color: C.gray700 } },
    ], {
      x: 0, y: 4.7, w: 10, h: 0.35,
      fontSize: 11, fontFace: F.jp, align: 'center', margin: 0,
    });

    // 下辺 2 色バー
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 5.58, w: 6.5, h: 0.045,
      fill: { color: C.brand }, line: { type: 'none' },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 6.5, y: 5.58, w: 3.5, h: 0.045,
      fill: { color: C.accent }, line: { type: 'none' },
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'SECTION-3（クロージング）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.thanks || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderSection3Closing };
})();

// ─── section-4-variant-a.js ──────────────────────────────────────
const { renderSection4VariantA } = (function () {
  /**
   * SECTION-4 セクション扉バリアント A (Category A: STRUCTURE)
   * ======================================================
   * 白背景 + 左 brand 縦帯 + 大テキスト。落ち着いたコーポレート向け。
   * 期待 JSON: { number, title, subtitle? }
   */


  const atoms = require('../atoms');

  function renderSection4VariantA(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);

    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.40, h: L.slideH,
      fill: { color: C.brand }, line: { type: 'none' },
    });

    slide.addText(slideJson.number || '01', {
      x: 1.0, y: 1.30, w: 4, h: 1.4,
      fontSize: 90, color: C.brand, fontFace: F.jp,
      bold: true, valign: 'top', margin: 0, charSpacing: 0,
    });

    // タイトル
    slide.addText(slideJson.title || '', {
      x: 1.0, y: 3.10, w: 8.6, h: 0.80,
      fontSize: 32, color: C.ink, fontFace: F.jp,
      bold: true, valign: 'top', margin: 0, charSpacing: -0.5,
    });

    if (slideJson.subtitle) {
      slide.addText(slideJson.subtitle, {
        x: 1.0, y: 4.10, w: 8.6, h: 0.50,
        fontSize: 13, color: C.gray500, fontFace: F.jp,
        valign: 'middle', margin: 0,
        lineSpacingMultiple: L.lineSpacingMultiple,
      });
    }

    // 右下ページ番号
    slide.addText([
      { text: String(ctx.pageNum.value).padStart(2, '0'), options: { color: C.gray500, bold: true } },
      { text: ` / ${ctx.totalPages}`, options: { color: C.gray400 } },
    ], {
      x: 8.3, y: L.footerY, w: 1.3, h: L.footerH,
      fontSize: 9, fontFace: F.jp, align: 'right', margin: 0,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'SECTION-4（章扉バリアント A）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderSection4VariantA };
})();

// ─── section-5-variant-b.js ──────────────────────────────────────
const { renderSection5VariantB } = (function () {
  /**
   * SECTION-5 セクション扉バリアント B (Category A: STRUCTURE)
   * ======================================================
   * 黒背景 + 上下 accent/brand 帯 + 中央寄せ。引き締めの「舞台変換」。
   * 期待 JSON: { number, title, subtitle? }
   */


  const atoms = require('../atoms');

  function renderSection5VariantB(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    slide.background = { color: C.ink };

    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: L.slideW, h: 0.15,
      fill: { color: C.accent }, line: { type: 'none' },
    });
    // 下 brand 帯
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: L.slideH - 0.15, w: L.slideW, h: 0.15,
      fill: { color: C.brand }, line: { type: 'none' },
    });

    // 章番号 (中央上、薄く)
    slide.addText(`第 ${slideJson.number || '01'} 章`, {
      x: 0, y: 1.50, w: L.slideW, h: 0.40,
      fontSize: 13, color: C.dark.mute, fontFace: F.jp,
      bold: false, charSpacing: 8,
      align: 'center', valign: 'middle', margin: 0,
    });

    slide.addText(slideJson.title || '', {
      x: 0.5, y: 2.20, w: L.slideW - 1.0, h: 1.20,
      fontSize: 40, color: C.white, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0, charSpacing: 0, fit: 'shrink',
    });

    if (slideJson.subtitle) {
      slide.addText(slideJson.subtitle, {
        x: 0.5, y: 3.60, w: L.slideW - 1.0, h: 0.60,
        fontSize: 14, color: C.dark.sub, fontFace: F.jp,
        align: 'center', valign: 'middle', margin: 0,
        lineSpacingMultiple: L.lineSpacingMultiple,
      });
    }

    // ページ番号 (右下、白系)
    slide.addText([
      { text: String(ctx.pageNum.value).padStart(2, '0'), options: { color: C.dark.text, bold: true } },
      { text: ` / ${ctx.totalPages}`, options: { color: C.dark.page } },
    ], {
      x: 8.3, y: L.footerY - 0.25, w: 1.3, h: L.footerH,
      fontSize: 9, fontFace: F.jp, align: 'right', margin: 0,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'SECTION-5（章扉バリアント B）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderSection5VariantB };
})();

// ─── section-6-toc.js ────────────────────────────────────────────
const { renderSection6Toc } = (function () {
  /**
   * SECTION-6 統合目次 (Category A: STRUCTURE)
   * =======================================
   * 2 カラム × N 行のグリッドカード型に再設計。
   * 各章カードは「番号 (大) + 章タイトル (太) + overview (1 行サブ)」のシンプル構造。
   * subsections は表示しない (情報密度を抑え、ビジュアルでリズムを作る)。
   *
   * 期待 JSON:
   *   {
   *     title: "本日の流れ",
   *     subtitle: "...",
   *     chapters: [
   *       { num: "01", title: "...", overview: "..." },
   *       ...
   *     ]
   *   }
   */


  const atoms = require('../atoms');

  function renderSection6Toc(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || '本日の流れ',
      slideJson.subtitle || '',
      { noNav: true },
    );

    const chapters = Array.isArray(slideJson.chapters) ? slideJson.chapters : [];
    if (chapters.length === 0) return;

    // ── 2 カラム × N 行のグリッド (Genspark refine) ──
    const startY = titleBottomY + 0.06;  // 0.12 → 0.06 (sub-copy 直下スペース圧縮)
    const endY = L.contentBot ?? 5.15;
    const gridH = endY - startY;
    const cols = 2;
    const rows = Math.ceil(chapters.length / cols);
    const colGap = 0.24;
    const rowGap = 0.18;
    const cardW = (10 - L.marginX * 2 - colGap * (cols - 1)) / cols;
    const cardH = (gridH - rowGap * (rows - 1)) / rows;
    //   章数 N と desc 最長文字数に応じて fontSize を段階縮小し、Box 内に収める。
    //   既定 10.5pt / 60+ chars 10pt / 80+ chars 9.5pt / 100+ chars 9pt。
    //   01 のように desc が短いブロックでも全章で同じ fontSize が使われる。
    const descLengths = chapters.map((c) => (c.overview ? String(c.overview).length : 0));
    const maxDescLen = descLengths.length ? Math.max(...descLengths) : 0;
    let descFs = 10.5;
    if (maxDescLen > 100) descFs = 9;
    else if (maxDescLen > 80) descFs = 9.5;
    else if (maxDescLen > 60) descFs = 10;

    chapters.forEach((ch, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = L.marginX + col * (cardW + colGap);
      const y = startY + row * (cardH + rowGap);

      // カード (border のみ・薄罫線で区切る)
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: cardW, h: cardH, rectRadius: L.cardRadius,
        fill: { color: C.canvas }, line: { color: C.gray200, width: L.lineWidth },
      });

      // 番号 (控えめに。1.15"→0.70", 40pt→30pt)
      // 旧設計は番号枠が広すぎてタイトル領域を圧迫し折返しが起きていた。
      const numW = 0.70;
      slide.addText(ch.num || String(idx + 1).padStart(2, '0'), {
        x: x + L.cardPad - 0.05, y: y + 0.10, w: numW, h: 0.50,
        fontSize: 30, color: C.brand, fontFace: F.jp, bold: true,
        align: 'left', valign: 'top', margin: 0, charSpacing: -0.5,
      });

      // タイトル (太字) + overview (1 行サブ) — テキスト領域を拡大
      //   旧: '　' (fontSize 5) + breakLine で空行を 1 行挟んでいた → 1 行タイトルの時に
      //       不要な余白が生まれて「03 [空行] 説明文」のような間延びが起きていた
      //   新: タイトル末尾に breakLine: true を付けるだけで自然に改行 (タイトルの行高で詰まる)
      const textX = x + numW + 0.18;
      const textW = cardW - numW - 0.18 - L.cardPad;
      if (ch.overview) {
        slide.addText([
          { text: ch.title || '', options: { fontSize: 15, bold: true, color: C.ink, breakLine: true } },
          { text: ch.overview,    options: { fontSize: descFs, color: C.gray700 } },
        ], {
          x: textX, y: y + 0.14, w: textW, h: cardH - 0.20,
          fontFace: F.jp, valign: 'top', margin: 0,
          lineSpacingMultiple: L.lineSpacingMultiple,
        });
      } else {
        slide.addText(ch.title || '', {
          x: textX, y: y + 0.14, w: textW, h: cardH - 0.20,
          fontSize: 16, color: C.ink, fontFace: F.jp,
          bold: true, valign: 'top', margin: 0,
        });
      }
    });

    // Chrome (ナビなし、ページ番号のみ)
    atoms.addChrome(ctx, slide, ctx.pageNum.value);

    // Speaker Notes
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'SECTION-6（統合目次・2カラムグリッド）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderSection6Toc };
})();


// ─── section-7-subsection.js (v11.6 新規 / Phase γ) ──────────────
const { renderSection7Subsection } = (function () {
  /**
   * SECTION-7 サブセクション扉 (v11.6 新規 / Category A: STRUCTURE)
   * ============================================================
   * 本章中の小章遷移 (e.g., 3 章「設計編」→ 3.1「アーキテクチャ」)。
   * SECTION-2/4/5 より小さい印象で、章扉と本文の間に挟む。
   *
   * 期待 JSON:
   *   { number: '3.1', title: '...', subtitle?: '...', parent_title?: '3 章: 設計編' }
   */
  const atoms = require('../atoms');
  function renderSection7Subsection(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);

    // 親章ラベル (上部、小さく)
    if (slideJson.parent_title) {
      slide.addText(slideJson.parent_title, {
        x: L.marginX, y: 0.55, w: 10 - L.marginX * 2, h: 0.30,
        fontSize: 11, color: C.gray500, fontFace: F.jp,
        bold: true, align: 'left', valign: 'middle', margin: 0,
      });
    }

    // 番号 + タイトル (中央寄り)
    const numText = slideJson.number || '1.1';
    slide.addText(numText, {
      x: L.marginX, y: 1.40, w: 4, h: 0.80,
      fontSize: 60, color: C.brand, fontFace: F.jp, bold: true,
      align: 'left', valign: 'top', margin: 0, charSpacing: 0,
    });

    slide.addText(slideJson.title || '', {
      x: L.marginX, y: 2.45, w: 10 - L.marginX * 2, h: 0.80,
      fontSize: 26, color: C.ink, fontFace: F.jp, bold: true,
      align: 'left', valign: 'top', margin: 0,
    });

    // 細い brand 横線
    slide.addShape(pres.shapes.RECTANGLE, {
      x: L.marginX, y: 3.35, w: 1.20, h: 0.030,
      fill: { color: C.brand }, line: { type: 'none' },
    });

    // サブタイトル
    if (slideJson.subtitle) {
      slide.addText(slideJson.subtitle, {
        x: L.marginX, y: 3.50, w: 10 - L.marginX * 2, h: 0.60,
        fontSize: 13, color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 1.30,
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
        template: 'SECTION-7（サブセクション扉）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderSection7Subsection };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'SECTION-1':  renderSection1ACover,   // alias
  'SECTION-1A': renderSection1ACover,   // Twilight Forge シンプル版 (現行)
  'SECTION-1B': renderSection1BCover,   // エディトリアル分割
  'SECTION-1D': renderSection1DCover,   // ミニマル・タイポグラフィ
  'SECTION-1F': renderSection1FCover,   // 引用主導
  'SECTION-1G': renderSection1GCover,   // full-bleed SVG only
  'SECTION-2': renderSection2Section,
  'SECTION-3': renderSection3Closing,
  'SECTION-4': renderSection4VariantA,
  'SECTION-5': renderSection5VariantB,
  'SECTION-6': renderSection6Toc,
  'SECTION-7': renderSection7Subsection,  // v11.6: サブセクション扉
};
