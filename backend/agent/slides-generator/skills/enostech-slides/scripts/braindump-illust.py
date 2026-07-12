#!/usr/bin/env python3
"""
braindump-illust.py (v11.2)
============================
JSON-first 版。Claude が enostech-svg-diagram skill のガイドに従って
SVG を `decks/{slug}/braindump_assets/{Q?}.svg` に書き、本スクリプトが
それを PNG に変換し braindump.json の `answers[].visual_path` を更新する。
その後 braindump-to-md.py を呼んで .md view を再生成する。

入出力
─────
入力:  decks/{slug}/braindump.json    (SSOT)
       decks/{slug}/braindump_assets/{question_id}.svg  (Claude が書いた SVG)
出力:  decks/{slug}/braindump_assets/{question_id}.png  (cairosvg 経由)
       decks/{slug}/braindump.json                       (visual_path 更新)
       decks/{slug}/braindump.md                          (再生成)

依存
────
- pip install --break-system-packages cairosvg pyyaml
- enostech-svg-diagram skill の svg-schema-qa.py が PATH or 既知パスにあること

CLI
───
  --input    決められたパス。.json を期待。`.md` を渡された場合はエラー。
  --dry-run  PNG 変換 + json 更新 + md 再生成をすべて skip
  --include-optional  visual=optional の answer も処理対象に
  --width / --height  PNG 出力サイズ
  --strict   SchemaQA 違反時に PNG を生成しない
  --no-md-regen  braindump.md の再生成を skip (json 更新のみ)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import cairosvg  # type: ignore
except ImportError:
    cairosvg = None  # type: ignore


# ───────────────────────────────────────────────────────
# フォント書き換え (cairosvg 用)
# ───────────────────────────────────────────────────────

_CAIROSVG_FONT_FAMILY = (
    "'IPAexGothic', 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', "
    "'Droid Sans Fallback', 'DejaVu Sans', sans-serif"
)


def _rewrite_font_family_for_cairosvg(svg_text: str) -> str:
    pattern = re.compile(r'font-family="[^"]*"')
    return pattern.sub(f'font-family="{_CAIROSVG_FONT_FAMILY}"', svg_text)


# ───────────────────────────────────────────────────────
# SVG SchemaQA
# ───────────────────────────────────────────────────────

def _find_svg_qa() -> Optional[Path]:
    candidates = [
        Path('/sessions/vigilant-awesome-hypatia/mnt/ENOSTECH-KNOWLEDGE-SPACE/skills/enostech-svg-diagram/scripts/qa/svg-schema-qa.py'),
        Path('/sessions/beautiful-gallant-noether/mnt/ENOSTECH-KNOWLEDGE-SPACE/skills/enostech-svg-diagram/scripts/qa/svg-schema-qa.py'),
        Path.home() / '.claude' / 'skills' / 'enostech-svg-diagram' / 'scripts' / 'qa' / 'svg-schema-qa.py',
    ]
    for c in candidates:
        if c.exists():
            return c
    p = shutil.which('svg-schema-qa.py')
    if p:
        return Path(p)
    return None


def _validate_svg(svg_path: Path) -> Tuple[bool, str]:
    qa = _find_svg_qa()
    if not qa:
        return True, '(svg-schema-qa.py が見つからないため検証 skip)'
    try:
        result = subprocess.run(
            ['python3', str(qa), str(svg_path)],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0:
            return True, 'SchemaQA OK'
        msg = (result.stdout or '') + (result.stderr or '')
        return False, msg.strip()[:600]
    except Exception as e:
        return False, f'検証実行失敗: {e}'


# ───────────────────────────────────────────────────────
# Main pipeline
# ───────────────────────────────────────────────────────

def process_braindump(json_path: Path, dry_run: bool = False,
                      include_optional: bool = False,
                      width: int = 1920, height: int = 1080,
                      strict: bool = False,
                      regen_md: bool = True) -> Dict[str, Any]:
    data = json.loads(json_path.read_text(encoding='utf-8'))
    deck_dir = json_path.parent
    assets_dir = deck_dir / 'braindump_assets'
    assets_dir.mkdir(exist_ok=True)

    visuals: List[Dict[str, Any]] = []
    updated_json = False

    for a in data.get('answers') or []:
        qid = a.get('question_id') or '?'
        # for visual_path the file name may use qid with '.' (Q2.5) — but typically Q1.svg
        # Use qid as-is for file naming
        flag = (a.get('visual') or 'none').lower()
        if flag in ('', 'none'):
            continue
        if flag == 'optional' and not include_optional:
            visuals.append({'qid': qid, 'status': 'skipped',
                            'message': 'visual: optional は --include-optional 未指定で skip'})
            continue
        svg_path = assets_dir / f'{qid}.svg'
        if not svg_path.exists():
            visuals.append({'qid': qid, 'status': 'pending',
                            'message': f'{svg_path.name} 未配置。Claude が SVG を書いてから再実行'})
            continue
        ok, msg = _validate_svg(svg_path)
        if not ok:
            severity = 'error' if strict else 'warn'
            visuals.append({'qid': qid, 'status': severity, 'svg_path': str(svg_path),
                            'message': f'SchemaQA: {msg}'})
            if strict:
                continue

        png_path = assets_dir / f'{qid}.png'
        if not dry_run:
            if cairosvg is None:
                visuals.append({'qid': qid, 'status': 'error',
                                'message': 'cairosvg がインストールされていません'})
                continue
            try:
                svg_text = svg_path.read_text(encoding='utf-8')
                svg_for_png = _rewrite_font_family_for_cairosvg(svg_text)
                cairosvg.svg2png(
                    bytestring=svg_for_png.encode('utf-8'),
                    write_to=str(png_path),
                    output_width=width,
                    output_height=height,
                )
            except Exception as e:
                visuals.append({'qid': qid, 'status': 'error',
                                'message': f'PNG 変換失敗: {e}'})
                continue

        rel_png = f'braindump_assets/{qid}.png'
        if a.get('visual_path') != rel_png:
            a['visual_path'] = rel_png
            updated_json = True
        visuals.append({
            'qid': qid, 'status': 'ok',
            'svg_path': str(svg_path),
            'png_path': str(png_path),
            'png_relpath': rel_png,
            'schema_qa': msg,
        })

    if updated_json and not dry_run:
        # bump meta.updated_at
        meta = data.setdefault('meta', {})
        meta['updated_at'] = dt.datetime.now(tz=dt.timezone.utc).isoformat()
        json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    # Regen MD view
    if not dry_run and regen_md and updated_json:
        try:
            to_md_path = Path(__file__).parent / 'braindump-to-md.py'
            subprocess.run(['python3', str(to_md_path), '--input', str(json_path)],
                           check=False, capture_output=True, timeout=30)
        except Exception as e:
            print(f'[warn] braindump-to-md.py 呼び出し失敗: {e}', file=sys.stderr)

    # ログ
    if not dry_run:
        run_log_path = assets_dir / '.illust-run.json'
        try:
            payload = {
                'version': 'v11.2',
                'ran_at': dt.datetime.utcnow().isoformat() + 'Z',
                'json_path': str(json_path),
                'updated_json': updated_json,
                'visuals': [
                    {'qid': v.get('qid'), 'status': v.get('status'),
                     'png_relpath': v.get('png_relpath'), 'message': v.get('message')}
                    for v in visuals
                ],
                'summary': {
                    'ok': sum(1 for v in visuals if v.get('status') == 'ok'),
                    'skipped': sum(1 for v in visuals if v.get('status') == 'skipped'),
                    'pending': sum(1 for v in visuals if v.get('status') == 'pending'),
                    'error': sum(1 for v in visuals if v.get('status') == 'error'),
                },
            }
            run_log_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                                    encoding='utf-8')
        except Exception as e:
            print(f'[warn] .illust-run.json 書き出し失敗: {e}', file=sys.stderr)

    return {'updated_json': updated_json, 'visuals': visuals}


def main(argv=None):
    ap = argparse.ArgumentParser(
        description='braindump.json (v11.2) の visual=required な answer に対し '
                    'SVG → PNG 変換 → visual_path 更新 → MD 再生成',
    )
    ap.add_argument('-i', '--input', required=True, help='braindump.json のパス')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--include-optional', action='store_true')
    ap.add_argument('--width', type=int, default=1920)
    ap.add_argument('--height', type=int, default=1080)
    ap.add_argument('--strict', action='store_true',
                    help='SchemaQA 違反時に PNG 生成を止める')
    ap.add_argument('--no-md-regen', action='store_true',
                    help='braindump.md の再生成を skip')
    args = ap.parse_args(argv)

    in_path = Path(args.input).resolve()
    if not in_path.exists():
        print(f'[err] not found: {in_path}', file=sys.stderr)
        return 2

    if in_path.suffix != '.json':
        print(f'[err] v11.2 では braindump.json (拡張子 .json) を渡してください: {in_path}\n'
              f'     v11.2 はクリーン break: MD 入力はサポートしません。', file=sys.stderr)
        return 2

    if not args.dry_run and cairosvg is None:
        print('[err] cairosvg が必要です: pip install --break-system-packages cairosvg', file=sys.stderr)
        return 2

    result = process_braindump(in_path, dry_run=args.dry_run,
                                include_optional=args.include_optional,
                                width=args.width, height=args.height,
                                strict=args.strict,
                                regen_md=not args.no_md_regen)

    print(f'[ok] json updated: {result["updated_json"]}')
    err = False
    pending = []
    for v in result['visuals']:
        status = v['status']
        line = f'  [{status:8}] {v["qid"]:<6}'
        if v.get('png_relpath'):
            line += f' -> {v["png_relpath"]}'
        if v.get('message'):
            line += f' ({v["message"]})'
        print(line)
        if status == 'error':
            err = True
        if status == 'pending':
            pending.append(v['qid'])

    if pending:
        print('\n[hint] SVG 未配置の Q があります。Claude が', file=sys.stderr)
        print('       enostech-svg-diagram skill の how-to-write-svg.md に従って SVG を書き、', file=sys.stderr)
        print(f'       {in_path.parent}/braindump_assets/{{Q?}}.svg に保存してから再実行してください。', file=sys.stderr)

    return 1 if err else 0


if __name__ == '__main__':
    sys.exit(main())
