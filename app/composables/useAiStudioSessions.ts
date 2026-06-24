/**
 * AI Studio ワークスペース session — Firestore adkSessions のみ（ブラウザ→ADK REST なし）.
 */
import { ref, shallowRef } from "vue";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { LlmModelSelection } from "@models/llmModelSelection";
import type {
  AiStudioActiveAgent,
  AiStudioJobKind,
  AiStudioMessage,
} from "@stores/aiStudio";
import type {
  ImageCreationMode,
  ImageReferenceState,
} from "@utils/imageReference";
import {
  emptyImageReferenceState,
  normalizeImageReferenceState,
  resolveImageModeSelectedFromSessionState,
  resolveRecordImageCreationMode,
} from "@utils/imageReference";
import {
  buildAiStudioFirestoreSessionState,
  resolveWorkspaceModeFromFirestoreState,
} from "@utils/aiStudioSessionState";
import {
  resolveSheetFieldsFromRecord,
  type SheetConnectionFields,
} from "@utils/sheetWorkspaceState";
import {
  resolveImageStudioFieldsFromRecord,
  type ImageStudioFields,
} from "@utils/imageStudioState";
import {
  resolveWritingFieldsFromRecord,
  type WritingFormState,
  type WritingPhase,
  type WritingReferenceState,
} from "@utils/writingWorkspaceState";
import {
  resolveWebPageFieldsFromRecord,
  type WebPageBuilderFields,
} from "@utils/webPageWorkspaceState";
import {
  resolveApplicationScanFieldsFromRecord,
  type ApplicationScanFields,
} from "@utils/applicationScanWorkspaceState";
import { resolveAdkSessionScope } from "@composables/useAdkSessionScope";
import { omitFirestoreUndefined } from "@utils/firestorePayload";
import {
  readImageTaskBucketFromSession,
  readResearchTaskBucketFromSession,
} from "@utils/workspaceSessionBuckets";
import {
  readActiveTaskFromState,
  readGroundingByResponseId,
  readSessionMetaFromState,
  readTranscriptFromState,
} from "@utils/enAiStudioSessionStateIO";
import {
  resolveSessionImageThumbnail,
  type AiStudioSessionImageThumbnail,
} from "@utils/aiStudioSessionThumbnail";
import log from "@utils/logger";

export type { AiStudioSessionImageThumbnail };

export type AiStudioSessionStatus = "active" | "completed";

export interface AiStudioSessionListItem {
  sessionId: string;
  title: string;
  status: AiStudioSessionStatus;
  jobKind: AiStudioJobKind;
  activeAgent: AiStudioActiveAgent;
  updatedAt: number;
  messageCount: number;
  /** 画像生成セッションの一覧サムネ (primaryImage または最新 image artifact) */
  imageThumbnail?: AiStudioSessionImageThumbnail | null;
  researchTheme?: string | null;
  researchCurrentPhase?: string | null;
}

