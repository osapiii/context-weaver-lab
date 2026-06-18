/**
 * GoogleDriveConfig composable (Phase R-1b)
 *
 * Drive 設定 state を reactive に提供する。state は store に置き、
 * composable は onMounted/onUnmounted ライフサイクルとローカル ref を担当。
 */

import { computed, onMounted, watch, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { useGoogleDriveSyncStore } from "@stores/googleDriveSync";
import { useOrganizationStore } from "@stores/organization";
import type { DecodedGoogleDriveIntegrationConfig } from "@models/googleDriveIntegrationConfig";

// SA 情報は env か固定値で表示する (FE からは秘密鍵を扱わない)
const EN_AISTUDIO_DRIVE_AGENT_EMAIL =
  "en-aistudio-drive-agent@en-aistudio-development.iam.gserviceaccount.com";

/**
 * Drive フォルダ URL から folderId を抽出
 * 受け付ける形式:
 *   - 1abcDEF... (raw ID)
 *   - https://drive.google.com/drive/folders/1abcDEF...
 *   - https://drive.google.com/drive/u/0/folders/1abcDEF...?usp=sharing
 */
export function extractDriveFolderId(input: string): string | null {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  // URL から抜く
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  // それ以外は raw ID と見なす (英数字+_+- のみ)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

export function useGoogleDriveConfig(): {
  config: Ref<DecodedGoogleDriveIntegrationConfig | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  isConfigured: Ref<boolean>;
  serviceAccountEmail: string;
  refresh: () => Promise<void>;
} {
  const store = useGoogleDriveSyncStore();
  const organizationStore = useOrganizationStore();
  const { config, isLoadingConfig, configError } = storeToRefs(store);

  const isConfigured = computed(() => !!config.value?.rootFolderId);

  const refresh = async () => {
    if (!organizationStore.getLoggedInOrganizationId) return;
    await store.fetchConfig();
  };

  const fetchWhenReady = () => {
    if (!organizationStore.getLoggedInOrganizationId || config.value) return;
    void store.fetchConfig();
  };

  onMounted(() => {
    fetchWhenReady();
  });

  watch(
    () => organizationStore.getLoggedInOrganizationId,
    () => {
      fetchWhenReady();
    }
  );

  watch(config, () => {
    if (!organizationStore.getLoggedInOrganizationId || config.value) {
      return;
    }
    if (!config.value) {
      void store.fetchConfig();
    }
  });

  return {
    config,
    isLoading: isLoadingConfig,
    error: configError,
    isConfigured,
    serviceAccountEmail: EN_AISTUDIO_DRIVE_AGENT_EMAIL,
    refresh,
  };
}
