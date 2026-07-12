---
name: enostech-slides
description: "ENOSTECH 公式ブランド (Vivid Purple #9212F3 × Light Magenta #E365FF / Noto Sans JP) 準拠の PowerPoint 資料を PptxGenJS で生成するスキル。日本語メイン・横文字禁止・1 スライド = 1 メッセージ、Before→After 設計から始める 4 ステップ。スライドパターン + チャート + ダイアグラムを Phase ベースで組み立てる。トリガー: ENOSTECH 資料、会社資料、社内スライド、ブランド資料、ピッチ資料、説明会、FactHub / Qlavis / EN AIstudio / TSUTAWARU / 成長バトン / データ基盤キャラバン。`--bypass` で対話最小化 (テンプレベース固定)。新規デッキ立ち上げ時に Phase 0 でテンプレベース / フリーベースの 2 択を提示。詳細は CHANGELOG.md。"
---

# ENOSTECH Slides Skill

ENOSTECH 公式ブランドに準拠した PowerPoint 資料を `PptxGenJS` で生成するスキル。

依頼が来たら、まず下の「🧭 モード分岐」でモード A / B / C を判定し、該当する `references/` を読んでから着手する。スキルの真の価値はパターン集ではなく、**読者起点の設計プロセス** にある。

---

## 🧭 モード分岐（毎回、必ず最初に判定する）

依頼を 3 つのモードに振り分ける。判定を誤ると後の全手順が噛み合わない。

### A. デッキ構築モード — ユーザーの「作りたいデッキ」に関する依頼

**対象**: `decks/` 配下の .pptx そのもの（新規生成、既存修正、派生コンテンツ）

**典型フレーズ**: 「資料を作って」「提案書を作成して」「S5 を 3 カラムに」「これをブログにして」

**進め方**: 下の「A. デッキ構築モードの 3 サブフロー」へ

### B. デザイン更新モード — スキル自体のデザイン資産を変える依頼

**対象**: `assets/tokens.js` / `themes.js` / `logos/` / `scripts/render/templates/*.js` / `scripts/render/diagrams/*.js` / `references/_common/*.md`

**典型フレーズ**: 「brand カラーを変えたい」「LIST-1 のマージン狭く」「新しい DIAG を追加」

**進め方**: `references/alt-modes/design-update-mode.md` を必読 → 5 ステップ

```
1. スコープ把握 → 2. ソース編集 → 3. ビジュアルチェック (PNG 化)
→ 4. ユーザー承認 → 5. CATALOG 自動更新
```

デザイン更新は全デッキに波及するため、承認なしで commit しない。

### C. deckStructure 追加モード — 新しい構造定義をスキルに足す依頼

**対象**: `scripts/render/deck-structures/` + `references/deck-structures/`

**典型フレーズ**: 「`proposal-deck` 以外に `internal-report` も作りたい」「事例紹介用の deckStructure 追加」

**進め方**: `references/alt-modes/deckstructure-add-mode.md` を必読 → 6 ステップ

```
1. 候補比較 (親承認) → 2. 仕様書作成 → 3. Zod 実装
→ 4. registry 登録 → 5. 動作確認 → 6. ドキュメント反映
```

### 判断に迷ったら

| 依頼例 | モード |
|-------|-------|
| 「FactHub の紹介資料作って」 | A（新規デッキ） |
| 「S8 の文言を直して」 | A（既存デッキ更新） |
| 「この .pptx の LIST-8 だけ角丸小さく」 | A（該当デッキのみ） |
| 「LIST-8 のカード枠角丸を小さく」 | **B**（slideTemplate 実装 → 全デッキ波及） |
| 「brand カラー変更」 | **B**（トークン → 全デッキ波及） |
| 「`internal-report` deckStructure 追加」 | **C** |
| 「`learning-deck` の章数上限変更」 | **C**（既存 deckStructure 改変） |

判断の核: 単発デッキ → **A** / slideTemplate or テーマ改変 → **B** / deckStructure 追加・変更 → **C**

---

## ⚡ バイパスモード判定（モード A にだけ適用）

ユーザーのプロンプトに `--bypass` が含まれているかをモード A 突入時にチェック。

- 含まれる → `references/_common/bypass-mode.md` を必読
- 通常の 4 フェーズはそのまま完走、「ユーザー承認待ち」ステップだけ省略
- 必須 4 項目（読者・目的・分量・テーマ）が揃っていない時は 1 回だけまとめて質問
- 判定は大文字小文字を区別しない（`--BYPASS` でも発動）
- モード B / C には bypass を適用しない（全デッキ波及のため）

> ⚠️ bypass = 確認スキップであって工程の独自定義ではない（R-BYPASS-3）。処理内容は `workflow.md` 側が唯一の正。

---

## 📚 References インデックス

詳細ナビは `references/README.md`（モード別の読み順 + シーン別ファイル対応表）。

