/**
 * atoms-shape.js — shape 原子要素ライブラリ
 * ===================================================
 *
 * 「shape 原子要素を組み合わせて、安定的に挿絵やシーンを描く」ための関数群。
 * pptxgenjs の slide.addShape / slide.addText を直接呼ぶより一段高いレベルで、
 * よく使う「○ノード + △ラベル + 矢印」のセットを 1 関数で出せる。
 *
 * これを使って scenes/*.js のシーンプリセットを組み立てたり、SECSUMMARY-1 の
 * `diagram` キーから直接呼んでカスタム挿絵を描いたりできる。
 *
 * 設計原則:
 *   - 関数 API。引数 (slide, position, opts, ctx) で副作用的に slide に shape を
 *     描く。戻り値は { x, y, w, h, anchors } で接続点情報を返すので、後続の
 *     link/arrow がそれを参照できる。
 *   - 色はトークン経由 (ハードコード hex 禁止)
 *   - フォントは Noto Sans JP を内部で指定 (呼び出し側に押し付けない)
 *   - 1 関数 = 1 視覚要素。複合は scenes/*.js で組む
 *
 * ⚠️ pptxgenjs の罠: opts オブジェクトは破壊的に書き換えられるため、共通の
 *    opts を 2 回渡してはいけない。本ファイルでは内部で opts を都度生成する
 *    ことで安全側に倒している (CHART_STYLE と同じ思想)。
 *
 * Atom 一覧:
 *   - drawNode      : 円・角丸矩形・矩形のノード (ラベル付き)
 *   - drawLink      : 2 ノード間の直線リンク
 *   - drawArrow     : 矢印付きリンク
 *   - drawCallout   : 太い縦帯 + テキストの強調コールアウト
 *   - drawTagPill   : 角丸ピル型ラベル
 *   - drawIconBadge : アイコン文字を囲んだ円形バッジ
 */

'use strict';

// ───────────────────────────────────────────────────────
// helpers
// ───────────────────────────────────────────────────────

function _resolveColor(C, key) {
  // 'brand' / 'accent' / 'gray500' / '#RRGGBB' などを許容
  if (!key) return C.gray500;
  if (key.startsWith('#')) return key;
  return C[key] || key;
}

function _centerOf(area) {
  return { x: area.x + area.w / 2, y: area.y + area.h / 2 };
}

// ───────────────────────────────────────────────────────
// drawNode — 円 / 角丸矩形 / 矩形のノード
// ───────────────────────────────────────────────────────

/**
 * shape: 'oval' | 'round' | 'rect'
 * label, sub: 中央のテキスト
 * fill / stroke / textColor: トークンキーまたは hex
 * 戻り値: { x, y, w, h, cx, cy } anchor 用
 */
function drawNode(slide, area, opts, ctx) {
  const { C, F, pres } = ctx;
  const shape = opts.shape || 'oval';
  // 強調が必要な時は呼び出し側で fill: 'brandSoft' / 'accentSoft' / 'highlightSoft'
  // を明示する (1 シーンに 1 箇所だけ強調)。
  const fill = _resolveColor(C, opts.fill || 'canvas');
  const stroke = _resolveColor(C, opts.stroke || 'brand');
  const strokeWidth = opts.strokeWidth != null ? opts.strokeWidth : 1;
  const textColor = _resolveColor(C, opts.textColor || 'ink');
  const subColor  = _resolveColor(C, opts.subColor  || 'gray500');

  const shapeKind = shape === 'rect' ? pres.shapes.RECTANGLE
                  : shape === 'round' ? pres.shapes.ROUNDED_RECTANGLE
                  : pres.shapes.OVAL;
  const shapeOpts = {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fill: { color: fill },
    line: strokeWidth > 0 ? { color: stroke, width: strokeWidth } : { type: 'none' },
  };
  if (shape === 'round') shapeOpts.rectRadius = opts.radius != null ? opts.radius : 0.10;
  slide.addShape(shapeKind, shapeOpts);

  // ラベル: label が主、sub が副 (2 行構成)
  if (opts.label) {
    const labelH = opts.sub ? area.h * 0.46 : area.h;
    const labelY = opts.sub ? area.y + area.h * 0.20 : area.y;
    slide.addText(opts.label, {
      x: area.x, y: labelY, w: area.w, h: labelH,
      fontSize: opts.labelSize || 11, color: textColor, fontFace: F.jp,
      bold: opts.bold !== false,
      align: 'center', valign: 'middle', margin: 0,
    });
  }
  if (opts.sub) {
    slide.addText(opts.sub, {
      x: area.x, y: area.y + area.h * 0.55, w: area.w, h: area.h * 0.30,
      fontSize: opts.subSize || 9, color: subColor, fontFace: F.jp,
      align: 'center', valign: 'middle', margin: 0,
    });
  }

  return {
    x: area.x, y: area.y, w: area.w, h: area.h,
    cx: area.x + area.w / 2,
    cy: area.y + area.h / 2,
  };
}

// ───────────────────────────────────────────────────────
// drawLink — 2 点間の直線
// ───────────────────────────────────────────────────────

/**
 * from, to: { cx, cy } または { x, y }
 * style: 'solid' | 'dashed'
 * 端点を node の境界まで自動で短縮する場合は from.r / to.r (半径) を渡す
 */
function drawLink(slide, from, to, opts = {}, ctx) {
  const { C, pres } = ctx;
  const color = _resolveColor(C, opts.color || 'gray300');
  const width = opts.width != null ? opts.width : 1;
  const dashed = opts.style === 'dashed';

  const x1 = from.cx != null ? from.cx : from.x;
  const y1 = from.cy != null ? from.cy : from.y;
  const x2 = to.cx   != null ? to.cx   : to.x;
  const y2 = to.cy   != null ? to.cy   : to.y;

  slide.addShape(pres.shapes.LINE, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width, dashType: dashed ? 'dash' : 'solid' },
  });
}

