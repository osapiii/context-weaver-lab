'use strict';

// =============================================================
// templates/list.js
// -------------------------------------------------------------
// Consolidated from templates/list/*.js.
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

// ─── list-1-content.js ───────────────────────────────────────────
const { renderList1Content } = (function () {
  /**
   * LIST-1 標準コンテンツ (Category B: CONTENT)
   * ============================================
   * タイトル + サブコピー + 3 ブレットの汎用テンプレ。
   *
   * ⚠️ 最も乱用されやすいテンプレ。SecQA-09 で章内 LIST-1 の 2 連続は fatal、
   * 章内比率 33% 超 / 全体比率 25% 超も fatal。安易に使わず、LIST-4 (3 カード積み) /
   * LIST-8 (詳細カード) / LIST-5/18 (タイル) / LIST-2 (3 カラム) を先に検討する。
   *
   * 期待 JSON 構造:
   *   {
   *     id: "S4",
   *     template_id: "LIST-1",
   *     title:    "...",
   *     subtitle: "...",
   *     section_id: "intro",
   *     subsection: "...",         // optional
   *     bullets: [
   *       { head: "見出し", body: "本文..." },
   *       ...
   *     ]
   *   }
   *
   * detail_blocks 形式（M1 互換）も受け付ける:
   *   detail_blocks: [{ heading, items: ["見出し:本文", ...] }]
   *   → 内部で bullets に変換して描画
   */


  const atoms = require('../atoms');

  function renderList1Content(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const bodyTop = L.contentY;
    const bodyBottom = L.contentBot;

    // bullets を取得 (直接指定 or detail_blocks から変換)
    const bullets = _extractBullets(slideJson);

    if (bullets.length === 0) {
      // 何もない場合はサブコピーで終わり (静かな失敗)
      return;
    }
    const bulletCol = L.marginX + 0.25;
    const bulletW = 10 - L.marginX * 2 - 0.40;
    const availH = bodyBottom - bodyTop - 0.1;
    const rowH = availH / bullets.length;

    bullets.forEach((b, i) => {
      const y = bodyTop + 0.1 + i * rowH;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: bulletCol, y: y + 0.03, w: 0.08, h: 0.36,
        fill: { color: C.brand }, line: { type: 'none' },
      });
      slide.addText([
        { text: b.head, options: { fontSize: atoms.shrinkFontSize(b.head, 15, 25 * 2), bold: true, color: C.ink, breakLine: true } },
        { text: '　', options: { fontSize: 5, breakLine: true } },
        { text: b.body, options: { fontSize: atoms.shrinkFontSize(b.body, 12, 150 * 2, { minFs: 10 }), color: C.gray700 } },
      ], {
        x: bulletCol + 0.20, y, w: bulletW, h: rowH - 0.15,
        fontFace: F.jp, valign: 'top', margin: 0,
        lineSpacingMultiple: L.lineSpacingMultiple,
      });
    });

    // Chrome (ナビ付き)
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(ctx, slide, pageNum, slideJson.section_id, slideJson.subsection || null);
    } else {
      atoms.addChromeWithNav(ctx, slide, pageNum, 0, slideJson.subsection || null);
    }

    // Speaker Notes
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: slideJson.template_name || 'LIST-1（標準コンテンツ）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }

  /**
   * bullets を slideJson から取り出す。
   * 1. slideJson.bullets が直接あればそれを使う
   * 2. detail_blocks[].items を ["見出し:本文"] パターンと見なして変換
   */
  function _extractBullets(slideJson) {
    if (Array.isArray(slideJson.bullets) && slideJson.bullets.length > 0) {
      return slideJson.bullets.map(b => ({
        head: b.head || b.title || '',
        body: b.body || b.text || '',
      }));
    }

    const blocks = slideJson.detail_blocks;
    if (Array.isArray(blocks) && blocks.length > 0) {
      const out = [];
      blocks.forEach(blk => {
        if (Array.isArray(blk.items)) {
          blk.items.forEach(item => {
            // "見出し: 本文" or "見出し / 本文" パターンで分割
            const m = String(item).match(/^([^:：/／]+)[:：/／]\s*(.+)$/);
            if (m) {
              out.push({ head: m[1].trim(), body: m[2].trim() });
            } else {
              out.push({ head: '', body: String(item) });
            }
          });
        }
      });
      return out;
    }

    return [];
  }
  return { renderList1Content };
})();

