/**
 * atoms.js
 * ===================
 * Atom 層: テンプレに依存しない共通描画部品。
 *
 * 設計原則:
 *   - すべての関数は **ctx 引数経由** でトークン・レイアウト・PptxGenJS インスタンスを受け取る
 *   - グローバル変数依存なし（旧 example-deck.js は module-level の const に依存していた）
 *   - 純粋関数として slide を mutate するだけ。副作用は引数 slide / ctx.pageNum のみ
 *   - ハードコード hex は禁止（C-5 ルール）。色は ctx.T.color から取る
 *
 * ctx の構造（render/build-deck.js が初期化する）:
 *   {
 *     T:                tokens.js（テーマ適用済み）
 *     L:                layout 定数（ctx.T.layout）
 *     C:                color 役割（ctx.T.color）
 *     F:                font 名（ctx.T.font）
 *     SZ:               size 名（ctx.T.size）
 *     pres:             PptxGenJS インスタンス
 *     deckSections:     [{id, name, lead?}] — 章リストの真の唯一ソース
 *     sectionsMap:      { id: index } — section_id → 0始まりインデックス
 *     totalPages:       デッキ全体の総ページ数（フッターの "NN / MM" 用）
 *     refsByNum:        { 1: 'https://...', 2: '...' } — インライン参照解決用
 *     assetsRoot:       ロゴや画像のベースパス（通常は skill ルート）
 *   }
 *
 * 詳細は references/_common/render-architecture.md を参照。
 */

'use strict';

// ───────────────────────────────────────────────────────
// 章リスト管理
// ───────────────────────────────────────────────────────

/**
 * 章リストを ctx に登録する。デッキ起動時に build-deck.js が一度だけ呼ぶ。
 * sections は配列。各要素は string (= name) または {id?, name, lead?} オブジェクト。
 *
 * @returns {Array<string>} 確定した章名の配列
 */
function setDeckSections(ctx, sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('[v6.31 SecQA-10] setDeckSections: 章リストは空配列禁止');
  }
  const names = [];
  const idMap = {};
  // FRAMING-5「X 章のポイント」など、本編章の通し番号が必要なテンプレで使う。
  const bodyChapterNumMap = {};
  let bodyCounter = 0;
  sections.forEach((s, i) => {
    const name = typeof s === 'string' ? s : (s && s.name);
    if (!name || typeof name !== 'string') {
      throw new Error(`[v6.31 SecQA-10] sections[${i}].name が空。章タイトル文字列を必ず入れる`);
    }
    if (name.length < 2) {
      throw new Error(`[v6.31 SecQA-10] sections[${i}].name="${name}" が短すぎる (2 文字以上必須)`);
    }
    if (name.length > 18) {
      console.warn(`[v6.31 SecQA-10] sections[${i}].name="${name}" は ${name.length} 文字 — simple variant チップで見切れる可能性。12 字以内推奨`);
    }
    names.push(name);
    if (s && typeof s === 'object' && s.id) {
      idMap[s.id] = i;
    }
    //   - role が明示されている場合 (v9 normalize 経由): 'chapter' のみカウント
    if (s && typeof s === 'object') {
      const role = s._v9_role || s.role || null;
      const id = s.id || '';
      const isBody = role
        ? role === 'chapter'
        : !id.startsWith('_');
      if (isBody) {
        bodyCounter += 1;
        if (id) bodyChapterNumMap[id] = bodyCounter;
      }
    } else {
      bodyCounter += 1;
    }
  });
  ctx.deckSections = names;
  ctx.sectionsMap = idMap;
  ctx.bodyChapterNumMap = bodyChapterNumMap;
  return names;
}

/**
 * section_id 文字列から sectionIdx (0 始まり) を返す。
 * 見つからない場合は 0 にフォールバックして警告。
 */
function getSectionIdx(ctx, sectionId) {
  if (ctx.sectionsMap && sectionId in ctx.sectionsMap) {
    return ctx.sectionsMap[sectionId];
  }
  console.warn(`[v6.34 SQA-14] getSectionIdx: section_id="${sectionId}" が見つかりません。setDeckSections の id を確認してください。index=0 で続行します。`);
  return 0;
}

/**
 * section_id 文字列から「本編章番号」(1 始まり) を返す。
 *
 *   - 本編章: _header / _footer 等の擬似章を除いた、ユーザーが「N 章」と数える章。
 *   - 該当しない (footer / header / 不明な section_id) 場合は null を返す。
 *
 * FRAMING-5「X 章のポイント」自動タイトル生成、章扉ナンバリング等から呼ぶ。
 */
function getBodyChapterNum(ctx, sectionId) {
  if (!sectionId) return null;
  const m = ctx && ctx.bodyChapterNumMap;
  if (m && Object.prototype.hasOwnProperty.call(m, sectionId)) {
    return m[sectionId];
  }
  return null;
}

// ───────────────────────────────────────────────────────
// 背景・左サイド帯
// ───────────────────────────────────────────────────────

function setCanvasBg(ctx, slide) {
  slide.background = { color: ctx.C.canvas };
}

function addChromeLeftStrip(ctx, slide) {
  const { L, C, pres } = ctx;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: L.stripeW, h: L.slideH,
    fill: { color: C.brandSoft }, line: { type: 'none' },
  });
}

// ───────────────────────────────────────────────────────
// フッター部品 (ロゴ・テキスト・ページ番号)
// ───────────────────────────────────────────────────────

