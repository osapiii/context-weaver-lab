import { computed, ref, shallowRef } from "vue";

export type ScreenVideoAspectPreset = {
  id: "16:9" | "9:16" | "1:1" | "4:3";
  label: string;
  width: number;
  height: number;
  note: string;
};

export type ScreenVideoRecordingMetadata = {
  width: number;
  height: number;
  durationSeconds: number;
  aspectRatio: number;
};

export type ScreenVideoRecorderStatus =
  | "idle"
  | "recording"
  | "recorded"
  | "error";

export type ScreenVideoAspectCheck = {
  status: "none" | "matched" | "near" | "mismatch";
  label: string;
  detail: string;
};

const MIME_TYPE_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=h264,opus",
  "video/webm",
] as const;

export const screenVideoAspectPresets: ScreenVideoAspectPreset[] = [
  {
    id: "16:9",
    label: "横長 16:9",
    width: 1920,
    height: 1080,
    note: "YouTube / 標準デモ向け",
  },
  {
    id: "9:16",
    label: "縦長 9:16",
    width: 1080,
    height: 1920,
    note: "ショート動画向け",
  },
  {
    id: "1:1",
    label: "正方形 1:1",
    width: 1080,
    height: 1080,
    note: "SNS / 埋め込み向け",
  },
  {
    id: "4:3",
    label: "資料 4:3",
    width: 1440,
    height: 1080,
    note: "スライド・管理画面向け",
  },
];

const DEFAULT_SCREEN_VIDEO_ASPECT_PRESET: ScreenVideoAspectPreset = screenVideoAspectPresets[0] ?? {
  id: "16:9",
  label: "横長 16:9",
  width: 1920,
  height: 1080,
  note: "YouTube / 標準デモ向け",
};

const stopStream = (stream: MediaStream | null): void => {
  stream?.getTracks().forEach((track) => track.stop());
};

const pickRecorderMimeType = (): string => {
  if (!import.meta.client || typeof MediaRecorder === "undefined") return "";
  return MIME_TYPE_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
};

const extensionFromMimeType = (mimeType: string): string =>
  mimeType.includes("mp4") ? "mp4" : "webm";

const createRecordingFileName = (title: string, mimeType: string): string => {
  const baseName = title.trim() || "screen-recording";
  const safeBaseName = baseName
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100);
  return `${safeBaseName}_${new Date().toISOString().replace(/[:.]/g, "-")}.${extensionFromMimeType(mimeType)}`;
};

const loadVideoMetadata = (url: string): Promise<ScreenVideoRecordingMetadata> =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
        aspectRatio: video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 0,
      });
      video.removeAttribute("src");
      video.load();
    };
    video.onerror = () => reject(new Error("録画した動画のメタデータを読み取れませんでした。"));
    video.src = url;
  });

