<template>
  <div
    class="drive-sync-chip inline-flex h-9 max-w-[min(360px,100%)] items-center rounded-full text-xs font-semibold shadow-sm ring-1 transition hover:-translate-y-0.5"
    :class="chipToneClass"
    :title="chipTitle"
  >
    <UDropdownMenu
      v-model:open="menuOpen"
      :items="menuItems"
      :content="{ align: 'start', side: 'bottom' }"
      :ui="{ content: 'min-w-[15rem]' }"
    >
      <button
        type="button"
        data-testid="gdrive-sync-header-chip"
        class="inline-flex h-full min-w-0 flex-1 items-center gap-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        :class="
          showImportCta
            ? 'rounded-l-full pl-2.5 pr-1'
            : 'rounded-full px-2.5'
        "
        @click="onChipClick"
      >
        <span
          class="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/5"
          aria-hidden="true"
        >
          <UIcon name="logos:google-drive" class="h-4 w-4" />
          <span
            v-if="showStatusOverlay"
            class="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-white"
            :class="statusOverlayClass"
          >
            <UIcon
              :name="statusOverlayIcon"
              class="h-2.5 w-2.5"
              :class="{
                'animate-spin':
                  chipState === 'running' || chipState === 'scanning',
              }"
            />
          </span>
        </span>

        <span class="min-w-0 truncate text-left leading-tight">
          <span class="block truncate">{{ primaryLabel }}</span>
          <span
            v-if="secondaryLabel"
            class="block truncate text-[10px] font-medium opacity-75"
          >
            {{ secondaryLabel }}
          </span>
        </span>

        <UIcon
          v-if="!showImportCta"
          name="i-heroicons-chevron-down-20-solid"
          class="h-3.5 w-3.5 shrink-0 opacity-60"
        />
      </button>
    </UDropdownMenu>

    <button
      v-if="showImportCta"
      type="button"
      data-testid="gdrive-sync-import-cta"
      class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-bold leading-none text-white shadow-[0_2px_0_0_color-mix(in_srgb,var(--ui-primary)_85%,black)] ring-1 ring-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
      :disabled="isStartingImport"
      :title="importCtaLabel"
      @click="startImport"
    >
      <UIcon
        :name="
          isStartingImport
            ? 'i-heroicons-arrow-path'
            : 'i-heroicons-arrow-down-tray'
        "
        class="h-3 w-3"
        :class="{ 'animate-spin': isStartingImport }"
      />
      <span class="whitespace-nowrap">{{ compactImportCtaLabel }}</span>
    </button>

    <button
      v-if="showImportCta"
      type="button"
      class="mr-2 inline-flex shrink-0 items-center rounded-r-full py-1 pl-0.5 pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      aria-label="Google Drive メニューを開く"
      @click="menuOpen = true"
    >
      <UIcon
        name="i-heroicons-chevron-down-20-solid"
        class="h-3.5 w-3.5 opacity-60"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useGoogleDriveSyncStore } from "@stores/googleDriveSync";
import { useGoogleDriveGlobalSync } from "@composables/useGoogleDriveGlobalSync";

const driveStore = useGoogleDriveSyncStore();
const { driveHeaderSummary: summary, driveHeaderChipState: chipState } =
  storeToRefs(driveStore);
const { triggerDriveImport } = useGoogleDriveGlobalSync();
const router = useRouter();
const menuOpen = ref(false);
const isStartingImport = ref(false);

const showImportCta = computed(
  () =>
    summary.value.canStartImport &&
    (chipState.value === "idle" || chipState.value === "error")
);

const importCtaLabel = computed(() => {
  const s = summary.value;
  if (s.pendingAdded > 0 && s.pendingUpdated > 0) {
    return `新規 ${s.pendingAdded} · 更新 ${s.pendingUpdated} 件取り込み`;
  }
  if (s.pendingAdded > 0) {
    return `新規 ${s.pendingAdded} 件取り込み`;
  }
  if (s.pendingUpdated > 0) {
    return `更新 ${s.pendingUpdated} 件取り込み`;
  }
  return "取り込み開始";
});

const compactImportCtaLabel = computed(() => {
  const s = summary.value;
  if (s.pendingAdded > 0 && s.pendingUpdated > 0) {
    return `新規${s.pendingAdded}·更新${s.pendingUpdated}件`;
  }
  if (s.pendingAdded > 0) {
    return `新規${s.pendingAdded}件取込`;
  }
  if (s.pendingUpdated > 0) {
    return `更新${s.pendingUpdated}件取込`;
  }
  return "取込";
});

const chipToneClass = computed(() => {
  switch (chipState.value) {
    case "unconfigured":
      return "bg-slate-800/90 text-slate-200 ring-slate-600 hover:bg-slate-800";
    case "scanning":
      return "bg-sky-950/60 text-sky-100 ring-sky-600/50";
    case "running":
      return "bg-sky-950/70 text-sky-50 ring-sky-500/50 indicator-running";
    case "error":
      return "bg-rose-950/60 text-rose-50 ring-rose-500/50";
    case "completedFlash":
      return "bg-emerald-950/60 text-emerald-50 ring-emerald-500/50";
    default:
      return "bg-white/95 text-slate-800 ring-slate-200 hover:shadow-md";
  }
});

const primaryLabel = computed(() => {
  if (chipState.value === "unconfigured") return "Google Drive";
  if (chipState.value === "scanning") return "Google Drive";
  if (chipState.value === "running") return "Google Drive 取り込み中";
  if (chipState.value === "error") return "Google Drive";
  if (chipState.value === "completedFlash") return "Google Drive";
  return "Google Drive";
});

