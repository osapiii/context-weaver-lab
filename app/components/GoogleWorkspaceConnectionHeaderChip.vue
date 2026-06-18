<template>
  <div
    v-if="showChip"
    class="inline-flex h-9 max-w-[min(260px,100%)] items-center gap-1 rounded-full bg-purple-950/70 text-xs font-semibold text-purple-50 shadow-sm ring-1 ring-purple-500/45 transition hover:-translate-y-0.5"
    title="Google Workspace が未接続です"
  >
    <button
      type="button"
      data-testid="google-workspace-header-chip"
      class="inline-flex h-full min-w-0 flex-1 items-center gap-2 rounded-l-full py-1 pl-2.5 pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
      @click="openPreferences"
    >
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/5"
        aria-hidden="true"
      >
        <UIcon name="logos:google-icon" class="h-4 w-4" />
      </span>
      <span class="min-w-0 truncate text-left leading-tight">
        <span class="block truncate">Google 認証</span>
        <span class="block truncate text-[10px] font-medium opacity-80">
          未接続
        </span>
      </span>
    </button>

    <button
      type="button"
      data-testid="google-workspace-header-connect"
      class="mr-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-bold leading-none text-white shadow-[0_2px_0_0_rgba(4,120,87,0.75)] ring-1 ring-emerald-300/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
      :disabled="workspaceOAuthLoading"
      @click.stop="connect"
    >
      <UIcon
        :name="workspaceOAuthLoading ? 'i-heroicons-arrow-path' : 'i-simple-icons-google'"
        class="h-3 w-3"
        :class="{ 'animate-spin': workspaceOAuthLoading }"
      />
      <span class="whitespace-nowrap">接続</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";

const workspaceOAuth = useGoogleWorkspaceOAuth();
const organizationStore = useOrganizationStore();
const router = useRouter();

const workspaceConnection = computed(() => workspaceOAuth.connection.value);
const workspaceOAuthLoading = computed(() => workspaceOAuth.isLoading.value);
const organizationId = computed(
  () => organizationStore.loggedInOrganizationInfo?.id || ""
);
const showChip = computed(
  () => Boolean(organizationId.value) && !workspaceConnection.value.connected
);

const refresh = (): void => {
  if (organizationId.value) void workspaceOAuth.refreshConnection();
};

const openPreferences = (): void => {
  void router.push({
    name: "admin-preferences",
    query: { tab: "data-integration" },
  });
};

const connect = async (): Promise<void> => {
  const ok = await workspaceOAuth.connect();
  if (ok) {
    await workspaceOAuth.refreshConnection();
  }
};

onMounted(refresh);
watch(organizationId, refresh);
</script>
