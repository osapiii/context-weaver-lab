# Aqua Voice Audio Transcription Service

Aqua Voice Avalon APIを使用した音声・動画文字起こしマイクロサービス

## 概要

このサービスは、GCS上の音声ファイルまたは動画ファイルから文字起こしを実行し、結果をGoogle Cloud Storageに保存するWeb APIを提供します。

### 主な機能

- ✅ GCS音声/動画ファイルの文字起こし
- ✅ Aqua Voice Avalon APIによる高精度認識
- ✅ OpenAI互換の音声文字起こしAPI
- ✅ 段落整形（Gemini統合、オプション）
- ✅ Application Default Credentials (ADC)による認証
- ❌ YouTube URLモードは非対応

### アーキテクチャ

- **言語**: Python 3.11
- **フレームワーク**: Flask + gunicorn
- **認証**: Application Default Credentials (ADC)
- **デプロイ**: Google Cloud Run
- **パターン**: Orchestratorパターン（main.py → endpoints/ → steps/）

## ディレクトリ構造

```
transcribeAudioWithGcpSpeechToText/
├── main.py                          # Orchestrator (Flask application)
├── requirements.txt                 # Python dependencies
├── Dockerfile                       # Container definition
├── deploy.sh                        # Cloud Run deployment script
├── openapi.yaml                     # OpenAPI 3.0 specification
├── .env.test                        # Test environment variables
├── endpoints/
│   ├── transcribe/
│   │   ├── execute.py               # Workflow orchestration
│   │   ├── request_schema.py        # Pydantic request schema
│   │   └── steps/
│   │       ├── step1_validate_and_prepare.py
│   │       ├── step2_submit_transcription.py
│   │       ├── step3_format_paragraphs.py
│   │       └── step4_save_to_gcs.py
│   └── health/
│       └── execute.py               # Health check endpoint
├── localPackages/
│   ├── common/
│   │   ├── context.py               # Request context
│   │   ├── logger.py                # Logging utilities
│   │   ├── gcs_storage.py           # GCS operations
│   │   ├── request_validator.py     # Request validation
│   │   └── response_formatter.py    # Response formatting
│   └── core/
│       ├── aqua_voice_transcription.py  # Aqua Voice Avalon wrapper
│       ├── audio_converter.py           # FFmpeg audio processing
│       └── gemini_processor.py          # Gemini paragraph formatting
└── tests/
    ├── test_request_schema.py       # Schema validation tests
    └── test_integration.py          # Integration tests
```

## セットアップ

### 前提条件

- Python 3.11+
- Docker (ローカルテスト用)
- Google Cloud SDK (デプロイ用)
- GCPプロジェクトとサービスアカウント

### ローカル開発

1. **依存関係のインストール**

```bash
pip install -r requirements.txt
```

2. **環境変数の設定**

```bash
cp .env.test .env
# .envを編集してGOOGLE_CLOUD_PROJECT/AQUA_VOICE_API_KEY等を設定
```

3. **ローカルでの起動**

```bash
python main.py
# http://localhost:8080 で起動
```

### Dockerでの起動

1. **イメージのビルド**

```bash
docker build -t transcribe-audio-gcp-speech .
```

2. **コンテナの実行**

```bash
docker run -p 8080:8080 \
  -e GOOGLE_CLOUD_PROJECT=your-project-id \
  -e AQUA_VOICE_API_KEY=your-aqua-voice-api-key \
  transcribe-audio-gcp-speech
```

## デプロイ

### Cloud Runへのデプロイ

1. **環境変数の設定**

```bash
export GOOGLE_CLOUD_PROJECT=vohance-dev
export AQUA_VOICE_API_KEY=your-aqua-voice-api-key
```

2. **デプロイスクリプトの実行**

```bash
chmod +x deploy.sh
./deploy.sh
```

3. **サービスアカウント権限の確認**

deploy.shが自動的に以下のIAMロールを付与します:
- `roles/storage.objectViewer` - GCS読み取り
- `roles/storage.objectCreator` - GCS書き込み
- `roles/datastore.user` - Firestore更新
- `roles/secretmanager.secretAccessor` - Aqua Voice APIキー参照

## API使用方法

### エンドポイント

