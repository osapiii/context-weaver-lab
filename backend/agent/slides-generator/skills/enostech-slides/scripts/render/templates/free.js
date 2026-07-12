'use strict';

// =============================================================
// templates/free.js
// -------------------------------------------------------------
// Consolidated from templates/free/*.js.
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

// ─── free-1.js ───────────────────────────────────────────────────
const { renderFree1 } = (function () {
  /**
   * FREE-1 自由レイアウト (特殊枠)
   * ================================
   * Chrome（左帯・ナビ・タイトルブロック・フッター）は自動描画、
   * 本体エリアは declarative な shape 配列で構成する。
   *
   * 「ダイアグラムや Visual を自由に組み上げる」ための逸脱用テンプレ。
   * 標準テンプレ（LIST-1 / FRAMING-1 等の現行 ID）で表現できない構成のみ FREE-1 を使う。
   *
   * 期待 JSON 構造:
   *   {
   *     id: "S20",
   *     template_id: "FREE-1",
   *     section_id: "main",
   *     title: "...",
   *     subtitle: "...",
   *     free_layout: {
   *       skip_title_block: false,   // optional, default false
   *       shapes: [
   *         { type: "text", x, y, w, h, text, size, color, bold?, align? },
   *         { type: "rect", x, y, w, h, fill, line? },
   *         { type: "rule", x, y, w, color, h? },
   *         { type: "image", x, y, w, h, path },
   *         { type: "diagram", scene, x, y, w, h, data },
   *         { type: "raw_text_runs", x, y, w, h, runs: [{text, ref?, color?, bold?}], size?, color? }
   *       ]
   *     }
   *   }
   *
   * 中間 DSL ルール（案②: トークン参照強制）:
   *   - color/fill: トークン名のみ ('brand' / 'accent' / 'ink' / 'gray700' 等)
   *     → ctx.C[name] で解決。直接 hex は受け付けない（fatal）
   *   - size: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny'
   *     → ctx.SZ[name] にマップ（_SIZE_MAP 参照）
   *   - 不明トークンは fatal エラー（PoC では console.error + skip）
   */


  const atoms = require('../atoms');

  const { drawDIAG02Cycle }       = require('../diagrams/diag-02-cycle');
  const { drawDIAG03Stepup }      = require('../diagrams/diag-03-stepup');
  const { drawDIAG04BeforeAfter } = require('../diagrams/diag-04-before-after');
  const { drawDIAG05Pyramid }     = require('../diagrams/diag-05-pyramid');
  const { drawDIAG06Timeline }    = require('../diagrams/diag-06-timeline');
  const { drawDIAG07Radial }      = require('../diagrams/diag-07-radial');
  const { drawDIAG08Matrix }      = require('../diagrams/diag-08-matrix');
  const { drawDIAG09Scatter }     = require('../diagrams/diag-09-scatter');

  const DIAGRAM_REGISTRY = {
    'DIAG-02': drawDIAG02Cycle,
    'DIAG-03': drawDIAG03Stepup,
    'DIAG-04': drawDIAG04BeforeAfter,
    'DIAG-05': drawDIAG05Pyramid,
    'DIAG-06': drawDIAG06Timeline,
    'DIAG-07': drawDIAG07Radial,
    'DIAG-08': drawDIAG08Matrix,
    'DIAG-09': drawDIAG09Scatter,
  };

  // size 名 → tokens.js の size キーへのマップ
  const _SIZE_MAP = {
    h1:    'titleL',   // 24pt 相当
    h2:    'titleM',   // 18pt 相当
    h3:    'titleS',   // 14pt 相当
    body:  'body',     // 11-12pt
    small: 'caption',  // 9-10pt
    tiny:  'caption',  // 同上 (PoC では caption と統一)
  };

  function renderFree1(slide, slideJson, ctx) {
    const { L } = ctx;

    atoms.setCanvasBg(ctx, slide);

    const free = slideJson.free_layout || {};
    const shapes = Array.isArray(free.shapes) ? free.shapes : [];

    // タイトルブロック（skip_title_block: true なら省略）
    let bodyTopY = L.contentY;
    if (!free.skip_title_block) {
      const nextY = atoms.addTitleBlock(
        ctx, slide,
        slideJson.title || '',
        slideJson.subtitle || '',
      );
      bodyTopY = nextY;
    }

    // 各 shape を解釈してディスパッチ
    shapes.forEach((shape, i) => {
      if (!shape || typeof shape !== 'object' || !shape.type) {
        console.error(`[FREE-1] shapes[${i}]: type 欠落、スキップします`);
        return;
      }
      const handler = _SHAPE_HANDLERS[shape.type];
      if (!handler) {
        console.error(`[FREE-1] shapes[${i}]: unknown type "${shape.type}"、スキップします`);
        return;
      }
      try {
        handler(slide, shape, ctx);
      } catch (e) {
        console.error(`[FREE-1] shapes[${i}] (${shape.type}) でエラー:`, e.message);
      }
    });

    // Chrome (ナビ付き or なし)
    const pageNum = ctx.pageNum.value;
    if (slideJson.section_id) {
      atoms.addChromeWithNavById(
        ctx, slide, pageNum,
        slideJson.section_id, slideJson.subsection || null,
      );
    } else {
      atoms.addChrome(ctx, slide, pageNum);
    }

    // Speaker Notes
    if (slideJson.slide_goal) {
      atoms.addSpeakerNotes(ctx, slide, { slideJson,
        template: 'FREE-1（自由レイアウト）',
        goal: slideJson.slide_goal.title || '',
        message: slideJson.subtitle || '',
        design: slideJson.slide_goal.subtitle || '',
      });
    }
  }

  // ───────────────────────────────────────────────────────
  // shape ハンドラー (中間 DSL → PptxGenJS API への変換)
  // ───────────────────────────────────────────────────────

  const _SHAPE_HANDLERS = {
    text(slide, shape, ctx) {
      const { F } = ctx;
      const color = _resolveColor(ctx, shape.color);
      const size = _resolveSize(ctx, shape.size || 'body');

      slide.addText(shape.text || '', {
        x: shape.x, y: shape.y, w: shape.w, h: shape.h,
        fontSize: size,
        color,
        fontFace: F.jp,
        bold: !!shape.bold,
        align: shape.align || 'left',
        valign: shape.valign || 'top',
        margin: 0,
      });
    },

    rect(slide, shape, ctx) {
      const { pres } = ctx;
      const fill = _resolveColor(ctx, shape.fill);
      const opt = {
        x: shape.x, y: shape.y, w: shape.w, h: shape.h,
        fill: { color: fill },
        line: { type: 'none' },
      };
      if (shape.line) {
        opt.line = {
          color: _resolveColor(ctx, shape.line.color || 'gray300'),
          width: shape.line.width ?? 0.5,
        };
      }
      if (shape.rectRadius != null) {
        opt.rectRadius = shape.rectRadius;
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, opt);
      } else {
        slide.addShape(pres.shapes.RECTANGLE, opt);
      }
    },

    rule(slide, shape, ctx) {
      const { pres } = ctx;
      const color = _resolveColor(ctx, shape.color || 'gray300');
      const h = shape.h ?? 0.02;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: shape.x, y: shape.y, w: shape.w, h,
        fill: { color }, line: { type: 'none' },
      });
    },

    image(slide, shape, ctx) {
      const { assetsRoot } = ctx;
      if (!shape.path) {
        console.error('[FREE-1/image] path 欠落');
        return;
      }
      const path = require('path');
      const resolvedPath = path.isAbsolute(shape.path)
        ? shape.path
        : path.join(assetsRoot || '', shape.path);
      slide.addImage({
        path: resolvedPath,
        x: shape.x, y: shape.y, w: shape.w, h: shape.h,
      });
    },

    diagram(slide, shape, ctx) {
      const handler = DIAGRAM_REGISTRY[shape.scene];
      if (!handler) {
        console.error(`[FREE-1/diagram] unknown scene "${shape.scene}"`);
        return;
      }
      const area = { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
      handler(slide, shape.data || {}, area, ctx);
    },

    raw_text_runs(slide, shape, ctx) {
      const { F } = ctx;
      const runs = Array.isArray(shape.runs) ? shape.runs : [];
      const baseColor = _resolveColor(ctx, shape.color || 'ink');
      const baseSize = _resolveSize(ctx, shape.size || 'body');

      const pptxRuns = runs.map(run => {
        // ref 指定時は inlineRef ヘルパーで青文字ハイパーリンク化
        if (run.ref && ctx.refsByNum && ctx.refsByNum[run.ref]) {
          return atoms.inlineRef(ctx, run.ref, ctx.refsByNum[run.ref], { size: baseSize });
        }
        return {
          text: run.text || '',
          options: {
            color: run.color ? _resolveColor(ctx, run.color) : baseColor,
            fontSize: run.size ? _resolveSize(ctx, run.size) : baseSize,
            fontFace: F.jp,
            bold: !!run.bold,
          },
        };
      });

      slide.addText(pptxRuns, {
        x: shape.x, y: shape.y, w: shape.w, h: shape.h,
        align: shape.align || 'left',
        valign: shape.valign || 'top',
        margin: 0,
      });
    },
  };

  // ───────────────────────────────────────────────────────
  // トークン解決 (中間 DSL の核)
  // ───────────────────────────────────────────────────────

  /**
   * color トークン名 → 実 hex を返す。
   * 不明なトークンは ink フォールバック + console.error。
   * 直接 hex (^#?[0-9A-Fa-f]{6}$) は受け付けない（中間 DSL 強制）。
   */
  function _resolveColor(ctx, name) {
    if (typeof name !== 'string') {
      console.error('[FREE-1] color が文字列でない:', name);
      return ctx.C.ink;
    }
    // 直接 hex は禁止
    if (/^#?[0-9A-Fa-f]{6}$/.test(name)) {
      console.error(`[FREE-1] 直接 hex 禁止: "${name}" → トークン名 (brand/accent/ink/gray700 等) を使う`);
      return ctx.C.ink;
    }
    // ctx.C は Proxy なので `in` ではなく直接アクセスして undefined チェック
    const v = ctx.C[name];
    if (v !== undefined && v !== null && v !== '') return v;
    console.error(`[FREE-1] unknown color token "${name}"、ink にフォールバック`);
    return ctx.C.ink;
  }

  /**
   * size トークン名 → 実 fontSize を返す。
   * 不明な場合は body フォールバック。
   */
  function _resolveSize(ctx, name) {
    if (typeof name !== 'string') return ctx.SZ.body;
    const tokenKey = _SIZE_MAP[name];
    if (tokenKey) {
      const v = ctx.SZ[tokenKey];
      if (v !== undefined && v !== null) return v;
    }
    // 直接 SZ キー指定もサポート（互換）
    const v2 = ctx.SZ[name];
    if (v2 !== undefined && v2 !== null) return v2;
    console.error(`[FREE-1] unknown size token "${name}"、body にフォールバック`);
    return ctx.SZ.body;
  }
  return { renderFree1 };
})();

// ─── index.js (registry export) ──────────────────────────────

module.exports.registry = {
  'FREE-1': renderFree1,
};
