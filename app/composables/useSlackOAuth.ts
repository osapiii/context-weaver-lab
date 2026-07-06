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
const SLACK_USER_SCOPES = "search:read";

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

type SlackCodeMessage = {
  source: "storyvault-slack-oauth";
  code?: string;
  error?: string;
  state?: string;
};

type SlackConnectionsResponse = {
  ok: boolean;
  connections: SlackConnection[];
};

type SlackConnectResponse = {
  ok: boolean;
  connection?: SlackConnection;
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

function createSlackState(organizationId: string): string {
  return encodeBase64Url(
    JSON.stringify({
      provider: "slack",
      organizationId,
      nonce: randomNonce(),
      openerOrigin: window.location.origin,
    })
  );
}

function waitForSlackCode(popup: Window | null, state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!popup) {
      reject(new Error("Slack OAuth popup を開けませんでした"));
      return;
    }
    let settled = false;
    let closeGraceTimeout: number | undefined;
    const timeout = window.setTimeout(() => {
      settle(() => reject(new Error("Slack OAuth がタイムアウトしました")));
    }, 120_000);
    const poll = window.setInterval(() => {
      if (popup.closed && closeGraceTimeout === undefined) {
        closeGraceTimeout = window.setTimeout(() => {
          settle(() => reject(new Error("Slack OAuth popup が閉じられました")));
        }, 2_000);
      }
    }, 500);
    const onMessage = (event: MessageEvent<SlackCodeMessage>) => {
      const payload = event.data;
      if (!payload || payload.source !== "storyvault-slack-oauth") return;
      if (payload.state !== state) return;
      if (payload.error) {
        settle(() => reject(new Error(payload.error)));
        return;
      }
      if (!payload.code) {
        settle(() => reject(new Error("Slack 認可コードを取得できませんでした")));
        return;
      }
      const code = payload.code;
      settle(() => resolve(code));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(poll);
      if (closeGraceTimeout !== undefined) {
        window.clearTimeout(closeGraceTimeout);
      }
      window.removeEventListener("message", onMessage);
      try {
        popup.close();
      } catch {
        // noop
      }
    };
    const settle = (complete: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      complete();
    };
    window.addEventListener("message", onMessage);
  });
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
      return sharedConnections.value;
    }
    const callable = httpsCallable<
      { organizationId: string },
      SlackConnectionsResponse
    >(functions(), "get_slack_connections");
    const res = await callable({ organizationId: organizationId.value });
    sharedConnections.value = (res.data.connections ?? []).map((connection) => ({
      ...connection,
      connected: true,
    }));
    return sharedConnections.value;
  };

  const refreshConnection = async (): Promise<SlackConnection> => {
    await refreshConnections();
    return sharedConnection.value;
  };

  const connect = async (): Promise<boolean> => {
    if (!clientId.value) {
      toast.add({
        title: "Slack OAuth client が未設定です",
        description: "NUXT_PUBLIC_SLACK_OAUTH_CLIENT_ID を設定してください",
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
      const state = createSlackState(organizationId.value);
      const redirectUri = slackCallbackUrl(configuredRedirectUri.value);
      const url = new URL(SLACK_AUTHORIZE_URL);
      url.searchParams.set("client_id", clientId.value);
      url.searchParams.set("scope", SLACK_SCOPES);
      url.searchParams.set("user_scope", SLACK_USER_SCOPES);
      url.searchParams.set("state", state);
      url.searchParams.set("redirect_uri", redirectUri);
      const popup = window.open(
        url.toString(),
        "storyvault-slack-oauth",
        "width=720,height=760"
      );
      const code = await waitForSlackCode(popup, state);
      const callable = httpsCallable<
        { organizationId: string; code: string; redirectUri: string },
        SlackConnectResponse
      >(functions(), "connect_slack_workspace");
      const res = await callable({
        organizationId: organizationId.value,
        code,
        redirectUri,
      });
      await refreshConnections();
      toast.add({
        title: "Slack workspace を接続しました",
        description: res.data.connection?.teamName || undefined,
        color: "success",
      });
      return true;
    } catch (error) {
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
