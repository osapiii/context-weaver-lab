/**
 * AI Studio adkSessions.state — ゴールデンエンベロープ + タスク別バケット同期.
 */
import {
  isAiStudioWorkspaceMode,
  type AiStudioWorkspaceMode,
} from "@constants/aiStudioModes";
import { isEnAiStudioActiveTask } from "@models/enAiStudioSessionState";
import { readActiveTaskFromState } from "@utils/enAiStudioSessionStateIO";
import { buildWorkspaceSessionState } from "@utils/workspaceSessionBuckets";
import {
  type ImageCreationMode,
  type ImageReferenceState,
} from "@utils/imageReference";
import {
  sheetModeStateToApi,
  type SheetConnectionFields,
} from "@utils/sheetWorkspaceState";
import {
  type ImageStudioFields,
} from "@utils/imageStudioState";
import {
  type WritingFormState,
  type WritingPhase,
  type WritingReferenceState,
} from "@utils/writingWorkspaceState";
import type { ResearchStudioFields } from "@utils/researchStudioState";
import type { WebPageBuilderFields } from "@utils/webPageWorkspaceState";
import type { ApplicationScanFields } from "@utils/applicationScanWorkspaceState";

export const resolveWorkspaceModeFromFirestoreState = (params: {
  state: Record<string, unknown>;
}): AiStudioWorkspaceMode | null => {
  const fromGolden = readActiveTaskFromState(params.state);
  if (isAiStudioWorkspaceMode(fromGolden)) {
    return fromGolden;
  }
  return null;
};

export const buildAiStudioFirestoreSessionState = (params: {
  enAiStudioUi: Record<string, unknown>;
  jobKind?: string | null;
  activeAgent?: string | null;
  imageCreationMode?: ImageCreationMode | null;
  imageReferenceState?: ImageReferenceState;
  imageModeSelected?: boolean;
  sheetConnection?: SheetConnectionFields;
  spreadsheetId?: string | null;
  spreadsheetUrl?: string | null;
  imageStudio?: ImageStudioFields;
  writingPhase?: WritingPhase;
  writingForm?: WritingFormState;
  writingReferenceState?: WritingReferenceState;
  writingAction?: "extract_schema" | "generate_document" | null;
  consultationModel?: import("@models/llmModelSelection").LlmModelSelection;
  research?: ResearchStudioFields;
  webPage?: WebPageBuilderFields;
  applicationScan?: ApplicationScanFields;
}): Record<string, unknown> => {
  const activeTask =
    (isEnAiStudioActiveTask(params.activeAgent) ? params.activeAgent : null) ??
    (isEnAiStudioActiveTask(params.jobKind) ? params.jobKind : null);
  const workspaceMode = isAiStudioWorkspaceMode(activeTask) ? activeTask : null;

  if (activeTask === "research" && params.research) {
    return buildWorkspaceSessionState({
      enAiStudioUi: params.enAiStudioUi,
      activeMode: "research",
      research: params.research,
    });
  }

  if (activeTask === "guide") {
    return buildWorkspaceSessionState({
      enAiStudioUi: params.enAiStudioUi,
      activeMode: "guide",
    });
  }

  if (!workspaceMode) {
    return buildWorkspaceSessionState({
      enAiStudioUi: params.enAiStudioUi,
      ...(activeTask ? { activeMode: activeTask } : {}),
    });
  }

  const bucketParams: Parameters<typeof buildWorkspaceSessionState>[0] = {
    enAiStudioUi: params.enAiStudioUi,
    activeMode: workspaceMode,
  };

  if (workspaceMode === "image") {
    bucketParams.image = {
      imageModeSelected: params.imageModeSelected,
      imageCreationMode: params.imageCreationMode,
      imageReferenceState: params.imageReferenceState,
      imageStudio: params.imageStudio,
    };
  }

  if (workspaceMode === "writing") {
    bucketParams.writing = {
      writingPhase: params.writingPhase ?? "format_review",
      writingForm:
        params.writingForm ?? { title: "", fields: [], schemaConfirmedAt: null },
      writingReferenceState:
        params.writingReferenceState ?? {
          status: "draft",
          attachments: [],
          selectedKnowledge: [],
        },
      writingAction: params.writingAction ?? null,
    };
  }

  if (workspaceMode === "sheet") {
    const sheet =
      params.sheetConnection ??
      ({
        sheetModeSelected: false,
        spreadsheetId: params.spreadsheetId ?? null,
        spreadsheetUrl: params.spreadsheetUrl ?? null,
        targetSheetName: null,
        targetSheetGid: null,
      } satisfies SheetConnectionFields);
    if (!sheet.sheetModeSelected) {
      const legacyId = params.spreadsheetId?.trim();
      const legacyUrl = params.spreadsheetUrl?.trim();
      bucketParams.sheet = {
        ...sheet,
        sheetModeSelected: Boolean(legacyId),
        spreadsheetId: legacyId || null,
        spreadsheetUrl: legacyUrl || null,
      };
    } else {
      bucketParams.sheet = sheet;
    }
  }

  if (workspaceMode === "consultation" && params.consultationModel) {
    bucketParams.consultation = {
      consultationModel: params.consultationModel,
    };
  }

  if (workspaceMode === "research" && params.research) {
    bucketParams.research = params.research;
  }

  if (workspaceMode === "web_page" && params.webPage) {
    bucketParams.webPage = params.webPage;
  }

  if (workspaceMode === "application_scan" && params.applicationScan) {
    bucketParams.applicationScan = params.applicationScan;
  }

  return buildWorkspaceSessionState(bucketParams);
};

/** @deprecated 参照用 — sheet 断片のみ必要な場合 */
export { sheetModeStateToApi };
