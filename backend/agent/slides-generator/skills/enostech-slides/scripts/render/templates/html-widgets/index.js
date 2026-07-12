/* eslint-disable no-console */
// ==========================================================================
//  html-widgets/index.js — ENOSTECH Slides v9.7
// --------------------------------------------------------------------------
//  補足カードに埋め込む「動く挿絵 / インタラクティブ図解」レジストリ。
//
//  各ウィジェットは以下の形を返します:
//    {
//      type: '<id>',                      // plan.json の interactive_widgets[].type
//      CSS: '...',                        // 種別ごとに 1 回だけインライン
//      JS:  '...',                        // 種別ごとに 1 回だけインライン (IIFE 推奨)
//      render(props, id) -> string        // 各インスタンスの HTML
//    }
//
//  ウィジェット側のお作法:
//    - 外部 CDN / フォント / 画像を読み込まない (single-file 維持)
//    - prefers-reduced-motion を尊重 (CSS @media か JS の matchMedia で制御)
//    - インスタンスは class="wgt wgt-<type>" + id="<id>" でスコープ
// ==========================================================================

'use strict';

const circuitFlow = require('./circuit-flow.js');
const colorCode = require('./color-code.js');
const calcResistance = require('./calc-resistance.js');
const dataflowPipeline = require('./dataflow-pipeline.js');
const medallionStepper = require('./medallion-stepper.js');
const diffToggle = require('./diff-toggle.js');
const svgDiagram = require('./svg-diagram.js');
const inlineHtml = require('./inline-html.js');

// 全ウィジェット共通の基底 CSS。最低 1 種類でも使われたら付ける。
const BASE_CSS = `
.wgt { font-family: inherit; }
.wgt-figure { contain: layout style; }
.wgt h4.wgt-h { margin: 0 0 8px; font-size: 13px; color: var(--ink-2, #333); font-weight: 700; }
.wgt-stage { padding: 14px 16px; }
.wgt-controls {
  display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: center;
  padding: 12px 16px; border-top: 1px solid var(--rule, #E5E5E5);
  background: var(--surface-2, #F5F5F5);
}
.wgt-controls label {
  font-size: 12px; color: var(--ink-2, #333);
  display: inline-flex; align-items: center; gap: 8px;
}
.wgt-controls input[type=range] { accent-color: var(--accent, #9212F3); width: 130px; }
.wgt-controls input[type=number] {
  width: 76px; padding: 4px 8px;
  border: 1px solid var(--rule, #E5E5E5); border-radius: 3px; font-size: 12px;
}
.wgt-controls .out {
  font-variant-numeric: tabular-nums; font-weight: 600;
  color: var(--accent-strong, #6A0BB8);
  background: var(--surface, #fff);
  border: 1px solid var(--accent-mute, #F3E9FE);
  border-radius: 3px; padding: 2px 8px; font-size: 12px;
}
`.trim();

const registry = {
  'circuit-flow': circuitFlow,
  'color-code': colorCode,
  'calc-resistance': calcResistance,
  'dataflow-pipeline': dataflowPipeline,
  'medallion-stepper': medallionStepper,
  'diff-toggle': diffToggle,
  'svg-diagram': svgDiagram,
  'inline-html': inlineHtml,
};

// 内部用。build-html-report.js が widgetCSS の先頭に付ける。
registry.__BASE_CSS__ = BASE_CSS;

module.exports = registry;
