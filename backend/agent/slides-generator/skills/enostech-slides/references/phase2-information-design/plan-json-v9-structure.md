# plan.json 構造仕様

> **関連仕様**: `references/deck-structures/learning-deck.md` (Template 単位の構造定義)

---

## 0. TL;DR

- plan.json トップに **`header` / `body.chapters[]` / `footer` を明示分離**
- スライド単位の構造 (`template_id` / `title` / `fields`) は 1 スライド = 1 オブジェクト
- 章は `body.chapters[i]` に `head` / `content` / `tail` 3 区画で内部分割
- 構造系のチェックは StructureQA と Template 定義に集約 (`structure-qa.md` 参照)

---

## 1. 全体構造

```jsonc
{
  "doc": {
    "title": "...",
    "deck_type": "learning",
    "deck_structure": "learning-deck",       // Template 必須指定
    "deck_structure_version": "1.0",         // Template バージョン固定
    "deck_structure_reason": "...",          // 任意: Phase 1 R1-7 の判定理由
    "decision_focused": true,
    "summary_required": true,
    "volumeConstraints": { ... },            // Template の min/max 上書き (任意)
    "references": [ ... ]
  },

  "header": [                                          // 序盤固定枠
    { "template_id": "SECTION-1", ... },
    { "template_id": "FRAMING-1", ... },
    { "template_id": "FRAMING-2", ... },
    { "template_id": "SECTION-6", ... }
    // 任意で VISUAL-8 (グラレコサマリー) を末尾に追加可
  ],

  "body": {                                            // 本編 (章繰り返し)
    "chapters": [
      {
        "id": "ch1",
        "code": "B",
        "name": "本物の章 1",
        "head": [
          { "template_id": "SECTION-2", ... },         // 章扉 (固定)
          { "template_id": "SECSUMMARY-1", ... }       // 見取り図 (固定)
        ],
        "content": [                                   // 章本文 (自由構成)
          { "template_id": "LIST-3", ... },
          { "template_id": "DATA-2", ... }
        ],
        "tail": [
          { "template_id": "FRAMING-5", ... }          // 章末まとめ (固定)
        ]
      }
      /* ... 他章 ... */
    ]
  },

  "footer": [                                          // 末尾固定枠
    { "template_id": "SECTION-3", ... },               // クロージング (任意)
    { "template_id": "DATA-4", ... },                  // 参考情報集 (SR)
    { "template_id": "DATA-5", ... },                  // 用語集 (条件付き必須)
    { "template_id": "FRAMING-4", ... },               // お土産
    { "template_id": "FRAMING-3", ... }                // 会社紹介
  ],

  "qa_report": { ... },                                // StructureQA を含む
  "reviews": [ ... ]                                   // レビュー履歴
}
```

---

## 2. フィールド定義 (Zod schema レベル)

### 2.1 ルートオブジェクト (`PlanV9Schema`)

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `doc` | `DocV9Schema` | ✅ | デッキメタデータ |
| `header` | `SlideObj[]` | ✅ | 序盤固定枠。length は Template 規定 |
| `body` | `BodyV9Schema` | ✅ | 本編 (章繰り返し) |
| `footer` | `SlideObj[]` | ✅ | 末尾固定枠。length は Template 規定 |
| `qa_report` | `QaReportSchema` | optional | Phase 2/4 で詰める QA レポート |
| `reviews` | `ReviewSchema[]` | optional | レビュー履歴 |

トップレベルに `sections` フィールドがあれば `safeParse` が `unrecognized_keys` fatal を投げる。

### 2.2 `doc` (`DocV9Schema`)

```ts
const DocV9Schema = DocBaseSchema.extend({
  deck_structure: z.string.min(1, {
    message: 'StructQA-00: doc.deck_structure は必須 (例: "learning-deck")',
  }),
  deck_structure_version: z.string.regex(/^\d+\.\d+$/, {
    message: 'StructQA-00: バージョンは "X.Y" 形式 (例: "1.0")',
  }),
  deck_structure_reason: z.string.optional,

  // 任意 — Template の min/max を上書きしたい場合だけ指定
  volumeConstraints: VolumeConstraintsSchema.optional,

  // title, version, date, theme, theme_desc, purpose, reader, before_after,
  // deck_type, decision_focused, summary_required, references[], etc.
});
```

