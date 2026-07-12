# cloudDesign 流の制約セット — 詳細

このスキルが守る 6 つの絶対ルール。`scripts/qa/svg-schema-qa.py` で機械検証される。

## R-SVG-1: 色は 4 色まで

同時に使ってよい色は最大 4 色。palette.canvas (背景) は色数にカウントしない。

- ✅ OK: `#1F2937 (ink) + #F59E0B (brand) + #B45309 (accent) + #6B7280 (gray500)` の 4 色
- ❌ NG: 5 色以上 → SchemaQA fatal
- ⚠️ warn: palette トークンに無い hex を使う

palette は `assets/tokens.json` から取る (enostech-slides の palette.yml と同期)。

## R-SVG-2: 線の太さは 2px か 3px のみ

`stroke-width` は `2` または `3` のみ。混在禁止。

- ✅ OK: `stroke-width="2"` を全体で統一、強調だけ `stroke-width="3"`
- ❌ NG: `stroke-width="1"` `stroke-width="1.5"` `stroke-width="4"` → SchemaQA fatal

理由: 線幅がバラつくと「絵が雑然とする」。2 つだけに絞ると階層が自然に出る。

## R-SVG-3: matker は 1 種類だけ定義し使い回す

`<defs>` 内の `<marker>` は **1 つだけ** にする。複数の矢印スタイルが要る時は色だけ変える。

```xml
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
    <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
  </marker>
</defs>

<!-- 使う側で色を制御 -->
<line ... stroke="#F59E0B" marker-end="url(#arrow)" style="color: #F59E0B"/>
```

- ❌ NG: `<marker id="arrow-svg">` `<marker id="arrow-shape">` のように複数定義 → fatal

## R-SVG-4: viewBox 必須

`<svg>` には必ず `viewBox` を指定する。座標は論理座標で書く。

- ✅ OK: `<svg viewBox="0 0 1400 760" xmlns="...">` (外側で `width="100%"` でレスポンシブ)
- ❌ NG: `viewBox` なし、`width="1400" height="760"` 直書き → fatal

## R-SVG-5: dasharray は '4 4' のみ

`stroke-dasharray` は `"4 4"` だけ。`"6 4"` `"8 2 2 2"` 等は使わない。

- ✅ OK: `stroke-dasharray="4 4"` (フィードバックループ・補助線・予定枠などに使う)
- ❌ NG: 他のパターン → fatal

## R-SVG-6: シェイプは矩形・円・直線・三角・楕円・path のみ

使ってよい SVG 要素:

- `<rect>` (矩形、角丸 OK)
- `<circle>` (円)
- `<line>` (直線)
- `<polygon points="x1,y1 x2,y2 x3,y3">` (3 点 = 三角、4 点も可)
- `<ellipse>` (楕円、円筒の上下面などに)
- `<path>` (任意の path、Q 曲線推奨。複雑な装飾形は禁止)
- `<text>` (ラベル)
- `<g>` (グループ化)
- `<defs> <marker>` (R-SVG-3 のとおり 1 種のみ)

使っていけない要素:
- `<foreignObject>` (HTML 埋め込み禁止、レンダラ依存大)
- カスタム filter (`<filter>` `<feGaussianBlur>` 等) — 装飾過多になる
- 装飾 path (cloud, blob, ribbon 等) — 「絵としての説得力」を雑なシルエットに頼る
- `<image>` (外部画像埋め込み) — SVG の意味がない

## R-SVG-7 (warn): フォントは Noto Sans JP / JetBrains Mono

`font-family` は次の 2 つのみ推奨:

- `'Noto Sans JP', sans-serif` (日本語、全テキストのデフォルト)
- `'JetBrains Mono', monospace` (数値・URL・コード断片)

他のフォントは warn (fatal にはしない)。

## まとめ: 守ると得られるもの

この 6+1 ルールを全部守ると、絵は自動的に「整って見える」状態になる。理由:

1. 色 4 色 + 線 2 種 + dash 1 種 → **視覚的なノイズが激減**
2. marker 1 種 → **矢印の見た目が統一**
3. viewBox + 制限シェイプ → **絵の論理構造が読み取りやすい**

cloudDesign が「明文化されていないコツ」と言っていたものを、SchemaQA で機械化したのが
このスキルの本質。

---

# v1.1 で追加したルール (R-SVG-8〜12)

osanai さんからの指摘 (「文字が他の図と被る」「色が強すぎる」) を構造で解消するため、
v1.1 で機械検証ルールを 4 つ追加した。

## R-SVG-8: テキストは他の塗り面・別テキストと bbox 衝突しない (fatal)

テキスト要素の bbox (font-size と文字数から概算) と、他の **塗りつぶしのある shape** の
bbox が衝突したら fatal。テキスト同士の重なりも fatal。

回避策:
1. **配置を移動**: テキストを塗り面の外に出す
2. **canvas 抜きチップで囲う**: 銘板のように `<rect fill="#FAFAF7" stroke="#1F2937">` で
   背景を白く抜き、その中にテキストを配置する
