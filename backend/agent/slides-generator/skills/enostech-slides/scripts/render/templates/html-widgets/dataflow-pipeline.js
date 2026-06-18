'use strict';

// dataflow-pipeline ウィジェット
// データパイプラインの段階を SVG で並べ、各段階の間をパケットが流れていきます。
//
// props: {
//   stages: [
//     { name: 'staging', label: 'staging' },
//     { name: 'intermediate', label: 'intermediate' },
//     { name: 'mart', label: 'mart' }
//   ],
//   packetCount: 4
// }

const CSS = `
.wgt-dataflow-pipeline svg { width: 100%; height: auto; max-height: 280px; display: block; margin: 0 auto; }
.wgt-dataflow-pipeline .df-stage-box {
  fill: var(--surface, #fff); stroke: var(--rule-strong, #CCC); stroke-width: 1.5;
  transition: stroke .25s ease, fill .25s ease;
}
.wgt-dataflow-pipeline .df-stage-box.active {
  fill: var(--accent-mute, #F3E9FE);
  stroke: var(--accent, #9212F3);
}
.wgt-dataflow-pipeline .df-stage-label {
  font-size: 12px; font-weight: 700; fill: var(--ink, #1A1A1A);
  text-anchor: middle;
}
.wgt-dataflow-pipeline .df-stage-sub {
  font-size: 10px; fill: var(--ink-mute, #6B6B6B); text-anchor: middle;
}
.wgt-dataflow-pipeline .df-arrow {
  fill: none; stroke: var(--ink-mute, #6B6B6B); stroke-width: 2;
  marker-end: url(#df-arrow-head);
}
.wgt-dataflow-pipeline .df-packet {
  fill: var(--accent, #9212F3); opacity: .85;
  animation: df-flow var(--df-dur, 4s) cubic-bezier(.4,0,.2,1) infinite;
  animation-delay: var(--df-delay, 0s);
}
@keyframes df-flow {
  0%   { offset-distance: 0%; opacity: 0; }
  6%   { opacity: .85; }
  94%  { opacity: .85; }
  100% { offset-distance: 100%; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .wgt-dataflow-pipeline .df-packet { animation: none; offset-distance: 50%; opacity: .55; }
}
.wgt-dataflow-pipeline .df-controls {
  display: flex; gap: 8px; padding: 10px 16px;
  border-top: 1px solid var(--rule, #E5E5E5);
  background: var(--surface-2, #F5F5F5);
  align-items: center;
}
.wgt-dataflow-pipeline .df-controls button {
  font-size: 12px; padding: 5px 10px;
  border: 1px solid var(--rule, #E5E5E5); background: var(--surface, #fff);
  border-radius: 3px; cursor: pointer;
}
.wgt-dataflow-pipeline .df-controls button.active {
  background: var(--accent, #9212F3); color: #fff;
  border-color: var(--accent, #9212F3);
}
.wgt-dataflow-pipeline .df-controls .speed { margin-left: auto; font-size: 11px; color: var(--ink-mute, #6B6B6B); }
`.trim();

const JS = `
(function(){
  function init(root){
    var stages = root.querySelectorAll('.df-stage-box');
    var btns = root.querySelectorAll('.df-controls button[data-target]');
    function highlight(name){
      stages.forEach(function(b){ b.classList.toggle('active', b.dataset.name === name); });
      btns.forEach(function(b){ b.classList.toggle('active', b.dataset.target === name); });
    }
    btns.forEach(function(b){
      b.addEventListener('click', function(){ highlight(b.dataset.target); });
    });
    // 初期: 最初の stage をハイライト
    var first = stages[0]; if (first) highlight(first.dataset.name);
  }
  document.querySelectorAll('.wgt-dataflow-pipeline').forEach(init);
})();
`.trim();

function render(props, id) {
  const stages = props.stages || [
    { name: 'staging', label: 'staging', sub: 'raw → 整形' },
    { name: 'intermediate', label: 'intermediate', sub: '結合・正規化' },
    { name: 'mart', label: 'mart', sub: '集計・公開' },
  ];
  const packetCount = props.packetCount || 5;
  const W = 640, H = 200;
  const boxW = 130, boxH = 70;
  const gap = (W - stages.length * boxW) / (stages.length + 1);
  const boxes = stages.map((s, i) => {
    const x = gap + i * (boxW + gap);
    const y = (H - boxH) / 2 - 10;
    return `
<rect class="df-stage-box" data-name="${s.name}" x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="6"/>
<text class="df-stage-label" x="${x + boxW / 2}" y="${y + boxH / 2 - 2}">${s.label}</text>
<text class="df-stage-sub" x="${x + boxW / 2}" y="${y + boxH / 2 + 16}">${s.sub || ''}</text>
`;
  }).join('');
  // 矢印 (各 box 間)
  const arrows = stages.slice(0, -1).map((_, i) => {
    const x1 = gap + i * (boxW + gap) + boxW;
    const x2 = gap + (i + 1) * (boxW + gap);
    const y = H / 2 - 10;
    return `<path class="df-arrow" d="M ${x1 + 4} ${y} H ${x2 - 8}"/>`;
  }).join('');
  // 全段を貫く motion path
  const startX = gap + 8;
  const endX = gap + (stages.length - 1) * (boxW + gap) + boxW - 8;
  const pathD = `M ${startX} ${H / 2 - 10} H ${endX}`;
  const packets = Array.from({ length: packetCount }, (_, i) =>
    `<circle class="df-packet" r="4" style="offset-path: path('${pathD}'); --df-delay: ${(i * (4 / packetCount)).toFixed(2)}s"/>`,
  ).join('');
  const buttons = stages.map((s) => `<button data-target="${s.name}" type="button">${s.label}</button>`).join('');
  return `
<div class="wgt wgt-dataflow-pipeline" id="${id}">
  <div class="wgt-stage">
    <h4 class="wgt-h">データフロー: 各段階を順にハイライトします (パケットが流れる軌跡で関係性を可視化)</h4>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${stages.map((s) => s.label).join(' から ')} へのデータフロー">
      <defs>
        <marker id="df-arrow-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#6B6B6B"/>
        </marker>
      </defs>
      ${arrows}
      ${boxes}
      ${packets}
    </svg>
  </div>
  <div class="df-controls">
    <span style="font-size:11px;color:var(--ink-mute,#6B6B6B);">注目の段階:</span>
    ${buttons}
  </div>
</div>`.trim();
}

module.exports = { type: 'dataflow-pipeline', CSS, JS, render };
