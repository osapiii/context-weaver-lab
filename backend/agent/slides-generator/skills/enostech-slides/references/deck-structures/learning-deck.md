# DeckStructureTemplate: `learning-deck`

**Template ID**: `learning-deck`
**前提仕様**: `references/phase2-information-design/plan-json-v9-structure.md` (plan.json 全体構造)

---

## 0. TL;DR

- `learning-deck` は「**1 テーマを順番に教える学習デッキ**」用の構造テンプレート
- 読者は「学びたい人」。読了後に判断軸を獲得し、現場で動けるようになることがゴール
- StructureQA で **11 ルール** + テンプレ多様性 3 ルール (StructQA-70/71/72) で構造を機械強制
- Zod schema は `defineDeckStructure({ ... })` の Hybrid 方式で動的生成

---

## 1. Template の Declarative Spec

```js
// scripts/render/deck-structures/learning-deck.js
const { defineDeckStructure } = require('./define');

module.exports = defineDeckStructure({
  id: 'learning-deck',
  description:
    '学習デッキ。1 テーマを順番に教えていく構成。読者は学びたい人。' +
    '読了後に「判断軸」を獲得し、現場で動けることがゴール。',

  // -----------------------------------------------------------------
  // header: 序盤固定枠 (4 必須 + 1 任意)
  // -----------------------------------------------------------------
  header: [
    {
      position: 0,
      template_id: 'SECTION-1',
      required: true,
      rule: 'StructQA-01',
      message: 'header[0] は SECTION-1 (表紙) 必須',
    },
    {
      position: 1,
      template_id: 'FRAMING-1',
      required: true,
      rule: 'StructQA-01',
      message: 'header[1] は FRAMING-1 (構築背景) 必須',
      fields: {
        // 3 ブロック必須
        detail_blocks: {
          block_kikkake: { type: 'string', minLength: 1 },
          block_kizuki:  { type: 'string', minLength: 1 },
          block_gimon:   { type: 'string', minLength: 1 },
        },
      },
    },
    {
      position: 2,
      template_id: 'FRAMING-2',
      required: true,
      rule: 'StructQA-01',
      message: 'header[2] は FRAMING-2 (Before/After リスト) 必須',
      fields: {
        items: { minLength: 4, maxLength: 6 },
      },
    },
    {
      position: 3,
      template_id: 'SECTION-6',
      required: true,
      rule: 'StructQA-01',
      message: 'header[3] は SECTION-6 (統合目次) 必須',
    },
    {
      position: 4,
      template_id: 'VISUAL-8',
      required: false,
      rule: 'StructQA-01',
      message: 'header[4] は任意 (VISUAL-8 グラレコサマリーを置く場合のみ)',
    },
  ],

  // -----------------------------------------------------------------
  // body: 章繰り返し
  // -----------------------------------------------------------------
  body: {
    count: { min: 2, max: 6 },          // 章数 2-6 (volumeConstraints で上書き可)

    head: [
      {
        position: 0,
        template_id: ['SECTION-2', 'SECTION-4', 'SECTION-5'],
        required: true,
        rule: 'StructQA-12',
        message: 'chapter.head[0] は章扉 (SECTION-2 / SECTION-4 / SECTION-5 のいずれか) 必須',
      },
      {
        position: 1,
        template_id: 'SECSUMMARY-1',
        required: true,
        rule: 'StructQA-12',
        message:
          'chapter.head[1] は SECSUMMARY-1 (SVG 主役の章見取り図) 必須。' +
          'svg / svg_file を必ず指定し、viewBox 1920x1080 + Noto Sans JP で描く',
      },
    ],

    content: {
      count: { min: 1, max: 8 },        // 章本文 1-8 枚 (volumeConstraints で上書き可)
      allowedTemplates: 'any',          // 'any' = 全テンプレ許可
      severity: { min: 'warn', max: 'warn' },  // 範囲外は warn (fatal にしない)
    },

    tail: [
      {
        position: 0,
        template_id: 'FRAMING-5',
        required: true,
        rule: 'StructQA-13',
        message: 'chapter.tail[0] は FRAMING-5 (章末まとめ) 必須',
        fields: {
          mode: { enum: ['comprehension', 'recap'] },
          items: { length: 3 },         // 3 件固定 (Magic Number 3)
        },
      },
    ],
  },

  // -----------------------------------------------------------------
  // footer: 末尾固定枠
  // -----------------------------------------------------------------
  footer: [
    {
      position: 0,
      template_id: 'SECTION-3',
      required: false,
      rule: 'StructQA-02',
      message: 'footer[0] は任意 (SECTION-3 クロージング)',
    },
    {
      position: 1,
      template_id: 'DATA-4',
      required: true,
      rule: 'StructQA-02',
      message: 'footer に DATA-4 (参考情報集 SR) 必須',
    },
    {
      position: 2,
      template_id: 'DATA-5',
      required: false,
      rule: 'StructQA-02',
      conditional: {
        // 用語が 3 件以上のときに必須化
        if: (deckJson) => countGlossaryTerms(deckJson) >= 3,
        message: '用語 3 件以上のため DATA-5 (用語集) 必須',
      },
    },
    {
      position: 3,
      template_id: 'FRAMING-4',
      required: true,
      rule: 'StructQA-02',
      message: 'footer に FRAMING-4 (お土産) 必須',
    },
    {
      position: 4,
      template_id: 'FRAMING-3',
      required: true,
      rule: 'StructQA-02',
      message: 'footer 末尾は FRAMING-3 (会社紹介) 必須',
    },
  ],

  // -----------------------------------------------------------------
  // globalConstraints: デッキ全体ルール
  // -----------------------------------------------------------------
  globalConstraints: {
    totalSlides: { min: 14, max: 60 },   // volumeConstraints.totalSlides で上書き可

    requiredTags: [
      {
        tag: 'flowchart',
        min: 1,
        rule: 'StructQA-21',
        templates: ['DIAGRAM-3'],
        nestedDiagrams: ['SCENE-06'],
        appliesIf: (deckJson) => deckJson.doc.decision_focused !== false,
        message:
          'FlowChart スライド (DIAGRAM-3 / SCENE-06) が 1 枚以上必須。' +
          '判断ロジックを絵で見せる学習デッキの最重要ルール。' +
          'doc.decision_focused: false で warn 格下げ可',
      },
    ],

    maxTags: [
      {
        tag: 'hub-and-spoke',
        max: 1,
        rule: 'StructQA-22',
        nestedDiagrams: ['SCENE-02'],
        countTargets: ['diagram.template_id', 'scene.template_id'],
        message:
          'ハブ&スポーク図 (SCENE-02) は 1 デッキ 1 枚まで。' +
          '5 並列要素なら LIST-3 / LIST-2、軸ベース配置なら DIAGRAM-1 を検討',
      },
    ],
  },
});
```

