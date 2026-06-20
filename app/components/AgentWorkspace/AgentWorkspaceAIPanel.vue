<template>
  <EnAIRevisionAssistantPanel
    ref="panelRef"
    v-model="input"
    @paste="onPanelPaste"
    :messages="panelMessages"
    :can-submit="canSubmit"
    :can-edit-input="canEditInput"
    :can-send="canSend"
    :composer-has-text="composerHasText"
    :send-disabled-hint="sendDisabledHint"
    :is-sending="store.isStreaming"
    :quick-actions="panelQuickActions"
    :hide-welcome-quick-actions="
      store.activeAgent === 'sheet' ||
        showConsultationStartGate ||
        showApplicationScanGate ||
        store.activeAgent === 'image' ||
        store.activeAgent === 'writing'
    "
    :is-loading-quick-actions="isLoadingQuickActions"
    :max-quick-actions="4"
    :mood-text="moodText"
    :panel-title="panelTitle"
    :welcome-bubble-text="welcomeBubbleText"
    :input-placeholder="inputPlaceholder"
    :assistant-theme="assistantTheme"
    render-markdown
    input-size="comfortable"
    :autofocus-on-mount="
      store.activeAgent === 'consultation' && !showConsultationStartGate
    "
    :artifact-session-id="store.sessionId"
    :sheet-spreadsheet-url="store.spreadsheetUrl"
    :sheet-target-sheet-gid="store.targetSheetGid"
    :reference-documents="fileSpace.fileSpaceStore.documents"
    :hide-composer="hideWorkspaceComposer"
    :welcome-replace-max-width-class="welcomeReplaceMaxWidthClass"
    :welcome-replace-container-class="welcomeReplaceContainerClass"
    :hide-message-thread="workspaceHideMessageThread"
    :center-welcome-replace="centerWelcomeReplace"
    @send="onSend"
    @send-empty="onSendEmpty"
    @quick-action="onQuickAction"
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
        data-testid="ai-studio-back-to-hub"
        @click="emit('back-to-hub')"
      >
        一覧に戻る
      </EnButton>
    </template>

    <template
      v-if="showImageCreationModeInHeader"
      #header-inline
    >
      <EnBadge
        variant="soft"
        color="neutral"
        size="sm"
        custom-class="inline-flex max-w-[14rem] shrink-0 items-center gap-1.5 text-xs"
        data-testid="image-creation-mode-header"
      >
        <span class="truncate">{{ imageCreationModeLabel }}</span>
        <button
          type="button"
          class="shrink-0 text-xs font-semibold text-neutral-600 underline-offset-2 hover:text-neutral-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="store.isStreaming"
          data-testid="image-creation-mode-change"
          @click="onChangeImageCreationMode"
        >
          変更
        </button>
      </EnBadge>
    </template>

    <template #header-extra>
      <template v-if="store.activeAgent === 'sheet' && store.sheetModeSelected">
        <span
          class="inline-flex max-w-[10rem] flex-shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-900"
          data-testid="sheet-connection-header-badge"
        >
          <UIcon name="material-symbols:table" class="h-3 w-3 flex-shrink-0" />
          <span class="truncate">{{ store.targetSheetName }}</span>
        </span>
        <a
          v-if="store.spreadsheetUrl"
          :href="store.spreadsheetUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex flex-shrink-0 items-center gap-0.5 text-[10px] font-semibold text-green-700 underline-offset-2 hover:underline"
          data-testid="sheet-open-header-link"
        >
          <UIcon name="material-symbols:open-in-new" class="h-3 w-3" />
          開く
        </a>
      </template>
      <AiStudioWorkspaceModePicker
        v-if="workspaceMode"
        :model-value="workspaceMode"
        :disabled="store.isStreaming"
        @update:model-value="onWorkspaceModeChange"
      />
      <AdkSessionStateDebugPanel
        v-if="store.sessionId"
        :session-id="store.sessionId"
        :refresh-token="sessionDebugRefreshToken"
      />
    </template>

    <template
      v-if="
        showConsultationStartGate ||
        showImageKioskGate ||
        showImageWorkflowCenter ||
        showWritingKioskGate ||
        showWritingWorkflowCenter ||
        showDataAnalysisStartGate ||
        showWebPageBuilderGate ||
        showApplicationScanGate
      "
      #welcome-replace
    >
      <ConsultationStartKioskPanel
        v-if="showConsultationStartGate"
        v-model="input"
        :disabled="store.isStreaming"
        :knowledge-summary="consultationKnowledgeSummary"
        @submit="onSend"
      />
      <ImageCreationModePicker
        v-else-if="showImageCreationGate"
        :model-value="store.imageCreationMode"
        :disabled="store.isStreaming"
        @update:model-value="onImageCreationModeChange"
      />
      <ImageReferenceKioskPanel
        v-else-if="showImageReferenceGate"
        :state="coalesceImageReferenceState(store.imageReferenceState)"
        :disable-confirm="imageRefSources.isUploading.value"
        :is-uploading="imageRefSources.isUploading.value"
        :streaming-hint="
          store.isStreaming
            ? '応答生成中もリファレンスの追加・確定ができます。送信だけ完了後に行ってください。'
            : undefined
        "
        @open-knowledge="openImageKnowledgePicker"
        @confirm="onConfirmImageReferences"
        @edit="imageRefSources.editReferences()"
        @remove="imageRefSources.removeReference"
        @upload-files="onImageUploadFiles"
        @paste-from-clipboard="onImagePasteFromClipboard"
      />
      <ImagePromptKioskPanel
        v-else-if="showImageInitialPromptGate"
        v-model:subject="imagePromptSubject"
        v-model:usage="imagePromptUsage"
        :title="imagePromptKioskTitle"
        :subtitle="imagePromptKioskSubtitle"
        :subject-placeholder="imagePromptSubjectPlaceholder"
        :usage-placeholder="imagePromptUsagePlaceholder"
        :disabled="store.isStreaming"
        :can-send="imagePromptKioskCanSend"
        :is-sending="store.isStreaming"
        :send-hint="imagePromptKioskSendHint"
        :creation-mode="store.imageCreationMode"
        :reference-state="coalesceImageReferenceState(store.imageReferenceState)"
        @submit="onImagePromptSubmit"
        @edit-reference="imageRefSources.editReferences()"
      />
      <ImageStudioWorkflowCenter
        v-else-if="showImageWorkflowCenter"
        :phase="imageWorkflowCenterPhase"
        :workflow-phase="store.imageWorkflowPhase"
        :status-text="imageWorkflowStatusText"
        :result-text="imageWorkflowResultText"
        :result-body-markdown="imageWorkflowResultBodyMarkdown"
        :output-artifacts="imageWorkflowOutputArtifacts"
        :message-id="imageWorkflowLastAssistant?.id"
        :session-id="store.sessionId"
        :user-prompt="imageWorkflowLastUserPrompt"
        :activities="imageWorkflowActivities"
        :message-artifacts="imageWorkflowLastAssistant?.artifacts"
        :source-references="imageWorkflowLastAssistant?.sourceReferences"
        :grounding-metadata="imageWorkflowLastAssistant?.groundingMetadata"
        :reference-documents="fileSpace.fileSpaceStore.documents"
      />
      <WritingReferenceKioskPanel
        v-else-if="showWritingReferenceGate"
        key="writing-reference"
        :state="coalesceWritingReferenceState(store.writingReferenceState)"
        :accept-mime-types="fileSpace.acceptableMimeTypes"
        :chip-icon-for="fileSpace.chipIconFor"
        :disable-confirm="writingRefSources.isUploading.value"
        :is-uploading="writingRefSources.isUploading.value"
        :streaming-hint="
          store.isStreaming
            ? '応答生成中も参考資料の追加・確定ができます。抽出は完了後に行ってください。'
            : undefined
        "
        @open-knowledge="openWritingKnowledgePicker"
        @confirm="onWritingConfirmReference"
        @edit="writingRefSources.editReferences()"
        @remove="writingRefSources.removeReference"
        @upload-files="onWritingUploadFiles"
        @paste-from-clipboard="onWritingPasteFromClipboard"
      />
      <WritingFormKioskPanel
        v-else-if="showWritingFormatExtractGate"
        key="writing-extract"
        mode="extract"
        phase="format_review"
        :form="store.writingForm"
        :reference-count="store.writingReferenceState.attachments.length"
        :disabled="store.isStreaming"
        :can-extract="!store.isStreaming"
        :is-extracting="store.isStreaming"
        @edit-reference="writingRefSources.editReferences()"
        @extract-schema="onWritingExtractSchema"
      />
      <WritingFormKioskPanel
        v-else-if="showWritingFormatReviewGate"
        key="writing-format-review"
        mode="format_review"
        phase="format_review"
        :form="store.writingForm"
        :reference-attachments="coalesceWritingReferenceState(store.writingReferenceState).attachments"
        :disabled="store.isStreaming"
        :is-generating="store.isStreaming"
        @update-form-fields="onWritingFormFieldsUpdate"
        @confirm-schema="onWritingConfirmSchema"
      />
      <WritingFormKioskPanel
        v-else-if="showWritingDoneGate"
        key="writing-done"
        mode="done"
        phase="done"
        :form="store.writingForm"
        :messages="store.messages"
        :source-references="writingWorkflowLastAssistant?.sourceReferences"
        :grounding-metadata="writingWorkflowLastAssistant?.groundingMetadata"
        :reference-documents="fileSpace.fileSpaceStore.documents"
      />
      <WritingStudioWorkflowCenter
        v-else-if="showWritingWorkflowCenter"
        key="writing-generating"
        :phase="writingWorkflowCenterPhase"
        :workflow-action="writingWorkflowAction"
        :status-text="writingWorkflowStatusText"
        :result-text="writingWorkflowResultText"
        :result-body-markdown="writingWorkflowResultBodyMarkdown"
        :activities="writingWorkflowActivities"
      />
      <DataAnalysisStartKioskPanel
        v-else-if="showDataAnalysisStartGate"
        v-model="input"
        :disabled="store.isStreaming"
        :knowledge-summary="consultationKnowledgeSummary"
        @submit="onSend"
      />
      <WebPageBuilderKioskPanel
        v-else-if="showWebPageBuilderGate"
        :fields="store.webPageFields"
        :disabled="store.isStreaming"
        @submit="onWebPageBuilderSubmit"
      />
      <ApplicationScanKioskPanel
        v-else-if="showApplicationScanGate"
        :fields="store.applicationScanFields"
        :disabled="store.isStreaming"
        @submit="onApplicationScanSubmit"
      />
    </template>

    <template
      v-if="
        store.activeAgent !== 'sheet' &&
          store.activeAgent !== 'image' &&
          store.activeAgent !== 'writing'
      "
      #welcome-extra
    >
      <div
        class="relative w-full rounded-xl border px-3 py-2.5 text-left text-[11px] leading-snug"
        :class="fileSpace.welcomeFileSpaceCardClass.value"
      >
        <div class="flex items-start gap-2">
          <UIcon
            :name="fileSpace.welcomeFileSpaceIcon.value"
            class="mt-0.5 h-4 w-4 flex-shrink-0"
            :class="fileSpace.welcomeFileSpaceIconClass.value"
          />
          <div class="min-w-0">
            <p class="font-semibold">
              {{ fileSpace.welcomeFileSpaceTitle.value }}
            </p>
            <FileSpaceWelcomeCategories
              v-if="fileSpace.welcomeFileSpaceCategories.value.length > 0"
              :categories="fileSpace.welcomeFileSpaceCategories.value"
              :footnote="fileSpace.welcomeFileSpaceDescription.value"
            />
            <p
              v-else
              class="mt-0.5 opacity-90"
            >
              {{ fileSpace.welcomeFileSpaceDescription.value }}
            </p>
          </div>
        </div>
      </div>
    </template>

    <template
      v-if="showStepWorkspaceFormContext"
      #pending-preview
    >
      <div ref="formContextAnchor">
        <AiStudioWorkspaceFormContext
        :accept-mime-types="fileSpace.acceptableMimeTypes"
        :chip-icon-for="fileSpace.chipIconFor"
        :sheet-connection-url-label="sheetConnectionUrlLabel"
        @image-creation-mode="onImageCreationModeChange"
        @change-image-creation-mode="onChangeImageCreationMode"
        @open-image-knowledge="openImageKnowledgePicker"
        @confirm-image-references="onConfirmImageReferences"
        @image-upload-files="onImageUploadFiles"
        @image-paste-clipboard="onImagePasteFromClipboard"
        @change-sheet-connection="onChangeSheetConnection"
        />
      </div>
    </template>

    <template #attachments>
      <div
        v-if="store.activeAgent !== 'writing' && selectedKnowledge.length > 0"
        class="mb-1.5 flex flex-wrap items-center gap-1.5"
      >
        <span class="text-[10px] font-semibold uppercase tracking-wide text-sky-600">
          参照知識
        </span>
        <span
          v-for="item in selectedKnowledge"
          :key="item.id"
          class="inline-flex max-w-full items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[11px] text-sky-900 ring-1 ring-sky-200"
        >
          <UIcon
            name="material-symbols:menu-book-outline"
            class="h-3.5 w-3.5 flex-shrink-0"
          />
          <button
            type="button"
            class="max-w-[180px] truncate text-left hover:underline"
            :title="`${item.name} · クリックでプレビュー`"
            @click="openKnowledgeChipPreview(item)"
          >
            {{ item.name }}
          </button>
          <button
            type="button"
            class="ml-0.5 -mr-0.5 flex-shrink-0 rounded p-0.5 hover:bg-sky-200"
            title="参照から外す"
            @click="removeSelectedKnowledge(item.id)"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-3 w-3" />
          </button>
        </span>
        <button
          type="button"
          class="text-[10px] font-semibold text-sky-700 underline-offset-2 hover:underline"
          @click="openKnowledgePicker"
        >
          編集
        </button>
      </div>
      <div
        v-if="
          store.activeAgent !== 'writing' &&
            store.activeAgent !== 'image' &&
            fileSpace.attachedFiles.value.length > 0
        "
        class="flex flex-wrap gap-1.5"
      >
        <span
          v-for="(f, i) in fileSpace.attachedFiles.value"
          :key="f.gcsPath + i"
          class="inline-flex max-w-full items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-[11px] text-purple-800 ring-1 ring-purple-200"
        >
          <UIcon
            :name="fileSpace.chipIconFor(f.mimeType)"
            class="h-3.5 w-3.5 flex-shrink-0"
          />
          <span class="max-w-[160px] truncate" :title="f.fileName">{{
            f.fileName
          }}</span>
          <button
            type="button"
            class="ml-0.5 -mr-0.5 flex-shrink-0 rounded p-0.5 hover:bg-purple-200"
            title="添付を解除"
            @click="fileSpace.removeAttachment(i)"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-3 w-3" />
          </button>
        </span>
      </div>
    </template>

    <template #footer-actions>
      <UButton
        v-if="store.activeAgent === 'consultation'"
        color="neutral"
        variant="soft"
        size="sm"
        icon="material-symbols:menu-book-outline"
        label="知識追加"
        :disabled="store.isStreaming || !fileSpace.isFileSpaceConnected.value"
        aria-label="知識追加"
        title="取り込み済み知識から参照資料を選択"
        @click="openKnowledgePicker"
      />
      <UDropdownMenu
        v-if="
          store.activeAgent !== 'writing' && store.activeAgent !== 'image'
        "
        :items="fileSpace.attachMenuItems.value"
        :content="{ align: 'end' }"
        :ui="{ content: 'z-[60]' }"
      >
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-heroicons-paper-clip"
          label="ファイル追加"
          :disabled="store.isStreaming || fileSpace.isUploading.value"
          :loading="fileSpace.isUploading.value"
          aria-label="ファイル追加"
          :title="
            fileSpace.isFileSpaceConnected.value
              ? 'ファイルを添付'
              : 'FileSpace 接続後に添付可能'
          "
        />
      </UDropdownMenu>
    </template>
  </EnAIRevisionAssistantPanel>

  <KnowledgePickerModal
    v-if="store.activeAgent === 'consultation'"
    v-model:open="knowledgePickerOpen"
    v-model="selectedKnowledge"
    mode="consultation-turn"
    :documents="fileSpace.fileSpaceStore.documents"
    :is-loading="fileSpace.fileSpaceStore.isLoadingDocuments"
  />

  <KnowledgePickerModal
    v-if="store.activeAgent === 'writing'"
    v-model:open="writingKnowledgePickerOpen"
    v-model="writingKnowledgeDraft"
    mode="consultation-turn"
    :documents="fileSpace.fileSpaceStore.documents"
    :is-loading="fileSpace.fileSpaceStore.isLoadingDocuments"
    @update:model-value="onWritingKnowledgePicked"
  />

  <KnowledgePickerModal
    v-if="store.activeAgent === 'image'"
    v-model:open="imageKnowledgePickerOpen"
    v-model="imageKnowledgeDraft"
    mode="image-reference"
    :documents="fileSpace.fileSpaceStore.documents"
    :is-loading="fileSpace.fileSpaceStore.isLoadingDocuments"
    @update:model-value="onImageKnowledgePicked"
  />

  <input
    :ref="(el) => { fileSpace.fileInputRef.value = el as HTMLInputElement | null }"
    type="file"
    class="hidden"
    :accept="fileSpace.acceptableMimeTypes"
    multiple
    @change="fileSpace.onFilesSelected"
  >

  <AIChatFilePickerModal
    v-model:open="fileSpace.pickerOpen.value"
    :documents="fileSpace.fileSpaceStore.documents"
    :already-attached="fileSpace.attachedFiles.value"
    :is-loading="fileSpace.fileSpaceStore.isLoadingDocuments"
    @attach="fileSpace.onPickerAttach"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import EnBadge from "@components/EnBadge.vue";
