# デッキ生成の思考フロー — Phase 0〜4

> このドキュメントは、ENOSTECH スキルの **中核** です。
> デッキを作る依頼を受けたら、必ずこのフェーズを順に踏みます。いきなりコード生成に突入しないこと。

> ⚡ **例外**: プロンプトに `--bypass` が含まれていたら、フェーズの**処理は全工程そのまま実行**しつつ、
> **「ユーザー承認待ち」ステップだけを省略**して最終成果物まで一気通貫で生成するモードに切り替わります。
> Phase 0 のモード選択は **強制的にテンプレベース (`deck_mode: 'template'`) 固定** になり、Phase 1.5 は skip。
> 詳細は `references/_common/bypass-mode.md`。HTML 指示書の生成や M? VIOLATION チェックは bypass でも実施されます。

---

## Phase 0 — モード選択

### 目的

新規デッキの立ち上げ時、AI は **必ず最初にモード選択を提示** する。Phase 1 ヒアリングに入る前の必須ステップ。

### 提示する 2 択

```
「今回はどちらのモードで進めますか?」

  ① テンプレベース(構造化・推奨)
     → 既存 deckStructure (learning-deck / news-summary / proposal-deck / case-study-deck) から選択
     → qa_driven default ON、Phase 1 ヒアリング → Phase 2 plan.html → Phase 3 build → Phase 4 QA の固定フロー
     → 短時間で安定品質、定番ジャンル向け

  ② フリーベース(反復型・新)
     → Phase 1 ヒアリング後に Phase 1.5「Sheets 連携」を経由
     → plan.json を Google Sheets に書き出し、ユーザーが gsheet 上で章立て・スライド構成を反復編集
     → 「これで進めて」で plan.json に取り込み → Phase 3 build
     → テンプレ縛りなし (80 種を自由組み合わせ)、複雑/独自テーマ向け
```

### 判断基準 (どちらにすべきか迷ったら)

| 観点 | テンプレベース | フリーベース |
|---|---|---|
| 速度・安定性 | ◎ 数十分で 25-38P 出る | ○ gsheet 反復で時間かかるが構造納得度高い |
| 定番ジャンル | ◎ 学習/提案/ニュース/事例 | ○ |
| 独自フレーム | △ deckStructure 内に収める必要 | ◎ どんな構成でも組める |
| 章立て検討の余地 | △ Phase 2 一発勝負 | ◎ gsheet で何度でも見直せる |
| AI 承認フロー | plan.html で 1 回 | gsheet 編集 → 「これで進めて」で確定 |
| 既存デッキ再ビルド | ◎ そのまま動く | △ deck_mode='free' で書き換えが必要 |

**迷ったらテンプレベース** を推奨。フリーベースは「テンプレ枠に収まらないと感じた時」「構成検討に時間をかけたい時」に意識的に選ぶ。

### `doc.deck_mode` の意味

- `deck_mode: 'template'` (デフォルト) — テンプレベース。Phase 1.5 は skip。
- `deck_mode: 'free'` — フリーベース。Phase 1.5「Sheets 連携」が必須。
- **未指定時** — 暗黙 `'template'` として扱う。

### `--bypass` 時の挙動

`--bypass` 指定時は Phase 0 を skip し **強制的にテンプレベース固定**。新規 deck_mode='free' を選ばせる
ループは bypass モードでは発生しない。

### Phase 0 を経たあとの分岐

```
Phase 0 (モード選択)
   ├─ ① テンプレベース → Phase 1 ヒアリング → Phase 2 → Phase 3 → Phase 4
   └─ ② フリーベース  → Phase 1 ヒアリング → Phase 1.5 (Sheets 連携) → Phase 2 → Phase 3 → Phase 4
```

> ⚡ **ツールコール削減（全モード共通）**: Phase 3・4 に入る前に
> `references/_common/parallel-execution.md` を必ず読むこと。
> 参照ファイルの一括読み込み・コンタクトシート方式 QA により、
> 15 枚デッキで約 23 ツールコールを削減できる。

> 🏗 **作業ホーム**: decks/{slug}/ は Phase 1 末尾で mkdir。Phase 2-4 はこのディレクトリ内で完結する。
> - plan.html は `decks/{slug}/plan.html` にファイル直書き
> - draft.pptx は `decks/{slug}/draft/draft.pptx` に出力、ユーザーが直接開いて確認
> - Phase 4 承認後に `build-deck-package.js` が `資料.pptx` に昇格

---

## 全体像

```
┌──────────────────┐
│ Phase 1          │
│ ヒアリング        │  読者・目的・材料を集める
│ + decks 先切り    │  必要に応じて web_search で裏取り
│                  │  ───── ヒアリング末尾 ─────
│                  │  slug を即決して decks/yyyy-mm-dd_{slug}/ を mkdir
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Phase 1.8 ⭐     │  questions[] への解答集を散文で書く (default ON)
│ braindump 執筆   │  → decks/{slug}/braindump.md
│                  │  → writing-qa.py --mode braindump --strict で fatal ガード
│                  │  → ユーザー承認後 Phase 2 へ
│                  │  doc.skip_braindump: true で opt-out 可
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Phase 2          │
│ 情報設計          │  ストーリーライン + 各スライド設計
│                  │  → HTML 指示書を decks/{slug}/plan.html にファイル直書き
│                  │  → ユーザーはブラウザで plan.html を開いて確認
│                  │  → 明示承認を待つ（human in the loop）
└────────┬─────────┘
         ↓ （承認後）
┌──────────────────┐
│ Phase 3          │
│ デッキ構築        │  承認済み指示書を元に PPTX 生成
│                  │  → decks/{slug}/draft/draft.pptx を出力
│                  │  → 生成スクリプトはユーザーが再ビルドに使うため保管
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Phase 4          │
│ ユーザー QA      │  visual-qa.md のチェックリスト実施
│ + decks/ 最終整形 │  draft.pptx をユーザーが直接開いて確認
│                  │  Claude 側もコンタクトシート PNG で VQA 自己目視
│                  │  修正があれば Phase 3 に戻る
│                  │  ───── ユーザーが「OK」と言ったら ─────
│                  │  build-deck-package.js を機械実行（確認なし）:
│                  │    decks/yyyy-mm-dd_{slug}/  ← 既に存在
│                  │    ├── 資料.pptx              (← draft/draft.pptx を昇格、SSOT)
│                  │    ├── レポート.html          (html_supplement.enabled=true が
│                  │    │                            1 件以上あれば自動生成。0 件ならスキップ)
│                  │    ├── plan.html              (Phase 2 で配置済み、そのまま)
│                  │    ├── 生成メモ.md            (speaker notes 4 行構造を集約)
│                  │    └── preview/               (slide-NN.png + contact-sheet.png)
│                  │  詳細は references/phase4-qa/decks-packaging.md
└──────────────────┘
```

> **重要**: PPTX が SSOT (single source of truth)。レポート.html は **PPTX とセットで読む補足**
> であって、HTML 単独で完結する設計ではない。Phase 2 で各スライドに `html_supplement` を仕込んでおき、
> 補足が要るスライドだけ `enabled: true` にする。`enabled: true` が 1 件以上なら build-deck-package.js
> が build-html-report.js を [5/5] ステップで自動呼び出しする。

**絶対に守ること**:
- **Phase 0 でモード選択を必ず提示**。テンプレベース ① / フリーベース ② のいずれかを **必ず明示確認**。`--bypass` 時のみ自動的に ① 固定
- Phase 1 の最後に **必ず decks/yyyy-mm-dd_{slug}/ を作成**。slug は Claude が即決、後で rename 可と注記
- **フリーベース時は Phase 1.5「Sheets 連携」を必ず通す**。plan.json 初稿生成 → gsheet 書き出し → URL を共有 → ユーザーの「これで進めて」承認待ち → 取り込み → Phase 2 へ
- **Phase 1.8 で `decks/{slug}/braindump.md` を書き上げる**（R1-10。`skip_braindump: true` で opt-out のみ）。questions[] と 1:1 の解答集を散文で書き、`writing-qa.py --mode braindump --strict` で fatal ガード
- **⭐ Phase 1.8 の各 Q 章 frontmatter に `> visual: required | optional | none` を必ず書く**（WritingQA-29 fatal）。図解不要なら明示的に `none` を書く。「飛ばされた」と「不要判断」を区別するため
- **⭐ Phase 1.8 で `visual: required` の Q が 1 件以上ある時は `braindump-illust.py` を必ず実行する**（WritingQA-30 fatal）。実行ログ `braindump_assets/.illust-run.json` の有無で機械検出
- **⭐ Phase 2 の Step 2-1 で `braindump-to-plan.py` を必ず実行する**（SchemaQA-08 fatal）。手書きで plan.json を組まない。skip_braindump=true 時のみ skip 可
- Phase 2 でユーザーの明示的な承認を得るまで、Phase 3 には進まない
- Phase 2 の plan.html は `decks/{slug}/plan.html` にファイル直書き、ユーザーがブラウザで開く前提
- **Phase 2 で全スライドに対して `html_supplement` を判定する**。補足要らないなら `enabled: false`、要るなら `enabled: true` + 中身を書く
- Phase 4 のユーザー目視確認を飛ばして decks/ 最終整形を実行しない
- Phase 4 のユーザー承認時、`build-deck-package.js` は **確認なしで機械実行** する
- **資料.pptx への昇格は Phase 4 承認後のみ**。承認前は draft/draft.pptx に留める
- **エディトリアルシートに配布形態の指定があっても無視する**（メインルート 1 本固定）

---

## Phase 1 — ヒアリング

### 目的

資料の **方向性** を決めるために必要な情報を集める。コード生成に必要なすべての材料が揃っていなければ、必ず質問で補う。

### 確認する 5 項目

1. **デッキの目的**: 何のために作るのか?（提案・社内共有・調達・採用・研修 等）
2. **想定読者**: 誰が読むのか?（役職・業界知識レベル・事前情報）
3. **読者の Before**: 読者は読む前、何を思っている?
4. **読者の After**: 読者は読んだ後、どう変わっていてほしい?
5. **ページ数の目安**: 何ページ程度で構成するか?

