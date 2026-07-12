/**
 * ===================================================
 * scripts/render/templates/eno-XX-*.js が期待するフィールドを Zod で記述。
 * 実装側 (eno-XX-*.js) は冒頭で `const schemas = require('../schemas/templates');`
 * → `validateSlide(schemas.LIST1, slideJson, 'LIST-1');` で検証する。
 *
 * 設計原則:
 *   - 各テンプレは SlideBase を extend して固有フィールドを足す
 *   - フィールド名・ネスト構造は scripts/render/templates/eno-XX-*.js の実装に追従
 *   - passthrough() を最小限に — 無い項目は無いと検証して止める
 *   - section_id はナビ chip 用なので章扉/表紙/閉じ以外は基本必須に近いが、optional 許容で警告は別層に任せる
 */

'use strict';

const { z, SlideBaseSchema, RefRowSchema, DetailBlockSchema, SubCopySchema } = require('../common');

// 各テンプレで使う再利用断片
const StripeColor = z.enum(['brand', 'accent', 'highlight', 'ink', 'gray']);

// ───────────────────────────────────────────────────────
// Category A: STRUCTURE (表紙/章扉/閉じ/目次)
// ───────────────────────────────────────────────────────

/** SECTION-1 表紙 — 表紙は短い tagline 許容 (SubCopySchema 適用外) */
const SECTION1 = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-1'),
  title: z.string(),
  subtitle: z.string().max(80, { message: 'SchemaQA-11: SECTION-1 subtitle は 80字以内 (表紙の tagline 想定)' }).optional(),
  issued: z.string().optional(),
});

/** SECTION-1A 表紙 — Twilight Forge シンプル版 (表紙は短い tagline 許容) */
const SECTION1A = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-1A'),
  title: z.string(),
  subtitle: z.string().max(80, { message: 'SchemaQA-11: SECTION-1A subtitle は 80字以内 (表紙の tagline 想定)' }).optional(),
  issued: z.string().optional(),
});

/** SECTION-1B 表紙 — エディトリアル分割 */
const SECTION1B = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-1B'),
  title: z.string().max(60, { message: 'SchemaQA-11: SECTION-1B title は 60 字以内 (右パネル幅で 2-3 行に収める)' }),
  subtitle: z.string().max(180, { message: 'SchemaQA-11: SECTION-1B subtitle は 180 字以内' }).optional(),
  image_path: z.string().optional(),
  placeholder_label: z.string().optional(),
  eyebrow: z.string().max(24, { message: 'SchemaQA-11: SECTION-1B eyebrow は 24 字以内' }).optional(),
  issued: z.string().optional(),
  author: z.string().max(40, { message: 'SchemaQA-11: SECTION-1B author は 40 字以内' }).optional(),
});

/** SECTION-1D 表紙 — ミニマル・タイポグラフィ */
const SECTION1D = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-1D'),
  title: z.string().max(60, { message: 'SchemaQA-11: SECTION-1D title は 60 字以内 (44pt で 2-3 行)' }),
  subtitle: z.string().max(180, { message: 'SchemaQA-11: SECTION-1D subtitle は 180 字以内' }).optional(),
  issued: z.string().optional(),
  author: z.string().max(40, { message: 'SchemaQA-11: SECTION-1D author は 40 字以内' }).optional(),
  dept: z.string().max(30, { message: 'SchemaQA-11: SECTION-1D dept は 30 字以内' }).optional(),
});

/** SECTION-1F 表紙 — 引用主導 */
const SECTION1F = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-1F'),
  quote: z.string().min(8, { message: 'SchemaQA-11: SECTION-1F quote は 8 字以上' })
                   .max(120, { message: 'SchemaQA-11: SECTION-1F quote は 120 字以内 (推奨 30-80 字、長すぎると主役にならない)' }),
  quote_attribution: z.string().max(60, { message: 'SchemaQA-11: SECTION-1F quote_attribution は 60 字以内' }).optional(),
  title: z.string().max(50, { message: 'SchemaQA-11: SECTION-1F title は 50 字以内 (引用が主役なので小さく置く)' }),
  subtitle: z.string().max(120, { message: 'SchemaQA-11: SECTION-1F subtitle は 120 字以内' }).optional(),
  issued: z.string().optional(),
});

/** SECTION-1G 表紙 — full-bleed SVG-only */
const SECTION1G = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-1G'),
  title: z.string().optional(),  // メタ情報 (テンプレ自身は使わない、SVG 内に書く)
  placeholder_label: z.string().optional(),
  svg: z.string().optional(),
  svg_file: z.string().optional(),
  image_path: z.string().optional(),  // preprocessSvgIllustrations が svg → image_path に書き戻す
}).refine(
  d => Boolean(d.svg || d.svg_file || d.image_path),
  { message: 'SchemaQA-03: svg / svg_file / image_path のいずれかが必須 (SECTION-1G は full-bleed SVG-only テンプレ)' },
);

/** SECTION-2 セクション扉 */
const SECTION2 = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-2'),
  number: z.string().optional(),
  title: z.string(),
  subtitle: SubCopySchema,
  page_label: z.string().optional(),
});

/** SECTION-3 閉じ */
const SECTION3 = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-3'),
  thanks: z.string().optional(),
  sub: z.string().optional(),
  contact_left: z.array(z.tuple([z.string(), z.string()])).optional(),
  contact_right: z.array(z.tuple([z.string(), z.string()])).optional(),
});

/** SECTION-4 セクション扉バリアント A */
const SECTION4 = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-4'),
  number: z.string().optional(),
  title: z.string(),
  subtitle: SubCopySchema,
});

/** SECTION-5 セクション扉バリアント B */
const SECTION5 = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-5'),
  number: z.string().optional(),
  title: z.string(),
  subtitle: SubCopySchema,
});

/** SECTION-6 統合目次 */
const SECTION6 = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-6'),
  title: z.string(),
  subtitle: SubCopySchema,
  chapters: z.array(z.object({
    num: z.string(),
    title: z.string(),
    overview: z.string().optional(),
    subsections: z.array(z.object({
      num: z.string().optional(),
      name: z.string(),
    })).optional(),
  })),
});

// ───────────────────────────────────────────────────────
// Category B: CONTENT (本文系)
// ───────────────────────────────────────────────────────

/** LIST-1 標準コンテンツ — bullets 必須 (M1 互換で detail_blocks も受ける) */
const LIST1 = SlideBaseSchema.extend({
  template_id: z.literal('LIST-1'),
  title: z.string(),
  subtitle: SubCopySchema,
  bullets: z.array(z.object({
    // SchemaQA-11: 描画破綻リスクの fatal 上限
    head: z.string().max(32, { message: 'SchemaQA-11: LIST-1 bullets[].head は 32字以内 (推奨 25字)' }),
    body: z.string().max(200, { message: 'SchemaQA-11: LIST-1 bullets[].body は 200字以内 (推奨 150字)' }),
  })).optional(),
}).refine(
  d => Array.isArray(d.bullets) || Array.isArray(d.detail_blocks),
  { message: 'bullets[] または detail_blocks[] のいずれかが必須' },
);

