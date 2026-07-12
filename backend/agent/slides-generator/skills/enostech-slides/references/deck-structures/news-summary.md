# DeckStructureTemplate: `news-summary`

**Template ID**: `news-summary`
**位置付け**: learning-deck と対になる「読んで知る」系デッキの構造テンプレート
**前提仕様**: `references/phase2-information-design/plan-json-v9-structure.md` (plan.json 全体構造)

---

## 0. TL;DR

- `news-summary` は「**複数のニュース記事や業界トピックを並べて整理し、読み手に『今この領域で何が起きているか』を素早く伝える**」用の構造テンプレート
- 読者は「素早く全体感を把握したい人」。読了後にトピックの全景と各記事の要点を持ち帰ってもらうのがゴール
- learning-deck との最大差分: **章末まとめ FRAMING-5 不要 / 章扉直後の見取り図不要 / FlowChart 不要 / 出典系テンプレが必須**
- StructQA-00〜06 / 21 / 22 / 23 = **10 ルール**
- 既存テンプレで完全に組める (新規テンプレ追加不要)

---

## 1. Template の Declarative Spec

```js
// scripts/render/deck-structures/news-summary.js
const { defineDeckStructure } = require('./_helper');

module.exports = defineDeckStructure({
  id: 'news-summary',
  description:
    'ニュース要約デッキ。複数のニュース記事や業界トピックを並べて整理し、' +
    '読み手に「今この領域で何が起きているか」を素早く伝える。' +
    '章概念は最小化、各カードがスタンドアロン、出典明示が最重要。',

  // -----------------------------------------------------------------
  // header: 序盤固定枠 (3 必須)
  // -----------------------------------------------------------------
  header: [
    {
      position: 0,
      template_id: 'SECTION-1',
      required: true,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[0] は SECTION-1 (表紙) 必須',
    },
    {
      position: 1,
      template_id: ['SECSUMMARY-1', 'FRAMING-2', 'WEBPAGE-1'],
      required: true,
      rule: 'StructQA-01',
      message:
        'StructQA-01: header[1] はヘッドライン要約必須 ' +
        '(SECSUMMARY-1: 全景 SVG / FRAMING-2: Before/After / WEBPAGE-1: トップ記事 のいずれか)。' +
        '判定基準: 1 枚絵で全景を見せたい → SECSUMMARY-1 / 読者の認識変化を約束する → FRAMING-2 / ' +
        'メイン記事を最初に見せる → WEBPAGE-1',
    },
    {
      position: 2,
      template_id: 'SECTION-6',
      required: true,
      rule: 'StructQA-01',
      message: 'StructQA-01: header[2] は SECTION-6 (目次) 必須',
    },
  ],

  // -----------------------------------------------------------------
  // body: 章繰り返し (1-3 章、ニュースを束ねるテーマで分けるが 1 章でも OK)
  // -----------------------------------------------------------------
  body: {
    count: { min: 1, max: 3 },

    head: [
      {
        position: 0,
        template_id: ['SECTION-2', 'SECTION-4', 'SECTION-5'],
        required: true,
        rule: 'StructQA-12',
        message: 'StructQA-12: chapter.head[0] は章扉 (SECTION-2 / SECTION-4 / SECTION-5) 必須',
      },
      // 見取り図は強制しない (章 1 つだとオーバーキル)
    ],

    content: {
      count: { min: 2, max: 8 },      // ニュース項目 2-8 件 / 章
      allowedTemplates: 'any',
      severity: { min: 'warn', max: 'warn' },
    },

    tail: [],                          // ★ 章末まとめ FRAMING-5 不要 (差別化最大ポイント)
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
      message: 'StructQA-02: footer の SECTION-3 (クロージング) は任意',
    },
    {
      position: 1,
      template_id: 'WEBPAGE-2',
      required: true,
      rule: 'StructQA-02',
      message:
        'StructQA-02: footer に WEBPAGE-2 (出典クレジット集 = 関連URLカードグリッド) 必須。' +
        'ニュース要約はソース明示が信頼性の根幹',
    },
    {
      position: 2,
      template_id: 'DATA-4',
      required: true,
      rule: 'StructQA-02',
      message: 'StructQA-02: footer に DATA-4 (参考情報集 SR) 必須',
    },
    {
      position: 3,
      template_id: 'FRAMING-4',
      required: true,
      rule: 'StructQA-02',
      message:
        'StructQA-02: footer に FRAMING-4 (所感・感想 = お土産枠を「読み手への問いかけ」として流用) 必須',
    },
    {
      position: 4,
      template_id: 'FRAMING-3',
      required: true,
      rule: 'StructQA-02',
      message: 'StructQA-02: footer 末尾は FRAMING-3 (会社紹介) 必須',
    },
  ],

  // -----------------------------------------------------------------
  // globalConstraints
  // -----------------------------------------------------------------
  globalConstraints: {
    totalSlides: { min: 8, max: 30 },

    requiredTags: [
      {
        tag: 'web-card',
        min: 1,
        rule: 'StructQA-23',
        templates: ['WEBPAGE-1', 'WEBPAGE-2', 'WEBPAGE-3', 'WEBPAGE-4', 'VISUAL-7'],
        appliesIf: () => true,         // ニュース要約は無条件で必須
        message:
          'StructQA-23: news-summary は WEBPAGE-1〜4 / VISUAL-7 のいずれかを 1 枚以上必須。' +
          'ニュース要約は「どこの誰がいつ書いた記事か」が読者にとっての判断材料の核',
      },
      {
        tag: 'flowchart',
        min: 1,
        rule: 'StructQA-21',
        templates: ['DIAGRAM-3'],
        nestedDiagrams: ['SCENE-06'],
        appliesIf: (deckJson) => deckJson.doc && deckJson.doc.decision_focused === true,
        message:
          'StructQA-21: doc.decision_focused: true 明示時のみ FlowChart (DIAGRAM-3 / SCENE-06) を 1 枚以上必須。' +
          'news-summary はデフォルトで decision_focused: false 想定 (= 検査 skip)',
      },
    ],

    maxTags: [
      {
        tag: 'hub-and-spoke',
        max: 1,
        rule: 'StructQA-22',
        nestedDiagrams: ['SCENE-02'],
        message:
          'StructQA-22: ハブ&スポーク図 (SCENE-02) は 1 デッキ 1 枚まで。' +
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
header[0]: SECTION-1                                    ── 必須 (表紙)
header[1]: SECSUMMARY-1 / FRAMING-2 / WEBPAGE-1         ── 必須 (3 候補から OR)
header[2]: SECTION-6                                    ── 必須 (目次)
```

