import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { Timestamp } from "firebase/firestore";

// SurveyJS JSONのスキーマ定義
export const clientJsonZodObject = z.object({
  name: z.string(),
  imageUrl: z.string(),
  setupStatus: z.union([z.literal("completed"), z.literal("failed")]),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  note: z.string().optional(),
});
// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedClientJsonZodObject = clientJsonZodObject.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});

// スキーマをもとに型を作成
export type decodedClientJson = z.infer<typeof decodedClientJsonZodObject>;

// FirestoreのTypeConverterを作成
export const clientConverter = firestoreTypeConverter(
  decodedClientJsonZodObject
);
