# Visual QA — 最終ビジュアルの検査ルール

> **Phase 3 完了後（draft.pptx 生成済み）に、PNG 化したスライドを 1 枚ずつ目視し、
> 全 VQA ルールを照合する**。違反があればコードを修正してから次のスライドへ。

---

## 走査フロー

```
Step 1. pptx を PNG 群に変換 (pptx-to-images.sh)
Step 2. コンタクトシートで全体俯瞰 (montage で 1 枚に集約 → view 1 回)
Step 3. 問題ありそうなスライドだけを 1 枚ずつ view → VQA を照合
Step 4. 違反があればコードを str_replace で修正 → Step 1 から再実行
Step 5. 違反 0 件になったらユーザーに pptx を提示 → 明示承認待ち
```

並列化は `_common/parallel-execution.md` 参照（コンタクトシート方式は必須）。
**「全スライドを通読してください」とユーザーに丸投げしない**。

---

## カテゴリ別ルール

ルールはカテゴリ A〜F に分類されている。検査時は **カテゴリ A（最頻出のはみ出し）から
順に** 全スライドを走査する。重大な違反から潰すことで再走査回数を抑える。

| カテゴリ | 検査対象 | ルール |
|---|---|---|
| **A. テキストはみ出し** | シェイプ越え・折り返し崩れ | VQA-01〜03 |
| **B. コンテンツエリア逸脱** | 座標範囲・領域衝突 | VQA-04〜05 |
| **C. レイヤー・視認性** | 重なり・隠れ | VQA-06〜07 |
| **D. テーマ一貫性** | フォント・色・横文字 | VQA-08〜09 |
| **E. ナビ・参照構造** | ナビチップ・インライン参照表示 | VQA-10〜12 |
| **F. グラフィック要素** | チャート / ダイアグラム / シーン / shape | VQA-13〜25 |

---

## カテゴリ A — テキストはみ出し（最重点・最頻出）

### VQA-01: シェイプ境界を越えた文字

**[Trigger]**
Text content shall stay within its shape boundary (rectangle, pentagon, circle,
trapezoid, card frame). No character shall protrude beyond the shape edge.

**[Anti-pattern]**
× ペンタゴン矢印の右端で「重要」の「要」が欠ける
× 円形ノード内で「DX 推進」が枠外にはみ出す
× 台形ピラミッド層の左右で文字が切れる
× カード枠と文字の隙間が 0.05" 以下まで接近している

**[Exceptions]**
- VISUAL-3（ビジュアル主体）の意図的なフルブリードレイアウト

**[Fix]**
1. シェイプ width を拡大、または padding を増やす
2. `shrinkText: true` を付ける（自動縮小）
3. フォントを 0.5pt〜1pt 下げる
4. ラベル文言を短縮する（最終手段）

### VQA-02: タイトル / サブコピーの下方向オーバーフロー

**[Trigger]**
Title and subtitle text shall not overflow downward into the content area.
The title block bottom (returned by `addTitleBlock`) shall be respected by
all subsequent content placement.

**[Anti-pattern]**
× タイトル「〜の〜」が 3 行に折り返され、サブコピーと重なっている
× サブコピー帯が予想より高くなり、本文の最初のカードを覆い隠している
× 本文 y 座標を `addTitleBlock` の戻り値で受けず、固定値で書いている

**[Exceptions]**
- 表紙・閉じ・セクション扉・ビジュアル主体（ナビなし系）

**[Fix]**
1. `addTitleBlock` の戻り値（bottomY）を変数で受ける
2. 本文 y 座標を bottomY + 0.10" でスタートさせる
3. タイトル文言を短縮 or フォントサイズを 20pt → 18pt に下げる
4. 1 行サブコピー想定なら `L.contentY = 1.65`、2 行想定なら `L.contentYRoomy = 1.95` を使う

### VQA-03: テーブルセル内の長文はみ出し

**[Trigger]**
Table cells (DATA-2 / DATA-4 など) shall fit text within cell width
without horizontal clipping or excessive line breaks.

**[Anti-pattern]**
× DATA-4 ref_table の URL 列で 1 行 URL が右端で切れる
× DATA-2 データテーブルの 1 セルだけ 4 行に折り返される
× セル padding が極端に小さく、文字とセル境界が密着している

**[Fix]**
1. 列幅を再配分（タイトル列を狭め URL 列を広めに）
2. URL は `(N)` 形式のインライン参照に切り出して、表は表題のみにする
3. セル内文言の改行ポイントを `\n` で明示

---

## カテゴリ B — コンテンツエリア逸脱

### VQA-04: 座標範囲の遵守（ナビあり）

**[Trigger]**
For navigated body slides, all content elements shall fit within
y: 1.60〜5.10 (or contentYRoomy 1.95〜5.10) and x: 0.40〜9.60.

**[Anti-pattern]**
× カードの上端が y=1.50 で、タイトルブロックと重なる
× 右端要素が x=9.65 まで伸びてマージン違反
× 下端要素が y=5.20 まで伸びてフッター領域に入っている

**[Exceptions]**
- ナビなし系（表紙・閉じ・セクション扉・ビジュアル主体）はそれぞれの座標規約に従う

