# DeckStructureTemplate: `proposal-deck`

**Template ID**: `proposal-deck`
**位置付け**: learning-deck / news-summary に続く 3 個目の deckStructure。
「提案 → 意思決定者の YES/NO を取りに行く」用途を専門に扱う。
**前提仕様**: `references/phase2-information-design/plan-json-v9-structure.md`

---

## 0. TL;DR

- `proposal-deck` は「**何かを提案して相手に意思決定してもらう**」用途の構造テンプレート
- 想定シーン: 家族への新生活提案、社内の新しい取り組み、外部ステークホルダーへの企画
- 読者は「**意思決定者**」(家族・上司・顧客)。読了後に **YES / NO / 条件付き YES** が出せる状態がゴール
- learning-deck / news-summary との最大差: **judgement-checklist** (FRAMING-5 mode: decision-checklist) を footer に置き、章ごとに判断材料を集めた上で「最後に 1 枚で踏み込ませる」設計
- proposal-deck 専用の StructQA 6 本 (StructQA-30〜35)
- 既存テンプレで完全に組める (新規 slideTemplate 追加なし)

---

## 1. Template の Declarative Spec

```js
// scripts/render/deck-structures/proposal-deck.js
const { defineDeckStructure, countGlossaryTerms } = require('./_helper');

module.exports = defineDeckStructure({
  id: 'proposal-deck',
  description:
    '提案デッキ。意思決定者 (家族/上司/顧客) の YES/NO を取りに行く構成。' +
    '背景 → 提案 → メリット時間軸 → リスク×軽減 → シナリオ別 → 体制 → 判断軸チェックリスト → 次の一歩。' +
    '読了後に判断保留せず踏み込ませることがゴール。',

  // -----------------------------------------------------------------
  // header: 序盤固定枠 (4 必須)
  // -----------------------------------------------------------------
  header: [
    { position: 0, template_id: 'SECTION-1', required: true, rule: 'StructQA-01',
      message: 'StructQA-01: header[0] は SECTION-1 (表紙) 必須' },
    { position: 1, template_id: 'FRAMING-1', required: true, rule: 'StructQA-01',
      message: 'StructQA-01: header[1] は FRAMING-1 (状況の起点 = なぜ今提案するのか) 必須' },
    { position: 2, template_id: 'FRAMING-2', required: true, rule: 'StructQA-01',
      message: 'StructQA-01: header[2] は FRAMING-2 (提案で起きる変化 = Before/After) 必須' },
    { position: 3, template_id: 'SECTION-6', required: true, rule: 'StructQA-01',
      message: 'StructQA-01: header[3] は SECTION-6 (目次) 必須' },
  ],

  // -----------------------------------------------------------------
  // body: 章繰り返し (3-6 章、提案系は最低 3 章 = 提案+メリット+リスク or シナリオ)
  // -----------------------------------------------------------------
  body: {
    count: { min: 3, max: 6 },

    head: [
      { position: 0, template_id: ['SECTION-2', 'SECTION-4', 'SECTION-5'],
        required: true, rule: 'StructQA-12',
        message: 'StructQA-12: chapter.head[0] は章扉 (SECTION-2 / SECTION-4 / SECTION-5) 必須' },
      { position: 1, template_id: 'SECSUMMARY-1', required: true, rule: 'StructQA-12',
        message: 'StructQA-12: chapter.head[1] は SECSUMMARY-1 (主役ビジュアル一発) 必須。' +
                 'svg / svg_file を必ず指定し、提案章の世界観を 1 枚絵で渡す' },
    ],

    content: { count: { min: 1, max: 8 }, allowedTemplates: 'any',
               severity: { min: 'warn', max: 'warn' } },

    tail: [
      { position: 0, template_id: 'FRAMING-5', required: true, rule: 'StructQA-13',
        message: 'StructQA-13: chapter.tail[0] は FRAMING-5 (章末判断材料) 必須。' +
                 'mode: comprehension / recap で章ごとの判断材料を 3 件に圧縮' },
    ],
  },

  // -----------------------------------------------------------------
  // footer: 末尾固定枠
  // -----------------------------------------------------------------
  footer: [
    { position: 0, template_id: 'SECTION-3', required: false, rule: 'StructQA-02',
      message: 'StructQA-02: footer の SECTION-3 (クロージング) は任意' },
    { position: 1, template_id: 'DATA-4', required: true, rule: 'StructQA-02',
      message: 'StructQA-02: footer に DATA-4 (参考資料) 必須' },
    { position: 2, template_id: 'FRAMING-5', required: true, rule: 'StructQA-34',
      message: 'StructQA-34: footer に FRAMING-5 (判断軸チェックリスト = mode: decision-checklist) 必須。' +
               '章末 FRAMING-5 とは別に、デッキ最終で「YES と言う前に確認すべき項目」を 3-7 件並べる' },
    { position: 3, template_id: 'FRAMING-4', required: true, rule: 'StructQA-02',
      message: 'StructQA-02: footer に FRAMING-4 (次の一歩 = お土産枠を「明日から何をするか」に流用) 必須' },
    { position: 4, template_id: 'FRAMING-3', required: true, rule: 'StructQA-02',
      message: 'StructQA-02: footer 末尾は FRAMING-3 (会社紹介) 必須' },
  ],

  // -----------------------------------------------------------------
  // globalConstraints
  // -----------------------------------------------------------------
  globalConstraints: {
    totalSlides: { min: 12, max: 50 },

    // proposal-deck 専用: doc.proposal_meta の検査群 (StructQA-30〜33)
    proposalMeta: {
      requireMeta:        { rule: 'StructQA-30', level: 'warn' },
      benefitHorizons:    { rule: 'StructQA-31', level: 'warn',  // single_horizon: true で skip
                            requiredHorizons: ['short', 'mid', 'long'], minRequired: 2 },
      riskMitigationPair: { rule: 'StructQA-32', level: 'fatal' },
      scenarioCases:      { rule: 'StructQA-33', level: 'fatal',
                            requiredKinds: ['best', 'median', 'worst'] },
    },

    requiredTags: [
      { tag: 'flowchart', min: 1, rule: 'StructQA-35',
        templates: ['DIAGRAM-3'],
        nestedDiagrams: ['SCENE-06'],
        appliesIf: (d) => d.doc && d.doc.decision_focused !== false,
        level: 'warn',  // 提案規模が小さい時に過剰負荷にならないよう warn
        message: 'StructQA-35: 提案デッキは Decision flow (DIAGRAM-3 / SCENE-06 vertical-decision) を 1 枚以上推奨。' +
                 '判断ロジックが文章で散らばらず 1 枚に収束する。' +
                 'doc.decision_focused: false で skip 可' },
    ],

    maxTags: [
      { tag: 'hub-and-spoke', max: 1, rule: 'StructQA-22',
        nestedDiagrams: ['SCENE-02'],
        message: 'StructQA-22: ハブ&スポーク (SCENE-02) は 1 デッキ 1 枚まで' },
    ],
  },
});
```

