<template>
  <section class="system-board relative overflow-hidden rounded-3xl p-5 sm:p-7">
    <!-- 紙の質感 (ほぼ白 + 方眼) -->
    <div class="paper-bg absolute inset-0 -z-10" aria-hidden="true" />
    <div class="board-inset absolute inset-0 -z-10" aria-hidden="true" />
    <span class="corner-tape" aria-hidden="true" />

    <!-- ヘッダー -->
    <header class="mb-5">
      <div class="flex items-center gap-2">
        <UIcon
          name="material-symbols:settings-rounded"
          class="w-6 h-6 text-neutral-600 flex-shrink-0"
        />
        <h2 class="board-title text-lg sm:text-xl font-extrabold tracking-tight text-neutral-900">
          システム稼働状況
        </h2>
      </div>
      <p class="text-xs text-neutral-500 mt-2 pl-7">
        いま EN AIstudio がどの組織・スペース・AI 接続で動いているかの一覧です。
      </p>
    </header>

    <!-- 設定インデックスカード群 -->
    <div
      class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-1 pb-1"
    >
      <component
        :is="item.to ? 'button' : 'div'"
        v-for="(item, idx) in items"
        :key="item.key"
        :class="[
          'note-card relative flex flex-col rounded-lg px-3 py-3 text-left transition-all',
          item.to ? 'is-clickable cursor-pointer' : '',
        ]"
        :style="{ '--note-rotation': noteRotation(idx) }"
        :type="item.to ? 'button' : undefined"
        @click="item.to && router.push(item.to)"
      >
        <!-- 小さなクリアテープ (左上に貼ったメモ感) -->
        <span
          :class="['note-tape', `tape-${tapeColor(idx)}`]"
          aria-hidden="true"
        />

        <!-- ラベル行 -->
        <div class="flex items-center gap-1.5 mb-1.5">
          <UIcon
            :name="item.icon"
            class="w-4 h-4 text-neutral-500 flex-shrink-0"
          />
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-neutral-500">
            {{ item.label }}
          </span>
        </div>

        <!-- 値 -->
        <div class="flex items-start gap-1.5 min-w-0">
          <span
            :class="[
              'text-sm font-bold leading-snug truncate flex-1',
              item.muted ? 'text-neutral-400 italic' : 'text-neutral-900',
            ]"
            :title="item.value"
          >
            {{ item.value }}
          </span>
        </div>

        <!-- ステータスチップ + アクション矢印 -->
        <div class="mt-auto pt-2 flex items-center justify-between gap-1">
          <span
            v-if="item.statusBadge"
            :class="[
              'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold whitespace-nowrap',
              item.statusBadge.tone === 'ok'
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                : item.statusBadge.tone === 'warn'
                  ? 'bg-purple-50 text-purple-800 ring-1 ring-purple-200'
                  : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200',
            ]"
          >
            {{ item.statusBadge.label }}
          </span>
          <span v-else />
          <UIcon
            v-if="item.to"
            name="i-heroicons-arrow-up-right"
            class="w-3 h-3 text-neutral-400"
          />
        </div>
      </component>
    </div>
  </section>
</template>

<script lang="ts" setup>
import type { RouteLocationRaw } from "vue-router";

const router = useRouter();
const space = useSpaceStore();
const organization = useOrganizationStore();
const researchAgent = useResearchAgentStore();
const fileSpace = useGeminiFileSpaceOperatorStore();
const geminiByok = useGeminiByokStore();
const runtimeConfig = useRuntimeConfig();

onMounted(() => {
  void geminiByok.loadUserApiKey();
});

// 環境名 (development / production / sandbox など)
const envName = computed(() => {
  const raw = (runtimeConfig.public.environment as string) ?? "development";
  const map: Record<string, string> = {
    production: "本番",
    development: "開発",
    sandbox: "Sandbox",
  };
  return map[raw] ?? raw;
});

type StatusTone = "ok" | "warn" | "muted";
type InfoItem = {
  key: string;
  icon: string;
  label: string;
  value: string;
  muted?: boolean;
  to?: RouteLocationRaw;
  statusBadge?: { label: string; tone: StatusTone };
};

// 微回転 + テープ色を index 由来で決定的に割り当て (毎回同じ見た目)。
// 回転は ±0.5° 以内に抑えて "SaaS 整列" を壊しつつ、子供っぽくはしない。
const ROTATIONS = ["-0.5deg", "0.4deg", "-0.3deg", "0.5deg", "-0.4deg", "0.3deg"];
const TAPES = ["yellow", "mint", "rose", "mint", "yellow", "rose"] as const;
const noteRotation = (i: number) => ROTATIONS[i % ROTATIONS.length];
const tapeColor = (i: number) => TAPES[i % TAPES.length];

