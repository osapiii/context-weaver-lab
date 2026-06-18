import { onUnmounted, ref } from "vue";

export function useWebCameraCapture() {
  const stream = ref<MediaStream | null>(null);
  const error = ref<string | null>(null);
  const isActive = ref(false);

  const stop = (): void => {
    for (const track of stream.value?.getTracks() ?? []) {
      track.stop();
    }
    stream.value = null;
    isActive.value = false;
  };

  const start = async (videoEl: HTMLVideoElement): Promise<void> => {
    error.value = null;
    stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("このブラウザではカメラを利用できません");
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.value = media;
      videoEl.srcObject = media;
      await videoEl.play();
      isActive.value = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error.value = msg;
      throw new Error(
        `カメラを起動できませんでした: ${msg}（HTTPS とカメラ許可を確認してください）`
      );
    }
  };

  const captureJpegBlob = (
    videoEl: HTMLVideoElement,
    quality = 0.85
  ): Blob => {
    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    if (!w || !h) {
      throw new Error("カメラ映像の準備ができていません");
    }
    const maxSide = 2048;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像の生成に失敗しました");
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.split(",")[1];
    if (!base64) throw new Error("画像のエンコードに失敗しました");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: "image/jpeg" });
  };

  onUnmounted(() => {
    stop();
  });

  return {
    stream,
    error,
    isActive,
    start,
    stop,
    captureJpegBlob,
  };
}
