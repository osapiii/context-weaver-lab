"""HTTP リトライ用の小さなヘルパー (Gemini / Drive sync 等で共有)."""

from __future__ import annotations

import os
import time
from typing import Callable, TypeVar

import requests

T = TypeVar("T")

# 503 等の一時障害向け。環境変数で上書き可。
DEFAULT_MAX_RETRIES = int(os.getenv("HTTP_RETRY_MAX_ATTEMPTS", "5"))
DEFAULT_INITIAL_BACKOFF_SEC = float(os.getenv("HTTP_RETRY_INITIAL_BACKOFF_SEC", "2"))
DEFAULT_MAX_BACKOFF_SEC = float(os.getenv("HTTP_RETRY_MAX_BACKOFF_SEC", "60"))


def is_retryable_http_status(status_code: int) -> bool:
    return status_code in (408, 429, 500, 502, 503, 504)


def is_retryable_request_exception(exc: BaseException) -> bool:
    if isinstance(exc, requests.exceptions.Timeout):
        return True
    if isinstance(exc, requests.exceptions.ConnectionError):
        return True
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return is_retryable_http_status(exc.response.status_code)
    return False


def execute_with_http_retry(
    operation: Callable[[], T],
    *,
    max_retries: int | None = None,
    initial_backoff_sec: float | None = None,
    max_backoff_sec: float | None = None,
    log: Callable[[str], None] | None = None,
) -> T:
    """
    operation が retryable な HTTP エラーを返す / 投げる場合に指数バックオフで再試行する。
 最後の試行結果または例外をそのまま返す / 投げる。
    """
    attempts = (max_retries if max_retries is not None else DEFAULT_MAX_RETRIES) + 1
    backoff = (
        initial_backoff_sec
        if initial_backoff_sec is not None
        else DEFAULT_INITIAL_BACKOFF_SEC
    )
    cap = max_backoff_sec if max_backoff_sec is not None else DEFAULT_MAX_BACKOFF_SEC
    last_exc: BaseException | None = None

    for attempt in range(attempts):
        try:
            return operation()
        except Exception as exc:
            last_exc = exc
            retryable = is_retryable_request_exception(exc)
            if not retryable and isinstance(exc, requests.Response):
                retryable = is_retryable_http_status(exc.status_code)
            if not retryable or attempt >= attempts - 1:
                raise
            if log:
                log(
                    f"HTTP retry {attempt + 1}/{attempts - 1} after "
                    f"{type(exc).__name__}: {exc}"
                )
            time.sleep(backoff)
            backoff = min(backoff * 2, cap)

    if last_exc:
        raise last_exc
    raise RuntimeError("execute_with_http_retry: unreachable")
