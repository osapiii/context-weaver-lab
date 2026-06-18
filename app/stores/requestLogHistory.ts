/**
 * RequestLog History Store
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { Timestamp } from "firebase/firestore";
import log from "@utils/logger";
import { useFirestoreDocOperation } from "@composables/firestore-doc-operation";
import { useContextStore } from "./context";
import { useOrganizationStore } from "./organization";
import { useSpaceStore } from "./space";
import type { LogType } from "@utils/requestLogHelpers";
import {
  REQUEST_LOG_REGISTRY,
  type RequestLogRegistryEntry,
} from "@utils/requestLogRegistry";
import { parseRequestLogDate, toJstDateKey } from "@utils/requestLogHelpers";

export interface FetchLogsFilters {
  spaceId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: "completed" | "error" | "processing" | "pending" | null;
  requestType?: string | null;
  /** 指定時はこれらの種別のみ取得（`requestType` より優先） */
  requestTypes?: LogType[] | null;
}

export interface RequestLog {
  id: string;
  requestType: LogType;
  status: "completed" | "error" | "processing" | "pending";
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  output?: {
    processingTime?: number;
    objectId?: string;
    success?: boolean;
    [key: string]: unknown;
  };
  errorMessage?: string;
  errorCode?: string;
  errorStack?: string;
  operationMetadata?: Record<string, unknown>;
  input?: Record<string, unknown>;
  isAdminCrud?: boolean;
  isCommand?: boolean;
  isOouiCrud?: boolean;
  isLlmCall?: boolean;
  originalDoc?: unknown;
}

function resolveCollectionPath(
  entry: RequestLogRegistryEntry,
  contextStore: ReturnType<typeof useContextStore>
): string {
  if (entry.scope === "organization") {
    return contextStore.organizationFirestorePath(entry.collectionPath);
  }
  return contextStore.baseFirestorePath(entry.collectionPath);
}

function normalizeRequestLogStatus(
  status: unknown
): RequestLog["status"] {
  if (status === "failed" || status === "success") {
    return status === "failed" ? "error" : "completed";
  }
  if (
    status === "completed" ||
    status === "error" ||
    status === "processing" ||
    status === "pending"
  ) {
    return status;
  }
  return "pending";
}

function resolveRequestLogTimestamp(
  doc: Record<string, unknown>,
  field: "createdAt" | "updatedAt"
): Date | Timestamp {
  const primary = doc[field];
  const parsed = parseRequestLogDate(
    primary as Date | Timestamp | string | null | undefined
  );
  if (parsed) return parsed;

  const fallbacks =
    field === "createdAt"
      ? ["startedAt", "updatedAt", "completedAt"]
      : ["completedAt", "startedAt", "createdAt"];

  for (const key of fallbacks) {
    const fallback = parseRequestLogDate(
      doc[key] as Date | Timestamp | string | null | undefined
    );
    if (fallback) return fallback;
  }

  return new Date(0);
}

export function mapDocToRequestLog(
  doc: Record<string, unknown> & { id: string },
  requestType: LogType
): RequestLog {
  const meta = doc.operationMetadata as Record<string, unknown> | undefined;
  return {
    id: doc.id,
    requestType,
    status: normalizeRequestLogStatus(doc.status),
    createdAt: resolveRequestLogTimestamp(doc, "createdAt"),
    updatedAt: resolveRequestLogTimestamp(doc, "updatedAt"),
    output: doc.output as RequestLog["output"],
    errorMessage: doc.errorMessage as string | undefined,
    errorCode: doc.errorCode as string | undefined,
    errorStack: doc.errorStack as string | undefined,
    operationMetadata: meta,
    input: doc.input as Record<string, unknown> | undefined,
    isAdminCrud: meta?.isAdminCrud as boolean | undefined,
    isCommand: meta?.isCommand as boolean | undefined,
    isOouiCrud: meta?.isOouiCrud as boolean | undefined,
    isLlmCall: meta?.isLlmCall as boolean | undefined,
    originalDoc: doc,
  };
}

function sortLogsByCreatedAtDesc(items: RequestLog[]): RequestLog[] {
  return [...items].sort((a, b) => {
    const ta = parseRequestLogDate(a.createdAt)?.getTime() ?? 0;
    const tb = parseRequestLogDate(b.createdAt)?.getTime() ?? 0;
    return tb - ta;
  });
}

