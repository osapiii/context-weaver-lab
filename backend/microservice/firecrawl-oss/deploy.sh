#!/bin/bash

# Firecrawl OSS - Cloud Run Deployment Script

# 設定
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No gcloud project configured. Please run 'gcloud config set project <project-id>'${NC}"
    exit 1
fi
SERVICE_NAME="firecrawl-oss"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Firecrawl OSS Deployment ===${NC}"

# スクリプト位置を取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVICE_DIR="${SCRIPT_DIR}"

cd "${SERVICE_DIR}"

# ✅ Step 1: Dockerイメージをビルド
echo -e "${YELLOW}Building Docker image...${NC}"
gcloud builds submit --tag ${IMAGE_NAME} . || {
    echo -e "${RED}Error: Docker image build failed${NC}"
    exit 1
}

# ✅ Step 2: Cloud Run にデプロイ
echo -e "${YELLOW}Deploying to Cloud Run...${NC}"

# 環境変数の設定
# Redisは外部サービス（Cloud Memorystore等）を使用する場合はURLを指定
# 注意: Cloud Runではlocalhostにアクセスできないため、外部のRedisサービスが必要です
USE_DB_AUTHENTICATION="${USE_DB_AUTHENTICATION:-false}"

# 環境変数を構築
ENV_VARS="PORT=3002,HOST=0.0.0.0,NODE_ENV=production"
ENV_VARS="${ENV_VARS},USE_DB_AUTHENTICATION=${USE_DB_AUTHENTICATION}"

# Redis URL（設定されている場合のみ追加）
# Cloud Memorystore for Redisを使用する場合:
# export REDIS_URL="redis://[REDIS_IP]:6379"
if [ -n "$REDIS_URL" ]; then
    ENV_VARS="${ENV_VARS},REDIS_URL=${REDIS_URL}"
    echo -e "${YELLOW}Using Redis URL: ${REDIS_URL}${NC}"
else
    echo -e "${YELLOW}Warning: REDIS_URL is not set. Some features may not work without Redis.${NC}"
fi

if [ -n "$REDIS_RATE_LIMIT_URL" ]; then
    ENV_VARS="${ENV_VARS},REDIS_RATE_LIMIT_URL=${REDIS_RATE_LIMIT_URL}"
fi

# Playwright Microservice URL（別途デプロイする場合）
if [ -n "$PLAYWRIGHT_MICROSERVICE_URL" ]; then
    ENV_VARS="${ENV_VARS},PLAYWRIGHT_MICROSERVICE_URL=${PLAYWRIGHT_MICROSERVICE_URL}"
fi

# OpenAI API Key（AI機能を使用する場合）
if [ -n "$OPENAI_API_KEY" ]; then
    ENV_VARS="${ENV_VARS},OPENAI_API_KEY=${OPENAI_API_KEY}"
fi

gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 3600 \
    --max-instances 10 \
    --port 3002 \
    --set-env-vars "${ENV_VARS}" || {
    echo -e "${RED}Error: Cloud Run deployment failed${NC}"
    exit 1
}

# ✅ Step 3: デプロイ成功メッセージ
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"

# サービス URL の取得と表示
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --format 'value(status.url)')

echo -e "${GREEN}Service URL: ${SERVICE_URL}${NC}"
echo -e "${YELLOW}Test with:${NC}"
echo "curl -X GET ${SERVICE_URL}/test"
echo ""
echo -e "${YELLOW}Example crawl request (v2 API):${NC}"
echo "curl -X POST ${SERVICE_URL}/v2/crawl \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"url\": \"https://docs.firecrawl.dev\"}'"

