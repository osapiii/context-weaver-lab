# v12.0.0 (2026-05-12) — JSON-SSOT 正式化 + plan.json 骨格生成 + v11.x 2 ブランチマージ

## なぜ変えたか

2026-05-12 に 2 系統の v11.x 開発が並行進行していた:

- **JSON-SSOT ブランチ** (v11.2): `braindump.json` を SSOT 化、Zod schema + BSQA-J01..J12 を導入。`braindump.md` を生成物 view に降格。クリーンに着地していたが**デプロイされなかった**。
- **design-critique ブランチ** (v11.3〜v11.8): 261 findings (Critical 39 / Moderate 113 / Minor 75 / Improvement 34) の Critical/Moderate を template 単位で fix。Hex hardcoded を完全撤去。

両者は共通の v11.1 から fork してマージされていなかった。v12.0 で**両方を統合再リリース**する。

加えて、osanai 氏指摘 (2026-05-12 セッション冒頭):
> braindump も json 型決めて、それを markdown に convert する仕組みが良くないかな? braindump.json を作って、そこに対して QA も実施する。braindump.json から plan.json のプレを作るってやると、かなり安定 & 速度改善すると思う。

→ JSON-SSOT は v11.2 で着手済みなのを発見。これを v12 で正式採用 + **plan.json 骨格生成** (今回の新規価値) を追加。

## クリーン break ポリシー

v12 は v11.2 と同様にクリーン break。
- v11.2 で tombstone 化されていた旧 MD スクリプト 3 本 (`braindump-md-to-json.py` / `braindump-structure-qa.py` / `braindump-linkify.py`) を v12 .skill では完全削除
- `$schema = "braindump-v11.2"` は **deprecated**。`migrate-v11.2-to-v12.py` で `braindump-v12` に書き換える
- `deck.deck_structure` を required 化 (v11.2 では optional)。未設定の v11.2 デッキは migration で `learning-deck` をデフォルト挿入 (warn)

## 何が変わったか

### A. 新規スクリプト 1 本 + v12 化スクリプト 4 本

| ファイル | 変更 |
|---|---|
| `scripts/braindump-to-plan.py` | **deck_structure 骨格生成ロジック追加 (628 行)**。learning-deck の場合は header (SECTION-1/FRAMING-1/FRAMING-2/SECTION-6/QA-INDEX) + body.chapters (各 Q に SECTION-2/SECSUMMARY-1/content/FRAMING-5) + footer (SECTION-3/DATA-4/FRAMING-4/FRAMING-3) を自動配置。DATA-4 references は完全自動投入 |
| `scripts/render/schemas/braindump.js` | `$schema` regex を `braindump-v12` に bump。`deck.deck_structure` を required に昇格 |
| `scripts/braindump-json-validate.py` | `SCHEMA_TAG_RE` を v12 対応。**BSQA-J13 新設**: `deck.deck_structure` が deck-structures registry (learning-deck / proposal-deck / case-study-deck / decision-guide / news-summary / mypedia) に存在することを fatal で検査 |
| `scripts/braindump-to-md.py` | docstring を v12 表記に (機能変更なし) |
| `scripts/migrate-v11.2-to-v12.py` | **新規**: v11.2 braindump.json → v12 マイグレータ。`$schema` 書換 + `deck.deck_structure` デフォルト挿入 + `meta.schema_version` 書換。dry-run デフォルト、`--write` で実行 |

### B. v11.3〜v11.8 design-critique fix 取り込み

cache (plugin) ブランチから dev ブランチへファイル単位マージ:
- `scripts/render/atoms.js` — hex hardcoded → `ctx.C.link` 全撤去
- `scripts/render/atoms-shape.js` — scene atom も同様
- `scripts/render/templates/*.js` (全 13 本) — C-1〜C-12 違反 fix
- `assets/tokens.js` — `link` トークン追加
- `references/_common/*.md` — C-5 / C-12 関連ルール追記

### C. 削除したファイル (クリーン break 完遂)

| 削除ファイル | 理由 |
|---|---|
| `scripts/braindump-md-to-json.py` | migration 経路廃止 (v11.2 で tombstone 化、v12 で物理削除) |
| `scripts/braindump-structure-qa.py` | MD-based BSQA → `braindump-json-validate.py` に置換 |
| `scripts/braindump-linkify.py` | `[N]` → `[[N]](url)` は `braindump-to-md.py` 内蔵 |

## BSQA-J01..J13 (v12)

J01..J12 は v11.2 から引き継ぎ。**J13 のみ新設**。

| ID | severity | 内容 |
|---|---|---|
| BSQA-J01 | fatal | references[] が空でない |
| BSQA-J02 | fatal | questions[] が空でない + answer_short 全件 |
| BSQA-J03 | fatal | len(questions) == len(answers) |
| BSQA-J04 | fatal | answers[].visual ∈ {required, optional, none} |
| BSQA-J05 | warn  | questions[].related_refs[] が空でない |
| BSQA-J06 | fatal | visual=required の answer に visual_path 存在 + 実ファイル存在 |
| BSQA-J07 | warn  | answers[].citations_used[] が空でない |
| BSQA-J08 | fatal | citations_used[] ⊆ references[].n[] |
| BSQA-J09 | warn  | references に登録されているが本文未使用 |
| BSQA-J10 | fatal | answers[].question_id 順 = questions[].id 順 |
| BSQA-J11 | fatal | answers[].blocks[] の text 系合計字数 ≥ 800 |
| BSQA-J12 | warn  | blocks[] に table/list/visual/citations のいずれか |
| **BSQA-J13** | **fatal** | **deck.deck_structure が registry に存在** (v12 新設) |

