'use strict';

// =============================================================
// templates/framing.js
// -------------------------------------------------------------
// Consolidated from templates/framing/*.js.
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

// ─── framing-1-background.js ─────────────────────────────────────
const { renderFraming1Background } = (function () {
  /**
   * FRAMING-1 構築背景 (Category J: FRAMING)
   * =====================================
   * 序盤の固定枠（表紙 → 構築背景 → Before/After リスト → 目次）の 2 枚目。
   * 「現場で実際に詰まったポイント」を語るための 3 ブロック構成テンプレ。
   *
   * 期待 JSON 構造:
   *   {
   *     id: "S2",
   *     template_id: "FRAMING-1",
   *     title:    "なぜこのデッキを作ったのか",
   *     subtitle: "...",
   *     section_id: "intro",
   *     block_kikkake: "業種 + 規模 + 担当者の固有名詞 + 出来事...",
   *     block_kizuki:  "現場で見えた問題の核心...",
   *     block_gimon:   "このデッキで答えるべき問い..."
   *   }
   *
   * 必須フィールド (SchemaQA-01): block_kikkake / block_kizuki / block_gimon
   */


  const atoms = require('../atoms');

  function renderFraming1Background(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || 'なぜこのデッキを作ったのか',
      slideJson.subtitle || '',
    );

    // 3 ブロック横並び
    const blocks = [
      {
        icon: '01',
        label: 'きっかけ',
        body: slideJson.block_kikkake || '',
        tone: 'brand',
      },
      {
        icon: '02',
        label: '現場で気付いたこと',
        body: slideJson.block_kizuki || '',
        tone: 'gray',
      },
      {
        icon: '03',
        label: 'このデッキで解消したい疑問',
        body: slideJson.block_gimon || '',
        tone: 'accent',
      },
    ];

    const colW = 2.93;
    const gap = 0.10;
    const startY = L.contentY + 0.10;
    const blockH = L.contentBot - startY - 0.10;

    blocks.forEach((b, i) => {
      const bx = L.marginX + (colW + gap) * i;

      // 背景カード
      // v11.4: amber 塗り fill → white + 左バー (v9 改修方針 LIST-3 流に揃える)
      const accentColor = b.tone === 'brand' ? C.brand
                        : b.tone === 'accent' ? C.accent
                        : C.gray400;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: bx, y: startY, w: colW, h: blockH, rectRadius: 0.08,
        fill: { color: C.white }, line: { color: C.gray200, width: 0.5 },
      });
      // 左 0.05" バーで強調 (3 ステップの順序感を保ちつつ amber 塗りを撤廃)
      slide.addShape(pres.shapes.RECTANGLE, {
        x: bx, y: startY, w: 0.05, h: blockH,
        fill: { color: accentColor }, line: { type: 'none' },
      });

      // 番号バッジ（左上）
      const badgeColor = b.tone === 'brand' ? C.brand
                       : b.tone === 'accent' ? C.accent
                       : C.gray700;
      slide.addText(b.icon, {
        x: bx + 0.20, y: startY + 0.20, w: 0.50, h: 0.40,
        fontSize: 18, color: badgeColor, fontFace: F.jp, bold: true,
        align: 'left', valign: 'top', margin: 0,
      });

      // ラベル（右上、横並び）
      slide.addText(b.label, {
        x: bx + 0.75, y: startY + 0.22, w: colW - 0.95, h: 0.36,
        fontSize: 13, color: C.ink, fontFace: F.jp, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });

      // 本文
      slide.addText(b.body, {
        x: bx + 0.20, y: startY + 0.75, w: colW - 0.40, h: blockH - 0.85,
        fontSize: 11, color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0,
        paraSpaceAfter: 4,
      });
    });

    // Chrome
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, slideJson.subsection || null);
    }

    // Speaker Notes
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'FRAMING-1（構築背景・3 ブロック）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderFraming1Background };
})();

