/**
 * Google Drive folder sync (data-source page wrapper).
 * Global lifecycle lives in useGoogleDriveGlobalSync (admin layout).
 */

import { computed, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { useGoogleDriveSyncStore } from "@stores/googleDriveSync";
import { useGoogleDriveGlobalSync } from "@composables/useGoogleDriveGlobalSync";
import type { DriveImportSessionState } from "@utils/driveImportSession";

export function useGoogleDriveFolderSync(): {
  isConfigured: Ref<boolean>;
  isSyncInProgress: Ref<boolean>;
  isPendingScanInProgress: Ref<boolean>;
  isBatchImportInProgress: Ref<boolean>;
  batchImportProgressLabel: Ref<string | null>;
  activeImportSession: Ref<DriveImportSessionState>;
  pendingScan: Ref<import("@stores/googleDriveSync").DrivePendingScanResult>;
  pendingNewFileCount: Ref<number>;
  hasPendingImports: Ref<boolean>;
  syncCompletedTick: Ref<number>;
  runPendingDriveScan: () => Promise<boolean>;
  triggerDriveImport: () => Promise<boolean>;
} {
  const globalSync = useGoogleDriveGlobalSync();
  const driveStore = useGoogleDriveSyncStore();
  const {
    isConfigured,
    isSyncInProgress,
    isPendingScanInProgress,
    isBatchImportInProgress,
    batchImportProgressLabel,
    pendingScan,
    hasPendingImports,
    syncCompletedTick,
    activeImportSession,
  } = storeToRefs(driveStore);

  const pendingNewFileCount = computed(() => pendingScan.value.addedCount);

  return {
    isConfigured,
    isSyncInProgress,
    isPendingScanInProgress,
    isBatchImportInProgress,
    batchImportProgressLabel,
    activeImportSession,
    pendingScan,
    pendingNewFileCount,
    hasPendingImports,
    syncCompletedTick,
    runPendingDriveScan: globalSync.runPendingDriveScan,
    triggerDriveImport: globalSync.triggerDriveImport,
  };
}
