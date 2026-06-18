"""
ExecutionContext - マイクロサービス統一アーキテクチャ用コンテキストオブジェクト

各エンドポイント実行時の状態を一元管理し、initializer → execute.py → steps を通じた
統一的なデータフローと制御フローを実現します。

責務:
- リクエストデータの保持（request_id, input, operation_metadata）
- ステップ間の中間データ管理
- 外部クライアント（BigQuery, GCS, Firestore）の管理
- エラー状態の追跡
- 型安全なデータアクセス（get/setメソッド）

使用パターン:
    context = ExecutionContext(request_data)

    # ステップ内でのアクセス
    input_data = context.input_data
    metadata = context.operation_metadata
    context.set('result', computed_result)

    # 型安全なプロパティアクセス（IDE補完あり）
    org_id = context.organization_id
    space_id = context.space_id
"""

from typing import Any, Dict, Optional, List, TypedDict
from pydantic import BaseModel
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class StepError:
    """ステップ実行エラーの情報を保持"""
    def __init__(self, step_name: str, error: Exception, severity: str = 'fatal'):
        self.step_name = step_name
        self.error = error
        self.severity = severity  # 'fatal' or 'warning'
        self.timestamp = datetime.utcnow()
        self.message = str(error)

    def __str__(self):
        return f"[{self.severity.upper()}] {self.step_name}: {self.message}"


