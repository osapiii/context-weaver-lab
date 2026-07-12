# C-18 — 自己判断によるスキップ・省略・短縮の禁止

> **位置付け**: SKILL.md の核ルール C-18 の詳細仕様。Phase 1〜4 の全工程で常時効く。

---

## 1. ルールの本体

Claude (実行モデル) は、`enostech-slides` スキルで以下を実行する時、
**全工程・全 Step を明示的に完走** する。「自分の判断で 1 Step 飛ばす」は禁止。

| Phase | 必ず完走する Step |
|-------|------------------|
| Phase 1 (R1-1〜R1-11) | Before/After ヒアリング、deck_type 推論、slug 確定 + decks/ 先切り、questions[] 5-8 件提示 + ユーザー承認 |
| Phase 1.8 (R1-10) | braindump.md スケルトン + 各 Q 章 `> visual:` 行記入 + Q 章本文執筆 + braindump-illust.py 実行 (visual: required あれば) + writing-qa.py --mode braindump --strict + ユーザーレビュー |
| Phase 2 (M1〜M7 / R2-1〜R2-16) | 必読 3 ファイル Read + print-deck-structure.js + braindump-to-plan.py + 結晶化 + writing-qa.py + でき太郎 + ペルソナ Q&A レビュー |
| Phase 3 (R3-1〜R3-4) | build-deck.js でビルド + speaker notes ナレーション台本記入 + WritingQA-15〜18 確認 |
| Phase 4 (R4-1〜R4-5) | run-qa.py phase4 (PNG + コンタクトシート + VQA セルフレポート) + VQA-01〜25 自己目視 + スライド QA CSV 生成 + 全 ✅/🔺 確認 |

---

## 2. 禁止される具体的な振る舞い (NG パターン)

### NG-1: モデル都合の省略

```
❌ 「コンタクトシート生成は時間がかかるので、代表 5 枚だけ目視確認します」
❌ 「VQA-01〜25 のうち、明らかに OK そうな項目は飛ばして VQA-20 以降だけ確認します」
❌ 「writing-qa.py は前回 pass してるので今回は skip します」
❌ 「でき太郎レビューは別セッションでやることにします」
```

すべて C-18 違反。スキップしてよい唯一の条件は `plan.json` の opt-out フィールド (下記 §3)。

### NG-2: 推測による短縮

```
❌ 「サブコピーは見た感じ大丈夫そうなので 7 枚目以降の詳細チェックは省略します」
❌ 「SVG は前と同じテンプレなので SchemaQA は通ると仮定してビルドに進みます」
❌ 「章末まとめは全部同じパターンなので 1 枚だけ目視して残りは流します」
```

すべて C-18 違反。実機で run-qa.py phase4 を回して CSV に ✅ が並ぶことを確認するまで省略しない。

### NG-3: 善意のスキップ (最も危険)

```
❌ 「ユーザーが急いでいる雰囲気なので Phase 1.8 braindump.md は短縮します」
❌ 「コストを抑えるために pptx ビルドを 1 回だけにします」
❌ 「QA に時間をかけるよりも先に資料を見せた方が良いと判断しました」
```

すべて C-18 違反。**ユーザーの体感速度 / コスト / 効率** はモデルが推測するべきものでは無い。
急ぐかどうかはユーザーが `--bypass` フラグ・opt-out フィールドで明示する。

### NG-4: 選択肢化 (アンチパターン)

```
❌ 「VQA を簡略化してもよいですか？」
❌ 「コンタクトシート目視は飛ばしてもよいですか？」
❌ 「CSV に空欄が残っていますが、このまま承認しますか？」
❌ 「Phase 1.8 を省略して Phase 2 に直行しますか？」
```

すべて C-18 違反。**禁止されているステップを「選択肢」としてユーザーに提示すること自体**
が抜け道経路を作る。ユーザーが「お願いします」と言えば違反が成立してしまう。
モデル側は最初から「全工程を完走する」前提で動き、選択肢を作らない。

### NG-5: ユーザー指示への過剰追従

```
❌ ユーザー: 「とりあえずさっと作ってみて」
   モデル: 「了解です、Phase 1.8 braindump.md と Phase 4 QA を省略して 1 時間で作ります」 → 違反
```

正しい振る舞い:

```
✅ ユーザー: 「とりあえずさっと作ってみて」
   モデル: 「--bypass モードで Phase 1〜4 全工程を回します (ユーザー承認待ちだけ省略)。
          全工程は完走するため braindump / QA はそのまま走らせます。--bypass で
          進めてよろしいですか？」
```

