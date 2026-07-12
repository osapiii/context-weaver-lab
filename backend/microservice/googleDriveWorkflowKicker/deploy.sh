#!/bin/bash
# Google Drive Workflow Kicker — Cloud Run deploy.
#
# Responsibilities:
#   - PUT importIds/removeIds YAML to GCS
#   - Patch RequestDoc with inputArtifactUri + workflow execution metadata
#   - Trigger GCP Workflows `gdrive-sync`
#
# Required env at deploy time (overridable):
#   PROJECT_ID, REGION
#   WORKFLOW_NAME (default: gdrive-sync)
#   FIREBASE_STORAGE_BUCKET (default: {PROJECT_ID}.firebasestorage.app)
#
# Required service account (must already exist + bound):
#   google-drive-workflow-kicker@{PROJECT_ID}.iam.gserviceaccount.com
#     - roles/storage.objectAdmin on Firebase Storage bucket
#     - roles/workflows.invoker
#     - roles/datastore.user

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
if [ -z "${PROJECT_ID}" ]; then
  echo "Error: PROJECT_ID is not set." >&2
  exit 1
fi
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-google-drive-workflow-kicker}"
WORKFLOW_NAME="${WORKFLOW_NAME:-gdrive-sync}"
FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:-${PROJECT_ID}.firebasestorage.app}"
SA_EMAIL="${SA_EMAIL:-google-drive-workflow-kicker@${PROJECT_ID}.iam.gserviceaccount.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Drive Workflow Kicker deploy ==="
echo "  Project    : ${PROJECT_ID}"
echo "  Region     : ${REGION}"
echo "  Service    : ${SERVICE_NAME}"
echo "  Workflow   : ${WORKFLOW_NAME}"
echo "  Storage    : ${FIREBASE_STORAGE_BUCKET}"
echo "  SA         : ${SA_EMAIL}"

cd "${SCRIPT_DIR}"

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --service-account "${SA_EMAIL}" \
  --allow-unauthenticated \
  --cpu 1 \
  --memory 512Mi \
  --timeout 60 \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 40 \
  --port 8080 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},WORKFLOW_LOCATION=${REGION},WORKFLOW_NAME=${WORKFLOW_NAME},FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET}"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed --region "${REGION}" --project "${PROJECT_ID}" \
  --format 'value(status.url)')

echo "Service URL: ${SERVICE_URL}"
echo "Set GOOGLE_DRIVE_WORKFLOW_KICKER_URL=${SERVICE_URL} on the Firebase Functions environment."
