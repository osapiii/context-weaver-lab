<template>
  <button
    v-if="showChip"
    type="button"
    class="inline-flex h-9 max-w-[min(220px,100%)] items-center gap-2 rounded-full px-2.5 text-xs font-semibold shadow-sm ring-1 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2"
    :class="
      hasActiveConnection
        ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 focus-visible:ring-emerald-300'
        : 'bg-slate-950 text-white ring-slate-700 focus-visible:ring-slate-400'
    "
    :title="hasActiveConnection ? 'MCP設定は有効です' : 'MCP設定が未設定です'"
    @click="openMcpSettings"
  >
    <span
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md shadow-sm ring-1 ring-black/5"
      :class="hasActiveConnection ? 'bg-white text-emerald-600' : 'bg-white text-slate-950'"
      aria-hidden="true"
    >
      <UIcon name="material-symbols:hub" class="h-4 w-4" />
    </span>
    <span class="min-w-0 truncate text-left leading-tight">
      <span class="block truncate">MCP設定</span>
      <span class="block truncate text-[10px] font-medium opacity-80">
        {{ statusLabel }}
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { collection, getDocs } from "firebase/firestore";
import { computed, onMounted, ref, watch } from "vue";

type McpConnectionDoc = {
  revokedAt?: unknown;
};

const contextStore = useContextStore();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
const db = useFirestore();
const router = useRouter();

const activeConnectionCount = ref(0);
const isLoaded = ref(false);

const organizationId = computed(() => organizationStore.getLoggedInOrganizationId || "");
const spaceId = computed(() => spaceStore.selectedSpace?.id || "");
const showChip = computed(() => Boolean(organizationId.value) && Boolean(spaceId.value));
const hasActiveConnection = computed(() => activeConnectionCount.value > 0);
const statusLabel = computed(() => {
  if (!isLoaded.value) return "確認中";
  return hasActiveConnection.value ? `${activeConnectionCount.value}件 有効` : "未設定";
});

const refresh = async (): Promise<void> => {
  if (!showChip.value) return;
  try {
    const snapshot = await getDocs(collection(db, contextStore.baseFirestorePath("storyVaultMcpConnections")));
    activeConnectionCount.value = snapshot.docs.filter((snap) => {
      const data = snap.data() as McpConnectionDoc;
      return !data.revokedAt;
    }).length;
  } finally {
    isLoaded.value = true;
  }
};

const openMcpSettings = (): void => {
  void router.push({
    name: "admin-preferences",
    query: { tab: "mcp" },
  });
};

onMounted(refresh);
watch([organizationId, spaceId], refresh);
</script>
