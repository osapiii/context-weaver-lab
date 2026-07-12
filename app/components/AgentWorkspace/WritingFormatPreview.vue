<template>
  <div
    class="space-y-3"
    data-testid="writing-format-preview"
  >
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <WritingReferenceAttachmentPreview
        :attachments="referenceAttachments"
      />

      <div class="min-w-0 space-y-3">
        <div
          class="max-h-[min(70vh,42rem)] space-y-3 overflow-y-auto pr-0.5"
          role="list"
          aria-label="フォーム項目一覧"
        >
          <EnCard
            v-for="(field, index) in localFields"
            :key="field.key"
            variant="default"
            padding="snug"
            custom-class="border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80"
            role="listitem"
            :data-testid="`writing-format-field-${field.key}`"
          >
            <div class="flex items-start gap-2 sm:gap-3">
              <div class="min-w-0 flex-1 space-y-3">
                <div
                  class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10.5rem]"
                >
                  <UFormField
                    label="項目名"
                    :ui="{ label: 'text-xs font-semibold text-slate-700' }"
                  >
                    <UInput
                      :model-value="field.label"
                      size="md"
                      class="w-full"
                      placeholder="例: 会社名"
                      @update:model-value="(value) => onLabelChange({ index, value })"
                    />
                  </UFormField>
                  <UFormField
                    label="形式"
                    :ui="{ label: 'text-xs font-semibold text-slate-700' }"
                  >
                    <EnSelectMenu
                      :model-value="field.type"
                      :items="fieldTypeOptions"
                      value-key="value"
                      label-key="label"
                      size="md"
                      class="w-full"
                      @update:model-value="(value) => onTypeChange({ index, value })"
                    />
                  </UFormField>
                </div>

                <UFormField
                  label="カスタム指示（任意）"
                  :ui="{ label: 'text-xs font-semibold text-slate-700' }"
                >
                  <UInput
                    :model-value="field.customInstruction ?? ''"
                    size="md"
                    class="w-full"
                    placeholder="例: 正式な文体で、敬語を意識して記述"
                    @update:model-value="(value) => onInstructionChange({ index, value })"
                  />
                </UFormField>
              </div>

              <EnButton
                variant="soft"
                color="neutral"
                size="md"
                leading-icon="material-symbols:delete-outline"
                :title="`${field.label || '項目'} を削除`"
                :disabled="localFields.length <= 1"
                class="mt-5 shrink-0"
                @click="removeField({ index })"
              />
            </div>
          </EnCard>
        </div>

        <EnButton
          variant="soft"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:add"
          class="w-full sm:w-auto"
          data-testid="writing-format-add-field"
          @click="addField"
        >
          項目を追加
        </EnButton>
      </div>
    </div>

    <p class="text-[11px] leading-relaxed text-slate-500">
      {{ localFields.length }} 項目 · 左の資料と照合しながら編集できます ·
      確定後、AI が社内ナレッジを参照して自動入力します
    </p>

    <EnButton
      variant="solid"
      color="success"
      size="md"
      class="w-full sm:w-auto sm:min-w-[14rem]"
      leading-icon="material-symbols:auto-awesome-outline"
      :disabled="disabled || localFields.length < 1"
      :loading="isConfirming"
      data-testid="writing-confirm-schema"
      @click="emit('confirm')"
    >
      フォーマットを確定して入力開始
    </EnButton>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import EnButton from "@components/EnButton.vue";
import EnCard from "@components/EnCard.vue";
import EnSelectMenu from "@components/EnSelectMenu.vue";
import WritingReferenceAttachmentPreview from "@components/AgentWorkspace/WritingReferenceAttachmentPreview.vue";
import type {
  WritingFieldType,
  WritingFormField,
  WritingReferenceAttachment,
} from "@models/writingForm";
import { createEmptyWritingFormField } from "@utils/writingWorkspaceState";

const props = defineProps<{
  fields: WritingFormField[];
  referenceAttachments?: WritingReferenceAttachment[];
  disabled?: boolean;
  isConfirming?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  "update:fields": [fields: WritingFormField[]];
}>();

const localFields = ref<WritingFormField[]>([]);

const fieldTypeOptions: Array<{ label: string; value: WritingFieldType }> = [
  { label: "短文", value: "text" },
  { label: "長文", value: "textarea" },
  { label: "数値", value: "number" },
  { label: "日付", value: "date" },
  { label: "選択", value: "select" },
];

watch(
  () => props.fields,
  (fields) => {
    localFields.value = fields.map((field) => ({ ...field }));
  },
  { immediate: true, deep: true }
);

const emitFields = (): void => {
  emit("update:fields", localFields.value.map((field) => ({ ...field })));
};

const slugifyKey = (params: { label: string; index: number }): string => {
  const base = params.label
    .trim()
    .toLowerCase()
    .replace(/[^\w\u3040-\u30ff\u3400-\u9fff]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return base || `field_${params.index + 1}`;
};

const onLabelChange = (params: { index: number; value: string }): void => {
  const field = localFields.value[params.index];
  if (!field) return;
  field.label = params.value;
  if (!field.key || field.key.startsWith("field_")) {
    field.key = slugifyKey({ label: params.value, index: params.index });
  }
  emitFields();
};

const onTypeChange = (params: {
  index: number;
  value: WritingFieldType;
}): void => {
  const field = localFields.value[params.index];
  if (!field) return;
  field.type = params.value;
  emitFields();
};

const onInstructionChange = (params: {
  index: number;
  value: string;
}): void => {
  const field = localFields.value[params.index];
  if (!field) return;
  field.customInstruction = params.value.trim() || undefined;
  emitFields();
};

const addField = (): void => {
  localFields.value.push(
    createEmptyWritingFormField({ index: localFields.value.length })
  );
  emitFields();
};

const removeField = (params: { index: number }): void => {
  if (localFields.value.length <= 1) return;
  localFields.value.splice(params.index, 1);
  emitFields();
};
</script>
