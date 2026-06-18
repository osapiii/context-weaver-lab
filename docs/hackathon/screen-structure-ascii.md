# VibeControl ASCII Screen Structure

Last updated: 2026-06-18

These wireframes intentionally follow the EN AIstudio admin/workspace patterns: left navigation, compact operation-first panels, tabbed detail surfaces, and evidence-first cards.

## 1. App Shell

```text
+--------------------------------------------------------------------------------+
| EN AIstudio / VibeControl                                      [User] [Settings] |
+----------------------+---------------------------------------------------------+
| Admin Nav            | VibeControl                                             |
|                      | Govern vibe coding with story evidence                  |
| - AI Studio          |                                                         |
| - Knowledge          | [Connect Source] [Generate Stories] [Export Story]      |
| - VibeControl  (*)   |                                                         |
| - Request Logs       | +----------------+ +----------------+ +---------------+ |
| - Settings           | | Stories        | | Drift Alerts   | | Avg Confidence| |
|                      | | 42 total       | | 5 high         | | 86%           | |
|                      | +----------------+ +----------------+ +---------------+ |
|                      |                                                         |
|                      | Main content changes by selected VibeControl view.      |
+----------------------+---------------------------------------------------------+
```

## 2. Story Board / Dynamic List View

Primary use: understand what remains for MVP, which stories are risky, and where code/spec evidence disagree.

```text
+--------------------------------------------------------------------------------+
| VibeControl > Story Board                                                       |
+--------------------------------------------------------------------------------+
| Search stories...                  domain: billing x  milestone: mvp x          |
| [Status] [Owner] [Confidence] [Drift] [Source freshness]           [Refresh]    |
+--------------------------------------------------------------------------------+
| Lifecycle columns                                                               |
|                                                                                |
| +----------------------+ +----------------------+ +----------------------+      |
| | Discovery            | | Ready for Dev        | | Implemented          |      |
| | 12                   | | 9                    | | 14                   |      |
| |                      | |                      | |                      |      |
| | +------------------+ | | +------------------+ | | +------------------+ |      |
| | | ST-101 Checkout | | | | ST-104 Cart pay | | | | ST-088 Login SSO | |      |
| | | conf 72%        | | | | conf 91%        | | | | conf 88%        | |      |
| | | evidence 4     | | | | PR #123 open    | | | | code mapped     | |      |
| | | drift medium   | | | | needs review    | | | | released? no    | |      |
| | +------------------+ | | +------------------+ | | +------------------+ |      |
| |                      | |                      | |                      |      |
| +----------------------+ +----------------------+ +----------------------+      |
|                                                                                |
| +----------------------+                                                        |
| | Released             |                                                        |
| | 7                    |                                                        |
| | +------------------+ |                                                        |
| | | ST-055 Search   | |                                                        |
| | | conf 95%        | |                                                        |
| | | evidence 5      | |                                                        |
| | +------------------+ |                                                        |
| +----------------------+                                                        |
+--------------------------------------------------------------------------------+
```

Board card anatomy:

```text
+----------------------------------+
| ST-104  Cart payment             |
| domain: billing   milestone: mvp |
| confidence: 91%   drift: low     |
|                                  |
| Evidence                         |
| docs 3 | tickets 1 | PR 1 | code 2 |
|                                  |
| [Open] [Refresh] [Export]        |
+----------------------------------+
```

## 3. Story Detail / Context Package

Primary use: one place to inspect intent, tickets, implementation, evidence, and open review gaps.

```text
+--------------------------------------------------------------------------------+
| ST-104 Cart payment                                        [Refresh] [Export]   |
| Status: Ready for Dev   Confidence: 91%   Drift: Low   Owner: Unassigned        |
+--------------------------------------------------------------------------------+
| Tabs: [Spec / Background] [Evidence] [Tickets] [Code Context] [Agent Log]      |
+--------------------------------------------------------------------------------+
| Left: selected tab content                          | Right: evidence rail      |
|                                                     |                           |
| +-------------------------------------------------+ | +-----------------------+ |
| | User Story                                     | | | Source Health         | |
| | As a shopper, I want to pay from the cart...   | | | Docs: fresh           | |
| |                                                 | | | GitHub: 12 min ago    | |
| | Acceptance Criteria                            | | | Review: needed        | |
| | - Can review cart total                        | | +-----------------------+ |
| | - Can choose payment method                    | |                           |
| | - Can see confirmation                         | | +-----------------------+ |
| +-------------------------------------------------+ | | Citations             | |
|                                                     | | 1. Product brief      | |
| +-------------------------------------------------+ | | 2. PR #123            | |
| | Agent Summary                                   | | | 3. Commit a1b2c3d     | |
| | To-Be is supported by 3 docs. As-Is has PR...   | | +-----------------------+ |
| +-------------------------------------------------+ |                           |
+--------------------------------------------------------------------------------+
```

