import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { Timestamp } from "firebase/firestore";

// スキーマを定義
export const originalHtmlTemplateZodObject = z.object({
  name: z.string(),
  description: z.string(),
  templateType: z.union([z.literal("global"), z.literal("organization")]),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedOriginalHtmlTemplateZodObject =
  originalHtmlTemplateZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// スキーマをもとにコンバーターを作成
export const decodedOriginalHtmlTemplateConverter = firestoreTypeConverter(
  decodedOriginalHtmlTemplateZodObject
);