function addChromeLogo(ctx, slide) {
  const { T } = ctx;
  slide.addImage({
    path: T.logoPath('horizontalBlack'),
    x: 8.06, y: 0.20,
    w: 1.54, h: 0.32,
  });
}

function addChromeFooter(ctx, slide, text) {
  const { L, C, F, SZ } = ctx;
  slide.addText(text, {
    x: L.marginX, y: L.footerY, w: 5, h: L.footerH,
    fontSize: SZ.caption, color: C.gray400, fontFace: F.jp,
    align: 'left', margin: 0,
  });
}

/**
 * 左下の公式ロゴ配置。
 * horizontal-black.jpg は 4.808:1 アスペクト。素の w/h でアスペクトを揃える。
 */
function addChromeFooterLogo(ctx, slide) {
  const { T, L } = ctx;
  const logoW = 1.15;
  const logoH = logoW / 4.808;  // 約 0.239
  slide.addImage({
    path: T.logoPath('horizontalBlack'),
    x: L.marginX,
    y: L.footerY - 0.01,
    w: logoW, h: logoH,
  });
}

function addChromePage(ctx, slide, current) {
  const { L, C, F, SZ, totalPages } = ctx;
  slide.addText([
    { text: String(current).padStart(2, '0'), options: { bold: true, color: C.gray500 } },
    { text: ` / ${totalPages}`, options: { color: C.gray400 } },
  ], {
    x: 8.3, y: L.footerY, w: 1.3, h: L.footerH,
    fontSize: SZ.caption, fontFace: F.jp, charSpacing: 1,
    align: 'right', margin: 0,
  });
}

// ───────────────────────────────────────────────────────
// Chrome (左帯 + フッターロゴ + ページ番号 + ナビ)
// ───────────────────────────────────────────────────────

/**
 * 基本 chrome（ナビなし）。章扉や閉じなど、ナビを出さないテンプレで使う。
 */
function addChrome(ctx, slide, pageNum) {
  addChromeLeftStrip(ctx, slide);
  addChromeFooterLogo(ctx, slide);
  addChromePage(ctx, slide, pageNum);
}

/**
 * ナビ付き chrome。本編スライド（4-8, 10-19, 21 等）はすべてこれを呼ぶ。
 *
 * subsection を渡すとナビ右側にパンくず `章名 › サブセクション名` が出る。
 */
function addChromeWithNav(ctx, slide, pageNum, sectionIdx, subsection) {
  addChromeLeftStrip(ctx, slide);
  const navEndX = addChromeNav(ctx, slide, ctx.deckSections, sectionIdx);
  if (subsection) {
    addChromeSubsection(ctx, slide, subsection, navEndX);
  }
  addChromeFooterLogo(ctx, slide);
  addChromePage(ctx, slide, pageNum);
}

/**
 * section_id 指定版。JSON の slides[].section_id をそのまま渡せる。
 */
function addChromeWithNavById(ctx, slide, pageNum, sectionId, subsection) {
  const idx = getSectionIdx(ctx, sectionId);
  addChromeWithNav(ctx, slide, pageNum, idx, subsection || null);
}

/**
 * ナビチップ右側のパンくず表示「› サブセクション名」
 */
function addChromeSubsection(ctx, slide, name, startX) {
  const { L, C, F, pres } = ctx;
  const y = L.navY;
  const h = L.navH;

  // 区切り "›"
  const sepW = 0.26;
  slide.addText('›', {
    x: startX, y, w: sepW, h,
    fontSize: 13, color: C.gray400,
    fontFace: F.jp, align: 'center', valign: 'middle', margin: 0,
  });
  // 後ろに引かせる。osanai さん: 「メイン濃く / サブを抑えた黒にしてメリハリ」。
  // gray500 (#737373) 背景 + 白文字なら、メインの ink (#1F2937) との対比で
  // 「現在地は章 → さらにサブで掘っている」階層が一目でわかる。
  const badgeX = startX + sepW + 0.04;
  const badgeW = Math.max(1.4, name.length * 0.15 + 0.5);
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: badgeX, y, w: badgeW, h, rectRadius: 0.13,
    fill: { color: C.gray500 }, line: { type: 'none' },
  });
  slide.addText(name, {
    x: badgeX, y, w: badgeW, h,
    fontSize: 9, color: C.white,
    fontFace: F.jp, bold: false,
    align: 'center', valign: 'middle', margin: 0,
  });
}

/**
 * 上部セクションナビゲーションチップ。
 *
 * 自動切替ルール:
 *   1. sections.length >= navSimpleThreshold (default 6) なら simple variant
 *   2. (1) を満たさなくても、全 chip 幅合計 + gap が利用可能幅
 *      (slideW - marginX*2 - subsection 余白 1.0") を超えるなら simple variant
 *   3. それ以外は full nav (現在地 ink、非現在地 gray の 2 値配色)
 *
 * 配色:
 *   - 現在地 chip: ink 背景 + 白文字 + bold (強くフォーカス)
 *   - 非現在地 chip: gray100 背景 + gray500 文字 (後ろに引く)
 *   実際のスライドで「いま何章にいるか」が事実上判別不能だった。
 *
 * @returns {number} 最後のチップの右端 x 座標（subsection の基点に使う）
 */
