---
name: enostech-svg-diagram
description: "スライドや資料に埋め込む「ダイアグラム・図解・挿絵」を SVG ベースで生成するスキル。cloudDesign 流の制約セット (3-4色 / 線2px・3px / marker 1種 / シェイプは矩形・円・直線・三角・Q曲線 / dasharray '4 4') を機械検証 (SchemaQA fatal) で守る。SVG → PNG 変換 (resvg-js / sharp) → addImage で pptx に埋め込むのが標準経路。**v1.13〜: SchemaQA pass 後・PNG 変換前に `/design:design-critique` を 1 度回し、Critical/Moderate Recommendation を SVG に反映してから本番 PNG 化するフローを必須化** (SVG 固有の focus 指示テンプレ付き、critique-report.md 出力義務)。データパイプライン・歯車的処理・キュー・グラフ風アイコン・電子回路・物理イメージなど「絵としての説得力」が要る図に向く。enostech-slides からデフォルトで呼ばれる子スキルとして動く。VISUAL系スライドの図解は「SVG (このスキル) → DIAG (シェイプ) → CHART → テーブル」の優先順位で、SVG が第一候補。「PowerPoint 上で文字を後から直したい」とユーザーが明示した時のみ DIAG (シェイプ) を使う。"
---

# enostech-svg-diagram — SVG ベースのダイアグラム生成スキル

cloudDesign 流の「シェイプを絞る・色を絞る・装飾を統制する」制約セットで、品質の高い
SVG ビジュアルを安定して生成するためのスキル。enostech-slides から子スキルとして
呼ばれることを想定するが、単体でも (docx・blog・OGP 画像など) 利用可能。

---

## 🚨 SVG を書く前に必ず読む 2 ファイル (これを飛ばすと表現力が落ちます) ⭐ v1.12

このスキルが「絵としての説得力」を出すためのレシピは、**SKILL.md の制約表だけでは
足りません**。R-SVG-1〜R-SVG-22 は「**やってはいけないこと** (下限ガード)」のリストで、
「**やったら表現力が出るレシピ** (上限の伸ばし方)」は references/ に分離されています。

書き始める前に、以下の 2 ファイルを必ず Read してください:

### 必読 1: `references/how-to-write-svg.md` — 実践レシピ集
- viewBox は **1920×1080** (16:9 / v1.3 標準)。1400×760 は古い設定で表現力が落ちる
- フォント階層: タイトル **40-48px** / サブヘッダー 26-32px / 本文 22-26px /
  補足 18-20px / 注記 16-18px (16px 未満は fatal)
- **コツ 1: Q 曲線で動きを出す** (アンテナ波・流路の表現)
- **コツ 2: 並んだ箱 + 点線の箱 = キュー**
- **コツ 3: 円 + 8 本の線 = 歯車** (処理の表現)
- **コツ 4: path で円筒** (DB / DWH の表現)
- **コツ 5: 折れ線グラフを直接描く** (ダッシュボード感)
- 強度 3 段階 (強=塗り 1-2 箇所 / 中=線・枠 / 弱=gray100 補助)
- ありがちな失敗 8 パターン (R-SVG-1〜12 をなぜ守るかの理由付き)

### 必読 2: `references/pattern-catalog.md` — 題材別パターン集
- SVG が圧倒的に向く題材 / 向かない題材の判断フロー
- **SECSUMMARY-1 専用パターン** (章扉直後の主役ビジュアル一発、v9.4 規範)
- カード背景配色マトリクス (R-SVG-16 の OK / NG パターン)
- 既存 SVG の good example へのポインタ

これを飛ばして SKILL.md の表だけで書くと、**縦充填率 60% 止まり / 3 段構造止まり /
フォント小さめ / カード薄味** の表現力低下版になります (cloudDesign 流の本来の力が出ない)。

### 量産モードに入らない (1 SVG = 1 構造設計)

複数枚の SVG を一気に作りたくなる時、**Python ヘルパーで量産する誘惑**が強いですが
これは禁止です (enostech-slides の C-15 / 当スキルの v1.12 申し合わせ)。

理由: Python f-string で量産すると、各 SVG の構造が共通テンプレに引っ張られ、
題材ごとの最適な構造設計 (timeline は横軸が主役 / hierarchy は中央が主役 /
matrix は 2 軸対比が主役) が失われ、全 SVG が「カード並列の 3 段構造」に収束します。

**鉄則**: 1 枚ずつ手書きで構造設計してください。

