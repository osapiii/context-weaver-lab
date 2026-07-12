<template>
  <aside
    class="flex h-full w-full min-h-0 flex-shrink-0 flex-col bg-neutral-50/80 transition-transform duration-200"
  >
    <div class="flex flex-shrink-0 flex-col gap-2 border-b border-neutral-200 px-2 py-2">
      <EnButton
        variant="solid"
        color="primary"
        size="sm"
        class="w-full justify-center"
        leading-icon="material-symbols:add"
        @click="onNewSession"
      >
        新しい相談
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
          class="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-8 pr-2 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
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
            : "まだ履歴がありません。\n上のボタンで相談を始めましょう。"
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
                ? 'bg-white shadow-sm ring-1 ring-sky-200'
                : 'hover:bg-white/80',
            ]"
            @click="onSelect(s.sessionId)"
            @keydown.enter="onSelect(s.sessionId)"
            @keydown.space.prevent="onSelect(s.sessionId)"
          >
            <AgentWorkspaceSessionThumbnail
              v-if="s.imageThumbnail"
              :session-id="s.sessionId"
              :thumbnail="s.imageThumbnail"
            />
            <div
              v-else
              :class="[
                'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
                agentChipClass(s.activeAgent),
              ]"
            >
              <UIcon
                :name="agentIcon(s.activeAgent)"
                class="h-3.5 w-3.5"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p
                class="line-clamp-2 text-xs font-semibold leading-snug text-neutral-800 break-words"
                :title="s.title"
              >
                {{ s.title || "(無題)" }}
              </p>
              <p class="mt-0.5 text-[10px] text-neutral-500">
                {{ formatRelative(s.updatedAt) }}
                <span v-if="s.messageCount > 0" class="text-neutral-400">
                  · {{ s.messageCount }} 件
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
        variant="ghost"
        size="xs"
        class="w-full justify-center text-neutral-500"
        leading-icon="material-symbols:home"
        @click="onBackToHub"
      >
        セッション一覧に戻る
      </EnButton>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  aiStudioSessionsRevision,
  subscribeAiStudioSessions,
  useAiStudioSessions,
  type AiStudioSessionListItem,
} from "@composables/useAiStudioSessions";
import { useAiStudioStore } from "@stores/aiStudio";
import type { AiStudioActiveAgent } from "@stores/aiStudio";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import EnButton from "@components/EnButton.vue";
import AgentWorkspaceSessionThumbnail from "@components/AgentWorkspace/AgentWorkspaceSessionThumbnail.vue";

const store = useAiStudioStore();
const sessionsApi = useAiStudioSessions();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
const searchQuery = ref("");

let unsubscribeSessions: (() => void) | null = null;

const resubscribeSessions = (): void => {
  unsubscribeSessions?.();
  unsubscribeSessions = subscribeAiStudioSessions();
};

onMounted(() => {
  resubscribeSessions();
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
  }
);

const emit = defineEmits<{
  (e: "back-to-hub" | "select"): void;
}>();

const allSessions = computed(() => {
  void aiStudioSessionsRevision.value;
  return sessionsApi.list();
});

const filteredSessions = computed<AiStudioSessionListItem[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allSessions.value;
  return allSessions.value.filter(
    (s) =>
      s.title.toLowerCase().includes(q) || s.sessionId.toLowerCase().includes(q)
  );
});

const onNewSession = () => {
  void store.startNewConversation();
};

const onSelect = (sessionId: string) => {
  if (sessionId === store.sessionId) return;
  void store.loadSession(sessionId);
  emit("select");
};

const onDelete = (sessionId: string) => {
  if (
    !confirm(
      "この相談履歴を削除しますか？\n（会話内容は復元できません）"
    )
  ) {
    return;
  }
  void store.deleteSession(sessionId);
};

const onBackToHub = () => {
  emit("back-to-hub");
};

const agentIcon = (agent: AiStudioActiveAgent): string => {
  switch (agent) {
    case "writing":
      return "material-symbols:edit-document";
    case "sheet":
      return "material-symbols:grid-on";
    case "image":
      return "material-symbols:image";
    case "consultation":
      return "material-symbols:psychology";
    case "research":
      return "material-symbols:auto-stories";
    default:
      return "material-symbols:chat";
  }
};

const agentChipClass = (agent: AiStudioActiveAgent): string => {
  switch (agent) {
    case "writing":
      return "bg-emerald-50 text-emerald-600";
    case "sheet":
      return "bg-blue-50 text-blue-600";
    case "image":
      return "bg-violet-50 text-violet-600";
    case "consultation":
      return "bg-sky-50 text-sky-600";
    case "research":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-neutral-100 text-neutral-500";
  }
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
