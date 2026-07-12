# BraindumpStructureQA (BSQA-01..12) — Phase 1.8 braindump.json 構造 QA (v11.2)

> v11.2 (2026-05-12) JSON-first 起点。`braindump.json` が唯一の SSOT、`braindump.md` は生成物。
>
> 検証ツール: `scripts/braindump-json-validate.py`
> Zod schema: `scripts/render/schemas/braindump.js`

---

## 検査の目的

writing-qa.py が「散文の文体・引用整合」を見るのに対し、本 QA は **構造ルール** を
JSON レベルで検査する:

1. **完備性**: references / questions / answers が揃い、整合している
2. **整合性**: `citations_used ⊆ references.n`、`question_id` 順 = `id` 順
3. **量**: 各 answer の本文合計字数 ≥ 800
4. **生成物の検査**: visual=required の answer に PNG ファイルが実在

JSON 化により MD 正規表現の脆さ・誤検出が消え、また `braindump-to-md.py` が
MD を機械生成するので「TOP 位置」「Markdown table」のような *配置* 系の検査は
render 側責任に移った。

---

## BSQA-01..12 ルール定義 (v11.2 JSON 版)

### BSQA-01 (fatal): references[] が空でない

```
JSON: data.references の長さ > 0
```

理由: 学習デッキ / 提案デッキ は出典が要る。`qa_driven: false` の deck は除外。

### BSQA-02 (fatal): questions[] が空でない + answer_short 全件

```
JSON: data.questions の長さ > 0、かつ各 questions[i].answer_short が空でない
```

`answer_short` は Q&A 早見表セルに入る 40-200 字の暫定解答。

### BSQA-03 (fatal): len(questions) == len(answers)

`qa_driven=true` の時のみ。Q 章数と質問数を 1:1 で対応させる。

### BSQA-04 (fatal): answers[].visual 必須

```
JSON: answers[i].visual ∈ {required, optional, none}
```

Zod schema でも fatal、念のため BSQA でも再検査。

### BSQA-05 (warn): questions[].related_refs[] が空でない

```
JSON: questions[i].related_refs の長さ > 0
```

各 Q がどの references[] を参照するかを示す。warn なので blocking しない。

### BSQA-06 (fatal): visual=required の answer に visual_path 実ファイル存在

```
JSON: answers[i].visual == 'required' のとき、
      answers[i].visual_path が存在し、{deck_dir}/{visual_path} がファイル実在
```

修正方法: `python3 scripts/braindump-illust.py --input decks/{slug}/braindump.json`

### BSQA-07 (warn): citations_used[] が空でない

```
JSON: answers[i].citations_used の長さ > 0
```

純粋メカニズム説明 / 概念紹介 章は例外。warn なので blocking しない。

### BSQA-08 (fatal): citations_used[] ⊆ references[].n[]

```
JSON: 各 answers[i].citations_used[j] が references[].n のいずれかと一致
```

孤児参照 (本文に [9] と書いたが references に [9] が無い) を防ぐ。

### BSQA-09 (warn): references[] にあるが本文 (citations_used) で未使用

```
JSON: references[].n で、どの answers[].citations_used にも含まれない番号があれば warn
```

未使用 references の登録は warn 止まり。意図的な「参考程度」もあるため。

### BSQA-10 (fatal): answers[].question_id の順 = questions[].id の順

順番ズレを検知。`qa_driven=true` のとき有効。

### BSQA-11 (fatal): blocks[] の text 系合計字数 ≥ 800

```
JSON: sum(charlen(block.text) for block in answers[i].blocks where type in
         (para, heading, quote, code, list.items[*], table.cells[*])) >= 800
```

字数は空白を除いた正味文字数。

### BSQA-12 (warn): blocks[] に table/list/visual/citations のいずれか

```
JSON: answers[i].blocks に table or list が含まれる
      OR answers[i].visual ∈ {required, optional}
      OR answers[i].citations_used が非空
```

情報密度のシグナル。warn 止まり。

---

## Zod schema 制約 (`scripts/render/schemas/braindump.js`)

BSQA とは別に、Zod schema が以下を fatal で強制する:

| 制約 | 違反時 |
|------|------|
| `$schema` が `^braindump-v11\.2(?:\.\d+)?$` | fatal |
| `deck.slug` が `^[a-z0-9-]+$` | fatal |
| `deck.deck_type` が `learning|proposal|report|catalog` | fatal |
| `deck.date` が `YYYY-MM-DD` | fatal |
| `references[].n` が 1..N 連番、欠番なし | fatal |
| `references[].url` が `https?://` | fatal |
| `questions[].id` が `Q\d+` または `Q\d+\.\d+` | fatal |
| `questions[].related_refs[] ⊆ references[].n[]` | fatal |
| `answers[].question_id` が `questions[].id` のいずれかと一致 | fatal |
| `answers[].visual` が `required|optional|none` | fatal |
| `answers[].blocks[]` が 1 要素以上 | fatal |
| `len(questions) == len(answers)` (qa_driven=true) | fatal |

---

## CLI

```bash
# 単発検査
python3 scripts/braindump-json-validate.py \
  --input decks/{slug}/braindump.json --strict

# JSON 出力 (CI / 別ツールから消費)
python3 scripts/braindump-json-validate.py \
  --input decks/{slug}/braindump.json --strict --json
```

exit code:
- `0` — fatal なし (warn は許容)
- `2` — `--strict` 指定時に fatal あり (schema error も含む)
- `4` — ファイル読み込み失敗 / その他エラー

---

## v11.2 はクリーン break

v11.2 では MD → JSON migration 経路を廃止。Phase 1.8 は `braindump.json` を
直接書く一択。`braindump-structure-qa.py` (MD ベース) は削除済み。
v11.1 以前の `braindump.md` ファイルは `braindump.md.legacy` としてアーカイブ
扱い (BSQA は走らない)。
