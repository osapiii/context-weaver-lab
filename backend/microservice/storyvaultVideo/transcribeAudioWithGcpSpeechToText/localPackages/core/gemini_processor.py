"""
Gemini Paragraph Processor Module

このモジュールは、文字起こし結果をVertex AI Geminiを使用して
段落単位に分割し、タイムスタンプ付きの構造化データを生成します。

主な機能:
- 文字起こしJSONを段落に分割
- 各段落にタイムスタンプを付与
- Structured Outputを使用した型安全な処理
"""

import json
import os
from typing import Dict, Any, Optional
from google import genai
from google.genai import types
from localPackages.common.context import context
from localPackages.common.logger import logger


class GeminiParagraphProcessor:
    """
    Geminiを使用して文字起こしテキストを段落に分割するプロセッサ
    """

    def __init__(self):
        """
        Geminiクライアントの初期化
        """
        self.model = (
            os.environ.get("STORYVAULT_VIDEO_TRANSCRIBE_GEMINI_MODEL")
            or os.environ.get("VOHANCE_TRANSCRIBE_GEMINI_MODEL")
            or "gemini-2.5-flash-lite"
        )
        self.location = (
            os.environ.get("STORYVAULT_VIDEO_TRANSCRIBE_GEMINI_LOCATION")
            or os.environ.get("VOHANCE_TRANSCRIBE_GEMINI_LOCATION")
            or "global"
        )
        self.client = self._create_client()

    def _create_client(self) -> Optional[genai.Client]:
        """
        Geminiクライアントを作成する。

        GEMINI_API_KEY / GOOGLE_API_KEY が明示された場合だけ API key を使い、
        通常は Cloud Run のサービスアカウント（ADC）で Vertex AI に接続する。
        """
        try:
            api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            if api_key:
                client = genai.Client(api_key=api_key)
                logger.info("✅ Gemini クライアントを初期化しました（APIキー使用）")
                return client

            project_id = context.config.google_cloud_project
            if not project_id:
                logger.warning("⚠️ GOOGLE_CLOUD_PROJECT が未設定のため、Gemini段落分割はスキップされます")
                return None

            client = genai.Client(
                vertexai=True,
                project=project_id,
                location=self.location,
            )
            logger.info(
                f"✅ Gemini クライアントを初期化しました（Vertex AI使用: project={project_id}, location={self.location}）"
            )
            return client
        except Exception as e:
            logger.error(f"❌ Gemini クライアント初期化エラー: {str(e)}")
            return None
    
    def _get_paragraph_schema(self) -> genai.types.Schema:
        """
        段落分割のためのStructured Output スキーマを定義
        
        Returns:
            Structured Output用のスキーマ定義
        """
        return genai.types.Schema(
            type=genai.types.Type.OBJECT,
            required=["paragraphs"],
            properties={
                "paragraphs": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.OBJECT,
                        properties={
                            "text": genai.types.Schema(
                                type=genai.types.Type.STRING,
                            ),
                            "start": genai.types.Schema(
                                type=genai.types.Type.STRING,
                            ),
                        },
                        required=["text", "start"],
                    ),
                ),
            },
        )
    
    def _create_prompt(self, gladia_json: Dict[str, Any]) -> str:
        """
        Geminiに送信するプロンプトを作成
        
        Args:
            gladia_json: 文字起こし結果
            
        Returns:
            整形されたプロンプト文字列
        """
        # 文字起こし結果のJSONを含めるプロンプト
        prompt = f"""
あなたは文字起こしテキストを段落に分割する専門家です。
以下の文字起こしデータを、意味のまとまりごとに段落に分割してください。

要件：
1. 各段落は意味的にまとまった内容にする
2. 各段落には、その段落が始まる時間をMM:SS形式で付与する
3. 話題が変わる箇所で段落を分ける
4. 1つの段落は適切な長さ（3-5文程度）にする

以下が文字起こしデータです：

{json.dumps(gladia_json, ensure_ascii=False, indent=2)}

上記のデータから、transcript と statistics の情報を使用して、
意味のあるまとまりごとに段落を作成してください。
発話ごとの開始時刻がない場合、最初の段落の start は "00:00" にしてください。
"""
        return prompt
    
    def _format_time(self, seconds: float) -> str:
        """
        秒数をMM:SS形式に変換
        
        Args:
            seconds: 秒数
            
        Returns:
            MM:SS形式の時間文字列
        """
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"
    
    def process_transcript(self, gladia_json: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        文字起こし結果を段落に分割
        
        Args:
            gladia_json: 文字起こし結果
            
        Returns:
            段落分割されたデータ、エラーの場合はNone
        """
        if not self.client:
            logger.warning("⚠️ Geminiクライアントが初期化されていません")
            return None
        
        try:
            logger.info("🔄 Geminiで段落分割処理を開始...")
            
            # Structured Output設定
            generate_content_config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=self._get_paragraph_schema()
            )
            
            # プロンプト作成
            prompt = self._create_prompt(gladia_json)
            
            # コンテンツの準備
            contents = [
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=prompt),
                    ],
                ),
            ]
            
            # Geminiに送信
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=generate_content_config
            )
            
            # レスポンスをパース
            if response and response.text:
                result = json.loads(response.text)
                paragraph_count = len(result.get('paragraphs', []))
                logger.info(f"✅ 段落分割完了: {paragraph_count}個の段落を生成")
                return result
            else:
                logger.error("❌ Geminiからの応答が空です")
                return None
                
        except json.JSONDecodeError as e:
            logger.error(f"❌ Geminiレスポンスのパースエラー: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"❌ Gemini処理中にエラーが発生: {str(e)}")
            logger.error(f"📍 エラー型: {type(e).__name__}")
            return None