| シーン | 起点ファイル |
|-------|------------|
| 新規デッキ依頼 | `references/_common/workflow.md` |
| スキル自体のデザイン更新 | `references/alt-modes/design-update-mode.md` |
| deckStructure 追加 | `references/alt-modes/deckstructure-add-mode.md` |
| 既存デッキの修正 | `references/alt-modes/maintenance-guide.md` |
| 派生コンテンツ (ブログ等) | `references/alt-modes/secondary-production.md` |
| `--bypass` 検出 | `references/_common/bypass-mode.md` |

**核心**: ファイルを一斉に読まない。モードと Phase を見て、今必要な 1〜2 個だけ読む。

---

## A. デッキ構築モードの 3 サブフロー

### 🆕 新規デッキ依頼 → `references/_common/workflow.md`

4 フェーズ + Phase 1.8 で進行する。

```
Phase 1    ヒアリング + decks/ ディレクトリ先切り
           目的・読者・Before→After 確認、questions[] 5-8 件をユーザー承認
             ↓
Phase 1.8  braindump 執筆
           questions への解答集を decks/{slug}/braindump.md に散文で書く
           = Phase 2 の SSOT (Single Source of Truth)
             ↓
Phase 2    情報設計 + draft 自動ビルド
           HTML 指示書を plan.html に直書き、run-qa.py phase2 で
           機械検証 → draft.pptx → PNG → plan.html にプレビュー埋込
             ↓ (ユーザー承認後)
Phase 3    デッキ構築
           承認済み指示書を忠実に PPTX 化
             ↓
Phase 4    ユーザー QA + decks/ 最終整形
           run-qa.py phase4 で VQA 自己目視 → 承認時に
           build-deck-package.js を機械実行（資料.pptx / プレビュー / レポート.html /
           ナレーション台本.md / スライドQA.csv まで一気通貫）
```

**Phase 2 を始める前の必読 3 ファイル**:

1. `scripts/render/schemas/` — テンプレ別 Zod スキーマ正本。plan.json を書く時の期待フィールド
2. `references/phase2-information-design/deck-instruction-schema.md` — MUST ルール (M1〜M7) と doc / sections / reviews の正本スキーマ
3. `references/qa/schema-qa.md` — Phase 2 完了直前の機械検証 fatal 条件

**deckStructure を指定する場合は Phase 2 冒頭で必須実行**:

```bash
node scripts/render/print-deck-structure.js learning-deck
```

→ header / body.chapters / footer の必須テンプレ並びと StructureQA ルールが Markdown で出力される。

### 🔧 既存物の更新依頼 → `references/alt-modes/maintenance-guide.md`

変更規模で分岐:

- 🟢 **小変更**（文言・数値・トーン切替・要素追加 1 つ等）→ 即座に str_replace で適用
- 🟡 **大変更**（複数要素再配置・共通ヘルパー編集・テンプレ変更等）→ 更新指示書を `plan.html` に追記、ユーザー承認後に変更

判断基準は `maintenance-guide.md` の「2 段階の判断」セクション参照。

### 🔄 追加派生コンテンツ → `references/alt-modes/secondary-production.md`

PPTX を起点にしたテキスト系の派生出力:

- 📝 ブログ変換（Zenn / Note / Qiita 対応）
- 📣 共有メッセージ（Slack 簡潔版 + メール丁寧版）

### 共通の原則

- **ファクトベース徹底**: 主張には必ずソースを添える
- **トークン経由で色・サイズを扱う**: ハードコード hex 禁止
- **共通ヘルパー・クローム要素は所定の API 経由でのみ使う**: トークン値の直接書換禁止

---

## 設計原則

### 1. 1 スライド = 1 メッセージ
各スライドは「読者をどこへ連れて行きたいか」を明確にしてから構成を組む。

### 2. タイトル + サブコピー = 罫線 + 平文型
全スライド共通の 2 階層構造:

```
[オプション: 黒ラベル eyebrow]

スライドの主張（タイトル, 20pt bold）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
↑ Amber 太罫線 (左 0.55") + 灰色細罫線 (右側全幅)

その理由・補足・なぜ・どうやって
（サブコピー, 11pt 平文 灰色, 1〜3 行）
```

ヘルパー: `addTitleBlock(slide, title, sub, opts?) → bottomY`

**サブコピーの方針**: 120〜200 字推奨、最大 250 字まで許容。短すぎず・長すぎず・分かりやすく。
含める要素（3〜4 つを意識）: ① 具体（数値・固有名・業種規模）/ ② 「なぜ」「どうやって」/ ③ 読後の変化 / ④ 逆接・対比。

**例外**: 表紙・閉じ・セクション扉・ビジュアル主体スライド。

### 3. コンテンツエリアは下端まで詰める
タイトルブロック下端 → コンテンツ開始 gap 0.10" のみ。コンテンツ下端 5.15"。空白を恐れず展開する。

### 4. 横文字を使わない
- ❌ `Product Detail` / `Feature 01` / `Agenda` / `Our Values` / `Point 1`
- ✅ 全て日本語: 「目次」「①」「これまで／これから」「課題／効果」

