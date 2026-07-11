import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { computed, ref, watch } from "vue";
import log from "@utils/logger";
import { reportDatadogInfo } from "@utils/datadogObservability";

const FUNCTIONS_REGION = "asia-northeast1";
const JIRA_AUTHORIZE_URL = "https://auth.atlassian.com/authorize";
const JIRA_SCOPES = "read:jira-work read:jira-user";
export const JIRA_OAUTH_STATE_STORAGE_KEY = "storyvault:jira-oauth-state";
export const JIRA_OAUTH_STATE_FALLBACK_STORAGE_KEY =
  "storyvault:jira-oauth-state-fallback";
export const JIRA_OAUTH_DEBUG_STORAGE_KEY = "storyvault-jira-oauth-debug";

export function appendJiraOAuthDebug(
  event: string,
  details: Record<string, unknown> = {}
): void {
  const entry = {
    at: new Date().toISOString(),
    event,
    details,
  };
  log("INFO", "[Jira OAuth]", event, details);
  reportDatadogInfo(`[Jira OAuth] ${event}`, details);
  try {
    const current = JSON.parse(
      window.localStorage.getItem(JIRA_OAUTH_DEBUG_STORAGE_KEY) || "[]"
    );
    const rows = Array.isArray(current) ? current : [];
    rows.push(entry);
    window.localStorage.setItem(
      JIRA_OAUTH_DEBUG_STORAGE_KEY,
      JSON.stringify(rows.slice(-30))
    );
  } catch {
    // Debug logging must never block OAuth.
  }
}

export type JiraConnection = {
  id: string;
  cloudId: string;
  connected: boolean;
  siteName: string;
  siteUrl: string;
  avatarUrl?: string;
  scopes: string[];
  connectedBy?: string;
};

export type JiraNamedField = {
  id: string;
  name: string;
};

export type JiraIssuePreview = {
  id: string;
  key: string;
  cloudId: string;
  siteUrl: string;
  htmlUrl: string;
  summary: string;
  description: string;
  issueType: JiraNamedField;
  status: JiraNamedField;
  priority: JiraNamedField;
  assignee: JiraNamedField;
  reporter: JiraNamedField;
  project: JiraNamedField;
  labels: string[];
  components: JiraNamedField[];
  fixVersions: JiraNamedField[];
  parentKey: string;
  createdAt: string;
  updatedAt: string;
};

const sharedIsLoading = ref(false);
const sharedConnections = ref<JiraConnection[]>([]);
let sharedRefreshPromise: Promise<JiraConnection[]> | null = null;

function jiraCallbackUrl(configuredRedirectUri?: string): string {
  const configured = (configuredRedirectUri || "").trim();
  if (configured) return configured;
  const origin = new URL(window.location.origin);
  if (origin.hostname === "localhost") origin.hostname = "127.0.0.1";
  return `${origin.toString().replace(/\/$/, "")}/admin/storyvault/jira-callback`;
}

