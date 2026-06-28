<template>
  <Transition name="workflow-pet-fade">
    <div
      v-if="isVisible"
      ref="petContainer"
      class="workflow-pet-container fixed z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2"
      :style="petContainerStyle"
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
                <span
                  class="truncate text-sm font-bold leading-5 text-slate-900"
                >
                  {{ bubbleTitle }}
                </span>
                <span
                  class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                  :class="statusTone.badge"
                >
                  {{ statusTone.label }}
                </span>
              </span>
              <span
                class="mt-0.5 line-clamp-2 text-sm leading-5 text-slate-700"
              >
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
        <UIcon
          name="material-symbols:keyboard-arrow-down-rounded"
          class="h-5 w-5"
        />
      </button>

      <div class="relative">
        <button
          type="button"
          class="workflow-pet-avatar pointer-events-auto relative touch-none cursor-grab outline-none transition hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-amber-400 active:cursor-grabbing"
          :class="petAvatarSizeClass"
          :aria-label="avatarAriaLabel"
          :title="avatarTitle"
          @click="onAvatarClick"
          @pointerdown="onAvatarPointerDown"
        >
          <span
            v-if="isWorking"
            class="absolute inset-2 rounded-full bg-orange-300/35 blur-md"
            aria-hidden="true"
          />
          <span
            class="absolute bottom-0 left-1/2 h-4 -translate-x-1/2 rounded-full bg-slate-900/15 blur-md"
            :class="petShadowSizeClass"
            aria-hidden="true"
          />
          <img
            :src="appearance.aiAvatarUrl.value"
            :alt="avatarAlt"
            class="workflow-pet-image relative z-10 h-full w-full object-contain"
            :class="{ 'workflow-pet-image-working': isWorking }"
            draggable="false"
            width="80"
            height="80"
            decoding="async"
          >
          <span
            v-if="notifications.unreadCount > 0"
            class="absolute right-1 top-1 z-20 flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-5 text-white ring-2 ring-white"
          >
            {{ unreadLabel }}
          </span>
          <span
            v-if="displayItem"
            class="absolute bottom-2 right-2 z-20 h-3.5 w-3.5 rounded-full ring-2 ring-white"
            :class="statusTone.dot"
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          class="pointer-events-auto absolute -bottom-1 -right-1 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-[0_10px_24px_-14px_rgba(15,23,42,0.55)] ring-1 ring-white/80 transition hover:-translate-y-0.5 hover:border-amber-200 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          :aria-label="petSizeToggleLabel"
          :title="petSizeToggleLabel"
          @click.stop="togglePetSize"
          @pointerdown.stop.prevent
        >
          <UIcon :name="petSizeToggleIcon" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useWorkflowExecutionsStore } from "@stores/workflowExecutions";
import { useWorkflowNotificationsStore } from "@stores/workflowNotifications";
import type { NotificationItem } from "@models/notificationItem";
import type { WorkflowItemStatus } from "@models/workflowItem";

const workflowExecutions = useWorkflowExecutionsStore();
const notifications = useWorkflowNotificationsStore();
const aiAssistant = useEnAiStudioAssistantStore();
const appearance = useAppAppearance();

const dismissedBubbleKey = ref<string | null>(null);
const petContainer = ref<HTMLElement | null>(null);

const PET_POSITION_STORAGE_KEY = "vibe-control:workflowNotificationPetPosition";
const PET_SIZE_STORAGE_KEY = "vibe-control:workflowNotificationPetSize";
const PET_VIEWPORT_MARGIN = 16;
const PET_DEFAULT_WIDTH = 112;
const PET_DEFAULT_HEIGHT = 112;
const PET_COMPACT_WIDTH = 80;
const PET_COMPACT_HEIGHT = 80;
const PET_CLICK_DRAG_THRESHOLD = 5;

type PetPosition = {
  x: number;
  y: number;
};

type PetSize = "compact" | "large";

const petPosition = ref<PetPosition | null>(null);
const petSize = ref<PetSize>("large");
const dragStart = ref<{
  pointerId: number;
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
} | null>(null);
const dragMoved = ref(false);
const suppressNextClick = ref(false);

const petContainerStyle = computed(() => {
  const position = petPosition.value;
  if (!position) {
    return {
      right: "1rem",
      bottom: "2.5rem",
    };
  }
  return {
    left: `${position.x}px`,
    top: `${position.y}px`,
  };
});

const petAvatarSizeClass = computed(() =>
  petSize.value === "compact"
    ? "h-16 w-16 sm:h-20 sm:w-20"
    : "h-24 w-24 sm:h-28 sm:w-28"
);

const petShadowSizeClass = computed(() =>
  petSize.value === "compact" ? "w-11 sm:w-14" : "w-16 sm:w-20"
);

const petSizeToggleIcon = computed(() =>
  petSize.value === "compact"
    ? "material-symbols:open-in-full-rounded"
    : "material-symbols:close-fullscreen-rounded"
);

const petSizeToggleLabel = computed(() =>
  petSize.value === "compact" ? "Pet を大きくする" : "Pet を小さくする"
);

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

