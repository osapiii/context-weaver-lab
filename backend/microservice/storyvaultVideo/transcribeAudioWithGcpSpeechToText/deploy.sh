#!/bin/bash

# 設定
SERVICE_NAME="${SERVICE_NAME:-storyvault-transcribe-audio-with-gcp-speech-to-text}"
REGION="asia-northeast1"
AQUA_VOICE_SECRET_NAME="AQUA_VOICE_API_KEY"

# 色付きログ出力用の関数
log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# プロジェクトIDを取得（環境変数またはデフォルト値を使用）
PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-storyvault-dev}}"

# gcloud configのプロジェクトIDを確認（警告のみ）
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    log_info "Note: Current gcloud project is '$CURRENT_PROJECT', but deploying to '$PROJECT_ID'"
fi

# プロジェクトIDの確認
if [ -z "$PROJECT_ID" ]; then
    log_error "Project ID is not set. Please set GOOGLE_CLOUD_PROJECT environment variable or run 'gcloud config set project YOUR_PROJECT_ID'"
    exit 1
fi

log_info "Deploying $SERVICE_NAME to project $PROJECT_ID in region $REGION"

if [ -z "$AQUA_VOICE_API_KEY" ]; then
    log_error "AQUA_VOICE_API_KEY is not set. Export the Aqua Voice API key before deploying."
    exit 1
fi

# Cloud Buildを使用してイメージをビルド
log_info "Building container image..."
if ! gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME --project=$PROJECT_ID; then
    log_error "Failed to build container image"
    exit 1
fi

# サービスアカウントの設定
SERVICE_ACCOUNT="transcribe-audio-gcp-speech-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# サービスアカウントが存在するか確認、なければ作成
if ! gcloud iam service-accounts describe ${SERVICE_ACCOUNT} --project=${PROJECT_ID} > /dev/null 2>&1; then
    log_info "Creating Service Account: ${SERVICE_ACCOUNT}"
    gcloud iam service-accounts create transcribe-audio-gcp-speech-sa \
        --display-name="Transcribe Audio with Aqua Voice Service Account" \
        --project=${PROJECT_ID}
    
    # 必要なIAMロールを付与
    log_info "Granting IAM roles..."
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/storage.objectViewer"
    
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/storage.objectCreator"
    
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/datastore.user"
else
    log_info "Using existing Service Account: ${SERVICE_ACCOUNT}"
fi

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/aiplatform.user" \
    --project=${PROJECT_ID}

# Aqua Voice APIキーをSecret Managerに登録/更新
log_info "Configuring Aqua Voice API key secret..."
if gcloud secrets describe ${AQUA_VOICE_SECRET_NAME} --project=${PROJECT_ID} > /dev/null 2>&1; then
    printf "%s" "$AQUA_VOICE_API_KEY" | gcloud secrets versions add ${AQUA_VOICE_SECRET_NAME} \
        --data-file=- \
        --project=${PROJECT_ID}
else
    printf "%s" "$AQUA_VOICE_API_KEY" | gcloud secrets create ${AQUA_VOICE_SECRET_NAME} \
        --data-file=- \
        --replication-policy="automatic" \
        --project=${PROJECT_ID}
fi

gcloud secrets add-iam-policy-binding ${AQUA_VOICE_SECRET_NAME} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --project=${PROJECT_ID}

# Cloud Runにデプロイ
log_info "Deploying to Cloud Run..."
if ! gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 600 \
    --concurrency 10 \
    --max-instances 5 \
    --service-account=${SERVICE_ACCOUNT} \
    --project=$PROJECT_ID \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,AQUA_VOICE_BASE_URL=${AQUA_VOICE_BASE_URL:-https://api.aquavoice.com/api/v1},AQUA_VOICE_MODEL=${AQUA_VOICE_MODEL:-avalon-v1.5},AQUA_VOICE_TIMEOUT=${AQUA_VOICE_TIMEOUT:-600},STORYVAULT_VIDEO_TRANSCRIBE_GEMINI_MODEL=${STORYVAULT_VIDEO_TRANSCRIBE_GEMINI_MODEL:-gemini-2.5-flash-lite},STORYVAULT_VIDEO_TRANSCRIBE_GEMINI_LOCATION=${STORYVAULT_VIDEO_TRANSCRIBE_GEMINI_LOCATION:-global}" \
    --set-secrets "AQUA_VOICE_API_KEY=${AQUA_VOICE_SECRET_NAME}:latest"; then
    log_error "Failed to deploy to Cloud Run"
    exit 1
fi

# サービスURLを取得
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project=$PROJECT_ID --format 'value(status.url)')

log_info "Deployment successful!"
log_info "Service URL: $SERVICE_URL"
log_info "Health check endpoint: $SERVICE_URL/health"
log_info "Transcribe endpoint: $SERVICE_URL/transcribe"
log_info ""
log_info "Authentication: Service Account with ADC + Aqua Voice API key from Secret Manager"
log_info "IAM Roles: Storage Object Viewer/Creator, Firestore Data Writer, Vertex AI User"
