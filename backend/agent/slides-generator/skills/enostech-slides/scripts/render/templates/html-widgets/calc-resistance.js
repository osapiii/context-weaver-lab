'use strict';

// calc-resistance ウィジェット
// 直列・並列の合成抵抗を、ユーザーが入れた抵抗値リストからリアクティブに計算します。
// 各抵抗を入力 (number) で受け取り、和 (直列) または逆数の和の逆数 (並列) を出します。
//
// props: {
//   mode: 'series' | 'parallel' | 'both',     // 既定 'both' で 2 系統表示
//   defaults: [220, 470, 1000]                 // 初期 3 本
// }

const CSS = `
.wgt-calc-resistance .cr-rows { padding: 14px 16px 8px; display: grid; grid-template-columns: 1fr; gap: 8px; }
.wgt-calc-resistance .cr-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 10px; background: var(--surface-2, #F5F5F5);
  border: 1px solid var(--rule, #E5E5E5); border-radius: 3px;
}
.wgt-calc-resistance .cr-row .label { font-size: 12px; color: var(--ink-mute, #6B6B6B); min-width: 32px; font-variant-numeric: tabular-nums; }
.wgt-calc-resistance .cr-row input {
  flex: 1 1 auto; padding: 5px 8px;
  border: 1px solid var(--rule, #E5E5E5); border-radius: 3px;
  font-size: 13px; font-variant-numeric: tabular-nums;
  background: var(--surface, #fff);
}
.wgt-calc-resistance .cr-row input:focus { border-color: var(--accent, #9212F3); outline: none; }
.wgt-calc-resistance .cr-row .unit { font-size: 12px; color: var(--ink-mute, #6B6B6B); }
.wgt-calc-resistance .cr-row .rm {
  border: 1px solid var(--rule, #E5E5E5); background: #fff;
  border-radius: 3px; cursor: pointer; padding: 2px 8px;
  font-size: 12px; color: var(--ink-mute, #6B6B6B);
}
.wgt-calc-resistance .cr-row .rm:hover { color: var(--ink, #1A1A1A); border-color: var(--rule-strong, #CCC); }
.wgt-calc-resistance .cr-add {
  margin: 4px 16px 14px; padding: 6px 12px;
  border: 1px dashed var(--rule-strong, #CCC); background: transparent;
  border-radius: 3px; cursor: pointer;
  font-size: 12px; color: var(--ink-mute, #6B6B6B);
  transition: color .15s, border-color .15s;
}
.wgt-calc-resistance .cr-add:hover { color: var(--accent-strong, #6A0BB8); border-color: var(--accent, #9212F3); }
.wgt-calc-resistance .cr-output {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  padding: 10px 16px 16px;
}
.wgt-calc-resistance .cr-card {
  border: 1px solid var(--rule, #E5E5E5);
  border-radius: 3px; padding: 12px 14px;
  background: var(--surface, #fff);
  position: relative; overflow: hidden;
}
.wgt-calc-resistance .cr-card.cr-active { border-color: var(--accent, #9212F3); box-shadow: 0 0 0 2px var(--accent-mute, #F3E9FE); }
.wgt-calc-resistance .cr-mode { font-size: 11px; letter-spacing: .08em; color: var(--ink-mute, #6B6B6B); text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
.wgt-calc-resistance .cr-formula {
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 11.5px; color: var(--ink-mute, #6B6B6B); margin-bottom: 6px;
  word-break: break-all;
}
.wgt-calc-resistance .cr-result {
  font-size: 22px; font-weight: 700;
  color: var(--accent-strong, #6A0BB8);
  font-variant-numeric: tabular-nums;
  transition: color .25s ease;
}
.wgt-calc-resistance .cr-bar {
  height: 4px; margin-top: 8px;
  background: var(--surface-2, #F5F5F5); border-radius: 2px; overflow: hidden;
}
.wgt-calc-resistance .cr-bar-fill {
  height: 100%; width: 0%;
  background: linear-gradient(90deg, var(--accent-mute, #F3E9FE), var(--accent, #9212F3));
  transition: width .35s cubic-bezier(.2,.7,.2,1);
}
@media (max-width: 540px) { .wgt-calc-resistance .cr-output { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) {
  .wgt-calc-resistance .cr-bar-fill, .wgt-calc-resistance .cr-result { transition: none; }
}
`.trim();

