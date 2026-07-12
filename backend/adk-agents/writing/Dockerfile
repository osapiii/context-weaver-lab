# EN AIstudio writing agent (Cloud Run).
#
# build context は backend/adk-agents/ ディレクトリ (common と writing を一緒に COPY するため).
# build コマンド (ローカル): docker build -t en-aistudio-writing-agent -f writing/Dockerfile .
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

# 共通 + writing の requirements を先に install (layer cache)
COPY common/requirements.txt /tmp/common-requirements.txt
RUN pip install -r /tmp/common-requirements.txt

# ソースをコピー
COPY common /app/common
COPY writing /app/writing

# uvicorn は /app をワーキングディレクトリにして writing/server.py を見る
WORKDIR /app/writing

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
