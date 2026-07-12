# Phase 1 — ヒアリング

> 入口は `references/_common/workflow.md` の Phase 1 セクション。
> 本 README はディレクトリ内の構成と Phase 1 固有の注意点だけを置いている。

## このフェーズで何をするか

1. **読者** — 業種・規模・役職・前提知識を確認
2. **目的（Before → After）** — このデッキを読んだあと読者にどう動いてほしいか
3. **材料** — 数値・固有名詞・現場エピソードを集める。曖昧な「事業会社ではよくある」は禁止
4. 必要に応じて `web_search` でファクトの裏取り
5. **章立てメモが渡された場合: 受け取って保管するだけ**。AI 側からのリファイン案 (章数・枚数・テンプレ) 提示は **Phase 1 では禁止** (R1-11)
6. **`decks/yyyy-mm-dd_{slug}/` ディレクトリを作成**（R1-4）。Phase 2-4 はこの中で全作業を行う

## 🔴 このフェーズの絶対ルール

### R1-1 作業に入る前に Before→After を確認する

曖昧なら必ずユーザーに質問する。「どんな読者に・読み終えた後どう変わってほしいか」が
言語化できないままアウトラインに進むと、後段で全部やり直しになる。Phase 2 に入る前に
2 文で言い切れる状態を作る。

### R1-2 ユーザー固有のこだわり・トーン・NG 表現を確認する

業界用語の言い換え、避けたい表現、外せない固有名詞、トーン（カジュアル↔フォーマルの
どこか）— ユーザーの暗黙知を引き出すステップを省略しない。`--bypass` でも、これに
該当する情報がプロンプト内に無ければ必須 4 項目と一緒に 1 回だけ確認する。

### R1-4 Phase 2 に進む前に decks/yyyy-mm-dd_{slug}/ を作成する

ヒアリングが揃ったら Phase 2 に入る前に **必ず** `decks/yyyy-mm-dd_{slug}/` を `mkdir -p` する。
slug は Claude が題材から即決（hyphen-case の英数字 / 短く / 重複回避）。

- 後で気に入らなければユーザーがディレクトリ rename すればよいので、ここで承認待ちはしない
- 「`decks/2026-04-29_facthub-intro/` で進めます。気に入らなければ後で rename してください」と一言添える
- このディレクトリが Phase 2 の plan.html / plan.json、Phase 3 の draft/draft.pptx、Phase 4 の preview/ の作業ホームになる

```bash
DATE=$(date +%Y-%m-%d)
SLUG=facthub-intro
mkdir -p "<project_root>/decks/${DATE}_${SLUG}/draft"
```

この手順を踏まずに Phase 2 に進むと、plan.html の置き場がブレる。

### R1-5 ヒアリング末尾でカラースキーマを 3 段階で判定する

`decks/{slug}/` を mkdir した直後、Phase 2 に入る前に **必ずカラースキーマを判定**する。
判定は **以下の優先順位 (3 段階)** で機械的に行う。途中で解決した時点で打ち切り、
**最後の段階に到達したらユーザーに聞く**。

#### 判定アルゴリズム (上から順に試す)

1. **`<project_root>/decks/{slug}/palette.yml` が存在 → そのまま使う**
   - 既存デッキで作成済みのはここに置かれている
   - 存在すればユーザー意図 (手編集含む) を最大尊重し、追加質問しない
   - bash で `[ -f "decks/{slug}/palette.yml" ]` でチェック

2. **`<project_root>/DESIGN.md` が project root 直下に存在 → 自動で palette.yml を生成**
   - DESIGN.md は構造化トークン形式 (`# Design Tokens` + `## Colors`) または
     自然文型 9 セクション仕様書 (`## 2. Color Palette & Roles`) のどちらか
   - `node scripts/render/build-deck.js -i decks/{slug}/plan.json -o /dev/null` を 1 回呼ぶと
     `paletteYml.ensurePaletteYml` が `decks/{slug}/palette.yml` を自動生成する
   - 生成後はユーザーに「DESIGN.md から palette.yml を生成しました。色は brand=#XXXXXX, accent=#YYYYYY, highlight=#ZZZZZZ になります」と 1 行で報告
   - ユーザーから NG が出れば AskUserQuestion で再ヒアリングへ

3. **palette.yml も DESIGN.md も無い → ユーザーに聞く** (AskUserQuestion で 1 回限り)
   - 「色の参考になる資料・URL はありますか？」と問う
   - 期待する回答形式は 4 通り:
     - (a) 既存 web サイトの URL (例: `https://zenn.dev/`、`https://tabelog.com/`)
     - (b) PDF / 画像のブランドガイドライン (添付 or パス)
     - (c) コーポレートカラーの hex 直接指定 (例: `#1F2937`, `#F59E0B`)
     - (d) 「特になし、デフォルトで」 → ENOSTECH 標準 (default パレット) で進む
   - (a) (b) を受け取ったら `web_fetch` / `view` で読み込んで主要色を 3〜5 色抽出 → DESIGN.md を組み立て → palette.yml 生成
   - (c) を受け取ったら直接 palette.yml に hex を書き込む
   - (d) なら何もせず default で進む

