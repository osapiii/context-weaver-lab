/** AI Studio 画像スタジオ — create / retouch フェーズと範囲指定 */

import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import { readImageTaskBucketFromSession } from "@utils/workspaceSessionBuckets";
import { isPanelPrimaryArtifact } from "@utils/workspaceArtifactMeta";

export type ImageWorkflowPhase = "create" | "retouch";

export interface NormalizedBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 範囲レタッチ用の差し替え参照画像（1 範囲につき最大 1 枚） */
export interface ImageRetouchRegionReference {
  id: string;
  name: string;
  mimeType: string;
  gcsPath: string;
  storageUrl?: string;
  source?: "upload" | "clipboard";
}

export interface ImageRetouchRegion {
  id: string;
  bbox: NormalizedBbox;
  instruction: string;
  cropGcsPath?: string;
  referenceImage?: ImageRetouchRegionReference;
}

export interface ImagePrimaryArtifact {
  artifactId: string | null;
  adkFilename: string | null;
  artifactVersion: number | null;
}

export interface ImageStudioFields {
  imageWorkflowPhase: ImageWorkflowPhase;
  primaryArtifact: ImagePrimaryArtifact;
  retouchRegions: ImageRetouchRegion[];
}

/** レタッチ送信時にチャットへ保存するスナップショット（編集対象 + 範囲） */
export interface ImageRetouchMessageContext {
  primary: {
    artifactId: string | null;
    adkFilename: string;
    artifactVersion: number | null;
  };
  regions: ImageRetouchRegion[];
}

export const buildImageRetouchMessageContext = (params: {
  primaryArtifact: ImagePrimaryArtifact;
  retouchRegions: ImageRetouchRegion[];
}): ImageRetouchMessageContext | null => {
  const filename = params.primaryArtifact.adkFilename?.trim();
  if (!filename) return null;
  return {
    primary: {
      artifactId: params.primaryArtifact.artifactId,
      adkFilename: filename,
      artifactVersion: params.primaryArtifact.artifactVersion,
    },
    regions: params.retouchRegions.map((region) => ({
      id: region.id,
      bbox: { ...region.bbox },
      instruction: region.instruction,
      ...(region.cropGcsPath ? { cropGcsPath: region.cropGcsPath } : {}),
      ...(region.referenceImage
        ? { referenceImage: { ...region.referenceImage } }
        : {}),
    })),
  };
};

export const emptyImagePrimaryArtifact = (): ImagePrimaryArtifact => ({
  artifactId: null,
  adkFilename: null,
  artifactVersion: null,
});

export const emptyImageStudioFields = (): ImageStudioFields => ({
  imageWorkflowPhase: "create",
  primaryArtifact: emptyImagePrimaryArtifact(),
  retouchRegions: [],
});

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const normalizeBbox = (raw: unknown): NormalizedBbox | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x = typeof o.x === "number" ? clamp01(o.x) : null;
  const y = typeof o.y === "number" ? clamp01(o.y) : null;
  const w = typeof o.w === "number" ? clamp01(o.w) : null;
  const h = typeof o.h === "number" ? clamp01(o.h) : null;
  if (x == null || y == null || w == null || h == null || w <= 0 || h <= 0) {
    return null;
  }
  return { x, y, w, h };
};