**[Fix]**
1. 各要素の `x, y, w, h` を再計算
2. 0.40〜9.60 / 1.60〜5.10 を厳守
3. 要素同士の gap は 0.10〜0.22 確保

### VQA-05: タイトルブロックと本文の重なり

**[Trigger]**
The title block (eyebrow + title + subtitle) and the body content shall not
overlap. Use `addTitleBlock`'s return value to dynamically shift the body
when subtitle exceeds 1 line.

**[Anti-pattern]**
× サブコピー 3 行のスライドで、本文が y=1.65 固定のまま title block と衝突
× title block の高さを変数で受けず、本文位置がハードコードされている

**[Fix]**
1. `const bottomY = addTitleBlock(slide, title, sub, opts);` で戻り値を受ける
2. 本文の y 座標を `bottomY + 0.10` で計算
3. 各テンプレート関数のシグネチャに対応していることを確認

---

## カテゴリ C — レイヤー・視認性

### VQA-06: クローム要素との衝突回避

**[Trigger]**
Left strip (x=0〜0.12), right-top logo, navigation chips, and footer
shall not be obscured by content elements.

**[Anti-pattern]**
× 左端カードが x=0.10 から始まり、左ストライプを覆っている
× ロゴ位置（右上）にナビチップが被っている
× 脚注（y=5.10〜5.30）と本文最下段が重なっている
× 矢印・コネクタが他要素の下に隠れている

**[Exceptions]**
- VISUAL-3（ビジュアル主体）の意図的なフルブリードでは左ストライプを覆ってよい

**[Fix]**
1. コンテンツ x の最小値を 0.40 に変更
2. ロゴ位置を確認 → ナビチップを左にシフト
3. 脚注領域を避けて本文最下段を y=5.05 まで切り上げる
4. 矢印・コネクタは shape.zOrder を上げる、または描画順を後にする

### VQA-07: 重なり・隠れの検出

**[Trigger]**
No element shall be partially or fully hidden behind another element
unless it's an intentional overlay (e.g., 数字バッジ on カード).

**[Anti-pattern]**
× カードの背景が darkBlue で、本文文字が #1A1A1A → コントラスト不足で読めない
× ベタ塗り図形の上に文字を載せたが文字色が暗く埋もれる
× 重なり順が逆で、装飾要素が本文を覆っている

**[Exceptions]**
- 数字バッジ・ステップ番号など意図的な重ね配置

**[Fix]**
1. 背景色 vs 文字色のコントラスト比を確認（最低 4.5:1）
2. 暗い背景には白文字、明るい背景には黒文字
3. shape の描画順を整理（背景 → 装飾 → テキストの順）

---

## カテゴリ D — テーマ一貫性

### VQA-08: フォント統一

**[Trigger]**
All text elements across all slides shall use `fontFace: "Noto Sans JP"`.
LibreOffice may fallback to Noto Sans CJK JP at PNG render time, but the
source code shall always declare Noto Sans JP.

**[Anti-pattern]**
× 一部スライドで `fontFace` 指定漏れ → デフォルトフォントになる
× 「ヒラギノ」「游ゴシック」「メイリオ」など別フォントが混入

**[Fix]**
1. grep で `fontFace` 指定漏れを検出
2. 全テキスト要素に `fontFace: "Noto Sans JP"` を付与
3. PNG レンダ時の Noto Sans CJK JP フォールバックは正常 — コード側は Noto Sans JP のまま

### VQA-09: カラーテーマ・横文字の混入

**[Trigger]**
Colors shall come from `tokens.js` (no hardcoded hex), and decorative
English/katakana labels shall be replaced with Japanese.

**[Anti-pattern]**
× ハードコード hex `#FF6B6B` がコード内に残っている
× eyebrow に "STEP 01" / "FEATURE A" など横文字が残っている

**[Exceptions]**
- 固有名詞（「FactHub」「BigQuery」「OpenAI」等）
- 識別用の番号（「①」など順序提示の文字）

**[Fix]**
1. grep で `#[0-9A-Fa-f]{6}` を検索 → tokens.js の参照に置換
2. テーマ切替後は全スライドで色トークン参照を確認
3. 横文字ラベルを日本語化

---

## カテゴリ E — ナビ・参照構造

### VQA-10: ナビチップの整合性

**[Trigger]**
Body slides shall display the navigation chip at the top, with the current
section highlighted. Cover, TOC, section divider, closing, and visual-main
slides shall NOT have a navigation chip.

**[Anti-pattern]**
× 本編スライドにナビチップがついていない
× ナビの「現在位置」ハイライトが間違ったセクションに当たっている
× 表紙にもナビチップが残っている

**[Exceptions]**
- 表紙 / セクション扉 / 閉じ / ビジュアル主体（ナビなしテンプレ）

**[Fix]**
1. 各本編スライドの先頭で `addChromeWithNav(s, pageNum, sectionIdx, subsectionName)` を呼ぶ
2. ナビなしテンプレでは `addChromeLeftStrip(s)` のみを呼び、ナビチップは出さない
3. セクション数 6 以上では `[ 3 / 8  解決策 ]` 型のシンプル版に自動切替

### VQA-11: ページ番号の表示

**[Trigger]**
The footer shall display page numbers in `XX / 総ページ数` format
on all body slides. Cover and section dividers may omit them.

