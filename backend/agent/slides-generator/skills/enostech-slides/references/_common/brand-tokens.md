# ブランドトークン運用ルール

> 機械的な値は `assets/tokens.js` にある。ここは「なぜその値か・どう使うか」の運用ルール。
>
> ⚠️ **このドキュメントを読む前に `references/_common/workflow.md` を読むこと**。
> スライド制作は「Before → Afterの設計 → アウトライン → パターン適用」の順で進む。
> このドキュメントは最後のステップ（パターン適用時の色・タイポ・余白の使い方）を扱う。

---

## 1. スライド制作の前提 — 1 スライド = 1 メッセージ

ENOSTECH のスライドは、**飾りではなく伝達の道具**。スライドを作る前に次の質問に答える：

1. **このスライドで読者に伝えたいたった 1 つのことは何か？**
2. **このスライドの前後で読者の理解・心情をどう変えたいか？**
3. **主張を支える最小限の具体（図・表・箇条書き）は何か？**

上記が明確でないスライドは、作る前に一度「そのスライド要らないのでは？」と問い直す。

「説明したいことを全部詰める」は最悪のアンチパターン。1 つの主張 + その支え、が 1 スライドの使命。

---

## 2. タイトル + サブコピー構造

全スライド（表紙・閉じ・セクション扉・ビジュアル主体を除く）は次の 2 階層で構成：

```
タイトル (20pt bold, ink, y=0.55 ブロック起点)
  └ そのスライドが伝えたい 1 メッセージを言い切る。体言止め or 言い切り。20〜30 字。
  例: "SQLを書く時間がない、のお悩みから解放"
     "これまで、これから"
     "6 つの機能で分析業務を一気通貫"

サブコピー (11pt 太字, ink, 引用ブロック風下敷き付き, 1〜4 行で動的高さ)
  └ タイトルの理由・補足・「なぜ」「どうやって」を読者がスライド単独で
    理解できる説明として書く。
  └ 推奨 120〜200 字。最大 250 字まで許容。最低でも 80 字。
  例: "Excel で 30 分かかっていた月次集計が、FactHub に話しかけるだけで
       2 秒で完了。SQL 担当者の手を借りる必要もなくなり、現場で完結する
       分析が当たり前になります。"（92 字、2〜3 行）
```

### タイトルの書き方のコツ

- **20〜30 字で言い切る**。長くしない
- **名詞で終わらせず、動詞・言い切りで終わらせる** ことで主張が強くなる
  - ❌ "FactHub の機能" (弱い、情報感)
  - ✅ "FactHub で、分析の時間を 10 分の 1 に" (強い、主張感)
- **英単語・カタカナ語を避けられるなら避ける**

### サブコピーの書き方のコツ

サブコピーは「タイトルの理由・補足」を一言で添えるサブセットではなく、
**読者がスライド単独で内容を理解できる説明** が最優先。短くまとめる原則は残すが、
**短すぎて伝わらないより、伸びても分かりやすさを優先** する。

#### 含める要素（3〜4 つを意識して書く）

| # | 要素 | 中身 |
|---|------|------|
| ① | **具体** | 数値・固有名・業種・規模・人物像 |
| ② | **「なぜ」「どうやって」** | タイトルの主張がなぜ成立するか／どうやって実現するか |
| ③ | **読後の変化** | Before → After の差分（「〜だったのが、〜に」型） |
| ④ | **逆接・対比** | 「〜だが」「〜ではなく」で論点を絞る |

「言い切り 1 文（30 字以下）」は禁止。視線が滑り、内容が伝わらない。
タイトルで「何を」と言い、サブコピーで「なぜ・どうやって・何が変わるか」を言う。
タイトルの同義語反復はしない（"FactHub の機能" → "FactHub の機能について" は NG）。

#### 良い例 (具体 + なぜ + 読後の変化)