import EnAIRevisionAssistantPanel, {
  type AIRevisionAssistantMessage,
} from "@components/EnAIRevisionAssistantPanel.vue";
import AdkSessionStateDebugPanel from "@components/AgentWorkspace/AdkSessionStateDebugPanel.vue";
import AiStudioWorkspaceModePicker from "@components/AgentWorkspace/AiStudioWorkspaceModePicker.vue";
import AiStudioWorkspaceFormContext from "@components/AgentWorkspace/AiStudioWorkspaceFormContext.vue";
import ConsultationStartKioskPanel from "@components/AgentWorkspace/ConsultationStartKioskPanel.vue";
import ImageCreationModePicker from "@components/AgentWorkspace/ImageCreationModePicker.vue";
import ImageReferenceKioskPanel from "@components/AgentWorkspace/ImageReferenceKioskPanel.vue";
import ImagePromptKioskPanel from "@components/AgentWorkspace/ImagePromptKioskPanel.vue";
import ImageStudioWorkflowCenter from "@components/AgentWorkspace/ImageStudioWorkflowCenter.vue";
import WritingReferenceKioskPanel from "@components/AgentWorkspace/WritingReferenceKioskPanel.vue";
import WritingFormKioskPanel from "@components/AgentWorkspace/WritingFormKioskPanel.vue";
import WritingStudioWorkflowCenter from "@components/AgentWorkspace/WritingStudioWorkflowCenter.vue";
import DataAnalysisStartKioskPanel from "@components/AgentWorkspace/DataAnalysisStartKioskPanel.vue";
import WebPageBuilderKioskPanel from "@components/AgentWorkspace/WebPageBuilderKioskPanel.vue";
import ApplicationScanKioskPanel from "@components/AgentWorkspace/ApplicationScanKioskPanel.vue";
import type { WebPageBuilderFields } from "@utils/webPageWorkspaceState";
import type { ApplicationScanFields } from "@utils/applicationScanWorkspaceState";
import { useWritingReferenceSources } from "@composables/useWritingReferenceSources";
import { coalesceWritingReferenceState } from "@utils/writingWorkspaceState";
import type { WritingFormField } from "@models/writingForm";
import EnButton from "@components/EnButton.vue";
import KnowledgePickerModal from "@components/knowledge/KnowledgePickerModal.vue";
import { useImageReferenceSources } from "@composables/useImageReferenceSources";
import { shouldPreventDefaultOnImagePaste } from "@utils/clipboardImages";
import AIChatFilePickerModal from "@components/masterEditor/AIChatFilePickerModal.vue";
import { useKnowledgePreview } from "@composables/useKnowledgePreview";
import { useMasterEditorAIFileSpace } from "@composables/useMasterEditorAIFileSpace";
import FileSpaceWelcomeCategories from "@components/AgentWorkspace/FileSpaceWelcomeCategories.vue";
import { useAiStudioQuickActions } from "@composables/useAiStudioQuickActions";
import { useAiStudioStore } from "@stores/aiStudio";
import {
  isAiStudioWorkspaceMode,
  type AiStudioWorkspaceMode,
  resolveAiStudioPanelTitle,
} from "@constants/aiStudioModes";
import type { AdkAgentMode } from "@composables/useAgentSseClient";
import type { SelectedKnowledgeRef } from "@utils/consultationKnowledge";
import { selectedKnowledgeToKnowledgeAsset } from "@utils/knowledgeAssetState";
import {
  coalesceImageReferenceState,
  imageCreationModeLabel as formatImageCreationModeLabel,
  type ImageCreationMode,
} from "@utils/imageReference";
import {
  imagePrimaryHasReference,
  panelPrimaryArtifactsFromMessage,
  sanitizeImageWorkflowResultMarkdown,
} from "@utils/imageStudioState";
import {
  buildImageStudioInvokePrompt,
  imageStudioPromptFieldsComplete,
} from "@utils/imageStudioPromptMerge";