### 2.3 `header` (`SlideObj[]`)

序盤固定枠。各要素はスライド単位の Zod schema (`SlideBaseSchema` を template_id で discriminate) で検査される。

- **length と要素 template_id の照合は Template が規定** (`learning-deck` は 4 必須 + 任意 VISUAL-8 で max 5)
- 並び順も Template の `header[]` と一致しないと StructQA-01 fatal
- 各スライドの内部フィールドはスライド単位 schema と一致

### 2.4 `body` (`BodyV9Schema`)

```ts
const BodyV9Schema = z.object({
  chapters: z.array(ChapterV9Schema)
    .min(1, { message: 'StructQA-04: body.chapters は最低 1 章必須' })
    // 上限・下限は Template が後付けで refine
});
```

### 2.5 `body.chapters[i]` (`ChapterV9Schema`)

```ts
const ChapterV9Schema = z.object({
  id: z.string.min(1),                         // 章 ID (英小文字 / kebab-case 推奨)
  code: z.string.min(1).max(2),                // 章コード ("A" / "B" / "01" / "1.5" 等)
  name: z.string.min(1).max(40),               // 章タイトル (人間可読)

  head: z.array(SlideObjSchema)                  // 章頭固定 (扉 + 見取り図)
    .min(1)
    .max(3),                                     // Template 側で更に厳格化

  content: z.array(SlideObjSchema)               // 章本文 (自由構成)
    .min(0),                                     // 上下限は Template が後付け

  tail: z.array(SlideObjSchema)                  // 章末固定 (FRAMING-5 等)
    .min(0)
    .max(3),                                     // Template 側で厳格化
});
```

### 2.6 `footer` (`SlideObj[]`)

末尾固定枠。配置順序は Template が規定。`learning-deck` のデフォルト順序:

```
footer[0]: SECTION-3       (クロージング・任意)
footer[1]: DATA-4          (参考情報集 SR・必須)
footer[2]: DATA-5          (用語集・条件付き必須 = doc.references.glossary[].length >= 3)
footer[3]: FRAMING-4       (お土産・必須)
footer[4]: FRAMING-3       (会社紹介・必須)
```

任意スライドが無ければその位置を詰める (例: クロージング無しなら footer.length = 4)。

### 2.7 `volumeConstraints` (任意・上書き専用)

Template の min/max を **デッキ単位で上書き** したい時に指定。未指定なら Template 既定値が適用される。

```ts
const VolumeConstraintsSchema = z.object({
  totalSlides: z.object({
    min: z.number.int.positive,
    max: z.number.int.positive,
  }).optional,

  chapters: z.object({
    count: z.object({
      min: z.number.int.positive,
      max: z.number.int.positive,
    }).optional,
    contentPerChapter: z.object({
      min: z.number.int.min(0),
      max: z.number.int.positive,
    }).optional,
  }).optional,
});
```

**例**: 短尺学習デッキ (8 枚程度) を作りたい時:

```jsonc
"volumeConstraints": {
  "totalSlides": { "min": 8, "max": 14 },
  "chapters": {
    "count": { "min": 1, "max": 2 },
    "contentPerChapter": { "min": 1, "max": 3 }
  }
}
```

### 2.8 `SlideObj` (スライド単位)

`template_id` で discriminated union され、Zod schema (`scripts/render/schemas/templates/index.js`) が個別スライド検査を担当。

```ts
const SlideObjSchema = z.discriminatedUnion('template_id', [
  Section1Schema,
  Section2Schema,
  /* ... 全 54 + α テンプレ ... */
  Framing1Schema,
  Framing2Schema,
  Framing3Schema,
  Framing4Schema,
  Framing5Schema,
  /* ... */
]);
```

スライド単位検査は SchemaQA-01〜11/13〜16 が担当。

---

## 3. 必須スライドと固定枠 (`learning-deck` 準拠)

### 3.1 header の必須スライド

| 位置 | template_id | 必須 / 任意 | 役割 |
|---|---|---|---|
| header[0] | `SECTION-1` | ✅ 必須 | 表紙 |
| header[1] | `FRAMING-1` | ✅ 必須 | 構築背景 (3 ブロック: kikkake / kizuki / gimon) |
| header[2] | `FRAMING-2` | ✅ 必須 | Before/After リスト (4-6 行) |
| header[3] | `SECTION-6` | ✅ 必須 | 統合目次 |
| header[4] | `VISUAL-8` | 任意 | グラレコサマリー (1 枚絵で全体俯瞰) |

