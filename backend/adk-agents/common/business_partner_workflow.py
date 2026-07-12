"""取引先登録 invoke — mode_state / session.state 契約."""
from __future__ import annotations

from typing import Any

from .workspace_state_buckets import patch_task_bucket, task_bucket_from_mode_state


def merge_business_partner_invoke_mode_state(
    *,
    session_state: dict[str, Any],
    request_mode_state: dict[str, Any],
) -> dict[str, Any]:
    """FE modeState と既存 session をマージ."""
    merged = dict(request_mode_state or {})
    stored = task_bucket_from_mode_state(session_state, "business_partner")
    if stored:
        nested = merged.get("business_partner")
        if isinstance(nested, dict):
            combined = {**stored, **nested}
        else:
            combined = dict(stored)
        merged["business_partner"] = combined
    return merged


def business_partner_state_patch_from_mode_state(
    mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    bucket = task_bucket_from_mode_state(mode_state, "business_partner")
    if not bucket:
        return {}
    return {"business_partner": dict(bucket)}


def validate_business_partner_invoke(
    *,
    mode_state: dict[str, Any] | None,
) -> str | None:
    """不正入力時は HTTP 400 用メッセージ."""
    bucket = task_bucket_from_mode_state(mode_state, "business_partner")
    if not bucket and isinstance(mode_state, dict):
        bucket = mode_state

    lookup_mode = str(bucket.get("lookup_mode") or bucket.get("lookupMode") or "url")
    website = str(
        bucket.get("website_url") or bucket.get("websiteUrl") or ""
    ).strip()
    corporate = str(
        bucket.get("corporate_number") or bucket.get("corporateNumber") or ""
    ).strip()

    if lookup_mode == "corporateNumber":
        digits = corporate.replace(" ", "")
        if len(digits) < 13:
            return "法人番号 (13桁) が mode_state.business_partner に必要です"
        return None

    if not website:
        return "公式サイト URL (website_url) が mode_state.business_partner に必要です"
    if not website.startswith(("http://", "https://")):
        return "website_url は http:// または https:// で始めてください"
    return None


def business_partner_turn_context_summary(
    *,
    mode_state: dict[str, Any] | None,
) -> str:
    bucket = task_bucket_from_mode_state(mode_state, "business_partner")
    if not bucket:
        return ""
    lines = [
        "## 取引先登録コンテキスト",
        f"- 種別: {bucket.get('partner_type') or bucket.get('partnerType') or '—'}",
        f"- 取得モード: {bucket.get('lookup_mode') or bucket.get('lookupMode') or 'url'}",
        f"- 公式 URL: {bucket.get('website_url') or bucket.get('websiteUrl') or '—'}",
    ]
    corp = bucket.get("corporate_number") or bucket.get("corporateNumber")
    if corp:
        lines.append(f"- 法人番号: {corp}")
    lookup = bucket.get("lookup")
    if isinstance(lookup, dict) and lookup:
        name = lookup.get("name") or lookup.get("tradeName")
        if name:
            lines.append(f"- 既取得登記名: {name}")
    codes = bucket.get("existing_codes") or bucket.get("existingCodes")
    if isinstance(codes, list) and codes:
        lines.append(f"- 既存コード数: {len(codes)}")
    return "\n".join(lines)


def patch_business_partner_bucket(
    state_patch: dict[str, Any],
    mode_state: dict[str, Any] | None,
) -> None:
    bucket_patch = business_partner_state_patch_from_mode_state(mode_state)
    if bucket_patch:
        patch_task_bucket(state_patch, "business_partner", bucket_patch["business_partner"])


_LOOKUP_FIELD_KEYS = (
    "name",
    "tradeName",
    "tradeNameKana",
    "corporateNumber",
    "postalCode",
    "prefecture",
    "city",
    "streetAddress",
    "address",
    "capitalStock",
    "representativeName",
    "representativeTitle",
    "foundedDate",
    "industry",
    "employeeCount",
    "businessSummary",
    "phoneNumber",
    "email",
    "website",
)


def _draft_fields_nonempty(draft: Any) -> bool:
    if not isinstance(draft, dict):
        return False
    fields = draft.get("fields")
    if not isinstance(fields, dict):
        return False
    return any(
        isinstance(value, str) and value.strip() for value in fields.values()
    )


def lookup_to_draft_fields(bucket: dict[str, Any]) -> dict[str, Any]:
    """FE 事前 lookup / mode_state を取引先フォーム fields (camelCase) に変換."""
    lookup = bucket.get("lookup")
    if not isinstance(lookup, dict):
        return {}

    fields: dict[str, Any] = {}
    for key in _LOOKUP_FIELD_KEYS:
        raw = lookup.get(key)
        if raw is None:
            continue
        text = str(raw).strip()
        if text:
            fields[key] = text

    website = str(
        bucket.get("website_url") or bucket.get("websiteUrl") or ""
    ).strip()
    if website and not fields.get("website"):
        fields["website"] = website

    corporate = str(
        bucket.get("corporate_number") or bucket.get("corporateNumber") or ""
    ).strip()
    if not fields.get("corporateNumber") and corporate:
        digits = corporate.replace(" ", "")
        if digits:
            fields["corporateNumber"] = digits[:13]

    if not fields.get("tradeName") and fields.get("name"):
        fields["tradeName"] = fields["name"]

    existing = bucket.get("existing_codes") or bucket.get("existingCodes")
    codes = existing if isinstance(existing, list) else []
    code = propose_business_partner_code(
        fields=fields,
        existing_codes=[str(c) for c in codes if c],
    )
    if code:
        fields["code"] = code

    return fields


def propose_business_partner_code(
    *,
    fields: dict[str, Any],
    existing_codes: list[str],
) -> str | None:
    """既存コードと重複しない短い code を提案."""
    existing_set = {c.strip().upper() for c in existing_codes if c and str(c).strip()}
    corp = str(fields.get("corporateNumber") or "").replace(" ", "")
    if len(corp) >= 6:
        candidate = f"BP-{corp[-6:]}"
        if candidate.upper() not in existing_set:
            return candidate
    name = str(fields.get("tradeName") or fields.get("name") or "").strip()
    if name:
        slug = "".join(ch for ch in name.upper() if ch.isalnum())[:8] or "PARTNER"
        candidate = f"BP-{slug}"
        if candidate.upper() not in existing_set:
            return candidate
    return None


def synthesize_business_partner_draft(bucket: dict[str, Any]) -> dict[str, Any] | None:
    """save 未完了時に lookup から最低限の json_document ドラフトを組み立てる."""
    fields = lookup_to_draft_fields(bucket)
    if not fields:
        return None

    website = str(
        bucket.get("website_url") or bucket.get("websiteUrl") or fields.get("website") or ""
    ).strip()
    sources: list[dict[str, str]] = []
    if website:
        title = str(fields.get("tradeName") or fields.get("name") or "公式サイト")
        sources.append({"title": title, "uri": website})

    lookup = bucket.get("lookup")
    if isinstance(lookup, dict):
        src = str(lookup.get("lookupSource") or "").strip()
        if src and src not in {"url", "corporateNumber"}:
            sources.append({"title": "登記・公開情報", "uri": src})

    return {
        "comment": (
            "公式サイト・公開情報の取得結果をもとにドラフトを生成しました。"
            "（AI の save ツール未完了のためサーバーで自動整形）"
        ),
        "fields": fields,
        "sources": sources[:8],
    }


def finalize_business_partner_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    """done 前に draft が無ければ lookup から補完する."""
    merged = dict(bucket)
    draft = merged.get("draft")
    if _draft_fields_nonempty(draft):
        merged["phase"] = merged.get("phase") or "done"
        return merged

    synthesized = synthesize_business_partner_draft(merged)
    if synthesized:
        merged["draft"] = synthesized
        merged["phase"] = "done"
    return merged