---

## 2. 構造定義の要点

### 2.1 header の固定要素

```
header[0]: SECTION-1     (表紙)             ── 必須
header[1]: FRAMING-1     (構築背景)         ── 必須・3 ブロック (kikkake/kizuki/gimon)
header[2]: FRAMING-2     (Before/After)      ── 必須・items 4-6 件
header[3]: SECTION-6     (統合目次)          ── 必須
header[4]: VISUAL-8      (グラレコサマリー)  ── 任意 (1 枚絵で全体俯瞰したい時)
```

`VISUAL-8` を入れる場合の位置は **header[4] (= header の末尾) のみ**。中盤に紛れ込ませると StructQA-01 fatal。

### 2.2 body.chapters[i] の固定要素

```
chapter.head[0]:    章扉 (SECTION-2 / SECTION-4 / SECTION-5 のいずれか)  ── 必須
chapter.head[1]:    SECSUMMARY-1 (主役 SVG)                              ── 必須
                    svg / svg_file 必須 / viewBox 1920x1080 / Noto Sans JP

chapter.content[]:  章本文 1-8 枚 (任意のテンプレ)                          ── 自由構成

chapter.tail[0]:    FRAMING-5 (章末まとめ)                                ── 必須
                    mode: 'comprehension' / 'recap' / items[3]
```

#### 見取り図 SECSUMMARY-1 は「主役ビジュアル一発のみ」

章扉直後は必ず SVG で「絵で覚える」読書体験を作る。SECSUMMARY-1 は
**「主役ビジュアル一発のみ」** に振り切る (タイトル / サブ / 全章 chips / 結論バーは描かない)。

