/**
 * AI Studio store — 共通 AI Workspace の状態管理.
 *
 * 設計:
 *  - 4 ジョブ (writing / sheet / image / consultation) を 1 つの Workspace で扱う
 *  - 1 ターン目だけ Concierge (フロント Gemini) で target agent を決定
 *  - 対話 invoke は RequestDoc → Firebase Functions → ADK（ブラウザから ADK REST しない）
 *  - セッション表示は Firestore `adkSessions` の onSnapshot
 *  - research ジョブは別 store (useResearchAgentStore) に委譲
 */
import { defineStore } from "pinia";
import { useResearchAgentStore } from "@stores/researchAgent";
import log from "@utils/logger";
import {
  resolveAdkSessionScope,
  tryResolveAdkSessionScope,
} from "@composables/useAdkSessionScope";
import {
  subscribeActiveAdkSession,
  useAiStudioSessions,
  type AiStudioSessionRecord,
} from "@composables/useAiStudioSessions";
import { subscribeSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import type { AgentSseArtifact, AgentSseActivity } from "@composables/useAgentSseClient";
import {
  createAdkInvokeRequest,
  isAdkInvokeViaRequestDocEnabled,
  watchAdkInvokeRequest,
} from "@composables/useAdkInvokeRequest";
import { buildAdkInvokeInput } from "@utils/adkInvokeInputBuilder";
import { getAuth } from "firebase/auth";
import type { AttachedFile } from "@adapters/masterEditor/types";
import type { SelectedKnowledgeRef } from "@utils/consultationKnowledge";
import { toApiSelectedKnowledge } from "@utils/consultationKnowledge";
import type { AdkAgentMode, AgentSseHistoryTurn } from "@composables/useAgentSseClient";
import { countPanelPrimaryArtifacts } from "@utils/workspaceArtifactMeta";
import {
  useConciergeRouter,
  type ConciergeTargetAgent,
} from "@composables/useConciergeRouter";
import { generateAiStudioSessionTitle } from "@composables/useAiStudioSessionTitle";
import {
  isAiStudioWorkspaceMode,
  resolveAiStudioPanelTitle,
} from "@constants/aiStudioModes";
import { CONSULTATION_DEFAULT_LLM_MODEL } from "@constants/consultationLlmModels";
import type { LlmModelSelection } from "@models/llmModelSelection";
import {
  defaultLlmModelSelectionForAdkMode,
} from "@models/llmModelSelection";
import type { ConsultationSourceReference } from "@utils/consultationSourceReferences";
import { GEMINI_BYOK_SETUP_MESSAGE, useGeminiByokStore } from "@stores/gemini-byok";
import {
  OPENAI_BYOK_SETUP_MESSAGE,
  useOpenaiByokStore,
} from "@stores/openai-byok";
import { stabilizeImageArtifact } from "@utils/adkArtifactUrl";
import {
  coalesceImageReferenceState,
  emptyImageReferenceState,
  normalizeImageReferenceState,
  referenceImagesForAdkInvoke,
  referenceImagesHaveResolvableStorage,
  reconcileImageSessionUiFromRecord,
  shouldPreserveLocalImageFieldsOnHydrate,
  type ImageCreationMode,
  type ImageReferenceState,
} from "@utils/imageReference";
import {
  groundingToSourceReferences,
  mergeGroundingMetadata,
  type AdkGroundingMetadata,
} from "@utils/adkGrounding";
import type { SheetConnectionFields } from "@utils/sheetWorkspaceState";
import {
  imagePrimaryHasReference,
  findLatestImagePrimaryInMessages,
  sanitizeAssistantImageMarkdown,
  primaryFromImageArtifact,
  type ImageRetouchRegion,
  type ImageStudioFields,
  type ImageWorkflowPhase,
} from "@utils/imageStudioState";
import {
  buildInvokeModeStateFromWorkspaceState,
  buildWorkspaceSessionState,
  type WorkspaceTaskKey,
} from "@utils/workspaceSessionBuckets";
import type {
  WritingFormState,
  WritingInvokeAction,
  WritingPhase,
  WritingReferenceState,
} from "@models/writingForm";
import {
  writingGoldenToEffectiveFlat,
} from "@utils/goldenTaskBucket";
import {
  WRITING_PHASE_DEFAULT,
  buildWritingGenerateDocumentPrompt,
  coalesceWritingReferenceState,
  emptyWritingFormState,
  emptyWritingReferenceState,
  findLatestWritingJsonArtifact,
  mergeWritingFormValuesFromJsonArtifact,
  mergeWritingFieldsWithJsonPayload,
  normalizeWritingFormState,
  normalizeWritingReferenceState,
  parseWritingJsonPayload,
  recomputeWritingReferenceState,
  shouldPreserveLocalWritingReferenceOnHydrate,
  writingModeStateToApi,
} from "@utils/writingWorkspaceState";
import {
  buildWebPageInitialPrompt,
  emptyWebPageBuilderFields,
  type WebPageBuilderFields,
} from "@utils/webPageWorkspaceState";
import {
  buildApplicationScanInitialPrompt,
  emptyApplicationScanFields,
  type ApplicationScanFields,
} from "@utils/applicationScanWorkspaceState";
import { fetchArtifactTextContent } from "@utils/artifactDisplayUrl";
import { dedupeActivitiesForDisplay } from "@utils/adkToolActivities";
import { useAdkSessionArtifacts } from "@composables/useAdkSessionArtifacts";

/** Workspace で扱う「ジョブ種別」 — ハブのカードと対応. */
export type AiStudioJobKind =
  | "writing"
  | "sheet"
  | "image"
  | "consultation"
  | "research"
  | "data_analysis"
  | "web_page"
  | "application_scan"
  | null;

/** 実際に SSE 接続している Agent. research は別 store なので含まない. */
export type AiStudioActiveAgent = AdkAgentMode | null;

export interface AiStudioMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  /** assistant 応答完了時刻 (表示用) */
  completedAt?: number;
  isStreaming?: boolean;
  /** この応答が来た Agent (UI 表示用) */
  agent?: AdkAgentMode;
  artifacts?: AgentSseArtifact[];
  activities?: AgentSseActivity[];
  sourceReferences?: ConsultationSourceReference[];
  groundingMetadata?: AdkGroundingMetadata;
}

const applyGroundingToMessage = (params: {
  messages: AiStudioMessage[];
  responseId: string;
  payload: AdkGroundingMetadata;
}): { messages: AiStudioMessage[]; merged: AdkGroundingMetadata } => {
  const { messages, responseId, payload } = params;
  const index = messages.findIndex((message) => message.id === responseId);
  if (index < 0) {
    return { messages, merged: payload };
  }
  const current = messages[index]!;
  const merged = mergeGroundingMetadata({
    base: current.groundingMetadata as AdkGroundingMetadata | undefined,
    incoming: payload,
  });
  const next = [...messages];
  next[index] = {
    ...current,
    groundingMetadata: merged,
    sourceReferences: groundingToSourceReferences(merged),
  };
  return { messages: next, merged };
};

