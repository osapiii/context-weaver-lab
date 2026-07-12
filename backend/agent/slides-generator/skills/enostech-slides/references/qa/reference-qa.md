# Reference QA — 引用情報専用の構造検査ルール

> **Phase 2 完了直前、`slide-qa.md` → `sections-qa.md` の全件通過後に、
> デッキ全体の引用情報を 1 件ずつ走査して全 RefQA ルールを照合する**。
> 引用情報は読者の信頼を担保する最重要要素。「引用 URL の粒度が荒い」
> 「参照ページの表示崩れ」といった引用特有の問題を独立 QA 層で潰す。

---

## なぜ引用専用の QA 層なのか

引用情報には **「引用元（URL/書誌）」と「引用先（本文/末尾参考情報集）」** の
2 つの世界があり、両者の整合・粒度・表示が一気通貫で破綻していると
読者の信頼を一発で失う。具体的に守るべき観点:

1. **URL の粒度** — 引用した個別ページ（Modular models / How we structure projects 等）を
   1 行ずつ載せ、読者がページから直接該当箇所に辿れること
2. **末尾 DATA-4 の表示** — 引用が増えると 1 ページに収まらず、文字が潰れる /
   行間が詰まる / 下端からはみ出す。ページ分割が必要なら自動で分ける

---

## 走査フロー

```
for each fact-based claim across the deck:
    apply RefQA-01〜10 in order
    if any violation:
        record violation → propose fix → user-edit JSON
        → if fix changes DATA-4 row count, re-run RefQA-08〜10 (page overflow)
    else:
        proceed to next claim

最後に DATA-4 (1/N) (2/N) 分割検査を 1 回だけ実行
```

`sections[]` を全件走査して全 RefQA を通過したら、`render-deck-instruction.py` で
HTML レンダリング → ユーザー plan.html 書き出しに進む（ただし RefQA-08〜10 は
Phase 4 でも再検査して、PNG での見た目で最終確認する）。

---

## 主張タイプ別・参照必要性の判定表（RefQA-02 / RefQA-03 で参照）

| 主張タイプ       | 例                                    | 参照必須？            |
| ----------- | ------------------------------------ | ---------------- |
| 統計・数値       | 「市場規模 5 兆円」「導入企業の 80%」               | 必須               |
| 第三者事例       | 「ZOZO の dbt 採用事例」「Snowflake の社内導入」   | 必須               |
| 業界調査        | 「Gartner の予測」「IDC のレポート」             | 必須               |
| 技術仕様（公式文書）  | 「dbt Slim CI の仕組み」「BigQuery のスロット課金」 | 必須               |
| 自社事例・自社製品仕様 | 「FactHub には〇〇機能がある」                  | 不要（出典は社内ドキュメント）  |
| 一般原則・体感主張   | 「読者の動きを軽くする」「現場で改善が回る」               | 不要               |
| 著者の意見・予測    | 「今後 〇〇が主流になる」                        | 不要（ただし「と考える」と明示） |

判定で迷ったら **「読者が『それ本当？』と思ったら参照を求めるか」** で判断。

---

## RefQA-01: 引用 URL の最小粒度（深いページに直接リンク）— 中核ルール

**[Trigger]**
Each citation entry shall point to the **deepest page that uniquely covers the
referenced claim**. Linking to a documentation site's root or a section index
when a sub-page exists is a violation. 「読者がそのページから検索し直す必要が
ない URL」が最小粒度の判定基準。

**[Anti-pattern]**
× **dbt 系で起きやすい**: 「dbt Best Practices」を 1 行で `https://docs.getdbt.com/best-practices/`
  にリンク → 実際にはこのページの中の「How we structure our dbt projects」「Modular
  models」「Tests」「Materializations」など個別ページを引用しているのに、根 URL に
  まとめている
× 「Snowflake のスロット課金」と書きながら URL は `https://www.snowflake.com/` の
  トップページ。実際の引用は `/en/data-cloud/pricing/credits/` のような深いページのはず
× 1 件の引用で複数主張を同時にカバーしようとして、根 URL に丸める
× ZOZO の技術ブログを引用しているのに `https://techblog.zozo.com/` のトップページに
  リンク（個別記事 URL があるはず）

