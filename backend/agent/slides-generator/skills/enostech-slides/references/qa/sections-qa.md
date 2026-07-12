# Sections QA — 章単位の構造検査ルール

> **Phase 2 完了直前、`slide-qa.md` の全件通過後に、`sections[]` の各章を
> 1 件ずつ走査して全 SecQA ルールを照合する**。違反があれば JSON を修正してから
> Phase 3 に進む。**Slide QA より粒度が大きいので、章タイトル ↔ 章内スライド
> の整合や、章扉直後の媒体選定など、ページ単位では拾えないバグを潰す**。
>
> 「Chapter で指示した内容が章内スライドに反映されていない」のような
> 全体構造のズレを直接ターゲットにするのが Sections QA の主目的。

---

## 走査フロー

```
for each section in sections[]:
    apply SecQA-01 / 03 / 04 / 05 / 06 / 07 / 09a-d / 10 in order
    if any violation:
        record violation → propose fix → user-edit JSON
        → if fix changes slide-level fields, re-run SQA on affected slides
    else:
        proceed to next section
```

> SecQA-05 (subsection 必須化) / SecQA-09a-d (LIST-1 連続・比率) / SecQA-10 (章 name サニティ) は
> `scripts/render-deck-instruction.py` の `validate_secqa` が自動検出する。
> `render-deck-instruction.py --strict` で fatal 違反があれば exit code 2 で
> Phase 2 提出をブロックするので、plan.html 書き出し前に必ず通すこと。
>
> 残りの SecQA-01/03/04/06/07 はコンテンツ判断が必要なため引き続き
> 手動採点。Claude が `qa_report.layers[SecQA].violations` に追記する形で
> 自動結果に上乗せされる（自動結果は上書きされない）。
>
> 旧 SecQA-02 / 08 / 11 は StructureQA に集約済み。後継ルール:
>
> | 旧 ID | 新 ID | 実装場所 |
> |---|---|---|
> | SecQA-02 | **StructureQA-12** | `deck-structures/learning-deck.js::body.head[1]` |
> | SecQA-08 | **StructureQA-01 / 02** | 同上 `header[]` / `footer[]` |
> | SecQA-11 | **StructureQA-13** | 同上 `body.tail[0]` |

`sections[]` を全件走査して全 SecQA を通過したら、`render-deck-instruction.py` で
HTML レンダリング → ユーザー plan.html 書き出しに進む。

---

## SecQA-01: 章タイトルが章内スライドの内容を網羅している

**[Trigger]**
The section's `name` shall summarize the union of all `slide_goal.title` /
display titles inside that section. A reader who only sees the section name
shall be able to predict the kind of content inside.

**[Anti-pattern]**
× 章名「導入」だが、章内に「価格表」「セキュリティ仕様」「導入事例」が混在 — 章名と中身が乖離
× 章名「機能紹介」だが、5 機能のうち 1 機能の話に 7 枚使い、残り 4 機能は 1 枚に圧縮 —
  章名から想像する密度感と一致しない
× 章名「これまでとこれから」だが、章内が全部「これから」しかない — 章名が誤解を招く

**[Exceptions]**
- 「序盤・締めの固定枠」（FRAMING-1 / FRAMING-2 / FRAMING-3 / FRAMING-4 など）は章名が抽象的でもよい
- 「目次」「参考情報集」など機能スライド単独章

**[Fix]**
1. 章内スライドの display title と `slide_goal.title` を全件抽出
2. それらを 1 文で要約 → 現在の章名 `name` と差分があるかチェック
3. 差分があれば章名を書き直す or 中身を分割して別章に切り出す
4. 「Chapter 指示が反映されない」課題に対する直接的な処方箋

---

## SecQA-03: 章内スライド数のバランス

**[Trigger]**
Each section shall have between 2 and 10 slides (excluding the section divider
itself and the section overview slide).

| 章内スライド数 | 判定 |
|---|---|
| 0 | 章自体が空 — 削除 or 他章にマージ |
| 1 | 薄すぎ — 他章にマージ or 章として分ける必然性を再考 |
| 2〜10 | OK |
| 11+ | 1 章に詰めすぎ — subsection で分割可能か検討、ダメなら章を分割 |

**[Anti-pattern]**
× 1 つの章に 15 枚詰めて、subsection も使っていない（読者が章の終わりを見失う）
× 章が 8 つあるが各章 1〜2 枚しかなく、章の意味がない（フラットに並べた方が良い）

**[Exceptions]**
- 「目次」「参考情報集」「会社紹介」など機能スライド単独章は 1 枚で OK

