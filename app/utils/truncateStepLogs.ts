import type {
  GoogleDriveSyncLogEntry,
  GoogleDriveSyncStepLogs,
} from "@models/googleDriveSyncRequest";

export const MAX_LOG_ENTRIES_PER_STEP = 30;
export const MAX_LOG_ENTRIES_TOTAL = 300;

function parseLogEntries(
  raw: GoogleDriveSyncStepLogs[string] | undefined
): GoogleDriveSyncLogEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as GoogleDriveSyncLogEntry[];
      }
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * stepLogs の上限を適用 (Workflow / FE 双方で利用可能)。
 */
export function truncateStepLogs(
  stepLogs: GoogleDriveSyncStepLogs | null | undefined
): Record<string, GoogleDriveSyncLogEntry[]> {
  if (!stepLogs) return {};

  const truncated: Record<string, GoogleDriveSyncLogEntry[]> = {};
  let total = 0;

  for (const [stepId, entriesRaw] of Object.entries(stepLogs)) {
    const entries = parseLogEntries(entriesRaw);
    if (entries.length === 0) continue;
    const perStep = entries.slice(-MAX_LOG_ENTRIES_PER_STEP);
    const remaining = MAX_LOG_ENTRIES_TOTAL - total;
    if (remaining <= 0) break;
    truncated[stepId] = perStep.slice(-remaining);
    total += truncated[stepId].length;
  }

  return truncated;
}

/** 全 stepLogs を時系列 1 本に flatten */
export function flattenStepLogs(
  stepLogs: GoogleDriveSyncStepLogs | null | undefined
): GoogleDriveSyncLogEntry[] {
  const normalized = truncateStepLogs(stepLogs);
  const all: GoogleDriveSyncLogEntry[] = [];
  for (const [stepId, entries] of Object.entries(normalized)) {
    for (const entry of entries) {
      all.push({ ...entry, stepId: entry.stepId ?? stepId });
    }
  }
  return all.sort((a, b) => a.at.localeCompare(b.at));
}
