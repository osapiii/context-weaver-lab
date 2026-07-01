# mergeAudioFiles - 音声ファイル統合サービス

複数の音声ファイルを指定された間隔で連結し、1つのMP3ファイルとして出力するCloud Runマイクロサービスです。

## 🎯 機能概要

- 複数の音声ファイルの統合
- 指定された秒数のバッファ（無音）を各ファイル間に挿入
- GCS（Google Cloud Storage）からの入力ファイル読み込み
- MP3形式での出力ファイル生成
- GCSへの結果ファイル保存

## 🔧 技術スタック

- **Python 3.11** - ベース言語
- **Flask** - Webフレームワーク
- **Pydub** - 音声処理ライブラリ
- **Google Cloud Storage** - ファイルストレージ
- **FFmpeg** - 音声フォーマット変換（Pydub依存）
- **Docker** - コンテナ化
- **Cloud Run** - サーバーレス実行環境

## 📚 API仕様

### POST /merge-audio

複数の音声ファイルを統合します。

#### リクエスト

```json
{
  "audio_files": [
    "gs://bucket-name/audio1.mp3",
    "gs://bucket-name/audio2.wav",
    "gs://bucket-name/audio3.m4a"
  ],
  "buffer_seconds": 2.0,
  "output_gcs_filepath": "gs://bucket-name/merged_output.mp3"
}
```

**パラメータ**:
- `audio_files` (required): 統合する音声ファイルのGCSパス配列
- `buffer_seconds` (required): ファイル間に挿入する無音時間（秒）
- `output_gcs_filepath` (required): 出力ファイルのGCSパス

#### レスポンス

```json
{
  "success": true,
  "output_path": "gs://bucket-name/merged_output.mp3",
  "processing_time": 15.2,
  "statistics": {
    "total_files": 3,
    "total_duration_seconds": 120.5,
    "output_file_size_bytes": 1024000,
    "buffer_seconds": 2.0,
    "output_bitrate": "192k"
  }
}
```

### GET /health

サービスのヘルスチェックを行います。

#### レスポンス

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "service_info": {
    "service_name": "mergeAudioFiles",
    "project_id": "vohance-dev",
    "region": "asia-northeast1"
  }
}
```

## 🚀 デプロイ方法

### 1. 前提条件

- Google Cloud SDK がインストール済み
- Docker がインストール済み
- 適切なGCPプロジェクトの権限を持っている

### 2. デプロイ実行

```bash
# プロジェクトディレクトリに移動
cd backend/microservice/individual/mergeAudioFiles

# デプロイスクリプト実行
./deploy.sh
```

### 3. 環境変数設定

デプロイ時に以下の環境変数が設定されます：

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| `LOG_LEVEL` | `INFO` | ログレベル |
| `DEBUG_MODE` | `false` | デバッグモード |
| `MAX_FILE_COUNT` | `20` | 最大ファイル数 |
| `MAX_BUFFER_SECONDS` | `10.0` | 最大バッファ秒数 |
| `MAX_TOTAL_DURATION_MINUTES` | `30` | 最大総再生時間（分） |
| `OUTPUT_BITRATE` | `192k` | 出力ビットレート |

## 💡 使用例

### curlを使用したテスト

```bash
# ヘルスチェック
curl -X POST https://your-service-url/health

# 音声ファイル統合
curl -X POST https://your-service-url/merge-audio \
  -H "Content-Type: application/json" \
  -d '{
    "audio_files": [
      "gs://vohance-sample-videos/audio1.mp3",
      "gs://vohance-sample-videos/audio2.wav"
    ],
    "buffer_seconds": 2.0,
    "output_gcs_filepath": "gs://vohance-sample-videos/merged_output.mp3"
  }'
```

### Pythonを使用した例

```python
import requests

url = "https://your-service-url/merge-audio"
data = {
    "audio_files": [
        "gs://your-bucket/audio1.mp3",
        "gs://your-bucket/audio2.wav"
    ],
    "buffer_seconds": 1.5,
    "output_gcs_filepath": "gs://your-bucket/result.mp3"
}

response = requests.post(url, json=data)
result = response.json()
print(result)
```

## 📋 制限事項

- **最大ファイル数**: 50ファイル（デフォルト20）
- **最大バッファ時間**: 30秒（デフォルト10秒）
- **最大総再生時間**: 60分（デフォルト30分）
- **対応形式**: mp3, wav, m4a, aac, ogg, flac
- **出力形式**: MP3のみ
- **タイムアウト**: 15分

## 🐛 トラブルシューティング

### よくあるエラー

1. **GCSアクセスエラー**
   - サービスアカウントの権限を確認
   - バケット名とファイルパスを確認

2. **音声ファイル形式エラー**
   - 対応形式を確認
   - ファイルが破損していないか確認

3. **メモリエラー**
   - ファイルサイズを小さくする
   - ファイル数を減らす

### ログの確認

```bash
# Cloud Runログの確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=merge-audio-files" --limit=50 --format=json
```

## 🔧 ローカル開発

### 開発環境セットアップ

```bash
# 依存関係インストール
pip install -r requirements.txt

# 環境変数設定
export GOOGLE_CLOUD_PROJECT=your-project-id
export DEBUG_MODE=true

# サービス起動
python main.py
```

### Dockerでのローカル実行

```bash
# イメージビルド
docker build -t merge-audio-files .

# コンテナ実行
docker run -p 8080:8080 \
  -e GOOGLE_CLOUD_PROJECT=your-project-id \
  -e DEBUG_MODE=true \
  merge-audio-files
```

## 📊 監視・メトリクス

### 主要メトリクス

- **処理時間**: リクエスト完了までの時間
- **ファイルサイズ**: 入出力ファイルのサイズ
- **エラー率**: 失敗したリクエストの割合
- **メモリ使用量**: 処理中のメモリ消費

### アラート設定

Cloud Monitoringでの推奨アラート：
- エラー率 > 5%
- レスポンス時間 > 300秒
- メモリ使用率 > 90%

## 🔒 セキュリティ

- サービスアカウントベースの認証
- GCSアクセス権限の最小化
- 入力値バリデーション
- 一時ファイルの自動削除

## 📝 ライセンス

このプロジェクトはVohanceプロジェクトの一部です。
