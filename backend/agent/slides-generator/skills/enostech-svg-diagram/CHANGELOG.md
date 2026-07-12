# v1.13 (2026-05-12) — 描画後の `/design:design-critique` 必須化

## なぜ変えたか

osanai 氏指針 (2026-05-12): SchemaQA (R-SVG-1〜22) は機械検証で「やってはいけないこと」
だけを弾く下限ガード。これだけ通しても以下の上限品質は素通りする。

- 視線がどこから流れるか / 最初に目が行く要素が意図通りか
- 主役 / 準主役 / 補助の 3 層が一目で分かるか
- brand 塗りの強調が「主役の主役」1〜2 箇所に集中しているか
- 縦充填率 75%↑ を満たしていても密度バランスが偏っていないか
- 題材 (timeline / hierarchy / matrix / flow) と構造設計が噛み合っているか

これらは人間の目で見ないと判断できない品質で、enostech-slides v9.40 で「Phase 4 を
時間がないからと省略しない」を確立したのと同じ思想で、**SVG 単体の上限品質ゲートも
構造で強制すべき** と判断した。

## 変更点

### A. SKILL.md frontmatter description に必須化を明記

「v1.13〜: SchemaQA pass 後・PNG 変換前に `/design:design-critique` を 1 度回し、
Critical/Moderate Recommendation を SVG に反映してから本番 PNG 化するフローを必須化」
を description 本文に追加し、トリガー段階で運用契約が伝わるようにした。

### B. SKILL.md 出力経路図に critique 3 段を挿入

```
SVG → SchemaQA → [新] プレビュー PNG → [新] /design:design-critique
    → [新] Critical/Moderate 反映 + critique-report.md
    → SchemaQA 再 pass → 本番 PNG 変換 → addImage
```

### C. SKILL.md 鉄則リストに #9 を追加

「8. 完成したら必ず SchemaQA を通す」の直後に「9. SchemaQA を通したら必ず
`/design:design-critique` を 1 度回す」を追加。

### D. SKILL.md に「描画後の Design Critique (必須)」セクション新設

下記を 1 セクションにまとめた:

1. **なぜ必須にしたか** (R-SVG-XX の限界 + Phase 4 を省略しない思想)
2. **実行フロー 8 ステップ** (SchemaQA → プレビュー PNG → critique → 反映 →
   critique-report.md → 再 SchemaQA → 本番 PNG → addImage)
3. **/design:design-critique 用 focus 指示テンプレ** — SVG 固有の 5 観点 (視線誘導 /
   視覚階層 / 強調整合性 / 余白密度 / 構造設計妥当性) に絞り込み、R-SVG-XX で機械検証済みの
   観点 (色・線・フォント・Chip 等) は除外指示で重複を排除
4. **Recommendation 反映ルール** — 🔴 Critical 必須 / 🟡 Moderate 必須 (理由付き skip 可) /
   🟢 Minor 任意。critique-report.md にスキップ理由必須記載
5. **critique-report.md 出力テンプレ** — SVG と同ディレクトリに配置、Findings 表 +
   Priority Recommendations + 差分メモ + 再 SchemaQA 結果
6. **Claude の振る舞い** — 量産時も 1 枚ずつ逐次フロー、「時間がない」を理由に省略しない、
   enostech-slides build-deck.js に critique フェーズを差し込む方針

### E. SKILL.md「enostech-slides からの呼び方」の自動実行リストを 4 段 → 7 段に拡張

build-deck.js が SchemaQA → critique → 反映 → 再 SchemaQA → 本番 PNG 変換の順で
自動実行する想定を明記。critique フェーズは移行期は warn (critique-report.md 不在でも
通す)、定着後 fatal に切り替える。

### F. SKILL.md バージョン履歴に v1.12 / v1.13 を追記

v1.12 (references/ 必読導線強化 + 量産モード禁止) が漏れていたので合わせて追記。

## 後方互換

- R-SVG-1〜22 は無変更。SchemaQA の機械検証はそのまま。
- 既存 SVG は再生成不要。critique-report.md の出力は今後新規生成する SVG から義務。
- enostech-slides 側の build-deck.js は移行期は warn 運用で既存フローを止めない。

## 移行計画

- **Phase 1 (v1.13 リリース直後)**: Claude が手動で SVG を書く時の運用ルールとして
  critique 必須を徹底。critique-report.md を SVG ごとに残す
- **Phase 2 (次デッキ案件)**: enostech-slides build-deck.js に critique フェーズを実装。
  この段階では critique-report.md 不在は warn
