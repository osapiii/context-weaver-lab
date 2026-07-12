<template>
  <div class="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
    <!-- モバイル: 履歴 / アウトプット (単独ページのみ) -->
    <div
      v-if="!embeddedInWorkspace"
      class="flex flex-shrink-0 items-center justify-end gap-1 border-b border-neutral-200 bg-white px-2 py-1 md:hidden"
    >
      <EnButton
        variant="ghost"
        size="sm"
        leading-icon="material-symbols:history"
        @click="sessionDrawerOpen = true"
      >
        履歴
      </EnButton>
      <EnButton
        variant="ghost"
        size="sm"
        :leading-icon="
          artifactPanelOpen
            ? 'material-symbols:side-navigation'
            : 'material-symbols:draft'
        "
        @click="
          artifactPanelOpen
            ? artifactPanel.closePanel()
            : artifactPanel.openPanel()
        "
      >
        アウトプット
      </EnButton>
    </div>

    <!-- API キー未登録の場合の案内バナー -->
    <EnAlert
      v-if="store.needsApiKeyRegistration"
      variant="ai"
      class="flex-shrink-0 rounded-none border-x-0 border-t-0"
      title="Gemini API キーが未登録です"
      description="AI 機能を使うには設定 > AI 連携 で登録してください。"
    >
      <template #actions>
        <EnButton
          variant="outline"
          size="xs"
          to="/admin/preferences"
        >
          設定を開く
        </EnButton>
      </template>
    </EnAlert>
    <EnAlert
      v-if="contextSoftWarning"
      variant="ai"
      class="flex-shrink-0 rounded-none border-x-0 border-t-0"
      title="企業コンテキストが限定的です"
      :description="contextSoftWarning"
    />
    <AgentWorkspaceWorkflowFrame class="min-h-0 min-w-0 flex-1">
      <template #stepper>
        <EnStepper
          :model-value="researchFlowStepIndex"
          :items="researchFlowStepperItems"
          color="neutral"
          size="xs"
          orientation="horizontal"
          custom-class="pointer-events-none"
        />
      </template>

      <div class="flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden">
      <div
        v-if="sessionDrawerOpen"
        class="fixed inset-0 z-40 bg-black/30 md:hidden"
        aria-hidden="true"
        @click="sessionDrawerOpen = false"
      />
      <ResearchAgentSessionSidebar
        v-if="sessionDrawerOpen"
        class="fixed inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] shadow-xl md:hidden"
        :show-hub-back-button="showHubBackButton"
        :show-reports-link="showReportsLink"
        @back-to-hub="emit('back-to-hub')"
        @select="sessionDrawerOpen = false"
      />

      <!-- 左: セッション履歴 (AgentWorkspace 同型) -->
      <aside
        class="hidden h-full min-h-0 flex-shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 transition-[width] duration-200 md:flex"
        :class="historyPanelOpen ? 'w-[260px]' : 'w-10'"
      >
        <button
          v-if="!historyPanelOpen"
          type="button"
          class="flex h-full w-10 flex-col items-center justify-center gap-1 border-0 bg-neutral-50 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          title="履歴を開く"
          @click="historyPanelOpen = true"
        >
          <UIcon name="material-symbols:history" class="h-5 w-5" />
          <span
            class="text-[9px] font-bold uppercase tracking-wider [writing-mode:vertical-rl]"
          >
            履歴
          </span>
        </button>
        <div
          v-else
          class="flex h-full min-h-0 flex-col"
        >
          <div
            class="flex flex-shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 py-2"
          >
            <span class="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              履歴
              <span class="text-neutral-400">({{ sessionCount }} 件)</span>
            </span>
            <button
              type="button"
              class="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              title="折りたたむ"
              @click="historyPanelOpen = false"
            >
              <UIcon name="material-symbols:chevron-left" class="h-5 w-5" />
            </button>
          </div>
          <ResearchAgentSessionSidebar
            class="min-h-0 flex-1"
            :show-hub-back-button="showHubBackButton"
            :show-reports-link="showReportsLink"
            @back-to-hub="emit('back-to-hub')"
          />
        </div>
      </aside>

      <!-- 中央: 共通エディタシェル（ヒアリング〜事前プラン〜生成） -->
      <div class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <EnAIRevisionAssistantPanel
          class="min-h-0 min-w-0 flex-1"
          :messages="panelMessages"
          :can-submit="false"
          :can-send="false"
          :is-sending="store.isStreaming || store.isAutoResponding"
          :mood-text="moodText"
          panel-title="リサーチエージェント"
          :welcome-bubble-text="welcomeBubbleText"
          processing-label="考えてます…"
          assistant-theme="research"
          render-markdown
          :artifact-session-id="store.sessionId"
          hide-message-thread
          hide-composer
          :center-welcome-replace="centerWelcomeReplace"
          :welcome-replace-max-width-class="welcomeReplaceMaxWidthClass"
          :welcome-replace-container-class="welcomeReplaceContainerClass"
        >
          <template
            v-if="showHubBackButton"
            #header-leading
          >
            <EnButton
              variant="ghost"
              color="neutral"
              size="xs"
              leading-icon="material-symbols:arrow-back"
              custom-class="shrink-0"
              data-testid="research-back-to-hub"
              @click="emit('back-to-hub')"
            >
              一覧に戻る
            </EnButton>
          </template>

          <template #welcome-replace>
            <AgentBriefingSession
              v-if="showBriefing"
              :briefing="briefing"
              :show-skip="false"
              :launching="briefingLaunching"
              class="min-h-0 min-w-0 flex-1"
              @finalize="onBriefingFinalize"
            />
            <ResearchPlanGeneratingPanel
              v-else-if="showPlanGenerating"
            />
            <ResearchPlanKioskPanel
              v-else-if="showPlanKiosk && store.researchPlanDraft"
              :plan="store.researchPlanDraft"
              :is-submitting="generationSubmitting"
              :is-running="isGenerationInProgress"
              @submit="onPlanSubmit"
            />
            <ResearchCompletionViewerTabs
              v-else-if="showCompletionViewer && store.researchPlanDraft"
              :plan="store.researchPlanDraft"
              :report-html="completionReportHtml"
              :report-title="completionReportTitle"
              :report-storage-gcs-path="completionReportStoragePath"
              :report-content-type="completionReportContentType"
              :context-status="researchContextStatus"
              :context-summary="researchContextSummary"
              :context-warning="researchContextWarning"
            />
            <ResearchStudioWorkflowCenter
              v-else-if="showResearchWorkflowCenter"
              :phase="workflowCenterPhase"
              @back-to-hub="emit('back-to-hub')"
              @new-research="onNewResearch"
            />
          </template>

          <template #header-extra>
            <AiStudioWorkspaceModePicker
              model-value="research"
              :disabled="store.isStreaming || store.isAutoResponding"
              @update:model-value="onWorkspaceModeChange"
            />
            <EnBadge
              v-if="fileSpaceConnected"
              variant="assistant"
              size="sm"
              custom-class="shrink-0 max-w-[10rem] truncate"
              :title="fileSpaceTitle"
            >
              ナレッジ連携 ON
            </EnBadge>
            <EnBadge
              v-if="workflowBadgeLabel"
              variant="assistant"
              size="sm"
              custom-class="shrink-0"
            >
              {{ workflowBadgeLabel }}
            </EnBadge>
            <EnButton
              variant="ghost"
              size="xs"
              icon="material-symbols:list-alt"
              class="shrink-0 text-neutral-600"
              title="リクエストログ"
              aria-label="リクエストログ"
              :to="requestLogsLink"
            />
            <AdkSessionStateDebugPanel
              v-if="store.sessionId"
              :session-id="store.sessionId"
              :refresh-token="sessionDebugRefreshToken"
            />
          </template>

          <template
            v-if="store.isStreaming || store.isAutoResponding"
            #footer-send
          >
            <EnButton
              type="button"
              variant="soft"
              color="error"
              size="sm"
              leading-icon="material-symbols:stop"
              @click="store.cancelStream()"
            >
              中断
            </EnButton>
          </template>
        </EnAIRevisionAssistantPanel>

        <ResearchRunningStatusModal
          :open="showRunningModal"
          :notification-email="store.notificationEmail"
          :message="runningModalMessage"
          :is-saving-email="savingNotificationEmail"
          :context-status="researchContextStatus"
          :context-warning="researchContextWarning"
          :context-summary="researchContextSummary"
          @save-notification="onSaveNotificationEmail"
        />

        <aside
          v-show="showArtifactAside"
          :class="[
            'flex h-full min-h-0 flex-shrink-0 flex-col border-l border-neutral-300/80 transition-[width] duration-200 ease-out',
            artifactPanelOpen
              ? 'w-[min(48vw,560px)] min-w-[min(100%,400px)] max-w-[560px]'
              : 'w-10 bg-neutral-100',
          ]"
        >
          <button
            v-if="!artifactPanelOpen"
            type="button"
            class="flex h-full w-10 flex-col items-center justify-center gap-1 border-0 bg-[#ececee] text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-700"
            title="ファイル出力を開く"
            @click="artifactPanel.openPanel()"
          >
            <UIcon name="material-symbols:draft" class="h-5 w-5" />
            <span
              class="text-[9px] font-bold tracking-wide [writing-mode:vertical-rl]"
            >
              ファイル出力
            </span>
          </button>
          <WorkspaceArtifactPanel
            v-else
            class="min-h-0 flex-1"
            :entries="artifactEntries"
            :selected-entry="artifactSelectedEntry"
            :selected-key="artifactSelectedKey"
            :selected-index="artifactSelectedIndex"
            :session-id="store.sessionId"
            :image-view-mode="artifactImageViewMode"
            @close="artifactPanel.closePanel()"
            @select="artifactPanel.selectByKey"
            @select-relative="artifactPanel.selectRelative"
            @open-image-gallery="artifactPanel.openImageGallery()"
            @open-image-focus="artifactPanel.openImageFocus()"
          />
        </aside>
      </div>
      </div>
    </AgentWorkspaceWorkflowFrame>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from "vue";
