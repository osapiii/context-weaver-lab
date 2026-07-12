#!/usr/bin/env python3
"""
writing-qa.py
=============
v6.81 新設: 日本語表現の機械検査 (WritingQA 層)。

Phase 2 で `render-deck-instruction.py` が JSON を読み込む時に内部から呼ばれ、
references/qa/writing-qa.md に明示されている **日本語の規範違反** を機械検出する。
SchemaQA と同列の自動検査層。ja-writing スキル v1.0 の 4 大原則を機械化。

ルールの詳細は references/qa/writing-qa.md を参照（唯一の真実 source）。

【v9.16 (2026-05-03) 追加】WritingQA-13 / WritingQA-14
   - WritingQA-13 [fatal]: タイトル+サブコピーがあるスライドでタイトルが体言止め
   - WritingQA-14 [fatal]: タイトル+サブコピーがあるスライドで subtitle がですます調で終わっていない
   - オプトアウト: doc.writing_strict: false で warn 降格
   - 例外テンプレ: SECTION-1/2/3/4/5, SECSUMMARY-1
   - JS 側 `scripts/render/lib/ja-text-helpers.js` と挙動を揃えている。

【v9.37 (2026-05-06) 追加】Phase 1.8 braindump モード
   - --mode braindump で markdown ファイルを直接読み込んで検査
   - 新規ルール WritingQA-21 / 22 / 24:
       21 [fatal]: 体言止め文末が連続 (5 文中 3 件以上)
       22 [warn]:  段落 800 字超
       24 [fatal]: Intro サマリーで Q 件数が questions[] と不一致 / 矢印先空欄
   - --questions <plan.json> で件数照合 (省略時は WritingQA-24 を warn 降格)

【v10.1.6 (2026-05-08) 改修】braindump モードを「構造ルールのみ」に再定義
   - 背景: braindump.md は散文の書き下ろし SSOT (思考メモ) であって、読み物の最終
     アウトプットではない。plan.json と同じ文体ルールで fatal を出していたため
     「マークダウンが完成しない」と osanai 氏指摘 (2026-05-08)。
   - braindump モードで OFF にしたルール:
       WritingQA-02/03/04/09/11/12 (v10.1.5 以前に既に削除済 / ja-writing skill 移管)
       WritingQA-21 (体言止め連続 fatal) ← v10.1.6 で削除
       WritingQA-22 (段落 800 字超 warn) ← v10.1.6 で削除
   - braindump モードで残したルール (構造系のみ):
       WritingQA-24 (Intro Q 件数整合 fatal)
       WritingQA-25/26/27 (ファクト参照 [N] fatal/fatal/warn)
       WritingQA-28 (visual: required と <img> 整合 warn)
       WritingQA-29 (Q 章 frontmatter `> visual:` 行必須 fatal)
       WritingQA-30 (visual: required で illust 実行ログ必須 fatal)
   - plan.json モード (validate_writing_qa) は 100% 無変更

【v10.1.6 後方追加 (2026-05-08)】WritingQA-25 から固有名詞検出を撤去
   - osanai 氏指摘 (2026-05-08):
       「固有名詞だけで [N] 必須は厳しすぎ。Slack / Anthropic / トヨタ みたいな
        普通の固有名詞にまで [N] 要求は意味不明」
   - 旧 _BD_ENTITY_FACT_RE (大文字始まり英単語 + 「〜株式会社/銀行/証券/HD」等の
     日本語サフィックス) を廃止。WritingQA-25 は「数値 + 単位 (10億円 / 50% /
     100件 / 3年 等)」を含む段落のみ fatal を出す。
   - 固有名詞の出典管理は人間判断に委ねる方針。記録すべき情報源があれば人間が
     [N] を付ける、不要なら付けない (機械強制しない)。
   - WritingQA-26/27 (本文 [N] と References table の整合) は無変更。本文に
     [N] を書いた場合は引き続き References への登録を機械強制する。

【使い方】

  CLI (単独デバッグ用):
    python3 writing-qa.py --input deck.json
    python3 writing-qa.py --input deck.json --strict   # fatal 違反で exit 2
    python3 writing-qa.py --input braindump.md --mode braindump --strict   # v9.37
    python3 writing-qa.py --input braindump.md --mode braindump \\
            --questions plan.json --strict             # v9.37 件数照合

  Python API (render-deck-instruction.py から):
    from writing_qa import validate_writing_qa
    violations = validate_writing_qa(data)

  Python API:
    from writing_qa import validate_writing_qa_braindump
    violations = validate_writing_qa_braindump(markdown_text, questions=None)

【返り値の形式】

  既存の validate_schema_qa と同じ形式:

    [
      {
        "rule_id": "WritingQA-01",
        "target":  "S5 (LIST-1) subtitle",
        "message": "サブコピーが 42 字 — 60 字未満は説明力不足の典型",
        "severity": "fatal",
        "fix": "R2-4 の 4 要素を含む 120-200 字に書き直す"
      },
      ...
    ]
"""

import sys
import re
import json
import argparse
from pathlib import Path
from typing import List, Dict, Any, Iterable, Tuple, Optional


# ───────────────────────────────────────────────────────
# テンプレ別: WritingQA-01 (subtitle 短文化) を warn に降格するテンプレ ID
# ───────────────────────────────────────────────────────
SUBTITLE_SHORT_OK_TEMPLATES = {
    'SECTION-1',  # 表紙
    'SECTION-3',  # 閉じ
    'VISUAL-3',  # ビジュアル主体
    'SECTION-2',  # セクション扉
    'SECTION-4',  # セクション扉 A
    'SECTION-5',  # セクション扉 B
    'VISUAL-8',  # グラレコサマリー
}


# ───────────────────────────────────────────────────────
# 翻訳調パターン (WritingQA-02)
# ───────────────────────────────────────────────────────
TRANSLATION_PATTERNS = [
    (re.compile(r'することができ[るますずぬない]'), '「することができる」→「できる」'),
    (re.compile(r'することが可能'),                '「することが可能」→「できる」'),
    (re.compile(r'を行(う|います|った|い、|い。)'), '「を行う」→「する」'),
    (re.compile(r'を実施(する|します|した)'),      '「を実施する」→「する」'),
    (re.compile(r'において(は)?'),                 '「において」→「で」'),
    (re.compile(r'に関して(は)?'),                 '「に関して」→「について」'),
    (re.compile(r'することにより'),                '「することにより」→「することで」'),
    (re.compile(r'まず最初(に)?'),                 '「まず最初に」→「まず」'),
]


# ───────────────────────────────────────────────────────
# ハイプ語 (WritingQA-03)
# ───────────────────────────────────────────────────────
HYPE_PATTERNS = [
    re.compile(r'革命的'),
    re.compile(r'ゲームチェンジャー'),
    re.compile(r'究極の'),
    re.compile(r'完全に(解決|解消|変える|変わる)'),
    re.compile(r'すべての(課題|問題|悩み)を(解決|解消)'),
    re.compile(r'最高の(品質|体験|結果)'),
    re.compile(r'完璧な'),
    re.compile(r'魔法のよう'),
    re.compile(r'奇跡的'),
    re.compile(r'世界初'),
    re.compile(r'パラダイムシフト'),
    re.compile(r'業界を再定義'),
    re.compile(r'AIを民主化'),
    re.compile(r'スーパーチャージ'),
    re.compile(r'至高の'),
    re.compile(r'不可避の(変化|流れ)'),
]


