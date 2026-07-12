# 並行実行ガイド — ツールコール削減

> **全モード共通**。バイパスモード・通常フロー問わず、このガイドに沿って各フェーズのツールコールを削減する。

---

## なぜ並行化が必要か

enostech-slides は 1 ターンで多くのファイル読み込み・画像確認・スクリプト実行を行うため、Claude のターンあたりツールコール上限に到達しやすい。各フェーズで「1 ツール = 1 ファイル」の逐次実行を続けると、15 枚以上のデッキでは必ず上限を超える。

**ツールコール消費の大きい順（実測）**:

| フェーズ | 逐次実行時 | 並行最適化後 | 削減 |
|---------|-----------|------------|------|
| Phase 4 PNG目視（15枚デッキ） | 15+ view | 2〜3 view | **-12 以上** |
| Phase 3 参照ファイル読み込み | 5〜7 view | 1 bash | **-4〜6** |
| Phase 2 プレビュー画像取得 | N × python | 1 bash (--json) | **-3〜5** |

---

## Phase 2 — プレビュー画像の一括取得

### ❌ やってはいけない（逐次）

```bash
python scripts/get-template-preview.py LIST-1
python scripts/get-template-preview.py LIST-3
python scripts/get-template-preview.py PROJECT-1
```

### ✅ 正しい（一括）

```bash
# 全テンプレを1回の bash で JSON として取得
python /mnt/skills/user/enostech-slides/scripts/get-template-preview.py \
  SECTION-1 LIST-1 LIST-3 PROJECT-1 SR --json
```

`--json` フラグを使うと `{ "LIST-1": "data:image/jpeg;base64,...", ... }` 形式で返ってくるため、
HTML 指示書への埋め込みも 1 回のパースで完了する。

**ルール**: Phase 2 でプレビュー画像を取得する際は、**必ず** `--json` フラグを使い、全テンプレを 1 コマンドにまとめること。

---

## Phase 3 — 参照ファイルの一括読み込み

### ❌ やってはいけない（逐次）

```
view(tokens.js)            ← 1 ツールコール
view(slide-patterns.md)    ← 2 ツールコール
view(example-deck.js)      ← 3 ツールコール
view(diagram-patterns.md)  ← 4 ツールコール（ダイアグラムあり）
view(diagram-patterns.js)  ← 5 ツールコール（ダイアグラムあり）
```

### ✅ 正しい（一括 bash）

ダイアグラムなしの場合（3 → 1 ツールコール）:

```bash
echo "=== tokens.js ===" && \
cat /mnt/skills/user/enostech-slides/assets/tokens.js && \
echo "=== slide-patterns.md ===" && \
cat /mnt/skills/user/enostech-slides/references/_common/slide-patterns.md && \
echo "=== example-deck.js ===" && \
cat /mnt/skills/user/enostech-slides/scripts/example-deck.js
```

ダイアグラムありの場合（5 → 1 ツールコール）:

```bash
echo "=== tokens.js ===" && \
cat /mnt/skills/user/enostech-slides/assets/tokens.js && \
echo "=== slide-patterns.md ===" && \
cat /mnt/skills/user/enostech-slides/references/_common/slide-patterns.md && \
echo "=== example-deck.js ===" && \
cat /mnt/skills/user/enostech-slides/scripts/example-deck.js && \
echo "=== diagram-patterns.md ===" && \
cat /mnt/skills/user/enostech-slides/references/_common/diagram-patterns.md && \
echo "=== diagram-patterns.js ===" && \
cat /mnt/skills/user/enostech-slides/scripts/diagram-patterns.js
```

**ルール**: Phase 3 に入ったら、必要な参照ファイル一覧を確定してから **1 回の bash** でまとめて読む。ファイルを 1 枚ずつ `view` で読まない。

---

## Phase 4 — PNG 目視 QA のコンタクトシート方式

Phase 4 の最大の問題は「スライド 1 枚 = 1 `view` コール」で、15 枚デッキなら 15 コールが飛ぶこと。
**コンタクトシート（全スライドを 1 枚に合成）** を使うと、初回スキャンが 1 コールで済む。

### 実行手順

**Step 1: pptx → PNG 変換**

```bash
DECK_DIR="decks/<yyyy-mm-dd>_<slug>"
bash /mnt/skills/user/enostech-slides/scripts/pptx-to-images.sh \
  "${DECK_DIR}/draft/draft.pptx" \
  "${DECK_DIR}/preview"
```

**Step 2: コンタクトシートを生成（1 bash）**

