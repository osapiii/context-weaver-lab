# Scene パターン (SCENE-01〜06 + atoms-shape)

## 役割

「shape の原子要素を組み合わせて、安定的に挿絵やシーンを描く」ための層。
DIAG-XX (定型ダイアグラム 8 種) や CHART-XX (チャート 9 種) では届かない、
**章固有の関係図** や **ストーリーを表す挿絵** が欲しいときに使う。

3 階層で整理されている:

```
shape Atom (atoms-shape.js の関数群)
   ↓ 組み合わせ
Scene (scenes/scene-XX.js のプリセット)
   ↓ DIAGRAM-4 から呼ぶ
セクション挿絵スライド
```

## shape Atom 一覧 (`scripts/render/atoms-shape.js`)

| 関数 | 一言で | 主な引数 |
|------|-------|---------|
| `drawNode`     | 円 / 角丸矩形 / 矩形のラベル付きノード | `area`, `{shape, fill, label, sub}` |
| `drawLink`     | 2 点間の直線 | `from`, `to`, `{color, style}` |
| `drawArrow`    | 矢印付きリンク (片方向) | `from`, `to`, `{color, width}` |
| `drawCallout`  | 太い縦帯 + 強調テキスト | `area`, `{barColor, headline, body}` |
| `drawTagPill`  | 角丸ピル型ラベル (リンクラベル等) | `(x, y, label, {fill, w})` |
| `drawIconBadge`| 円形のアイコンバッジ | `(cx, cy, {r, fill, icon})` |
| `drawActor`     | 人物アイコン (頭=丸 + 体=台形 + ラベル) | `(slide, cx, cy, {label, sub, color})` |
| `drawOrgBlock`  | 会社・組織ブロック (役割タグ付きヘッダー) | `(slide, area, {role, label, sub, fill, stroke})` |
| `drawMoneyFlow` | お金の流れ (太線矢印 + ¥ ラベルバッジ) | `(slide, from, to, {amount, color})` |
| `drawServiceFlow` | サービス/モノの流れ (実線矢印 + ラベル) | `(slide, from, to, {label, color})` |
| `drawDataFlow`  | データ/情報の流れ (点線矢印 + ラベル) | `(slide, from, to, {label, color})` |
| `drawBoundary`  | 境界フレーム (点線囲い + ラベル) | `(slide, area, {label, labelPos: 'top'/'bottom'})` |
| `drawValueTag`  | 値タグ (「無料」「月額¥980」等の強調ラベル) | `(slide, x, y, label, {fill, textColor})` |
| `drawIconLabel` | アイコン円 + 横ラベル (家・店舗 等) | `(slide, x, y, {icon, label, sub, iconColor})` |
| `drawServer`     | サーバー (オンプレ・物理)  | `(slide, area, {label, sub, accentColor})` |
| `drawDatabase`   | データベース (RDB / 円筒形) | `(slide, area, {label, sub, accentColor})` |
| `drawCloud`      | クラウドサービス (AWS/GCP/Azure) | 同上 |
| `drawPC`         | デスクトップ PC | `(slide, area, {label, accentColor})` |
| `drawBrowser`    | ブラウザウィンドウ (URL バー風) | `(slide, area, {label, url})` |
| `drawMobile`     | スマートフォン (縦長) | `(slide, area, {label})` |
| `drawNetwork`    | ネットワーク (LAN/WAN/Internet) | 同上 |
| `drawAPI`        | API エンドポイント | 同上 |
| `drawUserSystem` | システム図上のユーザー | 同上 |
| `drawFolder`     | フォルダ・ファイルストレージ | 同上 |
| `drawContainer`  | コンテナ (Docker/Pod) | 同上 |
| `drawSwitch`     | ネットワークスイッチ・LB | 同上 |
| `drawTerminator`    | フローチャートの開始/終了 (Pill 型・kind=start/end) | `(slide, area, {kind, label, labelSize})` |
| `drawDecision`      | フローチャートの判断ノード (菱形) | `(slide, area, {label, labelSize})` |
| `drawProcess`       | フローチャートの処理/結果ノード (角丸長方形・kind=result-warn 可) | `(slide, area, {label, kind})` |
| `drawDecisionFlow`  | YES/NO ピル付き矢印 (kind=yes/no, elbow=true で L 字) | `(slide, from, to, {kind, label, elbow, labelPos})` |

