/**
 * ADK session doc / GCP Workflow request doc を `WorkflowItem` へ正規化する.
 * 実行ジョブ一覧 (workflow-executions) の表示・ヘッダー実行中バッジが本変換結果を利用する.
 */

import type {
  AdkSessionWorkflowSourceDoc,
  WorkflowItem,
  WorkflowItemNavigateTarget,
  WorkflowItemStatus,
} from "@models/workflowItem";
import type {
  TaskBucketBase,
  TaskInvokeStatus,
} from "@models/enAiStudioSessionState";
import {
  isEnAiStudioActiveTask,
  type EnAiStudioActiveTask,
} from "@models/enAiStudioSessionState";
import type { RequestLog } from "@stores/requestLogHistory";
import { parseRequestLogDate } from "@utils/requestLogDate";
import {
  ADK_TASK_COLOR,
  ADK_TASK_LABELS,
  getAdkTaskLabel,
  getWorkflowRequestColor,
  getWorkflowRequestLabel,
  type UserWorkflowRequestLogType,
} from "@utils/workflowItemRegistry";

const ADK_TASK_TYPES = Object.keys(ADK_TASK_LABELS) as EnAiStudioActiveTask[];

export const WORKFLOW_ITEM_TIMEOUT_MS = 3 * 60 * 60 * 1000;
export const WORKFLOW_ITEM_TIMEOUT_MESSAGE =
  "3時間以内に完了しませんでした。";

const TASK_INVOKE_STATUS_MAP: Partial<
  Record<TaskInvokeStatus, WorkflowItemStatus>
> = {
  pending: "pending",
  running: "running",
  completed: "completed",
  error: "error",
};

const REQUEST_STATUS_MAP: Record<RequestLog["status"], WorkflowItemStatus> = {
  pending: "pending",
  processing: "running",
  completed: "completed",
  error: "error",
};

function toDate(value: unknown): Date {
  return (
    parseRequestLogDate(value as Parameters<typeof parseRequestLogDate>[0]) ??
    new Date(0)
  );
}

function buildAdkSessionNavigateTarget(
  sessionId: string
): WorkflowItemNavigateTarget {
  return {
    routeName: "admin-ai-studio",
    query: { session: sessionId },
  };
}

export function convertAdkSessionToWorkflowItems(
  session: AdkSessionWorkflowSourceDoc
): WorkflowItem[] {
  const state = session.state;
  if (!state) return [];

  const createdAt = toDate(session.createdAt);
  const updatedAt = toDate(session.updatedAt);
  const items: WorkflowItem[] = [];

  for (const taskType of ADK_TASK_TYPES) {
    const bucket = (state as Record<string, unknown>)[taskType] as
      | TaskBucketBase<unknown, unknown, unknown>
      | undefined;
    const invoke = bucket?.invoke;
    if (!invoke) continue;

    const status = TASK_INVOKE_STATUS_MAP[invoke.status];
    if (!status) continue; // idle

    items.push({
      id: `adkSession:${session.id}:${taskType}`,
      executionId: invoke.request_id,
      sourceKind: "adkSession",
      itemType: taskType,
      label: getAdkTaskLabel(taskType),
      color: ADK_TASK_COLOR,
      status,
      createdAt,
      updatedAt,
      progressLabel: session.title ?? undefined,
      errorMessage: invoke.error_message,
      navigateTarget: buildAdkSessionNavigateTarget(session.id),
      originalDoc: session,
    });
  }

  return items;
}

function resolveWorkflowRequestNavigateTarget(
  type: UserWorkflowRequestLogType,
  log: RequestLog
): WorkflowItemNavigateTarget | undefined {
  switch (type) {
    case "adkInvokeRequest": {
      const sessionId = (
        log.input as { sessionId?: string } | undefined
      )?.sessionId;
      return sessionId ? buildAdkSessionNavigateTarget(sessionId) : undefined;
    }
    case "googleDriveSyncRequest":
    case "webCrawlRequest":
      return { routeName: "admin-data-source" };
    default:
      return undefined;
  }
}

