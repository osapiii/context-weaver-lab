# Structure QA — Deck 構造 Template ベースの自動検査ルール

> - 走査単位: **デッキ全体** (header / body.chapters / footer の構造を 1 つの Zod schema で検証)
> - 実装: `scripts/render/lib/structure-qa.js` (検証エンジン) +
>         `scripts/render/deck-structures/{template_id}.js` (Template Spec) +
>         `scripts/render/deck-structures/_helper.js` (`defineDeckStructure` factory)
> - 仕様書 (Template 別): `references/deck-structures/{template_id}.md`
> - エラー出力: 必ず日本語 + suggestion 付き。Zod 用語はユーザーに見せない

---

## 0. TL;DR — StructureQA の位置付け

```
M (MUST) → SchemaQA → SQA → SecQA → RefQA → WritingQA → ⭐StructureQA → VQA
```

- **Template** = Deck 構造の宣言 (例: `learning-deck`)
- **DeckStructureTemplate** は `defineDeckStructure({ header, body, footer, globalConstraints })` で書く Declarative spec
- factory の中で Zod schema を **動的に build** → `validateDeckStructure` が `safeParse` → 翻訳層が
  `StructQA-XX` 形式の日本語エラー + suggestion を返す

---

## 1. なぜこの層が必要か

「序盤 4 枚は表紙→構築背景→Before/After→目次」「学習デッキは章末まとめ必須」
「FlowChart 1 枚以上必須」「ハブ&スポークは 1 枚まで」といった**デッキ全体構造のルール**は、
かつてスキーマ規約・SecQA・SchemaQA など複数箇所に散在していた。新ルール追加・調整の
たびに「どこを直すか」を毎回判断する必要があり、fatal/warn の閾値判断が経験則になっていた。
ユースケース別 (学習 vs 提案 vs 報告) の分岐が `if doc.deck_type === "learning"` で散発的に
書かれ、**Template という抽象が無い**ため再利用ができなかった。

新規ルールは「Template の宣言を書き換える」だけで成立する設計に切り替えた。

---

## 2. 走査タイミング

```
build-deck.js が plan.json を読み込み
   ↓
   isV9Format(deckJson) で判定
     ├─ false (v8.x sections[]) → 従来パス (SchemaQA / SecQA / 等)
     └─ true (v9.0 header/body/footer)
              ↓
              validateDeckStructure(deckJson)
                ├─ doc.deck_structure 未指定 → skip + warn ログ
                ├─ Template 未登録              → StructQA-00 fatal
                └─ Zod safeParse 実行
                       ↓
                       translateToStructQA で日本語化 + suggestion 付与
                       ↓
              fatal 件数 ≥ 1 → exit 1 で停止
              (サイドカー *.structure-qa-report.json を書き出し)
   ↓
   render-deck-instruction.py の plan.html 描画時には、CLI 経由で同じ
   validateDeckStructure を呼び、StructureQA panel (緑/赤/黄) として可視化
```

---

## 3. ルール一覧

番号体系: **0X = メタ・全体構造** / **1X = 章単位** / **2X = グローバル制約**。

| Rule ID | カテゴリ | 検査内容 | severity | 実装場所 (Spec) |
|---|---|---|---|---|
| **StructQA-00** | meta | `doc.deck_structure` 未指定 / 未登録 / version 不整合 | fatal (未指定は skip) | `learning-deck.js::doc.refine` |
| **StructQA-01** | header | `header[]` の順序・必須テンプレが Template と一致 | fatal | `learning-deck.js::header[]` |
| **StructQA-02** | footer | `footer[]` の必須テンプレ (DATA-4 / FRAMING-3 / FRAMING-4) と末尾配置 | fatal | `learning-deck.js::footer[]` |
| **StructQA-03** | chapter_structure | `body.chapters[i]` が `head + content + tail` の 3 層構造 | fatal | `learning-deck.js::body.head/tail` |
| **StructQA-04** | chapter_count | 章数が `count.min/max` 範囲内 (learning-deck は 2-6) | fatal | `learning-deck.js::body.count` |
| **StructQA-05** | chapter_content | 章内本文枚数が `content.count` 範囲内 (1-8) | warn | `learning-deck.js::body.content.count` |
| **StructQA-06** | total_slides | デッキ総スライド数が `totalSlides` 範囲内 (14-60) | fatal | `learning-deck.js::globalConstraints.totalSlides` |
| **StructQA-12** | chapter_overview | `chapter.head[1]` が章扉直後の見取り図 (SECSUMMARY-1 等) | fatal | `learning-deck.js::body.head[1]` |
| **StructQA-13** | chapter_tail | `chapter.tail[0]` が `FRAMING-5` (mode + items[3]) | fatal | `learning-deck.js::body.tail[0]` |
| **StructQA-21** | flowchart | FlowChart (`DIAGRAM-3` / nested `SCENE-06`) 1 枚以上 (`decision_focused !== false`) | fatal (warn 格下げ可) | `learning-deck.js::globalConstraints.requiredTags` |
| **StructQA-22** | hub_spoke | HubSpoke (`SCENE-02`) 1 枚まで | fatal | `learning-deck.js::globalConstraints.maxTags` |
| **StructQA-23** | web_card | (news-summary 専用) WEBPAGE-1/2/3/4 / VISUAL-7 のいずれか 1 枚以上必須 | fatal | `news-summary.js::globalConstraints.requiredTags` |

