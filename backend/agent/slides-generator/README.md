# Slides Generator Agent (vendored)

EN AIstudio の「AI でリサーチ」機能を駆動する ADK エージェント。**ENOSTECH-KNOWLEDGE-SPACE
リポジトリのコードを EN AIstudio 用に vendoring し、Firebase Auth / BYOK / Firestore Session /
GCS アーティファクト配信のレイヤーを追加したもの**。

## 概要

- **エージェント本体**: 学習デッキ (PPTX) を 4 フェーズで自動生成する `google-adk` ベースの Coordinator + 2 SubAgent + 18 tool 構成
- **デプロイ先**: `en-aistudio-development` GCP プロジェクトの Cloud Run (`enostech-slides-agent`, `asia-northeast1`)
- **認証**: Firebase Auth ID Token (EN AIstudio フロントが付与)
- **モデル**: Gemini API (BYOK — 各ユーザーが EN AIstudio 設定画面で登録した API キーを使用、Cloud Run の SA で Vertex AI を叩く方式は使わない)
- **セッション**: Firestore `organizations/{orgId}/spaces/{spaceId}/adkSessions/{sessionId}` (`appName=slides-generator`) — API には `organizationId` / `spaceId` 必須。未指定時は Cloud Run env `ADK_DEFAULT_ORGANIZATION_ID` / `ADK_DEFAULT_SPACE_ID` を参照 — [`backend/adk-agents/common/firestore_session_service.py`](../../adk-agents/common/firestore_session_service.py)
- **アーティファクト**: ADK `GcsArtifactService`（`ADK_ARTIFACT_BUCKET`、blob パス `{appName}/{uid}/{sessionId}/{filename}/{version}`）— [`backend/adk-agents/common/artifact_ui_bridge.py`](../../adk-agents/common/artifact_ui_bridge.py)
- **HTTP**: `/v1/sessions/*` + `POST /v1/sessions/{id}/run` (SSE)

## ディレクトリ

```
backend/agent/slides-generator/
├── README.md                       # このファイル
├── Dockerfile                      # Cloud Run 用 hybrid image (Python + Node + LibreOffice)
├── cloudbuild.yaml                 # Cloud Build → Cloud Run デプロイ
├── requirements.txt                # FastAPI + ADK + Firebase Admin + GCP クライアント
├── server.py                       # FastAPI（common session/artifact runtime + BYOK）
├── byok_patch.py                   # google.genai.Client を contextvar 連動に差替
├── adk/                            # ★ ENOSTECH agents-sandbox/adk から vendoring
│   ├── agent.py
│   ├── config.py
│   ├── auth.py
│   ├── agent_tools/
│   ├── sub_agents/
│   ├── schemas/
│   ├── plan_skeletons/
│   ├── prompts/
│   ├── docs/
│   ├── tests/
│   └── main.py                     # CLI (`python -m adk.main e2e ...`); EN AIstudio では未使用
└── skills/
    ├── enostech-slides/            # ★ build-deck.js v12 (Node + Python subprocess)
    └── enostech-svg-diagram/       # ★ SVG レンダラ
```

`★` 付きディレクトリは ENOSTECH-KNOWLEDGE-SPACE からの **vendored content**。
EN AIstudio のコードと混ぜず、上書き同期で更新する (詳細: 「同期手順」セクション)。

## アーキテクチャ

```
[EN AIstudio Frontend (Nuxt)]
    │  Authorization: Bearer <Firebase ID Token>
    ▼
[Cloud Run: enostech-slides-agent]
  FastAPI (server.py)
    1. Firebase Admin で ID Token 検証
    2. users/{uid}/secrets/geminiApiKey を Firestore read
    3. byok_patch.current_user_api_key.set(api_key)
    4. ADK Runner(root_agent, FirestoreSessionService).run_async(...)
       → google.adk.runners.Runner が google.genai.Client() を作る瞬間に
         BYOK パッチが contextvar から api_key を inject
    5. tool 完了 event の file path を GCS にアップロード → 署名 URL
    6. Event を SSE chunk として frontend にストリーミング
```

## ローカル開発

### 0. 依存をホストにインストール (Cloud Run と同じ stack を入れる)

```bash
# Python deps
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r backend/agent/slides-generator/requirements.txt

# Node deps (skill v12 用)
cd backend/agent/slides-generator/skills/enostech-slides
npm ci
cd -

# LibreOffice / poppler は brew で
brew install --cask libreoffice
brew install poppler
```

### 1. Docker でローカル起動 (推奨)

```bash
docker build -t en-aistudio-slides-agent:dev backend/agent/slides-generator/

docker run --rm -p 8080:8080 \
  -v ~/.config/gcloud:/root/.config/gcloud \
  -e GOOGLE_CLOUD_PROJECT=en-aistudio-development \
  -e ADK_ARTIFACT_BUCKET=en-aistudio-development.firebasestorage.app \
  -e FIRESTORE_ADK_SESSIONS_COLLECTION=enAistudioAdkSessions \
  -e CORS_ALLOW_ORIGINS=http://localhost:3000 \
  en-aistudio-slides-agent:dev

curl http://localhost:8080/healthz                       # → 200
curl http://localhost:8080/sessions                      # → 401 (auth 必須)
```

### 2. 認証付きで叩く

