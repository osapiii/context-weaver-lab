#!/bin/bash
# ============================================================================
# pptx-to-images.sh — Phase 4 の Claude 自己 QA 用に pptx を PNG 群に変換
# ============================================================================
#
# 使い方:
#   ./pptx-to-images.sh <pptx> [<out_dir>] [<resolution>]
#
# 例:
#   ./pptx-to-images.sh <scratch>/deck.pptx
#     → /tmp/pptx-qa-<timestamp>/ に slide-1.png, slide-2.png, ... を出力
#
#   ./pptx-to-images.sh deck.pptx <scratch>/qa-imgs 120
#     → 指定ディレクトリに 120dpi で出力
#
# 出力:
#   - ${out_dir}/slide-1.png, slide-2.png, ... (連番 PNG)
#   - 標準出力に生成されたファイルパスを 1 行ずつ列挙
#
# 用途:
#   Claude が Phase 4 で pptx の全スライドを目視 QA する時に使う。
#   生成後、各 PNG を view ツールで確認し、レイアウト問題を検出する。
#
# 依存:
#   - LibreOffice (soffice) で pptx → pdf
#   - poppler-utils (pdftoppm) で pdf → png
# ============================================================================

set -e

PPTX="${1:?Usage: pptx-to-images.sh <pptx> [<out_dir>] [<resolution>]}"
OUT_DIR="${2:-/tmp/pptx-qa-$(date +%Y%m%d-%H%M%S)}"
RES="${3:-200}"  # v7.14.2: 200dpi (約 2000x1125) に引き上げ。チャート / 細かい文字が鮮明に判別できる

if [ ! -f "$PPTX" ]; then
  echo "ERROR: pptx file not found: $PPTX" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# LibreOffice のプロファイル競合を避けるため一意な tmpdir
LO_PROFILE="/tmp/lo-profile-qa-$$"
mkdir -p "$LO_PROFILE"

# 1. pptx → pdf
PDF_DIR="/tmp/pptx-qa-pdf-$$"
mkdir -p "$PDF_DIR"
soffice --headless --norestore --nologo --nofirststartwizard \
  -env:UserInstallation="file://$LO_PROFILE" \
  --convert-to pdf --outdir "$PDF_DIR" "$PPTX" > /dev/null 2>&1

# soffice の出力 pdf パスを特定
PPTX_BASENAME=$(basename "$PPTX" .pptx)
PDF="$PDF_DIR/${PPTX_BASENAME}.pdf"

if [ ! -f "$PDF" ]; then
  echo "ERROR: PDF conversion failed" >&2
  rm -rf "$LO_PROFILE" "$PDF_DIR"
  exit 1
fi

# 2. pdf → png (連番)
pdftoppm -r "$RES" "$PDF" "$OUT_DIR/slide" -png > /dev/null 2>&1

# 3. 生成ファイルを列挙
ls "$OUT_DIR"/slide-*.png | sort -V | while read f; do
  echo "$f"
done

# クリーンアップ
rm -rf "$LO_PROFILE" "$PDF_DIR"
