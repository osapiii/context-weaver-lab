# Python 3.11のスリムイメージを使用
FROM python:3.11-slim

# 作業ディレクトリを設定
WORKDIR /app

# システムの依存関係をインストール（Playwright用）
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# requirements.txtをコピーして依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwrightのブラウザをインストール（Chromiumのみ）
RUN playwright install chromium
RUN playwright install-deps chromium

# アプリケーションコードをコピー
COPY main.py .
COPY endpoints/ ./endpoints/

# 共通モジュールをコピー（deploy.sh で事前にコピーされている）
COPY common ./common

# ポート8080を公開
EXPOSE 8080

# 環境変数の設定（複数パス PYTHONPATH）
ENV PORT=8080
ENV PYTHONPATH=/app:/app/common
ENV SERVICE_NAME=webCrawler

# uvicornでサービス起動
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--timeout-keep-alive", "120"]

