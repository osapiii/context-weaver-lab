#!/bin/bash

# Web Crawler - Cloud Run Deployment Script

# 設定
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No gcloud project configured. Please run 'gcloud config set project <project-id>'${NC}"
    exit 1
fi
SERVICE_NAME="web-crawler"
REGION="us-central1"

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Web Crawler Deployment ===${NC}"

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

CONTEXT_STORE_SERVICE_URL="${CONTEXT_STORE_SERVICE_URL:-https://context-store-781544707153.us-central1.run.app}"
VIBE_CONTROL_GCS_BUCKET="${VIBE_CONTROL_GCS_BUCKET:-${PROJECT_ID}.firebasestorage.app}"

# ✅ Step 3: Cloud Run にデプロイ
echo -e "${YELLOW}Deploying directly from source using gcloud run deploy...${NC}"
echo -e "${YELLOW}Note: Using Dockerfile-based deployment with Crawl4AI${NC}"
echo -e "${YELLOW}Context Store URL: ${CONTEXT_STORE_SERVICE_URL}${NC}"
echo -e "${YELLOW}Vibe Control GCS bucket: ${VIBE_CONTROL_GCS_BUCKET}${NC}"

DEPLOY_CMD="gcloud run deploy ${SERVICE_NAME} \
    --source . \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --allow-unauthenticated \
    --cpu 2 \
    --memory 8Gi \
    --timeout 3600 \
    --concurrency 1 \
    --max-instances 10 \
    --port 8080 \
    --set-env-vars CONTEXT_STORE_SERVICE_URL=${CONTEXT_STORE_SERVICE_URL},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},VIBE_CONTROL_GCS_BUCKET=${VIBE_CONTROL_GCS_BUCKET},EN_AISTUDIO_GCS_BUCKET=${VIBE_CONTROL_GCS_BUCKET}"

eval ${DEPLOY_CMD} || {
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
echo "curl ${SERVICE_URL}/health"
echo "curl -X POST ${SERVICE_URL}/workflow/run-step \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"requestId\": \"test_123\", \"requestPath\": \"organizations/org/requests/webCrawlRequests/logs/test_123\", \"step\": \"crawl\", \"input\": {\"url\": \"https://example.com\", \"bucket_name\": \"my-bucket\", \"folder_path\": \"crawled\", \"max_depth\": 2, \"max_urls\": 10, \"file_space_id\": \"fs1\"}, \"operationMetadata\": {\"organizationId\": \"org\", \"spaceId\": \"space\", \"requestedBy\": {\"email\": \"test@example.com\", \"role\": 1}}}'"
