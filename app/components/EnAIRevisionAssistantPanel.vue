<template>
  <aside
    class="ai-panel flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden transition-colors duration-300"
    :class="panelRootClass"
    data-testid="en-aistudio-ai-revision-assistant"
  >
    <header
      class="relative flex-shrink-0 overflow-hidden border-b px-4 py-2 transition-colors duration-300 sm:py-2.5"
      :class="headerClass"
    >
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.05] [background-size:24px_24px]"
        :class="headerPatternClass"
      />
      <div
        class="relative flex min-w-0 items-center justify-between gap-x-3 gap-y-2"
      >
        <div class="flex min-w-0 flex-1 items-center gap-x-3 overflow-x-auto">
          <div class="flex min-w-0 shrink-0 items-center gap-3">
            <div class="relative flex-shrink-0">
              <NuxtImg
                :src="appearance.aiAvatarUrl.value"
                alt="AI 部下"
                class="h-10 w-10 object-contain"
                :class="penguinAnimation"
              />
              <div
                class="absolute -right-1 -top-1 flex h-4 w-4 animate-pulse items-center justify-center rounded-full"
                :class="sparkleDotClass"
              >
                <UIcon name="i-heroicons-sparkles" class="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <div
              class="min-w-0"
              :class="
                $slots['header-inline']
                  ? 'max-w-[4.5rem] sm:max-w-[5.5rem]'
                  : 'max-w-[8rem] sm:max-w-[11rem]'
              "
            >
              <p class="truncate text-sm font-bold text-gray-800 dark:text-gray-100">
                {{ panelTitle }}
              </p>
              <p
                v-if="messages.length > 0"
                class="truncate text-[11px] leading-tight"
                :class="moodTextClass"
              >
                {{ moodText }}
              </p>
            </div>
          </div>
          <div
            v-if="$slots['header-inline']"
            class="flex shrink-0 items-center gap-2"
          >
            <slot name="header-inline" />
          </div>
        </div>
        <div
          class="flex flex-shrink-0 items-center justify-end gap-1.5"
        >
          <slot name="header-extra" />
        </div>
      </div>
    </header>

    <div
      ref="historyRef"
      class="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4"
    >
      <div
        v-if="
          (messages.length === 0 || centerWelcomeReplace) &&
            $slots['welcome-replace']
        "
        class="absolute inset-0 flex overflow-y-auto px-2 py-5 sm:px-4 sm:py-6"
        :class="welcomeReplaceContainerClass"
        data-testid="ai-welcome-replace"
      >
        <div class="w-full" :class="welcomeReplaceMaxWidthClass">
          <slot name="welcome-replace" />
        </div>
      </div>

      <div
        v-else-if="messages.length === 0"
        class="absolute inset-0 flex items-center justify-center px-3 py-4 sm:px-4"
        data-testid="ai-welcome-layout"
      >
        <div
          class="animate-gradient-shift pointer-events-none absolute inset-0"
          :class="welcomeBackdropClass"
        />
        <div class="relative w-full max-w-2xl">
          <div class="flex items-start gap-3 sm:gap-4">
            <div class="flex-shrink-0 pt-1">
              <div class="relative penguin-bobbing">
                <NuxtImg
                  :src="appearance.aiAvatarUrl.value"
                  alt="AI 部下"
                  class="h-16 w-16 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
                />
                <div
                  class="absolute -right-1 -top-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-purple-400"
                >
                  <UIcon name="i-heroicons-sparkles" class="h-3 w-3 text-white" />
                </div>
              </div>
            </div>

            <div class="min-w-0 flex-1 space-y-3">
              <div
                class="relative rounded-2xl bg-white px-3.5 py-3 text-left shadow-sm ring-1 dark:bg-gray-900"
                :class="welcomeBubbleRingClass"
              >
                <span class="bubble-tail-left" aria-hidden="true" />
                <p
                  class="whitespace-pre-line break-words text-[13px] leading-relaxed text-gray-800 dark:text-gray-100"
                >
                  {{ welcomeBubbleText }}
                </p>
                <p
                  v-if="showWelcomeExamples"
                  class="mt-2 break-words text-[11px] leading-snug text-gray-500 dark:text-gray-400"
                >
                  {{ welcomeExamplesText }}
                </p>
              </div>

            </div>
          </div>
          <div class="mt-3 w-full">
            <slot name="welcome-extra" />
          </div>
        </div>
      </div>

      <div
        v-if="
          messages.length > 0 &&
            hideComposer &&
            $slots['welcome-replace'] &&
            !centerWelcomeReplace
        "
        class="flex justify-center px-1 py-6"
        data-testid="ai-welcome-replace-with-messages"
      >
        <div class="w-full" :class="welcomeReplaceMaxWidthClass">
          <slot name="welcome-replace" />
        </div>
      </div>

      <template v-if="!hideMessageThread" v-for="m in messages" :key="m.key">
        <div v-if="m.role === 'user'" class="flex flex-col items-end gap-0.5">
          <ImageRetouchUserMessageBundle
            v-if="m.imageRetouchContext"
            :context="m.imageRetouchContext"
            :instruction="m.text"
            :session-id="artifactSessionId"
          />
          <div
            v-else
            class="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-violet-50 px-3.5 py-2 text-[13px] text-gray-900 shadow-[0_1px_2px_rgba(124,58,237,0.06)] ring-1 ring-violet-100/80 dark:bg-violet-950/40 dark:text-gray-100 dark:ring-violet-800/30"
          >
            {{ m.text }}
          </div>
          <time
            v-if="displayMessageTime(m)"
            :datetime="new Date(displayMessageTime(m)!).toISOString()"
            class="pr-1 text-[10px] tabular-nums text-gray-400 dark:text-gray-500"
          >
            {{ formatChatMessageTime(displayMessageTime(m)!) }}
          </time>
        </div>
        <div v-else class="flex items-start gap-2">
          <NuxtImg
            :src="appearance.aiAvatarUrl.value"
            alt="AI"
            class="mt-0.5 h-7 w-7 flex-shrink-0 object-contain"
            :class="m.status === 'processing' ? 'penguin-eating' : ''"
          />
          <div class="flex w-fit max-w-[85%] min-w-0 flex-col gap-2">
            <div
              class="rounded-2xl bg-white text-[13px] leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-gray-900/[0.06] dark:bg-gray-900 dark:ring-white/10"
              :class="[
                m.status === 'processing' && !m.activities?.length
                  ? 'px-3 py-2'
                  : 'px-3.5 py-2',
                m.status === 'failed'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-800 dark:text-gray-100',
              ]"
            >
              <div
                v-if="m.activities?.length"
                class="mb-2 flex flex-col gap-1 border-b border-gray-100 pb-2 dark:border-white/10"
              >
                <div
                  v-for="act in m.activities"
                  :key="act.id"
                  class="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400"
                >
                  <UIcon
                    v-if="act.status === 'running'"
                    name="material-symbols:progress-activity"
                    class="h-3 w-3 animate-spin text-purple-500"
                  />
                  <UIcon
                    v-else-if="act.status === 'failed'"
                    name="material-symbols:error-outline"
                    class="h-3 w-3 text-rose-500"
                  />
                  <UIcon
                    v-else
                    name="material-symbols:check-circle"
                    class="h-3 w-3 text-emerald-500"
                  />
                  <span>{{ formatToolActivityDisplay(act.name, act.status) }}</span>
                </div>
              </div>
              <span
                v-if="m.status === 'processing' && !m.text"
                class="inline-flex items-center gap-1.5 text-gray-500"
              >
                <span class="flex gap-1">
                  <span
                    class="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400"
                    style="animation-delay: 0s"
                  />
                  <span
                    class="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400"
                    style="animation-delay: 0.2s"
                  />
                  <span
                    class="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400"
                    style="animation-delay: 0.4s"
                  />
                </span>
              </span>
              <span
                v-else-if="m.status === 'processing' && m.text"
                class="whitespace-pre-wrap"
              >
                {{ m.text }}<span
                  class="streaming-cursor ml-0.5 inline-block h-3.5 w-0.5 align-text-bottom bg-purple-400"
                  aria-hidden="true"
                />
              </span>
              <template v-else>
                <UIcon
                  v-if="m.status === 'failed'"
                  name="i-heroicons-exclamation-triangle"
                  class="mr-1 inline-block h-3.5 w-3.5 align-text-bottom"
                />
                <EnMarkdown
                  v-if="renderMarkdown && m.text"
                  :markdown-text="m.text"
                  :variant="markdownVariant"
                  compact
                  :enable-router-links="false"
                  class="ai-revision-md min-w-0"
                />
                <span v-else class="whitespace-pre-wrap">{{ m.text }}</span>
                <div
                  v-if="panelArtifactsForMessage(m).length > 0"
                  class="mt-2.5 space-y-2"
                >
                  <WorkspaceArtifactChip
                    v-for="{ artifact, index } in panelArtifactsForMessage(m)"
                    :key="`${m.key}-artifact-chip-${index}`"
                    :artifact="artifact"
                    :message-id="m.key"
                    :index="index"
                    :session-id="artifactSessionId"
                    :active="isArtifactChipActive({ messageId: m.key, artifact, index })"
                    @open="
                      openArtifactInPanel({
                        messageId: m.key,
                        artifact,
                        index,
                      })
                    "
                  />
                </div>
                <div
                  v-if="inlineSheetArtifacts(m).length > 0"
                  class="mt-2.5 space-y-2"
                >
                  <SheetOperationArtifact
                    v-for="(artifact, index) in inlineSheetArtifacts(m)"
                    :key="`${m.key}-sheet-op-${index}`"
                    :artifact="artifact"
                    :fallback-spreadsheet-url="sheetSpreadsheetUrl"
                    :fallback-sheet-gid="sheetTargetSheetGid"
                  />
                </div>
              </template>
              <div
                v-if="m.diffCounts && m.status === 'completed'"
                class="mt-1 text-[10px] text-gray-400"
              >
                {{ formatDiffCounts(m.diffCounts) }}
              </div>
            </div>
            <ConsultationSourceCarousel
              v-if="
                messageHasReferenceSources({
                  artifacts: m.artifacts,
                  sourceReferences: m.sourceReferences,
                  groundingMetadata: m.groundingMetadata,
                })
              "
              :source-references="
                resolveMessageSourceReferences({
                  artifacts: m.artifacts,
                  sourceReferences: m.sourceReferences,
                  groundingMetadata: m.groundingMetadata,
                })
              "
              :grounding-metadata="m.groundingMetadata"
              :documents="referenceDocuments"
            />
            <time
              v-if="displayMessageTime(m)"
              :datetime="new Date(displayMessageTime(m)!).toISOString()"
              class="pl-1 text-[10px] tabular-nums text-gray-400 dark:text-gray-500"
            >
              {{ formatChatMessageTime(displayMessageTime(m)!) }}
            </time>
          </div>
        </div>
      </template>
    </div>

    <div
      v-if="$slots['pending-preview']"
      class="w-full min-h-0 max-h-[min(58vh,100%)] flex-shrink overflow-y-auto overscroll-contain px-2.5 pb-2"
      data-testid="ai-pending-preview-scroll"
    >
      <div class="w-full min-w-0">
        <slot name="pending-preview" />
      </div>
    </div>

    <footer
      v-if="!hideComposer"
      class="flex-shrink-0 space-y-2 border-t transition-colors duration-300 dark:border-gray-800"
      :class="[footerClass, footerPaddingClass]"
    >
      <p
        v-if="showRowQuoteTip"
        class="flex items-center justify-center gap-1 rounded-lg bg-violet-50/90 px-2 py-1.5 text-[11px] leading-snug text-violet-800 ring-1 ring-violet-100 dark:bg-violet-950/35 dark:text-violet-200 dark:ring-violet-900/50"
        data-testid="ai-row-quote-tip"
      >
        <span class="shrink-0">表左の</span>
        <MasterEditorAiQuoteIconButton size="sm" />
        <span>を押すと、対象行を入力欄に直接追加できます</span>
      </p>
      <div
        v-if="showModeChipsSection"
        class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5"
      >
        <div
          class="flex flex-wrap items-center gap-1.5"
          role="radiogroup"
          :aria-label="modeChipAriaLabel"
          data-testid="master-editor-ai-mode-chips"
        >
          <button
            v-for="chip in resolvedModeChips"
            :key="chip.value"
            type="button"
            role="radio"
            :aria-checked="activeModeValue === chip.value"
            class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all"
            :class="modeChipButtonClass(chip.value)"
            :title="modeChipTitle(chip.value)"
            @click="selectMode(chip.value)"
          >
            <UIcon :name="chip.icon" class="h-3.5 w-3.5 shrink-0" />
            {{ chip.label }}
          </button>
        </div>
        <p
          v-if="isInputFocused"
          class="inline-flex shrink-0 items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"
          data-testid="ai-mode-cycle-shortcut-hint"
        >
          <UKbd size="sm" variant="subtle">Shift</UKbd>
          <span aria-hidden="true">+</span>
          <UKbd size="sm" variant="subtle">Tab</UKbd>
          <span>で切替</span>
        </p>
      </div>
      <slot name="attachments" />
      <div
        v-if="showQuickActionsAboveForm"
        data-testid="ai-quick-actions-composer"
      >
        <p
          class="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
        >
          おすすめの聞き方
          <span
            v-if="isLoadingQuickActions"
            class="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400"
            title="候補を生成中"
          />
        </p>
        <div
          class="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2"
          :class="{ 'opacity-80': isLoadingQuickActions }"
        >
          <button
            v-for="qa in visibleQuickActions"
            :key="qa.text"
            type="button"
            class="inline-flex min-h-[2.75rem] w-full items-center gap-1.5 rounded-lg border bg-white/90 px-2.5 py-2 text-left shadow-sm transition-all hover:-translate-y-px hover:shadow-md disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-900/90"
            :class="quickActionChipClass"
            :disabled="isSending || !canSubmit"
            @click="emit('quick-action', qa.text)"
          >
            <span
              class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md"
              :class="quickActionIconWrapClass"
            >
              <UIcon
                :name="qa.icon || 'material-symbols:auto-awesome'"
                class="h-3.5 w-3.5"
              />
            </span>
            <span class="min-w-0 text-[11px] font-semibold leading-tight">
              {{ qa.label }}
            </span>
          </button>
        </div>
      </div>
      <UTextarea
        ref="textareaRef"
        v-model="inputModel"
        :rows="inputRows"
        :placeholder="inputPlaceholder"
        class="w-full"
        :class="textareaClass"
        :disabled="isSending || !canEditInput"
        @keydown="onTextareaKeydown"
        @paste="(e: ClipboardEvent) => emit('paste', e)"
        @focus="isInputFocused = true"
        @blur="isInputFocused = false"
      />
      <div class="flex items-center gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-1">
          <slot name="footer-left" />
        </div>
        <div class="ml-auto flex shrink-0 items-center gap-1.5">
          <slot name="footer-actions" />
          <p
            v-if="isInputFocused"
            class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"
            :class="shortcutHintClass"
            data-testid="ai-send-shortcut-hint"
          >
            <UKbd size="sm" variant="subtle">Shift</UKbd>
            <span aria-hidden="true">+</span>
            <UKbd size="sm" variant="subtle">Enter</UKbd>
            <span>で送信</span>
          </p>
          <slot name="footer-send">
            <UButton
              :color="sendButtonColor"
              :size="sendButtonSize"
              icon="i-heroicons-paper-airplane"
              :title="sendButtonTitle"
              aria-keyshortcuts="Shift+Enter"
              :class="sendButtonClass"
              data-testid="ai-revision-send-button"
              :disabled="!canClickSend"
              :loading="isSending"
              @click="onSendClick"
            >
              送信
            </UButton>
          </slot>
        </div>
      </div>
    </footer>

    <slot />
  </aside>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref, watch } from "vue";
