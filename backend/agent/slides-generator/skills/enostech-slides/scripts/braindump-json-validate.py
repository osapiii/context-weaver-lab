#!/usr/bin/env python3
"""
braindump-json-validate.py (v12.0)
===================================
braindump.json (v12 SSOT) を Zod schema + BSQA-01..13 で検査する。

USAGE:
    python3 scripts/braindump-json-validate.py --input decks/{slug}/braindump.json
    python3 scripts/braindump-json-validate.py --input ... --strict --json

EXIT CODE:
    0 = no fatal (warn 許容)
    2 = --strict 指定時に fatal あり
    4 = file load / schema error

BSQA-01〜13 (v12 JSON 版):
    BSQA-01 (fatal) references[] が空でない (TOP 配置は MD render 側責任)
    BSQA-02 (fatal) questions[] が空でない & answer_short が全件
    BSQA-03 (fatal) len(questions) == len(answers)
    BSQA-04 (fatal) answers[].visual が必須 (Zod でも見るが念のため)
    BSQA-05 (warn ) questions[].related_refs[] が空でない
    BSQA-06 (fatal) visual=required の answer に visual_path 存在 + 実ファイル存在
    BSQA-07 (warn ) answers[].citations_used[] が空でない
    BSQA-08 (fatal) answers[].citations_used[] ⊆ references[].n[]
    BSQA-09 (warn ) references[] に登録されているが本文未使用 (逆向き warn)
    BSQA-10 (fatal) answers[].question_id の順 = questions[].id の順
    BSQA-11 (fatal) answers[].blocks[] の text 系 block 合計字数 ≥ 800
    BSQA-12 (warn ) blocks[] に table/list を含む or visual!=none or citations_used が空でない
    BSQA-13 (fatal) deck.deck_structure が deck-structures registry に存在 (v12 新設)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

INLINE_REF_RE = re.compile(r'\[(\d+)\]')


# ─────────────────────────────
# Python implementation of Zod schema check (mirrors braindump.js)
# ─────────────────────────────

SCHEMA_TAG_RE = re.compile(r'^braindump-v12(?:\.\d+)?$')
SLUG_RE = re.compile(r'^[a-z0-9-]+$')
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
QID_RE = re.compile(r'^Q\d+(?:\.\d+)?$')
URL_RE = re.compile(r'^https?://')

DECK_TYPES = {'learning', 'proposal', 'report', 'catalog'}
VISUAL_OPTS = {'required', 'optional', 'none'}
BLOCK_TYPES = {'para', 'heading', 'table', 'list', 'code', 'quote'}


def _schema_check(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Mirrors the Zod schema in scripts/render/schemas/braindump.js"""
    errors: List[Dict[str, Any]] = []

    def err(path: str, message: str):
        errors.append({'path': path, 'message': message})

    if not isinstance(data, dict):
        err('', 'root must be an object')
        return errors

    tag = data.get('$schema', '')
    if not (isinstance(tag, str) and SCHEMA_TAG_RE.match(tag)):
        err('$schema', f'$schema must match braindump-v12[.x] (got: {tag!r})')

    deck = data.get('deck')
    if not isinstance(deck, dict):
        err('deck', 'deck is required and must be an object')
    else:
        title = deck.get('title')
        if not (isinstance(title, str) and title):
            err('deck.title', 'deck.title required')
        slug = deck.get('slug')
        if not (isinstance(slug, str) and SLUG_RE.match(slug or '')):
            err('deck.slug', f'deck.slug must match [a-z0-9-]+ (got: {slug!r})')
        if deck.get('deck_type') not in DECK_TYPES:
            err('deck.deck_type', f'deck.deck_type must be one of {DECK_TYPES} (got: {deck.get("deck_type")!r})')
        # v12: deck_structure required
        ds = deck.get('deck_structure')
        if not (isinstance(ds, str) and ds):
            err('deck.deck_structure', f'deck.deck_structure 必須 (例: learning-deck)')
        date = deck.get('date', '')
        if not DATE_RE.match(str(date)):
            err('deck.date', f'deck.date must be YYYY-MM-DD (got: {date!r})')

    references = data.get('references') or []
    if not isinstance(references, list):
        err('references', 'references must be array')
        references = []
    ref_ns: Set[int] = set()
    for i, r in enumerate(references):
        if not isinstance(r, dict):
            err(f'references[{i}]', 'reference must be object')
            continue
        n = r.get('n')
        if not (isinstance(n, int) and n >= 1):
            err(f'references[{i}].n', f'reference.n must be positive int (got {n!r})')
            continue
        ref_ns.add(n)
        url = r.get('url') or ''
        if not URL_RE.match(url):
            err(f'references[{i}].url', f'reference.url must be http(s) (got {url!r})')
    if references:
        nums = sorted(ref_ns)
        for i, n in enumerate(nums):
            if n != i + 1:
                err('references', f'references[].n must be 1..N consecutive (got {nums})')
                break

    questions = data.get('questions') or []
    if not isinstance(questions, list):
        err('questions', 'questions must be array')
        questions = []
    q_ids: List[str] = []
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            err(f'questions[{i}]', 'question must be object')
            continue
        qid = q.get('id', '')
        if not QID_RE.match(qid):
            err(f'questions[{i}].id', f'question.id must match Q\\d+ (got {qid!r})')
        else:
            q_ids.append(qid)
        rrefs = q.get('related_refs') or []
        if not isinstance(rrefs, list):
            err(f'questions[{i}].related_refs', 'related_refs must be array')
        else:
            for rn in rrefs:
                if rn not in ref_ns:
                    err(f'questions[{i}].related_refs', f'{qid}: related_refs [{rn}] not in references[]')

    answers = data.get('answers') or []
    if not isinstance(answers, list):
        err('answers', 'answers must be array')
        answers = []
    q_id_set = set(q_ids)
    for i, a in enumerate(answers):
        if not isinstance(a, dict):
            err(f'answers[{i}]', 'answer must be object')
            continue
        qid = a.get('question_id', '')
        if not QID_RE.match(qid):
            err(f'answers[{i}].question_id', f'answer.question_id must match Q\\d+ (got {qid!r})')
        elif qid not in q_id_set:
            err(f'answers[{i}].question_id', f'answer.question_id={qid} not in questions[]')
        if a.get('visual') not in VISUAL_OPTS:
            err(f'answers[{i}].visual', f'visual must be one of {VISUAL_OPTS} (got {a.get("visual")!r})')
        blocks = a.get('blocks') or []
        if not isinstance(blocks, list) or not blocks:
            err(f'answers[{i}].blocks', 'blocks must be non-empty array')
        else:
            for j, b in enumerate(blocks):
                if not isinstance(b, dict):
                    err(f'answers[{i}].blocks[{j}]', 'block must be object')
                    continue
                t = b.get('type')
                if t not in BLOCK_TYPES:
                    err(f'answers[{i}].blocks[{j}].type', f'unknown block type {t!r}')
        for cn in a.get('citations_used', []) or []:
            if cn not in ref_ns:
                err(f'answers[{i}].citations_used', f'{qid}: citations_used [{cn}] not in references[]')

    # qa_driven aware: only enforce len if both present
    qa_driven = (data.get('deck') or {}).get('qa_driven', True)
    if qa_driven and len(questions) != len(answers):
        err('answers', f'len(questions)={len(questions)} != len(answers)={len(answers)}')

    return errors


