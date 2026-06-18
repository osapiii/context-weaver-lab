/**
 * Diagram (DIAG-02〜09) Zod スキーマ集約
 * =====================================
 * scripts/render/diagrams/diag-XX-*.js が期待する diagramJson 形式を Zod 定義。
 * SECSUMMARY-1 / DIAGRAM-3 等で diagram フィールドにネストされる時に validate される。
 */
'use strict';
const { z } = require('zod');

// DIAG-02 サイクル図 (4 ノード)
const DIAG_02 = z.object({
  template_id: z.literal('DIAG-02'),
  center_label: z.string().optional(),
  nodes: z.array(z.object({
    label: z.string(),
    body: z.string().optional(),
  })).length(4),
}).passthrough();

// DIAG-03 ステップアップ図
const DIAG_03 = z.object({
  template_id: z.literal('DIAG-03'),
  steps: z.array(z.object({
    label: z.string(),
    body: z.string().optional(),
  })).min(2).max(5),
}).passthrough();

// DIAG-04 Before/After 比較
const DIAG_04 = z.object({
  template_id: z.literal('DIAG-04'),
  before: z.object({ label: z.string(), body: z.string().optional() }),
  after: z.object({ label: z.string(), body: z.string().optional() }),
}).passthrough();

// DIAG-05 ピラミッド (今回事故元 4: tiers ではなく layers)
const DIAG_05 = z.object({
  template_id: z.literal('DIAG-05'),
  title: z.string().optional(),
  layers: z.array(z.object({
    label: z.string(),
    body: z.string().optional(),
  })).min(2).max(5),
}).passthrough();

// DIAG-06 タイムライン
const DIAG_06 = z.object({
  template_id: z.literal('DIAG-06'),
  events: z.array(z.object({
    date: z.string(),
    label: z.string(),
    body: z.string().optional(),
  })).min(2),
}).passthrough();

// DIAG-07 放射図
const DIAG_07 = z.object({
  template_id: z.literal('DIAG-07'),
  center: z.object({ label: z.string() }).passthrough(),
  spokes: z.array(z.object({
    label: z.string(),
    body: z.string().optional(),
    sub: z.string().optional(),
  })).min(3).max(8),
}).passthrough();

// DIAG-08 2x2 マトリクス
const DIAG_08 = z.object({
  template_id: z.literal('DIAG-08'),
  x_axis: z.object({ low: z.string(), high: z.string() }),
  y_axis: z.object({ low: z.string(), high: z.string() }),
  quadrants: z.object({
    tl: z.object({ label: z.string(), body: z.string().optional() }),
    tr: z.object({ label: z.string(), body: z.string().optional() }),
    bl: z.object({ label: z.string(), body: z.string().optional() }),
    br: z.object({ label: z.string(), body: z.string().optional() }),
  }),
}).passthrough();

// DIAG-09 2 軸プロット
const DIAG_09 = z.object({
  template_id: z.literal('DIAG-09'),
  x_axis: z.object({}).passthrough(),
  y_axis: z.object({}).passthrough(),
  items: z.array(z.object({
    label: z.string(),
    x: z.union([z.number(), z.string()]),
    y: z.union([z.number(), z.string()]),
  })).min(1),
}).passthrough();

const DiagramSchemaRegistry = {
  'DIAG-02': DIAG_02,
  'DIAG-03': DIAG_03,
  'DIAG-04': DIAG_04,
  'DIAG-05': DIAG_05,
  'DIAG-06': DIAG_06,
  'DIAG-07': DIAG_07,
  'DIAG-08': DIAG_08,
  'DIAG-09': DIAG_09,
};

module.exports = {
  DIAG_02, DIAG_03, DIAG_04, DIAG_05, DIAG_06, DIAG_07, DIAG_08, DIAG_09,
  DiagramSchemaRegistry,
};
