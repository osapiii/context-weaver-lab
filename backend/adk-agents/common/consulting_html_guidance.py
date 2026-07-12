"""経営コンサルティング風 HTML 成果物の出力ガイド (consultation / writing 共通)."""

CONSULTING_HTML_OUTPUT_RULES = """\
## HTML レポート・説明資料 (add_html_document) — 優先して使う

次のいずれかに当てはまる依頼では、**Markdown より HTML を優先**し `add_html_document(title, body)` で出力する:
- 分析レポート / 経営サマリー / 提案書 / 説明資料 / エグゼクティブサマリー
- 複数セクション・表・KPI・比較・推奨アクションを含む資料
- スライド風の 1 ページ資料 (deck 風)

### デザイン方針 (マッキンゼー / 戦略コンサル風)
- **色**: 白背景 + ネイビー (#0f172a / #1e293b) + スレートグレー文字。アクセントは 1 色のみ (控えめなブルー #2563eb またはネイビー)。
- **禁止**: 派手なグラデーション、ネオン、絵文字、カラフルなカードの乱用、ゲーミフィケーション風 UI。
- **タイポ**: 見出しは sans-serif (system-ui), 本文 15–16px, line-height 1.6–1.75, 十分な余白。
- **構成**: 表紙 (タイトル + 日付 + 1 行サマリー) → エグゼクティブサマリー (3–5 bullet) → 本文セクション → 推奨アクション。
- **表**: 細いボーダー、zebra なし or 極薄、数値は右寄せ、ヘッダーは小さめ uppercase 可。
- **KPI**: 大きな数字 + 短いラベル。カードは白背景 + 1px border のみ。

### 技術要件
- body は **完全な HTML ドキュメント** (`<!DOCTYPE html>` から)。
- `<head>` に `<meta charset="utf-8">` と `<meta name="viewport" content="width=device-width, initial-scale=1">` を含める。
- CSS は `<style>` 内にまとめる (外部 CDN に依存しない)。
- 印刷向け: `@media print { ... }` で余白と改ページを考慮。
- チャット本文は **短い案内のみ** (例: 「右ペインのレポートをご確認ください」)。長文は HTML に載せ、二重出力しない。

### CSS 骨格 (このトーンをベースにカスタマイズしてよい)
```html
<style>
  :root {
    --ink: #0f172a;
    --muted: #64748b;
    --line: #e2e8f0;
    --accent: #1e3a5f;
    --bg: #ffffff;
    --surface: #f8fafc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 15px;
    line-height: 1.7;
    color: var(--ink);
    background: var(--bg);
  }
  .page { max-width: 920px; margin: 0 auto; padding: 48px 40px 64px; }
  h1 { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 8px; }
  h2 { font-size: 1.125rem; font-weight: 600; margin: 40px 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--line); color: var(--accent); }
  .lead { font-size: 1.05rem; color: var(--muted); margin-bottom: 32px; }
  .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin: 24px 0; }
  .kpi { border: 1px solid var(--line); padding: 16px; background: var(--surface); }
  .kpi .value { font-size: 1.5rem; font-weight: 700; color: var(--ink); }
  .kpi .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 16px 0; }
  th, td { border: 1px solid var(--line); padding: 10px 12px; text-align: left; }
  th { background: var(--surface); font-weight: 600; font-size: 0.8rem; color: var(--accent); }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  ul { margin: 8px 0; padding-left: 1.25rem; }
  li { margin: 6px 0; }
  .actions { margin-top: 32px; padding: 20px; background: var(--surface); border-left: 3px solid var(--accent); }
</style>
```
"""
