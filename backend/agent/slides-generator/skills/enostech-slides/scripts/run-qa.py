#!/usr/bin/env python3
"""
run-qa.py — QA オーケストレータ
================================================
Phase 2 / Phase 4 の QA を **1 コマンドで** 順次実行するラッパ。
スキル本体のドキュメントからは原則このスクリプトだけを呼ぶようにし、
個別スクリプト (render-deck-instruction.py / run-manual-qa.py / pptx-to-images.sh) は
「内部実装」として隠す。

使い方
------
  # Phase 2 (plan.json 提出前)
  python3 scripts/run-qa.py phase2 --plan decks/{slug}/plan.json
    → 機械検証 (M? + SchemaQA + SecQA-Auto + RefQA-Auto) を strict で実行
    → plan.html を生成
    → 手動 QA (SecQA / RefQA) の雛形が未作成なら書き出し
    → exit 0  / 2  / 3

  # Phase 2 で手動 QA 編集後の反映
  python3 scripts/run-qa.py phase2 --plan ... --apply-manual
    → qa-self-report-phase2.md を読んで plan.json に反映 + plan.html 再生成

  # Phase 4 (draft.pptx 完成後)
  python3 scripts/run-qa.py phase4 --plan decks/{slug}/plan.json
    → pptx-to-images.sh で PNG + コンタクトシート生成
    → VQA 雛形を書き出し
    → exit 0  / 3

  # Phase 4 で手動 QA 編集後の反映
  python3 scripts/run-qa.py phase4 --plan ... --apply-manual

オプション
---------
  --bypass         bypass モード: --strict-refqa を強制 ON (RefQA-02 を fatal 化)
  --strict / -s    機械検証で fatal 違反があれば exit 2 (default: ON, --no-strict で外せる)
  --no-strict      strict を外す (デバッグ用)
  --apply-manual   手動 QA セルフレポートを plan.json に反映 (省略時は雛形書き出し)
  --quiet / -q     stderr の進行ログを抑制

Exit code
---------
  0  全パス
  2  機械検証 (M? / SchemaQA / SecQA-Auto / RefQA-Auto + --strict-refqa) で fatal
  3  手動 QA セルフレポートが未記入のため進行不可 (Claude / 人間が雛形を埋める必要あり)
  4  下流スクリプトの異常終了 (build エラー等)

設計原則
--------
  - このスクリプトは **オーケストレータ** であり、QA ロジック自体は持たない。
    実検査は render-deck-instruction.py / run-manual-qa.py / schema-qa.py 側にある。
  - `scripts/render-deck-instruction.py` 等は「内部実装」と位置付け、
    SKILL.md / workflow.md / bypass-mode.md からは原則直接呼ばない。
"""

import argparse
import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

# ───── パス解決 ──────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
RENDER_PY = SCRIPT_DIR / "render-deck-instruction.py"
MANUAL_QA_PY = SCRIPT_DIR / "run-manual-qa.py"
PPTX_TO_IMAGES_SH = SCRIPT_DIR / "pptx-to-images.sh"
QA_REPORT_IO_PY = SCRIPT_DIR / "qa-report-io.py"
BUILD_DECK_JS = SCRIPT_DIR / "render" / "build-deck.js"  # v6.48: Phase 2 で draft.pptx 自動ビルド
DEKITARO_JS = SCRIPT_DIR / "render" / "run-pawapo-dekitaro-qa.js"  # v9.5: でき太郎 専門レビュー
BSQA_PY = SCRIPT_DIR / "braindump-structure-qa.py"  # v11.1: BSQA-01〜12 構造 QA
LINKIFY_PY = SCRIPT_DIR / "braindump-linkify.py"  # v11.1: [N] → [[N]](url) 変換
WRITING_QA_PY = SCRIPT_DIR / "writing-qa.py"  # writing-qa --mode braindump


def _load_qa_io():
    """qa-report-io.py を動的 import"""
    import importlib.util
    spec = importlib.util.spec_from_file_location("qa_report_io", QA_REPORT_IO_PY)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ───── ユーティリティ ────────────────────────────────
def log(msg: str, *, quiet: bool = False, prefix: str = "[run-qa]") -> None:
    if quiet:
        return
    print(f"{prefix} {msg}", file=sys.stderr)


