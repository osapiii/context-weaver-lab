"""
Case Converter モジュール - 全マイクロサービス共通実装

snake_caseからcamelCaseへの変換を提供。
CloudRunのOutputをNuxt3側（TypeScript）のcamelCase規約に統一します。

⚠️ CRITICAL: CloudRunはPython内部でsnake_caseで実装するが、
           ResponseFormatter.success()でcamelCaseに自動変換します。
"""

from typing import Dict, Any, List, Union


def to_camel_case(snake_str: str) -> str:
    """
    snake_caseをcamelCaseに変換

    params: {
        snake_str: str - snake_case文字列
    }

    returns: str - camelCase文字列

    例:
        "transcription_bucket_name" → "transcriptionBucketName"
        "processing_time" → "processingTime"
    """
    if not snake_str:
        return snake_str

    components = snake_str.split('_')
    # 最初の単語はそのまま、残りの単語は先頭を大文字化
    return components[0] + ''.join(x.title() for x in components[1:])


def convert_keys_to_camel_case(data: Any) -> Any:
    """
    辞書のキーを再帰的にsnake_caseからcamelCaseに変換

    params: {
        data: Any - 変換対象のデータ（dict, list, または基本型）
    }

    returns: Any - camelCaseに変換されたデータ

    notes:
        - 辞書のキーのみ変換、値は型に応じて再帰的に処理
        - リスト内の辞書も再帰的に変換
        - 文字列、数値などの基本型はそのまま返却

    例:
        {
            "transcription_bucket_name": "bucket",
            "nested_data": {
                "file_path": "path/to/file"
            },
            "items": [
                {"item_name": "item1"}
            ]
        }
        →
        {
            "transcriptionBucketName": "bucket",
            "nestedData": {
                "filePath": "path/to/file"
            },
            "items": [
                {"itemName": "item1"}
            ]
        }
    """
    if isinstance(data, dict):
        camel_dict = {}
        for key, value in data.items():
            camel_key = to_camel_case(key)
            camel_dict[camel_key] = convert_keys_to_camel_case(value)
        return camel_dict

    elif isinstance(data, list):
        return [convert_keys_to_camel_case(item) for item in data]

    else:
        # 基本型（str, int, float, bool, None等）はそのまま返却
        return data
