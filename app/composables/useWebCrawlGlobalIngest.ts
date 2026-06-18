/**
 * Admin レイアウト全体で Web ページ取り込みを監視する。
 * snapshot / 完了トースト / active job 復元を 1 箇所に集約。
 */

import { computed, onMounted, watch, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { useWebCrawlRequestStore } from "@stores/webCrawlRequest";
import { useWebCrawlRequestSnapshot } from "@composables/useWebCrawlRequestSnapshot";
import { useOrganizationStore } from "@stores/organization";

let globalIngestInitialized = false;
let globalLifecycleInitialized = false;

function ensureWebCrawlSnapshotWatcher(): void {
  if (!import.meta.client || globalIngestInitialized) return;
  globalIngestInitialized = true;

  const store = useWebCrawlRequestStore();
  const activeIngestRequestId = computed({
    get: () => store.activeIngestRequestId,
    set: (id) => {
      store.activeIngestRequestId = id;
    },
  });
  useWebCrawlRequestSnapshot(activeIngestRequestId);
}

export function useWebCrawlGlobalIngest(): {
  ingestProgressModalOpen: Ref<boolean>;
} {
  ensureWebCrawlSnapshotWatcher();

  const store = useWebCrawlRequestStore();
  const { lastTerminalIngestNotice, ingestProgressModalOpen } =
    storeToRefs(store);
  const organizationStore = useOrganizationStore();
  const toast = useToast();

  if (!globalLifecycleInitialized) {
    globalLifecycleInitialized = true;

    watch(lastTerminalIngestNotice, (notice) => {
      if (!notice) return;
      toast.add({
        title: notice.title,
        description: notice.description,
        color: notice.ok ? "success" : "error",
      });
      store.lastTerminalIngestNotice = null;
    });

    watch(
      () => store.footerCompletedFlashUntil,
      (until) => {
        if (!until) return;
        const delay = Math.max(0, until - Date.now());
        window.setTimeout(() => {
          if (store.footerCompletedFlashUntil === until) {
            store.clearFooterCompletedFlash();
          }
        }, delay);
      }
    );

    onMounted(async () => {
      if (organizationStore.getLoggedInOrganizationId) {
        await store.recoverActiveIngestRequest();
      }
    });

    watch(
      () => organizationStore.getLoggedInOrganizationId,
      (orgId) => {
        if (orgId) void store.recoverActiveIngestRequest();
      }
    );
  }

  return { ingestProgressModalOpen };
}
