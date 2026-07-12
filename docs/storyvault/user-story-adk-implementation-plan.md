# StoryVault User Story ADK Implementation Plan

## 1. Basic Stance

StoryVault のユーザーストーリー生成は、単一の長時間 Job ではなく、対話型 Workbench と分離 ADK によって進める。

中心モデルは次の階層にする。

```text
Application
  -> Capability
    -> Story
      -> Acceptance Criteria
```

ただし、品質上の SSOT は Story 本文そのものではなく、次の根拠チェーンに置く。

```text
Source Asset
  -> Evidence
    -> Capability Evidence Assignment
      -> Story / Acceptance Criteria / Drift
```

設計判断:

- `Capability` と `Story` は別の実行対象にする。
- ADK は unified service へ追加せず、最初から Cloud Run service を分離する。
- UI は完了待機型ではなく、チャット + インタラクティブ構造パネルにする。
- ADK の出力は final JSON ではなく、Firestore に保存される draft patch を第一級成果物にする。
- チャットログは操作 UI であり、SSOT にはしない。
- Firestore の draft/current docs と ADK artifacts が UI の SSOT になる。

## 2. Target Services

### 2.1 Capability Agent

Service:

```text
storyvault-capability-agent
```

Responsibilities:

- Application に紐づく Evidence を収集・要約する。
- Capability 候補を作成する。
- Capability の merge / split / rename / reorder / parent-child 化を支援する。
- Evidence を Capability に割り当てる。
- ユーザー承認前の変更を `storyVaultDraftPatches` に保存する。
- ユーザー承認後に `storyVaultCapabilities` へ反映する。

Main tools:

- `read_storyvault_session`
- `list_evidence_cards`
- `propose_capability_map`
- `propose_capability_patch`
- `apply_capability_patch`
- `reject_capability_patch`
- `lock_capability`

### 2.2 Story Agent

Service:

```text
storyvault-story-agent
```

Responsibilities:

- 確定または選択中の Capability を読む。
- Capability 単位で Story 候補を生成する。
- Acceptance Criteria を生成する。
- GitHub / screenshot / video / knowledge evidence で AC を照合する。
- `covered / missing / conflict / unknown` を判定する。
- driftLevel / confidenceScore / needs_review を付与する。
- draft patch を保存し、承認後に `storyVaultStories` と `storyVaultStoryEvidence` へ反映する。

Main tools:

- `read_capability_context`
- `list_story_evidence`
- `propose_story_set`
- `propose_story_patch`
- `apply_story_patch`
- `reject_story_patch`
- `regenerate_story_for_capability`

### 2.3 Media Ingest Worker

Service or Firebase trigger:

```text
storyvault-media-ingest
```

Responsibilities:

- Application Scan screenshots を Discovery Engine へ検索可能な文書として登録する。
- Operation video を直接検索対象にせず、transcript / scene summary / key frame summary に変換して登録する。
- 元メディアへの GCS path / Storage path / signed URL 解決用 metadata を保持する。
- ADK から media-derived evidence を参照できるようにする。

This can start as Firebase Functions + RequestDoc, then become Cloud Run if processing becomes heavy.

## 3. Firestore Data Model

Existing collections can be extended. New collections should stay under the same organization/space base path used by StoryVault.

```text
organizations/{orgId}/spaces/{spaceId}/
  storyVaultApplications/{applicationId}
  storyVaultCapabilities/{capabilityId}
  storyVaultStories/{storyId}
  storyVaultStoryEvidence/{evidenceId}
  storyVaultSourceConnections/{sourceConnectionId}
  storyVaultOperationVideos/{videoId}
  storyVaultGenerationSessions/{generationSessionId}
  storyVaultDraftPatches/{patchId}
  storyVaultSourceAssets/{sourceAssetId}
```

### 3.1 Capability

```ts
type StoryVaultCapability = {
  id: string;
  applicationId: string;
  applicationKey: string;

  capabilityKey: string;
  name: string;
  summary?: string;
  domain?: string;
  owner?: string;
  labels: string[];

  parentCapabilityId?: string;
  order: number;
  status: "draft" | "active" | "archived";
  reviewState: "ready" | "needs_review";

  evidenceIds: string[];
  storyCount: number;
  highDriftCount: number;
  confidenceScore: number;
  driftLevel: "none" | "low" | "medium" | "high";
  driftReason?: string;

  locked: boolean;
  generatedAt: string;
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
};
```