**[Fix]**
1. 章内スライド数を全章カウント
2. 1 枚の章は他章にマージ or 章削除
3. 11 枚以上の章は subsection で 2〜3 グループに分割、または章を 2 分割

---

## SecQA-04: 章内の論理フロー

**[Trigger]**
Each section shall follow exactly one of these logical patterns:
(a) overview → details, (b) problem → solution, (c) before → after,
(d) chronological steps. The pattern shall be inferable from the slide order.

**[Anti-pattern]**
× 章扉直後に詳細スライドが来て、後半でやっと一覧（順序が逆 — 認知負荷大）
× 章内で「課題」「効果」「機能」「価格」が混在し、どのパターンにも乗らない
  （SecQA-01 違反でもある）
× before → after パターンと言いながら、after の話しかない

**[Exceptions]**
- 「目次」「参考情報集」「会社紹介」など機能スライド章

**[Fix]**
1. 章内スライドを並べ直して 4 パターンのどれに該当するか判定
2. 該当なしなら、章を分割するか、不要スライドを削除して 1 パターンに収束させる
3. 章名 `name` も論理フローを匂わせる表現にする
   （「導入」より「課題から解決へ」の方が読者にとって予測しやすい）

---

## SecQA-05: subsection 必須化（自動採点）

**[Trigger]**
- **章本文 ≥ 4 枚なら subsection を 2 個以上立てる必須**
- 章本文 ≤ 3 枚の小章は subsection 0 個でもよい
- 1 subsection あたりのスライド数は 1 枚でも OK

| 章本文枚数 | subsection 数 | 判定 |
|---|---|---|
| ≤ 3 | 0 個 | OK |
| ≤ 3 | 2〜4 個 | OK (使ってもよい) |
| ≥ 4 | 0 個 | **fatal** — 本文 4 枚以上で構造化なしは読者が迷子になる |
| ≥ 4 | 1 個 | **fatal** — 1 個だけは「立てた振り」で実質意味がない |
| ≥ 4 | 2〜4 個 | OK |
| 任意 | 5+ 個 | 章自体を分割すべきサイン |

**[Anti-pattern]**
× 章本文 9 枚で subsection 0 個 — 読者が章内のどこにいるか分からない
× 章本文 7 枚で subsection 1 個（章名と完全重複） — 構造化に失敗、機械的な数合わせ
× subsection 名が `"1.1"` `"2.1"` のような番号 — 「立てた振り」の典型、意味のある日本語名を付ける
× 6 つの subsection が並ぶ章（読者が章の境界を見失う）
× subsection が連続配置されておらず、HTML divider が分裂している

**[Recommended]**
意味のある 3〜10 文字の日本語名で 2〜4 個に切り分ける。例:
- 章「開発環境セットアップ」(本文 9 枚) →
  「ローカル環境」(3 枚) / 「WH 連携」(2 枚) / 「pre-commit と IDE」(3 枚) / 「昇格パイプ」(1 枚)
- 章「チーム開発と CI/CD」(本文 9 枚) →
  「PR とテンプレ」(2 枚) / 「Claude 協働」(1 枚) / 「CI ジョブ」(2 枚) / 「Slim CI と Secret」(4 枚)

**[Exceptions]**
- 1 ページ subsection は OK。むしろ「subsection 名がナビに出る」効果が
  大きいので、章内で構造を明示したい時は 1 ページでも積極的に使う
- 章本文 ≤ 3 枚の小章は subsection 0 個でも fatal にならない

**[Fix]**
1. 各 subsection 内のスライド数を確認 → 1 枚も OK。
   ただし subsection 数 1 つだけ（章名と重複）は null に戻す
2. 5 つ以上の subsection は章分割を検討
3. 同一 subsection のスライドを連続配置に並び替える（離れていると HTML 上で
   別 divider に分かれる）

---

## SecQA-06: 章をまたいだ重複情報の排除

**[Trigger]**
The same fact-based claim (number, third-party case, survey result) shall not be
asserted in two or more sections without an explicit cross-reference.

**[Anti-pattern]**
× 第 1 章で「導入企業の 80% が満足」と書き、第 3 章でも同じ数値を再掲（読者が「また同じか」と感じる）
× 第 2 章で他社事例 X を出し、第 4 章で同じ事例 X をまた出す（記憶の上書きが起きる）

**[Exceptions]**
- 締めスライド（FRAMING-2 / FRAMING-4 など）で本編の主張を再掲するのは OK（むしろ推奨）
- インライン参照番号 `(N)` 経由の再利用は OK（同じ参照を別文脈で使う形）

**[Fix]**
1. 全章の数値主張・事例固有名詞を grep で抽出
2. 重複している主張を発見 → 1 箇所だけ残し、他章は「第 1 章で述べた通り」のような
   軽い参照にする or 削除