def run_cmd(cmd: list[str], *, quiet: bool = False, check: bool = True) -> subprocess.CompletedProcess:
    """子プロセスを実行。stderr/stdout はそのまま親に流す (quiet 時のみ抑制)。"""
    log(f"$ {' '.join(shlex.quote(c) for c in cmd)}", quiet=quiet)
    result = subprocess.run(
        cmd,
        check=False,
        text=True,
    )
    if check and result.returncode != 0:
        log(f"子プロセスが exit code {result.returncode} で終了: {cmd[0]}", quiet=quiet, prefix="[run-qa] ⚠")
    return result


def manual_qa_filled(plan_path: Path, phase: str) -> tuple[bool, Path]:
    """手動 QA セルフレポートが埋まっているかを判定。

    戻り値: (is_filled, report_path)
    is_filled = True なら status と note が埋まった YAML ブロックが 1 件以上ある。
    """
    deck_dir = plan_path.parent
    report_path = deck_dir / f"qa-self-report-{phase}.md"
    if not report_path.exists():
        return False, report_path
    text = report_path.read_text(encoding="utf-8")
    import re
    # status: ___ (未記入) かどうか判定
    pattern = re.compile(
        r"```yaml\s*\n"
        r"rule_id:\s*(\S+)\s*\n"
        r"status:\s*(\S+)\s*(?:#[^\n]*)?\n"
        r"note:\s*(.*?)\s*(?:#[^\n]*)?\n"
        r"```",
        re.DOTALL,
    )
    filled = 0
    total = 0
    for m in pattern.finditer(text):
        total += 1
        status, note = m.group(2).strip(), m.group(3).strip()
        if status != "___" and note != "___" and note:
            filled += 1
    return (filled == total and total > 0, report_path)


# ───── Phase 2 オーケストレーション ──────────────────
def _record_phase_completion(plan_path: Path, phase: str, exit_code: int, *, quiet: bool = False) -> None:
    """qa_report.json に phase 完了情報を記録"""
    try:
        qa_io = _load_qa_io()
        deck_dir = plan_path.parent
        qa = qa_io.ensure_skeleton(deck_dir, plan_path)
        plan_sha = qa_io.compute_plan_sha256(plan_path)
        qa = qa_io.update_phase(qa, phase, exit_code, plan_sha)
        qa_io.save_qa_report(deck_dir, qa)
        if not quiet:
            label = {0: "pass", 2: "fatal", 3: "pending", 4: "error"}.get(exit_code, "?")
            log(f"  📝 qa_report.json 更新: {phase}={label}", quiet=quiet)
    except Exception as e:
        log(f"qa_report.json 更新失敗: {e}", prefix="[run-qa] ⚠")


def _build_and_preview_pptx(plan_path: Path, deck_dir: Path, *, quiet: bool):
    """
    Phase 2 内で draft.pptx を自動ビルドし、preview/ に PNG を出力する。

    Returns: (exit_code, preview_dir)
      exit_code: 0=成功 / 非0=失敗
      preview_dir: 成功時は preview ディレクトリのパス、失敗時は None
    """
    import os
    draft_dir = deck_dir / "draft"
    draft_pptx = draft_dir / "draft.pptx"
    preview_dir = deck_dir / "preview"

    draft_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    # --- 2a. build-deck.js で draft.pptx 生成 ---
    log("  2a. draft.pptx ビルド (build-deck.js)", quiet=quiet)
    if not BUILD_DECK_JS.is_file():
        log(f"build-deck.js が見つかりません: {BUILD_DECK_JS}", prefix="[run-qa] ⚠")
        return 4, None
    env = os.environ.copy()
    extra_paths = [p for p in [
        env.get("NODE_PATH", ""),
        "/tmp/node_modules",
        str(SKILL_ROOT / "node_modules"),
    ] if p]
    env["NODE_PATH"] = ":".join(extra_paths)
    cmd = ["node", str(BUILD_DECK_JS), "-i", str(plan_path), "-o", str(draft_pptx)]
    result = subprocess.run(cmd, capture_output=quiet, text=True, env=env, check=False)
    if result.returncode != 0:
        log(f"build-deck.js が異常終了 (exit {result.returncode})", prefix="[run-qa] ⚠")
        if quiet and result.stderr:
            log(result.stderr[:500], prefix="     ")
        return result.returncode, None
    log(f"     ✓ draft.pptx: {draft_pptx}", quiet=quiet)

    # --- 2b. pptx-to-images.sh で PNG 化 ---
    log("  2b. PNG 化 (pptx-to-images.sh)", quiet=quiet)
    cmd = ["bash", str(PPTX_TO_IMAGES_SH), str(draft_pptx), str(preview_dir)]
    result = run_cmd(cmd, quiet=quiet, check=False)
    if result.returncode != 0:
        log(f"pptx-to-images.sh が異常終了 (exit {result.returncode})", prefix="[run-qa] ⚠")
        return result.returncode, None
    png_count = len(list(preview_dir.glob("slide-*.png")))
    log(f"     ✓ PNG: {png_count} 枚 in {preview_dir}", quiet=quiet)
    return 0, preview_dir


