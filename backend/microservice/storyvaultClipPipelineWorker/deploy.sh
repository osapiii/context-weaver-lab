#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-storyvault-dev}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="storyvault-clip-pipeline-worker"
service_url() {
  gcloud run services describe "$1" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)'
}
TRIM_URL="$(service_url storyvault-trim-silence-video)"
TRANSCRIBE_URL="$(service_url storyvault-transcribe-audio-with-gcp-speech-to-text)"
SECTION_URL="$(service_url storyvault-ai-video-sectioning)"

gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" --region "${REGION}" --source . \
  --no-allow-unauthenticated \
  --timeout 1800 --memory 2Gi --cpu 2 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},STORYVAULT_APP_URL=${STORYVAULT_APP_URL:-https://${PROJECT_ID}.web.app},STORYVAULT_VIDEO_TRIM_SILENCE_URL=${TRIM_URL},STORYVAULT_VIDEO_TRANSCRIBE_AUDIO_WITH_GCP_STT_URL=${TRANSCRIBE_URL},STORYVAULT_VIDEO_AI_SECTIONING_URL=${SECTION_URL}"