`VISUAL-8` を入れる場合は **必ず header[4]** (= header の末尾)。中盤に紛れ込ませるのは StructQA-01 fatal。

### 3.2 body.chapters[i] の必須構造

| 位置 | template_id | 必須 / 任意 | 役割 |
|---|---|---|---|
| `chapter.head[0]` | `SECTION-2` / `SECTION-4` / `SECTION-5` のいずれか | ✅ 必須 | 章扉 |
| `chapter.head[1]` | `SECSUMMARY-1` / `LIST-3` / `LIST-7` / `DIAG-06` / `DIAGRAM-4` のいずれか | ✅ 必須 | 章の見取り図 |
| `chapter.content[]` | 任意のテンプレ (Template の allowedTemplates 制約あり) | 自由 | 章本文 |
| `chapter.tail[0]` | `FRAMING-5` | ✅ 必須 (`learning-deck` のみ) | 章末まとめ |

見取り図媒体の選定基準は StructQA-12 のメッセージに **判定表** を埋め込む (sections-qa.md の表をそのまま参照)。

### 3.3 footer の必須スライド

| 位置 | template_id | 必須 / 任意 | 役割 |
|---|---|---|---|
| footer[0] | `SECTION-3` | 任意 | クロージング (「ご清聴ありがとうございました」等) |
| (any) | `DATA-4` | ✅ 必須 | 参考情報集 (SR) |
| (any) | `DATA-5` | 条件付き必須 | 用語集 (`doc.glossary[]` または content 内の用語が **3 件以上** で必須) |
| (any) | `FRAMING-4` | ✅ 必須 | お土産 (Skill / チートシート 1 件深掘り) |
| (any) | `FRAMING-3` | ✅ 必須 | 会社紹介 (受賞ロゴ込み) |

順序は Template の規定に従う。`learning-deck` の既定順序は §2.6 を参照。

---

## 4. 構造ルールの明示

### 4.1 `decision_focused: true` 時の FlowChart 必須

- `doc.decision_focused !== false` (= true または未指定) のデッキは、**全スライドのいずれかに**:
  - `template_id === "DIAGRAM-3"` のスライドが 1 枚以上、または
  - 任意スライドの `diagram.template_id === "SCENE-06"` のネスト diagram が 1 つ以上
- どちらも無ければ **StructQA-21 fatal**

検出範囲は `getAllSlides(deckJson)` で flatten した全スライド (header / body.chapters[*].(head/content/tail) / footer)。

### 4.2 ハブ&スポーク (HubSpoke) 上限

- 任意スライドの `diagram.template_id === "SCENE-02"` または `scene.template_id === "SCENE-02"` を **2 枚以上** 含むデッキは **StructQA-22 fatal**

### 4.3 章数の上下限

- `learning-deck`: `body.chapters.length` は **2 以上 6 以下** (デフォルト)
- `volumeConstraints.chapters.count.{min,max}` で上書き可能
- 範囲外なら **StructQA-04 fatal**

### 4.4 章内本文ページ数

- `learning-deck`: `chapter.content.length` は **1 以上 8 以下** (デフォルト)
- `volumeConstraints.chapters.contentPerChapter.{min,max}` で上書き可能
- 範囲外なら **StructQA-05 warn** (fatal にしない・著者裁量を残す)

### 4.5 デッキ総スライド数

- `learning-deck` 既定: `getAllSlides(deckJson).length` は **14 以上 60 以下**
- 計算式: header (4-5) + body.chapters[i].(head + content + tail).sum + footer (3-5)
- `volumeConstraints.totalSlides` で上書き可能
- 範囲外なら **StructQA-06 fatal**

---

## 5. マイグレーション例

`decks/2026-05-02_gemini-file-search-intro/plan.json` の構造例:

