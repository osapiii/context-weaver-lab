# Phase 2 — 情報設計

> 入口は `references/_common/workflow.md` の Phase 2 セクション。
> 本 README は Phase 2 専属ファイルと MUST ルールへのナビ。

## 🚨 Phase 2 を始める時の絶対手順 (Step 2-1 / 2-2)

Phase 2 を始める時、最初にやるのは
**Step 2-1: braindump-to-plan.py を実行して plan.draft.json を生成すること**。
AI が手書きで plan.json を組むのは禁止 (skip_braindump=true 時のみ許可)。

```bash
python3 scripts/braindump-to-plan.py \
    -i decks/{slug}/braindump.md \
    -o decks/{slug}/plan.draft.json
```

続いて **Step 2-2: 結晶化** で plan.draft.json を読んで items[].desc / cards[] /
subtitle を 130-160 字目安に詰め直し、`doc.crystallization_status: 'crystallized'`
に更新。

Step 2-1 / 2-2 を skip すると `build-deck.js` の **SchemaQA-08 fatal** で蹴られる
(`compact_mode: true` で `crystallization_status` が 'draft' / 未設定の時)。

---

## ⭐ Phase 2 を始める前の必読 2 ファイル — **これより前に plan.json を書き始めない**

ここが Phase 2 専属の決定版。bypass モードでも省略不可。

| 優先 | ファイル | 何のために読むか |
|------|---------|----------------|
| ① | `deck-instruction-schema.md` | **MUST ルール (M1〜M7) と doc / sections / reviews の正本スキーマ**。M7 は `speaker_notes` を「動画化前提のナレーション台本」として書く規約。`reviews[]` の構造 (cycle_num / cycle_desc / persona.{avatar,name,role,bio,traits[]} / summary.{title,stats[]} / issues[].{id,priority,priority_label,target,feedback,action,diff} / final_check.{title,body}) もここで確認 |
| ② | `../qa/schema-qa.md` | **Phase 2 完了直前の機械検証で fatal になる条件**。SchemaQA-01〜07 / SecQA-05 / SecQA-09a-d / SecQA-10 の自動 fatal を予習しておくと、strict 走査でいきなり弾かれる事故を防げる |

### Phase 2 冒頭で **必ず** 実行するコマンド (Template 構造取得)

learning-deck Template など `doc.deck_structure` を指定する plan.json
を書く際は、`scripts/render/print-deck-structure.js` を呼んで **header / body /
footer の必須テンプレ並びと StructureQA-XX 11 ルール** を Markdown でコンテキストに
入れてから plan.json を書き始める。**これは bypass モードでも省略不可**。

```bash
node scripts/render/print-deck-structure.js learning-deck
# → header[0..3] = SECTION-1 / FRAMING-1 / FRAMING-2 / SECTION-6 (任意 VISUAL-8)
# → chapter.head[0..1] = SECTION-2/4/5 + 見取り図 / chapter.tail[0] = FRAMING-5
# → footer = DATA-4 → FRAMING-4 → FRAMING-3 (条件付き DATA-5)
# → totalSlides 14-60 / 章数 2-6 / FlowChart 1 枚以上 / HubSpoke 1 枚まで
```

これを読まずに plan.json を書くと、StructureQA で 5-10 件 fatal を後から食らって作り直しになる。
詳細仕様は `references/deck-structures/learning-deck.md` を参照。

**書き手 (Claude) が陥りがちな失敗パターン**:
- ① を読まずにいきなり過去デッキ deck.json から逆引き → フォーマットが古かったり違ったりで render エラーで詰まる
- ② を読まずに `reviews[]` を独自フォーマットで書く → Jinja レンダリングで `dict has no attribute 'summary'` 系のエラー
- 上記コマンドを叩かずに LIST-1 を多用 → SecQA-09 で 5 件 fatal を後から食らって作り直し