## 4. Spec / Background Tab

```text
+--------------------------------------------------------------------------------+
| Spec / Background                                                               |
+--------------------------------------------------------------------------------+
| +------------------------------------------+ +--------------------------------+ |
| | Extracted Requirement                    | | Acceptance Criteria            | |
| | - Checkout must support card payment     | | [x] cart total shown           | |
| | - Confirmation must be explicit          | | [x] payment method selected    | |
| | - Mobile flow is in scope                | | [ ] confirmation screen tested | |
| +------------------------------------------+ +--------------------------------+ |
|                                                                                |
| +----------------------------------------------------------------------------+ |
| | Source snippets                                                             | |
| | Product brief: "...cart confirmation..."                                    | |
| | Imported doc: "...MVP billing milestone..."                                 | |
| +----------------------------------------------------------------------------+ |
+--------------------------------------------------------------------------------+
```

## 5. Tickets Tab

```text
+--------------------------------------------------------------------------------+
| Tickets                                                                         |
+--------------------------------------------------------------------------------+
| Provider filters: [All] [Jira] [Linear] [Imported Docs]                         |
|                                                                                |
| +-------------+----------------------------+------------+--------------------+ |
| | Ticket      | Title                      | Status     | Acceptance Criteria | |
| +-------------+----------------------------+------------+--------------------+ |
| | PROJ-104    | Cart payment               | In Progress| 3 matched / 1 gap   | |
| | PROJ-141    | Payment confirmation copy  | To Do      | 1 matched / 0 gap   | |
| +-------------+----------------------------+------------+--------------------+ |
|                                                                                |
| [Link ticket] [Ask agent to reconcile ticket gaps]                              |
+--------------------------------------------------------------------------------+
```

## 6. Code Context Tab

```text
+--------------------------------------------------------------------------------+
| Code Context                                                                    |
+--------------------------------------------------------------------------------+
| Repo: enostech/demo-shop        Branch: feature/cart-payment       PR #123 Open |
|                                                                                |
| +-----------------------------+ +---------------------------------------------+ |
| | Mapping                     | | Agent Code Summary                          | |
| | main              a1b2c3d   | | As-Is implements cart total and method...   | |
| | feature/cart-pay  e4f5g6h   | | Missing confirmation assertion.             | |
| | fix/bug-y         e467g8h   | | Risk: UI copy differs from product brief.   | |
| +-----------------------------+ +---------------------------------------------+ |
|                                                                                |
| Changed files                                                                  |
| +----------------------------------------------------------------------------+ |
| | app/pages/cart.vue                          matched AC: cart total          | |
| | app/components/PaymentMethodPicker.vue      matched AC: method selection    | |
| | tests/e2e/cart-payment.spec.ts              missing confirmation assertion  | |
| +----------------------------------------------------------------------------+ |
+--------------------------------------------------------------------------------+
```

## 7. Evidence Tab

```text
+--------------------------------------------------------------------------------+
| Evidence                                                                        |
+--------------------------------------------------------------------------------+
| Story: ST-104 Cart payment                Coverage: 4 citations / 3 AC mapped  |
| [Refresh evidence] [Open source] [Export citations]                             |
|                                                                                |
| +---------------------+ +---------------------+ +---------------------+        |
| | Product brief       | | Imported ticket     | | GitHub PR #123      |        |
| | FileSpace doc       | | FileSpace doc       | | branch feature/...  |        |
| | supports AC 1,2     | | supports AC 3       | | maps AC 1,2         |        |
| +---------------------+ +---------------------+ +---------------------+        |
|                                                                                |
| Evidence table                                                                  |
| +-------+--------------------------------------------+-----------------------+ |
| | Type  | Source                                     | Coverage / Gap        | |
| | doc   | Product brief billing section              | cart total, method    | |
| | ticket| PROJ-104 imported ticket                   | confirmation copy     | |
| | code  | app/pages/cart.vue                         | cart total only       | |
| | agent | generation trace                           | needs AC 3 review     | |
| +-------+--------------------------------------------+-----------------------+ |
+--------------------------------------------------------------------------------+
```