---

## 2. 構造定義の要点

### 2.1 header の固定要素

```
header[0]: SECTION-1   表紙                                           ── 必須
header[1]: FRAMING-1   状況の起点 (kikkake/kizuki/gimon = なぜ今提案するのか) ── 必須
header[2]: FRAMING-2   提案で起きる変化 (Before/After 4-6 件)              ── 必須
header[3]: SECTION-6   目次                                            ── 必須
```

learning-deck と完全に同型。提案デッキは「**なぜ今 / どう変わる / 何を読むか**」の 3 層を最初に渡し、
読み手が「自分ごととして考える土俵」に乗せる。

### 2.2 body.chapters[i] の固定要素

```
chapter.head[0]:  章扉 (SECTION-2/4/5)                                 ── 必須
chapter.head[1]:  SECSUMMARY-1 (主役ビジュアル / SVG)                   ── 必須

chapter.content[]:  1-8 枚 (任意 slideTemplate)                          ── 自由構成

chapter.tail[0]:  FRAMING-5 (章末判断材料 / mode: comprehension or recap) ── 必須
```

#### 推奨章構成（運用ガイド、Zod は強制しない）

提案系の論理運びとして、以下の章運用を推奨する:

| 章 | 役割 | 推奨 slideTemplate |
|---|------|---------------------|
| ch1 | **提案そのもの** (何を / いつから / どれくらい) | LIST-3 / LIST-8 / DATA-2 |
| ch2 | **メリット** (短期 / 中期 / 長期) | LIST-2 (3 カラム) / LIST-4 / WEBPAGE-2 (出典) |
| ch3 | **リスク × 軽減策** (ペアで必須) | LIST-4 / COMPARE-3 (リスク × 軽減 マトリクス) |
| ch4 | **シナリオ別** (best / median / worst) | LIST-2 / COMPARE-5 / DIAGRAM-1 |
| ch5 | **コスト・期間・体制** | LIST-3 / DATA-1 / PROJECT-1 / PROJECT-2 |
| (ch6 任意) | 判断軸の予告 | LIST-4 / FRAMING-5 |

