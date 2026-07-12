<template>
  <AiStudioStartKioskShell
    theme="image"
    mascot-message="どんな画像にする？&#10;用途も一緒に教えてね"
    mascot-alt="画像生成 AI"
    :title="title"
    :description="subtitle"
    test-id="image-prompt-kiosk-panel"
  >
    <div
      class="grid items-start gap-4 md:gap-5"
      :class="
        showReferenceViewer
          ? 'md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]'
          : ''
      "
    >
      <ImageReferencePreviewViewer
        v-if="showReferenceViewer"
        :references="referenceState!.references"
        @edit="emit('edit-reference')"
      />

      <div
        class="flex min-h-0 flex-col gap-4"
        data-testid="image-prompt-kiosk-form"
      >
        <div data-testid="image-prompt-kiosk-subject">
          <UFormField label="何の画像を生成しますか?">
            <UTextarea
              :model-value="subject"
              :rows="3"
              :placeholder="subjectPlaceholder"
              :disabled="disabled"
              class="w-full"
              @update:model-value="(v) => emit('update:subject', String(v ?? ''))"
            />
          </UFormField>
        </div>

        <div data-testid="image-prompt-kiosk-usage">
          <UFormField label="画像を何に使用しますか?">
            <UTextarea
              :model-value="usage"
              :rows="2"
              :placeholder="usagePlaceholder"
              :disabled="disabled"
              class="w-full"
              @update:model-value="(v) => emit('update:usage', String(v ?? ''))"
            />
          </UFormField>
        </div>

        <div
          v-if="isSending"
          class="rounded-xl border border-purple-200/90 bg-purple-50/80 px-4 py-4 shadow-sm"
          data-testid="image-prompt-kiosk-loading"
          role="status"
          aria-live="polite"
        >
          <div class="flex items-start gap-3">
            <UIcon
              name="material-symbols:progress-activity"
              class="mt-0.5 h-7 w-7 shrink-0 animate-spin text-purple-500"
            />
            <div class="min-w-0">
              <p class="text-sm font-semibold text-purple-950">
                画像を生成しています…
              </p>
              <p class="mt-1 text-xs leading-relaxed text-purple-900/80">
                組織ナレッジを参照しながら描いています。完了までしばらくお待ちください。
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p
            v-if="sendHint && !canSend && !isSending"
            class="text-center text-[11px] text-slate-500 sm:mr-auto sm:text-left"
          >
            {{ sendHint }}
          </p>
          <EnButton
            variant="ai"
            size="md"
            class="w-full sm:w-auto sm:min-w-[10rem]"
            leading-icon="i-heroicons-sparkles"
            :disabled="disabled || !canSend"
            :loading="isSending"
            data-testid="image-prompt-kiosk-send"
            @click="onSubmit"
          >
            {{ sendLabel }}
          </EnButton>
        </div>
      </div>
    </div>
  </AiStudioStartKioskShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AiStudioStartKioskShell from "@components/AiStudio/AiStudioStartKioskShell.vue";
import EnButton from "@components/EnButton.vue";
import ImageReferencePreviewViewer from "@components/AgentWorkspace/ImageReferencePreviewViewer.vue";
import type {
  ImageCreationMode,
  ImageReferenceState,
} from "@utils/imageReference";

const props = withDefaults(
  defineProps<{
    subject: string;
    usage: string;
    title: string;
    subtitle: string;
    subjectPlaceholder: string;
    usagePlaceholder: string;
    disabled?: boolean;
    canSend?: boolean;
    isSending?: boolean;
    sendHint?: string;
    sendLabel?: string;
    creationMode?: ImageCreationMode | null;
    referenceState?: ImageReferenceState;
  }>(),
  {
    disabled: false,
    canSend: false,
    isSending: false,
    sendHint: undefined,
    sendLabel: "画像生成開始",
    creationMode: null,
    referenceState: undefined,
  }
);

const emit = defineEmits<{
  "update:subject": [value: string];
  "update:usage": [value: string];
  submit: [];
  "edit-reference": [];
}>();

const showReferenceViewer = computed(
  () =>
    props.creationMode === "reference" &&
    (props.referenceState?.references.length ?? 0) > 0
);

const onSubmit = (): void => {
  if (props.disabled || !props.canSend) return;
  emit("submit");
};
</script>
