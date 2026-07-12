import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { editorConfigZodObject } from "./vueEmailEditor";
import { content } from "#tailwind-config";

export const emailTemplateCreateRequestZodObject = z.object({
  organizationId: z.string(),
  name: z.string(),
  description: z.string(),
  configFrom: z.union([
    z.literal("diagnosis"),
    z.literal("survey"),
    z.literal("answerUserGroup"),
    z.literal("template"),
  ]),
  contentId: z.string(),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedEmailTemplateCreateRequestZodObject =
  emailTemplateCreateRequestZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// スキーマをもとに型を作成
export type decodedEmailTemplateCreateRequest = z.infer<
  typeof decodedEmailTemplateCreateRequestZodObject
>;

// FirestoreのTypeConverterを作成
export const emailTemplateCreateRequestConverter = firestoreTypeConverter(
  decodedEmailTemplateCreateRequestZodObject
);