ニュース要約デッキでは「個別事案の背景」より「複数記事の全景」が先に来るため、
header[1] を 3 候補から選ぶ OR ルールにする。

#### header[1] 媒体の選定基準

| デッキの主旨 | 推奨媒体 |
|---|---|
| 業界全体の地図を 1 枚絵で先に示したい | `SECSUMMARY-1` (フルブリード SVG) |
| 「読み手の認識がこう変わる」を Before/After で約束したい | `FRAMING-2` |
| メイン記事 1 本を最初に大きく見せたい | `WEBPAGE-1` (1 記事ヒーロー) |

### 2.2 body.chapters[i] の固定要素

```
chapter.head[0]:    章扉 (SECTION-2 / SECTION-4 / SECTION-5)  ── 必須
                    ※ 見取り図は強制しない

chapter.content[]:  ニュース項目本文 2-8 枚 (任意のテンプレ)    ── 自由構成

chapter.tail:       []  ★ 空配列を強制 (FRAMING-5 不要)
```

#### 章末まとめ撤去の理由

ニュース要約デッキは「読了後に章ごとの判断軸を持ち帰る」ものではなく「全体感を把握する」もの。
個別記事のスタンドアロン性が高いほど読み手の認知負荷が下がるため、`FRAMING-5` 章末まとめは
**むしろ邪魔になる** (= 「この章で言いたいことはこれ」と再総括する意味が薄い)。

### 2.3 footer の固定要素

```
footer[0]: SECTION-3       ── 任意 (クロージング)
footer[1]: WEBPAGE-2       ── 必須 ★ news-summary 固有の出典クレジット集
footer[2]: DATA-4          ── 必須 (参考情報集 SR)
footer[3]: FRAMING-4       ── 必須 (所感・感想)
footer[4]: FRAMING-3       ── 必須 (会社紹介)
```

`WEBPAGE-2` (4-6 件のカードグリッド) を footer 必須化することで「**どの媒体のどの記事を引いたか**」を
1 枚で見せられる。ニュース要約デッキの信頼性の根幹。

`FRAMING-4` (お土産) は news-summary では **「読み手への問いかけ・所感共有」**として流用する
(テンプレ自体は同じ、使い方の意味付けが異なる)。

---

## 3. body.chapters のループ表現 (上下限と検査ロジック)

