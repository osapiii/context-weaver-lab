#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-storyvault-dev}"
REGION="${REGION:-asia-northeast1}"
DD_ENV="${DD_ENV:-dev}"
DD_SITE="${DD_SITE:-ap1.datadoghq.com}"
DD_LLMOBS_ML_APP="${DD_LLMOBS_ML_APP:-storyvault}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE_DIR="$ROOT_DIR/backend/microservice/storyvaultVideo"

deploy_service() {
  local dir="$1"
  local service="$2"
  local memory="$3"
  local cpu="$4"
  local timeout="$5"
  local concurrency="$6"
  local max_instances="$7"
  shift 7
  local env_vars="$*"
  local datadog_env="DD_LLMOBS_ENABLED=true,DD_LLMOBS_AGENTLESS_ENABLED=true,DD_LLMOBS_ML_APP=${DD_LLMOBS_ML_APP},DD_SERVICE=${service},DD_ENV=${DD_ENV},DD_SITE=${DD_SITE}"
  local deploy_args=(
    run deploy "$service"
    --source .
    --region "$REGION"
    --project "$PROJECT_ID"
    --memory "$memory"
    --cpu "$cpu"
    --timeout "$timeout"
    --concurrency "$concurrency"
    --max-instances "$max_instances"
    --platform managed
    --allow-unauthenticated
    --set-env-vars "${env_vars},${datadog_env}"
  )

  if gcloud secrets describe datadog-api-key --project "$PROJECT_ID" >/dev/null 2>&1; then
    deploy_args+=(--update-secrets "DD_API_KEY=datadog-api-key:latest")
  elif [[ -n "${DD_API_KEY:-}" ]]; then
    deploy_args+=(--update-env-vars "DD_API_KEY=${DD_API_KEY}")
  fi

  if [[ "$service" == "storyvault-transcribe-audio-with-gcp-speech-to-text" ]] &&
    gcloud secrets describe AQUA_VOICE_API_KEY --project "$PROJECT_ID" >/dev/null 2>&1; then
    deploy_args+=(--update-secrets "AQUA_VOICE_API_KEY=AQUA_VOICE_API_KEY:latest")
  fi

  echo "==> Deploying ${service} from ${dir}"
  (
    cd "$BASE_DIR/$dir"
    gcloud "${deploy_args[@]}"
  )
}

echo "Project: $PROJECT_ID"
echo "Region:  $REGION"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  texttospeech.googleapis.com \
  speech.googleapis.com \
  --project "$PROJECT_ID"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
DEFAULT_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for role in \
  roles/storage.objectAdmin \
  roles/datastore.user \
  roles/aiplatform.user
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEFAULT_SA}" \
    --role="$role" \
    --quiet >/dev/null
done

COMMON_ENV="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},DEBUG=false,MAX_VIDEO_SIZE_MB=1000"

deploy_service "aiVideoSectioning" "storyvault-ai-video-sectioning" "32Gi" "8" "1200" "3" "5" "${COMMON_ENV},SERVICE_NAME=storyvault-ai-video-sectioning,MAX_SEGMENTS=100"
deploy_service "splitVideoByTimestamps" "storyvault-split-video-by-timestamps" "4Gi" "4" "1200" "1" "10" "${COMMON_ENV},MAX_SEGMENTS=100"
deploy_service "transcribeAudioWithGcpSpeechToText" "storyvault-transcribe-audio-with-gcp-speech-to-text" "2Gi" "2" "600" "10" "5" "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},AQUA_VOICE_BASE_URL=${AQUA_VOICE_BASE_URL:-https://api.aquavoice.com/api/v1},AQUA_VOICE_MODEL=${AQUA_VOICE_MODEL:-avalon-v1.5},AQUA_VOICE_TIMEOUT=${AQUA_VOICE_TIMEOUT:-600},STORYVAULT_VIDEO_TRANSCRIBE_GEMINI_MODEL=${STORYVAULT_VIDEO_TRANSCRIBE_GEMINI_MODEL:-gemini-2.5-flash-lite},STORYVAULT_VIDEO_TRANSCRIBE_GEMINI_LOCATION=${STORYVAULT_VIDEO_TRANSCRIBE_GEMINI_LOCATION:-global}"
deploy_service "textToSpeechWithGoogle" "storyvault-text-to-speech-with-google" "1Gi" "1" "300" "20" "10" "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
deploy_service "mergeAudioFiles" "storyvault-merge-audio-files" "1Gi" "1" "900" "10" "5" "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},LOG_LEVEL=INFO,DEBUG_MODE=false,MAX_FILE_COUNT=20,MAX_BUFFER_SECONDS=10.0,MAX_TOTAL_DURATION_MINUTES=30,OUTPUT_BITRATE=192k,TEMP_DIR=/tmp/audio_merge"
deploy_service "mergeVideoAudioNarration" "storyvault-merge-video-audio-narration" "16Gi" "8" "1200" "1" "10" "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},SERVICE_NAME=storyvault-merge-video-audio-narration"
deploy_service "concatenateSectionVideos" "storyvault-concatenate-section-videos" "8Gi" "4" "1200" "1" "10" "${COMMON_ENV},MAX_SEGMENTS=100"
deploy_service "addVideoSubtitle" "storyvault-add-video-subtitle" "8Gi" "2" "1200" "1" "10" "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},SERVICE_NAME=storyvault-add-video-subtitle"
deploy_service "trimSilenceVideo" "storyvault-trim-silence-video" "8Gi" "4" "1200" "1" "10" "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},SERVICE_NAME=storyvault-trim-silence-video"
deploy_service "compressAndConvertVideo" "storyvault-compress-and-convert-video" "4Gi" "8" "600" "5" "10" "${COMMON_ENV}"

echo "==> Service URLs"
gcloud run services list \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --filter='metadata.name:storyvault-' \
  --format='table(metadata.name,status.url)'