**注意**: 章名や code は自由 (Zod は code が 1-2 文字 / name が 1-40 文字を強制するのみ)。
`doc.proposal_meta` で構造化メタデータを渡せば StructQA-30〜33 が章配置を支援する。

### 2.3 footer の固定要素

```
footer[0]: SECTION-3   クロージング              ── 任意
footer[1]: DATA-4      参考資料                  ── 必須
footer[2]: FRAMING-5   判断軸チェックリスト ★    ── 必須 (mode: decision-checklist)
footer[3]: FRAMING-4   次の一歩 (お土産枠流用)   ── 必須
footer[4]: FRAMING-3   会社紹介                  ── 必須
```

#### footer の FRAMING-5 (判断軸チェックリスト) は章末まとめと役割が違う

- **章末 FRAMING-5** (`chapter.tail[0]`): mode: `comprehension` / `recap` ─ 章の判断材料を 3 件
- **footer FRAMING-5**: mode: `decision-checklist` ─ デッキ全体で「YES と言う前に確認したい項目」を 3-7 件

両者は同じ slideTemplate を使うが、`mode` で意味付けが異なる。
StructQA-34 は footer に「FRAMING-5 (any mode で OK)」が 1 枚あることを検査する。
mode: `decision-checklist` は **規約** (Phase 2 のレビュー観点) で、Zod 強制はしない。

#### footer の FRAMING-4 (次の一歩) は learning-deck の「お土産」と意味付けが違う

- **learning-deck の FRAMING-4**: 「PoC チェックリスト」「使えるテンプレ」等の持ち帰り
- **proposal-deck の FRAMING-4**: 「今日 YES を貰った後、明日から何をするか」の **next-step テンプレ**

slideTemplate は同じ。意味付けは Phase 2 レビューで担保する。

---

## 3. body.chapters のループ表現 (上下限と検査ロジック)

### 3.1 章数 (`chapters.length`)

| 制約 | 既定値 | 違反時 |
|---|---|---|
| 最小章数 | **3** | StructQA-04 fatal |
| 最大章数 | **6** | StructQA-04 fatal |

**理由**: 1-2 章しかない提案は構造的に薄い (= 提案 + メリット または提案 + リスクだけで終わる)。
最低 3 章で「提案 + メリット時間軸 + リスク×軽減 (or シナリオ)」を描けるようにする。
7 章超は意思決定者が読み切れず、判断疲労で no-decision に着地しやすい。

### 3.2 章内本文枚数 (`chapter.content.length`)

| 制約 | 既定値 | 違反時 |
|---|---|---|
| 最小 | **1** | StructQA-05 warn |
| 最大 | **8** | StructQA-05 warn |

### 3.3 デッキ総スライド数

| 制約 | 既定値 | 違反時 |
|---|---|---|
| 最小 | **12** | StructQA-06 fatal |
| 最大 | **50** | StructQA-06 fatal |

**最小 12 の根拠**: header(4) + chapters(3 章 × (head 2 + content 1 + tail 1)) + footer(4) = 4 + 12 + 4 = 20 が最小現実値。
12 は「proposal_meta が薄い場合の例外運用」を許容する余地。

