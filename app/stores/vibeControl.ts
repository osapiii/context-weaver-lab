import { defineStore } from "pinia";
import { getAuth } from "firebase/auth";
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
import { useFirebaseStorageOperations } from "@composables/firebase-storage-operations";
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
  DecodedVibeControlCapability,
  DecodedVibeControlDraftPatch,
  DecodedVibeControlGenerationSession,
  DecodedVibeControlOperationVideo,
  DecodedVibeControlSourceConnection,
  DecodedVibeControlSourceAsset,
  DecodedVibeControlStory,
  DecodedVibeControlStoryEvidence,
  VibeControlApplicationScanRun,
  VibeControlDriftLevel,
  VibeControlOperationVideoDisplaySurface,
  VibeControlReviewState,
  VibeControlStoryStatus,
} from "@models/vibeControl";
import {
  vibeControlApplicationConverter,
  vibeControlCapabilityConverter,
  vibeControlDraftPatchConverter,
  vibeControlGenerationSessionConverter,
  vibeControlOperationVideoConverter,
  vibeControlSourceAssetConverter,
  vibeControlSourceConnectionConverter,
  vibeControlStoryConverter,
  vibeControlStoryEvidenceConverter,
} from "@models/vibeControl";

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

export type VibeControlOperationVideoSaveInput = {
  applicationId: string;
  title: string;
  description?: string;
  blob: Blob;
  durationMs?: number;
  contentType?: string;
  sourceDisplaySurface?: VibeControlOperationVideoDisplaySurface;
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

const toDocId = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

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
    sourceAssets: [] as DecodedVibeControlSourceAsset[],
    operationVideos: [] as DecodedVibeControlOperationVideo[],
    generationSessions: [] as DecodedVibeControlGenerationSession[],
    draftPatches: [] as DecodedVibeControlDraftPatch[],
    selectedApplicationId: "" as string,
    selectedStoryId: "" as string,
    isLoading: false,
    isGenerating: false,
    isStartingApplicationScan: false,
    isProvisioningApplicationFileSpace: false,
    isSavingOperationVideo: false,
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
    operationVideoCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlOperationVideos");
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
      this.capabilities = [];
      this.sourceAssets = [];
      this.operationVideos = [];
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
          operationVideos,
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
            collectionName: this.operationVideoCollectionPath(),
            converter: vibeControlOperationVideoConverter,
            orderBy: { field: "recordedAt", direction: "desc" },
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
        this.operationVideos = operationVideos;
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
            (asset) => asset.sourceType === "application_screenshot"
          ).length,
          videoCount: sourceAssets.filter((asset) =>
            asset.sourceType.startsWith("operation_video")
          ).length,
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
            ? `${application.name} のSourceAssetからCapability構造案を作成してください。`
            : capability
              ? `${application.name} の ${capability.name} 配下に置くユーザーストーリー案を生成してください。`
              : `${application.name} の既存Capability群に紐づくユーザーストーリー案を生成してください。`);

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
    }): string {
      return buildOperationVideoMetadataMarkdown(params);
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
      if (!fileSpaceId) {
        throw new Error("操作動画をDiscoveryEngineへ登録するFileSpace IDを設定してください");
      }

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
      if (input.blob.size <= 0) {
        throw new Error("録画データが空です");
      }

      this.isSavingOperationVideo = true;
      this.error = null;

      try {
        const contextStore = useContextStore();
        const storageOps = useFirebaseStorageOperations();
        const config = useRuntimeConfig();
        const bucketName = resolveStorageBucketName(
          config.public.firebase.storageBucket
        );
        const now = nowIso();
        const videoId = `operation-video-${createRandomDocId()}`;
        const safeTitle = toDocId(title, "operation-video");
        const timestamp = now.replace(/[:.]/g, "-");
        const contentType = input.contentType || input.blob.type || "video/webm";
        const extension = contentType.includes("mp4") ? "mp4" : "webm";
        const fileName = `${safeTitle}-${timestamp}.${extension}`;
        const storagePath = contextStore.baseGcsPath(
          `vibeControl/applications/${application.id}/operationVideos/${videoId}/${fileName}`
        );

        const uploaded = await storageOps.uploadPdfFile({
          bucketName,
          filePath: storagePath,
          rawData: input.blob,
          mimeType: contentType,
        });
        if (!uploaded) {
          throw new Error("操作動画のFirebase Storage保存に失敗しました");
        }

        const metadataFileName = `${safeTitle}-${timestamp}.md`;
        const metadataStoragePath = contextStore.baseGcsPath(
          manualUploadRelativePath({
            fileSpaceId,
            fileName: metadataFileName,
          })
        );
        const metadataMarkdown = this.buildOperationVideoMarkdown({
          application,
          videoId,
          title,
          description: input.description,
          bucketName,
          storagePath,
          contentType,
          sizeBytes: input.blob.size,
          durationMs: input.durationMs,
          recordedAt: now,
          sourceDisplaySurface: input.sourceDisplaySurface,
        });
        const journeyFileName = `${safeTitle}-${timestamp}-journey.md`;
        const journeyStoragePath = contextStore.baseGcsPath(
          manualUploadRelativePath({
            fileSpaceId,
            fileName: journeyFileName,
          })
        );
        const journeyMarkdown = buildOperationVideoJourneyMarkdown({
          application,
          videoId,
          title,
          description: input.description,
          bucketName,
          storagePath,
          contentType,
          sizeBytes: input.blob.size,
          durationMs: input.durationMs,
          recordedAt: now,
          sourceDisplaySurface: input.sourceDisplaySurface,
        });

        let fileSpaceRequestId: string | undefined;
        let journeyFileSpaceRequestId: string | undefined;
        let discoveryStatus: DecodedVibeControlOperationVideo["discoveryStatus"] =
          "not_registered";
        const sourceAssetId = `source-asset-${videoId}`;
        const journeySourceAssetId = `source-asset-${videoId}-journey`;
        const requestErrors: string[] = [];

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
              documentId: `vibecontrol-operation-video-${videoId}`,
              description: `VibeControl operation video metadata: ${title}`,
              customMetadata: [
                { key: "source", value: "vibe-control-operation-video" },
                { key: "applicationId", value: application.id },
                { key: "applicationKey", value: application.applicationKey },
                { key: "operationVideoId", value: videoId },
                { key: "sourceAssetId", value: sourceAssetId },
                { key: "videoStoragePath", value: storagePath },
                { key: "documentKind", value: "operation_video_metadata" },
              ],
              originalFileInfo: {
                fileName: metadataFileName,
                bytes: new Blob([metadataMarkdown]).size,
              },
              organizationId,
              spaceId,
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
              documentId: `vibecontrol-operation-video-journey-${videoId}`,
              description: `VibeControl operation journey evidence: ${title}`,
              customMetadata: [
                { key: "source", value: "vibe-control-operation-video-journey" },
                { key: "applicationId", value: application.id },
                { key: "applicationKey", value: application.applicationKey },
                { key: "applicationName", value: application.name },
                { key: "repoFullName", value: application.repoFullName },
                { key: "operationVideoId", value: videoId },
                { key: "sourceAssetId", value: journeySourceAssetId },
                { key: "videoStoragePath", value: storagePath },
                { key: "documentKind", value: "operation_video_journey" },
              ],
              originalFileInfo: {
                fileName: journeyFileName,
                bytes: new Blob([journeyMarkdown]).size,
              },
              organizationId,
              spaceId,
            });
          if (requestDoc?.id) {
            journeyFileSpaceRequestId = requestDoc.id;
          } else {
            requestErrors.push("操作JourneyのFileSpace upload RequestDoc作成に失敗しました");
          }
        } else {
          requestErrors.push("操作Journey Markdownの保存に失敗しました");
        }

        discoveryStatus =
          fileSpaceRequestId || journeyFileSpaceRequestId ? "queued" : "error";
        const discoveryErrorMessage =
          requestErrors.length > 0 ? requestErrors.join(" / ") : undefined;

        const video: DecodedVibeControlOperationVideo = {
          id: videoId,
          applicationId: application.id,
          applicationKey: application.applicationKey,
          title,
          description: input.description?.trim() || undefined,
          fileName,
          bucketName,
          storagePath,
          contentType,
          sizeBytes: input.blob.size,
          durationMs: input.durationMs,
          fileSpaceId,
          fileSpaceRequestId,
          metadataFileName,
          metadataStoragePath,
          journeyFileName,
          journeyStoragePath,
          journeyFileSpaceRequestId,
          sourceAssetId,
          journeySourceAssetId,
          discoveryStatus,
          discoveryErrorMessage,
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
            summary: input.description?.trim() || undefined,
            uri: `gs://${bucketName}/${storagePath}`,
            gcsPath: `gs://${bucketName}/${storagePath}`,
            storagePath,
            fileSpaceId,
            fileSpaceRequestId,
            discoveryStatus: fileSpaceRequestId ? "queued" : "error",
            discoveryDocumentId: `vibecontrol-operation-video-${videoId}`,
            discoveryErrorMessage: fileSpaceRequestId
              ? undefined
              : "動画メタデータのDiscovery Engine登録に失敗しました",
            metadata: {
              operationVideoId: videoId,
              contentType,
              sizeBytes: input.blob.size,
              durationMs: input.durationMs,
              metadataStoragePath,
              sourceDisplaySurface: input.sourceDisplaySurface ?? "unknown",
            },
          },
          {
            id: journeySourceAssetId,
            applicationId: application.id,
            applicationKey: application.applicationKey,
            sourceType: "operation_video_journey",
            title: `Operation Journey: ${title}`,
            summary:
              input.description?.trim() ||
              "操作動画から生成したユーザージャーニー検索用証跡",
            uri: `gs://${bucketName}/${journeyStoragePath}`,
            gcsPath: `gs://${bucketName}/${journeyStoragePath}`,
            storagePath: journeyStoragePath,
            fileSpaceId,
            fileSpaceRequestId: journeyFileSpaceRequestId,
            discoveryStatus: journeyFileSpaceRequestId ? "queued" : "error",
            discoveryDocumentId: `vibecontrol-operation-video-journey-${videoId}`,
            discoveryErrorMessage: journeyFileSpaceRequestId
              ? undefined
              : "操作JourneyのDiscovery Engine登録に失敗しました",
            metadata: {
              operationVideoId: videoId,
              videoStoragePath: storagePath,
              sourceDisplaySurface: input.sourceDisplaySurface ?? "unknown",
            },
          },
        ];

        const firestoreOps = useFirestoreDocOperation();
        await Promise.all([
          firestoreOps.createDocument({
            collectionName: this.operationVideoCollectionPath(),
            docId: video.id,
            docData: video,
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

        this.operationVideos = [
          video,
          ...this.operationVideos.filter((item) => item.id !== video.id),
        ];
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
      } catch (err) {
        log("ERROR", "VibeControl operation video save failed", err);
        this.error =
          err instanceof Error ? err.message : "操作動画の保存に失敗しました";
        throw err;
      } finally {
        this.isSavingOperationVideo = false;
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
      const now = nowIso();
      const sessionId = `vibecontrol-appscan-${application.id}-${Date.now()}-${createRandomDocId()}`;
      const responseId = `appscan-response-${createRandomDocId()}`;
      const workspaceState = buildWorkspaceSessionState({
        enAiStudioUi: {},
        activeMode: "application_scan",
        applicationScan: params.fields,
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

      const pendingRun: VibeControlApplicationScanRun = {
        requestId: "",
        sessionId,
        responseId,
        status: "pending",
        startUrl: params.fields.startUrl.trim(),
        fileSpaceId: params.fields.fileSpaceId.trim() || undefined,
        maxPages: params.fields.maxPages,
        captureScreenshots: params.fields.captureScreenshots,
        createdAt: now,
        updatedAt: now,
      };

      try {
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
            prompt: buildApplicationScanInitialPrompt(params.fields),
            responseId,
            model: defaultLlmModelSelectionForAdkMode("application_scan"),
            fileSpaceId: params.fields.fileSpaceId.trim() || null,
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
          `Application Scan: ${application.name} (${startedRun.startUrl}) のrequestDocを発行`
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
