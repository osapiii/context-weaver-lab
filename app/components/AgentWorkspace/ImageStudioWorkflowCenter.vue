<template>
  <div
    class="image-studio-workflow-center mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-3 py-4 sm:max-w-3xl sm:px-4"
    data-testid="image-studio-workflow-center"
  >
    <div class="relative w-fit max-w-full">
      <div
        class="speech-bubble relative w-fit max-w-full rounded-2xl bg-white px-4 py-3 ring-1 shadow-[0_6px_20px_-8px_rgba(139,92,246,0.28)]"
        :class="
          phase === 'failed'
            ? 'ring-rose-200'
            : phase === 'complete'
              ? 'ring-emerald-200'
              : 'ring-purple-200'
        "
      >
        <p
          class="whitespace-pre-line text-center text-sm font-semibold leading-snug"
          :class="
            phase === 'failed'
              ? 'text-rose-800'
              : phase === 'complete'
                ? 'text-emerald-900'
                : 'text-neutral-800'
          "
          aria-live="polite"
        >
          {{ headline }}
        </p>
        <p
          v-if="subline"
          class="mt-1.5 text-center text-xs leading-relaxed text-slate-600"
        >
          {{ subline }}
        </p>
        <span class="bubble-tail" aria-hidden="true" />
      </div>
    </div>

    <div class="penguin-body relative">
      <div class="penguin-shadow" aria-hidden="true" />
      <NuxtImg
        :src="appearance.aiAvatarUrl.value"
        :alt="
          appearance.hasCustomAiAvatar.value
            ? 'AI アシスタント'
            : '画像生成 AI バディ'
        "
        class="penguin-img relative z-10 h-32 w-32 object-contain sm:h-36 sm:w-36"
        :class="phase === 'working' ? 'penguin-thinking' : 'penguin-bobbing'"
      />
      <div
        class="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-purple-400 shadow-sm"
        :class="{ 'animate-pulse': phase !== 'working' }"
      >
        <UIcon
          :name="
            phase === 'working'
              ? 'material-symbols:progress-activity'
              : phase === 'complete'
                ? 'i-heroicons-check'
                : 'i-heroicons-exclamation-triangle'
          "
          class="h-3.5 w-3.5 text-white"
          :class="{ 'animate-spin': phase === 'working' }"
        />
      </div>
      <template v-if="phase === 'working'">
        <span class="thinking-dot d1" aria-hidden="true" />
        <span class="thinking-dot d2" aria-hidden="true" />
        <span class="thinking-dot d3" aria-hidden="true" />
      </template>
    </div>

    <div
      v-if="phase === 'working'"
      class="w-full rounded-xl border border-purple-200/90 bg-white px-4 py-3.5 shadow-sm"
      data-testid="image-studio-loading-bar"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-start gap-3">
        <UIcon
          name="material-symbols:progress-activity"
          class="mt-0.5 h-7 w-7 shrink-0 animate-spin text-purple-500"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-slate-900">
            {{ loadingTitle }}
          </p>
          <p class="mt-0.5 text-xs leading-relaxed text-slate-600">
            {{ loadingSubline }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="phase === 'working' && isKnowledgeSearchRunning && !hasReferenceSources"
      class="w-full rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-left shadow-sm"
      data-testid="image-studio-knowledge-searching"
    >
      <p class="flex items-center gap-2 text-xs font-medium text-sky-900">
        <UIcon
          name="material-symbols:progress-activity"
          class="h-4 w-4 shrink-0 animate-spin text-sky-600"
        />
        組織ナレッジを検索しています…
      </p>
    </div>

    <ConsultationSourceCarousel
      v-if="hasReferenceSources"
      class="w-full"
      :source-references="resolvedSourceReferences"
      :grounding-metadata="groundingMetadata"
      :documents="referenceDocuments"
    />

    <ul
      v-if="activities.length > 0"
      class="w-full space-y-1.5 rounded-xl border border-violet-100 bg-white/80 px-3 py-2.5 text-left shadow-sm"
      data-testid="image-studio-workflow-activities"
    >
      <li
        v-for="act in activities"
        :key="act.id"
        class="flex items-center gap-2 text-[11px] text-slate-600"
      >
        <UIcon
          v-if="act.status === 'running'"
          name="material-symbols:progress-activity"
          class="h-3.5 w-3.5 shrink-0 animate-spin text-purple-500"
        />
        <UIcon
          v-else-if="act.status === 'failed'"
          name="material-symbols:error-outline"
          class="h-3.5 w-3.5 shrink-0 text-rose-500"
        />
        <UIcon
          v-else
          name="material-symbols:check-circle"
          class="h-3.5 w-3.5 shrink-0 text-emerald-500"
        />
        <span>{{ formatAdkToolActivityDisplay(act.name, act.status) }}</span>
      </li>
    </ul>

    <div
      v-if="phase === 'complete'"
      class="w-full space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-4 text-left text-sm leading-relaxed text-slate-700 sm:px-5"
      data-testid="image-studio-workflow-result"
    >
      <EnMarkdown
        v-if="resultBodyMarkdown"
        :markdown-text="resultBodyMarkdown"
        variant="ai"
        compact
        class="text-left text-[13px] text-slate-800 sm:text-sm"
      />
      <div
        v-if="outputArtifacts.length > 0"
        class="space-y-2"
        data-testid="image-studio-workflow-outputs"
      >
        <p class="text-xs font-semibold text-emerald-900/85">
          出力
        </p>
        <WorkspaceArtifactChip
          v-for="{ artifact, index } in outputArtifacts"
          :key="`${messageId ?? 'msg'}-output-${index}`"
          :artifact="artifact"
          :message-id="messageId ?? ''"
          :index="index"
          :session-id="sessionId"
          :active="isOutputChipActive({ artifact, index })"
          @open="onOpenOutput({ artifact, index })"
        />
      </div>
      <p class="text-center text-xs font-medium text-emerald-900 sm:text-sm">
        右の <span class="font-bold">ファイル出力</span> からプレビューできます{{
          workflowPhase === "create" ? "。必要ならレタッチへ進んでください" : ""
        }}
      </p>
    </div>

    <p
      v-if="userPrompt && phase !== 'working'"
      class="w-full max-w-2xl truncate text-center text-[10px] text-slate-400 sm:text-xs"
      :title="userPrompt"
    >
      指示: {{ userPrompt }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import EnMarkdown from "@components/EnMarkdown.vue";
import WorkspaceArtifactChip from "@components/AgentWorkspace/WorkspaceArtifactChip.vue";
import {
  WORKSPACE_ARTIFACT_PANEL_KEY,
  type WorkspaceArtifactPanelApi,
} from "@composables/useWorkspaceArtifactPanel";
import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import ConsultationSourceCarousel from "@components/ConsultationSourceCarousel.vue";
import type { Document } from "@models/document";
import {
  formatAdkToolActivityDisplay,
  isKnowledgeSearchActivityName,
  type AgentSseActivity,
} from "@utils/adkToolActivities";
import {
  messageHasReferenceSources,
  resolveMessageSourceReferences,
} from "@utils/adkArtifacts";
import type { ConsultationSourceReference } from "@utils/consultationSourceReferences";
import { workspaceArtifactKey } from "@utils/workspaceArtifactMeta";
import type { ImageWorkflowPhase } from "@utils/imageStudioState";

const appearance = useAppAppearance();

const props = withDefaults(
  defineProps<{
    phase: "working" | "complete" | "failed";
    workflowPhase: ImageWorkflowPhase;
    statusText?: string;
    resultText?: string;
    resultBodyMarkdown?: string;
    outputArtifacts?: Array<{ artifact: AgentSseArtifact; index: number }>;
    messageId?: string;
    sessionId?: string | null;
    userPrompt?: string;
    activities?: AgentSseActivity[];
    /** citation 等 — output 以外も含む message.artifacts */
    messageArtifacts?: AgentSseArtifact[];
    sourceReferences?: ConsultationSourceReference[] | null;
    groundingMetadata?: unknown;
    referenceDocuments?: Document[];
  }>(),
  {
    statusText: undefined,
    resultText: undefined,
    resultBodyMarkdown: undefined,
    outputArtifacts: () => [],
    messageId: undefined,
    sessionId: null,
    userPrompt: undefined,
    activities: () => [],
    messageArtifacts: () => [],
    sourceReferences: undefined,
    groundingMetadata: undefined,
    referenceDocuments: () => [],
  }
);

const artifactPanel = inject<WorkspaceArtifactPanelApi | null>(
  WORKSPACE_ARTIFACT_PANEL_KEY,
  null
);

const onOpenOutput = (params: {
  artifact: AgentSseArtifact;
  index: number;
}): void => {
  if (!artifactPanel || !props.messageId) return;
  const key = workspaceArtifactKey({
    artifact: params.artifact,
    messageId: props.messageId,
    index: params.index,
  });
  artifactPanel.selectByKey(key);
};

const isOutputChipActive = (params: {
  artifact: AgentSseArtifact;
  index: number;
}): boolean => {
  if (!artifactPanel?.selectedKey.value || !props.messageId) return false;
  return (
    artifactPanel.selectedKey.value ===
    workspaceArtifactKey({
      artifact: params.artifact,
      messageId: props.messageId,
      index: params.index,
    })
  );
};

const artifactsForSourceResolution = computed(() => {
  if (props.messageArtifacts?.length) return props.messageArtifacts;
  return props.outputArtifacts.map((item) => item.artifact);
});

const resolvedSourceReferences = computed(() =>
  resolveMessageSourceReferences({
    artifacts: artifactsForSourceResolution.value,
    sourceReferences: props.sourceReferences,
    groundingMetadata: props.groundingMetadata,
  })
);

const hasReferenceSources = computed(() =>
  messageHasReferenceSources({
    artifacts: artifactsForSourceResolution.value,
    sourceReferences: props.sourceReferences,
    groundingMetadata: props.groundingMetadata,
  })
);

const isKnowledgeSearchRunning = computed(() =>
  props.activities.some(
    (activity) =>
      activity.status === "running" &&
      isKnowledgeSearchActivityName(activity.name)
  )
);

const loadingTitle = computed((): string => {
  if (props.statusText?.trim()) return props.statusText.trim();
  if (props.workflowPhase === "retouch") return "レタッチを適用しています…";
  return "画像を生成しています…";
});

const loadingSubline = computed((): string => {
  if (isKnowledgeSearchRunning.value && !hasReferenceSources.value) {
    return "組織ナレッジを参照しながら描いています。完了までしばらくお待ちください。";
  }
  return "しばらくお待ちください。完了すると右のファイル出力に表示されます。";
});

const headline = computed((): string => {
  if (props.phase === "working") {
    return props.statusText ?? "画像を生成しています…";
  }
  if (props.phase === "failed") {
    return props.resultText?.startsWith("⚠️")
      ? props.resultText.replace(/^⚠️\s*/, "")
      : props.resultText ?? "生成に失敗しました";
  }
  if (props.workflowPhase === "retouch") {
    return "レタッチが完了しました";
  }
  return "初稿ができました";
});

const subline = computed((): string | undefined => {
  if (props.phase === "working") {
    return undefined;
  }
  if (props.phase === "failed") {
    return "内容を変えて、もう一度お試しください";
  }
  return undefined;
});
</script>

<style scoped>
.speech-bubble {
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.02));
}

