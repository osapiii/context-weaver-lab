declare module "#app" {
  interface PageMeta {
    /** admin layout の AdminPageContainer variant */
    adminPageContainer?: import("@composables/useAdminViewport").AdminPageContainerVariant;
    /** main 高さいっぱい (Workspace / リサーチ等) */
    adminPageFillHeight?: boolean;
    /** 内側に space-y-6 を付与 (default: true) */
    adminPageStack?: boolean;
  }
}

export {};
