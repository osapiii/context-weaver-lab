import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { Timestamp } from "firebase/firestore";

// スキーマを定義
export const emailTemplateZodObject = z.object({
  name: z.string(),
  description: z.string(),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedEmailTemplateZodObject = emailTemplateZodObject.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});

// スキーマをもとにコンバーターを作成
export const decodedEmailTemplateConverter = firestoreTypeConverter(
  decodedEmailTemplateZodObject
);