// ───────────────────────────────────────────────────────
// drawArrow — 矢印付きリンク (片方向)
// ───────────────────────────────────────────────────────

function drawArrow(slide, from, to, opts = {}, ctx) {
  const { C, pres } = ctx;
  const color = _resolveColor(C, opts.color || 'brand');
  const width = opts.width != null ? opts.width : 2;

  const x1 = from.cx != null ? from.cx : from.x;
  const y1 = from.cy != null ? from.cy : from.y;
  const x2 = to.cx   != null ? to.cx   : to.x;
  const y2 = to.cy   != null ? to.cy   : to.y;

  slide.addShape(pres.shapes.LINE, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: {
      color, width,
      endArrowType: 'triangle',
    },
  });
}

// ───────────────────────────────────────────────────────
// drawCallout — 太い縦帯 + 強調テキスト
// ───────────────────────────────────────────────────────

function drawCallout(slide, area, opts, ctx) {
  const { C, F, pres } = ctx;
  const barColor = _resolveColor(C, opts.barColor || 'accent');
  const textColor = _resolveColor(C, opts.textColor || 'ink');
  const bgFill = opts.bg ? _resolveColor(C, opts.bg) : null;

  // 背景 (任意)
  if (bgFill) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: area.x, y: area.y, w: area.w, h: area.h, rectRadius: 0.06,
      fill: { color: bgFill }, line: { type: 'none' },
    });
  }
  // 左の太いバー
  const barW = opts.barWidth || 0.06;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: area.x, y: area.y, w: barW, h: area.h,
    fill: { color: barColor }, line: { type: 'none' },
  });
  // テキスト
  const padX = barW + (opts.padX != null ? opts.padX : 0.16);
  if (opts.headline) {
    slide.addText(opts.headline, {
      x: area.x + padX, y: area.y + 0.05,
      w: area.w - padX - 0.08, h: opts.body ? area.h * 0.40 : area.h - 0.10,
      fontSize: opts.headlineSize || 13, color: textColor, fontFace: F.jp,
      bold: true, valign: opts.body ? 'top' : 'middle', margin: 0,
    });
  }
  if (opts.body) {
    slide.addText(opts.body, {
      x: area.x + padX, y: area.y + area.h * 0.42,
      w: area.w - padX - 0.08, h: area.h * 0.55,
      fontSize: opts.bodySize || 10,
      color: _resolveColor(C, opts.bodyColor || 'gray700'), fontFace: F.jp,
      valign: 'top', margin: 0, lineSpacingMultiple: 1.40,
    });
  }
}

// ───────────────────────────────────────────────────────
// drawTagPill — 角丸ピル型ラベル
// ───────────────────────────────────────────────────────

function drawTagPill(slide, x, y, label, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const fill = _resolveColor(C, opts.fill || 'gray100');
  const textColor = _resolveColor(C, opts.textColor || 'ink');
  const w = opts.w || Math.max(0.60, label.length * 0.13 + 0.30);
  const h = opts.h || 0.26;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: h / 2,
    fill: { color: fill }, line: { type: 'none' },
  });
  slide.addText(label, {
    x, y, w, h,
    fontSize: opts.fontSize || 9, color: textColor, fontFace: F.jp,
    bold: !!opts.bold,
    align: 'center', valign: 'middle', margin: 0,
  });
  return { x, y, w, h, cx: x + w/2, cy: y + h/2 };
}

// ───────────────────────────────────────────────────────
// drawIconBadge — 円形のアイコンバッジ (ASCII 絵文字や 1 文字)
// ───────────────────────────────────────────────────────

