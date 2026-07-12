import log from "@utils/logger";
import { omitUndefinedValues, deepOmitUndefinedValues } from "@utils/object";
import {
  Timestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import type { z } from "zod";

const getTokyoTimestamp = () => {
  const now = new Date();
  const tokyoOffset = 9 * 60; // Tokyo is UTC+9
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const tokyoTime = new Date(utc + tokyoOffset * 60000);
  return Timestamp.fromDate(tokyoTime);
};

/** 新規作成は必須フィールド込み、部分更新は partial で通す */
const resolveFirestoreWriteSchema = <T extends z.AnyZodObject>(
  schema: T,
  payload: Record<string, unknown>
): z.ZodTypeAny => {
  const withoutIdSchema = schema.omit({ id: true });
  const fullResult = withoutIdSchema.safeParse(payload);
  if (fullResult.success) {
    return withoutIdSchema.strip();
  }
  return withoutIdSchema.partial().strip();
};

export const firestoreTypeConverter = <T extends z.AnyZodObject>(
  schema: T
): FirestoreDataConverter<z.infer<T>> => ({
  toFirestore: (data: Partial<z.infer<T>>): z.infer<T> => {
    log("INFO", "conveter toFirestore🤖", "input docData is....", data);
    let additionalData = {};

    if (!data.createdAt) {
      // 新規作成時はcreatedAtとupdatedAtに現在のタイムスタンプを設定
      additionalData = {
        createdAt: getTokyoTimestamp(),
        updatedAt: getTokyoTimestamp(),
      };
    } else {
      // 更新時はupdatedAtのみ現在のタイムスタンプを設定
      additionalData = {
        updatedAt: getTokyoTimestamp(),
      };
    }
    const dataRecord = omitUndefinedValues(data as Record<string, unknown>);
    // docId は ref 側で管理するため、書き込み payload から id を除外する
    const { id: _docId, ...dataWithoutId } = dataRecord;
    const mergedDoc = {
      ...dataWithoutId,
      ...additionalData,
    };
    const writeSchema = resolveFirestoreWriteSchema(schema, mergedDoc);
    const parsedDocData = writeSchema.parse(mergedDoc);
    return deepOmitUndefinedValues(parsedDocData) as z.infer<T>;
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot<z.infer<T>>): z.infer<T> => {
    const parsedDocData = snapshot.data();
    log(
      "INFO",
      "conveter fromFirestore🤖",
      "parsedDocData is....",
      parsedDocData
    );
    const dataWithId = { ...parsedDocData, id: snapshot.id };
    // strict()ではなくpassthrough()を使用して、未定義のキーも保持する
    // ただし、スキーマに定義されているフィールドは正しくバリデーションされる
    const validatedDocData = schema.passthrough().parse(dataWithId);
    return validatedDocData;
  },
});
