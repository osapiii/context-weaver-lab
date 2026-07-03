#!/bin/bash
# GCS → FileSpace Register — Cloud Run deploy.
#
# Responsibilities (called by Workflows `gdrive-sync`):
#   - /register/diff           : GCS mirror vs Firestore documents
#   - /register/apply-batch    : gemini-file-search upload + Firestore upsert (<=10)
#   - /register/remove-batch   : gemini-file-search delete + Firestore delete (<=10)
#
# Required service account (must already exist + bound):
#   gcs-to-filespace-register@{PROJECT_ID}.iam.gserviceaccount.com
#     - roles/storage.objectViewer on Firebase Storage bucket (DRIVE_MIRROR_BUCKET)
#     - roles/datastore.user (Firestore upsert)
#     - roles/run.invoker on gemini-file-search (or unauthenticated)

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
if [ -z "${PROJECT_ID}" ]; then
  echo "Error: PROJECT_ID is not set." >&2
  exit 1
fi
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-gcs-to-filespace-register}"
FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:-${PROJECT_ID}.firebasestorage.app}"
DRIVE_MIRROR_BUCKET="${DRIVE_MIRROR_BUCKET:-${FIREBASE_STORAGE_BUCKET}}"
SA_EMAIL="${SA_EMAIL:-gcs-to-filespace-register@${PROJECT_ID}.iam.gserviceaccount.com}"
CONTEXT_STORE_SERVICE_URL="${CONTEXT_STORE_SERVICE_URL:-https://context-store-mdgjayj74q-uc.a.run.app}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== gcs-to-filespace-register deploy ==="
echo "  Project       : ${PROJECT_ID}"
echo "  Region        : ${REGION}"
echo "  Service       : ${SERVICE_NAME}"
echo "  Mirror Bucket : ${DRIVE_MIRROR_BUCKET}"
echo "  Context Store : ${CONTEXT_STORE_SERVICE_URL}"
echo "  SA            : ${SA_EMAIL}"

cd "${SCRIPT_DIR}"

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --service-account "${SA_EMAIL}" \
  --allow-unauthenticated \
  --cpu 1 \
  --memory 1Gi \
  --timeout 3600 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 10 \
  --port 8080 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},DRIVE_MIRROR_BUCKET=${DRIVE_MIRROR_BUCKET},FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET},CONTEXT_STORE_SERVICE_URL=${CONTEXT_STORE_SERVICE_URL}"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed --region "${REGION}" --project "${PROJECT_ID}" \
  --format 'value(status.url)')

echo "Service URL: ${SERVICE_URL}"
echo "Set GCS_TO_CONTEXT_STORE_REGISTER_URL=${SERVICE_URL} on the Workflows YAML / FE env."
