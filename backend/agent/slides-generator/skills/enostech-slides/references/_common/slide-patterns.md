# スライドパターン選び方ガイド

> ⚠️ **このドキュメントを読む前に `references/_common/workflow.md` を読むこと**。
> パターン選定は「Step 3」の作業であり、その前に Step 1 (Before→After 設計) と Step 2 (Markdown アウトライン) が済んでいる必要がある。
> アウトラインなしにパターンを選ぶのは本末転倒。
>
> **核心原則**: 1 スライド = 1 メッセージ。
> スライドを選ぶ前に、「このスライドで読者をどこへ連れて行きたいのか？」を明確にすること。

---

## テンプレ ID → ディレクトリ・ファイル マッピング

各テンプレ ID に対応する純粋関数が `scripts/render/templates/{category}/` 配下にある。
Phase 3 では `scripts/render/build-deck.js` が `templates/index.js` 経由で
カテゴリ集約された TEMPLATE_REGISTRY を使って自動ディスパッチする。

### SECTION (構造系)
| ID | ファイル | 用途 | 推奨 deckStructure |
|---|---|---|---|
| SECTION-1A | section.js | 表紙・Twilight Forge シンプル版（dark hero + signature pill） | 全般 / proposal-deck |
| SECTION-1B | section.js | 表紙・エディトリアル分割（左 50% 画像 + 右 50% タイトル） | learning-deck / case-study-deck（事例ヒーロー画像あり） |
| SECTION-1D | section.js | 表紙・ミニマル・タイポグラフィ（白背景 + 大見出し + 細い罫線） | case-study-deck / company-research |
| SECTION-1F | section.js | 表紙・引用主導（核となる一言を主役、タイトルは下部小） | proposal-deck（問いかけ冒頭） |
| SECTION-1G | section.js | 表紙・full-bleed SVG only（SECSUMMARY-1 と同じ思想） | learning-deck（図で語れるトピック） |
| SECTION-2 | section.js | 章扉 (デフォルト・黒背景) | 全般 |
| SECTION-3 | section.js | 閉じ | 全般 |
| SECTION-4 | section.js | 章扉 A (白背景 + 左帯) | 全般 |
| SECTION-5 | section.js | 章扉 B (黒 + 中央寄せ) | 全般 |
| SECTION-6 | section.js | 統合目次 (2 カラムグリッド) | 全般 |

### LIST (本文系)
| ID | ファイル | 用途 |
|---|---|---|
| LIST-1 | list/list-1-content.js | 標準コンテンツ (bullets) |
| LIST-2 | list/list-2-3col.js | 3 カラム |
| LIST-3 | list/list-3-cardgrid.js | カードグリッド |
| LIST-4 | list/list-4-card-stack.js | 縦カード積み (3 段) |
| LIST-5 | list/list-5-tile-2x2.js | タイル 2×2 |
| LIST-6 | list/list-6-tile-3x2.js | タイル 3×2 |
| LIST-7 | list/list-7-tile-3x3.js | タイル 3×3 |
| LIST-8 | list/list-8-detail-card.js | 詳細カード (左メイン + 右ペイン) |
| LIST-9 | list/list-9-icon-3col.js | アイコン 3 カラム |

### COMPARE (比較系)
| ID | ファイル | 用途 |
|---|---|---|
| COMPARE-1 | compare/compare-1-before-after.js | Before/After リッチ (3 行) |
| COMPARE-2 | compare/compare-2-before-after-compact.js | Before/After コンパクト (6 行) |
| COMPARE-3 | compare/compare-3-comparison.js | アイコン比較 (◎○△×) |
| COMPARE-4 | compare/compare-4-tradeoff.js | トレードオフスライダー |
| COMPARE-5 | compare/compare-5-grouped.js | グルーピング付きアイコン比較 |
| COMPARE-6 | compare/compare-6-text-detail.js | テキスト補足比較 |

### DATA (表 / 数字 / 用語集)
| ID | ファイル | 用途 |
|---|---|---|
| DATA-1 | data/data-1-keyvalue-table.js | 項目-値テーブル |
| DATA-2 | data/data-2-data-table.js | データテーブル (複数列) |
| DATA-3 | data/data-3-number-graph.js | 数字 + ブレークダウン |
| DATA-4 | data/data-4-references.js | 参考情報集 (ref_table) |
| DATA-5 | data/data-5-glossary.js | 用語集 |

### PROJECT (フェーズ / スケジュール)
| ID | ファイル | 用途 |
|---|---|---|
| PROJECT-1 | project/project-1-phase-flow.js | フェーズフロー (4 段) |
| PROJECT-2 | project/project-2-schedule.js | ガントチャート (シングル) |
| PROJECT-3 | project/project-3-schedule-5track.js | ガント 5 トラック |
| PROJECT-4 | project/project-4-schedule-2tier.js | ガント 2 層 (親→子) |

### DIAGRAM (定型図解)
| ID | ファイル | 用途 |
|---|---|---|
| DIAGRAM-1 | diagram/diagram-1-matrix.js | 2x2 マトリクス |
| DIAGRAM-2 | diagram/diagram-2-flow.js | フロー図 (横一列) |
| DIAGRAM-3 | diagram/diagram-3-flowchart.js | FlowChart 専用 (意思決定木) |
| DIAGRAM-4 | diagram/diagram-4-illustration.js | 章挿絵 (見取り図 / SVG) |

### CHART (定量データ)
| ID | ファイル | 用途 |
|---|---|---|
| CHART-A1 | chart/chart-a1-only.js | チャート単体 |
| CHART-A2 | chart/chart-a2-text.js | チャート + 解釈 3 行 |
| CHART-A3 | chart/chart-a3-3col.js | チャート + 3 観点コメント |
| CHART-A4 | chart/chart-a4-pair.js | チャート 2 つ並列 |

> 内部の chart サブテンプレ (CHART-01〜09) は `scripts/render/charts/` 配下。
> スライド全体の "CHART-Ax" と区別。

### VISUAL (画像 / SVG ハイブリッド)
| ID | ファイル | 用途 |
|---|---|---|
| VISUAL-1 | visual/visual-1-profile.js | プロフィール (顔写真 + 強み) |
| VISUAL-2 | visual/visual-2-evidence.js | エビデンス (帯グラフ + 結論) |
| VISUAL-3 | visual/visual-3-visual.js | ビジュアル主体 |
| VISUAL-4 | visual/visual-4-image-card-2x2.js | イメージカード 2x2 |
| VISUAL-5 | visual/visual-5-split-image-text.js | 左画像 + 右テキスト |
| VISUAL-6 | visual/visual-6-fullvisual.js | フルビジュアル |
| VISUAL-7 | visual/visual-7-reference-image.js | リファレンス画像補足 |
| VISUAL-8 | visual/visual-8-summary-image.js | グラレコサマリー |
| VISUAL-9 | visual/visual-9-svg-numbered-cards.js | SVG + 番号付きカード |
| VISUAL-10 | visual/visual-10-svg-3step.js | 横3コマSVG + ステップ |
| VISUAL-11 | visual/visual-11-svg-top-3card.js | 上 SVG + 下 3 カード |
| VISUAL-12 | visual/visual-12-svg-pair.js | 左右 SVG ペア |