import {
  masterEditorAIModeHint,
  type MasterEditorAIModeId,
} from "@models/masterEditorAIMode";
import MasterEditorAiQuoteIconButton from "@components/masterEditor/MasterEditorAiQuoteIconButton.vue";
import {
  workspaceEditModeHint,
  type WorkspaceEditMode,
} from "@models/workspaceEditMode";
import type { ConsultationSourceReference } from "@utils/consultationSourceReferences";
import ConsultationSourceCarousel from "@components/ConsultationSourceCarousel.vue";
import {
  messageHasReferenceSources,
  resolveMessageSourceReferences,
} from "@utils/adkArtifacts";
import type { Document } from "@models/document";
import type { AgentSseArtifact, AgentSseActivity } from "@composables/useAgentSseClient";
import type { ImageRetouchMessageContext } from "@utils/imageStudioState";
import {
  formatAdkToolActivityDisplay,
  type AgentSseActivityStatus,
} from "@utils/adkToolActivities";
import { formatChatMessageTime } from "@utils/date";
import ImageRetouchUserMessageBundle from "@components/AgentWorkspace/ImageRetouchUserMessageBundle.vue";
import WorkspaceArtifactChip from "@components/AgentWorkspace/WorkspaceArtifactChip.vue";
import SheetOperationArtifact from "@components/AgentWorkspace/SheetOperationArtifact.vue";
import {
  WORKSPACE_ARTIFACT_PANEL_KEY,
  type WorkspaceArtifactPanelApi,
} from "@composables/useWorkspaceArtifactPanel";
import {
  isPanelPrimaryArtifact,
  workspaceArtifactKey,
} from "@utils/workspaceArtifactMeta";

