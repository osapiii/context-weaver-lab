"""Optional Gemini Computer Use exploration for Screen Atlas variants."""
from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlparse

SAFE_VARIANT_KINDS = {
    "menu_open",
    "modal_open",
    "tab_active",
    "drawer_open",
    "dropdown_open",
    "accordion_open",
    "scrolled",
    "form_filled",
    "search_results",
    "empty_state",
    "error_state",
    "unknown",
}

BLOCKED_ACTION_WORDS = {
    "create",
    "update",
    "delete",
    "save",
    "publish",
    "send",
    "invite",
    "purchase",
    "submit",
    "upload",
}


def _same_origin(left: str, right: str) -> bool:
    left_parsed = urlparse(left)
    right_parsed = urlparse(right)
    return (
        left_parsed.scheme == right_parsed.scheme
        and left_parsed.netloc == right_parsed.netloc
    )


def normalize_variant_record(raw: dict[str, Any], *, fallback_label: str) -> dict[str, Any]:
    kind = str(raw.get("variantKind") or raw.get("variant_kind") or "unknown").strip()
    if kind not in SAFE_VARIANT_KINDS:
        kind = "unknown"
    steps = raw.get("interactionSteps") or raw.get("interaction_steps") or []
    if not isinstance(steps, list):
        steps = []
    elements = raw.get("visibleElements") or raw.get("visible_elements") or []
    clues = raw.get("userIntentClues") or raw.get("user_intent_clues") or []
    return {
        "variantKind": kind,
        "label": str(raw.get("label") or fallback_label).strip() or fallback_label,
        "changedFromBase": str(
            raw.get("changedFromBase") or raw.get("changed_from_base") or ""
        ).strip(),
        "visibleElements": [str(item).strip() for item in elements if str(item).strip()]
        if isinstance(elements, list)
        else [],
        "userIntentClues": [str(item).strip() for item in clues if str(item).strip()]
        if isinstance(clues, list)
        else [],
        "riskLevel": str(raw.get("riskLevel") or raw.get("risk_level") or "safe_readonly"),
        "interactionSteps": [
            item for item in steps if isinstance(item, dict)
        ],
    }


def action_is_blocked(action: dict[str, Any]) -> bool:
    joined = " ".join(str(value).lower() for value in action.values())
    return any(word in joined for word in BLOCKED_ACTION_WORDS)