```
やる:
  Q1.svg を書く → SchemaQA pass → 出来栄え確認 → Q2.svg を書く → ... の逐次

やらない:
  /tmp/write_svgs.py で 8 枚同時生成 → SchemaQA pass のみ確認
```

題材ごとに「主役は何か」を 1 行書き出してから書き始めると、共通テンプレ化を防げます。

---

## このスキルの位置づけ

```
図解の優先順位 (R-FIG-PRIORITY、enostech-slides v6.83〜):
  ① SVG (このスキル)                    ← デフォルト・絵としての説得力
  ② DIAG (シェイプ、enostech-slides)    ← ユーザー明示時のみ
  ③ CHART (定量データのみ)
  ④ データテーブル (最後の砦)
```

VISUAL 系スライドに図を入れたくなったら、**まずこのスキルで SVG を組む**。
シェイプ (DIAG-XX) は「PowerPoint 上で発表後に文字を直したい」とユーザーが明示した時の
フォールバックに降格した (v6.83〜)。

## なぜ SVG が第一候補なのか

| | SVG (このスキル) | DIAG (シェイプ) |
|---|---|---|
| 絵としての説得力 | ◎ path / Q 曲線で歯車・アンテナ波・グラフの折れ線まで描ける | △ Unicode 記号 (▤ ☁ ⟿) に依存しがち |
| 編集可能性 | △ 画像扱い (Nanobanana で別経路修正) | ○ pptx ネイティブで文字編集可能 |
| 品質安定性 | ◎ SchemaQA fatal で制約強制 | ○ atom 関数 30 個で品質均一化 |
| 表現の幅 | ◎ 任意の path 描画 | △ pptxgenjs 既定 shape のみ |

osanai さんは Nanobanana で SVG ラスタライズ後の修正経路を持つため、編集可能性の
不利は許容。「絵としての説得力」を最優先する方針。

## 制約セット (cloudDesign 流、SchemaQA fatal)

下記 6 項目は SchemaQA で機械検証され、違反すると render が止まる。

