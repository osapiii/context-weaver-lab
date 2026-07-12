import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

export const googleUserZodObject = z.object({
  mailAddress: z.string(),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedGoogleUserZodObject = googleUserZodObject.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});

// スキーマをもとに型を作成
export type decodedGoogleUser = z.infer<typeof decodedGoogleUserZodObject>;

// FirestoreのTypeConverterを作成
export const googleUserConverter = firestoreTypeConverter(
  decodedGoogleUserZodObject
);
