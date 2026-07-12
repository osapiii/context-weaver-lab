<template>
  <button
    v-if="visible"
    type="button"
    class="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-semibold text-violet-700 shadow-sm ring-1 ring-violet-200 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
    title="実行中のジョブ一覧を表示"
    @click="navigateToDashboard"
  >
    <UIcon
      name="material-symbols:autorenew"
      class="h-4 w-4 animate-spin text-violet-500"
    />
    <span>実行中 {{ store.runningCount }}件</span>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useWorkflowExecutionsStore } from "@stores/workflowExecutions";

const store = useWorkflowExecutionsStore();
const router = useRouter();

const visible = computed(() => store.runningCount > 0);

onMounted(() => {
  store.subscribe();
});

const navigateToDashboard = (): void => {
  router.push({ name: "admin-workflow-executions" });
};
</script>