### 5. マージン 0.4" 統一

### 6. ナビゲーションは標準装備
本編スライドは上部ナビチップを持つのがデフォルト。省略は表紙・目次・セクション扉・閉じ・ビジュアル主体のみ。
ナビ chip 文字列は `sections[].name` の単一ソース（R-DESIGN-13 / SecQA-10）。1 章 = 1 名前を物理的に強制。

### 7. 左サイドの薄紫ストライプ
幅 0.12" の左端帯。`addChromeLeftStrip(s)` で挿入。

### 8. 背景はオフホワイト `#FAFAF7`
真っ白より目に優しい。`setCanvasBg(s)` で設定。

### 9. タイトルは上寄り・コンパクト
- ナビありタイトル: 20pt bold、y=0.58
- ナビありサブコピー: 11pt 太字、y=0.96 起点で 1〜4 行の動的高さ
- ナビなし（例外）: タイトル y=0.32、コンテンツ y=1.05

### 10. フォントは Noto Sans JP 統一
`fontFace: "Noto Sans JP"` を毎回指定。

### 11. アクセントカラーの 3 色構造
- **Brand** = Amber `#F59E0B` 主役（温かみのある琥珀）
- **Accent** = Burnt Amber `#B45309` 並列対比
- **Highlight** = Slate 800 `#1F2937` スパイス（少面積）

### 12. 意思決定が絡むテーマでは FlowChart を必ず 1 枚以上
判断ロジックを箇条書きで列挙するより、FlowChart で絵にする方が圧倒的に記憶に残り、現場で再利用される。
DIAGRAM-3 + SCENE-06 (vertical-decision) を最低 1 枚配置。**StructureQA-21 で fatal 強制**（learning-deck）。
オプトアウトは `doc.decision_focused: false`。

### 13. 図解は SVG (enostech-svg-diagram) がデフォルト
優先順位 (上から先に検討):

```
① SVG (enostech-svg-diagram skill)          ← default
② shape 自由 (atoms-shape)                   編集可能性が必要な時のみ
③ SCENE / DIAG                               既存テンプレに完全一致時のみ
④ チャート (CHART-01〜09)                    定量データのみ
⑤ データテーブル (DATA-2 / DATA-4 / DATA-5)  最後の砦
```

SVG は `svg` / `svg_file` フィールドで slide JSON に渡せば build-deck.js が自動で PNG 化する。
詳細は `references/_common/scene-patterns.md` の R-FIG-PRIORITY。

---

## 🔴 絶対ルール

全 Phase 横断・最頻参照の核ルール。Phase 別の追加ルールは下の早見表参照。

