# Phase 2 指示書 JSON スキーマ

> Claude が Phase 2 で書くのはこの JSON だけ。HTML は
> `scripts/render-deck-instruction.py` が Jinja テンプレートから自動生成する。

---

## 🔴 MUST ルール（絶対遵守・例外なし）

### M1. detail_blocks には「実際にスライドに載る文字列」を一字一句そのまま書く

```
✅ 正: "IT 人材の不足感は 83% に達している（出典: IPA DX 白書 2024）"
❌ 誤: "人材不足の現状について説明"
```

「〜について説明」「〜を紹介」「〜に触れる」のような概要・メタ記述は絶対禁止。タイトル・サブコピー・箇条書き・段落本文すべて完成原稿レベル。

### M2. レビューは 4 サイクル × 各サイクル 1 ペルソナ + 専門レビュアー枠

- `reviews[]` は **最低 4 要素**（4 サイクル / 4 人別属性のペルソナ）
- 各サイクルの `persona` は 1 人（単数オブジェクト）
- 各サイクルのペルソナは **役職・経験年数・業界が異なる別人** で構成する
  これは「パワポでき太郎」のような特定範囲だけを担当するレビュアーで、
  「4 人別属性」の重複チェックからは除外される（`review_type` が指定された
  サイクルは `persona.name` 重複ガードの対象外）

流れ: **1 人目でレビュー → 改善 → 別属性の 2 人目で再読 → 改善 → ... → 専門レビュアーで仕上げ**

#### 専門レビュアー枠 — `review_type: "title-subcopy-qa"`

タイトル+サブコピーの **日本語クオリティ** を全スライド一括で QA する枠。
generic ペルソナ（読者視点）とは別に、ライティングのプロ目線で機械的にチェックする。

