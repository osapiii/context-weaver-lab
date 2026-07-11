# StoryVault Jira連携

StoryVaultのJira連携は、Atlassian OAuth 2.0 (3LO)でJira Cloud siteを接続し、関連コンテキスト画面からIssueを検索・手動紐付け、またはAIで関連Issueを抽出します。

## 環境変数

フロントエンドとFirebase Functionsの両方に設定します。Client Secretとトークン暗号化キーはフロントエンドへ公開しません。

```dotenv
# app/.env.storyvault-dev
NUXT_PUBLIC_JIRA_OAUTH_CLIENT_ID=...
NUXT_PUBLIC_JIRA_OAUTH_REDIRECT_URI=https://storyvault-dev.web.app/admin/storyvault/jira-callback

# backend/app/.env.storyvault-dev
JIRA_OAUTH_CLIENT_ID=...
JIRA_OAUTH_CLIENT_SECRET=...
JIRA_TOKEN_ENCRYPTION_KEY=...
```

Atlassian側のOAuthアプリには、フロントエンドと同じCallback URLを登録します。ローカルでは `http://127.0.0.1:3000/admin/storyvault/jira-callback` を使う場合があります。許可するスコープは `read:jira-work` と `read:jira-user` です。

## 利用フロー

1. 設定のOAuth認証からJira Cloud siteを追加します。
2. 関連コンテキストのJiraタブでsiteを選び、Issueキー・タイトル・語句を検索します。
3. 検索結果からIssueを選択して「選択したIssueを紐付け」を押します。
4. 紐付け結果はクリップの `relatedContexts.jira` に保存され、Issueプレビュー、レポート、コンテキストマップへ反映されます。

アクセストークンは期限前にRefresh Tokenで更新します。接続確認に失敗した場合は、設定画面から対象siteを再接続してください。