# ───────────────────────────────────────────────────────
# 弱い表現 (WritingQA-06)
# ───────────────────────────────────────────────────────
WEAK_PATTERNS = [
    re.compile(r'かもしれ(ない|ません)'),
    re.compile(r'と思われ(る|ます)'),
    re.compile(r'の可能性があ(る|ります)'),
    re.compile(r'と言える(でしょう|かもしれ)'),
    re.compile(r'ような気がし(ます|た)'),
]


# ───────────────────────────────────────────────────────
# 二重否定 (WritingQA-09)
# ───────────────────────────────────────────────────────
DOUBLE_NEGATIVE_PATTERNS = [
    re.compile(r'なくはない'),
    re.compile(r'ないことはない'),
    re.compile(r'ないわけではない'),
    re.compile(r'なくなくない'),
]


# ───────────────────────────────────────────────────────
# 横文字侵入 (WritingQA-11)
# ───────────────────────────────────────────────────────
WESTERN_PATTERNS = [
    re.compile(r'\bSECTION\s*0?\d', re.IGNORECASE),
    re.compile(r'\bTOOL\s*0?\d', re.IGNORECASE),
    re.compile(r'\bFeature\s*0?\d'),
    re.compile(r'\bAgenda\b'),
    re.compile(r'\bOur\s+Values\b', re.IGNORECASE),
    re.compile(r'\bSolution\b'),
    re.compile(r'\bApproach\b'),
    re.compile(r'\bOverview\b'),
    re.compile(r'\bCoverage\b'),
    re.compile(r'\bFour\s+Pillars\b'),
    re.compile(r'\bProduct\s+Detail\b'),
]


# ───────────────────────────────────────────────────────
# 箱型比喩候補 (WritingQA-12)
# ───────────────────────────────────────────────────────
METAPHOR_TRIGGERS = re.compile(r'(のようなもの|みたいな|いわば|いってみれば|ちょうど.*?ような)')
METAPHOR_OBJECTS = re.compile(r'(箱|入れ物|窓口|執事|秘書|通訳|料理人|台所|お弁当|手紙|タンス)')

KATAKANA_TERM = re.compile(r'[ァ-ヴー]{5,}')


# ───────────────────────────────────────────────────────
# 動詞の名詞化 (WritingQA-10)
# ───────────────────────────────────────────────────────
NOMINALIZATION_PATTERNS = [
    re.compile(r'.+の(実現|促進|高速化|効率化|最適化|改善|向上|削減|達成|強化|構築|整備|徹底)$'),
    re.compile(r'.+(化)$'),  # 「効率化」「自動化」等
]


# ───────────────────────────────────────────────────────
# ───────────────────────────────────────────────────────

DESUMASU_SUFFIXES = (
    'ませんでした',
    'でしょうか',
    'でしたか',
    'でした',
    'でしょう',
    'ですか',
    'ましょう',
    'ましたか',
    'ますか',
    'ませんか',
    'ません',
    'ました',
    'てください',
    'でください',
    'ください',
    'いたします',
    '致します',
    'いただきます',
    'いただけます',
    'なりました',
    'になりました',
    'となりました',
    'なります',
    'になります',
    'となります',
    'できません',
    'できます',
    'ありません',
    'ございます',
    'です',
    'ます',
)

VERB_PLAIN_SUFFIXES = (
    'する', 'した', 'しない', 'しよう', 'しろ',
    'できる', 'できた', 'できない',
    'だ', 'だった', 'である', 'であった',
    'ない', 'なかった',
    'ある', 'あった', 'いる', 'いた',
    'なる', 'なった', 'ならない',
    'たい', 'やすい', 'にくい', 'らしい', 'ほしい',
)

JOSHI_TAIL_SUFFIXES = (
    'を', 'に', 'で', 'と', 'から', 'まで', 'より', 'へ',
    'や', 'は', 'が', 'も', 'ね', 'よ',
    'か',
)

U_DAN_HIRAGANA = set('うくすつぬふむゆるぐぶ')

DESUMASU_EXEMPT_TEMPLATES = {
    'SECTION-1', 'SECTION-2', 'SECTION-3', 'SECTION-4', 'SECTION-5',
    'SECSUMMARY-1',
}

_TRAILING_PUNCT_RE = re.compile(
    r'(?:[。．！？!?\.　\s]|\(\s*\d+\s*\)|（\s*\d+\s*）|[)\]）】])+$'
)


def _is_kanji(c: str) -> bool:
    return '一' <= c <= '鿿'


def _is_hiragana(c: str) -> bool:
    return '぀' <= c <= 'ゟ'


def _is_kanji_or_hiragana(c: str) -> bool:
    return _is_kanji(c) or _is_hiragana(c)


def _strip_trailing_punct(s: str) -> str:
    return _TRAILING_PUNCT_RE.sub('', s or '')


def _last_sentence(text: str) -> str:
    if not text:
        return ''
    s = text.rstrip()
    parts = re.split(r'[。．\n]', s)
    for p in reversed(parts):
        p = p.strip()
        if p:
            return p
    return ''


def ends_with_desumasu(text: str) -> bool:
    if not text:
        return False
    last = _last_sentence(text)
    if not last:
        return False
    cleaned = _strip_trailing_punct(last)
    if not cleaned:
        return False
    return cleaned.endswith(DESUMASU_SUFFIXES)


def _ends_with_verb_or_plain(text: str) -> bool:
    if not text:
        return False
    if text.endswith(VERB_PLAIN_SUFFIXES):
        return True
    if len(text) >= 2:
        last = text[-1]
        prev = text[-2]
        if last in U_DAN_HIRAGANA and _is_kanji_or_hiragana(prev):
            return True
    return False


def _ends_with_adjective(text: str) -> bool:
    if not text or not text.endswith('い') or len(text) < 2:
        return False
    prev = text[-2]
    return _is_kanji_or_hiragana(prev)


def _ends_with_joshi(text: str) -> bool:
    if not text:
        return False
    return text.endswith(JOSHI_TAIL_SUFFIXES)


def ends_with_taigen(text: str) -> bool:
    if not text:
        return False
    raw = text.strip()
    if not raw:
        return False
    if re.search(r'[？！?!]$', raw):
        return False
    cleaned = _strip_trailing_punct(raw)
    if not cleaned:
        return False
    if ends_with_desumasu(text):
        return False
    if _ends_with_verb_or_plain(cleaned):
        return False
    if _ends_with_adjective(cleaned):
        return False
    if _ends_with_joshi(cleaned):
        return False
    return True


# ───────────────────────────────────────────────────────
# テキスト抽出 (plan.json モード用)
# ───────────────────────────────────────────────────────
def _iter_slide_texts(slide: Dict[str, Any]) -> Iterable[Tuple[str, str]]:
    if not isinstance(slide, dict):
        return

    for k in ('title', 'subtitle', 'eyebrow', 'caption', 'lead', 'description',
              'notes', 'speaker_notes', 'rationale'):
        v = slide.get(k)
        if isinstance(v, str) and v.strip():
            yield (k, v)

    bullets = slide.get('bullets')
    if isinstance(bullets, list):
        for i, b in enumerate(bullets):
            if isinstance(b, str) and b.strip():
                yield (f'bullets[{i}]', b)
            elif isinstance(b, dict):
                for kk in ('text', 'body', 'label'):
                    if isinstance(b.get(kk), str) and b[kk].strip():
                        yield (f'bullets[{i}].{kk}', b[kk])

    for list_key in ('cards', 'steps', 'items', 'columns', 'tiles', 'phases',
                     'profiles', 'tracks', 'chapters', 'subsections', 'point_items',
                     'block_kikkake', 'block_kizuki', 'block_gimon'):
        lst = slide.get(list_key)
        if not isinstance(lst, list):
            continue
        for i, it in enumerate(lst):
            if isinstance(it, str) and it.strip():
                yield (f'{list_key}[{i}]', it)
            elif isinstance(it, dict):
                for kk in ('title', 'body', 'description', 'text', 'label',
                           'subtitle', 'caption', 'lead', 'name', 'role'):
                    v = it.get(kk)
                    if isinstance(v, str) and v.strip():
                        yield (f'{list_key}[{i}].{kk}', v)
                if list_key in ('block_kikkake', 'block_kizuki', 'block_gimon'):
                    for kk in ('episode', 'fact', 'question'):
                        v = it.get(kk)
                        if isinstance(v, str) and v.strip():
                            yield (f'{list_key}[{i}].{kk}', v)