Zod スキーマは `scripts/render/schemas/` 配下が SoT。新テンプレ追加時は
`scripts/render/templates/eno-XX-*.js` と `scripts/render/schemas/templates/index.js`
の両方を同時に更新する。詳細は `scripts/render/schemas/README.md`。

---

## このフェーズで何をするか

各スライドの「タイトル / サブコピー / 本文・カード・図表」を**完成原稿レベル**で書き起こし、
**`decks/{slug}/plan.html` にファイル直書き**してユーザーに提出。
ユーザーがブラウザで実ファイルを開いて承認するまで Phase 3 へ進まない。

```
1. 構成作成 → 2. 4種QA実行 → 3. QA違反修正 → 4. 全件 pass まで反復
                              ↑                                ↓
                              └────── 2-3 を反復 ──────┘
                                                                ↓
                                       5. ペルソナレビュー → 6. 反映 → 完成
```

**核心原則**: ステップ 2-4 は **規約（客観 / QA）** を満たす段階、5-6 は
**読者の感情（主観 / ペルソナ）** を見る段階。順序逆転すると、規約違反（横文字混入・
引用ゼロ・章扉直後の媒体ミス等）がペルソナの判断材料を汚し、手戻りが膨らむ。

`plan.html` 上部の「制作ワークフロー」panel で現在のステップが可視化される。

---

## ⭐ 結晶化 (Crystallize) ワークフロー

osanai 氏指針:「圧縮率 100→60% を目安に、まず詰めて後で本質を残して密度を高める」。
要約しすぎで尻切れ・抽象的・薄い slide が出る問題を、2 段階の作業に分けて解決する。

### 2 段階の流れ

```
braindump.md (1500-2500 字 × N 章 / 全体 6000-15000 字)
    ↓ ① scripts/braindump-to-plan.py (下地ジェネレータ)
plan.draft.json (100% 流し込みの下地 / Claude は触らない機械転写)
    │  - 各 Q 章を 3-5 枚にスライス
    │  - slide.body / items[].desc に braindump 段落を素のまま流し込み
    │  - doc.references[] / questions[] / visual_assets[] は完全機械転写
    │  - doc.compact_mode: true / crystallization_status: 'draft'
    ↓ ② Claude が「結晶化」(削るのではなく、本質を残して密度を高める作業)
plan.json (結晶化済み / 60% 凝縮)
    │  - 残す: 固有名詞・数値・年・因果・固有のフレーズ
    │  - 落とす: 冗長な接続詞・重複・装飾語・「〜することができる」「〜について」
    │  - LIST-3 desc は 130-160 字を目標 (auto-fit が 8.5pt まで自動下げ)
    │  - LIST-2 body は 130-180 字を目標 (同上 10pt まで)
    │  - doc.crystallization_status: 'crystallized' に更新
    ↓ ③ build-deck.js
資料.pptx (情報量増 + 尻切れなし)
```

### 結晶化の哲学

「削る」ではなく「**結晶化**」。砂糖水を煮詰めて氷砂糖を作るイメージ:
- 本質的な情報量は変わらない / 不純物 (冗長表現) が抜けるだけ
- 結果、同じ字数で**情報密度が 2-3 倍**になる
- 「効くという証拠」「祖」「世界唯一」のような**ストーリーを支える固有名詞**を絶対に削らない

### 例: Discovery Vitality slide-09

| 観点 | Before (60字 / 抽象的) | After (139字 / 結晶化済) |
|---|---|---|
| データ取得 | 「健診 + 歩数 + 食事 + 運転データを総合的に取得し、Vitality スコアに統合する仕組みです」 | 「南ア発で 25 年運用、現在は中国を除き **会員 1,040 万人 (+25% YoY)、英国 200 万人**。健診 + 歩数 + 食事 + 運転データを Vitality スコアに統合し **Diamond/Gold/Silver/Bronze の 4 段階**で保険料・特典を変動させる」 |

固有名詞 / 具体数値 / 年 / 因果が圧倒的に増えるが、字数は 2.3 倍程度に収まる。font-size auto-fit
(LIST-3 desc は 9.5pt → 8.5pt) でテンプレ枠に収まる。

