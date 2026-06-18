'use strict';

// ==========================================================================
//  render-html.js — RENDER phase wrapper
// --------------------------------------------------------------------------
//  HtmlReportDto (zod 検証済み) → 完成 HTML 文字列。
//  純粋関数: 同じ DTO を渡せば必ず同じ HTML を返します。
//  fs / network / Date.now / Math.random / グローバル変数の使用なし。
// ==========================================================================

const { renderReport } = require('../templates/html-report/render');

/**
 * @param {object} dto  HtmlReportSchema 準拠 (zod.parse 後)
 * @returns {{ html: string, widgetCount: number, widgetTypes: string[], thumbCount: number, thumbBytes: number }}
 */
function renderHtmlReport(dto) {
  return renderReport(dto);
}

module.exports = { renderHtmlReport };
