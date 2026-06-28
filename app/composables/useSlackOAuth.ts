import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import log from "@utils/logger";

const FUNCTIONS_REGION = "asia-northeast1";
const SLACK_SCOPES =
  "search:read,channels:read,channels:history,groups:read,groups:history";

export type SlackConnection = {
  connected: boolean;
  teamId?: string;
  teamName?: string;
  slackUserId?: string;
  scopes?: string[];
};

type SlackCodeMessage = {
  source: "vibe-control-slack-oauth";
  code?: string;
  error?: string;
  state?: string;
};

const sharedIsLoading = ref(false);
const sharedConnection = ref<SlackConnection>({ connected: false });

function slackCallbackUrl(configuredRedirectUri?: string): string {
  const configured = (configuredRedirectUri || "").trim();
  if (configured) return configured;
  const origin = new URL(window.location.origin);
  if (origin.hostname === "localhost") {
    origin.hostname = "127.0.0.1";
  }
  return `${origin.toString().replace(/\/$/, "")}/admin/vibe-control/slack-callback`;
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

function createSlackState(): string {
  return encodeBase64Url(
    JSON.stringify({
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
      if (!payload || payload.source !== "vibe-control-slack-oauth") return;
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

  const refreshConnection = async (): Promise<SlackConnection> => {
    if (!organizationId.value) {
      sharedConnection.value = { connected: false };
      return sharedConnection.value;
    }
    const callable = httpsCallable<
      { organizationId: string },
      SlackConnection
    >(functions(), "get_slack_connection");
    const res = await callable({ organizationId: organizationId.value });
    sharedConnection.value = res.data;
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
      const state = createSlackState();
      const redirectUri = configuredRedirectUri.value
        ? slackCallbackUrl(configuredRedirectUri.value)
        : "";
      const url = new URL("https://slack.com/oauth/v2/authorize");
      url.searchParams.set("client_id", clientId.value);
      url.searchParams.set("scope", SLACK_SCOPES);
      url.searchParams.set("state", state);
      if (redirectUri) {
        url.searchParams.set("redirect_uri", redirectUri);
      }
      const popup = window.open(
        url.toString(),
        "vibe-control-slack-oauth",
        "width=720,height=760"
      );
      const code = await waitForSlackCode(popup, state);
      const callable = httpsCallable<
        { organizationId: string; code: string; redirectUri?: string },
        {
          ok: boolean;
          teamId?: string;
          teamName?: string;
          slackUserId?: string;
          scopes?: string[];
        }
      >(functions(), "connect_slack");
      const res = await callable({
        organizationId: organizationId.value,
        code,
        ...(redirectUri ? { redirectUri } : {}),
      });
      sharedConnection.value = {
        connected: Boolean(res.data.ok),
        teamId: res.data.teamId,
        teamName: res.data.teamName,
        slackUserId: res.data.slackUserId,
        scopes: res.data.scopes,
      };
      toast.add({
        title: "Slack を接続しました",
        description: res.data.teamName || undefined,
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

  const disconnect = async (): Promise<void> => {
    if (!organizationId.value) return;
    sharedIsLoading.value = true;
    try {
      const callable = httpsCallable<{ organizationId: string }, { ok: boolean }>(
        functions(),
        "disconnect_slack"
      );
      await callable({ organizationId: organizationId.value });
      sharedConnection.value = { connected: false };
    } finally {
      sharedIsLoading.value = false;
    }
  };

  const testConnection = async (): Promise<boolean> => {
    if (!organizationId.value) return false;
    const callable = httpsCallable<{ organizationId: string }, { ok: boolean }>(
      functions(),
      "test_slack_connection"
    );
    const res = await callable({ organizationId: organizationId.value });
    return Boolean(res.data.ok);
  };

  return {
    clientId,
    connection: sharedConnection,
    isLoading: sharedIsLoading,
    connect,
    disconnect,
    refreshConnection,
    testConnection,
  };
}