### Claude の作業範囲

`plan.draft.json` を読んで以下を行う:

1. **subtitle の整形**: 60-200 字、ですます調統一、固有名詞・数値を残す
2. **items[].desc の結晶化**: 各 130-160 字、冗長な接続詞を落とし、固有名詞・数値・因果を残す
3. **items[].name の精度**: 「観点 1/2/3/4」のような自動生成名を意味のある名前に置き換え
4. **章扉 (LIST-1) の bullets[]**: 結晶化前は空。Claude が章の核心 3-5 件を埋める
5. **doc.crystallization_status: 'draft' → 'crystallized'** に更新

### 完成後の build

```bash
node scripts/render/build-deck.js -i decks/{slug}/plan.json -o decks/{slug}/draft.pptx
```

LIST-3 / LIST-2 の auto-fit が文字数に応じて font-size を自動調整するので、
130-160 字の結晶化済み desc でも尻切れにならない。

---

## 🔴 このフェーズの絶対ルール

> MUST-M1〜M6 の詳細は `deck-instruction-schema.md` 側に正本があるので、
> ここではナビと残りのルールだけ。

Phase 3 のコード生成に先行して、必ず指示書を **`decks/{slug}/plan.html` にファイル直書き**して
ユーザー承認を得る。承認後の修正は最小化されるが、未承認のまま
Phase 3 に進むと手戻りが大きい。

> ローカルファイルとしてブラウザで開く運用。最初から最終配置先に居る状態になる。

### R2-2 テンプレ構造プレビュー画像を Base64 で各スライドカードに埋め込む

`scripts/get-template-preview.py <ID>` で data URI を取得して `<div class="template-preview">`
として slide-subtitle 直後に配置。複数取得は `--json` フラグで一括化（`parallel-execution.md` 参照）。

### R2-3 セクション > サブセクション > スライドの 3 階層で情報構造を設計する

サブセクション名はグループ名（「ステップ別の説明」等）で右上パンくずに、タイトル冒頭の
識別子（「Phase 2：」「Step ①：」等）はそのスライド固有の位置を示す役割 — 両者の語彙は
同期させなくてよい。サブセクションは任意。実装は `addChromeWithNav(s, pageNum, sectionIdx, 'サブセクション名')`。

### R2-7 デッキの締め 3〜4 枚は固定枠 (StructureQA-02)

DATA-4 末尾参考情報集 →（条件付き DATA-5 用語集）→ FRAMING-4 お土産 → FRAMING-3 会社紹介。
お土産は Skill / チートシート / プロンプト集 を 1 件深掘りで紹介し、読者を「明日から
手を動かせる」状態に接続する。用語集は専門用語が 3 件以上ある時のみ。

構造として表現される (`scripts/render/deck-structures/learning-deck.js` の
`footer[]` 定義 + `scripts/render/lib/structure-qa.js::validateDeckStructure` で
**StructureQA-02 として fatal 検査**)。詳細は
`references/deck-structures/learning-deck.md` §StructQA-02。

### R2-11 (⭐ 最重要) デッキに FlowChart を最低 1 枚必ず含める

学習デッキの究極の目的は「読者が現場で正しい意思決定をできるようになる」こと。
判断ロジックを箇条書きで列挙するより、**FlowChart で絵にした方が圧倒的に**
**記憶に残り、現場で再利用される**。

#### ルール

- 1 デッキに最低 **1 枚** の FlowChart スライド (DIAGRAM-3 + SCENE-06) を必ず含める
- 意思決定の節目が 2〜3 個ある複雑なテーマなら **2 枚以上** に増やしてよい
- 判断軸が複数あるなら、章ごとに 1 枚ずつ FlowChart を入れるのが理想

#### Why fatal

learning-deck Template を選んだ plan.json は Phase 2 の機械検証で 0 枚なら render が止まる。
なぜそこまで厳しくするか:

- **学習効果の核**: 文字で並んだ判断ロジックは読者の頭に残らない。FlowChart で
  「YES なら右、NO なら下」という絵で見せると、現場の判断時に頭の中で再生される
- **持ち帰り感**: 「このデッキを読み終えた後、自分はどう判断すればいいか」が
  明確になる。これが ENOSTECH 学習デッキの差別化ポイント
- **入れ忘れ防止**: 機械検査がないと Claude / 設計者が「FlowChart を入れる」習慣
  そのものを忘れる。fatal で止めることで、毎回必ず思考に上る

#### オプトアウト (限定的に)

本当に意思決定要素が薄いテーマ (純粋な事例紹介、統計レポート、会社案内) なら
`plan.json` の `doc.decision_focused: false` を明示すると warn に格下げされる。
ただし **これを使う前に「本当に判断軸は無いか」を一度疑う**。多くの場合、
読者にとっての「使い分け基準」が隠れている。

#### Phase 2 での実装手順

1. ヒアリングで「読者がこのデッキを読んだ後、現場で何を判断する必要があるか」
   を 1 つ以上特定
2. その判断ロジックを DIAGRAM-3 + SCENE-06 (vertical-decision) で plan.json に追加
3. テンプレスキーマは `scripts/render/schemas/templates/index.js` の `DIAGRAM-3` 定義を参照

詳細仕様は:

- ルール本体: `references/deck-structures/learning-deck.md` §StructQA-21
  (実装は `scripts/render/deck-structures/learning-deck.js` の
  `globalConstraints.requiredTags` + `scripts/render/lib/structure-qa.js`)
- DIAGRAM-3 のスキーマ: `references/_common/slide-patterns.md` の Category K: DECISION
- SCENE-06 の 3 layout: `references/_common/scene-patterns.md` の SCENE-06 セクション

### R2-12 学習デッキでは各章末に章末まとめ FRAMING-5 を 1 枚必ず置く

学習デッキ (`doc.deck_type == "learning"`) は **章末で読者の頭の中を整理する小道具** が
あるかないかで定着率が大きく変わる。章を読み終えた瞬間に「いま読んだ章の輪郭」を
返してあげるのが FRAMING-5 章末まとめ「この章の持ち帰り」の役割。

#### ルール

- 学習デッキの **各章** に FRAMING-5 を 1 枚以上含める (章内の任意位置で OK、末尾推奨)
- mode は章の性質で選ぶ:
  - **`comprehension` (☑ 理解度チェック)** — 判断ロジック・FlowChart を含む章。
    「あなたは判断できますか？」を読者に問う型
  - **`recap` (☰ この章のまとめ)** — 人物紹介・歴史的事実・統計データ・背景説明
    中心の章。「忘れないでほしい 3 点」を素直に置く型
- `items[]` はちょうど **3 件** (Magic Number 3 — 心理学的に最も再生率が高い)
- 各 item は `head` (4〜12 字の体言止め) + `body` (30〜50 字、章の具体名・数値を 1 つ含む)

#### Severity (StructureQA-13)

- learning-deck Template を選んだデッキで、各章の `body.tail[0]` に
  FRAMING-5 (mode + items[3]) が無い → **fatal**
- learning-deck Template を選んでいない (= `doc.deck_structure` が
  未指定または別 Template) → 検査スキップ

#### Phase 2 での実装手順

1. Phase 1 で `doc.deck_type == "learning"` が確定していることを確認 (R1-6)
2. 章ごとに章の性質を見て `mode` を決める (判断ロジックがあれば comprehension、
   事実集なら recap)
3. 章で扱った要素から「持ち帰ってほしい 3 点」を抽出
4. テンプレスキーマは `scripts/render/schemas/templates/index.js` の `FRAMING-5` 定義を参照
5. デバッグ性のため、`_mode_reason` に「なぜこの mode を選んだか」を 1 行残す

#### Anti-pattern

