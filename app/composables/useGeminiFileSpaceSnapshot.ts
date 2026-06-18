/**
 * Gemini File Space Snapshot監視Composable
 *
 * Component側でonSnapshotを直接実行し、Store側はsnapshotWatchingRequests管理のみを行う
 * RequestDocアーキテクチャに準拠した実装パターン
 */

import { ref, onUnmounted, type Ref } from "vue";
import {
  doc,
  onSnapshot,
  type Unsubscribe,
  Timestamp,
} from "firebase/firestore";
import { useFirestore } from "vuefire";
import { useToast, useRuntimeConfig } from "#imports";
import log from "@utils/logger";
import {
  fileSpaceOperationRequestConverter,
  type DecodedFileSpaceOperationRequest,
  type Document,
} from "@models/geminiFileSpaceRequest";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useContextStore } from "@stores/context";
import { useFirestoreDocOperation } from "@composables/firestore-doc-operation";
import { documentConverter } from "@models/geminiFileSpaceRequest";
import {
  buildAgentSearchOrphanCreates,
  buildAgentSearchReconcilePatches,
  type AgentSearchApiDocument,
} from "@utils/agentSearchReconcile";

/**
 * Gemini File Space RequestのSnapshot監視を開始
 *
 * @param requestId - 監視対象のRequestDoc ID
 * @param onUpdate - 更新時のコールバック（オプション）
 * @returns unsubscribe関数
 */
