# AsyncVault AsyncAPI Docs

StoryVault/EN AIstudio の Firestore RequestDoc ベース非同期 API 仕様です。

- `asyncapi.yaml`: AsyncAPI 3.1.0 仕様書
- `html/index.html`: `@asyncapi/html-template` で生成した公式 HTML レポート

## 再生成

```bash
npx --yes @asyncapi/cli validate docs/asyncapi/asyncvault/asyncapi.yaml
npx --yes @asyncapi/cli generate fromTemplate \
  docs/asyncapi/asyncvault/asyncapi.yaml \
  @asyncapi/html-template \
  --output docs/asyncapi/asyncvault/html \
  --force-write \
  --no-interactive \
  --param singleFile=true
```

## 対象

- StoryVault 動画 RequestDoc
- ADK Invoke RequestDoc
- Google Drive Sync / Web Crawl Workflows
- Context Store / Transactional Email RequestDoc
- 関連 Firebase Functions カタログ
