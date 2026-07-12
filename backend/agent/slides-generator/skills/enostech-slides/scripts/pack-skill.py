#!/usr/bin/env python3
"""
pack-skill.py
=============
Package the enostech-slides skill folder into a `.skill` file (zip).

This is a thin wrapper around skill-creator's package_skill.py logic with
PROJECT-SPECIFIC EXCLUSIONS for enostech-slides:

  Standard skill-creator exclusions:
    - node_modules/, __pycache__/, *.pyc, .DS_Store, evals/

  enostech-slides additions (matching what v8.9 .skill bundle excluded):
    - _legacy/                                   (legacy template dump, 63 files)
    - showcase-seed.json                         (per-category, build-showcase only)
    - templates/{cat}/{*.js}                     (collapsed into {cat}.js,
                                                  the per-template subfiles still
                                                  exist on disk because the Drive
                                                  sync sandbox cannot delete them,
                                                  but Node's resolution loads the
                                                  flat {cat}.js instead — they are
                                                  dead weight in the bundle)
    - catalog.json, catalog.pptx                 (local-only catalog snapshot)
    - MIGRATION_v8.md                            (one-time migration doc)
    - .user_reference/                           (local working notes)
    - .write_test, scripts/render/.test-write.tmp (sandbox writability probes)
    - package-lock.json                          (npm artifact, deps already in package.json)
    - scripts/render/build-catalog.js, catalog-deck.json, poc-deck.json,
      build-deck.js.test                         (catalog/dev-only entry points)

Usage (back-compat):
    python3 scripts/pack-skill.py [output-dir]

Usage (extended, v9.38+):
    python3 scripts/pack-skill.py --output PATH
    python3 scripts/pack-skill.py --slim --output PATH
    python3 scripts/pack-skill.py --max-files 200 --output PATH

Modes:
    (default)      Full bundle. Standard exclusions only.
    --slim         Drops catalog.pptx, render-orig/, render-v926/, scripts/render-orig/,
                   __pycache__/, *.pyc. Same content footprint as the v10.0-beta_slim
                   convention.
    --max-files N  Aggressive bundle for claude.ai 200-file cap. Keeps:
                     - SKILL.md, VERSION, CHANGELOG*.md, MIGRATION_v*.md, proposals.md
                     - references/**
                     - scripts/render/** (active render dir; legacy render-* trees out)
                     - scripts/*.py
                     - assets/fonts/** (Noto Sans JP), assets/logos/**, assets/icons/**
                     - package.json
                   Drops node_modules/, assets/test-design-files/, assets/decks/,
                   anything matching --slim exclusions, and any catalog* artefact.
                   Picks the closest-to-N file count without exceeding it.

Positional `output-dir` (no flags) keeps the v9.x behaviour: writes
`enostech-slides.skill` into that directory.
"""

import argparse
import fnmatch
import re
import sys
import zipfile
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent  # skills/enostech-slides
SKILL_NAME = SKILL_DIR.name

# ─── exclusion config ────────────────────────────────────────
EXCLUDE_DIR_NAMES = {
    "__pycache__",
    "node_modules",
    "_legacy",
    ".user_reference",
    # v9.5: pack-skill.py --help 等で誤ってできたゴミディレクトリを必ず除外
    "--help",
    "_legacy_trash",
    # どちらもランタイムは参照しない。ローカルの開発履歴用なので bundle には不要。
    "render-orig",
    "render-v926",
}
EXCLUDE_FILE_NAMES = {
    ".DS_Store",
    ".write_test",
    ".test-write.tmp",
    "showcase-seed.json",
    "catalog.json",
    "catalog.pptx",
    "MIGRATION_v8.md",
    "package-lock.json",
    "catalog-deck.json",
    "poc-deck.json",
    "build-deck.js.test",
    "build-catalog.js",
    "_test.tmp",
}
EXCLUDE_GLOBS = {
    "*.pyc",
    #   (Drive 同期 sandbox の inode 制約で bash から削除できないため、
    #    パッケージング時に明示的に弾く)
    "*.bak",
    "*.bak.*",
    "*.bak_*",
    "*.orig",
    # v9.5: 一時ファイル全般 (Drive sandbox で bash 削除できない時の最後の砦)
    # v10.1.1: glob を *.tmp* に拡張 (foo.js.tmp1 / foo.js.tmp2 のような連番付き tmp も拾う)
    "*.tmp",
    "*.tmp.*",
    "*.tmp[0-9]*",
    "*.new",
    "*.bak2",
    # v9.5: pack-skill.py 過去出力 .skill (バンドル内に .skill 入れ子は無意味)
    "*.skill",
}

