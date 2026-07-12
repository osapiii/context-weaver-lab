'use strict';

// =============================================================
// templates/code.js
// -------------------------------------------------------------
// Consolidated from templates/code/*.js.
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

// ─── _code-block-atom.js ─────────────────────────────────────────
const { drawCodeBlock, MONO_FONT } = (function () {
  /**
   * _code-block-atom.js — CODE-1〜6 共通のコードブロック描画
   * ========================================================
   * Navy Dark 背景 + 白文字。ヘッダーはミニマム (左上にファイル名/拡張子のみ)。
   *
   *   - 背景: ink (#1F2937)
   *   - 文字: 主に F3F4F6 (gray100) / 緑のプロンプト 10B981 / コメント 9CA3AF
   *   - ヘッダー: 高さ 0.26"、左上にファイル名タグだけ (背景なし、灰色文字)
   *   - 行番号: 4B5563 (薄い gray)、フォントは本文より 1pt 小さい
   *   - フォント: JetBrains Mono、本文 10-11px (面積を取りすぎないため小さめ)
   */

  const MONO_FONT = 'JetBrains Mono';

  /**
   * コードブロックを 1 つ描画する。
   * @param {Slide} slide
   * @param {object} opts
   *   - x, y, w, h: 描画領域 (inch)
   *   - code: { lang, body, file? }
   *   - ctx: render コンテキスト (pres / C / F)
   *   - fontSize: 本文フォントサイズ (default 11)
   *   - showLineNumbers: 行番号を出すか (default true)
   *   - terminalMode: ターミナル風 ($ プロンプトつき)。default false
   */
  function drawCodeBlock(slide, opts) {
    const { x, y, w, h, code, ctx, fontSize = 11, showLineNumbers = true, terminalMode = false } = opts;
    const { pres } = ctx;
    const lang = (code && code.lang) || 'text';
    const body = (code && code.body) || '';
    const fileName = (code && code.file) || lang;
    const lines = body.split('\n');

    // 背景 (Navy Dark = ink)
    slide.addShape(pres.shapes.RECTANGLE, {
      x: x, y: y, w: w, h: h,
      fill: { color: ctx.C.code.bg }, line: { type: 'none' },
    });

    // ヘッダー: タイトルバーに微差の暗色 tint を入れて識別性を上げる
    const headH = 0.24;
    // タイトルバー背景 (1A2233: 本文 1F2937 より僅かに暗い tint)
    slide.addShape(pres.shapes.RECTANGLE, {
      x: x, y: y, w: w, h: headH,
      fill: { color: ctx.C.code.headerBg }, line: { type: 'none' },
    });
    // 上部のごく薄いセパレータライン (374151 細線)
    slide.addShape(pres.shapes.LINE, {
      x: x + 0.10, y: y + headH, w: w - 0.20, h: 0,
      line: { color: ctx.C.code.headerLine, width: 0.25 },
    });
    // ファイル名 (灰色 / charSpacing 0.5 で字間を整える)
    slide.addText(fileName, {
      x: x + 0.12, y: y + 0.02, w: w - 0.24, h: headH - 0.02,
      fontSize: 9, color: ctx.C.code.fileLabel, fontFace: MONO_FONT,
      charSpacing: 0.5, align: 'left', valign: 'middle', margin: 0,
    });

    // コード本体
    const bodyY = y + headH + 0.06;
    const bodyH = h - headH - 0.06;
    const fs = fontSize;
    const lh = fs * 0.020 + 0.03; // 行高 (inch) v9.29: +0.02→+0.03
    const padX = 0.12;
    const lineNoW = showLineNumbers ? 0.32 : 0;

    lines.forEach((line, i) => {
      const ly = bodyY + i * lh;
      if (ly + lh > bodyY + bodyH - 0.04) return; // 入りきらない行は無視
      if (showLineNumbers) {
        slide.addText(String(i + 1), {
          x: x + padX, y: ly, w: lineNoW, h: lh,
          fontSize: fs - 1, color: ctx.C.code.lineNumber, fontFace: MONO_FONT,
          align: 'right', valign: 'top', margin: 0,
        });
      }
      if (terminalMode) {
        // ターミナル風: プロンプトと出力を区別
        const trimmed = line.replace(/^\s+/, '');
        if (trimmed.startsWith('# ')) {
          // コメント
          slide.addText(line, {
            x: x + padX + lineNoW + 0.08, y: ly, w: w - padX * 2 - lineNoW - 0.08, h: lh,
            fontSize: fs, color: ctx.C.code.comment, fontFace: MONO_FONT, italic: true,
            align: 'left', valign: 'top', margin: 0,
          });
        } else if (trimmed.startsWith('$ ')) {
          // プロンプト + コマンド
          const cmd = trimmed.slice(2);
          slide.addText('$', {
            x: x + padX + lineNoW + 0.08, y: ly, w: 0.16, h: lh,
            fontSize: fs, color: ctx.C.code.prompt, fontFace: MONO_FONT, bold: true,
            align: 'left', valign: 'top', margin: 0,
          });
          slide.addText(cmd, {
            x: x + padX + lineNoW + 0.26, y: ly, w: w - padX * 2 - lineNoW - 0.26, h: lh,
            fontSize: fs, color: ctx.C.code.text, fontFace: MONO_FONT,
            align: 'left', valign: 'top', margin: 0,
          });
        } else {
          // 出力 (薄白)
          slide.addText(line || ' ', {
            x: x + padX + lineNoW + 0.08, y: ly, w: w - padX * 2 - lineNoW - 0.08, h: lh,
            fontSize: fs, color: ctx.C.code.output, fontFace: MONO_FONT,
            align: 'left', valign: 'top', margin: 0,
          });
        }
      } else {
        // 通常モード: 全行を白文字 (簡易シンタックスハイライトなし)
        slide.addText(line || ' ', {
          x: x + padX + lineNoW + 0.08, y: ly, w: w - padX * 2 - lineNoW - 0.08, h: lh,
          fontSize: fs, color: ctx.C.code.text, fontFace: MONO_FONT,
          align: 'left', valign: 'top', margin: 0,
        });
      }
    });
  }
  return { drawCodeBlock, MONO_FONT };
})();

