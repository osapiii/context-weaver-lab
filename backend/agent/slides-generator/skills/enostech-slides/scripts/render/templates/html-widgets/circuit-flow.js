'use strict';

// circuit-flow ウィジェット
// オームの法則 (V = I × R) を粒子の流速で可視化します。
// SVG の閉ループに沿って粒子が motionPath で動き、電流値に応じて速度・粒子数・LED 輝度が変わります。
//
// props: {
//   voltageDefault: 5,         // 初期電圧 (V)
//   resistanceDefault: 220,    // 初期抵抗 (Ω)
//   voltageMin: 1, voltageMax: 12,
//   resistanceMin: 50, resistanceMax: 2000,
//   ledForwardVoltage: 2.0     // LED の順方向電圧降下 (V)
// }

const CSS = `
.wgt-circuit-flow svg { width: 100%; height: auto; max-width: 560px; display: block; margin: 0 auto; }
.wgt-circuit-flow .cf-wire { fill: none; stroke: #333; stroke-width: 3; stroke-linecap: round; }
.wgt-circuit-flow .cf-batt-body { fill: #FFF; stroke: #333; stroke-width: 1.5; }
.wgt-circuit-flow .cf-batt-label { font-size: 11px; fill: #555; font-weight: 700; }
.wgt-circuit-flow .cf-resistor { fill: #FFF; stroke: var(--accent, #9212F3); stroke-width: 2; }
.wgt-circuit-flow .cf-resistor-label { font-size: 10px; fill: var(--accent-strong, #6A0BB8); font-weight: 700; text-anchor: middle; }
.wgt-circuit-flow .cf-led-bulb {
  fill: #FFD93D; stroke: #B58100; stroke-width: 1.5;
  filter: drop-shadow(0 0 var(--led-glow, 4px) rgba(255, 217, 61, var(--led-alpha, .6)));
  transition: filter .3s ease;
}
.wgt-circuit-flow .cf-led-off {
  fill: #DDD; stroke: #999;
  filter: none;
}
.wgt-circuit-flow .cf-particle {
  fill: var(--accent, #9212F3);
  offset-rotate: 0deg;
  animation: cf-flow var(--flow-dur, 3s) linear infinite;
  animation-delay: var(--flow-delay, 0s);
}
@keyframes cf-flow {
  0%   { offset-distance: 0%; }
  100% { offset-distance: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .wgt-circuit-flow .cf-particle { animation: none; offset-distance: 50%; }
}
.wgt-circuit-flow .cf-readout {
  display: inline-block; padding: 2px 10px;
  background: var(--surface, #fff); border: 1px solid var(--accent-mute, #F3E9FE);
  color: var(--accent-strong, #6A0BB8); font-weight: 700;
  border-radius: 3px; font-variant-numeric: tabular-nums; font-size: 12px;
  min-width: 64px; text-align: right;
}
`.trim();

const JS = `
(function(){
  function init(root){
    var V = parseFloat(root.dataset.v) || 5;
    var R = parseFloat(root.dataset.r) || 220;
    var Vf = parseFloat(root.dataset.vf) || 2.0;
    var inputV = root.querySelector('[data-bind="V"]');
    var inputR = root.querySelector('[data-bind="R"]');
    var outI = root.querySelector('[data-out="I"]');
    var outVR = root.querySelector('[data-out="VR"]');
    var outVL = root.querySelector('[data-out="VL"]');
    var ledBulb = root.querySelector('.cf-led-bulb');
    var particles = root.querySelectorAll('.cf-particle');
    var readV = root.querySelector('[data-readout="V"]');
    var readR = root.querySelector('[data-readout="R"]');

    function update(){
      V = parseFloat(inputV.value);
      R = parseFloat(inputR.value);
      // LED が順方向電圧を超えるかで分岐
      var Veff, I, ledOn;
      if (V > Vf) {
        Veff = V - Vf;
        I = Veff / R;       // A
        ledOn = true;
      } else {
        I = 0;
        ledOn = false;
      }
      var Im = I * 1000;    // mA
      var VR = I * R;       // V (LED の電圧除いた抵抗の電圧降下)
      var VL = ledOn ? Vf : 0;
      if (outI) outI.textContent = Im.toFixed(1) + ' mA';
      if (outVR) outVR.textContent = VR.toFixed(2) + ' V';
      if (outVL) outVL.textContent = VL.toFixed(2) + ' V';
      if (readV) readV.textContent = V.toFixed(1) + ' V';
      if (readR) readR.textContent = R + ' Ω';
      // LED 輝度 (0〜30mA に正規化)
      var bright = Math.min(1, Im / 25);
      if (ledBulb) {
        ledBulb.classList.toggle('cf-led-off', !ledOn);
        ledBulb.style.setProperty('--led-glow', (4 + bright * 16) + 'px');
        ledBulb.style.setProperty('--led-alpha', (0.2 + bright * 0.8).toFixed(2));
      }
      // 粒子の流速: 電流大 → 速い (短い周期)
      var dur;
      if (Im < 0.1) dur = 999;     // ほぼ停止
      else dur = Math.max(0.6, 6 - bright * 5); // 1〜6s
      particles.forEach(function(p, i){
        p.style.setProperty('--flow-dur', dur + 's');
        p.style.setProperty('--flow-delay', (i * dur / particles.length).toFixed(2) + 's');
      });
    }
    if (inputV) inputV.addEventListener('input', update);
    if (inputR) inputR.addEventListener('input', update);
    update();
  }
  document.querySelectorAll('.wgt-circuit-flow').forEach(init);
})();
`.trim();

