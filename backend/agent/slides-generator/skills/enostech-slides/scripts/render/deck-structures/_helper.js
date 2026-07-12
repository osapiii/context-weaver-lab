/**
 * deck-structures/_helper.js
 * ===========================
 *
 * 役割:
 *   - `defineDeckStructure(spec)` — Declarative spec から Zod schema を build する factory。
 *   - 各種ルール関数 (`countGlossaryTerms` / `getAllSlides` 等) を export。
 *   - 個々の deckStructure (learning-deck.js / news-summary.js / ...) は
 *     この helper の `defineDeckStructure` を呼ぶだけで動く想定。
 *
 * 設計方針: `01_design.md §A-1` の「案 3 (Hybrid: Declarative spec → Zod schema)」を採用。
 *   - ユーザー (Claude) は Declarative spec を書く
 *   - Zod schema は本ファイルの factory が組み立てる
 *   - エラー出力は `lib/structure-qa.js::translateToStructQA()` 経由で StructQA-XX に翻訳
 *
 * 関連:
 *   - `references/deck-structures/learning-deck.md` — deckStructure 仕様書
 *   - `references/phase2-information-design/plan-json-v9-structure.md` — plan.json v9.0/v9.2
 *   - `lib/structure-qa.js` — StructureQA の検証エンジン本体
 *
 *   - 本コードの "Template" / `template_id` は「slideTemplate (= 1 スライドの型)」を指す。
 *   - デッキ全体の構造定義は "deckStructure" と呼ぶ (旧称: deck structure template)。
 *   - 内部 var 名 (slideRuleToZod / SlideObjShape の `template_id`) は slideTemplate 側
 *     を指しているのでそのまま維持し、混同しないこと。
 */

'use strict';

const { z } = require('zod');

// ───────────────────────────────────────────────────────
// 共通ユーティリティ
// ───────────────────────────────────────────────────────

/**
 *   header → body.chapters[i].(head + content + tail) → footer
 *
 * @returns {Array<object>} 全スライド (1 次元配列)
 */
function getAllSlides(deckJson) {
  if (!deckJson || typeof deckJson !== 'object') return [];
  const out = [];
  for (const sl of (deckJson.header || [])) out.push(sl);
  const chapters = (deckJson.body && deckJson.body.chapters) || [];
  for (const ch of chapters) {
    for (const sl of (ch.head || []))    out.push(sl);
    for (const sl of (ch.content || [])) out.push(sl);
    for (const sl of (ch.tail || []))    out.push(sl);
  }
  for (const sl of (deckJson.footer || [])) out.push(sl);
  return out;
}

/**
 * デッキ内の用語数を概算する。
 *   1) `doc.glossary[]` に直接配列がある場合はその length
 *   2) 各スライドの `glossary_candidates[]` の合計
 *
 * `learning-deck` の footer DATA-5 (用語集) 条件付き必須 (>=3) の判定に使う。
 *
 * @param {object} deckJson
 * @returns {number}
 */
function countGlossaryTerms(deckJson) {
  if (!deckJson) return 0;
  const docGlossary = (deckJson.doc && Array.isArray(deckJson.doc.glossary))
    ? deckJson.doc.glossary
    : null;
  if (docGlossary) return docGlossary.length;

  let count = 0;
  for (const sl of getAllSlides(deckJson)) {
    if (Array.isArray(sl.glossary_candidates)) count += sl.glossary_candidates.length;
  }
  return count;
}

/**
 * SlideRule のうち template_id が単一/配列のどちらでも、配列に正規化する。
 */
function normalizeTemplateIds(value) {
  if (Array.isArray(value)) return value.slice();
  if (typeof value === 'string') return [value];
  return [];
}

/**
 * Slide オブジェクトの最低限フィールド検査用の Zod schema。
 *   - slide 内部の SchemaQA は `scripts/render/schemas/templates/index.js` 側が担当。
 *   - StructureQA は構造 (順序 / 必須 / 章数 / 総数) のみ責務とし、
 *     ここでは「template_id が string」という最低限の保証だけを置く。
 */
const SlideObjShape = z.object({
  template_id: z.string().min(1),
}).passthrough();

// ───────────────────────────────────────────────────────
// SlideRule → Zod schema
// ───────────────────────────────────────────────────────

/**
 * SlideRule (1 スライドの規約) を Zod schema に変換する。
 *   spec.template_id: string | string[]
 *   spec.required:    boolean
 *   spec.fields:      任意の追加フィールド検査 (浅い対応のみ)
 *
 * @param {object} rule
 * @returns {z.ZodType}
 */
