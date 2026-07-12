# Schema QA — テンプレ別 JSON スキーマ自動検証

> 本ドキュメントは仕様 (ルール ID とその意図) の一次解説。
>
> - **単一スライドルール (SchemaQA-01〜07/11/13/14)**:
>   `scripts/render/schemas/templates/index.js` の Zod schema
>   (`.refine` / `.max(N, { message: 'SchemaQA-XX:' })` / `.enum` / `.length`) で表現。
>   違反は build-deck.js のスライドループで検出され、default strict で exit 1 停止。
> - **デッキ全体ルール (SchemaQA-09/10)**: `scripts/render/build-deck.js` の
>   `validateDeckGlobal(deckJson)` 関数で deck を走査して検出。fatal は
>   `validationErrors` にマージされる。
>
> 検証ロジックを変えたい時は **Zod schema (templates/index.js) または build-deck.js の
> `validateDeckGlobal` を編集する**。本 .md は仕様の解説に使う。
>
> 旧 SchemaQA-12 (FlowChart 必須) と SchemaQA-17 (HubSpoke 上限) は StructureQA に集約。
> 後継は StructureQA-21 / StructureQA-22 (`structure-qa.md` 参照)。

---

## なぜこの層が必要か

M? 層 (M2〜M6) は **全スライド共通のフィールド** を見るだけで、
「FRAMING-1 なら `block_kikkake` が必要」のような **テンプレ別の必須要件** までは
カバーしていなかった。SchemaQA 層は **deck-instruction-schema.md に明示されている
必須フィールド** を機械的に照合し、Phase 2 提出前に必ず弾く。

---

## 走査タイミング

```
build-deck.js が plan.json を読み込み
   ↓
   各 slide → schemas.validateSlideByTemplateId (Zod / SchemaQA-01〜07/11/13/14/15)
   ↓
   全 slide 走査後 → validateDeckGlobal (SchemaQA-09/10)
   ↓
   v9.0 plan の場合は validateDeckStructure で StructureQA-XX も走らせる
   ↓
   fatal が 1 件以上あれば exit 1 で停止 (default strict)
```

---

## ルール一覧

| ルール ID | 対象テンプレ | 検査内容 | severity |
|---|---|---|---|
| SchemaQA-01 | FRAMING-1 (構築背景) | `block_kikkake` / `block_kizuki` / `block_gimon` が string 型で存在 | fatal |
| SchemaQA-02 | FRAMING-2 (Before/After リスト) | `items[]` が 4-6 要素、各要素が `{before: string, after: string}` | fatal |
| SchemaQA-03 | SECSUMMARY-1 (セクション挿絵) | `section_no` / `one_line` / `placeholder_label` 3 string + **`svg` \| `svg_file` \| `diagram` \| `image_path` \| `scene` のいずれか 1 つ必須** | fatal |
| SchemaQA-04 | DATA-5 (用語集) | `terms[]` が 3-10 要素、各要素が `{term: string, desc: string}` を持つ | fatal |
| SchemaQA-05 | DATA-4 (参考情報集) | `ref_table[]` が 1 件以上の行を持つ | fatal |
| SchemaQA-06 | 全スライド | 必須キー `id` / `template_id` / `title` が存在 | fatal |
| SchemaQA-07 | 全スライド | `template_id` が現行 registry (TEMPLATE_REGISTRY) に存在する | warn |
| SchemaQA-09 | DATA-4 (参考情報集) | `ref_table` が 1 ページ上限 8 行を超えたら警告 (build-deck.js が自動分割するため warn のみ) | warn |
| SchemaQA-10 | 全スライド | 本文中 (N) と ref_table の対応整合 | warn |
| SchemaQA-11 | LIST-1 / LIST-2 / LIST-3 / FRAMING-2 | テンプレ別フィールド文字数上限 (描画時の折返し/被りを未然に防止) | fatal/warn |
| SchemaQA-13 | DIAGRAM-3 | `diagram` フィールド必須・`diagram.template_id == 'SCENE-06'` 推奨・`layout` が 3 種いずれか・`vertical-decision` なら `steps[]` 1 件以上 | fatal/warn |
| SchemaQA-14 | FRAMING-5 | `mode` が `comprehension` / `recap` のいずれか、`items[]` が 3 件存在 | fatal |
| SchemaQA-15 | VISUAL-7 + doc.references[].image | `source_url` が URL 形式、`ref_num` が doc.references[].num と 1:1 対応 | fatal |