export function useGeminiFileSpaceSnapshot(
  requestId: Ref<string> | string,
  onUpdate?: (request: DecodedFileSpaceOperationRequest) => void
): {
  unsubscribe: () => void;
  request: Ref<DecodedFileSpaceOperationRequest | null>;
} {
  const db = useFirestore();
  const store = useGeminiFileSpaceOperatorStore();
  const contextStore = useContextStore();
  const toast = useToast();

  // requestIdがRefの場合は.valueを取得、そうでなければそのまま使用
  const requestIdValue =
    typeof requestId === "string" ? requestId : requestId.value;

  // 監視中のRequestDocを取得（初期値）
  const initialRequest =
    store.fetchWatchingFileSpaceRequestByRequestId(requestIdValue);

  // リアクティブなrequest参照
  const request: Ref<DecodedFileSpaceOperationRequest | null> =
    ref(initialRequest);

  // パスを生成（space配下）
  const collectionPath = contextStore.baseFirestorePath(
    "requests/contextStoreRequests/logs"
  );

  const docRef = doc(db, collectionPath, requestIdValue).withConverter(
    fileSpaceOperationRequestConverter
  );

  // 子 listener (DocumentList 監視等) を追跡し、親が unsubscribe される時に
  // 一括 cleanup する. setup ライフサイクル外から spawn される子 listener が
  // `onUnmounted` を呼んでも component に bind されないため、ここで親が
  // ownership を持つ.
  const childUnsubscribes: Unsubscribe[] = [];

  // Snapshot監視を開始
  const unsubscribe: Unsubscribe = onSnapshot(
    docRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        log("WARN", "RequestDoc not found", { requestId: requestIdValue });
        request.value = null;
        return;
      }

      const requestData = snapshot.data();
      request.value = requestData;

      // Store側のsnapshotWatchingRequestsを更新
      store.updateWatchingFileSpaceRequestByRequestId(
        requestIdValue,
        requestData
      );

      // fileSpaceGetのRequestDocがcompletedまたはsuccessになった場合、接続ステータスを更新
      if (requestData.input.operationType === "fileSpaceGet") {
        if (
          (requestData.status === "completed" ||
            requestData.status === "success") &&
          requestData.output
        ) {
          log("INFO", "FileSpaceGet completed, updating connection status", {
            requestId: requestIdValue,
            status: requestData.status,
          });

          // 接続ステータスをtrueに設定
          store.selectedFileSpaceStatusIsValid = true;

          log("INFO", "FileSpace connection status updated to valid", {
            requestId: requestIdValue,
          });
        } else if (requestData.status === "error") {
          log("WARN", "FileSpaceGet failed, connection status invalid", {
            requestId: requestIdValue,
            errorMessage: requestData.errorMessage,
          });

          // エラー時は接続ステータスをfalseに設定
          store.selectedFileSpaceStatusIsValid = false;
        }
      }

      // fileSpaceCreateのRequestDocがcompletedになった場合、自動的にFirestoreに永続化
      if (
        requestData.input.operationType === "fileSpaceCreate" &&
        requestData.status === "completed" &&
        requestData.output
      ) {
        const organizationId = requestData.operationMetadata.organizationId;
        const spaceId = requestData.operationMetadata.spaceId;

        if (organizationId && spaceId) {
          log("INFO", "FileSpaceCreate completed, persisting to Firestore", {
            requestId: requestIdValue,
            organizationId,
            spaceId,
          });

          // Firestoreに永続化（非同期処理）
          store
            .persistFileSpaceToFirestore(requestData, organizationId, spaceId)
            .then(() => {
              log("INFO", "FileSpace persisted to Firestore successfully", {
                requestId: requestIdValue,
              });

              // outputからFileSpace名を取得して選択状態にする
              // output構造: フラットな構造（responseでラップされていない）
              const output = requestData.output;
              if (
                output &&
                typeof output === "object" &&
                "name" in output &&
                output.name
              ) {
                const fileSpaceName = output.name as string;
                store.setSelectedFileSpace(fileSpaceName);

                // Toast通知で完了を通知
                const displayName =
                  (output as { displayName?: string | null }).displayName ||
                  fileSpaceName;
                toast.add({
                  title: "FileSpace作成完了",
                  description: `「${displayName}」を作成しました`,
                  icon: "i-heroicons-check-circle",
                  color: "green",
                });
              }

              // 永続化後、fileSpaces一覧を再取得
              store.fetchFileSpacesFromFirestore();
            })
            .catch((error) => {
              log("ERROR", "Failed to persist FileSpace to Firestore", {
                requestId: requestIdValue,
                error,
              });

              // エラー時のToast通知
              toast.add({
                title: "FileSpace作成失敗",
                description: "FileSpaceの作成中にエラーが発生しました",
                icon: "i-heroicons-exclamation-circle",
                color: "red",
              });
            });
        } else {
          log(
            "WARN",
            "OrganizationId or SpaceId missing in operationMetadata",
            {
              requestId: requestIdValue,
              organizationId,
              spaceId,
            }
          );
        }
      }

      // fileSpaceUploadのRequestDocがcompletedまたはsuccessになった場合、Documentを生成してからDocument一覧を取得
      if (
        requestData.input.operationType === "fileSpaceUpload" &&
        (requestData.status === "completed" ||
          requestData.status === "success") &&
        requestData.output
      ) {
        // globalLoadingを停止
        const { useGlobalLoadingStore } = await import(
          "@stores/global-loading"
        );
        const globalLoading = useGlobalLoadingStore();
        globalLoading.stopLoading();
        const organizationId = requestData.operationMetadata.organizationId;
        const spaceId = requestData.operationMetadata.spaceId;
        const storeId = requestData.input.storeId;
        const bucketName = requestData.input.bucketName;
        const filePath = requestData.input.filePath;

        if (organizationId && spaceId && storeId && bucketName && filePath) {
          log("INFO", "FileSpaceUpload completed, creating document", {
            requestId: requestIdValue,
            storeId,
            organizationId,
            spaceId,
            bucketName,
            filePath,
          });

          // outputからDocument情報を取得
          const output = requestData.output as any;
          const documentName = output.response?.name;

          if (documentName) {
            // Document名からdocumentIdを抽出
            // 例: "fileSearchStores/{storeId}/documents/{documentId}" → "{documentId}"
            const nameParts = documentName.split("/");
            const documentId =
              nameParts.length > 0 ? nameParts[nameParts.length - 1] : null;

            if (documentId) {
              try {
                // オリジナルファイル情報を取得（RequestDocのinputから）
                const originalFileInfo = requestData.input.originalFileInfo
                  ? {
                      fileName:
                        requestData.input.originalFileInfo.fileName || null,
                      bytes: requestData.input.originalFileInfo.bytes || null,
                    }
                  : null;

                await store.persistDocumentToFirestore({
                  storeId,
                  documentName,
                  organizationId,
                  spaceId,
                  displayName:
                    output.displayName || output.document?.displayName || null,
                  description: requestData.input.description || null,
                  createTime:
                    output.createTime || output.document?.createTime || null,
                  updateTime:
                    output.updateTime || output.document?.updateTime || null,
                  state: output.state || output.document?.state || null,
                  sizeBytes:
                    output.sizeBytes || output.document?.sizeBytes || null,
                  mimeType:
                    requestData.input.mimeType ||
                    output.mimeType ||
                    output.document?.mimeType ||
                    null,
                  bucketName,
                  filePath,
                  status: "connected",
                  originalFileInfo,
                });

                log("INFO", "Document created in Firestore after upload", {
                  documentId,
                  documentName,
                  bucketName,
                  filePath,
                  storeId,
                });
              } catch (error) {
                log(
                  "ERROR",
                  "Failed to create Document in Firestore after upload",
                  {
                    documentId,
                    documentName,
                    error,
                  }
                );
              }
            } else {
              log("WARN", "Failed to extract documentId from documentName", {
                documentName,
              });
            }
          } else {
            log("WARN", "Document name not found in output", {
              output,
            });
          }

          // Document一覧を取得（status更新）
          store
            .fetchDocumentList(storeId, organizationId, spaceId)
            .then((docListRequest) => {
              if (docListRequest) {
                log("INFO", "Document list fetch request created", {
                  requestId: docListRequest.id,
                });
                // Document一覧取得の監視を直接 onSnapshot で開始.
                // 旧実装は `useGeminiFileSpaceSnapshot(docListRequest.id)` を再帰的に
                // 呼んでいたが、setup() 外で `onUnmounted` が機能せず listener が
                // 累積するメモリリークの原因だった. ここで親 (この composable) の
                // childUnsubscribes に push して、親の unsubscribe 時に一括 cleanup.
                const childDocRef = doc(
                  db,
                  collectionPath,
                  docListRequest.id
                ).withConverter(fileSpaceOperationRequestConverter);
                const childUnsubscribe = onSnapshot(
                  childDocRef,
                  (childSnapshot) => {
                    if (!childSnapshot.exists()) return;
                    const childData = childSnapshot.data();
                    store.updateWatchingFileSpaceRequestByRequestId(
                      docListRequest.id,
                      childData
                    );
                    // 完了時は自分自身を unsubscribe (累積防止)
                    if (
                      childData.status === "completed" ||
                      childData.status === "error" ||
                      childData.status === "success"
                    ) {
                      childUnsubscribe();
                      const idx = childUnsubscribes.indexOf(childUnsubscribe);
                      if (idx >= 0) childUnsubscribes.splice(idx, 1);
                    }
                  },
                  (error) => {
                    log("ERROR", "Child snapshot error", {
                      requestId: docListRequest.id,
                      error: error.message,
                    });
                  }
                );
                childUnsubscribes.push(childUnsubscribe);
              }
            })
            .catch((error) => {
              log("ERROR", "Failed to fetch document list after upload", {
                requestId: requestIdValue,
                error,
              });
            });
        } else {
          log(
            "WARN",
            "OrganizationId, SpaceId, StoreId, BucketName, or FilePath missing",
            {
              requestId: requestIdValue,
              organizationId,
              spaceId,
              storeId,
              bucketName,
              filePath,
            }
          );
        }
      }

      // fileSpaceDocumentListのRequestDocがcompletedまたはsuccessになった場合、outputとFirestoreを突合してDocument一覧をStoreに保存
      if (
        requestData.input.operationType === "fileSpaceDocumentList" &&
        (requestData.status === "completed" ||
          requestData.status === "success") &&
        requestData.output
      ) {
        log(
          "INFO",
          "FileSpaceDocumentList completed, syncing documents with Firestore",
          {
            requestId: requestIdValue,
            status: requestData.status,
          }
        );

        // output構造からDocument一覧を抽出
        // output構造: {documents: [...]} (output.responseの中身のみ)
        const output = requestData.output;
        if (
          output &&
          typeof output === "object" &&
          "documents" in output &&
          Array.isArray(output.documents)
        ) {
          const organizationId = requestData.operationMetadata.organizationId;
          const spaceId = requestData.operationMetadata.spaceId;
          const storeId = requestData.input.storeId;

          if (!organizationId || !spaceId || !storeId) {
            log("WARN", "OrganizationId, SpaceId, or StoreId missing", {
              requestId: requestIdValue,
              organizationId,
              spaceId,
              storeId,
            });
            store.documents = [];
            store.isLoadingDocuments = false;
            return;
          }

          // 1. FirestoreからDocument一覧を取得
          const firestoreDocuments =
            await store.fetchDocumentsFromFirestore(storeId);

          const apiDocuments = output.documents as AgentSearchApiDocument[];

          const firestoreOps = useFirestoreDocOperation();
          const contextStore = useContextStore();
          const collectionName = contextStore.baseFirestorePath(
            `fileSpaces/${storeId}/documents`
          );

          const patches = buildAgentSearchReconcilePatches(
            firestoreDocuments,
            apiDocuments
          );

          await Promise.all(
            patches.map(async (patch) => {
              const fsDoc = firestoreDocuments.find((d) => d.id === patch.docId);
              if (!fsDoc) return;

              const nextAgentId = patch.agentSearchDocumentId || undefined;
              const nextStage = patch.registrationStage;
              const needsUpdate =
                fsDoc.status !== patch.status ||
                (nextAgentId &&
                  fsDoc.agentSearchDocumentId !== nextAgentId) ||
                (nextStage &&
                  fsDoc.registration?.stage !== nextStage);

              if (!needsUpdate) return;

              try {
                await firestoreOps.updateDocument({
                  collectionName,
                  docId: patch.docId,
                  docData: {
                    status: patch.status,
                    ...(nextAgentId
                      ? { agentSearchDocumentId: nextAgentId }
                      : {}),
                    ...(nextStage
                      ? {
                          registration: {
                            ...(fsDoc.registration ?? {}),
                            stage: nextStage,
                            geminiRegistered: nextStage === "indexed",
                          },
                          indexBackend: "agent_search",
                        }
                      : {}),
                    updatedAt: Timestamp.now(),
                  },
                  converter: documentConverter,
                });
              } catch (error) {
                log("WARN", "Agent Search reconcile patch failed", {
                  docId: patch.docId,
                  error,
                });
              }
            })
          );

          const existingIds = new Set(
            firestoreDocuments
              .map((d) => d.id?.trim())
              .filter((id): id is string => Boolean(id))
          );
          const orphanCreates = buildAgentSearchOrphanCreates(
            apiDocuments,
            existingIds,
            { storeId, organizationId, spaceId }
          );

          if (orphanCreates.length > 0) {
            log("INFO", "Materializing Agent Search orphan documents", {
              requestId: requestIdValue,
              count: orphanCreates.length,
            });
            await Promise.all(
              orphanCreates.map(async ({ docId, docData }) => {
                try {
                  await firestoreOps.createDocument({
                    collectionName,
                    docId,
                    docData: {
                      ...docData,
                      createdAt: Timestamp.now(),
                      updatedAt: Timestamp.now(),
                    },
                    converter: documentConverter,
                    merge: true,
                  });
                } catch (error) {
                  log("WARN", "Agent Search orphan materialize failed", {
                    docId,
                    error,
                  });
                }
              })
            );
          }

          log("INFO", "Agent Search reconcile completed", {
            requestId: requestIdValue,
            apiCount: apiDocuments.length,
            patchCount: patches.length,
            orphanMaterialized: orphanCreates.length,
          });

          // 最終的な Document 一覧を Firestore から再取得
          await store.fetchDocumentsFromFirestore(storeId);

          // Storeのstateに保存 (fetchDocumentsFromFirestore が this.documents を更新)
          const finalDocuments = store.documents;
          store.isLoadingDocuments = false;

          log("INFO", "Documents synced with Firestore and updated in store", {
            requestId: requestIdValue,
            storeId,
            documentCount: finalDocuments.length,
          });
        } else {
          store.documents = [];
          store.isLoadingDocuments = false;
          log("WARN", "Invalid output structure for fileSpaceDocumentList", {
            requestId: requestIdValue,
            output,
          });
        }
      }

      // 注意: fileSpaceListの処理は削除（Firestoreから直接取得する方式に変更）

      log("DEBUG", "RequestDoc updated", {
        requestId: requestIdValue,
        status: requestData.status,
        operationType: requestData.input.operationType,
      });

      // コールバックが指定されている場合は実行
      if (onUpdate) {
        onUpdate(requestData);
      }

      // 完了・エラー時のクリーンアップ処理
      if (
        requestData.status === "completed" ||
        requestData.status === "error"
      ) {
        // fileSpaceUploadのエラー時はglobalLoadingを停止
        if (
          requestData.input.operationType === "fileSpaceUpload" &&
          requestData.status === "error"
        ) {
          const { useGlobalLoadingStore } = await import(
            "@stores/global-loading"
          );
          const globalLoading = useGlobalLoadingStore();
          globalLoading.stopLoading();
        }

        log(
          "INFO",
          "RequestDoc completed or error, cleanup will be handled by component",
          {
            requestId: requestIdValue,
            status: requestData.status,
          }
        );
        // 注意: ここでは自動的にunsubscribeしない
        // Component側で明示的にクリーンアップする
      }
    },
    (error) => {
      log("ERROR", "Snapshot error", {
        requestId: requestIdValue,
        error: error.message,
      });
      request.value = null;
    }
  );

  // 初期値をStoreに追加（まだ存在しない場合）
  if (!initialRequest && request.value) {
    store.addWatchingFileSpaceRequest(requestIdValue, request.value);
  }

  /** 親 + 子 listener を一括 unsubscribe */
  const cleanup = () => {
    unsubscribe();
    childUnsubscribes.forEach((u) => u());
    childUnsubscribes.length = 0;
  };

  // Componentがunmountされたときにクリーンアップ
  onUnmounted(() => {
    log("INFO", "Component unmounted, cleaning up snapshot", {
      requestId: requestIdValue,
      childCount: childUnsubscribes.length,
    });
    cleanup();
    // Store側から削除（オプション: 必要に応じてコメントアウト）
    // store.deleteWatchingFileSpaceRequestByRequestId(requestIdValue);
  });

  return {
    unsubscribe: cleanup,
    request,
  };
}