function drawIconBadge(slide, cx, cy, opts, ctx) {
  const { C, F, pres } = ctx;
  const r = opts.r || 0.30;
  const fill = _resolveColor(C, opts.fill || 'brand');
  const textColor = _resolveColor(C, opts.textColor || 'white');
  slide.addShape(pres.shapes.OVAL, {
    x: cx - r, y: cy - r, w: r * 2, h: r * 2,
    fill: { color: fill }, line: { type: 'none' },
  });
  if (opts.icon) {
    slide.addText(opts.icon, {
      x: cx - r, y: cy - r, w: r * 2, h: r * 2,
      fontSize: opts.fontSize || 14, color: textColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
  return { cx, cy, r, x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
}


// ───────────────────────────────────────────────────────
// ビジネスモデル図 専用 atom
// ───────────────────────────────────────────────────────
// BizGram (図解総研) で見られるような「人物 + 会社ブロック + お金/サービスの
// 流れ + フレーム」をパーツ単位で描けるようにする。

/** drawActor — 人物アイコン (頭=丸 + 体=台形 + ラベル)
 *  小さい記号として用いる。typically w=0.6 / h=0.9 程度
 *  opts: {label, sub?, color?:'gray500'|'brand'|'accent'}
 */
function drawActor(slide, cx, cy, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const color = _resolveColor(C, opts.color || 'gray500');
  const labelColor = _resolveColor(C, opts.labelColor || 'ink');
  const headR = opts.headR || 0.16;
  const bodyW = opts.bodyW || 0.46;
  const bodyH = opts.bodyH || 0.32;

  // 頭 (丸)
  slide.addShape(pres.shapes.OVAL, {
    x: cx - headR, y: cy - headR - bodyH/2 - 0.04,
    w: headR * 2, h: headR * 2,
    fill: { color }, line: { type: 'none' },
  });
  // 体 (角丸矩形を上半円に近づける)
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: cx - bodyW / 2, y: cy - bodyH / 2 + headR + 0.04,
    w: bodyW, h: bodyH, rectRadius: bodyW / 2.2,
    fill: { color }, line: { type: 'none' },
  });
  // ラベル
  if (opts.label) {
    slide.addText(opts.label, {
      x: cx - 0.80, y: cy + bodyH/2 + headR + 0.10, w: 1.60, h: 0.24,
      fontSize: 10, color: labelColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
  if (opts.sub) {
    slide.addText(opts.sub, {
      x: cx - 0.90, y: cy + bodyH/2 + headR + 0.32, w: 1.80, h: 0.20,
      fontSize: 8, color: _resolveColor(C, 'gray500'), fontFace: F.jp,
      align: 'center', valign: 'middle', margin: 0,
    });
  }
  return { cx, cy, w: Math.max(bodyW, headR * 2), h: bodyH + headR * 2 };
}

/** drawOrgBlock — 会社・組織のブロック (角丸矩形 + ロゴ風先頭バー + 役割ラベル)
 *  opts: {label, role?:'プラットフォーム'|'仲介'|...}
 */
function drawOrgBlock(slide, area, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const fill = _resolveColor(C, opts.fill || 'canvas');
  const stroke = _resolveColor(C, opts.stroke || 'brand');
  const headerColor = _resolveColor(C, opts.headerColor || 'brand');
  const labelColor = _resolveColor(C, opts.labelColor || 'ink');

  // 本体
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: area.x, y: area.y, w: area.w, h: area.h, rectRadius: 0.08,
    fill: { color: fill }, line: { color: stroke, width: 1 },
  });
  // 先頭バー (役割タグ表示用)
  const headerH = 0.26;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: area.x, y: area.y, w: area.w, h: headerH,
    fill: { color: headerColor }, line: { type: 'none' },
  });
  if (opts.role) {
    slide.addText(opts.role, {
      x: area.x, y: area.y, w: area.w, h: headerH,
      fontSize: 9, color: _resolveColor(C, 'white'), fontFace: F.jp,
      bold: true, charSpacing: 1, align: 'center', valign: 'middle', margin: 0,
    });
  }
  // 本体ラベル
  if (opts.label) {
    slide.addText(opts.label, {
      x: area.x + 0.10, y: area.y + headerH, w: area.w - 0.20, h: area.h - headerH - (opts.sub ? 0.26 : 0),
      fontSize: opts.labelSize || 12, color: labelColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
  if (opts.sub) {
    slide.addText(opts.sub, {
      x: area.x + 0.10, y: area.y + area.h - 0.26, w: area.w - 0.20, h: 0.24,
      fontSize: 9, color: _resolveColor(C, 'gray500'), fontFace: F.jp,
      align: 'center', valign: 'middle', margin: 0,
    });
  }
  return {
    x: area.x, y: area.y, w: area.w, h: area.h,
    cx: area.x + area.w/2, cy: area.y + area.h/2,
    // 接続点 (上下左右)
    top: { cx: area.x + area.w/2, cy: area.y },
    bottom: { cx: area.x + area.w/2, cy: area.y + area.h },
    left: { cx: area.x, cy: area.y + area.h/2 },
    right: { cx: area.x + area.w, cy: area.y + area.h/2 },
  };
}

/** drawMoneyFlow — ¥ ラベル付き矢印 (お金の流れ)
 *  太めの実線矢印 + ¥ アイコンバッジ + 金額/補足テキスト
 *  opts: {amount?:'月額¥980', note?, color?:'accent'}
 */
function drawMoneyFlow(slide, from, to, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const color = _resolveColor(C, opts.color || 'accent');
  const width = opts.width != null ? opts.width : 2.5;
  const x1 = from.cx != null ? from.cx : from.x;
  const y1 = from.cy != null ? from.cy : from.y;
  const x2 = to.cx   != null ? to.cx   : to.x;
  const y2 = to.cy   != null ? to.cy   : to.y;

  // 太い矢印
  slide.addShape(pres.shapes.LINE, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width, endArrowType: 'triangle' },
  });
  // ¥ バッジ + ラベル (中点)
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const label = opts.amount || '¥';
  const labelW = Math.max(0.70, label.length * 0.13 + 0.30);
  // 背景白カード (width 1→0.5 lineWidthStrong 相当 / 装飾枠なので控えめに)
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: mx - labelW/2, y: my - 0.16, w: labelW, h: 0.32, rectRadius: 0.16,
    fill: { color: _resolveColor(C, 'canvas') },
    line: { color, width: 0.5 },
  });
  slide.addText(label, {
    x: mx - labelW/2, y: my - 0.16, w: labelW, h: 0.32,
    fontSize: 10, color, fontFace: F.jp,
    bold: true, align: 'center', valign: 'middle', margin: 0,
  });
  if (opts.note) {
    slide.addText(opts.note, {
      x: mx - 1.00, y: my + 0.18, w: 2.00, h: 0.20,
      fontSize: 8, color: _resolveColor(C, 'gray500'), fontFace: F.jp,
      align: 'center', valign: 'middle', margin: 0,
    });
  }
}

/** drawServiceFlow — サービス/モノの流れ (実線矢印 + ラベル)
 *  opts: {label?:'商品配送', color?:'brand'}
 */
