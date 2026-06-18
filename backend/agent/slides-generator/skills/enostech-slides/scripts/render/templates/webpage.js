'use strict';

// =============================================================
// templates/webpage.js
// -------------------------------------------------------------
// Consolidated from templates/webpage/*.js.
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

// ─── _test.js ────────────────────────────────────────────────────
(function () {
})();

// ─── webpage-1-summary.js ────────────────────────────────────────
const { renderWebpage1Summary } = (function () {
  /**
   * DATA-10 WEBPAGE-1 単独URL解説 (Category R: WEBPAGE)
   * ===========================================================
   * 特定の URL を 1 件取り上げ、ヒーロー画像 + 要約サブコピー + 出典リンクで
   * 1 枚にまとめるテンプレ。ニュース記事 1 本の紹介、参考記事の単独サマリ等に。
   *
   * 共通化したもの。違いは eyebrow ラベルだけ:
   *   - VISUAL-7: 「出典補足 / 参考情報 (N)」
   *   - WEBPAGE-1: site_name または「参考記事」
   *
   * VISUAL-7 は doc.references[].image.enabled=true の自動挿入で生成される
   * 「論文・統計の引用補足」用。WEBPAGE-1 は plan に手動で書く「URL 1 件の単独
   * 解説」用。
   *
   * 期待 JSON:
   *   {
   *     id: "S2",
   *     template_id: "WEBPAGE-1",
   *     title: "山林火災の鎮圧を宣言 — 大槌町、発生から11日目",
   *     subtitle: "岩手県大槌町の平野公三町長が...と発表。住宅延焼の恐れがなくなり...",
   *     image_path: "assets/images/yahoo-otsuchi-fire.jpg",
   *     site_name: "IBC岩手放送 / Yahoo!ニュース",
   *     source: "IBC岩手放送 / Yahoo!ニュース",
   *     article_url: "https://news.yahoo.co.jp/articles/...",
   *     date: "2026-05-02",
   *     fetch_status: "ok"
   *   }
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

  function renderWebpage1Summary(slide, slideJson, ctx) {
    const { L, C, F, SZ, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);

    // eyebrow
    const eyebrowText = slideJson.site_name || '参考記事';
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

    // title
    const title = slideJson.title || '';
    const titleY = eyebrowY + eyebrowH + 0.10;
    const w = 10 - L.marginX * 2;
    const titleFontSize = 18;
    const titleLines = title ? Math.max(1, Math.min(2, Math.ceil(title.length / 35))) : 0;
    const titleH = titleLines === 0 ? 0 : (titleLines === 1 ? 0.42 : 0.78);

    if (title) {
      slide.addText(title, {
        x: L.marginX, y: titleY, w, h: titleH,
        fontSize: titleFontSize, color: C.ink, fontFace: F.jp,
        bold: true, valign: 'top', margin: 0,
        lineSpacingMultiple: 1.30,
      });
    }

    // subtitle (Amber rule + plain lead)
    const subtitle = slideJson.subtitle || slideJson.caption || '';
    const subRuleY = titleY + titleH + 0.05;
    const subTextY = subRuleY + 0.07;

    slide.addShape(pres.shapes.RECTANGLE, {
      x: L.marginX, y: subRuleY, w: 0.55, h: 0.04,
      fill: { color: C.brand }, line: { type: 'none' },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: L.marginX + 0.55, y: subRuleY + 0.018, w: w - 0.55, h: 0.005,
      fill: { color: C.gray300 }, line: { type: 'none' },
    });

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

    // image area
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
        } catch (e) { /* fallback */ }
      }
      const fit = fitImageInBox(boxX, boxY, boxW, boxH, imgW, imgH);
      slide.addImage({ path: slideJson.image_path, x: fit.x, y: fit.y, w: fit.w, h: fit.h });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: fit.x, y: fit.y, w: fit.w, h: fit.h,
        fill: { type: 'none' }, line: { color: C.gray200, width: L.lineWidth },
      });
    } else {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: boxX, y: boxY, w: boxW, h: boxH, rectRadius: L.cardRadius,
        fill: { color: C.gray100 },
        line: { color: C.gray300, width: L.lineWidth, dashType: 'dash' },
      });
      const placeholderMsg = fetchStatus === 'failed'
        ? `画像取得失敗\n${slideJson.fetch_reason ? '理由: ' + slideJson.fetch_reason : ''}`
        : '［ 画像 ］';
      slide.addText(placeholderMsg, {
        x: boxX, y: boxY, w: boxW, h: boxH,
        fontSize: 12, color: C.gray500, fontFace: F.jp,
        italic: true, align: 'center', valign: 'middle', margin: 0,
      });
    }

    // credit
    const creditY = boxY + boxH + 0.08;
    const dateText = slideJson.date ? ` (${slideJson.date})` : (slideJson.year ? ` (${slideJson.year})` : '');
    const sourceLabel = (slideJson.source || '出典') + dateText;
    const articleUrl = slideJson.article_url || slideJson.source_url;

    const creditRuns = [
      { text: '出典: ', options: { fontSize: 10.5, bold: true, color: C.gray700 } },
    ];
    if (articleUrl) {
      creditRuns.push({
        text: sourceLabel,
        options: {
          fontSize: 10.5, color: C.link,
          hyperlink: { url: articleUrl, tooltip: slideJson.source || articleUrl },
          underline: { style: 'sng' },
        },
      });
    } else {
      creditRuns.push({ text: sourceLabel, options: { fontSize: 10.5, color: C.gray700 } });
    }

    slide.addText(creditRuns, {
      x: L.marginX, y: creditY, w: boxW, h: creditH,
      fontFace: F.jp, valign: 'top', margin: 0,
    });

    const pageNum = ctx.pageNum.value;
    atoms.addChromeFull(ctx, slide, pageNum);

    atoms.addSpeakerNotes(ctx, slide, { slideJson,
      template: 'WEBPAGE-1（単独URL解説 / DATA-10）',
      goal: '特定の Web 記事 1 本を画像 + 要約で 1 枚にまとめる',
      message: title || subtitle || '参考記事',
      design: slideJson.image_path
        ? `画像 ${slideJson.image_path} / 出典: ${articleUrl || '(URL未設定)'}`
        : '画像未取得 (fetch_status: ' + fetchStatus + ')',
    });
  }
  return { renderWebpage1Summary };
})();

