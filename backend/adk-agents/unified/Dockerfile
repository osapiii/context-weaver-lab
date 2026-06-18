# EN AIstudio unified ADK agent (Cloud Run) — all workspace modes incl. research.
# Build context: backend/ (see unified/cloudbuild.yaml).
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

COPY adk-agents/common/requirements.txt /tmp/common-requirements.txt
COPY adk-agents/unified/requirements.txt /tmp/unified-requirements.txt
COPY agent/slides-generator/requirements.txt /tmp/slides-requirements.txt
RUN pip install -r /tmp/common-requirements.txt && \
    pip install -r /tmp/unified-requirements.txt && \
    pip install -r /tmp/slides-requirements.txt

COPY adk-agents/common /app/common
COPY adk-agents/writing /app/writing
COPY adk-agents/sheet /app/sheet
COPY adk-agents/image /app/image
COPY adk-agents/consultation /app/consultation
COPY adk-agents/research /app/research
COPY adk-agents/business_partner /app/business_partner
COPY adk-agents/data_analysis /app/data_analysis
COPY adk-agents/web_page /app/web_page
COPY adk-agents/vibe_control /app/vibe_control
COPY adk-agents/unified /app/unified
COPY agent/slides-generator /app/slides-generator

WORKDIR /app/unified
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
