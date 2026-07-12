"""
Step 1: Crawl Web Page using Crawl4AI

Crawl4AI SDKを使用してWEBページをクロールし、Markdown形式でGCSに保存するステップ
"""

import os
import re
import asyncio
from urllib.parse import urlparse, urljoin
from typing import List, Dict, Any, Optional
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
from common import ExecutionContext, FatalStepError
from common.gcs_storage import upload_string_to_gcs
from endpoints.crawl.workflow_step_state import persist_context_keys


# OGP / Twitter Card meta タグを抜き出すための regex.
# `<meta property="og:image" content="..." />` 形式と
# `<meta name="twitter:image" content="..." />` 形式の両方をサポート.
# property / name の順は HTML 上で逆転することがあるため、属性順序非依存にする.
_OG_META_RE = re.compile(
    r'<meta\s+[^>]*?(?:property|name)\s*=\s*["\']'
    r'(og:image|og:title|og:description|twitter:image|twitter:title|twitter:description)'
    r'["\'][^>]*?content\s*=\s*["\']([^"\']+)["\'][^>]*?/?>',
    re.IGNORECASE,
)
# property / content の順序が逆転している HTML 用の保険 regex
_OG_META_RE_REVERSED = re.compile(
    r'<meta\s+[^>]*?content\s*=\s*["\']([^"\']+)["\'][^>]*?(?:property|name)\s*=\s*["\']'
    r'(og:image|og:title|og:description|twitter:image|twitter:title|twitter:description)'
    r'["\'][^>]*?/?>',
    re.IGNORECASE,
)


def _extract_og_metadata(html: Optional[str], page_url: str) -> Dict[str, Optional[str]]:
    """HTML から OGP / Twitter Card メタタグを抽出する.

    画像 URL は urljoin で絶対 URL に正規化する. 取れなかったフィールドは None.
    OGP 優先、無ければ twitter:* を fallback として採用.
    """
    result: Dict[str, Optional[str]] = {
        "ogImage": None,
        "ogTitle": None,
        "ogDescription": None,
    }
    if not html:
        return result

    found: Dict[str, str] = {}
    for m in _OG_META_RE.finditer(html):
        key = m.group(1).lower()
        val = m.group(2).strip()
        if val and key not in found:
            found[key] = val
    for m in _OG_META_RE_REVERSED.finditer(html):
        key = m.group(2).lower()
        val = m.group(1).strip()
        if val and key not in found:
            found[key] = val

    # og:* 優先、無ければ twitter:*
    image = found.get("og:image") or found.get("twitter:image")
    title = found.get("og:title") or found.get("twitter:title")
    desc = found.get("og:description") or found.get("twitter:description")

    if image:
        # 相対 URL → 絶対 URL に解決
        try:
            result["ogImage"] = urljoin(page_url, image)
        except Exception:
            result["ogImage"] = image
    if title:
        result["ogTitle"] = title
    if desc:
        result["ogDescription"] = desc

    return result


def sanitize_url_to_filename(url: str) -> str:
    """
    URLを安全なファイル名に変換
    
    Args:
        url: クロール対象のURL
        
    Returns:
        安全なファイル名（拡張子なし）
        
    Example:
        https://example.com/page → example_com_page
        https://example.com/path/to/page → example_com_path_to_page
    """
    # URLをパース
    parsed = urlparse(str(url))
    
    # ドメイン名とパスを取得
    domain = parsed.netloc.replace('.', '_').replace(':', '_')
    path = parsed.path.strip('/').replace('/', '_')
    
    # クエリパラメータとフラグメントを無視（必要に応じて追加可能）
    
    # 特殊文字を削除
    filename = f"{domain}_{path}" if path else domain
    
    # ファイル名として使用できない文字を削除
    filename = re.sub(r'[<>:"|?*]', '', filename)
    
    # 連続するアンダースコアを1つに
    filename = re.sub(r'_+', '_', filename)
    
    # 先頭・末尾のアンダースコアを削除
    filename = filename.strip('_')
    
    # 空の場合はデフォルト名
    if not filename:
        filename = "crawled_page"
    
    # 長すぎる場合はハッシュ化を検討（255文字制限）
    if len(filename) > 200:
        import hashlib
        url_hash = hashlib.md5(str(url).encode()).hexdigest()[:16]
        filename = f"{filename[:180]}_{url_hash}"
    
    return filename