## 8. Agent Run Center

Primary use: make autonomous story generation transparent.

```text
+--------------------------------------------------------------------------------+
| Generate Stories                                                                |
+--------------------------------------------------------------------------------+
| Inputs                                                                          |
| +-----------------------------+ +---------------------------------------------+ |
| | Knowledge FileSpace         | | GitHub Repository                           | |
| | [Default product space v]   | | [org/repo v]                                | |
| | Docs: 128 indexed           | | Branch: main                                | |
| +-----------------------------+ +---------------------------------------------+ |
|                                                                                |
| Options                                                                         |
| [x] Refresh To-Be from Agent Search                                             |
| [x] Refresh As-Is from GitHub                                                   |
| [x] Detect drift                                                                |
| [x] Mark unknowns as needs_review instead of guessing                           |
|                                                                                |
| [Start generation]                                                              |
+--------------------------------------------------------------------------------+
| Run log                                                                         |
| 10:01 Agent Search: extracted 18 candidate stories                              |
| 10:02 GitHub: scanned PR #123 and 21 changed files                              |
| 10:03 Drift: 5 stories need review                                              |
| 10:04 Firestore: saved 42 stories                                               |
+--------------------------------------------------------------------------------+
```

## 9. Source Setup

This should reuse the existing EN AIstudio knowledge screens instead of creating a new ingestion UI from scratch.

```text
+--------------------------------------------------------------------------------+
| VibeControl > Sources                                                           |
+--------------------------------------------------------------------------------+
| +----------------------------------+ +----------------------------------------+ |
| | Knowledge Sources                | | Code Sources                           | |
| | Reuse EN AIstudio FileSpace      | | GitHub App / PAT for MVP               | |
| |                                  | |                                        | |
| | [Open Knowledge Setup]           | | Repo: [org/repo]                       | |
| | [View Indexed Documents]         | | Branch: [main]                         | |
| |                                  | | [Connect GitHub] [Test connection]     | |
| +----------------------------------+ +----------------------------------------+ |
|                                                                                |
| +----------------------------------+ +----------------------------------------+ |
| | Ticket Sources                   | | Export Targets                         | |
| | MVP: imported docs or CSV        | | JSON / Markdown first                  | |
| | Later: Jira / Linear OAuth       | |                                        | |
| | [Import ticket file]             | | [Copy Markdown] [Download JSON]        | |
| +----------------------------------+ +----------------------------------------+ |
+--------------------------------------------------------------------------------+
```

## 10. AI Editor Context Export

```text
+--------------------------------------------------------------------------------+
| Export Context Bundle                                                           |
+--------------------------------------------------------------------------------+
| Story: ST-104 Cart payment                                                      |
|                                                                                |
| Bundle contents                                                                 |
| [x] User story and acceptance criteria                                          |
| [x] Source citations from Agent Search                                          |
| [x] Ticket links and current status                                             |
| [x] GitHub file and PR mapping                                                  |
| [x] Latest generation trace and unresolved review gaps                           |
|                                                                                |
| Delivery                                                                         |
| ( ) Copy markdown                                                               |
| ( ) Download JSON                                                               |
| (*) MCP/OAuth endpoint                                                          |
|                                                                                |
| Endpoint                                                                        |
| https://.../vibe-control/mcp/stories/ST-104                                     |
|                                                                                |
| [Copy endpoint] [Regenerate bundle]                                             |
+--------------------------------------------------------------------------------+
```

## 11. Route Draft

```text
/admin/vibe-control
  Story board / dashboard

/admin/vibe-control/sources
  Source setup for FileSpace, GitHub, tickets, and export targets

/admin/vibe-control/stories/:storyId
  Story detail package

/admin/vibe-control/runs/:runId
  Agent run detail and logs
```

## 12. Initial Component Draft

```text
app/pages/admin/vibe-control/index.vue
app/pages/admin/vibe-control/sources.vue
app/pages/admin/vibe-control/stories/[storyId].vue
app/pages/admin/vibe-control/runs/[runId].vue

app/components/vibeControl/VibeControlStoryBoard.vue
app/components/vibeControl/VibeControlStoryCard.vue
app/components/vibeControl/VibeControlStoryDetail.vue
app/components/vibeControl/VibeControlEvidenceRail.vue
app/components/vibeControl/VibeControlSourceSetup.vue
app/components/vibeControl/VibeControlAgentRunCenter.vue

app/stores/vibeControl.ts
app/types/models/vibeControl.ts
```
