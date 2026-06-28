/**
 * AI Studio session.state — タスク別バケット (image / writing / sheet / consultation).
 * Firestore 永続化は golden エンベロープ + state.<task> バケットのみ。
 */
import type { LlmModelSelection } from "@models/llmModelSelection";
import type { ImageCreationMode, ImageReferenceState } from "@utils/imageReference";
import { emptyImageReferenceState } from "@utils/imageReference";
import type { ImageStudioFields } from "@utils/imageStudioState";
import {
  buildGoldenImageTaskBucket,
  buildGoldenWritingTaskBucket,
  imageGoldenToEffectiveFlat,
  mergeGoldenTaskBucket,
  researchGoldenToEffectiveFlat,
} from "@utils/goldenTaskBucket";
import {
  buildResearchModeState,
  type ResearchStudioFields,
} from "@utils/researchStudioState";
import {
  sheetModeStateToApi,
  type SheetConnectionFields,
} from "@utils/sheetWorkspaceState";
import {
  webPageModeStateToApi,
  type WebPageBuilderFields,
} from "@utils/webPageWorkspaceState";
import {
  applicationScanModeStateToApi,
  type ApplicationScanFields,
} from "@utils/applicationScanWorkspaceState";
import type {
  WritingFormState,
  WritingPhase,
  WritingReferenceState,
} from "@models/writingForm";
import { buildGoldenEnvelopePatch } from "@utils/enAiStudioSessionStateIO";
import {
  isEnAiStudioActiveTask,
  type EnAiStudioActiveTask,
} from "@models/enAiStudioSessionState";

export type WorkspaceTaskKey =
  | "image"
  | "writing"
  | "sheet"
  | "consultation"
  | "research"
  | "data_analysis"
  | "web_page"
  | "application_scan"
  | "vibe_related_context"
  | "vibe_zapping_analysis"
  | "vibe_capability_structuring"
  | "vibe_story_generation"
  | "guide";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** golden `state.<task>` バケットのみ */
export const readTaskBucketFromSessionState = (
  state: Record<string, unknown>,
  task: WorkspaceTaskKey
): Record<string, unknown> => {
  const stateTask = state[task];
  return isRecord(stateTask) ? { ...stateTask } : {};
};

export const readImageGoldenBucketFromState = (
  state: Record<string, unknown>
): Record<string, unknown> => readTaskBucketFromSessionState(state, "image");

/** ADK tools 互換 flat ビュー — 入力は golden `state.image` のみ */
export const readImageTaskBucketFromSession = (params: {
  state: Record<string, unknown>;
}): Record<string, unknown> =>
  imageGoldenToEffectiveFlat(readImageGoldenBucketFromState(params.state));

export const buildResearchTaskApiBucket = (
  fields: ResearchStudioFields
): Record<string, unknown> => {
  const fragment = buildResearchModeState({ fields });
  const researchOnly = fragment.research;
  return typeof researchOnly === "object" && researchOnly !== null
    ? (researchOnly as Record<string, unknown>)
    : {};
};

/** golden `state.research` → ADK invoke / UI flat ビュー */
export const readResearchTaskBucketFromSession = (params: {
  state: Record<string, unknown>;
}): Record<string, unknown> => {
  const bucket = readTaskBucketFromSessionState(params.state, "research");
  return researchGoldenToEffectiveFlat(bucket);
};

export const buildImageTaskApiBucket = (params: {
  imageModeSelected?: boolean;
  imageCreationMode?: ImageCreationMode | null;
  imageReferenceState?: ImageReferenceState;
  imageStudio?: ImageStudioFields;
}): Record<string, unknown> =>
  buildGoldenImageTaskBucket({
    ...params,
    imageReferenceState:
      params.imageReferenceState ?? emptyImageReferenceState(),
  });

export const buildWritingTaskApiBucket = (params: {
  writingPhase: WritingPhase;
  writingForm: WritingFormState;
  writingReferenceState: WritingReferenceState;
  writingAction?: "extract_schema" | "generate_document" | null;
}): Record<string, unknown> => buildGoldenWritingTaskBucket(params);

export const buildSheetTaskApiBucket = (
  sheet: SheetConnectionFields
): Record<string, unknown> => sheetModeStateToApi(sheet);

