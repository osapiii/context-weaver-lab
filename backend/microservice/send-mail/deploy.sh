#!/bin/bash

# Send Mail (SendGrid) - Cloud Run Deployment Script

set -euo pipefail

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "Error: No gcloud project configured. Please run 'gcloud config set project <project-id>'"
    exit 1
fi
SERVICE_NAME="send-mail"
REGION="us-central1"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Send Mail Deployment ===${NC}"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}"

if [ -z "${SENDGRID_API_KEY:-}" ]; then
    echo -e "${RED}Error: SENDGRID_API_KEY environment variable is not set${NC}"
    exit 1
fi

if [ -z "${SENDGRID_FROM_EMAIL:-}" ]; then
    echo -e "${RED}Error: SENDGRID_FROM_EMAIL environment variable is not set${NC}"
    exit 1
fi

FROM_NAME="${SENDGRID_FROM_NAME:-EN AIstudio}"

gcloud run deploy ${SERVICE_NAME} \
    --source . \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --allow-unauthenticated \
    --cpu 1 \
    --memory 512Mi \
    --timeout 120 \
    --max-instances 10 \
    --port 8080 \
    --set-env-vars "SENDGRID_API_KEY=${SENDGRID_API_KEY},SENDGRID_FROM_EMAIL=${SENDGRID_FROM_EMAIL},SENDGRID_FROM_NAME=${FROM_NAME}"

echo -e "${GREEN}Deployment completed.${NC}"

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --format 'value(status.url)')

echo -e "${GREEN}Service URL: ${SERVICE_URL}${NC}"
