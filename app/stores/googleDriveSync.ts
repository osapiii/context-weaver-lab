import { defineStore } from "pinia";
import { getAuth } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import log from "@utils/logger";
import createRandomId from "@utils/createRandomDocId";
import { useFirestoreDocOperation } from "@composables/firestore-doc-operation";
import { useContextStore } from "./context";
import { useSpaceStore } from "./space";
import { useAdminUserStore } from "./admin-user";
import { useOrganizationStore } from "./organization";
import {
  googleDriveIntegrationConfigConverter,
  type DecodedGoogleDriveIntegrationConfig,
  DEFAULT_DRIVE_CONFIG_ID,
} from "@models/googleDriveIntegrationConfig";
import {
  googleDriveSyncRequestConverter,
  type DecodedGoogleDriveSyncRequest,
  type GoogleDriveSyncInput,
} from "@models/googleDriveSyncRequest";
import { RequestMetadataSchema } from "@models/core/operationMetadata";
import {
  isGoogleDriveSyncPipelineActive,
  isGoogleDriveSyncTerminal,
} from "@utils/googleDriveSyncTerminal";
import {
  computeDrivePendingDiff,
  type DriveListFile,
  type DrivePendingDiffResult,
  type FirestoreDriveDoc,
} from "@utils/computeDrivePendingDiff";
import { getDriveToGcsSyncServiceUrl } from "@utils/googleDriveServiceUrl";
import {
  createIdleImportSession,
  projectRequestToSession,
} from "@utils/driveImportSession";
import type { DriveImportFileItemSource } from "@utils/driveImportFileRows";
import { buildInitialDriveSyncRequestSeed } from "@utils/buildInitialDriveSyncRequestDoc";
import { buildInitialFileItemsMap } from "@utils/buildInitialFileItemsMap";
import {
  extractDriveSyncFetchErrorMessage,
  isRetryableDriveScanError,
  sleepMs,
} from "@utils/parseDriveSyncFetchError";
import {
  buildDriveHeaderChipLabel,
  resolveDriveHeaderChipState,
  type DriveHeaderChipState,
  type DriveHeaderSummary,
} from "@utils/driveHeaderChipState";
import { buildDriveImportFileRows, computeDriveImportProgressPercent } from "@utils/driveImportFileRows";
import { getDriveSyncStatusPresentation } from "@utils/googleDriveSyncProgress";

/**
 * GoogleDriveSync Store (Workflows architecture)
 *
 * 担当:
 *   - googleDriveIntegrationConfig の取得 / 更新
 *   - googleDriveSyncRequests Doc の発行 (1 操作 = 1 RequestDoc = 1 Workflow execution)
 *   - 監視は composable (useGoogleDriveSyncRequestSnapshot) 側
 *
 * バッチ取り込みのファンアウトは Workflow が引き受ける。FE は単一 RequestDoc を
 * 購読し、`steps` / `progress` / `mirror` / `register` を `activeImportSession`
 * に射影してモーダルに表示する。
 */

const REQUESTS_SUBPATH = "requests/googleDriveSyncRequests/logs";

/** ヘッダー chip の完了フラッシュ表示時間 */
export const DRIVE_HEADER_COMPLETED_FLASH_MS = 8_000;

/** Drive 一覧プレビューは Cloud Run 600s まで許容。FE はそれに近い上限 */
const DRIVE_SCAN_TIMEOUT_MS = 300_000;
const DRIVE_SCAN_MAX_ATTEMPTS = 3;

function buildPendingScanFileItems(params: {
  importFileIds: string[];
  removeFileIds: string[];
  driveFiles: DriveListFile[];
  existingDocs?: FirestoreDriveDoc[];
}): DriveImportFileItemSource[] {
  const nameByDriveId = new Map<string, string>();
  for (const file of params.driveFiles) {
    const name = file.name?.trim();
    if (file.id && name) nameByDriveId.set(file.id, name);
  }
  for (const doc of params.existingDocs ?? []) {
    const id = doc.driveFileId?.trim();
    const name = doc.name?.trim();
    if (id && name && !nameByDriveId.has(id)) nameByDriveId.set(id, name);
  }
  const importItems = params.importFileIds.map((driveFileId) => ({
    driveFileId,
    kind: "import" as const,
    displayName: nameByDriveId.get(driveFileId) ?? null,
  }));
  const removeItems = params.removeFileIds.map((driveFileId) => ({
    driveFileId,
    kind: "remove" as const,
    displayName: nameByDriveId.get(driveFileId) ?? null,
  }));
  return [...importItems, ...removeItems];
}