// ─── framing-2-before-after-list.js ──────────────────────────────
const { renderFraming2BeforeAfterList } = (function () {
  /**
   * FRAMING-2 Before/After リスト (Category J: FRAMING)
   * ================================================
   * ヘッダー行 (Before / After) を上部に独立配置 + カードは border-only に。
   * 期待 JSON: { items: [{ before, after, n? }] } (4-6 件)
   */


  const atoms = require('../atoms');

  function renderFraming2BeforeAfterList(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(
      ctx, slide,
      slideJson.title || 'このデッキで解消する疑問',
      slideJson.subtitle || '読み終えるころには、それぞれの疑問に「自分の言葉」で答えられる状態を目指します。',
    );

    const items = Array.isArray(slideJson.items) ? slideJson.items : [];
    if (items.length === 0) return;

    // ── レイアウト定数 ──
    const headerY = titleBottomY + 0.05;
    const headerH = 0.30;
    const startY  = headerY + headerH + 0.05;
    const rowGap  = 0.14;
    const numColW   = 0.80;   // 番号列
    const beforeW   = 4.20;
    const arrowW    = 0.50;
    const afterW    = 9.20 - numColW - beforeW - arrowW;

    const beforeX = L.marginX + numColW;
    const arrowX  = beforeX + beforeW;
    const afterX  = arrowX + arrowW;

    // ── ヘッダー行 (Before / After) ──
    slide.addText('Before（現状の課題）', {
      x: beforeX, y: headerY, w: beforeW, h: headerH,
      fontSize: 11, color: C.gray500 || C.gray700, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', margin: 0, charSpacing: 0.5,
    });
    slide.addText('After（本資料活用後）', {
      x: afterX, y: headerY, w: afterW, h: headerH,
      fontSize: 11, color: C.accentDeep || C.accent, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', margin: 0, charSpacing: 0.5,
    });

    // ── 行 ──
    const availH = (L.contentBot - startY) - rowGap * (items.length - 1);
    const rowH = availH / items.length;

    items.forEach((it, i) => {
      const ry = startY + i * (rowH + rowGap);
      const n = it.n || String(i + 1).padStart(2, '0');

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: L.marginX, y: ry, w: 9.20, h: rowH, rectRadius: L.cardRadiusSmall,
        fill: { color: C.canvas }, line: { color: C.gray200, width: L.lineWidth },
      });

      slide.addText(n, {
        x: L.marginX + 0.10, y: ry, w: numColW - 0.20, h: rowH,
        fontSize: 24, color: C.brand, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0, charSpacing: -1,
      });

      slide.addText(it.before || '', {
        x: beforeX + 0.10, y: ry, w: beforeW - 0.20, h: rowH,
        fontSize: atoms.shrinkFontSize(it.before, 13, 60), color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'middle', margin: 0,
      });

      slide.addText('→', {
        x: arrowX, y: ry, w: arrowW, h: rowH,
        fontSize: 20, color: C.accent, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });

      slide.addText(it.after || '', {
        x: afterX + 0.10, y: ry, w: afterW - 0.20, h: rowH,
        fontSize: atoms.shrinkFontSize(it.after, 13, 56), color: C.ink, fontFace: F.jp, bold: true,
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
        template: 'FRAMING-2（Before/After リスト）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderFraming2BeforeAfterList };
})();

// ─── framing-3-company.js ────────────────────────────────────────
const { renderFraming3Company } = (function () {
  /**
   * =============================================================
   * 締めの固定枠 2 枚目（参考資料の後、最終ページ）。
   * HP (enostech.co.jp) の dark hero テイスト。
   * 受賞 (QR 付き) + 主要プロダクト + 代表者情報を 1 枚に集約。
   *
   * 期待 JSON 構造:
   *   {
   *     id: "S9",
   *     template_id: "FRAMING-3",
   *     headline:    "AIエージェントとデータの力で「働く」をアップデート",
   *     subcopy:     "現場発の実装で...",
   *     hp_qr_url:   "https://enostech.co.jp/",
   *     awards: [
   *       { title, org, year, ctx, accent, qr_path, url },
   *       { title, org, year, ctx, accent, qr_path, url }
   *     ],
   *     products: [
   *       { name, desc },
   *       ...  // 4 件
   *     ],
   *     corp: [
   *       ['会社名', '...'],
   *       ['代表',   '...'],
   *       ['設立',   '...'],
   *       ['所在地', '...'],
   *     ]
   *   }
   *
   * 全フィールド optional。省略時はデフォルト ENOSTECH 情報を使う。
   * 締めスライドなのでナビ・サイドストライプ・フッターロゴは置かない。
   */


  const atoms = require('../atoms');

  // Twilight Forge 配色は atoms.TWILIGHT_FORGE に集約
  const TF = atoms.TWILIGHT_FORGE;

  const DEFAULT_AWARDS = [
    {
      title:  'GENIAC PRIZE 領域1：地域賞',
      org:    '経済産業省 / NEDO',
      year:   '2026.03',
      ctx:    '社内AI基盤の導入事例',
      accent: TF.brand,
      qr_asset: 'qr-geniac.png',
      url:    'https://geniac-prize.nedo.go.jp/',
    },
    {
      title:  'AI Agent Hackathon — Moonshot 賞',
      org:    'Google Cloud Japan',
      year:   '2025.10',
      ctx:    '第 2 回 AI Agent Hackathon にて受賞',
      accent: TF.accent,
      qr_asset: 'qr-hackathon.png',
      url:    'https://zenn.dev/hackathons/google-cloud-japan-ai-hackathon-vol2?tab=projects',
    },
  ];

  const DEFAULT_PRODUCTS = [
    { name: 'Qlavis',                desc: 'AIによるヒアリング自動化プラットフォーム' },
    { name: 'EN AIstudio',                 desc: '社内業務向け AI 基盤' },
    { name: '成長バトン',             desc: '地域密着型の AI プロダクト開発支援' },
    { name: 'データ基盤キャラバン',     desc: 'データ基盤構築 + 分析 AI 組織展開' },
  ];

  const DEFAULT_CORP = [
    ['会社名', '株式会社ENOSTECH'],
    ['代表',   '小山内 将宏（おさない まさひろ）'],
    ['設立',   '2023年1月'],
    ['所在地', '東京都港区芝 5-36-4 札の辻スクエア 9F'],
  ];

  function renderFraming3Company(slide, slideJson, ctx) {
    const { L, F, T, pres } = ctx;

    slide.background = { color: TF.canvas };

    const W = L.slideW;
    const MX = 0.42;

    // ─── Atmosphere ───
    atoms.addAtmosphericOrb(ctx, slide, 0.4,  0.0,  4.4, TF.brandSoft);
    atoms.addAtmosphericOrb(ctx, slide, 9.8,  5.8,  4.0, TF.accentSoft);
    atoms.addAtmosphericOrb(ctx, slide, 5.0,  5.6,  2.0, TF.brand,  3);
    atoms.addAtmosphericOrb(ctx, slide, 9.4, -0.2,  1.8, TF.accent, 3);

    // ─── Header — 左上に白ロゴ / 右上に HP QR ───
    const headerY = 0.27;
    const headerLogoH = 0.32;
    const headerLogoW = headerLogoH * (824 / 152);
    slide.addImage({
      path: T.logoPath('horizontalWhite'),
      x: MX, y: headerY, w: headerLogoW, h: headerLogoH,
    });
    const qrSize = 0.62;
    const qrX = W - MX - qrSize;
    const qrY = headerY - 0.13;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: qrX - 0.04, y: qrY - 0.04, w: qrSize + 0.08, h: qrSize + 0.08,
      rectRadius: 0.04,
      fill: { color: TF.canvas },
      line: { color: TF.cardLineHi, width: 0.25 },
    });
    slide.addImage({
      path: T.eno45Asset('qr-hp.png'),
      x: qrX, y: qrY, w: qrSize, h: qrSize,
      hyperlink: {
        url: slideJson.hp_qr_url || 'https://enostech.co.jp/',
        tooltip: '株式会社ENOSTECH 公式サイト',
      },
    });

    // ─── Hero ───
    slide.addText(
      slideJson.headline || 'AIエージェントとデータの力で「働く」をアップデート',
      {
        x: MX, y: 0.98, w: W - MX * 2, h: 0.62,
        fontSize: 22, color: TF.ink, fontFace: F.jp,
        bold: true, charSpacing: 0,
        align: 'center', valign: 'middle', margin: 0,
      },
    );
    slide.addText(
      slideJson.subcopy || '現場発の実装で、AIエージェント開発とデータ利活用支援を行う技術パートナー。',
      {
        x: MX, y: 1.65, w: W - MX * 2, h: 0.30,
        fontSize: 10.5, color: TF.inkSoft, fontFace: F.jp,
        bold: false, charSpacing: 1,
        align: 'center', valign: 'middle', margin: 0,
      },
    );

    // hairline + signature gradient pill
    const horizonY = 2.13;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: MX, y: horizonY, w: W - MX * 2, h: 0.005,
      fill: { color: TF.hairline }, line: { type: 'none' },
    });
    const pillTotalW = 1.80;
    const pillX = (W - pillTotalW) / 2;
    atoms.addGradientPill(ctx, slide, pillX, horizonY);

    // ─── 受賞 cards ───
    const awards = (Array.isArray(slideJson.awards) && slideJson.awards.length > 0) ? slideJson.awards : DEFAULT_AWARDS;
    const awardY = 2.40;
    const awardH = 1.18;
    const awardGap = 0.18;
    const awardW = (W - MX * 2 - awardGap) / 2;

    awards.slice(0, 2).forEach((a, i) => {
      const ax = MX + (awardW + awardGap) * i;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: ax, y: awardY, w: awardW, h: awardH, rectRadius: 0.05,
        fill: { color: TF.cardFill, transparency: 12 },
        line: { color: TF.cardLine, width: 0.75 },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: ax, y: awardY, w: 0.045, h: awardH,
        fill: { color: a.accent || TF.brand }, line: { type: 'none' },
      });

      // 右側 QR スロット
      const qSize = 0.86;
      const qSlotX = ax + awardW - 0.16 - qSize;
      const qSlotY = awardY + (awardH - qSize) / 2;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: qSlotX - 0.04, y: qSlotY - 0.04, w: qSize + 0.08, h: qSize + 0.08,
        rectRadius: 0.04,
        fill: { color: TF.cardFill },
        line: { color: a.accent || TF.brand, width: 0.25 },
      });
      const qrPath = a.qr_asset ? T.eno45Asset(a.qr_asset)
                                : (a.qr_path || T.eno45Asset('qr-hp.png'));
      slide.addImage({
        path: qrPath,
        x: qSlotX, y: qSlotY, w: qSize, h: qSize,
        sizing: { type: 'contain', w: qSize, h: qSize },
        hyperlink: { url: a.url || '', tooltip: (a.title || '') + ' 詳細を見る' },
      });

      // テキスト列
      const textW = awardW - 0.40 - (qSize + 0.20);
      slide.addText('受賞', {
        x: ax + 0.22, y: awardY + 0.13, w: 1.2, h: 0.20,
        fontSize: 8, color: a.accent || TF.brand, fontFace: F.jp,
        bold: true, charSpacing: 1,
        align: 'left', valign: 'middle', margin: 0,
      });
      slide.addText(a.year || '', {
        x: ax + 0.22 + textW - 0.9, y: awardY + 0.13, w: 0.9, h: 0.20,
        fontSize: 8.5, color: TF.inkMute, fontFace: F.jp,
        bold: false, charSpacing: 2,
        align: 'right', valign: 'middle', margin: 0,
      });
      slide.addText(a.title || '', {
        x: ax + 0.22, y: awardY + 0.34, w: textW, h: 0.34,
        fontSize: 12, color: TF.ink, fontFace: F.jp,
        bold: true, charSpacing: 0,
        align: 'left', valign: 'top', margin: 0,
      });
      slide.addText(a.org || '', {
        x: ax + 0.22, y: awardY + 0.72, w: textW, h: 0.20,
        fontSize: 10, color: TF.inkSoft, fontFace: F.jp, bold: true,
        align: 'left', valign: 'top', margin: 0, charSpacing: 1,
      });
      slide.addText(a.ctx || '', {
        x: ax + 0.22, y: awardY + 0.92, w: textW, h: 0.22,
        fontSize: 8.5, color: TF.inkMute, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0, charSpacing: 1,
      });
    });

    // ─── 下段: 主要プロダクト + 会社情報 ───
    const products = (Array.isArray(slideJson.products) && slideJson.products.length > 0) ? slideJson.products : DEFAULT_PRODUCTS;
    const corp = (Array.isArray(slideJson.corp) && slideJson.corp.length >= 4) ? slideJson.corp : DEFAULT_CORP;

    const lowY = 3.74;
    const lowGap = 0.18;
    const lowW = (W - MX * 2 - lowGap) / 2;

    // 左: 主要プロダクト
    const prodX = MX;
    slide.addText('主要プロダクト', {
      x: prodX, y: lowY, w: lowW, h: 0.24,
      fontSize: 9.5, color: TF.ink, fontFace: F.jp,
      bold: true, charSpacing: 1,
      align: 'left', valign: 'middle', margin: 0,
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: prodX, y: lowY + 0.30, w: lowW, h: 0.005,
      fill: { color: TF.hairline }, line: { type: 'none' },
    });
    products.slice(0, 4).forEach((p, i) => {
      const py = lowY + 0.42 + i * 0.24;
      slide.addText(String(i + 1).padStart(2, '0'), {
        x: prodX, y: py, w: 0.30, h: 0.20,
        fontSize: 8, color: TF.inkFaint, fontFace: F.jp,
        bold: false, charSpacing: 1,
        align: 'left', valign: 'middle', margin: 0,
      });
      slide.addText([
        { text: p.name, options: { color: TF.ink, bold: true, fontSize: 10, fontFace: F.jp } },
        { text: '   ' + (p.desc || ''), options: { color: TF.inkMute, fontSize: 9, fontFace: F.jp } },
      ], {
        x: prodX + 0.32, y: py, w: lowW - 0.34, h: 0.20,
        align: 'left', valign: 'middle', margin: 0, charSpacing: 1,
      });
    });

    // 右: 会社情報
    const corpX = MX + lowW + lowGap;
    slide.addText('会社情報', {
      x: corpX, y: lowY, w: lowW, h: 0.24,
      fontSize: 9.5, color: TF.ink, fontFace: F.jp,
      bold: true, charSpacing: 1,
      align: 'left', valign: 'middle', margin: 0,
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: corpX, y: lowY + 0.30, w: lowW, h: 0.005,
      fill: { color: TF.hairline }, line: { type: 'none' },
    });
    corp.slice(0, 4).forEach((row, i) => {
      const ry = lowY + 0.42 + i * 0.24;
      slide.addText(row[0] || '', {
        x: corpX, y: ry, w: 0.85, h: 0.20,
        fontSize: 8, color: TF.inkMute, fontFace: F.jp,
        bold: false, charSpacing: 2,
        align: 'left', valign: 'middle', margin: 0,
      });
      slide.addText(row[1] || '', {
        x: corpX + 0.85, y: ry, w: lowW - 0.85, h: 0.20,
        fontSize: 9.5, color: TF.ink, fontFace: F.jp,
        bold: false, charSpacing: 1,
        align: 'left', valign: 'middle', margin: 0,
      });
    });

    // 締めスライドなのでナビ・フッターロゴ・サイドストライプは置かない
    // Speaker Notes
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'FRAMING-3（会社紹介・Twilight Forge 版）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.headline || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderFraming3Company };
})();

