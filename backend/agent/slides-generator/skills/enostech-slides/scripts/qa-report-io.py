#!/usr/bin/env python3
"""
qa-report-io.py — qa_report.json の SSOT ヘルパー
==============================================================
QA 実行結果は **plan.json と独立した `qa_report.json`** に書き出す。
plan.json は「設計指示書」、qa_report.json は「QA 実行結果」と責務を分離する。

公開 API:
  load_qa_report(deck_dir)      → dict | None
  save_qa_report(deck_dir, qa)  → None
  compute_plan_sha256(plan_path) → str (16 進)
  ensure_skeleton(deck_dir, plan_path) → dict (既存があれば read、なければ skeleton 作成)
  update_phase(qa, phase, exit_code, plan_sha) → dict
  validate_phase4_gate(qa, plan_path) → tuple[bool, str]  Phase 4 入口チェック

スキーマ:
  {
    "$schema_version": "v6.46",
    "generated_at": "2026-04-29T01:30:00",
    "plan_path": "plan.json",
    "plan_sha256": "abc123...",     # plan.json の doc + sections のハッシュ
    "phase_completed": ["phase2"],
    "exit_codes": {
      "phase2": 0,
      "phase4": null
    },
    "total_violations": 0,
    "total_rules": 67,
    "layers": [
      { "code": "M", "name": "...", "source": "...", "violations": [...], ... },
      ...
    ]
  }
"""

import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


SCHEMA_VERSION = "v6.46"
QA_REPORT_FILENAME = "qa_report.json"


# ─── ハッシュ計算 ──────────────────────────────────
def compute_plan_sha256(plan_path: Path) -> str:
    """plan.json の doc + sections だけを対象にハッシュ計算。

    reviews / qa_report 等の付帯フィールドが変わっても再 QA 不要にするため、
    主要設計データ (doc + sections) のみを対象にする。
    """
    data = json.loads(plan_path.read_text(encoding="utf-8"))
    canonical = json.dumps(
        {"doc": data.get("doc", {}), "sections": data.get("sections", [])},
        ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ─── 読み書き ──────────────────────────────────────
def _qa_report_path(deck_dir: Path) -> Path:
    return deck_dir / QA_REPORT_FILENAME


def load_qa_report(deck_dir: Path) -> Optional[dict]:
    p = _qa_report_path(deck_dir)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def save_qa_report(deck_dir: Path, qa: dict) -> None:
    p = _qa_report_path(deck_dir)
    qa["generated_at"] = datetime.now().isoformat()
    qa.setdefault("$schema_version", SCHEMA_VERSION)
    p.write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8")


# ─── スケルトン作成 ────────────────────────────────
def ensure_skeleton(deck_dir: Path, plan_path: Path) -> dict:
    """qa_report.json が存在すれば読み込み、なければ skeleton を作る。"""
    qa = load_qa_report(deck_dir)
    if qa is not None:
        return qa

    qa = {
        "$schema_version": SCHEMA_VERSION,
        "plan_path": plan_path.name,
        "plan_sha256": compute_plan_sha256(plan_path),
        "phase_completed": [],
        "exit_codes": {"phase2": None, "phase4": None},
        "total_violations": 0,
        "total_rules": 0,
        "layers": [],
    }
    save_qa_report(deck_dir, qa)
    return qa


# ─── phase 完了の記録 ──────────────────────────────
def update_phase(qa: dict, phase: str, exit_code: int, plan_sha: str) -> dict:
    """Phase 完了時に exit_code と plan_sha256 を記録。

    pass (exit 0) 時のみ phase_completed に追加。
    plan_sha が変わっていたら、これまでの phase_completed をリセットする
    (plan が変わった = 過去の QA 結果が無効になる)。
    """
    qa.setdefault("exit_codes", {"phase2": None, "phase4": None})
    qa.setdefault("phase_completed", [])

    if qa.get("plan_sha256") and qa["plan_sha256"] != plan_sha:
        qa["phase_completed"] = []
        qa["exit_codes"] = {"phase2": None, "phase4": None}
        qa["_invalidated_at"] = datetime.now().isoformat()
        qa["_invalidated_reason"] = "plan_sha256 changed — past QA results invalidated"

    qa["plan_sha256"] = plan_sha
    qa["exit_codes"][phase] = exit_code

    if exit_code == 0 and phase not in qa["phase_completed"]:
        qa["phase_completed"].append(phase)
    elif exit_code != 0 and phase in qa["phase_completed"]:
        qa["phase_completed"].remove(phase)

    # totals 再集計
    layers = qa.get("layers", [])
    qa["total_violations"] = sum(l.get("violation_count", 0) for l in layers)
    qa["total_rules"] = sum(l.get("rule_count", 0) for l in layers)
    return qa


# ─── Phase 4 入口ゲート ────────────────────────────
def validate_phase4_gate(deck_dir: Path, plan_path: Path) -> tuple[bool, str]:
    """build-deck-package を呼ぶ前のチェック。

    戻り値: (ok, reason)
      ok=True  → 通過、 reason は空文字
      ok=False → ブロック、reason に理由
    """
    qa = load_qa_report(deck_dir)
    if qa is None:
        return False, (
            f"{QA_REPORT_FILENAME} が存在しません。"
            f"`python3 scripts/run-qa.py phase2 --plan {plan_path.name}` と "
            f"`python3 scripts/run-qa.py phase4 --plan {plan_path.name} --apply-manual` を踏んでください"
        )
    current_sha = compute_plan_sha256(plan_path)
    if qa.get("plan_sha256") != current_sha:
        return False, (
            f"{QA_REPORT_FILENAME} の plan_sha256 が現在の plan.json と一致しません "
            f"(plan.json が更新されたあと QA が再実行されていない)。"
            f"`python3 scripts/run-qa.py phase2 --plan {plan_path.name}` から再実行してください"
        )
    if "phase4" not in qa.get("phase_completed", []):
        return False, (
            f"Phase 4 (VQA) が未実行です。"
            f"`python3 scripts/run-qa.py phase4 --plan {plan_path.name} --apply-manual` を踏んでください"
        )
    if "phase2" not in qa.get("phase_completed", []):
        return False, (
            f"Phase 2 (機械検証 + 手動 QA) が未完了です。"
            f"`python3 scripts/run-qa.py phase2 --plan {plan_path.name} --apply-manual` を踏んでください"
        )
    return True, ""


# ─── CLI (デバッグ用) ───────────────────────────────
def _cli():
    import argparse
    ap = argparse.ArgumentParser(description="qa_report.json ヘルパー (デバッグ CLI)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sp_show = sub.add_parser("show", help="qa_report.json の中身を表示")
    sp_show.add_argument("--deck-dir", required=True)

    sp_gate = sub.add_parser("gate", help="Phase 4 ゲートを試す")
    sp_gate.add_argument("--plan", required=True)

    sp_sha = sub.add_parser("sha", help="plan.json の sha256 を計算")
    sp_sha.add_argument("--plan", required=True)

    args = ap.parse_args()

    if args.cmd == "show":
        qa = load_qa_report(Path(args.deck_dir))
        print(json.dumps(qa, ensure_ascii=False, indent=2) if qa else "(not found)")
    elif args.cmd == "gate":
        plan = Path(args.plan).resolve()
        ok, reason = validate_phase4_gate(plan.parent, plan)
        print(f"ok={ok}\nreason={reason}")
        sys.exit(0 if ok else 2)
    elif args.cmd == "sha":
        print(compute_plan_sha256(Path(args.plan).resolve()))


if __name__ == "__main__":
    _cli()
