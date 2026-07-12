import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { RequestMetadataSchema } from "./core/operationMetadata";
import { RequestStatusEnum, RequestLogSchema } from "./core/requestStatus";

export const TransactionalEmailTemplateEnum = z.enum([
  "research_completed",
  "generic",
]);

export const TransactionalEmailContextSchema = z.object({
  sessionId: z.string().optional(),
  theme: z.string().optional(),
  reportUrl: z.string().optional(),
});

export const TransactionalEmailInputSchema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
  template: TransactionalEmailTemplateEnum.default("generic"),
  context: TransactionalEmailContextSchema.default({}),
  replyTo: z.string().email().optional(),
});

export const TransactionalEmailOutputSchema = z
  .object({
    provider: z.string().optional(),
    statusCode: z.number().optional(),
    recipientCount: z.number().optional(),
  })
  .nullable()
  .optional();

export const TransactionalEmailRequestSchema = z.object({
  input: TransactionalEmailInputSchema,
  operationMetadata: RequestMetadataSchema,
  output: TransactionalEmailOutputSchema,
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

export const DecodedTransactionalEmailRequestSchema =
  TransactionalEmailRequestSchema.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

export type DecodedTransactionalEmailRequest = z.infer<
  typeof DecodedTransactionalEmailRequestSchema
>;
export type TransactionalEmailInput = z.infer<
  typeof TransactionalEmailInputSchema
>;

export const TRANSACTIONAL_EMAIL_REQUEST_COLLECTION =
  "requests/transactionalEmailRequests/logs";

export const transactionalEmailRequestConverter = firestoreTypeConverter(
  DecodedTransactionalEmailRequestSchema
);