**最大 50 の根拠**: 50 枚超の提案は意思決定者を疲れさせる。提案を分割するか、
詳細は別添資料に切り出して本デッキを軽くするべき判断点。

---

## 4. StructureQA-XX ルール体系 (proposal-deck で適用される 16 ルール)

| Rule ID | Severity | 内容 | learning-deck との差 |
|---|---|---|---|
| **StructQA-00** | fatal | `doc.deck_structure` 未指定 / 未登録 / version 不整合 | 同 |
| **StructQA-01** | fatal | header の順序 (SECTION-1 / FRAMING-1 / FRAMING-2 / SECTION-6 = 4 枚必須) | 同型 (VISUAL-8 任意は無し) |
| **StructQA-02** | fatal | footer の必須テンプレ (DATA-4 / FRAMING-4 / FRAMING-3) | 同 |
| **StructQA-03** | fatal | 章は head[2] + content[N] + tail[1] 構造 | 同 |
| **StructQA-04** | fatal | 章数 3-6 (learning-deck は 2-6) | **下限 3** |
| **StructQA-05** | warn | 章内本文 1-8 枚 | 同 |
| **StructQA-06** | fatal | 総スライド 12-50 枚 (learning-deck は 14-60) | **短尺許容** |
| **StructQA-12** | fatal | 章扉直後の SECSUMMARY-1 必須 (SVG) | 同 |
| **StructQA-13** | fatal | 章末 FRAMING-5 必須 | 同 |
| **StructQA-22** | fatal | HubSpoke (SCENE-02) は 1 デッキ 1 枚まで | 同 |
| **StructQA-30** | warn | `doc.proposal_meta` が定義されているか | **proposal-deck 専用** |
| **StructQA-31** | warn | benefit_horizons は short/mid/long のうち 2 つ以上 (single_horizon: true で skip) | **proposal-deck 専用** |
| **StructQA-32** | **fatal** | risks[] は `{risk, mitigation}` ペア必須 | **proposal-deck 専用** |
| **StructQA-33** | **fatal** | scenarios[] に best/median/worst の 3 ケース必須 | **proposal-deck 専用** |
| **StructQA-34** | **fatal** | footer に FRAMING-5 (判断軸チェックリスト) が 1 枚必須 | **proposal-deck 専用** |
| **StructQA-35** | warn | Decision flow (DIAGRAM-3/SCENE-06) 推奨 (decision_focused: false で skip) | **proposal-deck 専用** (learning-deck の StructQA-21 とは独立採番) |

**注意**: learning-deck の StructQA-21 (FlowChart 必須 fatal) は proposal-deck では適用しない。
代わりに StructQA-35 で warn 推奨に格下げする (= 別 ID で別ルールとして管理)。
learning-deck 用 SUGGESTIONS には影響しない (independent な ID 採番)。

### 4.1 各専用ルールの判定ロジック概要

#### StructQA-30 (proposal_meta 推奨)
1. `doc.proposal_meta` が undefined → warn
2. proposal_meta があれば 31/32/33 が走る

#### StructQA-31 (benefit horizons)
1. `doc.proposal_meta.single_horizon === true` → skip
2. `doc.proposal_meta.benefit_horizons` が `{short, mid, long}` の object で、
   非空の値が 2 つ以上ない場合 → warn

#### StructQA-32 (risk × mitigation pair)
1. `doc.proposal_meta.risks` が array でない場合 → warn (StructQA-30 配下に吸収)
2. `risks[i].risk` または `risks[i].mitigation` のいずれかが欠落 → fatal
3. リスクと軽減策が 1:1 のペアになっているか

#### StructQA-33 (scenarios best/median/worst)
1. `doc.proposal_meta.scenarios` が array でない場合 → warn
2. `scenarios[].kind` の集合に `best` / `median` / `worst` が **すべて** 含まれない → fatal
3. 3 ケース未満 → fatal

#### StructQA-34 (footer judgement-checklist)
1. footer に FRAMING-5 が 0 枚 → fatal
2. footer に FRAMING-5 が 1 枚以上あれば pass (mode の値は問わない)

#### StructQA-35 (decision flow recommended)
1. `doc.decision_focused === false` → skip
2. 全スライドで DIAGRAM-3 (or nested SCENE-06) が 0 枚 → warn