// ─── framing-4-souvenir.js ───────────────────────────────────────
const { renderFraming4Souvenir } = (function () {
  /**
   * FRAMING-4 お土産 (Category J: FRAMING)
   * ===================================
   * 持ち帰りパック の 1 件深掘り。左: 大アイコン円、右: バッジ + タイトル + 説明 + 使い方。
   * 期待 JSON: { omiyage: { category, icon, title, body, scene } }
   */


  const atoms = require('../atoms');

  /**
   * 「**太字**」マーカーをアンバー bold runs に分解する。
   * (N) 引用展開は build-deck.js の addText モンキーパッチが拾うので、
   * ここでは bold 強調だけを runs[] にする。
   */
  function parseBoldRuns(src, baseOpts, accentColor) {
    if (!src) return [{ text: '', options: baseOpts }];
    const re = /\*\*([^*]+)\*\*/g;
    const out = [];
    let cursor = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > cursor) {
        out.push({ text: src.slice(cursor, m.index), options: Object.assign({}, baseOpts) });
      }
      out.push({
        text: m[1],
        options: Object.assign({}, baseOpts, { bold: true, color: accentColor }),
      });
      cursor = m.index + m[0].length;
    }
    if (cursor < src.length) {
      out.push({ text: src.slice(cursor), options: Object.assign({}, baseOpts) });
    }
    if (out.length === 0) return [{ text: src, options: baseOpts }];
    return out;
  }

  /**
   * cheatsheet を 1 項目 1 行に分割。
   * 優先順:
   *   (1) Step\d+: パターンが 2 件以上 → ` / Step\d+:` で split (Step 単位)
   *   (2) ` / ` 区切りが 3 件以上 → 素朴に ` / ` で split (括弧内 `/` は前後に空白が無いため誤分割しない)
   *   (3) 改行 \n 含み → \n で split
   *   (4) それ以外 → 単一項目として返す
   */
  function splitCheatsheetSteps(body) {
    if (!body) return [];
    const stepMatches = body.match(/Step\d+\s*[:：]/g);
    if (Array.isArray(stepMatches) && stepMatches.length >= 2) {
      return body.split(/\s*\/\s*(?=Step\d+\s*[:：])/).map(p => p.trim()).filter(Boolean);
    }
    // N) ナンバー付き (1) ..., 2) ..., 3) ...) — `/` 直後の N) で split
    const numberedMatches = body.match(/(?:^|\s|\/)\s*\d{1,2}\)\s/g);
    if (Array.isArray(numberedMatches) && numberedMatches.length >= 2) {
      return body.split(/\s*\/\s*(?=\d{1,2}\)\s)/).map(p => p.trim()).filter(Boolean);
    }
    const slashCount = (body.match(/\s\/\s/g) || []).length;
    if (slashCount >= 2) {
      return body.split(/\s+\/\s+/).map(p => p.trim()).filter(Boolean);
    }
    if (body.includes('\n')) {
      return body.split(/\n+/).map(p => p.trim()).filter(Boolean);
    }
    return [body];
  }

  function isCheatsheetBody(body) {
    if (!body || typeof body !== 'string') return false;
    // (a) Step\d+: が 2 件以上
    const matches = body.match(/Step\d+\s*[:：]/g);
    if (Array.isArray(matches) && matches.length >= 2) return true;
    // (b) `1) ... / 2) ... / 3) ...` のような N) パターン (2 件以上)
    const numberedMatches = body.match(/(^|\s|\/)\s*\d{1,2}\)\s/g);
    if (Array.isArray(numberedMatches) && numberedMatches.length >= 2) return true;
    // (c) ` / ` 区切りが 2 件以上 + 全体長 80 字超 (3 項目以上の列)
    const slashCount = (body.match(/\s\/\s/g) || []).length;
    if (slashCount >= 2 && body.length >= 80) return true;
    // (d) 改行が 1 件以上
    const lineCount = (body.match(/\n/g) || []).length;
    if (lineCount >= 1) return true;
    // (e) 本文が極端に長い (180 字超) → cheatsheet 扱いで縮小フォント
    if (body.length >= 180) return true;
    return false;
  }

  function renderFraming4Souvenir(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const omiyage = slideJson.omiyage || {};
    const isCheatsheet = (omiyage.kind === 'cheatsheet') || isCheatsheetBody(omiyage.body);

    // レイアウト
    const topY = L.contentY + 0.10;
    const botY = L.contentBot;
    const cardH = botY - topY;
    const leftW = 3.50;
    const gap = 0.30;
    const rightW = 10 - L.marginX * 2 - leftW - gap;
    const leftX = L.marginX;
    const rightX = leftX + leftW + gap;

    // 左カード
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: leftX, y: topY, w: leftW, h: cardH, rectRadius: 0.08,
      fill: { color: C.white },
      line: { color: C.brandSoft, width: 1.0 },
    });
    const iconD = 1.95;
    const iconCx = leftX + leftW / 2;
    const iconCy = topY + cardH / 2 - 0.30;
    slide.addShape(pres.shapes.OVAL, {
      x: iconCx - iconD / 2, y: iconCy - iconD / 2, w: iconD, h: iconD,
      fill: { color: C.brandSoft }, line: { type: 'none' },
    });
    slide.addText(omiyage.icon || '◎', {
      x: iconCx - iconD / 2, y: iconCy - iconD / 2, w: iconD, h: iconD,
      fontSize: 76, color: C.brand, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: iconCx - 0.22, y: iconCy + iconD / 2 + 0.20, w: 0.44, h: 0.045,
      fill: { color: C.accent }, line: { type: 'none' },
    });
    slide.addText('持ち帰りパック', {
      x: leftX, y: iconCy + iconD / 2 + 0.32, w: leftW, h: 0.30,
      fontSize: 11, color: C.gray700, fontFace: F.jp,
      align: 'center', valign: 'top', margin: 0, charSpacing: 1,
    });

    // 右カード
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: rightX, y: topY, w: rightW, h: cardH, rectRadius: 0.08,
      fill: { color: C.white },
      line: { color: C.gray300, width: 1.0 },
    });

    const padX = 0.30;
    const innerX = rightX + padX;
    const innerW = rightW - padX * 2;

    // ─── badge (左上) ────────────────────────────────────────
    let cy = topY + 0.28;
    const badgeText = omiyage.category || '学び';
    const badgeW = Math.max(0.75, badgeText.length * 0.13 + 0.32);
    slide.addShape(pres.shapes.RECTANGLE, {
      x: innerX, y: cy, w: badgeW, h: 0.28,
      fill: { color: C.brand }, line: { type: 'none' },
    });
    slide.addText(badgeText, {
      x: innerX, y: cy, w: badgeW, h: 0.28,
      fontSize: 10, color: C.white, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0, charSpacing: 1,
    });
    cy += 0.40;

    // ─── 強調タイトル (オレンジ帯ではなく ink 太字。`**` があれば accent 強調) ──
    const titleText = omiyage.title || '';
    const titleH = 0.50;
    const titleFs = atoms.shrinkFontSize(titleText, 18, 30, { minFs: 14, perStep: 4 });
    slide.addText(parseBoldRuns(titleText, { fontSize: titleFs, color: C.ink, fontFace: F.jp, bold: true }, C.accentDeep), {
      x: innerX, y: cy, w: innerW, h: titleH,
      fontFace: F.jp, align: 'left', valign: 'top', margin: 0,
      lineSpacingMultiple: 1.2,
    });
    cy += titleH + 0.10;

    // ─── divider (タイトルと本文の境界) ──────────────────
    slide.addShape(pres.shapes.LINE, {
      x: innerX, y: cy, w: innerW, h: 0,
      line: { color: C.gray200, width: 0.75 },
    });
    cy += 0.10;

    // ─── 本文 + 「明日からの使い方」 (cheatsheet の場合は scene を縮小し本文に space を渡す) ──
    if (isCheatsheet) {
      // Step1〜N を 1 行ずつに分割し、ナンバー付き runs[] で描画
      const steps = splitCheatsheetSteps(omiyage.body);
      const sceneText = (omiyage.scene || '').trim();
      // cheatsheet は Step 列が主役。scene は短文 (1 行) のみ末尾に縦書き脚注として配置。
      // ステップ数が 5 以上なら scene は speaker notes 側に流して描画スキップ。
      const showSceneFooter = sceneText.length > 0 && steps.length <= 5 && sceneText.length <= 80;
      const sceneBlockH = showSceneFooter ? 0.40 : 0;
      const bodyH = botY - cy - 0.10 - sceneBlockH;

      // step 数 + 平均文字数に応じて fontSize を決定。
      // ベアフット S34 のような 7 step × 平均 70 字でも収まるよう default 10pt まで下げる
      const totalLen = steps.reduce((acc, s) => acc + s.length, 0);
      const avgLen = steps.length ? totalLen / steps.length : 0;
      let stepFs;
      if (steps.length >= 7 || avgLen > 80) stepFs = 9.5;
      else if (steps.length >= 5 || avgLen > 50) stepFs = 10.5;
      else stepFs = 11.5;

      const baseStepOpts = { fontSize: stepFs, color: C.gray700, fontFace: F.jp };
      const runs = [];
      steps.forEach((step, i) => {
        // (a) 「Step1:」「Step2:」スタイル
        let m = step.match(/^(Step\d+\s*[:：]\s*)([\s\S]*)$/);
        // (b) 「1) ...」スタイル
        if (!m) m = step.match(/^(\d{1,2}\)\s*)([\s\S]*)$/);
        if (m) {
          runs.push({ text: m[1], options: Object.assign({}, baseStepOpts, { bold: true, color: C.accentDeep }) });
          // 本文部分は ** parsing に任せる
          const bodyParts = parseBoldRuns(m[2], baseStepOpts, C.accentDeep);
          for (let j = 0; j < bodyParts.length; j++) {
            const last = j === bodyParts.length - 1;
            const bp = bodyParts[j];
            if (last && i < steps.length - 1) {
              runs.push({ text: bp.text, options: Object.assign({}, bp.options, { breakLine: true }) });
            } else {
              runs.push(bp);
            }
          }
        } else {
          // 番号なしフォールバック (・ プレフィクス)
          const bodyParts = parseBoldRuns('・' + step, baseStepOpts, C.accentDeep);
          for (let j = 0; j < bodyParts.length; j++) {
            const last = j === bodyParts.length - 1;
            const bp = bodyParts[j];
            if (last && i < steps.length - 1) {
              runs.push({ text: bp.text, options: Object.assign({}, bp.options, { breakLine: true }) });
            } else {
              runs.push(bp);
            }
          }
        }
      });
      slide.addText(runs, {
        x: innerX, y: cy, w: innerW, h: bodyH,
        fontFace: F.jp, align: 'left', valign: 'top', margin: 0,
        lineSpacingMultiple: 1.40, paraSpaceAfter: 2,
      });
      cy += bodyH + 0.05;

      if (showSceneFooter) {
        // scene を 1 行の控えめなフッタ italic で。divider を上に置き本文と分離
        slide.addShape(pres.shapes.LINE, {
          x: innerX, y: cy, w: innerW, h: 0,
          line: { color: C.gray200, width: 0.25, dashType: 'dash' },
        });
        slide.addText(parseBoldRuns('使う場面: ' + sceneText, { fontSize: 9.5, color: C.gray500, fontFace: F.jp, italic: true }, C.accentDeep), {
          x: innerX, y: cy + 0.04, w: innerW, h: 0.32,
          fontFace: F.jp, align: 'left', valign: 'middle', margin: 0,
        });
      }
    } else {
      // ─── 通常モード (ベースライン互換) ──────────────────
      const bodyText = omiyage.body || '';
      const sceneText = (omiyage.scene || '').trim();
      const hasScene = sceneText.length > 0;
      const sceneBlockH = hasScene ? 0.95 : 0;
      const bodyH = botY - cy - 0.20 - sceneBlockH;

      slide.addText(parseBoldRuns(bodyText, { fontSize: 12, color: C.gray700, fontFace: F.jp }, C.accentDeep), {
        x: innerX, y: cy, w: innerW, h: bodyH,
        fontFace: F.jp, align: 'left', valign: 'top', margin: 0,
        lineSpacingMultiple: 1.3,
      });
      cy += bodyH + 0.10;

      if (hasScene) {
        slide.addShape(pres.shapes.RECTANGLE, {
          x: innerX, y: cy + 0.06, w: 0.13, h: 0.13,
          fill: { color: C.accent }, line: { type: 'none' },
        });
        slide.addText('明日からの使い方', {
          x: innerX + 0.20, y: cy, w: innerW - 0.20, h: 0.24,
          fontSize: 11, color: C.ink, fontFace: F.jp,
          bold: true, align: 'left', valign: 'middle', margin: 0,
        });
        cy += 0.30;
        slide.addText(parseBoldRuns(sceneText, { fontSize: 12, color: C.gray700, fontFace: F.jp }, C.accentDeep), {
          x: innerX, y: cy, w: innerW, h: botY - cy - 0.12,
          fontFace: F.jp, align: 'left', valign: 'top', margin: 0,
          lineSpacingMultiple: 1.3,
        });
      }
    }

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'FRAMING-4（お土産）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderFraming4Souvenir };
})();

