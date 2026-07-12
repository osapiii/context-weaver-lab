<template>
  <EnModal
    :open="open"
    title="レポートを生成中"
    subtitle="このまま閉じてもバックグラウンドで処理を続行します"
    title-icon="material-symbols:hourglass-top-rounded"
    size="md"
    header-variant="default"
    :close-on-backdrop="false"
    :hide-close="true"
    padding="md"
  >
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <NuxtImg
          :src="appearance.aiAvatarUrl.value"
          alt="リサーチ AI"
          class="h-12 w-12 shrink-0 object-contain"
        />
        <div class="min-w-0 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200">
          {{ message }}
        </div>
      </div>
      <p
        v-if="contextSummary"
        class="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600 ring-1 ring-neutral-200"
      >
        参照コンテキスト: {{ contextSummary }}
      </p>
      <p
        v-if="showContextWarning"
        class="rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-900 ring-1 ring-purple-200"
      >
        {{ contextWarning }}
      </p>

      <UFormField
        label="完了通知メールアドレス"
        hint="あとから設定しても通知を受け取れます"
      >
        <UInput
          v-model="emailLocal"
          type="email"
          placeholder="you@company.co.jp"
          autocomplete="email"
          class="w-full"
        />
      </UFormField>

      <div class="flex justify-end">
        <EnButton
          variant="soft"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:mark-email-read-outline"
          :disabled="!canSaveEmail || isSavingEmail"
          :loading="isSavingEmail"
          @click="onSaveNotificationEmail"
        >
          通知を受け取る
        </EnButton>
      </div>
    </div>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EnButton from "@components/EnButton.vue";
import EnModal from "@components/EnModal.vue";
import { isValidEmailAddress } from "@utils/emailAddress";

const props = withDefaults(
  defineProps<{
    open: boolean;
    notificationEmail?: string | null;
    message?: string;
    isSavingEmail?: boolean;
    contextStatus?: "ready" | "limited" | null;
    contextWarning?: string | null;
    contextSummary?: string | null;
  }>(),
  {
    notificationEmail: null,
    message: "AI バディが調査を進めています…",
    isSavingEmail: false,
    contextStatus: null,
    contextWarning: null,
    contextSummary: null,
  },
);

const emit = defineEmits<{
  (e: "save-notification", payload: { notificationEmail: string }): void;
}>();

const appearance = useAppAppearance();
const emailLocal = ref(props.notificationEmail?.trim() ?? "");

watch(
  () => props.notificationEmail,
  (value) => {
    const next = value?.trim() ?? "";
    if (!next) return;
    if (next === emailLocal.value.trim()) return;
    emailLocal.value = next;
  },
);

const canSaveEmail = computed(() =>
  isValidEmailAddress(emailLocal.value.trim()),
);

const showContextWarning = computed(
  () =>
    props.contextStatus === "limited" &&
    !!(props.contextWarning && props.contextWarning.trim()),
);

const onSaveNotificationEmail = (): void => {
  if (!canSaveEmail.value) return;
  emit("save-notification", {
    notificationEmail: emailLocal.value.trim(),
  });
};
</script>