### 確認する追加情報（トピックに応じて）

- 制約: 時間制限・NDA・使える色や画像・触れてはいけない情報
- 既存資料: 流用したいパーツや避けたい表現
- データ・事実: 数値・統計・引用元 → **ソースの URL も併せて確認**
- 口調: フォーマル / カジュアル / 技術的 / ビジネス的

### ⚠️ 図解のテイストは聞かない

図解の**見た目・テイスト**は `scripts/diagram-patterns.js` の DIAG-02〜19 (18 種) で
canonical に定義されている (整った roundRect / oval / 矩形・線・矢印・三角形のみで構成、
雲・有機形・キャラクター禁止)。Phase 1 ヒアリングで
**「図解のテイストはどうしますか」「イラストのスタイルは」等を聞いてはいけない**。

ヒアリングで聞くのは「どこに図解を入れるか（WHERE）」「何を伝える図解か（WHAT）」
だけ。HOW（見た目）はカタログ固定で進める。

詳細は `references/_common/diagram-patterns.md` を参照。図解グローバルルール G1-G4 は
`references/phase3-build/README.md` §R3-4 を参照。

### ヒアリング中の裏取り（重要）

ユーザーから得た主張で、事実確認が必要なものは **その場で** web_search / web_fetch を使う：

- 統計数値（「X 社の売上は Y」等）
- ライブラリ・プロダクトの最新情報
- 競合他社の状況
- 業界トレンド

**「後でまとめて確認」ではなく、その場で裏取りしておく** ことで Phase 2 がスムーズに進む。
裏取り結果は記録しておき、Phase 2 の参照リンク一覧に反映する。

### ⚠️ 章立てメモを受け取ったら：Phase 1 では受け取るだけ (R1-11)

ユーザーが「こんな内容を伝えたい」と章立てメモ (Markdown outline) を投げてくる
ことがある。**Phase 1 では受け取って保管するだけ**。AI 側からのリファイン案
（章数・スライド枚数・テンプレ選定）の提示は **Phase 1 では禁止** (R1-11)。

なぜか — 章立て・枚数・テンプレ選定は、Phase 1.8 (braindump.md) で各 Q への
解答を散文として書き上げた後、Phase 2 で braindump を SSOT に圧縮する過程で
**コンテンツの分量から自然に決まる従属変数**だから。Phase 1 で AI が「3-5 章 × 2-4P」
「合計約 26 枚」のような default 制約や具体テンプレ (LIST-1 / SECTION-2 / FRAMING-5
等) を先出しすると、書き手が無意識に「箱の都合に引っ張られた章分け」をしてしまい、
braindump の純度が下がる。

#### Phase 1 でのユーザーへの返し方

```
頂いた章立てメモは Phase 2 で braindump.md と統合して章割を組む時の素材として
使わせてください。Phase 1 は questions[] (疑問・懸念リスト) の確定が出口なので、
まず Q を提示します。
```

…のように、メモを受け取った旨だけ言及して questions[] 提示 (R1-9) に進む。
リファイン案 (章数 / 枚数 / テンプレ) は出さない。

#### Phase 2 以降での扱い

章割を組むのは **Phase 2** (plan.json 構築フェーズ)。その時点で braindump.md が
SSOT として手元にあるので、章立てメモはそれと統合する素材として使う。Phase 2 で
「コンテンツが自然に何枚に収まるか」を逆算する形で章数・枚数を決める。詳細は
`references/phase2-information-design/README.md` を参照。

#### 例外: ユーザーから明示的な制約があった場合

ユーザーが「10 枚ピッチで」「LT 用に 5 枚」「30 分尺で」のような明示的な制約を
発話した場合のみ、その制約を Phase 1 で受け取って Phase 2 に渡す (= AI が default
として作るのではなく、ユーザー指定をそのまま記録する)。

#### バイパスモード時の扱い

`--bypass` でも R1-11 は同じ。Phase 1 では章立て・枚数・テンプレを先出ししない。
章立てメモがあれば「受け取りました、Phase 2 で統合します」とだけ返して
questions[] 提示に進む。

---

### ⭐ Phase 1 末尾 — questions[] の提示と承認

> **qa_driven_default を全 deckStructure で true 化した結果、
> 新規デッキの Phase 1 末尾で questions[] を提示することが事実上の必須**。
> Phase 1 出口の承認対象は **questions[] (疑問・懸念リスト) + 暫定回答方向性** のみ。
> R1-11 により、**Phase 1 で章立て・スライド枚数・テンプレ選定を AI から
> 先出しすることは禁止**。

#### なぜ questions[] が中心になるか

ヒアリングで集めた情報を「章立てメモ」に落とすのは設計者目線の作業で、ユーザーは
書きにくい。ユーザーの頭にあるのは「**こういうことが知りたい / ここが不安**」という
**疑問のリスト**。これを Phase 1 で確定させると:

1. ユーザーは「自分の疑問」を反応するだけで OK (白紙で章立てを書かない)
2. AI は各疑問に答えるための材料を組み立てればよい (= 章立ては questions から派生)
3. 「N 個の疑問が解消される」が完了条件 (StructureQA で機械検証可能)

#### Phase 1 末尾の流れ — 5 ステップ (qa-scaffolding.md 準拠)

詳細手順は `references/phase1-hearing/qa-scaffolding.md` を必読。要点:

1. **テーマ・読者の確認** (上記の 5 項目 + 追加情報)
2. **AI が叩き台 Q を 5-8 件提示** ⭐ ユーザーに白紙で書かせない
   - kind enum 6 種 (definitional / comparative / decisional / how_to / risk / other) を
     配分よく散らす
   - text は 10-80 字、読者が実際に発する言葉で
3. **各 Q に provisionalDirection (1-2 文) を添える** — AI 内部知識ベースで先出し OK
   (Phase 2 入口で web_search で精緻化)
4. **ユーザーに提示 → 反応 (追加 / 削除 / 書き換え)**
5. **承認後 plan.json の準備に進む** (questions[] 確定 / shortSummary は Phase 2 で確定)

#### 提示フォーマット (Phase 1 出口)

```
このデッキで解消したい疑問・懸念を {N} 個に整理しました。
ご確認ください。追加・削除・書き換えがあれば指示してください。

Q1 [how_to] 電子工作の抵抗ってどう選べばいいの?
   → LED 用途なら、電源電圧と LED の順電圧の差を電流で割って抵抗値を出します。
     一般用途なら 220Ω で十分なケースが多いです。

Q2 [definitional] カラーコードって何?
   → 抵抗器の本体に印刷された 4-5 本の色帯で、抵抗値と誤差を表します。

Q3 [comparative] 直列と並列で抵抗値はどう変わる?
   → 直列は和、並列は逆数の和の逆数で、用途で使い分けます。

(...)

これで方向性 OK でしたら Phase 2 に進みます。
他に気になる点・調べたい点があれば教えてください。
```

#### NG パターン (やってはいけない)

- 章立てメモを書き出して「方向性 OK?」と聞く
- ユーザーに「どんな疑問がありますか?」と白紙で書かせる
- questions[] を提示せず、いきなり plan.json (章割) を組み始める
- provisionalDirection を空にして「Phase 2 で書きます」と濁す
- ⭐ **AI から章立て案 (第N章 ...) や想定枚数 (約 N 枚 / N-N P) や具体テンプレ
  (LIST-1 / SECTION-2 / FRAMING-5 等) を先出しする** (R1-11 違反)

#### opt-out ケース (qa_driven=false で進めて良い時)

以下の時は questions[] 提示をスキップし、AI 内部で章割を組んで Phase 2 へ進む:

- ユーザーが明示的に「QA 駆動じゃなくていい」と言う
- 出来事報告 (news-summary) — 読者が事前に Q を持っていない
- 事例カタログ (case-study-deck) — 比較軸ベースで読まれる
- ユーザーから具体的に「こういう章立てで」と章割が完璧に渡された

なお opt-out した場合でも **Phase 1 で章立て・枚数・テンプレを AI から先出ししない
ルール (R1-11) は変わらない**。AI 内部で章割を組むのは Phase 2 (plan.json 構築) に
入ってから。Phase 1 はあくまで「ヒアリング + questions[] 確認 (or skip)」までに留める。

opt-out した場合は plan.json で `doc.qa_driven: false` を明示する。

#### バイパスモード時の扱い

`--bypass` でも questions[] 提示は省略しない (1 回だけ提示して即 Phase 2 へ進む形)。
ユーザーの承認を待たない違いだけ。questions[] が無いまま Phase 2 に進むと
StructureQA-50 fatal で蹴られるため、bypass でも提示は必須。

---

### ヒアリング完了の判断

以下すべてに答えられる状態になったら Phase 2 へ：

- [ ] 目的が 1 文で言える
- [ ] 読者像（役職・知識レベル）がイメージできる
- [ ] Before → After の変化が具体的に言える
- [ ] 使える材料（データ・事例・画像）が出揃っている
- [ ] 主張となる事実のソースが確保できている
- [ ] ⭐ **questions[] を 5-8 件提示し、provisionalDirection 込みでユーザー承認を得た**（R1-9。qa_driven=false で opt-out した場合のみ skip）
- [ ] ⭐ **Phase 1 で章立て・スライド枚数・テンプレ選定を AI から先出ししなかった**（R1-11。章立てメモが投げられても受け取るだけ。リファイン案は Phase 2 で braindump を SSOT に組む）
- [ ] **decks/yyyy-mm-dd_{slug}/ を mkdir した（R1-4）。Phase 2-4 はこのディレクトリを作業ホームとして使う**
- [ ] **カラースキーマを 3 段階で判定し、`decks/{slug}/palette.yml` が確定している（R1-5）。判定: ① 既存 palette.yml → ② project root の DESIGN.md → ③ ユーザーに参考資料/URL を聞く**
- [ ] ⭐ **Phase 1.8 で `decks/{slug}/braindump.md` を書き上げ、`writing-qa.py --mode braindump --strict` が exit 0、ユーザー承認済み**（R1-10。`doc.skip_braindump: true` で opt-out 可能）
- [ ] ⭐ **Phase 1.8 の各 Q 章に `> visual: required | optional | none` を書いた**（WritingQA-29 fatal）
- [ ] ⭐ **Phase 1.8 の Step 1.8-3 で `visual: required` の Q がある時 `braindump-illust.py` を実行し `braindump_assets/.illust-run.json` を生成した**（WritingQA-30 fatal）