**[Anti-pattern]**
× ページ番号フォーマットが `XX/total` のように `/` 周辺の空白がない
× 表紙にページ番号「1 / N」が表示されている
× ページ番号が分母（総ページ数）と一致していない（途中スライド削除後の取り残し）

**[Fix]**
1. ページ番号生成ヘルパー（addFooter 系）の引数を確認
2. 総ページ数（pres.slides.length）を動的に取得
3. 表紙ではフッター自体を出さないオプションを使う

### VQA-12: インライン参照の視覚的整合

**[Trigger]**
Inline citations `(N)` in body text shall be rendered as blue hyperlinks,
1pt smaller than surrounding body text, and shall match the row numbers in
DATA-4's ref_table.

**[Anti-pattern]**
× インライン `(1)` が黒文字のままハイパーリンク化されていない
× インライン参照が本文と同じフォントサイズで識別しにくい
× DATA-4 のタイトル列が青文字リンクになっていない（参考情報集ページ自体）
× 本文の `(3)` と DATA-4 の `(3)` 行が違う出典を指している（RefQA-05 検出漏れ）

**[Fix]**
1. インライン参照の色を `C.linkBlue`（または tokens 内 link 用色）に変更
2. フォントサイズを本文 -1pt に下げる
3. DATA-4 のタイトル列に `hyperlink: { url: ... }` を付与
4. 本文番号 ↔ DATA-4 行番号の対応を再確認（RefQA-05 を再走査）

---

## カテゴリ F — グラフィック要素（CHART / DIAG / SCENE / shape）

CHART テンプレ / DIAGRAM-4 (セクション挿絵) や、`atoms-shape.js` で組まれた shape シーンに
固有の不具合を検出する。描画ロジックが複雑で、テキスト系の VQA-01〜12 では拾いきれない
クラスの問題を別カテゴリで管理する。

### VQA-13: チャートの読み取り可能性

**[Trigger]**
Charts in CHART-A1/A2/A3/A4 must be readable: legible series colors, distinct
labels, no clipped numbers, axis labels visible. Multi-series charts must use
the chartPalette (brand → accent → ...) so that series are distinguishable
even on mono theme.

**[Anti-pattern]**
× CHART-01 で 2 系列ともに黒で塗られて凡例が判別できない
× CHART-06 ウォーターフォールでデータラベル「0」がベース系列の上に表示される
× CHART-07 ドーナツの凡例ラベルが折り返して切れている
× CHART-04 折れ線で smooth=true になっており曲線が「データを丸めて」見える
× CHART-XX のフォントが Noto Sans JP ではなく既定フォントになっている
× データラベルが棒の頂点で「outEnd」のはずがバー内側に潜り込む
× アンバー (accent) の薄塗りでバーの輪郭が背景に消える

**[Exceptions]**
- 1 系列のチャートでは brand 1 色のみ
- CHART-A4 のドーナツは領域が狭く小さくなる (chart-patterns.md の既知制約)

**[Fix]**
1. `_chart-style.js` の `chartPalette` を使っているか確認 (直書き禁止)
2. CHART-XX の `fontFace: F.jp` が全テキスト要素 (軸/凡例/ラベル) に効いているか
3. `lineSmooth: false` を CHART-04 で確認 (コンサル流儀)
4. CHART-06 のベース系列に `showValue: false` が効いているか、ラベルは shape ベースで別描画されているか
5. ドーナツが小さすぎる場合は CHART-A1 (単体) または CHART-A2 (左+右テキスト) に切り替え

### VQA-14: ダイアグラムの構造整合性

**[Trigger]**
Diagrams (DIAG-XX) embedded inside DIAGRAM-4 illustration area must render with
all expected elements: cycle has 4 nodes, pyramid has 3+ layers, before/after
shows both halves, scatter has plotted dots within axis range.

**[Anti-pattern]**
× DIAG-02 サイクル図で nodes が 0 件、または 4 個でない (要件は ちょうど 4 件)
× DIAG-04 Before/After の左右ブロック高さが揃わずレイアウトがガタつく
× DIAG-09 散布図の点が軸範囲を超えてプロット枠外に出ている
× DIAG-06 タイムラインで at_label と title が同じ位置に重なる (上下交互のロジック破綻)

**[Exceptions]**
- DIAGRAM-4 が極端に狭い領域の場合 DIAG-06 のテキストが密集するのは仕様

**[Fix]**
1. JSON のフィールド名が DIAG ごとの仕様 (`nodes` / `events` / `before`+`after` / `levels` / `items` / `axes`) と一致しているか `diagram-patterns.md` で確認
2. DIAG-06 はステージ数が 4 以下なら DIAG-03 (ステップアップ) に置き換え検討

### VQA-15: シーン挿絵の整合性

**[Trigger]**
Scene illustrations rendered via SCENE-XX or hand-built with atoms-shape
must keep all components inside the assigned area. Connectors (arrow/link)
must visually link the two endpoints they intend to connect, not cross
through unrelated nodes. Labels stay attached to their target.