- **Phase 3 (定着後、目安 2 案件)**: critique-report.md 不在を fatal に切り替え

---

# v1.12 (2026-05-08) — references/ 必読導線の強化 + 量産モード禁止

## なぜ変えたか

osanai 氏指針 (2026-05-08): ADR デッキ作成時に SECSUMMARY-1 用 SVG 8 件を生成したが、
表現力が大きく落ちた (縦充填率 60% 止まり / 3 段構造止まり / フォント小さめ /
カード薄味)。RCA で原因 3 つを特定。

1. **SKILL.md だけ読んで references/ を読まなかった**: SKILL.md の R-SVG-1〜22 表は
   「やってはいけないこと (下限ガード)」のリストで、「やったら表現力が出るレシピ
   (上限の伸ばし方)」は references/how-to-write-svg.md と pattern-catalog.md に分離
   されていた。SKILL.md の表だけで書くと制約は通るが表現力が出ない。
2. **viewBox 1400×760 の旧設定で書いた**: v1.3 で 1920×1080 に標準化されているのに
   私が古い設定で書いてしまった。フォント絶対値が 25% 縮んで見栄えが大幅劣化。
3. **Python ヘルパーで 8 枚量産した**: 共通テンプレ化されて題材ごとの最適構造設計
   (timeline は横軸が主役 / hierarchy は中央が主役 / matrix は 2 軸対比) が失われ、
   全 SVG が「カード並列の 3 段構造」に収束した。

## 変更点

### A. SKILL.md 冒頭に「🚨 SVG を書く前に必ず読む 2 ファイル」セクション新設

冒頭の「位置づけ」より前に、必読 2 ファイル (how-to-write-svg.md と pattern-catalog.md)
への明示的な誘導を追加。各ファイルの重要ポイント (viewBox 1920×1080 / フォント階層 /
コツ 1〜5 / SECSUMMARY-1 規範) を要約。「これを飛ばして SKILL.md の表だけで書くと、
**縦充填率 60% 止まり / 3 段構造止まり / フォント小さめ / カード薄味** の表現力低下版に
なります」と明示。

### B. 量産モード禁止セクション新設

複数枚の SVG を一気に作る時、Python f-string で量産する誘惑を構造で禁止。
「やる: Q1 を書く → SchemaQA pass → 出来栄え確認 → Q2 を書く ... の逐次」を明文化。
題材ごとに「主役は何か」を 1 行書き出してから書き始める鉄則。

### C. enostech-slides 連携

親スキル (enostech-slides) C-15 を v9.40 で強化:
- references/how-to-write-svg.md への明示パス追加
- 「Python ヘルパーで量産禁止」を理由付きで明記
- 逐次フロー必須を明文化

親スキルの braindump-illust.py の hint メッセージも拡張:
- SVG 未配置の Q がある時、必読 2 ファイル (how-to-write-svg.md / pattern-catalog.md) を
  明示的に提示
- 「Python ヘルパーで量産しないこと」を運用ルールとして警告

## 後方互換

- R-SVG-1〜22 は無変更。SchemaQA の機械検証はそのまま。
- SKILL.md の冒頭に追加されただけなので、既存の SVG 制作フローに影響なし。
- 既存 SVG は再生成不要。

## eval 結果

- enostech-slides skill との end-to-end 検証で Q1 / Q2 の SVG を新仕様で書き直し、
  添付メダリオン図レベルの表現密度に到達 (縦充填率 85%↑ / 4-5 段構造 /
  フォント階層 22-56px / カード密度高)。

---

# v1.11 (2026-05-08) — Chip 使い過ぎ防止 + Chip 横 padding 強制

## なぜ変えたか

osanai 氏指針 (2026-05-08):
- Chips 使いすぎると強調が強調にならない。全テキスト量の 10% 以下に抑える (0% も許容)
- Chip の横 margin が詰まりすぎると見栄えが悪い。fatal で強制

## 何を変えたか

### A. R-SVG-21 [fatal] 新設: Chip 内テキスト比率は 10% 以下

- 判定: 「rx >= height/3 (pill 型) かつ塗り (canvas 以外) を持つ rect」を Chip と認定
- Chip 内に中心点が入っている text の合計文字数 / SVG 全体テキスト文字数
- 比率 10% 超で fatal
- 0% (Chip 一切なし) は許容

### B. R-SVG-22 [fatal] 新設: Chip 内テキスト横 padding は font-size × 0.6 以上

- Chip rect の左端 / 右端 と Chip 内テキスト bbox の左右の余白を測る
- font-size × 0.6 未満で fatal
- 例: font-size 20 → 左右各 12px 以上の padding 必須

