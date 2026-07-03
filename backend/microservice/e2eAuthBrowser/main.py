from __future__ import annotations

import asyncio
import hashlib
import hmac
import html
import os
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import HTMLResponse, JSONResponse
from google.api_core import exceptions as google_exceptions
from google.cloud import secretmanager
from playwright.async_api import Browser, BrowserContext, Page, async_playwright
from pydantic import BaseModel


SECRET_ID_RE = re.compile(r"[^A-Za-z0-9_-]+")
SESSION_TTL_SECONDS = int(os.getenv("E2E_AUTH_BROWSER_SESSION_TTL_SECONDS", "1800"))
MAX_ENTRY_URL_LENGTH = 2048

app = FastAPI(title="StoryVault E2E Auth Browser")

_playwright: Any | None = None
_browser: Browser | None = None
_sessions: dict[str, "BrowserSession"] = {}
_sessions_lock = asyncio.Lock()


@dataclass
class BrowserSession:
    organization_id: str
    application_id: str
    entry_url: str
    context: BrowserContext
    page: Page
    created_at: float
    last_used_at: float


class ClickRequest(BaseModel):
    x: float
    y: float


class TypeRequest(BaseModel):
    text: str


class PressRequest(BaseModel):
    key: str


class NavigateRequest(BaseModel):
    url: str


class WheelRequest(BaseModel):
    deltaX: float = 0
    deltaY: float = 0


def _project_id() -> str:
    project_id = (
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCLOUD_PROJECT")
        or os.getenv("GCP_PROJECT")
        or ""
    ).strip()
    if not project_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLOUD_PROJECT is not configured")
    return project_id


def _shared_secret() -> str:
    secret = os.getenv("E2E_AUTH_BROWSER_SHARED_SECRET", "").strip()
    if not secret:
        raise HTTPException(
            status_code=500,
            detail="E2E_AUTH_BROWSER_SHARED_SECRET is not configured",
        )
    return secret


def _secret_id(organization_id: str, application_id: str) -> str:
    raw = f"storyvault-e2e-state-{organization_id}-{application_id}"
    normalized = SECRET_ID_RE.sub("-", raw).strip("-")
    return normalized[:240] or "storyvault-e2e-state"


def _sign_message(
    organization_id: str,
    application_id: str,
    entry_url: str,
    expires: int,
) -> str:
    return f"{organization_id}|{application_id}|{entry_url}|{expires}"


def _verify_token(
    *,
    organization_id: str,
    application_id: str,
    entry_url: str,
    expires: int,
    token: str,
) -> None:
    if expires < int(time.time()):
        raise HTTPException(status_code=401, detail="browser session URL has expired")
    expected = hmac.new(
        _shared_secret().encode("utf-8"),
        _sign_message(organization_id, application_id, entry_url, expires).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, token):
        raise HTTPException(status_code=401, detail="invalid browser session token")


async def _ensure_browser() -> Browser:
    global _playwright, _browser
    if _browser and _browser.is_connected():
        return _browser
    _playwright = await async_playwright().start()
    _browser = await _playwright.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--window-size=1440,1000",
        ],
    )
    return _browser


async def _cleanup_expired_sessions() -> None:
    now = time.time()
    expired: list[str] = []
    async with _sessions_lock:
        for session_id, session in _sessions.items():
            if now - session.last_used_at > SESSION_TTL_SECONDS:
                expired.append(session_id)
        for session_id in expired:
            session = _sessions.pop(session_id, None)
            if session:
                await session.context.close()


async def _get_session(session_id: str) -> BrowserSession:
    await _cleanup_expired_sessions()
    async with _sessions_lock:
        session = _sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="browser session not found")
        session.last_used_at = time.time()
        return session