export interface AIRevisionAssistantMessage {
  key: string;
  role: "user" | "assistant";
  text: string;
  createdAt?: number;
  completedAt?: number;
  status?: "processing" | "completed" | "failed";
  diffCounts?: {
    before: { product: number; material: number; shippingEvent: number };
    after: { product: number; material: number; shippingEvent: number };
  };
  artifacts?: AgentSseArtifact[];
  activities?: AgentSseActivity[];
  sourceReferences?: ConsultationSourceReference[];
  groundingMetadata?: unknown;
  imageRetouchContext?: ImageRetouchMessageContext;
}

export interface AIRevisionQuickAction {
  label: string;
  text: string;
  icon?: string;
}

const inputModel = defineModel<string>({ default: "" });

const props = withDefaults(
  defineProps<{
    messages: AIRevisionAssistantMessage[];
    canSubmit?: boolean;
    /** 未指定時は canSubmit と同じ。入力欄の編集可否 */
    canEditInput?: boolean;
    /** 未指定時は canSubmit と同じ。送信のみ別制御したい場合に使用 */
    canSend?: boolean;
    /** 送信ボタン disabled 時のツールチップ（理由表示） */
    sendDisabledHint?: string;
    /** 親 v-model と二重管理時の保険（入力有無） */
    composerHasText?: boolean;
    isSending?: boolean;
    quickActions?: AIRevisionQuickAction[];
    isLoadingQuickActions?: boolean;
    moodText?: string;
    panelTitle?: string;
    welcomeBubbleText?: string;
    welcomeExamplesText?: string;
    inputPlaceholder?: string;
    processingLabel?: string;
    /** 分析=sky / 絞り込み=violet / シート=green / 編集=purple */
    assistantTheme?: "revision" | "analysis" | "filter" | "sheet" | "writing";
    /** 入力欄上のモードチップ */
    showModeChips?: boolean;
    modeChips?: Array<{ value: string; label: string; icon: string }>;
    activeMode?: string;
    modeHint?: string;
    maxQuickActions?: number;
    /** 表左の引用ボタン（💬）の使い方ヒント */
    showRowQuoteTip?: boolean;
    /** assistant 返答を EnMarkdown で描画する */
    renderMarkdown?: boolean;
    /** 入力欄・送信ボタンのサイズ (AIスタジオ等) */
    inputSize?: "default" | "comfortable";
    /** 経営相談 citation パネル用 FileSpace Document 一覧 */
    referenceDocuments?: Document[];
    /** マウント後に入力欄へフォーカス (ワークスペース初回表示など) */
    autofocusOnMount?: boolean;
    /** ADK 画像 artifact のセッション ID (認証付き GET 用) */
    artifactSessionId?: string | null;
    /** シート操作 artifact のリンク用フォールバック */
    sheetSpreadsheetUrl?: string | null;
    sheetTargetSheetGid?: number | null;
    /** true のとき入力欄直上のおすすめクエリを出さない */
    hideWelcomeQuickActions?: boolean;
    /** true のときコンポーザー（入力欄・送信）と pending-preview を非表示 */
    hideComposer?: boolean;
    /** welcome-replace スロットの最大幅 (Tailwind class) */
    welcomeReplaceMaxWidthClass?: string;
    /** welcome-replace 外枠の flex 配置 (Tailwind class) */
    welcomeReplaceContainerClass?: string;
    /** true のときメッセージ履歴を描画しない（画像スタジオ等） */
    hideMessageThread?: boolean;
    /** true のとき welcome-replace を中央固定（メッセージ有無に関わらず） */
    centerWelcomeReplace?: boolean;
  }>(),
  {
    canSubmit: true,
    isSending: false,
    quickActions: () => [],
    isLoadingQuickActions: false,
    maxQuickActions: 3,
    showRowQuoteTip: false,
    renderMarkdown: false,
    inputSize: "default",
    referenceDocuments: () => [],
    autofocusOnMount: false,
    hideWelcomeQuickActions: false,
    hideComposer: false,
    welcomeReplaceMaxWidthClass: "max-w-2xl",
    welcomeReplaceContainerClass: "items-center justify-center",
    hideMessageThread: false,
    centerWelcomeReplace: false,
    moodText: "マスタを整えるよ!",
    assistantTheme: "revision",
    showModeChips: false,
    modeChips: () => [],
    activeMode: "edit",
    modeHint: "",
    panelTitle: "AI 修正アシスタント",
    welcomeBubbleText: "自然文で指示どおり表を更新するよ",
    welcomeExamplesText: "",
    inputPlaceholder: "修正内容を入力…",
    processingLabel: "Gemini に聞いてみるね…",
  }
);

