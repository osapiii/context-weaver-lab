#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-en-aistudio-development}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-vohance-trim-silence-video}"

gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --source . \
  --allow-unauthenticated \
  --memory 8Gi \
  --cpu 4 \
  --timeout 1200 \
  --concurrency 1 \
  --max-instances 10 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},SERVICE_NAME=${SERVICE_NAME}"