async def _save_storage_state(
    organization_id: str,
    application_id: str,
    storage_state: dict[str, Any],
) -> dict[str, Any]:
    project_id = _project_id()
    secret_id = _secret_id(organization_id, application_id)
    secret_name = f"projects/{project_id}/secrets/{secret_id}"
    client = secretmanager.SecretManagerServiceClient()
    try:
        client.get_secret(request={"name": secret_name})
    except google_exceptions.NotFound:
        client.create_secret(
            request={
                "parent": f"projects/{project_id}",
                "secret_id": secret_id,
                "secret": {
                    "replication": {"automatic": {}},
                    "labels": {
                        "source": "storyvault",
                        "kind": "e2e-auth-state",
                    },
                },
            }
        )

    import json

    raw = json.dumps(storage_state, ensure_ascii=False, separators=(",", ":"))
    version = client.add_secret_version(
        request={
            "parent": secret_name,
            "payload": {"data": raw.encode("utf-8")},
        }
    )
    cookies = storage_state.get("cookies") if isinstance(storage_state.get("cookies"), list) else []
    origins = storage_state.get("origins") if isinstance(storage_state.get("origins"), list) else []
    return {
        "ok": True,
        "secretId": secret_id,
        "version": version.name.rsplit("/", 1)[-1],
        "cookieCount": len(cookies),
        "originCount": len(origins),
        "updatedAt": version.create_time.isoformat() if version.create_time else None,
    }


