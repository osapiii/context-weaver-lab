FROM python:3.11-slim

# 作業ディレクトリを設定
WORKDIR /app

# ffmpegをインストール（pydubが音声変換に使用）
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 依存関係をコピーしてインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY . .

# 環境変数でポートを設定（Cloud Runはデフォルトで8080を使用）
ENV PORT 8080

# アプリケーションの実行
CMD exec ddtrace-run gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app