def run_phase2(plan_path: Path, *, strict: bool, bypass: bool, apply_manual: bool, quiet: bool, skip_pptx: bool = False) -> int:
    """
    Phase 2 を 4 ステップに拡張（PPTX→PNG を統合）

    1. 機械検証 (M? / SchemaQA / SecQA-Auto / RefQA-Auto) + plan.html 仮生成
    2. draft.pptx 自動ビルド (build-deck.js) + PNG 化 (pptx-to-images.sh)
    3. plan.html を 実プレビュー画像 埋め込みで再生成
    4. 手動 QA セルフレポート (SecQA-Manual + RefQA-Manual)

    --skip-pptx で 2,3 をスキップして旧 v6.47 挙動 (実画像なし) に戻せる安全弁。
    """
    if not plan_path.exists():
        log(f"plan.json が見つかりません: {plan_path}", prefix="[run-qa] ❌")
        return 4

    deck_dir = plan_path.parent
    plan_html = deck_dir / "plan.html"

    total_steps = 2 if skip_pptx else 4

    # --- v11.1 Step 0a: braindump.md の BSQA + writing-qa を Phase 1.8 ゲートとして実行 ---
    braindump_md = deck_dir / "braindump.md"
    if braindump_md.is_file():
        log("Step 0a: Phase 1.8 braindump.md ゲート (BSQA + writing-qa / v11.1)", quiet=quiet)

        # 0a-1: linkify (idempotent なので毎回走らせて OK)
        if LINKIFY_PY.is_file():
            cmd = [sys.executable, str(LINKIFY_PY), "-i", str(braindump_md)]
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode == 0:
                log(f"  ✓ braindump-linkify: {result.stdout.strip()}", quiet=quiet)
            else:
                log(f"  ⚠ braindump-linkify 異常終了 (exit {result.returncode})", quiet=quiet)

        # 0a-2: BSQA-01〜12 構造検査
        if BSQA_PY.is_file():
            cmd = [sys.executable, str(BSQA_PY), "-i", str(braindump_md)]
            if strict:
                cmd.append("--strict")
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode == 2:
                log("  🚨 BSQA fatal 検出。Phase 2 提出をブロックします", prefix="[run-qa]")
                print(result.stdout)
                _record_phase_completion(plan_path, "phase2", 2, quiet=quiet)
                return 2
            elif result.returncode != 0:
                log(f"  ⚠ braindump-structure-qa 異常終了 (exit {result.returncode})", quiet=quiet)
            else:
                log("  ✓ BSQA-01〜12: 違反なし", quiet=quiet)

        # 0a-3: writing-qa --mode braindump (散文系)
        if WRITING_QA_PY.is_file():
            cmd = [sys.executable, str(WRITING_QA_PY),
                   "--input", str(braindump_md), "--mode", "braindump"]
            if strict:
                cmd.append("--strict")
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode == 2:
                log("  🚨 writing-qa --mode braindump fatal 検出。Phase 2 提出をブロックします", prefix="[run-qa]")
                print(result.stdout)
                _record_phase_completion(plan_path, "phase2", 2, quiet=quiet)
                return 2
            elif result.returncode != 0:
                log(f"  ⚠ writing-qa 異常終了 (exit {result.returncode})", quiet=quiet)
            else:
                log("  ✓ writing-qa --mode braindump: 違反なし", quiet=quiet)
    else:
        log(f"  ℹ braindump.md が無い (opt-out 案件?) — Step 0a スキップ", quiet=quiet)

    # --- Step 0b: パワポでき太郎の専門レビューを plan.json に書き込む ---
    # title-subcopy QA。fatal にせず warn 扱いで人間判断を残す。
    if DEKITARO_JS.is_file():
        log("Step 0b: パワポでき太郎レビュー (title-subcopy QA / v9.5)", quiet=quiet)
        cmd = ["node", str(DEKITARO_JS), "-i", str(plan_path), "--quiet"]
        result = subprocess.run(cmd, capture_output=False, text=True, check=False)
        if result.returncode != 0:
            log(f"でき太郎レビューが異常終了 (exit {result.returncode}) — レビュー無しで続行します", prefix="[run-qa] ⚠")
        else:
            log("  ✓ reviews[review_type=title-subcopy-qa] 更新", quiet=quiet)
    else:
        log(f"でき太郎 CLI が見つかりません ({DEKITARO_JS}) — スキップ", prefix="[run-qa] ⚠", quiet=quiet)

    # --- Step 1: 機械検証 + plan.html 仮生成 ---
    log(f"Step 1/{total_steps}: 機械検証 (M? + SchemaQA + SecQA-Auto + RefQA-Auto)", quiet=quiet)
    cmd = [sys.executable, str(RENDER_PY),
           "--input", str(plan_path),
           "--output", str(plan_html)]
    if strict:
        cmd.append("--strict")
    if bypass:
        cmd.append("--strict-refqa")
    result = run_cmd(cmd, quiet=quiet, check=False)
    if result.returncode == 2:
        log("機械検証で fatal 違反検出。Phase 2 提出をブロックします", prefix="[run-qa] 🚨")
        log(f"  詳細は qa_report.json の layers を確認、または上の stderr を見てください")
        _record_phase_completion(plan_path, "phase2", 2, quiet=quiet)
        return 2
    if result.returncode != 0:
        log(f"render-deck-instruction.py が異常終了 (exit {result.returncode})", prefix="[run-qa] ❌")
        return 4
    log(f"  ✓ plan.html 仮生成 (実プレビューなし): {plan_html}", quiet=quiet)

    preview_dir = None
    # --- Step 2/3: PPTX ビルド + PNG 化 + plan.html 再生成 ---
    if not skip_pptx:
        log(f"Step 2/{total_steps}: draft.pptx → preview/slide-NN.png 一気通貫ビルド", quiet=quiet)
        rc, pdir = _build_and_preview_pptx(plan_path, deck_dir, quiet=quiet)
        if rc == 0 and pdir is not None:
            preview_dir = pdir
            log(f"Step 3/{total_steps}: plan.html を実プレビュー画像つきで再描画", quiet=quiet)
            cmd = [sys.executable, str(RENDER_PY),
                   "--input", str(plan_path),
                   "--output", str(plan_html),
                   "--preview-dir", str(preview_dir)]
            if strict:
                cmd.append("--strict")
            if bypass:
                cmd.append("--strict-refqa")
            result = run_cmd(cmd, quiet=quiet, check=False)
            if result.returncode != 0:
                log("plan.html 再生成に失敗（仮生成版で続行します）", prefix="[run-qa] ⚠")
            else:
                log(f"  ✓ plan.html 実プレビュー埋め込み完了: {plan_html}", quiet=quiet)
        else:
            log("PPTX→PNG ビルドに失敗。plan.html は実プレビューなしのまま続行", prefix="[run-qa] ⚠")
            log("  原因の多くは pptxgenjs / libreoffice / imagemagick の未インストール", quiet=quiet)
            log("  修正後に `run-qa.py phase2 --plan ...` を再実行してください", quiet=quiet)

    # --- 最終 Step: 手動 QA セルフレポート ---
    final_step = 2 if skip_pptx else 4
    log(f"Step {final_step}/{total_steps}: 手動 QA (SecQA-Manual + RefQA-Manual)", quiet=quiet)
    if apply_manual:
        cmd = [sys.executable, str(MANUAL_QA_PY), "phase2",
               "--plan", str(plan_path), "--apply"]
        result = run_cmd(cmd, quiet=quiet, check=False)
        if result.returncode != 0:
            log("手動 QA の反映に失敗。雛形が未記入の可能性があります", prefix="[run-qa] ⚠")
            return 3
        log("  手動 QA 反映後の plan.html 再生成", quiet=quiet)
        cmd = [sys.executable, str(RENDER_PY),
               "--input", str(plan_path),
               "--output", str(plan_html)]
        if preview_dir:
            cmd += ["--preview-dir", str(preview_dir)]
        if strict:
            cmd.append("--strict")
        if bypass:
            cmd.append("--strict-refqa")
        run_cmd(cmd, quiet=quiet, check=False)
        log("  ✓ 手動 QA 反映 + plan.html 再生成完了", quiet=quiet)
        _record_phase_completion(plan_path, "phase2", 0, quiet=quiet)
        return 0

    is_filled, report_path = manual_qa_filled(plan_path, "phase2")
    if not report_path.exists():
        cmd = [sys.executable, str(MANUAL_QA_PY), "phase2", "--plan", str(plan_path)]
        run_cmd(cmd, quiet=quiet, check=False)
        log(f"  📝 手動 QA 雛形を書き出しました: {report_path}", prefix="[run-qa] ⚠")
        log(f"     14 ルールを編集して `python3 scripts/run-qa.py phase2 --plan {plan_path.name} --apply-manual` を再実行してください")
        _record_phase_completion(plan_path, "phase2", 3, quiet=quiet)
        return 3
    if not is_filled:
        log(f"  ⚠ 手動 QA セルフレポートが未記入です: {report_path}", prefix="[run-qa] ⚠")
        log(f"     status と note を埋めてから --apply-manual で再実行してください")
        _record_phase_completion(plan_path, "phase2", 3, quiet=quiet)
        return 3
    log(f"  ✓ 手動 QA セルフレポートは埋まっています ({report_path.name})。--apply-manual で qa_report.json に反映できます", quiet=quiet)
    _record_phase_completion(plan_path, "phase2", 0, quiet=quiet)
    return 0


