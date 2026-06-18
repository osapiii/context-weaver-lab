#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-web-crawl-workflow-kicker}"
WORKFLOW_NAME="${WORKFLOW_NAME:-web-crawl}"
WEB_CRAWL_INPUTS_BUCKET="${WEB_CRAWL_INPUTS_BUCKET:-${PROJECT_ID}-web-crawl-inputs}"
SA_EMAIL="${SA_EMAIL:-web-crawl-workflow-kicker@${PROJECT_ID}.iam.gserviceaccount.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},WORKFLOW_LOCATION=${REGION},WORKFLOW_NAME=${WORKFLOW_NAME},WEB_CRAWL_INPUTS_BUCKET=${WEB_CRAWL_INPUTS_BUCKET}"
