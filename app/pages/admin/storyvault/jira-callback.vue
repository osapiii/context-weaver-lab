<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-6">
    <div class="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <UIcon name="i-simple-icons-jira" class="mx-auto h-8 w-8 text-[#1868DB]" />
      <p class="mt-3 text-sm font-semibold text-slate-900">
        Jira 接続を処理しています
      </p>
      <UIcon
        name="i-heroicons-arrow-path"
        class="mx-auto mt-3 h-5 w-5 animate-spin text-slate-500"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  appendJiraOAuthDebug,
  JIRA_OAUTH_STATE_FALLBACK_STORAGE_KEY,
  JIRA_OAUTH_STATE_STORAGE_KEY,
} from "@composables/useJiraOAuth";
import {
  reportDatadogError,
  reportDatadogInfo,
  waitForDatadogObservability,
} from "@utils/datadogObservability";

const FUNCTIONS_REGION = "asia-northeast1";

definePageMeta({ layout: false });
defineOptions({ name: "AdminStoryVaultJiraCallbackPage" });
useHead({ title: "Jira 接続" });

type JiraOAuthState = {
  provider?: string;
  organizationId?: string;
  redirectUri?: string;
  returnPath?: string;
  nonce?: string;
  createdAt?: number;
};

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return window.atob(
    base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
  );
}

function decodeState(value: unknown): JiraOAuthState {
  if (typeof value !== "string" || !value) return {};
  try {
    const decoded = JSON.parse(decodeBase64Url(value));
    return decoded && typeof decoded === "object" ? decoded : {};
  } catch {
    return {};
  }
}

function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin/preferences?tab=oauth-connections";
  }
  if (value.startsWith("/admin/storyvault/jira-callback")) {
    return "/admin/preferences?tab=oauth-connections";
  }
  return value;
}

function waitForAuthUser(): Promise<User | null> {
  const auth = getAuth();
  if (auth.currentUser) {
    appendJiraOAuthDebug("callback:authAlreadyReady", {
      uid: auth.currentUser.uid,
    });
    return Promise.resolve(auth.currentUser);
  }
  appendJiraOAuthDebug("callback:waitForAuth", {});
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      appendJiraOAuthDebug("callback:waitForAuthTimeout", {
        hasCurrentUser: Boolean(auth.currentUser),
      });
      resolve(auth.currentUser);
    }, 8_000);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsubscribe();
      appendJiraOAuthDebug("callback:authStateChanged", {
        hasUser: Boolean(user),
        uid: user?.uid,
      });
      resolve(user);
    });
  });
}

function readStoredOAuthState(): string {
  const keys = [
    JIRA_OAUTH_STATE_STORAGE_KEY,
    JIRA_OAUTH_STATE_FALLBACK_STORAGE_KEY,
  ];
  for (const key of keys) {
    try {
      const value = window.sessionStorage.getItem(key);
      if (value) return value;
    } catch {
      // Continue to the cross-tab fallback below.
    }
    try {
      const value = window.localStorage.getItem(key);
      if (value) return value;
    } catch {
      // Storage may be unavailable in a privacy-restricted browser.
    }
  }
  return "";
}

function clearStoredOAuthState(): void {
  for (const key of [
    JIRA_OAUTH_STATE_STORAGE_KEY,
    JIRA_OAUTH_STATE_FALLBACK_STORAGE_KEY,
  ]) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore unavailable session storage.
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore unavailable local storage.
    }
  }
}