async def explore_screen_variants(
    *,
    page: Any,
    screen: dict[str, Any],
    origin: str,
    max_variants: int,
    max_steps: int,
    allow_chat_send: bool = False,
) -> dict[str, Any]:
    """Explore non-destructive variants for a screen.

    This helper intentionally degrades to a skipped result when Gemini Computer Use
    is not configured or unavailable. Static Screen Atlas capture should remain
    useful without this optional explorer.
    """
    model = (os.environ.get("GEMINI_COMPUTER_USE_MODEL") or "gemini-3-flash-preview").strip()
    if not model:
        return {"ok": True, "variants": [], "failures": [], "skipped": "model_not_configured"}

    try:
        from google import genai  # type: ignore
        from google.genai import types  # type: ignore
    except Exception as exc:
        return {
            "ok": True,
            "variants": [],
            "failures": [
                {
                    "screenId": screen.get("screenId"),
                    "url": screen.get("url"),
                    "phase": "computer_use_setup",
                    "error": f"google-genai unavailable: {str(exc)[:200]}",
                }
            ],
            "skipped": "google_genai_unavailable",
        }

    prompt = "\n".join(
        [
            "You are exploring UI state variants for one already discovered screen.",
            "Discover non-destructive visual states only.",
            "Do not create, update, delete, purchase, invite, publish, save, or submit.",
            "Stay on the same origin.",
            "For each meaningful state, use the minimum action sequence and describe what changed.",
            "Stop when no new meaningful state is likely.",
            f"Current URL: {screen.get('url')}",
            f"Screen title: {screen.get('title')}",
            f"Maximum variants: {max_variants}",
            f"Maximum steps: {max_steps}",
            f"Chat send allowed: {'yes' if allow_chat_send else 'no'}",
        ]
    )

    try:
        screenshot = await page.screenshot(full_page=False, type="png")
        client = genai.Client()
        config = types.GenerateContentConfig(
            tools=[
                types.Tool(
                    computer_use=types.ComputerUse(
                        environment=types.Environment.ENVIRONMENT_BROWSER,
                        excluded_predefined_functions=["drag_and_drop"],
                    )
                )
            ]
        )
        response = client.models.generate_content(
            model=model,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(text=prompt),
                        types.Part.from_bytes(data=screenshot, mime_type="image/png"),
                    ],
                )
            ],
            config=config,
        )
    except Exception as exc:
        return {
            "ok": True,
            "variants": [],
            "failures": [
                {
                    "screenId": screen.get("screenId"),
                    "url": screen.get("url"),
                    "phase": "computer_use_call",
                    "error": str(exc)[:300],
                }
            ],
            "skipped": "computer_use_call_failed",
        }

    variants: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    candidates = getattr(response, "candidates", []) or []
    parts = getattr(candidates[0], "content", None) if candidates else None
    content_parts = getattr(parts, "parts", []) if parts else []
    step_count = 0
    for part in content_parts:
        function_call = getattr(part, "function_call", None)
        if not function_call:
            continue
        action = {
            "name": str(getattr(function_call, "name", "")),
            **dict(getattr(function_call, "args", {}) or {}),
        }
        if action_is_blocked(action):
            failures.append(
                {
                    "screenId": screen.get("screenId"),
                    "url": screen.get("url"),
                    "phase": "computer_use_action",
                    "error": "blocked_destructive_action",
                    "action": action,
                }
            )
            continue
        before_url = page.url
        try:
            await _execute_basic_action(page, action)
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        after_url = page.url
        if after_url and not _same_origin(after_url, origin):
            failures.append(
                {
                    "screenId": screen.get("screenId"),
                    "url": before_url,
                    "phase": "computer_use_action",
                    "error": "blocked_external_origin",
                    "action": action,
                }
            )
            await page.goto(str(screen.get("url") or origin), wait_until="domcontentloaded")
            continue
        step_count += 1
        variants.append(
            normalize_variant_record(
                {
                    "variantKind": _variant_kind_from_action(action),
                    "label": action.get("name") or f"Variant {step_count}",
                    "changedFromBase": f"Computer Use executed {action.get('name')}.",
                    "interactionSteps": [
                        {
                            "step": step_count,
                            "action": action.get("name"),
                            "beforeUrl": before_url,
                            "afterUrl": after_url,
                            "args": {k: v for k, v in action.items() if k != "name"},
                        }
                    ],
                },
                fallback_label=f"Variant {step_count}",
            )
        )
        if len(variants) >= max_variants or step_count >= max_steps:
            break

    return {"ok": True, "variants": variants, "failures": failures}


async def _execute_basic_action(page: Any, action: dict[str, Any]) -> None:
    name = str(action.get("name") or "")
    if name in {"click_at", "double_click_at"}:
        x = int(action.get("x") or 0)
        y = int(action.get("y") or 0)
        await page.mouse.click(x, y, click_count=2 if name == "double_click_at" else 1)
    elif name == "type_text_at":
        x = int(action.get("x") or 0)
        y = int(action.get("y") or 0)
        await page.mouse.click(x, y)
        await page.keyboard.type(str(action.get("text") or ""))
    elif name in {"scroll", "scroll_at"}:
        dy = int(action.get("dy") or action.get("delta_y") or 500)
        await page.mouse.wheel(0, dy)


def _variant_kind_from_action(action: dict[str, Any]) -> str:
    joined = " ".join(str(value).lower() for value in action.values())
    if "menu" in joined:
        return "menu_open"
    if "modal" in joined or "dialog" in joined:
        return "modal_open"
    if "tab" in joined:
        return "tab_active"
    if "drawer" in joined:
        return "drawer_open"
    if "dropdown" in joined or "select" in joined:
        return "dropdown_open"
    if "accordion" in joined:
        return "accordion_open"
    if "scroll" in joined:
        return "scrolled"
    if "type" in joined:
        return "form_filled"
    return "unknown"