> **残置ルール**:
> - **SchemaQA-01** (FRAMING-1 3 ブロック) は Zod 単一スライド検査として残置
>   (Template の自己完結性を保つため、StructureQA-01 と二重検査を許容)。
> - **SchemaQA-09 / 10** (DATA-4 行数 / (N) ↔ ref_table 整合) は Template 非依存の物理ルールのため `validateDeckGlobal` に残置。

---

## 4. 各ルールの仕様詳細

### StructQA-00: Template メタ検査

**[Trigger]**
`doc.deck_structure` が:
1. 未指定で v9.0-flavored plan.json (header / body.chapters / footer フィールド存在) — **skip + warn ログ**
2. 値が registry (`deck-structures/index.js`) に未登録 — **fatal**
3. `deck_structure_version` が Template 本体の `version` と meta-mismatch — **warn**

**[Anti-pattern]**
- `doc.deck_type: "learning"` だけで `deck_structure` を書き忘れる
- `"deck_structure": "learning-template"` (typo) で StructQA-00 fatal

**[Message 例]**
```
StructQA-00: Template "learning-template" は未登録です (登録済: learning-deck)
```

**[Suggestion]**
```
doc.deck_structure に "learning-deck" 等の Template id を明示してください。
```

---

### StructQA-01: header の順序・必須要素

**[Trigger]**
1. `header.length < 4` — fatal
2. `header[0..3]` の `template_id` が `['SECTION-1', 'FRAMING-1', 'FRAMING-2', 'SECTION-6']` と順序一致しない — fatal
3. `header.length === 5` で `header[4].template_id !== 'VISUAL-8'` — fatal
4. `header.length > 5` — fatal

**[Anti-pattern]**
- 表紙の前に章扉を入れる
- FRAMING-2 を Before/After ではなく自由フォーマットで使い始める
- VISUAL-8 (グラレコサマリー) を中盤に置く

**[Message 例]**
```
StructQA-01: header[1] は FRAMING-1 (構築背景) 必須
```

**[Suggestion]**
```
header[] の順序は [SECTION-1, FRAMING-1, FRAMING-2, SECTION-6, (任意 VISUAL-8)] です。
中盤に紛れ込ませず、必ず header[] フィールドの先頭 4 枚に配置してください。
```

---

### StructQA-02: footer の必須要素

**[Trigger]**
1. `footer` 内に `DATA-4` / `FRAMING-3` / `FRAMING-4` のいずれかが欠落 — fatal
2. footer 末尾が `FRAMING-3` でない — warn
3. `countGlossaryTerms(deckJson) >= 3` で `DATA-5` 不在 — fatal (条件付き必須)
4. footer に header / body 用テンプレ (FRAMING-1 / FRAMING-2 / SECTION-2 等) が混入 — fatal

**[canonical 並び順]**

```
footer[0] (任意): SECTION-3   クロージング
footer[1] (必須): DATA-4      参考情報集
footer[2] (条件): DATA-5      用語集 (用語 3 件以上で必須化)
footer[3] (必須): FRAMING-4   お土産
footer[4] (必須): FRAMING-3   会社紹介
```