EN AIstudio の dev ユーザーで Firebase Auth に SignIn し、ID Token を取得して `Authorization: Bearer ...` を付ける。

ユーザーは事前に EN AIstudio の **設定 > API キー** ページで Gemini API キーを登録しておく必要がある (未登録だと `400 GEMINI_API_KEY_NOT_REGISTERED`)。

## デプロイ (en-aistudio-development)

### 初回セットアップ (1 回限り)

Firebase Storage デフォルトバケット (`en-aistudio-development.firebasestorage.app`) を使うので、バケット自体の作成は Firebase 側で完了済み。SA への権限付与のみ実施。

```bash
BUCKET=en-aistudio-development.firebasestorage.app
SA=enostech-slides-agent@en-aistudio-development.iam.gserviceaccount.com

# Service Account
gcloud iam service-accounts create enostech-slides-agent \
  --display-name="Slides Agent" --project=en-aistudio-development
gcloud projects add-iam-policy-binding en-aistudio-development \
  --member="serviceAccount:$SA" --role="roles/datastore.user"
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"
gcloud iam service-accounts add-iam-policy-binding $SA \
  --member="serviceAccount:$SA" --role="roles/iam.serviceAccountTokenCreator"

# (任意) アーティファクト 30 日 lifecycle: Firebase コンソール or
#        gcloud storage buckets update gs://$BUCKET --lifecycle-file=/tmp/lifecycle.json
#        を必要に応じて。Firebase 経由でアップする他のファイルも一律削除されるので注意。
```

### 毎回のデプロイ

```bash
gcloud builds submit \
  --config=backend/agent/slides-generator/cloudbuild.yaml \
  --project=en-aistudio-development \
  backend/agent/slides-generator

# デプロイ後、フロント側 .env にこの URL を書く
gcloud run services describe enostech-slides-agent \
  --region=asia-northeast1 --project=en-aistudio-development \
  --format='value(status.url)'
```

## ENOSTECH-KNOWLEDGE-SPACE からの同期手順

Drive 上の `agents-sandbox/adk` と `skills/{enostech-slides,enostech-svg-diagram}` が
"上流" になる。エージェントロジックの変更は Drive 側で行い、本 vendored ツリーには
**rsync で上書き同期**する。

```bash
DRIVE_ROOT="/Users/masahiro.osanai/Library/CloudStorage/GoogleDrive-qlavis.agent@enostech.co.jp/その他のパソコン/マイ Mac/ENOSTECH-KNOWLEDGE-SPACE"
DEST=backend/agent/slides-generator

rsync -a --delete \
  --exclude='__pycache__' --exclude='*.pyc' --exclude='.DS_Store' \
  "$DRIVE_ROOT/agents-sandbox/adk/" "$DEST/adk/"
rsync -a --delete \
  --exclude='node_modules' --exclude='__pycache__' --exclude='*.pyc' --exclude='.DS_Store' \
  "$DRIVE_ROOT/skills/enostech-slides/" "$DEST/skills/enostech-slides/"
rsync -a --delete \
  "$DRIVE_ROOT/skills/enostech-svg-diagram/" "$DEST/skills/enostech-svg-diagram/"
```

**ローカル改変禁止**: `adk/` と `skills/` 配下は Drive 側のみで編集する (誤って EN AIstudio で
書き換えると次回 rsync で消える)。EN AIstudio 側の連携コードは `server.py` /
`backend/adk-agents/common/`（session + GCS artifact）+ `byok_patch.py` + `server.py`
させる方針。

## 認証 / 権限まとめ

| who | what | role |
|-----|------|------|
| EN AIstudio フロント | `/sessions/*` への HTTP リクエスト | Firebase Auth ID Token (`Authorization: Bearer ...`) |
| Cloud Run SA | Firestore `enAistudioAdkSessions/*` への R/W | `roles/datastore.user` |
| Cloud Run SA | Firestore `users/{uid}/secrets/geminiApiKey` の read | `roles/datastore.user` |
| Cloud Run SA | Firebase Storage `gs://en-aistudio-development.firebasestorage.app/*` upload + (任意) signed URL | `roles/storage.objectAdmin` + (signed URL を併発行したい場合のみ) `roles/iam.serviceAccountTokenCreator` (self) |
| エンドユーザー | Gemini API 呼び出し | ユーザー自身が登録した API キー (BYOK) |

## 既知の制約

- **subprocess の長時間化**: build-deck.js + LibreOffice の組み合わせは Phase 3 で 5〜15 分かかる。`timeout=3600` で凌いでいるが、超過した場合は Cloud Tasks 化検討
- **gemini-3-pro-preview のクォータ**: SVG / Visual QA で使う pro preview モデルは RPM 制限が厳しいケースあり。BYOK なので各ユーザーのクォータに依存する
- **subprocess は contextvar が効かない**: Node や LibreOffice の subprocess は Python の contextvar を継承しない。エージェント本体の Gemini 呼び出しは Python 内 → ✅ 効く / subprocess 内で Gemini を叩いている部分は env var 経由 → `server.py` の `require_user` 内で `os.environ["GEMINI_API_KEY"] = api_key` も同時にセットして対応 (Cloud Run concurrency=4 なので最後にセットされたキーで他リクエストが汚染される可能性がゼロではない → 後続で concurrency=1 に絞るか、subprocess 呼び出しを per-call env_var 渡しにリファクタする)