const props = withDefaults(
  defineProps<{
    /** AIスタジオ共通 TOP（セッション一覧ハブ）へ戻る */
    showHubBackButton?: boolean;
  }>(),
  { showHubBackButton: false }
);

const emit = defineEmits<{
  (e: "back-to-hub"): void;
}>();

const store = useAiStudioStore();
const fileSpace = useMasterEditorAIFileSpace();

const showConsultationStartGate = computed(
  () => store.activeAgent === "consultation" && store.messages.length === 0
);

const showDataAnalysisStartGate = computed(
  () => store.activeAgent === "data_analysis" && store.messages.length === 0
);

const showWebPageBuilderGate = computed(
  () => store.activeAgent === "web_page" && store.messages.length === 0
);

const showApplicationScanGate = computed(
  () => store.activeAgent === "application_scan" && store.messages.length === 0
);

const consultationKnowledgeSummary = computed(() =>
  fileSpace.isFileSpaceConnected.value
    ? `${fileSpace.documentCount.value} 件の社内ドキュメントを参照しながら回答します`
    : "社内ナレッジ未接続でも相談を開始できます"
);

/** activeAgent / jobKind のずれを吸収（Firestore hydrate 直後など） */
const workspaceMode = computed((): AiStudioWorkspaceMode | null => {
  if (isAiStudioWorkspaceMode(store.activeAgent)) return store.activeAgent;
  if (isAiStudioWorkspaceMode(store.jobKind)) return store.jobKind;
  return null;
});

