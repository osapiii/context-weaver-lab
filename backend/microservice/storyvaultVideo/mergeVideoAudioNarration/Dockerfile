# Use Python 3.9+ base image
FROM python:3.9-slim

# Install system dependencies including FFmpeg, ImageMagick, and Japanese fonts
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    fonts-noto-cjk \
    fontconfig \
    && fc-cache -fv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy custom ImageMagick policy to all possible locations (fix for MoviePy TextClip)
COPY imagemagick-policy.xml /tmp/policy.xml
RUN mkdir -p /etc/ImageMagick-6 /etc/ImageMagick-7 && \
    cp /tmp/policy.xml /etc/ImageMagick-6/policy.xml 2>/dev/null || true && \
    cp /tmp/policy.xml /etc/ImageMagick-7/policy.xml 2>/dev/null || true && \
    find /etc -name policy.xml -exec cp /tmp/policy.xml {} \; 2>/dev/null || true

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port 8080 (Cloud Run standard)
EXPOSE 8080

# Run application with gunicorn.
# This service shells out to ffprobe/ffmpeg after initializing Google gRPC clients.
# ddtrace auto-instrumentation has triggered grpc C-core epoll aborts in that path,
# so keep Datadog visibility through Cloud Logging/custom logger instead.
ENV DD_TRACE_ENABLED=false
CMD exec gunicorn --bind :8080 --workers 1 --threads 8 --timeout 0 main:app
