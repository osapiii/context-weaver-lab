import { ref } from "vue";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
} from "firebase/firestore";
import type { _RefFirestore } from "vuefire";

import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase/firestore";
import log from "@utils/logger";
import { omitUndefinedValues } from "@utils/object";
import type { PartialWithFieldValue } from "firebase-admin/firestore";
import { ZodError, z } from "zod";

const docSchema = z.array(
  z
    .object({
      id: z.string().optional(),
    })
    .catchall(z.any())
);

function appendConvertedDocs<T>(params: {
  snapshot: QuerySnapshot<DocumentData>;
  converter: FirestoreDataConverter<T>;
  docList: T[];
  collectionName: string;
}): void {
  params.snapshot.forEach((docSnap) => {
    try {
      params.docList.push(
        params.converter.fromFirestore(
          docSnap as QueryDocumentSnapshot<T>
        )
      );
    } catch (err) {
      if (err instanceof ZodError) {
        log(
          "WARN",
          `Skipped invalid Firestore doc (${params.collectionName}/${docSnap.id})`,
          err.errors[0]?.path?.join(".") ?? err.message
        );
      } else {
        log(
          "WARN",
          `Skipped invalid Firestore doc (${params.collectionName}/${docSnap.id})`,
          err
        );
      }
    }
  });
}

