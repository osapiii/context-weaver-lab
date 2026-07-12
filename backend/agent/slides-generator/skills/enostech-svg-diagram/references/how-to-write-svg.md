# Claude が SVG を書く時の実践レシピ

design-rules.md の制約セットを守りながら「絵としての説得力」を出すための具体テクニック集。

## 1. 書き始める前のセットアップ

```xml
<svg viewBox="0 0 1400 760" xmlns="http://www.w3.org/2000/svg" role="img"
     font-family="'Noto Sans JP', sans-serif">
  <title>図のタイトル</title>
  <desc>図の説明 (アクセシビリティ用)</desc>

  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
    </marker>
  </defs>

  <!-- 背景 (palette.canvas) -->
  <rect width="1400" height="760" fill="#FAFAF7"/>

  <!-- ここから本体 -->
</svg>
```

viewBox は **「16:9 → 1920:1080」が v1.3 の標準** (SECSUMMARY-1 v8.7 のフルブリード貼付に整合)。旧「1280:720」「1400:760」は使わない。
`role="img"` + `<title>` + `<desc>` を入れると SR 対応になる。

## 2. 色の使い分け (4 色まで)

典型的な 4 色構成:
```
#FAFAF7 — canvas (背景、4色カウント外)
#1F2937 — ink   (本文・主線・主要図形の輪郭)
#F59E0B — brand (主役要素・矢印・強調)
#B45309 — accent (副要素・補助矢印)
#6B7280 — gray500 (補足テキスト・補助線)
```

「色は意味で使い分ける」が原則:
- ink = 構造を成す要素 (枠・主要本体)
- brand = 主役 (フローの主軸・「この絵の主題」)
- accent = 並列対比 (副軸・対照)
- gray500 = 補助情報

## 3. シンプルな絵を「説得力ある」絵にする 5 つのコツ

### コツ 1: Q 曲線を使って「動き」を出す

```xml
<!-- アンテナ波 (信号の発信を表現) -->
<path d="M 758 250 Q 780 240 802 250" fill="none" stroke="#F59E0B" stroke-width="2"/>
<path d="M 762 258 Q 780 252 798 258" fill="none" stroke="#F59E0B" stroke-width="2"/>
<circle cx="780" cy="270" r="3" fill="#F59E0B"/>
```

直線だけだと「物体」しか描けないが、Q 曲線 (二次ベジエ) を 2-3 本足すだけで
「波」「動き」「方向」が表現できる。

### コツ 2: 「並んだ箱 + 点線の箱」で「キュー」を表現

```xml
<rect x="868" y="248" width="14" height="34" fill="#F59E0B"/>
<rect x="888" y="248" width="14" height="34" fill="#F59E0B"/>
<rect x="908" y="248" width="14" height="34" fill="#F59E0B"/>
<rect x="928" y="248" width="14" height="34" fill="#FAFAF7"
      stroke="#1F2937" stroke-width="2" stroke-dasharray="4 4"/>
```

実体 (塗り) + 予約枠 (点線) で「これから入る要素がある」キューを直感的に表せる。

### コツ 3: 円 + 8 本の線で「歯車 = 処理」を表現

```xml
<g transform="translate(1057, 265)">
  <circle r="22" fill="none" stroke="#F59E0B" stroke-width="3"/>
  <circle r="8" fill="#F59E0B"/>
  <!-- 8 本の歯 (短い線分) -->
  <line x1="0" y1="-28" x2="0" y2="-20" stroke="#F59E0B" stroke-width="3"/>
  <line x1="0" y1="20" x2="0" y2="28" stroke="#F59E0B" stroke-width="3"/>
  <line x1="-28" y1="0" x2="-20" y2="0" stroke="#F59E0B" stroke-width="3"/>
  <line x1="20" y1="0" x2="28" y2="0" stroke="#F59E0B" stroke-width="3"/>
  <line x1="-20" y1="-20" x2="-14" y2="-14" stroke="#F59E0B" stroke-width="3"/>
  <line x1="14" y1="14" x2="20" y2="20" stroke="#F59E0B" stroke-width="3"/>
  <line x1="-20" y1="20" x2="-14" y2="14" stroke="#F59E0B" stroke-width="3"/>
  <line x1="14" y1="-14" x2="20" y2="-20" stroke="#F59E0B" stroke-width="3"/>
</g>
```

