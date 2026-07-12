"""http_retry ユニットテスト"""

import pytest
import requests

from common.http_retry import is_retryable_http_status, is_retryable_request_exception


def test_retryable_status_codes():
    assert is_retryable_http_status(503) is True
    assert is_retryable_http_status(429) is True
    assert is_retryable_http_status(404) is False


def test_retryable_timeout():
    assert is_retryable_request_exception(requests.exceptions.Timeout()) is True
