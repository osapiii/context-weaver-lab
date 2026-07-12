<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-6">
    <div class="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <UIcon
        name="i-simple-icons-slack"
        class="mx-auto h-8 w-8 text-slate-900"
      />
      <p class="mt-3 text-sm font-semibold text-slate-900">
        Slack 接続を処理しています
      </p>
      <p class="mt-1 text-xs text-slate-500">
        このウィンドウは自動で閉じます。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import log from "@utils/logger";

const FUNCTIONS_REGION = "asia-northeast1";
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

definePageMeta({
  layout: false,
});

defineOptions({
  name: "AdminStoryVaultSlackCallbackPage",
});

useHead({
  title: "Slack 接続",
});

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return window.atob(padded);
}

type SlackOAuthState = {
  provider?: string;
  organizationId?: string;
  redirectUri?: string;
  returnPath?: string;
  openerOrigin?: string;
};

function decodeSlackState(state: unknown): SlackOAuthState {
  if (typeof state !== "string" || !state) return {};
  try {
    const decoded = JSON.parse(decodeBase64Url(state));
    return decoded && typeof decoded === "object" ? decoded : {};
  } catch {
    return {};
  }
}

function openerOriginFromState(state: unknown): string | null {
  const decoded = decodeSlackState(state);
  return typeof decoded.openerOrigin === "string" ? decoded.openerOrigin : null;
}

function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin/preferences";
  }
  if (value.startsWith("/admin/storyvault/slack-callback")) {
    return "/admin/preferences";
  }
  return value;
}

function waitForAuthUser(): Promise<User | null> {
  const auth = getAuth();
  if (auth.currentUser) {
    appendSlackOAuthDebug("callback:authAlreadyReady", {
      uid: auth.currentUser.uid,
    });
    return Promise.resolve(auth.currentUser);
  }
  appendSlackOAuthDebug("callback:waitForAuth", {});
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      appendSlackOAuthDebug("callback:waitForAuthTimeout", {
        hasCurrentUser: Boolean(auth.currentUser),
      });
      resolve(auth.currentUser);
    }, 8_000);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsubscribe();
      appendSlackOAuthDebug("callback:authStateChanged", {
        hasUser: Boolean(user),
        uid: user?.uid,
      });
      resolve(user);
    });
  });
}

async function connectFromCallback(params: {
  code: string;
  organizationId: string;
  redirectUri: string;
}): Promise<void> {
  const user = await waitForAuthUser();
  if (!user) {
    throw new Error("Slack 接続を完了するにはログインが必要です");
  }
  appendSlackOAuthDebug("callback:callConnectSlackWorkspace:start", {
    uid: user.uid,
    organizationId: params.organizationId,
    redirectUri: params.redirectUri,
    codeLength: params.code.length,
  });
  const callable = httpsCallable<
    { organizationId: string; code: string; redirectUri: string },
    { ok: boolean }
  >(getFunctions(getApp(), FUNCTIONS_REGION), "connect_slack_workspace");
  const res = await callable(params);
  appendSlackOAuthDebug("callback:callConnectSlackWorkspace:success", {
    ok: res.data.ok,
  });
}

onMounted(async () => {
  const route = useRoute();
  const router = useRouter();
  const state = typeof route.query.state === "string" ? route.query.state : undefined;
  const decodedState = decodeSlackState(state);
  appendSlackOAuthDebug("callback:mounted", {
    path: window.location.pathname,
    queryKeys: Object.keys(route.query),
    hasCode: Boolean(route.query.code),
    hasError: Boolean(route.query.error || route.query.error_description),
    hasState: Boolean(state),
    stateLength: state?.length ?? 0,
    decodedProvider: decodedState.provider,
    decodedHasOrganizationId: Boolean(decodedState.organizationId),
    decodedReturnPath: decodedState.returnPath,
    decodedRedirectUri: decodedState.redirectUri,
    hasOpener: Boolean(window.opener),
  });
  const payload = {
    source: "storyvault-slack-oauth",
    code: typeof route.query.code === "string" ? route.query.code : undefined,
    error:
      typeof route.query.error === "string"
        ? route.query.error
        : typeof route.query.error_description === "string"
          ? route.query.error_description
          : undefined,
    state,
  };
  const targetOrigin = openerOriginFromState(state) || window.location.origin;
  window.opener?.postMessage(payload, targetOrigin);
  window.opener?.postMessage(payload, window.location.origin);
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("storyvault-slack-oauth");
    channel.postMessage(payload);
    channel.close();
  }
  if (state) {
    localStorage.setItem(
      `storyvault-slack-oauth:${state}`,
      JSON.stringify({ ...payload, deliveredAt: Date.now() })
    );
  }
  const returnPath = safeReturnPath(decodedState.returnPath);
  appendSlackOAuthDebug("callback:directFlow:start", {
    returnPath,
    hasCode: Boolean(payload.code),
    hasError: Boolean(payload.error),
  });
  try {
    if (payload.error) {
      throw new Error(payload.error);
    }
    if (!payload.code) {
      throw new Error("Slack 認可コードを取得できませんでした");
    }
    if (!decodedState.organizationId || typeof decodedState.organizationId !== "string") {
      throw new Error("Slack 接続先の組織情報を取得できませんでした");
    }
    const redirectUri =
      typeof decodedState.redirectUri === "string" && decodedState.redirectUri
        ? decodedState.redirectUri
        : `${window.location.origin}/admin/storyvault/slack-callback`;
    await connectFromCallback({
      organizationId: decodedState.organizationId,
      code: payload.code,
      redirectUri,
    });
    appendSlackOAuthDebug("callback:directFlow:redirectSuccess", {
      returnPath,
      hasOpener: Boolean(window.opener),
    });
    if (window.opener) {
      window.opener.postMessage({ ...payload, connected: true }, targetOrigin);
      window.setTimeout(() => {
        window.close();
      }, 300);
      return;
    }
    await router.replace(returnPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Slack 接続に失敗しました";
    appendSlackOAuthDebug("callback:directFlow:error", {
      message,
      name: error instanceof Error ? error.name : "",
      returnPath,
    });
    if (window.opener) {
      window.opener.postMessage(
        { ...payload, error: message, connected: false },
        targetOrigin
      );
      window.setTimeout(() => {
        window.close();
      }, 300);
      return;
    }
    await router.replace({
      path: returnPath.split("?")[0] || "/admin/preferences",
      query: { slackOAuthError: message },
    });
  }
});
</script>