> 既存 M? が `slide_goal` `illustration_decision` のようなクロステンプレ要件を担当するため、
> SchemaQA はそれを再検査しない (重複回避)。`section_id` の検査は SQA-14 が担当。

---

## SchemaQA-01: FRAMING-1 構築背景の 3 ブロック必須

**[Trigger]**
A slide with `template_id: "FRAMING-1"` shall have non-empty string fields
`block_kikkake` (きっかけ), `block_kizuki` (気付いたこと),
`block_gimon` (解消したい疑問) at the slide root.

**[Anti-pattern]**
- `template_id: "FRAMING-1"` だが detail_blocks に「きっかけ」を `text` で書いただけ
- `block_kikkake: ""` (空文字)
- `block_kizuki` キー自体が欠落

**[Exceptions]**
- なし — FRAMING-1 は序盤の固定枠で 3 ブロック構造が前提

**[Fix]**
1. `deck-instruction-schema.md` の「デッキ構成の固定枠」セクションを再読
2. 該当スライドに `block_kikkake` / `block_kizuki` / `block_gimon` の 3 string フィールドを追加
3. それぞれ「業種 + 規模 + 担当者の固有名詞 + 具体的な出来事」が読み取れる本文を書く

---

## SchemaQA-02: FRAMING-2 Before/After リストの items 構造

**[Trigger]**
A slide with `template_id: "FRAMING-2"` shall have an `items[]` array of
4 to 6 elements, each being `{ before: string, after: string }` with both
strings non-empty.

**[Anti-pattern]**
- `items` が 3 件以下、または 7 件以上 (密度が崩れる)
- 要素が `{ q: "...", a: "..." }` のような別キー名になっている
- `before` または `after` が空文字 / null

**[Exceptions]**
- なし — Before/After リストの本質は対比要素 4-6 件

**[Fix]**
1. 設計書の「解消する疑問」項目から 1:1 で抽出して `items[]` に詰める
2. 各要素は `{ before: "〜という疑問", after: "〜が分かる/できる" }` の形
3. 4-6 件に収まらなければ Phase 1 ヒアリングで Before/After を再整理

---

## SchemaQA-03: SECSUMMARY-1 セクション挿絵の必須要件

**[Trigger]**
A slide with `template_id: "SECSUMMARY-1"` shall satisfy ALL of the following:

1. `section_no` is a 2-digit string like `"02"`
2. `one_line` is a non-empty string (≤45 字 推奨)
3. `placeholder_label` is a non-empty string (draft 段階の説明テキスト)
4. Exactly one of `svg` / `svg_file` / `diagram` / `image_path` / `scene` is set
   to render real shape-based illustration. `placeholder_label` alone is
   NOT sufficient — it leaves the slide as a draft placeholder and ships a
   "faint text in the middle of an empty card" image to the user.

**[Anti-pattern]**
- `section_no: 2` (数値型 — 文字列であるべき)
- `section_no: "2"` (1 桁 — `"02"` の 2 桁形式が必須)
- `one_line` が 50 字超 (章の一言キャプションとして長すぎ)
- `placeholder_label` 欠落 (draft 段階の表示が壊れる)
- `placeholder_label` だけ書いて `svg` / `svg_file` / `diagram` / `image_path` /
  `scene` のいずれも指定しない。これだと plan.html の実プレビュー画像が
  「薄字テキストが中央に置かれただけのカード」になり、章扉直後の見取り図
  としての機能 (読者にその章の認知マップを 1 枚で渡す) を果たせない