**[Exceptions]**

- 引用元が本当にトップページしか持たない（個人ブログのトップページ等）
- 引用元が動的なダッシュボードで個別 URL が存在しない
- ホワイトペーパーの全体像を 1 件で参照する場合（ただし第何章かを書誌情報に明記）

**[Fix]**

1. 引用元の URL を取得 → ブラウザでアクセスして「主張に対応する実際のページ」を特定
2. 根 URL になっている場合は、深いページの URL に置き換える
3. 1 件の引用が複数主張をカバーしている場合は、**主張ごとに別エントリに分割**
   （DATA-4 の行数が増えるが、それで OK。RefQA-08 で自動分割される）
4. DATA-4 のタイトル列も「dbt Best Practices」ではなく「dbt Best Practices > Modular models」
   のように **元ページのパンくずを反映** させる

> **dbt 公式 / Snowflake / BigQuery / Databricks 等の技術文書は特に注意**。
> 構造化されたドキュメンテーションサイトはサブページが必ず存在するので、
> ほぼ 100% 根 URL での引用は粒度違反。

---

## RefQA-02: ファクトベース主張に対する参照付与

**[Trigger]**
The slide shall have at least one inline citation `(N)` when it makes a
fact-based claim (number, third-party case, survey result, technical spec
from external docs).

**[Anti-pattern]**
× タイトル「導入企業の 80% が満足」+ 本文に出典なし、参考情報集にも該当行なし
× サブコピー「市場規模は 5 兆円」+ DATA-4 を見ても出典が見つからない
× 「業界では〇〇が標準」+ 出典なし（一般化された主張は最も出典が必要）
× 「dbt の Slim CI」と書きながらインライン参照番号がない（読者が公式仕様を確認できない）

**[Exceptions]**

- 上記「主張タイプ別・参照必要性の判定表」で「不要」に分類されるもの
- 自社事例 / 自社製品仕様（社内ドキュメントが出典のため省略）
- 一般原則・体感主張（出典がない代わりに具体例で支える）

**[Fix]**

1. 主張の根拠を確認 → **RefQA-01 に従って深いページの URL を特定**
2. DATA-4（参考情報集）に行を追加し、行頭に `(N)` を付与
3. 該当スライドの本文 detail_blocks に `(N)` 形式でインライン参照を挿入
4. インライン参照は青文字 + 本文より 1pt 小さめ（既存 R-DESIGN-* に準拠）

---

## RefQA-03: 参照 URL が 1 件もない場合の妥当性検証

**[Trigger]**
When a slide has zero citations, the absence shall be intentional — every claim
must fall in the "参照不要" category in the table above. Otherwise it is a
violation.

**[Anti-pattern]**
× LIST-1 標準コンテンツ で「事業会社の 7 割が DX に着手している」と書きながら参照ゼロ
× LIST-8 詳細カード で他社事例を 3 件並べながら参照ゼロ
× VISUAL-2 エビデンス + 結論 のグラフが出典なし
× dbt の機能紹介スライドで公式 URL が 1 件もない

**[Exceptions]**

- 表紙 / 目次 / セクション扉 / 閉じ
- FRAMING-1 構築背景（自社現場エピソードのため出典不要）
- FRAMING-3 会社紹介（自社情報のため出典不要）
- FRAMING-2 Before/After リスト（読後の変化主張のため出典不要）

**[Fix]**

1. 「主張タイプ別・参照必要性の判定表」を見て、本当に参照不要か判定
2. 不要なら、speaker notes に判定理由を 1 行残す
   （「自社事例のため出典不要」「体感主張のため出典不要」等）
3. 必要なら RefQA-01 / RefQA-02 のフローで引用を追加

---

## RefQA-04: インライン参照の表記ゆれ

**[Trigger]**
All inline citations shall use the unified format `(N)` — no variations.

**[Anti-pattern]**
× `（1）`（全角カッコ）と `(1)`（半角カッコ）が混在
× `[1]` `*1` `※1` などの形式が混入
× `(1)(2)` のように連続して書く（カッコの間に半角スペース推奨）
× `(  1  )` のようにスペースが入る

**[Exceptions]**

- なし — 表記は完全に統一する

