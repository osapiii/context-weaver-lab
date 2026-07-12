import { useToast } from "#imports";
import log from "@utils/logger";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";

/**
 * Agent Search (Discovery Engine) と Firestore documents を突合同期する。
 */
export function useAgentSearchSync() {
  const fileSpaceStore = useGeminiFileSpaceOperatorStore();
  const organizationStore = useOrganizationStore();
  const spaceStore = useSpaceStore();
  const toast = useToast();

  const syncFileSpaceWithAgentSearch = async (
    storeId: string,
    options?: { onCompleted?: () => void }
  ): Promise<boolean> => {
    const orgId = organizationStore.getLoggedInOrganizationId;
    const spaceId = spaceStore.selectedSpace?.id;
    if (!storeId || !orgId || !spaceId) {
      toast.add({
        title: "同期コンテキスト不足",
        description: "組織・スペース・FileSpace を確認してください",
        color: "error",
      });
      return false;
    }

    try {
      await fileSpaceStore.fetchDocument(storeId, orgId, spaceId);
      toast.add({
        title: "Agent Search との同期を開始しました",
        description: "完了まで数十秒かかることがあります",
        color: "info",
      });
      if (options?.onCompleted) {
        setTimeout(options.onCompleted, 12_000);
      }
      return true;
    } catch (e) {
      log("ERROR", "syncFileSpaceWithAgentSearch failed", e);
      toast.add({ title: "同期の開始に失敗", color: "error" });
      return false;
    }
  };

  return {
    syncFileSpaceWithAgentSearch,
    isSyncing: () => fileSpaceStore.isLoadingDocuments,
  };
}