const items = computed<InfoItem[]>(() => {
  const orgName =
    (organization.loggedInOrganizationInfo as { name?: string })?.name?.trim() ||
    "";
  const spaceName = space.selectedSpace?.name?.trim() || "";
  const hasApiKey = geminiByok.hasApiKey;
  const knowledgeCount = fileSpace.fileSpaces.length;

  return [
    {
      key: "org",
      icon: "material-symbols:domain-rounded",
      label: "組織",
      value: orgName || "未取得",
      muted: !orgName,
    },
    {
      key: "space",
      icon: "material-symbols:workspaces-outline-rounded",
      label: "スペース",
      value: spaceName || "未選択",
      muted: !spaceName,
    },
    {
      key: "ai-byok",
      icon: "material-symbols:key-vertical-rounded",
      label: "AI 接続 (BYOK)",
      value: hasApiKey ? "Gemini API キー登録済" : "未登録",
      muted: !hasApiKey,
      to: { name: "admin-api-keys" },
      statusBadge: hasApiKey
        ? { label: "OK", tone: "ok" }
        : { label: "要設定", tone: "warn" },
    },
    {
      key: "env",
      icon: "material-symbols:public",
      label: "実行環境",
      value: envName.value,
      statusBadge:
        envName.value === "本番"
          ? { label: "LIVE", tone: "ok" }
          : { label: "DEV", tone: "muted" },
    },
    {
      key: "knowledge",
      icon: "material-symbols:menu-book-outline-rounded",
      label: "ナレッジ素材",
      value: knowledgeCount > 0 ? `${knowledgeCount} スペース接続中` : "未接続",
      muted: knowledgeCount === 0,
      to: { name: "admin-data-source" },
    },
  ];
});
</script>

<style scoped>
/* === ホワイトボード地: ほぼ白 + 方眼 (クリームは付けない) === */
.paper-bg {
  background-color: #fcfcf8;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  background-size:
    24px 24px,
    24px 24px;
  border-radius: 1.5rem;
}
.board-inset {
  border-radius: 1.5rem;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.06),
    inset 0 0 0 6px rgba(255, 255, 255, 0.5),
    inset 0 0 0 7px rgba(0, 0, 0, 0.04),
    0 8px 22px -10px rgba(0, 0, 0, 0.12);
}
.corner-tape {
  position: absolute;
  top: 18px;
  right: -16px;
  width: 96px;
  height: 24px;
  background: rgba(167, 243, 208, 0.85); /* mint — 設定ボード = 落ち着いた色 */
  border-radius: 1px;
  transform: rotate(28deg);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.05);
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0,
    transparent 5px,
    rgba(5, 150, 105, 0.18) 5px,
    rgba(5, 150, 105, 0.18) 6px
  );
  pointer-events: none;
}
.board-title {
  position: relative;
  display: inline-block;
  padding: 0 4px;
}
.board-title::before {
  content: "";
  position: absolute;
  left: -2px;
  right: -2px;
  bottom: 2px;
  top: 60%;
  background: rgba(167, 243, 208, 0.55); /* mint highlight */
  z-index: -1;
  border-radius: 4px 6px 5px 7px;
  transform: skewX(-2deg);
}

/* === ノート紙カード: 薄クリーム + 微回転 + クリアテープ === */
.note-card {
  min-height: 6rem;
  background-color: #fffdf6; /* whisper-warm 紙色 (純白を避ける) */
  border: 1px solid rgba(0, 0, 0, 0.07);
  box-shadow: 0 4px 10px -4px rgba(120, 90, 50, 0.12);
  transform: rotate(var(--note-rotation, 0deg));
  /* 紙の微細なムラ感 (テクスチャ風グラデ) */
  background-image:
    linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, transparent 38%),
    linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.02) 100%);
  transition:
    transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 200ms ease,
    border-color 200ms ease;
}
.note-card.is-clickable:hover {
  transform: rotate(var(--note-rotation, 0deg)) translateY(-2px);
  box-shadow: 0 8px 18px -6px rgba(120, 90, 50, 0.2);
  border-color: rgba(0, 0, 0, 0.12);
}

/* === クリアテープ (左上の角に貼ったメモ感) === */
.note-tape {
  position: absolute;
  top: -6px;
  left: 14px;
  width: 32px;
  height: 12px;
  border-radius: 1px;
  transform: rotate(-12deg);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  pointer-events: none;
}
.note-tape.tape-yellow {
  background: rgba(253, 224, 71, 0.7); /* yellow-300 半透明 */
}
.note-tape.tape-mint {
  background: rgba(167, 243, 208, 0.75); /* emerald-200 */
}
.note-tape.tape-rose {
  background: rgba(254, 205, 211, 0.75); /* rose-200 */
}

@media (prefers-reduced-motion: reduce) {
  .note-card {
    transition: none;
  }
  .note-card.is-clickable:hover {
    transform: rotate(var(--note-rotation, 0deg));
  }
}
</style>
