/**
 * Scene (SCENE-01〜06) Zod スキーマ集約
 */
'use strict';
const { z } = require('zod');

// SCENE-01 三者関係図
const SCENE_01 = z.object({
  template_id: z.literal('SCENE-01'),
  center: z.object({ label: z.string() }).passthrough(),
  left: z.object({ label: z.string() }).passthrough(),
  right: z.object({ label: z.string() }).passthrough(),
  left_to_center_label: z.string().optional(),
  center_to_right_label: z.string().optional(),
}).passthrough();

// SCENE-02 ハブ&スポーク
const SCENE_02 = z.object({
  template_id: z.literal('SCENE-02'),
  center: z.object({ label: z.string() }).passthrough(),
  spokes: z.array(z.object({
    label: z.string(),
    sub: z.string().optional(),
    featured: z.boolean().optional(),
  })).min(3).max(8),
}).passthrough();

// SCENE-03 ステージ遷移
const SCENE_03 = z.object({
  template_id: z.literal('SCENE-03'),
  stages: z.array(z.object({
    label: z.string(),
    current: z.boolean().optional(),
    body: z.string().optional(),
  })).min(3).max(5),
}).passthrough();

// SCENE-04 ビジネスモデル
const SCENE_04 = z.object({
  template_id: z.literal('SCENE-04'),
  center: z.object({ label: z.string() }).passthrough(),
  actors: z.array(z.object({ label: z.string() }).passthrough()).min(2),
  boundary: z.object({}).passthrough().optional(),
}).passthrough();

// SCENE-05 システム構成
const SCENE_05 = z.object({
  template_id: z.literal('SCENE-05'),
  nodes: z.array(z.object({}).passthrough()).min(2),
  flows: z.array(z.object({}).passthrough()).optional(),
  boundary: z.object({}).passthrough().optional(),
}).passthrough();

// SCENE-06 FlowChart (vertical-decision / horizontal-flow / simple-vertical)
const FlowDir = z.union([
  z.literal('next'),
  z.literal('end'),
  z.object({ side: z.number().int() }),
]);

const SCENE_06 = z.object({
  template_id: z.literal('SCENE-06'),
  layout: z.enum(['vertical-decision', 'horizontal-flow', 'simple-vertical']),
  start: z.object({
    label: z.string().max(28, { message: 'SchemaQA-13: SCENE-06 start.label は 28 字以内' }),
  }).passthrough(),
  // label 文字数: decision は 16 字、process は 18 字を推奨上限
  steps: z.array(z.object({
    kind: z.enum(['decision', 'process']),
    label: z.string().max(20, { message: 'SchemaQA-13: SCENE-06 steps[].label は 20 字以内 (decision 推奨 16 字、process 推奨 18 字)' }),
    yes_to: FlowDir.optional(),
    no_to: FlowDir.optional(),
    next: FlowDir.optional(),
    labelSize: z.number().optional(),
  })).min(1).max(6, { message: 'SchemaQA-13: SCENE-06 steps は 6 個まで (vertical-decision なら 4 個まで)。これ以上は別ページに分割を推奨' }),
  side_results: z.array(z.object({
    label: z.string().max(22, { message: 'SchemaQA-13: SCENE-06 side_results[].label は 22 字以内' }),
    kind: z.string().optional(),
    labelSize: z.number().optional(),
  })).optional(),
  end: z.object({
    label: z.string().max(28, { message: 'SchemaQA-13: SCENE-06 end.label は 28 字以内' }),
    kind: z.string().optional(),
  }),
}).passthrough().refine(
  d => !(d.layout === 'vertical-decision' && Array.isArray(d.steps) && d.steps.length > 4),
  { message: 'SchemaQA-13: vertical-decision の steps は 4 個まで (5 個以上は菱形が縦に潰れる)。別ページに分割するか layout を simple-vertical に変えてください' },
);

const SceneSchemaRegistry = {
  'SCENE-01': SCENE_01,
  'SCENE-02': SCENE_02,
  'SCENE-03': SCENE_03,
  'SCENE-04': SCENE_04,
  'SCENE-05': SCENE_05,
  'SCENE-06': SCENE_06,
};

module.exports = {
  SCENE_01, SCENE_02, SCENE_03, SCENE_04, SCENE_05, SCENE_06,
  SceneSchemaRegistry,
};
