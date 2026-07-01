#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-vibe-e2e-auth-browser}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-vibe-e2e-auth-browser}"
SHARED_SECRET="${E2E_AUTH_BROWSER_SHARED_SECRET:-}"

if [ -z "$PROJECT_ID" ]; then
  echo "PROJECT_ID or GOOGLE_CLOUD_PROJECT is required" >&2
  exit 1
fi

if [ -z "$SHARED_SECRET" ]; then
  echo "E2E_AUTH_BROWSER_SHARED_SECRET is required" >&2
  exit 1
fi

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
    --project "$PROJECT_ID" \
    --display-name "Vibe E2E Auth Browser"
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role "roles/secretmanager.admin" \
  --quiet

gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source . \
  --service-account "$SERVICE_ACCOUNT_EMAIL" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},E2E_AUTH_BROWSER_SHARED_SECRET=${SHARED_SECRET}"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
echo "Deployed: ${SERVICE_URL}"
echo "Set Firebase Functions env E2E_AUTH_BROWSER_URL=${SERVICE_URL}"