3. 締めの再掲は意図的なので除外する

---

## SecQA-07: 章タイトル・subsection の語彙整合

**[Trigger]**
The section's `name` and the contained `subsection` field values shall not
overlap in vocabulary at the same level. They mark **different** structural levels
(章 ≠ サブグループ).

**[Anti-pattern]**
× 章名「Step ②」+ subsection「Step ②」 — 同じ語の 2 重表示
× 章名「導入手順」+ subsection「導入手順 A」 — 章名の派生で subsection が冗長

**[Exceptions]**
- 章扉と章挿絵を同じ subsection（「章の入口」など）にまとめる慣行は OK

**[Fix]**
1. 章名 `name` と subsection 値を並べて重複/派生関係をチェック
2. subsection はグループ名（「比較」「詳細」「事例」等、章名と異なる切り口）に書き直す
3. SQA-08 と整合させる（タイトル冒頭識別子は sequence 内位置、subsection は group 名）

---

## SecQA-09: テンプレ多様性の三段検査（自動採点）

LIST-1 比率と同一テンプレ連続を **連続 + 比率の三段構成** で検査する。
すべて `validate_secqa` で自動検出される。

| サブルール | 何を見るか | 違反基準 | 重大度 |
|---|---|---|---|
| **SecQA-09a** | **LIST-1 連続** | 章内で LIST-1 が 2 連続以上 | **fatal** |
| **SecQA-09b** | **LIST-1 章内比率** | 1 章で本文 ≥ 3 枚かつ LIST-1 比率 > 33% | **fatal** |
| **SecQA-09c** | **LIST-1 デッキ全体比率** | 全本文中 LIST-1 が 25% 超 | **fatal** |
| **SecQA-09d** | **同一テンプレ連続 (LIST-1 以外)** | 3 連続は fatal、2 連続は warn | warn / fatal |

**[Trigger]**
The section / deck shall satisfy all of 09a-09d. LIST-1 (標準コンテンツ・箇条書き
3 ブレット) は最も乱用されやすいテンプレで、「3 つの並列要素」をすべてこれで処理
するとデッキ全体の見た目が単調になる。**3 並列の第一候補は LIST-4 (縦 3 カード積み)**。
LIST-1 を選ぶ前に必ず LIST-4 / LIST-5 / LIST-6 / LIST-8 を試すこと。

**[Anti-pattern]**
× **LIST-1（標準コンテンツ・箇条書き 3 ブレット）が 2 枚以上連続** — 最頻パターン。
  3 連続は **Fatal**（必ず差し替え）、2 連続でも 1 枚を LIST-8 / LIST-4 / LIST-6 に置き換える
× 章内で LIST-7（タイル 3×3）が 3 枚連続 — リズムが単調で「もう同じ話か」と読み流される
× LIST-1（標準コンテンツ）が 5 枚連続 — 情報密度が均質化して章のメリハリが消える
× LIST-8（詳細カード）を 4 枚連続 — 1 枚ずつの掘り下げが薄まり、深堀感が出ない
× リスト系（FRAMING-2 等）を箇条書きを並べる目的で 2 枚以上連続 — 1 枚目で全体を
  一覧 → 2 枚目以降は LIST-1 / LIST-8 等で個別に深掘りする方が「一覧→詳細」モデルが効く

**[Exceptions]**
- 同一論理コンテンツが 2 ページに物理分割されたケース（DATA-4 参考情報集が 1 ページに
  収まらず 2 ページに渡る等）— ただし subsection で「参考情報集 (1/2)」「(2/2)」のように
  分割が明示されている時のみ
- DATA-2 / DATA-4 / COMPARE-4 等のデータ・参考系で、subsection で明確に区切られている連続
- 章扉（SECTION-2 / 4 / 5）は構造上連続しないので考慮外
- **LIST-1 2 連続の例外なし** — データ・参考系の例外には該当しない

**[Fix]**
1. 各章内の `template_id` シーケンスを抽出（例: `[LIST-1, LIST-1, LIST-1, DATA-4]`）
2. **LIST-1 連続を最優先で発見 → 別テンプレに差し替える**
3. 差し替え候補（同じ意図を別の見せ方で表現できるテンプレ）:

| 元（LIST-1 連続）の意図 | 差し替え候補 | 何が変わる |
|---|---|---|
| 3 つの並列要素を **結論として印象づけたい** | **LIST-4**（縦 3 カード積み） | 番号 + 色帯 + カード背景で「3 本柱」が視覚的に立ち上がる |
| 1 要素を **深掘り** したい | **LIST-8**（詳細カード） | 1 カードに集中させ、深堀感を出す |
| 4〜6 要素を **網羅的に** 並べたい | **LIST-5**（2×2 タイル）/ **LIST-6**（3×2 タイル） | グリッド配置で密度感を変える |
| 3 要素の **対比軸** を見せたい | **LIST-2**（3 カラム） | 縦 3 列で対比構造を明示 |
| Before / After の差分を見せたい | **COMPARE-1**（リッチ B/A）/ **COMPARE-2**（コンパクト B/A） | 比較構造を明示 |

4. 他テンプレ連続も同様に差し替え:
   - **LIST-7（タイル 3×3）連続** → LIST-5（2×2）/ LIST-6（3×2）でサイズ感を変える
   - **LIST-8（詳細カード）連続** → 1 枚を LIST-1 標準に変えて密度を変える
   - **リスト系連続（FRAMING-2 等）** → 1 枚目を一覧（リスト系）→ 残りを詳細（LIST-1 / LIST-8）に
     置き換える「一覧→詳細」構造へ
5. 統合できそうなら 2 枚を 1 枚にマージ（同じテンプレ 2 連続は内容も近いことが多い）

**狙い**: 「箇条書きで並べる系のテンプレ（特に LIST-1）が章内で連続しがち」という
現状の傾向を矯正し、章全体の視覚的リズムを意図的に作る。同じテンプレが続くと読者の
脳が「同じ情報パターン」と判断して情報摂取の解像度を下げるので、テンプレ切替自体が
情報設計の手段になる。

---

## SecQA-10: sections[].name サニティ（自動採点）

**[Trigger]**
`sections[i].name` is the **single source** for both ① section divider title
(章扉に出る大きな日本語タイトル) and ② navigation chip text (本文スライド上部の
チップ). The two strings must never diverge — they share one variable.

> 章扉タイトルと本文ナビチップが乖離した事故 (dbt × メダリオンデッキ S5/S10/S19/S24/S30/S39/S44 で
> 7 章中 7 章すべて不一致) を機に、name を唯一の真とし、ナビ chip 用の別文字列を持つ設計を
> 不可能化した（→ `scripts/example-deck.js` の `setDeckSections` ヘルパー）。

**[Anti-pattern]**
× `sections[].name` が空 / 1 文字 / 18 文字超 — fatal
× `name` が `"基本"` / `"プロジェクト"` / `"ピッチ"` / `"図解"` / `"ビジュアル"` —
  example-deck.js の DEMO_SECTIONS 残骸の可能性 (warn)
× ナビ用に「短縮版」を別で持つ → スキーマ違反、技術的に不可能化済み

**[Recommended]**
- 4〜12 文字の意味のある日本語で簡潔に（例: 「全体像と前提」「開発環境」「運用」）
- 章扉に出ても本文ナビチップに出ても同じ文字列で違和感がない長さに
- 18 文字を超える章タイトルが必要なら、章を分割する

**[Fix]**
1. `sections[].name` を 4〜12 文字に整える
2. 章扉スライドのタイトル shape にも同じ文字列を渡す（`addTitleBlock(s, sec.name, sec.lead, ...)` のように）
3. ナビは `setDeckSections(sections)` で一括登録 → `addChromeWithNav(s, page, idx)` が自動で `sections[idx].name` を chip に出す
4. 「ナビ用に短くする」発想自体を捨てる — 短いか長いかは name の設計でしか決まらない

**狙い**: 1 つの章に 2 つの名前を持たせる設計を物理的にできなくする。「ナビゲーション
チップの文字列はタイトルを採用するべき」という運用方針を仕組みで担保する。

---

## 自己チェック（SecQA 全件走査後）

走査完了後、以下を確認してから Phase 2 完了に進む：

- [ ] **`render-deck-instruction.py --strict` を走らせて exit 0** を確認した
      （SecQA-05 / 09a-d / 10 の自動 fatal が 0 件）
- [ ] **`node scripts/render/build-deck.js -i plan.json --validate-only` で
      StructureQA pass** を確認した (旧 SecQA-02 / 08 / 11 の構造検査はここに集約)
- [ ] 章名が章内スライドの内容を網羅している（SecQA-01、手動）
- [ ] 章内の論理フローが SecQA-04 の 4 パターンに沿っている（手動）
- [ ] 章をまたいだ事実主張の重複がない（SecQA-06、手動）
- [ ] 章タイトル ↔ subsection の語彙ダブり無し（SecQA-07、手動）
- [ ] 修正で slide-level に波及した変更は SQA を該当スライドだけ再走査した

すべてクリアしたら `render-deck-instruction.py --strict` で HTML レンダリング → plan.html 書き出し。