const composerHasText = computed(() => input.value.trim().length > 0);
const { quickActions, isLoadingQuickActions } = useAiStudioQuickActions({
  fileSpaceDocCount: () => fileSpace.documentCount.value,
});

const panelQuickActions = computed(() =>
  store.activeAgent === "sheet" ||
    store.activeAgent === "image" ||
    store.activeAgent === "writing"
    ? []
    : quickActions.value
);

const hasStepWorkspace = computed(
  () =>
    store.activeAgent === "image" ||
    store.activeAgent === "writing" ||
    store.activeAgent === "sheet"
);

const showImageCreationGate = computed(
  () => store.activeAgent === "image" && !store.imageModeSelected
);

const hasImageUserMessage = computed(() =>
  store.messages.some((message) => message.role === "user")
);

const showImageReferenceGate = computed(() => {
  if (store.activeAgent !== "image" || !store.imageModeSelected) return false;
  if (store.imageCreationMode !== "reference") return false;
  if (hasImageUserMessage.value) return false;
  return coalesceImageReferenceState(store.imageReferenceState).status !== "complete";
});

const imageHideMessageThread = computed(
  () =>
    store.activeAgent === "image" &&
    (store.imageModeSelected ||
      hasImageUserMessage.value ||
      showImageCreationGate.value)
);

const imageCenterWelcomeReplace = computed(
  () => imageHideMessageThread.value && !showImageKioskGate.value
);

const showWritingReferenceGate = computed(
  () =>
    store.activeAgent === "writing" &&
    coalesceWritingReferenceState(store.writingReferenceState).status !==
      "complete"
);

const showWritingFormatExtractGate = computed(
  () =>
    store.activeAgent === "writing" &&
    store.writingReferenceState.status === "complete" &&
    store.writingPhase === "format_review" &&
    store.writingForm.fields.length === 0
);

const showWritingFormatReviewGate = computed(
  () =>
    store.activeAgent === "writing" &&
    store.writingPhase === "format_review" &&
    store.writingForm.fields.length > 0
);

const showWritingFillingGate = computed(() => false);

const showWritingDoneGate = computed(
  () =>
    store.activeAgent === "writing" &&
    store.writingPhase === "done" &&
    !store.isStreaming &&
    store.writingForm.fields.length > 0
);

const showWritingKioskGate = computed(
  () =>
    showWritingReferenceGate.value ||
    showWritingFormatExtractGate.value ||
    showWritingFormatReviewGate.value ||
    showWritingDoneGate.value
);

const writingWorkflowLastAssistant = computed(() => {
  for (let i = store.messages.length - 1; i >= 0; i -= 1) {
    const message = store.messages[i];
    if (message?.role === "assistant") return message;
  }
  return undefined;
});

const writingWorkflowActivities = computed(
  () => writingWorkflowLastAssistant.value?.activities ?? []
);

const writingWorkflowResultText = computed((): string | undefined => {
  const text = writingWorkflowLastAssistant.value?.text?.trim();
  return text || undefined;
});

const writingWorkflowResultBodyMarkdown = computed((): string | undefined => {
  const text = writingWorkflowResultText.value;
  if (!text || text.startsWith("⚠️")) return undefined;
  return text;
});

const writingWorkflowAction = computed(():
  | "extract_schema"
  | "generate_document"
  | null => {
  if (store.isStreaming) {
    if (store.writingPhase === "filling") return "generate_document";
    return "extract_schema";
  }
  if (store.writingPhase === "done") return "generate_document";
  return null;
});

const writingWorkflowCenterPhase = computed((): "working" | "complete" | "failed" => {
  if (store.isStreaming) return "working";
  if (store.writingPhase === "done") return "complete";
  const text = writingWorkflowResultText.value ?? "";
  if (text.startsWith("⚠️") || Boolean(store.lastError)) return "failed";
  return "working";
});

/** 生成中はワークフロー、完了後は結果パネル */
const showWritingWorkflowCenter = computed(
  () =>
    store.activeAgent === "writing" &&
    store.isStreaming &&
    store.writingPhase === "filling"
);

const writingHideMessageThread = computed(
  () =>
    store.activeAgent === "writing" &&
    (showWritingKioskGate.value ||
      showWritingWorkflowCenter.value ||
      store.isStreaming ||
      store.writingPhase === "done")
);

const writingCenterWelcomeReplace = computed(
  () => store.activeAgent === "writing" && writingHideMessageThread.value
);

const workspaceHideMessageThread = computed(
  () =>
    showConsultationStartGate.value ||
    showApplicationScanGate.value ||
    imageHideMessageThread.value ||
    writingHideMessageThread.value
);

const centerWelcomeReplace = computed(
  () =>
    showConsultationStartGate.value ||
    showApplicationScanGate.value ||
    imageCenterWelcomeReplace.value ||
    writingCenterWelcomeReplace.value
);