> 読了体験が `補足参考 → お土産 → 会社紹介` で自然になる順序を canonical 採用。

**[Message 例]**
```
StructQA-02: footer に DATA-4 必須
```

**[Suggestion]**
```
footer[] には DATA-4 / FRAMING-4 / FRAMING-3 が必須です。
用語が 3 件以上あるなら DATA-5 (用語集) も必須化されます。
末尾は FRAMING-3 (会社紹介) で締めてください。
```

---

### StructQA-03: 章構造 (head + content + tail)

**[Trigger]**
1. `body.chapters[i].head.length < 1 || > 3` — fatal
2. `body.chapters[i].tail.length < 1 || > 3` — fatal
3. `chapter.head[0]` が章扉系 (SECTION-2 / SECTION-4 / SECTION-5) でない — fatal
4. `chapter.head[1]` が見取り図テンプレでない (= StructQA-12 と部分重複)
5. `chapter.content` フィールドが配列でない — fatal

**[Anti-pattern]**
- 章扉と見取り図を `content[]` の先頭に書いている (head[] に分離していない)
- FRAMING-5 を `content[]` の末尾に置いている (tail[] に分離していない)

**[Suggestion]**
```
body.chapters[i] は [head[2 枚: 章扉 + 見取り図], content[1-8 枚], tail[1 枚: FRAMING-5]] の構造です。
章扉や見取り図を content[] に入れている場合は head[] へ移動してください。
```

---

### StructQA-04: 章数の範囲

**[Trigger]**
1. `body.chapters.length < 2` — fatal
2. `body.chapters.length > 6` — fatal
3. (上書き値は `volumeConstraints.chapters.count.min/max` を採用)

**[理由]**
- 1 章しかない学習デッキは Template の構造的価値 (章ごとに区切って覚えさせる) が消える
- 7 章以上は読者の集中力を超える (1 セッションで読み切れない長尺デッキは別 Template を検討)

**[Suggestion]**
```
learning-deck の章数は 2-6 章です。
1 章しかないなら別 Template を検討、7 章超なら統合 / 分割を検討してください。
volumeConstraints.chapters.count で上書き可。
```

---

### StructQA-05: 章内本文枚数

**[Trigger]**
1. `chapter.content.length < 1` — warn
2. `chapter.content.length > 8` — warn

**[severity = warn の理由]**
範囲外でも build は通したい。12 枚超は subsection 分割か章を分けるべきだが、執筆中の draft
段階で fatal にすると煩い。

**[Suggestion]**
```
章内本文 (chapter.content[]) は 1-8 枚を推奨。
12 枚超は subsection 分割か章を分けるべきです (warn のため build は通る)。
```

---

### StructQA-06: 総スライド数

**[Trigger]**
1. `getAllSlides(deckJson).length < 14` — fatal
2. `getAllSlides(deckJson).length > 60` — fatal

**[計算式]**
```
total = header.length
      + Σ (chapters[i].head.length + chapters[i].content.length + chapters[i].tail.length)
      + footer.length
```

**[最小 14 の根拠]**
`header(4) + chapters(2 × (head 2 + content 1 + tail 1)) + footer(2) = 4 + 8 + 2 = 14`。
これより少ないと Template の意義 (章ごとに区切る学習体験) が消える。

**[Suggestion]**
```
デッキ総スライド数は 14-60 枚です。
少なすぎるなら章内 content を厚くし、多すぎるなら章を絞るか別 Template を検討してください。
```

---

### StructQA-12: 章扉直後の見取り図

**[Trigger]**
`chapter.head[1]` の `template_id` が見取り図系テンプレ (SECSUMMARY-1 / LIST-3 / DIAGRAM-1 等)
でない — fatal。許可リストは Template Spec で宣言。

**[Suggestion]**
```
chapter.head[1] は章扉直後の見取り図必須。
SECSUMMARY-1 / LIST-3 / DIAGRAM-1 などの見取り図テンプレを使ってください。
```

---

### StructQA-13: 学習デッキ章末まとめ

**[Trigger]**
1. 各章で `chapter.tail[0].template_id !== 'FRAMING-5'` — fatal
2. `tail[0].mode` が `comprehension` / `recap` 以外 — fatal
3. `tail[0].items.length !== 3` — fatal

