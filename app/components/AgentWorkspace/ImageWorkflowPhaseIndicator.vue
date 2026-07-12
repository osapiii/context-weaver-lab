<template>
  <div
    v-if="variant === 'composer'"
    class="mb-2 flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
    :class="surfaceClass"
    data-testid="image-workflow-phase-banner"
    role="status"
    :aria-label="`現在のモード: ${modeTitle}`"
  >
    <div class="flex min-w-0 items-start gap-2.5">
      <div
        class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        :class="iconWrapClass"
      >
        <UIcon :name="modeIcon" class="h-5 w-5" />
      </div>
      <div class="min-w-0">
        <p class="text-xs font-bold text-slate-900">
          現在: {{ modeTitle }}
        </p>
        <p class="mt-0.5 text-[10px] leading-snug text-slate-600">
          {{ modeHint }}
        </p>
      </div>
    </div>
    <div
      v-if="canToggleRetouch"
      class="flex shrink-0 items-center justify-end gap-2"
      data-testid="image-workflow-phase-segment-composer"
    >
      <ImageWorkflowPhaseSegment
        :phase="phase"
        :disabled="disabled"
        @select="onSelectPhase"
      />
    </div>
  </div>

  <div
    v-else
    class="inline-flex max-w-none flex-shrink-0 items-center gap-1"
    data-testid="image-workflow-phase-header"
    role="group"
    aria-label="画像ワークフローモード"
  >
    <span
      v-if="!canToggleRetouch"
      class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      :class="createBadgeClass"
      data-testid="image-workflow-phase-badge"
    >
      <UIcon
        name="material-symbols:add-photo-alternate-outline"
        class="h-3 w-3 flex-shrink-0"
      />
      <span class="truncate">初稿生成</span>
    </span>
    <ImageWorkflowPhaseSegment
      v-else
      :phase="phase"
      :disabled="disabled"
      @select="onSelectPhase"
    />
  </div>
</template>

<script setup lang="ts">
import type { ImageWorkflowPhase } from "~/utils/imageStudioState";

const props = withDefaults(
  defineProps<{
    phase: ImageWorkflowPhase;
    canToggleRetouch: boolean;
    disabled?: boolean;
    variant?: "header" | "composer";
  }>(),
  {
    disabled: false,
    variant: "composer",
  }
);

const emit = defineEmits<{
  select: [phase: ImageWorkflowPhase];
}>();

const isRetouch = computed(() => props.phase === "retouch");

const modeTitle = computed(() =>
  isRetouch.value ? "レタッチフェーズ" : "初稿生成フェーズ"
);

const modeHint = computed(() =>
  isRetouch.value
    ? "右の OUT で範囲を指定するか、チャットで修正指示を送信"
    : "下の入力欄に指示を書いて送信（0から新規 / お手本は上部の作成方法で選択）"
);

const modeIcon = computed(() =>
  isRetouch.value
    ? "material-symbols:brush"
    : "material-symbols:add-photo-alternate-outline"
);

const surfaceClass = computed(() =>
  isRetouch.value
    ? "border-purple-200 bg-gradient-to-r from-purple-50/90 to-violet-50/50 ring-1 ring-purple-100"
    : "border-violet-200 bg-gradient-to-r from-violet-50/90 to-purple-50/40 ring-1 ring-violet-100"
);

const iconWrapClass = computed(() =>
  isRetouch.value ? "bg-purple-100 text-purple-800" : "bg-violet-100 text-violet-800"
);

const createBadgeClass =
  "border-violet-200 bg-violet-50 text-violet-900";

const onSelectPhase = (next: ImageWorkflowPhase): void => {
  emit("select", next);
};
</script>
