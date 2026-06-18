#!/usr/bin/env python3
"""
fix-hyperlink-color.py — Strip the <ahyp:hlinkClr val="tx"/> override

PptxGenJS が hyperlink を出力するとき、<a:hlinkClick> の子に
Office 2018 拡張 <a:extLst><a:ext><ahyp:hlinkClr val="tx"/></a:ext></a:extLst>
が自動挿入される。これは PowerPoint に「リンク色は本文色 (tx) で表示せよ」と
指示するため、inlineRef ヘルパーで指定した青文字 #0563C1 が黒で塗りつぶされる。

このスクリプトは生成済み .pptx を unzip → 該当 extLst だけを除去 → 再 zip する。
冪等。複数回実行しても問題ない。

使い方:
    python3 scripts/fix-hyperlink-color.py path/to/deck.pptx [path/to/deck2.pptx ...]
"""

import os
import re
import shutil
import sys
import tempfile
import zipfile

# Office 2018 hlinkClr 拡張ブロック (a:hlinkClick の子として現れる extLst)
# 末尾 </a:hlinkClick> までを丸ごと取り、extLst を削除した上で </a:hlinkClick> を残す
HLINK_WITH_EXTLST = re.compile(
    r'(<a:hlinkClick[^>]*>)\s*'
    r'<a:extLst>\s*'
    r'<a:ext uri="\{A12FA001-AC4F-418D-AE19-62706E023703\}">\s*'
    r'<ahyp:hlinkClr[^>]*?/>\s*'
    r'</a:ext>\s*'
    r'</a:extLst>\s*'
    r'(</a:hlinkClick>)',
    re.DOTALL,
)


def fix_pptx(pptx_path: str) -> int:
    """Remove hlinkClr extension from all slide XML in pptx. Returns count of slides modified."""
    if not os.path.isfile(pptx_path):
        print(f"  ✗ Not found: {pptx_path}", file=sys.stderr)
        return -1

    modified_slides = 0
    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.pptx')
    os.close(tmp_fd)

    try:
        with zipfile.ZipFile(pptx_path, 'r') as zin:
            with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zout:
                for item in zin.infolist():
                    data = zin.read(item.filename)
                    if (item.filename.startswith('ppt/slides/slide')
                            and item.filename.endswith('.xml')):
                        text = data.decode('utf-8')
                        new_text, n = HLINK_WITH_EXTLST.subn(r'\1\2', text)
                        if n > 0:
                            modified_slides += 1
                            data = new_text.encode('utf-8')
                    zout.writestr(item, data)
        shutil.move(tmp_path, pptx_path)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise

    return modified_slides


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    total_modified = 0
    for pptx_path in sys.argv[1:]:
        n = fix_pptx(pptx_path)
        if n < 0:
            sys.exit(2)
        total_modified += n
        print(f"  ✓ {pptx_path}: stripped hlinkClr from {n} slide(s)")

    if total_modified == 0:
        print("  (no slides needed fixing)")


if __name__ == '__main__':
    main()