export const useRequestLogHistoryStore = defineStore("requestLogHistory", () => {
  const logs = ref<RequestLog[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const currentLogCount = computed(() => logs.value.length);
  const hasError = computed(() => error.value !== null);

  async function fetchLogs(filters: FetchLogsFilters = {}): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const contextStore = useContextStore();
      const organizationStore = useOrganizationStore();
      const spaceStore = useSpaceStore();
      const firestoreOps = useFirestoreDocOperation();

      const orgId = organizationStore.loggedInOrganizationInfo?.id;
      const spaceId = filters.spaceId || spaceStore.selectedSpace?.id;

      if (!orgId) {
        throw new Error("組織が選択されていません");
      }

      const targetTypes =
        filters.requestTypes && filters.requestTypes.length > 0
          ? new Set(filters.requestTypes)
          : null;

      const needsSpace = REQUEST_LOG_REGISTRY.some(
        (e) =>
          e.scope === "space" &&
          (!targetTypes || targetTypes.has(e.type)) &&
          (!filters.requestType || e.type === filters.requestType)
      );
      if (needsSpace && !spaceId) {
        throw new Error("Spaceが選択されていません");
      }

      const whereClauses: Array<{
        field: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        operator: any;
        value: unknown;
      }> = [];

      if (filters.status) {
        whereClauses.push({
          field: "status",
          operator: "==",
          value: filters.status,
        });
      }

      const entries = targetTypes
        ? REQUEST_LOG_REGISTRY.filter((e) => targetTypes.has(e.type))
        : filters.requestType
          ? REQUEST_LOG_REGISTRY.filter((e) => e.type === filters.requestType)
          : REQUEST_LOG_REGISTRY;

      const fetchPromises = entries.map(async (entry) => {
        try {
          const collectionPath = resolveCollectionPath(entry, contextStore);
          const queryParams = {
            collectionName: collectionPath,
            whereClauses: whereClauses.length > 0 ? whereClauses : undefined,
            limit: 500,
          };

          let docs: Array<Record<string, unknown> & { id: string }>;
          if (entry.converter) {
            docs = (await firestoreOps.getDocumentsWithQueryAndConverter({
              ...queryParams,
              converter: entry.converter,
            })) as Array<Record<string, unknown> & { id: string }>;
          } else {
            docs = await firestoreOps.getDocumentsWithQueryWithoutConverter(
              queryParams
            );
          }

          return docs.map((doc) => mapDocToRequestLog(doc, entry.type));
        } catch (err) {
          log("WARN", `requestLog fetch skipped: ${entry.type}`, err);
          return [] as RequestLog[];
        }
      });

      const results = await Promise.all(fetchPromises);
      let merged = sortLogsByCreatedAtDesc(results.flat());

      if (filters.startDate && filters.endDate) {
        merged = merged.filter((row) => {
          const created = parseRequestLogDate(row.createdAt);
          if (!created) return false;
          const key = toJstDateKey(created);
          return key >= filters.startDate! && key <= filters.endDate!;
        });
      }

      logs.value = merged;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "ログデータの取得に失敗しました";
      log("ERROR", "fetchLogs error:", err);
    } finally {
      isLoading.value = false;
    }
  }

  function clearLogs(): void {
    logs.value = [];
    error.value = null;
  }

  async function retry(filters: FetchLogsFilters = {}): Promise<void> {
    error.value = null;
    await fetchLogs(filters);
  }

  function exportLogs(format: "csv" | "json"): void {
    if (logs.value.length === 0) {
      log("WARN", "エクスポートするログがありません");
      return;
    }

    if (format === "json") {
      const json = JSON.stringify(logs.value, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `request-logs-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const headers = [
      "ID",
      "Request Type",
      "Status",
      "Created At",
      "Updated At",
      "Error Message",
    ];
    const rows = logs.value.map((row) => [
      row.id,
      row.requestType,
      row.status,
      formatTimestampForExport(row.createdAt),
      formatTimestampForExport(row.updatedAt),
      row.errorMessage || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `request-logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatTimestampForExport(value: Date | Timestamp): string {
    const d = parseRequestLogDate(value);
    return d ? d.toISOString() : "";
  }

  return {
    logs,
    isLoading,
    error,
    currentLogCount,
    hasError,
    fetchLogs,
    clearLogs,
    retry,
    exportLogs,
  };
});
