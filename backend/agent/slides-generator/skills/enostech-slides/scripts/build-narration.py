#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build-narration.py — ENOSTECH Slides v9.20

pptx の各スライドの speaker notes を読んで、TTS / 動画化前提のナレーション台本
「ナレーション台本.md」を出力する。

旧 build-design-memo.py から改称。speaker notes の規範が
「4 行構造（テンプレ・狙い・1 メッセージ・設計メモ）」から
「ナレーション台本（そのまま読み上げ可能な日本語、80-250 字、ですます調）」
に変わったことに合わせて、出力先と整形方針も刷新した。

互換動作:
  - 新フォーマット (ナレーション台本) は本文として書き出す
  - 旧 4 行構造 で書かれたスライドは末尾の付録セクションに退避
  - 出力先のデフォルトファイル名は「ナレーション台本.md」
  - 旧名 build-design-memo.py から呼ばれた場合も同じ動作 (alias)

[CLI]
    python3 build-narration.py \\
        --pptx /path/to/資料.pptx \\
        --out  /path/to/ナレーション台本.md \\
        --deck-title "FactHub 紹介資料"
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import statistics
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def _extract_body_text(notes_root: ET.Element) -> str:
    """notesSlide XML から「Notes Placeholder」(type='body') のテキストだけを抽出。

    Slide Number Placeholder (type='sldNum') の <a:fld> ページ番号や、
    Slide Image Placeholder (type='sldImg') の付帯要素は無視する。
    """
    paragraphs: list[str] = []
    # 各 sp (Shape) を見て、placeholder type が 'body' のものだけ採用
    for sp in notes_root.iter(f"{{{NS['p']}}}sp"):
        ph = sp.find(f".//{{{NS['p']}}}ph")
        if ph is None:
            continue
        ph_type = ph.attrib.get("type", "")
        # 'body' 以外 (sldNum / sldImg / dt 等) は flush
        if ph_type and ph_type != "body":
            continue
        for para in sp.iter(f"{{{NS['a']}}}p"):
            # <a:t> のうち <a:fld> 配下のものは除外 (slide number 等)
            runs: list[str] = []
            for elem in para.iter():
                tag = elem.tag.split("}")[-1]
                if tag == "t":
                    # 親が fld (field) なら無視
                    # ET では parent 取得不可なので、別経路で fld を見つけてそこに入る
                    # → fld 配下の t は最初に collect しておく
                    pass
            # シンプル経路: fld 配下の t を集めて除外セットを作り、a:t 全体から差し引く
            fld_texts = set()
            for fld in para.iter(f"{{{NS['a']}}}fld"):
                for t in fld.iter(f"{{{NS['a']}}}t"):
                    fld_texts.add(id(t))
            for t in para.iter(f"{{{NS['a']}}}t"):
                if id(t) in fld_texts:
                    continue
                runs.append(t.text or "")
            line = "".join(runs)
            paragraphs.append(line)
    return "\n".join(paragraphs)


def read_speaker_notes(pptx_path: Path) -> list[str]:
    """各スライドのスピーカーノート全文を、スライド番号順のリストで返す。

    notesSlide XML の中で `<p:ph type="body">` (Notes Placeholder) のテキストだけを採る。
    `<p:ph type="sldNum">` (slide number field) は除外。
    """
    notes: dict[int, str] = {}
    with zipfile.ZipFile(pptx_path, "r") as z:
        slide_files = sorted(
            [n for n in z.namelist() if re.match(r"^ppt/slides/slide(\d+)\.xml$", n)],
            key=lambda n: int(re.search(r"slide(\d+)\.xml$", n).group(1)),
        )
        for slide_xml in slide_files:
            n = int(re.search(r"slide(\d+)\.xml$", slide_xml).group(1))
            rels_path = f"ppt/slides/_rels/slide{n}.xml.rels"
            note_xml = None
            if rels_path in z.namelist():
                rels_root = ET.fromstring(z.read(rels_path))
                for rel in rels_root.iter():
                    target = rel.attrib.get("Target", "")
                    if "notesSlide" in target:
                        note_xml = "ppt/" + target.replace("../", "")
                        break
            if note_xml and note_xml in z.namelist():
                root = ET.fromstring(z.read(note_xml))
                notes[n] = _extract_body_text(root)
            else:
                notes[n] = ""
    return [notes[k] for k in sorted(notes.keys())]


LEGACY_MARKERS = (
    re.compile(r"^\[テンプレ\]"),
    re.compile(r"^\[狙い\]"),
    re.compile(r"^\[1メッセージ\]"),
    re.compile(r"^\[設計メモ\]"),
)


def is_legacy_format(note: str) -> bool:
    """4 行構造マーカー を 2 個以上含めばレガシー扱い。"""
    if not note:
        return False
    hit = 0
    for line in note.splitlines():
        for pat in LEGACY_MARKERS:
            if pat.match(line.strip()):
                hit += 1
                break
    return hit >= 2


