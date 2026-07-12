#!/usr/bin/env python3
"""
テンプレートプレビューの Base64 data URI を取得するヘルパー (v5.1)

Phase 2 で HTML 指示書を生成する時に、使用するテンプレIDを渡すと
Base64 埋め込み用 data URI を返す。

[v5.1 変更点]
  プレビューフォルダを 1 つに統合した。
  単一の高解像 (1000px) JPEG を `assets/template-previews/` に置き、
  Phase 2 指示書 Base64 埋め込み時はこのスクリプトが Pillow で
  ~160px 幅にオンデマンドリサイズして出力する。

  これにより:
    - ディスク上のソースは 1 種類だけ (CATALOG.html もこの 1 種類を直接使う)
    - Base64 のサイズは v3.9 と同等 (~2-3KB) を維持

使い方:

  # 単一テンプレ
  python scripts/get-template-preview.py LIST-1

  # 複数テンプレ (JSON 形式で出力)
  python scripts/get-template-preview.py SECTION-1 LIST-1 DIAG-09 --json

  # 元の高解像をそのまま欲しい場合 (CATALOG 用にスクリプトから呼ぶ等)
  python scripts/get-template-preview.py LIST-1 --hires

  # Python コードから直接利用
  from scripts.get_template_preview import get_preview
  uri = get_preview('LIST-1')                 # Base64 埋め込み用 (160px)
  uri = get_preview('LIST-1', hires=True)     # CATALOG 用 (1000px のまま)

テンプレID 命名規則:
  SECTION-1 〜 SECTION-6  : スライドテンプレート (scripts/render/templates/*.js 対応)
  DIAG-02 〜 DIAG-09 : ダイアグラム (scripts/render/diagrams/*.js 対応)

[依存]
  pip install Pillow --break-system-packages
"""

import base64
import io
import json
import sys
from pathlib import Path

# このスクリプトからの相対位置で template-previews を探す
SCRIPT_DIR = Path(__file__).parent.resolve()
PREVIEW_DIR = SCRIPT_DIR.parent / 'assets' / 'template-previews'

# Phase 2 指示書 Base64 埋め込み用の縮小幅と JPEG quality
# v3.9 で確立した「160px / q=40 で 2-3KB」を維持する
EMBED_WIDTH = 160
EMBED_QUALITY = 40


def _read_bytes_resized(path: Path) -> bytes:
    """高解像 JPEG を Pillow で 160px 幅にリサイズして返す。

    Pillow が無い環境では原寸そのままを返す (フォールバック)。
    instruction.html の Base64 がやや膨らむが致命的ではない。
    """
    raw = path.read_bytes()
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        sys.stderr.write(
            "[WARN] Pillow が未インストールです。Base64 埋め込みは原寸 (1000px) のままになります。\n"
            "       pip install Pillow --break-system-packages で導入を推奨。\n"
        )
        return raw

    with Image.open(io.BytesIO(raw)) as img:
        if img.mode != 'RGB':
            img = img.convert('RGB')
        if img.width <= EMBED_WIDTH:
            return raw
        ratio = EMBED_WIDTH / float(img.width)
        new_size = (EMBED_WIDTH, max(1, int(img.height * ratio)))
        img = img.resize(new_size, Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=EMBED_QUALITY, optimize=True)
        return buf.getvalue()


def get_preview(template_id: str, hires: bool = False) -> str | None:
    """
    テンプレID に対応する Base64 data URI を返す。
    見つからない場合は None。

    hires=True なら高解像をそのまま返す (CATALOG など用)。
    hires=False なら 160px に縮小して返す (Phase 2 指示書埋め込み用)。
    """
    path = PREVIEW_DIR / f'{template_id}.jpg'
    if not path.exists():
        return None
    data = path.read_bytes() if hires else _read_bytes_resized(path)
    b64 = base64.b64encode(data).decode('ascii')
    return f'data:image/jpeg;base64,{b64}'


def get_previews(template_ids, hires: bool = False):
    """複数のテンプレIDをまとめて解決"""
    return {tid: get_preview(tid, hires=hires) for tid in template_ids}


def main():
    args = sys.argv[1:]
    if not args or '--help' in args or '-h' in args:
        print(__doc__)
        sys.exit(0)

    want_json = '--json' in args
    want_hires = '--hires' in args
    ids = [a for a in args if not a.startswith('--')]

    if len(ids) == 1 and not want_json:
        uri = get_preview(ids[0], hires=want_hires)
        if uri is None:
            print(f'❌ テンプレ {ids[0]} のプレビューが見つかりません', file=sys.stderr)
            sys.exit(1)
        print(uri)
    else:
        result = get_previews(ids, hires=want_hires)
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