export interface AiStudioSessionRecord {
  sessionId: string;
  title: string;
  status: AiStudioSessionStatus;
  jobKind: AiStudioJobKind;
  activeAgent: AiStudioActiveAgent;
  routingReason: string;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  messages: AiStudioMessage[];
  /** responseId (assistant message id) → full grounding_metadata */
  groundingMetadataByResponseId?: Record<string, unknown>;
  /** 経営相談 ADK 用モデル選択 (RequestDoc `input.model` と同じキー) */
  consultationModel?: LlmModelSelection;
  imageReferenceState?: ImageReferenceState;
  imageCreationMode?: ImageCreationMode | null;
  imageModeSelected?: boolean;
  sheetModeSelected?: boolean;
  targetSheetName?: string | null;
  targetSheetGid?: number | null;
  imageStudio?: ImageStudioFields;
  writingPhase?: WritingPhase;
  writingForm?: WritingFormState;
  writingReferenceState?: WritingReferenceState;
  researchCurrentPhase?: string | null;
  researchTheme?: string | null;
  webPageFields?: WebPageBuilderFields;
  applicationScanFields?: ApplicationScanFields;
  researchAutoMode?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 一覧の再取得トリガ (sidebar / store 共有) */
export const aiStudioSessionsRevision = ref(0);
/** 現在の組織・スペースに対する初回スナップショット受信済みフラグ */
export const aiStudioSessionsReady = ref(false);

const EN_AISTUDIO_ADK_APP_NAME = "en-aistudio-adk-agent";

const sheetConnectionFromRecord = (
  record: Partial<AiStudioSessionRecord>
): SheetConnectionFields => ({
  sheetModeSelected: record.sheetModeSelected === true,
  spreadsheetId: record.spreadsheetId ?? null,
  spreadsheetUrl: record.spreadsheetUrl ?? null,
  targetSheetName: record.targetSheetName ?? null,
  targetSheetGid: record.targetSheetGid ?? null,
});

const cachedList = shallowRef<AiStudioSessionListItem[]>([]);

let activeUnsubscribe: (() => void) | null = null;
let activeScopeKey = "";

const bumpRevision = (): void => {
  aiStudioSessionsRevision.value += 1;
};

const defaultTitleForJob = (jobKind: AiStudioJobKind): string => {
  switch (jobKind) {
    case "writing":
      return "文書生成";
    case "sheet":
      return "シート編集";
    case "image":
      return "画像生成";
    case "consultation":
      return "経営相談";
    case "research":
      return "リサーチ";
    case "data_analysis":
      return "データ分析";
    case "web_page":
      return "WEBページ";
    case "application_scan":
      return "アプリスキャン";
    default:
      return "新しい相談";
  }
};

const deriveTitle = (
  messages: AiStudioMessage[],
  jobKind: AiStudioJobKind
): string => {
  const firstUser = messages.find((m) => m.role === "user" && m.text.trim());
  if (firstUser) {
    const t = firstUser.text.trim().replace(/\s+/g, " ");
    return t.length > 48 ? `${t.slice(0, 48)}…` : t;
  }
  return defaultTitleForJob(jobKind);
};

/** 一覧表示・永続化用: ジョブ既定タイトルのままなら先頭ユーザ発言を優先 */
export const resolveSessionTitle = (params: {
  storedTitle?: string | null;
  messages: AiStudioMessage[];
  jobKind: AiStudioJobKind;
}): string => {
  const derived = deriveTitle(params.messages, params.jobKind);
  const stored = params.storedTitle?.trim();
  if (!stored) return derived;
  const jobDefault = defaultTitleForJob(params.jobKind);
  if (stored === jobDefault && derived !== jobDefault) {
    return derived;
  }
  return stored;
};

const denormalizedSessionDocFields = (
  record: Pick<
    AiStudioSessionRecord,
    "title" | "jobKind" | "activeAgent" | "status"
  >
): Record<string, string> => {
  const out: Record<string, string> = {};
  if (record.title.trim()) {
    out.title = record.title.trim();
  }
  if (record.jobKind) {
    out.jobKind = record.jobKind;
  }
  if (record.activeAgent) {
    out.activeAgent = record.activeAgent;
  }
  if (record.status?.trim()) {
    out.status = record.status.trim();
  }
  return out;
};

const timestampToMs = (value: unknown, fallback: number): number => {
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as Timestamp).toMillis();
  }
  if (typeof value === "number") {
    return value > 1e12 ? value : value * 1000;
  }
  return fallback;
};

