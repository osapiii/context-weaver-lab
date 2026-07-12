# StoryVault Migration: Legacy Cleanup Candidates

Generated: 2026-07-03

## Current Production Target

- Firebase/GCP project: `storyvault-dev`
- Hosting: `https://storyvault-dev.web.app`
- ADK artifact bucket: `gs://storyvault-dev-adk-artifacts`
- StoryVault video worker prefix: `storyvault-*`

## Project Split Resolution

`storyvault-dev` is the canonical Firebase/GCP project.

The accidental `storyvault-dev-6dd00` project had one Firebase Auth user and an empty Storage bucket. The Auth user was exported and imported into `storyvault-dev`; `storyvault-dev` now has initialized Firebase Auth, authorized domains, and the Firebase Storage bucket.

`storyvault-dev-6dd00` has been deletion-requested with `gcloud projects delete storyvault-dev-6dd00`.

Verified canonical resources:

- Firebase Auth project: `storyvault-dev`
- Firebase Auth authorized domains:
  - `localhost`
  - `storyvault-dev.firebaseapp.com`
  - `storyvault-dev.web.app`
- Firebase Storage bucket: `gs://storyvault-dev.firebasestorage.app`
- Firebase Web app:
  - app ID: `1:539230065284:web:27ce9517eeeea78c8ca8d1`
  - auth domain: `storyvault-dev.firebaseapp.com`

## Verified StoryVault Deployments

- `storyvault-ai-video-sectioning`
- `storyvault-split-video-by-timestamps`
- `storyvault-transcribe-audio-with-gcp-speech-to-text`
- `storyvault-text-to-speech-with-google`
- `storyvault-merge-audio-files`
- `storyvault-merge-video-audio-narration`
- `storyvault-concatenate-section-videos`
- `storyvault-add-video-subtitle`
- `storyvault-trim-silence-video`
- `storyvault-compress-and-convert-video`

## Do Not Delete Yet

Keep these until request logs confirm zero traffic from StoryVault Functions and Hosting.

### `storyvault-dev` Legacy Cloud Run Candidates

```bash
gcloud run services delete addvideosubtitle --project storyvault-dev --region asia-northeast1
gcloud run services delete compress-and-convert-video --project storyvault-dev --region asia-northeast1
gcloud run services delete concatenate-section-videos --project storyvault-dev --region asia-northeast1
gcloud run services delete merge-audio-files --project storyvault-dev --region asia-northeast1
gcloud run services delete split-video-by-timestamps --project storyvault-dev --region asia-northeast1
gcloud run services delete text-to-speech-with-google --project storyvault-dev --region asia-northeast1
gcloud run services delete transcribe-zapping-video-with-aqua --project storyvault-dev --region asia-northeast1
gcloud run services delete vohance-ai-video-sectioning --project storyvault-dev --region asia-northeast1
gcloud run services delete vohance-merge-video-audio-narration --project storyvault-dev --region asia-northeast1
gcloud run services delete vohance-trim-silence-video --project storyvault-dev --region asia-northeast1
```

### `vibe-control-dev` Legacy Cloud Run Candidates

```bash
gcloud run services delete vibe-capability-structuring-agent --project vibe-control-dev --region asia-northeast1
gcloud run services delete vibe-control-mcp --project vibe-control-dev --region asia-northeast1
gcloud run services delete vibe-story-generation-agent --project vibe-control-dev --region asia-northeast1
gcloud run services delete vibe-zapping-analysis-agent --project vibe-control-dev --region asia-northeast1
gcloud run services delete vohance-add-video-subtitle --project vibe-control-dev --region asia-northeast1
gcloud run services delete vohance-ai-video-sectioning --project vibe-control-dev --region asia-northeast1
gcloud run services delete vohance-compress-and-convert-video --project vibe-control-dev --region asia-northeast1
gcloud run services delete vohance-concatenate-section-videos --project vibe-control-dev --region asia-northeast1
gcloud run services delete vohance-merge-audio-files --project vibe-control-dev --region asia-northeast1
gcloud run services delete vohance-merge-video-audio-narration --project vibe-control-dev --region asia-northeast1
gcloud run services delete vohance-split-video-by-timestamps --project vibe-control-dev --region asia-northeast1
gcloud run services delete vohance-text-to-speech-with-google --project vibe-control-dev --region asia-northeast1
gcloud run services delete vohance-transcribe-audio-with-gcp-speech-to-text --project vibe-control-dev --region asia-northeast1
gcloud run services delete vohance-trim-silence-video --project vibe-control-dev --region asia-northeast1
```

## Manual External UI Tasks

- GitHub OAuth App: app name `StoryVault`; callback `https://storyvault-dev.web.app/admin/storyvault/github-callback`.
- Slack App: app/display name `StoryVault`; redirect `https://storyvault-dev.web.app/admin/storyvault/slack-callback`.
- Google Cloud OAuth consent/client: app name `StoryVault`; authorized domain and redirect URIs for `storyvault-dev.web.app`.
- Firebase Auth: done for `storyvault-dev`.
- Firebase Storage: done for `storyvault-dev`; rules deployed.
- SendGrid: sender name and template display names use `StoryVault`.
- Datadog: dashboards, monitors, saved views use StoryVault naming.

## Verification Notes

- `STORYVAULT_VIDEO_*_URL` is now the primary Functions env naming.
- `VOHANCE_*` env reads remain only as one-release fallback compatibility in code.
- Legacy Cloud Run services were not deleted by this migration.