// ─── framing-5-checklist-mindset.js ──────────────────────────────
const { renderFraming5ChecklistMindset } = (function () {
  /**
   * FRAMING-5 チェックリスト + マインドセットカード (Category O: 章末まとめ系)
   * ===================================================================
   * 章末で「最終確認のチェックリスト」を読者に渡す型。
   * 左: チェック項目リスト (□ + ラベル) — 3〜8 件で auto-fit
   * 右: MINDSET カード (eyebrow + 強い見出し + 補足リスト) + 下フッター注釈
   *
   *   - title は plan.json 側で書かなくて良い (固定文言「N 章のポイント」自動生成)。
   *     旧形式 (「X 章の持ち帰り — 〇〇」等) が来た場合は警告 + 自動 normalize。
   *   - items は 3-8 件で柔軟化。
   *     件数に応じてフォントサイズ・行高・チェックボックスサイズを auto-fit。
   *   - WritingQA-19: mindset.title が ですます調必須 (warn / strict 時 fatal)。
   *
   * 期待 JSON:
   *   {
   *     section_id: "ch1-overview",        // 必須。本編章番号自動採番のために使う
   *     subtitle:   "1〜2 行の要約 (ですます調)",
   *     items: ["項目1", "項目2", ...]    // 3-8 件
   *     mindset: {
   *       eyebrow: "MINDSET",
   *       title:   "強いメッセージ。1-2 行 (ですます調)",
   *       points:  ["補足 1", "補足 2", ...]  // 3-5 件
   *     },
   *     footnote: "※ ..."  // optional
   *   }
   */


  const atoms = require('../atoms');

  function renderFraming5ChecklistMindset(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);

    // section_id から本編章番号を引いて自動生成。旧形式 title が来たら警告 + 上書き。
    const chapterNum = atoms.getBodyChapterNum(ctx, slideJson.section_id);
    let computedTitle;
    if (chapterNum) {
      computedTitle = `${chapterNum} 章のポイント`;
      if (slideJson.title && slideJson.title !== computedTitle) {
        console.warn(
          `[v9.22 FRAMING-5] title="${slideJson.title}" を「${computedTitle}」に正規化しました ` +
          `(X 章のポイント 固定仕様)。plan.json の title フィールドは省略可能です。`
        );
      }
    } else {
      // section_id 不明時はフォールバックで slideJson.title を尊重
      computedTitle = slideJson.title || '章末まとめ';
      if (slideJson.section_id) {
        console.warn(
          `[v9.22 FRAMING-5] section_id="${slideJson.section_id}" の本編章番号を解決できませんでした。` +
          `title="${computedTitle}" をそのまま使用します。`
        );
      }
    }

    const titleBottomY = atoms.addTitleBlock(
      ctx, slide,
      computedTitle,
      slideJson.subtitle || '',
    );

    const items = Array.isArray(slideJson.items) ? slideJson.items : [];
    const mindset = slideJson.mindset || {};
    const points = Array.isArray(mindset.points) ? mindset.points : [];
    const startY = titleBottomY + 0.04;  // 0.10 → 0.04 (sub-copy 直下スペース圧縮)
    const footerNote = slideJson.footnote;
    const endY = footerNote ? (L.contentBot - 0.30) : L.contentBot;
    const totalH = endY - startY;
    if (items.length > 8) {
      console.warn(
        `[v9.22 FRAMING-5] items が ${items.length} 件 — 章末まとめは要点を 3-8 件に絞る運用です。` +
        `先頭 8 件で描画します。`
      );
    }
    const renderItems = items.slice(0, 8);

    // ── 左: チェックリスト (幅 4.6") ──
    //   旧: rowH = (totalH - rowGap * (n-1)) / n + valign:middle で全体に均等分散
    //       → 3 件の時に各行が極端に大きくなり「真ん中に浮く」絵になっていた。
    //   新: rowH を件数で等分せず、件数に応じた fixed rowH を使い、上から並べる。
    //       totalH に対して使い切らない (下に空白が残る) のが正常状態。
    const leftX = L.marginX;
    const leftW = 4.60;
    if (renderItems.length > 0) {
      const n = renderItems.length;
      const longestLen = renderItems.reduce(
        (m, it) => Math.max(m, (typeof it === 'string' ? it.length : 0)),
        0
      );
      // 1 件あたりの理想行高 (本文が 1-2 行入る想定)
      let fixedRowH;
      if (n <= 3) fixedRowH = longestLen > 70 ? 0.68 : 0.56;
      else if (n <= 5) fixedRowH = longestLen > 60 ? 0.58 : 0.48;
      else if (n <= 6) fixedRowH = longestLen > 50 ? 0.50 : 0.44;
      else fixedRowH = 0.42;
      const rowGap = n <= 3 ? 0.18 : (n <= 5 ? 0.12 : 0.08);

      // 全体高さを超える場合は等分にフォールバック (auto-fit の保険)
      const stackH = fixedRowH * n + rowGap * (n - 1);
      const rowH = stackH > totalH ? (totalH - rowGap * (n - 1)) / n : fixedRowH;

      // フォントサイズは rowH 基準で決める
      let baseFs;
      if (rowH >= 0.70) baseFs = 12;
      else if (rowH >= 0.58) baseFs = 11.5;
      else if (rowH >= 0.48) baseFs = 11;
      else if (rowH >= 0.40) baseFs = 10.5;
      else baseFs = 10;
      if (longestLen > 60) baseFs -= 0.5;
      if (longestLen > 80) baseFs -= 0.5;
      if (longestLen > 100) baseFs -= 0.5;
      const fs = Math.max(9.5, baseFs);
      const cbSize = Math.min(0.22, Math.max(0.16, rowH * 0.30));
      const labelPadX = cbSize + 0.14;

      renderItems.forEach((it, i) => {
        const y = startY + i * (rowH + rowGap);
        // チェックボックス (テキスト 1 行目に揃える)
        // 旧: amber 罫線で「ここを見て」感が強かった
        // 新: 黒罫線でリスト要素として静かに整列。brand は MINDSET 左バーで 5% 担保
        slide.addShape(pres.shapes.RECTANGLE, {
          x: leftX,
          y: y + 0.06,  // 1 行目の上端に近い位置
          w: cbSize, h: cbSize,
          fill: { color: C.canvas },
          line: { color: C.ink, width: 1.0 },
        });
        // ラベル — valign top に変更 (上揃え)
        slide.addText(it, {
          x: leftX + labelPadX, y, w: leftW - labelPadX, h: rowH,
          fontSize: fs, color: C.ink, fontFace: F.jp,
          align: 'left', valign: 'top', margin: 0,
          lineSpacingMultiple: n >= 6 ? 1.20 : 1.30,
        });
      });
    }

    // ── 右: MINDSET カード (幅 4.5") ──
    //   旧: gray50 fill で全体に薄背景が乗っていた → 野暮ったい
    //   新: canvas (= 透明寄り) + gray200 stroke + amber バーのみ
    const rightX = leftX + leftW + 0.20;
    const rightW = 10 - L.marginX - rightX;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: rightX, y: startY, w: rightW, h: totalH, rectRadius: 0.08,
      fill: { color: C.canvas }, line: { color: C.gray200, width: 0.25 },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: rightX, y: startY, w: 0.06, h: totalH,
      fill: { color: C.brand }, line: { type: 'none' },
    });

    const padX = 0.30;
    const innerX = rightX + padX;
    const innerW = rightW - padX * 2;

    // eyebrow
    const eyebrowY = startY + 0.20;
    slide.addText(mindset.eyebrow || '考え方', {
      x: innerX, y: eyebrowY, w: innerW, h: 0.26,
      fontSize: 10, color: C.brand, fontFace: F.jp, bold: true,
      charSpacing: 2, align: 'left', valign: 'middle', margin: 0,
    });

    const headingY = eyebrowY + 0.30;
    const titleLen = (mindset.title || '').length;
    // 文字数が増えたら高さを増やす (折返し対応)
    let headingH;
    if (titleLen <= 30) headingH = 0.85;
    else if (titleLen <= 50) headingH = 1.10;
    else if (titleLen <= 80) headingH = 1.55;
    else headingH = 1.95;
    // フォントサイズも長文時は控えめに
    let headingFs;
    if (titleLen <= 30) headingFs = 22;
    else if (titleLen <= 50) headingFs = 18;
    else if (titleLen <= 80) headingFs = 16;
    else headingFs = 14;
    slide.addText(mindset.title || '', {
      x: innerX, y: headingY, w: innerW, h: headingH,
      fontSize: headingFs, color: C.ink, fontFace: F.jp, bold: true,
      align: 'left', valign: 'top', margin: 0,
      lineSpacingMultiple: 1.40,
    });

    // 補足リスト (・ で並列)
    if (points.length > 0) {
      const pointsY = headingY + headingH + 0.10;
      const pointsH = Math.max(0.30, totalH - (pointsY - startY) - 0.20);
      const text = points.map(p => '・' + p).join('  ');
      slide.addText(text, {
        x: innerX, y: pointsY, w: innerW, h: pointsH,
        fontSize: 11, color: C.gray700, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0,
        lineSpacingMultiple: 1.4,
      });
    }

    // フッター注釈
    if (footerNote) {
      slide.addText(footerNote, {
        x: leftX, y: endY + 0.05, w: 10 - L.marginX * 2, h: 0.30,
        fontSize: 10, color: C.gray500, fontFace: F.jp,
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
        template: 'FRAMING-5（チェックリスト + マインドセット）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderFraming5ChecklistMindset };
})();


// ─── framing-6-scope.js (v11.6 新規 / Phase γ) ───────────────────
const { renderFraming6Scope } = (function () {
  /**
   * FRAMING-6 期待値整理 (Goal / Non-Goal) (v11.6 新規)
   * =================================================
   * 「このデッキで扱うこと / 扱わないこと」を 2 列で明示。
   * 序盤の固定枠オプションとして、Before/After (FRAMING-2) と並ぶ用途別選択肢。
   *
   * 期待 JSON:
   *   {
   *     goals: ['...', '...', '...'],          // 扱うこと 3-5 件
   *     non_goals: ['...', '...', '...'],      // 扱わないこと 3-5 件
   *   }
   */
  const atoms = require('../atoms');
  function renderFraming6Scope(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || 'このデッキで扱う範囲', slideJson.subtitle || '');
    const goals = Array.isArray(slideJson.goals) ? slideJson.goals.slice(0, 5) : [];
    const nonGoals = Array.isArray(slideJson.non_goals) ? slideJson.non_goals.slice(0, 5) : [];
    const topY = L.contentY + 0.05;
    const totalH = L.contentBot - topY;
    const colW = (10 - L.marginX * 2 - 0.30) / 2;
    const leftX = L.marginX;
    const rightX = leftX + colW + 0.30;

    // 左: 扱うこと
    slide.addShape(pres.shapes.RECTANGLE, {
      x: leftX, y: topY, w: colW, h: 0.36,
      fill: { color: C.brand }, line: { type: 'none' },
    });
    slide.addText('扱うこと', {
      x: leftX, y: topY, w: colW, h: 0.36,
      fontSize: 13, color: C.white, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });
    const lItemY = topY + 0.50;
    const lItemH = (totalH - 0.50) / Math.max(1, goals.length);
    goals.forEach((g, i) => {
      const y = lItemY + i * lItemH;
      slide.addText('◯ ' + g, {
        x: leftX + 0.10, y, w: colW - 0.20, h: lItemH - 0.05,
        fontSize: 12, color: C.ink, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 1.30,
      });
    });

    // 右: 扱わないこと
    slide.addShape(pres.shapes.RECTANGLE, {
      x: rightX, y: topY, w: colW, h: 0.36,
      fill: { color: C.gray500 }, line: { type: 'none' },
    });
    slide.addText('扱わないこと', {
      x: rightX, y: topY, w: colW, h: 0.36,
      fontSize: 13, color: C.white, fontFace: F.jp, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });
    const rItemY = topY + 0.50;
    const rItemH = (totalH - 0.50) / Math.max(1, nonGoals.length);
    nonGoals.forEach((g, i) => {
      const y = rItemY + i * rItemH;
      slide.addText('× ' + g, {
        x: rightX + 0.10, y, w: colW - 0.20, h: rItemH - 0.05,
        fontSize: 12, color: C.gray500, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 1.30,
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
        template: 'FRAMING-6（期待値整理 Goal/Non-Goal）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderFraming6Scope };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'FRAMING-1': renderFraming1Background,
  'FRAMING-2': renderFraming2BeforeAfterList,
  'FRAMING-3': renderFraming3Company,
  'FRAMING-4': renderFraming4Souvenir,
  'FRAMING-5': renderFraming5ChecklistMindset,
  'FRAMING-6': renderFraming6Scope,  // v11.6: Goal/Non-Goal
};
