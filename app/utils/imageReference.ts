/** 画像生成用リファレンス（ADK image バケットと同期） */

import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import type { ImageStudioFields } from "@utils/imageStudioState";
import { imagePrimaryHasReference } from "@utils/imageStudioState";
import {
  buildWorkspaceSessionState,
  readImageTaskBucketFromSession,
} from "@utils/workspaceSessionBuckets";

/** 0から新規 / お手本画像を元に編集 */
export type ImageCreationMode = "scratch" | "reference";

export const IMAGE_CREATION_MODE_OPTIONS: ReadonlyArray<{
  value: ImageCreationMode;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: "scratch",
    label: "0から新規に作成",
    description: "プロンプトだけで新しい画像を生成します",
    icon: "flat-color-icons:picture",
  },
  {
    value: "reference",
    label: "お手本画像を元に作成",
    description: "ビラ・ポスター等のレイアウトを保ったまま差し替えます",
    icon: "flat-color-icons:gallery",
  },
] as const;

export type ImageReferenceSource = "knowledge" | "clipboard" | "upload";

export type ImageReferenceStatus = "incomplete" | "draft" | "complete";

export interface ImageReference {
  id: string;
  source: ImageReferenceSource;
  name: string;
  mimeType: string;
  gcsPath?: string;
  storageUrl?: string;
  knowledgeDocId?: string;
}

export interface ImageReferenceState {
  status: ImageReferenceStatus;
  references: ImageReference[];
  minCount: number;
  confirmedAt: string | null;
}

export const MAX_IMAGE_REFERENCES = 3;

export const emptyImageReferenceState = (): ImageReferenceState => ({
  status: "incomplete",
  references: [],
  minCount: 1,
  confirmedAt: null,
});

/** Pinia / Firestore 由来で欠落し得る参照状態を正規化 */
export const coalesceImageReferenceState = (
  raw: ImageReferenceState | null | undefined
): ImageReferenceState =>
  raw ? normalizeImageReferenceState(raw) : emptyImageReferenceState();

/** ローカル編集中の画像モードが Firestore エコーで消えないよう hydrate 時に保持 */
export const shouldPreserveLocalImageFieldsOnHydrate = (params: {
  local: {
    imageModeSelected: boolean;
    imageCreationMode: ImageCreationMode | null;
    imageReferenceState: ImageReferenceState;
  };
  fromRecord: {
    imageModeSelected: boolean;
    imageCreationMode: ImageCreationMode | null;
    imageReferenceState: ImageReferenceState;
  };
}): boolean => {
  if (params.local.imageModeSelected && !params.fromRecord.imageModeSelected) {
    return true;
  }
  if (
    params.local.imageCreationMode &&
    !params.fromRecord.imageCreationMode
  ) {
    return true;
  }
  const localRefs = params.local.imageReferenceState.references.length;
  const recordRefs = params.fromRecord.imageReferenceState.references.length;
  if (localRefs > recordRefs) return true;
  if (
    params.local.imageReferenceState.status === "complete" &&
    params.fromRecord.imageReferenceState.status !== "complete" &&
    localRefs > 0
  ) {
    return true;
  }
  return false;
};

const isImageMime = (mime: string): boolean =>
  (mime || "").trim().toLowerCase().startsWith("image/");

export const normalizeImageReferenceState = (
  raw: unknown
): ImageReferenceState => {
  if (!raw || typeof raw !== "object") return emptyImageReferenceState();
  const obj = raw as Record<string, unknown>;
  let status = (obj.status as ImageReferenceStatus) || "incomplete";
  if (!["incomplete", "draft", "complete"].includes(status)) {
    status = "incomplete";
  }

  const references: ImageReference[] = [];
  const rawRefs = obj.references;
  if (Array.isArray(rawRefs)) {
    for (const item of rawRefs.slice(0, MAX_IMAGE_REFERENCES)) {
      const ref = normalizeImageReference(item);
      if (ref) references.push(ref);
    }
  }

  let confirmedAt =
    typeof obj.confirmed_at === "string"
      ? obj.confirmed_at
      : typeof obj.confirmedAt === "string"
        ? obj.confirmedAt
        : null;

  if (references.length === 0) {
    status = "incomplete";
    confirmedAt = null;
  } else if (status === "incomplete") {
    status = "draft";
  } else if (status === "complete" && references.length < 1) {
    status = "incomplete";
    confirmedAt = null;
  }

  return {
    status,
    references,
    minCount: 1,
    confirmedAt,
  };
};