function addChromeNav(ctx, slide, sections, currentIdx) {
  const { L, C, F, pres } = ctx;
  const threshold = L.navSimpleThreshold || 6;

  const y = L.navY;
  const chipH = L.navH;
  const chipGap = 0.08;

  // chip 幅の見積もり。全角 (日本語/CJK) は約 0.17"/文字、ASCII は 0.10"/文字 の重み付け。
  // 旧式 text.length*0.14 は全角を過小評価して右端切れを起こしていた。
  const measureChars = (text) => {
    let widthChars = 0;
    for (const ch of text) {
      // CJK・全角記号・かな漢字を 1.0、ASCII/半角を 0.6 として近似
      widthChars += /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/.test(ch) ? 1.0 : 0.6;
    }
    return widthChars;
  };
  const calcW = (text) => Math.max(0.9, measureChars(text) * 0.17 + 0.35);

  // 全 chip の合計幅を事前計算してオーバーフローを判定。
  // ナビは右上ロゴ (x: 8.06, w: 1.54) と同じ帯にあるので、ロゴ手前 8.00" で打ち止め。
  // さらに subsection バッジ用の余白を 1.0" 確保する。
  const slideW = (L.slideW || 10.0);
  const navRightLimit = 8.00;          // 右上ロゴと衝突しない上限
  const reservedForSubsection = 1.0;
  const availableW = navRightLimit - L.marginX - reservedForSubsection;
  const totalW = sections.reduce(
    (acc, name) => acc + calcW(name),
    0,
  ) + chipGap * Math.max(0, sections.length - 1);

  if (sections.length >= threshold || totalW > availableW) {
    return addChromeNavSimple(ctx, slide, sections, currentIdx);
  }

  let x = L.marginX;
  sections.forEach((name, i) => {
    const isCurrent = i === currentIdx;
    const w = calcW(name);
    const fillColor = isCurrent ? C.ink : C.gray100;
    const textColor = isCurrent ? C.white : C.gray500;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h: chipH, rectRadius: 0.13,
      fill: { color: fillColor }, line: { type: 'none' },
    });
    slide.addText(name, {
      x, y, w, h: chipH,
      fontSize: 9, color: textColor,
      fontFace: F.jp, bold: isCurrent,
      align: 'center', valign: 'middle', margin: 0,
    });
    x += w + chipGap;
  });

  return x;
}

/**
 * 多セクション向け simple variant ナビ「[ 3 / 8  解決策 ]」型。
 */
function addChromeNavSimple(ctx, slide, sections, currentIdx) {
  const { L, C, F, pres } = ctx;
  const y = L.navY;
  const h = L.navH;
  const x = L.marginX;
  const total = sections.length;
  const cur = currentIdx + 1;
  const name = sections[currentIdx];

  const ratioPrefix = `${cur} / ${total}`;
  const totalChars = ratioPrefix.length + 2 + name.length;
  const w = Math.max(2.0, totalChars * 0.16 + 0.45);
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.13,
    fill: { color: C.ink }, line: { type: 'none' },
  });

  slide.addText([
    { text: String(cur), options: { color: C.white, bold: true } },
    { text: ` / ${total}`, options: { color: C.white } },
    { text: `   ${name}`, options: { color: C.white, bold: true } },
  ], {
    x, y, w, h,
    fontSize: 10, fontFace: F.jp,
    align: 'center', valign: 'middle', margin: 0,
  });

  return x + w;
}

// ───────────────────────────────────────────────────────
// タイトルブロック
// ───────────────────────────────────────────────────────

/**
 * 統合タイトルブロック
 *
 * @returns {number} 本文開始 y 座標（cursorY + subBlockH + 0.16"）
 */
