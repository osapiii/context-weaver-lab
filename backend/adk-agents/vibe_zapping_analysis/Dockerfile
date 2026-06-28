# VibeControl Zapping Analysis agent (Cloud Run).
#
# Build context: backend/adk-agents/
#   docker build -t vibe-zapping-analysis-agent -f vibe_zapping_analysis/Dockerfile .
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
COPY vibe_zapping_analysis /app/vibe_zapping_analysis

WORKDIR /app/vibe_zapping_analysis

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
