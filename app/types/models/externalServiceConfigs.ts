import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { Timestamp } from "firebase/firestore";

// スキーマを定義
export const slackIntegrationConfigZodObject = z.object({
  organizationId: z.string(),
  accessToken: z.string(),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedSlackIntegrationConfigZodObject =
  slackIntegrationConfigZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// スキーマをもとに型を作成
export type decodedSlackIntegrationConfig = z.infer<
  typeof decodedSlackIntegrationConfigZodObject
>;

// FirestoreのTypeConverterを作成
export const slackIntegrationConfigConverter = firestoreTypeConverter(
  decodedSlackIntegrationConfigZodObject
);