function redactCallbackUrl(): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ["code", "state", "error", "error_description"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState(
      window.history.state,
      document.title,
      `${url.pathname}${url.search}${url.hash}`
    );
  }
}

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  await waitForDatadogObservability();
  const stateQuery = route.query.state;
  const codeQuery = route.query.code;
  const errorQuery = route.query.error;
  const errorDescriptionQuery = route.query.error_description;
  const state = decodeState(stateQuery);
  const returnPath = safeReturnPath(state.returnPath);
  appendJiraOAuthDebug("callback:mounted", {
    path: window.location.pathname,
    queryKeys: Object.keys(route.query),
    hasCode: typeof codeQuery === "string" && codeQuery.length > 0,
    codeLength: typeof codeQuery === "string" ? codeQuery.length : 0,
    hasError: Boolean(errorQuery || errorDescriptionQuery),
    hasState: Boolean(stateQuery),
    stateLength: typeof stateQuery === "string" ? stateQuery.length : 0,
    decodedProvider: state.provider,
    decodedHasOrganizationId: Boolean(state.organizationId),
    decodedReturnPath: state.returnPath,
    decodedRedirectUri: state.redirectUri,
  });
  try {
    const oauthError =
      typeof errorDescriptionQuery === "string"
        ? errorDescriptionQuery
        : typeof errorQuery === "string"
          ? errorQuery
          : "";
    if (oauthError) {
      appendJiraOAuthDebug("callback:oauthError", { error: oauthError });
      throw new Error(oauthError);
    }
    const storedState = readStoredOAuthState();
    clearStoredOAuthState();
    appendJiraOAuthDebug("callback:storedState", {
      found: Boolean(storedState),
      length: storedState.length,
    });
    let expectedNonce = "";
    let expectedOrganizationId = "";
    if (storedState) {
      try {
        const parsed = JSON.parse(storedState);
        expectedNonce = typeof parsed?.nonce === "string" ? parsed.nonce : "";
        expectedOrganizationId =
          typeof parsed?.organizationId === "string" ? parsed.organizationId : "";
        const createdAt = Number(parsed?.createdAt || 0);
        if (createdAt && Date.now() - createdAt > 15 * 60 * 1000) {
          expectedNonce = "";
          expectedOrganizationId = "";
        }
      } catch {
        // Invalid session state is rejected below.
      }
    }
    if (
      !state.nonce ||
      !expectedNonce ||
      state.nonce !== expectedNonce ||
      (expectedOrganizationId && state.organizationId !== expectedOrganizationId)
    ) {
      appendJiraOAuthDebug("callback:stateValidation:error", {
        hasStateNonce: Boolean(state.nonce),
        hasStoredNonce: Boolean(expectedNonce),
        organizationMatches:
          !expectedOrganizationId || state.organizationId === expectedOrganizationId,
      });
      throw new Error("Jira OAuth stateの検証に失敗しました。もう一度接続してください");
    }
    if (state.provider !== "jira") {
      appendJiraOAuthDebug("callback:stateValidation:error", {
        provider: state.provider || "",
      });
      throw new Error("Jira OAuth stateが不正です。もう一度接続してください");
    }
    const code = typeof codeQuery === "string" ? codeQuery : "";
    if (!code) throw new Error("Jira 認可コードを取得できませんでした");
    if (!state.organizationId) throw new Error("Jira 接続先の組織情報を取得できませんでした");
    if (import.meta.client) redactCallbackUrl();
    appendJiraOAuthDebug("callback:stateValidation:success", {
      organizationId: state.organizationId,
      returnPath,
    });
    const user = await waitForAuthUser();
    if (!user) throw new Error("Jira 接続を完了するにはログインが必要です");
    const redirectUri =
      state.redirectUri || `${window.location.origin}/admin/storyvault/jira-callback`;
    const callable = httpsCallable<
      { organizationId: string; code: string; redirectUri: string },
      { ok: boolean }
    >(getFunctions(getApp(), FUNCTIONS_REGION), "connect_jira_site");
    appendJiraOAuthDebug("callback:callConnectJira:start", {
      uid: user.uid,
      organizationId: state.organizationId,
      redirectUri,
      codeLength: code.length,
    });
    const response = await callable({
      organizationId: state.organizationId,
      code,
      redirectUri,
    });
    appendJiraOAuthDebug("callback:callConnectJira:success", {
      ok: response.data.ok,
    });
    reportDatadogInfo("[Jira OAuth] callback completed", {
      organizationId: state.organizationId,
      ok: response.data.ok,
    });
    appendJiraOAuthDebug("callback:redirectSuccess", { returnPath });
    await router.replace(returnPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Jira 接続に失敗しました";
    appendJiraOAuthDebug("callback:error", {
      message,
      name: error instanceof Error ? error.name : "",
      returnPath,
    });
    reportDatadogError(error, {
      flow: "jira_oauth_callback",
      returnPath,
    });
    await router.replace({
      path: "/admin/preferences",
      query: { tab: "oauth-connections", jiraOAuthError: message },
    });
  }
});
</script>