### 3.2 Story Extension

Add these fields to `StoryVaultStory`.

```ts
type StoryVaultStoryCapabilityFields = {
  capabilityId: string;
  capabilityKey: string;
  capabilityName?: string;
  sequence: number;
};
```

### 3.3 Source Asset

This normalizes all raw sources before they become Evidence.

```ts
type StoryVaultSourceAsset = {
  id: string;
  applicationId: string;
  applicationKey: string;

  sourceType:
    | "knowledge_document"
    | "application_screenshot"
    | "application_scan_sitemap"
    | "operation_video"
    | "operation_video_transcript"
    | "operation_video_scene_summary"
    | "github_repository"
    | "github_file"
    | "github_pull_request"
    | "github_commit";

  title: string;
  summary?: string;
  uri?: string;
  gcsPath?: string;
  storagePath?: string;
  fileSpaceId?: string;
  fileSpaceDocumentId?: string;
  repoFullName?: string;
  path?: string;
  pullRequest?: string;
  commit?: string;

  discoveryStatus: "not_registered" | "queued" | "completed" | "error";
  discoveryDocumentId?: string;
  discoveryErrorMessage?: string;

  metadata: Record<string, unknown>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
```

### 3.4 Evidence

Extend current `StoryVaultStoryEvidence` so it can support Capability first.

```ts
type StoryVaultEvidence = {
  id: string;
  applicationId: string;
  applicationKey: string;

  capabilityId?: string;
  capabilityKey?: string;
  storyId?: string;
  storyKey?: string;

  sourceAssetId?: string;
  type:
    | "knowledge"
    | "screen"
    | "video"
    | "journey"
    | "code"
    | "pr"
    | "commit"
    | "agent";

  title: string;
  excerpt: string;
  citation: {
    title: string;
    uri?: string;
    snippet: string;
  };

  observedUserAction?: string;
  observedUiSurface?: string;
  codeRef?: {
    repoFullName: string;
    branch?: string;
    path?: string;
    lineStart?: number;
    lineEnd?: number;
  };

  confidenceImpact: number;
  freshness: "fresh" | "stale" | "unknown";
};
```

### 3.5 Generation Session

```ts
type StoryVaultGenerationSession = {
  id: string;
  applicationId: string;
  applicationKey: string;

  phase:
    | "source_ingest"
    | "capability_structuring"
    | "story_generation"
    | "review"
    | "completed"
    | "error";

  capabilityAdkSessionId?: string;
  storyAdkSessionIds: string[];
  activeCapabilityId?: string;
  activePatchId?: string;

  status: "idle" | "running" | "waiting_user" | "completed" | "error";
  lastMessage?: string;
  errorMessage?: string;

  sourceSnapshot: {
    fileSpaceId?: string;
    repoFullName?: string;
    defaultBranch?: string;
    screenshotCount: number;
    videoCount: number;
    evidenceCount: number;
  };

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
```

### 3.6 Draft Patch

```ts
type StoryVaultDraftPatch = {
  id: string;
  generationSessionId: string;
  applicationId: string;
  agent: "capability" | "story" | "media_ingest";
  targetType: "capability" | "story" | "evidence" | "source_asset";
  operation:
    | "create"
    | "update"
    | "delete"
    | "merge"
    | "split"
    | "move_evidence"
    | "reorder"
    | "lock";

  status: "proposed" | "applied" | "rejected" | "superseded";
  title: string;
  rationale: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  affectedIds: string[];
  evidenceIds: string[];

  createdBy: "agent" | "user";
  createdAt?: Timestamp;
  appliedAt?: Timestamp;
};
```

## 4. ADK Architecture

### 4.1 Directory Layout

```text
backend/adk-agents/
  common/
    storyvault/
      schemas.py
      evidence_models.py
      firestore_paths.py
      firestore_tools.py
      github_tools.py
      media_tools.py
      discovery_tools.py
      patch_tools.py

  storyvault_capability/
    __init__.py
    agent.py
    prompts.py
    tools.py
    server.py
    Dockerfile
    cloudbuild.yaml
    requirements.txt

  storyvault_story/
    __init__.py
    agent.py
    prompts.py
    tools.py
    server.py
    Dockerfile
    cloudbuild.yaml
    requirements.txt
```