| 短すぎる例 | 充実した例 |
|---|---|
| 「30 分の作業が 2 秒に」（17 字） | 「Excel で 30 分かかっていた月次集計が、FactHub に話しかけるだけで 2 秒で完了。SQL 担当者の手を借りる必要もなくなり、現場で完結する分析が当たり前になります。」（92 字） |
| 「分析の時間を 10 分の 1 に」（13 字） | 「BigQuery への問い合わせ設計から SQL 実行・グラフ化まで、対話 1 回で完結。これまで 1 時間かかっていた典型的な分析タスクが平均 6 分に短縮され、思考のリズムが切れません。」（93 字） |
| 「6 つの機能で分析業務を一気通貫」（17 字） | 「分析計画・SQL 生成・実行・可視化・解釈・レポート化の 6 機能を 1 本のチャットに統合。ツール間の切り替えで生まれていた 1 日 30 分の摩擦が消え、思考が継続します。」（91 字） |

#### 文字数のガイドレール

- **120〜200 字** が推奨レンジ。1〜2 行に収まり、視線が一往復で読める長さ
- **80〜120 字** は許容。説明が短く済む場合（既存の言い回しに合わせる時など）
- **200〜250 字** は許容。3〜4 要素を盛る必要がある時。3 行を超えるならテンプレ別に
  本文側との衝突を確認すること（PROJECT-2 / 13 / 35 / 36 など縦に詰まったテンプレでは要注意）
- **250 字超** は分割する。1 スライド 1 メッセージから外れている可能性が高い

---

## 3. 横文字を使わない

enostech.co.jp のトーンは「カジュアル気味だけど誠実」。英字装飾が多いと、マーケティング的で誠実さが損なわれる。

### ❌ 禁止

```
SECTION 01 │ ROLE TRANSITION
TOOL 03 │ AI AGENT
CHALLENGES → OUTCOMES
BEFORE / AFTER
Product Detail
Feature 01
Four Pillars
Agenda
Our Values
Schedule
Budget Breakdown
Coverage
```

### ✅ 推奨

```
目次
本日のゴール
これまで／これから
課題／効果
プロジェクトの進め方
スケジュール
予算の内訳
カバーする分析領域
```

**例外**: 以下は OK
- 製品名・社名（FactHub, ENOSTECH, BigQuery 等の固有名詞）
- 技術用語で日本語訳が定着してないもの（SQL, AI, SaaS 等）
- 単位（%, 万円 等）

---

## 4. マージン — 広すぎない、でも詰めすぎない

### 横断デザイン基準値 (tokens.js の layout)

| 軸 | 値 | 狙い |
|----|------|------|
| 角丸 (`rectRadius`) | **0.08** | 一段抑えて知的な印象に |
| 罫線 (`line.width`) | **0.25** | 区切りは余白で。罫線は最小限 |
| カード padding (`cardPad`) | **0.30** | カード内余白を増やして読みやすく |
| 行間 (`lineSpacingMultiple`) | **1.40** | リズムを整える |

#### 例外として触らない値

- 小角丸 `0.05` / `0.06` — 小バッジの scale 比保持
- ピル形 `rectRadius: h/2` — 形状の意味が変わるため
- ブランドカラー / フォント / フォントサイズ階層 — トーンの根幹
- スライド寸法 (10" × 5.625") / マージン (0.4") / 左サイド色帯 (0.12")
- セマンティック色 (success / warning / danger)
- ナビ chip の高さ (h2 の値)
- 一部 lineSpacing (1.10 / 1.15 / 1.20) — タイル詰め込みで意図的に詰めた箇所

### マージン

```
外側左右:  0.40"  （スライド幅 10" の 4%）
外側上端:  0.30"
外側下端:  0.30"
実質コンテンツ幅: 9.2"
実質コンテンツ高: 5.025"
```

### 内側ガター

- カラム間: 0.22"
- カード間の視覚的ギャップ: 0.15"〜0.20"

### タイトル帯

