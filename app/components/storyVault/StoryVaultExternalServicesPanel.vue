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

    <div
      v-else
      class="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"
    >
      <UIcon
        name="i-simple-icons-jira"
        class="mx-auto h-10 w-10 text-slate-300"
      />
      <p class="mt-3 text-sm font-semibold text-slate-800">
        JIRA 連携は準備中です
      </p>
      <p class="mt-1 text-xs text-slate-500">
        チケット同期やストーリー連携をここに追加します。
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { DecodedStoryVaultApplication } from "@models/storyVault";

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
