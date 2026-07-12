<template>
  <div class="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
    <!-- モバイルのみ: セッション履歴 / ファイル出力（デスクトップは左右サイドバー） -->
    <div
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
        v-if="store.shouldShowArtifactPanel || artifactPanelOpen"
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
        ファイル出力
      </EnButton>
    </div>

    <div
      v-if="isResearchJob"
      class="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div
        v-if="sessionDrawerOpen"
        class="fixed inset-0 z-40 bg-black/30 md:hidden"
        aria-hidden="true"
        @click="sessionDrawerOpen = false"
      />
      <ResearchAgentSessionSidebar
        v-if="sessionDrawerOpen"
        class="fixed inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] shadow-xl md:hidden"
        show-hub-back-button
        :show-reports-link="false"
        @back-to-hub="onBackToHub"
        @select="sessionDrawerOpen = false"
      />
      <ResearchAgentPanel
        embedded-in-workspace
        show-hub-back-button
        :show-reports-link="false"
        class="min-h-0 min-w-0 flex-1"
        @back-to-hub="onBackToHub"
      />
    </div>

    <AgentWorkspaceWorkflowFrame
      v-else
      class="min-h-0 min-w-0 flex-1"
    >
      <template
        v-if="showWorkspaceStepper"
        #stepper
      >
        <AiStudioWorkspaceStepper
          header
          :disabled="store.isStreaming"
        />
      </template>

      <div class="flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden">
      <div
        v-if="sessionDrawerOpen"
        class="fixed inset-0 z-40 bg-black/30 md:hidden"
        aria-hidden="true"
        @click="sessionDrawerOpen = false"
      />
      <AgentWorkspaceSessionSidebar
        v-if="sessionDrawerOpen"
        class="fixed inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] shadow-xl md:hidden"
        @back-to-hub="onBackToHub"
        @select="sessionDrawerOpen = false"
      />
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
          <AgentWorkspaceSessionSidebar
            class="min-h-0 flex-1"
            @back-to-hub="onBackToHub"
          />
        </div>
      </aside>

      <AgentWorkspaceAIPanel
        ref="aiPanelRef"
        class="min-h-0 min-w-0 flex-1"
        show-hub-back-button
        @back-to-hub="onBackToHub"
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
    </AgentWorkspaceWorkflowFrame>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, provide, ref, watch } from "vue";
import { useAiStudioStore } from "@stores/aiStudio";
import ResearchAgentPanel from "@components/ResearchAgentPanel.vue";
import ResearchAgentSessionSidebar from "@components/ResearchAgentSessionSidebar.vue";
import {
  aiStudioSessionsRevision,
  useAiStudioSessions,
} from "@composables/useAiStudioSessions";
import {
  useWorkspaceArtifactPanel,
  WORKSPACE_ARTIFACT_PANEL_KEY,
} from "@composables/useWorkspaceArtifactPanel";
import EnButton from "@components/EnButton.vue";
import AgentWorkspaceWorkflowFrame from "./AgentWorkspaceWorkflowFrame.vue";
import AgentWorkspaceAIPanel from "./AgentWorkspaceAIPanel.vue";
import AiStudioWorkspaceStepper from "./AiStudioWorkspaceStepper.vue";
import WorkspaceArtifactPanel from "./WorkspaceArtifactPanel.vue";
import AgentWorkspaceSessionSidebar from "./AgentWorkspaceSessionSidebar.vue";

const store = useAiStudioStore();
const aiPanelRef = ref<InstanceType<typeof AgentWorkspaceAIPanel> | null>(null);

const emit = defineEmits<{
  (e: "back-to-hub"): void;
}>();

const historyPanelOpen = ref(false);
const sessionDrawerOpen = ref(false);
const isResearchJob = computed(() => store.jobKind === "research");
const showWorkspaceStepper = computed(
  () => store.activeAgent === "image" || store.activeAgent === "writing"
);

const artifactPanel = useWorkspaceArtifactPanel({
  messages: computed(() => store.messages),
  sessionId: computed(() => store.sessionId),
});
provide(WORKSPACE_ARTIFACT_PANEL_KEY, artifactPanel);

/** composable の Ref / ComputedRef を子 props 用に unwrap（未 unwrap だと子で .meta が落ちる） */
const artifactPanelOpen = computed(() => artifactPanel.panelOpen.value);
const artifactEntries = computed(() => artifactPanel.entries.value);
const artifactSelectedEntry = computed(() => artifactPanel.selectedEntry.value);
const artifactSelectedKey = computed(() => artifactPanel.selectedKey.value);
const artifactSelectedIndex = computed(() => artifactPanel.selectedIndex.value);
const artifactImageViewMode = computed(() => artifactPanel.imageViewMode.value);

const sessionsApi = useAiStudioSessions();
const sessionCount = computed(() => {
  void aiStudioSessionsRevision.value;
  return sessionsApi.list().length;
});

watch(
  () => store.sessionId,
  () => {
    artifactPanel.closePanel();
  }
);

watch(
  () => store.imageWorkflowPhase,
  async (phase, previous) => {
    if (phase !== "retouch" || previous === "retouch") return;
    await nextTick();
    artifactPanel.selectLatest();
  }
);

const onBackToHub = () => {
  sessionDrawerOpen.value = false;
  emit("back-to-hub");
};

const showArtifactAside = computed(
  () => artifactPanelOpen.value || store.shouldShowArtifactPanel
);

onMounted(() => {
  if (store.activeAgent === "consultation") {
    void aiPanelRef.value?.focusConsultationInput?.();
  }
});
</script>
