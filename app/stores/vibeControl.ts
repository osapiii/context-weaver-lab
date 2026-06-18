import { defineStore } from "pinia";
import log from "@utils/logger";
import createRandomDocId from "@utils/createRandomDocId";
import { useFirestoreDocOperation } from "@composables/firestore-doc-operation";
import { useContextStore } from "./context";
import type {
  DecodedVibeControlSourceConnection,
  DecodedVibeControlStory,
  DecodedVibeControlStoryEvidence,
  VibeControlDriftLevel,
  VibeControlReviewState,
  VibeControlStoryStatus,
} from "@models/vibeControl";
import {
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
  fileSpaceId: string;
  repoFullName: string;
  defaultBranch: string;
};

const nowIso = () => new Date().toISOString();

const mockEvidence: DecodedVibeControlStoryEvidence[] = [
  {
    id: "ev-st101-brief",
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
    storyId: "story-st104",
    storyKey: "ST-104",
    type: "pr",
    title: "PR #123 Cart payment",
    excerpt:
      "カート合計と支払い方法選択は実装済み。確認画面のACがテスト・コード双方で不足。",
    repoFullName: "enostech/vibe-control-demo",
    pullRequest: "#123",
    path: "app/components/PaymentMethodPicker.vue",
    citation: {
      title: "GitHub PR #123",
      snippet: "cart total and payment method implemented; confirmation remains",
      uri: "https://github.com/enostech/vibe-control-demo/pull/123",
    },
    freshness: "fresh",
    confidenceImpact: -12,
  },
  {
    id: "ev-st201-doc",
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
        text: "完了後にAI Studioの開始地点へ遷移する",
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
        repoFullName: "enostech/vibe-control-demo",
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
    repoFullName: "enostech/vibe-control-demo",
    generatedAt: nowIso(),
  },
  {
    id: "story-st201",
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
    provider: "file_space",
    status: "connected",
    displayName: "Default product FileSpace",
    fileSpaceId: "w-default",
    lastSyncedAt: nowIso(),
    scopes: ["agent_search", "knowledge"],
  },
  {
    id: "source-github",
    provider: "github",
    status: "connected",
    displayName: "enostech/vibe-control-demo",
    repoFullName: "enostech/vibe-control-demo",
    defaultBranch: "main",
    lastSyncedAt: nowIso(),
    scopes: ["contents:read", "pull_requests:read"],
  },
];

