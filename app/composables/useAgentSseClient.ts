/**
 * 共通 ADK Agent SSE クライアント.
 *
 * adk-agents/common/server_base.py が吐き出す SSE プロトコル:
 *   event: text_delta   data: { "text": "..." }
 *   event: tool_call    data: { "name": "...", "status": "running" }
 *   event: tool_result  data: { "name": "...", "status": "completed"|"failed" }
 *   event: artifact     data: { "kind": "image"|"sheet_op"|"text_block"|"markdown_document"|"html_document"|"citation", ... }
 *   event: grounding     data: { groundingChunks: [...] }
 *   event: done         data: { "session_id": "..." }
 *
 * 既存 `stores/enAiStudioAssistant.ts:sendViaAdk` の SSE パース部を共通化したもの.
 * aiStudio / 既存 enAiStudioAssistant 双方から呼び出せる.
 */
import { resolveAdkSessionScope } from "@composables/useAdkSessionScope";
import { getFirebaseIdToken } from "@utils/firebaseIdToken";
import log from "@utils/logger";
import type { LlmModelSelection } from "@models/llmModelSelection";
import {
  normalizeActivityStatus,
  type AgentSseActivity,
} from "@utils/adkToolActivities";

export type { AgentSseActivity };
export type AdkAgentMode =
  | "guide"
  | "writing"
  | "sheet"
  | "image"
  | "consultation"
  | "research"
  | "data_analysis"
  | "web_page"
  | "application_scan"
  | "business_partner"
  | "vibe_zapping_analysis"
  | "vibe_capability_structuring"
  | "vibe_story_generation";

export interface AgentSseArtifact {
  kind:
    | "image"
    | "sheet_op"
    | "text_block"
    | "markdown_document"
    | "html_document"
    | "json_document"
    | "csv_document"
    | "en_aistudio_data_analysis_result"
    | "citation";
  // image
  url?: string;
  /** 永続化時に期限付き signed URL を url から退避（セッション表示用） */
  transientDisplayUrl?: string;
  prompt?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  artifactId?: string;
  adkFilename?: string;
  artifactVersion?: number;
  sessionId?: string;
  // sheet_op
  summary?: string;
  range?: string;
  status?: "proposed" | "applied" | "failed";
  spreadsheetUrl?: string;
  sheetName?: string;
  // text_block / json_document / citation
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
  // citation
  snippet?: string;
  // citation の uri (image.url と被るので別名)
  citationUri?: string;
}

export interface AgentSseHistoryTurn {
  role: "user" | "model";
  text: string;
}

export interface AgentSseInvokeBody {
  sessionId: string;
  userId?: string | null;
  organizationId: string;
  spaceId: string;
  fileSpaceId?: string | null;
  workspaceId?: string | null;
  prompt: string;
  history: AgentSseHistoryTurn[];
  modeState?: Record<string, unknown>;
  systemPrompt?: string | null;
  responseId?: string | null;
  attachments?: unknown[];
  selectedKnowledge?: Array<{
    id: string;
    name: string;
    gcs_path: string;
    mime_type: string;
  }>;
  /** RequestDoc Command `input.model` — ADK が実行時に API 名へ解決 */
  model?: LlmModelSelection | null;
  referenceImages?: Array<{
    id: string;
    source: "knowledge" | "clipboard" | "upload";
    name: string;
    mime_type: string;
    gcs_path?: string | null;
    url?: string | null;
    knowledge_doc_id?: string | null;
  }>;
}

export interface AgentSseCallbacks {
  onTextDelta?: (delta: string) => void;
  onArtifact?: (artifact: AgentSseArtifact) => void;
  onActivity?: (activity: Pick<AgentSseActivity, "name" | "status">) => void;
  onGrounding?: (payload: Record<string, unknown>) => void;
  onModeChange?: (mode: AdkAgentMode, reason?: string) => void;
  onDone?: (
    sessionId: string,
    mode?: AdkAgentMode,
    payload?: {
      responseId?: string;
      groundingMetadata?: Record<string, unknown>;
      imageReference?: Record<string, unknown>;
    }
  ) => void;
}

