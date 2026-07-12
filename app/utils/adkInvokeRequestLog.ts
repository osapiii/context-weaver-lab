import { getAuth } from "firebase/auth";
import log from "@utils/logger";
import { useFirestoreDocOperation } from "@composables/firestore-doc-operation";
import { useContextStore } from "@stores/context";
import { useAdminUserStore } from "@stores/admin-user";
import { RequestMetadataSchema } from "@models/core/operationMetadata";
import {
  ADK_INVOKE_REQUEST_COLLECTION,
  adkInvokeRequestConverter,
} from "@models/adkInvokeRequest";
import type { AdkMode } from "@composables/useEnAiStudioAssistantContext";
import type { LlmModelSelection } from "@models/llmModelSelection";
import { defaultLlmModelSelectionForAdkMode } from "@models/llmModelSelection";
import createRandomDocId from "@utils/createRandomDocId";

export async function createAdkInvokeRequestLog(params: {
  mode: AdkMode;
  sessionId: string;
  prompt: string;
  organizationId: string;
  spaceId: string;
  workspaceId?: string | null;
  fileSpaceId?: string | null;
  model?: LlmModelSelection | null;
}): Promise<string | null> {
  try {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser?.email) return null;

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
      isCommand: false,
      isOouiCrud: false,
      isLlmCall: true,
      isAdminCrud: adminUserStore.isAdminOrAbove,
    });

    const created = await firestoreOps.createDocument({
      collectionName: contextStore.baseFirestorePath(ADK_INVOKE_REQUEST_COLLECTION),
      docId: requestId,
      docData: {
        input: {
          mode: params.mode,
          sessionId: params.sessionId,
          organizationId: params.organizationId,
          spaceId: params.spaceId,
          userId: currentUser.uid,
          prompt: params.prompt,
          responseId: `legacy_${requestId}`,
          model:
            params.model ?? defaultLlmModelSelectionForAdkMode(params.mode),
          workspaceId: params.workspaceId ?? null,
          fileSpaceId: params.fileSpaceId ?? null,
          history: [],
          modeState: {},
          attachments: [],
          selectedKnowledge: [],
          referenceImages: [],
        },
        operationMetadata,
        output: null,
        status: "processing" as const,
        logs: [],
      },
      converter: adkInvokeRequestConverter,
    });

    return created ? requestId : null;
  } catch (error) {
    log("WARN", "[adkInvokeRequestLog] create failed", error);
    return null;
  }
}

export async function finalizeAdkInvokeRequestLog(params: {
  requestId: string;
  status: "completed" | "error";
  errorMessage?: string;
  output?: {
    responseTextLength?: number;
    artifactCount?: number;
    sourceReferenceCount?: number;
    sessionId?: string;
    resolvedModel?: string;
  };
}): Promise<void> {
  try {
    const firestoreOps = useFirestoreDocOperation();
    const contextStore = useContextStore();
    const collectionName = contextStore.baseFirestorePath(
      ADK_INVOKE_REQUEST_COLLECTION
    );

    await firestoreOps.updateDocument({
      collectionName,
      docId: params.requestId,
      docData: {
        status: params.status,
        errorMessage: params.errorMessage,
        output: params.output ?? null,
      },
      converter: adkInvokeRequestConverter,
    });
  } catch (error) {
    log("WARN", "[adkInvokeRequestLog] finalize failed", error);
  }
}
