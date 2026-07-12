# PptxGenJS × デザイントークン — 安定再現の仕組み

> このドキュメントは「なぜ PptxGenJS で毎回同じブランドが再現できるのか」を解説します。
> 仕組みを理解すると、**独自テンプレを追加する** ときの勘所や、**トラブルシュート** のヒントが得られます。

---

## 全体像 — 3 層の責任分離

ENOSTECH のスライド生成は、以下の 3 層が協力して動きます：

```
┌─────────────────────────────────────────────┐
│ 1. デザイントークン (assets/tokens.js)        │
│    色・サイズ・余白・フォントの「値の辞書」      │
└───────────────────┬─────────────────────────┘
                    │  import
                    ▼
┌─────────────────────────────────────────────┐
│ 2. ヘルパー関数 (scripts/example-deck.js)     │
│    トークンを使って PptxGenJS を呼ぶ「薄い関数」│
│    addChrome / addTitleBlock / addChromeNav など │
└───────────────────┬─────────────────────────┘
                    │  呼び出し
                    ▼
┌─────────────────────────────────────────────┐
│ 3. PptxGenJS (npm パッケージ)                 │
│    実際に .pptx ファイルを書き出すライブラリ    │
└─────────────────────────────────────────────┘
```

**なぜ安定するか**: 各層が責任を分担し、**1 箇所の変更が全体に波及する** 設計になっているから。

- トークン変更 → 全スライドに反映
- ヘルパー変更 → そのヘルパーを使う全箇所に反映
- PptxGenJS は「薄く・直接」使うので、裏で勝手に変なことが起きない

---

## レイヤー 1 — デザイントークン (`assets/tokens.js`)

### 何が書いてあるか

```javascript
module.exports = {
  color: {
    purple:    "9212F3",    // ブランド核色
    magenta:   "E365FF",    // サブ色
    accent:    "F59E0B",    // アンバー（エネルギー）
    ink:       "000000",
    canvas:    "FAFAF7",    // オフホワイト背景
    // ...
  },
  font: {
    jp: "Noto Sans JP",     // 日本語フォント統一
  },
  size: {
    titleXL: 32,
    titleL:  20,
    h2:      16,
    body:    11,
    caption:  9,
    // ...
  },
  layout: {
    marginX:      0.40,     // 左右の余白（インチ）
    gutter:       0.22,
    stripeW:      0.12,     // 左端ストライプ幅
    titleBlockY:  0.55,
    contentY:     1.65,
    contentBot:   5.15,
    // ...
  },
};
```

### なぜこの形式？

PowerPoint / PptxGenJS の座標系は **インチ単位**（1 枚のスライドは 10" × 5.625"、16:9）。トークンは素のまま `addShape({ x: 0.40, ... })` のように渡せるので、**変換コストゼロ**。

色は **16 進の RRGGBB 6 文字（# なし）** で書く。これが PptxGenJS が受け付ける形式。

### どう参照するか

`example-deck.js` の冒頭で：

```javascript
const T = require('../assets/tokens.js');
const L = T.layout;  // 短縮参照
const C = T.color;
const F = T.font;
const SZ = T.size;

// 以降、コード中では C.purple, L.marginX, F.jp のように使う
```

この短縮参照が重要。`T.color.purple` ではなく `C.purple` にすることで、コードが読みやすくなり、**タイポによるバグが減る**。

---

## カラーテーマシステム

### なぜテーマが必要か

ENOSTECH 以外のクライアントの資料でも使えるよう、**色の役割は固定・値だけ差し替え** できる仕組みになっている。

### 役割ベースの色参照

```javascript
// 役割ベース（推奨）
fill: { color: C.brand }        // テーマの主色
fill: { color: C.accent }       // テーマのアクセント
```

### 5 つの組み込みテーマ

`assets/themes.js` に定義されている：

- `enostech` — 紫 × アンバー（デフォルト）
- `corporate` — ネイビー × ゴールド
- `nature` — グリーン × オレンジ
- `warm` — レッド × ティール
- `mono` — ブラック × アンバー

### 切替方法

デッキ生成の冒頭で 1 度だけ：

```javascript
const T = require('../assets/tokens');


const C = T.color;  // これ以降 C.brand はネイビーになる
```