| # | ルール | 詳細 |
|---|--------|------|
| C-1 | **横文字を使わない**。eyebrow / 英字装飾ラベルは禁止。例外は固有名詞・技術用語・単位 | `_common/brand-tokens.md` §3 |
| C-2 | **フォントは Noto Sans JP**。全テキスト・全スライドで指定 | `_common/brand-tokens.md` §5 |
| C-3 | **1 スライド = 1 メッセージ**。「説明したいことを全部詰める」は最悪のアンチパターン | `_common/brand-tokens.md` §1 |
| C-4 | **タイトル + サブコピーの 2 階層構造を厳守**。例外は表紙・閉じ・章扉・ビジュアル主体のみ | `_common/brand-tokens.md` §2 |
| C-5 | **色は必ず `tokens.js` から取る**。ハードコード hex 禁止 | `_common/brand-tokens.md` §6 |
| C-6 | **図解は SVG (enostech-svg-diagram) がデフォルト** (R-FIG-PRIORITY)。優先順位は `SVG → shape 自由 → SCENE/DIAG → チャート → テーブル` | `_common/scene-patterns.md` / `enostech-svg-diagram/SKILL.md` |
| C-7 | **図解 G1-G4 を守る**。G1: 平易な言葉 / G2: シンプルな見た目（雲・有機形・キャラ禁止）/ G3: 3 ステップ作成 / G4: 70-25-5 色比 | `_common/brand-tokens.md` |
| C-8 | **意思決定テーマには FlowChart 1 枚以上必須**。DIAGRAM-3 + SCENE-06 を最低 1 枚配置。StructureQA-21 で fatal | `deck-structures/learning-deck.md` §StructQA-21 |
| C-9 | **学習デッキの各章末に FRAMING-5「N 章のポイント」を 1 枚必ず置く**。タイトル固定文言（テンプレが N を自動採番）、items 3-8 件、mindset はですます調必須。StructureQA-13 で fatal | `deck-structures/learning-deck.md` §StructQA-13 |
| C-10 | **日本語テキストは ja-writing スキルの 4 原則 + CHECKLIST で必ず検査**。翻訳調・てにをは・比喩・AI 風表現を排除 | `_common/japanese-writing.md` |
| C-11 | **ハブ&スポーク図 (SCENE-02) は 1 デッキ最大 1 枚** (R-FIG-HUB)。並列を見せたいなら LIST-3 / LIST-2 / DIAGRAM-1 を優先。StructureQA-22 で fatal | `_common/scene-patterns.md` G-SCENE-5 |
| C-12 | **CHART テンプレは説明 annotation + データラベル + 強調系列 brand カラー**。`annotations[]` でチャート上に説明を重ね、強調以外の系列は ink で抑える | `_common/chart-patterns.md` |
| C-13 | **タイトル + サブコピーは「ですます調」統一**。subtitle がある時は両方ですます調、体言止めは subtitle が無いスライドのみ許容。WritingQA-13 / 14 で fatal | `qa/writing-qa.md` |
| C-14 | **SVG / SECSUMMARY-1 のテキストカード背景に brand amber 系の塗り fill を使うことを禁止**。amber は stroke / 文字色 / 細帯 / 小アイコン fill でのみ使う | `_common/scene-patterns.md` R-FIG-PRIORITY |
| C-15 | **SVG が必要なテンプレは enostech-svg-diagram skill で逐次作成。Python 量産禁止 + placeholder 提案禁止**。1 枚書く → SchemaQA pass → 出来栄え確認 → 次の 1 枚 | `enostech-svg-diagram/SKILL.md` |
| C-16 | **FRAMING-3 (会社紹介) はフィールド省略でデフォルト ENOSTECH 情報を使う**。`awards: []` / `products: []` / 不完全 corp を明示的に渡さない | `templates/framing.js` |
| C-17 | **learning-deck では VISUAL 系から先に選び、Card/Text 系は情報が薄い時の最後の手段**。StructQA-70 (VISUAL 比率 < 50% fatal) / 71 (同一テンプレ > 40% fatal) / 72 (Card/Text 3 連続 fatal) | `phase2-information-design/README.md §R2-16` |
| C-18 | **自己判断によるスキップ・省略・短縮の禁止**。Phase 1〜4 の全工程・全 Step を明示完走。「省略しますか？」とユーザーに選択肢提示すること自体も禁止。opt-out は plan.json の明示フィールドのみ | `_common/no-self-skip.md` |
| C-19 | **スライド単位 QA CSV (`スライドQA.csv`) の生成義務 + 全 ✅/🔺 fatal ガード**。10 列固定、空欄行が残れば build-deck-package.js が fatal 停止 | `scripts/build-slide-qa-csv.py` |
| C-20 | **braindump.json が SSOT (v12 〜)**。`braindump.md` は `braindump-to-md.py` が JSON から生成する read-only view、手編集禁止。Phase 1.8 完了ゲートは `braindump-json-validate.py --strict` (BSQA-J01〜J13 + Zod) + `writing-qa.py --mode braindump --strict` の 2 ゲート fatal。v11.2 デッキは `migrate-v11.2-to-v12.py --write` で移行 | `qa/braindump-qa.md` |

### Phase 別ルール早見表

| 移管先 | ルール | 何のためのルールか |
|-------|--------|------------------|
| `phase1-hearing/README.md` | R1-1 / R1-2 / R1-4〜R1-6 / **R1-9** / **R1-11** | Before→After 確認、ユーザー固有のこだわり、decks 先切り、カラースキーマ判定、`doc.deck_type` 推論、**questions[] 提示・ユーザー承認 (R1-9)**、**Phase 1 で章立て・枚数・テンプレを先出し禁止 (R1-11)** |
| `phase1-hearing/braindump.md` | **R1-10** | Phase 1.8 braindump 執筆（questions への解答集を散文で書き下ろし、Phase 2 の SSOT） |
| `phase2-information-design/README.md` | R2-1〜R2-13 / R2-15 / **R2-16** | HTML 指示書、テンプレプレビュー、3 階層情報構造、サブコピー作法、MUST-M1〜M7、序盤 4 枚固定枠、章扉直後の見取り図必須、FlowChart 必須、ハブ&スポーク上限、**VISUAL 優先選択フロー (R2-16)** |
| `phase3-build/README.md` | R3-1〜R3-4 | speaker notes ナレーション台本化、hyperlink color fix、図解 G1-G4 厳守 |
| `phase4-qa/README.md` | R4-1〜R4-5 | 自己目視 QA、Phase 4 を飛ばさない、build-deck-package.js 機械実行、自己判断スキップ禁止、スライド QA CSV 必須 |
| `qa/schema-qa.md` | SchemaQA-01〜15 | テンプレ単位 / デッキ全体の構造ルール（Zod schema + validateDeckGlobal） |
| `qa/structure-qa.md` / `deck-structures/*.md` | StructureQA-01〜72 | デッキ全体の構造（header / body / footer + 章繰り返し + 見取り図 + 章末まとめ + FlowChart + HubSpoke + テンプレ多様性） |
| `qa/writing-qa.md` | WritingQA-01〜30 | 日本語規範違反の機械検出（翻訳調・ハイプ語・助詞 4 連・体言止め羅列・横文字侵入・箱型比喩 / ですます調強制） |
| `qa/slide-qa.md` | SQA-01〜12 | ページ単位の規約検査（サブコピー説明力・タイトル整合・横文字侵入） |
| `qa/sections-qa.md` | SecQA-01〜11 | 章単位の構造検査 |
| `qa/reference-qa.md` | RefQA-01〜13 | 引用情報専用の構造検査 |
| `qa/visual-qa.md` | VQA-01〜25 | 最終ビジュアル検査（コンタクトシート目視 + 部分目視） |
| `_common/bypass-mode.md` | R-BYPASS-1〜3 | バイパスモード判定、自動修正リトライ上限、独自 Phase 定義禁止 |
| `_common/brand-tokens.md` §8 | R-DESIGN-01〜13 | デザイン規約全般（トークン、hex 形式、タイトル位置、ロゴ配置、`(N)` 引用自動青文字化など） |