// ─── list-2-3col.js ──────────────────────────────────────────────
const { renderList2ThreeCol } = (function () {
  /**
   * LIST-2 3 カラム (Category B: CONTENT)
   * =====================================
   * 3 要素を並列表示。各カラム: ストライプ + 番号 + タイトル + 本文 + 要点リスト。
   * 期待 JSON: { cols: [{ stripe?, title, body, points: [...] }] } (3 件)
   */


  const atoms = require('../atoms');

  function renderList2ThreeCol(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const cols = Array.isArray(slideJson.cols) ? slideJson.cols : [];
    if (cols.length === 0) return;
    //   新: 中央列のみ brand (おすすめ強調) + 両端は gray400 で控えめ
    //   stripe 指定があれば従来通りそちらを優先する (互換)。
    const defaultStripes = [C.gray400, C.brand, C.gray400];
    const topY = L.contentY;
    const h = L.contentBot - topY;
    const colGap = 0.28;
    const colW = (10 - L.marginX * 2 - colGap * 2) / 3;
    const pad = L.cardPad;

    cols.slice(0, 3).forEach((c, i) => {
      const x = L.marginX + i * (colW + colGap);
      const stripeColor = c.stripe ? _resolveColor(C, c.stripe) : defaultStripes[i];

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: topY, w: colW, h, rectRadius: L.cardRadius,
        fill: { color: C.white }, line: { color: C.gray200, width: L.lineWidth },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: x + 0.04, y: topY, w: colW - 0.08, h: 0.04,
        fill: { color: stripeColor }, line: { type: 'none' },
      });
      slide.addText(String(i + 1).padStart(2, '0'), {
        x: x + pad, y: topY + 0.20, w: 1, h: 0.32,
        fontSize: 22, color: stripeColor, fontFace: F.jp, bold: true, margin: 0, charSpacing: 0,
      });
      //   それでも収まらなければ末尾を '…' で truncate して 1 行を維持)
      const titleW = colW - pad * 2;
      const fitted = atoms.fitOneLine(c.title || '', titleW, [16, 14, 12, 11], {
        context: `LIST-2 ${slideJson.id || '?'} cols[${i}]`,
      });
      slide.addText(fitted.text, {
        x: x + pad, y: topY + 0.62, w: titleW, h: 0.40,
        fontSize: fitted.fontSize, color: C.ink, fontFace: F.jp,
        bold: true, margin: 0, valign: 'top',
        shrinkText: true, wrap: false,
      });
      //   「title 直下に大きな白、bullets が下端寄り」の不自然なレイアウトになっていた。
      const hasBody = !!(c.body && String(c.body).trim());
      if (hasBody) {
        // v10.1.2: body 文字数で fontSize / lineSpacingMultiple を自動調整
        //   結晶化 WF (osanai 氏指針 2026-05-08) で 1 列 90→180字級まで詰める前提。
        //   90字以下 → 11pt / 90-130字 → 10.5pt / 130-160字 → 10pt / 160-180字 → 9.5pt
        const list2BodyLen = (c.body || '').length;
        const list2Fs = list2BodyLen > 160 ? 10.5 : list2BodyLen > 130 ? 10.5 : list2BodyLen > 90 ? 10.5 : 11;  // v11.4: 10.5pt 死守
        const list2Ls = list2BodyLen > 130 ? 1.30 : L.lineSpacingMultiple;
        slide.addText(c.body || '', {
          x: x + pad, y: topY + 1.12, w: colW - pad * 2, h: 1.05,
          fontSize: list2Fs, color: C.gray700, fontFace: F.jp, margin: 0, valign: 'top',
          lineSpacingMultiple: list2Ls,
        });
      }
      // body の有無で separator 位置を切り替え。
      //   hasBody=true  : 旧仕様 topY+2.28 (body 1.05" + 余白 0.11" のあと)
      //   hasBody=false : title 直下の自然な余白 → topY+1.18 (title bottom +0.16")
      const sepY = hasBody ? (topY + 2.28) : (topY + 1.18);
      slide.addShape(pres.shapes.LINE, {
        x: x + pad, y: sepY, w: colW - pad * 2, h: 0,
        line: { color: C.gray200, width: L.lineWidth },
      });
      const points = Array.isArray(c.points) ? c.points : [];
      const pointStartY = sepY + 0.12;
      points.forEach((p, j) => {
        slide.addText([
          { text: '・ ', options: { color: stripeColor, bold: true } },
          { text: p, options: { color: C.gray700 } },
        ], {
          x: x + pad, y: pointStartY + j * 0.28, w: colW - pad * 2, h: 0.28,
          fontSize: 11, fontFace: F.jp, margin: 0,
          lineSpacingMultiple: L.lineSpacingMultiple,
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
        template: 'LIST-2（3 カラム）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }

  function _resolveColor(C, name) {
    if (typeof name !== 'string') return C.brand;
    if (/^#?[0-9A-Fa-f]{6}$/.test(name)) return name.replace('#', '');
    const v = C[name];
    return v !== undefined && v !== null && v !== '' ? v : C.brand;
  }
  return { renderList2ThreeCol };
})();

// ─── list-3-cardgrid.js ──────────────────────────────────────────
const { renderList3CardGrid } = (function () {
  /**
   * LIST-3 カードグリッド (Category B: CONTENT)
   * ===========================================
   * 並列アイテム 4-6 個を 3×2 で表示。1 件 featured で強調可。
   * 期待 JSON: { items: [{ num, name, tag, desc, cat, featured? }] } (4-6 件)
   */


  const atoms = require('../atoms');

  function renderList3CardGrid(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const items = Array.isArray(slideJson.items) ? slideJson.items : [];
    if (items.length === 0) return;
    const topY = L.contentY;
    const gap = 0.22;
    const colW = (10 - L.marginX * 2 - gap * 2) / 3;
    const rowH = (L.contentBot - topY - gap) / 2;
    const pad = L.cardPad;

    const hasFeatured = items.some(it => it && it.featured);
    //   featured: true があれば、そのカードのみ brand stroke + 左バーで強調 (= 真の 5%)
    const triadColors = [C.ink, C.ink, C.ink];  // v11.4: 3 色グラデ撤廃で並列性を保つ

    items.slice(0, 6).forEach((p, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = L.marginX + col * (colW + gap);
      const y = topY + row * (rowH + gap);

      const triadColor = !hasFeatured ? triadColors[i % 3] : null;
      // 旧: brandSoft (amber 塗り) で全体に色が乗って野暮ったかった
      // 新: 白背景 + brand stroke 1.0pt + 左 amber バー (細) で控えめに強調
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: colW, h: rowH, rectRadius: L.cardRadius,
        fill: { color: C.white },
        line: { color: p.featured ? C.brand : C.gray200, width: p.featured ? 1.0 : L.lineWidth },
      });
      // featured の時だけ左 amber バーを薄く添える
      if (p.featured) {
        slide.addShape(pres.shapes.RECTANGLE, {
          x, y, w: 0.05, h: rowH,
          fill: { color: C.brand }, line: { type: 'none' },
        });
      }
      // 旧: 番号 (11pt) at y+0.18 / タイトル at y+0.44 / tag at y+0.80 / 説明 at y+1.05
      //     → 番号と tag が合計 0.62" の縦スペースを占有して、説明領域が狭かった
      // 新: 番号 (10pt small) at y+0.10 (左上隅) / タイトル at y+0.18 (上に詰める) /
      //     説明 at y+0.62 (tag を撤去して 0.43" 早く始める) / 説明領域が約 0.45" 拡大
      slide.addText(p.num || String(i + 1).padStart(2, '0'), {
        x: x + pad, y: y + 0.10, w: 0.50, h: 0.20,
        fontSize: 10,
        color: p.featured ? C.brand : (triadColor || C.gray400),
        fontFace: F.jp, bold: true, charSpacing: 1, margin: 0, valign: 'top',
      });
      //   3-Box の card-grid でも左/右派/清代タイトルの折り返し回避を統一する
      const list3TitleW = colW - pad * 2;
      const list3Fit = atoms.fitOneLine(p.name || '', list3TitleW, [15, 14, 12, 11], {
        context: `LIST-3 ${slideJson.id || '?'} items[${i}]`,
      });
      slide.addText(list3Fit.text, {
        x: x + pad, y: y + 0.32, w: list3TitleW, h: 0.36,
        fontSize: list3Fit.fontSize, color: C.ink, fontFace: F.jp,
        bold: true, margin: 0, valign: 'top',
        shrinkText: true, wrap: false,
      });
      //          あっても描画されない。tag に書きたい内容は desc に統合してください。
      // v10.1.2: desc 文字数で fontSize / lineSpacingMultiple / 描画領域を自動調整
      //   結晶化 WF (osanai 氏指針 2026-05-08) で 1 カード 60→140字級まで詰める前提。
      //   60字以下 → 9.5pt / 60-100字 → 9pt / 100-140字 → 8pt / 140字超 → 7.5pt
      //   (1 列幅 ≈ 2.8 inch、日本語 1 字 ≈ font-size * 0.014 inch なので
      //    8pt なら 1 行 ≈ 25 字、9pt なら 22 字)
      //   高さは rowH 残り全部 (= rowH - 0.84) を使い切って wrap の溢れを防ぐ
      const descLen = (p.desc || '').length;
      const descFs = descLen > 140 ? 9.5 : descLen > 100 ? 9.5 : descLen > 60 ? 9.5 : 9.5;
      const descLs = descLen > 140 ? 1.15 : descLen > 100 ? 1.20 : descLen > 60 ? 1.30 : L.lineSpacingMultiple;
      const descH = rowH - 0.78 - (p.cat ? 0.35 : 0.10);
      slide.addText(p.desc || '', {
        x: x + pad, y: y + 0.78, w: colW - pad * 2, h: descH,
        fontSize: descFs, color: C.gray700, fontFace: F.jp, margin: 0, valign: 'top',
        lineSpacingMultiple: descLs,
        wrap: true, shrinkText: true,
      });
      if (p.cat) {
        slide.addShape(pres.shapes.LINE, {
          x: x + pad, y: y + rowH - 0.30, w: colW - pad * 2, h: 0,
          line: { color: C.gray200, width: L.lineWidth },
        });
        slide.addText(p.cat, {
          x: x + pad, y: y + rowH - 0.25, w: colW - pad * 2, h: 0.20,
          fontSize: 9, color: C.gray500, fontFace: F.jp, margin: 0, valign: 'middle',
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
        template: 'LIST-3（カードグリッド）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderList3CardGrid };
})();

// ─── list-4-card-stack.js ────────────────────────────────────────
const { renderList4CardStack } = (function () {
  /**
   * LIST-4 縦カード積み (Category B: CONTENT) — LIST-1 の後継
   * ============================================================
   * 左: 太い番号 + 色付き縦帯、右: タイトル太字 + 本文。
   * 期待 JSON: { cards: [{ n, stripe, title, body }] } (3〜6 件)
   *
   * cards.length に応じて compact mode に自動切替 (fatal バグ修正)。
   *   - N>=4 で badge / title / body fontSize, gap, paddings を比例縮小
   *   - valign を 'top' に固定し overflow 方向を下方向に限定
   *   - body を cardH に応じて auto-truncate (… 付与)
   *   - badge と text の x 衝突を防止 (gap 0.15" 保証)
   *   - cards.length > 6 は警告 + 切り詰め
   */


  const atoms = require('../atoms');

  const MAX_CARDS = 6;

  function _getLayoutPreset(n) {
    if (n <= 3) {
      return {
        gap: 0.16,
        topPad: 0.10, botPad: 0.05,
        innerPadY: 0.10,
        badgeFont: 48, titleFont: 16, spacerFont: 8, bodyFont: 11.5,
        maxBodyLines: 4, lsm: null, valign: 'middle',
        allowOverflow: true,
      };
    }
    if (n === 4) {
      return {
        gap: 0.08,
        topPad: 0.04, botPad: 0.02,
        innerPadY: 0.05,
        badgeFont: 28, titleFont: 12, spacerFont: 3, bodyFont: 10,
        maxBodyLines: 2, lsm: 1.25, valign: 'top',
      };
    }
    if (n === 5) {
      return {
        gap: 0.06,
        topPad: 0.03, botPad: 0.02,
        innerPadY: 0.04,
        badgeFont: 22, titleFont: 11, spacerFont: 2, bodyFont: 9.5,
        maxBodyLines: 1, lsm: 1.20, valign: 'top',
      };
    }
    return {
      gap: 0.05,
      topPad: 0.02, botPad: 0.02,
      innerPadY: 0.03,
      badgeFont: 18, titleFont: 10, spacerFont: 2, bodyFont: 9.5,
      maxBodyLines: 1, lsm: 1.15, valign: 'top',
    };
  }

  function _lineHeightIn(pt, lsm) {
    return (pt / 72) * (lsm || 1.40);
  }

  function _truncateBody(body, textW, fontPt, maxLines) {
    if (!body) return '';
    const charW = (fontPt * 0.92) / 72;
    const charsPerLine = Math.max(8, Math.floor(textW / charW));
    const maxChars = charsPerLine * maxLines;
    if (body.length <= maxChars) return body;
    return body.slice(0, Math.max(1, maxChars - 1)) + '…';
  }

  function renderList4CardStack(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    let cards = Array.isArray(slideJson.cards) ? slideJson.cards : [];
    if (cards.length === 0) return;

    if (cards.length > MAX_CARDS) {
      console.warn(`[LIST-4] cards.length=${cards.length} は ${MAX_CARDS} 件超のため切り詰め (slide id=${slideJson.id || '?'}). LIST-2 / LIST-5 の検討を推奨。`);
      cards = cards.slice(0, MAX_CARDS);
    }
    const defaultStripes = [C.brand, C.brand, C.brand, C.brand];  // v11.4: 並列カードは brand 単色 (灰色グラデ撤廃)
    const preset = _getLayoutPreset(cards.length);

    const topY = L.contentY + preset.topPad;
    const bottomY = L.contentBot - preset.botPad;
    const totalH = bottomY - topY;
    const gap = Math.max(0.05, preset.gap);
    const cardH = (totalH - gap * (cards.length - 1)) / cards.length;

    const cardX = L.marginX;
    const cardW = 10 - L.marginX * 2;
    const stripeW = 0.08;
    const numberAreaW = cards.length >= 4 ? 1.05 : 1.30;
    const badgeXOffset = stripeW + 0.12;
    const badgeRightEdge = cardX + badgeXOffset + (numberAreaW - 0.15);
    const textGapMin = 0.15;
    const textX = Math.max(cardX + stripeW + numberAreaW, badgeRightEdge + textGapMin);
    const textW = cardW - (textX - cardX) - 0.20;
    const innerH = cardH - preset.innerPadY * 2;
    const effectiveLSM = preset.lsm != null ? preset.lsm : (L.lineSpacingMultiple || 1.40);
    const lineH = _lineHeightIn(preset.bodyFont, effectiveLSM);
    const titleH = _lineHeightIn(preset.titleFont, effectiveLSM);
    const spacerH = _lineHeightIn(preset.spacerFont, effectiveLSM);
    const bodyAvailH = Math.max(lineH, innerH - titleH - spacerH);
    const fittedMaxLines = Math.max(1, Math.min(preset.maxBodyLines, Math.floor(bodyAvailH / lineH)));

    cards.forEach((c, i) => {
      const y = topY + i * (cardH + gap);
      const stripeColor = c.stripe ? _resolveColor(C, c.stripe) : (defaultStripes[i] || C.brand);

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: cardX, y, w: cardW, h: cardH, rectRadius: L.cardRadius,
        fill: { color: C.white },
        line: { color: C.gray200, width: L.lineWidth },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: cardX + 0.02, y: y + preset.innerPadY, w: stripeW, h: cardH - preset.innerPadY * 2,
        fill: { color: stripeColor }, line: { type: 'none' },
      });
      slide.addText(c.n || String(i + 1).padStart(2, '0'), {
        x: cardX + badgeXOffset, y: y + preset.innerPadY,
        w: numberAreaW - 0.15, h: cardH - preset.innerPadY * 2,
        fontSize: preset.badgeFont, color: stripeColor, fontFace: F.jp,
        bold: true, align: 'left', valign: 'middle', margin: 0, charSpacing: 0,
      });
      const bodyTrunc = preset.allowOverflow
        ? (c.body || '')
        : _truncateBody(c.body || '', textW, preset.bodyFont, fittedMaxLines);
      slide.addText([
        { text: c.title || '', options: { fontSize: preset.titleFont, bold: true, color: C.ink, breakLine: true } },
        { text: '　', options: { fontSize: preset.spacerFont, breakLine: true } },
        { text: bodyTrunc, options: { fontSize: preset.bodyFont, color: C.gray700 } },
      ], {
        x: textX, y: y + preset.innerPadY, w: textW, h: cardH - preset.innerPadY * 2,
        fontFace: F.jp, valign: preset.valign, margin: 0,
        lineSpacingMultiple: effectiveLSM,
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
        template: `LIST-4（縦 ${cards.length} カード積み）`,
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }

  function _resolveColor(C, name) {
    if (typeof name !== 'string') return C.brand;
    if (/^#?[0-9A-Fa-f]{6}$/.test(name)) return name.replace('#', '');
    const v = C[name];
    return v !== undefined && v !== null && v !== '' ? v : C.brand;
  }
  return { renderList4CardStack };
})();

// ─── list-5-tile-2x2.js ──────────────────────────────────────────
const { renderList5Tile2x2 } = (function () {
  /**
   * LIST-5 タイル 2×2 (Category E: TILES)
   * =====================================
   * 4 要素を 2×2 グリッドで表示。各タイル: 番号バッジ + タイトル + 本文。
   * 期待 JSON: { tiles: [{ n, title, body, badge_color? }] } (4 件)
   */


  const atoms = require('../atoms');

  function renderList5Tile2x2(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    const tiles = Array.isArray(slideJson.tiles) ? slideJson.tiles : [];
    if (tiles.length === 0) return;

    // 4 タイル分のデフォルト badge 色
    // v11.4: 並列タイル 4 件は全 ink 統一 (灰色グラデ撤廃で「重要度暗示」を解消)
    const defaultBadges = [
      { color: C.ink, text: C.white },
      { color: C.ink, text: C.white },
      { color: C.ink, text: C.white },
      { color: C.ink, text: C.white },
    ];

    const topY = L.contentY;
    const gap = 0.26;
    const colW = (10 - L.marginX * 2 - gap) / 2;
    const rowH = (L.contentBot - topY - gap) / 2;

    tiles.slice(0, 4).forEach((t, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = L.marginX + col * (colW + gap);
      const y = topY + row * (rowH + gap);

      const badge = defaultBadges[i] || defaultBadges[0];
      const badgeColor = t.badge_color ? _resolveColor(C, t.badge_color) : badge.color;
      const badgeText = t.badge_text ? _resolveColor(C, t.badge_text) : badge.text;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: colW, h: rowH, rectRadius: L.cardRadius,
        fill: { color: C.white }, line: { color: C.gray200, width: L.lineWidth },
      });
      slide.addShape(pres.shapes.OVAL, {
        x: x + 0.3, y: y + 0.3, w: 0.48, h: 0.48,
        fill: { color: badgeColor }, line: { type: 'none' },
      });
      slide.addText(t.n || String(i + 1).padStart(2, '0'), {
        x: x + 0.3, y: y + 0.3, w: 0.48, h: 0.48,
        fontSize: 13, color: badgeText, fontFace: F.jp,
        bold: true, align: 'center', valign: 'middle', margin: 0,
      });
      slide.addText(t.title || '', {
        x: x + 0.95, y: y + 0.3, w: colW - 1.1, h: 0.48,
        fontSize: 16, color: C.ink, fontFace: F.jp, bold: true, margin: 0, valign: 'middle',
      });
      slide.addText(t.body || '', {
        x: x + 0.95, y: y + 0.90, w: colW - 1.1, h: rowH - 1.0,
        fontSize: 11, color: C.gray700, fontFace: F.jp, margin: 0, valign: 'top',
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
        template: 'LIST-5（タイル 2×2）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }

  function _resolveColor(C, name) {
    if (typeof name !== 'string') return C.brand;
    if (/^#?[0-9A-Fa-f]{6}$/.test(name)) return name.replace('#', '');
    const v = C[name];
    return v !== undefined && v !== null && v !== '' ? v : C.brand;
  }
  return { renderList5Tile2x2 };
})();

// ─── list-6-tile-3x2.js ──────────────────────────────────────────
const { renderList6Tile3x2 } = (function () {
  /**
   * LIST-6 タイル 3×2 (Category E: TILES)
   * =====================================
   * 6 要素を中密度で並列。番号バッジ + タイトル + 本文。
   * 期待 JSON: { tiles: [{ n, title, body, badge_color? }] } (6 件)
   *
   * v11.8: LIST-5 と実装が 90% 重複している既知の DRY 違反。共通ヘルパー
   * `atoms.drawNumberedTile(slide, x, y, w, h, opts)` への集約は Phase γ
   * 第 4 弾以降で対応予定。現状は両テンプレが独立に保守される。
   */


  const atoms = require('../atoms');

  function renderList6Tile3x2(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(
      ctx, slide, slideJson.title || '', slideJson.subtitle || '',
      { tone: slideJson.tone || 'amber' },
    );

    const tiles = Array.isArray(slideJson.tiles) ? slideJson.tiles : [];
    if (tiles.length === 0) return;

    const topY = L.contentY;
    const gap = 0.22;
    const colW = (10 - L.marginX * 2 - gap * 2) / 3;
    const rowH = (L.contentBot - topY - gap) / 2;
    // v11.4: 並列タイル 6 件は全 ink 統一 (旧 6 番目崩れ + 重要度暗示を解消)
    const defaultBadges = [
      { bg: C.ink, text: C.white },
      { bg: C.ink, text: C.white },
      { bg: C.ink, text: C.white },
      { bg: C.ink, text: C.white },
      { bg: C.ink, text: C.white },
      { bg: C.ink, text: C.white },
    ];

    tiles.slice(0, 6).forEach((t, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = L.marginX + col * (colW + gap);
      const y = topY + row * (rowH + gap);
      const badge = defaultBadges[i] || defaultBadges[0];
      const badgeColor = t.badge_color ? _resolveColor(C, t.badge_color) : badge.bg;
      const badgeText = badge.text;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: colW, h: rowH, rectRadius: L.cardRadius,
        fill: { color: C.white }, line: { color: C.gray200, width: L.lineWidth },
      });
      slide.addShape(pres.shapes.OVAL, {
        x: x + 0.25, y: y + 0.25, w: 0.40, h: 0.40,
        fill: { color: badgeColor }, line: { type: 'none' },
      });
      slide.addText(t.n || String(i + 1).padStart(2, '0'), {
        x: x + 0.25, y: y + 0.25, w: 0.40, h: 0.40,
        fontSize: 11, color: badgeText, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
      slide.addText(t.title || '', {
        x: x + 0.78, y: y + 0.25, w: colW - 0.95, h: 0.40,
        fontSize: 13, color: C.ink, fontFace: F.jp, bold: true, valign: 'middle', margin: 0,
      });
      slide.addText(t.body || '', {
        x: x + 0.25, y: y + 0.78, w: colW - 0.45, h: rowH - 0.93,
        fontSize: 10, color: C.gray700, fontFace: F.jp, margin: 0, valign: 'top',
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
        template: 'LIST-6（タイル 3×2）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }

  function _resolveColor(C, name) {
    if (typeof name !== 'string') return C.brand;
    if (/^#?[0-9A-Fa-f]{6}$/.test(name)) return name.replace('#', '');
    const v = C[name];
    return v !== undefined && v !== null && v !== '' ? v : C.brand;
  }
  return { renderList6Tile3x2 };
})();

// ─── list-7-tile-3x3.js ──────────────────────────────────────────
const { renderList7Tile3x3 } = (function () {
  /**
   * LIST-7 タイル 3×3 (Category E: TILES)
   * =====================================
   * 9 要素を網羅的に並列。タイトル + 短い本文のコンパクトタイル。
   * 期待 JSON: { tiles: [{ title, body }] } (9 件)
   */


  const atoms = require('../atoms');

  function renderList7Tile3x3(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const tiles = Array.isArray(slideJson.tiles) ? slideJson.tiles : [];
    if (tiles.length === 0) return;

    const topY = L.contentY;
    const gap = 0.16;
    const colW = (10 - L.marginX * 2 - gap * 2) / 3;
    const rowH = (L.contentBot - topY - gap * 2) / 3;
    // タイル本体は薄い gray50 のまま、左 4px の色帯で列ごとに brand/accent/highlight。
    // タイトル色は ink を維持 (タイル数が多いので彩色は控えめ)。
    const triadColors = [C.brand, C.accent, C.highlight];  // v11.4: カラム軸の意味を 3 色で明示

    tiles.slice(0, 9).forEach((t, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = L.marginX + col * (colW + gap);
      const y = topY + row * (rowH + gap);
      const stripeColor = triadColors[col];
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: colW, h: rowH, rectRadius: L.cardRadius,
        fill: { color: C.gray50 }, line: { color: C.gray200, width: L.lineWidth },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.06, h: rowH,
        fill: { color: stripeColor }, line: { type: 'none' },
      });
      slide.addText(t.title || '', {
        x: x + 0.20, y: y + 0.20, w: colW - 0.40, h: 0.40,
        fontSize: 12, color: C.ink, fontFace: F.jp, bold: true, valign: 'top', margin: 0,
      });
      slide.addText(t.body || '', {
        x: x + 0.20, y: y + 0.65, w: colW - 0.40, h: rowH - 0.80,
        fontSize: 9.5, color: C.gray700, fontFace: F.jp, valign: 'top', margin: 0,
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
        template: 'LIST-7（タイル 3×3）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderList7Tile3x3 };
})();

// ─── list-8-detail-card.js ───────────────────────────────────────
const { renderList8DetailCard } = (function () {
  /**
   * LIST-8 詳細カード (Category B: CONTENT)
   * =======================================
   * 1 要素を深掘り。左にプロダクトカード、右に 2 グループ × 2 機能。
   * 期待 JSON:
   *   {
   *     left: { title, tagline, desc, chips: [{text, w, active?}] },
   *     right: [{ title, items: [{n, head, body}] }]
   *   }
   */


  const atoms = require('../atoms');

  function renderList8DetailCard(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const left = slideJson.left || {};
    const right = Array.isArray(slideJson.right) ? slideJson.right : [];
    const lx = L.marginX, ly = L.contentY, lw = 3.3, lh = L.contentBot - ly;
    const pad = L.cardPad;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: lx, y: ly, w: lw, h: lh, rectRadius: L.cardRadius,
      fill: { color: C.gray50 }, line: { color: C.gray200, width: L.lineWidth },
    });
    if (left.title) {
      slide.addText(left.title, {
        x: lx + pad, y: ly + 0.35, w: lw - pad * 2, h: 0.55,
        fontSize: 22, color: C.ink, fontFace: F.jp, bold: true, margin: 0, charSpacing: 0,  // v11.4: スライドタイトル 20pt と階層差を保つ
      });
    }
    if (left.tagline) {
      slide.addText(left.tagline, {
        x: lx + pad, y: ly + 0.98, w: lw - pad * 2, h: 0.3,
        fontSize: 12, color: C.brand, fontFace: F.jp, bold: true, margin: 0,
      });
    }
    if (left.desc) {
      slide.addText(left.desc, {
        x: lx + pad, y: ly + 1.42, w: lw - pad * 2, h: 1.0,
        fontSize: 10.5, color: C.gray700, fontFace: F.jp, margin: 0,
        lineSpacingMultiple: L.lineSpacingMultiple,
      });
    }
    // chips
    const chipDefs = Array.isArray(left.chips) ? left.chips : [];
    let cxv = lx + pad;
    const cyv = ly + lh - 0.50;
    chipDefs.forEach(c => {
      const cw = c.w || 0.8;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: cxv, y: cyv, w: cw, h: 0.30, rectRadius: 0.05,
        fill: { color: c.active ? C.brandSoft : C.gray100 }, line: { type: 'none' },
      });
      slide.addText(c.text || '', {
        x: cxv, y: cyv, w: cw, h: 0.30,
        fontSize: 9, color: c.active ? C.brandDeep : C.gray700, fontFace: F.jp,
        align: 'center', valign: 'middle', margin: 0,
      });
      cxv += cw + 0.08;
    });

    // 右フィーチャー
    const rx = lx + lw + 0.30;
    right.slice(0, 2).forEach((f, fi) => {
      const fy = ly + 0.05 + fi * 1.75;
      slide.addText(f.title || '', {
        x: rx, y: fy, w: 5.5, h: 0.35,
        fontSize: 14, color: C.ink, fontFace: F.jp, bold: true, margin: 0,
      });
      slide.addShape(pres.shapes.LINE, {
        x: rx, y: fy + 0.42, w: 5.5, h: 0,
        line: { color: C.gray200, width: L.lineWidth },
      });
      const fitems = Array.isArray(f.items) ? f.items : [];
      fitems.forEach((it, i) => {
        const iy = fy + 0.58 + i * 0.62;
        slide.addText(it.n || '', {
          x: rx, y: iy, w: 0.40, h: 0.55,
          fontSize: 12, color: C.brand, fontFace: F.jp, bold: true,
          valign: 'top', margin: 0,
        });
        slide.addText([
          { text: (it.head || '') + '　', options: { bold: true, color: C.ink } },
          { text: it.body || '', options: { color: C.gray700 } },
        ], {
          x: rx + 0.40, y: iy, w: 5.05, h: 0.55,
          fontSize: 12, fontFace: F.jp, valign: 'top', margin: 0,
          lineSpacingMultiple: L.lineSpacingMultiple,
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
        template: 'LIST-8（詳細カード）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderList8DetailCard };
})();

// ─── list-9-icon-3col.js ─────────────────────────────────────────
const { renderList9Icon3Col } = (function () {
  /**
   * LIST-9 アイコン 3 カラム (Category F: VISUAL)
   * =============================================
   * 3 カラム × アイコン円 + タイトル + 本文。要素を視覚的に立てる。
   * 期待 JSON: { cols: [{ icon, title, body, color? }] } (3 件)
   */


  const atoms = require('../atoms');

  function renderList9Icon3Col(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;

    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const cols = Array.isArray(slideJson.cols) ? slideJson.cols : [];
    if (cols.length === 0) return;
    // 同色化する問題があった。highlight に置換して確実に 3 色化。
    const defaultColors = [C.brand, C.accent, C.highlight];  // v11.4: 3 つの軸を色で明示

    const topY = L.contentY + 0.20;
    const totalH = L.contentBot - topY - 0.10;
    const colGap = 0.36;
    const colW = (10 - L.marginX * 2 - colGap * 2) / 3;
    const iconD = 1.40;

    cols.slice(0, 3).forEach((c, i) => {
      const x = L.marginX + i * (colW + colGap);
      const color = c.color ? _resolveColor(C, c.color) : defaultColors[i];

      // アイコン円
      const iconCx = x + colW / 2;
      const iconCy = topY + iconD / 2 + 0.10;
      slide.addShape(pres.shapes.OVAL, {
        x: iconCx - iconD / 2, y: iconCy - iconD / 2, w: iconD, h: iconD,
        fill: { color }, line: { type: 'none' },
      });
      slide.addText(c.icon || '◯', {
        x: iconCx - iconD / 2, y: iconCy - iconD / 2, w: iconD, h: iconD,
        fontSize: 48, color: C.white, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });

      // タイトル
      slide.addText(c.title || '', {
        x, y: iconCy + iconD / 2 + 0.26, w: colW, h: 0.40,
        fontSize: 16, color: C.ink, fontFace: F.jp, bold: true,
        align: 'center', valign: 'top', margin: 0,
      });

      // 本文
      slide.addText(c.body || '', {
        x: x + 0.10, y: iconCy + iconD / 2 + 0.72, w: colW - 0.20, h: totalH - iconD - 0.92,
        fontSize: 11, color: C.gray700, fontFace: F.jp,
        align: 'center', valign: 'top', margin: 0,
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
        template: 'LIST-9（アイコン 3 カラム）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }

  function _resolveColor(C, name) {
    if (typeof name !== 'string') return C.brand;
    if (/^#?[0-9A-Fa-f]{6}$/.test(name)) return name.replace('#', '');
    const v = C[name];
    return v !== undefined && v !== null && v !== '' ? v : C.brand;
  }
  return { renderList9Icon3Col };
})();


// ─── list-10-agenda.js (v11.6 新規 / Phase γ) ────────────────────
const { renderList10Agenda } = (function () {
  /**
   * LIST-10 縦長アジェンダ (v11.6 新規 / Category B: CONTENT)
   * ========================================================
   * 5-8 件のアジェンダ・チェックリスト・タスク一覧。
   * 各 item: 番号 + head + body + 進捗状態チップ (todo / doing / done)。
   *
   * 期待 JSON:
   *   { items: [{ n?, head, body?, status?: 'todo' | 'doing' | 'done' }] } (5-8 件)
   */
  const atoms = require('../atoms');
  function renderList10Agenda(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);
    atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const items = Array.isArray(slideJson.items) ? slideJson.items.slice(0, 8) : [];
    if (items.length === 0) return;
    const topY = L.contentY + 0.05;
    const totalH = L.contentBot - topY;
    const gap = items.length <= 6 ? 0.10 : 0.06;
    const rowH = (totalH - gap * (items.length - 1)) / items.length;
    const numW = 0.55, statusW = 0.85;
    const headW = 10 - L.marginX * 2 - numW - statusW - 0.40;
    items.forEach((it, i) => {
      const y = topY + i * (rowH + gap);
      // カード border-only
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: L.marginX, y, w: 10 - L.marginX * 2, h: rowH, rectRadius: L.cardRadius,
        fill: { color: C.white }, line: { color: C.gray200, width: L.lineWidth },
      });
      // 番号
      slide.addText(it.n || String(i + 1).padStart(2, '0'), {
        x: L.marginX + 0.10, y, w: numW, h: rowH,
        fontSize: 18, color: C.brand, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
      // head + body
      const textX = L.marginX + numW + 0.20;
      slide.addText([
        { text: it.head || '', options: { fontSize: 13, bold: true, color: C.ink, breakLine: true } },
        { text: it.body || '', options: { fontSize: 10.5, color: C.gray700 } },
      ], {
        x: textX, y, w: headW, h: rowH,
        fontFace: F.jp, valign: 'middle', margin: 0, lineSpacingMultiple: 1.30,
      });
      // 進捗状態チップ
      const status = it.status || 'todo';
      const statusMap = {
        todo:  { label: '未着手', bg: C.gray200, fg: C.gray700 },
        doing: { label: '進行中', bg: C.brandSoft, fg: C.brandDeep },
        done:  { label: '完了',   bg: C.accentSoft, fg: C.accentDeep },
      };
      const st = statusMap[status] || statusMap.todo;
      const sx = L.marginX + (10 - L.marginX * 2) - statusW - 0.10;
      const chipH = 0.32;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: sx, y: y + (rowH - chipH) / 2, w: statusW, h: chipH, rectRadius: 0.16,
        fill: { color: st.bg }, line: { type: 'none' },
      });
      slide.addText(st.label, {
        x: sx, y: y + (rowH - chipH) / 2, w: statusW, h: chipH,
        fontSize: 10, color: st.fg, fontFace: F.jp, bold: true,
        align: 'center', valign: 'middle', margin: 0,
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
        template: 'LIST-10（縦長アジェンダ 5-8 件 + 進捗状態）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderList10Agenda };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'LIST-1': renderList1Content,
  'LIST-2': renderList2ThreeCol,
  'LIST-3': renderList3CardGrid,
  'LIST-4': renderList4CardStack,
  'LIST-5': renderList5Tile2x2,
  'LIST-6': renderList6Tile3x2,
  'LIST-7': renderList7Tile3x3,
  'LIST-8': renderList8DetailCard,
  'LIST-9': renderList9Icon3Col,
  'LIST-10': renderList10Agenda,  // v11.6: 縦長アジェンダ
};
