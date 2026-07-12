# PptxGenJS 実装スニペット集

> **`scripts/example-deck.js` が全パターンを一本のデッキに実装した正解リファレンス**。
> このファイルは「核となる規約」「共通ヘルパー」「設計原則」のみを扱う。
> 個別パターンの詳細コードは example-deck.js を直接参照すること。

---

## 主要規約（絶対に守る）

1. **フォント: 全テキストに `fontFace: "Noto Sans JP"` を指定**（Yu Gothic UI は使わない）
2. **マージン: 0.4"（tokens.js の `L.marginX`）**。0.55 に戻さない
3. **タイトルブロック起点: y=0.55**（`L.titleBlockY`）。下寄りにしない
4. **サブコピー: `addTitleBlock` が 1〜4 行で動的高さ**
   - 1 行 = 0.52", 2 行 = 0.74", 3 行 = 0.96", 4 行 = 1.18"
   - 推奨文字数 120〜200 字（最大 250）
   - 短すぎる言い切り 1 文（30 字以下）は禁止
5. **コンテンツ開始: 動的 or 状況別固定値**
   - 1 行サブコピー想定: `L.contentY`（1.65"）
   - 2 行サブコピー想定: `L.contentYRoomy`（1.95"）
   - 3 行以上: `addTitleBlock(...)` の戻り値を直接受ける（推奨）
6. **eyebrow（英字小ラベル）を使わない**。タイトル + サブコピーの 2 階層構造だけ

---

## 共通セットアップ

```javascript
const pptxgen = require('pptxgenjs');
const T = require('../assets/tokens');

const pres = new pptxgen;
pres.layout = 'LAYOUT_16x9';
pres.title  = 'ENOSTECH サンプル資料';
pres.author = 'ENOSTECH';

// トークンのショートハンド
const L  = T.layout;
const C  = T.color;
const F  = T.font;
const SZ = T.size;

const TOTAL  = 20;                   // 総ページ数
const FOOTER = 'ENOSTECH 資料';
```

---

## 共通ヘルパー（example-deck.js 冒頭と同じ）

```javascript
/** 右上のロゴを配置 */
function addChromeLogo(slide) {
  slide.addImage({
    path: T.logoPath('horizontalBlack'),
    x: 8.3, y: 0.22,
    sizing: { type: 'contain', w: 1.3, h: 0.28 },
  });
}

/** 左下フッター */
function addChromeFooter(slide, text) {
  slide.addText(text, {
    x: L.marginX, y: L.footerY, w: 5, h: L.footerH,
    fontSize: SZ.caption, color: C.gray400, fontFace: F.jp,
    align: 'left', margin: 0,
  });
}

/** 右下ページ番号 */
function addChromePage(slide, current) {
  slide.addText([
    { text: String(current).padStart(2, '0'), options: { bold: true, color: C.gray500 } },
    { text: ` / ${TOTAL}`, options: { color: C.gray400 } },
  ], {
    x: 8.3, y: L.footerY, w: 1.3, h: L.footerH,
    fontSize: SZ.caption, fontFace: F.jp, charSpacing: 1,
    align: 'right', margin: 0,
  });
}

function addChrome(slide, pageNum) {
  addChromeLogo(slide);
  addChromeFooter(slide, FOOTER);
  addChromePage(slide, pageNum);
}

/** タイトル配置（上寄り・コンパクト） */
function addTitle(slide, text) {
  slide.addText(text, {
    x: L.marginX, y: L.titleY, w: 8, h: L.titleH,
    fontSize: SZ.titleL, color: C.ink, fontFace: F.jp,
    bold: true, margin: 0, valign: 'top',
  });
}

/** サブコピー（タイトルの理由・補足） */
function addLead(slide, text) {
  slide.addText(text, {
    x: L.marginX, y: L.leadY, w: 9.2, h: L.leadH,
    fontSize: SZ.lead, color: C.gray500, fontFace: F.jp,
    margin: 0,
  });
}
```

---

## タイトル + サブコピーの書き分け原則

### タイトルに書くこと

**そのスライドで読者に伝えたい 1 つの主張**。体言止めを避け、動詞・言い切りで締める。20〜30 字。

```
❌ "FactHub の機能"                              （弱い、情報感のみ）
❌ "Product Detail"                             （横文字禁止）
✅ "FactHub で、分析の時間を 10 分の 1 に"       （強い、主張感）
✅ "SQL を書く時間がない、のお悩みから解放"     （読者の痛みに触れる）
✅ "6 つの機能で、分析業務を一気通貫"            （網羅性 + 動詞）
```