function drawServiceFlow(slide, from, to, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const color = _resolveColor(C, opts.color || 'brand');
  const width = opts.width != null ? opts.width : 1.5;
  const x1 = from.cx != null ? from.cx : from.x;
  const y1 = from.cy != null ? from.cy : from.y;
  const x2 = to.cx   != null ? to.cx   : to.x;
  const y2 = to.cy   != null ? to.cy   : to.y;
  slide.addShape(pres.shapes.LINE, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width, endArrowType: 'triangle' },
  });
  if (opts.label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const labelW = Math.max(0.80, opts.label.length * 0.13 + 0.30);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: mx - labelW/2, y: my - 0.13, w: labelW, h: 0.26, rectRadius: 0.13,
      fill: { color: _resolveColor(C, 'canvas') },
      line: { color, width: 0.75 },
    });
    slide.addText(opts.label, {
      x: mx - labelW/2, y: my - 0.13, w: labelW, h: 0.26,
      fontSize: 9, color, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
}

/** drawDataFlow — データ/情報の流れ (点線矢印 + ラベル)
 *  opts: {label?:'利用ログ', color?:'gray500'}
 */
function drawDataFlow(slide, from, to, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const color = _resolveColor(C, opts.color || 'gray500');
  const width = opts.width != null ? opts.width : 1;
  const x1 = from.cx != null ? from.cx : from.x;
  const y1 = from.cy != null ? from.cy : from.y;
  const x2 = to.cx   != null ? to.cx   : to.x;
  const y2 = to.cy   != null ? to.cy   : to.y;
  slide.addShape(pres.shapes.LINE, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width, dashType: 'dash', endArrowType: 'triangle' },
  });
  if (opts.label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    slide.addText(opts.label, {
      x: mx - 0.80, y: my - 0.13, w: 1.60, h: 0.26,
      fontSize: 9, color, fontFace: F.jp,
      italic: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
}

/** drawBoundary — 境界フレーム (点線の囲い)
 *  システム範囲・地域範囲・業界などをグルーピング表示する
 *  opts: {label?:'プラットフォーム範囲', labelPos?:'top'|'bottom'}
 */
function drawBoundary(slide, area, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const color = _resolveColor(C, opts.color || 'gray400');
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: area.x, y: area.y, w: area.w, h: area.h, rectRadius: 0.12,
    fill: { type: 'none' },
    line: { color, width: 1, dashType: 'dash' },
  });
  if (opts.label) {
    const isTop = (opts.labelPos || 'top') === 'top';
    // ラベル背景 (canvas)
    const labelW = Math.max(1.20, opts.label.length * 0.14 + 0.40);
    const labelX = area.x + 0.20;
    const labelY = isTop ? area.y - 0.13 : area.y + area.h - 0.13;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: labelX, y: labelY, w: labelW, h: 0.26,
      fill: { color: _resolveColor(C, 'canvas') }, line: { type: 'none' },
    });
    slide.addText(opts.label, {
      x: labelX, y: labelY, w: labelW, h: 0.26,
      fontSize: 9, color, fontFace: F.jp,
      bold: true, charSpacing: 1, align: 'center', valign: 'middle', margin: 0,
    });
  }
}

/** drawValueTag — 値タグ (「無料」「月額¥980」「30日間トライアル」等)
 *  Pill 形より目を引く長方形 + 強調色
 *  opts: {fill?:'accent', textColor?:'white'}
 */
function drawValueTag(slide, x, y, label, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const fill = _resolveColor(C, opts.fill || 'accent');
  const textColor = _resolveColor(C, opts.textColor || 'white');
  const w = opts.w || Math.max(0.80, label.length * 0.16 + 0.30);
  const h = opts.h || 0.30;
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: fill }, line: { type: 'none' },
  });
  slide.addText(label, {
    x, y, w, h,
    fontSize: opts.fontSize || 10, color: textColor, fontFace: F.jp,
    bold: true, align: 'center', valign: 'middle', margin: 0,
  });
  return { x, y, w, h, cx: x + w/2, cy: y + h/2 };
}

/** drawIconLabel — アイコン文字 + 横にラベル (家・店舗・倉庫 等を 1 文字 + テキスト)
 *  opts: {icon, label, sub?, iconColor?:'brand'}
 */
