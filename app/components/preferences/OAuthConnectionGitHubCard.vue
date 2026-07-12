<template>
  <EnCard variant="kpi" padding="spacious">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <UIcon name="i-simple-icons-github" class="h-5 w-5 text-neutral-900" />
            <h2 class="text-lg font-semibold text-neutral-900">
              GitHub OAuth
            </h2>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-neutral-600">
            Private repository を App と 1:1 で接続するための認証です。
            App 登録時の repository 選択と、マージ済み PR 一覧の取得に使用します。
            <span class="mt-1 block text-xs text-neutral-500">
              保存先:
              <code>organizations/{organizationId}/externalServiceConfigs/githubOAuth/users/{uid}</code>
            </span>
          </p>
        </div>
        <EnBadge
          :color="connection.connected ? 'success' : 'warning'"
          variant="soft"
          :leading-icon="connection.connected ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'"
        >
          {{ connection.connected ? "接続済み" : "未接続" }}
        </EnBadge>
      </div>
    </template>

    <div class="space-y-4">
      <dl class="grid gap-3 text-sm md:grid-cols-2">
        <div class="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <dt class="font-semibold text-neutral-500">接続アカウント</dt>
          <dd class="mt-1 break-all font-medium text-neutral-900">
            {{ connection.connected ? connection.login || "GitHub アカウント" : "未接続" }}
          </dd>
        </div>
        <div class="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <dt class="font-semibold text-neutral-500">利用 scope</dt>
          <dd class="mt-1 break-all font-medium text-neutral-900">
            {{ scopesLabel }}
          </dd>
        </div>
        <div class="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <dt class="font-semibold text-neutral-500">Repository 取得</dt>
          <dd class="mt-1 font-medium text-neutral-900">
            {{ repositoriesLabel }}
          </dd>
        </div>
        <div class="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <dt class="font-semibold text-neutral-500">利用箇所</dt>
          <dd class="mt-1 font-medium text-neutral-900">
            App 登録 / アプリ詳細 / PR 一覧
          </dd>
        </div>
      </dl>

      <div
        v-if="!github.clientId.value"
        class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
      >
        GitHub OAuth client が未設定です。
        <code>NUXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID</code>
        を設定すると接続できます。
      </div>

      <div v-if="errorMessage" class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ errorMessage }}
      </div>

      <div class="flex flex-wrap gap-2">
        <EnButton
          variant="solid"
          color="neutral"
          size="sm"
          leading-icon="i-simple-icons-github"
          custom-class="bg-neutral-950 text-white hover:bg-neutral-800 active:bg-black focus-visible:ring-neutral-500 disabled:bg-neutral-950/70"
          :loading="github.isLoading.value"
          @click="connect"
        >
          {{ connection.connected ? "同じアカウントで再接続" : "GitHub を接続" }}
        </EnButton>
        <EnButton
          v-if="connection.connected"
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="i-heroicons-user-circle"
          :loading="github.isLoading.value"
          @click="switchAccount"
        >
          別アカウントで接続
        </EnButton>
        <EnButton
          v-if="connection.connected"
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="i-heroicons-arrow-path"
          :loading="repositoriesLoading"
          @click="loadRepositories"
        >
          Repository 一覧を確認
        </EnButton>
        <EnButton
          v-if="connection.connected"
          variant="outline"
          color="neutral"
          size="sm"
          :loading="github.isLoading.value"
          @click="disconnect"
        >
          接続を解除
        </EnButton>
      </div>
    </div>
  </EnCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import EnCard from "@components/EnCard.vue";

const github = useGitHubOAuth();
const repositoriesLoading = ref(false);
const repositoryCount = ref<number | null>(null);
const errorMessage = ref("");

const connection = computed(() => github.connection.value);

const scopesLabel = computed(() => {
  if (!connection.value.connected) return "repo read:user";
  const scopes = connection.value.scopes ?? [];
  return scopes.length ? scopes.join(" ") : "repo read:user";
});

const repositoriesLabel = computed(() => {
  if (!connection.value.connected) return "接続後に取得できます";
  if (repositoryCount.value === null) return "未確認";
  return `${repositoryCount.value} 件`;
});

const refresh = async (): Promise<void> => {
  errorMessage.value = "";
  try {
    await github.refreshConnection();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "GitHub 接続状態の取得に失敗しました";
  }
};

const connect = async (): Promise<void> => {
  errorMessage.value = "";
  const ok = await github.connect();
  if (ok) {
    await refresh();
    await loadRepositories();
  }
};

const switchAccount = async (): Promise<void> => {
  errorMessage.value = "";
  repositoryCount.value = null;
  const ok = await github.connect({ switchAccount: true });
  if (ok) {
    await refresh();
    await loadRepositories();
  }
};

const disconnect = async (): Promise<void> => {
  if (!confirm("GitHub 接続を解除します。よろしいですか?")) return;
  errorMessage.value = "";
  try {
    await github.disconnect();
    repositoryCount.value = null;
    await refresh();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "GitHub 接続の解除に失敗しました";
  }
};

const loadRepositories = async (): Promise<void> => {
  repositoriesLoading.value = true;
  errorMessage.value = "";
  try {
    const repositories = await github.listRepositories();
    repositoryCount.value = repositories.length;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "GitHub repository 一覧の取得に失敗しました";
  } finally {
    repositoriesLoading.value = false;
  }
};

onMounted(() => {
  void refresh();
});
</script>