const showImageWorkflowCenter = computed(
  () =>
    imageCenterWelcomeReplace.value &&
    (store.isStreaming || hasImageUserMessage.value)
);

const imageWorkflowLastAssistant = computed(() => {
  for (let i = store.messages.length - 1; i >= 0; i -= 1) {
    const message = store.messages[i];
    if (message?.role === "assistant") return message;
  }
  return undefined;
});

const imageWorkflowLastUserPrompt = computed((): string | undefined => {
  for (let i = store.messages.length - 1; i >= 0; i -= 1) {
    const message = store.messages[i];
    if (message?.role === "user" && message.text.trim()) {
      return message.text.trim();
    }
  }
  return undefined;
});

const imageWorkflowActivities = computed(
  () => imageWorkflowLastAssistant.value?.activities ?? []
);

const imageWorkflowResultText = computed((): string | undefined => {
  const text = imageWorkflowLastAssistant.value?.text?.trim();
  return text || undefined;
});

const imageWorkflowResultBodyMarkdown = computed((): string | undefined => {
  const text = imageWorkflowResultText.value;
  if (!text) return undefined;
  const sanitized = sanitizeImageWorkflowResultMarkdown({
    text,
    artifacts: imageWorkflowLastAssistant.value?.artifacts,
  });
  return sanitized || undefined;
});

const imageWorkflowOutputArtifacts = computed(() =>
  panelPrimaryArtifactsFromMessage({
    artifacts: imageWorkflowLastAssistant.value?.artifacts,
  })
);

const imageWorkflowLooksLikeReferenceError = (text: string): boolean =>
  /参照画像が未確定|参照を確定/.test(text);

const imageWorkflowCenterPhase = computed((): "working" | "complete" | "failed" => {
  if (store.isStreaming) return "working";
  const text = imageWorkflowResultText.value ?? "";
  if (text.startsWith("⚠️") || imageWorkflowLooksLikeReferenceError(text)) {
    return "failed";
  }
  if (imageWorkflowLastAssistant.value) return "complete";
  return "working";
});

const imagePromptPrerequisitesMet = computed((): boolean => {
  if (!store.imageModeSelected) return false;
  if (store.imageCreationMode === "reference") {
    return (
      coalesceImageReferenceState(store.imageReferenceState).status ===
      "complete"
    );
  }
  return store.imageCreationMode === "scratch";
});

const showImageInitialPromptGate = computed(
  () =>
    store.activeAgent === "image" &&
    store.imageWorkflowPhase === "create" &&
    !hasImageUserMessage.value &&
    imagePromptPrerequisitesMet.value
);

const showImageKioskGate = computed(
  () =>
    showImageCreationGate.value ||
    showImageReferenceGate.value ||
    showImageInitialPromptGate.value
);

/** お手本＋プロンプトの2カラムはやや広め、書類キオスクはフル幅 */
const welcomeReplaceMaxWidthClass = computed(() => {
  if (showConsultationStartGate.value || showApplicationScanGate.value) {
    return "max-w-none";
  }
  if (showWritingKioskGate.value) {
    return "max-w-none";
  }
  if (showImageWorkflowCenter.value || showWritingWorkflowCenter.value) {
    return "max-w-3xl sm:max-w-4xl";
  }
  if (
    showImageInitialPromptGate.value &&
    store.imageCreationMode === "reference"
  ) {
    return "max-w-4xl";
  }
  if (store.activeAgent === "writing") {
    return "max-w-none";
  }
  return "max-w-2xl";
});

const welcomeReplaceContainerClass = computed(() => {
  if (showWritingKioskGate.value || showApplicationScanGate.value) {
    return "items-start justify-stretch px-3 py-4 sm:px-5 sm:py-5";
  }
  return "items-center justify-center";
});

const showStepWorkspaceFormContext = computed(() => {
  if (!hasStepWorkspace.value) return false;
  if (store.activeAgent === "writing") return false;
  if (showImageKioskGate.value) return false;
  if (store.activeAgent === "image" && hasImageUserMessage.value) {
    return false;
  }
  return true;
});

/** キオスク中 or 初回送信後は下部コンポーザーを出さない */
const hideImageComposer = computed(
  () =>
    showImageKioskGate.value ||
    (store.activeAgent === "image" &&
      store.imageModeSelected &&
      hasImageUserMessage.value)
);

/** 文書はキオスク専用 UI（下部テキスト送信なし） */
const hideWorkspaceComposer = computed(
  () =>
    showConsultationStartGate.value ||
    showApplicationScanGate.value ||
    hideImageComposer.value ||
    store.activeAgent === "writing"
);

const imagePromptKioskTitle = computed((): string => "何を生成しますか??");

const imagePromptKioskSubtitle = computed((): string =>
  store.imageCreationMode === "reference"
    ? "2つの項目を入力してね。お手本の配置はそのまま活かします"
    : "2つの項目を入力して、画像生成を始めましょう"
);

const imagePromptSubjectPlaceholder = computed((): string =>
  store.imageCreationMode === "reference"
    ? "例: みりん干しジャムの販促チラシ（春の特売キャンペーン）"
    : "例: 夕焼けを背景にしたサービス紹介イラスト、横長"
);

const imagePromptUsagePlaceholder = computed((): string =>
  store.imageCreationMode === "reference"
    ? "例: 店頭POP・チラシ配布・SNS告知"
    : "例: Webバナー、パンフレット表紙、社内プレゼン資料"
);

const imagePromptKioskCanSend = computed(
  () =>
    imageStudioPromptFieldsComplete({
      subject: imagePromptSubject.value,
      usage: imagePromptUsage.value,
    }) && !store.isStreaming
);

const imagePromptKioskSendHint = computed((): string | undefined => {
  if (store.isStreaming) return "画像を生成中です…";
  const hasSubject = imagePromptSubject.value.trim().length > 0;
  const hasUsage = imagePromptUsage.value.trim().length > 0;
  if (!hasSubject && !hasUsage) {
    return "2つの項目を入力すると画像生成を開始できます";
  }
  if (!hasSubject) return "「何の画像を生成しますか?」を入力してください";
  if (!hasUsage) return "「画像を何に使用しますか?」を入力してください";
  return undefined;
});

const showImageCreationModeInHeader = computed(
  () =>
    store.activeAgent === "image" &&
    store.imageModeSelected &&
    Boolean(store.imageCreationMode)
);

const input = ref("");
const imagePromptSubject = ref("");
const imagePromptUsage = ref("");
const formContextAnchor = ref<HTMLElement | null>(null);
const knowledgePickerOpen = ref(false);
const selectedKnowledge = ref<SelectedKnowledgeRef[]>([]);
const imageKnowledgePickerOpen = ref(false);
const imageKnowledgeDraft = ref<SelectedKnowledgeRef[]>([]);
const writingKnowledgePickerOpen = ref(false);
const writingKnowledgeDraft = ref<SelectedKnowledgeRef[]>([]);

