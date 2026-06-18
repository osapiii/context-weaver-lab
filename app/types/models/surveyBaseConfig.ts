import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";
import { Timestamp } from "firebase/firestore";

// スキーマを定義
export const surveyBaseConfigZodObject = z.object({
  // 回答画面上部の背景設定
  general: z.object({
    title: z.string(),
  }),
  ogp: z.object({
    title: z.string(),
    description: z.string(),
    imageUrl: z.string(),
  }),
  logo: z.object({
    imageUrl: z.string(),
  }),
  gtm: z.object({
    containerId: z.string(),
  }),
  favicon: z.object({
    imageUrl: z.string(),
  }),
});
// id, createdAt, updatedAtの3つのフィールドを追加した新しいスキーマを定義
export const decodedSurveyBaseConfigZodObject =
  surveyBaseConfigZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
  });

// decoded前のConfigスキーマの型 => Storeで使用する
export type surveyBaseConfig = z.infer<typeof surveyBaseConfigZodObject>;

// スキーマをもとにコンバーターを作成
export const surveyBaseConfigConverter = firestoreTypeConverter(
  decodedSurveyBaseConfigZodObject
);
