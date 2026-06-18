<template>
  <div
    class="inline-flex rounded-full border p-0.5"
    :class="trackClass"
    role="group"
    :aria-label="ariaLabel"
  >
    <button
      type="button"
      class="rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors"
      :class="segmentClass('create')"
      :disabled="disabled"
      :aria-pressed="phase === 'create'"
      data-testid="image-workflow-phase-create"
      @click="emit('select', 'create')"
    >
      <span class="inline-flex items-center gap-1">
        <UIcon
          name="material-symbols:add-photo-alternate-outline"
          class="h-3 w-3"
        />
        新規生成
      </span>
    </button>
    <button
      type="button"
      class="rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors"
      :class="segmentClass('retouch')"
      :disabled="disabled"
      :aria-pressed="phase === 'retouch'"
      data-testid="image-workflow-phase-retouch"
      @click="emit('select', 'retouch')"
    >
      <span class="inline-flex items-center gap-1">
        <UIcon name="material-symbols:brush" class="h-3 w-3" />
        レタッチ
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ImageWorkflowPhase } from "~/utils/imageStudioState";

const props = withDefaults(
  defineProps<{
    phase: ImageWorkflowPhase;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  select: [phase: ImageWorkflowPhase];
}>();

const ariaLabel = "新規生成モードとレタッチモードの切り替え";

const trackClass = computed(() =>
  props.phase === "retouch"
    ? "border-purple-200 bg-purple-50/80"
    : "border-violet-200 bg-violet-50/80"
);

const segmentClass = (target: ImageWorkflowPhase): string => {
  const active = props.phase === target;
  if (target === "retouch") {
    return active
      ? "bg-purple-600 text-white shadow-sm"
      : "text-purple-900 hover:bg-purple-100/80 disabled:opacity-50";
  }
  return active
    ? "bg-violet-600 text-white shadow-sm"
    : "text-violet-900 hover:bg-violet-100/80 disabled:opacity-50";
};
</script>