### 3.1 章数 (`chapters.length`)

| 制約 | 既定値 | 上書き可否 | 違反時 |
|---|---|---|---|
| 最小章数 | **1** | `volumeConstraints.chapters.count.min` | StructQA-04 fatal |
| 最大章数 | **3** | `volumeConstraints.chapters.count.max` | StructQA-04 fatal |

**理由**: 1 章でも成立する (= 「今週の 5 本」を単一の章に並べる構成)。
3 章超は読者の集中力を超え、ニュース要約の即読性が失われる。

### 3.2 章内本文枚数 (`chapter.content.length`)

| 制約 | 既定値 | 上書き可否 | 違反時 |
|---|---|---|---|
| 最小本文枚数 | **2** | `volumeConstraints.chapters.contentPerChapter.min` | StructQA-05 warn |
| 最大本文枚数 | **8** | `volumeConstraints.chapters.contentPerChapter.max` | StructQA-05 warn |

**理由**: 1 件だけの章は意味がない (章扉が冗長になる)。
8 件超は章を分割するか、ニュース 1 本ごとに WEBPAGE-3 で深掘りに切り替える判断ポイント。

### 3.3 デッキ総スライド数

| 制約 | 既定値 | 上書き可否 | 違反時 |
|---|---|---|---|
| 最小総枚数 | **8** | `volumeConstraints.totalSlides.min` | StructQA-06 fatal |
| 最大総枚数 | **30** | `volumeConstraints.totalSlides.max` | StructQA-06 fatal |

**計算式**: header + Σchapters + footer。

最小 8 の根拠: header(3) + chapters(1 章 × (head 1 + content 2 + tail 0)) + footer(2 = 必須 4 のうち SECTION-3 抜き) = 3 + 3 + 2 = 8。

最大 30 の根拠: ニュース要約は 30 枚を超えると「素早く読む」というデッキの主旨と矛盾する。
それより長くなるなら learning-deck か別 Template を検討する設計判断のトリガー。

---

## 4. StructureQA-XX ルール体系 (10 ルール)

| Rule ID | Severity | 内容 | learning-deck との差 |
|---|---|---|---|
| **StructQA-00** | fatal | `doc.deck_structure` 未指定 / 未登録 / version 不整合 | 同 |
| **StructQA-01** | fatal | header の順序・必須テンプレ (SECTION-1 / [SECSUMMARY-1\|FRAMING-2\|WEBPAGE-1] / SECTION-6) | **header[1] が OR 候補 / 全 3 枚 (learning-deck は 4 枚)** |
| **StructQA-02** | fatal | footer の必須テンプレ (WEBPAGE-2 / DATA-4 / FRAMING-3 / FRAMING-4) | **WEBPAGE-2 必須が新規 / SECTION-3 任意** |
| **StructQA-03** | fatal | chapter は head + content + tail 構造 (head 1 枚 / tail 0 枚) | **head 1 枚 (learning-deck は 2 枚) / tail 空** |
| **StructQA-04** | fatal | 章数 1-3 (learning-deck は 2-6) | **下限 1 で 1 章 OK** |
| **StructQA-05** | warn | 章内本文 2-8 枚 (learning-deck は 1-8) | **下限 2 (1 件章は無意味)** |
| **StructQA-06** | fatal | 総スライド 8-30 枚 (learning-deck は 14-60) | **短尺デッキ向け** |
| **StructQA-21** | warn (条件付き) | `doc.decision_focused === true` 明示時のみ FlowChart 1 枚以上必須 | **conditional warn / appliesIf を逆向きに** |
| **StructQA-22** | fatal | HubSpoke (SCENE-02) は 1 デッキ 1 枚まで | 同 |
| **StructQA-23** | **fatal** | **WEBPAGE-1/2/3/4 / VISUAL-7 のいずれかを 1 枚以上必須** | **news-summary 専用** |

合計 **10 ルール** (内訳: メタ 1 / header・footer 2 / 章構造 3 / 総数 1 / グローバル 3)。
learning-deck の StructQA-12 (見取り図) / StructQA-13 (章末) は news-summary では適用しない (head 1 枚 / tail 0 枚のため)。

### 4.1 各ルールの判定ロジック概要 (差分のみ)

#### StructQA-01 (header)
1. `header.length !== 3` → fatal
2. `header[0].template_id !== 'SECTION-1'` → fatal
3. `header[1].template_id` が `['SECSUMMARY-1', 'FRAMING-2', 'WEBPAGE-1']` のいずれでもない → fatal
4. `header[2].template_id !== 'SECTION-6'` → fatal