**[Magic Number 3 の理由]**
学習デッキの章末は「読者が章を読み終えた直後に脳内で 3 点に圧縮できるか」のセルフテスト。
Magic Number 3 (心理学的に最も記憶に残る単位) で固定する。

**[Suggestion]**
```
chapter.tail[0] は FRAMING-5 (mode: comprehension/recap, items 3 件) 必須。
学習デッキの章末まとめは Magic Number 3 で固定です。
```

---

### StructQA-21: FlowChart 1 枚以上必須

**[Trigger]**
1. `doc.decision_focused === false` — 検査 skip
2. 全スライド (`getAllSlides`) で `template_id === 'DIAGRAM-3'` または nested `diagram.template_id === 'SCENE-06'` が **0 件** — fatal
3. 1 件以上 — pass

**[判断軸を絵で見せる学習デッキの核]**
学習デッキの読者は最終的に「採用判断 / 選定判断 / 是非判断」を 1 つ持ち帰る。
判断ロジックを言葉だけで書くと頭に残らない → DIAGRAM-3 + SCENE-06 (vertical-decision)
で「条件 → 分岐 → 帰結」を絵にして見せるのが最重要ルール。

**[Suggestion]**
```
デッキに DIAGRAM-3 か SCENE-06 (FlowChart) を 1 枚以上置いてください。
doc.decision_focused: false にすれば warn に格下げ可能ですが、判断軸を絵で見せるのが学習デッキの核です。
```

---

### StructQA-22: HubSpoke 1 枚上限

**[Trigger]**
1. 全スライドで `diagram.template_id === 'SCENE-02'` または `scene.template_id === 'SCENE-02'` を count
2. count >= 2 — fatal

**[Anti-pattern]**
- 章ごとにハブ&スポーク図を量産する (= テンプレ多用偏り)
- 5 並列要素を SCENE-02 で表現してしまう (LIST-3 や LIST-2 で十分)

**[Suggestion]**
```
ハブ&スポーク (SCENE-02) は 1 デッキ 1 枚までです。
5 並列要素なら LIST-3 / LIST-2、軸配置なら DIAGRAM-1 への置換を検討してください。
```

---

## 5. エラー出力フォーマット

`scripts/render/lib/structure-qa.js::translateToStructQA` が Zod issue を以下の構造に翻訳する。

```js
{
  rule:       'StructQA-12',                                // ルール ID
  level:      'fatal' | 'warn',                              // 深刻度
  target:     'body.chapters[1].head[1].template_id',        // どこの違反か
  message:    'StructQA-12: chapter.head[1] は SECSUMMARY-1 (SVG 主役の章見取り図) 必須',
  suggestion: 'chapter.head[1] は SECSUMMARY-1 単独許容。svg / svg_file を指定して amber 系レイアウトで描いてください',
  path:       ['body', 'chapters', 1, 'head', 1, 'template_id'],
}
```

CLI 出力 (`formatValidationReport`) は以下の形:

```
[StructureQA] 🚨 Template "learning-deck" 検査 fatal: 11 件 / warn: 0 件
  [chapter_overview]
    ✗ StructQA-12 @ body.chapters[1].head[1].template_id
        StructQA-12: chapter.head[1] は章扉直後の見取り図必須 (...)
        💡 chapter.head[1] は見取り図媒体: SECSUMMARY-1 / LIST-3 / ...
```

---

## 6. plan.html (Phase 2 出力) での可視化

`validateDeckStructure` を呼び、結果を `data['structure_qa']` に格納する。

Jinja テンプレ (`deck-instruction.jinja.html`) で:

| 状態 | パネル色 | 表示 |
|---|---|---|
| `structure_qa.skipped` | 黄 | 「⚠ Template 未指定でスキップしました」 |
| `structure_qa.ok` | 緑 | 「✓ Template `{template-id}` で全ルール通過」 |
| `structure_qa.fatal > 0` | 赤 | 「🚨 fatal N 件 / warn M 件」+ 各 issue を rule 別グループで列挙 |

加えて `section-title` に role バッジ (`HEADER` / `CHAPTER · head N / content N / tail N` /
`FOOTER`) と色帯、`slide-card` に `章頭 / 本文 / 🎯 章末まとめ` バッジが入る。

---

## 7. 新 Template を追加するときの手順

