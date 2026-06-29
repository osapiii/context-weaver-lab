# StoryVault Remote MCP Server

Remote MCP boundary for external coding agents such as Codex. It exposes
StoryVault Application / Story / Evidence context as read-only reports for
coding agents. The report publisher generates both HTML and Markdown, uploads
them to Cloud Storage, and returns compact download links. Coding agents should
fetch the Markdown link; humans can open the HTML link in a browser. The public
tool surface is intentionally small: agents fetch rich context and keep any
plans or patches in their local workflow.

## Story context report link contract

`get_story_context` returns a link-first payload so remote MCP clients do not
spend tokens on large HTML/Markdown bodies:

```json
{
  "schemaVersion": "storyvault-story-context-report-links-v1",
  "applicationId": "app-haiff",
  "storyId": "story-haiff-ai-knowledge-ingest-mcp-smoke",
  "storyKey": "HAIFFF-ST-AI-KNOWLEDGE-INGEST",
  "title": "AIにファイルを取り込み、知識を確認してテスト会話で活用する",
  "generatedAt": "2026-06-29T00:00:00+00:00",
  "expiresAt": "2026-06-30T00:00:00+00:00",
  "recommendedForAgent": "markdown",
  "reports": {
    "html": {
      "url": "https://storyvault-mcp.example.test/r/20260629T000000Z-a1b2c3d4e5/story-context.html",
      "gcsPath": "gs://bucket/story-context.html",
      "storagePath": "story-context.html",
      "contentType": "text/html; charset=utf-8",
      "bytes": 83719
    },
    "markdown": {
      "url": "https://storyvault-mcp.example.test/r/20260629T000000Z-a1b2c3d4e5/story-context.md",
      "gcsPath": "gs://bucket/story-context.md",
      "storagePath": "story-context.md",
      "contentType": "text/markdown; charset=utf-8",
      "bytes": 41866
    }
  },
  "implementationContext": {
    "readThisFirst": "reports.markdown.url",
    "notes": [
      "Coding agents should fetch the Markdown report and use evidence IDs in plans.",
      "HTML is intended for human visual review in a browser."
    ]
  },
  "assets": {
    "signedUrlExpiresAt": "2026-06-29T01:00:00+00:00",
    "counts": {
      "sourceAssets": 2,
      "operationVideos": 1,
      "screenshots": 1,
      "githubPullRequests": 0
    },
    "videos": [
      {
        "id": "video-1",
        "title": "知識取り込み操作",
        "downloadUrl": "https://storage.example.test/video.webm",
        "downloadUrlExpiresAt": "2026-06-29T01:00:00+00:00",
        "screenshots": [
          {
            "id": "frame-001",
            "timestampMs": 1200,
            "downloadUrl": "https://storage.example.test/frame.jpg",
            "downloadUrlExpiresAt": "2026-06-29T01:00:00+00:00"
          }
        ]
      }
    ]
  }
}
```

`reports.markdown.url` is the primary implementation context for coding agents.
`reports.html.url` is for visual inspection and should not be fetched by an
agent unless explicitly needed.

## Local smoke

```bash
cd backend/mcp-server/vibe_control
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
STORYVAULT_MCP_DEV_TOKEN=dev-token \
STORYVAULT_MCP_DEV_ORGANIZATION_ID=org \
STORYVAULT_MCP_DEV_SPACE_ID=space \
STORYVAULT_MCP_DEV_FIXTURE=true \
uvicorn server:app --reload --port 8080
```

MCP endpoint:

```text
POST http://localhost:8080/mcp
Authorization: Bearer dev-token
```

Codex CLI one-shot smoke:

```bash
STORYVAULT_MCP_DEV_TOKEN=dev-token codex exec \
  -C /path/to/vibe-control \
  --ephemeral \
  -c 'approval_policy="never"' \
  -c 'sandbox_mode="read-only"' \
  -c 'mcp_servers.storyvault_local.url="http://127.0.0.1:8080/mcp"' \
  -c 'mcp_servers.storyvault_local.bearer_token_env_var="STORYVAULT_MCP_DEV_TOKEN"' \
  -c 'mcp_servers.storyvault_local.default_tools_approval_mode="approve"' \
  -c 'mcp_servers.storyvault_local.tools.list_applications.approval_mode="approve"' \
  'Use the storyvault_local MCP server. Call list_applications with limit 1. Reply MCP_OK if it responds.'
```

For regular Codex use, the same settings can be added through:

```bash
codex mcp add storyvault --url https://YOUR_CLOUD_RUN_URL/mcp \
  --bearer-token-env-var STORYVAULT_MCP_TOKEN
```

For production-style tokens, run:

```bash
python mint_token.py --organization-id ORG --space-id SPACE --allowed-application-id APP
```

Save the printed `document` to the printed Firestore path. The raw token is
shown only once.

`STORYVAULT_MCP_DEV_FIXTURE=true` is only for local transport smoke tests when
Firestore ADC is not available. Omit it when checking real StoryVault data.
