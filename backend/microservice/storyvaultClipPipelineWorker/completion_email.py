"""Render the self-contained StoryVault pipeline completion report email."""

from __future__ import annotations

from datetime import datetime, timezone
from html import escape
from typing import Any
from urllib.parse import quote


STEP_LABELS = (
    ("trimSilence", "無音カット"),
    ("transcribe", "文字起こし"),
    ("section", "自動分割"),
    ("quickScan", "Quick Scan"),
    ("zappingAnalysis", "クリップ解析"),
    ("capabilityStructuring", "Capability整理"),
    ("storyGeneration", "Story生成"),
    ("verifyUiAssets", "UI反映"),
)


def completion_email_request_id(pipeline_id: str) -> str:
    """One stable RequestDoc per pipeline prevents Workflow retries duplicating mail."""
    return f"txnEmail_storyvault_clip_pipeline_{pipeline_id}"


def _text(value: Any) -> str:
    return str(value or "").strip()


def _format_duration(seconds: int) -> str:
    minutes, remaining = divmod(max(0, seconds), 60)
    return f"{minutes}分{remaining}秒"


def _datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return None


def build_completion_email(
    *,
    pipeline_id: str,
    parent: dict[str, Any],
    state: dict[str, Any],
    app_url: str,
    now: datetime | None = None,
) -> dict[str, str]:
    now = now or datetime.now(timezone.utc)
    failed_ids = list(state.get("failedClipIds") or [])
    partial = bool(failed_ids)
    title = _text(parent.get("title")) or "録画解析"
    application = _text(parent.get("applicationName")) or _text(parent.get("applicationId")) or "StoryVault"
    clips = list(state.get("clips") or parent.get("clips") or [])
    clip_ids = list(state.get("clipIds") or [])
    capability_ids = list(state.get("capabilityIds") or [])
    story_ids = list(state.get("storyIds") or [])
    started = _datetime(parent.get("createdAt"))
    elapsed_seconds = round((now - started).total_seconds()) if started else 0
    status_label = "一部完了" if partial else "完了"
    hero = "一部完了しました" if partial else "解析が完了しました"
    accent = "#d97706" if partial else "#059669"
    background = "#fffbeb" if partial else "#ecfdf5"
    created_label = now.astimezone().strftime("%Y/%m/%d %H:%M")
    base_url = app_url.rstrip("/")
    cta_url = f"{base_url}/admin/storyvault?pipelineId={quote(pipeline_id, safe='')}"
    logo_url = f"{base_url}/apple-touch-icon.png"

    successful = max(0, len(clip_ids) - len(failed_ids))
    cards = (
        ("生成クリップ", len(clip_ids)), ("解析成功", successful),
        ("解析失敗", len(failed_ids)), ("Capability", len(capability_ids)),
        ("正式User Story", len(story_ids)), ("処理時間", _format_duration(elapsed_seconds)),
    )
    card_rows = "".join(
        "<tr>" + "".join(
            f'<td style="padding:6px;width:33.33%"><div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;background:#fff">'
            f'<div style="font-size:11px;color:#64748b">{escape(label)}</div><div style="margin-top:5px;font-size:20px;font-weight:700;color:#0f172a">{escape(str(value))}</div></div></td>'
            for label, value in cards[index:index + 3]
        ) + "</tr>" for index in range(0, len(cards), 3)
    )

    steps = parent.get("steps") or {}
    step_html = "".join(
        f'<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#334155">{escape(label)}</td>'
        f'<td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#059669;font-weight:600">'
        f'{escape("完了" if (steps.get(step_id) or {}).get("status") == "completed" else _text((steps.get(step_id) or {}).get("status")) or "完了")}</td></tr>'
        for step_id, label in STEP_LABELS
    )
    shown_clips = clips[:5]
    clip_html = "".join(
        f'<li style="margin:0 0 8px;color:#334155">{escape(_text(item.get("title")) or _text(item.get("clipId")) or "クリップ")}</li>'
        for item in shown_clips
    ) or '<li style="color:#64748b">生成クリップはアプリで確認できます</li>'
    if len(clips) > len(shown_clips):
        clip_html += f'<li style="color:#64748b">ほか {len(clips) - len(shown_clips)} 件</li>'
    story_titles = list(state.get("storyTitles") or [])[:3]
    story_html = "".join(f'<li style="margin:0 0 8px;color:#334155">{escape(_text(item))}</li>' for item in story_titles)
    if not story_html:
        story_html = f'<li style="color:#64748b">正式User Story {len(story_ids)}件を生成しました</li>'
    warning = ""
    if partial:
        warning = (
            f'<div style="margin:22px 0;padding:16px;border:1px solid #f59e0b;border-radius:10px;background:#fffbeb;color:#92400e">'
            f'<strong>{len(failed_ids)}件のクリップ解析に失敗しました。</strong><br>成功した成果は保存済みです。失敗内容と再実行はアプリ内で確認できます。</div>'
        )

    html = f'''<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a">
<div style="display:none;max-height:0;overflow:hidden">StoryVaultの録画解析レポートです。</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="padding:34px 32px;background:{background};border-top:6px solid {accent}"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:12px"><img src="{escape(logo_url, quote=True)}" width="44" height="44" alt="StoryVault" style="display:block;width:44px;height:44px;border:0;border-radius:10px"></td><td><div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:{accent}">STORYVAULT ANALYSIS REPORT</div><div style="margin-top:3px;font-size:12px;color:#64748b">StoryVault</div></td></tr></table><h1 style="margin:14px 0 6px;font-size:28px">{escape(hero)}</h1><p style="margin:0;color:#475569">録画からクリップ、Capability、User Storyまで自動生成しました。</p></td></tr>
<tr><td style="padding:28px 32px"><h2 style="margin:0 0 14px;font-size:20px">{escape(title)}</h2><table role="presentation" width="100%" style="font-size:13px;color:#475569"><tr><td>Application</td><td align="right"><strong>{escape(application)}</strong></td></tr><tr><td>処理日時</td><td align="right">{escape(created_label)}</td></tr><tr><td>全体ステータス</td><td align="right" style="color:{accent};font-weight:700">{escape(status_label)}</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px -6px 0;width:calc(100% + 12px)">{card_rows}</table>{warning}
<h3 style="margin:26px 0 8px;font-size:16px">実行工程</h3><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">{step_html}</table>
<h3 style="margin:26px 0 8px;font-size:16px">生成されたクリップ</h3><ul style="padding-left:20px">{clip_html}</ul><h3 style="margin:22px 0 8px;font-size:16px">代表的なUser Story</h3><ul style="padding-left:20px">{story_html}</ul>
<div style="text-align:center;margin:30px 0 12px"><a href="{escape(cta_url, quote=True)}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#0f172a;color:#fff;text-decoration:none;font-weight:700">解析結果をStoryVaultで開く</a></div>
</td></tr><tr><td style="padding:18px 32px;background:#f8fafc;font-size:11px;color:#94a3b8">Pipeline / Request ID: {escape(pipeline_id)}<br>このメールはStoryVaultのバックグラウンド解析から自動送信されました。</td></tr></table></td></tr></table></body></html>'''

    step_text = "\n".join(f"- {label}: {(steps.get(step_id) or {}).get('status', 'completed')}" for step_id, label in STEP_LABELS)
    text = (
        f"{hero}\n\n元録画: {title}\nApplication: {application}\n処理日時: {created_label}\n"
        f"全体ステータス: {status_label}\n\n生成クリップ: {len(clip_ids)}\n解析成功: {successful}\n"
        f"解析失敗: {len(failed_ids)}\nCapability: {len(capability_ids)}\n正式User Story: {len(story_ids)}\n"
        f"処理時間: {_format_duration(elapsed_seconds)}\n\n実行工程:\n{step_text}\n\n解析結果: {cta_url}\n"
        f"Pipeline / Request ID: {pipeline_id}"
    )
    return {
        "subject": f"【StoryVault】録画解析が{status_label}しました: {title}",
        "html": html,
        "text": text,
    }