function clampPetPosition(position: PetPosition): PetPosition {
  if (!import.meta.client) return position;
  const rect = petContainer.value?.getBoundingClientRect();
  const fallbackWidth =
    petSize.value === "compact" ? PET_COMPACT_WIDTH : PET_DEFAULT_WIDTH;
  const fallbackHeight =
    petSize.value === "compact" ? PET_COMPACT_HEIGHT : PET_DEFAULT_HEIGHT;
  const width = rect?.width || fallbackWidth;
  const height = rect?.height || fallbackHeight;
  const maxX = Math.max(
    PET_VIEWPORT_MARGIN,
    window.innerWidth - width - PET_VIEWPORT_MARGIN
  );
  const maxY = Math.max(
    PET_VIEWPORT_MARGIN,
    window.innerHeight - height - PET_VIEWPORT_MARGIN
  );
  return {
    x: Math.min(Math.max(position.x, PET_VIEWPORT_MARGIN), maxX),
    y: Math.min(Math.max(position.y, PET_VIEWPORT_MARGIN), maxY),
  };
}

function defaultPetPosition(): PetPosition {
  if (!import.meta.client) {
    return { x: PET_VIEWPORT_MARGIN, y: PET_VIEWPORT_MARGIN };
  }
  const rect = petContainer.value?.getBoundingClientRect();
  const fallbackWidth =
    petSize.value === "compact" ? PET_COMPACT_WIDTH : PET_DEFAULT_WIDTH;
  const fallbackHeight =
    petSize.value === "compact" ? PET_COMPACT_HEIGHT : PET_DEFAULT_HEIGHT;
  const width = rect?.width || fallbackWidth;
  const height = rect?.height || fallbackHeight;
  return clampPetPosition({
    x: window.innerWidth - width - 24,
    y: window.innerHeight - height - 44,
  });
}

function readStoredPetSize(): PetSize {
  if (!import.meta.client) return "large";
  try {
    const raw = localStorage.getItem(PET_SIZE_STORAGE_KEY);
    return raw === "compact" || raw === "large" ? raw : "large";
  } catch {
    return "large";
  }
}

function savePetSize(): void {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(PET_SIZE_STORAGE_KEY, petSize.value);
  } catch {
    // Ignore private mode / quota exceeded.
  }
}

function readStoredPetPosition(): PetPosition | null {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(PET_POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PetPosition>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
      return null;
    }
    return clampPetPosition({ x: parsed.x, y: parsed.y });
  } catch {
    return null;
  }
}

function savePetPosition(): void {
  if (!import.meta.client || !petPosition.value) return;
  try {
    localStorage.setItem(
      PET_POSITION_STORAGE_KEY,
      JSON.stringify(clampPetPosition(petPosition.value))
    );
  } catch {
    // Ignore private mode / quota exceeded.
  }
}

async function initializePetPosition(): Promise<void> {
  if (!import.meta.client) return;
  petSize.value = readStoredPetSize();
  await nextTick();
  petPosition.value = readStoredPetPosition() ?? defaultPetPosition();
}

async function togglePetSize(): Promise<void> {
  petSize.value = petSize.value === "compact" ? "large" : "compact";
  savePetSize();
  await nextTick();
  clampCurrentPetPosition();
}

function onAvatarPointerDown(event: PointerEvent): void {
  if (!import.meta.client || event.button !== 0) return;
  event.preventDefault();
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(
    event.pointerId
  );
  if (!petPosition.value) {
    petPosition.value = defaultPetPosition();
  }
  dragStart.value = {
    pointerId: event.pointerId,
    pointerX: event.clientX,
    pointerY: event.clientY,
    x: petPosition.value.x,
    y: petPosition.value.y,
  };
  dragMoved.value = false;
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointercancel", onWindowPointerUp);
}

function onWindowPointerMove(event: PointerEvent): void {
  const start = dragStart.value;
  if (!start || event.pointerId !== start.pointerId) return;
  const dx = event.clientX - start.pointerX;
  const dy = event.clientY - start.pointerY;
  if (Math.hypot(dx, dy) > PET_CLICK_DRAG_THRESHOLD) {
    dragMoved.value = true;
  }
  petPosition.value = clampPetPosition({
    x: start.x + dx,
    y: start.y + dy,
  });
}

function onWindowPointerUp(event: PointerEvent): void {
  const start = dragStart.value;
  if (start && event.pointerId !== start.pointerId) return;
  (event.target as HTMLElement | null)?.releasePointerCapture?.(
    event.pointerId
  );
  suppressNextClick.value = dragMoved.value;
  dragStart.value = null;
  dragMoved.value = false;
  savePetPosition();
  window.removeEventListener("pointermove", onWindowPointerMove);
  window.removeEventListener("pointerup", onWindowPointerUp);
  window.removeEventListener("pointercancel", onWindowPointerUp);
}

function onAvatarClick(): void {
  if (suppressNextClick.value) {
    suppressNextClick.value = false;
    return;
  }
  openPanel();
}

function openPanel(): void {
  workflowExecutions.subscribe();
  notifications.openPanel();
}

function clampCurrentPetPosition(): void {
  if (!petPosition.value) return;
  petPosition.value = clampPetPosition(petPosition.value);
  savePetPosition();
}

watch(
  () => notifications.isPanelOpen,
  (open) => {
    if (!open) return;
    workflowExecutions.subscribe();
    void notifications.loadReadStates();
  }
);

watch(showBubble, () => {
  void nextTick(() => clampCurrentPetPosition());
});

onMounted(() => {
  void initializePetPosition();
  void notifications.loadReadStates();
  window.addEventListener("resize", clampCurrentPetPosition);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", clampCurrentPetPosition);
  window.removeEventListener("pointermove", onWindowPointerMove);
  window.removeEventListener("pointerup", onWindowPointerUp);
  window.removeEventListener("pointercancel", onWindowPointerUp);
});
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
