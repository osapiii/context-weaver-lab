#!/usr/bin/env python3
"""
render-deck-instruction.py
==========================
Phase 2 の HTML 指示書を JSON データから Jinja2 で生成する。

これまで Claude が 1200 行の HTML を毎回書き出していたのを、
データ JSON (~数百行) の出力＋スクリプト実行で置き換えることで、
**実行時間を 10 倍以上短縮** する。
base64 画像は template_id から自動解決するため、Claude は画像を
いっさい書き出す必要がない。

【使い方】

  CLI (標準入力 → 標準出力):
    cat deck.json | python3 render-deck-instruction.py > output.html

  CLI (ファイル指定):
    python3 render-deck-instruction.py --input deck.json --output out.html

  Python API:
    from render_deck_instruction import render
    html = render(data_dict)
    with open('out.html', 'w') as f: f.write(html)

【データ JSON スキーマ】
  詳細は references/phase2-information-design/deck-instruction-schema.md を参照。

【依存】
  jinja2 (通常 Claude 環境に入っている。無ければ pip install jinja2)
"""

import sys
import json
import base64
import argparse
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).resolve().parent

try:
    from jinja2 import Environment, FileSystemLoader, select_autoescape
except ImportError:
    print("Error: jinja2 not installed. Run: pip install jinja2 --break-system-packages", file=sys.stderr)
    sys.exit(1)


SKILL_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = SKILL_ROOT / 'references' / 'phase2-information-design'
TEMPLATE_NAME = 'deck-instruction.jinja.html'
PREVIEW_DIR = SKILL_ROOT / 'assets' / 'template-previews'


# decks/{slug}/palette.yml を読み、Jinja に palette 変数として渡す。
# これにより plan.html と pptx が同じ色で揃う。
DEFAULT_PALETTE = {
    'meta': {'name': 'ENOSTECH Default', 'generated_from': 'default'},
    'colors': {
        'brand':             '1F2937',
        'brandSoft':         'E5E7EB',
        'brandDeep':         '111827',
        'brandContrast':     'FFFFFF',
        'accent':            '475569',
        'accentSoft':        'E2E8F0',
        'accentDeep':        '334155',
        'accentContrast':    'FFFFFF',
        'highlight':         'F59E0B',
        'highlightSoft':     'FEF3C7',
        'highlightDeep':     'B45309',
        'highlightContrast': 'FFFFFF',
        'ink':               '1F2937',
        'canvas':            'FAFAF7',
        'gray700':           '404040',
        'gray500':           '737373',
        'gray200':           'E5E5E5',
    },
    'typography': {'fontFace': 'Noto Sans JP'},
}


def _parse_palette_yml(text: str) -> dict:
    """palette.yml を最小パーサで読む (palette-yml.js と同じスキーマ)。

    section: -> { key: value } の 2 階層フラット構造のみ対応。
    colors セクションは数値変換しない (HEX 数字オンリーが Number 化される事故を防ぐ)。
    """
    import re as _re
    result = {}
    current_section = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue
        if line.lstrip().startswith('#'):
            continue
        sec_m = _re.match(r'^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(?:#.*)?$', line)
        if sec_m:
            current_section = sec_m.group(1)
            result.setdefault(current_section, {})
            continue
        kv_m = _re.match(r'^\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+?)\s*(?:#.*)?$', line)
        if kv_m and current_section:
            key = kv_m.group(1)
            val = kv_m.group(2).strip()
            was_quoted = val.startswith('"') or val.startswith("'")
            val = val.strip('"').strip("'")
            is_colors = (current_section == 'colors')
            if not was_quoted and not is_colors and _re.match(r'^-?\d+(\.\d+)?$', val):
                result[current_section][key] = float(val) if '.' in val else int(val)
            else:
                result[current_section][key] = val
    return result


def resolve_palette(plan_input_path) -> dict:
    """plan.json の所在から palette.yml を解決して返す。

    無ければ DEFAULT_PALETTE を返す。pptx 側 (build-deck.js) と同じファイルを
    読むので SSOT が一致する。
    """
    if not plan_input_path:
        return DEFAULT_PALETTE
    plan_dir = Path(plan_input_path).resolve().parent
    palette_path = plan_dir / 'palette.yml'
    if not palette_path.exists():
        return DEFAULT_PALETTE
    try:
        text = palette_path.read_text(encoding='utf-8')
        parsed = _parse_palette_yml(text)
        merged_colors = {**DEFAULT_PALETTE['colors'], **(parsed.get('colors') or {})}
        return {
            'meta': parsed.get('meta', {}),
            'colors': merged_colors,
            'typography': parsed.get('typography') or DEFAULT_PALETTE['typography'],
        }
    except Exception as e:
        print(f'⚠️  palette.yml parse failed: {e}', file=sys.stderr)
        return DEFAULT_PALETTE

# v5.1 でフォルダを 1 つに統合。assets/template-previews/ は高解像 (1000px) を保持し、
# ここで指示書 Base64 埋め込み用に 160px へオンデマンドリサイズする。
# get-template-preview.py と同じロジックを使うので、scripts ディレクトリを sys.path に通す。
sys.path.insert(0, str(SKILL_ROOT / 'scripts'))
try:
    # ハイフン入りのモジュール名は importlib 経由で読む
    import importlib.util
    _spec = importlib.util.spec_from_file_location(
        'get_template_preview',
        SKILL_ROOT / 'scripts' / 'get-template-preview.py',
    )
    _gtp = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_gtp)
    _read_bytes_resized = _gtp._read_bytes_resized
except Exception:
    _read_bytes_resized = None

try:
    import importlib.util as _ilu
    _spec_sqa = _ilu.spec_from_file_location(
        'schema_qa',
        SKILL_ROOT / 'scripts' / 'schema-qa.py',
    )
    _sqa = _ilu.module_from_spec(_spec_sqa)
    _spec_sqa.loader.exec_module(_sqa)
    validate_schema_qa = _sqa.validate_schema_qa
except Exception as _e:
    # schema-qa.py が無い古い環境でも render が止まらないようフォールバック
    print(f'⚠️  SchemaQA module load failed: {_e}', file=sys.stderr)
    def validate_schema_qa(data):
        return []

try:
    _spec_wqa = _ilu.spec_from_file_location(
        'writing_qa',
        SKILL_ROOT / 'scripts' / 'writing-qa.py',
    )
    _wqa = _ilu.module_from_spec(_spec_wqa)
    _spec_wqa.loader.exec_module(_wqa)
    validate_writing_qa = _wqa.validate_writing_qa
except Exception as _e:
    print(f'⚠️  WritingQA module load failed: {_e}', file=sys.stderr)
    def validate_writing_qa(data):
        return []


def load_preview_base64(template_id: str) -> str:
    """
    SECTION-1 / DIAG-03 等の template_id から、対応する jpg を base64 化して返す。
    見つからない場合は空文字列（テンプレート側で <img> は出力されない）。

    v5.1 以降は高解像ソースを Pillow で 160px に縮小してから埋め込む。
    """
    if not template_id:
        return ''
    jpg_path = PREVIEW_DIR / f'{template_id}.jpg'
    if not jpg_path.exists():
        return ''
    if _read_bytes_resized is not None:
        data = _read_bytes_resized(jpg_path)
    else:
        data = jpg_path.read_bytes()
    return base64.b64encode(data).decode('ascii')


def build_all_slides(sections):
    """quick-nav 用に、全セクションのスライドを 1 つの配列にフラット化する。
    illustration がネストされているスライドには、直後に synthesize された
    {id}-VISUAL の付帯カードを差し込む。"""
    out = []
    for sec in sections:
        for slide in sec.get('slides', []):
            out.append({'id': slide['id']})
            if slide.get('illustration'):
                out.append({'id': f"{slide['id']}-VISUAL"})
    return out


def inject_previews(sections):
    """各スライドの preview_base64 フィールドを template_id から解決して埋め込む。"""
    for sec in sections:
        for slide in sec.get('slides', []):
            if 'preview_base64' not in slide:
                slide['preview_base64'] = load_preview_base64(slide.get('template_id', ''))
    return sections


def inject_raw_json(sections):
    """
    各スライドに _raw_json (整形済み JSON 文字列) を注入する。
    HTML 側の「🔧 JSON を見る」ボタンで表示するためのデータ。
    _raw_json 自身と preview_base64 / real_preview_data_uri (巨大バイナリ) は出力から除外。
    """
    EXCLUDED = {'preview_base64', 'real_preview_data_uri', 'real_preview_index'}
    for sec in sections:
        for slide in sec.get('slides', []):
            visible = {
                k: v for k, v in slide.items()
                if not k.startswith('_') and k not in EXCLUDED
            }
            slide['_raw_json'] = json.dumps(visible, ensure_ascii=False, indent=2)
    return sections


