import { defineStore } from "pinia";
import { z } from "zod";

// *********STORE*********
export const useContextStore = defineStore("context", {
  state: () => ({
    runtimeConfig: {},
    environmentType: "local" as "local" | "dev" | "stg" | "prod",
    bucketName: "enostech-sandbox.appspot.com",
    isMobile: false,
    helpTextIsActive: false,
    focusModeIsActive: false,
    // Space management
    spaceId: "" as string,
  }),
  getters: {
    /**
     * Firestore コレクションのベースパスを生成
     * @param collection コレクション名（例: 'videos', 'projects'）
     * @returns organizations/{orgId}/spaces/{spaceId}/{collection}
     */
    baseFirestorePath:
      () =>
      (collection: string): string => {
        const organizationStore = useOrganizationStore();
        const spaceStore = useSpaceStore();

        const organizationId = organizationStore.loggedInOrganizationInfo?.id;
        const spaceId = spaceStore.selectedSpace?.id;

        if (!organizationId) {
          throw new Error(
            "ERR_ORGANIZATION_NOT_SELECTED: baseFirestorePath requires organizationId. " +
              `organizationId=${organizationId}`
          );
        }

        if (!spaceId) {
          throw new Error(
            "ERR_SPACE_NOT_SELECTED: baseFirestorePath requires spaceId. " +
              `Active Space is required for this operation. spaceId=${spaceId}`
          );
        }

        return `organizations/${organizationId}/spaces/${spaceId}/${collection}`;
      },

    /**
     * GCS フォルダのベースパスを生成
     * @param folder フォルダ名（例: 'videos', 'transcriptions'）
     * @returns organizations/{orgId}/spaces/{spaceId}/{folder}
     */
    baseGcsPath:
      () =>
      (folder: string): string => {
        const organizationStore = useOrganizationStore();
        const spaceStore = useSpaceStore();

        const organizationId = organizationStore.loggedInOrganizationInfo?.id;
        const spaceId = spaceStore.selectedSpace?.id;

        if (!organizationId) {
          throw new Error(
            "ERR_ORGANIZATION_NOT_SELECTED: baseGcsPath requires organizationId. " +
              `organizationId=${organizationId}`
          );
        }

        if (!spaceId) {
          throw new Error(
            "ERR_SPACE_NOT_SELECTED: baseGcsPath requires spaceId. " +
              `Active Space is required for this operation. spaceId=${spaceId}`
          );
        }

        return `organizations/${organizationId}/spaces/${spaceId}/${folder}`;
      },

    /**
     * Organization-scoped Firestoreパスを生成（RequestDoc用）
     * @param path RequestDocパス（例: 'requests/geminiFileSpaceRequests/logs'）
     * @returns organizations/{orgId}/{path}
     */
    organizationFirestorePath:
      () =>
      (path: string): string => {
        const organizationStore = useOrganizationStore();
        const organizationId = organizationStore.loggedInOrganizationInfo?.id;

        if (!organizationId) {
          throw new Error(
            "ERR_ORGANIZATION_NOT_SELECTED: organizationFirestorePath requires organizationId. " +
              `organizationId=${organizationId}`
          );
        }

        return `organizations/${organizationId}/${path}`;
      },
  },
  actions: {
    updateContextInfo(): void {
      const runtimeConfig = useRuntimeConfig();
      this.runtimeConfig = runtimeConfig;
      // 環境情報の更新
      if (window.location.host.includes("localhost")) {
        this.environmentType = "local";
        this.bucketName = "enostech-sandbox.appspot.com";
      } else if (window.location.host.includes("enostech-sandbox")) {
        this.environmentType = "dev";
        this.bucketName = "enostech-sandbox.appspot.com";
      } else if (window.location.host.includes("qravis")) {
        this.environmentType = "prod";
        this.bucketName = "qlavisprod.appspot.com";
      } else {
        this.environmentType = "dev";
        this.bucketName = "enostech-sandbox.appspot.com";
      }
      // モバイル (スマホ) 判定。タブレット (>=768px, iPad 縦含む) は PC と同じ
      // admin レイアウトを使うため、スマホは幅 < 768px のみとする。
      this.isMobile = window.innerWidth < 768;
    },
    returnDebutInfoIsActive(): boolean {
      return (
        (this.environmentType == "local" || this.environmentType == "dev") &&
        !this.isMobile
      );
    },
    toggleFocusMode(): void {
      this.focusModeIsActive = !this.focusModeIsActive;
    },
    /**
     * Space ID を設定
     * @param params.spaceId - Space ID
     */
    setSpaceId(params: { spaceId: string }): void {
      this.spaceId = params.spaceId;
    },
  },
});
