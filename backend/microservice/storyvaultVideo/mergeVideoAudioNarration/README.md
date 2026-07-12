# mergeVideoAudioNarration - 動画・音声ナレーション合成マイクロサービス

## 目的

動画ファイルと音声ナレーションをタイムスタンプベースで合成し、オプションで字幕を追加して、Google Cloud Storage (GCS) にアップロードするCloud Runマイクロサービス。

**主な機能**:
- GCSから動画と音声ファイルをダウンロード
- タイムスタンプに基づいて音声を動画に合成
- **🆕 オプション: 字幕（テロップ）の追加**
- 合成された動画をGCSにアップロード
- Firestoreへの進捗ログ記録（logsフィールドのみ、RequestDocアーキテクチャ準拠）

**RequestDoc黄金テンプレート準拠**: このサービスは、Cloud Runマイクロサービスの標準設計パターンである「RequestDoc黄金テンプレート」に準拠しています。

---

## API仕様書

詳細なAPI仕様は [`openapi.yaml`](./openapi.yaml) を参照してください。

### エンドポイント概要

#### `POST /merge` - 動画と音声ナレーションを合成

**リクエスト例（基本）**:
```json
{
  "request_id": "req_20250410123456_abc123",
  "input": {
    "videoBucketName": "storyvault-sandbox",
    "videoFilePath": "mergeVideoAudioNarration/744_1280x720.mp4",
    "audioSegments": [
      {
        "sourceBucketName": "storyvault-sandbox",
        "sourceFilePath": "mergeVideoAudioNarration/001-sibutomo.mp3",
        "timestampMs": 0
      },
      {
        "sourceBucketName": "storyvault-sandbox",
        "sourceFilePath": "mergeVideoAudioNarration/002-yutaka.mp3",
        "timestampMs": 5000
      }
    ],
    "outputBucketName": "storyvault-outputs",
    "outputFilePath": "organizations/org1/merged/output123.mp4",
    "videoId": "video123",
    "projectId": "project456"
  },
  "systemMetadata": {
    "organizationId": "org1",
    "spaceId": "space1",
    "loggingCollectionId": "requestLogs",
    "loggingDocumentId": "log_abc123",
    "requestedBy": {
      "email": "system@example.com",
      "role": 2
    },
    "isCommand": false,
    "isOouiCrud": true,
    "isLlmCall": false,
    "isAdminCrud": false
  }
}
```

**🆕 リクエスト例（字幕付き・カスタムスタイル）**:
```json
{
  "request_id": "req_20250410123456_xyz789",
  "input": {
    "videoBucketName": "storyvault-sandbox",
    "videoFilePath": "mergeVideoAudioNarration/744_1280x720.mp4",
    "audioSegments": [
      {
        "sourceBucketName": "storyvault-sandbox",
        "sourceFilePath": "mergeVideoAudioNarration/001-sibutomo.mp3",
        "timestampMs": 0
      }
    ],
    "outputBucketName": "storyvault-outputs",
    "outputFilePath": "organizations/org1/merged/output_with_captions.mp4",
    "captionIsEnabled": true,
    "captionSegments": [
      {
        "timestampMs": 0,
        "text": "原宿さんは歴史にしろ人生にしろ地続きのものが好き"
      },
      {
        "timestampMs": 5000,
        "text": "カウントダウンでリセットするのが合わないのかな"
      }
    ],
    "captionStyle": {
      "position": "bottom",
      "fontSize": 60,
      "fontColor": "#FFFF00",
      "strokeColor": "#000000",
      "strokeWidth": 4
    },
    "videoId": "video456",
    "projectId": "project789"
  },
  "systemMetadata": {
    "organizationId": "org1",
    "spaceId": "space1",
    "loggingCollectionId": "requestLogs",
    "loggingDocumentId": "log_xyz789",
    "requestedBy": {
      "email": "system@example.com",
      "role": 2
    },
    "isCommand": false,
    "isOouiCrud": true,
    "isLlmCall": false,
    "isAdminCrud": false
  }
}
```

**🎨 字幕スタイルプリセット**: 8種類のプリセットスタイルを用意。詳細は[`README_CAPTION_STYLES.md`](./README_CAPTION_STYLES.md)を参照。

**レスポンス例（成功）**:
```json
{
  "status": "success",
  "request_id": "req_20250410123456_abc123",
  "result": {
    "output": {
      "resultBucketName": "storyvault-outputs",
      "resultFilePath": "organizations/org1/merged/output123.mp4",
      "processingTime": 45.23
    },
    "processing_time": 45.23
  }
}
```

**レスポンス例（エラー）**:
```json
{
  "status": "error",
  "request_id": "req_20250410123456_abc123",
  "error": {
    "type": "FileNotFoundError",
    "message": "File not found: gs://bucket/path/to/file.mp4",
    "details": {
      "bucket": "bucket",
      "file_path": "path/to/file.mp4"
    }
  }
}
```

