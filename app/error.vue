<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{
  error: NuxtError;
}>();

const statusCode = computed(
  () => props.error.status ?? props.error.statusCode ?? 500
);

const statusLabel = computed(() => {
  const code = statusCode.value;
  if (code === 404) return "ページが見つかりません";
  if (code === 403) return "アクセスできません";
  if (code >= 500) return "サーバーエラーが発生しました";
  return "エラーが発生しました";
});

const statusDescription = computed(() => {
  const code = statusCode.value;
  if (code === 404) {
    return "URL が変更されたか、入力したアドレスが正しくない可能性があります。";
  }
  if (code === 403) {
    return "このページを表示する権限がないか、スペースへのアクセスが許可されていません。";
  }
  if (code >= 500) {
    return "しばらく時間をおいてから再度お試しください。";
  }
  return "下のリンクから安全な画面へ戻ってください。";
});

const requestedPath = computed(() => {
  const msg = props.error.message ?? props.error.statusMessage ?? "";
  const match = msg.match(/Page not found:\s*(.+)/i);
  return match?.[1]?.trim() ?? "";
});

const signInPath = "/admin/signin";

async function goSignIn() {
  await clearError({ redirect: signInPath });
}

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    window.history.back();
    return;
  }
  void goSignIn();
}

useHead({
  title: () => `${statusCode.value} | StoryVault`,
  meta: [{ name: "robots", content: "noindex" }],
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <header class="px-6 py-5">
      <span class="text-sm font-semibold tracking-wide text-slate-800">
        StoryVault
      </span>
    </header>

    <main class="flex flex-1 flex-col items-center justify-center px-6 pb-16">
      <div class="w-full max-w-md text-center">
        <p
          class="text-[5.5rem] font-semibold leading-none tabular-nums text-slate-200 select-none"
          aria-hidden="true"
        >
          {{ statusCode }}
        </p>

        <h1 class="-mt-10 text-xl font-bold text-slate-900">
          {{ statusLabel }}
        </h1>

        <p class="mt-3 text-sm leading-relaxed text-slate-600">
          {{ statusDescription }}
        </p>

        <p
          v-if="requestedPath"
          class="mt-4 text-xs text-slate-500 break-all"
        >
          <span class="text-slate-400">パス</span>
          {{ requestedPath }}
        </p>

        <div class="mt-8 flex flex-col items-center gap-3">
          <EnButton
            variant="soft"
            color="neutral"
            size="lg"
            block
            custom-class="max-w-xs mx-auto justify-center text-center"
            @click="goSignIn"
          >
            サインイン画面へ
          </EnButton>

          <button
            type="button"
            class="text-sm text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline"
            @click="goBack"
          >
            前のページへ戻る
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