const secondaryLabel = computed(() => {
  const s = summary.value;
  switch (chipState.value) {
    case "unconfigured":
      return "未設定 · クリックで設定";
    case "scanning":
      return "ファイルを確認中…";
    case "running":
      return `${s.phaseLabel ?? "処理中"} · ${s.progressPercent}%`;
    case "error":
      return "取り込み失敗 · 詳細を見る";
    case "completedFlash":
      return "取り込み完了";
    default:
      if (showImportCta.value) {
        return null;
      }
      if (s.pendingAdded > 0 || s.pendingUpdated > 0) {
        return s.chipLabel;
      }
      if (s.lastSyncedAtMs) {
        return `同期済み · ${formatRelative(s.lastSyncedAtMs)}`;
      }
      return s.chipLabel === "Drive 同期" ? "新規ファイルなし" : s.chipLabel;
  }
});

const showStatusOverlay = computed(
  () =>
    chipState.value === "scanning" ||
    chipState.value === "running" ||
    chipState.value === "error" ||
    chipState.value === "completedFlash"
);

const statusOverlayClass = computed(() => {
  switch (chipState.value) {
    case "running":
    case "scanning":
      return "bg-sky-500 text-white";
    case "error":
      return "bg-rose-500 text-white";
    case "completedFlash":
      return "bg-emerald-500 text-white";
    default:
      return "bg-slate-400 text-white";
  }
});

const statusOverlayIcon = computed(() => {
  switch (chipState.value) {
    case "running":
    case "scanning":
      return "i-heroicons-arrow-path";
    case "error":
      return "i-heroicons-x-mark";
    case "completedFlash":
      return "i-heroicons-check";
    default:
      return "i-heroicons-minus";
  }
});

const chipTitle = computed(() => {
  if (chipState.value === "unconfigured") {
    return "Google Drive 連携が未設定です — クリックで設定";
  }
  if (chipState.value === "running") {
    return "Google Drive 取り込み実行中 — クリックで進捗を表示";
  }
  if (showImportCta.value) {
    return importCtaLabel.value;
  }
  return summary.value.folderName ?? "Google Drive 同期";
});

const statusDetail = computed(() => {
  const s = summary.value;
  if (chipState.value === "running" && s.phaseLabel) {
    return `${s.phaseLabel} · ${s.progressPercent}%`;
  }
  if (chipState.value === "idle" || chipState.value === "completedFlash") {
    const parts: string[] = [];
    if (s.pendingAdded > 0) parts.push(`新規 ${s.pendingAdded}`);
    if (s.pendingUpdated > 0) parts.push(`更新 ${s.pendingUpdated}`);
    if (s.pendingRemoved > 0) parts.push(`削除 ${s.pendingRemoved}`);
    if (parts.length > 0) return parts.join(" · ");
    if (s.lastSyncedAtMs) {
      return `最終同期 ${formatRelative(s.lastSyncedAtMs)}`;
    }
    return "新規ファイルはありません";
  }
  if (chipState.value === "error") {
    return "詳細を確認してください";
  }
  if (chipState.value === "scanning") {
    return "Drive と素材プールを照合中";
  }
  return s.folderName ?? "Google Drive";
});

const menuItems = computed(() => {
  const s = summary.value;
  const statusRows = [
    {
      label: s.folderName ?? "Google Drive",
      disabled: true as const,
    },
    {
      label: statusDetail.value,
      disabled: true as const,
    },
  ];

  const actions: Array<{
    label: string;
    icon?: string;
    onSelect?: () => void;
  }> = [];

  if (chipState.value === "unconfigured") {
    actions.push({
      label: "Drive 設定を開く",
      icon: "logos:google-drive",
      onSelect: goToDriveSettings,
    });
  } else {
    if (s.canStartImport) {
      actions.push({
        label: "取り込み開始",
        icon: "i-heroicons-arrow-down-tray",
        onSelect: startImport,
      });
    }
    if (s.canOpenProgress) {
      actions.push({
        label: "進捗を見る",
        icon: "i-heroicons-chart-bar",
        onSelect: openProgressModal,
      });
    }
    actions.push({
      label: "Drive 設定",
      icon: "i-heroicons-cog-6-tooth",
      onSelect: goToDriveSettings,
    });
  }

  return [statusRows, actions];
});

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min} 分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 時間前`;
  const day = Math.floor(hr / 24);
  return `${day} 日前`;
}

function goToDriveSettings(): void {
  menuOpen.value = false;
  void router.push({ name: "admin-data-source" });
}

function openProgressModal(): void {
  menuOpen.value = false;
  driveStore.openImportProgressModal();
}

async function startImport(): Promise<void> {
  if (isStartingImport.value) return;
  menuOpen.value = false;
  isStartingImport.value = true;
  try {
    await triggerDriveImport();
  } finally {
    isStartingImport.value = false;
  }
}

function onChipClick(event: MouseEvent): void {
  if (chipState.value === "unconfigured") {
    event.preventDefault();
    goToDriveSettings();
    return;
  }
  if (
    chipState.value === "running" ||
    chipState.value === "error" ||
    chipState.value === "completedFlash"
  ) {
    event.preventDefault();
    openProgressModal();
  }
}
</script>

<style scoped>
.indicator-running {
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25),
    0 4px 14px -4px rgba(14, 165, 233, 0.35);
}
</style>
