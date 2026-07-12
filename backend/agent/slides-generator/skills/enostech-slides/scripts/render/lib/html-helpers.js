'use strict';

// ==========================================================================
//  html-helpers.js — HTML 補足レポート用の純粋関数ヘルパー
// --------------------------------------------------------------------------
//  build-html-report.js / templates/html-report/*.js から共有される
//  - escHtml : HTML エスケープ
//  - renderMarkdown : 軽量 Markdown レンダラ
//  - renderChartSVG : 簡易 SVG チャート (bar / line / pie)
// ==========================================================================

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {string} md
 * @param {string} [idPrefix='code']  決定論的 ID の接頭辞 (純粋関数化のため
 *   呼び出し側 - 例えば card.domId - をユニーク化のソースとして渡せます)
 */
function renderMarkdown(md, idPrefix) {
  if (!md || !String(md).trim()) return '';
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let codeBlockId = 0;
  const prefix = idPrefix || 'code';

  const inline = (s) => {
    let t = escHtml(s);
    t = t.replace(/`([^`]+?)`/g, (_m, c) => `<code>${c}</code>`);
    t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
    t = t.replace(
      /\[([^\]]+?)\]\(([^)]+?)\)/g,
      (_m, txt, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`,
    );
    return t;
  };

  while (i < lines.length) {
    const line = lines[i];
    const fenceM = /^```(\S*)\s*$/.exec(line);
    if (fenceM) {
      const lang = fenceM[1] || '';
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      const id = `${prefix}-code-${++codeBlockId}`;
      const text = buf.join('\n');
      out.push(
        `<div class="codeblock" data-lang="${escHtml(lang)}">` +
          `<div class="codeblock-head">` +
            `<span class="codeblock-lang">${escHtml(lang || 'text')}</span>` +
            `<button class="copy-btn" data-target="${id}" type="button">コピーする</button>` +
          `</div>` +
          `<pre><code id="${id}">${escHtml(text)}</code></pre>` +
        `</div>`,
      );
      continue;
    }
    if (/^---+\s*$/.test(line)) { out.push('<hr/>'); i++; continue; }

    const hM = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (hM) {
      const level = hM[1].length;
      out.push(`<h${level}>${inline(hM[2])}</h${level}>`);
      i++; continue;
    }

    if (/^\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const headers = line.slice(1, -1).split('|').map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.+\|\s*$/.test(lines[i])) {
        rows.push(lines[i].slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      out.push('<div class="tablewrap"><table class="data-table sortable">');
      out.push('<thead><tr>');
      headers.forEach((h, idx) => {
        out.push(`<th data-col="${idx}" tabindex="0">${inline(h)}<span class="sort-ind"></span></th>`);
      });
      out.push('</tr></thead><tbody>');
      rows.forEach((r) => {
        out.push('<tr>');
        r.forEach((c) => out.push(`<td>${inline(c)}</td>`));
        out.push('</tr>');
      });
      out.push('</tbody></table></div>');
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, '')); i++;
      }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length && /^(\s*)([-*]|\d+\.)\s+/.test(lines[i])) {
        const ln = lines[i].replace(/^(\s*)([-*]|\d+\.)\s+/, '');
        items.push(`<li>${inline(ln)}</li>`); i++;
      }
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    const buf = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^```/.test(lines[i]) &&
      !/^#{1,4}\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i])
    ) { buf.push(lines[i]); i++; }
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

function renderChartSVG(chart, accentHex) {
  const type = chart.type || 'bar';
  const W = 720, H = 320;
  const PAD = { l: 56, r: 16, t: 28, b: 36 };
  const title = chart.title ? `<text x="${W / 2}" y="18" text-anchor="middle" class="chart-title">${escHtml(chart.title)}</text>` : '';
  const labels = chart.labels || [];
  const series = chart.series || [];
  if (!series.length || !labels.length) return `<div class="chartwrap"><svg viewBox="0 0 ${W} ${H}"></svg></div>`;
  const palette = [accentHex || '#9212F3', '#444444', '#777777', '#999999', '#BBBBBB'];

  if (type === 'bar' || type === 'line') {
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const allVals = series.flatMap((s) => s.data || []);
    const maxV = Math.max(0, ...allVals);
    const minV = Math.min(0, ...allVals);
    const range = (maxV - minV) || 1;
    const x = (i) => PAD.l + ((i + 0.5) / labels.length) * innerW;
    const y = (v) => PAD.t + innerH - ((v - minV) / range) * innerH;
    const gridLines = [];
    for (let g = 0; g <= 4; g++) {
      const yy = PAD.t + (innerH * g) / 4;
      const val = (maxV - ((maxV - minV) * g) / 4).toFixed(0);
      gridLines.push(
        `<line x1="${PAD.l}" y1="${yy}" x2="${W - PAD.r}" y2="${yy}" class="chart-grid"/>` +
        `<text x="${PAD.l - 6}" y="${yy + 4}" text-anchor="end" class="chart-axis">${val}</text>`,
      );
    }
    const xLabels = labels
      .map((lb, i) => `<text x="${x(i)}" y="${H - PAD.b + 18}" text-anchor="middle" class="chart-axis">${escHtml(String(lb))}</text>`)
      .join('');
    const seriesEls = series.map((s, sIdx) => {
      const color = palette[sIdx % palette.length];
      if (type === 'bar') {
        const groupW = innerW / labels.length;
        const barW = Math.max(4, (groupW / series.length) * 0.7);
        return (s.data || []).map((v, i) => {
          const cx = x(i) - groupW / 2 + (sIdx + 0.5) * (groupW / series.length);
          const yy = y(v); const yz = y(0);
          const top = Math.min(yy, yz); const h = Math.abs(yy - yz);
          return `<rect x="${cx - barW / 2}" y="${top}" width="${barW}" height="${h}" fill="${color}" rx="2"/>`;
        }).join('');
      } else {
        const pts = (s.data || []).map((v, i) => `${x(i)},${y(v)}`).join(' ');
        const dots = (s.data || []).map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${color}"/>`).join('');
        return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>${dots}`;
      }
    }).join('');
    const legend = series.map((s, i) => {
      const color = palette[i % palette.length];
      const lx = PAD.l + i * 110;
      return `<rect x="${lx}" y="${H - 12}" width="10" height="10" fill="${color}"/><text x="${lx + 14}" y="${H - 3}" class="chart-axis">${escHtml(s.name || `S${i + 1}`)}</text>`;
    }).join('');
    return `<div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${title}${gridLines.join('')}${seriesEls}${xLabels}${legend}</svg></div>`;
  }

  if (type === 'pie') {
    const data = series[0]?.data || [];
    const total = data.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2, cy = H / 2 + 8, r = 110;
    let acc = 0;
    const arcs = data.map((v, i) => {
      const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
      acc += v;
      const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
      const large = end - start > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const color = palette[i % palette.length];
      return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}"/>`;
    }).join('');
    const legend = labels.map((lb, i) => {
      const color = palette[i % palette.length];
      const lx = 16; const ly = 40 + i * 22;
      const pct = ((data[i] || 0) / total * 100).toFixed(1);
      return `<rect x="${lx}" y="${ly - 10}" width="12" height="12" fill="${color}"/><text x="${lx + 18}" y="${ly}" class="chart-axis">${escHtml(String(lb))} (${pct}%)</text>`;
    }).join('');
    return `<div class="chartwrap"><svg viewBox="0 0 ${W} ${H}">${title}${arcs}${legend}</svg></div>`;
  }
  return '';
}

module.exports = { escHtml, renderMarkdown, renderChartSVG };
