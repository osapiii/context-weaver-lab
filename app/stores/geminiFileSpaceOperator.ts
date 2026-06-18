import { defineStore } from "pinia";
import log from "@utils/logger";
import { getAuth } from "firebase/auth";
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import createRandomId from "@utils/createRandomDocId";
import {
  isKnowledgePlaceholder,
  extractGeminiDocId,
} from "@utils/knowledge";
import { useFirestoreDocOperation } from "@composables/firestore-doc-operation";
import {
  fileSpaceOperationRequestConverter,
  type DecodedFileSpaceOperationRequest,
  type FileSpaceOperationInput,
  type FileSpace,
  type DecodedFileSpace,
  fileSpaceConverter,
  type Document,
  type DecodedDocument,
  documentConverter,
} from "@models/geminiFileSpaceRequest";
import { Timestamp } from "firebase/firestore";
import { RequestMetadataSchema } from "@models/core/operationMetadata";
import { useContextStore } from "./context";
import { useAdminUserStore } from "./admin-user";
import { useOrganizationStore } from "./organization";
import { useSpaceStore } from "./space";
import { manualUploadRelativePath } from "@utils/knowledgeStoragePaths";

/** チャット接続の合計最大ファイル数 */
const MAX_TOTAL_FILES_FOR_CHAT = 10;

/**
 * Gemini File Space Operator Store
 *
 * RequestDocアーキテクチャに準拠したPinia Store実装
 * fileSpaceCreateとfileSpaceListの両方のoperationTypeに対応
 */