**[Fix]**

1. デッキ内の全インライン参照を grep で抽出
2. `(N)` 形式に統一
3. 連続参照は `(1) (2)` のようにスペース 1 つ挟む

---

## RefQA-05: インライン参照と参考情報集の対応一貫性

**[Trigger]**
Every `(N)` in slide bodies shall correspond to a row in DATA-4 with the same
number, and vice versa. No orphans, no unused rows.

**[Anti-pattern]**
× 本文に `(3)` があるのに DATA-4 に `(3)` の行がない（孤立参照）
× DATA-4 に `(5)` があるのに本文どこにも `(5)` がない（未使用参照）
× 本文 `(3)` の主張と DATA-4 `(3)` の引用元が無関係（番号誤りで紐付け破綻）

**[Exceptions]**

- 同一参照を複数スライドから参照するのは OK（番号は同じ `(3)` を使い回す）
- 末尾 DATA-4 に「参考リンク集」として未参照の周辺資料を追加するのは OK
  （ただし本文参照番号と区別するため `(*1) (*2)` 等の別記号を使う）

**[Fix]**

1. 本文側のインライン参照を全件抽出 → 番号セット A
2. DATA-4 の行頭番号を全件抽出 → 番号セット B
3. A − B = 孤立参照（本文に追加 or DATA-4 に行追加）
4. B − A = 未使用参照（削除 or 本文で参照する）
5. 番号が連番でない場合は **リナンバリング**（本文 + DATA-4 を同期して付け直す）

---

## RefQA-06: 引用元の信頼性（一次情報優先）

**[Trigger]**
Citations shall prefer **primary sources** over secondary aggregators or
personal blogs.

**[Anti-pattern]**
× 「dbt の仕様」を解説ブログから引用（公式 docs があるはず）
× 統計データをまとめサイトから引用（元の調査機関の URL を辿るべき）
× ニュース記事を二次配信サイトから引用（一次配信元・発表機関の URL を使う）
× LLM が自動生成した「(参考)」を鵜呑みにして検証なしで載せている

**[Exceptions]**

- 一次情報が日本語化されていない時、信頼できる解説記事を補助的に追加するのは OK
  （ただし一次情報も並記する）
- 個人ブログでも該当領域の第一人者なら一次情報扱いで OK（出典に氏名を明記）

**[Fix]**

1. 引用元 URL を辿って一次情報源を特定
2. 一次情報源があるならそちらに差し替え
3. 解説記事を残すなら、DATA-4 のカテゴリ列で「解説」と区別

---

## RefQA-07: 引用元の鮮度（年表記の妥当性）

**[Trigger]**
Each DATA-4 row shall include a year (or year-month) in the source column.
Citations older than 3 years for fast-moving topics (AI / LLM / cloud /
data tooling) shall be flagged.

**[Anti-pattern]**
× 「Snowflake の最新仕様」を引用しているのに source 列が「Snowflake」だけで年なし
× 「2025 年の AI 動向」を 2022 年のレポートで根拠付け（陳腐化リスク）
× LLM 周りの主張を 2 年以上前のソースで支える

**[Exceptions]**

- 古典的な学術論文・原典文書は古くても OK（「Codd 1970」など）
- 法律・規格文書は最新版を参照していれば OK（年は記載）

**[Fix]**

1. DATA-4 の各行に年（または年月）を追記
2. 古いソースは公式の最新ページが無いか確認、あれば差し替え
3. 古いことが重要なソース（歴史的経緯など）は speaker notes に「意図的に古い」と注記

---

## RefQA-08: DATA-4 の行数オーバーフロー検査と自動ページ分割（中核ルール）

**[Trigger]**
The reference table page (DATA-4) shall not contain more rows than fit
visually. **行数しきい値: 1 ページ最大 10 行**。これを超えたら自動で
`(1/N) (2/N)` のページ分割が必要。

**[Anti-pattern]**
× DATA-4 に 15 行詰めて、文字が潰れている / 行間がぎゅうぎゅう / 下端からはみ出す
× DATA-4 を 1 ページに収めるために 各行のタイトル列を 1 行に省略（情報損失）
× ページ分割せずに「フォントを小さくする」で逃げる（読めない引用情報になる）
× 12 行を「11 行 + 1 行余白」で 1 ページに無理やり詰める

