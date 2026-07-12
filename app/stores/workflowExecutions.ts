/**
 * ワークフロー実行ダッシュボード用ストア.
 * ADK session (adkSessions) + ユーザー操作起点の workflow request doc を
 * リアルタイム購読し、`WorkflowItem[]` / 実行中件数をスペース全体スコープで提供する.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { useFirestore } from "vuefire";
import log from "@utils/logger";
import { useContextStore } from "./context";
import { useOrganizationStore } from "./organization";
import { useSpaceStore } from "./space";
import { mapDocToRequestLog, type RequestLog } from "./requestLogHistory";
import { REQUEST_LOG_REGISTRY_BY_TYPE } from "@utils/requestLogRegistry";
import {
  USER_WORKFLOW_REQUEST_LOG_TYPES,
  type UserWorkflowRequestLogType,
} from "@utils/workflowItemRegistry";
import { convertToWorkflowItemsFormat } from "@utils/workflowItemConverter";
import type { AdkSessionWorkflowSourceDoc, WorkflowItem } from "@models/workflowItem";

const ADK_SESSION_LIMIT = 50;
const WORKFLOW_REQUEST_LIMIT = 50;
const TIMEOUT_REEVALUATION_INTERVAL_MS = 60_000;

function emptyWorkflowRequestDocs(): Record<UserWorkflowRequestLogType, RequestLog[]> {
  return Object.fromEntries(
    USER_WORKFLOW_REQUEST_LOG_TYPES.map((type) => [type, [] as RequestLog[]])
  ) as Record<UserWorkflowRequestLogType, RequestLog[]>;
}

export const useWorkflowExecutionsStore = defineStore("workflowExecutions", () => {
  const adkSessions = ref<AdkSessionWorkflowSourceDoc[]>([]);
  const workflowRequestDocs = ref<Record<UserWorkflowRequestLogType, RequestLog[]>>(
    emptyWorkflowRequestDocs()
  );
  const timeoutEvaluationNowMs = ref(Date.now());

  let unsubscribers: Unsubscribe[] = [];
  let subscribedScopeKey: string | null = null;
  let timeoutClockId: ReturnType<typeof setInterval> | null = null;

  const items = computed<WorkflowItem[]>(() =>
    convertToWorkflowItemsFormat({
      adkSessions: adkSessions.value,
      workflowRequests: USER_WORKFLOW_REQUEST_LOG_TYPES.map((type) => ({
        type,
        docs: workflowRequestDocs.value[type],
      })),
      now: new Date(timeoutEvaluationNowMs.value),
    })
  );

  const runningItems = computed<WorkflowItem[]>(() =>
    items.value.filter(
      (item) => item.status === "pending" || item.status === "running"
    )
  );

  const runningCount = computed(() => runningItems.value.length);

  function subscribeAdkSessions(params: {
    organizationId: string;
    spaceId: string;
  }): void {
    const db = useFirestore();
    const col = collection(
      db,
      "organizations",
      params.organizationId,
      "spaces",
      params.spaceId,
      "adkSessions"
    );
    const q = query(
      col,
      where("status", "in", ["active", "completed"]),
      orderBy("updatedAt", "desc"),
      limit(ADK_SESSION_LIMIT)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        adkSessions.value = snap.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            title: (data.title as string | null | undefined) ?? null,
            createdAt: data.createdAt as AdkSessionWorkflowSourceDoc["createdAt"],
            updatedAt: data.updatedAt as AdkSessionWorkflowSourceDoc["updatedAt"],
            state: data.state as AdkSessionWorkflowSourceDoc["state"],
          };
        });
      },
      (error) => {
        log("ERROR", "[workflowExecutions] adkSessions onSnapshot failed", error);
      }
    );

    unsubscribers.push(unsub);
  }

  function subscribeWorkflowRequest(params: {
    type: UserWorkflowRequestLogType;
  }): void {
    const contextStore = useContextStore();
    const entry = REQUEST_LOG_REGISTRY_BY_TYPE[params.type];
    const collectionPath =
      entry.scope === "organization"
        ? contextStore.organizationFirestorePath(entry.collectionPath)
        : contextStore.baseFirestorePath(entry.collectionPath);

    const db = useFirestore();
    // 仕事ログは異なる世代のRequestDocを横断表示するため、厳格なconverterを
    // 通さずrawデータを寛容に正規化する。古い1件のZodエラーで購読全体を止めない。
    const col = collection(db, collectionPath);
    const q = query(col, orderBy("updatedAt", "desc"), limit(WORKFLOW_REQUEST_LIMIT));

    const unsub = onSnapshot(
      q,
      (snap) => {
        workflowRequestDocs.value[params.type] = snap.docs.map((docSnap) =>
          mapDocToRequestLog(
            {
              ...(docSnap.data() as Record<string, unknown>),
              id: docSnap.id,
            },
            params.type
          )
        );
      },
      (error) => {
        log(
          "ERROR",
          `[workflowExecutions] ${params.type} onSnapshot failed`,
          error
        );
      }
    );

    unsubscribers.push(unsub);
  }

  function unsubscribeAll(): void {
    unsubscribers.forEach((unsub) => unsub());
    unsubscribers = [];
    if (timeoutClockId) {
      clearInterval(timeoutClockId);
      timeoutClockId = null;
    }
    subscribedScopeKey = null;
    adkSessions.value = [];
    workflowRequestDocs.value = emptyWorkflowRequestDocs();
  }

  function startTimeoutClock(): void {
    timeoutEvaluationNowMs.value = Date.now();
    if (timeoutClockId) return;
    timeoutClockId = setInterval(() => {
      timeoutEvaluationNowMs.value = Date.now();
    }, TIMEOUT_REEVALUATION_INTERVAL_MS);
  }

  /** スペース全体スコープで実行中ジョブのリアルタイム購読を開始する (冪等) */
  function subscribe(): void {
    const organizationStore = useOrganizationStore();
    const spaceStore = useSpaceStore();
    const organizationId = organizationStore.loggedInOrganizationInfo?.id;
    const spaceId = spaceStore.selectedSpace?.id;

    if (!organizationId || !spaceId) {
      unsubscribeAll();
      return;
    }

    const scopeKey = `${organizationId}:${spaceId}`;
    if (subscribedScopeKey === scopeKey) return;

    unsubscribeAll();
    subscribedScopeKey = scopeKey;

    subscribeAdkSessions({ organizationId, spaceId });
    for (const type of USER_WORKFLOW_REQUEST_LOG_TYPES) {
      subscribeWorkflowRequest({ type });
    }
    startTimeoutClock();
  }

  return {
    items,
    runningItems,
    runningCount,
    subscribe,
    unsubscribeAll,
  };
});