/**
 * 複数のRequestDocを監視するComposable
 *
 * @param requestIds - 監視対象のRequestDoc ID配列
 * @param onUpdate - 更新時のコールバック（オプション）
 * @returns unsubscribe関数とrequests Map
 */
export function useGeminiFileSpaceSnapshots(
  requestIds: Ref<string[]> | string[],
  onUpdate?: (
    requestId: string,
    request: DecodedFileSpaceOperationRequest
  ) => void
): {
  unsubscribeAll: () => void;
  requests: Ref<Map<string, DecodedFileSpaceOperationRequest>>;
} {
  const requests: Ref<Map<string, DecodedFileSpaceOperationRequest>> = ref(
    new Map()
  );
  const unsubscribes: Unsubscribe[] = [];

  const requestIdsValue = Array.isArray(requestIds)
    ? requestIds
    : requestIds.value;

  // 各RequestDocに対してSnapshot監視を開始
  requestIdsValue.forEach((requestId) => {
    const { unsubscribe, request } = useGeminiFileSpaceSnapshot(
      requestId,
      (updatedRequest) => {
        requests.value.set(requestId, updatedRequest);
        if (onUpdate) {
          onUpdate(requestId, updatedRequest);
        }
      }
    );
    unsubscribes.push(unsubscribe);

    // 初期値を設定
    if (request.value) {
      requests.value.set(requestId, request.value);
    }
  });

  // すべての監視を停止
  const unsubscribeAll = () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    unsubscribes.length = 0;
    requests.value.clear();
  };

  // Componentがunmountされたときにクリーンアップ
  onUnmounted(() => {
    unsubscribeAll();
  });

  return {
    unsubscribeAll,
    requests,
  };
}