def inject_real_previews(sections, preview_dir):
    """
    Phase 2 で draft.pptx から PNG 化された preview/slide-NN.png を
    各スライドに埋め込む。

    - preview_dir が None または該当ファイル無 → real_preview_data_uri は付けない
      (Jinja 側でプレースホルダ '実プレビュー未生成' を表示)
    - 順序ベースで slide-NN.png を引き当てる（plan.json の sections[].slides[] フラット順 = 1-indexed）
    - PNG は Base64 で data URI 化して slide.real_preview_data_uri に注入
    - 同時に slide.real_preview_index に PNG 番号 (1-indexed) を入れて Jinja 表示に使う

    Returns: (matched_count, missing_slide_ids)
    """
    import base64
    from pathlib import Path as _Path

    matched = 0
    missing = []
    idx = 0
    pdir = _Path(preview_dir) if preview_dir else None
    for sec in sections:
        for slide in sec.get('slides', []):
            idx += 1
            slide['real_preview_index'] = idx
            if pdir is None:
                missing.append(slide.get('id', f'slide#{idx}'))
                continue
            png_path = pdir / f'slide-{idx:02d}.png'
            if not png_path.is_file():
                missing.append(slide.get('id', f'slide#{idx}'))
                continue
            try:
                data = png_path.read_bytes()
                b64 = base64.b64encode(data).decode('ascii')
                slide['real_preview_data_uri'] = f'data:image/png;base64,{b64}'
                matched += 1
            except OSError as e:
                print(f'⚠️  failed to read {png_path}: {e}', file=sys.stderr)
                missing.append(slide.get('id', f'slide#{idx}'))
    return matched, missing
    return sections


def compute_counts(data):
    """タブバーのカウントを自動計算（v3.9: 2 タブ構成、VISUAL 付帯カードも1件としてカウント）。"""
    final_count = 0
    for s in data.get('sections', []):
        for slide in s.get('slides', []):
            final_count += 1
            if slide.get('illustration'):
                final_count += 1  # synthesize される VISUAL カード分
    # reviews[] 全サイクルの issues 総数
    review_count = 0
    for cyc in data.get('reviews', []) or []:
        review_count += len(cyc.get('issues', []) or [])
    return {
        'final': final_count,
        'review': review_count,
    }


def validate_v39(data):
    """v3.9 の MUST ルール違反を stderr に警告する (Fatal ではない)。
    違反を return list で返すようになった (qa_report の M? 層に集約するため)。
    互換のため stderr 出力も維持。
    """
    violations = []  # list of {rule_id, target, message, severity}

    # M2: reviews は 4 サイクル、各サイクルに 1 人の persona、4 人とも別人
    # v9.5: 専門レビュアー枠 (review_type が指定されたサイクル) は 4 人重複ガードから除外。
    #        generic ペルソナの数だけを 4 件としてカウントする。
    REVIEWER_CYCLES = 4
    reviews = data.get('reviews')
    if not isinstance(reviews, list):
        violations.append({
            'rule_id': 'M2',
            'target': 'reviews',
            'message': f'reviews must be a list (found {type(reviews).__name__ if reviews is not None else "none"})',
            'severity': 'fatal',
            'fix': f'{REVIEWER_CYCLES} サイクルの persona オブジェクトを reviews[] に詰める',
        })
    else:
        # generic レビュー (review_type 未指定) と専門レビュー (review_type ありなど) を分離
        generic_reviews = [c for c in reviews if isinstance(c, dict) and not c.get('review_type')]
        special_reviews = [c for c in reviews if isinstance(c, dict) and c.get('review_type')]

        if len(generic_reviews) != REVIEWER_CYCLES:
            violations.append({
                'rule_id': 'M2',
                'target': 'reviews',
                'message': f'reviews must have exactly {REVIEWER_CYCLES} generic cycles (found {len(generic_reviews)} generic + {len(special_reviews)} specialist)',
                'severity': 'fatal',
                'fix': f'{REVIEWER_CYCLES} サイクルの generic persona を reviews[] に詰める。専門レビュアー (review_type) は別枠でカウント',
            })

        # generic レビューのペルソナ重複ガード
        persona_names = []
        for i, cyc in enumerate(generic_reviews, 1):
            persona = cyc.get('persona')
            if not isinstance(persona, dict) or not persona.get('name'):
                violations.append({
                    'rule_id': 'M2',
                    'target': f'reviews[{i-1}].persona',
                    'message': f'generic cycle {i} must have a single "persona" object with "name"',
                    'severity': 'fatal',
                    'fix': f'generic cycle {i} に persona.name を埋める',
                })
            else:
                persona_names.append(persona.get('name', ''))
        if len(persona_names) == REVIEWER_CYCLES and len(set(persona_names)) != REVIEWER_CYCLES:
            dups = sorted(set(n for n in persona_names if persona_names.count(n) > 1))
            violations.append({
                'rule_id': 'M2',
                'target': 'reviews[*].persona',
                'message': f'all {REVIEWER_CYCLES} generic cycles must have different personas (duplicate name: {dups})',
                'severity': 'fatal',
                'fix': '重複している persona を別人に差し替える',
            })

        # 専門レビュアー (review_type) のペルソナは name だけ要求 (重複ガードはしない)
        for i, cyc in enumerate(special_reviews, 1):
            persona = cyc.get('persona')
            if not isinstance(persona, dict) or not persona.get('name'):
                violations.append({
                    'rule_id': 'M2',
                    'target': f'reviews[review_type={cyc.get("review_type")!r}].persona',
                    'message': f'specialist review (review_type={cyc.get("review_type")!r}) must have a "persona" object with "name"',
                    'severity': 'fatal',
                    'fix': '専門レビュアーの persona.name を埋める',
                })

    # M3: thinking field は存在してはいけない
    if 'thinking' in data:
        violations.append({
            'rule_id': 'M3',
            'target': 'thinking',
            'message': '"thinking" field is deprecated in v3.9 and must be removed',
            'severity': 'fatal',
            'fix': 'data["thinking"] を削除',
        })

    # M4/M5: illustration_decision は全スライド必須、adopt:true なら illustration ネスト必須
    for sec in data.get('sections', []) or []:
        for slide in sec.get('slides', []) or []:
            sid = slide.get('id', '?')
            # M4: illustration_decision
            dec = slide.get('illustration_decision')
            if not isinstance(dec, dict) or 'adopt' not in dec or 'reason' not in dec:
                violations.append({
                    'rule_id': 'M4',
                    'target': sid,
                    'message': 'missing illustration_decision {adopt, reason}',
                    'severity': 'fatal',
                    'fix': f'{sid} に illustration_decision: {{adopt: bool, reason: str}} を追加',
                })
            elif dec.get('adopt') is True and not isinstance(slide.get('illustration'), dict):
                violations.append({
                    'rule_id': 'M5',
                    'target': sid,
                    'message': 'illustration_decision.adopt=true but no nested illustration object',
                    'severity': 'fatal',
                    'fix': f'{sid} に illustration オブジェクトをネスト',
                })
            elif dec.get('adopt') is False and slide.get('illustration'):
                violations.append({
                    'rule_id': 'M5',
                    'target': sid,
                    'message': 'illustration_decision.adopt=false but still has illustration object',
                    'severity': 'fatal',
                    'fix': f'{sid} から illustration オブジェクトを削除',
                })
            # M6: slide_goal required
            goal = slide.get('slide_goal')
            if not isinstance(goal, dict) or not goal.get('title') or not goal.get('subtitle'):
                violations.append({
                    'rule_id': 'M6',
                    'target': sid,
                    'message': 'missing slide_goal {title, subtitle}',
                    'severity': 'fatal',
                    'fix': f'{sid} に slide_goal: {{title, subtitle}} を追加',
                })

    if violations:
        print('⚠️  deck-instruction v3.9 MUST rule warnings:', file=sys.stderr)
        for v in violations:
            print(f'   - {v["rule_id"]} VIOLATION: {v.get("target", "")} — {v["message"]}', file=sys.stderr)

    return violations


