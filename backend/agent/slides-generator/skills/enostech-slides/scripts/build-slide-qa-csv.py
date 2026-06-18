#!/usr/bin/env python3
# ============================================================================
#  build-slide-qa-csv.py — ENOSTECH Slides v10.8.0 (2026-05-12)
#
#  C-19 (核ルール v10.8.0) のスライド単位 QA CSV (`スライドQA.csv`) を生成する。
#  contact-sheet.png と同じ位置付け = Phase 4 の必須アウトプット。
#
#  入力:
#    decks/{slug}/plan.json                            (必須)
#    decks/{slug}/qa-manual-phase4.json                (任意、run-manual-qa.py のアウトプット)
#    decks/{slug}/qa-writing.json                      (任意、writing-qa.py --json)
#    decks/{slug}/qa-dekitaro.json                     (任意、run-pawapo-dekitaro-qa.js)
#    decks/{slug}/qa-schema.json                       (任意、schema-qa.py)
#    decks/{slug}/qa-structure.json                    (任意、build-deck.js が吐く)
#    decks/{slug}/qa-svg.json                          (任意、enostech-svg-diagram の svg-schema-qa.py)
#
#  出力: decks/{slug}/スライドQA.csv
#
#  列 (完全固定 10 列、v10.8.0 でロック):
#    | slide | template | SchemaQA | StructQA | WritingQA | ReferenceQA |
#    | VisualQA | ja-writing | SVG | notes |
#
#  値:
#    ✅ — そのスライドが該当 QA を完走 pass している
#    (空欄) — まだ確認できていない、または fatal/warn 検知あり
#    🔺 — ユーザー判断で妥協した (この場合 notes 列に必ず rationale が入る)
#
#  fatal ガード:
#    全行・全 QA 列について「✅ または (🔺 + notes に rationale)」を満たさなければ
#    exit code 1 で停止。`doc.qa_csv_strict: false` で warn 降格。
#
#  CLI:
#    python3 scripts/build-slide-qa-csv.py --deck-dir decks/2026-05-12_xxx
#    python3 scripts/build-slide-qa-csv.py --plan decks/.../plan.json
#    --strict  : default。fatal で止める
#    --warn-only : 全 QA 完走で無くても exit 0 (旧式デッキ regression 用)
#    --apply-manual <path>: per-slide 妥協 (🔺) 注釈を反映するための manual 上書き JSON
# ============================================================================
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# ----------------------------------------------------------------------------
# 固定 10 列 (v10.8.0 でロック、変更禁止)
# ----------------------------------------------------------------------------
COLUMNS = [
    "slide",       # スライド番号 (1-indexed)
    "template",    # template_id (LIST-1 等)
    "SchemaQA",    # Zod schema 適合性 (SchemaQA-01〜15)
    "StructQA",    # デッキ構造定義適合性 (StructureQA-01〜72)
    "WritingQA",   # 日本語規範 (WritingQA-01〜30)
    "ReferenceQA", # 引用整合性 (RefQA-01〜13)
    "VisualQA",    # 視覚崩れ自己目視 (VQA-01〜25)
    "ja-writing",  # 翻訳調・てにをは・比喩・AI 風表現 (ja-writing skill の 4 原則)
    "SVG",         # SVG テンプレの品質 (SchemaQA-03b / R-SVG-* / 1200 chars 未満 placeholder)
    "notes",       # 🔺 の場合の妥協理由 (rationale)
]

# fatal ガードで「全行 ✅ または 🔺+notes」を要求する列
REQUIRED_COLS = ["SchemaQA", "StructQA", "WritingQA", "ReferenceQA", "VisualQA", "ja-writing", "SVG"]


# ----------------------------------------------------------------------------
# 入力ロード
# ----------------------------------------------------------------------------
def load_json(path: Path) -> Optional[Any]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"⚠ JSON 読み込み失敗 {path}: {e}", file=sys.stderr)
        return None


