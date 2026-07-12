import { ref, watch, onBeforeUnmount, type Ref } from "vue";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { useFirestore } from "vuefire";
import log from "@utils/logger";
import {
  businessPartnerBulkImportRequestConverter,
  BUSINESS_PARTNER_BULK_IMPORT_REQUESTS_PATH,
  type DecodedBusinessPartnerBulkImportRequest,
} from "@models/businessPartnerBulkImportRequest";
import { useContextStore } from "@stores/context";

/**
 * 取引先 CSV 一括登録 RequestDoc を onSnapshot で監視する.
 */
export function useBusinessPartnerBulkImportSnapshot(
  requestId: Ref<string | null>
): {
  request: Ref<DecodedBusinessPartnerBulkImportRequest | null>;
  stop: () => void;
} {
  const db = useFirestore();
  const contextStore = useContextStore();
  const request = ref<DecodedBusinessPartnerBulkImportRequest | null>(null);
  let currentUnsubscribe: Unsubscribe | null = null;

  const stop = () => {
    if (currentUnsubscribe) {
      currentUnsubscribe();
      currentUnsubscribe = null;
    }
  };

  const subscribe = (id: string) => {
    const collectionPath = contextStore.baseFirestorePath(
      BUSINESS_PARTNER_BULK_IMPORT_REQUESTS_PATH
    );
    const docRef = doc(db, collectionPath, id).withConverter(
      businessPartnerBulkImportRequestConverter
    );

    currentUnsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          log("WARN", "BusinessPartnerBulkImportRequest not found", {
            requestId: id,
          });
          request.value = null;
          return;
        }
        request.value = snapshot.data();
      },
      (error) => {
        log("ERROR", "BusinessPartnerBulkImportRequest snapshot error", {
          requestId: id,
          error: error.message,
        });
        request.value = null;
      }
    );
  };

  watch(
    requestId,
    (id) => {
      stop();
      request.value = null;
      if (id) subscribe(id);
    },
    { immediate: true }
  );

  onBeforeUnmount(stop);

  return { request, stop };
}