### 4.2 Runtime Contract

Both services use the existing shared ADK infrastructure:

- Firebase auth / internal invoke auth
- FirestoreSessionService
- GcsArtifactService
- ADK artifact L1 -> Firebase Storage L2 -> Firestore L3 ingest
- SSE events
- `ToolContext.state` read via `read_tool_state`

Separate app names:

```text
storyvault_capability
storyvault_story
```

Environment:

```bash
ADK_APP_NAMES=storyvault_capability,storyvault_story,...
STORYVAULT_CAPABILITY_AGENT_URL=https://...
STORYVAULT_STORY_AGENT_URL=https://...
```

### 4.3 Session State Buckets

Use separate task buckets.

```ts
state.storyvault_capability = {
  setup: {
    generationSessionId,
    applicationId,
    applicationKey,
    fileSpaceId,
    repoFullName,
    defaultBranch
  },
  selectedEvidenceIds: [],
  activePatchId,
  phase
}

state.storyvault_story = {
  setup: {
    generationSessionId,
    applicationId,
    capabilityId,
    fileSpaceId,
    repoFullName,
    defaultBranch
  },
  selectedStoryIds: [],
  activePatchId,
  phase
}
```

### 4.4 Invocation Modes

Add frontend/backend invoke modes:

```text
storyvault_capability
storyvault_story
```

Files likely touched:

- `app/composables/useAgentSseClient.ts`
- `app/types/models/adkInvokeRequest.ts`
- `app/constants/aiStudioModes.ts`
- `app/types/models/enAiStudioSessionState.ts`
- `app/utils/workspaceSessionBuckets.ts`
- `backend/adk-agents/common/task_invoke_pipeline.py`
- `backend/adk-agents/common/workspace_state_buckets.py`
- `backend/app/triggers/adk_invoke_requests.py`

## 5. Media and Discovery Engine Fix

Current issue:

- Screenshot artifacts from Application Scan are saved as ADK artifacts, but are not reliably registered as Discovery Engine documents.
- Operation videos save the video and a metadata markdown, but ADK cannot use the actual video content as searchable evidence.
- Vertex AI Search / Discovery Engine is text-document oriented for this workflow. Raw image/video should not be the only indexed object.

Target:

```text
Screenshot PNG / Video WEBM
  -> derived text evidence document
  -> FileSpace upload request
  -> Discovery Engine document
  -> Evidence card with link back to original media
```

### 5.1 Screenshot Ingest

For each Application Scan screenshot:

1. Persist original screenshot in ADK artifact / Firebase Storage.
2. Create `StoryVaultSourceAsset` with `sourceType = application_screenshot`.
3. Generate a companion markdown:

```md
# Screen Observation

Application: ...
URL: ...
Screenshot ID: ...
Captured At: ...

## Visible UI
- ...

## User-intent clues
- ...

## Possible story evidence
- ...

## Original media
- GCS Path: ...
- Artifact filename: ...
```

4. Upload the markdown companion to the application FileSpace.
5. Create FileSpace upload RequestDoc with metadata:

```json
{
  "source": "storyvault-application-screenshot",
  "applicationId": "...",
  "applicationKey": "...",
  "sourceAssetId": "...",
  "screenUrl": "...",
  "originalArtifactFilename": "...",
  "originalStoragePath": "..."
}
```

6. Set `discoveryStatus` on source asset to `queued`.
7. When request completes, set `completed` and store `fileSpaceDocumentId`.

Implementation options:

- MVP: use page title / URL / textPreview already collected by Application Scan to create markdown.
- Better: add Gemini Vision screen summarization for each screenshot before markdown registration.
- Best: include OCR-like UI element extraction and screenshot region references.

### 5.2 Video Ingest

Do not rely on raw video indexing. Convert video into searchable derived assets.

Pipeline:

```text
operation-video.webm
  -> metadata markdown
  -> key frames
  -> scene summaries
  -> transcript if audio exists
  -> operation journey markdown
  -> FileSpace upload
```