const writingRefSources = useWritingReferenceSources({
  getState: () =>
    coalesceWritingReferenceState(store.writingReferenceState),
  setState: (state) => store.setWritingReferenceState(state),
});

const imageRefSources = useImageReferenceSources({
  getState: () => store.imageReferenceState,
  setState: (state) => store.setImageReferenceState(state),
});
const sessionDebugRefreshToken = ref(0);
const panelRef = ref<InstanceType<typeof EnAIRevisionAssistantPanel> | null>(
  null
);

const focusConsultationInput = async (): Promise<void> => {
  if (store.activeAgent !== "consultation" || store.isStreaming) return;
  const panel = panelRef.value;
  if (panel?.focusInputWithRetry) {
    await panel.focusInputWithRetry();
    return;
  }
  await nextTick();
  panel?.focusInput?.();
  for (let i = 0; i < 6; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (panelRef.value?.focusInput?.()) return;
  }
};

watch(
  () => store.activeAgent,
  (agent) => {
    if (agent === "consultation") {
      void focusConsultationInput();
    }
  }
);

watch(
  () => panelRef.value,
  (panel) => {
    if (panel && store.activeAgent === "consultation") {
      void focusConsultationInput();
    }
  },
  { flush: "post" }
);

onMounted(() => {
  if (store.activeAgent === "consultation") {
    void focusConsultationInput();
  }
});

watch(
  () => store.sessionId,
  (sessionId) => {
    selectedKnowledge.value = [];
    if (sessionId && store.activeAgent === "consultation") {
      void focusConsultationInput();
    }
  }
);

const openKnowledgePicker = (): void => {
  if (!fileSpace.isFileSpaceConnected.value) return;
  knowledgePickerOpen.value = true;
};

const openImageKnowledgePicker = (): void => {
  if (fileSpace.isLoadingFileSpace.value) {
    toast.add({
      title: "ナレッジを接続しています",
      description: "しばらく待ってから再度お試しください。",
      color: "info",
    });
    return;
  }
  if (!fileSpace.isFileSpaceConnected.value) {
    toast.add({
      title: "ナレッジに接続できません",
      description:
        "データソース画面で資料を登録するか、画像は「ファイル」または「クリップボードから貼り付け」で追加してください。",
      color: "warning",
    });
    return;
  }
  imageKnowledgeDraft.value = [];
  imageKnowledgePickerOpen.value = true;
};

const onImagePasteFromClipboard = async (): Promise<void> => {
  const added = await imageRefSources.addFromClipboardRead();
  if (added) {
    toast.add({
      title: "クリップボードから画像を追加しました",
      color: "success",
    });
    return;
  }
  toast.add({
    title: "クリップボードに画像がありません",
    description:
      "スクリーンショット等をコピーしてから「クリップボードから貼り付け」を押すか、ファイルをアップロードしてください。",
    color: "warning",
  });
};

const onImageUploadFiles = async (files: File[]): Promise<void> => {
  try {
    await imageRefSources.addFromUploadFiles(files);
    if (store.imageReferenceState.references.length > 0) {
      toast.add({
        title: "画像を追加しました",
        color: "success",
      });
    }
  } catch (error) {
    toast.add({
      title: "アップロードに失敗しました",
      description:
        error instanceof Error ? error.message : "しばらく待って再試行してください。",
      color: "error",
    });
  }
};

const onImageKnowledgePicked = (items: SelectedKnowledgeRef[]): void => {
  const before = store.imageReferenceState.references.length;
  imageRefSources.addFromKnowledge(
    items.map((item) => selectedKnowledgeToKnowledgeAsset(item))
  );
  const after = store.imageReferenceState.references.length;
  if (after > before) {
    toast.add({
      title: "ナレッジから画像を追加しました",
      color: "success",
    });
    return;
  }
  if (items.length > 0) {
    toast.add({
      title: "画像ファイルを選んでください",
      description: "ナレッジから画像（PNG/JPEG 等）のみ追加できます。",
      color: "warning",
    });
  }
};

const toast = useToast();

const onConfirmImageReferences = async (): Promise<void> => {
  if (!imageRefSources.confirmReferences()) return;
  await store.persistCurrentSession();
  toast.add({
    title: "リファレンスを確定しました",
    description: "続けて、何を生成するか入力して画像生成を開始してください。",
    color: "success",
  });
};

const onWorkspaceModeChange = (mode: AdkAgentMode): void => {
  void store.setWorkspaceMode(mode);
};

const onImageCreationModeChange = (mode: ImageCreationMode): void => {
  store.setImageCreationMode(mode);
  void nextTick(() => {
    panelRef.value?.focusInput?.();
  });
};

const onSendEmpty = (): void => {
  if (store.activeAgent === "image") {
    toast.add({
      title: "プロンプトを入力してください",
      description:
        store.imageCreationMode === "scratch"
          ? "例: 清潔感のある青系グラデーションの製品バナー、16:9"
          : "お手本を元に、どこをどう変えたいかを書いてください。",
      color: "warning",
    });
    return;
  }
  toast.add({
    title: "メッセージを入力してください",
    color: "warning",
  });
};

const sheetConnectionUrlLabel = computed(() => {
  const url = store.spreadsheetUrl ?? "";
  if (!url) return "スプレッドシート";
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname.slice(0, 24) + "…";
  } catch {
    return url.length > 36 ? `${url.slice(0, 36)}…` : url;
  }
});

const scrollToFormContext = (): void => {
  void nextTick(() => {
    formContextAnchor.value?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  });
};

const onChangeSheetConnection = (): void => {
  store.requireSheetConnection();
  scrollToFormContext();
};

const onWebPageBuilderSubmit = (fields: WebPageBuilderFields): void => {
  void store.startWebPageBuilder(fields);
};

const onApplicationScanSubmit = (fields: ApplicationScanFields): void => {
  void store.startApplicationScan(fields);
};

const onChangeImageCreationMode = (): void => {
  store.resetImageCreationMode();
  scrollToFormContext();
};

const imageCreationModeLabel = computed(() =>
  formatImageCreationModeLabel(store.imageCreationMode)
);

/** 入力欄の編集可否（画像生成中も下書き入力は可能） */
const canSubmit = computed(() => {
  const mode = workspaceMode.value;
  if (mode === "writing") return false;
  if (mode === "image" && !store.imageModeSelected) return false;
  if (mode === "sheet" && !store.sheetModeSelected) return false;
  if (store.isStreaming && mode !== "image") return false;
  return true;
});

/** 文書は専用フォームのみ。画像お手本は参照確定後に入力可 */
const canEditInput = computed(() => {
  const mode = workspaceMode.value;
  if (mode === "writing") return false;
  if (mode === "image" && store.imageModeSelected) {
    if (store.imageCreationMode === "reference") {
      return (
        coalesceImageReferenceState(store.imageReferenceState).status ===
        "complete"
      );
    }
    return true;
  }
  return canSubmit.value;
});

