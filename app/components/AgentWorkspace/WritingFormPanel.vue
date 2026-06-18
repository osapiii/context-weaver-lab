<template>
  <div
    v-if="showPanel"
    class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    data-testid="writing-form-panel"
  >
    <div
      v-if="variant !== 'kiosk'"
      class="mb-3 flex items-center justify-between gap-2"
    >
      <div>
        <p class="text-sm font-bold text-slate-900">
          {{ phaseTitle }}
        </p>
        <p class="mt-0.5 text-[11px] text-slate-600">
          {{ phaseDescription }}
        </p>
      </div>
      <EnBadge variant="tag" size="xs">
        {{ phaseBadge }}
      </EnBadge>
    </div>
    <div
      v-else
      class="mb-3 flex justify-end"
    >
      <EnBadge variant="tag" size="xs">
        {{ phaseBadge }}
      </EnBadge>
    </div>

    <UInput
      v-model="localTitle"
      class="mb-3 w-full"
      placeholder="フォーム名（任意）"
      :disabled="disabled || phase === 'done'"
      size="sm"
      @blur="syncTitle"
    />

    <div v-if="phase === 'format_review'" class="space-y-2">
      <div
        v-for="(field, index) in localFields"
        :key="field.key || `field-${index}`"
        class="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
      >
        <div class="grid gap-2 sm:grid-cols-2">
          <UFormField label="項目キー">
            <UInput
              v-model="field.key"
              size="sm"
              :disabled="disabled"
              @blur="emitForm"
            />
          </UFormField>
          <UFormField label="ラベル">
            <UInput
              v-model="field.label"
              size="sm"
              :disabled="disabled"
              @blur="emitForm"
            />
          </UFormField>
          <UFormField label="型">
            <EnSelectMenu
              v-model="field.type"
              :items="fieldTypeItems"
              value-key="value"
              label-key="label"
              :disabled="disabled"
              @update:model-value="emitForm"
            />
          </UFormField>
          <UFormField label="必須">
            <label class="inline-flex items-center gap-2 text-sm">
              <UCheckbox v-model="field.required" :disabled="disabled" @update:model-value="emitForm" />
              必須項目
            </label>
          </UFormField>
        </div>
        <UFormField label="ヒント" class="mt-2">
          <UInput
            v-model="field.hint"
            size="sm"
            :disabled="disabled"
            placeholder="入力の補足（任意）"
            @blur="emitForm"
          />
        </UFormField>
        <div class="mt-2 flex justify-end">
          <EnButton
            variant="ghost"
            size="xs"
            :disabled="disabled"
            @click="removeField(index)"
          >
            削除
          </EnButton>
        </div>
      </div>
      <EnButton
        variant="outline"
        size="sm"
        :disabled="disabled"
        @click="addField"
      >
        項目を追加
      </EnButton>
      <EnButton
        v-if="localFields.length > 0"
        variant="solid"
        size="sm"
        class="ml-2"
        :disabled="disabled"
        data-testid="writing-confirm-schema"
        @click="emit('confirm-schema')"
      >
        フォーマットを確定
      </EnButton>
    </div>

    <div v-else-if="phase === 'filling'" class="space-y-3">
      <div
        v-for="field in localFields"
        :key="field.key"
        class="space-y-1"
      >
        <label class="text-xs font-semibold text-slate-800">
          {{ field.label }}
          <span v-if="field.required" class="text-red-500">*</span>
        </label>
        <p v-if="field.hint" class="text-[10px] text-slate-500">
          {{ field.hint }}
        </p>
        <UTextarea
          v-if="field.type === 'textarea'"
          v-model="field.value"
          :rows="4"
          class="w-full"
          :disabled="disabled"
          @blur="emitForm"
        />
        <EnSelectMenu
          v-else-if="field.type === 'select'"
          :model-value="field.value ?? ''"
          :items="selectItems(field)"
          value-key="value"
          label-key="label"
          :disabled="disabled"
          @update:model-value="(v) => { field.value = String(v); emitForm(); }"
        />
        <UInput
          v-else
          v-model="field.value"
          :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'"
          class="w-full"
          size="sm"
          :disabled="disabled"
          @blur="emitForm"
        />
      </div>
      <div
        v-if="isGenerating"
        class="rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-4 shadow-sm"
        data-testid="writing-generation-loading"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-start gap-3">
          <UIcon
            name="material-symbols:progress-activity"
            class="mt-0.5 h-7 w-7 shrink-0 animate-spin text-emerald-500"
          />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-emerald-950">
              文章を生成しています…
            </p>
            <p class="mt-1 text-xs leading-relaxed text-emerald-900/80">
              社内ナレッジを参照しながら各項目の文章を作成しています。
            </p>
          </div>
        </div>
      </div>
      <EnButton
        v-else
        variant="solid"
        size="sm"
        :disabled="disabled || !canGenerate"
        data-testid="writing-start-generation"
        @click="emit('start-generation')"
      >
        入力開始
      </EnButton>
    </div>

    <p
      v-else-if="phase === 'done'"
      class="text-center text-[11px] text-slate-600"
    >
      生成が完了しました。右の OUT パネルから JSON / 各項目をコピーできます。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import EnSelectMenu from "@components/EnSelectMenu.vue";