タイトル + サブコピーは `addTitleBlock` ヘルパー（`scripts/example-deck.js`）が一括で配置する。
サブコピーの実高さは文字数から自動算出される（1 行あたり目安 50 字）。

```
y = 0.55    タイトルブロック起点（titleBlockY）
y = 0.55    タイトル開始（20pt bold、高さ 0.48"）
y = 1.05    サブコピー開始
            └ サブコピー高さは subBlockH = 0.30 + 0.22 × subLines
              1 行 = 0.52", 2 行 = 0.74", 3 行 = 0.96", 4 行 = 1.18"
y = 動的    本文開始 = サブコピー末尾 + 0.16"
            ・1 行サブコピー: y ≒ 1.65"（L.contentY）
            ・2 行サブコピー: y ≒ 1.95"（L.contentYRoomy）
            ・3 行以上: addTitleBlock の戻り値を直接受ける
```

実装上、テンプレ側は次のいずれかの方法で本文 y を決める:

```javascript
// パターン A: 戻り値を直接受ける（推奨・3 行以上のサブコピーに必須）
const contentTop = addTitleBlock(s, title, sub);
// → contentTop を本文の y として使う

// パターン B: 固定値で逃げる（1〜2 行サブコピー）
addTitleBlock(s, title, sub);
const contentTop = L.contentY;        // 1 行サブコピー想定
// または
const contentTop = L.contentYRoomy;   // 2 行サブコピー想定
```

---

## 5. タイポグラフィ — Noto Sans JP 統一

### フォント選定

- **全テキスト Noto Sans JP**（日本語・英数字とも）
- Noto Sans JP は Google Fonts で無料配布されており、現代の日本のスタートアップでデファクト
- 環境に入っていない場合は、システムの日本語フォント（Hiragino Sans / Yu Gothic）にフォールバックされる

### サイズ階層

| 用途 | サイズ | トークン |
|-----|-------|---------|
| 表紙のメインタイトル | 32pt bold | `size.titleXL` |
| 本編タイトル | 20pt bold | `size.titleL` |
| サブコピー / リード | 11pt | `size.lead` |
| カード見出し | 16pt bold | `size.h2` |
| 本文 | 11pt | `size.body` |
| 注釈・caption | 9pt | `size.caption` |
| 大きな数字（運用ナンバー）| 40pt bold | `size.numLarge` |

---

## 6. カラー

### テーマシステム

ENOSTECH のカラーは **5 つのテーマ** から選択できる。各テーマで色の **役割** は固定、値だけ差し替わる。

#### テーマの役割構造（全テーマ共通）

| 役割 | 意味 | 使い所 |
|-----|-----|-------|
| **brand** | メインカラー・主張・ブランド性 | タイトルハイライト、番号バッジ、主要アクセント |
| **accent** | スパイス・達成感・温かさ | マイルストーン、成果、ポジティブな変化、解決策 |
| **neutral** | 中立・本文・補助 | 本文テキスト、枠線、背景補助 |
| **canvas** | スライド背景 | 全スライドのベース |

#### 5 つのテーマ

| テーマ | brand | accent | 用途 |
|-------|-------|--------|-----|
| `corporate` | Navy `#1E3A8A` | Gold `#CA8A04` | 金融・コンサル・士業・官公庁 |
| `nature` | Forest `#15803D` | Orange `#EA580C` | サステナブル・ヘルスケア・消費財 |
| `warm` | Red `#DC2626` | Teal `#0D9488` | エンタメ・飲食・B2C |
| `mono` | Black `#000000` | Amber `#F59E0B` | ラグジュアリー・アート |

#### コードでの使い方

```javascript
const T = require('./tokens');

// テーマを切り替え

// あとは通常通り
slide.addText('タイトル', {
  color: T.color.brand,      // → ネイビー #1E3A8A
  fontFace: T.font.jp,
});

slide.addShape(pres.shapes.RECTANGLE, {
  fill: { color: T.color.accentSoft },  // → 薄ゴールド
  ...
});
```