export function useFirestoreDocOperation() {
  const error = ref(null);

  /**
   * コレクションから複数のドキュメントをクエリで取得する
   */

  async function getDocumentListByQuery<T>(params: {
    collectionName: string;
    targetField: string;
    operator: WhereFilterOp;
    targetValue: string;
    converter: FirestoreDataConverter<T>;
  }): Promise<T[] | []> {
    log("INFO", "getDocumentListByQuery triggered🔥", "params is....", params);
    error.value = null;
    const docList: T[] = []; // docListの型としてT[]を指定
    const db = useFirestore();
    const q = query(
      collection(db, params.collectionName).withConverter(params.converter),
      where(params.targetField, params.operator, params.targetValue)
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      docList.push(doc.data());
    });
    log("INFO", "getSingleDocumentById result📗 is...", docList);
    if (docList.length === 0) {
      return [];
    } else {
      return docList;
    }
  }

  /**
   * コレクション配下ドキュメントを全て取得する (スキーマがバラバラのためConverter無しver)
   */

  async function getAllDocumentListFromCollectionWithoutConverter(params: {
    collectionName: string;
  }): Promise<z.infer<typeof docSchema>> {
    log(
      "INFO",
      "getAllDocumentListFromCollectionWithoutConverter triggered🔥",
      "params is....",
      params
    );
    error.value = null;
    const docList: z.infer<typeof docSchema> = [];
    const db = useFirestore();
    const q = query(collection(db, params.collectionName));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      const docData = doc.data();
      docData.id = doc.id;
      docList.push(docData);
    });
    if (docList.length === 0) {
      return [];
    } else {
      return docList;
    }
  }

  /**
   * コレクション配下ドキュメントを全て取得する (スキーマ共通のためConverterありver)
   */
  async function getAllDocumentListFromCollectionWithConverter<T>(params: {
    collectionName: string;
    converter: FirestoreDataConverter<T>;
    limit?: number;
  }): Promise<T[]> {
    log(
      "INFO",
      "getAllDocumentListFromCollectionWithConverter triggered🔥",
      "params is....",
      params
    );
    try {
      error.value = null;
      const docList: T[] = [];
      const db = useFirestore();
      let q = query(collection(db, params.collectionName));
      if (params.limit !== undefined) {
        q = query(q, firestoreLimit(params.limit));
      }
      const querySnapshot = await getDocs(q);
      appendConvertedDocs({
        snapshot: querySnapshot,
        converter: params.converter,
        docList,
        collectionName: params.collectionName,
      });
      return docList;
    } catch (error) {
      if (error instanceof ZodError) {
        error.errors.forEach((err) => {
          log(
            "ERROR",
            "Zod validation error at getAllDocumentListFromCollectionWithConverter:",
            err
          );
        });
      } else {
        log("ERROR", "Unexpected error:", error);
      }
      throw new Error("Error Occurred");
    }
  }

  async function getDocumentsWithQueryAndConverter<T>(params: {
    collectionName: string;
    converter: FirestoreDataConverter<T>;
    limit?: number;
    whereClauses?: { field: string; operator: WhereFilterOp; value: any }[];
    orderBy?: { field: string; direction: "asc" | "desc" };
  }): Promise<T[]> {
    log("INFO", "getDocumentsWithQuery triggered🔥", "params is....", params);
    try {
      error.value = null;
      const docList: T[] = [];
      const db = useFirestore();
      let q = query(collection(db, params.collectionName));
      if (params.whereClauses) {
        for (const clause of params.whereClauses) {
          q = query(q, where(clause.field, clause.operator, clause.value));
        }
      }
      if (params.orderBy) {
        q = query(
          q,
          firestoreOrderBy(params.orderBy.field, params.orderBy.direction)
        );
      }
      if (params.limit !== undefined) {
        q = query(q, firestoreLimit(params.limit));
      }
      const querySnapshot = await getDocs(q);
      appendConvertedDocs({
        snapshot: querySnapshot,
        converter: params.converter,
        docList,
        collectionName: params.collectionName,
      });
      if (docList.length === 0) {
        log("INFO", "fetched documents not found!");
      } else {
        log("INFO", "fetched documents are...", docList);
      }
      return docList;
    } catch (error) {
      if (error instanceof ZodError) {
        error.errors.forEach((err) => {
          log("ERROR", "Zod validation error at getDocumentsWithQuery:", err);
        });
      } else {
        log("ERROR", "Unexpected error:", error);
      }
      throw new Error("Error Occurred");
    }
  }
  /**
   * ID指定でコレクションから単一のドキュメントを取得する
   */

  async function getSingleDocumentById<T>(params: {
    collectionName: string;
    docId: string;
    converter: FirestoreDataConverter<T>;
  }): Promise<T | null> {
    log("INFO", "getSingleDocumentById triggered🔥", "params is....", params);
    // 戻り値の型をPromise<T | null>に変更
    error.value = null;
    const db = useFirestore();
    const docRef = doc(db, params.collectionName, params.docId).withConverter(
      params.converter
    );
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      log("INFO", "getSingleDocumentById result📗 is...", docSnap.data());
      return docSnap.data();
    } else {
      log("INFO", "getSingleDocumentById result📗 is...", null);
      return null; // ドキュメントが存在しない場合はnullを返す
    }
  }

  /**
   * クエリでコレクションから単一のドキュメントを取得する
   */
  async function getSingleDocumentByQuery<
    T extends DocumentData,
    R extends DocumentData,
  >(params: {
    collectionName: string;
    targetField: string;
    operator: WhereFilterOp;
    targetValue: string;
    converter: FirestoreDataConverter<T, R>;
  }): Promise<T | null> {
    log("INFO", "getSingleDocumentById triggered🔥", "params is....", params);
    if (!params.targetField || !params.operator || !params.targetValue) {
      throw new Error(
        "Invalid parameters: targetField, operator, and targetValue must not be undefined"
      );
    }
    try {
      error.value = null;
      const db = useFirestore();
      const q = query(
        collection(db, "organizations").withConverter<T, R>(params.converter),
        where(params.targetField, params.operator, params.targetValue)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.size > 0) {
        for (const doc of querySnapshot.docs) {
          log("INFO", "getSignleDocumentByQuery result📗 is...", doc.data());
          return doc.data();
        }
      }
      log("INFO", "getSignleDocumentByQuery result📗 is...", null);
      return null;
    } catch (error) {
      if (error instanceof ZodError) {
        error.errors.forEach((err) => {
          log("ERROR", "Zod validation error:", err);
        });
      } else {
        log("ERROR", "Unexpected error:", error);
      }
      throw new Error("Error Occurred");
    }
  }

  /**
   * ドキュメントを新規作成する
   */
  async function createDocument<T>(params: {
    collectionName: string;
    docId: string;
    docData: PartialWithFieldValue<T>;
    converter: FirestoreDataConverter<T>;
    merge?: boolean; // 追加
  }): Promise<T | null> {
    log("INFO", "createDocument triggered🔥", "params is....", params);
    // デフォルト値の設定;
    const merge = params.merge === undefined ? false : params.merge;

    // 戻り値の型をPromise<T | null>に変更
    error.value = null;
    const db = useFirestore();
    const docRef = doc(db, params.collectionName, params.docId).withConverter(
      params.converter
    );

    try {
      await setDoc(docRef, params.docData, { merge: merge });
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        log("INFO", "createDocument result📗 is...", docSnap.data());
        return docSnap.data();
      } else {
        log("INFO", "createDocument result📗 is...", null);
        return null; // ドキュメントが存在しない場合はnullを返す
      }
    } catch (error) {
      if (error instanceof ZodError) {
        error.errors.forEach((err) => {
          log("ERROR", "Zod validation error:", err);
        });
      } else {
        log("ERROR", "Unexpected error:", error);
      }
      throw new Error("Error Occurred");
    }
  }

  // ドキュメントを更新する
  async function updateDocument<T>(params: {
    collectionName: string;
    docId: string;
    docData: DocumentData;
    converter: FirestoreDataConverter<T>;
  }): Promise<T | null> {
    log("INFO", "updateDocument triggered🔥", "params is....", params);
    error.value = null;
    const db = useFirestore();
    const docRef = doc(db, params.collectionName, params.docId).withConverter(
      params.converter
    );
    try {
      const firestorePayload = omitUndefinedValues(
        params.converter.toFirestore(params.docData as T) as Record<
          string,
          unknown
        >
      );
      await updateDoc(docRef, firestorePayload);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        log("INFO", "updateDocument result📗 is...", docSnap.data());
        return docSnap.data();
      } else {
        return null;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        error.errors.forEach((err) => {
          log("ERROR", "Zod validation error:", err);
        });
      } else {
        log("ERROR", "Unexpected error:", error);
      }
      throw new Error("Error Occurred");
    }
  }

  // ドキュメントを削除する
  async function deleteDocument(params: {
    collectionName: string;
    docId: string;
  }): Promise<boolean> {
    log("INFO", "deleteDocument triggered🔥", "params is....", params);
    error.value = null;
    const db = useFirestore();
    const docRef = doc(db, params.collectionName, params.docId);
    try {
      await deleteDoc(docRef);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 指定してcollectionを削除する
   */
  async function deleteCollection(params: { collectionName: string }) {
    log(
      "INFO",
      "deleteCollection triggered🔥",
      "collectionName is....",
      params.collectionName
    );
    try {
      const db = useFirestore();
      const querySnapshot = await getDocs(
        collection(db, params.collectionName)
      );
      querySnapshot.forEach((document) => {
        deleteDoc(doc(db, params.collectionName, document.id));
      });
      log("INFO", "deleteCollection completed📗");
    } catch (e) {
      log("ERROR", "deleteCollection error", e);
    }
  }

  async function getDocumentsWithQueryWithoutConverter(params: {
    collectionName: string;
    limit?: number;
    whereClauses?: { field: string; operator: WhereFilterOp; value: unknown }[];
    orderBy?: { field: string; direction: "asc" | "desc" };
  }): Promise<Array<Record<string, unknown> & { id: string }>> {
    log(
      "INFO",
      "getDocumentsWithQueryWithoutConverter triggered",
      params.collectionName
    );
    try {
      error.value = null;
      const docList: Array<Record<string, unknown> & { id: string }> = [];
      const db = useFirestore();
      let q = query(collection(db, params.collectionName));
      if (params.whereClauses) {
        for (const clause of params.whereClauses) {
          q = query(q, where(clause.field, clause.operator, clause.value));
        }
      }
      if (params.orderBy) {
        q = query(
          q,
          firestoreOrderBy(params.orderBy.field, params.orderBy.direction)
        );
      }
      if (params.limit !== undefined) {
        q = query(q, firestoreLimit(params.limit));
      }
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((snap) => {
        docList.push({ ...snap.data(), id: snap.id });
      });
      return docList;
    } catch (err) {
      log("ERROR", "getDocumentsWithQueryWithoutConverter error:", err);
      throw new Error("Error Occurred");
    }
  }

  return {
    error,
    getDocumentListByQuery,
    getSingleDocumentById,
    getSingleDocumentByQuery,
    getAllDocumentListFromCollectionWithoutConverter,
    getAllDocumentListFromCollectionWithConverter,
    getDocumentsWithQueryAndConverter,
    getDocumentsWithQueryWithoutConverter,
    createDocument,
    updateDocument,
    deleteDocument,
    deleteCollection,
  };
}