def md_escape_inline(s: str) -> str:
    """1 セル内に詰め込む時用: パイプ・改行を退避。"""
    return s.replace("|", "\\|").replace("\n", " / ")


def char_stats(narrations: list[str]) -> dict[str, int]:
    """ナレーション文字数の統計 (空ノート除外)。"""
    lens = [len(n.replace("\n", "")) for n in narrations if n and not is_legacy_format(n)]
    if not lens:
        return {"count": 0, "min": 0, "median": 0, "max": 0, "total": 0}
    return {
        "count": len(lens),
        "min": min(lens),
        "median": int(statistics.median(lens)),
        "max": max(lens),
        "total": sum(lens),
    }


def build_markdown(deck_title: str, notes: list[str]) -> str:
    today = dt.date.today().isoformat()

    new_format: list[tuple[int, str]] = []
    legacy_format: list[tuple[int, str]] = []
    empty_slides: list[int] = []

    for i, n in enumerate(notes, 1):
        if not n.strip():
            empty_slides.append(i)
        elif is_legacy_format(n):
            legacy_format.append((i, n))
        else:
            new_format.append((i, n))

    stats = char_stats(notes)

    lines: list[str] = []
    lines.append(f"# ナレーション台本 — {deck_title}")
    lines.append("")
    lines.append(f"- 生成日: {today}")
    lines.append(f"- スライド数: {len(notes)}")
    lines.append(
        f"- ナレーション台本あり: {len(new_format)} 枚 / "
        f"レガシー 4 行構造: {len(legacy_format)} 枚 / "
        f"ノート空: {len(empty_slides)} 枚"
    )
    if stats["count"]:
        lines.append(
            f"- 文字数 (ナレーション台本のみ): "
            f"min {stats['min']} / median {stats['median']} / max {stats['max']} / "
            f"total {stats['total']}"
        )
    lines.append("")
    lines.append(
        "v9.20 から speaker notes は **TTS / 動画化前提のナレーション台本** として書く。"
        "1 スライドあたり 80-250 字 (30-90 秒の読み上げ) を目安に、ですます調統一。"
        "視覚依存表現や `(N)` 引用マーカーは音声で読み上げない。"
    )
    lines.append("詳細は `references/phase3-build/README.md §R3-2` および "
                 "`references/qa/writing-qa.md §WritingQA-15〜18`。")
    lines.append("")

    # ── 本編: 新フォーマット (ナレーション台本) ──
    if new_format:
        lines.append("## ナレーション本文")
        lines.append("")
        for idx, narr in new_format:
            length = len(narr.replace("\n", ""))
            lines.append(f"### S{idx} ({length} 字)")
            lines.append("")
            for para in narr.split("\n"):
                if para.strip():
                    lines.append(para.strip())
                    lines.append("")
            if not narr.strip().endswith("\n"):
                lines.append("")

    # ── 集約ビュー (1 行 = 1 スライド) ──
    if new_format:
        lines.append("## 集約ビュー (スライド番号 + ナレーション)")
        lines.append("")
        lines.append("| # | 文字数 | ナレーション本文 |")
        lines.append("|---|--------|----------------|")
        for idx, narr in new_format:
            length = len(narr.replace("\n", ""))
            lines.append(f"| S{idx} | {length} | {md_escape_inline(narr)} |")
        lines.append("")

    # ── レガシー 4 行構造 ──
    if legacy_format:
        lines.append("## 付録: レガシー 4 行構造")
        lines.append("")
        lines.append(
            "の規範には沿っていません。デッキを再生成する際は "
            "`speaker_notes` フィールドにナレーション台本を書き直してください。"
        )
        lines.append("")
        for idx, raw in legacy_format:
            lines.append(f"### S{idx}")
            lines.append("")
            for line in raw.splitlines():
                if line.strip():
                    lines.append(f"- {line.strip()}")
            lines.append("")

    # ── ノート空のスライド ──
    if empty_slides:
        lines.append("## 付録: ノートが空のスライド")
        lines.append("")
        lines.append("以下のスライドは speaker notes が未記入です。"
                     "Phase 2 で `speaker_notes` を埋めてください。")
        lines.append("")
        lines.append(
            "対象: " + ", ".join(f"S{i}" for i in empty_slides)
        )
        lines.append("")

    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="ナレーション台本.md を pptx の speaker notes から組み立てる"
    )
    ap.add_argument("--pptx", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--deck-title", required=True)
    args = ap.parse_args()

    if not args.pptx.exists():
        print(f"[error] pptx not found: {args.pptx}", file=sys.stderr)
        return 1

    notes = read_speaker_notes(args.pptx)
    md = build_markdown(args.deck_title, notes)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(md, encoding="utf-8")
    print(f"[ok] wrote {args.out} ({len(notes)} slides)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
