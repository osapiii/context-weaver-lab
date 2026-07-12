'use strict';

// svg-diagram ウィジェット
// enostech-svg-diagram スキルが出す制約セット (3-4 色 / 線 2-3px / マーカ 1 種 /
// 矩形・円・直線・三角・Q曲線 / dasharray "4 4") に準拠した SVG をそのまま埋め込みます。
//
// props: {
//   svg: '<svg ...>...</svg>',  // 必須
//   maxWidth: 640,              // 任意 (px)
//   ariaLabel: '...',           // 任意 (alt)
//   shadow: 'none' | 'soft' | 'medium'
// }

const CSS = `
.wgt-svg-diagram { padding: 14px 16px; }
.wgt-svg-diagram .sd-shell {
  margin: 0 auto;
  border-radius: 6px;
  background: var(--surface, #fff);
  display: block;
}
.wgt-svg-diagram .sd-shell.shadow-soft   { box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.wgt-svg-diagram .sd-shell.shadow-medium { box-shadow: 0 6px 24px -8px rgba(0,0,0,.18), 0 1px 2px rgba(0,0,0,.06); }
.wgt-svg-diagram .sd-shell.shadow-none   { box-shadow: none; }
.wgt-svg-diagram svg {
  display: block; width: 100%; height: auto;
  max-width: 100%;
}
.wgt-svg-diagram .sd-fallback {
  font-size: 12px; color: var(--ink-mute, #6B6B6B);
  text-align: center; padding: 24px 16px;
}
@media (prefers-reduced-motion: reduce) {
  .wgt-svg-diagram svg [class*="animate"],
  .wgt-svg-diagram svg [style*="animation"] {
    animation: none !important;
  }
}
`.trim();

// この widget は静的な SVG を埋めるだけなので、JS は何もしない。
const JS = '';

function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function render(props, id) {
  if (!props || !props.svg || typeof props.svg !== 'string') {
    return `<div class="wgt wgt-svg-diagram" id="${id}"><div class="sd-fallback">⚠ svg-diagram: props.svg が未指定です</div></div>`;
  }
  const shadow = props.shadow || 'soft';
  const maxW = props.maxWidth ? `max-width: ${props.maxWidth}px;` : '';
  const aria = props.ariaLabel ? ` role="img" aria-label="${escAttr(props.ariaLabel)}"` : '';
  // 安全策: <script> 等危険なタグは弾く (信頼境界は plan.json 側、ここは念押し)
  const cleaned = String(props.svg).replace(/<script[\s\S]*?<\/script>/gi, '');
  return `<div class="wgt wgt-svg-diagram" id="${id}"${aria}>
  <div class="sd-shell shadow-${shadow}" style="${maxW}">
    ${cleaned}
  </div>
</div>`;
}

module.exports = { type: 'svg-diagram', CSS, JS, render };
