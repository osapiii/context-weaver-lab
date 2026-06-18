<template>
  <div class="briefing-finalize flex h-full min-h-0 flex-col">
    <!-- ヘッダー -->
    <div class="flex flex-shrink-0 items-center gap-3 px-5 py-4 border-b border-neutral-100">
      <UIcon
        :name="briefing.config.icon ?? 'material-symbols:check-circle'"
        :class="['h-9 w-9', headerIconClass]"
      />
      <div>
        <h2 class="text-lg font-bold text-neutral-800">
          {{ briefing.config.finalize?.heading ?? "内容を確認して送信" }}
        </h2>
        <p class="mt-0.5 text-xs text-neutral-500">
          {{ briefing.config.finalize?.sub ?? "ここまでの回答が AI に渡るプロンプトになります。" }}
        </p>
      </div>
    </div>

    <!-- 2 カラム: 左 = 編集可能ボード, 右 = プロンプトプレビュー -->
    <div class="flex min-h-0 flex-1 gap-4 overflow-hidden p-5">
      <div class="min-w-0 flex-1 overflow-y-auto">
        <AgentBriefingStickyBoard
          :briefing="briefing"
          :editable="true"
          @edit="onEditNote"
        />
      </div>

      <div class="flex min-w-0 flex-1 flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div class="flex flex-shrink-0 items-center gap-2 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
          <UIcon name="material-symbols:description" class="h-4 w-4 text-neutral-500" />
          <span class="text-xs font-bold text-neutral-700">
            AI に渡すプロンプト
          </span>
          <span
            v-if="hasEdits"
            class="ml-1 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700"
          >
            <UIcon name="material-symbols:edit" class="h-3 w-3" /> 編集中
          </span>
          <button
            type="button"
            class="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100"
            @click="toggleEditMode"
          >
            <UIcon
              :name="hasEdits ? 'material-symbols:auto-fix' : 'material-symbols:edit-outline'"
              class="h-4 w-4"
            />
            {{ hasEdits ? "付箋から再生成" : "直接編集" }}
          </button>
        </div>

        <textarea
          v-if="hasEdits"
          v-model="editedPrompt"
          class="min-h-0 flex-1 resize-none rounded-b-2xl border-0 p-4 font-mono text-xs leading-relaxed text-neutral-800 focus:outline-none"
        />
        <pre
          v-else
          class="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded-b-2xl bg-white p-4 font-mono text-xs leading-relaxed text-neutral-800"
        >{{ autoPrompt }}</pre>
      </div>
    </div>

    <!-- フッター: アクション -->
    <div class="flex flex-shrink-0 items-center justify-between gap-2 border-t border-neutral-100 px-5 py-3 bg-neutral-50/40">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
        @click="onRestart"
      >
        <UIcon name="material-symbols:refresh" class="h-4 w-4" />
        最初からやり直す
      </button>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
          @click="briefing.back()"
        >
          <UIcon name="material-symbols:arrow-back" class="h-4 w-4" />
          1つ戻る
        </button>
        <button
          type="button"
          :class="[
            'inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm md:text-base font-bold text-white transition-all duration-200',
            confirmBtnClass,
          ]"
          @click="onConfirm"
        >
          <UIcon name="material-symbols:send" class="h-4 w-4" />
          {{ briefing.config.finalize?.confirmLabel ?? "AI に渡す" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AgentBriefingStickyBoard from "./AgentBriefingStickyBoard.vue";
import type { AgentBriefingHandle } from "@composables/agentBriefing/useAgentBriefing";

const props = defineProps<{
  briefing: AgentBriefingHandle;
}>();

const emit = defineEmits<{
  (e: "confirm", prompt: string): void;
  (e: "restart"): void;
}>();

const autoPrompt = computed(() => props.briefing.buildPrompt());
const editedPrompt = ref<string>("");
const hasEdits = ref<boolean>(false);

watch(
  autoPrompt,
  (next) => {
    if (!hasEdits.value) editedPrompt.value = next;
  },
  { immediate: true }
);

const toggleEditMode = () => {
  if (hasEdits.value) {
    hasEdits.value = false;
    editedPrompt.value = autoPrompt.value;
  } else {
    hasEdits.value = true;
    editedPrompt.value = autoPrompt.value;
  }
};

const onEditNote = (step: number) => {
  props.briefing.goTo(step);
};

const onRestart = () => {
  props.briefing.reset();
  emit("restart");
};

const onConfirm = () => {
  const prompt = hasEdits.value ? editedPrompt.value.trim() : autoPrompt.value.trim();
  if (!prompt) return;
  props.briefing.finalize();
  emit("confirm", prompt);
};

const accent = computed(() => props.briefing.config.accent ?? "purple");

const headerIconClass = computed(() => {
  switch (accent.value) {
    case "emerald":
      return "text-emerald-600";
    case "sky":
      return "text-sky-600";
    case "violet":
      return "text-violet-600";
    case "purple":
    default:
      return "text-purple-600";
  }
});

const confirmBtnClass = computed(() => {
  switch (accent.value) {
    case "emerald":
      return "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-200 hover:-translate-y-0.5";
    case "sky":
      return "bg-gradient-to-br from-sky-500 to-blue-500 shadow-lg shadow-sky-200 hover:-translate-y-0.5";
    case "violet":
      return "bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-200 hover:-translate-y-0.5";
    case "purple":
    default:
      return "bg-gradient-to-br from-purple-500 to-violet-500 shadow-lg shadow-purple-200 hover:-translate-y-0.5";
  }
});
</script>
