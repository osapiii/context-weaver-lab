# Python 3.11 slim base image
FROM python:3.11-slim

# 作業ディレクトリの設定
WORKDIR /app

# システムの更新とFFmpegのインストール（Pydubが依存）
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    libavcodec-extra \
    && rm -rf /var/lib/apt/lists/*

# requirements.txtをコピーして依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY . .

# 一時ディレクトリの作成
RUN mkdir -p /tmp/audio_merge && \
    chmod 755 /tmp/audio_merge

# 非rootユーザーの作成と権限設定
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app && \
    chown -R app:app /tmp/audio_merge

# 非rootユーザーに切り替え
USER app

# ポート8080でサービスを公開
EXPOSE 8080

# Gunicornを使用してFlaskアプリケーションを起動
CMD ["ddtrace-run", "gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "300", "--worker-class", "sync", "main:app"]