### Proxy による動的解決


```javascript
// tokens.js の内部実装（簡略版）
const colorProxy = new Proxy({}, {
  get(_, prop) {
    if (prop === 'brand') return currentTheme.brand.base;
    // ...
  }
});
```

### 新しいテーマを追加する

`assets/themes.js` に同じ構造で 1 つ足すだけ。役割ベースで参照しているので、他のコードは 1 行も変えなくて良い：

```javascript
// themes.js
module.exports = {
  // ... 既存テーマ ...
  myTheme: {
    id: 'myTheme',
    name: 'My Custom',
    brand:   { base: 'XXXXXX', soft: 'XXXXXX', deep: 'XXXXXX' },
    accent:  { base: 'YYYYYY', soft: 'YYYYYY', deep: 'YYYYYY' },
    neutral: { 50: '...', 100: '...', ..., 900: '...' },
    canvas:  'ZZZZZZ',
    white:   'FFFFFF',
  },
};
```

---

## レイヤー 2 — ヘルパー関数

### コンセプト — 「薄いラッパー」

PptxGenJS の API を **直接** 使うのではなく、トークンを読んで PptxGenJS を呼ぶ **小さな関数** を間に挟みます。例：

```javascript
// ヘルパー関数の例
function addChromeLeftStrip(slide) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: L.stripeW, h: L.slideH,
    fill: { color: C.purpleSoft },
    line: { type: 'none' },
  });
}
```

この関数を **全スライドで呼ぶ** ことで、左端の薄紫ストライプが自動的に全ページに入ります。

### 主要ヘルパー一覧

| ヘルパー | やること | 使う場所 |
|---------|---------|---------|
| `addChrome(s, pageNum)` | ロゴ・フッター・ページ番号・左ストライプを一括追加 | 表紙・閉じなど |
| `addChromeWithNav(s, pageNum, sectionIdx)` | 上記 + 上部ナビチップ | 本編スライド |
| `addChromeNav(s, sections, idx)` | 上部ナビチップだけ追加 | ナビだけ欲しい時 |
| `addTitleBlock(s, title, sub, opts)` | タイトル + サブコピー下敷き | 全本編スライド |
| `setCanvasBg(s)` | オフホワイト背景を設定 | 全スライド |
| `addChromeLeftStrip(s)` | 左端のストライプだけ追加 | 表紙など個別使用 |

### なぜ関数化するか — 3 つの理由

**1. 一貫性の担保**
左端ストライプを毎スライドで `addShape({ x:0, y:0, w:0.12, h:5.625, fill:{color:'F3E7FE'}, ... })` と書いていたら、どこかでタイポや値のズレが起きる。関数 1 つに閉じ込めれば、全ページで **同じ値が保証される**。

**2. 変更の波及**
「左ストライプの幅を 0.15 にしたい」という要望が来たら、`tokens.js` の `stripeW` を変えるだけで全スライドに反映。コードを各所書き換えなくていい。

**3. 可読性**
```javascript
// これは何？
slide.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 0.12, h: 5.625,
  fill: { color: 'F3E7FE' }, line: { type: 'none' },
});

// これなら一瞬で分かる
addChromeLeftStrip(slide);
```

---

## レイヤー 3 — PptxGenJS の主要 API

Claude が頻繁に使う API を整理しておきます。

### 形状（Shape）の追加

```javascript
slide.addShape(pres.shapes.RECTANGLE, {
  x: 0.4, y: 1.0,          // 左上の座標（インチ）
  w: 3.0, h: 1.5,          // 幅・高さ（インチ）
  fill: { color: 'F3E7FE' },   // 塗り
  line: { color: '9212F3', width: 0.5 },  // 枠線
});
```

使える shape の種類：
- `RECTANGLE` — 角のある矩形
- `ROUNDED_RECTANGLE` — 丸角矩形（`rectRadius: 0.12` で指定）
- `OVAL` — 楕円・円
- `LINE` — 直線（`w` だけだと水平線、`h` だけだと垂直線）

### テキストの追加