| ID | 観点 | ルール | severity |
|---|---|---|---|
| R-SVG-1 | 色 | 同時使用色数は 4 色まで (canvas 除く)。palette トークン外は warn | fatal (>4) / warn (token外) |
| R-SVG-2 | 線の太さ | `stroke-width` は 2 または 3 のみ | fatal |
| R-SVG-3 | 矢印 | `<marker>` は 1 種類だけ定義し使い回す | fatal |
| R-SVG-4 | 座標 | `viewBox` 必須 | fatal |
| R-SVG-5 | 装飾線 | `stroke-dasharray` は `"4 4"` のみ | fatal |
| R-SVG-6 | シェイプ | `<rect> <circle> <line> <polygon> <ellipse> <path>` のみ。装飾形状禁止 | fatal |
| R-SVG-7 | フォント | `Noto Sans JP` / `JetBrains Mono` のみ | warn |
| **R-SVG-8** ⭐ v1.1 | テキスト重なり | テキスト bbox は他の塗り面・別テキストと衝突しない | fatal |
| **R-SVG-9** ⭐ v1.1 | 強調塗り面積 | brand+accent 塗りは viewBox の 15% 以下 | fatal |
| **R-SVG-10** ⭐ v1.1 | 大塗りの数 | brand+accent の大塗り (面積 ≥ 2%) は最大 2 個 | warn |
| R-SVG-11 ガイドライン | 強調手段 | 強調は塗りより線。「主役の主役」だけ塗り | guideline (検証なし) |
| **R-SVG-12** ⭐ **v1.5 改訂** | 強調塗りの色 | ink (#1F2937) 塗りは **全面禁止**。強調塗りは gray800 (#374151) または gray700 (#4B5563) を使う | fatal |
| **R-SVG-13** ⭐ v1.2 | フォントサイズ | 11px 未満 fatal / 13px 未満 warn (本文最低 13px、補足 12px、注記 11px) | fatal/warn |
| **R-SVG-14** ⭐ v1.2 | 強調の階層 | 最強調 = brand / 準強調 = gray700 / 本文 = ink。準強調に brand を使わない | guideline |
| **R-SVG-15** ⭐ **v1.5** | 縦充填率 | viewBox 高さの 75% 以上をコンテンツで使い切る (枠いっぱい使用) | warn |
| **R-SVG-18** ⭐ **v1.9** | 枠はみ出し | 枠付きテキストボックスからテキストがはみ出していない (内側 padding 4px / loose 2px) | fatal |
| **R-SVG-19** ⭐ **v1.9** | 線重なり | テキストと line / path / circle 周の最短距離が font-size の半分以上 | fatal |
| **R-SVG-20** ⭐ **v1.10** | 角丸推奨 | box (textbox/card) サイズの rect に rx>=4 を持たせて柔らかさを出す | warn |
| **R-SVG-21** ⭐ **v1.11** | Chip 比率 | Chip 内テキスト比率は全テキストの 10% 以下 (0% も OK) | fatal |
| **R-SVG-22** ⭐ **v1.11** | Chip padding | Chip 内テキストの横 padding は font-size × 0.6 以上 | fatal |
| **R-SVG-16** ⭐ **v1.8** | カード背景の amber 塗り禁止 | テキストを内包する rect/path に brand amber 系 (#FCD34D 〜 #B45309) を fill してはいけない (例外: 高さ < 50px の薄帯 / 面積 < 1600 px² のアイコン)。代替は 白 / 薄黄 #FEF3C7 + amber stroke / 薄グレー / dark inverse | fatal |

## 出力経路 ⭐ v1.13 で critique 段を追加

```
SVG文字列 (このスキルで生成)
   ↓
SchemaQA pass (R-SVG-1〜22 機械検証、fatal で停止)
   ↓
[v1.13〜 必須] プレビュー PNG (低解像度) を作る
   ↓
[v1.13〜 必須] /design:design-critique を SVG focus 指示付きで 1 度回す
   ↓
[v1.13〜 必須] Critical / Moderate Recommendation を SVG に反映
                + critique-report.md を SVG と同ディレクトリに出力
   ↓
[v1.13〜 必須] SchemaQA を再 pass (反映後に R-SVG-XX を割っていないか確認)
   ↓
resvg-js で PNG 変換 (300 dpi 相当、長辺 2400px 想定)
   ↓ 失敗時
sharp フォールバック
   ↓
addImage(slide, { data: 'data:image/png;base64,...', x, y, w, h })
   ↓
pptx に埋め込み完了
```

実装は `scripts/convert/svg-to-png.js`。enostech-slides から呼ぶ時は
`scripts/render/add-svg-diagram.js` の `addSvgDiagram(slide, svgString, opts)` を使う。
v1.13 から `addSvgDiagram` は critique フェーズを通過した SVG (critique-report.md が
ある SVG) しか受け付けないバリデーションを内包する想定 (移行期は warn、定着後 fatal)。

## ディレクトリ構成

```
enostech-svg-diagram/
├── SKILL.md                              ← このファイル
├── CHANGELOG.md
├── references/
│   ├── README.md                         ← いつ何を読むかインデックス
│   ├── design-rules.md                   ← cloudDesign 流の制約セット詳細
│   ├── pattern-catalog.md                ← よく使う SVG パターン集
│   └── how-to-write-svg.md               ← Claude が SVG を書く時のコツ
├── scripts/
│   ├── render/
│   │   └── add-svg-diagram.js            ← pptx 埋め込みヘルパー (enostech-slides から呼ばれる)
│   ├── convert/
│   │   └── svg-to-png.js                 ← resvg-js + sharp フォールバック
│   └── qa/
│       └── svg-schema-qa.py              ← 制約セット 6 項目を機械検証
├── assets/
│   └── tokens.json                       ← パレット (enostech-slides palette.yml と同期)
└── examples/
    └── data-pipeline.svg                 ← サンプル (動作確認用)
```

## Claude が SVG を書く時の鉄則

1. **最初に viewBox を決める**。例: `viewBox="0 0 1400 760"` (16:8.7 の横長)
2. **defs に marker を 1 種類だけ定義**。色は palette トークンから取る (token 外は warn)
3. **背景は `<rect>` で canvas 色を塗る** (palette.canvas)
4. **シェイプは矩形・円・直線・三角・Q曲線の組み合わせのみ**で描く
5. **線幅は 2px か 3px のどちらか**。混在禁止 (例外: 装飾用の細罫線も認めない)
6. **dashed は `stroke-dasharray="4 4"` のみ**。`6 4` や `8 2` は使わない
7. **テキストは Noto Sans JP** (日本語) / **JetBrains Mono** (等幅・数値) のみ
8. **完成したら必ず SchemaQA を通す**: `python3 scripts/qa/svg-schema-qa.py path/to/file.svg`
9. **SchemaQA を通したら必ず `/design:design-critique` を 1 度回す**。Critical / Moderate
   を SVG に反映し、`critique-report.md` を SVG と同ディレクトリに出力する (v1.13〜 / 詳細は次節)

詳細とコツは `references/how-to-write-svg.md`。

## 描画後の Design Critique (必須) ⭐ v1.13

SchemaQA (R-SVG-1〜22) は機械検証で「**やってはいけないこと**」を弾く下限ガード。
これだけだと「視線がどこから流れるか」「主役の主役は何か」「強調の順序は意図通りか」
「題材 (timeline / hierarchy / matrix / flow) と構造設計が噛み合っているか」といった
**人間の目で見ないと判断できない上限品質**は素通りする。

そこで **SchemaQA pass 後・PNG 変換前** に 1 度 `/design:design-critique` を回し、
Critical / Moderate の Recommendation を SVG に反映してから本番 PNG 化するフローを
**必須化** する (v1.13〜)。

### なぜ必須にしたか

- R-SVG-XX を全部 pass しても「全カードが横並びで主役が立たない」「視線が右上から
  入ってしまう」「強調が散らかっている」といった構造的な弱点は残る
- enostech-slides v9.40 で「Phase 4 を時間がないからと省略しない」を確立したのと同じ
  発想で、SVG 単体の品質ゲートも構造で強制する
- 「1 度だけ」と上限を切ることで、際限なく critique を回して時間を溶かす事故も防ぐ

### 実行フロー (1 SVG ごとに必ず)

```
1. SVG を書く
2. python3 scripts/qa/svg-schema-qa.py path/to/file.svg   → pass まで直す
3. プレビュー PNG を作る (critique 用、低解像度で OK):
     node scripts/convert/svg-to-png.js -i file.svg -o /tmp/preview.png --dpi 150
4. /design:design-critique を SVG focus 指示付きで実行 (テンプレは次項)
5. Critical / Moderate を SVG に反映 (Minor は時間が許す範囲)
6. critique-report.md を SVG と同ディレクトリに出力
7. python3 scripts/qa/svg-schema-qa.py path/to/file.svg   → 再 pass (反映で割っていないか)
8. 本番 PNG 変換 → addImage で埋め込み
```

### /design:design-critique に渡す focus 指示テンプレ

design-critique は汎用フレームワーク (First Impression / Usability / Hierarchy /
Consistency / Accessibility の 5 軸) を回す。SVG ダイアグラムでは「Usability」「Accessibility
(touch target)」は効きにくく、色 / 線 / フォントは R-SVG-XX で機械検証済み。**重複を避け、
SVG 固有の上限品質に絞り込む** ため、必ず以下の focus 指示を付けて呼ぶ:

```
/design:design-critique

Context: ENOSTECH ブランドの pptx 埋め込み用 SVG ダイアグラム。最終出力は PNG
ラスタライズ後にスライド中央配置 (約 9.20 × 4.95 inch)。viewBox は 1920×1080。
題材: <timeline / hierarchy / matrix / flow など、主役の構造を 1 行で>

対象: <path/to/file.svg のプレビュー PNG>

Focus (この観点のみ):
1. 視線誘導 — 最初に目が行く要素は意図通りか。読み順は左上→右下に流れているか
2. 視覚階層 — 主役 / 準主役 / 補助の 3 層が一目で分かるか。強調が散らかっていないか
3. 強調の整合性 — brand 塗りは「主役の主役」1〜2 箇所に集中しているか
4. 余白と密度 — 縦充填率は 75%↑ か (R-SVG-15 と整合)。逆に詰まりすぎていないか
5. 構造設計の妥当性 — 上記「題材」と構造が噛み合っているか
   (timeline → 横軸主役 / hierarchy → 中央主役 / matrix → 2 軸対比 / flow → 矢印主役)

除外 (R-SVG-XX で機械検証済みのため重複させない):
- 色数・色味の妥当性 (R-SVG-1, 9, 10, 12, 16)
- 線の太さ・矢印・dashed (R-SVG-2, 3, 5)
- フォント種・最小サイズ (R-SVG-7, 13)
- テキスト重なり / はみ出し / 線重なり (R-SVG-8, 18, 19)
- Chip 比率・padding (R-SVG-21, 22)
- 角丸 (R-SVG-20)

Severity を 🔴 Critical / 🟡 Moderate / 🟢 Minor で必ず分けて出力すること。
最後に Priority Recommendations を 3〜5 件まとめること。
```

### Recommendation 反映ルール

| Severity | 扱い |
|---|---|
| 🔴 Critical | **反映必須**。直さない場合は理由を `critique-report.md` の該当行に明記しないと進めない |
| 🟡 Moderate | **反映必須**。直すコストが効果を上回ると判断した場合のみ理由付きでスキップ可 (例: 「画面サイズ縮小で視認できないため見送り」) |
| 🟢 Minor | 判断委ね。time budget が許す範囲で対応。反映しなくても critique-report.md には記録する |

### critique-report.md 出力テンプレ

反映漏れを後から追跡できるよう、各 SVG に 1 つ critique-report.md を残す。
配置先は SVG と同じディレクトリ (例: `decks/.../Q1/Q1.svg` の隣に `Q1-critique-report.md`)。

```markdown
# Design Critique Report: <file.svg>

- 日時: 2026-mm-dd
- Reviewer: /design:design-critique (Claude Opus 4.x)
- 対象: <file.svg> (viewBox 1920×1080)
- 題材: <timeline / hierarchy / matrix / flow / ...>

## Findings

| ID | Severity | Finding | Recommendation | 反映 |
|---|---|---|---|---|
| C1 | 🔴 Critical | … | … | ✅ done / ⏭ skipped (理由: …) |
| M1 | 🟡 Moderate | … | … | ✅ done |
| m1 | 🟢 Minor   | … | … | ⏭ skipped |

## Priority Recommendations (Top 3〜5)
1. … → 反映: …
2. … → 反映: …
3. … → 反映: …

## 反映後の差分メモ
- <例: 「タイトルを 28px → 36px に底上げ」「中央のキー要素を brand 塗り 1 箇所に集約」>

## 再 SchemaQA 結果
- R-SVG-1〜22 all pass / NG があれば fix 後 再 pass まで記録
```

### Claude の振る舞い (v1.13 必須)

- SVG 1 枚完成 → SchemaQA pass まで通したら、**そこで止めずに必ず design-critique へ進む**
- 「時間がない」「軽微だから」を理由に省略しない (enostech-slides v9.40 で Phase 4 を
  勝手に省略しない申し合わせを確立した経緯と同じ)
- 量産 (1 セッションで複数 SVG) でも 1 枚ずつ逐次フロー: 1 枚目を critique → 反映 →
  critique-report.md 完成 → 2 枚目に着手。複数まとめて critique にかけない (構造設計が
  共通テンプレに引っ張られて題材固有の弱点を見落とすため)
- enostech-slides から呼ばれている場合、build-deck.js が SchemaQA → critique → 再 SchemaQA
  → PNG 変換 の順で自動実行する想定 (v1.13 対応、移行期は warn / 定着後 fatal)

## enostech-slides からの呼び方

```javascript
// enostech-slides の plan.json で diagram タイプを 'svg' にする (v6.83〜)
{
  "template_id": "ENO-47",
  "diagram": {
    "type": "svg",
    "svg": "<svg viewBox='0 0 1400 760' ...>...</svg>"
    // または svgFile: 'path/to/file.svg'
  }
}
```

build-deck.js 側が:
1. SVG を取得
2. svg-schema-qa.py で制約検証 (fatal で停止)
3. **(v1.13〜) プレビュー PNG を生成し /design:design-critique を SVG focus で 1 度回す**
4. **(v1.13〜) Critical / Moderate を反映、critique-report.md を SVG 隣に出力**
5. **(v1.13〜) svg-schema-qa.py 再 pass で R-SVG-XX を割っていないか確認**
6. svg-to-png.js で 本番 PNG 変換
7. addImage で埋め込み

の流れを自動実行する。critique フェーズは移行期は warn (critique-report.md 不在でも
通す)、定着後 fatal に切り替える。

## 単体での使い方

docx / blog / OGP 画像など、pptx 以外の用途では:

```bash
# SVG 文字列を SchemaQA で検証
python3 scripts/qa/svg-schema-qa.py path/to/file.svg

# SVG → PNG 変換 (300dpi 相当)
node scripts/convert/svg-to-png.js -i path/to/file.svg -o output.png --dpi 300
```

## バージョン履歴

- **v1.0 (2026-05-01)**: 初版。enostech-slides v7.1 と同時リリース
- **v1.1 (2026-05-01)**: R-SVG-8 (テキスト重なり) / R-SVG-9 (brand 塗り 15%) /
  R-SVG-10 (大塗り個数) / R-SVG-12 (ink 塗り 5%) の 4 つの機械検証ルールを追加。
  osanai さんからの「文字が被る」「色が強すぎる」指摘を構造で解消
- **v1.2 (2026-05-02)**: R-SVG-13 (フォント最小サイズ強制) / R-SVG-14 (強調の 3 階層
  ガイドライン) を追加。R-SVG-8 にコントラスト判定を追加 (白文字 on 黒塗りのような
  意図的な重なりは許容)。tokens.json に `_role_guide` / `_emphasis_hierarchy` /
  `_font_size_min` の役割注記メタを追加。osanai さんからの「文字が小さくて読みにくい」
  「黒の色味が強すぎる」「準強調にも brand を使ってしまう」指摘を構造で解消
- **v1.3 (2026-05-02)**: 推奨 viewBox を `1920×1080` (16:9) に変更し、
  enostech-slides v8.7 SECSUMMARY-1 のフルブリード化 (9.20×4.95") に整合させた。
  フォント階層を約 1.7 倍に底上げ (本文 20 / 補足 16 / 注記 14 px)。
  `FONT_SIZE_MIN_FATAL` 11→14、`FONT_SIZE_MIN_WARN` 13→18
- **v1.4 (2026-05-02)**: v1.3 で 14px 注記が pptx 縮尺で潰れる事例があったため、
  さらに 2px 底上げ (本文 22 / 補足 18 / 注記 16 px)。
  `FONT_SIZE_MIN_FATAL` 14→16、`FONT_SIZE_MIN_WARN` 18→22
- **v1.5 (2026-05-02)**: R-SVG-12 改訂で ink 塗りを全面禁止 (代わりに gray800/700 のマイルドグレー)。
  R-SVG-15 新設で縦充填率 75% 以上を強制 (下余白だけが大きい問題を構造で解消)。
- **v1.6〜v1.8 (2026-05-03)**: R-SVG-16 (amber 塗り × text 内包) を追加。validate_svg からの呼び出しを統合。
- **v1.9 (2026-05-08)**: R-SVG-18 (枠付きテキストボックスからのはみ出し) と
  R-SVG-19 (テキスト × line / path / circle 周の重なり) を fatal で新設。osanai 氏からの
  「Tier3 ラベルが同心円に被っている」「日本生命 Wellness-Star☆ がボックスからはみ出ている」
  指摘を構造で解消。あわせて R-SVG-15 (縦充填率) の呼び出し漏れも修正。
- **v1.10 (2026-05-08)**: R-SVG-20 (box の角丸推奨 warn) を新設して柔らかさを促進。
- **v1.11 (2026-05-08)**: R-SVG-21 (Chip 比率上限 10%) と R-SVG-22 (Chip 横 padding)
  を fatal で新設。osanai 氏指摘の「Chip 使いすぎで強調が利かなくなる」「Chip 横詰まり」
  を構造で解消。
  references にテキスト強調 3 段階 (プレーン / 太字 / Chips) のガイドを追加。R-SVG-8
  (テキスト × 塗り面コントラスト判定) の閾値を 0.45 → 0.30 に緩和し、Chips 定石パターン
  (canvas 色文字 on brand 塗り) が false positive で fatal になっていた問題を解消。
- **v1.12 (2026-05-08)**: references/ 必読導線の強化 + 量産モード禁止。冒頭に
  「🚨 SVG を書く前に必ず読む 2 ファイル」セクションを新設。Python f-string で複数
  SVG を量産すると構造設計が共通テンプレ化して題材固有の主役が立たなくなる事故を
  構造で禁止。
- **v1.13 (2026-05-12)**: **描画後の `/design:design-critique` 必須化**。SchemaQA pass 後・
  PNG 変換前に 1 度 critique を回し、🔴 Critical / 🟡 Moderate Recommendation を反映してから
  本番 PNG 化するフローを必須にした。SVG 固有の focus 指示テンプレ (視線誘導 / 視覚階層 /
  強調の整合性 / 余白と密度 / 構造設計の妥当性) を内蔵し、R-SVG-XX で機械検証済みの観点
  (色・線・フォント・Chip 等) は除外指示で重複を防ぐ。各 SVG に critique-report.md を出力
  する義務を追加 (反映漏れの追跡用)。enostech-slides 連携も build-deck.js に critique
  フェーズを差し込む方針 (移行期は warn / 定着後 fatal)。「時間がない」を理由に省略しない
  申し合わせを enostech-slides Phase 4 と同じ思想で確立。osanai 氏指針 (2026-05-12)。
