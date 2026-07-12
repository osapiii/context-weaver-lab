<template>
  <AiStudioStartKioskShell
    theme="consultation"
    mascot-message="今日は何について考える？&#10;まとまっていなくても大丈夫だよ"
    mascot-alt="経営相談 AI"
    title="相談したいこと"
    description="課題、気になる数字、判断に迷っていることをそのまま書いてください。"
    test-id="consultation-start-kiosk"
  >
    <div
      data-testid="consultation-start-input"
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
          custom-class="rounded-full border-violet-200 text-violet-800 hover:bg-violet-50"
          :disabled="disabled"
          @click="selectSample({ sample })"
        >
          {{ sample }}
        </EnButton>
      </div>
    </div>

    <div
      v-if="knowledgeSummary"
      class="mt-4 flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs text-violet-900"
    >
      <UIcon name="material-symbols:menu-book-outline" class="mt-0.5 h-4 w-4 shrink-0" />
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
          data-testid="consultation-start-submit"
          @click="onSubmit"
        >
          相談を始める
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
    placeholder: "例: 最近、粗利率が落ちている。考えられる原因と確認すべき数字を整理したい",
    knowledgeSummary: "",
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  submit: [];
}>();

const samples = [
  "粗利率が落ちた原因を整理したい",
  "来期の重点施策を一緒に考えたい",
  "業務コストが増えている理由を見つけたい",
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
