import {
  KNOWN_WEB_CRAWL_STEPS,
  type DecodedWebCrawlRequest,
  type WebCrawlLogEntry,
  type WebCrawlProgress,
  type WebCrawlStep,
  type WebCrawlStepLogs,
  type WebCrawlStepsById,
  type WebCrawlUiFlow,
  type WebCrawlWorkflowMeta,
} from "@models/webCrawlRequest";
import { truncateStepLogs } from "@utils/truncateStepLogs";

export type WebCrawlIngestSessionPhase =
  | "idle"
  | "running"
  | "completed"
  | "error";

export type WebCrawlIngestSessionState = {
  requestId: string | null;
  phase: WebCrawlIngestSessionPhase;
  startedAt: number | null;
  endedAt: number | null;
  steps: WebCrawlStep[];
  progress: WebCrawlProgress;
  workflow: WebCrawlWorkflowMeta | null;
  uiFlow: WebCrawlUiFlow | null;
  stepLogs: Record<string, WebCrawlLogEntry[]> | null;
  output: DecodedWebCrawlRequest["output"];
  sourceUrl: string | null;
  errorMessage: string | null;
};

export function createEmptyWebCrawlProgress(): WebCrawlProgress {
  return {
    currentStep: null,
    totalPages: 0,
    processedPages: 0,
    totalImages: 0,
    processedImages: 0,
  };
}

export function createIdleWebCrawlIngestSession(): WebCrawlIngestSessionState {
  return {
    requestId: null,
    phase: "idle",
    startedAt: null,
    endedAt: null,
    steps: [],
    progress: createEmptyWebCrawlProgress(),
    workflow: null,
    uiFlow: null,
    stepLogs: null,
    output: null,
    sourceUrl: null,
    errorMessage: null,
  };
}

export function deriveWebCrawlSessionPhase(
  request: Pick<DecodedWebCrawlRequest, "status" | "workflow">
): WebCrawlIngestSessionPhase {
  const wfState = request.workflow?.state;
  if (wfState === "FAILED" || wfState === "CANCELLED") return "error";
  if (wfState === "SUCCEEDED") return "completed";
  if (wfState === "ACTIVE") return "running";
  if (request.status === "completed") return "completed";
  if (request.status === "error") return "error";
  if (request.status === "processing" || request.status === "pending") {
    return "running";
  }
  return "idle";
}

function normalizeStepDetail(
  detail: WebCrawlStep["detail"]
): Record<string, unknown> | null {
  if (detail == null) return null;
  if (typeof detail === "string") {
    if (detail.trim().length === 0) return null;
    try {
      const parsed = JSON.parse(detail);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: parsed };
    } catch {
      return { raw: detail };
    }
  }
  return detail as Record<string, unknown>;
}

export function normalizeWebCrawlStepMapToArray(
  stepsById: WebCrawlStepsById | undefined | null
): WebCrawlStep[] {
  const map = stepsById ?? {};
  return KNOWN_WEB_CRAWL_STEPS.map((id) => {
    const entry = (map as Record<string, WebCrawlStep | undefined>)[id];
    if (entry) {
      return {
        ...entry,
        id,
        detail: normalizeStepDetail(entry.detail),
      };
    }
    return {
      id,
      status: "pending" as const,
      attempts: 0,
    } satisfies WebCrawlStep;
  });
}

function normalizeStepLogs(
  raw: WebCrawlStepLogs | undefined | null
): Record<string, WebCrawlLogEntry[]> | null {
  if (!raw) return null;
  const out: Record<string, WebCrawlLogEntry[]> = {};
  for (const [stepId, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      out[stepId] = value;
    } else if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value) as WebCrawlLogEntry[];
        if (Array.isArray(parsed)) out[stepId] = parsed;
      } catch {
        out[stepId] = [{ at: "", level: "info", message: value, stepId }];
      }
    }
  }
  const truncated = truncateStepLogs(out);
  return Object.keys(truncated).length > 0 ? truncated : null;
}

/**
 * RequestDoc → UI session (progress modal / footer indicator)
 */
export function projectWebCrawlRequestToSession(
  request: DecodedWebCrawlRequest,
  prior: WebCrawlIngestSessionState | null
): WebCrawlIngestSessionState {
  const phase = deriveWebCrawlSessionPhase(request);
  const steps = normalizeWebCrawlStepMapToArray(request.steps);

  const startedAt =
    prior?.requestId === request.id && prior.startedAt != null
      ? prior.startedAt
      : request.createdAt?.toMillis?.() ?? Date.now();

  const endedAt =
    phase === "completed" || phase === "error"
      ? request.updatedAt?.toMillis?.() ?? Date.now()
      : null;

  return {
    requestId: request.id,
    phase,
    startedAt,
    endedAt,
    steps,
    progress: {
      ...createEmptyWebCrawlProgress(),
      ...request.progress,
      currentStep: request.progress?.currentStep ?? null,
    },
    workflow: request.workflow ?? null,
    uiFlow: request.uiFlow ?? null,
    stepLogs: normalizeStepLogs(request.stepLogs),
    output: request.output ?? null,
    sourceUrl: request.input?.url ?? null,
    errorMessage: request.errorMessage ?? null,
  };
}
