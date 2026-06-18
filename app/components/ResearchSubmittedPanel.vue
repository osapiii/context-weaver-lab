<template>
  <div
    class="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 py-8 text-center"
    data-testid="research-submitted-panel"
  >
    <div
      class="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 text-purple-600"
    >
      <UIcon name="material-symbols:mark-email-read-outline" class="h-9 w-9" />
    </div>

    <div class="space-y-2">
      <h2 class="text-xl font-bold text-neutral-900">
        リサーチを受け付けました
      </h2>
      <p class="text-sm leading-relaxed text-neutral-600">
        AI が組織ナレッジと Web 情報をもとにレポートを生成しています。
        <span class="block mt-2">
          完了したら
          <strong class="text-neutral-800">{{ notificationEmail }}</strong>
          にメールでお知らせします。
        </span>
      </p>
      <p class="text-xs text-neutral-500">
        この画面を閉じても問題ありません。進行状況は AIスタジオの履歴から確認できます。
      </p>
    </div>

    <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
      <EnButton
        variant="solid"
        color="primary"
        size="sm"
        leading-icon="material-symbols:home"
        data-testid="research-submitted-back-hub"
        @click="emit('back-to-hub')"
      >
        AIスタジオ一覧に戻る
      </EnButton>
      <EnButton
        variant="outline"
        color="neutral"
        size="sm"
        leading-icon="material-symbols:add"
        data-testid="research-submitted-new"
        @click="emit('new-research')"
      >
        別のリサーチを依頼
      </EnButton>
    </div>

    <ResearchAgentTerminalLog
      v-if="showProgress"
      class="w-full"
    />
  </div>
</template>

<script setup lang="ts">
import EnButton from "@components/EnButton.vue";
import ResearchAgentTerminalLog from "@components/ResearchAgentTerminalLog.vue";

withDefaults(
  defineProps<{
    notificationEmail: string;
    showProgress?: boolean;
  }>(),
  {
    showProgress: true,
  },
);

const emit = defineEmits<{
  (e: "back-to-hub"): void;
  (e: "new-research"): void;
}>();
</script>