```json
{
  "cycle_num":   5,
  "cycle_desc":  "全スライドのタイトル+サブコピーを日本語ライティング観点で総点検",
  "review_type": "title-subcopy-qa",
  "persona": {
    "avatar": "📐",
    "name":   "パワポでき太郎",
    "role":   "プロフェッショナル パワポコンサルタント / 30 年選手",
    "bio":    "外資コンサル系で 30 年スライドを叩いてきたプロ。ja-writing skill の 4 原則と CHECKLIST を物差しに、伝わりやすさ / 自然な日本語 / 体言止め乱用防止を厳しく見る。",
    "traits": [
      { "label": "専門", "value": "タイトル+サブコピーの日本語" },
      { "label": "口調", "value": "ですます調 / 厳しい目利き + 必ず改善提案" }
    ]
  },
  "summary":  { "title": "全 {N} 枚を点検しました。", "stats": ["S/A スコア: {x} 枚", "B 以下: {y} 枚", "頻出パターン: 体言止め連発 / サブコピー字数不足 / 翻訳調"] },
  "per_slide_findings": [
    {
      "slide_id": "S5",
      "title":    "rtkの正体と削減実績",
      "subtitle": "Bash 出力を AI に渡す前に圧縮する Rust 製 CLI プロキシ。",
      "score":    "B",
      "comment":  "サブコピーが 39 字で説明力不足です。タイトルの体言止めも単独では分かりにくく感じます。",
      "suggestion": "タイトル: 「rtk の正体 — Bash 出力を圧縮する Rust 製 CLI プロキシ」 / サブコピー: 「30 分セッションで約 80% のトークンを削った Rust 製 CLI プロキシです。Claude Code に渡す前に Bash 出力を整形し、文脈の枯渇を抑えます (1)。」"
    }
  ],
  "top_concerns": [
    { "slide_id": "S8b", "headline": "タイトル+サブコピー双方が空。書き直し必須" },
    { "slide_id": "S5",  "headline": "体言止めが連続しており、3 枚連続で同じ語尾" }
  ],
  "issues":      [ ],
  "final_check": { "title": "全体総評", "body": "..." }
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `review_type` | string | `"title-subcopy-qa"` を指定。これがあるサイクルは title+subcopy 専門枠扱い |
| `per_slide_findings[]` | array | スライド単位の評価。`{slide_id, title, subtitle, score, comment, suggestion}` |
| `per_slide_findings[].score` | string | `S` / `A` / `B` / `C` / `D` の 5 段階。S が最良、D が要書き直し |
| `per_slide_findings[].comment` | string | 何が気になるかを 1〜2 文 (ですます調) |
| `per_slide_findings[].suggestion` | string | 具体的な改稿提案。タイトル+サブコピーの両方を提示 |
| `top_concerns[]` | array | 全体で最も気になる 5 枚を抜き出し。`{slide_id, headline}` |

**専門レビュアーの位置付け**:
- WritingQA (機械検査) より **粒度が細かい**。WritingQA-01 (字数) や WritingQA-02 (翻訳調) で
  検出されないニュアンス問題（体言止め連発・主述呼応・サブコピーの説得力不足）を拾う。
- 自動 CLI (`scripts/render/run-pawapo-dekitaro-qa.js`) で全スライドを走査し、
  reviews[] に直接書き込む。run-qa.py phase2 から自動実行される。
- スコア D が出ても **fatal 化しない (warn 扱い)**。書き直すかどうかは人間判断。

### M3. 思考過程タブは生成しない

`thinking` タブは存在しない。指示書は「最終アウトプット」と「レビュー」の **2 タブ構成**。

### M4. 各スライドに `illustration_decision` を書く

```json
"illustration_decision": {
  "adopt": true,
  "reason": "採用または拒否の理由 1-2 文"
}
```

### M5. 挿絵採用時は親スライドに `illustration` をネストする（独立エントリは作らない）

`adopt: true` のスライドには、同じオブジェクト内に `illustration` を**ネスト**する。独立した `S{id}-VISUAL` エントリを `slides[]` に作ってはいけない。HTML レンダリング時と PPTX 生成時に、付帯カード/ページは親の直後に自動で synthesize される。

```json
{
  "id": "S4",
  "illustration_decision": { "adopt": true, "reason": "..." },
  "illustration": {
    "scene": "before-after",
    "layout": "full-bleed",
    "ascii_art": "...",
    "intent": "...",
    "strength": "gentle",
    "refine_prompt": null
  }
}
```

`adopt: false` なのに `illustration` があるのは違反（M5 VIOLATION）。

### M6. 各スライドに `slide_goal: {title, subtitle}` を書く

`slide_goal` は「このスライドの設計指針」を 2 行で表現するフィールド。display の title/subtitle（実際にスライドに載る文字）とは別。

```json
"slide_goal": {
  "title":    "このスライドで何を伝えたいか (1 行)",
  "subtitle": "読者をどう導きたいか (1 行)"
}
```

HTML では各スライドカード先頭に 🎯 GOAL バナーとして表示される。

### M7. 各スライドに `speaker_notes` を **ナレーション台本** として書く

> 詳細は `references/phase3-build/README.md §R3-2` と `references/qa/writing-qa.md §WritingQA-15〜18`。

`speaker_notes`（または `notes`）には、**そのまま音声で読み上げて意味が通る日本語**を入れる。
1 スライドあたり **80〜250 字**（30〜90 秒）が目安。文体は **ですます調統一**。

```json
"speaker_notes": "ベアフットの正体を、まず 4 つの構造差分で押さえます。ヒール差はゼロドロップに近く、ソールはおおむね 8 ミリ以下、つま先空間のトーボックスは広めで、アーチ補強はほぼ入りません。この 4 つを揃えて初めて『ベアフット』と呼べる、と理解しておくと、後の章で出てくるブランド比較がぐっと読みやすくなります。"
```

#### 守ること

- **タイトルは伏線として 1 文目に組み込む**（タイトルそのものを読み上げない）
- **終端は次への橋渡し 1 文**（明示的な「次は…」ではなく自然な転調）
- **専門用語が初出なら 1 度だけかみ砕いて補足**
- 章末まとめは「章の要約 + 次章への接続」、表紙は「デッキ全体の予告」、お土産は「使い方 2-3 文」

#### 禁則（音声で破綻するもの）

- **`(N)` 引用マーカーをナレーションに残さない**（書き起こしには残ってよい）
- **「ご覧の通り」「画面右に」「この図のように」みたいな視覚依存表現は控えめに**
- **体言止めの連発禁止**
- **箇条書きマークアップ（`*` / `-` / `1.` 行頭）をそのまま残さない** — 接続詞で繋いで散文にする

#### 機械検証 (warn デフォルト)

- WritingQA-15: 30 字未満 / 350 字超
- WritingQA-16: 視覚依存表現混入
- WritingQA-17: 箇条書きマークアップ残存
- WritingQA-18: 体言止め終端

`doc.narration_strict: true` を立てると上記すべて fatal 昇格。

### 自己チェック (run-qa.py phase2 を呼ぶ前に必ず実行)

- [ ] すべての `detail_blocks.items` / `.text` が**完成原稿の日本語文字列**になっているか
- [ ] `reviews[]` が 4 要素、各サイクルの `persona` が別属性の 1 人ずつ (4 人とも別人) か
- [ ] `thinking` field が JSON に無いか
- [ ] 全スライドに `illustration_decision` があるか
- [ ] `adopt: true` のスライドに `illustration` オブジェクトがネストされているか
- [ ] `adopt: false` のスライドに余計な `illustration` が残っていないか
- [ ] 全スライドに `slide_goal: {title, subtitle}` があるか
- [ ] **全スライドに `speaker_notes`（ナレーション台本、80〜250 字、ですます調）が書かれているか** (M7)
- [ ] 見取り図の媒体選定が `references/deck-structures/learning-deck.md` §StructQA-12 の判定表に沿っているか（並列要素 4 件以上ならリスト系、世界観なら DIAGRAM-4、時系列なら DIAG-06、迷ったら DIAGRAM-4）
- [ ] **DIAGRAM-4 を選んだ場合のみ**、`placeholder_label`（章の核を 1 文）と一言キャプション (`one_line`) が記入されているか
- [ ] **本文中で 3 件以上の専門用語が登場するなら、DATA-4 と FRAMING-4 の間に DATA-5（用語集）が配置されているか**
- [ ] `python3 scripts/render-deck-instruction.py -i deck.json -o /tmp/preview.html` 実行時に stderr に MUST violation 警告が出ない
- [ ] **`doc.references[]` にデッキ内の全引用情報を集約してある**（RefQA-01〜10 の見通しを高める。省略可だが推奨）
- [ ] **`qa/slide-qa.md`（SQA-01〜12）と `qa/sections-qa.md`（SecQA-01〜09）を全件走査し、違反 0 件**

---

## 🔴 セクション挿絵 (DIAGRAM-4) のスキーマ規約（採用時）

「見取り図」スライドの媒体は DIAGRAM-4 / FRAMING-2 / LIST-4 / LIST-7 / DIAG-06 から
StructureQA-12 判定表で選ぶ。
**DIAGRAM-4 を採用した場合**は以下のスキーマで `slides[]` に独立エントリとして書く
（`illustration` ネストではなく、ネスト型挿絵とは別概念）。

```json
{
  "id": "S2-OVERVIEW",
  "template_id": "DIAGRAM-4",
  "slide_goal": {
    "title": "本章で扱う 8 種類の図解の全体像を 1 枚絵で示す",
    "subtitle": "読み流し読者でもこの 1 枚で章の雰囲気を掴める状態を作る"
  },
  "title": "図解で読みやすく — 8 種類のダイアグラム",
  "section_no": "02",
  "one_line": "サイクル / ピラミッド / マトリクス — 図解は 8 つの型で 9 割のシーンに対応できる。",
  "placeholder_label": "中央に「8 種類の図形が章ごとに並ぶ」概念図 — 例: 横一列にサイクル / ピラミッド / 2×2 マトリクスのアイコンが並ぶフラットイラスト",
  "illustration_decision": { "adopt": false, "reason": "DIAGRAM-4 自体が挿絵スライドのため、ネスト型 illustration は不要" }
}
```

**フィールド**:
- `section_no`: 章番号（'02' '03' 等の 2 桁文字列）
- `one_line`: アンバー左バー付きの一言キャプション。「絵を見て一言で言うとこう」レベルの主張文（〜45 字）
- `placeholder_label`: draft 段階のプレースホルダーに表示する概念ラベル

## 🔴 用語集 (DATA-5) のスキーマ規約

```json
{
  "id": "S-GLOSSARY",
  "template_id": "DATA-5",
  "slide_goal": {
    "title": "本編で使った専門用語を末尾でまとめて補足する",
    "subtitle": "読み手が「あの言葉は何だっけ」と戻れる安心感を提供する"
  },
  "title": "本資料に登場した専門用語",
  "subtitle": "聞き慣れない言葉や社内固有の略語を、読み方と一緒にまとめました。",
  "terms": [
    { "term": "inlineRef",  "reading": "インラインレフ", "desc": "本文中の主張直後に差し込む青文字ハイパーリンクの参照番号" },
    { "term": "テンプレ ID", "reading": "てんぷれあいでぃー", "desc": "LIST-1 / FRAMING-1 / SECTION-6 等、scripts/render/templates/*/index.js の registry に登録されたカテゴリ + 連番形式の ID" }
  ],
  "illustration_decision": { "adopt": false, "reason": "リファレンステーブルのため挿絵不要" }
}
```

**フィールド**:
- `terms[]`: 7 行以内推奨（最大 10 行、超える場合は 2 ページに分割）
- 各 term は `{ term, reading?, desc }`。reading は任意だが原則記入
- **登録対象は本文中で実際に登場した補足が必要な用語のみ**。一般的な日本語は含めない
- 用語が 0-2 件しか無い場合はスライド自体を省略する

---

## 全体構造

```json
{
  "doc":      { ... },
  "sections": [ ... ],
  "reviews":  [ cycle1, cycle2, cycle3, cycle4 ]
}
```

**スキーマの主な特徴**:
- `review` (単数) ではなく `reviews[]` (配列 4 要素、各に `persona` 単数)
- `slide_goal` を全スライドに必須
- 挿絵は親スライドに `illustration` をネスト（独立 `-VISUAL` エントリは作らない）
- `detail_blocks.items/text` に「全文記述」要求

---

## `doc` (ドキュメントメタ)

| フィールド | 型 | 説明 |
|---|---|---|
| `title` | string | デッキのタイトル |
| `version` | string | スキーマバージョン |
| `date` | string | YYYY-MM-DD |
| `theme` | string | `enostech` / `corporate` / `nature` / `warm` / `mono` |
| `theme_desc` | string | 表示用テーマ名 |
| `purpose` | string | デッキの目的 |
| `reader` | string | 想定読者 |
| `before_after` | string | 読者の Before→After 1 行 |

---

## `doc.references[]` (デッキ全体の引用情報集約リスト)

> 各スライドの `ref_table[]`（DATA-4 用データ）とは別に、**デッキ全体の引用情報を 1 か所に集約**するフィールド。
> Phase 2 HTML 設計書の「📚 リファレンス一覧」タブに表示される。
> RefQA チェックの見通しを高めるために利用。DATA-4 の実装データ（`ref_table`）とは二重管理になるが、
> 設計書レビュー段階での引用全体の俯瞰・リファレンス漏れの早期発見が目的。

```json
"references": [
  {
    "num": 1,
    "category": "調査",
    "title": "IPA DX 白書 2024 > 第3章 IT 人材の現状",
    "url": "https://www.ipa.go.jp/publish/wp-dx/dx-2024.html#ch3",
    "source": "IPA（情報処理推進機構）",
    "year": "2024",
    "note": "IT 人材の不足感 83% の数値の出典",
    "cited_by": ["S3", "S7"]
  },
  {
    "num": 2,
    "category": "公式文書",
    "title": "dbt Best Practices > Modular models",
    "url": "https://docs.getdbt.com/best-practices/how-we-structure/2-staging",
    "source": "dbt Labs",
    "year": "2024",
    "note": null,
    "cited_by": ["S12"]
  }
]
```

| フィールド | 型 | 説明 |
|---|---|---|
| `num` | int | インライン参照番号 `(N)` と一致させる |
| `category` | string | `調査` / `公式文書` / `社内` / `解説` / `事例` / `その他` |
| `title` | string | 引用ページのタイトル（RefQA-01 に従い最深ページ名で）|
| `url` | string \| null | 直接リンク URL（RefQA-01: 最小粒度）|
| `source` | string | 発行元・著者名 |
| `year` | string | 発行年または年月（RefQA-07）|
| `note` | string \| null | 何を引用したかの 1 行メモ（省略可）|
| `cited_by` | string[] | このリファレンスを参照しているスライド ID 一覧（RefQA-05 の対応追跡用）|
| `image` | object \| null | 画像補足を付けたい時の制御オブジェクト（下記）|

### `references[].image` (リファレンス画像補足)

本文では文章でしか触れていないが、出典側の図表が論点理解に決定的なときに使う。
`image.enabled === true` を立てると build-deck.js が `image.source_url` を DL し、
**そのリファレンスを本文で初引用したスライドの直後に VISUAL-7 を自動挿入**する。

```json
"image": {
  "enabled": true,
  "source_url": "https://example.com/arch-diagram.png",
  "caption": "分析エージェント・アーキテクチャ図",
  "rationale": "本文では文章でしか触れていない 3 層構成を、出典の図でそのまま見せたい",
  "license_note": "記事ページに掲載された自社作成図。引用範囲で利用",
  "local_path": null,
  "fetch_status": null
}
```

| フィールド | 型 | 役割 | 設定主体 |
|---|---|---|---|
| `enabled` | bool | true で VISUAL-7 自動配置を起動。**SchemaQA-15 で source_url 必須**| ユーザー |
| `source_url` | string | 画像の直接 URL (http/https)。SchemaQA-15 で URL 形式必須 | ユーザー |
| `title`  | string | **Claude が文脈に合わせて命名した画像タイトル** (VISUAL-7 のタイトル行)。最優先 | デッキ作成 AI |
| `description`  | string | 画像の客観的説明 (image.title が無い時のフォールバック) | OG/記事キャプション等 |
| `alt`  | string | HTML alt テキスト (image.title/description が無い時のフォールバック) | 記事 HTML |
| `caption` | string | 画像の要約・伝えたい内容 = VISUAL-7 のサブコピー (rationale と結合) | ユーザー |
| `rationale` | string | なぜこの画像を補足したいかの理由 (1〜2 文)。サブコピーで caption と結合 | ユーザー |
| `license_note` | string \| null | 引用要件のメモ (出典クレジット脇に小さく表示) | ユーザー |
| `local_path` | string \| null | DL 後のローカルパス (`assets/images/{sha1}.{ext}`) | build-deck.js 自動充填 |
| `content_type` | string \| null | 取得した MIME タイプ | build-deck.js 自動充填 |
| `fetched_at` | string \| null | DL 時刻 (ISO 8601) | build-deck.js 自動充填 |
| `fetch_status` | string | `'ok'` \| `'failed'` \| `'skipped'` \| `'pending'` | build-deck.js 自動充填 |
| `fetch_reason` | string \| null | 取得失敗時の理由 | build-deck.js 自動充填 |

**配置位置の優先順位** (build-deck.js 内 `injectReferenceImageSlides`):

1. `ref.cited_by[0]` のスライド直後
2. raw_text_runs に `{ref: N}` を含む最初のスライドの直後
3. DATA-4 (参考情報集) の直前
4. 最終セクションの末尾

ユーザーが手で `template_id: "VISUAL-7"` を plan に書いていれば、自動挿入は重複検知でスキップされる。

**著作権の扱い**: 出典クレジット (出典: ソース名 + URL リンク) は VISUAL-7 が必ず画像直下に表示する。
license_note は引用範囲・改変不可などの注意書き用 (例: 「記事ページに掲載された自社作成図。引用範囲で利用」)。

**`section_id` と `subsection` の役割分担**:

| フィールド | 粒度 | 役割 | スライド上の表示 |
|---|---|---|---|
| `section_id` | 章（大） | どの `sections[]` エントリに属するかを示す。スクリプト側で `getSectionIdx(section_id)` を呼び出し、ナビチップの active 位置を決定する | 上部ナビチップ（active チップが光る） |
| `subsection` | サブグループ（中） | 章内の論理グループ名。`›` 区切りで section 名の右に表示される | `章名 › サブセクション名` のパンくず |

subsection が存在するスライドでは、ナビ上に必ず **`section名 › subsection名`** の形式でパンくずが表示されること（SQA-15）。

**⚠️ `preview_base64` は書かない** — `template_id` から Python 側が自動注入。

---

## `sections[]` (最終アウトプットタブ)

```json
{
  "id":   "intro",
  "code": "A",
  "name": "導入",
  "slides": [ ... ]
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | **必須**。スライドの `section_id` と対応するキー。英数字・ハイフンのみ（例: `"intro"` `"setup"` `"summary"`）。スライド生成スクリプトで `getSectionIdx(section_id)` を呼ぶ唯一の根拠 |
| `code` | string | HTML 指示書表示用の章番号ラベル（`"A"` `"B"` 等） |
| `name` | string | ナビチップに表示される章名（12 字以内推奨、R-DESIGN-13） |

### サブセクション運用 — 「セクション > サブセクション > スライド」3 階層

**`sections[]` がデッキ全体の大章 (3-5 章目安、ナビチップに表示) を表すのに対し、
各スライドの `subsection` field は同一章内のサブグルーピングを表す**。Phase 2 HTML では:

- セクションタイトル (大: `SECTION B 本編`)
- ↓
- ↓
- スライドカード (小)

の 3 階層で表示されるので、章扉/挿絵/詳細スライドの塊が一目で分かる。

**サブセクション設計のコツ**:
- **章本文 ≥ 4 枚なら subsection 2 個以上必須**
- 同一サブセクションのスライドは **連続配置** すること（離して並べると HTML 上で別 divider に
  分かれてしまう）
- サブセクション名は **3-10 文字の意味のある日本語** にする（「ローカル環境」「WH 連携」
  「pre-commit と IDE」等）。`"1.1"` `"2.1"` のような番号は禁止 (機械的な空回し)
- 章本文 ≤ 3 枚の小章は subsection 0 個でも OK
- 1 章 = 2-3 サブセクションが理想。4 つ超えると章を分けた方が良いサイン
- **章扉 (SECTION-2/33/34) と章挿絵 (DIAGRAM-4) は同じサブセクション** にする（例: 「章の入口」）。
  本文スライドは別サブセクションに切り分けて整理する

**入力章立てメモとの対応**:
ユーザーが投げてきた章立て (`## 1.x 〜 ## 2.x` のような階層) を受け取った時、
`## 1` `## 2` 単位を `sections[]` に、各章内の小見出し (`## 1.1` の項目束) を
`subsection` field に分配する設計が王道。

### `slides[]` (スライドカード)

```json
{
  "id":            "S4",
  "template_id":   "LIST-1",
  "template_name": "標準コンテンツ",
  "section_id":    "setup",
  "subsection":    "ローカル環境",
  "title":         "実際のスライドに載るタイトル",
  "subtitle":      "実際のスライドに載るサブコピー",
  "template_note": "テンプレ選択の意図メモ",
  "slide_goal": {
    "title":    "このスライドで何を伝えたいか",
    "subtitle": "読者をどう導きたいか"
  },
  "detail_blocks": [ ... ],
  "illustration_decision": { "adopt": true, "reason": "..." },
  "illustration": {
    "scene":         "before-after",
    "layout":        "full-bleed",
    "ascii_art":     "...",
    "intent":        "...",
    "strength":      "gentle",
    "refine_prompt": null
  },
  "ref_table": null
}
```

**⚠️ `preview_base64` は書かない** — `template_id` から Python 側が自動注入。

### `detail_blocks[]` (詳細ブロック)

```json
{
  "heading":    "📝 コンテンツ",
  "full_width": false,
  "items":      ["スライドに実際に載る日本語", "もう 1 行"],
  "text":       "段落の場合はここに完成原稿"
}
```

🔴 M1 再掲: 必ず完成原稿。概要・メタ記述は絶対禁止。

### `slide_goal` (設計指針 2 行) 必須

| フィールド | 説明 |
|---|---|
| `title` | 「このスライドで何を伝えたいか」(1 行) |
| `subtitle` | 「読者をどう導きたいか」(1 行) |

### `illustration_decision` (挿絵判定)

| フィールド | 型 | 説明 |
|---|---|---|
| `adopt` | bool | 挿絵付帯スライドを立てるか |
| `reason` | string | 採用/拒否の理由 1-2 文 |

判定基準は `references/_common/scene-patterns.md` の R-FIG-PRIORITY。

### `illustration` (挿絵データ・ネスト)

`illustration_decision.adopt == true` の時のみ、親スライドに以下をネスト:

| フィールド | 説明 |
|---|---|
| `scene` | scene_id（`before-after` / `compare-3panel` 等） |
| `layout` | `full-bleed`（デフォ） / `with-title`（題字付き特例） |
| `ascii_art` | 人間確認用の ASCII アート |
| `intent` | 1 文で挿絵が何を補強するか |
| `strength` | `gentle`（デフォ） / `medium` / `strong` |
| `refine_prompt` | 通常 `null`。ユーザーが自発的に別テイストを要求した時のみ |

**Jinja レンダ時**: 親カードの直後に `{parent_id}-VISUAL` という付帯カードを自動 synthesize。ASCII アートと scene/layout/intent を表示。
**Phase 3 PPTX 生成時**: 親スライドの直後に VISUAL-3 ビジュアル主体の挿絵スライドを生成。

### `ref_table[]` — 参照情報を格納するフィールド（**全テンプレ対象**）

> 🔴 **このフィールドに関する絶対ルール（例外なし）**
>
> **① ref_table の集積 = DATA-4（最終ページのリファレンス一覧）**
> 全スライドの `ref_table[]` を束ねたものが、デッキ全体の引用情報になる。
> DATA-4 はこの集積データから自動生成される。つまり `ref_table` に書かれていない
> 引用は DATA-4 にも載らない。引用情報は必ずここに書く。
>
> **② ref_table に行がある場合、そのスライドの本文（detail_blocks）内に
> 必ず `(1)` `(2)` 形式のインライン参照番号を記載すること**
> ref_table に書いたのに本文中に `(N)` が無い状態は禁止。
> 逆に本文に `(N)` があるのに ref_table に対応行が無い状態も禁止（RefQA-05/RefQA-12）。
>
> **③ detail_blocks の中に URL を直書きしてはいけない**
> `{ "heading": "参照元", "text": "https://..." }` のような書き方は禁止（SQA-13）。
> URL は必ず `ref_table[]` に格納し、本文には `(N)` のインライン参照番号だけを置く。

```json
[
  { "category": "調査",    "title": "(1) IPA DX 白書 > 第3章 IT 人材の現状",       "url": "https://www.ipa.go.jp/publish/wp-dx/dx-2024.html#ch3",                "source": "IPA / 2024" },
  { "category": "公式文書", "title": "(2) dbt Best Practices > Modular models",   "url": "https://docs.getdbt.com/best-practices/how-we-structure/2-staging",   "source": "dbt Labs / 2024" },
  { "category": "社内",    "title": "2026 Q1 実測データ",                           "url": null,                                                                  "source": "社内 / 2026-04" }
]
```

| フィールド | 型 | 説明 |
|---|---|---|
| `category` | string | `調査` / `公式文書` / `社内` / `解説` / `事例` / `その他` |
| `title` | string | `(N)` 番号 + ページタイトル。RefQA-01 に従い最深ページ名で |
| `url` | string \| null | 直接リンク URL（RefQA-01: 最小粒度の深いページ） |
| `source` | string | 発行元 / 年（例: `IPA / 2024`） |

**DATA-4 スライド以外でも `ref_table` を使う**。標準コンテンツ (LIST-1) や
縦カード (LIST-4) 等、本文スライドでも参照 URL があれば必ずこのフィールドに書く。
DATA-4 スライド自身の `ref_table` には、そのページに掲載する全行を格納する。

---

## `reviews[]` (4 サイクル × 各 1 ペルソナ + 専門レビュアー枠)

> 🔴 **フィールド名は固定**: `cycle_num` (整数) / `cycle_desc` / `persona` /
> `summary` / `issues[]` / `final_check`。`final_check` は `{title, body}` の **dict** であり
> 文字列ではない (Jinja が `dict has no attribute 'summary'` で死ぬ)。
>
> 専門レビュアー枠は `review_type` フィールドを追加で持つ。
> 詳細は §M2 の「専門レビュアー枠」を参照。
>
> Phase 2 で plan.json を組む時は `scripts/render/schemas/`
> 経由で過去デッキの reviews フォーマットを参考にすると、フィールド名のズレを
> 起こしにくい。

```json
"reviews": [
  {
    "cycle_num":  1,
    "cycle_desc": "初稿に対する 1 人目のレビュー",
    "persona":    { ... 1 人目 (例: 情シス担当) ... },
    "summary":    { "title": "...", "stats": [ ... ] },
    "issues":     [ ... ],
    "final_check": { "title": "...", "body": "..." }
  },
  {
    "cycle_num":  2,
    "cycle_desc": "別属性の 2 人目で再読",
    "persona":    { ... 2 人目 (例: 事業部のキーユーザー) ... },
    "summary":    { ... },
    "issues":     [ ... ],
    "final_check": { ... }
  },
  {
    "cycle_num":  3,
    "cycle_desc": "技術ステークホルダーの読み (例: SRE / アーキテクト)",
    "persona":    { ... 3 人目 ... },
    "summary":    { ... },
    "issues":     [ ... ],
    "final_check": { ... }
  },
  {
    "cycle_num":  4,
    "cycle_desc": "経営層 / 意思決定者の読み (短時間で核を取る視点)",
    "persona":    { ... 4 人目 ... },
    "summary":    { ... },
    "issues":     [ ... ],
    "final_check": { ... }
  }
]
```

### `persona` (架空読者・各サイクル 1 人)

```json
{
  "avatar": "相",
  "name":   "相川 博之さん（架空）",
  "role":   "取締役 CFO / 55 歳 / 経理畑 30 年",
  "bio":    "数字と ROI で判断...",
  "traits": [
    { "label": "関心",   "value": "ROI、回収期間" },
    { "label": "警戒",   "value": "AI という抽象ワードに弱い" }
  ]
}
```

各サイクルは前のサイクルとは役職・経験・業界が異なる別人を用意する。

### `summary` / `issues[]` / `final_check` (各サイクル共通)

```json
{
  "summary": { "title": "1 回目のレビュー結果", "stats": ["..."] },
  "issues": [
    {
      "id":             "R1-1",
      "priority":       "high",
      "priority_label": "高",
      "target":         "S3",
      "feedback":       "...",
      "action":         "...",
      "diff":           { "before": "...", "after": "..." }
    }
  ],
  "final_check": { "title": "...完了後の状態", "body": "..." }
}
```

---

## バリデーション（render-deck-instruction.py が自動実行）

以下の違反は stderr に警告（Fatal ではないが Phase 3 前に要修正）:

- ⚠️ `reviews` が 4 要素以外
- ⚠️ 各サイクルに `persona` オブジェクトがない
- ⚠️ 2 サイクルのペルソナが同名
- ⚠️ `thinking` field が存在
- ⚠️ スライドに `illustration_decision` 欠落
- ⚠️ `adopt: true` なのに `illustration` オブジェクト欠落
- ⚠️ `adopt: false` なのに `illustration` オブジェクトが残っている
- ⚠️ スライドに `slide_goal: {title, subtitle}` 欠落

---

## デッキ構成の固定枠 (StructureQA に集約)

plan.json の構造そのものを `header[]` / `body.chapters[]` / `footer[]` の 3 フィールドに分離し、
各セグメントの中身を Template 定義
(`scripts/render/deck-structures/learning-deck.js`) で機械強制する。

検査ルール:

| ID | 検査内容 |
|---|---|
| **StructureQA-01** | `header[]` の順序・必須スライド (SECTION-1 → FRAMING-1 → FRAMING-2 → SECTION-6) |
| **StructureQA-02** | `footer[]` の必須スライド (DATA-4 / FRAMING-3 + 条件付き DATA-5 / FRAMING-4) |

詳細は `references/deck-structures/learning-deck.md` §StructQA-01 / 02 と
`references/phase2-information-design/plan-json-v9-structure.md` を参照。

learning-deck Template (= 学習デッキ) を選んだ場合の固定構成イメージ:

```
[header / 必須・固定]
  header[0]: SECTION-1 (表紙)
  header[1]: FRAMING-1 (構築背景)
  header[2]: FRAMING-2 (Before/After リスト)
  header[3]: SECTION-6 (統合目次)

[body.chapters / 章繰り返し・各章 head + content + tail]
  各章 head[]: 章扉 (SECTION-2/4/5) + 見取り図 (SECSUMMARY-1 ほか)
  各章 content[]: 任意のテンプレ
  各章 tail[]: FRAMING-5 (章末まとめ)

[footer / 必須・固定]
  footer[]: (条件付き DATA-5) → FRAMING-4 (お土産) → DATA-4 (参考情報集) → FRAMING-3 (会社紹介)
```

**FRAMING-1（構築背景）の必須項目** (`SchemaQA-01` で fatal):
- `block_kikkake`: 「きっかけ」セクションの本文（業種 + 規模 + 担当者の固有名詞 + 具体的な出来事）
- `block_kizuki`: 「気付いたこと」セクションの本文（現場で見えた問題の核心）
- `block_gimon`: 「解消したい疑問」セクションの本文（このデッキで答えるべき問い）

**FRAMING-2（Before/After リスト）の必須項目** (`SchemaQA-02` で fatal):
- `items[]`: 各要素 `{ before: '〜という疑問', after: '〜が分かる/できる' }` を 4-6 件
- 設計書の「解消する疑問」項目（あれば）から 1:1 で抽出。無ければ Phase 1 ヒアリング時に
  読者の Before/After を整理しておく

**FRAMING-3（会社紹介）**: コンテンツは固定（手動更新の前提）。
受賞実績の最新化が必要なら `notes` フィールドに「YYYY-MM 時点の受賞 N 件を反映」と記録。

これらの固定枠を欠いたデッキは StructureQA-01 / 02 が fatal を返し、
build-deck.js が exit 1 で停止する。

---
