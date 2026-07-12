### R4-4 Phase 4 QA 工程の自己判断スキップ・省略・短縮を禁止 (C-18)

`scripts/pptx-to-images.sh` のコンタクトシート生成、`run-qa.py phase4` の VQA セルフレポート、
`scripts/run-pawapo-dekitaro-qa.js` (でき太郎)、`scripts/writing-qa.py --strict`、VQA-01〜25
の各項目チェック — これらの **どれか 1 つでも**「時間がない」「もう良さそう」「ユーザーが急いでいる」
等のモデル都合で省略・短縮・skip することを禁止。

**「省略してもよいですか?」「先に進めてもよいですか?」とユーザーに選択肢として提示すること自体も禁止**。
禁止ルールを選択肢化するとユーザーが「OK」と言えば抜け道経路が成立してしまう。モデル側は最初から
「全工程完走」を前提に動き、選択肢を作らない。詳細・NG パターン・opt-out 一覧は
`references/_common/no-self-skip.md` を参照。

opt-out が許される唯一の条件: `plan.json` の `doc.qa_csv_strict: false` / `doc.diversity_check: false`
等が **明示的に書かれている時のみ**。判定軸は「ユーザーの明示的意思表示」であって、モデルの推測ではない。

### R4-5 スライド単位 QA CSV (`スライドQA.csv`) の生成義務 (C-19)

Phase 4 ユーザー承認時に走る `build-deck-package.js` `[6/6]` ステップが
`decks/{slug}/スライドQA.csv` を **必ず生成** する。固定 10 列フォーマット
(`slide / template / SchemaQA / StructQA / WritingQA / ReferenceQA / VisualQA / ja-writing / SVG / notes`)、
1 行 = 1 スライド、**パス = ✅ / 未パス = 空欄 / 妥協 = 🔺 + notes に rationale 必須**。

全行 ✅ または 🔺(+notes) でなければ `build-deck-package.js` が **fatal 停止** し承認を通さない。
空欄行が残った状態でモデルが「先に進めてもよいですか?」と聞くことも禁止 (R4-4 と同じ理由)。

ユーザー判断で妥協するセルは `--apply-manual <path>` で `{slide, col, value:"🔺", note:"..."}` を渡し、
🔺 と notes に rationale を入れる。

実装は `scripts/build-slide-qa-csv.py`、統合は `scripts/build-deck-package.js` の `[6/6]` ステップ。
詳細は `references/_common/no-self-skip.md` §4 (違反検知ロジック)。

## Phase 4 で参照する _common/ 系

- `_common/parallel-execution.md` — コンタクトシート方式 (`montage` で 1 枚に集約 → `view` 1 回で全体俯瞰)

## 鉄則

- **「全スライドを通読してください」とユーザーに丸投げしない**
- バイパスモードの自動修正リトライは最大 2 回まで。残存問題は完了レポートに必ず記載
- **承認 = 配置の機械実行**。承認後に「decks/ に置いていい?」と再度聞かない
- `--plan` 必須は維持 (plan.html が欠落した decks/ エントリを作らない)
