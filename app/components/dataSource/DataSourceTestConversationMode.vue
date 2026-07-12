<template>
  <div class="space-y-2">
    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-purple-100 bg-white px-4 py-3 shadow-sm"
    >
      <div class="min-w-0">
        <p class="text-sm font-semibold text-neutral-950">ナレッジ接続テスト</p>
        <p class="mt-0.5 text-xs text-neutral-500">
          接続済みナレッジ {{ indexedCount }} 件を参照して、回答品質を確認できます
        </p>
      </div>
      <EnBadge
        variant="soft"
        :color="hasIndexedKnowledge ? 'success' : 'warning'"
        size="sm"
      >
        {{ hasIndexedKnowledge ? "参照可能" : "未登録" }}
      </EnBadge>
    </div>

    <EnAlert
      v-if="!hasIndexedKnowledge"
      color="warning"
      title="AI 登録済みの知識がありません"
      description="先に「知識を教える」で資料を登録し、同期が完了してからテスト会話を実施してください。"
    />

    <section
      class="h-[min(820px,calc(100vh-190px))] min-h-[640px] overflow-hidden rounded-lg border border-purple-200 bg-purple-50/50 shadow-sm"
    >
      <AgentWorkspaceAIPanel
        class="h-full"
        compact-header-controls
        assistant-theme-override="revision"
        panel-title-override="テスト会話"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Document } from "@models/geminiFileSpaceRequest";
import AgentWorkspaceAIPanel from "@components/AgentWorkspace/AgentWorkspaceAIPanel.vue";
import EnAlert from "@components/EnAlert.vue";
import EnBadge from "@components/EnBadge.vue";
import { isKnowledgeIndexed } from "@utils/knowledge";
import { useAiStudioStore } from "@stores/aiStudio";

const props = defineProps<{
  fileSpaceId: string | null;
  documents: Document[];
}>();

const aiStudio = useAiStudioStore();

const indexedCount = computed(
  () => props.documents.filter((doc) => isKnowledgeIndexed(doc)).length
);

const hasIndexedKnowledge = computed(() => indexedCount.value > 0);

const ensureConsultationSession = async (): Promise<void> => {
  if (
    aiStudio.sessionId &&
    aiStudio.jobKind === "consultation" &&
    aiStudio.activeAgent === "consultation"
  ) {
    return;
  }
  await aiStudio.startSession("consultation");
};

onMounted(() => {
  void ensureConsultationSession();
});

watch(
  () => props.fileSpaceId,
  () => {
    void ensureConsultationSession();
  }
);
</script>
