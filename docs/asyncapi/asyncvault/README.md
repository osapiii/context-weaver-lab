# AsyncVault / StoryVault AsyncAPI Docs

StoryVault/EN AIstudio の Firestore RequestDoc ベース非同期 API 仕様です。StoryVault の録画下書き、動画前処理、AIナレーション、字幕、Jira/Slack/GitHub連携も対象です。

## 2026-07-11 更新内容

- Jira Cloud OAuth、Issue検索、関連文脈出力を追加
- StoryVaultクリップ解析Workflowと再実行Command Docを追加
- 録画下書きから動画前処理RequestDocを作成・購読する経路を追加
- ノイズ除去、手動カット、分割点、複数セグメント出力を追加
- 字幕が生成済みAI音声の確定本文と音声尺を使用することを明記
- 動画分割・合成・連結・Context Storeのoperationsを追加

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