function drawIconLabel(slide, x, y, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const iconColor = _resolveColor(C, opts.iconColor || 'brand');
  const iconR = 0.22;
  // アイコンバッジ (円)
  slide.addShape(pres.shapes.OVAL, {
    x, y, w: iconR * 2, h: iconR * 2,
    fill: { color: iconColor }, line: { type: 'none' },
  });
  if (opts.icon) {
    slide.addText(opts.icon, {
      x, y, w: iconR * 2, h: iconR * 2,
      fontSize: 12, color: _resolveColor(C, 'white'), fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
  // ラベル (右側)
  if (opts.label) {
    slide.addText(opts.label, {
      x: x + iconR * 2 + 0.10, y, w: 2.00, h: opts.sub ? 0.24 : iconR * 2,
      fontSize: 10, color: _resolveColor(C, 'ink'), fontFace: F.jp,
      bold: true, valign: opts.sub ? 'top' : 'middle', margin: 0,
    });
  }
  if (opts.sub) {
    slide.addText(opts.sub, {
      x: x + iconR * 2 + 0.10, y: y + 0.22, w: 2.00, h: 0.20,
      fontSize: 8, color: _resolveColor(C, 'gray500'), fontFace: F.jp,
      valign: 'top', margin: 0,
    });
  }
  return { x, y, w: iconR * 2 + 2.10, h: iconR * 2 };
}


// ───────────────────────────────────────────────────────
// システム構成図 専用 atom
// ───────────────────────────────────────────────────────
// サーバー・DB・クラウド・PC・ブラウザ・スマホ・ネットワーク・API 等の
// システム要素を「角丸矩形 + アイコン記号 + ラベル」の最小単位で描く。
// 原則: アイコンは Unicode 記号で表現 (絵文字や複雑な path は使わない)。
// 記号で十分にシステム種別が伝わるよう、各 atom はラベルとセットで使う。

function _drawSystemBox(slide, area, opts, ctx, defaultIcon, defaultRole) {
  const { C, F, pres } = ctx;
  const fill = _resolveColor(C, opts.fill || 'canvas');
  const stroke = _resolveColor(C, opts.stroke || 'gray400');
  const accentColor = _resolveColor(C, opts.accentColor || 'brand');
  const labelColor = _resolveColor(C, opts.labelColor || 'ink');

  // 本体 (角丸矩形)
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: area.x, y: area.y, w: area.w, h: area.h, rectRadius: 0.08,
    fill: { color: fill }, line: { color: stroke, width: 1 },
  });
  // 上部にアクセント帯
  slide.addShape(pres.shapes.RECTANGLE, {
    x: area.x, y: area.y, w: area.w, h: 0.06,
    fill: { color: accentColor }, line: { type: 'none' },
  });
  // アイコン (Unicode 記号、左上)
  const icon = opts.icon || defaultIcon;
  if (icon) {
    slide.addText(icon, {
      x: area.x + 0.06, y: area.y + 0.10,
      w: 0.50, h: 0.40,
      fontSize: 18, color: accentColor, fontFace: F.jp,
      bold: true, align: 'left', valign: 'middle', margin: 0,
    });
  }
  // 種別ラベル (右上、小)
  const role = opts.role || defaultRole;
  if (role) {
    slide.addText(role, {
      x: area.x + area.w - 1.20, y: area.y + 0.10,
      w: 1.10, h: 0.22,
      fontSize: 7, color: _resolveColor(C, 'gray500'), fontFace: F.jp,
      charSpacing: 1, align: 'right', valign: 'middle', margin: 0,
    });
  }
  // メインラベル (中央/下)
  if (opts.label) {
    slide.addText(opts.label, {
      x: area.x + 0.10, y: area.y + 0.50,
      w: area.w - 0.20, h: opts.sub ? area.h * 0.30 : area.h - 0.55,
      fontSize: opts.labelSize || 11, color: labelColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
  if (opts.sub) {
    slide.addText(opts.sub, {
      x: area.x + 0.10, y: area.y + area.h - 0.34,
      w: area.w - 0.20, h: 0.26,
      fontSize: 8, color: _resolveColor(C, 'gray500'), fontFace: F.jp,
      align: 'center', valign: 'middle', margin: 0,
    });
  }
  return {
    x: area.x, y: area.y, w: area.w, h: area.h,
    cx: area.x + area.w/2, cy: area.y + area.h/2,
    top: { cx: area.x + area.w/2, cy: area.y },
    bottom: { cx: area.x + area.w/2, cy: area.y + area.h },
    left: { cx: area.x, cy: area.y + area.h/2 },
    right: { cx: area.x + area.w, cy: area.y + area.h/2 },
  };
}

/** drawServer — サーバー (オンプレ・物理) */
function drawServer(slide, area, opts = {}, ctx) {
  return _drawSystemBox(slide, area, opts, ctx, '▤', 'SERVER');
}

/** drawDatabase — データベース (RDB / ストレージ) */
function drawDatabase(slide, area, opts = {}, ctx) {
  // DB は専用形 (円筒風) で他と差別化したいので shape を変える
  const { C, F, pres } = ctx;
  const fill = _resolveColor(C, opts.fill || 'canvas');
  const stroke = _resolveColor(C, opts.stroke || 'gray400');
  const accentColor = _resolveColor(C, opts.accentColor || 'brand');
  const labelColor = _resolveColor(C, opts.labelColor || 'ink');

  // 上部楕円 (口)
  const lipH = 0.20;
  slide.addShape(pres.shapes.OVAL, {
    x: area.x, y: area.y, w: area.w, h: lipH,
    fill: { color: accentColor }, line: { type: 'none' },
  });
  // 本体 (矩形)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: area.x, y: area.y + lipH/2, w: area.w, h: area.h - lipH,
    fill: { color: fill }, line: { color: stroke, width: 1 },
  });
  // (本体の枠は width:1 のまま残す。底部はシリンダー形状の装飾要素のため控えめに)
  slide.addShape(pres.shapes.OVAL, {
    x: area.x, y: area.y + area.h - lipH, w: area.w, h: lipH,
    fill: { color: fill }, line: { color: stroke, width: 0.5 },
  });
  // 種別タグ
  slide.addText('DATABASE', {
    x: area.x + area.w - 1.20, y: area.y + 0.30,
    w: 1.10, h: 0.20,
    fontSize: 7, color: _resolveColor(C, 'gray500'), fontFace: F.jp,
    charSpacing: 1, align: 'right', valign: 'middle', margin: 0,
  });
  // メインラベル
  if (opts.label) {
    slide.addText(opts.label, {
      x: area.x + 0.10, y: area.y + 0.55,
      w: area.w - 0.20, h: opts.sub ? area.h * 0.30 : area.h - 0.80,
      fontSize: opts.labelSize || 11, color: labelColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
  if (opts.sub) {
    slide.addText(opts.sub, {
      x: area.x + 0.10, y: area.y + area.h - 0.40,
      w: area.w - 0.20, h: 0.22,
      fontSize: 8, color: _resolveColor(C, 'gray500'), fontFace: F.jp,
      align: 'center', valign: 'middle', margin: 0,
    });
  }
  return {
    x: area.x, y: area.y, w: area.w, h: area.h,
    cx: area.x + area.w/2, cy: area.y + area.h/2,
    top: { cx: area.x + area.w/2, cy: area.y },
    bottom: { cx: area.x + area.w/2, cy: area.y + area.h },
    left: { cx: area.x, cy: area.y + area.h/2 },
    right: { cx: area.x + area.w, cy: area.y + area.h/2 },
  };
}

/** drawCloud — クラウド (AWS / GCP / Azure / 抽象クラウド) */
function drawCloud(slide, area, opts = {}, ctx) {
  // クラウドはモコモコの形を Cloud 図形がない代わりに 3 つの楕円 + 矩形で擬似表現
  // しかし読みやすさを優先して、角丸矩形 + 雲アイコン (☁) で実装
  return _drawSystemBox(slide, area, opts, ctx, '☁', 'CLOUD');
}

/** drawPC — デスクトップ PC (社員・利用者の端末) */
function drawPC(slide, area, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const fill = _resolveColor(C, opts.fill || 'canvas');
  const stroke = _resolveColor(C, opts.stroke || 'gray400');
  const accentColor = _resolveColor(C, opts.accentColor || 'gray700');
  const labelColor = _resolveColor(C, opts.labelColor || 'ink');

  // モニター部分 (角丸矩形、上 70%)
  const monitorH = area.h * 0.72;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: area.x, y: area.y, w: area.w, h: monitorH, rectRadius: 0.06,
    fill: { color: fill }, line: { color: accentColor, width: 1.5 },
  });
  // スタンド (台形/三角) — 矩形で擬似
  const standW = area.w * 0.30;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: area.x + (area.w - standW) / 2, y: area.y + monitorH,
    w: standW, h: 0.10,
    fill: { color: accentColor }, line: { type: 'none' },
  });
  // ベース
  const baseW = area.w * 0.55;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: area.x + (area.w - baseW) / 2, y: area.y + monitorH + 0.10,
    w: baseW, h: 0.06, rectRadius: 0.03,
    fill: { color: accentColor }, line: { type: 'none' },
  });
  // ラベル (モニター内)
  if (opts.label) {
    slide.addText(opts.label, {
      x: area.x + 0.08, y: area.y + 0.10,
      w: area.w - 0.16, h: monitorH - 0.20,
      fontSize: opts.labelSize || 10, color: labelColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
  return {
    x: area.x, y: area.y, w: area.w, h: area.h,
    cx: area.x + area.w/2, cy: area.y + area.h/2,
    top: { cx: area.x + area.w/2, cy: area.y },
    bottom: { cx: area.x + area.w/2, cy: area.y + area.h },
    left: { cx: area.x, cy: area.y + monitorH/2 },
    right: { cx: area.x + area.w, cy: area.y + monitorH/2 },
  };
}

/** drawBrowser — ブラウザウィンドウ (URL バー風) */
function drawBrowser(slide, area, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const fill = _resolveColor(C, opts.fill || 'canvas');
  const stroke = _resolveColor(C, opts.stroke || 'gray400');
  const barColor = _resolveColor(C, opts.barColor || 'gray100');
  const labelColor = _resolveColor(C, opts.labelColor || 'ink');

  // 全体枠
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: area.x, y: area.y, w: area.w, h: area.h, rectRadius: 0.08,
    fill: { color: fill }, line: { color: stroke, width: 1 },
  });
  // 上部 URL バー
  const barH = 0.30;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: area.x, y: area.y, w: area.w, h: barH,
    fill: { color: barColor }, line: { type: 'none' },
  });
  // 信号機ドット (3 つ)
  const dotR = 0.04;
  ['#FF5F56', '#FFBD2E', '#27C93F'].forEach((dotColor, i) => {
    slide.addShape(pres.shapes.OVAL, {
      x: area.x + 0.08 + i * 0.16, y: area.y + barH/2 - dotR,
      w: dotR * 2, h: dotR * 2,
      fill: { color: dotColor }, line: { type: 'none' },
    });
  });
  // URL テキスト
  if (opts.url) {
    slide.addText(opts.url, {
      x: area.x + 0.65, y: area.y, w: area.w - 0.75, h: barH,
      fontSize: 8, color: _resolveColor(C, 'gray500'), fontFace: F.jp,
      align: 'left', valign: 'middle', margin: 0,
    });
  }
  // 本体ラベル
  if (opts.label) {
    slide.addText(opts.label, {
      x: area.x + 0.10, y: area.y + barH + 0.05,
      w: area.w - 0.20, h: area.h - barH - 0.10,
      fontSize: opts.labelSize || 11, color: labelColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
  return {
    x: area.x, y: area.y, w: area.w, h: area.h,
    cx: area.x + area.w/2, cy: area.y + area.h/2,
    top: { cx: area.x + area.w/2, cy: area.y },
    bottom: { cx: area.x + area.w/2, cy: area.y + area.h },
    left: { cx: area.x, cy: area.y + area.h/2 },
    right: { cx: area.x + area.w, cy: area.y + area.h/2 },
  };
}

/** drawMobile — スマートフォン (縦長端末) */
function drawMobile(slide, area, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const fill = _resolveColor(C, opts.fill || 'canvas');
  const stroke = _resolveColor(C, opts.stroke || 'gray500');
  const labelColor = _resolveColor(C, opts.labelColor || 'ink');

  // 端末本体 (角丸矩形、縦長)
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: area.x, y: area.y, w: area.w, h: area.h, rectRadius: 0.12,
    fill: { color: fill }, line: { color: stroke, width: 1.5 },
  });
  // 上部スピーカー (横線)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: area.x + area.w * 0.30, y: area.y + 0.08,
    w: area.w * 0.40, h: 0.04,
    fill: { color: stroke }, line: { type: 'none' },
  });
  const homeR = 0.08;
  slide.addShape(pres.shapes.OVAL, {
    x: area.x + area.w/2 - homeR, y: area.y + area.h - homeR * 2 - 0.05,
    w: homeR * 2, h: homeR * 2,
    fill: { type: 'none' }, line: { color: stroke, width: 0.5 },
  });
  // ラベル (スクリーン内)
  if (opts.label) {
    slide.addText(opts.label, {
      x: area.x + 0.08, y: area.y + 0.20,
      w: area.w - 0.16, h: area.h - 0.50,
      fontSize: opts.labelSize || 10, color: labelColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
  return {
    x: area.x, y: area.y, w: area.w, h: area.h,
    cx: area.x + area.w/2, cy: area.y + area.h/2,
    top: { cx: area.x + area.w/2, cy: area.y },
    bottom: { cx: area.x + area.w/2, cy: area.y + area.h },
    left: { cx: area.x, cy: area.y + area.h/2 },
    right: { cx: area.x + area.w, cy: area.y + area.h/2 },
  };
}

/** drawNetwork — ネットワーク (LAN/WAN/インターネット) */
function drawNetwork(slide, area, opts = {}, ctx) {
  // 雲ぽい記号 + NETWORK ラベル
  return _drawSystemBox(slide, area, opts, ctx, '⌬', 'NETWORK');
}

/** drawAPI — API エンドポイント (REST/GraphQL) */
function drawAPI(slide, area, opts = {}, ctx) {
  return _drawSystemBox(slide, area, opts, ctx, '⟿', 'API');
}

/** drawUserSystem — システム図上のユーザー (drawActor との違いはラベル位置と種別) */
function drawUserSystem(slide, area, opts = {}, ctx) {
  return _drawSystemBox(slide, area, opts, ctx, '◉', 'USER');
}

/** drawFolder — フォルダ・ファイルストレージ */
function drawFolder(slide, area, opts = {}, ctx) {
  return _drawSystemBox(slide, area, opts, ctx, '▣', 'STORAGE');
}

/** drawContainer — コンテナ (Docker/Pod) */
function drawContainer(slide, area, opts = {}, ctx) {
  return _drawSystemBox(slide, area, opts, ctx, '◫', 'CONTAINER');
}

/** drawSwitch — ネットワークスイッチ・ロードバランサー */
function drawSwitch(slide, area, opts = {}, ctx) {
  return _drawSystemBox(slide, area, opts, ctx, '⇋', 'SWITCH');
}


// ───────────────────────────────────────────────────────
// FlowChart 向け Atom
// ───────────────────────────────────────────────────────

/**
 * drawTerminator — 開始/終了ノード (Pill 型)
 * フローチャートの「Start / End」に相当する角丸の強い長方形 (Pill)。
 *
 * area: { x, y, w, h }
 * opts:
 *   - label: 中央テキスト (例: "事業者が対価得て行った取引" / "課税取引")
 *   - kind:  'start' | 'end' (default 'start')。end は highlight 系で塗る
 *   - fill / stroke / textColor: 上書きしたい時だけ指定
 *   - labelSize: フォントサイズ (default 12)
 * 戻り値: { x, y, w, h, cx, cy, top, bottom, left, right }
 */
function drawTerminator(slide, area, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const kind = opts.kind || 'start';
  //   旧: start=brand (amber)、end=highlight (ink)。両方とも色付き終端で派手だった
  //   新: start=ink (黒)、end=brand (amber) — 始点はクールに、終点が唯一の amber 強調
  //       これでフロー全体が neutral 主体になり、目線がゴール (amber) に自然に向かう
  const fill = _resolveColor(C, opts.fill || (kind === 'end' ? 'brand' : 'ink'));
  const stroke = _resolveColor(C, opts.stroke || (kind === 'end' ? 'brandDeep' : 'ink'));
  const textColor = _resolveColor(C, opts.textColor ||
    (kind === 'end' ? 'brandContrast' : 'white'));
  const strokeWidth = opts.strokeWidth != null ? opts.strokeWidth : 0;

  // Pill 型: 角丸を最大化 (高さの半分相当)
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: area.x, y: area.y, w: area.w, h: area.h,
    rectRadius: 0.5,  // pptxgenjs は 0..0.5 の比率値。0.5 で Pill 形に最大化
    fill: { color: fill },
    line: strokeWidth > 0 ? { color: stroke, width: strokeWidth } : { type: 'none' },
  });
  if (opts.label) {
    slide.addText(opts.label, {
      x: area.x + 0.10, y: area.y, w: area.w - 0.20, h: area.h,
      fontSize: opts.labelSize || 12, color: textColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
      shrinkText: true,
    });
  }
  return {
    x: area.x, y: area.y, w: area.w, h: area.h,
    cx: area.x + area.w / 2, cy: area.y + area.h / 2,
    top:    { cx: area.x + area.w / 2, cy: area.y },
    bottom: { cx: area.x + area.w / 2, cy: area.y + area.h },
    left:   { cx: area.x, cy: area.y + area.h / 2 },
    right:  { cx: area.x + area.w, cy: area.y + area.h / 2 },
  };
}