export const useScreenVideoRecorder = () => {
  const status = ref<ScreenVideoRecorderStatus>("idle");
  const errorMessage = ref("");
  const includeMicrophone = ref(true);
  const includeSystemAudio = ref(true);
  const selectedAspectPresetId = ref<ScreenVideoAspectPreset["id"]>("16:9");
  const elapsedMs = ref(0);
  const blob = ref<Blob | null>(null);
  const previewUrl = ref("");
  const mimeType = ref("");
  const metadata = ref<ScreenVideoRecordingMetadata | null>(null);
  const displaySurface = ref("");
  const audioLevel = ref(0);
  const waveformBars = ref<number[]>(Array.from({ length: 36 }, () => 0.12));
  const liveStream = shallowRef<MediaStream | null>(null);

  let displayStream: MediaStream | null = null;
  let microphoneStream: MediaStream | null = null;
  let mixedStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let audioAnalyser: AnalyserNode | null = null;
  let waveformAnimationFrame: number | null = null;
  let recorder: MediaRecorder | null = null;
  let timer: number | null = null;
  let startedAt = 0;
  let chunks: BlobPart[] = [];

  const selectedAspectPreset = computed(
    () =>
      screenVideoAspectPresets.find((preset) => preset.id === selectedAspectPresetId.value) ??
      DEFAULT_SCREEN_VIDEO_ASPECT_PRESET
  );

  const isSupported = computed(
    () =>
      import.meta.client &&
      Boolean(navigator.mediaDevices?.getDisplayMedia) &&
      typeof MediaRecorder !== "undefined"
  );

  const isRecording = computed(() => status.value === "recording");
  const hasRecording = computed(() => Boolean(blob.value));
  const elapsedSeconds = computed(() => Math.floor(elapsedMs.value / 1000));
  const elapsedLabel = computed(() => {
    const minutes = Math.floor(elapsedSeconds.value / 60);
    const seconds = elapsedSeconds.value % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  });

  const aspectCheck = computed<ScreenVideoAspectCheck>(() => {
    if (!metadata.value) {
      return {
        status: "none",
        label: "未確認",
        detail: "録画後に実際の解像度と比率を確認します。",
      };
    }
    const expected = selectedAspectPreset.value.width / selectedAspectPreset.value.height;
    const diff = Math.abs(metadata.value.aspectRatio - expected) / expected;
    const actualLabel = `${metadata.value.width} x ${metadata.value.height}`;
    if (diff <= 0.015) {
      return {
        status: "matched",
        label: "比率OK",
        detail: `${actualLabel} / ${selectedAspectPreset.value.id} に合っています。`,
      };
    }
    if (diff <= 0.05) {
      return {
        status: "near",
        label: "ほぼOK",
        detail: `${actualLabel} / 少しだけ ${selectedAspectPreset.value.id} から外れています。`,
      };
    }
    return {
      status: "mismatch",
      label: "比率注意",
      detail: `${actualLabel} / 推奨 ${selectedAspectPreset.value.width} x ${selectedAspectPreset.value.height} に合わせて撮り直すと編集しやすくなります。`,
    };
  });

  const revokePreviewUrl = (): void => {
    if (!previewUrl.value) return;
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  };

  const stopTimer = (): void => {
    if (timer === null) return;
    window.clearInterval(timer);
    timer = null;
  };

  const resetWaveform = (): void => {
    audioLevel.value = 0;
    waveformBars.value = Array.from({ length: 36 }, () => 0.12);
  };

  const stopWaveformMeter = (): void => {
    if (waveformAnimationFrame !== null) {
      window.cancelAnimationFrame(waveformAnimationFrame);
      waveformAnimationFrame = null;
    }
    audioAnalyser = null;
    resetWaveform();
  };

  const startWaveformMeter = (stream: MediaStream): void => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stopWaveformMeter();
      return;
    }
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextConstructor) return;
    if (!audioContext) audioContext = new AudioContextConstructor();
    const sourceNode = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 1024;
    audioAnalyser.smoothingTimeConstant = 0.72;
    sourceNode.connect(audioAnalyser);

    const data = new Uint8Array(audioAnalyser.fftSize);
    const barCount = waveformBars.value.length;

    const tick = () => {
      if (!audioAnalyser) return;
      audioAnalyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      const nextBars: number[] = [];
      const bucketSize = Math.max(1, Math.floor(data.length / barCount));
      for (let index = 0; index < barCount; index += 1) {
        const start = index * bucketSize;
        const end = Math.min(data.length, start + bucketSize);
        let peak = 0;
        for (let i = start; i < end; i += 1) {
          const normalized = Math.abs((data[i] ?? 128) - 128) / 128;
          peak = Math.max(peak, normalized);
          sumSquares += normalized * normalized;
        }
        nextBars.push(Math.min(1, Math.max(0.1, peak * 1.65)));
      }
      audioLevel.value = Math.min(1, Math.sqrt(sumSquares / data.length) * 3.2);
      waveformBars.value = nextBars;
      waveformAnimationFrame = window.requestAnimationFrame(tick);
    };

    tick();
  };

  const cleanupStreams = (): void => {
    stopWaveformMeter();
    stopStream(displayStream);
    stopStream(microphoneStream);
    stopStream(mixedStream);
    displayStream = null;
    microphoneStream = null;
    mixedStream = null;
    liveStream.value = null;
    void audioContext?.close().catch(() => undefined);
    audioContext = null;
  };

  const buildRecordingStream = async (source: MediaStream): Promise<MediaStream> => {
    const videoTracks = source.getVideoTracks();
    const sourceAudioTracks = includeSystemAudio.value ? source.getAudioTracks() : [];

    if (!includeMicrophone.value) {
      return new MediaStream([...videoTracks, ...sourceAudioTracks]);
    }

    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const microphoneAudioTracks = microphoneStream.getAudioTracks();
    if (sourceAudioTracks.length === 0 && microphoneAudioTracks.length === 0) {
      return new MediaStream(videoTracks);
    }

    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    for (const audioTrack of [...sourceAudioTracks, ...microphoneAudioTracks]) {
      const stream = new MediaStream([audioTrack]);
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNode.connect(destination);
    }

    return new MediaStream([...videoTracks, ...destination.stream.getAudioTracks()]);
  };

  const reset = (): void => {
    if (isRecording.value) return;
    revokePreviewUrl();
    stopTimer();
    cleanupStreams();
    recorder = null;
    chunks = [];
    blob.value = null;
    metadata.value = null;
    mimeType.value = "";
    displaySurface.value = "";
    elapsedMs.value = 0;
    resetWaveform();
    errorMessage.value = "";
    status.value = "idle";
  };

  const start = async (): Promise<void> => {
    if (!isSupported.value) {
      status.value = "error";
      errorMessage.value = "このブラウザでは画面録画を開始できません。Chrome / Edge で試してください。";
      return;
    }

    reset();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "window",
          width: { ideal: selectedAspectPreset.value.width },
          height: { ideal: selectedAspectPreset.value.height },
        } as MediaTrackConstraints,
        audio: includeSystemAudio.value,
      });
      displayStream = stream;
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings() as MediaTrackSettings & {
        displaySurface?: string;
      };
      displaySurface.value = settings.displaySurface ?? "";
      videoTrack?.addEventListener("ended", () => {
        if (isRecording.value) stop();
      });

      mixedStream = await buildRecordingStream(stream);
      liveStream.value = mixedStream;
      startWaveformMeter(mixedStream);
      const selectedMimeType = pickRecorderMimeType();
      mimeType.value = selectedMimeType || "video/webm";
      recorder = new MediaRecorder(
        mixedStream,
        selectedMimeType ? { mimeType: selectedMimeType } : undefined
      );
      chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stopTimer();
        const resolvedMimeType = recorder?.mimeType || mimeType.value || "video/webm";
        blob.value = new Blob(chunks, { type: resolvedMimeType });
        mimeType.value = resolvedMimeType;
        previewUrl.value = URL.createObjectURL(blob.value);
        void loadVideoMetadata(previewUrl.value)
          .then((loaded) => {
            metadata.value = loaded;
          })
          .catch((error) => {
            errorMessage.value = error instanceof Error ? error.message : String(error);
          });
        cleanupStreams();
        recorder = null;
        resetWaveform();
        status.value = "recorded";
      };
      startedAt = Date.now();
      timer = window.setInterval(() => {
        elapsedMs.value = Date.now() - startedAt;
      }, 250);
      recorder.start(1000);
      status.value = "recording";
    } catch (error) {
      stopTimer();
      cleanupStreams();
      recorder = null;
      status.value = "error";
      errorMessage.value =
        error instanceof Error ? error.message : "画面録画の開始に失敗しました。";
    }
  };

  const stop = (): void => {
    if (recorder && recorder.state !== "inactive") {
      elapsedMs.value = Date.now() - startedAt;
      recorder.stop();
      return;
    }
    stopTimer();
    cleanupStreams();
    status.value = blob.value ? "recorded" : "idle";
  };

  const createFile = (title: string): File | null => {
    if (!blob.value) return null;
    const type = blob.value.type || mimeType.value || "video/webm";
    return new File([blob.value], createRecordingFileName(title, type), { type });
  };

  const dispose = (): void => {
    if (isRecording.value) stop();
    revokePreviewUrl();
    stopTimer();
    cleanupStreams();
  };

  return {
    status,
    errorMessage,
    includeMicrophone,
    includeSystemAudio,
    selectedAspectPresetId,
    selectedAspectPreset,
    elapsedMs,
    elapsedLabel,
    blob,
    previewUrl,
    mimeType,
    metadata,
    displaySurface,
    audioLevel,
    waveformBars,
    liveStream,
    aspectCheck,
    isSupported,
    isRecording,
    hasRecording,
    start,
    stop,
    reset,
    createFile,
    dispose,
  };
};
