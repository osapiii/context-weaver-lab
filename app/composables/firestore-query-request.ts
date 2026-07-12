import type { FirestoreQueryRequest } from "@models/firestoreQueryRequest";
import { firestoreQueryRequestConverter } from "@models/firestoreQueryRequest";
import createRandomId from "@utils/createRandomDocId";
import log from "@utils/logger";
import { collection, doc } from "firebase/firestore";

export const useFirestoreQueryRequest = () => {
  const firestoreOps = useFirestoreDocOperation();

  // ***********************
  // * 汎用FirestoreQueryRequestの作成メソッド
  // ***********************
  const createQueryRequest = async (params: {
    collectionName: string;
    requestParams: {
      [key: string]: string | number;
    };
  }) => {
    log("INFO", "createQueryRequest is called❤️‍🔥");
    const db = useFirestore();
    const requestDocId = createRandomId();
    const newlyQueryRequest: Partial<FirestoreQueryRequest> = {
      requestParams: params.requestParams,
      status: "pending",
    };
    // Request Queryの作成
    await firestoreOps.createDocument({
      collectionName: params.collectionName,
      docId: requestDocId,
      docData: newlyQueryRequest,
      converter: firestoreQueryRequestConverter,
    });
    // DocのRefオブジェクトを返却
    const subscribedDoc = useDocument(
      doc(collection(db, params.collectionName), requestDocId)
    );
    log(
      "INFO",
      "subscribedDoc for subscribed at vueFireDoc is....",
      subscribedDoc
    );
    return subscribedDoc;
  };
  return { createQueryRequest };
};
