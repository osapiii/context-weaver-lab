import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import log from "@utils/logger";

const FUNCTIONS_REGION = "asia-northeast1";
const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_SCOPES = [
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
].join(",");
const SLACK_DEBUG_STORAGE_KEY = "storyvault-slack-oauth-debug";

function appendSlackOAuthDebug(
  event: string,
  details: Record<string, unknown> = {}
): void {
  const entry = {
    at: new Date().toISOString(),
    event,
    details,
  };
  log("INFO", "[Slack OAuth]", event, details);
  try {
    const current = JSON.parse(
      window.localStorage.getItem(SLACK_DEBUG_STORAGE_KEY) || "[]"
    );
    const rows = Array.isArray(current) ? current : [];
    rows.push(entry);
    window.localStorage.setItem(
      SLACK_DEBUG_STORAGE_KEY,
      JSON.stringify(rows.slice(-30))
    );
  } catch {
    // Debug logging must never block OAuth.
  }
}

export type SlackConnection = {
  id?: string;
  connected: boolean;
  teamId?: string;
  teamName?: string;
  enterpriseId?: string;
  enterpriseName?: string;
  botUserId?: string;
  slackUserId?: string;
  scopes?: string[];
  userScopes?: string[];
  connectedBy?: string;
};

export type SlackMessagePreview = {
  channelId: string;
  channelName: string;
  messageTs: string;
  threadTs: string;
  permalink: string;
  author: string;
  text: string;
  postedAt: string;
};

type SlackConnectionsResponse = {
  ok: boolean;
  connections: SlackConnection[];
};

const sharedIsLoading = ref(false);
const sharedConnections = ref<SlackConnection[]>([]);
const sharedConnection = computed<SlackConnection>(() => {
  const first = sharedConnections.value[0];
  return first ? { ...first, connected: true } : { connected: false };
});

