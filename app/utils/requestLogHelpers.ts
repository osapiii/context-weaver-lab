/**
 * RequestLog ビューアー用ヘルパー関数
 */

import {
  REQUEST_LOG_REGISTRY,
  REQUEST_LOG_REGISTRY_BY_TYPE,
  type LogType,
} from "@utils/requestLogRegistry";

export type { LogType };

export {
  toJstDateKey,
  parseCalendarDateInput,
  formatCalendarDateInput,
  enumerateCalendarDateKeys,
  parseRequestLogDate,
  formatTimestamp,
} from "@utils/requestLogDate";

export const actualLogTypes: LogType[] = REQUEST_LOG_REGISTRY.map((e) => e.type);

export type RequestLogStatus = "pending" | "processing" | "completed" | "error";

export function getLogTypeLabel(logType: LogType | string): string {
  const entry = REQUEST_LOG_REGISTRY_BY_TYPE[logType as LogType];
  if (entry) return entry.label;
  return logType;
}

export function getLogTypeColor(logType: LogType | string): string {
  const entry = REQUEST_LOG_REGISTRY_BY_TYPE[logType as LogType];
  return entry?.color ?? "#94a3b8";
}

export function getStatusColor(
  status: RequestLogStatus
): "success" | "error" | "primary" | "neutral" {
  const colorMap: Record<
    RequestLogStatus,
    "success" | "error" | "primary" | "neutral"
  > = {
    completed: "success",
    error: "error",
    processing: "primary",
    pending: "neutral",
  };
  return colorMap[status] || "neutral";
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

export const logTypeOptions: Array<{ value: LogType; label: string }> =
  actualLogTypes.map((type) => ({
    value: type,
    label: getLogTypeLabel(type),
  }));

export const defaultLogType = actualLogTypes[0];