---

## 5. plan.json サンプル (`proposal-deck` 完全準拠の最小デッキ)

「家族に新しい趣味を提案する」想定 (簡易版)。

```jsonc
{
  "doc": {
    "title": "新しい趣味を家族に提案する",
    "deck_structure": "proposal-deck",
    "decision_focused": true,
    "summary_required": true,
    "proposal_meta": {
      "proposal_summary": "毎週末の 15km 歩行 + 銭湯通いを習慣化する提案",
      "benefit_horizons": {
        "short": "1 ヶ月で寝つきと機嫌が安定する",
        "mid":   "3-6 ヶ月で体組成と疲れにくさが変わる",
        "long":  "1 年〜数年で心血管・認知症リスクが下がる"
      },
      "risks": [
        { "risk": "雨天時の安全性",     "mitigation": "前日 18 時の天気予報で go/no-go 判定 + 屋内代替案" },
        { "risk": "家族時間の侵食",     "mitigation": "土曜 7-11 時固定 + 月 1 回は家族同伴ルート" },
        { "risk": "費用が積み上がる",   "mitigation": "1 回 1,400 円で月 5,600 円の予算枠を先に固定" },
        { "risk": "怪我・体調不良",     "mitigation": "判断フローで体調チェック + 短縮ルート 8km 用意" }
      ],
      "scenarios": [
        { "kind": "best",   "label": "全部うまく行く", "summary": "週次で続き、3 年で長期効果も享受" },
        { "kind": "median", "label": "平均ケース",     "summary": "月 3 回ペースで習慣化、体調や予定で 1 回休む月もある" },
        { "kind": "worst",  "label": "想定外ケース",   "summary": "膝故障で 2 ヶ月中断、再開時は 8km 短縮ルートからリハビリ" }
      ],
      "cost":   { "per_run_yen": 1400, "monthly_yen": 5600 },
      "schedule": { "start_from": "2026-05", "review_after_months": 3 }
    },
    "references": [ /* ... */ ]
  },

  "header": [
    { "template_id": "SECTION-1", "title": "新しい趣味を家族に提案する" },
    {
      "template_id": "FRAMING-1",
      "title": "なぜ今この提案を出すのか",
      "block_kikkake": "...",
      "block_kizuki":  "...",
      "block_gimon":   "..."
    },
    {
      "template_id": "FRAMING-2",
      "title": "提案を採用すると、こう変わる",
      "items": [
        { "before": "...", "after": "..." },
        { "before": "...", "after": "..." },
        { "before": "...", "after": "..." },
        { "before": "...", "after": "..." }
      ]
    },
    { "template_id": "SECTION-6", "title": "本書の構成", "chapters": [ /* 4 章 */ ] }
  ],

  "body": {
    "chapters": [
      {
        "id": "ch1-proposal", "code": "1", "name": "提案そのもの",
        "head":   [
          { "template_id": "SECTION-2", "title": "提案そのもの" },
          { "template_id": "SECSUMMARY-1", "section_no": "01", "section_title": "提案そのもの", "svg_file": "..." }
        ],
        "content": [
          { "template_id": "LIST-3", "title": "提案 4 ポイント", "items": [ /* 4 件 */ ] }
        ],
        "tail":   [
          { "template_id": "FRAMING-5", "title": "1 章の判断材料", "mode": "recap",
            "items": ["...", "...", "..."], "mindset": { "title": "...", "points": ["A", "B", "C"] } }
        ]
      },
      {
        "id": "ch2-benefits", "code": "2", "name": "メリット (短期/中期/長期)",
        "head":   [/* SECTION-2 + SECSUMMARY-1 */],
        "content": [
          { "template_id": "LIST-2", "title": "短期 / 中期 / 長期", "cols": [
            { "title": "短期", "body": "..." },
            { "title": "中期", "body": "..." },
            { "title": "長期", "body": "..." }
          ]}
        ],
        "tail":   [/* FRAMING-5 */]
      },
      {
        "id": "ch3-risks", "code": "3", "name": "リスク × 軽減策",
        "head":   [/* SECTION-2 + SECSUMMARY-1 */],
        "content": [
          { "template_id": "LIST-4", "title": "リスク 4 件と軽減策", "cards": [/* 4 件 */] }
        ],
        "tail":   [/* FRAMING-5 */]
      },
      {
        "id": "ch4-scenarios", "code": "4", "name": "シナリオ別 (best/median/worst)",
        "head":   [/* SECTION-2 + SECSUMMARY-1 */],
        "content": [
          { "template_id": "LIST-2", "title": "3 シナリオ", "cols": [
            { "title": "Best",   "body": "..." },
            { "title": "Median", "body": "..." },
            { "title": "Worst",  "body": "..." }
          ]}
        ],
        "tail":   [/* FRAMING-5 */]
      }
    ]
  },

  "footer": [
    { "template_id": "DATA-4",   "title": "参考資料", "ref_table": [/* ... */] },
    {
      "template_id": "FRAMING-5",
      "title": "判断軸チェックリスト ─ YES と言う前に確認したい 5 項目",
      "subtitle": "本書を読み終えた後、この 5 項目に YES を出せれば踏み込んで OK",
      "mode": "decision-checklist",
      "items": [
        "土曜午前 4 時間の運用で家族時間を侵さないか確認した",
        "月 5,600 円の予算枠が家計に収まるか確認した",
        "リスク 4 件の軽減策に納得した",
        "シナリオ worst (膝故障 2 ヶ月) でも家族は受け入れられる",
        "3 ヶ月後の振り返り会で見直す約束を取り付けた"
      ],
      "mindset": {
        "eyebrow": "DECISION",
        "title": "この 5 項目に YES が揃ったら、明日から運用開始してよい。",
        "points": ["時間枠", "予算", "リスク", "worst 受容", "見直し約束"]
      }
    },
    {
      "template_id": "FRAMING-4",
      "title": "次の一歩 ─ 今日 YES を貰った後、明日から何をするか",
      "omiyage": {
        "category": "次の一歩",
        "icon": "→",
        "title": "明日朝から動く 3 ステップ",
        "body": "1) 銭湯候補 5 軒を 10 分で書き出す / 2) 土曜の天気と予定を確認 / 3) Maps でルートを引く"
      }
    },
    { "template_id": "FRAMING-3", "title": "ENOSTECH について" }
  ]
}
```

