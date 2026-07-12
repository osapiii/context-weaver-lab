/**
 * Chart (CHART-01〜09) Zod スキーマ集約
 */
'use strict';
const { z } = require('zod');

const SeriesValues = z.object({
  name: z.string(),
  values: z.array(z.union([z.number(), z.null()])),
  highlight: z.boolean().optional(),
});

// CHART-01 縦棒
const CHART_01 = z.object({
  template_id: z.literal('CHART-01'),
  categories: z.array(z.string()).min(1),
  series: z.array(SeriesValues).min(1),
  y_axis_title: z.string().optional(),
  show_value: z.boolean().optional(),
}).passthrough();

// CHART-02 積み上げ縦棒
const CHART_02 = z.object({
  template_id: z.literal('CHART-02'),
  categories: z.array(z.string()).min(1),
  series: z.array(SeriesValues).min(1),
}).passthrough();

// CHART-03 横棒
const CHART_03 = z.object({
  template_id: z.literal('CHART-03'),
  categories: z.array(z.string()).min(1),
  series: z.array(SeriesValues).min(1),
  show_value: z.boolean().optional(),
}).passthrough();

// CHART-04 折れ線
const CHART_04 = z.object({
  template_id: z.literal('CHART-04'),
  categories: z.array(z.string()).min(1),
  series: z.array(SeriesValues).min(1),
  show_marker: z.boolean().optional(),
}).passthrough();

// CHART-05 棒+線複合
const CHART_05 = z.object({
  template_id: z.literal('CHART-05'),
  categories: z.array(z.string()).min(1),
  bar_series: z.array(SeriesValues).min(1),
  line_series: z.array(SeriesValues).min(1),
  secondary_val_axis: z.boolean().optional(),
}).passthrough();

// CHART-06 ウォーターフォール
const CHART_06 = z.object({
  template_id: z.literal('CHART-06'),
  categories: z.array(z.string()).min(2),
  items: z.array(z.object({
    type: z.enum(['start', 'plus', 'minus', 'end']),
    value: z.number(),
  })).min(2),
}).passthrough();

// CHART-07 ドーナツ
const CHART_07 = z.object({
  template_id: z.literal('CHART-07'),
  items: z.array(z.object({
    name: z.string(),
    value: z.number(),
  })).min(2).max(8),
  title: z.string().optional(),
}).passthrough();

// CHART-08 散布図
const CHART_08 = z.object({
  template_id: z.literal('CHART-08'),
  series: z.array(z.object({
    name: z.string(),
    points: z.array(z.object({
      x: z.number(),
      y: z.number(),
    })).min(1),
  })).min(1),
  x_axis_title: z.string().optional(),
  y_axis_title: z.string().optional(),
}).passthrough();

// CHART-09 レーダー
const CHART_09 = z.object({
  template_id: z.literal('CHART-09'),
  axes: z.array(z.string()).min(3),
  series: z.array(SeriesValues).min(1),
}).passthrough();

const ChartSchemaRegistry = {
  'CHART-01': CHART_01,
  'CHART-02': CHART_02,
  'CHART-03': CHART_03,
  'CHART-04': CHART_04,
  'CHART-05': CHART_05,
  'CHART-06': CHART_06,
  'CHART-07': CHART_07,
  'CHART-08': CHART_08,
  'CHART-09': CHART_09,
};

module.exports = {
  CHART_01, CHART_02, CHART_03, CHART_04, CHART_05,
  CHART_06, CHART_07, CHART_08, CHART_09,
  ChartSchemaRegistry,
};
