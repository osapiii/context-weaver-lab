> 入口は `references/_common/workflow.md` の Phase 3 セクション。
> 本 README は Phase 3 専属ファイルと _common/ 系へのナビ。

承認済み Phase 2 JSON を `scripts/render/build-deck.js` に渡すだけで PPTX が出力される。
テンプレ群は `scripts/render/templates/` 配下の純粋関数として整理済みで、
**Phase 3 で書くコードはほぼゼロ**。

```bash
DECK_DIR="decks/<yyyy-mm-dd>_<slug>"
node scripts/render/build-deck.js -i "${DECK_DIR}/plan.json" -o "${DECK_DIR}/draft/draft.pptx" --theme=mono
```

JSON 構造は `references/phase2-information-design/deck-instruction-schema.md` の通り。
`slides[].template_id` ごとに `scripts/render/templates/` 配下の純粋関数がディスパッチされ、
FREE-1 は `shapes[]` 配列で自由レイアウトを構築する。

## このフェーズの絶対ルール

### R3-3 生成スクリプト末尾で `fix-hyperlink-color.py` を必ず呼ぶ

インライン参照番号 (1)(12) の青文字ハイパーリンクは、PptxGenJS が自動挿入する
`<ahyp:hlinkClr val="tx"/>` 拡張要素の影響で PowerPoint 表示時に黒で塗りつぶされる。
`scripts/fix-hyperlink-color.py <pptx>` を生成スクリプト末尾で呼んで当該拡張要素を剥がす。
`scripts/render/build-deck.js` と `build-deck-package.js` には組み込み済み。冪等。

## デッキ構成ルール (序盤・締めの固定枠)

すべてのデッキは、序盤 4 枚 + 締め 2 枚を固定で持つ。ナレッジポータルとしての
一貫性を担保する運用ルール。Phase 2 設計書の段階で組み込みを必須とする。

> plan.json の `header[]` / `body.chapters[]` / `footer[]` フィールドで構造を
> 明示分離し、**StructureQA-01 / StructureQA-02 で fatal 検査**する。Template
> 定義は `scripts/render/deck-structures/learning-deck.js`、検査ロジックは
> `scripts/render/lib/structure-qa.js`。詳細は
> `references/deck-structures/learning-deck.md` と
> `references/phase2-information-design/plan-json-v9-structure.md`。

```
[序盤・必須の 4 枚]
  S1: SECTION-1 表紙
  S2: FRAMING-1 構築背景         ← 現場エピソード (業種・規模・人物・数値) を必ず埋める
  S3: FRAMING-2 Before/After     ← 設計書の「解消する疑問」を 4-6 行に整形
  S4: SECTION-6 統合目次

[本編・自由構成]
  S5...

[締め・必須の 2 枚]
  S(n-1): DATA-4 参考情報集 (SR)
  S(n):   FRAMING-3 会社紹介 (受賞実績込み)
```

**FRAMING-1 構築背景**: 3 ブロック構成 (きっかけ / 気付いたこと / 解消したい疑問)。
それぞれ実際の業種・規模・担当者の固有名詞・具体的な数値で埋める。
「事業会社ではよくある」のような抽象表現は禁止。

**FRAMING-2 Before/After リスト**: Phase 2 設計書の `解消する疑問` 項目を抽出して
4-6 行に整形する。各行は「Before (読者の現状の疑問) → After (読み終えた後の状態)」。
COMPARE-1 (リッチ 3 行) / COMPARE-2 (コンパクト 6 観点) とは用途が違う。

**FRAMING-3 会社紹介**: 受賞実績 2 件 + 主要プロダクト + 代表者情報 + 連絡先 URL。
受賞実績はデフォルト値を埋め込んであるが、デッキごとに最新版に手で差し替える前提。
`enostech.co.jp` の Awards / 受賞歴セクションを都度確認して反映する。

## Phase 3 で参照する _common/ 系

- `_common/parallel-execution.md` — 参照ファイルを 1 回の bash でまとめて読む手法
- `_common/pptx-patterns.md` — PptxGenJS のコード片
- `_common/token-rendering-guide.md` — トークン × PptxGenJS の仕組み
- `_common/slide-patterns.md` / `_common/diagram-patterns.md` — テンプレ選定の最終確認

## 出口

`decks/{slug}/draft/draft.pptx` を出力 → Phase 4 (ユーザー QA) へ。
ファイル名は `draft.pptx` に統一 (承認後 Phase 4 で `資料.pptx` に昇格)。
