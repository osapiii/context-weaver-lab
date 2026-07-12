import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from "vue";
import { useAgentAttachments } from "@composables/agentAttachments/useAgentAttachments";
import {
  useImageStudioCanvas,
  cropImageBlobToRegionBlob,
  cropImageFromGcsPath,
  isCanvasSafeDisplayUrl,
} from "@composables/useImageStudioCanvas";
import type {
  ImageRetouchRegion,
  ImageRetouchRegionReference,
  NormalizedBbox,
} from "@utils/imageStudioState";
import {
  extractClipboardImageFiles,
  readClipboardImageFiles,
} from "@utils/clipboardImages";
import {
  fetchArtifactImageBlob,
  parseGsPath,
  resolveArtifactBlobUrl,
  resolveArtifactDisplayUrl,
  resolveAuthenticatedUrlFromGcs,
} from "@utils/artifactDisplayUrl";
import { resolveStorageBucketName } from "@utils/adkAttachments";
import log from "@utils/logger";

const sortGcsPathsDefaultBucketFirst = (paths: string[]): string[] => {
  const defaultBucket = resolveStorageBucketName();
  return [...paths].sort((a, b) => {
    const aDefault = parseGsPath(a)?.bucket === defaultBucket ? 0 : 1;
    const bDefault = parseGsPath(b)?.bucket === defaultBucket ? 0 : 1;
    return aDefault - bDefault;
  });
};

