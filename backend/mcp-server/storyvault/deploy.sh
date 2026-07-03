#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-storyvault-dev}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-storyvault-mcp}"
DEFAULT_STORAGE_BUCKET="${DEFAULT_STORAGE_BUCKET:-${PROJECT_ID}.firebasestorage.app}"
REPORT_STORAGE_BUCKET="${REPORT_STORAGE_BUCKET:-${DEFAULT_STORAGE_BUCKET}}"
REPORT_PATH_PREFIX="${REPORT_PATH_PREFIX:-storyvault/reports}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://storyvault-mcp-mdgjayj74q-an.a.run.app}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

gcloud builds submit "${SCRIPT_DIR}" \
  --project "${PROJECT_ID}" \
  --tag "${IMAGE}"

gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "LOG_LEVEL=INFO,STORYVAULT_MCP_DEFAULT_STORAGE_BUCKET=${DEFAULT_STORAGE_BUCKET},STORYVAULT_MCP_DEFAULT_STORAGE_BUCKET=${DEFAULT_STORAGE_BUCKET},STORYVAULT_MCP_REPORT_BUCKET=${REPORT_STORAGE_BUCKET},STORYVAULT_MCP_REPORT_PATH_PREFIX=${REPORT_PATH_PREFIX},STORYVAULT_MCP_PUBLIC_BASE_URL=${PUBLIC_BASE_URL},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --port 8080
