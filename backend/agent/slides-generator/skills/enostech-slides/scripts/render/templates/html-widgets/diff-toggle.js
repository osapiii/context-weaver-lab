'use strict';

// diff-toggle ウィジェット
// before / after の 2 つのテキストを切り替えながら、行単位の差分をハイライトします。
// YAML/コードの追加/削除/変更を視覚化する用途です。
//
// props: {
//   language: 'yaml',
//   before: '...',
//   after: '...',
//   labels: { before: 'before', after: 'after' }
// }
// アルゴリズム: O(N*M) の最小編集距離 (差分検出) + 行単位の +/-/= マーク。
// before/after が大きい (>500 行) 用途は想定していません (補足カードの想定)。

const CSS = `
.wgt-diff-toggle .dt-bar {
  display: flex; gap: 8px; padding: 10px 16px;
  border-bottom: 1px solid var(--rule, #E5E5E5);
  background: var(--surface-2, #F5F5F5); align-items: center;
}
.wgt-diff-toggle .dt-bar button {
  font-size: 12px; padding: 5px 12px;
  border: 1px solid var(--rule, #E5E5E5);
  background: var(--surface, #fff); border-radius: 3px;
  cursor: pointer; font-weight: 600;
  color: var(--ink-2, #333);
}
.wgt-diff-toggle .dt-bar button.active {
  background: var(--accent, #9212F3); color: #fff; border-color: var(--accent, #9212F3);
}
.wgt-diff-toggle .dt-lang {
  margin-left: auto; font-size: 11px; color: var(--ink-mute, #6B6B6B);
  letter-spacing: .08em; text-transform: uppercase;
}
.wgt-diff-toggle .dt-pane {
  background: #1F1F22; color: #E8E8E8;
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px; line-height: 1.65;
  overflow-x: auto;
  position: relative;
  min-height: 80px;
}
.wgt-diff-toggle .dt-pane pre {
  margin: 0; padding: 12px 0;
  display: block;
}
.wgt-diff-toggle .dt-line {
  display: block; padding: 0 12px 0 36px;
  position: relative;
  white-space: pre;
  transition: opacity .35s ease, background .35s ease;
}
.wgt-diff-toggle .dt-line::before {
  content: attr(data-marker);
  position: absolute; left: 8px; top: 0;
  color: rgba(255,255,255,.35); font-weight: 700;
  width: 18px;
}
.wgt-diff-toggle .dt-line.add { background: rgba(146, 18, 243, .18); color: #F5E6FF; }
.wgt-diff-toggle .dt-line.add::before { color: var(--accent, #9212F3); content: '＋'; }
.wgt-diff-toggle .dt-line.del { background: rgba(239, 68, 68, .14); color: #FECACA; }
.wgt-diff-toggle .dt-line.del::before { color: #F87171; content: '−'; }
.wgt-diff-toggle .dt-line.same { color: #C7C7CD; }
.wgt-diff-toggle .dt-line.same::before { content: ''; }
.wgt-diff-toggle[data-view="before"] .dt-line.add { display: none; }
.wgt-diff-toggle[data-view="after"]  .dt-line.del { display: none; }
.wgt-diff-toggle[data-view="diff"]   .dt-line { display: block; }
.wgt-diff-toggle .dt-stats {
  font-size: 11px; color: var(--ink-mute, #6B6B6B);
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
  .wgt-diff-toggle .dt-line { transition: none; }
}
`.trim();

const JS = `
(function(){
  function init(root){
    var btns = root.querySelectorAll('.dt-bar button[data-view]');
    function setView(v){
      root.dataset.view = v;
      btns.forEach(function(b){ b.classList.toggle('active', b.dataset.view === v); });
    }
    btns.forEach(function(b){
      b.addEventListener('click', function(){ setView(b.dataset.view); });
    });
    setView(root.dataset.view || 'diff');
  }
  document.querySelectorAll('.wgt-diff-toggle').forEach(init);
})();
`.trim();

// 行単位の最長共通部分列ベースの差分。
function diffLines(beforeLines, afterLines) {
  const m = beforeLines.length, n = afterLines.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (beforeLines[i - 1] === afterLines[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const ops = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (beforeLines[i - 1] === afterLines[j - 1]) {
      ops.push({ type: 'same', text: beforeLines[i - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: 'del', text: beforeLines[i - 1] });
      i--;
    } else {
      ops.push({ type: 'add', text: afterLines[j - 1] });
      j--;
    }
  }
  while (i > 0) { ops.push({ type: 'del', text: beforeLines[i - 1] }); i--; }
  while (j > 0) { ops.push({ type: 'add', text: afterLines[j - 1] }); j--; }
  return ops.reverse();
}

function escTxt(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function render(props, id) {
  const before = String(props.before || '').replace(/\r\n?/g, '\n');
  const after = String(props.after || '').replace(/\r\n?/g, '\n');
  const lines = diffLines(before.split('\n'), after.split('\n'));
  const lang = props.language || 'text';
  const labels = props.labels || { before: 'before', after: 'after' };
  const initialView = props.initialView || 'diff';
  const adds = lines.filter((l) => l.type === 'add').length;
  const dels = lines.filter((l) => l.type === 'del').length;
  const html = lines.map((l) =>
    `<span class="dt-line ${l.type}">${escTxt(l.text)}</span>`,
  ).join('\n');
  return `
<div class="wgt wgt-diff-toggle" id="${id}" data-view="${initialView}">
  <div class="dt-bar">
    <button type="button" data-view="before">${labels.before}</button>
    <button type="button" data-view="diff">差分</button>
    <button type="button" data-view="after">${labels.after}</button>
    <span class="dt-stats">+${adds} / -${dels}</span>
    <span class="dt-lang">${lang}</span>
  </div>
  <div class="dt-pane">
    <pre>${html}</pre>
  </div>
</div>`.trim();
}

module.exports = { type: 'diff-toggle', CSS, JS, render };