// ─── webpage-2-card-grid.js ──────────────────────────────────────
const { renderWebpage2CardGrid } = (function () {
  /**
   * DATA-11 WEBPAGE-2 関連URLカードグリッド (Category R: WEBPAGE)
   * ============================================================
   * 4-6 件の Web 記事 (関連 URL) を画像サムネ付きカードグリッドで一覧。
   * ニュース収集・参考リンク集・関連記事の俯瞰に。
   *
   * 「画像サムネ + 媒体名 + 記事タイトル + 1行サマリ」の縦割りに変更。
   *
   * 期待 JSON:
   *   {
   *     id: "S3",
   *     template_id: "WEBPAGE-2",
   *     title: "山林火災 関連報道 5本まとめ",
   *     subtitle: "大槌町・吉里吉里地区の延焼状況をめぐる主要 5 紙の見出しを並列で確認...",
   *     items: [
   *       {
   *         site_name: "TBS NEWS DIG",
   *         article_title: "町長らが現場視察 — 発生から11日目",
   *         summary: "平野町長が地上から3地区を視察、延焼状況を確認...",
   *         image_path: "assets/images/article-1-thumb.jpg",   // 任意 (省略時はプレースホルダ)
   *         article_url: "https://newsdig.tbs.co.jp/articles/-/2640031",
   *         featured: false
   *       },
   *       ...4-6件
   *     ]
   *   }
   */


  const atoms = require('../atoms');

  function renderWebpage2CardGrid(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const items = Array.isArray(slideJson.items) ? slideJson.items : [];
    if (items.length === 0) return;
    const topY = L.contentY;
    const gap = 0.22;
    const colW = (10 - L.marginX * 2 - gap * 2) / 3;
    const rowH = (L.contentBot - topY - gap) / 2;
    const thumbH = rowH * 0.42;

    const hasFeatured = items.some(it => it && it.featured);

    items.slice(0, 6).forEach((p, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = L.marginX + col * (colW + gap);
      const y = topY + row * (rowH + gap);

      // カード枠
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: colW, h: rowH, rectRadius: L.cardRadius,
        fill: { color: p.featured ? C.brandSoft : C.white },
        line: { color: p.featured ? C.brand : C.gray200, width: p.featured ? L.lineWidthStrong : L.lineWidth },
      });

      // 画像サムネ (上半分)
      const imgX = x + 0.14;
      const imgY = y + 0.14;
      const imgW = colW - 0.28;
      if (p.image_path) {
        slide.addImage({ path: p.image_path, x: imgX, y: imgY, w: imgW, h: thumbH, sizing: { type: 'cover', w: imgW, h: thumbH } });
        slide.addShape(pres.shapes.RECTANGLE, {
          x: imgX, y: imgY, w: imgW, h: thumbH,
          fill: { type: 'none' }, line: { color: C.gray200, width: L.lineWidth },
        });
      } else {
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: imgX, y: imgY, w: imgW, h: thumbH, rectRadius: L.cardRadiusSmall,
          fill: { color: C.gray100 },
          line: { color: C.gray300, width: L.lineWidth, dashType: 'dash' },
        });
        slide.addText('［ サムネ ］', {
          x: imgX, y: imgY, w: imgW, h: thumbH,
          fontSize: 9, color: C.gray500, fontFace: F.jp,
          italic: true, align: 'center', valign: 'middle', margin: 0,
        });
      }

      // 媒体名 (画像直下、小さく)
      const metaY = imgY + thumbH + 0.08;
      slide.addText(p.site_name || '', {
        x: x + 0.18, y: metaY, w: colW - 0.36, h: 0.18,
        fontSize: 8.5, color: p.featured ? C.brand : C.gray500,
        fontFace: F.jp, bold: true, margin: 0, charSpacing: 0,
      });

      // 記事タイトル
      const titleY = metaY + 0.20;
      const titleH = 0.52;
      const titleRuns = p.article_url
        ? [{
            text: p.article_title || '',
            options: {
              fontSize: 11, color: C.ink, fontFace: F.jp, bold: true,
              hyperlink: { url: p.article_url, tooltip: p.article_title || '' },
            },
          }]
        : [{ text: p.article_title || '', options: { fontSize: 11, color: C.ink, fontFace: F.jp, bold: true } }];
      slide.addText(titleRuns, {
        x: x + 0.18, y: titleY, w: colW - 0.36, h: titleH,
        valign: 'top', margin: 0, lineSpacingMultiple: 1.30,
      });

      // 1 行サマリ
      if (p.summary) {
        const summaryY = titleY + titleH + 0.04;
        const summaryH = (y + rowH) - summaryY - 0.10;
        slide.addText(p.summary, {
          x: x + 0.18, y: summaryY, w: colW - 0.36, h: summaryH,
          fontSize: 9, color: C.gray700, fontFace: F.jp,
          margin: 0, valign: 'top', lineSpacingMultiple: L.lineSpacingMultiple,
        });
      }
    });

    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    atoms.addSpeakerNotes(ctx, slide, { slideJson,
      template: 'WEBPAGE-2（関連URLカードグリッド / DATA-11）',
      goal: '4-6 件の Web 記事を画像サムネ付きで俯瞰させる',
      message: slideJson.subtitle || slideJson.title || '',
      design: `カード ${items.length} 件 / 画像あり ${items.filter(it => it.image_path).length} 件`,
    });
  }
  return { renderWebpage2CardGrid };
})();

