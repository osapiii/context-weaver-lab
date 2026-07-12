# Phase 1.8 — braindump.json 執筆 (v12 JSON-SSOT)

> 入口は `references/_common/workflow.md` の Phase 1.8 セクション。
> 本ファイルは braindump.json の **スキーマ・書き方・絶対ルール (R1-10)** を定義する。
> v12 以降、`braindump.json` が唯一の SSOT。`braindump.md` は人間レビュー用 view (生成物)。

---

## このフェーズで何をするか

Phase 1 で確定した **questions[] (5-8 件)** に対し、`decks/{slug}/braindump.json`
を書き上げる。`braindump.md` は `scripts/braindump-to-md.py` が JSON から自動生成する
ので、手編集してはならない。

```
Phase 1 末尾                Phase 1.8 (JSON-first)                          Phase 2
questions[] 承認 ─→  decks/{slug}/braindump.json (手書き SSOT) ─→  plan.draft.json
                          │                                              (deck_structure 骨格込み)
                          ├ braindump-json-validate.py --strict (BSQA-J01..J13 + Zod)
                          ├ braindump-illust.py    (SVG → PNG, visual_path 更新)
                          └ braindump-to-md.py     (json → md view 再生成)
                                                   ↓
                                          ユーザーレビュー → 承認
```

---

## なぜ JSON-first か

- 構造の安定性 — Markdown 正規表現の誤検出を排除
- BSQA 速度改善 — JSON 直接読み込みで MD 走査が不要
- plan.json プレ作成の安定化 — MD 整形差異に左右されない
- クリーンな round-trip — `braindump.json → braindump.md (view) → plan.draft.json`
- v12 新規: deck_structure 骨格を `braindump-to-plan.py` が pre-populate するため
  Phase 2 着手時に header / body.chapters / footer が空 shell で揃っている

スキーマの正本は **`scripts/render/schemas/braindump.js`** (Zod, v12)。
BSQA-J01..J13 のルール定義は `references/qa/braindump-qa.md`。

---

## braindump.json の最小構造 (v12)

```jsonc
{
  "$schema": "braindump-v12",
  "deck": {
    "title": "...",
    "slug": "...",
    "deck_type": "learning",
    "deck_structure": "learning-deck",        // v12 で required
    "qa_driven": true,
    "target_reader": "...",
    "date": "2026-05-12"
  },
  "references": [
    { "n": 1, "title": "...", "url": "https://...", "medium": "...", "retrieved_at": "2026-05-12" }
  ],
  "questions": [
    {
      "id": "Q1",
      "text": "rclone って何者?",
      "kind": "definitional",
      "answer_short": "クラウドストレージ版 rsync...",
      "related_refs": [1, 2, 3]
    }
  ],
  "answers": [
    {
      "question_id": "Q1",
      "visual": "required",
      "visual_path": "braindump_assets/Q1.png",
      "blocks": [
        { "type": "heading", "level": 3, "text": "rclone とは" },
        { "type": "para", "text": "rclone は公式に [3] ..." },
        {
          "type": "table",
          "caption": "Drive API 直叩きとの比較",
          "headers": ["観点", "Drive API", "rclone"],
          "rows": [["差分検知", "自前", "内蔵"]]
        }
      ],
      "citations_used": [1, 2, 3]
    }
  ],
  "meta": { "schema_version": "12" }
}
```

`blocks[]` の型は `para` / `heading` / `table` / `list` / `code` / `quote` の 6 種。
順序保持。`heading` の `level` は 2-4。

詳細スキーマ仕様は `scripts/render/schemas/braindump.js` を読むこと。

### v12 で増えた制約

- `deck.deck_structure` **required**: `learning-deck` / `proposal-deck` /
  `case-study-deck` / `decision-guide` / `news-summary` / `mypedia` のいずれか
  (BSQA-J13 で fatal)
- `$schema` 値は `braindump-v12` (or `braindump-v12.x`) 固定
- v11.2 デッキは `python3 scripts/migrate-v11.2-to-v12.py --input decks/{slug}/braindump.json --write`
  でマイグレーション

---

## ワークフロー (Phase 1.8 標準, v12)

1. **JSON を直接書く**: `decks/{slug}/braindump.json` を Write tool で書き出す
   (Phase 1 で承認した questions[] を埋め、各 answer を `blocks[]` で構造化)
2. **検証**: `python3 scripts/braindump-json-validate.py --input decks/{slug}/braindump.json --strict`
   (BSQA-J01..J13 + Zod schema)。fatal=0 にする
3. **visual SVG**: `visual=required` の answer に対し、`decks/{slug}/braindump_assets/{Q?}.svg`
   を 1 枚ずつ手書き (enostech-svg-diagram skill のレシピに従う)
