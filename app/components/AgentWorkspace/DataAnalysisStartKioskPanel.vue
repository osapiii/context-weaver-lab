<template>
  <AiStudioStartKioskShell
    theme="dataAnalysis"
    mascot-message="今日は何を分析する？&#10;聞きたいことをそのまま書いてね"
    mascot-alt="データ分析 AI"
    title="分析したいこと"
    description="売上・顧客・案件・コストなど、知りたい数字や比較したい観点をそのまま書いてください。"
    test-id="data-analysis-start-kiosk"
  >
    <div
      data-testid="data-analysis-start-input"
      @keydown.shift.enter.prevent="onSubmit"
    >
      <UTextarea
        :model-value="modelValue"
        :rows="6"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full"
        autofocus
        @update:model-value="onInput"
      />
    </div>

    <div class="mt-3">
      <p class="mb-1.5 text-[11px] font-medium text-slate-500">サンプル</p>
      <div class="flex flex-wrap gap-2">
        <EnButton
          v-for="sample in samples"
          :key="sample"
          variant="outline"
          color="primary"
          size="xs"
          custom-class="rounded-full border-purple-200 text-purple-800 hover:bg-purple-50"
          :disabled="disabled"
          @click="selectSample({ sample })"
        >
          {{ sample }}
        </EnButton>
      </div>
    </div>

    <div
      v-if="knowledgeSummary"
      class="mt-4 flex items-start gap-2 rounded-lg border border-purple-100 bg-purple-50/50 px-3 py-2 text-xs text-purple-900"
    >
      <UIcon name="material-symbols:database" class="mt-0.5 h-4 w-4 shrink-0" />
      <span>{{ knowledgeSummary }}</span>
    </div>

    <template #footer>
      <div class="flex items-center justify-end">
        <EnButton
          variant="solid"
          color="primary"
          size="md"
          trailing-icon="material-symbols:arrow-forward"
          :disabled="disabled || !modelValue.trim()"
          :loading="disabled"
          data-testid="data-analysis-start-submit"
          @click="onSubmit"
        >
          分析を始める
        </EnButton>
      </div>
    </template>
  </AiStudioStartKioskShell>
</template>

<script setup lang="ts">
import AiStudioStartKioskShell from "@components/AiStudio/AiStudioStartKioskShell.vue";
import EnButton from "@components/EnButton.vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    disabled?: boolean;
    placeholder?: string;
    knowledgeSummary?: string;
  }>(),
  {
    disabled: false,
    placeholder: "例: 今月の売上変動に一番影響した要因を見たい",
    knowledgeSummary: "",
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  submit: [];
}>();

const samples = [
  "売上変動の要因",
  "顧客セグメント比較",
  "案件進捗の傾向",
  "売上データ深掘り分析",
];

const onInput = (value: unknown): void => {
  emit("update:modelValue", String(value ?? ""));
};

const selectSample = (params: { sample: string }): void => {
  if (props.disabled) return;
  emit("update:modelValue", params.sample);
};

const onSubmit = (): void => {
  if (props.disabled || !props.modelValue.trim()) return;
  emit("submit");
};
</script>