- 全章を `comprehension` で揃える (事実羅列章は recap が向く)
- items を 4〜5 件入れる (覚えられない)
- items の body に「重要です」「大切です」のような抽象表現だけ書く
  (章で扱った具体名・数値を必ず 1 つ入れる)
- FRAMING-5 を章末に置かず、デッキ末尾の FRAMING-2 (Before/After) で代用する
  (章単位での頭の整理が抜ける)

#### 学習デッキ以外で使いたい時

`doc.deck_structure` で learning-deck 以外の Template を選んだ場合、または Template
未指定の場合は、FRAMING-5 を任意位置に置けば描画される。StructureQA-13 が不発になる
だけ (= 必須化されないだけ) で、テンプレ自体は使える。

詳細仕様は:

- ルール本体: `references/deck-structures/learning-deck.md` §StructQA-13
  + `scripts/render/deck-structures/learning-deck.js::body.tail[0]`
- FRAMING-5 のスキーマ: `references/qa/schema-qa.md` の SchemaQA-14
- テンプレ実装: `scripts/render/templates/eno-86-chapter-summary.js`

### R2-13 (⭐ R-FIG-PRIORITY) 図解は atoms-shape を直接組み合わせるのがデフォルト

スライドに図解を入れたくなった時、**まず ① shape 自由から検討**する。
SCENE / DIAG は「迷ったときに引ける参考実装」であり、「これに当てはめねば
ならない正解の型」ではない。

> ⚠️ ここで言う「ゼロスクラッチ」は **SCENE プリセットを使わず atoms-shape を直接呼ぶ** の意。
> `slide.addShape` を生で呼ぶことではない (それは G-SCENE-1 で禁止)。**atoms-shape は必ず通る**。

#### 優先順位 (上から先に試す)

```
①  shape 自由 (atoms-shape を直接組み合わせる)        最優先
②  shape シーン (SCENE-01〜06)                       参考値
③  ダイアグラム (DIAG-02〜09)                       定型構造のみ
④  チャート (CHART-01〜09)                          定量データのみ
⑤  データテーブル (DATA-2 / DATA-4 / DATA-5)         最後の砦
```

#### Phase 2 で図を設計する手順

1. 「このスライドで読者に伝えたい 1 メッセージ」を言語化
2. **まず ① の発想で「どんな絵があれば伝わるか」を頭の中で描く**
   (ノードの数・配置・矢印の向き・強調する 1 点)
3. その絵を `atoms-shape.js` の関数に翻訳 — `drawNode` で箱、`drawArrow` で線、
   `drawCallout` で強調メッセージ、システム要素なら `drawServer` / `drawDatabase` /
   `drawCloud` 等。これを DIAGRAM-4 / DIAGRAM-3 の `diagram` 内 inline か、
   `scripts/render/scenes/scene-NN-xxx.js` に切り出して呼ぶ
4. 描いた絵が SCENE-01〜06 のどれかに **偶然合うなら** ② で型を借りる
5. 構造そのものが定型 (PDCA / Before-After / ピラミッド / 放射 等) と
   一致するなら ③ DIAG を使う
6. 定量データの可視化なら ④ CHART
7. **上記すべてが当てはまらない時だけ** ⑤ データテーブルに逃がす

#### よくあるアンチパターン

- ❌ 「図を入れたいから SCENE-01 に当てはめる」→ 章の中身と合わず読者に伝わらない
- ❌ 「DIAG カタログを上から順に見て使えそうなものを探す」→ 型ありき
- ❌ 「とりあえず DATA-2 の表に並べる」→ 絵で覚える効果がゼロ
- ✅ 「読者の頭の中にどんな絵を残したいか」から逆算して shape を組む

#### 実装の入り口