#### POST /transcribe

音声・動画ファイルの文字起こしを実行

**リクエスト例 (audioFile)**:

```json
{
  "request_id": "req_20241005_120000_abc",
  "input": {
    "mode": "audioFile",
    "sourceFileBucketName": "vohance-sandbox",
    "sourceFilePath": "audio/sample.flac",
    "outputBucketName": "vohance-transcripts",
    "outputFilePath": "output/result.json",
    "enableParagraphFormatting": true,
    "videoId": "video_123",
    "projectId": "project_456"
  },
  "systemMetadata": {
    "organizationId": "org_123",
    "spaceId": "space_456",
    "loggingCollectionId": "videoTranscriptionRequests",
    "loggingDocumentId": "req_20241005_120000_abc",
    "requestedBy": {"email": "system@example.com", "role": 2},
    "isCommand": false,
    "isOouiCrud": true,
    "isLlmCall": false,
    "isAdminCrud": false
  }
}
```

**レスポンス例**:

```json
{
  "success": true,
  "transcription_path": "gs://vohance-transcripts/output/result.json",
  "transcription_id": "aqua_voice_1234567890",
  "processing_time": 15.3,
  "statistics": {
    "character_count": 1234,
    "language": "ja-JP",
    "language_confidence": 0.98,
    "duration_seconds": 120.5
  },
  "paragraph_count": 5
}
```

#### GET /health

サービスの健全性を確認

**レスポンス例**:

```json
{
  "status": "healthy",
  "service": {
    "name": "transcribe-audio-with-gcp-speech-to-text",
    "version": "1.0.0"
  },
  "api_status": {
    "gcs_access": true,
    "aqua_voice_api": true
  }
}
```

## テスト

### ユニットテスト

```bash
python3 tests/test_request_schema.py
```

### 統合テスト

```bash
python3 tests/test_integration.py
```

## 設定

環境変数で動作をカスタマイズできます:

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `GOOGLE_CLOUD_PROJECT` | - | GCPプロジェクトID（必須） |
| `AQUA_VOICE_API_KEY` | - | Aqua Voice APIキー（必須） |
| `AQUA_VOICE_BASE_URL` | https://api.aquavoice.com/api/v1 | Aqua Voice APIベースURL |
| `AQUA_VOICE_MODEL` | avalon-v1.5 | Aqua Voice Avalonモデル名 |
| `AQUA_VOICE_TIMEOUT` | 600 | Aqua Voice APIタイムアウト（秒） |
| `VOHANCE_TRANSCRIBE_GEMINI_MODEL` | gemini-2.5-flash-lite | 段落整形用Vertex AI Geminiモデル |
| `VOHANCE_TRANSCRIBE_GEMINI_LOCATION` | global | 段落整形用Vertex AIロケーション |
| `PORT` | 8080 | サービスポート |
| `ENABLE_PARAGRAPH_FORMATTING` | true | Gemini段落整形を有効化 |

## トラブルシューティング

### よくある問題

**1. Aqua Voice API接続エラー**
- `AQUA_VOICE_API_KEY` が設定されていることを確認
- Cloud RunサービスアカウントにSecret Manager参照権限があることを確認

**2. GCSファイルアクセスエラー**
- サービスアカウントに`roles/storage.objectViewer`権限があることを確認
- バケット名とファイルパスが正しいか確認

**3. YouTube URLを使用したエラー**
- このサービスはYouTube URLモードに対応していません
- `audioFile`または`videoFile`モードを使用してください

## 移行メモ

### 文字起こしAPIの変更点

1. **API変更**: GCP Speech-to-Text API → Aqua Voice Avalon API
2. **認証**: Application Default Credentials (ADC) → Aqua Voice APIキー（Secret Manager）
3. **YouTube対応**: 廃止（GCS音声/動画ファイルのみサポート）
4. **transcription_id形式**: `gcp_speech_{operation_id}` → `aqua_voice_{id}`
5. **依存関係**: `google-cloud-speech`を削除

## ライセンス

Proprietary - Vohance Development Team

## 参考リンク

- [Aqua Voice Avalon API](https://aquavoice.com/avalon-api)
- [OpenAPI Specification](./openapi.yaml)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
