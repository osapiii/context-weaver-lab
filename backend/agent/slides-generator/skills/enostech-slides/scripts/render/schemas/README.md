# scripts/render/schemas/ — テンプレ別 Zod スキーマ集

このディレクトリは **enostech-slides の正本 (Source of Truth) です**。
plan.json を書く時、render の挙動を変える時、新テンプレを追加する時は
**まずここを Read してから動く**。

## なぜここが SoT なのか

v7.1 までは template-samples.json (JSDoc から抽出した文字列カタログ) が
Phase 2 の参考資産だったが、

- `sample_raw` が単なる文字列で構造が分からず、ネストの深いテンプレ
  (LIST-8 / DATA-2 / DIAGRAM-1 / DIAGRAM-4 内の DIAG-XX 等) でフィールド名取り違えが多発
- 機械検証 (SchemaQA) も特定テンプレの一部しか検査できず、PptxGenJS が
  「無いフィールドはエラーにせず空白で出す」ためスライドが丸ごと空になる事故が起きていた

v7.2 で Zod ベースに全面移行。これ以降は **Zod スキーマが正本**。
template-samples.json は **撤廃された** (後方互換無し)。

## ディレクトリ構成

```
schemas/
├── README.md              ← この入口
├── common.js              ← 共通断片 (SlideBase / DocSchema / RefRow / TemplateValidationError / validateSlide ヘルパ)
├── index.js               ← レジストリ + validateSlideByTemplateId(slideJson)
├── templates/index.js     ← SECTION-1〜87 / FREE-1 (55 テンプレ)
├── diagrams/index.js      ← DIAG-02〜09 (8)
├── scenes/index.js        ← SCENE-01〜06 (6)
└── charts/index.js        ← CHART-01〜09 (9)
```

合計 **78 スキーマ**。各ファイルにテンプレ ID をキーとした
`xxxSchemaRegistry` が export されており、`AllRegistry` から横断引きできる。

## Claude が plan.json を書く時の動線

1. デッキで使うテンプレ ID を決める (例: LIST-8)
2. **`scripts/render/schemas/templates/index.js` を Read** し、
   該当 schema のフィールド一覧 (Zod 定義) を確認
3. 期待フィールドを見ながら slide JSON を組む
   ```jsonc
   // LIST-8 なら left + right 構造
   {
     "id": "S5",
     "template_id": "LIST-8",
     "title": "...",
     "left":  { "title": "...", "tagline": "...", "desc": "...", "chips": [...] },
     "right": [{ "title": "...", "items": [{ "n": "01", "head": "...", "body": "..." }] }]
   }
   ```
4. plan.json 全体を `node scripts/render/build-deck.js -i plan.json --validate-only` で
   pre-check (pptx を出さずに Zod 検証だけ実行)
5. 検証 pass したら通常ビルドへ進む

## render 時の検証 (build-deck.js)

build-deck.js のメインループで全スライドを `validateSlideByTemplateId()` に通す。
失敗は集約され、`STRICT_VALIDATE=1 node ...` または `--strict-validate` で
exit 2 で止まる。デフォルトは集約 warn でビルドを続行 (画像化して目視確認できる)。

検証エラーは構造化された JSON で report に書き出せる:
```bash
node scripts/render/build-deck.js -i plan.json -o out.pptx \
  --validation-report /tmp/validation-report.json
```

## 新テンプレを追加する時 (例: 新 LIST-10)

1. `scripts/render/templates/eno-99-something.js` で render 関数を実装
2. **同時に** `scripts/render/schemas/templates/index.js` に
   `ENO99` Zod スキーマを追加し、`TemplateSchemaRegistry` に登録
3. `build-deck.js` の `TEMPLATE_REGISTRY` に render 関数を登録
4. SKILL.md / CHANGELOG.md に新テンプレを記載
5. テンプレ追加だけで render が動き、Zod 検証も自動で効くようになる

スキーマ追加を忘れた場合: build-deck.js は「未登録テンプレはスキップ」と
warn を出すだけで render は動く (段階導入のため)。ただし Zod の保護は
無いので、サンプルデッキでテストして検証範囲に入れる。

## 共通フィールド (SlideBase)

全テンプレに共通する以下のフィールドは `common.js` の `SlideBaseSchema` で定義済み。
各テンプレは `SlideBaseSchema.extend({...})` で固有フィールドを足す:

- `id` (必須・文字列)
- `template_id` (必須・各テンプレで `z.literal('LIST-1')` のように現行 ID を固定)
- `title` / `subtitle` (大半のテンプレで必須、表紙等で例外)
- `section_id` / `subsection`
- `slide_goal: { title, subtitle }` (M6 規約)
- `illustration_decision: { adopt, reason }` (M4 規約)
- `illustration: {...}` (M5 規約、adopt:true 時のみ)
- `ref_table: [...]` (引用情報)
- `detail_blocks: [...]` (M1 互換)

## ヘルパー API

```js
const schemas = require('./schemas');

// 1. テンプレ ID で schema を引く
const sch = schemas.getSchema('LIST-8');

// 2. slide JSON を validate
const result = schemas.validateSlideByTemplateId(slideJson);
if (!result.ok) {
  console.error(result.error.toReportObject());
}

// 3. 直接 Zod を呼ぶ (高度ケース)
const parsed = schemas.ENO_08.safeParse(slideJson);
```