async def _crawl_with_crawl4ai(
    url: str,
    max_depth: int,
    max_urls: int,
    context: ExecutionContext
) -> List[Dict[str, Any]]:
    """
    Crawl4AIを使用してWEBページをクロール
    
    Args:
        url: クロール対象のURL
        max_depth: クロールの階層の深さ
        max_urls: 最大URL数
        context: ExecutionContext
        
    Returns:
        クロール結果のリスト（各要素は{'markdown': str, 'metadata': dict, 'url': str}形式）
        
    Raises:
        FatalStepError: 処理失敗時
    """
    try:
        if context.logger:
            context.logger.info(
                f"🔍 Starting Crawl4AI crawl: url={url}, max_depth={max_depth}, max_urls={max_urls}",
                emoji="🔍"
            )
        
        # BrowserConfigを設定（ヘッドレスモード、Chromium使用）
        browser_config = BrowserConfig(
            headless=True,
            browser_type="chromium",
            verbose=False  # ログが多すぎる場合はFalseに設定
        )
        
        # BFSDeepCrawlStrategyを設定
        # max_depthは階層の深さ（開始ページを0として、その下の階層数）
        # max_pagesは最大ページ数
        deep_crawl_strategy = BFSDeepCrawlStrategy(
            max_depth=max_depth,
            max_pages=max_urls,
            include_external=False  # 同じドメイン内のみクロール
        )
        
        # CrawlerRunConfigを設定
        run_config = CrawlerRunConfig(
            deep_crawl_strategy=deep_crawl_strategy,
            word_count_threshold=10,  # 最小単語数（ノイズを減らす）
            page_timeout=60000,  # 60秒タイムアウト
            wait_until="domcontentloaded"  # DOMContentLoadedまで待機
        )
        
        # AsyncWebCrawlerを使用してクロール実行
        async with AsyncWebCrawler(config=browser_config) as crawler:
            if context.logger:
                context.logger.info(
                    f"⏳ Crawling pages with Crawl4AI...",
                    emoji="⏳"
                )
            
            # クロール実行（複数ページの場合はリストが返される）
            results = await crawler.arun(url=url, config=run_config)
            
            # 結果が単一のCrawlResultの場合とリストの場合がある
            if not isinstance(results, list):
                results = [results]
            
            if context.logger:
                context.logger.info(
                    f"📥 Crawled {len(results)} pages",
                    emoji="📥"
                )
            
            # 結果を変換
            data_array = []
            for idx, result in enumerate(results):
                if not result.success:
                    if context.logger:
                        context.logger.warn(
                            f"⚠️ Page {idx + 1} crawl failed: {result.url} - {result.error_message}",
                            emoji="⚠️"
                        )
                    continue
                
                # Markdownを取得（raw_markdownまたはmarkdownプロパティ）
                markdown_content = ""
                if hasattr(result, 'markdown'):
                    if hasattr(result.markdown, 'raw_markdown'):
                        markdown_content = result.markdown.raw_markdown
                    elif isinstance(result.markdown, str):
                        markdown_content = result.markdown
                    else:
                        # markdownオブジェクトの場合は文字列に変換を試みる
                        markdown_content = str(result.markdown)
                
                # メタデータを取得
                metadata = result.metadata or {}
                page_url = result.url or url

                # タイトルをメタデータから取得
                if 'title' not in metadata and hasattr(result, 'title'):
                    metadata['title'] = result.title

                # 画像 URL を抽出 (Phase R-1b: Drive へ画像も保存するため)
                # crawl4ai は result.media (dict) の中に 'images' リストを持つことがある。
                # 取れなければ markdown を正規表現で走査して ![alt](src) を抜く (フォールバック)。
                images: List[Dict[str, Any]] = []
                try:
                    media = getattr(result, 'media', None) or {}
                    media_images = media.get('images') if isinstance(media, dict) else None
                    if media_images:
                        for img in media_images:
                            if not isinstance(img, dict):
                                continue
                            src = img.get('src') or img.get('url')
                            if not src:
                                continue
                            images.append({
                                'src': src,
                                'alt': img.get('alt') or '',
                                'desc': img.get('desc') or '',
                            })
                except Exception as media_err:
                    if context.logger:
                        context.logger.warn(
                            f"⚠️ media extraction failed for {page_url}: {media_err}",
                            emoji="⚠️"
                        )
                # フォールバック: markdown から ![alt](src) を抜く
                if not images and markdown_content:
                    md_imgs = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', markdown_content)
                    for alt_text, src in md_imgs:
                        if src.startswith(('data:', '#')):
                            continue
                        images.append({'src': src, 'alt': alt_text, 'desc': ''})

                # OGP / Twitter Card メタタグを抽出 (Phase R-1e).
                # crawl4ai は result.html / result.cleaned_html に raw HTML を持つことが
                # あるので、両方試して取れた方を使う. 取れなくても crawl 全体は続行する.
                raw_html: Optional[str] = (
                    getattr(result, 'html', None)
                    or getattr(result, 'cleaned_html', None)
                )
                ogp = _extract_og_metadata(raw_html, page_url)
                if ogp["ogImage"]:
                    # og:image をページ画像リストの先頭に追加 (重複は step2 の canonical
                    # dedup または sha256 dedup で吸収される). 先頭にすることで
                    # 「fallback として最初の画像を thumbnail にする」ロジックが
                    # 自然に og:image を選ぶ.
                    already = any(img.get('src') == ogp["ogImage"] for img in images)
                    if not already:
                        images.insert(0, {
                            'src': ogp["ogImage"],
                            'alt': ogp["ogTitle"] or '',
                            'desc': 'og:image',
                        })

                data_array.append({
                    'markdown': markdown_content,
                    'metadata': metadata,
                    'url': page_url,
                    'images': images,
                    'ogImage': ogp["ogImage"],
                    'ogTitle': ogp["ogTitle"],
                    'ogDescription': ogp["ogDescription"],
                })
                
                if context.logger and idx % 10 == 0:  # 10ページごとにログ
                    context.logger.info(
                        f"⏳ Processed {idx + 1}/{len(results)} pages",
                        emoji="⏳"
                    )
            
            if not data_array:
                raise FatalStepError(
                    step_name='step1_crawl_page',
                    message='Crawl4AI crawl completed but no valid pages returned',
                    error_code='EMPTY_CRAWL_DATA'
                )
            
            return data_array
            
    except FatalStepError:
        raise
    except Exception as e:
        error_msg = f'Crawl4AI crawl failed: {str(e)}'
        if context.logger:
            context.logger.error(
                f"❌ {error_msg}",
                emoji="❌",
                exc_info=True
            )
        raise FatalStepError(
            step_name='step1_crawl_page',
            message=error_msg,
            error_code='CRAWL4AI_ERROR'
        )


