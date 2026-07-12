# References インデックス

> SKILL.md だけで動く設計ではなく、**必要になった時点で該当 reference を読む** のが基本。
> 一斉に全部読まないこと。**今のモードと Phase に応じた 1〜2 ファイルだけ** 読む。

---

## 構造

```
references/
├── _common/                      ← Phase をまたぐ知識資産（複数 Phase で参照）
├── phase1-hearing/               ← Phase 1: ヒアリング + braindump
├── phase2-information-design/    ← Phase 2: 情報設計（HTML 指示書）
├── phase3-build/                 ← Phase 3: デッキ構築（PptxGenJS）
├── phase4-qa/                    ← Phase 4: ユーザー QA + decks/ 昇格
├── deck-structures/              ← deckStructure 仕様書 (learning-deck / news-summary 等)
├── qa/                           ← QA レイヤ別仕様 (structure-qa.md 等)
└── alt-modes/                    ← デッキ新規構築フロー以外のサブフロー (Mode B / Mode C / 既存更新 / 派生)
```

各 Phase ディレクトリの `README.md` がそのフェーズの入口。
最初に読むなら `_common/workflow.md`（全 Phase の俯瞰）。

---

## モード別の読み順

### モード A: デッキ構築（新規）

```
1. _common/workflow.md            — 全 Phase の俯瞰
2. _common/parallel-execution.md  — Phase 2/3/4 でツールコールを削減する三原則
3. （--bypass の時のみ）_common/bypass-mode.md
4. 各 Phase に入る → phase{N}-*/README.md を読む
```

### モード A: 既存デッキ/テンプレの更新

```
alt-modes/maintenance-guide.md    — 変更規模で 🟢 小変更 / 🟡 大変更 を分岐
```

### モード A: 派生コンテンツ（ブログ / 共有メッセージ）

```
alt-modes/secondary-production.md — テキスト系の派生 2 パス
```

### モード B: スキル自体のデザイン更新

```
alt-modes/design-update-mode.md   — 5 ステップ運用（スコープ→編集→ビジュアルチェック→承認→CATALOG 更新）
```

### モード C: deckStructure 追加

```
alt-modes/deckstructure-add-mode.md — 6 ステップ運用（候補比較→仕様書→Zod→registry→動作確認→ドキュメント）
```

---

## いつ何を読むか（クイックリファレンス）

| シーン | 読むファイル |
|------|-------------|
| 新規デッキ依頼に入った瞬間 | `_common/workflow.md` |
| ツールコール最適化を確認 | `_common/parallel-execution.md` |
| `--bypass` を検出 | `_common/bypass-mode.md` |
| Phase 1 で braindump を書く | `phase1-hearing/braindump.md` |
| Phase 2 で HTML 指示書を書く前 | `phase2-information-design/README.md` → `deck-instruction-schema.md`（MUST ルール） |
| Phase 2 でテンプレ選定 | `_common/slide-patterns.md` / `_common/diagram-patterns.md` / `_common/scene-patterns.md` / `_common/chart-patterns.md` |
| Phase 3 で PptxGenJS を書く時 | `phase3-build/README.md` → `_common/pptx-patterns.md` / `_common/token-rendering-guide.md` |
| Phase 4 で QA する時 | `phase4-qa/visual-check.md` |
| Phase 4 で decks/ 昇格 | `phase4-qa/decks-packaging.md` |
| 色運用ルールの深い確認 | `_common/brand-tokens.md` |
| 3 層構造（Atoms→表現→ページ）を確認 | `_common/design-system.md` |
| 色トークンと PptxGenJS の繋ぎ込み | `_common/token-rendering-guide.md` |
| ダイアグラムの原子要素を組む | `_common/diagram-expression-patterns.md` |
| 日本語の最終チェック | `_common/japanese-writing.md` |
| StructureQA ルールを調べる | `qa/structure-qa.md` |
| 新 deckStructure の仕様を確認 | `deck-structures/<id>.md` |

---

## 設計思想

- **Phase ディレクトリ**: そのフェーズ専属の手順書・テンプレ・MUST ルール
- **`_common/`**: 複数フェーズで参照される知識資産（ブランド・トークン・パターンカタログ）
- **`alt-modes/`**: デッキ新規構築フロー（Phase 1-4）とは別系統のサブフロー

「いま何のフェーズか」を最初に判断し、そのディレクトリ内の README から入る運用。