const normalizeArtifact = (params: {
  payload: Record<string, unknown>;
}): AgentSseArtifact | null => {
  const { payload } = params;
  const kind = payload.kind as AgentSseArtifact["kind"] | undefined;
  if (!kind) return null;
  if (kind === "image") {
    const url = typeof payload.url === "string" ? payload.url : undefined;
    const adkFilename =
      typeof payload.adk_filename === "string"
        ? payload.adk_filename
        : typeof payload.adkFilename === "string"
          ? payload.adkFilename
          : typeof payload.filename === "string"
            ? payload.filename
            : undefined;
    const sessionId =
      typeof payload.session_id === "string"
        ? payload.session_id
        : typeof payload.sessionId === "string"
          ? payload.sessionId
          : undefined;
    const version =
      typeof payload.version === "number"
        ? payload.version
        : typeof payload.artifact_version === "number"
          ? payload.artifact_version
          : undefined;
    const artifactIdField =
      typeof payload.artifactId === "string"
        ? payload.artifactId
        : undefined;
    if (!url && !artifactIdField && !(sessionId && adkFilename)) return null;
    return {
      kind: "image",
      url,
      artifactId: artifactIdField,
      prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
      mimeType:
        typeof payload.mime_type === "string" ? payload.mime_type : undefined,
      width: typeof payload.width === "number" ? payload.width : undefined,
      height: typeof payload.height === "number" ? payload.height : undefined,
      adkFilename,
      artifactVersion: version,
      sessionId,
    };
  }
  if (kind === "sheet_op" && typeof payload.summary === "string") {
    const spreadsheetUrl =
      typeof payload.spreadsheet_url === "string"
        ? payload.spreadsheet_url
        : typeof payload.spreadsheetUrl === "string"
          ? payload.spreadsheetUrl
          : undefined;
    const sheetName =
      typeof payload.sheet_name === "string"
        ? payload.sheet_name
        : typeof payload.sheetName === "string"
          ? payload.sheetName
          : undefined;
    return {
      kind: "sheet_op",
      summary: payload.summary,
      range: typeof payload.range === "string" ? payload.range : undefined,
      spreadsheetUrl,
      sheetName,
      status:
        payload.status === "applied" ||
        payload.status === "failed" ||
        payload.status === "proposed"
          ? payload.status
          : "applied",
    };
  }
  if (kind === "text_block" && typeof payload.body === "string") {
    return {
      kind: "text_block",
      body: payload.body,
      title: typeof payload.title === "string" ? payload.title : undefined,
    };
  }
  if (kind === "markdown_document" && typeof payload.body === "string") {
    return {
      kind: "markdown_document",
      body: payload.body,
      title: typeof payload.title === "string" ? payload.title : undefined,
    };
  }
  if (kind === "html_document" && typeof payload.body === "string") {
    return {
      kind: "html_document",
      body: payload.body,
      title: typeof payload.title === "string" ? payload.title : undefined,
    };
  }
  if (kind === "json_document" && typeof payload.body === "string") {
    return {
      kind: "json_document",
      body: payload.body,
      title: typeof payload.title === "string" ? payload.title : undefined,
    };
  }
  if (kind === "en_aistudio_data_analysis_result") {
    return {
      kind: "en_aistudio_data_analysis_result",
      body: typeof payload.body === "string" ? payload.body : undefined,
      title:
        typeof payload.title === "string"
          ? payload.title
          : "データ分析結果",
      artifactId:
        typeof payload.artifactId === "string" ? payload.artifactId : undefined,
      adkFilename:
        typeof payload.filename === "string"
          ? payload.filename
          : typeof payload.adkFilename === "string"
            ? payload.adkFilename
            : undefined,
      artifactVersion:
        typeof payload.version === "number"
          ? payload.version
          : typeof payload.artifact_version === "number"
            ? payload.artifact_version
            : undefined,
      mimeType:
        typeof payload.mime_type === "string" ? payload.mime_type : undefined,
    };
  }
  if (kind === "citation" && typeof payload.title === "string") {
    return {
      kind: "citation",
      title: payload.title,
      snippet:
        typeof payload.snippet === "string" ? payload.snippet : undefined,
      citationUri:
        typeof payload.uri === "string" ? payload.uri : undefined,
    };
  }
  return null;
};