## ワークフロー (Phase 1.8 標準, v12)

```
braindump.json (Claude が手書き, SSOT, $schema: "braindump-v12")
       ↓
braindump-json-validate.py --strict  (BSQA-J01..J13 + Zod / 構造検証)
       ↓
braindump-illust.py                  (SVG → PNG, visual_path 更新)
       ↓
braindump-to-md.py                   (json → md view 再生成, idempotent, [[N]](url) linkify)
       ↓
writing-qa.py --mode braindump       (MD view 層 backstop, 散文系チェック)
       ↓
braindump.md (人間レビュー用 view)
       ↓ ユーザー承認
       ↓
braindump-to-plan.py                 (json → plan.draft.json, v12: deck_structure 骨格生成)
       ↓
Phase 2 (plan.json 結晶化 — Claude が template_id 確定 + 本文密度を高める)
```

## e2e 動作検証 (本リリースで実施)

`/tmp/test_v12_deck/` で learning-deck の最小サンプル braindump.json を作成し、以下を確認:
- `braindump-json-validate.py --strict` → schema 0 / fatal 0 / warn 0
- `braindump-to-md.py` → 4585 char の Markdown view (References TOP + Q&A 早見表 table)
- `braindump-to-plan.py` → 4 sections (header 5 / ch1 4 / ch2 4 / footer 4 slides)、template_id pre-populate 確認 + content slide のみ null = Claude が後で詰める設計

## 既存デッキの扱い

| 状態 | v12 での扱い |
|---|---|
| v11.1 以前で `braindump.md` 手書きのみ (6 deck) | **legacy 据え置き**。`braindump.md.legacy` 保存済み。再ビルド希望なら `braindump.json` を手書き |
| v11.2 で `braindump.json` 作成済みのデッキ | `migrate-v11.2-to-v12.py --write` で自動マイグレーション |
| v11.3〜v11.8 で plan.json + pptx 完成済みデッキ | **影響なし**。braindump は再生成しない |

## 関連ドキュメント

- 設計書: `logs/2026-05-12 braindump-json-ssot-v12/DESIGN-v12.md`
- v11.2 完了レポート: `logs/2026-05-12 v11.2-braindump-json-refactor/COMPLETION-REPORT.md`

---

# v11.8.0 (2026-05-12) — Critical 完全 100% fix (取り残し追加修正)

## 何を変えたか

Critical 39 件の対応状況検証で取り残しが判明したため追加修正。Phase α 時点で
横断パターンに含まれていなかった「テンプレ実装の個別 hex」を完全撤去。

### atoms.js 内の hex hardcoded 撤去 (Phase α 漏れ)

| 行 | 関数 | 修正内容 |
|---|---|---|
| L398 | `addTitleBlock` titleHyperlink | `color: '0563C1'` → `color: ctx.C.link` |
| L639 | `expandRunsInlineRefs` 引用展開 | `color: '0563C1'` → `color: ctx.C.link` |
| L663 | `inlineRef(ctx, num, url, opts)` | `color: '0563C1'` → `color: ctx.C.link` |
| L752 | `addFootnote` LINK_COLOR 定数 | `const LINK_COLOR = '0563C1'` → `ctx.C.link` |

### F005 VISUAL-2 accentStrokeColor バグ修正

```js
// 旧 (両分岐同一バグ)
const accentStrokeColor = tone === 'brand' ? C.brand : C.brand;

// 新 (v11.8)
const accentStrokeColor = tone === 'brand' ? C.brand : C.accent;
```

### F208 PROJECT-3 / F065 LIST-6 の DRY 違反

実装の差別化は別 release で対応する旨を docstring で明示 (alias 状態の正当化)。

## 最終検証結果

