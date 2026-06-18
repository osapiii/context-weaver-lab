# Slide QA — ページ単位の規約検査ルール

> **Phase 2 完了直前に、指示書 JSON の各 `slides[]` エントリを 1 件ずつ走査して
> 全 SQA ルールを照合する**。違反があれば JSON を修正してから次の `sections-qa.md` に進む。
>
> ルール記述フォーマットは `qa/README.md` 参照。すべて
> `[Trigger] / [Anti-pattern] / [Exceptions] / [Fix]` の 4 ブロック構成。
> 引用情報の検証は `qa/reference-qa.md` の RefQA で行う。

---

## 走査フロー

```
for each slide in slides[]:
    apply SQA-01 〜 SQA-15 in order
    if any violation:
        record violation → propose fix → user-edit JSON
    else:
        proceed to next slide

Slide QA 完了後の流れ:
    Slide QA → Sections QA → Reference QA → (Phase 4) Visual QA
```

すべてのスライドが SQA を通過したら `sections-qa.md` に進む。
**スライド単位の修正で他スライドに影響が出た時は、影響範囲のスライドだけ再走査する**。

---

## SQA-01: 1 スライド = 1 メッセージ

**[Trigger]**
The slide shall convey exactly one core message expressible in a single sentence.

**[Anti-pattern]**
× タイトル「機能と価格と導入事例」 — 3 つを 1 枚に詰めている
× サブコピーで主張 A、本文で主張 B、図で主張 C を別々に展開している
× 章扉以外のスライドで `slide_goal.title` が「〜と〜と〜について説明する」になっている

**[Exceptions]**
- 目次（SECTION-6）は構造提示のため、複数項目の並列が前提
- 参考情報集（DATA-4）は資料性質上、複数情報が並ぶのが正常

**[Fix]**
1. `slide_goal.title` を読んで、主張が複数あるか判定
2. 複数なら最も重要な 1 件を残し、他は別スライドに分離
3. 分離したスライドは独立した `slide_goal` を持たせ、章内の論理順に並べる

---

## SQA-02: タイトルとサブコピーの主張整合

**[Trigger]**
The slide's `subtitle` shall be a logical extension of the `title` —
either restating it more concretely, or explaining "why / how".

**[Anti-pattern]**
× タイトル「30 分の作業が 2 秒に」+ サブコピー「弊社のミッションは〜」 — 主張が断絶
× タイトル「導入実績 100 社」+ サブコピー「機能は 6 つあります」 — 別の話に飛んでいる

**[Exceptions]**
- 表紙（SECTION-1）はサブコピーが「副題」役割で、タイトルの直接補強でなくてよい
- セクション扉（SECTION-2 / 4 / 5）は章タイトル + 章リードの構造が固定

**[Fix]**
1. タイトルの主張を 1 文で要約 → サブコピーがその主張を補強しているか確認
2. 補強していなければ、サブコピーをタイトルの「具体化 / 理由 / 結果」のいずれかに書き直す
3. 書き直しが難しい場合は SQA-01 違反の可能性 → スライド分割を検討

---

## SQA-03: サブコピーの説明力（R2-4 の補完検査）

**[Trigger]**
The slide's `subtitle` shall enable a reader to understand the slide's content
**without seeing the body**, by including 3〜4 of:
(a) concrete numbers/proper nouns, (b) why/how explanation,
(c) before/after delta, (d) contrast / negation.

**[Anti-pattern]**
× 「現場が変わる」（6 字、何も具体がない）
× 「分析の時間を 10 分の 1 に」（13 字、なぜ・どうやってが無い）
× 「事業会社ではよく〇〇という課題があります」（曖昧語の典型）

**[Exceptions]**
- 表紙・閉じ・ビジュアル主体（SECTION-1 / SECTION-3 / VISUAL-3）はサブコピー短文化が許容

**[Fix]**
1. R2-4 の Before/After 例（120〜200 字推奨）を参照
2. (a)〜(d) のうち少なくとも 3 つを含むよう書き直し
3. 250 字を超える場合は SQA-01 違反（1 メッセージ）の可能性 → 分割検討
4. **書き直した文には `ja-writing` スキルの 4 チェックリスト（翻訳調 / てにをは / 比喩 / AI 風）を必ず通す**。短文化に走って「することができる」を多用したり、抽象語で水増ししたりするのを防ぐ

---