import {
  useAiStudioStore,
  type AiStudioMessage,
  type AiStudioJobKind,
} from "@stores/aiStudio";
import { useResearchAgentStore } from "@stores/researchAgent";
import AiStudioWorkspaceModePicker from "@components/AgentWorkspace/AiStudioWorkspaceModePicker.vue";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useAgentBriefing } from "@composables/agentBriefing/useAgentBriefing";
import { researchAgentBriefingConfig } from "@composables/briefings/researchAgentBriefingConfig";
import AgentBriefingSession from "@components/AgentBriefing/AgentBriefingSession.vue";
import EnAIRevisionAssistantPanel, {
  type AIRevisionAssistantMessage,
} from "@components/EnAIRevisionAssistantPanel.vue";
import EnAlert from "@components/EnAlert.vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import EnStepper from "@components/EnStepper.vue";
import AgentWorkspaceWorkflowFrame from "@components/AgentWorkspace/AgentWorkspaceWorkflowFrame.vue";
import ResearchAgentSessionSidebar from "@components/ResearchAgentSessionSidebar.vue";
import ResearchPlanGeneratingPanel from "@components/ResearchPlanGeneratingPanel.vue";
import ResearchPlanKioskPanel from "@components/AgentWorkspace/ResearchPlanKioskPanel.vue";
import ResearchCompletionViewerTabs from "@components/AgentWorkspace/ResearchCompletionViewerTabs.vue";
import ResearchRunningStatusModal from "@components/AgentWorkspace/ResearchRunningStatusModal.vue";
import ResearchStudioWorkflowCenter from "@components/AgentWorkspace/ResearchStudioWorkflowCenter.vue";
import AdkSessionStateDebugPanel from "@components/AgentWorkspace/AdkSessionStateDebugPanel.vue";
import WorkspaceArtifactPanel from "@components/AgentWorkspace/WorkspaceArtifactPanel.vue";
import {
  useWorkspaceArtifactPanel,
  WORKSPACE_ARTIFACT_PANEL_KEY,
} from "@composables/useWorkspaceArtifactPanel";
import { aiStudioSessionsRevision } from "@composables/useAiStudioSessions";
import {
  researchBriefingDraftFromAgentDraft,
  type ResearchPlanDraft,
} from "@utils/researchPlanDraft";