# ───────────────────────────────────────────────────────
# ───────────────────────────────────────────────────────
# 旧設計: SecQA は references/qa/sections-qa.md に文字で書かれているだけ。
#         Claude が自己採点して qa_report.layers[SecQA].violations に手動で詰める。
#         → セルフチェックが甘くなり、LIST-1 連続違反が量産された (60% 比率)。
#
#   - SecQA-05  (subsection 不足)  : 章本文 ≥ 4 枚で subsection が 0 / 1 個だけ → fatal
#   - SecQA-09a (LIST-1 連続)      : 章内で LIST-1 が 2 連続 → fatal、3 連続 → 必修正
#   - SecQA-09b (LIST-1 章内比率)  : 1 章内で LIST-1 比率 > 33% → fatal
#   - SecQA-09c (LIST-1 全体比率)  : デッキ全体で LIST-1 比率 > 25% → fatal
#   - SecQA-09d (同一テンプレ連続) : LIST-1 以外も 3 連続は fatal、2 連続は warn
#   - SecQA-10  (章 name サニティ) : sections[].name の長さ・空白・demo 残骸を検査
#
# 残りの SecQA-01〜04 / 06 / 07 / 08 は引き続きユーザー手動採点 (構造的バグではなく
# 内容判断が必要なため)。
# ───────────────────────────────────────────────────────

# 「3 ブレット型」テンプレ ID。これらが連続 / 過半数になると単調になる。
# 第一は LIST-1 (標準コンテンツ) で、最も乱用されやすい。
ENO04_LIKE_TEMPLATES = {'LIST-1'}

# 章扉・挿絵・固定枠は本文カウントから除外する (連続ルールの分子分母にしない)
NON_BODY_TEMPLATES = {
    'SECTION-1',  # 表紙
    'SECTION-2', 'SECTION-4', 'SECTION-5',  # 章扉 (3 種)
    'SECTION-3',  # 閉じ
    'FRAMING-1',  # 制作背景
    'FRAMING-2',  # B/A リスト (序盤固定枠)
    'FRAMING-3',  # 会社紹介
    'FRAMING-4',  # お土産
    'SECSUMMARY-1',  # 章挿絵
    'DATA-5',  # 用語集
    'DATA-4',  # 参考情報集
    'SECTION-6',  # 統合目次
    'SECTION-6 (旧目次は SECTION-6 に統合)', '(旧目次バリアント B は SECTION-6 に統合)', '(旧目次バリアント C は SECTION-6 に統合)', '(旧階層型目次は SECTION-6 に統合)',  # 廃止目次系
}

# 1 章で「subsection を必ず立てるべき本文枚数」のしきい値
SUBSECTION_REQUIRED_MIN_BODY = 4

# 「demo 残骸」と疑う section name (build-catalog.js の DEMO_SECTIONS)
SUSPICIOUS_DEMO_NAMES = {'基本', 'プロジェクト', 'ピッチ', '図解', 'ビジュアル'}


def _is_body(slide):
    """章扉・挿絵・固定枠以外 = 本文として連続/比率カウントの対象"""
    tid = slide.get('template_id') or ''
    return tid not in NON_BODY_TEMPLATES


def validate_secqa(data):
    """v6.31: 構造的に検出可能な SecQA 違反を自動採点する。
    手動採点が必要な SecQA-01/02/03/04/06/07/08 は対象外。
    """
    violations = []
    sections = data.get('sections') or []

    # ───── 全体集計（SecQA-09c 用） ─────
    total_body = 0
    total_eno04 = 0
    for sec in sections:
        for sl in sec.get('slides') or []:
            if _is_body(sl):
                total_body += 1
                if (sl.get('template_id') or '') in ENO04_LIKE_TEMPLATES:
                    total_eno04 += 1

    if total_body > 0:
        ratio = total_eno04 / total_body
        if ratio > 0.25:
            violations.append({
                'rule_id': 'SecQA-09c',
                'target': 'whole deck',
                'message': f'デッキ全体で LIST-1 が {total_eno04}/{total_body} ({ratio*100:.0f}%) を占める。25% 以下に抑える',
                'severity': 'fatal',
                'fix': 'LIST-1 の何枚かを LIST-4 (3 カード積み) / LIST-8 (詳細カード) / LIST-5 (2×2 タイル) / LIST-2 (3 カラム) に置き換える',
            })

    # ───── 章単位の検査 ─────
    for sec_idx, sec in enumerate(sections):
        sec_name = sec.get('name') or ''
        sec_code = sec.get('code') or f'#{sec_idx}'
        slides = sec.get('slides') or []
        body_slides = [s for s in slides if _is_body(s)]
        body_n = len(body_slides)

        #     scripts/render/deck-structures/learning-deck.js の body.head[1] で
        #     `SECSUMMARY-1 / LIST-3 / LIST-7 / DIAG-06 / DIAGRAM-4` の許可テンプレを
        #     宣言し、validateDeckStructure() が StructureQA-12 として fatal 検出する。
        #     StructureQA-12 が「章扉直後にどのテンプレを置くか」だけを検査するため、
        #     章本編位置での使用は許容に統一。

        # ── SecQA-09a: LIST-1 連続検出 ──
        streak_id = None
        streak_len = 0
        streak_start_idx = None
        consecutive_groups = []  # list of (template_id, [slide_ids])

        for i, sl in enumerate(body_slides):
            tid = sl.get('template_id') or ''
            sid = sl.get('id') or f'(no-id)'
            if tid == streak_id:
                streak_len += 1
            else:
                # 前の streak を確定
                if streak_id and streak_len >= 2:
                    consecutive_groups.append((streak_id, streak_start_idx, streak_len))
                streak_id = tid
                streak_len = 1
                streak_start_idx = i
        # 最後の streak
        if streak_id and streak_len >= 2:
            consecutive_groups.append((streak_id, streak_start_idx, streak_len))

        for tid, start_i, n in consecutive_groups:
            ids = [body_slides[start_i + k].get('id', '?') for k in range(n)]
            if tid in ENO04_LIKE_TEMPLATES:
                violations.append({
                    'rule_id': 'SecQA-09a',
                    'target': f'{sec_code} ({sec_name}) {", ".join(ids)}',
                    'message': f'{tid} が {n} 連続 — LIST-1 の章内 2 連続は禁止',
                    'severity': 'fatal',
                    'fix': f'{n} 枚のうち少なくとも {n - 1} 枚を LIST-4 / 08 / 17 / 06 などに置き換える',
                })
            elif n >= 3:
                violations.append({
                    'rule_id': 'SecQA-09d',
                    'target': f'{sec_code} ({sec_name}) {", ".join(ids)}',
                    'message': f'{tid} が {n} 連続 — 同一テンプレ 3 連続はリズムを殺す',
                    'severity': 'fatal',
                    'fix': '少なくとも 1 枚を別テンプレに置き換える',
                })
            elif n == 2:
                violations.append({
                    'rule_id': 'SecQA-09d',
                    'target': f'{sec_code} ({sec_name}) {", ".join(ids)}',
                    'message': f'{tid} が 2 連続 — 章内のリズムが単調',
                    'severity': 'warn',
                    'fix': '可能なら別テンプレ (LIST-8 / 17 / 06 / 41 など) に差し替える',
                })

        # ── SecQA-09b: 章内 LIST-1 比率 ──
        sec_eno04 = sum(1 for s in body_slides if (s.get('template_id') or '') in ENO04_LIKE_TEMPLATES)
        if body_n >= 3:  # 本文 3 枚未満は比率検査の意味が薄い
            ratio_in_sec = sec_eno04 / body_n
            if ratio_in_sec > 0.33:
                violations.append({
                    'rule_id': 'SecQA-09b',
                    'target': f'{sec_code} ({sec_name})',
                    'message': f'章内 LIST-1 が {sec_eno04}/{body_n} ({ratio_in_sec*100:.0f}%) — 33% 以下に抑える',
                    'severity': 'fatal',
                    'fix': '章内のうち最多でも本文 1/3 まで。残りは COMPARE-1 / 08 / 41 / 17 / 06 / 11 / 12 等で表現する',
                })

        # ── SecQA-05: subsection 必須化 ──
        if body_n >= SUBSECTION_REQUIRED_MIN_BODY:
            distinct_subs = set()
            null_count = 0
            for s in body_slides:
                sub = s.get('subsection')
                if sub is None or sub == '':
                    null_count += 1
                else:
                    distinct_subs.add(sub)
            if len(distinct_subs) < 2:
                violations.append({
                    'rule_id': 'SecQA-05',
                    'target': f'{sec_code} ({sec_name})',
                    'message': f'章本文 {body_n} 枚に対し subsection が {len(distinct_subs)} 個 — 4 枚以上ある章は subsection を 2 個以上立てる',
                    'severity': 'fatal',
                    'fix': '各 subsection に意味のある日本語名 (例: 「ローカル環境」「WH 連携」「pre-commit と IDE」) を付け、本文スライドに分配する',
                })

        # ── SecQA-10: section name サニティ ──
        if not sec_name:
            violations.append({
                'rule_id': 'SecQA-10',
                'target': sec_code,
                'message': 'sections[].name が空 — 章扉タイトルとナビ chip 文字列の単一ソースになる',
                'severity': 'fatal',
                'fix': 'name に章のタイトル文字列を入れる (例: "全体像と前提")',
            })
        elif len(sec_name) < 2:
            violations.append({
                'rule_id': 'SecQA-10',
                'target': f'{sec_code} ({sec_name})',
                'message': f'sections[].name が {len(sec_name)} 文字 — 短すぎて章タイトルとして成立しない',
                'severity': 'fatal',
                'fix': 'name を 4 文字以上の意味のある日本語に',
            })
        elif len(sec_name) > 18:
            violations.append({
                'rule_id': 'SecQA-10',
                'target': f'{sec_code} ({sec_name})',
                'message': f'sections[].name が {len(sec_name)} 文字 — 18 文字超は simple variant nav chip ([N/M  XXX]) で見切れる',
                'severity': 'warn',
                'fix': 'name を 4〜12 文字程度に短縮する (本来の章扉タイトルは別フィールドで保持しない — 単一ソースにする)',
            })
        if sec_name in SUSPICIOUS_DEMO_NAMES:
            violations.append({
                'rule_id': 'SecQA-10',
                'target': f'{sec_code} ({sec_name})',
                'message': f'sections[].name="{sec_name}" は build-catalog.js の DEMO_SECTIONS 残骸の可能性',
                'severity': 'warn',
                'fix': '実デッキの章タイトルに書き換える',
            })

    if violations:
        print('⚠️  SecQA 自動検出:', file=sys.stderr)
        for v in violations:
            print(f'   - {v["rule_id"]} [{v["severity"]}] {v.get("target","")} — {v["message"]}', file=sys.stderr)

    return violations


