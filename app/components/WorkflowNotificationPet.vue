<template>
  <Transition name="workflow-pet-fade">
    <div
      v-if="isVisible"
      class="fixed bottom-10 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:bottom-11 sm:right-6"
      data-testid="workflow-notification-pet"
    >
      <Transition name="workflow-bubble-pop">
        <button
          v-if="showBubble"
          type="button"
          class="pointer-events-auto w-[min(calc(100vw-2rem),23rem)] rounded-[1.75rem] border border-slate-200 bg-white/95 px-4 py-3 text-left shadow-[0_16px_42px_-22px_rgba(15,23,42,0.55)] ring-1 ring-white/80 backdrop-blur transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_18px_46px_-22px_rgba(217,119,6,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          :aria-label="bubbleAriaLabel"
          aria-live="polite"
          @click="openPanel"
        >
          <div class="flex items-start gap-3">
            <span
              class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              :class="statusTone.iconShell"
              aria-hidden="true"
            >
              <UIcon
                :name="statusTone.icon"
                class="h-4 w-4"
                :class="statusTone.iconClass"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex min-w-0 items-center gap-2">
                <span class="truncate text-sm font-bold leading-5 text-slate-900">
                  {{ bubbleTitle }}
                </span>
                <span
                  class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                  :class="statusTone.badge"
                >
                  {{ statusTone.label }}
                </span>
              </span>
              <span class="mt-0.5 line-clamp-2 text-sm leading-5 text-slate-700">
                {{ bubbleMessage }}
              </span>
              <span class="mt-1 block text-[11px] font-medium text-slate-400">
                {{ updatedLabel }}
              </span>
            </span>
          </div>
        </button>
      </Transition>

      <button
        v-if="showBubble"
        type="button"
        class="pointer-events-auto mr-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        aria-label="通知メッセージを畳む"
        title="畳む"
        @click="dismissBubble"
      >
        <UIcon name="material-symbols:keyboard-arrow-down-rounded" class="h-5 w-5" />
      </button>

      <button
        type="button"
        class="workflow-pet-avatar pointer-events-auto relative h-16 w-16 outline-none transition hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-amber-400 sm:h-20 sm:w-20"
        :aria-label="avatarAriaLabel"
        :title="avatarTitle"
        @click="openPanel"
      >
        <span
          v-if="isWorking"
          class="absolute inset-2 rounded-full bg-orange-300/35 blur-md"
          aria-hidden="true"
        />
        <span
          class="absolute bottom-0 left-1/2 h-3 w-11 -translate-x-1/2 rounded-full bg-slate-900/15 blur-md sm:w-14"
          aria-hidden="true"
        />
        <NuxtImg
          :src="appearance.aiAvatarUrl.value"
          :alt="avatarAlt"
          class="workflow-pet-image relative z-10 h-full w-full object-contain"
          :class="{ 'workflow-pet-image-working': isWorking }"
        />
        <span
          v-if="notifications.unreadCount > 0"
          class="absolute right-0 top-0 z-20 flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-5 text-white ring-2 ring-white"
        >
          {{ unreadLabel }}
        </span>
        <span
          v-if="displayItem"
          class="absolute bottom-1 right-1 z-20 h-3 w-3 rounded-full ring-2 ring-white"
          :class="statusTone.dot"
          aria-hidden="true"
        />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useWorkflowExecutionsStore } from "@stores/workflowExecutions";
import { useWorkflowNotificationsStore } from "@stores/workflowNotifications";
import type { NotificationItem } from "@models/notificationItem";
import type { WorkflowItemStatus } from "@models/workflowItem";

const workflowExecutions = useWorkflowExecutionsStore();
const notifications = useWorkflowNotificationsStore();
const aiAssistant = useEnAiStudioAssistantStore();
const appearance = useAppAppearance();

const dismissedBubbleKey = ref<string | null>(null);

const activeItem = computed<NotificationItem | null>(
  () =>
    notifications.items.find((item) =>
      item.status === "pending" || item.status === "running"
    ) ?? null
);

const displayItem = computed<NotificationItem | null>(
  () => activeItem.value ?? notifications.unreadItems[0] ?? null
);