export const normalizeImageReference = (raw: unknown): ImageReference | null => {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const source = String(obj.source || "").trim().toLowerCase();
  if (!["knowledge", "clipboard", "upload"].includes(source)) return null;

  const mimeType = String(
    obj.mime_type ?? obj.mimeType ?? "image/png"
  ).trim();
  if (!isImageMime(mimeType)) return null;

  const gcsPath = String(obj.gcs_path ?? obj.gcsPath ?? "").trim();
  const storageUrl = String(
    obj.url ?? obj.storage_url ?? obj.storageUrl ?? ""
  ).trim();
  if (!gcsPath && !storageUrl) return null;

  const name = String(obj.name || "reference").trim() || "reference";
  const id = String(obj.id || `${source}-${name}-${Date.now()}`);

  return {
    id,
    source: source as ImageReferenceSource,
    name,
    mimeType,
    ...(gcsPath ? { gcsPath } : {}),
    ...(storageUrl ? { storageUrl } : {}),
    ...(obj.knowledge_doc_id || obj.knowledgeDocId
      ? {
          knowledgeDocId: String(
            obj.knowledge_doc_id ?? obj.knowledgeDocId
          ),
        }
      : {}),
  };
};

export const imageReferenceToApi = (ref: ImageReference) => {
  const payload: Record<string, string | null> = {
    id: ref.id,
    source: ref.source,
    name: ref.name,
    mime_type: ref.mimeType,
  };
  const gcsPath = ref.gcsPath?.trim();
  const url = ref.storageUrl?.trim();
  if (gcsPath) payload.gcs_path = gcsPath;
  if (url) payload.url = url;
  if (ref.knowledgeDocId) payload.knowledge_doc_id = ref.knowledgeDocId;
  return payload;
};

export const resolveImageModeSelectedFromSessionState = (params: {
  state: Record<string, unknown>;
}): boolean => {
  const stateImage = params.state.image;
  if (stateImage && typeof stateImage === "object" && !Array.isArray(stateImage)) {
    const setup = (stateImage as Record<string, unknown>).setup;
    if (setup && typeof setup === "object" && !Array.isArray(setup)) {
      return (setup as Record<string, unknown>).confirmed === true;
    }
  }
  return readImageTaskBucketFromSession({ state: params.state })
    .image_mode_selected === true;
};

/** ADK invoke 用 referenceImages（gcs または url 必須） */
export const referenceImagesForAdkInvoke = (
  state: ImageReferenceState
): ReturnType<typeof imageReferenceToApi>[] => {
  if (state.status !== "complete" || state.references.length === 0) {
    return [];
  }
  return state.references
    .filter((ref) => Boolean(ref.gcsPath?.trim() || ref.storageUrl?.trim()))
    .map(imageReferenceToApi);
};

export const referenceImagesHaveResolvableStorage = (
  state: ImageReferenceState
): boolean =>
  state.references.every(
    (ref) => Boolean(ref.gcsPath?.trim() || ref.storageUrl?.trim())
  );

export const imageReferenceStateToModeState = (state: ImageReferenceState) => ({
  image_reference: {
    status: state.status,
    references: state.references.map(imageReferenceToApi),
    min_count: state.minCount,
    confirmed_at: state.confirmedAt,
  },
});

