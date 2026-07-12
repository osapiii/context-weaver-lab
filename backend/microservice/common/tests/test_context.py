"""
ExecutionContext ユニットテスト

ExecutionContext の基本機能をテストします：
- データの格納・取得
- クライアント管理
- エラー追跡
"""

import pytest
from datetime import datetime
from pydantic import BaseModel

from common.context import ExecutionContext, StepError


# ========== テスト用モデル ==========

class TestInput(BaseModel):
    project_id: str = "test-project"
    dataset_id: str = "test_dataset"


class TestMetadata(BaseModel):
    organization_id: str = "org_123"
    space_id: str = "space_456"


class TestRequest(BaseModel):
    request_id: str = "req_20250117_001"
    input: TestInput
    metadata: TestMetadata


# ========== テストケース ==========

class TestExecutionContext:
    """ExecutionContext の基本機能テスト"""

    @pytest.fixture
    def context(self) -> ExecutionContext:
        """テスト用コンテキストを作成"""
        request = TestRequest(
            request_id="req_test_001",
            input=TestInput(),
            metadata=TestMetadata()
        )
        return ExecutionContext(request)

    def test_context_initialization(self, context):
        """コンテキスト初期化の動作確認"""
        assert context.request_id == "req_test_001"
        assert context.organization_id == "org_123"
        assert context.space_id == "space_456"
        assert context.created_at is not None

    def test_get_set_data(self, context):
        """データの格納・取得"""
        # データを設定
        context.set('test_key', 'test_value')

        # 取得して確認
        assert context.get('test_key') == 'test_value'

        # デフォルト値確認
        assert context.get('nonexistent', 'default') == 'default'

    def test_data_exists(self, context):
        """データ存在確認"""
        context.set('my_data', {'key': 'value'})

        assert context.exists('my_data') is True
        assert context.exists('nonexistent') is False

    def test_type_safe_properties(self, context):
        """型安全なプロパティアクセス"""
        # DataFrame プロパティ
        test_df = {'rows': 100}
        context.df = test_df
        assert context.df == test_df

        # 統計情報プロパティ
        stats = [{'column': 'col1', 'type': 'STRING'}]
        context.columns_stats = stats
        assert context.columns_stats == stats

    def test_client_management(self, context):
        """クライアント管理"""
        # クライアント登録
        mock_client = {'type': 'mock_bigquery'}
        context.set_client('bigquery', mock_client)

        # 取得確認
        assert context.get_client('bigquery') == mock_client
        assert context.clients['bigquery'] == mock_client

    def test_error_tracking(self, context):
        """エラー追跡"""
        # 致命的エラー追加
        error1 = Exception("Step1 failed")
        context.add_error('step1', error1, severity='fatal')

        # 警告追加
        error2 = Exception("Step2 warning")
        context.add_error('step2', error2, severity='warning')

        # エラー確認
        assert context.has_errors() is True
        assert context.has_warnings() is True
        assert len(context.get_errors()) == 1
        assert len(context.get_warnings()) == 1

        # 最初のエラー取得
        first_error = context.get_first_error()
        assert first_error is not None
        assert first_error.severity == 'fatal'

    def test_context_summary(self, context):
        """コンテキストサマリー"""
        context.set('df', {'rows': 100})
        context.set('stats', {'mean': 50})
        context.set_client('bigquery', {})

        summary = context.summary()

        assert summary['request_id'] == 'req_test_001'
        assert 'df' in summary['data_keys']
        assert 'stats' in summary['data_keys']
        assert 'bigquery' in summary['client_names']
        assert summary['error_count'] == 0
        assert summary['warning_count'] == 0

    def test_context_repr(self, context):
        """コンテキスト文字列表現"""
        repr_str = repr(context)
        assert 'ExecutionContext' in repr_str
        assert 'req_test_001' in repr_str


class TestStepError:
    """StepError クラスのテスト"""

    def test_step_error_creation(self):
        """StepError 作成"""
        error = Exception("Test error")
        step_error = StepError('step1_fetch', error, severity='fatal')

        assert step_error.step_name == 'step1_fetch'
        assert step_error.severity == 'fatal'
        assert 'Test error' in str(step_error)

    def test_step_error_string_representation(self):
        """エラーの文字列表現"""
        error = Exception("Timeout")
        step_error = StepError('step3_ai', error, severity='warning')

        str_repr = str(step_error)
        assert '[WARNING]' in str_repr
        assert 'step3_ai' in str_repr
        assert 'Timeout' in str_repr


# ========== 統合テスト ==========

class TestExecutionContextIntegration:
    """複合シナリオのテスト"""

    def test_multi_step_execution_flow(self):
        """マルチステップ実行フロー"""
        # コンテキスト作成
        request = TestRequest(
            request_id="req_flow_001",
            input=TestInput(project_id="flow-project"),
            metadata=TestMetadata()
        )
        context = ExecutionContext(request)

        # Step 1: データ取得
        context.set('df', {'rows': 1000})
        assert context.df is not None

        # Step 2: 統計計算
        context.columns_stats = [
            {'column': 'id', 'type': 'INTEGER'},
            {'column': 'name', 'type': 'STRING'}
        ]
        assert len(context.columns_stats) == 2

        # Step 3: 失敗でも継続
        context.add_error('step3_ai', Exception("AI timeout"), severity='warning')
        assert context.has_errors() is False  # Fatal only
        assert context.has_warnings() is True

        # ステップ完了
        context.output = {
            'status': 'success',
            'rows_analyzed': 1000
        }
        assert context.output['status'] == 'success'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
