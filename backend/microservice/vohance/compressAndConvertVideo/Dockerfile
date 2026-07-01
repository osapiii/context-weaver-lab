FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN ffmpeg -version

WORKDIR /app
RUN mkdir -p /tmp/video_processing

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV TEMP_DIR=/tmp/video_processing
ENV SERVICE_NAME=compress-and-convert-video

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD exec ddtrace-run gunicorn --bind :$PORT --workers 2 --threads 4 --timeout 600 --worker-class gthread main:app