const emit = defineEmits<{
  (event: "update:activeMode", value: string): void;
  (event: "send"): void;
  /** 送信可能だが入力が空のとき（親でフォーカス・トースト） */
  (event: "send-empty"): void;
  (event: "quick-action", text: string): void;
  (event: "paste", clipboardEvent: ClipboardEvent): void;
}>();

const canEditInput = computed(() => props.canEditInput ?? props.canSubmit);

const effectiveCanSend = computed(
  () => props.canSend ?? props.canSubmit
);

const trimmedInput = computed(() => inputModel.value.trim());

const hasComposerText = computed(
  () => props.composerHasText ?? trimmedInput.value.length > 0
);

/** 送信ボタンを押せるか（入力空でも canSend 時はクリックで入力促し） */
const canClickSend = computed(() => {
  if (props.isSending) return false;
  if (props.canEditInput === false) return false;
  if (hasComposerText.value) return true;
  return effectiveCanSend.value;
});

const canTriggerSend = computed(
  () => hasComposerText.value && canClickSend.value
);

const sendButtonTitle = computed(() => {
  if (canTriggerSend.value) return "Shift+Enter で送信";
  if (canClickSend.value && !trimmedInput.value) {
    return props.sendDisabledHint?.trim() ?? "プロンプトを入力してから送信";
  }
  if (props.sendDisabledHint?.trim()) return props.sendDisabledHint.trim();
  if (!effectiveCanSend.value) return "送信の前提条件を満たしていません";
  if (props.isSending) return "生成が完了するまでお待ちください";
  return "Shift+Enter で送信";
});

