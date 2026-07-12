/**
 * ADK dialogue invoke — RequestDoc Command 作成と terminal 監視.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useFirestoreDocOperation } from "@composables/firestore-doc-operation";
import { useContextStore } from "@stores/context";
import { useAdminUserStore } from "@stores/admin-user";
import { RequestMetadataSchema } from "@models/core/operationMetadata";
import {
  ADK_INVOKE_REQUEST_COLLECTION,
  adkInvokeRequestConverter,
  type AdkInvokeOutput,
  type AdkInvokeInput,
} from "@models/adkInvokeRequest";
import type { RequestStatus } from "@models/core/requestStatus";
import createRandomDocId from "@utils/createRandomDocId";
import { getFirebaseIdToken } from "@utils/firebaseIdToken";
import log from "@utils/logger";

/** ADK invoke は常に RequestDoc 経由（レガシー直接 SSE 分岐は廃止） */
export const isAdkInvokeViaRequestDocEnabled = (): boolean => true;

export async function createAdkInvokeRequest(params: {
  input: AdkInvokeInput;
  organizationId: string;
  spaceId: string;
}): Promise<string> {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser?.email) {
    throw new Error("ログイン状態ではありません");
  }

  const adminUserStore = useAdminUserStore();
  const firestoreOps = useFirestoreDocOperation();
  const contextStore = useContextStore();

  const requestId = `adkInvoke_${Date.now()}_${createRandomDocId()}`;
  const operationMetadata = RequestMetadataSchema.parse({
    organizationId: params.organizationId,
    spaceId: params.spaceId,
    loggingCollectionId: ADK_INVOKE_REQUEST_COLLECTION,
    loggingDocumentId: requestId,
    requestedBy: {
      userId: currentUser.uid,
      email: currentUser.email,
      role: adminUserStore.rbacRole || 3,
    },
    isCommand: true,
    isOouiCrud: false,
    isLlmCall: true,
    isAdminCrud: adminUserStore.isAdminOrAbove,
  });

  const callerIdToken = await getFirebaseIdToken();
  const input =
    callerIdToken != null
      ? { ...params.input, callerIdToken }
      : params.input;

  const created = await firestoreOps.createDocument({
    collectionName: contextStore.baseFirestorePath(ADK_INVOKE_REQUEST_COLLECTION),
    docId: requestId,
    docData: {
      input,
      operationMetadata,
      output: null,
      status: "pending" as const,
      logs: [],
    },
    converter: adkInvokeRequestConverter,
  });

  if (!created) {
    throw new Error("ADK invoke RequestDoc の作成に失敗しました");
  }

  log("INFO", "[useAdkInvokeRequest] created", { requestId, mode: params.input.mode });
  return requestId;
}

export { waitForTaskInvokeTerminal } from "@utils/taskInvokeIO";

export const watchAdkInvokeRequest = (params: {
  organizationId: string;
  spaceId: string;
  requestId: string;
  onUpdate: (
    status: RequestStatus,
    errorMessage?: string,
    output?: AdkInvokeOutput
  ) => void;
}): (() => void) => {
  const contextStore = useContextStore();
  const path = contextStore.baseFirestorePath(ADK_INVOKE_REQUEST_COLLECTION);
  const db = useFirestore();
  const ref = doc(db, path, params.requestId);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const status = (data?.status as RequestStatus) ?? "pending";
      const errorMessage =
        typeof data?.errorMessage === "string" ? data.errorMessage : undefined;
      params.onUpdate(status, errorMessage, data?.output as AdkInvokeOutput);
    },
    (error) => {
      log("ERROR", "[useAdkInvokeRequest] watch failed", error);
      params.onUpdate("error", String(error));
    }
  );
};
