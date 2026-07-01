import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestStatusEnum } from "./core/requestStatus";

export const VibeControlStoryStatusSchema = z.enum([
  "discovery",
  "ready_for_dev",
  "implemented",
  "released",
]);

export const VibeControlReviewStateSchema = z.enum([
  "ready",
  "needs_review",
]);

export const VibeControlDriftLevelSchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
]);

export const VibeControlEvidenceTypeSchema = z.enum([
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

export const VibeControlSourceProviderSchema = z.enum([
  "file_space",
  "github",
  "drive",
  "web",
  "imported_ticket",
]);

export const VibeControlSourceConnectionStatusSchema = z.enum([
  "connected",
  "needs_setup",
  "syncing",
  "error",
]);

export const VibeControlApplicationFileSpaceProvisioningStatusSchema = z.enum([
  "missing",
  "creating",
  "ready",
  "error",
]);

export const VibeControlOperationVideoDiscoveryStatusSchema = z.enum([
  "not_registered",
  "queued",
  "completed",
  "error",
]);

export const VibeControlOperationVideoDisplaySurfaceSchema = z.enum([
  "browser",
  "monitor",
  "window",
  "unknown",
]);

export const VibeControlOperationVideoFrameSchema = z.object({
  id: z.string(),
  timestampMs: z.number().min(0),
  fileName: z.string(),
  bucketName: z.string().optional(),
  storagePath: z.string().optional(),
  contentType: z.string().default("image/jpeg"),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
});

export const VibeControlTranscriptTimingStatusSchema = z.enum([
  "timestamped",
  "unavailable",
]);

export const VibeControlTranscriptCueSchema = z.object({
  id: z.string(),
  index: z.number().int().min(1),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  text: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export const VibeControlOperationVideoQuickScanSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  operationMemo: z.string().optional(),
  operationSteps: z.array(z.string()).default([]),
  transcriptSummary: z.string().optional(),
  provider: z.string().optional(),
  generatedAt: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const VibeControlOperationVideoClipSchema = z.object({
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
  transcriptSegments: z.array(VibeControlTranscriptCueSchema).default([]),
  transcriptSrt: z.string().optional(),
  transcriptTimingStatus: VibeControlTranscriptTimingStatusSchema.default(
    "unavailable"
  ),
  quickScan: VibeControlOperationVideoQuickScanSchema.optional(),
  frameCaptures: z.array(VibeControlOperationVideoFrameSchema).default([]),
  metadataFileName: z.string().optional(),
  metadataStoragePath: z.string().optional(),
  journeyFileName: z.string().optional(),
  journeyStoragePath: z.string().optional(),
  fileSpaceRequestId: z.string().optional(),
  journeyFileSpaceRequestId: z.string().optional(),
  sourceAssetId: z.string().optional(),
  journeySourceAssetId: z.string().optional(),
  sourceDisplaySurface: VibeControlOperationVideoDisplaySurfaceSchema.default(
    "unknown"
  ),
  recordedAt: z.string(),
});

export const VibeControlZappingAnalysisStatusSchema = z.enum([
  "not_analyzed",
  "queued",
  "running",
  "completed",
  "error",
]);

export const VibeControlCapabilityStatusSchema = z.enum([
  "draft",
  "active",
  "archived",
]);

export const VibeControlSourceAssetTypeSchema = z.enum([
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

export const VibeControlSourceAssetDiscoveryStatusSchema = z.enum([
  "not_registered",
  "queued",
  "completed",
  "error",
]);

export const VibeControlScanAuthModeSchema = z.enum([
  "none",
  "credentials",
  "email_link_manual",
  "assisted_session",
]);

export const VibeControlGenerationSessionPhaseSchema = z.enum([
  "source_ingest",
  "capability_structuring",
  "story_generation",
  "review",
  "completed",
  "error",
]);

export const VibeControlGenerationSessionStatusSchema = z.enum([
  "idle",
  "running",
  "waiting_user",
  "completed",
  "error",
]);

export const VibeControlDraftPatchAgentSchema = z.enum([
  "capability",
  "story",
  "media_ingest",
]);

export const VibeControlDraftPatchTargetTypeSchema = z.enum([
  "capability",
  "story",
  "evidence",
  "source_asset",
]);

export const VibeControlDraftPatchOperationSchema = z.enum([
  "create",
  "update",
  "delete",
  "merge",
  "split",
  "move_evidence",
  "reorder",
  "lock",
]);

export const VibeControlDraftPatchStatusSchema = z.enum([
  "proposed",
  "applied",
  "rejected",
  "superseded",
]);

export const VibeControlAgentPlanStatusSchema = z.enum([
  "proposed",
  "accepted",
  "rejected",
  "superseded",
]);

export const VibeControlApplicationSchema = z.object({
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
    VibeControlApplicationFileSpaceProvisioningStatusSchema.optional(),
  fileSpaceErrorMessage: z.string().optional(),
  repoFullName: z.string().min(1),
  defaultBranch: z.string().optional(),
  storyCount: z.number().min(0).default(0),
  highDriftCount: z.number().min(0).default(0),
  lastGeneratedAt: z.string().optional(),
  lastScan: z.lazy(() => VibeControlApplicationScanRunSchema).optional(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedVibeControlApplicationSchema =
  VibeControlApplicationSchema.extend({
    id: z.string(),
  });

export const VibeControlAcceptanceCriterionSchema = z.object({
  id: z.string(),
  text: z.string(),
  state: z.enum(["covered", "missing", "conflict", "unknown"]),
  evidenceIds: z.array(z.string()).default([]),
});

export const VibeControlCodeRefSchema = z.object({
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

export const VibeControlGenerationTraceSchema = z.object({
  at: z.string(),
  actor: z.enum(["agent", "user", "system"]),
  message: z.string(),
});

const NullableOptionalStringSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? undefined);

export const VibeControlStorySchema = z.object({
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
  status: VibeControlStoryStatusSchema,
  reviewState: VibeControlReviewStateSchema.default("ready"),
  domain: z.string(),
  milestone: z.string(),
  labels: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(100),
  driftLevel: VibeControlDriftLevelSchema,
  driftReason: z.string().optional(),
  sourceFreshness: z.object({
    knowledgeCheckedAt: NullableOptionalStringSchema,
    githubCheckedAt: NullableOptionalStringSchema,
    staleSources: z.array(z.string()).default([]),
  }),
  acceptanceCriteria: z.array(VibeControlAcceptanceCriterionSchema).default([]),
  evidenceIds: z.array(z.string()).default([]),
  codeRefs: z.array(VibeControlCodeRefSchema).default([]),
  generationTrace: z.array(VibeControlGenerationTraceSchema).default([]),
  fileSpaceId: z.string().optional(),
  repoFullName: z.string().optional(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
  generatedAt: z.string(),
});

export const DecodedVibeControlStorySchema = VibeControlStorySchema.extend({
  id: z.string(),
});

export const VibeControlStoryEvidenceSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  capabilityId: z.string().optional(),
  capabilityKey: z.string().optional(),
  storyId: z.string().default(""),
  storyKey: z.string().default(""),
  sourceAssetId: z.string().optional(),
  type: VibeControlEvidenceTypeSchema,
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
  codeRef: VibeControlCodeRefSchema.optional(),
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

export const DecodedVibeControlStoryEvidenceSchema =
  VibeControlStoryEvidenceSchema.extend({
    id: z.string(),
  });

export const VibeControlSourceConnectionSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  provider: VibeControlSourceProviderSchema,
  status: VibeControlSourceConnectionStatusSchema,
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

export const DecodedVibeControlSourceConnectionSchema =
  VibeControlSourceConnectionSchema.extend({
    id: z.string(),
  });

export const VibeControlZappingAnalysisStoryCandidateSchema = z.object({
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

export const VibeControlZappingAnalysisResultSchema = z.object({
  schemaVersion: z
    .literal("vibe-control-zapping-analysis-v2")
    .default("vibe-control-zapping-analysis-v2"),
  generatedAt: z.string(),
  transcriptSummary: z.string().optional(),
  productContextSummary: z.string().optional(),
  operationIntent: z.string().optional(),
  storyCandidates: z
    .array(VibeControlZappingAnalysisStoryCandidateSchema)
    .default([]),
  notes: z.array(z.string()).default([]),
});

export const VibeControlRelatedContextPullRequestSchema = z.object({
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

export const VibeControlRelatedContextSlackMessageSchema = z.object({
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

export const VibeControlRelatedContextKnowledgeDocumentSchema = z.object({
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

export const VibeControlRelatedContextResultSchema = z.object({
  schemaVersion: z
    .literal("vibe-control-related-context-v1")
    .default("vibe-control-related-context-v1"),
  generatedAt: z.string(),
  status: z.enum(["completed", "error"]).default("completed"),
  github: z
    .object({
      repoFullName: z.string(),
      checkedAt: z.string(),
      pullRequests: z
        .array(VibeControlRelatedContextPullRequestSchema)
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
        .array(VibeControlRelatedContextSlackMessageSchema)
        .default([]),
      errorMessage: z.string().optional(),
    })
    .optional(),
  knowledge: z
    .object({
      fileSpaceId: z.string(),
      checkedAt: z.string(),
      documents: z
        .array(VibeControlRelatedContextKnowledgeDocumentSchema)
        .default([]),
      errorMessage: z.string().optional(),
    })
    .optional(),
  notes: z.array(z.string()).default([]),
});

export const VibeControlOperationVideoRelatedContextsSchema = z.object({
  github: VibeControlRelatedContextResultSchema.shape.github.optional(),
  slack: VibeControlRelatedContextResultSchema.shape.slack.optional(),
  knowledge: VibeControlRelatedContextResultSchema.shape.knowledge.optional(),
  generatedAt: z.string().optional(),
  status: z.enum(["running", "completed", "error"]).optional(),
  runningProvider: z.enum(["github", "slack", "knowledge"]).optional(),
  notes: z.array(z.string()).default([]),
});

export const VibeControlOperationVideoGroupSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  name: z.string(),
  description: z.string().optional(),
  videoCount: z.number().min(0).default(0),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedVibeControlOperationVideoGroupSchema =
  VibeControlOperationVideoGroupSchema.extend({
    id: z.string(),
  });

export const VibeControlOperationVideoSchema = z.object({
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
  transcriptSegments: z.array(VibeControlTranscriptCueSchema).default([]),
  transcriptSrt: z.string().optional(),
  transcriptTimingStatus: VibeControlTranscriptTimingStatusSchema.default(
    "unavailable"
  ),
  quickScan: VibeControlOperationVideoQuickScanSchema.optional(),
  frameCaptures: z.array(VibeControlOperationVideoFrameSchema).default([]),
  clips: z.array(VibeControlOperationVideoClipSchema).default([]),
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
  discoveryStatus: VibeControlOperationVideoDiscoveryStatusSchema.default(
    "not_registered"
  ),
  discoveryErrorMessage: z.string().optional(),
  analysisStatus: VibeControlZappingAnalysisStatusSchema.default("not_analyzed"),
  analysisRequestId: z.string().optional(),
  analysisSessionId: z.string().optional(),
  analysisOrganizationId: z.string().optional(),
  analysisSpaceId: z.string().optional(),
  analysisErrorMessage: z.string().optional(),
  analyzedAt: z.string().optional(),
  analysisResult: VibeControlZappingAnalysisResultSchema.optional(),
  relatedContexts: VibeControlOperationVideoRelatedContextsSchema.optional(),
  sourceDisplaySurface: VibeControlOperationVideoDisplaySurfaceSchema.default(
    "unknown"
  ),
  recordedAt: z.string(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedVibeControlOperationVideoSchema =
  VibeControlOperationVideoSchema.extend({
    id: z.string(),
  });

export const VibeControlApplicationScanRunSchema = z.object({
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

export const VibeControlApplicationScanProfileSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  name: z.string(),
  authMode: VibeControlScanAuthModeSchema.default("none"),
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

export const DecodedVibeControlApplicationScanProfileSchema =
  VibeControlApplicationScanProfileSchema.extend({
    id: z.string(),
  });

export const VibeControlCapabilitySchema = z.object({
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
  status: VibeControlCapabilityStatusSchema.default("draft"),
  reviewState: VibeControlReviewStateSchema.default("needs_review"),
  evidenceIds: z.array(z.string()).default([]),
  storyCount: z.number().min(0).default(0),
  highDriftCount: z.number().min(0).default(0),
  confidenceScore: z.number().min(0).max(100).default(0),
  driftLevel: VibeControlDriftLevelSchema.default("medium"),
  driftReason: z.string().optional(),
  locked: z.boolean().default(false),
  generatedAt: z.string(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedVibeControlCapabilitySchema =
  VibeControlCapabilitySchema.extend({
    id: z.string(),
  });

export const VibeControlSourceAssetSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  sourceType: VibeControlSourceAssetTypeSchema,
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
  discoveryStatus: VibeControlSourceAssetDiscoveryStatusSchema.default(
    "not_registered"
  ),
  discoveryDocumentId: z.string().optional(),
  discoveryErrorMessage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedVibeControlSourceAssetSchema =
  VibeControlSourceAssetSchema.extend({
    id: z.string(),
  });

export const VibeControlGenerationSessionSchema = z.object({
  id: z.string().optional(),
  applicationId: z.string().default("app-default"),
  applicationKey: z.string().default("APP"),
  phase: VibeControlGenerationSessionPhaseSchema,
  adkMode: z.string().optional(),
  requestId: z.string().optional(),
  responseId: z.string().optional(),
  capabilityAdkSessionId: z.string().optional(),
  storyAdkSessionIds: z.array(z.string()).default([]),
  activeCapabilityId: z.string().optional(),
  activePatchId: z.string().optional(),
  status: VibeControlGenerationSessionStatusSchema.default("idle"),
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

export const DecodedVibeControlGenerationSessionSchema =
  VibeControlGenerationSessionSchema.extend({
    id: z.string(),
  });

export const VibeControlDraftPatchSchema = z.object({
  id: z.string().optional(),
  generationSessionId: z.string(),
  applicationId: z.string().default("app-default"),
  agent: VibeControlDraftPatchAgentSchema,
  targetType: VibeControlDraftPatchTargetTypeSchema,
  operation: VibeControlDraftPatchOperationSchema,
  status: VibeControlDraftPatchStatusSchema.default("proposed"),
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

export const DecodedVibeControlDraftPatchSchema =
  VibeControlDraftPatchSchema.extend({
    id: z.string(),
  });

export const VibeControlMcpConnectionSchema = z.object({
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

export const DecodedVibeControlMcpConnectionSchema =
  VibeControlMcpConnectionSchema.extend({
    id: z.string(),
  });

export const VibeControlAgentPlanSchema = z.object({
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
  status: VibeControlAgentPlanStatusSchema.default("proposed"),
  mcpConnectionId: z.string().optional(),
  createdAt: z.instanceof(Timestamp).optional(),
  updatedAt: z.instanceof(Timestamp).optional(),
});

export const DecodedVibeControlAgentPlanSchema =
  VibeControlAgentPlanSchema.extend({
    id: z.string(),
  });

export type VibeControlStoryStatus = z.infer<
  typeof VibeControlStoryStatusSchema
>;
export type VibeControlReviewState = z.infer<
  typeof VibeControlReviewStateSchema
>;
export type VibeControlDriftLevel = z.infer<typeof VibeControlDriftLevelSchema>;
export type VibeControlEvidenceType = z.infer<
  typeof VibeControlEvidenceTypeSchema
>;
export type VibeControlSourceProvider = z.infer<
  typeof VibeControlSourceProviderSchema
>;
export type VibeControlApplicationFileSpaceProvisioningStatus = z.infer<
  typeof VibeControlApplicationFileSpaceProvisioningStatusSchema
>;
export type VibeControlOperationVideoDiscoveryStatus = z.infer<
  typeof VibeControlOperationVideoDiscoveryStatusSchema
>;
export type VibeControlOperationVideoDisplaySurface = z.infer<
  typeof VibeControlOperationVideoDisplaySurfaceSchema
>;
export type VibeControlOperationVideoFrame = z.infer<
  typeof VibeControlOperationVideoFrameSchema
>;
export type VibeControlOperationVideoQuickScan = z.infer<
  typeof VibeControlOperationVideoQuickScanSchema
>;
export type VibeControlTranscriptCue = z.infer<
  typeof VibeControlTranscriptCueSchema
>;
export type VibeControlTranscriptTimingStatus = z.infer<
  typeof VibeControlTranscriptTimingStatusSchema
>;
export type VibeControlOperationVideoClip = z.infer<
  typeof VibeControlOperationVideoClipSchema
>;
export type VibeControlZappingAnalysisStatus = z.infer<
  typeof VibeControlZappingAnalysisStatusSchema
>;
export type VibeControlZappingAnalysisResult = z.infer<
  typeof VibeControlZappingAnalysisResultSchema
>;
export type VibeControlZappingAnalysisStoryCandidate = z.infer<
  typeof VibeControlZappingAnalysisStoryCandidateSchema
>;
export type VibeControlRelatedContextPullRequest = z.infer<
  typeof VibeControlRelatedContextPullRequestSchema
>;
export type VibeControlRelatedContextSlackMessage = z.infer<
  typeof VibeControlRelatedContextSlackMessageSchema
>;
export type VibeControlRelatedContextKnowledgeDocument = z.infer<
  typeof VibeControlRelatedContextKnowledgeDocumentSchema
>;
export type VibeControlRelatedContextResult = z.infer<
  typeof VibeControlRelatedContextResultSchema
>;
export type VibeControlOperationVideoRelatedContexts = z.infer<
  typeof VibeControlOperationVideoRelatedContextsSchema
>;
export type VibeControlApplication = z.infer<
  typeof VibeControlApplicationSchema
>;
export type DecodedVibeControlApplication = z.infer<
  typeof DecodedVibeControlApplicationSchema
>;
export type VibeControlAcceptanceCriterion = z.infer<
  typeof VibeControlAcceptanceCriterionSchema
>;
export type VibeControlCodeRef = z.infer<typeof VibeControlCodeRefSchema>;
export type VibeControlGenerationTrace = z.infer<
  typeof VibeControlGenerationTraceSchema
>;
export type VibeControlStory = z.infer<typeof VibeControlStorySchema>;
export type DecodedVibeControlStory = z.infer<
  typeof DecodedVibeControlStorySchema
>;
export type VibeControlStoryEvidence = z.infer<
  typeof VibeControlStoryEvidenceSchema
>;
export type DecodedVibeControlStoryEvidence = z.infer<
  typeof DecodedVibeControlStoryEvidenceSchema
>;
export type VibeControlSourceConnection = z.infer<
  typeof VibeControlSourceConnectionSchema
>;
export type DecodedVibeControlSourceConnection = z.infer<
  typeof DecodedVibeControlSourceConnectionSchema
>;
export type VibeControlOperationVideo = z.infer<
  typeof VibeControlOperationVideoSchema
>;
export type DecodedVibeControlOperationVideo = z.infer<
  typeof DecodedVibeControlOperationVideoSchema
>;
export type VibeControlOperationVideoGroup = z.infer<
  typeof VibeControlOperationVideoGroupSchema
>;
export type DecodedVibeControlOperationVideoGroup = z.infer<
  typeof DecodedVibeControlOperationVideoGroupSchema
>;
export type VibeControlApplicationScanRun = z.infer<
  typeof VibeControlApplicationScanRunSchema
>;
export type VibeControlApplicationScanProfile = z.infer<
  typeof VibeControlApplicationScanProfileSchema
>;
export type DecodedVibeControlApplicationScanProfile = z.infer<
  typeof DecodedVibeControlApplicationScanProfileSchema
>;
export type VibeControlScanAuthMode = z.infer<
  typeof VibeControlScanAuthModeSchema
>;
export type VibeControlCapabilityStatus = z.infer<
  typeof VibeControlCapabilityStatusSchema
>;
export type VibeControlSourceAssetType = z.infer<
  typeof VibeControlSourceAssetTypeSchema
>;
export type VibeControlSourceAssetDiscoveryStatus = z.infer<
  typeof VibeControlSourceAssetDiscoveryStatusSchema
>;
export type VibeControlCapability = z.infer<typeof VibeControlCapabilitySchema>;
export type DecodedVibeControlCapability = z.infer<
  typeof DecodedVibeControlCapabilitySchema
>;
export type VibeControlSourceAsset = z.infer<typeof VibeControlSourceAssetSchema>;
export type DecodedVibeControlSourceAsset = z.infer<
  typeof DecodedVibeControlSourceAssetSchema
>;
export type VibeControlGenerationSession = z.infer<
  typeof VibeControlGenerationSessionSchema
>;
export type DecodedVibeControlGenerationSession = z.infer<
  typeof DecodedVibeControlGenerationSessionSchema
>;
export type VibeControlDraftPatch = z.infer<typeof VibeControlDraftPatchSchema>;
export type DecodedVibeControlDraftPatch = z.infer<
  typeof DecodedVibeControlDraftPatchSchema
>;
export type VibeControlMcpConnection = z.infer<
  typeof VibeControlMcpConnectionSchema
>;
export type DecodedVibeControlMcpConnection = z.infer<
  typeof DecodedVibeControlMcpConnectionSchema
>;
export type VibeControlAgentPlanStatus = z.infer<
  typeof VibeControlAgentPlanStatusSchema
>;
export type VibeControlAgentPlan = z.infer<typeof VibeControlAgentPlanSchema>;
export type DecodedVibeControlAgentPlan = z.infer<
  typeof DecodedVibeControlAgentPlanSchema
>;

export const vibeControlStoryConverter = firestoreTypeConverter(
  DecodedVibeControlStorySchema
);
export const vibeControlApplicationConverter = firestoreTypeConverter(
  DecodedVibeControlApplicationSchema
);
export const vibeControlStoryEvidenceConverter = firestoreTypeConverter(
  DecodedVibeControlStoryEvidenceSchema
);
export const vibeControlSourceConnectionConverter = firestoreTypeConverter(
  DecodedVibeControlSourceConnectionSchema
);
export const vibeControlOperationVideoConverter = firestoreTypeConverter(
  DecodedVibeControlOperationVideoSchema
);
export const vibeControlOperationVideoGroupConverter = firestoreTypeConverter(
  DecodedVibeControlOperationVideoGroupSchema
);
export const vibeControlApplicationScanProfileConverter = firestoreTypeConverter(
  DecodedVibeControlApplicationScanProfileSchema
);
export const vibeControlCapabilityConverter = firestoreTypeConverter(
  DecodedVibeControlCapabilitySchema
);
export const vibeControlSourceAssetConverter = firestoreTypeConverter(
  DecodedVibeControlSourceAssetSchema
);
export const vibeControlGenerationSessionConverter = firestoreTypeConverter(
  DecodedVibeControlGenerationSessionSchema
);
export const vibeControlDraftPatchConverter = firestoreTypeConverter(
  DecodedVibeControlDraftPatchSchema
);
export const vibeControlMcpConnectionConverter = firestoreTypeConverter(
  DecodedVibeControlMcpConnectionSchema
);
export const vibeControlAgentPlanConverter = firestoreTypeConverter(
  DecodedVibeControlAgentPlanSchema
);

export const VIBE_CONTROL_STATUS_LABELS: Record<
  VibeControlStoryStatus,
  string
> = {
  discovery: "検討中",
  ready_for_dev: "設計完了",
  implemented: "実装済み",
  released: "リリース済み",
};

export const VIBE_CONTROL_DRIFT_LABELS: Record<
  VibeControlDriftLevel,
  string
> = {
  none: "差分なし",
  low: "軽微",
  medium: "要確認",
  high: "高リスク",
};
