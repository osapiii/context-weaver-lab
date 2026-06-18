# EN AIstudio image agent (Cloud Run).
# build context: backend/adk-agents/
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

COPY common/requirements.txt /tmp/common-requirements.txt
COPY image/requirements.txt /tmp/image-requirements.txt
RUN pip install -r /tmp/common-requirements.txt && \
    pip install -r /tmp/image-requirements.txt

COPY common /app/common
COPY image /app/image

WORKDIR /app/image
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