# ───────────────────────────────────────────────────────
# ───────────────────────────────────────────────────────
# artifact の QA タブに「Rule 一覧」として表示するためのメタデータ。
# 各 RefQA-NN / SQA-NN 等の rule_id + name + brief を集約。
# ルール定義の正本は references/qa/{slide,sections,reference,visual}-qa.md。
# ここはユーザーが artifact から「どんなルールが効いているか」を一覧確認するための
# サマリ表示用。ルール本文を変更した時は、ここも 1 行更新する。
# ───────────────────────────────────────────────────────

QA_RULE_CATALOG = {
    'M': [
        {'rule_id': 'M2',  'name': 'reviews は 4 サイクル × 別 persona',         'brief': 'reviews[] が 4 件、4 人とも persona.name が異なる'},
        {'rule_id': 'M3',  'name': 'thinking フィールド廃止',                     'brief': 'data["thinking"] が存在しない'},
        {'rule_id': 'M4',  'name': 'illustration_decision 必須',                 'brief': '全スライドに {adopt, reason} が埋まる'},
        {'rule_id': 'M5',  'name': 'adopt と illustration の整合',                'brief': 'adopt:true なら illustration ネスト、false なら無し'},
        {'rule_id': 'M6',  'name': 'slide_goal 必須',                            'brief': '全スライドに {title, subtitle} が埋まる'},
    ],
    'SchemaQA': [
        {'rule_id': 'SchemaQA-01', 'name': 'FRAMING-1 構築背景の 3 ブロック必須',         'brief': 'block_kikkake / block_kizuki / block_gimon が string で存在'},
        {'rule_id': 'SchemaQA-02', 'name': 'FRAMING-2 Before/After リスト構造',         'brief': 'items[] が 4-6 要素、各 {before, after} 非空'},
        {'rule_id': 'SchemaQA-03', 'name': 'SECSUMMARY-1 セクション挿絵の 3 フィールド',      'brief': 'section_no(2 桁) / one_line / placeholder_label'},
        {'rule_id': 'SchemaQA-04', 'name': 'DATA-5 用語集の terms 構造',              'brief': 'terms[] が 3-10 要素、各 {term, desc} 非空'},
        {'rule_id': 'SchemaQA-05', 'name': 'DATA-4 参考情報集の ref_table 必須',       'brief': 'ref_table[] が 1 件以上、各 {category, title} 非空'},
        {'rule_id': 'SchemaQA-06', 'name': '全スライドの最低限フィールド',              'brief': 'id / template_id / title が string で存在'},
        {'rule_id': 'SchemaQA-07', 'name': 'template_id の既知 ID チェック (warn)',    'brief': 'KNOWN_TEMPLATE_IDS に含まれる'},
    ],
    'SQA': [
        {'rule_id': 'SQA-01', 'name': '1 スライド = 1 メッセージ',                 'brief': '主張が複数なら分割'},
        {'rule_id': 'SQA-02', 'name': 'タイトル ↔ サブコピー整合',                  'brief': 'subtitle は title の具体化/理由/結果'},
        {'rule_id': 'SQA-03', 'name': 'サブコピー説明力',                          'brief': '具体・なぜ・差分・対比 のうち 3 つ以上'},
        {'rule_id': 'SQA-08', 'name': 'タイトル冒頭識別子 ↔ subsection 役割分担',   'brief': 'sequence 内位置 ≠ group 名'},
        {'rule_id': 'SQA-10', 'name': 'illustration_decision の整合性',          'brief': 'M4/M5 補完検査'},
        {'rule_id': 'SQA-11', 'name': 'slide_goal の二重構造',                   'brief': 'title と subtitle が重複しない'},
        {'rule_id': 'SQA-12', 'name': '横文字・カタカナ語侵入',                    'brief': 'C-1 ルールの侵入検出'},
    ],
    'SecQA': [
        {'rule_id': 'SecQA-01',  'name': '章タイトル ↔ 章内スライド整合',                   'brief': '章名が中身を網羅 (手動)'},
        {'rule_id': 'SecQA-03',  'name': '章内スライド数のバランス',                         'brief': '2〜10 枚が目安、11+ は分割 (手動)'},
        {'rule_id': 'SecQA-04',  'name': '章内の論理フロー',                                'brief': '4 パターン (overview/problem/B-A/chrono) のいずれか (手動)'},
        {'rule_id': 'SecQA-05',  'name': 'subsection 必須化',               'brief': '本文 ≥4 枚なら subsection ≥2 個必須 (自動)'},
        {'rule_id': 'SecQA-06',  'name': '章をまたいだ重複情報の排除',                       'brief': '同じ数値・事例の再掲を避ける (手動)'},
        {'rule_id': 'SecQA-07',  'name': '章タイトル ↔ subsection の語彙整合',              'brief': '同じ語の 2 重表示を避ける (手動)'},
        {'rule_id': 'SecQA-09a', 'name': 'LIST-1 章内連続禁止',                'brief': '章内で LIST-1 が 2 連続 → fatal (自動)'},
        {'rule_id': 'SecQA-09b', 'name': 'LIST-1 章内比率 ≤33%',               'brief': '1 章で LIST-1 比率 33% 超 → fatal (自動)'},
        {'rule_id': 'SecQA-09c', 'name': 'LIST-1 デッキ全体比率 ≤25%',          'brief': '全本文中 25% 超 → fatal (自動)'},
        {'rule_id': 'SecQA-09d', 'name': '同一テンプレ連続',                   'brief': 'LIST-1 以外も 3 連続は fatal、2 連続は warn (自動)'},
        {'rule_id': 'SecQA-10',  'name': 'sections[].name サニティ',           'brief': '章 name は 2-18 字、demo 残骸禁止、空禁止 (自動)'},
    ],
    'RefQA': [
        {'rule_id': 'RefQA-01', 'name': '引用 URL の最小粒度（深いページ直リンク）⭐ 中核',  'brief': '根 URL ではなく該当ページに直接リンク'},
        {'rule_id': 'RefQA-02', 'name': 'ファクトベース主張に参照付与',              'brief': '数値・事例・調査・技術仕様には (N) 必須'},
        {'rule_id': 'RefQA-03', 'name': '参照ゼロスライドの妥当性',                  'brief': '参照不要カテゴリ以外で参照ゼロは違反'},
        {'rule_id': 'RefQA-04', 'name': 'インライン参照の表記ゆれ',                  'brief': '(N) 半角統一、全角・[N]・*N 禁止'},
        {'rule_id': 'RefQA-05', 'name': '本文 ⇔ DATA-4 の対応一貫性',              'brief': '番号セット A=B、孤立・未使用・飛び番なし'},
        {'rule_id': 'RefQA-06', 'name': '一次情報優先（公式文書）',                  'brief': '解説ブログより公式 docs を優先'},
        {'rule_id': 'RefQA-07', 'name': '引用元の鮮度（年表記）',                    'brief': '全行に年/年月、AI/cloud は 3 年超で警告'},
        {'rule_id': 'RefQA-08', 'name': 'DATA-4 行数オーバーフロー検査・自動分割 ⭐ 中核', 'brief': '1 ページ最大 10 行、超過は (1/N) 分割'},
        {'rule_id': 'RefQA-09', 'name': 'DATA-4 表示崩れ最終検査 (Phase 4)',        'brief': '折り返し・列幅潰れ・はみ出しを目視'},
        {'rule_id': 'RefQA-10', 'name': '引用先タイトルの正確性',                    'brief': 'DATA-4 タイトルは原典タイトルに忠実'},
    ],
    'VQA': [
        {'rule_id': 'VQA-01', 'name': 'テキストのシェイプはみ出し',                  'brief': '本文が箱から漏れない'},
        {'rule_id': 'VQA-02', 'name': '領域逸脱',                                  'brief': 'コンテンツが contentBot を超えない'},
        {'rule_id': 'VQA-03', 'name': 'ナビ・フッターとの重なり',                    'brief': '本文がナビチップと衝突しない'},
        {'rule_id': 'VQA-04', 'name': 'ロゴの配置整合',                            'brief': 'フッターロゴが各スライドで揃う'},
        {'rule_id': 'VQA-05', 'name': 'タイトルブロック整合',                       'brief': '全スライドで addTitleBlock 一貫適用'},
        {'rule_id': 'VQA-06', 'name': 'カラーテーマ一貫性',                         'brief': 'tokens.js 経由で色取得、ハードコード hex なし'},
        {'rule_id': 'VQA-07', 'name': '左サイドストライプ',                         'brief': '本編全スライドに薄紫帯あり'},
        {'rule_id': 'VQA-08', 'name': 'ハイパーリンクの色',                         'brief': '青リンクが黒くなる PptxGenJS バグ修正済み'},
        {'rule_id': 'VQA-09', 'name': 'フォント (Noto Sans JP) 統一',              'brief': '全テキストで fontFace 指定'},
        {'rule_id': 'VQA-10', 'name': '画像/図の解像度',                           'brief': 'プレースホルダー残存なし、画像は鮮明'},
        {'rule_id': 'VQA-11', 'name': 'ページ番号の連番性',                         'brief': 'addChromeWithNav の pageNum 連続'},
        {'rule_id': 'VQA-12', 'name': 'speaker notes の埋込',                     'brief': '各スライドに 4 行構造の notes が入っている'},
    ],
}