withDefaults(
  defineProps<{
    showHubBackButton?: boolean;
    showReportsLink?: boolean;
    /** AgentWorkspace 内に埋め込むときは左履歴を親に任せる */
    embeddedInWorkspace?: boolean;
  }>(),
  {
    showHubBackButton: false,
    showReportsLink: true,
    embeddedInWorkspace: false,
  },
);

const emit = defineEmits<{
  (e: "back-to-hub"): void;
}>();

const store = useResearchAgentStore();
const aiStudio = useAiStudioStore();
const fileSpaceStore = useGeminiFileSpaceOperatorStore();
const briefing = useAgentBriefing(researchAgentBriefingConfig);
const historyPanelOpen = ref(false);
const sessionDrawerOpen = ref(false);
const briefingLaunching = ref(false);
const generationSubmitting = ref(false);
const savingNotificationEmail = ref(false);
const sessionDebugRefreshToken = ref(0);

const artifactPanel = useWorkspaceArtifactPanel({
  messages: computed(() => store.messages as unknown as AiStudioMessage[]),
  sessionId: computed(() => store.sessionId),
});
provide(WORKSPACE_ARTIFACT_PANEL_KEY, artifactPanel);

const artifactPanelOpen = computed(() => artifactPanel.panelOpen.value);
const artifactEntries = computed(() => artifactPanel.entries.value);
const artifactSelectedEntry = computed(() => artifactPanel.selectedEntry.value);
const artifactSelectedKey = computed(() => artifactPanel.selectedKey.value);
const artifactSelectedIndex = computed(() => artifactPanel.selectedIndex.value);
const artifactImageViewMode = computed(() => artifactPanel.imageViewMode.value);

