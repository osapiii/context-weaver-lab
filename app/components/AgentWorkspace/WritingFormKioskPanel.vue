<template>
  <div
    class="mx-auto w-full min-w-0"
    data-testid="writing-form-kiosk-panel"
  >
    <div
      class="mb-5 flex items-end gap-3 sm:gap-4"
      data-testid="writing-form-kiosk-mascot"
    >
      <div class="penguin-body relative shrink-0">
        <div class="penguin-shadow" aria-hidden="true" />
        <NuxtImg
          :src="appearance.aiAvatarUrl.value"
          :alt="
            appearance.hasCustomAiAvatar.value
              ? 'AI アシスタント'
              : '書類記入 AI バディ'
          "
          class="penguin-img relative z-10 h-20 w-20 object-contain sm:h-24 sm:w-24"
        />
      </div>

      <div
        class="speech-bubble relative min-w-0 flex-1 rounded-2xl bg-white px-4 py-3 shadow-[0_6px_20px_-8px_rgba(16,185,129,0.28)] ring-1 ring-emerald-200 sm:px-5 sm:py-3.5"
      >
        <p
          class="text-base font-bold leading-snug text-emerald-950 sm:text-lg"
          data-testid="writing-form-kiosk-title"
        >
          {{ title }}
        </p>
        <p
          class="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm"
          data-testid="writing-form-kiosk-subtitle"
        >
          {{ subtitle }}
        </p>
        <span class="bubble-tail" aria-hidden="true" />
      </div>
    </div>

    <div
      v-if="mode === 'extract'"
      class="space-y-4"
      data-testid="writing-form-kiosk-extract"
    >
      <div
        class="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-2.5"
      >
        <UIcon
          name="material-symbols:check-circle"
          class="h-4 w-4 shrink-0 text-emerald-600"
        />
        <p class="min-w-0 flex-1 text-xs font-semibold text-emerald-900">
          参考資料 {{ referenceCount }} 件 · 確定済み
        </p>
        <EnButton
          variant="ghost"
          size="xs"
          :disabled="disabled"
          @click="emit('edit-reference')"
        >
          変更
        </EnButton>
      </div>

      <div
        v-if="isExtracting"
        class="rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-4 shadow-sm"
        data-testid="writing-form-kiosk-extract-loading"
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
              フォーマットを抽出しています…
            </p>
            <p class="mt-1 text-xs leading-relaxed text-emerald-900/80">
              参考資料から入力項目を読み取っています。完了までしばらくお待ちください。
            </p>
          </div>
        </div>
      </div>

      <EnButton
        v-else
        variant="solid"
        color="success"
        size="md"
        class="w-full sm:w-auto sm:min-w-[12rem]"
        leading-icon="material-symbols:auto-awesome-outline"
        :disabled="disabled || !canExtract"
        data-testid="writing-extract-schema"
        @click="emit('extract-schema')"
      >
        フォーマットを抽出
      </EnButton>
    </div>

    <WritingFormatPreview
      v-else-if="mode === 'format_review'"
      :fields="form.fields"
      :reference-attachments="referenceAttachments"
      :disabled="disabled"
      :is-confirming="isGenerating"
      @update:fields="emit('update-form-fields', $event)"
      @confirm="emit('confirm-schema')"
    />

    <WritingFilledResultPanel
      v-else-if="mode === 'done'"
      :fields="form.fields"
      :messages="messages"
      :source-references="sourceReferences"
      :grounding-metadata="groundingMetadata"
      :reference-documents="referenceDocuments"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EnButton from "@components/EnButton.vue";
import WritingFormatPreview from "@components/AgentWorkspace/WritingFormatPreview.vue";
import WritingFilledResultPanel from "@components/AgentWorkspace/WritingFilledResultPanel.vue";
import type { WritingFormField, WritingFormState, WritingPhase, WritingReferenceAttachment } from "@models/writingForm";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import type { Document } from "@models/document";
import type { ConsultationSourceReference } from "@utils/consultationSourceReferences";

const props = withDefaults(
  defineProps<{
    mode: "extract" | "format_review" | "done";
    phase: WritingPhase;
    form: WritingFormState;
    messages?: ReadonlyArray<{
      role: string;
      artifacts?: AgentSseArtifact[];
    }>;
    referenceCount?: number;
    disabled?: boolean;
    canExtract?: boolean;
    isExtracting?: boolean;
    isGenerating?: boolean;
    sourceReferences?: ConsultationSourceReference[] | null;
    groundingMetadata?: unknown;
    referenceDocuments?: Document[];
    referenceAttachments?: WritingReferenceAttachment[];
  }>(),
  {
    referenceCount: 0,
    messages: () => [],
    disabled: false,
    canExtract: true,
    isExtracting: false,
    isGenerating: false,
    referenceDocuments: () => [],
    referenceAttachments: () => [],
  }
);

const emit = defineEmits<{
  "edit-reference": [];
  "extract-schema": [];
  "confirm-schema": [];
  "update-form-fields": [fields: WritingFormField[]];
}>();

const appearance = useAppAppearance();

const title = computed((): string => {
  switch (props.mode) {
    case "extract":
      return "入力項目を抽出します";
    case "format_review":
      return "フォーマットを確認してください";
    case "done":
      return "入力が完了しました";
    default:
      return "";
  }
});

const subtitle = computed((): string => {
  switch (props.mode) {
    case "extract":
      return "参考資料から入力すべき項目の一覧を自動で読み取ります";
    case "format_review":
      return "抽出された項目を確認し、確定してください";
    case "done":
      return "AI が入力した内容を確認できます";
    default:
      return "";
  }
});
</script>

<style scoped>
.speech-bubble {
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.02));
}

.bubble-tail {
  position: absolute;
  left: -10px;
  bottom: 18px;
  width: 0;
  height: 0;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-right: 12px solid white;
}

.penguin-img {
  will-change: transform;
  animation: penguin-bob 3.6s ease-in-out infinite;
}

@keyframes penguin-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-1.5deg);
  }
  50% {
    transform: translateY(-8px) rotate(1.5deg);
  }
}

.penguin-shadow {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 64px;
  height: 10px;
  background: radial-gradient(
    ellipse,
    rgba(16, 185, 129, 0.28) 0%,
    transparent 70%
  );
  border-radius: 50%;
  filter: blur(4px);
  animation: shadow-pulse 3.6s ease-in-out infinite;
}

@keyframes shadow-pulse {
  0%,
  100% {
    width: 64px;
    opacity: 0.7;
  }
  50% {
    width: 48px;
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .penguin-img,
  .penguin-shadow {
    animation: none;
  }
}
</style>
