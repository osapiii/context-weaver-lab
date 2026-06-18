# Mode C — deckStructure 追加モード手順書

> **何のための手順書か**: スキル本体に新しい用途別 deckStructure
> (`learning-deck` / `news-summary` の仲間) を追加する依頼を、毎回安全に
> 同じ品質で着地させるための 6 ステップ。
>
> **対象読者**: Mode C を実行している Claude (本ファイル) と、変更を承認する osanai さん。

---

## 用語整理 (毎回最初に確認)

| 用語 | 指すもの | 例 |
|------|----------|-----|
| **deckStructure** | デッキ全体の "型紙"。header / body.chapters / footer の並びと枚数ルール | `learning-deck`, `news-summary`, (新設) `proposal-deck` |
| **slideTemplate** | 1 スライドの型 | `ENO-04`, `LIST-1`, `DIAGRAM-3` |
| **StructureQA** | deckStructure に基づく機械検査層 (7 番目の QA) | `StructQA-21` (FlowChart 必須) など |

`scripts/render/templates/` 以下の `template` は **slideTemplate** 側を指すので、
本モードでは触らない。本モードで触るのは `scripts/render/deck-structures/` 側だけ。

---

## なぜ 6 ステップに分けるのか

deckStructure は plan.json 全体の構造ルールを Zod schema で機械強制する仕組み。
失敗パターンが明確に分かれていて、各ステップで踏み外すと後段のコストが跳ね上がる:

1. **候補比較 (Step 1)** を飛ばすと、既存 deckStructure と用途がかぶり「これいる？」と
   差し戻される。
2. **仕様書 (Step 2)** を書かずに Zod から始めると、「章末まとめ要る？要らない？」
   みたいな構造判断が宙に浮き、後で直すたびに schema 全体を書き直す。
3. **registry 登録 (Step 4)** を忘れると、Zod は通っても `getDeckStructure(id)` が
   null になり、StructureQA がフォールバックパスに落ちて謎の挙動になる。
4. **動作確認 (Step 5)** で既存 deckStructure を回さないと、共通の `_helper.js` を
   壊した時に気付けない (= learning-deck デッキが本番で死ぬ)。

順序を守ることが、安全に巻き戻せる唯一の方法。

---

## 親承認のタイミング (重要)

このモードでは **2 回**だけ親 (osanai さん) に承認を取る:

| タイミング | 承認の中身 |
|------------|------------|
| **Step 1 完了時** | 候補比較表 + 新 deckStructure の骨格 (header/body/footer のスケッチ) |
| **Step 5 完了時** | 動作確認結果 (StructureQA pass + 既存 deckStructure 影響なし + サンプル plan.json で生成した draft 概要) |

それ以外の Step (2,3,4,6) は、Step 1 で固めた骨格通りなら親確認不要で進める。
**Step 1 の骨格から逸脱する判断が出た時だけ追加確認**を入れる。

---

## Step 1: 候補比較 (差別化 + 骨格スケッチ)

### やること

1. 既存 deckStructure 一覧を取得:

   ```bash
   node scripts/render/print-deck-structure.js
   ```

2. 既存と新案を 4 軸で比較する表を作る:

   | 軸 | learning-deck | news-summary | (新案) |
   |----|---------------|--------------|--------|
   | 想定読者 | 学ぶ人 | 速報を読みたい人 | ? |
   | 章末まとめ | 必要 (FRAMING-5) | 不要 | ? |
   | 章数レンジ | 2-6 | 1-3 | ? |
   | 専用 StructQA | StructQA-12/13/21/22 | StructQA-23 | ? |

