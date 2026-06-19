# VibeControl Hackathon Implementation Plan

Last updated: 2026-06-18

## 1. Product Direction

VibeControl is a governance layer for AI-driven software delivery. It treats the user story as the single source of truth, then keeps that story synchronized with specs, tickets, GitHub code state, pull requests, and AI-editor context.

Domain premise: VibeControl can manage multiple software applications. Unlike HAiFF, where masters were attached to a manufacturing-line domain model, VibeControl uses `Application` as the top-level domain model. Each application owns multiple user stories, and story evidence, code references, source connections, drift, and editor context are always interpreted inside that application boundary.

The pitch from the attached deck is:

- Vibe coding accelerates prototyping, but weak governance creates context collapse, unclear requirements, and spec/code drift.
- The product definition should move from "a pile of code" to "a bundle of user stories with evidence."
- VibeControl generates and maintains those stories automatically by comparing intent (To-Be) with implementation state (As-Is).

## 2. Hackathon Fit

The Findy DevOps x AI Agent Hackathon requires both a Google Cloud application runtime and Google Cloud AI technology. VibeControl maps cleanly to that requirement:

- Application runtime: Firebase Hosting for the SPA, Cloud Run for ADK agents and integration microservices, Cloud Functions for webhook/request glue where useful.
- AI technology: Gemini API / ADK for agent orchestration, Vertex AI Search / Agent Search for product knowledge retrieval, optional Agent Builder style workflows later.
- DevOps cycle: plan, generate, implement, test, observe, and refresh stories in one loop.

Key dates:

- 2026-06-18: repository cutout and planning docs.
- 2026-07-10: project submission deadline.
- 2026-07-30: finalist announcement.
- 2026-08-19: finals.

## 3. Scope For MVP Submission

### Must Have

1. Application context setup
   - Select or create an Application as the top-level working domain.
   - Switch the active Application from the VibeControl header.
   - Provide Application CRUD UI: create modal, edit modal, delete action, and an Application detail top page.
   - Select or create a FileSpace.
   - Connect GitHub repository.
   - Import product docs through existing Drive/Web/manual ingestion.
   - Register application metadata such as domain, owner, labels, milestone, and release target.

2. Story generation
   - Use Agent Search to extract To-Be from product docs, tickets, and accepted criteria.
   - Use GitHub App/API to extract As-Is from repository tree, changed files, PRs, and commits.
   - Generate story cards with status, confidence, acceptance criteria, code links, and citations.

3. Dynamic story board
   - Group stories by lifecycle: Discovery, Ready for Dev, Implemented, Released.
   - Filter by label, milestone, domain, owner, confidence, and source freshness.
   - Show "context drift" indicators when code/tickets/specs disagree.

4. Story detail package
   - Tabs: Spec/Background, Evidence, Tickets/Requirements, Code Context, Agent Log.
   - Each tab shows evidence, not just summaries.
   - Developers should be able to understand one story without jumping through docs, Jira, and GitHub.

5. AI editor context
   - Provide a story context bundle that Cursor/Antigravity style editors can request.
   - MVP can start as an authenticated HTTP endpoint shaped like MCP resources.
   - Full MCP server and OAuth hardening can follow after submission.

### Nice To Have

- Jira/Linear connector.
- Story diff timeline.
- Reviewer checklist generated from changed code.
- Auto-created GitHub PR comment with story, evidence, and drift summary.
- Demo mode with a bundled sample repository.

## 4. Existing EN AIstudio Reuse Map

### Frontend Foundation

Reuse these patterns directly:

- `app/pages/admin/ai-studio.vue` for immersive workspace layout.
- `app/components/AiStudio/*` for hub/list/session patterns.
- `app/components/AgentWorkspace/*` for chat, workflow center, artifacts, and side panels.
- `app/pages/admin/data-source/index.vue` for knowledge setup and document viewing.
- `app/components/dataSource/*` for Drive/Web/manual ingestion UI.
- `app/components/knowledge/*` for document cards, previews, and pickers.
- `app/components/requestLog/*` and `app/components/workflow/*` for observability.

New VibeControl pages should keep the EN AIstudio visual system: quiet operational layout, dense scan-friendly cards, restrained colors, and icon-led controls.

### Knowledge Foundation

Reuse without redesign:

- FileSpace ID as the tenant-scoped knowledge boundary.
- GCS-backed knowledge document storage.
- Drive to GCS sync and GCS to FileSpace registration.
- Web crawl ingestion.
- Vertex AI Search / Agent Search as the retrieval layer.
- Citation and grounding metadata UI.
- `prepare_agent_search_turn_instruction` style prompting where DE is the SSOT.

The new product concept can be implemented as a new domain model that points at existing FileSpace documents rather than rebuilding ingestion.

### Agent / Backend Foundation

Reuse these runtime patterns:

- `backend/adk-agents/unified` for a single Cloud Run agent service.
- `backend/adk-agents/common` for session state, RequestDoc invocation, artifacts, citations, and GCS helpers.
- `backend/microservice/contextStore` for Agent Search / Discovery Engine operations.
- `backend/microservice/driveToGcsSync`, `gcsToFileSpaceRegister`, and `webCrawler` for ingestion.
- Existing Cloud Run + Cloud Build deploy scripts as templates.

