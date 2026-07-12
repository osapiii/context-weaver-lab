import type { NotificationItem } from "@models/notificationItem";
import type { WorkflowItem, WorkflowItemStatus } from "@models/workflowItem";

const STATUS_LABELS: Record<WorkflowItemStatus, string> = {
  pending: "待機中",
  running: "実行中",
  completed: "完了",
  error: "エラー",
};

function compactTitle(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

export function buildNotificationTitle(item: WorkflowItem): string {
  if (item.progressLabel?.trim()) {
    return compactTitle(item.progressLabel);
  }
  if (item.status === "completed") {
    return `${item.label}が完了しました`;
  }
  if (item.status === "error") {
    return `${item.label}でエラーが発生しました`;
  }
  return `${item.label}は${STATUS_LABELS[item.status]}です`;
}

export function convertWorkflowItemToNotificationItem(
  item: WorkflowItem
): NotificationItem {
  return {
    id: item.id,
    title: buildNotificationTitle(item),
    jobType: item.itemType,
    jobTypeLabel: item.label,
    status: item.status,
    destination: item.navigateTarget,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    sourceWorkflowItem: item,
  };
}

export function convertWorkflowItemsToNotificationItems(
  items: WorkflowItem[]
): NotificationItem[] {
  return items
    .map(convertWorkflowItemToNotificationItem)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
