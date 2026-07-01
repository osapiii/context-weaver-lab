# Use Python 3.9+ base image
FROM python:3.9-slim

# Install system dependencies for FFmpeg/libass subtitle rendering and Japanese fonts
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-noto-cjk \
    fontconfig \
    && fc-cache -fv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port 8080 (Cloud Run standard)
EXPOSE 8080

# Run application with gunicorn
CMD exec ddtrace-run gunicorn --bind :8080 --workers 1 --threads 8 --timeout 0 main:app
