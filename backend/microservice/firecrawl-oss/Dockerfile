# Firecrawl OSS - Cloud Run Deployment Dockerfile
# 
# Firecrawl OSS版のAPIサーバーをCloud Runで実行するためのDockerfile
# 注意: RedisやPostgreSQLなどの依存サービスは外部で管理する必要があります

FROM node:18-slim

# 作業ディレクトリを設定
WORKDIR /app

# システム依存関係のインストール（Playwright等に必要）
# Gitも含めて一度にインストール
RUN apt-get update && apt-get install -y \
    git \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Firecrawlリポジトリをクローン
RUN git clone --depth 1 https://github.com/mendableai/firecrawl.git /tmp/firecrawl

# apps/apiディレクトリに移動して依存関係をインストール
WORKDIR /tmp/firecrawl/apps/api

# 依存関係をインストール
RUN npm ci --production --ignore-scripts

# アプリケーションコードを/appにコピー
RUN cp -r /tmp/firecrawl/apps/api/* /app/ && \
    rm -rf /tmp/firecrawl

# 作業ディレクトリを/appに設定
WORKDIR /app

# ポート3002を公開（Firecrawlのデフォルトポート）
EXPOSE 3002

# 環境変数の設定
ENV PORT=3002
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Firecrawl APIサーバーを起動
CMD ["npm", "start"]

