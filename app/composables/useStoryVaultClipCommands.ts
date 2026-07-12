import { getAuth } from "firebase/auth";
import { Timestamp, doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";
import {
  STORYVAULT_CLIP_COMMAND_COLLECTION,
  type StoryVaultClipCommandOperation,
  type StoryVaultClipCommandRequest,
} from "@models/storyVaultClipCommandRequest";
import createRandomDocId from "@utils/createRandomDocId";

export function waitForStoryVaultClipCommand(path: string, timeoutMs = 1000 * 60 * 30): Promise<StoryVaultClipCommandRequest> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      stop();
      reject(new Error("クリップ解析処理がタイムアウトしました"));
    }, timeoutMs);
    const stop = onSnapshot(doc(getFirestore(), path), (snapshot) => {
      if (!snapshot.exists()) return;
      const request = { id: snapshot.id, ...snapshot.data() } as StoryVaultClipCommandRequest;
      if (request.status === "completed" || request.status === "partial_error") {
        window.clearTimeout(timeout);
        stop();
        resolve(request);
      } else if (request.status === "error") {
        window.clearTimeout(timeout);
        stop();
        reject(new Error(request.errorMessage || "クリップ解析処理に失敗しました"));
      }
    }, reject);
  });
}

export function useStoryVaultClipCommands() {
  async function create(params: {
    operation: StoryVaultClipCommandOperation;
    applicationId: string;
    clipGroupId?: string;
    clipIds?: string[];
    pipelineRequestId?: string;
    payload?: Record<string, unknown>;
  }): Promise<{ requestId: string; requestPath: string }> {
    const organizationId = useOrganizationStore().loggedInOrganizationInfo?.id ?? "";
    const spaceId = useSpaceStore().selectedSpace?.id ?? "";
    const user = getAuth().currentUser;
    if (!organizationId || !spaceId || !user) throw new Error("組織・スペース・ログイン状態を確認してください");
    const requestId = `storyvault_clip_${params.operation}_${createRandomDocId()}`;
    const collectionPath = `organizations/${organizationId}/spaces/${spaceId}/${STORYVAULT_CLIP_COMMAND_COLLECTION}`;
    const requestPath = `${collectionPath}/${requestId}`;
    await setDoc(doc(getFirestore(), requestPath), {
      id: requestId,
      input: params,
      output: null,
      status: "pending",
      logs: [],
      operationMetadata: {
        organizationId,
        spaceId,
        loggingCollectionId: collectionPath,
        loggingDocumentId: requestId,
        requestedBy: { userId: user.uid, email: user.email || "", role: "admin" },
        isCommand: true,
        isOouiCrud: true,
        isLlmCall: ["quickScan", "zappingAnalysis", "capabilityStructuring", "storyGeneration"].includes(params.operation),
        isAdminCrud: false,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { requestId, requestPath };
  }

  async function execute(params: Parameters<typeof create>[0]): Promise<StoryVaultClipCommandRequest> {
    const started = await create(params);
    return waitForStoryVaultClipCommand(started.requestPath);
  }

  return { create, execute, wait: waitForStoryVaultClipCommand };
}
