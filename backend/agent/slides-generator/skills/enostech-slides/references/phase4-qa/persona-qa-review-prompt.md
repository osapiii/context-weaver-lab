# Phase 4 — ペルソナ Q&A レビュー

> `doc.qa_driven: true` のデッキで Phase 4 に走らせる追加の review サイクル。
> 既存の 4 ペルソナ slide-by-slide レビュー + でき太郎 とは並走させる。
>
> 目的: 「**ペルソナが自分の立場で、各 Q の答えをスライドから探しに行く**」シミュレーション。
> 「Q3 が分かりにくかった」のような per-Q 単位の的確 FB を生成する。

---

## 1. いつ走らせるか

- `doc.qa_driven: true` のデッキ (Phase 1 で opt-in 済)
- Phase 4 で draft.pptx ができた直後
- 既存の `run-pawapo-dekitaro-qa.js` (title-subcopy QA / でき太郎) と並走

---

## 2. プロンプト構造

各ペルソナごとに **1 LLM 呼び出し** で全 Q を評価する (LLM コスト最適化)。
4 ペルソナなら合計 4 呼び出し。

### 2.1 ペルソナ向けプロンプトテンプレ (1 ペルソナ分)

```
あなたはこのデッキの想定読者の一人「{persona.name} ({persona.role})」です。

【あなたの背景】
{persona.bio}

【あなたの傾向】
{persona.traits を 1 行で要約}

これから「解決したい疑問・懸念」のリストと、デッキの全スライドを渡します。
あなたの立場で、各 Q の答えをスライドから探しに行ってください。

【評価項目】(各 Q ごとに記入)
- found: 答えが見つかったか
  - "true"    = 完全に見つかった
  - "partial" = 部分的・前提知識が必要・推測で補えた
  - "false"   = 見つからない / 答えていないと感じる
- found_at: 答えが見つかった slide id の配列 (例: ["S5", "S8"])。見つからなければ []
- clarity: 分かりやすさのスコア
  - S = 完璧、迷わず納得した
  - A = 十分、少し読み返したら理解できた
  - B = やや弱い、複数回読んでようやく
  - C = 弱い、自分の前提知識で補完して理解
  - D = 見つからない / 理解できない
- comment: ペルソナとして感じた所感を 1-3 文で。「{persona.name} ですが…」の口調で。
- suggestion (任意): 改善提案を 1-2 文で

【質問リスト】
{questions の各 Q を id / text / kind / shortSummary 付きで列挙}

【スライド本文】
{各 slide の id / template_id / title / subtitle / 主要本文 を 1 枚 200 字以内で要約して列挙}

【出力フォーマット】
JSON のみ返してください。説明・前置き・コードフェンス禁止。

{
  "persona_name": "{persona.name}",
  "per_question_findings": [
    {
      "qid": "Q1",
      "found": "true|partial|false",
      "found_at": ["S5"],
      "clarity": "S|A|B|C|D",
      "comment": "...",
      "suggestion": "..."
    },
    ...
  ],
  "summary": {
    "fully_answered": 3,
    "partial": 1,
    "not_found": 1,
    "weakest_q": "Q4",
    "overall_comment": "全体としては..."
  }
}
```

### 2.2 出力 schema 検証

LLM 出力 JSON は `PersonaQAReviewSchema` (scripts/render/schemas/common.js) で
safeParse する。失敗したら 1 度だけ自動リトライ → それでもダメなら Phase 4 を warn で通す。

---

## 3. 4 ペルソナの選定

Phase 2 review[] の `cycle_num: 1〜4` で使われた 4 ペルソナをそのまま流用する。
ペルソナ定義 (avatar / name / role / bio / traits[]) は plan.json の `reviews[*].persona` にある。

---

## 4. plan.json への書き込み

`reviews[]` の末尾に新規サイクルとして push する:

```json
{
  "review_type": "persona-qa-review",
  "cycle_num": 5,
  "cycle_desc": "ペルソナ Q&A 探索 ",
  "persona": { ... },
  "per_question_findings": [ ... ],
  "summary": { ... }
}
```

cycle_num は既存サイクル数 + 1 から始める (4 ペルソナ slide-by-slide が cycle_num
1〜4 を使っているなら、qa-review は 5〜8)。

---

## 5. plan.html での表示

- ペルソナ × Q マトリクスとして Q&A タブに表示
- 各 Q について 4 ペルソナ全員のスコアが並ぶ
- weakest_q を持つペルソナの suggestion を上部に summarize 表示

---

## 6. 重要な運用ルール

### 6.1 既存レビューを置き換えない (追加のみ)

slide-by-slide review (`review_type: persona-slide`) と でき太郎
(`review_type: title-subcopy-qa`) は引き続き走らせる。Q&A レビューは追加サイクル。

### 6.2 fatal にしない

clarity D が出ても plan.json のビルドは通る。書き直すかどうかは人間判断。
でき太郎と同じ運用方針。

### 6.3 LLM 出力の重複防止

run-persona-qa-review を 2 回叩いた時、同じ persona に対する既存サイクルは置換する
(append しない)。`review_type === 'persona-qa-review' && persona.name === X` の行を 1 件に保つ。

### 6.4 qa_driven: false の時は走らない

doc.qa_driven が false なら early return。空の per_question_findings を作らない。
