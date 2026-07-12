# StoryVault Capability Structuring agent (Cloud Run).
#
# Build context: backend/adk-agents/
#   docker build -t storyvault-capability-structuring-agent -f storyvault_capability_structuring/Dockerfile .
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

COPY common/requirements.txt /tmp/common-requirements.txt
RUN pip install -r /tmp/common-requirements.txt

COPY common /app/common
COPY storyvault_capability_structuring /app/storyvault_capability_structuring

WORKDIR /app/storyvault_capability_structuring

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
