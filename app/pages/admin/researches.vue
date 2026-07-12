<template>
  <div class="flex w-full flex-col bg-neutral-50/60 px-6 pt-6">
    <AdminModePageNav current-page-label="生成済みレポート一覧" />

    <!-- ヘッダ -->
    <header class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 shadow-sm"
        >
          <UIcon
            name="material-symbols:folder-special"
            class="h-5 w-5 text-white"
          />
        </div>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-neutral-900">
            生成済みレポート一覧
          </h1>
          <p class="text-xs text-neutral-500">
            過去に AI で生成したリサーチレポート。タイルクリックで続きから再開。
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          :disabled="loading"
          @click="load"
        >
          <UIcon
            name="material-symbols:refresh"
            class="h-4 w-4"
            :class="loading ? 'animate-spin' : ''"
          />
          更新
        </button>
        <NuxtLink
          :to="{ name: 'admin-ai-studio', query: { kind: 'research' } }"
          class="flex items-center gap-1.5 rounded-md bg-purple-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-600"
        >
          <UIcon name="material-symbols:add" class="h-4 w-4" />
          新しいレポート
        </NuxtLink>
      </div>
    </header>

    <!-- ツールバー -->
    <div
      v-if="store.sessions.length > 0"
      class="mb-5 flex flex-wrap items-center gap-2"
    >
      <div class="relative flex-1 min-w-[200px] max-w-md">
        <UIcon
          name="material-symbols:search"
          class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="テーマ・ID で検索"
          class="w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
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
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50',
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

    <!-- ローディング / 空 / エラー -->
    <div v-if="loading && !store.sessions.length" class="py-10 text-center text-sm text-neutral-500">
      読み込み中…
    </div>

    <div
      v-else-if="error"
      class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"
    >
      ⚠️ {{ error }}
    </div>

    <div
      v-else-if="!store.sessions.length"
      class="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-white px-6 py-12 text-center"
    >
      <UIcon
        name="material-symbols:auto-stories"
        class="mb-3 h-12 w-12 text-neutral-300"
      />
      <p class="text-sm text-neutral-600">
        まだセッションがありません。<br>
        「新しいレポート」から最初のリサーチを開始してください。
      </p>
    </div>

    <div
      v-else-if="filteredSessions.length === 0"
      class="flex flex-1 flex-col items-center justify-center text-center text-sm text-neutral-500"
    >
      <UIcon name="material-symbols:filter-alt-off" class="mb-2 h-8 w-8 text-neutral-300" />
      該当するセッションがありません。
      <button
        class="mt-2 text-purple-600 underline hover:text-purple-700"
        type="button"
        @click="resetFilters"
      >
        フィルタをリセット
      </button>
    </div>

    <!-- タイル grid -->
    <div v-else class="flex-1 overflow-y-auto">
      <div
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <article
          v-for="s in filteredSessions"
          :key="s.sessionId"
          :class="[
            'tile group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-sm transition cursor-pointer',
            isCompleted(s)
              ? 'border border-neutral-300 hover:border-neutral-500 hover:shadow-md'
              : isFailed(s)
                ? 'border border-neutral-300'
                : 'border border-dashed border-neutral-300 hover:border-neutral-400',
          ]"
          @click="resume(s.sessionId)"
        >
          <!-- プレビュー領域 (4:3) -->
          <div class="tile-preview relative aspect-[4/3] w-full overflow-hidden border-b border-neutral-200 bg-neutral-50">
            <!-- 完成済 + research.html ある場合: iframe スケール表示 -->
            <iframe
              v-if="isCompleted(s) && researchHtmlUrl(s)"
              :src="researchHtmlUrl(s)!"
              :title="`${s.theme} preview`"
              loading="lazy"
              referrerpolicy="no-referrer"
              sandbox="allow-same-origin"
              class="preview-iframe pointer-events-none"
              aria-hidden="true"
            />
            <!-- 生成中 / 失敗: フェーズアイコン + ラベル (placeholder) -->
            <div
              v-else
              class="flex h-full w-full flex-col items-center justify-center bg-neutral-100"
            >
              <UIcon
                :name="phaseIcon(phaseIndex(s.currentPhase))"
                class="h-10 w-10 text-neutral-400"
              />
              <span class="mt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {{ phaseLabel(phaseIndex(s.currentPhase)) }}
              </span>
            </div>

            <!-- ステータスドット (右上) -->
            <span
              :class="[
                'absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold backdrop-blur',
                statusTextClass(s.status),
              ]"
            >
              <span :class="['h-1.5 w-1.5 rounded-full', statusDotBg(s.status)]" />
              {{ statusLabel(s.status) }}
            </span>

            <!-- hover overlay: 続きから / 削除 -->
            <div
              class="tile-actions pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100"
            >
              <span class="pointer-events-auto inline-flex items-center gap-1 rounded-md bg-purple-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                <UIcon name="material-symbols:play-arrow" class="h-3.5 w-3.5" />
                続きから
              </span>
              <button
                type="button"
                class="pointer-events-auto inline-flex items-center gap-1 rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-sm transition hover:bg-rose-50 hover:text-rose-600"
                @click.stop="confirmDelete(s.sessionId)"
              >
                <UIcon name="material-symbols:delete-outline" class="h-3.5 w-3.5" />
                削除
              </button>
            </div>
          </div>

          <!-- コンテンツ領域 -->
          <div class="flex flex-col gap-2 px-3 pb-3 pt-3">
            <h2 class="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900">
              {{ s.theme || "(無題のセッション)" }}
            </h2>

            <!-- Mini Phase Stepper (4 bars) -->
            <div class="flex items-center gap-1">
              <span
                v-for="(_p, i) in 4"
                :key="i"
                :class="[
                  'h-1 flex-1 rounded-full transition-all',
                  phaseDotClass(s, i),
                ]"
                :title="phaseLabel(i)"
              />
            </div>

            <!-- メタ -->
            <div class="flex items-center justify-between text-[10px] text-neutral-400">
              <span class="inline-flex items-center gap-1">
                <UIcon name="material-symbols:schedule" class="h-3 w-3" />
                {{ relativeTime(s.updatedAt) }}
              </span>
              <span class="font-mono">{{ shortId(s.sessionId) }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  useResearchAgentStore,
  PHASE_ORDER,
  PHASE_LABELS,
  type SessionListItem,
  type ResearchAgentPhaseKey,
} from "@stores/researchAgent";

