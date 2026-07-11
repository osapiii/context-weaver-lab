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
} from "@utils/storyVaultEvidenceDocuments";
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
  StoryVaultApplicationFileSpaceProvisioningStatus,
  DecodedStoryVaultApplication,
  DecodedStoryVaultApplicationScanProfile,
  DecodedStoryVaultCapability,
  DecodedStoryVaultClip,
  DecodedStoryVaultClipGroup,
  DecodedStoryVaultDraftPatch,
  DecodedStoryVaultGenerationSession,
  DecodedStoryVaultSourceConnection,
  DecodedStoryVaultSourceAsset,
  DecodedStoryVaultStory,
  DecodedStoryVaultStoryEvidence,
  StoryVaultApplicationScanRun,
  StoryVaultClip,
  StoryVaultDriftLevel,
  StoryVaultOperationVideoClip,
  StoryVaultOperationVideoDisplaySurface,
  StoryVaultOperationVideoQuickScan,
  StoryVaultTranscriptCue,
  StoryVaultTranscriptTimingStatus,
  StoryVaultReviewState,
  StoryVaultScanAuthMode,
  StoryVaultRelatedContextResult,
  StoryVaultRelatedContextKnowledgeDocument,
  StoryVaultRelatedContextJiraIssue,
  StoryVaultStoryStatus,
  StoryVaultZappingAnalysisResult,
} from "@models/storyVault";
import {
  storyVaultApplicationScanProfileConverter,
  storyVaultApplicationConverter,
  storyVaultCapabilityConverter,
  storyVaultClipConverter,
  storyVaultClipGroupConverter,
  storyVaultDraftPatchConverter,
  storyVaultGenerationSessionConverter,
  storyVaultSourceAssetConverter,
  storyVaultSourceConnectionConverter,
  storyVaultStoryConverter,
  storyVaultStoryEvidenceConverter,
  StoryVaultRelatedContextResultSchema,
  StoryVaultZappingAnalysisResultSchema,
} from "@models/storyVault";
import { reportDatadogError } from "@utils/datadogObservability";
import {
  formatUserStoryKey,
  nextUserStorySequenceForApplication,
} from "@utils/storyVaultStoryKeys";

export type StoryVaultFilters = {
  query: string;
  status: StoryVaultStoryStatus | "all";
  domain: string;
  milestone: string;
  drift: StoryVaultDriftLevel | "all";
  reviewState: StoryVaultReviewState | "all";
  minConfidence: number;
};

export type StoryVaultGenerationInput = {
  applicationId?: string;
  applicationKey: string;
  applicationName: string;
  fileSpaceId: string;
  repoFullName: string;
  defaultBranch: string;
  capabilityId?: string;
  prompt?: string;
};

