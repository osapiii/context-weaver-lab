<template>
  <div class="h-screen flex flex-col bg-white">
    <div
      class="sticky top-0 z-50 flex-shrink-0 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500 shadow-sm"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <NuxtImg
            :src="appearance.aiAvatarUrl.value"
            alt="EN AIstudio アシスタント"
            class="w-8 h-8 object-contain"
          />
          <h1 class="text-lg font-bold text-white">AI部下</h1>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            icon="i-heroicons-arrow-path"
            variant="soft"
            color="neutral"
            size="sm"
            @click="handleResetChat"
          >
            会話をリセット
          </UButton>
          <UButton
            icon="i-heroicons-arrow-right-on-rectangle"
            variant="soft"
            color="neutral"
            size="sm"
            @click="handleSignOut"
          >
            サインアウト
          </UButton>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-hidden">
      <AgentWorkspaceAIPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import AgentWorkspaceAIPanel from "@components/AgentWorkspace/AgentWorkspaceAIPanel.vue";
import log from "@utils/logger";

const appearance = useAppAppearance();

definePageMeta({
  layout: false,
  middleware: ["admin-logged-in-check"],
});

useHead({
  title: "AI 部下",
});

const aiStudio = useAiStudioStore();
const spaceStore = useSpaceStore();
const userAuthStore = useAdminUserStore();
const toast = useToast();

const handleResetChat = () => {
  void aiStudio.startNewConversation();
  toast.add({
    title: "会話をリセットしました",
    color: "success",
  });
  log("INFO", "AI Studio consultation chat reset (mobile)");
};

const handleSignOut = async () => {
  try {
    await userAuthStore.signOut();
    await navigateTo("/admin/signin");
    log("INFO", "Sign out successful");
  } catch (error) {
    log("ERROR", "Sign out error", error);
    toast.add({
      title: "サインアウトエラー",
      description: "サインアウトに失敗しました",
      color: "error",
    });
  }
};

onMounted(async () => {
  if (!spaceStore.selectedSpace && spaceStore.spaces.length > 0) {
    const targetSpace =
      spaceStore.defaultSpace || spaceStore.currentUserSpaces[0];
    if (targetSpace) {
      await spaceStore.selectSpace({ spaceId: targetSpace.id });
    }
  }

  await aiStudio.startSession("consultation");
  log("INFO", "Mobile AI chat session started (ADK consultation)");
});
</script>
