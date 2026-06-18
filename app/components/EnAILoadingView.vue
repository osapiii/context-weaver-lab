<template>
  <div
    v-if="visible"
    :class="rootClass"
    role="status"
    aria-live="polite"
    :aria-busy="status === 'loading'"
    data-testid="en-aistudio-ai-loading-view"
  >
    <div :class="innerClass">
      <div class="relative flex items-center justify-center">
        <UIcon
          v-if="status === 'success'"
          name="i-heroicons-check-circle"
          class="h-16 w-16 text-success-500"
        />
        <template v-else>
          <UIcon
            name="i-heroicons-sparkles"
            class="absolute -right-1 -top-1 h-6 w-6 text-purple-400 animate-pulse"
          />
          <UIcon
            name="i-svg-spinners-180-ring-with-bg"
            class="h-14 w-14 text-primary animate-pulse"
          />
        </template>
      </div>

      <div class="max-w-md space-y-2 text-center">
        <p class="text-lg font-bold text-slate-900">
          {{ displayTitle }}
        </p>
        <p
          v-if="displaySubtitle"
          class="text-sm text-slate-600 transition-opacity duration-300"
        >
          {{ displaySubtitle }}
        </p>
        <p
          v-if="hint"
          class="text-xs text-slate-500 font-mono truncate max-w-full px-2"
        >
          {{ hint }}
        </p>
      </div>

      <UProgress
        v-if="showProgress && status === 'loading'"
        size="sm"
        :color="progressColor"
        class="w-full max-w-xs"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from "vue";
import { useRotatingMessages } from "@composables/useRotatingMessages";

const props = withDefaults(
  defineProps<{
    /** overlay: 親要素 relative 上に被せる / panel: 単体カード */
    variant?: "overlay" | "panel";
    /** overlay 時の表示切替 */
    active?: boolean;
    status?: "loading" | "success";
    title?: string;
    /** 固定サブタイトル（指定時は messages ローテーションより優先） */
    subtitle?: string;
    messages?: readonly string[];
    messageIndex?: number | null;
    rotate?: boolean;
    rotateIntervalMs?: number;
    hint?: string;
    showProgress?: boolean;
    progressColor?: "primary" | "warning" | "success";
  }>(),
  {
    variant: "panel",
    active: true,
    status: "loading",
    title: "AIが処理しています",
    rotate: true,
    rotateIntervalMs: 2800,
    showProgress: true,
    progressColor: "primary",
  }
);

const visible = computed(() =>
  props.variant === "overlay" ? props.active : true
);

const messageList = computed(() => props.messages ?? []);

const rotateEnabled = computed(
  () =>
    props.status === "loading" &&
    props.rotate &&
    !props.subtitle &&
    props.messageIndex == null &&
    messageList.value.length > 0
);

const { currentMessage } = useRotatingMessages(messageList, {
  enabled: rotateEnabled,
  intervalMs: props.rotateIntervalMs,
  messageIndex: toRef(props, "messageIndex"),
});

const displayTitle = computed(() => {
  if (props.status === "success") {
    return props.title === "AIが処理しています"
      ? "処理が完了しました"
      : props.title;
  }
  return props.title;
});

const displaySubtitle = computed(() => {
  if (props.subtitle) return props.subtitle;
  if (props.messageIndex != null && props.messages?.length) {
    const idx = Math.min(
      Math.max(props.messageIndex, 0),
      props.messages.length - 1
    );
    return props.messages[idx];
  }
  if (props.messages?.length && props.status === "loading") {
    return currentMessage.value;
  }
  return props.status === "success" ? "内容を確認してください" : null;
});

const rootClass = computed(() => {
  if (props.variant === "overlay") {
    return [
      "absolute inset-0 z-20 flex flex-col items-center justify-center",
      "rounded-xl bg-white/95 px-6 py-10 backdrop-blur-sm",
    ].join(" ");
  }
  return [
    "flex flex-col items-center justify-center rounded-xl",
    "border border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-violet-50/40",
    "px-6 py-10 shadow-sm min-h-[min(320px,42vh)] w-full",
  ].join(" ");
});

const innerClass = computed(() =>
  props.variant === "overlay"
    ? "flex flex-col items-center justify-center gap-5 w-full"
    : "flex flex-col items-center justify-center gap-5 w-full max-w-lg mx-auto"
);
</script>
