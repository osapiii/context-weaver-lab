# Public release and hackathon reviewer access

## Decision

The public demo must not bypass authentication. A dedicated Firebase Auth
email/password account is attached to the existing organization that already
contains the StoryVault application data. The account receives `rbacRole=2`
(organization administrator), so it can use all Spaces in that organization but
cannot access another organization or another user's BYOK secrets.

Credentials are shared privately with the organizer. Never put the email/password
pair in source code, screenshots, GitHub Actions variables exposed to pull requests,
or Firebase Hosting runtime configuration.

## Before making GitHub public

- [ ] Rotate any credential ever committed to Git history, even if later deleted.
- [ ] Run GitHub secret scanning (and push protection) plus a local scanner such as
      Gitleaks against the complete history.
- [ ] Confirm `.env*`, service-account JSON, signing keys, OAuth client secrets,
      MCP tokens, and downloaded customer data are ignored and untracked.
- [ ] Keep `NUXT_PUBLIC_DEV_AUTH_BYPASS_ENABLED=false` and
      `DEV_AUTH_BYPASS_ENABLED=false` in every hosted environment.
- [ ] Deploy the tenant-scoped Firestore and Storage rules and test them with a
      reviewer account and with a second-organization negative test.
- [ ] Review every Cloud Run service deployed with `--allow-unauthenticated`.
      Require Firebase/IAM authentication in the handler or make the service private.
- [ ] Enable Firebase App Check enforcement after validating the public web client.
- [ ] Set API quotas/budgets and alerts for video/AI processing services.
- [ ] Remove production/customer exports, local reports, generated videos, and
      temporary files from the GitHub publication set.

Firebase Web SDK configuration (including its API key) is a public application
identifier, not an authorization secret. Security must come from Auth, App Check,
Firestore/Storage rules, API restrictions, and server-side authorization.

## Enable reviewer login

1. Enable the **Email/Password** provider in Firebase Authentication for the demo
   project.
2. Build Hosting with:

   ```bash
   NUXT_PUBLIC_PASSWORD_AUTH_ENABLED=true
   NUXT_PUBLIC_DEV_AUTH_BYPASS_ENABLED=false
   ```

3. Validate the target organization before creating an account:

   ```bash
   python scripts/provision-storyvault-reviewer.py \
     --project storyvault-dev \
     --organization-id EXISTING_ORGANIZATION_ID \
     --email REVIEWER_EMAIL
   ```

4. Re-run with `--apply`. The script asks for a 12+ character password using a
   hidden terminal prompt and verifies that the organization contains StoryVault
   application data before changing Auth or Firestore.
5. Open `/admin/signin`, use **審査用ログイン**, and verify the StoryVault
   application, clips, stories, assets, reports, and MCP setup screens.
6. Test that the same account cannot read a document or Storage object belonging
   to a different organization.
7. After judging, disable or delete the reviewer Auth user and revoke any OAuth/MCP
   tokens created during review.

## Known migration item

Legacy Storage objects under `storyVault/**` do not contain an organization ID in
their path. They are temporarily restricted to authenticated administrators. New
assets must use `organizations/{orgId}/spaces/{spaceId}/...`; migrate legacy assets
there before granting reviewer access to untrusted organizations.