#### bypass モードでの扱い

`--bypass` でも判定 1〜2 は同じ。判定 3 (ユーザーに聞く) に到達した時のみ、
**default パレットで進む** (ユーザーに聞かない)。bypass は対話最小化が原則。

### R1-6 ヒアリング末尾で `doc.deck_type` を推論する

学習デッキかどうかは、**章末まとめ FRAMING-5 を必須にするかどうかの分水嶺**。
Phase 1 ヒアリング末尾で、読者 × 目的から Claude が推論して `doc.deck_type` に
書き込む (Phase 2 のスキーマ検証で使う)。

#### deck_type の 3 値

| 値 | 当てはまる例 | FRAMING-5 の扱い |
|---|---|---|
| `"learning"` | オニール CANSLIM 解説 / dbt ベスプラ解説 / ランチェスター戦略入門 | **章末必須** （StructureQA-13 で fatal) |
| `"business"` | FactHub 紹介 / Qlavis ピッチ / 受託提案 | 不問 (置きたければ置ける) |
| `"report"`   | 月次成果報告 / 案件状況共有 | 不問 |

#### 判定アルゴリズム (Claude が推論)

1. ユーザーの目的キーワードから引く:
   - 「学習する」「理解する」「習得する」「腹落ちさせる」 → `learning`
   - 「提案する」「説明する」「紹介する」「ピッチする」 → `business`
   - 「報告する」「共有する」「進捗を伝える」 → `report`
2. 読者像から確認:
   - 読者が「学ぶ立場」なら `learning` 寄り
   - 読者が「意思決定者・顧客」なら `business` 寄り
3. 迷ったら `learning` を default にする (FRAMING-5 が出ても害は無い)
4. 推論結果を 1 行でユーザーに伝える: 「目的が『〜を理解する』なので学習デッキ
   (deck_type: learning) として進めます。各章末に持ち帰り (FRAMING-5) を 1 枚ずつ置きます」

#### bypass モードでの扱い

`--bypass` でも上の推論は走らせる。確信が無ければ `learning` で進める。

### R1-7 ヒアリング末尾で `doc.deck_structure` を確定する

R1-6 で `deck_type` が決まったら、続けて **DeckStructureTemplate** を
plan.json の `doc.deck_structure` に書き込む。これで Phase 2 以降の
StructureQA (11 ルール / fatal) が走るようになる。

| `deck_type` | `deck_structure` | 備考 |
|---|---|---|
| `"learning"` | `"learning-deck"` | StructureQA 11 ルール全部走る |

`deck_structure` 未指定 = StructureQA スキップ (warn 出力のみ・build は通る)。

#### plan.json への記述例

```jsonc
{
  "doc": {
    "deck_type": "learning",
    "deck_structure": "learning-deck",
    "deck_structure_version": "1.0",
    "deck_structure_reason": "1 テーマを順番に教える学習デッキ。読者は学びたい人で、判断軸の獲得が読了条件。"
  }
}
```

詳細仕様は `references/deck-structures/learning-deck.md` を参照。

### R1-9 Phase 1 末尾で **必ず questions[] を提示してユーザー承認を取る**

ヒアリング 5 項目が揃ったら、**章立てメモではなく questions[] (5-8 件) + 各 Q の
provisionalDirection** を提示してユーザー承認を取る。これが新規デッキの Phase 1
出口の **絶対条件**。

#### 提示フォーマット (qa-scaffolding.md §1.4 と同じ)

```
このデッキで解消したい疑問・懸念を {N} 個に整理しました。
ご確認ください。追加・削除・書き換えがあれば指示してください。

Q1 [how_to] 電子工作の抵抗ってどう選べばいいの?
   → LED 用途なら、電源電圧と LED の順電圧の差を電流で割って抵抗値を出します。

Q2 [definitional] カラーコードって何?
   → 抵抗器の本体に印刷された 4-5 本の色帯で、抵抗値と誤差を表します。

(...)

これで方向性 OK でしたら Phase 2 に進みます。
他に気になる点・調べたい点があれば教えてください。
```

#### Phase 1 出口で承認するもの (全 6 項目)