**[Exceptions]**
- なし — SECSUMMARY-1 は章扉直後の見取り図用テンプレで全要件が前提

**[Fix]**
1. `deck-instruction-schema.md` の「セクション挿絵 (SECSUMMARY-1) のスキーマ規約」を再読
2. `section_no` を 2 桁ゼロ埋め文字列にする (`"01"` `"02"` … `"10"`)
3. `one_line` を 45 字以内のキャプションに圧縮
4. `placeholder_label` に「中央に〜の概念図」のような描画指示を書く
5. **default は SVG**: `enostech-svg-diagram` skill で SVG を書き
   `"svg": "<svg ...>...</svg>"` または `"svg_file": "assets/svg/ch1.svg"`
   で渡す。build-deck.js が SVG → PNG 変換 → `image_path` 化を自動で行う
6. PowerPoint 上で文字を後で直したい時は DIAG-XX (8 種) を opt-in で使う:
   `"diagram": {"template_id": "DIAG-08", ...}` 形式で plan.json に渡す
   - 中心 + 周辺 (要素を主役と従属で見せたい) → **SCENE-02 ハブ&スポーク** (1 デッキ 1 枚まで)
   - 2 軸で並列ツールを位置付け → **DIAG-08 2x2 マトリクス**
   - 段階的成長・成熟度 → **DIAG-03 ステップアップ**
   - 導入前後の差分 → **DIAG-04 Before/After**
   - 反復プロセス (PDCA等) → **DIAG-02 サイクル**
   - 階層構造 → **DIAG-05 ピラミッド**
   - 時系列 → **DIAG-06 タイムライン**
   - 競合ポジショニング → **DIAG-09 2 軸プロット**
   - 上記で届かない自由な構図 → **SCENE-01〜06** (`scripts/render/scenes/`)

---

## SchemaQA-04: DATA-5 用語集の terms 構造

**[Trigger]**
A slide with `template_id: "DATA-5"` shall have a `terms[]` array of
3 to 10 elements, each being `{ term: string, desc: string }` with both
non-empty. `reading` is optional but recommended.

**[Anti-pattern]**
- `terms` が 2 件以下 (用語が薄いならスライド自体を省略すべき)
- `terms` が 11 件以上 (1 ページに収まらない、2 ページ分割が必要)
- 要素に `term` または `desc` が欠落

**[Exceptions]**
- 11 件以上ある場合は DATA-5 を 2 スライドに分割し、各 ≤ 10 件にする
  (SchemaQA は 1 スライド単位で検査するので、分割後は各スライドが個別に検査される)

**[Fix]**
1. 用語が 2 件以下なら DATA-5 自体を削除
2. 11 件以上なら 2 スライドに分割
3. 各 `term` に `reading` (読み) を可能な限り追加

---

## SchemaQA-05: DATA-4 参考情報集の ref_table 必須

**[Trigger]**
A slide with `template_id: "DATA-4"` shall have a non-empty `ref_table[]`
array. Each row must have `category` and `title` as non-empty strings.

**[Anti-pattern]**
- DATA-4 を配置したのに `ref_table` が空配列 or 欠落
- detail_blocks に URL を書いて ref_table 経由を回避 (RefQA 違反でもある)

**[Exceptions]**
- なし — DATA-4 は参考情報集の集約ページで、ref_table が空なら配置自体が無意味

**[Fix]**
1. 各本文スライドの `ref_table[]` を集めて DATA-4 のページにマージ
2. 各行 `{ category, title: "(N) ...", url, source }` の形式で詰める
3. RefQA-01〜10 を別途走査して粒度・整合性も検査

---

## SchemaQA-06: 全スライドの最低限フィールド

**[Trigger]**
Every slide in `sections[].slides[]` shall have non-empty string fields
`id`, `template_id`, and `title`.