export const useGeminiFileSpaceOperatorStore = defineStore(
  "geminiFileSpaceOperator",
  {
    state: () => ({
      /**
       * 現在監視中のRequestDoc一覧
       * 型: Map<string, DecodedFileSpaceOperationRequest>
       * Key: requestId, Value: RequestDoc
       */
      snapshotWatchingRequests: new Map<
        string,
        DecodedFileSpaceOperationRequest
      >(),

      /**
       * ローディング状態（CRUD操作時）
       * 型: boolean
       */
      isLoading: false,

      /**
       * CRUDエラー（UI表示用）
       * 型: string | null
       */
      crudError: null as string | null,

      /**
       * 一時的に取得したRequestDoc（単一）
       * 用途: onMountedでの初期表示、履歴詳細表示、一時的な参照など
       * リアルタイム監視が不要な場合に使用
       * 型: DecodedFileSpaceOperationRequest | null
       */
      fetchedRequest: null as DecodedFileSpaceOperationRequest | null,

      /**
       * FileSpace一覧
       * fileSpaceListのRequestDocのoutputから取得したFileSearchStore一覧
       * 型: FileSpace[]
       */
      fileSpaces: [] as FileSpace[],

      /**
       * 選択中のFileSpace
       * 型: FileSpace | null
       */
      selectedFileSpace: null as FileSpace | null,

      /**
       * 選択中のFileSpaceの接続ステータス
       * 型: boolean
       * true: 接続済み（有効）
       * false: 未接続または未確認
       */
      selectedFileSpaceStatusIsValid: false,

      /**
       * チャットで使用する選択中のFileSpace一覧（複数選択可能）
       * 型: FileSpace[]
       * デフォルトでは全FileSpaceが選択される
       */
      selectedFileSpacesForChat: [] as FileSpace[],

      /**
       * FileSpaceの接続ステータスマップ
       * Key: FileSpace.name, Value: boolean（接続済みかどうか）
       */
      fileSpaceStatusMap: new Map<string, boolean>(),

      /**
       * 選択中のFileSpaceのDocument一覧
       * 型: Document[]
       */
      documents: [] as Document[],

      /**
       * Document一覧取得中のローディング状態
       * 型: boolean
       */
      isLoadingDocuments: false,

      /**
       * FileSpaceのDocument数マップ
       * Key: FileSpace.name, Value: Document数
       */
      fileSpaceDocumentCountMap: new Map<string, number>(),
    }),

    getters: {
      /**
       * 監視中のRequestDoc数
       */
      watchingRequestsCount: (state) => state.snapshotWatchingRequests.size,

      /**
       * 監視中の全RequestDoc一覧
       */
      allWatchingRequests: (state) =>
        Array.from(state.snapshotWatchingRequests.values()),

      /**
       * 処理中（processing）のRequestDoc数
       */
      processingRequestsCount: (state) =>
        Array.from(state.snapshotWatchingRequests.values()).filter(
          (req) => req.status === "processing"
        ).length,

      /**
       * 完了（completed）のRequestDoc数
       */
      completedRequestsCount: (state) =>
        Array.from(state.snapshotWatchingRequests.values()).filter(
          (req) => req.status === "completed"
        ).length,

      /**
       * エラー（error）のRequestDoc数
       */
      errorRequestsCount: (state) =>
        Array.from(state.snapshotWatchingRequests.values()).filter(
          (req) => req.status === "error"
        ).length,

      /**
       * 待機中（pending）のRequestDoc数
       */
      pendingRequestsCount: (state) =>
        Array.from(state.snapshotWatchingRequests.values()).filter(
          (req) => req.status === "pending"
        ).length,

      /**
       * FileSpace一覧の数
       */
      fileSpacesCount: (state) => state.fileSpaces.length,
    },

    actions: {
      /**
       * 監視中のRequestDoc一覧に追加
       *
       * @param requestId - 追加するRequestDoc ID
       * @param requestData - RequestDocデータ
       */
      addWatchingFileSpaceRequest(
        requestId: string,
        requestData: DecodedFileSpaceOperationRequest
      ): void {
        if (this.snapshotWatchingRequests.has(requestId)) {
          log("WARN", "Request already exists in watching requests", {
            requestId,
          });
          return;
        }

        this.snapshotWatchingRequests.set(requestId, requestData);

        log("INFO", "Request added to watching requests", {
          requestId,
          status: requestData.status,
          operationType: requestData.input.operationType,
          totalWatching: this.snapshotWatchingRequests.size,
        });
      },

      /**
       * 監視中のRequestDocを更新
       *
       * @param requestId - 更新するRequestDoc ID
       * @param requestData - 新しいRequestDocデータ
       */
      updateWatchingFileSpaceRequestByRequestId(
        requestId: string,
        requestData: DecodedFileSpaceOperationRequest
      ): void {
        if (!this.snapshotWatchingRequests.has(requestId)) {
          log("WARN", "Request not found in watching requests", { requestId });
          return;
        }

        this.snapshotWatchingRequests.set(requestId, requestData);

        log("DEBUG", "Request updated in watching requests", {
          requestId,
          status: requestData.status,
          operationType: requestData.input.operationType,
          updatedAt: requestData.updatedAt,
        });
      },

      /**
       * 監視中のRequestDocを取得
       *
       * @param requestId - 取得するRequestDoc ID
       * @returns RequestDoc | null
       */
      fetchWatchingFileSpaceRequestByRequestId(
        requestId: string
      ): DecodedFileSpaceOperationRequest | null {
        return this.snapshotWatchingRequests.get(requestId) || null;
      },

      /**
       * 監視中のRequestDocを削除
       *
       * @param requestId - 削除するRequestDoc ID
       */
      deleteWatchingFileSpaceRequestByRequestId(requestId: string): void {
        if (!this.snapshotWatchingRequests.has(requestId)) {
          log("WARN", "Request not found in watching requests", { requestId });
          return;
        }

        this.snapshotWatchingRequests.delete(requestId);

        log("INFO", "Request deleted from watching requests", {
          requestId,
          remainingWatching: this.snapshotWatchingRequests.size,
        });
      },

      /**
       * RequestDocを新規作成
       *
       * operationTypeに応じて、fileSpaceCreateまたはfileSpaceListのRequestDocを作成
       *
       * @deprecated fileSpaceList操作タイプは非推奨。代わりにfetchFileSpacesFromFirestore()を使用してください。
       *
       * @param params - 作成パラメータ
       * @returns 作成されたRequestDoc | null
       */
      async createFileSpaceRequest(
        params: FileSpaceOperationInput & {
          organizationId: string;
          spaceId: string;
        }
      ): Promise<DecodedFileSpaceOperationRequest | null> {
        this.isLoading = true;
        this.crudError = null;

        try {
          const firestoreOps = useFirestoreDocOperation();
          const contextStore = useContextStore();
          const adminUserStore = useAdminUserStore();
          const auth = getAuth();

          // 現在のユーザー情報を取得
          const currentUser = auth.currentUser;
          if (!currentUser || !currentUser.email) {
            throw new Error("User not authenticated");
          }

          // ドキュメントID生成
          const requestId = `fileSpace_${params.operationType}_${Date.now()}_${createRandomId()}`;

          log("INFO", "Creating FileSpaceOperationRequest", {
            requestId,
            operationType: params.operationType,
          });

          // operationMetadataを構築
          const operationMetadata = RequestMetadataSchema.parse({
            organizationId: params.organizationId,
            spaceId: params.spaceId,
            loggingCollectionId: "requests/contextStoreRequests/logs",
            loggingDocumentId: requestId,
            requestedBy: {
              userId: currentUser.uid,
              email: currentUser.email,
              role: adminUserStore.rbacRole || 3, // デフォルトは3（利用者）
            },
            isCommand: true,
            isOouiCrud: true,
            isLlmCall: false,
            isAdminCrud: adminUserStore.isAdminOrAbove,
          });

          // RequestDocデータを構築
          // undefinedのフィールドを除外（Firestoreはundefinedを保存できない）
          const inputData: Record<string, unknown> = {
            operationType: params.operationType,
          };

          // operationTypeに応じて必要なフィールドを追加（undefinedの場合は除外）
          if (params.operationType === "fileSpaceCreate") {
            if (params.displayName !== undefined) {
              inputData.displayName = params.displayName;
            }
            if (params.description !== undefined) {
              inputData.description = params.description;
            }
            if (params.fileSpaceType !== undefined) {
              inputData.fileSpaceType = params.fileSpaceType;
            }
          } else if (params.operationType === "fileSpaceGet") {
            inputData.storeId = params.storeId;
          } else if (params.operationType === "fileSpaceUpload") {
            inputData.storeId = params.storeId;
            inputData.bucketName = params.bucketName;
            inputData.filePath = params.filePath;
            if (params.customMetadata !== undefined) {
              inputData.customMetadata = params.customMetadata;
            }
            if (params.mimeType !== undefined) {
              inputData.mimeType = params.mimeType;
            }
            if (params.documentId !== undefined) {
              inputData.documentId = params.documentId;
            }
            if (params.description !== undefined) {
              inputData.description = params.description;
            }
            if (params.originalFileInfo !== undefined) {
              inputData.originalFileInfo = params.originalFileInfo;
            }
          } else if (params.operationType === "fileSpaceDocumentList") {
            inputData.storeId = params.storeId;
          } else if (params.operationType === "fileSpaceDelete") {
            inputData.storeId = params.storeId;
            if (params.force !== undefined) {
              inputData.force = params.force;
            }
          } else if (params.operationType === "documentDelete") {
            inputData.storeId = params.storeId;
            inputData.documentId = params.documentId;
          }

          const requestData = {
            input: inputData,
            operationMetadata,
            output: null,
            status: "pending" as const,
            logs: [],
          };

          // ✅ CORRECT: Context Store の baseFirestorePath を使用（space配下）
          const collectionName = contextStore.baseFirestorePath(
            "requests/contextStoreRequests/logs"
          );

          // ✅ CORRECT: Converterで型安全に作成
          const createdRequest =
            await firestoreOps.createDocument<DecodedFileSpaceOperationRequest>(
              {
                collectionName,
                docId: requestId,
                docData: requestData,
                converter: fileSpaceOperationRequestConverter,
              }
            );

          if (createdRequest) {
            log("INFO", "FileSpaceOperationRequest created successfully", {
              requestId,
              operationType: params.operationType,
            });
            return createdRequest;
          } else {
            this.crudError = "Failed to create request";
            return null;
          }
        } catch (error) {
          this.crudError = "Failed to create request";
          log("ERROR", "createFileSpaceRequest error:", error);
          return null;
        } finally {
          this.isLoading = false;
        }
      },

      /**
       * requestIdで単一RequestDocを直接取得し、fetchedRequestに格納
       *
       * @param requestId - 取得するRequestDoc ID
       * @returns Promise<void> (結果はfetchedRequest stateに格納)
       */
      async updateFetchedFileSpaceRequestById(
        requestId: string
      ): Promise<void> {
        this.isLoading = true;
        this.crudError = null;

        try {
          const firestoreOps = useFirestoreDocOperation();
          const contextStore = useContextStore();

          log("INFO", "Fetching FileSpaceOperationRequest by ID", {
            requestId,
          });

          // ✅ CORRECT: Context Store の baseFirestorePath を使用（space配下）
          const collectionName = contextStore.baseFirestorePath(
            "requests/contextStoreRequests/logs"
          );

          // ✅ CORRECT: getSingleDocumentByIdで直接取得
          const request =
            await firestoreOps.getSingleDocumentById<DecodedFileSpaceOperationRequest>(
              {
                collectionName,
                docId: requestId,
                converter: fileSpaceOperationRequestConverter,
              }
            );

          if (request) {
            this.fetchedRequest = request;
            log("INFO", "FileSpaceOperationRequest fetched successfully", {
              requestId,
              status: request.status,
              operationType: request.input.operationType,
            });
          } else {
            this.crudError = "Request not found";
            log("WARN", "FileSpaceOperationRequest not found", { requestId });
          }
        } catch (error) {
          this.crudError = "Failed to fetch request";
          log("ERROR", "updateFetchedFileSpaceRequestById error:", error);
        } finally {
          this.isLoading = false;
        }
      },

      /**
       * 全RequestDocを取得（クエリベース）
       *
       * @param params - クエリパラメータ（オプション）
       * @returns RequestDoc配列
       */
      async fetchAllFileSpaceRequests(params?: {
        status?: "pending" | "processing" | "completed" | "error";
        operationType?: "fileSpaceCreate" | "fileSpaceList";
      }): Promise<DecodedFileSpaceOperationRequest[]> {
        this.isLoading = true;
        this.crudError = null;

        try {
          const firestoreOps = useFirestoreDocOperation();
          const contextStore = useContextStore();

          log("INFO", "Fetching all FileSpaceOperationRequests", params);

          // ✅ CORRECT: Context Store の baseFirestorePath を使用（space配下）
          const collectionName = contextStore.baseFirestorePath(
            "requests/contextStoreRequests/logs"
          );

          // whereClausesを構築
          const whereClauses: {
            field: string;
            operator:
              | "=="
              | "!="
              | "<"
              | "<="
              | ">"
              | ">="
              | "in"
              | "array-contains";
            value: string | number | boolean | null;
          }[] = [];

          if (params?.status) {
            whereClauses.push({
              field: "status",
              operator: "==",
              value: params.status,
            });
          }

          if (params?.operationType) {
            whereClauses.push({
              field: "input.operationType",
              operator: "==",
              value: params.operationType,
            });
          }

          // ✅ CORRECT: getDocumentsWithQueryAndConverterで取得
          const requests =
            await firestoreOps.getDocumentsWithQueryAndConverter<DecodedFileSpaceOperationRequest>(
              {
                collectionName,
                converter: fileSpaceOperationRequestConverter,
                whereClauses:
                  whereClauses.length > 0 ? whereClauses : undefined,
              }
            );

          log("INFO", "FileSpaceOperationRequests fetched successfully", {
            count: requests.length,
          });

          return requests;
        } catch (error) {
          this.crudError = "Failed to fetch requests";
          log("ERROR", "fetchAllFileSpaceRequests error:", error);
          return [];
        } finally {
          this.isLoading = false;
        }
      },

      /**
       * FileSpaceを作成する（fileSpaceCreateのRequestDocを作成）
       * RequestDoc作成後、snapshotWatchingRequestsに追加して監視を開始
       * watchEffectで監視し、statusがcompletedになったらFirestoreに永続化
       *
       * @param params - 作成パラメータ
       * @returns 作成されたRequestDoc | null
       */
      async createFileSpace(params: {
        displayName?: string;
        description?: string;
        fileSpaceType?: "system" | "manual"; // 生成タイプ（デフォルト: manual）
        organizationId: string;
        spaceId: string;
      }): Promise<DecodedFileSpaceOperationRequest | null> {
        log("INFO", "Creating FileSpace via fileSpaceCreate", {
          displayName: params.displayName,
          fileSpaceType: params.fileSpaceType || "manual",
        });

        // 既存のcreateFileSpaceRequestメソッドを使用
        const createdRequest = await this.createFileSpaceRequest({
          operationType: "fileSpaceCreate",
          displayName: params.displayName,
          description: params.description,
          fileSpaceType: params.fileSpaceType || "manual", // デフォルト: manual
          organizationId: params.organizationId,
          spaceId: params.spaceId,
        });

        if (createdRequest) {
          log("INFO", "FileSpace creation request created successfully", {
            requestId: createdRequest.id,
          });

          // snapshotWatchingRequestsに追加（監視開始）
          // updateWatchingFileSpaceRequestByRequestIdが呼ばれたときに
          // completedかどうかをチェックし、自動的にFirestoreに永続化される
          this.addWatchingFileSpaceRequest(createdRequest.id, createdRequest);
        } else {
          log("ERROR", "Failed to create FileSpace creation request");
        }

        return createdRequest;
      },

      /**
       * RequestDocのoutputからFileSpace情報を抽出し、Firestoreに永続化
       *
       * @param request - fileSpaceCreateのRequestDoc
       * @param organizationId - Organization ID
       * @param spaceId - Space ID
       */
      async persistFileSpaceToFirestore(
        request: DecodedFileSpaceOperationRequest,
        organizationId: string,
        spaceId: string
      ): Promise<void> {
        try {
          // fileSpaceCreateのRequestDocかチェック
          if (request.input.operationType !== "fileSpaceCreate") {
            log("WARN", "Request is not fileSpaceCreate", {
              operationType: request.input.operationType,
            });
            return;
          }

          // outputが存在し、completed状態かチェック
          if (!request.output || request.status !== "completed") {
            log("DEBUG", "Request output not available or not completed", {
              status: request.status,
              hasOutput: !!request.output,
            });
            return;
          }

          // output構造からFileSpace情報を抽出
          // 実際のoutput構造: フラットな構造（responseでラップされていない）
          // {
          //   "name": "...",
          //   "displayName": "...",
          //   "createTime": "...",
          //   "updateTime": "..."
          // }
          const output = request.output;
          if (!output || typeof output !== "object" || !("name" in output)) {
            log("WARN", "Invalid output structure for fileSpaceCreate", {
              requestId: request.id,
              output,
            });
            return;
          }

          const fileSpaceOutput = output as {
            name: string | null;
            displayName: string | null;
            createTime?: string | null;
            updateTime?: string | null;
          };

          if (!fileSpaceOutput.name) {
            log("WARN", "FileSpace name is missing in output", {
              requestId: request.id,
            });
            return;
          }

          // nameフィールドからID部分を抽出
          // 例: "fileSearchStores/p11xouuo0mpz-0eyhd79lgr9d" → "p11xouuo0mpz-0eyhd79lgr9d"
          const nameParts = fileSpaceOutput.name.split("/");
          const fileSpaceId =
            nameParts.length > 1
              ? nameParts[nameParts.length - 1]
              : fileSpaceOutput.name;

          if (!fileSpaceId) {
            log("WARN", "Failed to extract FileSpace ID from name", {
              requestId: request.id,
              name: fileSpaceOutput.name,
            });
            return;
          }

          const firestoreOps = useFirestoreDocOperation();
          const contextStore = useContextStore();

          // Firestoreに永続化
          const collectionName = contextStore.baseFirestorePath("fileSpaces");

          // RequestDocのinputからdisplayName、description、fileSpaceTypeを取得
          const displayName = request.input.displayName || null;
          const description = request.input.description || null;
          const fileSpaceType = request.input.fileSpaceType || "manual"; // デフォルト: manual

          // outputからcreateTimeとupdateTimeを取得（Gemini APIから返された値を使用）
          const createTime =
            fileSpaceOutput.createTime ||
            request.createdAt.toDate().toISOString();
          const updateTime =
            fileSpaceOutput.updateTime ||
            request.updatedAt.toDate().toISOString();

          const fileSpaceData = {
            name: fileSpaceOutput.name,
            agentSearchDatastorePath:
              (fileSpaceOutput as { agentSearchDatastorePath?: string })
                .agentSearchDatastorePath || fileSpaceOutput.name,
            indexBackend: "agent_search" as const,
            displayName: displayName,
            description: description,
            createTime: createTime,
            updateTime: updateTime,
            fileSpaceType: fileSpaceType, // 生成タイプ（system or manual）
            organizationId,
            spaceId,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
          };

          const persistedFileSpace =
            await firestoreOps.createDocument<DecodedFileSpace>({
              collectionName,
              docId: fileSpaceId,
              docData: fileSpaceData,
              converter: fileSpaceConverter,
            });

          if (persistedFileSpace) {
            log("INFO", "FileSpace persisted to Firestore successfully", {
              requestId: request.id,
              fileSpaceId,
            });

            // fileSpaces stateに追加
            // FileSpace型に変換（APIレスポンス形式）
            const fileSpace: FileSpace = {
              name: persistedFileSpace.name,
              displayName: persistedFileSpace.displayName || null,
              description: persistedFileSpace.description || null,
              createTime: persistedFileSpace.createTime,
              updateTime: persistedFileSpace.updateTime,
              fileSpaceType: persistedFileSpace.fileSpaceType || "manual", // 生成タイプ
            };
            this.fileSpaces.push(fileSpace);
          } else {
            log("ERROR", "Failed to persist FileSpace to Firestore", {
              requestId: request.id,
              fileSpaceId,
            });
            this.crudError = "Failed to persist FileSpace to Firestore";
          }
        } catch (error) {
          log("ERROR", "Failed to persist FileSpace to Firestore", {
            requestId: request.id,
            error,
          });
          this.crudError = "Failed to persist FileSpace to Firestore";
        }
      },

      /**
       * Firestoreから直接FileSpace一覧を取得
       *
       * @returns Promise<void> (結果はfileSpaces stateに格納)
       */
      /**
       * FileSpaceのDocument数を取得（Firestoreから直接カウント）
       *
       * @param storeId - FileSpaceのstoreId
       * @returns Document数
       */
      async getDocumentCount(storeId: string): Promise<number> {
        try {
          const firestoreOps = useFirestoreDocOperation();
          const contextStore = useContextStore();

          if (!storeId) {
            return 0;
          }

          // fileSpaces/{storeId}/documents のサブコレクションから取得
          const collectionName = contextStore.baseFirestorePath(
            `fileSpaces/${storeId}/documents`
          );

          const documents =
            await firestoreOps.getAllDocumentListFromCollectionWithConverter<DecodedDocument>(
              {
                collectionName,
                converter: documentConverter,
              }
            );

          return documents.length;
        } catch (error) {
          log("ERROR", "getDocumentCount error:", error);
          return 0;
        }
      },

      async fetchFileSpacesFromFirestore(): Promise<void> {
        this.isLoading = true;
        this.crudError = null;

        try {
          const firestoreOps = useFirestoreDocOperation();
          const contextStore = useContextStore();
          const organizationStore = useOrganizationStore();
          const spaceStore = useSpaceStore();

          if (
            !organizationStore.getLoggedInOrganizationId ||
            !spaceStore.selectedSpace?.id
          ) {
            this.fileSpaces = [];
            return;
          }

          log("INFO", "Fetching FileSpaces from Firestore");

          const collectionName = contextStore.baseFirestorePath("fileSpaces");

          const fileSpaces =
            await firestoreOps.getAllDocumentListFromCollectionWithConverter<DecodedFileSpace>(
              {
                collectionName,
                converter: fileSpaceConverter,
              }
            );

          // FileSpace型に変換（APIレスポンス形式）
          this.fileSpaces = fileSpaces.map((fs) => ({
            name: fs.name,
            displayName: fs.displayName || null,
            description: fs.description || null,
            createTime: fs.createTime,
            updateTime: fs.updateTime,
            fileSpaceType: fs.fileSpaceType || "manual", // 生成タイプ（デフォルト: manual）
          }));

          // 各FileSpaceのDocument数を並列で取得
          const documentCountPromises = this.fileSpaces.map(async (fs) => {
            if (!fs.name) return;
            const storeId = this.extractStoreId(fs.name);
            if (!storeId) return;
            const count = await this.getDocumentCount(storeId);
            this.fileSpaceDocumentCountMap.set(fs.name, count);
          });

          await Promise.all(documentCountPromises);

          log("INFO", "FileSpaces fetched from Firestore successfully", {
            count: this.fileSpaces.length,
          });
        } catch (error) {
          this.crudError = "Failed to fetch FileSpaces from Firestore";
          log("ERROR", "fetchFileSpacesFromFirestore error:", error);
        } finally {
          this.isLoading = false;
        }
      },

      /**
       * 選択中のFileSpaceを更新
       *
       * @param fileSpaceId - 選択するFileSpaceのID（name）
       */
      setSelectedFileSpace(fileSpaceId: string | null): void {
        if (fileSpaceId === null) {
          this.selectedFileSpace = null;
          this.selectedFileSpaceStatusIsValid = false;
          // Document一覧も初期化
          this.documents = [];
          log("INFO", "Selected FileSpace cleared");
          return;
        }

        // fileSpacesから該当するFileSpaceを検索
        const fileSpace = this.fileSpaces.find(
          (space) => space.name === fileSpaceId
        );

        if (!fileSpace) {
          log("WARN", "FileSpace not found", { fileSpaceId });
          this.selectedFileSpace = null;
          this.selectedFileSpaceStatusIsValid = false;
          // Document一覧も初期化
          this.documents = [];
          return;
        }

        // 同じFileSpaceが選択されている場合は何もしない
        if (this.selectedFileSpace?.name === fileSpace.name) {
          log("DEBUG", "Same FileSpace already selected", { fileSpaceId });
          return;
        }

        // 前のFileSpaceのDocument一覧を初期化
        this.documents = [];
        this.selectedFileSpaceStatusIsValid = false;

        this.selectedFileSpace = fileSpace;
        // 接続ステータスをリセット
        this.selectedFileSpaceStatusIsValid = false;

        log("INFO", "Selected FileSpace updated", {
          fileSpaceId,
          name: fileSpace.name,
        });
      },

      /**
       * FileSpaceの接続確認処理
       * fileSpaceGetのRequestDocを作成してStoreに追加
       * 実際の監視はコンポーネント側でuseGeminiFileSpaceSnapshotを使用して開始する
       *
       * @param fileSpace - 接続確認するFileSpace
       * @returns 作成されたRequestDoc ID（監視開始に使用）
       */
      async checkFileSpaceConnection(
        fileSpace: FileSpace
      ): Promise<string | null> {
        try {
          // fileSpace.nameからstoreIdを抽出
          // 例: "fileSearchStores/w705zpywmey1-7rc9avfyza22" → "w705zpywmey1-7rc9avfyza22"
          const storeId = this.extractStoreId(fileSpace.name);

          if (!storeId) {
            log("WARN", "Failed to extract storeId from fileSpace name", {
              name: fileSpace.name,
            });
            this.selectedFileSpaceStatusIsValid = false;
            return null;
          }

          const organizationStore = useOrganizationStore();
          const spaceStore = useSpaceStore();
          const organizationId = organizationStore.getLoggedInOrganizationId;
          const spaceId = spaceStore.selectedSpace?.id || null;

          if (!organizationId || !spaceId) {
            log("WARN", "Organization or Space not selected", {
              organizationId,
              spaceId,
            });
            this.selectedFileSpaceStatusIsValid = false;
            return null;
          }

          log("INFO", "Starting FileSpace connection check", {
            storeId,
            fileSpaceName: fileSpace.name,
          });

          // fileSpaceGetのRequestDocを作成
          const requestDoc = await this.createFileSpaceRequest({
            operationType: "fileSpaceGet",
            storeId,
            organizationId,
            spaceId,
          });

          if (!requestDoc) {
            log("ERROR", "Failed to create fileSpaceGet request");
            this.selectedFileSpaceStatusIsValid = false;
            return null;
          }

          log("INFO", "FileSpaceGet request created", {
            requestId: requestDoc.id,
            storeId,
          });

          // Storeに追加（コンポーネント側でuseGeminiFileSpaceSnapshotを使用して監視を開始する）
          this.addWatchingFileSpaceRequest(requestDoc.id, requestDoc);

          return requestDoc.id;
        } catch (error) {
          log("ERROR", "Failed to check FileSpace connection", {
            fileSpaceName: fileSpace.name,
            error,
          });
          this.selectedFileSpaceStatusIsValid = false;
          return null;
        }
      },

      /**
       * FileSpaceのnameからstoreIdを抽出
       *
       * @param fileSpaceName - FileSpaceのname（例: "fileSearchStores/w705zpywmey1-7rc9avfyza22"）
       * @returns storeId（例: "w705zpywmey1-7rc9avfyza22"）またはnull
       */
      extractStoreId(fileSpaceName: string | null): string | null {
        if (!fileSpaceName) return null;

        // "fileSearchStores/xxx" または "file_search_stores/xxx" 形式からxxx部分を抽出
        const parts = fileSpaceName.split("/");
        if (parts.length > 1) {
          const storeId = parts[parts.length - 1];
          return storeId || null;
        }
        return fileSpaceName;
      },

      /**
       * 現在のSpaceのFileSpaceを全て取得して、最初のシステム管理（system）のFileSpace IDを返却
       *
       * @returns 最初のシステム管理FileSpaceのstoreId、見つからない場合はnull
       */
      async getFirstSystemManagedFileSpaceId(): Promise<string | null> {
        try {
          // 既にfileSpaces stateにデータがある場合はそれを使用、なければ取得
          if (this.fileSpaces.length === 0) {
            await this.fetchFileSpacesFromFirestore();
          }

          // システム管理（fileSpaceType === 'system'）のFileSpaceをフィルタリング
          const systemFileSpace = this.fileSpaces.find(
            (fs) => fs.fileSpaceType === "system"
          );

          if (!systemFileSpace || !systemFileSpace.name) {
            log("INFO", "No system managed FileSpace found in current Space");
            return null;
          }

          // storeIdを抽出
          const storeId = this.extractStoreId(systemFileSpace.name);

          if (!storeId) {
            log("WARN", "Failed to extract storeId from system FileSpace", {
              name: systemFileSpace.name,
            });
            return null;
          }

          log("INFO", "First system managed FileSpace ID found", {
            storeId,
            displayName: systemFileSpace.displayName,
          });

          return storeId;
        } catch (error) {
          log("ERROR", "Failed to get first system managed FileSpace ID", {
            error,
          });
          return null;
        }
      },

      /**
       * Default (organization 統合) FileSpace の作成リクエストを発行する
       *
       * Phase R-1: 「組織に1つの素材プール」を実現するための entry point。
       * 既存 system タイプの FileSpace があればそれを default とみなす。
       * 無ければ新規作成 RequestDoc を発行 (作成完了は Cloud Run 経由で非同期、
       * 呼び出し元 composable で snapshot watching すること)。
       *
       * @returns
       *   - { storeId, requestId: null }: 既存 default FileSpace あり
       *   - { storeId: null, requestId }: 作成 RequestDoc 発行済 (snapshot watch 必要)
       *   - { storeId: null, requestId: null }: organization/space 未選択 等のエラー
       */
      async ensureDefaultFileSpace(): Promise<{
        storeId: string | null;
        requestId: string | null;
      }> {
        try {
          // 既存 system FileSpace の検索 (内部で fetchFileSpacesFromFirestore あり)
          const existingId = await this.getFirstSystemManagedFileSpaceId();
          if (existingId) {
            log("INFO", "default FileSpace already exists", {
              storeId: existingId,
            });
            return { storeId: existingId, requestId: null };
          }

          // 無ければ新規作成 RequestDoc 発行
          // organization / space は呼び出し元の context から拾う
          const { useOrganizationStore } = await import(
            "@stores/organization"
          );
          const { useSpaceStore } = await import("@stores/space");
          const orgStore = useOrganizationStore();
          const spaceStore = useSpaceStore();
          const organizationId = orgStore.getLoggedInOrganizationId;
          const spaceId = spaceStore.selectedSpace?.id;
          if (!organizationId || !spaceId) {
            log("WARN", "ensureDefaultFileSpace: org/space not selected", {
              organizationId,
              spaceId,
            });
            return { storeId: null, requestId: null };
          }

          const created = await this.createFileSpace({
            displayName: "default",
            description:
              "Organization の統合素材プール (Phase R-1, auto-created)",
            fileSpaceType: "system",
            organizationId,
            spaceId,
          });

          if (!created) {
            log("ERROR", "ensureDefaultFileSpace: createFileSpace returned null");
            return { storeId: null, requestId: null };
          }

          log("INFO", "default FileSpace creation request issued", {
            requestId: created.id,
          });
          return { storeId: null, requestId: created.id };
        } catch (error) {
          log("ERROR", "ensureDefaultFileSpace failed", { error });
          return { storeId: null, requestId: null };
        }
      },

      /**
       * FileSpaceにファイルをアップロード
       *
       * @param params - アップロードパラメータ
       * @returns 作成されたRequestDoc | null
       */
      async uploadFileToFileSpace(params: {
        storeId: string;
        file: File;
        customMetadata?: Array<{ key: string; value: string }>;
        mimeType?: string;
        description?: string;
        organizationId: string;
        spaceId: string;
      }): Promise<DecodedFileSpaceOperationRequest | null> {
        this.isLoading = true;
        this.crudError = null;

        // 旧: `getDocumentCount(storeId) >= 10` で block していたが、件数には
        // Web クロール由来の urlMarkdown も含まれるため、1 回でも web 取り込みを
        // すると以後の手動アップロードが全部「フォルダ満杯」で蹴られる不具合があり
        // ガード自体を撤廃。実態的な上限は Gemini File Search 側に委ねる。

        // globalLoadingを開始
        const { useGlobalLoadingStore } = await import(
          "@stores/global-loading"
        );
        const globalLoading = useGlobalLoadingStore();
        globalLoading.startLoading();

        try {
          const { useFirebaseStorageOperations } = await import(
            "@composables/firebase-storage-operations"
          );
          const { useContextStore } = await import("@stores/context");
          const storageOps = useFirebaseStorageOperations();
          const contextStore = useContextStore();

          // GCSパスを生成（ContextStoreのbaseGcsPathを使用）
          const fileSpaceId = params.storeId;
          const fileName = params.file.name;
          const gcsPath = contextStore.baseGcsPath(
            manualUploadRelativePath({
              fileSpaceId,
              fileName,
            })
          );

          // Firestore documents サブコレクション（メタデータ; GCS パスとは別）
          const firestorePath = contextStore.baseFirestorePath(
            `fileSpaces/${fileSpaceId}/documents/${fileName}`
          );

          log("INFO", "Paths generated for FileSpace upload", {
            fileSpaceId,
            fileName,
            gcsPath,
            firestorePath,
            organizationId: params.organizationId,
            spaceId: params.spaceId,
          });

          // バケット名を取得（runtimeConfigから取得、フォールバックは環境変数）
          const config = useRuntimeConfig();
          const bucketName =
            config.public.firebase.storageBucket ||
            process.env.NUXT_PUBLIC_FIREBASECONFIG_STORAGEBUCKET ||
            "en-aistudio-development.firebasestorage.app";

          log("INFO", "Bucket name resolved for FileSpace upload", {
            bucketName,
            fromConfig: !!config.public.firebase.storageBucket,
            fromEnv: !!process.env.NUXT_PUBLIC_FIREBASECONFIG_STORAGEBUCKET,
          });

          // GCSにファイルをアップロード
          const fileBlob = await params.file.arrayBuffer();
          const uploadSuccess = await storageOps.uploadPdfFile({
            bucketName,
            filePath: gcsPath,
            rawData: new Blob([fileBlob], { type: params.file.type }),
            mimeType: params.mimeType || params.file.type || undefined,
          });

          if (!uploadSuccess) {
            this.crudError = "GCSへのファイルアップロードに失敗しました";
            return null;
          }

          log("INFO", "File uploaded to GCS successfully", {
            bucketName,
            filePath: gcsPath,
          });

          // UIからのアップロードではcustomMetadataを送信しない
          // fileSpaceUploadのRequestDocを作成（firestorePathをそのまま保存）
          // オリジナルファイル情報を取得
          const originalFileInfo = {
            fileName: params.file.name,
            bytes: params.file.size,
          };

          const requestDoc = await this.createFileSpaceRequest({
            operationType: "fileSpaceUpload",
            storeId: params.storeId,
            bucketName,
            filePath: gcsPath,
            customMetadata: undefined, // UIからのアップロードではcustomMetadataを送信しない
            mimeType: params.mimeType || params.file.type || undefined,
            description: params.description || undefined,
            organizationId: params.organizationId,
            spaceId: params.spaceId,
            originalFileInfo, // オリジナルファイル情報を保存
          });

          if (!requestDoc) {
            this.crudError =
              "ファイルアップロードリクエストの作成に失敗しました";
            return null;
          }

          log("INFO", "FileSpaceUpload request created successfully", {
            requestId: requestDoc.id,
            storeId: params.storeId,
          });

          // snapshotWatchingRequestsに追加（監視開始）
          this.addWatchingFileSpaceRequest(requestDoc.id, requestDoc);

          return requestDoc;
        } catch (error) {
          this.crudError = "ファイルアップロードに失敗しました";
          log("ERROR", "uploadFileToFileSpace error:", error);
          // エラー時もglobalLoadingを停止
          globalLoading.stopLoading();
          return null;
        } finally {
          this.isLoading = false;
        }
      },

      /**
       * FileSpaceのDocument一覧を取得（RequestDoc経由）
       *
       * @param storeId - FileSearchStoreのID
       * @param organizationId - Organization ID
       * @param spaceId - Space ID
       * @returns 作成されたRequestDoc | null
       */
      async fetchDocumentList(
        storeId: string,
        organizationId: string,
        spaceId: string
      ): Promise<DecodedFileSpaceOperationRequest | null> {
        this.isLoadingDocuments = true;
        this.crudError = null;

        try {
          log("INFO", "Fetching Document list", {
            storeId,
            organizationId,
            spaceId,
          });

          // fileSpaceDocumentListのRequestDocを作成
          const requestDoc = await this.createFileSpaceRequest({
            operationType: "fileSpaceDocumentList",
            storeId,
            organizationId,
            spaceId,
          });

          if (!requestDoc) {
            this.crudError = "Document一覧取得リクエストの作成に失敗しました";
            return null;
          }

          log("INFO", "FileSpaceDocumentList request created successfully", {
            requestId: requestDoc.id,
            storeId,
          });

          // snapshotWatchingRequestsに追加（監視開始）
          this.addWatchingFileSpaceRequest(requestDoc.id, requestDoc);

          return requestDoc;
        } catch (error) {
          this.crudError = "Document一覧の取得に失敗しました";
          log("ERROR", "fetchDocumentList error:", error);
          return null;
        } finally {
          this.isLoadingDocuments = false;
        }
      },

      /**
       * Firestoreから直接Document一覧を取得
       *
       * @param storeId - FileSearchStoreのID（必須、fileSpaces/{storeId}/documentsから取得）
       * @returns Promise<Document[]> (取得したDocument一覧)
       */
      async fetchDocumentsFromFirestore(storeId: string): Promise<void> {
        this.isLoadingDocuments = true;
        this.crudError = null;

        try {
          const firestoreOps = useFirestoreDocOperation();
          const contextStore = useContextStore();

          if (!storeId) {
            throw new Error(
              "storeId is required for fetchDocumentsFromFirestore"
            );
          }

          log("INFO", "Fetching Documents from Firestore", {
            storeId,
          });

          // fileSpaces/{storeId}/documents のサブコレクションから取得
          const collectionName = contextStore.baseFirestorePath(
            `fileSpaces/${storeId}/documents`
          );

          const documents =
            await firestoreOps.getAllDocumentListFromCollectionWithConverter<DecodedDocument>(
              {
                collectionName,
                converter: documentConverter,
              }
            );

          // DecodedDocumentからDocument型に変換（全フィールドを含む）
          const result: Document[] = documents.map((doc) => ({
            name: doc.name,
            displayName: doc.displayName ?? null,
            description: doc.description ?? null,
            createTime: doc.createTime,
            updateTime: doc.updateTime,
            state: doc.state ?? null,
            sizeBytes: doc.sizeBytes ?? null,
            mimeType: doc.mimeType ?? null,
            bucketName: doc.bucketName ?? null,
            filePath: doc.filePath ?? null,
            status: doc.status ?? null,
            subCategory: doc.subCategory ?? null,
            originalFileInfo: doc.originalFileInfo ?? null,
            // エントリーURL Document固有のフィールド
            entryUrl: doc.entryUrl ?? null,
            maxDepth: doc.maxDepth ?? null,
            maxUrls: doc.maxUrls ?? null,
            totalPages: doc.totalPages ?? null,
            // URL Markdown Document固有のフィールド
            url: doc.url ?? null,
            gcsUrl: doc.gcsUrl ?? null,
            title: doc.title ?? null,
            // Phase R-1b: Drive 同期由来フィールド
            driveFileId: doc.driveFileId ?? null,
            driveFolderId: doc.driveFolderId ?? null,
            driveModifiedTime: doc.driveModifiedTime ?? null,
            driveWebViewLink: doc.driveWebViewLink ?? null,
            thumbnailLink: doc.thumbnailLink ?? null,
            // Phase R-1c: Web クローラ由来フィールド
            webCrawlRequestId: doc.webCrawlRequestId ?? null,
            gcsPrefix: doc.gcsPrefix ?? null,
            sourceUrl: doc.sourceUrl ?? null,
            // Phase R-1d (2026-05-20): 画像の取得元ページ + 同一性判定キー
            sourcePageUrl: doc.sourcePageUrl ?? null,
            sourcePageTitle: doc.sourcePageTitle ?? null,
            contentHash: doc.contentHash ?? null,
            // Phase R-1e: Web クロール OGP / サムネ
            ogImage: doc.ogImage ?? null,
            ogTitle: doc.ogTitle ?? null,
            ogDescription: doc.ogDescription ?? null,
            thumbnailGcsPath: doc.thumbnailGcsPath ?? null,
            thumbnailBucket: doc.thumbnailBucket ?? null,
            registration: doc.registration ?? null,
            agentSearchDocumentId: doc.agentSearchDocumentId ?? null,
            indexBackend: doc.indexBackend,
            // Firestore docID (削除等で必要)
            id: doc.id,
            // DocumentPersisted固有のフィールド
            storeId: doc.storeId,
            organizationId: doc.organizationId,
            spaceId: doc.spaceId,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          }));

          // Stateのdocumentsに保存
          this.documents = result;

          log("INFO", "Documents fetched from Firestore and saved to state", {
            count: result.length,
            storeId,
          });
        } catch (error) {
          this.crudError = "Failed to fetch Documents from Firestore";
          log("ERROR", "fetchDocumentsFromFirestore error:", error);
          this.documents = [];
        } finally {
          this.isLoadingDocuments = false;
        }
      },

      /**
       * Document一覧を取得（Firestore + API経由で突合）
       *
       * 1. FirestoreからDocument一覧を取得
       * 2. RequestDoc経由でAPIからDocument一覧を取得
       * 3. 両者を突合してFirestoreのDocumentのstatusを更新
       * 4. Storeのstateに保存
       *
       * @param storeId - FileSearchStoreのID
       * @param organizationId - Organization ID
       * @param spaceId - Space ID
       * @returns Promise<void> (結果はdocuments stateに格納)
       */
      async fetchDocument(
        storeId: string,
        organizationId: string,
        spaceId: string
      ): Promise<void> {
        this.isLoadingDocuments = true;
        this.crudError = null;

        try {
          log("INFO", "Fetching Documents (Firestore + API sync)", {
            storeId,
            organizationId,
            spaceId,
          });

          // 1. FirestoreからDocument一覧を取得（Stateのdocumentsに保存される）
          await this.fetchDocumentsFromFirestore(storeId);

          // 2. RequestDoc経由でAPIからDocument一覧を取得
          const requestDoc = await this.fetchDocumentList(
            storeId,
            organizationId,
            spaceId
          );

          if (!requestDoc) {
            // RequestDoc作成失敗時はFirestoreのデータのみを使用（既にStateに保存済み）
            log(
              "WARN",
              "Failed to create DocumentList request, using Firestore data only"
            );
            return;
          }

          // RequestDocの完了を待つ処理は、useGeminiFileSpaceSnapshotのコールバックで処理される
          // ここではFirestoreのデータが既にStateに保存されている

          log("INFO", "Document fetch initiated, waiting for API response", {
            requestId: requestDoc.id,
            firestoreDocumentCount: this.documents.length,
          });
        } catch (error) {
          this.crudError = "Document一覧の取得に失敗しました";
          log("ERROR", "fetchDocument error:", error);
        } finally {
          // 注意: isLoadingDocumentsは、fileSpaceDocumentList完了時にfalseに設定される
        }
      },

      /**
       * FileSpaceを削除
       *
       * @param storeId - FileSearchStoreのID
       * @param organizationId - Organization ID
       * @param spaceId - Space ID
       * @param force - 強制削除フラグ（デフォルト: true）
       * @returns 作成されたRequestDoc | null
       */
      async deleteFileSpace(
        storeId: string,
        organizationId: string,
        spaceId: string,
        force: boolean = true
      ): Promise<DecodedFileSpaceOperationRequest | null> {
        this.isLoading = true;
        this.crudError = null;

        try {
          log("INFO", "Deleting FileSpace", {
            storeId,
            organizationId,
            spaceId,
            force,
          });

          // fileSpaceDeleteのRequestDocを作成
          const requestDoc = await this.createFileSpaceRequest({
            operationType: "fileSpaceDelete",
            storeId,
            force,
            organizationId,
            spaceId,
          });

          if (!requestDoc) {
            this.crudError = "FileSpace削除リクエストの作成に失敗しました";
            return null;
          }

          log("INFO", "FileSpaceDelete request created successfully", {
            requestId: requestDoc.id,
            storeId,
          });

          // snapshotWatchingRequestsに追加（監視開始）
          this.addWatchingFileSpaceRequest(requestDoc.id, requestDoc);

          return requestDoc;
        } catch (error) {
          this.crudError = "FileSpaceの削除に失敗しました";
          log("ERROR", "deleteFileSpace error:", error);
          return null;
        } finally {
          this.isLoading = false;
        }
      },

      /**
       * Documentを削除
       *
       * @param storeId - FileSearchStoreのID
       * @param documentId - DocumentのID
       * @param organizationId - Organization ID
       * @param spaceId - Space ID
       * @returns 作成されたRequestDoc | null
       */
      async deleteDocument(
        storeId: string,
        documentId: string,
        organizationId: string,
        spaceId: string
      ): Promise<DecodedFileSpaceOperationRequest | null> {
        this.isLoading = true;
        this.crudError = null;

        try {
          log("INFO", "Deleting Document", {
            storeId,
            documentId,
            organizationId,
            spaceId,
          });

          // documentDeleteのRequestDocを作成
          const requestDoc = await this.createFileSpaceRequest({
            operationType: "documentDelete",
            storeId,
            documentId,
            organizationId,
            spaceId,
          });

          if (!requestDoc) {
            this.crudError = "Document削除リクエストの作成に失敗しました";
            return null;
          }

          log("INFO", "DocumentDelete request created successfully", {
            requestId: requestDoc.id,
            storeId,
            documentId,
          });

          // snapshotWatchingRequestsに追加（監視開始）
          this.addWatchingFileSpaceRequest(requestDoc.id, requestDoc);

          return requestDoc;
        } catch (error) {
          this.crudError = "Documentの削除に失敗しました";
          log("ERROR", "deleteDocument error:", error);
          return null;
        } finally {
          this.isLoading = false;
        }
      },

      /**
       * Document をフルに削除する (Gemini 索引 + GCS 原ファイル + Firestore メタデータ).
       *
       * 既存の `deleteDocument` は Gemini 側だけ削除する (Cloud Functions 経由).
       * 本アクションはそれに加えて、フロントエンド完結で:
       *   - GCS の原ファイル (bucketName + filePath) を `deleteObject`
       *   - Firestore の Document メタデータ (fileSpaces/{storeId}/documents/{doc.id}) を `deleteDoc`
       * もベストエフォートで削除する.
       *
       * Drive 側のファイル本体には一切触らない (Drive API 呼び出しなし).
       *
       * @param params.doc - 削除対象の Document
       * @param params.storeId - FileSpace (FileSearchStore) ID
       * @param params.organizationId / spaceId - operationMetadata 用
       * @returns Gemini 削除 RequestDoc | null (Gemini 削除リクエスト発火に失敗した場合のみ null)
       */
      async deleteDocumentFully(params: {
        doc: Document;
        storeId: string;
        organizationId: string;
        spaceId: string;
      }): Promise<DecodedFileSpaceOperationRequest | null> {
        const { doc, storeId, organizationId, spaceId } = params;

        // 1. Gemini 索引削除 RequestDoc 作成 (Cloud Functions が非同期で Gemini API へ)
        //
        // placeholder doc (= まだ Gemini に登録されていない 画像 / driveSync 中) の
        // 場合は Gemini に doc が存在しないので、Gemini call は完全に skip して
        // GCS / Firestore だけ消す. 旧実装は placeholder でも Gemini delete
        // RequestDoc を発火 → 404 を踏む RequestDoc を量産していた.
        const placeholder = isKnowledgePlaceholder(doc);
        let requestDoc: DecodedFileSpaceOperationRequest | null = null;
        if (!placeholder) {
          const geminiDocId = extractGeminiDocId(doc);
          if (!geminiDocId) {
            log("ERROR", "deleteDocumentFully: cannot extract Gemini doc ID", {
              name: doc.name,
            });
            return null;
          }
          requestDoc = await this.deleteDocument(
            storeId,
            geminiDocId,
            organizationId,
            spaceId
          );
          if (!requestDoc) {
            // Gemini 削除リクエスト発火に失敗したら GCS/Firestore も触らない (整合性優先)
            return null;
          }
        } else {
          log("INFO", "deleteDocumentFully: skip Gemini for placeholder doc", {
            name: doc.name,
            filePath: doc.filePath,
          });
        }

        // 2. GCS 原ファイル削除 (ベストエフォート, idempotent)
        //    bucketName + filePath が無い Document (entryUrl 等) はスキップ.
        if (doc.bucketName && doc.filePath) {
          try {
            const storage = getStorage(undefined, `gs://${doc.bucketName}`);
            const objectRef = storageRef(storage, doc.filePath);
            await deleteObject(objectRef);
            log("INFO", "deleteDocumentFully: GCS object deleted", {
              bucketName: doc.bucketName,
              filePath: doc.filePath,
            });
          } catch (e: unknown) {
            // object-not-found は無視 (既に消えてる = 整合済み)
            const code = (e as { code?: string } | null)?.code;
            if (code === "storage/object-not-found") {
              log("INFO", "deleteDocumentFully: GCS object already absent", {
                filePath: doc.filePath,
              });
            } else {
              log("WARN", "deleteDocumentFully: GCS delete failed (ignored)", {
                error: e,
                filePath: doc.filePath,
              });
            }
          }
        }

        // 3. Firestore Document メタデータ削除 (ベストエフォート)
        //    ※ ローカル `this.documents` の楽観的更新は意図的に行わない.
        //    並列 (Promise.all) 削除中に this.documents = filter(...) を各クロージャから
        //    呼ぶと、古いスナップショットでの上書きが発生して削除済みの doc が
        //    一時的に復活する → FileSpaceDocumentList の watch が反応して
        //    削除済み GCS ファイルへ getAuthenticatedUrl してしまう (404).
        //    UI は呼び出し側の refresh で fetchDocumentsFromFirestore に一本化.
        if (doc.id) {
          try {
            const firestoreOps = useFirestoreDocOperation();
            const contextStore = useContextStore();
            const collectionName = contextStore.baseFirestorePath(
              `fileSpaces/${storeId}/documents`
            );
            const ok = await firestoreOps.deleteDocument({
              collectionName,
              docId: doc.id,
            });
            if (ok) {
              log("INFO", "deleteDocumentFully: Firestore doc deleted", {
                docId: doc.id,
              });
            } else {
              log(
                "WARN",
                "deleteDocumentFully: Firestore delete returned false",
                { docId: doc.id }
              );
            }
          } catch (e) {
            log(
              "WARN",
              "deleteDocumentFully: Firestore delete failed (ignored)",
              e
            );
          }
        }

        return requestDoc;
      },

      /**
       * チャット用のFileSpace選択を初期化（デフォルトは選択なし）
       * fetchFileSpacesFromFirestoreの後に呼び出す
       */
      initializeSelectedFileSpacesForChat(): void {
        this.selectedFileSpacesForChat = [];

        log("INFO", "Initialized selected FileSpaces for chat (empty)", {
          total: this.fileSpaces.length,
        });
      },

      /**
       * Phase R-1: default FileSpace 1つだけを selectedFileSpacesForChat に
       * セットする (AI部下チャットの「常に default を参照」化)。
       * ensureDefaultFileSpace で auto-create + Firestore 永続化が完了している前提。
       * fileSpaces state にまだ反映されていない場合は fetchFileSpacesFromFirestore を呼ぶ。
       *
       * @returns true = default を 1つセット完了、false = 取得失敗
       */
      async ensureDefaultSelectedFileSpaceForChat(): Promise<boolean> {
        try {
          if (this.fileSpaces.length === 0) {
            await this.fetchFileSpacesFromFirestore();
          }
          // system タイプの FileSpace を default として優先、なければ先頭を fallback
          const defaultFs =
            this.fileSpaces.find((fs) => fs.fileSpaceType === "system") ||
            this.fileSpaces[0];
          if (!defaultFs || !defaultFs.name) {
            log("WARN", "ensureDefaultSelectedFileSpaceForChat: no fileSpace");
            this.selectedFileSpacesForChat = [];
            return false;
          }
          this.selectedFileSpacesForChat = [defaultFs];
          // 接続ステータスマップにも入れて、AIChatPanel が参照できるようにする
          this.fileSpaceStatusMap.set(defaultFs.name, true);
          log("INFO", "Default FileSpace selected for chat", {
            name: defaultFs.name,
          });
          return true;
        } catch (e) {
          log("ERROR", "ensureDefaultSelectedFileSpaceForChat error", e);
          return false;
        }
      },

      /**
       * 選択中フォルダの合計ファイル数
       */
      getTotalSelectedFileCount(): number {
        let total = 0;
        this.selectedFileSpacesForChat.forEach((fs) => {
          const count = this.fileSpaceDocumentCountMap.get(fs.name || "");
          if (count !== undefined && count !== null) {
            total += count;
          }
        });
        return total;
      },

      /**
       * 指定フォルダを追加した場合の合計ファイル数
       */
      getTotalFileCountIfAdded(fileSpaceName: string): number {
        const currentTotal = this.getTotalSelectedFileCount();
        const folderCount =
          this.fileSpaceDocumentCountMap.get(fileSpaceName) ?? 0;
        const isAlreadySelected = this.selectedFileSpacesForChat.some(
          (fs) => fs.name === fileSpaceName
        );
        if (isAlreadySelected) {
          return currentTotal;
        }
        return currentTotal + folderCount;
      },

      /**
       * 指定フォルダをチャットに追加可能か（10ファイル制限）
       */
      canAddFileSpaceForChat(fileSpaceName: string): boolean {
        return (
          this.getTotalFileCountIfAdded(fileSpaceName) <= MAX_TOTAL_FILES_FOR_CHAT
        );
      },

      /**
       * チャット用のFileSpace選択をトグル
       *
       * @param fileSpaceName - トグルするFileSpaceのname
       * @returns 成功した場合true、制限で追加できなかった場合false
       */
      toggleFileSpaceForChat(fileSpaceName: string): boolean {
        const fileSpace = this.fileSpaces.find(
          (fs) => fs.name === fileSpaceName
        );
        if (!fileSpace) {
          log("WARN", "FileSpace not found for toggle", { fileSpaceName });
          return false;
        }

        const index = this.selectedFileSpacesForChat.findIndex(
          (fs) => fs.name === fileSpaceName
        );

        if (index >= 0) {
          // 選択解除
          this.selectedFileSpacesForChat.splice(index, 1);
          log("INFO", "FileSpace deselected for chat", { fileSpaceName });
          return true;
        }

        // 選択追加（接続済みかつ10ファイル制限内の場合のみ）
        const isConnected = this.fileSpaceStatusMap.get(fileSpaceName) === true;
        if (!isConnected) {
          log("WARN", "Cannot select unconnected FileSpace", {
            fileSpaceName,
          });
          return false;
        }

        if (!this.canAddFileSpaceForChat(fileSpaceName)) {
          log("WARN", "Cannot add FileSpace: total files would exceed limit", {
            fileSpaceName,
            wouldBeTotal: this.getTotalFileCountIfAdded(fileSpaceName),
            limit: MAX_TOTAL_FILES_FOR_CHAT,
          });
          return false;
        }

        this.selectedFileSpacesForChat.push(fileSpace);
        log("INFO", "FileSpace selected for chat", { fileSpaceName });
        return true;
      },

      /**
       * FileSpaceの接続ステータスを更新
       *
       * @param fileSpaceName - FileSpaceのname
       * @param isConnected - 接続済みかどうか
       */
      setFileSpaceConnectionStatus(
        fileSpaceName: string,
        isConnected: boolean
      ): void {
        this.fileSpaceStatusMap.set(fileSpaceName, isConnected);
        log("INFO", "FileSpace connection status updated", {
          fileSpaceName,
          isConnected,
        });
      },

      /**
       * Document情報をFirestoreに永続化
       *
       * @param params - Document保存パラメータ
       */
      async persistDocumentToFirestore(params: {
        storeId: string;
        documentName: string; // fileSpaceDocumentListのoutputから取得したdocumentName
        organizationId: string;
        spaceId: string;
        displayName?: string | null;
        description?: string | null;
        createTime?: string | null;
        updateTime?: string | null;
        state?: string | null;
        sizeBytes?: string | null;
        mimeType?: string | null;
        bucketName?: string | null; // オプション（fileSpaceUpload完了時に設定される）
        filePath?: string | null; // Firestoreパス: organizations/{orgId}/spaces/{spaceId}/fileSpaces/{fileSpaceId}/documents/{fileName}
        status?: string | null; // オプション（接続ステータス）
        originalFileInfo?: {
          fileName: string | null;
          bytes: number | null;
        } | null; // オリジナルファイル情報（fileUpload時に保存）
        sourceKind?: "en-aistudioData" | "drive" | "upload" | "web";
        enAiStudioDataset?: string | null;
        workspaceId?: string | null;
        exportedAt?: string | null;
        gcsUrl?: string | null;
      }): Promise<void> {
        try {
          const firestoreOps = useFirestoreDocOperation();
          const contextStore = useContextStore();

          // Document名からdocumentIdを抽出
          // 例: "fileSearchStores/{storeId}/documents/{documentId}" → "{documentId}"
          const nameParts = params.documentName.split("/");
          const documentId =
            nameParts.length > 0 ? nameParts[nameParts.length - 1] : "";

          if (!documentId) {
            log("WARN", "Failed to extract documentId from documentName", {
              documentName: params.documentName,
            });
            return;
          }

          // Firestoreに永続化（fileSpaces/{storeId}/documents のサブコレクション）
          const collectionName = contextStore.baseFirestorePath(
            `fileSpaces/${params.storeId}/documents`
          );

          // filePathが指定されていない場合、Firestoreパスを生成
          const filePath = params.filePath || `${collectionName}/${documentId}`;

          const gcsUrl =
            params.gcsUrl ||
            (params.bucketName && params.filePath
              ? `gs://${params.bucketName}/${params.filePath}`
              : null);

          const documentData = {
            name: params.documentName,
            displayName: params.displayName || null,
            description: params.description || null,
            createTime: params.createTime || new Date().toISOString(),
            updateTime: params.updateTime || new Date().toISOString(),
            state: params.state || "STATE_ACTIVE",
            sizeBytes: params.sizeBytes || null,
            mimeType: params.mimeType || null,
            bucketName: params.bucketName || null,
            filePath,
            gcsUrl,
            status: params.status || null,
            originalFileInfo: params.originalFileInfo || null,
            storeId: params.storeId,
            organizationId: params.organizationId,
            spaceId: params.spaceId,
            sourceKind: params.sourceKind ?? null,
            enAiStudioDataKind: params.sourceKind === "en-aistudioData" ? "en-aistudioData" : null,
            enAiStudioDataset: params.enAiStudioDataset ?? null,
            workspaceId: params.workspaceId ?? null,
            exportedAt: params.exportedAt ?? null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          await firestoreOps.createDocument({
            collectionName,
            docId: documentId,
            docData: documentData,
            converter: documentConverter,
            merge: true, // 既存のDocumentがある場合は更新
          });
          log("INFO", "Document persisted to Firestore successfully", {
            documentId,
            documentName: params.documentName,
            collectionName,
            bucketName: params.bucketName,
            filePath,
            status: params.status,
          });
        } catch (error) {
          log("ERROR", "Failed to persist Document to Firestore", {
            error,
            params,
          });
          throw error;
        }
      },
    },
  }
);
