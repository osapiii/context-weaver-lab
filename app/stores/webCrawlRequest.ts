import { defineStore } from "pinia";
import log from "@utils/logger";
import { getAuth } from "firebase/auth";
import createRandomId from "@utils/createRandomDocId";
import { useFirestoreDocOperation } from "@composables/firestore-doc-operation";
import {
  webCrawlRequestConverter,
  WebCrawlRequestSchema,
  type DecodedWebCrawlRequest,
  type WebCrawlInput,
  type WebCrawlImportFolder,
} from "@models/webCrawlRequest";
import { Timestamp } from "firebase/firestore";
import { RequestMetadataSchema } from "@models/core/operationMetadata";
import { useContextStore } from "./context";
import { useAdminUserStore } from "./admin-user";
import { buildInitialWebCrawlRequestSeed } from "@utils/buildInitialWebCrawlRequestDoc";
import {
  createIdleWebCrawlIngestSession,
  projectWebCrawlRequestToSession,
} from "@utils/webCrawlSession";
import { isWebCrawlCancelled, isWebCrawlPipelineActive, isWebCrawlTerminal } from "@utils/webCrawlTerminal";
import { getWebCrawlWorkflowKickerUrl } from "@utils/webCrawlServiceUrl";
import { resolveWebCrawlImportFolder } from "@utils/webCrawlImportFolder";

const REQUESTS_SUBPATH = "requests/webCrawlRequests/logs";
const COMPLETED_FLASH_MS = 8_000;

export type WebCrawlTerminalNotice = {
  ok: boolean;
  title: string;
  description: string;
};

