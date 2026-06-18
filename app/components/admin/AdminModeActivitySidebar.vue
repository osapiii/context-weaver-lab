<template>
  <aside
    :id="props.sidebarId"
    class="flex shrink-0 flex-col border-r border-slate-200/90 bg-white/95 shadow-[2px_0_12px_-6px_rgba(15,23,42,0.12)] backdrop-blur-sm transition-all duration-300 ease-in-out"
    :class="asideWidthClass"
    :style="asideStyle"
    :aria-hidden="focusHidden"
    aria-label="メインナビゲーション"
  >
    <!-- 開閉トグル -->
    <div
      class="shrink-0 border-b border-slate-200/90 px-1.5 py-2"
      :class="collapsed ? 'px-1' : 'px-2'"
    >
      <button
        type="button"
        data-testid="admin-nav-sidebar-toggle"
        class="group flex w-full flex-col items-center gap-1 rounded-xl text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        :class="collapsed ? 'px-1 py-2' : 'rounded-2xl px-2 py-2.5'"
        :aria-expanded="!collapsed"
        :aria-controls="props.sidebarId"
        :title="collapsed ? 'ナビゲーションを展開' : 'ナビゲーションを折りたたむ'"
        :aria-label="collapsed ? 'ナビゲーションを展開' : 'ナビゲーションを折りたたむ'"
        @click="$emit('toggle')"
      >
        <UIcon
          :name="
            collapsed
              ? 'material-symbols:chevron-right-rounded'
              : 'material-symbols:chevron-left-rounded'
          "
          class="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105"
          :class="{ 'h-6 w-6': !collapsed }"
        />
        <span
          v-if="!collapsed"
          class="text-center text-[10px] font-semibold leading-tight"
        >
          閉じる
        </span>
      </button>
    </div>

    <!-- ナビ (折りたたみ時はアイコンのみ) -->
    <nav
      class="flex flex-1 flex-col gap-1 overflow-y-auto py-2"
      :class="collapsed ? 'px-1' : 'gap-1.5 px-2.5'"
    >
      <template
        v-for="(group, groupIdx) in groupedNavModes"
        :key="group.id"
      >
        <div
          v-if="groupIdx > 0"
          class="my-0.5 h-px bg-slate-200"
          aria-hidden="true"
        />
        <button
          v-for="entry in group.modes"
          :key="entry.mode.key"
          type="button"
          class="group relative flex w-full flex-col items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          :class="[
            collapsed
              ? 'min-h-[3.25rem] gap-0 rounded-xl px-1 py-2'
              : 'min-h-[5.5rem] gap-1.5 rounded-2xl px-2 py-3',
            currentModeKey === entry.mode.key
              ? ACTIVE_NAV_CLASS
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
          ]"
          :title="`${entry.mode.label} (${modKey}+${entry.shortcutKey})`"
          :aria-current="currentModeKey === entry.mode.key ? 'page' : undefined"
          :aria-label="entry.mode.label"
          @click="$emit('navigate', entry.mode)"
        >
          <span
            class="relative inline-flex h-8 w-8 shrink-0 items-center justify-center"
          >
            <UIcon
              :name="entry.mode.icon"
              class="h-full w-full transition-transform duration-200 group-hover:scale-105"
              :class="navIconClass(entry)"
            />
            <span
              v-if="collapsed && entry.mode.badge"
              class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-slate-400 ring-2 ring-white"
              aria-hidden="true"
            />
          </span>

          <template v-if="!collapsed">
            <span class="text-center text-xs font-bold leading-snug">
              {{ entry.mode.label }}
            </span>

            <span
              v-if="entry.mode.badge"
              class="rounded-full bg-slate-200 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-slate-600"
            >
              {{ entry.mode.badge }}
            </span>

            <span
              class="inline-flex items-center gap-0.5 text-[9px] font-medium text-slate-500"
              aria-hidden="true"
            >
              <UKbd class="px-1 py-0 text-[9px]">{{ modKey }}</UKbd>
              <span>+</span>
              <UKbd class="min-w-[1rem] px-1 py-0 text-[9px]">
                {{ entry.shortcutKey }}
              </UKbd>
            </span>
          </template>
        </button>
      </template>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import type { NavMode } from "@composables/useNavigationModeRegistry";
import { isMulticolorNavIcon } from "@composables/useNavModeIcons";
import {
  ADMIN_NAV_SIDEBAR_COLLAPSED_WIDTH,
  ADMIN_NAV_SIDEBAR_WIDTH,
} from "@constants/adminLayout";

export type AdminNavModeEntry = {
  mode: NavMode;
  shortcutKey: string;
};

export type AdminNavModeGroup = {
  id: string;
  modes: AdminNavModeEntry[];
};

const props = withDefaults(
  defineProps<{
    groupedNavModes: AdminNavModeGroup[];
    currentModeKey?: string;
    collapsed?: boolean;
    focusHidden?: boolean;
    sidebarId?: string;
  }>(),
  {
    sidebarId: "admin-nav-sidebar",
    collapsed: false,
    focusHidden: false,
  }
);

defineEmits<{
  navigate: [mode: NavMode];
  toggle: [];
}>();

const asideWidthClass = computed(() => {
  if (props.focusHidden) {
    return "pointer-events-none w-0 overflow-hidden border-r-0 opacity-0";
  }
  if (props.collapsed) {
    return "w-[var(--admin-nav-sidebar-collapsed-width)] opacity-100";
  }
  return "w-[var(--admin-nav-sidebar-width)] opacity-100";
});

const asideStyle = computed(() => ({
  "--admin-nav-sidebar-width": ADMIN_NAV_SIDEBAR_WIDTH,
  "--admin-nav-sidebar-collapsed-width": ADMIN_NAV_SIDEBAR_COLLAPSED_WIDTH,
}));

const isMac = computed(() => {
  if (typeof navigator === "undefined") return false;
  return navigator.platform.toUpperCase().includes("MAC");
});

const modKey = computed(() => (isMac.value ? "⌘" : "Ctrl"));

/** 選択中はモード accent に依存せずホームと同じ neutral トーンに統一 */
const ACTIVE_NAV_CLASS =
  "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80";

function navIconClass(entry: AdminNavModeEntry): string[] {
  if (isMulticolorNavIcon(entry.mode.icon)) {
    const active = props.currentModeKey === entry.mode.key;
    return [
      active
        ? "drop-shadow-sm"
        : "opacity-88 saturate-[1.02] group-hover:opacity-100",
    ];
  }
  const active = props.currentModeKey === entry.mode.key;
  return [active ? "text-current" : "text-slate-500"];
}
</script>