export const useVibeControlStore = defineStore("vibeControl", {
  state: () => ({
    stories: [] as DecodedVibeControlStory[],
    evidence: [] as DecodedVibeControlStoryEvidence[],
    sourceConnections: [] as DecodedVibeControlSourceConnection[],
    selectedStoryId: "" as string,
    isLoading: false,
    isGenerating: false,
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
    filteredStories(state): DecodedVibeControlStory[] {
      const query = state.filters.query.trim().toLowerCase();
      return state.stories.filter((story) => {
        const queryHit =
          !query ||
          [
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
      return state.stories.find((story) => story.id === state.selectedStoryId) ?? null;
    },
    selectedEvidence(state): DecodedVibeControlStoryEvidence[] {
      const story = state.stories.find((item) => item.id === state.selectedStoryId);
      if (!story) return [];
      const ids = new Set(story.evidenceIds);
      return state.evidence.filter(
        (item) => item.storyId === story.id || ids.has(item.id)
      );
    },
    evidenceCountByStory(state): Record<string, number> {
      return state.evidence.reduce<Record<string, number>>((acc, item) => {
        acc[item.storyId] = (acc[item.storyId] ?? 0) + 1;
        return acc;
      }, {});
    },
    domains(state): string[] {
      return [...new Set(state.stories.map((story) => story.domain))].sort();
    },
    milestones(state): string[] {
      return [...new Set(state.stories.map((story) => story.milestone))].sort();
    },
    averageConfidence(state): number {
      if (state.stories.length === 0) return 0;
      return Math.round(
        state.stories.reduce((sum, item) => sum + item.confidenceScore, 0) /
          state.stories.length
      );
    },
    highDriftCount(state): number {
      return state.stories.filter((story) => story.driftLevel === "high").length;
    },
    needsReviewCount(state): number {
      return state.stories.filter((story) => story.reviewState === "needs_review")
        .length;
    },
  },
  actions: {
    storyCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlStories");
    },
    evidenceCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlStoryEvidence");
    },
    sourceConnectionCollectionPath(): string {
      return useContextStore().baseFirestorePath("vibeControlSourceConnections");
    },
    loadMockData(): void {
      this.stories = [...mockStories];
      this.evidence = [...mockEvidence];
      this.sourceConnections = [...mockConnections];
      this.selectedStoryId = this.stories[0]?.id ?? "";
      this.lastRunLog = [
        "Agent Search: FileSpace w-default からTo-Be候補を抽出",
        "GitHub: enostech/vibe-control-demo のPR/commit/file refsを照合",
        "SSOT: 3 stories / 5 evidence refs を生成",
      ];
      this.error = null;
    },
    async fetchFromFirestore(): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        const [stories, evidence, sourceConnections] = await Promise.all([
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
        ]);
        this.stories = stories;
        this.evidence = evidence;
        this.sourceConnections = sourceConnections;
        this.selectedStoryId = this.stories[0]?.id ?? "";
        if (this.stories.length === 0) {
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
    evidenceForStory(storyId: string): DecodedVibeControlStoryEvidence[] {
      const story = this.stories.find((item) => item.id === storyId);
      if (!story) return [];
      const ids = new Set(story.evidenceIds);
      return this.evidence.filter(
        (item) => item.storyId === storyId || ids.has(item.id)
      );
    },
    async registerSourceConnection(
      input: VibeControlGenerationInput
    ): Promise<void> {
      const now = nowIso();
      const fileSpaceId = input.fileSpaceId.trim() || "w-default";
      const repoFullName =
        input.repoFullName.trim() || "enostech/vibe-control-demo";
      const defaultBranch = input.defaultBranch.trim() || "main";
      this.sourceConnections = [
        {
          id: "source-filespace",
          provider: "file_space",
          status: "connected",
          displayName: `FileSpace ${fileSpaceId}`,
          fileSpaceId,
          lastSyncedAt: now,
          scopes: ["agent_search", "knowledge"],
        },
        {
          id: "source-github",
          provider: "github",
          status: "connected",
          displayName: repoFullName,
          repoFullName,
          defaultBranch,
          lastSyncedAt: now,
          scopes: ["contents:read", "pull_requests:read", "commits:read"],
        },
      ];
    },
    async runMockGeneration(input: VibeControlGenerationInput): Promise<void> {
      this.isGenerating = true;
      this.error = null;
      this.lastRunLog = [];
      try {
        await this.registerSourceConnection(input);
        const fileSpaceId = input.fileSpaceId.trim() || "w-default";
        const repoFullName =
          input.repoFullName.trim() || "enostech/vibe-control-demo";
        this.lastRunLog.push(`Agent Search: ${fileSpaceId} からTo-Be候補を抽出`);
        this.lastRunLog.push(`GitHub: ${repoFullName} のAs-Is状態を取得`);
        this.stories = mockStories.map((story) => ({
          ...story,
          fileSpaceId,
          repoFullName,
          generatedAt: nowIso(),
          codeRefs: story.codeRefs.map((ref) => ({
            ...ref,
            repoFullName,
            branch: input.defaultBranch.trim() || ref.branch,
          })),
        }));
        this.evidence = mockEvidence.map((item) => ({
          ...item,
          repoFullName: item.repoFullName ? repoFullName : item.repoFullName,
        }));
        this.selectedStoryId = this.stories[0]?.id ?? "";
        this.lastRunLog.push(
          `SSOT: ${this.stories.length} stories / ${this.evidence.length} evidence refs を生成`
        );
      } finally {
        this.isGenerating = false;
      }
    },
    async persistCurrentSnapshot(): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        await Promise.all([
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
        ]);
        this.lastRunLog.push("Firestore: 現在のSSOT snapshotを保存");
      } catch (err) {
        log("ERROR", "VibeControl persist failed", err);
        this.error = err instanceof Error ? err.message : "SSOT保存に失敗しました";
      } finally {
        this.isLoading = false;
      }
    },
    exportStoryMarkdown(storyId: string): string {
      const story = this.stories.find((item) => item.id === storyId);
      if (!story) return "";
      const evidence = this.evidenceForStory(storyId);
      return [
        `# ${story.storyKey} ${story.title}`,
        "",
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
