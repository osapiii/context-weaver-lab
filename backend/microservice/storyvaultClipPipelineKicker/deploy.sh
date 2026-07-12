#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-storyvault-dev}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="storyvault-clip-pipeline-kicker"
WORKFLOW_NAME="storyvault-clip-pipeline"
INPUT_BUCKET="${PIPELINE_INPUTS_BUCKET:-${PROJECT_ID}-storyvault-clip-pipeline-inputs}"

gcloud storage buckets describe "gs://${INPUT_BUCKET}" --project "${PROJECT_ID}" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://${INPUT_BUCKET}" --project "${PROJECT_ID}" --location "${REGION}"

gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" --region "${REGION}" --source . \
  --clear-base-image \
  --no-allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},WORKFLOW_LOCATION=${REGION},WORKFLOW_NAME=${WORKFLOW_NAME},PIPELINE_INPUTS_BUCKET=${INPUT_BUCKET}"
