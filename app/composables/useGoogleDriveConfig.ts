/**
 * GoogleDriveConfig composable (Phase R-1b)
 *
 * Drive 設定 state を reactive に提供する。state は store に置き、
 * composable は onMounted/onUnmounted ライフサイクルとローカル ref を担当。
 */

import { computed, onMounted, watch, type ComputedRef, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { useGoogleDriveSyncStore } from "@stores/googleDriveSync";
import { useOrganizationStore } from "@stores/organization";
import {
  DEFAULT_DRIVE_CONNECTION_ID,
  type DecodedGoogleDriveConnection,
  type DecodedGoogleDriveIntegrationConfig,
} from "@models/googleDriveIntegrationConfig";

/**
 * Drive フォルダ URL から folderId を抽出
 * 受け付ける形式:
 *   - 1abcDEF... (raw ID)
 *   - https://drive.google.com/drive/folders/1abcDEF...
 *   - https://drive.google.com/drive/u/0/folders/1abcDEF...?usp=sharing
 */
export type ExtractedDriveFolderLink = {
  folderId: string;
  resourceKey: string | null;
};

export function extractDriveFolderLink(input: string): ExtractedDriveFolderLink | null {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  let resourceKey: string | null = null;
  try {
    const url = new URL(trimmed);
    resourceKey = url.searchParams.get("resourcekey")?.trim() || null;
  } catch {
    // raw ID は URL として解釈できなくてよい。
  }
  // URL から抜く
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) return { folderId: urlMatch[1], resourceKey };
  // それ以外は raw ID と見なす (英数字+_+- のみ)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { folderId: trimmed, resourceKey: null };
  }
  return null;
}

export function extractDriveFolderId(input: string): string | null {
  return extractDriveFolderLink(input)?.folderId ?? null;
}

export function useGoogleDriveConfig(): {
  config: Ref<DecodedGoogleDriveIntegrationConfig | null>;
  connections: ComputedRef<DecodedGoogleDriveConnection[]>;
  activeConnection: ComputedRef<DecodedGoogleDriveConnection | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  isConfigured: Ref<boolean>;
  refresh: () => Promise<void>;
  setActiveConnection: (params: { connectionId: string }) => void;
  connectionLabel: (
    connection: Pick<
      DecodedGoogleDriveConnection,
      "displayName" | "rootFolderName" | "id"
    >
  ) => string;
  serviceAccountEmail: string;
} {
  const store = useGoogleDriveSyncStore();
  const organizationStore = useOrganizationStore();
  const { config, isLoadingConfig, configError } = storeToRefs(store);

  const isConfigured = computed(() => !!config.value?.rootFolderId);
  const connections = computed<DecodedGoogleDriveConnection[]>(() => {
    if (!config.value?.rootFolderId) return [];
    return [
      {
        ...config.value,
        id: DEFAULT_DRIVE_CONNECTION_ID,
        displayName: config.value.rootFolderName ?? "Google Drive",
        isDefault: true,
        status: "active",
      },
    ];
  });
  const activeConnection = computed(() => connections.value[0] ?? null);

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
    (orgId, previousOrgId) => {
      if (orgId && previousOrgId && orgId !== previousOrgId) {
        store.config = null;
      }
      fetchWhenReady();
    }
  );

  const setActiveConnection = (_params: { connectionId: string }) => {
    // 現行 OAuth 連携は default connection 1 件のみ。
  };

  const connectionLabel = (
    connection: Pick<
      DecodedGoogleDriveConnection,
      "displayName" | "rootFolderName" | "id"
    >
  ): string =>
    connection.displayName?.trim() ||
    connection.rootFolderName?.trim() ||
    connection.id;

  return {
    config,
    connections,
    activeConnection,
    isLoading: isLoadingConfig,
    error: configError,
    isConfigured,
    refresh,
    setActiveConnection,
    connectionLabel,
    serviceAccountEmail: "",
  };
}
