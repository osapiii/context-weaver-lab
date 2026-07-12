<template>
  <div
    :class="
      isImmersiveWorkspace
        ? `${ADMIN_VIEWPORT_FILL_CLASS} w-full min-w-0 flex-1 overflow-hidden`
        : 'w-full min-w-0'
    "
  >
    <!-- ハブ: セッション一覧 TOP -->
    <div
      v-if="!store.sessionId"
      class="space-y-6"
    >
      <AdminModePageNav current-page-label="AIスタジオ" />

      <AiStudioHub
        @open-session="onOpenSession"
        @new-session="onNewSession"
      />
    </div>

    <!-- Workspace -->
    <AgentWorkspace
      v-else
      class="min-h-0 flex-1"
      @back-to-hub="onBackToHub"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { provideAdminPageContainerOverride } from "@composables/useAdminPageContainer";
import { ADMIN_VIEWPORT_FILL_CLASS } from "@composables/useAdminViewport";
import { useAiStudioStore, type AiStudioJobKind } from "@stores/aiStudio";
import AiStudioHub from "@components/AiStudio/AiStudioHub.vue";
import AgentWorkspace from "@components/AgentWorkspace/AgentWorkspace.vue";

const store = useAiStudioStore();
const route = useRoute();

/** ハブ・Workspace ともに admin レイアウトで全画面 (flush) */
const isImmersiveWorkspace = computed(() => true);

definePageMeta({
  layout: "admin",
  adminPageStack: false,
});

provideAdminPageContainerOverride(() => {
  if (!isImmersiveWorkspace.value) {
    return { variant: "ai" as const, fillHeight: false };
  }
  return { variant: "flush" as const, fillHeight: true };
});

const onOpenSession = async (sessionId: string) => {
  const ok = await store.loadSession(sessionId);
  if (!ok) {
    useToast().add({
      title: "セッションを開けませんでした",
      color: "error",
    });
  }
};

const onNewSession = async (jobKind: AiStudioJobKind | null) => {
  await store.startSession(jobKind);
};

const onBackToHub = async () => {
  await store.reset();
  const query = { ...route.query };
  delete query.session;
  await navigateTo({ name: "admin-ai-studio", query });
};

const openSessionFromQuery = async () => {
  const wanted =
    (typeof route.query.session === "string" && route.query.session.trim()) ||
    null;
  if (!wanted || store.sessionId === wanted) return;
  const ok = await store.loadSession(wanted);
  if (!ok) {
    useToast().add({
      title: "セッションを開けませんでした",
      color: "error",
    });
  }
};

onMounted(() => {
  void openSessionFromQuery();
});

watch(
  () => route.query.session,
  () => {
    void openSessionFromQuery();
  },
);

/** 旧リンク `?preferred=` はハブの種別フィルタとしてのみ解釈（即 Workspace 起動しない） */
</script>
