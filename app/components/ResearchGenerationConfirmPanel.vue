<template>
  <div
    class="mx-auto w-full max-w-lg px-4 py-6"
    data-testid="research-generation-confirm-panel"
  >
    <div class="mb-6 flex items-end gap-3">
      <NuxtImg
        :src="appearance.aiAvatarUrl.value"
        alt="リサーチ AI"
        class="h-16 w-16 shrink-0 object-contain"
      />
      <div
        class="rounded-2xl bg-white px-4 py-3 ring-1 ring-purple-200 shadow-sm"
      >
        <p class="text-base font-bold text-purple-950">
          このプランでレポート生成を開始します
        </p>
        <p class="mt-1 text-xs text-slate-600">
          完了までおよそ 10 分かかります。終わったらメールでお知らせします。
        </p>
      </div>
    </div>

    <EnCard variant="kpi" padding="snug" class="mb-4">
      <p class="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
        確定プラン
      </p>
      <p class="mt-1 text-sm font-semibold text-neutral-900">
        {{ planTitle }}
      </p>
      <p class="mt-1 text-xs text-neutral-600">
        Question {{ sectionCount }} 件
        <span v-if="concernCount > 0">· 疑問 {{ concernCount }} 件</span>
      </p>
    </EnCard>

    <UFormField
      label="完了通知メールアドレス"
      hint="ログイン中のアドレス以外も指定できます"
      class="mb-6"
    >
      <UInput
        v-model="emailLocal"
        type="email"
        placeholder="you@company.co.jp"
        autocomplete="email"
        class="w-full"
      />
    </UFormField>

    <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <EnButton
        variant="outline"
        color="neutral"
        size="md"
        :disabled="isSubmitting"
        @click="emit('back')"
      >
        プランを修正
      </EnButton>
      <EnButton
        variant="solid"
        color="warning"
        size="md"
        leading-icon="material-symbols:send"
        :loading="isSubmitting"
        :disabled="!canSubmit || isSubmitting"
        data-testid="research-generation-confirm-submit"
        @click="onSubmit"
      >
        生成を開始
      </EnButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EnButton from "@components/EnButton.vue";
import EnCard from "@components/EnCard.vue";
import type { ResearchPlanDraft } from "@utils/researchPlanDraft";
import { isValidEmailAddress } from "@utils/emailAddress";

const props = defineProps<{
  plan: ResearchPlanDraft;
  notificationEmail?: string | null;
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", notificationEmail: string): void;
  (e: "back"): void;
}>();

const appearance = useAppAppearance();
const emailLocal = ref(props.notificationEmail?.trim() ?? "");

watch(
  () => props.notificationEmail,
  (value) => {
    if (value?.trim() && !emailLocal.value.trim()) {
      emailLocal.value = value.trim();
    }
  },
);

const planTitle = computed(() => props.plan.deck.title || "(未指定)");
const sectionCount = computed(() => props.plan.sections.length);
const concernCount = computed(() => props.plan.concerns.length);
const canSubmit = computed(() => isValidEmailAddress(emailLocal.value));

const onSubmit = (): void => {
  if (!canSubmit.value) return;
  emit("submit", emailLocal.value.trim());
};
</script>
