'use strict';

// ==========================================================================
//  templates/html-report/render.js — HtmlReportDto → 完成 HTML
// --------------------------------------------------------------------------
//  純粋関数: HtmlReportSchema 準拠の DTO を入力に、副作用なしで HTML 文字列を返します。
//  card.js / widget の集計は戻り値で取得して、ここで reduce マージします。
// ==========================================================================

const { escHtml } = require('../../lib/html-helpers');
// Q&A セクションだけ使うミニマル実行を可能にする。
let widgetRegistry;
try {
  widgetRegistry = require('../html-widgets');
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    widgetRegistry = { __BASE_CSS__: '' };
  } else {
    throw e;
  }
}
const STYLE = require('./style');
const SCRIPT = require('./script');
const { renderCard } = require('./card');

function renderToc(toc) {
  if (!toc || !toc.length) return '';
  const items = toc.map((t) =>
    `<li><a href="#${escHtml(t.id)}"><span class="pgno">${escHtml(t.pgno)}</span><span>${escHtml(t.label)}</span></a></li>`,
  ).join('');
  return `<nav class="toc"><div class="toc-title">目次 — 補足あり ${toc.length} 件</div><ol class="toc-list">${items}</ol></nav>`;
}
//   plan.html 側の QA-INDEX template と内容が重複していたため。
//   ここで関数定義は残置しますが、render() からは呼ばれません (誤参照防止)。
// eslint-disable-next-line no-unused-vars
function renderQaSection_DISABLED_v935(report) {
  if (!report.qaDriven || !Array.isArray(report.questions) || report.questions.length === 0) {
    return '';
  }
  const qRows = report.questions.map((q) => {
    const ss = q.shortSummary
      ? escHtml(q.shortSummary)
      : '<span style="color:#9CA3AF;font-style:italic;">(Phase 2 で確定)</span>';
    const sec = (Array.isArray(q.sectionIndex) && q.sectionIndex.length)
      ? escHtml(q.sectionIndex.join(' / '))
      : '—';
    const direction = q.provisionalDirection
      ? `<tr style="border-bottom:1px solid #E5E7EB;"><td></td><td colspan="4" style="padding:0 10px 10px 10px;color:#6B7280;font-size:0.9em;font-style:italic;">↳ 暫定回答方向性: ${escHtml(q.provisionalDirection)}</td></tr>`
      : '';
    return `<tr style="border-bottom:1px solid #E5E7EB;">
      <td style="padding:10px;text-align:center;font-weight:bold;">${escHtml(q.id)}</td>
      <td style="padding:10px;">${escHtml(q.text)}</td>
      <td style="padding:10px;color:#4B5563;">${ss}</td>
      <td style="padding:10px;text-align:center;"><span style="display:inline-block;padding:2px 8px;border-radius:3px;background:#F3F4F6;font-size:0.85em;">${escHtml(q.kind)}</span></td>
      <td style="padding:10px;text-align:center;font-weight:bold;color:#4B5563;">${sec}</td>
    </tr>${direction}`;
  }).join('');
  const qaTable = `
<section class="qa-driven-section card" style="background:#FAFAF7;border:1px solid #E5E7EB;border-radius:8px;padding:1.2em 1.4em;margin-bottom:1.5em;">
  <h2 style="margin-top:0;border-bottom:2px solid var(--accent, #F59E0B);padding-bottom:0.4em;">💡 解決したい疑問・懸念</h2>
  <p style="color:#4B5563;">このデッキは <strong>${report.questions.length} つの疑問・懸念</strong>を解消するために組まれています。</p>
  <table style="width:100%;border-collapse:collapse;margin-top:1em;">
    <thead><tr style="background:#1F2937;color:#fff;">
      <th style="padding:8px 10px;text-align:center;width:60px;">#</th>
      <th style="padding:8px 10px;text-align:left;">疑問・懸念</th>
      <th style="padding:8px 10px;text-align:left;width:32%;">答え</th>
      <th style="padding:8px 10px;text-align:center;width:130px;">型</th>
      <th style="padding:8px 10px;text-align:center;width:100px;">該当章</th>
    </tr></thead>
    <tbody>${qRows}</tbody>
  </table>`;

  // ペルソナ Q&A レビュー結果 (あれば)
  let personaSection = '';
  if (Array.isArray(report.personaQAReviews) && report.personaQAReviews.length > 0) {
    const personaBlocks = report.personaQAReviews.map((pr) => {
      const summary = pr.summary || {};
      const findingsRows = (pr.per_question_findings || []).map((f) => {
        const clarityColor = ['S', 'A'].includes(f.clarity) ? '#059669'
          : f.clarity === 'B' ? '#4B5563'
          : '#DC2626';
        const sug = f.suggestion ? ` <em>(改善: ${escHtml(f.suggestion)})</em>` : '';
        return `<tr style="border-bottom:1px solid #E5E7EB;">
          <td style="padding:6px 8px;text-align:center;font-weight:bold;">${escHtml(f.qid)}</td>
          <td style="padding:6px 8px;text-align:center;">${escHtml(f.found)}</td>
          <td style="padding:6px 8px;text-align:center;font-weight:bold;color:${clarityColor};">${escHtml(f.clarity)}</td>
          <td style="padding:6px 8px;">${escHtml(f.comment)}${sug}</td>
        </tr>`;
      }).join('');
      const overall = summary.overall_comment ? `<p style="margin:0 0 0.8em 0;">${escHtml(summary.overall_comment)}</p>` : '';
      const stats = `<p style="margin:0 0 0.5em 0;font-size:0.9em;color:#4B5563;">✓ ${summary.fully_answered || 0} 件 / 〜 ${summary.partial || 0} 件 / × ${summary.not_found || 0} 件${summary.weakest_q ? ' • 最も弱い: <strong>' + escHtml(summary.weakest_q) + '</strong>' : ''}</p>`;
      return `<div style="margin-top:1em;padding:0.8em 1em;background:#fff;border-left:3px solid var(--accent, #F59E0B);">
        <h3 style="margin:0 0 0.5em 0;">${escHtml((pr.persona && pr.persona.avatar) || '👤')} ${escHtml((pr.persona && pr.persona.name) || '?')}</h3>
        ${stats}${overall}
        ${findingsRows ? `<table style="width:100%;border-collapse:collapse;font-size:0.88em;">
          <thead><tr style="background:#F3F4F6;"><th style="padding:6px 8px;width:50px;">Q</th><th style="padding:6px 8px;width:80px;">found</th><th style="padding:6px 8px;width:60px;">clarity</th><th style="padding:6px 8px;text-align:left;">comment</th></tr></thead>
          <tbody>${findingsRows}</tbody></table>` : ''}
      </div>`;
    }).join('');
    personaSection = `
  <h3 style="margin-top:1.5em;border-bottom:1px solid #E5E7EB;padding-bottom:0.4em;">📐 ペルソナ Q&amp;A レビュー</h3>
  <p style="color:#6B7280;font-size:0.92em;">各ペルソナが「自分の立場で各 Q の答えをスライドから探した」結果。clarity D は書き直し検討。</p>
  ${personaBlocks}`;
  }

  return qaTable + personaSection + '</section>';
}