**[Anti-pattern]**
- `id` 欠落 (HTML レンダ時のアンカーが壊れる)
- `template_id` 欠落 (プレビュー画像が解決できない)
- `title: ""` (タイトルブロックが空になる)

**[Exceptions]**
- 表紙 (SECTION-1) で `title` が極端に短いのは OK だが、空ではない

**[Fix]**
1. JSON を見て該当スライドの欠落フィールドを補う
2. `id` は `"S1"` `"S2"` … のように連番で振る (一意性必須)
3. `template_id` は現行 registry (`TEMPLATE_REGISTRY`) に存在する ID

---

## SchemaQA-07: template_id の既知ID チェック (warn)

**[Trigger]**
Each slide's `template_id` shall be one of the registered template IDs in
`scripts/render/templates/*/index.js` の `registry`. Unknown IDs degrade
preview rendering and signal possible typos.

**[Anti-pattern]**
- `template_id: "LIST-1 標準"` (テンプレ名を混入)
- `template_id: "list-1"` (小文字)
- `template_id: "LIST-99"` (存在しない番号)

**[Exceptions]**
- 実装中の新テンプレで未登録の場合 — その時は対応する `templates/{category}/index.js` を更新する

**[Fix]**
1. typo チェック → 正しい現行 ID に修正
2. 大文字統一 / ハイフン半角に注意
3. 新テンプレなら `templates/{category}/index.js` の registry に追加

---

## 既知テンプレ ID 一覧 (SchemaQA-07 で参照)

`scripts/render/templates/*/index.js` の `registry` 集計が **唯一の真実 source**。
以下はスナップショット (ドキュメント用)。

```
SECTION-1〜6   (6 種: 表紙 / 章扉 / 閉じ / 章扉A / 章扉B / 統合目次)
LIST-1〜9      (9 種: 標準 / 3カラム / カードグリッド / 縦カード積み / タイル 2x2 / タイル 3x2 / タイル 3x3 / 詳細カード / アイコン 3カラム)
COMPARE-1〜6   (6 種: Before/After / Before/After コンパクト / 比較表 / トレードオフ / グループ比較 / 比較詳細)
DATA-1〜5      (5 種: 項目-値 / データテーブル / 数字+グラフ / 参考情報集 / 用語集)
PROJECT-1〜4   (4 種: フェーズフロー / スケジュール / 5トラック / 2層トラック)
DIAGRAM-1〜3   (3 種: 2x2マトリクス / フロー図 / FlowChart 専用)
SECSUMMARY-1   (1 種: 章扉直後の見取り図 / フルブリード SVG)
CHART-A1〜A4   (4 種: チャート単体 / + テキスト / + 3カラム / ペア)
VISUAL-1〜12   (12 種: プロフィール / エビデンス / ビジュアル主体 / イメージカード / 左画像+右テキスト / フルビジュアル / リファレンス画像 / サマリー画像 / SVG 番号付き / SVG 3ステップ / SVG トップ+3カード / SVG ペア)
WEBPAGE-1〜4   (4 種: 単独URL / カードグリッド / 詳細解説 / 論点比較)
FRAMING-1〜5   (5 種: 構築背景 / Before/After リスト / 会社紹介 / お土産 / 章末まとめ)
FREE-1         (1 種: 自由レイアウト)
CODE-1〜7      (7 種: 単独 / 分割 / コメント / Before/After / ステップ / ターミナル / ツリー)

ネスト経由でのみ呼ばれる ID:
  DIAG-02〜09  (8 種: SECSUMMARY-1 の diagram フィールド経由)
  CHART-01〜09 (9 種: CHART-A1〜A4 の chart フィールド経由)
  SCENE-01〜06 (6 種: SECSUMMARY-1 / DIAGRAM-3 の diagram または scene フィールド経由)
```

新テンプレを追加した時は、該当 category の `templates/{category}/index.js` の
`registry` に追加すれば自動的に SchemaQA-07 を通過する。

---

## SchemaQA-09: DATA-4 参考情報集の 1 ページ上限