#### `GET /health` - ヘルスチェック

サービスの健全性を確認します。

**レスポンス例**:
```json
{
  "status": "healthy",
  "timestamp": "2025-04-10T12:34:56.789Z",
  "service": "mergeVideoAudioNarration"
}
```

---

## 機能概要

### 1. **ダウンロード** (`steps/download.py`)
- GCSから動画ファイルと音声ファイルをダウンロード
- 指数バックオフによるリトライ付き（最大3回）
- ファイルパス修正機能（部分一致検索）

### 2. **マージ** (`steps/merge_audio.py`)
- ffmpeg サブプロセスを使用して動画と音声をタイムスタンプベースで合成
- `adelay` + `amix` による重複部分のミキシング
- 音声セグメント 0 本の場合は映像のみ出力（`-an`）
- MoviePy を廃止しメモリ消費を大幅削減（高解像度動画でも安定動作）

### 3. **アップロード** (`steps/upload.py`)
- マージ済み動画（字幕付きまたはなし）をGCSにアップロード
- 指数バックオフによるリトライ付き（最大3回）
- ローカル一時ファイルのクリーンアップ

### 4. **Firestore進捗ログ** (`localPackages/common/firestore_client.py`)
- RequestDocアーキテクチャ準拠（**logsフィールドのみ追記**）
- **statusフィールド更新は Firebase Background関数の唯一の責務**
- 各ステップの開始/完了/エラーをリアルタイム記録

---

## アーキテクチャ

### RequestDoc黄金テンプレート準拠

```
┌──────────────────────────────────────────────────────────────────┐
│ Firebase Background関数                                          │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ 1. Firestore Trigger (onCreate/onUpdate)                     │ │
│ │ 2. RequestDoc読み取り                                        │ │
│ │ 3. Cloud Run POST /merge 呼び出し                           │ │
│ │    ├─ request_id                                             │ │
│ │    ├─ input (Command)                                        │ │
│ │    └─ systemMetadata (Context)                               │ │
│ │ 4. Cloud Run レスポンス受信 (output: Query)                 │ │
│ │ 5. RequestDoc.status 更新 (processing → completed/failed)   │ │
│ └──────────────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTP POST
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ Cloud Run: mergeVideoAudioNarration                              │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ main.py - Flask Application                                  │ │
│ │ ├─ before_request: コンテキスト作成                         │ │
│ │ ├─ POST /merge → endpoints/merge/execute.py                 │ │
│ │ └─ GET /health → endpoints/health/execute.py                │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ endpoints/merge/execute.py                                   │ │
│ │ ├─ 1. Pydanticバリデーション (request_schema.py)            │ │
│ │ ├─ 2. steps/download.py - GCSダウンロード                   │ │
│ │ ├─ 3. steps/merge_audio.py - ffmpegマージ                   │ │
│ │ ├─ 4. steps/upload.py - GCSアップロード                     │ │
│ │ ├─ 6. ProcessResponse生成                                    │ │
│ │ └─ 7. ResponseFormatter.success() 返却                       │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ localPackages/common/                                        │ │
│ │ ├─ firestore_client.py - logsフィールド追記のみ             │ │
│ │ ├─ gcs_storage.py - GCS操作                                 │ │
│ │ ├─ response_formatter.py - 統一レスポンス生成               │ │
│ │ ├─ context.py - グローバル設定 + リクエストコンテキスト     │ │
│ │ └─ logger.py - 構造化ログ                                   │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 責務分離（CQRS準拠）

| 層 | 責務 | 実装場所 |
|----|------|----------|
| **Command (Input)** | 実行指示（videoBucketName, audioSegments, videoId, projectId） | `request_schema.py: MergeInput` |
| **SystemMetadata (Context)** | コンテキスト情報（organizationId, spaceId, loggingDocumentId, requestedBy） | `request_schema.py: MergeSystemMetadata` |
| **Query (Output)** | 実行結果（resultBucketName, resultFilePath, processingTime） | `request_schema.py: MergeOutput` |
| **Status管理** | processing/completed/failed | **Firebase Background関数のみ** |
| **Logs記録** | 進捗ログ追記 | **Cloud Run側も許可** (firestore_client.log_processing_progress) |

---

## デプロイ手順

### 前提条件

- Google Cloud SDK インストール済み
- プロジェクト `storyvault-dev` への認証完了
- Cloud Run API 有効化済み

### デプロイコマンド

```bash
cd /path/to/mergeVideoAudioNarration
./deploy.sh
```

**deploy.shの内容**:
```bash
SERVICE_NAME="mergevideoaudionarration"
REGION="asia-northeast1"
PROJECT_ID="storyvault-dev"
MEMORY="2Gi"
TIMEOUT="300s"  # ガイドライン推奨値
MAX_INSTANCES="10"
CONCURRENCY="5"

gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --project $PROJECT_ID \
  --memory $MEMORY \
  --timeout $TIMEOUT \
  --max-instances $MAX_INSTANCES \
  --concurrency $CONCURRENCY \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,SERVICE_NAME=$SERVICE_NAME"
```

### デプロイ後の確認

```bash
# サービスURL取得
gcloud run services describe mergevideoaudionarration \
  --region asia-northeast1 \
  --project storyvault-dev \
  --format='value(status.url)'

# ヘルスチェック
curl https://mergevideoaudionarration-xxxxx-an.a.run.app/health
```

---

## ローカル開発

### 環境構築

```bash
# 依存関係インストール
pip install -r requirements.txt

# 環境変数設定（.env作成）
cp .env.example .env
# .envファイルを編集:
# GOOGLE_CLOUD_PROJECT=storyvault-dev
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
# DEBUG=true
```

### ローカル実行

```bash
# Flaskアプリケーション起動
python main.py

# 別ターミナルでテストリクエスト
curl -X POST http://localhost:8080/merge \
  -H "Content-Type: application/json" \
  -d @test_request.json
```

**test_request.json例**:
```json
{
  "request_id": "req_test_001",
  "input": {
    "videoBucketName": "storyvault-sandbox",
    "videoFilePath": "test/input.mp4",
    "audioSegments": [
      {
        "sourceBucketName": "storyvault-sandbox",
        "sourceFilePath": "test/audio1.mp3",
        "timestampMs": 0
      }
    ],
    "outputBucketName": "storyvault-sandbox",
    "outputFilePath": "test/output.mp4",
    "videoId": "test_video",
    "projectId": "test_project"
  },
  "systemMetadata": {
    "organizationId": "test_org",
    "spaceId": "test_space",
    "loggingCollectionId": "requestLogs",
    "loggingDocumentId": "test_log_001",
    "requestedBy": {
      "email": "system@example.com",
      "role": 2
    },
    "isCommand": false,
    "isOouiCrud": true,
    "isLlmCall": false,
    "isAdminCrud": false
  }
}
```

---

## 設定

### 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `GOOGLE_CLOUD_PROJECT` | (必須) | Google Cloud プロジェクトID |
| `GOOGLE_APPLICATION_CREDENTIALS` | None | サービスアカウントキーパス（ローカル開発用） |
| `SERVICE_NAME` | mergeVideoAudioNarration | サービス名 |
| `SERVICE_VERSION` | 1.0.0 | サービスバージョン |
| `PORT` | 8080 | リスンポート |
| `DEBUG` | false | デバッグモード |
| `TEMP_DIR` | /tmp/video_processing | 一時ディレクトリ |
| `CLEANUP_TEMP_FILES` | true | 一時ファイル自動削除 |

### MoviePy設定

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `VIDEO_CODEC` | libx264 | 動画コーデック |
| `AUDIO_CODEC` | aac | 音声コーデック |
| `VIDEO_BITRATE` | 5000k | 動画ビットレート |
| `AUDIO_BITRATE` | 192k | 音声ビットレート |

### 制限設定

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `REQUEST_TIMEOUT` | 600 | リクエストタイムアウト（秒） |
| `MAX_RETRY_ATTEMPTS` | 3 | GCS操作の最大リトライ回数 |
| `RETRY_DELAY_SECONDS` | 1 | リトライ遅延（秒、指数バックオフ） |
| `MAX_VIDEO_SIZE_MB` | 1000 | 最大動画サイズ（MB） |

---

## トラブルシューティング

### ファイルが見つからない (FileNotFoundError)

**症状**:
```json
{
  "status": "error",
  "error": {
    "type": "FileNotFoundError",
    "message": "File not found: gs://bucket/path/file.mp4"
  }
}
```

**対処法**:
1. GCSバケット名とファイルパスを確認
2. サービスアカウントに `roles/storage.objectViewer` 権限があることを確認
3. ファイルが実際に存在することを確認：
   ```bash
   gsutil ls gs://bucket/path/file.mp4
   ```

### 処理タイムアウト

**症状**: Cloud Run側で処理が300秒以上かかりタイムアウト

**対処法**:
1. 動画ファイルサイズを確認（1GB以下推奨）
2. `deploy.sh`の`TIMEOUT`を延長（最大3600秒）
3. `MEMORY`を増やす（2Gi → 4Gi）

### Firestore権限エラー

**症状**: `log_processing_progress`でPermission Deniedエラー

**対処法**:
```bash
# サービスアカウントにFirestore権限付与
gcloud projects add-iam-policy-binding storyvault-dev \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/datastore.user"
```

---

## ライセンス

© 2025 StoryVault Platform Team. All rights reserved.