const mapDocToListItem = (
  sessionId: string,
  data: Record<string, unknown>
): AiStudioSessionListItem | null => {
  if (data.status === "deleted") {
    return null;
  }
  const state =
    data.state && typeof data.state === "object"
      ? (data.state as Record<string, unknown>)
      : {};
  const meta = readSessionMetaFromState(state);
  const messages = readTranscriptFromState(state);
  const activeTask = readActiveTaskFromState(state);
  let jobKind = (data.jobKind ?? activeTask ?? null) as AiStudioJobKind;
  if (
    !jobKind &&
    state.research &&
    typeof state.research === "object" &&
    !Array.isArray(state.research)
  ) {
    jobKind = "research";
  }
  const title = resolveSessionTitle({
    storedTitle:
      meta.title ||
      (typeof data.title === "string" && data.title) ||
      null,
    messages,
    jobKind,
  });
  const updatedAt = timestampToMs(
    data.updatedAt,
    typeof data.lastUpdateTime === "number" ? (data.lastUpdateTime as number) * 1000 : Date.now()
  );
  const imageThumbnail = resolveSessionImageThumbnail({
    state,
    messages,
  });
  const researchBucket =
    state.research && typeof state.research === "object"
      ? (state.research as Record<string, unknown>)
      : {};
  const researchSetup =
    researchBucket.setup && typeof researchBucket.setup === "object"
      ? (researchBucket.setup as Record<string, unknown>)
      : {};
  const researchTheme =
    (typeof researchSetup.theme === "string" && researchSetup.theme.trim()) ||
    (typeof researchBucket.theme === "string" && researchBucket.theme.trim()) ||
    (typeof state.theme === "string" && state.theme.trim()) ||
    null;
  const researchPhaseRaw =
    researchBucket.phase ??
    researchBucket.current_phase ??
    state.current_phase;
  const researchCurrentPhase =
    typeof researchPhaseRaw === "string" && researchPhaseRaw.trim()
      ? researchPhaseRaw.trim()
      : null;
  const researchPayload =
    researchBucket.payload && typeof researchBucket.payload === "object"
      ? (researchBucket.payload as Record<string, unknown>)
      : {};
  const researchHtmlPath =
    researchPayload.research_html_path ?? researchBucket.research_html_path;
  let status = (meta.status as AiStudioSessionStatus) ?? "active";
  if (
    jobKind === "research" &&
    typeof researchHtmlPath === "string" &&
    researchHtmlPath.trim()
  ) {
    status = "completed";
  }
  let listTitle = title;
  if (jobKind === "research" && researchTheme) {
    const defaultResearchTitle = defaultTitleForJob("research");
    if (!listTitle.trim() || listTitle === defaultResearchTitle) {
      const t = researchTheme.trim();
      listTitle = t.length > 48 ? `${t.slice(0, 48)}…` : t;
    }
  }

  return {
    sessionId,
    title: listTitle,
    status,
    jobKind,
    activeAgent: (data.activeAgent ??
      activeTask ??
      null) as AiStudioActiveAgent,
    updatedAt,
    messageCount: messages.length,
    imageThumbnail,
    researchTheme,
    researchCurrentPhase,
  };
};

/** Pinia record → buildWorkspaceSessionState 用コンテキスト（state.en-aistudio_ui には書かない） */
export const buildSessionPatchContext = (
  record: Partial<AiStudioSessionRecord>
): Record<string, unknown> => {
  const messages = record.messages ?? [];
  const jobKind = record.jobKind ?? null;
  const ui: Record<string, unknown> = {
    title: resolveSessionTitle({
      storedTitle: record.title,
      messages,
      jobKind,
    }),
    status: record.status ?? "active",
    jobKind: record.jobKind ?? null,
    activeAgent: record.activeAgent ?? null,
    routingReason: record.routingReason ?? "",
    spreadsheetId: record.spreadsheetId ?? null,
    spreadsheetUrl: record.spreadsheetUrl ?? null,
    messages,
    groundingMetadataByResponseId:
      record.groundingMetadataByResponseId &&
      typeof record.groundingMetadataByResponseId === "object"
        ? record.groundingMetadataByResponseId
        : {},
  };
  if (record.consultationModel !== undefined) {
    ui.consultation = { model: record.consultationModel };
  }
  if (
    record.imageCreationMode !== undefined ||
    record.imageModeSelected !== undefined ||
    record.imageStudio ||
    record.imageReferenceState
  ) {
    ui.image = {
      ...(record.imageModeSelected !== undefined
        ? { modeSelected: record.imageModeSelected }
        : {}),
      ...(record.imageCreationMode !== undefined
        ? { creationMode: record.imageCreationMode }
        : {}),
      ...(record.imageReferenceState
        ? { referenceState: record.imageReferenceState }
        : {}),
      ...(record.imageStudio
        ? {
            workflowPhase: record.imageStudio.imageWorkflowPhase,
            primaryImage: {
              artifact_id: record.imageStudio.primaryArtifact.artifactId,
              adk_filename: record.imageStudio.primaryArtifact.adkFilename,
              version: record.imageStudio.primaryArtifact.artifactVersion,
            },
            retouchRegions: record.imageStudio.retouchRegions.map((region) => ({
              id: region.id,
              bbox: region.bbox,
              instruction: region.instruction,
              ...(region.cropGcsPath ? { crop_gcs_path: region.cropGcsPath } : {}),
            })),
          }
        : {}),
    };
  }
  if (
    record.sheetModeSelected !== undefined ||
    record.spreadsheetId !== undefined ||
    record.spreadsheetUrl !== undefined
  ) {
    ui.sheet = {
      modeSelected: record.sheetModeSelected ?? false,
      spreadsheetId: record.spreadsheetId ?? null,
      spreadsheetUrl: record.spreadsheetUrl ?? null,
      targetSheetName: record.targetSheetName ?? null,
      targetSheetGid: record.targetSheetGid ?? null,
    };
  }
  if (
    record.writingPhase !== undefined ||
    record.writingForm !== undefined ||
    record.writingReferenceState !== undefined
  ) {
    ui.writing = {
      ...(record.writingPhase !== undefined ? { phase: record.writingPhase } : {}),
      ...(record.writingForm !== undefined ? { form: record.writingForm } : {}),
      ...(record.writingReferenceState !== undefined
        ? { referenceState: record.writingReferenceState }
        : {}),
    };
  }
  if (record.webPageFields !== undefined) {
    ui.webPage = record.webPageFields;
  }
  if (record.applicationScanFields !== undefined) {
    ui.applicationScan = {
      ...record.applicationScanFields,
      password: record.applicationScanFields.password ? "***" : "",
      authenticatedUrl: record.applicationScanFields.authenticatedUrl ? "***" : "",
    };
  }
  return omitFirestoreUndefined(ui) as Record<string, unknown>;
};