const JS = `
(function(){
  function format(v){
    if (!isFinite(v) || v <= 0) return '— Ω';
    if (v < 1) return v.toFixed(3) + ' Ω';
    if (v < 1000) return v.toFixed(v < 10 ? 2 : 1) + ' Ω';
    if (v < 1e6) return (v / 1000).toFixed(v < 10000 ? 2 : 1) + ' kΩ';
    return (v / 1e6).toFixed(2) + ' MΩ';
  }
  function compute(values, mode){
    if (!values.length) return 0;
    if (mode === 'series') {
      return values.reduce(function(a, b){ return a + b; }, 0);
    } else {
      var inv = values.reduce(function(a, b){ return a + (b > 0 ? 1/b : 0); }, 0);
      return inv > 0 ? 1 / inv : 0;
    }
  }
  function init(root){
    var rowsEl = root.querySelector('.cr-rows');
    var addBtn = root.querySelector('.cr-add');
    var outSer = root.querySelector('[data-mode="series"] .cr-result');
    var outPar = root.querySelector('[data-mode="parallel"] .cr-result');
    var formulaSer = root.querySelector('[data-mode="series"] .cr-formula');
    var formulaPar = root.querySelector('[data-mode="parallel"] .cr-formula');
    var barSer = root.querySelector('[data-mode="series"] .cr-bar-fill');
    var barPar = root.querySelector('[data-mode="parallel"] .cr-bar-fill');

    function relabel(){
      rowsEl.querySelectorAll('.cr-row').forEach(function(r, i){
        r.querySelector('.label').textContent = 'R' + (i + 1);
      });
    }
    function values(){
      var arr = [];
      rowsEl.querySelectorAll('.cr-row input').forEach(function(inp){
        var v = parseFloat(inp.value);
        if (isFinite(v) && v > 0) arr.push(v);
      });
      return arr;
    }
    function update(){
      var vs = values();
      var s = compute(vs, 'series');
      var p = compute(vs, 'parallel');
      if (outSer) outSer.textContent = format(s);
      if (outPar) outPar.textContent = format(p);
      if (formulaSer) formulaSer.textContent = vs.length ? vs.join(' + ') + ' = ' + format(s) : '抵抗を入力してください';
      if (formulaPar) formulaPar.textContent = vs.length ? '1 / (' + vs.map(function(v){ return '1/' + v; }).join(' + ') + ') = ' + format(p) : '抵抗を入力してください';
      // バー (相対比較: max を 100% として)
      var maxV = Math.max(s, p, 1);
      if (barSer) barSer.style.width = (s / maxV * 100).toFixed(1) + '%';
      if (barPar) barPar.style.width = (p / maxV * 100).toFixed(1) + '%';
    }
    function makeRow(v){
      var row = document.createElement('div');
      row.className = 'cr-row';
      row.innerHTML = '<span class="label">R</span>' +
        '<input type="number" min="0" step="1" value="' + v + '"/>' +
        '<span class="unit">Ω</span>' +
        '<button class="rm" type="button" aria-label="この抵抗を削除します">削除</button>';
      row.querySelector('input').addEventListener('input', update);
      row.querySelector('.rm').addEventListener('click', function(){
        if (rowsEl.querySelectorAll('.cr-row').length <= 1) return;
        row.remove();
        relabel();
        update();
      });
      return row;
    }
    if (addBtn) addBtn.addEventListener('click', function(){
      rowsEl.appendChild(makeRow(220));
      relabel();
      update();
    });
    rowsEl.querySelectorAll('.cr-row').forEach(function(row){
      row.querySelector('input').addEventListener('input', update);
      var rm = row.querySelector('.rm');
      if (rm) rm.addEventListener('click', function(){
        if (rowsEl.querySelectorAll('.cr-row').length <= 1) return;
        row.remove(); relabel(); update();
      });
    });
    update();
  }
  document.querySelectorAll('.wgt-calc-resistance').forEach(init);
})();
`.trim();

function render(props, id) {
  const defaults = props.defaults || [220, 470, 1000];
  const rows = defaults.map((v, i) =>
    `<div class="cr-row">
      <span class="label">R${i + 1}</span>
      <input type="number" min="0" step="1" value="${v}"/>
      <span class="unit">Ω</span>
      <button class="rm" type="button" aria-label="この抵抗を削除します">削除</button>
    </div>`,
  ).join('');
  return `
<div class="wgt wgt-calc-resistance" id="${id}">
  <div class="wgt-stage">
    <h4 class="wgt-h">合成抵抗の計算機: 値を変えると直列・並列が同時に更新されます</h4>
  </div>
  <div class="cr-rows">${rows}</div>
  <button class="cr-add" type="button">＋ 抵抗を追加する</button>
  <div class="cr-output">
    <div class="cr-card cr-active" data-mode="series">
      <div class="cr-mode">直列接続</div>
      <div class="cr-formula"></div>
      <div class="cr-result">— Ω</div>
      <div class="cr-bar"><div class="cr-bar-fill"></div></div>
    </div>
    <div class="cr-card" data-mode="parallel">
      <div class="cr-mode">並列接続</div>
      <div class="cr-formula"></div>
      <div class="cr-result">— Ω</div>
      <div class="cr-bar"><div class="cr-bar-fill"></div></div>
    </div>
  </div>
</div>`.trim();
}

module.exports = { type: 'calc-resistance', CSS, JS, render };
