# Writing QA — JSON 時点で日本語表現の不自然さを検出する自動検査層

> **Phase 2 で plan.json を render する時に自動実行される**。SchemaQA / SecQA-Auto /
> RefQA-Auto と同列の機械検証層。ja-writing スキルの 4 大原則のうち、機械的に
> 検出可能なものを fatal/warn ルールに落としたのがこのファイル。
>
> ja-writing スキルが「人が書く時の物差し」なら、WritingQA は「機械が書いた後の検査
> ゲート」。両方通って初めて完成。
>
> タイトル + サブコピー両方あるスライドでは、タイトル・サブコピーともにですます調必須
> （体言止めはタイトル単独時のみ許容）。例外テンプレは SECTION-1/2/3/4/5・SECSUMMARY-1。
> オプトアウトは `doc.writing_strict: false`（fatal → warn 降格）。判定ヘルパーは
> `scripts/writing-qa.py` の `ends_with_desumasu / ends_with_taigen` と
> `scripts/render/lib/ja-text-helpers.js` の `endsWithDesumasu / endsWithTaigen` で
> 同一ロジックを 2 言語に展開。詳細は WritingQA-13 / 14 セクションを参照。
>
> 「**パワポでき太郎**」(`scripts/render/run-pawapo-dekitaro-qa.js`) は
> WritingQA が拾わないニュアンス問題（体言止め連発・主述呼応の崩れ・サブコピーの
> 説得力不足・メタ表現タイトル）を per-slide で評価し、S/A/B/C/D の 5 段階スコア +
> 改善提案を `reviews[review_type=title-subcopy-qa]` に書き込む。WritingQA が
> fatal/warn のゲートキーパー、でき太郎が writing コーチという棲み分け。

## なぜ独立した QA 層にしたか

機械検証で fatal 化すれば確実にゼロにできる性質の違反を、SchemaQA がテンプレ別必須
フィールドを fatal で塞いでいるのと同じ思想で、日本語表現の規範違反も fatal レベルで塞ぐ。

## 走査対象フィールド

各 slide エントリの中で、人間が読む全テキスト要素を走査する:

```
slides[].title                                  → 主張文
slides[].subtitle                               → 説明文 (R2-4 の主戦場)
slides[].eyebrow                                → 識別子（あれば）
slides[].notes / slides[].speaker_notes         → 発表者ノート
slides[].bullets[]                              → LIST-1 等の箇条書き
slides[].cards[].body / .description            → LIST-8 等のカード本文
slides[].steps[].body                           → フローチャート系のステップ
slides[].items[].text                           → FRAMING-2 等の Before/After リスト
slides[].columns[].body                         → LIST-2 等の 3 カラム
slides[].rows[].cells[]                         → 表系
```

## 走査フロー

```
for each slide in slides[]:
    for each text_field in (上記の対象):
        apply WritingQA-01 〜 WritingQA-19 in order
        if any violation:
            collect with severity (fatal / warn)
```

violation の出力形式は SchemaQA と同一:

```python
{
    "rule_id": "WritingQA-01",
    "target":  "S5 (LIST-1) subtitle",
    "message": "サブコピーが 42 字 — 60 字未満は説明力不足の典型 (R2-4 違反)",
    "severity": "fatal",
    "fix": "R2-4 の 4 要素 (具体・なぜ/どうやって・読後の変化・対比) を盛り込んで 120-200 字に書き直す",
}
```

---

## ルール一覧

### WritingQA-01: サブコピー 60 字未満禁止 (fatal)

**[Trigger]** 各スライドの `subtitle` が 1 字以上 60 字未満。

**[Anti-pattern]**
- 「現場が変わる」（6 字）
- 「分析の時間を 10 分の 1 に」（13 字）
- 「30 分の作業が 2 秒に」（17 字）

**[Exceptions]** 次のテンプレでは subtitle 短文化が許容（warn 降格）:
- SECTION-1 表紙 / SECTION-3 閉じ / VISUAL-3 ビジュアル主体 / SECTION-2/4/5 セクション扉

**[Fix]** R2-4 の Before/After 例を参照し、4 要素から 3 つ以上を含む 120-200 字に書き直す。

---

### WritingQA-02: 翻訳調パターン検出 (fatal)

