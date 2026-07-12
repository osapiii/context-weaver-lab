import { defineStore } from "pinia";
import { getAuth } from "firebase/auth";
import log from "@utils/logger";
import { canAccessGodMode } from "@composables/useGodModeAccess";
import { RequestMetadataSchema } from "@models/core/operationMetadata";
import {
  getSaasOnboardingCollectionPath,
  saasOnboardingInputSchema,
  saasOnboardingRequestConverter,
  type DecodedSaasOnboardingRequest,
  type SaasOnboardingInput,
} from "@models/saasOnboardingRequest";

export const useGodModeOnboardingStore = defineStore("godModeOnboarding", {
  state: () => ({
    isSubmitting: false,
    lastRequest: null as DecodedSaasOnboardingRequest | null,
    error: null as string | null,
  }),

  actions: {
    /**
     * SaaS 新規アカウント発行リクエストを作成する。
     * バックエンド trigger が Org / Space / Auth / FileSpace を一括プロビジョニング。
     */
    async submitOnboardingRequest(
      input: SaasOnboardingInput,
    ): Promise<DecodedSaasOnboardingRequest | null> {
      this.isSubmitting = true;
      this.error = null;

      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser?.email) {
          throw new Error("ログイン情報を取得できません");
        }

        const organizationStore = useOrganizationStore();
        const adminUserStore = useAdminUserStore();
        const operatorOrgCode =
          (
            adminUserStore.currentUserClaimsInfo as {
              organizationCode?: string;
            }
          )?.organizationCode ??
          organizationStore.loggedInOrganizationInfo?.code ??
          null;

        if (!canAccessGodMode(operatorOrgCode)) {
          throw new Error("Godモードの利用権限がありません");
        }

        const parsedInput = saasOnboardingInputSchema.parse(input);
        const operatorOrgId = organizationStore.getLoggedInOrganizationId;

        if (!operatorOrgId) {
          throw new Error("操作者の組織情報が取得できません");
        }

        const requestId = `saas_onboarding_${Date.now()}_${createRandomDocId()}`;
        const firestoreOps = useFirestoreDocOperation();

        const operationMetadata = RequestMetadataSchema.parse({
          organizationId: operatorOrgId,
          spaceId: "platform",
          loggingCollectionId: "requests/saasOnboarding/logs",
          loggingDocumentId: requestId,
          requestedBy: {
            userId: currentUser.uid,
            email: currentUser.email,
            role: adminUserStore.rbacRole || 1,
          },
          isCommand: true,
          isOouiCrud: true,
          isLlmCall: false,
          isAdminCrud: true,
        });

        const created = await firestoreOps.createDocument({
          collectionName: getSaasOnboardingCollectionPath(operatorOrgId),
          docId: requestId,
          docData: {
            input: parsedInput,
            operationMetadata,
            status: "pending",
            logs: [],
          },
          converter: saasOnboardingRequestConverter,
        });

        if (!created) {
          throw new Error("オンボーディングリクエストの作成に失敗しました");
        }

        this.lastRequest = created;
        log("INFO", "SaaS onboarding request created", { requestId });
        return created;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "オンボーディングリクエストの送信に失敗しました";
        this.error = message;
        log("ERROR", "submitOnboardingRequest failed", error);
        throw error;
      } finally {
        this.isSubmitting = false;
      }
    },

    clearLastRequest() {
      this.lastRequest = null;
      this.error = null;
    },
  },
});