### サブコピーに書くこと

**読者がスライド単独で内容を理解できる説明**。120〜200 字推奨、最大 250 字まで許容。
1 文の言い切りではなく、3〜4 要素（具体／なぜ・どうやって／読後の変化／逆接・対比）を含む。

```
❌ タイトルの言い換え                            （情報量ゼロ）
❌ 短すぎる 1 文（「30 分の作業が 2 秒に」）    （視線が滑り、伝わらない）
❌ 読者へのコンテキスト説明から始まる長文      （サブではなく本文）

✅ 具体 + なぜ + 読後の変化（90〜100 字）
   "Excel で 30 分かかっていた月次集計が、FactHub に話しかけるだけで 2 秒で完了。
    SQL 担当者の手を借りる必要もなくなり、現場で完結する分析が当たり前になります。"

✅ 具体 + どうやって + 読後の変化（90〜100 字）
   "BigQuery への問い合わせ設計から SQL 実行・グラフ化まで、対話 1 回で完結。
    これまで 1 時間かかっていた典型的な分析タスクが平均 6 分に短縮され、
    思考のリズムが切れません。"

✅ 具体（業種規模・人物） + 読後の変化（100〜110 字）
   "事業会社の B 社（従業員 200 名）情シス担当 H さんは、設備データの集計に毎週
    2 時間かかっていました。FactHub 導入後はチャット 3 往復で完了。空いた時間が
    改善活動に回り、現場の主導権が戻りました。"
```

詳細は `references/phase2-information-design/README.md` R2-4 と
`references/_common/brand-tokens.md` §2。

---

## ビジュアル主体パターンのスニペット

```javascript
{
  const s = pres.addSlide;
  s.background = { color: C.white };

  // タイトル + サブコピー（コンパクトに）
  addTitle(s, 'FactHub が作るのは、こんなレポートです');
  addLead(s, '与えられた問いに対して、示唆まで含めて自動生成します。');

  // ── 中央大ビジュアル領域 ──
  // 実運用では画像を配置:
  //   s.addImage({
  //     path: '/path/to/screenshot.png',
  //     x: 0.9, y: 1.35, w: 8.2, h: 3.5,
  //     sizing: { type: 'contain', w: 8.2, h: 3.5 },
  //   });
  //
  // モック用（影付き枠のみ置く場合）:
  const vizX = L.marginX + 0.5;
  const vizY = L.contentY + 0.1;
  const vizW = 10 - L.marginX*2 - 1.0;
  const vizH = L.contentBot - vizY - 0.1;

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: vizX, y: vizY, w: vizW, h: vizH, rectRadius: 0.14,
    fill: { color: C.gray50 },
    line: { color: C.gray200, width: 0.5 },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 90, opacity: 0.06 },
  });

  addChrome(s, 20);
}
```

### ビジュアル主体パターンの設計原則

1. **ビジュアルが主役** — タイトル・サブコピー以外の本文テキストを置かない
2. **影は控えめに** — `opacity: 0.06`〜`0.08` 程度。強い影は安っぽい
3. **外周ボーダーで境界を明確に** — `ROUNDED_RECTANGLE` + `line: { color: gray200 }`
4. **連続配置は 2 枚まで** — 3 枚以上続けると単調。LIST-1 や LIST-5 を挟む
5. **余白を十分取る** — ビジュアルの左右に 0.5" 以上のマージン

---

## 個別パターンのコード

**すべて `scripts/example-deck.js` に実装済み**。コピー元として使うのが最速。
テンプレ ID で grep するのが早い。

---

## PptxGenJS 共通の落とし穴

1. **`"#"` 付き hex を使わない** — `"#9212F3"` は NG、`"9212F3"` で書く
2. **8 桁 hex を使わない** — `"9212F3FF"` は NG
3. **`ROUNDED_RECTANGLE` と左ボーダーは併用できない** — 必要なら外側を `RECTANGLE` で、内側にもう 1 枚配置
4. **shadow オプションを複数の shape でオブジェクト共有しない** — mutate されるので毎回 fresh に書く
5. **fontFace を省略すると英字フォントになる** — 日本語テキストは必ず `fontFace: F.jp` を指定
6. **addTable の highlight は cell 単位** — rich text 内の `highlight` は動くが `fill` は動かないので注意
