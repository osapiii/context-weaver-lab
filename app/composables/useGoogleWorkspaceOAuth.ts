import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import log from "@utils/logger";

const FUNCTIONS_REGION = "asia-northeast1";

const WORKSPACE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

type GoogleWorkspaceConnection = {
  connected: boolean;
  email?: string;
  scopes?: string[];
};

export type GoogleDriveFolderTestResult = {
  ok: boolean;
  rootFolderName?: string;
  folderId?: string;
  webViewLink?: string;
  error?: string;
};

export type GoogleDriveListFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
};

export type GoogleDriveFolderListResult = {
  status?: string;
  files?: GoogleDriveListFile[];
  fileCount?: number;
  rootFolderId?: string;
  targetFolderId?: string | null;
  error?: { message?: string } | string;
};

type GoogleCodeResponse = {
  code?: string;
  error?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode: "popup";
            prompt?: string;
            callback: (response: GoogleCodeResponse) => void;
          }) => { requestCode: () => void };
        };
      };
    };
  }
}

let gisLoader: Promise<void> | null = null;
const sharedIsLoading = ref(false);
const sharedConnection = ref<GoogleWorkspaceConnection>({ connected: false });

function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google 接続はブラウザでのみ実行できます"));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoader) return gisLoader;

  gisLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Identity Services の読み込みに失敗しました")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google Identity Services の読み込みに失敗しました"));
    document.head.appendChild(script);
  });
  return gisLoader;
}

export function useGoogleWorkspaceOAuth() {
  const runtimeConfig = useRuntimeConfig();
  const organizationStore = useOrganizationStore();
  const toast = useToast();

  const clientId = computed(() =>
    String(runtimeConfig.public.googleWorkspaceOAuthClientId || "").trim()
  );

  const organizationId = computed(
    () => organizationStore.loggedInOrganizationInfo?.id || ""
  );

  const functions = () => getFunctions(getApp(), FUNCTIONS_REGION);

  const refreshConnection = async (): Promise<GoogleWorkspaceConnection> => {
    if (!organizationId.value) {
      sharedConnection.value = { connected: false };
      return sharedConnection.value;
    }
    const callable = httpsCallable<
      { organizationId: string },
      GoogleWorkspaceConnection
    >(functions(), "get_google_workspace_connection");
    const res = await callable({ organizationId: organizationId.value });
    sharedConnection.value = res.data;
    return sharedConnection.value;
  };

  const connect = async (): Promise<boolean> => {
    if (!clientId.value) {
      toast.add({
        title: "Google OAuth client が未設定です",
        description: "NUXT_PUBLIC_GOOGLE_WORKSPACE_OAUTH_CLIENT_ID を設定してください",
        color: "error",
      });
      return false;
    }
    if (!organizationId.value) {
      toast.add({ title: "組織情報が未取得です", color: "error" });
      return false;
    }

    sharedIsLoading.value = true;
    try {
      await loadGoogleIdentityServices();
      const code = await new Promise<string>((resolve, reject) => {
        const client = window.google?.accounts?.oauth2?.initCodeClient({
          client_id: clientId.value,
          scope: WORKSPACE_SCOPES,
          ux_mode: "popup",
          prompt: "consent",
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error));
              return;
            }
            if (!response.code) {
              reject(new Error("Google 認可コードを取得できませんでした"));
              return;
            }
            resolve(response.code);
          },
        });
        if (!client) {
          reject(new Error("Google Identity Services を初期化できませんでした"));
          return;
        }
        client.requestCode();
      });

      const callable = httpsCallable<
        { organizationId: string; code: string },
        { ok: boolean; email?: string; scopes?: string[] }
      >(functions(), "connect_google_workspace");
      const res = await callable({ organizationId: organizationId.value, code });
      sharedConnection.value = {
        connected: Boolean(res.data.ok),
        email: res.data.email,
        scopes: res.data.scopes,
      };
      toast.add({
        title: "Google Workspace を接続しました",
        description: res.data.email || undefined,
        color: "success",
      });
      return true;
    } catch (error) {
      log("ERROR", "Google Workspace OAuth connect failed", error);
      toast.add({
        title: "Google Workspace 接続に失敗しました",
        description: error instanceof Error ? error.message : undefined,
        color: "error",
      });
      return false;
    } finally {
      sharedIsLoading.value = false;
    }
  };

  const disconnect = async (): Promise<void> => {
    if (!organizationId.value) return;
    sharedIsLoading.value = true;
    try {
      const callable = httpsCallable<{ organizationId: string }, { ok: boolean }>(
        functions(),
        "disconnect_google_workspace"
      );
      await callable({ organizationId: organizationId.value });
      sharedConnection.value = { connected: false };
    } finally {
      sharedIsLoading.value = false;
    }
  };

  const testDriveFolder = async (
    folderId: string
  ): Promise<GoogleDriveFolderTestResult> => {
    if (!organizationId.value) {
      return { ok: false, error: "組織情報が未取得です" };
    }
    const callable = httpsCallable<
      { organizationId: string; folderId: string },
      GoogleDriveFolderTestResult
    >(functions(), "test_google_drive_folder");
    const res = await callable({ organizationId: organizationId.value, folderId });
    return res.data;
  };

  const listDriveFolder = async (params: {
    folderId: string;
    rootFolderId?: string;
    targetFolderId?: string | null;
    recursive?: boolean;
  }): Promise<GoogleDriveFolderListResult> => {
    if (!organizationId.value) {
      return {
        status: "error",
        error: { message: "組織情報が未取得です" },
      };
    }
    const callable = httpsCallable<
      {
        organizationId: string;
        folderId: string;
        rootFolderId?: string;
        targetFolderId?: string | null;
        recursive?: boolean;
      },
      GoogleDriveFolderListResult
    >(functions(), "list_google_drive_folder");
    const res = await callable({
      organizationId: organizationId.value,
      folderId: params.folderId,
      rootFolderId: params.rootFolderId,
      targetFolderId: params.targetFolderId,
      recursive: params.recursive ?? true,
    });
    return res.data;
  };

  return {
    clientId,
    connection: sharedConnection,
    isLoading: sharedIsLoading,
    connect,
    disconnect,
    refreshConnection,
    testDriveFolder,
    listDriveFolder,
  };
}