Derived documents:

```text
operation_video_metadata.md
operation_video_scene_summary.md
operation_video_journey.md
operation_video_transcript.md
```

The most important one is `operation_video_journey.md`.

```md
# Operation Journey

Application: ...
Video: ...
Recorded At: ...

## User goal inferred
...

## Steps
1. User opens ...
2. User clicks ...
3. System shows ...

## Observed screens
- ...

## Potential capabilities
- ...

## Potential stories
- ...

## Original media
- Storage path: ...
```

MVP implementation:

- Keep current video upload.
- Generate metadata markdown as today.
- Add user-provided description and title as searchable journey document.
- Store original video path in metadata.

Phase 2:

- Extract frames with ffmpeg or browser MediaRecorder metadata.
- Summarize key frames using Gemini Vision through a media ingest request.
- Optionally transcribe audio with a speech model if audio is present.

Phase 3:

- Detect repeated UI surfaces and link video steps to screenshot/source assets.

### 5.3 Backfill

Add a backfill command or admin action:

```text
Backfill media to Discovery Engine
  input: applicationId
  actions:
    - find operation videos without completed discoveryStatus
    - find scan screenshots without SourceAsset / FileSpace document
    - create derived markdown docs
    - enqueue FileSpace upload requests
```

## 6. GitHub Access Fix

Current GitHub OAuth supports UI repository and merged PR display. ADK needs deterministic read tools.

Add shared tools:

```text
github_get_repository
github_list_recent_pull_requests
github_get_pull_request_files
github_get_file_content
github_search_code
github_list_tree
```

Rules:

- Tools read access token from secure org/user GitHub OAuth config.
- Tools never expose token to ADK output.
- Results are bounded and summarized.
- Large files return snippets, not whole contents.
- Every code evidence gets repo / branch / path / line range when possible.

## 7. UI Workbench

### 7.1 Top-level Route

Existing StoryVault page can gain a new workbench view:

```text
/admin/storyvault?view=story-workbench&applicationId=...
```

Main component:

```text
StoryVaultStoryWorkbench.vue
```

Child components:

```text
StoryVaultWorkbenchChat.vue
StoryVaultEvidenceInbox.vue
StoryVaultCapabilityTree.vue
StoryVaultStoryDraftBoard.vue
StoryVaultPatchReviewPanel.vue
StoryVaultMediaIngestStatus.vue
```

### 7.2 Desktop Wireframe

```text
+--------------------------------------------------------------------------------+
| StoryVault / Application: Payroll Admin                         [Sync Sources] |
+--------------------------------------------------------------------------------+
| Phase: [1 Evidence] [2 Capability] [3 Story] [4 Review]                         |
| Sources: Knowledge 18 | Screens 42 | Videos 5 | GitHub 30 PRs | Evidence 126    |
+------------------------------+-------------------------------+-----------------+
| Chat                         | Structure                     | Inspector       |
|                              |                               |                 |
| Capability Agent             | + Capability Map              | Selected        |
|  "I found 7 candidate         | |                             | Capability      |
|   capabilities. Payroll      | | [AUTH] Auth Setup            |                 |
|   setup and invite flow      | |   - ST-001 Login             | Name            |
|   may be one group."         | |   - ST-002 Invite user       | Auth Setup      |
|                              | |                             |                 |
| User                         | | [PAY] Payroll Run            | Evidence        |
|  "Invite should be separate" | |   - ST-010 Create run        | [12 linked]     |
|                              | |   - ST-011 Confirm run       |                 |
| Agent                        | |                             | Drift           |
|  "I'll propose a split."     | | [REPORT] Reports             | medium          |
|                              | |                             |                 |
| +--------------------------+ | +---------------------------+ | +-------------+ |
| | Ask / instruct agent     | | | Proposed Patch            | | | Actions     | |
| |                          | | | split AUTH into AUTH/INV  | | | Apply       | |
| +--------------------------+ | | [View diff] [Apply]       | | | Reject      | |
|                              | +---------------------------+ | | Lock        | |
+------------------------------+-------------------------------+-----------------+
| Evidence Drawer: [Knowledge] [Screens] [Videos] [GitHub] [Unassigned]           |
+--------------------------------------------------------------------------------+
```

