"""
Shared test fixtures: stub google.cloud / requests so main.py imports without
real GCP credentials.
"""

from __future__ import annotations

import importlib
import os
import sys
import types
from unittest.mock import MagicMock

import pytest


@pytest.fixture()
def app_module(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    monkeypatch.setenv("DRIVE_MIRROR_BUCKET", "test-project-drive-mirror")
    monkeypatch.setenv(
        "GEMINI_FILE_SEARCH_SERVICE_URL",
        "https://gemini-test.invalid",
    )

    fake_firestore = types.ModuleType("google.cloud.firestore")

    class _FakeSentinel:
        def __init__(self, n):
            self._n = n

    fake_firestore.SERVER_TIMESTAMP = _FakeSentinel("SERVER_TIMESTAMP")
    fake_firestore.DELETE_FIELD = _FakeSentinel("DELETE_FIELD")
    fake_firestore.Client = MagicMock()

    fake_storage = types.ModuleType("google.cloud.storage")
    fake_storage.Client = MagicMock()

    sys.modules.setdefault("google", types.ModuleType("google"))
    sys.modules.setdefault("google.cloud", types.ModuleType("google.cloud"))
    sys.modules["google.cloud.firestore"] = fake_firestore
    sys.modules["google.cloud.storage"] = fake_storage
    setattr(sys.modules["google.cloud"], "firestore", fake_firestore)
    setattr(sys.modules["google.cloud"], "storage", fake_storage)

    here = os.path.dirname(__file__)
    sys.path.insert(0, os.path.abspath(os.path.join(here, "..")))
    if "main" in sys.modules:
        del sys.modules["main"]
    module = importlib.import_module("main")
    yield module