function renderPaletteCSS(palette) {
  if (!palette) return '';
  return `
/* v9.9+: palette override (deck: ${escHtml(palette.name)}) */
:root {
  --accent: ${palette.accent};
  --accent-strong: ${palette.accentStrong};
  --accent-mute: ${palette.accentMute};
  --rule: ${palette.rule};
}
`.trim();
}

/**
 * 純粋関数: DTO → { html, widgetCount, widgetTypes, thumbCount, thumbBytes }
 */
function renderReport(report) {
  const deckCtx = { accentHex: report.palette ? report.palette.accent : '#9212F3' };

  // 各カードを純粋関数で描画。集計は reduce でマージ
  const cardResults = report.cards.map((card) => renderCard(card, deckCtx));
  const merged = cardResults.reduce(
    (acc, r) => ({
      htmls: acc.htmls.concat(r.html),
      usedTypes: new Set([...acc.usedTypes, ...r.usedTypes]),
      widgetCount: acc.widgetCount + r.widgetCount,
    }),
    { htmls: [], usedTypes: new Set(), widgetCount: 0 },
  );
  const usedTypes = merged.usedTypes;
  const widgetCount = merged.widgetCount;

  // サムネ集計は DTO から (build phase で base64 化済み)
  const thumbCount = report.cards.reduce((acc, c) => acc + (c.thumbnail ? 1 : 0), 0);
  const thumbBytes = report.cards.reduce((acc, c) => acc + ((c.thumbnail && c.thumbnail.bytes) || 0), 0);

  // 章カードを先、スライドカードを後ろに並べる (cardResults と index で zip)
  const chapterHtmls = [];
  const slideHtmls = [];
  report.cards.forEach((c, i) => {
    if (c.kind === 'chapter') chapterHtmls.push(cardResults[i].html);
    else slideHtmls.push(cardResults[i].html);
  });
  const allCardsHtml = [chapterHtmls.join('\n'), slideHtmls.join('\n')].filter(Boolean).join('\n');
  const cardsCount = report.cards.length;

  // ウィジェット CSS / JS (使われた type だけ)
  let widgetCSS = '';
  let widgetJS = '';
  if (usedTypes.size > 0 && widgetRegistry.__BASE_CSS__) {
    widgetCSS += '\n/* widgets: base */\n' + widgetRegistry.__BASE_CSS__ + '\n';
  }
  // ソート安定性のため type 名でソート
  Array.from(usedTypes).sort().forEach((t) => {
    const def = widgetRegistry[t];
    if (def && def.CSS) widgetCSS += '\n/* widget: ' + t + ' */\n' + def.CSS + '\n';
    if (def && def.JS) widgetJS += '\n// widget: ' + t + '\n' + def.JS + '\n';
  });

  const paletteCSS = renderPaletteCSS(report.palette);

  const meta = report.deckMeta;
  const metaPills = [];
  if (meta.date) metaPills.push(`<span class="pill">${escHtml(meta.date)}</span>`);
  metaPills.push(`<span class="pill">PPTX 全 ${meta.totalSlides} 枚のうち ${meta.slideCount} 枚に補足を付けています</span>`);
  if (meta.chapterCount) metaPills.push(`<span class="pill">章レベル補足 ${meta.chapterCount} 件</span>`);
  if (thumbCount) metaPills.push(`<span class="pill">サムネイル ${thumbCount} 枚</span>`);
  if (widgetCount) metaPills.push(`<span class="pill">インタラクティブ・ウィジェット ${widgetCount} 個</span>`);

  const docTitle = meta.title;
  const paletteFooterTag = report.palette ? ` (palette: ${escHtml(report.palette.name)})` : '';

  const body = `
<div class="report-shell">
  <div class="report-head">
    <span class="report-eyebrow">PPTX 補足レポート</span>
    <h1 class="report-title">${escHtml(docTitle)}</h1>
    <p class="report-sub">この HTML はスライド資料の補足です。資料.pptx と一緒にお読みください。HTML 単独で完結する設計ではありません。</p>
    <div class="report-meta">
      ${metaPills.join('\n      ')}
    </div>
  </div>

  <div class="toolbar">
    <input type="search" id="search-input" placeholder="本文・タイトル・補足理由で絞り込めます…" aria-label="補足カードを検索">
    <button id="btn-expand-all" type="button">すべて開く</button>
    <button id="btn-collapse-all" type="button">すべて閉じる</button>
    <span id="filter-info" class="filter-info" aria-live="polite"></span>
  </div>

  ${renderToc(report.toc)}

  ${cardsCount > 0 ? allCardsHtml : '<div class="empty-state">このデッキは補足が不要なシンプルな構成と判断されました。</div>'}

  <footer class="report-foot">
    Generated by enostech-slides v9.35 — この HTML は PPTX の補足です。SSOT は資料.pptx となります。${paletteFooterTag}
  </footer>
</div>

<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="スライドプレビュー">
  <img alt="" />
  <div class="lightbox-caption"></div>
</div>
`.trim();

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(docTitle)} — 補足レポート</title>
<style>${STYLE}
${widgetCSS}
${paletteCSS}</style>
</head>
<body>
${body}
<script>${SCRIPT}
${widgetJS}</script>
</body>
</html>`;

  return {
    html,
    widgetCount,
    widgetTypes: Array.from(usedTypes).sort(),
    thumbCount,
    thumbBytes,
  };
}

module.exports = { renderReport };
