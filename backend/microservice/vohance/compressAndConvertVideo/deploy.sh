#!/bin/bash
SERVICE_NAME="compress-and-convert-video"
REGION="asia-northeast1"
PROJECT_ID="vohance-dev"

log_info() { echo -e "\033[0;32m[INFO]\033[0m $1"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

[ -z "$PROJECT_ID" ] && { log_error "PROJECT_ID not set"; exit 1; }
log_info "Deploying $SERVICE_NAME to $PROJECT_ID"

IMAGE_URL="gcr.io/$PROJECT_ID/$SERVICE_NAME"
log_info "Building..."
gcloud builds submit --tag $IMAGE_URL --project=$PROJECT_ID || { log_error "Build failed"; exit 1; }

log_info "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_URL \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 8 \
    --timeout 600 \
    --project=$PROJECT_ID \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,DEBUG=false,MAX_VIDEO_SIZE_MB=1000" \
    || { log_error "Deploy failed"; exit 1; }

SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project=$PROJECT_ID --format 'value(status.url)')
log_info "Deployment successful! URL: $SERVICE_URL"
