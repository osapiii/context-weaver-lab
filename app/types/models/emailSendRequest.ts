import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

export const emailSendRequestZodObject = z.object({
  mailAddressList: z.array(z.string()),
  userIdList: z.array(z.string()),
  reservedAt: z.string(),
  targetContentId: z.string(),
  senderEmail: z.string(),
  senderName: z.string(),
  organizationId: z.string(),
  mailTitle: z.string(),
  mailBody: z.string(),
  answerUserGroupId: z.string().optional(),
  resultPageUrl: z.string().optional(),
  html: z.string().optional(),
  status: z.union([
    z.literal("reserved"),
    z.literal("done"),
    z.literal("failed"),
  ]),
  from: z.union([
    z.literal("answerUserGroupDiagnosis"),
    z.literal("answerUserGroupSurvey"),
    z.literal("diagnosis"),
    z.literal("survey"),
  ]),
  sendResultList: z
    .array(
      z.object({
        userId: z.string(),
        mailAddress: z.string(),
        statusCode: z.number(),
        sendAt: z.string(),
      })
    )
    .optional(),
  type: z.union([z.literal("production"), z.literal("test")]),
});

// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedEmailSendRequestZodObject =
  emailSendRequestZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// スキーマをもとに型を作成
export type decodedEmailSendRequest = z.infer<
  typeof decodedEmailSendRequestZodObject
>;

// FirestoreのTypeConverterを作成
export const decodedEmailSendRequestConverter = firestoreTypeConverter(
  decodedEmailSendRequestZodObject
);

// 画面表示用のスキーマ
export const emailSendRequestForViewZodObject = z.object({
  id: z.string(),
  mailAddressListCount: z.number(),
  mailAddressList: z.array(z.string()),
  reservedAt: z.string(),
  targetContentId: z.string(),
  senderEmail: z.string(),
  senderName: z.string(),
  mailTitle: z.string(),
  answerUserGroupId: z.string().optional(),
  createdAt: z.instanceof(Timestamp),
  status: z.union([
    z.literal("reserved"),
    z.literal("done"),
    z.literal("failed"),
  ]),
  from: z.union([
    z.literal("answerUserGroupSurvey"),
    z.literal("answerUserGroupDiagnosis"),
    z.literal("diagnosis"),
    z.literal("survey"),
  ]),
});
