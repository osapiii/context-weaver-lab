#!/bin/bash

# Deployment script for mergeVideoAudioNarration Cloud Run service

set -e

# Configuration
SERVICE_NAME="mergevideoaudionarration"
REGION="asia-northeast1"
PROJECT_ID="vohance-dev"
MEMORY="16Gi"  # 高解像度動画のマージ処理高速化のため8Gi→16Giに増強
CPU="8"        # 動画・音声マージ処理のパフォーマンス向上（Cloud Run最大値）
TIMEOUT="600s"  # ガイドライン推奨値（Cloud Runマイクロサービス標準）
MAX_INSTANCES="10"
CONCURRENCY="5"

echo "🚀 Deploying $SERVICE_NAME to Cloud Run..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Memory: $MEMORY"
echo "   CPU: $CPU"
echo "   Timeout: $TIMEOUT"

# Build and deploy
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
