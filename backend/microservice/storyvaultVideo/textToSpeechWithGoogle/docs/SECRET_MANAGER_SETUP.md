# Secret Manager セットアップ手順

GCP Secret Managerを使用してGEMINI_API_KEYを安全に管理するための手順書です。

## 概要

このサービスでは、GEMINI_API_KEYをSecret Managerで管理し、マルチテナント対応（organizationIdベース）を実現しています。

### Secret命名規則

✅ **最新の命名規則** (gcp-secret-manager-guide.md準拠):

```
{key-type}-{organization-id}
```

**例**:
```
gemini-api-key-org_default
gemini-api-key-org_abc123
openai-api-key-org_xyz789
```

**注**: service-nameは命名規則から除外されました。

## 前提条件

1. GCPプロジェクト: `storyvault-dev`
2. gcloud CLI がインストール済み
3. 適切なGCP権限（Secret Manager管理者、IAM管理者）

## セットアップ手順

### 1. Secret Manager API の有効化

```bash
gcloud services enable secretmanager.googleapis.com --project=storyvault-dev
```

### 2. デフォルト組織用のSecretを作成

スクリプトを使用して作成（推奨）:

```bash
cd /path/to/textToSpeechWithGoogle
chmod +x scripts/create-secret.sh

# デフォルト組織用のSecretを作成
./scripts/create-secret.sh org_default "YOUR_GEMINI_API_KEY"
```

手動で作成する場合:

```bash
# ✅ 最新の命名規則でSecret作成
echo -n "YOUR_GEMINI_API_KEY" | \
  gcloud secrets create gemini-api-key-org_default \
    --data-file=- \
    --replication-policy="automatic" \
    --project=storyvault-dev

# IAM権限付与
PROJECT_NUMBER=$(gcloud projects describe storyvault-dev --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding gemini-api-key-org_default \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=storyvault-dev
```

### 3. 追加組織用のSecretを作成（オプション）

マルチテナント対応のため、組織ごとにSecretを作成できます:

```bash
# 組織ID: org_abc123 のSecret作成例
./scripts/create-secret.sh org_abc123 "ANOTHER_GEMINI_API_KEY"
```

### 4. Secret一覧の確認

```bash
gcloud secrets list --project=storyvault-dev --filter="name~gemini-api-key"
```

### 5. Secretの内容を確認（デバッグ用）

```bash
gcloud secrets versions access latest --secret="gemini-api-key-org_default" --project=storyvault-dev
```

## デプロイメント

### Cloud Runへのデプロイ

```bash
./deploy.sh
```

**重要**: deploy.shでは`--set-secrets`や`--set-env-vars`で秘匿情報を設定しません。
コード内から動的にSecret Managerを取得します。

## ローカル開発

ローカル環境でもSecret Managerから取得する場合:

```bash
# 1. GCPプロジェクト設定
export GOOGLE_CLOUD_PROJECT=storyvault-dev

# 2. gcloud認証（Application Default Credentials）
gcloud auth application-default login

# 3. IAM権限確認（自分のアカウントにsecretAccessor権限が必要）
gcloud secrets add-iam-policy-binding gemini-api-key-org_default \
  --member="user:your-email@example.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=storyvault-dev

# 4. サービス起動
python main.py
```

ローカル開発で環境変数を使用する場合（フォールバック）:

```bash
# .envファイルに設定
echo "GEMINI_API_KEY=YOUR_API_KEY" >> .env
echo "GOOGLE_CLOUD_PROJECT=storyvault-dev" >> .env

# サービス起動（環境変数があればそちらを優先使用）
python main.py
```

## トラブルシューティング

### Secretが存在しない場合

エラー:
```
Failed to get GEMINI_API_KEY from Secret Manager: 404
```

解決策:
```bash
# Secret作成
./scripts/create-secret.sh org_default "YOUR_GEMINI_API_KEY"
```

### IAM権限エラー

エラー:
```
403 Permission denied
```

解決策:
```bash
# Cloud RunサービスアカウントにIAM権限を付与
PROJECT_NUMBER=$(gcloud projects describe storyvault-dev --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding text-to-speech-with-google-gemini-api-key-org_default \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=storyvault-dev
```

### Secretの削除

```bash
gcloud secrets delete gemini-api-key-org_default --project=storyvault-dev
```

### Secretの更新

```bash
# 新しいバージョンを追加
echo -n "NEW_GEMINI_API_KEY" | \
  gcloud secrets versions add gemini-api-key-org_default \
    --data-file=- \
    --project=storyvault-dev
```

## セキュリティベストプラクティス

### ✅ 実施済み

- Secret Managerで秘匿情報を管理
- マルチテナント命名規則（organizationIdベース）
- コード内から動的にSecret取得
- IAM権限を最小化（secretAccessorロールのみ）

### ❌ 禁止事項

- 環境変数に平文でAPI Keyを保存
- deploy.shで`--set-secrets`を使用
- Gitリポジトリに.envファイルをコミット
- Secret名にorganizationIdを含めない

## 参照

- [gcp-secret-manager-guide.md](guideline/gcp-secret-manager-guide.md) - Secret Manager完全ガイド
- [GCP Secret Manager公式ドキュメント](https://cloud.google.com/secret-manager/docs)
- [Cloud Run Secrets](https://cloud.google.com/run/docs/configuring/secrets)