「処理してる感」を歯車で表現。Spark / Flink / バッチ処理エンジンの可視化に強い。

### コツ 4: 円筒の側面は path で正確に

```xml
<!-- 円筒の側面 -->
<path d="M 1140 230 L 1140 305 Q 1140 320 1185 320 Q 1230 320 1230 305 L 1230 230"
      fill="none" stroke="#1F2937" stroke-width="2"/>
<!-- 上面の楕円 (主役色で塗る) -->
<ellipse cx="1185" cy="230" rx="45" ry="12" fill="#F59E0B" stroke="#1F2937" stroke-width="2"/>
<!-- 中段の層線 (テーブル感) -->
<path d="M 1140 255 Q 1185 268 1230 255" fill="none" stroke="#1F2937"
      stroke-width="2" stroke-dasharray="4 4"/>
```

DB / DWH / ストレージは円筒で表現。Q 曲線で楕円を描くのがコツ。

### コツ 5: 折れ線グラフを直接描いて「ダッシュボード」感を出す

```xml
<rect x="920" y="430" width="200" height="120" fill="none" stroke="#1F2937" stroke-width="2"/>
<line x1="920" y1="450" x2="1120" y2="450" stroke="#1F2937" stroke-width="2"/>
<path d="M 940 530 L 970 510 L 1000 515 L 1030 485 L 1060 495 L 1090 470 L 1110 460"
      fill="none" stroke="#F59E0B" stroke-width="3"/>
```

ダッシュボード・モニタリング・KPI 表示を「中身入りの画面」として描ける。

## 4. ありがちな失敗

### 失敗 1: 線幅を 1 や 1.5 にしてしまう

`stroke-width="1"` `stroke-width="1.5"` は SchemaQA fatal。**2 か 3 のみ**。
細い線が欲しい時は、色を gray500 にして 2px のままにするか、点線 (4 4) にする。

### 失敗 2: marker を複数定義してしまう

「主軸用 arrow と補助用 arrow を分けたい」という発想で `<marker id="arrow-main">`
`<marker id="arrow-sub">` と書くのは fatal。**marker は 1 つだけ定義し、線の `stroke` 色を
変えて差別化**する。

### 失敗 3: 色を 5 色以上使ってしまう

「ink + brand + accent + gray500 + green (成功) + red (失敗)」のように意味付けで
増やしたくなるが、5 色は fatal。「成功 = brand、失敗 = accent」のように既存 4 色に
意味を割り当てる。

### 失敗 4: 装飾形状 (cloud, blob) を使ってしまう

「クラウド = ☁ シルエット」「データ = blob」のような装飾形は fatal。
矩形 + ラベル「Cloud」で十分。絵は構造を語るためにある (装飾ではない)。

### 失敗 5: viewBox を忘れる

`<svg width="1400" height="760">` だけだと PNG 変換時にスケーリングが効かない。
**必ず viewBox を入れる**。

---

# v1.1 で追加したありがちな失敗 (R-SVG-8〜12)

## 失敗 6: 文字が他の図と被る (R-SVG-8 fatal)

`<text>` を `<rect>` `<circle>` `<ellipse>` の塗り面の上に重ねると fatal。
特にやりがち:

```xml
<!-- ❌ NG: 円筒の上面オレンジ楕円の上に銘板テキスト -->
<ellipse cx="200" cy="120" rx="100" ry="22" fill="#F59E0B"/>
<text x="200" y="125" font-size="11" fill="#1F2937" text-anchor="middle">M-200</text>
```

**修正方法 1: 配置を移動する**
```xml
<ellipse cx="200" cy="120" rx="100" ry="22" fill="#F59E0B"/>
<!-- テキストを楕円の外、本体の下端に移動 -->
<text x="200" y="280" font-size="11" fill="#1F2937" text-anchor="middle">M-200</text>
```

**修正方法 2: canvas 抜きチップで囲う (銘板感も出る)**
```xml
<ellipse cx="200" cy="120" rx="100" ry="22" fill="#F59E0B"/>
<rect x="170" y="200" width="60" height="22" fill="#FAFAF7" stroke="#1F2937" stroke-width="1"/>
<text x="200" y="215" font-size="11" fill="#1F2937" text-anchor="middle">M-200</text>
```

