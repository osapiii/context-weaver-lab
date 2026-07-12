"""
Initializer ユニットテスト

initialize() 関数と初期化ロジックをテストします：
- リクエスト検証
- ExecutionContext 作成
- バリデーションエラー処理
"""

import pytest
from pydantic import BaseModel, ValidationError as PydanticValidationError

from common.initializer import (
    initialize,
    validate_request,
    create_test_context
)
from common.errors import ValidationError, InitializationError
from common.context import ExecutionContext


# ========== テスト用モデル ==========

class ValidInput(BaseModel):
    project_id: str = "test-project"
    dataset_id: str = "test_dataset"


class ValidMetadata(BaseModel):
    organization_id: str = "org_123"
    space_id: str = "space_456"


class ValidRequest(BaseModel):
    request_id: str
    input: ValidInput
    metadata: ValidMetadata


class InvalidRequest(BaseModel):
    # request_id がない（必須フィールド不足）
    input: ValidInput
    metadata: ValidMetadata


# ========== テストケース ==========

class TestValidateRequest:
    """validate_request() 関数のテスト"""

    def test_valid_request(self):
        """有効なリクエストの検証"""
        request_dict = {
            'request_id': 'req_001',
            'input': {'project_id': 'my-project', 'dataset_id': 'my_dataset'},
            'metadata': {'organization_id': 'org_123', 'space_id': 'space_456'}
        }

        result = validate_request(request_dict, ValidRequest)
        assert isinstance(result, ValidRequest)
        assert result.request_id == 'req_001'

    def test_invalid_request_missing_field(self):
        """必須フィールド不足"""
        request_dict = {
            'input': {'project_id': 'my-project'},
            # request_id が不足
            'metadata': {'organization_id': 'org_123'}
        }

        with pytest.raises(ValidationError):
            validate_request(request_dict, ValidRequest)

    def test_invalid_request_wrong_type(self):
        """フィールド型の不正"""
        request_dict = {
            'request_id': 123,  # str でなく int
            'input': {'project_id': 'my-project'},
            'metadata': {'organization_id': 'org_123'}
        }

        # Pydantic は型強制なので実際は問題ないが、チェック
        result = validate_request(request_dict, ValidRequest)
        assert result.request_id == '123'  # 強制変換される


class TestInitialize:
    """initialize() 関数のテスト"""

    def test_initialize_success(self):
        """正常な初期化"""
        request = ValidRequest(
            request_id='req_init_001',
            input=ValidInput(project_id='init-project'),
            metadata=ValidMetadata()
        )

        context = initialize(request)

        assert isinstance(context, ExecutionContext)
        assert context.request_id == 'req_init_001'
        assert context.organization_id == 'org_123'

    def test_initialize_with_missing_request_id(self):
        """request_id 不足"""
        class IncompleteRequest(BaseModel):
            input: ValidInput
            metadata: ValidMetadata

        request = IncompleteRequest(
            input=ValidInput(),
            metadata=ValidMetadata()
        )

        with pytest.raises(ValidationError) as exc_info:
            initialize(request)

        assert "request_id" in str(exc_info.value)

    def test_initialize_with_non_basemodel(self):
        """非 BaseModel オブジェクト"""
        with pytest.raises(ValidationError):
            initialize({'request_id': 'test'})  # dict ではなく BaseModel 必須


class TestCreateTestContext:
    """create_test_context() 関数のテスト"""

    def test_create_test_context(self):
        """テスト用コンテキスト作成"""
        request = ValidRequest(
            request_id='test_context_001',
            input=ValidInput(),
            metadata=ValidMetadata()
        )

        context = create_test_context(request)

        assert isinstance(context, ExecutionContext)
        assert context.request_id == 'test_context_001'

        # クライアント初期化がされていない（テスト用）
        assert len(context.clients) == 0


# ========== 統合テスト ==========

class TestInitializationIntegration:
    """初期化の統合テスト"""

    def test_full_initialization_flow(self):
        """完全な初期化フロー"""
        # 1. リクエスト検証
        request_dict = {
            'request_id': 'req_integration_001',
            'input': {'project_id': 'integration-project', 'dataset_id': 'test_data'},
            'metadata': {'organization_id': 'org_abc', 'space_id': 'space_xyz'}
        }

        validated_request = validate_request(request_dict, ValidRequest)
        assert validated_request.request_id == 'req_integration_001'

        # 2. コンテキスト初期化
        context = initialize(validated_request)

        # 3. 初期化完了確認
        assert context.request_id == 'req_integration_001'
        assert context.input_data.project_id == 'integration-project'
        assert context.organization_id == 'org_abc'

        # 4. データ操作テスト
        context.set('test_data', {'key': 'value'})
        assert context.get('test_data') == {'key': 'value'}


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
