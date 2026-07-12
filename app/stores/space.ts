import { defineStore } from "pinia";
import {
  type Space,
  type SpaceInput,
  type SpaceUpdate,
  spaceConverter,
  getSpaceCollectionPath,
} from "@models/space";
import log from "@utils/logger";
import { useAdminUserStore } from "@stores/admin-user";
import { syncDatadogSpaceContext } from "@utils/datadogObservability";

/**
 * Space Store
 * Organization配下のSpace管理とSpace切り替え機能を提供
 */
export const useSpaceStore = defineStore("space", {
  state: () => ({
    selectedSpace: null as Space | null,
    spaces: [] as Space[],
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    /**
     * Spaceが選択されているかどうか
     */
    isSpaceSelected: (state): boolean => state.selectedSpace !== null,

    /**
     * デフォルトSpace（isDefault=true）を取得
     */
    defaultSpace: (state): Space | null =>
      state.spaces.find((s) => s.isDefault) || null,

    /**
     * ロールベースでフィルタされたSpace一覧
     * ✅ DOC_08に準拠した実装
     */
    currentUserSpaces: (state): Space[] => {
      const adminUserStore = useAdminUserStore();

      // デバッグログ
      log("DEBUG", "currentUserSpaces getter", {
        spacesCount: state.spaces.length,
        rbacRole: adminUserStore.rbacRole,
        isSuper: adminUserStore.isSuper,
        isSystemAdmin: adminUserStore.isSystemAdmin,
        spaceIds: (
          adminUserStore.currentUserClaimsInfo as Record<string, unknown>
        )?.spaceIds,
      });

      // Super/システム管理者は全Space
      if (adminUserStore.isSuper || adminUserStore.isSystemAdmin) {
        const filtered = state.spaces.filter((s) => !s.deletedAt);
        log("DEBUG", "currentUserSpaces: Super/SystemAdmin", { filteredCount: filtered.length });
        return filtered;
      }

      // 利用者は Custom Claims の spaceIds でフィルタ
      const spaceIds =
        (adminUserStore.currentUserClaimsInfo as Record<string, unknown>)
          ?.spaceIds || [];
      
      // spaceIdsが空の場合は、全Spaceを返す（開発中のフォールバック）
      if (spaceIds.length === 0) {
        log("WARN", "currentUserSpaces: spaceIds is empty, returning all spaces as fallback");
        return state.spaces.filter((s) => !s.deletedAt);
      }

      const filtered = state.spaces.filter(
        (s) => !s.deletedAt && spaceIds.includes(s.id)
      );
      log("DEBUG", "currentUserSpaces: Regular User", { filteredCount: filtered.length, spaceIds });
      return filtered;
    },
  },

  actions: {
    /**
     * 組織配下の全Space一覧を取得
     * organizationId は OrganizationStore から取得
     */
    async fetchSpaces(): Promise<void> {
      this.isLoading = true;
      this.error = null;

      try {
        const organizationStore = useOrganizationStore();
        const organizationId = organizationStore.getLoggedInOrganizationId;

        if (!organizationId) {
          throw new Error("fetchSpaces: organizationId is not set");
        }

        const firestoreOps = useFirestoreDocOperation();
        const collectionPath = getSpaceCollectionPath(organizationId);

        log("INFO", "fetchSpaces: collectionPath", collectionPath);

        const spaces =
          await firestoreOps.getAllDocumentListFromCollectionWithConverter<Space>(
            {
              collectionName: collectionPath,
              converter: spaceConverter,
            }
          );

        this.spaces = spaces.filter((s) => !s.deletedAt);

        log("INFO", "fetchSpaces: spaces fetched", this.spaces.length);

        // 初回アクセス時、selectedSpaceがnullの場合は自動選択
        if (!this.selectedSpace && this.spaces.length > 0) {
          await this.autoSelectInitialSpace();
        }
      } catch (error) {
        log("ERROR", "fetchSpaces failed", error);
        this.error = "Spaceの取得に失敗しました";
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 初回アクセス時のSpace自動選択
     * 優先順位: localStorage > デフォルトSpace > 最初のSpace
     */
    async autoSelectInitialSpace(): Promise<void> {
      try {
        // 1. localStorageから前回選択したSpaceIdを復元
        const savedSpaceId = localStorage.getItem("selectedSpaceId");
        if (savedSpaceId) {
          const savedSpace = this.spaces.find((s) => s.id === savedSpaceId);
          if (savedSpace) {
            await this.selectSpace({ spaceId: savedSpaceId });
            log("INFO", "autoSelectInitialSpace: from localStorage", savedSpaceId);
            return;
          }
        }

        // 2. デフォルトSpace（isDefault=true）を選択
        if (this.defaultSpace) {
          await this.selectSpace({ spaceId: this.defaultSpace.id });
          log("INFO", "autoSelectInitialSpace: default space", this.defaultSpace.id);
          return;
        }

        // 3. 最初のSpaceを選択
        if (this.spaces.length > 0) {
          await this.selectSpace({ spaceId: this.spaces[0].id });
          log("INFO", "autoSelectInitialSpace: first space", this.spaces[0].id);
        }
      } catch (error) {
        log("ERROR", "autoSelectInitialSpace failed", error);
      }
    },

    /**
     * Space切り替え
     * @param params.spaceId - 切り替え先のSpace ID
     */
    async selectSpace(params: { spaceId: string }): Promise<void> {
      const space = this.spaces.find((s) => s.id === params.spaceId);
      if (!space) {
        throw new Error(`Space not found: ${params.spaceId}`);
      }

      log("INFO", "selectSpace: switching to", params.spaceId);

      // ✅ Space切り替え前に全Storeをクリア（情報隔離）
      await this.clearAllStores();

      // selectedSpaceを更新
      this.selectedSpace = space;

      // localStorageに永続化
      localStorage.setItem("selectedSpaceId", space.id);

      // ContextStoreにspaceIdを通知
      const contextStore = useContextStore();
      contextStore.setSpaceId({ spaceId: space.id });
      syncDatadogSpaceContext(space);

      log("INFO", "selectSpace: completed", space.id);
    },

    /**
     * 新規Space作成
     * @param params.input - Space作成入力データ
     * @returns 作成されたSpace
     */
    async createSpace(params: { input: SpaceInput }): Promise<Space> {
      this.isLoading = true;
      this.error = null;

      try {
        const firestoreOps = useFirestoreDocOperation();
        const organization = useOrganizationStore();
        const currentUser = useCurrentUser();

        if (!organization.loggedInOrganizationInfo?.id) {
          throw new Error("Organization not selected");
        }

        if (!currentUser.value?.uid) {
          throw new Error("User not authenticated");
        }

        const collectionPath = getSpaceCollectionPath(
          organization.loggedInOrganizationInfo.id
        );

        // 名称重複チェック
        const existingSpaces = await firestoreOps.getDocumentListByQuery({
          collectionName: collectionPath,
          targetField: "name",
          operator: "==",
          targetValue: params.input.name,
          converter: spaceConverter,
        });

        if (existingSpaces.length > 0) {
          throw new Error("同名のSpaceが既に存在します");
        }

        // Space作成
        const spaceId = createRandomDocId();
        const spaceData = {
          ...params.input,
          organizationId: organization.loggedInOrganizationInfo.id,
          createdBy: currentUser.value.uid,
        };

        await firestoreOps.createDocument({
          collectionName: collectionPath,
          docId: spaceId,
          docData: spaceData,
          converter: spaceConverter,
        });

        // spaces配列に追加
        const newSpace = await firestoreOps.getSingleDocumentById({
          collectionName: collectionPath,
          docId: spaceId,
          converter: spaceConverter,
        });

        if (newSpace) {
          this.spaces.push(newSpace);
          // 作成したSpaceを自動選択
          await this.selectSpace({ spaceId: newSpace.id });
          log("INFO", "createSpace: space created", newSpace.id);
          return newSpace;
        } else {
          throw new Error("Space creation failed");
        }
      } catch (error) {
        log("ERROR", "createSpace failed", error);
        this.error =
          error instanceof Error ? error.message : "Spaceの作成に失敗しました";
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Space情報更新
     * @param params.spaceId - 更新対象のSpace ID
     * @param params.updates - 更新データ
     */
    async updateSpace(params: {
      spaceId: string;
      updates: SpaceUpdate;
    }): Promise<void> {
      this.isLoading = true;
      this.error = null;

      try {
        const firestoreOps = useFirestoreDocOperation();
        const organization = useOrganizationStore();

        if (!organization.loggedInOrganizationInfo?.id) {
          throw new Error("Organization not selected");
        }

        const collectionPath = getSpaceCollectionPath(
          organization.loggedInOrganizationInfo.id
        );

        await firestoreOps.updateDocument({
          collectionName: collectionPath,
          docId: params.spaceId,
          docData: params.updates,
          converter: spaceConverter,
        });

        // spaces配列を更新
        const index = this.spaces.findIndex((s) => s.id === params.spaceId);
        if (index !== -1) {
          this.spaces[index] = { ...this.spaces[index], ...params.updates };
        }

        // 選択中のSpaceが更新された場合、selectedSpaceも更新
        if (this.selectedSpace?.id === params.spaceId) {
          this.selectedSpace = { ...this.selectedSpace, ...params.updates };
        }

        log("INFO", "updateSpace: space updated", params.spaceId);
      } catch (error) {
        log("ERROR", "updateSpace failed", error);
        this.error = "Spaceの更新に失敗しました";
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Space削除（論理削除）
     * @param params.spaceId - 削除対象のSpace ID
     */
    async deleteSpace(params: { spaceId: string }): Promise<void> {
      this.isLoading = true;
      this.error = null;

      try {
        const firestoreOps = useFirestoreDocOperation();
        const organization = useOrganizationStore();

        if (!organization.loggedInOrganizationInfo?.id) {
          throw new Error("Organization not selected");
        }

        const collectionPath = getSpaceCollectionPath(
          organization.loggedInOrganizationInfo.id
        );

        // 論理削除（deletedAtフィールドを追加）
        await firestoreOps.updateDocument({
          collectionName: collectionPath,
          docId: params.spaceId,
          docData: { deletedAt: new Date() },
          converter: spaceConverter,
        });

        // spaces配列から削除
        this.spaces = this.spaces.filter((s) => s.id !== params.spaceId);

        // 削除したSpaceが選択中の場合、他のSpaceを選択
        if (this.selectedSpace?.id === params.spaceId) {
          if (this.spaces.length > 0) {
            await this.selectSpace({ spaceId: this.spaces[0].id });
          } else {
            this.selectedSpace = null;
          }
        }

        log("INFO", "deleteSpace: space deleted", params.spaceId);
      } catch (error) {
        log("ERROR", "deleteSpace failed", error);
        this.error = "Spaceの削除に失敗しました";
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Space切り替え時に全Storeをクリア（情報隔離）
     */
    async clearAllStores(): Promise<void> {
      log("INFO", "clearAllStores: clearing all stores");

      // ✅ 各Storeを$reset()で初期化
      // 将来的に実装されるStoreを追加する

      // Video関連Store
      try {
        // useVideoStore().$reset();
      } catch (e) {
        log("WARN", "videoStore not found", e);
      }

      try {
        // useNarrationVideoProjectStore().$reset();
      } catch (e) {
        log("WARN", "narrationVideoProjectStore not found", e);
      }

      // AI関連Store
      try {
        // useAiContextStore().$reset();
      } catch (e) {
        log("WARN", "aiContextStore not found", e);
      }

      try {
        // useAiChatStore().$reset();
      } catch (e) {
        log("WARN", "aiChatStore not found", e);
      }

      try {
        // useReferenceStore().$reset();
      } catch (e) {
        log("WARN", "referenceStore not found", e);
      }

      // その他Store
      try {
        useFileStorageViewerStore().$reset();
      } catch (e) {
        log("WARN", "fileStorageViewerStore not found", e);
      }

      log("INFO", "clearAllStores: completed");
    },
  },
});