ルール ID の命名: `R{Phase}-{連番}` は「いつ守るか」軸、`C-N` は全 Phase 横断核ルール。

---

## ⚡ ツールコール削減

`references/_common/parallel-execution.md` を必ず参照。バイパス・通常問わず適用。

| フェーズ | 逐次（❌） | 並行（✅） |
|---------|----------|----------|
| Phase 2 プレビュー取得 | `get-template-preview.py X` × N 回 | `--json` フラグで全テンプレ 1 コマンド |
| Phase 3 参照ファイル読み | view × 4-6 回 | `bash cat 全ファイル` で 1 コール |
| Phase 4 PNG 目視 | 1 枚ずつ view | コンタクトシート → 問題スライドのみ個別 |

三原則:
1. Phase 2 プレビュー取得は必ず `--json` フラグ
2. Phase 3 参照ファイルは確定してから 1 回の bash でまとめて読む
3. Phase 4 はコンタクトシートから始める（1 枚ずつ `view` しない）

---

## ディレクトリ構成

```
enostech-slides/
├── SKILL.md                    ← このファイル（入口）
├── CHANGELOG.md                ← バージョン別変更履歴
├── assets/
│   ├── tokens.js               ← テーマ対応トークン + diagramPalette
│   ├── themes.js               ← カラーテーマ定義
│   ├── fonts/                  ← Noto Sans JP 同梱 (OFL 1.1)
│   ├── logos/                  ← 公式ロゴ
│   └── template-previews/      ← テンプレのプレビュー画像 (JPEG)
├── references/
│   ├── README.md               ← いつ何を読むかインデックス
│   ├── _common/                ← Phase をまたぐ知識資産
│   │   ├── workflow.md
│   │   ├── parallel-execution.md
│   │   ├── bypass-mode.md
│   │   ├── brand-tokens.md
│   │   ├── design-system.md
│   │   ├── slide-patterns.md
│   │   ├── chart-patterns.md
│   │   ├── scene-patterns.md
│   │   ├── diagram-patterns.md
│   │   ├── pptx-patterns.md
│   │   ├── japanese-writing.md
│   │   └── no-self-skip.md
│   ├── phase1-hearing/         ← Phase 1 + 1.8 入口
│   ├── phase2-information-design/
│   ├── phase3-build/
│   ├── phase4-qa/
│   ├── qa/                     ← QA 体系
│   │   ├── schema-qa.md
│   │   ├── structure-qa.md
│   │   ├── writing-qa.md
│   │   ├── slide-qa.md
│   │   ├── sections-qa.md
│   │   ├── reference-qa.md
│   │   └── visual-qa.md
│   ├── deck-structures/        ← 用途別 deckStructure 仕様
│   └── alt-modes/              ← デッキ構築以外のフロー
│       ├── design-update-mode.md
│       ├── deckstructure-add-mode.md
│       ├── maintenance-guide.md
│       └── secondary-production.md
├── scripts/
│   ├── render/                 ← 純粋関数によるレンダリング層
│   │   ├── atoms.js
│   │   ├── atoms-shape.js
│   │   ├── templates/          ← Template 層（カテゴリ単位集約）
│   │   ├── diagrams/
│   │   ├── charts/
│   │   ├── scenes/
│   │   ├── schemas/            ← Zod スキーマ正本
│   │   ├── deck-structures/    ← deckStructure 定義 (Zod)
│   │   ├── lib/                ← 共通ライブラリ
│   │   ├── build-deck.js       ← Deck 層エントリポイント
│   │   ├── build-catalog.js
│   │   ├── build-html-report.js
│   │   └── print-deck-structure.js
│   ├── build-deck-package.js   ← Phase 4 末尾の decks/ 機械整形
│   ├── build-narration.py      ← speaker notes → ナレーション台本.md
│   ├── build-slide-qa-csv.py   ← スライド単位 QA CSV 生成
│   ├── run-qa.py               ← QA オーケストレータ（Phase 2/4 入口）
│   ├── writing-qa.py
│   ├── braindump-illust.py     ← Phase 1.8 SVG → PNG → visual_path 更新 (v12: JSON 入力)
│   ├── braindump-json-validate.py ← BSQA-J01..J13 + Zod schema (v12 SSOT 検証)
│   ├── braindump-to-md.py       ← braindump.json → braindump.md view 生成 (v12, idempotent)
│   ├── migrate-v11.2-to-v12.py  ← v11.2 → v12 マイグレータ
│   ├── braindump-to-plan.py    ← braindump.md → plan.json 下地
│   └── pptx-to-images.sh
└── .user_reference/            ⚠️ Claude は読まない (人間用)
    └── CATALOG.html            ← 全デザイン要素の自動生成カタログ
```

