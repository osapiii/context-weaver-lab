<template>
  <EnCard variant="kpi" padding="spacious">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <UIcon name="i-simple-icons-jira" class="h-5 w-5 text-[#1868DB]" />
            <h2 class="text-lg font-semibold text-neutral-900">
              Jira Cloud OAuth
            </h2>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-neutral-600">
            Issue、Epic、Sprintの情報を操作クリップの関連コンテキストとして参照します。
            Atlassian OAuth 2.0 (3LO)で、複数のJira Cloud siteを接続できます。
            <span class="mt-1 block text-xs text-neutral-500">
              コールバック:
              <code>{{ callbackUrl }}</code>
            </span>
          </p>
        </div>
        <EnBadge
          :color="connections.length ? 'success' : isLoading ? 'neutral' : 'warning'"
          variant="soft"
          :leading-icon="connections.length ? 'i-heroicons-check-circle' : isLoading ? 'i-heroicons-arrow-path' : 'i-heroicons-exclamation-triangle'"
        >
          {{ connections.length ? `${connections.length} site` : isLoading ? "確認中" : "未接続" }}
        </EnBadge>
      </div>
    </template>

    <div class="space-y-4">
      <div
        v-if="!jira.clientId.value"
        class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
      >
        Atlassian 3LO appのClient IDが未設定です。
        <code>NUXT_PUBLIC_JIRA_OAUTH_CLIENT_ID</code>
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
          Jira OAuth debug log
          <span v-if="latestDebugEvent" class="ml-2 font-normal text-neutral-500">
            最新: {{ latestDebugEvent }}
          </span>
        </summary>
        <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all">{{ formattedDebugEntries }}</pre>
      </details>

      <div class="flex flex-wrap gap-2">
        <EnButton
          variant="solid"
          color="primary"
          size="sm"
          leading-icon="i-simple-icons-jira"
          custom-class="bg-[#1868DB] text-white hover:bg-[#1558b7] active:bg-[#0f4c9e] focus-visible:ring-[#1868DB] disabled:bg-[#1868DB]/70"
          :loading="jira.isLoading.value"
          @click="connect"
        >
          Jira Cloud siteを追加
        </EnButton>
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="i-heroicons-arrow-path"
          :loading="jira.isLoading.value"
          @click="refresh"
        >
          更新
        </EnButton>
      </div>

      <div
        v-if="connections.length === 0 && isLoading"
        class="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center"
      >
        <UIcon name="i-heroicons-arrow-path" class="mx-auto h-8 w-8 animate-spin text-[#1868DB]" />
        <p class="mt-3 text-sm font-semibold text-neutral-800">
          Jira接続状態を確認しています
        </p>
        <p class="mt-1 text-xs text-neutral-500">
          組織情報の読み込み後に接続済みsiteを取得します。
        </p>
      </div>

      <div
        v-else-if="connections.length === 0"
        class="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center"
      >
        <UIcon name="i-simple-icons-jira" class="mx-auto h-8 w-8 text-[#1868DB]" />
        <p class="mt-3 text-sm font-semibold text-neutral-800">
          Jira Cloud siteはまだ接続されていません
        </p>
        <p class="mt-1 text-xs text-neutral-500">
          Atlassianの認可画面でStoryVaultが参照するsiteを選択します。
        </p>
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-neutral-200">
        <table class="min-w-full divide-y divide-neutral-200 text-sm">
          <thead class="bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
            <tr>
              <th class="px-3 py-2">Site</th>
              <th class="px-3 py-2">Cloud ID</th>
              <th class="px-3 py-2">Scope</th>
              <th class="px-3 py-2"><span class="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 bg-white">
            <tr v-for="connection in connections" :key="connection.cloudId">
              <td class="px-3 py-3">
                <a
                  :href="connection.siteUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-neutral-900 hover:text-[#1868DB]"
                >
                  {{ connection.siteName || connection.siteUrl || "Jira Cloud" }}
                </a>
                <p class="mt-0.5 text-xs text-neutral-500">{{ connection.siteUrl }}</p>
              </td>
              <td class="px-3 py-3 font-mono text-xs text-neutral-600">
                {{ connection.cloudId }}
              </td>
              <td class="max-w-[360px] truncate px-3 py-3 text-xs text-neutral-600">
                {{ connection.scopes.join(", ") || "未取得" }}
              </td>
              <td class="px-3 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <EnButton
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    leading-icon="i-heroicons-arrow-path"
                    :loading="testingCloudId === connection.cloudId"
                    @click="testConnection(connection.cloudId)"
                  >
                    確認
                  </EnButton>
                  <EnButton
                    variant="ghost"
                    color="error"
                    size="xs"
                    leading-icon="material-symbols:link-off"
                    :loading="removingCloudId === connection.cloudId"
                    @click="disconnect(connection.cloudId)"
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

const jira = useJiraOAuth();
const route = useRoute();
const errorMessage = ref("");
const testingCloudId = ref("");
const removingCloudId = ref("");
const debugEntries = ref<unknown[]>([]);
const connections = computed(() => jira.connections.value);
const isLoading = computed(() => jira.isLoading.value);
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
    const raw = localStorage.getItem("storyvault-jira-oauth-debug") || "[]";
    const parsed = JSON.parse(raw);
    debugEntries.value = Array.isArray(parsed) ? parsed.slice(-12).reverse() : [];
  } catch {
    debugEntries.value = [];
  }
};
const callbackUrl = computed(() => {
  if (typeof window === "undefined") return "/admin/storyvault/jira-callback";
  return `${window.location.origin}/admin/storyvault/jira-callback`;
});

const refresh = async (): Promise<void> => {
  errorMessage.value = "";
  try {
    await jira.refreshConnections();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Jira接続状態の取得に失敗しました";
  } finally {
    loadDebugEntries();
  }
};

const connect = async (): Promise<void> => {
  errorMessage.value = "";
  try {
    await jira.connect();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Jira接続の開始に失敗しました";
  }
};

const disconnect = async (cloudId: string): Promise<void> => {
  if (!confirm("Jira Cloud siteの接続を解除します。よろしいですか?")) return;
  removingCloudId.value = cloudId;
  errorMessage.value = "";
  try {
    await jira.disconnect(cloudId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Jira接続の解除に失敗しました";
  } finally {
    removingCloudId.value = "";
  }
};

const testConnection = async (cloudId: string): Promise<void> => {
  testingCloudId.value = cloudId;
  errorMessage.value = "";
  try {
    await jira.testConnection(cloudId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Jira接続確認に失敗しました";
  } finally {
    testingCloudId.value = "";
  }
};

onMounted(() => {
  if (typeof route.query.jiraOAuthError === "string") {
    errorMessage.value = route.query.jiraOAuthError;
  }
  loadDebugEntries();
  void refresh();
});
</script>