テキスト同士の重なりも fatal。注釈を矢印の上に乗せたい時は **「注釈を矢印より上の余白に
独立配置」** が定石。

## 失敗 7: brand (オレンジ) を塗りつぶしで使いすぎる (R-SVG-9 fatal)

「強調したいから brand で塗る」を繰り返すと、すぐ viewBox の 15% を超える。

```xml
<!-- ❌ NG: ヘッダ帯・吹き出し・カードを全部 brand 塗り -->
<rect x="0" y="0" width="600" height="40" fill="#F59E0B"/>     <!-- ヘッダ -->
<rect x="100" y="100" width="200" height="80" fill="#F59E0B"/> <!-- カード -->
<circle cx="500" cy="200" r="40" fill="#F59E0B"/>              <!-- バッジ -->
```

**修正方法: 塗り → 線 (枠線) に置き換える**
```xml
<!-- ヘッダ帯: 塗り → 細線 1 本 -->
<line x1="0" y1="40" x2="600" y2="40" stroke="#B45309" stroke-width="3"/>

<!-- カード: 塗り → 枠線 -->
<rect x="100" y="100" width="200" height="80" fill="none" stroke="#B45309" stroke-width="3"/>

<!-- バッジ: 塗り → 枠線 + 太め -->
<circle cx="500" cy="200" r="40" fill="none" stroke="#B45309" stroke-width="3"/>
```

「主役の主役」だけ塗りで残す (例: 緊急停止ボタン、CTA)。

## 失敗 8: ink (黒) を塗りつぶしで使いすぎる (R-SVG-12 fatal)

ink を塗りで使うと圧が強すぎる。すぐ 5% 上限に達する。

```xml
<!-- ❌ NG: ヘッダ帯・番号バッジ・ディスプレイを全部黒塗り -->
<rect x="0" y="0" width="600" height="40" fill="#1F2937"/>      <!-- ヘッダ -->
<circle cx="100" cy="100" r="28" fill="#1F2937"/>              <!-- 番号バッジ -->
<rect x="200" y="200" width="200" height="50" fill="#1F2937"/> <!-- ディスプレイ -->
```

**修正方法: 黒は線・文字専用、塗り面は gray100 か canvas に置き換える**
```xml
<!-- ヘッダ帯: gray100 塗り + ink 下線 -->
<rect x="0" y="0" width="600" height="40" fill="#F3F4F6"/>
<line x1="0" y1="40" x2="600" y2="40" stroke="#1F2937" stroke-width="2"/>

<!-- 番号バッジ: 白円 + ink 枠 + ink 数字 -->
<circle cx="100" cy="100" r="28" fill="#FAFAF7" stroke="#1F2937" stroke-width="2"/>
<text x="100" y="108" font-size="20" fill="#1F2937" text-anchor="middle">1</text>

<!-- ディスプレイ: gray100 塗り + ink/brand 文字 -->
<rect x="200" y="200" width="200" height="50" fill="#F3F4F6" stroke="#1F2937" stroke-width="2"/>
<text x="300" y="225" font-size="14" fill="#B45309" text-anchor="middle">1450 RPM</text>
```

## 色の強さ 3 段階 (実践チェックリスト)

SVG を書く前に「使う色の強度配分」を頭に置く:

| 強度 | 何で使うか | どこで使うか |
|------|----------|-------------|
| **強** (brand/ink 塗り) | CTA・緊急停止・RUN ランプ・主役の主役 | 1 SVG に 1〜2 箇所だけ |
| **中** (brand/ink 線・枠) | 構造を見せる枠・矢印・主線 | 自由に使える |
| **弱** (gray100 塗り・gray500 補助文字) | 背景・補助・細部 | 自由に使える |

「主役の主役」は 1〜2 個までに絞る。それ以外は「中」「弱」で骨格を組む。


---

## v1.2 (2026-05-02) で追加されたガイド

### フォントサイズの階層 (R-SVG-13、v1.4 で再底上げ)

**推奨 viewBox: 1920 × 1080 (16:9)** を pptx 9.20" × 4.95" に貼る前提で、最低ライン:

