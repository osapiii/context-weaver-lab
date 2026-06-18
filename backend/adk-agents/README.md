# EN AIstudio ADK Agents

EN AIstudioの **新 3 モード** (writing / sheet / image) を ADK で実装し、
各 mode を独立した Cloud Run service として deploy する.

## モード一覧

| mode    | service          | エージェント役 | tools                                                     |
| ------- | ---------------- | ------------- | --------------------------------------------------------- |
| writing | `en-aistudio-writing-agent` | 文章生成     | `search_knowledge` (FileSearch / Vertex AI Search)        |
| sheet   | `en-aistudio-sheet-agent`   | シート編集   | `search_knowledge` + Sheets API tools                     |
| image   | `en-aistudio-image-agent`   | 画像生成     | `search_knowledge` + `generate_image` (Imagen 3 on Vertex) |

| guide   | `en-aistudio-adk-agent` (unified) | 操作ガイド | `VertexAiSearchTool` (platform datastore `en-aistudio-platform-guide`) |

guide は全ユーザー共通の Agent Search datastore を参照する (組織 FileSpace とは別).
intent 分類のみ frontend 直 Gemini. 1 ターン目以降の guide 本体は ADK SSE.

## マルチテナント

ADK の deploy 自体は **mode ごとに 1 service** (= 3 service 合計). 組織分離は
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
└── image/
    ├── (同構成)
    ├── agent.py
    ├── prompts.py
    └── openai_image_tools.py
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

## デプロイ (mode ごと)

```bash
cd backend/adk-agents/writing
gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=asia-northeast1
```

deploy 後の URL を EN AIstudio frontend の env に登録:

```bash
# .env (EN AIstudio frontend)
NUXT_PUBLIC_EN_AISTUDIO_ADK_WRITING_URL=https://en-aistudio-writing-agent-xxx.a.run.app
NUXT_PUBLIC_EN_AISTUDIO_ADK_SHEET_URL=https://en-aistudio-sheet-agent-xxx.a.run.app
NUXT_PUBLIC_EN_AISTUDIO_ADK_IMAGE_URL=https://en-aistudio-image-agent-xxx.a.run.app
```

3 つ全て同じドメインなら `NUXT_PUBLIC_EN_AISTUDIO_ADK_BASE_URL` 1 個でも可.

## ローカル起動

```bash
cd backend/adk-agents/writing
pip install -r ../common/requirements.txt -r requirements.txt
GOOGLE_CLOUD_PROJECT=en-aistudio-development \
  GOOGLE_CLOUD_LOCATION=us-central1 \
  uvicorn server:app --reload --port 8081
```