export type DrivePendingScanPhase = "idle" | "scanning" | "ready" | "error";

export type DrivePendingScanResult = {
  phase: DrivePendingScanPhase;
  addedCount: number;
  updatedCount: number;
  removedCount: number;
  skippedCount: number;
  importFileIds: string[];
  removeFileIds: string[];
  /** ファイル行 UI 用 (scan 時に名前付きで保持) */
  fileItems: DriveImportFileItemSource[];
  errorMessage: string | null;
  scannedAt: number | null;
};

export const useGoogleDriveSyncStore = defineStore("googleDriveSync", {
  state: () => ({
    config: null as DecodedGoogleDriveIntegrationConfig | null,
    isLoadingConfig: false,
    configError: null as string | null,
    /** 現在 / 直近の RequestDoc cache (snapshot watcher が書き込む) */
    snapshotWatchingRequests: new Map<string, DecodedGoogleDriveSyncRequest>(),
    isCreatingRequest: false,
    createRequestError: null as string | null,
    /** 監視中の Drive Sync RequestDoc id */
    activeSyncRequestId: null as string | null,
    /** 未取り込みファイルの差分プレビュー (画面入場時スキャン) */
    pendingScan: {
      phase: "idle",
      addedCount: 0,
      updatedCount: 0,
      removedCount: 0,
      skippedCount: 0,
      importFileIds: [],
      removeFileIds: [],
      fileItems: [],
      errorMessage: null,
      scannedAt: null,
    } as DrivePendingScanResult,
    activeImportSession: createIdleImportSession(),
    /** 同期完了時にインクリメント (一覧 refresh 用) */
    syncCompletedTick: 0,
    /** 終端ステータスを二重処理しない */
    processedTerminalRequestIds: new Set<string>(),
    /** 直近の終端同期結果 (トースト表示用) */
    lastTerminalSyncNotice: null as {
      ok: boolean;
      title: string;
      description?: string;
    } | null,
    /** 進行中スキャンの世代 (古い応答を無視) */
    pendingScanGeneration: 0,
    pendingScanAbortController: null as AbortController | null,
    /** グローバル進捗モーダル (admin layout) */
    importProgressModalOpen: false,
    /** 完了直後のヘッダー chip フラッシュ */
    driveHeaderCompletedFlashUntil: null as number | null,
  }),

  getters: {
    isConfigured: (state) => !!state.config?.rootFolderId,
    isPendingScanInProgress: (state): boolean =>
      state.pendingScan.phase === "scanning",
    pendingImportCount: (state): number =>
      state.pendingScan.addedCount + state.pendingScan.updatedCount,
    hasPendingImports: (state): boolean =>
      state.pendingScan.phase === "ready" &&
      state.pendingScan.addedCount + state.pendingScan.updatedCount > 0,
    isBatchImportInProgress: (state): boolean =>
      state.activeImportSession.phase === "running",
    batchImportProgressLabel: (state): string | null => {
      const session = state.activeImportSession;
      if (session.phase !== "running") return null;
      const { completedBatches, totalBatches, processedFiles, totalFiles } =
        session.progress;
      if (totalBatches > 0) {
        return `取り込み中 ${completedBatches}/${totalBatches} 単位 (${processedFiles}/${totalFiles} 件)`;
      }
      const currentLabel = session.progress.currentStep ?? "起動中";
      return `取り込み中 (${currentLabel})`;
    },
    isSyncInProgress: (state): boolean => {
      if (state.isCreatingRequest) return true;
      const id =
        state.activeSyncRequestId ?? state.activeImportSession.requestId;
      if (id) {
        const req = state.snapshotWatchingRequests.get(id);
        if (req) {
          if (isGoogleDriveSyncPipelineActive(req)) return true;
          if (isGoogleDriveSyncTerminal(req)) return false;
        }
      }
      if (state.activeImportSession.phase === "running") return true;
      if (!state.activeSyncRequestId) return false;
      const req = state.snapshotWatchingRequests.get(state.activeSyncRequestId);
      if (!req) return false;
      return isGoogleDriveSyncPipelineActive(req);
    },
    driveHeaderChipState(): DriveHeaderChipState {
      return resolveDriveHeaderChipState({
        isConfigured: this.isConfigured,
        isPendingScanInProgress: this.isPendingScanInProgress,
        isSyncInProgress: this.isSyncInProgress,
        completedFlashUntil: this.driveHeaderCompletedFlashUntil,
        activeSessionPhase: this.activeImportSession.phase,
        lastSyncStatus: this.config?.lastSyncStatus ?? null,
      });
    },
    driveHeaderSummary(): DriveHeaderSummary {
      const chipState = this.driveHeaderChipState;
      const session = this.activeImportSession;
      const fileRows = buildDriveImportFileRows({ session });
      const progressPercent =
        chipState === "running" && fileRows.length > 0
          ? computeDriveImportProgressPercent(fileRows)
          : chipState === "completedFlash"
            ? 100
            : 0;

      const activeReq = this.activeSyncRequestId
        ? this.snapshotWatchingRequests.get(this.activeSyncRequestId) ?? null
        : session.requestId
          ? this.snapshotWatchingRequests.get(session.requestId) ?? null
          : null;

      const phaseLabel = activeReq
        ? getDriveSyncStatusPresentation(activeReq).label
        : null;

      const chipLabel = buildDriveHeaderChipLabel({
        chipState,
        pendingAdded: this.pendingScan.addedCount,
        pendingUpdated: this.pendingScan.updatedCount,
        progressPercent,
      });

      return {
        chipState,
        chipLabel,
        progressPercent,
        pendingAdded: this.pendingScan.addedCount,
        pendingUpdated: this.pendingScan.updatedCount,
        pendingRemoved: this.pendingScan.removedCount,
        folderName: this.config?.rootFolderName ?? null,
        lastSyncedAtMs: this.config?.lastSyncedAt?.toMillis?.() ?? null,
        phaseLabel,
        canStartImport:
          this.hasPendingImports &&
          !this.isSyncInProgress &&
          !this.isPendingScanInProgress,
        canOpenProgress:
          this.isSyncInProgress ||
          chipState === "error" ||
          chipState === "completedFlash" ||
          Boolean(session.requestId),
      };
    },
  },

  actions: {
    openImportProgressModal(): void {
      this.importProgressModalOpen = true;
    },

    closeImportProgressModal(): void {
      this.importProgressModalOpen = false;
    },

    clearDriveHeaderCompletedFlash(): void {
      this.driveHeaderCompletedFlashUntil = null;
    },

    /**
     * ページリロード後に進行中 RequestDoc を復元する。
     * createdAt desc で直近数件を取得し pending/processing を拾う。
     */
    async recoverActiveSyncRequest(): Promise<void> {
      if (this.activeSyncRequestId) return;

      const contextStore = useContextStore();
      const spaceStore = useSpaceStore();
      if (!spaceStore.selectedSpace?.id) return;

      try {
        const firestoreOps = useFirestoreDocOperation();
        const collectionPath = contextStore.baseFirestorePath(REQUESTS_SUBPATH);
        const recent =
          await firestoreOps.getDocumentsWithQueryAndConverter<DecodedGoogleDriveSyncRequest>(
            {
              collectionName: collectionPath,
              converter: googleDriveSyncRequestConverter,
              orderBy: { field: "createdAt", direction: "desc" },
              limit: 8,
            }
          );

        const active = recent.find(
          (doc) => doc.status === "pending" || doc.status === "processing"
        );
        if (!active) return;

        this.snapshotWatchingRequests.set(active.id, active);
        this.activeSyncRequestId = active.id;
        this.activeImportSession = projectRequestToSession(
          active,
          this.activeImportSession
        );
        log("INFO", "recoverActiveSyncRequest restored", { requestId: active.id });
      } catch (e) {
        log("WARN", "recoverActiveSyncRequest failed", e);
      }
    },

    /**
     * Drive 連携設定を Firestore から取得
     */
    async fetchConfig(): Promise<DecodedGoogleDriveIntegrationConfig | null> {
      this.isLoadingConfig = true;
      this.configError = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        const contextStore = useContextStore();
        const organizationStore = useOrganizationStore();
        if (!organizationStore.getLoggedInOrganizationId) {
          this.config = null;
          return null;
        }
        const collectionPath = contextStore.organizationFirestorePath(
          "externalServiceConfigs/googleDriveIntegration/configs"
        );
        const doc = await firestoreOps.getSingleDocumentById<
          DecodedGoogleDriveIntegrationConfig
        >({
          collectionName: collectionPath,
          docId: DEFAULT_DRIVE_CONFIG_ID,
          converter: googleDriveIntegrationConfigConverter,
        });
        this.config = doc ?? null;
        return doc;
      } catch (e) {
        this.configError = "Drive 設定の取得に失敗";
        log("ERROR", "fetchDriveConfig failed", e);
        return null;
      } finally {
        this.isLoadingConfig = false;
      }
    },

    async upsertConfig(
      input: Pick<
        DecodedGoogleDriveIntegrationConfig,
        | "rootFolderId"
        | "rootFolderName"
        | "serviceAccountEmail"
        | "linkedFileSpaceId"
      >
    ): Promise<DecodedGoogleDriveIntegrationConfig | null> {
      this.isLoadingConfig = true;
      this.configError = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        const contextStore = useContextStore();
        const collectionPath = contextStore.organizationFirestorePath(
          "externalServiceConfigs/googleDriveIntegration/configs"
        );
        const existing = await firestoreOps.getSingleDocumentById<
          DecodedGoogleDriveIntegrationConfig
        >({
          collectionName: collectionPath,
          docId: DEFAULT_DRIVE_CONFIG_ID,
          converter: googleDriveIntegrationConfigConverter,
        });
        if (existing) {
          await firestoreOps.updateDocument({
            collectionName: collectionPath,
            docId: DEFAULT_DRIVE_CONFIG_ID,
            docData: {
              rootFolderId: input.rootFolderId,
              rootFolderName: input.rootFolderName ?? existing.rootFolderName ?? null,
              serviceAccountEmail: input.serviceAccountEmail,
              linkedFileSpaceId:
                input.linkedFileSpaceId ?? existing.linkedFileSpaceId ?? null,
              lastSyncedAt: existing.lastSyncedAt ?? null,
              lastSyncStatus: existing.lastSyncStatus ?? null,
              lastSyncError: existing.lastSyncError ?? null,
              createdAt: existing.createdAt,
              id: DEFAULT_DRIVE_CONFIG_ID,
            },
            converter: googleDriveIntegrationConfigConverter,
          });
        } else {
          await firestoreOps.createDocument({
            collectionName: collectionPath,
            docId: DEFAULT_DRIVE_CONFIG_ID,
            docData: input,
            converter: googleDriveIntegrationConfigConverter,
          });
        }
        return await this.fetchConfig();
      } catch (e) {
        this.configError = "Drive 設定の保存に失敗";
        log("ERROR", "upsertDriveConfig failed", e);
        return null;
      } finally {
        this.isLoadingConfig = false;
      }
    },

    async recordSyncOutcome(params: {
      status: "ok" | "error";
      errorMessage?: string | null;
    }): Promise<void> {
      const current = this.config;
      if (!current?.rootFolderId) return;

      const firestoreOps = useFirestoreDocOperation();
      const contextStore = useContextStore();
      const collectionPath = contextStore.organizationFirestorePath(
        "externalServiceConfigs/googleDriveIntegration/configs"
      );

      try {
        await firestoreOps.updateDocument({
          collectionName: collectionPath,
          docId: DEFAULT_DRIVE_CONFIG_ID,
          docData: {
            rootFolderId: current.rootFolderId,
            rootFolderName: current.rootFolderName ?? null,
            serviceAccountEmail: current.serviceAccountEmail,
            linkedFileSpaceId: current.linkedFileSpaceId ?? null,
            lastSyncedAt: Timestamp.now(),
            lastSyncStatus: params.status,
            lastSyncError:
              params.status === "error"
                ? params.errorMessage ?? "同期に失敗しました"
                : null,
            createdAt: current.createdAt,
            id: DEFAULT_DRIVE_CONFIG_ID,
          },
          converter: googleDriveIntegrationConfigConverter,
        });
        await this.fetchConfig();
      } catch (e) {
        log("ERROR", "recordSyncOutcome failed", e);
      }
    },

    /**
     * RequestDoc を activeImportSession に射影する。snapshot watcher から呼ばれる。
     */
    applyActiveImportSession(request: DecodedGoogleDriveSyncRequest): void {
      if (
        this.activeImportSession.requestId &&
        this.activeImportSession.requestId !== request.id
      ) {
        return;
      }
      this.activeImportSession = projectRequestToSession(
        request,
        this.activeImportSession
      );
    },

    resetImportSession(): void {
      this.activeImportSession = createIdleImportSession();
    },

    /**
     * RequestDoc の終端を 1 回だけ処理。
     */
    async handleSyncRequestTerminal(
      request: DecodedGoogleDriveSyncRequest
    ): Promise<void> {
      if (this.processedTerminalRequestIds.has(request.id)) return;
      if (!isGoogleDriveSyncTerminal(request)) return;

      this.processedTerminalRequestIds.add(request.id);

      if (request.id === this.activeSyncRequestId) {
        this.activeSyncRequestId = null;
      }

      if (this.activeImportSession.requestId === request.id) {
        this.activeImportSession = projectRequestToSession(
          request,
          this.activeImportSession
        );
      }

      this.syncCompletedTick += 1;

      const mirrorFailed = request.mirror?.failedCount ?? 0;
      const registerFailed = request.register?.failedCount ?? 0;
      const totalFailed = mirrorFailed + registerFailed;

      if (request.status === "completed") {
        const added =
          (request.mirror?.addedCount ?? 0) + (request.register?.addedCount ?? 0);
        const updated =
          (request.mirror?.updatedCount ?? 0) +
          (request.register?.updatedCount ?? 0);
        const removed =
          (request.mirror?.removedCount ?? 0) +
          (request.register?.removedCount ?? 0);
        await this.recordSyncOutcome({ status: "ok" });
        const ok = totalFailed === 0;
        this.driveHeaderCompletedFlashUntil =
          Date.now() + DRIVE_HEADER_COMPLETED_FLASH_MS;
        this.lastTerminalSyncNotice = {
          ok,
          title: ok
            ? "Drive 取り込みが完了しました"
            : "Drive 取り込みが一部失敗しました",
          description:
            added + updated + removed > 0
              ? `追加 ${added} / 更新 ${updated} / 削除 ${removed}` +
                (totalFailed > 0 ? ` / 失敗 ${totalFailed}` : "")
              : totalFailed > 0
                ? `失敗 ${totalFailed} 件`
                : "変更はありませんでした",
        };
        return;
      }

      const errMsg =
        request.errorMessage ?? "同期に失敗しました。Workflow ログを確認してください";
      await this.recordSyncOutcome({
        status: "error",
        errorMessage: errMsg,
      });
      this.lastTerminalSyncNotice = {
        ok: false,
        title: "Drive 取り込みに失敗しました",
        description: errMsg,
      };
    },

    /**
     * UI から呼ばれる「手動取り込み」エントリ.
     * 1 RequestDoc だけ作成し、Workflow に処理を委ねる。
     */
    async startManualDriveImport(params: {
      organizationId: string;
      spaceId: string;
      fileSpaceId: string;
      rootFolderId: string;
      importIds: string[];
      removeIds: string[];
      fileItems?: DriveImportFileItemSource[];
    }): Promise<DecodedGoogleDriveSyncRequest | null> {
      if (this.isSyncInProgress || this.activeImportSession.phase === "running") {
        log("INFO", "startManualDriveImport skipped: import already running");
        return null;
      }

      const created = await this.createSyncRequest({
        operationType: "syncFolder",
        rootFolderId: params.rootFolderId,
        targetFolderId: null,
        fileSpaceId: params.fileSpaceId,
        description: "手動取り込み (ナレッジ素材)",
        organizationId: params.organizationId,
        spaceId: params.spaceId,
        importCount: params.importIds.length,
        removeCount: params.removeIds.length,
        importIds: params.importIds,
        removeIds: params.removeIds,
        fileItemSources: params.fileItems,
      });
      if (!created) return null;

      const fileItems =
        params.fileItems && params.fileItems.length > 0
          ? buildInitialFileItemsMap({ sources: params.fileItems })
          : buildInitialFileItemsMap({
              importIds: params.importIds,
              removeIds: params.removeIds,
            });

      this.activeSyncRequestId = created.id;
      this.activeImportSession = {
        ...projectRequestToSession(created, null),
        fileItems: Object.values(fileItems ?? {}),
      };
      this.lastTerminalSyncNotice = null;
      this.driveHeaderCompletedFlashUntil = null;
      this.openImportProgressModal();
      return created;
    },

    /**
     * 後方互換のために残す名称。差分プレビュー結果から手動取り込みをキック.
     */
    async triggerImportFromDrive(params: {
      organizationId: string;
      spaceId: string;
      fileSpaceId: string;
      rootFolderId: string;
    }): Promise<boolean> {
      const importIds = [...this.pendingScan.importFileIds];
      const removeIds = [...this.pendingScan.removeFileIds];

      if (importIds.length === 0 && removeIds.length === 0) {
        if (this.pendingImportCount > 0) {
          // importIds が空 (=ファイル ID が分からない) のときは Workflow に
          // 「全件再走査」を任せる: importIds=removeIds=[] のままで kicker に渡す。
          const fallback = await this.startManualDriveImport({
            ...params,
            importIds: [],
            removeIds: [],
          });
          return Boolean(fallback);
        }
        return false;
      }

      const created = await this.startManualDriveImport({
        ...params,
        importIds,
        removeIds,
        fileItems: [...this.pendingScan.fileItems],
      });
      return Boolean(created);
    },

    /**
     * Web 取り込み完了直後の自動同期 (backend webCrawler から呼ぶ用に互換的な
     * API 名称を残しているが、FE からも triggerImportFromDrive 経由で十分)
     */
    async triggerFolderSync(params: {
      organizationId: string;
      spaceId: string;
      fileSpaceId: string;
      rootFolderId: string;
      description: string;
    }): Promise<DecodedGoogleDriveSyncRequest | null> {
      if (this.isSyncInProgress) {
        log("INFO", "triggerFolderSync skipped: sync already in progress");
        return null;
      }

      const created = await this.createSyncRequest({
        operationType: "syncFolder",
        rootFolderId: params.rootFolderId,
        targetFolderId: null,
        fileSpaceId: params.fileSpaceId,
        description: params.description,
        organizationId: params.organizationId,
        spaceId: params.spaceId,
        importCount: 0,
        removeCount: 0,
      });

      if (created) {
        this.activeSyncRequestId = created.id;
        this.activeImportSession = projectRequestToSession(created, null);
      }
      return created;
    },

    /**
     * 素材プール ID が変わったとき linkedFileSpaceId を追随 (同期先ズレ防止)
     */
    async ensureLinkedFileSpaceId(fileSpaceId: string): Promise<void> {
      const current = this.config;
      if (!current?.rootFolderId || current.linkedFileSpaceId === fileSpaceId) {
        return;
      }
      await this.upsertConfig({
        rootFolderId: current.rootFolderId,
        rootFolderName: current.rootFolderName ?? null,
        serviceAccountEmail: current.serviceAccountEmail,
        linkedFileSpaceId: fileSpaceId,
      });
    },

    buildOperationMetadata(params: {
      organizationId: string;
      spaceId: string;
      requestId: string;
    }) {
      const adminUserStore = useAdminUserStore();
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser?.email) {
        throw new Error("User not authenticated");
      }
      return RequestMetadataSchema.parse({
        organizationId: params.organizationId,
        spaceId: params.spaceId,
        loggingCollectionId: REQUESTS_SUBPATH,
        loggingDocumentId: params.requestId,
        requestedBy: {
          userId: currentUser.uid,
          email: currentUser.email,
          role: adminUserStore.rbacRole || 3,
        },
        isCommand: true,
        isOouiCrud: false,
        isLlmCall: false,
        isAdminCrud: adminUserStore.isAdminOrAbove,
      });
    },

    buildDriveScanRequestBody(params: {
      organizationId: string;
      spaceId: string;
      fileSpaceId: string;
      rootFolderId: string;
      requestId: string;
    }) {
      // drive-to-gcs-sync /scan/list-folder のリクエスト形式
      // (Workflows と FE 双方で同じ shape を投げる)
      return {
        rootFolderId: params.rootFolderId,
        targetFolderId: params.rootFolderId,
        recursive: true,
      };
    },

    applyPendingScanCounts(
      generation: number,
      counts: DrivePendingDiffResult,
      context: {
        driveFiles: DriveListFile[];
        existingDocs?: FirestoreDriveDoc[];
      }
    ): void {
      if (generation !== this.pendingScanGeneration) return;
      this.pendingScan = {
        phase: "ready",
        addedCount: counts.addedCount,
        updatedCount: counts.updatedCount,
        removedCount: counts.removedCount,
        skippedCount: counts.skippedCount,
        importFileIds: counts.importFileIds,
        removeFileIds: counts.removeFileIds,
        fileItems: buildPendingScanFileItems({
          importFileIds: counts.importFileIds,
          removeFileIds: counts.removeFileIds,
          driveFiles: context.driveFiles,
          existingDocs: context.existingDocs,
        }),
        errorMessage: null,
        scannedAt: Date.now(),
      };
    },

    async scanPendingDriveFiles(params: {
      organizationId: string;
      spaceId: string;
      fileSpaceId: string;
      rootFolderId: string;
      existingDocs?: FirestoreDriveDoc[];
    }): Promise<boolean> {
      if (!params.rootFolderId || !params.fileSpaceId) return false;

      this.pendingScanAbortController?.abort();
      const abortController = new AbortController();
      this.pendingScanAbortController = abortController;

      const generation = ++this.pendingScanGeneration;

      void this.ensureLinkedFileSpaceId(params.fileSpaceId);

      this.pendingScan = {
        phase: "scanning",
        addedCount: 0,
        updatedCount: 0,
        removedCount: 0,
        skippedCount: 0,
        importFileIds: [],
        removeFileIds: [],
        fileItems: [],
        errorMessage: null,
        scannedAt: null,
      };

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, DRIVE_SCAN_TIMEOUT_MS);

      try {
        const baseUrl = getDriveToGcsSyncServiceUrl();
        const requestId = `preview_${Date.now()}_${createRandomId()}`;
        const body = this.buildDriveScanRequestBody({
          ...params,
          requestId,
        });

        type ScanApiResponse = {
          status?: string;
          files?: DriveListFile[];
          fileCount?: number;
          rootFolderId?: string;
          targetFolderId?: string | null;
          error?: { message?: string } | string;
        };

        const fetchOpts = {
          method: "POST" as const,
          body,
          signal: abortController.signal,
        };

        let counts: DrivePendingDiffResult | null = null;
        let scannedFiles: DriveListFile[] = [];
        let lastListErr: unknown = null;

        for (let attempt = 0; attempt < DRIVE_SCAN_MAX_ATTEMPTS; attempt++) {
          if (abortController.signal.aborted) break;
          try {
            const listRes = await $fetch<ScanApiResponse>(
              `${baseUrl}/scan/list-folder`,
              fetchOpts
            );
            if (listRes?.status === "error" || listRes?.error) {
              const errMsg =
                typeof listRes.error === "string"
                  ? listRes.error
                  : listRes.error?.message;
              throw new Error(errMsg ?? "Drive 一覧の取得に失敗しました");
            }
            scannedFiles = listRes?.files ?? [];
            if (params.existingDocs) {
              counts = computeDrivePendingDiff({
                driveFiles: scannedFiles,
                existingDocs: params.existingDocs,
                fileSpaceId: params.fileSpaceId,
              });
            }
            lastListErr = null;
            break;
          } catch (listErr) {
            lastListErr = listErr;
            if (abortController.signal.aborted) {
              throw listErr;
            }
            const retryable = isRetryableDriveScanError(listErr);
            if (!retryable || attempt >= DRIVE_SCAN_MAX_ATTEMPTS - 1) {
              const listMsg =
                extractDriveSyncFetchErrorMessage(listErr) ??
                (listErr instanceof Error ? listErr.message : String(listErr));
              const likelyCors =
                /failed to fetch|networkerror|cors|access control/i.test(
                  listMsg
                );
              if (likelyCors) {
                throw new Error(
                  "Drive 一覧 API に接続できません。しばらく待って「再検索」を押すか、ネットワークを確認してください。"
                );
              }
              throw new Error(listMsg);
            }
            await sleepMs(1000 * (attempt + 1));
          }
        }

        if (lastListErr) {
          throw lastListErr;
        }

        if (!counts) {
          counts = {
            addedCount: 0,
            updatedCount: 0,
            removedCount: 0,
            skippedCount: 0,
            importFileIds: [],
            removeFileIds: [],
          };
          log(
            "WARN",
            "scanPendingDriveFiles: no existingDocs supplied; treating as empty diff"
          );
        }

        if (generation !== this.pendingScanGeneration) return false;

        this.applyPendingScanCounts(generation, counts, {
          driveFiles: scannedFiles,
          existingDocs: params.existingDocs,
        });
        return true;
      } catch (e) {
        if (generation !== this.pendingScanGeneration) return false;

        const aborted =
          abortController.signal.aborted ||
          (e instanceof Error && e.name === "AbortError");
        const parsed =
          !aborted ? extractDriveSyncFetchErrorMessage(e) : null;
        const msg = aborted
          ? "未取り込みファイルの確認がタイムアウトしました。再検索してください。"
          : parsed ??
            (e instanceof Error
              ? e.message
              : "未取り込みファイルの確認に失敗しました");

        log("ERROR", "scanPendingDriveFiles failed", e);
        this.pendingScan = {
          phase: "error",
          addedCount: 0,
          updatedCount: 0,
          removedCount: 0,
          skippedCount: 0,
          importFileIds: [],
          removeFileIds: [],
          fileItems: [],
          errorMessage: msg,
          scannedAt: Date.now(),
        };
        return false;
      } finally {
        clearTimeout(timeoutId);
        if (this.pendingScanAbortController === abortController) {
          this.pendingScanAbortController = null;
        }
      }
    },

    /**
     * Drive 同期 RequestDoc を 1 件発行。trigger Function が kicker microservice に
     * 渡し、kicker が importIds/removeIds を GCS YAML 化して Workflow を起動する。
     */
    async createSyncRequest(
      params: GoogleDriveSyncInput & {
        organizationId: string;
        spaceId: string;
        importIds?: string[];
        removeIds?: string[];
        fileItemSources?: DriveImportFileItemSource[];
      }
    ): Promise<DecodedGoogleDriveSyncRequest | null> {
      this.isCreatingRequest = true;
      this.createRequestError = null;
      try {
        const firestoreOps = useFirestoreDocOperation();
        const contextStore = useContextStore();
        const adminUserStore = useAdminUserStore();
        const auth = getAuth();

        const currentUser = auth.currentUser;
        if (!currentUser || !currentUser.email) {
          throw new Error("User not authenticated");
        }

        const requestId = `driveSync_${Date.now()}_${createRandomId()}`;

        const operationMetadata = RequestMetadataSchema.parse({
          organizationId: params.organizationId,
          spaceId: params.spaceId,
          loggingCollectionId: REQUESTS_SUBPATH,
          loggingDocumentId: requestId,
          requestedBy: {
            userId: currentUser.uid,
            email: currentUser.email,
            role: adminUserStore.rbacRole || 3,
          },
          isCommand: true,
          isOouiCrud: false,
          isLlmCall: false,
          isAdminCrud: adminUserStore.isAdminOrAbove,
        });

        const importCount = params.importCount ?? 0;
        const removeCount = params.removeCount ?? 0;
        const initialSeed = buildInitialDriveSyncRequestSeed({
          importCount,
          removeCount,
        });

        const requestData: Record<string, unknown> = {
          input: {
            operationType: params.operationType,
            rootFolderId: params.rootFolderId,
            targetFolderId: params.targetFolderId ?? null,
            fileSpaceId: params.fileSpaceId,
            description: params.description ?? null,
            inputArtifactUri: null,
            importCount,
            removeCount,
          },
          operationMetadata,
          status: "pending" as const,
          errorMessage: null,
          workflow: null,
          progress: initialSeed.progress,
          steps: initialSeed.steps,
          uiFlow: initialSeed.uiFlow,
          stepLogs: {},
          mirror: null,
          register: null,
        };

        // importIds / removeIds は kicker microservice が GCS YAML に書き出す。
        // RequestDoc には Firestore 1MB 制限を避けるため最低限のメタ情報のみ。
        // 一時的に Doc に同居させて trigger から拾えるようにする。
        if (params.importIds?.length || params.removeIds?.length) {
          requestData._kickerPayload = {
            importIds: params.importIds ?? [],
            removeIds: params.removeIds ?? [],
          };
          requestData.fileItems = buildInitialFileItemsMap({
            sources: params.fileItemSources,
            importIds: params.importIds ?? [],
            removeIds: params.removeIds ?? [],
          });
        }

        const collectionPath = contextStore.baseFirestorePath(REQUESTS_SUBPATH);
        const created =
          await firestoreOps.createDocument<DecodedGoogleDriveSyncRequest>({
            collectionName: collectionPath,
            docId: requestId,
            docData: requestData,
            converter: googleDriveSyncRequestConverter,
          });

        if (created) {
          this.snapshotWatchingRequests.set(requestId, {
            ...created,
            createdAt: created.createdAt || Timestamp.now(),
            updatedAt: created.updatedAt || Timestamp.now(),
          });
          return created;
        }
        this.createRequestError = "同期リクエスト作成失敗";
        return null;
      } catch (e) {
        this.createRequestError = "同期リクエスト作成に失敗";
        log("ERROR", "createSyncRequest failed", e);
        return null;
      } finally {
        this.isCreatingRequest = false;
      }
    },

    addWatchingRequest(
      requestId: string,
      data: DecodedGoogleDriveSyncRequest
    ): void {
      this.snapshotWatchingRequests.set(requestId, data);
      if (
        requestId === this.activeSyncRequestId ||
        requestId === this.activeImportSession.requestId
      ) {
        this.applyActiveImportSession(data);
      }
      void this.handleSyncRequestTerminal(data);
    },

    updateWatchingRequest(
      requestId: string,
      data: DecodedGoogleDriveSyncRequest
    ): void {
      this.snapshotWatchingRequests.set(requestId, data);
      if (
        requestId === this.activeSyncRequestId ||
        requestId === this.activeImportSession.requestId
      ) {
        this.applyActiveImportSession(data);
      }
      void this.handleSyncRequestTerminal(data);
    },

    fetchWatchingRequest(
      requestId: string
    ): DecodedGoogleDriveSyncRequest | null {
      return this.snapshotWatchingRequests.get(requestId) || null;
    },
  },
});