Add a new ADK mode named `vibe_control` rather than creating a separate agent framework.

## 5. Proposed Architecture

```text
Firebase Hosting SPA
  |
  |-- Firestore: applications, stories, source connections, evidence, agent runs
  |-- Firebase Storage/GCS: artifacts, imported docs
  |
  +-- RequestDoc invoke
        |
        v
Cloud Run: unified ADK agent
  |
  |-- Gemini API / ADK planner
  |-- Vertex AI Search / Agent Search for To-Be knowledge
  |-- GitHub App/API integration for As-Is code state
  |-- GitHub evidence collector
  |
  v
Application-scoped Story SSOT package
```

## 6. Data Model Draft

### `vibeControlApplications/{applicationId}`

- `applicationKey`
- `name`
- `summary`
- `domain`
- `owner`
- `labels`
- `fileSpaceId`
- `repoFullName`
- `defaultBranch`
- `storyCount`
- `highDriftCount`
- `lastGeneratedAt`
- `createdAt`, `updatedAt`

### `vibeControlStories/{storyId}`

- `applicationId`
- `applicationKey`
- `title`
- `summary`
- `status`: `discovery | ready_for_dev | implemented | released`
- `domain`
- `milestone`
- `labels`
- `confidenceScore`
- `driftLevel`: `none | low | medium | high`
- `acceptanceCriteria`
- `sourceRefs`: FileSpace documents, web pages, Drive files, tickets
- `codeRefs`: repo, branch, PR, commit, files
- `createdAt`, `updatedAt`, `generatedAt`

### `vibeControlStoryEvidence/{evidenceId}`

- `applicationId`
- `applicationKey`
- `storyId`
- `type`: `knowledge | ticket | code | pr | commit | agent`
- `title`
- `sourceUrl`
- `gcsPath`
- `excerpt`
- `citation`
- `freshness`

### `vibeControlSourceConnections/{connectionId}`

- `applicationId`
- `applicationKey`
- `provider`: `github | jira | linear | drive | web`
- `status`
- `repoFullName`
- `defaultBranch`
- `fileSpaceId`
- `lastSyncedAt`
- `scopes`

## 7. Implementation Phases

### Phase 0 - Repository Cutout (2026-06-18)

- Create fresh `vibe-control` repository from EN AIstudio base.
- Remove local env files and private local signer keys.
- Add hackathon plan and ASCII screen docs.
- Rename frontend package to `vibe-control-app`.

### Phase 1 - Product Skeleton (2026-06-18 to 2026-06-21)

- Add `/admin/vibe-control` route.
- Reuse admin immersive layout and EN components.
- Add Application switcher header, Application create/edit modal, Application detail top, mock story board, detail drawer/page, and source setup screen.
- Add Pinia store and TypeScript types for applications, stories, evidence, and source connections.

### Phase 2 - Knowledge-First Story Generation (2026-06-22 to 2026-06-27)

- Add ADK mode `vibe_control`.
- Implement story generation from Agent Search results over the selected application's FileSpace.
- Persist generated stories and evidence in Firestore.
- Render citations and confidence indicators in the story detail view.

### Phase 3 - GitHub As-Is Integration (2026-06-28 to 2026-07-02)

- Add GitHub App/API connector.
- Pull repository tree, changed files, PR metadata, commits, and code snippets.
- Map code refs to generated stories.
- Compute drift between To-Be and As-Is.

### Phase 4 - SSOT Accuracy Tuning (2026-07-03 to 2026-07-07)

- Reflect citation coverage, AC coverage, and code mapping coverage in confidence.
- Show generation logs and missing-evidence reasons in the detail view.
- Prepare the demo flow from docs import to GitHub mapping and drift review.

### Phase 5 - Submission Hardening (2026-07-08 to 2026-07-10)

- Prepare demo data and one end-to-end sample flow.
- Add deployment notes and env checklist.
- Verify Firebase Hosting + Cloud Run deployment path.
- Record short demo script: import docs, connect repo, generate stories, inspect detail, review drift, export context.

### Finals Track (2026-07-11 to 2026-08-19)

- Harden MCP/OAuth integration.
- Add Jira/Linear connector.
- Add GitHub PR comments and reviewer checklist.
- Add live drift monitoring and scheduled refresh.

## 8. Engineering Risks

- GitHub/Jira/Linear auth may consume time. Mitigation: implement GitHub first, keep tickets as imported knowledge for MVP.
- Story generation can become vague. Mitigation: require citations and confidence score from Agent Search/GitHub evidence.
- New repo still points to EN AIstudio dev config. Mitigation: keep `.env.example` only, then create VibeControl-specific Firebase/GCP projects before shared demos.

## 9. Submission Demo Script

1. Open VibeControl dashboard.
2. Select or create an Application, then attach its FileSpace with product docs and GitHub repo.
3. Run "Generate stories."
4. Show dynamic board grouped by lifecycle.
5. Open one story detail and switch through Spec, Evidence, Tickets/Requirements, Code Context, and Agent Log.
6. Review confidence, missing evidence, and drift reason.
7. Export context bundle for AI editor.
8. Explain how this closes the DevOps loop: intent, implementation, and AI-agent context stay synchronized.