3. 新案の骨格を箇条書きで提示 (Zod は書かない、まだ):

   ```
   想定: 提案書 (家族/上司/顧客への意思決定提案 → YES/NO 取得)
   header: [SECTION-1, FRAMING-1 (状況の起点), FRAMING-2 (Before/After), SECTION-6]
   body.chapters: 3-6 章
     head: [章扉, SECSUMMARY-1 (主役ビジュアル)]
     content: 1-8 枚 (任意 slideTemplate)
     tail: [FRAMING-5 (章末判断材料)]
   footer: [SECTION-3?, DATA-4, FRAMING-5 (判断軸), FRAMING-4 (次の一歩), FRAMING-3]
   専用 StructQA: StructQA-30 (proposal_meta) / StructQA-31 (benefit_horizons) /
                  StructQA-32 (risks pair) / StructQA-33 (scenarios) /
                  StructQA-34 (footer judgement-checklist) / StructQA-35 (Decision flow)
   ```

   別案: シンプルな提案デッキ (StructQA 追加なし) で済ませたい場合の比較例:

   ```
   id: simple-proposal
   想定: 軽い社内提案 (1 ページもの程度の提案を pptx 化)
   header: [SECTION-1, FRAMING-1 (現状課題), SECTION-6]
   body.chapters: 1-4 章
     head: [章扉のみ]
     content: 2-10 枚 (任意 slideTemplate)
     tail: [FRAMING-2 (Before-After) 任意]
   footer: [DATA-4 (体制), FRAMING-4 (お土産), FRAMING-3 (会社紹介)]
   専用 StructQA: なし (既存ルールで十分)
   ```

### 親に投げる承認文

```
新 deckStructure `{id}` の骨格をこう考えています:
- 既存と差別化される軸: {差別化ポイント 1-2 個}
- header / body / footer: {上記の骨格スケッチ}
- 専用 StructQA: {追加要否}

このまま Step 2 (仕様書 + Zod) に進んで OK ですか?
```

### よくある罠

- **既存と用途が被る** → 差別化軸を 2 つ以上挙げられないなら新設しない。既存の
  volumeConstraints 上書きで足りる可能性が高い。
- **骨格を最初から細かく決めすぎる** → Zod まで書きたくなるが我慢。Step 1 は
  「分類軸」を固めるだけ。

---

## Step 2: 仕様書作成 (`references/deck-structures/{id}.md`)

### やること

`learning-deck.md` / `news-summary.md` を雛形として `references/deck-structures/{id}.md` を作る。
最低限以下のセクションを含める:

```markdown
# deckStructure: {id} v1.0

## 1. 想定読者・想定用途
{ターゲット読者と「何を持ち帰ってもらうか」}

## 2. 構造定義
### header (序盤固定枠)
- [0] **SECTION-1** ✅ 必須
- [1] **{...}** {required/optional}
- ...

### body.chapters (章繰り返し)
- 章数: {min}-{max}
- chapter.head[]: ...
- chapter.content[]: {min}-{max} 枚
- chapter.tail[]: ...

### footer (末尾固定枠)
- ...

## 3. volumeConstraints
- totalSlides: {min}-{max}

## 4. globalConstraints
- requiredTags: ...
- maxTags: ...

## 5. StructQA 適用範囲
このdeckStructure で fatal/warn になる StructQA-XX 一覧 (新設ルールがあれば 5.x で
明記)。

## 6. plan.json サンプル
```json
{ "doc": { "deck_structure": "{id}", ... }, "header": [...], ... }
```

## 7. 設計判断メモ
なぜこの章数レンジにしたか / なぜ tail を空にしたか等の「迷ったら戻る場所」。
```

### よくある罠

- **slideTemplate の選定基準を書かない** → 「なぜこの slideTemplate を必須にしたか」を
  書かないと、後で「LIST-3 でも良くない？」と聞かれた時に判断軸が再現できない。

---

## Step 3: Zod 実装 (`scripts/render/deck-structures/{id}.js`)

### やること

`learning-deck.js` / `news-summary.js` を雛形として `scripts/render/deck-structures/{id}.js`
を作る。基本パターン:

