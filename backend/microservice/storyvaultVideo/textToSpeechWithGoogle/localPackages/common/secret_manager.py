"""
Secret Manager クライアント - 全マイクロサービス共通実装

Google Cloud Secret Managerから秘匿情報を取得するモジュール。
マルチテナント対応（organizationIdベース）のSecret取得を提供。

⚠️ ステアリングドキュメント準拠:
@guideline/gcp-secret-manager-guide.md
@guideline/cloud-run-microservice-architecture.md
"""

import os
from google.cloud import secretmanager
from typing import Optional


class SecretManager:
    """マルチテナント対応Secret Manager クライアント"""

    def __init__(self, project_id: Optional[str] = None):
        """
        Secret Managerクライアントを初期化

        params: {
            project_id: Optional[str] - GCPプロジェクトID（省略時は環境変数から取得）
        }
        """
        self.project_id = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT")
        if not self.project_id:
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable is required")

        self.client = secretmanager.SecretManagerServiceClient()

    def get_api_key(self, organization_id: str, key_type: str) -> str:
        """
        organizationIdベースでAPI Keyを動的取得

        params: {
            organization_id: str - metadataから取得した組織ID,
            key_type: str - キータイプ（例: "gemini-api-key", "openai-api-key"）
        }

        returns: str - API Key

        raises: ValueError - Secret取得失敗時

        使用例:
            sm = SecretManager()
            api_key = sm.get_api_key(
                organization_id="org_abc123",
                key_type="gemini-api-key"
            )
        """
        # ⚠️ CRITICAL: マルチテナント命名規則 - {key-type}-{organization-id}
        # サービス名は含めない（organizationIdベースで一意）
        secret_id = f"{key_type}-{organization_id}"
        name = f"projects/{self.project_id}/secrets/{secret_id}/versions/latest"

        try:
            response = self.client.access_secret_version(request={"name": name})
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            raise ValueError(
                f"Failed to access secret '{secret_id}' for organization '{organization_id}': {str(e)}"
            )


# ✅ 使用例（endpoints/*/execute.py内で使用）
# from localPackages.common.secret_manager import SecretManager
#
# def handle(ctx):
#     # RequestDoc黄金テンプレートのmetadataからorganizationIdを取得
#     organization_id = ctx.get_param("metadata", {}).get("organizationId")
#     if not organization_id:
#         raise ValueError("organizationId is required in metadata")
#
#     # Secret Managerクライアント初期化
#     sm = SecretManager()
#
#     # organizationIdに応じた適切なAPI Keyを動的取得
#     api_key = sm.get_api_key(organization_id, "gemini-api-key")