const sessionCount = computed(() => {
  void aiStudioSessionsRevision.value;
  return store.sessions.length;
});

const requestLogsLink = computed(() => ({
  name: "admin-request-logs" as const,
  query: { type: "adkInvokeRequest" },
}));

const showPlanGenerating = computed(
  () =>
    store.researchWorkflowPhase === "plan_generating" ||
    (store.researchPlanOnly && store.isStreaming),
);

const showPlanReview = computed(
  () =>
    store.researchWorkflowPhase === "plan_review" ||
    store.researchWorkflowPhase === "confirm_submit",
);

const isGenerationInProgress = computed(
  () =>
    store.researchWorkflowPhase === "generating" ||
    store.researchWorkflowPhase === "submitted",
);

const showPlanKiosk = computed(
  () =>
    !!store.researchPlanDraft &&
    (showPlanReview.value || isGenerationInProgress.value),
);

const showCompletionViewer = computed(
  () =>
    (store.researchWorkflowPhase === "done" || store.isCompleted) &&
    !!store.researchPlanDraft,
);

const showResearchWorkflowCenter = computed(
  () =>
    (store.researchWorkflowPhase === "done" && !showCompletionViewer.value) ||
    store.researchWorkflowPhase === "failed" ||
    (store.isStreaming &&
      !showPlanGenerating.value &&
      !showPlanKiosk.value &&
      !showCompletionViewer.value),
);

const centerWelcomeReplace = computed(
  () => showPlanGenerating.value || showResearchWorkflowCenter.value,
);

const welcomeReplaceContainerClass = computed(() =>
  showPlanKiosk.value || showCompletionViewer.value
    ? "items-start justify-center px-0 py-2 sm:px-1 sm:py-3"
    : showBriefing.value
      ? "items-start justify-center px-1 py-2 sm:px-3 sm:py-3"
      : "items-center justify-center px-2 py-5 sm:px-4 sm:py-6",
);

const welcomeReplaceMaxWidthClass = computed(() =>
  showPlanKiosk.value || showCompletionViewer.value || showBriefing.value
    ? "max-w-[min(98vw,1920px)]"
    : "max-w-5xl",
);

const researchFlowStepperItems = [
  {
    title: "要件ヒアリング",
    icon: "material-symbols:hearing",
  },
  {
    title: "設計確定",
    icon: "material-symbols:rule-settings",
  },
  {
    title: "実行",
    icon: "material-symbols:play-circle-outline",
  },
  {
    title: "結果表示",
    icon: "material-symbols:fact-check-outline-rounded",
  },
];

const researchFlowStepIndex = computed((): number => {
  if (
    showCompletionViewer.value ||
    store.researchWorkflowPhase === "done" ||
    store.isCompleted
  ) {
    return 3;
  }
  if (
    isGenerationInProgress.value ||
    store.researchWorkflowPhase === "submitted" ||
    store.researchWorkflowPhase === "generating"
  ) {
    return 2;
  }
  if (
    showPlanGenerating.value ||
    showPlanKiosk.value ||
    showPlanReview.value ||
    store.researchWorkflowPhase === "plan_generating" ||
    store.researchWorkflowPhase === "plan_review" ||
    store.researchWorkflowPhase === "confirm_submit"
  ) {
    return 1;
  }
  return 0;
});

