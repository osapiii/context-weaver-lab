<template>
  <NuxtLink
    :to="{ name: detailRouteName, query: { session: session.sessionId } }"
    :class="[
      'group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
      borderClass,
    ]"
  >
    <!-- ステータスバッジ (右上) -->
    <span
      :class="[
        'absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
        statusBadgeClass,
      ]"
    >
      <span :class="['h-1.5 w-1.5 rounded-full', statusDotClass]" />
      {{ statusLabel }}
    </span>

    <!-- サムネイル (画像 → text preview → icon) -->
    <div
      class="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden bg-neutral-50"
    >
      <img
        v-if="session.thumbnailUrl"
        :src="session.thumbnailUrl"
        :alt="session.title || '(無題)'"
        loading="lazy"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      >
      <p
        v-else-if="session.previewText"
        class="line-clamp-4 px-4 py-3 text-center text-[11px] leading-relaxed text-neutral-500"
      >
        {{ session.previewText }}
      </p>
      <UIcon
        v-else
        name="material-symbols:hearing"
        class="h-12 w-12 text-neutral-300"
      />
    </div>

    <!-- フッタ: タイトル + メタ -->
    <div class="flex flex-1 flex-col gap-1.5 px-3 py-2.5">
      <h3 class="line-clamp-2 text-[13px] font-semibold text-neutral-800">
        {{ session.title || "(無題)" }}
      </h3>
      <!-- 進捗バー (progress があれば) -->
      <div
        v-if="session.progress !== undefined"
        class="h-1 w-full overflow-hidden rounded-full bg-neutral-100"
      >
        <div
          :class="['h-full transition-all', progressBarClass]"
          :style="{ width: `${Math.round(session.progress * 100)}%` }"
        />
      </div>
      <div class="flex items-center justify-between text-[10px] text-neutral-500">
        <span class="inline-flex items-center gap-1">
          <UIcon name="material-symbols:schedule" class="h-3 w-3" />
          {{ relativeUpdatedAt }}
        </span>
        <span class="font-mono text-neutral-400">{{ shortId }}</span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type {
  AgentSessionListItem,
  AgentListConfig,
} from "@composables/agentSessions/types";

interface Props {
  session: AgentSessionListItem;
  accent: AgentListConfig["accent"];
  detailRouteName: string;
}
const props = defineProps<Props>();

defineEmits<{ (e: "delete"): void }>();

const statusLabel = computed(() => {
  switch (props.session.status) {
    case "completed":
      return "完成";
    case "failed":
      return "失敗";
    case "active":
    default:
      return "生成中";
  }
});

const statusBadgeClass = computed(() => {
  switch (props.session.status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "failed":
      return "bg-rose-50 text-rose-700";
    case "active":
    default:
      return "bg-purple-50 text-purple-700";
  }
});

const statusDotClass = computed(() => {
  switch (props.session.status) {
    case "completed":
      return "bg-emerald-500";
    case "failed":
      return "bg-rose-500";
    case "active":
    default:
      return "bg-purple-500 animate-pulse";
  }
});

const borderClass = computed(() => {
  switch (props.accent) {
    case "emerald":
      return "border-neutral-200 hover:border-emerald-300";
    case "teal":
      return "border-neutral-200 hover:border-teal-300";
    case "rose":
      return "border-neutral-200 hover:border-rose-300";
    case "sky":
      return "border-neutral-200 hover:border-sky-300";
    case "purple":
    default:
      return "border-neutral-200 hover:border-purple-300";
  }
});

const progressBarClass = computed(() => {
  switch (props.accent) {
    case "emerald":
      return "bg-emerald-500";
    case "teal":
      return "bg-teal-500";
    case "rose":
      return "bg-rose-500";
    case "sky":
      return "bg-sky-500";
    case "purple":
    default:
      return "bg-purple-500";
  }
});

const shortId = computed(() => props.session.sessionId.slice(0, 8));

const relativeUpdatedAt = computed(() => {
  const t = props.session.updatedAt;
  if (!t) return "—";
  const ms = typeof t === "number" ? t : t.getTime();
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}日前`;
  return new Date(ms).toLocaleDateString("ja-JP");
});
</script>