**[Trigger]** 全テキストフィールドで次のパターンが 1 件以上ヒット:

| パターン | 置換例 |
|---|---|
| `することができ(る\|ます\|ない)` | `できる` / `できます` / `できない` |
| `することが可能` | `できる` |
| `を行(う\|います\|った)` | `する` / `します` / `した` |
| `を実施(する\|します)` | `する` / `します` |
| `において(は)?` | `で(は)?` |
| `に関して(は)?` | `について(は)?` |
| `することにより` | `することで` / `して` |
| `まず最初(に)?` | `まず` |

**[Exceptions]** 固有名詞・引用文中・コードブロック内は除外。

**[Fix]** ja-writing/references/checklist-translation.md の置換表で機械的に置換。

---

### WritingQA-03: ハイプ語禁止 (fatal)

**[Trigger]** 全テキストフィールドで次のいずれかが 1 件以上ヒット:

```
革命的 / ゲームチェンジャー / 究極(の)? / 完全に / すべての(課題|問題)?(を解決)?
最高の / 完璧な / 魔法のよう / 奇跡的 / 世界初 / パラダイムシフト / 不可避
業界を再定義 / 民主化(する|します) / スーパーチャージ / 究めた / 至高の
```

**[Anti-pattern]**
- 「革命的な AI で業界を変えます」
- 「すべての課題を完全に解決」
- 「魔法のように動作する分析基盤」

**[Exceptions]** 引用文中（外部記事の見出しを ref で引いた時など）は除外。

**[Fix]** ja-writing/references/checklist-ai-style.md の置換表で代替表現に。
ハイプ語を消すと意味が薄くなる時は、その文自体が誇張に依存していたサイン。
具体（数字・固有名）に置き換える。

---

### WritingQA-04: 同じ助詞 4 連以上禁止 (fatal)

**[Trigger]** 一文の中で同じ助詞が **4 回以上連続して出現**:

- 「の」の四連: `〜の〜の〜の〜の〜`
- 「は」の四連: `〜は〜は〜は〜は〜`
- 「が」の四連: `〜が〜が〜が〜が〜`
- 「で」の四連: `〜で〜で〜で〜で〜`

**[Anti-pattern]**
- 「クライアントの業務の課題の解決のための分析基盤」（「の」五連）
- 「彼は私は彼女は知っているはずだ」（「は」三連でも fatal 寄り、四連は確実 fatal）

**[Exceptions]** なし（並列の助詞も同じ助詞が 4 連続するなら分割対象）。

**[Fix]**
1. 文を分割する（最頻出の解決策）
2. 別の助詞に置き換える
3. 語順を入れ替える
4. 不要な強調語を削る

---

### WritingQA-05: コロン直後ブロック禁止 (warn)

**[Trigger]** テキスト中に `(します|です|でしょう|だ|である)[:：]` の直後に改行 + リスト/コードブロックが続くパターン。

**[Anti-pattern]**
```
実行します:
- 項目1
- 項目2
```

**[Exceptions]** 名詞止めのコロン（`例:` `備考:` `補足:` 等）は OK。

**[Fix]**
- 「実行します:」→「実行方法は次の通り。」
- 「説明します:」→「説明する内容は次の通り。」

---

### WritingQA-06: 弱い表現連発禁止 (warn)

**[Trigger]** 一文中に「かもしれない」「と思われる」「の可能性がある」「と言えるでしょう」等の弱い断定が **2 件以上同居**。

**[Anti-pattern]**
- 「FactHub は、現場の作業を効率化できるかもしれませんし、新しい価値を生む可能性もあります」

**[Exceptions]** 統計の解釈・将来予測などで本当に不確実な内容は許容（1 件まで）。

**[Fix]** 言い切りに変える、または弱表現を 1 件に絞る。

---

### WritingQA-07: 一文 100 字超 (warn)

**[Trigger]** 句点（。）で区切った一文が 100 字を超える。

**[Anti-pattern]**
- 一文に節が 3 つ以上挟まり、主語と述語が遠い

**[Exceptions]** サブコピー全体（複数文を含む）ではなく、各文単独で判定。

**[Fix]** 句点で分割。textlint preset-ja-technical-writing の sentence-length と同じ規範。

---