- テンプレは画面 (10" × 5.625") 全体に SVG を貼るだけ (chrome は呼ばない)
- SVG も中央の主役ビジュアル 1 つだけ描く (装飾文字や帯は描かない)
- 章タイトルは章扉 (SECTION-2/4/5) で十分提示済み。SECSUMMARY-1 はその次に絵だけで地図を渡す

| 章の中身 | SVG 内のレイアウト方針 (主役ビジュアル単体) |
|---|---|
| 並列要素 4 個以上 + 各要素 1 行 | amber stroke + light yellow `#FEF3C7` のカードを 4-6 枚並べる |
| 関係性・世界観を 1 枚絵で示せる | 中央メタファー + 周辺要素を path で接続 |
| 時系列・段階性 | 縦 / 横の amber ステップフロー (STEP 1, 2, 3...) |
| 結論を強調したい | 主役構造の中で dark gray `#374151` 塗り + amber 文字を 1 箇所だけ |

レイアウトの基本骨格:
- canvas: `#FAFAF7` (warm-bg、SVG が viewBox 全体を塗る)
- 中央: 章固有の構造図 (amber stroke + light yellow `#FEF3C7` fill のカード) を viewBox の 70% 以上を使い大きく描く
- 強調点: dark gray (`#374151`) バー + amber 文字を 1 箇所だけ
- **章タイトル / サブ / 全章 chips / 結論バーは SVG 内に描かない**

詳細は `enostech-svg-diagram/references/pattern-catalog.md` の「SECSUMMARY-1 専用パターン」を参照。

### 2.3 footer の固定要素

```
footer[0]: SECTION-3   (クロージング)        ── 任意
footer[1]: DATA-4      (参考情報集 SR)       ── 必須
footer[2]: DATA-5      (用語集)             ── 条件付き必須 (用語 3 件以上)
footer[3]: FRAMING-4   (お土産)             ── 必須
footer[4]: FRAMING-3   (会社紹介)           ── 必須
```

任意要素 (SECTION-3 / DATA-5) を省略する場合は **位置を詰めて** 記述する (= footer.length が 3〜5 で可変)。

---

## 3. body.chapters のループ表現 (上下限と検査ロジック)

### 3.1 章数 (`chapters.length`)

| 制約 | 既定値 | 上書き可否 | 違反時 |
|---|---|---|---|
| 最小章数 | **2** | `volumeConstraints.chapters.count.min` | StructQA-04 fatal |
| 最大章数 | **6** | `volumeConstraints.chapters.count.max` | StructQA-04 fatal |

**理由**: 1 章しかない学習デッキは `learning-deck` の構造的価値 (章ごとに区切って覚えさせる) が消える。7 章以上は読者の集中力を超える (1 セッションで読み切れない長尺デッキは別 Template を検討する余地)。

### 3.2 章内本文枚数 (`chapter.content.length`)

| 制約 | 既定値 | 上書き可否 | 違反時 |
|---|---|---|---|
| 最小本文枚数 | **1** | `volumeConstraints.chapters.contentPerChapter.min` | StructQA-05 warn |
| 最大本文枚数 | **8** | `volumeConstraints.chapters.contentPerChapter.max` | StructQA-05 warn |

**理由**: 章扉 + 見取り図 + 章末まとめ (head 2 + tail 1 = 3 枚) は固定なので、章合計は 4-11 枚。1 章 12 枚超は subsection で分割するか、章を分けるべき。

### 3.3 デッキ総スライド数

| 制約 | 既定値 | 上書き可否 | 違反時 |
|---|---|---|---|
| 最小総枚数 | **14** | `volumeConstraints.totalSlides.min` | StructQA-06 fatal |
| 最大総枚数 | **60** | `volumeConstraints.totalSlides.max` | StructQA-06 fatal |

**計算式**:
```
total = header.length
      + Σ (chapters[i].head.length + chapters[i].content.length + chapters[i].tail.length)
      + footer.length
```

最小 14 の根拠: header(4) + chapters(2 章 × (head 2 + content 1 + tail 1)) + footer(2) = 4 + 8 + 2 = 14。

---

## 4. StructureQA-XX ルール体系 (11 ルール)