const bubbleKey = computed(() => {
  const item = displayItem.value;
  if (!item) return "";
  return `${item.id}:${item.status}:${item.updatedAt.getTime()}`;
});

const showBubble = computed(
  () =>
    !!displayItem.value &&
    !notifications.isPanelOpen &&
    dismissedBubbleKey.value !== bubbleKey.value
);

const isVisible = computed(
  () => !notifications.isPanelOpen && !aiAssistant.isOpen
);

const isWorking = computed(
  () =>
    displayItem.value?.status === "pending" ||
    displayItem.value?.status === "running"
);

const unreadLabel = computed(() =>
  notifications.unreadCount > 99 ? "99+" : String(notifications.unreadCount)
);

const bubbleTitle = computed(() => displayItem.value?.jobTypeLabel ?? "仕事ログ");
const bubbleMessage = computed(() => displayItem.value?.title ?? "");

const updatedLabel = computed(() => {
  const item = displayItem.value;
  if (!item) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(item.updatedAt);
});

const avatarAlt = computed(() =>
  appearance.hasCustomAiAvatar.value ? "AI アシスタント" : "工程ペンギン"
);

const avatarTitle = computed(() =>
  displayItem.value ? "お知らせを開く" : "仕事ログ"
);

const avatarAriaLabel = computed(() =>
  displayItem.value
    ? `お知らせを開く: ${bubbleTitle.value}、${bubbleMessage.value}`
    : "仕事ログのお知らせを開く"
);

const bubbleAriaLabel = computed(
  () => `${bubbleTitle.value}: ${bubbleMessage.value}`
);

const STATUS_TONE: Record<
  WorkflowItemStatus,
  {
    label: string;
    icon: string;
    iconClass: string;
    iconShell: string;
    badge: string;
    dot: string;
  }
> = {
  pending: {
    label: "待機中",
    icon: "material-symbols:schedule-rounded",
    iconClass: "text-slate-600",
    iconShell: "bg-slate-100",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
  },
  running: {
    label: "進行中",
    icon: "material-symbols:autorenew-rounded",
    iconClass: "animate-spin text-orange-600",
    iconShell: "bg-orange-100",
    badge: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
  },
  completed: {
    label: "完了",
    icon: "material-symbols:check-circle-rounded",
    iconClass: "text-emerald-600",
    iconShell: "bg-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  error: {
    label: "要確認",
    icon: "material-symbols:error-rounded",
    iconClass: "text-rose-600",
    iconShell: "bg-rose-100",
    badge: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
  },
};

const statusTone = computed(
  () => STATUS_TONE[displayItem.value?.status ?? "pending"]
);

function dismissBubble(): void {
  dismissedBubbleKey.value = bubbleKey.value;
}

function openPanel(): void {
  notifications.openPanel();
}

onMounted(() => {
  workflowExecutions.subscribe();
  void notifications.loadReadStates();
});

watch(
  () => notifications.isPanelOpen,
  (open) => {
    if (open) void notifications.loadReadStates();
  }
);
</script>

<style scoped>
.workflow-pet-image {
  filter: drop-shadow(0 12px 14px rgb(15 23 42 / 0.2));
  transform-origin: 50% 86%;
}

.workflow-pet-image-working {
  animation: workflow-pet-bob 2.8s ease-in-out infinite;
}

@keyframes workflow-pet-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-1deg);
  }
  50% {
    transform: translateY(-5px) rotate(1deg);
  }
}

.workflow-pet-fade-enter-active,
.workflow-pet-fade-leave-active,
.workflow-bubble-pop-enter-active,
.workflow-bubble-pop-leave-active {
  transition:
    opacity 180ms ease,
    transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.workflow-pet-fade-enter-from,
.workflow-pet-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.workflow-bubble-pop-enter-from,
.workflow-bubble-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .workflow-pet-image-working {
    animation: none;
  }

  .workflow-pet-image,
  .workflow-pet-avatar,
  .workflow-pet-fade-enter-active,
  .workflow-pet-fade-leave-active,
  .workflow-bubble-pop-enter-active,
  .workflow-bubble-pop-leave-active {
    transition: none;
  }
}
</style>
