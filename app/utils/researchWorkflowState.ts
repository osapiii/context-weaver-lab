import { doc, getDoc, getFirestore, serverTimestamp, updateDoc } from "firebase/firestore";
import type { ResearchWorkflowPhase } from "@stores/researchAgent";
import type { ResearchPlanDraft, ResearchSectionKind } from "@utils/researchPlanDraft";
import type { ResearchStudioFields } from "@utils/researchStudioState";
import { buildResearchTaskApiBucket } from "@utils/workspaceSessionBuckets";
import { mergeGoldenTaskBucket } from "@utils/goldenTaskBucket";
import { resolveAdkSessionScope } from "@composables/useAdkSessionScope";

const WORKFLOW_PHASES = new Set<ResearchWorkflowPhase>([
  "plan_generating",
  "plan_review",
  "confirm_submit",
  "generating",
  "submitted",
  "done",
  "failed",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const SECTION_KINDS = new Set<ResearchSectionKind>([
  "definitional",
  "comparative",
  "decisional",
  "how_to",
  "risk",
  "other",
]);

export const parseResearchWorkflowPhase = (
  value: unknown
): ResearchWorkflowPhase | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const phase = value.trim() as ResearchWorkflowPhase;
  return WORKFLOW_PHASES.has(phase) ? phase : null;
};

export const parseResearchPlanDraftFromState = (
  value: unknown
): ResearchPlanDraft | null => {
  if (!isRecord(value)) return null;
  const deckRaw = value.deck;
  if (!isRecord(deckRaw)) return null;
  const title = typeof deckRaw.title === "string" ? deckRaw.title.trim() : "";
  const target_reader =
    typeof deckRaw.target_reader === "string"
      ? deckRaw.target_reader.trim()
      : "";
  const intent =
    typeof deckRaw.intent === "string" ? deckRaw.intent.trim() : "";
  if (!title) return null;

  const sectionsRaw = Array.isArray(value.sections) ? value.sections : [];
  const sections = sectionsRaw
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const question =
        typeof item.question === "string" ? item.question.trim() : "";
      if (!question) return null;
      const id =
        typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : `Q${index + 1}`;
      const kindRaw = item.kind;
      const kind = SECTION_KINDS.has(kindRaw as ResearchSectionKind)
        ? (kindRaw as ResearchSectionKind)
        : "definitional";
      return { id, question, kind };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  if (sections.length < 1) return null;

  const concernsRaw = Array.isArray(value.concerns) ? value.concerns : [];
  const concerns = concernsRaw
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) return null;
      const id =
        typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : `C${index + 1}`;
      return { id, text };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    deck: { title, target_reader, intent },
    sections,
    concerns,
  };
};

export type ResearchWorkflowSnapshot = {
  workflowPhase: ResearchWorkflowPhase | null;
  planDraft: ResearchPlanDraft | null;
  notificationEmail: string | null;
  contextStatus: "ready" | "limited" | null;
  contextWarning: string | null;
};

export const readResearchWorkflowFromFlatState = (params: {
  flat: Record<string, unknown>;
}): ResearchWorkflowSnapshot => {
  const workflowPhase = parseResearchWorkflowPhase(params.flat.workflow_phase);
  const planDraft = parseResearchPlanDraftFromState(params.flat.plan_draft);
  const notificationEmail =
    typeof params.flat.notification_email === "string" &&
    params.flat.notification_email.trim()
      ? params.flat.notification_email.trim()
      : null;
  const contextStatus =
    params.flat.context_status === "ready" ||
    params.flat.context_status === "limited"
      ? params.flat.context_status
      : null;
  const contextWarning =
    typeof params.flat.context_warning === "string" &&
    params.flat.context_warning.trim()
      ? params.flat.context_warning.trim()
      : null;
  return { workflowPhase, planDraft, notificationEmail, contextStatus, contextWarning };
};

export const persistResearchWorkflowToSession = async (params: {
  sessionId: string;
  fields: ResearchStudioFields;
}): Promise<void> => {
  const scope = resolveAdkSessionScope();
  const ref = doc(
    getFirestore(),
    "organizations",
    scope.organizationId,
    "spaces",
    scope.spaceId,
    "adkSessions",
    params.sessionId
  );
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  const state =
    data.state && typeof data.state === "object"
      ? ({ ...(data.state as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const existingResearch =
    state.research && typeof state.research === "object"
      ? (state.research as Record<string, unknown>)
      : null;
  const patch = buildResearchTaskApiBucket(params.fields);
  state.research = mergeGoldenTaskBucket({
    existing: existingResearch,
    patch,
  });
  state.active_task = "research";
  await updateDoc(ref, {
    state,
    jobKind: "research",
    activeAgent: "research",
    updatedAt: serverTimestamp(),
    lastUpdateTime: Date.now() / 1000,
  });
};