const onSendClick = (): void => {
  if (props.isSending) return;
  if (!hasComposerText.value) {
    emit("send-empty");
    focusInput();
    return;
  }
  emit("send");
};

const artifactPanel = inject<WorkspaceArtifactPanelApi | null>(
  WORKSPACE_ARTIFACT_PANEL_KEY,
  null
);

const inlineSheetArtifacts = (
  message: AIRevisionAssistantMessage
): AgentSseArtifact[] =>
  (message.artifacts ?? []).filter((artifact) => artifact.kind === "sheet_op");

const panelArtifactsForMessage = (
  message: AIRevisionAssistantMessage
): Array<{ artifact: AgentSseArtifact; index: number }> => {
  if (!artifactPanel) return [];
  const items: Array<{ artifact: AgentSseArtifact; index: number }> = [];
  (message.artifacts ?? []).forEach((artifact, index) => {
    if (isPanelPrimaryArtifact(artifact)) {
      items.push({ artifact, index });
    }
  });
  return items;
};

const openArtifactInPanel = (params: {
  messageId: string;
  artifact: AgentSseArtifact;
  index: number;
}): void => {
  if (!artifactPanel) return;
  const key = workspaceArtifactKey({
    artifact: params.artifact,
    messageId: params.messageId,
    index: params.index,
  });
  artifactPanel.selectByKey(key);
};

const isArtifactChipActive = (params: {
  messageId: string;
  artifact: AgentSseArtifact;
  index: number;
}): boolean => {
  const selected = artifactPanel?.selectedKey.value;
  if (!selected) return false;
  return (
    workspaceArtifactKey({
      artifact: params.artifact,
      messageId: params.messageId,
      index: params.index,
    }) === selected
  );
};

const textareaRef = ref<{ $el?: HTMLElement } | null>(null);
const isInputFocused = ref(false);

const formatToolActivityDisplay = (
  name: string,
  status: AgentSseActivityStatus
): string => formatAdkToolActivityDisplay(name, status);

const displayMessageTime = (m: AIRevisionAssistantMessage): number | null => {
  if (m.status === "processing") return null;
  const ts = m.role === "assistant" ? m.completedAt ?? m.createdAt : m.createdAt;
  return typeof ts === "number" && ts > 0 ? ts : null;
};

const resolveTextareaElement = (): HTMLTextAreaElement | null => {
  const refVal = textareaRef.value;
  if (!refVal) return null;
  const exposed = refVal as unknown as {
    $el?: HTMLElement;
    inputRef?: HTMLTextAreaElement;
  };
  if (exposed.inputRef instanceof HTMLTextAreaElement) {
    return exposed.inputRef;
  }
  if (refVal instanceof HTMLTextAreaElement) {
    return refVal;
  }
  const root = exposed.$el ?? (refVal as HTMLElement);
  if (root instanceof HTMLTextAreaElement) {
    return root;
  }
  const found = root.querySelector?.("textarea");
  return found instanceof HTMLTextAreaElement ? found : null;
};

const focusInput = (): boolean => {
  const el = resolveTextareaElement();
  if (!el) return false;
  el.focus();
  return true;
};

/** DOM マウント直後は UTextarea ref が未解決のことがあるためリトライする */
const focusInputWithRetry = async (): Promise<void> => {
  await nextTick();
  if (focusInput()) return;
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (focusInput()) return;
  }
};

const resolvedModeChips = computed(() => props.modeChips);

const activeModeValue = computed(() => props.activeMode);