### WritingQA-08: 読点 1 文 4 つ以上 (warn)

**[Trigger]** 句点で区切った一文の中に読点（、）が 4 つ以上。

**[Anti-pattern]**
- 「FactHub は、現場の、SQL を書ける担当者が、限られていて、分析が滞っていた、現場で力を発揮します」

**[Fix]** 文を分割するサイン。textlint max-ten と同じ規範。

---

### WritingQA-09: 二重否定禁止 (warn)

**[Trigger]** 「〜なくない」「〜ないことはない」「〜ないわけではない」等の二重否定。

**[Anti-pattern]**
- 「導入できないわけではない」 → ✅ 「導入できる」

**[Fix]** 肯定文に書き直す。

---

### WritingQA-10: 体言止め連発禁止 (warn)

**[Trigger]** 1 つの bullets[] / cards[].body 系リストで、**全項目が体言止め**かつ **動詞の名詞化**（「〜の実現」「〜の促進」「〜化」）が 3 件以上。

**[Anti-pattern]**
```
- 業務効率化の実現
- データ活用の促進
- 意思決定の高速化
- コスト削減の達成
```

**[Fix]** 動詞・言い切りに統一して並列性を出す:
```
- 業務を効率化する
- データ活用を進める
- 意思決定を速くする
- コストを下げる
```

---

### WritingQA-11: 横文字侵入検出 (warn)

**[Trigger]** タイトル・サブコピーで CLAUDE.md §C-1 の禁止語パターンが 1 件以上ヒット:

```
SECTION 0\d  / TOOL 0\d  / Feature  / Agenda  / Our Values  /
Solution  / Approach  / Overview  / Coverage  / Schedule (※「スケジュール」は OK)
```

**[Exceptions]** 固有名詞（FactHub, BigQuery, Slack 等）は除外。

**[Fix]** ja-writing/references/checklist-translation.md §B / brand-tokens.md §3 の代替表現に。

---

### WritingQA-12: 「箱型比喩」候補警告 (warn)

**[Trigger]** カタカナの専門用語（5 文字以上）の近傍 50 字以内に、**汎用比喩語**（「のようなもの」「みたいな」「いわば」「ちょうど〜のような」）+ **メタファー候補語**（「箱」「入れ物」「窓口」「執事」「秘書」「通訳」「料理人」）が同時出現。

**[Anti-pattern]**
- 「ストレージは、データを入れておく **箱** のようなものです」
- 「API は、サービス間の **会話の通訳者** です」

**[Exceptions]** 比喩を意図的に採用していて、本筋に戻る出口（次の文）で具体化されているなら warn のまま許容。

**[Fix]** ja-writing/references/checklist-metaphor.md の判定フローを通す:
1. 用語をそのまま使えないか?
2. 一行補足で済まないか?
3. 比喩は「適度に遠く・一点に絞り・出口を用意」しているか?

---

### WritingQA-13: タイトルが体言止めなのに subtitle あり (fatal)

**[Trigger]** スライドの `title` + `subtitle` が両方非空で、`title` が **体言止め** (名詞終端) で終わっている。

**判定アルゴリズム** (`scripts/writing-qa.py` の `ends_with_taigen` / `scripts/render/lib/ja-text-helpers.js` の `endsWithTaigen`):

```
1. 疑問符・感嘆符 (？！?!) で終わる → False (体言止めではない)
2. ですます調 (です / ます / でしょう / ください 等) で終わる → False
3. 動詞・助動詞終止形 (する / した / ある / いる / なる / だ / である / 一般動詞のう段ひらがな) で終わる → False
4. 形容詞終止形 (い + 直前が漢字 or 平仮名) で終わる → False
5. 助詞・終助詞 (を / に / で / と / から / まで / より / へ / や / は / が / も / ね / よ / か) で終わる → False
6. それ以外 → True (体言止めと推定)
```

**[Anti-pattern]**

| ❌ 体言止め (subtitle あり) | ✅ ですます調 |
|---|---|
| 「移行プロセスのポイント」 | 「移行プロセスのポイントを押さえます」 |
| 「効果と注意点」 | 「効果と注意点を整理します」 |
| 「ベアフットの基本」 | 「ベアフットの基本を確認します」 |
| 「2 章の持ち帰り」 | 「2 章の持ち帰りをまとめます」 |