### 7.3 Capability Structuring Wireframe

```text
+--------------------------------------------------------------------------------+
| Capability Structuring                                                        |
+----------------------------+------------------------------+--------------------+
| Evidence Inbox             | Capability Tree              | Patch Queue        |
|                            |                              |                    |
| Filter: [Unassigned v]     | Application                  | Proposed           |
| Search: [            ]     |  |- AUTH Auth Setup          |  1 split           |
|                            |  |   evidence: 14            |  2 rename          |
| [K] Requirement doc        |  |   confidence: 82          |                    |
|     "Users invite..."      |  |                          | Applied            |
|     [Assign] [Preview]     |  |- INV Invitation Mgmt      |  8 patches         |
|                            |  |   evidence: 7             |                    |
| [S] Screenshot /settings   |  |   confidence: 64          | Rejected           |
|     "Invite button..."     |  |                          |  1 patch           |
|     [Assign] [Preview]     |  |- PAY Payroll Run          |                    |
|                            |                              |                    |
| [V] Video step 03          | [Merge] [Split] [Rename]     | [Review diff]      |
|     "Admin adds member"    | [Reorder] [Lock selected]    | [Apply all safe]   |
+----------------------------+------------------------------+--------------------+
```

### 7.4 Story Generation Wireframe

```text
+--------------------------------------------------------------------------------+
| Story Generation: Capability [PAY] Payroll Run                                  |
+----------------------------+------------------------------+--------------------+
| Chat                       | Story Drafts                 | Evidence / Drift   |
|                            |                              |                    |
| Story Agent                | ST-010 Create payroll run    | Evidence coverage  |
|  "I generated 4 stories    |  Confidence: 78              |  Knowledge: 3      |
|   for Payroll Run.         |  Drift: low                  |  Screen: 5         |
|   ST-012 needs review."    |                              |  Video: 2          |
|                            |  AC                          |  GitHub: 4         |
| User                       |   [covered] Select period    |                    |
|  "Split approval flow"     |   [covered] Validate totals  | Code refs          |
|                            |   [missing] Approval state   |  app/payroll/...   |
| Agent                      |                              |                    |
|  "Proposing split..."      | ST-011 Confirm payroll run   | Drift reason       |
|                            |  Confidence: 61              | Approval exists in |
| [Ask agent...]             |  Drift: medium               | docs but not code. |
|                            |                              |                    |
|                            | [Apply selected] [Regenerate]| [Open source]      |
+----------------------------+------------------------------+--------------------+
```

### 7.5 Media Ingest Status Wireframe

```text
+--------------------------------------------------------------------------------+
| Media Evidence                                                                 |
+------------------------+------------------------+--------------------------+
| Screenshots             | Videos                 | Discovery Status         |
|                         |                        |                          |
| 42 captured             | 5 recorded             | Completed: 36            |
| 30 indexed              | 2 journey docs ready   | Queued: 8                |
| 12 pending              | 3 pending summaries    | Error: 3                 |
|                         |                        |                          |
| [Backfill Screens]      | [Backfill Videos]      | [Retry failed]           |
+------------------------+------------------------+--------------------------+
| Recent derived docs                                                            |
| - Screen Observation /settings/users                       completed           |
| - Operation Journey "Invite user flow"                     queued              |
| - Video Scene Summary "Payroll approval review"            error [details]     |
+--------------------------------------------------------------------------------+
```

### 7.6 Mobile Wireframe

```text
+--------------------------------------+
| StoryVault Workbench                |
| Payroll Admin                        |
+--------------------------------------+
| [Chat] [Structure] [Evidence] [Patch]|
+--------------------------------------+
| Capability Agent                     |
| "I found 7 candidate capabilities."  |
|                                      |
| User                                 |
| "Invite should be separate."         |
|                                      |
| +----------------------------------+ |
| | Ask / instruct agent             | |
| +----------------------------------+ |
+--------------------------------------+
```

## 8. UX Rules

- Every agent proposal is a patch, not an immediate mutation.
- User can apply, reject, or edit patches.
- Capability can be locked; Story Agent must not move stories out of locked Capability unless user explicitly asks.
- Evidence cards can be manually assigned.
- Regeneration scope must be selectable:
  - all application
  - selected capability
  - selected story
  - selected AC