function addTitleBlock(ctx, slide, title, sub, opts = {}) {
  const { L, C, F, SZ, pres } = ctx;
  const baseY = opts.noNav ? L.titleBlockYNoNav : L.titleBlockY;
  const x = L.marginX;
  const w = 10 - L.marginX * 2;

  let cursorY = baseY;

  // Optional: 黒ラベル（eyebrow）
  if (opts.eyebrow) {
    const labelW = Math.max(1.0, opts.eyebrow.length * 0.17 + 0.40);
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cursorY, w: labelW, h: 0.26,
      fill: { color: C.ink }, line: { type: 'none' },
    });
    slide.addText(opts.eyebrow, {
      x, y: cursorY, w: labelW, h: 0.26,
      fontSize: 10, color: C.white, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
    cursorY += 0.34;
  }

  // タイトル (長いタイトルは shrinkFontSize で自動縮小して 1 行収まりを優先)
  // 推奨上限: 25 全角字 (= 50 字幅) 程度。それを超えるとサイズダウン
  const titleH = 0.48;
  const titleFs = shrinkFontSize(title, SZ.titleL, 50, { minFs: 16, perStep: 4, stepDown: 1 });
  if (opts.titleHyperlink) {
    slide.addText([{
      text: title,
      options: {
        fontSize: titleFs, fontFace: F.jp, bold: true,
        color: ctx.C.link,
        hyperlink: { url: opts.titleHyperlink, tooltip: title },
        underline: { style: 'sng' },
      },
    }], {
      x, y: cursorY, w, h: titleH,
      valign: 'bottom', margin: 0,
    });
  } else {
    slide.addText(title, {
      x, y: cursorY, w, h: titleH,
      fontSize: titleFs, color: C.ink, fontFace: F.jp,
      bold: true, valign: 'bottom', margin: 0,
    });
  }
  cursorY += titleH + 0.06;

  //
  // 灰色細罫線 + 平文リード) に変更。理由:
  //   - 文字数推定の限界で band 背景の下にしばしば余りが出る (過大推定)
  //   - 横文字無し / 1 メッセージ徹底の設計思想と整合する (装飾を削る)
  const style = opts.subcopyStyle || 'rule';
  const maxLines = opts.maxLines || 4;
  let subBlockH = 0;

  if (sub && style !== 'none') {
    // 文字数 ÷ 行あたり字数の推定式。和文 bold 11pt × 9.0" 幅で
    // 実測 60〜65 字/行に近いため /60 を採用
    const subLines = Math.max(1, Math.min(maxLines, Math.ceil(sub.length / 60)));
    subBlockH = 0.04 + 0.22 * subLines;

    const tones = {
      gray:   { bg: C.gray100,    dot: C.gray500, text: C.gray700 },
      purple: { bg: C.brandSoft,  dot: C.brand,   text: C.brandDeep },
      amber:  { bg: C.accentSoft, dot: C.accent,  text: C.accentDeep },
    };
    const tone = tones[opts.tone] || tones.gray;

    if (style === 'rule') {
      // タイトル直下 (cursorY) に Amber 太罫線 (左 0.55") + 灰色細罫線 (右側)
      // その下 (cursorY + 0.07) にリード文 (太字 灰色)
      const ruleY = cursorY;
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: ruleY, w: 0.55, h: 0.04,
        fill: { color: C.brand }, line: { type: 'none' },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: x + 0.55, y: ruleY + 0.018, w: w - 0.55, h: 0.005,
        fill: { color: C.gray300 }, line: { type: 'none' },
      });
      const subBaseOptsRule = {
        fontSize: SZ.lead, color: C.gray700, fontFace: F.jp,
        bold: true,
      };
      const subContentRule = expandInlineRefs(sub, ctx, subBaseOptsRule);
      const textY = ruleY + 0.07;
      slide.addText(subContentRule, {
        x, y: textY, w, h: subBlockH,
        fontSize: SZ.lead, color: C.gray700, fontFace: F.jp,
        bold: true,
        valign: 'top',
        lineSpacingMultiple: 1.40,
        margin: 0,
      });
      // 全体高さは罫線オフセット 0.07 + 本文 subBlockH
      subBlockH = 0.07 + subBlockH;
    } else if (style === 'band') {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: cursorY, w, h: subBlockH, rectRadius: 0.06,
        fill: { color: tone.bg }, line: { type: 'none' },
      });
      const subBaseOpts = {
        fontSize: SZ.lead, color: C.ink, fontFace: F.jp,
        bold: true,
      };
      const subContent = expandInlineRefs(sub, ctx, subBaseOpts);
      slide.addText(subContent, {
        x: x + 0.18, y: cursorY, w: w - 0.28, h: subBlockH,
        fontSize: SZ.lead, color: C.ink, fontFace: F.jp,
        bold: true,
        valign: subLines === 1 ? 'middle' : 'top',
        lineSpacingMultiple: 1.40,
        margin: subLines === 1 ? 0 : 0.04,
      });
    } else if (style === 'plain') {
      const subBaseOpts2 = {
        fontSize: SZ.lead, color: C.gray700, fontFace: F.jp,
      };
      const subContent2 = expandInlineRefs(sub, ctx, subBaseOpts2);
      slide.addText(subContent2, {
        x, y: cursorY, w, h: subBlockH,
        fontSize: SZ.lead, color: C.gray700, fontFace: F.jp,
        valign: subLines === 1 ? 'middle' : 'top',
        lineSpacingMultiple: 1.32,  // 1.40 → 1.32 (subtitle 内の行間を詰める)
        margin: subLines === 1 ? 0 : 0.02,  // 0.04 → 0.02
      });
    }
  }

  // 2026-05-14: subtitle 直下の自動余白を 0.04" → 0.00 に削減.
  // 各テンプレ側の `titleBottomY + 個別マージン` で本文との間隔を制御する設計に統一.
  return cursorY + subBlockH;
}

/**
 * 単独タイトル (例外テンプレ用)。新規コードでは addTitleBlock 推奨。
 */
function addTitle(ctx, slide, text, opts = {}) {
  const { L, C, F, SZ } = ctx;
  slide.addText(text, {
    x: L.marginX, y: opts.noNav ? L.titleYNoNav : L.titleY,
    w: 8, h: L.titleH,
    fontSize: SZ.titleL, color: C.ink, fontFace: F.jp,
    bold: true, margin: 0, valign: 'top',
  });
}

/**
 * リード文 (章扉等で使う)。
 */
function addLead(ctx, slide, text, opts = {}) {
  const { L, C, F, SZ } = ctx;
  slide.addText(text, {
    x: L.marginX, y: opts.noNav ? L.leadYNoNav : L.leadY,
    w: 9.2, h: L.leadH,
    fontSize: SZ.lead, color: C.gray500, fontFace: F.jp,
    margin: 0,
  });
}

// ───────────────────────────────────────────────────────
// 強調チップ (タグ)
// ───────────────────────────────────────────────────────

/**
 * 強調チップ (ピル形状の小タグ)
 *
 * @param variant 'important' (赤) | 'brand' | 'accent' | 'info'
 */