**[Trigger]**
A slide with `template_id: "DATA-4"` whose `ref_table[]` length exceeds 8
(`DATA4_MAX_ROWS_PER_PAGE`) shall be flagged as a warning. The `build-deck.js`
side automatically splits oversized reference tables into multiple slides
(titled "本資料の主要な参考情報", "本資料の主要な参考情報 (続き 2/3)", …).
This warn is informational so the designer notices the auto-split happened.

**[Anti-pattern]**
- ref_table に 12〜15 件詰め込んで放置 — plan.html では 1 枚に見えるが、
  出力 PPTX では 2 枚に分割される。Phase 2 で見たカード数と PPTX のスライド数が
  ずれて Claude / ユーザーが混乱する
- 「自動で分かれるからいいや」で 30 件超を 1 つの DATA-4 に詰める —
  論理的にカテゴリ分けして手動分割する方が読みやすい

**[Exceptions]**
- Phase 2 で意図的に 1 ページに収めた上で、ref_table を 8 行以内に絞っている
  ケースはそもそも warn が出ない (= 8 行以下)
- 自動分割の挙動を理解した上で意識的に放置する場合は warn を無視してよい (fatal ではない)

**[Fix]**
1. **(a) 自動分割に任せる** — そのまま放置すると build-deck.js が
   `DATA4_MAX_ROWS_PER_PAGE = 8` ごとに分割。1 ページ目は元タイトル、
   2 ページ目以降は「タイトル (続き N/M)」になる
2. **(b) plan.json で手動分割** — カテゴリ別 (公式 / 解説 / 事例 / 動画 …) に
   複数の DATA-4 スライドへ分けて、各々 8 行以内に収める。読み手が見やすい
3. 引用元を整理して 8 行以内に収める — 本文で実際に参照していない引用は削る
   (RefQA-05 で本文 (N) と ref_table の対応もチェックされる)

### 寸法の根拠

- `slideH = 5.625"` (PowerPoint 16:9 のスライド高)
- `contentBot = 5.15"` (本文領域下端、フッター領域への侵入を避ける)
- `footerY = 5.28"` (ページ番号の表示位置)
- DATA-4 タイトルブロック: 約 1.05" (タイトル + 1 行サブコピー + マージン)
- DATA-4 テーブル ヘッダー: 0.38"、ボディ各行: 0.40"
- 利用可能本文高: `contentBot - title_block - header = 5.15 - 1.05 - 0.38 = 3.72"`
- 安全行数: `3.72 / 0.40 = 9.3` → **8 行が安全上限**
- 12 行詰めると約 0.95" がフッター領域に侵入し、ページ番号と本文が重なる

---

## SchemaQA-10: 本文 (N) と ref_table の対応整合

**[Trigger]**
全スライド (DATA-4 / SECTION-6 / SECTION-1 / SECTION-2 / SECTION-4 / SECTION-5 /
FRAMING-3 / VISUAL-8 を除く) で、本文 (subtitle / bullets / cards / cols / items /
`block_kikkake` / `block_kizuki` / `block_gimon` 等) に含まれる `(N)` インライン参照番号と、
そのスライドの `ref_table` 内の `(N)` の対応を比較する。両方向の不整合を warn として報告。

**[Anti-pattern]**
- 本文に `(5)(6)` と書いたが ref_table に該当行が無い — 自動ハイパーリンク化が
  効かず黒文字のまま
- ref_table に `(7)` 行を追加したが本文に `(7)` が出てこない — 引用したのに
  参照していない状態
- 「(1) はじめに、(2) 本論、(3) 結論」のような箇条書き番号と引用参照を
  混在させる — どちらも `(N)` パターンでマッチして判別困難

**[Exceptions]**
- DATA-4 (参考情報集自体) / SECTION-6 (目次) / SECTION-1 (表紙) / SECTION-2/4/5
  (章扉) / FRAMING-3 (会社紹介) / VISUAL-8 (グラレコサマリー) は対象外