**[Anti-pattern]**
× SCENE-02 ハブ&スポークの sub ラベルがビジュアル枠外に飛び出す
× SCENE-04 で top/bottom アクターのラベルが中央プラットフォームのヘッダーバーと重なる
× SCENE-05 で request/response の往復矢印が同じ高さに重なって読めない
× drawArrow で `endArrowType: 'triangle'` が効かず線だけになる (PowerPoint レンダリング差異)
× drawMoneyFlow の ¥ ラベルバッジが矢印中点ではなく端点に表示される
× drawBoundary の点線フレームの中にアクター本体が入り込み、境界の意味が壊れる
× SCENE-XX で `chartPalette` 経由でない直書き hex が使われている (テーマ切替不能)

**[Exceptions]**
- 大きなシーンを意図的に枠外に飛び出させる演出 (VISUAL-3 ビジュアル主体)

**[Fix]**
1. atoms-shape の関数経由で描いているか (slide.addShape を直接呼んでいないか)
2. 色は全てトークンキー (`'brand'` / `'accent'`) で渡しているか (hex 直書き禁止)
3. SCENE-04 / SCENE-05 のラベル衝突は既知の対処法を `scene-patterns.md` で確認 (top/bottom 距離拡大、yOffset 拡大、boundary padding 調整)
4. アンカーは drawNode 等が返す `{cx, cy, top, bottom, left, right}` を使い、ハードコード座標で連結しない

### VQA-16: shape Atom レイヤーのトークン整合

**[Trigger]**
Custom shape illustrations built directly with atoms-shape (without going
through SCENE-XX) must still respect ENOSTECH brand tokens: colors come from
the palette via `_resolveColor`, fonts are Noto Sans JP, dimensions are
within `L.marginX` / `L.contentY` constraints.

**[Anti-pattern]**
× カスタム挿絵で `slide.addShape(pres.shapes.RECTANGLE, { fill: { color: '#FF0000' } })` のようにテーマトークンを経由しない hex 直書き
× drawCallout の bg 色を `'#F2ECFA'` のように hex で渡している (`'brandSoft'` を使うべき)
× atoms-shape を呼ばずに `slide.addText` を直で書いて `fontFace: 'Arial'` 等にしている