function slideRuleToZod(rule) {
  const tids = normalizeTemplateIds(rule.template_id);
  if (tids.length === 0) return SlideObjShape;
  return SlideObjShape.refine(
    (sl) => tids.includes(sl.template_id),
    {
      message: rule.message || `template_id が ${tids.join(' / ')} のいずれかである必要があります`,
    }
  );
}

// ───────────────────────────────────────────────────────
// Chapter schema
// ───────────────────────────────────────────────────────

/**
 * `body.chapters[i]` の Zod schema を作る。
 *   spec.body.head[]    — 章頭固定枠 (扉 + 見取り図)
 *   spec.body.content   — 章本文 (count.min/max)
 *   spec.body.tail[]    — 章末固定枠 (FRAMING-5 等)
 */
function chapterRuleToZod(spec) {
  const headSchemas = (spec.body.head || []).map(slideRuleToZod);
  const tailSchemas = (spec.body.tail || []).map(slideRuleToZod);
  const contentMin = (spec.body.content && spec.body.content.count && spec.body.content.count.min) ?? 0;
  const contentMax = (spec.body.content && spec.body.content.count && spec.body.content.count.max) ?? 999;

  // head / tail は固定枠なので、長さは template 既定値と同じが正
  const headExpected = headSchemas.length;
  const tailExpected = tailSchemas.length;

  return z.object({
    id:   z.string().min(1, { message: 'StructQA-03: chapter.id は必須' }),
    code: z.string().min(1).max(2, { message: 'StructQA-03: chapter.code は 1-2 文字' }),
    name: z.string().min(1).max(40, { message: 'StructQA-03: chapter.name は 1-40 文字' }),

    head: z.array(SlideObjShape)
      .min(headExpected, { message: `StructQA-03: chapter.head は ${headExpected} 枚必須` })
      .max(headExpected, { message: `StructQA-03: chapter.head は ${headExpected} 枚まで` }),

    content: z.array(SlideObjShape)
      .min(contentMin, { message: `StructQA-05: chapter.content は ${contentMin} 枚以上` })
      .max(contentMax, { message: `StructQA-05: chapter.content は ${contentMax} 枚以下` }),

    tail: z.array(SlideObjShape)
      .min(tailExpected, {
        message: tailExpected === 0
          ? 'StructQA-03: chapter.tail は空配列必須 (= 章末まとめなしの Template)'
          : `StructQA-13: chapter.tail は ${tailExpected} 枚必須`,
      })
      .max(tailExpected, {
        message: tailExpected === 0
          ? 'StructQA-03: chapter.tail は空配列必須 (= 章末まとめなしの Template、tail に何も入れないこと)'
          : `StructQA-13: chapter.tail は ${tailExpected} 枚まで`,
      }),
  }).superRefine((ch, ctx) => {
    // head の各位置で template_id を照合
    headSchemas.forEach((schema, i) => {
      const sl = ch.head[i];
      if (!sl) return;
      const r = schema.safeParse(sl);
      if (!r.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['head', i, 'template_id'],
          message: spec.body.head[i].message
            || `StructQA-12: chapter.head[${i}] が Template と不一致 (期待: ${normalizeTemplateIds(spec.body.head[i].template_id).join(' / ')})`,
        });
      }
    });
    // tail の各位置で template_id を照合
    tailSchemas.forEach((schema, i) => {
      const sl = ch.tail[i];
      if (!sl) return;
      const r = schema.safeParse(sl);
      if (!r.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tail', i, 'template_id'],
          message: spec.body.tail[i].message
            || `StructQA-13: chapter.tail[${i}] が Template と不一致 (期待: ${normalizeTemplateIds(spec.body.tail[i].template_id).join(' / ')})`,
        });
      }
    });
  });
}

// ───────────────────────────────────────────────────────
// Header / Footer schema
// ───────────────────────────────────────────────────────

/**
 * Header の Zod schema。
 *   - 必須スライド (required: true) は順序通り照合
 *   - 任意スライド (required: false) は header 末尾に位置することを期待
 */
function headerRuleToZod(headerSpec) {
  const requiredCount = headerSpec.filter(r => r.required).length;
  const optionalCount = headerSpec.length - requiredCount;
  const minLen = requiredCount;
  const maxLen = requiredCount + optionalCount;

  return z.array(SlideObjShape)
    .min(minLen, { message: `StructQA-01: header は ${minLen} 枚以上必須` })
    .max(maxLen, { message: `StructQA-01: header は ${maxLen} 枚まで` })
    .superRefine((arr, ctx) => {
      headerSpec.forEach((rule, i) => {
        if (i >= arr.length) {
          if (rule.required) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [i],
              message: rule.message || `StructQA-01: header[${i}] が不足 (期待 template_id: ${normalizeTemplateIds(rule.template_id).join(' / ')})`,
            });
          }
          return;
        }
        const tids = normalizeTemplateIds(rule.template_id);
        const sl = arr[i];
        if (!tids.includes(sl.template_id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, 'template_id'],
            message: rule.message
              || `StructQA-01: header[${i}] template_id="${sl.template_id}" が不一致 (期待: ${tids.join(' / ')})`,
          });
        }
      });
    });
}

