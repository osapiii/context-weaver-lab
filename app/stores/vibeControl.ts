import { defineStore } from "pinia";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject } from "firebase/storage";
import log from "@utils/logger";
import createRandomDocId from "@utils/createRandomDocId";
import { useFirestoreDocOperation } from "@composables/firestore-doc-operation";
import {
  createAdkInvokeRequest,
  watchAdkInvokeRequest,
} from "@composables/useAdkInvokeRequest";
import { useContextStore } from "./context";
import { useOrganizationStore } from "./organization";
import { useSpaceStore } from "./space";
import {
  storageRefForBucketPath,
  useFirebaseStorageOperations,
} from "@composables/firebase-storage-operations";
import { buildAdkInvokeInput } from "@utils/adkInvokeInputBuilder";
import {
  buildApplicationScanInitialPrompt,
  type ApplicationScanFields,
} from "@utils/applicationScanWorkspaceState";
import { resolveStorageBucketName } from "@utils/adkAttachments";
import { manualUploadRelativePath } from "@utils/knowledgeStoragePaths";
import {
  buildOperationVideoJourneyMarkdown,
  buildOperationVideoMetadataMarkdown,
} from "@utils/vibeControlEvidenceDocuments";
import {
  buildInvokeModeStateFromWorkspaceState,
  buildWorkspaceSessionState,
} from "@utils/workspaceSessionBuckets";
import { useGeminiFileSpaceOperatorStore } from "./geminiFileSpaceOperator";
import { defaultLlmModelSelectionForAdkMode } from "@models/llmModelSelection";
import type { AdkInvokeOutput } from "@models/adkInvokeRequest";
import type { RequestStatus } from "@models/core/requestStatus";
import type { DecodedFileSpaceOperationRequest } from "@models/geminiFileSpaceRequest";
import type {
  VibeControlApplicationFileSpaceProvisioningStatus,
  DecodedVibeControlApplication,
  DecodedVibeControlApplicationScanProfile,
  DecodedVibeControlCapability,
  DecodedVibeControlDraftPatch,
  DecodedVibeControlGenerationSession,
  DecodedVibeControlOperationVideo,
  DecodedVibeControlOperationVideoGroup,
  DecodedVibeControlSourceConnection,
  DecodedVibeControlSourceAsset,
  DecodedVibeControlStory,
  DecodedVibeControlStoryEvidence,
  VibeControlApplicationScanRun,
  VibeControlDriftLevel,
  VibeControlOperationVideoClip,
  VibeControlOperationVideoDisplaySurface,
  VibeControlOperationVideoQuickScan,
  VibeControlTranscriptCue,
  VibeControlTranscriptTimingStatus,
  VibeControlReviewState,
  VibeControlScanAuthMode,
  VibeControlRelatedContextResult,
  VibeControlStoryStatus,
  VibeControlZappingAnalysisResult,
} from "@models/vibeControl";
import {
  vibeControlApplicationScanProfileConverter,
  vibeControlApplicationConverter,
  vibeControlCapabilityConverter,
  vibeControlDraftPatchConverter,
  vibeControlGenerationSessionConverter,
  vibeControlOperationVideoConverter,
  vibeControlOperationVideoGroupConverter,
  vibeControlSourceAssetConverter,
  vibeControlSourceConnectionConverter,
  vibeControlStoryConverter,
  vibeControlStoryEvidenceConverter,
  VibeControlRelatedContextResultSchema,
  VibeControlZappingAnalysisResultSchema,
} from "@models/vibeControl";
import { reportDatadogError } from "@utils/datadogObservability";
import {
  formatUserStoryKey,
  nextUserStorySequenceForApplication,
} from "@utils/vibeControlStoryKeys";

export type VibeControlFilters = {
  query: string;
  status: VibeControlStoryStatus | "all";
  domain: string;
  milestone: string;
  drift: VibeControlDriftLevel | "all";
  reviewState: VibeControlReviewState | "all";
  minConfidence: number;
};

export type VibeControlGenerationInput = {
  applicationId?: string;
  applicationKey: string;
  applicationName: string;
  fileSpaceId: string;
  repoFullName: string;
  defaultBranch: string;
  capabilityId?: string;
  prompt?: string;
};

export type VibeControlApplicationInput = {
  id?: string;
  applicationKey: string;
  name: string;
  summary?: string;
  domain?: string;
  owner?: string;
  labels?: string[];
  startUrl?: string;
  fileSpaceId?: string;
  repoFullName: string;
  defaultBranch?: string;
};

export type VibeControlApplicationScanProfileInput = {
  id?: string;
  applicationId: string;
  name: string;
  authMode?: VibeControlScanAuthMode;
  entryUrl: string;
  loginUrl?: string;
  username?: string;
  password?: string;
  assistedStorageStateJson?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  defaultExploreVariants?: boolean;
  maxPages?: number;
  maxVariantsPerScreen?: number;
  maxStepsPerScreen?: number;
};

export type VibeControlScreenVariantExplorationInput = {
  applicationId: string;
  screenId: string;
  screenUrl: string;
  routeKey?: string;
  scanProfileId?: string;
};

export type VibeControlOperationVideoSaveInput = {
  applicationId: string;
  groupId: string;
  title: string;
  description?: string;
  tags?: string[];
  transcriptText?: string;
  transcriptProvider?: string;
  transcriptSummary?: string;
  transcriptSegments?: VibeControlTranscriptCue[];
  transcriptSrt?: string;
  transcriptTimingStatus?: VibeControlTranscriptTimingStatus;
  quickScan?: VibeControlOperationVideoQuickScan;
  frameCaptures?: Array<{
    timestampMs: number;
    blob: Blob;
    contentType?: string;
    width?: number;
    height?: number;
  }>;
  blob: Blob;
  durationMs?: number;
  contentType?: string;
  sourceDisplaySurface?: VibeControlOperationVideoDisplaySurface;
};

export type VibeControlOperationVideoAppendInput =
  VibeControlOperationVideoSaveInput & {
    videoId: string;
  };

export type VibeControlOperationVideoClipAnalysisInput = {
  videoId: string;
  clipId?: string;
  title?: string;
  description?: string;
  transcriptText: string;
  transcriptProvider?: string;
  transcriptSummary?: string;
  transcriptSegments: VibeControlTranscriptCue[];
  transcriptSrt: string;
  transcriptTimingStatus: VibeControlTranscriptTimingStatus;
  quickScan?: VibeControlOperationVideoQuickScan;
  frameCaptures: Array<{
    timestampMs: number;
    blob: Blob;
    contentType?: string;
    width?: number;
    height?: number;
  }>;
};

export type VibeControlZappingVideoAnalysisInput = {
  applicationId: string;
  videoId: string;
  prompt?: string;
};

export type VibeControlRelatedContextAnalysisInput = {
  applicationId: string;
  videoId: string;
  provider: "github" | "slack" | "knowledge";
  prompt?: string;
};

export type VibeControlOperationVideoGroupInput = {
  id?: string;
  applicationId: string;
  name: string;
  description?: string;
};

export type VibeControlSeparatedAdkMode =
  | "vibe_capability_structuring"
  | "vibe_story_generation";

export type VibeControlGenerationAgentInput = {
  applicationId: string;
  capabilityId?: string;
  prompt?: string;
};

const nowIso = () => new Date().toISOString();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toDocId = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

const primaryOperationVideoClip = (
  video: DecodedVibeControlOperationVideo
): VibeControlOperationVideoClip => {
  const clips = Array.isArray(video.clips) ? video.clips : [];
  const sortedClips = [...clips].sort((a, b) =>
    (a.recordedAt || "").localeCompare(b.recordedAt || "")
  );
  const firstClip = sortedClips[0];
  if (firstClip) return firstClip;
  return {
    id: "clip-001",
    fileName: video.fileName,
    bucketName: video.bucketName,
    storagePath: video.storagePath,
    contentType: video.contentType || "video/webm",
    sizeBytes: video.sizeBytes || 0,
    durationMs: video.durationMs,
    transcriptText: video.transcriptText,
    transcriptProvider: video.transcriptProvider,
    transcriptSummary: video.transcriptSummary,
    transcriptSegments: video.transcriptSegments ?? [],
    transcriptSrt: video.transcriptSrt,
    transcriptTimingStatus: video.transcriptTimingStatus ?? "unavailable",
    quickScan: video.quickScan,
    frameCaptures: video.frameCaptures ?? [],
    metadataFileName: video.metadataFileName,
    metadataStoragePath: video.metadataStoragePath,
    journeyFileName: video.journeyFileName,
    journeyStoragePath: video.journeyStoragePath,
    fileSpaceRequestId: video.fileSpaceRequestId,
    journeyFileSpaceRequestId: video.journeyFileSpaceRequestId,
    sourceAssetId: video.sourceAssetId,
    journeySourceAssetId: video.journeySourceAssetId,
    sourceDisplaySurface: video.sourceDisplaySurface ?? "unknown",
    recordedAt: video.recordedAt,
  };
};

const normalizedOperationVideoClips = (
  video: DecodedVibeControlOperationVideo
): VibeControlOperationVideoClip[] => {
  const clips = Array.isArray(video.clips) ? video.clips : [];
  const normalized = clips.length > 0 ? clips : [primaryOperationVideoClip(video)];
  return [...normalized].sort((a, b) =>
    (a.recordedAt || "").localeCompare(b.recordedAt || "")
  );
};

const normalizeOperationVideo = (
  video: DecodedVibeControlOperationVideo
): DecodedVibeControlOperationVideo => {
  const clips = normalizedOperationVideoClips(video);
  const primary = clips[0] ?? primaryOperationVideoClip(video);
  const totalDurationMs = clips.reduce(
    (sum, clip) => sum + Math.max(0, clip.durationMs ?? 0),
    0
  );
  return {
    ...video,
    fileName: primary.fileName,
    bucketName: primary.bucketName,
    storagePath: primary.storagePath,
    contentType: primary.contentType,
    sizeBytes: primary.sizeBytes,
    durationMs: primary.durationMs,
    transcriptText: primary.transcriptText,
    transcriptProvider: primary.transcriptProvider,
    transcriptSummary: primary.transcriptSummary,
    transcriptSegments: primary.transcriptSegments ?? [],
    transcriptSrt: primary.transcriptSrt,
    transcriptTimingStatus: primary.transcriptTimingStatus ?? "unavailable",
    quickScan: primary.quickScan,
    frameCaptures: primary.frameCaptures ?? [],
    fileSpaceRequestId: primary.fileSpaceRequestId ?? video.fileSpaceRequestId,
    metadataFileName: primary.metadataFileName ?? video.metadataFileName,
    metadataStoragePath: primary.metadataStoragePath ?? video.metadataStoragePath,
    journeyFileName: primary.journeyFileName ?? video.journeyFileName,
    journeyStoragePath: primary.journeyStoragePath ?? video.journeyStoragePath,
    journeyFileSpaceRequestId:
      primary.journeyFileSpaceRequestId ?? video.journeyFileSpaceRequestId,
    sourceAssetId: primary.sourceAssetId ?? video.sourceAssetId,
    journeySourceAssetId:
      primary.journeySourceAssetId ?? video.journeySourceAssetId,
    sourceDisplaySurface: primary.sourceDisplaySurface ?? video.sourceDisplaySurface,
    recordedAt: primary.recordedAt || video.recordedAt,
    clips,
    clipCount: clips.length,
    totalDurationMs: totalDurationMs || primary.durationMs,
    lastClipAddedAt:
      video.lastClipAddedAt || clips.at(-1)?.recordedAt || video.recordedAt,
  };
};

const operationVideoSourceAssetIds = (
  video: DecodedVibeControlOperationVideo
): string[] => {
  const ids = [
    video.sourceAssetId,
    video.journeySourceAssetId,
    `source-asset-${video.id}`,
    `source-asset-${video.id}-journey`,
    ...normalizedOperationVideoClips(video).flatMap((clip) => [
      clip.sourceAssetId,
      clip.journeySourceAssetId,
    ]),
  ];
  return ids.filter(
    (id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index
  );
};

const scanProfilePasswordSecretId = (profileId: string): string =>
  `vibeControlScanProfilePassword-${profileId}`;

const scanProfileAssistedSessionSecretId = (profileId: string): string =>
  `vibeControlScanProfileAssistedSession-${profileId}`;

const extractFileSpaceIdFromCreateRequest = (
  request: DecodedFileSpaceOperationRequest
): string => {
  const output = request.output;
  if (!output || typeof output !== "object" || !("name" in output)) {
    return "";
  }
  const name = output.name;
  if (typeof name !== "string" || !name.trim()) return "";
  return name.split("/").filter(Boolean).at(-1) ?? "";
};

const extractZappingAnalysisResultCandidate = (
  value: unknown
): VibeControlZappingAnalysisResult | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const direct = VibeControlZappingAnalysisResultSchema.safeParse(
    normalizeAdkResultValue(value)
  );
  if (direct.success) return direct.data;

  const resultShape = {
    schemaVersion: record.schemaVersion,
    generatedAt: record.generatedAt,
    transcriptSummary: record.transcriptSummary,
    productContextSummary: record.productContextSummary,
    operationIntent: record.operationIntent,
    storyCandidates: record.storyCandidates,
    notes: record.notes,
  };
  const shaped = VibeControlZappingAnalysisResultSchema.safeParse(
    normalizeAdkResultValue(resultShape)
  );
  if (shaped.success) return shaped.data;

  const candidates = [
    record.analysis_result,
    record.analysisResult,
    record.vibe_zapping_analysis,
    record.vibeZappingAnalysis,
    record.state,
    record.output,
  ];
  for (const candidate of candidates) {
    if (!candidate || candidate === value) continue;
    const parsed = extractZappingAnalysisResultCandidate(candidate);
    if (parsed) return parsed;
  }
  return undefined;
};

const extractRelatedContextResultCandidate = (
  value: unknown
): VibeControlRelatedContextResult | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const direct = VibeControlRelatedContextResultSchema.safeParse(
    normalizeAdkResultValue(value)
  );
  if (direct.success) return direct.data;

  const candidates = [
    record.related_context,
    record.related_context_result,
    record.relatedContext,
    record.relatedContextResult,
    record.vibe_related_context_result,
    record.vibe_related_context,
    record.vibeRelatedContext,
    record.result,
    record.response,
    record.data,
    record.state,
    record.output,
  ];
  for (const candidate of candidates) {
    if (!candidate || candidate === value) continue;
    const parsed = extractRelatedContextResultCandidate(candidate);
    if (parsed) return parsed;
  }
  return undefined;
};

const transcriptCueIdForClip = (
  clip: VibeControlOperationVideoClip,
  cue: VibeControlTranscriptCue
): string[] => [cue.id, `${clip.id}:${cue.id}`];

const hasTimestampedTranscript = (
  owner: Pick<
    VibeControlOperationVideoClip,
    "transcriptSegments" | "transcriptSrt" | "transcriptTimingStatus"
  >
): boolean =>
  owner.transcriptTimingStatus === "timestamped" &&
  (owner.transcriptSegments?.length ?? 0) > 0 &&
  Boolean(owner.transcriptSrt?.trim());

const assertTimestampedTranscript = (
  clips: VibeControlOperationVideoClip[],
  message = "ストーリー解析にはタイムスタンプ付き文字起こしが必要です"
): void => {
  const missing = clips.filter((clip) => !hasTimestampedTranscript(clip));
  if (missing.length > 0) {
    throw new Error(`${message}。Gemini文字起こし付きで録画を保存し直してください。`);
  }
};

const normalizeZappingAnalysisResultEvidence = (params: {
  result: VibeControlZappingAnalysisResult;
  video: DecodedVibeControlOperationVideo;
}): VibeControlZappingAnalysisResult => {
  const video = normalizeOperationVideo(params.video);
  const clips = normalizedOperationVideoClips(video);
  const cueEntries = clips.flatMap((clip) =>
    (clip.transcriptSegments ?? []).flatMap((cue) =>
      transcriptCueIdForClip(clip, cue).map((id) => ({ id, clip, cue }))
    )
  );
  const cueById = new Map(cueEntries.map((entry) => [entry.id, entry]));
  const allFrames = clips.flatMap((clip) =>
    (clip.frameCaptures ?? []).map((frame) => ({
      id: `${clip.id}:${frame.id}`,
      rawId: frame.id,
      timestampMs: frame.timestampMs,
    }))
  );

  return {
    ...params.result,
    notes: params.result.notes,
    storyCandidates: params.result.storyCandidates.map((story) => ({
      ...story,
      unverified: story.unverified,
      evidence: story.evidence.map((evidence) => {
        const startSeconds = Math.max(0, evidence.tRange[0] ?? 0);
        const endSeconds = Math.max(startSeconds, evidence.tRange[1] ?? startSeconds);
        const citedCueIds = (evidence.transcriptCueIds ?? []).filter((id) =>
          cueById.has(id)
        );
        const inferredCueIds =
          citedCueIds.length > 0
            ? citedCueIds
            : cueEntries
                .filter(({ cue }) => {
                  const cueStart = cue.startMs / 1000;
                  const cueEnd = cue.endMs / 1000;
                  return cueEnd >= startSeconds - 0.5 && cueStart <= endSeconds + 0.5;
                })
                .map((entry) => entry.id)
                .filter((id) => id.includes(":"));
        const uniqueCueIds = Array.from(new Set(inferredCueIds));
        const citedCues = uniqueCueIds
          .map((id) => cueById.get(id))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        const tRange =
          citedCues.length > 0
            ? [
                Math.max(0, Math.floor(Math.min(...citedCues.map(({ cue }) => cue.startMs)) / 1000)),
                Math.max(
                  0,
                  Math.ceil(Math.max(...citedCues.map(({ cue }) => cue.endMs)) / 1000)
                ),
              ]
            : evidence.tRange;
        const tRangeStart = tRange[0] ?? 0;
        const tRangeEnd = tRange[1] ?? tRangeStart;
        const frameIdsInRange = allFrames
          .filter((frame) => {
            const seconds = frame.timestampMs / 1000;
            return seconds >= tRangeStart - 2 && seconds <= tRangeEnd + 2;
          })
          .map((frame) => frame.id);
        const screenshotIds =
          frameIdsInRange.length > 0
            ? Array.from(
                new Set(
                  (evidence.screenshotIds ?? []).filter((id) => frameIdsInRange.includes(id))
                )
              )
            : evidence.screenshotIds;
        const fallbackScreenshotIds =
          screenshotIds.length > 0 ? screenshotIds : frameIdsInRange.slice(0, 3);
        return {
          ...evidence,
          tRange,
          transcriptCueIds: uniqueCueIds,
          transcriptQuote:
            evidence.transcriptQuote ||
            citedCues
              .map(({ cue }) => cue.text)
              .join(" ")
              .slice(0, 240) ||
            undefined,
          screenshotIds: fallbackScreenshotIds,
          representativeScreenshotId:
            evidence.representativeScreenshotId &&
            fallbackScreenshotIds.includes(evidence.representativeScreenshotId)
              ? evidence.representativeScreenshotId
              : fallbackScreenshotIds[0] ?? evidence.representativeScreenshotId,
        };
      }),
    })),
  };
};

const assignStoryKeysToZappingAnalysisResult = (params: {
  applicationId: string;
  result: VibeControlZappingAnalysisResult;
  stories: DecodedVibeControlStory[];
  operationVideos: DecodedVibeControlOperationVideo[];
}): VibeControlZappingAnalysisResult => {
  let nextSequence = nextUserStorySequenceForApplication({
    applicationId: params.applicationId,
    stories: params.stories,
    operationVideos: params.operationVideos,
  });
  return {
    ...params.result,
    storyCandidates: params.result.storyCandidates.map((candidate) => {
      if (candidate.storyKey?.trim()) return candidate;
      const storyKey = formatUserStoryKey(nextSequence);
      nextSequence += 1;
      return {
        ...candidate,
        storyKey,
      };
    }),
  };
};

const normalizeAdkResultValue = (value: unknown): unknown => {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map((item) => normalizeAdkResultValue(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      normalizeAdkResultValue(item),
    ])
  );
};

const mockApplications: DecodedVibeControlApplication[] = [
  {
    id: "app-vibe-control-platform",
    applicationKey: "VC",
    name: "VibeControl Platform",
    summary:
      "AI-driven delivery governance for product intent, user stories, code state, and editor context.",
    domain: "devops-governance",
    labels: ["hackathon", "governance"],
    fileSpaceId: "w-default",
    repoFullName: "enostech/vibe-control-demo",
    defaultBranch: "main",
    storyCount: 2,
    highDriftCount: 0,
    lastGeneratedAt: nowIso(),
  },
  {
    id: "app-demo-commerce",
    applicationKey: "SHOP",
    name: "Demo Commerce App",
    summary:
      "Sample commerce application used to demonstrate checkout and payment story drift.",
    domain: "commerce",
    labels: ["sample", "checkout"],
    fileSpaceId: "w-commerce",
    repoFullName: "enostech/demo-commerce-app",
    defaultBranch: "main",
    storyCount: 1,
    highDriftCount: 1,
    lastGeneratedAt: nowIso(),
  },
];