### Step 1-X: decks/ ディレクトリの先切り（必須）

ヒアリングが揃ったら、Phase 2 に入る前に **必ず `decks/yyyy-mm-dd_{slug}/` を作成** する。
これは Phase 4 末尾で初めて作るのではなく、最初から作業ホームにする思想。

```bash
DATE=$(date +%Y-%m-%d)
SLUG=facthub-intro          # Claude が題材から即決（後で rename 可）
mkdir -p "<project_root>/decks/${DATE}_${SLUG}/draft"
```

**slug 決定ルール**:
- Claude が題材・主題から即決する（hyphen-case の英数字 / 短く / 重複回避）
- ユーザー確認は不要、ただし提示時に「`decks/2026-04-29_facthub-intro/` で進めます。気に入らなければ後でディレクトリ rename してください」と一言添える
- 題材が後から変わって slug が陳腐化したら、ユーザーから rename 指示があったタイミングで `mv` で対応

### Step 1-Y: カラースキーマの 3 段階判定（R1-5）

`decks/{slug}/` を mkdir したら、**Phase 2 に入る前に必ずカラースキーマを判定**する。
詳細手順は `references/phase1-hearing/README.md` の R1-5。要点:

```bash
# 判定 1: 既存 palette.yml ?
[ -f "decks/${DATE}_${SLUG}/palette.yml" ] && echo "→ それを使う、終わり"

# 判定 2: project root に DESIGN.md ?
[ -f "<project_root>/DESIGN.md" ] && echo "→ build-deck.js 1 回叩いて palette.yml 自動生成"

# 判定 3: 上記両方なし → AskUserQuestion で「色の参考になる資料/URL は？」
```

**ポイント**: 既存 palette.yml > DESIGN.md > ユーザーヒアリング、の優先順位。
ユーザーに聞くのは最後の手段で、聞いた時の選択肢は (a) URL / (b) ガイド / (c) hex / (d) default の 4 つ。
bypass モードでは判定 3 に到達したら問答無用で default パレットで進む。

**ディレクトリ構造**:

```
decks/yyyy-mm-dd_{slug}/
├── plan.html        ← Phase 2 で書き出す HTML 指示書
├── plan.json        ← Phase 2 の指示書 JSON（render-deck-instruction.py の入力）
├── draft/
│   └── draft.pptx   ← Phase 3 の中間成果物
└── （Phase 4 承認後に build-deck-package.js が以下を整える）
    ├── 資料.pptx    ← draft/draft.pptx から昇格
    ├── 生成メモ.md
    └── preview/
        ├── slide-01.png 〜 slide-NN.png
        └── contact-sheet.png
```

### ヒアリングの例

> ユーザー: 「FactHub の紹介資料を作ってほしい」
>
> Claude: （情報不足なので質問）
> 「いくつか確認させてください:
> 1. 誰に見せる資料ですか?（社内共有 / 見込み顧客への提案 / 投資家向け等）
> 2. 何ページくらいを想定していますか?
> 3. 読み手が 読む前 → 読んだ後 にどう変わっていてほしいですか?
> 4. 引用したい事例やデータはありますか?（あればソースもお知らせください）」
>
> ユーザー: 「データ活用に課題感ある企業の経営層向け。10〜15 ページ。
> 『FactHub ってよく分からん』→『導入検討してみよう』に持っていきたい。
> IPA の DX 動向調査でデータ人材不足が 70% ってやつを使いたい」
>
> Claude: 「ありがとうございます。IPA の調査を裏取りします」
>   → web_search: "IPA DX 動向 2024 データサイエンティスト 不足"
>   → 該当の調査レポートを確認、ソース URL を控えておく
> Claude: 「IPA の DX 動向 2024 で、データサイエンティスト『大幅に不足』が 40%、
>         『やや不足』+『大幅に不足』の合計で約 70% を確認しました。
>          これで Phase 2 に進みます」

---

## Phase 1.5 — Sheets 連携 (フリーベース時のみ)

### 目的

Phase 1 で集めた目的・読者・章立てメモ・questions[] を **Google Sheets に書き出して**、
ユーザーが gsheet 上で章立て・スライド構成を **納得いくまで反復編集** する場を提供する。

### 入口条件 (このフェーズに入るのは)

- `doc.deck_mode === 'free'` のとき **のみ**。
- テンプレベース (`'template'` / 未指定 / `--bypass`) では **完全に skip**。

### 流れ

```
Phase 1 末尾  ──→ plan.json 初稿を生成 (header / body.chapters / footer / questions / references)
                   │
                   ├─ scripts/render/plan-to-gsheet.js を実行
                   │     → 6 シート (doc-meta / questions / chapters / slides / references / notes) 構造の
                   │       Spreadsheet を新規作成
                   │     → My Drive/ENOSTECH/plan-gsheet/<deck-slug>/ 配下に配置 (folder auto-create)
                   │     → 完了後、URL を plan.json の doc.gsheet_url に保存 + stdout に出力
                   ↓
ユーザーが gsheet 上で編集 ─────────────────────────────────
   - 章立てを追加・削除・並べ替え
   - questions[] の追加・削除・kind プルダウン選択
   - slides の template_id プルダウン (80 種から自由選択) で構成変更
   - references の追加 / URL 修正
   - notes シートに AI 向け追加指示を自由記入
                   ↓
ユーザー: 「これで進めて」
                   ↓
   scripts/render/gsheet-to-plan.js を実行
     → plan.json は plan.json.bak.<timestamp> にバックアップ
     → 6 シートの内容を plan.json にマージ (深いフィールドは温存・破壊しない)
     → 不整合は warning を stderr に出力 (fatal にしない)
     → 差分サマリ (added / removed / edited を docMeta / questions / chapters / slides / references で集計) を表示
                   ↓
Phase 2 (情報設計) へ進む
```

### plan.html (フリーベース時) の表示

Phase 1.5 進行中は plan.html の冒頭に **「Sheets 編集中」ステータスバナー** を出し、
「Sheet を開く」リンクを設置する (gsheet 編集経路への明示的なエントリポイント)。

### 6 シート構成

| シート名 | 役割 | 主な列 | 編集の重み |
|---|---|---|---|
| `doc-meta` | デッキ全体メタ (key/value 形式) | key, value, description | ◎ deck_mode / deck_structure / qa_driven 等 |
| `questions` | qa_driven 時の questions[] | Q#, text, kind, provisionalDirection, shortSummary, refIndex, sectionIndex | ○ kind プルダウン (6 種) |
| `chapters` | 章立て | section_id, role, title, overview, narration_anchor, source_questions | ◎ 章数・順序を gsheet で動かす |
| `slides` | 全スライド flat | slide_id, section_id, order, template_id, role, title, subtitle, answers_questions, content_summary, speaker_notes_hint | ◎ template_id プルダウン (80 種) |
| `references` | 参考文献 | ref_id, title, author, url, type, year | ○ |
| `notes` | フリーフォームメモ | (1 列) | △ plan.json には反映されない (AI 向けメモ専用) |

### round-trip の安全性 (重要)

**シートに出ていない深いフィールド** (`cards[]` / `charts` / `diagrams` / `scenes` / `html_supplement`
/ `points[]` / `rows[]` 等) は **plan.json 側を温存** する。シート編集の影響範囲は明示された
浅い列に限定され、Phase 2 以降で AI が膨らませた中身を勝手に消すことはない。

### コマンド

```bash
# 書き出し (Phase 1 末尾で AI が実行)
node scripts/render/plan-to-gsheet.js \
    --plan decks/<slug>/plan.json \
    --title "[plan-collab] <slug>"
# → spreadsheetUrl を stdout に出力、plan.json の doc.gsheet_url に保存

# 取り込み (ユーザー「これで進めて」で AI が実行)
node scripts/render/gsheet-to-plan.js \
    --plan decks/<slug>/plan.json
# (URL は doc.gsheet_url から自動取得)

# オフライン smoke test (gws 認証が無い環境用)
node scripts/render/plan-to-gsheet.js --plan ... --dry-run --snapshot-out tmp/snap.json
node scripts/render/gsheet-to-plan.js --plan ... --from-snapshot tmp/snap-edited.json
```

### 落とし穴と対処

- **シートを開いたまま import すると競合**: ユーザーには「これで進めて」コマンド時にシートを
  保存して閉じてから言うように促す。
- **template_id プルダウンに無い ID を入力された**: warning を stderr に出すのみ、import 自体は通す。
  Phase 2 の Zod 検査で fatal になるので最終的には防げる。
- **questions の Q# が重複**: import 時に warning + 後勝ちで上書き。plan.json 側で重複は破棄される。
- **章を gsheet で削除したのに slides にその section_id の行が残っている**: 該当 slides は
  warning + 章無し扱いで握りつぶす。Phase 2 の StructureQA で arrears として再検出される。

---

## Phase 1.8 — questions-driven braindump 執筆 (default ON)

### 目的

Phase 1 で承認された **questions[] (5-8 件)** に対する **解答集** を、
散文 (読み物) として `decks/{slug}/braindump.md` に書き下ろす。出来上がった
braindump.md は Phase 2 (plan.json 構築) の **SSOT (Single Source of Truth)**
として使われる。

### なぜこのフェーズが要るのか