**[Exceptions]**
- `chartPalette` が定義する CHART_SLATE (#2A2D34) のような「チャート専用の hex 定数」は意図的なので OK (mono テーマ専用ガード経由でのみ適用)

**[Fix]**
1. atoms-shape の関数 (drawNode / drawLink / drawCallout 等) を経由する
2. 色は文字列キー (`'brand'`, `'accent'`, `'gray500'`) で渡し、`_resolveColor(C, key)` が解決する設計に従う

### VQA-17: サブコピー背景の高さが実描画文字数と整合

**[Trigger]**
薄紫サブコピー背景カード (addTitleBlock の band style) の高さが、実際に
レンダリングされたサブコピーテキストの行数と整合している。タイトル直下に
不自然な空白 (subcopy 背景の終端と本文先頭の間が 0.5" 以上空く) が無いこと。

**[Anti-pattern]**
× サブコピーが 1〜2 行しかないのに、背景カードが 3〜4 行ぶんの高さで描画され、タイトル直下に巨大な空白ができている
× 逆に、サブコピーが 4 行ぶん必要なのに背景カードが 2 行ぶんで、テキストが背景カードからはみ出している
× サブコピー背景の余白が広すぎて本文 (カード/箇条書き) が画面下に追いやられ、コンテンツ領域が狭くなっている

**[Exceptions]**
- FRAMING-1 (構築背景) / FRAMING-2 (Before/After リスト) / SECTION-6 (目次) など、サブコピー高さが固定設計のテンプレ
- 表紙 (SECTION-1) / 章扉 (SECTION-2/4/5) はサブコピー背景自体を使わない

**[Fix]**
1. 該当スライドの `subtitle` の文字数を確認 (50字基準で行数算出)
2. PNG で実際の描画行数と背景カードの高さを目視比較
3. 不整合が大きい場合 (空白 0.5" 以上 or はみ出し) は plan.json の subtitle を推奨 120-200 字 (R2-4) に再構成して再ビルド

### VQA-18: DATA-4 参考情報集がフッター領域を侵食していない

**[Trigger]**
DATA-4 (参考情報集) スライドのテーブル末尾が、ページ番号 (footerY=5.28") の
表示位置を侵食していない。テーブル下端と ENOSTECH ロゴ・ページ番号が
視認上クリーンに分離されている。

**[Anti-pattern]**
× ref_table が 10 行以上で、テーブル最終行とページ番号 (例: 「20/22」) が重なって読めない
× 行数を増やしすぎて、フットノート (`atoms.addFootnote`) と本文テーブルが重なる
× SchemaQA-09 が warn を出しているのに自動分割の挙動を確認していない

**[Exceptions]**
- なし — 参考情報集は読者が後追い検証する重要ページ。表示崩れは絶対回避

**[Fix]**
1. ref_table の行数を確認 — `DATA4_MAX_ROWS_PER_PAGE = 8` を超えていれば build-deck.js が自動分割しているはず (PNG で複数枚の DATA-4 が出力されているか確認)
2. 1 ページに 9 行収まっているのに被りが発生している場合は、フッター領域 (5.28") の y 座標と addTable の rowH が想定通りか build-deck.js / eno-30-references.js を再確認
3. 引用元を整理して本文で実際に参照していないものは削る (RefQA-05 で本文 (N) と ref_table の対応を取り直す)

### VQA-19: タイトル/見出しの折返しが本文や周辺要素と被っていない

**[Trigger]**
カード型/カラム型テンプレ (LIST-2 / LIST-3 / LIST-5/6/7 / LIST-9 等) の
タイトル領域が固定高さで設計されているため、想定文字数を超えて折返しが発生
すると、その下の本文や tag と物理的に重なる。Phase 2 で SchemaQA-11 が
warn/fatal を出した時は必ず PNG で個別目視確認する。

**[Anti-pattern]**
× LIST-2 で `cols[].title` が 14 字超 → タイトル領域 (h=0.45 / fontSize 17pt) を 1 行で収まらず 2 行に折返し → 下の本文 (y=topY+1.05) と被る
× LIST-3 で `items[].name` が 12 字超 → タイトル領域 (h=0.32 / fontSize 15pt) からはみ出し、tag バッジや desc と接近してギチギチに見える
× FRAMING-2 で `items[].before` / `items[].after` がカラム幅 (Before 4.20 / After 3.55) を超えて折返し → 「Before」ラベルと本文が分断、後半項目で起きやすい

**[Exceptions]**
- SchemaQA-11 が pass している場合 (推奨上限以内) は通常問題ない
- 英字/数字主体で全角換算より短く描画されるケースはセーフ
- アクセプト判断: SchemaQA-11 warn が出ていても PNG 目視で破綻していなければ放置 OK

**[Fix]**
1. SchemaQA-11 fatal が出ている → 必ず短縮 (同義の短表現、別カードに分割、別テンプレ LIST-8 等への変更)
2. SchemaQA-11 warn → PNG で実描画確認、被りが発生していれば短縮
3. 構造的にどうしても文字数が必要なら LIST-1 (標準コンテンツ) や LIST-8 (詳細カード) のような縦広い領域のテンプレに変更
4. タイトルに英字 (Declarative / Reproducible) を入れる時は全角混在を避け、日本語短縮版だけにする選択肢もあり

### VQA-20: LIST-1 bullets が次 bullet と被っていない

**[Trigger]**
LIST-1 標準コンテンツの `bullets[].body` が長すぎる (200 字超 = 12pt で約 4 行
以上に折返し) と、固定 `rowH` を超えて下に伸び、次の bullet head と物理的に
被る。特にコード文字列や URL を bullet body に詰めると顕在化する。

**[Anti-pattern]**
× `bullets[0].body` に 267 字のコード文字列 (`{ inputs.nixpkgs.url = ...`) を入れて、次の bullet head 「ターミナルでの起動」と被る
× 1 つの bullet body が 4 行を超えて折返し、3 つ目以降の bullet が画面下端を突き抜ける

**[Exceptions]**
- bullet 数が 1-2 個で他 bullet との衝突リスクが無い場合
- SchemaQA-11 が pass (200 字以内) の場合

**[Fix]**
1. 200 字超のコード/長文は **LIST-1 の bullets ではなく LIST-8 (詳細カード) や VISUAL-3 (ビジュアル主体) に移し替える**
2. コードを 1 行サマリー + 別ファイル参照にする
3. 1 つの bullet を 2-3 個に分割する (1 bullet = 1 メッセージの原則)
4. SchemaQA-11 の warn / fatal メッセージに従って Phase 2 段階で短縮

### VQA-21: CODE-7 ツリーの右コメントが本体と被っていない

**[Trigger]**
CODE-7 (ディレクトリツリー) の `tree.root[*].comment` に **日本語** を入れると、
コメントは `JetBrains Mono` フォントで描画されようとするが Mono が日本語グリフを
持たないため、レンダラがフォールバック (Noto Sans JP) で描いた結果、想定より
横幅が大きくなる。これにより:
- コメントがコメント領域 (右 38%) を超えてツリー本体に重なる
- コメントが上下に折返し、隣接行のコメントと縦に重なる
- ツリー本体の name 列が右に伸びる場合は、name とコメントが被る

PNG 目視で「右側のコメントが斜め線で重なって読めない」「同じ行に 2 つの
コメントが見える」状態になっていれば検出。

**[Anti-pattern]**
× `comment: "ソース 1:1 受け皿 (stg_users.sql / stg_orders.sql ...)"` のように日本語 + 英記号混在で 25 字超
× 同列の `comment` で日本語の長さが揃わず、折返し有無が行ごとに異なる
× `name` が `_time_spine.sql` のように 14 字超で、左ツリー領域 (62%) を超えてコメント領域に侵入

**[Exceptions]**
- すべての `comment` が英字のみ + 20 字以内なら Mono で描画され、ほぼ崩れない
- コメントを完全に省略 (`comment: undefined`) する運用なら問題なし

**[Fix]**
1. **第一選択**: 日本語コメントが避けられないなら CODE-7 を諦め、CODE-1 で YAML / シェル風のディレクトリ表記に置き換える (折返し制御がしやすい)
2. コメントを 12 字以内の体言止めに圧縮
3. ツリーのネスト深度を 2 段までに抑え、`prefixW` の計算誤差を減らす

### VQA-22: CODE-5 のコードブロックが消失 / 隣接ステップと被っていない

**[Trigger]**
CODE-5 (ステップ実行) で `steps[].code.body` が長く (8 行以上 / fontSize 11pt
で 1.44" 超)、かつ `steps.length === 4` で 1 ステップあたり利用可能高 ≈ 0.94"
のとき、コードブロックの実描画高さが領域を超えて下のステップヘッダー / note と
被る。さらに:
- code body が空文字 / null だと code-block-atom が ヘッダーだけ出して本体を描かないため、ヘッダー (灰帯) と note (下の説明文) が密着して「コードが消えた」ように見える
- `note` が長すぎる (45 字超) と note 自体が 2 行折返しし、次ステップの番号バッジと縦に被る

**[Anti-pattern]**
× steps × 4 + 各 code が 6 行超の YAML / SQL を入れる
× code body の改行が原文ママで 10 行 → 領域 0.5" を 3 倍超過
× note を 2 行分書く (45 字超) → 番号バッジと縦に被る
× `code: {}` (空) で出すと描画消失

**[Exceptions]**
- steps を 2-3 個に絞れば 1 ステップあたり 1.4-2.0" 確保でき、6-8 行コードまで許容できる
- code 自体を short にし、解説は `note` に逃がす運用なら 4 ステップでも安全

**[Fix]**
1. **第一選択**: `steps.length` を 3 以下に減らす
2. 各 `code.body` を 4 行以内に圧縮 (詳細は CODE-1 / CODE-3 別スライドへ分割)
3. `note` は 35 字以内・1 行で書き切る
4. code に余裕がない場合は CODE-5 を諦め、`title + bullet` の LIST-1 に置換

### VQA-23: 比較表系テンプレの文字あふれ・不自然な改行・はみ出し

**[Trigger]**
COMPARE-1 / COMPARE-3 / COMPARE-5 / COMPARE-6 など比較表系テンプレで、
セル内テキストが描画領域を超えて以下の状態になる:

- セル幅の中央で日本語文字列が **強制改行** され読めなくなる
- 文字列が **隣接セルや枠線にめり込む**
- 行高を超えて **下のセルに被る**
- 列見出し (cols 配列) が枠から飛び出して タイトルバンドと被る

PNG 目視で「セル内のテキストが途中で切れている」「2 つのセルの文字が
重なって見える」状態になっていれば検出。**比較表系のスライドは PNG 目視で
全セル個別に確認すること**。

**[Anti-pattern]**
× COMPARE-3 cols = ["GCS バケット","BigQuery JSON 列","Vertex AI Datastore"] で 3 列とも見出しが折り返して 2 行に → ヘッダー高 0.45 を貫通
× COMPARE-3 matrix セルに "BigQuery Data Agent / SQL 内" (15字) を入れて fontSize 18 のまま描画 → セル幅 2.4 inch を貫通して隣接セルに重なる
× COMPARE-1 items[].before に "BI ツール内のクエリ (Claude / BigQuery Data Agent / Redash 各々)" (35字) を入れて fontSize 14 のまま描画 → 値カードを縦に貫通して隣接行に被る

**[Exceptions]**
- 動的フォント縮小で fontSize 9-10 まで落ちると warn は出るが描画は通る
- COMPARE-3 で評価記号 (◎○△×) のみ使う本来想定の使い方なら問題なし

**[Fix]**
1. **第一選択**: 文字数を Zod schema 上限以下に短縮する (COMPARE-1: before/after 20字 / COMPARE-3: cols 15字, セル 20字)
2. 推奨上限 (COMPARE-1: 12字 / COMPARE-3: cols 8字, セル 12字) を超えるなら、よりリッチな比較テンプレ (COMPARE-5 グルーピング / COMPARE-6 マーク+補足) への切り替えを検討
3. cols が 4 つ以上ある時は 1 列あたりの幅が狭まるので、上限はさらに厳しい (8字以内) を意識
4. Zod fatal が出たら必ず短縮、warn だけなら PNG 目視で確認して破綻していれば短縮

#### 比較表系の事前チェックリスト

比較表を含むスライドは Phase 4 PNG 目視で **必ず以下のチェック** を行う:

- [ ] cols 配列の各見出しがセル枠内に収まっているか (折返ししていないか)
- [ ] matrix の各セルの文字が隣接セルにめり込んでいないか
- [ ] 行高が均等で、特定の行が縦に膨らんでいないか
- [ ] 値カード (COMPARE-1) の before/after テキストが枠内に収まっているか
- [ ] 矢印 (→) が値カードと重なっていないか

build-deck.js のログに `[COMPARE-1] ... 推奨上限 N 字` `[COMPARE-3] ... 推奨上限 N 字` の
warn が出ていたら、その時点で plan.json で短縮するか、別テンプレへ切り替えること。

### VQA-24: PROJECT-1 / SCENE-06 vertical-decision の文字溢れ・ノード被り

**[Trigger]**
PROJECT-1 (フェーズフロー) で各カードの本文 (body) 領域から文字がはみ出して
アウトプット欄に侵食する、または SCENE-06 vertical-decision で菱形ノード内の
ラベルが菱形の枠を貫通して隣接矢印に被る状態。

PNG 目視で:
- PROJECT-1: phases カードの「body」と「アウトプット」ラベルが上下に重なっている
- PROJECT-1: 「アウトプット」見出しが本文の最終行と被っている
- SCENE-06: 菱形 (decision) のラベル文字が菱形からはみ出している
- SCENE-06: ステップ間の YES/NO ピルが上下のノードと被っている
- SCENE-06: 菱形が縦に潰れて文字が極端に縮んで読めない

**[Anti-pattern]**
× PROJECT-1 で phases 5 個 + body 60 字超 (5 列で本文領域 0.7 inch を貫通)
× SCENE-06 vertical-decision で steps 5 個以上 (菱形が縦に潰れて文字溢れ)
× SCENE-06 で decision label が 16 字超 (菱形内に収まらない)
× PROJECT-1 で title が 14 字超 + 5 列 (列幅 1.6 inch を貫通)

**[Exceptions]**
- 動的フォントサイズ縮小でフォントが 8-9pt まで落ちると、warn は出るが描画は通る。ただし読みやすさは劣化するため、Phase 4 PNG 目視で「読めない」と判断したら短縮または別ページ分割すること。

**[Fix]**
1. **第一選択** (SCENE-06 vertical-decision): steps が 5 個以上なら **意思決定木を 2 つに分割して別ページに**。本来 1 つの判断ロジックで 5 段以上は読み手の認知負荷が高すぎる
2. **第一選択** (PROJECT-1): phases 5 列なら body は 50 字以内、title は 12 字以内に抑える。守れないなら 4 列構成に減らす
3. SCENE-06 の decision label は **15 字以内のキーワード** に圧縮
4. PROJECT-1 の各 phase 本文を `output` フィールドに分けて軽くするのも有効

#### フェーズフロー / FlowChart の事前チェックリスト

これらのテンプレを含むスライドは **必ず PNG 目視** で以下を確認:

- [ ] PROJECT-1: 各カードの body と「アウトプット」見出しが視覚的に分離している
- [ ] PROJECT-1: title が枠内に 1 行で収まっている (折返ししていない)
- [ ] SCENE-06 vertical-decision: 菱形ノード内のラベルが枠内に収まっている
- [ ] SCENE-06 vertical-decision: steps が **4 個以下** である
- [ ] SCENE-06: YES/NO ピルが上下ノードや矢印と重なっていない
- [ ] SCENE-06: side_results が main フローと重ならず右側に整列している

build-deck.js のログで `[PROJECT-1] ...` `[SCENE-06] ...` の warn が出たら、
その時点で plan.json で短縮するか別テンプレへ。fatal が出たら必ず修正。

### VQA-25: LIST-4 / LIST-1 / LIST-3 カード積み系の隣接カード重なり (fatal)

**[Trigger]**
LIST-4 (縦カード積み)、LIST-1 (content 拡張) や LIST-3 (cardgrid) など、
**複数カードを縦/グリッドに並べるテンプレ** で、隣接カードの bounding box が
overlap している状態。具体的には PNG 目視で:

- 番号バッジ (01/02/03/04) の文字が隣のカードヘッダー領域に **めり込み**、バッジとタイトルが視覚的に重なる
- 本文テキストが **下のカードのタイトル行を横切る** / 上のカード末尾と被る
- タイトル行の最初の 1 文字 (例: 「LlmAgent」の "L") が左にクロップされる
- カード枠 (ROUNDED_RECTANGLE) は分かれているのに、内部テキストだけが境界を貫通して隣接カードに侵入している
- 4 段以上のカードで、上下のカードの本文が同じ y 座標で重なって読めない

**[Root cause]**
LIST-4 のような縦カード積みテンプレが **想定 N (3 件) を超える件数 (N=4,5...)**
で呼ばれた時、`cardH = (totalH - gap*(N-1)) / N` が小さくなりすぎて:

1. badge fontSize (48pt = ~0.75") が cardH 内側 (~0.52") に収まらず、上下に bleed
2. title 16pt + spacer 8pt + body 11.5pt × 3 行 = ~0.91" が cardH 内側に収まらず bleed
3. valign:'middle' のため bleed が **上下対称** に発生 → 前後のカードを侵食

**[Anti-pattern]**
× LIST-4 で cards 4 件、各 body 100 字超 (3 行想定) → 4 段のうち 1〜3 段目でタイトル + 本文が前のカード末尾と重なり、4 段目で本文が footer 領域まで侵食
× LIST-4 で cards 5 件以上 → cardH < 0.6" となり、48pt バッジが完全に隣接カードに被る
× LIST-1 / LIST-3 で本文 fontSize 動的縮小なし + body 80 字超 → 同様に下方向 bleed

**[Exceptions]**
- LIST-4 で cards.length <= 3 かつ body 80 字以下: 通常崩れない
- LIST-3 cardgrid でセル数 <= 6 + body 60 字以下: 通常は破綻しない

**[Fix]**
1. **第一選択 (renderer 側)**: cards.length に応じて compact mode に切替:
   - N=4: badge 30pt / title 13pt / body 10pt / gap 0.10" / valign 'top'
   - N=5: badge 24pt / title 12pt / body 9.5pt / gap 0.08" / valign 'top'
   - N>=6: badge 20pt / title 11pt / body 9pt / gap 0.06" / valign 'top' (max 6)
   - body 文字列を `_truncateBody(body, textW, fontPt, fittedMaxLines)` で auto-truncate
2. **第二選択 (plan.json 側)**: cards 4 件以上で body が長い場合は **LIST-2 (3 列) または LIST-5 (タイル 2x2)** に切り替える
3. **第三選択**: cards を 2 つの章に分割 (例: 4 件 → 2 件 × 2 スライド)

**[検出ロジック (参考)]**

```pseudocode
for slide in deck:
  if slide.template_id in ['LIST-4', 'LIST-1', 'LIST-3']:
    cards_bbox = compute_card_bboxes(slide)  # plan.json + tokens から計算
    for i in range(len(cards_bbox) - 1):
      if cards_bbox[i].y2 + epsilon > cards_bbox[i+1].y1:
        report_fatal(f"VQA-25: card[{i}] overlaps card[{i+1}] in {slide.id}")
    # コンテンツ高さ vs カード内側高さ チェック (フォントサイズベースで概算)
    inner_h = card_h - inner_pad_y * 2
    content_h = title_pt*1.4/72 + spacer_pt*1.4/72 + body_lines * body_pt*1.4/72
    if content_h > inner_h * 1.05:
      report_warn(f"VQA-25: content_h={content_h:.2f}\" > inner_h={inner_h:.2f}\" in {slide.id} card[{i}]")
```

#### LIST-4 / カード積み系の事前チェックリスト

LIST-4 を含むスライドは **必ず PNG 目視** で以下を確認:

- [ ] cards.length が 4 件以上の場合、各カードの badge / title / body が cardH 枠内に収まっている
- [ ] 隣接カード (i, i+1) の bbox が y 軸で重なっていない
- [ ] body 文字列が `…` で truncate されている場合、意味が通る位置で切れている
- [ ] cards.length が 6 件超の場合は warn ログが出ているか / LIST-2 / LIST-5 への切替を検討
- [ ] valign='top' で描画されているか (compact mode 自動切替確認)

build-deck.js のログで `[LIST-4] cards.length=N は MAX_CARDS 件超のため切り詰め` の
warn が出たら、その時点で plan.json を見直し別テンプレへ切替を検討。

---

## 提示フォーマット（違反検出時）

問題が**見つかった場合のみ**、以下の形でユーザーに報告：

```markdown
Phase 4 自己 QA 結果

全 [N] スライドを目視確認しました。以下 [X] 件の要確認事項を発見：

### S5「〇〇のタイトル」 — VQA-02 違反
- 症状: タイトル「XXX...」が 3 行に折り返され、サブコピー（y=2.0 付近）と重なる
- 推奨対処: タイトル文言を短縮 or フォントサイズを 20pt → 18pt に下げる

### S12「〇〇の比較」 — VQA-01 違反
- 症状: 右カラム箇条書き 3 項目目「...というメリット」の末尾 2 文字が見切れ
- 推奨対処: 箱の width を 4.2" → 4.5" に拡大

---

以下のように修正しますか? それとも「このままで OK」でしょうか?
```

問題が**見つからなかった場合**：

```markdown
Phase 4 自己 QA 完了

全 [N] スライドを目視確認し、レイアウト問題は検出されませんでした。

念のため [deck.pptx を提示] で実物もご確認いただき、
問題なければ次のステップ (Phase 5 配布パッケージング) に進みます。
```

---

## 自己チェック（VQA 全件走査後）

走査完了後、以下を確認してから Phase 5 に進む：

- [ ] 全スライドが VQA-01〜25 を通過した（違反 0 件）
- [ ] コンタクトシートで俯瞰 → 違和感のあるスライドを 1 枚ずつ詳細目視した
- [ ] テキストはみ出し（カテゴリ A）を最優先で潰した
- [ ] ユーザーに「全通読してください」と丸投げせず、問題スライドだけを絞って提示した

すべてクリアしたらユーザーに pptx を提示し、明示承認を待つ。

---

## 注意点 & 落とし穴

### PNG のフォントは LibreOffice レンダー
Noto Sans JP → Noto Sans CJK JP にフォールバックされる。PowerPoint 実機で見ると文字幅が
微妙に変わって余裕ができる or 窮屈になるケースがある。「**ギリギリはみ出している**」場合は
実機確認も推奨。

### 画像変換の時間
20 枚デッキで約 15〜25 秒かかる。生成 → QA の間でユーザーを待たせるので、
「今 QA しています、少々お待ちください」と一言添えると親切。

### view ツールの同時枚数
view で一度に表示する画像は 1 枚ずつ、順番に確認する。5 枚まとめて表示しようとすると
context が肥大化するので避ける。コンタクトシート方式で全体俯瞰してから個別確認に絞る。

### 判定の粒度
「美的に惜しい」を全部挙げると情報過多でユーザーが判断不能になる。
**明確な不具合（はみ出し・重なり・逸脱）だけ** を報告対象にする。趣味の問題は黙認で OK。
判断がつかない時は「これは不具合ではないが改善候補」として分けて軽く触れる。
