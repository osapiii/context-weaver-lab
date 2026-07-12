'use strict';

// medallion-stepper ウィジェット
// メダリオンアーキテクチャの 3 層を順次ハイライトしながら説明します。
// 各 step に title / body / chip (要点ラベル) を持たせる構成。
//
// props: {
//   steps: [
//     { title: 'Bronze', body: '生データを保存', chip: 'raw' },
//     { title: 'Silver', body: 'クレンジング', chip: 'cleansed' },
//     { title: 'Gold',   body: '集計・公開',   chip: 'business' }
//   ],
//   autoplay: true,
//   intervalMs: 2800
// }

const CSS = `
.wgt-medallion-stepper .ms-stage {
  display: grid;
  grid-template-columns: 1fr; gap: 10px;
  padding: 14px 16px;
}
@media (min-width: 640px) {
  .wgt-medallion-stepper .ms-stage { grid-template-columns: repeat(var(--cols, 3), 1fr); }
}
.wgt-medallion-stepper .ms-step {
  border: 1px solid var(--rule, #E5E5E5); border-radius: 4px;
  padding: 14px 16px; background: var(--surface, #fff);
  position: relative;
  transition: background .35s ease, border-color .35s ease, transform .25s ease;
}
.wgt-medallion-stepper .ms-step.active {
  background: var(--accent-mute, #F3E9FE);
  border-color: var(--accent, #9212F3);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px -8px rgba(146, 18, 243, .3);
}
.wgt-medallion-stepper .ms-step .num {
  font-variant-numeric: tabular-nums; font-weight: 700;
  font-size: 22px; color: var(--ink-mute, #6B6B6B);
  line-height: 1;
  transition: color .25s ease;
}
.wgt-medallion-stepper .ms-step.active .num { color: var(--accent-strong, #6A0BB8); }
.wgt-medallion-stepper .ms-step h5 {
  margin: 6px 0 4px; font-size: 14px; font-weight: 700; color: var(--ink, #1A1A1A);
}
.wgt-medallion-stepper .ms-step p {
  margin: 0 0 8px; font-size: 12.5px; color: var(--ink-2, #333); line-height: 1.7;
}
.wgt-medallion-stepper .ms-chip {
  display: inline-block; font-size: 10px; padding: 2px 8px;
  border-radius: 2px; letter-spacing: .04em; font-weight: 700;
  background: var(--surface-2, #F5F5F5); color: var(--ink-mute, #6B6B6B);
  border: 1px solid var(--rule, #E5E5E5);
}
.wgt-medallion-stepper .ms-step.active .ms-chip {
  background: #fff; color: var(--accent-strong, #6A0BB8);
  border-color: var(--accent-mute, #F3E9FE);
}
.wgt-medallion-stepper .ms-controls {
  display: flex; gap: 8px; padding: 10px 16px;
  border-top: 1px solid var(--rule, #E5E5E5);
  background: var(--surface-2, #F5F5F5);
  align-items: center;
}
.wgt-medallion-stepper .ms-controls button {
  font-size: 12px; padding: 5px 12px;
  border: 1px solid var(--rule, #E5E5E5); background: var(--surface, #fff);
  border-radius: 3px; cursor: pointer;
}
.wgt-medallion-stepper .ms-controls button:hover { border-color: var(--rule-strong, #CCC); }
.wgt-medallion-stepper .ms-controls .info {
  margin-left: auto; font-size: 11px; color: var(--ink-mute, #6B6B6B);
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
  .wgt-medallion-stepper .ms-step { transition: none; }
}
`.trim();

const JS = `
(function(){
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function init(root){
    var steps = root.querySelectorAll('.ms-step');
    var info = root.querySelector('.info');
    var btnPlay = root.querySelector('[data-act="play"]');
    var btnPause = root.querySelector('[data-act="pause"]');
    var btnNext = root.querySelector('[data-act="next"]');
    var interval = parseInt(root.dataset.interval || '2800', 10);
    var idx = 0;
    var timer = null;

    function set(i){
      idx = ((i % steps.length) + steps.length) % steps.length;
      steps.forEach(function(s, j){ s.classList.toggle('active', j === idx); });
      if (info) info.textContent = 'step ' + (idx + 1) + ' / ' + steps.length;
    }
    function play(){
      if (timer) return;
      timer = setInterval(function(){ set(idx + 1); }, interval);
      if (btnPlay) btnPlay.style.display = 'none';
      if (btnPause) btnPause.style.display = '';
    }
    function pause(){
      if (!timer) return;
      clearInterval(timer); timer = null;
      if (btnPlay) btnPlay.style.display = '';
      if (btnPause) btnPause.style.display = 'none';
    }
    steps.forEach(function(s, j){
      s.addEventListener('click', function(){ pause(); set(j); });
    });
    if (btnPlay) btnPlay.addEventListener('click', play);
    if (btnPause) btnPause.addEventListener('click', pause);
    if (btnNext) btnNext.addEventListener('click', function(){ pause(); set(idx + 1); });
    set(0);
    if (root.dataset.autoplay === 'true' && !prefersReduced) play();
    else { if (btnPause) btnPause.style.display = 'none'; }
  }
  document.querySelectorAll('.wgt-medallion-stepper').forEach(init);
})();
`.trim();

function render(props, id) {
  const steps = props.steps || [
    { title: 'Bronze', body: '生データを保存', chip: 'raw' },
    { title: 'Silver', body: 'クレンジング', chip: 'cleansed' },
    { title: 'Gold', body: '集計・公開', chip: 'business' },
  ];
  const autoplay = props.autoplay !== false;
  const intervalMs = props.intervalMs || 2800;
  const html = steps.map((s, i) =>
    `<div class="ms-step" data-i="${i}">
      <div class="num">${String(i + 1).padStart(2, '0')}</div>
      <h5>${s.title}</h5>
      ${s.chip ? `<span class="ms-chip">${s.chip}</span>` : ''}
      <p>${s.body}</p>
    </div>`,
  ).join('');
  return `
<div class="wgt wgt-medallion-stepper" id="${id}" data-autoplay="${autoplay}" data-interval="${intervalMs}">
  <div class="wgt-stage" style="padding:0;">
    <h4 class="wgt-h" style="padding:14px 16px 0;">3 層を順番にハイライト: クリックで個別表示・自動再生もできます</h4>
    <div class="ms-stage" style="--cols: ${steps.length};">${html}</div>
  </div>
  <div class="ms-controls">
    <button type="button" data-act="play">再生する</button>
    <button type="button" data-act="pause">一時停止する</button>
    <button type="button" data-act="next">次へ</button>
    <span class="info"></span>
  </div>
</div>`.trim();
}

module.exports = { type: 'medallion-stepper', CSS, JS, render };