```bash
# ImageMagick の montage で全スライドを格子状に合成
# 4列レイアウト、各サムネイル幅360px
SLIDE_COUNT=$(ls "${DECK_DIR}/preview/slide-"*.png 2>/dev/null | wc -l)
COLS=4
montage "${DECK_DIR}/preview/slide-"*.png \
  -geometry 360x203+3+3 \
  -tile ${COLS}x \
  -background "#f0f0f0" \
  -border 1 -bordercolor "#cccccc" \
  "${DECK_DIR}/preview/contact-sheet.png" && \
echo "コンタクトシート生成完了: ${SLIDE_COUNT}枚 → ${DECK_DIR}/preview/contact-sheet.png"
```

**Step 3: コンタクトシートを 1 回 view（1 view コール）**

```
view ${DECK_DIR}/preview/contact-sheet.png
```

コンタクトシートで以下を確認：
- 明らかにテキストが詰まっている or はみ出しているスライド
- レイアウトが他スライドと大きく異なるスライド
- 色帯・背景の異常

**Step 4: 問題スライドのみ個別 view（0〜3 view コール）**

コンタクトシートで怪しいスライドを特定し、そのスライドのみ個別に拡大確認する。

```
view ${DECK_DIR}/preview/slide-7.png    ← 怪しかったスライドのみ
view ${DECK_DIR}/preview/slide-12.png
```

### コール数の比較

| デッキ枚数 | 逐次方式 | コンタクトシート方式 |
|-----------|---------|------------------|
| 10 枚 | 10 view | 1 bash + 1 view + 0〜2 view = **2〜3** |
| 15 枚 | 15 view | 1 bash + 1 view + 0〜3 view = **2〜4** |
| 20 枚 | 20 view | 1 bash + 1 view + 0〜3 view = **2〜4** |

### montage が使えない場合のフォールバック

LibreOffice 変換環境によっては ImageMagick が無い場合がある。その場合は Python で代替：

```bash
python3 - << 'PYEOF'
from PIL import Image
import glob, math, os

deck_dir = os.environ.get("DECK_DIR", ".")  # 呼び出し前に export DECK_DIR=...
slides = sorted(glob.glob(f"{deck_dir}/preview/slide-*.png"))
if not slides:
    print("PNG が見つかりません"); exit(1)

cols = 4
rows = math.ceil(len(slides) / cols)
thumb_w, thumb_h = 360, 203
gap = 4

canvas = Image.new("RGB", (cols*(thumb_w+gap)+gap, rows*(thumb_h+gap)+gap), (240,240,240))

for i, path in enumerate(slides):
    img = Image.open(path).convert("RGB")
    img.thumbnail((thumb_w, thumb_h), Image.LANCZOS)
    x = gap + (i % cols) * (thumb_w + gap)
    y = gap + (i // cols) * (thumb_h + gap)
    canvas.paste(img, (x, y))

out = f"{deck_dir}/preview/contact-sheet.png"
canvas.save(out)
print(f"完了: {len(slides)}枚 → {out}")
PYEOF
```

---

## Phase 1 — web_search のバッチ化

複数の事実確認が必要な場合、同じ assistant ターン内で複数の web_search を連続して実行することで、往復のラウンドトリップを減らせる。

```
# ❌ 別ターンで確認（非効率）
Turn A: web_search "IPA DX 動向 2024"
Turn B: web_search "FactHub 競合比較"

# ✅ 同一ターンで連続実行（効率的）
web_search "IPA DX 動向 2024"  → 確認
web_search "FactHub 競合比較"  → 確認
→ 両方の結果をまとめて Phase 2 の材料にする
```

---

## チェックリスト — フェーズ開始時の確認

### Phase 2 開始時
- [ ] プレビュー取得は `--json` フラグで全テンプレ一括取得しているか

### Phase 3 開始時
- [ ] ダイアグラムの有無を確認し、必要な参照ファイルリストを確定した
- [ ] 参照ファイルは 1 回の bash でまとめて読んでいるか（複数回の `view` を使っていないか）

### Phase 4 開始時
- [ ] コンタクトシートを生成してから `view` しているか
- [ ] 個別 `view` はコンタクトシートで怪しかったスライドのみに絞っているか

---

## 関連ファイル

- `references/_common/workflow.md` — フェーズの実行手順
- `references/qa/visual-qa.md` — Phase 4 の目視 QA チェックリスト（判断基準）
- `references/_common/bypass-mode.md` — バイパスモード（並行実行の効果が最大になる）
- `scripts/pptx-to-images.sh` — PNG 変換スクリプト
