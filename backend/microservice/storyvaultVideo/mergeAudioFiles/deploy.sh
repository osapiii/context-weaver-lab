#!/bin/bash

# 設定
SERVICE_NAME="${SERVICE_NAME:-storyvault-merge-audio-files}"
REGION="${REGION:-asia-northeast1}"
PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-storyvault-dev}}"

# 色付きログ出力用の関数
log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# プロジェクトIDの確認
if [ -z "$PROJECT_ID" ]; then
    log_error "Project ID is not set. Please run 'gcloud config set project YOUR_PROJECT_ID'"
    exit 1
fi

log_info "Deploying $SERVICE_NAME to project $PROJECT_ID in region $REGION"

# Cloud Storage APIの有効化確認
log_info "Checking if Cloud Storage API is enabled..."
STORAGE_API_STATUS=$(gcloud services list --enabled --filter="name:storage.googleapis.com" --format="value(name)" 2>/dev/null)
if [ -z "$STORAGE_API_STATUS" ]; then
    log_info "Enabling Cloud Storage API..."
    gcloud services enable storage.googleapis.com
    if [ $? -ne 0 ]; then
        log_error "Failed to enable Cloud Storage API"
        exit 1
    fi
fi

# Cloud Build APIの有効化確認
log_info "Checking if Cloud Build API is enabled..."
BUILD_API_STATUS=$(gcloud services list --enabled --filter="name:cloudbuild.googleapis.com" --format="value(name)" 2>/dev/null)
if [ -z "$BUILD_API_STATUS" ]; then
    log_info "Enabling Cloud Build API..."
    gcloud services enable cloudbuild.googleapis.com
    if [ $? -ne 0 ]; then
        log_error "Failed to enable Cloud Build API"
        exit 1
    fi
fi

# Cloud Buildを使用してイメージをビルド
log_info "Building container image using Cloud Build..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

if [ $? -ne 0 ]; then
    log_error "Failed to build container image"
    exit 1
fi

# Cloud Runにデプロイ
log_info "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --timeout 900 \
    --concurrency 10 \
    --max-instances 5 \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,LOG_LEVEL=INFO,DEBUG_MODE=false,MAX_FILE_COUNT=20,MAX_BUFFER_SECONDS=10.0,MAX_TOTAL_DURATION_MINUTES=30,OUTPUT_BITRATE=192k,TEMP_DIR=/tmp/audio_merge"

if [ $? -ne 0 ]; then
    log_error "Failed to deploy to Cloud Run"
    exit 1
fi

# サービスURLを取得
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

log_info "Deployment successful!"
log_info "Service URL: $SERVICE_URL"
log_info "Health check endpoint: $SERVICE_URL/health"
log_info "Merge audio endpoint: $SERVICE_URL/merge-audio"
log_info ""
log_info "Test commands:"
log_info "curl -X GET $SERVICE_URL/health"
log_info ""
log_info "curl -X POST $SERVICE_URL/merge-audio \\"
log_info "  -H \"Content-Type: application/json\" \\"
log_info "  -d '{"
log_info "    \"audio_files\": [\"gs://your-bucket/audio1.mp3\", \"gs://your-bucket/audio2.wav\"],"
log_info "    \"buffer_seconds\": 2.0,"
log_info "    \"output_gcs_filepath\": \"gs://your-bucket/merged_output.mp3\""
log_info "  }'"
