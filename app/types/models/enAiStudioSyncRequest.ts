import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestMetadataSchema } from "./core/operationMetadata";
import { RequestStatusEnum, RequestLogSchema } from "./core/requestStatus";

export const EnAiStudioSyncTargetsSchema = z.object({
  gsheet: z.boolean().default(true),
  gcsKnowledge: z.boolean().default(true),
  fileSearch: z.boolean().default(true),
  spaceBusinessPartners: z.boolean().default(true),
});

export type EnAiStudioSyncTargets = z.infer<typeof EnAiStudioSyncTargetsSchema>;

export const EnAiStudioSyncInputSchema = z.object({
  operationType: z.literal("syncAiStudioData"),
  workspaceId: z.string(),
  targets: EnAiStudioSyncTargetsSchema,
  /** クライアントが GCS knowledge にアップロード済みの相対パス（baseGcsPath 起点） */
  knowledgeSnapshotGcsPath: z.string().optional(),
  knowledgeSnapshotFilename: z.string().optional(),
  defaultFileSpaceStoreId: z.string().optional(),
});

export const EnAiStudioSyncOutputSchema = z
  .object({
    gsheetExport: z
      .object({
        writtenSheetNames: z.array(z.string()).default([]),
        skippedSheetNames: z.array(z.string()).default([]),
        warnings: z.array(z.string()).default([]),
      })
      .optional(),
    gcsKnowledgeUri: z.string().optional(),
    spaceBusinessPartnersGcsUri: z.string().optional(),
    fileSearchNote: z.string().optional(),
  })
  .nullable();

export const EnAiStudioSyncRequestSchema = z.object({
  input: EnAiStudioSyncInputSchema,
  operationMetadata: RequestMetadataSchema,
  output: EnAiStudioSyncOutputSchema.optional(),
  status: RequestStatusEnum.default("pending"),
  logs: z.array(RequestLogSchema).default([]),
  errorMessage: z.string().optional(),
});

export const DecodedEnAiStudioSyncRequestSchema = EnAiStudioSyncRequestSchema.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});

export type DecodedEnAiStudioSyncRequest = z.infer<typeof DecodedEnAiStudioSyncRequestSchema>;

export const enAiStudioSyncRequestConverter = firestoreTypeConverter(
  DecodedEnAiStudioSyncRequestSchema
);