/** COMPARE-1 Before/After リッチ 3 行 */
const COMPARE1 = SlideBaseSchema.extend({
  template_id: z.literal('COMPARE-1'),
  items: z.array(z.object({
    label: z.string().max(14, { message: 'SchemaQA-11: COMPARE-1 items[].label は 14字以内' }),
    sub: z.string().max(20, { message: 'SchemaQA-11: COMPARE-1 items[].sub は 20字以内' }).optional(),
    before: z.string().max(20, { message: 'SchemaQA-11: COMPARE-1 items[].before は 20字以内 (推奨 12字以下、それ以上は動的縮小されるが見栄え劣化)' }),
    beforeSub: z.string().max(32, { message: 'SchemaQA-11: COMPARE-1 items[].beforeSub は 32字以内' }).optional(),
    after: z.string().max(20, { message: 'SchemaQA-11: COMPARE-1 items[].after は 20字以内 (推奨 12字以下)' }),
    afterSub: z.string().max(32, { message: 'SchemaQA-11: COMPARE-1 items[].afterSub は 32字以内' }).optional(),
  })).min(1),
});

/** LIST-2 3 カラム */
const LIST2 = SlideBaseSchema.extend({
  template_id: z.literal('LIST-2'),
  title: z.string(),
  subtitle: SubCopySchema,
  cols: z.array(z.object({
    stripe: StripeColor.optional(),
    // SchemaQA-11: 折返しで本文と被るリスク
    title: z.string().max(16, { message: 'SchemaQA-11: LIST-2 cols[].title は 16字以内 (推奨 12字)' }),
    body: z.string().max(180, { message: 'SchemaQA-11 v10.1.2: LIST-2 cols[].body は 180字以内 (推奨 120-160字 / 旧 120字)' }).optional(),
    points: z.array(z.string()).optional(),
  })).min(2).max(3),
});

/** LIST-3 カードグリッド */
const LIST3 = SlideBaseSchema.extend({
  template_id: z.literal('LIST-3'),
  title: z.string(),
  subtitle: SubCopySchema,
  items: z.array(z.object({
    num: z.string().optional(),
    // SchemaQA-11: カードタイトル折返しで tag と被るリスク
    name: z.string().max(14, { message: 'SchemaQA-11: LIST-3 items[].name は 14字以内 (推奨 11字)' }),
    tag: z.string().optional(),
    desc: z.string().max(160, { message: 'SchemaQA-11 v10.1.2: LIST-3 items[].desc は 160字以内 (推奨 100-140字 / 旧 90字)。font は build-deck 側で自動縮小' }),
    cat: z.string().optional(),
    featured: z.boolean().optional(),
  })).min(2),
});

/** LIST-8 詳細カード — left + right の 2 ペイン構造 (今回事故元 1) */
const LIST8 = SlideBaseSchema.extend({
  template_id: z.literal('LIST-8'),
  title: z.string(),
  subtitle: SubCopySchema,
  left: z.object({
    title: z.string(),
    tagline: z.string().optional(),
    desc: z.string().optional(),
    chips: z.array(z.object({
      text: z.string(),
      w: z.number().optional(),
      active: z.boolean().optional(),
    })).optional(),
  }),
  right: z.array(z.object({
    title: z.string(),
    items: z.array(z.object({
      n: z.string().optional(),
      head: z.string(),
      body: z.string(),
    })),
  })).min(1),
});

// ───────────────────────────────────────────────────────
// Category H: DATA / REFERENCE
// ───────────────────────────────────────────────────────

/** DATA-1 項目-値テーブル */
const DATA1 = SlideBaseSchema.extend({
  template_id: z.literal('DATA-1'),
  rows: z.array(z.tuple([z.string(), z.string()])).min(1),
});

/** DATA-2 データテーブル — headers + rows root 直下 (今回事故元 2) */
const DATA2 = SlideBaseSchema.extend({
  template_id: z.literal('DATA-2'),
  title: z.string(),
  subtitle: SubCopySchema,
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())).min(1),
  col_widths: z.array(z.number()).optional(),
});

/** DATA-4 参考情報集 */
const DATA4 = SlideBaseSchema.extend({
  template_id: z.literal('DATA-4'),
  title: z.string(),
  subtitle: SubCopySchema,
  ref_table: z.array(RefRowSchema).min(1),
  footnote: z.string().optional(),
});

/** COMPARE-3 比較表 — cols × items の matrix */
const COMPARE3 = SlideBaseSchema.extend({
  template_id: z.literal('COMPARE-3'),
  //       Zod は「そもそも長文を入れさせない」ガード。長文比較表は COMPARE-5/6 を使うべき
  cols: z.array(z.string().max(15, { message: 'SchemaQA-11: COMPARE-3 cols[] は 15字以内 (列数 4 以上なら 8字以内推奨)' })).min(2).max(5),
  items: z.array(z.string().max(20, { message: 'SchemaQA-11: COMPARE-3 items[] (行ラベル) は 20字以内' })).min(1),
  matrix: z.array(z.array(
    z.string().max(20, { message: 'SchemaQA-11: COMPARE-3 matrix セルは 20字以内 (推奨: 評価記号 ◎○△× または 12字以内の短語句、長文比較は COMPARE-5/6 へ)' })
  )).min(1),
});

/** COMPARE-4 トレードオフスライダー */
const COMPARE4 = SlideBaseSchema.extend({
  template_id: z.literal('COMPARE-4'),
  sliders: z.array(z.object({
    label: z.string(),
    left: z.string(),
    right: z.string(),
    items: z.array(z.object({
      name: z.string(),
      position: z.number().min(0).max(1),
      accent: z.boolean().optional(),
    })).min(1),
  })).min(1),
});

/** DATA-5 用語集 */
const DATA5 = SlideBaseSchema.extend({
  template_id: z.literal('DATA-5'),
  title: z.string(),
  subtitle: SubCopySchema,
  terms: z.array(z.object({
    term: z.string(),
    reading: z.string().optional(),
    desc: z.string(),
  })).min(3).max(10),
  footnote: z.string().optional(),
});

/**
 * LONGTEXT-1 引用パラグラフ主役
 * ============================================
 * GitHub README / 白書 / 技術記事の重要節を引用、または LLM が長文段落を生成して
 * 渡すための「読み物寄り」スライド。スライド主体の情報密度では取りこぼす
 * 「豊かな情報量」を 1 枚で渡す目的。
 */