// ─── webpage-3-detail.js ─────────────────────────────────────────
const { renderWebpage3Detail } = (function () {
  /**
   * DATA-12 WEBPAGE-3 1記事詳細解説 (Category R: WEBPAGE)
   * ============================================================
   * 1 つの Web 記事を深掘りする。左に大きめ画像、右に「要点 / 背景・経緯 / 所感」
   * 3 ブロックの読み解きを並べる。ニュースの社内共有 + 担当者所感、
   * 参考論文の精読共有等に使う。
   *
   * 3 つの小見出しブロックに分割した。
   *
   * 期待 JSON:
   *   {
   *     id: "S4",
   *     template_id: "WEBPAGE-3",
   *     title: "山林火災の鎮圧宣言 — 自治体対応の時系列",
   *     subtitle: "発生から鎮圧まで11日間。避難指示の段階解除と現場視察を時系列で読み解く...",
   *     image_path: "assets/images/yahoo-otsuchi-fire.jpg",
   *     site_name: "IBC岩手放送 / Yahoo!ニュース",
   *     article_url: "https://news.yahoo.co.jp/articles/...",
   *     date: "2026-05-02",
   *     blocks: [
   *       { head: "要点", body: "4/22 発生 → 5/2 鎮圧宣言。住宅延焼の恐れがなくなり 4/30 までに避難指示は全解除。" },
   *       { head: "背景・経緯", body: "町内2か所で同時発生。小鎚地区・吉里吉里地区・赤浜地区で延焼確認..." },
   *       { head: "所感・読み解き", body: "鎮圧宣言は鎮火宣言と異なり、再燃の可能性が完全に消えたわけではない..." }
   *     ]
   *   }
   */


  const atoms = require('../atoms');

  function renderWebpage3Detail(slide, slideJson, ctx) {
    const { L, C, F, SZ, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const topY = L.contentY;
    const totalW = 10 - L.marginX * 2;
    const leftW = totalW * 0.42;
    const rightW = totalW - leftW - 0.25;
    const leftX = L.marginX;
    const rightX = leftX + leftW + 0.25;
    const contentH = L.contentBot - topY;

    const imgH = contentH * 0.66;
    const imgY = topY;
    if (slideJson.image_path) {
      slide.addImage({
        path: slideJson.image_path,
        x: leftX, y: imgY, w: leftW, h: imgH,
        sizing: { type: 'cover', w: leftW, h: imgH },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: leftX, y: imgY, w: leftW, h: imgH,
        fill: { type: 'none' }, line: { color: C.gray200, width: L.lineWidth },
      });
    } else {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: leftX, y: imgY, w: leftW, h: imgH, rectRadius: L.cardRadius,
        fill: { color: C.gray100 },
        line: { color: C.gray300, width: L.lineWidth, dashType: 'dash' },
      });
      slide.addText('［ 画像 ］', {
        x: leftX, y: imgY, w: leftW, h: imgH,
        fontSize: 13, color: C.gray500, fontFace: F.jp,
        italic: true, align: 'center', valign: 'middle', margin: 0,
      });
    }

    // ── 左ペイン: 媒体名 + 日付 ──
    const metaY = imgY + imgH + 0.10;
    const siteName = slideJson.site_name || '';
    const dateText = slideJson.date || slideJson.year || '';
    if (siteName) {
      slide.addText(siteName, {
        x: leftX, y: metaY, w: leftW, h: 0.22,
        fontSize: 9.5, color: C.gray500, fontFace: F.jp,
        bold: true, charSpacing: 0.5, margin: 0,
      });
    }
    if (dateText) {
      slide.addText(dateText, {
        x: leftX, y: metaY + 0.22, w: leftW, h: 0.20,
        fontSize: 9, color: C.gray400, fontFace: F.jp,
        margin: 0,
      });
    }

    // ── 左ペイン: 出典リンク ──
    if (slideJson.article_url) {
      const linkY = metaY + 0.50;
      slide.addText([{
        text: '▷ 元記事を開く',
        options: {
          fontSize: 10, color: C.link, fontFace: F.jp, bold: true,
          hyperlink: { url: slideJson.article_url, tooltip: '元記事' },
          underline: { style: 'sng' },
        },
      }], {
        x: leftX, y: linkY, w: leftW, h: 0.22,
        margin: 0, valign: 'top',
      });
    }

    // ── 右ペイン: 3 ブロック ──
    const blocks = Array.isArray(slideJson.blocks) ? slideJson.blocks.slice(0, 3) : [];
    const blockGap = 0.22;
    const blockH = (contentH - blockGap * (blocks.length - 1)) / Math.max(1, blocks.length);

    blocks.forEach((b, i) => {
      const by = topY + i * (blockH + blockGap);

      // 番号バッジ (Brand 帯)
      slide.addShape(pres.shapes.RECTANGLE, {
        x: rightX, y: by + 0.04, w: 0.18, h: 0.04,
        fill: { color: C.brand }, line: { type: 'none' },
      });

      // head
      slide.addText(b.head || '', {
        x: rightX, y: by + 0.10, w: rightW, h: 0.30,
        fontSize: 13, color: C.ink, fontFace: F.jp,
        bold: true, margin: 0,
      });

      // body
      slide.addText(b.body || '', {
        x: rightX, y: by + 0.42, w: rightW, h: blockH - 0.46,
        fontSize: 10.5, color: C.gray700, fontFace: F.jp,
        margin: 0, valign: 'top', lineSpacingMultiple: L.lineSpacingMultiple,
      });
    });

    // ── chrome ──
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    atoms.addSpeakerNotes(ctx, slide, { slideJson,
      template: 'WEBPAGE-3（1記事詳細解説 / DATA-12）',
      goal: '1 つの Web 記事を要点・背景・所感の 3 ブロックで深掘り',
      message: slideJson.title || '',
      design: `画像 ${slideJson.image_path ? 'あり' : '無し'} / ブロック ${blocks.length} 件 / 出典: ${slideJson.article_url || '(未設定)'}`,
    });
  }
  return { renderWebpage3Detail };
})();

