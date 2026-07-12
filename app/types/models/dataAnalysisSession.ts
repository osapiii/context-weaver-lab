import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

/**
 * Chart shape returned by the Conversational Analytics API and persisted on
 * each assistant message. ``spec`` is a Vega-Lite spec; the frontend converts
 * it to an echarts option at render time.
 */
export const DataAnalysisChartSchema = z.object({
  title: z.string(),
  spec: z.any(),
});
export type DataAnalysisChart = z.infer<typeof DataAnalysisChartSchema>;

/** Single chat message inside a session. Persisted at
 * ``organizations/{orgId}/dataAnalysisSessions/{sessionId}/messages/{messageId}``.
 */
export const DataAnalysisMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().optional(),
  markdown: z.string().optional(),
  charts: z.array(DataAnalysisChartSchema).optional(),
  sql: z.array(z.string()).optional(),
  error: z.string().optional(),
  rawMessages: z.array(z.any()).optional(),
  createdAt: z.instanceof(Timestamp),
});
export type DataAnalysisMessage = z.infer<typeof DataAnalysisMessageSchema>;

export const DecodedDataAnalysisMessageSchema = DataAnalysisMessageSchema.extend(
  {
    id: z.string(),
  }
);
export type DecodedDataAnalysisMessage = z.infer<
  typeof DecodedDataAnalysisMessageSchema
>;

export const dataAnalysisMessageConverter = firestoreTypeConverter(
  DecodedDataAnalysisMessageSchema
);

/** Session metadata. Persisted at
 * ``organizations/{orgId}/dataAnalysisSessions/{sessionId}``.
 */
export const DataAnalysisSessionSchema = z.object({
  organizationId: z.string(),
  spaceId: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  title: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
  messageCount: z.number().default(0),
});
export type DataAnalysisSession = z.infer<typeof DataAnalysisSessionSchema>;

export const DecodedDataAnalysisSessionSchema =
  DataAnalysisSessionSchema.extend({
    id: z.string(),
  });
export type DecodedDataAnalysisSession = z.infer<
  typeof DecodedDataAnalysisSessionSchema
>;

export const dataAnalysisSessionConverter = firestoreTypeConverter(
  DecodedDataAnalysisSessionSchema
);
