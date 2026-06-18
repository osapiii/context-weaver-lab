'use strict';

// ==========================================================================
//  templates/html-report/card.js — 補足カードレンダラ
// --------------------------------------------------------------------------
//  純粋関数: 入力 (card, deckCtx) → 出力 (html, usedTypes, widgetCount)。
//  - 共有変数 mutation なし
//  - fs / network / Date.now / Math.random なし
//  - widget id は cardIndex + widgetIndex から決定論的に生成
//
//
//  シグネチャ:
//    renderCard(card: SupplementCardDTO, deckCtx: { accentHex: string })
//      => { html: string, usedTypes: Set<string>, widgetCount: number }
// ==========================================================================

const { escHtml, renderMarkdown, renderChartSVG } = require('../../lib/html-helpers');
// インタラクティブウィジェット非対応のミニマル実行を可能にする (Q&A セクションは widgets 不要)。
let widgetRegistry;
try {
  widgetRegistry = require('../html-widgets');
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    widgetRegistry = {};
  } else {
    throw e;
  }
}

function renderTable(tbl) {
  const caption = tbl.caption ? `<caption>${escHtml(tbl.caption)}</caption>` : '';
  const headers = (tbl.headers || []).map(
    (h, idx) => `<th data-col="${idx}" tabindex="0">${escHtml(h)}<span class="sort-ind"></span></th>`,
  ).join('');
  const rows = (tbl.rows || []).map(
    (r) => `<tr>${(r || []).map((c) => `<td>${escHtml(c)}</td>`).join('')}</tr>`,
  ).join('');
  return `<div class="tablewrap"><table class="data-table sortable">${caption}<thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderRefs(refs) {
  if (!refs || !refs.length) return '';
  const items = refs.map((r) => {
    const a = r.url
      ? `<a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escHtml(r.title || r.url)}</a>`
      : escHtml(r.title || '');
    const note = r.note ? `<span class="supp-ref-note"> — ${escHtml(r.note)}</span>` : '';
    return `<li>${a}${note}</li>`;
  }).join('');
  return `<div class="supp-refs"><div class="supp-refs-label">参考資料</div><ul>${items}</ul></div>`;
}

/**
 * 純粋関数: widgets[] → { html, usedTypes }。
 * widget id は card.cardIndex + widget index から決定論的に生成。
 */
function renderWidgets(widgets, card) {
  const usedTypes = new Set();
  let widgetCount = 0;
  if (!widgets || !widgets.length) return { html: '', usedTypes, widgetCount };
  const htmls = [];
  widgets.forEach((w, wIdx) => {
    const def = widgetRegistry[w.type];
    if (!def) {
      htmls.push(`<div class="wgt-error">⚠ 未対応のウィジェット種別です: ${escHtml(w.type)}</div>`);
      return;
    }
    usedTypes.add(w.type);
    widgetCount += 1;
    // 決定論的 ID: card-<cardIndex>-w-<wIdx+1>
    const id = `card-${card.cardIndex}-w-${wIdx + 1}`;
    const html = def.render(w.props || {}, id);
    const caption = w.caption ? `<div class="wgt-caption">${escHtml(w.caption)}</div>` : '';
    htmls.push(`<figure class="wgt-figure">${html}${caption}</figure>`);
  });
  return { html: htmls.join('\n'), usedTypes, widgetCount };
}

function renderThumbnail(card) {
  if (!card.thumbnail) return '';
  const cap = `P${card.pageNumber || ''} ${card.title || ''}`.trim();
  return `<button class="slide-thumb" type="button" data-caption="${escHtml(cap)}" aria-label="P${card.pageNumber} のスライドを拡大表示します"><img src="${card.thumbnail.src}" alt="${escHtml(card.thumbnail.alt || cap)}" loading="lazy"/><span class="slide-thumb-caption">P${card.pageNumber}</span></button>`;
}

function renderSubtitleQuote(card) {
  if (!card.subtitle) return '';
  return `<div class="subtitle-quote">${escHtml(card.subtitle)}</div>`;
}

function renderRationale(card) {
  if (!card.showRationale || !card.rationale) return '';
  return `<div class="supp-reason"><span class="supp-reason-label">補足を入れた理由</span>${escHtml(card.rationale)}</div>`;
}

/**
 * メイン: 1 カード分の HTML + 集計を返す。
 * @param {object} card    SupplementCardSchema 準拠
 * @param {object} deckCtx { accentHex } の読み取り専用オブジェクト
 * @returns {{ html: string, usedTypes: Set<string>, widgetCount: number }}
 */
function renderCard(card, deckCtx) {
  const isChapter = card.kind === 'chapter';
  //   章カード: 「01 — CHAPTER」/ スライドカード: 「P03」(McKinsey eyebrow 風)
  const chapterIdxStr = String(card.chapterIdx || 0).padStart(2, '0');
  const pageNumStr = String(card.pageNumber || 0).padStart(2, '0');
  const headBadge = isChapter
    ? `<span class="pgno-badge">${escHtml(chapterIdxStr)} — Chapter</span>`
    : `<span class="pgno-badge">P${escHtml(pageNumStr)}</span>`;
  const kindBadge = card.kindLabel
    ? `<span class="kind-badge ${escHtml(card.kindClass || '')}">${escHtml(card.kindLabel)}</span>`
    : '';
  const titleSuffix = isChapter
    ? `<span class="kind-badge ${escHtml(card.kindClass || '')}">章レベル補足</span>`
    : kindBadge;
  const subLabel = card.bucketLabel ? `<span class="card-sub">${escHtml(card.bucketLabel)}</span>` : '';

  const widgetResult = renderWidgets(card.widgets, card);

  const bodyParts = [];
  bodyParts.push(renderRationale(card));
  if (!isChapter) {
    bodyParts.push(renderThumbnail(card));
    bodyParts.push(renderSubtitleQuote(card));
  }
  if (card.contentMd) bodyParts.push(`<div class="supp-body">${renderMarkdown(card.contentMd, card.domId)}</div>`);
  if (card.tables && card.tables.length) bodyParts.push(card.tables.map(renderTable).join('\n'));
  if (card.charts && card.charts.length) {
    bodyParts.push(card.charts.map((ch) => renderChartSVG(ch, deckCtx.accentHex)).join('\n'));
  }
  if (widgetResult.html) bodyParts.push(widgetResult.html);
  bodyParts.push(renderRefs(card.refs));
  const body = bodyParts.filter(Boolean).join('\n');

  const openAttr = card.open ? ' open' : '';
  const cardCls = isChapter ? 'card chapter-card' : 'card';

  const html = `<details class="${cardCls}"${openAttr} id="${escHtml(card.domId)}" data-haystack="${escHtml(card.haystack)}">
  <summary class="card-head">
    ${headBadge}
    <span class="card-title">${escHtml(card.title)}${titleSuffix}</span>
    ${subLabel}
    <span class="toggle">▾</span>
  </summary>
  <div class="card-body">
    ${body}
  </div>
</details>`;

  return {
    html,
    usedTypes: widgetResult.usedTypes,
    widgetCount: widgetResult.widgetCount,
  };
}

module.exports = { renderCard };