# ───────────────────────────────────────────────────────
# ───────────────────────────────────────────────────────
# artifact 上部に表示する「制作ワークフロー」panel の状態を算出する。
# qa_report と reviews の中身から自動的に現在のステップを判定。
#
#   1. 構成作成               (Phase 1〜2 前半)
#   2. QA 走査                 (Phase 2 完了直前)
#   3. QA 違反修正             (Phase 2 内)
#   4. QA 全件 pass まで反復   (上 2-3 を繰り返し)
#   5. ペルソナレビュー実行     (Phase 2 後半)
#   6. ペルソナレビュー反映 → 完成
#
# 各ステップは 'done' / 'active' / 'pending' のいずれかの状態を持つ。
# ───────────────────────────────────────────────────────

WORKFLOW_STEPS = [
    {'num': 1, 'title': '構成作成',                  'desc': 'Phase 1 ヒアリングを踏まえて sections[] / slides[] を組み立てる'},
    {'num': 2, 'title': '5 種 QA 実行',              'desc': 'M? + SchemaQA + SQA + SecQA + RefQA を走査して違反を検出'},
    {'num': 3, 'title': 'QA 違反修正',                'desc': '違反項目を JSON に反映、修正提案に従って書き直す'},
    {'num': 4, 'title': '再 QA → 全件 pass まで反復', 'desc': '2 → 3 → 2 のループ。違反 0 件になるまで'},
    {'num': 5, 'title': 'ペルソナレビュー実行',        'desc': '読者の主観・共感ベースで改善点を洗い出す'},
    {'num': 6, 'title': 'レビュー反映 → 完成',         'desc': 'ペルソナの指摘を JSON / コンテンツに反映、完成'},
]


def build_workflow_state(qa_report, reviews):
    """qa_report と reviews から現在のステップ番号と各ステップの状態を算出。"""
    has_qa = bool(qa_report)
    qa_pass = has_qa and qa_report.get('total_violations', 0) == 0 and \
              all(l.get('status') in ('pass', 'pending') for l in qa_report.get('layers', []))
    qa_pass_phase2 = has_qa and all(
        l.get('status') == 'pass'
        for l in qa_report.get('layers', [])
        if l.get('code') in ('M', 'SchemaQA', 'SQA', 'SecQA', 'RefQA')
    )

    # reviews が実体ある時 (issues が 1 件以上あるか、final_check が「未実施」じゃない)
    reviews_run = False
    reviews_addressed = False
    if isinstance(reviews, list) and len(reviews) >= 1:
        for cyc in reviews:
            if cyc.get('issues'):
                reviews_run = True
            fc = cyc.get('final_check', {}) or {}
            if fc.get('title') and '未実施' not in fc.get('title', '') and '未実施' not in fc.get('body', ''):
                reviews_addressed = True

    # active step 判定
    if not has_qa:
        active = 1
    elif not qa_pass_phase2:
        active = 3 if qa_report.get('total_violations', 0) > 0 else 2
    elif not reviews_run:
        active = 5
    elif not reviews_addressed:
        active = 6
    else:
        active = 6  # 完成扱い

    steps = []
    for s in WORKFLOW_STEPS:
        if s['num'] < active:
            state = 'done'
        elif s['num'] == active:
            state = 'active'
        else:
            state = 'pending'
        steps.append({**s, 'state': state})

    return {
        'active_step': active,
        'steps': steps,
        'qa_passed': qa_pass_phase2,
        'reviews_run': reviews_run,
        'reviews_addressed': reviews_addressed,
    }


def validate_refqa_auto(data):
    """v6.43 新設: RefQA-02 (ファクト主張に対する参照付与) の **自動検出 (warn 既定)**。

    各スライドのタイトル / サブコピー / detail_blocks に「数値・固有名詞・第三者名」が
    含まれているのに ref_table も末尾 DATA-4 の ref_table 行も持たない場合に検出する。

    `--strict-refqa` フラグが立っている時は fatal、デフォルトは warn (CHANGELOG v6.43 参照)。
    """
    import re as _re

    # 数値・割合・年代パターン (ファクト主張シグナル)
    NUMERIC_PATTERN = _re.compile(
        r"(\d{2,}\s*(%|％|倍|件|社|名|位|億|兆|百万|千万|万円|円|人|時間|分|秒|日|週|月|年|回))|"
        r"((20[12]\d|19\d\d)\s*年)|"  # 年表記 1980〜2029
        r"(\d+\.\d+\s*(%|％|倍))"
    )
    THIRD_PARTY_HINTS = [
        # 業界調査機関・第三者ソース定型
        '調査によると', '統計によれば', 'IDC', 'Gartner', 'IPA', 'PwC',
        'McKinsey', 'BCG', 'Forrester', '総務省', '経済産業省',
        'OECD', 'World Bank', '国連', '厚生労働省', '内閣府',
    ]
    # メタ系テンプレ (ファクト主張は要らない)
    EXEMPT_TEMPLATES = {
        'SECTION-1',  # 表紙
        'SECTION-2', 'SECTION-4', 'SECTION-5',  # 章扉
        'SECTION-3',  # クロージング
        'VISUAL-1',  # プロフィール (本人情報)
        'DATA-4',  # 参考情報集 (ref_table を持つ側)
        'FRAMING-3',  # 会社紹介
        'FRAMING-4',  # お土産 (Skill 紹介)
        'SECSUMMARY-1',  # セクション挿絵
        'DATA-5',  # 用語集
        'SECTION-6',  # 統合目次
    }

    violations = []

    # デッキ全体で ref_table を集めておく (DATA-4 の ref_table 行で他スライドからの参照を確認)
    has_global_refs = False
    for sec in (data.get('sections') or []):
        for sl in (sec.get('slides') or []):
            if sl.get('template_id') == 'DATA-4' and sl.get('ref_table'):
                if isinstance(sl['ref_table'], list) and len(sl['ref_table']) > 0:
                    has_global_refs = True
                    break

    for sec in (data.get('sections') or []):
        sec_code = sec.get('code') or '?'
        sec_name = sec.get('name') or ''
        for sl in (sec.get('slides') or []):
            tid = sl.get('template_id') or ''
            if tid in EXEMPT_TEMPLATES:
                continue
            sid = sl.get('id') or '?'

            # スライド本文を 1 つの文字列に集約
            chunks = [sl.get('title') or '', sl.get('subtitle') or '']
            for db in (sl.get('detail_blocks') or []):
                if isinstance(db, dict):
                    chunks.append(db.get('heading') or '')
                    chunks.append(db.get('text') or '')
                    for it in (db.get('items') or []):
                        if isinstance(it, str):
                            chunks.append(it)
                        elif isinstance(it, dict):
                            chunks.extend([str(v) for v in it.values()])
            for fld in ('block_kikkake', 'block_kizuki', 'block_gimon'):
                if sl.get(fld):
                    chunks.append(sl[fld])
            for it in (sl.get('items') or []):
                if isinstance(it, dict):
                    chunks.extend([str(v) for v in it.values()])
            text = '\n'.join([c for c in chunks if c])

            has_numeric = bool(NUMERIC_PATTERN.search(text))
            has_3rd = any(h in text for h in THIRD_PARTY_HINTS)
            if not (has_numeric or has_3rd):
                continue

            # ref を持っているか確認 (スライド固有 or デッキ全体 DATA-4)
            has_local_ref = bool(sl.get('ref_table'))
            has_inline_ref_marker = bool(_re.search(r'\(\s*\d+\s*\)', text))  # 本文中の (1) (2) 風

            if not has_local_ref and not has_inline_ref_marker and not has_global_refs:
                violations.append({
                    'rule_id': 'RefQA-02',
                    'target': f'{sec_code} ({sec_name}) {sid} ({tid})',
                    'message': f'数値・第三者名が登場するが ref_table / inline ref / 末尾 DATA-4 のいずれも無い',
                    'severity': 'warn',  # は warn 既定 (--strict-refqa で fatal 化)
                    'fix': 'web_search で出典 URL を取得 → 末尾 DATA-4 に ref_table 行を追加 → 本文に (1)(2) でリンク。bypass モードでも省略不可',
                })

    if violations:
        print('⚠️  RefQA 自動検出:', file=sys.stderr)
        for v in violations:
            print(f'   - {v["rule_id"]} [{v["severity"]}] {v.get("target","")} — {v["message"]}', file=sys.stderr)

    return violations


