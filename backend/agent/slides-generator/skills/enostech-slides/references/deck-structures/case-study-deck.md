# DeckStructureTemplate: `case-study-deck`

**Template ID**: `case-study-deck`
**位置付け**: learning-deck (学ぶ) / news-summary (知らせる) / proposal-deck (提案する) に続く 4 個目。
「複数事例を横並びで比較してパターンを抽出する」用途専門。

---

## 0. TL;DR

- `case-study-deck` は「**同種の事例を 2-5 件集めて、横並びで比較し、共通パターンを抽出する**」用途のデッキ
- 想定シーン: 競合分析、業界事例カタログ、社内成功事例集約、PoC レビュー集
- 読者は「**同種の事例を集めて比較したい人**」。読了後に **「N 件の事例から共通パターンが X / Y / Z だと言える」** 状態がゴール
- **読書体験**: 「最初に全事例を一望 → ディテールに潜る → 横断パターンを掴む」を構造で保証する
- 主な差別化:
  - **company-research** が 1 社深掘りなら、case-study-deck は **複数事例の横並び比較** を強制
  - **news-summary** が並列なら、case-study-deck は **比較軸を固定して** 並べる + **パターン抽出**まで踏み込む
  - **proposal-deck** が「YES/NO 取得」なら、case-study-deck は「学習材料の整理」
- case-study-deck 専用の StructQA-40〜46 = **7 本**
- 既存テンプレで完全に組める (新規 slideTemplate 追加なし)

---

## 1. Template の Declarative Spec

```js
// scripts/render/deck-structures/case-study-deck.js
const { defineDeckStructure } = require('./_helper');

module.exports = defineDeckStructure({
  id: 'case-study-deck',
  description:
    '事例集約デッキ。同種の事例を 2-5 件集めて、横並びで比較し、' +
    '共通パターンを抽出する構成。読了後に「N 件の事例から共通パターンが X / Y / Z」と言える状態がゴール。' +
    '競合分析・業界事例カタログ・社内成功事例集約に使う。' +
    'header に一望比較表を置き、「最初に全事例を一望 → ディテール → パターン抽出」の読書体験を構造で保証。',

  // -----------------------------------------------------------------
  // header: 序盤固定枠 (5 必須)
  // -----------------------------------------------------------------
  header: [
    { position: 0, template_id: 'SECTION-1', required: true, rule: 'StructQA-01',
      message: 'StructQA-01: header[0] は SECTION-1 (表紙) 必須' },
    { position: 1, template_id: 'FRAMING-1', required: true, rule: 'StructQA-01',
      message: 'StructQA-01: header[1] は FRAMING-1 (テーマ提示) 必須' },
    { position: 2, template_id: 'SECSUMMARY-1', required: true, rule: 'StructQA-01',
      message: 'StructQA-01: header[2] は SECSUMMARY-1 (事例カタログ全景) 必須' },
    { position: 3, template_id: ['COMPARE-3', 'COMPARE-5', 'COMPARE-6', 'DATA-2'],
      required: true, rule: 'StructQA-46',
      message:
        'StructQA-46: header[3] は一望比較表 (COMPARE-3 / COMPARE-5 / COMPARE-6 / DATA-2) 必須。' +
        '全事例の "存在" と "ざっくり差分" を 1 枚で渡し、ディテールに潜る前の俯瞰を作る。' +
        'body の比較表 (StructQA-42) とは役割が違う (header= 低密度俯瞰 / body= 高密度抽出)' },
    { position: 4, template_id: 'SECTION-6', required: true, rule: 'StructQA-01',
      message: 'StructQA-01: header[4] は SECTION-6 (目次) 必須' },
  ],

  // body / footer / globalConstraints は Zod ファイル参照
});
```

case-study-deck 専用 superRefine で StructQA-40 / 41 / 43 / 44 / 45 を追加検査
(StructQA-42 と StructQA-46 は defineDeckStructure 内で処理)。

---

