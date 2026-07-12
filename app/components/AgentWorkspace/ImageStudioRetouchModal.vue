<template>
  <EnModal
    v-model:open="openModel"
    size="full"
    header-variant="dark"
    padding="none"
    :fullscreen="true"
    :ui="{
      overlay: 'z-[70]',
      content: 'z-[70] max-h-[100dvh]',
    }"
    data-testid="image-studio-retouch-modal"
    @close="emit('close')"
  >
    <template #title>
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <div
          class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"
        >
          <UIcon
            name="material-symbols:brush"
            class="h-[18px] w-[18px] text-sky-300"
          />
        </div>
        <div class="min-w-0">
          <p
            class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
          >
            画像レタッチ
          </p>
          <p class="truncate text-sm font-bold leading-tight text-white">
            {{ title }}
          </p>
        </div>
      </div>
    </template>

    <div
      class="flex min-h-0 flex-col bg-slate-50"
      data-testid="image-studio-editor"
    >
      <nav
        class="flex-shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 sm:px-6"
        aria-label="レタッチの手順"
      >
        <ol class="flex flex-wrap items-center gap-1 sm:gap-0">
          <li
            v-for="(step, index) in editor.workflowSteps.value"
            :key="step.id"
            class="flex items-center"
          >
            <div
              class="flex items-center gap-2 rounded-full px-2 py-1 transition-colors"
              :class="stepperItemClass(step, index)"
            >
              <span
                class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors"
                :class="stepperDotClass(step, index)"
              >
                <UIcon
                  v-if="step.done"
                  name="material-symbols:check"
                  class="h-3.5 w-3.5"
                />
                <span v-else>{{ index + 1 }}</span>
              </span>
              <span class="text-[11px] font-semibold tracking-tight">
                {{ step.label }}
              </span>
            </div>
            <div
              v-if="index < editor.workflowSteps.value.length - 1"
              class="mx-1 hidden h-px w-6 bg-slate-200 sm:block lg:w-10"
              aria-hidden="true"
            />
          </li>
        </ol>
      </nav>

      <div
        class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]"
        style="min-height: min(80vh, calc(100dvh - 8.5rem))"
      >
        <div
          class="relative flex min-h-0 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-200/40 via-slate-100 to-slate-50 p-4 lg:p-5"
        >
          <div
            v-if="isRunningRetouch"
            class="absolute inset-0 z-[2] flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px]"
            data-testid="image-studio-retouch-loading"
            role="status"
            aria-live="polite"
          >
            <div
              class="mx-4 flex max-w-sm items-start gap-3 rounded-xl border border-purple-200/90 bg-white px-4 py-3.5 shadow-lg"
            >
              <UIcon
                name="material-symbols:progress-activity"
                class="mt-0.5 h-7 w-7 shrink-0 animate-spin text-purple-500"
              />
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-900">
                  レタッチを適用しています…
                </p>
                <p class="mt-0.5 text-xs text-slate-600">
                  完了までこの画面を開いたままお待ちください。
                </p>
              </div>
            </div>
          </div>
          <div
            class="pointer-events-none absolute inset-0 opacity-[0.35]"
            style="background-image: radial-gradient(circle, #94a3b8 1px, transparent 1px); background-size: 20px 20px;"
            aria-hidden="true"
          />
          <ImageStudioCanvas
            class="relative z-[1] min-h-0 flex-1"
            :editor="editor"
            :disabled="disabled"
          />
        </div>
        <ImageStudioRegionList
          :editor="editor"
          :disabled="disabled"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-3">
        <p
          v-if="footerHint"
          class="text-left text-[11px] leading-relaxed text-slate-500"
        >
          {{ footerHint }}
        </p>
        <span v-else class="hidden sm:block" />

        <div class="flex flex-wrap items-center justify-end gap-2">
          <EnButton
            variant="outline"
            size="sm"
            :disabled="disabled"
            data-testid="image-studio-reset-create"
            @click="emit('reset-to-create')"
          >
            初稿からやり直す
          </EnButton>
          <EnButton
            variant="ghost"
            size="sm"
            @click="openModel = false"
          >
            閉じる
          </EnButton>
          <EnButton
            variant="ai"
            size="sm"
            :disabled="!canExecuteRetouch"
            :loading="isRunningRetouch"
            data-testid="image-studio-run-retouch"
            @click="onRunRetouch"
          >
            レタッチを実行
          </EnButton>
        </div>
      </div>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, toRef, watch } from "vue";
