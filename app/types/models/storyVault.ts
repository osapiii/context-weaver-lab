import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestStatusEnum } from "./core/requestStatus";

export const StoryVaultStoryStatusSchema = z.enum([
  "discovery",
  "ready_for_dev",
  "implemented",
  "released",
]);

export const StoryVaultReviewStateSchema = z.enum([
  "ready",
  "needs_review",
]);

export const StoryVaultDriftLevelSchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
]);

export const StoryVaultEvidenceTypeSchema = z.enum([
  "knowledge",
  "ticket",
  "screen",
  "video",
  "journey",
  "code",
  "pr",
  "commit",
  "agent",
]);

export const StoryVaultSourceProviderSchema = z.enum([
  "file_space",
  "github",
  "drive",
  "web",
  "imported_ticket",
]);

export const StoryVaultSourceConnectionStatusSchema = z.enum([
  "connected",
  "needs_setup",
  "syncing",
  "error",
]);

export const StoryVaultApplicationFileSpaceProvisioningStatusSchema = z.enum([
  "missing",
  "creating",
  "ready",
  "error",
]);

export const StoryVaultOperationVideoDiscoveryStatusSchema = z.enum([
  "not_registered",
  "queued",
  "completed",
  "error",
]);

export const StoryVaultOperationVideoDisplaySurfaceSchema = z.enum([
  "browser",
  "monitor",
  "window",
  "unknown",
]);

export const StoryVaultOperationVideoFrameSchema = z.object({
  id: z.string(),
  timestampMs: z.number().min(0),
  fileName: z.string(),
  bucketName: z.string().optional(),
  storagePath: z.string().optional(),
  contentType: z.string().default("image/jpeg"),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
});

export const StoryVaultTranscriptTimingStatusSchema = z.enum([
  "timestamped",
  "unavailable",
]);

export const StoryVaultTranscriptCueSchema = z.object({
  id: z.string(),
  index: z.number().int().min(1),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  text: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export const StoryVaultOperationVideoQuickScanSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  operationMemo: z.string().optional(),
  operationSteps: z.array(z.string()).default([]),
  transcriptSummary: z.string().optional(),
  provider: z.string().optional(),
  generatedAt: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const StoryVaultOperationVideoClipSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  bucketName: z.string(),
  storagePath: z.string(),
  contentType: z.string().default("video/webm"),
  sizeBytes: z.number().min(0).default(0),
  durationMs: z.number().min(0).optional(),
  transcriptText: z.string().optional(),
  transcriptProvider: z.string().optional(),
  transcriptSummary: z.string().optional(),
  transcriptSegments: z.array(StoryVaultTranscriptCueSchema).default([]),
  transcriptSrt: z.string().optional(),
  transcriptTimingStatus: StoryVaultTranscriptTimingStatusSchema.default(
    "unavailable"
  ),
  quickScan: StoryVaultOperationVideoQuickScanSchema.optional(),
  frameCaptures: z.array(StoryVaultOperationVideoFrameSchema).default([]),
  metadataFileName: z.string().optional(),
  metadataStoragePath: z.string().optional(),
  journeyFileName: z.string().optional(),
  journeyStoragePath: z.string().optional(),
  fileSpaceRequestId: z.string().optional(),
  journeyFileSpaceRequestId: z.string().optional(),
  sourceAssetId: z.string().optional(),
  journeySourceAssetId: z.string().optional(),
  sourceDisplaySurface: StoryVaultOperationVideoDisplaySurfaceSchema.default(
    "unknown"
  ),
  recordedAt: z.string(),
});

export const StoryVaultZappingAnalysisStatusSchema = z.enum([
  "not_analyzed",
  "queued",
  "running",
  "completed",
  "error",
]);

export const StoryVaultCapabilityStatusSchema = z.enum([
  "draft",
  "active",
  "archived",
]);

export const StoryVaultSourceAssetTypeSchema = z.enum([
  "knowledge_document",
  "application_screen",
  "application_screen_variant",
  "application_screen_atlas",
  "application_screenshot",
  "application_scan_sitemap",
  "application_scan_summary",
  "operation_video",
  "operation_video_transcript",
  "operation_video_scene_summary",
  "operation_video_journey",
  "zapping_video_analysis",
  "zapping_video_screen",
  "github_repository",
  "github_file",
  "github_pull_request",
  "github_commit",
]);

