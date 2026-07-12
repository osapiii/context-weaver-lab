"""画像生成用リファレンス画像の session state 管理."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Literal

from .attachments import _fetch_bytes as _fetch_url_bytes
from .image_creation_mode_scope import get_invoke_image_creation_mode
from .image_reference_scope import get_invoke_image_reference
from .knowledge_context import _fetch_gcs_bytes
from .tool_state import read_tool_state
from .workspace_state_buckets import effective_image_mode_state

logger = logging.getLogger(__name__)

ImageReferenceStatus = Literal["incomplete", "draft", "complete"]
ImageReferenceSource = Literal["knowledge", "clipboard", "upload"]
ImageCreationMode = Literal["scratch", "reference"]

_MAX_REFERENCES = 3


def empty_image_reference_state() -> dict[str, Any]:
    return {
        "status": "incomplete",
        "references": [],
        "min_count": 1,
        "confirmed_at": None,
    }


def _attr(obj: Any, key: str) -> str | None:
    if obj is None:
        return None
    if hasattr(obj, key):
        v = getattr(obj, key)
        return v if isinstance(v, str) else None
    if isinstance(obj, dict):
        v = obj.get(key)
        return v if isinstance(v, str) else None
    return None


def _normalize_reference(item: Any) -> dict[str, str] | None:
    ref_id = _attr(item, "id")
    source = (_attr(item, "source") or "").strip().lower()
    name = (_attr(item, "name") or "reference").strip() or "reference"
    mime_type = (_attr(item, "mime_type") or _attr(item, "mimeType") or "").strip()
    gcs_path = (_attr(item, "gcs_path") or _attr(item, "gcsPath") or "").strip()
    url = (
        _attr(item, "url")
        or _attr(item, "storage_url")
        or _attr(item, "storageUrl")
        or ""
    ).strip()
    knowledge_doc_id = (
        _attr(item, "knowledge_doc_id") or _attr(item, "knowledgeDocId") or ""
    ).strip()

    if source not in ("knowledge", "clipboard", "upload"):
        return None
    if not mime_type.startswith("image/"):
        return None
    if not gcs_path and not url:
        return None

    out: dict[str, str] = {
        "id": ref_id or f"{source}-{name}",
        "source": source,
        "name": name,
        "mime_type": mime_type,
    }
    if gcs_path:
        out["gcs_path"] = gcs_path
    if url:
        out["url"] = url
    if knowledge_doc_id:
        out["knowledge_doc_id"] = knowledge_doc_id
    return out


def normalize_image_reference_state(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return empty_image_reference_state()

    status = (raw.get("status") or "incomplete").strip().lower()
    if status not in ("incomplete", "draft", "complete"):
        status = "incomplete"

    refs: list[dict[str, str]] = []
    raw_refs = raw.get("references")
    if isinstance(raw_refs, list):
        for item in raw_refs[:_MAX_REFERENCES]:
            normalized = _normalize_reference(item)
            if normalized:
                refs.append(normalized)

    confirmed_at = raw.get("confirmed_at")
    if confirmed_at is not None and not isinstance(confirmed_at, str):
        confirmed_at = None

    if status == "complete" and len(refs) < 1:
        status = "draft"
    if len(refs) == 0:
        status = "incomplete"
        confirmed_at = None
    elif status == "complete" and len(refs) >= 1:
        confirmed_at = confirmed_at or None
    elif status == "incomplete" and len(refs) > 0:
        status = "draft"

    return {
        "status": status,
        "references": refs,
        "min_count": 1,
        "confirmed_at": confirmed_at,
    }


def normalize_image_creation_mode(raw: Any) -> ImageCreationMode:
    if isinstance(raw, str):
        value = raw.strip().lower()
        if value in ("scratch", "reference"):
            return value  # type: ignore[return-value]
    return "scratch"


def fe_requests_image_workflow(
    *,
    mode_state: dict[str, Any] | None,
    reference_images: list[Any] | None = None,
) -> bool:
    """FE が画像ワークフロー (作成モード / 参照 / active_mode=image) を送っているか."""
    if reference_images:
        return True
    if not isinstance(mode_state, dict):
        return False
    active = mode_state.get("active_mode")
    if isinstance(active, str) and active.strip().lower() == "image":
        return True
    creation = get_image_creation_mode_from_mode_state(mode_state)
    if creation == "reference":
        return True
    effective = effective_image_mode_state(mode_state=mode_state)
    raw_ref = effective.get("image_reference")
    if isinstance(raw_ref, dict):
        refs = raw_ref.get("references")
        if isinstance(refs, list) and len(refs) > 0:
            return True
    return False


def image_reference_state_for_mode_handoff(
    *,
    mode_state: dict[str, Any] | None,
    merged_on_invoke: dict[str, Any] | None,
) -> dict[str, Any]:
    """convert_mode → image 時に FE 確定済み参照を消さない."""
    creation = get_image_creation_mode_from_mode_state(mode_state)
    if creation == "scratch":
        return empty_image_reference_state()
    if merged_on_invoke and merged_on_invoke.get("references"):
        return normalize_image_reference_state(merged_on_invoke)
    if isinstance(mode_state, dict):
        effective = effective_image_mode_state(mode_state=mode_state)
        raw_ref = effective.get("image_reference")
        if isinstance(raw_ref, dict):
            normalized = normalize_image_reference_state(raw_ref)
            if normalized.get("references"):
                return normalized
    return empty_image_reference_state()


def is_image_mode_selected(
    *,
    mode_state: dict[str, Any] | None = None,
    session_state: dict[str, Any] | None = None,
) -> bool:
    """FE / session が画像の作成方法（scratch|reference）を確定したか."""
    effective = effective_image_mode_state(
        mode_state=mode_state, session_state=session_state
    )
    return effective.get("image_mode_selected") is True


def validate_image_workflow_invoke(
    *,
    mode_state: dict[str, Any] | None,
    reference_images: list[Any] | None = None,
) -> str | None:
    """画像ワークフロー invoke 前検証。エラーコード文字列 or None."""
    if not fe_requests_image_workflow(
        mode_state=mode_state,
        reference_images=reference_images,
    ):
        return None
    try:
        from common.image_studio_workflow import resolve_image_workflow_phase  # type: ignore

        if resolve_image_workflow_phase(mode_state=mode_state) == "retouch":
            return None
    except ImportError:
        pass
    if not is_image_mode_selected(mode_state=mode_state):
        return "IMAGE_MODE_NOT_SELECTED"
    creation = get_image_creation_mode_from_mode_state(mode_state)
    if creation not in ("scratch", "reference"):
        return "IMAGE_CREATION_MODE_NOT_SELECTED"
    if creation == "reference":
        refs = reference_images or []
        if isinstance(mode_state, dict):
            effective = effective_image_mode_state(mode_state=mode_state)
            raw_ref = effective.get("image_reference")
            if isinstance(raw_ref, dict):
                nested = raw_ref.get("references")
                if isinstance(nested, list) and len(nested) > len(refs):
                    refs = nested
        normalized = [
            _normalize_reference(item)
            for item in (refs if isinstance(refs, list) else [])
        ]
        normalized = [r for r in normalized if r]
        ref_state = normalize_image_reference_state(
            {"status": "complete", "references": normalized}
            if normalized
            else empty_image_reference_state()
        )
        if ref_state.get("status") != "complete" or not ref_state.get("references"):
            return "IMAGE_REFERENCE_NOT_CONFIRMED"
    return None


def get_image_creation_mode_from_mode_state(
    mode_state: dict[str, Any] | None,
    *,
    session_state: dict[str, Any] | None = None,
) -> ImageCreationMode | None:
    effective = effective_image_mode_state(
        mode_state=mode_state, session_state=session_state
    )
    raw = effective.get("image_creation_mode")
    if isinstance(raw, str):
        value = raw.strip().lower()
        if value in ("scratch", "reference"):
            return value  # type: ignore[return-value]
    return None


def resolve_image_creation_mode(
    tool_context: Any = None,
    *,
    mode_state: dict[str, Any] | None = None,
) -> ImageCreationMode:
    """scratch = 0から新規 (images.generate), reference = お手本 edit.

    明示的な image_creation_mode のみ信頼する（過去セッションの確定済み参照から
    reference を推測しない — scratch 選択後も誤って edit 必須になるのを防ぐ）.
    """
    scoped = get_invoke_image_creation_mode()
    if scoped in ("scratch", "reference"):
        return scoped

    session_state = read_tool_state(tool_context)
    if session_state:
        explicit_session = get_image_creation_mode_from_mode_state(
            None, session_state=session_state
        )
        if explicit_session:
            return explicit_session

    explicit_ms = get_image_creation_mode_from_mode_state(mode_state)
    if explicit_ms:
        return explicit_ms

    return "scratch"


def get_image_reference_from_state(session_state: dict[str, Any] | None) -> dict[str, Any]:
    if not session_state:
        return empty_image_reference_state()
    effective = effective_image_mode_state(session_state=session_state)
    raw = effective.get("image_reference")
    return normalize_image_reference_state(raw)


def resolve_image_reference_for_tool(tool_context: Any = None) -> dict[str, Any]:
    """generate_image 等が参照する image_reference (contextvar → session state)."""
    scoped = get_invoke_image_reference()
    if scoped:
        normalized = normalize_image_reference_state(scoped)
        if normalized.get("status") == "complete" and normalized.get("references"):
            return normalized

    session_state = read_tool_state(tool_context)
    if session_state:
        direct = get_image_reference_from_state(session_state)
        if direct.get("status") == "complete" and direct.get("references"):
            return direct

    return empty_image_reference_state()


def merge_image_reference_on_invoke(
    *,
    stored: dict[str, Any],
    mode_state: dict[str, Any] | None,
    reference_images: list[Any] | None,
) -> dict[str, Any]:
    """FE の mode_state / reference_images を session image_reference に merge."""
    ms = mode_state if isinstance(mode_state, dict) else {}
    if get_image_creation_mode_from_mode_state(ms) == "scratch":
        return empty_image_reference_state()

    current = get_image_reference_from_state(stored)
    effective = effective_image_mode_state(mode_state=ms)
    fe_patch = effective.get("image_reference")
    fe_state = (
        normalize_image_reference_state(fe_patch)
        if isinstance(fe_patch, dict)
        else None
    )

    refs: list[dict[str, str]] = list(current["references"])
    if reference_images:
        refs = []
        for item in reference_images[:_MAX_REFERENCES]:
            normalized = _normalize_reference(item)
            if normalized:
                refs.append(normalized)
    elif fe_state is not None and fe_state["references"]:
        refs = list(fe_state["references"])

    status: ImageReferenceStatus = current["status"]
    confirmed_at = current.get("confirmed_at")

    if fe_state is not None:
        status = fe_state["status"]
        confirmed_at = fe_state.get("confirmed_at")

    if len(refs) == 0:
        status = "incomplete"
        confirmed_at = None
    elif status == "complete" and len(refs) >= 1:
        pass
    elif status == "incomplete":
        status = "draft"
    elif status == "complete" and len(refs) < 1:
        status = "incomplete"
        confirmed_at = None

    merged = {
        "status": status,
        "references": refs,
        "min_count": 1,
        "confirmed_at": confirmed_at,
    }
    return normalize_image_reference_state(merged)


def confirm_image_reference_state(
    session_state: dict[str, Any] | None,
) -> dict[str, Any]:
    """references を読み status=complete にする."""
    current = get_image_reference_from_state(session_state)
    refs = current["references"]
    if len(refs) < 1:
        return {
            "ok": False,
            "error": "リファレンス画像が 1 枚以上必要です。",
            "image_reference": current,
        }
    now = datetime.now(timezone.utc).isoformat()
    next_state = normalize_image_reference_state(
        {
            **current,
            "status": "complete",
            "confirmed_at": now,
        }
    )
    return {"ok": True, "image_reference": next_state, "confirmed_at": now}


def image_turn_context_summary(
    *,
    creation_mode: ImageCreationMode,
    image_reference: dict[str, Any],
) -> str:
    if creation_mode == "scratch":
        return (
            "作成モード: scratch（0から新規）. "
            "images.generate で自由に生成する. "
            "リファレンス画像は不要。generate_image はフルシーン描写のプロンプトで呼べる。"
        )
    return image_reference_turn_summary(image_reference)


def image_reference_turn_summary(state: dict[str, Any]) -> str:
    st = normalize_image_reference_state(state)
    status = st["status"]
    count = len(st["references"])
    if status == "complete":
        names = ", ".join(
            str(r.get("name", "ref"))
            for r in st.get("references", [])[:3]
            if isinstance(r, dict)
        )
        return (
            f"画像参照: status=complete, {count}枚確定済み ({names})。"
            "generate_image は images.edit — 参照レイアウトを維持し CHANGE のみ差し替えること。"
            "ゼロベースの新規ポスター描写は prompt に書かないこと。"
        )
    if status == "draft":
        return (
            f"画像参照: status=draft, {count}枚登録済み（未確定）。"
            "ユーザーに画面の「参照を確定」を促し、確定前は generate_image を呼ばないこと。"
        )
    return (
        "画像参照: status=incomplete, 参照 0 枚。"
        "リファレンス画像を 1 枚以上追加し「参照を確定」を促すこと。"
        "generate_image は禁止。"
    )


def fetch_reference_image_bytes(ref: dict[str, str]) -> bytes | None:
    gcs_path = ref.get("gcs_path") or ""
    if gcs_path.startswith("gs://"):
        data = _fetch_gcs_bytes(gcs_path)
        if data:
            return data
    url = ref.get("url") or ""
    if url.startswith("http"):
        return _fetch_url_bytes(url)
    return None


def load_reference_images_bytes(
    image_reference: dict[str, Any],
    *,
    max_count: int = _MAX_REFERENCES,
) -> list[tuple[bytes, str]]:
    """(bytes, mime_type) のリスト. 取得失敗は skip."""
    st = normalize_image_reference_state(image_reference)
    out: list[tuple[bytes, str]] = []
    for ref in st["references"][:max_count]:
        data = fetch_reference_image_bytes(ref)
        if not data:
            logger.warning(
                "reference image fetch failed: id=%s source=%s",
                ref.get("id"),
                ref.get("source"),
            )
            continue
        mime = ref.get("mime_type") or "image/png"
        out.append((data, mime))
    return out