const showModeChipsSection = computed(
  () =>
    props.showModeChips &&
    resolvedModeChips.value.length > 1 &&
    Boolean(activeModeValue.value)
);

const modeChipAriaLabel = "AI モード";

const showWelcomeExamples = computed(
  () => props.welcomeExamplesText.trim().length > 0
);

const visibleQuickActions = computed(() =>
  props.quickActions.slice(0, props.maxQuickActions)
);

/** 履歴が空のとき、入力欄直上におすすめクエリを表示 */
const showQuickActionsAboveForm = computed(
  () =>
    visibleQuickActions.value.length > 0 &&
    props.messages.length === 0 &&
    !props.hideWelcomeQuickActions
);

const isComfortableInput = computed(() => props.inputSize === "comfortable");

const inputRows = computed(() => (isComfortableInput.value ? 4 : 3));

const footerPaddingClass = computed(() =>
  isComfortableInput.value ? "p-3.5" : "p-2.5"
);

const textareaClass = computed(() =>
  isComfortableInput.value ? "ai-panel-textarea-comfortable" : ""
);

const sendButtonSize = computed(() =>
  isComfortableInput.value ? "md" : "sm"
);

const sendButtonClass = computed(() =>
  isComfortableInput.value ? "min-h-10 px-4 text-sm font-semibold" : ""
);

const shortcutHintClass = computed(() =>
  isComfortableInput.value ? "text-xs" : "text-[10px]"
);

const SHIPPING_MODE_CHIP_VALUES = new Set<string>(["analysis", "edit", "filter"]);

const modeChipTitle = (value: string): string => {
  if (SHIPPING_MODE_CHIP_VALUES.has(value)) {
    return workspaceEditModeHint(value as WorkspaceEditMode);
  }
  return masterEditorAIModeHint(value as MasterEditorAIModeId);
};

const selectMode = (mode: string): void => {
  if (activeModeValue.value === mode) return;
  emit("update:activeMode", mode);
};

const cycleActiveMode = (): string => {
  const chips = resolvedModeChips.value;
  const current = activeModeValue.value;
  if (!chips.length || !current) return current;
  const idx = chips.findIndex((c) => c.value === current);
  const next = chips[(idx + 1) % chips.length]?.value ?? chips[0]?.value;
  return next ?? current;
};

const modeChipButtonClass = (value: string): string => {
  const active = activeModeValue.value === value;
  if (value === "analysis") {
    return active
      ? "border-sky-400 bg-sky-100 text-sky-900 shadow-sm ring-2 ring-sky-300/80 dark:border-sky-600 dark:bg-sky-900/50 dark:text-sky-100 dark:ring-sky-600/50"
      : "border-sky-200/80 bg-white/80 text-sky-700 hover:bg-sky-50 dark:border-sky-800/50 dark:bg-gray-900/60 dark:text-sky-300 dark:hover:bg-sky-950/40";
  }
  if (value === "filter") {
    return active
      ? "border-violet-400 bg-violet-100 text-violet-900 shadow-sm ring-2 ring-violet-300/80 dark:border-violet-600 dark:bg-violet-900/50 dark:text-violet-100 dark:ring-violet-600/50"
      : "border-violet-200/80 bg-white/80 text-violet-700 hover:bg-violet-50 dark:border-violet-800/50 dark:bg-gray-900/60 dark:text-violet-300 dark:hover:bg-violet-950/40";
  }
  return active
    ? "border-purple-400 bg-purple-100 text-purple-900 shadow-sm ring-2 ring-purple-300/80 dark:border-purple-600 dark:bg-purple-900/50 dark:text-purple-100 dark:ring-purple-600/50"
    : "border-purple-200/80 bg-white/80 text-purple-800 hover:bg-purple-50 dark:border-purple-800/50 dark:bg-gray-900/60 dark:text-purple-300 dark:hover:bg-purple-950/40";
};

const onTextareaKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Tab" && event.shiftKey && showModeChipsSection.value) {
    event.preventDefault();
    const next = cycleActiveMode();
    emit("update:activeMode", next);
    return;
  }
  if (event.key === "Enter" && event.shiftKey) {
    event.preventDefault();
    onSendClick();
  }
};

const isAnalysisTheme = computed(() => props.assistantTheme === "analysis");
const isFilterTheme = computed(() => props.assistantTheme === "filter");
const isSheetTheme = computed(() => props.assistantTheme === "sheet");
const isWritingTheme = computed(() => props.assistantTheme === "writing");

const sendButtonColor = computed((): "primary" | "success" =>
  isSheetTheme.value || isWritingTheme.value ? "success" : "primary"
);

const markdownVariant = computed((): "ai" | "analysis" | "default" => {
  if (isAnalysisTheme.value) return "analysis";
  if (isFilterTheme.value || isSheetTheme.value || isWritingTheme.value) {
    return "default";
  }
  return "ai";
});

const panelRootClass = computed(() => {
  if (isAnalysisTheme.value) {
    return "bg-gradient-to-b from-sky-50 via-sky-50/90 to-sky-50/80 dark:from-sky-950/20 dark:via-sky-950/12 dark:to-sky-950/10";
  }
  if (isSheetTheme.value) {
    return "bg-gradient-to-b from-green-50 via-green-50/90 to-green-50/80 dark:from-green-950/20 dark:via-green-950/12 dark:to-green-950/10";
  }
  if (isWritingTheme.value) {
    return "bg-gradient-to-b from-emerald-50 via-emerald-50/90 to-emerald-50/80 dark:from-emerald-950/20 dark:via-emerald-950/12 dark:to-emerald-950/10";
  }
  if (isFilterTheme.value) {
    return "bg-gradient-to-b from-violet-50 via-violet-50/90 to-violet-50/80 dark:from-violet-950/20 dark:via-violet-950/12 dark:to-violet-950/10";
  }
  return "bg-gradient-to-b from-violet-50 via-purple-50/90 to-violet-50/80 dark:from-violet-950/20 dark:via-purple-950/12 dark:to-violet-950/10";
});

