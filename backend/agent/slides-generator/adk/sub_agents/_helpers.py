"""sub_agents 内の共通ヘルパー (ADK import の遅延 + None fallback)."""
from __future__ import annotations

from typing import Any, Optional


def try_import_adk() -> tuple[Any, Any, Any, Any]:
    """google-adk が import できれば (Agent, SequentialAgent, LoopAgent, AgentTool)
    を返す. import できなければ全部 None.

    google-adk が無い環境 (CI / mock) でも `from adk import root_agent` が
    実行可能であるため、Agent モジュール側はこの helper を介して import する.
    """
    try:
        from google.adk.agents.llm_agent import Agent  # type: ignore
        from google.adk.agents.sequential_agent import SequentialAgent  # type: ignore
        from google.adk.agents.loop_agent import LoopAgent  # type: ignore
        try:
            from google.adk.tools.agent_tool import AgentTool  # type: ignore
        except ImportError:
            AgentTool = None  # type: ignore
        return Agent, SequentialAgent, LoopAgent, AgentTool
    except ImportError:
        return None, None, None, None


def _is_thinking_required_model(model: Optional[str]) -> bool:
    """thinking mode を **必須** とする model か判定する.

    pro-preview 系は thinking_budget=0 を送ると 400 INVALID_ARGUMENT
    ("This model only works in thinking mode") を返す.
    """
    if not model:
        return False
    m = model.lower()
    # 既知の thinking 必須モデル (pro 系の preview).
    return ("pro-preview" in m) or ("pro_preview" in m)


def vertex_search_tools(datastore_path: str | None) -> list[Any]:
    """組織ナレッジ (Agent Search) 用 VertexAiSearchTool. 未設定なら空."""
    if not datastore_path or not str(datastore_path).strip():
        return []
    try:
        from google.adk.tools import VertexAiSearchTool  # type: ignore

        return [
            VertexAiSearchTool(
                data_store_id=str(datastore_path).strip(),
                bypass_multi_tools_limit=True,
            )
        ]
    except ImportError:
        return []


def safe_genai_config(temperature: float = 0.4, model: Optional[str] = None) -> Optional[Any]:
    """thinking 設定を model に合わせて切り替える GenerateContentConfig.

    - **flash 系** (gemini-3.5-flash 等):
      thinking_budget=0 で抑制. MALFORMED_FUNCTION_CALL を防ぎつつ token も節約.
    - **pro-preview 系**:
      thinking 必須なので budget=0 は送らない. config の thinking_config を省略する
      (gemini API の default = 動的 thinking).

    使い方:
        Agent(model="gemini-3.5-flash",
              generate_content_config=safe_genai_config(model="gemini-3.5-flash"))
    """
    try:
        from google.genai import types as gtypes  # type: ignore
    except ImportError:
        return None
    try:
        if _is_thinking_required_model(model):
            # pro-preview: thinking_config を渡さない (デフォルト動的 thinking)
            return gtypes.GenerateContentConfig(temperature=temperature)
        # flash 系: thinking を完全抑制
        return gtypes.GenerateContentConfig(
            thinking_config=gtypes.ThinkingConfig(
                thinking_budget=0,
                include_thoughts=False,
            ),
            temperature=temperature,
        )
    except (TypeError, AttributeError):
        try:
            return gtypes.GenerateContentConfig(temperature=temperature)
        except Exception:
            return None