## eval (4 fixture)

| fixture | 期待 | 結果 |
|---|---|---|
| chips_overuse.svg (Chip 比率 87%) | R-SVG-21 fatal | ✅ |
| chip_padding_tight.svg (RMB 5.47B が 100x34 の Chip にギリギリ) | R-SVG-22 fatal | ✅ |
| 過去の passing (rounded box / Q1.svg) | OK | ✅ regression なし |

## Q1 v1.11 結果

| 項目 | v1.10 (前) | v1.11 (新) |
|---|---|---|
| Chip 数 | 9 | **3** (Tier1 / Tier2 ヘッダ + Tier1 代表数字) |
| Chip 比率 | 17.3% | **〜8%** (R-SVG-21 クリア) |
| Ping An の数字 5 つ | オレンジ Chip | **bold オレンジ文字** に格下げ |
| 各 Tier 代表数字 | 全 Chip | **Tier1 のみ Chip、他は太字** |
| SchemaQA fatal | 0 | 0 |

osanai 氏指摘の「Chip 多すぎ」「強調が利かない」を構造で解消し、視覚的な強弱がはっきりした。

## 互換性

- v1.10 で fatal 0 だった SVG でも、Chip 比率 10% 超なら v1.11 で fatal 化
- 緩和策はなく、Chip を厳選するか font-weight 700 のプレーンテキストに格下げ
# v1.10 (2026-05-08) — 柔らかさ: R-SVG-20 (角丸推奨) + テキスト強調 3 段階ガイド

## なぜ変えたか

osanai 氏指針 (2026-05-08): 「やや柔らかさを含ませたい」
- box (textbox / card) を描画するときは、若干 rounded をつける
- テキスト的に強調したい箇所は、黒塗り or brand 塗りの Chips で強調する
  (プレーン / 太字 / Chips の 3 段階での強調オプションをテキスト全般に持たせる)

## 何を変えたか

### A. R-SVG-20 [warn] 新設: box (textbox/card) サイズの rect に角丸推奨

- 対象: width >= 40 かつ height >= 30 の rect
- 違反: rx 未指定 または rx < 4
- severity: warn (既存 SVG が大量に落ちる懸念があるため fatal にしない)
- 例外: 背景全面 rect (viewBox の 95% 以上) / アイコン (W<40 or H<30) は除外

### B. テキスト強調 3 段階のガイド

`references/how-to-write-svg.md` と `pattern-catalog.md` に新セクション
「テキスト強調の 3 段階」を追加。

```
① プレーン:  font-weight 400 (default)            … 説明文 / 補足
② 太字:      font-weight 700                      … タイトル / 主要ラベル
③ Chips:     rect (塗り) + canvas 色のテキスト    … 強調メッセージ
```

