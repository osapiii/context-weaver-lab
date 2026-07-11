#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${PROJECT_ID:-storyvault-dev}"
REGION="${REGION:-asia-northeast1}"
WORKFLOW_SA="${WORKFLOW_SA:-sv-clip-pipeline-workflow@${PROJECT_ID}.iam.gserviceaccount.com}"
FIREBASE_SA="${FIREBASE_SA:-${PROJECT_ID}@appspot.gserviceaccount.com}"

(
  cd "${ROOT_DIR}/backend/microservice/storyvaultClipCommand"
  PROJECT_ID="${PROJECT_ID}" REGION="${REGION}" ./deploy.sh
)
COMMAND_URL="$(gcloud run services describe storyvault-clip-command --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')"
gcloud run services add-iam-policy-binding storyvault-clip-command \
  --project "${PROJECT_ID}" --region "${REGION}" \
  --member "serviceAccount:${FIREBASE_SA}" --role roles/run.invoker >/dev/null

(
  cd "${ROOT_DIR}/backend/microservice/storyvaultClipPipelineWorker"
  PROJECT_ID="${PROJECT_ID}" REGION="${REGION}" ./deploy.sh
)
WORKER_URL="$(gcloud run services describe storyvault-clip-pipeline-worker --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')"
gcloud run services add-iam-policy-binding storyvault-clip-pipeline-worker \
  --project "${PROJECT_ID}" --region "${REGION}" \
  --member "serviceAccount:${WORKFLOW_SA}" --role roles/run.invoker >/dev/null

gcloud workflows deploy storyvault-clip-pipeline \
  --project "${PROJECT_ID}" --location "${REGION}" \
  --source "${ROOT_DIR}/infra/workflows/storyvault-clip-pipeline.yaml" \
  --service-account "${WORKFLOW_SA}" \
  --set-env-vars "STORYVAULT_CLIP_PIPELINE_WORKER_URL=${WORKER_URL}"

(
  cd "${ROOT_DIR}/backend/microservice/storyvaultClipPipelineKicker"
  PROJECT_ID="${PROJECT_ID}" REGION="${REGION}" ./deploy.sh
)
gcloud run services add-iam-policy-binding storyvault-clip-pipeline-kicker \
  --project "${PROJECT_ID}" --region "${REGION}" \
  --member "serviceAccount:${FIREBASE_SA}" --role roles/run.invoker >/dev/null

echo "Pipeline stack deployed to ${PROJECT_ID}/${REGION}."
echo "Configure Firebase Functions: STORYVAULT_CLIP_PIPELINE_KICKER_URL and STORYVAULT_CLIP_COMMAND_SERVICE_URL=${COMMAND_URL}"