const workflowBadgeLabel = computed((): string | null => {
  switch (store.researchWorkflowPhase) {
    case "plan_generating":
      return "プラン作成中";
    case "plan_review":
      return "プラン確認";
    case "confirm_submit":
      return "プラン確認";
    case "submitted":
      return "受付済み · メール通知";
    case "generating":
      return "レポート生成中";
    case "done":
      return "完了";
    default:
      return null;
  }
});

const workflowCenterPhase = computed((): "working" | "complete" | "failed" => {
  if (store.isCompleted || store.researchWorkflowPhase === "done") {
    return "complete";
  }
  if (store.lastError) return "failed";
  return "working";
});

const showRunningModal = computed(
  () =>
    isGenerationInProgress.value &&
    !!store.sessionId &&
    !store.isCompleted &&
    store.researchWorkflowPhase !== "failed",
);

const runningModalMessage = computed((): string => {
  const lastJob = store.jobLog.at(-1);
  if (lastJob && typeof lastJob.message === "string" && lastJob.message.trim()) {
    return lastJob.message.trim();
  }
  const lastProgress = store.progressHistory.at(-1);
  if (lastProgress && typeof lastProgress.note === "string" && lastProgress.note.trim()) {
    return lastProgress.note.trim();
  }
  return "AI バディがリサーチを進めています…";
});

const completionReportEntry = computed(() =>
  [...artifactEntries.value]
    .reverse()
    .find(
      (entry) =>
        entry.meta.panelKind === "html" &&
        typeof entry.artifact.body === "string" &&
        entry.artifact.body.trim().length > 0,
    ) ?? null,
);

const completionReportHtml = computed(
  () => completionReportEntry.value?.artifact.body ?? null,
);

const completionReportTitle = computed(
  () =>
    completionReportEntry.value?.meta.title ??
    completionReportArtifact.value?.name ??
    null,
);

const completionReportArtifact = computed(() =>
  [...store.artifacts]
    .reverse()
    .find(
      (artifact) =>
        artifact.kind === "html" ||
        /research\.html$/i.test(artifact.name ?? ""),
    ) ?? null,
);

const completionReportStoragePath = computed(
  () => completionReportArtifact.value?.storageGcsPath ?? null,
);

const completionReportContentType = computed(
  () => completionReportArtifact.value?.contentType ?? "text/html",
);

onMounted(() => {
  void fileSpaceStore.ensureDefaultFileSpace().catch(() => {
    // invoke 時にも再試行する。UI は未接続表示のまま
  });
});

const fileSpaceConnected = computed(
  () =>
    fileSpaceStore.selectedFileSpaceStatusIsValid === true &&
    !!fileSpaceStore.selectedFileSpace?.name,
);

const fileSpaceTitle = computed(() =>
  fileSpaceConnected.value
    ? "組織ナレッジ (Agent Search) を参照します"
    : "データ環境が未接続です",
);

