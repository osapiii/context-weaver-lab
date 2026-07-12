import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

export const senderEmailAddressZodObject = z.object({
  mailAddress: z.string(),
  type: z.union([z.literal("default"), z.literal("custom")]),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedSenderEmailAddressZodObject =
  senderEmailAddressZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// スキーマをもとに型を作成
export type decodedSenderEmailAddress = z.infer<
  typeof decodedSenderEmailAddressZodObject
>;

// FirestoreのTypeConverterを作成
export const senderEmailAddressConverter = firestoreTypeConverter(
  decodedSenderEmailAddressZodObject
);