**[Exceptions]**

- 8〜10 行は 1 ページで OK（しきい値ぴったりでも警告は出さない）
- 11 行以上は **必ず分割**（例外なし）

**[Fix]**

1. DATA-4 の行数をカウント
2. 11 行以上なら `addReferenceTable` の代わりに `addReferenceTablePaginated` を使う
3. 自動で `(1/N) (2/N)` のサブタイトルが付与され、ページ分割される
4. 分割位置はカテゴリの境界を尊重（同じカテゴリは同じページに収まるよう調整）
5. インライン参照番号 `(N)` は分割をまたいでも連番のまま維持

---

## RefQA-09: DATA-4 の表示崩れ最終検査（Phase 4 で目視）

**[Trigger]**
After the deck is rendered to PNG, DATA-4 (and its split pages if applicable)
shall be visually verified for layout integrity.

**[Anti-pattern]**
× タイトル列のテキストが折り返されて 2 行になっている（読みにくい）
× カテゴリ列の文字が 1 文字ずつ縦に並んでいる（列幅不足）
× 出典列の年表記が「2 0 2 5」のように字間が空いている
× 表が下端からはみ出す / フッターと重なる
× ハイパーリンクの色が黒くなっている（PptxGenJS の hlinkClr バグの取りこぼし）

**[Exceptions]**

- なし — 表示崩れは Phase 4 で必ず修正する

**[Fix]**

1. DATA-4 の PNG を `pptx-to-images.sh` で生成 → 目視
2. 列幅が足りなければ `colW` オプションで調整（標準 `[1.8, 4.6, 2.8]`）
3. テキスト折り返しが起きていれば、タイトルを短く言い換える（ただし RefQA-01 の
   「最深ページ」は崩さない、別エントリに分割する方を優先）
4. ハイパーリンクが黒い場合は `scripts/fix-hyperlink-color.py` を再実行

---

## RefQA-10: 引用先タイトルの正確性

**[Trigger]**
Each DATA-4 row's `title` field shall match the actual page title (or a
faithful Japanese translation).

**[Anti-pattern]**
× 引用元が「How we structure our dbt projects」なのに DATA-4 では「dbt 構成のベストプラクティス」と
  独自意訳（読者が原典で検索しても見つからない）
× 略称化しすぎて元タイトルが復元できない
× タイトルに著者名や日付を混ぜ込む（出典列に書くべき）

**[Exceptions]**

- 公式が日本語版を持つ場合は日本語版のタイトルを優先
- タイトルが極端に長い場合は意味を保ったまま 30〜40 字に短縮（原典タイトルの先頭部分を採用）

**[Fix]**

1. 各引用元の URL を開いて実際のページタイトルを確認
2. DATA-4 の `title` を実タイトルに合わせる
3. 短縮する場合は原典タイトルの先頭を生かす（途中省略 `...` でも可）

---

## RefQA-11: 全スライドの ref_table 集積 ↔ DATA-4 の対応整合

**[Trigger]**
Phase 2 JSON 内のすべてのスライドが持つ `ref_table[]` を全件収集したとき、
その集合が DATA-4 スライドの `ref_table[]` と一致すること。
「本文スライドで参照しているのに DATA-4 に載っていない」「DATA-4 にあるが
どの本文スライドにも対応がない」という状態は両方とも違反。

**設計上の前提**: `ref_table` はスライド単位で書くが、最終的に全スライド分を
束ねたものが読者の手元に届くリファレンス一覧（DATA-4）になる。
この「各スライドの ref_table → 集積 → DATA-4」という一方向のデータフローを
常に整合させることが本 QA の目的。

**[Anti-pattern]**
× 本文スライド S12 に `ref_table: [{ title: "(2) dbt Slim CI", url: "..." }]` があるのに、
  DATA-4 スライドの `ref_table` に `(2)` の行がない
× DATA-4 の `ref_table` に `(5)` の行があるが、どの本文スライドにも
  `ref_table` に `(5)` がなく、本文にも `(5)` のインライン参照がない
× 本文スライドの `ref_table` に追加したが DATA-4 側の更新を忘れた

