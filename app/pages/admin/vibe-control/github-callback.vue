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

defineOptions({
  name: "AdminVibeControlGithubCallbackPage",
});

useHead({
  title: "GitHub 接続",
});

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return window.atob(padded);
}

function openerOriginFromState(state: unknown): string | null {
  if (typeof state !== "string" || !state) return null;
  try {
    const decoded = JSON.parse(decodeBase64Url(state));
    return typeof decoded.openerOrigin === "string" ? decoded.openerOrigin : null;
  } catch {
    return null;
  }
}

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
  const targetOrigin = openerOriginFromState(route.query.state) || window.location.origin;
  window.opener?.postMessage(payload, targetOrigin);
  window.setTimeout(() => {
    window.close();
  }, 300);
});
</script>