#### 色の役割を守るルール

**brand を使うべきところ**:
- 主張・強調・ブランド感を出したい箇所
- タイトル下のサブコピー下敷き（ブランドトーン時）
- 番号バッジの強調版
- 主要アクセント

**accent を使うべきところ**:
- **マイルストーン・達成**（例: スケジュールの達成報酬ピル）
- **ポジティブな変化**（例: "これから" 側のカード）
- **解決策の提示**（例: 課題→解決の結論バナー）
- **2 色構成の表紙・閉じバー**（brand + accent で温冷バランス）
- **円グラフ等での彩度確保**

**accent を使わないところ**:
- 警告・エラー表示（これは `gray700` か semantic 色）
- 大面積の塗り（小面積でハイライトするからこそ効果的）
- 本文テキスト（読みづらい）

### 面積比（テーマ横断で同じ）

```
白・canvas (背景)    ~65%
ink (本文・見出し)    ~20%
グレー (補助)          ~8%
brand                  ~4%
accent (スパイス)      ~3%
```

### トークン別参照

`tokens.js` の `color` オブジェクト経由でアクセス。主要プロパティ：

**役割ベース（推奨）**:
- `C.brand` / `C.brandSoft` / `C.brandDeep` / `C.brandContrast`
- `C.accent` / `C.accentSoft` / `C.accentDeep` / `C.accentContrast`
- `C.ink` / `C.gray700` / `C.gray500` / ... / `C.gray50`
- `C.canvas` / `C.white`

---

## 7. 禁忌（不変）

1. タイトル下に装飾横線を引かない
2. 全幅のカラーバー・リボンを置かない
3. クリーム・ベージュ背景は不使用
4. 絵文字を本文に使わない
5. フォント混用を避ける（Noto Sans JP 一択）
6. 斜体・3D・過剰な影を避ける
7. パープル/マゼンタの大面積塗り禁止

---

## 8. 🔴 デザイン系絶対ルール

> 全 Phase 横断のデザイン規約。
> セクション 1〜7 と重複するものは「[§N と同じ]」で参照する。

### R-DESIGN-01 色は必ず `tokens.js` から取る

ハードコード hex（`"#9212F3"` など）は禁止。`T.color.brand` / `T.color.accent` /
`T.color.gray700` 等で参照する。テーマ切替時に色だけ差し替わる構造を壊さない。

### R-DESIGN-02 `"#"` 付き hex、8 桁 hex を使わない

PptxGenJS の color プロパティは `"FFFFFF"` 形式（# なし、6 桁）を要求する。
`"#FFFFFF"` も `"FFFFFFFF"` も書かない。

### R-DESIGN-03 タイトルは上寄り（y=0.35 付近）

下寄りにしない。詳細は §4 のタイトル帯。

### R-DESIGN-04 タイトル + サブコピーの 2 階層構造を厳守

[§2 と同じ]。表紙・閉じ・セクション扉・ビジュアル主体を除く。
推奨 120〜200 字、最大 250 字。3〜4 要素（具体／なぜ・どうやって／読後の変化／逆接・対比）
を含める。

### R-DESIGN-05 1 スライド = 1 メッセージ

[§1 と同じ]。「説明したいことを全部詰める」は最悪のアンチパターン。

### R-DESIGN-06 マージンは 0.4"。0.5" 以上取らない

[§4 と同じ]。

### R-DESIGN-07 禁忌をそのまま

- タイトル下に装飾線を引かない（§7-1）
- 全幅カラーバー・リボンを置かない（§7-2）
- 本文色は `gray700`、見出しは `ink`、ハイライトに `purple`

### R-DESIGN-08 公式ロゴは左下フッター固定、右上は空領域として予約