plan.json を直接組むと、構造化された「箱」(各 cards[i].body は 80 字 / title は 60 字 / subtitle は
120-200 字) に Claude が断片として文章を書くため、章をまたぐ論理の流れが断絶し、リサーチ内容のうち
箱に入る分だけ抜粋され、翻訳調・体言止め・薄サブコピーが生まれやすい。

Phase 1.8 を挟むことで、**先に「読み物として完成した解答集」を書き、
そこから plan.json に圧縮する** 二段階に分ける。表現の磨き込みは braindump で
完結し、plan.json は構造の最適化に専念できる。

### 入口条件 (このフェーズに入るのは)

- **default ON**。新規デッキ生成時は必ず通す。
- `doc.skip_braindump: true` で Phase 1.8 を skip 可能 (short business deck /
  10P 以下のピッチ / 1 ページ物の社内共有 / `qa_driven: false` のケース)。
- `--bypass` でも Phase 1.8 は通す (ユーザー承認待ちは省略)。

### 流れ (5 つの小ステップ)

```
Phase 1 末尾 (questions[] 承認)
   │
   ├─ Step 1.8-1: braindump.md スケルトンを作成 + 各 Q 章 frontmatter を埋める
   │     - decks/{slug}/braindump.md を新規作成
   │     - 各 Q 章先頭の frontmatter に必ず以下を書く:
   │         > kind: how_to | definitional | comparative | ...
   │         > visual: required | optional | none      ← ★ 必須 (WritingQA-29 fatal)
   │         > visual_kind: tier-table | before-after | flow | matrix | ...
   │         > visual_caption: {見出し}
   │     - 「飛ばされた」と「不要判断」を区別するため、図解不要なら必ず `visual: none` を書く
   ↓
   ├─ Step 1.8-2: 各 Q 章の本文を散文で書く
   │     - Intro: 疑問・懸念サマリー (Q ごとに 1 行答え 40-80 字)
   │     - Q1 章: 散文 (背景・根拠・具体例・出典)
   │     - Q2 章: 同上
   │     - 参考文献 [1] [2] [3]
   │     - 補足: 序盤・締め固定枠の素材 (任意)
   │     - 本文中の固有名詞・数値段落には [N] を必ず添付 (WritingQA-25/26)
   ↓
   ├─ Step 1.8-3: braindump-illust.py を実行 (visual: required の Q が 1 件以上ある時)
   │     python3 scripts/braindump-illust.py -i decks/{slug}/braindump.md
   │     → braindump_assets/Q?.svg + Q?.png を生成
   │     → braindump_assets/.illust-run.json に実行ログを残す (WritingQA-30 で必須化)
   │     → md 末尾に <!-- BRAINDUMP_ILLUST_AUTO --> ブロックで <img> を埋め込み
   │     ※ visual: required の Q が 0 件 (= 全て optional / none) ならこの Step は skip
   ↓
   ├─ Step 1.8-4: writing-qa.py で fatal ガード
   │     python3 scripts/writing-qa.py \
   │         --input decks/{slug}/braindump.md \
   │         --mode braindump \
   │         --questions decks/{slug}/plan.json \
   │         --strict
   │     → exit 0 になるまで直す。WritingQA-29 (visual 行必須) /
   │       WritingQA-30 (illust 実行ログ必須) もここで蹴る
   ↓
   ├─ Step 1.8-5: ユーザーに braindump.md を提示してレビュー
   │     → 流し読みで OK。直したい箇所があれば書き直して Step 1.8-4 を再実行
   ↓
ユーザー: 「OK、Phase 2 へ」
   ↓
Phase 2 (plan.json 圧縮) へ進む
```

### braindump.md スキーマ (詳細は references/phase1-hearing/braindump.md)

```markdown
# {デッキタイトル}

> deck_slug: 2026-05-06_xxx-yyy
> deck_type: learning
> updated: 2026-05-06

## Intro: 疑問・懸念サマリー

このデッキは以下の {N} つの疑問に答えます。

- **Q1** [how_to] {Q1.text} → {一文サマリ 40-80字}
- **Q2** [definitional] {Q2.text} → {一文サマリ}
- ...

## Q1: {Q1.text}

> kind: how_to
> 関連 references: [1], [3]
> 想定スライド: SECTION-2 → SECSUMMARY-1 → LIST-1 → LIST-3 → FRAMING-5

{冒頭 1-2 段落で結論を端的に述べる}

{2-4 段落の本論。背景・根拠・具体例・出典 (1) を散文で展開}

## Q2: ...

(各 Q に対して同じ構造 / questions[] と 1:1 対応)

## 参考文献

[1] {タイトル} — {URL}
[2] ...
```

### Intro サマリーは QA-INDEX スライドに直結する

braindump.md の Intro サマリー (Q ごとの 1 行答え) は、Phase 2 で
**QA-INDEX template (序盤 5 枚目固定枠の早見表スライド)** の
cells に直接圧縮される。各 Q の矢印先 (→ ...) を 40-80 字で書くと、
そのまま QA-INDEX の「答え」列に転写される設計。Intro サマリーの精度が
スライド品質に直結するので、ここを先に固める。

### 機械検証 (writing-qa.py --mode braindump)

Phase 1.8 で fatal 検出するルール:

- **WritingQA-21**: 体言止め文末が連続 (5 文中 3 件以上) — fatal
- **WritingQA-22**: 段落 800 字超 — warn
- **WritingQA-24**: Intro Q 件数と Q 章件数の不一致 / 矢印先の空欄 — fatal
- 既存ルール: WritingQA-02 翻訳調 / 03 ハイプ語 / 04 助詞 4 連 (fatal)
- 既存ルール: WritingQA-09 二重否定 / 11 横文字 / 12 箱型比喩 (warn)

詳細は `references/qa/writing-qa.md` の WritingQA-21〜24 と
`references/phase1-hearing/braindump.md` の R1-10。

### Phase 2 (plan.json 圧縮) への引き継ぎ

Phase 2 では braindump.md を **読み物として** 参照しながら plan.json を組む。
具体的な圧縮ルール:

| braindump 上の素材 | Phase 2 で何になるか |
|---|---|
| Intro サマリー (Q ごとの矢印先) | QA-INDEX スライドの cells |
| Q 章の冒頭 1-2 段落 | 該当章 SECSUMMARY-1 / LIST-1 の subtitle (120-200 字に圧縮) |
| Q 章の本論 (2-4 段落) | 章内の cards[] / bullets[] / DATA-2 の素材 |
| Q 章末の具体アクション | FRAMING-5 章末まとめの items |
| 補足: 制作背景 | FRAMING-1 |
| 補足: Before/After | FRAMING-2 |
| 補足: お土産 | FRAMING-4 |
| 参考文献 [1] [2] | doc.references[] |

Phase 2 で plan.json を組んだ後の writing-qa は **既存ルール (WritingQA-01〜19)
が走る**。長文向けルール (WritingQA-21〜24) は Phase 1.8 で済んでいる前提で
plan.json には適用されない。

### plan.html の表示

Phase 1.8 が完了している場合、plan.html の冒頭に「📝 braindump 起点モード」
バッジを出し、`braindump.md を開く` リンクを設置する (Phase 2 でユーザーが
原文に戻れる経路を確保)。

### opt-out したい時

```jsonc
{
  "doc": {
    "skip_braindump": true,
    "skip_braindump_reason": "短い社内共有用ピッチ (10P以内)"
  }
}
```

`skip_braindump: true` の時は Phase 1.8 を skip し、Phase 2 で従来通り
plan.json を直接組む。writing-qa --mode braindump は呼ばれない。

---

## Phase 2 — 情報設計 + draft 自動ビルド

> Phase 2 で `run-qa.py phase2` が draft.pptx の自動ビルドと
> PNG 化、plan.html への実プレビュー埋め込みまでを 1 コマンドで完結させる。
> Phase 3 は「draft → 資料.pptx 昇格」だけの軽い段階に簡素化。
>
> 実行フロー:
> ```
> Step 1/4 — 機械検証 (M? + SchemaQA + SecQA-Auto + RefQA-Auto)
>   ↓
> Step 2/4 — draft.pptx 自動ビルド (build-deck.js) + PNG 化 (pptx-to-images.sh)
>   ↓
> Step 3/4 — plan.html を実プレビュー画像つきで再描画 (--preview-dir 経由)
>   ↓
> Step 4/4 — 手動 QA セルフレポート (SecQA-Manual + RefQA-Manual)
> ```
>
> 微調整中で PPTX ビルドを省略したい時は `--skip-pptx` フラグ。本番提出前は必ず外す。
> plan.html では各スライドカード末尾に「🖼️ 実プレビュー」ブロックが常設される。

## Phase 2 — 情報設計（HTML 指示書をファイル直書き）

### ⚠️ Phase 2 を始める前の必読 3 ファイル

plan.json を組み立てる前に、以下 3 ファイルを必ず Read する。bypass モードでも省略不可。

1. **`scripts/render/schemas/`** — テンプレ別 Zod スキーマ正本
   サンプル集 (JSDoc から自動生成)。plan.json は **このファイルから該当テンプレを
   コピペ → 中身を差し替え** が最速ルート。`scripts/render/templates/eno-XX.js` の
   JSDoc を 1 つずつ view する必要がない。
2. **`references/phase2-information-design/deck-instruction-schema.md`** — MUST ルール
   (M1〜M6) と doc / sections / reviews の正本スキーマ。`reviews[]` の構造
   (cycle_num / cycle_desc / persona.{avatar,name,role,bio,traits} / summary /
   issues[] / final_check{title,body}) もここで確認する。
3. **`references/qa/schema-qa.md`** — Phase 2 完了直前に
   `scripts/run-qa.py phase2` (内部で `render-deck-instruction.py --strict` 相当) が fatal にする条件 (SchemaQA-01〜07,
   SecQA-05/09a-d/10) の一覧。

> **なぜ 3 ファイルとも読むか**: 1 はフィールド名と粒度感を「コピペで」掴む用、
> 2 は MUST ルールと reviews の正本、3 は strict mode で何が止まるかの予習。
> 過去デッキ deck.json から逆引きする運用は脆く、フォーマット差分で render エラーに
> 嵌るので避ける。