```jsonc
{
  "doc": {
    "deck_type": "learning",
    "deck_structure": "learning-deck",
    "deck_structure_version": "1.0",
    "decision_focused": true
  },
  "header": [
    { "template_id": "SECTION-1", /* 表紙 */ },
    { "template_id": "FRAMING-1", /* 構築背景 */ },
    { "template_id": "FRAMING-2", /* Before/After */ },
    { "template_id": "SECTION-6", /* 目次 */ }
  ],
  "body": {
    "chapters": [
      {
        "id": "ch1", "code": "B", "name": "RAG 実装の地図",
        "head":    [ { "template_id": "SECTION-2" }, { "template_id": "DIAGRAM-4" } ],
        "content": [ { "template_id": "DIAGRAM-1" } ],
        "tail":    [ { "template_id": "FRAMING-5" } ]
      },
      {
        "id": "ch2", "code": "C", "name": "仕組み",
        "head":    [ { "template_id": "SECTION-2" }, { "template_id": "DIAGRAM-4" } ],
        "content": [ { "template_id": "LIST-4" }, { "template_id": "LIST-8" } ],
        "tail":    [ { "template_id": "FRAMING-5" } ]
      },
      {
        "id": "ch3", "code": "D", "name": "比較で意思決定",
        "head":    [ { "template_id": "SECTION-2" }, { "template_id": "DIAGRAM-4" } ],
        "content": [ { "template_id": "DATA-2" }, { "template_id": "DIAGRAM-3" } ],
        "tail":    [ { "template_id": "FRAMING-5" } ]
      },
      {
        "id": "ch4", "code": "E", "name": "制約と料金",
        "head":    [ { "template_id": "SECTION-2" }, { "template_id": "DIAGRAM-4" } ],
        "content": [ { "template_id": "LIST-2" }, { "template_id": "DATA-1" } ],
        "tail":    [ { "template_id": "FRAMING-5" } ]
      }
    ]
  },
  "footer": [
    { "template_id": "FRAMING-4", /* お土産 */ },
    { "template_id": "DATA-4",    /* 参考情報集 */ },
    { "template_id": "FRAMING-3", /* 会社紹介 */ }
  ]
}
```

**StructureQA 検査結果 (期待)**:
- ✅ StructQA-01 (header 順序) — pass
- ✅ StructQA-02 (footer 順序) — pass (DATA-5 は用語 0 件で省略)
- ✅ StructQA-03 (章 head/tail 構造) — pass
- ✅ StructQA-04 (章数 4 ∈ [2,6]) — pass
- ✅ StructQA-12 (章扉直後の見取り図) — pass (DIAGRAM-4 = 見取り図媒体に適合)
- ✅ StructQA-13 (章末 FRAMING-5) — pass (全章に存在)
- ✅ StructQA-21 (FlowChart 1 枚以上) — pass (ch3 に DIAGRAM-3)
- ✅ StructQA-22 (HubSpoke 上限) — pass (SCENE-02 の使用なし)

---

## 6. JSON Schema 風 完全仕様

```ts
// scripts/render/schemas/plan-v9.js
const PlanV9Schema = z.object({
  doc: DocV9Schema,

  header: z.array(SlideObjSchema)
    .min(1, { message: 'StructQA-01: header は最低 1 枚必須' }),

  body: z.object({
    chapters: z.array(z.object({
      id: z.string.min(1),
      code: z.string.min(1).max(2),
      name: z.string.min(1).max(40),
      head: z.array(SlideObjSchema).min(1).max(3),
      content: z.array(SlideObjSchema).min(0),
      tail: z.array(SlideObjSchema).min(0).max(3),
    })).min(1, { message: 'StructQA-04: chapters は最低 1 章必須' }),
  }),

  footer: z.array(SlideObjSchema)
    .min(1, { message: 'StructQA-02: footer は最低 1 枚必須' }),

  qa_report: QaReportSchema.optional,
  reviews: z.array(ReviewSchema).optional,
}).strict({ message: 'StructQA-00: 未知のトップレベルキー' });
```

`PlanV9Schema` 自体は構造の **下限** のみ規定。Template (`learning-deck` 等) は `PlanV9Schema.refine(...)` でさらに厳格化する (例: header の 4 枚目に SECTION-6 が必須、等)。

---

## 7. 実装の在り処

| 項目 | 実装場所 |
|---|---|
| `PlanV9Schema` 本体 | `scripts/render/schemas/plan-v9.js` |
| `defineDeckStructure` | `scripts/render/deck-structures/define.js` |
| `learning-deck` Template | `scripts/render/deck-structures/learning-deck.js` |
| `validateDeckStructure` | `scripts/render/build-deck.js` |
| `getAllSlides` ヘルパー | `scripts/render/build-deck.js` |