`assets/logos/` から画像として配置。**標準クロームでは左下に配置**（`addChromeFooterLogo`）、
右上は空領域として予約（ナビチップ・サブセクションパンくず専用）。毎スライド同じフッター
テキストの繰り返しは避ける。

### R-DESIGN-09 参考リンクは URL を表示せず、ページタイトルを青文字（`#0563C1`）ハイパーリンクで表示

`addFootnote(s, [{label, url}])` / `addReferenceTable` が自動でこの形式にする。

### R-DESIGN-10 全デッキ末尾に DATA-4 参考情報集ページを必ず 1 枚配置

実装は `addReferenceTable(s, rows)`。Phase 2 の固定枠 R2-7 と整合。

### R-DESIGN-11 本文中の主張・数値・事実には青文字インライン参照番号 `(1)` / `[1]` / `（1）` を埋め込む

**3 形式** (`(N)` / `[N]` / `（N）`) を許容する正規表現で検出。

**`addFootnote` 単独運用は禁止**（タイトル + 青文字を左下に置くだけの形は「読者が出典に
アクセスする動線が間接的」になり UX が落ちる）。必ず **`inlineRef` を本文の該当主張直後に
差し込む** ことを優先する。脚注 (`addFootnote`) は「方法論的注記（`n=713 の回答に基づく` 等）」
にのみ使い、出典そのものは (a) インライン番号 (b) 末尾参考情報集ページの 2 段構えで運用する。
番号は末尾 DATA-4 の行順と一致させ、ハイパーリンクの URL は出典先に直接飛ばす。実装は
`inlineRef(num, url, opts?)` を `slide.addText([...runs])` の text run として埋め込む。

**グローバル展開**:
全テンプレ・全 `slide.addText` 呼び出しで `(N)` パターンを **自動でハイパーリンク化** する
グローバルラッパーを `build-deck.js` に組み込み済み。テンプレ実装側で `expandInlineRefs` /
`inlineRef` を呼ばなくても、`subtitle` だけでなく **本文・カード・キャプション**
の `(1)` `(12)` 等は Office 標準ハイパーリンク色（`#0563C1` + 下線）に自動変換される。

**テーブル経路もカバー**:
`build-deck.js` は `slide.addTable` も同時にラップし、**各 cell の `text` フィールド** (string でも runs[] でも) を `expandInlineRefs` / `expandRunsInlineRefs` に通してから addTable を呼ぶ。これにより
**本文・カード・キャプション・テーブルセル** すべての `(N)` が自動で青文字 + 下線になる。

> **絶対ルール**: `(N)` パターンを書いた以上、ctx.refsByNum[N] に URL が解決できる場合は
> **必ず** 青文字リンクとして描画する。テンプレ実装で `slide.addText(plainString, opts)` /
> `slide.addText([{text:..., options:...}, ...], opts)` / `slide.addTable(rows, opts)`
> どの経路でも黒文字のまま残してはならない。
>
> 該当ページの `ref_table[]` に対応行が無い `(N)` は SchemaQA-10 が warn するため、
> ref_table 側に `(N) タイトル` 形式で追加すること。

技術詳細:
- `build-deck.js` は `pres.addSlide` 直後に `slide.addText` と `slide.addTable` を
  両方モンキーパッチする。
- addText: string → `expandInlineRefs(text, ctx, {})`、Array<run> →
  `expandRunsInlineRefs(runs, ctx)` を通す。
- addTable: 各 row の各 cell について
  - plain string なら `expandInlineRefs` を通し、ref を含めば `{ text: runs[] }` に置換
  - `{ text: string, options }` なら text を `expandInlineRefs` に通し、cell-level の
    text props (color/fontSize/fontFace/bold/italic/underline 等) を baseOptions として継承
  - `{ text: runs[], options }` なら runs を `expandRunsInlineRefs` に通す