/** @deprecated use buildSessionPatchContext */
export const recordToEnAiStudioUi = buildSessionPatchContext;

export const mapFirestoreDocToRecord = (params: {
  sessionId: string;
  data: Record<string, unknown>;
}): AiStudioSessionRecord | null => {
  if (params.data.status === "deleted") {
    return null;
  }
  const state =
    params.data.state && typeof params.data.state === "object"
      ? (params.data.state as Record<string, unknown>)
      : {};
  const lastUpdateTime =
    typeof params.data.lastUpdateTime === "number"
      ? (params.data.lastUpdateTime as number)
      : timestampToMs(params.data.updatedAt, Date.now());
  return mapApiToRecord({
    sessionId: params.sessionId,
    state,
    lastUpdateTime,
  });
};

const mapApiToRecord = (params: {
  sessionId: string;
  state: Record<string, unknown>;
  lastUpdateTime: number;
}): AiStudioSessionRecord => {
  const meta = readSessionMetaFromState(params.state);
  const messages = readTranscriptFromState(params.state);
  const activeTask = readActiveTaskFromState(params.state);
  const jobKind = (activeTask ?? null) as AiStudioJobKind;
  const imageBucket = readImageTaskBucketFromSession({ state: params.state });
  const imageGolden = params.state.image;
  const setupRef =
    imageGolden &&
    typeof imageGolden === "object" &&
    !Array.isArray(imageGolden) &&
    typeof (imageGolden as Record<string, unknown>).setup === "object"
      ? ((imageGolden as Record<string, unknown>).setup as Record<string, unknown>)
          .reference
      : undefined;
  const imageRefRaw = setupRef ?? imageBucket.image_reference;
  const imageReferenceState = normalizeImageReferenceState(
    typeof imageRefRaw === "object" && imageRefRaw !== null
      ? (imageRefRaw as ImageReferenceState)
      : emptyImageReferenceState()
  );
  const updatedAt =
    params.lastUpdateTime > 1e12
      ? params.lastUpdateTime
      : params.lastUpdateTime * 1000;
  return {
    sessionId: params.sessionId,
    title: resolveSessionTitle({
      storedTitle: meta.title,
      messages,
      jobKind,
    }),
    status: (meta.status as AiStudioSessionStatus) ?? "active",
    jobKind,
    activeAgent: (resolveWorkspaceModeFromFirestoreState({
      state: params.state,
    }) ?? null) as AiStudioActiveAgent,
    routingReason: "",
    messages,
    groundingMetadataByResponseId: readGroundingByResponseId(params.state),
    consultationModel: (() => {
      const consultation = params.state.consultation;
      if (consultation && typeof consultation === "object") {
        const model = (consultation as Record<string, unknown>).model;
        if (model) return model as LlmModelSelection;
      }
      return undefined;
    })(),
    imageReferenceState,
    imageCreationMode: resolveRecordImageCreationMode({
      state: params.state,
      referenceState: imageReferenceState,
    }),
    imageModeSelected: resolveImageModeSelectedFromSessionState({
      state: params.state,
    }),
    ...(() => {
      const sheet = resolveSheetFieldsFromRecord({
        state: params.state,
      });
      return {
        spreadsheetId: sheet.spreadsheetId,
        spreadsheetUrl: sheet.spreadsheetUrl,
        sheetModeSelected: sheet.sheetModeSelected,
        targetSheetName: sheet.targetSheetName,
        targetSheetGid: sheet.targetSheetGid,
      };
    })(),
    imageStudio: resolveImageStudioFieldsFromRecord({
      state: params.state,
    }),
    ...(() => {
      const writing = resolveWritingFieldsFromRecord({
        state: params.state,
      });
      return {
        writingPhase: writing.writingPhase,
        writingForm: writing.writingForm,
        writingReferenceState: writing.writingReferenceState,
      };
    })(),
    ...(() => {
      const researchFlat = readResearchTaskBucketFromSession({
        state: params.state,
      });
      const phase = researchFlat.current_phase ?? null;
      const theme = researchFlat.theme ?? null;
      const auto = researchFlat.auto_mode === true;
      return {
        researchCurrentPhase:
          typeof phase === "string" && phase.trim() ? phase.trim() : null,
        researchTheme:
          typeof theme === "string" && theme.trim() ? theme.trim() : null,
        researchAutoMode: auto,
      };
    })(),
    webPageFields: resolveWebPageFieldsFromRecord({ state: params.state }),
    applicationScanFields: resolveApplicationScanFieldsFromRecord({
      state: params.state,
    }),
    createdAt: updatedAt,
    updatedAt,
  };
};