// ─── webpage-4-compare.js ────────────────────────────────────────
const { renderWebpage4Compare } = (function () {
  /**
   * DATA-13 WEBPAGE-4 複数記事の論点比較 (Category R: WEBPAGE)
   * ============================================================
   * 同一テーマを扱った 2-3 本の Web 記事を、共通の論点軸 (主張 / 根拠 / 含意 等)
   * で横並びに比較する。同じ事象を異なる媒体がどう書いているかの俯瞰、
   * 競合プロダクトの記事比較、対立軸のあるニュースの両論並列に。
   *
   * 記事カラムに、行を共通論点 (rows) に拡張。各列の上部にサムネ + 媒体名を置く。
   *
   * 期待 JSON:
   *   {
   *     id: "S5",
   *     template_id: "WEBPAGE-4",
   *     title: "鎮圧宣言の捉え方 — 媒体ごとの論調比較",
   *     subtitle: "同一日に出た 3 本の関連記事を「焦点 / 根拠 / 含意」で並列に読み解く。同じ事実でも切り口で印象が変わる...",
   *     row_labels: ["焦点", "根拠", "含意"],
   *     articles: [
   *       {
   *         site_name: "IBC岩手放送",
   *         article_title: "鎮圧を宣言・発生から11日目",
   *         image_path: "assets/images/article-a.jpg",
   *         article_url: "https://...",
   *         cells: ["鎮圧宣言の事実", "町長視察 + 避難指示全解除", "復旧フェーズへ"]
   *       },
   *       {
   *         site_name: "TBS NEWS DIG",
   *         article_title: "町長らが現場視察",
   *         image_path: "assets/images/article-b.jpg",
   *         article_url: "https://...",
   *         cells: ["現場視察の動き", "3地区を地上から確認", "現地状況の継続発信"]
   *       },
   *       {
   *         site_name: "NEWS DIG (続報)",
   *         article_title: "ワカメ収穫を再開",
   *         image_path: "assets/images/article-c.jpg",
   *         article_url: "https://...",
   *         cells: ["生活復旧の象徴", "漁港の漁師が再開", "経済活動の戻り"]
   *       }
   *     ]
   *   }
   */


  const atoms = require('../atoms');

  function renderWebpage4Compare(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const articles = Array.isArray(slideJson.articles) ? slideJson.articles.slice(0, 3) : [];
    const rowLabels = Array.isArray(slideJson.row_labels) ? slideJson.row_labels.slice(0, 3) : [];
    if (articles.length === 0) return;

    const topY = L.contentY;
    const totalW = 10 - L.marginX * 2;
    // 左の row_labels 列 (細め) + 記事カラム (均等)
    const labelColW = rowLabels.length > 0 ? 0.85 : 0;
    const gap = 0.12;
    const articleColW = (totalW - labelColW - gap * articles.length) / articles.length;
    const contentH = L.contentBot - topY;

    // ── 記事カラムごとのヘッダー (サムネ + 媒体名 + 記事タイトル) ──
    const headerH = 1.55;
    const thumbH = 0.85;
    articles.forEach((art, j) => {
      const cx = L.marginX + labelColW + (j === 0 ? 0 : gap) + j * (articleColW + gap);

      // カラム背景
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: cx, y: topY, w: articleColW, h: contentH, rectRadius: L.cardRadius,
        fill: { color: C.white },
        line: { color: C.gray200, width: L.lineWidth },
      });

      // サムネ
      const thumbX = cx + 0.10;
      const thumbY = topY + 0.10;
      const thumbW = articleColW - 0.20;
      if (art.image_path) {
        slide.addImage({
          path: art.image_path, x: thumbX, y: thumbY, w: thumbW, h: thumbH,
          sizing: { type: 'cover', w: thumbW, h: thumbH },
        });
        slide.addShape(pres.shapes.RECTANGLE, {
          x: thumbX, y: thumbY, w: thumbW, h: thumbH,
          fill: { type: 'none' }, line: { color: C.gray200, width: L.lineWidth },
        });
      } else {
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: thumbX, y: thumbY, w: thumbW, h: thumbH, rectRadius: L.cardRadiusSmall,
          fill: { color: C.gray100 },
          line: { color: C.gray300, width: L.lineWidth, dashType: 'dash' },
        });
        slide.addText('［ サムネ ］', {
          x: thumbX, y: thumbY, w: thumbW, h: thumbH,
          fontSize: 9, color: C.gray500, fontFace: F.jp,
          italic: true, align: 'center', valign: 'middle', margin: 0,
        });
      }

      // 媒体名
      slide.addText(art.site_name || '', {
        x: cx + 0.14, y: thumbY + thumbH + 0.06, w: articleColW - 0.28, h: 0.20,
        fontSize: 8.5, color: C.brand, fontFace: F.jp,
        bold: true, charSpacing: 0.5, margin: 0,
      });

      // 記事タイトル (出典リンク)
      const articleTitleRuns = art.article_url
        ? [{
            text: art.article_title || '',
            options: {
              fontSize: 10, color: C.ink, fontFace: F.jp, bold: true,
              hyperlink: { url: art.article_url, tooltip: art.article_title || '' },
            },
          }]
        : [{ text: art.article_title || '', options: { fontSize: 10, color: C.ink, fontFace: F.jp, bold: true } }];
      slide.addText(articleTitleRuns, {
        x: cx + 0.14, y: thumbY + thumbH + 0.26, w: articleColW - 0.28, h: 0.32,
        valign: 'top', margin: 0, lineSpacingMultiple: 1.15,
      });

      slide.addShape(pres.shapes.LINE, {
        x: cx + 0.14, y: topY + headerH + 0.02, w: articleColW - 0.28, h: 0,
        line: { color: C.gray200, width: L.lineWidth },
      });
    });

    // ── row_labels 列 (左端) ──
    const cellsTop = topY + headerH + 0.12;
    const cellsArea = (topY + contentH) - cellsTop - 0.10;
    const numRows = Math.max(1, rowLabels.length || (articles[0] && articles[0].cells ? articles[0].cells.length : 1));
    const cellH = cellsArea / numRows;

    if (rowLabels.length > 0) {
      rowLabels.forEach((lbl, ri) => {
        const ry = cellsTop + ri * cellH;
        slide.addText(lbl, {
          x: L.marginX, y: ry, w: labelColW, h: cellH,
          fontSize: 10, color: C.gray500, fontFace: F.jp,
          bold: true, valign: 'middle', align: 'right', margin: 0,
          charSpacing: 0.5,
        });
      });
    }

    articles.forEach((art, j) => {
      const cx = L.marginX + labelColW + (j === 0 ? 0 : gap) + j * (articleColW + gap);
      const cells = Array.isArray(art.cells) ? art.cells : [];
      cells.slice(0, numRows).forEach((cell, ri) => {
        const ry = cellsTop + ri * cellH;
        slide.addText(cell || '', {
          x: cx + 0.14, y: ry + 0.04, w: articleColW - 0.28, h: cellH - 0.08,
          fontSize: 10, color: C.gray700, fontFace: F.jp,
          margin: 0, valign: 'top', lineSpacingMultiple: L.lineSpacingMultiple,
        });
        // 行間の薄いセパレーター (最初の行以外)
        if (ri > 0) {
          slide.addShape(pres.shapes.LINE, {
            x: cx + 0.14, y: ry, w: articleColW - 0.28, h: 0,
            line: { color: C.gray100, width: L.lineWidth },
          });
        }
      });
    });

    // ── chrome ──
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, null);
    }

    atoms.addSpeakerNotes(ctx, slide, { slideJson,
      template: 'WEBPAGE-4（複数記事の論点比較 / DATA-13）',
      goal: '同一テーマの 2-3 記事を共通論点軸で並列比較',
      message: slideJson.title || '',
      design: `記事 ${articles.length} 件 × 論点 ${numRows} 行`,
    });
  }
  return { renderWebpage4Compare };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'WEBPAGE-1': renderWebpage1Summary,
  'WEBPAGE-2': renderWebpage2CardGrid,
  'WEBPAGE-3': renderWebpage3Detail,
  'WEBPAGE-4': renderWebpage4Compare,
};
