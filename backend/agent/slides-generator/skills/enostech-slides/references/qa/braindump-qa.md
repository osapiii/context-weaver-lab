# BraindumpQA (BSQA-J01〜J13) — Phase 1.8 braindump.json 構造 QA (v12)

> v12 (2026-05-12): v11.2 で JSON-SSOT に切替後、v12 で BSQA-J13 (deck_structure registry 整合) を新設。
> BSQA-J01〜J12 は v11.2 から踏襲、ルール ID を `BSQA-N` から `BSQA-JN` に改名 (JSON 検査由来であることを明示)。

`scripts/braindump-json-validate.py` の検査ルール一覧。Phase 1.8 完了ゲートの
1 つで、`writing-qa.py --mode braindump --strict` と並列で走る。

---

## 検査の目的

writing-qa.py が「散文の文体・引用整合」を見るのに対し、本 QA は **構造ルール** を
専属で検査する。具体的には:

1. **存在性**: deck / references / questions / answers の必須フィールドが揃っている
2. **整合性**: questions と answers の件数 / 順序 / 参照番号が一致
3. **完備性**: visual: required の章は画像埋め込み必須、本文 800 字以上、引用整合
4. **registry 整合性** (v12): deck.deck_structure が deck-structures registry に存在

これにより Phase 1.8 完了 → Phase 2 突入時の品質を担保する。

---

## BSQA-J01〜J13 ルール定義

### BSQA-J01 (fatal): references[] が空でない
`references[]` を 1 件以上登録する。

### BSQA-J02 (fatal): questions[] が空でない & answer_short 全件
`qa_driven=true` 時、questions[] 非空 + 各 question.answer_short 40-80 字。

### BSQA-J03 (fatal): len(questions) == len(answers)
qa_driven=true で件数一致。

### BSQA-J04 (fatal): answer.visual が enum
`visual ∈ {required, optional, none}`。

### BSQA-J05 (warn): questions[].related_refs[] 非空
各 question に関連 references 番号を 1 件以上。

### BSQA-J06 (fatal): visual=required の visual_path 実ファイル存在
`braindump_assets/Q?.png` が実ファイルとして存在。

### BSQA-J07 (warn): answers[].citations_used[] 非空
各 answer に [N] 引用が 1 件以上。

### BSQA-J08 (fatal): citations_used ⊆ references.n (孤児参照禁止)
本文の [N] が references に全件登録されている。

### BSQA-J09 (warn): references にあるが本文未使用
逆向き warn。

### BSQA-J10 (fatal): answers の順 = questions の順
Q1 → Q2 → Q3 の連番強制。

### BSQA-J11 (fatal): answers[].blocks[] の text 系合計字数 ≥ 800
読み物として完結する下限。

### BSQA-J12 (warn): blocks に table/list/visual/citations のいずれか
情報密度ガード。

### BSQA-J13 (fatal): deck.deck_structure が registry に存在 (v12 新設)

```
deck.deck_structure フィールドが scripts/render/deck-structures/*.js の
registry (= learning-deck / proposal-deck / case-study-deck / decision-guide /
news-summary / mypedia) のいずれかと一致すること。
```

**Why**: typo (例: `learning-decks`) や未追加の deck_structure 値を Phase 1.8 ゲートで
即座に検出。`braindump-to-plan.py` の骨格生成は registry に存在することを前提に
ロジックを組んでいるため、registry にない値が来ると下流が静かに壊れる。

**SSOT**: Zod schema (v12) の `deck.deck_structure: z.string().min(1)` と並列。
Zod は「存在すれば OK」、BSQA-J13 は「registry にあるか」を強制 (fatal)。

**Fix**: deck.deck_structure を 6 候補のいずれかに変更。新規 deck_structure を追加
したい場合は `references/alt-modes/deckstructure-add-mode.md` の 6 ステップを踏み、
`scripts/render/deck-structures/{slug}.js` を新設してから戻る。

---

## WritingQA との SSOT 関係

| BSQA-J | 関係 | WritingQA |
|---|---|---|
| BSQA-J04 (visual enum) | SSOT 重複検査 | WritingQA-29 (同等 fatal) |
| BSQA-J06 (visual_path 実ファイル) | 昇格 (warn → fatal) | WritingQA-28 (warn のまま並列) |
| BSQA-J08 (孤児参照) | SSOT 重複検査 | WritingQA-26 (同等 fatal) |
| BSQA-J09 (孤児リンク) | SSOT 重複検査 | WritingQA-27 (同等 warn) |
| BSQA-J11 (本文 800 字下限) | BSQA-J only | WritingQA-23 は上限 warn を採用見送り済 |
| BSQA-J13 (deck_structure registry) | **v12 新設、SSOT 単独** | (WritingQA に対応ルールなし) |

重複検査は意図的。実行順は **BSQA-J → writing-qa** で、BSQA-J で先に fatal を蹴れば
writing-qa は走らせない運用 (run-qa.py phase2 Step 0)。両方走らせると同じ違反が
2 回報告されるので注意。

---

## CLI 仕様

```bash
python3 scripts/braindump-json-validate.py --input decks/{slug}/braindump.json --strict
python3 scripts/braindump-json-validate.py --input decks/{slug}/braindump.json --strict --json
```

### 終了コード

| code | 意味 |
|---|---|
| 0 | fatal なし (warn は許容) |
| 2 | --strict 指定時に fatal あり |
| 4 | ファイル読み込み失敗 / その他エラー |

---

## v12 移行ノート

v11.2 で書かれた braindump.json は以下のいずれかで対応:

1. **自動マイグレーション** (推奨): `python3 scripts/migrate-v11.2-to-v12.py --input decks/{slug}/braindump.json --write`
   - `$schema` を `braindump-v12` に書き換え
   - `deck.deck_structure` 未設定なら `learning-deck` をデフォルト挿入 (warn)
   - `meta.schema_version` を `12` に
2. **手動修正**: 上記 3 点を手で書き換え

v11.1 以前 (MD-only) のデッキは legacy 据え置き。再ビルドが必要なら `braindump.json` を新規に手書きする。

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `scripts/braindump-json-validate.py` | BSQA-J01..J13 検査 CLI (v12) |
| `scripts/render/schemas/braindump.js` | Zod schema 正本 (v12) |
| `scripts/braindump-illust.py` | visual_data → SVG/PNG 変換 (BSQA-J06 で必須化) |
| `scripts/braindump-to-md.py` | JSON → MD view 生成 (idempotent, [[N]](url) linkify 内蔵) |
| `scripts/migrate-v11.2-to-v12.py` | v11.2 → v12 マイグレータ |
| `scripts/writing-qa.py` | 散文 QA (WritingQA-24〜30) |
| `references/phase1-hearing/braindump.md` | braindump.json のスキーマ・書き方 |
| `references/qa/writing-qa.md` | WritingQA-24〜30 の詳細 |