export const StoryVaultSourceAssetDiscoveryStatusSchema = z.enum([
  "not_registered",
  "queued",
  "completed",
  "error",
]);

export const StoryVaultScanAuthModeSchema = z.enum([
  "none",
  "credentials",
  "email_link_manual",
  "assisted_session",
]);

export const StoryVaultGenerationSessionPhaseSchema = z.enum([
  "source_ingest",
  "capability_structuring",
  "story_generation",
  "review",
  "completed",
  "error",
]);

export const StoryVaultGenerationSessionStatusSchema = z.enum([
  "idle",
  "running",
  "waiting_user",
  "completed",
  "error",
]);

export const StoryVaultDraftPatchAgentSchema = z.enum([
  "capability",
  "story",
  "media_ingest",
]);

export const StoryVaultDraftPatchTargetTypeSchema = z.enum([
  "capability",
  "story",
  "evidence",
  "source_asset",
]);

export const StoryVaultDraftPatchOperationSchema = z.enum([
  "create",
  "update",
  "delete",
  "merge",
  "split",
  "move_evidence",
  "reorder",
  "lock",
]);

export const StoryVaultDraftPatchStatusSchema = z.enum([
  "proposed",
  "applied",
  "rejected",
  "superseded",
]);

export const StoryVaultAgentPlanStatusSchema = z.enum([
  "proposed",
  "accepted",
  "rejected",
  "superseded",
]);