Chips パターンの定石:
- 塗り色: brand (#F59E0B) または gray700 (#374151)
- テキスト色: canvas (#FAFAF7) で抜き
- rx: 高さの半分 (= 完全な丸み = pill 型)
- font-weight: 700

ink (#1F2937) 塗りは R-SVG-12 で禁止。Chips の塗りは brand か gray700 のみ。

### C. R-SVG-8 (text × 塗り面コントラスト判定) の閾値緩和: 0.45 → 0.30

`#FAFAF7 (canvas)` on `#F59E0B (brand)` のような Chips 定石パターンが
0.45 閾値だと fatal になる問題を解消。0.30 で:
- 白文字 on ink/gray700/brand: いずれも 0.30 を超えるので OK
- 黒文字 on canvas/gray100: 同じく OK
- 黒文字 on brand: NG (どちらも輝度近いので意図的にしか配置しない)

## eval (Q1 Tier 図 v1.10 再描画)

| 項目 | v1.9 (前) | v1.10 (新) |
|---|---|---|
| 角丸 | rx=8 中心 | rx=14〜20 (柔らかさ向上) |
| Chip 強調 | 0 件 | 9 件 (Tier ヘッダ × 3 + 代表数字 × 4 + Ping An 数字 × 5) |
| 色数 | 4 (ink/brand/accent/gray) | 4 (ink/brand/accent/gray700) ← gray500/gray700 統一 |
| SchemaQA fatal | 0 | 0 (regression なし) |

## 互換性

- v1.9 で fatal 0 だった SVG は v1.10 でも fatal 0 (regression なし)
- R-SVG-20 は warn なので強制ではない
- R-SVG-8 閾値緩和で v1.9 で fatal だった意図的 Chip パターンが pass になる
  (false positive 解消、false negative は理論上ありうるが要観察)

# v1.9 (2026-05-08) — テキスト × 線 / 枠はみ出し検出 + R-SVG-15 呼び出し有効化

## なぜ変えたか

osanai 氏の指摘 (2026-05-08): braindump-illust の Q1 同心円図で
- 「Tier3 健診データ活用 初期段階」が同心円ラインに被っている
- 「日本生命 Wellness-Star☆」が枠線付きテキストボックスからはみ出している
- 「Tier2 行動変容アプリ」が同心円ラインに被っている

これらが SchemaQA を通過してしまい、PNG にしてから初めて気づく状態だった。
構造で塞ぐために 2 ルールを fatal で新設、+ 既存 R-SVG-15 の呼び出し漏れも修正。

## 何を変えたか

### A. R-SVG-18 [fatal] 新設: 枠付きテキストボックスからのはみ出し

stroke 持ちの rect を「枠付きテキストボックスの候補」とし、その内側の中心点が
含まれる text 要素について、rect の内側 padding (4px、canvas 抜きチップは 2px) を
確保した内枠から text bbox がはみ出していたら fatal。

- 検出アルゴリズム:
  1. stroke 持ち rect を全部集める
  2. text bbox の中心点が含まれる rect の中で、最小面積のものを「親」として採用
  3. 親 rect の内側 padding を引いた内枠から text bbox がはみ出していたら fatal
- 例外: rect が canvas 色塗り (#FAFAF7) または fill="none" の場合は loose 判定 (padding 2px)

### B. R-SVG-19 [fatal] 新設: テキストと line / path / circle 周の重なり

テキスト bbox と line/path 直線セグメント/circle 周/ellipse 周の最短距離が
font-size の半分 (= text height/2) 未満なら fatal。

- 検出範囲:
  - `<line>` (矢印含む)
  - `<path>` の "M x y L x y" 形式の直線セグメント
  - `<circle>` の周 (fill が none / canvas 色 のもの)
  - `<ellipse>` の周 (簡易判定)
- 距離計算:
  - line: 線分と bbox の交差判定 + bbox 4 頂点-線分距離 + 線分端点-bbox 辺距離の最小
  - circle: bbox 4 頂点と円中心の距離から d_min/d_max を取り、r が間にあれば 0 (周が貫通)、
    全頂点が円内なら r - d_max、全頂点が円外なら d_min - r
- margin: font-size × 0.5 (= text height の半分以下なら被り扱い)

### C. R-SVG-15 (v1.5) の呼び出しを有効化

`check_vertical_fill()` は v1.5 で実装したが、validate_svg() から呼んでいなかった
(コードが存在するだけ)。v1.9 で `viewBox = parse_viewbox(root); check_vertical_fill(root, viewBox, errors)`
を validate_svg に追加して、縦充填率 75% 未満を warn で検出するようにした。

## eval (4 fixture)

| fixture | 期待 | 結果 |
|---|---|---|
| passing.svg (300x100 枠に小さなテキスト) | OK | ✅ 全制約パス |
| fail_r18_overflow.svg (100x40 枠に長文) | R-SVG-18 fatal | ✅ 検出 |
| fail_r19_line_overlap.svg (line に text 重ね) | R-SVG-19 fatal | ✅ 検出 |
| fail_r19_circle_arc.svg (円周貫通テキスト) | R-SVG-19 fatal | ✅ 検出 |

実 deck (braindump-illust Q1.svg) でも fatal 37 件 → 0 件まで詰めた現実改善。

## 互換性

- 既存 SVG (v1.8 まで通っていたもの) で R-SVG-18 / R-SVG-19 を新たに違反することはあり得る
- 強制 fatal なので、これまで通っていた SVG を壊す可能性あり (regression リスク)
- 実 deck で fatal が出たら enostech-slides の build-deck.js が止まる
- 緩和策: `doc.svg_qa_strict: false` で warn 降格できるオプションを v2.0 で検討

# v1.8 (2026-05-03) — R-SVG-16: amber 塗り × text 内包 = fatal (enostech-slides v9.23 連携)

## なぜ変えたか

直近のベアフットデッキ SECSUMMARY-1 (S6 / S12 / S19 / S26) で「テキストカード /
コールアウトの背景がアンバー塗り (#F59E0B / #B45309) になっていてダサい」と
osanai さんから明確な指摘が入った。SchemaQA の既存ルール (R-SVG-9 brand 塗り 15%
面積上限) は「面積比」しか見ておらず、小さな amber rect でも「テキストカード
背景としては NG」を区別できなかった。**「テキストを内包する rect/path に amber
を塗ると fatal」** という新ルールで機械強制する。

## 何を変えたか

### 1. `scripts/qa/svg-schema-qa.py` に R-SVG-16 (新ルール / fatal) 追加

判定ロジック:

- 対象: `<rect>` / `<path>` の **fill** 属性
- 違反条件:
  1. fill が brand amber 系 (`#FCD34D` / `#FBBF24` / `#F59E0B` / `#D97706` / `#B45309` / `#92400E`)
  2. かつ、要素の親 `<g>` の中に `<text>` がある、または rect の bbox 内に text 要素が物理的に重なる
- 例外:
  - rect の高さが **50px 未満** (薄帯・アンダーライン・section divider 用途)
  - rect の面積が **1600 px² 未満** (アイコン・チップ・badge)
  - viewBox を 1920 幅に正規化したスケールで判定

`#FEF3C7` (amber-100) は **対象外**。「light yellow + amber stroke + amber 文字」の
組み合わせは引き続き OK。

### 2. `references/pattern-catalog.md` に「カード背景配色マトリクス」セクション追加

- NG パターン (amber rect + text の図示)
- OK パターン 4 系統 (白カード + amber stroke / 薄黄カード / 薄グレーカード /
  dark inverse カード) の表
- テーマ別推奨組み合わせ (ステージ / 比較 / タイムライン / 判定木 / カタログ) の表
- amber を「使ってよい」用法のリスト
- 移行レシピ (既存の amber 塗りカードを直す diff 例)

### 3. enostech-slides 側参照ガイドラインも更新 (子スキル連携)

enostech-slides の `references/_common/scene-patterns.md` の R-FIG-PRIORITY 直後に
「色使いの絶対ルール — C-14 (v9.23 / R-SVG-16)」セクションを追加。SVG 子スキルから
親スキルへの双方向参照を確立。

## R-SVG-16 のサンプル fail 出力

```
✗ [R-SVG-16] amber 塗り fill="#F59E0B" rect (990,160,760x84) の内側に <text> が含まれます。
 テキストカード / コールアウトの背景に amber を塗るのは禁止 (C-14)。
 代わりに background = #FFFFFF / #FAFAF7 / #F5F5F4 / #1F2937 inverse のいずれかにし、
 amber は stroke / 文字色 / 矢印 / 細帯 (高さ < 50px) でだけ使ってください。
 light yellow #FEF3C7 (amber-100) + amber stroke + amber 文字 の組み合わせは可。
```

## 既存デッキ調査結果 (v9.23 task #5)

| デッキ | R-SVG-16 fatal |
|---|---|
| 2026-05-03_resistor-electronics-basics | 0 件 |
| 2026-05-02_dbt-semantic-layer-complete-guide | 0 件 |
| 2026-05-03_15km-sento-walk | 1 件 (ch5-routine.svg、別タスクで対応) |
| **2026-05-03_barefoot-shoes-basics** | **7 件 → 0 件 (v9.23 で自動修正)** |
| 2026-05-03_case-study-deck-test | (SVG なし) |
| 2026-05-03_mypedia-sento | (SVG なし) |

---

# v1.7 (2026-05-03) — enostech-slides v9.4 連携: SECSUMMARY-1 専用レイアウトパターン追加

## なぜ変えたか

enostech-slides v9.4 で SECSUMMARY-1 のレイアウトを刷新した:
- テンプレが上部 amber 帯 / 章タイトル / サブタイトル / 全章ナビ chip リボン / 下部 chrome を描く
- SVG は中央メインビジュアル領域のみに集中する

LLM が SECSUMMARY-1 用 SVG を書く時、この役割分担を知らないと「上部 amber 帯」「章タイトル」を
SVG 内に再描画してしまい、テンプレと二重表示になる。pattern-catalog.md に v9.4 規範を明文化して
LLM が迷わないようにした。

## 何を変えたか

### 1. `references/pattern-catalog.md` に「SECSUMMARY-1 専用パターン」セクション追加

- 役割分担表 (テンプレが描く要素 / SVG が描く要素)
- dbt-semantic 流の中央コンテンツ レイアウト規範 (amber stroke + light yellow fill / dark gray bar / 結論バー)
- NG パターン (上部 amber 帯や章タイトルを SVG に再描画しない、ink 塗りしない、amber 4 箇所以上塗らない)
- OK パターン (amber は stroke で / 強調 1 箇所だけ dark gray 塗り / カード 3〜5 個)

### 2. SKILL.md / scripts は変更なし

R-SVG-1〜15 の制約セットは v1.6 のまま。SECSUMMARY-1 連携は references レベルでの
ドキュメント追加にとどめる (機械検証は enostech-slides 側の StructQA / Zod が担当)。

## 後方互換

- 単体運用 (docx / blog / OGP 画像など) には一切影響なし
- enostech-slides v9.3 以前との連携も従来どおり動作 (pattern-catalog.md の追記のみで scripts は不変)

---

# v1.6 (2026-05-03) — enostech-slides v9.3 連携: 共通レンダラ優先 + R-SVG-7b 追加

## なぜ変えたか

enostech-slides v9.3 で SVG → PNG 変換経路を `lib/svg-render.js` に統一し、Noto Sans JP を
skill 同梱フォントとして明示ロードする root-cause fix を入れた。enostech-svg-diagram の
CLI (`svg-to-png.js`) が古い resvg-js 直叩き経路のまま残ると、両 skill が併用されたとき
レンダリング結果が場所依存でブレるため、こちらも歩調を合わせる。

## 何を変えたか

### 1. `scripts/convert/svg-to-png.js` v1.6: 共通レンダラ優先

呼び出し元プロジェクトに `enostech-slides/scripts/render/lib/svg-render.js` がある場合、
それを最優先で使うフォールバック経路を追加。enostech-slides 不在の単体運用時は
従来どおり resvg-js を直接叩くが、`defaultFontFamily` に加えて
`sansSerifFamily` / `serifFamily` / `monospaceFamily` も全部 `Noto Sans JP` に揃える
ように修正した (resvg は generic family を別物として解決するため)。

### 2. `scripts/qa/svg-schema-qa.py`: R-SVG-7b 新ルール

`font-family="'Noto Sans JP', sans-serif"` のようなコンマ区切り fallback リストを
warn で検出。enostech-slides v9.3 のレンダラは内部で単一値に正規化するため動作には
影響しないが、SVG ソース時点で単一値に揃えておくと「fallback が効くつもりだったのに
実は効かない」というメンタルモデルのギャップが消える。

severity = warn (R-SVG-7 と同じ温度感)。SVG 自体の build を止めることはない。

## 何を壊さないか

- 既存 SVG (コンマ区切り fallback あり) は warn が出るだけで render は通る
- enostech-slides 不在の単体運用 (CLI 単体使用、docx / blog 用途): 従来どおり resvg-js 直経路
- sharp / ImageMagick フォールバックの順序: 変更なし

---

# v1.5 (2026-05-02) — ink 塗り禁止 + 縦充填率 75% 強制

## なぜ変えたか

osanai さんからのフィードバック:
- 強調塗りに ink (#1F2937 真っ黒) を使うと圧が強すぎて違和感があった
- SVG の下余白が大きすぎて pptx 上で「下半分が未完成」に見えるケースが多発

## 何を変えたか

- **R-SVG-12 改訂**: ink 塗りは fatal で全面禁止。代わりに以下を強制:
  - 強調塗り → gray800 (#374151) (マイルドグレー、ink より約 30% 薄い)
  - 1 段薄くしたい → gray700 (#4B5563)
  - 淡い塗り → gray100 (#F3F4F6) / canvas (#FAFAF7)
  - **ink (#1F2937) は文字・線・輪郭の色として残る** (本文テキストは ink のままで OK)
- **R-SVG-15 新設**: SVG 内コンテンツの縦充填率を集計、viewBox 高さの 75% 未満で warn。
  ただし「数字を満たすために要素を追加する」のは本末転倒。warn が出たら **主役の
  グラフィックを viewBox いっぱいに広げる** (ボックス高 / ノード間隔を増やす) のが正しい解決策
- `references/how-to-write-svg.md` に「viewBox 1920×1080 の自然な配分の目安」と
  「R-SVG-15 warn の正しい直し方 / 悪い直し方」を追加

# v1.4 (2026-05-02) — フォント最小サイズを再底上げ (本文 22 / 補足 18 / 注記 16)

## なぜ変えたか

v1.3 (本文 20 / 補足 16 / 注記 14) で十分と思われたが、実 pptx 縮尺で
注記 14px が潰れて読めない事例が発生。osanai さんから「もう 2-4px 大きくしたい」
の指示で再底上げ。

## 何を変えたか

- **`references/how-to-write-svg.md`** R-SVG-13 階層を約 +2-4px:
  - 章タイトル: 36-44 → **40-48px** (推奨 44px)
  - サブヘッダー: 24-30 → **26-32px**
  - 本文: 20-24 → **22-26px** (下限 22)
  - 補足: 16-18 → **18-20px**
  - 注記: 14-16 → **16-18px** (fatal 16)
- **`scripts/qa/svg-schema-qa.py`** 閾値:
  - `FONT_SIZE_MIN_FATAL`: 14 → **16**
  - `FONT_SIZE_MIN_WARN`: 18 → **22**

# v1.3 (2026-05-02) — viewBox 1920×1080 標準化 + フォント階層底上げ

## なぜ変えたか

enostech-slides v8.7 の SECSUMMARY-1 フルブリード化 (9.20×4.95") に対応するため、
推奨 viewBox を 1920×1080 に揃え、それに合わせてフォント階層を約 1.7 倍に底上げ。
旧 v1.2 の階層 (本文 13 / 補足 12 / 注記 11) では pptx 縮尺で文字が潰れていた。

## 何を変えたか

- **`references/how-to-write-svg.md`**:
  - 推奨 viewBox を `1280×720` / `1400×760` から **`1920×1080`** に変更
  - フォントサイズ階層を約 1.7 倍に底上げ (旧→新の対応表を追加)
- **`scripts/qa/svg-schema-qa.py`**:
  - `FONT_SIZE_MIN_FATAL`: 11 → 14
  - `FONT_SIZE_MIN_WARN`: 13 → 18

## 後方互換

- 旧 viewBox (1280×720 等) の SVG はそのまま動く (render 側は変更なし)
- 既存 SVG が新閾値で warn になる場合は手書き再調整が必要
- enostech-slides v8.7 SECSUMMARY-1 と組み合わせて使う前提

# v1.2 (2026-05-02) — フォント最小サイズ強制 + マイルドグレー基調

## なぜ変えたか

osanai さん指摘:
> 現状文字がかなり小さくて読みにくい問題がある。
> 黒の色味が濃すぎて、ベースカラーで Gray 系も追加してマイルドな印象にしたい。
> 強調する時も、最強調以外は主に Gray を中心使用したい。

v1.1 まで:
- フォントサイズの下限ガイドが無く、Claude が 11px / 10px の補足テキストを書きがちで、
  pptx 9.20" × 4.10" に貼った時に「読めない文字」になっていた
- 強調手段が brand (Amber) 一択で、「準強調にも brand を使ってしまう」結果として
  全 SVG がオレンジで埋まり、本当の主役がぼやけていた
- ヘッダー帯が ink (#1F2937 黒) 一択で、印象が硬く・圧が強かった

## 主な変更点

### 1. R-SVG-13 新設 (フォント最小サイズ強制)

`<text>` / `<tspan>` の `font-size` を機械検証:

| サイズ | 判定 |
|---|---|
| < 11px | fatal (絶対読めない) |
| 11px 以上 13px 未満 | warn (本文として薄い) |
| 13px 以上 | OK (本文の下限) |
| 18px 以上 | 章タイトル・大見出しの下限推奨 |

これで Claude が 11px / 10px の補足テキストを書いた時点で SchemaQA が止める。

### 2. R-SVG-14 新設 (準強調は gray を優先、ガイドライン)

強調を 3 階層で使い分けるガイドライン:

```
最強調 (1 SVG に 1 箇所だけ)  → brand (#F59E0B) 塗り or 太線
準強調・並列要素              → gray700 (#374151) 塗り、gray500 (#6B7280) 線
本文の地                      → ink (#1F2937) テキスト、gray300 (#D1D5DB) 罫線
```

「準強調にもオレンジを使いたくなる」現状の問題を、**gray を準強調の標準色** として
明示することで防ぐ。R-SVG-14 自体は機械検証しないが、`tokens.json` の
`_role_guide` / `_emphasis_hierarchy` に役割を明記して Claude に渡る。

### 3. tokens.json に役割注記を追加

`_role_guide` / `_emphasis_hierarchy` / `_font_size_min` の 3 つのメタフィールドを
追加。Claude が SVG を書く時に「どの色をいつ使うか」を tokens.json から読み取れる。

色 (palette) 自体は v1.1 から変更なし — gray100/300/500/700 + ink + brand + accent +
highlight + canvas の構成は維持。

### 4. R-SVG-8 のコントラスト判定追加

v1.1 の R-SVG-8 (テキスト重なり) は「重なっている事実」だけで fatal にしていたが、
「白文字 on 黒塗り」「ink 文字 on canvas」のような明確にコントラストがある重なりは
本来 OK (むしろ意図通り)。

v1.2 で `has_sufficient_contrast()` を追加:
- 相対輝度の差が 0.45 以上 (WCAG 4.5:1 相当のラフ近似) なら重なりを許容
- それ未満は fatal (例: 白文字 on Amber 塗りは輝度差 0.34 で fatal、配色変更を促す)

これで「カード内のテキストは塗りカードと意図的に重なる」設計が SchemaQA で誤検知
されなくなる。

## 移行手順 (既存 SVG を v1.2 で再検証する時)

1. tokens.json は手動編集なしで上書き OK (palette は変更なし)
2. 既存 SVG で 12px 未満を使っているなら R-SVG-13 warn が出るので 13px 以上に
3. 既存 SVG で全部 brand 塗りで埋めていたなら R-SVG-9 (15% 上限) で fatal
   → 準強調を gray700 / gray500 に置き換える (R-SVG-14 ガイドライン)

## 動作確認 (本デッキ 4 章扉直後)

enostech-slides-internals デッキの B/C/D/E 章扉直後の 4 SVG を v1.2 で書き直し、
すべて fatal 0 で SchemaQA pass。pptx 描画でも:
- 最強調 (Phase 4 / Zod 検証 / palette.yml / showcase 3 経路) だけ Amber でハイライト
- 他の構造要素はすべて gray700 帯 + 黒テキストでマイルド
- 文字サイズは章タイトル 18-22px / 本文 13-15px / 補足 12px / 注記 11px の階層

これで「読みやすさ」「マイルド」「最強調が分かる」が 3 つとも両立した。

---

# v1.1 (2026-05-01) — R-SVG-8〜12: 文字被り + 色強度の機械検証を追加

osanai さんからの 2 つの指摘を構造で解消:
- 「文字が他の図と被ることがある」(M-200 銘板が円筒上面オレンジに重なる事案)
- 「色が強過ぎる時がある」(brand 塗りや黒塗りの面積が過剰)

## 追加した機械検証ルール (4 件)

| ID | 観点 | 上限 | severity |
|---|---|---|---|
| R-SVG-8  | テキスト bbox の他要素衝突 | 0 件 | fatal |
| R-SVG-9  | brand+accent 塗り面積比 | 15% | fatal |
| R-SVG-10 | brand+accent 大塗り (≥2%) の個数 | 2 個 | warn |
| R-SVG-12 | ink 塗り面積比 | 5% | fatal |

R-SVG-11 (強調は塗りより線) はガイドラインのみ (機械検証なし)。

## svg-schema-qa.py の実装

- text 要素は bbox を概算 (font-size × 文字幅、CJK は等幅扱い、text-anchor 考慮)
- 塗り面 bbox は rect/circle/ellipse のみ (path/polygon は複雑なので未対応 = 既知制約)
- 塗り面積は rect = w×h、circle = π r²、ellipse = π rx ry で算出

## 動作確認

5 ケースで期待通り検知:
1. 既存サンプル (パスするべき) → パス
2. M-200 がオレンジ楕円と被る → R-SVG-8 fatal
3. テキスト同士の被り → R-SVG-8 fatal
4. brand 塗り 20% → R-SVG-9 fatal
5. ink 塗り 10% → R-SVG-12 fatal

## ドキュメント追記

- references/design-rules.md: R-SVG-8〜12 の詳細 + 「色の強さ 3 段階」表
- references/how-to-write-svg.md: 失敗 6〜8 (文字被り/brand 過剰/ink 過剰) のレシピ
- SKILL.md: ルール表を v1.1 に更新

## 既知制約

- R-SVG-8: <path> <polygon> の bbox は計算複雑なので未対応 (見逃しあり)
- R-SVG-8: text の dx/dy/transform は未考慮
- R-SVG-9/12: stroke (線) の面積は計上しない (塗りつぶしのみ判定)

---

# CHANGELOG — enostech-svg-diagram

## v1.0 (2026-05-01) — 初版リリース

cloudDesign 流の制約セットを SchemaQA fatal で守る SVG ダイアグラム生成スキルを新設。

- 制約セット 6 項目 (色4色/線2px3px/marker1種/viewBox必須/dasharray '4 4'/シェイプ限定)
- SVG → PNG 変換 (resvg-js + sharp フォールバック)
- enostech-slides v6.83 と同時リリース
- enostech-slides の R-FIG-PRIORITY 改定により、SVG (このスキル) が図解の第一候補に

### このスキルが解決した問題

- enostech-slides の atom-shape ベースだと「歯車・キュー・アンテナ波・ダッシュボード」等の
  「絵としての説得力」が描けなかった
- Unicode 記号 (▤ ☁ ⟿) はフォント依存で見た目がぶれる
- 「絵がフラットに見える」「全部似たり寄ったりに見える」という osanai さん本人からの
  指摘を構造で解決
