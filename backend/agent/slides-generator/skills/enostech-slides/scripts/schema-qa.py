#!/usr/bin/env python3
"""
schema-qa.py
============
v7.11 (2026-05-02) で SchemaQA は build-deck.js の Zod スキーマ層と
`validateDeckGlobal()` に全面集約された。本ファイルは互換のため残す
最小スタブ:

  - `validate_schema_qa(data)` は no-op (空配列を返す)
  - `KNOWN_TEMPLATE_IDS` は Phase 2 の補助検査からも参照され得るため、
    現行 `scripts/render/templates/*/index.js` の registry に同期した
    新 ID set を保持する

旧 SchemaQA-01〜17 の仕様解説は `references/qa/schema-qa.md` を参照。
旧 _check_* 関数群は v8.5 クリーンアップで削除済み (歴史は git log を参照)。
"""

import sys
import json
import argparse
from typing import List, Dict, Any


# ────────────────────────────────────────────────────────────────────
# 既知テンプレ ID 一覧
# ────────────────────────────────────────────────────────────────────
# `scripts/render/templates/*/index.js` の registry スナップショット。
# 新テンプレを追加した時はこちらも追加すること。

KNOWN_TEMPLATE_IDS = set()

# section
for n in range(1, 7):
    KNOWN_TEMPLATE_IDS.add(f'SECTION-{n}')

# list
for n in range(1, 10):
    KNOWN_TEMPLATE_IDS.add(f'LIST-{n}')

# compare
for n in range(1, 7):
    KNOWN_TEMPLATE_IDS.add(f'COMPARE-{n}')

# data
for n in range(1, 6):
    KNOWN_TEMPLATE_IDS.add(f'DATA-{n}')

# project
for n in range(1, 5):
    KNOWN_TEMPLATE_IDS.add(f'PROJECT-{n}')

# diagram (DIAGRAM-1〜3 + SECSUMMARY-1)
for n in range(1, 4):
    KNOWN_TEMPLATE_IDS.add(f'DIAGRAM-{n}')
KNOWN_TEMPLATE_IDS.add('SECSUMMARY-1')

# chart (テンプレ層)
for n in range(1, 5):
    KNOWN_TEMPLATE_IDS.add(f'CHART-A{n}')

# visual
for n in range(1, 13):
    KNOWN_TEMPLATE_IDS.add(f'VISUAL-{n}')

# webpage
for n in range(1, 5):
    KNOWN_TEMPLATE_IDS.add(f'WEBPAGE-{n}')

# framing
for n in range(1, 6):
    KNOWN_TEMPLATE_IDS.add(f'FRAMING-{n}')

# free
KNOWN_TEMPLATE_IDS.add('FREE-1')

# code
for n in range(1, 8):
    KNOWN_TEMPLATE_IDS.add(f'CODE-{n}')

# ── ネスト経由で呼ばれる ID ──
# DIAG-02〜09 (SECSUMMARY-1 の diagram フィールド経由)
for n in range(2, 10):
    KNOWN_TEMPLATE_IDS.add(f'DIAG-{n:02d}')

# CHART-01〜09 (CHART-A1〜A4 の chart フィールド経由)
for n in range(1, 10):
    KNOWN_TEMPLATE_IDS.add(f'CHART-{n:02d}')

# SCENE-01〜06 (SECSUMMARY-1 / DIAGRAM-3 の diagram または scene フィールド経由)
for n in range(1, 7):
    KNOWN_TEMPLATE_IDS.add(f'SCENE-{n:02d}')


# ────────────────────────────────────────────────────────────────────
# 公開エントリポイント (no-op)
# ────────────────────────────────────────────────────────────────────

def validate_schema_qa(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    SchemaQA 検証は build-deck.js (Zod + validateDeckGlobal) に完全集約された。
    本関数は no-op (空配列を返す) で、互換のために残す。

    旧仕様 (SchemaQA-01〜17) は `references/qa/schema-qa.md` を参照。
    """
    return []


# ────────────────────────────────────────────────────────────────────
# CLI (単独デバッグ用)
# ────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description='SchemaQA: 互換スタブ (実体は build-deck.js に集約済み)',
    )
    ap.add_argument('--input', '-i', help='入力 JSON ファイル (省略時は標準入力)')
    ap.add_argument(
        '--strict', action='store_true',
        help='fatal 違反があれば exit code 2 (no-op のため常に 0)',
    )
    ap.add_argument(
        '--json-out', action='store_true',
        help='違反リストを JSON で標準出力に書き出す (常に [])',
    )
    args = ap.parse_args()

    if args.input:
        with open(args.input, encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = json.load(sys.stdin)

    violations = validate_schema_qa(data)

    if args.json_out:
        json.dump(violations, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write('\n')

    print(
        f'SchemaQA 結果: fatal=0 / warn=0 / total=0 (本スクリプトは no-op スタブ)',
        file=sys.stderr,
    )

    if args.strict:
        sys.exit(0)


if __name__ == '__main__':
    main()