// ─── code-1-single.js ────────────────────────────────────────────
const { renderCODE1Single } = (function () {
  /**
   * CODE-1 単一スニペット主役
   * Navy Dark コードブロック + 上下にテキスト説明。コードは画面の 60% 程度に抑える。
   */

  const atoms = require('../atoms');

  function renderCODE1Single(slide, slideJson, ctx) {
    const { L, C, F } = ctx;
    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');

    const startY = titleBottomY + 0.10;
    const endY = L.contentBot;
    const totalH = endY - startY;
    const captionH = slideJson.code_caption ? 0.40 : 0;
    const codeH = totalH - captionH;
    const codeX = L.marginX;
    const codeW = 10 - L.marginX * 2;

    drawCodeBlock(slide, {
      x: codeX, y: startY, w: codeW, h: codeH,
      code: slideJson.code || {}, ctx, fontSize: 11,
    });
    if (slideJson.code_caption) {
      slide.addText(slideJson.code_caption, {
        x: codeX, y: endY - captionH + 0.08, w: codeW, h: captionH - 0.08,
        fontSize: 12, color: C.gray700, fontFace: F.jp, italic: true,
        align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 1.40,
      });
    }

    const pageNum = ctx.pageNum.value;
    const sectionIdx = atoms.getSectionIdx(ctx, slideJson.section_id);
    atoms.addChromeFull(ctx, slide, pageNum, {
      withNav: true, sectionIdx, subsection: slideJson.subsection,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CODE-1（単一スニペット主役）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCODE1Single };
})();

// ─── code-2-split.js ─────────────────────────────────────────────
const { renderCODE2Split } = (function () {
  /**
   * CODE-2 左コード + 右説明
   * コード 4.5" + 説明 5.1"。説明テキストを主役に。
   */

  const atoms = require('../atoms');

  function renderCODE2Split(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);

    const titleBottomY = atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const startY = titleBottomY + 0.10;
    const endY = L.contentBot;
    const totalH = endY - startY;

    const leftW = 4.50;
    const leftX = L.marginX;
    const rightX = leftX + leftW + 0.30;
    const rightW = 10 - L.marginX - rightX;

    drawCodeBlock(slide, {
      x: leftX, y: startY, w: leftW, h: totalH,
      code: slideJson.code || {}, ctx, fontSize: 10,
    });
    const points = Array.isArray(slideJson.points) ? slideJson.points.slice(0, 4) : [];
    if (points.length > 0) {
      const gap = 0.18;
      const itemH = (totalH - gap * (points.length - 1)) / points.length;
      points.forEach((p, i) => {
        const py = startY + i * (itemH + gap);
        const badgeColor = (i === 0) ? C.brand : C.gray700;
        slide.addShape(pres.shapes.OVAL, {
          x: rightX, y: py + 0.04, w: 0.36, h: 0.36,
          fill: { color: badgeColor }, line: { type: 'none' },
        });
        slide.addText(String(i + 1), {
          x: rightX, y: py + 0.04, w: 0.36, h: 0.36,
          fontSize: 14, color: C.white, fontFace: F.jp, bold: true,
          align: 'center', valign: 'middle', margin: 0,
        });
        slide.addText(p.head || '', {
          x: rightX + 0.46, y: py, w: rightW - 0.46, h: 0.34,
          fontSize: 15, color: C.ink, fontFace: F.jp, bold: true,
          charSpacing: 0, align: 'left', valign: 'middle', margin: 0,
        });
        slide.addText(p.body || '', {
          x: rightX + 0.46, y: py + 0.36, w: rightW - 0.46, h: itemH - 0.36,
          fontSize: 13, color: C.gray700, fontFace: F.jp,
          align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 1.40,
        });
      });
    }

    const pageNum = ctx.pageNum.value;
    const sectionIdx = atoms.getSectionIdx(ctx, slideJson.section_id);
    atoms.addChromeFull(ctx, slide, pageNum, {
      withNav: true, sectionIdx, subsection: slideJson.subsection,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CODE-2（左コード+右説明）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCODE2Split };
})();

// ─── code-3-comments.js ──────────────────────────────────────────
const { renderCODE3Comments } = (function () {
  /**
   * CODE-3 上コード + 下 3 カラム解説
   * コード高さ 1.80" (圧縮) + 下 3 カラム解説 2.50" (拡大)。説明主役。
   */

  const atoms = require('../atoms');

  function renderCODE3Comments(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);

    const titleBottomY = atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const startY = titleBottomY + 0.10;
    const endY = L.contentBot;
    const totalH = endY - startY;

    const codeH = 1.80;
    const codeX = L.marginX, codeW = 10 - L.marginX * 2;

    drawCodeBlock(slide, {
      x: codeX, y: startY, w: codeW, h: codeH,
      code: slideJson.code || {}, ctx, fontSize: 10,
    });
    const comments = (slideJson.comments || []).slice(0, 3);
    const colY = startY + codeH + 0.20;
    const colH = endY - colY;
    const colGap = 0.22;
    const colW = (codeW - colGap * 2) / 3;
    comments.forEach((c, i) => {
      const cx = codeX + i * (colW + colGap);
      const labelColor = (i === 0) ? C.brand : C.gray700;
      // ラベル帯 (ミニマム化: 高さ 0.30)
      slide.addShape(pres.shapes.RECTANGLE, {
        x: cx, y: colY, w: colW, h: 0.30,
        fill: { color: labelColor }, line: { type: 'none' },
      });
      slide.addText(c.label || '', {
        x: cx + 0.10, y: colY, w: colW - 0.20, h: 0.30,
        fontSize: 13, color: C.white, fontFace: F.jp, bold: true,
        charSpacing: 0, align: 'left', valign: 'middle', margin: 0,
      });
      slide.addText(c.body || '', {
        x: cx + 0.05, y: colY + 0.36, w: colW - 0.10, h: colH - 0.36,
        fontSize: 13, color: C.ink, fontFace: F.jp,
        align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 1.40,
      });
    });

    const pageNum = ctx.pageNum.value;
    const sectionIdx = atoms.getSectionIdx(ctx, slideJson.section_id);
    atoms.addChromeFull(ctx, slide, pageNum, {
      withNav: true, sectionIdx, subsection: slideJson.subsection,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CODE-3（上コード+下3カラム）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCODE3Comments };
})();

// ─── code-4-before-after.js ──────────────────────────────────────
const { renderCODE4BeforeAfter } = (function () {
  /**
   * CODE-4 Before / After 2 コード並列
   * 左 Before / 右 After。ヘッダーは _code-block-atom が出すファイル名タグだけ。
   * 「Before」「After」の識別は code.file に "Before — design.md" のように入れて表現。
   */

  const atoms = require('../atoms');

  function renderCODE4BeforeAfter(slide, slideJson, ctx) {
    const { L } = ctx;
    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const startY = titleBottomY + 0.10;
    const endY = L.contentBot;
    const h = endY - startY;
    const gap = 0.22;
    const w = (10 - L.marginX * 2 - gap) / 2;
    const leftX = L.marginX;
    const rightX = leftX + w + gap;

    // file が指定されてなければ Before/After をデフォルトに
    const beforeCode = { ...(slideJson.before || {}) };
    const afterCode  = { ...(slideJson.after  || {}) };
    if (!beforeCode.file) beforeCode.file = `Before — ${beforeCode.lang || 'text'}`;
    if (!afterCode.file)  afterCode.file  = `After — ${afterCode.lang || 'text'}`;

    drawCodeBlock(slide, { x: leftX,  y: startY, w, h, code: beforeCode, ctx, fontSize: 10 });
    drawCodeBlock(slide, { x: rightX, y: startY, w, h, code: afterCode,  ctx, fontSize: 10 });

    const pageNum = ctx.pageNum.value;
    const sectionIdx = atoms.getSectionIdx(ctx, slideJson.section_id);
    atoms.addChromeFull(ctx, slide, pageNum, {
      withNav: true, sectionIdx, subsection: slideJson.subsection,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CODE-4（Before/After 2 コード並列）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCODE4BeforeAfter };
})();

// ─── code-5-steps.js ─────────────────────────────────────────────
const { renderCODE5Steps } = (function () {
  /**
   * CODE-5 ステップ実行
   * 番号 + 見出し + コードブロック (1-2 行) を 2-4 段。
   */

  const atoms = require('../atoms');

  function renderCODE5Steps(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const startY = titleBottomY + 0.10;
    const endY = L.contentBot;
    const totalH = endY - startY;
    const steps = (slideJson.steps || []).slice(0, 4);
    if (steps.length === 0) return;
    const gap = 0.20;
    const stepH = (totalH - gap * (steps.length - 1)) / steps.length;

    steps.forEach((s, i) => {
      const sy = startY + i * (stepH + gap);
      const numW = 0.40, headH = 0.30;
      const isPrimary = (i === steps.length - 1);
      const numColor = isPrimary ? C.brand : (C.gray700);
      slide.addShape(pres.shapes.RECTANGLE, {
        x: L.marginX, y: sy, w: numW, h: headH,
        fill: { color: numColor }, line: { type: 'none' },
      });
      slide.addText(s.num || `${String(i + 1).padStart(2, '0')}`, {
        x: L.marginX, y: sy, w: numW, h: headH,
        fontSize: 13, color: C.white, fontFace: 'JetBrains Mono', bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
      slide.addText(s.title || '', {
        x: L.marginX + numW + 0.15, y: sy, w: 10 - L.marginX * 2 - numW - 0.15, h: headH,
        fontSize: 14, color: C.ink, fontFace: F.jp, bold: true,
        charSpacing: 0, align: 'left', valign: 'middle', margin: 0,
      });
      const noteH = s.note ? 0.20 : 0;
      const codeY = sy + headH + 0.04;
      const codeH = stepH - headH - 0.04 - noteH;
      drawCodeBlock(slide, {
        x: L.marginX, y: codeY, w: 10 - L.marginX * 2, h: codeH,
        code: s.code || {}, ctx, fontSize: 11, terminalMode: true, showLineNumbers: false,
      });
      if (s.note) {
        slide.addText(s.note, {
          x: L.marginX + numW + 0.15, y: codeY + codeH + 0.02, w: 10 - L.marginX * 2 - numW - 0.15, h: 0.20,
          fontSize: 11, color: C.gray700, fontFace: F.jp, italic: true,
          align: 'left', valign: 'middle', margin: 0,
        });
      }
    });

    const pageNum = ctx.pageNum.value;
    const sectionIdx = atoms.getSectionIdx(ctx, slideJson.section_id);
    atoms.addChromeFull(ctx, slide, pageNum, {
      withNav: true, sectionIdx, subsection: slideJson.subsection,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CODE-5（ステップ実行）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCODE5Steps };
})();

// ─── code-6-terminal.js ──────────────────────────────────────────
const { renderCODE6Terminal } = (function () {
  /**
   * CODE-6 ターミナル風
   * Navy Dark 背景 + 緑プロンプト ($) + 灰コメント (#) + 白出力。
   * file 名は "terminal" だが、code.file で上書き可能。
   */

  const atoms = require('../atoms');

  function renderCODE6Terminal(slide, slideJson, ctx) {
    const { L } = ctx;
    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const startY = titleBottomY + 0.10;
    const endY = L.contentBot;
    const totalH = endY - startY;

    const term = slideJson.terminal || {};
    const lines = term.lines || [];
    // lines を {kind, text} 形式から「terminalMode で食べる文字列」に変換
    const bodyLines = lines.map(ln => {
      if (ln.kind === 'cmd') return `$ ${ln.text}`;
      if (ln.kind === 'comment') return `# ${ln.text}`;
      return ln.text || '';
    });

    drawCodeBlock(slide, {
      x: L.marginX, y: startY, w: 10 - L.marginX * 2, h: totalH,
      code: { lang: 'terminal', file: term.file || 'terminal', body: bodyLines.join('\n') },
      ctx, fontSize: 11, terminalMode: true, showLineNumbers: false,
    });

    const pageNum = ctx.pageNum.value;
    const sectionIdx = atoms.getSectionIdx(ctx, slideJson.section_id);
    atoms.addChromeFull(ctx, slide, pageNum, {
      withNav: true, sectionIdx, subsection: slideJson.subsection,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CODE-6（ターミナル風）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCODE6Terminal };
})();

// ─── code-7-tree.js ──────────────────────────────────────────────
const { renderCODE7Tree } = (function () {
  /**
   * ===================================================
   * tree -L 3 風のディレクトリ表示。
   * Navy Dark 背景 + 白系文字 + ASCII 罫線 (├ │ └ ─) で構造を見せる。
   * 各ノードに任意で右側コメントを付けられる (コードコメント風 灰色)。
   *
   * 期待 JSON:
   *   {
   *     id, template_id: 'CODE-7',
   *     title, subtitle,
   *     tree: {
   *       file?: 'リポジトリのルート名 等 (default は root.name)',
   *       root: {
   *         name: 'enostech-slides/',
   *         children: [
   *           { name: 'SKILL.md',         comment?: 'スキル本体' },
   *           { name: 'scripts/',         comment?: '実装',
   *             children: [
   *               { name: 'render/',      comment?: 'レンダラ層' },
   *             ]
   *           },
   *           ...
   *         ]
   *       }
   *     },
   *     caption?: 'ツリー直下の 1-2 行注釈',
   *   }
   *
   * 高さ調整:
   *   - ノード数 (再帰展開後) を数えて、フォントサイズを 11/10/9 で自動切替
   *   - 入りきらない場合は末尾を切り捨て
   */

  const atoms = require('../atoms');

  const MONO_FONT = 'JetBrains Mono';

  /**
   * ツリーを「テキスト行」に flatten する。
   * 各行は { text, depth, isHighlighted, comment } の形。
   *
   * 出力例:
   *   enostech-slides/
   *   ├─ SKILL.md
   *   ├─ scripts/
   *   │  ├─ render/
   *   │  │  ├─ build-deck.js
   *   │  │  └─ templates/
   *   │  └─ run-qa.py
   *   └─ assets/
   */
  function flattenTree(node, prefixParts, isLast, lines, depth) {
    if (!node || !node.name) return;
    let prefix = '';
    for (const seg of prefixParts) {
      prefix += seg ? '│  ' : '   ';
    }
    if (depth > 0) {
      prefix += isLast ? '└─ ' : '├─ ';
    }
    lines.push({
      prefix,
      name: node.name,
      comment: node.comment || null,
      isHighlighted: node.highlight === true,
      isDir: node.name.endsWith('/'),
    });
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((c, i) => {
      const childIsLast = i === children.length - 1;
      flattenTree(
        c,
        prefixParts.concat([!isLast]),
        childIsLast,
        lines,
        depth + 1,
      );
    });
  }

  function renderCODE7Tree(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);

    const titleBottomY = atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const startY = titleBottomY + 0.10;
    const endY = L.contentBot;
    const totalH = endY - startY;
    const captionH = slideJson.caption ? 0.36 : 0;
    const treeH = totalH - captionH;
    const treeX = L.marginX;
    const treeW = 10 - L.marginX * 2;

    const tree = slideJson.tree || {};
    const root = tree.root || { name: '/' };
    const fileLabel = tree.file || root.name || 'tree';

    // 背景 (Navy Dark)
    slide.addShape(pres.shapes.RECTANGLE, {
      x: treeX, y: startY, w: treeW, h: treeH,
      fill: { color: ctx.C.code.bg }, line: { type: 'none' },
    });

    const headH = 0.24;
    // タイトルバー背景 (1A2233: 本文より僅かに暗い tint で識別性を上げる)
    slide.addShape(pres.shapes.RECTANGLE, {
      x: treeX, y: startY, w: treeW, h: headH,
      fill: { color: ctx.C.code.headerBg }, line: { type: 'none' },
    });
    slide.addShape(pres.shapes.LINE, {
      x: treeX + 0.10, y: startY + headH, w: treeW - 0.20, h: 0,
      line: { color: ctx.C.code.headerLine, width: 0.25 },
    });
    slide.addText(fileLabel, {
      x: treeX + 0.12, y: startY + 0.02, w: treeW - 0.24, h: headH - 0.02,
      fontSize: 9, color: ctx.C.code.fileLabel, fontFace: MONO_FONT,
      charSpacing: 0.5, align: 'left', valign: 'middle', margin: 0,
    });

    // ツリーを flatten
    const lines = [];
    flattenTree(root, [], true, lines, 0);

    // フォントサイズ自動切替 (ノード数で)
    const n = lines.length;
    const fs = n > 28 ? 9 : (n > 22 ? 10 : 11);
    const lh = fs * 0.020 + 0.03;
    const padX = 0.18;
    const bodyY = startY + headH + 0.10;
    const bodyH = treeH - headH - 0.10;
    const maxRows = Math.floor((bodyH - 0.10) / lh);

    // 行コメントの開始 x (右寄りに統一して "横軸でコメント整列")
    const commentX = treeX + treeW * 0.62;
    const treeColW = commentX - treeX - padX - 0.10;
    const commentColW = treeX + treeW - commentX - padX;

    lines.slice(0, maxRows).forEach((ln, i) => {
      const ly = bodyY + i * lh;
      // ツリー部 (prefix + name)
      // prefix を罫線色 (gray500)、name を白に分けるため 2 つの text に
      const prefixW = ln.prefix.length * fs * 0.011 + 0.05;  // モノスペース幅近似
      slide.addText(ln.prefix, {
        x: treeX + padX, y: ly, w: prefixW, h: lh,
        fontSize: fs, color: ctx.C.code.lineNumber, fontFace: MONO_FONT,
        align: 'left', valign: 'top', margin: 0,
      });
      // name (ディレクトリは highlight=true 時 brand、そうでなければ通常色)
      let nameColor = C.code.text;
      if (ln.isHighlighted) nameColor = C.code.highlight;      // 強調 = brand
      else if (ln.isDir)    nameColor = C.code.dir;      // ディレクトリは薄い青
      slide.addText(ln.name, {
        x: treeX + padX + prefixW, y: ly, w: treeColW - prefixW, h: lh,
        fontSize: fs, color: nameColor, fontFace: MONO_FONT,
        bold: ln.isHighlighted || ln.isDir,
        align: 'left', valign: 'top', margin: 0,
      });
      // コメント (gray)
      if (ln.comment) {
        slide.addText(`# ${ln.comment}`, {
          x: commentX, y: ly, w: commentColW, h: lh,
          fontSize: fs, color: ctx.C.code.comment, fontFace: MONO_FONT, italic: true,
          align: 'left', valign: 'top', margin: 0,
        });
      }
    });

    // 入りきらない時は省略マーク
    if (n > maxRows) {
      const ly = bodyY + maxRows * lh;
      slide.addText(`… (他 ${n - maxRows} 行)`, {
        x: treeX + padX, y: ly, w: treeW - padX * 2, h: lh,
        fontSize: fs, color: ctx.C.code.muted, fontFace: MONO_FONT, italic: true,
        align: 'left', valign: 'top', margin: 0,
      });
    }

    // ツリー直下のキャプション
    if (slideJson.caption) {
      slide.addText(slideJson.caption, {
        x: treeX, y: endY - captionH + 0.06, w: treeW, h: captionH - 0.06,
        fontSize: 12, color: C.gray700, fontFace: F.jp, italic: true,
        align: 'left', valign: 'top', margin: 0,
      });
    }

    // クローム
    const pageNum = ctx.pageNum.value;
    const sectionIdx = atoms.getSectionIdx(ctx, slideJson.section_id);
    atoms.addChromeFull(ctx, slide, pageNum, {
      withNav: true, sectionIdx, subsection: slideJson.subsection,
    });

    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CODE-7（ディレクトリツリー）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCODE7Tree };
})();


// ─── code-10-diff.js (v11.7 新規 / Phase γ) ──────────────────────
const { renderCODE10Diff } = (function () {
  /**
   * CODE-10 Diff 表示 (v11.7 新規 / Category K: CODE)
   * ============================================================
   * 各行に +/- マーカーで diff を可視化。git diff 風表示。
   *
   * 期待 JSON:
   *   {
   *     code: {
   *       lang: 'diff' | 'js' | 'py' | ...,
   *       file?: 'app.js (diff)',
   *       lines: [
   *         { kind: 'add' | 'del' | 'context', text: '...' },
   *         ...
   *       ]
   *     },
   *     code_caption?: '...'
   *   }
   */
  const atoms = require('../atoms');
  function renderCODE10Diff(slide, slideJson, ctx) {
    const { L, C, F, pres } = ctx;
    atoms.setCanvasBg(ctx, slide);
    const titleBottomY = atoms.addTitleBlock(ctx, slide, slideJson.title || '', slideJson.subtitle || '');
    const startY = titleBottomY + 0.10;
    const endY = L.contentBot;
    const totalH = endY - startY;
    const captionH = slideJson.code_caption ? 0.40 : 0;
    const codeH = totalH - captionH;
    const codeX = L.marginX, codeW = 10 - L.marginX * 2;
    // 背景
    slide.addShape(pres.shapes.RECTANGLE, {
      x: codeX, y: startY, w: codeW, h: codeH,
      fill: { color: ctx.C.code.bg }, line: { type: 'none' },
    });
    // ヘッダ
    const headH = 0.24;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: codeX, y: startY, w: codeW, h: headH,
      fill: { color: ctx.C.code.headerBg }, line: { type: 'none' },
    });
    slide.addText((slideJson.code && slideJson.code.file) || 'diff', {
      x: codeX + 0.14, y: startY + 0.02, w: codeW - 0.28, h: headH - 0.02,
      fontSize: 9, color: ctx.C.code.fileLabel, fontFace: 'JetBrains Mono',
      charSpacing: 0.5, align: 'left', valign: 'middle', margin: 0,
    });
    // 行描画
    const lines = (slideJson.code && Array.isArray(slideJson.code.lines)) ? slideJson.code.lines : [];
    const fs = 11;
    const lh = fs * 0.020 + 0.03;
    const padX = 0.18, markW = 0.30;
    const bodyY = startY + headH + 0.08;
    const bodyH = codeH - headH - 0.10;
    const maxRows = Math.floor(bodyH / lh);
    lines.slice(0, maxRows).forEach((ln, i) => {
      const ly = bodyY + i * lh;
      const kind = ln.kind || 'context';
      let bgColor = null, markColor, markChar = '', textColor;
      if (kind === 'add')      { bgColor = '14532D'; markColor = ctx.C.code.prompt; markChar = '+'; textColor = ctx.C.code.text; }
      else if (kind === 'del') { bgColor = '7F1D1D'; markColor = ctx.C.semanticDanger; markChar = '-'; textColor = ctx.C.code.text; }
      else                     { markColor = ctx.C.code.muted; markChar = ' '; textColor = ctx.C.code.text; }
      // 行背景 (add / del のみ)
      if (bgColor) {
        slide.addShape(pres.shapes.RECTANGLE, {
          x: codeX + 0.06, y: ly, w: codeW - 0.12, h: lh,
          fill: { color: bgColor, transparency: 60 }, line: { type: 'none' },
        });
      }
      // マーカー (+/-)
      slide.addText(markChar, {
        x: codeX + padX, y: ly, w: markW, h: lh,
        fontSize: fs, color: markColor, fontFace: 'JetBrains Mono', bold: true,
        align: 'center', valign: 'top', margin: 0,
      });
      // 行テキスト
      slide.addText(ln.text || ' ', {
        x: codeX + padX + markW + 0.10, y: ly,
        w: codeW - padX * 2 - markW - 0.10, h: lh,
        fontSize: fs, color: textColor, fontFace: 'JetBrains Mono',
        align: 'left', valign: 'top', margin: 0,
      });
    });
    // caption
    if (slideJson.code_caption) {
      slide.addText(slideJson.code_caption, {
        x: codeX, y: endY - captionH + 0.08, w: codeW, h: captionH - 0.08,
        fontSize: 12, color: C.gray700, fontFace: F.jp, italic: true,
        align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 1.40,
      });
    }
    const pageNum = ctx.pageNum.value;
    const sectionIdx = atoms.getSectionIdx(ctx, slideJson.section_id);
    atoms.addChromeFull(ctx, slide, pageNum, {
      withNav: true, sectionIdx, subsection: slideJson.subsection,
    });
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'CODE-10（Diff 表示）',
        goal: slideJson.slide_goal.title || '', message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }
  return { renderCODE10Diff };
})();

// ─── index.js (registry export) ──────────────────────────────


module.exports.registry = {
  'CODE-1': renderCODE1Single,
  'CODE-2': renderCODE2Split,
  'CODE-3': renderCODE3Comments,
  'CODE-4': renderCODE4BeforeAfter,
  'CODE-5': renderCODE5Steps,
  'CODE-6': renderCODE6Terminal,
  'CODE-7': renderCODE7Tree,
  'CODE-10': renderCODE10Diff,  // v11.7: Diff 表示
};