function addTag(ctx, slide, text, x, y, variant = 'important', opts = {}) {
  const { C, F, pres } = ctx;
  const variants = {
    important: { fill: 'DC2626',  color: 'FFFFFF' },
    brand:     { fill: C.brand,   color: C.brandContrast || 'FFFFFF' },
    accent:    { fill: C.accent,  color: C.accentContrast || 'FFFFFF' },
    info:      { fill: C.gray200, color: C.gray700 },
  };
  const v = variants[variant] || variants.important;
  const size = opts.size === 'sm' ? { h: 0.22, fs: 8.5, px: 0.10 }
                                  : { h: 0.28, fs: 10,  px: 0.14 };
  const w = Math.max(0.5, text.length * (size.fs * 0.017) + size.px * 2);

  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h: size.h, rectRadius: size.h / 2,
    fill: { color: v.fill }, line: { type: 'none' },
  });
  slide.addText(text, {
    x, y, w, h: size.h,
    fontSize: size.fs, bold: true, color: v.color, fontFace: F.jp,
    align: 'center', valign: 'middle', margin: 0,
  });
}

// ───────────────────────────────────────────────────────
// インライン参照番号 + 脚注
// ───────────────────────────────────────────────────────

/**
 * 本文テキスト内に `(N)` の青文字ハイパーリンクを埋め込む text run を返す。
 * `slide.addText([...runs])` の runs 配列にそのまま入れる。
 */
/**
 *
 * 対応する citation marker 形式 (v10.1.7 で拡張):
 *   - 半角角括弧:  "[N]"   ← v10.1.7 で追加 (academic citation style — Claude が学術系
 *                            デッキで自動採用しがち)
 *   - 全角丸括弧:  "（N）" ← v10.1.7 で追加 (日本語 IME で誤って混入するケース)
 *
 * Claude が plan.json に subtitle: "競合ではなく補完。共存できる。(5)(6)" と書いた場合
 * (あるいは "[5][6]" / "（5）（6）" と書いた場合)、これを PptxGenJS の addText が受ける
 * text-run 配列形式に変換し、N の部分だけが Office 標準ハイパーリンク色 + 下線 +
 * クリック可能なリンクになる。
 *
 * ctx.refsByNum[N] に URL が無い場合は変換しない (生文字列のまま残る) ので、
 * 「(1) はじめに」「[A]」「(10)」 (URL未登録) のような番号付き見出しは誤変換しない。
 * URL 内の "(11)" のようなパターンも、URL 文字列自体に refsByNum マッピングが無ければ
 * 素通り (誤変換は起きない)。
 *
 * 戻り値:
 *   - 入力文字列内にマーカーが無い場合: 元の string を返す (PptxGenJS が普通に処理)
 *   - マーカーがあるが URL 解決できない場合: 元の string を返す (生文字列のまま)
 *   - マーカーがあり URL 解決できる場合: text-run 配列を返す
 *     [
 *       { text: "競合ではなく補完。共存できる。", options: { ...baseOptions } },
 *       { text: " (5)", options: { hyperlink: { url: ... }, color: "0563C1", underline: { style: "sng" }, ...baseOptions } },
 *       { text: " (6)", options: { hyperlink: { url: ... }, color: "0563C1", underline: { style: "sng" }, ...baseOptions } },
 *     ]
 *
 * @param text {string} 元の文字列
 * @param ctx {object} ctx (refsByNum を持つ)
 * @param baseOptions {object} 各 text-run に共通で適用するオプション (fontFace, fontSize, color など)
 * @returns {string | Array<{text, options}>}
 */
function expandInlineRefs(text, ctx, baseOptions = {}) {
  if (typeof text !== 'string' || !text) return text;
  const refsByNum = (ctx && ctx.refsByNum) || {};

  // v10.1.7: 半角 "(N)" / 半角 "[N]" / 全角 "（N）" の 3 形式を許容。
  //   - キャプチャグループ 1: (N) のN
  //   - キャプチャグループ 2: [N] のN
  //   - キャプチャグループ 3: （N） のN
  // どれもマッチしたら m[1] || m[2] || m[3] で N が取れる。
  // 直前のスペース有無は問わない (「(5)(6)」「[5][6]」も OK)。
  const re = /\((\d{1,3})\)|\[(\d{1,3})\]|（(\d{1,3})）/g;
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const numStr = m[1] || m[2] || m[3];
    const num = parseInt(numStr, 10);
    const url = refsByNum[num];
    if (url) {
      matches.push({ start: m.index, end: m.index + m[0].length, num, url });
    }
  }

  // 解決可能な (N) が一つも無い → 元の string をそのまま返す (誤変換しない)
  if (matches.length === 0) return text;

  // text-run 配列を組み立てる
  const runs = [];
  let cursor = 0;
  for (const ref of matches) {
    // (N) より前の通常テキスト
    if (ref.start > cursor) {
      runs.push({
        text: text.slice(cursor, ref.start),
        options: Object.assign({}, baseOptions),
      });
    }
    // (N) 自体をハイパーリンク化
    runs.push({
      text: text.slice(ref.start, ref.end),
      options: Object.assign({}, baseOptions, {
        color: ctx.C.link,
        hyperlink: { url: ref.url, tooltip: `出典 (${ref.num})` },
        underline: { style: 'sng' },
      }),
    });
    cursor = ref.end;
  }
  // 末尾の通常テキスト
  if (cursor < text.length) {
    runs.push({
      text: text.slice(cursor),
      options: Object.assign({}, baseOptions),
    });
  }
  return runs;
}