```javascript
slide.addText('タイトル', {
  x: 0.4, y: 0.5, w: 9.2, h: 0.5,
  fontSize: 20,
  color: '000000',            // テキスト色（# なし）
  fontFace: 'Noto Sans JP',   // フォント名
  bold: true,
  align: 'left',              // left / center / right
  valign: 'top',              // top / middle / bottom
  margin: 0,                  // テキストボックス内の内側余白
});
```

**Rich Text**: 色やスタイルを部分的に変えたい時は配列で渡す：

```javascript
slide.addText([
  { text: '総予算 ', options: { color: '000000' } },
  { text: '585', options: { color: '9212F3', bold: true, fontSize: 24 } },
  { text: ' 万円', options: { color: '000000' } },
], { x: 0.4, y: 1.0, w: 4, h: 0.5, fontFace: 'Noto Sans JP' });
```

### 画像の追加

```javascript
slide.addImage({
  path: 'assets/logos/horizontal-black.jpg',
  x: 8.06, y: 0.20,
  w: 1.54, h: 0.32,          // ← ロゴはアスペクト比を守る
});
```

**ロゴのアスペクト比**: `horizontal-black.jpg` は 2880×600px = 4.80:1。スライド上でも `w / h = 4.80` を守らないと潰れる。tokens で統一された値（1.54 × 0.32 = 4.8125）を使う。

### チャート・テーブル

```javascript
// ドーナツチャート
slide.addChart(pres.charts.DOUGHNUT, [{
  name: '予算内訳',
  labels: ['A', 'B', 'C'],
  values: [31.5, 31.5, 37.0],
}], {
  x: 5, y: 1.5, w: 4.5, h: 3,
  chartColors: ['9212F3', 'F59E0B', '374151'],
  holeSize: 55,
});

// テーブル
slide.addTable([
  [
    { text: '項目', options: { bold: true, fill: { color: 'F3F4F6' } } },
    { text: '金額', options: { bold: true } },
  ],
  ['月額稼働費', '135 万円'],
  ['マイルストーン達成報酬', '最大 500 万円'],
], {
  x: 0.4, y: 2.0, w: 9.2, colW: [2.5, 6.7],
  fontSize: 11, fontFace: 'Noto Sans JP',
  border: { type: 'solid', color: 'E5E7EB', pt: 0.5 },
});
```

---

## 安定再現の 5 つのルール

### ルール 1 — 色は必ずトークン経由

```javascript
// ❌ ダメ
fill: { color: '9212F3' }

// ✅ OK
fill: { color: C.purple }
```

理由: 将来ブランド変更があっても、tokens.js 1 箇所変えれば済む。色名で書くと意味も明確。

### ルール 2 — フォントは毎回 `Noto Sans JP` を明示

```javascript
// ❌ fontFace 省略すると PowerPoint のデフォルトフォント（Calibri）になる
slide.addText('タイトル', { x: 0.4, y: 0.5, fontSize: 20, bold: true });

// ✅ 必ず明示
slide.addText('タイトル', {
  x: 0.4, y: 0.5, fontSize: 20, bold: true,
  fontFace: F.jp,  // = 'Noto Sans JP'
});
```

**これが抜けるとブランドが崩壊する**ので、全 `addText` 呼び出しで `fontFace: F.jp` を忘れない。

### ルール 3 — 座標はトークン由来、ハードコードしない

```javascript
// ❌ どこの値か分からない
slide.addShape(..., { x: 0.4, y: 0.55, ... });

// ✅ 意味が伝わる
slide.addShape(..., { x: L.marginX, y: L.titleBlockY, ... });
```

**例外**: 単発の微調整（`y: L.contentY + 0.05` のような相対値）は OK。絶対値の 0.4 みたいなハードコードを避けるのが大事。

### ルール 4 — 座標は「左上起点」で考える

PptxGenJS の `x, y` は要素の **左上角** の座標。中央揃えで配置したいときは自分で計算：

```javascript
// スライド中央に幅 4 のボックスを置きたい
const boxW = 4;
const boxX = (10 - boxW) / 2;  // = 3
slide.addShape(..., { x: boxX, y: 2, w: boxW, h: 1 });
```

### ルール 5 — 色には `#` を付けない

```javascript
// ❌ PowerPoint は # を理解しない
fill: { color: '#9212F3' }

// ✅
fill: { color: '9212F3' }
```