const LONGTEXT1 = SlideBaseSchema.extend({
  template_id: z.literal('LONGTEXT-1'),
  title: z.string(),
  subtitle: z.string().max(200, { message: 'SchemaQA-11: LONGTEXT-1 subtitle は 200字以内 (推奨 60-160字)' }).optional(),
  eyebrow: z.string().max(20).optional(),
  source: z.object({
    label: z.string().min(1),
    url: z.string().url().optional(),
    author: z.string().optional(),
    year: z.string().optional(),
  }).optional(),
  paragraphs: z.array(z.object({
    head: z.string().max(40, { message: 'SchemaQA-11: LONGTEXT-1 paragraphs[].head は 40字以内 (推奨 20字)' }).optional(),
    body: z.string().min(40, { message: 'SchemaQA-11: LONGTEXT-1 paragraphs[].body は 40字以上 (短すぎると LIST 系を使うべき)' })
                    .max(500, { message: 'SchemaQA-11: LONGTEXT-1 paragraphs[].body は 500字以内 (推奨 80-300字)' }),
  })).min(1).max(4),
});

// ───────────────────────────────────────────────────────
// Category C: SCHEDULE / FLOW
// ───────────────────────────────────────────────────────

/** PROJECT-1 フェーズフロー */
const PROJECT1 = SlideBaseSchema.extend({
  template_id: z.literal('PROJECT-1'),
  //       それでも吸収しきれない上限を Zod で fatal に。
  phases: z.array(z.object({
    name: z.string().max(12, { message: 'SchemaQA-11: PROJECT-1 phases[].name (ヘッダ) は 12 字以内' }),
    title: z.string().max(20, { message: 'SchemaQA-11: PROJECT-1 phases[].title は 20 字以内 (5 列なら 12 字推奨)' }).optional(),
    body: z.string().max(200, { message: 'SchemaQA-11 v10.1.2: PROJECT-1 phases[].body は 200字以内 (5 列なら 80字、3 列なら 160字推奨 / 旧 140字)' }).optional(),
    output: z.string().max(35, { message: 'SchemaQA-11: PROJECT-1 phases[].output は 35 字以内 (5 列なら 18 字推奨)' }).optional(),
    time: z.string().max(15, { message: 'SchemaQA-11: PROJECT-1 phases[].time は 15 字以内' }).optional(),
  }).passthrough()).min(2).max(5, { message: 'SchemaQA-11: PROJECT-1 phases は 5 個まで (6 個以上は列幅が極端に狭くなり破綻)' }),
});

/** PROJECT-2 スケジュール (ガント) */
const PROJECT2 = SlideBaseSchema.extend({
  template_id: z.literal('PROJECT-2'),
  monthly_label: z.string().optional(),
  months: z.array(z.string()).min(1),
  rows: z.array(z.object({
    label: z.string(),
    barStart: z.number().optional(),
    barSpan: z.number().optional(),
    barText: z.string().optional(),
    milestones: z.array(z.unknown()).optional(),
    phases: z.array(z.unknown()).optional(),
  }).passthrough()).min(1),
});

/** PROJECT-3 スケジュール 5 トラック */
const PROJECT3 = SlideBaseSchema.extend({
  template_id: z.literal('PROJECT-3'),
  monthly_label: z.string().optional(),
  months: z.array(z.string()).min(1),
  rows: z.array(z.object({
    label: z.string(),
  }).passthrough()).min(1),
});

/** PROJECT-4 スケジュール 2 層トラック (親 → 子) */
const PROJECT4 = SlideBaseSchema.extend({
  template_id: z.literal('PROJECT-4'),
  months: z.array(z.string()).min(1),
  groups: z.array(z.object({
    label: z.string(),
  }).passthrough()).min(1),
});

// ───────────────────────────────────────────────────────
// Category D: NUMBER / EVIDENCE
// ───────────────────────────────────────────────────────

/** DATA-3 数字 + グラフ */
const DATA3 = SlideBaseSchema.extend({
  template_id: z.literal('DATA-3'),
  hero: z.object({
    value: z.string(),
    unit: z.string().optional(),
  }).passthrough(),
  breakdown: z.array(z.object({
    label: z.string(),
    value: z.union([z.string(), z.number()]),
  })).optional(),
});

/** VISUAL-1 プロフィール */
const VISUAL1 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-1'),
  person: z.object({
    name: z.string(),
    role: z.string().optional(),
    company: z.string().optional(),
    bio: z.string().optional(),
    age: z.union([z.string(), z.number()]).optional(),
    name_kana: z.string().optional(),
    photo_path: z.string().optional(),
  }).passthrough(),
  strengths: z.array(z.object({
    title: z.string(),
    body: z.string().optional(),
  })).optional(),
  logos: z.array(z.object({ label: z.string() }).passthrough()).optional(),
  logos_label: z.string().optional(),
});

/** VISUAL-2 エビデンス + 結論 */
const VISUAL2 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-2'),
  // conclusion.title / body / tone を読む (帯グラフ + 結論カード)
  evidence: z.object({
    label: z.string().optional(),
    items: z.array(z.object({
      name: z.string(),
      ratio: z.number().min(0).max(1),
      accent: z.boolean().optional(),
    })).min(1),
  }),
  conclusion: z.object({
    title: z.string(),
    body: z.string().optional(),
    tone: z.enum(['amber', 'brand']).optional(),
  }),
});

// ───────────────────────────────────────────────────────
// Category E: TILE
// ───────────────────────────────────────────────────────

const TileItem = z.object({
  title: z.string(),
  body: z.string().optional(),
}).passthrough();

const LIST5 = SlideBaseSchema.extend({
  template_id: z.literal('LIST-5'),
  tiles: z.array(TileItem).length(4),
});

const LIST6 = SlideBaseSchema.extend({
  template_id: z.literal('LIST-6'),
  tiles: z.array(TileItem).length(6),
});

const LIST7 = SlideBaseSchema.extend({
  template_id: z.literal('LIST-7'),
  tiles: z.array(TileItem).length(9),
});

// ───────────────────────────────────────────────────────
// Category F: VISUAL
// ───────────────────────────────────────────────────────

/** VISUAL-3 ビジュアル主体 */
const VISUAL3 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-3'),
  caption: z.string().optional(),
  image_path: z.string().optional(),
  placeholder_label: z.string().optional(),
});
// 理由: 実利用デッキで使用例が無く、ナビ自動化は他テンプレで代替可能。

/** VISUAL-4 イメージカード 2x2 */
const VISUAL4 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-4'),
  cards: z.array(z.object({
    title: z.string(),
  }).passthrough()).length(4),
});

/** VISUAL-5 左画像 + 右テキスト */
const VISUAL5 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-5'),
  image_path: z.string().optional(),
  image_label: z.string().optional(),
  bullets: z.array(z.object({
    head: z.string(),
    body: z.string(),
  })).optional(),
});

