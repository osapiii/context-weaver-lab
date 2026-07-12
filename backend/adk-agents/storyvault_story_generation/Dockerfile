# StoryVault Story Generation agent (Cloud Run).
#
# Build context: backend/adk-agents/
#   docker build -t storyvault-story-generation-agent -f storyvault_story_generation/Dockerfile .
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
COPY storyvault_story_generation /app/storyvault_story_generation

WORKDIR /app/storyvault_story_generation

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
