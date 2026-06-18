#!/usr/bin/env python3
"""
run-manual-qa.py
=============================
Phase 2 完了直前および Phase 4 で実施する **手動 QA** を、
「yes / no + 1 行理由」のチェックリスト形式で qa_report.json (SSOT) に書き込むツール。

bypass モード時に Claude が「strict が pass したから OK」と早期に切り上げる
事故を構造的に防ぐのが目的。手動 QA を Markdown チェックリストから
「ファイルに書くまで完了しない」運用に変える。

使い方:
  # Phase 2 用 (SecQA-01/03/04/06/07/08 + RefQA-01/03〜10 を走査)
  python3 scripts/run-manual-qa.py phase2 --plan decks/{slug}/plan.json

  # Phase 4 用 (VQA-01〜16 を走査)
  python3 scripts/run-manual-qa.py phase4 --plan decks/{slug}/plan.json --preview-dir decks/{slug}/preview

実行方法 (Claude / 人間共通):
  - スクリプトはチェックリスト雛形を `decks/{slug}/qa-self-report.md` に書き出す
  - その雛形を編集して各項目に「yes/no + 1 行理由」を埋める
  - 編集後にもう一度同じコマンドを実行すると、雛形を読み込んで qa_report.json の
    layers に反映する (`--apply` 自動判定)

bypass モードの Claude は、雛形書き出し → 自分で yes/no を埋める →
qa_report.json に反映、を **必ず実行**する。スキップして進めないこと。
"""

import argparse
import json
import sys
import re
from pathlib import Path
from datetime import datetime

PHASE2_RULES = {
    "SecQA-01": "章タイトルと章内スライドの内容が整合している (章名 ↔ 含まれる主張)",
    "SecQA-03": "各章のスライド数が 2〜10 枚に収まっている",
    "SecQA-04": "章内の論理フロー (現状 → 課題 → 解決策 → 行動 等) が崩れていない",
    "SecQA-06": "章をまたいだ事実主張・固有名詞の重複が無い",
    "SecQA-07": "章タイトルと subsection 名で語彙ダブりが無い",
    "SecQA-08": "序盤 4 枚 (表紙/構築背景/Before-After/目次) と締め 3〜4 枚 (参考情報集/お土産/会社紹介) の固定枠が崩れていない",
    "RefQA-01": "引用 URL は最深ページに直接リンクしている (root URL 禁止)",
    "RefQA-03": "ファクト主張に必要な参照付与の判定 (参考必要性判定表 適用)",
    "RefQA-04": "表記ゆれ無し (例: dbt vs DBT, ENOSTECH vs Enostech)",
    "RefQA-05": "本文の主張番号 ⇔ DATA-4 の ref_table 行番号が完全一致",
    "RefQA-06": "可能なら一次情報 (公式サイト・原典) を優先している",
    "RefQA-07": "年表記の精度 (発行年・最終更新年が分かる)",
    "RefQA-08": "DATA-4 のテーブル行数が自動分割で破綻していない (1 ページに 12 行以下)",
    "RefQA-10": "DATA-4 の参考情報集タイトルが原典のパンくずを反映している",
}

PHASE4_RULES = {
    "VQA-01": "テキストのシェイプはみ出しが無い (最重点)",
    "VQA-02": "領域逸脱が無い (要素がスライド外に出ていない)",
    "VQA-03": "レイヤー視認性 OK (要素どうしが重なって読めない箇所が無い)",
    "VQA-04": "テーマ一貫性 (ブランドカラーが全スライドで揃っている)",
    "VQA-05": "章扉とナビ chip 文字列が整合している",
    "VQA-06": "スライド番号 (NN/MM) の連続性が崩れていない",
    "VQA-07": "ロゴ・左帯・サイドストライプの位置・色が全枚揃っている",
    "VQA-08": "サブコピーが切れていない (1〜4 行で収まっている)",
    "VQA-09": "図解 (DIAG-XX) のラベル文字が読める大きさで残っている",
    "VQA-10": "テーブル系 (DATA-2/30/31/48) のセル文字が折り返しで破綻していない",
    "VQA-11": "FRAMING-4 お土産のアイコン円が他要素と被っていない",
    "VQA-12": "FRAMING-3 会社紹介の QR コード・受賞ロゴが正常に表示されている",
    "VQA-13": "CHART-XX (CHART-A1〜A4 内のチャート) で複数系列のパレットが識別可能 / 軸ラベル・凡例が切れていない",
    "VQA-14": "DIAG-XX (SECSUMMARY-1 内のダイアグラム) の構造が壊れていない (4 ノード/3 層 等の必須要素が揃っている)",
    "VQA-15": "SCENE-XX (SECSUMMARY-1 内のシーン) でラベルが枠外に出ず、矢印・connectors が意図したノード間を結んでいる",
    "VQA-16": "atoms-shape カスタム挿絵で色がトークン経由 (hex 直書き禁止) / フォントが Noto Sans JP",
    "VQA-17": "サブコピー背景の高さが実描画文字数と整合 (タイトル直下の不自然な空白 0.5\" 以上が無い)",
    "VQA-18": "DATA-4 参考情報集がフッター領域 (y=5.28\") を侵食していない、テーブルとページ番号がクリーンに分離",
    "VQA-19": "タイトル/見出し (LIST-2 cols[].title / LIST-3 items[].name 等) の折返しが本文や tag と被っていない、SchemaQA-11 で fatal/warn が出たスライドは個別目視",
    "VQA-20": "LIST-1 の bullets[].body が長くて次 bullet head に被っていない、コード/長文 bullet は別テンプレ検討",
}