**[Exceptions]**
- DATA-4 に「参考リンク集」として未参照の周辺資料を追加する場合は OK
  （RefQA-05 の例外と同様）。ただし `(N)` 番号ではなく `(*1)` 等の別記号を使う

**[Fix]**
1. 全スライドの `ref_table[]` を走査し、番号セットを抽出（集合 A）
2. DATA-4 スライドの `ref_table[]` の番号セットを抽出（集合 B）
3. A − B ＝ DATA-4 に未掲載の引用 → DATA-4 の `ref_table` に行を追加
4. B − A ＝ 本文に対応のない DATA-4 行 → 削除または `(*N)` 形式に変更
5. RefQA-08（行数オーバーフロー）を再チェック

---

## RefQA-12: ref_table がある場合、スライド本文に (N) インライン参照が必須

**[Trigger]**
あるスライドの `ref_table[]` に 1 件以上のエントリがある場合、
そのスライドの `detail_blocks`（`items[]` または `text`）の中に
対応する `(N)` 形式のインライン参照番号が必ず存在しなければならない。

ref_table に書いた情報が本文と紐付かないと、読者はどの主張の根拠なのかが
わからない。引用は「本文の主張 → (N) → DATA-4 の行」という参照チェーンが
成立して初めて意味を持つ。

**[Anti-pattern]**
× `ref_table: [{ title: "(1) dbt Best Practices > ...", url: "..." }]` があるのに、
  `detail_blocks` のどこにも `(1)` が出てこない
× `ref_table` に 3 行あるのに本文に `(N)` が 1 つもない
× `ref_table` のタイトルに `(N)` 番号が書いてあるが、本文中の `(N)` が抜けている

**[Exceptions]**
- DATA-4 スライド自身は本文と ref_table の 1:1 対応ではなくリスト表示のため除外
- 参考リンク集として追加した `(*N)` 形式の行は本文参照不要

**[Fix]**
1. 違反スライドの `ref_table` の各エントリの番号を確認
2. 対応する主張が書かれている `detail_blocks` の `items` / `text` に `(N)` を挿入
   - 挿入位置は主張文の末尾（例: `「dbt Slim CI で CI 時間を大幅削減できる (2)」`）
3. RefQA-04（表記ゆれ）・RefQA-05（本文↔DATA-4 対応一貫性）を再チェック

---

## RefQA-13: 本文中 (N) インライン参照番号のハイパーリンク化保証

