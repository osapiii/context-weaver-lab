import { defineStore } from "pinia";
import type { z } from "zod";
import { ZodError } from "zod";
import {
  businessPartnerConverter,
  type BusinessPartnerLookupSource,
  type BusinessPartnerType,
  type decodedBusinessPartnerZodObject,
} from "@models/businessPartner";
import {
  materialPurchaseRecordConverter,
  type decodedMaterialPurchaseRecordZodObject,
} from "@models/materialPurchaseRecord";
import log from "@utils/logger";

type DecodedBusinessPartner = z.infer<typeof decodedBusinessPartnerZodObject>;
type DecodedMaterialPurchaseRecord = z.infer<
  typeof decodedMaterialPurchaseRecordZodObject
>;

const PARTNERS_PATH = "businessPartners";

export const useBusinessPartnerStore = defineStore("businessPartner", {
  state: () => ({
    partnerList: [] as DecodedBusinessPartner[],
    selectedPartner: null as DecodedBusinessPartner | null,
    purchaseRecordList: [] as DecodedMaterialPurchaseRecord[],
  }),
  getters: {
    /**
     * 種別ごとの取引先一覧
     */
    supplierList(state): DecodedBusinessPartner[] {
      return state.partnerList.filter(
        (partner) => partner.type === "supplier"
      );
    },
    customerList(state): DecodedBusinessPartner[] {
      return state.partnerList.filter(
        (partner) => partner.type === "customer"
      );
    },
  },
  actions: {
    /**
     * 取引先一覧を取得する
     */
    async fetchPartners(): Promise<boolean> {
      log("INFO", "fetchPartners triggered! 取引先一覧を取得します🔥");
      const firestoreOps = useFirestoreDocOperation();
      const parentPathCreator = useParentPathCreator();
      const globalError = useGlobalErrorStore();
      this.partnerList = [];
      try {
        const collectionName =
          parentPathCreator.returnParentOrgSpaceFirestorePath(PARTNERS_PATH);
        const partnerDocs =
          await firestoreOps.getAllDocumentListFromCollectionWithConverter({
            collectionName,
            converter: businessPartnerConverter,
          });
        partnerDocs.forEach((partnerDoc) => {
          this.partnerList.push(partnerDoc);
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
          selectedErrorMessage:
            globalError.errorCodeList.businessPartner.E4301,
        });
        return false;
      }
    },

    /**
     * 指定 ID の取引先を取得し、selectedPartner にセットする
     */
    async fetchPartnerById(params: { partnerId: string }): Promise<boolean> {
      const firestoreOps = useFirestoreDocOperation();
      const parentPathCreator = useParentPathCreator();
      const globalError = useGlobalErrorStore();
      try {
        const collectionName =
          parentPathCreator.returnParentOrgSpaceFirestorePath(PARTNERS_PATH);
        const partnerDoc = await firestoreOps.getSingleDocumentById({
          collectionName,
          docId: params.partnerId,
          converter: businessPartnerConverter,
        });
        if (!partnerDoc) {
          globalError.createNewGlobalError({
            selectedErrorMessage:
              globalError.errorCodeList.businessPartner.E4302,
          });
          this.selectedPartner = null;
          return false;
        }
        this.selectedPartner = partnerDoc;
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
          selectedErrorMessage:
            globalError.errorCodeList.businessPartner.E4302,
        });
        return false;
      }
    },

    /**
     * 新しい取引先を作成する
     */
    async createNewPartner(params: {
      partnerId: string;
      settings: {
        code: string;
        name: string;
        type: BusinessPartnerType;
        imageUrl?: string;
        logoUrl?: string;
        faviconUrl?: string;
        address?: string;
        phoneNumber?: string;
        email?: string;
        website?: string;
        contactPerson?: string;
        note?: string;
        // 自動取得で埋まる法人プロファイル
        corporateNumber?: string;
        tradeName?: string;
        tradeNameKana?: string;
        postalCode?: string;
        prefecture?: string;
        city?: string;
        streetAddress?: string;
        capitalStock?: string;
        representativeName?: string;
        representativeTitle?: string;
        foundedDate?: string;
        industry?: string;
        employeeCount?: string;
        businessSummary?: string;
        lookupSource?: BusinessPartnerLookupSource;
        lookupAt?: string;
      };
    }): Promise<boolean> {
      log("INFO", "createNewPartner triggered! 新しい取引先を作成します🔥");
      const firestoreOps = useFirestoreDocOperation();
      const parentPathCreator = useParentPathCreator();
      const globalError = useGlobalErrorStore();

      try {
        const collectionName =
          parentPathCreator.returnParentOrgSpaceFirestorePath(PARTNERS_PATH);
        const { code, name, type, ...optional } = params.settings;
        const docData: Record<string, unknown> = { code, name, type };
        for (const [key, value] of Object.entries(optional)) {
          if (value !== undefined) {
            docData[key] = value;
          }
        }
        await firestoreOps.createDocument({
          collectionName,
          docId: params.partnerId,
          docData,
          converter: businessPartnerConverter,
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
          selectedErrorMessage:
            globalError.errorCodeList.businessPartner.E4300,
        });
        return false;
      }
    },

    /**
     * 取引先 (仕入先) に紐づく取引実績の一覧を取得する
     */
    async fetchPurchaseRecords(params: {
      partnerId: string;
    }): Promise<boolean> {
      const firestoreOps = useFirestoreDocOperation();
      const parentPathCreator = useParentPathCreator();
      const globalError = useGlobalErrorStore();
      this.purchaseRecordList = [];
      try {
        const collectionName = parentPathCreator.returnParentOrgSpaceFirestorePath(
          `${PARTNERS_PATH}/${params.partnerId}/purchaseRecords`
        );
        const recordDocs =
          await firestoreOps.getAllDocumentListFromCollectionWithConverter({
            collectionName,
            converter: materialPurchaseRecordConverter,
          });
        recordDocs.forEach((recordDoc) => {
          this.purchaseRecordList.push(recordDoc);
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
          selectedErrorMessage:
            globalError.errorCodeList.businessPartner.E4303,
        });
        return false;
      }
    },

    /**
     * 取引先を削除する (紐づく取引実績サブコレクションも削除)
     */
    async deletePartner(params: { partnerId: string }): Promise<boolean> {
      log("INFO", "deletePartner triggered! 取引先を削除します🔥", params);
      const firestoreOps = useFirestoreDocOperation();
      const parentPathCreator = useParentPathCreator();
      const globalError = useGlobalErrorStore();

      try {
        const partnersCollection =
          parentPathCreator.returnParentOrgSpaceFirestorePath(PARTNERS_PATH);
        const purchaseRecordsCollection =
          parentPathCreator.returnParentOrgSpaceFirestorePath(
            `${PARTNERS_PATH}/${params.partnerId}/purchaseRecords`
          );

        await firestoreOps.deleteCollection({
          collectionName: purchaseRecordsCollection,
        });

        const deleted = await firestoreOps.deleteDocument({
          collectionName: partnersCollection,
          docId: params.partnerId,
        });

        if (!deleted) {
          globalError.createNewGlobalError({
            selectedErrorMessage:
              globalError.errorCodeList.businessPartner.E4304,
          });
          return false;
        }

        this.partnerList = this.partnerList.filter(
          (partner) => partner.id !== params.partnerId
        );
        if (this.selectedPartner?.id === params.partnerId) {
          this.selectedPartner = null;
        }
        this.purchaseRecordList = [];

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
          selectedErrorMessage:
            globalError.errorCodeList.businessPartner.E4304,
        });
        return false;
      }
    },
  },
});
