# Render Architecture — Phase 2 JSON を中間表現としたスキーマ駆動レンダリング

> **このファイルは Phase 3 デッキ構築の唯一の真実 source**。
> 実装の論点で迷ったら、まずここに戻ること。
>
> Phase 2 JSON を AST として扱う宣言的レンダラーで動作する。

---

## 設計の狙い

| 軸 | 効果 |
|---|---|
| Claude の Phase 3 作業時間 | 小（ディスパッチャー実行のみ） |
| 安定性 | 高（純粋関数の型契約 + スナップショットテスト） |
| カタログ生成 | 同じ関数群を空 JSON で叩けば自動 |
| SchemaQA との整合 | 関数引数の型がそのまま契約 |
| 逸脱対応 | FREE-1 で局所化 |

---

## 3 層構造

```
┌─────────────────────────────────────────────────────────┐
│ Deck 層: build-deck.js                                  │
│   buildDeck(deckJson) → .pptx                           │
│   - JSON を読み、ctx を構築、template_id でディスパッチ │
└─────────────────────────────────────────────────────────┘
                          │ 各 slide ごとに呼ぶ
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Template 層: scripts/render/templates/*.js              │
│   renderList1Content(slide, slideJson, ctx) → void             │
│   - Atom を組み合わせて 1 テンプレ分のスライドを描く    │
│   - 純粋関数（slide を mutate するだけ、副作用は明示）  │
└─────────────────────────────────────────────────────────┘
                          │ 内部で Atom を呼ぶ
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Atom 層: scripts/render/atoms.js                        │
│   addTitleBlock / addChromeWithNav / setCanvasBg / ...  │
│   - 共通部品。テンプレに依存しない                      │
└─────────────────────────────────────────────────────────┘
```

ダイアグラムは 4 つ目の層として独立:

```
┌─────────────────────────────────────────────────────────┐
│ Diagram 層: scripts/render/diagrams/*.js                │
│   drawDIAG02(slide, json, area, ctx) → void             │
│   - area = {x, y, w, h} を引数で受け取る               │
│   - 1 枚丸ごとなら area = full bleed                   │
│   - テンプレ内に埋め込む時はコンテンツエリアを渡す      │
└─────────────────────────────────────────────────────────┘
```

FREE-1 もテンプレの一種なので Template 層に住むが、内部で `json.shapes[]` を
解釈して Atom や drawDIAG を組み合わせて描く特殊な責務を持つ。

---

## 関数シグネチャ

### Template 層

```js
function renderList1Content(slide, slideJson, ctx) {
  // slide: PptxGenJS の slide オブジェクト（pres.addSlide で作成済み）
  // slideJson: Phase 2 JSON の slides[] エントリ 1 件分
  // ctx: 共通コンテキスト（後述）
  // 戻り値なし。slide を mutate する
}
```

**規約**:
- 引数の slideJson は読み取り専用扱い。書き換えない
- slide への描画は Atom 経由を優先。直接 `slide.addText({color: '#000'})` のような
  ハードコード hex は禁止（C-5 ルール）
- 例外は FREE-1 のみ

### Diagram 層

```js
function drawDIAG02(slide, diagramJson, area, ctx) {
  // slide: 親スライドオブジェクト
  // diagramJson: ダイアグラムのデータ（{ items: [...], title?: '...' } 等）
  // area: { x, y, w, h }（インチ単位、PptxGenJS 標準）
  // ctx: 共通コンテキスト
}
```

**規約**:
- area が full bleed (0, 0, 10, 5.625) の場合は 1 枚丸ごとダイアグラム
- 部分埋め込みの場合は Template 関数からコンテンツエリアを area として渡される
- ダイアグラム関数は **Atom や Chrome に触れない**（Template が責任を持つ）

---

## 共通コンテキスト `ctx`

Deck 層が初期化して全 Template / Diagram に渡す。

```js
const ctx = {
  T: tokens,              // tokens.js（テーマ適用済み）
  L: layout,              // レイアウト定数（マージン、コンテンツ範囲など）
  F: fonts,               // フォント定数（jp = "Noto Sans JP"）
  sectionsMap: {          // sections[].id → index のマップ
    'intro': 0, 'main': 1, 'closing': 2,
  },
  sectionsList: [...],    // sections[] そのまま
  refsByNum: {            // インライン参照 (N) → URL 解決
    1: 'https://...',
    2: 'https://...',
  },
  pageNum: { value: 0 },  // ページ番号カウンター（mutable、Template が ++ する）
  pres: pptxgenInstance,  // PptxGenJS インスタンス（addImage 等で使う）
  assetsRoot: '...',      // ロゴや画像のベースパス
};
```

**設計理由**:
- 引数を毎回バラで渡すと Template 関数のシグネチャが膨らむ → ctx に集約
- pageNum は mutable（カウンター） だが他は基本 immutable
- Template 関数内で ctx を **書き換えるのは pageNum のみ** をルールとする

---

## FREE-1 の DSL 仕様

逸脱用の汎用テンプレ。Chrome（左帯・ナビ・タイトルブロック・フッター）は自動描画、
本体エリアは declarative な shape 配列で構成する。

### JSON 構造