export const subscribeAiStudioSessions = (): (() => void) => {
  let scope: { organizationId: string; spaceId: string };
  try {
    scope = resolveAdkSessionScope();
  } catch {
    cachedList.value = [];
    aiStudioSessionsReady.value = true;
    bumpRevision();
    return () => {};
  }

  const scopeKey = `${scope.organizationId}:${scope.spaceId}`;
  if (activeUnsubscribe && activeScopeKey === scopeKey) {
    return activeUnsubscribe;
  }
  activeUnsubscribe?.();
  activeScopeKey = scopeKey;
  aiStudioSessionsReady.value = false;

  const col = collection(
    getFirestore(),
    "organizations",
    scope.organizationId,
    "spaces",
    scope.spaceId,
    "adkSessions"
  );
  const q = query(
    col,
    where("status", "in", ["active", "completed"]),
    orderBy("updatedAt", "desc")
  );

  activeUnsubscribe = onSnapshot(
    q,
    (snap) => {
      const items: AiStudioSessionListItem[] = [];
      snap.forEach((docSnap) => {
        const item = mapDocToListItem(
          docSnap.id,
          docSnap.data() as Record<string, unknown>
        );
        if (item) {
          items.push(item);
        }
      });
      cachedList.value = items;
      aiStudioSessionsReady.value = true;
      bumpRevision();
    },
    (error) => {
      aiStudioSessionsReady.value = true;
      bumpRevision();
      log("ERROR", "[useAiStudioSessions] onSnapshot failed", error);
    }
  );

  return activeUnsubscribe;
};

let activeSessionUnsubscribe: (() => void) | null = null;
let activeSessionId: string | null = null;

export const subscribeActiveAdkSession = (params: {
  sessionId: string;
  onRecord: (record: AiStudioSessionRecord | null) => void;
}): (() => void) => {
  let scope: { organizationId: string; spaceId: string };
  try {
    scope = resolveAdkSessionScope();
  } catch {
    return () => {};
  }

  if (activeSessionId === params.sessionId && activeSessionUnsubscribe) {
    return activeSessionUnsubscribe;
  }
  activeSessionUnsubscribe?.();
  activeSessionId = params.sessionId;

  const ref = doc(
    getFirestore(),
    "organizations",
    scope.organizationId,
    "spaces",
    scope.spaceId,
    "adkSessions",
    params.sessionId
  );

  activeSessionUnsubscribe = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        params.onRecord(null);
        return;
      }
      params.onRecord(
        mapFirestoreDocToRecord({
          sessionId: snap.id,
          data: snap.data() as Record<string, unknown>,
        })
      );
    },
    (error) => {
      log("ERROR", "[subscribeActiveAdkSession] failed", error);
    }
  );

  return () => {
    activeSessionUnsubscribe?.();
    activeSessionUnsubscribe = null;
    activeSessionId = null;
  };
};

