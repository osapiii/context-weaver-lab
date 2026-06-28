<template>
  <EnCard variant="kpi" padding="spacious">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <UIcon name="i-simple-icons-slack" class="h-5 w-5 text-neutral-900" />
            <h2 class="text-lg font-semibold text-neutral-900">
              Slack OAuth
            </h2>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-neutral-600">
            操作動画に関連するSlack投稿やスレッドを、関連コンテキストとして紐付けるための認証です。
            <span class="mt-1 block text-xs text-neutral-500">
              保存先:
              <code>organizations/{organizationId}/externalServiceConfigs/slackOAuth/users/{uid}</code>
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
          <dt class="font-semibold text-neutral-500">接続ワークスペース</dt>
          <dd class="mt-1 break-all font-medium text-neutral-900">
            {{ connection.connected ? connection.teamName || connection.teamId || "Slack workspace" : "未接続" }}
          </dd>
        </div>
        <div class="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <dt class="font-semibold text-neutral-500">利用 scope</dt>
          <dd class="mt-1 break-all font-medium text-neutral-900">
            {{ scopesLabel }}
          </dd>
        </div>
      </dl>

      <div
        v-if="!slack.clientId.value"
        class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
      >
        Slack OAuth client が未設定です。
        <code>NUXT_PUBLIC_SLACK_OAUTH_CLIENT_ID</code>
        を設定すると接続できます。
      </div>

      <div v-if="errorMessage" class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ errorMessage }}
      </div>

      <div class="flex flex-wrap gap-2">
        <EnButton
          variant="solid"
          :color="connection.connected ? 'success' : 'primary'"
          size="sm"
          leading-icon="i-simple-icons-slack"
          :loading="slack.isLoading.value"
          @click="connect"
        >
          {{ connection.connected ? "Slack を再接続" : "Slack を接続" }}
        </EnButton>
        <EnButton
          v-if="connection.connected"
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="i-heroicons-arrow-path"
          :loading="isTesting"
          @click="testConnection"
        >
          接続を確認
        </EnButton>
        <EnButton
          v-if="connection.connected"
          variant="outline"
          color="neutral"
          size="sm"
          :loading="slack.isLoading.value"
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

const slack = useSlackOAuth();
const errorMessage = ref("");
const isTesting = ref(false);
const connection = computed(() => slack.connection.value);

const scopesLabel = computed(() => {
  if (!connection.value.connected) {
    return "search:read channels:read channels:history groups:read groups:history";
  }
  const scopes = connection.value.scopes ?? [];
  return scopes.length ? scopes.join(" ") : "未取得";
});

const refresh = async (): Promise<void> => {
  errorMessage.value = "";
  try {
    await slack.refreshConnection();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Slack 接続状態の取得に失敗しました";
  }
};

const connect = async (): Promise<void> => {
  errorMessage.value = "";
  const ok = await slack.connect();
  if (ok) {
    await refresh();
  }
};

const disconnect = async (): Promise<void> => {
  if (!confirm("Slack 接続を解除します。よろしいですか?")) return;
  errorMessage.value = "";
  try {
    await slack.disconnect();
    await refresh();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Slack 接続の解除に失敗しました";
  }
};

const testConnection = async (): Promise<void> => {
  isTesting.value = true;
  errorMessage.value = "";
  try {
    await slack.testConnection();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Slack 接続確認に失敗しました";
  } finally {
    isTesting.value = false;
  }
};

onMounted(() => {
  void refresh();
});
</script>
