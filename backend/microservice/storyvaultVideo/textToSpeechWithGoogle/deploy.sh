#!/bin/bash

# 設定
SERVICE_NAME="${SERVICE_NAME:-storyvault-text-to-speech-with-google}"
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

# Text-to-Speech APIの有効化確認
log_info "Checking if Text-to-Speech API is enabled..."
TTS_API_STATUS=$(gcloud services list --enabled --filter="name:texttospeech.googleapis.com" --format="value(name)" 2>/dev/null)
if [ -z "$TTS_API_STATUS" ]; then
    log_info "Enabling Text-to-Speech API..."
    gcloud services enable texttospeech.googleapis.com
    if [ $? -ne 0 ]; then
        log_error "Failed to enable Text-to-Speech API"
        exit 1
    fi
fi

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
BUILD_API_STATUS=$(gcloud services list --enabled --filter="name:cloudbuild.googleapis.com" --format="value(name)" 2>/dev/null)
if [ -z "$BUILD_API_STATUS" ]; then
    log_info "Enabling Cloud Build API..."
    gcloud services enable cloudbuild.googleapis.com
    if [ $? -ne 0 ]; then
        log_error "Failed to enable Cloud Build API"
        exit 1
    fi
fi

# Chirp 3 HD (Cloud TTS) 用 IAM: デフォルトサービスアカウントに cloudtts.user を付与
log_info "Granting roles/cloudtts.user to Cloud Run service account..."
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)' 2>/dev/null)
if [ -n "$PROJECT_NUMBER" ]; then
    DEFAULT_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${DEFAULT_SA}" \
        --role="roles/cloudtts.user" \
        --quiet
else
    log_info "Warning: Could not get project number, skipping IAM binding. Grant roles/cloudtts.user manually if needed."
fi

# Cloud Build: キャッシュ廃棄・毎回フルリビルド（requirements.txt 変更を確実に反映）
IMAGE_URL="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"
log_info "Building container image (no cache, fresh build)..."
gcloud builds submit --config=cloudbuild.yaml --substitutions="_SERVICE_NAME=$SERVICE_NAME" --project=$PROJECT_ID .

if [ $? -ne 0 ]; then
    log_error "Failed to build container image"
    exit 1
fi

# Cloud Runにデプロイ
log_info "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_URL \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --concurrency 20 \
    --max-instances 10 \
    --project=$PROJECT_ID \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID"

if [ $? -ne 0 ]; then
    log_error "Failed to deploy to Cloud Run"
    exit 1
fi

# サービスURLを取得
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project=$PROJECT_ID --format 'value(status.url)')

log_info "Deployment successful!"
log_info "Service URL: $SERVICE_URL"
log_info "Health check endpoint: $SERVICE_URL/health"
log_info "Synthesize endpoint: $SERVICE_URL/synthesize"
log_info "List voices endpoint: $SERVICE_URL/voices"
log_info "Test synthesize endpoint: $SERVICE_URL/test-synthesize"
