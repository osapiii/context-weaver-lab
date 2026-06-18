<template>
  <aside
    class="flex h-full w-full min-h-0 flex-shrink-0 flex-col bg-neutral-50/80 transition-transform duration-200"
  >
    <div class="flex flex-shrink-0 flex-col gap-2 border-b border-neutral-200 px-2 py-2">
      <EnButton
        variant="solid"
        color="neutral"
        size="sm"
        class="w-full justify-center"
        leading-icon="material-symbols:add"
        :disabled="store.isStreaming"
        @click="onNewSession"
      >
        新しいレポート
      </EnButton>
      <div class="relative">
        <UIcon
          name="material-symbols:search"
          class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="履歴を検索…"
          class="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-8 pr-2 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
      <p
        v-if="filteredSessions.length === 0"
        class="px-2 py-6 text-center text-xs leading-relaxed text-neutral-500"
      >
        {{
          searchQuery.trim()
            ? "該当する履歴がありません"
            : "まだ履歴がありません。\n上のボタンでレポートを始めましょう。"
        }}
      </p>

      <ul v-else class="space-y-0.5">
        <li
          v-for="s in filteredSessions"
          :key="s.sessionId"
        >
          <div
            role="button"
            tabindex="0"
            :class="[
              'group flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition',
              s.sessionId === store.sessionId
                ? 'bg-white shadow-sm ring-1 ring-slate-300'
                : 'hover:bg-white/80',
            ]"
            @click="onSelect(s.sessionId)"
            @keydown.enter="onSelect(s.sessionId)"
            @keydown.space.prevent="onSelect(s.sessionId)"
          >
            <div
              class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600"
            >
              <UIcon
                name="material-symbols:auto-stories"
                class="h-3.5 w-3.5"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p
                class="line-clamp-2 break-words text-xs font-semibold leading-snug text-neutral-800"
                :title="sessionTitle(s)"
              >
                {{ sessionTitle(s) }}
              </p>
              <p class="mt-0.5 text-[10px] text-neutral-500">
                {{ formatRelative(s.updatedAt) }}
                <span
                  v-if="s.currentPhase"
                  class="text-neutral-400"
                >
                  · {{ phaseLabel(s.currentPhase) }}
                </span>
              </p>
            </div>
            <button
              type="button"
              class="mt-0.5 flex-shrink-0 rounded p-1 text-neutral-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
              title="削除"
              @click.stop="onDelete(s.sessionId)"
            >
              <UIcon name="material-symbols:delete-outline" class="h-4 w-4" />
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div class="flex-shrink-0 border-t border-neutral-200 px-3 py-2">
      <EnButton
        v-if="showReportsLink"
        variant="ghost"
        size="xs"
        class="mb-1 w-full justify-center text-neutral-500"
        leading-icon="material-symbols:folder-special"
        to="/admin/researches"
      >
        生成済みレポート一覧
      </EnButton>
      <EnButton
        v-if="showHubBackButton"
        variant="ghost"
        size="xs"
        class="w-full justify-center text-neutral-500"
        leading-icon="material-symbols:home"
        @click="emit('back-to-hub')"
      >
        AIスタジオに戻る
      </EnButton>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  aiStudioSessionsRevision,
  subscribeAiStudioSessions,
  useAiStudioSessions,
  type AiStudioSessionListItem,
} from "@composables/useAiStudioSessions";
import { useAiStudioStore } from "@stores/aiStudio";
import { useResearchAgentStore } from "@stores/researchAgent";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import EnButton from "@components/EnButton.vue";

withDefaults(
  defineProps<{
    showHubBackButton?: boolean;
    showReportsLink?: boolean;
  }>(),
  {
    showHubBackButton: false,
    showReportsLink: true,
  },
);

const emit = defineEmits<{
  (e: "back-to-hub" | "select"): void;
}>();

const store = useResearchAgentStore();
const sessionsApi = useAiStudioSessions();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
const router = useRouter();
const searchQuery = ref("");

let unsubscribeSessions: (() => void) | null = null;

const resubscribeSessions = (): void => {
  unsubscribeSessions?.();
  unsubscribeSessions = subscribeAiStudioSessions();
};

onMounted(() => {
  resubscribeSessions();
  void store.listSessions();
});

onUnmounted(() => {
  unsubscribeSessions?.();
  unsubscribeSessions = null;
});

watch(
  () => [
    organizationStore.loggedInOrganizationInfo?.id,
    spaceStore.selectedSpace?.id,
  ],
  () => {
    resubscribeSessions();
    void store.listSessions();
  },
);

watch(aiStudioSessionsRevision, () => {
  void store.listSessions();
});

const researchSessions = computed((): AiStudioSessionListItem[] => {
  void aiStudioSessionsRevision.value;
  return sessionsApi.list().filter((s) => s.jobKind === "research");
});

const filteredSessions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return researchSessions.value;
  return researchSessions.value.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.sessionId.toLowerCase().includes(q) ||
      (s.researchTheme ?? "").toLowerCase().includes(q),
  );
});

const sessionTitle = (s: AiStudioSessionListItem): string =>
  s.researchTheme?.trim() || s.title?.trim() || "(無題)";

const phaseLabel = (phase: string): string => {
  const map: Record<string, string> = {
    phase1_hearing: "ヒアリング",
    phase2_research: "リサーチ",
    phase3_diagram: "図解",
    phase4_reading: "読み物",
  };
  return map[phase] ?? phase;
};

const onNewSession = async (): Promise<void> => {
  store.reset();
  store.resetBriefing();
  const aiStudio = useAiStudioStore();
  await aiStudio.startSession("research");
};

const onSelect = async (sessionId: string): Promise<void> => {
  if (sessionId === store.sessionId) return;
  try {
    const aiStudio = useAiStudioStore();
    const ok = await aiStudio.loadSession(sessionId);
    if (!ok) throw new Error("load failed");
    await router.replace({
      name: "admin-ai-studio",
      query: { kind: "research", session: sessionId },
    });
    emit("select");
  } catch {
    useToast().add({
      title: "セッションを開けませんでした",
      color: "error",
    });
  }
};

const onDelete = (sessionId: string): void => {
  if (
    !confirm(
      "このレポート履歴を削除しますか？\n（会話内容は復元できません）",
    )
  ) {
    return;
  }
  void store.deleteSession(sessionId);
};

const formatRelative = (ts: number): string => {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min} 分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 時間前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 日前`;
  return new Date(ts).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
};
</script>
