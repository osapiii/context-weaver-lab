/**
 * ワンストップ ADK (session-run) の SSE デコーダ.
 *
 * Research Agent (oneStop) 系:
 *   POST /v1/sessions/{sessionId}/run  → JSON payload per `data:` line
 *   (deltaText, stateDelta, toolCall, toolResult, artifacts)
 */
import { applyStateDelta } from "@utils/adkSessionState";

export interface AdkSessionRunSsePayload {
  type?: string;
  message?: string;
  stateDelta?: Record<string, unknown>;
  deltaText?: string;
  toolCall?: { name: string; args?: Record<string, unknown> };
  toolResult?: { name: string; response?: Record<string, unknown> };
  artifacts?: Array<Record<string, unknown>>;
}

export interface AdkSessionRunSseHandlers {
  onStateDelta?: (nextState: Record<string, unknown>) => void;
  onTextDelta?: (delta: string) => void;
  onToolCall?: (toolCall: NonNullable<AdkSessionRunSsePayload["toolCall"]>) => void;
  onToolResult?: (toolResult: NonNullable<AdkSessionRunSsePayload["toolResult"]>) => void;
  onArtifacts?: (artifacts: Array<Record<string, unknown>>) => void;
  onError?: (message: string) => void;
}

export const consumeAdkSessionRunSse = async (params: {
  body: ReadableStream<Uint8Array>;
  handlers: AdkSessionRunSseHandlers;
  /** stateDelta マージ用の現在 state (onStateDelta に merged を渡す) */
  agentState?: Record<string, unknown>;
}): Promise<void> => {
  const { body, handlers, agentState: initialAgentState } = params;
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let agentState = { ...(initialAgentState ?? {}) };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const evt of events) {
      const dataLines = evt
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart());
      if (dataLines.length === 0) continue;
      const data = dataLines.join("\n");
      if (data === "[DONE]") return;

      let payload: AdkSessionRunSsePayload;
      try {
        payload = JSON.parse(data) as AdkSessionRunSsePayload;
      } catch {
        continue;
      }

      if (payload.type === "error") {
        const msg = String(payload.message ?? "unknown error");
        handlers.onError?.(msg);
        continue;
      }

      if (payload.stateDelta && typeof payload.stateDelta === "object") {
        agentState = applyStateDelta({
          base: agentState,
          stateDelta: payload.stateDelta,
        });
        handlers.onStateDelta?.(agentState);
      }

      if (typeof payload.deltaText === "string" && payload.deltaText) {
        handlers.onTextDelta?.(payload.deltaText);
      }

      if (payload.toolCall) {
        handlers.onToolCall?.(payload.toolCall);
      }

      if (payload.toolResult) {
        handlers.onToolResult?.(payload.toolResult);
      }

      if (Array.isArray(payload.artifacts) && payload.artifacts.length > 0) {
        handlers.onArtifacts?.(payload.artifacts);
      }
    }
  }
};

export const useAdkSessionRunSse = () => ({ consumeAdkSessionRunSse });