export const buildWebPageTaskApiBucket = (
  fields: WebPageBuilderFields
): Record<string, unknown> => webPageModeStateToApi(fields);

export const buildApplicationScanTaskApiBucket = (
  fields: ApplicationScanFields
): Record<string, unknown> => applicationScanModeStateToApi(fields);

/** Firestore golden state → ADK invoke リクエスト用 nested mode_state */
export const buildInvokeModeStateFromWorkspaceState = (params: {
  state: Record<string, unknown>;
  activeMode: string;
}): Record<string, unknown> => {
  const out: Record<string, unknown> = { active_mode: params.activeMode };

  for (const task of [
    "image",
    "writing",
    "sheet",
    "consultation",
    "research",
    "data_analysis",
    "web_page",
    "application_scan",
    "vibe_related_context",
    "vibe_zapping_analysis",
    "vibe_capability_structuring",
    "vibe_story_generation",
  ] as const) {
    const bucket = params.state[task];
    if (isRecord(bucket)) {
      out[task] = { ...bucket };
    }
  }

  return out;
};

export const buildWorkspaceSessionState = (params: {
  enAiStudioUi: Record<string, unknown>;
  activeMode?: EnAiStudioActiveTask | null;
  image?: {
    imageModeSelected?: boolean;
    imageCreationMode?: ImageCreationMode | null;
    imageReferenceState?: ImageReferenceState;
    imageStudio?: ImageStudioFields;
  };
  sheet?: SheetConnectionFields;
  writing?: {
    writingPhase: WritingPhase;
    writingForm: WritingFormState;
    writingReferenceState: WritingReferenceState;
    writingAction?: "extract_schema" | "generate_document" | null;
  };
  consultation?: { consultationModel?: LlmModelSelection };
  research?: ResearchStudioFields;
  webPage?: WebPageBuilderFields;
  applicationScan?: ApplicationScanFields;
}): Record<string, unknown> => {
  const state: Record<string, unknown> = {};

  if (params.image) {
    const apiImage = buildImageTaskApiBucket(params.image);
    if (Object.keys(apiImage).length > 0) {
      state.image = mergeGoldenTaskBucket({ patch: apiImage });
    }
  }

  if (params.sheet) {
    state.sheet = buildSheetTaskApiBucket(params.sheet);
  }

  if (params.writing) {
    state.writing = mergeGoldenTaskBucket({
      patch: buildWritingTaskApiBucket(params.writing),
    });
  }

  if (params.consultation?.consultationModel) {
    state.consultation = { model: params.consultation.consultationModel };
  }

  if (params.research) {
    const apiResearch = buildResearchTaskApiBucket(params.research);
    if (Object.keys(apiResearch).length > 0) {
      state.research = mergeGoldenTaskBucket({ patch: apiResearch });
    }
  }

  if (params.activeMode === "guide") {
    state.guide = mergeGoldenTaskBucket({
      patch: { phase: "chat", setup: { confirmed: true } },
    });
  }

  if (params.webPage) {
    state.web_page = mergeGoldenTaskBucket({
      patch: buildWebPageTaskApiBucket(params.webPage),
    });
  }

  if (params.applicationScan) {
    state.application_scan = mergeGoldenTaskBucket({
      patch: buildApplicationScanTaskApiBucket(params.applicationScan),
    });
  }

  const messages = Array.isArray(params.enAiStudioUi.messages)
    ? params.enAiStudioUi.messages
    : [];
  const activeTask = (
    isEnAiStudioActiveTask(params.activeMode) ? params.activeMode : null
  ) as EnAiStudioActiveTask | null;
  const groundingRaw = params.enAiStudioUi.groundingMetadataByResponseId;
  const envelope = buildGoldenEnvelopePatch({
    messages,
    title: typeof params.enAiStudioUi.title === "string" ? params.enAiStudioUi.title : "",
    status:
      params.enAiStudioUi.status === "archived" || params.enAiStudioUi.status === "deleted"
        ? params.enAiStudioUi.status
        : "active",
    activeTask,
    groundingByResponseId:
      groundingRaw && typeof groundingRaw === "object"
        ? (groundingRaw as Record<string, unknown>)
        : undefined,
  });
  Object.assign(state, envelope);

  return state;
};
