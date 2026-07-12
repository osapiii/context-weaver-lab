import { Timestamp, doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";
import { getBlob } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import type { StoryVaultSilenceRange } from "@utils/storyVaultClipEditing";

type PreparedClip = {
  blob: Blob;
  durationMs: number;
  gcsUri: string;
};

export type StoryVaultClipPreparationLog = {
  message: string;
  type?: string;
  currentStep?: string;
  timestamp?: unknown;
};

export type StoryVaultClipPreparationProgress = {
  requestId: string;
  requestPath: string;
  stage: "uploading" | "queued" | "processing" | "completed" | "downloading" | "ready";
  status: string;
  logs: StoryVaultClipPreparationLog[];
};

type RequestDocSnapshot = {
  status?: string;
  output?: Record<string, unknown>;
  input?: { outputBucketName?: string };
  errorMessage?: string;
  logs?: StoryVaultClipPreparationLog[];
};

type SegmentOutput = {
  resultBucketName?: string;
  resultFilePath?: string;
  durationSeconds?: number;
};

function cleanBucketName(value: string): string {
  return value.replace(/^gs:\/\//, "").replace(/\/$/, "");
}

function parseGcsUri(value: string): { bucketName: string; filePath: string } | null {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  return { bucketName: cleanBucketName(match[1]), filePath: match[2] };
}

function waitForPreparationRequest(
  path: string,
  onUpdate?: (snapshot: RequestDocSnapshot) => void,
  timeoutMs = 1000 * 60 * 20
): Promise<RequestDocSnapshot> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("動画調整がタイムアウトしました"));
    }, timeoutMs);
    const unsubscribe = onSnapshot(
      doc(getFirestore(), path),
      (snapshot) => {
        const data = snapshot.data() as RequestDocSnapshot | undefined;
        if (data) onUpdate?.(data);
        if (data?.status === "completed") {
          window.clearTimeout(timeout);
          unsubscribe();
          resolve(data);
        } else if (data?.status === "error") {
          window.clearTimeout(timeout);
          unsubscribe();
          reject(new Error(data.errorMessage || "動画調整に失敗しました"));
        }
      },
      (error) => {
        window.clearTimeout(timeout);
        unsubscribe();
        reject(error);
      }
    );
  });
}

async function preparedClipsFromRequest(
  request: RequestDocSnapshot,
  fallbackBucketName: string
): Promise<PreparedClip[]> {
  const output = request.output ?? {};
  const segments = Array.isArray(output.segments)
    ? output.segments.filter(
        (item): item is SegmentOutput => Boolean(item && typeof item === "object")
      )
    : [];
  if (segments.length === 0) throw new Error("調整済みクリップが生成されませんでした");

  return Promise.all(
    segments.map(async (segment) => {
      const segmentBucket = cleanBucketName(
        segment.resultBucketName ||
          request.input?.outputBucketName ||
          fallbackBucketName
      );
      const segmentPath = segment.resultFilePath;
      if (!segmentBucket || !segmentPath) {
        throw new Error("調整済みクリップの保存先が見つかりません");
      }
      const blob = await getBlob(
        storageRefForBucketPath({
          bucketName: segmentBucket,
          filePath: segmentPath,
        })
      );
      return {
        blob: blob.type ? blob : new Blob([blob], { type: "video/mp4" }),
        durationMs: Math.max(0, Number(segment.durationSeconds || 0) * 1000),
        gcsUri: `gs://${segmentBucket}/${segmentPath}`,
      };
    })
  );
}

