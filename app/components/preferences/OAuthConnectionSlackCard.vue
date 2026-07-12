<template>
  <EnCard variant="kpi" padding="spacious">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <UIcon name="logos:slack-icon" class="h-5 w-5" />
            <h2 class="text-lg font-semibold text-neutral-900">
              Slack Workspace OAuth
            </h2>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-neutral-600">
            操作動画に関連するSlack投稿やスレッドを、関連コンテキストとして紐付けるための認証です。
            複数の Slack workspace をOAuthだけで追加できます。
            <span class="mt-1 block text-xs text-neutral-500">
              保存先:
              <code>organizations/{organizationId}/externalServiceConfigs/slackIntegration/configs/{workspaceId}</code>
            </span>
          </p>
        </div>
        <EnBadge
          :color="connections.length ? 'success' : 'warning'"
          variant="soft"
          :leading-icon="connections.length ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'"
        >
          {{ connections.length ? `${connections.length} workspace` : "未接続" }}
        </EnBadge>
      </div>
    </template>

    <div class="space-y-4">
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

      <details
        v-if="debugEntries.length"
        open
        class="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700"
      >
        <summary class="cursor-pointer font-semibold text-neutral-800">
          Slack OAuth debug log
          <span v-if="latestDebugEvent" class="ml-2 font-normal text-neutral-500">
            最新: {{ latestDebugEvent }}
          </span>
        </summary>
        <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all">{{ formattedDebugEntries }}</pre>
      </details>

      <div class="flex flex-wrap gap-2">
        <EnButton
          variant="solid"
          color="purple"
          size="sm"
          leading-icon="logos:slack-icon"
          custom-class="bg-[#4A154B] text-white hover:bg-[#611f69] active:bg-[#3f0f40] focus-visible:ring-[#611f69] disabled:bg-[#4A154B]/70"
          :loading="slack.isLoading.value"
          @click="connect"
        >
          Slack workspace を追加
        </EnButton>
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="i-heroicons-arrow-path"
          :loading="slack.isLoading.value"
          @click="refresh"
        >
          更新
        </EnButton>
      </div>

      <div
        v-if="connections.length === 0"
        class="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center"
      >
        <UIcon name="logos:slack-icon" class="mx-auto h-8 w-8" />
        <p class="mt-3 text-sm font-semibold text-neutral-800">
          Slack workspace はまだ接続されていません
        </p>
        <p class="mt-1 text-xs text-neutral-500">
          SlackのOAuth画面からworkspaceを選ぶだけで追加できます。
        </p>
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-neutral-200">
        <table class="min-w-full divide-y divide-neutral-200 text-sm">
          <thead class="bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
            <tr>
              <th class="px-3 py-2">Workspace</th>
              <th class="px-3 py-2">Team ID</th>
              <th class="px-3 py-2">Bot</th>
              <th class="px-3 py-2">Scopes</th>
              <th class="px-3 py-2">
                <span class="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 bg-white">
            <tr v-for="connection in connections" :key="connection.id || connection.teamId">
              <td class="px-3 py-3 font-medium text-neutral-900">
                {{ connection.teamName || connection.enterpriseName || connection.id || "Slack workspace" }}
              </td>
              <td class="px-3 py-3 font-mono text-xs text-neutral-600">
                {{ connection.teamId || connection.enterpriseId || connection.id || "-" }}
              </td>
              <td class="px-3 py-3 font-mono text-xs text-neutral-600">
                {{ connection.botUserId || "-" }}
              </td>
              <td class="max-w-[320px] truncate px-3 py-3 text-xs text-neutral-600">
                {{ (connection.scopes ?? []).join(", ") || "未取得" }}
              </td>
              <td class="px-3 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <EnButton
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    leading-icon="i-heroicons-arrow-path"
                    :loading="testingConnectionId === connection.id"
                    @click="testConnection(connection.id)"
                  >
                    確認
                  </EnButton>
                  <EnButton
                    variant="ghost"
                    color="error"
                    size="xs"
                    leading-icon="material-symbols:link-off"
                    :loading="removingConnectionId === connection.id"
                    @click="disconnect(connection.id)"
                  >
                    解除
                  </EnButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
const testingConnectionId = ref("");
const removingConnectionId = ref("");
const debugEntries = ref<unknown[]>([]);
const connections = computed(() => slack.connections.value);
const latestDebugEvent = computed(() => {
  const first = debugEntries.value[0];
  if (!first || typeof first !== "object") return "";
  return String((first as { event?: unknown }).event || "");
});
const formattedDebugEntries = computed(() =>
  JSON.stringify(debugEntries.value, null, 2)
);

const loadDebugEntries = (): void => {
  try {
    const raw = localStorage.getItem("storyvault-slack-oauth-debug") || "[]";
    const parsed = JSON.parse(raw);
    debugEntries.value = Array.isArray(parsed) ? parsed.slice(-12).reverse() : [];
  } catch {
    debugEntries.value = [];
  }
};

const refresh = async (): Promise<void> => {
  errorMessage.value = "";
  try {
    await slack.refreshConnections();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Slack 接続状態の取得に失敗しました";
  } finally {
    loadDebugEntries();
  }
};

const connect = async (): Promise<void> => {
  errorMessage.value = "";
  const ok = await slack.connect();
  if (ok) {
    await refresh();
  }
};

const disconnect = async (connectionId?: string): Promise<void> => {
  if (!connectionId) return;
  if (!confirm("Slack workspace 接続を解除します。よろしいですか?")) return;
  removingConnectionId.value = connectionId;
  errorMessage.value = "";
  try {
    await slack.disconnect(connectionId);
    await refresh();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Slack 接続の解除に失敗しました";
  } finally {
    removingConnectionId.value = "";
  }
};

const testConnection = async (connectionId?: string): Promise<void> => {
  if (!connectionId) return;
  testingConnectionId.value = connectionId;
  errorMessage.value = "";
  try {
    await slack.testConnection(connectionId);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Slack 接続確認に失敗しました";
  } finally {
    testingConnectionId.value = "";
  }
};

onMounted(() => {
  const route = useRoute();
  if (typeof route.query.slackOAuthError === "string") {
    errorMessage.value = route.query.slackOAuthError;
  }
  loadDebugEntries();
  void refresh();
});
</script>
