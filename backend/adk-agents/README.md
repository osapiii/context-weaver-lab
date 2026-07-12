# EN AIstudio ADK Agents

EN AIstudio / StoryVault の ADK agents を mode ごとに実装し、
必要に応じて独立した Cloud Run service として deploy する.

## モード一覧

| mode | service | エージェント役 | tools |
| --- | --- | --- | --- |
| writing | `en-aistudio-writing-agent` | 文章生成 | `search_knowledge` (FileSearch / Vertex AI Search) |
| sheet | `en-aistudio-sheet-agent` | シート編集 | `search_knowledge` + Sheets API tools |
| image | `en-aistudio-image-agent` | 画像生成 | `search_knowledge` + image generation tools |
| consultation | `en-aistudio-consultation-agent` | 経営相談 | `search_knowledge` |
| guide | `en-aistudio-adk-agent` (unified) | 操作ガイド | `VertexAiSearchTool` (platform datastore `en-aistudio-platform-guide`) |
| storyvault_capability_structuring | `storyvault-capability-structuring-agent` | StoryVault Capability 構造化 | `read_capability_structuring_context`, `save_capability_structure` |
| storyvault_story_generation | `storyvault-story-generation-agent` | StoryVault Story 生成 | `read_story_generation_context`, `save_story_generation` |

guide は全ユーザー共通の Agent Search datastore を参照する (組織 FileSpace とは別).
intent 分類のみ frontend 直 Gemini. 1 ターン目以降の guide 本体は ADK SSE.

## マルチテナント

ADK の deploy 自体は **mode ごとに 1 service**. 組織分離は
**session state に `file_space_id` を入れる** ことで実現する.

```
Frontend → POST /v1/agents/{mode}/invoke (Authorization: Bearer <Firebase ID token>)
  Body: { session_id, user_id, organization_id, space_id, file_space_id, ... }
       ↓
ADK Runner (session state['file_space_id'] にセット)
       ↓
LlmAgent + FunctionTool(search_knowledge)
       ↓ (tool 内部で state['file_space_id'] を参照)
Vertex AI Search REST: dataStores/{file_space_id}:search
```

これで「共通 space + metatag 分離」のクロステナント漏洩リスクを避けつつ、
ADK は 1 service / mode で運用できる.

## ディレクトリ構成

```
backend/adk-agents/
├── README.md                ← 本ファイル
├── common/                  ← 全 agent で共有するモジュール
│   ├── __init__.py
│   ├── auth.py              ← Firebase ID token 検証
│   ├── file_search.py       ← Vertex AI Search を叩く FunctionTool
│   ├── request_schema.py    ← Pydantic v2 で request / SSE 型
│   ├── server_base.py       ← FastAPI app factory (mode に応じて agent 注入)
│   └── requirements.txt
├── writing/
│   ├── Dockerfile
│   ├── cloudbuild.yaml
│   ├── requirements.txt
│   ├── server.py            ← uvicorn entrypoint
│   ├── agent.py             ← writing 用 LlmAgent 定義
│   └── prompts.py
├── sheet/
│   ├── (同構成)
│   ├── agent.py
│   ├── prompts.py
│   └── sheets_tools.py
├── image/
│   ├── (同構成)
│   ├── agent.py
│   ├── prompts.py
│   └── openai_image_tools.py
├── storyvault_capability_structuring/
│   ├── Dockerfile
│   ├── cloudbuild.yaml
│   ├── server.py
│   ├── agent.py
│   ├── prompts.py
│   └── tools.py
└── storyvault_story_generation/
    ├── (同構成)
    ├── agent.py
    ├── prompts.py
    └── tools.py
```

## 環境変数 (共通)

| 変数 | 用途 |
| --- | --- |
| `GOOGLE_CLOUD_PROJECT`         | Vertex AI / Firestore / GCS |
| `GOOGLE_CLOUD_LOCATION`        | 既定 `us-central1` (Imagen / Vertex AI Search) |
| `VERTEX_SEARCH_LOCATION`       | Vertex AI Search のロケーション (例 `global` / `us`) |
| `MODEL_ID`                     | LLM (既定 `gemini-2.5-flash`) |
| `CORS_ALLOW_ORIGINS`           | カンマ区切り; EN AIstudio frontend オリジン |
| `FIREBASE_PROJECT_ID`          | Firebase Admin SDK (ADC で auto-detect) |
| `DD_LLMOBS_ENABLED`            | Datadog LLM Observability を有効化 (`true` / `false`) |
| `DD_LLMOBS_AGENTLESS_ENABLED`  | Datadog agentless 送信 (`true` 推奨) |
| `DD_LLMOBS_ML_APP`             | LLM Observability app 名 (`storyvault`) |
| `DD_SERVICE`                   | Datadog 上の論理 service 名 (`storyvault-adk-agent`) |
| `DD_ENV`                       | Datadog env (`dev` / `prod`) |
| `DD_SITE`                      | Datadog site (`ap1.datadoghq.com`) |
| `DD_API_KEY`                   | Datadog API key。Secret Manager から注入する |

Datadog API key は Cloud Build substitutions に渡さない。例:

```bash
gcloud run services update en-aistudio-adk-agent \
  --project=storyvault-dev \
  --region=asia-northeast1 \
  --update-env-vars=DD_LLMOBS_ENABLED=true \
  --update-secrets=DD_API_KEY=datadog-api-key:latest
```

## デプロイ (mode ごと)

```bash
cd backend/adk-agents/writing
gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=asia-northeast1
```

一括 deploy:

```bash
cd backend/adk-agents
PROJECT_ID=storyvault-dev REGION=asia-northeast1 ONLY=all ./deploy-all.sh
```

`storyvault_capability_structuring` / `storyvault_story_generation` は RequestDoc trigger から
internal secret header で呼ばれるため、Cloud Run IAM は public invoker を許可する。
`deploy-all.sh` 経由では deploy 後に `roles/run.invoker` を `allUsers` へ付与する。

deploy 後の URL を EN AIstudio frontend の env に登録:

```bash
# .env (EN AIstudio frontend)
NUXT_PUBLIC_EN_AISTUDIO_ADK_WRITING_URL=https://en-aistudio-writing-agent-xxx.a.run.app
NUXT_PUBLIC_EN_AISTUDIO_ADK_SHEET_URL=https://en-aistudio-sheet-agent-xxx.a.run.app
NUXT_PUBLIC_EN_AISTUDIO_ADK_IMAGE_URL=https://en-aistudio-image-agent-xxx.a.run.app
NUXT_PUBLIC_EN_AISTUDIO_ADK_STORYVAULT_CAPABILITY_STRUCTURING_URL=https://storyvault-capability-structuring-agent-xxx.a.run.app
NUXT_PUBLIC_EN_AISTUDIO_ADK_STORYVAULT_STORY_GENERATION_URL=https://storyvault-story-generation-agent-xxx.a.run.app
```

全 mode を unified service に寄せる場合は `NUXT_PUBLIC_EN_AISTUDIO_ADK_BASE_URL` 1 個でも可.

## ローカル起動

```bash
cd backend/adk-agents/writing
pip install -r ../common/requirements.txt -r requirements.txt
GOOGLE_CLOUD_PROJECT=en-aistudio-development \
  GOOGLE_CLOUD_LOCATION=us-central1 \
  uvicorn server:app --reload --port 8081
```