import EnButton from "@components/EnButton.vue";
import EnModal from "@components/EnModal.vue";
import ImageStudioCanvas from "@components/AgentWorkspace/ImageStudioCanvas.vue";
import ImageStudioRegionList from "@components/AgentWorkspace/ImageStudioRegionList.vue";
import { useImageStudioRetouchEditor } from "@composables/useImageStudioRetouchEditor";
import type { ImageRetouchRegion } from "@utils/imageStudioState";

const props = withDefaults(
  defineProps<{
    open: boolean;
    imageUrl: string;
    storageGcsPath?: string;
    sourceGcsPath?: string;
    contentType?: string;
    regions: ImageRetouchRegion[];
    title?: string;
    disabled?: boolean;
    isRunningRetouch?: boolean;
  }>(),
  {
    title: "生成画像",
    disabled: false,
    isRunningRetouch: false,
  }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:regions": [
    params: { regions: ImageRetouchRegion[]; persist?: boolean },
  ];
  "run-retouch": [params: { prompt: string; regions: ImageRetouchRegion[] }];
  "reset-to-create": [];
  close: [];
}>();

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit("update:open", value),
});

const editor = useImageStudioRetouchEditor({
  imageUrl: toRef(props, "imageUrl"),
  storageGcsPath: toRef(props, "storageGcsPath"),
  sourceGcsPath: toRef(props, "sourceGcsPath"),
  contentType: toRef(props, "contentType"),
  regions: toRef(props, "regions"),
  disabled: computed(() => props.disabled),
  onRegionsChange: (params) => emit("update:regions", params),
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      editor.canvas.selectRegion(null);
    }
  }
);

const currentStepIndex = computed(() => {
  const steps = editor.workflowSteps.value;
  const firstOpen = steps.findIndex((step) => !step.done);
  return firstOpen === -1 ? steps.length - 1 : firstOpen;
});

const isCurrentStep = (index: number): boolean =>
  index === currentStepIndex.value;

const stepperItemClass = (
  step: { done: boolean },
  index: number
): string => {
  if (step.done) return "text-emerald-800";
  if (isCurrentStep(index)) return "text-slate-900";
  return "text-slate-400";
};

const stepperDotClass = (step: { done: boolean }, index: number): string => {
  if (step.done) {
    return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
  }
  if (isCurrentStep(index)) {
    return "bg-slate-900 text-white shadow-sm";
  }
  return "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
};

const hasAnyInstruction = computed(() =>
  editor.canvas.regions.value.some(
    (region) =>
      region.instruction.trim() ||
      Boolean(region.referenceImage?.gcsPath?.trim())
  )
);

const canExecuteRetouch = computed(
  () =>
    !props.disabled &&
    !editor.isUploading.value &&
    !editor.isReferenceUploading.value &&
    !props.isRunningRetouch &&
    editor.canvas.regions.value.length > 0 &&
    hasAnyInstruction.value
);

const footerHint = computed((): string | null => {
  if (editor.canvas.regions.value.length === 0) {
    return "左の画像をドラッグして、修正したい範囲を1つ以上指定してください。";
  }
  if (!hasAnyInstruction.value) {
    return "各範囲の修正指示を入力するか、差し替え参照画像を添付してください。";
  }
  return null;
});

const buildRetouchPrompt = (): string =>
  editor.canvas.regions.value
    .map((region, index) => {
      const instr = region.instruction.trim();
      const refNote = region.referenceImage?.gcsPath?.trim()
        ? "（差し替え参照画像を添付済み）"
        : "";
      if (instr) {
        return `範囲 ${index + 1}: ${instr}${refNote}`;
      }
      if (refNote) {
        return `範囲 ${index + 1}: 添付参照画像でこの矩形内を差し替え${refNote}`;
      }
      return `範囲 ${index + 1}: この矩形内を修正（指示は範囲のみ）`;
    })
    .join("\n");

const onRunRetouch = (): void => {
  if (!canExecuteRetouch.value) return;
  editor.flushRegionsToStore({ persist: true });
  emit("run-retouch", {
    prompt: buildRetouchPrompt(),
    regions: [...editor.canvas.regions.value],
  });
};
</script>