- FRAMING-1 (構築背景) で「(1) 業種、(2) 規模、(3) 課題」のように箇条書き番号
  として `(N)` を使うのは想定内。warn が出ても判断して放置 OK
- `doc.references[]` にも引用情報を集約していて、ref_table にはそのスライドで
  使う N だけ書く運用も OK

**[Fix]**
1. 本文に `(N)` があるが ref_table に対応行が無い →
   (a) `ref_table[]` に `{ "category": "...", "title": "(N) ページタイトル", "url": "...", "source": "..." }` を追加、または
   (b) 本文から `(N)` を削除、または
   (c) `doc.references[]` に追加
2. ref_table に N があるが本文に `(N)` が無い →
   (a) 本文の該当主張に `(N)` を追記、または
   (b) ref_table から行を削除
3. 箇条書き番号として `(N)` を使っているなら「①②③」「1.2.3.」等の代替記法に
   変えると warn が消える

---

## SchemaQA-11: テンプレ別フィールド文字数上限

**[Trigger]**
LIST-1 / LIST-2 / LIST-3 / FRAMING-2 の各フィールドに、PptxGenJS が 1 行に
収めきれない長さの文字列が入ると、領域からはみ出して折返し、隣接要素と
被る。テンプレ別の上限を機械検査して、Phase 2 で止めるか warn を出す。

**[Anti-pattern]**
- LIST-2 `cols[].title` 18字 → 領域 h=0.45 / 17pt で 2 行折返し → 本文と被り
- FRAMING-2 `items[].after` 36字 → After カラム w=3.55 で折返し → 「After」ラベルと本文が分断
- LIST-1 `bullets[].body` 267字 (コード文字列) → 4 行超で次 bullet head と被り
- LIST-3 `items[].name` 14字 → カードタイトル h=0.32 / 15pt で 2 行折返し → tag と被り

**[Exceptions]**
- 英字/数字主体で半角扱いになり実描画が短いケースはセーフ (warn が出ても放置 OK)
- LIST-8 / VISUAL-3 のような縦広い領域のテンプレならこの制約は緩い

**[Fix]**
1. fatal: 必ず短縮 — 同義の短表現、内容を 2 つに分けて別カードへ、別テンプレへ変更
2. warn: PNG 目視確認、破綻していれば短縮
3. テンプレ変更パス: LIST-1 → LIST-8 (1 要素深掘り) / LIST-1 bullets 長文 → VISUAL-3 ビジュアル主体
4. 文字数上限の根拠は Zod schema (`scripts/render/schemas/templates/index.js`) の
   `.max(N, { message: 'SchemaQA-11: ...' })` 定義参照

### 上限値表

| テンプレ | フィールド | warn | fatal | 理由 |
|---|---|---|---|---|
| LIST-1 | `bullets[].head` | 25 | 32 | 1 行で収める想定 |
| LIST-1 | `bullets[].body` | 150 | 200 | 200字超で次 bullet と被る |
| LIST-2 | `cols[].title` | 12 | 16 | 折返すと本文と被る |
| LIST-2 | `cols[].body` | 90 | 120 | 3 行を超えると破綻 |
| LIST-3 | `items[].name` | 11 | 14 | 折返すと tag と被る |
| LIST-3 | `items[].desc` | 70 | 90 | 底のカテゴリラベルと被る |
| FRAMING-2 | `items[].before` | 30 | 38 | Before カラム幅 4.20 |
| FRAMING-2 | `items[].after` | 28 | 35 | After カラム幅 3.55 |

---

## SchemaQA-13: DIAGRAM-3 のスキーマ検証

**[Trigger]**
DIAGRAM-3 スライドが以下の条件を満たさないと検出:

| サブルール | 内容 | severity |
|---|---|---|
| 13a | `diagram` フィールド必須 (オブジェクト) | fatal |
| 13b | `diagram.template_id == "SCENE-06"` 推奨 (DIAG-XX 等を渡しても動くが意図と違う) | warn |
| 13c | `diagram.layout` が `vertical-decision` / `horizontal-flow` / `simple-vertical` のいずれか | fatal |
| 13d | layout=vertical-decision なら `steps[]` が 1 件以上 | fatal |