function inlineRef(ctx, num, url, opts = {}) {
  const { F } = ctx;
  const size = opts.size ?? 10;
  const tooltip = opts.tooltip ?? `出典 (${num})`;
  return {
    text: ` (${num})`,
    options: {
      color: ctx.C.link,
      hyperlink: { url, tooltip },
      underline: { style: 'sng' },
      fontSize: size,
      fontFace: F.jp,
    },
  };
}

/**
 * 既存の text-run 配列内に含まれる (N) 引用パターンを再帰的に展開し、
 * 青文字ハイパーリンク化する。
 *
 * テンプレ側で `slide.addText([{text:..., options:...}, ...])` 形で組んだ runs を
 * そのまま渡すと、各 run の text を expandInlineRefs に通して (N) を分割し、
 * 元の options を継承しつつ (N) 部分だけハイパーリンク色 + underline に置換する。
 *
 * baseOptions が無い run、text が無い run、breakLine 専用 run などはそのまま通す。
 *
 * @param runs Array<{text?, options?}>
 * @param ctx render ctx (refsByNum を持つ)
 * @returns 新しい runs 配列 (元配列は変更しない)
 */
function expandRunsInlineRefs(runs, ctx) {
  if (!Array.isArray(runs)) return runs;
  const out = [];
  for (const run of runs) {
    if (!run || typeof run !== 'object' || typeof run.text !== 'string' || !run.text) {
      out.push(run);
      continue;
    }
    const baseOptions = run.options || {};
    const expanded = expandInlineRefs(run.text, ctx, baseOptions);
    if (typeof expanded === 'string') {
      // (N) パターンが無い or URL 解決できなかった → 元 run をそのまま通す
      out.push(run);
    } else if (Array.isArray(expanded)) {
      // 末尾 run の options.breakLine を、最後の展開 run に継承させる
      // (元の run が breakLine: true を持っていた場合、改行は最後に来るべき)
      if (baseOptions.breakLine && expanded.length > 0) {
        const last = expanded[expanded.length - 1];
        last.options = Object.assign({}, last.options, { breakLine: true });
      }
      out.push(...expanded);
    } else {
      out.push(run);
    }
  }
  return out;
}

/**
 * 本文 (user-supplied content) 用の addText ラッパー。
 *
 * content が string でも runs 配列でも、(N) パターンを自動でハイパーリンク化してから
 * slide.addText を呼ぶ。
 *
 * テンプレ側の置換は `slide.addText(X, Y)` → `atoms.addBodyText(ctx, slide, X, Y)`
 * の機械的な書き換えだけで済む。
 *
 * decoration ラベル (「Before」「After」「01」「02」など template-author が固定で
 * 描画する文字列) には使わなくて良い。あくまで user-supplied 文字列が混じる箇所が対象。
 *
 * @param ctx render ctx
 * @param slide pptx slide
 * @param content string | Array<{text, options}>
 * @param opts pptxgenjs addText opts
 */
function addBodyText(ctx, slide, content, opts) {
  let processed = content;
  if (typeof content === 'string') {
    processed = expandInlineRefs(content, ctx, {});
  } else if (Array.isArray(content)) {
    processed = expandRunsInlineRefs(content, ctx);
  }
  return slide.addText(processed, opts);
}

/**
 * 脚注（出典・注釈）。スライド下部、フッター直上に積み上げる。
 *
 * @param items string | [{label, url?} | {note}]
 */
function addFootnote(ctx, slide, items, opts = {}) {
  const { L, C, F } = ctx;
  const size = opts.size === 'md' ? 9.5 : opts.size === 'sm' ? 8.5 : 9;
  const lineH = 0.18;
  const list = Array.isArray(items) ? items : [items];
  const baseY = L.footerY - 0.02;
  const LINK_COLOR = ctx.C.link;

  list.forEach((item, i) => {
    const y = baseY - (list.length - i) * lineH;
    const common = {
      x: L.marginX, y, w: 10 - L.marginX * 2, h: lineH,
      fontSize: size, fontFace: F.jp,
      valign: 'middle', margin: 0,
    };

    if (typeof item === 'string') {
      const text = item.startsWith('※') ? item : `※ ${item}`;
      slide.addText(text, { ...common, color: C.gray500 });
    } else if (item.note) {
      const text = item.note.startsWith('※') ? item.note : `※ ${item.note}`;
      slide.addText(text, { ...common, color: C.gray500 });
    } else if (item.label) {
      const parts = [
        { text: '※ 出典: ', options: { color: C.gray500 } },
      ];
      if (item.url) {
        parts.push({
          text: item.label,
          options: {
            color: LINK_COLOR,
            hyperlink: { url: item.url, tooltip: item.label },
            underline: { style: 'sng' },
          },
        });
      } else {
        parts.push({ text: item.label, options: { color: C.gray500 } });
      }
      slide.addText(parts, common);
    }
  });
}

// ───────────────────────────────────────────────────────
// Speaker Notes
// ───────────────────────────────────────────────────────

/**
 * Speaker Notes を埋め込む。
 *
 *   - info.narration があればそれをそのままノートに書き込む (ナレーション台本モード)
 *   - info.narration が空で 4 行構造 (template/goal/message/design) のいずれかがあれば
 *     旧フォーマット として互換でレンダリング
 *   - レガシー 4 行は今後デッキを再生成する時に narration へ書き換える方針
 *
 * @param info {
 *   narration?: string,
 * }
 */