const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const formatErrorForDisplay = (raw: unknown): string => {
  const message =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : JSON.stringify(raw);
  if (
    message.includes("RESOURCE_EXHAUSTED") ||
    /\"code\":\s*429/.test(message) ||
    message.includes("monthly spending cap")
  ) {
    return [
      "⚠️ **Gemini API の利用上限に達しました**",
      "",
      "Google AI Studio で月次 spending cap を超過しています.",
      "- [AI Studio で上限を確認](https://aistudio.google.com/apikey)",
      "- 設定 → AI 連携 で別の API キーに切り替え",
    ].join("\n");
  }
  if (/GEMINI_API_KEY_NOT_REGISTERED/i.test(message)) {
    return GEMINI_BYOK_SETUP_MESSAGE;
  }
  if (/OPENAI_API_KEY_NOT_REGISTERED/i.test(message)) {
    return OPENAI_BYOK_SETUP_MESSAGE;
  }
  if (/WRITING_REFERENCE_REQUIRED|WRITING_REFERENCE_NOT_CONFIRMED/i.test(message)) {
    return "参考資料を追加し、「参照を確定」してから続行してください。";
  }
  if (/WRITING_PHASE_NOT_FILLING|WRITING_REQUIRED_VALUES_MISSING/i.test(message)) {
    return "フォーマットを確定し、必須項目をすべて入力してから「入力開始」してください。";
  }
  if (/WRITING_ACTION_REQUIRED/i.test(message)) {
    return "文書モードでは画面のボタンから操作してください。";
  }
  if (/No API key was provided/i.test(message)) {
    if (useGeminiByokStore().hasApiKey) {
      return "Gemini API キーは登録済みですが、エージェント実行時にキーを渡せませんでした。ページを再読み込みして再試行してください。";
    }
    return GEMINI_BYOK_SETUP_MESSAGE;
  }
  if (
    message.includes("API key not valid") ||
    message.includes("PERMISSION_DENIED")
  ) {
    return [
      "⚠️ **API キーが無効か権限がありません**",
      "",
      "設定 → AI 連携 から有効な Gemini API キーを登録してください.",
    ].join("\n");
  }
  const innerMatch = message.match(/\"message\":\s*\"([^\"]{5,300})\"/);
  if (innerMatch && innerMatch[1]) return `⚠️ エラー: ${innerMatch[1]}`;
  const trimmed = message.length > 400 ? `${message.slice(0, 400)}...` : message;
  return `⚠️ エラー: ${trimmed}`;
};

export const useAiStudioStore = defineStore("aiStudio", {
  state: () => ({
    /** Workspace を開いた時に確定する Cloud Run セッション ID */
    sessionId: null as string | null,
    /** ハブで選択された job kind. null = まだ何も選んでいない. */
    jobKind: null as AiStudioJobKind,
    /** Concierge 判定後の確定 Agent (research は扱わない) */
    activeAgent: null as AiStudioActiveAgent,
    /** Concierge が選んだ理由 (UI ヘッダの吹き出し用) */
    routingReason: "" as string,
    /** sheet モードで操作対象 spreadsheet */
    spreadsheetId: null as string | null,
    spreadsheetUrl: null as string | null,
    messages: [] as AiStudioMessage[],
    isStreaming: false,
    lastError: null as string | null,
    abortController: null as AbortController | null,
    /** Firestore adkSessions 単一 doc 購読の解除 */
    activeSessionUnsubscribe: null as (() => void) | null,
    /** assistant message id → full grounding_metadata (session 永続化用) */
    groundingMetadataByResponseId: {} as Record<string, AdkGroundingMetadata>,
    /** 経営相談モードの LLM 選択 (ADK invoke / RequestDoc input.model) */
    consultationModel: CONSULTATION_DEFAULT_LLM_MODEL as LlmModelSelection,
    /** 画像モード: リファレンス添付ステータス */
    imageReferenceState: emptyImageReferenceState() as ImageReferenceState,
    /** 画像モード: 新規生成 or お手本編集（未選択時は UI で選ばせる） */
    imageCreationMode: null as ImageCreationMode | null,
    /** 画像モード: 0から / お手本 を UI で確定済みか（未確定時は送信・ADK 不可） */
    imageModeSelected: false,
    /** シートモード: URL + タブ名を UI で確定済みか */
    sheetModeSelected: false,
    targetSheetName: null as string | null,
    targetSheetGid: null as number | null,
    /** 画像スタジオ: create（OpenAI 初稿） / retouch（Gemini 修正） */
    imageWorkflowPhase: "create" as ImageWorkflowPhase,
    primaryArtifactId: null as string | null,
    primaryAdkFilename: null as string | null,
    primaryArtifactVersion: null as number | null,
    retouchRegions: [] as ImageRetouchRegion[],
    /** 文書モード: format_review | filling | done */
    writingPhase: WRITING_PHASE_DEFAULT as WritingPhase,
    writingForm: emptyWritingFormState() as WritingFormState,
    writingReferenceState: emptyWritingReferenceState() as WritingReferenceState,
    webPageFields: emptyWebPageBuilderFields() as WebPageBuilderFields,
    applicationScanFields: emptyApplicationScanFields() as ApplicationScanFields,
  }),
  getters: {
    hasMessages: (state) => state.messages.length > 0,
    /** 右ペインに表示する成果物の件数（引用・空ブロックは除く） */
    artifactCount: (state): number =>
      countPanelPrimaryArtifacts({ messages: state.messages }),
    /** 右ペイン用の成果物が 1 件以上ある */
    shouldShowArtifactPanel: (state): boolean =>
      state.activeAgent !== "writing" &&
      countPanelPrimaryArtifacts({ messages: state.messages }) > 0,
    /** レタッチ手動 ON 用: セッションに画像成果物がある */
    hasRetouchableImageArtifact: (state): boolean =>
      findLatestImagePrimaryInMessages({ messages: state.messages }) != null,
    /** UI ヘッダのモード表示用（短いラベル） */
    activeAgentLabel: (state): string =>
      resolveAiStudioPanelTitle(state.activeAgent),
  },
  actions: {
    /** 1 ターン目のユーザープロンプトから履歴タイトルを生成して Firestore に反映 */
    async applyFirstTurnSessionTitle(firstUserPrompt: string): Promise<void> {
      if (!this.sessionId) return;
      const userCount = this.messages.filter((m) => m.role === "user").length;
      if (userCount !== 1) return;

      const sessionId = this.sessionId;
      const jobKind = this.jobKind;
      const title = await generateAiStudioSessionTitle(firstUserPrompt, jobKind);
      if (this.sessionId !== sessionId) return;

      const sessions = useAiStudioSessions();
      const existing = await sessions.get(sessionId);
      if (!existing) return;
      await sessions.update(sessionId, { title });
    },

    ensureActiveSessionSubscription(): void {
      if (!this.sessionId) return;
      this.activeSessionUnsubscribe?.();
      const stopSession = subscribeActiveAdkSession({
        sessionId: this.sessionId,
        onRecord: (record) => {
          if (!record || record.sessionId !== this.sessionId) return;
          if (this.isStreaming) {
            this.mergeRecordWhileStreaming(record);
            return;
          }
          this.hydrateFromRecord(record);
        },
      });
      const stopArtifacts = subscribeSessionArtifacts({
        sessionId: this.sessionId,
        onUpdate: () => {
          if (this.activeAgent === "writing") {
            void this.syncWritingFormFromJsonArtifact();
          }
        },
      });
      this.activeSessionUnsubscribe = () => {
        stopSession();
        stopArtifacts();
      };
    },

    /** 現在の workspace 状態を Firestore (en-aistudio_ui) に書き戻す */
    async persistCurrentSession(): Promise<void> {
      if (!this.sessionId) return;
      if (!tryResolveAdkSessionScope()) return;
      const sessions = useAiStudioSessions();
      const existing = await sessions.get(this.sessionId);
      const sid = this.sessionId;
      const messagesForStorage = this.messages.map((message) => {
        if (!message.artifacts?.length) return message;
        return {
          ...message,
          artifacts: message.artifacts.map((artifact) =>
            stabilizeImageArtifact(artifact, sid)
          ),
        };
      });
      const payload: Partial<AiStudioSessionRecord> = {
        jobKind: this.jobKind,
        activeAgent: this.activeAgent,
        routingReason: this.routingReason,
        spreadsheetId: this.spreadsheetId,
        spreadsheetUrl: this.spreadsheetUrl,
        messages: messagesForStorage,
        groundingMetadataByResponseId: { ...this.groundingMetadataByResponseId },
        consultationModel: this.consultationModel,
        imageReferenceState: (() => {
          const ref = coalesceImageReferenceState(this.imageReferenceState);
          return {
            ...ref,
            references: [...ref.references],
          };
        })(),
        imageCreationMode: this.imageCreationMode,
        imageModeSelected: this.imageModeSelected,
        sheetModeSelected: this.sheetModeSelected,
        targetSheetName: this.targetSheetName,
        targetSheetGid: this.targetSheetGid,
        imageWorkflowPhase: this.imageWorkflowPhase,
        primaryArtifactId: this.primaryArtifactId,
        primaryAdkFilename: this.primaryAdkFilename,
        primaryArtifactVersion: this.primaryArtifactVersion,
        retouchRegions: this.retouchRegions,
        imageStudio: this.imageStudioFields(),
        writingPhase: this.writingPhase,
        writingForm: { ...this.writingForm, fields: [...this.writingForm.fields] },
        writingReferenceState: (() => {
          const ref = coalesceWritingReferenceState(this.writingReferenceState);
          return {
            ...ref,
            attachments: [...ref.attachments],
            selectedKnowledge: [...ref.selectedKnowledge],
          };
        })(),
        webPageFields: {
          ...this.webPageFields,
          referenceUrls: [...this.webPageFields.referenceUrls],
        },
        applicationScanFields: {
          ...this.applicationScanFields,
          includePatterns: [...this.applicationScanFields.includePatterns],
          excludePatterns: [...this.applicationScanFields.excludePatterns],
        },
        status: this.isStreaming ? "active" : "active",
      };
      if (existing) {
        await sessions.update(this.sessionId, payload);
      } else {
        await sessions.create({
          sessionId: this.sessionId,
          jobKind: this.jobKind,
          activeAgent: this.activeAgent,
          routingReason: this.routingReason,
          spreadsheetId: this.spreadsheetId,
          spreadsheetUrl: this.spreadsheetUrl,
          messages: messagesForStorage,
          ...payload,
        });
      }
    },

    /** Invoke 中の Firestore 更新 — メッセージだけ同期し画像スタジオ状態は上書きしない */
    mergeRecordWhileStreaming(record: AiStudioSessionRecord): void {
      const preserveStudio = this.imageWorkflowPhase === "retouch";
      const studioSnapshot = preserveStudio
        ? {
            imageWorkflowPhase: this.imageWorkflowPhase,
            primaryArtifactId: this.primaryArtifactId,
            primaryAdkFilename: this.primaryAdkFilename,
            primaryArtifactVersion: this.primaryArtifactVersion,
            retouchRegions: [...this.retouchRegions],
          }
        : null;

      this.messages = record.messages.map((message) => ({
        ...message,
        text:
          message.role === "assistant"
            ? sanitizeAssistantImageMarkdown({
                text: message.text,
                artifacts: message.artifacts,
              })
            : message.text,
        activities: message.activities?.length
          ? dedupeActivitiesForDisplay(message.activities)
          : message.activities,
        groundingMetadata:
          message.groundingMetadata ??
          this.groundingMetadataByResponseId[message.id],
      }));

      if (studioSnapshot) {
        this.imageWorkflowPhase = studioSnapshot.imageWorkflowPhase;
        this.primaryArtifactId = studioSnapshot.primaryArtifactId;
        this.primaryAdkFilename = studioSnapshot.primaryAdkFilename;
        this.primaryArtifactVersion = studioSnapshot.primaryArtifactVersion;
        this.retouchRegions = studioSnapshot.retouchRegions;
      } else {
        this.syncPrimaryFromLatestImageArtifact();
      }

      if (this.activeAgent === "writing") {
        this.applyWritingFieldsFromSessionRecord(record);
      }
    },

    /** Firestore / en-aistudio_ui の writing バケットを Pinia に反映（ツール結果のエコー） */
    applyWritingFieldsFromSessionRecord(record: AiStudioSessionRecord): void {
      const nextForm = normalizeWritingFormState(record.writingForm);
      const nextPhase = record.writingPhase ?? WRITING_PHASE_DEFAULT;
      const phaseOrder: Record<WritingPhase, number> = {
        format_review: 0,
        filling: 1,
        done: 2,
      };
      if (
        nextForm.fields.length > this.writingForm.fields.length ||
        (nextForm.fields.length > 0 && this.writingForm.fields.length < 1) ||
        nextForm.fields.some((field, index) => {
          const current = this.writingForm.fields[index];
          const nextValue = (field.value ?? "").trim();
          const currentValue = (current?.value ?? "").trim();
          return nextValue.length > 0 && nextValue !== currentValue;
        })
      ) {
        this.writingForm = nextForm;
      }
      if (phaseOrder[nextPhase] > phaseOrder[this.writingPhase]) {
        this.writingPhase = nextPhase;
      }
    },

    /** json_document Artifact (GCS → Firestore onSnapshot) からフォーム value を同期 */
    async syncWritingFormFromJsonArtifact(): Promise<void> {
      const artifact = findLatestWritingJsonArtifact({ messages: this.messages });
      if (!artifact) return;

      if (artifact.body?.trim()) {
        this.writingForm = mergeWritingFormValuesFromJsonArtifact({
          form: this.writingForm,
          artifacts: [artifact],
        });
        return;
      }

      const artifactId = artifact.artifactId?.trim();
      if (!artifactId) return;

      const record = useAdkSessionArtifacts().getArtifact({ artifactId });
      if (!record?.storageGcsPath?.trim() || record.status !== "ready") return;

      const body = await fetchArtifactTextContent({
        storageGcsPath: record.storageGcsPath,
        contentType: record.contentType,
      });
      if (!body?.trim()) return;

      const payload = parseWritingJsonPayload(body);
      if (Object.keys(payload).length < 1) return;

      this.writingForm = {
        ...this.writingForm,
        fields: mergeWritingFieldsWithJsonPayload({
          fields: this.writingForm.fields,
          payload,
        }),
      };
    },

    hydrateFromRecord(record: AiStudioSessionRecord): void {
      const priorSessionId = this.sessionId;
      this.sessionId = record.sessionId;
      this.jobKind = record.jobKind;
      this.activeAgent = record.activeAgent;
      this.routingReason = record.routingReason;
      this.spreadsheetId = record.spreadsheetId;
      this.spreadsheetUrl = record.spreadsheetUrl;
      this.groundingMetadataByResponseId = {
        ...(record.groundingMetadataByResponseId ?? {}),
      };
      this.consultationModel =
        record.consultationModel ?? CONSULTATION_DEFAULT_LLM_MODEL;
      const fromRecordImageRef = normalizeImageReferenceState(
        record.imageReferenceState ?? emptyImageReferenceState()
      );
      const fromRecordImageModeSelected = record.imageModeSelected === true;
      const fromRecordImageCreationMode = record.imageCreationMode ?? null;
      const preserveImage =
        priorSessionId === record.sessionId &&
        shouldPreserveLocalImageFieldsOnHydrate({
          local: {
            imageModeSelected: this.imageModeSelected,
            imageCreationMode: this.imageCreationMode,
            imageReferenceState: coalesceImageReferenceState(
              this.imageReferenceState
            ),
          },
          fromRecord: {
            imageModeSelected: fromRecordImageModeSelected,
            imageCreationMode: fromRecordImageCreationMode,
            imageReferenceState: fromRecordImageRef,
          },
        });
      if (preserveImage) {
        this.imageModeSelected = this.imageModeSelected || fromRecordImageModeSelected;
        this.imageCreationMode =
          this.imageCreationMode ?? fromRecordImageCreationMode;
        this.imageReferenceState = coalesceImageReferenceState(
          this.imageReferenceState
        );
      } else {
        this.imageReferenceState = fromRecordImageRef;
        this.imageCreationMode = fromRecordImageCreationMode;
        this.imageModeSelected = fromRecordImageModeSelected;
      }
      this.sheetModeSelected = record.sheetModeSelected === true;
      this.targetSheetName = record.targetSheetName ?? null;
      this.targetSheetGid = record.targetSheetGid ?? null;
      if (!this.sheetModeSelected) {
        this.spreadsheetId = null;
        this.spreadsheetUrl = null;
        this.targetSheetName = null;
        this.targetSheetGid = null;
      }
      const studio = record.imageStudio;
      this.imageWorkflowPhase = studio?.imageWorkflowPhase ?? "create";
      this.primaryArtifactId = studio?.primaryArtifact.artifactId ?? null;
      this.primaryAdkFilename = studio?.primaryArtifact.adkFilename ?? null;
      this.primaryArtifactVersion = studio?.primaryArtifact.artifactVersion ?? null;
      this.retouchRegions = studio?.retouchRegions ?? [];
      this.writingPhase = record.writingPhase ?? WRITING_PHASE_DEFAULT;
      this.writingForm = normalizeWritingFormState(record.writingForm);
      const fromRecord = normalizeWritingReferenceState(record.writingReferenceState);
      this.writingReferenceState = shouldPreserveLocalWritingReferenceOnHydrate({
        local: this.writingReferenceState,
        fromRecord,
      })
        ? coalesceWritingReferenceState(this.writingReferenceState)
        : fromRecord;
      this.webPageFields = record.webPageFields ?? emptyWebPageBuilderFields();
      this.applicationScanFields =
        record.applicationScanFields ?? emptyApplicationScanFields();
      this.messages = record.messages.map((message) => ({
        ...message,
        text:
          message.role === "assistant"
            ? sanitizeAssistantImageMarkdown({
                text: message.text,
                artifacts: message.artifacts,
              })
            : message.text,
        activities: message.activities?.length
          ? dedupeActivitiesForDisplay(message.activities)
          : message.activities,
        groundingMetadata:
          message.groundingMetadata ??
          this.groundingMetadataByResponseId[message.id],
      }));
      const reconciledImageUi = reconcileImageSessionUiFromRecord({
        activeAgent: record.activeAgent,
        jobKind: record.jobKind,
        messages: this.messages,
        imageCreationMode: fromRecordImageCreationMode,
        imageReferenceState: fromRecordImageRef,
        imageStudio: studio,
        imageModeSelected: this.imageModeSelected,
      });
      this.imageModeSelected = reconciledImageUi.imageModeSelected;
      this.imageCreationMode = reconciledImageUi.imageCreationMode;
      this.imageReferenceState = reconciledImageUi.imageReferenceState;
      this.lastError = null;
      this.isStreaming = false;
      this.abortController = null;
    },

    /**
     * サイドバーから過去セッションを開く.
     */
    async loadSession(sessionId: string): Promise<boolean> {
      const sessions = useAiStudioSessions();
      const record = await sessions.get(sessionId);
      if (!record) return false;
      this.cancelStream();
      if (record.jobKind === "research") {
        const research = useResearchAgentStore();
        await research.resumeSession(sessionId);
        this.sessionId = sessionId;
        this.jobKind = "research";
        this.activeAgent = "research";
        this.routingReason = record.routingReason || "ユーザーがジョブを選択";
        this.messages = [];
        this.lastError = null;
        this.isStreaming = false;
        return true;
      }
      if (this.sessionId !== sessionId) {
        this.imageModeSelected = false;
        this.imageCreationMode = null;
        this.imageReferenceState = emptyImageReferenceState();
      }
      this.hydrateFromRecord(record);
      this.ensureActiveSessionSubscription();
      return true;
    },

    /**
     * ハブカードクリックや「とりあえず話す」起動時の初期化.
     * @param preferredKind ハブで選択した job kind (null = 「とりあえず話す」)
     */
    async startSession(preferredKind: AiStudioJobKind = null): Promise<void> {
      const scope = resolveAdkSessionScope();
      this.resetWorkspaceState();
      this.sessionId = createId();
      this.jobKind = preferredKind;

      if (preferredKind === "research") {
        this.activeAgent = "research";
        this.routingReason = "ユーザーがジョブを選択";
        const research = useResearchAgentStore();
        research.prepareNewSession({ sessionId: this.sessionId });
        const sessions = useAiStudioSessions();
        await sessions.create({
          sessionId: this.sessionId,
          jobKind: "research",
          activeAgent: "research",
          routingReason: this.routingReason,
          messages: [],
          researchCurrentPhase: "phase1_hearing",
        });
        log("INFO", "[aiStudio] research session created", {
          sessionId: this.sessionId,
        });
        return;
      }

      if (
        preferredKind &&
        [
          "writing",
          "sheet",
          "image",
          "consultation",
          "data_analysis",
          "web_page",
          "application_scan",
        ].includes(preferredKind)
      ) {
        this.activeAgent = preferredKind as AdkAgentMode;
        this.routingReason = "ユーザーがジョブを選択";
        if (preferredKind === "writing") {
          this.resetWritingWorkflow();
        }
        if (preferredKind === "web_page") {
          this.resetWebPageBuilder();
        }
        if (preferredKind === "application_scan") {
          this.resetApplicationScan();
        }
      }
      const sessions = useAiStudioSessions();
      await sessions.create({
        sessionId: this.sessionId,
        jobKind: this.jobKind,
        activeAgent: this.activeAgent,
        routingReason: this.routingReason,
        messages: [],
      });
      log("INFO", "[aiStudio] session created on server", {
        sessionId: this.sessionId,
        organizationId: scope.organizationId,
        spaceId: scope.spaceId,
      });
      this.ensureActiveSessionSubscription();
    },

    /**
     * 同じジョブ文脈で新しい会話を開始 (サイドバー「新規」).
     */
    async startNewConversation(): Promise<void> {
      const scope = resolveAdkSessionScope();
      await this.persistCurrentSession();
      this.cancelStream();
      const kind = this.jobKind;
      this.messages = [];
      this.lastError = null;
      this.groundingMetadataByResponseId = {};
      this.sessionId = createId();
      if (
        kind &&
        kind !== "research" &&
        [
          "writing",
          "sheet",
          "image",
          "consultation",
          "data_analysis",
          "web_page",
          "application_scan",
        ].includes(kind)
      ) {
        this.activeAgent = kind as AdkAgentMode;
        this.routingReason = "ユーザーがジョブを選択";
      } else {
        this.activeAgent = null;
        this.routingReason = "";
      }
      this.spreadsheetId = null;
      this.spreadsheetUrl = null;
      this.consultationModel = CONSULTATION_DEFAULT_LLM_MODEL;
      this.imageReferenceState = emptyImageReferenceState();
      this.imageCreationMode = null;
      this.imageModeSelected = false;
      this.sheetModeSelected = false;
      this.targetSheetName = null;
      this.targetSheetGid = null;
      this.resetImageStudioToCreate();
      this.resetWritingWorkflow();
      this.resetWebPageBuilder();
      this.resetApplicationScan();
      await useAiStudioSessions().create({
        sessionId: this.sessionId,
        jobKind: this.jobKind,
        activeAgent: this.activeAgent,
        routingReason: this.routingReason,
        messages: [],
      });
      log("INFO", "[aiStudio] new conversation session created", {
        sessionId: this.sessionId,
        organizationId: scope.organizationId,
        spaceId: scope.spaceId,
      });
    },

    async deleteSession(sessionId: string): Promise<void> {
      await useAiStudioSessions().remove(sessionId);
      if (this.sessionId === sessionId) {
        await this.startNewConversation();
      }
    },

    /** ハブに戻る — workspace を閉じる */
    async reset(): Promise<void> {
      await this.persistCurrentSession();
      this.resetWorkspaceState();
      this.sessionId = null;
      this.jobKind = null;
    },

    resetWorkspaceState(): void {
      this.activeAgent = null;
      this.routingReason = "";
      this.spreadsheetId = null;
      this.spreadsheetUrl = null;
      this.messages = [];
      this.groundingMetadataByResponseId = {};
      this.lastError = null;
      this.abortController?.abort();
      this.abortController = null;
      this.isStreaming = false;
      this.consultationModel = CONSULTATION_DEFAULT_LLM_MODEL;
      this.imageReferenceState = emptyImageReferenceState();
      this.imageCreationMode = null;
      this.imageModeSelected = false;
      this.sheetModeSelected = false;
      this.targetSheetName = null;
      this.targetSheetGid = null;
      this.resetImageStudioToCreate();
      this.resetWritingWorkflow();
      this.resetWebPageBuilder();
    },

    resetWritingWorkflow(): void {
      this.writingPhase = WRITING_PHASE_DEFAULT;
      this.writingForm = emptyWritingFormState();
      this.writingReferenceState = emptyWritingReferenceState();
    },

    resetWebPageBuilder(): void {
      this.webPageFields = emptyWebPageBuilderFields();
    },

    resetApplicationScan(): void {
      this.applicationScanFields = emptyApplicationScanFields();
    },

    async startWebPageBuilder(fields: WebPageBuilderFields): Promise<void> {
      this.webPageFields = {
        purpose: fields.purpose,
        pageType: fields.pageType,
        referenceUrls: [...fields.referenceUrls].slice(0, 3),
      };
      this.activeAgent = "web_page";
      this.jobKind = "web_page";
      await this.persistCurrentSession();
      await this.send(buildWebPageInitialPrompt(this.webPageFields));
    },

    async startApplicationScan(fields: ApplicationScanFields): Promise<void> {
      this.applicationScanFields = {
        ...fields,
        includePatterns: [...fields.includePatterns],
        excludePatterns: [...fields.excludePatterns],
      };
      this.activeAgent = "application_scan";
      this.jobKind = "application_scan";
      await this.persistCurrentSession();
      await this.send(buildApplicationScanInitialPrompt(this.applicationScanFields));
    },

    initWritingWorkflowIfNeeded(): void {
      if (this.activeAgent !== "writing" && this.jobKind !== "writing") return;
      const ref = coalesceWritingReferenceState(this.writingReferenceState);
      this.writingReferenceState = ref;
      if (ref.status === "complete") return;
      this.writingPhase = WRITING_PHASE_DEFAULT;
    },

    /** 参考資料を確定（UI の「参照を確定」） */
    confirmWritingReference(): boolean {
      const current = coalesceWritingReferenceState(this.writingReferenceState);
      if (current.attachments.length < 1) {
        this.lastError =
          "参考資料がありません。ナレッジまたはファイルから資料を追加してください。";
        return false;
      }
      const confirmed = recomputeWritingReferenceState({
        attachments: current.attachments,
        selectedKnowledge: current.selectedKnowledge,
        forceStatus: "complete",
      });
      const selectedKnowledge: SelectedKnowledgeRef[] = confirmed.attachments
        .filter(
          (att) =>
            att.source === "knowledge" &&
            att.knowledgeDocId &&
            att.gcsPath?.trim()
        )
        .map((att) => ({
          id: att.knowledgeDocId!,
          name: att.name,
          gcsPath: att.gcsPath!,
          mimeType: att.mimeType,
        }));
      this.writingReferenceState = {
        ...confirmed,
        selectedKnowledge,
      };
      this.writingPhase = WRITING_PHASE_DEFAULT;
      this.activeAgent = "writing";
      this.jobKind = "writing";
      this.lastError = null;
      void this.persistCurrentSession();
      return true;
    },

    confirmWritingSchema(): void {
      if (this.writingForm.fields.length < 1) {
        this.lastError = "入力項目が 1 件以上必要です。";
        return;
      }
      const invalidLabel = this.writingForm.fields.some(
        (field) => !field.label?.trim()
      );
      if (invalidLabel) {
        this.lastError = "すべての項目名を入力してください。";
        return;
      }
      const keys = this.writingForm.fields.map((field) => field.key.trim());
      if (new Set(keys).size !== keys.length) {
        this.lastError = "項目キーが重複しています。項目名を調整してください。";
        return;
      }
      this.writingForm = {
        ...this.writingForm,
        schemaConfirmedAt: new Date().toISOString(),
      };
      this.writingPhase = "filling";
      this.lastError = null;
      void this.persistCurrentSession();
    },

    updateWritingForm(form: WritingFormState): void {
      this.writingForm = normalizeWritingFormState(form);
      void this.persistCurrentSession();
    },

    setWritingReferenceState(state: WritingReferenceState): void {
      this.writingReferenceState = normalizeWritingReferenceState(
        state ?? emptyWritingReferenceState()
      );
      void this.persistCurrentSession();
    },

    imageStudioFields(): ImageStudioFields {
      return {
        imageWorkflowPhase: this.imageWorkflowPhase,
        primaryArtifact: {
          artifactId: this.primaryArtifactId,
          adkFilename: this.primaryAdkFilename,
          artifactVersion: this.primaryArtifactVersion,
        },
        retouchRegions: this.retouchRegions,
      };
    },

    setRetouchRegions(
      regions: ImageRetouchRegion[],
      params?: { persist?: boolean }
    ): void {
      this.retouchRegions = regions;
      if (params?.persist !== false) {
        void this.commitImageRetouchStateToFirestore();
      }
    },

    resetImageStudioToCreate(): void {
      this.imageWorkflowPhase = "create";
      this.primaryArtifactId = null;
      this.primaryAdkFilename = null;
      this.primaryArtifactVersion = null;
      this.retouchRegions = [];
    },

    /**
     * レタッチモードを Firestore `adkSessions.state` に明示的に書き込む.
     * ADK invoke は保存済み state を優先して retouch として動作する.
     */
    async commitImageRetouchStateToFirestore(): Promise<boolean> {
      if (!this.sessionId) return false;
      if (!tryResolveAdkSessionScope()) return false;
      this.imageWorkflowPhase = "retouch";
      if (
        !imagePrimaryHasReference({
          artifactId: this.primaryArtifactId,
          adkFilename: this.primaryAdkFilename,
          artifactVersion: this.primaryArtifactVersion,
        })
      ) {
        if (!this.applyLatestImagePrimary()) return false;
      }
      await this.persistCurrentSession();
      return true;
    },

    async commitImageCreateStateToFirestore(): Promise<void> {
      if (!this.sessionId) return;
      this.resetImageStudioToCreate();
      await this.persistCurrentSession();
    },

    /**
     * 選択した画像を primary にする（フェーズは維持）.
     * 別画像へ切り替えたときはレタッチ範囲をクリアする.
     */
    async setImagePrimaryFromArtifact(params: {
      artifactId?: string;
      adkFilename?: string;
      artifactVersion?: number;
      persist?: boolean;
    }): Promise<boolean> {
      const primary = primaryFromImageArtifact(params);
      if (!imagePrimaryHasReference(primary)) return false;
      const changed =
        this.primaryAdkFilename !== primary.adkFilename ||
        this.primaryArtifactId !== primary.artifactId ||
        this.primaryArtifactVersion !== primary.artifactVersion;
      this.primaryArtifactId = primary.artifactId;
      this.primaryAdkFilename = primary.adkFilename;
      this.primaryArtifactVersion = primary.artifactVersion;
      if (changed) {
        this.retouchRegions = [];
      }
      if (params.persist !== false && this.sessionId) {
        await this.persistCurrentSession();
      }
      return true;
    },

    async advanceToRetouch(params: {
      artifactId?: string;
      adkFilename?: string;
      artifactVersion?: number;
    }): Promise<void> {
      const primary = primaryFromImageArtifact(params);
      if (!imagePrimaryHasReference(primary)) return;
      this.primaryArtifactId = primary.artifactId;
      this.primaryAdkFilename = primary.adkFilename;
      this.primaryArtifactVersion = primary.artifactVersion;
      await this.commitImageRetouchStateToFirestore();
    },

    /** 最新画像を primary にし、参照を返す（フェーズは変えない） */
    applyLatestImagePrimary(): boolean {
      const primary = findLatestImagePrimaryInMessages({
        messages: this.messages,
      });
      if (!primary) return false;
      this.primaryArtifactId = primary.artifactId;
      this.primaryAdkFilename = primary.adkFilename;
      this.primaryArtifactVersion = primary.artifactVersion;
      return true;
    },

    /** 手動トグル: レタッチモードへ（最新画像を primary に固定） */
    async enterImageRetouchMode(): Promise<boolean> {
      return this.commitImageRetouchStateToFirestore();
    },

    /** 手動トグル: 初稿モードへ（primary は維持して再切替しやすくする） */
    async setImageWorkflowPhaseCreate(): Promise<void> {
      if (this.imageWorkflowPhase === "create") return;
      await this.commitImageCreateStateToFirestore();
    },

    syncPrimaryFromLatestImageArtifact(): void {
      if (!this.applyLatestImagePrimary()) return;
      if (this.imageWorkflowPhase === "create") {
        void this.commitImageRetouchStateToFirestore();
      }
    },

    maybeAdvanceImageStudioAfterTurn(): void {
      if (this.activeAgent !== "image") return;
      this.syncPrimaryFromLatestImageArtifact();
    },

    sheetConnectionFields(): SheetConnectionFields {
      return {
        sheetModeSelected: this.sheetModeSelected,
        spreadsheetId: this.spreadsheetId,
        spreadsheetUrl: this.spreadsheetUrl,
        targetSheetName: this.targetSheetName,
        targetSheetGid: this.targetSheetGid,
      };
    },

    confirmSheetConnection(params: {
      spreadsheetId: string;
      spreadsheetUrl: string;
      targetSheetName: string;
      targetSheetGid?: number | null;
    }): void {
      this.spreadsheetId = params.spreadsheetId;
      this.spreadsheetUrl = params.spreadsheetUrl;
      this.targetSheetName = params.targetSheetName.trim();
      this.targetSheetGid =
        params.targetSheetGid != null && Number.isFinite(params.targetSheetGid)
          ? params.targetSheetGid
          : null;
      this.sheetModeSelected = Boolean(
        this.spreadsheetId && this.targetSheetName
      );
      this.activeAgent = "sheet";
      this.jobKind = "sheet";
      void this.persistCurrentSession();
    },

    requireSheetConnection(): void {
      this.sheetModeSelected = false;
      this.spreadsheetId = null;
      this.spreadsheetUrl = null;
      this.targetSheetName = null;
      this.targetSheetGid = null;
    },

    setImageCreationMode(mode: ImageCreationMode): void {
      this.imageModeSelected = true;
      this.imageCreationMode = mode;
      this.imageReferenceState = emptyImageReferenceState();
      this.resetImageStudioToCreate();
      this.activeAgent = "image";
      this.jobKind = "image";
      void this.persistCurrentSession();
    },

    resetImageCreationMode(): void {
      this.imageModeSelected = false;
      this.imageCreationMode = null;
      this.imageReferenceState = emptyImageReferenceState();
      this.resetImageStudioToCreate();
      void this.persistCurrentSession();
    },

    requireImageModeSelection(): void {
      this.imageModeSelected = false;
      this.imageCreationMode = null;
      this.imageReferenceState = emptyImageReferenceState();
      this.resetImageStudioToCreate();
    },

    setImageReferenceState(state: ImageReferenceState): void {
      this.imageReferenceState = normalizeImageReferenceState(state);
      void this.persistCurrentSession();
    },

    syncImageReferenceFromAdk(raw: unknown): void {
      if (!raw) return;
      this.imageReferenceState = normalizeImageReferenceState(raw);
    },

    cancelStream(): void {
      this.abortController?.abort();
      this.abortController = null;
      this.isStreaming = false;
    },

    /**
     * sheet モード切替時の URL 受領.
     */
    updateSpreadsheetUrl(url: string): boolean {
      const m = url.match(
        /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})[^\s]*/
      );
      if (!m || !m[1]) return false;
      this.spreadsheetId = m[1];
      this.spreadsheetUrl = m[0];
      return true;
    },

    /** ADK `convert_mode` / SSE mode_change から UI mode を同期 */
    applyActiveModeFromAdk(mode: AdkAgentMode, reason?: string): void {
      if (!isAiStudioWorkspaceMode(mode)) return;
      const changed = this.activeAgent !== mode;
      if (!changed && !reason?.trim()) return;

      this.activeAgent = mode;
      this.jobKind = mode;
      if (mode === "image" && changed) {
        this.requireImageModeSelection();
      }
      if (mode === "sheet" && changed) {
        this.requireSheetConnection();
      }
      if (mode === "writing" && changed) {
        this.resetWritingWorkflow();
      }
      if (reason?.trim()) {
        this.routingReason = reason.trim();
      } else if (changed) {
        this.routingReason = "モードを切り替えました";
      }
      if (changed) {
        void this.persistCurrentSession();
      }
    },

    /** ヘッダーから手動でワークスペースモードを切替 → Firestore state → 次回 invoke で ADK に伝搬 */
    async setWorkspaceMode(mode: AdkAgentMode): Promise<void> {
      if (this.isStreaming) return;
      if (this.activeAgent === mode && this.jobKind === mode) return;

      if (mode === "research") {
        try {
          await this.persistCurrentSession();
        } catch (error) {
          log("WARN", "[aiStudio] failed to persist before research switch", {
            sessionId: this.sessionId,
            error,
          });
        }
        this.activeSessionUnsubscribe?.();
        this.activeSessionUnsubscribe = null;
        await this.startSession("research");
        return;
      }

      if (!isAiStudioWorkspaceMode(mode)) return;

      const wasImage = this.activeAgent === "image";
      const wasSheet = this.activeAgent === "sheet";
      this.activeAgent = mode;
      this.jobKind = mode;
      if (mode !== "image") {
        this.requireImageModeSelection();
      } else if (!wasImage) {
        this.requireImageModeSelection();
      }
      if (mode === "sheet" || wasSheet) {
        this.requireSheetConnection();
      }
      if (mode === "writing") {
        this.resetWritingWorkflow();
      }
      this.routingReason = "ユーザーがモードを切り替え";
      await this.persistCurrentSession();
    },

    /**
     * 文書フォームワークフロー — ADK invoke (extract_schema / generate_document).
     */
    async invokeWriting(params: {
      action: WritingInvokeAction;
      attachments?: AttachedFile[];
      selectedKnowledge?: SelectedKnowledgeRef[];
    }): Promise<void> {
      if (!this.sessionId) {
        await this.startSession("writing");
      }
      this.activeAgent = "writing";
      this.jobKind = "writing";

      const writingRef = coalesceWritingReferenceState(this.writingReferenceState);
      this.writingReferenceState = writingRef;

      const referenceAttachments: AttachedFile[] = writingRef.attachments
        .filter((att) => att.gcsPath?.trim())
        .map((att) => ({
          fileName: att.name,
          mimeType: att.mimeType,
          gcsPath: att.gcsPath!,
        }));
      const attachments =
        params.action === "extract_schema"
          ? referenceAttachments
          : (params.attachments ?? []);
      const selectedKnowledge =
        params.action === "extract_schema"
          ? writingRef.selectedKnowledge
          : (params.selectedKnowledge ?? []);

      if (params.action === "extract_schema") {
        if (writingRef.status !== "complete" || writingRef.attachments.length < 1) {
          this.lastError =
            "参考資料を追加し、「参照を確定」を押してからフォーマットを抽出してください。";
          return;
        }
      } else if (params.action === "generate_document") {
        if (this.writingPhase !== "filling") {
          this.lastError =
            "先にフォーマットを確定してください。";
          return;
        }
      }

      const prompt =
        params.action === "extract_schema"
          ? "添付の参考資料から、ユーザーが入力すべき項目の一覧（フォーム定義）を抽出してください。"
          : buildWritingGenerateDocumentPrompt({ form: this.writingForm });

      if (this.isStreaming) return;

      this.messages.push({
        id: createId(),
        role: "user",
        text: prompt,
        createdAt: Date.now(),
      });
      const assistantIndex = this.messages.length;
      this.messages.push({
        id: createId(),
        role: "assistant",
        text: "",
        createdAt: Date.now(),
        isStreaming: true,
        agent: "writing",
        artifacts: [],
        activities: [],
      });

      this.lastError = null;
      this.isStreaming = true;
      this.abortController = new AbortController();

      try {
        const scope = resolveAdkSessionScope();
        const { organizationId: orgId, spaceId } = scope;
        const { useGeminiFileSpaceOperatorStore } = await import(
          "@stores/geminiFileSpaceOperator"
        );
        const fsStore = useGeminiFileSpaceOperatorStore();

        const sessions = useAiStudioSessions();
        const serverSession = await sessions.get(this.sessionId!);
        if (!serverSession) {
          await sessions.create({
            sessionId: this.sessionId!,
            jobKind: "writing",
            activeAgent: "writing",
            routingReason: this.routingReason,
            messages: this.messages.slice(0, -2),
            writingPhase: this.writingPhase,
            writingForm: this.writingForm,
            writingReferenceState: this.writingReferenceState,
          });
        }

        let fileSpaceId: string | null = null;
        try {
          const ensured = await fsStore.ensureDefaultFileSpace();
          fileSpaceId = ensured.storeId;
          if (!fileSpaceId) {
            fileSpaceId =
              (await fsStore.getFirstSystemManagedFileSpaceId()) ?? null;
          }
        } catch (error) {
          log("WARN", "[aiStudio] ensureDefaultFileSpace failed", error);
        }

        const priorTurns = this.messages.slice(0, assistantIndex - 1);
        const history: AgentSseHistoryTurn[] = priorTurns.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          text: m.text,
        }));

        const modeState = writingModeStateToApi({
          writingPhase: this.writingPhase,
          writingForm: this.writingForm,
          writingReferenceState: this.writingReferenceState,
          writingAction: params.action,
        });

        const assistantMessageId = this.messages[assistantIndex]!.id;
        const uid = getAuth().currentUser?.uid;
        if (!uid) throw new Error("ログイン状態ではありません");

        this.ensureActiveSessionSubscription();
        await this.persistCurrentSession();

        const invokeInput = buildAdkInvokeInput({
          mode: "writing",
          sessionId: this.sessionId!,
          organizationId: orgId,
          spaceId,
          userId: uid,
          prompt,
          responseId: assistantMessageId,
          model: defaultLlmModelSelectionForAdkMode("writing"),
          fileSpaceId,
          history,
          modeState,
          attachments,
          selectedKnowledge,
        });

        const requestId = await createAdkInvokeRequest({
          input: invokeInput,
          organizationId: orgId,
          spaceId,
        });
        await new Promise<void>((resolve, reject) => {
          const stopWatch = watchAdkInvokeRequest({
            organizationId: orgId,
            spaceId,
            requestId,
            onUpdate: (status, errorMessage) => {
              if (status === "completed") {
                stopWatch();
                resolve();
              } else if (status === "error") {
                stopWatch();
                reject(
                  new Error(errorMessage || "ADK invoke が失敗しました")
                );
              }
            },
          });
        });

        if (params.action === "generate_document") {
          this.writingPhase = "done";
          await this.syncWritingFormFromJsonArtifact();
        }

        this.messages[assistantIndex] = {
          ...this.messages[assistantIndex]!,
          isStreaming: false,
          completedAt: Date.now(),
          agent: "writing",
        };
      } catch (error) {
        log("ERROR", "[aiStudio] invokeWriting failed", error);
        const message = formatErrorForDisplay(error);
        this.lastError = message;
        const failedTurn = this.messages[assistantIndex];
        if (failedTurn) {
          this.messages[assistantIndex] = {
            ...failedTurn,
            text: message,
            isStreaming: false,
            completedAt: Date.now(),
            artifacts: failedTurn.artifacts ?? [],
            activities: failedTurn.activities ?? [],
          };
        }
      } finally {
        this.isStreaming = false;
        this.abortController = null;
        if (this.sessionId) {
          const sessions = useAiStudioSessions();
          void sessions.get(this.sessionId).then((record) => {
            if (record) {
              this.applyWritingFieldsFromSessionRecord(record);
            }
            void this.persistCurrentSession();
          });
        } else {
          void this.persistCurrentSession();
        }
      }
    },

    /**
     * メイン送信. 1 ターン目だけ Concierge で activeAgent を確定し、それ以降は確定済み agent を使う.
     */
    async send(
      text: string,
      attachments: AttachedFile[] = [],
      selectedKnowledge: SelectedKnowledgeRef[] = []
    ): Promise<void> {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!this.sessionId) {
        await this.startSession(null);
      }

      if (this.jobKind === "research") {
        const research = useResearchAgentStore();
        if (!research.sessionId) {
          await research.startSession(trimmed);
        } else {
          await research.send(trimmed, { isAuto: false });
        }
        return;
      }

      // 1 ターン目: Concierge で activeAgent を決める (preferredKind が research 以外で
      // 未設定の場合のみ — startSession ですでに確定済みならスキップ)
      if (!this.activeAgent) {
        try {
          const router = useConciergeRouter();
          const preferredConciergeAgent =
            this.jobKind &&
            ["writing", "sheet", "image", "consultation", "research"].includes(
              this.jobKind
            )
              ? (this.jobKind as ConciergeTargetAgent)
              : null;
          const result = await router.route(
            trimmed,
            preferredConciergeAgent
          );
          if (result.agent === "research") {
            this.jobKind = "research";
            this.activeAgent = "research";
            const research = useResearchAgentStore();
            if (!research.sessionId) {
              await research.startSession(trimmed);
            } else {
              await research.send(trimmed, { isAuto: false });
            }
            return;
          }
          this.activeAgent = result.agent as AdkAgentMode;
          this.routingReason = result.reason;
        } catch (e) {
          this.lastError = formatErrorForDisplay(e);
          return;
        }
      }

      if (this.imageCreationMode && this.activeAgent !== "image") {
        this.activeAgent = "image";
        this.jobKind = "image";
      }

      let mode = this.activeAgent;
      if (!mode) return;

      if (mode === "writing") {
        this.lastError =
          "文書モードでは、参考資料の確定と下のボタン（フォーマット抽出 / 入力開始）をご利用ください。";
        return;
      }

      if (mode === "sheet") {
        if (!this.sheetModeSelected || !this.spreadsheetId || !this.targetSheetName) {
          this.lastError =
            "スプレッドシートの URL を確認し、編集するシート（タブ）を選んで「接続を確定」してください。";
          return;
        }
      }

      if (mode === "image") {
        if (this.imageWorkflowPhase === "retouch") {
          if (
            !imagePrimaryHasReference({
              artifactId: this.primaryArtifactId,
              adkFilename: this.primaryAdkFilename,
              artifactVersion: this.primaryArtifactVersion,
            })
          ) {
            this.lastError =
              "レタッチする初稿画像がありません。先に初稿を生成するか、ファイル出力から画像を選んでください。";
            return;
          }
        } else if (!this.imageModeSelected || !this.imageCreationMode) {
          this.lastError =
            "まず「0から新規に作成」か「お手本画像を元に作成」を選んでください。";
          return;
        }
        if (this.imageWorkflowPhase === "create") {
          if (
            this.imageCreationMode === "reference" &&
            this.imageReferenceState.status !== "complete"
          ) {
            this.lastError =
              "お手本画像を追加し、「参照を確定」を押してから送信してください。";
            return;
          }
          if (
            this.imageCreationMode === "reference" &&
            !referenceImagesHaveResolvableStorage(this.imageReferenceState)
          ) {
            this.lastError =
              "お手本画像の保存先が見つかりません。削除して再度追加してください。";
            return;
          }
          const openaiByok = useOpenaiByokStore();
          const openaiKey = await openaiByok.loadUserApiKey();
          if (!openaiKey) {
            this.lastError = OPENAI_BYOK_SETUP_MESSAGE;
            return;
          }
        }
      }

      // user message を即追加
      this.messages.push({
        id: createId(),
        role: "user",
        text: trimmed,
        createdAt: Date.now(),
      });

      // assistant placeholder
      const assistantIndex = this.messages.length;
      this.messages.push({
        id: createId(),
        role: "assistant",
        text: "",
        createdAt: Date.now(),
        isStreaming: true,
        agent: mode,
        artifacts: [],
        activities: [],
      });

      this.lastError = null;
      this.isStreaming = true;
      this.abortController = new AbortController();

      try {
        const scope = resolveAdkSessionScope();
        const { organizationId: orgId, spaceId } = scope;

        if (
          mode === "image" &&
          this.imageWorkflowPhase === "retouch"
        ) {
          await this.commitImageRetouchStateToFirestore();
        }

        const { useGeminiFileSpaceOperatorStore } = await import(
          "@stores/geminiFileSpaceOperator"
        );
        const fsStore = useGeminiFileSpaceOperatorStore();

        const sessions = useAiStudioSessions();
        const serverSession = await sessions.get(this.sessionId!);
        if (!serverSession) {
          await sessions.create({
            sessionId: this.sessionId!,
            jobKind: this.jobKind,
            activeAgent: this.activeAgent,
            routingReason: this.routingReason,
            messages: this.messages.slice(0, -2),
          });
        }

        // デフォルト FileSpace (= DE / Agent Search datastore) — データソース UI と同じ pool
        let fileSpaceId: string | null = null;
        try {
          const ensured = await fsStore.ensureDefaultFileSpace();
          fileSpaceId = ensured.storeId;
          if (!fileSpaceId) {
            fileSpaceId =
              (await fsStore.getFirstSystemManagedFileSpaceId()) ?? null;
          }
          if (!fileSpaceId && ensured.requestId) {
            log("WARN", "[aiStudio] default FileSpace 作成中 — Agent Search 未接続の可能性");
          }
        } catch (error) {
          log("WARN", "[aiStudio] ensureDefaultFileSpace failed", error);
          fileSpaceId = null;
        }

        const priorTurns = this.messages.slice(0, assistantIndex - 1);
        const history: AgentSseHistoryTurn[] = priorTurns.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          text: m.text,
        }));

        const invokeMode: AdkAgentMode =
          mode === "image" || this.imageCreationMode ? "image" : mode;

        const workspaceBucketInput: Parameters<typeof buildWorkspaceSessionState>[0] = {
          enAiStudioUi: {},
          activeMode: isAiStudioWorkspaceMode(invokeMode)
            ? (invokeMode as WorkspaceTaskKey)
            : undefined,
        };
        if (mode === "sheet" && this.sheetModeSelected) {
          workspaceBucketInput.sheet = this.sheetConnectionFields();
        }
        if (
          this.imageWorkflowPhase === "retouch" ||
          (this.imageModeSelected && this.imageCreationMode)
        ) {
          workspaceBucketInput.image = {
            imageModeSelected: this.imageModeSelected,
            imageCreationMode: this.imageCreationMode,
            imageReferenceState: this.imageReferenceState,
            imageStudio: this.imageStudioFields(),
          };
        } else if (invokeMode === "image") {
          workspaceBucketInput.image = {
            imageModeSelected: false,
            imageCreationMode: null,
            imageReferenceState: this.imageReferenceState,
          };
        }
        if (mode === "application_scan") {
          workspaceBucketInput.applicationScan = this.applicationScanFields;
        }
        if (invokeMode === "consultation") {
          workspaceBucketInput.consultation = {
            consultationModel: this.consultationModel,
          };
        }
        const builtWorkspace = buildWorkspaceSessionState(workspaceBucketInput);
        const modeState = buildInvokeModeStateFromWorkspaceState({
          state: builtWorkspace,
          activeMode: invokeMode,
        });

        const assistantMessageId = this.messages[assistantIndex]!.id;
        const modelSelection =
          invokeMode === "consultation"
            ? this.consultationModel
            : defaultLlmModelSelectionForAdkMode(invokeMode);

        if (!isAdkInvokeViaRequestDocEnabled()) {
          throw new Error(
            "ADK 直接接続は無効です。NUXT_PUBLIC_ADK_INVOKE_VIA_REQUEST_DOC=false になっていないか確認してください。"
          );
        }
        const uid = getAuth().currentUser?.uid;
        if (!uid) {
          throw new Error("ログイン状態ではありません");
        }
        this.ensureActiveSessionSubscription();
        const invokeInput = buildAdkInvokeInput({
          mode: invokeMode,
          sessionId: this.sessionId!,
          organizationId: orgId,
          spaceId,
          userId: uid,
          prompt: trimmed,
          responseId: assistantMessageId,
          model: modelSelection,
          fileSpaceId,
          history,
          modeState,
          attachments,
          selectedKnowledge,
          referenceImages:
            this.imageCreationMode === "reference" && this.imageModeSelected
              ? referenceImagesForAdkInvoke(this.imageReferenceState)
              : undefined,
        });
        const requestId = await createAdkInvokeRequest({
          input: invokeInput,
          organizationId: orgId,
          spaceId,
        });
        await new Promise<void>((resolve, reject) => {
          const stopWatch = watchAdkInvokeRequest({
            organizationId: orgId,
            spaceId,
            requestId,
            onUpdate: (status, errorMessage) => {
              if (status === "completed") {
                stopWatch();
                resolve();
              } else if (status === "error") {
                stopWatch();
                reject(
                  new Error(errorMessage || "ADK invoke が失敗しました")
                );
              }
            },
          });
        });
        this.messages[assistantIndex] = {
          ...this.messages[assistantIndex]!,
          isStreaming: false,
          completedAt: Date.now(),
          agent: this.activeAgent ?? mode,
        };
      } catch (error) {
        log("ERROR", "[aiStudio] send failed", error);
        const message = formatErrorForDisplay(error);
        this.lastError = message;
        const failedTurn = this.messages[assistantIndex];
        if (failedTurn) {
          this.messages[assistantIndex] = {
            ...failedTurn,
            text: message,
            isStreaming: false,
            completedAt: Date.now(),
            artifacts: failedTurn.artifacts ?? [],
            activities: failedTurn.activities ?? [],
          };
        }
      } finally {
        this.isStreaming = false;
        this.abortController = null;
        this.maybeAdvanceImageStudioAfterTurn();
        void (async () => {
          await this.applyFirstTurnSessionTitle(trimmed);
          await this.persistCurrentSession();
        })();
      }
    },
  },
});
