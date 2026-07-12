import { computed, ref } from "vue";
import type {
  ImageRetouchRegion,
  ImageRetouchRegionReference,
  NormalizedBbox,
} from "@utils/imageStudioState";
import { fetchArtifactImageBlob } from "@utils/artifactDisplayUrl";

const drawCropToCanvas = (params: {
  img: HTMLImageElement;
  bbox: NormalizedBbox;
}): HTMLCanvasElement | null => {
  const naturalW = params.img.naturalWidth || params.img.width;
  const naturalH = params.img.naturalHeight || params.img.height;
  if (!naturalW || !naturalH) return null;

  const sx = Math.round(params.bbox.x * naturalW);
  const sy = Math.round(params.bbox.y * naturalH);
  const sw = Math.max(1, Math.round(params.bbox.w * naturalW));
  const sh = Math.max(1, Math.round(params.bbox.h * naturalH));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(params.img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
};

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });

const loadImageFromUrl = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = url;
  });

export const isCanvasSafeDisplayUrl = (url: string): boolean => {
  const trimmed = url.trim();
  return (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.includes("firebasestorage.googleapis.com")
  );
};

const waitForImageElementReady = async (
  img: HTMLImageElement
): Promise<HTMLImageElement | null> => {
  if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
    return img;
  }
  return new Promise((resolve) => {
    img.onload = () =>
      resolve(img.naturalWidth > 0 || img.width > 0 ? img : null);
    img.onerror = () => resolve(null);
  });
};

/** キャンバス上に表示済みの img から crop（canvas-safe URL のときのみ） */
export const cropImageElementToBlob = async (params: {
  img: HTMLImageElement;
  bbox: NormalizedBbox;
}): Promise<Blob | null> => {
  const img = await waitForImageElementReady(params.img);
  if (!img) return null;
  try {
    const canvas = drawCropToCanvas({ img, bbox: params.bbox });
    if (!canvas) return null;
    return canvasToPngBlob(canvas);
  } catch {
    return null;
  }
};

/** gs:// → Storage SDK / getDownloadURL → blob 経由で crop（tainted canvas 回避） */
export const cropImageFromGcsPath = async (params: {
  storageGcsPath: string;
  bbox: NormalizedBbox;
  contentType?: string | null;
}): Promise<Blob | null> => {
  const contentType = params.contentType?.trim() || "image/png";
  const sourceBlob = await fetchArtifactImageBlob({
    storageGcsPath: params.storageGcsPath,
    contentType,
  });
  if (!sourceBlob) return null;

  const blobUrl = URL.createObjectURL(sourceBlob);
  try {
    const img = await loadImageFromUrl(blobUrl);
    if (!img) return null;
    const canvas = drawCropToCanvas({ img, bbox: params.bbox });
    if (!canvas) return null;
    return canvasToPngBlob(canvas);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

export const cropImageBlobToRegionBlob = async (params: {
  sourceBlob: Blob;
  bbox: NormalizedBbox;
}): Promise<Blob | null> => {
  const blobUrl = URL.createObjectURL(params.sourceBlob);
  try {
    const img = await loadImageFromUrl(blobUrl);
    if (!img) return null;
    const canvas = drawCropToCanvas({ img, bbox: params.bbox });
    if (!canvas) return null;
    return canvasToPngBlob(canvas);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

export const useImageStudioCanvas = () => {
  const regions = ref<ImageRetouchRegion[]>([]);
  const selectedRegionId = ref<string | null>(null);
  const isDrawing = ref(false);
  const draftBbox = ref<NormalizedBbox | null>(null);
  const drawStart = ref<{ x: number; y: number } | null>(null);

  const selectedRegion = computed(() =>
    regions.value.find((region) => region.id === selectedRegionId.value) ?? null
  );

  const addRegion = (params: {
    bbox: NormalizedBbox;
    instruction?: string;
    cropGcsPath?: string;
  }): void => {
    const id = `region_${Date.now()}_${regions.value.length}`;
    regions.value = [
      ...regions.value,
      {
        id,
        bbox: params.bbox,
        instruction: params.instruction?.trim() ?? "",
        ...(params.cropGcsPath ? { cropGcsPath: params.cropGcsPath } : {}),
      },
    ];
    selectedRegionId.value = id;
    draftBbox.value = null;
  };

  const updateRegionInstruction = (params: {
    id: string;
    instruction: string;
  }): void => {
    regions.value = regions.value.map((region) =>
      region.id === params.id
        ? { ...region, instruction: params.instruction }
        : region
    );
  };

  const updateRegionCropPath = (params: {
    id: string;
    cropGcsPath: string;
  }): void => {
    regions.value = regions.value.map((region) =>
      region.id === params.id
        ? { ...region, cropGcsPath: params.cropGcsPath }
        : region
    );
  };

  const updateRegionReferenceImage = (params: {
    id: string;
    referenceImage: ImageRetouchRegionReference | undefined;
  }): void => {
    regions.value = regions.value.map((region) => {
      if (region.id !== params.id) return region;
      const next = { ...region };
      if (params.referenceImage) {
        next.referenceImage = params.referenceImage;
      } else {
        delete next.referenceImage;
      }
      return next;
    });
  };

  const selectRegion = (id: string | null): void => {
    if (!id || regions.value.some((region) => region.id === id)) {
      selectedRegionId.value = id;
    }
  };

  const hitTestRegion = (params: { x: number; y: number }): string | null => {
    for (let i = regions.value.length - 1; i >= 0; i -= 1) {
      const region = regions.value[i]!;
      const { x, y, w, h } = region.bbox;
      if (
        params.x >= x &&
        params.x <= x + w &&
        params.y >= y &&
        params.y <= y + h
      ) {
        return region.id;
      }
    }
    return null;
  };

  const removeRegion = (id: string): void => {
    regions.value = regions.value.filter((region) => region.id !== id);
    if (selectedRegionId.value === id) {
      selectedRegionId.value = regions.value[0]?.id ?? null;
    }
  };

  const setRegions = (next: ImageRetouchRegion[]): void => {
    regions.value = next;
    if (
      selectedRegionId.value &&
      !next.some((region) => region.id === selectedRegionId.value)
    ) {
      selectedRegionId.value = null;
    }
  };

  const beginDraw = (params: { x: number; y: number }): void => {
    isDrawing.value = true;
    drawStart.value = params;
    draftBbox.value = { x: params.x, y: params.y, w: 0, h: 0 };
  };

  const moveDraw = (params: { x: number; y: number }): void => {
    if (!isDrawing.value || !drawStart.value) return;
    const x0 = drawStart.value.x;
    const y0 = drawStart.value.y;
    const x = Math.min(x0, params.x);
    const y = Math.min(y0, params.y);
    const w = Math.abs(params.x - x0);
    const h = Math.abs(params.y - y0);
    draftBbox.value = { x, y, w, h };
  };

  const endDraw = (): NormalizedBbox | null => {
    isDrawing.value = false;
    drawStart.value = null;
    const bbox = draftBbox.value;
    draftBbox.value = null;
    if (!bbox || bbox.w < 0.01 || bbox.h < 0.01) return null;
    return bbox;
  };

  return {
    regions,
    selectedRegionId,
    selectedRegion,
    draftBbox,
    isDrawing,
    addRegion,
    updateRegionInstruction,
    updateRegionCropPath,
    updateRegionReferenceImage,
    removeRegion,
    selectRegion,
    hitTestRegion,
    setRegions,
    beginDraw,
    moveDraw,
    endDraw,
  };
};