1. ✅ 目的・読者・Before/After (R1-1)
2. ✅ ユーザー固有のこだわり / NG 表現 (R1-2)
3. ✅ decks/yyyy-mm-dd_{slug}/ ディレクトリ作成済 (R1-4)
4. ✅ palette.yml 確定 (R1-5)
5. ✅ deck_type / deck_structure 確定 (R1-6 / R1-7)
6. ✅ **questions[] (5-8 件) + provisionalDirection をユーザー承認** (R1-9)

R1-9 が抜けて Phase 2 に進むと、StructureQA-50 fatal で plan.json が組めず手戻り大。
Phase 1 完了の最後の関門。

#### NG パターン (やってはいけない)

- ❌ ユーザーに「どんな疑問がありますか?」と白紙で書かせる
- ❌ questions[] を提示せず、いきなり plan.json (章割) を組み始める
- ❌ provisionalDirection を空にして「Phase 2 で書きます」と濁す

#### opt-out (qa_driven: false で進める時)

R1-8 の opt-out ケースに該当する時のみ、questions[] 提示を skip する。その場合でも
**Phase 1 で章立て・枚数・テンプレを AI から先出しするのは禁止 (R1-11)**。Phase 1 は
ヒアリングだけに留め、章割は Phase 2 で組む。`doc.qa_driven: false` を plan.json に明示。

### R1-11 Phase 1 で章立て・スライド枚数・テンプレ選定を AI から先出ししない

Phase 1 出口で AI が言ってよいのは:

- ✅ questions[] (5-8 件) + provisionalDirection (R1-9)
- ✅ ヒアリング 5 項目の確認 (R1-1 / R1-2)
- ✅ 運用メタ: slug (R1-4) / palette (R1-5) / deck_type (R1-6) / deck_structure (R1-7)

Phase 1 で言ってはいけないもの:

- ❌ 章立て案 (「第1章 〜 / 第2章 〜」「【第N章】〜」など章分けの提示)
- ❌ スライド枚数の見積もり (「想定 28-32 枚」「合計約 26 枚」「ピッチ標準帯 18-25P」など。
  ユーザーが指定していないのに AI が default として出すのは禁止)
- ❌ 具体テンプレ ID の選定 (「LIST-1 / SECTION-2 / FRAMING-5 を使います」など)

#### なぜこのルールが必要か

章立て・枚数・テンプレは、Phase 1.8 (braindump.md) で各 Q への解答が散文として
書き上がった後、Phase 2 で braindump を SSOT に圧縮する過程で **コンテンツの分量から
自然に決まる従属変数**。Phase 1 で AI が default 制約を先出しすると:

1. 書き手 (AI 自身) が無意識に「箱の都合に引っ張られた章分け」をして braindump の純度が下がる
2. ユーザーが指定していない制約を勝手に作ってしまう (osanai 氏が「自然に収まる範囲で
   よしなに」と言っている運用思想に反する)
3. braindump → plan.json の二段階分離 (散文で書き上げてから箱に圧縮する) が損なわれる

#### 例外: ユーザーから明示的な制約があった場合

ユーザーが「10 枚ピッチで」「LT 用に 5 枚」「30 分尺で」のような明示的な数量制約を
発話した場合のみ、Phase 1 でその制約を受け取って Phase 2 に渡す (= AI が default として
作るのではなく、ユーザー指定をそのまま記録する)。

#### bypass モードでの扱い

`--bypass` でも R1-11 は同じ。bypass は対話の確認スキップであって、章立て・枚数・テンプレを
AI が先出しする許可ではない。

#### ユーザーから章立てメモが投げられた場合の返し方

```
頂いた章立てメモは Phase 2 で braindump.md と統合して章割を組む時の素材として
使わせてください。Phase 1 は questions[] (疑問・懸念リスト) の確定が出口なので、
まず Q を提示します。
```

…のように、メモを受け取った旨だけ言及して questions[] 提示 (R1-9) に進む。
リファイン案 (章数 / 枚数 / テンプレ) は Phase 1 では出さない。

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `references/_common/workflow.md` | Phase 1 の詳細手順（中核ドキュメント） |
| `references/_common/bypass-mode.md` | `--bypass` 時はヒアリング 1 回 + 必須 4 項目で完結 |
| `references/phase1-hearing/qa-scaffolding.md` | QA 駆動モードの叩き台 Q 提示・kind 配分・provisionalDirection の書き方 |
| `references/phase1-hearing/braindump.md` | Phase 1.8 questions-driven braindump の仕様 |

## このフェーズの NG

- 抽象的な「〜が多い」「〜になりがち」表現で済ませる
- ユーザーから具体ネタを引き出さずに Phase 2 へ進む
- 公開情報の裏取りなしに数値を載せる
- **questions[] を提示せず、章立てメモだけで Phase 1 を終える** (R1-9 違反)
- **AI から章立て案・スライド枚数・具体テンプレ ID (LIST-1 等) を Phase 1 で先出しする** (R1-11 違反)