| 優先度 | 手段 | 入り口 |
|---|---|---|
| ① shape 自由 | DIAGRAM-4 / DIAGRAM-3 の `diagram` に inline で記述、または `scripts/render/scenes/scene-NN-xxx.js` に切り出して `SCENE_REGISTRY` に登録 | `references/_common/scene-patterns.md`「カスタムシーンの書き方」 |
| ② SCENE | `diagram.template_id: "SCENE-XX"` | 同上「Scene プリセット 6 種」 |
| ③ DIAG | `diagram.template_id: "DIAG-XX"` | `references/_common/diagram-patterns.md` |
| ④ CHART | `chart` フィールド (CHART-A1〜83) | `references/_common/chart-patterns.md` |
| ⑤ テーブル | DATA-2 / DATA-4 / DATA-5 | `references/_common/slide-patterns.md` |

#### atoms-shape の道具立て (① 用)

`scripts/render/atoms-shape.js` に **30 個の関数** が用意されている:

- 基礎: `drawNode` / `drawLink` / `drawArrow` / `drawCallout` / `drawTagPill` / `drawIconBadge`
- ビジネスモデル系: `drawActor` / `drawOrgBlock` / `drawMoneyFlow` / `drawServiceFlow` / `drawDataFlow` / `drawBoundary` / `drawValueTag` / `drawIconLabel`
- システム構成系: `drawServer` / `drawDatabase` / `drawCloud` / `drawPC` / `drawBrowser` / `drawMobile` / `drawNetwork` / `drawAPI` / `drawUserSystem` / `drawFolder` / `drawContainer` / `drawSwitch`
- フローチャート系: `drawTerminator` / `drawDecision` / `drawProcess` / `drawDecisionFlow`

これらを組み合わせれば、**章固有の絵をほぼ何でも描ける**。型に縛られず、
「読者の頭に残る絵」を組むことを優先する。

詳細仕様: `references/_common/scene-patterns.md` の「shape Atom 一覧」と
「カスタムシーンの書き方」セクション。

### R2-14 (⭐) 日本語表現は ja-writing スキルで毎回検査する

Phase 2 で plan.json のテキスト要素（`title` / `subtitle` / `bullets` / `cards.body` /
`steps.body` / `notes` 等）を書いたら、**書いた直後に `ja-writing` スキルの 4 つの
CHECKLIST を全て通す**。これは bypass モードでも省略不可。

#### 走査の順序

```
1. checklist-translation.md  — 翻訳調・冗長表現
2. checklist-grammar.md      — てにをは・修飾語順・受動態
3. checklist-metaphor.md     — 比喩・言い換え（箱問題）
4. checklist-ai-style.md     — AI 風表現（ハイプ・絵文字スパム・コロン後ブロック）
5. checklist-slide.md        — スライド固有作法（このスキルから呼ばれる前提）
```

#### よくある違反と修正

詳細は `ja-writing/references/before-after-examples.md`。最頻出 3 件:

| 違反 | 例 |
|---|---|
| 翻訳調の「することができる」連発 | 「分析を行うことができます」→「分析できます」 |
| 「箱」型比喩の崩壊 | 「ストレージはデータの箱」→ 比喩を捨てて「インターネット経由で使えるデータの保管場所」 |
| 短すぎサブコピー（30 字未満） | 「現場が変わる」→ R2-4 の 4 要素を含む 120-200 字版に書き直し |

#### 既存ルールとの関係

- **R2-4**（サブコピー 120〜200 字 + 4 要素）→ ja-writing の `checklist-slide.md` §2 と完全に同じ規範。両方をクリアしてはじめて完成
- **C-1**（横文字禁止）→ ja-writing の `checklist-translation.md` の置換表で代替表現を引ける
- **SQA-02 / SQA-03** → ja-writing の走査フローを通せば自動的に満たされる

#### 機械検証の連動

このルールは **WritingQA 層** として機械化されている。`run-qa.py phase2 --strict`
で plan.json を render する時に、`scripts/writing-qa.py` の
`validate_writing_qa` が自動実行され、12 ルール (4 fatal + 8 warn) を全テキスト
要素にあてる。