### WEBPAGE (Web 記事の集約・解説)
| ID | ファイル | 用途 |
|---|---|---|
| WEBPAGE-1 | webpage/webpage-1-summary.js | 単独URL解説 (画像 + 要約 + 出典リンク) |
| WEBPAGE-2 | webpage/webpage-2-card-grid.js | 関連URLカードグリッド (4-6件一覧) |
| WEBPAGE-3 | webpage/webpage-3-detail.js | 1記事詳細解説 (左画像 + 右3ブロック) |
| WEBPAGE-4 | webpage/webpage-4-compare.js | 複数記事の論点比較 (2-3記事 × 共通論点) |

> ニュース収集・参考記事の社内共有・対立軸のあるトピックの両論並列等に。
> VISUAL-7 (リファレンス画像補足) は doc.references[].image.enabled=true での
> **自動挿入専用**として温存。手動で URL 1 件を解説したい時は WEBPAGE-1 を使う。

### CODE (コード / ターミナル / ツリー)
| ID | ファイル | 用途 |
|---|---|---|
| CODE-1 | code/code-1-single.js | 単一スニペット主役 |
| CODE-2 | code/code-2-split.js | 左コード + 右説明 4 ポイント |
| CODE-3 | code/code-3-comments.js | 上コード + 下 3 カラム解説 |
| CODE-4 | code/code-4-before-after.js | Before/After 2 コード並列 |
| CODE-5 | code/code-5-steps.js | ステップ実行 (番号 + 見出し + コード) |
| CODE-6 | code/code-6-terminal.js | ターミナル風 ($ プロンプト + # コメント + 出力) |
| CODE-7 | code/code-7-tree.js | ディレクトリツリー (ASCII 罫線) |

### FRAMING (序盤・締めの固定枠)
| ID | ファイル | 用途 |
|---|---|---|
| FRAMING-1 | framing/framing-1-background.js | 構築背景 (3 ブロック) |
| FRAMING-2 | framing/framing-2-before-after-list.js | Before/After リスト (序盤) |
| FRAMING-3 | framing/framing-3-company.js | 会社紹介 (締め) |
| FRAMING-4 | framing/framing-4-souvenir.js | お土産 (締め) |
| FRAMING-5 | framing/framing-5-checklist.js | チェックリスト + マインドセット (章末まとめ) |

### FREE (自由レイアウト)
| ID | ファイル | 用途 |
|---|---|---|
| FREE-1 | free/free-1-custom.js | カスタムシェイプ |


## 設計原則

全パターンに共通する前提：

1. **タイトル + サブコピー構造を厳守** — タイトルで主張、サブコピーで「なぜ・どうやって」を含む説明（120〜200 字推奨）
2. **横文字の eyebrow / 装飾ラベルを使わない** — 日本語のみ
3. **タイトルは上寄り（y=0.55 起点）**、サブコピーは 1〜4 行で動的高さ
4. **外周マージン 0.4"** でコンテンツを広く使う
5. **フォントは Noto Sans JP** で統一

---

## 情報構造の 3 階層

デッキは **セクション > サブセクション > スライド** の 3 階層で組む。

```
セクション (5 個前後、上部ナビチップ)
  └─ サブセクション (0〜3 個、右上パンくず)
      └─ 個別スライド (詳細)
```

**サブセクションを立てる条件**:
- 1 セクション内に関連トピックの塊が 2 つ以上あるとき
- 例: セクション「新機能の紹介」→ サブセクション「新機能 A / B / C」各 2〜3 スライド
- 無理に作らない。セクション直下にスライドが並ぶだけでも OK

**Chrome（上部ナビ）での表現**:
```
[なぜ] [設計思想] [ワークフロー]★ [パターン] [まとめ]  ›  Phase 2 : 情報設計
                                          ↑                  ↑
                                   セクション (active)    サブセクション (パンくず)
```
実装: `addChromeWithNav(s, pageNum, sectionIdx, 'Phase 2 : 情報設計')`

**サブセクション名とタイトル冒頭識別子は、別の役割**:

| 要素 | 役割 | 配置 |
|-----|-----|-----|
| サブセクション名 | 複数スライドの **グループ名** | 右上パンくず |
| タイトル冒頭の識別子 | そのスライド **固有の位置** | タイトル冒頭 |

**両者は同じでも違ってもよい**。わかりやすい例：

```
セクション:    ワークフロー
サブセクション: ステップ別の説明     ← グループ名（抽象）
 └ S3 タイトル:  Phase 1：ヒアリングから始める   ← 固有の位置（具体）
 └ S4 タイトル:  Phase 2：HTML 指示書を 3 タブ構造で出す
 └ S5 タイトル:  Phase 3：PPTX 化と QA
```

タイトル冒頭に識別子（Step / Phase / 新機能 X：など）を入れるのは、**そのスライドがシーケンスの何番目か** を示すため。
サブセクション名と **必ずしも一致させる必要はない**。

**サブセクションは任意** — セクション直下にスライドを並べるだけでも OK。無理に立てなくてよい。

**サブコピーの書き方**
- 言い切り 1 文（× 「30 分の作業が 2 秒に」）は禁止 — 視線が滑り、内容が伝わらない
- **読者がスライド単独で理解できる説明** が最優先（○ 「Excel で 30 分かかっていた月次集計が、話しかけるだけで 2 秒に。SQL 担当者への依存も解消される」）
- **推奨 120〜200 字、最大 250 字まで許容、最低 80 字**
- 含める要素は ① 具体（数値・固有名）／ ② 「なぜ」「どうやって」／ ③ 読後の変化／ ④ 逆接・対比 のうち **3〜4 個を意識**
- レイアウトは `addTitleBlock` が 1〜4 行で動的に拡縮するため、伸ばしても破綻しない
- 詳細は `phase2-information-design/README.md` R2-4

---

## カテゴリ A：STRUCTURE — デッキの骨格

| # | 名前 | タイトルの書き方 | 1 メッセージ例 |
|---|------|--------------|------------|
| 01 | 表紙 | 本編を暗示する大きな日本語タイトル | "データ分析の時間を 10 分の 1 に" |
| **SECTION-6 統合目次** ⭐ | **「本日の流れ」「全体の見取り図」** | **章ごとに ① セクション名 ② 概要 ③ サブセクション一覧 を 1 枚で表現する正規目次** |
| 03 | セクション扉（黒背景 + 巨大番号） | 章タイトルを日本語で | "デッキの骨格をつくる" |
| 33 | セクション扉 A （白背景 + 左帯） | 同上 | — |
| 34 | セクション扉 B （黒 + 中央寄せ） | 同上 | — |
| 09 | クロージング | 感謝のメッセージ | "ご清聴、ありがとうございました。" |

**セクション扉の使い分け**:
- **03（黒 + 巨大番号）**: ダーク・技術系・インパクト重視。黒背景が続くと重いのでデッキに 1 種を統一して使う
- **33（白 + 左 brand 縦帯）**: 本編スライドと同じ白背景系。落ち着いた印象、コーポレート向け
- **34（黒 + 上下 accent/brand 帯）**: 2 色帯が引き締め。章変わりの「舞台変換」感が強い

**デッキ内では 1 種類に統一**するのが原則。3 種類混在は避ける。

**SECTION-6 の使い方**
- **必須 3 要素**: ① 章タイトル ② 概要（その章で扱う内容を 1 行で予告）③ サブセクション一覧（各 chip）
- **想定密度**: 3〜5 章 × 各 2〜4 サブセクション。これを超えるなら章を分割
- **章本文 ≥ 4 枚なら subsection は 2 個以上必須**（SecQA-05 fatal）。
  本章を「ローカル環境 / WH 連携 / pre-commit と IDE / 昇格パイプ」のように
  意味のある日本語名で 2-4 個に切り分け、本文スライドの `subsection` field に分配する。
  TOC (SECTION-6) の chip と本文スライドのパンくずが同じ文字列を共有することで、読者の
  位置感覚が章ごとに作られる。
- **本文 ≤ 3 枚の小章は subsection を立てなくてよい**（章名で十分予告できるため）
- **subsection は 1 ページでも OK** — ナビにグループ名が出る効果は 1 枚でも大きい

---

## カテゴリ B：CONTENT — 本編トピックを深掘り

> **🚨 重要方針**: LIST-1（標準コンテンツ・箇条書き 3 ブレット）を選ぶ前に、
> 必ず **LIST-8 / LIST-4 / LIST-5 / LIST-3 などの「カード型 / リスト型」テンプレで同じ内容を
> 表現できないか** を検討する。LIST-1 が章内で 2 連続するのは原則禁止
> （SecQA-09 違反）。下記「LIST-1 を使う前のチェックリスト」を参照。

| # | 名前 | タイトルの書き方 | 向いている話 |
|---|------|--------------|------------|
| LIST-1 | 標準コンテンツ（箇条書き）⚠️ 多用注意 | 「〇〇は、〇〇できます」の言い切り | **他テンプレで表現できない 1 トピックの深掘り**。多用すると単調になるので章内 2 連続禁止 |
| COMPARE-1 | これまで／これから（リッチ・3 行） | 「〇〇が、〇〇に変わります」 | 変化・対比・ビフォーアフター。1 行ごとに補足や背景説明を添えたい時 |
| LIST-2 | 3 カラム | 「〇〇の 3 つの〇〇」 | 3 つの特徴・行動指針 |
| LIST-3 | カードグリッド | 「〇〇の 6 つの〇〇」 | プロダクト一覧（4-6 個）|
| LIST-8 | 詳細カード | 「〇〇は、〇〇でできています」 | 1 プロダクト／ツールを深く |
| LIST-4 | カード型コンテンツ（縦 3 カード積み） | 「結論：〇〇。でも〇〇」等の 3 本柱主張 | **3 並列要素の第一候補**。番号 + 色帯 + カード背景で「3 本柱」が視覚的に立ち上がる |
| COMPARE-2 | これまで／これから（コンパクト・2 列 × 6 行） | 「〇 つの観点で、現場が〇〇に変わる」 | 観点を多く・浅く並べて差分の網羅性を見せたい時。各行 1 行テキスト |

### LIST-1 を使う前のチェックリスト

LIST-1 は「箇条書き 3 ブレット」というシンプルな見た目ゆえに乱用されがち。
選ぶ前に以下を必ず確認：

| 表現したい内容 | LIST-1 ではなく → | 何が良くなる |
|---|---|---|
| **3 つの並列要素 / 結論を 3 本柱で** | **LIST-4**（縦 3 カード積み） | 番号 + 色帯 + カード背景で「3 本柱」が視覚的に立ち上がる |
| **1 要素を深掘りしたい** | **LIST-8**（詳細カード） | 1 カードに集中、深堀感が出る |
| **4〜6 要素を並列に網羅** | **LIST-5**（2×2 タイル）/ **LIST-6**（3×2 タイル）/ **LIST-3**（カードグリッド） | グリッド配置で密度感を変える |
| **3 つの対比軸** | **LIST-2**（3 カラム） | 縦 3 列で対比構造を明示 |
| **Before / After の差分** | **COMPARE-1** / **COMPARE-2** | 比較構造を明示 |
| **多観点（6 つ）の差分網羅** | **COMPARE-2**（コンパクト B/A） | 縦密度を上げて景色全体の変化量を体感 |
| **章扉直後の見取り図** | **FRAMING-2**（B/A リスト）/ **DIAGRAM-4**（章挿絵）/ DIAG-06 タイムライン | 一覧→詳細モデルが効く |

**LIST-1 を使ってよい数少ないケース**:
- 上記すべてに該当しない、本当に「3 つの説明的ポイント」が必要な時
- 章内で他テンプレと交互配置できる時（連続禁止 SecQA-09）
- 1 つのデッキ内で **多くても全 50 枚中 3〜5 枚程度** を上限の目安にする

**LIST-1 vs LIST-4 の選び方**
- **LIST-1**: 行頭パープルドット + ゆったり 3 ブレット。**説明のための情報提示** に強いが、ぱっと見の印象が弱い
- **LIST-4**: 太い番号 + 色付き縦帯 + カード背景で囲む。**結論の印象付け** に強い。ぱっと見で「3 つのことが並列で大事」が立ち上がるため、まとめ・結論・原則提示に向く
- **デフォルト**: 3 並列要素は **まず LIST-4 を検討**。説明文が長すぎて LIST-4 のカードに収まらない時のみ LIST-1 を検討

**COMPARE-1 vs COMPARE-2 の選び方**
- **COMPARE-1**: 番号 + 項目名 + 補足テキスト + これまで／これから の 3 カラム × 3 行。**1 行ごとに具体的な背景説明を添えたい** 時。ピッチや提案書で「なぜこの差分が重要か」まで読ませたいケース
- **COMPARE-2**: これまで／これから の 2 列 × 6 行コンパクト。**観点の網羅性** を見せたい時。1 行テキストに絞ることで縦密度を上げ、6 つ並べて景色全体の変化量を体感させる
- 同じデッキで両方使うのも OK。導入部で COMPARE-2 で網羅感を出し、後段で COMPARE-1 で重要 3 観点を深掘りする、のリズムが自然

---

## カテゴリ C：PROJECT — 提案書・計画書向け

| # | 名前 | タイトルの書き方 | 向いている内容 |
|---|------|--------------|-------------|
| DATA-1 | 項目-値テーブル | 「〇〇を、一枚で」 | 目的・期間・予算などの定型 |
| PROJECT-1 | フェーズフロー | 原則や進め方を表す一言 | プロジェクトの 3-4 フェーズ |
| PROJECT-2 | スケジュール（3 トラック） | 「〇月中の〇〇を目標に」 | ガントチャート（3 行・説明文あり） |
| DATA-2 | データテーブル | 「〇〇の責任範囲」等 | スコープ表・体制表・比較 |
| DATA-3 | 数字 + グラフ | 「〇〇の〇〇％は〇〇」 | 予算内訳・構成比 |
| PROJECT-3 | スケジュール（5 トラック） | 「〇〇に向けた〇〇ロードマップ」 | 実務用ガントチャート。3-5 ロールの計画書 |
| PROJECT-4 | スケジュール（2 層トラック） | 「複数〇〇の並行〇〇ロードマップ」 | 親カテゴリ（アプリ A / B など）配下に子トラック（設計/開発/テスト）を入れる二層ガント。マイルストーン bar も差せる |

**PROJECT-2 vs PROJECT-3 vs PROJECT-4 の選び方**
- **PROJECT-2**: 3 トラック・サブコピーあり・行高さゆったり → 読み手に丁寧に説明したいとき
- **PROJECT-3**: 5 トラック・サブコピーなし・slim 行高さ → 実務計画書、情報量を詰めたいとき（単一プロダクト）
- **PROJECT-4**: 2 層構造（親 = プロダクト/チーム、子 = 設計/開発/テスト等）→ 複数プロダクト・複数チームの並行スケジュールを 1 枚で見せたいとき。マイルストーン pill が差せるのでリリース日の合意取りに強い

---

## カテゴリ D：PITCH — ピッチ資料

| # | 名前 | タイトルの書き方 | 向いている内容 |
|---|------|--------------|-------------|
| VISUAL-1 | プロフィール | 「本プロジェクトを担当する〇〇をご紹介」 | 自己紹介・チーム紹介 |
| VISUAL-2 | エビデンス + 結論 | 「〇〇が、〇〇を阻んでいる」等の主張 | 市場・社会課題の提示 |

---

## カテゴリ E：TILES — 要素の列挙

要素数で使い分けるタイル系。文字量で選ぶ：

| # | 名前 | 要素数 | 各タイルの本文字数目安 |
|---|------|------|--------------------|
| LIST-5 | タイル 2×2 | 4 | 50〜80 字（ゆったり）|
| LIST-6 | タイル 3×2 | 6 | 30〜60 字（中）|
| LIST-7 | タイル 3×3 | 9 | 1〜2 行（コンパクト）|

**選び方**: 本文が 80 字超 → 2×2、50 字前後 → 3×2、短い単語 → 3×3

---

## カテゴリ F：VISUAL — ビジュアル主体

| # | 名前 | タイトルの書き方 | 向いている内容 |
|---|------|--------------|-------------|
| VISUAL-3 | ビジュアル主体 | 「〇〇は、こんな〇〇です」 | プロダクト画面・図版・レポート例 |
| VISUAL-4 | イメージカード 2×2 | 「〇〇は、こんな〇〇でご利用いただけます」 | 4 つの機能/製品/事例の並列紹介 |
| VISUAL-5 | 左画像 + 右テキスト | 「実際の画面で、〜をご紹介」 | ケーススタディ、製品詳細、深掘り |
| VISUAL-6 | フルビジュアル | 感情的な引用文・スローガン | ブランドメッセージ、章扉的な使い方 |
| LIST-9 | アイコン 3 カラム | 「〇〇の 3 つの提供価値」 | サービス価値、機能の特徴説明 |

**このカテゴリの掟**:
- ビジュアル（画像・モック・図）が主役。テキストは最小限
- 同じデッキで 3 枚以上続けない（単調になる）
- 間に LIST-1 Content や LIST-5 Tile を挟んでリズムを作る
- 画像がない段階では `addImagePlaceholder` でプレースホルダー表示、後から `addImage` に差し替え
- 画像の用途例:
  - VISUAL-4: UI スクリーンショット、プロダクト画面、メンバー写真
  - VISUAL-5: 大きめのダッシュボード、フロー図、ケース詳細画像
  - VISUAL-6: ヒーロー画像、ブランド写真、大型ビジュアル
  - LIST-9: アイコン（絵文字 or SVG）

---

## カテゴリ G：ENHANCER — 他パターンに重ねるオプション

| # | 名前 | 使い方 | 向いている状況 |
|---|------|-------|-------------|
| ナビゲーション付き 自動 variant | 任意のパターンの上部にセクションチップを追加 | 章数を問わず使える（5 以下→full / 6 以上→simple に自動切替）|

**このパターンの掟**:
- 単独のパターンではなく、**他パターンのオプション機能**
- PptxGenJS では `addChromeNav(slide, sections, currentIdx)` + `addTitle(s, text, { withNav: true })` で使う
- **全スライドに付けない**。表紙・閉じ・本編の中盤は不要
- **節目（各章の冒頭スライド）だけに付ける**と効果的。プレゼン中に「今どこにいるか」がすぐ分かる

**2 variant 自動切替**:

| variant | 適用条件 | 見た目 | 用途 |
|---------|---------|------|------|
| **A: full** | `sections.length < 6` | 全セクションのチップを横並び（active が brand 塗り、他は gray100）| 章数が少なめのデッキ。章ごとの並び・進行方向を見せたい時 |
| **B: simple** | `sections.length >= 6` | 単一チップ「`[ 3 / 8  解決策 ]`」型に集約（番号 + 総数 + 現在章名）| セクションが多くてチップが窮屈なデッキ。一覧性より「今どこにいるか」を優先 |

- 切替は **`addChromeNav` 内部で自動判定**。呼び出し側のコードは変えなくてよい
- 閾値は `tokens.js` の `layout.navSimpleThreshold`（デフォルト 6）。プロジェクトごとに調整可能
- サブセクション (`addChromeWithNav` 第 4 引数) との連結は両 variant とも対応。
  simple の場合は「`[ 4 / 6 解決策 ]  ›  [サブセクション]`」、full の場合は「`[ chips... ]  ›  [サブセクション]`」

---

## カテゴリ H：DATA / REFERENCE — リサーチ・比較・出典の情報量重視

| # | 名前 | タイトルの書き方 | 向いている内容 |
|---|------|--------------|-------------|
| DATA-2 | 長尺データテーブル | 「主要な〇〇」「〇〇の一覧」 | 参考文献集、用語集、FAQ、コンプラ要件、リスク一覧 |
| COMPARE-3 | 比較表（星取り表） | 「〇〇との機能比較」「他社〇〇との違い」 | ツール比較、競合分析、機能有無、スペック比較 |
| COMPARE-4 | トレードオフスライダー | 「何を諦めるのか」「〇〇の優先順位」 | アジャイル・インセプションデッキ、制約整理、優先順位合意 |

**このカテゴリの掟**:
- **ファクトベース徹底**: 主張には必ず出典を添え、`addFootnote(s, '...')` でスライド下部に明示
- **情報量重視**: 他のテンプレと違って「一覧性」が命。密度を高めに設計
- DATA-2 は 3 列固定だが行数は可変（最大 10 行が視認性の限界）
- COMPARE-3 の評価記号は `◯` (優), `△` (一部), `×` (未) の 3 段階
- COMPARE-3 で FactHub（推しのプロダクト）は **ヘッダー背景を brand 色** にして視線誘導
- COMPARE-4 は 4 軸優先順位（スコープ/予算/納期/品質）を横長スライダーで。活性ドットに順位番号を白抜き表示

---

## カテゴリ I：DIAGRAM — 論理構造の図解

| # | 名前 | タイトルの書き方 | 向いている内容 |
|---|------|--------------|-------------|
| DIAGRAM-1 | マトリクス図（2×2） | 「〇〇を、2 軸で整理」 | ポジショニングマップ、競合分類、現状把握。1 象限に推し、他はグレーで 4 分類 |
| DIAG-02 | サイクル図（4 段階） | 「〇〇を、4 ステップで回す」 | PDCA・継続改善・反復プロセス。中央に概念ラベル、4 ノードを矢印で循環 |
| DIAGRAM-2 | フロー図（横一列） | 「〇〇は、4 ステップで〇〇」 | 導入ステップ、業務フロー、横一列のプロセス。任意の 1 つを active 強調できる |
| DIAG-05 | ピラミッド図（3 層） | 「〇〇は、3 階層で〇〇」 | 階層構造、優先度、戦略ピラミッド。下層が土台、上層が価値、の積み上げ |

**このカテゴリの掟**:
- **論理関係を「形」で見せる**のが目的。テキストだけで言うより、配置そのものに意味を持たせる
- DIAGRAM-1 / DIAG-02 / DIAG-05 は思想・戦略・概念向け。DIAGRAM-2 は実務プロセス向けで用途が違う
- DIAG-XX シリーズ（`diagram-patterns.js`）は「スライド内に挿絵として置く図」、DIAGRAM-X は「図そのものを主役にした 1 枚スライド」と棲み分ける
- 1 デッキで 2 枚以上使うときは挟みパターンを入れる（例: マトリクス → LIST-1 標準コンテンツ → サイクル）。図ばかり続くと読み手の解釈コストが跳ねる
- 各ノード/象限/ステップの説明は **30〜40 字以内** に収める。図が「読ませるテキスト」になると主従が逆転する

**DIAGRAM-1 / DIAG-02 / DIAGRAM-2 / DIAG-05 の選び方**:
- **2 軸で整理したい** → DIAGRAM-1（マトリクス）
- **循環するプロセスを見せたい** → DIAG-02（サイクル）
- **一方通行のプロセスを見せたい** → DIAGRAM-2（フロー）／ または PROJECT-1 フェーズフロー（テキスト寄り）
- **下から上への積み上げを見せたい** → DIAG-05（ピラミッド）

---

## 依頼タイプ別 推奨構成

### 🆕 新プロダクトの紹介資料（社外向け）

```
SECTION-1 表紙
   ↓ 課題に引き込む
SECTION-2 セクション扉「こんな課題、ありませんか？」
   ↓
VISUAL-2 エビデンス（市場データで共感を作る）
   ↓ 解決策を出す
SECTION-2 セクション扉「こんな風に解決します」
   ↓
VISUAL-3 ビジュアル主体（プロダクト画面を見せる）
   ↓
LIST-8 詳細カード（1 プロダクトを深く）
   ↓
COMPARE-1 これまで／これから（変化を見せる）
   ↓
SECTION-3 閉じ
```

### 🏢 社内勉強会・説明会

```
SECTION-1 表紙
SECTION-6 目次
SECTION-2 セクション扉「本日のゴール」
LIST-1 標準コンテンツ（ゴール説明）
LIST-2 3 カラム（役割分担）
LIST-8 詳細カード × N（ツール詳細）
SECTION-3 閉じ
```

### 💼 プロジェクト提案書

```
SECTION-1 表紙
VISUAL-1 プロフィール（誰がやるかを先に見せる）
DATA-1 項目-値テーブル（プロジェクト概要）
PROJECT-1 フェーズフロー（進め方）
PROJECT-2 スケジュール
DATA-2 データテーブル（スコープ）
DATA-3 数字 + グラフ（予算）
SECTION-3 閉じ
```

### 🚀 ピッチ資料（投資家 / 審査員向け）

```
SECTION-1 表紙
VISUAL-1 プロフィール
VISUAL-2 エビデンス（市場・課題）
LIST-5 タイル 2×2（4 つの強み）
VISUAL-3 ビジュアル主体（プロダクト画面）
DATA-3 数字 + グラフ（TAM など）
COMPARE-1 これまで／これから（市場変化）
SECTION-3 閉じ
```

### ⚡ ライト資料（3-5 枚で完結）

```
SECTION-1 表紙
LIST-1 標準コンテンツ（要点 1 枚）
VISUAL-3 ビジュアル主体 or COMPARE-1 これまで／これから（核となる 1 枚）
SECTION-3 閉じ
```

### 🎯 インセプションデッキ（アジャイル・プロジェクト立ち上げ）

「アジャイルサムライ」の 10 項目をカバーする構成。ステークホルダーとの初期合意用。

```
SECTION-1 表紙
SECTION-2 セクション扉（章扉）
LIST-1 標準コンテンツ    → 我々はなぜここにいるのか
VISUAL-2 エビデンス + 結論 → エレベーターピッチ（結論バナーで主張を強調）
VISUAL-6 フルビジュアル    → パッケージデザイン（雑誌広告的な 1 枚）
COMPARE-1 これまで/これから → やらないことリスト（やる / やらない の 2 カラム読み替え）
LIST-3 カードグリッド   → ご近所さんを探せ（4-6 ステークホルダー）
VISUAL-3 ヒーロービジュアル → 解決案を描く（アーキテクチャ図）
LIST-3 カードグリッド   → 夜も眠れない問題（4-6 リスク）
PROJECT-2 スケジュール     → 期間を見極める（ガントチャート）
COMPARE-4 トレードオフ     → 何を諦めるのか（4 軸優先順位）
DATA-1 項目-値テーブル  → 何がどれだけ必要か（スキル / 期間 / コスト）
SECTION-3 閉じ
```

**このレシピの掟**:
- 各項目は 1 枚完結（冗長な解説は避ける）
- 各主張には出典があれば `addFootnote` で明記
- 全体で 13-15 枚目安。10 項目すべてを網羅する場合でも 20 枚以内に収める
- 「やる / やらない」は COMPARE-1 の読み替えで十分表現可能（左=やる緑系、右=やらない灰系）

---

## 判断フロー

```
まず問う:
  ❓ このスライドで読者に伝えたい「たった 1 つ」は何か？
  ❓ その主張を支える「最低限の根拠」は何か？

主張のタイプで選ぶ:
├── 対比がある       → COMPARE-1 / LIST-5 / LIST-2 / DIAGRAM-1
│   ├── 2 つ比較        → COMPARE-1
│   ├── 3 つ並列        → LIST-2
│   ├── 4 つ並列        → LIST-5
│   └── 2 軸で 4 象限   → DIAGRAM-1
├── 並列リスト      → LIST-3 / LIST-6 / LIST-7
│   ├── 4-6 個     → LIST-3 or LIST-6
│   └── 9 個前後   → LIST-7
├── 1 つを深く     → LIST-8
├── 定型情報       → DATA-1
├── 時系列フロー   → PROJECT-1 / PROJECT-2 / DIAGRAM-2 / PROJECT-4
│   ├── 一方通行プロセス → PROJECT-1 or DIAGRAM-2（DIAGRAM-2 は図解寄り）
│   ├── 単一ガント        → PROJECT-2 or PROJECT-3
│   └── 複数並行ガント    → PROJECT-4
├── 反復プロセス   → DIAG-02（サイクル図）
├── 階層構造       → DIAG-05（ピラミッド）
├── 数字 + 構成比 → DATA-3
├── 市場・調査     → VISUAL-2
├── 図・画像を見せたい → VISUAL-3 / VISUAL-6（フル）/ VISUAL-4（4 枚並列）
├── 目次を立てたい → SECTION-6（統合目次）
├── チーム・個人紹介 → VISUAL-1
└── その他         → LIST-1（迷ったらこれ）
```

---

## 落とし穴・NG 集

- **同じパターンを 3 連発しない** — リズムが死ぬ
- **LIST-8 Detail Card を除き、連続配置を避ける** — LIST-8 は連番カタログ OK
- **セクション扉の直後に本編でない情報を置かない** — 節目は本編と接続させる
- **1 スライドに 2 つ以上の主張を入れない** — 分割するか、片方を捨てる
- **横文字 eyebrow を復活させない**
- **タイトルをスライド中段・下段に置かない** — 必ず y=0.35 付近


## カテゴリ J：FRAMING — デッキ全体の固定枠

「序盤」と「締め」を毎回フォーマット化することで、ナレッジポータルとしての一貫性
を担保する。Phase 2 設計書の段階で組み込みを必須とする。

| # | 名前 | いつ使うか |
|---|------|---------|
| FRAMING-1 | 構築背景（3 ブロック）| 表紙の直後・必須。きっかけ / 気付いたこと / 解消したい疑問の 3 ブロックで、現場発エピソードを語る |
| FRAMING-2 | Before/After リスト | 構築背景の直後・必須。設計書の「解消する疑問」項目を 4-6 行で並べる |
| FRAMING-3 | 会社紹介（受賞実績込み）| お土産の直後・必須。ENOSTECH 信頼性を補強する締めスライド |
| FRAMING-4 | お土産（知識を実戦に変える）| 末尾参考情報集の直後・必須。Skill / チートシート / プロンプト集 を 1 件深掘りで紹介し、読者を実戦に接続する |
| DIAGRAM-4 | セクション挿絵（章の見取り図）| **セクション扉(SECTION-2/4/5) の直後の見取り図候補の 1 つ**。章番号 + 大ビジュアル + 一言キャプション。世界観・関係性を 1 枚絵で示せる章で採用。並列要素 4 件以上の章はリスト系（FRAMING-2 / LIST-4 / LIST-7）の方が認知負荷低い。媒体選定は StructureQA-12（`references/deck-structures/learning-deck.md` §StructQA-12） |
| DATA-5 | 用語集（条件付き必須）| 末尾参考情報集 (DATA-4) の直後・お土産 (FRAMING-4) の前。「用語 / 読み / 説明」3 列。**用語が 3 件以上ある時のみ配置**（0-2 件の場合は省略可） |

**序盤の固定枠（最初の 4 枚）**:
```
S1: SECTION-1（表紙）
S2: FRAMING-1（構築背景）   ← 現場エピソード必須
S3: FRAMING-2（B/A リスト）  ← 設計書の解消する疑問を反映
S4: SECTION-6（統合目次・章 + 概要 + サブセクション一覧）
```

**章扉の直後フォーマット（全章共通）**:
```
S?:    SECTION-2 / SECTION-4 / SECTION-5（セクション扉）
S?+1:  「見取り図」スライド  ← 必須・例外なし、媒体は章の中身で選ぶ
       ・並列要素 4 件以上 → FRAMING-2 / LIST-4 / LIST-7（リスト系）
       ・世界観・関係性を 1 枚絵で示せる → DIAGRAM-4（挿絵）
       ・時系列・段階性が骨格 → DIAG-06（タイムライン）
       ・判定が割れる時 → DIAGRAM-4 デフォルト
```

媒体選定の最終判定は **StructureQA-12** で実行する
（`references/deck-structures/learning-deck.md` §StructQA-12）。
詳細は `phase2-information-design/README.md` の R2-8 を参照。

**締めの固定枠（最後の 3 〜 4 枚）**:
```
S(n-3): DATA-4（参考情報集 / SR）
S(n-2): DATA-5（用語集）            ← 用語 3 件以上ある時のみ・条件付き必須
S(n-1): FRAMING-4（お土産・知識を実戦に変える）  ← Skill / チートシート / プロンプト集を 1 件深掘り
S(n):   FRAMING-3（会社紹介）
```

詳細は `SKILL.md` の絶対ルール 35-36, 38 を参照。


---

## Category J: CHART

| # | 名前 | 一言で |
|---|------|-------|
| CHART-A1 | チャート単体 | 1 枚にチャートだけを大きく見せる |
| CHART-A2 | 左チャート + 右テキスト 3 観点 | チャート + 読み取り 3 つを並置 |
| CHART-A3 | 上チャート + 下 3 カラム (Why/So What/Now What) | コンサル流の論理構造 |
| CHART-A4 | 2 チャート並列 (上下 or 左右) | 推移と構成、自社と競合の対比 |

> ⚠️ チャート種別 (BAR-COL, LINE, WATERFALL ...) はテンプレと独立に管理。
> JSON で `chart: { template_id: "CHART-XX", ... }` を指定する。
> 詳細は `chart-patterns.md` 参照。

### CHART-XX 早見表

```
推移/比較     棒(縦/横/積み上げ) / 折れ線 / 棒+線複合 / ウォーターフォール
                CHART-01 / 02 / 03 / 04 / 05 / 06
構成比         ドーナツ                           CHART-07
関係           散布図 / レーダー                  CHART-08 / 09
```


---

## Category K: DECISION ⭐ 最重要

「**意思決定の自動化**」を絵で見せるための専用カテゴリ。FlowChart は学習デッキの
持ち帰り感を最大化する最強の表現で、特別扱いする。

| # | 名前 | 一言で | 使う場面 |
|---|------|-------|---------|
| DIAGRAM-3 | **FlowChart 専用 / フルブリード** | グレー背景フレームと章扉ヘッダーを撤去し、SCENE-06 を縦 4.8" 全面表示 | 意思決定の判定木、業務フロー、トリアージロジック、与信判定、課税判定 |

### DIAGRAM-3 の構造

通常スライドのクローム要素のうち **左サイド色帯 / ナビ chip / フッター** だけを
残し、本文領域を最大化する FlowChart 特化テンプレ。

| 領域 | 配置 | 内容 |
|------|------|------|
| 上端 (任意) | y=0.55, h=0.34 | タイトル (16pt 太字) — 「課税対象の判定フロー（消費税）」等 |
| 中央 | y=0.51〜5.18 | SCENE-06 描画領域 (フルブリード、約 4.67" 高) |
| 下端 (任意) | footerY 直上 | キャプション (左アンバーバー + 12pt 太字) — 「全 NO クリアで〜に着地する」等 |

### JSON サンプル

```json
{
  "template_id": "DIAGRAM-3",
  "title": "課税対象の判定フロー（消費税）",
  "caption": "全 NO クリアで「課税取引」に着地する",
  "diagram": {
    "template_id": "SCENE-06",
    "layout": "vertical-decision",
    "start": { "label": "事業者が対価を得て行った取引" },
    "steps": [
      { "kind": "decision", "label": "資産の譲渡", "yes_to": "next", "no_to": { "side": 0 } },
      { "kind": "decision", "label": "国内取引",   "yes_to": "next", "no_to": { "side": 0 } },
      { "kind": "decision", "label": "非課税取引", "yes_to": { "side": 1 }, "no_to": "next" },
      { "kind": "decision", "label": "輸出免税等", "yes_to": { "side": 2 }, "no_to": "end" }
    ],
    "side_results": [
      { "label": "課税の対象外（不課税取引）" },
      { "label": "非課税取引" },
      { "label": "輸出免税等取引" }
    ],
    "end": { "label": "課税取引", "kind": "success" }
  }
}
```

`diagram.layout` は `vertical-decision` / `horizontal-flow` / `simple-vertical`
の 3 種類。詳細は `references/_common/scene-patterns.md` の SCENE-06 セクション。

### 設計原則: 「意思決定が絡むテーマでは必ず 1 枚以上」

学習デッキの究極の目的は「現場で読者が正しい意思決定をできるようになる」こと。
判断ロジックを箇条書きで列挙するより、FlowChart で絵にした方が圧倒的に
記憶に残り、現場で再利用される。

このため:

- **StructureQA-21 で「FlowChart 1 枚以上」を fatal 強制**
  (Template 定義: `scripts/render/deck-structures/learning-deck.js` の `globalConstraints.requiredTags`、
  解説: `references/deck-structures/learning-deck.md` §StructQA-21)
- 意思決定が複雑なら 2 枚 / 3 枚と増やしてよい (1 スライド = 1 意思決定木)
- 「明らかに意思決定要素が無い」テーマ (例: 単なる事例紹介・統計報告) なら
  `doc.decision_focused: false` で warn 扱いに緩和できる

### DIAGRAM-3 を使うか DIAGRAM-4 を使うか

| ケース | 使うテンプレ |
|------|------|
| 章のメイン主張が FlowChart そのもの | **DIAGRAM-3** (フルブリード) |
| 章扉直後に「章の見取り図」として絵を 1 枚 | **DIAGRAM-4** (見取り図テンプレ + diagram に SCENE-06 を渡す) |
| 判断ノードが 6 個以上 / side_results が 4 個以上 | **必ず DIAGRAM-3** (DIAGRAM-4 では領域が狭すぎる) |

DIAGRAM-4 で SCENE-06 を呼ぶのは「ライト版・章の予告」として OK だが、メインの
意思決定木を見せるならフルブリードの DIAGRAM-3 が原則。

---

## Category L: CHAPTER WRAP

「**章末で読者の頭の中を整理する小道具**」のためのカテゴリ。学習デッキの定着率を
押し上げる仕組みで、章を読み終えた瞬間に「いま読んだ章の輪郭」を読者に返す。

| # | 名前 | 一言で | 使う場面 |
|---|------|-------|---------|
| FRAMING-5 | **章末まとめ「N 章のポイント」** | 左チェックリスト (3〜8 件 auto-fit) + 右 MINDSET カード | 学習デッキの各章末。要点 ☑ と一段抽象化した「考え方」をセットで渡す |

### FRAMING-5 の構造

| 領域 | 内容 |
|------|------|
| ナビ chip | メイン = 章名、サブ = `subsection` (= 「章末まとめ」固定推奨) |
| **タイトル** | **「N 章のポイント」固定** (N は本編章番号、テンプレ側で自動採番) — plan.json 側で書かなくて良い |
| サブコピー | 章の核心 1〜2 行。**ですます調必須** (WritingQA-14) |
| 左カラム | チェックリスト (□ + ラベル)、**3〜8 件で柔軟** |
| 右カラム | MINDSET カード: eyebrow + 強い見出し + 補足 (・並列) — **`mindset.title` は ですます調必須** |
| 下部 | フッター注釈 (`footnote`、optional) |

### items の auto-fit

件数が増えてもオーバーフローしないよう、render 側で 3 段階に自動調整:

| 件数 | 行高 | フォント | チェックボックス |
|------|------|---------|------------------|
| 3 件 | ~0.75-0.80" | 12pt | 0.22-0.24" |
| 4-5 件 | ~0.55-0.65" | 11-11.5pt | 0.18-0.21" |
| 6-8 件 | ~0.40-0.50" | 10-11pt | 0.16-0.18" |

長文 (60 字超 / 80 字超 / 100 字超) は段階的に -0.5pt ずつ縮小、最小 9.5pt まで。

**8 件超**: schema (Zod max:8) で **fatal**。「章末まとめは要点を 3-8 件に絞る」運用。
9 件以上を渡すと build 時にエラー。

### タイトル自動採番のしくみ

build-deck.js が章リスト (header / body.chapters / footer) を normalize する時、
`_v9_role: 'chapter'` の章だけを 1 始まりでカウントし、ctx に
`bodyChapterNumMap[section_id] = N` を構築する。テンプレは
`atoms.getBodyChapterNum(ctx, slideJson.section_id)` で N を引いて
「N 章のポイント」を生成する。`_header` / `_footer` は body chapter にカウントされない。

### JSON サンプル

```json
{
  "id": "S10",
  "template_id": "FRAMING-5",
  "section_id": "ch1-overview",
  "subsection": "章末まとめ",
  "subtitle": "ベアフットは『ほぼ裸足』を 4 寸法で再現する靴のジャンルです。その中にも 4 系統あり、Born to Run 以降の 17 年でブーム→揺り戻し→使い分けの 3 段階を経てきました。",
  "items": [
    "4 つの構造差 — ソール厚 3-8mm / ドロップ 0mm / 広トゥボックス / 高フレキシビリティで裸足を再現",
    "4 系統に分かれる — 5 趾分離 (Vibram) / 封筒型 (Vivo, Xero) / ガイド型 (Lems) / wide toe (Altra)",
    "歴史は 17 年で 2 周 — Born to Run ブーム → 集団訴訟と怪我報告で冷却 → 現在は道具として使い分け"
  ],
  "mindset": {
    "eyebrow": "MINDSET",
    "title":   "『ベアフット = 1 種類』ではありません。再現度と用途の組合せで 4 系統に分かれる靴のジャンル、と一段抽象化して理解しましょう。",
    "points":  ["4 構造差", "4 系統", "17 年史"]
  }
}
```

ポイント:
- **`title` は書かない** (テンプレが「N 章のポイント」を自動生成する)
- `subtitle` と `mindset.title` は ですます調 (WritingQA-14 / WritingQA-19)
- `items` は 3-8 件
- `points` は 3-5 件 (短く、・ で並列)

### 設計原則: 学習デッキの章末は FRAMING-5 を 1 枚必ず

`doc.deck_structure == "learning-deck"` のデッキでは各章末 (body.tail[0]) に FRAMING-5 を 1 枚。**StructureQA-13** で強制 (各章 tail に FRAMING-5 が無いと fatal)。詳細は
`references/deck-structures/learning-deck.md` §StructQA-13、
`references/qa/schema-qa.md` の SchemaQA-14。

learning-deck Template 以外 (`proposal-deck` / `internal-report` 等) または
Template 未指定では不要 (= 検査スキップ)。任意位置に置けば描画はされる。

### items 件数の運用

**3〜8 件で柔軟**にしつつ、

- **3 件**: 章の骨を最も鋭く。最も記憶に残る (Magic Number 3 の知見は健在)。
- **4-5 件**: 章の論点が 4 つ以上ある時 (例: 効果 / リスク / 確度 / 判断軸を全部入れたい)。
- **6-8 件**: 例外。固有名や手順が多い章のみ。

迷ったら **3 件に削る** のが第一選択。「8 件まで入る」=「8 件入れていい」ではない。
件数を増やすと auto-fit でフォントが小さくなり、記憶に残りにくくなる。

---

## VISUAL-7 リファレンス画像補足

> Category: H (DATA / REFERENCE)
> 役割: `doc.references[].image.enabled=true` のリファレンスに対して、
> 出典の図表をそのまま 1 枚見せる「出典補足ページ」。

### いつ使うか

本文で文章でしか触れていないが、出典先の図表が論点理解に決定的なときに使う。
典型例:

- 製品のアーキテクチャ図 (NTTデータの分析エージェント実装事例など)
- 公開された統計のグラフ (調査レポートの本文で参照したチャート)
- 比較表 / 数値表の出典イメージ
- フローチャート (出典側のオリジナル図)

### 自動配置

build-deck.js が `doc.references[].image.enabled === true` を検出すると:

1. `image.source_url` から画像を DL → `decks/{slug}/assets/images/{hash}.{ext}` に保存
2. `ref.cited_by[0]` または raw_text_runs から本文初引用スライドを推定
3. **そのスライドの直後に VISUAL-7 を自動挿入** (引用スライド = VISUAL-7 が連続)

ユーザーが手で plan に VISUAL-7 を書いた場合は自動挿入されない (重複検知)。

### JSON 期待構造

`doc.references[]` 側 (推奨経路):

```json
{
  "doc": {
    "references": [
      {
        "num": 3,
        "category": "事例",
        "title": "NTTデータ、データ分析 AI エージェント実装事例",
        "url": "https://example.com/article",
        "source": "NTTデータ Tech Blog",
        "year": 2026,
        "cited_by": ["S5"],
        "image": {
          "enabled": true,
          "source_url": "https://example.com/arch-diagram.png",
          "caption": "分析エージェント・アーキテクチャ図",
          "rationale": "本文では文章でしか触れていない 3 層構成を、出典の図でそのまま見せたい",
          "license_note": "記事ページに掲載された自社作成図。引用範囲で利用"
        }
      }
    ]
  }
}
```

VISUAL-7 スライド側 (build 時に自動生成、手書きも可):

```json
{
  "id": "S5-imgRef3",
  "template_id": "VISUAL-7",
  "ref_num": 3,
  "title": "(3) NTTデータ、データ分析 AI エージェント実装事例",
  "subtitle": "分析エージェント・アーキテクチャ図。本文では文章でしか触れていない 3 層構成を、出典の図でそのまま見せたい",
  "image_path": "assets/images/abc123def456.png",
  "source": "NTTデータ Tech Blog",
  "source_url": "https://example.com/article",
  "year": 2026,
  "fetch_status": "ok"
}
```

**フィールド役割**:

| 項目 | 値 | 由来 |
|---|---|---|
| `title` | `(N) ref.title` 形式 | build-deck.js が組み立て (ref.num + ref.title) |
| `subtitle` | 画像の要約・伝えたい内容 | `caption` + `rationale` を結合 (両方ある時は「。」で連結) |
| 画像配置 | アスペクト比保持で配置領域内最大化 | `image-size` で原寸取得 → 中央寄せ |
| 出典行 | `出典: {source} ({year})` 1 行のみ | source_url があればハイパーリンク |

`license_note` は `_sources.json` (DL メタデータ) には記録されるが、スライド本体には
表示されない。

### 検証ルール (SchemaQA-15)

- `image.enabled === true` なら `source_url` 必須 (URL 形式) + `num` 必須 → fatal
- `image.caption` または `ref.title` のどちらかが空なら → warn
- `image.rationale` 空 → warn (運用上の判断材料を残してほしい)

### 設計原則: 出典クレジットは必ず画像直下に

VISUAL-7 は出典クレジット行 (出典: …) を画像直下に**必ず**表示する。
これは「引用」の要件 (出所明示・改変禁止・主従関係) を構造で担保するため。
license_note を `image.license_note` で添えるとさらに安全。


## Category Q: QA ⭐ QA 駆動モード専用

「**読者が事前に持っている疑問・懸念のリストを早見表として最初に渡す**」ためのカテゴリ。
QA 駆動モード (`doc.qa_driven: true`) のときだけ使う特殊枠で、序盤の固定枠 (header[]) の
**5 枚目** (SECTION-6 目次の直後) に挿入する。

| # | 名前 | 一言で | 使う場面 |
|---|------|-------|---------|
| QA-INDEX | **解決したい疑問・懸念の早見表** | 縦長表 (Q番号 + 疑問・懸念 + 答え + 該当章) | qa_driven=true の全デッキ。読者が「自分の疑問の答えがどこにあるか」を最初に把握する |

### QA-INDEX の構造

| 領域 | 内容 |
|------|------|
| ナビ chip | メイン = 章名 (intro / overview 等)、サブ = `subsection` (= 「疑問・懸念リスト」推奨) |
| タイトル | 「解決したい疑問・懸念」 (default、`title` で上書き可) |
| サブコピー | 「このデッキを読み終えると、N つの疑問が解消されます」(default、`subtitle` で上書き可) |
| 表 (4 列) | [Q番号 (0.6") / 疑問・懸念 (4.0") / 答え (3.5") / 該当章 (1.1")] |
| ヘッダー行 | ink 背景 + 白文字 + アンバー強調罫 (1.5pt) で下に区切り |
| データ行 | zebra striping (奇数行 gray50)、行下罫 0.25pt gray200 |

### Q 件数の auto-fit

| Q 件数 | 本文 fontSize | ヘッダ fontSize |
|--------|--------------|----------------|
| 2-5 件 | 12pt | 11pt |
| 6-8 件 | 11pt | 11pt |
| 9-12 件 | 10pt | 10pt |
| 13-15 件 | 9pt | 10pt |

**16 件以上**: StructQA-50 fatal。「2 デッキに分割推奨」の修正提案が出る。

### 該当章ラベルの導出ロジック

`Q.sectionIndex[0]` から正規表現で章番号を抽出:

| 入力 | 出力 |
|------|------|
| `body.ch2` | `2 章` |
| `chapter-3` | `3 章` |
| `ch.5` | `5 章` |
| その他 (id 名等) | そのまま (12 字超は省略) |
| 空 / undefined | `—` |

`questions_overrides[]` で個別に `sectionLabel` を上書きすることも可能 (例: 「前段階」「応用」のような文字ラベル)。

### JSON サンプル

```json
{
  "id": "S5",
  "template_id": "QA-INDEX",
  "section_id": "intro",
  "subsection": "疑問・懸念リスト"
}
```

questions 自体は `doc.questions[]` 側に書く (テンプレ内で重複定義しない):

```json
{
  "doc": {
    "qa_driven": true,
    "questions": [
      {
        "id": "Q1",
        "text": "電子工作の抵抗ってどう選べばいいの?",
        "kind": "how_to",
        "provisionalDirection": "LED の場合は順電圧と電源電圧の差を電流で割ります。",
        "shortSummary": "電源電圧 - LED Vf を電流で割る",
        "sectionIndex": ["body.ch2"]
      }
    ]
  }
}
```

### 関連する StructQA ルール

QA-INDEX 単体ではなく、QA 駆動モード全体で機械強制される 7 ルール:

- StructQA-50 (fatal): questions[] 件数 2-15
- StructQA-51 (fatal): 各 Q に id / text / kind / provisionalDirection 必須
- StructQA-52 (fatal): phase2_locked=true で shortSummary + sectionIndex 必須
- StructQA-53 (fatal): slide.answers_questions が doc.questions と整合
- StructQA-54 (fatal): 全 Q に紐付く slide が >=1 件 (孤立 Q ゼロ)
- StructQA-55 (warn): 全 body 章に紐付く Q が >=1 件 (孤立章)
- StructQA-56 (fatal): header[] に QA-INDEX が 1 枚必須
