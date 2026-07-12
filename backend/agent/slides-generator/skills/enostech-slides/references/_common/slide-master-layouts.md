# SlideMaster ネイティブ統合

## なにができるか

PowerPoint で `*.pptx` を開いて「ホーム → 新しいスライド ▼」を押すと、**ENOSTECH 39 種のテンプレ** がドロップダウンに直接並ぶ。クリックすればその場で空白スライドが追加され、placeholder にテキストを入れていくだけで ENOSTECH ブランドのスライドが完成する。

SlideMaster で表現困難なテンプレ (SCENE / DIAGRAM / CHART / SVG VISUAL / PROJECT / CODE / QA-INDEX) は `catalog.pptx` (テンプレ集) からコピペで利用する。

---

## 仕組み

`build-deck.js` 冒頭で `pres.defineSlideMaster` を 39 回呼んで PptxGenJS に登録する。PptxGenJS の `defineSlideMaster` は内部実体としては PowerPoint の `slideLayout` として書き出されるため、PowerPoint は「ホーム → 新しいスライド ▼」のドロップダウンに全レイアウトを並べる。

既存の `pres.addSlide` (master 指定なし) は default master にバインドされ、新しい SlideMaster 群とは無関係に動作する。

---

## 命名規約

```
ENOSTECH NN-カテゴリ — テンプレID 説明
```

例:
- `ENOSTECH 01-表紙 — 標準 (SECTION-1)`
- `ENOSTECH 01-表紙 — A バリアント (大タイトル中央) (SECTION-1A)`
- `ENOSTECH 02-章扉 — 標準 (SECTION-2)`
- `ENOSTECH 05-リスト — 3 カラム (LIST-2)`

PowerPoint UI のドロップダウンは文字列ソートなので、`NN-` プレフィックスでカテゴリ順に並ぶ。

---

## 登録される 39 レイアウト一覧

| 分類 | テンプレ ID | レイアウト名 |
|---|---|---|
| 01-表紙 (8) | SECTION-1 | 標準 |
| | SECTION-1A | A バリアント (大タイトル中央) |
| | SECTION-1B | B バリアント (左寄せ強) |
| | SECTION-1C | C バリアント (短縮タイトル) |
| | SECTION-1D | D バリアント (1 行ピッチ) |
| | SECTION-1E | E バリアント (3 行サブ) |
| | SECTION-1F | F バリアント (アクセント大) |
| | SECTION-1G | G バリアント (シンプル) |
| 02-章扉 (4) | SECTION-2 | 標準 |
| | SECTION-3 | クロージング |
| | SECTION-4 | バリアント A |
| | SECTION-5 | バリアント B |
| 03-目次 (1) | SECTION-6 | 目次 |
| 04-フレーミング (5) | FRAMING-1 | 制作背景 |
| | FRAMING-2 | Before/After |
| | FRAMING-3 | 会社概要 |
| | FRAMING-4 | おみやげ |
| | FRAMING-5 | チェックリスト |
| 05-リスト (7) | LIST-1 | 本文 |
| | LIST-2 | 3 カラム |
| | LIST-3 | カードグリッド |
| | LIST-4 | カードスタック |
| | LIST-5 | タイル 2x2 |
| | LIST-6 | タイル 3x2 |
| | LIST-8 | 詳細カード |
| | LIST-9 | アイコン 3 カラム |
| 06-比較 (5) | COMPARE-2 | Before/After 簡易 |
| | COMPARE-1 | Before/After 詳細 |
| | COMPARE-3 | アイコン |
| | COMPARE-4 | トレードオフ |
| | COMPARE-5 | グルーピング |
| 07-データ (4) | DATA-1 | キー/値 |
| | DATA-2 | 表 |
| | DATA-4 | 参考文献 |
| | DATA-5 | 用語集 |
| 08-ビジュアル (3) | VISUAL-1 | プロフィール |
| | VISUAL-3 | メインビジュアル |
| | VISUAL-5 | 分割 画像/本文 |
| 09-Web (1) | WEBPAGE-1 | サマリー |

---

## catalog.pptx 残置テンプレ

以下は SlideMaster で表現困難なため、catalog.pptx からコピペ:

- **SCENE-01〜06** (6 種): 動的フローダイアグラム、人物アイコン × 矢印など
- **DIAGRAM-1〜4 + secsummary** (5 種): matrix / flow / flowchart / illustration
- **CHART-A1〜A4** (4 種): 凡例とバインド済み chart object
- **VISUAL-9〜12** (4 種): SVG 系 (resvg で PNG 化して埋め込む)
- **WEBPAGE-2〜4** (3 種): card-grid / detail / compare
- **PROJECT-1〜4** (4 種): タイムライン
- **CODE-1〜7** (7 種): 構文 colorize がテキスト中心で master 表現に向かない
- **QA-INDEX** (1 種): questions[] 数で動的
- **LIST-7** (タイル 3x3): 36 placeholder で UI 過負荷のため見送り

合計 **34 種**は catalog.pptx 経由。

---

## opt-out

特定デッキで SlideMaster 登録を無効化したい場合:

```json
{
  "doc": {
    "title": "...",
    "embed_master_layouts": false
  }
}
```

default は `true`。opt-out 時は SlideMaster なしで pptx が出力される。

---

## ファイルサイズへの影響

39 レイアウト分の XML で **約 +350 KB** (固定)。レイアウト数を増やすと比例。