function addSpeakerNotes(ctx, slide, info = {}) {
  let narration = '';
  if (typeof info.narration === 'string') {
    narration = info.narration;
  } else if (info.slideJson && typeof info.slideJson === 'object') {
    narration = info.slideJson.speaker_notes || info.slideJson.notes || '';
  }
  if (typeof narration === 'string') {
    const narr = narration.trim();
    if (narr) {
      slide.addNotes(narr);
      return;
    }
  }
  const lines = [];
  if (info.template) lines.push(`[テンプレ] ${info.template}`);
  if (info.goal)     lines.push(`[狙い] ${info.goal}`);
  if (info.message)  lines.push(`[1メッセージ] ${info.message}`);
  if (info.design)   lines.push(`[設計メモ] ${info.design}`);
  if (lines.length === 0) return;
  slide.addNotes(lines.join('\n'));
}

// ───────────────────────────────────────────────────────
// Twilight Forge ヘルパー
// SECTION-1 / FRAMING-3 で共通利用。将来の dark hero 系テンプレでも再利用可能。
// テーマ非依存（HP brand 配色を固定）。
// ───────────────────────────────────────────────────────

const TWILIGHT_FORGE = {
  canvas:     '0E0F14',
  cardFill:   '1A1B26',
  cardLine:   '2A2C39',
  cardLineHi: '3A3D4F',
  hairline:   '262835',

  ink:        'FFFFFF',
  inkSoft:    'CFD2DA',
  inkMute:    '8A8E9C',
  inkFaint:   '5B5F6E',

  brand:      '6B46C1',
  brandSoft:  '8B5CF6',
  brandDeep:  '4C2E92',
  accent:     'EA580C',
  accentSoft: 'FB923C',
  accentDeep: 'C2410C',
};

/**
 * 大気感のあるぼかし球。背景レイヤーに 4 段透明度で重ねる。
 * 表紙・閉じの「Twilight Forge ブックエンド」感を演出する核。
 */
/**
 * 文字数に応じて fontSize を動的縮小するヘルパー
 *
 * @param {string} text       表示テキスト (全角=2 / 半角=1 で字幅推定)
 * @param {number} baseFs     基本 fontSize (pt)
 * @param {number} thresholdW 推奨字幅 (この字幅で baseFs を維持)
 * @param {object} [opts]
 *   - minFs    {number} 最低 fontSize (default 8)
 *   - stepDown {number} 1 段あたりの縮小 pt (default 1)
 *   - perStep  {number} 1 段で許容する追加字幅 (default 5)
 * @returns {number} 実際に使う fontSize
 *
 * 例: shrinkFontSize('長いタイトル', 14, 20) →
 *   字幅 24 (推奨 20 を 4 超過) → step 1 で 13pt
 */
function shrinkFontSize(text, baseFs, thresholdW, opts = {}) {
  const minFs = opts.minFs || 8;
  const stepDown = opts.stepDown || 1;
  const perStep = opts.perStep || 5;
  const s = String(text || '');
  // 全角=2 / 半角=1 換算で字幅推定
  let w = 0;
  for (const ch of s) {
    w += /[\x00-\x7f]/.test(ch) ? 1 : 2;
  }
  if (w <= thresholdW) return baseFs;
  const overSteps = Math.ceil((w - thresholdW) / perStep);
  return Math.max(minFs, baseFs - overSteps * stepDown);
}

/**
 * 1 行収まりを保証する fontSize 縮小 + 必要に応じた truncate。
 *
 * 3-Box 系 (LIST-2 / LIST-3 / LIST-4) のカード title が 2 行折り返しすると
 * カード内の縦リズムが崩れるため、ladder 上で fontSize を段階縮小し、
 * 最小サイズでも収まらない場合は末尾を '…' で truncate して 1 行を維持する。
 *
 * @param {string} text       表示テキスト
 * @param {number} widthIn    利用可能な水平幅 (inch)
 * @param {number[]} ladder   試行する fontSize のリスト (大→小, default [16,14,12,11])
 * @param {object} opts
 *   - context  {string}  WritingQA-warn ログ用のコンテキスト ('LIST-2 S20 col[0]' など)
 *   - jpRatio  {number}  全角字幅係数 (default 1.0 = fs/72 inch per 全角)
 *   - asciiRatio {number} 半角字幅係数 (default 0.5)
 * @returns {{ fontSize: number, text: string, didTruncate: boolean }}
 */
function fitOneLine(text, widthIn, ladder, opts = {}) {
  const lad = Array.isArray(ladder) && ladder.length > 0 ? ladder : [16, 14, 12, 11];
  const jpRatio = opts.jpRatio != null ? opts.jpRatio : 1.0;
  const asciiRatio = opts.asciiRatio != null ? opts.asciiRatio : 0.5;
  const s = String(text || '');
  function widthAt(fs, str) {
    let w = 0;
    for (const ch of str) {
      w += /[\x00-\x7f]/.test(ch) ? (fs * asciiRatio) / 72 : (fs * jpRatio) / 72;
    }
    return w;
  }
  for (const fs of lad) {
    if (widthAt(fs, s) <= widthIn) {
      return { fontSize: fs, text: s, didTruncate: false };
    }
  }
  // どれにも収まらない: 最小 fs で末尾 truncate
  const minFs = lad[lad.length - 1];
  const ellipsisW = widthAt(minFs, '…');
  const safeW = widthIn - ellipsisW;
  let acc = 0, kept = '';
  for (const ch of s) {
    const cw = /[\x00-\x7f]/.test(ch) ? (minFs * asciiRatio) / 72 : (minFs * jpRatio) / 72;
    if (acc + cw > safeW) break;
    kept += ch;
    acc += cw;
  }
  if (opts.context) {
    // eslint-disable-next-line no-console
    console.warn(
      `[WritingQA-warn] ${opts.context}: title が 1 行に収まらず truncate されました ` +
      `(fs=${minFs}pt, width=${widthIn.toFixed(2)}in, original="${s}")`
    );
  }
  return { fontSize: minFs, text: kept + '…', didTruncate: true };
}

