/**
 * 共通スキーマ層 — doc / sections / reviews / references / SlideBase
 * ===================================================================
 * Zod ベースの正本スキーマ。
 *
 * 設計思想:
 *   - 各テンプレは SlideBaseSchema を継承して固有フィールドを足す
 *   - validate は render 開始時 + Phase 2 pre-check の 2 段階で効く
 *   - スキーマ未定義のテンプレは validate をスキップ (段階導入のため)
 */

'use strict';

const { z } = require('zod');

// ───────────────────────────────────────────────────────
// 基本断片 (再利用可能)
// ───────────────────────────────────────────────────────

/** slide_goal: 設計指針 2 行 (M6 必須だが本スキーマでは optional 扱い、Jinja 側で warn) */
const SlideGoalSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
}).optional();

/** illustration_decision: 挿絵採否 (M4 必須) */
const IllustrationDecisionSchema = z.object({
  adopt: z.boolean(),
  reason: z.string(),
}).optional();

/** illustration: 採用時のネスト挿絵 (M5 規約) */
const IllustrationSchema = z.object({
  scene: z.string().optional(),
  layout: z.enum(['full-bleed', 'with-title']).optional(),
  ascii_art: z.string().optional(),
  intent: z.string().optional(),
  strength: z.enum(['gentle', 'medium', 'strong']).optional(),
  refine_prompt: z.string().nullable().optional(),
}).optional();

/** ref_table 1 行 */
const RefRowSchema = z.object({
  category: z.string(),
  title: z.string(),
  url: z.string().nullable().optional(),
  source: z.string().optional(),
});

/** detail_blocks 1 ブロック (M1 互換) */
const DetailBlockSchema = z.object({
  heading: z.string().optional(),
  full_width: z.boolean().optional(),
  items: z.array(z.string()).optional(),
  text: z.string().optional(),
}).passthrough();

// ───────────────────────────────────────────────────────
// SubCopy (subtitle) 共通制約 (v12.1, 2026-05-15)
// ───────────────────────────────────────────────────────
//
// 背景:
//   LLM が subtitle (= SubCopy = 主見出し下の副コピー) を 20-50 字程度の短文で出す事故が頻発し、
//   毎回手動で書き足していた. plan.json 生成段階で 100-200 字の constraint を機械強制し、
//   LLM 側に「ちゃんと書け」と要求する.
//
// 設計:
//   - 空文字 / undefined → OK (subtitle 自体がない slide はそのまま通す)
//   - 1-99 字 / 201 字以上 → fatal (LLM に修正を要求)
//   - 100-200 字 → OK
//
// 例外:
//   - SECTION-1 (表紙): タグライン的に短い subtitle を許容したいので、
//     SECTION-1.subtitle は別途 short variant を使う (本スキーマでは制約せず).
//   - LONGTEXT-1: 既に max 200 の独自制約あり. SubCopySchema に合流.
//   - SECTION-1B / 1D / 1F: 既に max 180 / 180 / 120 の独自制約. min 100 を追加して合流.

const SubCopySchema = z.preprocess(
  // 空文字は undefined に正規化 (optional として通過させる)
  v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string()
    .min(100, { message: 'SubCopy (subtitle) は **100字以上** で書いてください. 短すぎると情報量不足です. 100-200字推奨.' })
    .max(200, { message: 'SubCopy (subtitle) は **200字以内** にしてください. 長すぎると改行で UI 崩れの原因になります.' })
    .optional(),
);

// ───────────────────────────────────────────────────────
// QA 駆動モード
// ───────────────────────────────────────────────────────
//
// 位置づけ:
//   ヒアリングを「解決したい疑問・懸念のリスト」に単純化し、
//   そのリスト完全解消をデッキ生成の GOAL に再定義する仕組み。
//   `doc.qa_driven: true` の時のみ有効化される opt-in 機能。
//   詳細ルールは StructureQA-50〜56 (lib/structure-qa.js) で機械強制。

/**
 * 疑問・懸念の型分類:
 *   - definitional: 「○○とは何か」(概念導入)
 *   - comparative:  「A と B の違いは何か」(選択判断)
 *   - decisional:   「○○すべきか」(行動判断)
 *   - how_to:       「○○のやり方は」(手順)
 *   - risk:         「○○の懸念は」(注意点)
 *   - other:        その他
 */