const sessionDocRef = (params: {
  organizationId: string;
  spaceId: string;
  sessionId: string;
}) =>
  doc(
    getFirestore(),
    "organizations",
    params.organizationId,
    "spaces",
    params.spaceId,
    "adkSessions",
    params.sessionId
  );

export const fetchAdkSessionState = async (
  sessionId: string
): Promise<Record<string, unknown> | null> => {
  try {
    const scope = resolveAdkSessionScope();
    const snap = await getDoc(
      sessionDocRef({
        organizationId: scope.organizationId,
        spaceId: scope.spaceId,
        sessionId,
      })
    );
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const state = data.state;
    return state && typeof state === "object"
      ? (state as Record<string, unknown>)
      : {};
  } catch (error) {
    log("WARN", "[useAiStudioSessions] fetchAdkSessionState failed", {
      sessionId,
      error,
    });
    return null;
  }
};

export const useAiStudioSessions = () => {
  const list = (): AiStudioSessionListItem[] => cachedList.value;

  const get = async (
    sessionId: string
  ): Promise<AiStudioSessionRecord | null> => {
    try {
      const scope = resolveAdkSessionScope();
      const snap = await getDoc(
        sessionDocRef({
          organizationId: scope.organizationId,
          spaceId: scope.spaceId,
          sessionId,
        })
      );
      if (!snap.exists()) return null;
      return mapFirestoreDocToRecord({
        sessionId: snap.id,
        data: snap.data() as Record<string, unknown>,
      });
    } catch (error) {
      log("WARN", "[useAiStudioSessions] firestore get failed", {
        sessionId,
        error,
      });
      return null;
    }
  };

  const create = async (
    init: Partial<AiStudioSessionRecord> & { sessionId: string }
  ): Promise<AiStudioSessionRecord> => {
    const now = Date.now();
    const jobKind = init.jobKind ?? null;
    const messages = init.messages ?? [];
    const record: AiStudioSessionRecord = {
      sessionId: init.sessionId,
      title: resolveSessionTitle({
        storedTitle: init.title,
        messages,
        jobKind,
      }),
      status: init.status ?? "active",
      jobKind,
      activeAgent: init.activeAgent ?? null,
      routingReason: init.routingReason ?? "",
      spreadsheetId: init.spreadsheetId ?? null,
      spreadsheetUrl: init.spreadsheetUrl ?? null,
      messages,
      groundingMetadataByResponseId: init.groundingMetadataByResponseId,
      consultationModel: init.consultationModel,
      imageCreationMode: init.imageCreationMode,
      imageReferenceState: init.imageReferenceState,
      imageModeSelected: init.imageModeSelected ?? false,
      sheetModeSelected: init.sheetModeSelected ?? false,
      targetSheetName: init.targetSheetName ?? null,
      targetSheetGid: init.targetSheetGid ?? null,
      writingPhase: init.writingPhase,
      writingForm: init.writingForm,
      writingReferenceState: init.writingReferenceState,
      researchCurrentPhase: init.researchCurrentPhase ?? null,
      researchTheme: init.researchTheme ?? null,
      researchAutoMode: init.researchAutoMode,
      webPageFields: init.webPageFields,
      applicationScanFields: init.applicationScanFields,
      createdAt: init.createdAt ?? now,
      updatedAt: init.updatedAt ?? now,
    };
    const scope = resolveAdkSessionScope();
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error("ログイン状態ではありません");
    const enAiStudioUi = buildSessionPatchContext(record);
    await setDoc(
      sessionDocRef({
        organizationId: scope.organizationId,
        spaceId: scope.spaceId,
        sessionId: record.sessionId,
      }),
      {
        uid,
        sessionId: record.sessionId,
        appName: EN_AISTUDIO_ADK_APP_NAME,
        organizationId: scope.organizationId,
        spaceId: scope.spaceId,
        state: buildAiStudioFirestoreSessionState({
          enAiStudioUi,
          jobKind: record.jobKind,
          activeAgent: record.activeAgent,
          consultationModel: record.consultationModel,
          imageCreationMode: record.imageCreationMode,
          imageReferenceState: record.imageReferenceState,
          imageModeSelected: record.imageModeSelected,
          sheetConnection: sheetConnectionFromRecord(record),
          imageStudio: record.imageStudio,
          writingPhase: record.writingPhase,
          writingForm: record.writingForm,
          writingReferenceState: record.writingReferenceState,
          research:
            record.jobKind === "research"
              ? {
                  currentPhase: record.researchCurrentPhase ?? null,
                  theme: record.researchTheme ?? null,
                  autoMode: record.researchAutoMode === true,
                  briefing: null,
                }
              : undefined,
          webPage:
            record.jobKind === "web_page" ? record.webPageFields : undefined,
          applicationScan:
            record.jobKind === "application_scan"
              ? record.applicationScanFields
              : undefined,
        }),
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastUpdateTime: Date.now() / 1000,
        ...denormalizedSessionDocFields(record),
      },
      { merge: true }
    );
    bumpRevision();
    return record;
  };

  const update = async (
    sessionId: string,
    patch: Partial<Omit<AiStudioSessionRecord, "sessionId">>
  ): Promise<AiStudioSessionRecord | null> => {
    const cur = await get(sessionId);
    if (!cur) {
      if (!patch.messages?.length) {
        return null;
      }
      return create({
        sessionId,
        ...patch,
        messages: patch.messages ?? [],
      });
    }
    const messages = patch.messages ?? cur.messages;
    const jobKind = patch.jobKind ?? cur.jobKind;
    const next: AiStudioSessionRecord = {
      ...cur,
      ...patch,
      sessionId: cur.sessionId,
      title: resolveSessionTitle({
        storedTitle: patch.title ?? cur.title,
        messages,
        jobKind,
      }),
      messages,
      updatedAt: Date.now(),
    };
    const scope = resolveAdkSessionScope();
    const enAiStudioUi = buildSessionPatchContext(next);
    await setDoc(
      sessionDocRef({
        organizationId: scope.organizationId,
        spaceId: scope.spaceId,
        sessionId: next.sessionId,
      }),
      {
        state: buildAiStudioFirestoreSessionState({
          enAiStudioUi,
          jobKind: next.jobKind,
          activeAgent: next.activeAgent,
          consultationModel: next.consultationModel,
          imageCreationMode: next.imageCreationMode,
          imageReferenceState: next.imageReferenceState,
          imageModeSelected: next.imageModeSelected,
          sheetConnection: sheetConnectionFromRecord(next),
          imageStudio: next.imageStudio,
          writingPhase: next.writingPhase,
          writingForm: next.writingForm,
          writingReferenceState: next.writingReferenceState,
          research:
            next.jobKind === "research"
              ? {
                  currentPhase: next.researchCurrentPhase ?? null,
                  theme: next.researchTheme ?? null,
                  autoMode: next.researchAutoMode === true,
                  briefing: null,
                }
              : undefined,
          webPage:
            next.jobKind === "web_page" ? next.webPageFields : undefined,
          applicationScan:
            next.jobKind === "application_scan"
              ? next.applicationScanFields
              : undefined,
        }),
        updatedAt: serverTimestamp(),
        lastUpdateTime: Date.now() / 1000,
        ...denormalizedSessionDocFields(next),
      },
      { merge: true }
    );
    bumpRevision();
    return next;
  };

  const remove = async (sessionId: string): Promise<void> => {
    const scope = resolveAdkSessionScope();
    await updateDoc(
      sessionDocRef({
        organizationId: scope.organizationId,
        spaceId: scope.spaceId,
        sessionId,
      }),
      { status: "deleted", updatedAt: serverTimestamp() }
    );
    bumpRevision();
  };

  return {
    list,
    get,
    create,
    update,
    remove,
    deriveTitle,
    resolveSessionTitle,
    defaultTitleForJob,
    subscribe: subscribeAiStudioSessions,
    subscribeActive: subscribeActiveAdkSession,
  };
};
