"""
Step 2: Gemini structuredOutputで動画分析

Gemini APIを使用して動画を分析し、適切なセクション分割ポイントを取得します。
マルチリージョン対応のRetry機構を実装しています。
google.genaiパッケージを使用した最新実装です。
"""

import json
import time
import os
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types

from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import firestore_client

# google.genaiパッケージのインポート確認
try:
    logger.info("✅ google.genai SDK imported")
except Exception as e:
    logger.error(f"❌ Failed to import google.genai SDK: {e}")
    raise ImportError(
        "Failed to import google.genai. "
        "Please ensure google-genai>=0.8.0 is installed. "
        f"Import error: {e}"
    ) from e


# Retry設定（課金を抑えるため、リトライ回数を最小限に）
GEMINI_MODEL = os.environ.get("VOHANCE_VIDEO_SECTIONING_GEMINI_MODEL", "gemini-3.1-flash-lite")
MAX_RETRIES = 3  # 最大リトライ回数
BASE_DELAY = 2   # 基本待機時間（秒）
MAX_DELAY = 30   # 最大待機時間（秒）

# レート制限エラーのパターン
RATE_LIMIT_PATTERNS = [
    "rate limit",
    "quota exceeded",
    "too many requests",
    "resource exhausted",
    "429",
    "503",  # Service Unavailable
    "502",  # Bad Gateway
    "QUOTA_EXCEEDED",
    "RATE_EXHAUSTED"
]

def _create_section_schema() -> types.Schema:
    """
    Gemini structuredOutput用のスキーマ定義（google.genaiのSchemaオブジェクトを使用）
    
    google.genaiパッケージの正しい実装に従い、Schemaオブジェクトを使用してスキーマを定義します。
    これにより、429エラー（input方式の誤り）を回避できます。
    """
    return types.Schema(
        type=types.Type.OBJECT,
        properties={
            "sections": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "start": types.Schema(
                            type=types.Type.NUMBER,
                            description="セクション開始時刻（秒）"
                        ),
                        "end": types.Schema(
                            type=types.Type.NUMBER,
                            description="セクション終了時刻（秒）"
                        ),
                        "title": types.Schema(
                            type=types.Type.STRING,
                            description="セクションタイトル（任意）"
                        )
                    },
                    required=["start", "end"]
                )
            )
        },
        required=["sections"]
    )


def _is_rate_limit_error(error_msg: str) -> bool:
    """レート制限エラーかどうかを判定"""
    error_lower = error_msg.lower()
    return any(pattern.lower() in error_lower for pattern in RATE_LIMIT_PATTERNS)


def _calculate_retry_delay(attempt: int, is_rate_limit: bool = False) -> float:
    """リトライ待機時間を計算（exponential backoff）"""
    delay = BASE_DELAY * (2 ** attempt)
    if is_rate_limit:
        delay = delay * 2  # レート制限の場合はさらに長めに
    return min(delay, MAX_DELAY)




def _get_genai_client() -> Optional[genai.Client]:
    """
    google.genaiクライアントを取得
    
    GCS URIを使う場合は、Vertex AIの認証情報（Application Default Credentials）を使用します。
    APIキーが設定されている場合はAPIキーを使用します。
    
    ドキュメントに従い、Vertex AIを使用する場合は`vertexai=True`を指定します。
    """
    try:
        # 環境変数からAPIキーを取得
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        
        if api_key:
            # APIキーが設定されている場合はAPIキーを使用
            client = genai.Client(api_key=api_key)
            logger.info("✅ google.genaiクライアント作成完了（APIキー使用）")
            return client
        else:
            # APIキーが設定されていない場合は、Vertex AIの認証情報を使用
            # GCS URIを使う場合はVertex AIの認証情報が必要
            # ドキュメントに従い、vertexai=Trueを指定
            from localPackages.common.context import context
            project_id = context.google_cloud_project or "vohance-dev"
            location = os.environ.get("VOHANCE_VIDEO_SECTIONING_GEMINI_LOCATION", "global")
            
            try:
                # Vertex AI認証情報を使用（Application Default Credentialsを自動使用）
                client = genai.Client(
                    vertexai=True,
                    project=project_id,
                    location=location
                )
                logger.info(f"✅ google.genaiクライアント作成完了（Vertex AI使用: project={project_id}, location={location}）")
                return client
            except Exception as e:
                logger.warning(f"⚠️ Vertex AI認証情報でのクライアント作成に失敗: {str(e)}")
                return None
        
    except Exception as e:
        logger.warning(f"google.genaiクライアント作成に失敗: {str(e)}")
        return None