#   scripts/render/templates/{cat}/{anything}.js
# (excluding the parent flat file scripts/render/templates/{cat}.js).
ORPHAN_TEMPLATE_RE = re.compile(
    r"^scripts/render/templates/[a-z]+/[^/]+\.js$"
)


# ─── slim mode ──────────────────────────────────────
# Layered on top of the default exclusions. Mirrors what
# enostech-slides_v10.0-beta_slim.skill convention dropped.
SLIM_EXTRA_DIR_NAMES = {
    "render-orig",   # already in EXCLUDE_DIR_NAMES, redundant safety
    "render-v926",   # ditto
}
SLIM_EXTRA_REL_PREFIXES = (
    "scripts/render-orig/",
    "scripts/render/render-v926/",
)


# ─── max-files mode ─────────────────────────────────
# Aggressive whitelist for claude.ai's 200-file upload cap.
# Anything not matching one of these prefixes/files is dropped.
MAX_FILES_KEEP_PREFIXES = (
    "references/",
    "scripts/render/",
    "scripts/",                # picks up scripts/*.py at top level
    "assets/fonts/",
    "assets/logos/",
    "assets/icons/",
)
MAX_FILES_KEEP_TOPLEVEL = {
    "SKILL.md",
    "VERSION",
    "package.json",
    "proposals.md",
}
MAX_FILES_KEEP_TOPLEVEL_GLOBS = (
    "CHANGELOG*.md",
    "MIGRATION_v*.md",
)
MAX_FILES_DROP_PREFIXES = (
    "scripts/render/render-v926/",
    "scripts/render-orig/",
    "scripts/render/legacy-",
    "assets/test-design-files/",
    "assets/decks/",
    "assets/screenshots/",
)


def should_exclude(rel_path: Path, *, slim: bool = False, max_files: bool = False) -> tuple[bool, str]:
    """
    Return (exclude, reason). rel_path is relative to SKILL_DIR.
    """
    parts = rel_path.parts
    for part in parts:
        if part in EXCLUDE_DIR_NAMES:
            return True, f"dir-name {part!r}"
    name = rel_path.name
    if name in EXCLUDE_FILE_NAMES:
        return True, f"file-name {name!r}"
    for pat in EXCLUDE_GLOBS:
        if fnmatch.fnmatch(name, pat):
            return True, f"glob {pat!r}"
    if ORPHAN_TEMPLATE_RE.match(rel_path.as_posix()):
        return True, "v8.10 orphan template subfile (see pack-skill.py)"

    rel_posix = rel_path.as_posix()

    if slim or max_files:
        # Both slim and max-files inherit slim's extra exclusions.
        for part in parts:
            if part in SLIM_EXTRA_DIR_NAMES:
                return True, f"slim drop dir {part!r}"
        for prefix in SLIM_EXTRA_REL_PREFIXES:
            if rel_posix.startswith(prefix):
                return True, f"slim drop prefix {prefix!r}"

    if max_files:
        # Drop precedence: explicit drop list wins.
        for prefix in MAX_FILES_DROP_PREFIXES:
            if rel_posix.startswith(prefix):
                return True, f"max-files drop prefix {prefix!r}"

        # Top-level whitelist (file or filename glob)
        if len(parts) == 1:
            if name in MAX_FILES_KEEP_TOPLEVEL:
                return False, ""
            for pat in MAX_FILES_KEEP_TOPLEVEL_GLOBS:
                if fnmatch.fnmatch(name, pat):
                    return False, ""
            return True, "max-files: top-level not whitelisted"

        # Nested whitelist
        for prefix in MAX_FILES_KEEP_PREFIXES:
            if rel_posix.startswith(prefix):
                return False, ""
        return True, "max-files: prefix not whitelisted"

    return False, ""


def _compute_arcname(rel: Path) -> str:
    return (Path(SKILL_NAME) / rel).as_posix()


