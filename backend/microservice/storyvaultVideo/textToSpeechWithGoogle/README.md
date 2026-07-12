# Text-to-Speech with Chirp 3 HD Cloud Run Service

Google Cloud Text-to-Speech の Chirp 3 HD を使用してテキストを音声に変換し、Google Cloud Storage に保存するマイクロサービスです。日本語前提・MP3直接出力。

**v2.0.0**: RequestDoc黄金テンプレート準拠、ResponseFormatter統一レスポンス形式に対応

## 🎯 機能

- Chirp 3 HD を使用した高品質な音声生成
- 複数のプリセット音声から選択可能（日本語前提）
- 生成した音声を Google Cloud Storage に直接保存
- MP3形式での音声出力
- ストリーミング音声生成対応
- ヘルスチェックエンドポイント
- **RequestDoc黄金テンプレート準拠**（input/systemMetadata構造）
- **ResponseFormatter統一レスポンス**（status, request_id, result/error）

## 🚀 クイックスタート

### 1. 環境変数の設定

```bash
# .env.example を .env にコピー
cp .env.example .env

# .env を編集して実際の値を設定
# 最低限必要な設定:
# - GOOGLE_CLOUD_PROJECT: GCPプロジェクトID（必須）
# ADC（Application Default Credentials）で認証されます
```

**必須環境変数:**
- `GOOGLE_CLOUD_PROJECT`: GCPプロジェクトID

**認証:** ADC（gcloud auth application-default login またはサービスアカウント）。Cloud Run のデフォルトサービスアカウントには `roles/cloudtts.user` が必要。

**オプション環境変数:**
- `DEBUG`: デバッグモード（true/false、デフォルト: false）
- `PORT`: サービスポート（デフォルト: 8080）
- `DEFAULT_VOICE_NAME`: デフォルト音声（デフォルト: Aoede）
- その他は `.env.example` を参照

### 2. ローカル実行

```bash
# 依存関係のインストール
pip install -r requirements.txt

# サービス起動
python main.py
```

サービスが起動したら、以下のURLでアクセスできます：
- ヘルスチェック: http://localhost:8080/health
- 音声リスト: http://localhost:8080/voices
- API仕様: openapi.yaml を参照

## 📋 API仕様（v2.0.0）

### POST /synthesize

**RequestDoc黄金テンプレート準拠**のリクエスト形式でテキストを音声に変換してGCSに保存します。

**リクエスト（RequestDoc形式）:**
```json
{
  "request_id": "ttsRequest_1234567890",
  "input": {
    "text": "変換するテキスト",
    "voiceName": "Aoede",
    "outputBucketName": "storyvault-audio",
    "outputFilePath": "audio/output.mp3",
    "projectId": "project_456"
  },
  "systemMetadata": {
    "organizationId": "org_123",
    "spaceId": "space_456",
    "loggingCollectionId": "requestLogs",
    "loggingDocumentId": "tts_log_123",
    "requestedBy": {"email": "system@example.com", "role": 2},
    "isCommand": false,
    "isOouiCrud": true,
    "isLlmCall": false,
    "isAdminCrud": false
  }
}
```

**レスポンス（ResponseFormatter形式）:**
```json
{
  "status": "success",
  "request_id": "ttsRequest_1234567890",
  "result": {
    "audio_path": "gs://storyvault-audio/audio/output.mp3",
    "audio_size_bytes": 45678,
    "audio_duration": 3.5,
    "processing_time": 1.2,
    "voice_used": "Aoede",
    "systemMetadata": {
      "audio_format": "MP3",
      "sample_rate": 24000,
      "channels": 1
    }
  }
}
```

**エラーレスポンス:**
```json
{
  "status": "error",
  "request_id": "ttsRequest_1234567890",
  "error": {
    "type": "ValidationError",
    "message": "Request validation failed",
    "details": {
      "endpoint": "/synthesize",
      "validation_errors": [
        {
          "field": "input.text",
          "message": "Field required",
          "type": "missing"
        }
      ]
    }
  }
}
```

**利用可能な音声:**
- `Zephyr`: 明瞭で自然な男性音声
- `Puck`: 活発で親しみやすい音声
- `Charon`: 落ち着いた深みのある男性音声
- `Aoede`: 優しく聞き取りやすい女性音声
- `Fenrir`: 力強く説得力のある男性音声
- `Kore`: 明るく親しみやすい女性音声
- `Perse`: プロフェッショナルで洗練された女性音声

### GET /voices
利用可能な音声モデルの一覧を取得します。

**レスポンス:**
```json
{
  "voices": [
    {
      "name": "Aoede",
      "description": "優しく聞き取りやすい女性音声",
      "language_codes": ["ja-JP"],
      "gender": "FEMALE"
    }
  ],
  "total_count": 7,
  "note": "Chirp 3 HD のプリセット音声リスト（日本語前提）"
}
```

### GET /health
サービスのヘルスチェックを実行します。

**レスポンス:**
```json
{
  "status": "healthy",
  "timestamp": "2024-10-05T12:00:00.000Z",
  "service_info": {
    "name": "text-to-speech-with-google",
    "version": "2.0.0"
  },
  "api_status": {
    "gemini_tts": "connected",
    "storage": "connected"
  },
  "active_requests": 0
}
```

### POST /test-synthesize
テスト用の音声合成エンドポイント（Base64エンコードされた音声データを返します）

**リクエスト:**
```json
{
  "text": "テスト用テキスト",
  "voice": {
    "name": "Aoede"
  }
}
```

## 🏗️ アーキテクチャ

このマイクロサービスは**Cloud Run マイクロサービス実装完全ガイド**に準拠しています。

