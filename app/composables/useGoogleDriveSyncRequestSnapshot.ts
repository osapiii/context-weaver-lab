/**
 * GoogleDriveSyncRequest Snapshot 監視 Composable (Phase R-1b)
 *
 * `useWebCrawlRequestSnapshot.ts` のパターン踏襲。requestId は ref で渡し、
 * 値が変わるたびに 旧 unsubscribe → 新 subscribe。unmount 時に必ず unsubscribe。
 *
 * webCrawl と異なり こちらは space 配下: organizations/{org}/spaces/{space}/requests/...
 */

import { ref, watch, onBeforeUnmount, type Ref } from "vue";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { useFirestore } from "vuefire";
import log from "@utils/logger";
import {
  googleDriveSyncRequestConverter,
  type DecodedGoogleDriveSyncRequest,
} from "@models/googleDriveSyncRequest";
import { useGoogleDriveSyncStore } from "@stores/googleDriveSync";
import { useContextStore } from "@stores/context";

export function useGoogleDriveSyncRequestSnapshot(
  requestId: Ref<string | null>
): {
  request: Ref<DecodedGoogleDriveSyncRequest | null>;
  stop: () => void;
} {
  const db = useFirestore();
  const store = useGoogleDriveSyncStore();
  const contextStore = useContextStore();

  const request: Ref<DecodedGoogleDriveSyncRequest | null> = ref(null);
  let currentUnsubscribe: Unsubscribe | null = null;

  const stop = () => {
    if (currentUnsubscribe) {
      currentUnsubscribe();
      currentUnsubscribe = null;
    }
  };

  const subscribe = (id: string) => {
    const collectionPath = contextStore.baseFirestorePath(
      "requests/googleDriveSyncRequests/logs"
    );
    const docRef = doc(db, collectionPath, id).withConverter(
      googleDriveSyncRequestConverter
    );

    currentUnsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          log("WARN", "DriveSyncRequest not found", { requestId: id });
          request.value = null;
          return;
        }
        const data = snapshot.data();
        request.value = data;
        if (store.snapshotWatchingRequests.has(id)) {
          store.updateWatchingRequest(id, data);
        } else {
          store.addWatchingRequest(id, data);
        }
      },
      (error) => {
        log("ERROR", "DriveSyncRequest snapshot error", {
          requestId: id,
          error: error.message,
        });
        request.value = null;
        if (store.activeSyncRequestId === id) {
          store.activeSyncRequestId = null;
          store.createRequestError =
            "同期状態の取得に失敗しました。再度お試しください。";
        }
      }
    );
  };

  watch(
    requestId,
    (newId) => {
      stop();
      request.value = null;
      if (newId) subscribe(newId);
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    stop();
  });

  return { request, stop };
}
