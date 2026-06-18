/**
 * WebCrawlRequest Snapshot 監視 Composable
 *
 * `useGeminiFileSpaceSnapshot.ts` のパターン踏襲だが、`requestId` は **ref で渡す**
 * 設計にしてある。これにより
 *   - 「モーダル開いた時点ではまだ requestId が無い → ユーザーが送信したら ref を埋める」
 *     という流れに自然にハマる
 *   - ref の値が変わると自動で 旧 unsubscribe → 新 subscribe
 *   - 必ず setup 時に呼ぶ (onUnmounted を click handler から呼ばない)
 *
 * 用途: Web ページ取り込みの「リクエスト発行 → 進捗ライブ更新 → 完了/エラー」
 */

import { ref, watch, onBeforeUnmount, type Ref } from "vue";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { useFirestore } from "vuefire";
import log from "@utils/logger";
import {
  webCrawlRequestConverter,
  type DecodedWebCrawlRequest,
} from "@models/webCrawlRequest";
import { useWebCrawlRequestStore } from "@stores/webCrawlRequest";
import { useContextStore } from "@stores/context";

export function useWebCrawlRequestSnapshot(requestId: Ref<string | null>): {
  request: Ref<DecodedWebCrawlRequest | null>;
  stop: () => void;
} {
  const db = useFirestore();
  const store = useWebCrawlRequestStore();
  const contextStore = useContextStore();

  const request: Ref<DecodedWebCrawlRequest | null> = ref(null);
  let currentUnsubscribe: Unsubscribe | null = null;

  const stop = () => {
    if (currentUnsubscribe) {
      currentUnsubscribe();
      currentUnsubscribe = null;
    }
  };

  const subscribe = (id: string) => {
    // webCrawlRequests は organization 配下 (space では無い)
    const collectionPath = contextStore.organizationFirestorePath(
      "requests/webCrawlRequests/logs"
    );
    const docRef = doc(db, collectionPath, id).withConverter(
      webCrawlRequestConverter
    );

    currentUnsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          log("WARN", "WebCrawlRequest not found", { requestId: id });
          request.value = null;
          return;
        }
        const data = snapshot.data();
        request.value = data;
        // store に反映 (他コンポーネントが参照するため)
        if (store.snapshotWatchingRequests.has(id)) {
          store.updateWatchingWebCrawlRequestByRequestId(id, data);
        } else {
          store.addWatchingWebCrawlRequest(id, data);
        }
      },
      (error) => {
        log("ERROR", "WebCrawlRequest snapshot error", {
          requestId: id,
          error: error.message,
        });
        request.value = null;
      }
    );
  };

  // requestId が変わるたびに購読を切り替え
  watch(
    requestId,
    (newId, _oldId) => {
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
