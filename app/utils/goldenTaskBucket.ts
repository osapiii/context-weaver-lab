/**
 * Golden task bucket — write (golden only) / read (legacy tolerant flat view).
 */
import type { ImageCreationMode, ImageReferenceState } from "@utils/imageReference";
import { imageReferenceStateToModeState } from "@utils/imageReference";
import type { ImageStudioFields } from "@utils/imageStudioState";
import type {
  WritingFormState,
  WritingPhase,
  WritingReferenceState,
} from "@models/writingForm";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** ADK tools / 既存 reader 用 — golden bucket → flat API ビュー */
export const imageGoldenToEffectiveFlat = (
  bucket: Record<string, unknown>
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const phase = bucket.phase ?? bucket.image_workflow_phase;
  if (phase === "create" || phase === "retouch") {
    out.image_workflow_phase = phase;
  }

  const setup = isRecord(bucket.setup) ? bucket.setup : {};
  if (setup.confirmed === true) out.image_mode_selected = true;
  else if (setup.confirmed === false) out.image_mode_selected = false;
  else if (bucket.image_mode_selected === true) out.image_mode_selected = true;
  else if (bucket.image_mode_selected === false) out.image_mode_selected = false;
  const creation = setup.creation ?? bucket.image_creation_mode;
  if (creation === "scratch" || creation === "reference") {
    out.image_creation_mode = creation;
  }
  const ref = setup.reference ?? bucket.image_reference;
  if (isRecord(ref)) out.image_reference = { ...ref };

  const primary = bucket.primary ?? bucket.primary_image;
  if (primary !== undefined) out.primary_image = primary;

  if (Array.isArray(bucket.retouch_regions)) {
    out.retouch_regions = bucket.retouch_regions;
  }
  return out;
};