```json
{
  "id": "S20",
  "template_id": "FREE-1",
  "section_id": "main",
  "title": "（タイトルブロックは通常通り）",
  "subtitle": "...",
  "slide_goal": { "title": "...", "subtitle": "..." },
  "illustration_decision": { "adopt": false, "reason": "..." },

  "free_layout": {
    "skip_title_block": false,
    "shapes": [
      { "type": "text", "x": 0.5, "y": 1.8, "w": 4.5, "h": 0.5,
        "text": "見出し風テキスト",
        "size": "h2", "color": "ink", "bold": true, "align": "left" },

      { "type": "rect", "x": 0.5, "y": 2.4, "w": 4.5, "h": 0.05,
        "fill": "brand" },

      { "type": "rule", "x": 0.5, "y": 3.0, "w": 4.5, "color": "gray300" },

      { "type": "image", "x": 5.5, "y": 1.8, "w": 4, "h": 3,
        "path": "assets/eno45/qr-hp.png" },

      { "type": "diagram", "scene": "DIAG-02",
        "x": 0.5, "y": 3.5, "w": 9, "h": 1.5,
        "data": { "items": ["計画", "実行", "確認", "改善"] } },

      { "type": "raw_text_runs",
        "x": 0.5, "y": 5.0, "w": 9, "h": 0.4,
        "runs": [
          { "text": "出典: " },
          { "text": "(1)", "ref": 1 },
          { "text": " IPA DX 白書 2024" }
        ],
        "size": "small", "color": "gray700" }
    ]
  }
}
```

### shape タイプ一覧

| type | 用途 | 必須プロパティ |
|---|---|---|
| `text` | 単一テキスト要素 | x, y, w, h, text, size, color |
| `rect` | 塗りつぶし矩形 | x, y, w, h, fill |
| `rule` | 罫線 | x, y, w, color (h は自動 0.02) |
| `image` | 画像 | x, y, w, h, path（assetsRoot からの相対） |
| `diagram` | ダイアグラム埋め込み | scene (DIAG-XX), x, y, w, h, data |
| `raw_text_runs` | リッチテキスト（インライン参照含む） | x, y, w, h, runs[] |

### トークン参照ルール（強制）

- **`color`** は文字列で `tokens.js` 内の役割名 (`brand` / `accent` / `ink` / `gray50〜700` 等)
- **`size`** は `h1` / `h2` / `h3` / `body` / `small` / `tiny` のいずれか（`tokens.js` の `fontSize`）
- **`fill`** は色トークン名（`brand` / `accent` / `gray100` 等）
- **直接 hex は受け付けない**。受け付けると `validateFreeShape` で fatal エラー

これで「FREE-1 が抜け道として乱用される」事態を抑止する。色を直書きしたくなったら
それは tokens.js に新しい役割色を足すべきサイン。

### 自動 Chrome の挙動

- 左サイド薄紫帯 = 自動
- 上部ナビチップ = 自動（slideJson.section_id を見て active 位置決定）
- フッター（ロゴ + ページ番号） = 自動
- タイトルブロック = `skip_title_block: false`（既定）なら自動描画。`true` の場合のみ
  本体エリアを最大限使える（本体 y 起点が 0.4 まで上がる）

### FREE-1 自身のスキーマ検証

`schema-qa.py` の SchemaQA-08:

- FREE-1 は `free_layout.shapes[]` 必須、各要素は type による必須
  プロパティを満たす、color/fill は KNOWN_TOKEN_NAMES のいずれか、size は
  KNOWN_SIZE_NAMES のいずれか

---

## ディレクトリ構成

```
scripts/
├── render/
│   ├── atoms.js                         ← Atom 層（共通部品）
│   ├── tokens-resolver.js               ← color/size 文字列 → tokens.js 値の解決
│   ├── templates/                       ← Template 層
│   │   ├── section/section-1-cover.js  ← renderSection1Cover
│   │   ├── list/list-1-content.js      ← renderList1Content
│   │   ├── framing/framing-1-background.js ← renderFraming1Background
│   │   ├── framing/framing-3-company.js    ← renderFraming3Company
│   │   ├── section/section-6-toc.js        ← renderSection6Toc
│   │   └── free/free-1.js                  ← renderFree1
│   ├── diagrams/                        ← Diagram 層
│   │   └── diag-02-cycle.js             ← drawDIAG02
│   └── build-deck.js                    ← Deck 層エントリポイント
├── schema-qa.py                         ← SchemaQA
└── render-deck-instruction.py           ← Phase 2 HTML
```

---

## 命名規約

**Template / Diagram は「役割名を関数名末尾にも入れる」**。ファイル名と関数名の
末尾を揃えることで、関数だけ見ても役割が即分かるし、ファイル名から関数名が機械的に
導ける。

| レイヤー | ファイル名 | 関数名 | 例 |
|---|---|---|---|
| Template | `{cat}/{cat}-N-{役割}.js` | `render{Cat}{N}{役割}` | `list/list-1-content.js` / `renderList1Content` |
| FREE-1 | `free/free-1.js` | `renderFree1` | （特殊枠） |
| Diagram | `diag-NN-{種類}.js` | `drawDIAGNN{種類}` | `diag-02-cycle.js` / `drawDIAG02Cycle` |
| Atom | `atoms.js` （単一ファイル） | 既存名を維持 | `addTitleBlock` 等 |

役割名（content / cover / toc / background / company / cycle 等）は
**「テンプレ固有の機能を表す短い英単語」** を選ぶ。slide-patterns.md のカテゴリ名
（A: STRUCTURE / B: CONTENT 等）とは別軸で、カテゴリは将来再分類されうるため
関数名には反映しない。

ファイル数が増えるのを嫌って 1 ファイルに詰め込みたい誘惑が出るが、**1 テンプレ = 1 ファイル**
を厳守する。理由:

- 純粋関数化のメリットが「ファイル単位の差分・テスト・編集」で享受できる
- Claude が Phase 3 で「LIST-1 だけ修正して」と言われた時、該当ファイルだけを開けば良い
- スナップショットテストもファイル単位で書ける