def make_template(rules: dict, phase: str, deck_title: str) -> str:
    today = datetime.now().strftime("%Y-%m-%d")
    lines = [
        f"# 手動 QA セルフレポート — {phase} ({deck_title})",
        f"作成日: {today}",
        "",
        "> このファイルは `scripts/run-manual-qa.py` が生成した雛形です。",
        "> 各ルールに対して **`status: pass | fail | n/a` と `note: 1 行理由`** を埋めてください。",
        "> 編集後にもう一度 `python3 scripts/run-manual-qa.py` を実行すると qa_report.json に反映されます。",
        "",
    ]
    for rid, desc in rules.items():
        lines.extend([
            f"## {rid}",
            f"**判定対象**: {desc}",
            "",
            "```yaml",
            f"rule_id: {rid}",
            "status: ___       # pass / fail / n/a のいずれか",
            "note: ___         # 1 行で判定理由を書く (空欄不可)",
            "```",
            "",
        ])
    return "\n".join(lines) + "\n"


def parse_template(text: str) -> list:
    """qa-self-report.md の YAML ブロックから rule_id / status / note を抽出"""
    results = []
    pattern = re.compile(
        r"```yaml\s*\n"
        r"rule_id:\s*(\S+)\s*\n"
        r"status:\s*(\S+)\s*(?:#[^\n]*)?\n"
        r"note:\s*(.*?)\s*(?:#[^\n]*)?\n"
        r"```",
        re.DOTALL,
    )
    for m in pattern.finditer(text):
        rid, status, note = m.group(1), m.group(2).strip(), m.group(3).strip()
        if status == "___" or note == "___" or not note:
            continue  # 未記入はスキップ
        results.append({"rule_id": rid, "status": status, "note": note})
    return results


LAYER_DEFAULTS = {
    "SecQA-Manual": {"name": "Sections QA (手動)", "rule_count": 6,
                     "scope": "SecQA-01/03/04/06/07/08"},
    "RefQA-Manual": {"name": "Reference QA (手動)", "rule_count": 9,
                     "scope": "RefQA-01/03〜10"},
    "VQA": {"name": "Visual QA (手動)", "rule_count": 12,
            "scope": "VQA-01〜16"},
    "SQA": {"name": "Slide QA (手動)", "rule_count": 10,
            "scope": "SQA-01/02/03/08/10/11/12/13/14/15"},
}


def _ensure_layer(layers: list, code: str) -> dict:
    """layers の中から code の層を探すか、新規作成して append"""
    layer = next((l for l in layers if l.get("code") == code), None)
    if not layer:
        defaults = LAYER_DEFAULTS.get(code, {})
        layer = {
            "code": code,
            "name": defaults.get("name", code),
            "rule_count": defaults.get("rule_count", 0),
            "scope": defaults.get("scope", ""),
            "source": "run-manual-qa.py",
            "violations": [],
            "violation_count": 0,
            "status": "pending",
        }
        layers.append(layer)
    return layer