export const useWebCrawlRequestStore = defineStore("webCrawlRequest", {
  state: () => ({
    snapshotWatchingRequests: new Map<string, DecodedWebCrawlRequest>(),
    isLoading: false,
    crudError: null as string | null,
    fetchedRequest: null as DecodedWebCrawlRequest | null,
    recentRequests: [] as DecodedWebCrawlRequest[],

    activeIngestRequestId: null as string | null,
    activeIngestSession: createIdleWebCrawlIngestSession(),
    ingestProgressModalOpen: false,
    footerCompletedFlashUntil: null as number | null,
    processedTerminalRequestIds: new Set<string>(),
    lastTerminalIngestNotice: null as WebCrawlTerminalNotice | null,
    createRequestError: null as string | null,
    isCancellingIngest: false,
  }),

  getters: {
    watchingRequestsCount: (state) => state.snapshotWatchingRequests.size,
    allWatchingRequests: (state) =>
      Array.from(state.snapshotWatchingRequests.values()),
    importFolders: (state): WebCrawlImportFolder[] => {
      const folders = new Map<string, WebCrawlImportFolder>();
      for (const request of state.recentRequests) {
        const folder = resolveWebCrawlImportFolder(request);
        const existing = folders.get(folder.id);
        folders.set(folder.id, {
          ...folder,
          description: existing?.description ?? folder.description ?? null,
        });
      }
      return Array.from(folders.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "ja")
      );
    },
    isIngestRunning: (state) => state.activeIngestSession.phase === "running",
    activeWatchingRequest(state): DecodedWebCrawlRequest | null {
      const id = state.activeIngestRequestId;
      if (!id) return null;
      return state.snapshotWatchingRequests.get(id) ?? null;
    },
  },

  actions: {
    openIngestProgressModal(): void {
      this.ingestProgressModalOpen = true;
    },

    closeIngestProgressModal(): void {
      this.ingestProgressModalOpen = false;
    },

    clearFooterCompletedFlash(): void {
      this.footerCompletedFlashUntil = null;
    },

    applyActiveIngestSession(request: DecodedWebCrawlRequest): void {
      if (
        this.activeIngestSession.requestId &&
        this.activeIngestSession.requestId !== request.id
      ) {
        return;
      }
      this.activeIngestSession = projectWebCrawlRequestToSession(
        request,
        this.activeIngestSession
      );
    },

    async handleIngestRequestTerminal(
      request: DecodedWebCrawlRequest
    ): Promise<void> {
      if (this.processedTerminalRequestIds.has(request.id)) return;
      if (!isWebCrawlTerminal(request)) return;

      this.processedTerminalRequestIds.add(request.id);

      if (request.id === this.activeIngestRequestId) {
        this.activeIngestRequestId = null;
      }

      if (this.activeIngestSession.requestId === request.id) {
        this.activeIngestSession = projectWebCrawlRequestToSession(
          request,
          this.activeIngestSession
        );
      }

      const cancelled = isWebCrawlCancelled(request);
      const ok = request.status === "completed" && !cancelled;
      const pages =
        request.output?.markdownCount ??
        request.output?.totalPages ??
        0;
      this.lastTerminalIngestNotice = {
        ok,
        title: cancelled
          ? "取り込みをキャンセルしました"
          : ok
            ? "Web ページの取り込みが完了しました"
            : "取り込みに失敗しました",
        description: cancelled
          ? "進行中の Workflow を停止しました。必要なら再度取り込みを開始してください"
          : ok
            ? `${pages} ページを AI に登録しました。ヘッダーからいつでも結果を確認できます`
            : request.errorMessage ?? "エラーが発生しました",
      };

      if (ok) {
        this.footerCompletedFlashUntil = Date.now() + COMPLETED_FLASH_MS;
      }
    },

    async recoverActiveIngestRequest(): Promise<void> {
      if (this.activeIngestRequestId) return;

      const contextStore = useContextStore();
      try {
        const firestoreOps = useFirestoreDocOperation();
        const collectionPath = contextStore.organizationFirestorePath(
          REQUESTS_SUBPATH
        );
        const recent =
          await firestoreOps.getDocumentsWithQueryAndConverter<DecodedWebCrawlRequest>(
            {
              collectionName: collectionPath,
              converter: webCrawlRequestConverter,
              orderBy: { field: "createdAt", direction: "desc" },
              limit: 6,
            }
          );

        const active = recent.find(
          (doc) =>
            doc.status === "pending" ||
            doc.status === "processing" ||
            doc.workflow?.state === "ACTIVE"
        );
        if (!active) return;

        this.snapshotWatchingRequests.set(active.id, active);
        this.activeIngestRequestId = active.id;
        this.activeIngestSession = projectWebCrawlRequestToSession(
          active,
          this.activeIngestSession
        );
        log("INFO", "recoverActiveIngestRequest restored", {
          requestId: active.id,
        });
      } catch (e) {
        log("WARN", "recoverActiveIngestRequest failed", e);
      }
    },

    addWatchingWebCrawlRequest(
      requestId: string,
      requestData: DecodedWebCrawlRequest
    ): void {
      this.snapshotWatchingRequests.set(requestId, requestData);
      if (
        requestId === this.activeIngestRequestId ||
        requestId === this.activeIngestSession.requestId
      ) {
        this.applyActiveIngestSession(requestData);
      }
      void this.handleIngestRequestTerminal(requestData);
    },

    updateWatchingWebCrawlRequestByRequestId(
      requestId: string,
      requestData: DecodedWebCrawlRequest
    ): void {
      this.snapshotWatchingRequests.set(requestId, requestData);
      if (
        requestId === this.activeIngestRequestId ||
        requestId === this.activeIngestSession.requestId
      ) {
        this.applyActiveIngestSession(requestData);
      }
      void this.handleIngestRequestTerminal(requestData);
    },

    deleteWatchingWebCrawlRequestByRequestId(requestId: string): void {
      this.snapshotWatchingRequests.delete(requestId);
    },

    fetchWatchingWebCrawlRequestByRequestId(
      requestId: string
    ): DecodedWebCrawlRequest | null {
      return this.snapshotWatchingRequests.get(requestId) || null;
    },

    async createWebCrawlRequest(
      params: WebCrawlInput & {
        organizationId: string;
        spaceId: string;
        importFolder: WebCrawlImportFolder;
      }
    ): Promise<DecodedWebCrawlRequest | null> {
      this.isLoading = true;
      this.crudError = null;
      this.createRequestError = null;

      try {
        const firestoreOps = useFirestoreDocOperation();
        const adminUserStore = useAdminUserStore();
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser?.email) {
          throw new Error("User not authenticated");
        }

        const requestId = `webCrawl_${Date.now()}_${createRandomId()}`;
        const initialSeed = buildInitialWebCrawlRequestSeed();

        const operationMetadata = RequestMetadataSchema.parse({
          organizationId: params.organizationId,
          spaceId: params.spaceId,
          loggingCollectionId: "requests/webCrawlRequests/logs",
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

        const requestData = {
          input: {
            url: params.url,
            bucketName: params.bucketName,
            folderPath: params.folderPath,
            maxDepth: params.maxDepth,
            maxUrls: params.maxUrls,
            fileSpaceId: params.fileSpaceId,
            description: params.description || null,
            includeImages: params.includeImages ?? true,
            inputArtifactUri: null,
          },
          operationMetadata,
          status: "pending" as const,
          errorMessage: null,
          workflow: null,
          progress: initialSeed.progress,
          steps: initialSeed.steps,
          uiFlow: initialSeed.uiFlow,
          uiMetadata: {
            importFolder: params.importFolder,
          },
          stepLogs: {},
        };

        const parsed = WebCrawlRequestSchema.safeParse(requestData);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          const detail = first
            ? `${first.path.join(".")}: ${first.message}`
            : "invalid payload";
          log("ERROR", "createWebCrawlRequest validation failed", {
            detail,
            issues: parsed.error.issues,
          });
          this.crudError = "Failed to create request";
          this.createRequestError = `リクエストデータが不正です (${detail})`;
          return null;
        }

        const contextStore = useContextStore();
        const collectionName = contextStore.organizationFirestorePath(
          REQUESTS_SUBPATH
        );

        const created =
          await firestoreOps.createDocument<DecodedWebCrawlRequest>({
            collectionName,
            docId: requestId,
            docData: parsed.data,
            converter: webCrawlRequestConverter,
          });

        if (!created) {
          this.crudError = "Failed to create request";
          this.createRequestError = "リクエストの作成に失敗しました";
          return null;
        }

        const withTimestamps = {
          ...created,
          createdAt: created.createdAt || Timestamp.now(),
          updatedAt: created.updatedAt || Timestamp.now(),
        };

        this.snapshotWatchingRequests.set(requestId, withTimestamps);
        this.recentRequests = [
          withTimestamps,
          ...this.recentRequests.filter((request) => request.id !== requestId),
        ];
        this.activeIngestRequestId = requestId;
        this.activeIngestSession = projectWebCrawlRequestToSession(
          withTimestamps,
          null
        );
        this.processedTerminalRequestIds.delete(requestId);
        this.lastTerminalIngestNotice = null;
        this.footerCompletedFlashUntil = null;
        this.openIngestProgressModal();

        log("INFO", "WebCrawlRequest created successfully", { requestId });
        return withTimestamps;
      } catch (error) {
        this.crudError = "Failed to create request";
        this.createRequestError = "リクエストの作成に失敗しました";
        log("ERROR", "createWebCrawlRequest error:", error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },

    async fetchRecentRequests(limitCount = 100): Promise<void> {
      try {
        const firestoreOps = useFirestoreDocOperation();
        const contextStore = useContextStore();
        const collectionPath = contextStore.organizationFirestorePath(
          REQUESTS_SUBPATH
        );
        this.recentRequests =
          await firestoreOps.getDocumentsWithQueryAndConverter<DecodedWebCrawlRequest>(
            {
              collectionName: collectionPath,
              converter: webCrawlRequestConverter,
              orderBy: { field: "createdAt", direction: "desc" },
              limit: limitCount,
            }
          );
      } catch (error) {
        log("WARN", "fetchRecentRequests failed", error);
      }
    },

    async updateImportFolder(
      folderId: string,
      patch: { name: string; description?: string | null }
    ): Promise<{ ok: boolean; error?: string }> {
      const name = patch.name.trim();
      if (!folderId || !name) {
        return { ok: false, error: "フォルダ名を入力してください" };
      }

      try {
        const firestoreOps = useFirestoreDocOperation();
        const contextStore = useContextStore();
        const collectionPath = contextStore.organizationFirestorePath(
          REQUESTS_SUBPATH
        );
        const targets = this.recentRequests.filter(
          (request) => resolveWebCrawlImportFolder(request).id === folderId
        );

        await Promise.all(
          targets.map((request) =>
            firestoreOps.updateDocument<DecodedWebCrawlRequest>({
              collectionName: collectionPath,
              docId: request.id,
              docData: {
                ...request,
                uiMetadata: {
                  ...(request.uiMetadata ?? {}),
                  importFolder: {
                    id: folderId,
                    name,
                    description: patch.description?.trim() || null,
                  },
                },
              },
              converter: webCrawlRequestConverter,
            })
          )
        );

        this.recentRequests = this.recentRequests.map((request) =>
          resolveWebCrawlImportFolder(request).id === folderId
            ? {
                ...request,
                uiMetadata: {
                  ...(request.uiMetadata ?? {}),
                  importFolder: {
                    id: folderId,
                    name,
                    description: patch.description?.trim() || null,
                  },
                },
              }
            : request
        );
        return { ok: true };
      } catch (error) {
        log("ERROR", "updateImportFolder failed", { folderId, error });
        return { ok: false, error: "フォルダ情報の更新に失敗しました" };
      }
    },

    async deleteImportFolderRequests(
      folderId: string
    ): Promise<{ ok: boolean; deleted: number; error?: string }> {
      if (!folderId) return { ok: false, deleted: 0, error: "folderId missing" };
      try {
        const firestoreOps = useFirestoreDocOperation();
        const contextStore = useContextStore();
        const collectionPath = contextStore.organizationFirestorePath(
          REQUESTS_SUBPATH
        );
        const targets = this.recentRequests.filter(
          (request) => resolveWebCrawlImportFolder(request).id === folderId
        );
        const results = await Promise.all(
          targets.map((request) =>
            firestoreOps.deleteDocument({
              collectionName: collectionPath,
              docId: request.id,
            })
          )
        );
        const deleted = results.filter(Boolean).length;
        this.recentRequests = this.recentRequests.filter(
          (request) => resolveWebCrawlImportFolder(request).id !== folderId
        );
        for (const request of targets) {
          this.snapshotWatchingRequests.delete(request.id);
        }
        return { ok: true, deleted };
      } catch (error) {
        log("ERROR", "deleteImportFolderRequests failed", { folderId, error });
        return {
          ok: false,
          deleted: 0,
          error: "取り込み履歴の削除に失敗しました",
        };
      }
    },

    async cancelActiveWebCrawlIngest(): Promise<{
      ok: boolean;
      error?: string;
    }> {
      const request = this.activeWatchingRequest;
      if (!request?.id) {
        return { ok: false, error: "取り込みリクエストが見つかりません" };
      }
      if (!isWebCrawlPipelineActive(request)) {
        return { ok: false, error: "進行中の取り込みがありません" };
      }

      const contextStore = useContextStore();
      const collectionPath = contextStore.organizationFirestorePath(
        REQUESTS_SUBPATH
      );
      const requestPath = `${collectionPath}/${request.id}`;

      this.isCancellingIngest = true;
      try {
        const response = await fetch(
          `${getWebCrawlWorkflowKickerUrl()}/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestPath,
              requestId: request.id,
              executionName: request.workflow?.executionName ?? null,
            }),
          }
        );

        const payload = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
          status?: string;
        };

        if (!response.ok) {
          const message =
            payload.error?.message ??
            `キャンセルに失敗しました (HTTP ${response.status})`;
          return { ok: false, error: message };
        }

        await this.updateFetchedWebCrawlRequestById(request.id);
        const refreshed = this.fetchedRequest;
        if (refreshed) {
          this.updateWatchingWebCrawlRequestByRequestId(request.id, refreshed);
        }

        return { ok: true };
      } catch (error) {
        log("ERROR", "cancelActiveWebCrawlIngest failed", error);
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "キャンセル要求に失敗しました",
        };
      } finally {
        this.isCancellingIngest = false;
      }
    },

    async updateFetchedWebCrawlRequestById(requestId: string): Promise<void> {
      this.isLoading = true;
      this.crudError = null;

      try {
        const { getSingleDocumentById } = useFirestoreDocOperation();
        const contextStore = useContextStore();
        const collectionPath = contextStore.organizationFirestorePath(
          REQUESTS_SUBPATH
        );

        const request =
          await getSingleDocumentById<DecodedWebCrawlRequest>({
            collectionName: collectionPath,
            docId: requestId,
            converter: webCrawlRequestConverter,
          });

        this.fetchedRequest = request;
      } catch (error) {
        this.crudError = "Failed to fetch request";
        this.fetchedRequest = null;
        log("ERROR", "updateFetchedWebCrawlRequestById error:", error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