1. **Spec 設計**: `references/deck-structures/{template_id}.md` を新設し、`learning-deck.md`
   と同じフォーマット (header / body / footer / globalConstraints + ルール対応表) で書く
2. **Declarative Spec を実装**: `scripts/render/deck-structures/{template_id}.js` で
   `defineDeckStructure({ id, version, header, body, footer, globalConstraints })` を export
3. **Registry に登録**: `scripts/render/deck-structures/index.js` の `TEMPLATES` map に追加
4. **検証**: `node scripts/render/print-deck-structure.js {template_id}` で構造ガイドが
   Markdown で出力されることを確認 + 既存の learning-deck plan.json を借りて動作確認
5. **本ドキュメント更新**: §3 のルール一覧に Template 別の差分があれば追記

将来的に `proposal-deck` (提案書) や `internal-report` (社内報告) を追加する想定。

---

## 8. 関連ファイル

| ファイル | 役割 |
|---|---|
| `scripts/render/lib/structure-qa.js` | 検証エンジン (`validateDeckStructure` / `translateToStructQA` / `formatValidationReport`) |
| `scripts/render/deck-structures/_helper.js` | `defineDeckStructure` factory + Zod schema 生成 + `getAllSlides` / `countGlossaryTerms` |
| `scripts/render/deck-structures/learning-deck.js` | learning-deck spec |
| `scripts/render/deck-structures/index.js` | Template registry |
| `scripts/render/validate-structure-cli.js` | StructureQA を JSON 出力する CLI (Python から subprocess で呼ぶ用) |
| `scripts/render/print-deck-structure.js` | Template 構造を Markdown でターミナル表示 (Phase 2 必須コマンド) |
| `scripts/render/build-deck.js` | v9.0 検出 → StructureQA → fatal なら build 中断 |
| `scripts/render-deck-instruction.py` | plan.html に StructureQA panel + 章 role markers を描画 |
| `references/qa/README.md` | QA 体系全体像 |
| `references/deck-structures/learning-deck.md` | learning-deck Template の Spec 解説 |
| `references/phase2-information-design/plan-json-v9-structure.md` | plan.json v9.0 全体構造 |

---

## 9. Template 別ルールの差分表

各 Template でどの StructQA-XX が適用されるかの早見表。**○ = 適用 / × = 未適用 / 条件付き = appliesIf 等で skip される場合あり**。

| Rule ID | learning-deck | news-summary | severity | 備考 |
|---|---|---|---|---|
| StructQA-00 | ○ | ○ | fatal | Template メタ (id / version) |
| StructQA-01 | ○ | ○ | fatal | header の順序・必須テンプレ。news-summary は 3 枚 + header[1] が OR 候補 (SECSUMMARY-1 / FRAMING-2 / WEBPAGE-1) |
| StructQA-02 | ○ | ○ | fatal | footer の必須テンプレ。news-summary は **WEBPAGE-2 必須** が追加される / DATA-5 条件付きルールは learning-deck 専用 |
| StructQA-03 | ○ | ○ | fatal | head + content + tail 構造。news-summary は head 1 / tail 0 |
| StructQA-04 | ○ (2-6) | ○ (1-3) | fatal | 章数 |
| StructQA-05 | ○ (1-8) | ○ (2-8) | warn | 章内本文 |
| StructQA-06 | ○ (14-60) | ○ (8-30) | fatal | デッキ総スライド数 |
| StructQA-12 | ○ | × | fatal | 章扉直後の見取り図。news-summary は head が 1 枚しかないため発動しない |
| StructQA-13 | ○ | × | fatal | 章末 FRAMING-5。news-summary は tail 空のため発動しない |
| StructQA-21 | ○ (decision_focused !== false で必須) | 条件付き warn (decision_focused === true 明示時のみ) | learning=fatal, news=warn | FlowChart 必須 |
| StructQA-22 | ○ | ○ | fatal | HubSpoke (SCENE-02) 1 枚まで |
| **StructQA-23** | × | ○ | fatal | **news-summary 専用**: WEBPAGE-1/2/3/4 / VISUAL-7 のいずれか 1 枚以上必須 (ニュース要約の出典明示) |

**suggestion (修正提案文言) も Template 別**:
`lib/structure-qa.js::suggestionFor(ruleId, templateId)` が Template id を見て文言を切り替える。