| 用途 | サイズ | 備考 |
|---|---|---|
| 章タイトル・大見出し | **40-48px** | 推奨 44px。立ち止まる主役 |
| サブヘッダー (副題/節タイトル) | **26-32px** | カードタイトル / 領域ラベル |
| 本文 (ノード内テキスト) | **22-26px** | これが下限。22px 未満は warn |
| 補足テキスト (説明・注意書き) | **18-20px** | 下限すれすれ |
| 注記・ラベル (出典・補助) | **16-18px** | 16px 未満は **fatal**。読めない |

**16px 未満は SchemaQA が fatal で止める。** v1.3 の「14px 注記」も縮尺次第で潰れる
ケースがあったため再底上げ。

#### v1.2 → v1.3 の底上げ理由 (osanai 指示 2026-05-02)

SECSUMMARY-1 を **v8.7 で 9.20×4.95 のフルブリード**に拡大 (旧 9.20×4.10)。SVG 表示面積は
1.21 倍になったが、それでも v1.2 の 11px-22px の階層では pptx 上で潰れて読めなかった。
新階層は **すべての値を約 1.7 倍** に底上げ。下限 14px は「印刷した A4 で老眼でも読める」
基準で決定。

#### 旧階層との対応表 (移行用)

| 旧 (v1.2) | 新 (v1.3) | 用途 |
|---|---|---|
| 11px (注記下限) | 14px (注記下限) | ラベル・補助 |
| 12px (補足) | 16-18px | 説明文 |
| 13-15px (本文) | 20-24px | ノード本文 |
| 16-18px (サブ) | 24-30px | カードタイトル |
| 18-22px (タイトル) | 36-44px | 主役見出し |

### 強調の 3 階層 (R-SVG-14)

```
最強調 (1 SVG に 1 箇所だけ)  →  brand (#F59E0B) 塗り or 太線 (3px)
準強調・並列要素              →  gray700 (#374151) 塗り、gray500 (#6B7280) 線
本文の地                      →  ink (#1F2937) テキスト、gray300 (#D1D5DB) 罫線
```

「準強調にもオレンジを使いたくなる」現状の問題を防ぐため、**準強調の標準色は gray700**
にする。例:

```xml
<!-- ❌ 全部 brand で塗る → 主役がぼやける -->
<rect fill="#F59E0B" .../>
<rect fill="#F59E0B" .../>
<rect fill="#F59E0B" .../>

<!-- ✅ 準強調は gray700、最強調 1 つだけ brand -->
<rect fill="#374151" .../>  <!-- 通常ヘッダー -->
<rect fill="#374151" .../>  <!-- 通常ヘッダー -->
<rect fill="#F59E0B" .../>  <!-- 主役の主役 -->
```

### マーカー (矢印) は 1 個だけ + currentColor で色を継承

R-SVG-3 で marker は 1 個までと決まっているので、矢印の色は **`fill="currentColor"`** に
して、線側で `<g color="#374151">` または `stroke="#374151"` を指定して色を変える:

```xml
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="9" markerHeight="9" orient="auto">
    <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
  </marker>
</defs>

<!-- 通常矢印 -->
<g color="#374151">
  <line x1="100" y1="200" x2="300" y2="200" stroke="#374151" stroke-width="3" marker-end="url(#arrow)"/>
</g>

<!-- 強調矢印 -->
<g color="#F59E0B">
  <line x1="100" y1="400" x2="300" y2="400" stroke="#F59E0B" stroke-width="3" marker-end="url(#arrow)"/>
</g>
```

### コントラスト判定 (R-SVG-8)

テキストと塗り面が重なる場合、輝度差 0.45 以上 (WCAG 4.5:1 相当) なら OK:

| テキスト色 | 背景塗り | 判定 |
|---|---|---|
| 白 (#FFFFFF) | gray700 (#374151) | OK (差 0.6+) |
| 白 (#FFFFFF) | brand (#F59E0B) | NG (差 0.34) → ink 文字に変更 |
| ink (#1F2937) | brand (#F59E0B) | OK (差 0.5+) |
| ink (#1F2937) | gray100 (#F3F4F6) | OK (差 0.8+) |
| gray500 (#6B7280) | canvas (#FAFAF7) | NG 寄り → ink に変更 |

**Amber 帯の文字は白ではなく ink** にすること (Phase 4 ヘッダー帯の例)。


---

## v1.5 (2026-05-02) で追加されたガイド

### 強調塗りは「マイルドグレー」で (R-SVG-12 改訂)

v1.4 までは ink (#1F2937) で塗り面を作るのが許容されていたが、pptx に貼ると
真っ黒に見えて図の中で目を引きすぎ、本来の主役 (brand) が霞んでしまっていた。

**v1.5 から ink 塗りは fatal で禁止**。代わりに以下を使う:

```
強調塗りが必要 (大ヘッダーバンド・主役のラベル等):
  → gray800 (#374151) を使う  ← マイルドグレー、ink より約 30% 薄い
  → gray700 (#4B5563) も可     ← さらに 1 段薄い

淡い塗り (情報枠・サブカード):
  → gray100 (#F3F4F6) や canvas (#FAFAF7)
```

ink (#1F2937) は **文字・線・輪郭** の色として残る。本文テキストは ink のままで OK。

```xml
<!-- ❌ v1.4 までの書き方 (圧が強い) -->
<rect x="80" y="780" fill="#1F2937" .../>
<text fill="#F59E0B">タイトル</text>

<!-- ✅ v1.5 の書き方 -->
<rect x="80" y="780" fill="#374151" .../>     <!-- gray800 で塗り -->
<text fill="#F59E0B">タイトル</text>           <!-- amber 文字はそのまま -->
```

### 縦方向は本来のコンテンツで 75% 以上を埋まるよう設計する (R-SVG-15)

#### 思想

SECSUMMARY-1 のように SVG が画面の主役のテンプレで「描きたい絵を描いた結果、
viewBox の上 2/3 だけ使って下が真っ白」というのは、**絵のスケールが小さい**
ことの症状。下余白を埋める追加要素を継ぎ足して数字を満たすのは本末転倒で、
**描きたい絵そのものを viewBox いっぱいに広げる** のが正しい解き方。

#### 設計の順序

1. まず章で伝えたいコンテンツ (主役のグラフィック) を決める
2. その主役を viewBox の高さに対して **自然に広がる縦サイズ** で配置する:
   - ボックスの高さを大きく取る (例: 80px → 140-180px)
   - ノード間の縦間隔を広く取る (例: 20px → 60-100px)
   - 主役グラフィックは中央 60-70% の領域を使う
3. ヘッダー (タイトル + サブタイトル + amber rule) は y=60〜200 に収める
4. 結果として下余白は自然に 50-100px 程度まで縮む

#### viewBox 1920×1080 の自然な配分の目安 (例)

| 用途 | y 範囲 | 高さ | 注 |
|---|---|---|---|
| ヘッダー (タイトル + amber rule) | 60〜200 | 約 140 | 固定 |
| 主役グラフィック | 240〜960 | 約 720 | **ここを大きく取る** |
| 下余白 | 960〜1080 | 約 120 | 自然な余白だけ残る |

#### R-SVG-15 warn が出たときの直し方

❌ 悪い直し方: 下にメッセージバンドを継ぎ足す (= 数字を満たすための装飾)
✅ 良い直し方: 主役グラフィックのボックス高 / ノード間隔を広げて、絵そのものを大きくする

絵を伸ばしても warn が消えない場合は、そもそも viewBox に対して描く要素が少なすぎる
(= スカスカ) のサイン。そういう時は viewBox 自体を 1920×720 のような縦短に変えて
画面比率に合わせる方が良いことも。

---

# v1.10 で追加したパターン: テキスト強調の 3 段階

osanai 氏指針 (2026-05-08): 「テキスト的に強調したい箇所は、黒塗り or brand 塗りの
Chips で強調する。プレーン / 太字 / Chips の 3 段階の強調オプションをテキスト全般に持たせる」

## 3 段階の使い分け

| 段階 | 見た目 | font-weight | 使いどころ |
|---|---|---|---|
| ① プレーン | 普通の文字 | 400 (default) | 説明文 / 補足 / 注記 |
| ② 太字 | ボールド | 700 | タイトル / 主要ラベル / 数字 |
| ③ Chips | 塗りつぶしバッジ + 抜き文字 | 700 | 強調メッセージ / カテゴリラベル |

## Chips パターンのコード

```xml
<!-- pill 型 Chip (gray700 塗り、canvas 色抜き) -->
<rect x="100" y="884" width="360" height="40" fill="#374151" rx="20"/>
<text x="280" y="912" font-size="20" font-weight="700" fill="#FAFAF7" text-anchor="middle">
  死亡率 -48% / 入院率 -16%
</text>

<!-- pill 型 Chip (brand 塗り、canvas 色抜き) ← 「主役の主役」 -->
<rect x="170" y="178" width="220" height="40" fill="#F59E0B" rx="20"/>
<text x="280" y="206" font-size="22" font-weight="700" fill="#FAFAF7" text-anchor="middle">
  Tier1 共有価値
</text>
```

### Chips の鉄則

1. **rx は 高さの半分** (例: height=40 → rx=20) で完全 pill 型
2. **塗り色は brand (#F59E0B) または gray700 (#374151) のみ**
   - ink (#1F2937) 塗りは R-SVG-12 で禁止
   - 主役の主役 = brand / 準強調 = gray700
3. **テキストは canvas (#FAFAF7) で抜く + font-weight 700**
4. **height は 32〜40px**、padding を上下 6〜8px 確保
5. **1 SVG に Chips を多用しすぎない** — R-SVG-9 (brand 塗り 15% 以下) が効くので、
   brand Chip は数字バッジに集中させる

### よくある誤用

❌ 説明文に Chip を使う → 「強調」が強調にならない
✅ 説明文はプレーン (font-weight 400) のまま、結論部分だけ Chip

❌ Chip の rx が小さい (rx=4) → 角ばってシャープすぎる
✅ rx = height / 2 で pill 型 (柔らかさ優先)

❌ Chip 内文字が長い (改行が必要なほど) → そもそも Chip でない
✅ Chip 内文字は 1 行 / 〜18 文字以内

## 角丸 (R-SVG-20) のガイド

box 系 rect (width >= 40 かつ height >= 30) には rx >= 4 を必ず付ける。warn が出ても build は通るが、osanai 氏の柔らかさ指針上は強い推奨。

| box サイズ | 推奨 rx |
|---|---|
| ヘッダ / Chip (~40px) | rx=高さ÷2 (pill) |
| カード / textbox (40-100px) | rx=8〜14 |
| 大きなコンテナ (100px〜) | rx=12〜18 |

直角を残したい場合は: 計器ディスプレイの「シャープな機械的印象」を出したい時のみ。
資料スライドの大半は丸みありの方が安心感が出る。

---

# v1.11 で追加: Chip の使用比率と横 padding (R-SVG-21 / R-SVG-22)

## R-SVG-21: Chip は全テキストの 10% 以下に絞る

osanai 氏指針: 「Chip 使いすぎると強調が強調にならない」。

- Chip 内テキスト文字数 / SVG 全体テキスト文字数 が **10% を超えると fatal**
- 0% (Chip 一切なし) は許容 — 「Chip 必須」ではない
- 目安: 1920×1080 SVG で全テキスト 600 文字なら、Chip 内文字数は 60 文字以内

### 厳選ガイド

「この情報は Chip 必須か?」を 3 段階で問う:
1. **「主役の主役」**: 1〜2 個までに絞る (例: ピッチの結論 / 最強調メッセージ)
2. **「強い強調」**: 太字 (font-weight 700) のプレーンテキストで足りる
3. **「補足」**: プレーン (font-weight 400)

## R-SVG-22: Chip 内テキストの横 padding は font-size × 0.6 以上

- 例: font-size 20 → 左右各 12px 以上必要
- Chip rect の width = テキスト幅 + (font-size × 1.2 以上) を確保
- 例: 「RMB 5.47B」(英数字 9 文字 × 約 12px = 108px) なら Chip width >= 108 + 24 = 132px

### よくある違反

❌ Chip width 100, テキスト 90 → 左右各 5px ずつしか余白がない (詰まり感)
✅ Chip width 130, テキスト 90 → 左右各 20px の余白 (font-size 20 なら OK)