function slackCallbackUrl(configuredRedirectUri?: string): string {
  const configured = (configuredRedirectUri || "").trim();
  if (configured) return configured;
  const origin = new URL(window.location.origin);
  if (origin.hostname === "localhost") {
    origin.hostname = "127.0.0.1";
  }
  return `${origin.toString().replace(/\/$/, "")}/admin/storyvault/slack-callback`;
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

function createSlackState(params: {
  organizationId: string;
  redirectUri: string;
  returnPath: string;
}): string {
  return encodeBase64Url(
    JSON.stringify({
      provider: "slack",
      organizationId: params.organizationId,
      redirectUri: params.redirectUri,
      returnPath: params.returnPath,
      nonce: randomNonce(),
      openerOrigin: window.location.origin,
    })
  );
}

export function useSlackOAuth() {
  const runtimeConfig = useRuntimeConfig();
  const organizationStore = useOrganizationStore();
  const toast = useToast();

  const clientId = computed(() =>
    String(runtimeConfig.public.slackOAuthClientId || "").trim()
  );
  const configuredRedirectUri = computed(() =>
    String(runtimeConfig.public.slackOAuthRedirectUri || "").trim()
  );
  const organizationId = computed(
    () => organizationStore.loggedInOrganizationInfo?.id || ""
  );
  const functions = () => getFunctions(getApp(), FUNCTIONS_REGION);

  const refreshConnections = async (): Promise<SlackConnection[]> => {
    if (!organizationId.value) {
      sharedConnections.value = [];
      appendSlackOAuthDebug("refreshConnections:missingOrganization", {});
      return sharedConnections.value;
    }
    appendSlackOAuthDebug("refreshConnections:start", {
      organizationId: organizationId.value,
    });
    const callable = httpsCallable<
      { organizationId: string },
      SlackConnectionsResponse
    >(functions(), "get_slack_connections");
    const res = await callable({ organizationId: organizationId.value });
    sharedConnections.value = (res.data.connections ?? []).map((connection) => ({
      ...connection,
      connected: true,
    }));
    appendSlackOAuthDebug("refreshConnections:success", {
      organizationId: organizationId.value,
      count: sharedConnections.value.length,
      ids: sharedConnections.value.map((connection) => connection.id || connection.teamId),
    });
    return sharedConnections.value;
  };

  const refreshConnection = async (): Promise<SlackConnection> => {
    await refreshConnections();
    return sharedConnection.value;
  };

  const connect = async (): Promise<boolean> => {
    if (!clientId.value) {
      appendSlackOAuthDebug("connect:missingClientId", {});
      toast.add({
        title: "Slack OAuth client が未設定です",
        description: "NUXT_PUBLIC_SLACK_OAUTH_CLIENT_ID を設定してください",
        color: "error",
      });
      return false;
    }
    if (!organizationId.value) {
      appendSlackOAuthDebug("connect:missingOrganization", {});
      toast.add({ title: "組織情報が未取得です", color: "error" });
      return false;
    }
    sharedIsLoading.value = true;
    try {
      const redirectUri = slackCallbackUrl(configuredRedirectUri.value);
      const state = createSlackState({
        organizationId: organizationId.value,
        redirectUri,
        returnPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      });
      const url = new URL(SLACK_AUTHORIZE_URL);
      url.searchParams.set("client_id", clientId.value);
      url.searchParams.set("scope", SLACK_SCOPES);
      url.searchParams.set("state", state);
      url.searchParams.set("redirect_uri", redirectUri);
      appendSlackOAuthDebug("connect:redirectToSlack", {
        organizationId: organizationId.value,
        redirectUri,
        returnPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        scopes: SLACK_SCOPES,
        stateLength: state.length,
      });
      window.location.assign(url.toString());
      return false;
    } catch (error) {
      appendSlackOAuthDebug("connect:error", {
        message: error instanceof Error ? error.message : String(error),
      });
      log("ERROR", "Slack OAuth connect failed", error);
      toast.add({
        title: "Slack 接続に失敗しました",
        description: error instanceof Error ? error.message : undefined,
        color: "error",
      });
      return false;
    } finally {
      sharedIsLoading.value = false;
    }
  };

  const disconnect = async (connectionId?: string): Promise<void> => {
    if (!organizationId.value) return;
    const id = connectionId || sharedConnection.value.id || "";
    if (!id) return;
    sharedIsLoading.value = true;
    try {
      const callable = httpsCallable<
        { organizationId: string; connectionId: string },
        { ok: boolean }
      >(functions(), "disconnect_slack_workspace");
      await callable({ organizationId: organizationId.value, connectionId: id });
      await refreshConnections();
    } finally {
      sharedIsLoading.value = false;
    }
  };

  const testConnection = async (connectionId?: string): Promise<boolean> => {
    if (!organizationId.value) return false;
    const callable = httpsCallable<
      { organizationId: string; connectionId?: string },
      { ok: boolean }
    >(functions(), "test_slack_connection");
    const res = await callable({
      organizationId: organizationId.value,
      connectionId: connectionId || sharedConnection.value.id,
    });
    return Boolean(res.data.ok);
  };

  const listMessages = async (params: {
    connectionId?: string;
    query?: string;
    limit?: number;
  } = {}): Promise<SlackMessagePreview[]> => {
    if (!organizationId.value) return [];
    const callable = httpsCallable<
      { organizationId: string; connectionId?: string; query?: string; limit?: number },
      { ok: boolean; messages: SlackMessagePreview[] }
    >(functions(), "list_slack_messages");
    const res = await callable({
      organizationId: organizationId.value,
      connectionId: params.connectionId || sharedConnection.value.id,
      query: params.query?.trim() || undefined,
      limit: params.limit,
    });
    return res.data.messages ?? [];
  };

  return {
    clientId,
    connection: sharedConnection,
    connections: sharedConnections,
    isLoading: sharedIsLoading,
    connect,
    disconnect,
    listMessages,
    refreshConnection,
    refreshConnections,
    testConnection,
  };
}