.bubble-tail {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-top: 12px solid white;
}

.penguin-img {
  will-change: transform;
}

.penguin-bobbing {
  animation: penguin-bob 3.6s ease-in-out infinite;
}

.penguin-thinking {
  animation: penguin-think 1.1s ease-in-out infinite;
}

@keyframes penguin-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-1.5deg);
  }
  50% {
    transform: translateY(-10px) rotate(1.5deg);
  }
}

@keyframes penguin-think {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-4px) rotate(-2deg);
  }
  75% {
    transform: translateY(-4px) rotate(2deg);
  }
}

.penguin-shadow {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 88px;
  height: 12px;
  background: radial-gradient(
    ellipse,
    rgba(168, 85, 247, 0.28) 0%,
    transparent 70%
  );
  border-radius: 50%;
  filter: blur(5px);
  animation: shadow-pulse 3.6s ease-in-out infinite;
}

@keyframes shadow-pulse {
  0%,
  100% {
    width: 88px;
    opacity: 0.7;
  }
  50% {
    width: 64px;
    opacity: 0.4;
  }
}

.thinking-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8b5cf6;
  animation: dot-float 1.4s ease-in-out infinite;
}

.thinking-dot.d1 {
  top: 8px;
  right: -4px;
  animation-delay: 0s;
}

.thinking-dot.d2 {
  top: 24px;
  right: -10px;
  animation-delay: 0.3s;
}

.thinking-dot.d3 {
  top: 40px;
  right: -2px;
  animation-delay: 0.6s;
}

@keyframes dot-float {
  0%,
  100% {
    opacity: 0.2;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .penguin-bobbing,
  .penguin-thinking,
  .penguin-shadow,
  .thinking-dot {
    animation: none;
  }
}
</style>
