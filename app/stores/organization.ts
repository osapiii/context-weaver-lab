import { Timestamp } from "firebase/firestore";
import { defineStore } from "pinia";
import log from "@utils/logger";
import {
  organizationConverter,
  type decodedOrganizationSchema,
  type OrganizationBranding,
} from "@models/Organization";
import type { RouteLocationNormalizedGeneric } from "vue-router";

// *********STORE*********
export const useOrganizationStore = defineStore("organization", {
  state: () => ({
    loggedInOrganizationInfo: {} as decodedOrganizationSchema,
  }),
  getters: {
    getLoggedInOrganizationId(): string {
      if (!this.loggedInOrganizationInfo.id) {
        return "";
      }
      return this.loggedInOrganizationInfo.id;
    },
  },
  actions: {
    /**
     * クエリパラメータ==oの値を元に組織情報を更新する
     */
    async updateOrganizationFromQueryParameter(params: {
      to: RouteLocationNormalizedGeneric;
    }) {
      // 組織IDの初期化 ⇨ 組織IDが存在しない場合はクエリパラメータから新規に取得
      const organizationId =
        (params.to.query.o as string) != undefined
          ? (params.to.query.o as string)
          : this.loggedInOrganizationInfo.id;

      await this.updateLoggedInOrganizationInfo({
        filterKey: organizationId,
        searchType: "id",
      });
    },
    async updateLoggedInOrganizationInfo(params: {
      filterKey: string;
      searchType: "code" | "id";
    }) {
      log(
        "INFO",
        "updateLoggedInOrganizationInfo triggered with params...🔥",
        params
      );
      const firestoreOps = useFirestoreDocOperation();
      let organization = null;
      // 組織情報を取得
      if (params.searchType === "code") {
        organization = await firestoreOps.getSingleDocumentByQuery({
          collectionName: "organizations",
          targetField: "code",
          operator: "==",
          targetValue: params.filterKey,
          converter: organizationConverter,
        });
      }
      if (params.searchType === "id") {
        organization = await firestoreOps.getSingleDocumentById({
          collectionName: "organizations",
          docId: params.filterKey,
          converter: organizationConverter,
        });
      }

      // 取得した組織情報をstateにセットする
      if (organization) {
        this.loggedInOrganizationInfo = organization;
      } else {
        // 取得できなかった場合は、デフォルト値をセットする
        this.loggedInOrganizationInfo = {
          id: "",
          name: "",
          code: "",
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        };
      }
    },
    /**
     * 組織のブランディング (ロゴ / AI アバター) を部分更新する。
     * 引数で undefined を渡されたフィールドはそのまま、null を渡されたら削除扱い。
     */
    async updateBranding(params: {
      logoUrl?: string | null;
      aiAvatarUrl?: string | null;
      colorThemeId?: string | null;
    }) {
      const orgId = this.getLoggedInOrganizationId;
      if (!orgId) throw new Error("組織情報が未取得です");

      const current = this.loggedInOrganizationInfo.branding ?? {};
      const next: Record<string, string> = { ...current };
      if (params.logoUrl === null) {
        delete next.logoUrl;
      } else if (params.logoUrl !== undefined) {
        next.logoUrl = params.logoUrl;
      }
      if (params.aiAvatarUrl === null) {
        delete next.aiAvatarUrl;
      } else if (params.aiAvatarUrl !== undefined) {
        next.aiAvatarUrl = params.aiAvatarUrl;
      }
      if (params.colorThemeId === null) {
        delete next.colorThemeId;
      } else if (params.colorThemeId !== undefined) {
        next.colorThemeId = params.colorThemeId;
      }

      const org = this.loggedInOrganizationInfo;
      if (!org.name || !org.code) {
        throw new Error("組織の name / code が未取得のため保存できません");
      }

      const branding: OrganizationBranding | undefined =
        Object.keys(next).length > 0 ? (next as OrganizationBranding) : undefined;

      const firestoreOps = useFirestoreDocOperation();
      // converter の strict バリデーションを通すため、部分更新でも name/code を含める
      const updated = await firestoreOps.updateDocument({
        collectionName: "organizations",
        docId: orgId,
        docData: {
          id: orgId,
          name: org.name,
          code: org.code,
          branding,
          createdAt: org.createdAt,
        },
        converter: organizationConverter,
      });
      if (updated) {
        this.loggedInOrganizationInfo = updated;
      } else {
        throw new Error("組織情報の更新に失敗しました");
      }
    },
  },
});