### 目的

Phase 1 で集めた情報をもとに、**デッキの骨格を HTML で設計し `decks/{slug}/plan.html` にファイル直書き** する。
ユーザーはブラウザで `plan.html` を開き、気になるスライドの ID を **ワンクリックでコピー** してチャットに戻り、ピンポイントで修正指示ができる。

> **なぜ HTML か**: Markdown より視覚的に俯瞰しやすく、各スライドに紫 ID バッジ（例: `S3`）を配置することで、ユーザーが「S3 のサブコピー変えて」のような指摘を素早く返せる。レビュー速度が大幅に上がる。

### アウトプット

`references/phase2-information-design/deck-instruction-html-template.html` のスタイルに従った **3 タブ構造の HTML ファイル**。以下を含む：

**共通ヘッダー（全タブ表示）**
- デッキタイトル / バージョン / 作成日 / 選択テーマ
- メタグリッド（目的 / 読者 / Before→After / テーマ）
- タブバー（📄 最終アウトプット / 🧠 思考過程 / 🔄 レビューサイクル）

**📄 最終アウトプット タブ** — ユーザーがメインで見る完成形
1. **QUICK NAV** — 全スライド ID のチップ
2. **スライドカード** — 各ページ:
   - 紫 ID バッジ（`S1`, `S2`, ... `SR`）— クリックで ID コピー
   - テンプレ番号タグ（例: `LIST-1 標準コンテンツ`, `DIAG-09 2軸プロット`）
   - タイトル / サブコピー
   - 📝 コンテンツ詳細 / 🎨 トーン・強調 / 🔗 参考・出典
3. **SR スライド（参考情報集）** — `<table class="ref-table">` でタイトル列を青リンク化（全デッキ必須）

**🧠 思考過程 タブ** — 設計意図を言語化
- 各スライドの Thinking カード:
  - 🎯 読者に抱かせたい印象（感情・認知レベル）
  - 💬 持ち帰ってほしい一言（キラーフレーズ）
  - 📐 テンプレ選定の理由
  - 🎨 トーン選定の理由
  - 🔗 前後スライドとの接続
  - ⚠️ 想定される反応・質問

**🔄 レビューサイクル タブ** — 架空読者での通読テスト結果
- **Persona カード** — 架空読者のプロファイル（名前・役職・関心・忍耐度・地雷）
- **Review Summary** — 発見した Issue 数、重要度内訳、対応状況
- **Issue カード（R1, R2, ...）** — 各つまずきポイント:
  - 重要度タグ（高/中/低）
  - 対象スライドへのリンク（→ S3）
  - 💬 読者目線のフィードバック
  - ✏️ 対応内容
  - Before / After 差分（`<details>` で折りたたみ）

### ID の付け方ルール

| プレフィックス | 用途 | 例 |
|--------------|------|-----|
| `S1`, `S2`, ... | 本編スライドを通し番号で | `S1`, `S2`, `S3` |
| `SR` | 参考情報集ページ（末尾） | `SR`（Reference の R）|
| `SA1`, `SA2`, ... | セクション A 内で細かく分けたいとき（任意） | `SA1` |

番号は **スライドの物理順** と一致させる（並び替えた時は再採番）。

### 生成手順 — 6 ステップフロー

Phase 2 は以下の **6 ステップ** で進める。**ステップ 1-4 は QA で「規約 (客観)」を
満たす段階、5-6 はペルソナで「読者の感情 (主観)」を見る段階**。
順序が崩れると「規約違反のままペルソナレビューに入って手戻りが膨らむ」事故を生むので
厳守する。各ステップの状態は `decks/{slug}/plan.html` 上部の「制作ワークフロー」panel に可視化される。

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│1.構成作成 │ → │2. 4種QA   │ → │3.QA違反修正│ → │4.全件pass │ → │5.ペルソナ │ → │6.反映→完成│
│           │   │実行・違反 │   │            │   │まで反復   │   │レビュー実施│   │           │
└──────────┘    └─────┬────┘    └─────┬────┘    └─────┬────┘    └─────┬────┘    └──────────┘
                      └─────────┴── 2-3 を反復 ──┘                  ↓
                  (M? + SQA + SecQA + RefQA)              ペルソナの指摘を反映
```

| Step | やること | 出口判定 |
|------|---------|---------|
| **2-1** | ⭐ **braindump-to-plan.py 必須実行**。`python3 scripts/braindump-to-plan.py -i decks/{slug}/braindump.md -o decks/{slug}/plan.draft.json`。下地は機械生成、Claude は触らない。skip_braindump=true 時のみ skip 可 | `plan.draft.json` が存在し `doc.compact_mode: true` / `doc.crystallization_status: 'draft'` |
| **2-2** | ⭐ **結晶化 (Claude が手で詰める)**。plan.draft.json を読んで items[].desc / subtitle / cards[] を 130-160 字目安に詰め直し、固有名詞・数値・年・因果を残しつつ冗長表現を落とす。`doc.crystallization_status` を `'crystallized'` に更新 | `plan.json` 完成 + crystallization_status='crystallized' |
| **2-3** | M? + SQA + SecQA + RefQA を走査し違反を qa_report に記録 | 違反一覧が確定 |
| **2-4** | 違反項目を JSON に反映、修正提案に従って書き直す。2-3 → 2-4 のループ | qa_report.total_violations == 0 |
| **2-5** | ペルソナレビュー (2 サイクル × 1 persona) で改善点を洗い出す | reviews[].issues に記録 |
| **2-6** | ペルソナの指摘を JSON / コンテンツに反映 | reviews[].final_check が pass |

> **強制化の根拠**: SchemaQA-08 (build-deck.js) で `compact_mode: true` なのに `crystallization_status: 'crystallized'` が無いと fatal を返す。Step 2-1 / 2-2 を skip すると Phase 3 build で蹴られる。

> **opt-out**: `doc.skip_braindump: true` のデッキは Step 2-1 を skip し、Phase 1.8 と同様に従来の手書き plan.json 経路で進める。短い社内共有ピッチ (10P 以下) や事例カタログのみ。

> **重要**: ステップ 4 で QA を pass できないままステップ 5 に進まない。
> 規約違反 (横文字混入・引用ゼロ・章扉直後の媒体ミス等) はペルソナの判断材料を
> 汚すので、先に客観検査を全件通すこと。

`plan.html` ヘッダー直下の「制作ワークフロー」panel が現在のステップ番号と各ステップの
状態 (done / active / pending) を自動表示する。Phase 4 で VQA を実施した時は
qa_report 更新 → plan.html 再生成（同じパスに上書き）で workflow_state も更新される。

各ステップの詳細は以下:

**Step 2-1: 初稿の設計**

まずデッキの **3 階層構造** を頭の中で組み立てる。
```
セクション (5 個前後、上部ナビチップで表現)
  └─ サブセクション (1 セクションに 0〜3 個、パンくずで現在位置を示す)
      └─ 個別スライド (そのサブセクションの詳細)