const headerClass = computed(() => {
  if (isAnalysisTheme.value) {
    return "border-sky-200/80 bg-gradient-to-r from-sky-100 via-sky-100 to-sky-100 dark:border-sky-800/50 dark:from-sky-950/55 dark:via-sky-950/40 dark:to-sky-950/55";
  }
  if (isSheetTheme.value) {
    return "border-green-200/80 bg-gradient-to-r from-green-100 via-green-100 to-green-100 dark:border-green-800/50 dark:from-green-950/55 dark:via-green-950/40 dark:to-green-950/55";
  }
  if (isWritingTheme.value) {
    return "border-emerald-200/80 bg-gradient-to-r from-emerald-100 via-emerald-100 to-emerald-100 dark:border-emerald-800/50 dark:from-emerald-950/55 dark:via-emerald-950/40 dark:to-emerald-950/55";
  }
  if (isFilterTheme.value) {
    return "border-violet-200/80 bg-gradient-to-r from-violet-100 via-violet-100 to-violet-100 dark:border-violet-800/50 dark:from-violet-950/55 dark:via-violet-950/40 dark:to-violet-950/55";
  }
  return "border-purple-200/70 bg-gradient-to-r from-violet-100 via-purple-100 to-violet-100 dark:border-purple-800/45 dark:from-violet-950/50 dark:via-purple-950/35 dark:to-violet-950/50";
});

const headerPatternClass = computed(() => {
  if (isAnalysisTheme.value) {
    return "bg-[radial-gradient(circle_at_1px_1px,_rgb(14,165,233)_1px,_transparent_0)]";
  }
  if (isSheetTheme.value) {
    return "bg-[radial-gradient(circle_at_1px_1px,_rgb(34,197,94)_1px,_transparent_0)]";
  }
  if (isWritingTheme.value) {
    return "bg-[radial-gradient(circle_at_1px_1px,_rgb(16,185,129)_1px,_transparent_0)]";
  }
  if (isFilterTheme.value) {
    return "bg-[radial-gradient(circle_at_1px_1px,_rgb(139,92,246)_1px,_transparent_0)]";
  }
  return "bg-[radial-gradient(circle_at_1px_1px,_rgb(251,146,60)_1px,_transparent_0)]";
});

const moodTextClass = computed(() => {
  if (isAnalysisTheme.value) return "text-sky-700 dark:text-sky-300/80";
  if (isSheetTheme.value) return "text-green-700 dark:text-green-300/80";
  if (isWritingTheme.value) return "text-emerald-700 dark:text-emerald-300/80";
  if (isFilterTheme.value) return "text-violet-700 dark:text-violet-300/80";
  return "text-purple-700 dark:text-purple-300/80";
});

const sparkleDotClass = computed(() => {
  if (isAnalysisTheme.value) return "bg-sky-400";
  if (isSheetTheme.value) return "bg-green-500";
  if (isWritingTheme.value) return "bg-emerald-500";
  if (isFilterTheme.value) return "bg-violet-400";
  return "bg-purple-400";
});

const welcomeBackdropClass = computed(() => {
  if (isAnalysisTheme.value) {
    return "bg-gradient-to-br from-sky-50/40 via-sky-50/20 to-sky-100/30 dark:from-sky-950/15 dark:via-sky-950/5 dark:to-sky-950/10";
  }
  if (isSheetTheme.value) {
    return "bg-gradient-to-br from-green-50/35 via-green-50/15 to-green-100/25 dark:from-green-950/15 dark:via-green-950/5 dark:to-green-950/10";
  }
  if (isWritingTheme.value) {
    return "bg-gradient-to-br from-emerald-50/35 via-emerald-50/15 to-emerald-100/25 dark:from-emerald-950/15 dark:via-emerald-950/5 dark:to-emerald-950/10";
  }
  if (isFilterTheme.value) {
    return "bg-gradient-to-br from-violet-50/35 via-violet-50/15 to-violet-100/25 dark:from-violet-950/15 dark:via-violet-950/5 dark:to-violet-950/10";
  }
  return "bg-gradient-to-br from-violet-50/30 via-purple-50/20 to-violet-50/30 dark:from-violet-950/10 dark:via-purple-950/5 dark:to-violet-950/10";
});

const welcomeBubbleRingClass = computed(() => {
  if (isAnalysisTheme.value) return "ring-sky-100 dark:ring-sky-900/40";
  if (isSheetTheme.value) return "ring-green-100 dark:ring-green-900/40";
  if (isWritingTheme.value) return "ring-emerald-100 dark:ring-emerald-900/40";
  if (isFilterTheme.value) return "ring-violet-100 dark:ring-violet-900/40";
  return "ring-purple-100 dark:ring-purple-900/40";
});

