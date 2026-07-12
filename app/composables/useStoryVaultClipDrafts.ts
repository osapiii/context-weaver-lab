import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from "firebase/firestore";
import { deleteObject, getBlob } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import type {
  StoryVaultOperationVideoDisplaySurface,
  StoryVaultTranscriptCue,
  StoryVaultTranscriptTimingStatus,
} from "@models/storyVault";
import type { StoryVaultSilenceRange } from "@utils/storyVaultClipEditing";
import type { StoryVaultClipSectionDraft } from "@utils/storyVaultClipSectioning";

export type StoryVaultClipDraftStatus =
  | "saving"
  | "editing"
  | "processing"
  | "ready"
  | "error";

export type StoryVaultClipDraftTranscription = {
  text: string;
  provider: string;
  segments: StoryVaultTranscriptCue[];
  srt: string;
  timingStatus: StoryVaultTranscriptTimingStatus;
};

export type StoryVaultClipDraftEditorState = {
  silenceCutEnabled: boolean;
  noiseReductionEnabled: boolean;
  silenceRanges: StoryVaultSilenceRange[];
  keptSilenceRangeIndexes: number[];
  manualCutRanges: StoryVaultSilenceRange[];
  splitPointsMs: number[];
  aiSectionDrafts: StoryVaultClipSectionDraft[];
};

export type StoryVaultClipDraftPreparationState = {
  phase?: "idle" | "trimming" | "transcribing" | "sectioning" | "done" | "error";
  requestId?: string;
  requestPath?: string;
  errorMessage?: string;
  preparedGcsUri?: string;
  preparedDurationMs?: number;
  transcription?: StoryVaultClipDraftTranscription;
};

export type StoryVaultClipDraft = {
  id: string;
  applicationId: string;
  clipGroupId: string;
  title: string;
  status: StoryVaultClipDraftStatus;
  statusMessage?: string;
  source?: {
    bucketName: string;
    storagePath: string;
    gcsUri: string;
    contentType: string;
    sizeBytes: number;
    durationMs: number;
    sourceDisplaySurface: StoryVaultOperationVideoDisplaySurface;
  };
  editorState: StoryVaultClipDraftEditorState;
  preparationState?: StoryVaultClipDraftPreparationState;
  createdAt: string;
  updatedAt: string;
};

type CreateDraftParams = {
  applicationId: string;
  clipGroupId: string;
  blob: Blob;
  durationMs: number;
  sourceDisplaySurface: StoryVaultOperationVideoDisplaySurface;
  title?: string;
};

const emptyEditorState = (): StoryVaultClipDraftEditorState => ({
  silenceCutEnabled: true,
  noiseReductionEnabled: true,
  silenceRanges: [],
  keptSilenceRangeIndexes: [],
  manualCutRanges: [],
  splitPointsMs: [],
  aiSectionDrafts: [],
});

