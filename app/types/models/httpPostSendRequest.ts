import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

export const httpPostSendRequestZodObject = z.object({
  requestUrl: z.string(),
  requestHeader: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ),
  organizationId: z.string(),
  contentId: z.string(),
  mode: z.union([z.literal("production"), z.literal("test")]),
  status: z.union([
    z.literal("reserved"),
    z.literal("success"),
    z.literal("failed"),
  ]),
  requestBody: z.any(),
  response: z
    .object({
      statusCode: z.number(),
      body: z.string(),
    })
    .optional(),
  from: z.union([z.literal("diagnosis"), z.literal("survey")]),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedHttpPostSendRequestZodObject =
  httpPostSendRequestZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// スキーマをもとに型を作成
export type decodedHttpPostSendRequest = z.infer<
  typeof decodedHttpPostSendRequestZodObject
>;

// FirestoreのTypeConverterを作成
export const decodedHttpPostSendRequestConverter = firestoreTypeConverter(
  decodedHttpPostSendRequestZodObject
);
