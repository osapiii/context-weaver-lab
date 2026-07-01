# Vohance Video Workers

This directory contains the Vohance media-processing Cloud Run workers copied
for EN AIstudio video mode.

Source checkout:

`/Users/masahiro.osanai/Documents/Github/Vohance/backend/microservice/individual`

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

`backend/app/triggers/vohance_video_requests.py`

Required environment variables on the Functions runtime:

- `VOHANCE_AI_VIDEO_SECTIONING_URL`
- `VOHANCE_SPLIT_VIDEO_BY_TIMESTAMPS_URL`
- `VOHANCE_TRANSCRIBE_AUDIO_WITH_GCP_STT_URL`
- `VOHANCE_TEXT_TO_SPEECH_WITH_GOOGLE_URL`
- `VOHANCE_MERGE_VIDEO_AUDIO_NARRATION_URL`
- `VOHANCE_CONCATENATE_SECTION_VIDEOS_URL`
- `VOHANCE_ADD_VIDEO_SUBTITLE_URL`
- `VOHANCE_TRIM_SILENCE_VIDEO_URL`

The bridge intentionally does not register an ADK agent. Vohance did not use
the EN AIstudio unified ADK path for this workflow; the AI Studio UI creates
space-scoped RequestDocs and these triggers forward them to the workers.
