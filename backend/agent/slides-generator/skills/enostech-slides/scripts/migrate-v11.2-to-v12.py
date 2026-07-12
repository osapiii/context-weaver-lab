#!/usr/bin/env python3
"""
migrate-v11.2-to-v12.py
=======================
v11.2 braindump.json を v12 にマイグレーションする。

変更点:
  1. $schema: "braindump-v11.2" → "braindump-v12"
  2. deck.deck_structure が未設定の場合 'learning-deck' をデフォルト挿入 (warn)
  3. meta.schema_version: "11.2" → "12"

USAGE:
    # dry-run (デフォルト)
    python3 scripts/migrate-v11.2-to-v12.py --input decks/{slug}/braindump.json

    # 書き換え実行 (.bak バックアップ自動)
    python3 scripts/migrate-v11.2-to-v12.py --input decks/{slug}/braindump.json --write

    # 一括変換 (decks/* 全部)
    python3 scripts/migrate-v11.2-to-v12.py --input decks/ --write
"""

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import List, Tuple


def migrate_one(json_path: Path, write: bool = False) -> Tuple[bool, List[str]]:
    """1 ファイルを v11.2 → v12 に migrate。
    Returns (changed, log_lines)"""
    log: List[str] = []
    try:
        data = json.loads(json_path.read_text(encoding='utf-8'))
    except Exception as e:
        log.append(f'[err] {json_path}: JSON parse failed: {e}')
        return False, log

    changed = False
    # 1. $schema
    if data.get('$schema', '').startswith('braindump-v11.2'):
        data['$schema'] = 'braindump-v12'
        changed = True
        log.append(f'  $schema → braindump-v12')

    # 2. deck.deck_structure
    deck = data.setdefault('deck', {})
    if not deck.get('deck_structure'):
        deck['deck_structure'] = 'learning-deck'
        changed = True
        log.append(f'  deck.deck_structure → "learning-deck" (default; please verify)')

    # 3. meta.schema_version
    meta = data.setdefault('meta', {})
    if meta.get('schema_version', '').startswith('11'):
        meta['schema_version'] = '12'
        changed = True
        log.append(f'  meta.schema_version → "12"')

    if changed and write:
        bak = json_path.with_suffix(json_path.suffix + '.bak')
        shutil.copy2(json_path, bak)
        log.append(f'  backup → {bak}')
        json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        log.append(f'  written → {json_path}')
    elif changed:
        log.append(f'  (dry-run) — pass --write to apply')

    return changed, log


def main(argv=None):
    ap = argparse.ArgumentParser(description='v11.2 braindump.json → v12 マイグレータ')
    ap.add_argument('--input', '-i', required=True, type=Path,
                    help='braindump.json ファイル or decks/ ディレクトリ')
    ap.add_argument('--write', action='store_true', help='実際に書き換える (.bak バックアップ自動)')
    args = ap.parse_args(argv)

    if args.input.is_file():
        targets = [args.input]
    elif args.input.is_dir():
        targets = sorted(args.input.glob('**/braindump.json'))
    else:
        print(f'[err] not found: {args.input}', file=sys.stderr)
        return 2

    if not targets:
        print(f'[warn] no braindump.json found under {args.input}')
        return 0

    n_changed = 0
    for tgt in targets:
        print(f'\n→ {tgt}')
        changed, log = migrate_one(tgt, write=args.write)
        for line in log:
            print(line)
        if changed:
            n_changed += 1
        else:
            print('  (no change)')

    print(f'\nDone. {n_changed} / {len(targets)} files {"migrated" if args.write else "would be migrated"}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