/** VISUAL-6 フルビジュアル */
const VISUAL6 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-6'),
  image_path: z.string().optional(),
  overlay_title: z.string().optional(),
  overlay_sub: z.string().optional(),
});

/** LIST-9 アイコン 3 カラム */
const LIST9 = SlideBaseSchema.extend({
  template_id: z.literal('LIST-9'),
  cols: z.array(z.object({
    title: z.string(),
    icon: z.string().optional(),
    body: z.string().optional(),
    color: z.string().optional(),
  })).length(3),
});

// ───────────────────────────────────────────────────────
// Category G: DIAGRAM Templates (DIAGRAM-1〜25)
// ───────────────────────────────────────────────────────

/** DIAGRAM-1 マトリクス図 (2x2) — quadrants は dict (今回事故元 3) */
const Quadrant = z.object({
  label: z.string(),
  body: z.string().optional(),
});
const DIAGRAM1 = SlideBaseSchema.extend({
  template_id: z.literal('DIAGRAM-1'),
  x_axis: z.object({ low: z.string(), high: z.string() }),
  y_axis: z.object({ low: z.string(), high: z.string() }),
  quadrants: z.object({
    tl: Quadrant,
    tr: Quadrant,
    bl: Quadrant,
    br: Quadrant,
  }),
});
/** DIAGRAM-2 フロー図 */
const DIAGRAM2 = SlideBaseSchema.extend({
  template_id: z.literal('DIAGRAM-2'),
  steps: z.array(z.object({ label: z.string() }).passthrough()).min(2).max(7),
});

/** DIAGRAM-5 サイクル図 (v11.5 新規) — DIAG-02 ラッパー */
const DIAGRAM5 = SlideBaseSchema.extend({
  template_id: z.literal('DIAGRAM-5'),
  title: z.string(),
  subtitle: SubCopySchema,
  center_label: z.string().optional(),
  nodes: z.array(z.object({
    label: z.string(),
    sub: z.string().optional(),
    body: z.string().optional(),
    pos: z.enum(['tl', 'tr', 'br', 'bl']).optional(),
    color: z.string().optional(),
  }).passthrough()).length(4),
});

/** DIAGRAM-6 ピラミッド図 (v11.5 新規) — DIAG-05 ラッパー */
const DIAGRAM6 = SlideBaseSchema.extend({
  template_id: z.literal('DIAGRAM-6'),
  title: z.string(),
  subtitle: SubCopySchema,
  layers: z.array(z.object({
    label: z.string(),
    body: z.string().optional(),
  })).min(2).max(5),
});

/** DIAGRAM-7 ステップアップ図 (v11.5 新規) — DIAG-03 ラッパー */
const DIAGRAM7 = SlideBaseSchema.extend({
  template_id: z.literal('DIAGRAM-7'),
  title: z.string(),
  subtitle: SubCopySchema,
  steps: z.array(z.object({
    label: z.string(),
    body: z.string().optional(),
  })).min(3).max(5),
});
/** LIST-10 縦長アジェンダ (v11.6 新規) */
const LIST10 = SlideBaseSchema.extend({
  template_id: z.literal('LIST-10'),
  title: z.string(),
  subtitle: SubCopySchema,
  items: z.array(z.object({
    n: z.string().optional(),
    head: z.string(),
    body: z.string().optional(),
    status: z.enum(['todo', 'doing', 'done']).optional(),
  })).min(3).max(8),
});

/** COMPARE-7 Pros/Cons 3 選択肢並列 (v11.6 新規) */
const COMPARE7 = SlideBaseSchema.extend({
  template_id: z.literal('COMPARE-7'),
  title: z.string(),
  subtitle: SubCopySchema,
  options: z.array(z.object({
    title: z.string(),
    pros: z.array(z.string()).optional(),
    cons: z.array(z.string()).optional(),
  })).min(2).max(4),
});

/** SECTION-7 サブセクション扉 (v11.6 新規) */
const SECTION7 = SlideBaseSchema.extend({
  template_id: z.literal('SECTION-7'),
  number: z.string().optional(),
  title: z.string(),
  subtitle: SubCopySchema,
  parent_title: z.string().optional(),
});

/** FRAMING-6 期待値整理 Goal/Non-Goal (v11.6 新規) */
const FRAMING6 = SlideBaseSchema.extend({
  template_id: z.literal('FRAMING-6'),
  title: z.string().optional(),
  subtitle: SubCopySchema,
  goals: z.array(z.string()).min(2).max(5),
  non_goals: z.array(z.string()).min(2).max(5),
});

/** DATA-7 タイムスタンプログ (v11.6 新規) */
const DATA7 = SlideBaseSchema.extend({
  template_id: z.literal('DATA-7'),
  title: z.string(),
  subtitle: SubCopySchema,
  entries: z.array(z.object({
    time: z.string(),
    event: z.string(),
    detail: z.string().optional(),
    severity: z.enum(['info', 'warn', 'error']).optional(),
  })).min(2).max(10),
});
/** PROJECT-5 マイルストーン年表 (v11.7 新規) — DIAG-06 ラッパー */
const PROJECT5 = SlideBaseSchema.extend({
  template_id: z.literal('PROJECT-5'),
  title: z.string(),
  subtitle: SubCopySchema,
  events: z.array(z.object({
    date: z.string(),
    label: z.string(),
    body: z.string().optional(),
  })).min(2).max(7),
});

/** PROJECT-6 カンバン風 3 カラム (v11.7 新規) */
const PROJECT6 = SlideBaseSchema.extend({
  template_id: z.literal('PROJECT-6'),
  title: z.string(),
  subtitle: SubCopySchema,
  todo:  z.array(z.union([z.string(), z.object({ text: z.string() }).passthrough()])).max(5).optional(),
  doing: z.array(z.union([z.string(), z.object({ text: z.string() }).passthrough()])).max(5).optional(),
  done:  z.array(z.union([z.string(), z.object({ text: z.string() }).passthrough()])).max(5).optional(),
});

/** CODE-10 Diff 表示 (v11.7 新規) */
const CODE_10 = SlideBaseSchema.extend({
  template_id: z.literal('CODE-10'),
  title: z.string(),
  subtitle: SubCopySchema,
  code: z.object({
    lang: z.string(),
    file: z.string().optional(),
    lines: z.array(z.object({
      kind: z.enum(['add', 'del', 'context']).optional(),
      text: z.string(),
    })).min(1),
  }),
  code_caption: z.string().optional(),
});




// ───────────────────────────────────────────────────────
// Category J: CHART (CHART-A1〜83)
// ───────────────────────────────────────────────────────
//   chart.template_id を見て対応する CHART-XX schema で検証
const { ChartSchemaRegistry } = require('../charts');
const ChartAnnotation = z.object({
  kind: z.enum(['callout', 'box', 'arrow_label']).optional(),
  x: z.number(),
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
  text: z.string(),
  color: z.string().optional(),  // 'brand' / 'accent' / 'ink' / hex
  anchor: z.object({ x: z.number(), y: z.number() }).optional(),  // arrow_label 用
});

