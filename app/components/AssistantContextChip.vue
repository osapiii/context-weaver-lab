<template>
  <div
    class="mx-4 mb-2 mt-4 flex items-stretch gap-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80"
  >
    <div :class="['w-1 flex-shrink-0', accentBarClass]" />

    <div class="min-w-0 flex-1 py-2.5 pr-3">
      <div
        class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
      >
        <UIcon
          name="material-symbols:my-location"
          class="h-3 w-3 text-sky-600"
        />
        認識中のページ
      </div>

      <div class="mt-0.5 flex items-center gap-1.5 truncate text-sm font-bold text-slate-900">
        <template v-if="ctx">
          <span class="font-semibold text-slate-500">{{ ctx.modeLabel }}</span>
          <UIcon
            name="material-symbols:chevron-right"
            class="h-4 w-4 flex-shrink-0 text-slate-400"
          />
          <span class="truncate">{{ ctx.pageLabel }}</span>
        </template>
        <template v-else>
          <span class="font-semibold text-slate-500">
            認識中のページが特定できません
          </span>
        </template>
      </div>

      <div
        v-if="isDev"
        class="mt-0.5 truncate font-mono text-[11px] text-slate-400"
        :title="routeName"
      >
        {{ routeName || "(unknown)" }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const route = useRoute();
const { findModeByRouteName, findGlobalRouteByName } =
  useNavigationModeRegistry();

const routeName = computed(() =>
  typeof route.name === "string" ? route.name : ""
);

const isDev = import.meta.dev;

type ContextInfo = {
  modeLabel: string;
  pageLabel: string;
  accent: "purple" | "warning" | "success" | "neutral" | "info";
};

const ctx = computed<ContextInfo | null>(() => {
  const name = routeName.value;
  if (!name) return null;
  const mode = findModeByRouteName(name);
  if (mode) {
    if (mode.homeRouteName === name) {
      return {
        modeLabel: mode.label,
        pageLabel: `${mode.label} モード TOP`,
        accent: mode.accent,
      };
    }

    for (const group of mode.groups) {
      const card = group.cards.find((c) => c.routeName === name);
      if (card) {
        return {
          modeLabel: mode.label,
          pageLabel: card.label,
          accent: mode.accent,
        };
      }
    }

    return {
      modeLabel: mode.label,
      pageLabel: "詳細ページ",
      accent: mode.accent,
    };
  }

  const global = findGlobalRouteByName(name);
  if (global) {
    return {
      modeLabel: "グローバル設定",
      pageLabel: global.label,
      accent: "neutral",
    };
  }

  return null;
});

const accentBarClass = computed(() => {
  if (!ctx.value) return "bg-slate-300";
  switch (ctx.value.accent) {
    case "purple":
      return "bg-purple-400";
    case "warning":
      return "bg-orange-400";
    case "success":
      return "bg-emerald-400";
    case "info":
      return "bg-sky-400";
    case "neutral":
    default:
      return "bg-slate-400";
  }
});
</script>
