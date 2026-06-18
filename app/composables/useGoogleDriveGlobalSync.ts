/**
 * Admin レイアウト全体で Google Drive 同期を監視する。
 * pending scan / snapshot / 完了トースト / active job 復元を 1 箇所に集約。
 */

import { computed, onMounted, watch, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { useGoogleDriveSyncStore } from "@stores/googleDriveSync";
import { useGoogleDriveConfig } from "@composables/useGoogleDriveConfig";
import { useDefaultFileSpace } from "@composables/useDefaultFileSpace";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useGoogleDriveSyncRequestSnapshot } from "@composables/useGoogleDriveSyncRequestSnapshot";
import type { FirestoreDriveDoc } from "@utils/computeDrivePendingDiff";

let globalSyncInitialized = false;
let globalLifecycleInitialized = false;

function ensureDriveSyncSnapshotWatcher(): void {
  if (!import.meta.client || globalSyncInitialized) return;
  globalSyncInitialized = true;

  const driveStore = useGoogleDriveSyncStore();
  const activeSyncRequestId = computed({
    get: () => driveStore.activeSyncRequestId,
    set: (id) => {
      driveStore.activeSyncRequestId = id;
    },
  });
  useGoogleDriveSyncRequestSnapshot(activeSyncRequestId);
}

export function useGoogleDriveGlobalSync(): {
  runPendingDriveScan: () => Promise<boolean>;
  triggerDriveImport: () => Promise<boolean>;
  importProgressModalOpen: Ref<boolean>;
} {
  ensureDriveSyncSnapshotWatcher();

  const driveStore = useGoogleDriveSyncStore();
  const {
    isConfigured,
    syncCompletedTick,
    lastTerminalSyncNotice,
    importProgressModalOpen,
  } = storeToRefs(driveStore);

  const { config, refresh: refreshDriveConfig } = useGoogleDriveConfig();
  const { fileSpaceId } = useDefaultFileSpace();
  const organizationStore = useOrganizationStore();
  const spaceStore = useSpaceStore();
  const fileSpaceStore = useGeminiFileSpaceOperatorStore();
  const toast = useToast();

  const resolveSyncContext = () => {
    const organizationId = organizationStore.getLoggedInOrganizationId;
    const spaceId = spaceStore.selectedSpace?.id;
    const fsId =
      config.value?.linkedFileSpaceId?.trim() || fileSpaceId.value?.trim();
    const rootFolderId = config.value?.rootFolderId;
    if (!organizationId || !spaceId || !fsId || !rootFolderId) return null;
    return { organizationId, spaceId, fileSpaceId: fsId, rootFolderId };
  };

  const runPendingDriveScan = async (): Promise<boolean> => {
    const ctx = resolveSyncContext();
    if (!ctx) return false;

    try {
      await fileSpaceStore.fetchDocumentsFromFirestore(ctx.fileSpaceId);
    } catch {
      // Firestore 取得失敗時はサーバー側 diff にフォールバック
    }

    const existingDocs: FirestoreDriveDoc[] = fileSpaceStore.documents.map(
      (doc) => ({
        driveFileId: doc.driveFileId ?? null,
        driveModifiedTime: doc.driveModifiedTime ?? null,
        name: doc.name ?? null,
        agentSearchDocumentId: doc.agentSearchDocumentId ?? null,
        registration: doc.registration ?? null,
        filePath: doc.filePath ?? null,
      })
    );

    return driveStore.scanPendingDriveFiles({
      ...ctx,
      existingDocs,
    });
  };

  const triggerDriveImport = async (): Promise<boolean> => {
    const ctx = resolveSyncContext();
    if (!ctx) return false;
    driveStore.lastTerminalSyncNotice = null;
    const created = await driveStore.triggerImportFromDrive(ctx);
    if (created) {
      toast.add({
        title: "Drive 取り込みを開始しました",
        description:
          "バックグラウンドで実行中です。ヘッダーからいつでも進捗を確認できます",
        color: "info",
      });
    }
    return Boolean(created);
  };

  if (!globalLifecycleInitialized) {
    globalLifecycleInitialized = true;

    watch(lastTerminalSyncNotice, (notice) => {
      if (!notice) return;
      toast.add({
        title: notice.title,
        description: notice.description,
        color: notice.ok ? "success" : "error",
      });
      driveStore.lastTerminalSyncNotice = null;
    });

    watch(syncCompletedTick, () => {
      void runPendingDriveScan();
    });

    watch(
      () => driveStore.driveHeaderCompletedFlashUntil,
      (until) => {
        if (!until) return;
        const delay = Math.max(0, until - Date.now());
        window.setTimeout(() => {
          if (driveStore.driveHeaderCompletedFlashUntil === until) {
            driveStore.clearDriveHeaderCompletedFlash();
          }
        }, delay);
      }
    );

    watch(
      [
        () => organizationStore.getLoggedInOrganizationId,
        () => spaceStore.selectedSpace?.id,
        fileSpaceId,
        isConfigured,
        () => config.value?.rootFolderId,
      ],
      ([orgId, spaceId, fsId, configured]) => {
        if (!orgId || !spaceId || !fsId || !configured) return;
        void runPendingDriveScan();
      }
    );

    onMounted(async () => {
      await refreshDriveConfig();
      await driveStore.recoverActiveSyncRequest();
      if (isConfigured.value) {
        void runPendingDriveScan();
      }
    });
  }

  return {
    runPendingDriveScan,
    triggerDriveImport,
    importProgressModalOpen,
  };
}