function encodeBase64Url(value: string): string {
  return window
    .btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createJiraState(params: {
  organizationId: string;
  redirectUri: string;
  returnPath: string;
  nonce: string;
}): string {
  return encodeBase64Url(
    JSON.stringify({
      provider: "jira",
      organizationId: params.organizationId,
      redirectUri: params.redirectUri,
      returnPath: params.returnPath,
      nonce: params.nonce,
    })
  );
}

export function useJiraOAuth() {
  const runtimeConfig = useRuntimeConfig();
  const organizationStore = useOrganizationStore();
  const toast = useToast();

  const clientId = computed(() =>
    String(runtimeConfig.public.jiraOAuthClientId || "").trim()
  );
  const configuredRedirectUri = computed(() =>
    String(runtimeConfig.public.jiraOAuthRedirectUri || "").trim()
  );
  const organizationId = computed(
    () => organizationStore.loggedInOrganizationInfo?.id || ""
  );
  const functions = () => getFunctions(getApp(), FUNCTIONS_REGION);

  const refreshConnections = async (): Promise<JiraConnection[]> => {
    if (!organizationId.value) {
      sharedConnections.value = [];
      appendJiraOAuthDebug("refreshConnections:missingOrganization", {});
      return sharedConnections.value;
    }
    if (sharedRefreshPromise) return sharedRefreshPromise;

    appendJiraOAuthDebug("refreshConnections:start", {
      organizationId: organizationId.value,
    });
    sharedIsLoading.value = true;
    sharedRefreshPromise = (async () => {
      try {
        const callable = httpsCallable<
          { organizationId: string },
          { ok: boolean; connections: JiraConnection[] }
        >(functions(), "get_jira_connections");
        const response = await callable({ organizationId: organizationId.value });
        sharedConnections.value = (response.data.connections || []).map((connection) => ({
          ...connection,
          connected: true,
        }));
        appendJiraOAuthDebug("refreshConnections:success", {
          organizationId: organizationId.value,
          count: sharedConnections.value.length,
          cloudIds: sharedConnections.value.map((connection) => connection.cloudId),
        });
        return sharedConnections.value;
      } catch (error) {
        appendJiraOAuthDebug("refreshConnections:error", {
          organizationId: organizationId.value,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    })();
    try {
      return await sharedRefreshPromise;
    } finally {
      sharedRefreshPromise = null;
      sharedIsLoading.value = false;
    }
  };

  const connect = async (): Promise<boolean> => {
    if (!clientId.value) {
      appendJiraOAuthDebug("connect:missingClientId", {});
      toast.add({
        title: "Jira OAuth client が未設定です",
        description: "Atlassian 3LO appのClient IDを設定してください",
        color: "error",
      });
      return false;
    }
    if (!organizationId.value) {
      appendJiraOAuthDebug("connect:missingOrganization", {});
      toast.add({ title: "組織情報が未取得です", color: "error" });
      return false;
    }
    sharedIsLoading.value = true;
    try {
      const redirectUri = jiraCallbackUrl(configuredRedirectUri.value);
      const nonce = randomNonce();
      const state = createJiraState({
        organizationId: organizationId.value,
        redirectUri,
        returnPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        nonce,
      });
      const storedState = JSON.stringify({
        nonce,
        organizationId: organizationId.value,
        createdAt: Date.now(),
      });
      // Keep sessionStorage as the primary store, but retain a one-time fallback
      // for browsers that hand the OAuth page to a separate tab or process.
      window.sessionStorage.setItem(JIRA_OAUTH_STATE_STORAGE_KEY, storedState);
      window.localStorage.setItem(
        JIRA_OAUTH_STATE_FALLBACK_STORAGE_KEY,
        storedState
      );
      const url = new URL(JIRA_AUTHORIZE_URL);
      url.searchParams.set("audience", "api.atlassian.com");
      url.searchParams.set("client_id", clientId.value);
      url.searchParams.set("scope", JIRA_SCOPES);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("prompt", "consent");
      appendJiraOAuthDebug("connect:redirectToAtlassian", {
        organizationId: organizationId.value,
        redirectUri,
        returnPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        scopes: JIRA_SCOPES,
        stateLength: state.length,
      });
      window.location.assign(url.toString());
      return false;
    } catch (error) {
      appendJiraOAuthDebug("connect:error", {
        message: error instanceof Error ? error.message : String(error),
      });
      toast.add({
        title: "Jira 接続を開始できませんでした",
        description: error instanceof Error ? error.message : undefined,
        color: "error",
      });
      return false;
    } finally {
      sharedIsLoading.value = false;
    }
  };

  const disconnect = async (cloudId: string): Promise<void> => {
    if (!organizationId.value || !cloudId) return;
    appendJiraOAuthDebug("disconnect:start", {
      organizationId: organizationId.value,
      cloudId,
    });
    sharedIsLoading.value = true;
    try {
      const callable = httpsCallable<
        { organizationId: string; cloudId: string },
        { ok: boolean }
      >(functions(), "disconnect_jira_site");
      await callable({ organizationId: organizationId.value, cloudId });
      await refreshConnections();
      appendJiraOAuthDebug("disconnect:success", { cloudId });
    } catch (error) {
      appendJiraOAuthDebug("disconnect:error", {
        cloudId,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      sharedIsLoading.value = false;
    }
  };

  const testConnection = async (cloudId: string): Promise<boolean> => {
    if (!organizationId.value || !cloudId) return false;
    appendJiraOAuthDebug("testConnection:start", { cloudId });
    const callable = httpsCallable<
      { organizationId: string; cloudId: string },
      { ok: boolean }
    >(functions(), "test_jira_connection");
    try {
      const response = await callable({ organizationId: organizationId.value, cloudId });
      appendJiraOAuthDebug("testConnection:success", {
        cloudId,
        ok: Boolean(response.data.ok),
      });
      return Boolean(response.data.ok);
    } catch (error) {
      appendJiraOAuthDebug("testConnection:error", {
        cloudId,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const listIssues = async (params: {
    cloudId?: string;
    query?: string;
    jql?: string;
    limit?: number;
  } = {}): Promise<JiraIssuePreview[]> => {
    if (!organizationId.value) return [];
    const callable = httpsCallable<
      {
        organizationId: string;
        cloudId?: string;
        query?: string;
        jql?: string;
        limit?: number;
      },
      { ok: boolean; issues: JiraIssuePreview[] }
    >(functions(), "list_jira_issues");
    const response = await callable({
      organizationId: organizationId.value,
      cloudId: params.cloudId,
      query: params.query?.trim() || undefined,
      jql: params.jql?.trim() || undefined,
      limit: params.limit,
    });
    return response.data.issues || [];
  };

  // The organization store is populated asynchronously after the page mounts.
  // Retry automatically so the initial empty state is not mistaken for no connection.
  watch(
    organizationId,
    (value) => {
      if (value) void refreshConnections().catch(() => undefined);
    },
    { immediate: true }
  );

  return {
    clientId,
    organizationId,
    connections: sharedConnections,
    isLoading: sharedIsLoading,
    connect,
    disconnect,
    listIssues,
    refreshConnections,
    testConnection,
  };
}
