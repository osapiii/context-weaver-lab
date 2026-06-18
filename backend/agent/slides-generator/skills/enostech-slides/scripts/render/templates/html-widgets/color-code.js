'use strict';

// color-code ウィジェット
// 4 帯の抵抗カラーコードを、各帯クリックで色を回して値を即時表示します。
//
// props: {
//   bands: 4,                    // 4 帯固定 (将来 5 帯対応する場合は b1,b2,b3 + 倍率 + 公差)
//   default: ['red','red','brown','gold']  // 初期値 (省略時はランダム)
// }

const COLORS = [
  // [name, hex, digit, multiplier(*10^), tolerance%]
  ['black',  '#000000',  0, 1,        null],
  ['brown',  '#8B4513',  1, 10,       1],
  ['red',    '#E11D48',  2, 100,      2],
  ['orange', '#F97316',  3, 1000,     null],
  ['yellow', '#FACC15',  4, 10000,    null],
  ['green',  '#16A34A',  5, 100000,   0.5],
  ['blue',   '#2563EB',  6, 1000000,  0.25],
  ['violet', '#7C3AED',  7, 10000000, 0.1],
  ['gray',   '#6B7280',  8, 100000000,0.05],
  ['white',  '#F8FAFC',  9, 1000000000, null],
  ['gold',   '#D4A017',  null, 0.1,   5],
  ['silver', '#9CA3AF',  null, 0.01,  10],
];

const CSS = `
.wgt-color-code .cc-stage { display: flex; align-items: center; justify-content: center; padding: 18px 16px 22px; }
.wgt-color-code .cc-resistor {
  position: relative; width: 320px; max-width: 100%; height: 70px;
  background: #F0E0C0; border-radius: 35px;
  box-shadow: inset 0 -8px 14px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.06);
}
.wgt-color-code .cc-lead { position: absolute; top: 32px; height: 6px; width: 30px; background: #999; border-radius: 3px; }
.wgt-color-code .cc-lead.l { left: -28px; }
.wgt-color-code .cc-lead.r { right: -28px; }
.wgt-color-code .cc-band {
  position: absolute; top: 8px; bottom: 8px;
  width: 18px; cursor: pointer;
  transition: transform .15s ease, box-shadow .15s ease;
  border-radius: 2px;
}
.wgt-color-code .cc-band:hover { transform: translateY(-2px); box-shadow: 0 3px 6px rgba(0,0,0,.18); }
.wgt-color-code .cc-band[data-i="0"] { left: 38px; }
.wgt-color-code .cc-band[data-i="1"] { left: 78px; }
.wgt-color-code .cc-band[data-i="2"] { left: 118px; }
.wgt-color-code .cc-band[data-i="3"] { right: 38px; }
.wgt-color-code .cc-readout {
  display: flex; flex-wrap: wrap; gap: 14px;
  padding: 10px 16px 14px; justify-content: center;
}
.wgt-color-code .cc-readout > div {
  font-size: 12px; color: var(--ink-2, #333);
  font-variant-numeric: tabular-nums;
}
.wgt-color-code .cc-value {
  font-size: 22px; font-weight: 700;
  color: var(--accent-strong, #6A0BB8);
  letter-spacing: .02em;
}
.wgt-color-code .cc-table {
  margin: 0 16px 14px; border-top: 1px solid var(--rule, #E5E5E5);
  font-size: 11.5px; color: var(--ink-mute, #6B6B6B); padding-top: 10px;
}
.wgt-color-code .cc-table b { color: var(--ink, #1A1A1A); margin-right: 4px; }
@media (prefers-reduced-motion: reduce) {
  .wgt-color-code .cc-band:hover { transform: none; }
}
`.trim();