3. **重ねる場合は色のコントラスト確保**: brand 塗りの中に置くなら canvas 色のテキストにする
   (ただし機械検証は fatal 出すので、3 を選んだ場合は要レビュー)

機械検出の限界:
- `<path>` `<polygon>` の bbox は計算が複雑なので未対応 (見逃しあり)
- text の `dx` `dy` `transform` は未考慮 (実用上問題出にくい)

## R-SVG-9: brand+accent 塗り面積は viewBox の 15% 以下 (fatal)

オレンジ系 (`#F59E0B` / `#B45309`) の **塗りつぶし面積の合算** が viewBox 全体の 15% を
超えると fatal。線 (stroke) は面積カウントしない。

理由: 強調色は面積が増えると「強調が強調にならない」。15% は経験則で「ベース 70 / 黒 20 /
強調 5-10」のうち、強調を倍にした上限。

回避策: 塗り (fill) を線 (stroke) に置き換える。「主役の主役」だけ塗りで残す。

## R-SVG-10: brand+accent 大塗り (面積 ≥ 2%) は最大 2 個 (warn)

面積 2% 以上の brand 塗りが 3 個以上あると warn。9 をクリアしていても、大きな塗りが
散らばると視線が分散する。

## R-SVG-11: 強調は塗りより線 (guideline / 機械検証なし)

ガイドラインのみ。「強調したい」と思ったら、まず stroke (枠線) で表現できないか自問。
塗りが必要なのは:
- ボタンの「押せる」感 (面で押す)
- 主役の主役 (CTA / 緊急停止 / RUN ランプ)
- 計器の「点灯している」感 (色を持った面)

それ以外は基本的に「線」で十分意味は伝わる。

## R-SVG-12: ink 塗り面積は viewBox の 5% 以下 (fatal)

ink (`#1F2937`) の **塗りつぶし面積** が viewBox 全体の 5% を超えると fatal。線・文字
としての ink はカウントしない。

理由: ink は本来「線・文字・輪郭」のための色。塗りで使うと圧が強すぎる。黒塗りの
ヘッダ帯 / 番号バッジ / アクター帯などをやりたくなった時に、すぐ 5% を超える。

回避策:
- ヘッダ帯: 塗り → `gray100` (#F3F4F6) 塗り + ink 細線 1 本で「下線 border」風
- 番号バッジ: 黒円 + 白数字 → 白円 + ink 枠線 + ink 数字
- 計器ディスプレイ背景: 黒塗り → gray100 塗り + ink 文字
- ノード/歯車の中心点: 黒丸塗り → 白丸 + ink 枠線

## まとめ: 色の強さ 3 段階

| 強度 | 色 | 用途 | 制限 |
|------|----|----|----|
| **強** | brand / accent / ink (塗り) | 主役の主役、CTA | 1 SVG に 1〜2 箇所 |
| **中** | brand / ink (線・枠) | 構造を見せる主用途 | 制限なし |
| **弱** | gray100 (塗り) / gray500 (補助文字) / canvas | ベース・背景 | 制限なし |

「強」を限界まで控え、「中」「弱」で骨格を組むと cloudDesign 的な落ち着いた見た目になる。

---

# v1.9 で追加したルール (R-SVG-18 / R-SVG-19)

## R-SVG-18: 枠付きテキストボックスからのはみ出し (fatal)

stroke 持ちの rect を「枠付きテキストボックスの候補」とする。テキストの中心点を
含む rect の中から最小面積を親として採用し、親 rect の内側 padding (4px、ただし
canvas 色塗り or fill=none は 2px) を確保した内枠から text bbox がはみ出していたら fatal。

### よくある違反

- 100x40 の枠に「日本生命 Wellness-Star☆」のような 14 文字 × 22px を押し込む
- font-size を上げた後に rect の幅・高さを上げ忘れる

### 修正方法

- rect の width / height を増やす
- font-size を下げる (本文最低 16px なので、これ以上下げると R-SVG-13 で fatal)
- 文字数を減らす / 折り返し用に複数行に分ける

## R-SVG-19: テキストと line / path / circle 周の重なり (fatal)

テキスト bbox と以下の図形要素の最短距離が `font-size × 0.5` 未満なら fatal。

- `<line>` (矢印含む)
- `<path>` の M-L 直線セグメント
- `<circle>` で fill が none / canvas 色のもの (= 周だけ描画している円)
- `<ellipse>` の周 (簡易判定)

### よくある違反

- 同心円の内側 / 外側にラベルを置いて、円周にちょうど被ってしまう
- 凡例の line と説明テキストを近すぎる y 座標に置いて被る
- 矢印の上にラベルを乗せる

### 修正方法

- テキスト位置を `font-size × 0.5` 以上ずらす (margin)
- 円のサイズを変えて、ラベル配置位置に円周が来ないようにする
- 線の位置を別 y にする