export type ResearchStudioSetupFields = {
  theme?: string | null;
  autoMode?: boolean;
  /** キオスク一気通貫: 1 invoke でサーバーがパイプライン完走 */
  pipelineAutonomous?: boolean;
  planOnly?: boolean;
  briefingTheme?: string | null;
  briefingAudience?: string | null;
  briefingUseCase?: string | null;
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

/** ADK tools / 既存 reader 用 — golden `state.research` → flat ビュー */
export const researchGoldenToEffectiveFlat = (
  bucket: Record<string, unknown>
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const phase = bucket.phase ?? bucket.current_phase;
  if (typeof phase === "string" && phase.trim()) {
    out.current_phase = phase.trim();
  }

  const setup = isRecord(bucket.setup) ? bucket.setup : {};
  if (typeof setup.theme === "string" && setup.theme.trim()) {
    out.theme = setup.theme.trim();
  } else if (typeof bucket.theme === "string" && bucket.theme.trim()) {
    out.theme = bucket.theme.trim();
  }
  if (setup.auto_mode === true || bucket.auto_mode === true) {
    out.auto_mode = true;
  } else if (setup.auto_mode === false || bucket.auto_mode === false) {
    out.auto_mode = false;
  }
  if (
    setup.pipeline_autonomous === true ||
    bucket.pipeline_autonomous === true
  ) {
    out.pipeline_autonomous = true;
  }
  if (setup.plan_only === true || bucket.plan_only === true) {
    out.plan_only = true;
  }
  for (const [src, dst] of [
    ["briefing_theme", "briefing_theme"],
    ["briefing_audience", "briefing_audience"],
    ["briefing_use_case", "briefing_use_case"],
    ["organization_id", "organization_id"],
    ["organization_name", "organization_name"],
    ["space_id", "space_id"],
    ["space_name", "space_name"],
    ["workspace_id", "workspace_id"],
    ["workspace_name", "workspace_name"],
    ["file_space_id", "file_space_id"],
    ["context_status", "context_status"],
    ["context_warning", "context_warning"],
  ] as const) {
    const v = setup[src] ?? bucket[src];
    if (typeof v === "string" && v.trim()) out[dst] = v.trim();
  }

  const payload = isRecord(bucket.payload) ? bucket.payload : {};
  for (const key of [
    "deck_id",
    "deck_dir",
    "research_path",
    "research_html_path",
    "progress",
    "progress_history",
    "job_log",
    "phase_status",
    "plan_draft",
    "workflow_phase",
    "notification_email",
  ] as const) {
    const v = payload[key] ?? bucket[key];
    if (v !== undefined && v !== null) out[key] = v;
  }

  if (Array.isArray(bucket.progress_history) && !out.progress_history) {
    out.progress_history = bucket.progress_history;
  }

  return out;
};

export const writingGoldenToEffectiveFlat = (
  bucket: Record<string, unknown>
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const phase = bucket.phase ?? bucket.writing_phase;
  if (typeof phase === "string" && phase.trim()) {
    out.writing_phase = phase.trim();
  }
  const setup = isRecord(bucket.setup) ? bucket.setup : {};
  const ref = setup.reference ?? bucket.writing_reference;
  if (isRecord(ref)) out.writing_reference = { ...ref };
  const payload = isRecord(bucket.payload) ? bucket.payload : {};
  const form = payload.form ?? bucket.writing_form;
  if (isRecord(form)) out.writing_form = { ...form };
  const action = payload.action ?? bucket.writing_action;
  if (typeof action === "string" && action.trim()) {
    out.writing_action = action.trim();
  }
  return out;
};

const writingReferenceToApi = (
  ref: WritingReferenceState
): Record<string, unknown> => ({
  status: ref.status,
  attachments: ref.attachments.map((att) => ({
    id: att.id,
    source: att.source,
    name: att.name,
    mime_type: att.mimeType,
    ...(att.gcsPath ? { gcs_path: att.gcsPath } : {}),
    ...(att.storageUrl ? { storage_url: att.storageUrl } : {}),
    ...(att.knowledgeDocId ? { knowledge_doc_id: att.knowledgeDocId } : {}),
  })),
  selected_knowledge: ref.selectedKnowledge.map((k) => ({
    id: k.id,
    name: k.name,
    gcs_path: k.gcsPath,
    mime_type: k.mimeType,
  })),
});

const writingFormToApi = (form: WritingFormState): Record<string, unknown> => ({
  title: form.title ?? "",
  fields: form.fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required === true,
    ...(field.hint ? { hint: field.hint } : {}),
    ...(field.customInstruction?.trim()
      ? { custom_instruction: field.customInstruction.trim() }
      : {}),
    ...(field.options?.length ? { options: field.options } : {}),
    ...(field.value !== undefined ? { value: field.value } : {}),
  })),
  schema_confirmed_at: form.schemaConfirmedAt ?? null,
});

/** Firestore 永続化用 — golden `state.image` */
export const buildGoldenImageTaskBucket = (params: {
  imageModeSelected?: boolean;
  imageCreationMode?: ImageCreationMode | null;
  imageReferenceState?: ImageReferenceState;
  imageStudio?: ImageStudioFields;
}): Record<string, unknown> => {
  const bucket: Record<string, unknown> = {};

  if (params.imageModeSelected === false) {
    bucket.setup = {
      confirmed: false,
      creation: null,
      reference: {
        status: "incomplete",
        references: [],
        min_count: 0,
        confirmed_at: null,
      },
    };
  } else if (params.imageModeSelected && params.imageCreationMode) {
    const setup: Record<string, unknown> = {
      confirmed: true,
      creation: params.imageCreationMode,
    };
    if (params.imageCreationMode === "reference" && params.imageReferenceState) {
      setup.reference = imageReferenceStateToModeState(
        params.imageReferenceState
      ).image_reference;
    } else if (params.imageCreationMode === "scratch") {
      setup.reference = {
        status: "incomplete",
        references: [],
        min_count: 0,
        confirmed_at: null,
      };
    }
    bucket.setup = setup;
  }

  if (params.imageStudio) {
    bucket.phase = params.imageStudio.imageWorkflowPhase;
    const primary = params.imageStudio.primaryArtifact;
    const hasPrimary = Boolean(primary.adkFilename?.trim());
    bucket.primary = hasPrimary
      ? {
          artifact_id: primary.artifactId,
          adk_filename: primary.adkFilename,
          version: primary.artifactVersion,
        }
      : null;
    bucket.retouch_regions = params.imageStudio.retouchRegions.map((region) => ({
      id: region.id,
      bbox: region.bbox,
      instruction: region.instruction,
      ...(region.cropGcsPath ? { crop_gcs_path: region.cropGcsPath } : {}),
    }));
  }

  return bucket;
};