```

**どういう時にサブセクションを立てるか**:
- セクション内に **関連するトピックの塊が 2 つ以上** ある時
- 例: セクション「新機能の紹介」内に「新機能 A」「新機能 B」「新機能 C」の 3 つのサブセクション
- サブセクションが不要なデッキもある（セクション直下にスライドが並ぶ）— 無理に作らなくてよい

**命名規則**:

**サブセクション名** と **タイトル冒頭の識別子** は **別の役割** を持つ：

| 要素 | 役割 | 配置 | 例 |
|-----|-----|-----|-----|
| サブセクション名 | 複数スライドをまとめる **グループ名** | 右上パンくず | 「ステップ別の説明」「新機能の詳細」 |
| タイトル冒頭の識別子 | そのスライド **固有の位置識別** | タイトル冒頭 | 「Phase 2：」「Step ①：」「新機能 A：」 |

両者は **同じ語彙でも違う語彙でもよい**。同じにすると親和性が強まり、異なると役割分担が明確になる。

**良い例（役割が異なる）**:
```
セクション:    ワークフロー
サブセクション: ステップ別の説明      ← グループ名（抽象）
S3 タイトル:   Phase 1：ヒアリングで何を聞くか  ← 固有識別子（具体）
S4 タイトル:   Phase 2：HTML 指示書を 3 タブ構造で出す
S5 タイトル:   Phase 3：PPTX 化と QA で目視確認
```

**悪い例（グルーピングが崩れる）**:
```
サブセクション: Phase 2：情報設計       ← タイトルの一部を流用してしまっている
S3 タイトル:   Phase 2：HTML 指示書を…  ← 同じ Phase 2 が重複
```

**サブセクションは任意**:
- そもそもサブセクションを立てなくてよいスライドも多い（セクション直下にそのまま並べる）
- HTML 指示書では、該当スライドカードから `<span class="subsec-badge">` を省略すればよい

次に具体的な設計に進む:

1. `references/phase2-information-design/deck-instruction-html-template.html` を view tool で読み、構造と CSS 変数を把握
2. **カラーテーマを選ぶ** — 以下の 5 つから、クライアント企業のコーポレートカラーや業界慣習に合わせて選択：
   - `enostech` (紫×アンバー) — デフォルト、ENOSTECH 自社資料
   - `corporate` (ネイビー×ゴールド) — 金融・コンサル・士業
   - `nature` (グリーン×オレンジ) — サステナブル・ヘルスケア・消費財
   - `warm` (レッド×ティール) — エンタメ・飲食・B2C
   - `mono` (黒×アンバー) — ラグジュアリー・アート
3. Phase 1 の情報をもとに **📄 最終アウトプット タブ** の各カードを埋める
   - サブセクションに属するスライドには、テンプレタグの横に `<span class="subsec-badge">サブセクション名</span>` を配置
   - **サブコピーは「読者がスライド単独で理解できる説明」として書く**
     - 1 文の言い切り型（「30 分の作業が 2 秒に」）は禁止 — 視線が滑り、内容が伝わらない
     - 説明型（「Excel で 30 分かかっていた月次集計が、話しかけるだけで 2 秒に。SQL 担当者への依存も解消される」）にする
     - **推奨 120〜200 字、最大 250 字まで許容、最低 80 字**
     - 含める要素は ① 具体（数値・固有名）／ ② 「なぜ」「どうやって」の説明／ ③ 読後の変化／ ④ 逆接・対比 のうち **3〜4 個を意識**
     - レイアウトは `addTitleBlock` が 1〜4 行で動的に拡縮するため、長く書いても破綻しない
     - 詳細は R2-4（`references/phase2-information-design/README.md`）の Before/After 例を参照
4. 追加で web_search が必要な主張があれば都度実施
5. **SR スライド（参考情報集）を必ず含める**
   - SR の各行に通し番号 `(1)` `(2)` ... を付与し、本編スライドの主張にはこの番号と対応する**インライン参照番号**を埋め込む前提で指示書を書く
   - 指示書の「詳細コンテンツ」欄で「この主張 → SR(3)」のような紐付けを明記しておくと Phase 3 で迷わない
6. **各スライドカードに「テンプレ構造プレビュー画像」を Base64 で埋め込む**
   - 該当テンプレIDを `scripts/get-template-preview.py` に渡して data URI を取得
   - `<div class="template-preview">...</div>` として slide-subtitle の直後に挿入
   - これによりユーザーは実際のテキストが入る前から **レイアウト構造を視覚確認できる**

   ```bash
   # 単一テンプレの data URI を取得
   python scripts/get-template-preview.py LIST-1

   # 複数テンプレをまとめて JSON 取得
   python scripts/get-template-preview.py SECTION-1 LIST-1 DIAG-09 --json
   ```

   HTML 埋め込み形:
   ```html
   <div class="template-preview">
     <img src="data:image/jpeg;base64,..." alt="LIST-1 テンプレート構造">
     <div class="tp-meta">
       <div class="tp-label">📐 テンプレ構造プレビュー</div>
       <div class="tp-name">LIST-1 · 標準コンテンツ</div>
       <div class="tp-note">説明文<br>※ 実際のテキストは入っていません</div>
     </div>
   </div>
   ```

7. **DIAGRAM-4 章見取り図の実描画経路を必ず選ぶ (SchemaQA-03 必須)**

   各章の章扉 (SECTION-5/03/33) の直後に置く DIAGRAM-4 セクション挿絵スライドは、
   `placeholder_label` に描画指示を書くだけでは **draft 状態の薄字テキストが
   plan.html に出るだけで終わる**。これは「章の見取り図として読者にその章の
   認知マップを 1 枚で渡す」という DIAGRAM-4 本来の役割を果たさない。

   **必ず以下のいずれかを 1 つ選んで plan.json の各 DIAGRAM-4 スライドに追記する**:

   | 経路 | フィールド | 使う場面 |
   |------|----------|---------|
   | B. 実画像を貼る | `"image_path": "decks/{slug}/assets/ch1.png"` | 既存ロゴ図やスクショがある時 |
   | C. SCENE-XX を呼ぶ | `"scene": "scene-04-business-model"` | DIAG で届かない自由な構図 |

   **DIAG-XX 選定の指針** (`references/_common/diagram-patterns.md` を参照):

   - 章で **2 軸でツール/概念を位置付け** → DIAG-08 2x2 マトリクス
   - 章が **段階的成熟・成長ロードマップ** → DIAG-03 ステップアップ
   - 章が **導入前後の差分** → DIAG-04 Before/After
   - 章が **反復プロセス (PDCA等)** → DIAG-02 サイクル
   - 章が **階層構造** → DIAG-05 ピラミッド
   - 章が **時系列** → DIAG-06 タイムライン
   - 章が **競合ポジショニング・散布** → DIAG-09 2 軸プロット

   各 DIAG の必須フィールドは `scripts/render/diagrams/diag-XX-*.js` の
   DIAG-08 なら `{ x_axis: {low,high}, y_axis: {low,high}, quadrants: {tl,tr,bl,br} }`。

   **placeholder_label のみ で SchemaQA-03 が fatal を返す** ので、上記 A/B/C のいずれか
   1 つは必ず追加する。

   **どの DIAG にも明確に当てはまらない章** は、ヒアリングで章の認知型を
   再整理する余地があるサイン。「章で読者に何を腹落ちさせたいか」を
   1 文で言語化し直してから、上の指針に当てて選び直す。

**Step 2-2: 思考過程の言語化（🧠 思考過程 タブ）**

初稿を埋めた直後、**同じスライドごとに「なぜこの設計にしたのか」を言語化** する。これは AI の思考を透明化するためで、人間のレビュアーが「この意図なら OK」「この意図は外してる」と判断しやすくなる。

各スライドに以下を記録：

| 項目 | 書く内容 |
|------|--------|
| 🎯 読者に抱かせたい印象 | 感情レベルでどう感じてほしいか（例: 「驚き→希望」「誇り＋確信」）|
| 💬 持ち帰ってほしい一言 | そのスライドを見終えた時に読者が口にしてほしいフレーズ |
| 📐 テンプレ選定の理由 | なぜそのテンプレ番号を選んだか |
| 🎨 トーン選定の理由 | なぜその配色を選んだか |
| 🔗 前後スライドとの接続 | ストーリーの文脈（S1 との繋がり等） |
| ⚠️ 想定される反応・質問 | 読者が質問しそうなこと、懸念しそうなこと |

全 6 項目を埋める必要はない。**各スライドで最低 3 項目** を埋める。特に「読者に抱かせたい印象」と「持ち帰ってほしい一言」は必須。

---

**Step 2-3: 架空読者によるレビューサイクル（🔄 レビューサイクル タブ）**

初稿 + 思考過程を書き終えたら、**自分自身で通読シミュレーションを実施する**。人間が最終 QA を判断するための材料を残すのが目的。

1. **架空読者のペルソナを定義** — Phase 1 の「読者」を具体化。以下の項目を書く：
   - 名前（架空でよい）+ 年齢・役職
   - 現在の業務シーンと前提知識
   - 関心事、忍耐度、求めていること、警戒している地雷
2. **そのペルソナになりきって初稿を通読**
3. **つまづいた点・わかりにくかった点を 2〜5 個洗い出す** — 「R1, R2, R3...」と採番
4. **各 Issue を issue-card に記録**：
   - `R1` などの ID、重要度タグ（高/中/低）、対象スライド（→ S3 リンク）
   - 💬 フィードバック（読者目線の生の声）
   - ✏️ 対応（どう修正したか）
   - Before/After 差分（`<details>` で折りたたみ）
5. **修正を反映**（最終アウトプット タブの該当カードを更新）
6. **再通読してレビュー完了の状態を記録**

例:
- R1 (高): S3 のサブコピーで「94%」の根拠が不明 → 「社内 QA 713 問の検証結果」を追記
- R2 (中): S4 の Before 行が重すぎて離脱 → 「SQL 専門知識」→「Excel で手集計」に変更
- R3 (低): S5 の軸ラベルが分かりにくい → Phase 3 実装時に補足を追加

**レビュー結果は人間の最終判断材料**。AI が「解消した」と判断しても、人間が「いや、まだ足りない」と言える余地を残すため、すべての試行結果（元のフィードバック + 修正内容）を HTML に残す。

**Step 2-4: HTML 指示書を decks/{slug}/plan.html に書き出し**

3 タブ揃った HTML を **`decks/{slug}/plan.html` にファイル直書き**する。同時に、その元
ネタとなる JSON も `decks/{slug}/plan.json` に保存（Phase 4 で再生成する時の入力ソース）。

```bash
# Phase 1 で既に decks/yyyy-mm-dd_{slug}/ は作成済み
DECK_DIR="decks/<yyyy-mm-dd>_<slug>"

# JSON を保存
cat > "${DECK_DIR}/plan.json" <<'EOF'
{ ... 設計指示書 JSON ... }
EOF

# QA + HTML レンダリング (run-qa.py 経由に一本化)
python3 <skill-root>/scripts/run-qa.py phase2 \
  --plan "${DECK_DIR}/plan.json"