function cleanBucketName(value: string): string {
  return value.replace(/^gs:\/\//, "").replace(/\/$/, "");
}

function parseGcsUri(value: string): { bucketName: string; storagePath: string } | null {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  return { bucketName: match[1], storagePath: match[2] };
}

function serializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultDraftTitle(): string {
  return `録画下書き ${new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())}`;
}

export function useStoryVaultClipDrafts() {
  const drafts = ref<StoryVaultClipDraft[]>([]);
  const isLoadingDrafts = ref(false);
  const draftCollectionPath = () =>
    useContextStore().baseFirestorePath("storyVaultClipDrafts");

  const upsertLocalDraft = (draft: StoryVaultClipDraft): void => {
    drafts.value = [
      draft,
      ...drafts.value.filter((item) => item.id !== draft.id),
    ].sort((a, b) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
    );
  };

  const fetchDrafts = async (applicationId: string): Promise<void> => {
    if (!applicationId) {
      drafts.value = [];
      return;
    }
    isLoadingDrafts.value = true;
    try {
      const snapshot = await getDocs(
        collection(getFirestore(), draftCollectionPath())
      );
      drafts.value = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }) as StoryVaultClipDraft)
        .filter((item) => item.applicationId === applicationId)
        .map((item) => ({
          ...item,
          editorState: { ...emptyEditorState(), ...(item.editorState || {}) },
        }))
        .sort((a, b) =>
          String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
        );
    } finally {
      isLoadingDrafts.value = false;
    }
  };

  const updateDraft = async (
    draftId: string,
    patch: Partial<StoryVaultClipDraft>
  ): Promise<StoryVaultClipDraft> => {
    const current = drafts.value.find((item) => item.id === draftId);
    if (!current) throw new Error("更新する録画下書きが見つかりません");
    const next: StoryVaultClipDraft = {
      ...current,
      ...patch,
      editorState: patch.editorState
        ? { ...current.editorState, ...patch.editorState }
        : current.editorState,
      preparationState: patch.preparationState
        ? { ...current.preparationState, ...patch.preparationState }
        : current.preparationState,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(
      doc(getFirestore(), draftCollectionPath(), draftId),
      serializable(next),
      { merge: true }
    );
    upsertLocalDraft(next);
    return next;
  };

  const createDraft = async (params: CreateDraftParams): Promise<StoryVaultClipDraft> => {
    const firebaseConfig = useRuntimeConfig().public.firebase as
      | { storageBucket?: string }
      | undefined;
    const bucketName = cleanBucketName(String(firebaseConfig?.storageBucket || ""));
    if (!bucketName) throw new Error("録画下書きの保存先が未設定です");

    const id = `storyvault_clip_draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const contentType = params.blob.type || "video/webm";
    const extension = contentType.includes("mp4") ? "mp4" : "webm";
    const storagePath = useContextStore().baseGcsPath(
      `storyVault/applications/${params.applicationId}/clip-drafts/${id}/source.${extension}`
    );
    const draft: StoryVaultClipDraft = {
      id,
      applicationId: params.applicationId,
      clipGroupId: params.clipGroupId,
      title: params.title?.trim() || defaultDraftTitle(),
      status: "saving",
      statusMessage: "録画データを保存しています",
      editorState: emptyEditorState(),
      preparationState: { phase: "idle" },
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(
      doc(getFirestore(), draftCollectionPath(), id),
      serializable(draft)
    );
    upsertLocalDraft(draft);

    const uploaded = await useFirebaseStorageOperations().uploadPdfFile({
      bucketName,
      filePath: storagePath,
      rawData: params.blob,
      mimeType: contentType,
    });
    if (!uploaded) {
      await updateDraft(id, {
        status: "error",
        statusMessage: "録画データの下書き保存に失敗しました",
      });
      throw new Error("録画データの下書き保存に失敗しました");
    }

    return updateDraft(id, {
      status: "editing",
      statusMessage: "編集を再開できます",
      source: {
        bucketName,
        storagePath,
        gcsUri: `gs://${bucketName}/${storagePath}`,
        contentType,
        sizeBytes: params.blob.size,
        durationMs: Math.max(0, Math.round(params.durationMs)),
        sourceDisplaySurface: params.sourceDisplaySurface,
      },
    });
  };

  const loadDraftSource = async (draft: StoryVaultClipDraft): Promise<Blob> => {
    if (!draft.source) throw new Error("録画下書きの動画がまだ保存されていません");
    const blob = await getBlob(
      storageRefForBucketPath({
        bucketName: draft.source.bucketName,
        filePath: draft.source.storagePath,
      })
    );
    return blob.type
      ? blob
      : new Blob([blob], { type: draft.source.contentType || "video/webm" });
  };

  const loadPreparedDraftVideo = async (
    draft: StoryVaultClipDraft
  ): Promise<Blob | null> => {
    const parsed = parseGcsUri(draft.preparationState?.preparedGcsUri || "");
    if (!parsed) return null;
    const blob = await getBlob(
      storageRefForBucketPath({
        bucketName: parsed.bucketName,
        filePath: parsed.storagePath,
      })
    );
    return blob.type ? blob : new Blob([blob], { type: "video/mp4" });
  };

  const discardDraft = async (draft: StoryVaultClipDraft): Promise<void> => {
    const storageTargets = [
      draft.source
        ? {
            bucketName: draft.source.bucketName,
            storagePath: draft.source.storagePath,
          }
        : null,
      parseGcsUri(draft.preparationState?.preparedGcsUri || ""),
    ].filter(
      (item): item is { bucketName: string; storagePath: string } => Boolean(item)
    );
    await Promise.allSettled(
      storageTargets.map((target) =>
        deleteObject(
          storageRefForBucketPath({
            bucketName: target.bucketName,
            filePath: target.storagePath,
          })
        )
      )
    );
    await deleteDoc(doc(getFirestore(), draftCollectionPath(), draft.id));
    drafts.value = drafts.value.filter((item) => item.id !== draft.id);
  };

  return {
    drafts,
    isLoadingDrafts,
    fetchDrafts,
    createDraft,
    updateDraft,
    loadDraftSource,
    loadPreparedDraftVideo,
    discardDraft,
  };
}