```js
'use strict';
const { defineDeckStructure, countGlossaryTerms } = require('./_helper');

module.exports = defineDeckStructure({
  id: '{id}',
  version: '1.0',
  description: '{Step 2 の §1 を 1-2 文に要約}',

  header: [
    { template_id: 'SECTION-1', required: true, message: '...' },
    // ...
  ],

  body: {
    count: { min: 1, max: 4 },
    head: [ { template_id: 'SECTION-2', required: true } ],
    content: { count: { min: 2, max: 10 }, allowedTemplates: 'any' },
    tail: [ /* 必要なら */ ],
  },

  footer: [
    { template_id: 'DATA-4', required: true },
    { template_id: 'FRAMING-4', required: true },
    { template_id: 'FRAMING-3', required: true, message: '末尾は会社紹介で締める' },
  ],

  globalConstraints: {
    totalSlides: { min: 8, max: 30 },
    requiredTags: [ /* 専用 StructQA があればここに足す */ ],
    maxTags: [ /* 例: SCENE-02 ハブ&スポーク 1 枚まで */ ],
  },
});
```

### 設計のコツ

- **`message` には StructQA-XX を含める** — 例:
  `'StructQA-13: chapter.tail は FRAMING-5 必須'`。これがないと translateToStructQA
  が `StructQA-00` 扱いにフォールバックしてしまう。
- **`tail: []` で章末まとめなし**を表現できる (news-summary がこのパターン)。
- **新しい StructQA-XX を追加する場合**は `lib/structure-qa.js` に
  `RULE_DEFAULT_LEVEL` / `RULE_CATEGORIES` / `SUGGESTIONS_BY_DECK_STRUCTURE[id]` の
  3 箇所を同時に更新 (Step 6 で詳述)。

### よくある罠

- **`defineDeckStructure` を直接書き換えようとする** → これは _helper.js の factory なので
  触らない。spec を渡すだけで Zod schema が組み上がる。
- **slideTemplate の固有 field 検査を deckStructure 側に書く** → そっちは
  `scripts/render/schemas/templates/index.js` の責務。deckStructure は
  「並びと枚数」だけ扱う。

---

## Step 4: registry 登録

`scripts/render/deck-structures/index.js` の `DECK_STRUCTURES` map に require を追加:

```js
const proposalDeck = require('./proposal-deck');

const DECK_STRUCTURES = {
  'learning-deck': learningDeck,
  'news-summary':  newsSummary,
  'proposal-deck': proposalDeck,   // ← 追加
};
```

これで `getDeckStructure('proposal-deck')` / `listDeckStructures` が拾えるようになり、
`build-deck.js` / `print-deck-structure.js` から自動で見える。

---

## Step 5: 動作確認 (smoke test)

### 5-1. 仕様書通りの plan.json を作って StructureQA pass

```bash
# 最小サンプル plan.json を /tmp/plan-{id}.json に書く
node scripts/render/build-deck.js -i /tmp/plan-{id}.json --validate-only
```

期待: `[StructureQA] ✓ deckStructure "{id}" 全ルール pass`

### 5-2. 既存 deckStructure を壊していないこと

```bash
# learning-deck の代表 plan.json (catalog-deck.json or 既存 decks/) で回す
node scripts/render/build-deck.js -i decks/{既存}/plan.json --validate-only
node scripts/render/build-deck.js -i decks/{既存ニュース要約}/plan.json --validate-only
```

期待: いずれも `[StructureQA] ✓ ...` で pass。`_helper.js` を触っている場合
特に重要。

### 5-3. 故障 smoke test (わざと壊して fatal を出す)

仕様書で「章末まとめは必須」と書いた場合、tail を空にした plan.json を流して
StructQA-13 が fatal で落ちることを確認:

```bash
node scripts/render/build-deck.js -i /tmp/plan-{id}-broken.json --validate-only
# expected: StructQA-13 fatal
```

これを通せば「ルールが本当に効いている」と確信できる。

### 5-4. print-deck-structure.js で表示確認

```bash
node scripts/render/print-deck-structure.js {id}
```

期待: header / body / footer / volumeConstraints / StructQA 一覧 / plan.json 例
が読みやすい Markdown で出る。

### 親に投げる承認文

