#!/usr/bin/env python3
"""
braindump-to-md.py (v12.0)
==========================
braindump.json (v12 SSOT) → braindump.md (人間レビュー用 view) を生成する。

設計:
- 入出力共に UTF-8 / LF
- 同一 JSON から複数回実行しても byte-identical な MD を吐く (idempotent)
- 本文中の `[N]` は References table の URL を引いて `[[N]](url)` 形式に linkify
- 末尾 newline を必ず付与

依存:
  なし (Python 3 stdlib のみ)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

AUTO_HEADER = '<!-- AUTO-GENERATED from braindump.json by braindump-to-md.py. Edit braindump.json instead. -->'

INLINE_REF_RE = re.compile(r'\[(\d+)\]')


# ─────────────────────────────
# Linkify helper
# ─────────────────────────────

def linkify_refs(text: str, ref_url_map: Dict[int, str]) -> str:
    def repl(m):
        n = int(m.group(1))
        url = ref_url_map.get(n)
        if url:
            return f'[[{n}]]({url})'
        return m.group(0)
    return INLINE_REF_RE.sub(repl, text)


# ─────────────────────────────
# Block renderers
# ─────────────────────────────

def render_para(block: Dict[str, Any], ref_url_map) -> str:
    return linkify_refs(block.get('text', ''), ref_url_map)


def render_heading(block: Dict[str, Any], ref_url_map) -> str:
    level = int(block.get('level') or 3)
    return f'{"#" * level} {linkify_refs(block.get("text", ""), ref_url_map)}'


def _escape_cell(s: str) -> str:
    """Markdown table cell escape — `|` and newlines"""
    if s is None:
        return ''
    s = str(s)
    return s.replace('\\', '\\\\').replace('|', '\\|').replace('\n', ' ')


def render_table(block: Dict[str, Any], ref_url_map) -> str:
    out: List[str] = []
    if block.get('caption'):
        out.append(f'**{block["caption"]}**')
        out.append('')
    headers = block.get('headers') or []
    rows = block.get('rows') or []
    if headers:
        out.append('| ' + ' | '.join(_escape_cell(linkify_refs(h, ref_url_map)) for h in headers) + ' |')
        out.append('|' + '|'.join(['---'] * len(headers)) + '|')
    for row in rows:
        out.append('| ' + ' | '.join(_escape_cell(linkify_refs(c, ref_url_map)) for c in row) + ' |')
    return '\n'.join(out)


def render_list(block: Dict[str, Any], ref_url_map) -> str:
    ordered = bool(block.get('ordered'))
    items = block.get('items') or []
    lines: List[str] = []
    for i, it in enumerate(items, 1):
        prefix = f'{i}.' if ordered else '-'
        lines.append(f'{prefix} {linkify_refs(it, ref_url_map)}')
    return '\n'.join(lines)


def render_code(block: Dict[str, Any], ref_url_map) -> str:
    lang = block.get('lang') or ''
    text = block.get('text', '')
    return f'```{lang}\n{text}\n```'


def render_quote(block: Dict[str, Any], ref_url_map) -> str:
    text = linkify_refs(block.get('text', ''), ref_url_map)
    return '\n'.join('> ' + ln if ln else '>' for ln in text.split('\n'))


def render_block(block: Dict[str, Any], ref_url_map) -> str:
    t = block.get('type')
    if t == 'para':
        return render_para(block, ref_url_map)
    if t == 'heading':
        return render_heading(block, ref_url_map)
    if t == 'table':
        return render_table(block, ref_url_map)
    if t == 'list':
        return render_list(block, ref_url_map)
    if t == 'code':
        return render_code(block, ref_url_map)
    if t == 'quote':
        return render_quote(block, ref_url_map)
    return ''


# ─────────────────────────────
# YAML frontmatter writer (minimal)
# ─────────────────────────────

def _yaml_str(v: Any) -> str:
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if v is None:
        return ''
    s = str(v)
    # If contains characters that need quoting, wrap in double quotes
    if any(c in s for c in [':', '#', '"', "'", '\n', '*', '&', '!', '%', '@', '`', '|', '>', '<']) or s.strip() != s:
        return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'
    return s


def render_frontmatter(deck: Dict[str, Any]) -> str:
    keys_in_order = [
        ('slug', 'slug'),
        ('title', 'title'),
        ('deck_type', 'deck_type'),
        ('deck_structure', 'deck_structure'),
        ('deck_mode', 'deck_mode'),
        ('qa_driven', 'qa_driven'),
        ('target_reader', 'target_reader'),
        ('date', 'date'),
    ]
    lines: List[str] = ['---']
    for key, src in keys_in_order:
        if src in deck and deck[src] is not None and deck[src] != '':
            lines.append(f'{key}: {_yaml_str(deck[src])}')
    lines.append('---')
    return '\n'.join(lines)


# ─────────────────────────────
# Sections
# ─────────────────────────────

def render_references(references: List[Dict[str, Any]]) -> str:
    if not references:
        return '## 0. References\n\n_(references 未登録)_'
    out: List[str] = ['## 0. References', '']
    out.append('| # | タイトル | URL | 媒体 | 取得日 |')
    out.append('|---|---|---|---|---|')
    for r in references:
        n = r.get('n')
        url = r.get('url') or ''
        title = (r.get('title') or '').replace('|', '\\|')
        medium = (r.get('medium') or '').replace('|', '\\|')
        retrieved = (r.get('retrieved_at') or '').replace('|', '\\|')
        out.append(f'| [{n}] | {title} | {url} | {medium} | {retrieved} |')
    return '\n'.join(out)


def render_qa_index(questions: List[Dict[str, Any]], answers: List[Dict[str, Any]]) -> str:
    out: List[str] = ['## 1. 解決したい疑問・懸念', '']
    out.append('| Q# | 疑問・懸念 | 答え (40-80字) | 該当章 |')
    out.append('|---|---|---|---|')
    qid_to_chapter_idx: Dict[str, int] = {}
    for i, a in enumerate(answers):
        qid_to_chapter_idx[a['question_id']] = i + 2  # references=0, qa_index=1, so chapters start at 2
    for q in questions:
        qid = q['id']
        text = (q.get('text') or '').replace('|', '\\|')
        short = (q.get('answer_short') or '').replace('|', '\\|')
        ch_idx = qid_to_chapter_idx.get(qid)
        ch_label = f'第 {ch_idx} 章' if ch_idx is not None else ''
        out.append(f'| {qid} | {text} | {short} | {ch_label} |')
    return '\n'.join(out)


def render_answer(answer: Dict[str, Any], question: Optional[Dict[str, Any]], chapter_num: int,
                   ref_url_map: Dict[int, str]) -> str:
    section_title = answer.get('section_title') or (question.get('text') if question else '') or ''
    qid = answer['question_id']
    head = f'## {chapter_num}. {section_title} ({qid})' if section_title else f'## {chapter_num}. {qid}'
    out: List[str] = [head, '']
    visual = answer.get('visual') or 'none'
    out.append(f'> visual: {visual}')
    related = (question.get('related_refs') if question else []) or []
    if related:
        related_str = ' '.join(f'[{n}]' for n in sorted(related))
        out.append(f'> 関連 references: {related_str}')
    if answer.get('visual_kind'):
        out.append(f'> visual_kind: {answer["visual_kind"]}')
    if answer.get('visual_caption'):
        out.append(f'> visual_caption: {answer["visual_caption"]}')
    out.append('')

    blocks = answer.get('blocks') or []
    # Insert visual image after the first block if visual=required and path exists
    inserted_visual = False

    def emit_image() -> List[str]:
        alt = answer.get('visual_alt') or '図解'
        path = answer.get('visual_path') or ''
        if not path:
            return []
        return [
            '<!-- BRAINDUMP_ILLUST_AUTO -->',
            f'![{alt}]({path})',
            '<!-- /BRAINDUMP_ILLUST_AUTO -->',
        ]

    for i, b in enumerate(blocks):
        rendered = render_block(b, ref_url_map)
        if rendered:
            out.append(rendered)
            out.append('')
        # After the first block, if visual=required and visual_path present, insert AUTO block
        if not inserted_visual and visual == 'required' and answer.get('visual_path'):
            out.extend(emit_image())
            out.append('')
            inserted_visual = True

    # If we never inserted the image (e.g., no blocks), still emit it
    if not inserted_visual and visual == 'required' and answer.get('visual_path'):
        out.extend(emit_image())
        out.append('')

    # trim trailing blank
    while out and out[-1] == '':
        out.pop()
    return '\n'.join(out)


# ─────────────────────────────
# Top-level
# ─────────────────────────────

def build_md(data: Dict[str, Any]) -> str:
    deck = data.get('deck') or {}
    references = data.get('references') or []
    questions = data.get('questions') or []
    answers = data.get('answers') or []

    ref_url_map: Dict[int, str] = {}
    for r in references:
        if 'n' in r and r.get('url'):
            ref_url_map[int(r['n'])] = r['url']
    question_by_id = {q.get('id'): q for q in questions}

    parts: List[str] = []
    parts.append(render_frontmatter(deck))
    parts.append('')
    parts.append(AUTO_HEADER)
    parts.append('')
    title = deck.get('title') or ''
    if title:
        parts.append(f'# {title}')
        parts.append('')
    # H1 ends here, divider then content sections
    parts.append('---')
    parts.append('')
    parts.append(render_references(references))
    parts.append('')
    parts.append('---')
    parts.append('')
    if data.get('deck', {}).get('qa_driven', True):
        parts.append(render_qa_index(questions, answers))
        parts.append('')
        parts.append('---')
        parts.append('')

    for i, a in enumerate(answers, start=2):
        qid = a.get('question_id')
        q = question_by_id.get(qid)
        parts.append(render_answer(a, q, i, ref_url_map))
        parts.append('')
        parts.append('---')
        parts.append('')

    # remove trailing divider+blank
    while parts and parts[-1] in ('', '---'):
        parts.pop()
    text = '\n'.join(parts)
    if not text.endswith('\n'):
        text += '\n'
    return text


def main(argv=None):
    ap = argparse.ArgumentParser(description='braindump.json → braindump.md view')
    ap.add_argument('--input', '-i', required=True, type=Path)
    ap.add_argument('--output', '-o', type=Path, default=None)
    args = ap.parse_args(argv)

    if not args.input.is_file():
        print(f'[err] not found: {args.input}', file=sys.stderr)
        return 2
    data = json.loads(args.input.read_text(encoding='utf-8'))
    md = build_md(data)
    out_path = args.output or args.input.parent / 'braindump.md'
    out_path.write_text(md, encoding='utf-8')
    print(f'[ok] wrote {out_path} ({len(md)} chars)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
