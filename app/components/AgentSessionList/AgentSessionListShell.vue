<template>
  <div class="flex w-full flex-col bg-neutral-50/60 px-6 pt-6">
    <AdminModePageNav :current-page-label="config.title" />

    <!-- ヘッダ -->
    <header class="mb-5 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div
          :class="[
            'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm',
            config.iconGradient,
          ]"
        >
          <UIcon :name="config.icon" class="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-neutral-900">
            {{ config.title }}
          </h1>
          <p class="text-xs text-neutral-500">{{ config.description }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          <UIcon
            name="material-symbols:refresh"
            class="h-4 w-4"
            :class="loading ? 'animate-spin' : ''"
          />
          更新
        </button>
        <NuxtLink
          :to="{ name: config.newRouteName }"
          :class="[
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm',
            newButtonClass,
          ]"
        >
          <UIcon name="material-symbols:add" class="h-4 w-4" />
          {{ config.newLabel }}
        </NuxtLink>
      </div>
    </header>

    <!-- ツールバー -->
    <div
      v-if="sessions.length > 0"
      class="mb-5 flex flex-wrap items-center gap-2"
    >
      <div class="relative min-w-[200px] max-w-md flex-1">
        <UIcon
          name="material-symbols:search"
          class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="config.searchPlaceholder"
          :class="[
            'w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2',
            searchFocusClass,
          ]"
        >
      </div>
      <div class="flex items-center gap-1">
        <button
          v-for="f in statusFilters"
          :key="f.key"
          type="button"
          :class="[
            'rounded-full px-3 py-1 text-[11px] font-semibold transition',
            statusFilter === f.key
              ? 'bg-neutral-900 text-white'
              : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
          ]"
          @click="statusFilter = f.key"
        >
          {{ f.label }}
          <span
            v-if="f.count > 0"
            :class="[
              'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
              statusFilter === f.key ? 'bg-white/20' : 'bg-neutral-100',
            ]"
          >
            {{ f.count }}
          </span>
        </button>
      </div>
      <label
        class="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
      >
        <input
          v-model="showInactive"
          type="checkbox"
          class="h-3 w-3 rounded border-neutral-300"
        >
        生成中・無題も表示 ({{ inactiveCount }})
      </label>
    </div>

    <!-- ローディング / エラー / 空 -->
    <div
      v-if="loading && !sessions.length"
      class="py-10 text-center text-sm text-neutral-500"
    >
      読み込み中…
    </div>

    <div
      v-else-if="error"
      class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"
    >
      ⚠️ {{ error }}
    </div>

    <div
      v-else-if="!sessions.length"
      class="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-white px-6 py-12 text-center"
    >
      <UIcon
        :name="config.icon"
        class="mb-3 h-12 w-12 text-neutral-300"
      />
      <p class="mb-1 text-sm font-semibold text-neutral-700">
        {{ config.emptyState.heading }}
      </p>
      <p class="mb-4 max-w-sm text-xs text-neutral-500">
        {{ config.emptyState.description }}
      </p>
      <NuxtLink
        :to="{ name: config.newRouteName }"
        :class="[
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm',
          newButtonClass,
        ]"
      >
        <UIcon name="material-symbols:add" class="h-4 w-4" />
        {{ config.newLabel }}
      </NuxtLink>
    </div>

    <!-- カード grid (slot で個別 agent のカード描画を差し込み) -->
    <div
      v-else
      class="grid grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <slot
        name="card"
        v-for="s in filteredSessions"
        :key="s.sessionId"
        :session="s"
      >
        <!-- デフォルト card (slot 未指定時) -->
        <AgentSessionListDefaultCard
          :key="s.sessionId"
          :session="s"
          :accent="config.accent"
          :detail-route-name="config.detailRouteName"
          @delete="$emit('delete', s.sessionId)"
        />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import AgentSessionListDefaultCard from "./AgentSessionListDefaultCard.vue";
import type {
  AgentListConfig,
  AgentSessionListItem,
  AgentSessionStatus,
} from "@composables/agentSessions/types";

interface Props {
  config: AgentListConfig;
  sessions: AgentSessionListItem[];
  loading?: boolean;
  error?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
});

defineEmits<{
  (e: "refresh"): void;
  (e: "delete", sessionId: string): void;
}>();

const searchQuery = ref("");
const statusFilter = ref<"all" | AgentSessionStatus>("all");
const showInactive = ref(false);

/** 「無題 / 生成中・空っぽ」判定. agent 個別ロジックを差し替え可能 */
const isInactive = (s: AgentSessionListItem): boolean => {
  if (props.config.isInactive) return props.config.isInactive(s);
  return !s.title || s.title === "(無題)";
};

const inactiveCount = computed(
  () => props.sessions.filter(isInactive).length
);

const filteredSessions = computed<AgentSessionListItem[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return props.sessions.filter((s) => {
    if (!showInactive.value && isInactive(s)) return false;
    if (statusFilter.value !== "all" && s.status !== statusFilter.value)
      return false;
    if (q && !s.title.toLowerCase().includes(q) && !s.sessionId.includes(q))
      return false;
    return true;
  });
});

const statusFilters = computed(() => {
  const counts = { all: 0, active: 0, completed: 0, failed: 0 } as Record<
    "all" | AgentSessionStatus,
    number
  >;
  for (const s of props.sessions) {
    counts.all += 1;
    counts[s.status] += 1;
  }
  return [
    { key: "all" as const, label: "すべて", count: counts.all },
    { key: "active" as const, label: "進行中", count: counts.active },
    { key: "completed" as const, label: "完成", count: counts.completed },
    { key: "failed" as const, label: "失敗", count: counts.failed },
  ];
});

const newButtonClass = computed(() => {
  switch (props.config.accent) {
    case "emerald":
      return "bg-emerald-500 hover:bg-emerald-600";
    case "teal":
      return "bg-teal-500 hover:bg-teal-600";
    case "rose":
      return "bg-rose-500 hover:bg-rose-600";
    case "sky":
      return "bg-sky-500 hover:bg-sky-600";
    case "purple":
    default:
      return "bg-purple-500 hover:bg-purple-600";
  }
});

const searchFocusClass = computed(() => {
  switch (props.config.accent) {
    case "emerald":
      return "focus:border-emerald-400 focus:ring-emerald-100";
    case "teal":
      return "focus:border-teal-400 focus:ring-teal-100";
    case "rose":
      return "focus:border-rose-400 focus:ring-rose-100";
    case "sky":
      return "focus:border-sky-400 focus:ring-sky-100";
    case "purple":
    default:
      return "focus:border-purple-400 focus:ring-purple-100";
  }
});
</script>
