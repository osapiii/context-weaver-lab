import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { Timestamp } from "firebase/firestore";

// スキーマを定義
export const diagnosisWelcomePageConfigSchema = z.object({
  background: z.object({
    color: z.string(),
  }),
  button: z.object({
    body: z.string(),
  }),
  heading: z.object({
    color: z.string(),
    body: z.string(),
    description: z.string(),
  }),
  term: z.object({
    body: z.string(),
  }),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedDiagnosisWelcomePageConfigSchema =
  diagnosisWelcomePageConfigSchema.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// decoded前のConfigスキーマの型 => Storeで使用する
export type diagnosisWelcomePageConfig = z.infer<
  typeof diagnosisWelcomePageConfigSchema
>;

// スキーマをもとにコンバーターを作成
export const diagnosisWelcomePageConfigConverter = firestoreTypeConverter(
  decodedDiagnosisWelcomePageConfigSchema
);
