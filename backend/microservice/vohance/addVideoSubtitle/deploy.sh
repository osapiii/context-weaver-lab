#!/bin/bash

# Deployment script for addVideoSubtitle Cloud Run service

set -e

# Configuration
SERVICE_NAME="addvideosubtitle"
REGION="asia-northeast1"
PROJECT_ID="vohance-dev"
MEMORY="8Gi"  # 動画処理と字幕追加のためメモリを増強（2Gi → 8Gi）
CPU="2"  # CPUも増強して処理速度向上
TIMEOUT="600s"
MAX_INSTANCES="10"
CONCURRENCY="5"

echo "🚀 Deploying $SERVICE_NAME to Cloud Run..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Memory: $MEMORY"
echo "   CPU: $CPU"
echo "   Timeout: $TIMEOUT"

gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --project $PROJECT_ID \
  --memory $MEMORY \
  --cpu $CPU \
  --timeout $TIMEOUT \
  --max-instances $MAX_INSTANCES \
  --concurrency $CONCURRENCY \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,SERVICE_NAME=$SERVICE_NAME"

echo "✅ Deployment complete!"
echo "🌐 Service URL:"
gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format='value(status.url)'