**[Exceptions]** 次のテンプレは体言止め単独で使うのが規範のため除外（`DESUMASU_EXEMPT_TEMPLATES`）:
- `SECTION-1` 表紙
- `SECTION-2` セクション扉
- `SECTION-3` 閉じ
- `SECTION-4` セクション扉 A
- `SECTION-5` セクション扉 B
- `SECSUMMARY-1` 主役ビジュアル一発（subtitle なし規範）

`subtitle` 自体が空文字 / null のスライドは対象外（タイトル単独 → 体言止め OK）。

**[Fix]** 述語を補ってですます調に揃える。例:
- 「〜のポイント」→「〜のポイントを押さえます」
- 「〜と注意点」→「〜と注意点を整理します」
- 「効果 — 論文で確認できている 4 観点」→「効果は論文で 4 観点が確認できています」

**[Opt-out]** `doc.writing_strict: false` で WritingQA-13 を warn に降格。デフォルトは fatal。

---

### WritingQA-14: subtitle がですます調で終わっていない (fatal)

**[Trigger]** スライドの `title` + `subtitle` が両方非空で、`subtitle` の **最後の文** がですます調で終わっていない。

**ですます調判定** (`ends_with_desumasu`): 最後の文 (句点で区切った最後の非空文) の末尾が次のいずれか:

```
です / でした / でしょう / でしょうか / ですか / でしたか
ます / ました / ません / ましょう / ますか / ませんか / ましたか / ませんでした
ください / てください / でください
なります / になります / となります / なりました / になりました / となりました
できます / できません / ありません / ございます
いたします / 致します / いただきます / いただけます
```

句点 (。) の有無は問わない。スライド末尾は句点無しが一般的。

**[Anti-pattern]**

| ❌ 非ですます調 | ✅ ですます調 |
|---|---|
| 「効果とリスクをフラットに並べた地図を作る」 | 「効果とリスクをフラットに並べた地図を作ります」 |
| 「〜に落ち着いている (8)(9)」 | 「〜に落ち着いています (8)(9)」 |
| 「〜の入口表」(体言止め) | 「〜の入口表として整理しました」 |
| 「〜で十分絞れる」 | 「〜で十分絞れます」 |

**[Exceptions]** WritingQA-13 と同じ例外テンプレ（`DESUMASU_EXEMPT_TEMPLATES`）。`subtitle` が空文字 / null は対象外。

**[Fix]** 最終文の述語をですます調に書き直す。タイトルが体言止め単独で十分な場合は subtitle を消すという選択肢もある（その場合 WritingQA-13 / 14 は両方発動しなくなる）。

**[Opt-out]** `doc.writing_strict: false` で WritingQA-14 を warn に降格。

---

### WritingQA-15: ナレーション台本の長さ (warn)

**[Trigger]** 各スライドの `speaker_notes` / `notes` / `narration` フィールドの可読文字数が **30 字未満** または **350 字超**。空白・改行は除いて評価する。

**[Anti-pattern]**
- `speaker_notes: "短い"` (2 字)
- `speaker_notes: "ベアフットの構造を……"` を 400 字超まで詰め込む

**[Fix]** 80〜250 字を目安に書き直す。タイトルを 1 文目の伏線に組み込み、本文の主張・根拠・次への橋渡し（自然な転調）を 2-4 文で構成する。

**[Opt-in]** `doc.narration_strict: true` で WritingQA-15 を fatal に昇格。デフォルトは warn。

---

### WritingQA-16: 視覚依存表現の混入 (warn)

**[Trigger]** ナレーション台本に「ご覧の通り」「ご覧のスライド」「画面右」「画面左」「画面上/下」「こちらの図」「上の図」「下の図」「矢印が示す」「青い枠」「赤い枠」など、**音声単独で意味が通らない視覚前提語** が混入。

**[Background]** ナレーションは音声トラック単独で意味が通るのが理想。視覚依存語は動画化時に「映像と音声がズレた瞬間に意味不明になる」破綻ポイント。

**[Anti-pattern]**
- 「ご覧の通り、4 つの差分があります」
- 「画面右に示すように、トーボックスが広いのが特徴です」
- 「この図のように、3 段階で進みます」

