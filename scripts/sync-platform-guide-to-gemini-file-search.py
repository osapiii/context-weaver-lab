#!/usr/bin/env python3
"""
Upload repo-owned guide Markdown to GCS and Gemini File Search.

Usage:
  GOOGLE_CLOUD_PROJECT=en-aistudio-development GEMINI_API_KEY=... \\
  python scripts/sync-platform-guide-to-gemini-file-search.py --dry-run

Environment:
  GOOGLE_CLOUD_PROJECT                         default: en-aistudio-development
  PLATFORM_GUIDE_BUCKET                        default: {PROJECT}-platform-guide
  EN_AISTUDIO_GUIDE_FILE_SEARCH_STORE_NAME     optional existing fileSearchStores/...
  EN_AISTUDIO_GUIDE_FILE_SEARCH_DISPLAY_NAME   default: EN AIstudio Platform Guide
"""
from __future__ import annotations

import argparse
import mimetypes
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Iterable

from google import genai
from google.cloud import storage

REPO_ROOT = Path(__file__).resolve().parents[1]
HELP_ROOT = REPO_ROOT / "app" / "content" / "help"
GCS_VERSION = "v1"
PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "en-aistudio-development").strip()
DISPLAY_NAME = os.getenv(
    "EN_AISTUDIO_GUIDE_FILE_SEARCH_DISPLAY_NAME",
    "EN AIstudio Platform Guide",
).strip()


def bucket_name() -> str:
    override = os.getenv("PLATFORM_GUIDE_BUCKET", "").strip()
    return override or f"{PROJECT}-platform-guide"


def normalize_store_name(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    if value.startswith("fileSearchStores/"):
        return value
    return f"fileSearchStores/{value}"


def collect_markdown_sources() -> list[tuple[Path, str]]:
    out: list[tuple[Path, str]] = []
    if not HELP_ROOT.is_dir():
        return out
    for path in sorted(HELP_ROOT.rglob("*.md")):
        rel = path.relative_to(HELP_ROOT).as_posix()
        out.append((path, f"{GCS_VERSION}/help/{rel}"))
    return out


def ensure_bucket(*, dry_run: bool) -> storage.Bucket | None:
    name = bucket_name()
    if dry_run:
        print(f"[dry-run] ensure bucket gs://{name}")
        return None
    try:
        client = storage.Client(project=PROJECT)
        bucket = client.bucket(name)
        if not bucket.exists():
            bucket = client.create_bucket(name, location="US")
            print(f"created bucket: {name}")
        return bucket
    except Exception as exc:
        print(
            f"storage SDK unavailable; falling back to gcloud storage: {exc}",
            file=sys.stderr,
        )
        result = subprocess.run(
            [
                "gcloud",
                "storage",
                "buckets",
                "describe",
                f"gs://{name}",
                "--project",
                PROJECT,
            ],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode != 0:
            subprocess.run(
                [
                    "gcloud",
                    "storage",
                    "buckets",
                    "create",
                    f"gs://{name}",
                    "--project",
                    PROJECT,
                    "--location",
                    "US",
                ],
                check=True,
            )
            print(f"created bucket: {name}")
        return None


def upload_to_gcs(
    bucket: storage.Bucket | None,
    local_path: Path,
    gcs_object: str,
    *,
    dry_run: bool,
) -> None:
    name = bucket_name()
    if dry_run:
        print(f"[dry-run] gs://{name}/{gcs_object} <= {local_path}")
        return
    if bucket is None:
        subprocess.run(
            [
                "gcloud",
                "storage",
                "cp",
                str(local_path),
                f"gs://{name}/{gcs_object}",
                "--content-type",
                mimetypes.guess_type(local_path.name)[0] or "text/markdown",
            ],
            check=True,
        )
        print(f"uploaded gs://{name}/{gcs_object}")
        return
    blob = bucket.blob(gcs_object)
    content_type = mimetypes.guess_type(local_path.name)[0] or "text/markdown"
    blob.upload_from_filename(str(local_path), content_type=content_type)
    print(f"uploaded gs://{name}/{gcs_object}")


def get_or_create_store(client: genai.Client, *, dry_run: bool) -> str:
    configured = normalize_store_name(
        os.getenv("EN_AISTUDIO_GUIDE_FILE_SEARCH_STORE_NAME")
    )
    if configured:
        if dry_run:
            print(f"[dry-run] use existing File Search store: {configured}")
        return configured

    if dry_run:
        print(f"[dry-run] create File Search store displayName={DISPLAY_NAME}")
        return "fileSearchStores/dry-run-en-aistudio-platform-guide"

    store = client.file_search_stores.create(
        config={
            "display_name": DISPLAY_NAME,
            "embedding_model": "models/gemini-embedding-2",
        }
    )
    print(f"created File Search store: {store.name}")
    return store.name


def wait_operation(client: genai.Client, operation) -> None:
    started_at = time.monotonic()
    while not getattr(operation, "done", False):
        time.sleep(5)
        elapsed = int(time.monotonic() - started_at)
        print(f"  waiting for File Search operation... {elapsed}s", flush=True)
        operation = client.operations.get(operation)


def upload_to_file_search(
    client: genai.Client,
    store_name: str,
    sources: Iterable[tuple[Path, str]],
    *,
    dry_run: bool,
    wait: bool,
) -> None:
    for local_path, gcs_object in sources:
        display_name = gcs_object.replace(f"{GCS_VERSION}/help/", "")
        if dry_run:
            print(f"[dry-run] index {local_path} -> {store_name} ({display_name})")
            continue
        print(f"indexing: {display_name}", flush=True)
        operation = client.file_search_stores.upload_to_file_search_store(
            file=str(local_path),
            file_search_store_name=store_name,
            config={
                "display_name": display_name,
                "chunking_config": {
                    "white_space_config": {
                        "max_tokens_per_chunk": 500,
                        "max_overlap_tokens": 60,
                    }
                },
            },
        )
        if wait:
            wait_operation(client, operation)
            print(f"indexed: {display_name}", flush=True)
        else:
            operation_name = getattr(operation, "name", "")
            print(
                f"index requested: {display_name} {operation_name}",
                flush=True,
            )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sync app/content/help Markdown to Gemini File Search"
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--no-wait",
        action="store_true",
        help="start File Search import operations without waiting for each one",
    )
    args = parser.parse_args()

    sources = collect_markdown_sources()
    if not sources:
        print("No markdown files found under app/content/help", file=sys.stderr)
        return 1

    print(f"Project={PROJECT} bucket={bucket_name()} files={len(sources)}")

    bucket = ensure_bucket(dry_run=args.dry_run)
    for local_path, gcs_object in sources:
        upload_to_gcs(bucket, local_path, gcs_object, dry_run=args.dry_run)

    if args.dry_run:
        store_name = get_or_create_store(None, dry_run=True)  # type: ignore[arg-type]
        upload_to_file_search(
            None,
            store_name,
            sources,
            dry_run=True,
            wait=not args.no_wait,
        )  # type: ignore[arg-type]
    else:
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY") or None)
        store_name = get_or_create_store(client, dry_run=False)
        upload_to_file_search(
            client,
            store_name,
            sources,
            dry_run=False,
            wait=not args.no_wait,
        )
    print(f"done. EN_AISTUDIO_GUIDE_FILE_SEARCH_STORE_NAME={store_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