function addAtmosphericOrb(ctx, slide, cx, cy, r, color, layers = 4) {
  const { pres } = ctx;
  const tArr = [92, 84, 75, 64];
  const sArr = [1.00, 0.78, 0.55, 0.32];
  const limit = Math.min(layers, tArr.length);
  for (let i = 0; i < limit; i++) {
    const rr = r * sArr[i];
    slide.addShape(pres.shapes.OVAL, {
      x: cx - rr, y: cy - rr, w: rr * 2, h: rr * 2,
      fill: { color, transparency: tArr[i] },
      line: { type: 'none' },
    });
  }
}

/**
 * 5 段ステップの signature gradient pill (紫→橙)。
 * Twilight Forge の hairline 上に置くブランド signature。
 */
function addGradientPill(ctx, slide, x, y, opts = {}) {
  const { pres } = ctx;
  const pillTotalW = opts.totalW || 1.80;
  const pillH = opts.h || 0.085;
  const pillY = y - pillH / 2 + 0.0025;
  const pillSteps = opts.steps || ['6B46C1', '8050C5', 'A04E9C', 'C44B62', 'EA580C'];
  const stepW = pillTotalW / pillSteps.length;
  pillSteps.forEach((col, i) => {
    const isFirst = i === 0;
    const isLast = i === pillSteps.length - 1;
    const stepX = x + stepW * i;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: stepX, y: pillY, w: stepW + 0.005, h: pillH,
      fill: { color: col }, line: { type: 'none' },
    });
    if (isFirst) {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: stepX, y: pillY, w: pillH, h: pillH, rectRadius: pillH / 2,
        fill: { color: col }, line: { type: 'none' },
      });
    }
    if (isLast) {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: stepX + stepW - pillH, y: pillY, w: pillH, h: pillH, rectRadius: pillH / 2,
        fill: { color: col }, line: { type: 'none' },
      });
    }
  });
}

// ───────────────────────────────────────────────────────
// Module Exports
// ───────────────────────────────────────────────────────

/* =========================================================
   v11.3 新規ヘルパー (Phase α design-critique 対応)
   ========================================================= */

/**
 * Chrome をフル合成 (ナビなし)。
 * v11.3 で 4 連発を共通化:
 *   addChromeLeftStrip + addChromeLogo + addChromePage + addChromeFooterLogo
 */
function addChromeFull(ctx, slide, pageNum, opts = {}) {
  if (opts.withNav) {
    if (opts.sectionId) {
      addChromeWithNavById(ctx, slide, pageNum, opts.sectionId, opts.subsection || null);
    } else {
      addChromeWithNav(ctx, slide, pageNum, opts.sectionIdx || 0, opts.subsection || null);
    }
  } else {
    addChromeLeftStrip(ctx, slide);
    addChromeLogo(ctx, slide);
    addChromePage(ctx, slide, pageNum);
    addChromeFooterLogo(ctx, slide);
  }
}

/**
 * 評価記号 (◎○△×) → 色トークン名 マップ (v11.3 で全 COMPARE で統一)。
 *   ◎ (最良)   → brand
 *   ○ / ◯ (良)  → gray700
 *   △ (微妙)   → accent
 *   × (悪)     → gray400
 */
const MARK_PALETTE = {
  '◎': 'brand',
  '○': 'gray700',
  '◯': 'gray700',
  '△': 'accent',
  '×': 'gray400',
};

function resolveMarkColor(C, mark) {
  const token = MARK_PALETTE[mark];
  if (!token) return C.ink;
  return C[token] || C.ink;
}

function resolveColor(C, name, strict) {
  if (typeof name !== 'string') return C.ink;
  if (/^#?[0-9A-Fa-f]{6}$/.test(name)) {
    if (strict) return null;
    return name.replace('#', '');
  }
  const v = C[name];
  if (v !== undefined && v !== null && v !== '') return v;
  return C.ink;
}


module.exports = {
  // 章リスト管理
  setDeckSections,
  getSectionIdx,
  getBodyChapterNum,

  // 背景・左帯
  setCanvasBg,
  addChromeLeftStrip,

  // フッター部品
  addChromeLogo,
  addChromeFooter,
  addChromeFooterLogo,
  addChromePage,

  // Chrome (合成)
  addChrome,
  addChromeWithNav,
  addChromeWithNavById,
  addChromeSubsection,
  addChromeNav,
  addChromeNavSimple,

  // タイトル
  addTitleBlock,
  addTitle,
  addLead,

  // 強調チップ
  addTag,

  // 参照・脚注
  inlineRef,
  expandInlineRefs,
  expandRunsInlineRefs,
  addBodyText,
  addFootnote,

  // Notes
  addSpeakerNotes,

  // v11.3 design-critique ヘルパー
  addChromeFull,
  resolveColor,
  resolveMarkColor,
  MARK_PALETTE,

  // Twilight Forge
  TWILIGHT_FORGE,
  shrinkFontSize,
  fitOneLine,
  addAtmosphericOrb,
  addGradientPill,
};