4. **PNG 変換 + visual_path 更新**:
   `python3 scripts/braindump-illust.py --input decks/{slug}/braindump.json`
5. **MD view 生成**: `python3 scripts/braindump-to-md.py --input decks/{slug}/braindump.json`
   (illust が呼び出すので通常は自動)
6. **散文 QA**: `python3 scripts/writing-qa.py --input decks/{slug}/braindump.md --mode braindump --strict`
7. **ユーザーレビュー**: `decks/{slug}/braindump.md` を流し読みしてもらう。
   修正は **必ず JSON 側を直す**。md は生成物。

承認後、Phase 2 では `braindump-to-plan.py` で骨格込み plan.draft.json を作成する。

---

## 🔴 このフェーズの絶対ルール

### R1-10 Phase 2 に進む前に braindump.json を完成させる

完了条件:

1. `braindump.json` が schema valid (`scripts/render/schemas/braindump.js` の Zod, v12)
2. `deck.deck_structure` が registry のいずれか (BSQA-J13)
3. `references[]` が空でない、`n` が 1..N 連番
4. `questions[]` の `answer_short` が全件埋まっている (40-200 字推奨)
5. `len(questions) == len(answers)`、`question_id` 順 = `id` 順
6. `answers[].visual` 必須、`required` の場合は `visual_path` の実ファイルが存在
7. 各 `answers[].blocks[]` の text 系合計字数 ≥ 800
8. `citations_used[] ⊆ references[].n[]` (孤児参照なし)
9. `braindump-json-validate.py --strict` + `writing-qa.py --mode braindump --strict` が両方 exit 0
10. `braindump.md` view を再生成してユーザーに承認を取る

### opt-out (R1-10 を skip して良いケース)

- `qa_driven: false` で進めるケース (出来事報告 / 事例カタログ)
- short business deck (10 P 以下のピッチ / 1 ページ物の社内共有)
- ユーザーが明示的に「braindump はいらない」と言う

skip 時は Phase 2 で plan.json を直接組む。R1-10 の機械検証は skip される。

---

## ユーザー承認の文面 (定型)

```
{deck-slug} の braindump.json を書き上げました。

📄 decks/{slug}/braindump.json        (SSOT, v12)
📄 decks/{slug}/braindump.md          (人間レビュー用 view: braindump-to-md.py が生成)

   - deck_structure: learning-deck
   - references: {N} 件
   - questions: {N} 件 (answer_short 全件埋め済み)
   - answers: {N} 件 / 本文合計字数 OK

✅ braindump-json-validate.py --strict: BSQA-J01..J13 + Zod 違反なし
✅ writing-qa.py --mode braindump --strict: WritingQA 違反なし

`decks/{slug}/braindump.md` を流し読みしてください。
直したい箇所があれば JSON 側を直してください (md は生成物なので編集不要)。
OK なら Phase 2 (plan.draft.json 骨格生成 → 結晶化) に進みます。
```

---

## NG パターン

- ❌ `braindump.md` を手編集する (生成物なので JSON 側を直す)
- ❌ `deck.deck_structure` 未設定 (v12 fatal: Zod schema + BSQA-J13)
- ❌ `questions[]` と `answers[]` の件数が違う (BSQA-J03 fatal)
- ❌ `visual=required` で `visual_path` 不在 / ファイル不在 (BSQA-J06 fatal)
- ❌ `citations_used[]` に references にない番号 (BSQA-J08 fatal)
- ❌ `answers[].blocks[]` の合計字数 < 800 (BSQA-J11 fatal)
- ❌ 章単位でメモ書きで済ませる (読み物として完結していない)
- ❌ 出典ポインタ `[N]` を書かずに数値・固有名詞を本文に置く

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `references/_common/workflow.md` の Phase 1.8 | フローの位置付け |
| `references/qa/braindump-qa.md` | **BSQA-J01..J13 (v12) ルール定義** |
| `scripts/render/schemas/braindump.js` | Zod schema 正本 (v12) |
| `scripts/braindump-json-validate.py` | JSON 検証 (BSQA + Zod) |
| `scripts/braindump-to-md.py` | JSON → MD view 生成 (idempotent) |
| `scripts/braindump-illust.py` | SVG → PNG → visual_path 更新 |
| `scripts/braindump-to-plan.py` | JSON → plan.draft.json (v12: deck_structure 骨格生成) |
| `scripts/migrate-v11.2-to-v12.py` | **v11.2 → v12 マイグレータ (v12 新設)** |
| `scripts/writing-qa.py` | 散文系 QA ツール (view .md を入力に走らせる) |
| `<project_root>/skills/ja-writing/` | 文体規範の正本 (CHECKLIST 4 原則) |
