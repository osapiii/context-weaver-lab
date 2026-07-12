<template>
  <div
    v-if="spreadsheetId"
    class="flex flex-col min-h-[280px] rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-white"
    >
      <p class="text-xs font-semibold text-slate-600">スプレッドシート</p>
      <EnButton
        variant="outline"
        color="info"
        size="xs"
        leading-icon="i-simple-icons-googlesheets"
        label="新しいタブで開く"
        @click="openInBrowser"
      />
    </div>
    <EnAlert
      variant="assistant"
      class="mx-3 mt-2 shrink-0"
      title="プレビューについて"
      description="Google ログインが必要な場合があります。表示されないときは「新しいタブで開く」で確認してください。"
    />
    <iframe
      :src="embedUrl"
      title="Google スプレッドシートプレビュー"
      class="flex-1 w-full min-h-[240px] bg-white"
      referrerpolicy="no-referrer"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  spreadsheetId: string;
}>();

const embedUrl = computed(
  () =>
    `https://docs.google.com/spreadsheets/d/${props.spreadsheetId}/edit?rm=minimal&usp=sharing`
);

const openInBrowser = (): void => {
  window.open(
    `https://docs.google.com/spreadsheets/d/${props.spreadsheetId}/edit`,
    "_blank",
    "noopener,noreferrer"
  );
};
</script>