const ChartUnknown = z.preprocess(
  (val) => val,
  z.unknown(),
).superRefine((val, ctx) => {
  if (!val || typeof val !== 'object') {
    ctx.addIssue({ code: 'custom', message: 'chart は object であるべき' });
    return;
  }
  const tid = val.template_id;
  if (typeof tid !== 'string' || !ChartSchemaRegistry[tid]) {
    ctx.addIssue({
      code: 'custom',
      message: `chart.template_id が ChartSchemaRegistry に未登録 (got: ${JSON.stringify(tid)})`,
    });
    return;
  }
  const result = ChartSchemaRegistry[tid].safeParse(val);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({
        code: 'custom',
        path: issue.path,
        message: `chart[${tid}] ${issue.message}`,
      });
    }
  }
});

/** CHART-A1 チャート単体 */
const CHART_A1 = SlideBaseSchema.extend({
  template_id: z.literal('CHART-A1'),
  chart: ChartUnknown,
  chart_caption: z.string().optional(),
  annotations: z.array(ChartAnnotation).optional(),
});

/** CHART-A2 チャート + テキスト */
const CHART_A2 = SlideBaseSchema.extend({
  template_id: z.literal('CHART-A2'),
  chart: ChartUnknown,
  chart_caption: z.string().optional(),
  insights: z.array(z.object({
    headline: z.string(),
    body: z.string().optional(),
  })).min(1),
});

/** CHART-A3 チャート + 3 カラム */
const CHART_A3 = SlideBaseSchema.extend({
  template_id: z.literal('CHART-A3'),
  chart: ChartUnknown,
  chart_caption: z.string().optional(),
  comments: z.array(z.object({
    label: z.string(),
    body: z.string(),
  })).length(3),
});

/** CHART-A4 チャート 2 つ並列 */
const CHART_A4 = SlideBaseSchema.extend({
  template_id: z.literal('CHART-A4'),
  chart_top: ChartUnknown,
  chart_bottom: ChartUnknown,
  chart_caption: z.string().optional(),
  layout: z.enum(['horizontal', 'vertical']).optional(),
  annotations: z.array(ChartAnnotation).optional(),
});

/** CHART-A6 KPI ダッシュボード (v11.7 新規) */
const CHART_A6 = SlideBaseSchema.extend({
  template_id: z.literal('CHART-A6'),
  title: z.string(),
  subtitle: SubCopySchema,
  kpis: z.array(z.object({
    label: z.string(),
    value: z.string(),
    unit: z.string().optional(),
    delta: z.string().optional(),
    delta_dir: z.enum(['up', 'down', 'flat']).optional(),
  })).min(2).max(4),
  chart: ChartUnknown.optional(),
  chart_caption: z.string().optional(),
});
// 理由: 実利用デッキで使用例が無く、Drive 動画埋め込みは VISUAL-3 で代替可能。

// ───────────────────────────────────────────────────────
// Category L: 縦カード (LIST-4), Compact B/A (COMPARE-2)
// ───────────────────────────────────────────────────────

/** LIST-4 縦カード積み */
const LIST4 = SlideBaseSchema.extend({
  template_id: z.literal('LIST-4'),
  cards: z.array(z.object({
    n: z.string(),
    stripe: StripeColor.optional(),
    title: z.string(),
    body: z.string(),
  })).min(2).max(5),
});

/** COMPARE-2 コンパクト Before/After */
const COMPARE2 = SlideBaseSchema.extend({
  template_id: z.literal('COMPARE-2'),
  items: z.array(z.object({
    before: z.string(),
    after: z.string(),
  })).min(2),
});

// ───────────────────────────────────────────────────────
// Category M: 序盤/締め固定枠 (FRAMING-1〜46)
// ───────────────────────────────────────────────────────

/** FRAMING-1 構築背景 — 3 ブロック必須 */
const FRAMING1 = SlideBaseSchema.extend({
  template_id: z.literal('FRAMING-1'),
  block_kikkake: z.string().min(1),
  block_kizuki: z.string().min(1),
  block_gimon: z.string().min(1),
});

/** FRAMING-2 Before/After リスト */
const FRAMING2 = SlideBaseSchema.extend({
  template_id: z.literal('FRAMING-2'),
  items: z.array(z.object({
    // SchemaQA-11: カラム幅と矢印領域に収まる字数上限
    before: z.string().max(38, { message: 'SchemaQA-11: FRAMING-2 items[].before は 38字以内 (推奨 30字)' }),
    after: z.string().max(35, { message: 'SchemaQA-11: FRAMING-2 items[].after は 35字以内 (推奨 28字)' }),
    n: z.string().optional(),
  })).min(4).max(6),
});

/** FRAMING-3 会社紹介 */
const FRAMING3 = SlideBaseSchema.extend({
  template_id: z.literal('FRAMING-3'),
  headline: z.string().optional(),
  subcopy: z.string().optional(),
  hp_qr_url: z.string().optional(),
  awards: z.array(z.object({}).passthrough()).optional(),
  products: z.array(z.object({}).passthrough()).optional(),
  corp: z.array(z.tuple([z.string(), z.string()])).optional(),
});

/** FRAMING-4 お土産 */
const FRAMING4 = SlideBaseSchema.extend({
  template_id: z.literal('FRAMING-4'),
  omiyage: z.object({
    category: z.string(),
    icon: z.string(),
    title: z.string(),
    body: z.string(),
    scene: z.string().optional(),
  }),
});

// ───────────────────────────────────────────────────────
// Category N: 章挿絵 / 用語集 / グラレコ (SECSUMMARY-1, 48, 84)
// ───────────────────────────────────────────────────────

/**
 *
 * 章扉直後に必ず 1 枚配置する「章の見取り図」。
 *
 * v9.4 確定仕様: 「主役ビジュアル一発のみの full-bleed SVG-only テンプレ」
 *   - 画面 (10" × 5.625") の 100% を SVG が占有する
 *   - SVG 内に章タイトル / サブ / 全章 chips / 結論バーを描かない (主役ビジュアル単体)
 *   - テンプレも chrome (header / footer / left strip / page number) を描かない
 *   - section_no / section_title / one_line は書いても無視される (Phase 2 のヒント情報)
 *
 *   - svg / svg_file のいずれかを **必須** (.refine で fatal)
 *   - image_path / diagram / scene を渡したら fatal (SVG 主役強制)
 *
 * 互換: build-deck.js が plan.json の template_id "DIAGRAM-4" を
 * "SECSUMMARY-1" にエイリアス変換 (warn ログ出力)。
 */