全 templates/*.js の hex hardcoded:
- `'FFFFFF'`: **0 件**
- `'0563C1'`: **0 件**
- `'F0E0FF'`: **0 件**
- `'1F2937'`: **0 件**
- `'9CA3AF'`: **0 件**
- `'B91C1C'`: **0 件**

✅ **Critical 39 件 100% fix 完了**

(注: atoms.js の TWILIGHT_FORGE 配色定義 (`'FFFFFF'` 4 箇所) は SECTION-1A/FRAMING-3 専用の固定色として温存。これは C-5 違反ではなく「テーマ独立の internal style」)

---

# v11.7.0 (2026-05-12) — Phase γ 第 3 弾 + SKILL.md 更新

## 何を変えたか

### SKILL.md 更新
- スライドパターン一覧テーブルを v11.6 → v11.7 化、新規 12 件 (Phase γ 全 release 分) を追記
- 「v11.x 新規追加テンプレ詳細」セクションを追加、各新テンプレの期待 JSON 主要フィールドを明示

### 新規追加テンプレ (4 件)

| 新 ID | カテゴリ | 用途 |
|---|---|---|
| **PROJECT-5** | PROJECT | マイルストーン年表 (DIAG-06 タイムラインラッパー、3-7 イベント) |
| **PROJECT-6** | PROJECT | カンバン風 3 カラム (Todo / Doing / Done、各カラム 2-5 件) |
| **CHART-A6** | CHART | KPI ダッシュボード (4 数値カード + 前期比 + optional メイン chart) |
| **CODE-10** | CODE | Diff 表示 (各行 +/- マーカー + 緑/赤 背景、git diff 風) |

すべて smoke build OK、Zod 検証 pass、PNG コンタクトシート目視で描画確認済。

## テンプレ総数 (v11.7 完了時点)

| 旧 (v11.6) | 新 (v11.7) | 増加 |
|---|---|---|
| 81 テンプレ | **85 テンプレ** | **+4** |

カテゴリ別:
- PROJECT: 4 → **6** (+PROJECT-5/6)
- CHART: 4 → **5** (+CHART-A6)
- CODE: 7 → **8** (+CODE-10)

## 本日 (2026-05-12) のリリース履歴

| 時刻 | release | 内容 | 件数 |
|---|---|---|---|
| 11:52 | v11.3 | Phase α Critical 7 項目一括 | 101 件 |
| 12:04 | v11.4 | Phase β Moderate 機械置換 | 31 件 |
| 12:09 | v11.5 | Phase γ DIAGRAM-5/6/7 | +3 件 |
| 12:15 | v11.6 | Phase γ 第 2 弾 (LIST-10 等 5 件 + 微補正) | +6 件 |
| 12:20 | **v11.7** | Phase γ 第 3 弾 (PROJECT-5/6 + CHART-A6 + CODE-10) + SKILL.md 更新 | +4 件 |
| | | **修正合計** | **146 件** |
| | | **新規テンプレ追加** | **12 件 (73 → 85)** |

## 残課題 (Phase δ / 次回以降)

design-critique 261 findings の残:
- Moderate 残約 60 件 (構造変更: schema 強制 / 件数上限 / icon SVG 置換)
- Minor 残約 60 件 (細かい微調整)
- Improvement 残 22 件 (NEW-VISUAL-13/14/15、NEW-LIST-11/12、NEW-FRAMING-7/8、NEW-COMPARE-8/9、NEW-WEBPAGE-5/6、NEW-SECTION-8/9、NEW-CODE-8/9 等)

---

# v11.6.0 (2026-05-12) — Phase β/γ 残課題一括処理 (Final Release)

## 何を変えたか

design-critique 261 findings の残課題を一気通貫で処理。Moderate 残の charSpacing
微補正 + 新規テンプレ 5 件を追加して、Phase α/β/γ 全工程を完走。

### 機械置換 (微補正)

- charSpacing 4 → 1 / charSpacing 6 → 2 (横文字流儀の残存箇所を日本語向けに補正)
- charSpacing 1.5 → 0 (kerning 過大の最終一掃)
- '#FFFFFF' 残存 → C.white (compare.js 等)
- DATA-3 hero label charSpacing 2 → 1 (日本語ラベル前提)

### 新規追加テンプレ (5 件) — Phase γ 第 2 弾

| 新 ID | カテゴリ | 用途 |
|---|---|---|
| **LIST-10** | LIST | 縦長アジェンダ 5-8 件 (番号 + head + body + 進捗状態チップ: todo / doing / done) |
| **COMPARE-7** | COMPARE | 3 選択肢 Pros/Cons 並列 (各列に Pros 2-4 + Cons 2-4) |
| **SECTION-7** | SECTION | サブセクション扉 (本章中の小章遷移、parent_title で親章ラベル表示) |
| **FRAMING-6** | FRAMING | 期待値整理 Goal/Non-Goal (扱うこと / 扱わないこと 2 列) |
| **DATA-7** | DATA | タイムスタンプ付きログテーブル (時刻 + イベント + 詳細 + severity 色帯) |

すべて smoke build OK、Zod 検証 pass、PNG コンタクトシート目視で描画確認済。

### v11.5 → v11.6 でのテンプレ総数

| 旧 (v11.5) | 新 (v11.6) |
|---|---|
| 76 テンプレ | **81 テンプレ** (+5) |

### スライドカテゴリ別 v11.6 内訳

- SECTION: 11 → **12** (+SECTION-7)
- LIST: 9 → **10** (+LIST-10)
- COMPARE: 6 → **7** (+COMPARE-7)
- DATA: 6 → **7** (+DATA-7)
- FRAMING: 5 → **6** (+FRAMING-6)
- DIAGRAM: 4 → **7** (v11.5 で +DIAGRAM-5/6/7)
- (他カテゴリ 変更なし: VISUAL 12 / PROJECT 4 / CHART 4 / WEBPAGE 4 / CODE 7 / FREE 1 / QA 1)

## 本日 (2026-05-12) のリリース履歴

| 時刻 | release | 内容 | 件数 |
|---|---|---|---|
| 11:52 | v11.3 | Phase α Critical 7 項目一括 | 101 件 |
| 12:04 | v11.4 | Phase β Moderate 機械置換 | 31 件 |
| 12:09 | v11.5 | Phase γ DIAGRAM-5/6/7 追加 | 3 件 |
| 12:11 | **v11.6** | Phase β/γ 残課題 + 新規 5 件 | 11 件 (+5 件追加) |
| **合計** | | | **146 件** |

## 残存課題 (今後のセッション)

design-critique の残:
- Moderate 残約 60 件 (構造変更が必要: schema 強制 / 件数上限 / icon SVG 置換)
- Minor 残約 60 件 (細かい微調整)
- Improvement 残 26 件 (NEW-VISUAL-13/14/15、NEW-LIST-11/12、NEW-FRAMING-7/8、NEW-COMPARE-8/9、NEW-CHART-A6、NEW-PROJECT-5/6/7、NEW-CODE-8/9/10、NEW-WEBPAGE-5/6 等)

これらは構造変更や新規実装が中心で、デザイン critique 結果だけからは判断しきれず、
osanai 氏の実利用ユースケースに沿った優先順位付けが必要なため、別セッションで対応。

---

# v11.5.0 (2026-05-12) — Phase γ 新規 DIAGRAM-5/6/7 追加

## 何を変えたか

design-critique で抽出した Improvement (新規追加候補) 34 件のうち、最も軽量な
**DIAGRAM 系の template ラッパー追加** から着手。既存 DIAG-* を直接呼ぶしか無
かったパターンを、1 枚スライドの主役として呼べる template として登録。

### 新規追加テンプレ (3 件)

| 新 ID | 用途 | 元実装 (流用) |
|---|---|---|
| **DIAGRAM-5** | サイクル図 (4 段階反復 / PDCA 型) | DIAG-02 (`diag-02-cycle.js`) |
| **DIAGRAM-6** | ピラミッド図 (階層構造 / 3 層推奨) | DIAG-05 (`diag-05-pyramid.js`) |
| **DIAGRAM-7** | ステップアップ図 (成長ロードマップ / 3-5 段) | DIAG-03 (`diag-03-stepup.js`) |

### 実装方針

DIAGRAM-1 (matrix) と完全に同じパターンの薄いラッパー実装:
- `atoms.setCanvasBg` + `addTitleBlock` + 既存 DIAG 描画関数 + `addChromeWithNav` + speaker notes
- full bleed area: `{x: L.marginX, y: L.contentY+0.05, w: 9.2, h: ~3.5}` で渡す
- diagram 固有データは `nodes` / `layers` / `steps` に直接受け取り (DIAG-XX と同じ形式)

### schemas/templates/index.js への追加

- `DIAGRAM5` schema: nodes 4 件固定 (label + sub + body + pos + color)
- `DIAGRAM6` schema: layers 2-5 件 (label + body)
- `DIAGRAM7` schema: steps 3-5 件 (label + body)
- `TemplateSchemaRegistry` に登録

### スライドパターン一覧 (SKILL.md 更新は次回 release で対応)

| カテゴリ | テンプレ ID 数 | 主要 ID |
|---|---|---|
| DIAGRAM (旧) | 4 | DIAGRAM-1/2/3 + SECSUMMARY-1 |
| **DIAGRAM (v11.5 拡張後)** | **7** | DIAGRAM-1/2/3 + **DIAGRAM-5/6/7** + SECSUMMARY-1 |

## 残 Phase γ 候補 (次回以降)

Improvement 34 件のうち今回未着手:
- NEW-VISUAL-13 (画像 + 3 引用吹き出し)
- NEW-VISUAL-15 (写真 3 枚の時系列)
- NEW-LIST-10 (縦長アジェンダ 5-8 件)
- NEW-COMPARE-9 (Quadrant マトリクス)
- NEW-SECTION-7 (サブセクション扉)
- NEW-CHART-A6 (KPI ダッシュボード)
- NEW-PROJECT-6 (カンバン風)
- NEW-DATA-7 (タイムスタンプ付きログ)
- NEW-CODE-10 (Diff 表示)
- 他 22 件

---

# v11.4.0 (2026-05-12) — Phase β design-critique Moderate 一括改修 (per-template)

## 何を変えたか

design-critique で抽出した Moderate 113 件のうち、機械置換可能な **31 件** を一括適用。

### LIST カテゴリ (11 件)
- **LIST-1**: 左 brand バー 0.04×0.32 → 0.08×0.36 (視認性 UP / F046)
- **LIST-2**: 番号 charSpacing -0.5 → 0 (詰めすぎ解消 / F050)、body min 9.5pt → 10.5pt 死守 (F051)
- **LIST-3**: triadColors [ink, gray500, gray600] → 全 ink (灰色ローテ撤廃で並列性保持 / F055)
- **LIST-4**: 番号 charSpacing -1 → 0 (F060)、stripe 色 [ink, gray500, gray600, gray400] → 全 brand (F059)
- **LIST-5**: badge 色 [ink, gray700, gray500, gray400] → 全 ink (重要度暗示解消 / F063)
- **LIST-6**: defaultBadges 6 番目崩れ → 全 ink 規則化 (F067)
- **LIST-7**: triadColors → brand/accent/highlight (カラム軸の意味を 3 色で明示 / F070)
- **LIST-8**: title 26pt charSpacing -0.5 → 22pt 0 (スライドタイトル 20pt との階層差を保つ / F072)
- **LIST-9**: defaultColors → brand/accent/highlight (3 軸を色で明示 / F077)

### VISUAL カテゴリ (4 件)
- **VISUAL-1**: 番号バッジ 1=brand / 2=accent / 3=brand → 全 brand 統一 (F006)
- **VISUAL-4**: label charSpacing 2 → 1 (日本語 kerning 補正 / F037)
- **VISUAL-8**: eyebrow charSpacing 2 → 1 (F040)
- **VISUAL-12**: eyebrow charSpacing 2 → 1 (F042)

### FRAMING カテゴリ (2 件)
- **FRAMING-1**: 3 ブロック背景 amber 塗り (brandSoft / accentSoft / gray100) → white + 左 0.05" バー (v9 改修方針 LIST-3 流に揃える / F084)
- **FRAMING-3**: a.org 9pt → 10pt (dark bg 可読性 / F092)

### SECTION カテゴリ (4 件)
- **SECTION-1A**: atmosphere orb 4 つ → 2 つ (装飾過多解消 / F107)
- **SECTION-1D**: 大タイトル charSpacing -1 → 0 (F112)
- **SECTION-4**: 番号 90pt charSpacing -2 → 0 (詰めすぎ解消 / F125)
- **SECTION-5**: title charSpacing -0.5 → 0 + `fit: shrink` 追加 (長文タイトル対応 / F129)

### COMPARE カテゴリ (3 件)
- **COMPARE-1**: Before カード塗り gray100 → white border (「失敗感」解消、After 強調を保つ / F139)
- **COMPARE-1/2**: ヘッダ「これまで」「これから」charSpacing 2 → 0 (日本語 kerning 補正 / F137)

### DIAGRAM カテゴリ (1 件)
- **DIAGRAM-2**: 番号 charSpacing 2 → 1 (日本語数字 kerning 補正)

### CHART カテゴリ (1 件)
- **CHART-A3**: 上端バー色 3 番目 gray500 → highlight (3 色等価化、灰色「低優先度」暗示の解消)

### PROJECT カテゴリ (1 件)
- **PROJECT-1**: 「アウトプット」label charSpacing 1.5 → 0 (日本語 6 字に kerning 過大)

### WEBPAGE カテゴリ (1 件)
- **WEBPAGE-2/4**: site_name charSpacing 0.5 → 0 (日本語媒体名前提)

### CODE カテゴリ (3 件)
- **CODE-2/3/5**: head charSpacing -0.3 → 0 (詰めすぎ解消、日本語 head 対応)

## 既知の影響

- LIST-3/5/6 で番号バッジ・縦帯色がすべて ink になり、4-6 件並列の「灰色グラデで重要度暗示」がなくなる。同列重要なら ink 統一が本来の意図。
- LIST-4 縦帯は brand 単色になり、4 件全カードに amber 帯が描画されることで「並列カードの一体感」が強化される。
- LIST-7 / LIST-9 ではカラム別 stripe / icon 円が brand/accent/highlight の 3 色になり、軸の意味が視覚化される。
- FRAMING-1 は v9 改修方針 (white + 左バー) に揃った。3 ブロックの順序感は左バーの色 (brand / accent / gray) で表現。
- SECTION-1A は atmosphere orb 4 → 2 でやや静かになる。表紙の主張は signature gradient pill + 大タイトルが担う。

## 残存 Phase β / γ 課題

- 構造的な変更 (件数上限 schema 強制、items 件数チェック、SVG/icon フォント置換、speaker notes 強制注釈) は Phase β 続編または Phase γ で対応。
- 詳細は `logs/2026-05-12 全テンプレ-design-critique/design-critique-findings.csv` の残 Moderate 82 件 + Minor 75 件 + Improvement 34 件。

---

# v11.3.0 (2026-05-12) — Phase α design-critique 横断 Critical 一掃

## 背景

osanai 氏指示 (2026-05-12): 全 73 テンプレートに design-critique 標準 5 軸 (First Impression / Usability / Visual Hierarchy / Consistency / Accessibility) を 1 つずつ流して 261 findings を抽出 (`logs/2026-05-12 全テンプレ-design-critique/`)。
このうち横断的に複数テンプレに散在する Critical 7 項目を v11.3 で一斉修正。`tone: 'purple'` 廃止トークン残骸、hex hardcoded 50+ 箇所、横文字違反、chrome 4 連発の DRY 違反、9pt 死守ライン違反など。

## tokens.js

- `C.link`: 0563C1 (hyperlink、テーマ横断固定) — DATA-4 / VISUAL-7 / WEBPAGE-1 / WEBPAGE-3 の hex hardcoded を一掃
- `C.semanticDanger`: B91C1C (CHART / DIAGRAM の error fallback) — fallback chain `C.semanticDanger || '#B91C1C'` を撤去
- `T.code.*`: 12 種類 (bg / headerBg / headerLine / fileLabel / lineNumber / text / prompt / promptAlt / output / comment / highlight / dir / muted) — drawCodeBlock atom と CODE-1〜7 で共通利用
- `T.dark.*`: 8 種類 (bg / bgAlt / text / sub / mute / faint / page / overlay) — SECTION-2/5 / VISUAL-6 の dark hero テキスト色

## atoms.js

- `addChromeFull(ctx, slide, pageNum, opts)`: chrome 4 連発 (LeftStrip + Logo + Page + FooterLogo) を 1 呼び出しに集約。`withNav: true` で addChromeWithNav 併用も。影響: CODE-1〜7 + LONGTEXT-1 + WEBPAGE-1 + VISUAL-7 = 10 テンプレ
- `MARK_PALETTE`: 評価記号 (◎○△×) → トークン名マップ。COMPARE-3/5/6 の意味不統一 (○ が gray700 vs brand) を解消
- `resolveMarkColor(C, mark)`: MARK_PALETTE 経由の色解決
- `resolveColor(C, name, strict)`: LIST-2/4/5/6/9 のローカル _resolveColor を共通化

## templates/*.js (101 件の一括修正)

| 項目 | 件数 | ファイル |
|---|---|---|
| tone: 'purple' → 'amber' | 4 | list.js (2) / visual.js (1) / compare.js (1) |
| 横文字日本語化 | 6 | section.js (SECTION-5「Section」→「第 N 章」, SECTION-1F『 ' " ' → '「' ) / framing.js (「AWARD」→「受賞」+ charSpacing 8→1, 「Skill」→「学び」, 「Pack」→「パック」, 「MINDSET」→「考え方」) |
| 廃止 purple hex 'F0E0FF' → 'FFFFFF' | 1 | diagram.js (DIAGRAM-2) |
| chrome 4 連発 → addChromeFull | 10 | code.js (7) / data.js (1) / webpage.js (1) / visual.js (1) |
| code.js hex → C.code.* | 28 | drawCodeBlock atom + CODE-1〜7 |
| SECTION/VISUAL dark hex → C.dark.* | 12 | section.js (SECTION-2/5) / visual.js (VISUAL-6) |
| hyperlink hex → C.link | 4 | data.js / visual.js / webpage.js |
| fallback chain 撤去 | 22 | chart.js / diagram.js (semanticDanger), qa.js (9), data.js (LONGTEXT-1), compare.js (7) |
| 9pt 死守ライン | 14 | list.js (LIST-3/4) / data.js (DATA-2/5) / project.js (PROJECT-1) / qa.js (QA-INDEX) / chart.js (caption ×4) / compare.js |
| MARK_PALETTE 統一 | 1 | compare.js (COMPARE-6) |
| **合計** | **102** |  |

## 既知の影響

- `tone: 'purple'` を明示指定した既存 plan.json は Phase 2 で `tone: 'amber'` への書き換えを推奨。互換: tokens の `purple` エイリアスは残存しているのでクラッシュはしない。
- LIST-4 6 件構成は 9.5pt まで縮むが情報量がぎりぎりなので、Phase 2 で 4-5 件への分割を強く推奨。
- FRAMING-3「受賞」eyebrow の charSpacing は 8 → 1 に縮減 (英字「AWARD」前提の kerning を日本語に合わせ補正)。
- COMPARE-3/5/6 の評価記号 ○ は全て gray700 で統一 (COMPARE-6 で brand だったのを統一)。混在デッキでの意味の揺れが解消。

## 残存課題 (Phase β / γ で対応)

design-critique の Moderate 113 件 + Minor 75 件 + Improvement (新規追加テンプレ候補) 34 件。
詳細は `logs/2026-05-12 全テンプレ-design-critique/SUMMARY.md` および `design-critique-findings.csv`。

---

# v11.1.0 (2026-05-12) — BraindumpStructureQA (BSQA-01〜12) 導入 + braindump.md 4 要素構造化

## なぜ変えたか

osanai 氏指摘 (2026-05-12):

> braindump.md の品質を改善したい。References が TOP に来るべき。引用には青文字
> リンクが付くべき。1問1答が TOP に来て、構成は 1問1答に対する回答形式であるべき。
> 各セクションは、必要に応じて挿絵、必要に応じてテーブル表、本文、引用情報が
> 載っているべき。今多分そうなって無いと思われる、少なくとも直近の水産加工
> デッキでは。

実測 (`decks/2026-05-12_seafood-processing-segments/braindump.md`) で確認:
- References は既に TOP にあった ✓
- Q&A 早見表は **bullet list** で書かれていた (Markdown table ではない)
- 全 7 章すべて `visual: required` だが **画像埋め込み 0 件**
- `[N]` 引用は **素の文字列のまま** (Markdown linkify されていない)
- Q1 (733 字) / Q2 (710 字) は本文が **800 字未満**

writing-qa.py の WritingQA-28 (画像欠落) は warn 止まりで素通りしていた。
構造ルール側で fatal 化して Phase 1.8 → Phase 2 の橋を硬くする。

## 何を変えたか

### A. `scripts/braindump-structure-qa.py` 新設 (BSQA-01〜12)

| ID | severity | 内容 |
|---|---|---|
| BSQA-01 | fatal | TOP に `## 0. References` (Markdown table) |
| BSQA-02 | fatal | References 直後に `## 1. 解決したい疑問・懸念` (Markdown table) |
| BSQA-03 | fatal | Q&A 早見表行数 = Q 章数 |
| BSQA-04 | fatal | 各 Q 章に `> visual: required\|optional\|none` 行 |
| BSQA-05 | warn  | 各 Q 章に `> 関連 references` 行 |
| BSQA-06 | fatal | visual: required の Q 章に挿絵埋め込み必須 |
| BSQA-07 | warn  | 各 Q 章本文に 1 件以上の `[N]` 引用 |
| BSQA-08 | fatal | 本文 `[N]` が References table に全件登録 |
| BSQA-09 | warn  | References 登録の `[N]` が本文未使用 |
| BSQA-10 | fatal | Q 章順序が Q&A 早見表の id 順と一致 |
| BSQA-11 | fatal | Q 章本文の正味字数 ≥ 800 |
| BSQA-12 | warn  | 各 Q 章で「挿絵 / テーブル / 引用」のいずれかが含まれる |

### B. `scripts/braindump-linkify.py` 新設

本文中の `[N]` / `(N)` / `（N）` を References table の URL に対する Markdown
リンク `[[N]](url)` に自動変換。

- ベキ等 (2 回走らせても結果同じ)
- 既存 `[[N]](url)` Markdown link は触らない
- References table 内 / Markdown table 行 (`|` で始まる行) は保護
- VS Code / GitHub のプレビューで青文字リンクとして表示される

### C. references/phase1-hearing/braindump.md を新構造に書き換え

旧形式 (`## Intro: 疑問・懸念サマリー` + bullet list) を v11.1 形式
(`## 1. 解決したい疑問・懸念` + Markdown table) に書き換え。各 Q 章は
4 要素構造 (frontmatter + 挿絵 + 本文 800 字以上 + 引用 + テーブル) のテンプレに更新。

### D. references/qa/braindump-structure-qa.md を新設

BSQA-01〜12 のルール定義 + WritingQA との SSOT 関係を明文化。

### E. SKILL.md に C-20 を追加 + Phase 1.8 ゲートを更新

核ルール表に C-20 (braindump.md 4 要素構造) を追加。Phase 1.8 行に
「BSQA-01〜12 + WritingQA-24〜30 の 2 ゲート」を追記。

### F. WritingQA-23 ↔ BSQA-11 の SSOT 整理

writing-qa.py の v10.0γ-final 注釈で WritingQA-23 (上限 1500 字 warn) は採用見送り
が確定済み。**下限ガード** (800 字未満で fatal) は BSQA-11 に集約。writing-qa.py
には実装しない。

WritingQA-26/27 (孤児参照/孤児リンク) は BSQA-08/09 と同等内容で並列定義。
重複検査は意図的 (BSQA → writing-qa の順で実行し、BSQA で fatal を蹴れば
writing-qa は走らない運用)。

## 後方互換

- 既存の braindump.md (旧 Intro + bullet 形式) は `--strict false` モードで warn 止まり
- `--strict true` (Phase 2 関門) で fatal 化
- 既存 5 デッキの braindump.md は手作業書き換えで対応 (一気に fatal にはしない)
- WritingQA ルールは無変更 (writing-qa.py は触っていない)

## 既存 5 デッキ Before 測定

| Deck | BSQA fatal | BSQA warn | 主な違反 |
|------|------------|-----------|---------|
| 2026-05-12_seafood-processing-segments | 11 | 0 | BSQA-02 (Intro legacy) / BSQA-06 (画像なし×7) / BSQA-11 (Q1/Q2 800字未満) |
| 2026-05-09_omega3-adhd-fact (測定予定) | ? | ? | |
| 2026-05-11_kanto-low-mountain... | ? | ? | |
| 2026-05-12_rclone-gdrive-gcs-sync | ? | ? | |
| 2026-05-08_adr-learning-memo | ? | ? | |

---

# v10.10.0 (2026-05-12) — references/ 全 52 ファイルをクリスタライズ (-11%)

## なぜ変えたか

v10.9.0 で SKILL.md を 81% 削減した後、osanai 氏指摘: 「他の reference をはじめとするあらゆるファイルでまだ
冗長表現 / 被り表現 / レガシーへの言及などが残っていそう。全てのファイルを 1 つずつチェックして
クリスタライズを実施してほしい」。

references/ 配下の 52 .md ファイルがバージョン経過記述 (「v9.X で deprecated」「v10.X で新設」「後方互換」
「rollback snapshot」等) と削除済み機能 (mypedia / decision-guide deckStructure / build-narration-video /
Nanobanana refine / SVG ハイブリッド / 挿絵シーン概念) への言及で膨らんでいた。

## 何を変えたか

### A. 47 ファイルをクリスタライズ + 5 ファイルを削除

| 領域 | files | before lines | after lines | delta |
|------|-------|--------------|-------------|-------|
| `_common/` | 16 | 7,218 | 6,503 | -10% |
| `qa/` | 9 | 4,255 | 3,664 | -14% |
| `deck-structures/` | 6 (-2) | 2,294 | 1,832 | -20% |
| `phase1-hearing/ + phase2-information-design/` | 7 | 3,007 | 2,832 | -6% |
| `phase3-build/ + phase4-qa/` | 9 (-3) | 598 | 480 | -20% |
| `alt-modes/ + README.md` | 5 | 1,403 | 1,403 | 0% (整合性修正) |
| **合計** | **52 (-5)** | **18,775** | **16,714** | **-11%** |

総バイト: 897,323 → 804,673 (-10.3%)

### B. 削除した 5 ファイル

- `references/deck-structures/mypedia.md` (跡地ファイル、v9.25 で deckStructure 撤去済)
- `references/deck-structures/decision-guide.md` (同上)
- `references/phase3-build/native-illustration-primitives.md` (挿絵シーン撤去後の跡地)
- `references/phase3-build/native-illustration-catalog.md` (同上)
- `references/phase3-build/illustration-workflow.md` (同上)

### C. 削除した内容パターン

- バージョン経過記述: 「v6.X で deprecated」「v9.X で新設」「v10.X で fatal 化」「後方互換」「rollback snapshot」
- 既廃止機能への言及: mypedia / decision-guide / build-narration-video / Nanobanana refine / SVG ハイブリッド
- 削除済みルール枠: 旧 SQA-04〜07 欠番マーカー / WritingQA-20 欠番 / 旧 SchemaQA-12/17 移管経緯 / R1-3 deprecated 枠
- 同じ仕様の重複説明: header 構造表が冒頭+末尾で 2 回 / MUST-M7 が 3 箇所
- migrate pseudocode: migrateV8ToV9 / Wave 1〜5 移行セクション / MIGRATION_v9.md ポインタ
- 「いま使えない」予約番号: slide-patterns.md の予約カテゴリ K-T

### D. 残した内容

- 全ルール ID 体系 (C-1〜C-19 / R1-x〜R4-x / SchemaQA-01〜15 / StructureQA-00〜72 / WritingQA-01〜30 /
  VQA-01〜25 / RefQA-01〜13 / SecQA-01〜10 / SQA-01〜15 / R-BYPASS-1〜3 / R-DESIGN-01〜13 / G-CHART /
  G-SCENE / R-FIG-x)
- NG/OK の具体例 (教育目的)
- Why 説明 (モデルがエッジケース判断するために必要)
- schema 定義の正本 (doc / sections / reviews / questions / chapters / proposal_meta / case_meta 等)
- 現行 workflow と API

### E. dead link 修正

削除した 5 ファイルへの参照を 3 箇所で修正:

- `phase2-information-design/deck-instruction-template.md` L185, L239: `phase3-build/illustration-workflow.md` → `_common/scene-patterns.md` の R-FIG-PRIORITY
- `phase2-information-design/deck-instruction-schema.md` L482: 同上

`scripts/render/deck-structures/index.js` の旧 deckStructure フレンドリーエラー (mypedia / decision-guide が
旧 plan.json で指定された時の案内) は load-bearing なので残置。

### F. 副次修正

- `news-summary.md` の `appliesIf` フィールドに JavaScript syntax error (`=> true` → `() => true`) があり、ついでに修正

## 後方互換

ルール本体・API・スクリプト・schema は無変更。documentation のみの整理。既存 plan.json / 既存デッキ /
既存スクリプトには一切影響なし。

## バックアップ

クリスタライズ前の全 references/ を `logs/2026-05-12 SKILL.md-refinement/references-backup-v10.9.0/` に保存。

詳細レポート: `outputs/crystallize-report.csv` (52 ファイルの before/after 行数・バイト数・変更内容)

---

# v11.0 (2026-05-12) — Legacy cleanup major release (no functional change)

## なぜ変えたか

osanai 氏指摘: スキル本体は安定したが、`references/` / `scripts/` / `CHANGELOG.md` に
v6.x〜v9.x 由来の歴史的言及・移管ノート・deprecated alias が残り、Claude が「今守るべき
ルール」を引きにくい状態になっていた。v11.0 はそれを徹底的に削ぎ落とすメンテナンスリリース。

## 何を変えたか

### A. 文書削減

- CHANGELOG.md: v6〜v9 の旧エントリを全削除し、v10.x を 1 行サマリに圧縮（13,962 行 → 200 行台）
- references/ 配下: 「v6.x で〜」「v9.0 で StructureQA に移管」等の経緯記述を一括削除
- 「DEPRECATED」「後方互換」「旧 #N」「旧テンプレ ID 言及」を全削除
- scripts/ 内のコメント由来の同類言及を整理

### B. レガシー互換コード削除

- `print-structure-template.js` shim → `print-deck-structure.js` 単独
- `doc.deck_structure_template` alias → `doc.deck_structure` のみ
- `T.useTheme()` no-op shim → 完全削除
- `build-design-memo.py` alias shim → `build-narration.py` のみ
- `doc.theme` トップレベルフィールド受付 → palette.yml SSOT 一本
- v8.x `sections[]` 旧パス互換 → header[]/body/footer[] のみ

### C. versions/ プルーニング

- `skills/enostech-slides/versions/` を直近 3 つに限定

## 後方互換

無し（メジャーリリース）。ただし削除した互換コードはすべて v9.x で deprecated 化済み・
最新デッキでは未使用のもの。現役機能・現役テンプレ・ルール ID・Phase 構造は完全保持。

## 保持した機能（削っていない）

- 動画生成（v10.3.0 以前の機能、後で再導入可能な状態で温存）
- SlideMaster ネイティブ統合（v10.0 導入）
- QA 駆動モード（v9.32 導入 / v9.33 default ON）
- Phase 1.8 braindump（v9.37 導入）
- writing-qa rule split / 引用青文字化 / 引用インライン `[N]`
- 4 deckStructure（learning-deck / news-summary / proposal-deck / case-study-deck）
- 現役テンプレ（SECTION-1A〜G / LIST-1〜9 / その他）
- opt-out フラグ（skip_braindump / narration_strict / writing_strict / decision_focused / embed_master_layouts）
- 核ルール C-1〜C-19 全保持

## ロールバック

`skills/versions/enostech-slides_v10.9.0_2026-05-12.skill` に v10.9.0 .skill 保存済み。
canonical source は `outputs/legacy-cleanup/skill-snapshot/enostech-slides_v10.9.0_canonical/`。

---

# v10.x ライン（圧縮版）

各バージョンの詳細は git 履歴か `outputs/legacy-cleanup/skill-snapshot/enostech-slides_v10.9.0_canonical/CHANGELOG.md` 参照。

| Version | Date | 要点 |
|---------|------|------|
| v10.9.0 | 2026-05-12 | SKILL.md を 81% スリム化（2,186 → 578 行）。バージョン履歴ハイライト枠を全撤去 |
| v10.8.0 | 2026-05-12 | C-18 自己判断スキップ禁止 / C-19 スライド単位 QA CSV (`スライドQA.csv`) を生成義務化 |
| v10.7.0 | 2026-05-11 | StructureQA が v8 sections[] 形式の plan で無音 skip するバグ修正（fatal 化） |
| v10.6.1 | 2026-05-11 | fetch-image.js を gzip / deflate / brotli 自動デコード対応 |
| v10.6.0 | 2026-05-11 | WEBPAGE-1/2 で article_url から OG image を自動取得 |
| v10.5.0 | 2026-05-11 | StructQA-70/71/72 テンプレ多様性ルール / R2-16 VISUAL 優先選択指針 |
| v10.4.0 | 2026-05-11 | placeholder SVG 量産アンチパターンに対する 4 段ガード（C-15 強化） |
| v10.3.0 | 2026-05-11 | 動画生成機能を default OFF（コマンド経路は残置） |
| v10.1.7 | 2026-05-09 | インライン引用 `[N]` / `（N）` の自動青文字化（R-DESIGN-11 拡張） |
| v10.1.6 | 2026-05-08 | C-15 強化：SVG 子スキル references/ 必読化 + 量産モード禁止 |
| v10.1.5 | 2026-05-08 | Phase 1.8 / Phase 2 の小ステップ明示 + 3 つの fatal 機械ガード |
| v10.1.4 | 2026-05-08 | Step 4 完成：visual_assets[] → VISUAL-3 自動展開 |
| v10.1.3 | 2026-05-08 | LIST-3 desc auto-fit パッチ |
| v10.1.2 | 2026-05-08 | 結晶化 WF + LIST-3/2 文字数 auto-fit + 下地ジェネレータ |
| v10.1.1 | 2026-05-08 | Step 2 完成：braindump-illust.py + WritingQA-28 |
| v10.1   | 2026-05-08 | Phase 1.8 ↔ pptx 整合大改修：ファクト参照 / Visual / References Table |
| v10.0   | 2026-05-08 | メジャー：PowerPoint SlideMaster ネイティブ統合 + Phase 5 ナレーション動画自動生成 |

---

## 改訂履歴

- 2026-05-12 v11.0: legacy cleanup major release。機能変更なし。