export interface AgentSseArtifactRef {
  filename: string;
  version: number;
  kind: string;
  title?: string;
  mimeType?: string;
  url?: string;
  prompt?: string;
  customMetadata?: Record<string, unknown>;
}

const normalizeArtifactRef = (params: {
  payload: Record<string, unknown>;
}): AgentSseArtifactRef | null => {
  const { payload } = params;
  const filename =
    typeof payload.filename === "string" ? payload.filename.trim() : "";
  if (!filename) return null;
  const version =
    typeof payload.version === "number" ? payload.version : 0;
  const kind =
    typeof payload.kind === "string" ? payload.kind.trim() : "other";
  const url =
    typeof payload.url === "string"
      ? payload.url
      : typeof payload.signedUrl === "string"
        ? payload.signedUrl
        : undefined;
  return {
    filename,
    version,
    kind,
    title: typeof payload.title === "string" ? payload.title : undefined,
    mimeType:
      typeof payload.mime_type === "string" ? payload.mime_type : undefined,
    url,
    prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
    customMetadata:
      payload.custom_metadata &&
      typeof payload.custom_metadata === "object"
        ? (payload.custom_metadata as Record<string, unknown>)
        : undefined,
  };
};

export { normalizeArtifact, normalizeArtifactRef };

const parseWorkspaceMode = (value: unknown): AdkAgentMode | undefined => {
  if (value === "guide") return "guide";
  if (
    value === "writing" ||
    value === "sheet" ||
    value === "image" ||
    value === "consultation" ||
    value === "research" ||
    value === "data_analysis" ||
    value === "web_page" ||
    value === "application_scan" ||
    value === "vibe_zapping_analysis" ||
    value === "vibe_capability_structuring" ||
    value === "vibe_story_generation"
  ) {
    return value;
  }
  return undefined;
};

const resolveEndpoint = (mode: AdkAgentMode): string => {
  const { $config } = useNuxtApp();
  const pub = $config.public as Record<string, unknown>;
  const pick = (value: unknown): string =>
    typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";

  const base = pick(pub.enAiStudioAdkBaseUrl);
  if (base) return base;

  switch (mode) {
    case "guide":
      return pick(pub.enAiStudioAdkGuideUrl);
    case "writing":
      return pick(pub.enAiStudioAdkWritingUrl);
    case "sheet":
      return pick(pub.enAiStudioAdkSheetUrl);
    case "image":
      return pick(pub.enAiStudioAdkImageUrl);
    case "consultation":
      return pick(pub.enAiStudioAdkConsultationUrl);
    case "vibe_zapping_analysis":
      return pick(pub.enAiStudioAdkVibeZappingAnalysisUrl) || base;
    case "vibe_capability_structuring":
      return pick(pub.enAiStudioAdkVibeCapabilityStructuringUrl) || base;
    case "vibe_story_generation":
      return pick(pub.enAiStudioAdkVibeStoryGenerationUrl) || base;
    default:
      return "";
  }
};