/** Firestore 永続化用 — golden `state.writing` */
export const buildGoldenWritingTaskBucket = (params: {
  writingPhase: WritingPhase;
  writingForm: WritingFormState;
  writingReferenceState: WritingReferenceState;
  writingAction?: "extract_schema" | "generate_document" | null;
}): Record<string, unknown> => {
  const bucket: Record<string, unknown> = {
    phase: params.writingPhase,
    setup: {
      reference: writingReferenceToApi(params.writingReferenceState),
      ...(params.writingReferenceState.status === "complete"
        ? { confirmed: true }
        : {}),
    },
    payload: {
      form: writingFormToApi(params.writingForm),
      ...(params.writingAction ? { action: params.writingAction } : {}),
    },
  };
  return bucket;
};

/** Firestore 永続化用 — golden `state.research` */
export const buildGoldenResearchTaskBucket = (params: {
  phase?: string | null;
  setup?: ResearchStudioSetupFields;
  payload?: Record<string, unknown>;
}): Record<string, unknown> => {
  const bucket: Record<string, unknown> = {};

  if (params.phase?.trim()) {
    bucket.phase = params.phase.trim();
  }

  const setup = params.setup;
  if (setup) {
    const setupOut: Record<string, unknown> = {};
    const theme = setup.theme?.trim();
    if (theme) setupOut.theme = theme;
    if (setup.autoMode === true) setupOut.auto_mode = true;
    else if (setup.autoMode === false) setupOut.auto_mode = false;
    if (setup.pipelineAutonomous === true) {
      setupOut.pipeline_autonomous = true;
    }
    if (setup.planOnly === true) {
      setupOut.plan_only = true;
    }
    const bt = setup.briefingTheme?.trim();
    if (bt) setupOut.briefing_theme = bt;
    const ba = setup.briefingAudience?.trim();
    if (ba) setupOut.briefing_audience = ba;
    const bu = setup.briefingUseCase?.trim();
    if (bu) setupOut.briefing_use_case = bu;
    const organizationId = setup.organizationId?.trim();
    if (organizationId) setupOut.organization_id = organizationId;
    const organizationName = setup.organizationName?.trim();
    if (organizationName) setupOut.organization_name = organizationName;
    const spaceId = setup.spaceId?.trim();
    if (spaceId) setupOut.space_id = spaceId;
    const spaceName = setup.spaceName?.trim();
    if (spaceName) setupOut.space_name = spaceName;
    const workspaceId = setup.workspaceId?.trim();
    if (workspaceId) setupOut.workspace_id = workspaceId;
    const workspaceName = setup.workspaceName?.trim();
    if (workspaceName) setupOut.workspace_name = workspaceName;
    const fileSpaceId = setup.fileSpaceId?.trim();
    if (fileSpaceId) setupOut.file_space_id = fileSpaceId;
    if (setup.contextStatus === "ready" || setup.contextStatus === "limited") {
      setupOut.context_status = setup.contextStatus;
    }
    const contextWarning = setup.contextWarning?.trim();
    if (contextWarning) setupOut.context_warning = contextWarning;
    if (Object.keys(setupOut).length > 0) bucket.setup = setupOut;
  }

  if (params.payload && Object.keys(params.payload).length > 0) {
    bucket.payload = { ...params.payload };
  }

  return bucket;
};

export const mergeGoldenTaskBucket = (params: {
  existing?: Record<string, unknown> | null;
  patch: Record<string, unknown>;
}): Record<string, unknown> => {
  const base = isRecord(params.existing) ? { ...params.existing } : {};
  const merged = { ...base, ...params.patch };
  if (!isRecord(merged.invoke)) {
    merged.invoke = isRecord(base.invoke)
      ? { ...base.invoke }
      : { status: "idle", logs: [] };
  }
  return merged;
};