def _session_html(session_id: str, entry_url: str) -> str:
    escaped_url = html.escape(entry_url)
    escaped_session_id = html.escape(session_id)
    return f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>E2Eログイン管理ブラウザ</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: #eef2f7; color: #0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    header {{ display: flex; gap: 12px; align-items: center; padding: 12px 16px; background: white; border-bottom: 1px solid #dbe3ee; position: sticky; top: 0; z-index: 10; }}
    h1 {{ margin: 0; font-size: 15px; white-space: nowrap; }}
    input, button {{ height: 36px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; color: #0f172a; font: inherit; }}
    input {{ min-width: 280px; flex: 1; padding: 0 10px; }}
    button {{ padding: 0 12px; font-weight: 700; cursor: pointer; }}
    button.primary {{ background: #00b894; border-color: #00a886; color: white; }}
    button.danger {{ background: #fee2e2; border-color: #fecaca; color: #991b1b; }}
    .toolbar {{ display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 16px; background: #f8fafc; border-bottom: 1px solid #dbe3ee; }}
    .toolbar input {{ flex: 0 1 360px; min-width: 180px; }}
    main {{ padding: 16px; }}
    .screen {{ width: fit-content; max-width: 100%; margin: 0 auto; border-radius: 12px; overflow: hidden; background: #020617; box-shadow: 0 22px 50px rgba(15, 23, 42, 0.24); }}
    #screen {{ display: block; max-width: min(100%, 1440px); height: auto; cursor: crosshair; user-select: none; }}
    #status {{ min-width: 220px; color: #475569; font-size: 13px; }}
    .hint {{ margin: 12px auto 0; max-width: 960px; color: #64748b; font-size: 13px; line-height: 1.7; }}
  </style>
</head>
<body>
  <header>
    <h1>E2Eログイン管理ブラウザ</h1>
    <input id="url" value="{escaped_url}" aria-label="URL" />
    <button id="navigate">移動</button>
    <button class="primary" id="save">ログイン状態を保存</button>
    <button class="danger" id="close">閉じる</button>
    <span id="status">起動中...</span>
  </header>
  <div class="toolbar">
    <input id="text" placeholder="文字入力して送信" aria-label="文字入力" />
    <button id="type">入力</button>
    <button data-key="Enter">Enter</button>
    <button data-key="Tab">Tab</button>
    <button data-key="Escape">Esc</button>
    <button data-key="ArrowDown">↓</button>
    <button data-key="ArrowUp">↑</button>
    <button id="wheelDown">スクロール下</button>
    <button id="wheelUp">スクロール上</button>
  </div>
  <main>
    <div class="screen">
      <img id="screen" src="/session/{escaped_session_id}/screenshot" alt="Browser screen" />
    </div>
    <p class="hint">
      画面をクリックしてフォーカスし、文字入力欄から送信してください。ログイン後に「ログイン状態を保存」を押すと、PlaywrightのstorageStateがSecret Managerへ保存されます。
    </p>
  </main>
  <script>
    const sessionId = "{escaped_session_id}";
    const statusEl = document.getElementById("status");
    const screenEl = document.getElementById("screen");
    const setStatus = (message) => {{ statusEl.textContent = message; }};
    async function post(path, body = {{}}) {{
      const res = await fetch(path, {{
        method: "POST",
        headers: {{ "Content-Type": "application/json" }},
        body: JSON.stringify(body)
      }});
      const data = await res.json().catch(() => ({{}}));
      if (!res.ok) throw new Error(data.detail || data.message || res.statusText);
      return data;
    }}
    function refreshScreen() {{
      screenEl.src = `/session/${{sessionId}}/screenshot?t=${{Date.now()}}`;
    }}
    setInterval(refreshScreen, 900);
    screenEl.addEventListener("click", async (event) => {{
      const rect = screenEl.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (screenEl.naturalWidth / rect.width);
      const y = (event.clientY - rect.top) * (screenEl.naturalHeight / rect.height);
      try {{
        await post(`/session/${{sessionId}}/click`, {{ x, y }});
        setStatus("クリックしました");
        refreshScreen();
      }} catch (error) {{
        setStatus(error.message);
      }}
    }});
    document.getElementById("navigate").addEventListener("click", async () => {{
      try {{
        await post(`/session/${{sessionId}}/navigate`, {{ url: document.getElementById("url").value }});
        setStatus("移動しました");
        refreshScreen();
      }} catch (error) {{
        setStatus(error.message);
      }}
    }});
    document.getElementById("type").addEventListener("click", async () => {{
      const input = document.getElementById("text");
      try {{
        await post(`/session/${{sessionId}}/type`, {{ text: input.value }});
        input.value = "";
        setStatus("入力しました");
        refreshScreen();
      }} catch (error) {{
        setStatus(error.message);
      }}
    }});
    document.querySelectorAll("[data-key]").forEach((button) => {{
      button.addEventListener("click", async () => {{
        try {{
          await post(`/session/${{sessionId}}/press`, {{ key: button.dataset.key }});
          setStatus(`${{button.dataset.key}} を送信しました`);
          refreshScreen();
        }} catch (error) {{
          setStatus(error.message);
        }}
      }});
    }});
    document.getElementById("wheelDown").addEventListener("click", () => post(`/session/${{sessionId}}/wheel`, {{ deltaY: 620 }}).then(refreshScreen).catch((e) => setStatus(e.message)));
    document.getElementById("wheelUp").addEventListener("click", () => post(`/session/${{sessionId}}/wheel`, {{ deltaY: -620 }}).then(refreshScreen).catch((e) => setStatus(e.message)));
    document.getElementById("save").addEventListener("click", async () => {{
      try {{
        setStatus("保存しています...");
        const result = await post(`/session/${{sessionId}}/save`);
        setStatus(`保存しました Cookie: ${{result.cookieCount}} / Origin: ${{result.originCount}}`);
      }} catch (error) {{
        setStatus(error.message);
      }}
    }});
    document.getElementById("close").addEventListener("click", async () => {{
      try {{
        await post(`/session/${{sessionId}}/close`);
        setStatus("終了しました");
        window.close();
      }} catch (error) {{
        setStatus(error.message);
      }}
    }});
    screenEl.onload = () => setStatus("操作できます");
  </script>
</body>
</html>"""


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("shutdown")
async def shutdown() -> None:
    global _browser, _playwright
    async with _sessions_lock:
        sessions = list(_sessions.values())
        _sessions.clear()
    for session in sessions:
        await session.context.close()
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright:
        await _playwright.stop()
        _playwright = None


@app.get("/session/new", response_class=HTMLResponse)
async def new_session(
    organizationId: str,
    applicationId: str,
    entryUrl: str,
    expires: int,
    token: str,
) -> HTMLResponse:
    organization_id = organizationId.strip()
    application_id = applicationId.strip()
    entry_url = entryUrl.strip()
    if not organization_id or not application_id or not entry_url:
        raise HTTPException(status_code=400, detail="organizationId, applicationId and entryUrl are required")
    if len(entry_url) > MAX_ENTRY_URL_LENGTH:
        raise HTTPException(status_code=400, detail="entryUrl is too long")
    if not entry_url.startswith(("https://", "http://")):
        raise HTTPException(status_code=400, detail="entryUrl must be http or https")
    _verify_token(
        organization_id=organization_id,
        application_id=application_id,
        entry_url=entry_url,
        expires=expires,
        token=token,
    )
    await _cleanup_expired_sessions()
    browser = await _ensure_browser()
    context = await browser.new_context(
        viewport={"width": 1440, "height": 1000},
        locale="ja-JP",
        timezone_id="Asia/Tokyo",
    )
    page = await context.new_page()
    await page.goto(entry_url, wait_until="domcontentloaded", timeout=45000)
    session_id = uuid.uuid4().hex
    async with _sessions_lock:
        _sessions[session_id] = BrowserSession(
            organization_id=organization_id,
            application_id=application_id,
            entry_url=entry_url,
            context=context,
            page=page,
            created_at=time.time(),
            last_used_at=time.time(),
        )
    return HTMLResponse(_session_html(session_id, entry_url))


@app.get("/session/{session_id}/screenshot")
async def screenshot(session_id: str) -> Response:
    session = await _get_session(session_id)
    image = await session.page.screenshot(type="png", full_page=False)
    return Response(content=image, media_type="image/png")


@app.post("/session/{session_id}/click")
async def click(session_id: str, request: ClickRequest) -> dict[str, bool]:
    session = await _get_session(session_id)
    await session.page.mouse.click(request.x, request.y)
    return {"ok": True}


@app.post("/session/{session_id}/type")
async def type_text(session_id: str, request: TypeRequest) -> dict[str, bool]:
    session = await _get_session(session_id)
    await session.page.keyboard.type(request.text, delay=20)
    return {"ok": True}


@app.post("/session/{session_id}/press")
async def press(session_id: str, request: PressRequest) -> dict[str, bool]:
    session = await _get_session(session_id)
    await session.page.keyboard.press(request.key)
    return {"ok": True}


@app.post("/session/{session_id}/wheel")
async def wheel(session_id: str, request: WheelRequest) -> dict[str, bool]:
    session = await _get_session(session_id)
    await session.page.mouse.wheel(request.deltaX, request.deltaY)
    return {"ok": True}


@app.post("/session/{session_id}/navigate")
async def navigate(session_id: str, request: NavigateRequest) -> dict[str, str]:
    session = await _get_session(session_id)
    url = request.url.strip()
    if not url.startswith(("https://", "http://")):
        raise HTTPException(status_code=400, detail="url must be http or https")
    await session.page.goto(url, wait_until="domcontentloaded", timeout=45000)
    return {"ok": "true", "url": session.page.url}


@app.post("/session/{session_id}/save")
async def save(session_id: str) -> JSONResponse:
    session = await _get_session(session_id)
    storage_state = await session.context.storage_state()
    result = await _save_storage_state(
        session.organization_id,
        session.application_id,
        storage_state,
    )
    return JSONResponse(result)


@app.post("/session/{session_id}/close")
async def close(session_id: str) -> dict[str, bool]:
    async with _sessions_lock:
        session = _sessions.pop(session_id, None)
    if session:
        await session.context.close()
    return {"ok": True}