| Rule ID | Severity | 内容 |
|---|---|---|
| **StructQA-00** | fatal | `doc.deck_structure` 未指定 / Template ID 未登録 / version 不整合 |
| **StructQA-01** | fatal | `header` の順序・必須スライドが Template と一致 (length / template_id / 順序) |
| **StructQA-02** | fatal | `footer` の必須スライド (DATA-4 / FRAMING-3 / FRAMING-4) が存在 |
| **StructQA-03** | fatal | `body.chapters[i]` が `head[2] + content[N] + tail[1]` の構造 |
| **StructQA-04** | fatal | 章数が `count.min/max` (= 2-6) 範囲内 |
| **StructQA-05** | warn | 章内本文枚数が `content.count` (= 1-8) 範囲内 |
| **StructQA-06** | fatal | デッキ総スライド数が `totalSlides` (= 14-60) 範囲内 |
| **StructQA-12** | fatal | chapter.head[1] = SECSUMMARY-1 (SVG 必須) |
| **StructQA-13** | fatal | 各章の `tail[0]` が `FRAMING-5` (mode + items[3]) |
| **StructQA-21** | fatal (warn 格下げ可) | `decision_focused !== false` で FlowChart (`DIAGRAM-3` / nested `SCENE-06`) 1 枚以上 |
| **StructQA-22** | fatal | HubSpoke (`SCENE-02`) は 1 デッキ 1 枚まで |

合計 **11 ルール** (内訳: メタ 1 / header・footer 構造 2 / 章構造 6 / グローバル 2)。

> 番号体系: 0X = メタ・全体構造、1X = 章単位、2X = グローバル制約。10/20 番台に欠番があるのは将来の拡張のため。

### 4.1 各ルールの判定ロジック概要

#### StructQA-00 (Template メタ)
1. `doc.deck_structure` 未指定 → fatal
2. 値が registry (`scripts/render/deck-structures/index.js`) に未登録 → fatal
3. `deck_structure_version` が Template の version と meta-mismatch → warn

#### StructQA-01 (header)
1. `header.length < 4` → fatal
2. `header[0..3]` の `template_id` が `['SECTION-1', 'FRAMING-1', 'FRAMING-2', 'SECTION-6']` と一致しない → fatal
3. `header.length === 5` で `header[4].template_id !== 'VISUAL-8'` → fatal
4. `header.length > 5` → fatal

#### StructQA-02 (footer)
1. `footer` 内に `DATA-4` / `FRAMING-3` / `FRAMING-4` が **すべて存在** → そうでなければ fatal
2. `footer` 末尾が `FRAMING-3` でない → warn
3. `countGlossaryTerms(deckJson) >= 3` で `DATA-5` 不在 → fatal (条件付き必須)
4. footer に **header / body 用テンプレ** (FRAMING-1 / FRAMING-2 / SECTION-2 等) が混入 → fatal

#### StructQA-03 (章構造)
1. 全章で `chapter.head.length >= 1 && chapter.head.length <= 3` → fatal 該当
2. `chapter.tail.length <= 3` → fatal 該当
3. `head` の最初が章扉 (SECTION-2/4/5) かつ 2 枚目が見取り図 → fatal 該当 (= StructQA-12 と部分重複)

#### StructQA-04 (章数)
1. `body.chapters.length < count.min` → fatal
2. `body.chapters.length > count.max` → fatal

#### StructQA-05 (章内本文)
1. 各章で `chapter.content.length < content.count.min` → warn
2. 各章で `chapter.content.length > content.count.max` → warn

#### StructQA-06 (総枚数)
1. `getAllSlides(deckJson).length < totalSlides.min` → fatal
2. `getAllSlides(deckJson).length > totalSlides.max` → fatal

#### StructQA-12 (見取り図)
1. chapter.head[1].template_id が SECSUMMARY-1 でない → fatal
2. SECSUMMARY-1 で `svg` / `svg_file` のいずれも未指定 → SchemaQA-03 fatal
3. 章扉 (head[0]) の直後 (= head[1]) に位置していない → warn

#### StructQA-13 (章末)
1. 各章で `chapter.tail[0].template_id !== 'FRAMING-5'` → fatal
2. `tail[0].mode` が `comprehension` / `recap` 以外 → fatal
3. `tail[0].items.length !== 3` → fatal