/**
 * drawDecision — 判断ノード (菱形)
 * フローチャートの YES/NO 分岐ポイント。短いキーワードを中央に配置する。
 *
 * area: { x, y, w, h }
 * opts:
 *   - label: 中央テキスト (短い方が映える、目安: 〜10 文字)
 *   - fill / stroke / textColor: 任意上書き
 *   - labelSize: フォントサイズ (default 11、bold)
 * 戻り値: { x, y, w, h, cx, cy, top, bottom, left, right }  ※ 菱形の頂点 4 点
 */
function drawDecision(slide, area, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  //   旧: brandDeep 塗り (deep amber) で重く色が乗っていた
  //   新: canvas (白) + ink stroke 1.5pt + ink text。形だけで「判断ノード」と分かる
  const fill = _resolveColor(C, opts.fill || 'canvas');
  const stroke = _resolveColor(C, opts.stroke || 'ink');
  const textColor = _resolveColor(C, opts.textColor || 'ink');
  const strokeWidth = opts.strokeWidth != null ? opts.strokeWidth : 1.5;

  slide.addShape(pres.shapes.DIAMOND, {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fill: { color: fill },
    line: { color: stroke, width: strokeWidth },
  });
  if (opts.label) {
    // 菱形は中央しか文字が乗らないので、内側に少し余白を取る
    const padX = area.w * 0.18;
    const padY = area.h * 0.30;
    slide.addText(opts.label, {
      x: area.x + padX, y: area.y + padY,
      w: area.w - padX * 2, h: area.h - padY * 2,
      fontSize: opts.labelSize || 11, color: textColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
      shrinkText: true,
    });
  }
  return {
    x: area.x, y: area.y, w: area.w, h: area.h,
    cx: area.x + area.w / 2, cy: area.y + area.h / 2,
    // 菱形の頂点 (上下左右)
    top:    { cx: area.x + area.w / 2, cy: area.y },
    bottom: { cx: area.x + area.w / 2, cy: area.y + area.h },
    left:   { cx: area.x, cy: area.y + area.h / 2 },
    right:  { cx: area.x + area.w, cy: area.y + area.h / 2 },
  };
}