export const useAgentSseClient = () => {
  /**
   * ADK Agent に POST + SSE で送信. abort 可能.
   */
  const invoke = async (params: {
    mode: AdkAgentMode;
    body: AgentSseInvokeBody;
    callbacks: AgentSseCallbacks;
    signal?: AbortSignal;
  }): Promise<void> => {
    const { mode, body, callbacks, signal } = params;
    const endpoint = resolveEndpoint(mode);
    if (!endpoint) {
      throw new Error(
        `${mode} モードの ADK エンドポイント URL が未設定です ` +
          `(NUXT_PUBLIC_EN AI Studio_ADK_${mode.toUpperCase()}_URL または ` +
          `NUXT_PUBLIC_EN AI Studio_ADK_BASE_URL)`
      );
    }

    const idToken = await getFirebaseIdToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

    const resolvedScope =
      body.organizationId?.trim() && body.spaceId?.trim()
        ? {
            organizationId: body.organizationId.trim(),
            spaceId: body.spaceId.trim(),
          }
        : resolveAdkSessionScope();

    const payload = {
      session_id: body.sessionId,
      user_id: body.userId ?? null,
      organization_id: resolvedScope.organizationId,
      space_id: resolvedScope.spaceId,
      file_space_id: body.fileSpaceId ?? null,
      workspace_id: body.workspaceId ?? null,
      prompt: body.prompt,
      model: body.model ?? null,
      history: body.history,
      mode_state: body.modeState ?? {},
      system_prompt: body.systemPrompt?.trim() || null,
      response_id: body.responseId?.trim() || null,
      attachments: body.attachments ?? [],
      selected_knowledge: body.selectedKnowledge ?? [],
      reference_images: body.referenceImages ?? [],
    };

    log("INFO", "[useAgentSseClient] ADK invoke", {
      mode,
      endpoint,
      sessionId: body.sessionId,
    });

    const response = await fetch(`${endpoint}/v1/agents/${mode}/invoke`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `ADK ${mode} HTTP ${response.status}: ${errText.slice(0, 200)}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedDone = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let frameBoundary = buffer.indexOf("\n\n");
      while (frameBoundary !== -1) {
        const rawFrame = buffer.slice(0, frameBoundary);
        buffer = buffer.slice(frameBoundary + 2);
        frameBoundary = buffer.indexOf("\n\n");

        const lines = rawFrame.split("\n");
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }
        if (dataLines.length === 0) continue;
        const dataStr = dataLines.join("\n");

        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(dataStr) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (eventName === "text_delta") {
          const piece = typeof parsed.text === "string" ? parsed.text : "";
          if (piece) callbacks.onTextDelta?.(piece);
        } else if (eventName === "tool_call" || eventName === "tool_result") {
          const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
          const status = normalizeActivityStatus(parsed.status);
          if (name && status) {
            callbacks.onActivity?.({ name, status });
          }
        } else if (eventName === "artifact") {
          const artifact = normalizeArtifact({ payload: parsed });
          if (artifact) callbacks.onArtifact?.(artifact);
        } else if (eventName === "artifact_ref") {
          const ref = normalizeArtifactRef({ payload: parsed });
          if (ref && (ref.kind === "image" || ref.filename)) {
            callbacks.onArtifact?.({
              kind: "image",
              sessionId: body.sessionId,
              adkFilename: ref.filename,
              artifactVersion: ref.version,
              url: ref.url,
              prompt: ref.prompt,
              mimeType: ref.mimeType,
            });
          }
        } else if (eventName === "mode_change") {
          const mode = parseWorkspaceMode(parsed.mode);
          if (mode) {
            const reason =
              typeof parsed.reason === "string" ? parsed.reason : undefined;
            callbacks.onModeChange?.(mode, reason);
          }
        } else if (eventName === "grounding") {
          callbacks.onGrounding?.(parsed);
        } else if (eventName === "error") {
          const msg =
            typeof parsed.message === "string"
              ? parsed.message
              : "ADK エージェントでエラーが発生しました";
          throw new Error(msg);
        } else if (eventName === "done") {
          receivedDone = true;
          const sid =
            typeof parsed.session_id === "string"
              ? parsed.session_id
              : body.sessionId;
          const responseId =
            typeof parsed.response_id === "string"
              ? parsed.response_id
              : undefined;
          const groundingMetadata =
            parsed.grounding_metadata &&
            typeof parsed.grounding_metadata === "object"
              ? (parsed.grounding_metadata as Record<string, unknown>)
              : undefined;
          const imageReference =
            parsed.image_reference &&
            typeof parsed.image_reference === "object"
              ? (parsed.image_reference as Record<string, unknown>)
              : undefined;
          callbacks.onDone?.(sid, parseWorkspaceMode(parsed.mode), {
            responseId,
            groundingMetadata,
            imageReference,
          });
        }
      }
    }

    if (!receivedDone) {
      log("WARN", "[useAgentSseClient] SSE stream closed without done event", {
        mode,
        sessionId: body.sessionId,
      });
      callbacks.onDone?.(body.sessionId, undefined, {});
    }
  };

  return { invoke };
};
