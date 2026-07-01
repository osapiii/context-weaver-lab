#!/bin/bash

# 設定
SERVICE_NAME="${SERVICE_NAME:-vohance-ai-video-sectioning}"
REGION="${REGION:-asia-northeast1}"
PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-en-aistudio-development}}"

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

# Vertex AI API
VERTEX_API_STATUS=$(gcloud services list --enabled --filter="name:aiplatform.googleapis.com" --format="value(name)" 2>/dev/null)
if [ -z "$VERTEX_API_STATUS" ]; then
    log_info "Enabling Vertex AI API..."
    gcloud services enable aiplatform.googleapis.com
    if [ $? -ne 0 ]; then
        log_error "Failed to enable Vertex AI API"
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

# Cloud Runにデプロイ（垂直スケーリング: FFmpegマルチスレッド・WebM→MP4変換爆速化）
log_info "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_URL \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 32Gi \
    --cpu 8 \
    --timeout 1200 \
    --concurrency 3 \
    --max-instances 5 \
    --project=$PROJECT_ID \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,DEBUG=false,MAX_VIDEO_SIZE_MB=1000"

if [ $? -ne 0 ]; then
    log_error "Failed to deploy to Cloud Run"
    exit 1
fi

# サービスURLを取得
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project=$PROJECT_ID --format 'value(status.url)')

log_info "Deployment successful!"
log_info "Service URL: $SERVICE_URL"
log_info "Health check endpoint: $SERVICE_URL/health"
log_info "Auto-section endpoint: $SERVICE_URL/auto-section"
log_info ""
log_info "Example request:"
log_info 'curl -X POST '$SERVICE_URL'/auto-section \'
log_info '  -H "Content-Type: application/json" \'
log_info '  -d "{"request_id":"test123","input":{"sourceBucketName":"bucket","sourceFilePath":"path/to/video.mp4","outputBucketName":"bucket","videoId":"video123","projectId":"project123"},"systemMetadata":{"organizationId":"org123","spaceId":"space123","loggingCollectionId":"logs","loggingDocumentId":"doc123","requestedBy":{"email":"test@example.com","role":2},"isCommand":false,"isOouiCrud":true,"isLlmCall":true,"isAdminCrud":false}}"'