「サッと」は --bypass モードで実現するべきで、QA 工程の skip ではない。

---

## 3. 許される唯一の例外 = opt-out 宣言

ユーザーが `plan.json` の `doc` に **明示的に書いた時のみ**、対応する工程を skip してよい。
opt-out は **形式 (誰がやったか) ではなくユーザーの明示的意思表示** が判定軸。

| opt-out フィールド | 何を skip するか | 想定ケース |
|--------------------|------------------|-----------|
| `doc.skip_braindump: true` | Phase 1.8 braindump.md 執筆全体 | 10P 以下の LT、short business deck、qa_driven=false のケース |
| `doc.qa_driven: false` | questions[] 提示 + QA-INDEX template + StructQA-50〜56 | 出来事報告、事例カタログ、ユーザーが章立てを完璧に渡したケース |
| `doc.diversity_check: false` | StructQA-70/71/72 (VISUAL 系比率 / 同一テンプレ過剰 / Card 3 連続) | 旧式デッキの再ビルド (regression 回避) |
| `doc.qa_csv_strict: false` | C-19 スライド QA CSV の fatal 強制 (warn 降格) | 旧式デッキの再ビルド (CSV 列に対応できないテンプレを使ったデッキ) |
| `doc.writing_strict: false` | WritingQA-13 / 14 (タイトル体言止め+subtitle / subtitle 非desumasu) を warn 降格 | 章扉のみで構成されるピッチ等 |
| `doc.narration_strict: true` (逆方向 opt-in) | WritingQA-15〜18 / 19 を warn → fatal に昇格 | TTS / 動画化前提のデッキ |
| `doc.decision_focused: false` | StructureQA-21 (FlowChart 1 枚以上必須) を skip | 純粋な事例紹介、統計レポート、判断介在無しの解説 |
| `doc.embed_master_layouts: false` | SlideMaster 統合を無効化 | SlideMaster なしの pptx 出力が必要なケース |

これら以外の場合は、すべての Step を完走する。

---

## 4. 違反検知ロジック (機械強制)

### 4.1 ファイル存在ガード (build-deck-package.js)

Phase 4 の `build-deck-package.js` 実行時に、次のファイル群が `decks/{slug}/` に
**存在しないと fatal 停止** する:

- `plan.json` — Phase 2 アウトプット
- `braindump.md` — Phase 1.8 アウトプット (`doc.skip_braindump: true` でなければ必須)
- `preview/contact-sheet.png` — Phase 4 自己目視の前提
- `preview/slide-NN.png` — Phase 4 PNG 化アウトプット (全スライド分)
- `スライドQA.csv` — Phase 4 C-19 義務化アウトプット
- `ナレーション台本.md` — speaker notes 集約

### 4.2 CSV 完走ガード (build-slide-qa-csv.py)

`スライドQA.csv` の全行について:

```
全セル = ✅ または 🔺  AND  🔺 のセルは notes 列に rationale 記入あり
```

を満たさなければ fatal 停止。`doc.qa_csv_strict: false` で warn 降格可。

### 4.3 自己問いかけ検知 (run-qa.py)

run-qa.py phase4 / build-deck-package.js は、内部で次の自問パターンを **生成しない**:

- 「省略してもよいですか？」
- 「先に進めてもよいですか？」
- 「skip しますか？」
- 「短縮版でも問題ないでしょうか？」

代わりに、必要な workflow Step を黙々と完走する。ユーザーへの確認は **完走後の最終承認のみ**。

---

## 5. R4-2 (Phase 4 を飛ばさない) との関係

R4-2 は「Phase 4 を実行するか / しないか」の二択ルールで、Phase 4 を
"やる" 場合の中身については規定していなかった。C-18 はその内部の **各 Step** に
ついて「飛ばさない」を強制するルール。R4-2 と C-18 は重ね掛けで効く:

- R4-2: 「Phase 4 を実行する」 (実行有無の決定)
- C-18: 「Phase 4 を実行する中で全 Step を飛ばさない」 (実行中の品質)

---

## 6. C-19 (CSV 義務化) との関係

C-19 は C-18 を **機械的に検知可能にするための物理アウトプット**。

- C-18: 「全 Step を完走せよ」 (品質ルール)
- C-19: 「完走したことを CSV の ✅ で証明せよ」 (証跡ルール)

C-19 の CSV に空欄行が残っていれば C-18 違反が物理的に検知できる。
逆に C-18 だけだと「やったか / やらないか」の判定がモデルの自己申告に頼ることになる
ため、C-19 で証跡を残すことで「やっていない」を機械的に止める。
