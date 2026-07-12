/**
 * Default FileSpace 取得 Composable (Phase R-1)
 *
 * 「organization に1つの素材プール (= default FileSpace)」を取得・自動作成する。
 */

import { ref, watch, onMounted, onBeforeUnmount, type Ref } from "vue";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { useFirestore } from "vuefire";
import { storeToRefs } from "pinia";
import log from "@utils/logger";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useContextStore } from "@stores/context";
import { fileSpaceOperationRequestConverter } from "@models/geminiFileSpaceRequest";

export function useDefaultFileSpace(): {
  fileSpaceId: Ref<string | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  refresh: () => Promise<void>;
} {
  const store = useGeminiFileSpaceOperatorStore();
  const contextStore = useContextStore();
  const organizationStore = useOrganizationStore();
  const spaceStore = useSpaceStore();
  const db = useFirestore();
  const { fileSpaces } = storeToRefs(store);

  const fileSpaceId = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const pendingRequestId = ref<string | null>(null);

  let pendingUnsubscribe: Unsubscribe | null = null;

  const stopPendingWatch = () => {
    if (pendingUnsubscribe) {
      pendingUnsubscribe();
      pendingUnsubscribe = null;
    }
  };

  const resolveFromState = (): boolean => {
    const systemFs = fileSpaces.value.find((fs) => fs.fileSpaceType === "system");
    if (systemFs?.name) {
      const parts = systemFs.name.split("/");
      const id = parts[parts.length - 1] || null;
      if (id) {
        fileSpaceId.value = id;
        return true;
      }
    }
    return false;
  };

  watch(fileSpaces, () => {
    if (!fileSpaceId.value && pendingRequestId.value) {
      if (resolveFromState()) {
        log("INFO", "default FileSpace resolved from fileSpaces update", {
          fileSpaceId: fileSpaceId.value,
        });
        isLoading.value = false;
        pendingRequestId.value = null;
        stopPendingWatch();
      }
    }
  });

  const watchPendingRequest = (requestId: string) => {
    stopPendingWatch();
    const collectionPath = contextStore.baseFirestorePath(
      "requests/contextStoreRequests/logs"
    );
    const docRef = doc(db, collectionPath, requestId).withConverter(
      fileSpaceOperationRequestConverter
    );

    pendingUnsubscribe = onSnapshot(
      docRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }
        const data = snapshot.data();
        if (data.status === "completed") {
          await store.fetchFileSpacesFromFirestore();
          if (resolveFromState()) {
            isLoading.value = false;
            pendingRequestId.value = null;
            stopPendingWatch();
          }
        } else if (data.status === "error") {
          error.value =
            data.errorMessage || "default FileSpace の作成に失敗しました";
          isLoading.value = false;
          pendingRequestId.value = null;
          stopPendingWatch();
        }
      },
      (e) => {
        error.value =
          e instanceof Error ? e.message : "default FileSpace 作成の監視に失敗";
        isLoading.value = false;
        pendingRequestId.value = null;
        stopPendingWatch();
      }
    );
  };

  watch(pendingRequestId, (newId) => {
    if (newId) {
      watchPendingRequest(newId);
    } else {
      stopPendingWatch();
    }
  });

  onBeforeUnmount(() => {
    stopPendingWatch();
  });

  const refresh = async (): Promise<void> => {
    if (
      !organizationStore.getLoggedInOrganizationId ||
      !spaceStore.selectedSpace?.id
    ) {
      isLoading.value = false;
      error.value = null;
      fileSpaceId.value = null;
      pendingRequestId.value = null;
      stopPendingWatch();
      return;
    }

    isLoading.value = true;
    error.value = null;
    fileSpaceId.value = null;
    pendingRequestId.value = null;
    stopPendingWatch();

    try {
      const result = await store.ensureDefaultFileSpace();
      if (result.storeId) {
        fileSpaceId.value = result.storeId;
        isLoading.value = false;
        return;
      }
      if (result.requestId) {
        pendingRequestId.value = result.requestId;
        return;
      }
      error.value =
        "default FileSpace を取得できませんでした (organization/space 未選択の可能性)";
      isLoading.value = false;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "default FileSpace 取得失敗";
      isLoading.value = false;
    }
  };

  onMounted(() => {
    void refresh();
  });

  watch(
    [
      () => organizationStore.getLoggedInOrganizationId,
      () => spaceStore.selectedSpace?.id,
    ],
    ([organizationId, spaceId]) => {
      if (
        !organizationId ||
        !spaceId ||
        fileSpaceId.value ||
        pendingRequestId.value
      ) {
        return;
      }
      void refresh();
    }
  );

  return { fileSpaceId, isLoading, error, refresh };
}