def write_qa_report_json(plan_path, m_violations, secqa_violations,
                          schemaqa_violations, refqa_violations,
                          writingqa_violations=None):
    """機械検証 5 層 (M / SchemaQA / WritingQA / SecQA-Auto / RefQA-Auto) の結果を
    qa_report.json (SSOT) に書き出す。

    WritingQA を追加。writingqa_violations は古い呼び出しコードとの
    互換のためデフォルト None。

    手動層 (SecQA-Manual / RefQA-Manual / SQA / VQA) はここでは触らない —
    それらは run-manual-qa.py が `apply_to_qa_report()` で書き込む。
    """
    if writingqa_violations is None:
        writingqa_violations = []
    # qa-report-io.py をロード
    import importlib.util as _ilu
    _spec = _ilu.spec_from_file_location(
        'qa_report_io', _SCRIPTS_DIR / 'qa-report-io.py')
    qa_io = _ilu.module_from_spec(_spec)
    _spec.loader.exec_module(qa_io)

    plan_path = Path(plan_path).resolve()
    deck_dir = plan_path.parent
    qa = qa_io.ensure_skeleton(deck_dir, plan_path)

    # 自動 4 層を再構築 (機械検証は常に最新が勝つ)
    auto_layers = [
        {
            'code': 'M', 'name': 'M? (Schema 検査)',
            'timing': 'render 時自動',
            'source': 'render-deck-instruction.py validate_v39',
            'scope': 'M2/M3/M4/M5/M6/M8 のスキーマ MUST',
            'rule_count': 6, 'violation_count': len(m_violations),
            'status': 'pass' if not m_violations else 'fail',
            'violations': m_violations,
        },
        {
            'code': 'SchemaQA', 'name': 'Schema QA',
            'timing': 'render 時自動',
            'source': 'schema-qa.py',
            'scope': 'テンプレ別必須/型 (SchemaQA-01〜15)',
            'rule_count': 7, 'violation_count': len(schemaqa_violations),
            'status': 'pass' if not schemaqa_violations else 'fail',
            'violations': schemaqa_violations,
        },
        {
            'code': 'WritingQA', 'name': 'Writing QA',
            'timing': 'render 時自動',
            'source': 'writing-qa.py',
            'scope': '日本語の規範違反 (WritingQA-01〜12: サブコピー長・翻訳調・ハイプ語・助詞連発・比喩等)',
            'rule_count': 12, 'violation_count': len(writingqa_violations),
            'status': ('pass' if not writingqa_violations
                       else ('warn' if all(v.get('severity') == 'warn' for v in writingqa_violations)
                             else 'fail')),
            'violations': writingqa_violations,
        },
        {
            'code': 'SecQA-Auto', 'name': 'Sections QA (自動)',
            'timing': 'render 時自動',
            'source': 'render-deck-instruction.py validate_secqa',
            'scope': 'SecQA-05/09a-d/10 (LIST-1 連続 / subsection / name サニティ)。'
                     '旧 SecQA-02 (章扉直後の見取り図必須) は StructureQA-12 に移管済み。',
            'rule_count': 6, 'violation_count': len(secqa_violations),
            'status': 'pass' if not secqa_violations else 'fail',
            'violations': secqa_violations,
        },
        {
            'code': 'RefQA-Auto', 'name': 'Reference QA (自動)',
            'timing': 'render 時自動',
            'source': 'render-deck-instruction.py validate_refqa_auto',
            'scope': 'RefQA-02 (ファクト主張パターン検出)',
            'rule_count': 1, 'violation_count': len(refqa_violations),
            'status': ('pass' if not refqa_violations
                       else ('warn' if all(v.get('severity') == 'warn' for v in refqa_violations)
                             else 'fail')),
            'violations': list(refqa_violations),
        },
    ]
    auto_codes = {l['code'] for l in auto_layers}
    # 既存の手動層 (SecQA-Manual / RefQA-Manual / SQA / VQA) は温存
    preserved = [l for l in qa.get('layers', [])
                 if isinstance(l, dict) and l.get('code') not in auto_codes]
    qa['layers'] = auto_layers + preserved
    qa['plan_sha256'] = qa_io.compute_plan_sha256(plan_path)
    qa['total_violations'] = sum(l.get('violation_count', 0) for l in qa['layers'])
    qa['total_rules'] = sum(l.get('rule_count', 0) for l in qa['layers'])
    qa_io.save_qa_report(deck_dir, qa)
    return qa


def _is_v9_format(data: dict) -> bool:
    """
    v9.0 plan.json 形式 (header / body.chapters / footer) かを判定する。

    判定基準: トップレベルに header[] / body.chapters[] / footer[] のいずれかが存在。
    これらが無く sections[] のみなら v8.x。
    """
    if not isinstance(data, dict):
        return False
    has_header = isinstance(data.get('header'), list)
    body = data.get('body')
    has_body = isinstance(body, dict) and isinstance(body.get('chapters'), list)
    has_footer = isinstance(data.get('footer'), list)
    return has_header or has_body or has_footer


def _normalize_v9_to_v8_sections(data: dict) -> dict:
    """
    v9.0 plan.json (header/body.chapters/footer) を v8.x sections[] 互換に変換する。

    既存 Jinja テンプレが sections[] を前提に書かれているため、HTML 生成パスでも
    同様の正規化を行う。各 section に _v9_role (header/chapter/footer) を付与し、
    Jinja 側で章末まとめなどの視覚的区別ができるようにする。

    元の dict は破壊しない (新 dict を返す)。
    """
    sections = []
    header = data.get('header') if isinstance(data.get('header'), list) else []
    body = data.get('body') if isinstance(data.get('body'), dict) else {}
    chapters = body.get('chapters') if isinstance(body.get('chapters'), list) else []
    footer = data.get('footer') if isinstance(data.get('footer'), list) else []

    if header:
        sections.append({
            'id': '_header',
            'code': 'H',
            'name': '序盤 (Header)',
            'slides': list(header),
            '_v9_role': 'header',
        })

    for ch in chapters:
        ch_head = ch.get('head') if isinstance(ch.get('head'), list) else []
        ch_content = ch.get('content') if isinstance(ch.get('content'), list) else []
        ch_tail = ch.get('tail') if isinstance(ch.get('tail'), list) else []
        # 各スライドに role マーカーを付与 (Jinja 側で head/content/tail を区別したい時用)
        marked = []
        for s in ch_head:
            sl = dict(s); sl['_v9_chapter_part'] = 'head'; marked.append(sl)
        for s in ch_content:
            sl = dict(s); sl['_v9_chapter_part'] = 'content'; marked.append(sl)
        for s in ch_tail:
            sl = dict(s); sl['_v9_chapter_part'] = 'tail'; marked.append(sl)
        sections.append({
            'id': ch.get('id'),
            'code': ch.get('code'),
            'name': ch.get('name'),
            'slides': marked,
            '_v9_role': 'chapter',
            '_v9_head_count': len(ch_head),
            '_v9_content_count': len(ch_content),
            '_v9_tail_count': len(ch_tail),
        })

    if footer:
        sections.append({
            'id': '_footer',
            'code': 'F',
            'name': '末尾 (Footer)',
            'slides': list(footer),
            '_v9_role': 'footer',
        })

    new_data = dict(data)
    new_data['sections'] = sections
    new_data['_v9_original'] = {
        'header': header,
        'body': body,
        'footer': footer,
    }
    new_data['_v9_normalized'] = True
    return new_data