> 🖼 デザイン全体を目視確認したいときは `CATALOG.html` をブラウザで開く。
> 全 slideTemplate + diagram + scene + chart + theme + token + logo を 1 ページで俯瞰できる。
> 再生成: `node scripts/generate-catalog.js`

> ⚠️ `_team-reference/` と `.user_reference/` フォルダは Claude が読む対象ではない（人間用の確認資料置き場）。

---

## カラー設計 — 3 色構造

3 色構造 + ink + ニュートラルグレー。色を変えたい時は `palette.yml` で上書きする。

```javascript
const T = require('../assets/tokens');
const C = T.color;
// C.brand     = #F59E0B (Amber 500)         — 主役
// C.accent    = #B45309 (Amber 700 / Burnt) — 並列対比
// C.highlight = #1F2937 (Slate 800)         — 黒側スパイス
// C.ink       = #1F2937 (slate-800)         — 本文・濃い面
// C.canvas    = #FAFAF7 (off-white)         — ページ背景
```

各色は `Soft` / `Deep` / `Contrast` の 4 階調を持つ（例: `C.brandSoft` / `C.brandDeep` / `C.brandContrast`）。

### palette.yml SSOT

色情報の真実は `decks/{slug}/palette.yml` にあり、pptx と plan.html の両方を駆動する。

```bash
# palette.yml が存在 → そのまま読む
node build-deck.js -i plan.json -o out.pptx

# palette.yml を再生成 (DESIGN.md を更新した時など)
node build-deck.js -i plan.json -o out.pptx --regenerate-palette
```

palette.yml はユーザーが手編集できる:

```yaml
colors:
  brand: "F09000"
  accent: "E4B268"
  highlight: "13D6EC"
  ink: "595960"
  canvas: "FFFFFF"
typography:
  fontFace: "メイリオ"
  body: 12
```

### DESIGN.md からの自動生成

クライアントから渡されたブランドガイドや既存デザインシステム（Tailwind / IBM Carbon / Zenn / 食べログ等）を **`DESIGN.md`** に置けば、build-deck.js が自動でパースして palette.yml を作る。

サポート形式:
1. **構造化トークン形式** — `# Design Tokens` + `## Colors` + `- brand: "#xxx"`
2. **自然文型 9 セクション仕様書** — `## 2. Color Palette & Roles` 配下の `**ラベル** (`#xxx`): 説明`

詳細は `references/_common/brand-tokens.md`「外部 design.md 参照」セクション。

### 色の面積比

```
白 (背景)          ~70%
黒 (本文・見出し)  ~20%
グレー (補助)       ~7%
アクセント         ~3%
```

---

## 3 層のデザイン構造

ENOSTECH のデザインは 3 階層で整理されている:

```
Atoms（トークン）→ 表現パターン → ページテンプレート → デッキ
```

- **Atoms** (`tokens.js` + `themes.js`): 色・サイズ・余白の原子値
- **表現パターン** (`references/_common/design-system.md`): 番号バッジ / チップ / タイルカード等の再利用視覚要素
- **ページテンプレート** (`scripts/render/templates/*.js`): 表現パターンの組み合わせ

ダイアグラムも同じ 3 層構造（スライドとは独立に動く）:

```
Atoms (tokens.js の diagramPalette + diagramSize)
  → 表現パターン (diagram-expression-patterns.md)
  → ページテンプレート (scripts/render/diagrams/*.js)
```

スライドテンプレートの中にダイアグラムテンプレートを埋め込む、という使い方。

---

## スライドパターン一覧 (v11.6 — 全 81 テンプレ)

カテゴリ別の詳細・選定ガイドは `references/_common/slide-patterns.md` を参照。各カテゴリの代表例:

