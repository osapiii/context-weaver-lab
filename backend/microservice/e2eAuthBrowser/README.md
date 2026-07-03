# E2E Auth Browser

Playwright 管理ブラウザを Cloud Run 上で起動し、手動ログイン後の
`storageState` を Secret Manager に保存するためのサービスです。

## Flow

1. Frontend calls `create_e2e_auth_browser_session`.
2. Firebase Functions returns a short-lived signed URL.
3. User opens the Cloud Run browser UI and signs in manually.
4. User clicks `ログイン状態を保存`.
5. The service stores Playwright `storageState` in Secret Manager.

The Secret Manager ID is shared with the manual save flow:

```text
storyvault-e2e-state-{organizationId}-{applicationId}
```

## Deploy

```bash
cd backend/microservice/e2eAuthBrowser
export PROJECT_ID=your-gcp-project
export E2E_AUTH_BROWSER_SHARED_SECRET="$(openssl rand -hex 32)"
./deploy.sh
```

After deploy, configure Firebase Functions with the same shared secret and the
Cloud Run service URL:

```bash
E2E_AUTH_BROWSER_URL=https://...
E2E_AUTH_BROWSER_SHARED_SECRET=...
```

The Cloud Run service account needs `roles/secretmanager.admin`; `deploy.sh`
creates a dedicated service account and grants that role.
