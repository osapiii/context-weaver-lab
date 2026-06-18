#!/usr/bin/env bash
# EN AIstudio ADK agents — deploy.
#
# 使い方:
#   cd backend/adk-agents
#   PROJECT_ID=en-aistudio-development REGION=asia-northeast1 ./deploy-all.sh
#
# 必須 env:
#   PROJECT_ID   — GCP プロジェクト ID
# 任意 env:
#   REGION       — Cloud Run リージョン (既定: asia-northeast1)
#   IMAGE_BUCKET — image agent の生成画像保存先 GCS バケット (未指定なら data URL fallback)
#   ONLY         — "unified" / "writing" / "sheet" / "image" / "consultation" / "all" (既定 unified)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROJECT_ID="${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-asia-northeast1}"
IMAGE_BUCKET="${IMAGE_BUCKET:-}"
ONLY="${ONLY:-unified}"

deploy_one() {
  local mode="$1"
  echo "::: Deploying en-aistudio-${mode}-agent (project=${PROJECT_ID} region=${REGION})"
  local sub="_REGION=${REGION}"
  if [[ "${mode}" == "image" && -n "${IMAGE_BUCKET}" ]]; then
    sub="${sub},_IMAGE_BUCKET=${IMAGE_BUCKET}"
  fi
  gcloud builds submit "${SCRIPT_DIR}" \
    --project="${PROJECT_ID}" \
    --config="${SCRIPT_DIR}/${mode}/cloudbuild.yaml" \
    --substitutions="${sub}"
}

deploy_unified() {
  echo "::: Deploying en-aistudio-adk-agent (unified) (project=${PROJECT_ID} region=${REGION})"
  local sub="_REGION=${REGION}"
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
    ;;
  writing|sheet|image|consultation)
    deploy_one "${ONLY}"
    ;;
  *)
    echo "ONLY must be one of: unified | writing | sheet | image | consultation | all" >&2
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
for mode in writing sheet image consultation; do
  url=$(gcloud run services describe "en-aistudio-${mode}-agent" \
    --project="${PROJECT_ID}" --region="${REGION}" \
    --format='value(status.url)' 2>/dev/null || true)
  if [[ -n "${url}" ]]; then
    echo "NUXT_PUBLIC_EN_AISTUDIO_ADK_$(echo ${mode} | tr a-z A-Z)_URL=${url}"
  fi
done