# bypass モード時は --bypass を付ける (RefQA-02 fatal 化)
# fatal が出たら exit 2 で停止するので、修正してから再実行
# pass + 手動 QA セルフレポート編集後は --apply-manual で反映
```

> 💡 個別スクリプトは内部実装に格下げ。
> `python3 scripts/render-deck-instruction.py --strict` は run-qa.py 内部から呼ばれるので、
> ドキュメントから直接呼ばないこと (デバッグ・特殊用途のみ例外)。

レビューサイクル中に修正を入れた時は、`plan.json` を更新してから render コマンドを再実行
し、`plan.html` を上書きする。承認待ち中に複数バージョンを作る必要はない（同じパスに最新を
上書きしていく運用）。

**Step 2-5: ユーザー承認**

ユーザーに `decks/{slug}/plan.html` のパスを提示し、ブラウザで開いて確認してもらう。
チャット応答内では Step 2-4 の冒頭メッセージ（次節「Human in the Loop」参照）でリンクを示す。
承認の判定基準は本セクション末尾の「承認の判定」を参照。

### 重要な設計原則

**① ファクトベースを徹底する**

各スライドの「主張」には必ず根拠を紐付ける：
- 外部データ → タイトルを `<a class="cite-link" href="URL">` でリンク化（URL は表示しない）
- 社内情報 → `<span style="color: gray">[社内: {出典}]</span>` と明記
- 仮置きの主張 → `<span style="color: red">[仮: 要確認]</span>` と明記し、ユーザーに出典を促す

**② 色トーンは感情設計と一致させる**

- **gray** (default): 事実・現状提示・中立の情報
- **purple**: ブランドの価値・強み・提案
- **amber**: 達成・行動・前向きな変化・温かみ

ストーリーライン上の感情の流れ（問題提起 → 解決 → 行動）とトーンを揃える。各スライドの「🎨 トーン・強調」欄に明記。

**③ 1 つのテンプレに 1 つの主張**

タイル 2×2 で「主張が 5 個あります」は設計ミス。タイル 3×2 に変えるか、スライドを分割する。

**④ ストーリーの切れ目で接続を明示**

セクション（SECTION A, B, ...）の区切りで `<div class="section-title">` を入れ、セクション内は論理的に繋がる流れにする。

### Human in the Loop（承認ループ）

`plan.html` を書き出したら、以下を明示的に聞く：

> HTML 指示書を 3 タブ構造で `decks/2026-04-29_facthub-intro/plan.html` に書き出しました。
> ブラウザで開いてご確認ください。
>
> **📄 最終アウトプット タブ**: 完成形のスライド構成
> **🧠 思考過程 タブ**: 各スライドで「読者に抱かせたい印象」「持ち帰ってほしい一言」など設計意図
> **🔄 レビューサイクル タブ**: 架空読者で通読した結果、R1・R2・R3 の改善点を抽出 → 最終アウトプットに反映済み
>
> 各スライドの紫 ID バッジ（S1, S2, ...）をクリックすると ID がコピーされるので、
> 修正したい箇所があればその ID を添えて指摘してください（例: 「S3 のサブコピーを○○に」）。
>
> 確認ポイント:
> - Before → After の設計は適切か
> - 各スライドの思考過程（読者印象・一言）は意図と合っているか
> - レビューサイクルで抽出した改善点は妥当か、対応は十分か
> - 参考情報集（SR）の出典は正しいか
>
> 全体 OK なら「指示書 OK、実装へ進んで」とお返事ください → Phase 3 に進みます。

### 承認の判定

- ✅ 「OK」「進めて」「これで良い」「問題ない」「Phase 3 に進んで」→ 承認、Phase 3 へ
- ⚠️ 「S3 のサブコピーを○○に」「SR に〇〇を追加」→ 該当カードを update、v2 として再提示
- ⚠️ 「もう少し考えたい」「他にも選択肢ある?」→ 承認保留、議論継続

**絶対に守ること**: 明示的な承認がない限り Phase 3 には進まない。曖昧な返事（「うん」「なるほど」等）を承認とみなさない。

---

### 🛡 Phase 2 の SVG 必須テンプレ手順 (機械強制あり)

**SECSUMMARY-1 / SECTION-1G / VISUAL-9〜12 / FRAMING-1 (svg field) など `svg` フィールドが必須なテンプレ**を含む章を組む時は、以下の手順を **必ず守ってください**。違反すると build-deck.js の SchemaQA-03b で fatal され、build が止まります。

#### 手順 (1 章ごとに繰り返す)

1. plan.json で当該スライドの **他フィールド (template_id / section_id / section_no / section_title / one_line / speaker_notes) を先に書き終える**
2. 当該スライドの **`svg` フィールドだけを一旦空欄にする** (TODO 注記も入れない)
3. **plan.json の記述を一旦止める**
4. **`enostech-svg-diagram` skill を別途 invoke** する
5. enostech-svg-diagram の SKILL.md と必読 2 ファイル (`references/how-to-write-svg.md` / `references/pattern-catalog.md`) を Read する
6. 当該章の **主役ビジュアル SVG を 1 枚手書き** する (題材ごとの構造設計から考える)
7. **`python3 scripts/qa/svg-schema-qa.py path/to/svg-file.svg`** で fatal 0 件を確認する
8. 本物の SVG を `svg` フィールドに入れて、次の章に進む

#### 🚫 禁止行為 (各々が機械検出されます)

| やってはいけないこと | 機械ガード |
|---|---|
| **Python ヘルパー (f-string / 共通テンプレ) で SVG を量産する** | 5 章分が同じ構造 (灰色背景 + 番号文字だけ) になり、enostech-svg-diagram の `1 SVG = 1 構造設計` 原則を破る (CLAUDE.md C-15) |
| **placeholder SVG (灰色背景 + 番号だけ、TODO / 「差し替え」マーカー入り) で済ませる** | **SchemaQA-03b で fatal 停止** |
| **placeholder のまま「A: placeholder のまま完成 / B: 本物に差し替え」のような選択肢をユーザーに提示する** | CLAUDE.md C-15 で禁止。ユーザーが OK と言うと placeholder のまま完成してしまう経路を作るアンチパターン |
| **SVG 中身が薄い (1,200 chars 未満) のに「完成」と判断する** | build-deck.js が `[svg-preprocess] ⚠ SVG 中身が薄い` と warn を出します |

#### なぜこの手順か (理由)

SVG は題材ごとに最適な構造設計が必要です。装備の Tier 分類なら **カードグリッド**、4 段構えの安全運用なら **左右予防/保険分割**、季節別山リストなら **4 季節カラム**、同行者比較なら **3 列比較**、1 日のスケジュールなら **横軸タイムライン** —— 1 章 1 構造で書く必要があります。

Python f-string で量産すると共通テンプレに引っ張られて、全 SVG が「灰色背景 + 番号文字 + キャッチ 1 行」のような placeholder 構造に収束します。これでは題材の説得力が出ず、章扉直後の「主役ビジュアル一発」(SECSUMMARY-1 規範) としての効果が完全に失われます。

「**1 SVG = 1 構造設計**」の鉄則を守ることで、enostech-svg-diagram の本来の表現力 (cloudDesign 流の制約セット) が活きます。

#### 例外 (この手順を skip して良いケース)

ありません。SECSUMMARY-1 に `svg` または `svg_file` を入れる時は、必ず enostech-svg-diagram で本物を書いてください。`svg_file` 経由 (別ファイルを指定) でも、ファイル中身は SchemaQA-03b の検出対象外ですが、別途 `svg-schema-qa.py` を通す運用にしてください。

---

## Phase 3 — デッキ構築

### 目的

承認済みの指示書を **忠実に** PptxGenJS コードに落とし込む。

> ⚡ **ツールコール削減**: Phase 3 に入る前に、ダイアグラムの有無を確認し、
> 必要な参照ファイル（tokens.js / slide-patterns.md / example-deck.js 等）を確定してから
> **1 回の bash** でまとめて読む。ファイルを 1 枚ずつ `view` で読まない。
> 詳細は `references/_common/parallel-execution.md` の「Phase 3」セクション参照。

### 実行手順

1. **承認済みの `decks/{slug}/plan.html` (および plan.json) をもとに**、`scripts/render/build-deck.js` のディスパッチャーで JSON → PPTX 変換
   ```javascript
   const T = require('../assets/tokens');
   const C = T.color;  // これ以降 C.brand などがテーマ色に
   ```
3. `tokens.js` のトークン、`addTitleBlock` などのヘルパーを使う（ハードコード禁止）
4. 各スライドは `{ ... }` ブロックで独立させる
5. `references/_common/pptx-patterns.md` で PptxGenJS の具体コードを参照
6. `references/_common/token-rendering-guide.md` で仕組みを確認
7. コード完成後（QA フェーズ）：
   - Node.js で実行して .pptx を出力
   - soffice で PDF 変換 → 画像化（`libreoffice --headless --convert-to pdf` → `pdftoppm -r 140`）
   - **`references/qa/visual-qa.md`（VQA-01〜12）のチェックリストで全スライドを目視確認** - 特に「テキストのシェイプはみ出し」は頻発するため最重点で確認
     - 参考情報集ページが末尾に配置されているか、青リンクになっているかも確認
   - 問題があれば修正

### 実装時に注意すること

- **指示書に書いてある主張を勝手に変えない**。ユーザーが承認した内容を尊重
- **参照リンクは 3 段構え**
  - **① 本文内インライン番号** — 主張の直後に `inlineRef(num, url)` を `addText([...runs])` で埋め込み、`(1)` `(12)` の青リンクにする
  - **② 脚注** — `addFootnote(s, [{label, url}])` でスライド下部に出典タイトル（青リンク）
  - **③ 末尾の参考情報集ページ** — `addReferenceTable` で全出典を集約（SR の行番号がインライン番号と対応）
- **デッキ末尾に参考情報集ページ (DATA-4 + `addReferenceTable`) を必ず 1 枚配置**
- **インライン番号の番号付与ルール**: SR ページに出典を並べた順（行番号）と一致させる。SR ページを作ってから逆引きで本文に `(1)` `(2)` を振ると整合が取りやすい
- **各スライドの情報密度を守る** — 指示書で「詳細コンテンツ」として列挙された要素は、漏らさず反映

### Phase 3 の完了判定

- [ ] 指示書の全スライドが実装されている
- [ ] 各スライドのタイトル・サブコピー・コンテンツが指示書と一致
- [ ] トーン (gray/purple/amber) が指示書通り
- [ ] テンプレ番号の割り当てが指示書通り
- [ ] **末尾に参考情報集ページ (DATA-4) が 1 枚配置されている**
- [ ] **ファクトベースの主張にはインライン参照番号 `(1)` `(N)` が埋め込まれている**
- [ ] **インライン番号と末尾の参考情報集ページの行番号が一致している**
- [ ] **draft.pptx を `decks/{slug}/draft/draft.pptx` に出力済み**。生成スクリプトも同じ階層 (`decks/{slug}/draft/build.js` 等) に保存し、Phase 4 で再ビルドに使う

完了したら **Phase 4（ユーザー QA）** に進む。

---

## Phase 4 — ユーザー QA + decks/ 最終整形

### 目的

Phase 3 で生成された `decks/{slug}/draft/draft.pptx` の品質を、**まず Claude が
コンタクトシート PNG で自己目視 QA して問題を絞り込み、ユーザーは draft.pptx を
直接開いて確認**する。承認が取れた瞬間に
`build-deck-package.js` を **確認なしで機械実行** し、既存 `decks/yyyy-mm-dd_{slug}/`
ディレクトリを最終整形（draft/draft.pptx → 資料.pptx 昇格、preview/ 配置、生成メモ.md
集約）する。

> ⚡ **ツールコール削減（重要）**: スライドを 1 枚ずつ `view` しない。PNG 変換後は
> **コンタクトシート**（全スライドを 1 枚に合成した画像）を生成し、1 回の `view` で全体を俯瞰してから
> 怪しいスライドのみ個別確認する。15 枚デッキで 15 view → 2〜4 view に削減できる。
> 生成コマンドは `references/_common/parallel-execution.md` の「Phase 4」セクション参照。

### 実行手順

#### Step 4-1: pptx を PNG 群に自動変換

```bash
DECK_DIR="decks/<yyyy-mm-dd>_<slug>"
python3 <skill-root>/scripts/run-qa.py phase4 \
  --plan "${DECK_DIR}/plan.json"