## SQA-08: タイトル冒頭識別子と subsection の役割分担

**[Trigger]**
When `title` starts with an identifier (e.g., "Phase 2：" "Step ①："),
that identifier shall mark this slide's position within a sequence,
while `subsection` shall name the **group** the slide belongs to —
the two vocabularies do not need to match.

**[Anti-pattern]**
× タイトル「Step ①：着手前準備」+ subsection「Step ①」 — 同じ語を 2 重に表示
× タイトル冒頭に「Phase 2：」と書きながら subsection が null で、章内の位置が読者に伝わらない

**[Exceptions]**
- 章扉（SECTION-2 / 4 / 5）は識別子と subsection を意図的に揃えてよい
- 目次（SECTION-6）は項目名そのままなので識別子は不要

**[Fix]**
1. タイトル冒頭識別子は「sequence 内位置」を示す形に統一（"Phase 2：" "Step ①：" 等）
2. subsection はグループ名（「ステップ別の説明」「比較」等、3-10 字）を入れる
3. 同一 subsection のスライドは連続配置（離れると HTML divider が分裂する）

---

## SQA-10: illustration_decision の整合性（既存 M4 / M5 の補完検査）

**[Trigger]**
- `adopt: true` のスライドには `illustration` がネストされていなければならない
- `adopt: false` のスライドには `illustration` が存在してはならない
- `reason` は採用/拒否の根拠を 1〜2 文で記述する

**[Anti-pattern]**
× `adopt: true` だが `illustration` フィールドが欠落
× `adopt: false` だが `illustration` オブジェクトが残っている（M5 違反）
× `reason` が「不要」「必要」など 2〜3 文字で根拠なし

**[Exceptions]**
- DIAGRAM-4（セクション挿絵）自体は `adopt: false` 固定（理由「DIAGRAM-4 自体が挿絵スライドのため」）

**[Fix]**
1. M4 / M5 のスキーマ規約（`deck-instruction-schema.md`）を再確認
2. `render-deck-instruction.py` の stderr に M4/M5 VIOLATION が出ないことを確認
3. `reason` は「なぜ採用するか／しないか」を読者が理解できる表現にする

---

## SQA-11: slide_goal の二重構造

**[Trigger]**
Every slide shall have `slide_goal: { title, subtitle }` filled in,
where `title` = "what to convey" and `subtitle` = "how to lead the reader".
This is the **design intent**, not the displayed text.

**[Anti-pattern]**
× `slide_goal.title` が display title と完全に同じ文字列（設計意図が記述されていない）
× `slide_goal.subtitle` が「読者を導く」など空疎な表現
× `slide_goal` フィールド自体の欠落（M6 違反）

**[Exceptions]**
- なし（全スライド共通）

**[Fix]**
1. `slide_goal.title`: display と異なる「設計者の意図」を 1 行で書く
2. `slide_goal.subtitle`: 「このスライドを見た読者が次にどう動くか」を 1 行で書く
3. 例: display title「30 分の作業が 2 秒に」 / `slide_goal.title`「FactHub の最大価値を
   1 メッセージで刺し込む」 / `slide_goal.subtitle`「読者を『自分の業務でも試したい』
   気持ちにさせる」

---

## SQA-12: 横文字・カタカナ語の侵入

**[Trigger]**
The slide shall avoid English/katakana decorative labels (e.g., "Feature 01",
"Our Values", "Agenda", "Point 1") as eyebrow or section markers.
Use Japanese equivalents instead.

**[Anti-pattern]**
× eyebrow に "STEP 01" / "POINT 1" / "FEATURE A"
× タイトルに "Our Mission" / "Agenda" / "Product Detail"
× サブコピーで「コア・バリュー」「フィージビリティ」など意味のないカタカナ多用

**[Exceptions]**
- 固有名詞（「FactHub」「BigQuery」「OpenAI」等）
- 技術用語で日本語訳が定着していないもの（「JSON」「API」「OAuth」等）
- 単位・記号（「kg」「%」「USD」等）
- 識別用の番号（「①」「Step 1」など、装飾ではなく順序提示）

**[Fix]**
1. eyebrow / section marker / decorative label を全件抽出
2. Exceptions に該当しないものを日本語化（「Step 01」→「①」「手順 1」）
3. C-1 ルール（横文字を使わない）に整合させる

---

## SQA-13: detail_blocks への URL 直書き禁止