def _run_structure_qa(plan_input_path):
    """
    validate-structure-cli.js を subprocess で実行し、StructureQA 結果を取得する。

    plan_input_path が None の場合 (stdin 経由) は None を返す。
    node がインストールされていない / CLI 実行失敗時は警告して None を返す。

    戻り値: dict (validate-structure-cli.js の出力 JSON) または None
    """
    import subprocess

    if not plan_input_path:
        return None

    cli_path = _SCRIPTS_DIR / 'render' / 'validate-structure-cli.js'
    if not cli_path.is_file():
        return None

    try:
        proc = subprocess.run(
            ['node', str(cli_path), '-i', str(plan_input_path)],
            capture_output=True, text=True, timeout=30,
        )
    except FileNotFoundError:
        print('⚠ [StructureQA] node が見つかりません。StructureQA をスキップします', file=sys.stderr)
        return None
    except subprocess.TimeoutExpired:
        print('⚠ [StructureQA] CLI が 30 秒以内に応答しませんでした', file=sys.stderr)
        return None
    except Exception as e:
        print(f'⚠ [StructureQA] CLI 実行エラー: {e}', file=sys.stderr)
        return None

    # exit code 0 (pass) / 2 (fatal あり) / 1 (内部エラー)
    if proc.returncode == 1:
        print(f'⚠ [StructureQA] CLI 内部エラー: {proc.stderr.strip()}', file=sys.stderr)
        return None

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        print(f'⚠ [StructureQA] CLI 出力 JSON パース失敗: {e}', file=sys.stderr)
        return None


def render(data: dict) -> str:
    """
    JSON データを受け取り、HTML 文字列を返す。

    引数:
        data: deck-instruction-schema.md v3.9 (v8.x) または v9.0 構造の dict
    戻り値:
        HTML 文字列
    """
    if _is_v9_format(data):
        # (a) StructureQA を CLI 経由で実行 (plan.json パスがあれば)
        plan_input_path = data.get('_plan_input_path')
        struct_qa_result = _run_structure_qa(plan_input_path)
        if struct_qa_result is not None:
            data['structure_qa'] = struct_qa_result
            print(
                f'  📐 StructureQA: '
                f'{"pass" if struct_qa_result.get("ok") else "FAIL"} '
                f'(template={struct_qa_result.get("templateId")}, '
                f'fatal={struct_qa_result.get("summary",{}).get("fatal",0)}, '
                f'warn={struct_qa_result.get("summary",{}).get("warn",0)})',
                file=sys.stderr
            )
        else:
            data['structure_qa'] = {'skipped': True, 'reason': 'CLI 実行不可 / plan.json パス不明'}

        data = _normalize_v9_to_v8_sections(data)

    # 前処理: template_id から base64 画像を自動注入
    data.setdefault('doc', {})
    data['doc'].setdefault('version', '3.9')
    data['doc'].setdefault('theme', 'mono')
    data['doc'].setdefault('theme_desc', 'mono（デフォルト）')

    # 同じ色情報を共有するための SSOT 経路。
    data['palette'] = resolve_palette(data.get('_plan_input_path'))

    data['sections'] = inject_previews(data.get('sections', []))
    preview_dir = data.get('_preview_dir')
    if preview_dir:
        matched, missing = inject_real_previews(data['sections'], preview_dir)
        if matched:
            print(f'  🖼️  real-preview embedded: {matched} slides', file=sys.stderr)
        if missing:
            print(f'  ⚠️  real-preview missing for {len(missing)} slides: {missing[:5]}{"..." if len(missing)>5 else ""}', file=sys.stderr)
    else:
        # preview_dir 未指定でも real_preview_index は振っておく（Jinja で参照される可能性に備える）
        inject_real_previews(data['sections'], None)
    data['sections'] = inject_raw_json(data['sections'])
    data['all_slides'] = build_all_slides(data['sections'])
    data['counts'] = data.get('counts') or compute_counts(data)

    # シンプル形式: persona は dict (name/role/industry/experience_years/perspective)、
    # summary は文字列、issues は [{slide_id, issue, fix}] の最小スキーマ
    # Jinja 期待形式: persona に avatar/bio/traits、summary に title/stats、
    # issues に id/priority/priority_label/target/feedback/action
    # → 不足フィールドを埋めて、文字列 summary は dict 化する
    PRIORITY_LABELS = {
        'high': '高', 'medium': '中', 'low': '低',
        '高': '高', '中': '中', '低': '低',
    }
    def _normalize_reviews(reviews):
        if not isinstance(reviews, list):
            return reviews
        for cyc in reviews:
            if not isinstance(cyc, dict):
                continue
            # cycle_desc が無ければ persona.name + 役割で組み立てる
            persona = cyc.get('persona') or {}
            if isinstance(persona, dict):
                if not cyc.get('cycle_desc'):
                    pname = persona.get('name', '')
                    prole = persona.get('role', '')
                    cyc['cycle_desc'] = f'{pname} ({prole})' if pname else 'レビュー'
                # avatar / bio / traits を埋める (シンプル形式から)
                persona.setdefault('avatar', persona.get('name', '—')[:1] if persona.get('name') else '—')
                if 'bio' not in persona:
                    persona['bio'] = persona.get('perspective', '') or ''
                if 'traits' not in persona:
                    traits = []
                    if persona.get('industry'):
                        traits.append({'label': '業種', 'value': persona['industry']})
                    if persona.get('experience_years'):
                        traits.append({'label': '経験', 'value': f"{persona['experience_years']} 年"})
                    if persona.get('role'):
                        traits.append({'label': '役割', 'value': persona['role']})
                    persona['traits'] = traits
            # summary が文字列なら dict 化する (Jinja の cyc.summary.title が壊れる対策)
            if isinstance(cyc.get('summary'), str):
                raw = cyc['summary']
                # 最初の句点までをタイトル、残りを stats[0] に分ける
                first_dot = raw.find('。')
                if first_dot > 0 and first_dot < len(raw) - 1:
                    title_text = raw[:first_dot + 1]
                    body_text = raw[first_dot + 1:].strip()
                    cyc['summary'] = {
                        'title': title_text,
                        'stats': [body_text] if body_text else [],
                    }
                else:
                    cyc['summary'] = {'title': raw, 'stats': []}
            # issues の各エントリも正規化 (シンプル形式 → Jinja 形式)
            issues = cyc.get('issues') or []
            for j, iss in enumerate(issues):
                if not isinstance(iss, dict):
                    continue
                # id / priority / priority_label
                iss.setdefault('id', f'C{cyc.get("cycle_num", "?")}-{j+1:02d}')
                pri = iss.get('priority', 'medium')
                iss.setdefault('priority', pri)
                iss.setdefault('priority_label', PRIORITY_LABELS.get(str(pri), str(pri)))
                # target = slide_id を流用
                iss.setdefault('target', iss.get('slide_id', '—'))
                # feedback = issue, action = fix を流用
                iss.setdefault('feedback', iss.get('issue', ''))
                iss.setdefault('action', iss.get('fix', ''))
                # reviewer = cycle の persona name (あれば)
                if persona and isinstance(persona, dict) and persona.get('name'):
                    iss.setdefault('reviewer', persona.get('name'))
            # final_check デフォルト
            if not cyc.get('final_check'):
                cyc['final_check'] = {'title': '未記載', 'body': ''}
        return reviews

    if isinstance(data.get('reviews'), list):
        data['reviews'] = _normalize_reviews(data['reviews'])

    # v9.5: でき太郎 (review_type=title-subcopy-qa) の per_slide_findings を slide_id でルックアップ
    # する辞書を作って data['dekitaro_by_slide'] に詰める。Jinja からスライドカードに表示。
    dekitaro_by_slide = {}
    dekitaro_review = None
    for cyc in (data.get('reviews') or []):
        if isinstance(cyc, dict) and cyc.get('review_type') == 'title-subcopy-qa':
            dekitaro_review = cyc
            for f in cyc.get('per_slide_findings') or []:
                if isinstance(f, dict) and f.get('slide_id'):
                    dekitaro_by_slide[f['slide_id']] = f
            break
    data['dekitaro_by_slide'] = dekitaro_by_slide
    data['dekitaro_review'] = dekitaro_review

    # v3.9: reviews はデフォルト 2 サイクル分のプレースホルダ
    default_cycle = lambda n: {
        'cycle_num': n,
        'cycle_desc': f'{n} サイクル目のレビュー（未実施）',
        'persona': {'avatar': '—', 'name': '—', 'role': '—', 'bio': '—', 'traits': []},
        'summary': {'title': 'レビュー未実施', 'stats': []},
        'issues': [],
        'final_check': {'title': '未実施', 'body': 'レビューを実施してから記載してください。'},
    }
    data.setdefault('reviews', [default_cycle(n) for n in range(1, 5)])

    # ─── 機械検証 4 層を実行し、qa_report.json (SSOT) を更新 ───
    # 手動層 (SecQA-Manual / RefQA-Manual / SQA / VQA) は run-manual-qa.py が書く。
    plan_input_path = data.get('_plan_input_path')

    m_violations = validate_v39(data)
    secqa_violations = validate_secqa(data)
    schemaqa_violations = validate_schema_qa(data)
    writingqa_violations = validate_writing_qa(data)
    refqa_violations = validate_refqa_auto(data)

    if plan_input_path:
        # 自動 5 層を qa_report.json に書き戻す (手動層は温存される)
        qa_report = write_qa_report_json(
            plan_input_path,
            m_violations, secqa_violations, schemaqa_violations, refqa_violations,
            writingqa_violations=writingqa_violations,
        )
    else:
        # stdin / stdout 経由のケース: ファイルに保存せず、メモリ上の dict だけ作る
        qa_report = {
            'generated_phase': 'render 時自動 (file 未保存)',
            'total_violations': len(m_violations) + len(secqa_violations) + len(schemaqa_violations) + len(writingqa_violations) + len(refqa_violations),
            'total_rules': 33,
            'layers': [
                {'code': 'M', 'name': 'M? (Schema 検査)', 'source': 'validate_v39',
                 'violations': m_violations, 'violation_count': len(m_violations),
                 'rule_count': 6, 'status': 'pass' if not m_violations else 'fail'},
                {'code': 'SchemaQA', 'name': 'Schema QA', 'source': 'schema-qa.py',
                 'violations': schemaqa_violations, 'violation_count': len(schemaqa_violations),
                 'rule_count': 7, 'status': 'pass' if not schemaqa_violations else 'fail'},
                {'code': 'WritingQA', 'name': 'Writing QA', 'source': 'writing-qa.py',
                 'violations': writingqa_violations, 'violation_count': len(writingqa_violations),
                 'rule_count': 12,
                 'status': ('pass' if not writingqa_violations
                            else ('warn' if all(v.get('severity') == 'warn' for v in writingqa_violations) else 'fail'))},
                {'code': 'SecQA-Auto', 'name': 'Sections QA (自動)', 'source': 'validate_secqa',
                 'violations': secqa_violations, 'violation_count': len(secqa_violations),
                 'rule_count': 7, 'status': 'pass' if not secqa_violations else 'fail'},
                {'code': 'RefQA-Auto', 'name': 'Reference QA (自動)', 'source': 'validate_refqa_auto',
                 'violations': list(refqa_violations), 'violation_count': len(refqa_violations),
                 'rule_count': 1,
                 'status': ('pass' if not refqa_violations
                            else ('warn' if all(v.get('severity') == 'warn' for v in refqa_violations) else 'fail'))},
            ],
        }

    data['qa_report'] = qa_report  # Jinja から参照するためのメモリ上 dict (永続化は qa_report.json 側)
    data['qa_rule_catalog'] = QA_RULE_CATALOG
    data['workflow_state'] = build_workflow_state(qa_report, data.get('reviews'))


    # doc.references[] がなければ空リストで返す（互換）。
    # フィールド: num, category, title, url, source, year, note, cited_by[]
    #        取得状態バッジ + サムネ表示に使われる。
    raw_refs = (data.get('doc') or {}).get('references') or []
    ref_list = []
    for i, r in enumerate(raw_refs, 1):
        img = r.get('image') if isinstance(r.get('image'), dict) else None
        image_info = None
        if img:
            image_info = {
                'enabled':       img.get('enabled') is True,
                'source_url':    img.get('source_url'),
                'local_path':    img.get('local_path'),
                'caption':       img.get('caption'),
                'rationale':     img.get('rationale'),
                'license_note':  img.get('license_note'),
                'fetch_status':  img.get('fetch_status') or ('pending' if img.get('enabled') is True else None),
                'fetch_reason':  img.get('fetch_reason'),
                'fetched_at':    img.get('fetched_at'),
            }
        entry = {
            'num':      r.get('num') or i,
            'category': r.get('category') or 'その他',
            'title':    r.get('title', ''),
            'url':      r.get('url'),
            'source':   r.get('source'),
            'year':     r.get('year'),
            'note':     r.get('note'),
            'cited_by': r.get('cited_by') or [],
            'image':    image_info,  # v6.74
        }
        ref_list.append(entry)
    data['ref_list'] = ref_list

    doc_for_qa = data.get('doc', {}) or {}
    qa_driven = bool(doc_for_qa.get('qa_driven'))
    data['qa_driven'] = qa_driven
    data['questions'] = doc_for_qa.get('questions') or []
    # per_question_findings は reviews[] から review_type='persona-qa-review' のものを抽出
    pqa_reviews = []
    for r in (data.get('reviews') or []):
        if r and r.get('review_type') == 'persona-qa-review':
            pqa_reviews.append(r)
    data['persona_qa_reviews'] = pqa_reviews

    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=select_autoescape(['html']),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template(TEMPLATE_NAME)
    return template.render(**data)


