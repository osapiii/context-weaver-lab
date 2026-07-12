#!/bin/bash
# Drive → GCS Sync — Cloud Run deploy.
#
# Responsibilities (called by Workflows `gdrive-sync`):
#   - /scan/list-folder           : Drive 再帰列挙
#   - /scan/test-connection       : FE 動作確認
#   - /mirror/diff                : Drive list vs GCS mirror
#   - /mirror/apply-batch         : Drive download → GCS upload (<=10)
#   - /mirror/remove-batch        : GCS delete (<=10)
#
# Required service account (must already exist + bound):
#   drive-to-gcs-sync@{PROJECT_ID}.iam.gserviceaccount.com
#     - roles/storage.objectAdmin on Firebase Storage bucket (DRIVE_MIRROR_BUCKET)
#   (Drive 認証は Secret Manager の en-aistudio-drive-agent-key を /etc/sa/drive-agent-key.json にマウント)

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
if [ -z "${PROJECT_ID}" ]; then
  echo "Error: PROJECT_ID is not set." >&2
  exit 1
fi
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-drive-to-gcs-sync}"
FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:-${PROJECT_ID}.firebasestorage.app}"
DRIVE_MIRROR_BUCKET="${DRIVE_MIRROR_BUCKET:-${FIREBASE_STORAGE_BUCKET}}"
SA_EMAIL="${SA_EMAIL:-drive-to-gcs-sync@${PROJECT_ID}.iam.gserviceaccount.com}"
DRIVE_SECRET_NAME="${DRIVE_SECRET_NAME:-en-aistudio-drive-agent-key}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
WORKSPACE_ENV_FILE="${GOOGLE_WORKSPACE_ENV_FILE:-${ROOT_DIR}/backend/app/.env.storyvault-dev}"

if [ -f "${WORKSPACE_ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${WORKSPACE_ENV_FILE}"
  set +a
fi

echo "=== drive-to-gcs-sync deploy ==="
echo "  Project       : ${PROJECT_ID}"
echo "  Region        : ${REGION}"
echo "  Service       : ${SERVICE_NAME}"
echo "  Mirror Bucket : ${DRIVE_MIRROR_BUCKET}"
echo "  SA            : ${SA_EMAIL}"

cd "${SCRIPT_DIR}"

declare -a SECRET_ARGS=()
if gcloud secrets describe "${DRIVE_SECRET_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  SECRET_ARGS=(--update-secrets=/etc/sa/drive-agent-key.json="${DRIVE_SECRET_NAME}:latest")
else
  echo "  Drive SA key   : not mounted (OAuth mode)"
fi

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --service-account "${SA_EMAIL}" \
  --allow-unauthenticated \
  --cpu 2 \
  --memory 2Gi \
  --timeout 3600 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 4 \
  --port 8080 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},DRIVE_MIRROR_BUCKET=${DRIVE_MIRROR_BUCKET},FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET},GOOGLE_WORKSPACE_OAUTH_CLIENT_ID=${GOOGLE_WORKSPACE_OAUTH_CLIENT_ID:-},GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET=${GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET:-},GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY=${GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY:-}" \
  ${SECRET_ARGS+"${SECRET_ARGS[@]}"}

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed --region "${REGION}" --project "${PROJECT_ID}" \
  --format 'value(status.url)')

echo "Service URL: ${SERVICE_URL}"
echo "Set DRIVE_TO_GCS_SYNC_URL=${SERVICE_URL} on the Workflows YAML / FE env."
