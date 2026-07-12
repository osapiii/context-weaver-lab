import { z } from "zod";

/**
 * RequestStatus Enum
 * 
 * RequestDocのステータス定義（全RequestDoc共通）
 */
export const RequestStatusEnum = z.enum([
  "pending",
  "processing",
  "completed",
  "error",
]);

export type RequestStatus = z.infer<typeof RequestStatusEnum>;

/**
 * RequestLog Schema
 * 
 * RequestDocのログ型定義（全RequestDoc共通）
 */
export const RequestLogSchema = z.object({
  timestamp: z.any(), // Firestore Timestamp
  message: z.string(),
  type: z.enum(["info", "warning", "error"]),
});

export type RequestLog = z.infer<typeof RequestLogSchema>;