def collect_slides(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """plan.json から実描画スライドを順序付きで取り出す。v8 sections[] と v9 header/body/footer
    の両方に対応する。"""
    slides: List[Dict[str, Any]] = []
    # v9 形式
    for section_key in ("header", "footer"):
        section = plan.get(section_key) or []
        if isinstance(section, list):
            for s in section:
                slides.append(s)
    body = plan.get("body")
    if isinstance(body, dict):
        chapters = body.get("chapters") or []
        if isinstance(chapters, list):
            for ch in chapters:
                if not isinstance(ch, dict):
                    continue
                for key in ("head", "body", "tail"):
                    section = ch.get(key) or []
                    if isinstance(section, list):
                        for s in section:
                            slides.append(s)
    # v8 形式
    if not slides:
        sections = plan.get("sections") or []
        if isinstance(sections, list):
            for sec in sections:
                if not isinstance(sec, dict):
                    continue
                slides_list = sec.get("slides") or []
                if isinstance(slides_list, list):
                    slides.extend(slides_list)
    return slides


# ----------------------------------------------------------------------------
# 各 QA レポートから「failed slide ids」を集計
# ----------------------------------------------------------------------------
def failed_slides_from_findings(findings: List[Any]) -> Set[int]:
    """findings は {slide_no?, slide?, page?, idx?, severity?} の配列。
    severity が fatal/error/warn のものを「失敗」と見做す。warn を除外したい場合は呼び出し側で
    フィルタする。ここでは厳しく fatal+warn を拾う。"""
    failed: Set[int] = set()
    for f in findings or []:
        if not isinstance(f, dict):
            continue
        sev = (f.get("severity") or f.get("level") or "").lower()
        # warn / error / fatal はすべて「未パス」扱い (CSV では空欄)
        if sev not in ("warn", "warning", "error", "fatal", "critical"):
            # info / pass はスキップ
            continue
        for key in ("slide_no", "slide", "page", "idx", "slide_index", "n"):
            v = f.get(key)
            if isinstance(v, int) and v > 0:
                failed.add(v)
                break
            if isinstance(v, str) and v.isdigit():
                failed.add(int(v))
                break
    return failed


def load_reports(deck_dir: Path) -> Dict[str, Set[int]]:
    """各 QA レポート JSON を読んで「失敗スライド番号集合」を返す。
    レポート未生成のものは空集合 (= 全スライド未パス扱い、CSV では空欄)。"""
    reports = {
        "SchemaQA":    deck_dir / "qa-schema.json",
        "StructQA":    deck_dir / "qa-structure.json",
        "WritingQA":   deck_dir / "qa-writing.json",
        "ReferenceQA": deck_dir / "qa-reference.json",
        "VisualQA":    deck_dir / "qa-manual-phase4.json",
        "ja-writing":  deck_dir / "qa-dekitaro.json",
        "SVG":         deck_dir / "qa-svg.json",
    }
    failed: Dict[str, Set[int]] = {}
    found: Dict[str, bool] = {}
    for label, path in reports.items():
        data = load_json(path)
        if data is None:
            failed[label] = set()  # レポート無し = 全スライド未確認扱い
            found[label] = False
            continue
        found[label] = True
        if isinstance(data, dict):
            findings = data.get("findings") or data.get("per_slide_findings") or data.get("issues") or []
        elif isinstance(data, list):
            findings = data
        else:
            findings = []
        failed[label] = failed_slides_from_findings(findings)
    return failed, found  # type: ignore


# ----------------------------------------------------------------------------
# manual 上書き (🔺 / notes)
# ----------------------------------------------------------------------------
def load_manual_overrides(path: Optional[Path]) -> Dict[int, Dict[str, str]]:
    """形式 (例):
        {
          "overrides": [
            { "slide": 12, "col": "WritingQA", "value": "🔺", "note": "固有名詞で許容" },
            { "slide": 17, "col": "VisualQA",  "value": "🔺", "note": "Visual-9 SVG の縦充填率 72%、要点伝わるため許容" }
          ]
        }
    """
    if path is None or not path.exists():
        return {}
    data = load_json(path) or {}
    overrides: Dict[int, Dict[str, str]] = {}
    items = data.get("overrides") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return {}
    for o in items:
        if not isinstance(o, dict):
            continue
        slide = o.get("slide")
        col = o.get("col")
        if not isinstance(slide, int) or col not in COLUMNS:
            continue
        overrides.setdefault(slide, {})[col] = o.get("value") or "🔺"
        if o.get("note"):
            # notes 列にまとめる (複数 col の note は ; 連結)
            existing = overrides[slide].get("notes", "")
            sep = "; " if existing else ""
            overrides[slide]["notes"] = f"{existing}{sep}{col}: {o.get('note')}"
    return overrides


# ----------------------------------------------------------------------------
# メインロジック
# ----------------------------------------------------------------------------
def cell_value(
    slide_no: int,
    col: str,
    failed: Dict[str, Set[int]],
    found: Dict[str, bool],
    overrides: Dict[int, Dict[str, str]],
) -> str:
    # manual override が最優先
    ov = overrides.get(slide_no, {}).get(col)
    if ov:
        return ov
    if col == "notes":
        return overrides.get(slide_no, {}).get("notes", "")
    if col not in REQUIRED_COLS:
        return ""
    # レポート無し = 未確認 (空欄)
    if not found.get(col, False):
        return ""
    # レポートあり + 失敗集合に含まれていなければ pass = ✅
    return "" if slide_no in failed.get(col, set()) else "✅"


def build_csv_rows(
    plan: Dict[str, Any],
    failed: Dict[str, Set[int]],
    found: Dict[str, bool],
    overrides: Dict[int, Dict[str, str]],
) -> List[List[str]]:
    slides = collect_slides(plan)
    rows: List[List[str]] = []
    for idx, slide in enumerate(slides, start=1):
        if not isinstance(slide, dict):
            continue
        tpl = slide.get("template_id") or slide.get("template") or ""
        row = []
        for col in COLUMNS:
            if col == "slide":
                row.append(str(idx))
            elif col == "template":
                row.append(str(tpl))
            else:
                row.append(cell_value(idx, col, failed, found, overrides))
        rows.append(row)
    return rows


def fatal_check(rows: List[List[str]], strict: bool) -> Tuple[bool, List[str]]:
    """全行 ✅ または 🔺(+notes) を満たすか検査。
    満たさなければ (ok=False, [失敗メッセージ])。"""
    errors: List[str] = []
    col_idx = {c: i for i, c in enumerate(COLUMNS)}
    notes_idx = col_idx["notes"]
    for row in rows:
        slide_no = row[col_idx["slide"]]
        for col in REQUIRED_COLS:
            cell = row[col_idx[col]]
            if cell == "✅":
                continue
            if cell == "🔺":
                if not row[notes_idx].strip():
                    errors.append(
                        f"スライド {slide_no} 列 {col}: 🔺 (妥協) が記入されているが notes 列に rationale が無い"
                    )
                continue
            # 空欄
            errors.append(f"スライド {slide_no} 列 {col}: 未パス (空欄)。✅ または 🔺+notes が必要")
    ok = len(errors) == 0
    if strict and not ok:
        return False, errors
    return ok, errors


def write_csv(rows: List[List[str]], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(COLUMNS)
        writer.writerows(rows)


def resolve_deck_dir(args: argparse.Namespace) -> Tuple[Path, Path]:
    if args.plan:
        plan_path = Path(args.plan).resolve()
        deck_dir = plan_path.parent
    elif args.deck_dir:
        deck_dir = Path(args.deck_dir).resolve()
        plan_path = deck_dir / "plan.json"
    else:
        print("❌ --plan または --deck-dir のいずれかが必要", file=sys.stderr)
        sys.exit(2)
    if not plan_path.exists():
        print(f"❌ plan.json が見つからない: {plan_path}", file=sys.stderr)
        sys.exit(2)
    return deck_dir, plan_path


def main(argv: List[str]) -> int:
    p = argparse.ArgumentParser(description="C-19 (v10.8.0) スライド単位 QA CSV ジェネレータ")
    p.add_argument("--plan", help="plan.json のパス (省略時 --deck-dir/plan.json を採用)")
    p.add_argument("--deck-dir", help="decks/{slug}/ ディレクトリ")
    p.add_argument("--out", help="出力 CSV パス (省略時 ${deck_dir}/スライドQA.csv)")
    p.add_argument("--apply-manual", help="🔺/notes 上書き JSON のパス")
    p.add_argument("--strict", dest="strict", action="store_true", default=True, help="fatal モード (default)")
    p.add_argument("--warn-only", dest="strict", action="store_false", help="warn 降格 (exit 0 を維持)")
    args = p.parse_args(argv[1:])

    deck_dir, plan_path = resolve_deck_dir(args)
    plan = load_json(plan_path) or {}
    if not isinstance(plan, dict):
        print(f"❌ plan.json の型が不正: {plan_path}", file=sys.stderr)
        return 2

    # plan.json 側 opt-out (doc.qa_csv_strict: false) で strict 解除
    doc = plan.get("doc") or {}
    if isinstance(doc, dict) and doc.get("qa_csv_strict") is False:
        if args.strict:
            print("ℹ doc.qa_csv_strict: false → strict を warn に降格", file=sys.stderr)
        args.strict = False

    failed, found = load_reports(deck_dir)
    overrides = load_manual_overrides(Path(args.apply_manual).resolve() if args.apply_manual else None)
    rows = build_csv_rows(plan, failed, found, overrides)
    if not rows:
        print("❌ スライドが 1 枚も検出できない (plan.json が空)", file=sys.stderr)
        return 2

    out_path = Path(args.out).resolve() if args.out else (deck_dir / "スライドQA.csv")
    write_csv(rows, out_path)
    print(f"✅ CSV 書き出し: {out_path} ({len(rows)} スライド)")

    ok, errors = fatal_check(rows, strict=args.strict)
    if not ok:
        print("", file=sys.stderr)
        print("❌ C-19 fatal: 全スライド全 QA 列が ✅ または 🔺(+notes) を満たしていません", file=sys.stderr)
        for e in errors[:20]:
            print(f"   - {e}", file=sys.stderr)
        if len(errors) > 20:
            print(f"   ... 他 {len(errors)-20} 件", file=sys.stderr)
        print("", file=sys.stderr)
        print("対処:", file=sys.stderr)
        print("  1. 該当 QA 工程を実行して空欄を ✅ で埋める (`python3 scripts/run-qa.py phase4 ...`)", file=sys.stderr)
        print("  2. ユーザー判断で妥協する場合は --apply-manual で 🔺 + notes を記入", file=sys.stderr)
        print("  3. 旧式デッキで CSV 列に対応できない場合は plan.json に `doc.qa_csv_strict: false` を明示", file=sys.stderr)
        if args.strict:
            return 1
        else:
            print("(--warn-only または doc.qa_csv_strict: false により exit 0 を維持)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