const SECSUMMARY1 = SlideBaseSchema.extend({
  template_id: z.literal('SECSUMMARY-1'),
  // 以下 3 つはレンダリングには使わない (Phase 2 で SVG 設計時のヒント / speaker notes 用)
  section_no: z.string().optional(),
  section_title: z.string().optional(),
  one_line: z.string().optional(),
  placeholder_label: z.string().optional(),  // draft 段階のフォールバック表示 (svg 未指定時)
  svg: z.string().optional(),       // SVG 文字列を直接渡す
  svg_file: z.string().optional(),  // SVG ファイルパス (plan.json と同階層基準)
}).refine(
  d => Boolean(d.svg || d.svg_file),
  { message: 'SchemaQA-03: svg または svg_file のいずれかが必須 (SECSUMMARY-1 は full-bleed SVG-only テンプレ)' },
).refine(
  // SchemaQA-03b v10.4.0 (2026-05-11) — placeholder SVG 検出 fatal
  //
  // 背景: 2026-05-11 の osanai 氏セッションで、Claude が SECSUMMARY-1 の svg を
  //   Python f-string で 5 章分一気に量産し、灰色背景 + 章番号だけの placeholder
  //   SVG (「※ Phase 3 直前に enostech-svg-diagram で本物に差し替えます」マーカー入り)
  //   で plan.json を組み、ユーザーに「A: placeholder のまま完成 / B: 本物に差し替え」
  //   の選択肢として提示してしまった事故が発生。
  //
  //   CLAUDE.md C-15 で「Python ヘルパーで量産禁止」「enostech-svg-diagram で 1 枚ずつ
  //   手書き」が宣言されているが、宣言だけでは Claude が忘れる構造になっていた。
  //   v10.4.0 で機械強制ガードを追加し、placeholder マーカーを含む SVG が build 段階で
  //   fatal される構造にした。
  //
  // 検出パターン (英日混在の典型 placeholder マーカー):
  //   - "placeholder" / "PLACEHOLDER" (英語マーカー)
  //   - "差し替え" (日本語マーカー、「本物に差し替えます」等)
  //   - "TODO" / "WIP" (一般的な未完了マーカー)
  //   - "後で書く" / "後で差し替え" (日本語の延期マーカー)
  //   - "Phase N 直前に" / "Phase N で本物に" (差し替え予告マーカー)
  //   - "本見取り図は ... 差し替えます"
  //
  // 設計判断:
  //   - svg_file 経由は別ルートでチェック (svg_file の中身は build 時に展開されるので
  //     ここでは検出不可。svg_file の中身は別途 svg-schema-qa.py に通す運用)
  //   - svg を直接埋めた場合のみ refine で検出 (実害が最も大きい経路)
  //   - opt-out は提供しない (placeholder で本番完成する正当な理由が無い)
  d => {
    if (!d.svg) return true;  // svg_file 経由は別ルート
    const PLACEHOLDER_RE = /placeholder|差し替え(ます|る|ました)?|TODO|WIP|後で書く|後で差し替え|Phase\s*\d+\s*直前に|Phase\s*\d+\s*で本物に|本見取り図は.*差し替え/i;
    return !PLACEHOLDER_RE.test(d.svg);
  },
  {
    message: 'SchemaQA-03b v10.4.0: SECSUMMARY-1 の svg に placeholder マーカー (placeholder / 差し替え / TODO / WIP / 後で書く / Phase N 直前) が含まれています。CLAUDE.md C-15 に従い、enostech-svg-diagram スキルを invoke して本物の SVG を 1 枚ずつ手書きしてください (Python ヘルパーで量産禁止)。'
  },
);

/** VISUAL-8 グラレコサマリー (optional テンプレ) */
const VISUAL8 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-8'),
  image_path: z.string(),
  caption: z.string().optional(),
  eyebrow: z.string().optional(),
  placeholder_label: z.string().optional(),
});

// ───────────────────────────────────────────────────────
// Category O: FlowChart / 章末まとめ / リファレンス画像 (DIAGRAM-3, 86, 87)
// ───────────────────────────────────────────────────────

/** DIAGRAM-3 FlowChart 専用 */
const DIAGRAM3 = SlideBaseSchema.extend({
  template_id: z.literal('DIAGRAM-3'),
  diagram: z.object({}).passthrough(),
  caption: z.string().optional(),
  reading_path: z.string().optional(),
  source_data: z.unknown().optional(),
  section_idx: z.number().int().optional(),
});
/** VISUAL-7 リファレンス画像 */
const VISUAL7 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-7'),
  ref_num: z.number().int(),
  title: z.string(),
  subtitle: SubCopySchema,
  image_path: z.string(),
  source_url: z.string().url(),
  caption: z.string().optional(),
  source: z.string().optional(),
  year: z.string().optional(),
  article_url: z.string().optional(),
  fetch_status: z.string().optional(),
  fetch_reason: z.string().nullable().optional(),
});

// ───────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────

/** DATA-10 WEBPAGE-1 単独URL解説 */
const WEBPAGE1 = SlideBaseSchema.extend({
  template_id: z.literal('WEBPAGE-1'),
  title: z.string(),
  subtitle: SubCopySchema,
  image_path: z.string().optional(),
  site_name: z.string().optional(),
  source: z.string().optional(),
  article_url: z.string().url().optional(),
  source_url: z.string().url().optional(),
  date: z.string().optional(),
  year: z.string().optional(),
  caption: z.string().optional(),
  fetch_status: z.string().optional(),
  fetch_reason: z.string().nullable().optional(),
});

/** DATA-11 WEBPAGE-2 関連URLカードグリッド */
const WEBPAGE2 = SlideBaseSchema.extend({
  template_id: z.literal('WEBPAGE-2'),
  title: z.string(),
  subtitle: SubCopySchema,
  items: z.array(z.object({
    site_name: z.string().optional(),
    article_title: z.string(),
    summary: z.string().optional(),
    image_path: z.string().optional(),
    article_url: z.string().url().optional(),
    featured: z.boolean().optional(),
  })).min(3).max(6),
});

/** DATA-12 WEBPAGE-3 1記事詳細解説 */
const WEBPAGE3 = SlideBaseSchema.extend({
  template_id: z.literal('WEBPAGE-3'),
  title: z.string(),
  subtitle: SubCopySchema,
  image_path: z.string().optional(),
  site_name: z.string().optional(),
  article_url: z.string().url().optional(),
  date: z.string().optional(),
  year: z.string().optional(),
  blocks: z.array(z.object({
    head: z.string().max(20, { message: 'WEBPAGE-3 blocks[].head は 20 字以内' }),
    body: z.string(),
  })).min(2).max(3),
});

