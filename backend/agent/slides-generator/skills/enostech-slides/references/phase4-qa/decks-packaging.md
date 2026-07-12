> Phase 4 でユーザー承認された `decks/{slug}/draft/draft.pptx` を起点に、
> Phase 1 R1-4 で先切り済みの `decks/yyyy-mm-dd_{slug}/` 配下を整える。
> 機械実行で確認ステップを挟まない、固定パイプライン。
>
> 役割は「既存ディレクトリの最終整形」: draft/draft.pptx → 資料.pptx 昇格、
> plan.html 定置確認、preview/ 整え、生成メモ.md 集約。
> 冪等 (再実行で全ステップ no-op)。`--plan` 必須で plan.html 欠落エントリの作成を防ぐ。

---

## 1. 出力するもの (メインルート、唯一の出し方)

```
decks/yyyy-mm-dd_{slug}/
├── 資料.pptx          ← デッキ本体 (Phase 4 で承認された pptx)
├── plan.html          ← Phase 2 アウトプット (HTML 指示書のコピー)
├── 生成メモ.md        ← speaker notes 4 行構造を markdown 表に集約
└── preview/
    ├── slide-01.png 〜 slide-NN.png   ← LibreOffice / pdftoppm で生成
    └── contact-sheet.png              ← ImageMagick montage で生成
```

エディトリアルシートに配布形態の記載があっても無視する。配布形態の動的選択は持たない。

---

## 2. 実行コマンド

```bash
DECK_DIR="decks/<yyyy-mm-dd>_<slug>"            # Phase 1 R1-4 で作成済み

node /mnt/skills/user/enostech-slides/scripts/build-deck-package.js \
  --pptx          "${DECK_DIR}/draft/draft.pptx"          \
  --slug          facthub-intro                            \
  --title         "FactHub 紹介資料"                       \
  --plan          "${DECK_DIR}/plan.html"                  \
  [--skip-plan] \
  [--project-root <Cowork プロジェクトの絶対パス>] \
  [--preview-dir  "${DECK_DIR}/preview"]                   \
  [--contact-sheet "${DECK_DIR}/preview/contact-sheet.png"]
```

| flag | 必須 | 役割 |
|---|---|---|
| `--pptx` | ✅ | Phase 4 で承認された pptx |
| `--slug` | ✅ | ディレクトリ名のサフィックス。`^[a-z0-9-]+$` |
| `--title` | ✅ | 生成メモ.md のタイトル行に使う |
| `--skip-plan` | — | `--plan` を意図的に省く例外フラグ。過去デッキの再パッケージ等、指示書が紛失している時のみ使う |
| `--project-root` | — | 省略時は環境変数 `ENOSTECH_PROJECT_ROOT` → cwd から CLAUDE.md を遡って自動検出 |
| `--preview-dir` | — | 既に Phase 4 で生成済みの PNG ディレクトリ。再生成を省略できる |
| `--contact-sheet` | — | 同上。コンタクトシートのキャッシュを使う |

> 🔴 **`--plan` を渡し忘れた時の挙動**: スクリプトは「`--plan` は必須です」
> エラーで即停止する。エラーメッセージに `render-deck-instruction.py` の使い方も
> 含まれているので、Phase 2 で生成した JSON データから HTML を再生成してリトライする。
> decks/ エントリが複数生まれる事故への恒久対策。

---

## 3. トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `--plan は必須です` | build-deck-package.js 呼び出しに `--plan` を渡していない | Phase 2 で生成した HTML 指示書のパスを `--plan <path>/01-design.html` で渡す。HTML が無い場合は `python3 render-deck-instruction.py --input <json> --output <html>` で再生成 |
| `--plan で指定されたファイルが存在しません` | パス間違い or HTML がまだ生成されていない | パスを確認し、必要なら `render-deck-instruction.py` で再生成してからリトライ |
| `pptx-to-images.sh が失敗しました` | `soffice` が無い / プロファイルが排他 | `which soffice` で確認。Stage 3 を順次実行に保つ |
| `contact-sheet.png が生成されない` | `montage` (ImageMagick) が無い | `apt install imagemagick` or 手動で `montage` を叩く |
| `decks/yyyy-mm-dd_{slug}/ が見つからない` | `--project-root` が解決できていない | `--project-root` を明示するか `ENOSTECH_PROJECT_ROOT` 環境変数を設定 |

---

## 4. 関連ファイル

- `scripts/build-deck-package.js` — 本ドキュメントが記述する一次エントリ
- `scripts/pptx-to-images.sh` — preview PNG 生成
- `references/qa/visual-qa.md` — Phase 4 自己 QA の判定基準 (VQA-01〜12)
- `references/phase4-qa/README.md` — Phase 4 全体ガイド (R4-1〜R4-3、本ファイルへの導線元)
- `references/_common/parallel-execution.md` — montage コマンドの詳細
