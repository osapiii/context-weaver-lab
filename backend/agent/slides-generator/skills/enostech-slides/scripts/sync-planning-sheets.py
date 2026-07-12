#!/usr/bin/env python3
# ==========================================================================
#
#  エディトリアルカレンダー (Google Sheets) の詳細シート群を HTML として
#  一括ダウンロードし、`decks/planning_sheets/{deck_id}.html` に配置する。
#  シート上の最新の設計情報とローカル状態を常に同期するための仕組み。
#
#  使い方:
#      python3 sync-planning-sheets.py                           # 全部同期
#      python3 sync-planning-sheets.py --dry-run                 # 変換予定だけ表示
#      python3 sync-planning-sheets.py --spreadsheet-id <ID>     # 別シート指定
#      python3 sync-planning-sheets.py --project-root <PATH>     # 出力先ベース
#
#  前提:
#      enostech-cowork-google-service skill 同様、以下が export 済み:
#          $GWS = gws CLI バイナリパス
#          $GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE = OAuth2 credentials JSON
#
#  設計メモ:
#      Google Sheets の application/zip エクスポートはファイル名を
#      UTF-8 → CP866 → UTF-8 と二重変換する mojibake を起こす。
#      たとえば `📄 B-02.html` (UTF-8) は zip 内では `ЁЯУД B-02.html` として
#      格納される。このスクリプトは展開後に cp866 → utf-8 で復号して
#      もとのファイル名を回復してからコピーする。
# ==========================================================================

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_SPREADSHEET_ID = "1OgtIS7la6hPdzLlb-KGAmg31xEvAKyFBbk3Gn8StFDE"
DETAIL_PREFIX = "📄 "
RELATIVE_OUTPUT = Path("decks") / "planning_sheets"


def find_project_root(explicit_path: str | None) -> Path:
    """Cowork ワークスペースのプロジェクトルートを特定する。

    優先順:
        1. 明示指定があればそれ
        2. 環境変数 ENOSTECH_PROJECT_ROOT
        3. cwd から親方向に CLAUDE.md があるディレクトリを探す (最大 6 階層)
    """
    if explicit_path:
        p = Path(explicit_path).resolve()
        if (p / "CLAUDE.md").exists():
            return p
        sys.exit(f"指定された --project-root に CLAUDE.md が見つかりません: {p}")

    env_root = os.environ.get("ENOSTECH_PROJECT_ROOT")
    if env_root and (Path(env_root) / "CLAUDE.md").exists():
        return Path(env_root).resolve()

    cur = Path.cwd().resolve()
    for _ in range(6):
        if (cur / "CLAUDE.md").exists():
            return cur
        if cur.parent == cur:
            break
        cur = cur.parent
    sys.exit(
        "プロジェクトルートを自動検出できませんでした。--project-root を渡すか "
        "ENOSTECH_PROJECT_ROOT を export してください。"
    )


def export_zip(spreadsheet_id: str, dest_zip: Path, gws_bin: str | None) -> None:
    """gws drive files export で application/zip エクスポートして dest_zip に保存。"""
    bin_ = gws_bin or os.environ.get("GWS")
    if not bin_:
        sys.exit("gws バイナリパスが見つかりません。$GWS を export するか --gws-bin を渡してください。")

    # gws の --output は cwd 配下のみ受け付けるので、cwd を dest_zip の親に切り替える
    parent = dest_zip.parent
    rel_name = dest_zip.name
    cmd = [
        bin_, "drive", "files", "export",
        "--params", json.dumps({"fileId": spreadsheet_id, "mimeType": "application/zip"}),
        "--output", rel_name,
    ]
    res = subprocess.run(cmd, cwd=str(parent), capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f"gws export 失敗 (exit={res.returncode}):\n{res.stderr or res.stdout}")
    if not dest_zip.exists():
        sys.exit(f"export はエラー無しで終わったが {dest_zip} が見つかりません")


def extract_zip(zip_path: Path, dest_dir: Path) -> None:
    """unzip -UU で raw bytes のまま展開 (CP437 変換させない)。"""
    dest_dir.mkdir(parents=True, exist_ok=True)
    res = subprocess.run(
        ["unzip", "-UU", "-o", "-q", str(zip_path), "-d", str(dest_dir)],
        capture_output=True, text=True,
    )
    if res.returncode != 0:
        sys.exit(f"unzip 失敗:\n{res.stderr or res.stdout}")


def recover_filename(mojibake: str) -> str:
    """二重変換された mojibake を元の UTF-8 名に戻す。

    変換不能 (= もともと ASCII のみで mojibake していない) なら原文を返す。
    """
    try:
        return mojibake.encode("cp866").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return mojibake


