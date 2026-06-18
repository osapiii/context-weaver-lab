"""取り込み済み知識 (GCS) を LLM 向け動的コンテキスト Part に変換する."""
from __future__ import annotations

import logging
from typing import Any

from google.cloud import storage
from google.genai import types as gtypes

from .attachments import (
    _INLINE_MAX_BYTES,
    _MAX_TEXT_CHARS,
    _is_inline_supported,
    _is_text_supported,
    _truncate,
)

logger = logging.getLogger(__name__)


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


def _parse_gcs_uri(gcs_path: str) -> tuple[str, str] | None:
    if not gcs_path.startswith("gs://"):
        return None
    parts = gcs_path.replace("gs://", "", 1).split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    return parts[0], parts[1]


def _fetch_gcs_bytes(gcs_path: str) -> bytes | None:
    parsed = _parse_gcs_uri(gcs_path)
    if not parsed:
        logger.warning("invalid gcs path: %s", gcs_path)
        return None
    bucket_name, blob_path = parsed
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        blob.reload()
        if blob.size and blob.size > _INLINE_MAX_BYTES:
            logger.warning(
                "gcs object too large: %s (%s bytes)", gcs_path, blob.size
            )
            return None
        return blob.download_as_bytes()
    except Exception as exc:
        logger.warning("gcs fetch failed: path=%s err=%s", gcs_path, exc)
        return None


def _failed_part(name: str, gcs_path: str, reason: str) -> gtypes.Part:
    return gtypes.Part(
        text=(
            f"### {name} (取得失敗)\n"
            f"理由: {reason}. GCS: {gcs_path}\n"
            "Agent Search で代替検索するか、ユーザーに要点を確認してください.\n"
        )
    )


def prepare_agent_search_turn_instruction(
    *,
    datastore_path: str | None,
) -> gtypes.Part | None:
    """Agent Search 利用を促すターン先頭指示 (DE を SSOT とする)."""
    if not datastore_path or not datastore_path.strip():
        return None
    return gtypes.Part(
        text=(
            "## このターンの必須手順 (データ環境 / Agent Search)\n"
            "組織ナレッジの **唯一の正** はデータ環境 (DE) です。"
            "社内資料・Web 取込・Drive 同期など、"
            "DE に登録された資料はすべて Agent Search (Vertex AI Search) に索引されています。\n"
            "回答を書く前に、ユーザーの質問のキーワード・固有名詞で "
            "**必ず Agent Search を実行** してください。\n"
            "検索ヒットを根拠に答え、`add_citation` で出典を付けてください。"
            "検索で見つからない事実は断定せず「DE 上で未確認」と明示してください。\n"
        )
    )


def prepare_research_agent_search_turn_instruction(
    *,
    datastore_path: str | None,
) -> gtypes.Part | None:
    """リサーチ Agent 向け Agent Search 指示 (自社ナレッジ優先 → 打ち手につなげる)."""
    if not datastore_path or not datastore_path.strip():
        return None
    return gtypes.Part(
        text=(
            "## このターンの必須手順 (リサーチ / Agent Search)\n"
            "組織ナレッジの **唯一の正** はデータ環境 (DE) です。"
            "社内報告・Drive 取込資料・Web 取込資料は "
            "Agent Search (Vertex AI Search) に索引されています。\n"
            "**Web 調査 (`deep_research`) の前に**、テーマ・読者・疑問のキーワードで "
            "Agent Search (Vertex AI Search) を **最低 1 回** 実行し、自社の実態・制約・"
            "過去の打ち手を把握してください。\n"
            "- ワークフロー文脈に `コンテキスト状態: 企業コンテキスト不足` がある場合、"
            "一般論に寄るリスクを明示し、追加で Agent Search クエリを増やして補完する\n"
            "- research.json の sections / concerns / next_action.paths には、"
            "DE で確認できた自社コンテキストを反映する\n"
            "- 一般論だけの回答にせず、「御社では〜が確認できたので、次の打ち手は〜」"
            "の形で actionable にする\n"
            "- DE で未確認の社内数値・施策名は推測で書かない\n"
        )
    )


def prepare_writing_agent_search_turn_instruction(
    *,
    datastore_path: str | None,
) -> gtypes.Part | None:
    """文書フォーム向け Agent Search 指示 (`generate_document` 前に必須)."""
    if not datastore_path or not datastore_path.strip():
        return None
    return gtypes.Part(
        text=(
            "## このターンの必須手順 (文書自動入力 / Agent Search)\n"
            "確定済みフォームの各項目を埋める前に、項目ラベル・固有名詞で "
            "Agent Search (Vertex AI Search / データ環境 DE) を **項目ごとに参照** してください。\n"
            "- `read_writing_form_status` で key / label を確認した **後**、"
            "空の value は `search_knowledge` (Agent Search) で調査・生成する\n"
            "- 完了時は `add_json_document` を 1 回呼び、field key をトップレベルキーとした JSON を返す\n"
            "- DE で未確認の数値・固有名詞は推測で書かない\n"
        )
    )