**[Fix]**
- 「ご覧の通り」→ 削除（次の文で本題に入る）
- 「画面右の図」→「ここで紹介する 4 つの差分」
- 「この図のように」→「具体的には次の通り」

**[Opt-in]** `doc.narration_strict: true` で fatal 昇格。

---

### WritingQA-17: 箇条書きマークアップ残存 (warn)

**[Trigger]** ナレーション台本の行頭に `* ` / `- ` / `1. ` のいずれかの **箇条書きマークアップ** が残っている。

**[Background]** Phase 2 で plan.json を書く時、本文 bullets[] を speaker_notes にコピペしてしまうと箇条書きマークアップが残る。これを TTS に渡すと「アスタリスク 1 つ目 アスタリスク 2 つ目…」のように読み上げられて破綻する。

**[Anti-pattern]**
```
リストで紹介します。
* 1 つ目
* 2 つ目
* 3 つ目
```

**[Fix]** 接続詞で繋いで散文に書き直す:
> 「3 つの観点で見ます。1 つ目はヒール差で、ゼロドロップに近いことが条件になります。2 つ目はソール厚で、おおむね 8 ミリ以下が目安です。3 つ目はトーボックスの広さで、つま先がしっかり広がる空間が必要です。」

**[Opt-in]** `doc.narration_strict: true` で fatal 昇格。

---

### WritingQA-18: ナレーション台本の体言止め終端 (warn)

**[Trigger]** ナレーション台本の **末尾の文が体言止め** で終わっている（`ends_with_taigen` ヘルパーで判定、WritingQA-13 と同じロジック）。

**[Background]** 体言止めはスライド本文では締まりを生むが、ナレーションでは「途切れて聞こえる」破綻になる。読み上げの最後は ですます調 で着地させる。

**[Anti-pattern]**
- 「移行プロセスは 4 ステップ。」
- 「最も大事なのは、トーボックスの広さ。」

**[Fix]**
- 「移行プロセスは 4 ステップ。」→「移行プロセスは 4 ステップで進めていきます。」
- 「最も大事なのは、トーボックスの広さ。」→「最も大事なのは、トーボックスの広さだと言えます。」

**[Opt-in]** `doc.narration_strict: true` で fatal 昇格。

---

### WritingQA-19: FRAMING-5 mindset.title が ですます調で終わっていない (warn)

**[Trigger]** `template_id == 'FRAMING-5'` のスライドで `mindset.title` の **末尾が
ですます調で終わっていない** (`ends_with_desumasu` で判定)。WritingQA-14 (subtitle
ですます調) と同じ ですます調ヘルパーを mindset 側に拡張したルール。

読者が章末で目にする最後の文章は subtitle と mindset の **両方** であり、片方が常体だと
締まりが落ちる。

**[Anti-pattern]**
- 「ベアフットは靴ではなくプロセス、と覚える。」
- 「『良い靴か / 悪い靴か』ではなく『良い移行か / 悪い移行か』で結果が決まる。」
- 「軸を先に決めれば候補は自然と絞れる。」

**[Fix]**
- 「…と覚える」→「…と覚えてください」 / 「…と覚えましょう」
- 「…で結果が決まる」→「…で結果が決まります」
- 「…自然と絞れる」→「…自然と絞れます」
- 「…腹を括る」→「…腹を括りましょう」

**[Opt-in]** `doc.narration_strict: true` で fatal 昇格。**既定は warn**。

**[Scope]** FRAMING-5 のみ。他テンプレの本文や mindset 風カードには適用しない。

---

## braindump モード専用ルール (WritingQA-24〜30)

braindump.md ファイル (Phase 1 の自由記述) には `validate_writing_qa_braindump` が
適用される。文体系チェック (WritingQA-02/03/04/09/11/12/21/22) は **OFF** で、
構造系のみが走る。

### WritingQA-24 [fatal]
Intro Q 件数と Q 章件数の不一致 / 矢印先空欄。

### WritingQA-25 [fatal]
本文段落に **数値 (数字+単位)** を含むのに、`[N]` 形式の参照ポインタが 1 件も無い段落を検出。

**escape hatch**: 段落末尾に `[no-ref]` を付ければ warn 降格。出典不要な前置き / 結語 / 個人見解で使う。

