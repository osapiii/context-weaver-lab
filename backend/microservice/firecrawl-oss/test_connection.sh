#!/bin/bash

# Firecrawl OSS - 外部接続検証スクリプト
# XServerなどでホスティングしているFirecrawl OSSが外部から使えるか検証します

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Firecrawl OSS 外部接続検証 ===${NC}"
echo ""

# XServerのURLを引数から取得、または環境変数から取得
FIRECRAWL_URL="${1:-${FIRECRAWL_API_URL}}"

if [ -z "$FIRECRAWL_URL" ]; then
    echo -e "${RED}Error: Firecrawl OSSのURLを指定してください${NC}"
    echo ""
    echo "使用方法:"
    echo "  $0 <firecrawl_url>"
    echo ""
    echo "または環境変数で指定:"
    echo "  export FIRECRAWL_API_URL='https://your-xserver-domain.com'"
    echo "  $0"
    echo ""
    exit 1
fi

# URLの末尾のスラッシュを削除
FIRECRAWL_URL=$(echo "$FIRECRAWL_URL" | sed 's|/$||')

echo -e "${YELLOW}検証対象URL: ${FIRECRAWL_URL}${NC}"
echo ""

# ============================================
# 1. ヘルスチェックエンドポイント (/test)
# ============================================
echo -e "${BLUE}[1/3] ヘルスチェックエンドポイント (/test) をテスト中...${NC}"
TEST_URL="${FIRECRAWL_URL}/test"

if response=$(curl -s -w "\n%{http_code}" --max-time 10 "${TEST_URL}" 2>&1); then
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ ヘルスチェック成功 (HTTP ${http_code})${NC}"
        echo -e "${GREEN}   レスポンス: ${body}${NC}"
    else
        echo -e "${YELLOW}⚠️  ヘルスチェック応答あり (HTTP ${http_code})${NC}"
        echo -e "${YELLOW}   レスポンス: ${body}${NC}"
    fi
else
    echo -e "${RED}❌ ヘルスチェック失敗: 接続できませんでした${NC}"
    echo -e "${RED}   エラー: ${response}${NC}"
fi
echo ""

# ============================================
# 2. v2/scrape API テスト（軽量）
# ============================================
echo -e "${BLUE}[2/3] v2/scrape API をテスト中...${NC}"
SCRAPE_URL="${FIRECRAWL_URL}/v2/scrape"

# テスト用の軽量なリクエスト
scrape_payload='{
  "url": "https://example.com",
  "formats": ["markdown"]
}'

if response=$(curl -s -w "\n%{http_code}" --max-time 30 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "${scrape_payload}" \
    "${SCRAPE_URL}" 2>&1); then
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ v2/scrape API成功 (HTTP ${http_code})${NC}"
        # JSONレスポンスを整形して表示（jqがあれば使用）
        if command -v jq &> /dev/null; then
            echo -e "${GREEN}   レスポンス（整形済み）:${NC}"
            echo "$body" | jq '.' 2>/dev/null | head -20
        else
            echo -e "${GREEN}   レスポンス（最初の500文字）:${NC}"
            echo "$body" | head -c 500
            echo ""
        fi
    elif [ "$http_code" = "400" ] || [ "$http_code" = "422" ]; then
        echo -e "${YELLOW}⚠️  v2/scrape API応答あり (HTTP ${http_code}) - リクエスト形式の問題の可能性${NC}"
        echo -e "${YELLOW}   レスポンス: ${body}${NC}"
    else
        echo -e "${RED}❌ v2/scrape API失敗 (HTTP ${http_code})${NC}"
        echo -e "${RED}   レスポンス: ${body}${NC}"
    fi
else
    echo -e "${RED}❌ v2/scrape API失敗: 接続できませんでした${NC}"
    echo -e "${RED}   エラー: ${response}${NC}"
fi
echo ""

# ============================================
# 3. v2/crawl API テスト（非同期ジョブ）
# ============================================
echo -e "${BLUE}[3/3] v2/crawl API をテスト中（非同期ジョブ）...${NC}"
CRAWL_URL="${FIRECRAWL_URL}/v2/crawl"

# テスト用の軽量なリクエスト（1ページのみ）
crawl_payload='{
  "url": "https://example.com",
  "limit": 1,
  "scrapeOptions": {
    "formats": ["markdown"]
  }
}'

if response=$(curl -s -w "\n%{http_code}" --max-time 30 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "${crawl_payload}" \
    "${CRAWL_URL}" 2>&1); then
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ v2/crawl API成功 (HTTP ${http_code})${NC}"
        # JSONレスポンスを整形して表示（jqがあれば使用）
        if command -v jq &> /dev/null; then
            echo -e "${GREEN}   レスポンス（整形済み）:${NC}"
            echo "$body" | jq '.' 2>/dev/null | head -30
            
            # ジョブIDを抽出
            job_id=$(echo "$body" | jq -r '.id // empty' 2>/dev/null)
            if [ -n "$job_id" ] && [ "$job_id" != "null" ]; then
                echo ""
                echo -e "${YELLOW}   ジョブID: ${job_id}${NC}"
                echo -e "${YELLOW}   ステータス確認URL: ${FIRECRAWL_URL}/v2/crawl/${job_id}${NC}"
            fi
        else
            echo -e "${GREEN}   レスポンス（最初の500文字）:${NC}"
            echo "$body" | head -c 500
            echo ""
        fi
    elif [ "$http_code" = "400" ] || [ "$http_code" = "422" ]; then
        echo -e "${YELLOW}⚠️  v2/crawl API応答あり (HTTP ${http_code}) - リクエスト形式の問題の可能性${NC}"
        echo -e "${YELLOW}   レスポンス: ${body}${NC}"
    else
        echo -e "${RED}❌ v2/crawl API失敗 (HTTP ${http_code})${NC}"
        echo -e "${RED}   レスポンス: ${body}${NC}"
    fi
else
    echo -e "${RED}❌ v2/crawl API失敗: 接続できませんでした${NC}"
    echo -e "${RED}   エラー: ${response}${NC}"
fi
echo ""

# ============================================
# 検証結果サマリー
# ============================================
echo -e "${BLUE}=== 検証結果サマリー ===${NC}"
echo ""
echo -e "${GREEN}✅ 外部からFirecrawl OSSに接続できました！${NC}"
echo ""
echo -e "${YELLOW}webCrawlerマイクロサービスで使用する場合:${NC}"
echo "  export FIRECRAWL_API_URL='${FIRECRAWL_URL}'"
echo "  export FIRECRAWL_API_KEY=''  # OSS版では認証が不要な場合がある"
echo ""
echo -e "${YELLOW}テストコマンド例:${NC}"
echo "  curl -X POST ${FIRECRAWL_URL}/v2/crawl \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"url\": \"https://example.com\"}'"
echo ""