const QuestionKindSchema = z.enum([
  'definitional',
  'comparative',
  'decisional',
  'how_to',
  'risk',
  'other',
]);

/**
 * 1 件の疑問・懸念 (questions[] の要素).
 *
 * Phase 1 必須: id / text / kind / provisionalDirection
 * Phase 2 完了 (phase2_locked: true) 時に追加必須: shortSummary / sectionIndex
 *
 * shortSummary は 30 字上限 (QA-INDEX 早見表に表示する 1 行回答)。
 * sectionIndex はその Q が解消される章/slide の id 配列。
 * refIndex は doc.references[].id への参照配列。
 */
const QuestionSchema = z.object({
  id: z.string().regex(/^Q\d+$/, 'id は Q1, Q2, … の形式'),
  text: z.string().min(10, '疑問文は最低 10 字').max(80, '疑問文は最大 80 字'),
  kind: QuestionKindSchema,
  provisionalDirection: z.string().min(1, 'Phase 1 段階の暫定回答方向性は必須'),
  shortSummary: z.string().max(30, 'shortSummary は最大 30 字 (QA-INDEX 早見表用)').optional(),
  refIndex: z.array(z.string()).optional(),
  sectionIndex: z.array(z.string()).optional(),
}).passthrough();

// ───────────────────────────────────────────────────────
// html_supplement: PPTX のサプリメント
// ───────────────────────────────────────────────────────
//
// 位置づけ:
//   PPTX が SSOT。html_supplement は「PPTX とセットで読む」前提の補足。
//   `enabled: true` のスライド/章だけが build-html-report.js で
//   レポート.html にカード化される。enabled: false (or 未指定) は無視。
//   Phase 2 (情報設計) で Claude が各スライドに対して補足要否を判定する。

const HtmlSupplementChartSchema = z.object({
  type: z.enum(['bar', 'line', 'pie']).optional(),
  title: z.string().optional(),
  labels: z.array(z.union([z.string(), z.number()])).optional(),
  series: z.array(z.object({
    name: z.string().optional(),
    data: z.array(z.number()),
  })).optional(),
}).passthrough();

const HtmlSupplementTableSchema = z.object({
  caption: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number()]))),
}).passthrough();

const HtmlSupplementRefSchema = z.object({
  title: z.string(),
  url: z.string().nullable().optional(),
  note: z.string().optional(),
}).passthrough();

/**
 * html_supplement: スライド/章スコープの補足ブロック。
 * - enabled: true なら build-html-report.js が拾う。false / 未指定はスキップ。
 * - kind: UI バッジに使う分類。任意 (code / data-table / deepdive / reference / chart など)。
 * - reason: 「なぜ補足が必要か」を 1 行で。Claude が判定基準として記録する。
 * - content_md: メイン補足 (Markdown)。# / ## / コードブロック / 表 / 引用 / リスト 対応。
 * - tables / charts / references: 構造化された補足要素。content_md と併用可。
 */
const HtmlSupplementSchema = z.object({
  enabled: z.boolean(),
  kind: z.string().optional(),
  reason: z.string().optional(),
  content_md: z.string().optional(),
  tables: z.array(HtmlSupplementTableSchema).optional(),
  charts: z.array(HtmlSupplementChartSchema).optional(),
  references: z.array(HtmlSupplementRefSchema).optional(),
}).passthrough();

// ───────────────────────────────────────────────────────
// SlideBase: 全テンプレ共通フィールド
// ───────────────────────────────────────────────────────

/**
 * 全テンプレ共通の最低限フィールド。
 * 各テンプレスキーマはこれを extend して固有フィールドを足す。
 */
const SlideBaseSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  title: z.string().optional(),
  // subtitle (SubCopy): 100-200字制約. 詳細は SubCopySchema 定義 (上記).
  // 表紙 (SECTION-1) など独自制約のあるテンプレは各 template で override.
  subtitle: SubCopySchema,
  section_id: z.string().optional(),
  subsection: z.string().nullable().optional(),
  template_name: z.string().optional(),
  template_note: z.string().optional(),
  slide_goal: SlideGoalSchema,
  illustration_decision: IllustrationDecisionSchema,
  illustration: IllustrationSchema,
  ref_table: z.array(RefRowSchema).optional(),
  detail_blocks: z.array(DetailBlockSchema).optional(),
  notes: z.string().optional(),
  tone: z.string().optional(),
  html_supplement: HtmlSupplementSchema.optional(),
  // doc.questions[].id への参照。StructQA-53 (双方向整合) / 54 (孤立 Q ゼロ) で機械検証。
  answers_questions: z.array(z.string()).optional(),
  // SECTION-6 ToC で section_id 不要等の例外あり、許容するため passthrough は各テンプレで設定
});

// ───────────────────────────────────────────────────────
// section / doc / review トップ階層
// ───────────────────────────────────────────────────────

const SectionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  slides: z.array(z.unknown()),  // 各 slide は別途 template_id でディスパッチして検証
});

const ReferenceImageSchema = z.object({
  enabled: z.boolean().optional(),
  source_url: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  rationale: z.string().optional(),
  license_note: z.string().nullable().optional(),
  local_path: z.string().nullable().optional(),
  content_type: z.string().nullable().optional(),
  fetched_at: z.string().nullable().optional(),
  fetch_status: z.string().nullable().optional(),
  fetch_reason: z.string().nullable().optional(),
}).passthrough();

const DocReferenceSchema = z.object({
  num: z.number().int(),
  category: z.string(),
  title: z.string(),
  url: z.string().nullable().optional(),
  source: z.string().optional(),
  year: z.string().optional(),
  note: z.string().nullable().optional(),
  cited_by: z.array(z.string()).optional(),
  image: ReferenceImageSchema.optional(),
}).passthrough();

const DocSchema = z.object({
  title: z.string(),
  version: z.string().optional(),
  date: z.string().optional(),
  theme: z.string().optional(),
  theme_desc: z.string().optional(),
  purpose: z.string().optional(),
  reader: z.string().optional(),
  before_after: z.string().optional(),
  deck_type: z.enum(['learning', 'business', 'report']).optional(),
  decision_focused: z.boolean().optional(),
  summary_required: z.boolean().optional(),
  // QA 駆動モード
  // qa_driven: 明示 opt-in フラグ。未指定時は deckStructure 別 default が適用される (lib/structure-qa.js)。
  qa_driven: z.boolean().optional(),
  // phase2_locked: Phase 2 完了マーカー。true 時に StructQA-52 (shortSummary + sectionIndex 必須) が起動。
  phase2_locked: z.boolean().optional(),
  // questions: 解決したい疑問・懸念のリスト (qa_driven=true 時に必須、StructQA-50 で件数 2-15 を強制)。
  questions: z.array(QuestionSchema).optional(),
  references: z.array(DocReferenceSchema).optional(),
}).passthrough();

const PersonaSchema = z.object({
  avatar: z.string(),
  name: z.string(),
  role: z.string(),
  bio: z.string(),
  traits: z.array(z.object({ label: z.string(), value: z.string() })),
});

const ReviewIssueSchema = z.object({
  id: z.string(),
  priority: z.string(),
  priority_label: z.string(),
  target: z.string(),
  feedback: z.string(),
  action: z.string(),
  diff: z.object({ before: z.string(), after: z.string() }).optional(),
}).passthrough();

const ReviewCycleSchema = z.object({
  cycle_num: z.number().int(),
  cycle_desc: z.string(),
  persona: PersonaSchema,
  summary: z.object({ title: z.string(), stats: z.array(z.string()) }),
  issues: z.array(ReviewIssueSchema),
  final_check: z.object({ title: z.string(), body: z.string() }),
}).passthrough();

// ───────────────────────────────────────────────────────
//
// 既存の slide-by-slide ペルソナレビュー (4 ペルソナ × 4 cycle) と並走する追加サイクル。
// 各ペルソナが「自分の立場で Q ごとに答えを slide から探し、見つかった/分かりやすかったか」
// を per_question_findings[] に記録する。「Q3 が分かりにくかった」のような per-Q FB を生成可能。
// ───────────────────────────────────────────────────────

/** found 値: 答えがスライドから見つかったかどうか */
const FoundLevelSchema = z.enum(['true', 'partial', 'false']);