- "Done" means Firestore docs or artifacts are ready, not just ADK text completion.

## 9. Implementation Phases

### Phase 0: Contracts and Models

Deliverables:

- Add `StoryVaultCapability` schema and converter.
- Extend Story schema with `capabilityId`, `capabilityKey`, `sequence`.
- Add SourceAsset / GenerationSession / DraftPatch schemas.
- Add Firestore paths and indexes.
- Add unit tests for schema parsing.

Acceptance:

- App can load and persist Capability docs.
- Existing stories without capability still render using fallback "Unassigned".

### Phase 1: Media Discovery Fix

Deliverables:

- Create SourceAsset docs for Application Scan screenshots.
- Generate screenshot companion markdown docs.
- Queue FileSpace upload requests for screenshot companion docs.
- Extend operation video save to generate operation journey markdown.
- Add media backfill action.
- Add status panel.

Acceptance:

- New screenshot scan creates searchable FileSpace docs.
- New operation video creates searchable journey doc.
- Existing videos/screens can be backfilled.
- ADK Agent Search can retrieve media-derived evidence by application terms.

### Phase 2: Capability Agent Service

Deliverables:

- Add `backend/adk-agents/storyvault_capability`.
- Add Cloud Run deploy config.
- Add request routing env and frontend invoke mode.
- Implement read/list/propose/apply patch tools.
- Add workbench Capability tab.

Acceptance:

- User can start a Capability session.
- Agent proposes Capability map from evidence.
- UI shows proposed patches.
- Applying patch updates `storyVaultCapabilities`.

### Phase 3: Story Agent Service

Deliverables:

- Add `backend/adk-agents/storyvault_story`.
- Implement Capability-scoped story generation.
- Add GitHub read tools.
- Add AC coverage and drift evaluation.
- Add Story Draft Board.

Acceptance:

- User can generate stories for one Capability.
- Stories include AC, evidenceIds, codeRefs, drift, confidence.
- User can apply/reject story patches.

### Phase 4: Workbench Polish

Deliverables:

- Session list / resume support.
- Patch history.
- Evidence assignment drag and drop.
- Locking.
- Bulk apply.
- Diff view.
- Error recovery and retry UX.

Acceptance:

- User can leave and resume an in-progress structure session.
- No chat log is required to reconstruct current structure.

### Phase 5: Evaluation and Hardening

Deliverables:

- Golden fixture apps.
- Evidence coverage tests.
- Patch idempotency tests.
- GitHub tool bounds tests.
- Media ingest retry tests.
- L3 artifact readiness tests.

Acceptance:

- Same source snapshot produces stable Capability keys.
- Re-running Story Agent for one Capability does not mutate unrelated capabilities.
- Failed media ingest does not block text-only evidence generation.

## 10. Key Engineering Notes

- ADK tools must read `ToolContext.state` with `read_tool_state`; do not use `isinstance(state, dict)`.
- All app names must be Python identifiers.
- Add both new app names to `ADK_APP_NAMES`, otherwise artifacts may not ingest.
- FE artifact UI must subscribe to Firestore artifacts, not rely only on SSE artifact events.
- Use `generationSessionId` as the join key between chat session, patches, artifacts, and final docs.
- Avoid storing huge GitHub files or media payloads in Firestore. Store summaries and pointers.
- FileSpace / Discovery Engine documents should be bounded, human-readable markdown or JSON.

## 11. First PR Scope

Recommended first PR:

1. Add Firestore models:
   - Capability
   - SourceAsset
   - GenerationSession
   - DraftPatch
2. Extend Story with Capability fields.
3. Add media-derived document generation for operation videos.
4. Add screenshot SourceAsset + companion markdown creation.
5. Add UI media ingest status panel.

Keep ADK service creation for the second PR, after the data contract is stable.

## 12. Second PR Scope

1. Add `storyvault-capability-agent`.
2. Add invoke mode and URL routing.
3. Add Capability Workbench UI.
4. Implement patch proposal/apply flow.

## 13. Third PR Scope

1. Add `storyvault-story-agent`.
2. Add GitHub read tools.
3. Add Story Draft Board.
4. Implement Capability-scoped story generation and patch application.