#### StructQA-21 (FlowChart 必須)
1. `doc.decision_focused === false` → 検査 skip
2. 全スライド (`getAllSlides`) で `template_id === 'DIAGRAM-3'` または nested `diagram.template_id === 'SCENE-06'` が **0 件** → fatal
3. 1 件以上 → pass

#### StructQA-22 (HubSpoke 上限)
1. 全スライドで `diagram.template_id === 'SCENE-02'` または `scene.template_id === 'SCENE-02'` を count
2. count >= 2 → fatal

---

## 5. plan.json 例 (`learning-deck` 完全準拠の最小デッキ)

14 枚デッキ (= `learning-deck` の最小構成)。

```jsonc
{
  "doc": {
    "title": "Cloud Run GPU で Local LLM を運用する",
    "deck_type": "learning",
    "deck_structure": "learning-deck",
    "decision_focused": true,
    "summary_required": true,
    "references": [ /* ... */ ]
  },

  "header": [
    { "template_id": "SECTION-1", "title": "Cloud Run GPU で Local LLM を運用する" },
    {
      "template_id": "FRAMING-1",
      "title": "なぜ Cloud Run GPU の地図が要るのか",
      "detail_blocks": {
        "block_kikkake": "事業会社 X 社の情シス担当者が ChatGPT API のデータ送信に詰まった",
        "block_kizuki":  "自社 VPC 内で動かす選択肢を、誰も整理していなかった",
        "block_gimon":   "Cloud Run GPU は本当に商用 API の代替になるのか?"
      }
    },
    {
      "template_id": "FRAMING-2",
      "title": "このデッキを読むとこう変わる",
      "items": [
        { "before": "Local LLM = ローカル PC と思っていた", "after": "Cloud Run GPU でフルマネージドに動かす選択肢が見える" },
        { "before": "コストが読めず、提案できない", "after": "月額試算と前提を持って提案できる" },
        { "before": "OSS モデル選定に困っている", "after": "Llama / Gemma / Qwen の使い分け軸を持てる" },
        { "before": "採用判断の踏み込みができない", "after": "5 軸で go/no-go を即答できる" }
      ]
    },
    { "template_id": "SECTION-6", "title": "本資料の章立て" }
  ],

  "body": {
    "chapters": [
      {
        "id": "ch1",
        "code": "B",
        "name": "Local LLM とは何か",
        "head": [
          { "template_id": "SECTION-2", "title": "Local LLM とは何か" },
          { "template_id": "SECSUMMARY-1", "title": "1 章の見取り図", "svg_file": "..." }
        ],
        "content": [
          { "template_id": "COMPARE-1", "title": "商用 API vs 自社 VPC の対比" },
          { "template_id": "LIST-3", "title": "OSS LLM の主要 5 モデル" }
        ],
        "tail": [
          {
            "template_id": "FRAMING-5",
            "title": "1 章の持ち帰り",
            "mode": "comprehension",
            "items": [
              { "head": "Local LLM の定義", "body": "OSS モデル + 自前推論基盤の組み合わせ" },
              { "head": "5 OSS モデル",     "body": "Llama / Gemma / Qwen / Mistral / DeepSeek" },
              { "head": "判断軸の起点",     "body": "データ主権の有無で選択肢が二分される" }
            ]
          }
        ]
      },
      {
        "id": "ch2",
        "code": "C",
        "name": "Cloud Run GPU + Ollama アーキ",
        "head": [
          { "template_id": "SECTION-2", "title": "Cloud Run GPU + Ollama アーキ" },
          { "template_id": "SECSUMMARY-1", "title": "2 章の見取り図", "svg_file": "..." }
        ],
        "content": [
          { "template_id": "DIAGRAM-3", "title": "採用判断フロー", "diagram": { "template_id": "SCENE-06", "layout": "vertical-decision" } },
          { "template_id": "DATA-2",    "title": "Cloud Run GPU の月額試算" }
        ],
        "tail": [
          {
            "template_id": "FRAMING-5",
            "title": "2 章の持ち帰り",
            "mode": "comprehension",
            "items": [
              { "head": "アーキ全景",     "body": "Client → Cloud Run GPU → GCS の 3 段" },
              { "head": "コスト構造",     "body": "GPU 課金 + ストレージ 2 軸で読む" },
              { "head": "Go/No-go",       "body": "リクエスト 1 万/月 が損益分岐の目安" }
            ]
          }
        ]
      }
    ]
  },

  "footer": [
    { "template_id": "DATA-4",    "title": "本資料の主要な参考情報" },
    { "template_id": "FRAMING-4", "title": "持ち帰り — Cloud Run GPU PoC チェックリスト" },
    { "template_id": "FRAMING-3", "title": "ENOSTECH について" }
  ]
}
```