- `(N)` パターンを含まない文字列・装飾ラベル（`Before`/`After`/`01`/`02` 等）は副作用ゼロ。
- subcopy 経路 (`addTitleBlock` 内の `expandInlineRefs`) は二重展開されても idempotent。
- speaker notes (`slide.addNotes`) は対象外（speaker 用テキストはハイパーリンク化しない仕様）。

### R-DESIGN-12 表紙スライド（SECTION-1）は「ロゴを置かない・タイトルは 1 行」を既定とする

左上 `horizontalColor` ロゴと右下 `symbolColor` ロゴは明示的に削除し、ブランド表現は
上辺 2 色バー（紫 + アンバー）と左サイドストライプ、および左下フッターロゴだけに委ねる。
タイトルは `w: 9.2` の横幅をフルに使い、`fit: 'shrink'` 指定で改行せず 1 行に収める
（長いテーマ名でも自動縮小）。

### R-DESIGN-13 ナビチップ文字列は `sections[].name` の単一ソース

本文スライドの上部ナビチップに表示される章名は、**`scripts/example-deck.js` の
`setDeckSections([{name, lead, ...}, …])` で一度だけ登録した `name` を、それ以降の
`addChromeWithNav(s, page, idx)` が内部で `_DECK_SECTIONS[idx]` から自動参照する**。
章扉スライドのタイトルにも同じ `sections[idx].name` を渡す。

**禁止事項**:
- ナビ chip 用に「短縮版」の文字列を別変数で保持する
- `addChromeNav(s, [...独自配列...], idx)` を直接呼ぶ
- 章扉のタイトルに、`sections[idx].name` と異なる文字列を渡す

**狙い**: 1 章 = 1 名前を物理的に強制する。SecQA-10 (sections-qa.md) で `sections[].name` の長さ
（4〜12 字推奨、2〜18 字必須）と demo 残骸チェックを自動採点する。

---

## 9. 生成後セルフチェック

- [ ] **1 スライド = 1 メッセージ** になっているか？ 主張を 1 行で言えるか？
- [ ] タイトル + サブコピー構造になっているか？
- [ ] タイトルが上寄り（y=0.35 付近）にあるか？
- [ ] 英字 eyebrow / 英字装飾ラベルが入っていないか？
- [ ] マージンが 0.4" に統一されているか？
- [ ] 全テキストに `fontFace: "Noto Sans JP"` が指定されているか？
- [ ] 色の面積比（70/20/7/3）が崩れていないか？
- [ ] 表紙/閉じを除き、左下に `ENOSTECH` ロゴがあるか？

---

## §N. 外部 design.md 参照（オプション）

クライアント案件で「先方のブランドガイドに寄せたい」「既存のデザインシステム
（Tailwind / IBM Carbon / Spotify など）に揃えたい」時、外部の `design.md` を
個別トークンを載せる二段重ね** という位置付け。

### N.1 使い方

```javascript
const T = require('../assets/tokens');

// パターン①: 既存（テーマだけ）

// パターン②: テーマ + design.md 上書き
T.useDesignFile('./design.md');

// パターン③: design.md 内の baseTheme で自動切替

// 戻したい時
T.clearDesignOverrides;           // 上書きを剥がす（テーマだけに戻る）
```

### N.2 design.md フォーマット

```markdown
# Design Tokens

## Meta
- name:       Tailwind Slate × Amber
- baseTheme:  mono                # 上書きの土台。省略可（デフォルト mono）
- source:     https://tailwindcss.com/docs/customizing-colors

## Colors
- brand:      "#475569"
- brandSoft:  "#F1F5F9"
- brandDeep:  "#1E293B"
- accent:     "#F59E0B"
- accentSoft: "#FEF3C7"
- accentDeep: "#B45309"
- ink:        "#0F172A"
- gray700:    "#334155"
- gray500:    "#64748B"
- gray100:    "#F1F5F9"
- canvas:     "#FFFFFF"

## Typography
- fontFace:   "Inter, Noto Sans JP, sans-serif"
- titleXL:    32
- titleL:     22
- body:       11
- caption:    9

## Notes (任意・無視される)
- メモを書ける
```

