import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { Timestamp } from "firebase/firestore";

// スキーマを定義
export const answerUserGroupZodObject = z.object({
  name: z.string(),
  description: z.string(),
  imageUrl: z.string(),
  isDeleted: z.boolean(),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedAnswerUserGroupZodObject = answerUserGroupZodObject.extend({
  id: z.string(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});

// スキーマをもとに型を作成
export type decodedAnswerUserGroup = z.infer<
  typeof decodedAnswerUserGroupZodObject
>;

// スキーマをもとにコンバーターを作成
export const answerUserGroupConverter = firestoreTypeConverter(
  decodedAnswerUserGroupZodObject
);

/**
 * 回答ユーザーグループ > 回答ユーザーの型定義
 */
// 登録用にアップロードされたCSVファイル(ユーザー)の型定義 - 単一
export const registeredAnswerUserGroupUploadedUserRawDataItemZodObject =
  z.object({
    uniqueUserId: z.string().optional(),
    userId: z.string(),
    email: z.string(),
    freeText: z.string().optional(),
    answerStatus: z.union([z.literal("done"), z.literal("yet")]).optional(),
    mailSendStatus: z
      .union([z.literal("send"), z.literal("yet"), z.literal("failure")])
      .optional(),
  });
// 登録用にアップロードされたCSVファイル(ユーザー)の型定義 - リスト
export const registeredAnswerUserGroupUploadedUserRawDataZodObject = z.array(
  registeredAnswerUserGroupUploadedUserRawDataItemZodObject
);

// 登録用にアップロードされたCSVファイル(ユーザー)の型定義 - Decoded
export const decodedRegisteredAnswerUserUserZodObject =
  registeredAnswerUserGroupUploadedUserRawDataItemZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// 登録用にアップロードされたCSVファイル(ユーザー)の型定義 - Converter
export const registeredAnswerUserConverter = firestoreTypeConverter(
  decodedRegisteredAnswerUserUserZodObject
);