import type { WritingFormField, WritingFormState, WritingPhase } from "@models/writingForm";

const props = withDefaults(
  defineProps<{
    phase: WritingPhase;
    form: WritingFormState;
    disabled?: boolean;
    isGenerating?: boolean;
    /** kiosk: 外側パネルが見出しを持つため内側ヘッダーを非表示 */
    variant?: "default" | "kiosk";
  }>(),
  { variant: "default" }
);

const emit = defineEmits<{
  "update:form": [WritingFormState];
  "confirm-schema": [];
  "start-generation": [];
}>();

const localTitle = ref(props.form.title ?? "");
const localFields = ref<WritingFormField[]>(
  props.form.fields.map((f) => ({ ...f }))
);

watch(
  () => props.form,
  (next) => {
    localTitle.value = next.title ?? "";
    localFields.value = next.fields.map((f) => ({ ...f }));
  },
  { deep: true }
);

const showPanel = computed(
  () =>
    props.phase === "format_review" ||
    props.phase === "filling" ||
    (props.phase === "done" && localFields.value.length > 0)
);

const phaseTitle = computed(() => {
  switch (props.phase) {
    case "format_review":
      return "入力フォーマット確認";
    case "filling":
      return "項目の入力";
    case "done":
      return "生成完了";
    default:
      return "";
  }
});

const phaseDescription = computed(() => {
  switch (props.phase) {
    case "format_review":
      return "抽出された項目定義を確認・編集してください。";
    case "filling":
      return "各項目に値を入力し、「入力開始」で一括生成します。";
    case "done":
      return "ファイル出力は右ペインに表示されています。";
    default:
      return "";
  }
});

const phaseBadge = computed(() => {
  switch (props.phase) {
    case "format_review":
      return "フォーマット確認中";
    case "filling":
      return "入力中";
    case "done":
      return "完了";
    default:
      return "";
  }
});

const fieldTypeItems = [
  { value: "text", label: "テキスト" },
  { value: "textarea", label: "長文" },
  { value: "number", label: "数値" },
  { value: "date", label: "日付" },
  { value: "select", label: "選択" },
] as const;

const selectItems = (field: WritingFormField) =>
  (field.options ?? []).map((o) => ({ value: o, label: o }));

const emitForm = (): void => {
  emit("update:form", {
    title: localTitle.value.trim() || undefined,
    fields: localFields.value.map((f) => ({ ...f })),
    schemaConfirmedAt: props.form.schemaConfirmedAt,
  });
};

const syncTitle = (): void => emitForm();

const addField = (): void => {
  const n = localFields.value.length + 1;
  localFields.value.push({
    key: `field_${n}`,
    label: `項目 ${n}`,
    type: "text",
    required: false,
  });
  emitForm();
};

const removeField = (index: number): void => {
  localFields.value.splice(index, 1);
  emitForm();
};

const canGenerate = computed(() => {
  for (const field of localFields.value) {
    if (!field.required) continue;
    if (!(field.value ?? "").trim()) return false;
  }
  return localFields.value.length > 0;
});
</script>