**[Why]**
DIAGRAM-3 は FlowChart 専用テンプレなので、`diagram` 抜きで描画すると本文領域に
プレースホルダーしか出ない。3 つの layout 名は固定なので typo を機械検出する。

**[実装]**
Zod schema (`schemas/templates/index.js` の DIAGRAM-3 定義) で検査。

---

## SchemaQA-14: FRAMING-5 (章末まとめ) スキーマ検証

**[Severity]**
- mode 不在 / 不正値 → **fatal**
- items[] が 3 件でない → **fatal**
- head 15 字超 / body 60 字超 → warn

**[何を検査]**
FRAMING-5 (章末まとめ「この章の持ち帰り」) のスキーマ整合:
- `mode` は `"comprehension"` / `"recap"` のいずれか必須
  - comprehension = 判断ロジックを問う型 (☑ チェックリストアイコン)
  - recap = 事実・歴史・統計をまとめる型 (☰ メモアイコン)
- `items[]` はちょうど 3 件
- 各 `item.head` は 15 字以内
- 各 `item.body` は 60 字以内

**[なぜ 3 件固定]**
心理学的に「3 つ」が最も再生率が高い (Magic Number 3)。1 件だと持ち帰り感が薄く、
4 件以上だと記憶に残らない。固定することでテンプレが安定し、読者にも
「章末に来たら 3 つ確認」のリズムが生まれる。

**[Anti-pattern]**
- `mode` 未指定 (= Claude が章の中身を見て comprehension / recap を選ぶ手間を放棄)
- `items: [{...}, {...}]` (2 件しかない) — 章を分割するか LIST-1 で代替
- `items: [{...}, {...}, {...}, {...}]` (4 件以上) — 詰め込みすぎ。優先度上位 3 つに絞る
- `head: "弱者の鉄則という最も大事な点"` (15 字超) — 見出しは短く力強く

**[Recommended]**
- `head`: 4〜12 字の体言止め (例: 「弱者の鉄則」「勝てる条件」「経営への翻訳」)
- `body`: 30〜50 字で、章で扱った具体名・数値を 1 つ含める
- `mode` は Claude が章の性質から推論し、`_mode_reason` に判定理由を残す

**[Fix]**
1. mode が無いなら、章の中身を見て comprehension / recap を選ぶ
2. items の数が 3 でないなら、章の核心 3 つに絞る (難しければ章を分ける)
3. head が長いなら体言止めに、body が長いなら要点だけ残す

**[実装]**
Zod schema (`schemas/templates/index.js` の FRAMING-5 定義) で検査。

---

## SchemaQA-15: VISUAL-7 (リファレンス画像補足) のスキーマ検証

**[Trigger]**
VISUAL-7 単体スライドのスキーマ検証 + `doc.references[].image` 検証。

**必須:**
- `ref_num` (整数 or 数字文字列): `doc.references[].num` との 1:1 対応
- `source_url` または `source`: 出典の明示 (どちらか必須)

**[Why fatal]**
著作権の引用要件 (出所明示) を構造で担保するため、source_url が無い VISUAL-7 は
そもそもスライドに使えない。fetch 失敗時はスライドを作らずスキップする運用なので、
ここで残っているということは「ユーザーが手書きで VISUAL-7 を書いたが出典を
書き忘れた」ケース。

**[Fix]**
1. `ref_num` に対応する `doc.references[].num` を整数で指定する
2. `source_url` を `https://...` 形式で書く
3. 自動挿入経路 (`doc.references[].image.enabled = true`) を使うなら、
   `image.source_url` と `ref.num` を埋めれば build-deck.js が自動でスライドを生成する

**[実装]**
build-deck.js の `enrichReferenceImages` で検査。
