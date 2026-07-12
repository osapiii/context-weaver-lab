"""adk.config — モデル名・パス・QA リトライ上限などの集約.

すべて環境変数で上書き可能。ローカル開発と Cloud Run で同じ設定インター
フェースを使う。
"""
from __future__ import annotations

import os
from pathlib import Path


# ============================================================
# パス
# ============================================================

ADK_DIR = Path(__file__).resolve().parent
# adk/ は agents-sandbox/adk/ に配置されているため、リポジトリルートは
# 祖父ディレクトリ. ENOSTECH_REPO_ROOT 環境変数で上書き可.
REPO_ROOT = Path(os.environ.get("ENOSTECH_REPO_ROOT", str(ADK_DIR.parent.parent)))

# skills/enostech-slides は subprocess 経由で叩く既存資産 (Node + Python).
SKILL_ROOT = Path(
    os.environ.get("ENOSTECH_SKILL_ROOT", str(REPO_ROOT / "skills" / "enostech-slides"))
)
SVG_SKILL_ROOT = Path(
    os.environ.get(
        "ENOSTECH_SVG_SKILL_ROOT",
        str(REPO_ROOT / "skills" / "enostech-svg-diagram"),
    )
)

# 成果物 (decks/{slug}/...) を書き出すディレクトリ.
# Cloud Run では /tmp/decks や GCS マウントを指定する想定.
DECK_OUT_DIR = Path(
    os.environ.get(
        "ENOSTECH_DECK_OUT",
        str(REPO_ROOT / "tests" / "outputs" / "last_run"),
    )
)

PROMPTS_DIR = ADK_DIR / "prompts"


# ============================================================
# モデル選定 (フェーズごとに上書き可能)
# ============================================================
# 2026-05-19 リリースの gemini-3.5-flash に全工程を統一.
# 各 env 変数は引き続き個別に上書き可能.

DEFAULT_MODEL = os.environ.get("ENOSTECH_MODEL", "gemini-3.5-flash")
COORDINATOR_MODEL = os.environ.get("ENOSTECH_COORDINATOR_MODEL", DEFAULT_MODEL)
HEARING_MODEL = os.environ.get("ENOSTECH_HEARING_MODEL", DEFAULT_MODEL)
RESEARCH_MODEL = os.environ.get("ENOSTECH_RESEARCH_MODEL", DEFAULT_MODEL)
# 旧名 alias: phase1_8_braindump.py が `config.BRAINDUMP_MODEL` を参照しているため.
# Task #5 (prompt 書き換え + sub_agent rename) で完全に削除予定.
BRAINDUMP_MODEL = RESEARCH_MODEL
DEEP_RESEARCH_MODEL = os.environ.get("ENOSTECH_DEEP_RESEARCH_MODEL", DEFAULT_MODEL)
SVG_MODEL = os.environ.get("ENOSTECH_SVG_MODEL", DEFAULT_MODEL)
# 図解レンダラ: gemini (= SVG テキスト) | openai (= gpt-image BYOK PNG → SVG ラップ)
SVG_BACKEND = os.environ.get("ENOSTECH_SVG_BACKEND", "openai").strip().lower()
OPENAI_SVG_IMAGE_MODEL = os.environ.get(
    "ENOSTECH_OPENAI_SVG_MODEL",
    os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2"),
).strip()
OPENAI_SVG_IMAGE_SIZE = os.environ.get("ENOSTECH_OPENAI_SVG_SIZE", "1536x1024").strip()
OPENAI_SVG_IMAGE_QUALITY = os.environ.get("ENOSTECH_OPENAI_SVG_QUALITY", "high").strip()


# ============================================================
# プロンプト loader
# ============================================================


def load_prompt(name: str) -> str:
    """adk/prompts/{name}.md を読み込んで返す.

    存在しない場合は空文字 (LlmAgent が instruction なしで動く安全側).
    """
    p = PROMPTS_DIR / f"{name}.md"
    if not p.exists():
        return ""
    return p.read_text(encoding="utf-8")