**[Trigger]**
`detail_blocks` の `text` または `items[]` の中に `http://` / `https://` で始まる
文字列が含まれている場合は違反。URL は `ref_table[]` に格納するのが唯一の正しい置き場。

**[Anti-pattern]**
× `{ "heading": "🔗 参照元", "text": "https://docs.getdbt.com/best-practices/..." }`
× `{ "items": ["詳細は https://example.com を参照"] }`
× `{ "text": "出典: https://www.ipa.go.jp/..." }`

上記のような書き方では HTML 指示書の「参照元」として表示されるが、
`ref_table` に入っていないため DATA-4（最終ページのリファレンス一覧）に
一切反映されない。読者が参照先を辿れなくなるため厳禁。

**[Exceptions]**
- なし — URL は全件 `ref_table[]` へ移動する

**[Fix]**
1. 違反している `detail_blocks` エントリから URL を削除
2. `ref_table[]` に `{ category, title, url, source }` 形式で行を追加
3. 本文（`items` / `text`）に `(N)` 形式のインライン参照番号を挿入
4. DATA-4 の `ref_table` にも同じ行を追加して RefQA-05 の対応整合を維持

---

## SQA-14: slides[] に section_id が必須

**[Trigger]**
`slides[]` の各エントリに `section_id` フィールドが存在し、かつその値が
`sections[]` のいずれかの `id` と一致していること。

`section_id` は「このスライドがどの章に属するか」をスクリプト側が判定する
唯一の根拠。欠落すると `getSectionIdx` が警告を出してインデックス 0 に
フォールバックし、ナビチップの active 位置がズレる。

**[Anti-pattern]**
× `slides[]` エントリに `section_id` キーが存在しない
× `section_id: "setup"` だが `sections[]` に `id: "setup"` のエントリがない（typo）
× `section_id: ""` や `section_id: null`（空値）

**[Exceptions]**
- 表紙 (SECTION-1)、閉じ (SECTION-3)、目次 (SECTION-6) は章構造の外なので省略可
- FRAMING-3 会社紹介など固定枠スライドも省略可

**[Fix]**
1. 各スライドの `section_id` が `sections[].id` のいずれかに一致するか確認
2. 不一致は typo か sections 定義漏れ — どちらかを修正する
3. sections[] の各エントリに `id` フィールドが定義されているかも同時に確認

---

## SQA-15: subsection がある場合、ナビに section › subsection が表示されること

**[Trigger]**
`subsection` フィールドに文字列が設定されているスライドは、スクリプトで
`addChromeWithNavById(s, pageNum, section_id, subsection)` または
`addChromeWithNav(s, pageNum, sectionIdx, subsection)` を呼び出し、
ナビ上に **`章名 › サブセクション名`** のパンくずが表示されること。

subsection を JSON に書いても、スクリプト側に渡されなければ画面に出ない。
この対応漏れを Phase 2 設計段階で検出するのが本ルールの目的。

**[Anti-pattern]**
× JSON の `subsection: "ローカル環境"` を書いたが、Phase 3 スクリプトで
  `addChromeWithNav(s, pageNum, sectionIdx)` と呼んで第4引数を渡し忘れた
× `addChromeWithNavById(s, p, 'setup')` と書いて subsection を省略した
  （JSON では subsection が定義されているのに）
× subsection が JSON に書かれているスライドのナビに `›` バッジが出ていない

**[Exceptions]**
- 表紙・閉じ・セクション扉・目次など、ナビ自体が不要なスライドは対象外

**[Fix]**
1. Phase 3 スクリプト内で `subsection` 付きスライドに対応する行を確認
2. `addChromeWithNavById(s, pageNum, slide.section_id, slide.subsection)` を使う
3. Phase 4 の PNG 目視で `›` バッジが出ているか確認（VQA と連携）

---

## 自己チェック（SQA 全件走査後）

走査完了後、以下を確認してから `sections-qa.md` に進む：

- [ ] 全スライドが SQA-01〜03 / 08〜15 を通過した（違反 0 件）
- [ ] 修正で他スライドに波及した変更（タイトル整合・横文字混入など）も再走査した
- [ ] M1〜M8（既存ルール）の VIOLATION も並行して 0 件であることを `render-deck-instruction.py`
      の stderr で確認した

すべてクリアしたら `sections-qa.md` → `reference-qa.md` の順に進む。
