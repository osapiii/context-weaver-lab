#!/usr/bin/env python3
"""
braindump-to-plan.py (v12.0)
============================
JSON-first 版 + deck_structure 骨格生成。braindump.json (SSOT) から
plan.draft.json を機械生成し、deck_structure の必須テンプレ枠を
**pre-populate** してから Claude に引き渡す。

設計 (osanai 氏指針 2026-05-08 / 2026-05-12 v12 update):
  ① まず Script で braindump を流し込んだ plan.json の下地を作る
  ② ↑ 制約に合うように JSON 内容を結晶化 (Claude が手で詰め直す)
  ③ v12 では deck_structure の header/body.chapters/footer 固定枠まで
     骨格 pre-populate して Claude の組み立て負荷を下げる

入出力
─────
入力:  decks/{slug}/braindump.json    (v12 SSOT)
出力:  decks/{slug}/plan.draft.json   (下地 plan.json with deck_structure skeleton)

ポリシー:
  - deck.deck_structure ∈ {learning-deck, proposal-deck, case-study-deck, ...}
    に応じて header / body / footer を pre-populate
  - 学習デッキ (learning-deck) の場合:
      header: SECTION-1 / FRAMING-1 / FRAMING-2 / SECTION-6 / QA-INDEX (空 shell)
      body.chapters[N]: SECTION-2 + SECSUMMARY-1 + content[] + FRAMING-5 (各 1 answer)
      footer: SECTION-3 / DATA-4 (references 自動投入) / FRAMING-4 / FRAMING-3
  - 1 answer = 3-5 content スライドにスライス (v11.2 ロジック維持)
  - 本文中の [N] → (N) 変換 (atoms.js 自動青文字化と互換)
  - opt-out: qa_driven=false の時は骨格生成スキップ → flat sections[] (legacy)
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


# ───────────────────────────────────────────────────────
# helpers
# ───────────────────────────────────────────────────────

def convert_inline_refs(text: str) -> str:
    """本文中の [N] → (N) に変換"""
    return re.sub(r'\[(\d+)\]', r'(\1)', text or '')


def block_to_text(block: Dict[str, Any]) -> str:
    """blocks[].text 系を文字列化"""
    t = block.get('type')
    if t in ('para', 'quote'):
        return block.get('text', '') or ''
    if t == 'heading':
        return ''
    if t == 'list':
        items = block.get('items') or []
        return '\n'.join(f'- {it}' for it in items)
    if t == 'code':
        return block.get('text', '') or ''
    if t == 'table':
        out: List[str] = []
        if block.get('headers'):
            out.append(' | '.join(block['headers']))
        for row in block.get('rows') or []:
            out.append(' | '.join(row))
        return '\n'.join(out)
    return ''


def _net_char_count(text: str) -> int:
    return len(re.sub(r'\s+', '', text or ''))


# ───────────────────────────────────────────────────────
# Block list → slide groups (v11.2 ロジック維持)
# ───────────────────────────────────────────────────────

def slice_blocks_into_groups(
    blocks: List[Dict[str, Any]],
    target_chars: int = 600,
    max_slides: int = 5,
) -> List[Dict[str, Any]]:
    groups: List[Dict[str, Any]] = []
    cur: Dict[str, Any] = {'heading': '', 'blocks': [], 'len': 0}

    def flush():
        if cur['blocks']:
            groups.append({'heading': cur['heading'], 'blocks': list(cur['blocks']),
                           'len': cur['len']})

    for b in blocks:
        if b.get('type') == 'heading' and (b.get('level') or 3) == 3:
            flush()
            cur = {'heading': b.get('text', ''), 'blocks': [], 'len': 0}
            continue
        cur['blocks'].append(b)
        cur['len'] += _net_char_count(block_to_text(b))
    flush()

    if not groups:
        groups = [{'heading': '', 'blocks': blocks, 'len': sum(_net_char_count(block_to_text(b)) for b in blocks)}]

    expanded: List[Dict[str, Any]] = []
    for g in groups:
        if g['len'] <= target_chars * 1.6:
            expanded.append(g)
            continue
        cur2: Dict[str, Any] = {'heading': g['heading'], 'blocks': [], 'len': 0}
        for b in g['blocks']:
            blen = _net_char_count(block_to_text(b))
            if cur2['blocks'] and cur2['len'] + blen > target_chars:
                expanded.append(cur2)
                cur2 = {'heading': g['heading'], 'blocks': [], 'len': 0}
            cur2['blocks'].append(b)
            cur2['len'] += blen
        if cur2['blocks']:
            expanded.append(cur2)

    while len(expanded) > max_slides:
        min_i = min(range(len(expanded)), key=lambda i: expanded[i]['len'])
        if min_i == 0:
            tgt = 1
        elif min_i == len(expanded) - 1:
            tgt = min_i - 1
        else:
            tgt = min_i - 1 if expanded[min_i - 1]['len'] <= expanded[min_i + 1]['len'] else min_i + 1
        a, b = sorted([min_i, tgt])
        expanded[a]['blocks'] = expanded[a]['blocks'] + expanded[b]['blocks']
        expanded[a]['len'] = expanded[a]['len'] + expanded[b]['len']
        if not expanded[a]['heading']:
            expanded[a]['heading'] = expanded[b]['heading']
        del expanded[b]

    return expanded


def first_paragraph(blocks: List[Dict[str, Any]], max_chars: int = 200) -> str:
    for b in blocks:
        t = b.get('type')
        if t in ('para', 'quote'):
            s = re.sub(r'\s+', ' ', b.get('text', '') or '').strip()
            s = convert_inline_refs(s)
            if not s:
                continue
            if len(s) <= max_chars:
                return s
            cut = s[:max_chars]
            last_period = cut.rfind('。')
            if last_period >= max_chars * 0.5:
                return cut[:last_period + 1]
            return cut
    return ''


def _group_to_items(group_blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    text_chunks: List[str] = []
    for b in group_blocks:
        s = block_to_text(b)
        if s.strip():
            text_chunks.append(s.strip())
    if not text_chunks:
        return []
    n = min(4, max(2, len(text_chunks)))
    if len(text_chunks) <= n:
        groups = [[c] for c in text_chunks]
    else:
        per = len(text_chunks) // n
        groups = []
        for i in range(n):
            start = i * per
            end = (i + 1) * per if i < n - 1 else len(text_chunks)
            groups.append(text_chunks[start:end])
    items: List[Dict[str, Any]] = []
    auto_names = ['観点 1', '観点 2', '観点 3', '観点 4']
    for i, g in enumerate(groups):
        joined = ' '.join(re.sub(r'\s+', ' ', s) for s in g)
        joined = convert_inline_refs(joined)
        items.append({
            'name': auto_names[i] if i < len(auto_names) else f'観点 {i+1}',
            'desc': joined[:300],
        })
    return items


# ───────────────────────────────────────────────────────
# 章本文スライド生成 (1 answer → 3-5 content slides)
# ───────────────────────────────────────────────────────

def build_content_slides_for_answer(
    answer: Dict[str, Any],
    question: Optional[Dict[str, Any]],
    chapter_idx: int,
) -> List[Dict[str, Any]]:
    qid = answer.get('question_id') or '?'
    section_id = f'ch{chapter_idx}'
    blocks = answer.get('blocks') or []
    sliced = slice_blocks_into_groups(blocks)

    slides: List[Dict[str, Any]] = []
    for s_i, g in enumerate(sliced):
        head = g.get('heading') or f'{qid} 詳細 {s_i+1}'
        slide = {
            'id': f'{section_id}-{qid.lower().replace(".","_")}-{s_i+1:02d}',
            'section_id': section_id,
            'template_id': None,  # ← v12: Claude が後で決める
            'title': head[:60],
            'subtitle': first_paragraph(g['blocks'], 180),
            'items': _group_to_items(g['blocks']),
            '_draft_note': (
                f'[結晶化対象] {qid} 章 content {s_i+1}/{len(sliced)} ({g["len"]} 字)。'
                f'目標: 4 カード × 130-160 字。template_id を LIST-3 / DIAGRAM-1 / COMPARE-1 等から選定'
            ),
        }
        slides.append(slide)
    return slides


# ───────────────────────────────────────────────────────
# deck_structure 骨格生成 (v12 新規)
# ───────────────────────────────────────────────────────

def shorten(text: str, n: int) -> str:
    """日本語テキストを n 字以内に短縮 (素朴)"""
    s = re.sub(r'\s+', ' ', text or '').strip()
    return s[:n]


def build_header_section_learning(deck: Dict[str, Any], qa_driven: bool) -> Dict[str, Any]:
    """learning-deck の header 4-5 枠を骨格として返す"""
    title = deck.get('title') or '(タイトル未設定)'
    slides = [
        {
            'id': 'header-cover',
            'section_id': 'header',
            'template_id': 'SECTION-1',
            'title': title,
            'subtitle': '',
            '_draft_note': '[結晶化対象] 表紙: deck.title を踏襲、必要なら sub にコピー追加',
        },
        {
            'id': 'header-framing1',
            'section_id': 'header',
            'template_id': 'FRAMING-1',
            'title': '構築背景',
            'subtitle': '',
            'detail_blocks': {
                'block_kikkake': '(きっかけ — どこから着想したか、現場エピソード)',
                'block_kizuki':  '(気づき — どんな課題感に気づいたか)',
                'block_gimon':   '(疑問 — そこから生まれた問いは何か)',
            },
            '_draft_note': '[結晶化対象] 構築背景 FRAMING-1。具体名・数値・業種規模を必ず入れる (C-1)',
        },
        {
            'id': 'header-framing2',
            'section_id': 'header',
            'template_id': 'FRAMING-2',
            'title': 'これまで → これから',
            'subtitle': '',
            'items': [
                {'before': '(Before 1)', 'after': '(After 1)'},
                {'before': '(Before 2)', 'after': '(After 2)'},
                {'before': '(Before 3)', 'after': '(After 3)'},
                {'before': '(Before 4)', 'after': '(After 4)'},
            ],
            '_draft_note': '[結晶化対象] Before→After 4-6 件。読者の到達点を具体的に',
        },
        {
            'id': 'header-toc',
            'section_id': 'header',
            'template_id': 'SECTION-6',
            'title': '目次',
            'subtitle': '',
            '_draft_note': '[結晶化対象] 統合目次。chapters の name を流用するか短縮タイトルを書く',
        },
    ]
    if qa_driven:
        slides.append({
            'id': 'header-qa-index',
            'section_id': 'header',
            'template_id': 'QA-INDEX',
            'title': '解決したい疑問・懸念',
            'subtitle': '',
            'cells': [],  # ← braindump.json の questions[] から build_plan_draft が後で埋める
            '_draft_note': '[結晶化対象] QA-INDEX: questions[] と answer_short の組をテーブル化',
        })
    return {
        'id': 'header',
        'name': '序盤 (header)',
        'slides': slides,
    }


def build_chapter_section_learning(
    answer: Dict[str, Any],
    question: Optional[Dict[str, Any]],
    chapter_idx: int,
) -> Dict[str, Any]:
    """learning-deck の chapter 1 つを骨格として返す (head / content / tail)"""
    qid = answer.get('question_id') or f'Q{chapter_idx}'
    section_id = f'ch{chapter_idx}'
    chapter_title = (
        answer.get('section_title')
        or ((question or {}).get('text') or qid)
    )
    chapter_title_short = shorten(chapter_title, 30)

    visual = (answer.get('visual') or 'none').lower()
    visual_path = answer.get('visual_path') or ''
    visual_caption = answer.get('visual_caption') or ''

    slides: List[Dict[str, Any]] = []

    # head[0]: SECTION-2 (章扉)
    slides.append({
        'id': f'{section_id}-opener',
        'section_id': section_id,
        'template_id': 'SECTION-2',
        'title': chapter_title_short,
        'number': f'{chapter_idx:02d}',
        'subtitle': shorten((question or {}).get('answer_short') or '', 100),
        '_draft_note': f'[結晶化対象] 章扉 SECTION-2 ({qid})。number と title だけで成立する設計',
    })

    # head[1]: SECSUMMARY-1 (見取り図 SVG)
    secsum: Dict[str, Any] = {
        'id': f'{section_id}-overview',
        'section_id': section_id,
        'template_id': 'SECSUMMARY-1',
        'title': f'{chapter_title_short} — 章見取り図',
        'subtitle': shorten(first_paragraph(answer.get('blocks') or [], 250), 200),
        '_draft_note': f'[結晶化対象] SECSUMMARY-1 ({qid})。SVG 1 枚で「この章の核」を絵にする。enostech-svg-diagram skill で svg を 1 枚書く',
    }
    if visual == 'required' and visual_path:
        secsum['svg_file'] = visual_path  # build-deck.js が PNG 化してくれる
        secsum['svg_caption'] = visual_caption
    slides.append(secsum)

    # content[]: answer.blocks をスライス
    slides.extend(build_content_slides_for_answer(answer, question, chapter_idx))

    # tail[0]: FRAMING-5 (章末まとめ)
    slides.append({
        'id': f'{section_id}-closer',
        'section_id': section_id,
        'template_id': 'FRAMING-5',
        'title': f'{chapter_idx} 章のポイント',  # ← テンプレが N を自動採番するので動的
        'subtitle': '',
        'mode': 'comprehension',
        'items': [
            {'point': '(押さえどころ 1)'},
            {'point': '(押さえどころ 2)'},
            {'point': '(押さえどころ 3)'},
        ],
        'mindset': '(マインドセット 1 文 — ですます調必須)',
        '_draft_note': f'[結晶化対象] FRAMING-5 ({qid} 章末)。items 3-8 件 / mindset 必須 / ですます調 (C-9 / StructQA-13)',
    })

    return {
        'id': section_id,
        'name': chapter_title_short,
        'slides': slides,
    }


def build_footer_section_learning(
    deck: Dict[str, Any],
    references: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """learning-deck の footer 4-5 枠を骨格として返す"""
    # DATA-4 (参考情報) は references を完全自動投入
    data4_rows = []
    for r in references:
        data4_rows.append({
            'num': r.get('n'),
            'category': r.get('medium') or '',
            'title': r.get('title') or '',
            'url': r.get('url') or '',
            'source': r.get('medium') or '',
        })

    slides = [
        {
            'id': 'footer-closing',
            'section_id': 'footer',
            'template_id': 'SECTION-3',
            'title': 'ありがとうございました',
            'subtitle': '',
            '_draft_note': '[結晶化対象] SECTION-3 クロージング (optional)。不要なら削除',
        },
        {
            'id': 'footer-references',
            'section_id': 'footer',
            'template_id': 'DATA-4',
            'title': '参考情報',
            'subtitle': '',
            'ref_table': data4_rows,
            '_draft_note': f'[自動投入済] DATA-4 references ({len(data4_rows)} 件)。category を整える程度で結晶化完了',
        },
        {
            'id': 'footer-omiyage',
            'section_id': 'footer',
            'template_id': 'FRAMING-4',
            'title': 'お土産',
            'subtitle': '',
            '_draft_note': '[結晶化対象] FRAMING-4 (お土産)。1 件深掘り — Skill / プロンプト集 / チートシート',
        },
        {
            'id': 'footer-company',
            'section_id': 'footer',
            'template_id': 'FRAMING-3',
            'title': '会社紹介',
            'subtitle': '',
            '_draft_note': '[省略推奨] FRAMING-3 (会社紹介)。フィールド省略でデフォルト ENOSTECH 情報が入る (C-16)',
        },
    ]
    return {
        'id': 'footer',
        'name': '末尾 (footer)',
        'slides': slides,
    }


# ───────────────────────────────────────────────────────
# legacy mode (qa_driven=false / 非 learning-deck)
# ───────────────────────────────────────────────────────

def build_legacy_chapter(
    answer: Dict[str, Any],
    question: Optional[Dict[str, Any]],
    chapter_idx: int,
) -> Dict[str, Any]:
    """v11.2 と同じ flat スライス挙動 (header/footer 無し)"""
    qid = answer.get('question_id') or f'Q{chapter_idx}'
    summary = (question or {}).get('answer_short') or ''
    section_title = answer.get('section_title') or (question or {}).get('text') or qid
    blocks = answer.get('blocks') or []

    section_id = f'ch{chapter_idx}'
    slides: List[Dict[str, Any]] = []
    intro_subtitle = summary or first_paragraph(blocks, 200)
    slides.append({
        'id': f'{section_id}-intro',
        'section_id': section_id,
        'template_id': 'LIST-1',
        'title': section_title[:60],
        'subtitle': intro_subtitle,
        '_draft_note': f'[結晶化対象] {qid} 章 Intro (legacy mode)',
    })
    slides.extend(build_content_slides_for_answer(answer, question, chapter_idx))

    visual = (answer.get('visual') or 'none').lower()
    visual_path = answer.get('visual_path') or ''
    visual_caption = answer.get('visual_caption') or ''
    if visual == 'required' and len(slides) >= 2:
        slides[1]['visual_assets'] = [{
            'kind': 'braindump-illust',
            'src': visual_path or f'braindump_assets/{qid}.png',
            'caption': visual_caption,
        }]
    return {
        'id': section_id,
        'name': shorten(section_title, 30),
        'slides': slides,
    }


# ───────────────────────────────────────────────────────
# Build plan
# ───────────────────────────────────────────────────────

# deck_structure → 骨格生成関数のレジストリ
DECK_STRUCTURE_BUILDERS = {
    'learning-deck': {
        'header': build_header_section_learning,
        'chapter': build_chapter_section_learning,
        'footer': build_footer_section_learning,
    },
    # 他の deck_structure は legacy fallback で
}


def build_plan_draft(json_path: Path) -> Dict[str, Any]:
    data = json.loads(json_path.read_text(encoding='utf-8'))
    deck = data.get('deck') or {}
    references = data.get('references') or []
    questions = data.get('questions') or []
    answers = data.get('answers') or []
    qa_driven = bool(deck.get('qa_driven', True))
    deck_structure = deck.get('deck_structure') or 'learning-deck'

    # doc.references
    doc_refs = []
    for r in references:
        doc_refs.append({
            'num': r.get('n'),
            'title': r.get('title') or '',
            'url': r.get('url') or '',
            'source': r.get('medium') or '',
            'accessed': r.get('retrieved_at') or '',
        })

    # doc.questions
    doc_questions = []
    for q in questions:
        doc_questions.append({
            'id': q.get('id'),
            'kind': q.get('kind') or 'other',
            'text': q.get('text') or '',
            'shortSummary': q.get('answer_short') or '',
        })

    question_by_id = {q.get('id'): q for q in questions}

    # ─── 骨格 mode 判定 ───
    use_skeleton = qa_driven and deck_structure in DECK_STRUCTURE_BUILDERS

    sections: List[Dict[str, Any]] = []

    if use_skeleton:
        builders = DECK_STRUCTURE_BUILDERS[deck_structure]
        # header
        header = builders['header'](deck, qa_driven=qa_driven)
        # QA-INDEX cells を answer_short から埋める
        for s in header['slides']:
            if s.get('template_id') == 'QA-INDEX':
                s['cells'] = [
                    {
                        'q_id': q.get('id'),
                        'question': q.get('text') or '',
                        'answer': q.get('answer_short') or '',
                    }
                    for q in questions
                ]
                break
        sections.append(header)

        # body chapters
        for idx, a in enumerate(answers, start=1):
            q = question_by_id.get(a.get('question_id'))
            sections.append(builders['chapter'](a, q, idx))

        # footer
        sections.append(builders['footer'](deck, references))
    else:
        # legacy flat mode
        for idx, a in enumerate(answers, start=1):
            q = question_by_id.get(a.get('question_id'))
            sections.append(build_legacy_chapter(a, q, idx))

    plan = {
        'doc': {
            'title': deck.get('title') or json_path.parent.name,
            'slug': deck.get('slug') or json_path.parent.name,
            'deck_type': deck.get('deck_type') or 'learning',
            'deck_structure': deck_structure,
            'qa_driven': qa_driven,
            'questions': doc_questions,
            'references': doc_refs,
            'compact_mode': True,
            'crystallization_status': 'draft',
            '_draft_note': (
                f'これは braindump-to-plan.py (v12.0) が braindump.json から生成した'
                f' deck_structure={deck_structure} の「骨格 plan.json」です。'
                f' header/body/footer の必須テンプレ枠を pre-populate 済み。'
                f' 結晶化フェーズ (Claude が手で密度を高める作業) で各 slide の'
                f' template_id 確定 / 本文 / カードを詰めてから render してください。'
            ),
        },
        'sections': sections,
    }
    return plan


# ───────────────────────────────────────────────────────
# CLI
# ───────────────────────────────────────────────────────

def main(argv=None):
    ap = argparse.ArgumentParser(
        description='braindump.json (v12) から deck_structure 骨格込み plan.draft.json を生成')
    ap.add_argument('-i', '--input', required=True, help='braindump.json のパス')
    ap.add_argument('-o', '--output', help='出力 plan.draft.json')
    args = ap.parse_args(argv)

    in_path = Path(args.input).resolve()
    if not in_path.exists():
        print(f'[err] not found: {in_path}', file=sys.stderr)
        return 2

    if in_path.suffix != '.json':
        print(f'[err] v12 では braindump.json (拡張子 .json) を渡してください: {in_path}\n'
              f'     v12 は v11.2 と同様 JSON-only。MD 入力はサポートしません。', file=sys.stderr)
        return 2

    plan = build_plan_draft(in_path)

    out_path = Path(args.output) if args.output else in_path.parent / 'plan.draft.json'
    out_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding='utf-8')

    n_slides = sum(len(s.get('slides', [])) for s in plan.get('sections', []))
    n_chars = 0
    for sec in plan.get('sections', []):
        for sl in sec.get('slides', []):
            n_chars += len(sl.get('subtitle', '') or '')
            for it in sl.get('items', []) or []:
                if isinstance(it, dict):
                    n_chars += len(it.get('desc', '') or '')

    print(f'[ok] wrote: {out_path}')
    print(f'  deck_structure: {plan["doc"]["deck_structure"]}')
    print(f'  sections: {len(plan["sections"])}')
    print(f'  slides:   {n_slides}')
    print(f'  questions: {len(plan["doc"].get("questions", []))}')
    print(f'  references: {len(plan["doc"].get("references", []))}')
    print(f'  total slide text: {n_chars} 字 (結晶化前)')
    print()
    if plan["doc"]["deck_structure"] in DECK_STRUCTURE_BUILDERS:
        print(f'  ✓ deck_structure 骨格 pre-populate 済み (header / body.chapters / footer)')
        print(f'  → Claude は各 slide.template_id (null のもの) を確定し、_draft_note の指示で内容を結晶化')
    else:
        print(f'  ⚠ deck_structure={plan["doc"]["deck_structure"]} は legacy mode (flat sections[])')
        print(f'  → 別途骨格を組む or DECK_STRUCTURE_BUILDERS に builder を追加')
    return 0


if __name__ == '__main__':
    sys.exit(main())