const readAgentStateString = (key: string): string | null => {
  const value = store.agentState[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const researchContextStatus = computed((): "ready" | "limited" => {
  const raw = store.agentState.context_status;
  if (raw === "ready" || raw === "limited") return raw;
  return fileSpaceConnected.value ? "ready" : "limited";
});

const researchContextWarning = computed((): string | null => {
  const explicit = readAgentStateString("context_warning");
  if (explicit) return explicit;
  if (researchContextStatus.value !== "limited") return null;
  if (!fileSpaceConnected.value) {
    return "データ環境 (fileSpace) を解決できないため、一般的なレポートになる可能性があります。";
  }
  return "企業コンテキストが一部不足しているため、レポートが一般論寄りになる可能性があります。";
});

const researchContextSummary = computed((): string | null => {
  const lineName = readAgentStateString("workspace_name");
  const fileSpaceId = readAgentStateString("file_space_id");
  const parts = [
    readAgentStateString("organization_name"),
    readAgentStateString("space_name"),
    lineName ? `ライン: ${lineName}` : null,
    fileSpaceId ? `fileSpace: ${fileSpaceId}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" / ") : null;
});

const contextSoftWarning = computed(() => {
  if (!showPlanKiosk.value && !isGenerationInProgress.value && !showCompletionViewer.value) {
    return null;
  }
  return researchContextWarning.value;
});

const showBriefing = computed(
  () => !store.briefingComplete && store.messages.length === 0,
);

const showArtifactAside = computed(
  () => artifactPanelOpen.value || artifactEntries.value.length > 0,
);

const panelMessages = computed((): AIRevisionAssistantMessage[] =>
  store.messages
    .filter((m) => m.role === "user" || m.role === "agent")
    .map((m) => ({
      key: m.id,
      role: m.role === "user" ? "user" : "assistant",
      text: m.text,
      createdAt: m.createdAt,
      status: m.isStreaming
        ? "processing"
        : m.role === "agent" &&
            store.lastError &&
            m.text.includes("⚠️")
          ? "failed"
          : undefined,
    })),
);

const runningPhase = computed(() =>
  store.phases.find((p) => p.status === "running"),
);

const moodText = computed(() => {
  if (store.researchWorkflowPhase === "plan_generating") {
    return "調査プランを組み立てています…";
  }
  if (store.researchWorkflowPhase === "plan_review") {
    return "疑問と懸念を確認し、すぐ生成開始できます";
  }
  if (store.researchWorkflowPhase === "confirm_submit") {
    return "疑問と懸念を確認し、すぐ生成開始できます";
  }
  if (store.researchWorkflowPhase === "submitted") {
    return "バックグラウンドで生成中 · 完了メールをお待ちください";
  }
  if (store.isStreaming || store.isAutoResponding) {
    return runningPhase.value
      ? `${runningPhase.value.label} を実行中…`
      : "考えてます…";
  }
  if (store.researchWorkflowPhase === "done" || store.isCompleted) {
    return "レポート生成が完了しました";
  }
  return "リサーチを依頼できます";
});

const welcomeBubbleText =
  "依頼 → プラン確認 → 生成開始 → メール通知の流れで進みます。";

watch(
  () => store.sessionId,
  () => {
    artifactPanel.closePanel();
  },
);

watch(
  () => store.isCompleted,
  (completed) => {
    if (completed) store.markResearchWorkflowDone();
  },
);

watch(
  () => store.isStreaming,
  (streaming, wasStreaming) => {
    if (wasStreaming && !streaming && store.sessionId) {
      sessionDebugRefreshToken.value += 1;
    }
  },
);

const onNewResearch = async () => {
  await aiStudio.startSession("research");
};

const onWorkspaceModeChange = (
  mode: Exclude<AiStudioJobKind, null>
): void => {
  void aiStudio.setWorkspaceMode(mode);
};

const onPlanSubmit = async (params: {
  plan: ResearchPlanDraft;
}) => {
  if (generationSubmitting.value || isGenerationInProgress.value) return;
  generationSubmitting.value = true;
  try {
    await store.advancePlanToConfirmSubmit({ plan: params.plan });
    await store.submitResearchGeneration({
      notificationEmail: store.notificationEmail ?? "",
    });
  } catch (error) {
    store.lastError =
      error instanceof Error ? error.message : "生成開始に失敗しました";
  } finally {
    generationSubmitting.value = false;
  }
};

const onSaveNotificationEmail = async (params: {
  notificationEmail: string;
}) => {
  if (savingNotificationEmail.value) return;
  savingNotificationEmail.value = true;
  try {
    await store.updateNotificationEmail({
      notificationEmail: params.notificationEmail,
    });
  } catch (error) {
    store.lastError =
      error instanceof Error ? error.message : "通知メール更新に失敗しました";
  } finally {
    savingNotificationEmail.value = false;
  }
};

const onBriefingFinalize = async (_prompt: string) => {
  if (briefingLaunching.value) return;
  briefingLaunching.value = true;
  try {
    await store.launchResearchFromBriefing({
      draft: researchBriefingDraftFromAgentDraft({
        draft: briefing.snapshotDraft(),
      }),
    });
  } catch (error) {
    store.lastError =
      error instanceof Error ? error.message : "リサーチ開始に失敗しました";
  } finally {
    briefingLaunching.value = false;
  }
};

</script>
