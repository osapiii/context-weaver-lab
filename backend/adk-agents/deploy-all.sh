#!/usr/bin/env bash
# EN AIstudio ADK agents — deploy.
#
# 使い方:
#   cd backend/adk-agents
#   PROJECT_ID=vibe-control-dev REGION=asia-northeast1 ./deploy-all.sh
#
# 必須 env:
#   PROJECT_ID   — GCP プロジェクト ID
# 任意 env:
#   REGION       — Cloud Run リージョン (既定: asia-northeast1)
#   IMAGE_BUCKET — image agent の生成画像保存先 GCS バケット (未指定なら data URL fallback)
#   ONLY         — "unified" / "writing" / "sheet" / "image" / "consultation" /
#                  "vibe_capability_structuring" / "vibe_story_generation" / "all" (既定 unified)
#   DD_*         — Datadog LLM Observability non-secret env (API key は Secret Manager 推奨)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROJECT_ID="${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-asia-northeast1}"
IMAGE_BUCKET="${IMAGE_BUCKET:-}"
ONLY="${ONLY:-unified}"
DD_LLMOBS_ENABLED="${DD_LLMOBS_ENABLED:-false}"
DD_LLMOBS_AGENTLESS_ENABLED="${DD_LLMOBS_AGENTLESS_ENABLED:-true}"
DD_LLMOBS_ML_APP="${DD_LLMOBS_ML_APP:-vibe-control}"
DD_ENV="${DD_ENV:-dev}"
DD_SITE="${DD_SITE:-ap1.datadoghq.com}"

if [[ -z "${ADK_INTERNAL_INVOKE_SECRET:-}" ]]; then
  project_env_file="${BACKEND_ROOT}/app/.env.${PROJECT_ID}"
  if [[ -f "${project_env_file}" ]]; then
    loaded_internal_secret="$(
      awk -F= '/^ADK_INTERNAL_INVOKE_SECRET=/{print substr($0, index($0, "=") + 1); exit}' "${project_env_file}"
    )"
    if [[ -n "${loaded_internal_secret}" ]]; then
      ADK_INTERNAL_INVOKE_SECRET="${loaded_internal_secret}"
    fi
  fi
fi

deploy_one() {
  local mode="$1"
  local service_name
  service_name="$(service_name_for_mode "${mode}")"
  echo "::: Deploying ${service_name} (project=${PROJECT_ID} region=${REGION})"
  local dd_service
  dd_service="$(dd_service_for_mode "${mode}")"
  local sub="_REGION=${REGION},_DD_LLMOBS_ENABLED=${DD_LLMOBS_ENABLED},_DD_LLMOBS_AGENTLESS_ENABLED=${DD_LLMOBS_AGENTLESS_ENABLED},_DD_LLMOBS_ML_APP=${DD_LLMOBS_ML_APP},_DD_SERVICE=${dd_service},_DD_ENV=${DD_ENV},_DD_SITE=${DD_SITE}"
  if [[ "${mode}" == "image" && -n "${IMAGE_BUCKET}" ]]; then
    sub="${sub},_IMAGE_BUCKET=${IMAGE_BUCKET}"
  fi
  if [[ "${mode}" == vibe_* ]]; then
    local artifact_bucket="${ARTIFACT_BUCKET:-${IMAGE_BUCKET:-}}"
    if [[ -z "${artifact_bucket}" ]]; then
      artifact_bucket="${PROJECT_ID}-adk-artifacts"
    fi
    sub="${sub},_ARTIFACT_BUCKET=${artifact_bucket}"
    if [[ -n "${ADK_INTERNAL_INVOKE_SECRET:-}" ]]; then
      sub="${sub},_ADK_INTERNAL_INVOKE_SECRET=${ADK_INTERNAL_INVOKE_SECRET}"
    fi
  fi
  gcloud builds submit "${SCRIPT_DIR}" \
    --project="${PROJECT_ID}" \
    --config="${SCRIPT_DIR}/${mode}/cloudbuild.yaml" \
    --substitutions="${sub}"
  if [[ "${mode}" == vibe_* ]]; then
    gcloud run services add-iam-policy-binding "${service_name}" \
      --project="${PROJECT_ID}" \
      --region="${REGION}" \
      --member=allUsers \
      --role=roles/run.invoker \
      --quiet >/dev/null
  fi
}

