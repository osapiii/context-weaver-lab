#!/usr/bin/env bash
set -euo pipefail
PROJECT_ID="${PROJECT_ID:-storyvault-dev}"
REGION="${REGION:-asia-northeast1}"
gcloud run deploy storyvault-clip-command \
  --project "${PROJECT_ID}" --region "${REGION}" --source . \
  --no-allow-unauthenticated --timeout 1800 --memory 4Gi --cpu 2 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
