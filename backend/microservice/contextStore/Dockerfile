# Python 3.11のスリムイメージを使用
FROM python:3.11-slim

# 作業ディレクトリを設定
WORKDIR /app

# requirements.txtをコピーして依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY main.py .
COPY endpoints/ ./endpoints/
COPY localPackages/ ./localPackages/

# 共通モジュールをコピー（deploy.sh で事前にコピーされている）
COPY common ./common

# ポート8080を公開
EXPOSE 8080

# 環境変数の設定（複数パス PYTHONPATH）
ENV PORT=8080
ENV PYTHONPATH=/app:/app/common:/app/localPackages
ENV SERVICE_NAME=contextStore

# uvicornでサービス起動
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--timeout-keep-alive", "120"]

