/**
 * ADK セッション共通ランタイム (scoped Pinia store).
 *
 * kinmodb 準拠のユースケース区別:
 *   - **dialogue (対話)**: `useAgentSseClient` → POST `/v1/agents/{mode}/invoke` (SSE)
 *   - **oneStop (ワンストップ)**: `useAdkSessionRunSse` → POST `/sessions/{id}/run` (SSE)
 *     + 必要に応じ `pollSessionState` で artifact.state を GET マージ
 *
 * feature store (enAiStudioAssistant / aiStudio / researchAgent) は
 * メッセージ UI 状態を各自保持し、session.state / ポーリングは本 store に委譲する.
 */
import { defineStore } from "pinia";
import log from "@utils/logger";
import {
  applyStateDelta,
  mergeAgentState,
  mergeArtifactsByKey,
  type AdkUseCase,
} from "@utils/adkSessionState";
import {
  useAgentSseClient,
  type AdkAgentMode,
  type AgentSseCallbacks,
  type AgentSseInvokeBody,
} from "@composables/useAgentSseClient";
import {
  consumeAdkSessionRunSse,
  type AdkSessionRunSseHandlers,
} from "@composables/useAdkSessionRunSse";

export type { AdkUseCase };

export interface AdkSessionRuntimeArtifact {
  kind: string;
  name: string;
  gcsPath: string;
  signedUrl: string;
  expiresAtUnix: number;
  bytes: number;
  contentType: string;
  generatedAt: number;
}

const scopedStoreCache = new Map<string, ReturnType<typeof createAdkSessionRuntimeStore>>();

const createAdkSessionRuntimeStore = (scope: string) =>
  defineStore(`adkSessionRuntime-${scope}`, {
    state: () => ({
      sessionId: null as string | null,
      useCase: null as AdkUseCase | null,
      agentState: {} as Record<string, unknown>,
      sessionArtifacts: [] as AdkSessionRuntimeArtifact[],
      isStreaming: false,
      lastError: null as string | null,
    }),
    actions: {
      reset(): void {
        this.sessionId = null;
        this.useCase = null;
        this.agentState = {};
        this.sessionArtifacts = [];
        this.isStreaming = false;
        this.lastError = null;
      },

      bindSession(params: {
        sessionId: string;
        useCase: AdkUseCase;
      }): void {
        this.sessionId = params.sessionId;
        this.useCase = params.useCase;
      },

      mergeAgentState(params: {
        patch: Record<string, unknown> | null | undefined;
      }): void {
        this.agentState = mergeAgentState({
          base: this.agentState,
          patch: params.patch,
        });
      },

      applyStateDelta(params: { stateDelta: unknown }): void {
        this.agentState = applyStateDelta({
          base: this.agentState,
          stateDelta: params.stateDelta,
        });
      },

      mergeSessionArtifacts(params: {
        incoming: AdkSessionRuntimeArtifact[];
        keyOf?: (item: AdkSessionRuntimeArtifact) => string;
      }): void {
        this.sessionArtifacts = mergeArtifactsByKey({
          existing: this.sessionArtifacts,
          incoming: params.incoming,
          keyOf: params.keyOf,
        });
      },

      /**
       * 対話ユースケース: unified ADK invoke (SSE).
       * 呼び出し側は callbacks でメッセージ UI を更新する.
       */
      async invokeDialogue(params: {
        mode: AdkAgentMode;
        body: AgentSseInvokeBody;
        callbacks: AgentSseCallbacks;
        signal?: AbortSignal;
      }): Promise<void> {
        const { mode, body, callbacks, signal } = params;
        this.useCase = "dialogue";
        this.sessionId = body.sessionId;
        this.isStreaming = true;
        this.lastError = null;
        try {
          const sse = useAgentSseClient();
          await sse.invoke({ mode, body, callbacks, signal });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.lastError = message;
          throw error;
        } finally {
          this.isStreaming = false;
        }
      },

      /**
       * ワンストップユースケース: session-run SSE.
       */
      async invokeOneStopRun(params: {
        body: ReadableStream<Uint8Array>;
        handlers: AdkSessionRunSseHandlers;
      }): Promise<void> {
        const { body, handlers } = params;
        this.useCase = "oneStop";
        this.isStreaming = true;
        this.lastError = null;
        try {
          await consumeAdkSessionRunSse({
            body,
            handlers: {
              ...handlers,
              onStateDelta: (next) => {
                this.agentState = next;
                handlers.onStateDelta?.(next);
              },
              onError: (message) => {
                this.lastError = message;
                handlers.onError?.(message);
              },
            },
            agentState: this.agentState,
          });
        } finally {
          this.isStreaming = false;
        }
      },

      /**
       * GET session で state / artifacts を idempotent マージ (ポーリング用).
       * isStreaming 中は二重更新を避けるためスキップ.
       */
      async pollSessionState(params: {
        fetchSession: () => Promise<{
          state?: Record<string, unknown>;
          artifacts?: Array<Partial<AdkSessionRuntimeArtifact>>;
          lastUpdateTime?: number;
        } | null>;
      }): Promise<void> {
        if (!this.sessionId) return;
        if (this.isStreaming) return;
        try {
          const data = await params.fetchSession();
          if (!data) return;
          if (data.state && typeof data.state === "object") {
            this.mergeAgentState({ patch: data.state });
          }
          const incoming = (data.artifacts ?? [])
            .filter((a) => a && typeof a.gcsPath === "string" && a.gcsPath)
            .map((a) => ({
              kind: a.kind ?? "other",
              name: a.name ?? "(unnamed)",
              gcsPath: a.gcsPath!,
              signedUrl: a.signedUrl ?? "",
              expiresAtUnix: a.expiresAtUnix ?? 0,
              bytes: a.bytes ?? 0,
              contentType: a.contentType ?? "",
              generatedAt:
                a.generatedAt ??
                (data.lastUpdateTime ?? Date.now() / 1000) * 1000,
            }));
          if (incoming.length > 0) {
            this.mergeSessionArtifacts({ incoming });
          }
        } catch (error) {
          log("DEBUG", `[adkSessionRuntime:${scope}] pollSessionState failed`, error);
        }
      },
    },
  });

/** scope ごとに独立した ADK ランタイム (feature store から利用) */
export const useAdkSessionRuntimeStore = (params: { scope: string }) => {
  const { scope } = params;
  if (!scopedStoreCache.has(scope)) {
    scopedStoreCache.set(scope, createAdkSessionRuntimeStore(scope));
  }
  return scopedStoreCache.get(scope)!();
};