# ─────────────────────────────
# BSQA-01..12 (v11.2 JSON)
# ─────────────────────────────

def _violation(rule_id: str, target: str, message: str, severity: str, fix: str) -> Dict[str, Any]:
    return {
        'rule_id': rule_id,
        'target': target,
        'message': message,
        'severity': severity,
        'fix': fix,
    }


def _text_charlen(block: Dict[str, Any]) -> int:
    """空白を除いた正味字数"""
    t = block.get('type')
    if t in ('para', 'heading', 'quote'):
        return len(re.sub(r'\s+', '', block.get('text', '') or ''))
    if t == 'list':
        return sum(len(re.sub(r'\s+', '', it or '')) for it in (block.get('items') or []))
    if t == 'table':
        n = len(re.sub(r'\s+', '', block.get('caption', '') or ''))
        for h in block.get('headers') or []:
            n += len(re.sub(r'\s+', '', h or ''))
        for row in block.get('rows') or []:
            for c in row:
                n += len(re.sub(r'\s+', '', c or ''))
        return n
    if t == 'code':
        # code は字数勘定では本文密度に寄与扱い (半分カウント) — ここではフルカウント
        return len(re.sub(r'\s+', '', block.get('text', '') or ''))
    return 0


def run_bsqa(data: Dict[str, Any], json_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    violations: List[Dict[str, Any]] = []
    deck = data.get('deck') or {}
    references = data.get('references') or []
    questions = data.get('questions') or []
    answers = data.get('answers') or []
    ref_ns = {int(r.get('n')) for r in references if isinstance(r.get('n'), int)}

    # BSQA-01: references[] が空でない
    if not references:
        violations.append(_violation(
            'BSQA-01', 'braindump 全体',
            'references[] が空 (TOP の References セクションに相当)',
            'fatal',
            'references[] に参考文献を 1 件以上登録する',
        ))

    # BSQA-02: questions[] が空でない & answer_short 全件
    if not questions:
        if deck.get('qa_driven', True):
            violations.append(_violation(
                'BSQA-02', 'braindump 全体',
                'questions[] が空',
                'fatal',
                'questions[] に Q&A 早見表に相当する質問を 1 件以上登録する',
            ))
    else:
        for q in questions:
            if not q.get('answer_short'):
                violations.append(_violation(
                    'BSQA-02', q.get('id') or '?',
                    f'{q.get("id")}: answer_short が空 (Q&A 早見表セル想定)',
                    'fatal',
                    f'{q.get("id")}.answer_short に 40-80 字程度の暫定解答を書く',
                ))

    # BSQA-03: len(questions) == len(answers)
    if deck.get('qa_driven', True) and len(questions) != len(answers):
        violations.append(_violation(
            'BSQA-03', 'braindump 全体',
            f'len(questions)={len(questions)} != len(answers)={len(answers)}',
            'fatal',
            'questions[] と answers[] の件数を揃える',
        ))

    # BSQA-04: answer.visual 必須 (Zod 側で見ているが警告として再出力)
    for a in answers:
        if a.get('visual') not in VISUAL_OPTS:
            violations.append(_violation(
                'BSQA-04', a.get('question_id', '?'),
                f'{a.get("question_id")}: visual が未指定または不正 ({a.get("visual")!r})',
                'fatal',
                'answer.visual を required | optional | none のいずれかに設定する',
            ))

    # BSQA-05 (warn): questions[].related_refs[] が空でない
    for q in questions:
        if not q.get('related_refs'):
            violations.append(_violation(
                'BSQA-05', q.get('id') or '?',
                f'{q.get("id")}: related_refs[] が空',
                'warn',
                f'{q.get("id")}.related_refs に参照する references の番号配列を書く',
            ))

    # BSQA-06: visual=required で visual_path 存在 + 実ファイル存在
    base_dir = json_path.parent if json_path else None
    for a in answers:
        if a.get('visual') != 'required':
            continue
        vp = a.get('visual_path')
        if not vp:
            violations.append(_violation(
                'BSQA-06', a.get('question_id', '?'),
                f'{a.get("question_id")}: visual=required だが visual_path が未指定',
                'fatal',
                f'braindump-illust.py を実行して {a.get("question_id")}.png を生成し visual_path を設定する',
            ))
            continue
        if base_dir:
            file_path = base_dir / vp
            if not file_path.exists():
                violations.append(_violation(
                    'BSQA-06', a.get('question_id', '?'),
                    f'{a.get("question_id")}: visual_path={vp} の実ファイルが見つからない ({file_path})',
                    'fatal',
                    f'braindump-illust.py を実行して {vp} を生成する',
                ))

    # BSQA-07 (warn): citations_used が空
    used_nums: Set[int] = set()
    for a in answers:
        cu = a.get('citations_used') or []
        used_nums.update(int(x) for x in cu)
        if not cu:
            violations.append(_violation(
                'BSQA-07', a.get('question_id', '?'),
                f'{a.get("question_id")}: citations_used[] が空 (本文中の [N] 引用なし)',
                'warn',
                f'{a.get("question_id")} の本文に [N] を 1 件以上置き、citations_used を更新する',
            ))

    # BSQA-08: citations_used ⊆ references.n
    for a in answers:
        for cn in a.get('citations_used') or []:
            if cn not in ref_ns:
                violations.append(_violation(
                    'BSQA-08', a.get('question_id', '?'),
                    f'{a.get("question_id")}: citations_used [{cn}] が references[] に未登録 (孤児参照)',
                    'fatal',
                    f'references[] に [{cn}] を追加するか、本文の番号を直す',
                ))

    # BSQA-09 (warn): references にあるが本文未使用
    for r in references:
        n = r.get('n')
        if not isinstance(n, int):
            continue
        if n not in used_nums:
            violations.append(_violation(
                'BSQA-09', f'references[{n}]',
                f'references [{n}] が本文中 (citations_used) で未使用',
                'warn',
                f'本文に [{n}] を引用するか、未使用なら references から削除する',
            ))

    # BSQA-10: answers.question_id の順 = questions.id の順
    if deck.get('qa_driven', True):
        q_ids = [q.get('id') for q in questions]
        a_qids = [a.get('question_id') for a in answers]
        # Only compare common-length prefix if lengths differ — but BSQA-03 already covers length
        if q_ids and a_qids and q_ids != a_qids:
            violations.append(_violation(
                'BSQA-10', 'braindump 全体',
                f'answer 順 {a_qids} が question 順 {q_ids} と不一致',
                'fatal',
                'answers[] を questions[] の Q1→Q2→... の順に並べ替える',
            ))

    # BSQA-11: blocks[] の text 系合計字数 ≥ 800
    for a in answers:
        n_chars = sum(_text_charlen(b) for b in (a.get('blocks') or []))
        if n_chars < 800:
            violations.append(_violation(
                'BSQA-11', a.get('question_id', '?'),
                f'{a.get("question_id")}: 正味字数 {n_chars} 字 (下限 800)',
                'fatal',
                f'{a.get("question_id")}.blocks に本文を書き足す (冒頭結論 + 背景 + 具体例 + 締めの 4 段)',
            ))

    # BSQA-12 (warn): table/list を含む or visual!=none or citations_used 非空
    for a in answers:
        has_rich = any(b.get('type') in ('table', 'list') for b in (a.get('blocks') or []))
        has_visual = a.get('visual') in ('required', 'optional')
        has_cit = bool(a.get('citations_used'))
        if not (has_rich or has_visual or has_cit):
            violations.append(_violation(
                'BSQA-12', a.get('question_id', '?'),
                f'{a.get("question_id")}: 挿絵 / テーブル / 引用 のいずれも含まれない (情報密度不足)',
                'warn',
                f'{a.get("question_id")} に table/list block か visual か citations のいずれかを追加',
            ))

    # BSQA-13 (fatal): deck.deck_structure が registry に存在
    KNOWN_DECK_STRUCTURES = {
        'learning-deck', 'proposal-deck', 'case-study-deck',
        'decision-guide', 'news-summary', 'mypedia',
    }
    ds = deck.get('deck_structure')
    if ds and ds not in KNOWN_DECK_STRUCTURES:
        violations.append(_violation(
            'BSQA-13', 'braindump 全体',
            f'deck.deck_structure={ds!r} が registry に存在しない (known: {sorted(KNOWN_DECK_STRUCTURES)})',
            'fatal',
            f'deck.deck_structure を {sorted(KNOWN_DECK_STRUCTURES)} のいずれかに変更するか、'
            f'scripts/render/deck-structures/{ds}.js を追加する',
        ))

    return violations


# ─────────────────────────────
# CLI
# ─────────────────────────────

def _format_text_report(violations: List[Dict[str, Any]], path: Path, schema_errors: List[Dict[str, Any]]) -> str:
    fatals = [v for v in violations if v['severity'] == 'fatal']
    warns = [v for v in violations if v['severity'] == 'warn']
    lines = [
        f'BSQA report for {path}',
        f'  schema errors: {len(schema_errors)}',
        f'  BSQA fatal: {len(fatals)} / warn: {len(warns)}',
    ]
    if not (schema_errors or violations):
        return f'[ok] {path}: no schema errors, BSQA fatal=0 / warn=0'
    for e in schema_errors:
        lines.append(f'  [SCHEMA] {e.get("path") or "(root)"}: {e["message"]}')
    for v in violations:
        icon = '!!' if v['severity'] == 'fatal' else '..'
        lines.append(f'  [{v["rule_id"]}/{v["severity"]:5}] {v["target"]}: {v["message"]}')
        lines.append(f'    -> {v["fix"]}')
    return '\n'.join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description='braindump.json (v12) validator + BSQA-01..13')
    ap.add_argument('--input', '-i', required=True, type=Path)
    ap.add_argument('--strict', action='store_true', help='fatal あり時に exit 2')
    ap.add_argument('--json', dest='as_json', action='store_true', help='JSON で出力')
    args = ap.parse_args(argv)

    if not args.input.is_file():
        print(f'[err] not found: {args.input}', file=sys.stderr)
        return 4
    try:
        data = json.loads(args.input.read_text(encoding='utf-8'))
    except Exception as e:
        print(f'[err] JSON parse failed: {e}', file=sys.stderr)
        return 4

    schema_errors = _schema_check(data)
    violations = run_bsqa(data, json_path=args.input)
    # promote schema errors to fatal-style violations for JSON output
    schema_as_v = [
        _violation('SCHEMA', e.get('path') or '(root)', e['message'], 'fatal',
                   'schema 違反を修正する (scripts/render/schemas/braindump.js の制約)')
        for e in schema_errors
    ]
    all_violations = schema_as_v + violations
    fatals = [v for v in all_violations if v['severity'] == 'fatal']

    if args.as_json:
        print(json.dumps({
            'input': str(args.input),
            'schema_errors': schema_errors,
            'violations': violations,
            'fatal_count': len(fatals),
            'warn_count': len(all_violations) - len(fatals),
        }, ensure_ascii=False, indent=2))
    else:
        print(_format_text_report(violations, args.input, schema_errors))

    if args.strict and fatals:
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
