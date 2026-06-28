<template>
  <USlideover
    v-model:open="notifications.isPanelOpen"
    side="right"
    :ui="{ content: 'w-full sm:max-w-[460px]' }"
  >
    <template #content>
      <section class="flex h-full min-h-0 flex-col bg-white">
        <header class="border-b border-slate-200 px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <UIcon
                  name="material-symbols:notifications-outline"
                  class="h-5 w-5 text-amber-500"
                />
                <h2 class="text-base font-bold text-slate-900">お知らせ</h2>
              </div>
              <p class="mt-1 text-xs text-slate-500">
                仕事ログと同期したジョブ通知です
              </p>
            </div>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="閉じる"
              @click="notifications.closePanel()"
            >
              <UIcon name="material-symbols:close" class="h-5 w-5" />
            </button>
          </div>

          <div class="mt-4 flex items-center gap-2">
            <button
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition"
              :class="
                notifications.showUnreadOnly
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              "
              @click="notifications.showUnreadOnly = !notifications.showUnreadOnly"
            >
              <UIcon name="material-symbols:filter-list" class="h-4 w-4" />
              未読のみ
            </button>
            <button
              type="button"
              class="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="notifications.unreadCount === 0"
              @click="notifications.markAllAsRead()"
            >
              <UIcon name="material-symbols:done-all" class="h-4 w-4" />
              すべて既読
            </button>
          </div>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div
            v-if="notifications.visibleItems.length === 0"
            class="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-slate-500"
          >
            <UIcon name="material-symbols:notifications-paused-outline" class="mb-3 h-12 w-12 text-slate-300" />
            <p class="text-sm font-semibold text-slate-700">
              {{ notifications.showUnreadOnly ? "未読のお知らせはありません" : "お知らせはありません" }}
            </p>
          </div>

          <button
            v-for="item in notifications.visibleItems"
            :key="item.id"
            type="button"
            class="mb-2 block w-full rounded-lg border p-3 text-left transition hover:border-amber-200 hover:bg-amber-50/40"
            :class="
              notifications.isRead(item.id)
                ? 'border-slate-200 bg-white'
                : 'border-amber-200 bg-amber-50/70'
            "
            @click="openNotification(item)"
          >
            <div class="flex items-start gap-3">
              <span
                class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                :class="notifications.isRead(item.id) ? 'bg-slate-300' : 'bg-amber-500'"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span
                    class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold"
                    :class="statusBadgeClass(item.status)"
                  >
                    {{ statusLabel(item.status) }}
                  </span>
                  <span class="text-[11px] font-semibold text-slate-500">
                    {{ item.jobTypeLabel }}
                  </span>
                </div>
                <p class="mt-1 line-clamp-2 text-sm font-bold leading-5 text-slate-900">
                  {{ item.title }}
                </p>
                <p v-if="item.sourceWorkflowItem.errorMessage" class="mt-1 line-clamp-2 text-xs text-rose-600">
                  {{ item.sourceWorkflowItem.errorMessage }}
                </p>
                <div class="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>{{ formatDate(item.updatedAt) }}</span>
                  <span class="inline-flex items-center gap-1 font-semibold text-amber-700">
                    {{ actionLabel(item) }}
                    <UIcon name="material-symbols:chevron-right" class="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </section>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useWorkflowNotificationsStore } from "@stores/workflowNotifications";
import type { NotificationItem } from "@models/notificationItem";
import type { WorkflowItemStatus } from "@models/workflowItem";

const router = useRouter();
const notifications = useWorkflowNotificationsStore();

function statusLabel(status: WorkflowItemStatus): string {
  return {
    pending: "待機中",
    running: "実行中",
    completed: "完了",
    error: "エラー",
  }[status];
}

function statusBadgeClass(status: WorkflowItemStatus): string {
  return {
    pending: "bg-slate-100 text-slate-700",
    running: "bg-orange-100 text-orange-700",
    completed: "bg-emerald-100 text-emerald-700",
    error: "bg-rose-100 text-rose-700",
  }[status];
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function actionLabel(item: NotificationItem): string {
  const resumeTask = item.destination?.query?.resumeTask;
  return resumeTask ? "続きへ戻る" : item.destination ? "開く" : "仕事ログへ";
}

async function openNotification(item: NotificationItem): Promise<void> {
  await notifications.markAsRead(item.id);
  notifications.closePanel();
  if (item.destination) {
    await router.push({
      name: item.destination.routeName,
      query: item.destination.query,
      params: item.destination.params,
    });
    return;
  }
  await router.push({
    name: "admin-workflow-executions",
    query: { jobId: item.sourceWorkflowItem.id },
  });
}
</script>