/** DATA-13 WEBPAGE-4 複数記事の論点比較 */
const WEBPAGE4 = SlideBaseSchema.extend({
  template_id: z.literal('WEBPAGE-4'),
  title: z.string(),
  subtitle: SubCopySchema,
  row_labels: z.array(z.string()).min(0).max(3).optional(),
  articles: z.array(z.object({
    site_name: z.string().optional(),
    article_title: z.string(),
    image_path: z.string().optional(),
    article_url: z.string().url().optional(),
    cells: z.array(z.string()).min(1).max(3),
  })).min(2).max(3),
});


// ───────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────

const CodePayload = z.object({
  lang: z.string(),  // 'bash' | 'js' | 'py' | 'json' | 'yaml' | 'sql' 等の自由文字列
  body: z.string(),
  label: z.string().optional(),
  file: z.string().optional(),
});

/** CODE-1 単一スニペット主役 */
const CODE_1 = SlideBaseSchema.extend({
  template_id: z.literal('CODE-1'),
  title: z.string(),
  subtitle: SubCopySchema,
  code: CodePayload,
  code_caption: z.string().optional(),
});

/** CODE-2 左コード+右説明 */
const CODE_2 = SlideBaseSchema.extend({
  template_id: z.literal('CODE-2'),
  title: z.string(),
  subtitle: SubCopySchema,
  code: CodePayload,
  points: z.array(z.object({
    head: z.string().max(28, { message: 'CODE-2 points[].head は 28 字以内' }),
    body: z.string().max(120, { message: 'CODE-2 points[].body は 120 字以内' }),
  })).min(2).max(4),
});

/** CODE-3 上コード+下3カラム */
const CODE_3 = SlideBaseSchema.extend({
  template_id: z.literal('CODE-3'),
  title: z.string(),
  subtitle: SubCopySchema,
  code: CodePayload,
  comments: z.array(z.object({
    label: z.string().max(16, { message: 'CODE-3 comments[].label は 16 字以内' }),
    body: z.string().max(120, { message: 'CODE-3 comments[].body は 120 字以内' }),
  })).length(3),
});

/** CODE-4 Before/After 2 コード並列 */
const CODE_4 = SlideBaseSchema.extend({
  template_id: z.literal('CODE-4'),
  title: z.string(),
  subtitle: SubCopySchema,
  before: CodePayload,
  after: CodePayload,
});

/** CODE-5 ステップ実行 (3 段) */
const CODE_5 = SlideBaseSchema.extend({
  template_id: z.literal('CODE-5'),
  title: z.string(),
  subtitle: SubCopySchema,
  steps: z.array(z.object({
    num: z.string().optional(),
    title: z.string().max(40, { message: 'CODE-5 steps[].title は 40 字以内' }),
    code: CodePayload,
    note: z.string().optional(),
  })).min(2).max(4),
});

/** CODE-6 ターミナル風 */
const CODE_6 = SlideBaseSchema.extend({
  template_id: z.literal('CODE-6'),
  title: z.string(),
  subtitle: SubCopySchema,
  terminal: z.object({
    prompt: z.string().optional(),
    file: z.string().optional(),
    lines: z.array(z.object({
      kind: z.enum(['cmd', 'out', 'comment']),
      text: z.string(),
    })).min(1),
  }),
});

/**
 * CODE-7 ディレクトリツリー
 * tree -L 風表示。各ノードは {name, comment?, highlight?, children?} の再帰構造。
 * ディレクトリは name 末尾を '/' で。highlight=true で 1 ノードを brand 強調できる
 * (R-SVG-14 の最強調 1 箇所と同じ思想)。
 */
const TreeNode = z.lazy(() => z.object({
  name: z.string(),
  comment: z.string().optional(),
  highlight: z.boolean().optional(),
  children: z.array(TreeNode).optional(),
}));
const CODE_7 = SlideBaseSchema.extend({
  template_id: z.literal('CODE-7'),
  title: z.string(),
  subtitle: SubCopySchema,
  tree: z.object({
    file: z.string().optional(),  // ヘッダーに出すラベル (default は root.name)
    root: TreeNode,
  }),
  caption: z.string().optional(),
});

// ───────────────────────────────────────────────────────
// Category Z: FREE-1 自由レイアウト
// ───────────────────────────────────────────────────────

const FREE1 = SlideBaseSchema.extend({
  template_id: z.literal('FREE-1'),
  free_layout: z.object({
    skip_title_block: z.boolean().optional(),
    shapes: z.array(z.object({}).passthrough()).optional(),
  }).passthrough().optional(),
});

// ───────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────
// Category P: VISUAL ハイブリッド
// ───────────────────────────────────────────────────────

/** VISUAL-9 SVG + 番号付きカード 4 行 */
const VISUAL9 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-9'),
  title: z.string(),
  subtitle: SubCopySchema,
  // SVG 経路 (preprocessSvgIllustrations が image_path に変換)
  svg: z.string().optional(),
  svg_file: z.string().optional(),
  image_path: z.string().optional(),
  placeholder_label: z.string().optional(),
  items: z.array(z.object({
    num: z.string().optional(),
    title: z.string(),
    body: z.string().optional(),
  })).min(2).max(5),
});

/** VISUAL-10 横3コマSVG + ステップ説明 */
const VISUAL10 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-10'),
  title: z.string(),
  subtitle: SubCopySchema,
  steps: z.array(z.object({
    badge: z.string().optional(),
    title: z.string(),
    body: z.string().optional(),
    svg: z.string().optional(),
    svg_file: z.string().optional(),
    image_path: z.string().optional(),
    placeholder_label: z.string().optional(),
  })).length(3),
  footer_note: z.object({
    label: z.string().optional(),
    text: z.string(),
  }).optional(),
});

/** VISUAL-11 上SVG + 下3カード */
const VISUAL11 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-11'),
  title: z.string(),
  subtitle: SubCopySchema,
  svg: z.string().optional(),
  svg_file: z.string().optional(),
  image_path: z.string().optional(),
  placeholder_label: z.string().optional(),
  cards: z.array(z.object({
    eyebrow: z.string().optional(),
    title: z.string(),
    body: z.string().optional(),
  })).length(3),
});

/** VISUAL-12 左右SVG2連 + フッター */
const VISUAL12 = SlideBaseSchema.extend({
  template_id: z.literal('VISUAL-12'),
  title: z.string(),
  subtitle: SubCopySchema,
  panes: z.array(z.object({
    eyebrow: z.string().optional(),
    title: z.string(),
    body: z.string().optional(),
    svg: z.string().optional(),
    svg_file: z.string().optional(),
    image_path: z.string().optional(),
    placeholder_label: z.string().optional(),
  })).length(2),
  footer_note: z.object({
    label: z.string().optional(),
    text: z.string(),
  }).optional(),
});

/** FRAMING-5 チェックリスト + マインドセットカード
 *
 *   - title は plan.json 側で省略可能 (テンプレ側で section_id から「N 章のポイント」を自動生成)。
 *     互換のため title 指定があっても受理するが、テンプレ render 時に上書きされ警告される。
 *   - items は 3-8 件で柔軟化。
 *     件数に応じてフォントサイズ・行高・チェックボックスサイズを auto-fit。
 *   - mindset.title は ですます調必須 (WritingQA-19 で機械検査)。
 */