/**
 * drawProcess — プロセスノード (角丸長方形)
 * フローチャートの「処理 / 結果」を表す枠。drawNode の 'round' 形状の wrapper。
 *
 * 戻り値: { x, y, w, h, cx, cy, top, bottom, left, right }
 */
function drawProcess(slide, area, opts = {}, ctx) {
  //   旧: 通常 result は brand stroke、warn は highlight stroke
  //   新: 通常 result は ink stroke (canvas + gray)、warn は brand stroke (= 警告)
  //       警告系のみ brand を使う = 5% 強調の正しい使い方
  const node = drawNode(slide, area, Object.assign({
    shape: 'round',
    fill: opts.fill || 'canvas',
    stroke: opts.stroke || (opts.kind === 'result-warn' ? 'brand' : 'ink'),
    strokeWidth: opts.strokeWidth != null ? opts.strokeWidth : 1.2,
    textColor: opts.textColor || (opts.kind === 'result-warn' ? 'brandDeep' : 'ink'),
    radius: opts.radius != null ? opts.radius : 0.06,
    bold: true,
    labelSize: opts.labelSize || 11,
  }, opts), ctx);
  return Object.assign(node, {
    top:    { cx: node.cx, cy: node.y },
    bottom: { cx: node.cx, cy: node.y + node.h },
    left:   { cx: node.x, cy: node.cy },
    right:  { cx: node.x + node.w, cy: node.cy },
  });
}