**パースルール**:
- `## Colors` / `## Typography` / `## Meta` ヘッダ配下の `- key: value` 行のみ拾う
- HEX は `#` あり/なし、3 文字省略形（`#FFF`）どちらも許容、内部では 6 文字大文字に正規化
- 不明なキー・不正な HEX・不正なサイズは **警告のみ・スキップ**（落ちない）
- コメント `# foo` は剥がす（クオート内の `#` は守る）
- `fontFace` は `F.jp` / `F.en` に同時反映、`F.mono`（Consolas）は守る

### N.3 上書き対象 / 対象外

| カテゴリ | 上書き | 備考 |
|---------|:----:|------|
| 役割色（brand / brandSoft / brandDeep / accent 系 / accentHi）| ○ | テーマ役割と完全に同じキー名 |
| グレースケール（ink / inkSoft / gray50〜700 / canvas / white）| ○ | |
| `fontFace` | ○ | 明示時のみ。デフォルトは Noto Sans JP 維持 |
| sizes（titleXL / titleL / lead / h2 / h3 / body / bodySm / caption / numLarge / numMed）| ○ | |
| `diagramPalette`（6 トラック × 3 階調）| × | ダイアグラム可読性最優先・テーマ横断で固定 |
| レイアウト寸法（marginX / contentY / titleBlockY / slideW など）| × | 全テンプレが崩れるため触らない |
| セマンティック色（positive / warning / negative）| × | ステータス意味は固定 |
| FRAMING-3 Twilight Forge（near-black 背景・gradient pill）| × | 会社紹介の世界観 |

### N.4 サンプル design.md（バンドル済）

`assets/test-design-files/` 配下に検証・参照用に 3 種同梱：

| ファイル | ベーステーマ | 用途・テイスト |
|---------|------------|----------------|
| `tailwind-slate-amber.md` | `mono` | B2B SaaS の実用的でくっきりした雰囲気 |
| `ibm-carbon-blue.md` | `corporate` | エンタープライズの冷静で確かな印象 |
| `spotify-green.md` | `nature` | エンタメの力強くカジュアルなテイスト |

クライアント案件のヒアリングで先方のブランドが固まっていれば、これらを
雛形にして専用 design.md を起こすと早い。

### N.5 既存ルールとの整合

- **tokens 経由の鉄則は維持**。design.md の値も最終的に `C.brand` / `F.jp` 等として
  参照されるので、テンプレ実装側のコードは一切変えない。
- **Noto Sans JP デフォルト維持**。design.md で `fontFace` を明示
  しない限り Noto のまま。
- **diagramPalette は固定**。可読性最優先の方針を変えない。
- **FRAMING-3 Twilight Forge は固定**。会社紹介スライドの世界観。
- **ベーステーマで穴埋め**。design.md で全色を埋めなくても、テーマがベースとして
  機能するので破綻しない。

### N.6 design.md を渡された時の Phase 別ふるまい

- **Phase 1 ヒアリング**: クライアントから design.md またはブランドガイドが
  渡されているかを確認。あれば pdf/url を見て該当キーを起こすか、その場で
  簡易 design.md を書く。出典 URL は `## Meta - source` に必ず残す。
- **Phase 2 情報設計**: 採用する `baseTheme` を選び（mono が無難）、design.md
  の主要色をデッキ全体で 70/20/7/3 の面積比に乗るかをシミュレート。
  を呼ぶ。design.md ファイルはデッキディレクトリ内に置く。
- **Phase 4 QA**: PNG 化したスライドで先方ブランドガイドと色味が一致するかを
  目視確認。不一致があれば design.md を直して再生成。
- **Phase 5 packaging**: design.md を `decks/{slug}/design.md` にコピーして
  「このデッキは何を上書きしたか」を再現可能な形で残す。
