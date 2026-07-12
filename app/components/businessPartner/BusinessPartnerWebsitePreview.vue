<template>
  <div class="space-y-4">
    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
    >
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-gray-500">公式サイト</p>
        <a
          :href="normalizedUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-0.5 block truncate text-sm font-medium text-primary-600 hover:underline"
        >
          {{ normalizedUrl }}
        </a>
      </div>
      <EnButton
        variant="outline"
        color="primary"
        size="sm"
        leading-icon="i-heroicons-arrow-top-right-on-square"
        @click="openInNewTab"
      >
        新しいタブで開く
      </EnButton>
    </div>

    <EnAlert
      v-if="iframeBlocked"
      variant="assistant"
      title="このサイトは埋め込みプレビューに対応していない可能性があります"
      description="セキュリティ設定により iframe で表示できない場合があります。上のリンクから直接ご確認ください。"
      :icon="actionIcons.warning"
    />

    <div
      class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner"
    >
      <iframe
        v-if="normalizedUrl && !iframeBlocked"
        :src="normalizedUrl"
        :title="`公式サイト: ${partnerName}`"
        class="h-[min(70vh,640px)] w-full bg-white"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        referrerpolicy="no-referrer-when-downgrade"
        loading="lazy"
        @load="onIframeLoad"
      />
      <div
        v-else-if="!normalizedUrl"
        class="flex h-48 items-center justify-center text-sm text-gray-500"
      >
        ウェブサイト URL が登録されていません
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import EnAlert from "@components/EnAlert.vue";
import EnButton from "@components/EnButton.vue";

const props = defineProps<{
  websiteUrl?: string;
  partnerName?: string;
}>();

const actionIcons = useActionIcons();

const normalizedUrl = computed(() => {
  const raw = props.websiteUrl?.trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.href;
    }
  } catch {
    return "";
  }
  return "";
});

const iframeBlocked = ref(false);

const onIframeLoad = (event: Event) => {
  const iframe = event.target as HTMLIFrameElement;
  try {
    const doc = iframe.contentDocument;
    if (doc && doc.body && doc.body.childElementCount === 0) {
      iframeBlocked.value = true;
    }
  } catch {
    // cross-origin: cannot inspect; assume OK if load fired
  }
};

const openInNewTab = () => {
  if (normalizedUrl.value) {
    window.open(normalizedUrl.value, "_blank", "noopener,noreferrer");
  }
};

watch(
  () => props.websiteUrl,
  () => {
    iframeBlocked.value = false;
  }
);
</script>
