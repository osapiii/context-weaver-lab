<template>
  <EnAlert
    variant="assistant"
    icon="i-simple-icons-googlesheets"
    title="Google Workspace 接続（必須）"
    data-testid="gsheet-oauth-connect-guide"
  >
    <template #description>
      <p class="leading-relaxed">
        Gシート連携では、接続した Google アカウント本人の権限で
        スプレッドシートを読み書きします。
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <EnBadge
          :color="workspaceConnection.connected ? 'success' : 'warning'"
          variant="soft"
          size="xs"
          :leading-icon="workspaceConnection.connected ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'"
        >
          {{
            workspaceConnection.connected
              ? `接続済み: ${workspaceConnection.email || "Google アカウント"}`
              : "未接続"
          }}
        </EnBadge>
        <EnButton
          variant="soft"
          :color="workspaceConnection.connected ? 'success' : 'info'"
          size="xs"
          leading-icon="i-simple-icons-google"
          :loading="workspaceOAuthLoading"
          data-testid="gsheet-oauth-connect"
          @click="workspaceOAuth.connect"
        >
          {{ workspaceConnection.connected ? "再接続" : "Google 接続" }}
        </EnButton>
      </div>
      <p class="mt-2 text-xs text-sky-900/80">
        接続した Google アカウントが対象シートを開ける必要があります。
      </p>
    </template>
  </EnAlert>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import EnAlert from "@components/EnAlert.vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";

const workspaceOAuth = useGoogleWorkspaceOAuth();
const workspaceConnection = computed(() => workspaceOAuth.connection.value);
const workspaceOAuthLoading = computed(() => workspaceOAuth.isLoading.value);

onMounted(() => {
  void workspaceOAuth.refreshConnection();
});
</script>