export type StoryVaultApplicationInput = {
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

export type StoryVaultApplicationScanProfileInput = {
  id?: string;
  applicationId: string;
  name: string;
  authMode?: StoryVaultScanAuthMode;
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

export type StoryVaultScreenVariantExplorationInput = {
  applicationId: string;
  screenId: string;
  screenUrl: string;
  routeKey?: string;
  scanProfileId?: string;
};

export type StoryVaultClipSaveInput = {
  applicationId: string;
  clipGroupId: string;
  title: string;
  description?: string;
  tags?: string[];
  transcriptText?: string;
  transcriptProvider?: string;
  transcriptSummary?: string;
  transcriptSegments?: StoryVaultTranscriptCue[];
  transcriptSrt?: string;
  transcriptTimingStatus?: StoryVaultTranscriptTimingStatus;
  quickScan?: StoryVaultOperationVideoQuickScan;
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
  sourceDisplaySurface?: StoryVaultOperationVideoDisplaySurface;
};

export type StoryVaultClipAnalysisInput = {
  clipId: string;
  title?: string;
  description?: string;
  transcriptText: string;
  transcriptProvider?: string;
  transcriptSummary?: string;
  transcriptSegments: StoryVaultTranscriptCue[];
  transcriptSrt: string;
  transcriptTimingStatus: StoryVaultTranscriptTimingStatus;
  quickScan?: StoryVaultOperationVideoQuickScan;
  frameCaptures: Array<{
    timestampMs: number;
    blob: Blob;
    contentType?: string;
    width?: number;
    height?: number;
  }>;
};

export type StoryVaultZappingVideoAnalysisInput = {
  applicationId: string;
  clipId: string;
  prompt?: string;
};

export type StoryVaultRelatedContextAnalysisInput = {
  applicationId: string;
  clipId: string;
  provider: "github" | "slack" | "knowledge" | "jira";
  prompt?: string;
};

export type StoryVaultClipGroupInput = {
  id?: string;
  applicationId: string;
  name: string;
  description?: string;
};

export type StoryVaultClipMoveInput = {
  clipIds: string[];
  groupId: string;
};

export type StoryVaultClipListItem = {
  key: string;
  applicationId: string;
  applicationKey: string;
  clipGroupId: string;
  clipGroupNameSnapshot?: string;
  clip: DecodedStoryVaultClip;
};

export type StoryVaultSeparatedAdkMode =
  | "storyvault_capability_structuring"
  | "storyvault_story_generation";

export type StoryVaultGenerationAgentInput = {
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

const clipSourceAssetIds = (
  clip: Pick<DecodedStoryVaultClip, "id" | "sourceAssetId" | "journeySourceAssetId">
): string[] => {
  const ids = [
    clip.sourceAssetId,
    clip.journeySourceAssetId,
    `source-asset-${clip.id}`,
    `source-asset-${clip.id}-journey`,
  ];
  return ids.filter(
    (id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index
  );
};

const scanProfilePasswordSecretId = (profileId: string): string =>
  `storyVaultScanProfilePassword-${profileId}`;

const scanProfileAssistedSessionSecretId = (profileId: string): string =>
  `storyVaultScanProfileAssistedSession-${profileId}`;

const extractFileSpaceIdFromCreateRequest = (
  request: DecodedFileSpaceOperationRequest
): string => {
  const output = request.output;
  if (!output || typeof output !== "object") return "";
  const record = output as Record<string, unknown>;
  const response = record.response;
  const responseRecord =
    response && typeof response === "object"
      ? (response as Record<string, unknown>)
      : null;
  const name = record.name ?? responseRecord?.name;
  if (typeof name !== "string" || !name.trim()) return "";
  return name.split("/").filter(Boolean).at(-1) ?? "";
};

const extractZappingAnalysisResultCandidate = (
  value: unknown
): StoryVaultZappingAnalysisResult | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const direct = StoryVaultZappingAnalysisResultSchema.safeParse(
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
  const shaped = StoryVaultZappingAnalysisResultSchema.safeParse(
    normalizeAdkResultValue(resultShape)
  );
  if (shaped.success) return shaped.data;

  const candidates = [
    record.analysis_result,
    record.analysisResult,
    record.storyvault_zapping_analysis,
    record.vibeZappingAnalysis,
    record.state,
    record.output,
  ];
  for (const candidate of candidates) {
    if (!candidate || candidate === value) continue;
    const parsed = extractZappingAnalysisResultCandidate(candidate);
    if (parsed) return parsed;
  }

  const hasResultSignal =
    "schemaVersion" in record ||
    "generatedAt" in record ||
    "transcriptSummary" in record ||
    "productContextSummary" in record ||
    "operationIntent" in record ||
    "storyCandidates" in record ||
    "notes" in record;
  if (!hasResultSignal) return undefined;

  const fallbackShape = {
    schemaVersion: record.schemaVersion || "storyvault-zapping-analysis-v2",
    generatedAt:
      typeof record.generatedAt === "string" && record.generatedAt.trim()
        ? record.generatedAt
        : new Date().toISOString(),
    transcriptSummary: record.transcriptSummary,
    productContextSummary: record.productContextSummary,
    operationIntent: record.operationIntent,
    storyCandidates: Array.isArray(record.storyCandidates) ? record.storyCandidates : [],
    notes: Array.isArray(record.notes)
      ? record.notes
      : typeof record.notes === "string"
        ? [record.notes]
        : [],
  };
  const fallback = StoryVaultZappingAnalysisResultSchema.safeParse(
    normalizeAdkResultValue(fallbackShape)
  );
  if (fallback.success) return fallback.data;
  return undefined;
};

const extractRelatedContextResultCandidate = (
  value: unknown
): StoryVaultRelatedContextResult | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const direct = StoryVaultRelatedContextResultSchema.safeParse(
    normalizeAdkResultValue(value)
  );
  if (direct.success) return direct.data;

  const candidates = [
    record.related_context,
    record.related_context_result,
    record.relatedContext,
    record.relatedContextResult,
    record.storyvault_related_context_result,
    record.storyvault_related_context,
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
  clip: StoryVaultOperationVideoClip,
  cue: StoryVaultTranscriptCue
): string[] => [cue.id, `${clip.id}:${cue.id}`];

const hasTimestampedTranscript = (
  owner: Pick<
    StoryVaultOperationVideoClip,
    "transcriptSegments" | "transcriptSrt" | "transcriptTimingStatus"
  >
): boolean =>
  owner.transcriptTimingStatus === "timestamped" &&
  (owner.transcriptSegments?.length ?? 0) > 0 &&
  Boolean(owner.transcriptSrt?.trim());

const assertTimestampedTranscript = (
  clips: StoryVaultOperationVideoClip[],
  message = "ストーリー解析にはタイムスタンプ付き文字起こしが必要です"
): void => {
  const missing = clips.filter((clip) => !hasTimestampedTranscript(clip));
  if (missing.length > 0) {
    throw new Error(`${message}。Gemini文字起こし付きで録画を保存し直してください。`);
  }
};

const normalizeZappingAnalysisResultEvidence = (params: {
  result: StoryVaultZappingAnalysisResult;
  clip: DecodedStoryVaultClip;
}): StoryVaultZappingAnalysisResult => {
  const cueEntries = (params.clip.transcriptSegments ?? []).flatMap((cue) =>
    transcriptCueIdForClip(params.clip, cue).map((id) => ({
      id,
      clip: params.clip,
      cue,
    }))
  );
  const cueById = new Map(cueEntries.map((entry) => [entry.id, entry]));
  const allFrames = (params.clip.frameCaptures ?? []).map((frame) => ({
    id: `${params.clip.id}:${frame.id}`,
    rawId: frame.id,
    timestampMs: frame.timestampMs,
  }));

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
            evidence.title ||
            "",
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
  result: StoryVaultZappingAnalysisResult;
  stories: DecodedStoryVaultStory[];
  clips: DecodedStoryVaultClip[];
}): StoryVaultZappingAnalysisResult => {
  let nextSequence = nextUserStorySequenceForApplication({
    applicationId: params.applicationId,
    stories: params.stories,
    clips: params.clips,
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

const mockApplications: DecodedStoryVaultApplication[] = [
  {
    id: "app-storyvault-platform",
    applicationKey: "VC",
    name: "StoryVault Platform",
    summary:
      "AI-driven delivery governance for product intent, user stories, code state, and editor context.",
    domain: "devops-governance",
    labels: ["hackathon", "governance"],
    fileSpaceId: "w-default",
    repoFullName: "enostech/storyvault-demo",
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

const mockEvidence: DecodedStoryVaultStoryEvidence[] = [
  {
    id: "ev-st101-brief",
    applicationId: "app-storyvault-platform",
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
    applicationId: "app-storyvault-platform",
    applicationKey: "VC",
    storyId: "story-st101",
    storyKey: "ST-101",
    type: "code",
    title: "signup onboarding route",
    excerpt:
      "app/pages/admin/signin.vue と onboarding trigger は存在するが、ACの完了画面確認が未接続。",
    repoFullName: "enostech/storyvault-demo",
    path: "app/pages/admin/signin.vue",
    citation: {
      title: "GitHub app/pages/admin/signin.vue",
      snippet: "sign-in link flow exists; onboarding completion route not mapped",
      uri: "https://github.com/enostech/storyvault-demo/blob/main/app/pages/admin/signin.vue",
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
    applicationId: "app-storyvault-platform",
    applicationKey: "VC",
    storyId: "story-st201",
    storyKey: "ST-201",
    type: "knowledge",
    title: "AIエディタ向けコンテキスト同期",
    excerpt:
      "AIエディタはSSOT化されたストーリー単位で、仕様・根拠・コード状態を参照できる。",
    citation: {
      title: "StoryVault構想資料",
      snippet: "AIエディタが直接参照するコンテキストマスター",
      uri: "fileSpace://w-default/documents/storyvault-concept",
    },
    freshness: "fresh",
    confidenceImpact: 15,
  },
];

const mockStories: DecodedStoryVaultStory[] = [
  {
    id: "story-st101",
    applicationId: "app-storyvault-platform",
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
        text: "完了後にStoryVaultの開始地点へ遷移する",
        state: "missing",
        evidenceIds: ["ev-st101-code"],
      },
    ],
    evidenceIds: ["ev-st101-brief", "ev-st101-code"],
    codeRefs: [
      {
        provider: "github",
        repoFullName: "enostech/storyvault-demo",
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
    repoFullName: "enostech/storyvault-demo",
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
    applicationId: "app-storyvault-platform",
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
        message: "StoryVault構想資料からAIエディタ連携候補を抽出。",
      },
    ],
    fileSpaceId: "w-default",
    repoFullName: "enostech/storyvault-demo",
    generatedAt: nowIso(),
  },
];

const mockConnections: DecodedStoryVaultSourceConnection[] = [
  {
    id: "source-filespace",
    applicationId: "app-storyvault-platform",
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
    applicationId: "app-storyvault-platform",
    applicationKey: "VC",
    provider: "github",
    status: "connected",
    displayName: "enostech/storyvault-demo",
    repoFullName: "enostech/storyvault-demo",
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

export const useStoryVaultStore = defineStore("storyVault", {
  state: () => ({
    applications: [] as DecodedStoryVaultApplication[],
    capabilities: [] as DecodedStoryVaultCapability[],
    stories: [] as DecodedStoryVaultStory[],
    evidence: [] as DecodedStoryVaultStoryEvidence[],
    sourceConnections: [] as DecodedStoryVaultSourceConnection[],
    scanProfiles: [] as DecodedStoryVaultApplicationScanProfile[],
    sourceAssets: [] as DecodedStoryVaultSourceAsset[],
    clips: [] as DecodedStoryVaultClip[],
    clipGroups: [] as DecodedStoryVaultClipGroup[],
    generationSessions: [] as DecodedStoryVaultGenerationSession[],
    draftPatches: [] as DecodedStoryVaultDraftPatch[],
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
    } as StoryVaultFilters,
  }),
  getters: {
    selectedApplication(state): DecodedStoryVaultApplication | null {
      return (
        state.applications.find(
          (application) => application.id === state.selectedApplicationId
        ) ?? state.applications[0] ?? null
      );
    },
    activeStories(state): DecodedStoryVaultStory[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.stories;
      return state.stories.filter((story) => story.applicationId === applicationId);
    },
    activeCapabilities(state): DecodedStoryVaultCapability[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      const capabilities = !applicationId
        ? state.capabilities
        : state.capabilities.filter(
            (capability) => capability.applicationId === applicationId
          );
      return [...capabilities].sort((a, b) => a.order - b.order);
    },
    activeEvidence(state): DecodedStoryVaultStoryEvidence[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.evidence;
      return state.evidence.filter((item) => item.applicationId === applicationId);
    },
    activeSourceAssets(state): DecodedStoryVaultSourceAsset[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.sourceAssets;
      return state.sourceAssets.filter(
        (asset) => asset.applicationId === applicationId
      );
    },
    activeScanProfiles(state): DecodedStoryVaultApplicationScanProfile[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.scanProfiles;
      return state.scanProfiles.filter(
        (profile) => profile.applicationId === applicationId
      );
    },
    defaultScanProfile(): DecodedStoryVaultApplicationScanProfile | null {
      return this.activeScanProfiles[0] ?? null;
    },
    activeGenerationSessions(state): DecodedStoryVaultGenerationSession[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      const sessions = !applicationId
        ? state.generationSessions
        : state.generationSessions.filter(
            (session) => session.applicationId === applicationId
          );
      return [...sessions].sort((a, b) => b.id.localeCompare(a.id));
    },
    activeSourceConnections(state): DecodedStoryVaultSourceConnection[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.sourceConnections;
      return state.sourceConnections.filter(
        (source) => source.applicationId === applicationId
      );
    },
    activeClips(state): StoryVaultClipListItem[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      const clips = !applicationId
        ? state.clips
        : state.clips.filter((clip) => clip.applicationId === applicationId);
      return clips.map((clip) => ({
        key: clip.id,
        applicationId: clip.applicationId,
        applicationKey: clip.applicationKey,
        clipGroupId: clip.clipGroupId,
        clipGroupNameSnapshot: clip.clipGroupNameSnapshot,
        clip,
      }));
    },
    activeClipRecords(state): DecodedStoryVaultClip[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      if (!applicationId) return state.clips;
      return state.clips.filter(
        (clip) => clip.applicationId === applicationId
      );
    },
    activeClipGroups(state): DecodedStoryVaultClipGroup[] {
      const applicationId =
        state.selectedApplicationId || state.applications[0]?.id || "";
      const groups = !applicationId
        ? state.clipGroups
        : state.clipGroups.filter(
            (group) => group.applicationId === applicationId
          );
      return [...groups].sort((a, b) => {
        const updated = (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);
        return updated || a.name.localeCompare(b.name, "ja");
      });
    },
    filteredStories(state): DecodedStoryVaultStory[] {
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
    selectedStory(state): DecodedStoryVaultStory | null {
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
    selectedEvidence(state): DecodedStoryVaultStoryEvidence[] {
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
      return useContextStore().baseFirestorePath("storyVaultApplications");
    },
    storyCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultStories");
    },
    evidenceCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultStoryEvidence");
    },
    sourceConnectionCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultSourceConnections");
    },
    scanProfileCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultScanProfiles");
    },
    clipCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultClips");
    },
    clipGroupCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultClipGroups");
    },
    capabilityCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultCapabilities");
    },
    sourceAssetCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultSourceAssets");
    },
    generationSessionCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultGenerationSessions");
    },
    draftPatchCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultDraftPatches");
    },
    mcpConnectionCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultMcpConnections");
    },
    agentPlanCollectionPath(): string {
      return useContextStore().baseFirestorePath("storyVaultAgentPlans");
    },
    applicationFileSpaceStatus(
      application: DecodedStoryVaultApplication | null
    ): StoryVaultApplicationFileSpaceProvisioningStatus {
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
      this.clips = [];
      this.clipGroups = [];
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
        "Application: StoryVault Platform を集約ルートとして選択",
        "Agent Search: FileSpace w-default からTo-Be候補を抽出",
        "GitHub: enostech/storyvault-demo のPR/commit/file refsを照合",
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
          clips,
          clipGroups,
          capabilities,
          sourceAssets,
          generationSessions,
          draftPatches,
        ] = await Promise.all([
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.applicationCollectionPath(),
            converter: storyVaultApplicationConverter,
            orderBy: { field: "lastGeneratedAt", direction: "desc" },
            limit: 50,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.storyCollectionPath(),
            converter: storyVaultStoryConverter,
            orderBy: { field: "generatedAt", direction: "desc" },
            limit: 200,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.evidenceCollectionPath(),
            converter: storyVaultStoryEvidenceConverter,
            limit: 1000,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.sourceConnectionCollectionPath(),
            converter: storyVaultSourceConnectionConverter,
            limit: 50,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.scanProfileCollectionPath(),
            converter: storyVaultApplicationScanProfileConverter,
            limit: 200,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.clipCollectionPath(),
            converter: storyVaultClipConverter,
            orderBy: { field: "recordedAt", direction: "desc" },
            limit: 200,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.clipGroupCollectionPath(),
            converter: storyVaultClipGroupConverter,
            orderBy: { field: "updatedAt", direction: "desc" },
            limit: 200,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.capabilityCollectionPath(),
            converter: storyVaultCapabilityConverter,
            orderBy: { field: "order", direction: "asc" },
            limit: 500,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.sourceAssetCollectionPath(),
            converter: storyVaultSourceAssetConverter,
            limit: 1000,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.generationSessionCollectionPath(),
            converter: storyVaultGenerationSessionConverter,
            limit: 100,
          }),
          firestoreOps.getDocumentsWithQueryAndConverter({
            collectionName: this.draftPatchCollectionPath(),
            converter: storyVaultDraftPatchConverter,
            limit: 300,
          }),
        ]);
        this.applications = applications;
        this.stories = stories;
        this.evidence = evidence;
        this.sourceConnections = sourceConnections;
        this.scanProfiles = scanProfiles;
        this.clips = clips;
        this.clipGroups = clipGroups;
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
          await this.ensureDefaultClipGroups();
          await this.reconcileZappingVideoAnalysisRequests();
        }
      } catch (err) {
        log("WARN", "StoryVault Firestore fetch failed, using mock data", err);
        this.loadMockData();
        this.error =
          "FirestoreからSSOTを取得できなかったため、デモデータを表示しています";
      } finally {
        this.isLoading = false;
      }
    },
    setFilter<K extends keyof StoryVaultFilters>(
      key: K,
      value: StoryVaultFilters[K]
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
      input: StoryVaultApplicationInput
    ): Promise<DecodedStoryVaultApplication> {
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
          | StoryVaultApplicationFileSpaceProvisioningStatus
          | undefined = fileSpaceId
          ? "ready"
          : currentApplication?.fileSpaceProvisioningStatus === "creating"
            ? "creating"
            : currentApplication?.fileSpaceProvisioningStatus === "error"
              ? "error"
              : "missing";
        const application: DecodedStoryVaultApplication = {
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
            converter: storyVaultApplicationConverter,
            merge: true,
          }),
          ...this.sourceConnections
            .filter((source) => source.applicationId === application.id)
            .map((source) =>
              firestoreOps.createDocument({
                collectionName: this.sourceConnectionCollectionPath(),
                docId: source.id,
                docData: source,
                converter: storyVaultSourceConnectionConverter,
                merge: true,
              })
            ),
        ]);

        return application;
      } catch (err) {
        log("ERROR", "StoryVault application upsert failed", err);
        this.error =
          err instanceof Error ? err.message : "アプリケーション保存に失敗しました";
        throw err;
      } finally {
        this.isLoading = false;
      }
    },
    buildSourceConnectionsForApplication(
      application: DecodedStoryVaultApplication,
      syncedAt = nowIso()
    ): DecodedStoryVaultSourceConnection[] {
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
      input: StoryVaultApplicationScanProfileInput
    ): Promise<DecodedStoryVaultApplicationScanProfile> {
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
      const profile: DecodedStoryVaultApplicationScanProfile = {
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
        converter: storyVaultApplicationScanProfileConverter,
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
      application: DecodedStoryVaultApplication;
      fields: ApplicationScanFields;
    }): Promise<DecodedStoryVaultApplicationScanProfile> {
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
      profile: DecodedStoryVaultApplicationScanProfile;
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
      application: DecodedStoryVaultApplication,
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
          converter: storyVaultApplicationConverter,
          merge: true,
        }),
        ...this.sourceConnections
          .filter((source) => source.applicationId === application.id)
          .map((source) =>
            firestoreOps.createDocument({
              collectionName: this.sourceConnectionCollectionPath(),
              docId: source.id,
              docData: source,
              converter: storyVaultSourceConnectionConverter,
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
        const nextApplication: DecodedStoryVaultApplication = {
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
          displayName: `StoryVault / ${application.name}`,
          description: [
            "Application-scoped StoryVault knowledge space.",
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

        const nextApplication: DecodedStoryVaultApplication = {
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
        const failedApplication: DecodedStoryVaultApplication = {
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
    }): Promise<DecodedStoryVaultApplication | null> {
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
          const failedApplication: DecodedStoryVaultApplication = {
            ...application,
            fileSpaceProvisioningStatus: "error",
            fileSpaceErrorMessage:
              "FileSpace作成は完了しましたが、FileSpace IDを取得できませんでした",
          };
          await this.persistApplicationAndSourceConnections(failedApplication);
          return failedApplication;
        }

        const nextApplication: DecodedStoryVaultApplication = {
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
        const failedApplication: DecodedStoryVaultApplication = {
          ...application,
          fileSpaceProvisioningStatus: "error",
          fileSpaceErrorMessage:
            params.request.errorMessage || "FileSpace作成に失敗しました",
        };
        await this.persistApplicationAndSourceConnections(failedApplication);
        return failedApplication;
      }

      const creatingApplication: DecodedStoryVaultApplication = {
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
        const clips = this.clips.filter(
          (clip) => clip.applicationId === applicationId
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
          ...clips.map((clip) =>
            firestoreOps.deleteDocument({
              collectionName: this.clipCollectionPath(),
              docId: clip.id,
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
        this.clips = this.clips.filter(
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
        log("ERROR", "StoryVault application delete failed", err);
        this.error =
          err instanceof Error ? err.message : "アプリケーション削除に失敗しました";
        return false;
      } finally {
        this.isLoading = false;
      }
    },
    evidenceForStory(storyId: string): DecodedStoryVaultStoryEvidence[] {
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
      input: StoryVaultGenerationInput
    ): Promise<DecodedStoryVaultApplication> {
      const now = nowIso();
      const applicationName =
        input.applicationName.trim() || "StoryVault Application";
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
        input.repoFullName.trim() || "enostech/storyvault-demo";
      const defaultBranch = input.defaultBranch.trim() || "main";
      const currentApplication = this.applications.find(
        (item) => item.id === applicationId
      );
      const application: DecodedStoryVaultApplication = {
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
    async runMockGeneration(input: StoryVaultGenerationInput): Promise<void> {
      this.isGenerating = true;
      this.error = null;
      this.lastRunLog = [];
      try {
        const application = await this.registerSourceConnection(input);
        const applicationId = application.id;
        const applicationKey = application.applicationKey;
        const fileSpaceId = input.fileSpaceId.trim() || "w-default";
        const repoFullName =
          input.repoFullName.trim() || "enostech/storyvault-demo";
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
      const clips = this.clips.filter(
        (clip) => clip.applicationId === applicationId
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
      const frameCount = clips.reduce(
        (sum, clip) => sum + (clip.frameCaptures?.length ?? 0),
        0
      );
      const transcriptCount = clips.filter(
        (clip) =>
          Boolean(clip.transcriptText?.trim()) ||
          Boolean(clip.transcriptSummary?.trim()) ||
          Boolean(clip.quickScan?.transcriptSummary?.trim())
      ).length;
      const analyzedCount = clips.filter(
        (clip) => clip.analysisStatus === "completed"
      ).length;

      return {
        enabled: true,
        retrieval_strategy: "vertex_ai_search",
        file_space_id:
          this.applications.find((item) => item.id === applicationId)?.fileSpaceId ??
          null,
        source_of_truth:
          "クリップから抽出したスクリーンショット、Gemini全文文字起こし、文字起こし要約、操作ステップをFileSpace/Vertex AI Searchへ登録し、Capability/Story ADKが検索参照します。",
        included_evidence: [
          "operation_video_metadata",
          "operation_video_journey",
          "frame_captures",
          "gemini_transcript",
          "transcript_summary",
          "operation_steps",
          "zapping_analysis_result",
        ],
        operation_clip_count: clips.length,
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
            Boolean(clip.transcriptText?.trim()) ||
            Boolean(clip.transcriptSummary?.trim()) ||
            Boolean(video.quickScan?.transcriptSummary?.trim()),
        })),
      };
    },
    defaultClipGroupId(applicationId: string): string {
      return `clip-group-${applicationId}-default`;
    },
    clipCountForGroup(groupId: string): number {
      return this.clips.filter((clip) => clip.clipGroupId === groupId).length;
    },
    async createClipGroup(
      input: StoryVaultClipGroupInput
    ): Promise<DecodedStoryVaultClipGroup> {
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const name = input.name.trim();
      if (!name) {
        throw new Error("クリップグループ名を入力してください");
      }
      const groupId = input.id || `clip-group-${createRandomDocId()}`;
      const group: DecodedStoryVaultClipGroup = {
        id: groupId,
        applicationId: application.id,
        applicationKey: application.applicationKey,
        name,
        description: input.description?.trim() || undefined,
        clipCount: this.clipCountForGroup(groupId),
      };
      const firestoreOps = useFirestoreDocOperation();
      const created = await firestoreOps.createDocument({
        collectionName: this.clipGroupCollectionPath(),
        docId: group.id,
        docData: group,
        converter: storyVaultClipGroupConverter,
        merge: true,
      });
      const savedGroup = created ?? group;
      this.clipGroups = [
        savedGroup,
        ...this.clipGroups.filter((item) => item.id !== savedGroup.id),
      ];
      this.lastRunLog.unshift(`Clip Group: ${name} を作成`);
      return savedGroup;
    },
    async saveClipToGroup(
      input: StoryVaultClipSaveInput
    ): Promise<DecodedStoryVaultClip> {
      return this.saveClipCapture(input);
    },
    async updateClipGroup(input: {
      groupId: string;
      name: string;
      description?: string;
    }): Promise<void> {
      const group = this.clipGroups.find(
        (item) => item.id === input.groupId
      );
      if (!group) {
        throw new Error("更新対象のクリップグループが見つかりません");
      }
      const name = input.name.trim();
      if (!name) {
        throw new Error("クリップグループ名を入力してください");
      }
      const nextGroup: DecodedStoryVaultClipGroup = {
        ...group,
        name,
        description: input.description?.trim() || undefined,
        clipCount: this.clipCountForGroup(group.id),
      };
      const groupClips = this.clips.filter(
        (clip) => clip.clipGroupId === group.id
      );
      const nextClips = this.clips.map((clip) =>
        clip.clipGroupId === group.id
          ? { ...clip, clipGroupNameSnapshot: name }
          : clip
      );
      const firestoreOps = useFirestoreDocOperation();
      await Promise.all([
        firestoreOps.createDocument({
          collectionName: this.clipGroupCollectionPath(),
          docId: nextGroup.id,
          docData: nextGroup,
          converter: storyVaultClipGroupConverter,
          merge: true,
        }),
        ...groupClips.map((clip) =>
          firestoreOps.createDocument({
            collectionName: this.clipCollectionPath(),
            docId: clip.id,
            docData: { ...clip, clipGroupNameSnapshot: name },
            converter: storyVaultClipConverter,
            merge: true,
          })
        ),
      ]);
      this.clipGroups = this.clipGroups.map((item) =>
        item.id === nextGroup.id ? nextGroup : item
      );
      this.clips = nextClips;
      this.lastRunLog.unshift(`Clip Group: ${group.name} を ${name} に変更`);
    },
    async deleteClipGroup(groupId: string): Promise<void> {
      const group = this.clipGroups.find((item) => item.id === groupId);
      if (!group) {
        throw new Error("削除対象のクリップグループが見つかりません");
      }
      if (this.clips.some((clip) => clip.clipGroupId === groupId)) {
        throw new Error("クリップが登録されているグループは削除できません");
      }
      const deleted = await useFirestoreDocOperation().deleteDocument({
        collectionName: this.clipGroupCollectionPath(),
        docId: group.id,
      });
      if (!deleted) {
        throw new Error("クリップグループを削除できませんでした");
      }
      this.clipGroups = this.clipGroups.filter(
        (item) => item.id !== group.id
      );
      this.lastRunLog.unshift(`Clip Group: ${group.name} を削除`);
    },
    async moveClipsToGroup(input: StoryVaultClipMoveInput): Promise<void> {
      const group = this.clipGroups.find((item) => item.id === input.groupId);
      if (!group) {
        throw new Error("移動先のクリップグループが見つかりません");
      }
      const targetIds = Array.from(new Set(input.clipIds)).filter(Boolean);
      if (targetIds.length === 0) return;
      const targetClips = this.clips.filter((clip) =>
        targetIds.includes(clip.id)
      );
      if (targetClips.length === 0) {
        throw new Error("移動対象のクリップが見つかりません");
      }

      const nextClips = this.clips.map((clip) =>
        targetIds.includes(clip.id)
          ? {
              ...clip,
              clipGroupId: group.id,
              clipGroupNameSnapshot: group.name,
            }
          : clip
      );
      const nextGroups = this.clipGroups.map((item) => ({
        ...item,
        clipCount: nextClips.filter((clip) => clip.clipGroupId === item.id).length,
      }));
      const firestoreOps = useFirestoreDocOperation();
      await Promise.all([
        ...targetClips.map((clip) => {
          const nextClip = nextClips.find((item) => item.id === clip.id)!;
          return firestoreOps.createDocument({
            collectionName: this.clipCollectionPath(),
            docId: nextClip.id,
            docData: nextClip,
            converter: storyVaultClipConverter,
            merge: true,
          });
        }),
        ...nextGroups.map((nextGroup) =>
          firestoreOps.createDocument({
            collectionName: this.clipGroupCollectionPath(),
            docId: nextGroup.id,
            docData: nextGroup,
            converter: storyVaultClipGroupConverter,
            merge: true,
          })
        ),
      ]);

      this.clips = nextClips;
      this.clipGroups = nextGroups;
      this.lastRunLog.unshift(
        `Clip Group: ${targetClips.length}件を ${group.name} に移動`
      );
    },
    async ensureDefaultClipGroups(): Promise<void> {
      const firestoreOps = useFirestoreDocOperation();
      for (const application of this.applications) {
        const hasGroup = this.clipGroups.some(
          (group) => group.applicationId === application.id
        );
        if (hasGroup) continue;
        const group: DecodedStoryVaultClipGroup = {
          id: this.defaultClipGroupId(application.id),
          applicationId: application.id,
          applicationKey: application.applicationKey,
          name: "AIに教える",
          description: "操作クリップを登録するデフォルトグループです。",
          clipCount: 0,
        };
        await firestoreOps.createDocument({
          collectionName: this.clipGroupCollectionPath(),
          docId: group.id,
          docData: group,
          converter: storyVaultClipGroupConverter,
          merge: true,
        });
        this.clipGroups = [group, ...this.clipGroups];
      }
    },
    async persistGenerationSession(
      session: DecodedStoryVaultGenerationSession
    ): Promise<void> {
      this.generationSessions = [
        session,
        ...this.generationSessions.filter((item) => item.id !== session.id),
      ];
      await useFirestoreDocOperation().createDocument({
        collectionName: this.generationSessionCollectionPath(),
        docId: session.id,
        docData: session,
        converter: storyVaultGenerationSessionConverter,
        merge: true,
      });
    },
    async persistClip(clip: DecodedStoryVaultClip): Promise<void> {
      this.clips = [
        clip,
        ...this.clips.filter((item) => item.id !== clip.id),
      ];
      await useFirestoreDocOperation().createDocument({
        collectionName: this.clipCollectionPath(),
        docId: clip.id,
        docData: clip,
        converter: storyVaultClipConverter,
        merge: true,
      });
    },
    async linkJiraIssuesToClip(input: {
      clipId: string;
      issues: StoryVaultRelatedContextJiraIssue[];
      siteName?: string;
      siteUrl?: string;
    }): Promise<void> {
      const clip = this.clips.find((item) => item.id === input.clipId);
      if (!clip) {
        throw new Error("紐付け対象のクリップが見つかりません");
      }
      const existing = clip.relatedContexts?.jira?.issues ?? [];
      const merged = new Map(
        existing.map((issue) => [`${issue.cloudId}:${issue.key}`, issue])
      );
      for (const issue of input.issues) {
        if (!issue.key.trim() || !issue.summary.trim()) continue;
        const key = `${issue.cloudId}:${issue.key}`;
        merged.set(key, {
          ...issue,
          relevanceScore: issue.relevanceScore || 100,
          reason: issue.reason || "ユーザーが手動でクリップに紐付けました",
          matchedSignals:
            issue.matchedSignals.length > 0
              ? issue.matchedSignals
              : ["手動紐付け"],
        });
      }
      const firstIssue = input.issues[0] ?? existing[0];
      const jira = {
        cloudId:
          firstIssue?.cloudId || clip.relatedContexts?.jira?.cloudId || "",
        siteName:
          input.siteName || clip.relatedContexts?.jira?.siteName || "",
        siteUrl: input.siteUrl || clip.relatedContexts?.jira?.siteUrl || "",
        checkedAt: nowIso(),
        issues: Array.from(merged.values()),
        errorMessage: undefined,
      };
      await this.persistClip({
        ...clip,
        relatedContexts: {
          ...clip.relatedContexts,
          jira,
          generatedAt: nowIso(),
          status: "completed",
          runningProvider: undefined,
          notes: (clip.relatedContexts?.notes ?? []).filter(Boolean),
        },
      });
      this.lastRunLog.unshift(
        `Jira: ${input.issues.length}件のIssueを「${clip.title}」に紐付け`
      );
    },
    async linkKnowledgeDocumentsToClip(input: {
      clipId: string;
      fileSpaceId: string;
      documents: StoryVaultRelatedContextKnowledgeDocument[];
    }): Promise<void> {
      const clip = this.clips.find((item) => item.id === input.clipId);
      if (!clip) throw new Error("紐付け対象のクリップが見つかりません");
      if (!input.fileSpaceId) throw new Error("FileSpaceが設定されていません");
      const existing = clip.relatedContexts?.knowledge?.documents ?? [];
      const merged = new Map(
        existing.map((document) => [document.documentId || document.name || "", document])
      );
      for (const document of input.documents) {
        const key = document.documentId || document.name || "";
        if (!key) continue;
        merged.set(key, {
          ...document,
          relevanceScore: document.relevanceScore || 100,
          reason: document.reason || "ユーザーがナレッジ一覧から手動でクリップに紐付けました",
          matchedSignals: document.matchedSignals.length ? document.matchedSignals : ["手動紐付け"],
        });
      }
      await this.persistClip({
        ...clip,
        relatedContexts: {
          ...clip.relatedContexts,
          knowledge: {
            fileSpaceId: input.fileSpaceId,
            checkedAt: nowIso(),
            documents: Array.from(merged.values()),
            errorMessage: undefined,
          },
          generatedAt: nowIso(),
          status: "completed",
          runningProvider: undefined,
          notes: (clip.relatedContexts?.notes ?? []).filter(Boolean),
        },
      });
      this.lastRunLog.unshift(
        `ボルトナレッジ: ${input.documents.length}件を「${clip.title}」に紐付け`
      );
    },
    async unlinkKnowledgeDocumentFromClip(input: {
      clipId: string;
      documentId: string;
    }): Promise<void> {
      const clip = this.clips.find((item) => item.id === input.clipId);
      const knowledge = clip?.relatedContexts?.knowledge;
      if (!clip || !knowledge) return;
      await this.persistClip({
        ...clip,
        relatedContexts: {
          ...clip.relatedContexts,
          knowledge: {
            ...knowledge,
            documents: knowledge.documents.filter(
              (document) => (document.documentId || document.name || "") !== input.documentId
            ),
            checkedAt: nowIso(),
          },
          generatedAt: nowIso(),
          status: "completed",
          runningProvider: undefined,
          notes: knowledge.errorMessage
            ? (clip.relatedContexts?.notes ?? []).filter(Boolean)
            : clip.relatedContexts?.notes ?? [],
        },
      });
      this.lastRunLog.unshift(`ボルトナレッジ: ${input.documentId}の紐付けを解除`);
    },
    async unlinkJiraIssueFromClip(input: {
      clipId: string;
      issueKey: string;
      cloudId?: string;
    }): Promise<void> {
      const clip = this.clips.find((item) => item.id === input.clipId);
      const jira = clip?.relatedContexts?.jira;
      if (!clip || !jira) return;
      const issues = jira.issues.filter(
        (issue) =>
          !(
            issue.key === input.issueKey &&
            (!input.cloudId || issue.cloudId === input.cloudId)
          )
      );
      await this.persistClip({
        ...clip,
        relatedContexts: {
          ...clip.relatedContexts,
          jira: {
            ...jira,
            issues,
            checkedAt: nowIso(),
          },
          generatedAt: nowIso(),
          status: "completed",
          runningProvider: undefined,
          notes: clip.relatedContexts?.notes ?? [],
        },
      });
      this.lastRunLog.unshift(`Jira: ${input.issueKey}の紐付けを解除`);
    },
    buildZappingAnalysisModeState(params: {
      application: DecodedStoryVaultApplication;
      clip: DecodedStoryVaultClip;
      analysisSessionId: string;
      prompt?: string;
    }): Record<string, unknown> {
      const sourceAssets = this.sourceAssetPayloadForApplication(
        params.application.id
      );
      const clip = params.clip;
      return {
        active_mode: "storyvault_zapping_analysis",
        storyvault_zapping_analysis: {
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
            clip_id: clip.id,
            clip_group_id: clip.clipGroupId,
            clip_storage_path: clip.storagePath,
            clip_bucket_name: clip.bucketName,
            clip_content_type: clip.contentType,
            clip_duration_ms: clip.durationMs,
          },
          payload: {
            clip: {
              id: clip.id,
              title: clip.title,
              description: clip.description,
              quickScan: clip.quickScan,
              transcriptText: clip.transcriptText,
              transcriptProvider: clip.transcriptProvider,
              transcriptSummary: clip.transcriptSummary,
              transcriptSegments: clip.transcriptSegments ?? [],
              transcriptSrt: clip.transcriptSrt,
              transcriptTimingStatus: clip.transcriptTimingStatus ?? "unavailable",
              fileName: clip.fileName,
              bucketName: clip.bucketName,
              storagePath: clip.storagePath,
              contentType: clip.contentType,
              sizeBytes: clip.sizeBytes,
              durationMs: clip.durationMs,
              frameCaptures: clip.frameCaptures,
              recordedAt: clip.recordedAt,
              sourceDisplaySurface: clip.sourceDisplaySurface,
              sourceAssetId: clip.sourceAssetId,
              journeySourceAssetId: clip.journeySourceAssetId,
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
                "クリップの操作意図を、事業・プロダクト背景を含むFileSpace文脈で解釈する",
            },
          },
        },
      };
    },
    buildRelatedContextModeState(params: {
      application: DecodedStoryVaultApplication;
      clip: DecodedStoryVaultClip;
      sessionId: string;
      organizationId: string;
      spaceId: string;
      userId: string;
      provider: "github" | "slack" | "knowledge" | "jira";
      prompt?: string;
    }): Record<string, unknown> {
      const clip = params.clip;
      return {
        active_mode: "storyvault_related_context",
        storyvault_related_context: {
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
            clip_id: clip.id,
            clip_group_id: clip.clipGroupId,
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
            clip: {
              id: clip.id,
              title: clip.title,
              description: clip.description,
              quickScan: clip.quickScan,
              transcriptSummary: clip.transcriptSummary,
              transcriptProvider: clip.transcriptProvider,
              frameCaptures: clip.frameCaptures,
              recordedAt: clip.recordedAt,
              sourceDisplaySurface: clip.sourceDisplaySurface,
            },
            analysis_result: clip.analysisResult,
            existing_related_contexts: clip.relatedContexts,
            user_notes: params.prompt?.trim() || undefined,
            expected_outputs:
              params.provider === "slack"
                ? ["slack_messages", "related_reasons"]
                : params.provider === "knowledge"
                  ? ["knowledge_documents", "downloadable_file_refs", "related_reasons"]
                  : params.provider === "jira"
                    ? ["jira_issues", "related_reasons"]
                    : ["github_pull_requests", "related_reasons"],
          },
        },
      };
    },
    buildVibeGenerationModeState(params: {
      mode: StoryVaultSeparatedAdkMode;
      application: DecodedStoryVaultApplication;
      generationSessionId: string;
      capability?: DecodedStoryVaultCapability | null;
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
                "クリップ由来のリッチ証跡をFileSpace/Vertex AI Searchから検索し、Capability/Story候補の一次根拠として使う",
            },
          },
        },
      };
    },
    async startCapabilityStructuring(
      input: StoryVaultGenerationAgentInput
    ): Promise<string> {
      const started = await useStoryVaultClipCommands().create({
        operation: "capabilityStructuring",
        applicationId: input.applicationId,
        payload: { prompt: input.prompt },
      });
      void useStoryVaultClipCommands().wait(started.requestPath).then(() => this.fetchData());
      return started.requestId;
    },
    async startStoryGeneration(
      input: StoryVaultGenerationAgentInput
    ): Promise<string> {
      const started = await useStoryVaultClipCommands().create({
        operation: "storyGeneration",
        applicationId: input.applicationId,
        payload: { prompt: input.prompt, capabilityId: input.capabilityId },
      });
      void useStoryVaultClipCommands().wait(started.requestPath).then(() => this.fetchData());
      return started.requestId;
    },
    async startZappingVideoAnalysis(
      input: StoryVaultZappingVideoAnalysisInput
    ): Promise<string> {
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const clip = this.clips.find(
        (item) => item.id === input.clipId && item.applicationId === application.id
      );
      if (!clip) {
        throw new Error("対象クリップが見つかりません");
      }
      if (
        clip.analysisStatus === "completed" ||
        Boolean(clip.analysisResult)
      ) {
        throw new Error("ユーザーストーリー解析は完了済みです");
      }
      const fileSpaceId = application.fileSpaceId?.trim();
      if (!fileSpaceId) {
        throw new Error("ユーザーストーリー解析に使うアプリ専用FileSpace IDを設定してください");
      }
      assertTimestampedTranscript([clip]);

      const orgId = useOrganizationStore().loggedInOrganizationInfo?.id ?? "";
      const spaceId = useSpaceStore().selectedSpace?.id ?? "";
      const uid = getAuth().currentUser?.uid;
      if (!orgId || !spaceId || !uid) {
        throw new Error("組織・スペース・ログイン状態を確認してください");
      }

      const analysisSessionId = `storyvault-zapping-analysis-${application.id}-${clip.id}-${Date.now()}-${createRandomDocId()}`;
      const responseId = `zapping-analysis-response-${createRandomDocId()}`;
      const modeState = this.buildZappingAnalysisModeState({
        application,
        clip,
        analysisSessionId,
        prompt: input.prompt,
      });
      const prompt =
        input.prompt?.trim() ||
        [
          `${application.name} の操作クリップ「${clip.title}」を解析してください。`,
          "このRequestDocには操作クリップファイルを添付しています。クリップ内の画面遷移と音声を第一情報源として扱ってください。",
          "アプリ専用FileSpaceのVertex AI Searchを参照し、事業背景・プロダクト背景・既存ナレッジを踏まえてクリップの操作意図を解釈してください。",
          "クリップからUser Story候補を抽出し、各Storyに根拠となるクリップタイムレンジ、代表スクリーンショット、関連スクリーンショットを紐付けてください。",
          "5秒ごとのスクリーンショットと簡易スキャンメモも補助情報として参照してください。",
        ].join("\n");

      this.isAnalyzingZappingVideos = true;
      this.error = null;
      try {
        const queuedClip: DecodedStoryVaultClip = {
          ...clip,
          analysisStatus: "queued",
          analysisSessionId,
          analysisOrganizationId: orgId,
          analysisSpaceId: spaceId,
          analysisErrorMessage: undefined,
        };
        await this.persistClip(queuedClip);

        const commandApi = useStoryVaultClipCommands();
        const started = await commandApi.create({
          operation: "zappingAnalysis",
          applicationId: application.id,
          clipGroupId: clip.clipGroupId,
          clipIds: [clip.id],
          payload: { prompt, modeState, responseId },
        });
        const requestId = started.requestId;

        await this.persistClip({
          ...queuedClip,
          analysisRequestId: requestId,
          analysisStatus: "running",
        });
        this.lastRunLog.unshift(
          `ユーザーストーリー解析: ${application.name} / ${clip.title} の解析を開始`
        );

        void commandApi.wait(started.requestPath).then(
          async () => {
            await this.fetchData();
          },
          async (error) => {
            await this.persistClip({
              ...queuedClip,
              analysisRequestId: requestId,
              analysisStatus: "error",
              analysisErrorMessage:
                error instanceof Error ? error.message : "解析に失敗しました",
            });
          }
        );

        return requestId;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "ユーザーストーリー解析の開始に失敗しました";
        await this.persistClip({
          ...clip,
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
      const targets = this.clips.filter(
        (video) =>
          video.applicationId === applicationId &&
          video.analysisStatus !== "queued" &&
          video.analysisStatus !== "running" &&
          video.analysisStatus !== "completed" &&
          !video.analysisResult
      );
      const requestIds: string[] = [];
      for (const clip of targets) {
        requestIds.push(
          await this.startZappingVideoAnalysis({
            applicationId,
            clipId: clip.id,
          })
        );
      }
      return requestIds;
    },
    async startRelatedContextAnalysis(
      input: StoryVaultRelatedContextAnalysisInput
    ): Promise<string> {
      const application = this.applications.find(
        (item) => item.id === input.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      const clip = this.clips.find(
        (item) => item.id === input.clipId && item.applicationId === application.id
      );
      if (!clip) {
        throw new Error("対象クリップが見つかりません");
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

      const sessionId = `storyvault-related-context-${application.id}-${clip.id}-${Date.now()}-${createRandomDocId()}`;
      const responseId = `related-context-response-${createRandomDocId()}`;
      const modeState = this.buildRelatedContextModeState({
        application,
        clip,
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
              `${application.name} の操作クリップ「${clip.title}」に関連するFileSpaceナレッジを探してください。`,
              "クリップ解析結果、操作メモ、文字起こし要約、Story候補と、Search Store内のファイル名・説明・本文・引用を照合してください。",
              "音声メモ、Markdown設計書、アーキテクチャ図、投入ファイルなど、実装やリリースノート作成に役立つファイルだけを返してください。",
              "関連する理由を日本語で付け、関連度の高いナレッジファイルだけを最大10件返してください。",
            ]
          : input.provider === "slack"
          ? [
              `${application.name} の操作クリップ「${clip.title}」に関連するSlack会話を探してください。`,
              "クリップ解析結果、操作メモ、文字起こし要約、Story候補と、Slack投稿・スレッド・チャンネルを照合してください。",
              "関連する理由を日本語で付け、関連度の高い会話だけを返してください。",
            ]
          : input.provider === "jira"
          ? [
              `${application.name} の操作クリップ「${clip.title}」に関連するJira Issueを探してください。`,
              "クリップ解析結果、操作メモ、文字起こし要約、Story候補と、Jira Issueの要約・説明・ステータス・ラベル・プロジェクトを照合してください。",
              "関連する理由を日本語で付け、関連度の高いIssueだけを最大10件返してください。",
            ]
          : [
              `${application.name} の操作クリップ「${clip.title}」に関連するGitHub Pull Requestを探してください。`,
              "クリップ解析結果、操作メモ、文字起こし要約、Story候補と、GitHub PRのタイトル・本文・ラベル・変更ファイルを照合してください。",
              "関連する理由を日本語で付け、関連度の高いPRだけを返してください。",
            ]).join("\n");

      this.isFetchingRelatedContexts = true;
      this.error = null;
      try {
        await this.persistClip({
          ...clip,
          relatedContexts: {
            ...clip.relatedContexts,
            generatedAt: nowIso(),
            status: "running",
            runningProvider: input.provider,
            notes: [],
            github:
              input.provider === "github"
                ? clip.relatedContexts?.github ?? {
                    repoFullName: application.repoFullName,
                    checkedAt: nowIso(),
                    pullRequests: [],
                  }
                : clip.relatedContexts?.github,
            slack:
              input.provider === "slack"
                ? clip.relatedContexts?.slack ?? {
                    checkedAt: nowIso(),
                    messages: [],
                  }
                : clip.relatedContexts?.slack,
            knowledge:
              input.provider === "knowledge"
                ? clip.relatedContexts?.knowledge ?? {
                    fileSpaceId: fileSpaceId || "",
                    checkedAt: nowIso(),
                    documents: [],
                  }
                : clip.relatedContexts?.knowledge,
            jira:
              input.provider === "jira"
                ? clip.relatedContexts?.jira ?? {
                    cloudId: "",
                    siteName: "",
                    siteUrl: "",
                    checkedAt: nowIso(),
                    issues: [],
                  }
                : clip.relatedContexts?.jira,
          },
        });

        const requestId = await createAdkInvokeRequest({
          organizationId: orgId,
          spaceId,
          input: buildAdkInvokeInput({
            mode: "storyvault_related_context",
            sessionId,
            organizationId: orgId,
            spaceId,
            userId: uid,
            prompt,
            responseId,
            model: defaultLlmModelSelectionForAdkMode("storyvault_related_context"),
            fileSpaceId: fileSpaceId ?? null,
            workspaceId: application.id,
            history: [],
            modeState,
          }),
        });

        this.lastRunLog.unshift(
          `Related Context: ${application.name} / ${clip.title} の${
            input.provider === "slack"
              ? "Slack会話"
              : input.provider === "knowledge"
                ? "ナレッジ"
                : input.provider === "jira"
                  ? "Jira Issue"
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
              clipId: clip.id,
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
        await this.persistClip({
          ...clip,
          relatedContexts: {
            ...clip.relatedContexts,
            generatedAt: nowIso(),
            status: "error",
            runningProvider: undefined,
            notes: [message],
            github: clip.relatedContexts?.github,
            slack: clip.relatedContexts?.slack,
            knowledge: clip.relatedContexts?.knowledge,
            jira: clip.relatedContexts?.jira,
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
    }): Promise<StoryVaultZappingAnalysisResult | undefined> {
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
    }): Promise<StoryVaultRelatedContextResult | undefined> {
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
      input: StoryVaultGenerationAgentInput & {
        mode: StoryVaultSeparatedAdkMode;
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
        throw new Error("StoryVault ADKに渡すFileSpace IDを設定してください");
      }

      const orgId = useOrganizationStore().loggedInOrganizationInfo?.id ?? "";
      const spaceId = useSpaceStore().selectedSpace?.id ?? "";
      const uid = getAuth().currentUser?.uid;
      if (!orgId || !spaceId || !uid) {
        throw new Error("組織・スペース・ログイン状態を確認してください");
      }

      const phase =
        input.mode === "storyvault_capability_structuring"
          ? "capability_structuring"
          : "story_generation";
      const generationSessionId = `storyvault-${phase}-${application.id}-${Date.now()}-${createRandomDocId()}`;
      const responseId = `${phase}-response-${createRandomDocId()}`;
      const capability = input.capabilityId?.trim()
        ? this.capabilities.find((item) => item.id === input.capabilityId)
        : undefined;
      const sourceAssets = this.sourceAssets.filter(
        (asset) => asset.applicationId === application.id
      );
      const zappingKnowledgePipeline =
        this.zappingKnowledgePipelineForApplication(application.id);
      const generationSession: DecodedStoryVaultGenerationSession = {
        id: generationSessionId,
        applicationId: application.id,
        applicationKey: application.applicationKey,
        phase,
        adkMode: input.mode,
        responseId,
        capabilityAdkSessionId:
          input.mode === "storyvault_capability_structuring"
            ? generationSessionId
            : undefined,
        storyAdkSessionIds:
          input.mode === "storyvault_story_generation" ? [generationSessionId] : [],
        activeCapabilityId:
          input.mode === "storyvault_story_generation" ? capability?.id : undefined,
        status: "running",
        lastMessage:
          input.mode === "storyvault_capability_structuring"
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
          clipCount: sourceAssets.filter((asset) =>
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
          (input.mode === "storyvault_capability_structuring"
            ? [
                `${application.name} のCapability構造案を作成してください。`,
                "クリップから抽出してFileSpace/Vertex AI Searchへ登録したザッピング証跡を一次根拠として参照してください。",
                "参照対象はクリップメタデータ、操作Journey、5秒ごとのスクリーンショット、Gemini全文文字起こし、文字起こし要約、操作ステップです。",
                "SourceAssetの生データだけで完結させず、Search Store上の文脈を検索して業務能力の境界を決めてください。",
              ].join("\n")
            : capability
              ? [
                  `${application.name} の ${capability.name} 配下に置くユーザーストーリー案を生成してください。`,
                  "クリップから抽出してFileSpace/Vertex AI Searchへ登録したザッピング証跡を一次根拠として参照してください。",
                  "クリップの全文文字起こし、要約、操作ステップ、スクリーンショット群を検索し、ユーザーの意図と業務文脈が分かるStory/Acceptance Criteriaにしてください。",
                ].join("\n")
              : [
                  `${application.name} の既存Capability群に紐づくユーザーストーリー案を生成してください。`,
                  "クリップから抽出してFileSpace/Vertex AI Searchへ登録したザッピング証跡を一次根拠として参照してください。",
                  "クリップの全文文字起こし、要約、操作ステップ、スクリーンショット群を検索し、Capabilityごとのユーザー目的に落とし込んでください。",
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

        const startedSession: DecodedStoryVaultGenerationSession = {
          ...generationSession,
          requestId,
          lastMessage: `${input.mode} RequestDocを発行しました`,
        };
        await this.persistGenerationSession(startedSession);
        this.lastRunLog.unshift(
          input.mode === "storyvault_capability_structuring"
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
          err instanceof Error ? err.message : "StoryVault ADKの開始に失敗しました";
        const failedSession: DecodedStoryVaultGenerationSession = {
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
      clipId: string;
      requestId: string;
      status: RequestStatus;
      errorMessage?: string;
      output?: AdkInvokeOutput;
    }): Promise<void> {
      const clip = this.clips.find((item) => item.id === params.clipId);
      if (!clip || clip.analysisRequestId !== params.requestId) return;
      const nextStatus: DecodedStoryVaultClip["analysisStatus"] =
        params.status === "completed"
          ? "completed"
          : params.status === "error"
            ? "error"
            : "running";
      const completedSessionId =
        (params.output && typeof params.output === "object" && "sessionId" in params.output
          ? params.output.sessionId
          : undefined) || clip.analysisSessionId;
      const outputResult = extractZappingAnalysisResultCandidate(params.output);
      const analysisOrganizationId =
        clip.analysisOrganizationId ||
        useOrganizationStore().loggedInOrganizationInfo?.id ||
        "";
      const analysisSpaceId =
        clip.analysisSpaceId || useSpaceStore().selectedSpace?.id || "";
      let analysisResult = outputResult;
      if (!analysisResult && params.status === "completed" && completedSessionId) {
        try {
          analysisResult = await this.fetchZappingAnalysisResultFromSession({
            organizationId: analysisOrganizationId,
            spaceId: analysisSpaceId,
            sessionId: completedSessionId,
          });
        } catch (err) {
          log("WARN", "StoryVault zapping analysis fetch failed", {
            clipId: clip.id,
            sessionId: completedSessionId,
            err,
          });
        }
      }
      const keyedAnalysisResult = analysisResult
        ? assignStoryKeysToZappingAnalysisResult({
            applicationId: clip.applicationId,
            result: normalizeZappingAnalysisResultEvidence({
              result: analysisResult,
              clip,
            }),
            stories: this.stories,
            clips: this.clips.filter(
              (item) => item.id !== clip.id
            ),
          })
        : undefined;
      await this.persistClip({
        ...clip,
        analysisStatus: nextStatus,
        analysisSessionId: completedSessionId || clip.analysisSessionId,
        analysisOrganizationId,
        analysisSpaceId,
        analysisErrorMessage:
          params.status === "completed"
            ? keyedAnalysisResult
              ? ""
              : "ADKは完了しましたが、解析結果をsession stateから取得できませんでした"
            : params.errorMessage || "",
        analyzedAt: params.status === "completed" ? nowIso() : clip.analyzedAt,
        analysisResult: keyedAnalysisResult ?? clip.analysisResult,
      });
    },
    async reconcileZappingVideoAnalysisRequests(): Promise<void> {
      const candidates = this.clips
        .filter(
          (video) =>
            (video.analysisStatus === "queued" ||
              video.analysisStatus === "running") &&
            Boolean(video.analysisRequestId)
        )
        .slice(0, 10);
      if (candidates.length === 0) return;

      await Promise.all(
        candidates.map(async (clip) => {
          const organizationId =
            clip.analysisOrganizationId ||
            useOrganizationStore().loggedInOrganizationInfo?.id ||
            "";
          const spaceId =
            clip.analysisSpaceId || useSpaceStore().selectedSpace?.id || "";
          const requestId = clip.analysisRequestId || "";
          if (!organizationId || !spaceId || !requestId) return;
          try {
            const snap = await getDoc(
              doc(
                getFirestore(),
                "organizations",
                organizationId,
                "spaces",
                spaceId,
                "requests",
                "adkInvokeRequests",
                "logs",
                requestId
              )
            );
            if (!snap.exists()) return;
            const data = snap.data();
            const status = (data.status as RequestStatus | undefined) ?? "pending";
            if (status !== "completed" && status !== "error") return;
            await this.updateZappingVideoAnalysisStatus({
              clipId: clip.id,
              requestId,
              status,
              errorMessage:
                typeof data.errorMessage === "string"
                  ? data.errorMessage
                  : undefined,
              output: data.output as AdkInvokeOutput | undefined,
            });
          } catch (err) {
            log("WARN", "StoryVault zapping analysis reconcile failed", {
              clipId: clip.id,
              requestId,
              err,
            });
          }
        })
      );
    },
    async updateRelatedContextAnalysisStatus(params: {
      clipId: string;
      requestId: string;
      sessionId: string;
      organizationId: string;
      spaceId: string;
      status: RequestStatus;
      errorMessage?: string;
      output?: AdkInvokeOutput;
    }): Promise<void> {
      const clip = this.clips.find((item) => item.id === params.clipId);
      if (!clip) return;
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
                  clip.relatedContexts?.github?.repoFullName ||
                  this.applications.find(
                    (application) => application.id === clip.applicationId
                  )?.repoFullName ||
                  result.github.repoFullName,
              }
            : clip.relatedContexts?.github;
      const nextSlack = result?.slack ?? clip.relatedContexts?.slack;
      const nextKnowledge = result?.knowledge ?? clip.relatedContexts?.knowledge;
      const nextJira = result?.jira ?? clip.relatedContexts?.jira;
      await this.persistClip({
        ...clip,
        relatedContexts: {
          ...clip.relatedContexts,
          generatedAt: result?.generatedAt ?? nowIso(),
          status: params.status === "completed" && result ? result.status : "error",
          runningProvider: undefined,
          notes: result?.notes ?? (message ? [message] : []),
          github: nextGithub,
          slack: nextSlack,
          knowledge: nextKnowledge,
          jira: nextJira,
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
        (session.adkMode === "storyvault_capability_structuring" ||
          session.adkMode === "storyvault_story_generation") &&
        artifactCount === 0;
      const nextStatus: DecodedStoryVaultGenerationSession["status"] =
        completedWithoutArtifact
          ? "error"
          : params.status === "completed"
          ? "waiting_user"
          : params.status === "error"
            ? "error"
            : "running";
      const noArtifactMessage =
        session.adkMode === "storyvault_capability_structuring"
          ? "Capability構造案が生成されませんでした。SourceAsset / Evidence / Story を取り込んでから再実行してください"
          : "Story生成案が生成されませんでした。Capability と根拠データを確認してから再実行してください";
      const nextSession: DecodedStoryVaultGenerationSession = {
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
              converter: storyVaultApplicationConverter,
              merge: true,
            })
          ),
          ...this.stories.map((story) =>
            firestoreOps.createDocument({
              collectionName: this.storyCollectionPath(),
              docId: story.id || `story_${createRandomDocId()}`,
              docData: story,
              converter: storyVaultStoryConverter,
              merge: true,
            })
          ),
          ...this.evidence.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.evidenceCollectionPath(),
              docId: item.id || `evidence_${createRandomDocId()}`,
              docData: item,
              converter: storyVaultStoryEvidenceConverter,
              merge: true,
            })
          ),
          ...this.sourceConnections.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.sourceConnectionCollectionPath(),
              docId: item.id || `source_${createRandomDocId()}`,
              docData: item,
              converter: storyVaultSourceConnectionConverter,
              merge: true,
            })
          ),
          ...this.clips.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.clipCollectionPath(),
              docId: item.id || `clip_${createRandomDocId()}`,
              docData: item,
              converter: storyVaultClipConverter,
              merge: true,
            })
          ),
          ...this.capabilities.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.capabilityCollectionPath(),
              docId: item.id || `capability_${createRandomDocId()}`,
              docData: item,
              converter: storyVaultCapabilityConverter,
              merge: true,
            })
          ),
          ...this.sourceAssets.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.sourceAssetCollectionPath(),
              docId: item.id || `source_asset_${createRandomDocId()}`,
              docData: item,
              converter: storyVaultSourceAssetConverter,
              merge: true,
            })
          ),
          ...this.generationSessions.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.generationSessionCollectionPath(),
              docId: item.id || `generation_session_${createRandomDocId()}`,
              docData: item,
              converter: storyVaultGenerationSessionConverter,
              merge: true,
            })
          ),
          ...this.draftPatches.map((item) =>
            firestoreOps.createDocument({
              collectionName: this.draftPatchCollectionPath(),
              docId: item.id || `draft_patch_${createRandomDocId()}`,
              docData: item,
              converter: storyVaultDraftPatchConverter,
              merge: true,
            })
          ),
        ]);
        this.lastRunLog.push("Firestore: 現在のSSOT snapshotを保存");
      } catch (err) {
        log("ERROR", "StoryVault persist failed", err);
        this.error = err instanceof Error ? err.message : "SSOT保存に失敗しました";
      } finally {
        this.isLoading = false;
      }
    },
    buildOperationVideoMarkdown(params: {
      application: DecodedStoryVaultApplication;
      videoId: string;
      title: string;
      description?: string;
      bucketName: string;
      storagePath: string;
      contentType: string;
      sizeBytes: number;
      durationMs?: number;
      recordedAt: string;
      sourceDisplaySurface?: StoryVaultOperationVideoDisplaySurface;
      tags?: string[];
      transcriptText?: string;
      transcriptProvider?: string;
      transcriptSummary?: string;
      transcriptSegments?: StoryVaultTranscriptCue[];
      transcriptSrt?: string;
      transcriptTimingStatus?: StoryVaultTranscriptTimingStatus;
      quickScan?: StoryVaultClipSaveInput["quickScan"];
      frameCaptures?: NonNullable<
        DecodedStoryVaultClip["frameCaptures"]
      >;
    }): string {
      return buildOperationVideoMetadataMarkdown(params);
    },
    async uploadClipAsset(params: {
      application: DecodedStoryVaultApplication;
      group: DecodedStoryVaultClipGroup;
      clipId: string;
      input: StoryVaultClipSaveInput;
      title: string;
      description?: string;
      organizationId: string;
      spaceId: string;
    }): Promise<{
      clip: StoryVaultOperationVideoClip;
      sourceAssets: DecodedStoryVaultSourceAsset[];
      discoveryStatus: DecodedStoryVaultClip["discoveryStatus"];
      discoveryErrorMessage?: string;
    }> {
      const { application, group, clipId, input, title } = params;
      const fileSpaceId = application.fileSpaceId?.trim();
      const contextStore = useContextStore();
      const storageOps = useFirebaseStorageOperations();
      const config = useRuntimeConfig();
      const bucketName = resolveStorageBucketName(
        config.public.firebase.storageBucket
      );
      const now = nowIso();
      const safeTitle = toDocId(title, "clip");
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
      const transcriptTimingStatus: StoryVaultTranscriptTimingStatus =
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
        `storyVault/applications/${application.id}/clips/${clipId}/${fileName}`
      );

      const uploaded = await storageOps.uploadPdfFile({
        bucketName,
        filePath: storagePath,
        rawData: input.blob,
        mimeType: contentType,
      });
      if (!uploaded) {
        throw new Error("クリップのFirebase Storage保存に失敗しました");
      }

      const frameCaptures: NonNullable<
        DecodedStoryVaultClip["frameCaptures"]
      > = [];
      for (const [index, frame] of (input.frameCaptures ?? []).entries()) {
        if (frame.blob.size <= 0) continue;
        const frameId = `frame-${String(index + 1).padStart(3, "0")}`;
        const frameContentType = frame.contentType || frame.blob.type || "image/jpeg";
        const frameFileName = `${safeTitle}-${timestamp}-${clipId}-${frameId}.jpg`;
        const frameStoragePath = contextStore.baseGcsPath(
          `storyVault/applications/${application.id}/clips/${clipId}/frames/${frameFileName}`
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

      const metadataFileName = `${safeTitle}-${timestamp}.md`;
      const metadataMarkdown = this.buildOperationVideoMarkdown({
        application,
        videoId: clipId,
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
      const journeyFileName = `${safeTitle}-${timestamp}-journey.md`;
      const journeyMarkdown = buildOperationVideoJourneyMarkdown({
        application,
        videoId: clipId,
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
      const sourceAssetId = `source-asset-${clipId}`;
      const journeySourceAssetId = `source-asset-${clipId}-journey`;

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
              documentId: `storyvault-clip-${clipId}`,
              description: `StoryVault clip metadata: ${title}`,
              customMetadata: [
                { key: "source", value: "storyvault-clip" },
                { key: "applicationId", value: application.id },
                { key: "applicationKey", value: application.applicationKey },
                { key: "clipId", value: clipId },
                { key: "clipGroupId", value: group.id },
                { key: "clipGroupName", value: group.name },
                { key: "sourceAssetId", value: sourceAssetId },
                { key: "clipStoragePath", value: storagePath },
                { key: "documentKind", value: "clip_metadata" },
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
            requestErrors.push("クリップメタデータのFileSpace upload RequestDoc作成に失敗しました");
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
              documentId: `storyvault-clip-journey-${clipId}`,
              description: `StoryVault operation journey evidence: ${title}`,
              customMetadata: [
                { key: "source", value: "storyvault-clip-journey" },
                { key: "applicationId", value: application.id },
                { key: "applicationKey", value: application.applicationKey },
                { key: "applicationName", value: application.name },
                { key: "repoFullName", value: application.repoFullName },
                { key: "clipId", value: clipId },
                { key: "clipGroupId", value: group.id },
                { key: "clipGroupName", value: group.name },
                { key: "sourceAssetId", value: journeySourceAssetId },
                { key: "clipStoragePath", value: storagePath },
                { key: "documentKind", value: "clip_journey" },
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

      const discoveryStatus: DecodedStoryVaultClip["discoveryStatus"] =
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
            : "アプリ専用FileSpaceが未設定のため、クリップのみ保存しました";

      const clip: StoryVaultOperationVideoClip = {
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

      const sourceAssets: DecodedStoryVaultSourceAsset[] = [
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
          discoveryDocumentId: `storyvault-clip-${clipId}`,
          discoveryErrorMessage: !fileSpaceId
            ? "アプリ専用FileSpaceが未設定のため、Discovery Engine登録は未実行です"
            : fileSpaceRequestId
              ? undefined
              : "クリップメタデータのDiscovery Engine登録に失敗しました",
          metadata: {
            clipId,
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
            clipGroupId: group.id,
            clipGroupName: group.name,
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
            "クリップから生成したユーザージャーニー検索用証跡",
          uri: `gs://${bucketName}/${journeyStoragePath}`,
          gcsPath: `gs://${bucketName}/${journeyStoragePath}`,
          storagePath: journeyStoragePath,
          fileSpaceId: fileSpaceId || undefined,
          fileSpaceRequestId: journeyFileSpaceRequestId,
          discoveryStatus: journeyFileSpaceRequestId ? "queued" : "error",
          discoveryDocumentId: `storyvault-clip-journey-${clipId}`,
          discoveryErrorMessage: journeyFileSpaceRequestId
            ? undefined
            : "操作JourneyのDiscovery Engine登録に失敗しました",
          metadata: {
            clipId,
            clipStoragePath: storagePath,
            transcriptProvider,
            transcriptText,
            transcriptSummary,
            transcriptSegments,
            transcriptSrt,
            transcriptTimingStatus,
            tags,
            sourceDisplaySurface: input.sourceDisplaySurface ?? "unknown",
            clipGroupId: group.id,
            clipGroupName: group.name,
          },
        });
      }

      return { clip, sourceAssets, discoveryStatus, discoveryErrorMessage };
    },
    async saveClipCapture(
      input: StoryVaultClipSaveInput
    ): Promise<DecodedStoryVaultClip> {
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
        throw new Error("クリップタイトルを入力してください");
      }
      const group = this.clipGroups.find(
        (item) =>
          item.id === input.clipGroupId &&
          item.applicationId === application.id
      );
      if (!group) {
        throw new Error("クリップグループを選択してください");
      }
      if (input.blob.size <= 0) {
        throw new Error("録画データが空です");
      }

      this.isSavingOperationVideo = true;
      this.error = null;

      try {
        const clipId = `clip-${createRandomDocId()}`;
        const description = input.description?.trim() || undefined;
        const { clip, sourceAssets, discoveryStatus, discoveryErrorMessage } =
          await this.uploadClipAsset({
            application,
            group,
            clipId,
            input,
            title,
            description,
            organizationId,
            spaceId,
          });
        const savedClip: DecodedStoryVaultClip = {
          ...clip,
          id: clipId,
          applicationId: application.id,
          applicationKey: application.applicationKey,
          clipGroupId: group.id,
          clipGroupNameSnapshot: group.name,
          title,
          description,
          tags:
            input.tags
              ?.map((tag) => tag.trim())
              .filter((tag, index, arr) => tag && arr.indexOf(tag) === index) ?? [],
          fileSpaceId,
          discoveryStatus,
          discoveryErrorMessage,
          analysisStatus: "not_analyzed",
        };
        const nextGroup: DecodedStoryVaultClipGroup = {
          ...group,
          clipCount: this.clipCountForGroup(group.id) + 1,
        };
        const firestoreOps = useFirestoreDocOperation();
        await Promise.all([
          firestoreOps.createDocument({
            collectionName: this.clipCollectionPath(),
            docId: savedClip.id,
            docData: savedClip,
            converter: storyVaultClipConverter,
            merge: true,
          }),
          firestoreOps.createDocument({
            collectionName: this.clipGroupCollectionPath(),
            docId: nextGroup.id,
            docData: nextGroup,
            converter: storyVaultClipGroupConverter,
            merge: true,
          }),
          ...sourceAssets.map((asset) =>
            firestoreOps.createDocument({
              collectionName: this.sourceAssetCollectionPath(),
              docId: asset.id,
              docData: asset,
              converter: storyVaultSourceAssetConverter,
              merge: true,
            })
          ),
        ]);
        this.clips = [
          savedClip,
          ...this.clips.filter((item) => item.id !== savedClip.id),
        ];
        this.clipGroups = this.clipGroups.map((item) =>
          item.id === nextGroup.id ? nextGroup : item
        );
        this.sourceAssets = [
          ...sourceAssets,
          ...this.sourceAssets.filter(
            (item) => !sourceAssets.some((asset) => asset.id === item.id)
          ),
        ];
        this.lastRunLog.unshift(
          `Clip: ${application.name} に ${title} を保存`
        );
        return savedClip;
      } catch (err) {
        log("ERROR", "StoryVault clip save failed", err);
        reportDatadogError(err, {
          feature: "storyvault_clip_save",
          applicationId: input.applicationId,
          blobSize: input.blob.size,
          contentType: input.contentType || input.blob.type || "video/webm",
        });
        this.error =
          err instanceof Error ? err.message : "クリップの保存に失敗しました";
        throw err;
      } finally {
        this.isSavingOperationVideo = false;
      }
    },
    async updateClipAnalysis(
      input: StoryVaultClipAnalysisInput
    ): Promise<DecodedStoryVaultClip> {
      const clip = this.clips.find((item) => item.id === input.clipId);
      if (!clip) {
        throw new Error("更新対象のクリップが見つかりません");
      }
      const application = this.applications.find(
        (item) => item.id === clip.applicationId
      );
      if (!application) {
        throw new Error("対象アプリが見つかりません");
      }
      if (
        input.transcriptTimingStatus !== "timestamped" ||
        input.transcriptSegments.length === 0 ||
        !input.transcriptSrt.trim()
      ) {
        throw new Error("クリップ解析にはGeminiのタイムスタンプ付き文字起こしが必要です");
      }

      this.isSavingOperationVideo = true;
      this.error = null;
      try {
        const contextStore = useContextStore();
        const storageOps = useFirebaseStorageOperations();
        const bucketName = clip.bucketName || resolveStorageBucketName(
          useRuntimeConfig().public.firebase.storageBucket
        );
        const safeTitle = toDocId(input.title || clip.title, "clip");
        const timestamp = nowIso().replace(/[:.]/g, "-");
        const frameCaptures: NonNullable<
          DecodedStoryVaultClip["frameCaptures"]
        > = [];

        for (const [index, frame] of input.frameCaptures.entries()) {
          if (frame.blob.size <= 0) continue;
          const frameId = `frame-${String(index + 1).padStart(3, "0")}`;
          const frameContentType = frame.contentType || frame.blob.type || "image/jpeg";
          const frameFileName = `${safeTitle}-${timestamp}-${clip.id}-${frameId}.jpg`;
          const frameStoragePath = contextStore.baseGcsPath(
            `storyVault/applications/${application.id}/clips/${clip.id}/frames/${frameFileName}`
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

        const nextClip: DecodedStoryVaultClip = {
          ...clip,
          title:
            input.title?.trim() ||
            input.quickScan?.title?.trim() ||
            clip.title,
          description:
            input.description?.trim() ||
            input.quickScan?.description?.trim() ||
            clip.description,
          transcriptText: input.transcriptText.trim() || undefined,
          transcriptProvider: input.transcriptProvider?.trim() || undefined,
          transcriptSummary: input.transcriptSummary?.trim() || undefined,
          transcriptSegments: input.transcriptSegments,
          transcriptSrt: input.transcriptSrt.trim(),
          transcriptTimingStatus: "timestamped",
          quickScan: input.quickScan,
          frameCaptures,
          analysisStatus: "not_analyzed",
          analysisErrorMessage: undefined,
          analysisResult: undefined,
        };

        const firestoreOps = useFirestoreDocOperation();
        await firestoreOps.createDocument({
          collectionName: this.clipCollectionPath(),
          docId: nextClip.id,
          docData: nextClip,
          converter: storyVaultClipConverter,
          merge: true,
        });
        this.clips = this.clips.map((item) =>
          item.id === nextClip.id ? nextClip : item
        );
        this.lastRunLog.unshift(
          `Clip: ${nextClip.title} の解析結果を保存`
        );
        return nextClip;
      } catch (err) {
        log("ERROR", "StoryVault clip analysis update failed", err);
        reportDatadogError(err, {
          feature: "storyvault_clip_analysis_update",
          applicationId: clip.applicationId,
          clipId: clip.id,
        });
        this.error =
          err instanceof Error ? err.message : "クリップ解析結果の保存に失敗しました";
        throw err;
      } finally {
        this.isSavingOperationVideo = false;
      }
    },
    async updateClipTitle(params: {
      clipId: string;
      title: string;
    }): Promise<void> {
      const clip = this.clips.find((item) => item.id === params.clipId);
      if (!clip) {
        throw new Error("更新対象のクリップが見つかりません");
      }
      const title = params.title.trim();
      if (!title) {
        throw new Error("クリップタイトルを入力してください");
      }
      if (title === clip.title) return;

      this.isLoading = true;
      this.error = null;
      try {
        const nextClip: DecodedStoryVaultClip = {
          ...clip,
          title,
        };
        const sourceAssetIds = clipSourceAssetIds(clip);
        const nextSourceAssets = this.sourceAssets.map((asset) => {
          if (!sourceAssetIds.includes(asset.id)) return asset;
          if (asset.id === clip.journeySourceAssetId || asset.id === `source-asset-${clip.id}-journey`) {
            return {
              ...asset,
              title: `Clip Journey: ${title}`,
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
            collectionName: this.clipCollectionPath(),
            docId: nextClip.id,
            docData: nextClip,
            converter: storyVaultClipConverter,
            merge: true,
          }),
          ...nextSourceAssets
            .filter((asset) => sourceAssetIds.includes(asset.id))
            .map((asset) =>
              firestoreOps.createDocument({
                collectionName: this.sourceAssetCollectionPath(),
                docId: asset.id,
                docData: asset,
                converter: storyVaultSourceAssetConverter,
                merge: true,
              })
            ),
        ]);

        this.clips = this.clips.map((item) =>
          item.id === nextClip.id ? nextClip : item
        );
        this.sourceAssets = nextSourceAssets;
        this.lastRunLog.unshift(`Clip: ${clip.title} を ${title} に変更`);
      } catch (err) {
        log("ERROR", "StoryVault clip title update failed", err);
        reportDatadogError(err, {
          feature: "storyvault_clip_title_update",
          clipId: params.clipId,
          applicationId: clip.applicationId,
        });
        this.error =
          err instanceof Error ? err.message : "クリップタイトルの更新に失敗しました";
        throw err;
      } finally {
        this.isLoading = false;
      }
    },
    async deleteClip(clipId: string): Promise<void> {
      const clip = this.clips.find((item) => item.id === clipId);
      if (!clip) {
        throw new Error("削除対象のクリップが見つかりません");
      }
      this.isLoading = true;
      this.error = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        const sourceAssetIds = clipSourceAssetIds(clip);

        const storageTargets = [
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
                log("WARN", "Clip storage delete skipped", {
                  clipId,
                  storagePath: target.storagePath,
                  err,
                });
              }
            }
          })
        );

        const deleteResults = await Promise.all([
          firestoreOps.deleteDocument({
            collectionName: this.clipCollectionPath(),
            docId: clip.id,
          }),
          ...sourceAssetIds.map((assetId) =>
            firestoreOps.deleteDocument({
              collectionName: this.sourceAssetCollectionPath(),
              docId: assetId,
            })
          ),
        ]);
        if (deleteResults.some((deleted) => !deleted)) {
          throw new Error("Firestore上のクリップまたは関連素材を削除できませんでした");
        }

        this.clips = this.clips.filter(
          (item) => item.id !== clip.id
        );
        if (clip.clipGroupId) {
          const group = this.clipGroups.find(
            (item) => item.id === clip.clipGroupId
          );
          if (group) {
            const nextGroup: DecodedStoryVaultClipGroup = {
              ...group,
              clipCount: this.clips.filter(
                (item) => item.clipGroupId === group.id
              ).length,
            };
            await firestoreOps.createDocument({
              collectionName: this.clipGroupCollectionPath(),
              docId: nextGroup.id,
              docData: nextGroup,
              converter: storyVaultClipGroupConverter,
              merge: true,
            });
            this.clipGroups = this.clipGroups.map((item) =>
              item.id === nextGroup.id ? nextGroup : item
            );
          }
        }
        this.sourceAssets = this.sourceAssets.filter(
          (asset) => !sourceAssetIds.includes(asset.id)
        );
        this.lastRunLog.unshift(`Clip: ${clip.title} を削除`);
      } catch (err) {
        log("ERROR", "StoryVault clip delete failed", err);
        reportDatadogError(err, {
          feature: "storyvault_clip_delete",
          clipId,
          applicationId: clip.applicationId,
        });
        this.error =
          err instanceof Error ? err.message : "クリップの削除に失敗しました";
        throw err;
      } finally {
        this.isLoading = false;
      }
    },
    async persistApplicationScanRun(params: {
      application: DecodedStoryVaultApplication;
      run: StoryVaultApplicationScanRun;
    }): Promise<void> {
      const firestoreOps = useFirestoreDocOperation();
      const nextApplication: DecodedStoryVaultApplication = {
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
        converter: storyVaultApplicationConverter,
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
      let pendingRun: StoryVaultApplicationScanRun | null = null;

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
        const sessionId = `storyvault-appscan-${application.id}-${Date.now()}-${createRandomDocId()}`;
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

        const startedRun: StoryVaultApplicationScanRun = {
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
        const failedRun: StoryVaultApplicationScanRun = {
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
      input: StoryVaultScreenVariantExplorationInput
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

      const nextRun: StoryVaultApplicationScanRun = {
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