---

## 6. doc.proposal_meta スキーマ

`proposal-deck` 専用の構造化メタデータ。Zod の `.passthrough` 内で superRefine が検査する。

```ts
type ProposalMeta = {
  proposal_summary?: string;          // 1 行サマリ (任意だが強く推奨)

  // メリット時間軸 (StructQA-31)
  single_horizon?: boolean;           // true なら StructQA-31 skip
  benefit_horizons?: {
    short?: string;
    mid?:   string;
    long?:  string;
  };

  // リスク × 軽減策 (StructQA-32)
  risks?: Array<{
    risk:       string;               // 必須
    mitigation: string;               // 必須 (欠落で fatal)
    severity?:  'low' | 'mid' | 'high';
  }>;

  // シナリオ別 (StructQA-33)
  scenarios?: Array<{
    kind:    'best' | 'median' | 'worst';   // 3 種類すべて必須
    label?:  string;
    summary: string;
    actions?: string[];
  }>;

  // コスト (任意)
  cost?: {
    per_run_yen?:  number;
    monthly_yen?:  number;
    annual_yen?:   number;
    note?:         string;
  };

  // 期間・体制 (任意)
  schedule?: {
    start_from?:           string;     // 'YYYY-MM' 等
    review_after_months?:  number;
    end_at?:               string;
  };
  team?: Array<{
    role:    string;
    name?:   string;
  }>;
};
```

---

## 7. 実装上の注意点

### 7.1 footer 内の FRAMING-5 を learning-deck の章末 FRAMING-5 と区別する方法

`footerRuleToZod` は **「必須 template_id が footer 内に 1 枚以上存在する」** を検査するので、
footer に FRAMING-5 を required: true で渡せばそのまま通る。

