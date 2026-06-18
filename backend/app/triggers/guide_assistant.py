"""Callable guide assistant backed by Gemini File Search.

The browser calls this thin BFF instead of opening the heavier ADK guide
session. The File Search store is app-owned so every user gets the same
official EN AIstudio guide corpus.
"""
from __future__ import annotations

from contextlib import nullcontext
import os
import re
from typing import Any

from firebase_admin import initialize_app
from firebase_functions import https_fn
from google import genai
from google.genai import types

try:
    initialize_app()
except ValueError:
    pass

DEFAULT_GUIDE_MODEL_ID = "gemini-2.5-flash-lite"
MAX_PROMPT_LENGTH = 4000
MAX_CONTEXT_LENGTH = 12000


SYSTEM_INSTRUCTION = """\
あなたは EN AIstudio の操作ガイド AI です。

## 役割
- ユーザーが「どこで何をすればよいか」「使い方」「設定方法」を迷わないように案内する。
- 必ず接続された Gemini File Search Store のヘルプ Markdown を根拠として参照する。
- 実行時コンテキストに現在の画面やナビ情報がある場合は、検索結果とあわせて最適な導線を選ぶ。

## リンク文法
遷移案内は Markdown リンクで次の形式だけを使う。
- ページ遷移: [ラベル](route:routeName)
- モーダル起動: [ラベル](launcher:launcherId)

## 出力
- 最初に結論と該当画面へのリンクを短く出す。
- ユーザーが画面移動すると解決が早い場合は、回答中に最適な遷移リンクを 1 つ含める。
- 画面移動はフロントエンド側でユーザー確認後に実行されるため、勝手に「移動しました」とは書かない。
- 続けて 1〜3 ステップの操作手順を出す。
- 資料にない内容は推測せず、公式ヘルプに記載がないことを明示する。
- 日本語で簡潔に、親しみやすく回答する。
"""

NAVIGATION_LINK_RE = re.compile(
    r"\[([^\]]{1,80})\]\((route|launcher):([A-Za-z0-9_-]+)\)"
)


def _require_auth(req: https_fn.CallableRequest) -> str:
    if not req.auth or not req.auth.uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="ログインが必要です",
        )
    return req.auth.uid


def _api_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="GEMINI_API_KEY is not configured",
        )
    return key


def _store_name() -> str:
    name = os.getenv("EN_AISTUDIO_GUIDE_FILE_SEARCH_STORE_NAME", "").strip()
    if not name:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="EN_AISTUDIO_GUIDE_FILE_SEARCH_STORE_NAME is not configured",
        )
    if not name.startswith("fileSearchStores/"):
        name = f"fileSearchStores/{name}"
    return name


def _model_id() -> str:
    return os.getenv("GUIDE_MODEL_ID", DEFAULT_GUIDE_MODEL_ID).strip() or DEFAULT_GUIDE_MODEL_ID


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, tuple):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if hasattr(value, "to_json_dict"):
        try:
            return _jsonable(value.to_json_dict())
        except Exception:
            pass
    if hasattr(value, "model_dump"):
        try:
            return _jsonable(value.model_dump(exclude_none=True))
        except Exception:
            pass
    if hasattr(value, "__dict__"):
        return {
            str(k): _jsonable(v)
            for k, v in vars(value).items()
            if not str(k).startswith("_")
        }
    return str(value)


def _grounding_metadata(response: Any) -> Any:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return None
    first = candidates[0]
    return _jsonable(getattr(first, "grounding_metadata", None))


def _usage_metadata(response: Any) -> dict[str, Any]:
    usage = getattr(response, "usage_metadata", None)
    jsonable_usage = _jsonable(usage)
    return jsonable_usage if isinstance(jsonable_usage, dict) else {}


def _llmobs_enabled() -> bool:
    return os.getenv("DD_LLMOBS_ENABLED", "").lower() in {"1", "true", "yes"}


def _llmobs_span(model_name: str):
    if not _llmobs_enabled():
        return nullcontext()
    try:
        from ddtrace.llmobs import LLMObs

        return LLMObs.llm(
            model_name=model_name,
            name="ask_en_aistudio_guide.generate_content",
            model_provider="google_gemini",
            ml_app=os.getenv("DD_LLMOBS_ML_APP", "vibe-control"),
        )
    except Exception:
        return nullcontext()


def _llmobs_annotate(
    *,
    prompt: str,
    output: str | None = None,
    response: Any | None = None,
    error: Exception | None = None,
) -> None:
    if not _llmobs_enabled():
        return
    try:
        from ddtrace.llmobs import LLMObs

        usage = _usage_metadata(response) if response is not None else {}
        metrics = {
            "input_tokens": usage.get("prompt_token_count"),
            "output_tokens": usage.get("candidates_token_count"),
            "total_tokens": usage.get("total_token_count"),
        }
        metrics = {key: value for key, value in metrics.items() if value is not None}
        metadata = {
            "operation": "ask_en_aistudio_guide",
            "file_search_store": _store_name(),
        }
        if error is not None:
            metadata["error_type"] = type(error).__name__
            metadata["error_message"] = str(error)[:1000]

        LLMObs.annotate(
            input_data=prompt,
            output_data=output,
            metadata=metadata,
            metrics=metrics or None,
            tags={
                "vibe_control.operation": "ask_en_aistudio_guide",
                "vibe_control.feature": "guide_assistant",
            },
        )
    except Exception:
        return


def _llmobs_flush() -> None:
    if not _llmobs_enabled():
        return
    try:
        from ddtrace.llmobs import LLMObs

        LLMObs.flush()
    except Exception:
        return


def _extract_auto_navigation(text: str) -> dict[str, Any] | None:
    match = NAVIGATION_LINK_RE.search(text or "")
    if not match:
        return None
    label, kind, target = match.groups()
    if kind == "route":
        return {
            "kind": "route",
            "label": label.strip(),
            "routeName": target.strip(),
        }
    return {
        "kind": "launcher",
        "label": label.strip(),
        "launcherKey": target.strip(),
    }


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=90)
def ask_en_aistudio_guide(req: https_fn.CallableRequest) -> dict[str, Any]:
    _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    prompt = str(data.get("prompt") or "").strip()
    guide_context = str(data.get("guideContext") or "").strip()

    if not prompt:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="prompt is required",
        )
    if len(prompt) > MAX_PROMPT_LENGTH:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"prompt must be {MAX_PROMPT_LENGTH} characters or fewer",
        )

    guide_context = guide_context[:MAX_CONTEXT_LENGTH]
    contents = prompt
    if guide_context:
        contents = (
            f"## 実行時コンテキスト\n{guide_context}\n\n"
            f"## ユーザーの質問\n{prompt}"
        )

    model_id = _model_id()
    response = None
    text = ""
    try:
        client = genai.Client(api_key=_api_key())
        with _llmobs_span(model_id):
            try:
                response = client.models.generate_content(
                    model=model_id,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        tools=[
                            types.Tool(
                                file_search=types.FileSearch(
                                    file_search_store_names=[_store_name()]
                                )
                            )
                        ],
                    ),
                )
                text = getattr(response, "text", "") or ""
                _llmobs_annotate(prompt=contents, output=text, response=response)
            except Exception as exc:
                _llmobs_annotate(prompt=contents, error=exc)
                raise
            finally:
                _llmobs_flush()
    except https_fn.HttpsError:
        raise
    except Exception as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Gemini guide request failed: {exc}",
        ) from exc

    return {
        "text": text,
        "groundingMetadata": _grounding_metadata(response),
        "autoNavigation": _extract_auto_navigation(text),
    }
