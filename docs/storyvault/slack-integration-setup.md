# Slack Integration Setup

StoryVault uses Slack OAuth to collect related conversations for operation videos. The collected messages appear in the video context tab, context map, and StoryVault MCP context bundles.

## Slack App

### Create From Manifest

1. Open <https://api.slack.com/apps>.
2. Click `Create New App`.
3. Choose `From an app manifest`.
4. Select the workspace that will own/administer the app.
5. Paste [`slack-app-manifest.yml`](./slack-app-manifest.yml) into the YAML editor.
6. Create the app.
7. Open `Basic Information` > `Display Information` and upload the StoryVault logo/icon. Slack app icons are uploaded in the app settings UI; the icon image is not represented in the app manifest.
8. Open `Basic Information` > `App Credentials` and copy `Client ID` / `Client Secret` into the app and Firebase Functions environments below.

The included manifest configures these OAuth redirect URLs:

   - Production: `https://<your-host>/admin/storyvault/slack-callback`
   - Local development: `http://127.0.0.1:<port>/admin/storyvault/slack-callback`

For the current StoryVault dev deployment, the manifest uses `https://storyvault-dev.web.app/admin/storyvault/slack-callback` and `http://127.0.0.1:3000/admin/storyvault/slack-callback`. Update the manifest before creating a production app for a different host or local port.

The manifest also configures these Bot Token Scopes:

   - `channels:read`
   - `channels:history`
   - `groups:read`
   - `groups:history`

After creating or changing scopes, install or reinstall the app to the workspace.

Channel history reads use the bot token scopes above. Private channel history is available only for private channels the Slack app has access to. Invite the app to private channels that should be used as StoryVault context.

References:

- Slack `conversations.history`: <https://docs.slack.dev/reference/methods/conversations.history/>

## Frontend Environment

Set the public Slack OAuth client ID in the app environment.

```bash
NUXT_PUBLIC_SLACK_OAUTH_CLIENT_ID=123456789.123456789
NUXT_PUBLIC_SLACK_OAUTH_REDIRECT_URI=https://<your-host>/admin/storyvault/slack-callback
```

`NUXT_PUBLIC_SLACK_OAUTH_REDIRECT_URI` is optional when the deployed callback URL exactly matches the URL registered in Slack.

## Firebase Functions Environment

Set the backend OAuth client secret and token encryption key.

```bash
SLACK_OAUTH_CLIENT_ID=123456789.123456789
SLACK_OAUTH_CLIENT_SECRET=replace-with-slack-oauth-client-secret
SLACK_TOKEN_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
```

Deploy `backend/app` after setting these values. The callable functions are:

- `connect_slack`
- `get_slack_connection`
- `disconnect_slack`
- `test_slack_connection`
- `list_slack_messages`

## User Flow

1. Open preferences or the StoryVault Slack connection card.
2. Click `Slack を接続`.
3. Approve the Slack OAuth prompt.
4. Run `接続テスト` or fetch related context for an operation video with provider `slack`.

Related Slack messages are saved under `operationVideo.relatedContexts.slack.messages` and are included in StoryVault MCP `get_operation_video_context` / `get_story_context` reports.
