# StoryVault Video Workers

This directory contains the StoryVault media-processing Cloud Run workers copied
for EN AIstudio video mode.

Source checkout:

`/Users/masahiro.osanai/Documents/Github/StoryVault/backend/microservice/individual`

Workers:

- `aiVideoSectioning` -> `POST /auto-section`
- `splitVideoByTimestamps` -> `POST /split`
- `transcribeAudioWithGcpSpeechToText` -> `POST /transcribe`
- `textToSpeechWithGoogle` -> `POST /synthesize`
- `mergeAudioFiles` -> `POST /merge-audio`
- `mergeVideoAudioNarration` -> `POST /merge`
- `concatenateSectionVideos` -> `POST /concatenate`
- `addVideoSubtitle` -> `POST /add-subtitles`
- `trimSilenceVideo` -> `POST /trim-silence`
- `compressAndConvertVideo` -> `POST /compress`

Firebase Functions bridge:

`backend/app/triggers/storyvault_video_requests.py`

Required environment variables on the Functions runtime:

- `STORYVAULT_VIDEO_AI_SECTIONING_URL`
- `STORYVAULT_VIDEO_SPLIT_BY_TIMESTAMPS_URL`
- `STORYVAULT_VIDEO_TRANSCRIBE_AUDIO_WITH_GCP_STT_URL`
- `STORYVAULT_VIDEO_TEXT_TO_SPEECH_WITH_GOOGLE_URL`
- `STORYVAULT_VIDEO_MERGE_VIDEO_AUDIO_NARRATION_URL`
- `STORYVAULT_VIDEO_CONCATENATE_SECTION_VIDEOS_URL`
- `STORYVAULT_VIDEO_ADD_SUBTITLE_URL`
- `STORYVAULT_VIDEO_TRIM_SILENCE_URL`

The bridge intentionally does not register an ADK agent. StoryVault did not use
the EN AIstudio unified ADK path for this workflow; the AI Studio UI creates
space-scoped RequestDocs and these triggers forward them to the workers.