const quickActionChipClass = computed(() => {
  if (isAnalysisTheme.value) {
    return "border-sky-200/90 text-sky-900 hover:border-sky-300 hover:bg-sky-50/80 dark:border-sky-800/60 dark:text-sky-100 dark:hover:bg-sky-950/50";
  }
  if (isSheetTheme.value) {
    return "border-green-200/90 text-green-900 hover:border-green-300 hover:bg-green-50/80 dark:border-green-800/60 dark:text-green-100 dark:hover:bg-green-950/50";
  }
  if (isWritingTheme.value) {
    return "border-emerald-200/90 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-50/80 dark:border-emerald-800/60 dark:text-emerald-100 dark:hover:bg-emerald-950/50";
  }
  if (isFilterTheme.value) {
    return "border-violet-200/90 text-violet-900 hover:border-violet-300 hover:bg-violet-50/80 dark:border-violet-800/60 dark:text-violet-100 dark:hover:bg-violet-950/50";
  }
  return "border-purple-200/90 text-purple-900 hover:border-purple-300 hover:bg-purple-50/80 dark:border-purple-800/60 dark:text-purple-100 dark:hover:bg-purple-950/50";
});

const quickActionIconWrapClass = computed(() => {
  if (isAnalysisTheme.value) {
    return "bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300";
  }
  if (isSheetTheme.value) {
    return "bg-green-100 text-green-600 dark:bg-green-950/60 dark:text-green-300";
  }
  if (isWritingTheme.value) {
    return "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300";
  }
  if (isFilterTheme.value) {
    return "bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300";
  }
  return "bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300";
});

const footerClass = computed(() => {
  if (isAnalysisTheme.value) {
    return "border-sky-200/60 bg-gradient-to-b from-sky-50/90 to-sky-50/70 dark:from-sky-950/20 dark:to-sky-950/12";
  }
  if (isSheetTheme.value) {
    return "border-green-200/60 bg-gradient-to-b from-green-50/90 to-green-50/70 dark:from-green-950/20 dark:to-green-950/12";
  }
  if (isWritingTheme.value) {
    return "border-emerald-200/60 bg-gradient-to-b from-emerald-50/90 to-emerald-50/70 dark:from-emerald-950/20 dark:to-emerald-950/12";
  }
  if (isFilterTheme.value) {
    return "border-violet-200/60 bg-gradient-to-b from-violet-50/90 to-violet-50/70 dark:from-violet-950/20 dark:to-violet-950/12";
  }
  return "border-purple-200/60 bg-gradient-to-b from-violet-50/90 to-purple-50/70 dark:from-violet-950/20 dark:to-purple-950/12";
});

const appearance = useAppAppearance();
const historyRef = ref<HTMLElement | null>(null);

const penguinAnimation = computed(() =>
  props.isSending ? "penguin-eating" : "penguin-bobbing-small"
);

const formatDiffCounts = (
  d: NonNullable<AIRevisionAssistantMessage["diffCounts"]>
): string => {
  const types: Array<keyof typeof d.before> = [
    "product",
    "material",
    "shippingEvent",
  ];
  const parts: string[] = [];
  for (const t of types) {
    const b = d.before[t];
    const a = d.after[t];
    if (b === 0 && a === 0) continue;
    const sign = a > b ? "+" : a < b ? "−" : "±";
    parts.push(`${t} ${b}→${a} (${sign}${Math.abs(a - b)})`);
  }
  return parts.length > 0 ? parts.join(" / ") : "件数変更なし";
};

const scrollToBottom = async (): Promise<void> => {
  await nextTick();
  const el = historyRef.value;
  if (el) el.scrollTop = el.scrollHeight;
};

watch(
  () => props.messages.length,
  () => {
    void scrollToBottom();
  }
);

watch(
  () =>
    props.messages
      .map((m) => `${m.text?.length ?? 0}:${m.status ?? ""}`)
      .join("|"),
  () => {
    void scrollToBottom();
  }
);

onMounted(() => {
  void scrollToBottom();
  if (props.autofocusOnMount) {
    void focusInputWithRetry();
  }
});

watch(
  () => props.autofocusOnMount,
  (shouldFocus) => {
    if (shouldFocus) {
      void focusInputWithRetry();
    }
  }
);

defineExpose({ scrollToBottom, focusInput, focusInputWithRetry });
</script>

<style scoped>
@keyframes streaming-cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}

.streaming-cursor {
  animation: streaming-cursor-blink 0.9s ease-in-out infinite;
}

@keyframes penguin-bobbing {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
@keyframes penguin-bobbing-small {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}
@keyframes penguin-eating {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}
.penguin-bobbing {
  animation: penguin-bobbing 3.2s ease-in-out infinite;
}
.penguin-bobbing-small {
  animation: penguin-bobbing-small 3.2s ease-in-out infinite;
}
.penguin-eating {
  animation: penguin-eating 0.55s ease-in-out infinite;
}
.bubble-tail-up {
  position: absolute;
  top: -8px;
  left: 32px;
  width: 16px;
  height: 8px;
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  background-color: white;
}
.dark .bubble-tail-up {
  background-color: rgb(17 24 39);
}
.bubble-tail-left {
  position: absolute;
  left: -7px;
  top: 1.25rem;
  width: 8px;
  height: 14px;
  clip-path: polygon(100% 0%, 100% 100%, 0% 50%);
  background-color: white;
}
.dark .bubble-tail-left {
  background-color: rgb(17 24 39);
}
@keyframes gradient-shift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
.animate-gradient-shift {
  background-size: 200% 200%;
  animation: gradient-shift 8s ease infinite;
}

:deep(.ai-panel-textarea-comfortable textarea) {
  min-height: 5.75rem;
  padding: 0.875rem 1rem;
  font-size: 0.9375rem;
  line-height: 1.55;
}
</style>