export const StoryVaultApplicationSchema = z.object({
  id: z.string().optional(),
  applicationKey: z.string(),
  name: z.string(),
  summary: z.string().optional(),
  domain: z.string().optional(),
  owner: z.string().optional(),
  labels: z.array(z.string()).default([]),
  startUrl: z.string().optional(),
  fileSpaceId: z.string().optional(),
  fileSpaceCreateRequestId: z.string().optional(),
  fileSpaceProvisioningStatus:
    StoryVaultApplicationFileSpaceProvisioningStatusSchema.optional(),
  fileSpaceErrorMessage: z.string().optional(),
  repoFullName: z.string().min(1),
  defaultBranch: z.string().optional(),
  storyCount: z.number().min(0).default(0),
  highDriftCount: z.number().min(0).default(0),
  lastGeneratedAt: z.string().optional(),
  lastScan: z.lazy(() => StoryVaultApplicationScanRunSchema).optional(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultApplicationSchema =
  StoryVaultApplicationSchema.extend({
    id: z.string(),
  });

export const StoryVaultAcceptanceCriterionSchema = z.object({
  id: z.string(),
  text: z.string(),
  state: z.enum(["covered", "missing", "conflict", "unknown"]),
  evidenceIds: z.array(z.string()).default([]),
});

export const StoryVaultCodeRefSchema = z.object({
  provider: z.literal("github"),
  repoFullName: z.string(),
  branch: z.string().optional(),
  pullRequest: z.string().optional(),
  commit: z.string().optional(),
  path: z.string().optional(),
  lineStart: z.number().optional(),
  lineEnd: z.number().optional(),
  summary: z.string().optional(),
});

export const StoryVaultGenerationTraceSchema = z.object({
  at: z.string(),
  actor: z.enum(["agent", "user", "system"]),
  message: z.string(),
});

const NullableOptionalStringSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? undefined);

export const StoryVaultStorySchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  capabilityId: z.string().optional(),
  capabilityKey: z.string().optional(),
  capabilityName: z.string().optional(),
  sequence: z.number().min(0).default(0),
  storyKey: z.string(),
  title: z.string(),
  summary: z.string(),
  userStory: z.string(),
  status: StoryVaultStoryStatusSchema,
  reviewState: StoryVaultReviewStateSchema.default("ready"),
  domain: z.string(),
  milestone: z.string(),
  labels: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(100),
  driftLevel: StoryVaultDriftLevelSchema,
  driftReason: z.string().optional(),
  sourceFreshness: z.object({
    knowledgeCheckedAt: NullableOptionalStringSchema,
    githubCheckedAt: NullableOptionalStringSchema,
    staleSources: z.array(z.string()).default([]),
  }),
  acceptanceCriteria: z.array(StoryVaultAcceptanceCriterionSchema).default([]),
  evidenceIds: z.array(z.string()).default([]),
  codeRefs: z.array(StoryVaultCodeRefSchema).default([]),
  generationTrace: z.array(StoryVaultGenerationTraceSchema).default([]),
  fileSpaceId: z.string().optional(),
  repoFullName: z.string().optional(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
  generatedAt: z.string(),
});

export const DecodedStoryVaultStorySchema = StoryVaultStorySchema.extend({
  id: z.string(),
});

export const StoryVaultStoryEvidenceSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  capabilityId: z.string().optional(),
  capabilityKey: z.string().optional(),
  storyId: z.string().default(""),
  storyKey: z.string().default(""),
  sourceAssetId: z.string().optional(),
  type: StoryVaultEvidenceTypeSchema,
  title: z.string(),
  excerpt: z.string(),
  sourceUrl: z.string().optional(),
  gcsPath: z.string().optional(),
  fileSpaceDocumentId: z.string().optional(),
  repoFullName: z.string().optional(),
  pullRequest: z.string().optional(),
  commit: z.string().optional(),
  path: z.string().optional(),
  observedUserAction: z.string().optional(),
  observedUiSurface: z.string().optional(),
  codeRef: StoryVaultCodeRefSchema.optional(),
  citation: z.object({
    title: z.string(),
    uri: z.string().optional(),
    snippet: z.string(),
  }),
  freshness: z.enum(["fresh", "stale", "unknown"]).default("unknown"),
  confidenceImpact: z.number().min(-100).max(100).default(0),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultStoryEvidenceSchema =
  StoryVaultStoryEvidenceSchema.extend({
    id: z.string(),
  });

export const StoryVaultSourceConnectionSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  provider: StoryVaultSourceProviderSchema,
  status: StoryVaultSourceConnectionStatusSchema,
  displayName: z.string(),
  fileSpaceId: z.string().optional(),
  repoFullName: z.string().optional(),
  defaultBranch: z.string().optional(),
  lastSyncedAt: z.string().optional(),
  scopes: z.array(z.string()).default([]),
  lastError: z.string().optional(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultSourceConnectionSchema =
  StoryVaultSourceConnectionSchema.extend({
    id: z.string(),
  });

export const StoryVaultZappingAnalysisStoryCandidateSchema = z.object({
  id: z.string(),
  epicId: z.string().optional(),
  storyKey: z.string().optional(),
  title: z.string(),
  role: z
    .object({
      value: z.string(),
      grounding: z.enum(["explicit", "inferred"]).default("inferred"),
    })
    .optional(),
  goal: z.string().optional(),
  benefit: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).default([]),
  summary: z.string().optional(),
  userStory: z.string().optional(),
  asA: z.string().optional(),
  iWant: z.string().optional(),
  soThat: z.string().optional(),
  evidence: z
    .array(
      z.object({
        videoId: z.string(),
        title: z.string().optional(),
        summary: z.string().optional(),
        tRange: z.array(z.number().min(0)).length(2),
        representativeScreenshotId: z.string().optional(),
        screenshotIds: z.array(z.string()).default([]),
        transcriptCueIds: z.array(z.string()).min(1),
        transcriptQuote: z.string().min(1),
      })
    )
    .min(1),
  unverified: z.boolean().default(false),
  confidenceScore: z.number().min(0).max(100).optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export const StoryVaultZappingAnalysisResultSchema = z.object({
  schemaVersion: z
    .literal("storyvault-zapping-analysis-v2")
    .default("storyvault-zapping-analysis-v2"),
  generatedAt: z.string(),
  transcriptSummary: z.string().optional(),
  productContextSummary: z.string().optional(),
  operationIntent: z.string().optional(),
  storyCandidates: z
    .array(StoryVaultZappingAnalysisStoryCandidateSchema)
    .default([]),
  notes: z.array(z.string()).default([]),
});

export const StoryVaultRelatedContextPullRequestSchema = z.object({
  number: z.number().int().min(1),
  title: z.string(),
  htmlUrl: z.string(),
  author: z.string().optional(),
  state: z.string().optional(),
  mergedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  labels: z.array(z.string()).default([]),
  changedFiles: z.number().nullable().optional(),
  additions: z.number().nullable().optional(),
  deletions: z.number().nullable().optional(),
  relevanceScore: z.number().min(0).max(100).default(0),
  reason: z.string().optional(),
  matchedSignals: z.array(z.string()).default([]),
});

export const StoryVaultRelatedContextSlackMessageSchema = z.object({
  channelId: z.string().optional(),
  channelName: z.string().optional(),
  messageTs: z.string(),
  threadTs: z.string().optional().nullable(),
  permalink: z.string().optional(),
  author: z.string().optional().nullable(),
  text: z.string().optional(),
  postedAt: z.string().optional().nullable(),
  relevanceScore: z.number().min(0).max(100).default(0),
  reason: z.string().optional(),
  matchedSignals: z.array(z.string()).default([]),
});

export const StoryVaultRelatedContextKnowledgeDocumentSchema = z.object({
  documentId: z.string().optional(),
  name: z.string().optional(),
  displayName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  sourceKind: z
    .enum(["en-aistudioData", "drive", "upload", "web"])
    .optional()
    .nullable(),
  gcsUrl: z.string().optional().nullable(),
  bucketName: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  relevanceScore: z.number().min(0).max(100).default(0),
  reason: z.string().optional(),
  matchedSignals: z.array(z.string()).default([]),
  downloadUrl: z.string().optional().nullable(),
});

export const StoryVaultRelatedContextResultSchema = z.object({
  schemaVersion: z
    .literal("storyvault-related-context-v1")
    .default("storyvault-related-context-v1"),
  generatedAt: z.string(),
  status: z.enum(["completed", "error"]).default("completed"),
  github: z
    .object({
      repoFullName: z.string(),
      checkedAt: z.string(),
      pullRequests: z
        .array(StoryVaultRelatedContextPullRequestSchema)
        .default([]),
      errorMessage: z.string().optional(),
    })
    .optional(),
  slack: z
    .object({
      teamId: z.string().optional(),
      teamName: z.string().optional(),
      checkedAt: z.string(),
      messages: z
        .array(StoryVaultRelatedContextSlackMessageSchema)
        .default([]),
      errorMessage: z.string().optional(),
    })
    .optional(),
  knowledge: z
    .object({
      fileSpaceId: z.string(),
      checkedAt: z.string(),
      documents: z
        .array(StoryVaultRelatedContextKnowledgeDocumentSchema)
        .default([]),
      errorMessage: z.string().optional(),
    })
    .optional(),
  notes: z.array(z.string()).default([]),
});

export const StoryVaultOperationVideoRelatedContextsSchema = z.object({
  github: StoryVaultRelatedContextResultSchema.shape.github.optional(),
  slack: StoryVaultRelatedContextResultSchema.shape.slack.optional(),
  knowledge: StoryVaultRelatedContextResultSchema.shape.knowledge.optional(),
  generatedAt: z.string().optional(),
  status: z.enum(["running", "completed", "error"]).optional(),
  runningProvider: z.enum(["github", "slack", "knowledge"]).optional(),
  notes: z.array(z.string()).default([]),
});

export const StoryVaultOperationVideoGroupSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  name: z.string(),
  description: z.string().optional(),
  videoCount: z.number().min(0).default(0),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultOperationVideoGroupSchema =
  StoryVaultOperationVideoGroupSchema.extend({
    id: z.string(),
  });

export const StoryVaultOperationVideoSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  groupId: z.string().optional(),
  groupNameSnapshot: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  fileName: z.string(),
  bucketName: z.string(),
  storagePath: z.string(),
  contentType: z.string().default("video/webm"),
  sizeBytes: z.number().min(0).default(0),
  durationMs: z.number().min(0).optional(),
  transcriptText: z.string().optional(),
  transcriptProvider: z.string().optional(),
  transcriptSummary: z.string().optional(),
  transcriptSegments: z.array(StoryVaultTranscriptCueSchema).default([]),
  transcriptSrt: z.string().optional(),
  transcriptTimingStatus: StoryVaultTranscriptTimingStatusSchema.default(
    "unavailable"
  ),
  quickScan: StoryVaultOperationVideoQuickScanSchema.optional(),
  frameCaptures: z.array(StoryVaultOperationVideoFrameSchema).default([]),
  clips: z.array(StoryVaultOperationVideoClipSchema).default([]),
  clipCount: z.number().min(0).default(1),
  totalDurationMs: z.number().min(0).optional(),
  hasUnanalyzedClip: z.boolean().default(false),
  lastClipAddedAt: z.string().optional(),
  analysisStaleReason: z.string().optional(),
  tags: z.array(z.string()).default([]),
  fileSpaceId: z.string().optional(),
  fileSpaceRequestId: z.string().optional(),
  metadataFileName: z.string().optional(),
  metadataStoragePath: z.string().optional(),
  journeyFileName: z.string().optional(),
  journeyStoragePath: z.string().optional(),
  journeyFileSpaceRequestId: z.string().optional(),
  sourceAssetId: z.string().optional(),
  journeySourceAssetId: z.string().optional(),
  discoveryStatus: StoryVaultOperationVideoDiscoveryStatusSchema.default(
    "not_registered"
  ),
  discoveryErrorMessage: z.string().optional(),
  analysisStatus: StoryVaultZappingAnalysisStatusSchema.default("not_analyzed"),
  analysisRequestId: z.string().optional(),
  analysisSessionId: z.string().optional(),
  analysisOrganizationId: z.string().optional(),
  analysisSpaceId: z.string().optional(),
  analysisErrorMessage: z.string().optional(),
  analyzedAt: z.string().optional(),
  analysisResult: StoryVaultZappingAnalysisResultSchema.optional(),
  relatedContexts: StoryVaultOperationVideoRelatedContextsSchema.optional(),
  sourceDisplaySurface: StoryVaultOperationVideoDisplaySurfaceSchema.default(
    "unknown"
  ),
  recordedAt: z.string(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultOperationVideoSchema =
  StoryVaultOperationVideoSchema.extend({
    id: z.string(),
  });

export const StoryVaultApplicationScanRunSchema = z.object({
  requestId: z.string(),
  sessionId: z.string(),
  responseId: z.string().optional(),
  status: RequestStatusEnum,
  startUrl: z.string(),
  fileSpaceId: z.string().optional(),
  maxPages: z.number().optional(),
  captureScreenshots: z.boolean().optional(),
  exploreVariants: z.boolean().optional(),
  maxVariantsPerScreen: z.number().optional(),
  maxStepsPerScreen: z.number().optional(),
  allowChatSend: z.boolean().optional(),
  artifactCount: z.number().optional(),
  sourceAssetCount: z.number().optional(),
  discoveryQueuedCount: z.number().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});

export const StoryVaultApplicationScanProfileSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  name: z.string(),
  authMode: StoryVaultScanAuthModeSchema.default("none"),
  entryUrl: z.string(),
  loginUrl: z.string().optional(),
  username: z.string().optional(),
  passwordConfigured: z.boolean().default(false),
  passwordUpdatedAt: z.string().optional(),
  assistedSessionConfigured: z.boolean().default(false),
  assistedSessionUpdatedAt: z.string().optional(),
  usernameSelector: z.string().optional(),
  passwordSelector: z.string().optional(),
  submitSelector: z.string().optional(),
  includePatterns: z.array(z.string()).default([]),
  excludePatterns: z.array(z.string()).default([]),
  defaultExploreVariants: z.boolean().default(false),
  maxPages: z.number().min(1).max(50).default(12),
  maxVariantsPerScreen: z.number().min(0).max(10).default(5),
  maxStepsPerScreen: z.number().min(1).max(30).default(12),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultApplicationScanProfileSchema =
  StoryVaultApplicationScanProfileSchema.extend({
    id: z.string(),
  });

export const StoryVaultCapabilitySchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  capabilityKey: z.string(),
  name: z.string(),
  summary: z.string().optional(),
  domain: z.string().optional(),
  owner: z.string().optional(),
  labels: z.array(z.string()).default([]),
  parentCapabilityId: z.string().optional(),
  order: z.number().min(0).default(0),
  status: StoryVaultCapabilityStatusSchema.default("draft"),
  reviewState: StoryVaultReviewStateSchema.default("needs_review"),
  evidenceIds: z.array(z.string()).default([]),
  storyCount: z.number().min(0).default(0),
  highDriftCount: z.number().min(0).default(0),
  confidenceScore: z.number().min(0).max(100).default(0),
  driftLevel: StoryVaultDriftLevelSchema.default("medium"),
  driftReason: z.string().optional(),
  locked: z.boolean().default(false),
  generatedAt: z.string(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultCapabilitySchema =
  StoryVaultCapabilitySchema.extend({
    id: z.string(),
  });

export const StoryVaultSourceAssetSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  sourceType: StoryVaultSourceAssetTypeSchema,
  title: z.string(),
  summary: z.string().optional(),
  uri: z.string().optional(),
  gcsPath: z.string().optional(),
  storagePath: z.string().optional(),
  fileSpaceId: z.string().optional(),
  fileSpaceDocumentId: z.string().optional(),
  fileSpaceRequestId: z.string().optional(),
  repoFullName: z.string().optional(),
  path: z.string().optional(),
  pullRequest: z.string().optional(),
  commit: z.string().optional(),
  discoveryStatus: StoryVaultSourceAssetDiscoveryStatusSchema.default(
    "not_registered"
  ),
  discoveryDocumentId: z.string().optional(),
  discoveryErrorMessage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultSourceAssetSchema =
  StoryVaultSourceAssetSchema.extend({
    id: z.string(),
  });

export const StoryVaultGenerationSessionSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  phase: StoryVaultGenerationSessionPhaseSchema,
  adkMode: z.string().optional(),
  requestId: z.string().optional(),
  responseId: z.string().optional(),
  capabilityAdkSessionId: z.string().optional(),
  storyAdkSessionIds: z.array(z.string()).default([]),
  activeCapabilityId: z.string().optional(),
  activePatchId: z.string().optional(),
  status: StoryVaultGenerationSessionStatusSchema.default("idle"),
  lastMessage: z.string().optional(),
  errorMessage: z.string().optional(),
  sourceSnapshot: z
    .object({
      fileSpaceId: z.string().optional(),
      repoFullName: z.string().optional(),
      defaultBranch: z.string().optional(),
      screenshotCount: z.number().min(0).default(0),
      videoCount: z.number().min(0).default(0),
      zappingSearchDocumentCount: z.number().min(0).default(0),
      zappingFrameCount: z.number().min(0).default(0),
      transcriptCount: z.number().min(0).default(0),
      evidenceCount: z.number().min(0).default(0),
    })
    .default({
      screenshotCount: 0,
      videoCount: 0,
      zappingSearchDocumentCount: 0,
      zappingFrameCount: 0,
      transcriptCount: 0,
      evidenceCount: 0,
    }),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultGenerationSessionSchema =
  StoryVaultGenerationSessionSchema.extend({
    id: z.string(),
  });

export const StoryVaultDraftPatchSchema = z.object({
  id: z.string().optional(),
  generationSessionId: z.string(),
  applicationId: z.string().default("app-default"),
  agent: StoryVaultDraftPatchAgentSchema,
  targetType: StoryVaultDraftPatchTargetTypeSchema,
  operation: StoryVaultDraftPatchOperationSchema,
  status: StoryVaultDraftPatchStatusSchema.default("proposed"),
  title: z.string(),
  rationale: z.string(),
  before: z.record(z.string(), z.unknown()).optional(),
  after: z.record(z.string(), z.unknown()).optional(),
  affectedIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  createdBy: z.enum(["agent", "user"]).default("agent"),
  createdAt: z.instanceof(Timestamp).optional(),
  appliedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultDraftPatchSchema =
  StoryVaultDraftPatchSchema.extend({
    id: z.string(),
  });

export const StoryVaultMcpConnectionSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  tokenHash: z.string(),
  externalAgent: z.string().default("codex"),
  allowedApplicationIds: z.array(z.string()).default([]),
  scopes: z.array(z.string()).default(["context:read"]),
  createdBy: z.string().optional(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
  revokedAt: z.instanceof(Timestamp).optional().nullable(),
  lastUsedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultMcpConnectionSchema =
  StoryVaultMcpConnectionSchema.extend({
    id: z.string(),
  });

export const StoryVaultAgentPlanSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string(),
  storyId: z.string().optional().nullable(),
  capabilityId: z.string().optional().nullable(),
  externalAgent: z.string().default("codex"),
  title: z.string(),
  summary: z.string().optional().nullable(),
  planMarkdown: z.string(),
  evidenceIds: z.array(z.string()).default([]),
  implementationRefs: z.array(z.record(z.string(), z.unknown())).default([]),
  patchSuggestion: z.record(z.string(), z.unknown()).optional().nullable(),
  status: StoryVaultAgentPlanStatusSchema.default("proposed"),
  mcpConnectionId: z.string().optional(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedStoryVaultAgentPlanSchema =
  StoryVaultAgentPlanSchema.extend({
    id: z.string(),
  });

export type StoryVaultStoryStatus = z.infer<
  typeof StoryVaultStoryStatusSchema
>;
export type StoryVaultReviewState = z.infer<
  typeof StoryVaultReviewStateSchema
>;
export type StoryVaultDriftLevel = z.infer<typeof StoryVaultDriftLevelSchema>;
export type StoryVaultEvidenceType = z.infer<
  typeof StoryVaultEvidenceTypeSchema
>;
export type StoryVaultSourceProvider = z.infer<
  typeof StoryVaultSourceProviderSchema
>;
export type StoryVaultApplicationFileSpaceProvisioningStatus = z.infer<
  typeof StoryVaultApplicationFileSpaceProvisioningStatusSchema
>;
export type StoryVaultOperationVideoDiscoveryStatus = z.infer<
  typeof StoryVaultOperationVideoDiscoveryStatusSchema
>;
export type StoryVaultOperationVideoDisplaySurface = z.infer<
  typeof StoryVaultOperationVideoDisplaySurfaceSchema
>;
export type StoryVaultOperationVideoFrame = z.infer<
  typeof StoryVaultOperationVideoFrameSchema
>;
export type StoryVaultOperationVideoQuickScan = z.infer<
  typeof StoryVaultOperationVideoQuickScanSchema
>;
export type StoryVaultTranscriptCue = z.infer<
  typeof StoryVaultTranscriptCueSchema
>;
export type StoryVaultTranscriptTimingStatus = z.infer<
  typeof StoryVaultTranscriptTimingStatusSchema
>;
export type StoryVaultOperationVideoClip = z.infer<
  typeof StoryVaultOperationVideoClipSchema
>;
export type StoryVaultZappingAnalysisStatus = z.infer<
  typeof StoryVaultZappingAnalysisStatusSchema
>;
export type StoryVaultZappingAnalysisResult = z.infer<
  typeof StoryVaultZappingAnalysisResultSchema
>;
export type StoryVaultZappingAnalysisStoryCandidate = z.infer<
  typeof StoryVaultZappingAnalysisStoryCandidateSchema
>;
export type StoryVaultRelatedContextPullRequest = z.infer<
  typeof StoryVaultRelatedContextPullRequestSchema
>;
export type StoryVaultRelatedContextSlackMessage = z.infer<
  typeof StoryVaultRelatedContextSlackMessageSchema
>;
export type StoryVaultRelatedContextKnowledgeDocument = z.infer<
  typeof StoryVaultRelatedContextKnowledgeDocumentSchema
>;
export type StoryVaultRelatedContextResult = z.infer<
  typeof StoryVaultRelatedContextResultSchema
>;
export type StoryVaultOperationVideoRelatedContexts = z.infer<
  typeof StoryVaultOperationVideoRelatedContextsSchema
>;
export type StoryVaultApplication = z.infer<
  typeof StoryVaultApplicationSchema
>;
export type DecodedStoryVaultApplication = z.infer<
  typeof DecodedStoryVaultApplicationSchema
>;
export type StoryVaultAcceptanceCriterion = z.infer<
  typeof StoryVaultAcceptanceCriterionSchema
>;
export type StoryVaultCodeRef = z.infer<typeof StoryVaultCodeRefSchema>;
export type StoryVaultGenerationTrace = z.infer<
  typeof StoryVaultGenerationTraceSchema
>;
export type StoryVaultStory = z.infer<typeof StoryVaultStorySchema>;
export type DecodedStoryVaultStory = z.infer<
  typeof DecodedStoryVaultStorySchema
>;
export type StoryVaultStoryEvidence = z.infer<
  typeof StoryVaultStoryEvidenceSchema
>;
export type DecodedStoryVaultStoryEvidence = z.infer<
  typeof DecodedStoryVaultStoryEvidenceSchema
>;
export type StoryVaultSourceConnection = z.infer<
  typeof StoryVaultSourceConnectionSchema
>;
export type DecodedStoryVaultSourceConnection = z.infer<
  typeof DecodedStoryVaultSourceConnectionSchema
>;
export type StoryVaultOperationVideo = z.infer<
  typeof StoryVaultOperationVideoSchema
>;
export type DecodedStoryVaultOperationVideo = z.infer<
  typeof DecodedStoryVaultOperationVideoSchema
>;
export type StoryVaultOperationVideoGroup = z.infer<
  typeof StoryVaultOperationVideoGroupSchema
>;
export type DecodedStoryVaultOperationVideoGroup = z.infer<
  typeof DecodedStoryVaultOperationVideoGroupSchema
>;
export type StoryVaultApplicationScanRun = z.infer<
  typeof StoryVaultApplicationScanRunSchema
>;
export type StoryVaultApplicationScanProfile = z.infer<
  typeof StoryVaultApplicationScanProfileSchema
>;
export type DecodedStoryVaultApplicationScanProfile = z.infer<
  typeof DecodedStoryVaultApplicationScanProfileSchema
>;
export type StoryVaultScanAuthMode = z.infer<
  typeof StoryVaultScanAuthModeSchema
>;
export type StoryVaultCapabilityStatus = z.infer<
  typeof StoryVaultCapabilityStatusSchema
>;
export type StoryVaultSourceAssetType = z.infer<
  typeof StoryVaultSourceAssetTypeSchema
>;
export type StoryVaultSourceAssetDiscoveryStatus = z.infer<
  typeof StoryVaultSourceAssetDiscoveryStatusSchema
>;
export type StoryVaultCapability = z.infer<typeof StoryVaultCapabilitySchema>;
export type DecodedStoryVaultCapability = z.infer<
  typeof DecodedStoryVaultCapabilitySchema
>;
export type StoryVaultSourceAsset = z.infer<typeof StoryVaultSourceAssetSchema>;
export type DecodedStoryVaultSourceAsset = z.infer<
  typeof DecodedStoryVaultSourceAssetSchema
>;
export type StoryVaultGenerationSession = z.infer<
  typeof StoryVaultGenerationSessionSchema
>;
export type DecodedStoryVaultGenerationSession = z.infer<
  typeof DecodedStoryVaultGenerationSessionSchema
>;
export type StoryVaultDraftPatch = z.infer<typeof StoryVaultDraftPatchSchema>;
export type DecodedStoryVaultDraftPatch = z.infer<
  typeof DecodedStoryVaultDraftPatchSchema
>;
export type StoryVaultMcpConnection = z.infer<
  typeof StoryVaultMcpConnectionSchema
>;
export type DecodedStoryVaultMcpConnection = z.infer<
  typeof DecodedStoryVaultMcpConnectionSchema
>;
export type StoryVaultAgentPlanStatus = z.infer<
  typeof StoryVaultAgentPlanStatusSchema
>;
export type StoryVaultAgentPlan = z.infer<typeof StoryVaultAgentPlanSchema>;
export type DecodedStoryVaultAgentPlan = z.infer<
  typeof DecodedStoryVaultAgentPlanSchema
>;

export const storyVaultStoryConverter = firestoreTypeConverter(
  DecodedStoryVaultStorySchema
);
export const storyVaultApplicationConverter = firestoreTypeConverter(
  DecodedStoryVaultApplicationSchema
);
export const storyVaultStoryEvidenceConverter = firestoreTypeConverter(
  DecodedStoryVaultStoryEvidenceSchema
);
export const storyVaultSourceConnectionConverter = firestoreTypeConverter(
  DecodedStoryVaultSourceConnectionSchema
);
export const storyVaultOperationVideoConverter = firestoreTypeConverter(
  DecodedStoryVaultOperationVideoSchema
);
export const storyVaultOperationVideoGroupConverter = firestoreTypeConverter(
  DecodedStoryVaultOperationVideoGroupSchema
);
export const storyVaultApplicationScanProfileConverter = firestoreTypeConverter(
  DecodedStoryVaultApplicationScanProfileSchema
);
export const storyVaultCapabilityConverter = firestoreTypeConverter(
  DecodedStoryVaultCapabilitySchema
);
export const storyVaultSourceAssetConverter = firestoreTypeConverter(
  DecodedStoryVaultSourceAssetSchema
);
export const storyVaultGenerationSessionConverter = firestoreTypeConverter(
  DecodedStoryVaultGenerationSessionSchema
);
export const storyVaultDraftPatchConverter = firestoreTypeConverter(
  DecodedStoryVaultDraftPatchSchema
);
export const storyVaultMcpConnectionConverter = firestoreTypeConverter(
  DecodedStoryVaultMcpConnectionSchema
);
export const storyVaultAgentPlanConverter = firestoreTypeConverter(
  DecodedStoryVaultAgentPlanSchema
);

export const STORYVAULT_STATUS_LABELS: Record<
  StoryVaultStoryStatus,
  string
> = {
  discovery: "検討中",
  ready_for_dev: "設計完了",
  implemented: "実装済み",
  released: "リリース済み",
};

export const STORYVAULT_DRIFT_LABELS: Record<
  StoryVaultDriftLevel,
  string
> = {
  none: "差分なし",
  low: "軽微",
  medium: "要確認",
  high: "高リスク",
};