**枚数内訳**:
- header = 4
- chapters = 2 章 × (2 + 2 + 1) = 10
- footer = 3
- **合計 = 17 枚** (`totalSlides` 14-60 の範囲内)

---

## 6. テンプレ多様性ルール (StructQA-70/71/72)

osanai 氏の方針 (登山デッキの単調さに対する指摘) を機械強制する 3 ルール。
learning-deck のみで走る。`doc.diversity_check: false` で opt-out 可。

### 機械検出の分母 / 分子

| 分類 | テンプレ | regex |
|---|---|---|
| **VISUAL 系** (分子) | CHART-* / SCENE-* / DIAGRAM-1〜4 / DIAG-* / VISUAL-1〜12 / WEBPAGE-* | `/^(CHART-\|SCENE-\|DIAGRAM-[1-4]\b\|DIAG-\|VISUAL-\|WEBPAGE-)/` |
| **Card/Text 系** | LIST-* / COMPARE-* / PROJECT-* / DATA-1,2,3 / CODE-* / FREE-* | `/^(LIST-\|COMPARE-\|PROJECT-\|DATA-[123]\b\|CODE-\|FREE-)/` |
| **固定枠** (分母から除外) | SECTION-* / SECSUMMARY-* / QA-INDEX / FRAMING-3,4,5 / DATA-4,5 | `/^(SECTION-\|SECSUMMARY-\|QA-INDEX$\|FRAMING-[345]\b\|DATA-[45]\b)/` |

**分母 = body 全スライド (head + content + tail) − 固定枠**。これを「ユーザー選択枠」と呼ぶ。

### StructQA-70 [fatal] — VISUAL 比率 ≥ 50%

ユーザー選択枠で VISUAL 系比率が 50% 未満なら fatal。

- 分母 < 6 枚ならルール skip (短いデッキは比率の意味が薄い)
- メッセージ例: `StructQA-70: VISUAL 系比率 6% (1/16 枚) は最低ライン 50% を下回ります。`

### StructQA-71 — 同一テンプレ過剰使用

ユーザー選択枠で最頻テンプレが占める割合で severity が動的に決まる:

| 占有率 | severity |
|---|---|
| > 40% | **fatal** |
| > 30% (≤ 40%) | **warn** |
| ≤ 30% | OK |

- 分母 < 6 枚ならルール skip
- メッセージ例: `StructQA-71: 同一テンプレ "LIST-3" が 44% (7/16 枚) を占めています (40% 超で fatal)。`

### StructQA-72 [fatal] — Card/Text 系 3 連続以上禁止

body 中で Card/Text 系テンプレが 3 枚以上連続したら fatal。
固定枠 (章扉 / 見取り図 / 章末まとめ) が間に挟まればストリークはリセット。

- メッセージ例: `StructQA-72: Card/Text 系テンプレが 5 連続しています (LIST-3 → LIST-1 → LIST-3 → LIST-3 → LIST-2)。`

### Phase 2 で実践する手順

1. content slide を組む時、**最初の候補は CHART / SCENE / DIAGRAM / VISUAL / WEBPAGE 系**
2. 「数値の比較 / 順位」→ CHART-A1 / CHART-A3
3. 「関係図 / 構造図」→ SCENE-01〜06 / DIAGRAM-1〜4
4. 「実画像があるトピック」→ VISUAL-1 (profile) / VISUAL-2 (evidence) / VISUAL-3 (visual + body)
5. 「URL を引用」→ WEBPAGE-1〜4
6. 「ハウツーや並列要素 6 件以上」→ ここで初めて LIST-3 / LIST-2
7. 「箇条書きで十分」→ LIST-1
8. Card/Text 系を 3 枚並べる前に必ず 1 枚 VISUAL 系を挟む (StructQA-72 対策)

### opt-out

```json
{
  "doc": {
    "deck_structure": "learning-deck",
    "diversity_check": false
  }
}
```
