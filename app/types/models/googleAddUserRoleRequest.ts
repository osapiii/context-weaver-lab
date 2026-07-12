import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

export const googleAddUserRoleRequestZodObject = z.object({
  organizationId: z.string(),
  organizationCode: z.string(),
  operationType: z.union([z.literal("add"), z.literal("remove")]),
  status: z.union([
    z.literal("pending"),
    z.literal("success"),
    z.literal("failed"),
  ]),
  mailAddress: z.string(),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedGoogleAddUserRoleRequestZodObject =
  googleAddUserRoleRequestZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// スキーマをもとに型を作成
export type decodedGoogleAddUserRoleRequest = z.infer<
  typeof decodedGoogleAddUserRoleRequestZodObject
>;

// FirestoreのTypeConverterを作成
export const googleAddUserRoleRequestConverter = firestoreTypeConverter(
  decodedGoogleAddUserRoleRequestZodObject
);