def execute(context: ExecutionContext) -> None:
    """
    Crawl4AI SDKを使用してWEBページをクロールし、Markdown形式でGCSに保存
    
    Args:
        context: ExecutionContext
        
    Raises:
        FatalStepError: 処理失敗時
    """
    try:
        input_data = context.input_data
        url = str(input_data.url)
        # bucket_nameとfolder_pathの前後の空白を削除
        bucket_name = input_data.bucket_name.strip()
        folder_path = input_data.folder_path.strip().rstrip('/')
        max_depth = input_data.max_depth
        max_urls = input_data.max_urls
        options = input_data.options or {}
        
        # バリデーション
        if not bucket_name:
            raise FatalStepError(
                step_name='step1_crawl_page',
                message='bucket_name is required and cannot be empty',
                error_code='INVALID_BUCKET_NAME'
            )
        if not folder_path:
            raise FatalStepError(
                step_name='step1_crawl_page',
                message='folder_path is required and cannot be empty',
                error_code='INVALID_FOLDER_PATH'
            )
        
        if context.logger:
            context.logger.info(
                f"🔍 Starting crawl: url={url}, bucket={bucket_name}, folder={folder_path}, max_depth={max_depth}, max_urls={max_urls}",
                emoji="🔍"
            )
        
        # Crawl4AIを使用してクロール実行（同期的に実行）
        if context.logger:
            context.logger.info(
                f"🚀 Crawl4AIクロール処理を開始します: URL={url}",
                emoji="🚀"
            )
        try:
            # 既存のイベントループがある場合は使用、なければ新規作成
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # 既にイベントループが実行中の場合は、nest_asyncioを使用
                    try:
                        import nest_asyncio
                        nest_asyncio.apply()
                        data_array = loop.run_until_complete(
                            _crawl_with_crawl4ai(url, max_depth, max_urls, context)
                        )
                    except ImportError:
                        # nest_asyncioがインストールされていない場合はエラー
                        raise FatalStepError(
                            step_name='step1_crawl_page',
                            message='nest_asyncio is required when event loop is already running. Please install it: pip install nest-asyncio',
                            error_code='NEST_ASYNCIO_MISSING'
                        )
                else:
                    data_array = loop.run_until_complete(
                        _crawl_with_crawl4ai(url, max_depth, max_urls, context)
                    )
            except RuntimeError:
                # イベントループがない場合は新規作成
                data_array = asyncio.run(
                    _crawl_with_crawl4ai(url, max_depth, max_urls, context)
                )
            
            # クロール完了ログ
            if context.logger:
                context.logger.info(
                    f"📥 クロール処理が完了しました: {len(data_array)}ページを取得しました",
                    emoji="📥"
                )
        except Exception as e:
            error_msg = f'Failed to execute Crawl4AI crawl: {str(e)}'
            if context.logger:
                context.logger.error(
                    f"❌ {error_msg}",
                    emoji="❌",
                    exc_info=True
                )
            raise FatalStepError(
                step_name='step1_crawl_page',
                message=error_msg,
                error_code='CRAWL4AI_EXECUTION_ERROR'
            )
        
        # すべてのページを個別のファイルとして保存
        if context.logger:
            context.logger.info(
                f"💾 GCSへの保存処理を開始します: {len(data_array)}ページを保存します",
                emoji="💾"
            )
        
        saved_files = []
        for idx, page in enumerate(data_array):
            markdown_content = page.get('markdown', '')
            metadata = page.get('metadata', {})
            page_url = page.get('url', url)  # ページ固有のURL、なければ元のURLを使用
            
            # Markdownコンテンツが空の場合はスキップ
            if not markdown_content:
                if context.logger:
                    context.logger.warn(
                        f"⚠️ Skipping page {idx + 1}: No markdown content for URL {page_url}",
                        emoji="⚠️"
                    )
                continue
            
            # ページのURLを安全なファイル名に変換
            filename = sanitize_url_to_filename(page_url)
            gcs_file_path = f"{folder_path}/{filename}.md"
            
            if context.logger:
                context.logger.info(
                    f"💾 Saving page {idx + 1}/{len(data_array)} to GCS: bucket={bucket_name}, path={gcs_file_path}, content_length={len(markdown_content)} (BOM付きUTF-8)",
                    emoji="💾"
                )
            
            # GCSにMarkdownファイルを保存（BOM付きUTF-8）
            # utf-8-sigエンコーディングを使用すると、BOM（\ufeff）が自動的に追加される
            try:
                gcs_url = upload_string_to_gcs(
                    content=markdown_content,
                    bucket_name=bucket_name,
                    gcs_path=gcs_file_path,
                    encoding="utf-8-sig",  # utf-8-sigはBOM付きUTF-8を自動的に生成
                    content_type="text/markdown; charset=utf-8"
                )
                
                title = metadata.get('title', '')
                saved_files.append({
                    "file_path": gcs_file_path,
                    "gcs_url": gcs_url,
                    "url": page_url,
                    "title": title,
                    "metadata": metadata
                })
                
                if context.logger:
                    context.logger.info(
                        f"✅ Saved page {idx + 1}/{len(data_array)}: {gcs_file_path}",
                        emoji="✅"
                    )
            except Exception as e:
                error_msg = f"Failed to upload page {idx + 1} to GCS: bucket={bucket_name}, path={gcs_file_path}, error={str(e)}"
                if context.logger:
                    context.logger.error(
                        f"❌ {error_msg}",
                        emoji="❌",
                        exc_info=True
                    )
                # 個別ページのアップロード失敗は警告として記録し、処理を続行
                if context.logger:
                    context.logger.warn(
                        f"⚠️ Continuing with remaining pages after upload error for page {idx + 1}",
                        emoji="⚠️"
                    )
        
        # 保存されたファイルがない場合はエラー
        if not saved_files:
            if context.logger:
                context.logger.error(
                    f"❌ GCSへの保存に失敗しました: 保存されたファイルがありません",
                    emoji="❌"
                )
            raise FatalStepError(
                step_name='step1_crawl_page',
                message='No pages were successfully saved to GCS',
                error_code='NO_PAGES_SAVED'
            )
        
        # GCS保存完了ログ
        if context.logger:
            context.logger.info(
                f"✅ GCSへの保存処理が完了しました: {len(saved_files)}ファイルを保存しました",
                emoji="✅"
            )
        
        # ジョブ実行情報をcontextに保存（最初のファイルの情報をメインとして、全ファイル情報も含める）
        main_file = saved_files[0]
        job_info = {
            "file_path": main_file["file_path"],
            "gcs_url": main_file["gcs_url"],
            "url": url,
            "title": main_file["title"],
            "status": "completed",
            "metadata": main_file["metadata"],
            "total_pages": len(saved_files),
            "saved_files": saved_files  # すべての保存されたファイル情報
        }
        context.set('job_info', job_info)

        # step2 (GCS upload) 用に crawled pages を context に積む
        context.set('crawled_pages', data_array)
        context.set('entry_url', url)

        persist_context_keys(
            context,
            ["crawled_pages", "entry_url", "job_info"],
        )
        
        if context.logger:
            context.logger.info(
                f"✅ Crawl completed: {len(saved_files)} pages saved. Main file: {main_file['file_path']}",
                emoji="✅"
            )
            
    except FatalStepError:
        raise
    except Exception as e:
        # すべての予期しないエラーをキャッチしてログに記録
        error_msg = f'Unexpected error in step1_crawl_page: {str(e)}'
        if context.logger:
            context.logger.error(
                f"❌ {error_msg}",
                emoji="❌",
                exc_info=True
            )
        raise FatalStepError(
            step_name='step1_crawl_page',
            message=error_msg,
            error_code='UNEXPECTED_ERROR'
        )