/** 履歴復元時 — 画像ワークフローが一度でも進んでいるか */
export const sessionHasImageWorkflowProgress = (params: {
  messages: ReadonlyArray<{
    role: string;
    text?: string;
    artifacts?: AgentSseArtifact[];
  }>;
  imageStudio?: ImageStudioFields | null;
  imageCreationMode?: ImageCreationMode | null;
  imageReferenceState?: ImageReferenceState | null;
}): boolean => {
  if (
    params.messages.some(
      (message) => message.role === "user" && message.text?.trim()
    )
  ) {
    return true;
  }
  if (
    params.messages.some((message) =>
      (message.artifacts ?? []).some((artifact) => artifact.kind === "image")
    )
  ) {
    return true;
  }
  const primary = params.imageStudio?.primaryArtifact;
  if (primary && imagePrimaryHasReference(primary)) {
    return true;
  }
  if (
    params.imageCreationMode === "scratch" ||
    params.imageCreationMode === "reference"
  ) {
    return true;
  }
  const refs = params.imageReferenceState?.references ?? [];
  return refs.length > 0;
};

export const inferImageCreationModeFromSessionRecord = (params: {
  imageCreationMode?: ImageCreationMode | null;
  imageReferenceState?: ImageReferenceState | null;
}): ImageCreationMode => {
  if (
    params.imageCreationMode === "scratch" ||
    params.imageCreationMode === "reference"
  ) {
    return params.imageCreationMode;
  }
  const inferred = inferImageCreationMode({
    stored: null,
    referenceState: coalesceImageReferenceState(params.imageReferenceState),
  });
  return inferred ?? "scratch";
};

/**
 * Firestore 復元後 — imageModeSelected 欠落の旧セッションをキオスク UI 向けに補正.
 */
export const reconcileImageSessionUiFromRecord = (params: {
  activeAgent?: string | null;
  jobKind?: string | null;
  messages: ReadonlyArray<{
    role: string;
    text?: string;
    artifacts?: AgentSseArtifact[];
  }>;
  imageCreationMode?: ImageCreationMode | null;
  imageReferenceState?: ImageReferenceState | null;
  imageStudio?: ImageStudioFields | null;
  imageModeSelected: boolean;
}): {
  imageModeSelected: boolean;
  imageCreationMode: ImageCreationMode | null;
  imageReferenceState: ImageReferenceState;
} => {
  const isImage =
    params.activeAgent === "image" || params.jobKind === "image";
  const recordRef = coalesceImageReferenceState(params.imageReferenceState);
  let imageModeSelected = params.imageModeSelected;
  let imageCreationMode = params.imageCreationMode ?? null;
  let imageReferenceState = recordRef;

  if (!isImage) {
    return { imageModeSelected, imageCreationMode, imageReferenceState };
  }

  const hasProgress = sessionHasImageWorkflowProgress({
    messages: params.messages,
    imageStudio: params.imageStudio,
    imageCreationMode,
    imageReferenceState: recordRef,
  });
  if (!hasProgress) {
    return {
      imageModeSelected,
      imageCreationMode: imageModeSelected ? imageCreationMode : null,
      imageReferenceState: imageModeSelected ? recordRef : emptyImageReferenceState(),
    };
  }

  if (!imageModeSelected) {
    imageModeSelected = true;
    imageCreationMode = inferImageCreationModeFromSessionRecord({
      imageCreationMode,
      imageReferenceState: recordRef,
    });
    if (recordRef.references.length > 0) {
      imageReferenceState = recordRef;
    }
  }

  return { imageModeSelected, imageCreationMode, imageReferenceState };
};

export const inferImageCreationMode = (params: {
  stored: ImageCreationMode | null | undefined;
  referenceState: ImageReferenceState;
}): ImageCreationMode | null => {
  if (params.stored === "scratch" || params.stored === "reference") {
    return params.stored;
  }
  if (
    params.referenceState.status === "complete" &&
    params.referenceState.references.length > 0
  ) {
    return "reference";
  }
  return null;
};