# ユーザーと直接対話する prompt 名 (この一覧に入っていれば silent mode preamble は付かない).
# coordinator と phase1_hearing だけがユーザーに発話する. それ以外は内部 SubAgent.
_USER_FACING_PROMPTS = {"coordinator", "phase1_hearing"}

# Phase 内部の sub-step が中間ログを user に向けて出すのを防ぐ強制ルール.
# coordinator / phase1_hearing 以外の prompt 冒頭に挿入される.
_SILENT_MODE_PREAMBLE = """\
<!-- AUTO-INJECTED: SILENT MODE for SubAgent step -->

# 🤫 中間報告禁止モード (silent mode)

あなたは Coordinator 配下の **内部 SubAgent / AgentTool** です.
**ユーザーには直接話しかけません**. tool を呼び、結果を 1-2 行で受け止め、
output_key で session.state に成果を保存して、すぐ次の step (または transfer_to_agent)
に進んでください.

**禁止**:
- 「〇〇が完了しました」「次は △△ フェーズへ移行します」など、進捗を長文でユーザーに報告する
- 生成物 (plan の章構成 / スライドの主要内容 / 設計判断の根拠など) を整形してユーザーに見せる
- ユーザーに「進めて良いですか?」と確認する (autonomous モードでは絶対に確認しない)

**OK な最終応答**:
- "ok"
- "research_path=... に保存"
- "svg 生成 N 枚完了 / 失敗 0"
- (tool 結果の path / summary のみ. ユーザー向け説明文は不要)

これは UX 上重要です. 各 sub-step が長い中間報告を出すと、ユーザーは「Agent が止まって
返答を待っている」と誤解します. **最終生成物 (research.html) が出るまでユーザー向け
要約を出さないこと**.

---

# 🗂️ session.state を SoT (Single Source of Truth) として扱う

**重要**: deck_dir / research_path / research_html_path などのファイルパスは tool が
session.state に自動で書く / 自動で読む. **LLM が引数として "覚えておく" 必要は
ありません**.

## tool 引数の渡し方ルール

- **deck_dir / research_path などのパス引数は省略可**.
  - 省略すれば tool が `session.state` から自動で読み出します.
  - 例: `build_research_html_tool()` (引数なし) で OK. tool が state.deck_dir を見て自動解決.
- **絶対に架空のパスを作らない**. 「`output/deck_YYYYMMDD/research.json` あたりだろう」と
  推測して渡してはいけない. **わからなければ引数を省略する**.

## state の正規 key

| state key | 設定する tool | 読む tool |
|-----------|---------------|-----------|
| `deck_id` / `deck_dir` | ensure_deck_dir_tool | ほぼ全 tool |
| `research_path` | save_research_tool | generate_svgs_tool / build_research_html_tool |
| `research_html_path` | build_research_html_tool | Coordinator 最終応答 |

→ ある tool が成功したら、後続の tool は **引数なし** でその成果を引き継げる.

---

"""


def make_instruction_provider(name: str):
    """ADK の instruction に渡せる callable を返す.

    ADK は instruction が str の場合に `{var}` を session.state[var] で置換するが、
    本プロジェクトの prompt は Markdown のコード例で `{...}` を多用するため
    KeyError を誘発しがち. callable で返せば inject_session_state を回避できる.

    内部 SubAgent (= coordinator / phase1_hearing 以外) には自動的に "silent mode"
    preamble を prepend する. これにより各 SubAgent が「次は ... に移行します」等の
    中間報告でユーザーを止めるのを防ぐ.

    Signature は ADK の ReadonlyContext 1 引数を受け取る形.
    """
    text = load_prompt(name)
    if name not in _USER_FACING_PROMPTS:
        text = _SILENT_MODE_PREAMBLE + text

    def _provider(_ctx) -> str:
        return text

    _provider.__name__ = f"instruction_{name}"
    return _provider
