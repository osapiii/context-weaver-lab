/**
 * braindump.json schema (v12.0)
 * ==============================
 * Phase 1.8 の SSOT (Single Source of Truth) を Zod で機械強制する。
 * v12.0: $schema を 'braindump-v12' に bump, deck.deck_structure を required に昇格。
 *
 * 仕様は ../../../../outputs/v11.2-braindump-json/schema.md を参照
 * (skill リポジトリ内では references/qa/braindump-structure-qa.md に対応版あり)。
 *
 * 公開 API:
 *   - braindumpSchema             (= module.exports)
 *   - validate(json) -> {ok: true, data} | {ok: false, errors: [...]}
 *
 * CLI:
 *   node scripts/render/schemas/braindump.js <path-to-braindump.json>
 *   exit 0 / 2
 *
 * zod は package.json に既に入っている。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { z } = require('zod');

// ───────────────────────────────────────────────────────
// 基本片
// ───────────────────────────────────────────────────────

const SchemaTag = z.string().regex(
  /^braindump-v12(?:\.\d+)?$/,
  { message: '$schema は "braindump-v12" もしくは "braindump-v12.x" 固定' },
);

const DeckSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, { message: 'slug は [a-z0-9-]+ のみ' }),
  deck_type: z.enum(['learning', 'proposal', 'report', 'catalog']),
  deck_structure: z.string().min(1, { message: 'deck_structure 必須 (例: learning-deck)' }),
  deck_mode: z.enum(['template', 'free']).optional(),
  qa_driven: z.boolean().default(true),
  target_reader: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'date は ISO 8601 (YYYY-MM-DD)' }),
});

const RefImageSchema = z.object({
  enabled: z.boolean().optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
}).partial().optional();

const ReferenceSchema = z.object({
  n: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().regex(/^https?:\/\//, { message: 'url は http(s) 必須' }),
  medium: z.string().optional().default(''),
  retrieved_at: z.string().optional().default(''),
  image: RefImageSchema,
});

const QuestionSchema = z.object({
  id: z.string().regex(/^Q\d+(?:\.\d+)?$/, { message: 'id は Q\\d+ もしくは Q\\d+\\.\\d+ (例: Q1, Q2.5)' }),
  text: z.string().min(1),
  kind: z.string().optional().default('other'),
  answer_short: z.string().optional().default(''),
  answer_section_idx: z.number().int().nonnegative().optional(),
  related_refs: z.array(z.number().int().positive()).optional().default([]),
});

// blocks (polymorphic)
const ParaBlock = z.object({
  type: z.literal('para'),
  text: z.string(),
});
const HeadingBlock = z.object({
  type: z.literal('heading'),
  level: z.number().int().min(2).max(4),
  text: z.string(),
});
const TableBlock = z.object({
  type: z.literal('table'),
  caption: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});
const ListBlock = z.object({
  type: z.literal('list'),
  ordered: z.boolean().optional().default(false),
  items: z.array(z.string()),
});
const CodeBlock = z.object({
  type: z.literal('code'),
  lang: z.string().optional(),
  text: z.string(),
});
const QuoteBlock = z.object({
  type: z.literal('quote'),
  text: z.string(),
});

const BlockSchema = z.union([
  ParaBlock, HeadingBlock, TableBlock, ListBlock, CodeBlock, QuoteBlock,
]);

const AnswerSchema = z.object({
  id: z.string().optional(),
  question_id: z.string().regex(/^Q\d+(?:\.\d+)?$/),
  visual: z.enum(['required', 'optional', 'none']),
  visual_kind: z.string().optional(),
  visual_path: z.string().optional(),
  visual_alt: z.string().optional(),
  visual_caption: z.string().optional(),
  section_title: z.string().optional(),
  blocks: z.array(BlockSchema).min(1, { message: 'blocks は 1 件以上' }),
  citations_used: z.array(z.number().int().positive()).optional().default([]),
});

const ExtrasSchema = z.object({
  framing_1_background: z.string().optional(),
  framing_2_before_after: z.string().optional(),
  framing_3_takeaway: z.string().optional(),
  framing_4_callout: z.string().optional(),
}).partial().optional();

const MetaSchema = z.object({
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  schema_version: z.string().optional().default('11.2'),
  writer_notes: z.string().optional(),
});

const braindumpSchema = z.object({
  $schema: SchemaTag,
  deck: DeckSchema,
  references: z.array(ReferenceSchema).optional().default([]),
  questions: z.array(QuestionSchema).optional().default([]),
  answers: z.array(AnswerSchema).optional().default([]),
  extras: ExtrasSchema,
  meta: MetaSchema,
}).superRefine((data, ctx) => {
  // references.n の連番チェック
  if (data.references && data.references.length) {
    const nums = data.references.map(r => r.n).sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['references'],
          message: `references[].n は 1..N 連番、欠番禁止 (got: ${nums.join(',')})`,
        });
        break;
      }
    }
  }

  if (data.deck && data.deck.qa_driven === false) return; // skip qa checks

  const refNs = new Set((data.references || []).map(r => r.n));
  // questions.related_refs ⊆ references.n
  (data.questions || []).forEach((q, qi) => {
    (q.related_refs || []).forEach((rn) => {
      if (!refNs.has(rn)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['questions', qi, 'related_refs'],
          message: `${q.id}: related_refs [${rn}] が references[] に未登録`,
        });
      }
    });
  });

  // answers.question_id ⊆ questions.id
  const qIds = new Set((data.questions || []).map(q => q.id));
  (data.answers || []).forEach((a, ai) => {
    if (!qIds.has(a.question_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answers', ai, 'question_id'],
        message: `answers[${ai}].question_id=${a.question_id} が questions[] に存在しない`,
      });
    }
  });

  // len(answers) == len(questions) (qa_driven 時)
  if ((data.questions || []).length !== (data.answers || []).length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['answers'],
      message: `len(questions)=${(data.questions || []).length} と len(answers)=${(data.answers || []).length} が不一致`,
    });
  }

  // citations_used ⊆ references.n
  (data.answers || []).forEach((a, ai) => {
    (a.citations_used || []).forEach((rn) => {
      if (!refNs.has(rn)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answers', ai, 'citations_used'],
          message: `${a.question_id}: citations_used [${rn}] が references[] に未登録`,
        });
      }
    });
  });
});

// ───────────────────────────────────────────────────────
// public helpers
// ───────────────────────────────────────────────────────

function validate(json) {
  const r = braindumpSchema.safeParse(json);
  if (r.success) return { ok: true, data: r.data };
  return {
    ok: false,
    errors: r.error.issues.map(e => ({
      path: e.path.join('.'),
      message: e.message,
      code: e.code,
    })),
  };
}

module.exports = braindumpSchema;
module.exports.braindumpSchema = braindumpSchema;
module.exports.validate = validate;

// ───────────────────────────────────────────────────────
// CLI
// ───────────────────────────────────────────────────────

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node braindump.js <path-to-braindump.json>');
    process.exit(2);
  }
  let raw;
  try {
    raw = fs.readFileSync(target, 'utf8');
  } catch (e) {
    console.error(`[err] cannot read ${target}: ${e.message}`);
    process.exit(2);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error(`[err] invalid JSON: ${e.message}`);
    process.exit(2);
  }
  const r = validate(json);
  if (r.ok) {
    console.log(`[ok] ${target} validates against braindump-v12 schema`);
    process.exit(0);
  }
  console.error(`[fail] ${target} has ${r.errors.length} schema violation(s):`);
  r.errors.forEach((e) => {
    console.error(`  - ${e.path || '(root)'}: ${e.message}`);
  });
  process.exit(2);
}