export function convertWorkflowRequestToWorkflowItem(
  type: UserWorkflowRequestLogType,
  log: RequestLog
): WorkflowItem {
  if (type === "adkInvokeRequest") {
    const mode = (log.input as { mode?: unknown } | undefined)?.mode;
    const taskType = isEnAiStudioActiveTask(mode) ? mode : null;
    const prompt = (log.input as { prompt?: unknown } | undefined)?.prompt;
    return {
      id: `adkInvokeRequest:${log.id}`,
      executionId: log.id,
      sourceKind: "adkSession",
      itemType: taskType ?? "adk",
      label: taskType ? getAdkTaskLabel(taskType) : "ADK エージェント実行",
      color: ADK_TASK_COLOR,
      status: REQUEST_STATUS_MAP[log.status],
      createdAt: toDate(log.createdAt),
      updatedAt: toDate(log.updatedAt),
      progressLabel:
        typeof prompt === "string" && prompt.trim()
          ? prompt.trim().slice(0, 120)
          : undefined,
      errorMessage: log.errorMessage,
      navigateTarget: resolveWorkflowRequestNavigateTarget(type, log),
      originalDoc: log.originalDoc ?? log,
    };
  }

  return {
    id: `workflowRequest:${type}:${log.id}`,
    sourceKind: "workflowRequest",
    itemType: type,
    label: getWorkflowRequestLabel(type),
    color: getWorkflowRequestColor(type),
    status: REQUEST_STATUS_MAP[log.status],
    createdAt: toDate(log.createdAt),
    updatedAt: toDate(log.updatedAt),
    errorMessage: log.errorMessage,
    navigateTarget: resolveWorkflowRequestNavigateTarget(type, log),
    originalDoc: log.originalDoc ?? log,
  };
}

function sortByUpdatedAtDesc(items: WorkflowItem[]): WorkflowItem[] {
  return [...items].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
}

function deduplicateWorkflowItems(items: WorkflowItem[]): WorkflowItem[] {
  const withoutExecutionId: WorkflowItem[] = [];
  const byExecutionId = new Map<string, WorkflowItem>();

  for (const item of items) {
    if (!item.executionId) {
      withoutExecutionId.push(item);
      continue;
    }
    // RequestDocは実行ステータスの正本。session.state由来行より後に変換されるため優先する。
    byExecutionId.set(item.executionId, item);
  }

  return [...withoutExecutionId, ...byExecutionId.values()];
}

export function normalizeTimedOutWorkflowItem(
  item: WorkflowItem,
  now: Date
): WorkflowItem {
  if (item.status !== "pending" && item.status !== "running") return item;

  const createdAtMs = item.createdAt.getTime();
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return item;
  if (now.getTime() - createdAtMs < WORKFLOW_ITEM_TIMEOUT_MS) return item;

  return {
    ...item,
    status: "error",
    errorMessage: WORKFLOW_ITEM_TIMEOUT_MESSAGE,
  };
}

export function convertToWorkflowItemsFormat(params: {
  adkSessions: AdkSessionWorkflowSourceDoc[];
  workflowRequests: Array<{
    type: UserWorkflowRequestLogType;
    docs: RequestLog[];
  }>;
  now?: Date;
}): WorkflowItem[] {
  const items: WorkflowItem[] = [];

  for (const session of params.adkSessions) {
    items.push(...convertAdkSessionToWorkflowItems(session));
  }

  for (const group of params.workflowRequests) {
    for (const log of group.docs) {
      items.push(convertWorkflowRequestToWorkflowItem(group.type, log));
    }
  }

  const now = params.now ?? new Date();
  return sortByUpdatedAtDesc(
    deduplicateWorkflowItems(items).map((item) =>
      normalizeTimedOutWorkflowItem(item, now)
    )
  );
}
