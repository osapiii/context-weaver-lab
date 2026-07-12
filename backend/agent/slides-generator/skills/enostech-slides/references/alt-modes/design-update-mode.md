# デザイン更新モード 運用ガイド

> **このガイドはいつ読むか**: SKILL.md の「モード分岐」で **B. デザイン更新モード** に入った時。
> つまり、ユーザーが **スキル自体のデザイン資産** を変える依頼をしてきた時。
>
> デッキ本体 (decks/ 配下の .pptx) を直す依頼は `maintenance-guide.md`、
> 新規デッキ生成は `_common/workflow.md` を使う。混同しないこと。

---

## デザイン更新モードに入る条件

以下のいずれかの依頼を受けたら、このガイドを読む。

**典型例**:
- 「brand カラーを #9212F3 から別の色にしたい」
- 「Corporate テーマの accent をオリーブ系にしたい」
- 「LIST-1 のマージンを狭くしたい」
- 「フェーズフロー (PROJECT-1) のステップ番号をもう少し大きく」
- 「ダイアグラムパレット gold の色相をもう少し金寄りに」
- 「新しいダイアグラム DIAG-10 を追加したい」
- 「新しいスライドテンプレ COMPARE-2 を追加したい」
- 「ロゴを差し替えたい」

**対象となるソース**:
- `assets/tokens.js` / `assets/themes.js`（色・フォント・サイズ・レイアウト）
- `assets/logos/`（ロゴ画像）
- `scripts/example-deck.js`（スライドテンプレ実装）
- `scripts/diagram-patterns.js`（ダイアグラム実装）
- `references/_common/slide-patterns.md` / `references/_common/diagram-patterns.md`（メタ情報）

---

## 5 ステップフロー (1 回承認)

デッキ生成と違って **変更が全デッキに波及する** ので、承認を 1 回だけ挟む。

```
1. スコープ把握        — 何を触るか、どの範囲に波及するか宣言
2. ソース編集          — 該当ファイルを実際に書き換える
3. ビジュアルチェック  — 影響スライドだけ PNG 化してファイルパスで提示
4. ユーザー承認        — 「この見た目で OK ですか？」
     ↓ 承認
5. CATALOG 自動更新    — refresh-catalog-previews + generate-catalog を回し、
                         更新後 CATALOG.html のリンクを返す

     ↓ 却下の場合
   ソース編集を revert（git 管理下なら git checkout、そうでなければ手で戻す）
```

### なぜこの順番か

- **先にソースを編集してから PNG を撮る** のは、サンプル用スクリプトを別途書くより
  既存の example-deck.js / diagram-patterns.js をそのまま走らせる方が素直だから。
  「本物のレンダリング結果」を見せることで「サンプルと本番が違った」事故を防ぐ。
- **承認 1 回制** — サンプル段階での承認と最終承認を分けると無駄な往復が増える。
  実ソースを編集しレンダリング結果を見せた時点で、ユーザーは本番の見た目を
  見ているので、承認の信頼度は高い。
- **却下時は revert** — 全デッキへの影響を避けるため、承認されない変更は
  必ず元に戻す。

---

## ステップ詳細

### Step 1 — スコープ把握

依頼を読んで、以下を宣言する（頭の中で整理、もしくは短く返信）:

| 観点 | 例 |
|------|-----|
| 触るファイル | `assets/tokens.js` |
| 影響するテンプレ | 全スライド（トークン変更のため） / PROJECT-1 のみ / LIST-1〜08 |
| 影響するテーマ | enostech のみ / 全 5 テーマ |
| 波及リスク | 低（単一テンプレ）/ 中（共通トークン）/ 高（全テンプレ + 全テーマ） |

**波及リスクが中〜高の時は、Step 2 の前にユーザーに「この変更は全テーマの
brand 色を変えます。本当に進めてよいですか？」と事前確認する**。単なる挨拶の
確認ではなく、スコープの認識ずれを防ぐため。

### Step 2 — ソース編集

Edit ツールで該当ファイルを書き換える。以下の原則を守る:

- **コメント付きで編集理由を残す** — `tokens.js` の diff は歴史が残りにくい。
  変更の背景をコードコメントで 1 行添える
- **一度の PR は 1 目的に絞る** — 色変更とマージン変更を混ぜない
- **トークンは絶対にハードコードしない** — 色を変えたいなら `themes.js` 側を編集