| カテゴリ | 役割 | 主要テンプレ |
|---------|------|------------|
| **SECTION** | 表紙・章扉・目次・閉じ | SECTION-1A/B/D/F/G（表紙バリアント）/ SECTION-2/4/5（章扉）/ SECTION-3（閉じ）/ SECTION-6（統合目次）/ **SECTION-7（サブセクション扉 v11.6）** |
| **LIST** | 並列要素の整理 | LIST-1（標準）/ LIST-2（3 カラム）/ LIST-3（カードグリッド）/ LIST-4（card-stack）/ LIST-5〜7（タイル）/ LIST-8（詳細カード）/ LIST-9（アイコン 3 カラム）/ **LIST-10（縦長アジェンダ v11.6 / 進捗状態チップ付き 5-8 件）** |
| **COMPARE** | 対比・比較 | COMPARE-1（before-after rich）/ COMPARE-2（compact）/ COMPARE-3（icon table）/ COMPARE-4（トレードオフスライダー）/ COMPARE-5/6（詳細比較）/ **COMPARE-7（Pros/Cons 3 選択肢並列 v11.6）** |
| **DATA** | 数値・テーブル・参考資料 | DATA-1（項目-値）/ DATA-2（データテーブル）/ DATA-3（数字+グラフ）/ DATA-4（references）/ DATA-5（用語集）/ LONGTEXT-1（引用パラグラフ）/ **DATA-7（タイムスタンプログ v11.6）** |
| **PROJECT** | フェーズ・スケジュール | PROJECT-1（phase-flow）/ PROJECT-2（schedule）/ PROJECT-3（5track）/ PROJECT-4（2tier）|
| **DIAGRAM** | 関係図・フロー | DIAGRAM-1（2x2）/ DIAGRAM-2（flow）/ DIAGRAM-3（FlowChart 専用）/ **DIAGRAM-5（サイクル PDCA v11.5）** / **DIAGRAM-6（ピラミッド v11.5）** / **DIAGRAM-7（ステップアップ v11.5）** |
| **CHART** | 定量データ可視化 | CHART-A1（単体）/ CHART-A2（左チャート+右テキスト）/ CHART-A3（上下）/ CHART-A4（並列）|
| **VISUAL** | ビジュアル主体 | VISUAL-1（profile）/ VISUAL-2（evidence）/ VISUAL-3（Q 章 SVG 自動展開）/ VISUAL-4〜12 |
| **WEBPAGE** | Web 記事・引用 | WEBPAGE-1（単独 URL）/ WEBPAGE-2（カードグリッド）/ WEBPAGE-3（詳細）/ WEBPAGE-4（論点比較）|
| **FRAMING** | 序盤・締めの固定枠 | FRAMING-1（構築背景）/ FRAMING-2（Before/After リスト）/ FRAMING-3（会社紹介）/ FRAMING-4（お土産）/ FRAMING-5（章末まとめ）/ **FRAMING-6（Goal/Non-Goal 期待値整理 v11.6）** |
| **SECSUMMARY** | 章見取り図 | SECSUMMARY-1（章扉直後の主役ビジュアル SVG 一発）|
| **QA-INDEX** | Q&A 早見表 | QA-INDEX（序盤 5 枚目固定枠）|
| **CODE** | コードカード | CODE-1〜7 |
| **FREE** | 自由形式 | FREE-1（SVG 受け皿）|

### v11.x 新規追加テンプレ詳細 (Phase γ で追加)

| 新 ID | 用途 | 期待 JSON 主要フィールド |
|---|---|---|
| **DIAGRAM-5** (v11.5) | サイクル図 (PDCA 型 4 ノード) | `nodes: [{pos: 'tl'\|'tr'\|'br'\|'bl', label, sub?, body?, color?}]` × 4 |
| **DIAGRAM-6** (v11.5) | ピラミッド図 (階層 3 層推奨) | `layers: [{label, body?}]` × 2-5 |
| **DIAGRAM-7** (v11.5) | ステップアップ図 (成長 3-5 段) | `steps: [{label, body?}]` × 3-5 |
| **LIST-10** (v11.6) | 縦長アジェンダ + 進捗状態 | `items: [{n?, head, body?, status?: 'todo'\|'doing'\|'done'}]` × 5-8 |
| **COMPARE-7** (v11.6) | 3 選択肢 Pros/Cons 並列 | `options: [{title, pros: [], cons: []}]` × 3-4 |
| **SECTION-7** (v11.6) | サブセクション扉 (3.1 等) | `number, title, subtitle?, parent_title?` |
| **FRAMING-6** (v11.6) | Goal/Non-Goal 期待値整理 | `goals: []` × 2-5, `non_goals: []` × 2-5 |
| **DATA-7** (v11.6) | タイムスタンプログ + severity | `entries: [{time, event, detail?, severity?}]` × 2-10 |

---

## ダイアグラムパターン一覧

スライド内に描く「図」のカタログ。マッキンゼー / BCG 品質を意識した落ち着いたデザインで、**淡色フィル + 濃色文字** を基本とする。実装は `scripts/render/diagrams/*.js`。

| # | 名前 | 向いている話 |
|---|------|------------|
| 02 | サイクル図 | PDCA 等 4 要素の循環 |
| 03 | ステップアップ図 | 段階的成熟度・成長ロードマップ |
| 04 | Before / After 比較 | 導入前後の差分 |
| 05 | ピラミッド図 | 階層構造・重要度 |
| 06 | タイムライン | プロジェクト計画 |
| 08 | 2×2 マトリクス | 4 象限カテゴリ分類 |
| 09 | 2軸プロット | 競合ポジショニング・技術選定 |

