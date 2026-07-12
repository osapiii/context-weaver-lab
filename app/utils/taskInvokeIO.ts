import type { EnAiStudioActiveTask, TaskInvokeState } from "@models/enAiStudioSessionState";
import { emptyTaskInvokeState } from "@models/enAiStudioSessionState";
import {
  readActiveTaskFromState,
  readTaskInvokeFromState,
} from "@utils/enAiStudioSessionStateIO";

export { readActiveTaskInvoke, readTaskInvokeFromState } from "@utils/enAiStudioSessionStateIO";

export const isInvokeTerminal = (invoke: TaskInvokeState): boolean =>
  invoke.status === "completed" || invoke.status === "error";

export const isInvokeRunning = (invoke: TaskInvokeState): boolean =>
  invoke.status === "pending" || invoke.status === "running";

export const waitForTaskInvokeTerminal = (params: {
  getState: () => Record<string, unknown>;
  task?: EnAiStudioActiveTask;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<TaskInvokeState> => {
  const timeoutMs = params.timeoutMs ?? 600_000;
  const pollMs = params.pollMs ?? 400;
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const tick = (): void => {
      const state = params.getState();
      const task =
        params.task ?? readActiveTaskFromState(state) ?? undefined;
      const invoke = task
        ? readTaskInvokeFromState({ state, task })
        : emptyTaskInvokeState();
      if (isInvokeTerminal(invoke)) {
        resolve(invoke);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("invoke の完了を待機中にタイムアウトしました"));
        return;
      }
      window.setTimeout(tick, pollMs);
    };
    tick();
  });
};
