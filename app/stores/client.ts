import { defineStore } from "pinia";
import type { z } from "zod";
import { ZodError } from "zod";
import {
  clientConverter,
  type decodedClientJsonZodObject,
} from "@models/client";
import log from "@utils/logger";

// *********STORE*********
export const useClientStore = defineStore("client", {
  state: () => ({
    clientList: [] as z.infer<typeof decodedClientJsonZodObject>[],
    selectedClient: {} as z.infer<typeof decodedClientJsonZodObject>,
  }),
  getters: {
    /**
     * Selectフォームで使用するフォーマットでClientListを返却する
     */
    clientListForSelectForm: (state) => {
      return state.clientList.map((client) => ({
        label: client.name,
        value: client.id,
      }));
    },
  },
  actions: {
    /**
     * 取引先IDから対象の取引先を取得する
     */
    getClientInfoById(params: { clientId: string }) {
      return this.clientList.find((client) => client.id === params.clientId);
    },
    /**
     * 取引先名から対象の取引先を取得する
     */
    getClientInfoByName(params: { clientName: string }) {
      return this.clientList.find(
        (client) => client.name === params.clientName
      );
    },
    /**
     * 選択中の取引先を更新する
     */
    async updateSelectedClientPiniaStore(params: {
      clientId: string;
    }): Promise<boolean> {
      const firestoreOps = useFirestoreDocOperation();
      const organization = useOrganizationStore();
      const globalError = useGlobalErrorStore();
      try {
        const clientDoc = await firestoreOps.getSingleDocumentById({
          collectionName: `organizations/${organization.loggedInOrganizationInfo.id}/clients`,
          docId: params.clientId,
          converter: clientConverter,
        });
        if (clientDoc) {
          this.selectedClient = clientDoc;
        } else {
          globalError.createNewGlobalError({
            selectedErrorMessage: globalError.errorCodeList.client.E4200,
          });
          return false;
        }
        return true;
      } catch (error) {
        if (error instanceof ZodError) {
          error.errors.forEach((err) => {
            log("ERROR", "Zod validation error:", err);
          });
        } else {
          log("ERROR", "Unexpected error:", error);
        }
        globalError.createNewGlobalError({
          selectedErrorMessage: globalError.errorCodeList.client.E4200,
        });
        return false;
      }
    },
    /**
     * 新しい取引先を作成する
     */
    async createNewClient(params: {
      clientId: string;
      settings: {
        name: string;
        imageUrl: string;
        address: string;
        phoneNumber: string;
        email: string;
        website: string;
        note: string;
      };
    }): Promise<boolean> {
      log("INFO", "createNewClient triggered! 新しい取引先を作成します🔥");
      const firestoreOps = useFirestoreDocOperation();
      const organization = useOrganizationStore();
      const globalError = useGlobalErrorStore();

      try {
        const parentPathCreator = useParentPathCreator();
        const collectionName = parentPathCreator.returnParentOrgSpaceFirestorePath('clients');
        await firestoreOps.createDocument({
          collectionName,
          docId: params.clientId,
          docData: {
            name: params.settings.name,
            imageUrl: params.settings.imageUrl,
            address: params.settings.address,
            phoneNumber: params.settings.phoneNumber,
            email: params.settings.email,
            website: params.settings.website,
            note: params.settings.note,
            setupStatus: "completed",
          },
          converter: clientConverter,
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
        globalError.createNewGlobalError({
          selectedErrorMessage: globalError.errorCodeList.client.E4200,
        });
        return false;
      }
    },

    /**
     * 取引先一覧を取得する
     */
    async fetchClients(params: { organizationId: string }) {
      log("INFO", "fetchClients triggered! 取引先一覧を取得します🔥");
      const firestoreOps = useFirestoreDocOperation();
      const globalError = useGlobalErrorStore();
      const parentPathCreator = useParentPathCreator();
      this.clientList = [];
      try {
        // zod parseする処理を記述
        const collectionName = parentPathCreator.returnParentOrgSpaceFirestorePath('clients');
        const clientDocs =
          await firestoreOps.getAllDocumentListFromCollectionWithConverter({
            collectionName,
            converter: clientConverter,
          });
        clientDocs.forEach((clientDoc) => {
          this.clientList.push(clientDoc);
        });
      } catch (error) {
        globalError.createNewGlobalError({
          selectedErrorMessage: globalError.errorCodeList.client.E4201,
        });
        if (error instanceof ZodError) {
          error.errors.forEach((err) => {
            log("ERROR", "Zod validation error:", err);
          });
        } else {
          log("ERROR", "Unexpected error:", error);
        }
      }
    },
  },
});
