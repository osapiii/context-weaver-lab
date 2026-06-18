import { defineStore } from "pinia";
import log from "@utils/logger";
import { getAuth } from "firebase/auth";
import type { z} from "zod";
import { ZodError } from "zod";
import {
  googleSheetDataFetchRequestConverter,
  googleSheetValidateRequestConverter,
} from "@models/googleSheet";
import type {
  decodedGoogleSheetValidateRequest,
  decodedGoogleSheetValidateRequestZodObject,
  GoogleSheetDataFetchInputSchema,
  GoogleSheetValidateInputSchema,
} from "@models/googleSheet";
import { RequestMetadataSchema } from "@models/core/operationMetadata";
import { useContextStore } from "./context";
import { useAdminUserStore } from "./admin-user";
import { useSpaceStore } from "./space";
import { useOrganizationStore } from "./organization";

export const useGoogleSheetStore = defineStore("googleSheetStore", {
  state: () => ({
    currentGoogleSheetValidateRequest: {} as z.infer<
      typeof decodedGoogleSheetValidateRequestZodObject
    >,
  }),
  actions: {
    /**
     * Googleシートの検証リクエスト結果を取得する
     * @param params.input シミュレーション入力データ
     */
    async fetchGoogleSheetContentValidationRequest(params: {
      requestId: string;
    }): Promise<decodedGoogleSheetValidateRequest> {
      const contextStore = useContextStore();
      const firestoreDocOperationStore = useFirestoreDocOperation();
      const requestDoc = await firestoreDocOperationStore.getSingleDocumentById(
        {
          collectionName: contextStore.baseFirestorePath(
            "requests/googleSheetValidateRequests/logs"
          ),
          docId: params.requestId,
          converter: googleSheetValidateRequestConverter,
        }
      );
      if (!requestDoc) {
        throw new Error("Document not found");
      }
      return requestDoc;
    },
    /**
     * Googleシートのデータ取得リクエストをFirestoreに発行する
     * @param params.input Inputパラメータ（connectedGSheetId）
     * @param params.requestId RequestDoc ID
     */
    async createGoogleSheetDataFetchRequest(params: {
      input: z.infer<typeof GoogleSheetDataFetchInputSchema>;
      requestId: string;
    }): Promise<boolean> {
      try {
        const contextStore = useContextStore();
        const organizationStore = useOrganizationStore();
        const spaceStore = useSpaceStore();
        const adminUserStore = useAdminUserStore();
        const firestoreDocOperationStore = useFirestoreDocOperation();
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
          log("ERROR", "User not authenticated");
          return false;
        }

        // operationMetadataを構築
        const operationMetadata = RequestMetadataSchema.parse({
          organizationId: organizationStore.loggedInOrganizationInfo?.id || "",
          spaceId: spaceStore.selectedSpace?.id || "",
          loggingCollectionId: "requests/googleSheetDataFetchRequests/logs",
          loggingDocumentId: params.requestId,
          requestedBy: {
            userId: currentUser.uid,
            email: currentUser.email || "",
            role: adminUserStore.rbacRole || 3, // デフォルトは3（利用者）
          },
          isCommand: true,
          isOouiCrud: true,
          isLlmCall: false,
          isAdminCrud: adminUserStore.isAdminOrAbove,
        });

        // RequestDocデータを構築
        const requestData = {
          input: params.input,
          operationMetadata,
          output: null,
          status: "pending" as const,
          logs: [],
        };

        // RequestDocの生成
        await firestoreDocOperationStore.createDocument({
          collectionName: contextStore.baseFirestorePath(
            "requests/googleSheetDataFetchRequests/logs"
          ),
          docId: params.requestId,
          docData: requestData,
          converter: googleSheetDataFetchRequestConverter,
        });

        return true;
      } catch (error) {
        if (error instanceof ZodError) {
          error.errors.forEach((err) => {
            log("ERROR", "Zod validation error:", err);
          });
        } else {
          log("ERROR", "Unexpected error:", error);
        }
        return false;
      }
    },
    /**
     * Googleシートの検証リクエストをFirestoreに発行する
     * @param params.input Inputパラメータ（connectedGSheetId）
     * @param params.requestId RequestDoc ID
     */
    async createGoogleSheetContentValidationRequest(params: {
      input: z.infer<typeof GoogleSheetValidateInputSchema>;
      requestId: string;
    }): Promise<boolean> {
      try {
        const contextStore = useContextStore();
        const organizationStore = useOrganizationStore();
        const spaceStore = useSpaceStore();
        const adminUserStore = useAdminUserStore();
        const firestoreDocOperationStore = useFirestoreDocOperation();
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
          log("ERROR", "User not authenticated");
          return false;
        }

        // operationMetadataを構築
        const operationMetadata = RequestMetadataSchema.parse({
          organizationId: organizationStore.loggedInOrganizationInfo?.id || "",
          spaceId: spaceStore.selectedSpace?.id || "",
          loggingCollectionId: "requests/googleSheetValidateRequests/logs",
          loggingDocumentId: params.requestId,
          requestedBy: {
            userId: currentUser.uid,
            email: currentUser.email || "",
            role: adminUserStore.rbacRole || 3, // デフォルトは3（利用者）
          },
          isCommand: true,
          isOouiCrud: true,
          isLlmCall: false,
          isAdminCrud: adminUserStore.isAdminOrAbove,
        });

        // RequestDocデータを構築
        const requestData = {
          input: params.input,
          operationMetadata,
          output: null,
          status: "pending" as const,
          logs: [],
        };

        // RequestDocの生成
        await firestoreDocOperationStore.createDocument({
          collectionName: contextStore.baseFirestorePath(
            "requests/googleSheetValidateRequests/logs"
          ),
          docId: params.requestId,
          docData: requestData,
          converter: googleSheetValidateRequestConverter,
        });
        return true;
      } catch (error) {
        if (error instanceof ZodError) {
          error.errors.forEach((err) => {
            log("ERROR", "Zod validation error:", err);
          });
        } else {
          log("ERROR", "Unexpected error:", error);
        }
        return false;
      }
    },
  },
});