**[Trigger]**
本文中に `(N)` 形式のインライン参照番号 (例: `(1)` `(5)(6)` `(8)(9)`) が
含まれる場合、その `(N)` は読者がクリックして引用元へジャンプできる
**Office 標準ハイパーリンク色 (#0563C1) + 下線** で描画されている必要がある。

**[Anti-pattern]**
× subtitle に `「Nix は競合ではなく補完。共存できる。(5)(6)」` と書いたが、
  `(5)(6)` が黒文字のままレンダリングされている — 読者がリンク先に飛べず、
  引用情報集 (DATA-4) との対応がインタラクティブに辿れない
× ref_table に該当 (N) 行が無いのに本文に `(N)` を書いている — URL 解決
  できないため自動変換が効かず、SchemaQA-10 の warn が出る
× 「(1) はじめに」のような箇条書き番号と、引用参照 `(1)` を同一スライド内で
  混在させる — 自動変換が箇条書き番号も hyperlink 化しようとして混乱

**[Exceptions]**
- DATA-4 (参考情報集自体) / SECTION-6 (目次) / SECTION-1 (表紙) / SECTION-2 / SECTION-4 /
  SECTION-5 (章扉) / FRAMING-3 (会社紹介) / VISUAL-8 (グラレコサマリー) はチェック対象外

**[Fix]**
1. `expandInlineRefs` 経由で URL 解決して自動でハイパーリンク化する。Claude は今まで通り
   `(5)(6)` 文字列を plan.json に書けばよい
2. **`ctx.refsByNum`** は (a) `doc.references[]` から、(b) 全スライドの
   `ref_table[].title` の "(N) ページタイトル" 形式から、自動集積される
3. **本文の (N) で URL 解決失敗** (SchemaQA-10 warn): 該当スライドの
   `ref_table` に行を追加するか、本文から (N) を削除する
4. Phase 4 で目視確認し、(N) が黒文字のままなら手動で `addText` の text-run 配列形式に
   書き換える

### 自動変換の動作詳細

`scripts/render/atoms.js` の `expandInlineRefs(text, ctx, baseOptions)`:

```javascript
const refsByNum = ctx.refsByNum;  // { 5: "https://...", 6: "https://..." }
const subtitle = "競合ではなく補完。共存できる。(5)(6)";
const runs = expandInlineRefs(subtitle, ctx, { fontSize: 11, color: "1F2937" });
// runs:
//   [
//     { text: "競合ではなく補完。共存できる。", options: { fontSize: 11, color: "1F2937" } },
//     { text: " (5)", options: { fontSize: 11, color: "0563C1", hyperlink: { url: "...", tooltip: "出典 (5)" }, underline: { style: "sng" } } },
//     { text: " (6)", options: { fontSize: 11, color: "0563C1", hyperlink: { url: "...", tooltip: "出典 (6)" }, underline: { style: "sng" } } },
//   ]
slide.addText(runs, {...});  // PptxGenJS が text-run 配列を受け取り個別 hyperlink 化
```

`refsByNum` に該当 N が無い場合は変換せず元の文字列をそのまま返すため、
誤変換リスクは低い (「(1) はじめに」のような番号付き見出しは触らない)。

### 関連ルール

- **SchemaQA-10** (Phase 2 機械検証): 本文 (N) と ref_table の対応整合
- **RefQA-05** (Phase 2 手動): 本文の (N) ↔ DATA-4 の行番号一致
- **RefQA-12** (Phase 2 手動): ref_table がある場合、本文に (N) が必須

---

## DATA-4 ページ分割の実装メモ

使い方:

```javascript
// 旧 (10 行以下):
addReferenceTable(s, rows);

// 新 (任意の行数で自動分割、推奨):
addReferenceTablePaginated(pres, rows, {
  baseTitle: '本資料の主要な参考情報',
  baseSubtitle: '本文中の上付き番号 (1)〜(N) で参照した一次資料を集約',
  rowsPerPage: 10,            // しきい値（デフォルト 10）
  startPageNum: 49,           // 1 ページ目の addChromeWithNav に渡す番号
  sectionIdx: 6,              // 章インデックス
});
```

このヘルパーは:

1. `rows.length / rowsPerPage` でページ数 N を計算
2. 各ページで `pres.addSlide` → タイトルに `(1/N) (2/N)` を自動付与
3. `addReferenceTable` を内部で呼び出して各ページを構築
4. ページ間でカテゴリの境界をなるべく揃える（同カテゴリの行は分散させない）

詳細は `scripts/example-deck.js` の `addReferenceTablePaginated` 関数本体を参照。

---

## 自己チェック（RefQA 全件走査後）

走査完了後、以下を確認してから Phase 2 完了に進む：

- 全ファクトベース主張に `(N)` インライン参照が付いている（RefQA-02）
- 引用なしスライドは「参照不要カテゴリ」のいずれかに該当する（RefQA-03）
- 全 URL が **最深ページ** にリンクしている（RefQA-01 — 中核ルール）
- インライン参照の表記が `(N)` で統一されている（RefQA-04）
- 本文 `(N)` と DATA-4 行が完全対応している（RefQA-05）
- 引用元が一次情報・公式文書を優先している（RefQA-06）
- 全行に年（or 年月）が記載されている、古すぎる引用がない（RefQA-07）
- DATA-4 が **10 行以内 or `(1/N) (2/N)` 分割**（RefQA-08）
- DATA-4 の表示崩れは Phase 4 で再確認する（RefQA-09 — Phase 4 で）
- タイトル列が原典タイトルに忠実（RefQA-10）
- 全スライドの ref_table 集積が DATA-4 と一致している（RefQA-11）
- ref_table がある全スライドの本文に対応 (N) インライン参照がある（RefQA-12）
- 本文 (N) がハイパーリンク化されている（RefQA-13 — Phase 4 で目視）

すべてクリアしたら `render-deck-instruction.py` で HTML レンダリング → plan.html 書き出し。
