# 日本語ライティング — 外部スキル `ja-writing` への橋渡し

> このファイルは橋渡し。実体は **`ja-writing` スキル** にある。Phase 2 / Phase 4 で
> テキスト要素（タイトル / サブコピー / カード本文 / speaker notes）を書く・読み直す時、
> 必ず ja-writing の SKILL.md と該当 CHECKLIST を読むこと。

## なぜ別スキルに切り出したか

「日本語が不自然」「翻訳調」「てにをはが変」「比喩がしっくりこない」という osanai さん
固有の課題は、enostech-slides に閉じない汎用課題。docx / Slack 共有メッセ / ブログ派生
など、テキストを生成する全ての場面で同じチェックが必要なため、`ja-writing` という独立
スキルとして切り出した。

## ja-writing スキルの場所

- 標準パス: `<project_root>/skills/ja-writing/`
- 主要ファイル:
  - `SKILL.md` — 4 つの大原則と走査フロー（必読）
  - `references/checklist-translation.md` — 翻訳調・冗長表現
  - `references/checklist-grammar.md` — てにをは・修飾語順
  - `references/checklist-metaphor.md` — 比喩・言い換え（箱問題）
  - `references/checklist-ai-style.md` — AI 風表現
  - `references/checklist-slide.md` — スライド固有作法（このスキルから呼ばれる前提で書かれている）
  - `references/before-after-examples.md` — 実例集

## いつ ja-writing を読むか

| Phase / シーン | 読むファイル |
|---|---|
| Phase 2 — plan.json のテキストを書く前 | `ja-writing/SKILL.md` の 4 原則 + `checklist-slide.md` |
| Phase 2 — plan.json のテキストを書いた直後 | `checklist-translation.md` → `checklist-grammar.md` → `checklist-metaphor.md` → `checklist-ai-style.md` の順 |
| Phase 2 — `speaker_notes` (ナレーション台本) を書く時 | `SKILL.md` の 4 原則（ですます調・短く・翻訳調回避）。**音声で読み上げる前提**なので、視覚依存表現と体言止め終端は禁止 (WritingQA-15〜18) |
| Phase 4 — VQA / SQA でテキスト再走査 | 同上のチェックリスト一式 |
| 派生（ブログ・Slack 共有メッセ） | `SKILL.md` + `checklist-translation.md` + `checklist-ai-style.md` |

## このスキルからの参照点

ja-writing は次の enostech-slides ルールと連動している:

- **R2-4**（サブコピー 120〜200 字 + 4 要素）→ ja-writing の `checklist-slide.md` §2 と同じ規範
- **SQA-02 / SQA-03**（タイトル↔サブコピー整合 + 説明力）→ ja-writing の走査フローを通せば自動的にクリアできる
- **C-1**（横文字禁止）→ ja-writing の `checklist-translation.md` の置換表で代替表現を引ける
- **R3-2**（speaker notes は **ナレーション台本** として書く）→ ja-writing の SKILL.md の 4 原則 + `checklist-translation.md` + `checklist-ai-style.md` が物差し。WritingQA-15〜18 が機械検証層

## 作法

`enostech-slides/SKILL.md` の §C-1（横文字禁止）の直後に、本ファイルへのポインタを追加してある。Phase 2 開始時の必読 3 ファイルに加えて、テキスト要素を書く時は **ja-writing/SKILL.md と関連 CHECKLIST** を必ず読み込む。
