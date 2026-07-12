# ENOSTECH Slides ADK — Cloud Run hybrid image (Python + Node)
#
# - Python 3.12: ADK + LLM Coordinator
# - Node 20: skills/enostech-slides v12 の build-deck.js / build-html-report.js
# - LibreOffice + poppler-utils: pptx-to-images.sh の依存
# - fonts-noto-cjk: PPTX 内日本語フォント (Noto Sans JP)
#
# ビルド:
#   docker build -f adk/Dockerfile -t enostech-adk:dev .
#
# 起動 (ローカル):
#   docker run --rm -p 8080:8080 \
#     -e GEMINI_API_KEY=... \
#     -e ENOSTECH_DECK_OUT=/tmp/decks \
#     enostech-adk:dev
#
# Cloud Run デプロイ:
#   gcloud run deploy enostech-adk --source . \
#     --region asia-northeast1 \
#     --memory 2Gi --cpu 2 \
#     --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=...,GOOGLE_CLOUD_LOCATION=asia-northeast1
FROM python:3.12-slim AS base

# ─── システム依存 (Node, soffice, poppler, fonts) ───
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

# ─── Python deps (cache layer) ───
COPY agents-sandbox/adk/requirements.txt /app/agents-sandbox/adk/requirements.txt
RUN pip install --no-cache-dir -r /app/agents-sandbox/adk/requirements.txt

# ─── Node deps (skill 側 v12) ───
COPY skills/enostech-slides/package.json /app/skills/enostech-slides/package.json
COPY skills/enostech-slides/package-lock.json /app/skills/enostech-slides/package-lock.json
RUN cd /app/skills/enostech-slides && \
    (test -f package-lock.json && npm ci || npm install) && \
    npm cache clean --force

# ─── アプリケーション本体 ───
COPY skills/enostech-slides /app/skills/enostech-slides
COPY skills/enostech-svg-diagram /app/skills/enostech-svg-diagram
COPY agents-sandbox/adk /app/agents-sandbox/adk

# 成果物書き出し先 + agents_dir / PYTHONPATH 設定
ENV ENOSTECH_DECK_OUT=/tmp/decks \
    ENOSTECH_SKILL_ROOT=/app/skills/enostech-slides \
    ENOSTECH_SVG_SKILL_ROOT=/app/skills/enostech-svg-diagram \
    ENOSTECH_REPO_ROOT=/app \
    PYTHONPATH=/app/agents-sandbox \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# ─── 起動 ───
# adk web は AGENTS_DIR を引数に取る. agents-sandbox/ を渡せば中の adk/ が
# agent として discovery される.
WORKDIR /app
EXPOSE 8080
CMD ["adk", "web", "--no-reload", "--host", "0.0.0.0", "--port", "8080", "/app/agents-sandbox"]