/**
 * Footer の Zod schema。
 *   - footer は順序より「必須スライドが含まれているか」を優先検査する。
 *   - 任意スライド (SECTION-3 / DATA-5) は省略可。
 */
function footerRuleToZod(footerSpec) {
  return z.array(SlideObjShape)
    .min(1, { message: 'StructQA-02: footer は最低 1 枚必須' })
    .superRefine((arr, ctx) => {
      // 必須スライドが含まれているかチェック
      const tidsInFooter = arr.map(s => s.template_id);
      footerSpec.forEach((rule, i) => {
        if (!rule.required) return;  // 任意 / 条件付きは別検査
        const required_tids = normalizeTemplateIds(rule.template_id);
        const found = required_tids.some(t => tidsInFooter.includes(t));
        if (!found) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [],
            message: rule.message
              || `StructQA-02: footer に ${required_tids.join(' / ')} が含まれていません`,
          });
        }
      });
    });
}

// ───────────────────────────────────────────────────────
// defineDeckStructure
// ───────────────────────────────────────────────────────

/**
 * Declarative spec から Deck 構造 Template を組み立てる。
 *
 * spec の形:
 *   {
 *     id: 'learning-deck',
 *     version: '1.0',
 *     description: '...',
 *     header: [SlideRule, ...],
 *     body: {
 *       count: { min: number, max: number },
 *       head: [SlideRule, ...],
 *       content: { count: { min, max }, allowedTemplates: 'any' | string[] },
 *       tail: [SlideRule, ...],
 *     },
 *     footer: [SlideRule, ...],
 *     volumeConstraints: { totalSlides: { min, max }, ... },
 *     globalConstraints: { totalSlides, requiredTags[], maxTags[] },
 *     structureRules: [...]  // 任意の補助ルール
 *   }
 *
 * 戻り値:
 *   {
 *     spec: 元の spec (参照用)
 *     schema: deck 全体の Zod schema
 *     headerSchema / chapterSchema / footerSchema: 個別 schema
 *     id / version / description: メタ
 *   }
 *
 * @param {object} spec
 * @returns {object}
 */
