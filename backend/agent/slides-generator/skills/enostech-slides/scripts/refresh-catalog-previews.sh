#!/bin/bash
# ============================================================================
# refresh-catalog-previews.sh — テンプレプレビュー画像を再生成 (v5.1)
# ============================================================================
#
# 目的:
#   assets/template-previews/ の高解像度 JPEG (1000px) を再生成する。
#   v5.1 で旧 template-previews-hires/ と統合済みのため、出力先は単一フォルダ。
#   Phase 2 指示書の Base64 埋め込みは scripts/get-template-preview.py が
#   ここから 160px にオンデマンドリサイズして使う (CATALOG.html は原寸を直接表示)。
#
# 処理の流れ:
#   1. scripts/render/build-catalog.js → deck-example-mono.pptx
#   2. (DIAG カテゴリは build-catalog.js に統合済み)
#   3. scripts/pptx-to-images.sh で PNG 化 (150dpi = 1500x844 相当)
#   4. ImageMagick (convert) で 1000px 幅の JPEG q=82 に圧縮
#   5. assets/template-previews/ に ENO-XX.jpg / DIAG-XX.jpg を配置 (上書き)
#
# 使い方:
#   cd skills/enostech-slides
#   bash scripts/refresh-catalog-previews.sh
#
#   その後、カタログを再生成:
#   node scripts/generate-catalog.js
#
# いつ走らせるか:
#   - テンプレの見た目 (scripts/render/templates/*.js / diagrams/*.js のコードや色) を
#     変更したとき
#   - 新しいテンプレ番号を追加したとき
#   - テーマの既定色を変えたとき（プレビューは mono テーマで撮るため）
#
# 依存:
#   - Node.js + pptxgenjs (スキルのルートで npm install 済みか、別 tmp に用意)
#   - LibreOffice (soffice)
#   - poppler-utils (pdftoppm)
#   - ImageMagick (convert)
# ============================================================================

set -e

SKILL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SKILL_ROOT"

# 作業ディレクトリ（一時）
WORK_DIR="/tmp/catalog-preview-gen-$$"
mkdir -p "$WORK_DIR/scripts"
trap "rm -rf $WORK_DIR" EXIT

echo "→ 作業ディレクトリ: $WORK_DIR"

# pptxgenjs が必要なので tmp に入れる（スキル自身は依存を持たない方針）
echo "→ pptxgenjs を一時インストール..."
cd "$WORK_DIR"
npm init -y > /dev/null 2>&1
npm install pptxgenjs > /dev/null 2>&1

# assets と scripts/render を丸ごとコピー (build-catalog.js は scripts/render/ 配下を参照する)
cp -r "$SKILL_ROOT/assets" "$WORK_DIR/assets"
cp -r "$SKILL_ROOT/scripts/render" "$WORK_DIR/scripts/render"

# 1. pptx 生成 (v6.38〜 の新方式: scripts/render/build-catalog.js)
echo "→ example-deck.pptx を生成 (build-catalog.js / mono テーマ)..."
cd "$WORK_DIR"
node scripts/render/build-catalog.js -o "$WORK_DIR/deck-example-mono.pptx"
echo "→ diagram-patterns.pptx は build-catalog.js でカバー済み (DIAG カテゴリ含む)"


# 出力名はテーマで分岐 (mono がデフォルト)
EXAMPLE_PPTX="$WORK_DIR/deck-example-mono.pptx"
[ -f "$EXAMPLE_PPTX" ] || EXAMPLE_PPTX="$WORK_DIR/deck-example-corporate.pptx"

# 2. PNG 化（150dpi = 1500x844）
echo "→ PNG 化..."
mkdir -p "$WORK_DIR/png-eno" "$WORK_DIR/png-diag"
bash "$SKILL_ROOT/scripts/pptx-to-images.sh" "$EXAMPLE_PPTX"                    "$WORK_DIR/png-eno"  150 > /dev/null
bash "$SKILL_ROOT/scripts/pptx-to-images.sh" "$WORK_DIR/diagram-patterns.pptx" "$WORK_DIR/png-diag" 150 > /dev/null

# 3. JPEG 圧縮 + 配置 (v5.1: 単一フォルダに上書き)
echo "→ JPEG 圧縮 (1000px, q=82)..."
PREVIEW_DIR="$SKILL_ROOT/assets/template-previews"
mkdir -p "$PREVIEW_DIR"

for f in "$WORK_DIR/png-eno"/slide-*.png; do
  num=$(basename "$f" .png | sed 's/slide-//')
  # slide-1 → 01, slide-10 → 10 （2 桁 0 詰め）。10#xx で 8 進数解釈を回避
  padded=$(printf "%02d" "$((10#$num))")
  convert "$f" -resize 1000x -quality 82 -strip "$PREVIEW_DIR/ENO-${padded}.jpg"
done

# v5.5: DIAG-01 廃止に伴い、ID 安定性のため slide-N (1-indexed) → DIAG-(N+1).jpg にマッピング
#   - slide-1 (サイクル図) → DIAG-02.jpg
#   - slide-8 (2軸プロット) → DIAG-09.jpg
#   - 旧 DIAG-01.jpg は削除して欠番化
rm -f "$PREVIEW_DIR/DIAG-01.jpg"
for f in "$WORK_DIR/png-diag"/slide-*.png; do
  num=$(basename "$f" .png | sed 's/slide-//')
  # 10#xx で 8 進数として解釈されるのを回避
  diag_num=$((10#$num + 1))
  padded=$(printf "%02d" "$diag_num")
  convert "$f" -resize 1000x -quality 82 -strip "$PREVIEW_DIR/DIAG-${padded}.jpg"
done

count=$(ls "$PREVIEW_DIR"/*.jpg | wc -l)
size=$(du -sh "$PREVIEW_DIR" | cut -f1)
echo "✓ 完了: $count 枚のプレビューを $PREVIEW_DIR に配置 (合計 $size)"
echo "  - Phase 2 指示書 Base64 埋め込み時は 160px にオンデマンドリサイズされます"
echo "  - CATALOG.html は原寸 (1000px) のまま表示されます"
echo ""
echo "次のコマンドでカタログを更新:"
echo "  node scripts/generate-catalog.js"
