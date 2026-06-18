# EN AIstudio Research Agent — Cloud Run (Python + Node + LibreOffice)
# Build context: backend/ (see cloudbuild.yaml)
FROM python:3.12-slim AS base

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg \
      libreoffice-impress \
      poppler-utils \
      fonts-noto-cjk \
      fonts-noto-cjk-extra \
      bash && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY agent/slides-generator/requirements.txt /app/requirements.txt
COPY adk-agents/common/requirements.txt /app/common-requirements.txt
RUN pip install --no-cache-dir -r /app/common-requirements.txt && \
    pip install --no-cache-dir -r /app/requirements.txt

COPY agent/slides-generator/skills/enostech-slides/package.json /app/skills/enostech-slides/package.json
COPY agent/slides-generator/skills/enostech-slides/package-lock.json /app/skills/enostech-slides/package-lock.json
RUN cd /app/skills/enostech-slides && \
    (test -f package-lock.json && npm ci || npm install) && \
    npm cache clean --force

COPY agent/slides-generator/skills/enostech-slides /app/skills/enostech-slides
COPY agent/slides-generator/skills/enostech-svg-diagram /app/skills/enostech-svg-diagram
COPY adk-agents/common /app/common
COPY agent/slides-generator/adk /app/adk
COPY agent/slides-generator/server.py /app/server.py
COPY agent/slides-generator/byok_patch.py /app/byok_patch.py

ENV PYTHONPATH=/app \
    ENOSTECH_DECK_OUT=/tmp/decks \
    ENOSTECH_SKILL_ROOT=/app/skills/enostech-slides \
    PORT=8080

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