選び方は `references/_common/diagram-patterns.md`。各パターンの原子要素仕様は `references/_common/diagram-expression-patterns.md`。

**ダイアグラム描画時の原則**:
- 色は `tokens.js` の `diagramPalette` から取る（6 トラック × 3 階調）
- 1 スライド 2-3 色まで絞る。6 トラック全部は使わない
- プロット図等には必ず `INSIGHT` コールアウトを添え、絵だけで終わらせない

---

## チャートパターン一覧

定量データの可視化部品。CHART-A1〜A4 スライドテンプレと組み合わせて使う。

| # | 名前 | 向いている話 |
|---|------|------------|
| 01 | 縦棒 | 期間の量比較・売上推移 |
| 02 | 積み上げ縦棒 | 構成比の推移・顧客構成 |
| 03 | 横棒 | 長いラベル・ランキング |
| 04 | 折れ線 | 連続的トレンド・月次推移 |
| 05 | 棒+線複合 | 額と率を同時に |
| 06 | ウォーターフォール | 起点 → 増減 → 着地 |
| 07 | ドーナツ | 1 時点の構成比・シェア |
| 08 | 散布図 | 2 変量の関係・ポジショニング |
| 09 | レーダー | 多軸スコア比較 |

選び方は `references/_common/chart-patterns.md`。実装は `scripts/render/charts/*.js`。

---

## シーンパターン一覧

shape 原子要素を組み合わせて、章固有の関係図や挿絵を描く層。DIAG / CHART で届かない自由な挿絵に。

| # | 名前 | 使い場面 |
|---|------|---------|
| 01 | 3者関係図 | 中央 + 左右 2 者の構図（翻訳・仲介・通訳）|
| 02 ⚠️ 1 デッキ 1 枚 | ハブ&スポーク | 中央が周辺を「束ねる/指揮する/変換する」役割の時のみ |
| 03 | ステージ遷移 | 進捗・成熟度の現在位置 |
| 04 | ビジネスモデル図 | 中央プラットフォーム + 3-4 アクター + money/service/data フロー |
| 05 | システム構成図 | 横一列のノード（ブラウザ → API → DB 等）|
| 06 | フローチャート | 判定木・トリアージ・課税判定・与信判定・業務フロー（DIAGRAM-3 と組み合わせ）|

shape Atom（`scripts/render/atoms-shape.js`）は基礎 + ビジネスモデル + システム構成 + FlowChart の 30 関数。
選び方とカスタム手順は `references/_common/scene-patterns.md`。

---

## 4 フェーズ使い方サマリー

| Phase | やること | 出口 |
|-------|---------|-----|
| **1 ヒアリング + decks 先切り** | Before→After / 読者 / 材料を集める → 叩き台 questions[] 5-8 件提示 → 各 Q に provisionalDirection を 1-2 文 → ユーザー承認 → slug 即決して `decks/yyyy-mm-dd_{slug}/` を mkdir。**章立て・スライド枚数・具体テンプレ ID を AI から先出しすることは禁止（R1-11）** | Phase 1.8 へ |
| **1.8 braindump 執筆** | questions[] への解答集を `decks/{slug}/braindump.json` (v12 SSOT, `$schema: "braindump-v12"`) として書く。`braindump.md` は `braindump-to-md.py` が生成する read-only view (手編集禁止)。**`braindump-json-validate.py --strict` (BSQA-J01〜J13 + Zod) + `writing-qa.py --mode braindump --strict` (WritingQA-24〜30) の 2 ゲートで fatal ガード** | Phase 2 へ |
| **2 情報設計 + draft 自動ビルド** | v12 では `braindump-to-plan.py` が deck_structure 骨格 (header / body.chapters / footer の必須テンプレ枠) を pre-populate 済み。HTML 指示書を `decks/{slug}/plan.html` にファイル直書き。`python3 scripts/run-qa.py phase2 --plan decks/{slug}/plan.json --apply-manual` 一発で機械検証 → draft.pptx → PNG → plan.html にプレビュー埋込 → 手動 QA まで一気通貫 | Phase 3 へ |
| **3 デッキ昇格** | Phase 2 で固めた指示書をベースに、必要なら `node scripts/render/build-deck.js -i ... -o ...` で再ビルド | Phase 4 へ |
| **4 ユーザー QA + decks/ 最終整形** | `python3 scripts/run-qa.py phase4 --plan decks/{slug}/plan.json` で PNG + コンタクトシート + VQA セルフレポート → VQA-01〜25 埋めて `--apply-manual` → 問題提示 → 明示承認 → 承認時に `build-deck-package.js` を機械実行 | 完了 |

---

## 参考

- `enostech_vi_guidelines_20260308.pdf`（公式 VI）
- `https://enostech.co.jp/`（トーン参照元）
- `CHANGELOG.md` — スキルの変更履歴