const mockEvidence: DecodedVibeControlStoryEvidence[] = [
  {
    id: "ev-st101-brief",
    applicationId: "app-vibe-control-platform",
    applicationKey: "VC",
    storyId: "story-st101",
    storyKey: "ST-101",
    type: "knowledge",
    title: "MVP要件定義: アカウント作成",
    excerpt:
      "初回ユーザーはメール認証後、組織スペースを作成してAI利用を開始できる必要がある。",
    citation: {
      title: "MVP要件定義",
      snippet: "メール認証後、組織スペースを作成してAI利用を開始",
      uri: "fileSpace://w-default/documents/mvp-brief",
    },
    freshness: "fresh",
    confidenceImpact: 18,
  },
  {
    id: "ev-st101-code",
    applicationId: "app-vibe-control-platform",
    applicationKey: "VC",
    storyId: "story-st101",
    storyKey: "ST-101",
    type: "code",
    title: "signup onboarding route",
    excerpt:
      "app/pages/admin/signin.vue と onboarding trigger は存在するが、ACの完了画面確認が未接続。",
    repoFullName: "enostech/vibe-control-demo",
    path: "app/pages/admin/signin.vue",
    citation: {
      title: "GitHub app/pages/admin/signin.vue",
      snippet: "sign-in link flow exists; onboarding completion route not mapped",
      uri: "https://github.com/enostech/vibe-control-demo/blob/main/app/pages/admin/signin.vue",
    },
    freshness: "fresh",
    confidenceImpact: -8,
  },
  {
    id: "ev-st104-brief",
    applicationId: "app-demo-commerce",
    applicationKey: "SHOP",
    storyId: "story-st104",
    storyKey: "ST-104",
    type: "knowledge",
    title: "請求・決済MVPメモ",
    excerpt:
      "カート内容、支払い方法、確認画面を一連のユーザーストーリーとして扱う。",
    citation: {
      title: "請求・決済MVPメモ",
      snippet: "カート内容、支払い方法、確認画面を一連のユーザーストーリー",
      uri: "fileSpace://w-default/documents/billing-mvp",
    },
    freshness: "fresh",
    confidenceImpact: 20,
  },
  {
    id: "ev-st104-pr",
    applicationId: "app-demo-commerce",
    applicationKey: "SHOP",
    storyId: "story-st104",
    storyKey: "ST-104",
    type: "pr",
    title: "PR #123 Cart payment",
    excerpt:
      "カート合計と支払い方法選択は実装済み。確認画面のACがテスト・コード双方で不足。",
    repoFullName: "enostech/demo-commerce-app",
    pullRequest: "#123",
    path: "app/components/PaymentMethodPicker.vue",
    citation: {
      title: "GitHub PR #123",
      snippet: "cart total and payment method implemented; confirmation remains",
      uri: "https://github.com/enostech/demo-commerce-app/pull/123",
    },
    freshness: "fresh",
    confidenceImpact: -12,
  },
  {
    id: "ev-st201-doc",
    applicationId: "app-vibe-control-platform",
    applicationKey: "VC",
    storyId: "story-st201",
    storyKey: "ST-201",
    type: "knowledge",
    title: "AIエディタ向けコンテキスト同期",
    excerpt:
      "AIエディタはSSOT化されたストーリー単位で、仕様・根拠・コード状態を参照できる。",
    citation: {
      title: "VibeControl構想資料",
      snippet: "AIエディタが直接参照するコンテキストマスター",
      uri: "fileSpace://w-default/documents/vibe-control-concept",
    },
    freshness: "fresh",
    confidenceImpact: 15,
  },
];

const mockStories: DecodedVibeControlStory[] = [
  {
    id: "story-st101",
    applicationId: "app-vibe-control-platform",
    applicationKey: "VC",
    sequence: 1,
    storyKey: "ST-101",
    title: "初回ユーザーが組織スペースを作成できる",
    summary:
      "メール認証後、ユーザーが自分の組織スペースを作り、AI利用開始地点へ到達する。",
    userStory:
      "初回ユーザーとして、メール認証後に組織スペースを作成したい。なぜなら、AIに参照させるナレッジと作業履歴を自分の組織単位で安全に管理したいから。",
    status: "implemented",
    reviewState: "needs_review",
    domain: "onboarding",
    milestone: "mvp",
    labels: ["auth", "tenant"],
    confidenceScore: 74,
    driftLevel: "medium",
    driftReason:
      "To-Beの完了画面要件に対して、As-Isでは完了後の導線根拠が不足している。",
    sourceFreshness: {
      knowledgeCheckedAt: nowIso(),
      githubCheckedAt: nowIso(),
      staleSources: [],
    },
    acceptanceCriteria: [
      {
        id: "AC-101-1",
        text: "メールリンクでサインインできる",
        state: "covered",
        evidenceIds: ["ev-st101-code"],
      },
      {
        id: "AC-101-2",
        text: "サインイン後に組織スペースを作成できる",
        state: "covered",
        evidenceIds: ["ev-st101-brief"],
      },
      {
        id: "AC-101-3",
        text: "完了後にVibeControlの開始地点へ遷移する",
        state: "missing",
        evidenceIds: ["ev-st101-code"],
      },
    ],
    evidenceIds: ["ev-st101-brief", "ev-st101-code"],
    codeRefs: [
      {
        provider: "github",
        repoFullName: "enostech/vibe-control-demo",
        branch: "main",
        path: "app/pages/admin/signin.vue",
        summary: "メールリンク認証入口",
      },
    ],
    generationTrace: [
      {
        at: nowIso(),
        actor: "agent",
        message: "Agent Searchでonboarding関連資料を検索し、3件のACを抽出。",
      },
      {
        at: nowIso(),
        actor: "agent",
        message: "GitHubの認証画面を確認。完了後導線の根拠不足をdriftとして保存。",
      },
    ],
    fileSpaceId: "w-default",
    repoFullName: "enostech/vibe-control-demo",
    generatedAt: nowIso(),
  },
  {
    id: "story-st104",
    applicationId: "app-demo-commerce",
    applicationKey: "SHOP",
    sequence: 1,
    storyKey: "ST-104",
    title: "カートから決済を完了できる",
    summary:
      "ショッピングカートの内容確認、支払い方法選択、確認画面までを一つの決済ストーリーとして管理する。",
    userStory:
      "購入者として、カート内容を確認して支払い方法を選び、確認画面で完了を確認したい。なぜなら、購入前後の不安を減らして安全に決済したいから。",
    status: "ready_for_dev",
    reviewState: "needs_review",
    domain: "billing",
    milestone: "mvp",
    labels: ["checkout", "payment"],
    confidenceScore: 82,
    driftLevel: "high",
    driftReason:
      "仕様は確認画面まで要求しているが、PR #123 では確認画面のコード根拠が不足している。",
    sourceFreshness: {
      knowledgeCheckedAt: nowIso(),
      githubCheckedAt: nowIso(),
      staleSources: [],
    },
    acceptanceCriteria: [
      {
        id: "AC-104-1",
        text: "カート合計が表示される",
        state: "covered",
        evidenceIds: ["ev-st104-pr"],
      },
      {
        id: "AC-104-2",
        text: "支払い方法を選択できる",
        state: "covered",
        evidenceIds: ["ev-st104-pr"],
      },
      {
        id: "AC-104-3",
        text: "決済完了の確認画面が表示される",
        state: "missing",
        evidenceIds: ["ev-st104-brief", "ev-st104-pr"],
      },
    ],
    evidenceIds: ["ev-st104-brief", "ev-st104-pr"],
    codeRefs: [
      {
        provider: "github",
        repoFullName: "enostech/demo-commerce-app",
        branch: "feature/cart-payment",
        pullRequest: "#123",
        path: "app/components/PaymentMethodPicker.vue",
        summary: "支払い方法選択UI",
      },
    ],
    generationTrace: [
      {
        at: nowIso(),
        actor: "agent",
        message: "billing + mvp の資料から決済ストーリーを抽出。",
      },
      {
        at: nowIso(),
        actor: "agent",
        message: "PR #123との差分を照合し、確認画面ACをmissingに設定。",
      },
    ],
    fileSpaceId: "w-default",
    repoFullName: "enostech/demo-commerce-app",
    generatedAt: nowIso(),
  },
  {
    id: "story-st201",
    applicationId: "app-vibe-control-platform",
    applicationKey: "VC",
    sequence: 2,
    storyKey: "ST-201",
    title: "AIエディタがストーリーSSOTを参照できる",
    summary:
      "AIエディタへ仕様、根拠、コード状態をユーザーストーリー単位で渡せるようにする。",
    userStory:
      "開発者として、AIエディタにストーリー単位のSSOTを渡したい。なぜなら、コード生成時に仕様・根拠・現在の実装状態を同じ前提として扱わせたいから。",
    status: "discovery",
    reviewState: "ready",
    domain: "developer-experience",
    milestone: "post-mvp",
    labels: ["mcp", "context"],
    confidenceScore: 68,
    driftLevel: "low",
    driftReason:
      "To-Beは明確だが、MCP/OAuthの実装方式は後続判断として残っている。",
    sourceFreshness: {
      knowledgeCheckedAt: nowIso(),
      githubCheckedAt: undefined,
      staleSources: ["github"],
    },
    acceptanceCriteria: [
      {
        id: "AC-201-1",
        text: "ストーリーJSONをエクスポートできる",
        state: "unknown",
        evidenceIds: ["ev-st201-doc"],
      },
      {
        id: "AC-201-2",
        text: "AIエディタから認証付きで参照できる",
        state: "unknown",
        evidenceIds: ["ev-st201-doc"],
      },
    ],
    evidenceIds: ["ev-st201-doc"],
    codeRefs: [],
    generationTrace: [
      {
        at: nowIso(),
        actor: "agent",
        message: "VibeControl構想資料からAIエディタ連携候補を抽出。",
      },
    ],
    fileSpaceId: "w-default",
    repoFullName: "enostech/vibe-control-demo",
    generatedAt: nowIso(),
  },
];

const mockConnections: DecodedVibeControlSourceConnection[] = [
  {
    id: "source-filespace",
    applicationId: "app-vibe-control-platform",
    applicationKey: "VC",
    provider: "file_space",
    status: "connected",
    displayName: "Default product FileSpace",
    fileSpaceId: "w-default",
    lastSyncedAt: nowIso(),
    scopes: ["agent_search", "knowledge"],
  },
  {
    id: "source-github",
    applicationId: "app-vibe-control-platform",
    applicationKey: "VC",
    provider: "github",
    status: "connected",
    displayName: "enostech/vibe-control-demo",
    repoFullName: "enostech/vibe-control-demo",
    defaultBranch: "main",
    lastSyncedAt: nowIso(),
    scopes: ["contents:read", "pull_requests:read"],
  },
  {
    id: "source-commerce-filespace",
    applicationId: "app-demo-commerce",
    applicationKey: "SHOP",
    provider: "file_space",
    status: "connected",
    displayName: "Commerce product FileSpace",
    fileSpaceId: "w-commerce",
    lastSyncedAt: nowIso(),
    scopes: ["agent_search", "knowledge"],
  },
  {
    id: "source-commerce-github",
    applicationId: "app-demo-commerce",
    applicationKey: "SHOP",
    provider: "github",
    status: "connected",
    displayName: "enostech/demo-commerce-app",
    repoFullName: "enostech/demo-commerce-app",
    defaultBranch: "main",
    lastSyncedAt: nowIso(),
    scopes: ["contents:read", "pull_requests:read"],
  },
];