返り値は `{x, y, w, h, cx, cy}` の anchor 情報を含むので、後続の link/arrow が
それを参照できる:

```javascript
const A = require('../atoms-shape');

const left  = A.drawNode(slide, {x: 1, y: 2, w: 1.5, h: 1.5},
  {shape: 'oval', label: '送り手'}, ctx);
const right = A.drawNode(slide, {x: 7, y: 2, w: 1.5, h: 1.5},
  {shape: 'oval', label: '受け手'}, ctx);
A.drawArrow(slide, {cx: left.cx + 0.75, cy: left.cy},
                   {cx: right.cx - 0.75, cy: right.cy},
  {color: 'brand'}, ctx);
```

## Scene プリセット 6 種 (`scripts/render/scenes/`)

| ID | 名前 | 使う場面 |
|----|------|---------|
| SCENE-01 | 3者関係図 | 中央 (橋渡し役) + 左 (送り手) + 右 (受け手) — 翻訳・仲介・通訳の構図 |
| SCENE-02 | ハブ&スポーク拡張 ⚠️ **1 デッキ 1 枚まで (R-FIG-HUB)** | 中央 + 4-8 周辺 + 各スポークに sub 説明 + emphasis で 1 つだけアンバー強調 |
| SCENE-03 | ステージ遷移 | 3-5 段の横フロー (現在地を emphasis で強調) |
| SCENE-04 | ビジネスモデル図 | 中央プラットフォーム + 3-4 アクター間の money/service/data フロー (BizGram 風) |
| SCENE-05 | システム構成図 | 横一列の 3-5 ノード (ブラウザ → API → DB 等) + request/response/data/sync フロー |
| SCENE-06 | **フローチャート (意思決定の自動化)** | 縦軸 YES/NO 分岐 + 終端 Pill。3 layout: vertical-decision / horizontal-flow / simple-vertical。**DIAGRAM-3 専用テンプレと組み合わせて使うのが原則** |

### JSON サンプル (DIAGRAM-4 経由で呼ぶ)

```json
{
  "id": "S6", "template_id": "DIAGRAM-4",
  "section_no": "01", "section_id": "ch01",
  "section_title": "データAgentとは",
  "one_line": "中央のデータAgentが、事業部の質問者と従来BIを翻訳する立ち位置。",
  "diagram": {
    "template_id": "SCENE-01",
    "left":   { "label": "事業部の\\n質問者", "sub": "今日の数字" },
    "center": { "label": "データ\\nAgent",   "sub": "知識ソース50件" },
    "right":  { "label": "従来BI",            "sub": "SQL/ダッシュボード" },
    "left_to_center_label":  "質問",
    "center_to_right_label": "SQL生成"
  }
}
```

DIAGRAM-4 の `diagram.template_id` が `SCENE-XX` で始まるなら SCENE_REGISTRY、
`DIAG-XX` で始まるなら DIAGRAM_REGISTRY から自動的に解決される。

## 図の選び方 — R-FIG-PRIORITY

**原則: 図はまず `enostech-svg-diagram` skill で SVG を組むのがデフォルト**。
DIAG / SCENE は明示的に「PowerPoint 上で文字を後で直したい」とユーザーが言った時の
フォールバック。データテーブルは最後の砦。番号が小さいほど優先度が高い。

> 💡 **なぜ SVG が default なのか**
>
> SVG なら任意の path / Q曲線 / アイコン / 複合シェイプが使え、cloudDesign 流の制約セットを
> SchemaQA で守ることで品質も安定する。osanai さんが Nanobanana で後から修正できる経路も
> 確保されているため、編集可能性の不利は許容できる。

### 優先順位 (上から先に検討する)