definePageMeta({
  layout: "admin",
});

const store = useResearchAgentStore();
const router = useRouter();
const loading = ref(false);
const error = ref<string | null>(null);

// ─── 検索 / フィルタ ─────────────────────────
const searchQuery = ref("");
const statusFilter = ref<"all" | "active" | "completed" | "failed">("all");
const showInactive = ref(false);

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    await store.listSessions();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
};

const resume = async (sessionId: string) => {
  await router.push({
    name: "admin-ai-studio",
    query: { kind: "research", session: sessionId },
  });
};

const confirmDelete = async (sessionId: string) => {
  if (
    !confirm(
      "このセッションを削除しますか? (GCS のアーティファクトは 30 日で自動削除されます)",
    )
  )
    return;
  try {
    await store.deleteSession(sessionId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
};

const isCompleted = (s: SessionListItem): boolean => s.status === "completed";
const isFailed = (s: SessionListItem): boolean => s.status === "failed";
// 「生成中 + 無題 + 0 ファイル」=実質デッド扱い
const isInactive = (s: SessionListItem): boolean =>
  s.status !== "completed" &&
  s.status !== "failed" &&
  (!s.theme || s.artifacts.length === 0);

const inactiveCount = computed(() => store.sessions.filter(isInactive).length);

const filteredSessions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return store.sessions.filter((s) => {
    if (!showInactive.value && isInactive(s)) return false;
    if (statusFilter.value !== "all" && s.status !== statusFilter.value) return false;
    if (q) {
      const blob = `${s.theme ?? ""} ${s.sessionId}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
});

const statusFilters = computed(() => {
  const counts = { all: 0, active: 0, completed: 0, failed: 0 };
  for (const s of store.sessions) {
    if (!showInactive.value && isInactive(s)) continue;
    counts.all += 1;
    if (s.status === "completed") counts.completed += 1;
    else if (s.status === "failed") counts.failed += 1;
    else counts.active += 1;
  }
  return [
    { key: "all" as const, label: "すべて", count: counts.all },
    { key: "active" as const, label: "進行中", count: counts.active },
    { key: "completed" as const, label: "完成", count: counts.completed },
    { key: "failed" as const, label: "失敗", count: counts.failed },
  ];
});

const resetFilters = () => {
  searchQuery.value = "";
  statusFilter.value = "all";
  showInactive.value = true;
};

// ─── HTML プレビュー URL ─────────────────
const researchHtmlUrl = (s: SessionListItem): string | null => {
  const html = s.artifacts.find(
    (a) => a.kind === "html" || /research\.html$/i.test(a.name),
  );
  return html?.signedUrl || null;
};

// ─── Phase 進捗 ─────────────────────────
const phaseIndex = (currentPhase: string | null): number => {
  if (!currentPhase) return 0;
  const idx = PHASE_ORDER.indexOf(currentPhase as ResearchAgentPhaseKey);
  return idx >= 0 ? idx : 0;
};
const phaseLabel = (idx: number): string => {
  const key = PHASE_ORDER[idx];
  return key ? PHASE_LABELS[key] : "—";
};
const phaseIcon = (idx: number): string =>
  [
    "material-symbols:hearing",
    "material-symbols:travel-explore",
    "material-symbols:design-services",
    "material-symbols:auto-stories",
  ][idx] ?? "material-symbols:auto-stories";

const phaseProgress = (s: SessionListItem): number => {
  if (s.status === "completed") return 4;
  if (!s.currentPhase) return 0;
  return phaseIndex(s.currentPhase) + 1;
};
const phaseDotClass = (s: SessionListItem, i: number): string => {
  const progress = phaseProgress(s);
  if (s.status === "failed" && i === progress - 1) return "bg-neutral-400";
  if (i < progress - 1) return "bg-purple-500";
  if (i === progress - 1)
    return s.status === "completed"
      ? "bg-purple-500"
      : "bg-purple-400 animate-pulse";
  return "bg-neutral-200";
};

// ─── ステータス ──────────────────────────
const statusLabel = (status: string) => {
  switch (status) {
    case "completed":
      return "完成";
    case "failed":
      return "失敗";
    default:
      return "生成中";
  }
};
const statusTextClass = (status: string): string => {
  switch (status) {
    case "completed":
      return "text-neutral-700";
    case "failed":
      return "text-neutral-500";
    default:
      return "text-purple-700";
  }
};
const statusDotBg = (status: string): string => {
  switch (status) {
    case "completed":
      return "bg-neutral-900";
    case "failed":
      return "bg-neutral-400";
    default:
      return "bg-purple-500 animate-pulse";
  }
};

// ─── 時刻 / ID ───────────────────────────
const relativeTime = (sec: number): string => {
  const ms = (sec || 0) * 1000;
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(ms));
};

const shortId = (sid: string): string => {
  if (!sid) return "—";
  return sid.length > 8 ? sid.slice(0, 8) : sid;
};

onMounted(load);
</script>

<style scoped>
.tile {
  transition:
    border-color 0.15s,
    box-shadow 0.2s,
    transform 0.15s,
    opacity 0.15s;
}
.tile:hover {
  transform: translateY(-2px);
}

/* HTML プレビュー: iframe を縮小スケールで張る */
.preview-iframe {
  position: absolute;
  top: 0;
  left: 0;
  /* 1320px (HTML テンプレ max-width) → tile thumb 幅まで縮小 */
  width: 1320px;
  height: 990px; /* 4:3 比率 (1320 * 3/4) */
  transform-origin: top left;
  /* tile thumb は約 300px 幅 → 300/1320 ≈ 0.227. レスポンシブで調整 */
  transform: scale(0.227);
  pointer-events: none;
  border: none;
  background: #ffffff;
}
@media (min-width: 640px) {
  .preview-iframe { transform: scale(0.21); }
}
@media (min-width: 1024px) {
  .preview-iframe { transform: scale(0.215); }
}
@media (min-width: 1280px) {
  .preview-iframe { transform: scale(0.20); }
}
.tile-preview {
  isolation: isolate;
}
</style>
