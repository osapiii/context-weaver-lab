---
name: storyvault-codex-skill
description: Use StoryVault MCP to load rich story context, evidence, source assets, reports, screenshots, videos, and pull request references before implementation.
metadata:
  service: StoryVault
---

# StoryVault Codex Skill

Use this skill when a user asks Codex to implement, review, document, or plan work from a StoryVault story.

## Required Flow

1. Call the `storyvault` MCP server before planning when the user provides an application ID and story ID.
2. Use `get_story_context` with `format: "html"` when the user wants a visual report, or `format: "markdown"` when the user wants raw Markdown.
3. Save returned HTML or Markdown to a local file when the user asks to inspect the source report.
4. Read the returned context before making an implementation plan.
5. Preserve evidence IDs in plans, PR descriptions, and summaries when they support a decision.

## Important Constraints

- StoryVault MCP is read-only for implementation agents.
- Do not write plans, patches, or status updates back to StoryVault unless a future tool explicitly supports that workflow.
- Treat signed URLs and tokens as sensitive.
- If the MCP tools are not visible in the current thread, ask the user to restart the AI tool after running the StoryVault MCP Setup command.

## Default Prompt

When the user asks for StoryVault context, use wording like:

```text
storyvault というMCPサーバーを使ってください。applicationId <APPLICATION_ID>、storyId <STORY_ID>、format html、includeSignedUrls true、signedUrlTtlSeconds 3600 で get_story_context を呼び出してください。返ってきたHTMLを実装コンテキストとして読み込み、計画やPR本文には evidence ID を残してください。
```