/** clarity スコア: S=完璧 / A=十分 / B=やや弱 / C=弱 / D=見つからない */
const ClarityScoreSchema = z.enum(['S', 'A', 'B', 'C', 'D']);

/** 1 件の per-question finding */
const PerQuestionFindingSchema = z.object({
  qid: z.string().regex(/^Q\d+$/, 'qid は Q1, Q2, … の形式'),
  found: FoundLevelSchema,
  found_at: z.array(z.string()).default([]),  // ['S5', 'S8'] 等
  clarity: ClarityScoreSchema,
  comment: z.string().min(1, 'ペルソナの所感 (1 文以上)'),
  suggestion: z.string().optional(),
}).passthrough();

/** persona-qa-review サイクル全体 */
const PersonaQAReviewSchema = z.object({
  review_type: z.literal('persona-qa-review'),
  cycle_num: z.number().int(),
  cycle_desc: z.string().optional(),
  persona: PersonaSchema,
  per_question_findings: z.array(PerQuestionFindingSchema),
  summary: z.object({
    fully_answered: z.number().int().nonnegative(),
    partial: z.number().int().nonnegative(),
    not_found: z.number().int().nonnegative(),
    weakest_q: z.string().nullable().optional(),  // 例: 'Q3' (最も弱かった Q の id)
    overall_comment: z.string().optional(),
  }),
}).passthrough();

const PlanSchema = z.object({
  doc: DocSchema,
  sections: z.array(SectionSchema),
  reviews: z.array(ReviewCycleSchema).optional(),
  qa_report: z.unknown().optional(),
}).passthrough();

// ───────────────────────────────────────────────────────
// TemplateValidationError: render 失敗時の共通例外
// ───────────────────────────────────────────────────────

class TemplateValidationError extends Error {
  constructor(templateId, slideId, zodError) {
    const issues = zodError.issues || [];
    const messages = issues.map(i => `  ${i.path.join('.')} → ${i.message} (${i.code})`).join('\n');
    super(`[${templateId}] slide ${slideId} のフィールド検証に失敗:\n${messages}`);
    this.name = 'TemplateValidationError';
    this.templateId = templateId;
    this.slideId = slideId;
    this.zodIssues = issues;
  }

  toReportObject() {
    return {
      template_id: this.templateId,
      slide_id: this.slideId,
      issues: this.zodIssues.map(i => ({
        path: i.path,
        code: i.code,
        message: i.message,
        expected: i.expected,
        received: i.received,
      })),
    };
  }
}

/**
 * テンプレ別 schema で safeParse → 失敗時に TemplateValidationError を投げる共通ヘルパー
 *
 * @param {z.ZodSchema} schema     テンプレの Zod スキーマ
 * @param {object}      slideJson  検証対象の slide JSON
 * @param {string}      templateId 'LIST-1' / 'FRAMING-1' 等の現行テンプレ ID / 'DIAG-XX' / 'SCENE-XX' / 'CHART-XX'
 * @returns {object}               検証済みの slide JSON (parsed.data)
 * @throws  {TemplateValidationError}
 */
function validateSlide(schema, slideJson, templateId) {
  const parsed = schema.safeParse(slideJson);
  if (!parsed.success) {
    throw new TemplateValidationError(templateId, slideJson.id || '?', parsed.error);
  }
  return parsed.data;
}

module.exports = {
  // 断片
  SlideGoalSchema,
  IllustrationDecisionSchema,
  IllustrationSchema,
  RefRowSchema,
  DetailBlockSchema,
  SubCopySchema,
  QuestionKindSchema,
  QuestionSchema,
  HtmlSupplementSchema,
  HtmlSupplementChartSchema,
  HtmlSupplementTableSchema,
  HtmlSupplementRefSchema,
  SlideBaseSchema,
  // 階層
  SectionSchema,
  DocReferenceSchema,
  DocSchema,
  PersonaSchema,
  ReviewIssueSchema,
  ReviewCycleSchema,
  FoundLevelSchema,
  ClarityScoreSchema,
  PerQuestionFindingSchema,
  PersonaQAReviewSchema,
  PlanSchema,
  // ヘルパー
  TemplateValidationError,
  validateSlide,
  // z 自体も再エクスポート (各テンプレで require 1 行で済む)
  z,
};