export const useImageStudioRetouchEditor = (params: {
  imageUrl: Ref<string>;
  storageGcsPath?: Ref<string | undefined | null>;
  sourceGcsPath?: Ref<string | undefined | null>;
  contentType?: Ref<string | undefined | null>;
  regions: Ref<ImageRetouchRegion[]>;
  disabled: Ref<boolean> | { value: boolean };
  onRegionsChange: (params: {
    regions: ImageRetouchRegion[];
    persist?: boolean;
  }) => void;
}) => {
  const canvas = useImageStudioCanvas();
  const attachmentsApi = useAgentAttachments({ maxBytes: 8 * 1024 * 1024 });
  const isUploading = ref(false);
  const isReferenceUploading = ref(false);
  const viewportRef = ref<HTMLElement | null>(null);
  const stageRef = ref<HTMLElement | null>(null);
  const viewportSize = ref({ width: 0, height: 0 });
  const imageNaturalSize = ref({ width: 0, height: 0 });
  const zoomMultiplier = ref(1);
  const cropPreviewUrls = ref<Record<string, string>>({});
  const cropPreviewFailed = ref<Record<string, boolean>>({});
  const uploadingRegionId = ref<string | null>(null);
  const referencePreviewUrls = ref<Record<string, string>>({});
  const suppressDraw = ref(false);
  const stableImageUrl = ref("");
  const retouchPrimaryGcsPath = ref<string | null>(null);
  const retouchPrimaryBlob = ref<Blob | null>(null);

  const primaryImageGcsPaths = computed(() => {
    const paths: string[] = [];
    const storage = params.storageGcsPath?.value?.trim();
    const source = params.sourceGcsPath?.value?.trim();
    if (storage) paths.push(storage);
    if (source && !paths.includes(source)) paths.push(source);
    return sortGcsPathsDefaultBucketFirst(paths);
  });

  const syncCanvasSafeImageUrl = async (): Promise<void> => {
    const contentType = params.contentType?.value?.trim() || "image/png";
    const defaultBucket = resolveStorageBucketName();

    for (const gcsPath of primaryImageGcsPaths.value) {
      const parsed = parseGsPath(gcsPath);
      if (!parsed || parsed.bucket !== defaultBucket) continue;

      const authenticatedUrl = await resolveAuthenticatedUrlFromGcs({
        storageGcsPath: gcsPath,
      });
      if (authenticatedUrl) {
        stableImageUrl.value = authenticatedUrl;
        return;
      }

      const blobUrl = await resolveArtifactBlobUrl({
        storageGcsPath: gcsPath,
        contentType,
      });
      if (blobUrl) {
        stableImageUrl.value = blobUrl;
        return;
      }
    }

    const fallback = params.imageUrl.value.trim();
    if (fallback && isCanvasSafeDisplayUrl(fallback)) {
      stableImageUrl.value = fallback;
    }
  };

  const ensureRetouchPrimaryOnFirebaseStorage = async (): Promise<string | null> => {
    if (retouchPrimaryGcsPath.value) {
      return retouchPrimaryGcsPath.value;
    }

    const contentType = params.contentType?.value?.trim() || "image/png";
    const defaultBucket = resolveStorageBucketName();

    for (const gcsPath of primaryImageGcsPaths.value) {
      const parsed = parseGsPath(gcsPath);
      if (!parsed || parsed.bucket !== defaultBucket) {
        continue;
      }

      const blob = await fetchArtifactImageBlob({
        storageGcsPath: gcsPath,
        contentType,
      });
      if (!blob) continue;

      retouchPrimaryGcsPath.value = gcsPath;
      retouchPrimaryBlob.value = blob;

      const authenticatedUrl = await resolveAuthenticatedUrlFromGcs({
        storageGcsPath: gcsPath,
      });
      if (authenticatedUrl) {
        stableImageUrl.value = authenticatedUrl;
      } else {
        const blobUrl = await resolveArtifactBlobUrl({
          storageGcsPath: gcsPath,
          contentType,
        });
        if (blobUrl) stableImageUrl.value = blobUrl;
      }
      return gcsPath;
    }

    log("WARN", "[imageStudioRetouch] primary not on Firebase Storage bucket", {
      paths: primaryImageGcsPaths.value,
      defaultBucket,
    });
    return null;
  };

  watch(
    [params.imageUrl, primaryImageGcsPaths, () => params.contentType?.value],
    () => {
      void syncCanvasSafeImageUrl();
      void ensureRetouchPrimaryOnFirebaseStorage();
    },
    { immediate: true }
  );

  const displayImageUrl = computed(
    () => stableImageUrl.value || params.imageUrl.value
  );

  const imageCrossOrigin = computed((): "anonymous" | undefined => {
    const url = displayImageUrl.value.trim();
    if (!url || url.startsWith("blob:") || url.startsWith("data:")) {
      return undefined;
    }
    if (url.includes("firebasestorage.googleapis.com")) {
      return "anonymous";
    }
    return undefined;
  });

  const ZOOM_STEP = 1.2;
  const MIN_ZOOM_MULTIPLIER = 0.5;
  const MAX_ZOOM_MULTIPLIER = 4;
  const VIEWPORT_PADDING_PX = 32;

  const fitScale = computed(() => {
    const { width: naturalW, height: naturalH } = imageNaturalSize.value;
    const { width: viewportW, height: viewportH } = viewportSize.value;
    if (!naturalW || !naturalH || !viewportW || !viewportH) return 1;
    const innerW = Math.max(1, viewportW - VIEWPORT_PADDING_PX);
    const innerH = Math.max(1, viewportH - VIEWPORT_PADDING_PX);
    return Math.min(innerW / naturalW, innerH / naturalH);
  });

  const displayScale = computed(() => fitScale.value * zoomMultiplier.value);

  const stageStyle = computed((): Record<string, string> => {
    const { width: naturalW, height: naturalH } = imageNaturalSize.value;
    if (!naturalW || !naturalH) {
      return { width: "100%", minHeight: "240px" };
    }
    return {
      width: `${Math.round(naturalW * displayScale.value)}px`,
      height: `${Math.round(naturalH * displayScale.value)}px`,
    };
  });

  const zoomLabel = computed(
    () => `${Math.round(zoomMultiplier.value * 100)}%`
  );

  const canZoomIn = computed(
    () => zoomMultiplier.value < MAX_ZOOM_MULTIPLIER - 0.001
  );

  const canZoomOut = computed(
    () => zoomMultiplier.value > MIN_ZOOM_MULTIPLIER + 0.001
  );

  const resetViewportZoom = (): void => {
    zoomMultiplier.value = 1;
  };

  const zoomIn = (): void => {
    zoomMultiplier.value = Math.min(
      zoomMultiplier.value * ZOOM_STEP,
      MAX_ZOOM_MULTIPLIER
    );
  };

  const zoomOut = (): void => {
    zoomMultiplier.value = Math.max(
      zoomMultiplier.value / ZOOM_STEP,
      MIN_ZOOM_MULTIPLIER
    );
  };

  const syncImageNaturalSize = (img: HTMLImageElement | null | undefined): void => {
    if (!img?.naturalWidth || !img.naturalHeight) return;
    imageNaturalSize.value = {
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
    resetViewportZoom();
  };

  const onImageLoad = (event: Event): void => {
    syncImageNaturalSize(event.target as HTMLImageElement);
  };

  const readImageNaturalSizeFromStage = (): void => {
    const img = stageRef.value?.querySelector("img");
    if (img?.complete) {
      syncImageNaturalSize(img);
    }
  };

  const onViewportWheel = (event: WheelEvent): void => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    if (event.deltaY < 0) {
      zoomIn();
    } else if (event.deltaY > 0) {
      zoomOut();
    }
  };

  let viewportResizeObserver: ResizeObserver | null = null;

  const bindViewportResizeObserver = (el: HTMLElement | null): void => {
    viewportResizeObserver?.disconnect();
    viewportResizeObserver = null;
    if (!el) return;
    viewportResizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      viewportSize.value = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
    });
    viewportResizeObserver.observe(el);
  };

  watch(viewportRef, (el) => bindViewportResizeObserver(el), {
    immediate: true,
  });

  watch(displayImageUrl, async () => {
    imageNaturalSize.value = { width: 0, height: 0 };
    resetViewportZoom();
    await nextTick();
    readImageNaturalSizeFromStage();
  });

  watch(stageRef, async () => {
    await nextTick();
    readImageNaturalSizeFromStage();
  });

  const workflowSteps = computed(() => [
    {
      id: "primary",
      label: "初稿を固定",
      icon: "material-symbols:image-outline",
      done: true,
    },
    {
      id: "regions",
      label: "範囲を指定",
      icon: "material-symbols:crop-free",
      done: canvas.regions.value.length > 0,
    },
    {
      id: "instructions",
      label: "指示を入力",
      icon: "material-symbols:edit-note",
      done: canvas.regions.value.some(
        (region) =>
          region.instruction.trim() ||
          Boolean(region.referenceImage?.gcsPath?.trim())
      ),
    },
    {
      id: "run",
      label: "レタッチ実行",
      icon: "material-symbols:play-arrow",
      done: false,
    },
  ]);

  const bboxStyle = (bbox: NormalizedBbox): Record<string, string> => ({
    left: `${bbox.x * 100}%`,
    top: `${bbox.y * 100}%`,
    width: `${bbox.w * 100}%`,
    height: `${bbox.h * 100}%`,
  });

  /**
   * 表示中の画像 URL をそのまま CSS で切り抜いてサムネ表示する.
   * プレビュー用 <img> が表示できている URL を再利用するので CORS / canvas 汚染と無縁.
   */
  const regionCropStyle = (bbox: NormalizedBbox): Record<string, string> => {
    const url = displayImageUrl.value.trim();
    if (!url) return {};
    const w = Math.min(Math.max(bbox.w, 0.0001), 1);
    const h = Math.min(Math.max(bbox.h, 0.0001), 1);
    const posX = w >= 1 ? 0 : (bbox.x / (1 - w)) * 100;
    const posY = h >= 1 ? 0 : (bbox.y / (1 - h)) * 100;
    return {
      backgroundImage: `url("${url}")`,
      backgroundSize: `${(1 / w) * 100}% ${(1 / h) * 100}%`,
      backgroundPosition: `${posX}% ${posY}%`,
      backgroundRepeat: "no-repeat",
    };
  };

  const regionRootStyle = (bbox: NormalizedBbox): Record<string, string> => ({
    ...bboxStyle(bbox),
    overflow: "visible",
  });

  const commentBubbleStyle = (bbox: NormalizedBbox): Record<string, string> => {
    const below = bbox.y + bbox.h;
    if (below < 0.72) {
      return {
        left: "0",
        top: "100%",
        marginTop: "4px",
      };
    }
    return {
      left: "0",
      bottom: "100%",
      marginBottom: "4px",
    };
  };

  const regionBoxClass = (regionId: string, index: number): string => {
    const selected = regionId === canvas.selectedRegionId.value;
    const palette = index % 2 === 0 ? "sky" : "violet";
    if (selected) {
      return "border-sky-500 bg-sky-400/20 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]";
    }
    return palette === "sky"
      ? "border-sky-400/90 bg-sky-300/20"
      : "border-violet-400/80 bg-violet-300/15";
  };

  const regionInstructionPlaceholder = (index: number): string =>
    `例）この部分を「${index === 0 ? "春の新商品" : "〇〇"}」に変更`;

  const revokeReferencePreview = (regionId: string): void => {
    const url = referencePreviewUrls.value[regionId];
    if (url?.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
    const next = { ...referencePreviewUrls.value };
    delete next[regionId];
    referencePreviewUrls.value = next;
  };

  const resolveReferencePreviewUrl = async (params: {
    regionId: string;
    reference: ImageRetouchRegionReference;
  }): Promise<void> => {
    revokeReferencePreview(params.regionId);
    if (params.reference.storageUrl?.trim()) {
      referencePreviewUrls.value = {
        ...referencePreviewUrls.value,
        [params.regionId]: params.reference.storageUrl.trim(),
      };
      return;
    }
    const gcsPath = params.reference.gcsPath?.trim();
    if (!gcsPath) return;
    try {
      const url = await resolveArtifactDisplayUrl({ storageGcsPath: gcsPath });
      if (url) {
        referencePreviewUrls.value = {
          ...referencePreviewUrls.value,
          [params.regionId]: url,
        };
      }
    } catch {
      // プレビューは省略
    }
  };

  const revokeCropPreview = (regionId: string): void => {
    const url = cropPreviewUrls.value[regionId];
    if (url?.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
    const next = { ...cropPreviewUrls.value };
    delete next[regionId];
    cropPreviewUrls.value = next;
  };

  const resolveCropPreviewFromGcsPath = async (params: {
    regionId: string;
    cropGcsPath: string;
  }): Promise<void> => {
    const authenticatedUrl = await resolveAuthenticatedUrlFromGcs({
      storageGcsPath: params.cropGcsPath,
    });
    const url =
      authenticatedUrl ??
      (await resolveArtifactDisplayUrl({
        storageGcsPath: params.cropGcsPath,
        contentType: "image/png",
      }));
    if (!url) return;
    cropPreviewUrls.value = {
      ...cropPreviewUrls.value,
      [params.regionId]: url,
    };
  };

  const flushRegionsToStore = (opts?: { persist?: boolean }): void => {
    params.onRegionsChange({
      regions: [...canvas.regions.value],
      persist: opts?.persist,
    });
  };

  const onRegionInstructionInput = (id: string, event: Event): void => {
    const target = event.target as HTMLTextAreaElement;
    canvas.updateRegionInstruction({
      id,
      instruction: target.value,
    });
  };

  const pointerToNormalized = (
    event: PointerEvent
  ): { x: number; y: number } | null => {
    const stage = stageRef.value;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  };

  const isDisabled = (): boolean => Boolean(params.disabled.value);

  const onSelectRegion = (id: string): void => {
    if (isDisabled()) return;
    canvas.selectRegion(id);
  };

  const onDeselectRegion = (): void => {
    if (isDisabled()) return;
    canvas.selectRegion(null);
  };

  const onRegionPointerDown = (params: {
    regionId: string;
    event: PointerEvent;
  }): void => {
    if (isDisabled()) return;
    suppressDraw.value = true;
    canvas.selectRegion(params.regionId);
    stageRef.value?.setPointerCapture(params.event.pointerId);
  };

  const onStagePointerDown = (event: PointerEvent): void => {
    if (isDisabled()) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-image-studio-region]")) {
      return;
    }
    onPointerDown(event);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (isDisabled()) return;
    const point = pointerToNormalized(event);
    if (!point) return;
    const hit = canvas.hitTestRegion(point);
    if (hit) {
      suppressDraw.value = true;
      canvas.selectRegion(hit);
      stageRef.value?.setPointerCapture(event.pointerId);
      return;
    }
    suppressDraw.value = false;
    canvas.selectRegion(null);
    canvas.beginDraw(point);
    stageRef.value?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (isDisabled() || suppressDraw.value) return;
    const point = pointerToNormalized(event);
    if (!point) return;
    canvas.moveDraw(point);
  };

  const cropPrimaryRegionToBlob = async (
    bbox: NormalizedBbox
  ): Promise<Blob | null> => {
    const contentType = params.contentType?.value?.trim() || "image/png";
    const primaryGcs = await ensureRetouchPrimaryOnFirebaseStorage();
    if (!primaryGcs) return null;

    if (retouchPrimaryBlob.value) {
      const cropped = await cropImageBlobToRegionBlob({
        sourceBlob: retouchPrimaryBlob.value,
        bbox,
      });
      if (cropped) return cropped;
    }

    return cropImageFromGcsPath({
      storageGcsPath: primaryGcs,
      bbox,
      contentType,
    });
  };

  /**
   * crop 画像は Gemini への任意ヒント（フル画像＋bbox だけでレタッチは成立する）.
   * 取得できる場合のみ best-effort で GCS にアップロードする. 失敗してもUIは止めない.
   */
  const uploadCropHintForRegion = async (params: {
    bbox: NormalizedBbox;
    regionId: string;
  }): Promise<void> => {
    uploadingRegionId.value = params.regionId;
    try {
      const blob = await cropPrimaryRegionToBlob(params.bbox);
      if (!blob) {
        log("INFO", "[imageStudioRetouch] crop hint skipped (no canvas-safe source)", {
          regionId: params.regionId,
        });
        return;
      }

      const file = new File([blob], `crop-${params.regionId}.png`, {
        type: "image/png",
      });
      const uploaded = await attachmentsApi.upload(file);
      if (!uploaded.gcsPath) return;

      canvas.updateRegionCropPath({
        id: params.regionId,
        cropGcsPath: uploaded.gcsPath,
      });
      flushRegionsToStore({ persist: true });
    } catch (error) {
      log("WARN", "[imageStudioRetouch] crop hint upload failed", {
        regionId: params.regionId,
        error,
      });
    } finally {
      uploadingRegionId.value = null;
    }
  };

  const onPointerUp = async (event: PointerEvent): Promise<void> => {
    if (isDisabled()) return;
    stageRef.value?.releasePointerCapture(event.pointerId);
    if (suppressDraw.value) {
      suppressDraw.value = false;
      return;
    }
    const bbox = canvas.endDraw();
    if (!bbox) return;
    canvas.addRegion({ bbox, instruction: "" });
    const regionId = canvas.selectedRegionId.value;
    flushRegionsToStore();
    if (regionId) {
      void uploadCropHintForRegion({ bbox, regionId });
    }
  };

  const uploadReferenceForRegion = async (params: {
    regionId: string;
    files: File[];
    source: "upload" | "clipboard";
  }): Promise<void> => {
    const file = params.files.find((f) => f.type.startsWith("image/"));
    if (!file) return;
    isReferenceUploading.value = true;
    try {
      const uploaded = await attachmentsApi.upload(file);
      if (!uploaded.gcsPath) return;
      const reference: ImageRetouchRegionReference = {
        id: uploaded.id,
        name: uploaded.name,
        mimeType: uploaded.mimeType,
        gcsPath: uploaded.gcsPath,
        storageUrl: uploaded.url,
        source: params.source,
      };
      canvas.updateRegionReferenceImage({
        id: params.regionId,
        referenceImage: reference,
      });
      await resolveReferencePreviewUrl({
        regionId: params.regionId,
        reference,
      });
      flushRegionsToStore({ persist: true });
    } finally {
      isReferenceUploading.value = false;
    }
  };

  const onReferenceFileInput = async (params: {
    regionId: string;
    event: Event;
  }): Promise<void> => {
    const input = params.event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = "";
    if (files.length === 0) return;
    await uploadReferenceForRegion({
      regionId: params.regionId,
      files,
      source: "upload",
    });
  };

  const onReferenceClipboard = async (params: {
    regionId: string;
    event?: ClipboardEvent;
  }): Promise<boolean> => {
    const files = params.event
      ? extractClipboardImageFiles(params.event)
      : await readClipboardImageFiles();
    if (files.length === 0) return false;
    await uploadReferenceForRegion({
      regionId: params.regionId,
      files,
      source: "clipboard",
    });
    return true;
  };

  const onClearRegionReference = (regionId: string): void => {
    revokeReferencePreview(regionId);
    canvas.updateRegionReferenceImage({
      id: regionId,
      referenceImage: undefined,
    });
    flushRegionsToStore({ persist: true });
  };

  const referenceThumbUrl = (regionId: string): string | undefined =>
    referencePreviewUrls.value[regionId];

  const onRemoveRegion = (id: string): void => {
    revokeCropPreview(id);
    revokeReferencePreview(id);
    canvas.removeRegion(id);
    flushRegionsToStore();
  };

  const regionSignature = (regions: ImageRetouchRegion[]): string =>
    regions
      .map(
        (region) =>
          `${region.id}:${region.bbox.x},${region.bbox.y},${region.bbox.w},${region.bbox.h}:${region.cropGcsPath ?? ""}:${region.referenceImage?.id ?? ""}`
      )
      .join("|");

  watch(
    params.regions,
    (next) => {
      if (regionSignature(next) === regionSignature(canvas.regions.value)) {
        next.forEach((region) => {
          const current = canvas.regions.value.find(
            (item) => item.id === region.id
          );
          if (current && current.instruction !== region.instruction) {
            canvas.updateRegionInstruction({
              id: region.id,
              instruction: region.instruction,
            });
          }
        });
        return;
      }
      canvas.setRegions(next);
      void Promise.all(
        next.map(async (region) => {
          if (!cropPreviewUrls.value[region.id] && region.cropGcsPath?.trim()) {
            await resolveCropPreviewFromGcsPath({
              regionId: region.id,
              cropGcsPath: region.cropGcsPath,
            });
          }
          if (
            region.referenceImage &&
            !referencePreviewUrls.value[region.id]
          ) {
            await resolveReferencePreviewUrl({
              regionId: region.id,
              reference: region.referenceImage,
            });
          }
        })
      );
    },
    { immediate: true, deep: true }
  );

  onMounted(() => {
    canvas.setRegions(params.regions.value);
    void ensureRetouchPrimaryOnFirebaseStorage();
  });

  onBeforeUnmount(() => {
    viewportResizeObserver?.disconnect();
    Object.keys(cropPreviewUrls.value).forEach((id) => revokeCropPreview(id));
    Object.keys(referencePreviewUrls.value).forEach((id) =>
      revokeReferencePreview(id)
    );
  });

  return {
    canvas,
    viewportRef,
    stageRef,
    stageStyle,
    zoomLabel,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    resetViewportZoom,
    onImageLoad,
    onViewportWheel,
    isUploading,
    uploadingRegionId,
    cropPreviewFailed,
    isReferenceUploading,
    displayImageUrl,
    imageCrossOrigin,
    workflowSteps,
    bboxStyle,
    regionCropStyle,
    regionRootStyle,
    commentBubbleStyle,
    regionBoxClass,
    regionInstructionPlaceholder,
    flushRegionsToStore,
    onRegionInstructionInput,
    onSelectRegion,
    onDeselectRegion,
    onRegionPointerDown,
    onStagePointerDown,
    onPointerMove,
    onPointerUp,
    onRemoveRegion,
    cropPreviewUrls,
    referenceThumbUrl,
    onReferenceFileInput,
    onReferenceClipboard,
    onClearRegionReference,
  };
};