def _enumerate_candidates(*, slim: bool, max_files: bool) -> list[tuple[Path, Path]]:
    candidates: list[tuple[Path, Path]] = []
    for path in sorted(SKILL_DIR.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(SKILL_DIR)
        exclude, _ = should_exclude(rel, slim=slim, max_files=max_files)
        if not exclude:
            candidates.append((path, rel))
    return candidates


def _check_fonts_present(font_dir: Path) -> None:
    """
    v10.4.0 (2026-05-11) — TTF placeholder 検出 fatal.

    Cowork sandbox の Drive FUSE deadlock や、過去の pack-skill.py --max-files の
    binary フィルタ漏れで、assets/fonts/*.ttf が 0 バイト placeholder のまま
    .skill にバンドルされてしまう事故が 2026-05-11 に発生した。0 バイトフォント
    が混入した skill を install すると、resvg-js が SVG <text> を一切描画せず、
    SECSUMMARY-1 / SECTION-1G / SVG 図解が「shape だけ・テキスト全消失」の
    空白スライドになる致命傷を起こす。

    本ガードは packaging 前に assets/fonts/*.ttf のサイズを確認し、100KB 未満の
    placeholder が混入していたら fatal で停止する。osanai 氏の本体マシンや
    開発環境では本物の Noto Sans JP (Regular 5.4MB / Bold 5.4MB) が assets/fonts/
    に存在しているはずなので、このガードは正常時には何もしない。
    """
    if not font_dir.is_dir():
        return  # フォントディレクトリ自体が無いケースは触らない (テスト等)
    placeholders = []
    for ttf in sorted(font_dir.glob("*.ttf")):
        size = ttf.stat().st_size
        if size < 100 * 1024:  # 100KB 未満は placeholder 確定 (本物は 5MB 程度)
            placeholders.append((ttf, size))
    if placeholders:
        print("\n❌ FATAL (v10.4.0): assets/fonts/*.ttf が placeholder (中身なし) です。\n")
        for ttf, size in placeholders:
            print(f"   - {ttf.relative_to(SKILL_DIR.parent)} : {size:,} bytes (本物は約 5,000,000 bytes)")
        print()
        print("   このまま packaging すると、bundle 内のフォントが 0 バイトのままになり、")
        print("   インストール先で resvg-js が SVG <text> を描画できず、SECSUMMARY-1 等が")
        print("   空白スライドになります (2026-05-11 の事故と同じ症状)。\n")
        print("   対処:")
        print("   1. 本物の Noto Sans JP TTF を以下に配置してから再実行してください:")
        print(f"      - {font_dir}/NotoSansJP-Regular.ttf  (約 5.4MB)")
        print(f"      - {font_dir}/NotoSansJP-Bold.ttf     (約 5.4MB)")
        print("   2. Google Fonts の Noto Sans JP リポジトリ (OFL 1.1) からダウンロード可能です。")
        print("   3. Cowork sandbox 内では Drive FUSE deadlock で TTF 取得不可。")
        print("      osanai 氏本体マシンで pack-skill.py を再実行してください。\n")
        sys.exit(2)


def package_skill(
    output_path: Path,
    *,
    slim: bool = False,
    max_files: int | None = None,
) -> Path:
    """
    Build a single .skill file at `output_path` (parent dirs auto-created).
    """
    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # v10.4.0: TTF placeholder 検出 (今回の事故再発防止)
    _check_fonts_present(SKILL_DIR / "assets" / "fonts")

    use_max = max_files is not None
    candidates = _enumerate_candidates(slim=slim, max_files=use_max)

    if use_max and len(candidates) > max_files:
        # Should not happen with current whitelist, but guard anyway.
        # Keep the whitelist deterministic — drop the deepest references first.
        candidates.sort(key=lambda c: (-len(c[1].parts), c[1].as_posix()))
        candidates = sorted(candidates[: max_files], key=lambda c: c[1].as_posix())

    included = 0
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for path, rel in candidates:
            zipf.write(path, _compute_arcname(rel))
            included += 1

    # Recount excluded for reporting.
    total = sum(1 for p in SKILL_DIR.rglob("*") if p.is_file())
    excluded = total - included

    print(f"wrote: {output_path}")
    print(f"  mode: " + ("max-files" if use_max else ("slim" if slim else "full")))
    if use_max:
        print(f"  cap: {max_files}")
    print(f"  included: {included} files")
    print(f"  excluded: {excluded} files (of {total} on disk)")
    print(f"  size: {output_path.stat().st_size:,} bytes")
    return output_path


def _build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="pack-skill.py",
        description="Package enostech-slides into a .skill bundle.",
    )
    p.add_argument(
        "output_dir_pos",
        nargs="?",
        default=None,
        help="(legacy) directory to write enostech-slides.skill into",
    )
    p.add_argument("--output", "-o", help="explicit output .skill path")
    p.add_argument("--slim", action="store_true", help="drop heavy/legacy artefacts")
    p.add_argument(
        "--max-files",
        type=int,
        default=None,
        help="aggressive whitelist (e.g. 200 for claude.ai upload cap)",
    )
    return p


def _resolve_output(args: argparse.Namespace) -> Path:
    if args.output:
        return Path(args.output)
    if args.output_dir_pos:
        return Path(args.output_dir_pos) / f"{SKILL_NAME}.skill"
    # default: parent of SKILL_DIR (i.e. skills/)
    return SKILL_DIR.parent / f"{SKILL_NAME}.skill"


if __name__ == "__main__":
    args = _build_argparser().parse_args()
    out = _resolve_output(args)
    package_skill(out, slim=args.slim, max_files=args.max_files)