def collect_detail_sheets(extract_dir: Path) -> list[tuple[Path, str]]:
    """詳細シート (📄 prefix の HTML) を [(src_path, deck_id), ...] で返す。"""
    items: list[tuple[Path, str]] = []
    for entry in extract_dir.iterdir():
        if not entry.is_file():
            continue
        recovered = recover_filename(entry.name)
        if not recovered.startswith(DETAIL_PREFIX) or not recovered.endswith(".html"):
            continue
        deck_id = recovered[len(DETAIL_PREFIX):-len(".html")].strip()
        if not deck_id:
            continue
        items.append((entry, deck_id))
    return items


def safe_filename(deck_id: str) -> str:
    """deck_id を OS 安全なファイル名にする。

    `B-02`, `FE-08`, `③-01` のような形をそのまま受け入れる
    (FS は UTF-8 を扱えるので ① 等もそのまま)。
    """
    # スラッシュ・コロン等の path-unsafe 文字だけ落とす
    cleaned = deck_id.replace("/", "_").replace(":", "_").replace("\\", "_")
    return f"{cleaned}.html"


def sync(args: argparse.Namespace) -> None:
    project_root = find_project_root(args.project_root)
    output_dir = project_root / RELATIVE_OUTPUT

    with tempfile.TemporaryDirectory(prefix="enostech-sync-") as tmpdir_str:
        tmpdir = Path(tmpdir_str)
        zip_path = tmpdir / "sheets-export.zip"
        extract_dir = tmpdir / "extracted"

        print(f"📥 Exporting spreadsheet {args.spreadsheet_id[:12]}... → {zip_path.name}")
        export_zip(args.spreadsheet_id, zip_path, args.gws_bin)
        size_kb = zip_path.stat().st_size / 1024
        print(f"   {size_kb:.0f} KB downloaded")

        print(f"📂 Extracting...")
        extract_zip(zip_path, extract_dir)

        items = collect_detail_sheets(extract_dir)
        if not items:
            sys.exit("詳細シート (📄 prefix) が 1 件も見つかりませんでした。シート構成を確認してください。")

        print(f"🔍 Detected {len(items)} detail sheets")

        if args.dry_run:
            print(f"\n[DRY-RUN] {output_dir.relative_to(project_root)} に以下を配置予定:")
            for _, deck_id in sorted(items, key=lambda x: x[1]):
                print(f"   - {safe_filename(deck_id)}")
            return

        # destination cleanup: 既存の HTML を一旦消して fresh state にする
        # (sync の意味=local をシートに揃える、なので消えたシートはローカルからも消える)
        output_dir.mkdir(parents=True, exist_ok=True)
        existing_htmls = list(output_dir.glob("*.html"))
        if existing_htmls and not args.no_clean:
            for f in existing_htmls:
                f.unlink()
            print(f"🗑  Cleaned {len(existing_htmls)} stale HTML(s) from {output_dir.relative_to(project_root)}/")

        # コピー
        copied: list[tuple[str, Path]] = []
        for src, deck_id in items:
            dst = output_dir / safe_filename(deck_id)
            shutil.copy2(src, dst)
            copied.append((deck_id, dst))

        # サマリ
        print(f"\n✅ Synced {len(copied)} detail sheets to {output_dir.relative_to(project_root)}/")
        for deck_id, dst in sorted(copied, key=lambda x: x[0]):
            size_kb = dst.stat().st_size / 1024
            print(f"   ✓ {deck_id:10s} ({size_kb:5.1f} KB)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="エディトリアルカレンダーの詳細シート HTML を一括同期する",
    )
    parser.add_argument(
        "--spreadsheet-id", default=DEFAULT_SPREADSHEET_ID,
        help=f"対象スプレッドシート ID (default: {DEFAULT_SPREADSHEET_ID})",
    )
    parser.add_argument(
        "--project-root", default=None,
        help="出力先 (decks/planning_sheets/) のベースディレクトリ。"
             "未指定なら ENOSTECH_PROJECT_ROOT または CLAUDE.md 探索で自動検出",
    )
    parser.add_argument(
        "--gws-bin", default=None,
        help="gws CLI バイナリのパス。未指定なら $GWS 環境変数を使う",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="変更を加えず、配置予定のファイル一覧だけ表示",
    )
    parser.add_argument(
        "--no-clean", action="store_true",
        help="既存 HTML を消さずに上書きのみ実施 (シートから削除されたデッキの古い HTML が残る)",
    )
    args = parser.parse_args()
    sync(args)


if __name__ == "__main__":
    main()