# run-qa.py が内部で pptx-to-images.sh + コンタクトシート生成 + VQA 雛形書き出しまで一気に実行
# VQA セルフレポートを編集 (qa-self-report-phase4.md)
# 編集後にもう一度 --apply-manual を付けて再実行 → plan.json に反映
```

20 枚デッキで約 15〜25 秒。ユーザーに「QA 実施中、少々お待ちください」と一言添える。
出力先を decks/{slug}/preview/ にすることで、Phase 4 末尾の build-deck-package.js が
そのまま採用できる（コピー不要）。

#### Step 4-2: コンタクトシートで全体俯瞰

- `references/_common/parallel-execution.md` の montage コマンドを実行 → `decks/{slug}/preview/contact-sheet.png` を生成
- `view decks/{slug}/preview/contact-sheet.png` の **1 回** で全スライドを確認
- レイアウト崩れ・テキスト詰まりなど目視で怪しいスライドに印をつける
- 怪しいスライドのみ `view decks/{slug}/preview/slide-N.png` で個別拡大確認
- `references/qa/visual-qa.md`（VQA-01〜12）と `references/qa/reference-qa.md` の RefQA-09（DATA-4 表示崩れ）を基準に問題を抽出
- 最重点は **テキストのシェイプはみ出し**（頻発する不具合）

#### Step 4-3: 問題だけを絞ってユーザーに提示

- 発見した場合: 該当スライド番号・症状・推奨対処を箇条書きで報告 → ユーザーに判断を求める
- 発見しなかった場合: 「QA 完了、問題なし」と報告 + `decks/{slug}/draft/draft.pptx` のパスを提示し、ユーザーが直接開いて確認
- 判断基準は明確な不具合のみ（美的な好みは挙げない）
- .pptx は実ファイルとして直接開いてもらう前提

#### Step 4-4: 修正依頼が来たら

- 小さい修正（文言・色・位置の微調整）→ 生成スクリプトを `str_replace` で直して再ビルド → Step 4-1 から再 QA
- 大きい修正（構成変更・スライド追加）→ Phase 2 の指示書に立ち返り、更新 → 再承認 → Phase 3 で作り直す

#### Step 4-5: ユーザー承認時に build-deck-package.js を機械実行

ユーザーが「OK」「問題ない」「これで良い」と明示承認した瞬間に、**確認なしで** 以下を実行する:

```bash
DECK_DIR="decks/<yyyy-mm-dd>_<slug>"
node <skill-root>/scripts/build-deck-package.js \
  --pptx             "${DECK_DIR}/draft/draft.pptx" \
  --plan             "${DECK_DIR}/plan.html" \                        # ✅必須
  --preview-dir      "${DECK_DIR}/preview" \
  --contact-sheet    "${DECK_DIR}/preview/contact-sheet.png" \
  --slug             facthub-intro \
  --title            "FactHub 紹介資料"
  # --project-root は省略可: cwd 祖先の CLAUDE.md or $ENOSTECH_PROJECT_ROOT から自動検出
```

> 🔴 **`--plan` は必須**。Phase 2 Step 2-4 で書き出した `decks/{slug}/plan.html` のパスを必ず渡す。
> 未指定だと「`--plan` は必須です」エラーで即停止する。
> 過去デッキの再パッケージで指示書が紛失している例外運用のみ `--skip-plan` を明示。

スクリプト内部で自動処理されるもの (5 ステップ):

1. `[1/5]` `draft/draft.pptx` を `資料.pptx` に昇格（同じ decks/{slug}/ ディレクトリ内で移動）
2. `[2/5]` `plan.html` は **既に Phase 2 で配置済み**
3. `[3/5]` `preview/` の slide-NN.png + contact-sheet.png を整える
   （Step 4-1 で既に decks/{slug}/preview/ に出力済みのものをそのまま採用）
4. `[4/5]` `build-narration.py` が pptx の speaker notes (= ナレーション台本) を読んで
   `ナレーション台本.md` (markdown) として配置
5. `[5/5]` `build-html-report.js` が `html_supplement.enabled = true` のスライドを
   集めて `レポート.html` を生成。0 件ならスキップ

詳細は `references/phase4-qa/decks-packaging.md` を参照。

#### Step 4-6: ユーザーへ最終ファイルパスを提示

完成した `decks/{yyyy-mm-dd_slug}/資料.pptx` のパスをチャットで提示する。
ユーザーは OS のファイラーで直接開いて確認する前提。

### Phase 4 の完了判定

- [ ] `pptx-to-images.sh` で PNG 群を `decks/{slug}/preview/` に生成した
- [ ] コンタクトシートを生成し、全体俯瞰を 1 回の `view` で実施した
- [ ] 怪しいスライドのみ個別 `view` し、`visual-qa.md` の基準で問題を抽出した
- [ ] 問題があれば修正し、Step 4-1 から再 QA した
- [ ] ユーザーが明示的に「問題ない」「OK」「これで良い」と承認した（draft.pptx を直接開いて確認した上で）
- [ ] **承認時点で `build-deck-package.js` を機械実行した（確認ステップは挟まない）**
- [ ] `decks/yyyy-mm-dd_{slug}/` に 資料.pptx / plan.html / ナレーション台本.md / preview/ の 4 要素が揃った
       （特に plan.html の有無を必ず目視確認。欠落していれば Phase 4 失敗扱い）
- [ ] 最終 `資料.pptx` のパスをチャットで提示した

完了したらデッキ生成フロー終了。追加派生（ブログ変換・共有メッセージ）の依頼があれば
`references/alt-modes/secondary-production.md` に従う。

---

## フェーズ間の逆戻り

途中でユーザーから「やっぱり違う方向性で」「やっぱりこの主張を強調したい」といった要望が来たら、**素直に前フェーズに戻る**。無理に進めない。

- Phase 4 で decks/ 最終整形後に「やっぱりスライドの文言を直したい」→ Phase 3 のスクリプトを更新 → 再ビルド → Step 4-1 から再 QA → 再承認時に decks/{slug}/ を上書き整形（ディレクトリは既に存在するので mv 不要）
- Phase 4 で「主張そのものを変えたい」→ Phase 2 に戻って指示書を更新 → 再承認 → Phase 3 再開
- Phase 3 で実装中に「やっぱり主張を変えたい」→ Phase 2 に戻って指示書を更新 → 再承認 → Phase 3 再開
- Phase 2 で「やっぱり読者ターゲットが違う」→ Phase 1 に戻って再ヒアリング

---

## よくある失敗と対処

### 失敗 1 — Phase 1 を飛ばしていきなりコード生成

対処: どんなに簡単そうな依頼でも、最低限「目的 / 読者 / Before→After」の 3 点は確認する。これらが揃わないと Phase 2 の plan.html が空疎になる。

### 失敗 2 — Phase 2 の plan.html を書き出さずに Phase 3 に進む

対処: plan.html は **必ず** `decks/{slug}/plan.html` に書き出す。ユーザーが「簡単でいいから早く」と言っても、指示書を作る時間は短いのでスキップしない。後戻りのコストが大きい。

### 失敗 3 — ソースなしで主張を書く

対処: ソースがなければ `[仮: 要確認]` と明記し、ユーザーに確認を促す。勝手に数値を作らない（ハルシネーション防止）。

### 失敗 4 — 承認を待たずに Phase 3 に進む

対処: 曖昧な返事は承認ではない。「OK です」「進めてください」のような明示的な許可を必ず得る。

### 失敗 5 — 指示書と実装が食い違う

対処: Phase 3 で実装中、指示書に無い要素を勝手に追加しない。疑問が生じたら Phase 2 に戻って指示書を update する。

### 失敗 6 — Phase 4 QA をスキップして勝手に decks/ 最終整形を始める

対処: Phase 3 のアウトプットを提示しただけで「これで OK だろう」と勝手に
build-deck-package.js を叩かない。ユーザーが実際に draft.pptx を直接開いて確認し、
明示的に承認するまで待つ。承認後は確認ステップなしで機械実行。

### 失敗 7 — draft 状態の pptx を 資料.pptx として昇格

対処: decks/ ディレクトリは Nuxt ポータルと Cloud Run bootstrap-ingest の一次
メタデータソース。Phase 4 で **ユーザーの明示承認**（「OK」「問題ない」等）を得る
までは draft を `decks/{slug}/draft/draft.pptx` に留める。
`decks/{slug}/資料.pptx` に昇格させるのは承認時点で `build-deck-package.js` が機械実行する瞬間のみ。

---

## まとめ

- **4 フェーズ構造** を絶対に守る（Phase 1-3 は必須、Phase 4 はユーザー承認 + 承認時の機械整形）
- **Phase 1 末尾で `decks/yyyy-mm-dd_{slug}/` を必ず作成**（R1-4）。Phase 2-4 はこの中で作業
- **Phase 2 で plan.html を `decks/{slug}/plan.html` にファイル直書きし、ユーザーの承認を待つ**
- **Phase 4 でユーザーが実際に draft.pptx を直接開いて確認し、明示的に承認するまで 資料.pptx 昇格は実行しない**
- **承認時点で `build-deck-package.js` を機械実行**（確認ステップは挟まない）
- **主張には必ずソースを添える** (web_search で都度裏取り)
- **承認された指示書に忠実に** Phase 3 を実装
