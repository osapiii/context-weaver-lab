'use strict';

// inline-html ウィジェット
// 自由形式の HTML/SVG/CSS/JS 断片を埋め込みます。組み込み 6 種で表現できない
// カスタム挿絵を入れる時の最終手段。
//
// props: {
//   html: '<div>...</div>'  // 必須。CDN 参照なし、外部ファイル参照なし
// }

const CSS = `
.wgt-inline-html { padding: 12px 16px; }
.wgt-inline-html .ih-fallback {
  font-size: 12px; color: var(--ink-mute, #6B6B6B);
  text-align: center; padding: 18px 16px;
}
`.trim();

const JS = '';

function render(props, id) {
  if (!props || !props.html || typeof props.html !== 'string') {
    return `<div class="wgt wgt-inline-html" id="${id}"><div class="ih-fallback">⚠ inline-html: props.html が未指定です</div></div>`;
  }
  return `<div class="wgt wgt-inline-html" id="${id}">${props.html}</div>`;
}

module.exports = { type: 'inline-html', CSS, JS, render };