learning-deck の footer には FRAMING-5 が無いので、両者は混同しない。
proposal-deck では「footer 内に FRAMING-5 が 1 枚」と「章末に FRAMING-5 が章数ぶん」が同居する。

### 7.2 StructQA-30〜33 の実装ポイント

`spec.globalConstraints.proposalMeta` というカスタム key を `proposal-deck.js` 内で扱い、
`.superRefine` を proposal-deck.js 内に追加して完結させる (`_helper.js` を触らない方針)。
既存 deckStructure に regression を出さない。

### 7.3 Decision flow の StructQA-35 (warn) は learning-deck の StructQA-21 と別 ID

learning-deck の StructQA-21 (fatal) を proposal-deck で warn に格下げするのではなく、
`StructQA-35` という独立 ID を採番する。理由:

- ID と severity は 1:1 で対応すべき (同じ ID で級別が違うと CLI / suggestion が混乱)
- learning-deck 用の SUGGESTIONS と proposal-deck 用の SUGGESTIONS が独立になる

`structure-qa.js::RULE_DEFAULT_LEVEL['StructQA-35'] = 'warn'` を追加。

---

## 8. 既存テンプレで足りるか — 検証済 ✅

| 用途 | 利用テンプレ |
|---|---|
| 表紙 | `SECTION-1` |
| 状況の起点 | `FRAMING-1` |
| Before/After | `FRAMING-2` |
| 目次 | `SECTION-6` |
| 章扉 | `SECTION-2` / `SECTION-4` / `SECTION-5` |
| 章見取り図 | `SECSUMMARY-1` |
| 提案ポイント | `LIST-3` / `LIST-4` / `LIST-8` |
| メリット時間軸 | `LIST-2` (3 カラム) |
| リスク×軽減 | `LIST-4` / `COMPARE-3` / `COMPARE-5` |
| シナリオ best/median/worst | `LIST-2` / `LIST-4` / `DIAGRAM-1` |
| コスト・体制 | `DATA-1` / `DATA-2` / `PROJECT-1` |
| Decision flow | `DIAGRAM-3` + `SCENE-06` |
| 章末判断材料 | `FRAMING-5` (mode: comprehension/recap) |
| 参考資料 | `DATA-4` |
| 判断軸チェックリスト | `FRAMING-5` (mode: decision-checklist) |
| 次の一歩 | `FRAMING-4` (お土産枠流用) |
| 会社紹介 | `FRAMING-3` |
| クロージング | `SECTION-3` |

**新規 slideTemplate 追加なし**で `proposal-deck` は組み立て可能。

---

## 9. learning-deck / news-summary との対比表

| 観点 | learning-deck | news-summary | proposal-deck |
|---|---|---|---|
| 性格 | 学ぶ | 知らせる | **提案する** |
| 読者像 | 学びたい人 | 速読したい人 | **意思決定者** |
| ゴール | 判断軸獲得 | 全体感把握 | **YES/NO 取得** |
| header 枚数 | 4 (+任意 1) | 3 | 4 |
| header[1] | FRAMING-1 必須 | OR 候補 | FRAMING-1 必須 |
| header[2] | FRAMING-2 必須 | (撤去) | FRAMING-2 必須 |
| body 章数 | 2-6 | 1-3 | **3-6** |
| chapter.head | 2 枚 (扉 + SECSUMMARY) | 1 枚 (扉のみ) | 2 枚 (扉 + SECSUMMARY) |
| chapter.content | 1-8 枚 | 2-8 枚 | 1-8 枚 |
| chapter.tail | 1 枚 (FRAMING-5) | 0 枚 (空) | **1 枚 (FRAMING-5)** |
| 専用必須 | (なし) | WEBPAGE 必須 | **proposal_meta + footer FRAMING-5 + 次の一歩** |
| FlowChart | fatal 必須 | conditional warn | **warn 推奨** |
| footer 必須 | DATA-4 / FRAMING-3 / FRAMING-4 | + WEBPAGE-2 | **+ FRAMING-5 (判断軸)** |
| 総スライド | 14-60 | 8-30 | **12-50** |
| 適用ルール数 | 11 | 10 | **16 (専用 6 ルール追加)** |