```
新 deckStructure `{id}` の動作確認結果:
- StructureQA pass: 正常 plan.json で OK
- 既存 deckStructure (learning-deck / news-summary) 影響なし: OK
- 故障 smoke test (StructQA-XX fatal): 期待通り発火
- print-deck-structure.js {id} 出力: {要約}

このまま Step 6 (ドキュメント) に進んで OK ですか?
```

---

## Step 6: ドキュメント反映

以下を **必ず全部**更新する (1 つでも漏らすと「コードでは動くが文書では存在しない」
deckStructure になる):

| 更新対象 | 更新内容 |
|----------|----------|
| `SKILL.md` (ハイライト枠) | 新 deckStructure 追加をハイライトに追記 |
| `SKILL.md` (Mode C 例) | 「判断に迷ったら」表に新 deckStructure の追加例を 1 行 |
| `CHANGELOG.md` | 新 deckStructure 追加エントリを記載 |
| `references/deck-structures/README.md` | 一覧表に新 deckStructure を追記 (なければ作る) |
| `references/qa/structure-qa.md` | 新 StructQA-XX 追加時のみ。ルール定義 / 例外条件を記載 |
| `lib/structure-qa.js` の `SUGGESTIONS_BY_DECK_STRUCTURE` | 新 deckStructure id をキーに追加し、各 StructQA-XX の suggestion 文言を埋める |

### Suggestion 文言を書くコツ

`SUGGESTIONS_LEARNING_DECK` / `SUGGESTIONS_NEWS_SUMMARY` を雛形に、

- **何が NG か**を 1 文で
- **何に直せば OK か**を 1 文で
- **なぜそうなのか**を 1 文で (= 設計判断の理由)

の 3 つを混ぜる。読み手 (Claude) が文脈なしで読んでも自走できる粒度に。

---

## テスト項目チェックリスト (リリース前)

Step 5 の smoke test に加えて、以下が全部 ✅ になることを確認:

- [ ] **registry**: `node -e 'console.log(require("./scripts/render/deck-structures").listDeckStructures)'` に新 id が出る
- [ ] **正常系**: 仕様書通りの plan.json で StructureQA pass
- [ ] **故障系**: 各必須 slideTemplate を 1 つずつ抜いて、対応する StructQA-XX が fatal で落ちる
- [ ] **既存系**: `learning-deck` / `news-summary` の代表 plan.json が引き続き pass
- [ ] **CLI**: `print-deck-structure.js {id}` が正常出力 / 一覧モードに新 id が表示
- [ ] **suggestion**: `lib/structure-qa.js::suggestionFor('StructQA-XX', '{id}')` が新文言を返す
- [ ] **ドキュメント**: SKILL.md / CHANGELOG / references が全部更新済
- [ ] **パッケージング**: `python3 scripts/pack-skill.py` が新 deckStructure を含めて成功
- [ ] **バックアップ**: 旧 `.skill` を `skills/versions/enostech-slides_v{old}_{date}.skill` にコピー済 (CLAUDE.md §6)

---

## 緊急時のロールバック

新 deckStructure を入れて既存デッキが壊れた場合:

1. `scripts/render/deck-structures/index.js` から `'{id}': require(...)` 行を削除
2. `scripts/render/deck-structures/{id}.js` をリネーム退避
3. `python3 scripts/pack-skill.py` で再パッケージ
4. 旧 `.skill` (`skills/versions/`) に巻き戻すか、新パッケージ (削除済) を上書き

`_helper.js` を改変した場合のロールバックは、Step 5 の「既存 deckStructure 影響なし」
が事前に取れていれば不要。取れていなかったら `git diff` で `_helper.js` だけ revert。

---

## 関連ファイル

- 実装エントリ: `scripts/render/deck-structures/index.js`, `_helper.js`
- 検査エンジン: `scripts/render/lib/structure-qa.js`
- CLI: `scripts/render/print-deck-structure.js`
- 既存例: `references/deck-structures/learning-deck.md` / `news-summary.md` / `proposal-deck.md` / `case-study-deck.md`