`tokens.js` で `purple: "9212F3"` と書いてあるのはこのため。

---

## 典型的な失敗パターンと対処

### 失敗 1 — 日本語が化ける／全角英数が変に見える

**原因**: `fontFace` が省略されていて、PowerPoint 側で Calibri などで表示された

**対処**: 全 `addText` で `fontFace: F.jp` を指定する

### 失敗 2 — ロゴが潰れている

**原因**: `w` と `h` のアスペクト比が実画像と合っていない

**対処**: ロゴ画像の実寸を確認し、比率を守る
```bash
python3 -c "from PIL import Image; im = Image.open('horizontal-black.jpg'); print(im.size, im.size[0]/im.size[1])"
# → (2880, 600) 4.80 の場合は w/h = 4.80 を守る
```

### 失敗 3 — 要素が重なる

**原因**: 複数要素が近い y 座標を持ち、高さの計算が甘い

**対処**: `contentY` からの相対指定にして、直前の要素の `y + h + gap` を次の `y` にする
```javascript
let cursorY = L.contentY;
slide.addText('見出し', { x: L.marginX, y: cursorY, w: 9, h: 0.4, ... });
cursorY += 0.4 + 0.1;  // 前の要素の h + gap
slide.addText('本文', { x: L.marginX, y: cursorY, w: 9, h: 1.0, ... });
```

### 失敗 4 — 色が微妙に違う

**原因**: `tokens.js` の色を直接使わず、自分で 16 進を書いた（タイポ）

**対処**: `C.purple` などトークン経由に戻す。色コード直書きは禁止。

### 失敗 5 — ナビチップがはみ出る

**原因**: 日本語 4〜5 文字程度を想定した固定幅だと、6 文字以上のラベルで溢れる

**対処**: `addChromeNav` は **文字数に応じた自動幅計算** を持つ。ラベルに合わせて `calcW(text)` が幅を返す
```javascript
const calcW = (text) => Math.max(0.9, text.length * 0.14 + 0.35);
```

---

## 独自テンプレを追加する時の手順

既存テンプレで足りない新パターンを足したい場合：

1. **トークンで間に合うか確認** — 新色や新サイズが必要なら `tokens.js` に追加
2. **表現パターンとして分解** — 「このテンプレは何と何の組み合わせか？」を `design-system.md` で照合
3. **`example-deck.js` に新テンプレの `{}` ブロックを追加**
   ```javascript
   {
     const s = pres.addSlide;
     setCanvasBg(s);
     addTitleBlock(s, 'タイトル', 'サブコピー');
     // ... 本編
     addChromeWithNav(s, pageNum, sectionIdx);
   }
   ```
4. 生成して視覚確認 → 問題なければドキュメントも更新

---

## 生成〜検証のループ

デッキを 1 枚作るとき Claude は以下のループを回します：

```
1. example-deck.js 風のコードを書く
2. Node.js で実行して .pptx を出力
3. soffice で PDF 変換 → pdftoppm で JPG 化
4. 画像を目視確認
5. 問題があれば 1 に戻る
```

この検証ループは `scripts/example-deck.js` をリファレンスとして使うと効率的。新テンプレを作るときも、既存テンプレと並べて視覚確認できる。

---

## まとめ — なぜ安定するのか

- **Single Source of Truth**: 色・サイズは `tokens.js` だけが真実。どこにも重複させない
- **薄いヘルパー**: PptxGenJS を直接使うので、裏で起きることが明示的
- **宣言的スタイル**: 各スライド生成は独立した `{}` ブロック。副作用なし
- **視覚検証の自動化**: 生成 → PDF → 画像化のパイプラインで regression を即検知

これらを守れば、ブランドの崩れや「前はできたのに今回できない」現象を最小化できます。

---

## もっと学ぶには

- **PptxGenJS 公式ドキュメント**: https://gitbrent.github.io/PptxGenJS/
- **本スキルの他の参照**:
  - `workflow.md` — 資料作成の思考手順（技術ではなく設計の話）
  - `design-system.md` — 3 層構造と表現パターン
  - `slide-patterns.md` — テンプレの使い分け
  - `pptx-patterns.md` — PptxGenJS の具体的なコードパターン集