# ───────────────────────────────────────────────────────
# violation 追加ヘルパー
# ───────────────────────────────────────────────────────
def _add(violations: List[Dict[str, Any]],
         rule_id: str, target: str, message: str,
         severity: str = 'fatal', fix: str = '') -> None:
    violations.append({
        'rule_id': rule_id,
        'target': target,
        'message': message,
        'severity': severity,
        'fix': fix,
    })


def _slide_label(slide: Dict[str, Any]) -> str:
    sid = slide.get('id', '?')
    tid = slide.get('template_id', '?')
    return f'{sid} ({tid})'


# ───────────────────────────────────────────────────────
# 個別ルールチェッカー (plan.json モード)
# ───────────────────────────────────────────────────────

def _check_subtitle_length(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    sub = slide.get('subtitle')
    if not isinstance(sub, str):
        return
    L = len(sub.strip())
    if L == 0 or L >= 60:
        return
    tid = slide.get('template_id', '')
    severity = 'warn' if tid in SUBTITLE_SHORT_OK_TEMPLATES else 'fatal'
    _add(
        violations,
        rule_id='WritingQA-01',
        target=f'{_slide_label(slide)} subtitle',
        message=f'サブコピーが {L} 字 — 60 字未満は説明力不足の典型 (R2-4 違反): {sub[:30]}…',
        severity=severity,
        fix='R2-4 の 4 要素 (具体・なぜ/どうやって・読後の変化・対比) を盛り込んで 120-200 字に書き直す。詳細は ja-writing/references/checklist-slide.md',
    )


def _check_translation_style(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    for field, text in _iter_slide_texts(slide):
        for pat, advice in TRANSLATION_PATTERNS:
            m = pat.search(text)
            if m:
                _add(
                    violations,
                    rule_id='WritingQA-02',
                    target=f'{label} {field}',
                    message=f'翻訳調パターン検出: "{m.group()}" — {advice}',
                    severity='fatal',
                    fix='ja-writing/references/checklist-translation.md の置換表で機械的に置換',
                )
                break


def _check_hype(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    for field, text in _iter_slide_texts(slide):
        for pat in HYPE_PATTERNS:
            m = pat.search(text)
            if m:
                _add(
                    violations,
                    rule_id='WritingQA-03',
                    target=f'{label} {field}',
                    message=f'ハイプ語検出: "{m.group()}" — 誠実さを損なう誇張表現',
                    severity='fatal',
                    fix='ja-writing/references/checklist-ai-style.md の置換表で代替に。具体（数字・固有名）に置き換える',
                )
                break


def _check_doubled_joshi(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    for field, text in _iter_slide_texts(slide):
        for sentence in re.split(r'[。．\n]', text):
            for joshi in ('の', 'は', 'が', 'で', 'を', 'に'):
                pat = re.compile(r'[^' + joshi + r'\s]+' + joshi)
                matches = pat.findall(sentence)
                if len(matches) >= 4:
                    _add(
                        violations,
                        rule_id='WritingQA-04',
                        target=f'{label} {field}',
                        message=f'助詞「{joshi}」が {len(matches)} 連: "{sentence[:50]}…"',
                        severity='fatal',
                        fix='文を分割するか、別の助詞に置き換える。詳細は ja-writing/references/checklist-grammar.md §3',
                    )
                    return


def _check_colon_block(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    pat = re.compile(r'(します|です|でしょう|だ|である)[:：]\s*$')
    for field, text in _iter_slide_texts(slide):
        for line in text.split('\n'):
            if pat.search(line):
                _add(
                    violations,
                    rule_id='WritingQA-05',
                    target=f'{label} {field}',
                    message=f'コロン直後ブロックパターン: "{line.strip()[-30:]}"',
                    severity='warn',
                    fix='「実行します:」→「実行方法は次の通り。」のように名詞止めに',
                )
                return


def _check_weak_phrases(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    for field, text in _iter_slide_texts(slide):
        for sentence in re.split(r'[。．]', text):
            count = sum(1 for pat in WEAK_PATTERNS if pat.search(sentence))
            if count >= 2:
                _add(
                    violations,
                    rule_id='WritingQA-06',
                    target=f'{label} {field}',
                    message=f'弱い断定が一文に {count} 件: "{sentence[:50]}…"',
                    severity='warn',
                    fix='言い切りに変えるか、弱表現を 1 件に絞る',
                )
                return


def _check_sentence_length(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    for field, text in _iter_slide_texts(slide):
        for sentence in re.split(r'[。．]', text):
            s = sentence.strip()
            if len(s) > 100:
                _add(
                    violations,
                    rule_id='WritingQA-07',
                    target=f'{label} {field}',
                    message=f'一文 {len(s)} 字 (100 超): "{s[:50]}…"',
                    severity='warn',
                    fix='句点で分割。textlint sentence-length と同じ規範',
                )
                return


def _check_max_ten(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    for field, text in _iter_slide_texts(slide):
        for sentence in re.split(r'[。．]', text):
            ten_count = sentence.count('、')
            if ten_count >= 4:
                _add(
                    violations,
                    rule_id='WritingQA-08',
                    target=f'{label} {field}',
                    message=f'一文に読点 {ten_count} 個 (4 以上): "{sentence[:50]}…"',
                    severity='warn',
                    fix='文を分割するサイン。textlint max-ten と同じ規範',
                )
                return


def _check_double_negative(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    for field, text in _iter_slide_texts(slide):
        for pat in DOUBLE_NEGATIVE_PATTERNS:
            m = pat.search(text)
            if m:
                _add(
                    violations,
                    rule_id='WritingQA-09',
                    target=f'{label} {field}',
                    message=f'二重否定検出: "{m.group()}"',
                    severity='warn',
                    fix='肯定文に書き直す',
                )
                return


def _check_nominalization(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    bullets = slide.get('bullets')
    if not isinstance(bullets, list) or len(bullets) < 3:
        return
    nominalized = 0
    samples = []
    for b in bullets:
        text = b if isinstance(b, str) else (b.get('text') or b.get('body') or '') if isinstance(b, dict) else ''
        if not isinstance(text, str):
            continue
        for pat in NOMINALIZATION_PATTERNS:
            if pat.match(text.strip()):
                nominalized += 1
                samples.append(text[:20])
                break
    if nominalized >= 3:
        _add(
            violations,
            rule_id='WritingQA-10',
            target=f'{_slide_label(slide)} bullets',
            message=f'動詞名詞化が {nominalized} 件 (体言止めの羅列): {samples[:3]}',
            severity='warn',
            fix='動詞・言い切りに統一。「業務効率化の実現」→「業務を効率化する」',
        )


def _check_western(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    for field in ('title', 'subtitle'):
        text = slide.get(field)
        if not isinstance(text, str):
            continue
        for pat in WESTERN_PATTERNS:
            m = pat.search(text)
            if m:
                _add(
                    violations,
                    rule_id='WritingQA-11',
                    target=f'{label} {field}',
                    message=f'横文字パターン検出: "{m.group()}" (C-1 違反)',
                    severity='warn',
                    fix='ja-writing/references/checklist-translation.md §B / brand-tokens.md §3 の代替表現に',
                )
                break


def _check_desumasu_unification(slide: Dict[str, Any],
                                 violations: List[Dict[str, Any]],
                                 strict: bool = True) -> None:
    tid = slide.get('template_id', '') or ''
    if tid in DESUMASU_EXEMPT_TEMPLATES:
        return
    title = (slide.get('title') or '').strip()
    subtitle = (slide.get('subtitle') or '').strip()
    if not subtitle:
        return
    if not title:
        return

    label = _slide_label(slide)
    severity = 'fatal' if strict else 'warn'

    if ends_with_taigen(title):
        _add(
            violations,
            rule_id='WritingQA-13',
            target=f'{label} title',
            message=(
                f'体言止めですが subtitle があります: 「{title}」 — '
                'タイトル+サブコピー両方ある時はタイトルもですます調必須'
            ),
            severity=severity,
            fix=(
                '動詞・ですます調に書き換える。'
                '例: 「移行プロセスのポイント」→「移行プロセスのポイントを押さえます」 / '
                '「効果と注意点」→「効果と注意点を整理します」'
            ),
        )

    if not ends_with_desumasu(subtitle):
        last = _last_sentence(subtitle)
        tail = last[-30:] if last else subtitle[-30:]
        _add(
            violations,
            rule_id='WritingQA-14',
            target=f'{label} subtitle',
            message=f'subtitle がですます調で終わっていません: 「…{tail}」',
            severity=severity,
            fix=(
                '最終文をですます調 (〜です / 〜ます / 〜ません / 〜でしょう / '
                '〜してください / 〜になります 等) に書き直す。'
                'タイトルが体言止め単独で十分な場合は subtitle を消すのも可。'
            ),
        )


def _check_metaphor(slide: Dict[str, Any], violations: List[Dict[str, Any]]) -> None:
    label = _slide_label(slide)
    for field, text in _iter_slide_texts(slide):
        triggers = list(METAPHOR_TRIGGERS.finditer(text))
        objects = list(METAPHOR_OBJECTS.finditer(text))
        if not triggers or not objects:
            continue
        for tm in triggers:
            for om in objects:
                gap = abs(tm.start() - om.start())
                if gap <= 50:
                    if KATAKANA_TERM.search(text):
                        snippet_start = max(0, min(tm.start(), om.start()) - 10)
                        snippet_end = min(len(text), max(tm.end(), om.end()) + 10)
                        _add(
                            violations,
                            rule_id='WritingQA-12',
                            target=f'{label} {field}',
                            message=f'「箱型比喩」候補: "{text[snippet_start:snippet_end]}"',
                            severity='warn',
                            fix='ja-writing/references/checklist-metaphor.md の判定フロー (用語そのまま > 補足型 > 比喩) を通す',
                        )
                        return


# ───────────────────────────────────────────────────────
# ───────────────────────────────────────────────────────

VISUAL_DEPENDENT_PATTERNS = [
    re.compile(r'ご覧の(通り|ように|スライド|図|画面)'),
    re.compile(r'画面(の)?(右|左|上|下|中央|手前|奥)'),
    re.compile(r'(右|左|上|下)(に|の)(あ[るり]|示し|表示)'),
    re.compile(r'こちら(の|を)(ご覧|見|参照)'),
    re.compile(r'こ[こちれ]の(図|表|スライド|画面|資料)'),
    re.compile(r'上(の|記)(図|表|スライド|画像|矢印)'),
    re.compile(r'(下|次)(の|記)(図|表|スライド|画像)'),
    re.compile(r'矢印が示す'),
    re.compile(r'青(い|色の?)(枠|箱|帯|ライン)'),
    re.compile(r'赤(い|色の?)(枠|箱|帯|ライン)'),
]

LIST_MARKUP_LINE_RE = re.compile(r'^\s*([\*\-]|\d+\.)\s+\S')


def _iter_narration_texts(slide: Dict[str, Any]) -> Iterable[Tuple[str, str]]:
    for k in ('speaker_notes', 'notes', 'narration'):
        v = slide.get(k)
        if isinstance(v, str) and v.strip():
            yield (k, v)


def _check_narration_length(slide: Dict[str, Any],
                             violations: List[Dict[str, Any]],
                             strict: bool = False) -> None:
    label = _slide_label(slide)
    severity = 'fatal' if strict else 'warn'
    for field, text in _iter_narration_texts(slide):
        net = re.sub(r'\s+', '', text)
        L = len(net)
        if L == 0:
            continue
        if L < 30:
            _add(
                violations,
                rule_id='WritingQA-15',
                target=f'{label} {field}',
                message=f'ナレーション台本が {L} 字 — 30 字未満は短すぎる (TTS で 10 秒未満)',
                severity=severity,
                fix='80〜250 字 (30〜90 秒) を目安に書き足す。',
            )
            return
        if L > 350:
            _add(
                violations,
                rule_id='WritingQA-15',
                target=f'{label} {field}',
                message=f'ナレーション台本が {L} 字 — 350 字超は長すぎる (TTS で 90 秒超)',
                severity=severity,
                fix='80〜250 字に絞る。',
            )
            return


def _check_narration_visual_dependent(slide: Dict[str, Any],
                                       violations: List[Dict[str, Any]],
                                       strict: bool = False) -> None:
    label = _slide_label(slide)
    severity = 'fatal' if strict else 'warn'
    for field, text in _iter_narration_texts(slide):
        for pat in VISUAL_DEPENDENT_PATTERNS:
            m = pat.search(text)
            if m:
                _add(
                    violations,
                    rule_id='WritingQA-16',
                    target=f'{label} {field}',
                    message=f'視覚依存表現: "{m.group()}" — 音声単独では意味が通らない',
                    severity=severity,
                    fix='視覚を前提にしない言い換えに。',
                )
                return


def _check_narration_list_markup(slide: Dict[str, Any],
                                  violations: List[Dict[str, Any]],
                                  strict: bool = False) -> None:
    label = _slide_label(slide)
    severity = 'fatal' if strict else 'warn'
    for field, text in _iter_narration_texts(slide):
        for line in text.splitlines():
            if LIST_MARKUP_LINE_RE.match(line):
                _add(
                    violations,
                    rule_id='WritingQA-17',
                    target=f'{label} {field}',
                    message=f'箇条書きマークアップ残存: "{line.strip()[:30]}…"',
                    severity=severity,
                    fix='接続詞で繋いで散文に。',
                )
                return


def _check_narration_taigen_end(slide: Dict[str, Any],
                                 violations: List[Dict[str, Any]],
                                 strict: bool = False) -> None:
    label = _slide_label(slide)
    severity = 'fatal' if strict else 'warn'
    for field, text in _iter_narration_texts(slide):
        if ends_with_taigen(text):
            last = _last_sentence(text)
            tail = last[-30:] if last else text[-30:]
            _add(
                violations,
                rule_id='WritingQA-18',
                target=f'{label} {field}',
                message=f'体言止め終端: 「…{tail}」 — ナレーションでは途切れて聞こえる',
                severity=severity,
                fix='ですます調終端に書き直す。',
            )
            return


def _check_framing5_mindset_desumasu(slide: Dict[str, Any],
                                       violations: List[Dict[str, Any]],
                                       strict: bool = False) -> None:
    if slide.get('template_id') != 'FRAMING-5':
        return
    mindset = slide.get('mindset') or {}
    if not isinstance(mindset, dict):
        return
    title = mindset.get('title')
    if not isinstance(title, str) or not title.strip():
        return
    if ends_with_desumasu(title):
        return

    label = _slide_label(slide)
    severity = 'fatal' if strict else 'warn'
    last = _last_sentence(title)
    tail = last[-30:] if last else title[-30:]
    _add(
        violations,
        rule_id='WritingQA-19',
        target=f'{label} mindset.title',
        message=(
            f'mindset がですます調で終わっていません: 「…{tail}」 — '
            'FRAMING-5 章末まとめは subtitle と同じくカード文ですます調統一'
        ),
        severity=severity,
        fix='mindset.title をですます調に書き直す。',
    )


# ───────────────────────────────────────────────────────
#   markdown を読んで Phase 1.8 の品質ゲートを通す。
# ───────────────────────────────────────────────────────

# Q 章の見出しパターン: `## Q1: ...` / `## Q12: ...`
_BRAINDUMP_Q_HEADING_RE = re.compile(r'^##\s+(Q\d+)\s*[:：]\s*(.+?)\s*$', re.MULTILINE)

# Intro サマリーの bullet パターン: `- **Q1** [kind] text → summary`
_BRAINDUMP_INTRO_BULLET_RE = re.compile(
    r'^\s*[-*]\s+\*\*?(Q\d+)\*\*?\s*(?:\[[^\]]+\])?\s*(.+?)\s*(?:→\s*(.+?))?\s*$',
    re.MULTILINE,
)

# v11.1: Q&A 早見表 (Markdown table) のパターン: `| Q1 | text | summary | ... |`
_BRAINDUMP_INTRO_TABLE_RE = re.compile(
    r'^\|\s*(Q\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|',
    re.MULTILINE,
)

# Intro セクションの判定 (## Intro: ... の見出し)
_BRAINDUMP_INTRO_HEADING_RE = re.compile(r'^##\s+Intro\b.*$', re.MULTILINE | re.IGNORECASE)


def _split_braindump_sections(md: str) -> Dict[str, str]:
    """
    markdown を見出しレベル ## で章に分割する。
    返り値: { "Intro": "...本文...", "Q1": "...本文...", "Q2": "...", "参考文献": "...", ... }
    """
    sections: Dict[str, str] = {}
    if not md:
        return sections

    # ## 見出しの位置を全部拾う (Q? は数値、それ以外は名前)
    heading_pat = re.compile(r'^##\s+(.+?)\s*$', re.MULTILINE)
    matches = list(heading_pat.finditer(md))
    if not matches:
        return sections

    for i, m in enumerate(matches):
        raw_title = m.group(1).strip()
        # v10.1.5: 'Q1: ...' / '## 1. ... (Q1)' / '## 1. ... [Q1]' / '## 1. Q1 への完全解答 ...' どれでも Q? を key に
        q_match = (
            re.match(r'^(Q\d+)\b', raw_title)
            or re.search(r'[\(\[（［](Q\d+)[\)\]）］]', raw_title)
            or re.search(r'(?:^|[\s\.\-—_])(Q\d+)(?:\s+(?:への|の|は|が|を)|[\s:：])', raw_title)
        )
        if q_match:
            key = q_match.group(1)
        elif (
            re.search(r'(?:^|\b)Intro\b', raw_title, re.IGNORECASE)
            or 'イントロ' in raw_title
            # v11.1: 新 Q&A 早見表 heading `## 1. 解決したい疑問・懸念` も Intro 扱い
            or re.search(r'^\d+\.\s*(?:解決したい)?疑問[・･]?懸念', raw_title)
        ):
            key = 'Intro'
        else:
            key = raw_title

        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(md)
        body = md[start:end].strip()
        sections[key] = body

    return sections


def _extract_intro_qs(intro_body: str) -> List[Dict[str, str]]:
    """Intro セクション本文から Q 一覧を抽出。
    v11.1: Markdown table 形式 (`| Q1 | text | summary | ... |`) と
    旧 bullet 形式 (`- **Q1** [kind] text → summary`) の両方をサポート。
    """
    items: List[Dict[str, str]] = []
    # v11.1: Markdown table 形式を先に試す
    seen = set()
    for m in _BRAINDUMP_INTRO_TABLE_RE.finditer(intro_body):
        qid = m.group(1)
        # ヘッダ行 (| Q# | ... |) や区切り行を除外
        if qid in seen or qid.lower() in {'q#', 'q＃'}:
            continue
        seen.add(qid)
        text = (m.group(2) or '').strip()
        summary = (m.group(3) or '').strip()
        # `[Q? 章へ](#q?)` のようなリンク表記が summary 末尾に来た時の整形は不要
        items.append({'qid': qid, 'text': text, 'summary': summary})
    if items:
        return items
    # legacy: bullet 形式
    for m in _BRAINDUMP_INTRO_BULLET_RE.finditer(intro_body):
        qid = m.group(1)
        text = (m.group(2) or '').strip()
        summary = (m.group(3) or '').strip()
        items.append({'qid': qid, 'text': text, 'summary': summary})
    return items


def _net_char_count(text: str) -> int:
    """空白・改行を除いた文字数。"""
    return len(re.sub(r'\s+', '', text or ''))


def _split_paragraphs(text: str) -> List[str]:
    """空行区切りで段落に分割。"""
    if not text:
        return []
    paragraphs = re.split(r'\n\s*\n', text)
    return [p.strip() for p in paragraphs if p.strip()]


def _split_sentences(text: str) -> List[str]:
    """日本語の句点で文に分割。"""
    if not text:
        return []
    parts = re.split(r'[。．！？!?]', text)
    return [p.strip() for p in parts if p.strip()]


# ───────────────────────────────────────────────────────
# v10.0γ-final / v10.1.7 (2026-05-08): braindump rule split
# ───────────────────────────────────────────────────────
# braindump モードから WritingQA-02 / 03 / 04 / 09 / 11 / 12 を撤去。
# ja-writing skill (standalone) が散文の翻訳調 / ハイプ語 / 助詞 4 連 /
# 二重否定 / 横文字 / 箱型比喩を見るので、機械側で重複検出しない。
# 対応する `_check_braindump_translation` / `_hype` / `_doubled_joshi` /
# `_double_negative` / `_western` / `_metaphor` の 6 ヘルパは
# v10.0γ-final cleanup で削除。復活させる場合は
# versions/enostech-slides_v10.1.6_pre-rule-split_2026-05-08.skill
# の同名ヘルパを参照すること。
#
# WritingQA-23 「1 つの Q 章本文が 1500 字を超えたら warn」 は
# v10.0γ-final で **採用見送り** が確定:
#   - 機械的に上限を切ると論理展開を中途半端に切り上げるインセンティブが働く
#   - 完全解答性 (1 つの疑問に答えきる) を損なうリスクが上回る
#   - 長文側のさじ加減は ja-writing skill の 4 原則と人間レビューに委ねる
# 機械チェックは下限ガード (将来 WritingQA-31 以降で実装するなら別番号) のみ。
# ───────────────────────────────────────────────────────


def _check_braindump_taigen_streak(text: str, target: str,
                                    violations: List[Dict[str, Any]]) -> None:
    """v9.37 WritingQA-21: 体言止め文末が連続 (5 文中 3 件以上) fatal。"""
    sentences = _split_sentences(text)
    if len(sentences) < 5:
        return
    # 5 文の窓を sliding させ、3 件以上が体言止めなら fatal
    for i in range(len(sentences) - 4):
        window = sentences[i:i + 5]
        taigen_count = sum(1 for s in window if ends_with_taigen(s))
        if taigen_count >= 3:
            samples = [s[-15:] for s in window if ends_with_taigen(s)][:3]
            _add(
                violations,
                rule_id='WritingQA-21',
                target=target,
                message=(
                    f'体言止め文末が 5 文中 {taigen_count} 件連続: '
                    f'例 「…{samples[0]}」'
                ),
                severity='fatal',
                fix='ですます調 (〜です / 〜ます / 〜してください) に書き換える。'
                    '体言止めは見出しと Intro サマリの矢印先のみ許容',
            )
            return


def _check_braindump_long_paragraph(text: str, target: str,
                                     violations: List[Dict[str, Any]]) -> None:
    """v9.37 WritingQA-22: 段落 800 字超 warn。"""
    for i, p in enumerate(_split_paragraphs(text)):
        net = _net_char_count(p)
        if net > 800:
            _add(
                violations,
                rule_id='WritingQA-22',
                target=f'{target} 段落#{i+1}',
                message=f'1 段落 {net} 字 (800 超): 改行で区切るサイン',
                severity='warn',
                fix='論点ごとに段落を割る。1 段落 200-500 字が読みやすい',
            )
            return  # 1 章 1 件で十分


# ───────────────────────────────────────────────────────
# v10.1 (2026-05-08): WritingQA-25/26/27 — ファクト参照 [N] 必須化
# ───────────────────────────────────────────────────────

_BD_NUMBER_FACT_RE = re.compile(
    r"\d+(?:[.,]\d+)?\s*(?:%|％|億円|億|万円|万|千|件|社|人|万人|名|歳|年|日|月|時間|分|秒|位|台|店舗|拠点|円|ドル|USD|JPY|RMB|EUR|GBP|倍|pt|ポイント)"
)

# v10.1.6 (2026-05-08): 固有名詞検出を廃止。osanai 氏指摘 (2026-05-08):
# 「固有名詞だけで [N] 必須は厳しすぎ。Slack / Anthropic / トヨタ みたいな
# 普通の固有名詞にまで [N] 要求は意味不明」を構造解決。
# 復活する場合は versions/enostech-slides_v10.1.6_pre-rule-split_2026-05-08.skill 参照。

_BD_REF_INLINE_RE = re.compile(r"\[(\d+)\]")
_BD_NO_REF_TAG_RE = re.compile(r"\[no-ref\]\s*$")
_BD_VISUAL_FM_RE = re.compile(r"^>\s*visual\s*[:：]\s*(\S+)\s*$", re.MULTILINE)


def _parse_references_table(md):
    """`## 0. References` (or `## 参考文献`) 直下の Markdown table をパース。"""
    if not md:
        return {}
    heading_pat = re.compile(
        r"^##\s+(?:0\.\s*References|References|参考文献)[^\n]*$",
        re.MULTILINE | re.IGNORECASE,
    )
    m = heading_pat.search(md)
    if not m:
        return {}
    body = md[m.end():]
    next_h = re.search(r"^##\s+", body, re.MULTILINE)
    if next_h:
        body = body[:next_h.start()]
    out = {}
    for row in body.splitlines():
        row = row.strip()
        if not row.startswith("|"):
            continue
        cells = [c.strip() for c in row.strip("|").split("|")]
        if len(cells) < 2:
            continue
        m_num = re.search(r"\[(\d+)\]", cells[0])
        if not m_num:
            continue
        num = int(m_num.group(1))
        out[num] = {
            "title": cells[1] if len(cells) > 1 else "",
            "url": cells[2] if len(cells) > 2 else "",
            "source": cells[3] if len(cells) > 3 else "",
            "accessed": cells[4] if len(cells) > 4 else "",
        }
    return out


def _check_braindump_inline_ref(text, target, violations):
    """v10.1.6 WritingQA-25 (fatal): 数値ファクトを含む段落に [N] 0 件で fatal。

    v10.1.6 改修 (2026-05-08): 固有名詞検出を廃止。osanai 氏指摘より、
    Slack / Anthropic / トヨタ / Trader Joe のような普通の固有名詞にまで
    [N] を要求するのは過剰なため、検出対象を「数値 + 単位 (10億円 / 50% /
    100件 / 3年 等)」のみに限定。固有名詞の出典管理は人間判断に委ねる。
    """
    for i, p in enumerate(_split_paragraphs(text)):
        non_meta_lines = [ln for ln in p.splitlines() if not ln.lstrip().startswith(("|", ">"))]
        if not non_meta_lines:
            continue
        net_text = "\n".join(non_meta_lines)
        # v10.1.6: 数値ファクトのみ対象
        has_fact = bool(_BD_NUMBER_FACT_RE.search(net_text))
        has_ref = bool(_BD_REF_INLINE_RE.search(net_text))
        has_escape = bool(_BD_NO_REF_TAG_RE.search(net_text.rstrip()))
        if has_fact and not has_ref:
            severity = "warn" if has_escape else "fatal"
            _add(
                violations,
                rule_id="WritingQA-25",
                target=f"{target} 段落#{i+1}",
                message="数値ファクト (X% / N億円 / M件 等) を含む段落に [N] (ファクト参照) がありません",
                severity=severity,
                fix="出典に対応する [1] [10] を文末に置く。出典不要なら段落末尾に [no-ref] を付ける",
            )


def _check_braindump_orphan_ref(text, refs_table, target, violations):
    """v10.1 WritingQA-26 (fatal): 本文 [N] が References table に未登録。"""
    if not text:
        return
    seen = set()
    for m in _BD_REF_INLINE_RE.finditer(text):
        num = int(m.group(1))
        if num in seen:
            continue
        seen.add(num)
        if num not in refs_table:
            _add(
                violations,
                rule_id="WritingQA-26",
                target=target,
                message=f"本文中の [{num}] が ## 0. References テーブルに存在しません (孤児参照)",
                severity="fatal",
                fix="References に [{N}] 行を追加するか、本文の番号を直す",
            )


def _check_braindump_orphan_link(refs_table, used_nums, violations):
    """v10.1 WritingQA-27 (warn): References table の [N] が本文未使用。"""
    for num in sorted(refs_table.keys()):
        if num not in used_nums:
            _add(
                violations,
                rule_id="WritingQA-27",
                target=f"## 0. References [{num}]",
                message=f"References テーブル登録の [{num}] が本文中で未使用",
                severity="warn",
                fix=f"本文に [{num}] を引用するか、未使用なら References から削除",
            )


def _check_braindump_visual_required(text, target, violations):
    """v10.1.1 WritingQA-28 (warn): visual: required の Q 章に <img> / ![alt](path) が無い時 warn。

    braindump-illust.py が走っていない / 走ったが失敗した検出に使う。
    fatal にすると illust 走行前に蹴られるので warn 止め。
    """
    if not text:
        return
    has_visual_required = bool(re.search(r"^>\s*visual\s*[:：]\s*required\s*$", text, re.MULTILINE))
    if not has_visual_required:
        return
    has_img = bool(re.search(r"!\[[^\]]*\]\([^)]+\.(?:png|jpg|jpeg|svg|gif|webp)[^)]*\)", text, re.IGNORECASE))
    has_html_img = bool(re.search(r"<img\s+[^>]*src=", text, re.IGNORECASE))
    if not (has_img or has_html_img):
        _add(
            violations,
            rule_id="WritingQA-28",
            target=target,
            message="visual: required と書かれているが <img> / ![alt](path) が章内に無い",
            severity="warn",
            fix="braindump-illust.py を走らせるか、visual: optional / none に下げる",
        )


# v10.1.5 (2026-05-08): WritingQA-29 — Q 章 frontmatter に visual: 行必須化 (fatal)
# v10.1.5 (2026-05-08): WritingQA-30 — visual: required で illust 実行痕跡が必須 (fatal)
_VISUAL_LINE_RE = re.compile(r"^>\s*visual\s*[:：]\s*(required|optional|none)\s*$", re.MULTILINE)


def _check_braindump_visual_frontmatter(text, target, violations):
    """v10.1.5 WritingQA-29 (fatal): Q 章 frontmatter に `> visual:` 行が無いと fatal。

    背景: v10.1.4 まで visual: 行は省略可だったため、AI が visual frontmatter を
    書かずに braindump.md を完成させる事故が多発 (ADR デッキ 2026-05-08 で 9 章
    すべてが visual: 行欠落のまま通過)。「飛ばされた」と「不要判断」を区別する
    ため、Q 章には必ず visual: required / optional / none のいずれかを書く。

    対象: Q1, Q2, ... の本文 (Intro / 補足章は対象外)
    """
    if not text or not target:
        return
    # Intro / 補足章は対象外、Q 章のみチェック
    if not re.match(r'^Q\d+', target):
        return
    if _VISUAL_LINE_RE.search(text):
        return
    _add(
        violations,
        rule_id="WritingQA-29",
        target=target,
        message="Q 章 frontmatter に `> visual:` 行が無い (required/optional/none のいずれか必須)",
        severity="fatal",
        fix=(
            "Q 章先頭の frontmatter ブロックに `> visual: required` (図解必要) / "
            "`> visual: optional` (あってもなくてもよい) / `> visual: none` "
            "(図解不要を明示) のいずれかを必ず書く"
        ),
    )


def _check_braindump_illust_run_log(md_path, md, violations):
    """v10.1.5 WritingQA-30 (fatal): visual: required の Q が 1 件以上ある時、
    braindump_assets/.illust-run.json が存在しないと fatal。

    背景: braindump-illust.py を呼ばずに visual: required と書いただけで
    通過する抜け道を塞ぐ。illust 実行ログ (.illust-run.json) の有無で
    「走った」「走っていない」を機械的に区別。
    """
    from pathlib import Path as _Path
    if not md or not md_path:
        return
    has_required = bool(re.search(
        r"^>\s*visual\s*[:：]\s*required\s*$", md, re.MULTILINE
    ))
    if not has_required:
        return
    md_p = _Path(md_path) if not isinstance(md_path, _Path) else md_path
    deck_dir = md_p.parent
    run_log = deck_dir / 'braindump_assets' / '.illust-run.json'
    if run_log.exists():
        return
    _add(
        violations,
        rule_id="WritingQA-30",
        target="braindump 全体",
        message=(
            "visual: required の Q 章があるが braindump_assets/.illust-run.json が無い "
            "(braindump-illust.py 未実行)"
        ),
        severity="fatal",
        fix=(
            "`python3 scripts/braindump-illust.py -i decks/{slug}/braindump.md` を"
            "実行する (Step 1.8-3)。図解不要なら該当 Q 章の visual: を none に下げる"
        ),
    )


def _check_braindump_intro_count(intro_qs: List[Dict[str, str]],
                                   chapter_qids: List[str],
                                   external_questions: Optional[List[Dict[str, Any]]],
                                   violations: List[Dict[str, Any]],
                                   strict_count: bool = True) -> None:
    """
    v9.37 WritingQA-24: Intro Q 件数 / Q 章件数 / 外部 questions[] 件数の整合チェック。
    """
    intro_qids = [q['qid'] for q in intro_qs]
    intro_set = set(intro_qids)
    chapter_set = set(chapter_qids)

    # Intro vs 章
    if intro_set != chapter_set:
        only_intro = intro_set - chapter_set
        only_chapter = chapter_set - intro_set
        diff_msg = []
        if only_intro:
            diff_msg.append(f'Intro のみ: {sorted(only_intro)}')
        if only_chapter:
            diff_msg.append(f'章のみ: {sorted(only_chapter)}')
        _add(
            violations,
            rule_id='WritingQA-24',
            target='braindump 全体',
            message=f'Intro サマリーの Q 件数 ({len(intro_qids)}) と Q 章 ({len(chapter_qids)}) が不一致。{" / ".join(diff_msg)}',
            severity='fatal',
            fix='Intro サマリーの bullet 数と ## Q? 章の数を揃える',
        )

    # Intro サマリーの矢印先 (summary) 空欄チェック
    for q in intro_qs:
        if not q['summary']:
            _add(
                violations,
                rule_id='WritingQA-24',
                target=f'Intro {q["qid"]}',
                message=f'Intro サマリーで {q["qid"]} の矢印先 (→ ...) が空',
                severity='fatal',
                fix=f'{q["qid"]} の本質的な答えを 40-80 字でこの行に書く (QA-INDEX スライドの cells になる)',
            )

    # 外部 questions[] (plan.json) との照合
    if external_questions is not None:
        ext_qids = [q.get('id') for q in external_questions if isinstance(q, dict)]
        ext_set = set(qid for qid in ext_qids if qid)
        if ext_set and ext_set != intro_set:
            only_ext = ext_set - intro_set
            only_intro2 = intro_set - ext_set
            diff_msg = []
            if only_ext:
                diff_msg.append(f'questions[] のみ: {sorted(only_ext)}')
            if only_intro2:
                diff_msg.append(f'Intro のみ: {sorted(only_intro2)}')
            severity = 'fatal' if strict_count else 'warn'
            _add(
                violations,
                rule_id='WritingQA-24',
                target='braindump vs plan.json',
                message=f'Intro Q ({len(intro_qids)}) と plan.json questions[] ({len(ext_qids)}) が不一致。{" / ".join(diff_msg)}',
                severity=severity,
                fix='Phase 1 の questions[] と Intro の Q を揃える',
            )


def validate_writing_qa_braindump(md: str,
                                    questions: Optional[List[Dict[str, Any]]] = None,
                                    strict_count: bool = True,
                                    md_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """
    v9.37 (2026-05-06): braindump.md (markdown) を検査する。

    Args:
        md: braindump.md の本文
        questions: 任意の plan.json questions[] (件数照合用)
        strict_count: True 時、外部 questions[] との件数不一致を fatal に

    Returns:
        violations のリスト (rule_id / target / message / severity / fix)
    """
    violations: List[Dict[str, Any]] = []
    if not md or not md.strip():
        _add(
            violations,
            rule_id='WritingQA-24',
            target='braindump 全体',
            message='braindump.md が空',
            severity='fatal',
            fix='Phase 1.8 で braindump.md を書き上げる',
        )
        return violations

    sections = _split_braindump_sections(md)
    intro_body = sections.get('Intro', '')
    intro_qs = _extract_intro_qs(intro_body)

    # Q 章の抽出
    chapter_qids = sorted(
        [k for k in sections.keys() if re.match(r'^Q\d+$', k)],
        key=lambda x: int(x[1:])
    )

    # WritingQA-24: 件数整合
    _check_braindump_intro_count(
        intro_qs, chapter_qids, questions, violations, strict_count
    )

    # 各 Q 章 + Intro 全体に対して長文ルールを走らせる
    targets: List[Tuple[str, str]] = []
    if intro_body:
        targets.append(('Intro サマリー', intro_body))
    for qid in chapter_qids:
        targets.append((f'{qid} 章', sections[qid]))

    # v10.1.6 (2026-05-08): braindump rule split — 文体系を全部 OFF。
    # braindump.md は「散文の書き下ろし SSOT (思考メモ)」であって、読み物の
    # 最終アウトプットではない。文体は plan.json に圧縮する Phase 2 で整える。
    # OFF にしたルール:
    #   WritingQA-02 (翻訳調 fatal)         — v10.1.5 以前に既に削除
    #   WritingQA-03 (ハイプ語 fatal)        — v10.1.5 以前に既に削除
    #   WritingQA-04 (助詞 4 連 fatal)       — v10.1.5 以前に既に削除
    #   WritingQA-09 (二重否定 warn)         — v10.1.5 以前に既に削除
    #   WritingQA-11 (横文字侵入 warn)       — v10.1.5 以前に既に削除
    #   WritingQA-12 (箱型比喩候補 warn)     — v10.1.5 以前に既に削除
    #   WritingQA-21 (体言止め連続 fatal)    — v10.1.6 で削除 (osanai 氏指摘の本命)
    #   WritingQA-22 (段落 800 字超 warn)    — v10.1.6 で削除
    # 残しているのは以下の構造ルールのみ (下のブロックで実行):
    #   WritingQA-24 (Intro件数整合 fatal)
    #   WritingQA-25/26/27 (ファクト参照 [N] fatal/fatal/warn)
    #   WritingQA-28 (visual: required と <img> 整合 warn)
    #   WritingQA-29 (Q 章 frontmatter visual: 行必須 fatal)
    #   WritingQA-30 (visual: required で illust 実行ログ必須 fatal)
    # 復活する場合は versions/enostech-slides_v10.1.6_pre-rule-split_2026-05-08.skill 参照。

    # v10.1: ファクト参照 [N] 必須化 (WritingQA-25/26/27)
    refs_table = _parse_references_table(md)
    used_nums = set()
    for tgt_label, tgt_text in targets:
        _check_braindump_inline_ref(tgt_text, tgt_label, violations)
        _check_braindump_orphan_ref(tgt_text, refs_table, tgt_label, violations)
        # v10.1.5: WritingQA-29 Q 章 frontmatter に visual: 行必須
        _check_braindump_visual_frontmatter(tgt_text, tgt_label, violations)
        # v10.1.1: WritingQA-28 visual: required / <img> 整合
        _check_braindump_visual_required(tgt_text, tgt_label, violations)
        for m in _BD_REF_INLINE_RE.finditer(tgt_text or ""):
            used_nums.add(int(m.group(1)))
    if refs_table:
        _check_braindump_orphan_link(refs_table, used_nums, violations)

    # v10.1.5: WritingQA-30 illust 実行ログ必須
    _check_braindump_illust_run_log(md_path, md, violations)

    return violations


# ───────────────────────────────────────────────────────
# メインエントリ (plan.json モード)
# ───────────────────────────────────────────────────────

def validate_writing_qa(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    deck-instruction JSON を受け取り、WritingQA 違反のリストを返す。
    既存の validate_schema_qa と同じシグネチャ。
    """
    violations: List[Dict[str, Any]] = []

    doc = data.get('doc') or {}
    if doc.get('writing_qa_disabled') is True:
        return violations

    strict = doc.get('writing_strict') is not False
    narration_strict = doc.get('narration_strict') is True

    all_slides: List[Dict[str, Any]] = []

    sections = data.get('sections') or []
    for sec in sections:
        for s in (sec.get('slides') or []):
            if isinstance(s, dict):
                all_slides.append(s)

    for s in (data.get('header') or []):
        if isinstance(s, dict):
            all_slides.append(s)
    body = data.get('body')
    if isinstance(body, dict):
        for ch in (body.get('chapters') or []):
            for k in ('head', 'content', 'tail'):
                for s in (ch.get(k) or []):
                    if isinstance(s, dict):
                        all_slides.append(s)
    elif isinstance(body, list):
        for s in body:
            if isinstance(s, dict):
                all_slides.append(s)
    for s in (data.get('footer') or []):
        if isinstance(s, dict):
            all_slides.append(s)

    seen_keys = set()
    deduped: List[Dict[str, Any]] = []
    for s in all_slides:
        sid = s.get('id')
        key = sid if sid else f'__obj_{id(s)}__'
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(s)

    for slide in deduped:
        _check_subtitle_length(slide, violations)
        _check_translation_style(slide, violations)
        _check_hype(slide, violations)
        _check_doubled_joshi(slide, violations)
        _check_colon_block(slide, violations)
        _check_weak_phrases(slide, violations)
        _check_sentence_length(slide, violations)
        _check_max_ten(slide, violations)
        _check_double_negative(slide, violations)
        _check_nominalization(slide, violations)
        _check_western(slide, violations)
        _check_metaphor(slide, violations)
        _check_desumasu_unification(slide, violations, strict=strict)
        _check_narration_length(slide, violations, strict=narration_strict)
        _check_narration_visual_dependent(slide, violations, strict=narration_strict)
        _check_narration_list_markup(slide, violations, strict=narration_strict)
        _check_narration_taigen_end(slide, violations, strict=narration_strict)
        _check_framing5_mindset_desumasu(slide, violations, strict=narration_strict)

    return violations


# ───────────────────────────────────────────────────────
# CLI
# ───────────────────────────────────────────────────────

def _print_violations(violations: List[Dict[str, Any]]) -> None:
    if not violations:
        print('✅ WritingQA: 違反なし', file=sys.stderr)
        return
    fatal = [v for v in violations if v.get('severity') == 'fatal']
    warn = [v for v in violations if v.get('severity') == 'warn']
    print(f'WritingQA 違反 {len(violations)} 件 (fatal: {len(fatal)} / warn: {len(warn)})', file=sys.stderr)
    for v in violations:
        sev = v.get('severity', '?')
        print(f'  [{sev}] {v["rule_id"]} {v["target"]} — {v["message"]}', file=sys.stderr)
        if v.get('fix'):
            print(f'         Fix: {v["fix"]}', file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description='Writing QA validator')
    parser.add_argument('--input', '-i', required=True, help='plan.json or braindump.md path')
    parser.add_argument('--mode', choices=['plan', 'braindump'], default=None,
                        help='検査モード (省略時は拡張子から自動判定: .md → braindump / .json → plan)')
    parser.add_argument('--questions', default=None,
                        help='braindump モードで件数照合に使う plan.json (任意)')
    parser.add_argument('--strict', action='store_true', help='fatal violations で exit 2')
    parser.add_argument('--json', action='store_true', help='JSON 形式で出力')
    args = parser.parse_args()

    # mode 自動判定
    mode = args.mode
    if mode is None:
        if args.input.lower().endswith('.md'):
            mode = 'braindump'
        else:
            mode = 'plan'

    if mode == 'braindump':
        with open(args.input, 'r', encoding='utf-8') as f:
            md = f.read()
        questions = None
        strict_count = True
        if args.questions:
            try:
                with open(args.questions, 'r', encoding='utf-8') as f:
                    qdata = json.load(f)
                doc = qdata.get('doc') or {}
                questions = doc.get('questions') or qdata.get('questions') or None
            except Exception as e:
                print(f'⚠ questions ファイル読み込み失敗: {e}', file=sys.stderr)
                strict_count = False
        else:
            strict_count = False
        violations = validate_writing_qa_braindump(
            md, questions=questions, strict_count=strict_count, md_path=Path(args.input)
        )
    else:
        with open(args.input, 'r', encoding='utf-8') as f:
            data = json.load(f)
        violations = validate_writing_qa(data)

    if args.json:
        json.dump(violations, sys.stdout, ensure_ascii=False, indent=2)
        print()
    else:
        _print_violations(violations)

    if args.strict:
        fatal = [v for v in violations if v.get('severity') == 'fatal']
        if fatal:
            return 2

    return 0


if __name__ == '__main__':
    sys.exit(main())