export const normalizeImageRetouchRegion = (
  raw: unknown
): ImageRetouchRegion | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const bbox = normalizeBbox(o.bbox);
  const instruction =
    typeof o.instruction === "string" ? o.instruction.trim() : "";
  const cropGcsPath =
    typeof o.crop_gcs_path === "string"
      ? o.crop_gcs_path.trim()
      : typeof o.cropGcsPath === "string"
        ? o.cropGcsPath.trim()
        : undefined;
  const referenceRaw = o.reference_image ?? o.referenceImage;
  let referenceImage: ImageRetouchRegionReference | undefined;
  if (referenceRaw && typeof referenceRaw === "object") {
    const ref = referenceRaw as Record<string, unknown>;
    const refId = typeof ref.id === "string" ? ref.id.trim() : "";
    const gcsPath =
      typeof ref.gcs_path === "string"
        ? ref.gcs_path.trim()
        : typeof ref.gcsPath === "string"
          ? ref.gcsPath.trim()
          : "";
    const name =
      typeof ref.name === "string" && ref.name.trim()
        ? ref.name.trim()
        : "参照画像";
    const mimeType =
      typeof ref.mime_type === "string"
        ? ref.mime_type
        : typeof ref.mimeType === "string"
          ? ref.mimeType
          : "image/png";
    const storageUrl =
      typeof ref.storage_url === "string"
        ? ref.storage_url.trim()
        : typeof ref.storageUrl === "string"
          ? ref.storageUrl.trim()
          : undefined;
    const source =
      ref.source === "clipboard" || ref.source === "upload"
        ? ref.source
        : undefined;
    if (refId && gcsPath) {
      referenceImage = {
        id: refId,
        name,
        mimeType,
        gcsPath,
        ...(storageUrl ? { storageUrl } : {}),
        ...(source ? { source } : {}),
      };
    }
  }
  if (!id || !bbox) return null;
  return {
    id,
    bbox,
    instruction,
    ...(cropGcsPath ? { cropGcsPath } : {}),
    ...(referenceImage ? { referenceImage } : {}),
  };
};

export const normalizeImageRetouchRegions = (raw: unknown): ImageRetouchRegion[] => {
  if (!Array.isArray(raw)) return [];
  const out: ImageRetouchRegion[] = [];
  for (const item of raw) {
    const region = normalizeImageRetouchRegion(item);
    if (region) out.push(region);
  }
  return out;
};

const normalizePrimaryFromRecord = (raw: unknown): ImagePrimaryArtifact => {
  if (!raw || typeof raw !== "object") return emptyImagePrimaryArtifact();
  const o = raw as Record<string, unknown>;
  const artifactId =
    typeof o.artifact_id === "string"
      ? o.artifact_id
      : typeof o.artifactId === "string"
        ? o.artifactId
        : null;
  const adkFilename =
    typeof o.adk_filename === "string"
      ? o.adk_filename
      : typeof o.adkFilename === "string"
        ? o.adkFilename
        : null;
  const versionRaw = o.version ?? o.artifact_version ?? o.artifactVersion;
  const artifactVersion =
    typeof versionRaw === "number" && Number.isFinite(versionRaw)
      ? versionRaw
      : null;
  if (!adkFilename?.trim()) return emptyImagePrimaryArtifact();
  return {
    artifactId,
    adkFilename: adkFilename.trim(),
    artifactVersion,
  };
};

export const resolveImageWorkflowPhaseFromRecord = (params: {
  state: Record<string, unknown>;
}): ImageWorkflowPhase => {
  const image = params.state.image;
  if (image && typeof image === "object" && !Array.isArray(image)) {
    const phase = (image as Record<string, unknown>).phase;
    if (phase === "create" || phase === "retouch") return phase;
  }
  return "create";
};

export const resolveImageStudioFieldsFromRecord = (params: {
  state: Record<string, unknown>;
}): ImageStudioFields => {
  const image = params.state.image;
  const bucket =
    image && typeof image === "object" && !Array.isArray(image)
      ? (image as Record<string, unknown>)
      : {};

  return {
    imageWorkflowPhase: resolveImageWorkflowPhaseFromRecord({
      state: params.state,
    }),
    primaryArtifact: normalizePrimaryFromRecord(bucket.primary),
    retouchRegions: normalizeImageRetouchRegions(bucket.retouch_regions),
  };
};

export const imagePrimaryHasReference = (
  primary: ImagePrimaryArtifact
): boolean => Boolean(primary.adkFilename?.trim());

/** 成果物が golden `state.image.primary` と同一か */
export const imagePrimaryMatchesArtifact = (params: {
  primary: ImagePrimaryArtifact;
  artifactId?: string;
  adkFilename?: string;
}): boolean => {
  const filename = params.adkFilename?.trim();
  const primaryFilename = params.primary.adkFilename?.trim();
  if (!filename || !primaryFilename || filename !== primaryFilename) {
    return false;
  }
  const artifactId = params.artifactId?.trim();
  const primaryId = params.primary.artifactId?.trim();
  if (primaryId && artifactId) {
    return primaryId === artifactId;
  }
  return true;
};