/**
 * drawDecisionFlow — 矢印 + YES/NO ラベル
 * 判断ノードから出る分岐線 (矢印) と、その分岐ラベル (YES / NO) を 1 関数で描く。
 * ラベルは矢印の根元側 (from から labelPos % 進んだあたり) にピル型で乗せる。
 *
 * from, to: { cx, cy } の 2 点 (anchor の top/bottom/left/right を渡す想定)
 * opts:
 *   - label:    'YES' | 'NO' | 任意文字列
 *   - kind:     'yes' | 'no' (default 'yes')。色を切替: yes=brand, no=highlight
 *   - elbow:    true で L 字 (まず縦/横に出てから折れる)。default false で直線
 *   - labelPos: 0..1 (default 0.22)。矢印起点からの位置比
 *   - color, width: 矢印色・太さの上書き
 */
function drawDecisionFlow(slide, from, to, opts = {}, ctx) {
  const { C, F, pres } = ctx;
  const kind = opts.kind || 'yes';
  //   旧: yes=brand, no=highlight で派手な色分かれ
  //   新: yes/no どちらも gray700 (ink 寄り) で minimal。形と文字 (YES/NO) で識別
  const arrowColor = _resolveColor(C, opts.color || 'gray700');
  const labelText = opts.label || (kind === 'yes' ? 'YES' : 'NO');
  const labelPos = opts.labelPos != null ? opts.labelPos : 0.22;
  const width = opts.width != null ? opts.width : 1.5;

  // 矢印 (直線 or L 字)
  if (opts.elbow) {
    // L 字: from → 中継点 → to
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    const horizontalFirst = Math.abs(dx) > Math.abs(dy);
    const mid = horizontalFirst
      ? { cx: to.cx, cy: from.cy }
      : { cx: from.cx, cy: to.cy };
    // 第 1 セグメント (矢印なしの線)
    slide.addShape(pres.shapes.LINE, {
      x: from.cx, y: from.cy, w: mid.cx - from.cx, h: mid.cy - from.cy,
      line: { color: arrowColor, width },
    });
    // 第 2 セグメント (矢印あり)
    slide.addShape(pres.shapes.LINE, {
      x: mid.cx, y: mid.cy, w: to.cx - mid.cx, h: to.cy - mid.cy,
      line: { color: arrowColor, width, endArrowType: 'triangle' },
    });
  } else {
    drawArrow(slide, from, to, { color: arrowColor, width }, ctx);
  }

  // YES/NO ピルラベル (矢印の根元側 labelPos % のところ)
  if (labelText) {
    const lx = from.cx + (to.cx - from.cx) * labelPos;
    const ly = from.cy + (to.cy - from.cy) * labelPos;
    const pillW = 0.50;
    const pillH = 0.26;
    //   旧: yes=brandSoft (黄)、no=highlightSoft (灰) で 2 色塗り
    //   新: 両方 white 塗り + ink 罫線 + ink 文字。最小限の minimal pill に
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: lx - pillW / 2, y: ly - pillH / 2, w: pillW, h: pillH,
      rectRadius: pillH / 2,
      fill: { color: _resolveColor(C, 'canvas') },
      line: { color: arrowColor, width: 0.5 },
    });
    slide.addText(labelText, {
      x: lx - pillW / 2, y: ly - pillH / 2, w: pillW, h: pillH,
      fontSize: 9, color: arrowColor, fontFace: F.jp,
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });
  }
}

module.exports = {
  drawNode,
  drawLink,
  drawArrow,
  drawCallout,
  drawTagPill,
  drawIconBadge,
  // ビジネスモデル図向け
  drawActor,
  drawOrgBlock,
  drawMoneyFlow,
  drawServiceFlow,
  drawDataFlow,
  drawBoundary,
  drawValueTag,
  drawIconLabel,
  // システム構成図向け
  drawServer,
  drawDatabase,
  drawCloud,
  drawPC,
  drawBrowser,
  drawMobile,
  drawNetwork,
  drawAPI,
  drawUserSystem,
  drawFolder,
  drawContainer,
  drawSwitch,
  // FlowChart 向け
  drawTerminator,
  drawDecision,
  drawProcess,
  drawDecisionFlow,
  // helpers
  _resolveColor,
  _centerOf,
};