service_name_for_mode() {
  case "$1" in
    vibe_capability_structuring)
      echo "vibe-capability-structuring-agent"
      ;;
    vibe_zapping_analysis)
      echo "vibe-zapping-analysis-agent"
      ;;
    vibe_story_generation)
      echo "vibe-story-generation-agent"
      ;;
    *)
      echo "en-aistudio-$1-agent"
      ;;
  esac
}

dd_service_for_mode() {
  case "$1" in
    vibe_capability_structuring)
      echo "vibe-control-capability-structuring-agent"
      ;;
    vibe_zapping_analysis)
      echo "vibe-control-zapping-analysis-agent"
      ;;
    vibe_story_generation)
      echo "vibe-control-story-generation-agent"
      ;;
    *)
      echo "vibe-control-${1//_/-}-agent"
      ;;
  esac
}

deploy_unified() {
  echo "::: Deploying en-aistudio-adk-agent (unified) (project=${PROJECT_ID} region=${REGION})"
  local sub="_REGION=${REGION},_DD_LLMOBS_ENABLED=${DD_LLMOBS_ENABLED},_DD_LLMOBS_AGENTLESS_ENABLED=${DD_LLMOBS_AGENTLESS_ENABLED},_DD_LLMOBS_ML_APP=${DD_LLMOBS_ML_APP},_DD_SERVICE=vibe-control-adk-agent,_DD_ENV=${DD_ENV},_DD_SITE=${DD_SITE}"
  local artifact_bucket="${ARTIFACT_BUCKET:-${IMAGE_BUCKET:-}}"
  if [[ -z "${artifact_bucket}" ]]; then
    artifact_bucket="${PROJECT_ID}-adk-artifacts"
  fi
  if [[ -n "${artifact_bucket}" ]]; then
    sub="${sub},_IMAGE_BUCKET=${artifact_bucket},_ARTIFACT_BUCKET=${artifact_bucket}"
  elif [[ -n "${IMAGE_BUCKET}" ]]; then
    sub="${sub},_IMAGE_BUCKET=${IMAGE_BUCKET},_ARTIFACT_BUCKET=${IMAGE_BUCKET}"
  fi
  if [[ -n "${ADK_INTERNAL_INVOKE_SECRET:-}" ]]; then
    sub="${sub},_ADK_INTERNAL_INVOKE_SECRET=${ADK_INTERNAL_INVOKE_SECRET}"
  fi
  gcloud builds submit "${BACKEND_ROOT}" \
    --project="${PROJECT_ID}" \
    --config="${SCRIPT_DIR}/unified/cloudbuild.yaml" \
    --substitutions="${sub}"
}

case "${ONLY}" in
  unified)
    deploy_unified
    ;;
  all)
    deploy_unified
    deploy_one writing
    deploy_one sheet
    deploy_one image
    deploy_one consultation
    deploy_one vibe_zapping_analysis
    deploy_one vibe_capability_structuring
    deploy_one vibe_story_generation
    ;;
  writing|sheet|image|consultation|vibe_zapping_analysis|vibe_capability_structuring|vibe_story_generation)
    deploy_one "${ONLY}"
    ;;
  *)
    echo "ONLY must be one of: unified | writing | sheet | image | consultation | vibe_zapping_analysis | vibe_capability_structuring | vibe_story_generation | all" >&2
    exit 1
    ;;
esac

echo "::: Fetching service URLs"
url=$(gcloud run services describe "en-aistudio-adk-agent" \
  --project="${PROJECT_ID}" --region="${REGION}" \
  --format='value(status.url)' 2>/dev/null || true)
if [[ -n "${url}" ]]; then
  echo "NUXT_PUBLIC_EN_AISTUDIO_ADK_BASE_URL=${url}"
fi
for mode in writing sheet image consultation vibe_zapping_analysis vibe_capability_structuring vibe_story_generation; do
  service_name="$(service_name_for_mode "${mode}")"
  url=$(gcloud run services describe "${service_name}" \
    --project="${PROJECT_ID}" --region="${REGION}" \
    --format='value(status.url)' 2>/dev/null || true)
  if [[ -n "${url}" ]]; then
    echo "NUXT_PUBLIC_EN_AISTUDIO_ADK_$(echo ${mode} | tr a-z A-Z)_URL=${url}"
  fi
done
