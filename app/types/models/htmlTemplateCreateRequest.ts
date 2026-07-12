import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

export const htmlTemplateCreateRequestZodObject = z.object({
  organizationId: z.string(),
  name: z.string(),
  description: z.string(),
  configFrom: z.union([
    z.literal("resultRecommend"),
    z.literal("resultArticle"),
  ]),
  contentId: z.string(),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedHtmlTemplateCreateRequestZodObject =
  htmlTemplateCreateRequestZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// スキーマをもとに型を作成
export type decodedHtmlTemplateCreateRequest = z.infer<
  typeof decodedHtmlTemplateCreateRequestZodObject
>;

// FirestoreのTypeConverterを作成
export const htmlTemplateCreateRequestConverter = firestoreTypeConverter(
  decodedHtmlTemplateCreateRequestZodObject
);
