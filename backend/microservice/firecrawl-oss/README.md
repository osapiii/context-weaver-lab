# Firecrawl OSS - Cloud Run Deployment

Firecrawlのオープンソース版をGoogle Cloud Runでホスティングするための設定ファイルです。

## 概要

このディレクトリには、Firecrawl OSS版をCloud Runで実行するためのDockerfileとデプロイスクリプトが含まれています。

## 前提条件

- Google Cloud Platform（GCP）プロジェクトが設定されていること
- Cloud RunおよびCloud Build APIが有効化されていること
- gcloud CLIがインストール・設定されていること

## 依存サービス

Firecrawl OSS版は以下のサービスに依存しています：

- **Redis**: ジョブキューとレート制限に使用
- **PostgreSQL** (オプション): 認証機能を使用する場合
- **Playwright Microservice** (オプション): スクレイピングに使用

### Redisのセットアップ

Redisは以下のいずれかの方法でセットアップできます：

1. **Cloud Memorystore for Redis** (推奨)
   ```bash
   gcloud redis instances create firecrawl-redis \
     --size=1 \
     --region=us-central1 \
     --redis-version=redis_6_x
   ```

2. **別のCloud RunサービスとしてRedisをデプロイ**
   - Redis公式Dockerイメージを使用

3. **外部のRedisサービスを使用**

## デプロイ手順

### 1. 環境変数の設定（オプション）

必要に応じて環境変数を設定します：

```bash
# Redis URL（Cloud Memorystoreの場合）
export REDIS_URL="redis://[REDIS_IP]:6379"

# Redis Rate Limit URL（別のRedisインスタンスを使用する場合）
export REDIS_RATE_LIMIT_URL="redis://[REDIS_IP]:6379"

# Playwright Microservice URL（別途デプロイする場合）
export PLAYWRIGHT_MICROSERVICE_URL="https://playwright-service-xxxxx.run.app/scrape"

# OpenAI API Key（AI機能を使用する場合）
export OPENAI_API_KEY="sk-..."

# DB認証を使用する場合
export USE_DB_AUTHENTICATION="true"
export SUPABASE_URL="https://..."
export SUPABASE_ANON_TOKEN="..."
```

### 2. デプロイ実行

```bash
cd backend/microservice/firecrawl-oss
bash deploy.sh
```

### 3. 動作確認

デプロイが完了したら、ヘルスチェックエンドポイントにアクセス：

```bash
curl https://firecrawl-oss-xxxxx.us-central1.run.app/test
```

`Hello, world!`と返ってくれば正常に動作しています。

#### 外部接続検証スクリプト

XServerなどでホスティングしている場合、外部から使えるか検証するスクリプトを使用できます：

```bash
# 検証スクリプトを実行
cd backend/microservice/firecrawl-oss
bash test_connection.sh https://your-xserver-domain.com

# または環境変数で指定
export FIRECRAWL_API_URL='https://your-xserver-domain.com'
bash test_connection.sh
```

このスクリプトは以下を検証します：
1. ヘルスチェックエンドポイント (`/test`)
2. v2/scrape API（軽量テスト）
3. v2/crawl API（非同期ジョブテスト）

## APIエンドポイント

デプロイ後、以下のエンドポイントが利用可能になります（公式ドキュメントに準拠）：

- `GET /test` - ヘルスチェック
- `POST /v2/crawl` - v2クロールAPI（推奨）
- `POST /v2/scrape` - v2スクレイプAPI（推奨）
- `POST /v1/crawl` - v1クロールAPI（レガシー）
- `POST /v1/scrape` - v1スクレイプAPI（レガシー）

**注意**: 公式ドキュメントではv2 APIの使用が推奨されています。

## webCrawlerマイクロサービスとの統合

webCrawlerマイクロサービスでFirecrawl OSS版を使用する場合、環境変数を設定します：

```bash
# webCrawlerのデプロイ時に設定
export FIRECRAWL_API_URL="https://firecrawl-oss-xxxxx.us-central1.run.app"
export FIRECRAWL_API_KEY=""  # OSS版では認証が不要な場合がある
```

## 注意事項

- Cloud Runは単一コンテナしか動かせないため、APIサーバーのみをデプロイします
- Workerサービスは別途デプロイする必要があります（必要に応じて）
- RedisやPostgreSQLなどの依存サービスは外部で管理する必要があります
- メモリとCPUの設定は使用量に応じて調整してください

## トラブルシューティング

### Redis接続エラー

- Cloud MemorystoreのVPC接続を確認
- Cloud Runサービスに適切なVPC接続を設定
- Redis URLが正しく設定されているか確認

### Playwrightエラー

- Playwright Microserviceを別途デプロイする必要があります
- または、`PLAYWRIGHT_MICROSERVICE_URL`を設定しない場合、Playwright機能は使用できません

## 参考リンク

- [Firecrawl GitHub Repository](https://github.com/mendableai/firecrawl)
- [Firecrawl Self-Host Documentation](https://docs.firecrawl.dev/contributing/self-host) - 公式セルフホスティングガイド
- [Firecrawl Self-Host GitHub README](https://github.com/mendableai/firecrawl/blob/main/SELF_HOST.md)