```
①  SVG (enostech-svg-diagram skill)         ← default
    └ 任意の path / Q曲線 / アイコンを組み合わせて、章固有の絵を作る
    └ DIAGRAM-4 / FREE-1 等の slide JSON に svg / svg_file フィールドで渡す
    └ build-deck.js が SVG → PNG 変換 → image_path 化を自動で行う
    └ cloudDesign 流の制約セット (3-4色 / stroke 2or3 / dasharray "4 4" 等) を
      SchemaQA fatal で守るため、品質が崩れにくい
    └ 詳細は enostech-svg-diagram skill の references/

②  shape 自由 (atoms-shape を直接組み合わせる)
    └ SVG で書くより簡素で済むケース、または PPTX 上で文字を後で直したい時のみ
    └ atoms-shape.js の関数を組み合わせて DIAGRAM-4 / DIAGRAM-3 の diagram に
      inline で書くか、scenes/scene-NN-xxx.js に切り出す

③  shape シーン (SCENE-01〜06) / ダイアグラム (DIAG-02〜09)
    └ ②で描こうとした絵が既存テンプレに完全一致する時だけ使う
    └ 1 字違えば ① (SVG) に戻る方が結果的に良い絵になる
    └ DIAG-08 マトリクス・DIAG-05 ピラミッドのように色設計が固定で
      コントラスト調整が効かないテンプレは特に注意

④  チャート (CHART-01〜09)
    └ 定量データ (数値・期間・構成比・分布) を見せる時のみ
    └ CHART-A1〜A4 と組み合わせる

⑤  データテーブル (DATA-2 / DATA-4)
    └ 上記のどれにも当てはまらず、本当に「行 × 列の表」でしか
      表現しようがない時だけ使う。視覚的負荷が最も大きい最後の砦
```

### 色使いの絶対ルール — C-14 (R-SVG-16)