## 2. 構造定義の要点

### 2.1 header の固定要素

```
header[0]: SECTION-1                                       ── 必須 (表紙)
header[1]: FRAMING-1   テーマ提示 (なぜ事例を集めるか / 観点) ── 必須
header[2]: SECSUMMARY-1  事例カタログ全景 (SVG)              ── 必須
header[3]: COMPARE-3 / COMPARE-5 / COMPARE-6 / DATA-2       ── 必須 (一望比較表)
header[4]: SECTION-6   目次                                  ── 必須
```

#### header の比較表 と body の比較表 の役割分担 (重要)

両方とも比較スライドだが、**読書体験での役割が違う**:

| 観点 | **header の比較表 (StructQA-46)** | **body の比較表 (StructQA-42)** |
|------|-----------------------------------------|-----------------------------------------|
| 位置 | header[3] (目次の前) | 抽出章 content[] |
| 目的 | 全事例の "存在" と "ざっくり差分" を一望 | パターン抽出のための深掘り比較 |
| 情報密度 | 低め (各事例 1 行 + 4-6 列の論点) | 高め (各事例 1 列 + 多項目) |
| 推奨テンプレ | DATA-2 (横向きテーブル) / COMPARE-3 (簡潔行列) | COMPARE-5 / COMPARE-6 (グルーピング・補足込み) |
| 読書体験での役割 | 詳細に潜る前の俯瞰 | 詳細を踏まえた抽出材料 |
| 違反時 | StructQA-46 fatal | StructQA-42 fatal |

#### header[3] のテンプレ選定基準

| 比較項目数 / 列数 | 推奨テンプレ |
|---|---|
| 事例 3-5 件 × 4-6 軸の単純行列 | **COMPARE-3** (15 字 × 5 列まで、◎○△× 推奨) |
| 事例 3 件 × 列見出しと多階層グルーピング | **COMPARE-5** (グループ付き) |
| 事例 2-3 件 × セルに ✓/✗ + 補足テキスト | **COMPARE-6** (mark + text) |
| 事例 N 件 × 任意の数値・文字列ベースのテーブル | **DATA-2** (汎用テーブル / col_widths 制御可) |

### 2.2 body.chapters[i] の固定要素

```
chapter.head[0]:  章扉 (SECTION-2/4/5)                              ── 必須
chapter.head[1]:  SECSUMMARY-1 (主役ビジュアル)                      ── 必須
chapter.content[]: 1-8 枚 (任意 slideTemplate)                        ── 自由構成
chapter.tail[0]:  FRAMING-5 (まとめ mode: comprehension/recap/pattern-summary) ── 必須
```

推奨章構成は「各事例章 + 抽出章」。

### 2.3 footer の固定要素

```
footer[0]: SECTION-3       ── 任意
footer[1]: DATA-4          ── 必須 (参考資料)
footer[2]: WEBPAGE-2       ── 必須 (各事例の出典クレジット集)
footer[3]: FRAMING-4       ── 必須 (持ち帰り)
footer[4]: FRAMING-3       ── 必須 (会社紹介)
```

---

## 3. body.chapters のループ表現

| 制約 | 既定値 | 違反時 |
|---|---|---|
| 最小章数 | 3 | StructQA-04 fatal |
| 最大章数 | 7 | StructQA-04 fatal |
| 章内本文最小 | 1 | StructQA-05 warn |
| 章内本文最大 | 8 | StructQA-05 warn |
| 総スライド最小 | 14 | StructQA-06 fatal |
| 総スライド最大 | 60 | StructQA-06 fatal |

---

## 4. StructureQA-XX ルール体系 (17 ルール)

