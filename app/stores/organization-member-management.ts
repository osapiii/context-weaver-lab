import { defineStore } from "pinia";
import { getAuth } from "firebase/auth";
import log from "@utils/logger";
import { adminUserConverter, type decodedAdminUser } from "@models/adminUser";
import { RequestMetadataSchema } from "@models/core/operationMetadata";
import {
  getMemberUserCreateCollectionPath,
  getMemberUserDeleteCollectionPath,
  getMemberUserUpdateCollectionPath,
  memberUserCreateInputSchema,
  memberUserCreateRequestConverter,
  memberUserDeleteInputSchema,
  memberUserDeleteRequestConverter,
  memberUserUpdateInputSchema,
  memberUserUpdateRequestConverter,
  type DecodedMemberUserCreateRequest,
  type DecodedMemberUserDeleteRequest,
  type DecodedMemberUserUpdateRequest,
  type MemberUserCreateInput,
  type MemberUserDeleteInput,
  type MemberUserUpdateInput,
} from "@models/organizationMemberRequest";

const ORG_SCOPE_SPACE_ID = "_organization";

export const useOrganizationMemberManagementStore = defineStore(
  "organizationMemberManagement",
  {
    state: () => ({
      members: [] as decodedAdminUser[],
      isLoadingMembers: false,
      membersError: null as string | null,
      pendingRequestId: null as string | null,
      lastCreateRequest: null as DecodedMemberUserCreateRequest | null,
      lastUpdateRequest: null as DecodedMemberUserUpdateRequest | null,
      lastDeleteRequest: null as DecodedMemberUserDeleteRequest | null,
      operationError: null as string | null,
      isSubmitting: false,
    }),

    actions: {
      async fetchMembers(): Promise<void> {
        this.isLoadingMembers = true;
        this.membersError = null;
        try {
          const organization = useOrganizationStore();
          const orgId = organization.getLoggedInOrganizationId;
          if (!orgId) {
            throw new Error("組織情報が取得できません");
          }

          const firestoreOps = useFirestoreDocOperation();
          const list = await firestoreOps.getDocumentListByQuery({
            collectionName: `organizations/${orgId}/adminUsers`,
            targetField: "organizationId",
            operator: "==",
            targetValue: orgId,
            converter: adminUserConverter,
          });
          this.members = list.sort(
            (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis(),
          );
        } catch (error) {
          this.membersError =
            error instanceof Error ? error.message : "メンバー一覧の取得に失敗しました";
          log("ERROR", "fetchMembers failed", error);
        } finally {
          this.isLoadingMembers = false;
        }
      },

      _buildOperationMetadata(requestId: string, collectionSuffix: string) {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser?.email) {
          throw new Error("ログイン情報を取得できません");
        }

        const organization = useOrganizationStore();
        const adminUserStore = useAdminUserStore();
        const orgId = organization.getLoggedInOrganizationId;
        if (!orgId) {
          throw new Error("組織情報が取得できません");
        }

        if (!adminUserStore.isAdminOrAbove) {
          throw new Error("メンバー管理の権限がありません");
        }

        return RequestMetadataSchema.parse({
          organizationId: orgId,
          spaceId: ORG_SCOPE_SPACE_ID,
          loggingCollectionId: collectionSuffix,
          loggingDocumentId: requestId,
          requestedBy: {
            userId: currentUser.uid,
            email: currentUser.email,
            role: adminUserStore.rbacRole || 2,
          },
          isCommand: true,
          isOouiCrud: true,
          isLlmCall: false,
          isAdminCrud: true,
        });
      },

      async submitCreateRequest(
        input: MemberUserCreateInput,
      ): Promise<DecodedMemberUserCreateRequest | null> {
        this.isSubmitting = true;
        this.operationError = null;
        try {
          const parsed = memberUserCreateInputSchema.parse(input);
          const organization = useOrganizationStore();
          const orgId = organization.getLoggedInOrganizationId!;
          const requestId = `member_create_${Date.now()}_${createRandomDocId()}`;
          const operationMetadata = this._buildOperationMetadata(
            requestId,
            "requests/memberUserCreate/logs",
          );

          const firestoreOps = useFirestoreDocOperation();
          const created = await firestoreOps.createDocument({
            collectionName: getMemberUserCreateCollectionPath(orgId),
            docId: requestId,
            docData: {
              input: parsed,
              operationMetadata,
              status: "pending",
              logs: [],
            },
            converter: memberUserCreateRequestConverter,
          });

          if (!created) {
            throw new Error("作成リクエストの送信に失敗しました");
          }

          this.pendingRequestId = requestId;
          this.lastCreateRequest = created;
          return created;
        } catch (error) {
          this.operationError =
            error instanceof Error ? error.message : "作成リクエストに失敗しました";
          log("ERROR", "submitCreateRequest failed", error);
          return null;
        } finally {
          this.isSubmitting = false;
        }
      },

      async submitUpdateRequest(
        input: MemberUserUpdateInput,
      ): Promise<DecodedMemberUserUpdateRequest | null> {
        this.isSubmitting = true;
        this.operationError = null;
        try {
          const parsed = memberUserUpdateInputSchema.parse(input);
          const organization = useOrganizationStore();
          const orgId = organization.getLoggedInOrganizationId!;
          const requestId = `member_update_${Date.now()}_${createRandomDocId()}`;
          const operationMetadata = this._buildOperationMetadata(
            requestId,
            "requests/memberUserUpdate/logs",
          );

          const firestoreOps = useFirestoreDocOperation();
          const created = await firestoreOps.createDocument({
            collectionName: getMemberUserUpdateCollectionPath(orgId),
            docId: requestId,
            docData: {
              input: parsed,
              operationMetadata,
              status: "pending",
              logs: [],
            },
            converter: memberUserUpdateRequestConverter,
          });

          if (!created) {
            throw new Error("更新リクエストの送信に失敗しました");
          }

          this.pendingRequestId = requestId;
          this.lastUpdateRequest = created;
          return created;
        } catch (error) {
          this.operationError =
            error instanceof Error ? error.message : "更新リクエストに失敗しました";
          log("ERROR", "submitUpdateRequest failed", error);
          return null;
        } finally {
          this.isSubmitting = false;
        }
      },

      async submitDeleteRequest(
        input: MemberUserDeleteInput,
      ): Promise<DecodedMemberUserDeleteRequest | null> {
        this.isSubmitting = true;
        this.operationError = null;
        try {
          const parsed = memberUserDeleteInputSchema.parse(input);
          const organization = useOrganizationStore();
          const orgId = organization.getLoggedInOrganizationId!;
          const requestId = `member_delete_${Date.now()}_${createRandomDocId()}`;
          const operationMetadata = this._buildOperationMetadata(
            requestId,
            "requests/memberUserDelete/logs",
          );

          const firestoreOps = useFirestoreDocOperation();
          const created = await firestoreOps.createDocument({
            collectionName: getMemberUserDeleteCollectionPath(orgId),
            docId: requestId,
            docData: {
              input: parsed,
              operationMetadata,
              status: "pending",
              logs: [],
            },
            converter: memberUserDeleteRequestConverter,
          });

          if (!created) {
            throw new Error("削除リクエストの送信に失敗しました");
          }

          this.pendingRequestId = requestId;
          this.lastDeleteRequest = created;
          return created;
        } catch (error) {
          this.operationError =
            error instanceof Error ? error.message : "削除リクエストに失敗しました";
          log("ERROR", "submitDeleteRequest failed", error);
          return null;
        } finally {
          this.isSubmitting = false;
        }
      },

      clearPendingRequest(): void {
        this.pendingRequestId = null;
        this.lastCreateRequest = null;
        this.lastUpdateRequest = null;
        this.lastDeleteRequest = null;
      },
    },
  },
);
