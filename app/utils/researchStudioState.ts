import type {
  ResearchAgentBriefingDraft,
  ResearchWorkflowPhase,
} from "@stores/researchAgent";
import type { ResearchPlanDraft } from "@utils/researchPlanDraft";
import {
  buildGoldenResearchTaskBucket,
  mergeGoldenTaskBucket,
  researchGoldenToEffectiveFlat,
} from "@utils/goldenTaskBucket";

/** backend/adk-agents/common/research_workflow.py `_RESEARCH_PHASES` と一致 */
export const VALID_RESEARCH_ADK_PHASES = new Set([
  "plan_review",
  "phase1_hearing",
  "phase1_8_research",
  "phase2_svg",
  "phase3_html",
]);

export const sanitizeResearchAdkPhase = (
  phase: string | null | undefined,
): string | null => {
  const trimmed = phase?.trim();
  if (!trimmed) return null;
  return VALID_RESEARCH_ADK_PHASES.has(trimmed) ? trimmed : null;
};

export type ResearchStudioFields = {
  currentPhase: string | null;
  theme: string | null;
  autoMode: boolean;
  pipelineAutonomous: boolean;
  planOnly?: boolean;
  briefing: ResearchAgentBriefingDraft | null;
  workflowPhase?: ResearchWorkflowPhase | null;
  planDraft?: ResearchPlanDraft | null;
  notificationEmail?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
  fileSpaceId?: string | null;
  contextStatus?: "ready" | "limited" | null;
  contextWarning?: string | null;
};

export const buildResearchModeState = (params: {
  fields: ResearchStudioFields;
}): Record<string, unknown> => {
  const { fields } = params;
  const briefing = fields.briefing;
  const theme =
    fields.theme?.trim() ||
    briefing?.theme?.trim() ||
    null;

  const payload: Record<string, unknown> = {};
  if (fields.workflowPhase) payload.workflow_phase = fields.workflowPhase;
  if (fields.planDraft) payload.plan_draft = fields.planDraft;
  if (fields.notificationEmail?.trim()) {
    payload.notification_email = fields.notificationEmail.trim();
  }

  const golden = buildGoldenResearchTaskBucket({
    phase: sanitizeResearchAdkPhase(fields.currentPhase),
    setup: {
      theme,
      autoMode: fields.autoMode,
      pipelineAutonomous: fields.pipelineAutonomous,
      planOnly: fields.planOnly === true,
      briefingTheme: briefing?.theme?.trim() || null,
      briefingAudience: briefing?.audience?.trim() || null,
      briefingUseCase: briefing?.useCase?.trim() || null,
      organizationId: fields.organizationId ?? null,
      organizationName: fields.organizationName ?? null,
      spaceId: fields.spaceId ?? null,
      spaceName: fields.spaceName ?? null,
      workspaceId: fields.workspaceId ?? null,
      workspaceName: fields.workspaceName ?? null,
      fileSpaceId: fields.fileSpaceId ?? null,
      contextStatus: fields.contextStatus ?? null,
      contextWarning: fields.contextWarning ?? null,
    },
    payload: Object.keys(payload).length > 0 ? payload : undefined,
  });

  return {
    active_mode: "research",
    research: mergeGoldenTaskBucket({ patch: golden }),
  };
};

export const researchStudioFieldsFromAgentState = (params: {
  agentState: Record<string, unknown>;
  briefing: ResearchAgentBriefingDraft | null;
  autoMode: boolean;
  pipelineAutonomous: boolean;
}): ResearchStudioFields => {
  const flat = researchGoldenToEffectiveFlat(params.agentState);
  const phase = flat.current_phase;
  const theme = flat.theme;
  return {
    currentPhase: sanitizeResearchAdkPhase(
      typeof phase === "string" ? phase : null,
    ),
    theme: typeof theme === "string" && theme.trim() ? theme.trim() : null,
    autoMode: params.autoMode,
    pipelineAutonomous:
      params.pipelineAutonomous || flat.pipeline_autonomous === true,
    briefing: params.briefing,
    organizationId:
      typeof flat.organization_id === "string" && flat.organization_id.trim()
        ? flat.organization_id.trim()
        : null,
    organizationName:
      typeof flat.organization_name === "string" && flat.organization_name.trim()
        ? flat.organization_name.trim()
        : null,
    spaceId:
      typeof flat.space_id === "string" && flat.space_id.trim()
        ? flat.space_id.trim()
        : null,
    spaceName:
      typeof flat.space_name === "string" && flat.space_name.trim()
        ? flat.space_name.trim()
        : null,
    workspaceId:
      typeof flat.workspace_id === "string" &&
      flat.workspace_id.trim()
        ? flat.workspace_id.trim()
        : null,
    workspaceName:
      typeof flat.workspace_name === "string" &&
      flat.workspace_name.trim()
        ? flat.workspace_name.trim()
        : null,
    fileSpaceId:
      typeof flat.file_space_id === "string" && flat.file_space_id.trim()
        ? flat.file_space_id.trim()
        : null,
    contextStatus:
      flat.context_status === "ready" || flat.context_status === "limited"
        ? flat.context_status
        : null,
    contextWarning:
      typeof flat.context_warning === "string" && flat.context_warning.trim()
        ? flat.context_warning.trim()
        : null,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const RESEARCH_LOGGING_ROOT_KEYS = [
  "job_log",
  "progress_history",
  "progress",
  "current_phase",
  "phase_status",
  "research_path",
  "research_html_path",
] as const;

/** Firestore golden / legacy state → researchAgent.agentState ミラー (flat ビュー) */
export const researchAgentStateFromSessionState = (
  state: Record<string, unknown>
): Record<string, unknown> => {
  const bucket = isRecord(state.research) ? state.research : {};
  const flat = researchGoldenToEffectiveFlat(bucket);
  for (const key of RESEARCH_LOGGING_ROOT_KEYS) {
    const rootValue = state[key];
    if (
      rootValue !== undefined &&
      rootValue !== null &&
      flat[key] === undefined
    ) {
      flat[key] = rootValue;
    }
  }
  const sanitizedPhase = sanitizeResearchAdkPhase(
    typeof flat.current_phase === "string" ? flat.current_phase : null,
  );
  if (sanitizedPhase) {
    flat.current_phase = sanitizedPhase;
  } else {
    delete flat.current_phase;
  }
  return flat;
};
