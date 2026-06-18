<template>
  <div class="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8">
    <p class="text-sm text-neutral-600">
      文書セッションは AI スタジオに統合されました。
    </p>
    <EnButton
      variant="solid"
      leading-icon="material-symbols:auto-awesome"
      @click="goAiStudio"
    >
      AI スタジオを開く
    </EnButton>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin" });
useHead({ title: "生成済み文書一覧 | EN AIstudio" });

const router = useRouter();

const goAiStudio = (): void => {
  void router.push({ name: "admin-ai-studio", query: { mode: "writing" } });
};

onMounted(() => {
  goAiStudio();
});
</script>
