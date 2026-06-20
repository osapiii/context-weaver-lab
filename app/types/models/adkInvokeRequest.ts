import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestMetadataSchema } from "./core/operationMetadata";
import { RequestStatusEnum, RequestLogSchema } from "./core/requestStatus";
import { LlmModelSelectionSchema } from "./llmModelSelection";

export const AdkInvokeModeEnum = z.enum([
  "guide",
  "writing",
  "sheet",
  "image",
  "consultation",
  "research",
  "data_analysis",
  "web_page",
  "application_scan",
  "business_partner",
]);

export const AdkInvokeAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  gcsPath: z.string().regex(/^gs:\/\//),
  mimeType: z.string().default("application/octet-stream"),
  size: z.number().optional(),
});

export const AdkInvokeReferenceImageSchema = z.object({
  id: z.string(),
  source: z.enum(["knowledge", "clipboard", "upload"]),
  name: z.string(),
  mimeType: z.string().optional(),
  mime_type: z.string().optional(),
  gcsPath: z.string().optional(),
  gcs_path: z.string().optional(),
  url: z.string().nullable().optional(),
  knowledge_doc_id: z.string().nullable().optional(),
});

export const AdkInvokeHistoryTurnSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string(),
});

export const AdkInvokeInputSchema = z.object({
  mode: AdkInvokeModeEnum,
  sessionId: z.string(),
  organizationId: z.string().min(1),
  spaceId: z.string().min(1),
  userId: z.string().min(1),
  prompt: z.string(),
  responseId: z.string().min(1),
  model: LlmModelSelectionSchema.optional(),
  workspaceId: z.string().nullable().optional(),
  fileSpaceId: z.string().nullable().optional(),
  history: z.array(AdkInvokeHistoryTurnSchema).default([]),
  modeState: z.record(z.string(), z.unknown()).default({}),
  systemPrompt: z.string().nullable().optional(),
  attachments: z.array(AdkInvokeAttachmentSchema).default([]),
  selectedKnowledge: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        gcs_path: z.string(),
        mime_type: z.string().optional(),
      })
    )
    .default([]),
  referenceImages: z.array(AdkInvokeReferenceImageSchema).default([]),
  /**
   * RequestDoc トリガーが ADK へ転送する Firebase ID トークン（短命・サーバー専用）.
   * internal invoke シークレット未設定時の Bearer 認証用.
   */
  callerIdToken: z.string().min(1).optional(),
  /** 超大 payload 用 (webCrawl 型). 通常は未使用 */
  invokeInputArtifactUri: z.string().nullable().optional(),
  /** research 完了通知の送信先 (ログインメールと別指定可) */
  notificationEmail: z.string().email().optional(),
});

const BusinessPartnerAdkDraftSchema = z.object({
  comment: z.string().optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  sources: z
    .array(
      z.object({
        title: z.string().optional(),
        uri: z.string().optional(),
      })
    )
    .optional(),
});

export const AdkInvokeOutputSchema = z
  .object({
    responseTextLength: z.number().optional(),
    artifactCount: z.number().optional(),
    sourceReferenceCount: z.number().optional(),
    sessionId: z.string().optional(),
    emailNotificationSentAt: z.string().optional(),
    emailRequestId: z.string().optional(),
    resolvedModel: z.string().optional(),
    businessPartner: z
      .object({
        phase: z.string().optional(),
        draft: BusinessPartnerAdkDraftSchema.optional(),
        progress_logs: z.array(z.record(z.string(), z.unknown())).optional(),
      })
      .optional(),
  })
  .nullable()
  .optional();

export const AdkInvokeRequestSchema = z.object({
  input: AdkInvokeInputSchema,
  operationMetadata: RequestMetadataSchema,
  output: AdkInvokeOutputSchema,
  status: RequestStatusEnum.default("pending"),
  logs: z.array(RequestLogSchema).default([]),
  errorMessage: z.string().optional(),
  microServicePayload: z
    .object({
      name: z.any().nullable(),
      endpoint: z.any().nullable(),
      payload: z.any().nullable(),
    })
    .optional(),
});

export const DecodedAdkInvokeRequestSchema = AdkInvokeRequestSchema.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});

export type DecodedAdkInvokeRequest = z.infer<typeof DecodedAdkInvokeRequestSchema>;
export type AdkInvokeInput = z.infer<typeof AdkInvokeInputSchema>;

export const adkInvokeRequestConverter = firestoreTypeConverter(
  DecodedAdkInvokeRequestSchema
);

export const ADK_INVOKE_REQUEST_COLLECTION = "requests/adkInvokeRequests/logs";