| Rule ID | Severity | 内容 | 由来 |
|---|---|---|---|
| StructQA-00 | fatal | deckStructure メタ検査 | 共通 |
| StructQA-01 | fatal | header の順序 (SECTION-1 / FRAMING-1 / SECSUMMARY-1 / [比較表] / SECTION-6) | 共通 |
| StructQA-02 | fatal | footer の必須テンプレ | 共通 |
| StructQA-03 | fatal | 章は head[2] + content[N] + tail[1] | 共通 |
| StructQA-04 | fatal | 章数 3-7 | case-study-deck |
| StructQA-05 | warn | 章内本文 1-8 枚 | 共通 |
| StructQA-06 | fatal | 総スライド 14-60 | case-study-deck |
| StructQA-12 | fatal | 章扉直後の SECSUMMARY-1 | 共通 |
| StructQA-13 | fatal | 章末 FRAMING-5 | 共通 |
| StructQA-22 | fatal | HubSpoke 上限 | 共通 |
| **StructQA-40** | warn | `doc.case_meta` の定義推奨 | case-study-deck 専用 |
| **StructQA-41** | fatal | `case_meta.cases[]` は 2 件以上必須 | case-study-deck 専用 |
| **StructQA-42** | fatal | body に横並び比較スライド (COMPARE-3/5/6) 1 枚以上必須 | case-study-deck 専用 |
| **StructQA-43** | fatal | パターン抽出必須 | case-study-deck 専用 |
| **StructQA-44** | warn | 自分への示唆推奨 | case-study-deck 専用 |
| **StructQA-45** | fatal | footer に WEBPAGE-2 必須 + 出典 ≥ 事例数 | case-study-deck 専用 |
| **StructQA-46** | fatal | header[3] に一望比較表 (COMPARE-3/5/6/DATA-2) 必須 | case-study-deck 専用 |

### 4.1 StructQA-46 の判定ロジック

1. `header.length < 5` → fatal
2. `header[3].template_id` が `['COMPARE-3', 'COMPARE-5', 'COMPARE-6', 'DATA-2']` のいずれでもない → fatal
3. それ以外 → pass

判定は defineDeckStructure の headerRuleToZod 内で行うため、追加 superRefine は不要。
ルール ID は header[3] の `rule: 'StructQA-46'` フィールドと message 内の "StructQA-46:" プレフィックスから抽出される。

---

## 5. doc.case_meta スキーマ

```ts
type CaseMeta = {
  theme?: string;
  observation_axes?: string[];
  cases: Array<{
    id?: string;
    name: string;
    summary?: string;
    source: { label: string; url?: string; year?: string };
  }>;
  comparison_axes?: string[];
  patterns?: string[];
  takeaways?: string[];
};
```

---

## 6. 4 deckStructure との対比表

| 観点 | learning-deck | news-summary | proposal-deck | **case-study-deck** |
|---|---|---|---|---|
| 性格 | 学ぶ | 知らせる | 提案する | **比較してパターンを抽出する** |
| 読者像 | 学びたい人 | 速読したい人 | 意思決定者 | 同種事例を比較したい人 |
| ゴール | 判断軸獲得 | 全体感把握 | YES/NO | 共通パターン抽出 |
| header 枚数 | 4 (+任意 1) | 3 | 4 | **5** |
| header 末尾構成 | FRAMING-2 + SECTION-6 | (撤去) | FRAMING-2 + SECTION-6 | **SECSUMMARY-1 + 比較表 + SECTION-6** |
| body 章数 | 2-6 | 1-3 | 3-6 | 3-7 |
| chapter.head | 2 枚 | 1 枚 | 2 枚 | 2 枚 |
| chapter.tail | FRAMING-5 | 空配列 | FRAMING-5 | FRAMING-5 |
| 専用必須 | (なし) | WEBPAGE | proposal_meta + 判断軸 | case_meta + header 比較表 + body 比較表 + パターン抽出 + 出典 ≥ 事例数 |
| 専用 StructQA | (なし) | StructQA-23 | StructQA-30〜35 | **StructQA-40〜46** |
| 総スライド | 14-60 | 8-30 | 12-50 | 14-60 |
| 適用ルール数 | 11 | 10 | 16 | **17** |
