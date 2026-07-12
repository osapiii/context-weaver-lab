<template>
  <EnCard variant="kpi" padding="spacious">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <UIcon name="logos:google-icon" class="h-5 w-5" />
            <h2 class="text-lg font-semibold text-neutral-900">
              Google Workspace 接続
            </h2>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-neutral-600">
            Drive / Sheets 操作は、接続した Google アカウント本人の権限で実行します。
            AI Studio のシート編集・データ取り込み・分析補助にも必要です。
          </p>
        </div>
        <EnBadge
          :color="workspaceConnection.connected ? 'success' : 'warning'"
          variant="soft"
          :leading-icon="workspaceConnection.connected ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'"
        >
          {{ workspaceConnection.connected ? "接続済み" : "未接続" }}
        </EnBadge>
      </div>
    </template>

    <dl class="space-y-2 text-sm text-neutral-600">
      <div class="flex flex-wrap justify-between gap-2">
        <dt class="font-semibold text-neutral-500">接続アカウント</dt>
        <dd class="break-all font-medium text-neutral-900">
          {{
            workspaceConnection.connected
              ? workspaceConnection.email || "Google アカウント"
              : "未接続"
          }}
        </dd>
      </div>
      <div class="flex flex-wrap justify-between gap-2">
        <dt class="font-semibold text-neutral-500">利用範囲</dt>
        <dd class="text-right text-neutral-800">
          Google Drive 読み取り・Excel 出力 / Google Sheets 読み書き
        </dd>
      </div>
    </dl>

    <div class="mt-4 flex flex-wrap gap-2">
      <EnButton
        variant="solid"
        :color="workspaceConnection.connected ? 'success' : 'primary'"
        size="sm"
        leading-icon="i-simple-icons-google"
        :loading="workspaceOAuthLoading"
        @click="connect"
      >
        {{ workspaceConnection.connected ? "再接続" : "Google アカウントを接続" }}
      </EnButton>
      <EnButton
        v-if="workspaceConnection.connected"
        variant="outline"
        color="neutral"
        size="sm"
        :loading="workspaceOAuthLoading"
        @click="disconnect"
      >
        接続を解除
      </EnButton>
    </div>
  </EnCard>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import EnCard from "@components/EnCard.vue";

const workspaceOAuth = useGoogleWorkspaceOAuth();
const workspaceConnection = computed(() => workspaceOAuth.connection.value);
const workspaceOAuthLoading = computed(() => workspaceOAuth.isLoading.value);

const connect = async (): Promise<void> => {
  const ok = await workspaceOAuth.connect();
  if (ok) {
    await workspaceOAuth.refreshConnection();
  }
};

const disconnect = async (): Promise<void> => {
  await workspaceOAuth.disconnect();
  await workspaceOAuth.refreshConnection();
};

onMounted(() => {
  void workspaceOAuth.refreshConnection();
});
</script>