function render(props, id) {
  const Vd = props.voltageDefault ?? 5;
  const Rd = props.resistanceDefault ?? 220;
  const Vf = props.ledForwardVoltage ?? 2.0;
  const vMin = props.voltageMin ?? 1;
  const vMax = props.voltageMax ?? 12;
  const rMin = props.resistanceMin ?? 50;
  const rMax = props.resistanceMax ?? 2000;
  // 4 つの粒子を等間隔で
  const particleCount = 6;
  const particles = Array.from({ length: particleCount }, (_, i) =>
    `<circle class="cf-particle" r="3.5" style="offset-path: path('M 60 130 H 200 V 70 H 320 V 130 H 460'); --flow-delay: ${(i * 0.5).toFixed(2)}s"/>`,
  ).join('');
  return `
<div class="wgt wgt-circuit-flow" id="${id}" data-v="${Vd}" data-r="${Rd}" data-vf="${Vf}">
  <div class="wgt-stage">
    <h4 class="wgt-h">オームの法則: 電流 I = V / R を粒子の流速で見る</h4>
    <svg viewBox="0 0 520 200" role="img" aria-label="電池・抵抗・LED の閉回路を粒子が流れる図">
      <!-- 配線 (motion-path と同じ経路) -->
      <path class="cf-wire" d="M 60 130 H 200 V 70 H 320 V 130 H 460"/>
      <!-- 戻り線 (装飾) -->
      <path class="cf-wire" d="M 460 130 V 168 H 60 V 130"/>
      <!-- 電池 (左) -->
      <line class="cf-wire" x1="60" y1="100" x2="60" y2="160" stroke-width="6"/>
      <line class="cf-wire" x1="50" y1="115" x2="50" y2="145" stroke-width="3"/>
      <text class="cf-batt-label" x="30" y="105" text-anchor="end">+</text>
      <text class="cf-batt-label" x="30" y="155" text-anchor="end">−</text>
      <text class="cf-batt-label" x="78" y="190">電池 V = <tspan data-readout="V">5.0 V</tspan></text>
      <!-- 抵抗 (上) -->
      <rect class="cf-resistor" x="225" y="55" width="80" height="20" rx="3"/>
      <text class="cf-resistor-label" x="265" y="48"><tspan data-readout="R">${Rd} Ω</tspan></text>
      <!-- LED (右) -->
      <circle class="cf-led-bulb" cx="460" cy="130" r="11"/>
      <text class="cf-batt-label" x="460" y="170" text-anchor="middle">LED</text>
      <!-- 粒子 -->
      ${particles}
    </svg>
  </div>
  <div class="wgt-controls">
    <label>電圧 V <input type="range" min="${vMin}" max="${vMax}" step="0.5" value="${Vd}" data-bind="V"></label>
    <label>抵抗 R <input type="range" min="${rMin}" max="${rMax}" step="10" value="${Rd}" data-bind="R"></label>
    <span>I = <output class="out" data-out="I">--</output></span>
    <span>抵抗 V<sub>R</sub> = <output class="out" data-out="VR">--</output></span>
    <span>LED V<sub>F</sub> = <output class="out" data-out="VL">--</output></span>
  </div>
</div>`.trim();
}

module.exports = { type: 'circuit-flow', CSS, JS, render };