def prepare_image_agent_search_turn_instruction(
    *,
    datastore_path: str | None,
) -> gtypes.Part | None:
    """画像スタジオ向け Agent Search 指示 (`generate_image` / `retouch_image` 前に必須)."""
    if not datastore_path or not datastore_path.strip():
        return None
    return gtypes.Part(
        text=(
            "## このターンの必須手順 (画像生成 / Agent Search)\n"
            "チラシ・POP・商品画像では、ユーザーが指定した **商品名・ブランド・住所・価格・特徴** は "
            "組織ナレッジ (データ環境 DE / Agent Search) を SSOT として確認してください。\n"
            "- `generate_image` または `retouch_image` を呼ぶ **前に**、"
            "固有名詞・商品キーワードで Agent Search (Vertex AI Search) を **最低 1 回** 実行する\n"
            "- **レタッチ**で住所・社名・電話番号・商品仕様を画像に反映する場合も同様（"
            "ツールを呼ばずに「検索した」と述べるのは禁止）\n"
            "- 検索結果の正式名称・訴求ポイント・禁則を画像のコピーに反映する\n"
            "- 根拠になった資料は `add_citation` で出典を付ける（経営相談モードと同じ UI）\n"
            "- DE で未確認の価格・成分・効果・住所は推測で書かない\n"
        )
    )


def prepare_knowledge_context_parts(
    selected_knowledge: list[Any],
    *,
    section_title: str | None = None,
    section_intro: str | None = None,
) -> list[gtypes.Part]:
    """ユーザーが選択した取り込み済み知識を Part 列に変換する."""
    parts: list[gtypes.Part] = []
    if not selected_knowledge:
        return parts

    title = section_title or f"ユーザー指定の参照知識 ({len(selected_knowledge)} 件)"
    intro = section_intro or (
        "以下は社内資料です. 回答ではこれらを優先的に参照し、"
        "Agent Search 結果と突合してください. "
        "資料に無い内容は推測で補完せず、不明と明示してください.\n"
    )

    parts.append(
        gtypes.Part(
            text=f"## {title}\n{intro}"
        )
    )

    for item in selected_knowledge:
        name = _attr(item, "name") or "(無題)"
        gcs_path = _attr(item, "gcs_path") or ""
        mime = (_attr(item, "mime_type") or "application/octet-stream").lower()
        if not gcs_path:
            continue

        parts.append(
            gtypes.Part(
                text=f"### [{mime or '?'}] {name}\nGCS: {gcs_path}\n"
            )
        )

        if _is_inline_supported(mime):
            data = _fetch_gcs_bytes(gcs_path)
            if not data:
                parts.append(_failed_part(name, gcs_path, "GCS fetch 失敗"))
                continue
            if len(data) > _INLINE_MAX_BYTES:
                parts.append(
                    _failed_part(
                        name,
                        gcs_path,
                        f"サイズ超過 ({len(data) // 1024 // 1024}MB)",
                    )
                )
                continue
            parts.append(
                gtypes.Part(inline_data=gtypes.Blob(mime_type=mime, data=data))
            )
            continue

        if _is_text_supported(mime):
            data = _fetch_gcs_bytes(gcs_path)
            if not data:
                parts.append(_failed_part(name, gcs_path, "GCS fetch 失敗"))
                continue
            try:
                text = data.decode("utf-8", errors="replace")
            except Exception:
                text = ""
            if text:
                parts.append(gtypes.Part(text=_truncate(text) + "\n"))
            else:
                parts.append(_failed_part(name, gcs_path, "デコード失敗"))
            continue

        parts.append(
            gtypes.Part(
                text=(
                    "この形式は inline 展開できません. "
                    "Agent Search で同名資料を検索して参照してください.\n"
                )
            )
        )

    return parts


def merge_knowledge_refs(
    pinned: list[Any],
    turn_selected: list[Any],
) -> tuple[list[Any], list[Any]]:
    """ピン留めとターン選択を分離。戻り値は (pinned, turn_only)。"""
    pinned_paths = {
        p
        for p in (_attr(item, "gcs_path") for item in pinned)
        if p
    }
    turn_only: list[Any] = []
    for item in turn_selected:
        path = _attr(item, "gcs_path")
        if path and path not in pinned_paths:
            turn_only.append(item)
    return pinned, turn_only