const JS = `
(function(){
  var COLORS = ${JSON.stringify(COLORS)};
  function nameOf(i){ return COLORS[i][0]; }
  function findByName(n){ for (var i=0;i<COLORS.length;i++) if (COLORS[i][0]===n) return i; return 0; }
  function format(value){
    if (value < 1) return value.toFixed(2);
    if (value < 1000) return Math.round(value * 100) / 100 + ' Ω';
    if (value < 1e6) return (value / 1000).toFixed(value < 10000 ? 2 : 1) + ' kΩ';
    if (value < 1e9) return (value / 1e6).toFixed(value < 1e7 ? 2 : 1) + ' MΩ';
    return value.toExponential(2) + ' Ω';
  }
  function init(root){
    var bands = root.querySelectorAll('.cc-band');
    var valueEl = root.querySelector('.cc-value');
    var detailEl = root.querySelector('.cc-table');
    var idx = [];
    bands.forEach(function(b, i){
      idx[i] = findByName(b.dataset.color || 'black');
      b.style.background = COLORS[idx[i]][1];
      // 帯ごとに「許容色」を絞る (b1,b2 は 0..9, multiplier は black..gold/silver, tolerance は brown/red/...)
      var allowed;
      if (i === 0 || i === 1) {
        // 1・2 帯目は 0..9 (white除き白すぎは見にくいが残す)
        allowed = [];
        for (var k=0;k<10;k++) allowed.push(k);
      } else if (i === 2) {
        // 3 帯目 = multiplier (silver/gold 含む)
        allowed = [0,1,2,3,4,5,6,7,8,9,10,11];
      } else {
        // 4 帯目 = tolerance (許容差を持つ色のみ)
        allowed = [];
        COLORS.forEach(function(c, ci){ if (c[4] != null) allowed.push(ci); });
      }
      b.dataset.allowed = JSON.stringify(allowed);
      b.addEventListener('click', function(){
        var allow = JSON.parse(b.dataset.allowed);
        var cur = idx[i];
        var pos = allow.indexOf(cur);
        pos = (pos + 1) % allow.length;
        idx[i] = allow[pos];
        b.style.background = COLORS[idx[i]][1];
        b.dataset.color = nameOf(idx[i]);
        update();
      });
    });
    function update(){
      var d1 = COLORS[idx[0]][2];
      var d2 = COLORS[idx[1]][2];
      var mul = COLORS[idx[2]][3];
      var tol = COLORS[idx[3]][4];
      var value;
      if (d1 == null || d2 == null) {
        valueEl.textContent = '— 数字色を選んでください';
      } else {
        value = (d1 * 10 + d2) * mul;
        valueEl.textContent = format(value) + (tol != null ? ' ±' + tol + '%' : '');
      }
      var tbody = idx.map(function(ci, i){
        var c = COLORS[ci];
        var role;
        if (i < 2) role = '数字' + (i+1);
        else if (i === 2) role = '倍率 (×10^' + (Math.log10(c[3])|0) + ')';
        else role = '許容差';
        return '<span><b>第' + (i+1) + '帯</b>' + c[0] + ' (' + role + ')</span>';
      }).join('   ');
      detailEl.innerHTML = tbody;
    }
    update();
  }
  document.querySelectorAll('.wgt-color-code').forEach(init);
})();
`.trim();

function render(props, id) {
  const def = props.default || ['red', 'red', 'brown', 'gold'];
  const bands = [0, 1, 2, 3].map((i) => {
    const c = (def[i] || 'black').toLowerCase();
    return `<div class="cc-band" data-i="${i}" data-color="${c}" role="button" tabindex="0" aria-label="第${i + 1}帯。クリックで色を切り替えます"></div>`;
  }).join('');
  return `
<div class="wgt wgt-color-code" id="${id}">
  <div class="wgt-stage">
    <h4 class="wgt-h">カラーコード: 各帯をクリックすると色が切り替わって抵抗値が更新されます</h4>
    <div class="cc-stage">
      <div class="cc-resistor">
        <div class="cc-lead l"></div>
        <div class="cc-lead r"></div>
        ${bands}
      </div>
    </div>
  </div>
  <div class="cc-readout">
    <div>抵抗値 <span class="cc-value">— Ω</span></div>
  </div>
  <div class="cc-table"></div>
</div>`.trim();
}

module.exports = { type: 'color-code', CSS, JS, render };