/** 画像モード invoke 用 mode_state 断片 */
export const imageModeStateToApi = (params: {
  creationMode: ImageCreationMode | null;
  referenceState: ImageReferenceState;
  imageModeSelected?: boolean;
}): Record<string, unknown> => {
  if (!params.imageModeSelected) {
    return {
      image_mode_selected: false,
      image_creation_mode: null,
      image_reference: {
        status: "incomplete",
        references: [],
        min_count: 0,
        confirmed_at: null,
      },
    };
  }
  if (params.creationMode !== "scratch" && params.creationMode !== "reference") {
    return { image_mode_selected: false };
  }
  const creationMode = params.creationMode;
  return {
    image_mode_selected: true,
    image_creation_mode: creationMode,
    ...(creationMode === "reference"
      ? imageReferenceStateToModeState(params.referenceState)
      : {
          image_reference: {
            status: "incomplete",
            references: [],
            min_count: 0,
            confirmed_at: null,
          },
        }),
  };
};

export const imageCreationModeLabel = (
  mode: ImageCreationMode | null | undefined
): string => {
  if (!mode) return "";
  return (
    IMAGE_CREATION_MODE_OPTIONS.find((option) => option.value === mode)
      ?.label ?? mode
  );
};

/** Firestore adkSessions.state — ADK Runner / image tools と同じキー */
export const resolveImageCreationModeFromSessionState = (params: {
  state: Record<string, unknown>;
  referenceState: ImageReferenceState;
}): ImageCreationMode | null => {
  const image = params.state.image;
  if (image && typeof image === "object" && !Array.isArray(image)) {
    const setup = (image as Record<string, unknown>).setup;
    if (setup && typeof setup === "object" && !Array.isArray(setup)) {
      const creation = (setup as Record<string, unknown>).creation;
      if (creation === "scratch" || creation === "reference") {
        return creation;
      }
    }
  }
  const stored = readImageTaskBucketFromSession({ state: params.state })
    .image_creation_mode;
  if (stored === "scratch" || stored === "reference") {
    return stored;
  }
  return inferImageCreationMode({
    stored: null,
    referenceState: params.referenceState,
  });
};

export const resolveRecordImageCreationMode = (params: {
  state: Record<string, unknown>;
  referenceState: ImageReferenceState;
}): ImageCreationMode | null => {
  if (!resolveImageModeSelectedFromSessionState({ state: params.state })) {
    return null;
  }
  return resolveImageCreationModeFromSessionState(params);
};

export const buildFirestoreSessionState = (params: {
  enAiStudioUi: Record<string, unknown>;
  jobKind?: string | null;
  activeAgent?: string | null;
  imageCreationMode?: ImageCreationMode | null;
  imageReferenceState?: ImageReferenceState;
  imageModeSelected?: boolean;
}): Record<string, unknown> => {
  const isImage =
    params.jobKind === "image" ||
    params.activeAgent === "image" ||
    params.imageCreationMode != null;
  if (!isImage) {
    return buildWorkspaceSessionState({ enAiStudioUi: params.enAiStudioUi });
  }
  const creationMode =
    params.imageCreationMode === "scratch" ||
    params.imageCreationMode === "reference"
      ? params.imageCreationMode
      : null;
  const imageModeSelected = params.imageModeSelected === true;
  return buildWorkspaceSessionState({
    enAiStudioUi: params.enAiStudioUi,
    activeMode: "image",
    image: {
      imageModeSelected,
      imageCreationMode: imageModeSelected ? creationMode : null,
      imageReferenceState:
        params.imageReferenceState ?? emptyImageReferenceState(),
    },
  });
};

export const recomputeImageReferenceStatus = (
  references: ImageReference[],
  requestedStatus?: ImageReferenceStatus
): ImageReferenceState => {
  if (references.length === 0) {
    return emptyImageReferenceState();
  }
  if (requestedStatus === "complete") {
    return {
      status: "complete",
      references,
      minCount: 1,
      confirmedAt: new Date().toISOString(),
    };
  }
  return {
    status: "draft",
    references,
    minCount: 1,
    confirmedAt: null,
  };
};

export const imageReferenceStatusLabel = (
  status: ImageReferenceStatus
): string => {
  switch (status) {
    case "incomplete":
      return "未添付";
    case "draft":
      return "下書き";
    case "complete":
      return "確定済み";
    default:
      return status;
  }
};
