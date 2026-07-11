<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-lg font-bold tracking-tight text-slate-950">
          外部サービス連携
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          GitHub や JIRA など、アプリケーション外部の開発情報を管理します
        </p>
      </div>

      <EnToggle
        v-model="activeService"
        :items="serviceItems"
        custom-class="max-w-full overflow-x-auto"
      />
    </div>

    <StoryVaultApplicationGitPanel
      v-if="activeService === 'git'"
      :application="application"
    />

    <OAuthConnectionJiraCard v-else />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { DecodedStoryVaultApplication } from "@models/storyVault";
import OAuthConnectionJiraCard from "@components/preferences/OAuthConnectionJiraCard.vue";

defineProps<{
  application: DecodedStoryVaultApplication | null;
}>();

type ExternalServiceTab = "git" | "jira";

const activeService = ref<ExternalServiceTab>("git");

const serviceItems = computed(() => [
  {
    value: "git",
    label: "Git",
    icon: "i-simple-icons-github",
  },
  {
    value: "jira",
    label: "JIRA",
    icon: "i-simple-icons-jira",
  },
]);
</script>
