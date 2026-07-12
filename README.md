# StoryVault

StoryVault is a hackathon app built from the EN AIstudio foundation. It turns product intent, tickets, code, pull requests, and source evidence into a governed user-story SSOT so teams can keep the speed of AI coding while preserving delivery confidence.

This repository was cut out as a fresh repo from `en-aistudio` on 2026-06-18. The inherited base keeps the Nuxt/Firebase UI foundation, ADK agent runtime, and knowledge ingestion pipeline. New StoryVault work should proceed in this repository.

## Hackathon Context

- Event: DevOps x AI Agent Hackathon by Findy, sponsored by Google Cloud Japan.
- Submission deadline: 2026-07-10.
- Finals: 2026-08-19 at Google Shibuya Office.
- Required Google Cloud app runtime: use Cloud Run / Cloud Functions or another eligible Google Cloud execution product.
- Required Google Cloud AI technology: use Gemini API / ADK / Agent Builder / Vertex AI Search or another eligible AI product.

Source: https://findy.co.jp/4127/

## Product Docs

- [Implementation Plan](docs/hackathon/implementation-plan.md)
- [ASCII Screen Structure](docs/hackathon/screen-structure-ascii.md)

## Base Assets Reused From EN AIstudio

- Frontend: Nuxt 4, Vue 3, Pinia, Nuxt UI, Firebase Hosting, shared EN components.
- Knowledge: FileSpace document model, Drive/Web/manual ingestion, GCS mirror, Vertex AI Search / Agent Search context.
- Agents: ADK unified agent service, RequestDoc invocation, artifact publishing, request logs, citation UI.
- Operations: Firebase Auth/Firestore/Storage rules, Cloud Run microservice pattern, Workflows-oriented request tracking.

## First Implementation Target

The MVP should focus on four user-facing surfaces:

1. Story board: dynamic list view grouped by lifecycle and metadata.
2. Story detail: spec/background, evidence, tickets, code context, and agent logs in one tabbed detail view.
3. Agent run center: generate or refresh stories from knowledge + GitHub state.
4. Context export: provide story bundles to AI editors through an MCP/OAuth-compatible context endpoint.

## Local Setup

```bash
cd app
yarn install
cp .env.example .env.storyvault-dev
yarn local:dev
```

Use `.env.example` as the template for local Firebase and agent endpoints. Do not commit local `.env.*` files or local signer keys.

## Development GCP Project

- Project ID: `storyvault-dev`
- Firebase Hosting: `https://storyvault-dev.web.app`
- Unified ADK Cloud Run: `https://en-aistudio-adk-agent-mdgjayj74q-an.a.run.app`
- Firestore: `(default)` database in `asia-northeast1`
- Firebase Storage: `gs://storyvault-dev.firebasestorage.app`
- ADK artifact bucket: `gs://storyvault-dev-adk-artifacts`
- Firebase Functions codebase: `ui-backend`

Deploy the SPA to the development project:

```bash
cd app
yarn dev:deploy
```

Deploy backend Functions after creating `backend/app/.env.storyvault-dev` from `backend/app/.env.example`:

```bash
firebase deploy --only functions:ui-backend --project storyvault-dev --config firebase.json
```
