"""
Error Hierarchy ユニットテスト

エラー分類とエラーハンドリングをテストします：
- FatalStepError vs RecoverableStepError
- エラー分類ロジック
- エラー情報取得
"""

import pytest

from common.errors import (
    MicroserviceError,
    FatalStepError,
    RecoverableStepError,
    ValidationError,
    InitializationError,
    BigQueryError,
    GCSError,
    LLMProxyError,
    classify_error,
    should_retry,
)


# ========== テストケース ==========

class TestMicroserviceError:
    """基底エラークラスのテスト"""

    def test_microservice_error_creation(self):
        """エラー作成"""
        error = MicroserviceError("Test error message", error_code="TEST_ERROR")

        assert error.message == "Test error message"
        assert error.error_code == "TEST_ERROR"
        assert error.severity == 'unknown'

    def test_microservice_error_to_dict(self):
        """エラーの辞書変換"""
        error = MicroserviceError(
            "Connection failed",
            error_code="CONN_ERROR",
            context={'service': 'bigquery'}
        )

        error_dict = error.to_dict()

        assert error_dict['message'] == "Connection failed"
        assert error_dict['code'] == "CONN_ERROR"
        assert error_dict['context']['service'] == 'bigquery'


class TestFatalStepError:
    """致命的エラーのテスト"""

    def test_fatal_step_error_creation(self):
        """致命的エラー作成"""
        error = FatalStepError(
            'step1_fetch_data',
            'DataFrame is empty'
        )

        assert error.step_name == 'step1_fetch_data'
        assert error.severity == 'fatal'
        assert 'DataFrame is empty' in str(error)

    def test_fatal_step_error_string_repr(self):
        """エラー文字列表現"""
        error = FatalStepError('step2_stats', 'Invalid data type')

        str_repr = str(error)
        assert '[FATAL]' in str_repr
        assert 'step2_stats' in str_repr


class TestRecoverableStepError:
    """回復可能エラーのテスト"""

    def test_recoverable_step_error_creation(self):
        """回復可能エラー作成"""
        error = RecoverableStepError(
            'step3_ai_description',
            'AI service timeout'
        )

        assert error.step_name == 'step3_ai_description'
        assert error.severity == 'warning'
        assert 'AI service timeout' in str(error)

    def test_recoverable_step_error_string_repr(self):
        """エラー文字列表現"""
        error = RecoverableStepError('step4_schema', 'Schema update failed')

        str_repr = str(error)
        assert '[WARNING]' in str_repr
        assert 'step4_schema' in str_repr


class TestValidationError:
    """検証エラーのテスト"""

    def test_validation_error(self):
        """バリデーションエラー"""
        validation_errors = {
            'request_id': {'message': 'required', 'type': 'value_error'},
            'input.project_id': {'message': 'invalid value', 'type': 'value_error'}
        }

        error = ValidationError(
            "Request validation failed",
            validation_errors=validation_errors
        )

        assert error.error_code == 'VALIDATION_ERROR'
        assert error.severity == 'fatal'
        assert error.context['validation_errors']['request_id']['message'] == 'required'


class TestResourceErrors:
    """リソースアクセスエラーのテスト"""

    def test_bigquery_error(self):
        """BigQuery エラー"""
        error = BigQueryError(
            "Query timeout",
            table_uri="project.dataset.table"
        )

        assert error.error_code == 'BIGQUERY_ERROR'
        assert error.context['table_uri'] == "project.dataset.table"

    def test_gcs_error(self):
        """GCS エラー"""
        error = GCSError(
            "File not found",
            bucket_name="my-bucket",
            path="data/file.json"
        )

        assert error.error_code == 'GCS_ERROR'
        assert error.context['bucket_name'] == "my-bucket"
        assert error.context['path'] == "data/file.json"

    def test_llm_proxy_error(self):
        """LLM Proxy エラー"""
        error = LLMProxyError(
            "Service unavailable",
            status_code=503
        )

        assert error.error_code == 'LLM_PROXY_ERROR'
        assert error.severity == 'warning'  # 外部サービスは warning
        assert error.context['status_code'] == 503


class TestErrorClassification:
    """エラー分類ロジックのテスト"""

    def test_classify_fatal_error(self):
        """致命的エラーの分類"""
        error = FatalStepError('step1', 'Failed')

        assert classify_error(error) == 'fatal'

    def test_classify_recoverable_error(self):
        """回復可能エラーの分類"""
        error = RecoverableStepError('step3', 'Timeout')

        assert classify_error(error) == 'warning'

    def test_classify_custom_error(self):
        """カスタム MicroserviceError の分類"""
        error = MicroserviceError("Test", error_code="CUSTOM")
        error.severity = 'info'

        assert classify_error(error) == 'info'

    def test_classify_unknown_error(self):
        """標準例外の分類"""
        error = ValueError("Invalid value")

        assert classify_error(error) == 'unknown'


class TestShouldRetry:
    """リトライ判定のテスト"""

    def test_should_retry_timeout(self):
        """タイムアウトはリトライ対象"""
        from common.errors import TimeoutError as MicroserviceTimeoutError

        error = MicroserviceTimeoutError('operation', 30)

        assert should_retry(error) is True

    def test_should_retry_microservice_error_with_retry_code(self):
        """リトライ対象エラーコード"""
        # エラーを手動で作成
        error = MicroserviceError("Service unavailable", error_code="SERVICE_UNAVAILABLE")

        # この場合は should_retry は False を返す（コードが異なるため）
        assert should_retry(error) is False

    def test_should_retry_fatal_error(self):
        """致命的エラーはリトライ対象外"""
        error = FatalStepError('step1', 'Invalid data')

        assert should_retry(error) is False

    def test_should_retry_connection_error(self):
        """接続エラーはリトライ対象"""
        error = ConnectionError("Connection refused")

        assert should_retry(error) is True


# ========== 統合テスト ==========

class TestErrorHandlingIntegration:
    """エラー処理の統合テスト"""

    def test_error_flow_with_classification(self):
        """エラー分類を用いた処理フロー"""
        errors = [
            FatalStepError('step1', 'Data fetch failed'),
            RecoverableStepError('step3', 'AI description skipped'),
            LLMProxyError('Service timeout', 504)
        ]

        fatal_count = sum(1 for e in errors if classify_error(e) == 'fatal')
        warning_count = sum(1 for e in errors if classify_error(e) == 'warning')

        assert fatal_count == 1
        assert warning_count == 2

    def test_retry_strategy_selection(self):
        """リトライ戦略の選択"""
        errors = [
            FatalStepError('step1', 'Invalid request'),  # リトライしない
            RecoverableStepError('step3', 'Timeout'),    # リトライしない（warning）
            ConnectionError("Network error")              # リトライする
        ]

        retry_candidates = [e for e in errors if should_retry(e)]

        assert len(retry_candidates) == 1
        assert isinstance(retry_candidates[0], ConnectionError)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
