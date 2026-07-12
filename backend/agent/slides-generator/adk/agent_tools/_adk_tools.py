"""ADK SubAgent から呼ばれる tool 専用の wrapper.

ADK は Python 関数を自動 schema 化して Gemini に渡すが、`dict` 引数を持つ関数は
`additional_properties: true` を schema に出すため Gemini API が 400 INVALID_ARGUMENT
で拒否する.

そこで、SubAgent には **primitive 引数 (str / int / bool / List[str]) のみ** を
持つラッパー関数を渡す. 各ラッパーは内部で agent_tools の本体関数に dict を
復元してから処理する.

ファイル系 tool (write_plan_json, render_pptx, build_narration, build_deck_package,
pptx_to_images, build_contact_sheet) は `tool_context` を受け取り、生成した
ファイルを **ADK Artifact Service に登録** する. これで `adk web` の Artifacts
タブで PPTX / HTML / ナレーション / PNG / contact sheet を直接プレビューできる.

戻り値は dict (JSON シリアライズ可能).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import List, Optional

from .. import config
from . import storage as _storage
from .research_state_sync import (
    is_research_state_key,
    read_research_state_key,
    sync_research_progress_bucket,
    write_research_state_key,
)


# ============================================================
# Artifact 登録ヘルパ
# ============================================================

_MIME_BY_SUFFIX = {
    ".pptx": (
        "application/vnd.openxmlformats-officedocument."
        "presentationml.presentation"
    ),
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".md": "text/markdown",
    ".json": "application/json",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
}


def _mime_for(p: Path) -> str:
    return _MIME_BY_SUFFIX.get(p.suffix.lower(), "application/octet-stream")


async def _save_file_as_artifact(
    tool_context, file_path: str | Path, *, artifact_name: Optional[str] = None
) -> Optional[str]:
    """指定ファイルを ADK Artifact として保存し、artifact_name を返す.

    `tool_context` が None / save_artifact 未対応の場合は何もせず None を返す.
    artifact_name 省略時は `{deck_id}__{filename}` 形式で flatten する.
    deck_id は parent dir 名から推定. parent 不明なら filename だけ.
    """
    if tool_context is None:
        return None
    p = Path(file_path)
    if not p.exists():
        return None

    try:
        from google.genai import types as gtypes  # type: ignore
    except ImportError:
        return None

    if artifact_name is None:
        deck_id = p.parent.name
        artifact_name = f"{deck_id}__{p.name}" if deck_id else p.name

    part = gtypes.Part(
        inline_data=gtypes.Blob(mime_type=_mime_for(p), data=p.read_bytes())
    )
    meta = {"kind": _artifact_kind_for_name(artifact_name), "title": p.name}
    try:
        await tool_context.save_artifact(
            filename=artifact_name,
            artifact=part,
            custom_metadata=meta,
        )
        return artifact_name
    except Exception as e:
        print(f"[adk_tools] save_artifact failed for {artifact_name}: {e}", file=sys.stderr)
        return None


def _artifact_kind_for_name(artifact_name: str) -> str:
    suffix = Path(artifact_name.split("__")[-1]).suffix.lower()
    return {
        ".pptx": "pptx",
        ".json": "plan_json",
        ".md": "narration",
        ".html": "html",
        ".zip": "package",
        ".png": "image",
        ".svg": "image",
        ".csv": "csv_document",
    }.get(suffix, "other")


# ============================================================
# job_log utility — App でターミナル風 UI に表示する詳細実行ログ
# ============================================================
#
# state.job_log は **flat な timestamped log の配列**. 各 entry は:
#   {
#     "ts": "HH:MM:SS.fff",      # localtime ミリ秒まで
#     "ts_unix": 1234567890.567,
#     "level": "info"|"warn"|"error"|"debug",
#     "tag": "phase3_build" 等 (省略可),
#     "message": "human-readable 1 行ログ",
#     "extra": {...任意フィールド},
#   }
# App 側はこれをそのまま白文字緑文字赤文字で stream 表示する想定.
# state.progress とは別物 (progress は構造化ステップ進捗, job_log は詳細実行ログ).

_JOB_LOG_MAX = 2000  # state 肥大化防止. 古い 2000 件を超えたら先頭から削る.

# validate_research_invoke (research_workflow.py) と一致させる
_VALID_RESEARCH_CURRENT_PHASES = frozenset(
    {
        "plan_review",
        "phase1_hearing",
        "phase1_8_research",
        "phase2_svg",
        "phase3_html",
    }
)


def _log_job(
    tool_context,
    message: str,
    *,
    level: str = "info",
    tag: str = "",
    **extra,
) -> None:
    """state.job_log に 1 行ログを append. App UI でターミナル風表示用.

    Args:
        tool_context: ADK tool_context (None でも no-op).
        message: 1 行ログ本文.
        level: "info" / "warn" / "error" / "debug".
        tag: 区分タグ ("phase3_build" / "svg_pass.s5" 等). 省略可.
        **extra: 追加フィールド (model, artifact, duration_ms 等任意).
    """
    import time as _time
    now = _time.time()
    ms = int((now - int(now)) * 1000)
    ts_str = _time.strftime("%H:%M:%S", _time.localtime(now)) + f".{ms:03d}"
    entry: dict = {
        "ts": ts_str,
        "ts_unix": now,
        "level": level,
        "message": message,
    }
    if tag:
        entry["tag"] = tag
    if extra:
        entry["extra"] = extra
    if tool_context is None:
        return
    try:
        state = tool_context.state
        log = list(state.get("job_log") or [])
        log.append(entry)
        if len(log) > _JOB_LOG_MAX:
            log = log[-_JOB_LOG_MAX:]
        state["job_log"] = log
        sync_research_progress_bucket(state)
    except Exception:
        pass


def _push_progress(
    tool_context,
    phase: str,
    step: str,
    status: str,
    note: str = "",
    *,
    artifact: Optional[str] = None,
    error: Optional[str] = None,
    model: Optional[str] = None,
    percent: Optional[float] = None,
    extra: Optional[dict] = None,
) -> dict:
    """進捗イベントを `state.progress` / `state.progress_history` に push する.

    **App 統合のための SoT**: 全 tool はここを通して進捗を書き、App UI は
    `/run_sse` の state_delta か `GET /sessions/<sid>` で state を購読する.
    内部で `_log_job` も自動的に呼び出すので、job_log にも同じ event が記録される.

    schema (詳細は docs/STATE_SCHEMA.md):
        {
          "phase": "phase3_build",           # 大分類
          "step": "svg_pass.s5",              # ステップ (granular OK, ドット区切り)
          "status": "running"|"done"|"failed"|"skipped"|"warn",
          "note": "human-readable detail",
          "ts": "16:50:18",                   # HH:MM:SS
          "ts_unix": 1234567890.5,            # epoch seconds (sort 用)
          "duration_ms": 1234,                # 直前 running event 以来の経過 (status=done/failed/warn 時)
          "artifact": "svg/s5.svg",           # 生成された artifact (任意)
          "error": "...",                     # status=failed 時のエラー要約 (任意)
          "model": "gemini-3.5-flash",        # LLM 呼び出し時のモデル名 (任意)
          "percent": 0.65,                    # phase-level 進捗 0..1 (任意)
        }

    また `state.current_phase` / `state.phase_status[phase]` も同時更新する.
    """
    import time as _time
    now = _time.time()
    entry: dict = {
        "phase": phase,
        "step": step,
        "status": status,
        "note": note,
        "ts": _time.strftime("%H:%M:%S", _time.localtime(now)),
        "ts_unix": now,
    }
    if artifact is not None:
        entry["artifact"] = artifact
    if error is not None:
        entry["error"] = error[:500]  # 長すぎる stack trace は切り詰める
    if model is not None:
        entry["model"] = model
    if percent is not None:
        entry["percent"] = max(0.0, min(1.0, float(percent)))
    if extra:
        for k, v in extra.items():
            if k not in entry:
                entry[k] = v

    if tool_context is None:
        return entry
    try:
        state = tool_context.state
        history = list(state.get("progress_history") or [])

        # duration_ms: 直前の同じ (phase, step) の running event からの経過
        if status in ("done", "failed", "warn", "skipped"):
            for prev in reversed(history):
                if (
                    prev.get("phase") == phase
                    and prev.get("step") == step
                    and prev.get("status") == "running"
                    and "ts_unix" in prev
                ):
                    entry["duration_ms"] = int((now - prev["ts_unix"]) * 1000)
                    break

        history.append(entry)
        # 履歴が無制限に伸びると state が肥大化するので最後 200 件にキャップ
        if len(history) > 200:
            history = history[-200:]
        state["progress_history"] = history
        state["progress"] = entry

        # phase-level summary (dashboard 用) — 未知 phase はログのみ (invoke 400 防止)
        if phase in _VALID_RESEARCH_CURRENT_PHASES:
            state["current_phase"] = phase
        phase_status = dict(state.get("phase_status") or {})
        # 末端 status (done/failed/skipped/warn) は phase status を上書き
        # running は「進行中」の意味で記録
        phase_status[phase] = status
        state["phase_status"] = phase_status
        sync_research_progress_bucket(state)
    except Exception:
        pass

    # job_log にも 1 行 emit (App UI のターミナル風表示用)
    log_level = {
        "running": "info",
        "done": "info",
        "warn": "warn",
        "failed": "error",
        "skipped": "debug",
    }.get(status, "info")
    log_extra: dict = {}
    if model:
        log_extra["model"] = model
    if artifact:
        log_extra["artifact"] = artifact
    if error:
        log_extra["error"] = error
    if percent is not None:
        log_extra["percent"] = entry.get("percent")
    if "duration_ms" in entry:
        log_extra["duration_ms"] = entry["duration_ms"]
    _log_job(
        tool_context,
        f"[{status:>7s}] {step} — {note}" if note else f"[{status:>7s}] {step}",
        level=log_level,
        tag=phase,
        **log_extra,
    )

    return entry



def update_progress_tool(
    phase: str,
    step: str,
    status: str = "running",
    note: str = "",
    artifact: str = "",
    error: str = "",
    percent: float = -1.0,
    tool_context=None,
) -> dict:
    """進捗を session.state.progress / progress_history に書き込む.

    App UI / ADK web の State タブが購読する SoT. Long-running step の前後で
    叩くと "stuck" に見える時間を減らせる. 内部実装は `_push_progress` に委譲.

    Args:
        phase: "phase2_design" / "phase3_build" 等の大区分.
        step: "validate_structure" / "svg_pass.s5" 等の小区分 (ドット区切りで granular).
        status: "running" / "done" / "failed" / "skipped" / "warn".
        note: 1 行コメント (e.g. "fatal 6 件検出").
        artifact: 生成した artifact (file path / name).
        error: status=failed 時のエラー要約.
        percent: phase-level 進捗 0..1 (省略時は記録しない).
    """
    return _push_progress(
        tool_context, phase, step, status, note,
        artifact=(artifact or None),
        error=(error or None),
        percent=(percent if percent >= 0 else None),
    )


async def _save_dir_as_artifacts(
    tool_context, dir_path: str | Path, *, pattern: str = "*", prefix: str = ""
) -> list[str]:
    """ディレクトリ配下のファイル群を一括 Artifact 登録. 登録名は `{deck_id}__{prefix}{filename}` 形式."""
    if tool_context is None:
        return []
    d = Path(dir_path)
    if not d.exists():
        return []
    saved: list[str] = []
    deck_id = d.parent.name
    for f in sorted(d.glob(pattern)):
        if not f.is_file():
            continue
        artifact_name = f"{deck_id}__{prefix}{f.name}" if deck_id else f"{prefix}{f.name}"
        name = await _save_file_as_artifact(tool_context, f, artifact_name=artifact_name)
        if name:
            saved.append(name)
    return saved


# ============================================================
# storage
# ============================================================


def ensure_deck_dir(
    deck_id: str,
    theme: str = "",
    intent: str = "",
    target_slides: int = 0,
    deck_structure: str = "",
    tool_context=None,
) -> dict:
    """decks/<deck_id>/ を確保 + ヒアリング結果を session.state に永続化する.

    **重要**: 結果を `tool_context.state` に保存する. 以降の Phase 2-4 tool は
    state から自動で deck_dir / theme / intent / target_slides を解決できる
    (LLM が引数を忘れて hallucinate するのを防ぐ).

    Args:
        deck_id: 一意 ID (`YYYY-MM-DD_8hex` 形式).
        theme: デッキのテーマ (ヒアリングで確定).
        intent: 目的 (Before → After).
        target_slides: 目標スライド数.
        deck_structure: "learning-deck" / "proposal-deck" / "case-study-deck" 等.

    state に書き込まれる key: deck_id, deck_dir, theme, intent, target_slides, deck_structure.
    """
    res = _storage.ensure_deck_dir(deck_id)
    # deck_structure は強制 learning-deck (config.ENFORCE_LEARNING_DECK_ONLY)
    if getattr(config, "ENFORCE_LEARNING_DECK_ONLY", False):
        deck_structure = "learning-deck"
    if tool_context is not None:
        try:
            state = tool_context.state
            write_research_state_key(state, "deck_id", res.get("deck_id"))
            write_research_state_key(state, "deck_dir", res.get("deck_dir"))
            if theme:
                write_research_state_key(state, "theme", theme)
            if intent:
                write_research_state_key(state, "intent", intent)
            if target_slides and target_slides > 0:
                write_research_state_key(state, "target_slides", int(target_slides))
            write_research_state_key(
                state, "deck_structure", deck_structure or "learning-deck"
            )
        except Exception:
            pass
    _push_progress(
        tool_context,
        "phase1_hearing",
        "deck_dir",
        "done",
        f"deck_dir 確保完了: {res.get('deck_dir')}",
        extra={"deck_id": res.get("deck_id"), "deck_dir": res.get("deck_dir")},
    )
    _log_job(
        tool_context,
        f"deck_dir 確保完了: {res.get('deck_dir')} (theme={theme!r}, structure=learning-deck)",
        level="info", tag="phase1_hearing",
        deck_id=res.get("deck_id"), deck_dir=res.get("deck_dir"),
    )
    return res


# ============================================================
# State = SoT helper. すべての tool は session.state を最優先で参照する.
# LLM が引数を hallucinate / 忘れる事故を構造的に防ぐ.
# ============================================================
#
# state の正規 key 一覧 (どの tool が読み書きするか):
#   deck_id           — ensure_deck_dir_tool が確定
#   deck_dir          — ensure_deck_dir_tool が確定
#   plan_path         — build_plan_tool / repair_plan_tool が更新
#   pptx_path         — render_pptx_tool / render_pptx_strict_tool が更新
#   narration_path    — build_narration_tool が更新
#   preview_dir       — pptx_to_images_tool が更新
#   contact_sheet_path— build_contact_sheet_tool が更新
#   visual_qa_issues  — analyze_visual_qa_tool が JSON 文字列で更新
#   braindump_path    — save_braindump_tool が更新
#   artifacts         — build_deck_package_tool が更新
#
# 設計原則:
#   - tool に渡される *_path / deck_dir は **省略 OK** (default "").
#   - 渡されたパスが実在しなければ自動的に state からフォールバック.
#   - tool が成功したら **必ず state を更新** (後続 tool が読める).


def _state_get(tool_context, key: str, default=None):
    """session.state から安全に読む. tool_context が None / 例外時は default."""
    if tool_context is None:
        return default
    try:
        state = tool_context.state
        if is_research_state_key(key):
            return read_research_state_key(state, key, default)
        v = state.get(key)
        return v if v is not None else default
    except Exception:
        return default


def _state_set(tool_context, key: str, value) -> None:
    """session.state に安全に書く. tool_context が None / 例外時は no-op."""
    if tool_context is None or value is None:
        return
    try:
        state = tool_context.state
        if is_research_state_key(key):
            write_research_state_key(state, key, value)
        else:
            state[key] = value
    except Exception:
        pass


def _resolve_deck_dir_for_tool(deck_dir: Optional[str], tool_context) -> str:
    """tool が受け取った deck_dir を「実在するパス」に変換する.

    優先順位:
      1. 渡された deck_dir が絶対 or DECK_OUT_DIR 基準で実在 → そのまま使う
      2. 実在しない (= LLM が hallucinate) → tool_context.state['deck_dir'] にフォールバック
      3. state にも無ければ FileNotFoundError (元の error 文言を保つ)

    AgentTool 経由で Phase agent が呼ばれる時、LLM がしばしば deck_dir を
    架空のパス (例: "output/deck_20250212_173611") として渡してくる. これを
    session.state の正規 deck_dir で救済する.
    """
    from pathlib import Path as _P

    state_deck_dir = _state_get(tool_context, "deck_dir")

    if deck_dir:
        candidate = _storage._resolve_deck_dir(deck_dir)
        if candidate.exists():
            return str(candidate)
    if state_deck_dir:
        candidate = _P(state_deck_dir)
        if candidate.exists():
            return str(candidate)
    # 両方 NG. 渡された deck_dir を返しておくと従来の error 文言が出る.
    return str(_storage._resolve_deck_dir(deck_dir or state_deck_dir or "."))


def _resolve_path_for_tool(
    arg_path: Optional[str], state_key: str, tool_context,
    *, fallback_under_deck_dir: Optional[str] = None,
) -> str:
    """任意 path 引数を「実在するパス」に変換する一般化版.

    優先順位:
      1. arg_path が指定 + 実在 → そのまま
      2. state[state_key] が実在 → それを使う
      3. fallback_under_deck_dir 指定 + state.deck_dir + そのファイル名 が実在 → それ
      4. 全部 NG → arg_path をそのまま返す (元の error 文言を保つ)
    """
    from pathlib import Path as _P
    if arg_path and _P(arg_path).exists():
        return arg_path
    state_path = _state_get(tool_context, state_key)
    if state_path and _P(state_path).exists():
        return state_path
    if fallback_under_deck_dir:
        dd = _state_get(tool_context, "deck_dir")
        if dd:
            cand = _P(dd) / fallback_under_deck_dir
            if cand.exists():
                return str(cand)
    return arg_path or ""


def list_deck_artifacts(deck_dir: str = "", tool_context=None) -> dict:
    """deck_dir 配下の成果物 (plan.json / 資料.pptx / *.md / svg/ 等) を列挙する.

    deck_dir 省略時は state.deck_dir から自動解決.
    """
    deck_dir = _resolve_deck_dir_for_tool(deck_dir, tool_context)
    return _storage.list_deck_artifacts(deck_dir)



# ============================================================
# 2026-05 大胆刷新: research.{json,html} 一級成果物用 tool 群
# ============================================================
#
# パイプライン:
#   phase1_8_research が Gemini structured output で research.json を直接書き、
#   `save_research_tool` で永続化 + Artifact 化.
#   その後、Coordinator が以下 2 つを順に叩く (都度承認モード, App 層が "次へ" 自動送信):
#     1. generate_svgs_tool  → 各 svg_spec → svg_asset を埋める
#     2. build_research_html_tool → research.html (Notion 風読み物) 生成
#
# 旧 Phase 2-4 (plan.json → PPTX → narration → preview → QA) は **全廃**.


async def save_research_tool(
    research_json: str = "",
    deck_dir: str = "",
    tool_context=None,
) -> dict:
    """Gemini structured output で生成された research.json (str) を validate + 永続化.

    Args:
        research_json: LLM が出力した JSON 文字列 (Research schema 準拠).
            省略時は state.phase1_8_research_result を使う.
        deck_dir: 省略時 state.deck_dir.

    Returns:
        ok=True 時: { ok, path, bytes, artifact, sections_count, has_svg_specs }
        ok=False 時: { ok=False, error, validation_errors? }  (validation 失敗の場合)
    """
    from . import research_writer as _research

    deck_dir = _resolve_deck_dir_for_tool(deck_dir, tool_context)
    _push_progress(
        tool_context,
        "phase1_8_research",
        "research_json",
        "running",
        "research.json を検証・保存しています…",
    )
    if not research_json:
        research_json = _state_get(tool_context, "phase1_8_research_result") or ""
    if not research_json:
        _push_progress(
            tool_context,
            "phase1_8_research",
            "research_json",
            "failed",
            "research_json が未指定です",
            error="research_json 未指定 + state.phase1_8_research_result にも無し",
        )
        return {
            "ok": False,
            "error": "research_json 未指定 + state.phase1_8_research_result にも無し",
        }
    # parse + validate
    try:
        research = _research.parse_and_validate(research_json)
    except Exception as e:
        from pydantic import ValidationError

        if isinstance(e, ValidationError):
            _push_progress(
                tool_context,
                "phase1_8_research",
                "research_json",
                "failed",
                "research.json schema 違反",
                error=str(e)[:200],
            )
            return {
                "ok": False,
                "error": "research.json schema 違反. agent に再出力を依頼してください.",
                "validation_errors": _research.format_validation_error(e),
            }
        _push_progress(
            tool_context,
            "phase1_8_research",
            "research_json",
            "failed",
            "research.json parse 失敗",
            error=str(e)[:200],
        )
        return {"ok": False, "error": f"research.json parse 失敗: {e}"}
    # write
    try:
        written = _research.write_research_json(deck_dir, research)
    except Exception as e:
        _push_progress(
            tool_context,
            "phase1_8_research",
            "research_json",
            "failed",
            "research.json 書き込み失敗",
            error=str(e)[:200],
        )
        return {"ok": False, "error": f"research.json 書き込み失敗: {e}"}

    art = await _save_file_as_artifact(tool_context, written["path"])
    if not art:
        _log_job(
            tool_context,
            "research.json の artifact 保存に失敗しました (GCS ingest を確認)",
            level="warn",
            tag="phase1_8_research",
            path=written["path"],
        )
    _state_set(tool_context, "research_path", written["path"])
    has_svg = any(s.svg_spec is not None for s in research.sections)
    _push_progress(
        tool_context,
        "phase1_8_research",
        "research_json",
        "done",
        f"research.json 保存完了 ({len(research.sections)} sections)",
        artifact=art or written["path"],
    )
    return {
        "ok": True,
        "path": written["path"],
        "bytes": written["bytes"],
        "artifact": art,
        "sections_count": len(research.sections),
        "references_count": len(research.references),
        "has_svg_specs": has_svg,
    }


async def generate_svgs_tool(
    deck_dir: str = "",
    tool_context=None,
) -> dict:
    """research.json の svg_spec[] を図解アセット化 → svg_asset[] に書き戻し.

    ENOSTECH_SVG_BACKEND=openai (既定): gpt-image-2 + BYOK OpenAI キー → PNG を SVG ラップ.
    ENOSTECH_SVG_BACKEND=gemini: SVG_MODEL (既定 gemini-3.5-flash) + BYOK Gemini キー.

    post-step: phase1_8 完了後、Coordinator が 1 回叩く. 内部で並列実行 (concurrency=3).
    各図解は deck_dir/svg/{section_id}.svg にも個別ファイルとして書き出し artifact 化する.

    Returns:
        { ok, generated, skipped, errors[], artifacts[], deck_dir }
    """
    from . import svg_generator as _svg_gen

    deck_dir = _resolve_deck_dir_for_tool(deck_dir, tool_context)
    from .. import config as _svg_cfg

    _svg_backend = (_svg_cfg.SVG_BACKEND or "openai").strip().lower()
    _svg_model = (
        _svg_cfg.OPENAI_SVG_IMAGE_MODEL
        if _svg_backend == "openai"
        else _svg_cfg.SVG_MODEL
    )
    _push_progress(
        tool_context,
        "phase2_svg",
        "svg",
        "running",
        f"図解を生成しています… (backend={_svg_backend}, model={_svg_model})",
    )
    try:
        result = await _svg_gen.generate_svgs_for_research(deck_dir)
    except FileNotFoundError as e:
        _push_progress(
            tool_context,
            "phase2_svg",
            "svg",
            "failed",
            "research.json が見つかりません",
            error=str(e),
        )
        return {"ok": False, "error": str(e)}
    except Exception as e:
        _push_progress(
            tool_context,
            "phase2_svg",
            "svg",
            "failed",
            "SVG 生成失敗",
            error=str(e)[:200],
        )
        return {"ok": False, "error": f"SVG 生成失敗: {e}"}

    # 個別 SVG ファイルを書き出して artifact 化
    from . import research_writer as _research

    research = _research.read_research_json(deck_dir)
    svg_dir = _storage._resolve_deck_dir(deck_dir) / "svg"
    svg_dir.mkdir(parents=True, exist_ok=True)
    artifacts: list[str] = []
    for section in research.sections:
        if section.svg_asset is None:
            continue
        svg_path = svg_dir / f"{section.id}.svg"
        svg_path.write_text(section.svg_asset.svg_text, encoding="utf-8")
        name = await _save_file_as_artifact(tool_context, svg_path)
        if name:
            artifacts.append(name)

    # next_action SVG (Optional)
    if (
        research.next_action is not None
        and research.next_action.svg_asset is not None
    ):
        svg_path = svg_dir / "next_action.svg"
        svg_path.write_text(
            research.next_action.svg_asset.svg_text, encoding="utf-8"
        )
        name = await _save_file_as_artifact(tool_context, svg_path)
        if name:
            artifacts.append(name)

    _push_progress(
        tool_context,
        "phase2_svg",
        "svg",
        "done",
        (
            f"図解生成完了 (backend={result.get('backend', _svg_backend)}, "
            f"generated={result['generated']}, skipped={result['skipped']})"
        ),
        extra={"artifacts": len(artifacts), "model": result.get("model", _svg_model)},
    )
    return {
        "ok": True,
        "generated": result["generated"],
        "skipped": result["skipped"],
        "next_action_generated": result.get("next_action_generated", False),
        "errors": result["errors"],
        "artifacts": artifacts,
        "deck_dir": deck_dir,
        "backend": result.get("backend", _svg_backend),
        "model": result.get("model", _svg_model),
    }


async def build_research_html_tool(
    deck_dir: str = "",
    tool_context=None,
) -> dict:
    """research.json から research.html (Notion 風読み物) を 1 ファイルで生成 + artifact 化.

    SVG は inline 埋め込み、CSS も inline で 1 ファイル完結.
    research.json の html_path フィールドも自動更新される.

    Returns:
        { ok, path, bytes, artifact }
    """
    from . import html_builder as _html

    deck_dir = _resolve_deck_dir_for_tool(deck_dir, tool_context)
    _push_progress(
        tool_context,
        "phase3_html",
        "html",
        "running",
        "research.html を組み立てています…",
    )
    try:
        res = _html.build_research_html(deck_dir)
    except FileNotFoundError as e:
        _push_progress(
            tool_context,
            "phase3_html",
            "html",
            "failed",
            "research.json が見つかりません",
            error=str(e),
        )
        return {"ok": False, "error": str(e)}
    except Exception as e:
        _push_progress(
            tool_context,
            "phase3_html",
            "html",
            "failed",
            "HTML 生成失敗",
            error=str(e)[:200],
        )
        return {"ok": False, "error": f"HTML 生成失敗: {e}"}

    art = await _save_file_as_artifact(tool_context, res["path"])
    if not art:
        _log_job(
            tool_context,
            "research.html の artifact 保存に失敗しました (GCS ingest / ADK_ARTIFACT_BUCKET を確認)",
            level="error",
            tag="phase3_html",
            path=res["path"],
        )
    _state_set(tool_context, "research_html_path", res["path"])
    _push_progress(
        tool_context,
        "phase3_html",
        "html",
        "done",
        f"research.html 生成完了 ({res['bytes']} bytes)",
        artifact=art or res["path"],
    )
    return {
        "ok": True,
        "path": res["path"],
        "bytes": res["bytes"],
        "artifact": art,
    }
