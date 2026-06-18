'use strict';

// templates/html-report/style.js — core CSS for the report
//
//   - 見出し: serif (Source Serif Pro / Noto Serif JP)、本文: Noto Sans JP
//   - 色数を 4 色に絞る (#1A1A1A / #4A4A4A / #D8D8D8 / accent)
//   - max-width 880px、左右マージン広め、section 間 56-72px の縦余白
//   - 見出し上に「01 / 02 / 03」のセリフ番号、見出し下に 2px の太罫線
//   - 「キーメッセージ」を subtitle-quote (4px left border + serif) で再表現
//   - 表は罫線最小限・ヘッダー下罫のみ・控えめゼブラ・行間広め
//   - blockquote は左罫 4px solid accent + serif italic
//   - モバイルは max-width 調整のみ (PC を主軸)
//

module.exports =
`
:root {
  --bg: #FFFFFF;
  --surface: #FFFFFF;
  --surface-2: #FAFAFA;
  --ink: #1A1A1A;
  --ink-2: #4A4A4A;
  --ink-mute: #6B6B6B;
  --ink-faint: #9A9A9A;
  --rule: #D8D8D8;
  --rule-strong: #1A1A1A;
  /* デフォルト accent は McKinsey blue。palette オーバーライドで上書き可。 */
  --accent: #003C71;
  --accent-strong: #002A4F;
  --accent-mute: #E8EEF5;
  --code-bg: #1F1F22;
  --code-head: #16161A;
  --code-fg: #E8E8E8;
  --code-mute: #8C8C92;
  --serif: "Source Serif Pro", "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif;
  --sans: "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN",
          "Yu Gothic", "Meiryo", system-ui, sans-serif;
  --dur-1: 160ms;
  --dur-2: 240ms;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-1: 0ms; --dur-2: 0ms; }
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--sans);
  color: var(--ink); background: var(--bg);
  line-height: 1.85; font-size: 15px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Shell ──────────────────────────────────────────────────────── */
.report-shell { max-width: 880px; margin: 0 auto; padding: 64px 32px 96px; }

/* ── Report head: 上罫 / タイトル / 下太罫 ─────────────────────── */
.report-head {
  background: transparent;
  border: none;
  border-top: 1px solid var(--rule);
  border-bottom: 2px solid var(--ink);
  border-radius: 0;
  padding: 32px 0 28px;
  margin-bottom: 56px;
  position: relative; overflow: visible;
}
.report-head::before { display: none; }
.report-eyebrow {
  display: inline-block;
  font-family: var(--serif);
  color: var(--ink-2);
  font-size: 12px; letter-spacing: .18em;
  font-weight: 600; margin-bottom: 14px;
  text-transform: uppercase;
}
.report-title {
  font-family: var(--serif);
  font-size: 32px; font-weight: 600;
  line-height: 1.3; letter-spacing: 0;
  margin: 0 0 16px;
  color: var(--ink);
}
.report-sub {
  font-size: 14px; color: var(--ink-2);
  margin: 0 0 18px; line-height: 1.85;
  max-width: 64ch;
}
.report-meta {
  display: flex; gap: 0; flex-wrap: wrap;
  font-size: 12px; color: var(--ink-mute);
  font-variant-numeric: tabular-nums;
}
.report-meta .pill {
  display: inline-flex; align-items: center;
  background: transparent;
  border: none;
  padding: 0;
  border-radius: 0;
}
.report-meta .pill + .pill::before {
  content: "·";
  margin: 0 14px;
  color: var(--ink-faint);
}

/* ── Toolbar (機能維持しつつ控えめに) ──────────────────────────── */
.toolbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: rgba(255, 255, 255, .96);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  padding: 14px 0; margin: 0 0 40px;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
}
.toolbar input[type="search"] {
  flex: 1 1 220px; min-width: 200px;
  padding: 9px 12px; background: var(--bg);
  border: 1px solid var(--rule); border-radius: 0;
  font-size: 13px; outline: none; color: var(--ink);
  font-family: var(--sans);
  transition: border-color var(--dur-1) var(--ease);
}
.toolbar input[type="search"]:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-mute);
}
.toolbar button {
  font-size: 12px; padding: 8px 14px;
  border: 1px solid var(--rule); background: var(--bg);
  color: var(--ink-2); border-radius: 0; cursor: pointer;
  font-family: var(--sans);
  transition: border-color var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
}
.toolbar button:hover { border-color: var(--ink); color: var(--ink); }
.toolbar .filter-info { font-size: 12px; color: var(--ink-faint); margin-left: auto; }

/* ── 目次 (Contents) ────────────────────────────────────────────── */
.toc {
  background: transparent;
  border: none;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  border-radius: 0;
  padding: 28px 0; margin-bottom: 56px;
}
.toc-title {
  font-family: var(--serif);
  font-size: 11px; color: var(--ink-2);
  margin: 0 0 14px;
  letter-spacing: .18em; text-transform: uppercase;
  font-weight: 600;
}
.toc-list {
  list-style: none; padding: 0; margin: 0;
  display: grid; grid-template-columns: 1fr; gap: 0;
}
@media (min-width: 720px) { .toc-list { grid-template-columns: 1fr 1fr; column-gap: 36px; } }
.toc-list li { font-size: 13px; }
.toc-list a {
  color: var(--ink-2); text-decoration: none;
  display: flex; gap: 14px; align-items: baseline;
  padding: 7px 0;
  border-bottom: 1px dotted var(--rule);
  border-left: none;
  transition: color var(--dur-1) var(--ease);
}
.toc-list a:hover { color: var(--ink); }
.toc-list .pgno {
  font-family: var(--serif);
  font-variant-numeric: tabular-nums; color: var(--ink-faint);
  font-weight: 600; min-width: 38px; font-size: 12px;
  letter-spacing: .04em;
}

/* ── Section / Card ────────────────────────────────────────────── */
.card {
  background: transparent;
  border: none;
  border-radius: 0;
  margin-bottom: 56px;
  overflow: visible;
}
.card.chapter-card { border-left: none; }

/* summary はクリック可能だが McKinsey 風に編集された見出しブロック */
summary.card-head {
  display: block; padding: 0;
  cursor: pointer;
  background: transparent;
  user-select: text;
  list-style: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  border-top: 1px solid var(--rule);
  border-bottom: 2px solid var(--ink);
  margin-bottom: 32px;
  transition: border-color var(--dur-1) var(--ease);
}
summary.card-head::-webkit-details-marker { display: none; }
summary.card-head::marker { content: ""; }
summary.card-head:hover { border-bottom-color: var(--accent); }
summary.card-head:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}
.card[open] summary.card-head { border-bottom-color: var(--ink); }

/* セクション番号 (01 / 02 / 03 風の細セリフ番号) */
.card-head .pgno-badge {
  display: block;
  font-family: var(--serif);
  background: transparent;
  color: var(--ink-mute);
  border: none;
  padding: 18px 0 6px;
  margin: 0;
  border-radius: 0;
  font-variant-numeric: tabular-nums;
  font-size: 13px; font-weight: 600;
  letter-spacing: .18em; text-transform: uppercase;
  min-width: 0; text-align: left;
}
.chapter-card .pgno-badge {
  background: transparent;
  color: var(--accent-strong);
  border: none;
}

/* タイトル: serif で大きめ */
.card-head .card-title {
  display: block;
  font-family: var(--serif);
  font-size: 22px; font-weight: 600;
  line-height: 1.45;
  color: var(--ink);
  padding: 0 0 16px;
  pointer-events: none;
}
.card-head .card-title .kind-badge { pointer-events: none; }
.card-head .card-sub {
  display: none;  /* シンプル化のため非表示 */
}
.card-head .toggle {
  /* 三角矢印は控えめに右上にだけ表示 */
  display: inline-block;
  position: absolute;
  font-family: var(--sans);
  color: var(--ink-faint); font-size: 11px;
  transition: transform var(--dur-2) var(--ease);
  pointer-events: none;
  margin-top: -6px;
}
summary.card-head { position: relative; }
.card-head .toggle { right: 0; top: 22px; }
.card[open] summary.card-head .toggle { transform: rotate(180deg); }

.card-body {
  padding: 0;
}
.card[open] > .card-body {
  animation: card-body-fade var(--dur-2) var(--ease);
}
@keyframes card-body-fade {
  from { opacity: 0; transform: translateY(-2px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── スライドサムネ (シンプルに) ──────────────────────────────── */
.slide-thumb {
  display: block; width: 100%; max-width: 540px;
  aspect-ratio: 16 / 9; margin: 0 0 28px;
  border-radius: 0; border: 1px solid var(--rule);
  background: var(--surface-2); overflow: hidden;
  cursor: zoom-in; position: relative; padding: 0;
}
.slide-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.slide-thumb-caption {
  position: absolute; left: 8px; bottom: 8px;
  background: rgba(26, 26, 26, .82); color: #fff;
  font-family: var(--serif);
  font-size: 11px; letter-spacing: .04em;
  padding: 3px 9px; border-radius: 0;
  font-variant-numeric: tabular-nums;
}

/* ── ライトボックス ─────────────────────────────────────────── */
.lightbox {
  position: fixed; inset: 0;
  background: rgba(20, 20, 20, .85);
  display: none; align-items: center; justify-content: center;
  z-index: 100; padding: 32px; cursor: zoom-out;
}
.lightbox.is-open { display: flex; }
.lightbox img {
  max-width: 100%; max-height: 100%;
  border-radius: 0;
  box-shadow: 0 12px 48px rgba(0, 0, 0, .35);
}
.lightbox-caption {
  position: absolute; bottom: 18px; left: 50%;
  transform: translateX(-50%);
  color: #ddd; font-family: var(--serif);
  font-size: 12px; letter-spacing: .04em;
}

/* ── キーメッセージ (= subtitle): エグゼクティブサマリー風 ─── */
.subtitle-quote {
  font-family: var(--serif);
  font-size: 17px;
  font-weight: 500;
  line-height: 1.85;
  color: var(--ink);
  background: transparent;
  border: none;
  border-left: 4px solid var(--accent);
  padding: 4px 0 4px 22px;
  margin: 0 0 32px;
  border-radius: 0;
}

/* ── 補足理由 (showRationale=true の時のみ) ─────────────────── */
.supp-reason {
  font-family: var(--serif);
  font-size: 13px; color: var(--ink-2);
  background: transparent;
  border: none;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  padding: 12px 0; border-radius: 0;
  margin: 0 0 24px;
}
.supp-reason-label {
  display: inline-block; background: transparent;
  color: var(--accent-strong);
  border: none;
  font-family: var(--serif);
  font-size: 10px; letter-spacing: .18em; font-weight: 700;
  padding: 0; margin-right: 14px;
  text-transform: uppercase;
}

/* ── 補足本文 ───────────────────────────────────────────────── */
.supp-body {
  font-size: 15px; line-height: 1.85; color: var(--ink-2);
  max-width: 64ch;
}
.supp-body p { margin: 0 0 16px; }
.supp-body h1, .supp-body h2, .supp-body h3, .supp-body h4 {
  margin: 32px 0 12px; line-height: 1.4;
  color: var(--ink);
}
.supp-body h2 {
  font-family: var(--serif);
  font-size: 19px; font-weight: 600;
  border-top: 1px solid var(--rule);
  border-bottom: none;
  padding: 24px 0 6px;
}
.supp-body h3 {
  font-family: var(--serif);
  font-size: 16.5px; font-weight: 600;
  position: static; padding-left: 0;
}
.supp-body h3::before { display: none; }
.supp-body h4 {
  font-family: var(--sans);
  font-size: 12.5px; font-weight: 700;
  color: var(--ink-2);
  text-transform: uppercase; letter-spacing: .08em;
}
.supp-body ul, .supp-body ol {
  margin: 0 0 16px; padding-left: 22px;
}
.supp-body li { margin: 0 0 6px; }
.supp-body code {
  background: var(--surface-2); border: 1px solid var(--rule);
  padding: 1px 6px; border-radius: 0;
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 12.5px; color: var(--ink);
}
.supp-body blockquote {
  font-family: var(--serif);
  font-size: 16px; font-style: italic;
  margin: 24px 0; padding: 4px 0 4px 22px;
  border-left: 4px solid var(--accent);
  color: var(--ink-2); background: transparent;
  border-radius: 0;
}
.supp-body a {
  color: var(--accent); text-decoration: underline;
  text-decoration-color: var(--rule); text-underline-offset: 3px;
  transition: text-decoration-color var(--dur-1) var(--ease);
}
.supp-body a:hover { text-decoration-color: var(--accent); }

/* ── コードブロック (実用維持) ──────────────────────────────── */
.codeblock {
  border: 1px solid var(--rule); border-radius: 0;
  margin: 20px 0; background: var(--code-bg); overflow: hidden;
}
.codeblock-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 14px; background: var(--code-head); color: var(--code-fg);
}
.codeblock-lang {
  font-family: var(--serif);
  font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--code-mute);
}
.copy-btn {
  font-size: 11px; padding: 4px 10px;
  border: 1px solid #2a2a30; background: #25252a;
  color: var(--code-fg); border-radius: 0; cursor: pointer;
  font-family: var(--sans);
  transition: background var(--dur-1) var(--ease);
}
.copy-btn:hover { background: #2f2f36; border-color: #3a3a42; }
.copy-btn.is-copied { background: var(--accent); color: #fff; border-color: var(--accent); }
.codeblock pre {
  margin: 0; padding: 16px 18px; overflow-x: auto;
  background: var(--code-bg); color: var(--code-fg);
}
.codeblock pre code {
  background: transparent; padding: 0; color: inherit;
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 12.5px; line-height: 1.7;
}

/* ── 表 (McKinsey 流: 縞模様控えめ・行間広め・罫線最小限) ──── */
.tablewrap {
  overflow-x: auto; margin: 24px 0 32px;
  border: none; border-radius: 0;
}
.data-table {
  border-collapse: collapse; width: 100%;
  font-size: 13.5px;
  font-family: var(--sans);
}
.data-table caption {
  font-family: var(--serif);
  text-align: left; padding: 0 0 10px; color: var(--ink-2);
  font-size: 12px;
  border-bottom: 1px solid var(--rule);
  background: transparent; font-weight: 600;
  letter-spacing: .04em;
}
.data-table th, .data-table td {
  border: none;
  padding: 12px 16px 12px 0;
  text-align: left; vertical-align: top;
  line-height: 1.7;
}
.data-table th {
  font-family: var(--sans);
  background: transparent;
  font-weight: 700; font-size: 11.5px;
  text-transform: uppercase; letter-spacing: .08em;
  color: var(--ink-2);
  cursor: pointer; user-select: none;
  border-top: 1px solid var(--ink);
  border-bottom: 1px solid var(--ink);
  padding: 14px 16px 14px 0;
  transition: color var(--dur-1) var(--ease);
}
.data-table th:hover { color: var(--ink); }
.data-table tbody tr {
  border-bottom: 1px solid var(--rule);
}
.data-table tbody tr:nth-child(even) td {
  background: var(--surface-2);
}
.data-table tr:last-child { border-bottom: 1px solid var(--ink); }
.sort-ind::after { content: ' ▴▾'; color: var(--ink-faint); font-size: 9px; }
.data-table th.asc .sort-ind::after { content: ' ▴'; color: var(--accent); }
.data-table th.desc .sort-ind::after { content: ' ▾'; color: var(--accent); }

/* ── チャート ──────────────────────────────────────────────── */
.chartwrap {
  margin: 24px 0 32px; background: transparent;
  border: 1px solid var(--rule); border-radius: 0;
  padding: 12px 8px;
}
.chartwrap svg { width: 100%; height: auto; max-height: 360px; display: block; }
.chart-title { font-family: var(--serif); font-size: 13px; font-weight: 700; fill: var(--ink); }
.chart-axis { font-size: 11px; fill: var(--ink-mute); }
.chart-grid { stroke: var(--rule); stroke-width: 1; }

/* ── 参考資料 ──────────────────────────────────────────────── */
.supp-refs {
  margin-top: 32px; padding: 18px 0 0;
  background: transparent;
  border: none;
  border-top: 1px solid var(--rule);
  border-radius: 0;
  font-size: 13px;
}
.supp-refs-label {
  font-family: var(--serif);
  font-size: 11px; color: var(--ink-2);
  letter-spacing: .18em; margin-bottom: 8px;
  font-weight: 600; text-transform: uppercase;
}
.supp-refs ul { margin: 0; padding-left: 22px; }
.supp-refs a { color: var(--accent); text-decoration: underline; text-decoration-color: var(--rule); }
.supp-refs a:hover { text-decoration-color: var(--accent); }

/* ── ウィジェット ───────────────────────────────────────────── */
.wgt-figure {
  margin: 24px 0; padding: 0;
  border: 1px solid var(--rule); border-radius: 0;
  background: transparent; overflow: hidden;
}
.wgt-caption {
  font-family: var(--serif);
  font-size: 11.5px; color: var(--ink-2);
  padding: 10px 16px; border-top: 1px solid var(--rule);
  background: var(--surface-2);
  letter-spacing: .03em;
}
.wgt-error {
  margin: 16px 0; padding: 12px 14px;
  background: var(--surface-2); border-left: 4px solid var(--accent);
  border-radius: 0; color: var(--ink);
  font-size: 12.5px;
}
.wgt-inline { margin: 20px 0; }

/* ── empty state / footer ──────────────────────────────────── */
.empty-state {
  background: transparent; padding: 48px 0;
  border: none; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule);
  border-radius: 0; text-align: center;
  color: var(--ink-mute);
  font-family: var(--serif);
  font-size: 14px; font-style: italic;
}
.report-foot {
  margin-top: 72px; padding-top: 24px;
  border-top: 1px solid var(--rule);
  font-family: var(--serif);
  font-size: 11.5px; color: var(--ink-faint);
  text-align: left; letter-spacing: .03em;
}

/* ── kind-badge (kind ラベル: definitional 等) ─────────────── */
.kind-badge {
  display: inline-block;
  font-family: var(--sans);
  font-size: 10px; font-weight: 600;
  letter-spacing: .12em; padding: 0 0 0 10px;
  margin-left: 8px; background: transparent;
  color: var(--ink-mute); border: none;
  text-transform: uppercase; vertical-align: middle;
  border-left: 1px solid var(--rule);
}
.chapter-card .kind-badge {
  color: var(--accent-strong);
}

/* ── モバイル: max-width のみ調整 (PC 主軸) ───────────────── */
@media (max-width: 700px) {
  .report-shell { padding: 32px 20px 64px; }
  .report-head { padding: 24px 0 20px; margin-bottom: 36px; }
  .report-title { font-size: 26px; }
  .toolbar { padding: 10px 0; margin-bottom: 24px; }
  .card-head .card-title { font-size: 19px; }
  .card { margin-bottom: 40px; }
  .slide-thumb { max-width: 100%; }
}
`.trim();
