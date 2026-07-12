"""
Case Converter Utility - Unified Implementation for All CloudRun Microservices

Provides snake_case to camelCase conversion for JSON responses.
CloudRun implementation uses snake_case internally but converts to camelCase for frontend compatibility.

Design:
- All Python code uses snake_case (Python convention)
- ResponseFormatter automatically converts snake_case → camelCase in JSON responses
- Recursive conversion for nested objects and arrays
"""

from typing import Dict, Any, List, Union


def to_camel_case(snake_str: str) -> str:
    """
    Convert snake_case string to camelCase.

    Args:
        snake_str: String in snake_case format

    Returns:
        String in camelCase format

    Example:
        "transcription_bucket_name" → "transcriptionBucketName"
        "processing_time" → "processingTime"
    """
    if not snake_str:
        return snake_str

    components = snake_str.split('_')
    # First word stays lowercase, rest are title-cased
    return components[0] + ''.join(x.title() for x in components[1:])


def convert_keys_to_camel_case(data: Any) -> Any:
    """
    Recursively convert dictionary keys from snake_case to camelCase.

    Handles nested dictionaries and arrays recursively.

    Args:
        data: Data structure to convert (dict, list, or primitive type)

    Returns:
        Data with keys converted to camelCase

    Notes:
        - Only dictionary keys are converted
        - Values are processed recursively based on type
        - Primitive types (str, int, float, bool, None) are returned unchanged
        - Lists and nested dicts are processed recursively

    Example:
        Input:
        {
            "transcription_bucket_name": "bucket",
            "nested_data": {
                "file_path": "path/to/file"
            },
            "items": [
                {"item_name": "item1"}
            ]
        }

        Output:
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
        # Primitive types (str, int, float, bool, None, etc.) returned as-is
        return data