def main():
    ap = argparse.ArgumentParser(description='Render Phase 2 deck-instruction HTML from JSON.')
    ap.add_argument('--input', '-i', help='入力 JSON ファイル（省略時は標準入力）')
    ap.add_argument('--output', '-o', help='出力 HTML ファイル（省略時は標準出力）')
    ap.add_argument('--strict-refqa', action='store_true',
                    help='RefQA-02 (ファクト主張に対する参照付与) を fatal 化する。bypass モードでは原則有効化推奨')
    ap.add_argument('--strict', action='store_true',
                    help='v6.31: M / SecQA で fatal 違反があれば exit code 2 でハードゲートする。'
                         'Phase 2 で artifact をユーザー提出する直前に必ず通すこと。')
    ap.add_argument('--preview-dir',
                    help='v6.48: 実プレビュー PNG (slide-NN.png) のあるディレクトリ。'
                         'run-qa.py phase2 から自動で渡される。指定なしの場合は HTML 側で '
                         '"実プレビュー未生成" のプレースホルダを表示する。')
    args = ap.parse_args()

    if args.input:
        with open(args.input, encoding='utf-8') as f:
            data = json.load(f)
        data['_plan_input_path'] = str(Path(args.input).resolve())
    else:
        data = json.load(sys.stdin)
    if args.preview_dir:
        data['_preview_dir'] = args.preview_dir

    # SecQA / M? の fatal が必ずユーザーに伝わるようにするため。
    if args.strict:
        m_v = validate_v39(data)
        sec_v = validate_secqa(data)
        sqa_v = validate_schema_qa(data)
        wqa_v = validate_writing_qa(data)
        ref_v = validate_refqa_auto(data) if args.strict_refqa else []
        fatal = []
        for v in m_v + sec_v + sqa_v + wqa_v:
            if isinstance(v, dict) and v.get('severity') == 'fatal':
                fatal.append(f'  {v.get("rule_id","?")} {v.get("target","")} — {v.get("message","")}')
        # --strict-refqa: warn 扱いの RefQA-02 も fatal として扱う
        if args.strict_refqa:
            for v in ref_v:
                if isinstance(v, dict) and v.get('rule_id') == 'RefQA-02':
                    fatal.append(f'  {v.get("rule_id","?")} {v.get("target","")} — {v.get("message","")}')
        if fatal:
            print('🚨 strict mode: fatal violation あり、Phase 2 提出をブロックします', file=sys.stderr)
            for line in fatal:
                print(line, file=sys.stderr)
            print(f'  total fatal: {len(fatal)}', file=sys.stderr)
            sys.exit(2)

    html = render(data)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'wrote: {args.output} ({len(html):,} chars)', file=sys.stderr)
    else:
        sys.stdout.write(html)


if __name__ == '__main__':
    main()
