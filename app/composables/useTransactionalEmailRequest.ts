/**
 * Transactional email — RequestDoc 作成ヘルパー.
 */
import { getAuth } from "firebase/auth";
import { useFirestoreDocOperation } from "@composables/firestore-doc-operation";
import { useContextStore } from "@stores/context";
import { useAdminUserStore } from "@stores/admin-user";
import { RequestMetadataSchema } from "@models/core/operationMetadata";
import {
  TRANSACTIONAL_EMAIL_REQUEST_COLLECTION,
  transactionalEmailRequestConverter,
  type TransactionalEmailInput,
} from "@models/transactionalEmailRequest";
import createRandomDocId from "@utils/createRandomDocId";
import log from "@utils/logger";

export async function createTransactionalEmailRequest(params: {
  input: TransactionalEmailInput;
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

  const requestId = `txnEmail_${Date.now()}_${createRandomDocId()}`;
  const operationMetadata = RequestMetadataSchema.parse({
    organizationId: params.organizationId,
    spaceId: params.spaceId,
    loggingCollectionId: TRANSACTIONAL_EMAIL_REQUEST_COLLECTION,
    loggingDocumentId: requestId,
    requestedBy: {
      userId: currentUser.uid,
      email: currentUser.email,
      role: adminUserStore.rbacRole || 3,
    },
    isCommand: true,
    isOouiCrud: false,
    isLlmCall: false,
    isAdminCrud: adminUserStore.isAdminOrAbove,
  });

  const created = await firestoreOps.createDocument({
    collectionName: contextStore.baseFirestorePath(
      TRANSACTIONAL_EMAIL_REQUEST_COLLECTION
    ),
    docId: requestId,
    docData: {
      input: params.input,
      operationMetadata,
      output: null,
      status: "pending" as const,
      logs: [],
    },
    converter: transactionalEmailRequestConverter,
  });

  if (!created) {
    throw new Error("メール送信 RequestDoc の作成に失敗しました");
  }

  log("INFO", "[useTransactionalEmailRequest] created", { requestId });
  return requestId;
}
