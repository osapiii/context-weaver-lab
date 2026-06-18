/**
 * 直近の googleDriveSyncRequests を Firestore からリアルタイム購読
 */

import { ref, type Ref } from "vue";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { useFirestore } from "vuefire";
import log from "@utils/logger";
import { useContextStore } from "@stores/context";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import {
  googleDriveSyncRequestConverter,
  type DecodedGoogleDriveSyncRequest,
} from "@models/googleDriveSyncRequest";

const REQUESTS_SUBPATH = "requests/googleDriveSyncRequests/logs";

export function useGoogleDriveSyncRequestList(listLimit = 15): {
  requests: Ref<DecodedGoogleDriveSyncRequest[]>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  subscribe: () => void;
  unsubscribe: () => void;
} {
  const db = useFirestore();
  const contextStore = useContextStore();
  const organizationStore = useOrganizationStore();
  const spaceStore = useSpaceStore();

  const requests = ref<DecodedGoogleDriveSyncRequest[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  let firestoreUnsubscribe: Unsubscribe | null = null;

  const unsubscribe = () => {
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
      firestoreUnsubscribe = null;
    }
  };

  const subscribe = () => {
    unsubscribe();
    isLoading.value = true;
    error.value = null;

    const organizationId = organizationStore.loggedInOrganizationInfo?.id;
    const spaceId = spaceStore.selectedSpace?.id;
    if (!organizationId || !spaceId) {
      requests.value = [];
      isLoading.value = false;
      error.value = "組織またはスペースが未選択です";
      return;
    }

    const collectionPath = contextStore.baseFirestorePath(REQUESTS_SUBPATH);
    const collectionRef = collection(db, collectionPath);
    const q = query(
      collectionRef,
      orderBy("createdAt", "desc"),
      limit(listLimit)
    );

    firestoreUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        requests.value = snapshot.docs.map((docSnap) =>
          googleDriveSyncRequestConverter.fromFirestore(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            docSnap as any
          )
        );
        isLoading.value = false;
      },
      (err) => {
        log("ERROR", "useGoogleDriveSyncRequestList snapshot error", err);
        error.value =
          err instanceof Error ? err.message : "同期履歴の取得に失敗しました";
        isLoading.value = false;
      }
    );
  };

  return { requests, isLoading, error, subscribe, unsubscribe };
}
