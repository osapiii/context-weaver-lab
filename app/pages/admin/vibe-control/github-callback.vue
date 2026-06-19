<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-6">
    <div class="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <UIcon
        name="material-symbols:code-blocks-outline"
        class="mx-auto h-8 w-8 text-slate-900"
      />
      <p class="mt-3 text-sm font-semibold text-slate-900">
        GitHub 接続を処理しています
      </p>
      <p class="mt-1 text-xs text-slate-500">
        このウィンドウは自動で閉じます。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
});

onMounted(() => {
  const route = useRoute();
  const payload = {
    source: "vibe-control-github-oauth",
    code: typeof route.query.code === "string" ? route.query.code : undefined,
    error:
      typeof route.query.error === "string"
        ? route.query.error
        : typeof route.query.error_description === "string"
          ? route.query.error_description
          : undefined,
    state: typeof route.query.state === "string" ? route.query.state : undefined,
  };
  window.opener?.postMessage(payload, window.location.origin);
  window.setTimeout(() => {
    window.close();
  }, 300);
});
</script>