fatal レベル: サブコピー 60 字未満 / 翻訳調 / ハイプ語 / 同じ助詞 4 連
warn レベル: コロン後ブロック / 弱表現連発 / 一文 100 字超 / 読点 4 つ以上 /
            二重否定 / 体言止め羅列 / 横文字侵入 / 箱型比喩候補

詳細は `references/qa/writing-qa.md`。

#### 詳細

- 橋渡しファイル: `references/_common/japanese-writing.md`
- スキル本体: `<project_root>/skills/ja-writing/SKILL.md`
- 機械検証の正本: `references/qa/writing-qa.md` / `scripts/writing-qa.py`

### R2-15 (StructureQA-22) ハブ&スポーク SCENE-02 は 1 枚まで

「中央 + 4-8 周辺要素」のハブ&スポーク図は、選びすぎるとデッキ全体が
似た構図ばかりになり、各章の重み付けがフラットに見えなくなる。

> **Why**:
> - ハブ&スポーク構造は汎用性が高すぎ、ほぼ全テーマに当てはめられてしまう
>   (「製品 + 機能」「サービス + ユーザー層」「課題 + 要因」等)
> - 結果、Claude が「思考停止のデフォルト」として選びがちで、デッキ全体が
>   似た放射図ばかりになる
> - 5 要素を見せたいだけなら LIST-3 (カードグリッド) のほうが情報密度が高く、
>   読者も「並列なんだな」と一目で理解できる

#### Phase 2 でのセルフチェック (SCENE-02 を選ぶ前に)

両方 YES のときだけ採用する:

1. **中央のハブが、周辺要素を「束ねる / 指揮する / 変換する」役割を持っているか?**
   - ✅ API Gateway + マイクロサービス群 (中央が経路制御)
   - ✅ データ基盤 + 利用部門 (中央が data を変換して配る)
   - ✅ 翻訳エンジン + 入出力言語 (中央が橋渡し)
   - ❌ 製品 + 機能 5 つ (中央は概念で、周辺と同列)
   - ❌ 会社 + 事業 (これは並列)
   - ❌ Uber QueryGPT + 構成要素 (Workspaces / Multi-Agent / RAG / Hackdays / 反復精度) — これは並列

#### 代替テンプレ (迷ったらコレ)

| 構造 | 推奨テンプレ | 理由 |
|------|-------------|------|
| 5 要素を並列に見せたい | **LIST-3 カードグリッド** | 並列が一目で伝わる。情報密度が高い |
| 3 要素を並列に見せたい | **LIST-2 3 カラム** | 比較しやすく、サブコピーも書ける |
| 4 要素 + 対比軸がある | **DIAGRAM-1 2x2 マトリクス** | 軸の意味が明示される |
| 順序付き 3-5 要素 | **SCENE-03 ステージ遷移** | 現在地を強調できる |
| 番号付きで深掘り | **LIST-4 縦カード積み** | 各要素を 100 字程度で説明 |
| 階層的な依存関係 | **DIAG-05 ピラミッド** | 上位/下位の意味が明示される |

#### 機械検証 (StructureQA-22)

SCENE-02 が **2 枚以上** あると fatal。オプトアウトは想定しない。
正当な理由は通常無いため単純に弾く。

#### 詳細

- ガイドライン: `references/_common/scene-patterns.md` G-SCENE-5
- 核ルール: SKILL.md C-11
- 機械検証 : `references/deck-structures/learning-deck.md` §StructQA-22 /
  `scripts/render/deck-structures/learning-deck.js` /
  `scripts/render/lib/structure-qa.js`

### R2-16 (⭐ VISUAL 優先選択) learning-deck では原則 VISUAL 系から選び、Card/Text 系は情報が薄い時の最後の手段

osanai 氏指針: 「pptx の強みは **ビジュアルで支える** こと。
原則は VISUAL 系から選択し、図解する意味がないものや情報が薄いページに絞って Card や Text 系の型を選ぶ」を
**StructQA-70/71/72** で機械強制する。

#### content slide を組む時の判断フロー (上から順に検討、最初に当てはまったものを採用)

