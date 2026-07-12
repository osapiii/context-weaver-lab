# Phase 4 — HTML 補足レポート (`レポート.html`)

> Phase 2 で各スライドに `html_supplement` を仕込み、Phase 4 (build-deck-package)
> で `decks/{slug}/レポート.html` に自動集約される。

## 位置づけ

| | PPTX (資料.pptx) | HTML (レポート.html) |
|---|---|---|
| 役割 | SSOT (single source of truth) | PPTX のサプリメント |
| 読まれ方 | 単独で読める / 講演で投影 | PPTX とセットで読む |
| 情報密度 | 1 スライド = 1 メッセージ | 補足要りのスライドのみ深掘り |
| 単独完結 | ✅ | ❌ (PPTX 前提) |

**HTML 単独で読んで完全に理解できる必要はない**。PPTX の「ここは噛み砕きたい」と
判断したスライドにだけ supplement を貼る運用。

## いつ補足を入れるか — Phase 2 判定基準

各スライドに対して以下を順に確認し、どれか 1 つ当てはまれば `enabled: true` に切り替える。

| 観点 | 例 |
|---|---|
| 数値・公式が密集 | LED 用抵抗値の早見表、メトリクスの数式集 |
| 表が複雑で PPTX に収まらない | カラーコード全色、ツール比較表、スペック表 |
| コード例があるが PPTX には数行しか入らない | YAML 定義、Arduino スケッチ、SQL クエリ、CI 設定 |
| 引用元の deep dive が要る | 公式ドキュメント、ショップリンク、追加レファレンス |
| 章レベル読書ガイドが要る | 章をまたぐ補足は `chapter.html_supplement` (or `section.html_supplement`) |

### 補足が要らないと判定する典型例

- 章扉 (SECTION-2)
- SECSUMMARY-1 (主役ビジュアル一発)
- 章の持ち帰り (FRAMING-5)
- 表紙・目次 (SECTION-1 / SECTION-6)
- 会社紹介 (FRAMING-3)
- シンプルな結論ページ

## スキーマ (plan.json)

### スライドスコープ

```json
{
  "id": "S13",
  "template_id": "DATA-2",
  "title": "...",
  "html_supplement": {
    "enabled": true,
    "kind": "data-table",
    "reason": "PPTX では1行で済む計算を、抵抗値別の早見表で噛み砕く。",
    "content_md": "## 見出し\n\n本文 (Markdown)。コードブロック / 表 / リスト / 引用 / リンク。",
    "tables": [
      {
        "caption": "5V 電源時の電流早見表",
        "headers": ["抵抗 (Ω)", "電流 (mA)", "判断"],
        "rows": [["220", "40.9", "❌過電流"], ["330", "27.3", "△許容"]]
      }
    ],
    "charts": [
      {
        "type": "bar",
        "title": "抵抗値 vs 電流",
        "labels": ["220Ω", "330Ω", "470Ω"],
        "series": [{ "name": "電流(mA)", "data": [40.9, 27.3, 19.1] }]
      }
    ],
    "references": [
      { "title": "KOA 公式", "url": "https://...", "note": "..." }
    ]
  }
}
```

### 章スコープ (`body.chapters[i].html_supplement` or `sections[i].html_supplement`)

章に関する読書ガイドや、章をまたぐ補足を書く時に使う。
スキーマはスライドスコープと同じ。

## 中身の書き方 — content_md ガイド

### 使えるマークダウン

- 見出し: `# / ## / ### / ####`
- 強調: `**bold**` / `*italic*` / `` `inline code` ``
- リスト: `-` / `*` / `1.`
- フェンスコードブロック: ` ```python ... ``` ` (コピーボタン自動付与、シンタックスハイライト無し)
- パイプ表: 自動で sortable に
- 引用: `> ...`
- リンク: `[text](url)`
- 水平線: `---`

### kind の値 (バッジ表示)

| kind | バッジ色 | 使う時 |
|---|---|---|
| `code` | 黒×アンバー | コード全文・YAML 例・スケッチ |
| `data-table` | アンバー | 大きな表・早見表・比較表 |
| `deepdive` | ピンク | 概念の長文解説・読書ガイド |
| `reference` | 紫 | 引用元集・ショップリンク集 |
| `chart` | グリーン | グラフ主体のスライド |

### 字数の目安

- スライド単位: 800〜3,000 字 (PPTX の 5〜15 倍)
- 章単位 (読書ガイド): 400〜1,500 字
- **HTML 単独で読み通せる必要はない**。PPTX から飛んできて、深掘りしたい人がじっくり読む想定

## 生成 (CLI)

### 単独実行

```bash
node scripts/render/build-html-report.js --plan decks/{slug}/plan.json
```

- 出力: `decks/{slug}/レポート.html` (single-file)
- `--out` で出力パスを上書き可能
- `enabled: true` が 0 件なら **自動スキップ**

### Phase 4 自動実行

`build-deck-package.js` の `[5/6]` ステップで自動呼び出し:

```
[1/6] 資料.pptx を昇格
[2/6] plan.html を配置
[3/6] preview/ を生成
[4/6] 生成メモ.md を抽出
[5/6] レポート.html を生成   ←
[6/6] スライドQA.csv を生成
```

## サンプル

| デッキ | 全スライド | enabled=true | 章レベル | 出力サイズ |
|---|---|---|---|---|
| 抵抗デッキ (resistor-electronics-basics) | 37 枚 | 13 枚 | 1 件 | 72 KB |
| dbt SL ガイド (dbt-semantic-layer-complete-guide) | 64 枚 | 10 枚 | 2 件 | 65 KB |
