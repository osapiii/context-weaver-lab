/**
 * ADK session.state ゴールデンエンベロープの読み取り / 書き込み.
 */
import type { AiStudioMessage } from "@stores/aiStudio";
import type {
  EnAiStudioActiveTask,
  EnAiStudioSessionState,
  SessionMeta,
  TaskInvokeState,
} from "@models/enAiStudioSessionState";
import {
  emptyTaskInvokeState,
  isEnAiStudioActiveTask,
} from "@models/enAiStudioSessionState";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const readTranscriptFromState = (
  state: Record<string, unknown>
): AiStudioMessage[] => {
  const transcript = state.transcript;
  if (Array.isArray(transcript)) {
    return transcript as AiStudioMessage[];
  }
  return [];
};

export const readSessionMetaFromState = (
  state: Record<string, unknown>
): SessionMeta => {
  const meta = state.session_meta;
  if (isRecord(meta)) {
    return {
      title: typeof meta.title === "string" ? meta.title : "",
      status:
        meta.status === "archived" || meta.status === "deleted"
          ? meta.status
          : "active",
    };
  }
  return { title: "", status: "active" };
};

export const readActiveTaskFromState = (
  state: Record<string, unknown>
): EnAiStudioActiveTask | null => {
  const raw = state.active_task;
  if (isEnAiStudioActiveTask(raw)) {
    return raw;
  }
  return null;
};

export const readGroundingByResponseId = (
  state: Record<string, unknown>
): Record<string, unknown> | undefined => {
  const top = state.grounding_by_response_id;
  if (isRecord(top)) {
    return top as Record<string, unknown>;
  }
  return undefined;
};

export const readTaskInvokeFromState = (params: {
  state: Record<string, unknown>;
  task: EnAiStudioActiveTask;
}): TaskInvokeState => {
  const bucket = params.state[params.task];
  if (!isRecord(bucket)) {
    return emptyTaskInvokeState();
  }
  const invoke = bucket.invoke;
  if (!isRecord(invoke)) {
    return emptyTaskInvokeState();
  }
  const status = invoke.status;
  const logs = Array.isArray(invoke.logs) ? invoke.logs : [];
  return {
    status:
      status === "pending" ||
      status === "running" ||
      status === "completed" ||
      status === "error"
        ? status
        : "idle",
    logs: logs as TaskInvokeState["logs"],
    requestId:
      typeof invoke.request_id === "string" ? invoke.request_id : null,
    linkedResponseId:
      typeof invoke.linked_response_id === "string"
        ? invoke.linked_response_id
        : null,
    errorMessage:
      typeof invoke.error_message === "string" ? invoke.error_message : null,
  };
};

export const buildGoldenEnvelopePatch = (params: {
  messages: AiStudioMessage[];
  title: string;
  status: SessionMeta["status"];
  activeTask?: EnAiStudioActiveTask | null;
  groundingByResponseId?: Record<string, unknown>;
}): Partial<EnAiStudioSessionState> => {
  const patch: Partial<EnAiStudioSessionState> = {
    transcript: params.messages,
    session_meta: {
      title: params.title,
      status: params.status,
    },
  };
  if (params.activeTask) {
    patch.active_task = params.activeTask;
  }
  if (params.groundingByResponseId) {
    patch.grounding_by_response_id = params.groundingByResponseId;
  }
  return patch;
};

export const readActiveTaskInvoke = (
  state: Record<string, unknown>
): TaskInvokeState => {
  const task = readActiveTaskFromState(state);
  if (!task) {
    return emptyTaskInvokeState();
  }
  return readTaskInvokeFromState({ state, task });
};
