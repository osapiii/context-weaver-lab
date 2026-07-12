FROM python:3.11-slim

# 作業ディレクトリを設定
WORKDIR /app

# pydub の MP3 デコード/エンコード用に ffmpeg をインストール
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 依存関係をコピーしてインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY . .

# 環境変数でポートを設定（Cloud Runはデフォルトで8080を使用）
ENV PORT 8080

# アプリケーションの実行
CMD exec ddtrace-run gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app