export const imageStudioStateToApi = (
  fields: ImageStudioFields
): Record<string, unknown> => {
  const phase = fields.imageWorkflowPhase;
  const primary = fields.primaryArtifact;
  const regions = fields.retouchRegions.map((region) => ({
    id: region.id,
    bbox: region.bbox,
    instruction: region.instruction,
    ...(region.cropGcsPath ? { crop_gcs_path: region.cropGcsPath } : {}),
  }));

  const primaryPayload = imagePrimaryHasReference(primary)
    ? {
        artifact_id: primary.artifactId,
        adk_filename: primary.adkFilename,
        version: primary.artifactVersion,
      }
    : null;

  return {
    image_workflow_phase: phase,
    primary_image: primaryPayload,
    retouch_regions: regions,
  };
};

/** モデルが付ける相対パス画像 Markdown を除去（artifact 表示と二重になるため） */
const RELATIVE_GENERATED_IMAGE_MD =
  /!\[[^\]]*\]\(\s*images\/[^)\s]+\s*\)/g;

export const sanitizeAssistantImageMarkdown = (params: {
  text: string;
  artifacts?: AgentSseArtifact[];
}): string => {
  const hasImageArtifact = (params.artifacts ?? []).some(
    (artifact) => artifact.kind === "image"
  );
  if (!hasImageArtifact) return params.text;
  return params.text.replace(RELATIVE_GENERATED_IMAGE_MD, "").trim();
};

/** リスト行の `出力: \`filename\`` を除去（カードウィジェットで別表示するため） */
const OUTPUT_FILENAME_LINE =
  /^\s*[-*]?\s*(?:\*\*)?出力[^`\n]*`[^`]+`\s*\.?\s*$/gim;

/** ワークフロー完了メッセージ用 — 画像 Markdown / 出力ファイル名行を本文から除く */
export const sanitizeImageWorkflowResultMarkdown = (params: {
  text: string;
  artifacts?: AgentSseArtifact[];
}): string => {
  let text = sanitizeAssistantImageMarkdown(params);
  text = text.replace(OUTPUT_FILENAME_LINE, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
};

export const panelPrimaryArtifactsFromMessage = (params: {
  artifacts?: AgentSseArtifact[];
}): Array<{ artifact: AgentSseArtifact; index: number }> => {
  const items: Array<{ artifact: AgentSseArtifact; index: number }> = [];
  (params.artifacts ?? []).forEach((artifact, index) => {
    if (isPanelPrimaryArtifact(artifact)) {
      items.push({ artifact, index });
    }
  });
  return items;
};

/** セッション内の最新画像 artifact を primary 用に解決する */
export const findLatestImagePrimaryInMessages = (params: {
  messages: ReadonlyArray<{
    role: string;
    artifacts?: AgentSseArtifact[];
  }>;
}): ImagePrimaryArtifact | null => {
  for (let i = params.messages.length - 1; i >= 0; i -= 1) {
    const message = params.messages[i];
    if (message?.role !== "assistant" || !message.artifacts?.length) continue;
    for (let j = message.artifacts.length - 1; j >= 0; j -= 1) {
      const artifact = message.artifacts[j]!;
      if (!isPanelPrimaryArtifact(artifact) || artifact.kind !== "image") {
        continue;
      }
      const primary = primaryFromImageArtifact({
        artifactId: artifact.artifactId,
        adkFilename: artifact.adkFilename,
        artifactVersion: artifact.artifactVersion,
      });
      if (imagePrimaryHasReference(primary)) return primary;
    }
  }
  return null;
};

export const primaryFromImageArtifact = (params: {
  artifactId?: string;
  adkFilename?: string;
  artifactVersion?: number;
}): ImagePrimaryArtifact => ({
  artifactId: params.artifactId ?? null,
  adkFilename: params.adkFilename?.trim() ?? null,
  artifactVersion:
    params.artifactVersion != null && Number.isFinite(params.artifactVersion)
      ? params.artifactVersion
      : null,
});
