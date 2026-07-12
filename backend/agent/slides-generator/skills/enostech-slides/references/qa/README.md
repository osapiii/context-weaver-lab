# QA 体系

> **Phase 2 と Phase 4 で実行する QA を 1 ディレクトリに集約**。
> ペルソナレビュー (M2) が「主観・共感ベースの読者検証」なのに対し、
> ここの QA は「規約ベースの客観検証」を担当する。両者は補完関係。

---

## QA 結果の SSOT は `qa_report.json`

QA 実行結果は **`decks/{slug}/qa_report.json`** に書き出される。
plan.json は「設計指示書」、qa_report.json は「QA 実行結果」と責務が分離されている。

**スキーマ (抜粋)**:
```json
{
  "generated_at": "2026-04-29T01:30:00",
  "plan_path": "plan.json",
  "plan_sha256": "abc123...",     // plan.json (doc + sections) のハッシュ
  "phase_completed": ["phase2", "phase4"],
  "exit_codes": { "phase2": 0, "phase4": 0 },
  "total_violations": 0,
  "total_rules": 67,
  "layers": [ ... ]
}
```

**書き手・読み手**:
| 動作 | 書き手 | 読み手 |
|-----|-------|-------|
| 機械検証 (M / SchemaQA / WritingQA / SecQA-Auto / RefQA-Auto) | `run-qa.py` 経由で `validate_*` の結果を集約 | render-deck-instruction.py が読んで HTML 表示 |
| 手動 QA (SecQA-Manual / RefQA-Manual / VQA) | `run-manual-qa.py --apply` | 同上 |
| Phase 完了マーク | `run-qa.py` が `update_phase` で記録 | `build-deck-package.js` のゲートが検証 |

**Phase 4 ゲート**: `build-deck-package.js` は呼ばれた瞬間に `qa_report.json` の
存在 + `plan_sha256` 整合 + `phase_completed` に `phase2` / `phase4` 両方が入っていることを
検証する。失敗なら exit 2 で停止。これにより **QA をスキップして資料.pptx に昇格させる事故** を構造的に防ぐ。
バイパスは `--skip-qa-gate` フラグで明示 (デバッグ用、非推奨)。

`plan_sha256` は plan.json の `doc + sections` のハッシュ。plan.json が変わると
過去の `phase_completed` は自動でリセットされる (= QA 再実行が必須になる)。

---

## 起動経路は 1 本だけ — `scripts/run-qa.py`

個別スクリプト (`render-deck-instruction.py` / `run-manual-qa.py` /
`pptx-to-images.sh`) は内部実装として隠蔽されている。

```bash
# Phase 2 (機械検証 + 手動 QA 雛形書き出し)
python3 scripts/run-qa.py phase2 --plan decks/{slug}/plan.json [--bypass]
# 雛形を編集 (qa-self-report-phase2.md) してから:
python3 scripts/run-qa.py phase2 --plan decks/{slug}/plan.json --apply-manual

# Phase 4 (PNG 化 + VQA 雛形書き出し)
python3 scripts/run-qa.py phase4 --plan decks/{slug}/plan.json
# 雛形を編集 (qa-self-report-phase4.md) してから:
python3 scripts/run-qa.py phase4 --plan decks/{slug}/plan.json --apply-manual
```

Exit code:
- `0`: pass / `2`: 機械検証 fatal / `3`: 手動 QA 未記入 / `4`: 異常

---

## QA 層の全体像