export function useStoryVaultClipPreparation() {
  const prepare = async (params: {
    applicationId: string;
    blob: Blob;
    durationMs: number;
    silenceCutEnabled: boolean;
    noiseReductionEnabled?: boolean;
    silenceRanges: StoryVaultSilenceRange[];
    splitPointsMs: number[];
    sourceGcsUri?: string;
    onProgress?: (
      progress: StoryVaultClipPreparationProgress
    ) => void | Promise<void>;
  }): Promise<PreparedClip[]> => {
    const organizationId = useOrganizationStore().getLoggedInOrganizationId;
    const spaceId = useSpaceStore().selectedSpace?.id ?? "";
    if (!organizationId || !spaceId) throw new Error("組織・スペースを確認してください");

    const firebaseConfig = useRuntimeConfig().public.firebase as
      | { storageBucket?: string }
      | undefined;
    const bucketName = cleanBucketName(String(firebaseConfig?.storageBucket || ""));
    if (!bucketName) throw new Error("動画保存先のバケットが未設定です");

    const requestId = `storyvault_clip_prepare_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const basePath = useContextStore().baseGcsPath(
      `storyVault/applications/${params.applicationId}/clip-preparation/${requestId}`
    );
    const existingSource = parseGcsUri(params.sourceGcsUri || "");
    const extension = params.blob.type.includes("mp4") ? "mp4" : "webm";
    const sourceBucketName = existingSource?.bucketName || bucketName;
    const sourcePath = existingSource?.filePath || `${basePath}/source.${extension}`;
    const outputPath = `${basePath}/trimmed.mp4`;
    const manifestPath = `${basePath}/manifest.json`;
    const splitPointsSeconds = [...params.splitPointsMs]
      .sort((a, b) => a - b)
      .map((point) => point / 1000);
    const segmentOutputFilePaths = splitPointsSeconds.map(
      (_, index) => `${basePath}/segment-${String(index + 1).padStart(3, "0")}.mp4`
    );
    segmentOutputFilePaths.push(
      `${basePath}/segment-${String(segmentOutputFilePaths.length + 1).padStart(3, "0")}.mp4`
    );
    const collectionPath = `organizations/${organizationId}/spaces/${spaceId}/requests/trimSilenceVideoRequests/logs`;
    const requestPath = `${collectionPath}/${requestId}`;
    if (!existingSource) {
      await params.onProgress?.({
        requestId,
        requestPath,
        stage: "uploading",
        status: "uploading",
        logs: [],
      });
      const uploaded = await useFirebaseStorageOperations().uploadPdfFile({
        bucketName,
        filePath: sourcePath,
        rawData: params.blob,
        mimeType: params.blob.type || "video/webm",
      });
      if (!uploaded) throw new Error("調整用の録画アップロードに失敗しました");
    }

    await setDoc(doc(getFirestore(), requestPath), {
      id: requestId,
      status: "pending",
      input: {
        videoBucketName: sourceBucketName,
        videoFilePath: sourcePath,
        outputBucketName: bucketName,
        outputFilePath: outputPath,
        manifestOutputFilePath: manifestPath,
        splitPointsSeconds,
        segmentOutputFilePaths,
        settings: {
          enabled: params.silenceCutEnabled,
          noiseReductionEnabled: params.noiseReductionEnabled !== false,
          noiseReductionStrengthDb: 12,
          noiseFloorDb: -40,
          thresholdDb: -38,
          minSilenceMs: 5000,
          keepPaddingMs: 180,
          minSegmentMs: 450,
          mergeGapMs: 10_000,
          cutRangesSeconds: params.silenceRanges.map((range) => ({
            start: range.startMs / 1000,
            end: range.endMs / 1000,
          })),
        },
      },
      output: {},
      logs: [],
      systemMetadata: {
        organizationId,
        spaceId,
        loggingCollectionId: collectionPath,
        loggingDocumentId: requestId,
        requestedBy: { email: "", role: "admin" },
        isCommand: false,
        isOouiCrud: true,
        isLlmCall: false,
        isAdminCrud: false,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await params.onProgress?.({
      requestId,
      requestPath,
      stage: "queued",
      status: "pending",
      logs: [],
    });

    const request = await waitForPreparationRequest(requestPath, (snapshot) => {
      const status = String(snapshot.status || "pending");
      params.onProgress?.({
        requestId,
        requestPath,
        stage: status === "completed" ? "completed" : "processing",
        status,
        logs: Array.isArray(snapshot.logs) ? snapshot.logs : [],
      });
    });
    await params.onProgress?.({
      requestId,
      requestPath,
      stage: "downloading",
      status: "completed",
      logs: Array.isArray(request.logs) ? request.logs : [],
    });
    const preparedClips = await preparedClipsFromRequest(request, bucketName);
    await params.onProgress?.({
      requestId,
      requestPath,
      stage: "ready",
      status: "completed",
      logs: Array.isArray(request.logs) ? request.logs : [],
    });
    return preparedClips;
  };

  const resume = async (params: {
    requestPath: string;
    onProgress?: (
      progress: StoryVaultClipPreparationProgress
    ) => void | Promise<void>;
  }): Promise<PreparedClip[]> => {
    const requestId = params.requestPath.split("/").at(-1) || "unknown";
    const firebaseConfig = useRuntimeConfig().public.firebase as
      | { storageBucket?: string }
      | undefined;
    const bucketName = cleanBucketName(String(firebaseConfig?.storageBucket || ""));
    const request = await waitForPreparationRequest(params.requestPath, (snapshot) => {
      const status = String(snapshot.status || "pending");
      params.onProgress?.({
        requestId,
        requestPath: params.requestPath,
        stage: status === "completed" ? "completed" : "processing",
        status,
        logs: Array.isArray(snapshot.logs) ? snapshot.logs : [],
      });
    });
    await params.onProgress?.({
      requestId,
      requestPath: params.requestPath,
      stage: "downloading",
      status: "completed",
      logs: Array.isArray(request.logs) ? request.logs : [],
    });
    const preparedClips = await preparedClipsFromRequest(request, bucketName);
    await params.onProgress?.({
      requestId,
      requestPath: params.requestPath,
      stage: "ready",
      status: "completed",
      logs: Array.isArray(request.logs) ? request.logs : [],
    });
    return preparedClips;
  };

  return { prepare, resume };
}
