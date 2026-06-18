import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

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

export const VibeControlStorySchema = z.object({
  id: z.string().optional(),
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
    knowledgeCheckedAt: z.string().optional(),
    githubCheckedAt: z.string().optional(),
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
  storyId: z.string(),
  storyKey: z.string(),
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

export const vibeControlStoryConverter = firestoreTypeConverter(
  DecodedVibeControlStorySchema
);
export const vibeControlStoryEvidenceConverter = firestoreTypeConverter(
  DecodedVibeControlStoryEvidenceSchema
);
export const vibeControlSourceConnectionConverter = firestoreTypeConverter(
  DecodedVibeControlSourceConnectionSchema
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
