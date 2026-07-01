# Python 3.11をベースイメージとして使用
FROM python:3.11-slim

# 必要なシステムパッケージをインストール（ffmpegと関連ライブラリ）
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    wget \
    curl \
    libavcodec-extra \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ffmpegが正しくインストールされていることを確認
RUN ffmpeg -version

# 作業ディレクトリを設定
WORKDIR /app

# 一時ファイル用ディレクトリを作成
RUN mkdir -p /tmp/video_processing

# requirements.txtをコピーして依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY . .

# 環境変数の設定
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV TEMP_DIR=/tmp/video_processing
ENV SERVICE_NAME=ai-video-sectioning

# ヘルスチェック用
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# アプリケーションを起動
CMD exec ddtrace-run gunicorn --bind :$PORT --workers 2 --threads 4 --timeout 1200 --worker-class gthread main:app