const FRAMING5 = SlideBaseSchema.extend({
  template_id: z.literal('FRAMING-5'),
  title: z.string().optional(),
  subtitle: SubCopySchema,
  items: z.array(z.string()).min(3).max(8),
  mindset: z.object({
    eyebrow: z.string().optional(),
    title: z.string(),
    points: z.array(z.string()).optional(),
  }),
  footnote: z.string().optional(),
});

/** COMPARE-5 グルーピング付き比較表 */
const COMPARE5 = SlideBaseSchema.extend({
  template_id: z.literal('COMPARE-5'),
  title: z.string(),
  subtitle: SubCopySchema,
  groups: z.array(z.object({
    name: z.string(),
    color: z.string().optional(),
    cols: z.array(z.string()).min(1),
  })).min(1),
  items: z.array(z.string()).min(1),
  matrix: z.array(z.array(z.string())).min(1),
});

/** COMPARE-6 テキスト補足比較表 */
const COMPARE6 = SlideBaseSchema.extend({
  template_id: z.literal('COMPARE-6'),
  title: z.string(),
  subtitle: SubCopySchema,
  cols: z.array(z.string()).min(2).max(4),
  items: z.array(z.object({
    name: z.string(),
    cells: z.array(z.object({
      mark: z.string(),
      text: z.string().optional(),
    })).min(1),
  })).min(1),
});

// ───────────────────────────────────────────────────────
// Category Q: QA
// ───────────────────────────────────────────────────────

/**
 * QA-INDEX 解決したい疑問・懸念の早見表
 *
 * doc.questions[] を参照して 1 問 1 答インデックスをレンダリング。
 * questions 自体の検査 (件数 / id 形式 / kind enum 等) は
 * StructQA-50/51 (lib/structure-qa.js) で行うため、ここでは
 * テンプレ固有の表示用 override フィールドだけを定義する。
 */
const QA_INDEX = SlideBaseSchema.extend({
  template_id: z.literal('QA-INDEX'),
  title: z.string().optional(),     // default: '解決したい疑問・懸念'
  subtitle: SubCopySchema,  // default: 'このデッキを読み終えると、N つの疑問が解消されます'
  // 各 Q の表示用 override (sectionLabel を上書きしたい時に使う)
  questions_overrides: z.array(z.object({
    id: z.string().regex(/^Q\d+$/),
    sectionLabel: z.string().optional(),
  })).optional(),
});

// レジストリ: template_id → schema
// ───────────────────────────────────────────────────────

const TemplateSchemaRegistry = {
  'SECTION-1':  SECTION1,    // alias
  'SECTION-1A': SECTION1A,   // Twilight Forge シンプル版
  'SECTION-1B': SECTION1B,   // エディトリアル分割 (左画像 + 右テキスト)
  'SECTION-1D': SECTION1D,   // ミニマル・タイポグラフィ
  'SECTION-1F': SECTION1F,   // 引用主導
  'SECTION-1G': SECTION1G,   // full-bleed SVG only
  'SECTION-2': SECTION2,
  'LIST-1': LIST1,
  'COMPARE-1': COMPARE1,
  'LIST-2': LIST2,
  'LIST-3': LIST3,
  'LIST-8': LIST8,
  'SECTION-3': SECTION3,
  'DATA-1': DATA1,
  'PROJECT-1': PROJECT1,
  'PROJECT-2': PROJECT2,
  'DATA-2': DATA2,
  'DATA-3': DATA3,
  'VISUAL-1': VISUAL1,
  'VISUAL-2': VISUAL2,
  'LIST-5': LIST5,
  'LIST-6': LIST6,
  'LIST-7': LIST7,
  'VISUAL-3': VISUAL3,
  'DIAGRAM-1': DIAGRAM1,
  'DIAGRAM-2': DIAGRAM2,
  'DIAGRAM-5': DIAGRAM5,
  'DIAGRAM-6': DIAGRAM6,
  'DIAGRAM-7': DIAGRAM7,
  'LIST-10': LIST10,
  'COMPARE-7': COMPARE7,
  'SECTION-7': SECTION7,
  'FRAMING-6': FRAMING6,
  'DATA-7': DATA7,
  'PROJECT-5': PROJECT5,
  'PROJECT-6': PROJECT6,
  'CHART-A6': CHART_A6,
  'CODE-10': CODE_10,
  'VISUAL-4': VISUAL4,
  'VISUAL-5': VISUAL5,
  'VISUAL-6': VISUAL6,
  'LIST-9': LIST9,
  'DATA-4': DATA4,
  'COMPARE-3': COMPARE3,
  'COMPARE-4': COMPARE4,
  'SECTION-4': SECTION4,
  'SECTION-5': SECTION5,
  'PROJECT-3': PROJECT3,
  'PROJECT-4': PROJECT4,
  'LIST-4': LIST4,
  'COMPARE-2': COMPARE2,
  'FRAMING-1': FRAMING1,
  'FRAMING-2': FRAMING2,
  'FRAMING-3': FRAMING3,
  'FRAMING-4': FRAMING4,
  'SECSUMMARY-1': SECSUMMARY1,
  'DATA-5': DATA5,
  'SECTION-6': SECTION6,
  'CHART-A1': CHART_A1,
  'CHART-A2': CHART_A2,
  'CHART-A3': CHART_A3,
  'CHART-A4': CHART_A4,
  'VISUAL-8': VISUAL8,
  'DIAGRAM-3': DIAGRAM3,
  'VISUAL-7': VISUAL7,
  'WEBPAGE-1': WEBPAGE1,
  'WEBPAGE-2': WEBPAGE2,
  'WEBPAGE-3': WEBPAGE3,
  'WEBPAGE-4': WEBPAGE4,
  'VISUAL-9': VISUAL9,
  'VISUAL-10': VISUAL10,
  'VISUAL-11': VISUAL11,
  'VISUAL-12': VISUAL12,
  'FRAMING-5': FRAMING5,
  'COMPARE-5': COMPARE5,
  'COMPARE-6': COMPARE6,
  'CODE-1': CODE_1,
  'CODE-2': CODE_2,
  'CODE-3': CODE_3,
  'CODE-4': CODE_4,
  'CODE-5': CODE_5,
  'CODE-6': CODE_6,
  'CODE-7': CODE_7,
  'FREE-1': FREE1,
  'LONGTEXT-1': LONGTEXT1,
  'QA-INDEX': QA_INDEX,
};

module.exports = {
  ...Object.fromEntries(
    Object.entries(TemplateSchemaRegistry).map(([k, v]) => [k.replace('-', '_'), v])
  ),
  TemplateSchemaRegistry,
};