#### StructQA-02 (footer)
1. footer 内に `WEBPAGE-2` / `DATA-4` / `FRAMING-3` / `FRAMING-4` が **すべて存在** → そうでなければ fatal
2. footer 末尾が `FRAMING-3` でない → warn
3. footer に header / body 用テンプレが混入 → fatal

#### StructQA-03 (章構造)
1. 全章で `chapter.head.length === 1` → fatal 該当
2. 全章で `chapter.tail.length === 0` → fatal 該当
3. `head[0]` が章扉 (SECTION-2/4/5) → fatal 該当

#### StructQA-04 (章数)
1. `body.chapters.length < 1` → fatal
2. `body.chapters.length > 3` → fatal

#### StructQA-21 (FlowChart)
1. `doc.decision_focused !== true` → 検査 skip (デフォルト)
2. `doc.decision_focused === true` 明示時のみ DIAGRAM-3 / SCENE-06 を 1 枚以上必須 → 0 件で warn

#### StructQA-23 (Web カード必須)
1. 全スライド (`getAllSlides`) で `template_id ∈ ['WEBPAGE-1','WEBPAGE-2','WEBPAGE-3','WEBPAGE-4','VISUAL-7']` を count
2. count === 0 → fatal
3. 1 件以上 → pass

---

## 5. plan.json 例 (`news-summary` 完全準拠の最小デッキ)

13 枚デッキ。「2026 GW の AI スタートアップ動向 — 5 本のニュースで読む」想定。

```jsonc
{
  "doc": {
    "title": "2026 GW AI スタートアップ動向 — 5 本のニュースで読む",
    "deck_type": "news",
    "deck_structure": "news-summary",
    "decision_focused": false,
    "summary_required": true,
    "references": [ /* ... */ ]
  },

  "header": [
    {
      "template_id": "SECTION-1",
      "title": "2026 GW AI スタートアップ動向",
      "subtitle": "5 本のニュースで読む直近 2 週間"
    },
    {
      "template_id": "SECSUMMARY-1",
      "title": "今週の 5 本 — 全景",
      "section_no": "0",
      "section_title": "ヘッドライン",
      "one_line": "資金調達 / 製品リリース / 提携 / 規制 / 人事の 5 軸で読む"
    },
    {
      "template_id": "SECTION-6",
      "title": "本資料の構成",
      "subtitle": "5 本のニュースを並列に並べ、最後に所感と参考リンク集で締める"
    }
  ],

  "body": {
    "chapters": [
      {
        "id": "ch1",
        "code": "1",
        "name": "今週の 5 本",
        "head": [
          { "template_id": "SECTION-2", "title": "今週の 5 本", "number": "1" }
        ],
        "content": [
          { "template_id": "WEBPAGE-1", "title": "Anthropic、Series F 75 億ドル調達", "site_name": "TechCrunch", "article_url": "https://...", "image_path": "...", "subtitle": "..." },
          { "template_id": "WEBPAGE-1", "title": "OpenAI o4 モデル一般公開", "site_name": "OpenAI Blog", "article_url": "https://...", "image_path": "...", "subtitle": "..." },
          { "template_id": "WEBPAGE-3", "title": "Mistral × Microsoft 提携の詳細",
            "site_name": "Reuters",
            "image_path": "...",
            "article_url": "https://...",
            "blocks": [
              { "head": "要点", "body": "..." },
              { "head": "背景・経緯", "body": "..." },
              { "head": "所感・読み解き", "body": "..." }
            ]
          },
          { "template_id": "WEBPAGE-1", "title": "EU AI Act 第一弾施行", "site_name": "Politico EU", "article_url": "https://...", "image_path": "...", "subtitle": "..." },
          { "template_id": "WEBPAGE-4", "title": "OpenAI 主席科学者交代 — 3 媒体の論調比較",
            "row_labels": ["焦点", "根拠", "含意"],
            "articles": [ /* 3 件 */ ]
          }
        ],
        "tail": []
      }
    ]
  },

  "footer": [
    {
      "template_id": "WEBPAGE-2",
      "title": "本日取り上げた 5 本 — 出典まとめ",
      "items": [ /* 4-6 件 */ ]
    },
    {
      "template_id": "DATA-4",
      "title": "本資料の主要な参考情報"
    },
    {
      "template_id": "FRAMING-4",
      "title": "読者への問いかけ — 来週どこを見ておくか"
    },
    {
      "template_id": "FRAMING-3",
      "title": "ENOSTECH について"
    }
  ]
}
```

