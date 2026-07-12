'use strict';

// ==========================================================================
// --------------------------------------------------------------------------
//  HTML 補足レポートの DTO スキーマ (Zod)。
//
//    - すべてのオブジェクトスキーマを `.strict()` 化、未知キーを拒否
//    - 各スキーマ (Report 全体 + 各 widget) に schemaVersion: '9.11' を追加
//    - props は引き続き `.passthrough()` で柔軟に許容
//
//  パイプライン:
//    plan.json + palette.yml + thumbnails
//      ↓ lib/build-report-dto.js (BUILD phase)
//    decks/<slug>/build/report-dto.json    ← ディスクに固定
//      ↓ JSON.parse + HtmlReportSchema.parse (RENDER phase 入口)
//    HtmlReportDto
//      ↓ lib/render-html.js (templates/html-report/render.js)
//    レポート.html
// ==========================================================================

const z = require('zod');

const SCHEMA_VERSION = '9.11';

// -- 共通 -----------------------------------------------------------------
const HexColor = z.string().regex(/^#?[0-9A-Fa-f]{6}$/, 'HEX color must be 6 hex chars');

// 各 widget 共通フィールド (type / caption / props / schemaVersion)
function widgetEnvelope(typeLiteral, propsSchema) {
  return z.object({
    type: z.literal(typeLiteral),
    schemaVersion: z.literal(SCHEMA_VERSION),
    caption: z.string().optional(),
    props: propsSchema,
  }).strict();
}

// circuit-flow
const CircuitFlowProps = z.object({
  voltageDefault: z.number().default(5),
  resistanceDefault: z.number().default(220),
  voltageMin: z.number().default(1),
  voltageMax: z.number().default(12),
  resistanceMin: z.number().default(50),
  resistanceMax: z.number().default(2000),
  ledForwardVoltage: z.number().default(2.0),
}).passthrough();
const CircuitFlowSchema = widgetEnvelope('circuit-flow', CircuitFlowProps.default({}));

// color-code
const ColorCodeProps = z.object({
  default: z.array(z.string()).optional(),
}).passthrough();
const ColorCodeSchema = widgetEnvelope('color-code', ColorCodeProps.default({}));

// calc-resistance
const CalcResistanceProps = z.object({
  defaults: z.array(z.number()).optional(),
  mode: z.enum(['series', 'parallel', 'both']).default('both'),
}).passthrough();
const CalcResistanceSchema = widgetEnvelope('calc-resistance', CalcResistanceProps.default({}));

// dataflow-pipeline
const DataflowStage = z.object({
  name: z.string(),
  label: z.string(),
  sub: z.string().optional(),
}).passthrough();
const DataflowPipelineProps = z.object({
  stages: z.array(DataflowStage).optional(),
  packetCount: z.number().int().default(5),
}).passthrough();
const DataflowPipelineSchema = widgetEnvelope('dataflow-pipeline', DataflowPipelineProps.default({}));

// medallion-stepper
const MedallionStep = z.object({
  title: z.string(),
  body: z.string(),
  chip: z.string().optional(),
}).passthrough();
const MedallionStepperProps = z.object({
  steps: z.array(MedallionStep).optional(),
  autoplay: z.boolean().default(true),
  intervalMs: z.number().int().default(2800),
}).passthrough();
const MedallionStepperSchema = widgetEnvelope('medallion-stepper', MedallionStepperProps.default({}));

// diff-toggle
const DiffToggleProps = z.object({
  language: z.string().default('text'),
  before: z.string().default(''),
  after: z.string().default(''),
  labels: z.object({ before: z.string(), after: z.string() }).optional(),
  initialView: z.enum(['before', 'diff', 'after']).default('diff'),
}).passthrough();
const DiffToggleSchema = widgetEnvelope('diff-toggle', DiffToggleProps.default({}));

// svg-diagram
const SvgDiagramProps = z.object({
  svg: z.string(),
  maxWidth: z.number().int().optional(),
  ariaLabel: z.string().optional(),
  shadow: z.enum(['none', 'soft', 'medium']).default('soft'),
}).passthrough();
const SvgDiagramSchema = widgetEnvelope('svg-diagram', SvgDiagramProps);

// inline-html
const InlineHtmlProps = z.object({
  html: z.string(),
}).passthrough();
const InlineHtmlSchema = widgetEnvelope('inline-html', InlineHtmlProps);

// 全ウィジェットを discriminated union で
const WidgetSchema = z.discriminatedUnion('type', [
  CircuitFlowSchema,
  ColorCodeSchema,
  CalcResistanceSchema,
  DataflowPipelineSchema,
  MedallionStepperSchema,
  DiffToggleSchema,
  SvgDiagramSchema,
  InlineHtmlSchema,
]);

// -- カード ----------------------------------------------------------------
const TableSchema = z.object({
  caption: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
}).strict();
const ChartSeriesSchema = z.object({
  name: z.string().optional(),
  data: z.array(z.number()),
}).strict();
const ChartSchema = z.object({
  type: z.enum(['bar', 'line', 'pie']).default('bar'),
  title: z.string().optional(),
  labels: z.array(z.union([z.string(), z.number()])),
  series: z.array(ChartSeriesSchema),
}).strict();
const RefSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  note: z.string().optional(),
}).strict();
const ThumbnailSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
  bytes: z.number().int().optional(),
  embedded: z.boolean().default(true),
}).strict().nullable();

const SupplementCardSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  domId: z.string(),
  kind: z.enum(['slide', 'chapter']),
  // 一意位置 (純粋関数の決定論的 ID 生成に使う)
  cardIndex: z.number().int(),
  pageNumber: z.number().int().optional(),
  chapterIdx: z.number().int().optional(),
  bucketLabel: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  kindLabel: z.string().optional(),
  kindClass: z.string().optional(),
  rationale: z.string().optional(),
  showRationale: z.boolean().default(false),
  thumbnail: ThumbnailSchema.default(null),
  contentMd: z.string().optional(),
  tables: z.array(TableSchema).default([]),
  charts: z.array(ChartSchema).default([]),
  widgets: z.array(WidgetSchema).default([]),
  refs: z.array(RefSchema).default([]),
  haystack: z.string().default(''),
  open: z.boolean().default(true),
}).strict();

// -- レポート全体 ----------------------------------------------------------
const PaletteDtoSchema = z.object({
  name: z.string(),
  accent: HexColor,
  accentStrong: HexColor,
  accentMute: HexColor,
  rule: HexColor,
  brand: HexColor.optional(),
}).strict().nullable();

const TocItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  pgno: z.string(),
}).strict();

const DeckMetaSchema = z.object({
  slug: z.string().optional(),
  title: z.string(),
  date: z.string().optional(),
  totalSlides: z.number().int(),
  slideCount: z.number().int(),
  chapterCount: z.number().int(),
  generatedAt: z.string().optional(),
}).strict();

const ReportOptionsSchema = z.object({
  embedThumbnails: z.boolean().default(true),
  thumbnails: z.boolean().default(true),
}).strict();
//   qaDriven=true の時、レポート.html の上部に Q&A セクションが追加される。
//   questions[] は doc.questions[] からコピー、personaQAReviews は reviews[] から
//   review_type='persona-qa-review' のものをフィルタしてコピー。
const QuestionDtoSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.string(),
  provisionalDirection: z.string().optional(),
  shortSummary: z.string().optional(),
  refIndex: z.array(z.string()).optional(),
  sectionIndex: z.array(z.string()).optional(),
}).passthrough();

const PerQuestionFindingDtoSchema = z.object({
  qid: z.string(),
  found: z.string(),
  found_at: z.array(z.string()).default([]),
  clarity: z.string(),
  comment: z.string(),
  suggestion: z.string().optional(),
}).passthrough();

const PersonaQAReviewDtoSchema = z.object({
  cycle_num: z.number().int().optional(),
  persona: z.object({
    avatar: z.string().optional(),
    name: z.string(),
    role: z.string().optional(),
  }).passthrough(),
  per_question_findings: z.array(PerQuestionFindingDtoSchema).default([]),
  summary: z.object({
    fully_answered: z.number().int().nonnegative().default(0),
    partial: z.number().int().nonnegative().default(0),
    not_found: z.number().int().nonnegative().default(0),
    weakest_q: z.string().nullable().optional(),
    overall_comment: z.string().optional(),
  }).passthrough().default({}),
}).passthrough();

const HtmlReportSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  deckMeta: DeckMetaSchema,
  palette: PaletteDtoSchema,
  toc: z.array(TocItemSchema).default([]),
  cards: z.array(SupplementCardSchema).default([]),
  options: ReportOptionsSchema,
  qaDriven: z.boolean().default(false),
  questions: z.array(QuestionDtoSchema).default([]),
  personaQAReviews: z.array(PersonaQAReviewDtoSchema).default([]),
}).strict();

module.exports = {
  SCHEMA_VERSION,
  HtmlReportSchema,
  SupplementCardSchema,
  WidgetSchema,
  PaletteDtoSchema,
  widgetSchemas: {
    'circuit-flow': CircuitFlowSchema,
    'color-code': ColorCodeSchema,
    'calc-resistance': CalcResistanceSchema,
    'dataflow-pipeline': DataflowPipelineSchema,
    'medallion-stepper': MedallionStepperSchema,
    'diff-toggle': DiffToggleSchema,
    'svg-diagram': SvgDiagramSchema,
    'inline-html': InlineHtmlSchema,
  },
};