1. **数値の比較・推移・順位がある** → **CHART-A1 / CHART-A2 / CHART-A3 / CHART-A4** (定量データの可視化)
2. **関係図・構造図・フローがある** → **SCENE-01 (3者関係)** / **SCENE-03 (ステージ遷移)** / **SCENE-04 (ビジネスモデル)** / **SCENE-05 (システム構成)** / **SCENE-06 (フローチャート)**
3. **意思決定のロジックを絵で見せたい** → **DIAGRAM-3 (FlowChart) + SCENE-06** (R2-11 / StructQA-21)
4. **2 軸でポジショニング** → **DIAGRAM-1 (2x2 マトリクス)**
5. **段階的な層構造** → **DIAGRAM-2 (cycle)** / **DIAGRAM-4 (pyramid)**
6. **実画像 / 写真を主役にしたい** → **VISUAL-1 (profile)** / **VISUAL-2 (evidence)** / **VISUAL-3 (visual + 3 body)** / **VISUAL-4 (image-card 2x2)** / **VISUAL-5 (split image)**
7. **Web 記事 / URL を引用したい** → **WEBPAGE-1 (単独)** / **WEBPAGE-2 (グリッド)** / **WEBPAGE-3 (深掘り)** / **WEBPAGE-4 (論点比較)**
8. **比較表が必要 (高密度)** → **COMPARE-3 (icon table)** / **COMPARE-5 (grouped)** / **COMPARE-6 (detail)**
9. **並列要素を見せたい (4-6 件)** → **VISUAL-4 (実画像 + 2x2)** か **DIAGRAM-1 (2x2)** を優先。それ以外で並列を見せるなら LIST-3 (カードグリッド)
10. **3 観点で並べたい** → まず **VISUAL-3** (主役画像 + 3 body) を検討。画像が無いなら LIST-2 (3 カラム)
11. **シンプルな箇条書き** → LIST-1 (= 最後の手段)

#### Card/Text 系の使用上限

| ルール | 閾値 | severity |
|---|---|---|
| StructQA-70 | VISUAL 系 ≥ 50% (分母 = ユーザー選択枠) | **fatal** if < 50% |
| StructQA-71 | 同一テンプレ ≤ 30% / ≤ 40% | warn > 30% / fatal > 40% |
| StructQA-72 | Card/Text 系 連続 ≤ 2 枚 | **fatal** if 3 連続以上 |

#### 「LIST-* に流れがち」を防ぐ自己チェック

plan.json を組み終わって build する前に、Claude は以下を自問する:

1. content slide のうち、CHART / SCENE / DIAGRAM / VISUAL / WEBPAGE 系を 1 つも使っていない章はあるか？ → ある章は再検討
2. LIST-3 が 5 枚以上使われていないか？ → 多すぎる場合、半分を VISUAL-4 / DIAGRAM-1 / SCENE-* に振り替える
3. Card/Text 系が body で 3 連続している箇所はあるか？ → 1 枚を VISUAL 系に置き換える
4. 「実画像がある」「比較できる」「数値がある」「関係図にできる」ヒントがある章で LIST-* を選んでいないか？

#### opt-out

特殊な用途 (純テキスト読み物 / 短編ピッチ等) で多様性ルールを skip したい時は:

```json
{
  "doc": {
    "deck_structure": "learning-deck",
    "diversity_check": false
  }
}
```

opt-out は既存デッキの再ビルドを壊さないための fallback。新規デッキでは原則 false を書かず、機械強制を受ける。

#### 関連ルール

- **C-15 (SKILL.md)**: SECSUMMARY-1 / Q 章 SVG は enostech-svg-diagram スキルで本物を書く (placeholder 禁止)
- **C-17**: VISUAL 系を最初に検討する原則 (本 R2-16 と対 (つい))
- **R2-11**: 意思決定が絡むテーマでは FlowChart 1 枚以上必須
- **R2-13**: 図解は SVG (enostech-svg-diagram) で組むのがデフォルト