**SVG / SECSUMMARY-1 で、テキストを内包する box / カード / コールアウトの背景に
アンバー (#FCD34D 〜 #B45309) の塗り fill を使ってはいけない。**

amber は次の用途にだけ使う:

- 文字色 (テキスト fill / headline / 強調語)
- 線色 (stroke / 枠線 / 罫線 / マーカー)
- 細い帯 (高さ < 50px の区切り罫線・アンダーライン)
- アイコン fill (40px 角未満の小面積シンボル)

テキストカードの背景は次から選ぶ:

- 白 (#FFFFFF) または off-white (#FAFAF7)
- 薄黄 (#FEF3C7 amber-100) + amber stroke + amber 文字 の組み合わせ
- 薄グレー (#F5F5F4 〜 #E5E7EB)
- ダークネイビー / グレー800 (#1F2937 〜 #374151) の inverse カード (白文字 + amber 強調語)

具体的なカード配色マトリクスとビフォーアフターの diff は、enostech-svg-diagram skill の
`references/pattern-catalog.md` 「カード背景配色マトリクス」セクションを参照。
SchemaQA は R-SVG-16 で fatal を投げるので、Phase 4 の svg-schema-qa.py 実行で
気付かないまま PPTX に焼き付くことはない。

### DIAGRAM-4 セクション挿絵での具体的な書き方

#### 📐 DIAGRAM-4 が画像に与える領域

DIAGRAM-4 の中央 viz 領域は **9.20" × 4.10"** (アスペクト比 約 2.24:1)。
PNG 化された SVG はこの領域に `contain` で配置されるため、
**SVG 側の viewBox は 1840 × 820 を推奨** (aspect 一致、200dpi 相当)。

| viz 寸法 | 値 |
|---|---|
| viz 幅 (inch) | 9.20" |
| viz 高さ (inch) | 4.10" |
| アスペクト比 | 2.24 : 1 |
| **推奨 viewBox** | **1840 × 820** (200dpi 相当) |
| 高解像度版 | 2400 × 1070 (約 260dpi) |

viewBox がこの比率から大きくずれると、`contain` で余白が大量にできて
「絵が小さく見える」「文字が読めない」状態になる。

```jsonc
// ✅ default: viewBox 1840 × 770 で SVG を組む
{
  "id": "S5b",
  "template_id": "DIAGRAM-4",
  "section_no": "01",
  "section_title": "RAG 実装の地図",
  "one_line": "4 手段を 2 軸で並べると Gemini File Search の位置が見える",
  "svg": "<svg viewBox='0 0 1840 770' xmlns='http://www.w3.org/2000/svg'>...</svg>"
  //   ↑ build-deck.js が svg-to-png で PNG 化して image_path に置換
  //     生成 PNG は decks/{slug}/assets/svg-rendered/{slide_id}.png
}

// あるいは別ファイルで管理したい時:
{
  "svg_file": "assets/svg-src/ch1-map.svg"  // plan.json と同階層基準
}

// ⚠️ DIAG / SCENE 経由は明示の opt-in:
{
  "diagram": { "template_id": "DIAG-08", ... }  // 「PPTX 上で文字直したい」時のみ
}
```

### VISUAL ハイブリッド系の viewBox 規約

VISUAL-9 / 10 / 11 / 12 はそれぞれ SVG 配置領域の aspect 比が違うため、
**テンプレ別に推奨 viewBox を決める** のが基本。

| TID | SVG 配置 | 推奨 viewBox | aspect |
|---|---|---|---|
| DIAGRAM-4 | 章扉直後の見取り図 | `0 0 1840 820` | 2.24:1 |
| VISUAL-9 | 左 SVG (4.4" × 3.85") | `0 0 880 770` | 1.14:1 (約 4:3.5) |
| VISUAL-10 | 横 3 コマ各カード (約 2.6" × 2.0") | `0 0 750 600` | 1.25:1 (約 5:4) |
| VISUAL-11 | 上の大ビジュアル (9.20" × 約 2.27") | `0 0 1840 455` | 約 4:1 (横長) |
| VISUAL-12 | 左右ペイン (約 4.0" × 2.20") | `0 0 800 440` | 1.82:1 (約 16:9) |

数字を覚えるのが面倒なら、各テンプレの render コメント先頭に上記寸法を書いてあるので
そこからコピーして始めるのが早い。

#### SVG を書くときのコツ

- **viewBox は 1840 × 820 で固定**。比率を変えるとスライド側で余白が増える
- **テキストは `font-size: 28〜36`** が読みやすい (1840 幅前提)。本文は 22〜28、補足は 18 程度
- **stroke-width は 2 か 3** だけ (cloudDesign 流の制約)
- **描画範囲は左右 60〜80px のマージンを取る** (端ぎりぎりは contain で切れがち)
- 詳細は `enostech-svg-diagram` skill の `references/how-to-write-svg.md` 参照

### なぜこの順序か

- **①が最強**: ENOSTECH の学習デッキで読者の頭に残るのは「絵」。型に
  当てはめた絵は印象に残らないが、章固有のメタファーで描いた絵は
  覚えてもらえる。SCENE/DIAG は「迷ったときに引ける参考実装」であり、
  「これに当てはめねばならない正解の型」ではない
- **②は参考値**: SCENE-01〜06 は「過去によく使ったパターンを名前付きで
  保存したもの」。新規デッキで章の中身が違うのに無理矢理当てはめると、
  「SCENE-01 を流用したから 3 者関係になった」という本末転倒が起きる
- **③は定型のみ**: DIAG は構造そのものが意味を持つ (PDCA = サイクル,
  Before/After = 対比 等)。**章の骨格が DIAG の構造と一致する時にだけ**
  使う。一致しないなら ① か ② に戻る
- **⑤は最後**: テーブルは情報密度は高いが「絵で覚える」効果が無い。
  本当に表でしか表現しようがない時のお守り

### 実装上の入り口

| やりたいこと | 入り口 |
|---|---|
| ① shape 自由でゼロスクラッチ | DIAGRAM-4 or DIAGRAM-3 の `diagram` に inline で書くか、`scripts/render/scenes/scene-NN-xxx.js` に切り出して `SCENE_REGISTRY` に登録 |
| ② shape シーン (SCENE-01〜06) | DIAGRAM-4 / DIAGRAM-3 から `diagram.template_id: "SCENE-XX"` で呼ぶ |
| ③ ダイアグラム (DIAG-02〜09) | DIAGRAM-4 / LIST-1 等から `diagram.template_id: "DIAG-XX"` で呼ぶ |
| ④ チャート (CHART-01〜09) | CHART-A1〜A4 から `chart` フィールドで呼ぶ |
| ⑤ データテーブル | DATA-2 / DATA-4 / DATA-5 |

## カスタムシーンの書き方 (atoms-shape を直接使う)

新しいシーンを作るときは `scripts/render/scenes/scene-NN-xxx.js` を新規作成し、
atoms-shape の関数だけを使って組む。pptxgenjs の slide.addShape を直接呼ばない
ことで、色・サイズの一貫性を確保できる。

```javascript
'use strict';
const A = require('../atoms-shape');

function drawSceneXxx(slide, sceneJson, area, ctx) {
  // area は {x, y, w, h} で挿絵領域が来る
  // sceneJson は JSON で渡されたパラメータ
  // ctx は {C: 色, F: フォント, SZ: サイズ, pres: pptxgen インスタンス}

  // 1. ノードを置く
  const a = A.drawNode(slide, {x: area.x + 0.5, y: area.y + 1, w: 1, h: 1},
    {shape: 'oval', label: 'A'}, ctx);
  const b = A.drawNode(slide, {x: area.x + 5, y: area.y + 1, w: 1, h: 1},
    {shape: 'oval', label: 'B'}, ctx);
  // 2. つなぐ
  A.drawArrow(slide, {cx: a.cx + 0.5, cy: a.cy}, {cx: b.cx - 0.5, cy: b.cy},
    {color: 'brand'}, ctx);
  // 3. 強調コールアウト
  A.drawCallout(slide, {x: area.x, y: area.y + 2.5, w: area.w, h: 0.6},
    {headline: 'これが核心', body: '理由は ...'}, ctx);
}

module.exports = { drawSceneXxx };
```

その後:

1. `build-deck.js` の `SCENE_REGISTRY` に `'SCENE-XX': drawSceneXxx` を追加
2. `references/_common/scene-patterns.md` (本書) の表に 1 行追加

これだけで JSON から呼べるようになる。

## 設計上の絶対ルール

### G-SCENE-1 atoms-shape を使う / addShape を直接呼ばない

scenes 配下の関数は atoms-shape 経由でだけ shape を描くこと。直接
`slide.addShape(pres.shapes.OVAL, ...)` を書くと、色トークンの統一
・テーマ切替・フォント指定が壊れる。

### G-SCENE-2 トークン経由で色を扱う

atoms-shape の引数に渡す `fill`, `stroke`, `color` は全て **トークンキー**
(`'brand'`, `'accent'`, `'gray500'` など) で渡す。hex 直書きはしない。
内部で `_resolveColor` がトークン→hex に解決する。

### G-SCENE-3 emphasis は 1 つまで

「強調 (アンバー色)」は読者の目を引く要素なので、1 シーンに 1 つに留める。
複数つけると「どこを見ればいいか」が分からなくなる。

### G-SCENE-4 sub はノード内に収める

ノードの外側にラベルを置くと、上下端でレイアウト枠 (innerArea) を
はみ出すリスクがある。SCENE-02 では label + sub をノード内に二段表示する
パターンに統一済み。新シーンを作るときも同じ思想を踏襲する。

### G-SCENE-5 ハブ&スポーク (SCENE-02) は 1 デッキ 1 枚まで

**R-FIG-HUB**: 中央 + 4-8 周辺要素のハブ&スポーク図 (SCENE-02) は
1 デッキ最大 1 枚。乱用すると「ばっかり構図」になり、デッキ全体の重み付けが
平らに見えなくなる。

**Why**:
- ハブ&スポーク構造は汎用性が高すぎ、ほぼ全テーマに当てはめられてしまう
  (「製品 + 機能」「サービス + ユーザー層」「課題 + 要因」等)
- 結果、Claude が思考停止で選ぶデフォルトになりやすい
- 5 要素を見せたいだけなら LIST-3 (カードグリッド) / LIST-2 (3 カラム) /
  LIST-5/6/7 (タイル) のほうが情報密度が高く、読者も並列だと一目で分かる

**使ってよい条件 (どちらも満たす時のみ)**:
1. 中央のハブが、周辺要素を **「束ねる / 指揮する / 変換する」** 役割を持つ
   - 例 ✅: API Gateway + マイクロサービス群、データ基盤 + 利用部門、
     翻訳エンジン + 入出力言語
   - 例 ❌: 製品 + 機能、会社 + 事業、Uber QueryGPT + 構成要素 5 つ
     (これは並列 — LIST-3 が正解)
2. 周辺要素が中心ハブと **意味的に同格** (中心が「使う側」「制御する側」)

**代替の選び方 (迷ったらコレ)**:

| 構造 | 推奨テンプレ |
|------|-------------|
| 5 要素を並列に見せたい | **LIST-3 カードグリッド** |
| 3 要素を並列に見せたい | **LIST-2 3 カラム** |
| 4 要素 + 対比軸がある | **DIAGRAM-1 2x2 マトリクス** |
| 順序付き 3-5 要素 | **SCENE-03 ステージ遷移** |
| 番号付きで深掘り | **LIST-4 縦カード積み** |
| 階層的な依存関係 | **DIAG-05 ピラミッド** |

**強制レベル**:
- Phase 2 設計時: **R2-15** で「SCENE-02 を選ぶ前に上記条件を満たすか」セルフチェック
- 機械検査: **StructureQA-22** で learning-deck Template の
  `globalConstraints.maxTags` で「SCENE-02 が 2 枚以上」を fatal 検出

## 既知制約

- atoms-shape は pptxgenjs 1.x の shape (OVAL / RECTANGLE / ROUNDED_RECTANGLE
  / LINE) のみ。SVG パスのような複雑形は描けない。手描きテイストや有機形が
  欲しい場合は別スキル `enostech-svg-diagram` (SVG ベース) を使う
- 矢印は `endArrowType: 'triangle'` で実装。pptxgenjs のバージョンや
  PowerPoint レンダラー次第で見た目が微変動する可能性
- ノードの位置決めはピクセル指定が前提 (現状)。「自動レイアウト (force-directed
  等)」は実装していない

## SCENE-04 ビジネスモデル図 サンプル JSON

```json
"diagram": {
  "template_id": "SCENE-04",
  "boundary": { "label": "プラットフォーム範囲", "labelPos": "bottom" },
  "center": {
    "role": "プラットフォーム",
    "label": "ENOSTECH\nKnowledge Hub",
    "sub": "ナレッジ管理 SaaS"
  },
  "actors": [
    {
      "label": "利用者",
      "sub": "全社員",
      "position": "left",
      "color": "brand",
      "flows": [
        { "type": "money",   "direction": "in",  "label": "月額¥980" },
        { "type": "service", "direction": "out", "label": "ナレッジ閲覧" },
        { "type": "data",    "direction": "in",  "label": "利用ログ" }
      ]
    },
    {
      "label": "コンテンツ提供者",
      "position": "right",
      "flows": [
        { "type": "service", "direction": "in",  "label": "資料投稿" },
        { "type": "money",   "direction": "out", "label": "報酬¥500/件" }
      ]
    }
  ]
}
```

**フローの意味**:
- `type`: `money` (¥ ラベル付き太線矢印・アクセント色) / `service` (実線矢印・ブランド色) / `data` (点線矢印・グレー)
- `direction`: `in` (アクター → 中央) / `out` (中央 → アクター)

**positions**: `left` / `right` / `top` / `bottom` の 4 方向。中央プラットフォームを取り囲むイメージ。

**運用 Tips**:
- アクターは 3-4 つまでに留める。それ以上だとフローが入り組んで読めなくなる
- お金の流れ (money) は**ストーリーの幹**。最低 1 つは必ず入れる
- データの流れ (data) は補足情報。全アクターには付けない
- 境界フレーム (boundary) は「プラットフォームの範囲」「自社の範囲」を強調したい時だけ。常用しない

## ビジネスモデル図向け atom の使い分け

| やりたいこと | 使う atom |
|------------|----------|
| 顧客・ユーザー・人を表現 | `drawActor` |
| 会社・組織・サービスをブロックで | `drawOrgBlock` |
| お金が流れる線 | `drawMoneyFlow` (¥ ラベル付き、太線、アクセント色) |
| サービス・モノが流れる線 | `drawServiceFlow` (実線、ブランド色) |
| 情報・ログ・データが流れる線 | `drawDataFlow` (点線、グレー) |
| 「ここまでがプラットフォーム」と囲う | `drawBoundary` |
| 「無料」「月額¥980」等のキャッチ | `drawValueTag` |
| 拠点・店舗・倉庫等を 1 文字 + 横ラベル | `drawIconLabel` |

## SCENE-05 システム構成図 サンプル JSON

```json
"diagram": {
  "template_id": "SCENE-05",
  "boundary": { "label": "AWS リージョン", "labelPos": "top" },
  "nodes": [
    { "kind": "browser",  "label": "Web App",   "sub": "React" },
    { "kind": "api",      "label": "REST API",  "sub": "Node.js" },
    { "kind": "database", "label": "Postgres",  "sub": "RDS db.m6g" }
  ],
  "flows": [
    { "from": 0, "to": 1, "type": "request",  "label": "GET /tasks" },
    { "from": 1, "to": 0, "type": "response", "label": "JSON" },
    { "from": 1, "to": 2, "type": "request",  "label": "SELECT" },
    { "from": 2, "to": 1, "type": "response", "label": "rows" }
  ]
}
```

**kind 一覧**: `browser` / `pc` / `mobile` / `server` / `api` / `database` /
`cloud` / `network` / `folder` / `container` / `switch` / `user` の 12 種。

**flow 種別**:
- `request`  — 実線、ブランド色、上側に配置 (yOffset=-0.40)
- `response` — 実線、グレー、下側に配置 (yOffset=+0.40)
- `data`     — 点線、グレー、ラベル斜体
- `sync`     — 矢印、アクセント色、太め (非同期呼び出しのニュアンス)

**運用 Tips**:
- ノードは 3-5 個に留める。それ以上だとノード幅が狭くなりラベルが切れる
- 1 経路の往復 (request + response) はセットで書くと読みやすい
- emphasis: true で 1 ノードだけ accent 色のヘッダーバーになる。意思決定の
  対象ノードを示したいときに使う

## システム atom の使い分け

| やりたいこと | 使う atom |
|------------|----------|
| Web ブラウザでサービスを使う | `drawBrowser` (URL バー付き) |
| 業務 PC からアクセス | `drawPC` (モニター + スタンド) |
| スマホアプリ | `drawMobile` (縦長端末) |
| サーバー (オンプレ・物理マシン) | `drawServer` |
| クラウドサービス (AWS/GCP/Azure) | `drawCloud` |
| API エンドポイント | `drawAPI` |
| データベース (RDB) | `drawDatabase` (円筒形) |
| ファイルストレージ・S3 | `drawFolder` |
| コンテナ (Docker/Kubernetes) | `drawContainer` |
| ネットワーク (LAN/Internet) | `drawNetwork` |
| ロードバランサー・スイッチ | `drawSwitch` |
| システム図上のユーザー | `drawUserSystem` |


## SCENE-06 フローチャート (意思決定の自動化)

**意思決定の自動化を絵で見せる、ENOSTECH の最重要シーン**。学習デッキで
「現場でどう判断するか」を読者に持ち帰ってもらうには、文字より絵で示す方が
記憶に残る。FlowChart はその最も強力な道具なので、特別扱いする。

### 3 つの layout モード

#### `vertical-decision` (縦型 YES/NO 木)

縦軸に判断ノードを並べ、YES = 真下に進む / NO = 横に出して側方の結果ノードへ。
分岐が複数ある「篩 (ふるい) の意思決定」に最も適する。例: 課税対象の判定、
セキュリティインシデントのトリアージ、与信スコアの段階判定。

```json
"diagram": {
  "template_id": "SCENE-06",
  "layout": "vertical-decision",
  "start": { "label": "事業者が対価を得て行った取引" },
  "steps": [
    { "kind": "decision", "label": "資産の譲渡",   "yes_to": "next", "no_to": { "side": 0 } },
    { "kind": "decision", "label": "国内取引",     "yes_to": "next", "no_to": { "side": 0 } },
    { "kind": "decision", "label": "非課税取引",   "yes_to": { "side": 1 }, "no_to": "next" },
    { "kind": "decision", "label": "輸出免税等",   "yes_to": { "side": 2 }, "no_to": "end" }
  ],
  "side_results": [
    { "label": "課税の対象外（不課税取引）" },
    { "label": "非課税取引" },
    { "label": "輸出免税等取引" }
  ],
  "end": { "label": "課税取引", "kind": "success" }
}
```

**フィールド**:
- `start.label` / `end.label` — 開始 Pill (brand 黒) と終端 Pill (highlight アンバー)
- `steps[].kind` — `'decision'` (菱形) / `'process'` (角丸長方形)
- `steps[].yes_to` / `no_to` — 行先の 3 通り:
  - `'next'` — 真下、次の step へ進む (主軸ルート)
  - `'end'` — 真下、終端 Pill へ
  - `{ side: N }` — 横、`side_results[N]` へ
- `side_results[]` — 「離脱結果」を右側に並べる。複数 step から同じ side を共有可能

**運用 Tips**:
- decision のラベルは **〜10 文字** に絞る (菱形に収まる量)
- step は最大 6 個まで。それ以上は章を分ける
- side_results は **3 つまで**。多いと右側が窮屈になる
- 「主軸 (next で進む) は 1 本通る」設計にすると視線が迷わない

#### `horizontal-flow` (シンプル横一列フロー)

分岐の無い直線的なプロセスを横一列で見せる。例: 問い合わせ受付からクローズ
までの定型導線、購入導線、申請フロー。

```json
"diagram": {
  "template_id": "SCENE-06",
  "layout": "horizontal-flow",
  "start": { "label": "問い合わせ受付" },
  "steps": [
    { "kind": "process", "label": "1次切り分け" },
    { "kind": "process", "label": "担当割り当て" },
    { "kind": "process", "label": "対応" }
  ],
  "end": { "label": "クローズ", "kind": "success" }
}
```

steps は全て `kind: 'process'` (角丸長方形)。decision は使わない。
分岐があるなら vertical-decision を使う。

#### `simple-vertical` (縦パイプライン)

縦に積み上げる。process だけのプロセスフロー。例: デッキ制作の標準フロー、
入社オンボーディング、デプロイパイプライン。

```json
"diagram": {
  "template_id": "SCENE-06",
  "layout": "simple-vertical",
  "start": { "label": "ヒアリング" },
  "steps": [
    { "kind": "process", "label": "情報設計" },
    { "kind": "process", "label": "デッキ構築" },
    { "kind": "process", "label": "QA" }
  ],
  "end": { "label": "公開", "kind": "success" }
}
```

### DIAGRAM-3 専用テンプレと組み合わせる (推奨)

SCENE-06 は DIAGRAM-4 (セクション挿絵) からも呼べるが、**意思決定木は情報量が
多いのでフルブリードで描いた方が読みやすい**。DIAGRAM-3 (FlowChart 専用 /
フルブリード) と組み合わせるのが原則:

```json
{
  "template_id": "DIAGRAM-3",
  "title": "課税対象の判定フロー（消費税）",
  "caption": "全 NO クリアで「課税取引」に着地する",
  "diagram": {
    "template_id": "SCENE-06",
    "layout": "vertical-decision",
    "...": "..."
  }
}
```

DIAGRAM-3 はグレー背景フレームと章扉ヘッダーを撤去し、本文領域を縦 4.8" 確保
してくれる。詳細は `slide-patterns.md` の DIAGRAM-3 を参照。

### 配色の意味づけ

| 色 | 役割 | 使い分け |
|----|------|---------|
| `brand` (slate-800) | 主軸 / start / YES | 真下に進む主ルート、開始ノード |
| `highlight` (amber-500) | 終端 / NO / 離脱結果 | 注意喚起、「ここで止まる」「別ルートに外れる」 |
| `accent` (slate-600) | 補助 | 並列の対比や 2 番目のルート |

**why**: YES と NO で色を変えると、読者が一瞬で「主軸はどっちか」を判別できる。
全部同じ色だとフローを目で追わないと分からない。

### 設計ルール (SCENE-06 専用)

#### G-SCENE-06-1 意思決定が絡むテーマでは必ず 1 枚以上含める

学習デッキの目的は「現場で正しい意思決定をしてもらう」こと。判断ロジックを
箇条書きで書くより、FlowChart で絵にした方が圧倒的に持ち帰り感が出る。
**StructureQA-21** で 0 枚だと fatal にしている。

#### G-SCENE-06-2 1 スライド 1 意思決定木

複数の判断木を 1 枚に詰め込まない。複数あるなら 2 枚 / 3 枚と FlowChart
スライドを増やす。

#### G-SCENE-06-3 終端ノードは必ず Pill (drawTerminator)

「ここがゴール」「ここで止まる」を明示するため、終端は drawTerminator (Pill 型)
を使う。process (角丸長方形) を終端に使うと、「次がある」と読者が誤解する。

#### G-SCENE-06-4 decision のラベルは短く

菱形に文字を載せる以上、長文は物理的に入らない。〜10 文字、できれば 5 文字
以下のキーワードに絞る。詳細条件はサブコピーや speaker notes に逃がす。