**枚数内訳**:
- header = 3
- chapters = 1 章 × (1 + 5 + 0) = 6
- footer = 4
- **合計 = 13 枚** (`totalSlides` 8-30 の範囲内)

---

## 6. 実装上の注意点

### 6.1 head 1 枚 (見取り図なし) 対応

- `chapter.head` は learning-deck で 2 枚必須だが news-summary では 1 枚のみ
- `_helper.js::chapterRuleToZod` は `spec.body.head.length` に応じて動的に検証する設計のため**変更不要**

### 6.2 tail 空配列対応

- `chapter.tail` の min/max が `0 = 0` となる
- `_helper.js::chapterRuleToZod` は `tailExpected = 0` のとき `.min(0).max(0)` を生成する → 空配列がそのまま通る

### 6.3 footer の WEBPAGE-2 必須

- `footerRuleToZod` は単一テンプレ ID の必須存在を検査する設計 → `WEBPAGE-2` を required: true で渡せばそのまま通る

### 6.4 StructQA-23 (Web カード必須) の追加

`scripts/render/lib/structure-qa.js` への追加:

```js
const RULE_CATEGORIES = {
  ...
  web_card: ['StructQA-23'],
};

const RULE_DEFAULT_LEVEL = {
  ...
  'StructQA-23': 'fatal',
};

const RULE_SUGGESTIONS = {
  ...
  'StructQA-23':
    'デッキに WEBPAGE-1 / WEBPAGE-2 / WEBPAGE-3 / WEBPAGE-4 / VISUAL-7 のいずれかを 1 枚以上置いてください。' +
    'news-summary は「どこの媒体のどの記事を引いたか」が読者にとっての判断材料の核です。',
};
```

ロジック自体は既存の `globalConstraints.requiredTags` 検査ループ (`_helper.js::defineDeckStructure` の `superRefine`) でカバー済み。追加実装不要。

---

## 7. 既存テンプレで足りるか — 検証済 ✅

| 用途 | 利用テンプレ |
|---|---|
| 表紙 | `SECTION-1` |
| ヘッドライン要約 | `SECSUMMARY-1` / `FRAMING-2` / `WEBPAGE-1` |
| 目次 | `SECTION-6` |
| 章扉 | `SECTION-2` / `SECTION-4` / `SECTION-5` |
| ニュース項目 (単独) | `WEBPAGE-1` |
| ニュース項目 (深掘り) | `WEBPAGE-3` |
| ニュース項目 (媒体比較) | `WEBPAGE-4` |
| 出典クレジット集 | `WEBPAGE-2` |
| 参考情報集 | `DATA-4` |
| 所感・問いかけ | `FRAMING-4` (意味付けの流用) |
| 会社紹介 | `FRAMING-3` |
| クロージング | `SECTION-3` |

**新規テンプレ追加なし**で `news-summary` は組み立て可能。

---

## 8. learning-deck との対比表 (要点だけ)

| 観点 | learning-deck | news-summary |
|---|---|---|
| 読者像 | 学びたい人 (理解 → 動ける) | 全体感を素早く把握したい人 |
| ゴール | 章末まとめで判断軸を獲得 | 出典付きで「今ここで何が起きているか」を持ち帰る |
| header 枚数 | 4 (+任意 1) | 3 |
| header[1] | FRAMING-1 (構築背景) 必須 | OR (SECSUMMARY-1 / FRAMING-2 / WEBPAGE-1) |
| header[2] | FRAMING-2 (Before/After) 必須 | (撤去) |
| body 章数 | 2-6 | 1-3 |
| chapter.head | 2 枚 (扉 + 見取り図) | 1 枚 (扉のみ) |
| chapter.content | 1-8 枚 | 2-8 枚 |
| chapter.tail | 1 枚 (FRAMING-5 必須) | **0 枚 (空配列)** |
| FlowChart | fatal で 1 枚必須 | conditional warn (`decision_focused === true` 明示時のみ) |
| 専用必須スライド | (なし) | **WEBPAGE-1〜4 / VISUAL-7 が 1 枚以上必須 (StructQA-23)** |
| footer 必須 | DATA-4 / FRAMING-3 / FRAMING-4 | **WEBPAGE-2** / DATA-4 / FRAMING-3 / FRAMING-4 |
| 総スライド | 14-60 | 8-30 |
| 適用ルール数 | 11 | 10 |