### ディレクトリ構造

```
textToSpeechWithGoogle/
├── main.py                    # Flask アプリケーション（委譲パターン）
├── openapi.yaml              # OpenAPI 3.0 仕様（RequestDoc準拠）
├── deploy.sh                 # Cloud Run デプロイスクリプト
├── requirements.txt          # Python 依存関係
├── Dockerfile               # コンテナイメージ定義
├── .env.example             # 環境変数テンプレート
├── .env                     # 環境変数（gitignore済み）
├── localpackage/
│   ├── config.py            # 設定管理
│   ├── context.py           # リクエストコンテキスト
│   ├── logger.py            # ロギング
│   ├── gemini_tts.py        # Gemini TTS クライアント
│   ├── gcs_storage.py       # GCS 操作
│   ├── audio_processor.py   # 音声データ処理
│   ├── response_formatter.py  # ResponseFormatter（全マイクロサービス共通）
│   └── request_validator.py   # RequestValidator（Pydantic検証）
└── endpoints/
    ├── synthesize/          # 音声合成エンドポイント
    │   ├── request_schema.py  # Pydanticスキーマ
    │   ├── execute.py         # オーケストレータ
    │   └── steps/
    │       ├── step1_generate_audio.py  # Step 1: 音声生成
    │       └── step2_upload_audio.py    # Step 2: GCSアップロード
    ├── voices/              # 音声リストエンドポイント
    │   └── execute.py
    ├── health/              # ヘルスチェックエンドポイント
    │   └── execute.py
    └── test_synthesize/     # テスト音声合成エンドポイント
        └── execute.py
```

### 処理フロー（/synthesize）

1. **リクエスト受信**: main.py → endpoints/synthesize/execute.py
2. **バリデーション**: Pydanticスキーマによる型検証（request_schema.py）
3. **Step 1**: 音声生成（gemini_tts.py を使用）
4. **Step 2**: GCSアップロード（gcs_storage.py を使用）
5. **レスポンス返却**: ResponseFormatter形式で統一レスポンス

### アーキテクチャ原則

- ✅ **RequestDoc黄金テンプレート**: `{request_id, input, systemMetadata}` 構造
- ✅ **ResponseFormatter統一**: `{status, request_id, result/error}` 構造
- ✅ **endpoints/ディレクトリ構造**: エンドポイントごとに分離
- ✅ **steps/パターン**: 複雑な処理を段階分割
- ✅ **Pydanticバリデーション**: 型安全性の確保
- ✅ **責務分離**: HTTP層 → オーケストレーション → ビジネスロジック

## 🚀 デプロイ

### Cloud Run へのデプロイ

```bash
# デプロイスクリプトを実行
./deploy.sh
```

デプロイスクリプトは以下を自動実行します：
1. 必要なAPIの有効化（Text-to-Speech API, Cloud Storage API）
2. コンテナイメージのビルド
3. Cloud Runへのデプロイ
4. サービスURLの表示

### 環境変数の設定（Cloud Run）

Cloud Runにデプロイする場合は、以下の環境変数を設定してください：

```bash
gcloud run services update text-to-speech-with-google \
  --set-env-vars "GEMINI_API_KEY=your-actual-key" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=your-project-id" \
  --region asia-northeast1
```

または、Secret Managerを使用して機密情報を管理することを推奨します。

## 📝 開発ガイド

### 新しいエンドポイントの追加

1. `endpoints/` 配下に新しいディレクトリを作成
2. `request_schema.py` でPydanticスキーマを定義（必要に応じて）
3. `execute.py` でエンドポイント処理を実装
4. `main.py` でルートを追加
5. `openapi.yaml` にAPI仕様を追加

### テスト

```bash
# ヘルスチェック
curl http://localhost:8080/health

# 音声リスト取得
curl http://localhost:8080/voices

# テスト音声合成（Base64レスポンス）
curl -X POST http://localhost:8080/test-synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "こんにちは"}'

# 本番音声合成（RequestDoc形式）
curl -X POST http://localhost:8080/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test_123",
    "input": {
      "text": "こんにちは、Gemini Text-to-Speechです",
      "voiceName": "Aoede",
      "outputBucketName": "your-bucket",
      "outputFilePath": "test/output.wav",
      "projectId": "project_test"
    },
    "systemMetadata": {
      "organizationId": "org_test",
      "spaceId": "space_test",
      "loggingCollectionId": "requestLogs",
      "loggingDocumentId": "test_log",
      "requestedBy": {"email": "system@example.com", "role": 2},
      "isCommand": false,
      "isOouiCrud": true,
      "isLlmCall": false,
      "isAdminCrud": false
    }
  }'
```

## 🔒 セキュリティ

- `.env` ファイルは `.gitignore` に追加済み（コミット対象外）
- `GEMINI_API_KEY` は環境変数またはSecret Managerで管理
- Cloud Run デプロイ時は認証必須（`--allow-unauthenticated` は開発環境のみ）

## 📚 参考資料

- [Gemini API Documentation](https://ai.google.dev/)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [OpenAPI Specification](openapi.yaml)

## 🔄 変更履歴

### v2.0.0 (2025-01-XX)
- ✨ RequestDoc黄金テンプレート準拠
- ✨ ResponseFormatter統一レスポンス形式導入
- ✨ endpoints/ディレクトリ構造に移行
- ✨ steps/パターン導入（音声生成・GCSアップロードの分離）
- ✨ Pydanticバリデーション導入
- ✨ .env ファイル対応
- 📝 OpenAPI仕様を v2.0.0 に更新

### v1.0.0 (2024-XX-XX)
- 🎉 初回リリース
- Gemini TTS 統合
- GCS保存機能