function defineDeckStructure(spec) {
  if (!spec || !spec.id || !spec.version) {
    throw new Error('[defineDeckStructure] spec.id と spec.version は必須');
  }

  const headerSchema = headerRuleToZod(spec.header || []);
  const chapterSchema = chapterRuleToZod(spec);
  const footerSchema = footerRuleToZod(spec.footer || []);

  const chapterMin = (spec.body.count && spec.body.count.min) ?? 1;
  const chapterMax = (spec.body.count && spec.body.count.max) ?? 99;
  const totalMin = (spec.volumeConstraints && spec.volumeConstraints.totalSlides && spec.volumeConstraints.totalSlides.min)
    ?? (spec.globalConstraints && spec.globalConstraints.totalSlides && spec.globalConstraints.totalSlides.min)
    ?? 1;
  const totalMax = (spec.volumeConstraints && spec.volumeConstraints.totalSlides && spec.volumeConstraints.totalSlides.max)
    ?? (spec.globalConstraints && spec.globalConstraints.totalSlides && spec.globalConstraints.totalSlides.max)
    ?? 999;

  // ────── デッキ全体 schema ──────
  // strict() で未知トップレベルキー (sections 等) を fatal にする
  //
  const deckSchema = z.object({
    doc: z.object({
      deck_structure: z.literal(spec.id, {
        message: `StructQA-00: doc.deck_structure は "${spec.id}" でなければなりません`,
      }),
      deck_structure_version: z.string().regex(/^\d+\.\d+$/, {
        message: 'StructQA-00: deck_structure_version は "X.Y" 形式',
      }).optional(),
    }).passthrough(),

    header: headerSchema,

    body: z.object({
      chapters: z.array(chapterSchema)
        .min(chapterMin, { message: `StructQA-04: 章数が下限 ${chapterMin} 未満` })
        .max(chapterMax, { message: `StructQA-04: 章数が上限 ${chapterMax} 超過` }),
    }),

    footer: footerSchema,

    qa_report: z.any().optional(),
    reviews: z.any().optional(),
  }).passthrough()
    .superRefine((deckJson, ctx) => {
      // ───── StructQA-06: デッキ総スライド数 ─────
      const total = getAllSlides(deckJson).length;
      // volumeConstraints.totalSlides で上書きされていれば優先
      const overrideMin = deckJson.doc && deckJson.doc.volumeConstraints
        && deckJson.doc.volumeConstraints.totalSlides
        && deckJson.doc.volumeConstraints.totalSlides.min;
      const overrideMax = deckJson.doc && deckJson.doc.volumeConstraints
        && deckJson.doc.volumeConstraints.totalSlides
        && deckJson.doc.volumeConstraints.totalSlides.max;
      const minTotal = overrideMin ?? totalMin;
      const maxTotal = overrideMax ?? totalMax;
      if (total < minTotal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['_deck'],
          message: `StructQA-06: デッキ総スライド数 ${total} 枚が下限 ${minTotal} 未満`,
        });
      }
      if (total > maxTotal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['_deck'],
          message: `StructQA-06: デッキ総スライド数 ${total} 枚が上限 ${maxTotal} 超過`,
        });
      }

      // ───── globalConstraints.requiredTags (StructQA-21 等) ─────
      const requiredTags = (spec.globalConstraints && spec.globalConstraints.requiredTags) || [];
      for (const tagSpec of requiredTags) {
        // appliesIf による skip
        if (typeof tagSpec.appliesIf === 'function' && !tagSpec.appliesIf(deckJson)) continue;
        const allSl = getAllSlides(deckJson);
        const matchTids = tagSpec.templates || [];
        const nestedTids = tagSpec.nestedDiagrams || [];
        const found = allSl.some(sl => {
          if (matchTids.includes(sl.template_id)) return true;
          for (const k of ['diagram', 'scene']) {
            const nested = sl[k];
            if (nested && nestedTids.includes(nested.template_id)) return true;
          }
          return false;
        });
        if (!found) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['_deck', tagSpec.tag || 'tag'],
            message: tagSpec.message
              || `${tagSpec.rule || 'StructQA-21'}: ${tagSpec.tag} スライド (${[...matchTids, ...nestedTids].join(' / ')}) が 1 枚以上必須`,
          });
        }
      }

      // ───── globalConstraints.maxTags (StructQA-22 等) ─────
      const maxTags = (spec.globalConstraints && spec.globalConstraints.maxTags) || [];
      for (const tagSpec of maxTags) {
        const allSl = getAllSlides(deckJson);
        const targetIds = tagSpec.nestedDiagrams || [];
        let count = 0;
        for (const sl of allSl) {
          for (const k of ['diagram', 'scene']) {
            const nested = sl[k];
            if (nested && targetIds.includes(nested.template_id)) {
              count++;
            }
          }
          if (targetIds.includes(sl.template_id)) count++;
        }
        if (count > (tagSpec.max || 1)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['_deck', tagSpec.tag || 'tag'],
            message: tagSpec.message
              || `${tagSpec.rule || 'StructQA-22'}: ${tagSpec.tag} (${targetIds.join(' / ')}) は ${tagSpec.max} 枚まで (${count} 枚検出)`,
          });
        }
      }

      // ───── footer DATA-5 条件付き必須 (StructQA-02) ─────
      const footerSpecArr = spec.footer || [];
      for (const rule of footerSpecArr) {
        if (!rule.conditional || typeof rule.conditional.if !== 'function') continue;
        if (rule.conditional.if(deckJson)) {
          const required_tids = normalizeTemplateIds(rule.template_id);
          const tidsInFooter = (deckJson.footer || []).map(s => s.template_id);
          const found = required_tids.some(t => tidsInFooter.includes(t));
          if (!found) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['footer'],
              message: rule.conditional.message
                || `StructQA-02: 条件付き必須スライド ${required_tids.join(' / ')} が footer に存在しません`,
            });
          }
        }
      }
    });

  return {
    spec,
    schema: deckSchema,
    headerSchema,
    chapterSchema,
    footerSchema,
    id: spec.id,
    version: spec.version,
    description: spec.description,
    // doc.qa_driven 未指定時に lib/structure-qa.js が deckStructure 別 default を適用する。
    qa_driven_default: spec.qa_driven_default ?? false,
  };
}

module.exports = {
  defineDeckStructure,
  getAllSlides,
  countGlossaryTerms,
  normalizeTemplateIds,
  // 内部 helper も export (テスト用 / structure-qa.js から参照)
  slideRuleToZod,
  chapterRuleToZod,
  headerRuleToZod,
  footerRuleToZod,
};