class ExecutionContext:
    """
    マイクロサービス実行の統一コンテキスト

    ライフサイクル:
    1. initializer.initialize() で作成
    2. execute.py で各step実行、データ追加
    3. ResponseFormatter で最終レスポンス構築

    Attributes:
        request_data (BaseModel): 元のRequestDocオブジェクト
        _data (Dict[str, Any]): キー・バリューストア（中間データなど）
        _clients (Dict[str, Any]): 初期化済みクライアント管理
        _errors (List[StepError]): ステップ実行エラー履歴
        created_at (datetime): コンテキスト作成時刻
    """

    def __init__(self, request_data: BaseModel):
        """
        ExecutionContextを初期化

        Args:
            request_data: RequestDoc準拠のPydanticモデル
                - request_id: リクエスト識別子
                - input: 処理パラメータ
                - operation_metadata: メタデータ（organizationId, spaceId等）
        """
        self.request_data = request_data
        self._data: Dict[str, Any] = {}
        self._clients: Dict[str, Any] = {}
        self._errors: List[StepError] = []
        self._warnings: List[StepError] = []
        self.created_at = datetime.utcnow()

        # RequestDocから基本情報を自動抽出
        self._extract_request_data()

        logger.debug(f"ExecutionContext initialized: request_id={self.request_id}")

    def _extract_request_data(self) -> None:
        """RequestDocから基本情報を抽出してデータストアに保存"""
        # request_id
        if hasattr(self.request_data, 'request_id'):
            self._data['request_id'] = self.request_data.request_id

        # input（コマンド）
        if hasattr(self.request_data, 'input'):
            self._data['input'] = self.request_data.input

        # operation_metadata (RequestDoc準拠)
        if hasattr(self.request_data, 'operation_metadata'):
            self._data['operation_metadata'] = self.request_data.operation_metadata

        # 組織ID、スペースID（マルチテナント対応）
        if hasattr(self.request_data, 'operation_metadata'):
            operation_metadata = self.request_data.operation_metadata
            if hasattr(operation_metadata, 'organization_id'):
                self._data['organization_id'] = operation_metadata.organization_id
            if hasattr(operation_metadata, 'space_id'):
                self._data['space_id'] = operation_metadata.space_id

    # ========== 基本情報アクセス ==========

    @property
    def request_id(self) -> str:
        """リクエストID取得（必須）"""
        return self._data.get('request_id', 'unknown')

    @property
    def request(self) -> BaseModel:
        """元のRequestDocオブジェクト取得"""
        return self.request_data

    @property
    def input_data(self) -> Any:
        """入力データ（コマンド）取得"""
        return self._data.get('input')

    @property
    def metadata(self) -> Any:
        """メタデータ取得 (operation_metadataのエイリアス)"""
        return self._data.get('operation_metadata')

    @property
    def operation_metadata(self) -> Any:
        """operation_metadataを取得 (RequestDoc準拠の公式プロパティ)"""
        return self._data.get('operation_metadata')

    @property
    def organization_id(self) -> Optional[str]:
        """組織ID取得（マルチテナント対応）"""
        return self._data.get('organization_id')

    @property
    def space_id(self) -> Optional[str]:
        """スペースID取得（マルチテナント対応）"""
        return self._data.get('space_id')

    @property
    def logger(self) -> Optional[Any]:
        """ロガーインスタンス取得（initializer で設定）

        Returns:
            Logger インスタンス（Firestore 統合サポート）または None
        """
        return self._data.get('logger')

    # ========== クライアント管理 ==========

    @property
    def clients(self) -> Dict[str, Any]:
        """初期化済みクライアント取得（BigQuery, GCS, Firestore等）"""
        return self._clients

    def set_client(self, name: str, client: Any) -> None:
        """クライアントを登録

        Args:
            name: クライアント名（'bigquery', 'gcs', 'firestore'等）
            client: クライアントオブジェクト
        """
        self._clients[name] = client
        logger.debug(f"Client registered: {name}")

    def get_client(self, name: str) -> Optional[Any]:
        """クライアント取得

        Args:
            name: クライアント名

        Returns:
            クライアントオブジェクト、または None
        """
        return self._clients.get(name)

    # ========== 汎用データストア (get/set) ==========

    def get(self, key: str, default: Any = None) -> Any:
        """任意のキーでデータを取得（後方互換性）

        使用例:
            input_data = context.get('input')
            df = context.get('df')
            stats = context.get('columns_stats')

        Args:
            key: キー名
            default: キーが存在しない場合のデフォルト値

        Returns:
            保存されていたデータ、またはデフォルト値
        """
        return self._data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """任意のキーでデータを保存

        使用例:
            context.set('df', fetched_dataframe)
            context.set('columns_stats', calculated_stats)

        Args:
            key: キー名
            value: 保存するデータ
        """
        self._data[key] = value
        logger.debug(f"Context data stored: {key}")

    def exists(self, key: str) -> bool:
        """キーが存在するか確認

        Args:
            key: キー名

        Returns:
            キーが存在する場合 True
        """
        return key in self._data

    def get_all_data(self) -> Dict[str, Any]:
        """全データを取得（内部用途）"""
        return dict(self._data)

    # ========== 型安全なプロパティアクセス ==========
    # IDE補完とスタティックタイプチェックをサポート

    @property
    def df(self) -> Optional['Any']:  # pd.DataFrame
        """DataFrameアクセス（BigQuery→Pandas変換結果）"""
        return self._data.get('df')

    @df.setter
    def df(self, value: Any) -> None:
        """DataFrame設定"""
        self.set('df', value)

    @property
    def columns_stats(self) -> Optional[List[Dict[str, Any]]]:
        """列統計情報アクセス"""
        return self._data.get('columns_stats')

    @columns_stats.setter
    def columns_stats(self, value: List[Dict[str, Any]]) -> None:
        """列統計情報設定"""
        self.set('columns_stats', value)

    @property
    def overall_stats(self) -> Optional[Dict[str, Any]]:
        """全体統計情報アクセス"""
        return self._data.get('overall_stats')

    @overall_stats.setter
    def overall_stats(self, value: Dict[str, Any]) -> None:
        """全体統計情報設定"""
        self.set('overall_stats', value)

    @property
    def descriptions(self) -> Optional[Dict[str, str]]:
        """AIエラー説明アクセス"""
        return self._data.get('descriptions')

    @descriptions.setter
    def descriptions(self, value: Dict[str, str]) -> None:
        """AI説明設定"""
        self.set('descriptions', value)

    @property
    def output(self) -> Optional[Dict[str, Any]]:
        """最終出力データアクセス"""
        return self._data.get('output')

    @output.setter
    def output(self, value: Dict[str, Any]) -> None:
        """最終出力データ設定"""
        self.set('output', value)

    # ========== エラー管理 ==========

    def add_error(self, step_name: str, error: Exception, severity: str = 'fatal') -> None:
        """ステップエラーを記録

        Args:
            step_name: ステップ名（'step1_fetch_data'等）
            error: キャッチした例外オブジェクト
            severity: エラー重度（'fatal' or 'warning'）
        """
        step_error = StepError(step_name, error, severity)

        if severity == 'fatal':
            self._errors.append(step_error)
            logger.error(f"Fatal error in {step_name}: {error}", exc_info=True)
        else:
            self._warnings.append(step_error)
            logger.warning(f"Warning in {step_name}: {error}")

    def has_errors(self) -> bool:
        """致命的エラーが存在するか確認"""
        return len(self._errors) > 0

    def has_warnings(self) -> bool:
        """警告が存在するか確認"""
        return len(self._warnings) > 0

    def get_errors(self) -> List[StepError]:
        """全致命的エラーを取得"""
        return list(self._errors)

    def get_warnings(self) -> List[StepError]:
        """全警告を取得"""
        return list(self._warnings)

    def get_first_error(self) -> Optional[StepError]:
        """最初の致命的エラーを取得"""
        return self._errors[0] if self._errors else None

    def clear_errors(self) -> None:
        """エラー履歴をクリア（テスト用）"""
        self._errors.clear()
        self._warnings.clear()

    # ========== デバッグ用メソッド ==========

    def summary(self) -> Dict[str, Any]:
        """コンテキスト状態のサマリー取得

        Returns:
            {
                'request_id': '...',
                'data_keys': ['input', 'metadata', 'df', 'columns_stats', ...],
                'clients': ['bigquery', 'gcs', 'firestore'],
                'errors': [error_count],
                'warnings': [warning_count],
                'elapsed_time': 1.234
            }
        """
        elapsed = (datetime.utcnow() - self.created_at).total_seconds()

        return {
            'request_id': self.request_id,
            'data_keys': list(self._data.keys()),
            'client_names': list(self._clients.keys()),
            'error_count': len(self._errors),
            'warning_count': len(self._warnings),
            'elapsed_seconds': round(elapsed, 3),
            'created_at': self.created_at.isoformat()
        }

    def __repr__(self) -> str:
        """コンテキスト情報の文字列表現"""
        return (
            f"<ExecutionContext request_id={self.request_id} "
            f"data={len(self._data)} clients={len(self._clients)} "
            f"errors={len(self._errors)}>"
        )