/** 送信ボタン・Shift+Enter（生成完了まで不可） */
const canSend = computed(() => {
  const mode = workspaceMode.value;
  if (mode === "writing") return false;
  if (store.isStreaming) return false;
  if (mode === "sheet" && !store.sheetModeSelected) return false;
  if (mode === "image" && !store.imageModeSelected) return false;
  if (mode === "image" && store.imageWorkflowPhase === "retouch") {
    return imagePrimaryHasReference({
      artifactId: store.primaryArtifactId,
      adkFilename: store.primaryAdkFilename,
      artifactVersion: store.primaryArtifactVersion,
    });
  }
  const imageRef = coalesceImageReferenceState(store.imageReferenceState);
  if (
    mode === "image" &&
    store.imageCreationMode === "reference" &&
    imageRef.status !== "complete"
  ) {
    return false;
  }
  return mode !== null;
});

/** 送信ボタンが押せないときの理由（ツールチップ用） */
const sendDisabledHint = computed((): string | undefined => {
  if (store.isStreaming) {
    return "画像の生成が完了するまでお待ちください";
  }
  const mode = workspaceMode.value;
  if (mode === "image" && !store.imageModeSelected) {
    return "上で「0から新規」か「お手本画像を元に作成」を選んでください";
  }
  const imageRef = coalesceImageReferenceState(store.imageReferenceState);
  if (
    mode === "image" &&
    store.imageCreationMode === "reference" &&
    imageRef.status !== "complete"
  ) {
    return "お手本画像を追加し「参照を確定」してください";
  }
  if (
    mode === "image" &&
    store.imageWorkflowPhase === "retouch" &&
    !imagePrimaryHasReference({
      artifactId: store.primaryArtifactId,
      adkFilename: store.primaryAdkFilename,
      artifactVersion: store.primaryArtifactVersion,
    })
  ) {
    return "レタッチする初稿画像がありません";
  }
  if (canSend.value && !composerHasText.value) {
    if (mode === "image" && store.imageCreationMode === "scratch") {
      return "生成したい画像の内容を入力すると送信できます";
    }
    if (mode === "image") {
      return "お手本に対する編集内容を入力すると送信できます";
    }
    return "メッセージを入力すると送信できます";
  }
  return undefined;
});

const onPanelPaste = async (event: ClipboardEvent): Promise<void> => {
  if (
    store.activeAgent === "image" &&
    store.imageCreationMode === "reference"
  ) {
    const added = await imageRefSources.addFromClipboardEvent(event);
    if (shouldPreventDefaultOnImagePaste(event, added)) {
      event.preventDefault();
    }
    return;
  }
  if (
    store.activeAgent === "writing" &&
    store.writingReferenceState.status !== "complete"
  ) {
    const added = await writingRefSources.addFromClipboardEvent(event);
    if (shouldPreventDefaultOnImagePaste(event, added)) {
      event.preventDefault();
    }
  }
};

const removeSelectedKnowledge = (id: string): void => {
  selectedKnowledge.value = selectedKnowledge.value.filter((item) => item.id !== id);
};

const { openFromRef: openKnowledgePreviewFromRef } = useKnowledgePreview();

const openKnowledgeChipPreview = (item: SelectedKnowledgeRef): void => {
  openKnowledgePreviewFromRef(item, fileSpace.fileSpaceStore.documents ?? []);
};

const panelMessages = computed((): AIRevisionAssistantMessage[] =>
  store.messages.map((m) => ({
    key: m.id,
    role: m.role,
    text: m.text,
    createdAt: m.createdAt,
    completedAt: m.completedAt,
    artifacts: m.artifacts,
    activities: m.activities,
    sourceReferences: m.sourceReferences,
    groundingMetadata: m.groundingMetadata,
    imageRetouchContext: m.imageRetouchContext,
    status: m.isStreaming
      ? "processing"
      : m.role === "assistant" &&
          store.lastError &&
          m.text.startsWith("⚠️")
        ? "failed"
        : undefined,
  }))
);

const panelTitle = computed((): string => {
  if (store.isStreaming && store.activeAgent === "writing") {
    return writingWorkflowAction.value === "extract_schema"
      ? "フォーマット抽出中…"
      : "文章生成中…";
  }
  if (store.isStreaming && store.activeAgent === "image") {
    return store.imageWorkflowPhase === "retouch"
      ? "レタッチ中…"
      : "画像生成中…";
  }
  return resolveAiStudioPanelTitle(store.activeAgent);
});

const writingWorkflowStatusText = computed((): string | undefined => {
  if (!store.isStreaming || store.activeAgent !== "writing") return undefined;
  if (writingWorkflowAction.value === "extract_schema") {
    return "フォーマットを抽出しています…";
  }
  if (writingWorkflowAction.value === "generate_document") {
    return "文章を生成しています…";
  }
  return "処理しています…";
});

const imageWorkflowStatusText = computed((): string | undefined => {
  if (!store.isStreaming || store.activeAgent !== "image") return undefined;
  if (store.imageWorkflowPhase === "retouch") {
    return "レタッチを適用しています…";
  }
  if (store.imageCreationMode === "scratch") {
    return "0から新規で描いています…";
  }
  if (store.imageCreationMode === "reference") {
    return "お手本を元に描いています…";
  }
  return "画像を生成しています…";
});

const assistantTheme = computed(():
  | "revision"
  | "analysis"
  | "filter"
  | "sheet"
  | "writing" => {
  switch (store.activeAgent) {
    case "consultation":
      return "analysis";
    case "sheet":
      return "sheet";
    case "writing":
      return "writing";
    case "image":
      return "revision";
    default:
      return "revision";
  }
});

const welcomeBubbleText = computed((): string => {
  switch (store.activeAgent) {
    case "writing":
      return "参考資料から入力項目を抽出し、\n社内ナレッジを踏まえて文章を一括生成するよ";
    case "sheet":
      return "下でスプレッドシートに接続してから、\n表の編集を手伝うよ";
    case "image":
      return "まず「0から新規」か「お手本画像を元に」を選んでね。\nお手本モードはレイアウトを保ったまま差し替え、新規はプロンプトから生成するよ";
    case "consultation":
      return "経営判断や数値の壁打ち、\n組織ナレッジを見ながら一緒に考えるよ";
    default:
      return "やりたいことを自然文で話してね。\n最適な Agent を選んで起動するよ";
  }
});

const inputPlaceholder = computed((): string => {
  if (store.isStreaming) {
    if (store.activeAgent === "image") return "画像を生成中… (OUT パネルに表示されます)";
    return "生成中...";
  }
  if (store.activeAgent === "sheet" && !store.sheetModeSelected) {
    return "上でスプレッドシートの接続を確定してください";
  }
  switch (store.activeAgent) {
    case "writing":
      return "上のパネルから参考資料の確定・フォーマット抽出・入力開始を行ってください";
    case "image":
      if (!store.imageModeSelected) {
        return "上で作成方法を選んでください";
      }
      if (store.imageWorkflowPhase === "retouch") {
        return "右ペインで範囲を選ぶか、全体の修正指示を入力";
      }
      if (store.imageCreationMode === "scratch") {
        return "どんな画像を生成しますか? (スタイル・用途・サイズなど)";
      }
      return store.imageReferenceState.status === "complete"
        ? "お手本を元に、どこをどう変えますか?"
        : "お手本画像を追加して「参照を確定」してください";
    case "sheet":
      return "シートに何をしますか?";
    case "consultation":
      return "何を相談しますか?";
    default:
      return "メッセージを入力…";
  }
});

