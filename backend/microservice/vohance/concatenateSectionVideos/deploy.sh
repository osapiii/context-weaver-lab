#!/bin/bash

# 設定
SERVICE_NAME="concatenate-section-videos"
REGION="asia-northeast1"
PROJECT_ID="vohance-dev"

# 色付きログ出力用の関数
log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# プロジェクトIDの確認
if [ -z "$PROJECT_ID" ]; then
    log_error "Project ID is not set. Please set GOOGLE_CLOUD_PROJECT environment variable or run 'gcloud config set project YOUR_PROJECT_ID'"
    exit 1
fi

log_info "Deploying $SERVICE_NAME to project $PROJECT_ID in region $REGION"

# 必要なAPIの有効化確認
log_info "Checking if required APIs are enabled..."

# Cloud Storage API
STORAGE_API_STATUS=$(gcloud services list --enabled --filter="name:storage.googleapis.com" --format="value(name)" 2>/dev/null)
if [ -z "$STORAGE_API_STATUS" ]; then
    log_info "Enabling Cloud Storage API..."
    gcloud services enable storage.googleapis.com
    if [ $? -ne 0 ]; then
        log_error "Failed to enable Cloud Storage API"
        exit 1
    fi
fi

# Firestore API
FIRESTORE_API_STATUS=$(gcloud services list --enabled --filter="name:firestore.googleapis.com" --format="value(name)" 2>/dev/null)
if [ -z "$FIRESTORE_API_STATUS" ]; then
    log_info "Enabling Firestore API..."
    gcloud services enable firestore.googleapis.com
    if [ $? -ne 0 ]; then
        log_error "Failed to enable Firestore API"
        exit 1
    fi
fi

# Cloud Build API
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
IMAGE_URL="gcr.io/$PROJECT_ID/$SERVICE_NAME"
log_info "Building container image..."
gcloud builds submit --tag $IMAGE_URL --project=$PROJECT_ID

if [ $? -ne 0 ]; then
    log_error "Failed to build container image"
    exit 1
fi

# Cloud Runにデプロイ（動画処理のため多めのリソースを割り当て）
# 高解像度動画(例:3420x2212)の7セクション連結で2048MiB超の使用実績あり、2Gi→8Gi/CPU2→4にスペックアップ
log_info "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_URL \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 8Gi \
    --cpu 4 \
    --timeout 600 \
    --concurrency 5 \
    --max-instances 10 \
    --project=$PROJECT_ID \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,DEBUG=false,MAX_VIDEO_SIZE_MB=1000,MAX_SEGMENTS=100"

if [ $? -ne 0 ]; then
    log_error "Failed to deploy to Cloud Run"
    exit 1
fi

# サービスURLを取得
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project=$PROJECT_ID --format 'value(status.url)')

log_info "Deployment successful!"
log_info "Service URL: $SERVICE_URL"
log_info "Health check endpoint: $SERVICE_URL/health"
log_info "Concatenate video endpoint: $SERVICE_URL/concatenate"
log_info ""
log_info "Example request:"
log_info 'curl -X POST '$SERVICE_URL'/concatenate \'
log_info '  -H "Content-Type: application/json" \'
log_info '  -d "{"sectionVideoPaths":[{"bucketName":"your-bucket","filePath":"section1.mp4"}],"outputBucketName":"your-bucket","outputFilePath":"output/merged.mp4","videoId":"video123","projectId":"project123"}"'