export const useVibeControlStore = defineStore("vibeControl", {
  state: () => ({
    applications: [] as DecodedVibeControlApplication[],
    capabilities: [] as DecodedVibeControlCapability[],
    stories: [] as DecodedVibeControlStory[],
    evidence: [] as DecodedVibeControlStoryEvidence[],
    sourceConnections: [] as DecodedVibeControlSourceConnection[],
    scanProfiles: [] as DecodedVibeControlApplicationScanProfile[],
    sourceAssets: [] as DecodedVibeControlSourceAsset[],
    operationVideos: [] as DecodedVibeControlOperationVideo[],
    operationVideoGroups: [] as DecodedVibeControlOperationVideoGroup[],
    generationSessions: [] as DecodedVibeControlGenerationSession[],
    draftPatches: [] as DecodedVibeControlDraftPatch[],
    selectedApplicationId: "" as string,
    selectedStoryId: "" as string,
    isLoading: false,
    isGenerating: false,
    isStartingApplicationScan: false,
    isProvisioningApplicationFileSpace: false,
    isSavingOperationVideo: false,
    isAnalyzingZappingVideos: false,
    isFetchingRelatedContexts: false,
    error: null as string | null,
    lastRunLog: [] as string[],
    filters: {
      query: "",
      status: "all",
      domain: "",
      milestone: "",
      drift: "all",
      reviewState: "all",
      minConfidence: 0,
    } as VibeControlFilters,
  }),
  getters: {
    selectedApplication(state): DecodedVibeControlApplication | null {
      return (
        state.applications.find(
          (application) => application.id === state.selectedApplicationId
        ) ?? state.applications[0] ?? null
      );
    },
    activeStories(state): DecodedVibeControlStory[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.stories;
      return state.stories.filter((story) => story.applicationId === applicationId);
    },
    activeCapabilities(state): DecodedVibeControlCapability[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      const capabilities = !applicationId
        ? state.capabilities
        : state.capabilities.filter(
            (capability) => capability.applicationId === applicationId
          );
      return [...capabilities].sort((a, b) => a.order - b.order);
    },
    activeEvidence(state): DecodedVibeControlStoryEvidence[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.evidence;
      return state.evidence.filter((item) => item.applicationId === applicationId);
    },
    activeSourceAssets(state): DecodedVibeControlSourceAsset[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.sourceAssets;
      return state.sourceAssets.filter(
        (asset) => asset.applicationId === applicationId
      );
    },
    activeScanProfiles(state): DecodedVibeControlApplicationScanProfile[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.scanProfiles;
      return state.scanProfiles.filter(
        (profile) => profile.applicationId === applicationId
      );
    },
    defaultScanProfile(): DecodedVibeControlApplicationScanProfile | null {
      return this.activeScanProfiles[0] ?? null;
    },
    activeGenerationSessions(state): DecodedVibeControlGenerationSession[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      const sessions = !applicationId
        ? state.generationSessions
        : state.generationSessions.filter(
            (session) => session.applicationId === applicationId
          );
      return [...sessions].sort((a, b) => b.id.localeCompare(a.id));
    },
    activeSourceConnections(state): DecodedVibeControlSourceConnection[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.sourceConnections;
      return state.sourceConnections.filter(
        (source) => source.applicationId === applicationId
      );
    },
    activeOperationVideos(state): DecodedVibeControlOperationVideo[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.operationVideos;
      return state.operationVideos.filter(
        (video) => video.applicationId === applicationId
      );
    },
    activeOperationVideoGroups(state): DecodedVibeControlOperationVideoGroup[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      const groups = !applicationId
        ? state.operationVideoGroups
        : state.operationVideoGroups.filter(
            (group) => group.applicationId === applicationId
          );
      return [...groups].sort((a, b) => {
        const updated = (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);
        return updated || a.name.localeCompare(b.name, "ja");
      });
    },
    filteredStories(state): DecodedVibeControlStory[] {
      const query = state.filters.query.trim().toLowerCase();
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      return state.stories.filter((story) => {
        const applicationHit =
          !applicationId || story.applicationId === applicationId;
        const queryHit =
          !query ||
          [
            story.applicationKey,
            story.storyKey,
            story.title,
            story.summary,
            story.userStory,
            story.domain,
            story.milestone,
            ...story.labels,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        const statusHit =
          state.filters.status === "all" ||
          story.status === state.filters.status;
        const driftHit =
          state.filters.drift === "all" ||
          story.driftLevel === state.filters.drift;
        const reviewHit =
          state.filters.reviewState === "all" ||
          story.reviewState === state.filters.reviewState;
        const domainHit =
          !state.filters.domain || story.domain === state.filters.domain;
        const milestoneHit =
          !state.filters.milestone ||
          story.milestone === state.filters.milestone;
        const confidenceHit =
          story.confidenceScore >= state.filters.minConfidence;
        return (
          applicationHit &&
          queryHit &&
          statusHit &&
          driftHit &&
          reviewHit &&
          domainHit &&
          milestoneHit &&
          confidenceHit
        );
      });
    },
    selectedStory(state): DecodedVibeControlStory | null {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      return (
        state.stories.find(
          (story) =>
            story.id === state.selectedStoryId &&
            (!applicationId || story.applicationId === applicationId)
        ) ?? null
      );
    },
    selectedEvidence(state): DecodedVibeControlStoryEvidence[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      const story = state.stories.find(
        (item) =>
          item.id === state.selectedStoryId &&
          (!applicationId || item.applicationId === applicationId)
      );
      if (!story) return [];
      const ids = new Set(story.evidenceIds);
      return state.evidence.filter(
        (item) =>
          item.applicationId === story.applicationId &&
          (item.storyId === story.id || ids.has(item.id))
      );
    },
    evidenceCountByStory(state): Record<string, number> {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      return state.evidence.reduce<Record<string, number>>((acc, item) => {
        if (applicationId && item.applicationId !== applicationId) return acc;
        acc[item.storyId] = (acc[item.storyId] ?? 0) + 1;
        return acc;
      }, {});
    },
    domains(state): string[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      return [
        ...new Set(
          state.stories
            .filter((story) => !applicationId || story.applicationId === applicationId)
            .map((story) => story.domain)
        ),
      ].sort();
    },
    milestones(state): string[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      return [
        ...new Set(
          state.stories
            .filter((story) => !applicationId || story.applicationId === applicationId)
            .map((story) => story.milestone)
        ),
      ].sort();
    },
    averageConfidence(state): number {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      const stories = state.stories.filter(
        (story) => !applicationId || story.applicationId === applicationId
      );
      if (stories.length === 0) return 0;
      return Math.round(
        stories.reduce((sum, item) => sum + item.confidenceScore, 0) /
          stories.length
      );
    },
    highDriftCount(state): number {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      return state.stories.filter(
        (story) =>
          (!applicationId || story.applicationId === applicationId) &&
          story.driftLevel === "high"
      ).length;
    },
    needsReviewCount(state): number {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      return state.stories.filter(
        (story) =>
          (!applicationId || story.applicationId === applicationId) &&
          story.reviewState === "needs_review"
      ).length;
    },
  },
  actions: {
    applicationCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlApplications");
    },
    storyCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlStories");
    },
    evidenceCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlStoryEvidence");
    },
    sourceConnectionCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlSourceConnections");
    },
    scanProfileCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlScanProfiles");
    },
    operationVideoCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlOperationVideos");
    },
    operationVideoGroupCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlOperationVideoGroups");
    },
    capabilityCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlCapabilities");
    },
    sourceAssetCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlSourceAssets");
    },
    generationSessionCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlGenerationSessions");
    },
    draftPatchCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlDraftPatches");
    },
    mcpConnectionCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlMcpConnections");
    },
    agentPlanCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlAgentPlans");
    },
    applicationFileSpaceStatus(
      application: DecodedVibeControlApplication | null
    ): VibeControlApplicationFileSpaceProvisioningStatus {
      if (!application) return "missing";
      if (application.fileSpaceId?.trim()) return "ready";
      return application.fileSpaceProvisioningStatus ?? "missing";
    },
    loadMockData(): void {
      this.applications = [...mockApplications];
      this.stories = [...mockStories];
      this.evidence = [...mockEvidence];
      this.sourceConnections = [...mockConnections];
      this.scanProfiles = [];
      this.capabilities = [];
      this.sourceAssets = [];
      this.operationVideos = [];
      this.operationVideoGroups = [];
      this.generationSessions = [];
      this.draftPatches = [];
      this.selectedApplicationId = this.applications.some(
        (application) => application.id === this.selectedApplicationId
      )
        ? this.selectedApplicationId
        : this.applications[0]?.id || "";
      const activeStories = this.stories.filter(
        (story) => story.applicationId === this.selectedApplicationId
      );
      this.selectedStoryId = activeStories[0]?.id ?? "";
      this.lastRunLog = [
        "Application: VibeControl Platform を集約ルートとして選択",
        "Agent Search: FileSpace w-default からTo-Be候補を抽出",
        "GitHub: enostech/vibe-control-demo のPR/commit/file refsを照合",
        "SSOT: selected application に紐づく stories / evidence refs を生成",
      ];
      this.error = null;
    },
    async fetchFromFirestore(): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        const [
          applications,
          stories,
          evidence,
          sourceConnections,
          scanProfiles,
          operationVideos,
          operationVideoGroups,
          capabilities,
          sourceAssets,
          generationSessions,
          draftPatches,
        ] = await Promise.all([
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.applicationCollectionPath(),
            converter: vibeControlApplicationConverter,
            orderBy: { field: "lastGeneratedAt", direction: "desc" },
            limit: 50,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.storyCollectionPath(),
            converter: vibeControlStoryConverter,
            orderBy: { field: "generatedAt", direction: "desc" },
            limit: 200,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.evidenceCollectionPath(),
            converter: vibeControlStoryEvidenceConverter,
            limit: 1000,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.sourceConnectionCollectionPath(),
            converter: vibeControlSourceConnectionConverter,
            limit: 50,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.scanProfileCollectionPath(),
            converter: vibeControlApplicationScanProfileConverter,
            limit: 200,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.operationVideoCollectionPath(),
            converter: vibeControlOperationVideoConverter,
            orderBy: { field: "recordedAt", direction: "desc" },
            limit: 200,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.operationVideoGroupCollectionPath(),
            converter: vibeControlOperationVideoGroupConverter,
            orderBy: { field: "updatedAt", direction: "desc" },
            limit: 200,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.capabilityCollectionPath(),
            converter: vibeControlCapabilityConverter,
            orderBy: { field: "order", direction: "asc" },
            limit: 500,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.sourceAssetCollectionPath(),
            converter: vibeControlSourceAssetConverter,
            limit: 1000,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.generationSessionCollectionPath(),
            converter: vibeControlGenerationSessionConverter,
            limit: 100,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.draftPatchCollectionPath(),
            converter: vibeControlDraftPatchConverter,
            limit: 300,
          }),
        ]);
        this.applications = applications;
        this.stories = stories;
        this.evidence = evidence;
        this.sourceConnections = sourceConnections;
        this.scanProfiles = scanProfiles;
        this.operationVideos = operationVideos.map(normalizeOperationVideo);
        this.operationVideoGroups = operationVideoGroups;
        this.capabilities = capabilities;
        this.sourceAssets = sourceAssets;
        this.generationSessions = generationSessions;
        this.draftPatches = draftPatches;
        this.selectedApplicationId = this.applications.some(
          (application) => application.id === this.selectedApplicationId
        )
          ? this.selectedApplicationId
          : (this.applications[0]?.id ?? "");
        const activeStories = this.stories.filter(
          (story) => story.applicationId === this.selectedApplicationId
        );
        this.selectedStoryId = activeStories[0]?.id ?? "";
        if (this.applications.length === 0) {
          this.loadMockData();
        } else {
          await this.ensureDefaultOperationVideoGroups();
        }
      } catch (err) {
        log("WARN", "VibeControl Firestore fetch failed, using mock data", err);
        this.loadMockData();
        this.error =
          "FirestoreからSSOTを取得できなかったため、デモデータを表示しています";
      } finally {
        this.isLoading = false;
      }
    },
    setFilter<K extends keyof VibeControlFilters>(
      key: K,
      value: VibeControlFilters[K]
    ): void {
      this.filters[key] = value;
    },
    clearFilters(): void {
      this.filters = {
        query: "",
        status: "all",
        domain: "",
        milestone: "",
        drift: "all",
        reviewState: "all",
        minConfidence: 0,
      };
    },
    selectStory(storyId: string): void {
      this.selectedStoryId = storyId;
    },
    selectApplication(applicationId: string): void {
      this.selectedApplicationId = applicationId;
      const nextStory = this.stories.find(
        (story) => story.applicationId === applicationId
      );
      this.selectedStoryId = nextStory?.id ?? "";
      this.clearFilters();
    },
    async upsertApplication(
      input: VibeControlApplicationInput
    ): Promise<DecodedVibeControlApplication> {
      this.isLoading = true;
      this.error = null;
      try {
        const now = nowIso();
        const name = input.name.trim();
        if (!name) {
          throw new Error("アプリ名を入力してください");
        }
        const repoFullName = input.repoFullName.trim();
        if (!repoFullName || !repoFullName.includes("/")) {
          throw new Error("GitHub repositoryを選択してください");
        }
        const applicationKey = (
          input.applicationKey.trim() ||
          name
            .split(/\s+/)
            .map((part) => part[0])
            .join("") ||
          "APP"
        ).toUpperCase();
        const applicationId =
          input.id?.trim() || `app-${toDocId(name, createRandomDocId())}`;
        const duplicatedRepository = this.applications.find(
          (application) =>
            application.id !== applicationId &&
            application.repoFullName.toLowerCase() === repoFullName.toLowerCase()
        );
        if (duplicatedRepository) {
          throw new Error(
            `${repoFullName} は ${duplicatedRepository.name} に登録済みです`
          );
        }
        const currentApplication = this.applications.find(
          (application) => application.id === applicationId
        );
        const currentStories = this.stories.filter(
          (story) => story.applicationId === applicationId
        );
        const fileSpaceId = input.fileSpaceId?.trim() || undefined;
        const fileSpaceProvisioningStatus:
          | VibeControlApplicationFileSpaceProvisioningStatus
          | undefined = fileSpaceId
          ? "ready"
          : currentApplication?.fileSpaceProvisioningStatus === "creating"
            ? "creating"
            : currentApplication?.fileSpaceProvisioningStatus === "error"
              ? "error"
              : "missing";
        const application: DecodedVibeControlApplication = {
          id: applicationId,
          applicationKey,
          name,
          summary: input.summary?.trim() || undefined,
          domain: input.domain?.trim() || undefined,
          owner: input.owner?.trim() || undefined,
          labels: input.labels?.map((label) => label.trim()).filter(Boolean) ?? [],
          startUrl: input.startUrl?.trim() || undefined,
          fileSpaceId,
          fileSpaceCreateRequestId: currentApplication?.fileSpaceCreateRequestId,
          fileSpaceProvisioningStatus,
          fileSpaceErrorMessage:
            fileSpaceProvisioningStatus === "error"
              ? currentApplication?.fileSpaceErrorMessage
              : undefined,
          repoFullName,
          defaultBranch: input.defaultBranch?.trim() || "main",
          storyCount: currentStories.length || currentApplication?.storyCount || 0,
          highDriftCount:
            currentStories.filter((story) => story.driftLevel === "high").length ||
            currentApplication?.highDriftCount ||
            0,
          lastGeneratedAt: currentApplication?.lastGeneratedAt ?? now,
        };

        this.applications = [
          application,
          ...this.applications.filter((item) => item.id !== applicationId),
        ];
        this.selectedApplicationId = applicationId;
        this.sourceConnections = this.buildSourceConnectionsForApplication(
          application,
          now
        );

        const firestoreOps = useFirestoreDocOperation();
        await Promise.all([
          firestoreOps.createDocument({
            collectionName: this.applicationCollectionPath(),
            docId: application.id,
            docData: application,
            converter: vibeControlApplicationConverter,
            merge: true,
          }),
          ...this.sourceConnections
            .filter((source) => source.applicationId === application.id)
            .map((source) =>
              firestoreOps.createDocument({
                collectionName: this.sourceConnectionCollectionPath(),
                docId: source.id,
                docData: source,
                converter: vibeControlSourceConnectionConverter,
                merge: true,
              })
            ),
        ]);

        return application;
      } catch (err) {
        log("ERROR", "VibeControl application upsert failed", err);
        this.error =
          err instanceof Error ? err.message : "アプリケーション保存に失敗しました";
        throw err;
      } finally {
        this.isLoading = false;
      }
    },
    buildSourceConnectionsForApplication(
      application: DecodedVibeControlApplication,
      syncedAt = nowIso()
    ): DecodedVibeControlSourceConnection[] {
      const sources = this.sourceConnections.filter(
        (source) => source.applicationId !== application.id
      );
      if (application.fileSpaceId) {
        sources.push({
          id: `${application.id}-filespace`,
          applicationId: application.id,
          applicationKey: application.applicationKey,
          provider: "file_space",
          status: "connected",
          displayName: `FileSpace ${application.fileSpaceId}`,
          fileSpaceId: application.fileSpaceId,
          lastSyncedAt: syncedAt,
          scopes: ["agent_search", "knowledge"],
        });
      }
      sources.push({
        id: `${application.id}-github`,
        applicationId: application.id,
        applicationKey: application.applicationKey,
        provider: "github",
        status: "connected",
        displayName: application.repoFullName,
        repoFullName: application.repoFullName,
        defaultBranch: application.defaultBranch || "main",
        lastSyncedAt: syncedAt,
        scopes: ["contents:read", "pull_requests:read", "commits:read"],
      });
      return sources;
    },
    async saveApplicationScanProfile(
      input: VibeControlApplicationScanProfileInput
    ): Promise<DecodedVibeControlApplicationScanProfile> {
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const authMode = input.authMode ?? "none";
      const entryUrl = input.entryUrl.trim();
      if (!entryUrl && authMode !== "email_link_manual") {
        throw new Error("Entry URLを入力してください");
      }
      const profileId =
        input.id?.trim() ||
        `scan-profile-${application.id}-${toDocId(input.name || "default", createRandomDocId())}`;
      const current = this.scanProfiles.find((item) => item.id === profileId);
      const password = input.password ?? "";
      const passwordConfigured =
        authMode === "credentials" &&
        (Boolean(password) || current?.passwordConfigured || false);
      const assistedStorageStateJson = input.assistedStorageStateJson ?? "";
      const assistedSessionConfigured =
        authMode === "assisted_session" &&
        (Boolean(assistedStorageStateJson.trim()) ||
          current?.assistedSessionConfigured ||
          false);
      const profile: DecodedVibeControlApplicationScanProfile = {
        id: profileId,
        applicationId: application.id,
        applicationKey: application.applicationKey,
        name: input.name.trim() || "Default",
        authMode,
        entryUrl,
        loginUrl: input.loginUrl?.trim() || undefined,
        username:
          authMode === "credentials" ? input.username?.trim() || undefined : undefined,
        passwordConfigured,
        passwordUpdatedAt: password ? nowIso() : current?.passwordUpdatedAt,
        assistedSessionConfigured,
        assistedSessionUpdatedAt: assistedStorageStateJson.trim()
          ? nowIso()
          : current?.assistedSessionUpdatedAt,
        usernameSelector: input.usernameSelector?.trim() || undefined,
        passwordSelector: input.passwordSelector?.trim() || undefined,
        submitSelector: input.submitSelector?.trim() || undefined,
        includePatterns: input.includePatterns?.map((item) => item.trim()).filter(Boolean) ?? [],
        excludePatterns: input.excludePatterns?.map((item) => item.trim()).filter(Boolean) ?? [],
        defaultExploreVariants: Boolean(input.defaultExploreVariants),
        maxPages: Math.max(1, Math.min(50, Math.round(input.maxPages ?? 12))),
        maxVariantsPerScreen: Math.max(
          0,
          Math.min(10, Math.round(input.maxVariantsPerScreen ?? 5))
        ),
        maxStepsPerScreen: Math.max(
          1,
          Math.min(30, Math.round(input.maxStepsPerScreen ?? 12))
        ),
      };

      if (authMode === "credentials" && password) {
        await this.saveScanProfilePassword(profile.id, password);
      }
      if (authMode === "assisted_session" && assistedStorageStateJson.trim()) {
        await this.saveScanProfileAssistedSession(
          profile.id,
          assistedStorageStateJson
        );
      }

      const firestoreOps = useFirestoreDocOperation();
      const saved = await firestoreOps.createDocument({
        collectionName: this.scanProfileCollectionPath(),
        docId: profile.id,
        docData: profile,
        converter: vibeControlApplicationScanProfileConverter,
        merge: true,
      });
      const next = saved ?? profile;
      this.scanProfiles = [
        next,
        ...this.scanProfiles.filter((item) => item.id !== next.id),
      ];
      return next;
    },
    async saveScanProfilePassword(profileId: string, password: string): Promise<void> {
      const uid = getAuth().currentUser?.uid;
      if (!uid) {
        throw new Error("ログイン状態を確認してください");
      }
      await setDoc(
        doc(
          getFirestore(),
          "users",
          uid,
          "secrets",
          scanProfilePasswordSecretId(profileId)
        ),
        {
          password,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    async loadScanProfilePassword(profileId: string): Promise<string> {
      const uid = getAuth().currentUser?.uid;
      if (!uid) return "";
      const snap = await getDoc(
        doc(
          getFirestore(),
          "users",
          uid,
          "secrets",
          scanProfilePasswordSecretId(profileId)
        )
      );
      const password = (snap.data() as { password?: string } | undefined)?.password;
      return typeof password === "string" ? password : "";
    },
    async saveScanProfileAssistedSession(
      profileId: string,
      storageStateJson: string
    ): Promise<void> {
      const uid = getAuth().currentUser?.uid;
      if (!uid) {
        throw new Error("ログイン状態を確認してください");
      }
      await setDoc(
        doc(
          getFirestore(),
          "users",
          uid,
          "secrets",
          scanProfileAssistedSessionSecretId(profileId)
        ),
        {
          storageStateJson,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    async loadScanProfileAssistedSession(profileId: string): Promise<string> {
      const uid = getAuth().currentUser?.uid;
      if (!uid) return "";
      const snap = await getDoc(
        doc(
          getFirestore(),
          "users",
          uid,
          "secrets",
          scanProfileAssistedSessionSecretId(profileId)
        )
      );
      const storageStateJson = (
        snap.data() as { storageStateJson?: string } | undefined
      )?.storageStateJson;
      return typeof storageStateJson === "string" ? storageStateJson : "";
    },
    async persistScanProfileFromFields(params: {
      application: DecodedVibeControlApplication;
      fields: ApplicationScanFields;
    }): Promise<DecodedVibeControlApplicationScanProfile> {
      return await this.saveApplicationScanProfile({
        id: params.fields.scanProfileId || undefined,
        applicationId: params.application.id,
        name: params.fields.scanProfileName || "Default",
        authMode: params.fields.authMode,
        entryUrl:
          params.fields.authMode === "email_link_manual" ? "" : params.fields.startUrl,
        loginUrl: params.fields.loginUrl,
        username:
          params.fields.authMode === "credentials" ? params.fields.username : "",
        password:
          params.fields.authMode === "credentials" ? params.fields.password : "",
        assistedStorageStateJson:
          params.fields.authMode === "assisted_session"
            ? params.fields.assistedStorageStateJson
            : "",
        usernameSelector: params.fields.usernameSelector,
        passwordSelector: params.fields.passwordSelector,
        submitSelector: params.fields.submitSelector,
        includePatterns: params.fields.includePatterns,
        excludePatterns: params.fields.excludePatterns,
        defaultExploreVariants: params.fields.exploreVariants,
        maxPages: params.fields.maxPages,
        maxVariantsPerScreen: params.fields.maxVariantsPerScreen,
        maxStepsPerScreen: params.fields.maxStepsPerScreen,
      });
    },
    async fieldsFromScanProfile(params: {
      profile: DecodedVibeControlApplicationScanProfile;
      overrides?: Partial<ApplicationScanFields>;
    }): Promise<ApplicationScanFields> {
      const authMode =
        params.profile.authMode !== "none" ||
        (!params.profile.loginUrl &&
          !params.profile.username &&
          !params.profile.passwordConfigured &&
          !params.profile.assistedSessionConfigured)
          ? params.profile.authMode
          : "credentials";
      const password =
        authMode === "credentials"
          ? await this.loadScanProfilePassword(params.profile.id)
          : "";
      const assistedStorageStateJson =
        authMode === "assisted_session"
          ? await this.loadScanProfileAssistedSession(params.profile.id)
          : "";
      return {
        ...emptyApplicationScanFields(),
        scanProfileId: params.profile.id,
        scanProfileName: params.profile.name,
        authMode,
        startUrl: authMode === "email_link_manual" ? "" : params.profile.entryUrl,
        loginUrl: params.profile.loginUrl ?? "",
        username: params.profile.username ?? "",
        password,
        assistedStorageStateJson,
        authenticatedUrl: "",
        usernameSelector: params.profile.usernameSelector ?? "",
        passwordSelector: params.profile.passwordSelector ?? "",
        submitSelector: params.profile.submitSelector ?? "",
        includePatterns: params.profile.includePatterns,
        excludePatterns: params.profile.excludePatterns,
        maxPages: params.profile.maxPages,
        captureScreenshots: true,
        exploreVariants: params.profile.defaultExploreVariants,
        maxVariantsPerScreen: params.profile.maxVariantsPerScreen,
        maxStepsPerScreen: params.profile.maxStepsPerScreen,
        allowChatSend: false,
        ...params.overrides,
      };
    },
    async persistApplicationAndSourceConnections(
      application: DecodedVibeControlApplication,
      syncedAt = nowIso()
    ): Promise<void> {
      this.applications = [
        application,
        ...this.applications.filter((item) => item.id !== application.id),
      ];
      this.sourceConnections = this.buildSourceConnectionsForApplication(
        application,
        syncedAt
      );

      const firestoreOps = useFirestoreDocOperation();
      await Promise.all([
        firestoreOps.createDocument({
          collectionName: this.applicationCollectionPath(),
          docId: application.id,
          docData: application,
          converter: vibeControlApplicationConverter,
          merge: true,
        }),
        ...this.sourceConnections
          .filter((source) => source.applicationId === application.id)
          .map((source) =>
            firestoreOps.createDocument({
              collectionName: this.sourceConnectionCollectionPath(),
              docId: source.id,
              docData: source,
              converter: vibeControlSourceConnectionConverter,
              merge: true,
            })
          ),
      ]);
    },
    async provisionApplicationFileSpace(applicationId: string): Promise<string> {
      const application = this.applications.find(
        (item) => item.id === applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      if (application.fileSpaceId?.trim()) {
        const nextApplication: DecodedVibeControlApplication = {
          ...application,
          fileSpaceProvisioningStatus: "ready",
          fileSpaceErrorMessage: undefined,
        };
        await this.persistApplicationAndSourceConnections(nextApplication);
        return application.fileSpaceId;
      }

      const organizationId = useOrganizationStore().getLoggedInOrganizationId;
      const spaceId = useSpaceStore().selectedSpace?.id ?? "";
      if (!organizationId || !spaceId) {
        throw new Error("組織・スペースを確認してください");
      }

      this.isProvisioningApplicationFileSpace = true;
      this.error = null;
      try {
        const requestDoc = await useGeminiFileSpaceOperatorStore().createFileSpace({
          displayName: `VibeControl / ${application.name}`,
          description: [
            "Application-scoped VibeControl knowledge space.",
            `Application ID: ${application.id}`,
            `Application Key: ${application.applicationKey}`,
            `Repository: ${application.repoFullName}`,
            application.startUrl ? `Start URL: ${application.startUrl}` : "",
            "Use this isolated FileSpace for product docs, operation videos, QA evidence, and user story generation sources.",
          ]
            .filter(Boolean)
            .join("\n"),
          fileSpaceType: "manual",
          organizationId,
          spaceId,
        });

        if (!requestDoc?.id) {
          throw new Error(
            useGeminiFileSpaceOperatorStore().crudError ||
              "FileSpace作成リクエストの作成に失敗しました"
          );
        }

        const nextApplication: DecodedVibeControlApplication = {
          ...application,
          fileSpaceCreateRequestId: requestDoc.id,
          fileSpaceProvisioningStatus: "creating",
          fileSpaceErrorMessage: undefined,
        };
        await this.persistApplicationAndSourceConnections(nextApplication);
        this.lastRunLog.unshift(
          `Knowledge Space: ${application.name} の専用FileSpace作成を開始`
        );
        return requestDoc.id;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "FileSpace作成に失敗しました";
        const failedApplication: DecodedVibeControlApplication = {
          ...application,
          fileSpaceProvisioningStatus: "error",
          fileSpaceErrorMessage: message,
        };
        await this.persistApplicationAndSourceConnections(failedApplication);
        this.error = message;
        throw err;
      } finally {
        this.isProvisioningApplicationFileSpace = false;
      }
    },
    async resolveApplicationFileSpaceProvisioning(params: {
      applicationId: string;
      request: DecodedFileSpaceOperationRequest;
    }): Promise<DecodedVibeControlApplication | null> {
      const application = this.applications.find(
        (item) => item.id === params.applicationId
      );
      if (!application) return null;
      if (params.request.input.operationType !== "fileSpaceCreate") return null;
      if (
        application.fileSpaceCreateRequestId &&
        application.fileSpaceCreateRequestId !== params.request.id
      ) {
        return null;
      }

      if (params.request.status === "completed") {
        const fileSpaceId = extractFileSpaceIdFromCreateRequest(params.request);
        if (!fileSpaceId) {
          const failedApplication: DecodedVibeControlApplication = {
            ...application,
            fileSpaceProvisioningStatus: "error",
            fileSpaceErrorMessage:
              "FileSpace作成は完了しましたが、FileSpace IDを取得できませんでした",
          };
          await this.persistApplicationAndSourceConnections(failedApplication);
          return failedApplication;
        }

        const nextApplication: DecodedVibeControlApplication = {
          ...application,
          fileSpaceId,
          fileSpaceCreateRequestId: params.request.id,
          fileSpaceProvisioningStatus: "ready",
          fileSpaceErrorMessage: undefined,
        };
        await this.persistApplicationAndSourceConnections(nextApplication);
        this.lastRunLog.unshift(
          `Knowledge Space: ${application.name} を ${fileSpaceId} に紐付け`
        );
        return nextApplication;
      }

      if (params.request.status === "error") {
        const failedApplication: DecodedVibeControlApplication = {
          ...application,
          fileSpaceProvisioningStatus: "error",
          fileSpaceErrorMessage:
            params.request.errorMessage || "FileSpace作成に失敗しました",
        };
        await this.persistApplicationAndSourceConnections(failedApplication);
        return failedApplication;
      }

      const creatingApplication: DecodedVibeControlApplication = {
        ...application,
        fileSpaceCreateRequestId: params.request.id,
        fileSpaceProvisioningStatus: "creating",
        fileSpaceErrorMessage: undefined,
      };
      await this.persistApplicationAndSourceConnections(creatingApplication);
      return creatingApplication;
    },
    async deleteApplication(applicationId: string): Promise<boolean> {
      if (this.applications.length <= 1) {
        this.error = "少なくとも1つのアプリケーションが必要です";
        return false;
      }
      this.isLoading = true;
      this.error = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        const stories = this.stories.filter(
          (story) => story.applicationId === applicationId
        );
        const evidence = this.evidence.filter(
          (item) => item.applicationId === applicationId
        );
        const sources = this.sourceConnections.filter(
          (source) => source.applicationId === applicationId
        );
        const videos = this.operationVideos.filter(
          (video) => video.applicationId === applicationId
        );
        const capabilities = this.capabilities.filter(
          (capability) => capability.applicationId === applicationId
        );
        const sourceAssets = this.sourceAssets.filter(
          (asset) => asset.applicationId === applicationId
        );
        const generationSessions = this.generationSessions.filter(
          (session) => session.applicationId === applicationId
        );
        const draftPatches = this.draftPatches.filter(
          (patch) => patch.applicationId === applicationId
        );

        await Promise.all([
          firestoreOps.deleteDocument({
            collectionName: this.applicationCollectionPath(),
            docId: applicationId,
          }),
          ...stories.map((story) =>
            firestoreOps.deleteDocument({
              collectionName: this.storyCollectionPath(),
              docId: story.id,
            })
          ),
          ...evidence.map((item) =>
            firestoreOps.deleteDocument({
              collectionName: this.evidenceCollectionPath(),
              docId: item.id,
            })
          ),
          ...sources.map((source) =>
            firestoreOps.deleteDocument({
              collectionName: this.sourceConnectionCollectionPath(),
              docId: source.id,
            })
          ),
          ...videos.map((video) =>
            firestoreOps.deleteDocument({
              collectionName: this.operationVideoCollectionPath(),
              docId: video.id,
            })
          ),
          ...capabilities.map((capability) =>
            firestoreOps.deleteDocument({
              collectionName: this.capabilityCollectionPath(),
              docId: capability.id,
            })
          ),
          ...sourceAssets.map((asset) =>
            firestoreOps.deleteDocument({
              collectionName: this.sourceAssetCollectionPath(),
              docId: asset.id,
            })
          ),
          ...generationSessions.map((session) =>
            firestoreOps.deleteDocument({
              collectionName: this.generationSessionCollectionPath(),
              docId: session.id,
            })
          ),
          ...draftPatches.map((patch) =>
            firestoreOps.deleteDocument({
              collectionName: this.draftPatchCollectionPath(),
              docId: patch.id,
            })
          ),
        ]);

        this.applications = this.applications.filter(
          (application) => application.id !== applicationId
        );
        this.stories = this.stories.filter(
          (story) => story.applicationId !== applicationId
        );
        this.evidence = this.evidence.filter(
          (item) => item.applicationId !== applicationId
        );
        this.sourceConnections = this.sourceConnections.filter(
          (source) => source.applicationId !== applicationId
        );
        this.operationVideos = this.operationVideos.filter(
          (video) => video.applicationId !== applicationId
        );
        this.capabilities = this.capabilities.filter(
          (capability) => capability.applicationId !== applicationId
        );
        this.sourceAssets = this.sourceAssets.filter(
          (asset) => asset.applicationId !== applicationId
        );
        this.generationSessions = this.generationSessions.filter(
          (session) => session.applicationId !== applicationId
        );
        this.draftPatches = this.draftPatches.filter(
          (patch) => patch.applicationId !== applicationId
        );
        this.selectedApplicationId = this.applications[0]?.id ?? "";
        this.selectedStoryId =
          this.stories.find(
            (story) => story.applicationId === this.selectedApplicationId
          )?.id ?? "";
        this.clearFilters();
        return true;
      } catch (err) {
        log("ERROR", "VibeControl application delete failed", err);
        this.error =
          err instanceof Error ? err.message : "アプリケーション削除に失敗しました";
        return false;
      } finally {
        this.isLoading = false;
      }
    },
    evidenceForStory(storyId: string): DecodedVibeControlStoryEvidence[] {
      const story = this.stories.find((item) => item.id === storyId);
      if (!story) return [];
      const ids = new Set(story.evidenceIds);
      return this.evidence.filter(
        (item) =>
          item.applicationId === story.applicationId &&
          (item.storyId === storyId || ids.has(item.id))
      );
    },
    async registerSourceConnection(
      input: VibeControlGenerationInput
    ): Promise<DecodedVibeControlApplication> {
      const now = nowIso();
      const applicationName =
        input.applicationName.trim() || "VibeControl Application";
      const applicationKey = (
        input.applicationKey.trim() ||
        applicationName
          .split(/\s+/)
          .map((part) => part[0])
          .join("") ||
        "APP"
      ).toUpperCase();
      const applicationId =
        input.applicationId?.trim() ||
        this.selectedApplicationId ||
        `app-${toDocId(applicationName, createRandomDocId())}`;
      const fileSpaceId = input.fileSpaceId.trim() || "w-default";
      const repoFullName =
        input.repoFullName.trim() || "enostech/vibe-control-demo";
      const defaultBranch = input.defaultBranch.trim() || "main";
      const currentApplication = this.applications.find(
        (item) => item.id === applicationId
      );
      const application: DecodedVibeControlApplication = {
        id: applicationId,
        applicationKey,
        name: applicationName,
        summary: currentApplication?.summary,
        domain: currentApplication?.domain,
        owner: currentApplication?.owner,
        labels: currentApplication?.labels ?? [],
        startUrl: currentApplication?.startUrl,
        fileSpaceId,
        fileSpaceCreateRequestId: currentApplication?.fileSpaceCreateRequestId,
        fileSpaceProvisioningStatus: "ready",
        fileSpaceErrorMessage: undefined,
        repoFullName,
        defaultBranch,
        storyCount: currentApplication?.storyCount ?? 0,
        highDriftCount: currentApplication?.highDriftCount ?? 0,
        lastGeneratedAt: now,
      };
      this.applications = [
        application,
        ...this.applications.filter((item) => item.id !== applicationId),
      ];
      this.selectedApplicationId = applicationId;
      this.sourceConnections = [
        ...this.sourceConnections.filter(
          (source) => source.applicationId !== applicationId
        ),
        {
          id: `${applicationId}-filespace`,
          applicationId,
          applicationKey,
          provider: "file_space",
          status: "connected",
          displayName: `FileSpace ${fileSpaceId}`,
          fileSpaceId,
          lastSyncedAt: now,
          scopes: ["agent_search", "knowledge"],
        },
        {
          id: `${applicationId}-github`,
          applicationId,
          applicationKey,
          provider: "github",
          status: "connected",
          displayName: repoFullName,
          repoFullName,
          defaultBranch,
          lastSyncedAt: now,
          scopes: ["contents:read", "pull_requests:read", "commits:read"],
        },
      ];
      return application;
    },
    async runMockGeneration(input: VibeControlGenerationInput): Promise<void> {
      this.isGenerating = true;
      this.error = null;
      this.lastRunLog = [];
      try {
        const application = await this.registerSourceConnection(input);
        const applicationId = application.id;
        const applicationKey = application.applicationKey;
        const fileSpaceId = input.fileSpaceId.trim() || "w-default";
        const repoFullName =
          input.repoFullName.trim() || "enostech/vibe-control-demo";
        const seedStories =
          mockStories.filter((story) => story.applicationId === applicationId)
            .length > 0
            ? mockStories.filter((story) => story.applicationId === applicationId)
            : mockStories.filter(
                (story) => story.applicationId === this.selectedApplicationId
              );
        const storiesForApplication =
          seedStories.length > 0 ? seedStories : mockStories;
        const storyIds = new Set(storiesForApplication.map((story) => story.id));
        const evidenceForApplication = mockEvidence.filter((item) =>
          storyIds.has(item.storyId)
        );
        const storyIdFor = (storyId: string) => `${applicationId}-${storyId}`;
        const evidenceIdFor = (evidenceId: string) =>
          `${applicationId}-${evidenceId}`;
        this.lastRunLog.push(
          `Application: ${application.name} (${application.applicationKey}) を集約ルートとして選択`
        );
        this.lastRunLog.push(`Agent Search: ${fileSpaceId} からTo-Be候補を抽出`);
        this.lastRunLog.push(`GitHub: ${repoFullName} のAs-Is状態を取得`);
        const generatedStories = storiesForApplication.map((story) => ({
          ...story,
          id: storyIdFor(story.id),
          applicationId,
          applicationKey,
          fileSpaceId,
          repoFullName,
          acceptanceCriteria: story.acceptanceCriteria.map((ac) => ({
            ...ac,
            evidenceIds: ac.evidenceIds.map(evidenceIdFor),
          })),
          evidenceIds: story.evidenceIds.map(evidenceIdFor),
          generatedAt: nowIso(),
          codeRefs: story.codeRefs.map((ref) => ({
            ...ref,
            repoFullName,
            branch: input.defaultBranch.trim() || ref.branch,
          })),
        }));
        const generatedEvidence = evidenceForApplication.map((item) => ({
          ...item,
          id: evidenceIdFor(item.id),
          applicationId,
          applicationKey,
          storyId: storyIdFor(item.storyId),
          repoFullName: item.repoFullName ? repoFullName : item.repoFullName,
        }));
        this.stories = [
          ...this.stories.filter((story) => story.applicationId !== applicationId),
          ...generatedStories,
        ];
        this.evidence = [
          ...this.evidence.filter((item) => item.applicationId !== applicationId),
          ...generatedEvidence,
        ];
        this.applications = this.applications.map((item) =>
          item.id === applicationId
            ? {
                ...item,
                storyCount: generatedStories.length,
                highDriftCount: generatedStories.filter(
                  (story) => story.driftLevel === "high"
                ).length,
                lastGeneratedAt: nowIso(),
              }
            : item
        );
        this.selectedStoryId = generatedStories[0]?.id ?? "";
        this.lastRunLog.push(
          `SSOT: ${generatedStories.length} stories / ${generatedEvidence.length} evidence refs を生成`
        );
      } finally {
        this.isGenerating = false;
      }
    },
    sourceAssetPayloadForApplication(applicationId: string): Record<string, unknown>[] {
      return this.sourceAssets
        .filter((asset) => asset.applicationId === applicationId)
        .slice(0, 200)
        .map((asset) => ({
          id: asset.id,
          sourceType: asset.sourceType,
          title: asset.title,
          summary: asset.summary,
          uri: asset.uri,
          gcsPath: asset.gcsPath,
          storagePath: asset.storagePath,
          fileSpaceId: asset.fileSpaceId,
          fileSpaceDocumentId: asset.fileSpaceDocumentId,
          repoFullName: asset.repoFullName,
          path: asset.path,
          discoveryStatus: asset.discoveryStatus,
          metadata: asset.metadata,
        }));
    },
    zappingKnowledgePipelineForApplication(applicationId: string): Record<string, unknown> {
      const videos = this.operationVideos.filter(
        (video) => video.applicationId === applicationId
      );
      const zappingAssets = this.sourceAssets.filter(
        (asset) =>
          asset.applicationId === applicationId &&
          asset.sourceType.startsWith("operation_video")
      );
      const searchReadyStatuses = new Set(["queued", "completed"]);
      const searchDocuments = zappingAssets.filter((asset) =>
        searchReadyStatuses.has(asset.discoveryStatus)
      );
      const frameCount = videos.reduce(
        (sum, video) => sum + (video.frameCaptures?.length ?? 0),
        0
      );
      const transcriptCount = videos.filter(
        (video) =>
          Boolean(video.transcriptText?.trim()) ||
          Boolean(video.transcriptSummary?.trim()) ||
          Boolean(video.quickScan?.transcriptSummary?.trim())
      ).length;
      const analyzedCount = videos.filter(
        (video) => video.analysisStatus === "completed"
      ).length;

      return {
        enabled: true,
        retrieval_strategy: "vertex_ai_search",
        file_space_id:
          this.applications.find((item) => item.id === applicationId)?.fileSpaceId ??
          null,
        source_of_truth:
          "操作動画から抽出したスクリーンショット、Gemini全文文字起こし、文字起こし要約、操作ステップをFileSpace/Vertex AI Searchへ登録し、Capability/Story ADKが検索参照します。",
        included_evidence: [
          "operation_video_metadata",
          "operation_video_journey",
          "frame_captures",
          "gemini_transcript",
          "transcript_summary",
          "operation_steps",
          "zapping_analysis_result",
        ],
        operation_video_count: videos.length,
        search_document_count: searchDocuments.length,
        zapping_asset_count: zappingAssets.length,
        frame_capture_count: frameCount,
        transcript_count: transcriptCount,
        analyzed_video_count: analyzedCount,
        latest_videos: videos.slice(0, 10).map((video) => ({
          id: video.id,
          title: video.title,
          discoveryStatus: video.discoveryStatus,
          analysisStatus: video.analysisStatus,
          fileSpaceRequestId: video.fileSpaceRequestId,
          journeyFileSpaceRequestId: video.journeyFileSpaceRequestId,
          frameCount: video.frameCaptures?.length ?? 0,
          hasTranscript:
            Boolean(video.transcriptText?.trim()) ||
            Boolean(video.transcriptSummary?.trim()) ||
            Boolean(video.quickScan?.transcriptSummary?.trim()),
        })),
      };
    },
    defaultOperationVideoGroupId(applicationId: string): string {
      return `operation-video-group-${applicationId}-legacy`;
    },
    operationVideoCountForGroup(groupId: string): number {
      return this.operationVideos.filter((video) => video.groupId === groupId).length;
    },
    async createOperationVideoGroup(
      input: VibeControlOperationVideoGroupInput
    ): Promise<DecodedVibeControlOperationVideoGroup> {
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const name = input.name.trim();
      if (!name) {
        throw new Error("動画グループ名を入力してください");
      }
      const groupId = input.id || `operation-video-group-${createRandomDocId()}`;
      const group: DecodedVibeControlOperationVideoGroup = {
        id: groupId,
        applicationId: application.id,
        applicationKey: application.applicationKey,
        name,
        description: input.description?.trim() || undefined,
        videoCount: this.operationVideoCountForGroup(groupId),
      };
      const firestoreOps = useFirestoreDocOperation();
      const created = await firestoreOps.createDocument({
        collectionName: this.operationVideoGroupCollectionPath(),
        docId: group.id,
        docData: group,
        converter: vibeControlOperationVideoGroupConverter,
        merge: true,
      });
      const savedGroup = created ?? group;
      this.operationVideoGroups = [
        savedGroup,
        ...this.operationVideoGroups.filter((item) => item.id !== savedGroup.id),
      ];
      this.lastRunLog.unshift(`Operation Video Group: ${name} を作成`);
      return savedGroup;
    },
    async updateOperationVideoGroup(input: {
      groupId: string;
      name: string;
      description?: string;
    }): Promise<void> {
      const group = this.operationVideoGroups.find(
        (item) => item.id === input.groupId
      );
      if (!group) {
        throw new Error("更新対象の動画グループが見つかりません");
      }
      const name = input.name.trim();
      if (!name) {
        throw new Error("動画グループ名を入力してください");
      }
      const nextGroup: DecodedVibeControlOperationVideoGroup = {
        ...group,
        name,
        description: input.description?.trim() || undefined,
        videoCount: this.operationVideoCountForGroup(group.id),
      };
      const groupVideos = this.operationVideos.filter(
        (video) => video.groupId === group.id
      );
      const nextVideos = this.operationVideos.map((video) =>
        video.groupId === group.id
          ? { ...video, groupNameSnapshot: name }
          : video
      );
      const firestoreOps = useFirestoreDocOperation();
      await Promise.all([
        firestoreOps.createDocument({
          collectionName: this.operationVideoGroupCollectionPath(),
          docId: nextGroup.id,
          docData: nextGroup,
          converter: vibeControlOperationVideoGroupConverter,
          merge: true,
        }),
        ...groupVideos.map((video) =>
          firestoreOps.createDocument({
            collectionName: this.operationVideoCollectionPath(),
            docId: video.id,
            docData: { ...video, groupNameSnapshot: name },
            converter: vibeControlOperationVideoConverter,
            merge: true,
          })
        ),
      ]);
      this.operationVideoGroups = this.operationVideoGroups.map((item) =>
        item.id === nextGroup.id ? nextGroup : item
      );
      this.operationVideos = nextVideos;
      this.lastRunLog.unshift(`Operation Video Group: ${group.name} を ${name} に変更`);
    },
    async deleteOperationVideoGroup(groupId: string): Promise<void> {
      const group = this.operationVideoGroups.find((item) => item.id === groupId);
      if (!group) {
        throw new Error("削除対象の動画グループが見つかりません");
      }
      if (this.operationVideos.some((video) => video.groupId === groupId)) {
        throw new Error("動画が登録されているグループは削除できません");
      }
      const deleted = await useFirestoreDocOperation().deleteDocument({
        collectionName: this.operationVideoGroupCollectionPath(),
        docId: group.id,
      });
      if (!deleted) {
        throw new Error("動画グループを削除できませんでした");
      }
      this.operationVideoGroups = this.operationVideoGroups.filter(
        (item) => item.id !== group.id
      );
      this.lastRunLog.unshift(`Operation Video Group: ${group.name} を削除`);
    },
    async moveOperationVideosToGroup(input: {
      videoIds: string[];
      groupId: string;
    }): Promise<void> {
      const group = this.operationVideoGroups.find((item) => item.id === input.groupId);
      if (!group) {
        throw new Error("移動先の動画グループが見つかりません");
      }
      const targetIds = Array.from(new Set(input.videoIds)).filter(Boolean);
      if (targetIds.length === 0) return;
      const targetVideos = this.operationVideos.filter((video) =>
        targetIds.includes(video.id)
      );
      if (targetVideos.length === 0) {
        throw new Error("移動対象の操作動画が見つかりません");
      }

      const nextVideos = this.operationVideos.map((video) =>
        targetIds.includes(video.id)
          ? {
              ...video,
              groupId: group.id,
              groupNameSnapshot: group.name,
            }
          : video
      );
      const nextGroups = this.operationVideoGroups.map((item) => ({
        ...item,
        videoCount: nextVideos.filter((video) => video.groupId === item.id).length,
      }));
      const firestoreOps = useFirestoreDocOperation();
      await Promise.all([
        ...targetVideos.map((video) => {
          const nextVideo = nextVideos.find((item) => item.id === video.id)!;
          return firestoreOps.createDocument({
            collectionName: this.operationVideoCollectionPath(),
            docId: nextVideo.id,
            docData: nextVideo,
            converter: vibeControlOperationVideoConverter,
            merge: true,
          });
        }),
        ...nextGroups.map((nextGroup) =>
          firestoreOps.createDocument({
            collectionName: this.operationVideoGroupCollectionPath(),
            docId: nextGroup.id,
            docData: nextGroup,
            converter: vibeControlOperationVideoGroupConverter,
            merge: true,
          })
        ),
      ]);

      this.operationVideos = nextVideos;
      this.operationVideoGroups = nextGroups;
      this.lastRunLog.unshift(
        `Operation Video Group: ${targetVideos.length}件を ${group.name} に移動`
      );
    },
    async ensureDefaultOperationVideoGroups(): Promise<void> {
      const firestoreOps = useFirestoreDocOperation();
      const updatedGroups = [...this.operationVideoGroups];
      const updatedVideos = [...this.operationVideos];

      for (const application of this.applications) {
        const orphanVideos = updatedVideos.filter(
          (video) => video.applicationId === application.id && !video.groupId
        );
        if (orphanVideos.length === 0) continue;

        const groupId = this.defaultOperationVideoGroupId(application.id);
        const existingGroup = updatedGroups.find((group) => group.id === groupId);
        const existingGroupVideoCount = updatedVideos.filter(
          (video) => video.groupId === groupId
        ).length;
        const group: DecodedVibeControlOperationVideoGroup = {
          ...(existingGroup ?? {}),
          id: groupId,
          applicationId: application.id,
          applicationKey: application.applicationKey,
          name: "既存の操作動画",
          description: "グループ機能の追加前に保存された操作動画です。",
          videoCount: existingGroupVideoCount + orphanVideos.length,
        };

        await firestoreOps.createDocument({
          collectionName: this.operationVideoGroupCollectionPath(),
          docId: group.id,
          docData: group,
          converter: vibeControlOperationVideoGroupConverter,
          merge: true,
        });

        if (!existingGroup) {
          updatedGroups.push(group);
        }

        await Promise.all(
          orphanVideos.map((video) => {
            const nextVideo: DecodedVibeControlOperationVideo = {
              ...video,
              groupId: group.id,
              groupNameSnapshot: group.name,
            };
            const index = updatedVideos.findIndex((item) => item.id === video.id);
            if (index >= 0) updatedVideos[index] = nextVideo;
            return firestoreOps.createDocument({
              collectionName: this.operationVideoCollectionPath(),
              docId: nextVideo.id,
              docData: nextVideo,
              converter: vibeControlOperationVideoConverter,
              merge: true,
            });
          })
        );
      }

      this.operationVideoGroups = updatedGroups.map((group) => ({
        ...group,
        videoCount: updatedVideos.filter((video) => video.groupId === group.id)
          .length,
      }));
      this.operationVideos = updatedVideos;
    },
    async persistGenerationSession(
      session: DecodedVibeControlGenerationSession
    ): Promise<void> {
      this.generationSessions = [
        session,
        ...this.generationSessions.filter((item) => item.id !== session.id),
      ];
      await useFirestoreDocOperation().createDocument({
        collectionName: this.generationSessionCollectionPath(),
        docId: session.id,
        docData: session,
        converter: vibeControlGenerationSessionConverter,
        merge: true,
      });
    },
    async persistOperationVideo(
      video: DecodedVibeControlOperationVideo
    ): Promise<void> {
      const normalizedVideo = normalizeOperationVideo(video);
      this.operationVideos = [
        normalizedVideo,
        ...this.operationVideos.filter((item) => item.id !== normalizedVideo.id),
      ];
      await useFirestoreDocOperation().createDocument({
        collectionName: this.operationVideoCollectionPath(),
        docId: normalizedVideo.id,
        docData: normalizedVideo,
        converter: vibeControlOperationVideoConverter,
        merge: true,
      });
    },
    buildZappingAnalysisModeState(params: {
      application: DecodedVibeControlApplication;
      video: DecodedVibeControlOperationVideo;
      analysisSessionId: string;
      prompt?: string;
    }): Record<string, unknown> {
      const sourceAssets = this.sourceAssetPayloadForApplication(
        params.application.id
      );
      const video = normalizeOperationVideo(params.video);
      const clips = normalizedOperationVideoClips(video);
      const primaryClip = clips[0] ?? primaryOperationVideoClip(video);
      return {
        active_mode: "vibe_zapping_analysis",
        vibe_zapping_analysis: {
          phase: "zapping_analysis",
          setup: {
            confirmed: true,
            analysis_session_id: params.analysisSessionId,
            application_id: params.application.id,
            application_key: params.application.applicationKey,
            application_name: params.application.name,
            file_space_id: params.application.fileSpaceId,
            repo_full_name: params.application.repoFullName,
            default_branch: params.application.defaultBranch || "main",
            operation_video_id: video.id,
            video_storage_path: primaryClip.storagePath,
            video_bucket_name: primaryClip.bucketName,
            video_content_type: primaryClip.contentType,
            video_duration_ms: video.totalDurationMs ?? primaryClip.durationMs,
            video_clip_count: clips.length,
          },
          payload: {
            operation_video: {
              id: video.id,
              title: video.title,
              description: video.description,
              quickScan: primaryClip.quickScan,
              transcriptText: primaryClip.transcriptText,
              transcriptProvider: primaryClip.transcriptProvider,
              transcriptSummary: primaryClip.transcriptSummary,
              transcriptSegments: primaryClip.transcriptSegments ?? [],
              transcriptSrt: primaryClip.transcriptSrt,
              transcriptTimingStatus:
                primaryClip.transcriptTimingStatus ?? "unavailable",
              fileName: primaryClip.fileName,
              bucketName: primaryClip.bucketName,
              storagePath: primaryClip.storagePath,
              contentType: primaryClip.contentType,
              sizeBytes: primaryClip.sizeBytes,
              durationMs: video.totalDurationMs ?? primaryClip.durationMs,
              frameCaptures: primaryClip.frameCaptures,
              recordedAt: primaryClip.recordedAt,
              sourceDisplaySurface: primaryClip.sourceDisplaySurface,
              sourceAssetId: primaryClip.sourceAssetId,
              journeySourceAssetId: primaryClip.journeySourceAssetId,
              clipCount: clips.length,
              clips,
            },
            source_assets: sourceAssets,
            existing_capabilities: this.capabilities.filter(
              (capability) =>
                capability.applicationId === params.application.id
            ),
            existing_stories: this.stories.filter(
              (story) => story.applicationId === params.application.id
            ),
            existing_evidence: this.evidence.filter(
              (item) => item.applicationId === params.application.id
            ),
            user_notes: params.prompt?.trim() || undefined,
            expected_outputs: [
              "story_candidates",
              "story_evidence_video_segments",
              "story_evidence_screenshots",
              "operation_intent",
            ],
          },
          tools: {
            vertex_ai_search: {
              enabled: true,
              file_space_id: params.application.fileSpaceId,
              purpose:
                "動画の操作意図を、事業・プロダクト背景を含むFileSpace文脈で解釈する",
            },
          },
        },
      };
    },
    buildRelatedContextModeState(params: {
      application: DecodedVibeControlApplication;
      video: DecodedVibeControlOperationVideo;
      sessionId: string;
      organizationId: string;
      spaceId: string;
      userId: string;
      provider: "github" | "slack" | "knowledge";
      prompt?: string;
    }): Record<string, unknown> {
      const video = normalizeOperationVideo(params.video);
      return {
        active_mode: "vibe_related_context",
        vibe_related_context: {
          phase: "collecting",
          setup: {
            confirmed: true,
            provider: params.provider,
            related_context_session_id: params.sessionId,
            organization_id: params.organizationId,
            space_id: params.spaceId,
            user_id: params.userId,
            application_id: params.application.id,
            application_key: params.application.applicationKey,
            application_name: params.application.name,
            file_space_id: params.application.fileSpaceId,
            repo_full_name: params.application.repoFullName,
            default_branch: params.application.defaultBranch || "main",
            operation_video_id: params.video.id,
          },
          payload: {
            application: {
              id: params.application.id,
              applicationKey: params.application.applicationKey,
              name: params.application.name,
              summary: params.application.summary,
              domain: params.application.domain,
              fileSpaceId: params.application.fileSpaceId,
              repoFullName: params.application.repoFullName,
              defaultBranch: params.application.defaultBranch || "main",
            },
            operation_video: {
              id: video.id,
              title: video.title,
              description: video.description,
              quickScan: video.quickScan,
              transcriptSummary: video.transcriptSummary,
              transcriptProvider: video.transcriptProvider,
              frameCaptures: video.frameCaptures,
              clips: video.clips,
              clipCount: video.clipCount,
              recordedAt: video.recordedAt,
              sourceDisplaySurface: video.sourceDisplaySurface,
            },
            analysis_result: video.analysisResult,
            existing_related_contexts: video.relatedContexts,
            user_notes: params.prompt?.trim() || undefined,
            expected_outputs:
              params.provider === "slack"
                ? ["slack_messages", "related_reasons"]
                : params.provider === "knowledge"
                  ? ["knowledge_documents", "downloadable_file_refs", "related_reasons"]
                  : ["github_pull_requests", "related_reasons"],
          },
        },
      };
    },
    buildVibeGenerationModeState(params: {
      mode: VibeControlSeparatedAdkMode;
      application: DecodedVibeControlApplication;
      generationSessionId: string;
      capability?: DecodedVibeControlCapability | null;
      prompt?: string;
    }): Record<string, unknown> {
      const applicationId = params.application.id;
      const setup: Record<string, unknown> = {
        confirmed: true,
        generation_session_id: params.generationSessionId,
        application_id: params.application.id,
        application_key: params.application.applicationKey,
        application_name: params.application.name,
        file_space_id: params.application.fileSpaceId,
        repo_full_name: params.application.repoFullName,
        default_branch: params.application.defaultBranch || "main",
      };
      if (params.capability) {
        setup.capability_id = params.capability.id;
        setup.capability_key = params.capability.capabilityKey;
      }

      const payload: Record<string, unknown> = {
        source_assets: this.sourceAssetPayloadForApplication(applicationId),
        knowledge_pipeline:
          this.zappingKnowledgePipelineForApplication(applicationId),
        existing_capabilities: this.capabilities.filter(
          (capability) => capability.applicationId === applicationId
        ),
        existing_stories: this.stories.filter(
          (story) => story.applicationId === applicationId
        ),
        existing_evidence: this.evidence.filter(
          (item) => item.applicationId === applicationId
        ),
        user_notes: params.prompt?.trim() || undefined,
      };
      if (params.capability) {
        payload.capability = params.capability;
      }

      return {
        active_mode: params.mode,
        [params.mode]: {
          phase: "drafting",
          setup,
          payload,
          tools: {
            vertex_ai_search: {
              enabled: Boolean(params.application.fileSpaceId?.trim()),
              file_space_id: params.application.fileSpaceId,
              primary_sources: [
                "operation_video_metadata",
                "operation_video_journey",
                "gemini_transcript",
                "transcript_summary",
                "operation_steps",
                "frame_captures",
                "zapping_analysis_result",
              ],
              purpose:
                "ザッピング動画由来のリッチ証跡をFileSpace/Vertex AI Searchから検索し、Capability/Story候補の一次根拠として使う",
            },
          },
        },
      };
    },
    async startCapabilityStructuring(
      input: VibeControlGenerationAgentInput
    ): Promise<string> {
      return this.startSeparatedGenerationAgent({
        ...input,
        mode: "vibe_capability_structuring",
      });
    },
    async startStoryGeneration(
      input: VibeControlGenerationAgentInput
    ): Promise<string> {
      return this.startSeparatedGenerationAgent({
        ...input,
        mode: "vibe_story_generation",
      });
    },
    async startZappingVideoAnalysis(
      input: VibeControlZappingVideoAnalysisInput
    ): Promise<string> {
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const video = this.operationVideos.find(
        (item) => item.id === input.videoId && item.applicationId === application.id
      );
      if (!video) {
        throw new Error("対象ザッピング動画が見つかりません");
      }
      const fileSpaceId = application.fileSpaceId?.trim();
      if (!fileSpaceId) {
        throw new Error("ザッピング解析に使うアプリ専用FileSpace IDを設定してください");
      }
      const clips = normalizedOperationVideoClips(video);
      assertTimestampedTranscript(clips);

      const orgId = useOrganizationStore().loggedInOrganizationInfo?.id ?? "";
      const spaceId = useSpaceStore().selectedSpace?.id ?? "";
      const uid = getAuth().currentUser?.uid;
      if (!orgId || !spaceId || !uid) {
        throw new Error("組織・スペース・ログイン状態を確認してください");
      }

      const analysisSessionId = `vibecontrol-zapping-analysis-${application.id}-${video.id}-${Date.now()}-${createRandomDocId()}`;
      const responseId = `zapping-analysis-response-${createRandomDocId()}`;
      const modeState = this.buildZappingAnalysisModeState({
        application,
        video,
        analysisSessionId,
        prompt: input.prompt,
      });
      const prompt =
        input.prompt?.trim() ||
        [
          `${application.name} のザッピング動画「${video.title}」を解析してください。`,
          "このRequestDocにはザッピング動画ファイルを添付しています。動画内の画面遷移と音声を第一情報源として扱ってください。",
          "アプリ専用FileSpaceのVertex AI Searchを参照し、事業背景・プロダクト背景・既存ナレッジを踏まえて動画の操作意図を解釈してください。",
          "動画からUser Story候補を抽出し、各Storyに根拠となる動画タイムレンジ、代表スクリーンショット、関連スクリーンショットを紐付けてください。",
          "5秒ごとのスクリーンショットと簡易スキャンメモも補助情報として参照してください。",
        ].join("\n");

      this.isAnalyzingZappingVideos = true;
      this.error = null;
      try {
        const queuedVideo: DecodedVibeControlOperationVideo = {
          ...video,
          analysisStatus: "queued",
          analysisSessionId,
          analysisOrganizationId: orgId,
          analysisSpaceId: spaceId,
          analysisErrorMessage: undefined,
        };
        await this.persistOperationVideo(queuedVideo);

        const requestId = await createAdkInvokeRequest({
          organizationId: orgId,
          spaceId,
          input: buildAdkInvokeInput({
            mode: "vibe_zapping_analysis",
            sessionId: analysisSessionId,
            organizationId: orgId,
            spaceId,
            userId: uid,
            prompt,
            responseId,
            model: defaultLlmModelSelectionForAdkMode(
              "vibe_zapping_analysis"
            ),
            fileSpaceId,
            workspaceId: application.id,
            history: [],
            modeState,
            attachments: clips.map((clip) => ({
              gcsPath: `gs://${clip.bucketName}/${clip.storagePath}`,
              mimeType: clip.contentType || "video/webm",
              fileName: clip.fileName,
            })),
          }),
        });

        await this.persistOperationVideo({
          ...queuedVideo,
          analysisRequestId: requestId,
          analysisStatus: "running",
        });
        this.lastRunLog.unshift(
          `Zapping Analysis: ${application.name} / ${video.title} の解析を開始`
        );

        const stopWatch = watchAdkInvokeRequest({
          organizationId: orgId,
          spaceId,
          requestId,
          onUpdate: (
            status: RequestStatus,
            errorMessage?: string,
            output?: AdkInvokeOutput
          ) => {
            void this.updateZappingVideoAnalysisStatus({
              videoId: video.id,
              requestId,
              status,
              errorMessage,
              output,
            });
            if (status === "completed" || status === "error") {
              stopWatch();
            }
          },
        });

        return requestId;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "ザッピング解析の開始に失敗しました";
        await this.persistOperationVideo({
          ...video,
          analysisStatus: "error",
          analysisSessionId,
          analysisOrganizationId: orgId,
          analysisSpaceId: spaceId,
          analysisErrorMessage: message,
        });
        this.error = message;
        throw err;
      } finally {
        this.isAnalyzingZappingVideos = false;
      }
    },
    async startAllZappingVideoAnalysis(applicationId: string): Promise<string[]> {
      const targets = this.operationVideos.filter(
        (video) =>
          video.applicationId === applicationId &&
          video.analysisStatus !== "queued" &&
          video.analysisStatus !== "running"
      );
      const requestIds: string[] = [];
      for (const video of targets) {
        requestIds.push(
          await this.startZappingVideoAnalysis({
            applicationId,
            videoId: video.id,
          })
        );
      }
      return requestIds;
    },
    async startRelatedContextAnalysis(
      input: VibeControlRelatedContextAnalysisInput
    ): Promise<string> {
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const video = this.operationVideos.find(
        (item) => item.id === input.videoId && item.applicationId === application.id
      );
      if (!video) {
        throw new Error("対象ザッピング動画が見つかりません");
      }
      if (input.provider === "github" && !application.repoFullName?.trim()) {
        throw new Error("GitHub repositoryを選択してください");
      }
      if (input.provider === "knowledge" && !application.fileSpaceId?.trim()) {
        throw new Error("アプリ専用FileSpace IDを設定してください");
      }
      const fileSpaceId = application.fileSpaceId?.trim();

      const orgId = useOrganizationStore().loggedInOrganizationInfo?.id ?? "";
      const spaceId = useSpaceStore().selectedSpace?.id ?? "";
      const uid = getAuth().currentUser?.uid;
      if (!orgId || !spaceId || !uid) {
        throw new Error("組織・スペース・ログイン状態を確認してください");
      }

      const sessionId = `vibecontrol-related-context-${application.id}-${video.id}-${Date.now()}-${createRandomDocId()}`;
      const responseId = `related-context-response-${createRandomDocId()}`;
      const modeState = this.buildRelatedContextModeState({
        application,
        video,
        sessionId,
        organizationId: orgId,
        spaceId,
        userId: uid,
        provider: input.provider,
        prompt: input.prompt,
      });
      const prompt =
        input.prompt?.trim() ||
        (input.provider === "knowledge"
          ? [
              `${application.name} の操作動画「${video.title}」に関連するFileSpaceナレッジを探してください。`,
              "動画解析結果、操作メモ、文字起こし要約、Story候補と、Search Store内のファイル名・説明・本文・引用を照合してください。",
              "音声メモ、Markdown設計書、アーキテクチャ図、投入ファイルなど、実装やリリースノート作成に役立つファイルだけを返してください。",
              "関連する理由を日本語で付け、関連度の高いナレッジファイルだけを最大10件返してください。",
            ]
          : input.provider === "slack"
          ? [
              `${application.name} の操作動画「${video.title}」に関連するSlack会話を探してください。`,
              "動画解析結果、操作メモ、文字起こし要約、Story候補と、Slack投稿・スレッド・チャンネルを照合してください。",
              "関連する理由を日本語で付け、関連度の高い会話だけを返してください。",
            ]
          : [
              `${application.name} の操作動画「${video.title}」に関連するGitHub Pull Requestを探してください。`,
              "動画解析結果、操作メモ、文字起こし要約、Story候補と、GitHub PRのタイトル・本文・ラベル・変更ファイルを照合してください。",
              "関連する理由を日本語で付け、関連度の高いPRだけを返してください。",
            ]).join("\n");

      this.isFetchingRelatedContexts = true;
      this.error = null;
      try {
        await this.persistOperationVideo({
          ...video,
          relatedContexts: {
            ...video.relatedContexts,
            generatedAt: nowIso(),
            status: "running",
            runningProvider: input.provider,
            notes: [],
            github:
              input.provider === "github"
                ? video.relatedContexts?.github ?? {
                    repoFullName: application.repoFullName,
                    checkedAt: nowIso(),
                    pullRequests: [],
                  }
                : video.relatedContexts?.github,
            slack:
              input.provider === "slack"
                ? video.relatedContexts?.slack ?? {
                    checkedAt: nowIso(),
                    messages: [],
                  }
                : video.relatedContexts?.slack,
            knowledge:
              input.provider === "knowledge"
                ? video.relatedContexts?.knowledge ?? {
                    fileSpaceId: fileSpaceId || "",
                    checkedAt: nowIso(),
                    documents: [],
                  }
                : video.relatedContexts?.knowledge,
          },
        });

        const requestId = await createAdkInvokeRequest({
          organizationId: orgId,
          spaceId,
          input: buildAdkInvokeInput({
            mode: "vibe_related_context",
            sessionId,
            organizationId: orgId,
            spaceId,
            userId: uid,
            prompt,
            responseId,
            model: defaultLlmModelSelectionForAdkMode("vibe_related_context"),
            fileSpaceId: fileSpaceId ?? null,
            workspaceId: application.id,
            history: [],
            modeState,
          }),
        });

        this.lastRunLog.unshift(
          `Related Context: ${application.name} / ${video.title} の${
            input.provider === "slack"
              ? "Slack会話"
              : input.provider === "knowledge"
                ? "ナレッジ"
                : "GitHub PR"
          }取得を開始`
        );

        const stopWatch = watchAdkInvokeRequest({
          organizationId: orgId,
          spaceId,
          requestId,
          onUpdate: (
            status: RequestStatus,
            errorMessage?: string,
            output?: AdkInvokeOutput
          ) => {
            void this.updateRelatedContextAnalysisStatus({
              videoId: video.id,
              requestId,
              sessionId,
              organizationId: orgId,
              spaceId,
              status,
              errorMessage,
              output,
            });
            if (status === "completed" || status === "error") {
              stopWatch();
            }
          },
        });

        return requestId;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "関連コンテキスト取得の開始に失敗しました";
        await this.persistOperationVideo({
          ...video,
          relatedContexts: {
            ...video.relatedContexts,
            generatedAt: nowIso(),
            status: "error",
            runningProvider: undefined,
            notes: [message],
            github: video.relatedContexts?.github,
            slack: video.relatedContexts?.slack,
            knowledge: video.relatedContexts?.knowledge,
          },
        });
        this.error = message;
        throw err;
      } finally {
        this.isFetchingRelatedContexts = false;
      }
    },
    async fetchZappingAnalysisResultFromSession(params: {
      organizationId: string;
      spaceId: string;
      sessionId: string;
    }): Promise<VibeControlZappingAnalysisResult | undefined> {
      if (!params.organizationId || !params.spaceId || !params.sessionId) {
        return undefined;
      }
      const ref = doc(
        getFirestore(),
        "organizations",
        params.organizationId,
        "spaces",
        params.spaceId,
        "adkSessions",
        params.sessionId
      );
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : null;
        const state = data?.state;
        const result = extractZappingAnalysisResultCandidate(state);
        if (result) return result;
        await sleep(750);
      }
      return undefined;
    },
    async fetchRelatedContextResultFromSession(params: {
      organizationId: string;
      spaceId: string;
      sessionId: string;
    }): Promise<VibeControlRelatedContextResult | undefined> {
      if (!params.organizationId || !params.spaceId || !params.sessionId) {
        return undefined;
      }
      const ref = doc(
        getFirestore(),
        "organizations",
        params.organizationId,
        "spaces",
        params.spaceId,
        "adkSessions",
        params.sessionId
      );
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : null;
        const state = data?.state;
        const result = extractRelatedContextResultCandidate(state);
        if (result) return result;
        await sleep(750);
      }
      return undefined;
    },
    async startSeparatedGenerationAgent(
      input: VibeControlGenerationAgentInput & {
        mode: VibeControlSeparatedAdkMode;
      }
    ): Promise<string> {
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const fileSpaceId = application.fileSpaceId?.trim();
      if (!fileSpaceId) {
        throw new Error("VibeControl ADKに渡すFileSpace IDを設定してください");
      }

      const orgId = useOrganizationStore().loggedInOrganizationInfo?.id ?? "";
      const spaceId = useSpaceStore().selectedSpace?.id ?? "";
      const uid = getAuth().currentUser?.uid;
      if (!orgId || !spaceId || !uid) {
        throw new Error("組織・スペース・ログイン状態を確認してください");
      }

      const phase =
        input.mode === "vibe_capability_structuring"
          ? "capability_structuring"
          : "story_generation";
      const generationSessionId = `vibecontrol-${phase}-${application.id}-${Date.now()}-${createRandomDocId()}`;
      const responseId = `${phase}-response-${createRandomDocId()}`;
      const capability = input.capabilityId?.trim()
        ? this.capabilities.find((item) => item.id === input.capabilityId)
        : undefined;
      const sourceAssets = this.sourceAssets.filter(
        (asset) => asset.applicationId === application.id
      );
      const zappingKnowledgePipeline =
        this.zappingKnowledgePipelineForApplication(application.id);
      const generationSession: DecodedVibeControlGenerationSession = {
        id: generationSessionId,
        applicationId: application.id,
        applicationKey: application.applicationKey,
        phase,
        adkMode: input.mode,
        responseId,
        capabilityAdkSessionId:
          input.mode === "vibe_capability_structuring"
            ? generationSessionId
            : undefined,
        storyAdkSessionIds:
          input.mode === "vibe_story_generation" ? [generationSessionId] : [],
        activeCapabilityId:
          input.mode === "vibe_story_generation" ? capability?.id : undefined,
        status: "running",
        lastMessage:
          input.mode === "vibe_capability_structuring"
            ? "Capability解析ADKを起動しました"
            : "Story生成ADKを起動しました",
        sourceSnapshot: {
          fileSpaceId,
          repoFullName: application.repoFullName,
          defaultBranch: application.defaultBranch || "main",
          screenshotCount: sourceAssets.filter(
            (asset) =>
              asset.sourceType === "application_screenshot" ||
              asset.sourceType === "application_screen" ||
              asset.sourceType === "application_screen_variant"
          ).length,
          videoCount: sourceAssets.filter((asset) =>
            asset.sourceType.startsWith("operation_video")
          ).length,
          zappingSearchDocumentCount:
            typeof zappingKnowledgePipeline.search_document_count === "number"
              ? zappingKnowledgePipeline.search_document_count
              : 0,
          zappingFrameCount:
            typeof zappingKnowledgePipeline.frame_capture_count === "number"
              ? zappingKnowledgePipeline.frame_capture_count
              : 0,
          transcriptCount:
            typeof zappingKnowledgePipeline.transcript_count === "number"
              ? zappingKnowledgePipeline.transcript_count
              : 0,
          evidenceCount: this.evidence.filter(
            (item) => item.applicationId === application.id
          ).length,
        },
      };

      this.isGenerating = true;
      this.error = null;
      try {
        await this.persistGenerationSession(generationSession);
        const modeState = this.buildVibeGenerationModeState({
          mode: input.mode,
          application,
          generationSessionId,
          capability,
          prompt: input.prompt,
        });
        const prompt =
          input.prompt?.trim() ||
          (input.mode === "vibe_capability_structuring"
            ? [
                `${application.name} のCapability構造案を作成してください。`,
                "操作動画から抽出してFileSpace/Vertex AI Searchへ登録したザッピング証跡を一次根拠として参照してください。",
                "参照対象は動画メタデータ、操作Journey、5秒ごとのスクリーンショット、Gemini全文文字起こし、文字起こし要約、操作ステップです。",
                "SourceAssetの生データだけで完結させず、Search Store上の文脈を検索して業務能力の境界を決めてください。",
              ].join("\n")
            : capability
              ? [
                  `${application.name} の ${capability.name} 配下に置くユーザーストーリー案を生成してください。`,
                  "操作動画から抽出してFileSpace/Vertex AI Searchへ登録したザッピング証跡を一次根拠として参照してください。",
                  "動画の全文文字起こし、要約、操作ステップ、スクリーンショット群を検索し、ユーザーの意図と業務文脈が分かるStory/Acceptance Criteriaにしてください。",
                ].join("\n")
              : [
                  `${application.name} の既存Capability群に紐づくユーザーストーリー案を生成してください。`,
                  "操作動画から抽出してFileSpace/Vertex AI Searchへ登録したザッピング証跡を一次根拠として参照してください。",
                  "動画の全文文字起こし、要約、操作ステップ、スクリーンショット群を検索し、Capabilityごとのユーザー目的に落とし込んでください。",
                ].join("\n"));

        const requestId = await createAdkInvokeRequest({
          organizationId: orgId,
          spaceId,
          input: buildAdkInvokeInput({
            mode: input.mode,
            sessionId: generationSessionId,
            organizationId: orgId,
            spaceId,
            userId: uid,
            prompt,
            responseId,
            model: defaultLlmModelSelectionForAdkMode(input.mode),
            fileSpaceId,
            workspaceId: application.id,
            history: [],
            modeState,
          }),
        });

        const startedSession: DecodedVibeControlGenerationSession = {
          ...generationSession,
          requestId,
          lastMessage: `${input.mode} RequestDocを発行しました`,
        };
        await this.persistGenerationSession(startedSession);
        this.lastRunLog.unshift(
          input.mode === "vibe_capability_structuring"
            ? `Capability ADK: ${application.name} の解析を開始`
            : `Story ADK: ${application.name} の生成を開始`
        );

        const stopWatch = watchAdkInvokeRequest({
          organizationId: orgId,
          spaceId,
          requestId,
          onUpdate: (
            status: RequestStatus,
            errorMessage?: string,
            output?: AdkInvokeOutput
          ) => {
            void this.updateGenerationSessionStatus({
              generationSessionId,
              requestId,
              status,
              errorMessage,
              output,
            });
            if (status === "completed" || status === "error") {
              stopWatch();
            }
          },
        });

        return requestId;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "VibeControl ADKの開始に失敗しました";
        const failedSession: DecodedVibeControlGenerationSession = {
          ...generationSession,
          status: "error",
          errorMessage: message,
          lastMessage: message,
        };
        await this.persistGenerationSession(failedSession);
        this.error = message;
        throw err;
      } finally {
        this.isGenerating = false;
      }
    },
    async updateZappingVideoAnalysisStatus(params: {
      videoId: string;
      requestId: string;
      status: RequestStatus;
      errorMessage?: string;
      output?: AdkInvokeOutput;
    }): Promise<void> {
      const video = this.operationVideos.find((item) => item.id === params.videoId);
      if (!video || video.analysisRequestId !== params.requestId) return;
      const nextStatus: DecodedVibeControlOperationVideo["analysisStatus"] =
        params.status === "completed"
          ? "completed"
          : params.status === "error"
            ? "error"
            : "running";
      void params.output;
      const completedSessionId =
        (params.output && typeof params.output === "object" && "sessionId" in params.output
          ? params.output.sessionId
          : undefined) || video.analysisSessionId;
      const analysisOrganizationId =
        video.analysisOrganizationId ||
        useOrganizationStore().loggedInOrganizationInfo?.id ||
        "";
      const analysisSpaceId =
        video.analysisSpaceId || useSpaceStore().selectedSpace?.id || "";
      const analysisResult =
        params.status === "completed" && completedSessionId
          ? await this.fetchZappingAnalysisResultFromSession({
              organizationId: analysisOrganizationId,
              spaceId: analysisSpaceId,
              sessionId: completedSessionId,
            })
          : undefined;
      const keyedAnalysisResult = analysisResult
        ? assignStoryKeysToZappingAnalysisResult({
            applicationId: video.applicationId,
            result: normalizeZappingAnalysisResultEvidence({
              result: analysisResult,
              video,
            }),
            stories: this.stories,
            operationVideos: this.operationVideos.filter(
              (item) => item.id !== video.id
            ),
          })
        : undefined;
      await this.persistOperationVideo({
        ...video,
        analysisStatus: nextStatus,
        analysisSessionId: completedSessionId || video.analysisSessionId,
        analysisOrganizationId,
        analysisSpaceId,
        analysisErrorMessage:
          params.status === "completed"
            ? keyedAnalysisResult
              ? ""
              : "ADKは完了しましたが、解析結果をsession stateから取得できませんでした"
            : params.errorMessage || "",
        analyzedAt: params.status === "completed" ? nowIso() : video.analyzedAt,
        analysisResult: keyedAnalysisResult ?? video.analysisResult,
        hasUnanalyzedClip:
          params.status === "completed" ? false : video.hasUnanalyzedClip,
        analysisStaleReason:
          params.status === "completed" ? undefined : video.analysisStaleReason,
      });
    },
    async updateRelatedContextAnalysisStatus(params: {
      videoId: string;
      requestId: string;
      sessionId: string;
      organizationId: string;
      spaceId: string;
      status: RequestStatus;
      errorMessage?: string;
      output?: AdkInvokeOutput;
    }): Promise<void> {
      const video = this.operationVideos.find((item) => item.id === params.videoId);
      if (!video) return;
      void params.requestId;
      const completedSessionId =
        (params.output && typeof params.output === "object" && "sessionId" in params.output
          ? params.output.sessionId
          : undefined) || params.sessionId;
      const outputResult = extractRelatedContextResultCandidate(params.output);
      const sessionResult =
        params.status === "completed" && completedSessionId && !outputResult
          ? await this.fetchRelatedContextResultFromSession({
              organizationId: params.organizationId,
              spaceId: params.spaceId,
              sessionId: completedSessionId,
            })
          : undefined;
      const result = outputResult ?? sessionResult;
      if (params.status !== "completed" && params.status !== "error") {
        return;
      }
      const message =
        params.status === "completed"
          ? result
            ? ""
            : "ADKは完了しましたが、関連コンテキスト結果をsession stateから取得できませんでした"
          : params.errorMessage || "関連コンテキスト取得に失敗しました";
      const nextGithub =
        result?.github && result.github.repoFullName.trim()
          ? result.github
          : result?.github
            ? {
                ...result.github,
                repoFullName:
                  video.relatedContexts?.github?.repoFullName ||
                  this.applications.find(
                    (application) => application.id === video.applicationId
                  )?.repoFullName ||
                  result.github.repoFullName,
              }
            : video.relatedContexts?.github;
      const nextSlack = result?.slack ?? video.relatedContexts?.slack;
      const nextKnowledge = result?.knowledge ?? video.relatedContexts?.knowledge;
      await this.persistOperationVideo({
        ...video,
        relatedContexts: {
          ...video.relatedContexts,
          generatedAt: result?.generatedAt ?? nowIso(),
          status: params.status === "completed" && result ? result.status : "error",
          runningProvider: undefined,
          notes: result?.notes ?? (message ? [message] : []),
          github: nextGithub,
          slack: nextSlack,
          knowledge: nextKnowledge,
        },
      });
    },
    async updateGenerationSessionStatus(params: {
      generationSessionId: string;
      requestId: string;
      status: RequestStatus;
      errorMessage?: string;
      output?: AdkInvokeOutput;
    }): Promise<void> {
      const session = this.generationSessions.find(
        (item) => item.id === params.generationSessionId
      );
      if (!session || session.requestId !== params.requestId) return;
      const artifactCount = params.output?.artifactCount ?? 0;
      const completedWithoutArtifact =
        params.status === "completed" &&
        (session.adkMode === "vibe_capability_structuring" ||
          session.adkMode === "vibe_story_generation") &&
        artifactCount === 0;
      const nextStatus: DecodedVibeControlGenerationSession["status"] =
        completedWithoutArtifact
          ? "error"
          : params.status === "completed"
          ? "waiting_user"
          : params.status === "error"
            ? "error"
            : "running";
      const noArtifactMessage =
        session.adkMode === "vibe_capability_structuring"
          ? "Capability構造案が生成されませんでした。SourceAsset / Evidence / Story を取り込んでから再実行してください"
          : "Story生成案が生成されませんでした。Capability と根拠データを確認してから再実行してください";
      const nextSession: DecodedVibeControlGenerationSession = {
        ...session,
        status: nextStatus,
        errorMessage: completedWithoutArtifact
          ? noArtifactMessage
          : params.errorMessage,
        lastMessage:
          completedWithoutArtifact
            ? noArtifactMessage
            : params.status === "completed"
            ? "ADKの構造案が生成されました。レビュー待ちです"
            : params.errorMessage || `RequestDoc status: ${params.status}`,
      };
      await this.persistGenerationSession(nextSession);
    },
    async persistCurrentSnapshot(): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        await Promise.all([
          ...this.applications.map((application) =>
            firestoreOps.createDocument({
              collectionName: this.applicationCollectionPath(),
              docId: application.id || `application_${createRandomDocId()}`,
              docData: application,
              converter: vibeControlApplicationConverter,
              merge: true,
            })
          ),
          ...this.stories.map((story) =>
            firestoreOps.createDocument({
              collectionName: this.storyCollectionPath(),
              docId: story.id || `story_${createRandomDocId()}`,
              docData: story,
              converter: vibeControlStoryConverter,
              merge: true,
            })
          ),
          ...this.evidence.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.evidenceCollectionPath(),
              docId: item.id || `evidence_${createRandomDocId()}`,
              docData: item,
              converter: vibeControlStoryEvidenceConverter,
              merge: true,
            })
          ),
          ...this.sourceConnections.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.sourceConnectionCollectionPath(),
              docId: item.id || `source_${createRandomDocId()}`,
              docData: item,
              converter: vibeControlSourceConnectionConverter,
              merge: true,
            })
          ),
          ...this.operationVideos.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.operationVideoCollectionPath(),
              docId: item.id || `operation_video_${createRandomDocId()}`,
              docData: item,
              converter: vibeControlOperationVideoConverter,
              merge: true,
            })
          ),
          ...this.capabilities.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.capabilityCollectionPath(),
              docId: item.id || `capability_${createRandomDocId()}`,
              docData: item,
              converter: vibeControlCapabilityConverter,
              merge: true,
            })
          ),
          ...this.sourceAssets.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.sourceAssetCollectionPath(),
              docId: item.id || `source_asset_${createRandomDocId()}`,
              docData: item,
              converter: vibeControlSourceAssetConverter,
              merge: true,
            })
          ),
          ...this.generationSessions.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.generationSessionCollectionPath(),
              docId: item.id || `generation_session_${createRandomDocId()}`,
              docData: item,
              converter: vibeControlGenerationSessionConverter,
              merge: true,
            })
          ),
          ...this.draftPatches.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.draftPatchCollectionPath(),
              docId: item.id || `draft_patch_${createRandomDocId()}`,
              docData: item,
              converter: vibeControlDraftPatchConverter,
              merge: true,
            })
          ),
        ]);
        this.lastRunLog.push("Firestore: 現在のSSOT snapshotを保存");
      } catch (err) {
        log("ERROR", "VibeControl persist failed", err);
        this.error = err instanceof Error ? err.message : "SSOT保存に失敗しました";
      } finally {
        this.isLoading = false;
      }
    },
    buildOperationVideoMarkdown(params: {
      application: DecodedVibeControlApplication;
      videoId: string;
      title: string;
      description?: string;
      bucketName: string;
      storagePath: string;
      contentType: string;
      sizeBytes: number;
      durationMs?: number;
      recordedAt: string;
      sourceDisplaySurface?: VibeControlOperationVideoDisplaySurface;
      tags?: string[];
      transcriptText?: string;
      transcriptProvider?: string;
      transcriptSummary?: string;
      transcriptSegments?: VibeControlTranscriptCue[];
      transcriptSrt?: string;
      transcriptTimingStatus?: VibeControlTranscriptTimingStatus;
      quickScan?: VibeControlOperationVideoSaveInput["quickScan"];
      frameCaptures?: NonNullable<
        DecodedVibeControlOperationVideo["frameCaptures"]
      >;
    }): string {
      return buildOperationVideoMetadataMarkdown(params);
    },
    async uploadOperationVideoClip(params: {
      application: DecodedVibeControlApplication;
      group: DecodedVibeControlOperationVideoGroup;
      videoId: string;
      input: VibeControlOperationVideoSaveInput;
      title: string;
      description?: string;
      organizationId: string;
      spaceId: string;
      clipIndex: number;
    }): Promise<{
      clip: VibeControlOperationVideoClip;
      sourceAssets: DecodedVibeControlSourceAsset[];
      discoveryStatus: DecodedVibeControlOperationVideo["discoveryStatus"];
      discoveryErrorMessage?: string;
    }> {
      const { application, group, videoId, input, title } = params;
      const fileSpaceId = application.fileSpaceId?.trim();
      const contextStore = useContextStore();
      const storageOps = useFirebaseStorageOperations();
      const config = useRuntimeConfig();
      const bucketName = resolveStorageBucketName(
        config.public.firebase.storageBucket
      );
      const now = nowIso();
      const clipId = `clip-${String(params.clipIndex + 1).padStart(3, "0")}`;
      const safeTitle = toDocId(title, "operation-video");
      const timestamp = now.replace(/[:.]/g, "-");
      const contentType = input.contentType || input.blob.type || "video/webm";
      const tags =
        input.tags
          ?.map((tag) => tag.trim())
          .filter((tag, index, arr) => tag && arr.indexOf(tag) === index) ?? [];
      const transcriptText = input.transcriptText?.trim() || undefined;
      const transcriptProvider = input.transcriptProvider?.trim() || undefined;
      const transcriptSummary = input.transcriptSummary?.trim() || undefined;
      const transcriptSegments = input.transcriptSegments ?? [];
      const transcriptSrt = input.transcriptSrt?.trim() || undefined;
      const transcriptTimingStatus: VibeControlTranscriptTimingStatus =
        input.transcriptTimingStatus === "timestamped" &&
        transcriptSegments.length > 0 &&
        Boolean(transcriptSrt)
          ? "timestamped"
          : "unavailable";
      const quickScan = input.quickScan;
      const requestErrors: string[] = [];
      const extension = contentType.includes("mp4") ? "mp4" : "webm";
      const fileName = `${safeTitle}-${timestamp}.${extension}`;
      const storagePath = contextStore.baseGcsPath(
        `vibeControl/applications/${application.id}/operationVideos/${videoId}/clips/${clipId}/${fileName}`
      );

      const uploaded = await storageOps.uploadPdfFile({
        bucketName,
        filePath: storagePath,
        rawData: input.blob,
        mimeType: contentType,
      });
      if (!uploaded) {
        throw new Error("ザッピング動画のFirebase Storage保存に失敗しました");
      }

      const frameCaptures: NonNullable<
        DecodedVibeControlOperationVideo["frameCaptures"]
      > = [];
      for (const [index, frame] of (input.frameCaptures ?? []).entries()) {
        if (frame.blob.size <= 0) continue;
        const frameId = `frame-${String(index + 1).padStart(3, "0")}`;
        const frameContentType = frame.contentType || frame.blob.type || "image/jpeg";
        const frameFileName = `${safeTitle}-${timestamp}-${clipId}-${frameId}.jpg`;
        const frameStoragePath = contextStore.baseGcsPath(
          `vibeControl/applications/${application.id}/operationVideos/${videoId}/clips/${clipId}/frames/${frameFileName}`
        );
        const frameUploaded = await storageOps.uploadPdfFile({
          bucketName,
          filePath: frameStoragePath,
          rawData: frame.blob,
          mimeType: frameContentType,
        });
        if (!frameUploaded) {
          requestErrors.push(`${clipId}/${frameId} のスクリーンショット保存に失敗しました`);
          continue;
        }
        frameCaptures.push({
          id: frameId,
          timestampMs: Math.max(0, Math.round(frame.timestampMs)),
          fileName: frameFileName,
          bucketName,
          storagePath: frameStoragePath,
          contentType: frameContentType,
          width: frame.width,
          height: frame.height,
        });
      }

      const metadataFileName =
        params.clipIndex === 0
          ? `${safeTitle}-${timestamp}.md`
          : `${safeTitle}-${timestamp}-${clipId}.md`;
      const metadataMarkdown = this.buildOperationVideoMarkdown({
        application,
        videoId,
        title,
        description: params.description,
        bucketName,
        storagePath,
        contentType,
        sizeBytes: input.blob.size,
        durationMs: input.durationMs,
        recordedAt: now,
        sourceDisplaySurface: input.sourceDisplaySurface,
        tags,
        transcriptText,
        transcriptProvider,
        transcriptSummary,
          transcriptSegments,
          transcriptSrt,
          transcriptTimingStatus,
        quickScan,
        frameCaptures,
      });
      const journeyFileName =
        params.clipIndex === 0
          ? `${safeTitle}-${timestamp}-journey.md`
          : `${safeTitle}-${timestamp}-${clipId}-journey.md`;
      const journeyMarkdown = buildOperationVideoJourneyMarkdown({
        application,
        videoId,
        title,
        description: params.description,
        bucketName,
        storagePath,
        contentType,
        sizeBytes: input.blob.size,
        durationMs: input.durationMs,
        recordedAt: now,
        sourceDisplaySurface: input.sourceDisplaySurface,
        tags,
        transcriptText,
        transcriptProvider,
        transcriptSummary,
        transcriptSegments,
        transcriptSrt,
        transcriptTimingStatus,
        quickScan,
        frameCaptures,
      });

      let fileSpaceRequestId: string | undefined;
      let journeyFileSpaceRequestId: string | undefined;
      let metadataStoragePath: string | undefined;
      let journeyStoragePath: string | undefined;
      const sourceAssetId =
        params.clipIndex === 0
          ? `source-asset-${videoId}`
          : `source-asset-${videoId}-${clipId}`;
      const journeySourceAssetId =
        params.clipIndex === 0
          ? `source-asset-${videoId}-journey`
          : `source-asset-${videoId}-${clipId}-journey`;

      if (fileSpaceId) {
        metadataStoragePath = contextStore.baseGcsPath(
          manualUploadRelativePath({ fileSpaceId, fileName: metadataFileName })
        );
        journeyStoragePath = contextStore.baseGcsPath(
          manualUploadRelativePath({ fileSpaceId, fileName: journeyFileName })
        );

        const metadataUploaded = await storageOps.uploadPdfFile({
          bucketName,
          filePath: metadataStoragePath,
          rawData: new Blob([metadataMarkdown], { type: "text/markdown" }),
          mimeType: "text/markdown",
        });

        if (metadataUploaded) {
          const requestDoc =
            await useGeminiFileSpaceOperatorStore().createFileSpaceRequest({
              operationType: "fileSpaceUpload",
              storeId: fileSpaceId,
              bucketName,
              filePath: metadataStoragePath,
              mimeType: "text/markdown",
              documentId:
                params.clipIndex === 0
                  ? `vibecontrol-operation-video-${videoId}`
                  : `vibecontrol-operation-video-${videoId}-${clipId}`,
              description: `VibeControl operation video metadata: ${title}`,
              customMetadata: [
                { key: "source", value: "vibe-control-operation-video" },
                { key: "applicationId", value: application.id },
                { key: "applicationKey", value: application.applicationKey },
                { key: "operationVideoId", value: videoId },
                { key: "operationVideoClipId", value: clipId },
                { key: "operationVideoGroupId", value: group.id },
                { key: "operationVideoGroupName", value: group.name },
                { key: "sourceAssetId", value: sourceAssetId },
                { key: "videoStoragePath", value: storagePath },
                { key: "documentKind", value: "operation_video_metadata" },
              ],
              originalFileInfo: {
                fileName: metadataFileName,
                bytes: new Blob([metadataMarkdown]).size,
              },
              organizationId: params.organizationId,
              spaceId: params.spaceId,
            });
          if (requestDoc?.id) {
            fileSpaceRequestId = requestDoc.id;
          } else {
            requestErrors.push("動画メタデータのFileSpace upload RequestDoc作成に失敗しました");
          }
        } else {
          requestErrors.push("検索用メタデータMarkdownの保存に失敗しました");
        }

        const journeyUploaded = await storageOps.uploadPdfFile({
          bucketName,
          filePath: journeyStoragePath,
          rawData: new Blob([journeyMarkdown], { type: "text/markdown" }),
          mimeType: "text/markdown",
        });

        if (journeyUploaded) {
          const requestDoc =
            await useGeminiFileSpaceOperatorStore().createFileSpaceRequest({
              operationType: "fileSpaceUpload",
              storeId: fileSpaceId,
              bucketName,
              filePath: journeyStoragePath,
              mimeType: "text/markdown",
              documentId:
                params.clipIndex === 0
                  ? `vibecontrol-operation-video-journey-${videoId}`
                  : `vibecontrol-operation-video-journey-${videoId}-${clipId}`,
              description: `VibeControl operation journey evidence: ${title}`,
              customMetadata: [
                { key: "source", value: "vibe-control-operation-video-journey" },
                { key: "applicationId", value: application.id },
                { key: "applicationKey", value: application.applicationKey },
                { key: "applicationName", value: application.name },
                { key: "repoFullName", value: application.repoFullName },
                { key: "operationVideoId", value: videoId },
                { key: "operationVideoClipId", value: clipId },
                { key: "operationVideoGroupId", value: group.id },
                { key: "operationVideoGroupName", value: group.name },
                { key: "sourceAssetId", value: journeySourceAssetId },
                { key: "videoStoragePath", value: storagePath },
                { key: "documentKind", value: "operation_video_journey" },
              ],
              originalFileInfo: {
                fileName: journeyFileName,
                bytes: new Blob([journeyMarkdown]).size,
              },
              organizationId: params.organizationId,
              spaceId: params.spaceId,
            });
          if (requestDoc?.id) {
            journeyFileSpaceRequestId = requestDoc.id;
          } else {
            requestErrors.push("操作JourneyのFileSpace upload RequestDoc作成に失敗しました");
          }
        } else {
          requestErrors.push("操作Journey Markdownの保存に失敗しました");
        }
      }

      const discoveryStatus: DecodedVibeControlOperationVideo["discoveryStatus"] =
        fileSpaceId
          ? fileSpaceRequestId || journeyFileSpaceRequestId
            ? "queued"
            : "error"
          : "not_registered";
      const discoveryErrorMessage =
        requestErrors.length > 0
          ? requestErrors.join(" / ")
          : fileSpaceId
            ? undefined
            : "アプリ専用FileSpaceが未設定のため、動画のみ保存しました";

      const clip: VibeControlOperationVideoClip = {
        id: clipId,
        fileName,
        bucketName,
        storagePath,
        contentType,
        sizeBytes: input.blob.size,
        durationMs: input.durationMs,
        transcriptText,
        transcriptProvider,
        transcriptSummary,
        transcriptSegments,
        transcriptSrt,
        transcriptTimingStatus,
        quickScan,
        frameCaptures,
        metadataFileName,
        metadataStoragePath,
        journeyFileName,
        journeyStoragePath,
        fileSpaceRequestId,
        journeyFileSpaceRequestId,
        sourceAssetId,
        journeySourceAssetId,
        sourceDisplaySurface: input.sourceDisplaySurface ?? "unknown",
        recordedAt: now,
      };

      const sourceAssets: DecodedVibeControlSourceAsset[] = [
        {
          id: sourceAssetId,
          applicationId: application.id,
          applicationKey: application.applicationKey,
          sourceType: "operation_video",
          title,
          summary: params.description,
          uri: `gs://${bucketName}/${storagePath}`,
          gcsPath: `gs://${bucketName}/${storagePath}`,
          storagePath,
          fileSpaceId: fileSpaceId || undefined,
          fileSpaceRequestId,
          discoveryStatus: fileSpaceId
            ? fileSpaceRequestId
              ? "queued"
              : "error"
            : "not_registered",
          discoveryDocumentId:
            params.clipIndex === 0
              ? `vibecontrol-operation-video-${videoId}`
              : `vibecontrol-operation-video-${videoId}-${clipId}`,
          discoveryErrorMessage: !fileSpaceId
            ? "アプリ専用FileSpaceが未設定のため、Discovery Engine登録は未実行です"
            : fileSpaceRequestId
              ? undefined
              : "動画メタデータのDiscovery Engine登録に失敗しました",
          metadata: {
            operationVideoId: videoId,
            operationVideoClipId: clipId,
            contentType,
            sizeBytes: input.blob.size,
            durationMs: input.durationMs,
            transcriptProvider,
            transcriptText,
            transcriptSummary,
            transcriptSegments,
            transcriptSrt,
            transcriptTimingStatus,
            quickScan,
            frameCaptures,
            tags,
            metadataStoragePath,
            sourceDisplaySurface: input.sourceDisplaySurface ?? "unknown",
            operationVideoGroupId: group.id,
            operationVideoGroupName: group.name,
          },
        },
      ];

      if (journeyStoragePath) {
        sourceAssets.push({
          id: journeySourceAssetId,
          applicationId: application.id,
          applicationKey: application.applicationKey,
          sourceType: "operation_video_journey",
          title: `Operation Journey: ${title}`,
          summary:
            params.description ||
            "ザッピング動画から生成したユーザージャーニー検索用証跡",
          uri: `gs://${bucketName}/${journeyStoragePath}`,
          gcsPath: `gs://${bucketName}/${journeyStoragePath}`,
          storagePath: journeyStoragePath,
          fileSpaceId: fileSpaceId || undefined,
          fileSpaceRequestId: journeyFileSpaceRequestId,
          discoveryStatus: journeyFileSpaceRequestId ? "queued" : "error",
          discoveryDocumentId:
            params.clipIndex === 0
              ? `vibecontrol-operation-video-journey-${videoId}`
              : `vibecontrol-operation-video-journey-${videoId}-${clipId}`,
          discoveryErrorMessage: journeyFileSpaceRequestId
            ? undefined
            : "操作JourneyのDiscovery Engine登録に失敗しました",
          metadata: {
            operationVideoId: videoId,
            operationVideoClipId: clipId,
            videoStoragePath: storagePath,
            transcriptProvider,
            transcriptText,
            transcriptSummary,
            transcriptSegments,
            transcriptSrt,
            transcriptTimingStatus,
            tags,
            sourceDisplaySurface: input.sourceDisplaySurface ?? "unknown",
            operationVideoGroupId: group.id,
            operationVideoGroupName: group.name,
          },
        });
      }

      return { clip, sourceAssets, discoveryStatus, discoveryErrorMessage };
    },
    async saveOperationVideoCapture(
      input: VibeControlOperationVideoSaveInput
    ): Promise<DecodedVibeControlOperationVideo> {
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const fileSpaceId = application.fileSpaceId?.trim();

      const organizationStore = useOrganizationStore();
      const spaceStore = useSpaceStore();
      const organizationId = organizationStore.getLoggedInOrganizationId;
      const spaceId = spaceStore.selectedSpace?.id ?? "";
      if (!organizationId || !spaceId) {
        throw new Error("組織・スペースを確認してください");
      }

      const title = input.title.trim();
      if (!title) {
        throw new Error("動画タイトルを入力してください");
      }
      const group = this.operationVideoGroups.find(
        (item) =>
          item.id === input.groupId &&
          item.applicationId === application.id
      );
      if (!group) {
        throw new Error("動画グループを選択してください");
      }
      if (input.blob.size <= 0) {
        throw new Error("録画データが空です");
      }

      this.isSavingOperationVideo = true;
      this.error = null;

      try {
        {
        const videoId = `operation-video-${createRandomDocId()}`;
        const description = input.description?.trim() || undefined;
        const { clip, sourceAssets, discoveryStatus, discoveryErrorMessage } =
          await this.uploadOperationVideoClip({
            application,
            group,
            videoId,
            input,
            title,
            description,
            organizationId,
            spaceId,
            clipIndex: 0,
          });
        const video = normalizeOperationVideo({
          id: videoId,
          applicationId: application.id,
          applicationKey: application.applicationKey,
          groupId: group.id,
          groupNameSnapshot: group.name,
          title,
          description,
          fileName: clip.fileName,
          bucketName: clip.bucketName,
          storagePath: clip.storagePath,
          contentType: clip.contentType,
          sizeBytes: clip.sizeBytes,
          durationMs: clip.durationMs,
          transcriptText: clip.transcriptText,
          transcriptProvider: clip.transcriptProvider,
          transcriptSummary: clip.transcriptSummary,
          transcriptSegments: clip.transcriptSegments,
          transcriptSrt: clip.transcriptSrt,
          transcriptTimingStatus: clip.transcriptTimingStatus,
          quickScan: clip.quickScan,
          frameCaptures: clip.frameCaptures,
          clips: [clip],
          clipCount: 1,
          totalDurationMs: clip.durationMs,
          hasUnanalyzedClip: false,
          lastClipAddedAt: clip.recordedAt,
          tags:
            input.tags
              ?.map((tag) => tag.trim())
              .filter((tag, index, arr) => tag && arr.indexOf(tag) === index) ?? [],
          fileSpaceId,
          fileSpaceRequestId: clip.fileSpaceRequestId,
          metadataFileName: clip.metadataFileName,
          metadataStoragePath: clip.metadataStoragePath,
          journeyFileName: clip.journeyFileName,
          journeyStoragePath: clip.journeyStoragePath,
          journeyFileSpaceRequestId: clip.journeyFileSpaceRequestId,
          sourceAssetId: clip.sourceAssetId,
          journeySourceAssetId: clip.journeySourceAssetId,
          discoveryStatus,
          discoveryErrorMessage,
          analysisStatus: "not_analyzed",
          sourceDisplaySurface: clip.sourceDisplaySurface,
          recordedAt: clip.recordedAt,
        });
        const nextGroup: DecodedVibeControlOperationVideoGroup = {
          ...group,
          videoCount: this.operationVideos.filter(
            (item) => item.groupId === group.id && item.id !== video.id
          ).length + 1,
        };
        const firestoreOps = useFirestoreDocOperation();
        await Promise.all([
          firestoreOps.createDocument({
            collectionName: this.operationVideoCollectionPath(),
            docId: video.id,
            docData: video,
            converter: vibeControlOperationVideoConverter,
            merge: true,
          }),
          firestoreOps.createDocument({
            collectionName: this.operationVideoGroupCollectionPath(),
            docId: nextGroup.id,
            docData: nextGroup,
            converter: vibeControlOperationVideoGroupConverter,
            merge: true,
          }),
          ...sourceAssets.map((asset) =>
            firestoreOps.createDocument({
              collectionName: this.sourceAssetCollectionPath(),
              docId: asset.id,
              docData: asset,
              converter: vibeControlSourceAssetConverter,
              merge: true,
            })
          ),
        ]);
        this.operationVideos = [
          video,
          ...this.operationVideos.filter((item) => item.id !== video.id),
        ];
        this.operationVideoGroups = this.operationVideoGroups.map((item) =>
          item.id === nextGroup.id ? nextGroup : item
        );
        this.sourceAssets = [
          ...sourceAssets,
          ...this.sourceAssets.filter(
            (item) => !sourceAssets.some((asset) => asset.id === item.id)
          ),
        ];
        this.lastRunLog.unshift(
          `Operation Video: ${application.name} に ${title} を保存`
        );
        return video;
        }
      } catch (err) {
        log("ERROR", "VibeControl operation video save failed", err);
        reportDatadogError(err, {
          feature: "vibe_control_zapping_video_save",
          applicationId: input.applicationId,
          blobSize: input.blob.size,
          contentType: input.contentType || input.blob.type || "video/webm",
        });
        this.error =
          err instanceof Error ? err.message : "ザッピング動画の保存に失敗しました";
        throw err;
      } finally {
        this.isSavingOperationVideo = false;
      }
    },
    async appendOperationVideoClip(
      input: VibeControlOperationVideoAppendInput
    ): Promise<DecodedVibeControlOperationVideo> {
      const targetVideo = this.operationVideos.find(
        (item) => item.id === input.videoId && item.applicationId === input.applicationId
      );
      if (!targetVideo) {
        throw new Error("追加先の操作セットが見つかりません");
      }
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const group = this.operationVideoGroups.find(
        (item) =>
          item.id === (targetVideo.groupId || input.groupId) &&
          item.applicationId === application.id
      );
      if (!group) {
        throw new Error("動画グループを選択してください");
      }
      if (input.blob.size <= 0) {
        throw new Error("録画データが空です");
      }

      const organizationStore = useOrganizationStore();
      const spaceStore = useSpaceStore();
      const organizationId = organizationStore.getLoggedInOrganizationId;
      const spaceId = spaceStore.selectedSpace?.id ?? "";
      if (!organizationId || !spaceId) {
        throw new Error("組織・スペースを確認してください");
      }

      const normalizedVideo = normalizeOperationVideo(targetVideo);
      const title = input.title.trim() || normalizedVideo.title;
      const description =
        input.description?.trim() || normalizedVideo.description || undefined;
      this.isSavingOperationVideo = true;
      this.error = null;
      try {
        const { clip, sourceAssets, discoveryStatus, discoveryErrorMessage } =
          await this.uploadOperationVideoClip({
            application,
            group,
            videoId: normalizedVideo.id,
            input,
            title,
            description,
            organizationId,
            spaceId,
            clipIndex: normalizedVideo.clips.length,
          });
        const clips = [...normalizedVideo.clips, clip].sort((a, b) =>
          (a.recordedAt || "").localeCompare(b.recordedAt || "")
        );
        const existingError = normalizedVideo.discoveryErrorMessage?.trim();
        const nextVideo = normalizeOperationVideo({
          ...normalizedVideo,
          clips,
          fileSpaceId: application.fileSpaceId?.trim() || normalizedVideo.fileSpaceId,
          discoveryStatus:
            discoveryStatus === "error" || normalizedVideo.discoveryStatus === "error"
              ? "error"
              : discoveryStatus === "queued" || normalizedVideo.discoveryStatus === "queued"
                ? "queued"
                : normalizedVideo.discoveryStatus,
          discoveryErrorMessage: [existingError, discoveryErrorMessage]
            .filter(Boolean)
            .join(" / ") || undefined,
          hasUnanalyzedClip: true,
          lastClipAddedAt: clip.recordedAt,
          analysisStaleReason:
            "追加された動画があります。再解析すると最新の操作セットに反映されます。",
        });
        const firestoreOps = useFirestoreDocOperation();
        await Promise.all([
          firestoreOps.createDocument({
            collectionName: this.operationVideoCollectionPath(),
            docId: nextVideo.id,
            docData: nextVideo,
            converter: vibeControlOperationVideoConverter,
            merge: true,
          }),
          ...sourceAssets.map((asset) =>
            firestoreOps.createDocument({
              collectionName: this.sourceAssetCollectionPath(),
              docId: asset.id,
              docData: asset,
              converter: vibeControlSourceAssetConverter,
              merge: true,
            })
          ),
        ]);
        this.operationVideos = this.operationVideos.map((item) =>
          item.id === nextVideo.id ? nextVideo : item
        );
        this.sourceAssets = [
          ...sourceAssets,
          ...this.sourceAssets.filter(
            (item) => !sourceAssets.some((asset) => asset.id === item.id)
          ),
        ];
        this.lastRunLog.unshift(
          `Operation Video: ${normalizedVideo.title} にクリップを追加`
        );
        return nextVideo;
      } catch (err) {
        log("ERROR", "VibeControl operation video clip append failed", err);
        reportDatadogError(err, {
          feature: "vibe_control_zapping_video_clip_append",
          applicationId: input.applicationId,
          videoId: input.videoId,
          blobSize: input.blob.size,
          contentType: input.contentType || input.blob.type || "video/webm",
        });
        this.error =
          err instanceof Error ? err.message : "動画クリップの追加に失敗しました";
        throw err;
      } finally {
        this.isSavingOperationVideo = false;
      }
    },
    async updateOperationVideoClipAnalysis(
      input: VibeControlOperationVideoClipAnalysisInput
    ): Promise<DecodedVibeControlOperationVideo> {
      const video = this.operationVideos.find((item) => item.id === input.videoId);
      if (!video) {
        throw new Error("更新対象のザッピング動画が見つかりません");
      }
      const application = this.applications.find(
        (item) => item.id === video.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      if (
        input.transcriptTimingStatus !== "timestamped" ||
        input.transcriptSegments.length === 0 ||
        !input.transcriptSrt.trim()
      ) {
        throw new Error("動画解析にはGeminiのタイムスタンプ付き文字起こしが必要です");
      }

      const normalizedVideo = normalizeOperationVideo(video);
      const targetClipId = input.clipId || normalizedVideo.clips[0]?.id || "clip-001";
      const targetClip = normalizedVideo.clips.find((clip) => clip.id === targetClipId);
      if (!targetClip) {
        throw new Error("更新対象の動画クリップが見つかりません");
      }

      this.isSavingOperationVideo = true;
      this.error = null;
      try {
        const contextStore = useContextStore();
        const storageOps = useFirebaseStorageOperations();
        const bucketName = targetClip.bucketName || resolveStorageBucketName(
          useRuntimeConfig().public.firebase.storageBucket
        );
        const safeTitle = toDocId(input.title || normalizedVideo.title, "operation-video");
        const timestamp = nowIso().replace(/[:.]/g, "-");
        const frameCaptures: NonNullable<
          DecodedVibeControlOperationVideo["frameCaptures"]
        > = [];

        for (const [index, frame] of input.frameCaptures.entries()) {
          if (frame.blob.size <= 0) continue;
          const frameId = `frame-${String(index + 1).padStart(3, "0")}`;
          const frameContentType = frame.contentType || frame.blob.type || "image/jpeg";
          const frameFileName = `${safeTitle}-${timestamp}-${targetClipId}-${frameId}.jpg`;
          const frameStoragePath = contextStore.baseGcsPath(
            `vibeControl/applications/${application.id}/operationVideos/${normalizedVideo.id}/clips/${targetClipId}/frames/${frameFileName}`
          );
          const uploaded = await storageOps.uploadPdfFile({
            bucketName,
            filePath: frameStoragePath,
            rawData: frame.blob,
            mimeType: frameContentType,
          });
          if (!uploaded) continue;
          frameCaptures.push({
            id: frameId,
            timestampMs: Math.max(0, Math.round(frame.timestampMs)),
            fileName: frameFileName,
            bucketName,
            storagePath: frameStoragePath,
            contentType: frameContentType,
            width: frame.width,
            height: frame.height,
          });
        }

        const nextClips = normalizedVideo.clips.map((clip) =>
          clip.id === targetClipId
            ? {
                ...clip,
                transcriptText: input.transcriptText.trim() || undefined,
                transcriptProvider: input.transcriptProvider?.trim() || undefined,
                transcriptSummary: input.transcriptSummary?.trim() || undefined,
                transcriptSegments: input.transcriptSegments,
                transcriptSrt: input.transcriptSrt.trim(),
                transcriptTimingStatus: "timestamped" as const,
                quickScan: input.quickScan,
                frameCaptures,
              }
            : clip
        );
        const nextVideo = normalizeOperationVideo({
          ...normalizedVideo,
          title:
            input.title?.trim() ||
            input.quickScan?.title?.trim() ||
            normalizedVideo.title,
          description:
            input.description?.trim() ||
            input.quickScan?.description?.trim() ||
            normalizedVideo.description,
          clips: nextClips,
          hasUnanalyzedClip: false,
          analysisStaleReason: undefined,
          analysisStatus: "not_analyzed",
          analysisErrorMessage: undefined,
          analysisResult: undefined,
        });

        const firestoreOps = useFirestoreDocOperation();
        await firestoreOps.createDocument({
          collectionName: this.operationVideoCollectionPath(),
          docId: nextVideo.id,
          docData: nextVideo,
          converter: vibeControlOperationVideoConverter,
          merge: true,
        });
        this.operationVideos = this.operationVideos.map((item) =>
          item.id === nextVideo.id ? nextVideo : item
        );
        this.lastRunLog.unshift(
          `Operation Video: ${nextVideo.title} の動画解析結果を保存`
        );
        return nextVideo;
      } catch (err) {
        log("ERROR", "VibeControl operation video analysis update failed", err);
        reportDatadogError(err, {
          feature: "vibe_control_zapping_video_analysis_update",
          applicationId: video.applicationId,
          videoId: video.id,
        });
        this.error =
          err instanceof Error ? err.message : "動画解析結果の保存に失敗しました";
        throw err;
      } finally {
        this.isSavingOperationVideo = false;
      }
    },
    async updateOperationVideoTitle(params: {
      videoId: string;
      title: string;
    }): Promise<void> {
      const video = this.operationVideos.find((item) => item.id === params.videoId);
      if (!video) {
        throw new Error("更新対象のザッピング動画が見つかりません");
      }
      const title = params.title.trim();
      if (!title) {
        throw new Error("動画タイトルを入力してください");
      }
      if (title === video.title) return;

      this.isLoading = true;
      this.error = null;
      try {
        const nextVideo: DecodedVibeControlOperationVideo = {
          ...video,
          title,
        };
        const sourceAssetIds = operationVideoSourceAssetIds(video);
        const nextSourceAssets = this.sourceAssets.map((asset) => {
          if (!sourceAssetIds.includes(asset.id)) return asset;
          if (asset.id === video.journeySourceAssetId || asset.id === `source-asset-${video.id}-journey`) {
            return {
              ...asset,
              title: `Operation Journey: ${title}`,
            };
          }
          return {
            ...asset,
            title,
          };
        });

        const firestoreOps = useFirestoreDocOperation();
        await Promise.all([
          firestoreOps.createDocument({
            collectionName: this.operationVideoCollectionPath(),
            docId: nextVideo.id,
            docData: nextVideo,
            converter: vibeControlOperationVideoConverter,
            merge: true,
          }),
          ...nextSourceAssets
            .filter((asset) => sourceAssetIds.includes(asset.id))
            .map((asset) =>
              firestoreOps.createDocument({
                collectionName: this.sourceAssetCollectionPath(),
                docId: asset.id,
                docData: asset,
                converter: vibeControlSourceAssetConverter,
                merge: true,
              })
            ),
        ]);

        this.operationVideos = this.operationVideos.map((item) =>
          item.id === nextVideo.id ? nextVideo : item
        );
        this.sourceAssets = nextSourceAssets;
        this.lastRunLog.unshift(`Operation Video: ${video.title} を ${title} に変更`);
      } catch (err) {
        log("ERROR", "VibeControl operation video title update failed", err);
        reportDatadogError(err, {
          feature: "vibe_control_zapping_video_title_update",
          videoId: params.videoId,
          applicationId: video.applicationId,
        });
        this.error =
          err instanceof Error ? err.message : "ザッピング動画タイトルの更新に失敗しました";
        throw err;
      } finally {
        this.isLoading = false;
      }
    },
    async deleteOperationVideoClip(params: {
      videoId: string;
      clipId: string;
    }): Promise<void> {
      const video = this.operationVideos.find((item) => item.id === params.videoId);
      if (!video) {
        throw new Error("削除対象のザッピング動画が見つかりません");
      }
      const normalizedVideo = normalizeOperationVideo(video);
      if (normalizedVideo.clips.length <= 1) {
        throw new Error("最後のクリップは動画全体の削除から実行してください");
      }
      const targetClip = normalizedVideo.clips.find((clip) => clip.id === params.clipId);
      if (!targetClip) {
        throw new Error("削除対象の動画クリップが見つかりません");
      }

      this.isLoading = true;
      this.error = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        const storageTargets = [
          {
            bucketName: targetClip.bucketName,
            storagePath: targetClip.storagePath,
          },
          ...targetClip.frameCaptures.map((frame) => ({
            bucketName: frame.bucketName,
            storagePath: frame.storagePath,
          })),
          targetClip.metadataStoragePath
            ? {
                bucketName: targetClip.bucketName,
                storagePath: targetClip.metadataStoragePath,
              }
            : undefined,
          targetClip.journeyStoragePath
            ? {
                bucketName: targetClip.bucketName,
                storagePath: targetClip.journeyStoragePath,
              }
            : undefined,
        ].filter(
          (
            target
          ): target is { bucketName: string; storagePath: string } =>
            Boolean(target?.bucketName && target.storagePath)
        );

        await Promise.all(
          storageTargets.map(async (target) => {
            try {
              await deleteObject(
                storageRefForBucketPath({
                  bucketName: target.bucketName,
                  filePath: target.storagePath,
                })
              );
            } catch (err) {
              const code =
                typeof err === "object" && err !== null && "code" in err
                  ? String((err as { code?: unknown }).code)
                  : "";
              if (code !== "storage/object-not-found") {
                log("WARN", "Operation video clip storage delete skipped", {
                  videoId: params.videoId,
                  clipId: params.clipId,
                  storagePath: target.storagePath,
                  err,
                });
              }
            }
          })
        );

        const nextVideo = normalizeOperationVideo({
          ...normalizedVideo,
          clips: normalizedVideo.clips.filter((clip) => clip.id !== targetClip.id),
          analysisStatus: "not_analyzed",
          analysisRequestId: undefined,
          analysisSessionId: undefined,
          analysisOrganizationId: undefined,
          analysisSpaceId: undefined,
          analysisErrorMessage: undefined,
          analyzedAt: undefined,
          analysisResult: undefined,
          hasUnanalyzedClip: true,
          analysisStaleReason:
            "動画クリップが削除されました。再解析すると最新の操作セットに反映されます。",
        });
        await firestoreOps.createDocument({
          collectionName: this.operationVideoCollectionPath(),
          docId: nextVideo.id,
          docData: nextVideo,
          converter: vibeControlOperationVideoConverter,
          merge: true,
        });

        const sourceAssetIds = [
          targetClip.sourceAssetId,
          targetClip.journeySourceAssetId,
        ].filter((id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index);
        await Promise.all(
          sourceAssetIds.map((assetId) =>
            firestoreOps.deleteDocument({
              collectionName: this.sourceAssetCollectionPath(),
              docId: assetId,
            })
          )
        );

        this.operationVideos = this.operationVideos.map((item) =>
          item.id === nextVideo.id ? nextVideo : item
        );
        this.sourceAssets = this.sourceAssets.filter(
          (asset) => !sourceAssetIds.includes(asset.id)
        );
        this.lastRunLog.unshift(
          `Operation Video: ${video.title} からクリップ ${targetClip.fileName} を削除`
        );
      } catch (err) {
        log("ERROR", "VibeControl operation video clip delete failed", err);
        reportDatadogError(err, {
          feature: "vibe_control_zapping_video_clip_delete",
          videoId: params.videoId,
          clipId: params.clipId,
          applicationId: video.applicationId,
        });
        this.error =
          err instanceof Error ? err.message : "動画クリップの削除に失敗しました";
        throw err;
      } finally {
        this.isLoading = false;
      }
    },
    async deleteOperationVideo(videoId: string): Promise<void> {
      const video = this.operationVideos.find((item) => item.id === videoId);
      if (!video) {
        throw new Error("削除対象のザッピング動画が見つかりません");
      }
      this.isLoading = true;
      this.error = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        const normalizedVideo = normalizeOperationVideo(video);
        const sourceAssetIds = operationVideoSourceAssetIds(normalizedVideo);

        const storageTargets = [
          ...normalizedVideo.clips.flatMap((clip) => [
            {
              bucketName: clip.bucketName,
              storagePath: clip.storagePath,
            },
            ...clip.frameCaptures.map((frame) => ({
              bucketName: frame.bucketName,
              storagePath: frame.storagePath,
            })),
            clip.metadataStoragePath
              ? {
                  bucketName: clip.bucketName,
                  storagePath: clip.metadataStoragePath,
                }
              : undefined,
            clip.journeyStoragePath
              ? {
                  bucketName: clip.bucketName,
                  storagePath: clip.journeyStoragePath,
                }
              : undefined,
          ]),
        ].filter(
          (
            target
          ): target is { bucketName: string; storagePath: string } =>
            Boolean(target?.bucketName && target.storagePath)
        );

        await Promise.all(
          storageTargets.map(async (target) => {
            try {
              await deleteObject(
                storageRefForBucketPath({
                  bucketName: target.bucketName,
                  filePath: target.storagePath,
                })
              );
            } catch (err) {
              const code =
                typeof err === "object" && err !== null && "code" in err
                  ? String((err as { code?: unknown }).code)
                  : "";
              if (code !== "storage/object-not-found") {
                log("WARN", "Operation video storage delete skipped", {
                  videoId,
                  storagePath: target.storagePath,
                  err,
                });
              }
            }
          })
        );

        const deleteResults = await Promise.all([
          firestoreOps.deleteDocument({
            collectionName: this.operationVideoCollectionPath(),
            docId: video.id,
          }),
          ...sourceAssetIds.map((assetId) =>
            firestoreOps.deleteDocument({
              collectionName: this.sourceAssetCollectionPath(),
              docId: assetId,
            })
          ),
        ]);
        if (deleteResults.some((deleted) => !deleted)) {
          throw new Error("Firestore上のザッピング動画または関連素材を削除できませんでした");
        }

        this.operationVideos = this.operationVideos.filter(
          (item) => item.id !== video.id
        );
        if (video.groupId) {
          const group = this.operationVideoGroups.find(
            (item) => item.id === video.groupId
          );
          if (group) {
            const nextGroup: DecodedVibeControlOperationVideoGroup = {
              ...group,
              videoCount: this.operationVideos.filter(
                (item) => item.groupId === group.id
              ).length,
            };
            await firestoreOps.createDocument({
              collectionName: this.operationVideoGroupCollectionPath(),
              docId: nextGroup.id,
              docData: nextGroup,
              converter: vibeControlOperationVideoGroupConverter,
              merge: true,
            });
            this.operationVideoGroups = this.operationVideoGroups.map((item) =>
              item.id === nextGroup.id ? nextGroup : item
            );
          }
        }
        this.sourceAssets = this.sourceAssets.filter(
          (asset) => !sourceAssetIds.includes(asset.id)
        );
        this.lastRunLog.unshift(`Operation Video: ${video.title} を削除`);
      } catch (err) {
        log("ERROR", "VibeControl operation video delete failed", err);
        reportDatadogError(err, {
          feature: "vibe_control_zapping_video_delete",
          videoId,
          applicationId: video.applicationId,
        });
        this.error =
          err instanceof Error ? err.message : "ザッピング動画の削除に失敗しました";
        throw err;
      } finally {
        this.isLoading = false;
      }
    },
    async persistApplicationScanRun(params: {
      application: DecodedVibeControlApplication;
      run: VibeControlApplicationScanRun;
    }): Promise<void> {
      const firestoreOps = useFirestoreDocOperation();
      const nextApplication: DecodedVibeControlApplication = {
        ...params.application,
        startUrl: params.run.startUrl,
        fileSpaceId: params.run.fileSpaceId || params.application.fileSpaceId,
        fileSpaceProvisioningStatus:
          params.run.fileSpaceId || params.application.fileSpaceId
            ? "ready"
            : params.application.fileSpaceProvisioningStatus,
        fileSpaceErrorMessage:
          params.run.fileSpaceId || params.application.fileSpaceId
            ? undefined
            : params.application.fileSpaceErrorMessage,
        lastScan: params.run,
      };
      const index = this.applications.findIndex(
        (item) => item.id === params.application.id
      );
      if (index >= 0) {
        this.applications.splice(index, 1, nextApplication);
      }
      await firestoreOps.createDocument({
        collectionName: this.applicationCollectionPath(),
        docId: params.application.id,
        docData: nextApplication,
        converter: vibeControlApplicationConverter,
        merge: true,
      });
    },
    async startApplicationScan(params: {
      applicationId: string;
      fields: ApplicationScanFields;
    }): Promise<string> {
      const application = this.applications.find(
        (item) => item.id === params.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }

      const orgId = useOrganizationStore().loggedInOrganizationInfo?.id ?? "";
      const spaceId = useSpaceStore().selectedSpace?.id ?? "";
      const uid = getAuth().currentUser?.uid;
      if (!orgId || !spaceId || !uid) {
        throw new Error("組織・スペース・ログイン状態を確認してください");
      }

      this.isStartingApplicationScan = true;
      this.error = null;
      let pendingRun: VibeControlApplicationScanRun | null = null;

      try {
        const profile = await this.persistScanProfileFromFields({
          application,
          fields: params.fields,
        });
        const resolvedFields = await this.fieldsFromScanProfile({
          profile,
          overrides: {
            authenticatedUrl: params.fields.authenticatedUrl,
            emailLinkEmail: params.fields.emailLinkEmail,
            captureScreenshots: params.fields.captureScreenshots,
            exploreVariants: params.fields.exploreVariants,
            variantOnly: params.fields.variantOnly,
            targetScreenId: params.fields.targetScreenId,
            targetScreenUrl: params.fields.targetScreenUrl,
            targetRouteKey: params.fields.targetRouteKey,
          },
        });
        const now = nowIso();
        const sessionId = `vibecontrol-appscan-${application.id}-${Date.now()}-${createRandomDocId()}`;
        const responseId = `appscan-response-${createRandomDocId()}`;
        const workspaceState = buildWorkspaceSessionState({
          enAiStudioUi: {},
          activeMode: "application_scan",
          applicationScan: resolvedFields,
        });
        const modeState = buildInvokeModeStateFromWorkspaceState({
          state: workspaceState,
          activeMode: "application_scan",
        });
        const applicationScanState = modeState.application_scan;
        if (
          applicationScanState &&
          typeof applicationScanState === "object" &&
          !Array.isArray(applicationScanState)
        ) {
          const setup = (applicationScanState as Record<string, unknown>).setup;
          if (setup && typeof setup === "object" && !Array.isArray(setup)) {
            Object.assign(setup as Record<string, unknown>, {
              application_id: application.id,
              application_key: application.applicationKey,
              application_name: application.name,
              repo_full_name: application.repoFullName,
              default_branch: application.defaultBranch || "main",
            });
          }
        }

        pendingRun = {
          requestId: "",
          sessionId,
          responseId,
          status: "pending",
          startUrl:
            resolvedFields.authMode === "email_link_manual"
              ? ""
              : resolvedFields.startUrl.trim(),
          fileSpaceId: resolvedFields.fileSpaceId.trim() || undefined,
          maxPages: resolvedFields.maxPages,
          captureScreenshots: resolvedFields.captureScreenshots,
          exploreVariants: resolvedFields.exploreVariants,
          maxVariantsPerScreen: resolvedFields.maxVariantsPerScreen,
          maxStepsPerScreen: resolvedFields.maxStepsPerScreen,
          allowChatSend: false,
          createdAt: now,
          updatedAt: now,
        };

        await this.persistApplicationScanRun({
          application,
          run: pendingRun,
        });

        const requestId = await createAdkInvokeRequest({
          organizationId: orgId,
          spaceId,
          input: buildAdkInvokeInput({
            mode: "application_scan",
            sessionId,
            organizationId: orgId,
            spaceId,
            userId: uid,
            prompt: buildApplicationScanInitialPrompt(resolvedFields),
            responseId,
            model: defaultLlmModelSelectionForAdkMode("application_scan"),
            fileSpaceId: resolvedFields.fileSpaceId.trim() || null,
            workspaceId: application.id,
            history: [],
            modeState,
          }),
        });

        const startedRun: VibeControlApplicationScanRun = {
          ...pendingRun,
          requestId,
          updatedAt: nowIso(),
        };
        await this.persistApplicationScanRun({
          application: {
            ...application,
            lastScan: pendingRun,
          },
          run: startedRun,
        });
        this.lastRunLog.unshift(
          `Application Scan: ${application.name} (${startedRun.startUrl || "メールリンク認証"}) のrequestDocを発行`
        );

        const stopWatch = watchAdkInvokeRequest({
          organizationId: orgId,
          spaceId,
          requestId,
          onUpdate: (status: RequestStatus, errorMessage?: string) => {
            void this.updateApplicationScanStatus({
              applicationId: application.id,
              requestId,
              status,
              errorMessage,
            });
            if (status === "completed" || status === "error") {
              stopWatch();
            }
          },
        });

        return requestId;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Application Scanの開始に失敗しました";
        this.error = message;
        if (!pendingRun) {
          throw err;
        }
        const failedRun: VibeControlApplicationScanRun = {
          ...pendingRun,
          status: "error",
          errorMessage: message,
          updatedAt: nowIso(),
          completedAt: nowIso(),
        };
        await this.persistApplicationScanRun({
          application,
          run: failedRun,
        });
        throw err;
      } finally {
        this.isStartingApplicationScan = false;
      }
    },
    async startScreenVariantExploration(
      input: VibeControlScreenVariantExplorationInput
    ): Promise<string> {
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const profile =
        this.scanProfiles.find((item) => item.id === input.scanProfileId) ??
        this.scanProfiles.find((item) => item.applicationId === application.id) ??
        (await this.saveApplicationScanProfile({
          applicationId: application.id,
          name: "Default",
          entryUrl: application.startUrl || input.screenUrl,
          defaultExploreVariants: true,
        }));
      const fields = await this.fieldsFromScanProfile({
        profile,
        overrides: {
          exploreVariants: true,
          variantOnly: true,
          targetScreenId: input.screenId,
          targetScreenUrl: input.screenUrl,
          targetRouteKey: input.routeKey ?? "",
        },
      });
      return await this.startApplicationScan({
        applicationId: application.id,
        fields,
      });
    },
    async updateApplicationScanStatus(params: {
      applicationId: string;
      requestId: string;
      status: RequestStatus;
      errorMessage?: string;
    }): Promise<void> {
      const application = this.applications.find(
        (item) => item.id === params.applicationId
      );
      if (!application?.lastScan) return;
      if (application.lastScan.requestId !== params.requestId) return;

      const nextRun: VibeControlApplicationScanRun = {
        ...application.lastScan,
        status: params.status,
        errorMessage: params.errorMessage,
        updatedAt: nowIso(),
        completedAt:
          params.status === "completed" || params.status === "error"
            ? nowIso()
            : application.lastScan.completedAt,
      };
      await this.persistApplicationScanRun({
        application,
        run: nextRun,
      });
    },
    exportStoryMarkdown(storyId: string): string {
      const story = this.stories.find((item) => item.id === storyId);
      if (!story) return "";
      const evidence = this.evidenceForStory(storyId);
      const application = this.applications.find(
        (item) => item.id === story.applicationId
      );
      return [
        `# ${story.storyKey} ${story.title}`,
        "",
        `Application: ${application?.name ?? story.applicationKey} (${story.applicationKey})`,
        `Status: ${story.status}`,
        `Review: ${story.reviewState}`,
        `Confidence: ${story.confidenceScore}%`,
        `Drift: ${story.driftLevel}${story.driftReason ? ` - ${story.driftReason}` : ""}`,
        "",
        "## User Story",
        story.userStory,
        "",
        "## Acceptance Criteria",
        ...story.acceptanceCriteria.map(
          (ac) => `- [${ac.state === "covered" ? "x" : " "}] ${ac.id}: ${ac.text} (${ac.state})`
        ),
        "",
        "## Evidence",
        ...evidence.map(
          (item) =>
            `- ${item.type}: ${item.title} - ${item.citation.snippet}${item.citation.uri ? ` (${item.citation.uri})` : ""}`
        ),
        "",
        "## Code Refs",
        ...story.codeRefs.map(
          (ref) =>
            `- ${ref.repoFullName}${ref.path ? `/${ref.path}` : ""}${ref.pullRequest ? ` ${ref.pullRequest}` : ""}: ${ref.summary ?? ""}`
        ),
      ].join("\n");
    },
  },
});