const moodText = computed((): string => {
  if (store.isStreaming) {
    if (store.activeAgent === "writing") {
      return writingWorkflowStatusText.value ?? "処理しています…";
    }
    if (store.activeAgent === "image") {
      if (store.imageWorkflowPhase === "retouch") {
        return "レタッチを適用しています…";
      }
      if (store.imageCreationMode === "scratch") {
        return "0から新規で描いています…";
      }
      if (store.imageCreationMode === "reference") {
        return "お手本を元に描いています…";
      }
      return "画像を生成しています…";
    }
    return "考えてます…";
  }
  if (store.activeAgent === "writing") {
    if (store.writingPhase === "done") {
      return "生成完了 — ファイル出力を確認";
    }
    if (store.writingReferenceState.status !== "complete") {
      return "参考資料を追加して確定";
    }
    if (store.writingPhase === "format_review") {
      return store.writingForm.fields.length > 0
        ? "フォーマット確認中"
        : "フォーマット抽出";
    }
    if (store.writingPhase === "filling") {
      return "AI が自動入力中";
    }
  }
  if (store.activeAgent === "image" && store.imageModeSelected) {
    if (store.imageWorkflowPhase === "retouch") {
      return "レタッチフェーズ — 部分修正できます";
    }
    const creation = imageCreationModeLabel.value;
    return creation ? `${creation} · 初稿生成` : "初稿生成フェーズ";
  }
  if (fileSpace.isFileSpaceConnected.value) {
    return `資料 ${fileSpace.documentCount.value} 件を把握済み`;
  }
  if (fileSpace.isLoadingFileSpace.value) return "資料を読み込み中…";
  return "よろしくね!";
});

watch(
  () => store.isStreaming,
  (streaming, wasStreaming) => {
    if (wasStreaming && !streaming && store.sessionId) {
      sessionDebugRefreshToken.value += 1;
    }
  }
);

const onQuickAction = (text: string): void => {
  input.value = text;
  panelRef.value?.focusInput?.();
};

const openWritingKnowledgePicker = (): void => {
  if (fileSpace.isLoadingFileSpace.value) {
    toast.add({
      title: "ナレッジを接続しています",
      description: "しばらく待ってから再度お試しください。",
      color: "info",
    });
    return;
  }
  if (!fileSpace.isFileSpaceConnected.value) {
    toast.add({
      title: "ナレッジに接続できません",
      description: "データソース画面で資料を登録するか、ファイルをアップロードしてください。",
      color: "warning",
    });
    return;
  }
  writingKnowledgeDraft.value = [];
  writingKnowledgePickerOpen.value = true;
};

const onWritingKnowledgePicked = (items: SelectedKnowledgeRef[]): void => {
  const before = store.writingReferenceState.attachments.length;
  writingRefSources.addFromKnowledge(
    items.map((item) => selectedKnowledgeToKnowledgeAsset(item))
  );
  const after = store.writingReferenceState.attachments.length;
  if (after > before) {
    toast.add({
      title: "ナレッジから資料を追加しました",
      color: "success",
    });
    return;
  }
  if (items.length > 0) {
    toast.add({
      title: "追加できませんでした",
      description: "選択した資料の参照先が見つかりません。",
      color: "warning",
    });
  }
};

const onWritingPasteFromClipboard = async (): Promise<void> => {
  try {
    const added = await writingRefSources.addFromClipboardRead();
    if (added) {
      toast.add({
        title: "クリップボードから資料を追加しました",
        color: "success",
      });
      return;
    }
    toast.add({
      title: "クリップボードに貼り付け可能な資料がありません",
      description:
        "スクリーンショット等をコピーしてから「クリップボードから貼り付け」を押すか、ファイルをアップロードしてください。",
      color: "warning",
    });
  } catch (error) {
    toast.add({
      title: "貼り付けに失敗しました",
      description:
        error instanceof Error ? error.message : "しばらく待って再試行してください。",
      color: "error",
    });
  }
};

const onWritingUploadFiles = async (files: File[]): Promise<void> => {
  try {
    await writingRefSources.addFromUploadFiles(files);
    if (store.writingReferenceState.attachments.length > 0) {
      toast.add({
        title: "ファイルを追加しました",
        color: "success",
      });
    }
  } catch (error) {
    toast.add({
      title: "アップロードに失敗しました",
      description:
        error instanceof Error ? error.message : "しばらく待って再試行してください。",
      color: "error",
    });
  }
};

const onWritingConfirmReference = (): void => {
  if (!store.confirmWritingReference()) {
    toast.add({
      title: "参考資料がありません",
      description:
        "ナレッジ・ファイル・クリップボードから資料を追加してください。",
      color: "warning",
    });
    return;
  }
  toast.add({
    title: "参考資料を確定しました",
    description: "「フォーマットを抽出」を押してください。",
    color: "success",
  });
};

const onWritingExtractSchema = async (): Promise<void> => {
  await store.invokeWriting({
    action: "extract_schema",
  });
};

const onWritingFormFieldsUpdate = (fields: WritingFormField[]): void => {
  store.updateWritingForm({
    ...store.writingForm,
    fields,
  });
};

const onWritingConfirmSchema = async (): Promise<void> => {
  store.confirmWritingSchema();
  if (store.lastError) return;
  await store.invokeWriting({
    action: "generate_document",
  });
  if (!store.lastError) {
    toast.add({
      title: "入力を開始しました",
      description: "社内ナレッジを参照しながら各項目を自動入力しています。",
      color: "success",
    });
  }
};

const sendPrompt = async (params: { text: string }): Promise<void> => {
  const text = params.text.trim();
  if (!text || store.isStreaming) return;

  const attachments = fileSpace.takeAttachmentsSnapshot();
  const knowledge = [...selectedKnowledge.value];

  await store.send(text, attachments, knowledge);
  fileSpace.clearAttachments();

  if (store.lastError) {
    toast.add({
      title: "送信できませんでした",
      description: store.lastError,
      color: "warning",
    });
  }
};

const onImagePromptSubmit = async (): Promise<void> => {
  if (!store.imageCreationMode) return;
  const text = buildImageStudioInvokePrompt({
    subject: imagePromptSubject.value,
    usage: imagePromptUsage.value,
    creationMode: store.imageCreationMode,
  });
  if (!text) return;

  imagePromptSubject.value = "";
  imagePromptUsage.value = "";
  await sendPrompt({ text });
};

const onSend = async (): Promise<void> => {
  const text = input.value.trim();
  input.value = "";
  await sendPrompt({ text });
};

const setDraftAndFocus = async (text: string): Promise<void> => {
  input.value = text;
  panelRef.value?.focusInput?.();
};

defineExpose({ setDraftAndFocus, focusConsultationInput });
</script>