# ユーザープロンプトの最大文字数（セキュリティのため制限）
USER_PROMPT_MAX_LENGTH = 500

# 初期Autoトリミング: 長さがこの値未満のセクションは除外する（秒）
MIN_SECTION_DURATION_SEC = 1.0


def execute(
    ctx: RequestContext,
    video_gcs_uri: str,
    user_prompt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Step 2: Gemini structuredOutputで動画を分析してセクション配列を取得
    google.genaiパッケージを使用した最新実装です。

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        video_gcs_uri: str - 動画のGCS URI (gs://bucket/path形式),
        user_prompt: Optional[str] - ユーザー指定のセクション分割指示（任意）
    }

    returns: List[Dict[str, Any]] - セクション情報のリスト（start, end, titleを含む）
    """
    logger.start_operation("Step 2: Gemini動画分析（google.genai使用）")

    # Firestoreに進捗を記録（開始）
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message="Gemini APIで動画を分析中（google.genai使用）",
            current_step="analyzing"
        )

    try:
        # google.genaiクライアントを取得
        client = _get_genai_client()
        if not client:
            raise ValueError("google.genaiクライアントの作成に失敗しました")

        # Schemaオブジェクトを作成（google.genaiの正しい実装）
        section_schema = _create_section_schema()
        
        # GenerateContentConfig設定（structuredOutput）
        # サンプルコードに従い、Schemaオブジェクトを使用して429エラーを回避
        generate_content_config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=section_schema
        )
        
        logger.info("✅ GenerateContentConfig設定完了（Schemaオブジェクト使用）")

        # プロンプト準備（ベースプロンプト + ユーザー指示）
        prompt_text = """この動画を視聴して、適切なセクションに分割してください。

セクション分割の基準:
- ナレーション・音声の切れ目で分割する（話者の区切り、沈黙の前後、文や段落の終わりを優先）
- シーンの変化やトピックの切り替わりを検出
- 自然な区切りポイントを選択（音声の区切りと整合するように）
- 各セクションは30秒以上、1分以下を目安とする
- 動画全体を漏れなくカバーする

各セクションには開始時刻（start）と終了時刻（end）を秒単位で指定してください。
セクションタイトル（title）は任意ですが、内容が分かるように記述してください。

JSON形式で、sections配列にセクション情報を返してください。"""

        # ユーザーからの追加指示があればプロンプトに付加
        if user_prompt and user_prompt.strip():
            user_instruction = user_prompt.strip()[:USER_PROMPT_MAX_LENGTH]
            prompt_text += f"\n\nユーザーからの追加指示:\n{user_instruction}"

        # GCS URIからPartを作成
        # ドキュメントに従い、file_uriパラメータを使用
        video_part = types.Part.from_uri(
            file_uri=video_gcs_uri,
            mime_type="video/mp4"
        )

        # コンテンツの準備
        # ドキュメントに従い、直接リスト形式で渡すことも可能
        # types.Contentを使う方法と直接リストで渡す方法の両方がサポートされている
        contents = [
            prompt_text,
            video_part,
        ]

        # Firestoreに進捗を記録
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message="Gemini APIにリクエスト送信中...",
                current_step="analyzing"
            )

        logger.info(f"🚀 Gemini API呼び出し開始（google.genai使用）: {video_gcs_uri}")
        logger.info(f"🔄 最大リトライ回数: {MAX_RETRIES}")

        # リトライループ
        response = None
        last_error = None
        
        for attempt in range(MAX_RETRIES):
            try:
                # Gemini API呼び出し
                start_time = time.time()
                response = client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=contents,
                    config=generate_content_config
                )
                api_duration = time.time() - start_time

                logger.performance_metric("Gemini API呼び出し時間", api_duration, "秒")
                logger.info(f"✅ Gemini API呼び出し成功（試行回数: {attempt + 1}）")

                # Firestoreに進捗を記録
                if ctx.collection_name and ctx.document_id:
                    firestore_client.log_processing_status(
                        ctx,
                        status="processing",
                        message="Gemini API呼び出し成功",
                        current_step="analyzing"
                    )

                break  # 成功したらループを抜ける

            except Exception as e:
                error_msg = str(e)
                last_error = e
                is_rate_limit = _is_rate_limit_error(error_msg)

                logger.warning(
                    f"💥 Gemini API呼び出し失敗 (試行 {attempt + 1}/{MAX_RETRIES}): {type(e).__name__}: {error_msg}"
                )

                # レート制限エラーの場合
                if is_rate_limit:
                    logger.warning(f"⚠️ レート制限エラー検出")
                    if ctx.collection_name and ctx.document_id:
                        firestore_client.log_processing_status(
                            ctx,
                            status="processing",
                            message=f"レート制限検出。リトライします...",
                            current_step="analyzing"
                        )

                # 最後の試行でエラー
                if attempt == MAX_RETRIES - 1:
                    error_msg_final = f"Gemini API呼び出しが{MAX_RETRIES}回失敗しました: {error_msg}"
                    logger.error(error_msg_final, error=e)
                    raise ValueError(error_msg_final) from e

                # Exponential backoff（レート制限の場合は長めに待機）
                delay = _calculate_retry_delay(attempt, is_rate_limit)
                logger.info(f"⏳ {delay}秒待機してリトライします...")
                time.sleep(delay)

        # 最終的なエラーチェック
        if response is None:
            error_msg_final = f"Gemini API呼び出しが失敗しました（リトライ後も成功しませんでした）"
            logger.error(error_msg_final)
            raise ValueError(error_msg_final)

        # レスポンス処理
        if not response.text:
            raise ValueError("Gemini API returned no text")

        # JSONレスポンスを取得
        response_text = response.text
        logger.info(
            f"✅ Gemini APIレスポンス取得: {len(response_text)}文字"
        )

        # JSONをパース
        try:
            result = json.loads(response_text)
            sections = result.get("sections", [])
            
            if not sections:
                raise ValueError("Gemini API returned no sections")
            
            # セクションをstart時刻でソート
            sections = sorted(sections, key=lambda x: x.get("start", 0))

            # 長さ1秒未満・end<=startのセクションを除外（空/負のセクション防止）
            original_count = len(sections)
            sections = [
                s for s in sections
                if s.get("end", 0) > s.get("start", 0)
                and (s.get("end", 0) - s.get("start", 0)) >= MIN_SECTION_DURATION_SEC
            ]
            if len(sections) < original_count:
                logger.info(
                    f"⏱️ 長さ{MIN_SECTION_DURATION_SEC}秒未満または無効なセクションを除外: "
                    f"{original_count} → {len(sections)}件"
                )
            if not sections:
                raise ValueError(
                    "Gemini API returned no valid sections (all were shorter than "
                    f"{MIN_SECTION_DURATION_SEC} second(s) or invalid)"
                )
            
            logger.success(
                f"🎉 Gemini分析完了: {len(sections)}個のセクションを検出"
            )
            
            # Firestoreに進捗を記録（完了）
            if ctx.collection_name and ctx.document_id:
                firestore_client.log_processing_status(
                    ctx,
                    status="processing",
                    message=f"Gemini分析完了: {len(sections)}個のセクションを検出",
                    current_step="analyzing"
                )
            
            # セクション情報をログ出力
            for i, section in enumerate(sections):
                logger.info(
                    f"セクション{i + 1}: {section.get('start', 0):.2f}秒 - "
                    f"{section.get('end', 0):.2f}秒 ({section.get('title', 'タイトルなし')})"
                )
            
            return sections
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSONパースエラー: {response_text[:500]}")
            raise ValueError(f"Gemini API response is not valid JSON: {str(e)}")

    except Exception as e:
        logger.error(f"Gemini分析エラー: {str(e)}", error=e)
        
        # Firestoreにエラーを記録
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx,
                status="error",
                message=f"Gemini分析エラー: {str(e)}",
                current_step="analyzing"
            )
        
        raise

    finally:
        logger.complete_operation("Step 2: Gemini動画分析")