def apply_to_qa_report(plan_path: Path, phase: str, results: list, layer_code: str):
    """qa_report.json (SSOT) の layers に手動 QA 結果を反映。

    rule_id プレフィックスで自動振り分け:
      - phase2: SecQA-* → SecQA-Manual 層 / RefQA-* → RefQA-Manual 層
      - phase4: VQA-*   → VQA 層
    """
    # qa-report-io.py をロード
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "qa_report_io",
        Path(__file__).resolve().parent / "qa-report-io.py",
    )
    qa_io = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(qa_io)

    deck_dir = plan_path.parent
    qa = qa_io.ensure_skeleton(deck_dir, plan_path)
    layers = qa.setdefault("layers", [])

    # phase ごとに振り分け先 layer を決定
    def target_code(rule_id: str) -> str:
        if phase == "phase2":
            if rule_id.startswith("RefQA-"):
                return "RefQA-Manual"
            return "SecQA-Manual"  # SecQA-* も RefQA-* 以外もここに入る (主に SecQA)
        # phase4
        return "VQA"

    # 各 layer の既存違反を取得
    layer_existing = {}
    for r in results:
        rid = r["rule_id"]
        code = target_code(rid)
        if code not in layer_existing:
            layer = _ensure_layer(layers, code)
            layer_existing[code] = (layer, {v.get("rule_id"): v for v in (layer.get("violations") or []) if isinstance(v, dict)})

    # 全結果を反映
    touched_codes = set()
    for r in results:
        rid = r["rule_id"]
        code = target_code(rid)
        if code not in layer_existing:
            layer = _ensure_layer(layers, code)
            layer_existing[code] = (layer, {v.get("rule_id"): v for v in (layer.get("violations") or []) if isinstance(v, dict)})
        layer, existing = layer_existing[code]
        if r["status"] == "fail":
            existing[rid] = {
                "rule_id": rid,
                "severity": "warn",
                "message": r["note"],
                "target": "(manual)",
                "source": "run-manual-qa.py",
            }
        elif rid in existing:
            del existing[rid]
        touched_codes.add(code)

    # 全 layer を最終整形
    for code in touched_codes:
        layer, existing = layer_existing[code]
        layer["violations"] = list(existing.values())
        layer["violation_count"] = len(layer["violations"])
        layer["status"] = "pass" if not layer["violations"] else "fail"
        layer["last_manual_qa_at"] = datetime.now().isoformat()
        layer["manual_qa_phase"] = phase

    # qa_report.json に書き戻す (totals と sha も更新)
    qa["plan_sha256"] = qa_io.compute_plan_sha256(plan_path)
    qa["total_violations"] = sum(l.get("violation_count", 0) for l in qa.get("layers", []))
    qa["total_rules"] = sum(l.get("rule_count", 0) for l in qa.get("layers", []))
    qa_io.save_qa_report(deck_dir, qa)


def main():
    ap = argparse.ArgumentParser(description="Phase 2/4 手動 QA セルフレポートツール")
    ap.add_argument("phase", choices=["phase2", "phase4"], help="どの Phase の QA か")
    ap.add_argument("--plan", required=True, help="plan.json のパス")
    ap.add_argument("--report", help="qa-self-report.md のパス (省略時は plan.json と同階層)")
    ap.add_argument("--apply", action="store_true",
                    help="既存 qa-self-report.md を読んで qa_report.json に反映するモード (省略時は雛形書き出しまたは自動判定)")
    args = ap.parse_args()

    plan_path = Path(args.plan).resolve()
    if not plan_path.exists():
        print(f"[error] plan.json not found: {plan_path}", file=sys.stderr)
        sys.exit(1)

    deck_dir = plan_path.parent
    report_path = Path(args.report).resolve() if args.report else (deck_dir / f"qa-self-report-{args.phase}.md")

    rules = PHASE2_RULES if args.phase == "phase2" else PHASE4_RULES
    layer_code = "SecQA-Manual" if args.phase == "phase2" else "VQA"
    # phase2 で RefQA-* ルールを書いた場合は別途 RefQA-Manual に振り分ける (apply_to_plan 内で処理)

    if not report_path.exists() or args.apply is False and not args.apply:
        # 雛形書き出し / 既存があれば apply 自動判定
        if report_path.exists():
            text = report_path.read_text(encoding="utf-8")
            results = parse_template(text)
            if results:
                # 既に埋まっているなら apply
                deck_title = json.loads(plan_path.read_text(encoding="utf-8")).get("doc", {}).get("title", "(deck)")
                apply_to_qa_report(plan_path, args.phase, results, layer_code)
                print(f"[ok] applied {len(results)} rules to {plan_path}")
                print(f"     report: {report_path}")
                print(f"     layer: {layer_code}")
                return
        # 雛形書き出し
        deck_title = json.loads(plan_path.read_text(encoding="utf-8")).get("doc", {}).get("title", "(deck)")
        report_path.write_text(make_template(rules, args.phase, deck_title), encoding="utf-8")
        print(f"[ok] wrote template: {report_path}")
        print(f"     全 {len(rules)} ルールを編集してから、もう一度同じコマンドを実行してください。")
        print(f"     bypass モードで急いでいても、status と note を埋めずに進めないでください (R-BYPASS-5)。")
        return

    # --apply 明示
    if not report_path.exists():
        print(f"[error] report not found: {report_path}", file=sys.stderr)
        sys.exit(1)
    text = report_path.read_text(encoding="utf-8")
    results = parse_template(text)
    if not results:
        print(f"[warn] {report_path} に埋まったルールが 0 件 — 雛形を編集してから再実行してください", file=sys.stderr)
        sys.exit(1)
    apply_to_qa_report(plan_path, args.phase, results, layer_code)
    print(f"[ok] applied {len(results)} rules to {plan_path.parent / 'qa_report.json'}")


if __name__ == "__main__":
    main()
