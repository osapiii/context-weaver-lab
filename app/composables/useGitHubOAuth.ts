import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import log from "@utils/logger";

const FUNCTIONS_REGION = "asia-northeast1";
const GITHUB_SCOPES = "repo read:user";

export type GitHubConnection = {
  connected: boolean;
  login?: string;
  scopes?: string[];
};

export type GitHubRepositorySummary = {
  id: number;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  language: string;
  stargazersCount: number;
  forksCount: number;
  watchersCount: number;
  pushedAt: string;
  updatedAt: string;
};

export type GitHubMergedPullRequest = {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  author: string;
  mergedAt: string;
  createdAt: string;
  updatedAt: string;
  baseBranch: string;
  headBranch: string;
  labels: string[];
  changedFiles: number;
  additions: number;
  deletions: number;
};

type GitHubCodeMessage = {
  source: "vibe-control-github-oauth";
  code?: string;
  error?: string;
  state?: string;
};

type GitHubConnectOptions = {
  switchAccount?: boolean;
};

const sharedIsLoading = ref(false);
const sharedConnection = ref<GitHubConnection>({ connected: false });
const sharedRepositories = ref<GitHubRepositorySummary[]>([]);

function githubCallbackUrl(): string {
  return `${window.location.origin}/admin/vibe-control/github-callback`;
}

function randomState(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function waitForGitHubCode(
  popup: Window | null,
  state: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!popup) {
      reject(new Error("GitHub OAuth popup を開けませんでした"));
      return;
    }

    let settled = false;
    let closeGraceTimeout: number | undefined;

    const timeout = window.setTimeout(() => {
      settle(() => reject(new Error("GitHub OAuth がタイムアウトしました")));
    }, 120_000);

    const poll = window.setInterval(() => {
      if (popup.closed && closeGraceTimeout === undefined) {
        closeGraceTimeout = window.setTimeout(() => {
          settle(() =>
            reject(new Error("GitHub OAuth popup が閉じられました"))
          );
        }, 2_000);
      }
    }, 500);

    const onMessage = (event: MessageEvent<GitHubCodeMessage>) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || payload.source !== "vibe-control-github-oauth") return;
      if (payload.state !== state) return;
      if (payload.error) {
        settle(() => reject(new Error(payload.error)));
        return;
      }
      if (!payload.code) {
        settle(() => reject(new Error("GitHub 認可コードを取得できませんでした")));
        return;
      }
      settle(() => resolve(payload.code));
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

export function useGitHubOAuth() {
  const runtimeConfig = useRuntimeConfig();
  const organizationStore = useOrganizationStore();
  const toast = useToast();

  const clientId = computed(() =>
    String(runtimeConfig.public.githubOAuthClientId || "").trim()
  );

  const organizationId = computed(
    () => organizationStore.loggedInOrganizationInfo?.id || ""
  );

  const functions = () => getFunctions(getApp(), FUNCTIONS_REGION);

  const refreshConnection = async (): Promise<GitHubConnection> => {
    if (!organizationId.value) {
      sharedConnection.value = { connected: false };
      return sharedConnection.value;
    }
    const callable = httpsCallable<
      { organizationId: string },
      GitHubConnection
    >(functions(), "get_github_connection");
    const res = await callable({ organizationId: organizationId.value });
    sharedConnection.value = res.data;
    return sharedConnection.value;
  };

  const connect = async (options: GitHubConnectOptions = {}): Promise<boolean> => {
    if (!clientId.value) {
      toast.add({
        title: "GitHub OAuth client が未設定です",
        description: "NUXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID を設定してください",
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
      const state = randomState();
      const redirectUri = githubCallbackUrl();
      const url = new URL("https://github.com/login/oauth/authorize");
      url.searchParams.set("client_id", clientId.value);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", GITHUB_SCOPES);
      url.searchParams.set("state", state);
      url.searchParams.set("allow_signup", "false");
      if (options.switchAccount) {
        url.searchParams.set("prompt", "select_account");
      }
      const popup = window.open(
        url.toString(),
        "vibe-control-github-oauth",
        "width=720,height=760"
      );
      const code = await waitForGitHubCode(popup, state);
      const callable = httpsCallable<
        { organizationId: string; code: string; redirectUri: string },
        { ok: boolean; login?: string; scopes?: string[] }
      >(functions(), "connect_github");
      const res = await callable({
        organizationId: organizationId.value,
        code,
        redirectUri,
      });
      sharedConnection.value = {
        connected: Boolean(res.data.ok),
        login: res.data.login,
        scopes: res.data.scopes,
      };
      toast.add({
        title: "GitHub を接続しました",
        description: res.data.login || undefined,
        color: "success",
      });
      return true;
    } catch (error) {
      log("ERROR", "GitHub OAuth connect failed", error);
      toast.add({
        title: "GitHub 接続に失敗しました",
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
        "disconnect_github"
      );
      await callable({ organizationId: organizationId.value });
      sharedConnection.value = { connected: false };
      sharedRepositories.value = [];
    } finally {
      sharedIsLoading.value = false;
    }
  };

  const listRepositories = async (): Promise<GitHubRepositorySummary[]> => {
    if (!organizationId.value) return [];
    const callable = httpsCallable<
      { organizationId: string },
      { repositories: GitHubRepositorySummary[] }
    >(functions(), "list_github_repositories");
    const res = await callable({ organizationId: organizationId.value });
    sharedRepositories.value = res.data.repositories ?? [];
    return sharedRepositories.value;
  };

  const getRepository = async (
    repoFullName: string
  ): Promise<GitHubRepositorySummary | null> => {
    if (!organizationId.value || !repoFullName) return null;
    const callable = httpsCallable<
      { organizationId: string; repoFullName: string },
      { repository: GitHubRepositorySummary }
    >(functions(), "get_github_repository");
    const res = await callable({
      organizationId: organizationId.value,
      repoFullName,
    });
    return res.data.repository ?? null;
  };

  const listMergedPullRequests = async (
    repoFullName: string
  ): Promise<GitHubMergedPullRequest[]> => {
    if (!organizationId.value || !repoFullName) return [];
    const callable = httpsCallable<
      { organizationId: string; repoFullName: string; limit: number },
      { pullRequests: GitHubMergedPullRequest[] }
    >(functions(), "list_github_merged_pull_requests");
    const res = await callable({
      organizationId: organizationId.value,
      repoFullName,
      limit: 30,
    });
    return res.data.pullRequests ?? [];
  };

  return {
    clientId,
    connection: sharedConnection,
    repositories: sharedRepositories,
    isLoading: sharedIsLoading,
    connect,
    disconnect,
    refreshConnection,
    listRepositories,
    getRepository,
    listMergedPullRequests,
  };
}