> 固有名詞 (Slack, Trader Joe, 〜株式会社 等) は機械強制対象から外している。
> 出典を要する固有名詞は人間判断で `[N]` を付ける運用。

### WritingQA-26 [fatal]
本文中の `[N]` が `## 0. References` テーブルに登録されていない (孤児参照)。

### WritingQA-27 [warn]
References テーブルに登録した `[N]` が本文中で 1 度も使われていない (孤児リンク)。

### WritingQA-28 [warn]
Q 章のフロントマターに `> visual: required` と書かれているが、章内に
`<img src="...">` または `![alt](path.png)` が無い時に warn。

braindump-illust.py が未実行 / 失敗ケースの検出に使う。fatal にすると illust が
走る前に蹴られて永遠に通らないので、warn 止め。

**opt-out**: `> visual: optional` または `> visual: none` に下げれば WritingQA-28 はトリガーしない。

### WritingQA-29 [fatal]
Q 章 frontmatter `> visual:` 行必須。

### WritingQA-30 [fatal]
`> visual: required` で illust 実行ログ必須。

### References テーブルの形式

```markdown
## 0. References

| # | タイトル | URL | 媒体 | 取得日 |
|---|---|---|---|---|
| [1] | ... | ... | ... | ... |
```

### opt-out

`doc.skip_braindump_inline_refs: true` を plan.json に書けば WritingQA-25/26/27 を一括 skip。

---

## 走査の自動実行

`validate_writing_qa(data)` 関数として `scripts/writing-qa.py` に実装。
`render-deck-instruction.py` から SchemaQA と並列で呼ばれる:

```python
m_violations = validate_v39(data)
secqa_violations = validate_secqa(data)
schemaqa_violations = validate_schema_qa(data)
writingqa_violations = validate_writing_qa(data)
refqa_violations = validate_refqa_auto(data)
```

`--strict` モード（run-qa.py phase2 が必ず付ける）で fatal が 1 件でも出れば
exit 2 で止まる。

## qa_report.json への反映

```json
{
  "layers": [
    {"code": "M",          "name": "M? (Schema 検査)",      ...},
    {"code": "SchemaQA",   "name": "Schema QA",              ...},
    {"code": "WritingQA",  "name": "Writing QA",             ...},
    {"code": "SecQA-Auto", "name": "Sections QA (自動)",     ...},
    {"code": "RefQA-Auto", "name": "Reference QA (自動)",    ...},
    {"code": "SQA",        "name": "Slide QA (手動)",        ...},
    {"code": "VQA",        "name": "Visual QA (手動)",       ...}
  ]
}
```

## ja-writing スキルとの関係

- ja-writing スキル → **書く前 / 書きながらの物差し**（人が読んで参照する）
- WritingQA → **書いた後の機械ゲート**（plan.json を通す/通さないの判定）

両者は同じ規範を共有する。WritingQA の各ルールは ja-writing の対応 CHECKLIST と
紐づいており、Fix 列で参照先を明示している。

## オプトアウト

特殊なデッキ（小説風・寓話的・実験的表現）で WritingQA をスキップしたい時は:

```json
{
  "doc": {
    "writing_qa_disabled": true,
    "writing_qa_disabled_reason": "意図的に翻訳調を残す実験デッキのため"
  }
}
```

ただし **C-10 違反として CHANGELOG / レビューでマーク** されるので、原則として
非推奨。本当に必要な時の最終手段。

## 分業: 構造系を機械、文体系を人と ja-writing skill

「**構造的整合性 (Q 件数・出典・図解配置)** は機械で守り、**文体は人と
ja-writing skill** で見る」という分業を採用している。

- braindump モード: 文体系 (WritingQA-02/03/04/09/11/12/21/22) を OFF にし、
  構造系 (WritingQA-24〜30) のみを走らせる。散文の規範チェックは ja-writing skill
  (standalone) が 4 大原則 + CHECKLIST で見るのが本筋。
- plan モード: スライド最終アウトプット側のルール (WritingQA-01〜19) はそのまま
  fatal で守る。タイトル + サブコピーがあるスライドでの WritingQA-13 (タイトル
  体言止め禁止) / WritingQA-14 (subtitle ですます調必須) も従来通り fatal。
