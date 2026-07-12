#!/bin/bash

# Gemini File Search - Cloud Run Deployment Script

# 設定
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No gcloud project configured. Please run 'gcloud config set project <project-id>'${NC}"
    exit 1
fi
SERVICE_NAME="context-store"
REGION="us-central1"

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Gemini File Search Deployment ===${NC}"

# スクリプト位置を取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVICE_DIR="${SCRIPT_DIR}"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ✅ Step 1: 共通モジュールをサービスディレクトリにコピー
cd "${SERVICE_DIR}"
echo -e "${YELLOW}Copying common module to service directory...${NC}"
cp -r "${REPO_ROOT}/microservice/common" ./common

# ✅ Step 2: Cleanup トラップを登録（失敗時もクリーンアップされる）
cleanup() {
    echo -e "${YELLOW}Cleaning up common module copy...${NC}"
    rm -rf "${SERVICE_DIR}/common"
}
trap cleanup EXIT

# ✅ Step 3: Cloud Run にデプロイ
echo -e "${YELLOW}Deploying directly from source using gcloud run deploy...${NC}"
echo -e "${YELLOW}Note: Using Dockerfile-based deployment${NC}"

# GEMINI_API_KEY 不要 — Discovery Engine は ADC
gcloud run deploy ${SERVICE_NAME} \
    --source . \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --allow-unauthenticated \
    --cpu 4 \
    --memory 8Gi \
    --timeout 900 \
    --max-instances 15 \
    --concurrency 8 \
    --port 8080 \
    --set-env-vars GOOGLE_CLOUD_PROJECT="${PROJECT_ID}",VERTEX_SEARCH_LOCATION=global,AGENT_SEARCH_COLLECTION=default_collection || {
    echo -e "${RED}Error: Cloud Run deployment failed${NC}"
    exit 1
}

# ✅ Step 4: デプロイ成功メッセージ
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"

# サービス URL の取得と表示
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --format 'value(status.url)')

echo -e "${GREEN}Service URL: ${SERVICE_URL}${NC}"
echo -e "${YELLOW}Test with:${NC}"
echo "curl -X POST ${SERVICE_URL}/context-store/create \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"request_id\": \"test_123\", \"input\": {}, \"operation_metadata\": {\"organization_id\": \"org_123\", \"space_id\": \"space_456\", \"requested_by\": {\"email\": \"test@example.com\", \"role\": 1}}}'"