### Step 3 — ビジュアルチェック

**該当スライドだけを PNG 化する**（全 50 枚撮るのは時間の無駄）。手順:

```bash
cd skills/enostech-slides

# tokens/themes 変更の場合は全スライド影響なので example-deck 全体を見る
# 特定テンプレのコード変更なら、そのスライド番号だけ確認すればよい

# A. pptx を生成
node scripts/example-deck.js           # スライドテンプレ (LIST-1 / FRAMING-1 等) を変えた場合
# または
node scripts/diagram-patterns.js       # DIAG-XX を変えた場合

# B. PNG 化 (LibreOffice + pdftoppm)
bash scripts/pptx-to-images.sh enostech-example.pptx /tmp/design-check 150

# C. 影響スライドだけ見せる
ls /tmp/design-check/slide-11.png      # 例: PROJECT-1 を変更したなら slide-11
```

**比較画像を提示**:

- Before: `assets/template-previews-hires/PROJECT-1.jpg`（既存カタログの画像）
- After: `/tmp/design-check/slide-11.png`（今撮った画像）
- 両方を並べた HTML を `present_files` で返す、または PNG を 1 枚ずつ Read して
  ユーザーに見せる

**全テンプレに影響する変更（brand 色変更等）** の場合は、代表的な
3〜5 枚だけ撮って見せれば十分。典型的には SECTION-1 (表紙), LIST-1 (標準), LIST-3
(カードグリッド), PROJECT-1 (フェーズフロー), DIAG-08 (マトリクス) あたり。

### Step 4 — ユーザー承認

ビジュアルを見せた上で、明示的に聞く:

> 「この見た目で確定してよいですか？承認いただいたら
> `refresh-catalog-previews.sh` を回して CATALOG.html まで更新します」

**承認されない場合は revert**。git 管理下なら `git checkout -- <file>`、
そうでなければ差分を手で戻すか、変更前の内容を事前に tmp に退避しておく。

### Step 5 — CATALOG 自動更新（承認後のみ）

```bash
cd skills/enostech-slides
bash scripts/refresh-catalog-previews.sh   # 全テンプレの hires JPEG を焼き直し
node scripts/generate-catalog.js           # HTML を再生成
```

最後に CATALOG.html を開くリンクを返す:

> 「更新完了。[CATALOG.html を開く](computer://.../CATALOG.html) で全体確認できます」

---

## 特殊ケース

### メタ情報だけの変更（コードは触らない）

`slide-patterns.md` の usage 欄を直す、`example-deck.js` のコメントを改善する、
などコードが変わらない場合は **Step 3 のビジュアルチェックは不要**。
Step 5 で `generate-catalog.js` だけ走らせれば足りる（`refresh-catalog-previews.sh` も不要）。

### 新テンプレ追加（COMPARE-2 / DIAG-10 等）

1. Step 2 で `example-deck.js` に新しいスライド関数を追加 + `slide-patterns.md` の
   該当カテゴリ表に 1 行追加
2. Step 3 で新テンプレのスライドだけ PNG 化して見せる
3. 承認されたら Step 5。`refresh-catalog-previews.sh` を回すと新テンプレの
   1000px JPEG が `assets/template-previews/` に自動で追加される。CATALOG はこの
   原寸を表示し、Phase 2 指示書は get-template-preview.py が 160px に
   オンデマンドリサイズして使う

### ロゴ差し替え

1. Step 2 で `assets/logos/` の画像を差し替え
2. Step 3 は CATALOG のロゴギャラリー（`#logos` セクション）で確認させる
3. Step 5 で `generate-catalog.js` を走らせる（ロゴは Base64 埋め込みなので
   HTML 再生成だけで反映される）

### 先方ブランドに寄せたい依頼 (Mode B ではなく Mode A 側で処理)

「先方のブランドガイドに寄せたい」「既存のデザインシステムに揃えたい」という
依頼は、デザイン更新モード (Mode B) ではなく **デッキ構築モード (Mode A) の
枠内で `useDesignFile` を使う** 案件として扱う。スキル本体のソースは触らない。

| 依頼例 | 何をする |
|-------|---------|
| 「先方の Tailwind Slate に寄せたデッキを」 | A モード + `useDesignFile` |
| 「IBM Carbon のブランド色で 1 枚」 | A モード + `useDesignFile` |
| 「会社の brand カラーを Tailwind Slate に変えたい（永続的に）」 | **B モード**（tokens.js / themes.js を書き換える） |

判断基準: **その変更を全デッキに永続化したいか**。
- 単発デッキだけ寄せたい → Mode A + `useDesignFile`
- 全デッキに反映したい  → Mode B（tokens.js を直す）

Mode A 側のステップ:

1. **ブランドソースを確認**: 先方のブランドガイド PDF / URL / Figma を見て、
   主要色（brand / accent / ink）と指定書体を抜き出す。出典 URL は必ず控える。
2. **design.md を起こす**: `assets/test-design-files/` のサンプル 3 種から
   近いテイストのものを雛形にして、デッキディレクトリに `design.md` を置く。
   `## Meta - source` に出典 URL を必ず残す。
3. **Phase 3 構築コードに 1 行足す**:
   ```javascript
   T.useDesignFile('./design.md');          // 上書き
   ```
4. **Phase 4 QA**: PNG 化したスライドで先方ガイドと色味が一致するか目視確認。
   不一致があれば design.md を直して再生成。
5. **Phase 5 packaging**: `decks/{slug}/design.md` に design.md をコピーし、
   speaker notes に `design.md source: <url>` を残す（再現可能性のため）。

詳しい仕様は `references/_common/brand-tokens.md` を参照。

---

## やらないこと

- **承認前に `refresh-catalog-previews.sh` を走らせる** — 数分かかる重い処理を
  承認前にやるのは浪費
- **サンプル用に別のミニ pptx を新規に書き起こす** — 既存の example-deck.js が
  本番レンダリングなので、これより正確なサンプルはない
- **複数の変更を 1 承認にまとめて混ぜる** — 「色 + マージン + フォント」をまとめて
  承認させると、どれが効いたか判断しにくい。分けて回す
- **CATALOG.html を手で編集** — 毎回スクリプトで上書きされる。手編集したい
  と思った時は、generate-catalog.js のテンプレ or CSS を直す

---

## CATALOG 更新のチートシート

| 変更の種類 | 必要コマンド |
|-----------|-------------|
| tokens.js の色・サイズ値を変えた | `node scripts/generate-catalog.js` |
| themes.js のテーマ定義を変えた | `node scripts/generate-catalog.js` |
| slide-patterns.md / diagram-patterns.md を更新 | `node scripts/generate-catalog.js` |
| example-deck.js のテンプレコードを編集 | `bash scripts/refresh-catalog-previews.sh && node scripts/generate-catalog.js` |
| diagram-patterns.js のダイアグラムコードを編集 | 同上 |
| assets/logos/ の画像を差し替え | `node scripts/generate-catalog.js` |
| 新テンプレ (COMPARE-2) を追加 | `bash scripts/refresh-catalog-previews.sh && node scripts/generate-catalog.js` |

---

## 新パーツ追加時のチェックリスト

新しいスライドテンプレ (例: LIST-10) / DIAG-XX (ダイアグラム) / CHART-XX (チャート部品) /
SCENE-XX (シーン) を追加する時は、build-deck.js への登録忘れが起きやすいので
**チェックリスト化** している。

### スライドテンプレ追加 (例: VISUAL-9 を新設)

```
✅ 必須:
  1. scripts/render/templates/visual/visual-9-xxx.js  ← 描画関数 (renderVisual9Xxx を export)
  2. scripts/render/build-deck.js                    ← import + TEMPLATE_REGISTRY 追加
       const { renderVisual9Xxx } = require('./templates/visual/visual-9-xxx');
       'VISUAL-9': renderVisual9Xxx,
  3. references/_common/slide-patterns.md            ← 該当カテゴリ表に 1 行追加
  4. SKILL.md                                        ← スライドパターン一覧に追加 (ある場合)

⚠️ 該当する場合だけ更新:
  5. scripts/schema-qa.py                            ← 必須フィールド検証を追加 (該当時)
  6. scripts/render-deck-instruction.py              ← Phase 2 HTML 指示書のテンプレ表示 (該当時)
  7. scripts/render/build-catalog.js                 ← CATALOG にサンプルスライドを追加
  8. assets/template-previews/VISUAL-9.jpg             ← refresh-catalog-previews.sh で生成
```

### ダイアグラム追加 (例: DIAG-10 を新設)

```
✅ 必須:
  1. scripts/render/diagrams/diag-10-xxx.js          ← drawDIAG10Xxx を export
  2. scripts/render/build-deck.js                    ← import + DIAGRAM_REGISTRY 追加
  3. references/_common/diagram-patterns.md          ← 1 行追加
  4. references/_common/diagram-expression-patterns.md ← 原子要素仕様を追加
  5. SKILL.md                                        ← ダイアグラム一覧
```

### チャート追加 (例: CHART-10 を新設)

```
✅ 必須:
  1. scripts/render/charts/chart-10-xxx.js          ← drawCHART10Xxx を export
  2. scripts/render/build-deck.js                    ← import + CHART_REGISTRY 追加
  3. references/_common/chart-patterns.md            ← チャート種別表に 1 行追加
  4. SKILL.md                                        ← チャートパターン一覧 (ある場合)
```

### シーン追加 (例: SCENE-04 を新設)

```
✅ 必須:
  1. scripts/render/scenes/scene-04-xxx.js          ← drawScene04Xxx を export
                                                       atoms-shape の関数だけで組む
  2. scripts/render/build-deck.js                    ← import + SCENE_REGISTRY 追加
       const { drawScene04Xxx } = require('./scenes/scene-04-xxx');
       'SCENE-04': drawScene04Xxx,
  3. references/_common/scene-patterns.md            ← シーン表に 1 行追加
  4. SKILL.md                                        ← シーンパターン一覧 (ある場合)
```

⚠️ shape を直接 `slide.addShape` で呼ばず、`atoms-shape.js` の関数経由で
描くこと。色トークンの統一 / テーマ切替 / フォント指定が壊れる。

### 自動チェックの方法

追加後、こんな雑な 1 枚デッキ JSON を投げて build-deck.js が通るか試すのが
最速の sanity check:

```json
{
  "doc": { "title": "smoke", "theme": "mono" },
  "sections": [{
    "id": "t", "name": "test",
    "slides": [{ "id": "S1", "template_id": "VISUAL-9", "title": "...", ... }]
  }]
}
```

`未登録テンプレ "VISUAL-9"` の警告が出たら build-deck.js への登録を忘れている。
チャートなら CHART-A1 経由で `chart: { template_id: "CHART-10", ... }` を渡せばよい。

### 「直し忘れ」が起きやすい順位ランキング

過去のヒヤリハットで多い順:

1. **build-deck.js の TEMPLATE_REGISTRY / DIAGRAM_REGISTRY / CHART_REGISTRY** —
   import を書いたのに registry エントリを足し忘れる。逆もまた然り
2. **slide-patterns.md / diagram-patterns.md / chart-patterns.md** — 描画は動く
   が「Phase 2 のテンプレ選定で見つからない」状態に陥る
3. **schema-qa.py** — 必須フィールド検証が無いまま運用に入って、JSON のミスが
   render エラーで初めて顕在化する
4. **CATALOG (build-catalog.js / refresh-catalog-previews.sh)** — 人間が
   ブラウザで全テンプレを確認したいときに「新テンプレが映らない」状態になる

### 修正後に必ず走らせるコマンド

```bash
# 1. ビルド sanity (smoke デッキで)
export NODE_PATH=/usr/local/lib/node_modules_global/lib/node_modules
node scripts/render/build-deck.js -i smoke.json -o /tmp/smoke.pptx

# 2. CATALOG 更新 (該当時)
node scripts/generate-catalog.js
# 新テンプレを追加した場合のみ:
bash scripts/refresh-catalog-previews.sh

# 3. CHANGELOG.md / SKILL.md の version 反映 (記述更新のみ。必須)
```

### Mode B 5 ステップとの対応

```
Step 1 スコープ把握  → 上記チェックリストの何ファイルを触るか宣言
Step 2 ソース編集    → ファイルを順に書き換え (自動チェック含む)
Step 3 ビジュアルチェック → 新テンプレを使った 1 枚デッキを PNG 化して提示
Step 4 ユーザー承認   → 承認なしで commit しない
Step 5 CATALOG 更新   → 上記コマンドを順番に実行
```
