"""
Parent Path Manager モジュール - 全マイクロサービス共通実装

Firestore/GCS への書き込み時の親パスを一元管理するモジュール。
マルチテナント対応（organizationId/spaceId ベース）のパス生成を標準化します。

依存関係:
    - systemMetadata.organizationId (必須)
    - systemMetadata.spaceId (必須)
    - systemMetadata.loggingCollectionId (Logging 用パス生成時に必須)
    - systemMetadata.loggingDocumentId (Logging 用パス生成時に必須)

設計原則:
    1. マルチテナント対応: organizationId/spaceId の組み合わせでデータ分離
    2. 3 系統のパス管理: Firestore Collection パス、GCS パス、Logging 用パス
    3. 責務の一元化: パス生成ロジックを本モジュールに集約
    4. Firebase BG 関数との整合性: buildCollectionPath() と同等の責務

使用例:
    >>> from localPackages.common.parent_path_manager import ParentPathManager
    >>> path_manager = ParentPathManager("org_abc123", "space_xyz789")
    >>> firestore_path = path_manager.build_firestore_collection_path("videos")
    >>> # "organizations/org_abc123/spaces/space_xyz789/videos"
"""

from typing import Optional

from .logger import logger


class ParentPathManager:
    """
    親パス管理クラス

    Firestore/GCS への書き込み時の親パスを一元管理します。
    マルチテナント対応（organizationId/spaceId ベース）のパス生成を提供します。
    """

    def __init__(self, params: dict):
        """
        親パス管理マネージャーを初期化

        params: {
            organization_id: str - 組織ID (必須),
            space_id: str - スペースID (必須)
        }

        raises:
            ValueError - organization_id または space_id が空の場合

        notes:
            - マルチテナント対応の要となる 2 つの ID を必須パラメータとする
            - 全てのパス生成メソッドでこの 2 つの ID を使用する
        """
        organization_id = params.get("organization_id")
        space_id = params.get("space_id")

        if not organization_id:
            raise ValueError("organization_id is required for ParentPathManager")
        if not space_id:
            raise ValueError("space_id is required for ParentPathManager")

        self.organization_id = organization_id
        self.space_id = space_id

        logger.info(
            f"🔧 ParentPathManager initialized: "
            f"organizationId={organization_id}, spaceId={space_id}"
        )

    def build_firestore_collection_path(
        self, params: dict
    ) -> str:
        """
        Firestore Collection パスを生成

        params: {
            collection_type: str - コレクション種別（例: "videos", "projects", "requests"）,
            subcollection: Optional[str] - サブコレクション名（オプション）
        }

        returns: str - Firestore Collection パス

        notes:
            - 基本構造: organizations/{organizationId}/spaces/{spaceId}/{collectionType}
            - サブコレクション指定時: .../spaces/{spaceId}/{collectionType}/{subcollection}
            - Firebase BG 関数の buildCollectionPath() と同等の責務

        例:
            >>> manager = ParentPathManager({"organization_id": "org_abc123", "space_id": "space_xyz789"})
            >>> manager.build_firestore_collection_path({"collection_type": "videos"})
            "organizations/org_abc123/spaces/space_xyz789/videos"
            >>> manager.build_firestore_collection_path({"collection_type": "videos", "subcollection": "metadata"})
            "organizations/org_abc123/spaces/space_xyz789/videos/metadata"
        """
        collection_type = params.get("collection_type")
        subcollection = params.get("subcollection")

        base_path = (
            f"organizations/{self.organization_id}/spaces/{self.space_id}/{collection_type}"
        )

        if subcollection:
            return f"{base_path}/{subcollection}"
        return base_path

    def build_gcs_parent_path(
        self, params: dict
    ) -> str:
        """
        GCS バケット内の親パスを生成

        params: {
            resource_type: str - リソース種別（例: "videos", "audios", "images"）,
            additional_segments: Optional[list[str]] - 追加セグメント（オプション）
        }

        returns: str - GCS バケット内の親パス

        notes:
            - 基本構造: {organizationId}/{spaceId}/{resourceType}
            - 追加セグメント指定時: {organizationId}/{spaceId}/{resourceType}/{segment1}/{segment2}/...
            - 実際の書き込み時はこのパスに続けてファイル名を結合する

        例:
            >>> manager = ParentPathManager({"organization_id": "org_abc123", "space_id": "space_xyz789"})
            >>> manager.build_gcs_parent_path({"resource_type": "videos"})
            "org_abc123/space_xyz789/videos"
            >>> manager.build_gcs_parent_path({"resource_type": "videos", "additional_segments": ["project_123", "original"]})
            "org_abc123/space_xyz789/videos/project_123/original"
        """
        resource_type = params.get("resource_type")
        additional_segments = params.get("additional_segments")

        base_path = f"{self.organization_id}/{self.space_id}/{resource_type}"

        if additional_segments:
            segments_str = "/".join(additional_segments)
            return f"{base_path}/{segments_str}"
        return base_path

    def build_logging_path(
        self, params: dict
    ) -> str:
        """
        Logging 用パスを生成

        params: {
            logging_collection_id: str - Logging Collection ID,
            logging_document_id: str - Logging Document ID
        }

        returns: str - Firestore Logging パス

        raises:
            ValueError - logging_collection_id または logging_document_id が空の場合

        notes:
            - 構造: {loggingCollectionId}/{loggingDocumentId}
            - Firestore ログ記録時にこのメソッドを使用

        例:
            >>> manager = ParentPathManager({"organization_id": "org_abc123", "space_id": "space_xyz789"})
            >>> manager.build_logging_path({
            ...     "logging_collection_id": "organizations/org_abc123/requests/videoTranscriptionRequests/logs",
            ...     "logging_document_id": "req_20250107_abc123"
            ... })
            "organizations/org_abc123/requests/videoTranscriptionRequests/logs/req_20250107_abc123"
        """
        logging_collection_id = params.get("logging_collection_id")
        logging_document_id = params.get("logging_document_id")

        if not logging_collection_id:
            raise ValueError(
                "logging_collection_id is required for build_logging_path()"
            )
        if not logging_document_id:
            raise ValueError(
                "logging_document_id is required for build_logging_path()"
            )

        return f"{logging_collection_id}/{logging_document_id}"

    def validate_system_metadata(self, params: dict) -> tuple[bool, Optional[str]]:
        """
        systemMetadata フィールドの必須項目を検証

        params: {
            systemMetadata: dict - systemMetadata オブジェクト,
            require_logging_fields: bool - Logging 用フィールドを必須にするか（デフォルト: False）
        }

        returns: tuple[bool, Optional[str]] - (検証成功, エラーメッセージ)

        notes:
            - マルチテナント対応の必須フィールドを検証
            - organizationId と spaceId の存在チェック
            - Logging 用フィールドの存在チェック（オプション）

        例:
            >>> manager = ParentPathManager({"organization_id": "org_abc123", "space_id": "space_xyz789"})
            >>> valid, error = manager.validate_system_metadata({
            ...     "systemMetadata": {
            ...         "organizationId": "org_abc123",
            ...         "spaceId": "space_xyz789",
            ...         "loggingCollectionId": "organizations/org_abc123/requests/logs",
            ...         "loggingDocumentId": "req_20250107_abc123"
            ...     }
            ... })
            >>> print(valid)
            True
        """
        system_metadata = params.get("systemMetadata", {})
        require_logging_fields = params.get("require_logging_fields", False)

        # 必須フィールド: organizationId, spaceId
        if not system_metadata.get("organizationId"):
            return False, "systemMetadata.organizationId is required"
        if not system_metadata.get("spaceId"):
            return False, "systemMetadata.spaceId is required"

        # 初期化時の ID と一致するかチェック
        if system_metadata.get("organizationId") != self.organization_id:
            return False, "systemMetadata.organizationId does not match ParentPathManager.organization_id"
        if system_metadata.get("spaceId") != self.space_id:
            return False, "systemMetadata.spaceId does not match ParentPathManager.space_id"

        if require_logging_fields:
            if not system_metadata.get("loggingCollectionId"):
                return False, "systemMetadata.loggingCollectionId is required"
            if not system_metadata.get("loggingDocumentId"):
                return False, "systemMetadata.loggingDocumentId is required"

        return True, None