```
┌──────────────────────── 機械検証 (自動) — render-deck-instruction.py 内 ────────────────────────┐
│                                                                                                  │
│  ① M (Schema MUST)        ② SchemaQA (テンプレ別必須/型)   ③ WritingQA (日本語規範)              │
│      ↓                       ↓                                ↓                                  │
│      validate_v39            schema-qa.py                     writing-qa.py                      │
│                                                                                                  │
│  ④ SecQA-Auto              ⑤ RefQA-Auto                                                          │
│      章扉直後 / LIST-1       ファクト主張パターン                                                 │
│      連続 / subsection       検出 (RefQA-02)                                                      │
│      ↓                       ↓                                                                   │
│      validate_secqa          validate_refqa_auto                                                 │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                            ↓ pass (exit 0)
┌──────────────────────── 手動検証 (Claude or 人間) — run-manual-qa.py ─────────────────────────────┐
│                                                                                                  │
│  ⑥ SecQA-Manual            ⑦ RefQA-Manual                                                        │
│      章タイトル整合 /        URL 粒度 / 一次情報優先 /                                            │
│      論理フロー /            表記ゆれ / 表示崩れ等                                                │
│      重複排除 / 固定枠                                                                            │
│                                                                                                  │
│  ⑧ SQA                     ⑨ VQA (Phase 4)                                                       │
│      ページ単位の規約        最終ビジュアル検査                                                   │
│      (横文字 / illustration  (はみ出し / 視認性 /                                                │
│      整合性等)               テーマ一貫性等)                                                     │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 各層の責務マップ

| 層 | 起動 | 書き手 | scope |
|------|------|--------|------|
| **M** | render 時自動 | `render-deck-instruction.py validate_v39` | M2/M3/M4/M5/M6/M8 のスキーマ MUST |
| **SchemaQA** | render 時自動 | `schema-qa.py` | テンプレ別必須/型 (SchemaQA-01〜15) |
| **WritingQA** | render 時自動 | `writing-qa.py` | 日本語規範 (WritingQA-01〜30) |
| **SecQA-Auto** | render 時自動 | `validate_secqa` | LIST-1 連続・比率 / 章 name サニティ |
| **RefQA-Auto** | render 時自動 | `validate_refqa_auto` | ファクト主張に対する参照付与 (RefQA-02) |
| **StructureQA** | render 時自動 | `validateDeckStructure` | デッキ全体構造 (StructureQA-00〜23) |
| **SecQA-Manual** | Phase 2 | Claude 手詰め | 章タイトル整合 / 論理フロー / 重複排除 |
| **RefQA-Manual** | Phase 2 + Phase 4 | `run-manual-qa.py phase2` | URL 粒度 / 一次情報 / 表記ゆれ / 表示崩れ |
| **SQA** | Phase 2 完了直前 | Claude 手詰め (slide-qa.md 走査) | ページ単位の規約 (横文字 / illustration 整合 等) |
| **VQA** | Phase 4 (draft.pptx 完成後) | `run-manual-qa.py phase4` | 最終ビジュアル検査 (VQA-01〜25) |

> 自動層は機械検証が**常に勝つ**。手動入力で上書きできない。
> 手動層はユーザー / Claude の手詰めが正本。`run-qa.py --apply-manual` で書き込まれる。

## 強制度マップ — どこまで踏まないと進めないか

| Phase | 機械的に止まる (`exit 2`) | 止まらないが踏まないと続けない (`exit 3`) |
|-------|------------------------|--------------------------------------|
| Phase 2 | M / SchemaQA / WritingQA / SecQA-Auto / RefQA-Auto / StructureQA | SecQA-Manual / RefQA-Manual / SQA |
| Phase 4 | (機械検証なし) | VQA |

---

## 実行フロー (Claude が Phase 2/4 で必ず通す)

実行は `scripts/run-qa.py` 1 本に集約されている。

### Phase 2 (plan.html 書き出し前)
```bash
python3 scripts/run-qa.py phase2 --plan decks/{slug}/plan.json [--bypass]
```
内部処理:
1. `render-deck-instruction.py` が機械検証層 (M / SchemaQA / WritingQA / SecQA-Auto / RefQA-Auto / StructureQA)
   を走らせ、結果を **qa_report.json** に書き出す
2. `--strict` (default ON) で fatal 違反があれば exit 2 で停止
3. plan.html を生成
4. `qa-self-report-phase2.md` 雛形を書き出し → ユーザー / Claude が編集
5. `--apply-manual` 付きで再実行 → SecQA-Manual / RefQA-Manual が qa_report.json に反映

### Phase 4 (draft.pptx 完成後)
```bash
python3 scripts/run-qa.py phase4 --plan decks/{slug}/plan.json
```
内部処理:
1. `pptx-to-images.sh` で PNG + コンタクトシート生成
2. `qa-self-report-phase4.md` 雛形を書き出し → ユーザー / Claude が編集 (VQA-01〜25)
3. `--apply-manual` 付きで再実行 → VQA 層が qa_report.json に反映

### Phase 4 → 資料.pptx 昇格 (build-deck-package.js)
qa_report.json の `phase_completed` に `["phase2", "phase4"]` が両方入り、かつ
`plan_sha256` が現在の plan.json と一致していなければゲートで停止する。
QA をスキップして昇格させる事故を物理的に防ぐ仕組み。

---

## ルール ID の命名規則

| プレフィクス | 対象 | 例 |
|---|---|---|
| `SQA-NN` | Slide QA（ページ単位） | `SQA-01: 1 スライド = 1 メッセージ` |
| `StructureQA-NN` | Deck Structure QA（デッキ全体構造） | `StructureQA-12: 章扉直後の見取り図必須` |
| `SchemaQA-NN` | Schema QA（テンプレ別 JSON 必須/型） | `SchemaQA-01: FRAMING-1 3 ブロック` |
| `WritingQA-NN` | Writing QA（日本語規範） | `WritingQA-01: サブコピー 60 字未満禁止` |
| `SecQA-NN` | Sections QA（章単位） | `SecQA-09a: LIST-1 連続禁止` |
| `RefQA-NN` | Reference QA（引用情報全体） | `RefQA-01: 引用 URL の最小粒度` |
| `VQA-NN` | Visual QA（最終ビジュアル） | `VQA-01: テキストのシェイプはみ出し` |

連番は **新規ルール追加時は末尾に追記**（既存番号は不変）。

---

## ペルソナレビュー（M2）との関係

| | ペルソナレビュー（M2） | QA |
|---|---|---|
| **検査軸** | 主観・共感ベース | 規約ベース・客観 |
| **検査者** | 架空の読者ペルソナ（2 サイクル × 1 人） | Claude が機械的にチェック |
| **見るもの** | 「自分ごと化できるか」「説得力があるか」 | 参照 URL の有無、章タイトル整合、はみ出し |
| **タイミング** | Phase 2 内で実施 | Phase 2 完了直前 + Phase 4 |

両者は補完関係で、どちらか一方では拾えないバグがある。
ペルソナレビューが「読者の気持ち」を、QA が「規約の遵守」を、それぞれ独立に担保する。

---

## ファイル一覧

| ファイル | 対象 |
|---|---|
| `svg-font-troubleshooting.md` | SVG → PNG レンダリングで日本語が脱字したときの 30 秒切り分け手順 |
| `schema-qa.md` | テンプレ別 JSON 必須/型 (SchemaQA-01〜15) |
| `writing-qa.md` | 日本語規範 (WritingQA-01〜30) |
| `structure-qa.md` | デッキ全体構造（Template 駆動、StructureQA-00〜23） |
| `sections-qa.md` | 章単位の構造検査 (SecQA-01〜10) |
| `reference-qa.md` | 引用情報全体 (RefQA-01〜13) |
| `slide-qa.md` | ページ単位の規約検査 (SQA-01〜15) |
| `visual-qa.md` | 最終ビジュアル検査 (VQA-01〜25) |

> **StructureQA は他層と何が違うか**: SchemaQA / SecQA / RefQA / WritingQA / VQA は
> **個別スライド or 章単位**で違反を拾う。一方 StructureQA は **デッキ全体を 1 つの Zod schema
> で検証**し、Template (例: `learning-deck`) という抽象を介して「序盤・章・末尾」の構造ルール
> を集中管理する。新ルール追加は Template 定義の書き換えだけで成立する。詳細は `structure-qa.md`。