# ───── Phase 4 オーケストレーション ──────────────────
def run_phase4(plan_path: Path, *, apply_manual: bool, quiet: bool) -> int:
    """
    1. pptx-to-images.sh で draft.pptx を PNG + コンタクトシート化
    2. run-manual-qa.py phase4 で VQA 雛形書き出し or 反映
    """
    if not plan_path.exists():
        log(f"plan.json が見つかりません: {plan_path}", prefix="[run-qa] ❌")
        return 4

    deck_dir = plan_path.parent
    draft_pptx = deck_dir / "draft" / "draft.pptx"
    preview_dir = deck_dir / "preview"

    if not draft_pptx.exists():
        log(f"draft.pptx が見つかりません: {draft_pptx}", prefix="[run-qa] ❌")
        log(f"  Phase 3 (build-deck.js) でビルド済みか確認してください")
        return 4

    # ── Step 1: PNG + コンタクトシート生成 ─────────────
    log("Step 1/2: draft.pptx を PNG + コンタクトシート化", quiet=quiet)
    preview_dir.mkdir(exist_ok=True)
    cmd = ["bash", str(PPTX_TO_IMAGES_SH), str(draft_pptx), str(preview_dir)]
    result = run_cmd(cmd, quiet=quiet, check=False)
    if result.returncode != 0:
        log(f"pptx-to-images.sh が異常終了 (exit {result.returncode})", prefix="[run-qa] ❌")
        return 4
    # コンタクトシートも作る (ImageMagick montage が入っていれば)
    contact_sheet = preview_dir / "contact-sheet.png"
    pngs = sorted(preview_dir.glob("slide-*.png"))
    if pngs and not contact_sheet.exists():
        try:
            tile = "4x" + str((len(pngs) + 3) // 4)
            run_cmd(
                ["montage"] + [str(p) for p in pngs] +
                ["-tile", tile, "-geometry", "480x270+8+8",
                 "-background", "white", "-border", "2", "-bordercolor", "#999",
                 str(contact_sheet)],
                quiet=quiet, check=False,
            )
        except Exception as e:
            log(f"  contact-sheet 生成スキップ ({e})", quiet=quiet)
    log(f"  ✓ {len(pngs)} 枚の PNG を生成: {preview_dir}", quiet=quiet)

    # ── Step 2: VQA 手動セルフレポート ─────────────
    log("Step 2/2: 手動 VQA-01〜16", quiet=quiet)
    if apply_manual:
        cmd = [sys.executable, str(MANUAL_QA_PY), "phase4",
               "--plan", str(plan_path), "--apply"]
        result = run_cmd(cmd, quiet=quiet, check=False)
        if result.returncode != 0:
            log("VQA セルフレポートの反映に失敗", prefix="[run-qa] ⚠")
            _record_phase_completion(plan_path, "phase4", 3, quiet=quiet)
            return 3
        log("  ✓ VQA 反映完了", quiet=quiet)
        _record_phase_completion(plan_path, "phase4", 0, quiet=quiet)
        return 0

    is_filled, report_path = manual_qa_filled(plan_path, "phase4")
    if not report_path.exists():
        cmd = [sys.executable, str(MANUAL_QA_PY), "phase4", "--plan", str(plan_path)]
        run_cmd(cmd, quiet=quiet, check=False)
        log(f"  📝 VQA 雛形を書き出しました: {report_path}", prefix="[run-qa] ⚠")
        log(f"     12 ルールを編集して `python3 scripts/run-qa.py phase4 --plan {plan_path.name} --apply-manual` を再実行してください")
        _record_phase_completion(plan_path, "phase4", 3, quiet=quiet)
        return 3
    if not is_filled:
        log(f"  ⚠ VQA セルフレポートが未記入: {report_path}", prefix="[run-qa] ⚠")
        log(f"     status と note を埋めてから --apply-manual で再実行")
        _record_phase_completion(plan_path, "phase4", 3, quiet=quiet)
        return 3
    log(f"  ✓ VQA セルフレポートは埋まっています ({report_path.name})", quiet=quiet)
    _record_phase_completion(plan_path, "phase4", 0, quiet=quiet)
    return 0


# ───── main ─────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(
        description="QA オーケストレータ (Phase 2 / Phase 4 を 1 コマンドで実行)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("phase", choices=["phase2", "phase4"],
                    help="どの Phase の QA を実行するか")
    ap.add_argument("--plan", required=True,
                    help="plan.json のパス")
    ap.add_argument("--bypass", action="store_true",
                    help="bypass モード: RefQA-02 を fatal 化 (--strict-refqa 相当)。Phase 2 のみ有効")
    ap.add_argument("--no-strict", dest="strict", action="store_false", default=True,
                    help="機械検証 strict を外す (デバッグ用)")
    ap.add_argument("--apply-manual", action="store_true",
                    help="手動 QA セルフレポートを plan.json に反映する")
    ap.add_argument("--quiet", "-q", action="store_true",
                    help="進行ログを抑制")
    ap.add_argument("--skip-pptx", action="store_true",
                    help="v6.48: Phase 2 内の draft.pptx 自動ビルド + PNG 化をスキップする。"
                         "plan.json を微調整して機械検証だけ素早く回したい時用。"
                         "本番提出前は必ず外して走らせる（実プレビューが埋まらないため）")
    args = ap.parse_args()

    plan_path = Path(args.plan).resolve()

    if args.phase == "phase2":
        rc = run_phase2(
            plan_path,
            strict=args.strict,
            bypass=args.bypass,
            apply_manual=args.apply_manual,
            quiet=args.quiet,
            skip_pptx=args.skip_pptx,
        )
    else:  # phase4
        if args.bypass:
            log("--bypass は phase4 では効果なし (機械検証は phase2 のみ)", prefix="[run-qa] ℹ", quiet=args.quiet)
        rc = run_phase4(
            plan_path,
            apply_manual=args.apply_manual,
            quiet=args.quiet,
        )

    if rc == 0:
        log("✅ QA pass", quiet=args.quiet, prefix="[run-qa] ✓")
    elif rc == 2:
        log("🚨 機械検証 fatal — 修正後に再実行してください", quiet=False, prefix="[run-qa]")
    elif rc == 3:
        log("📝 手動 QA セルフレポートを編集してから再実行してください", quiet=False, prefix="[run-qa]")
    else:
        log(f"❌ 異常終了 (exit {rc})", quiet=False, prefix="[run-qa]")
    return rc


if __name__ == "__main__":
    sys.exit(main())
