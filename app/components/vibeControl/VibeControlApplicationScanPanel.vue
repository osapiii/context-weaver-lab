<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4">
    <VibeControlApplicationScanProgressModal
      v-model:open="progressModalOpen"
      :application="selectedApplication"
      :run="lastScan"
      @open-job-log="$emit('openJobLog')"
    />

    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Application Scan
        </p>
        <h2 class="mt-1 truncate text-base font-semibold text-slate-900">
          {{ selectedApplication?.name ?? "Application" }}
        </h2>
        <p class="mt-1 text-xs text-slate-500">
          Scan結果をアプリのSSOTとして保存します
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <EnBadge
          v-if="lastScan"
          :color="statusBadge.color"
          variant="soft"
        >
          {{ statusBadge.label }}
        </EnBadge>
        <EnBadge
          v-if="selectedApplication?.applicationKey"
          variant="tag"
        >
          {{ selectedApplication.applicationKey }}
        </EnBadge>
        <EnButton
          v-if="lastScan"
          variant="outline"
          color="neutral"
          size="xs"
          leading-icon="material-symbols:radar"
          @click="progressModalOpen = true"
        >
          進捗
        </EnButton>
      </div>
    </div>

    <div class="mt-4 grid gap-3 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_10rem_8rem]">
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Application</span>
        <select
          :value="selectedApplicationId"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          @change="$emit('selectApplication', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="application in applications"
            :key="application.id"
            :value="application.id"
          >
            {{ application.name }}
          </option>
        </select>
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Start URL</span>
        <input
          v-model="draft.startUrl"
          type="url"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="https://example.com/"
        >
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">FileSpace</span>
        <input
          v-model="draft.fileSpaceId"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="w-default"
        >
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Max pages</span>
        <input
          v-model.number="draft.maxPages"
          type="number"
          min="1"
          max="50"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        >
      </label>
    </div>

    <div class="mt-3 grid gap-3 lg:grid-cols-3">
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Login URL</span>
        <input
          v-model="draft.loginUrl"
          type="url"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="未指定"
        >
      </label>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Username</span>
        <input
          v-model="draft.username"
          type="text"
          autocomplete="username"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="未指定"
        >
      </label>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Password</span>
        <input
          v-model="draft.password"
          type="password"
          autocomplete="current-password"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="未指定"
        >
      </label>
    </div>

    <div class="mt-3 grid gap-3 lg:grid-cols-3">
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Username selector</span>
        <input
          v-model="draft.usernameSelector"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="input[name=email]"
        >
      </label>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Password selector</span>
        <input
          v-model="draft.passwordSelector"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="input[type=password]"
        >
      </label>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Submit selector</span>
        <input
          v-model="draft.submitSelector"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="button[type=submit]"
        >
      </label>
    </div>

    <div class="mt-3 grid gap-3 lg:grid-cols-2">
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Include patterns</span>
        <textarea
          v-model="includePatternsText"
          rows="2"
          class="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="1行に1パターン"
        />
      </label>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Exclude patterns</span>
        <textarea
          v-model="excludePatternsText"
          rows="2"
          class="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="1行に1パターン"
        />
      </label>
    </div>

    <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
      <div class="min-w-0 text-xs text-slate-500">
        <p
          v-if="lastScan?.requestId"
          class="truncate"
        >
          {{ lastScan.requestId }}
        </p>
        <p
          v-else-if="selectedApplication?.repoFullName"
          class="truncate"
        >
          {{ selectedApplication.repoFullName }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input
            v-model="draft.captureScreenshots"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          >
          Screenshot
        </label>
        <EnButton
          variant="ai"
          size="sm"
          leading-icon="material-symbols:photo-camera-outline"
          :disabled="!canStart"
          :loading="isStartingScan"
          @click="emitStart"
        >
          Scan開始
        </EnButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type {
  DecodedVibeControlApplication,
  VibeControlApplicationScanRun,
} from "@models/vibeControl";
import type { RequestStatus } from "@models/core/requestStatus";
import {
  emptyApplicationScanFields,
  type ApplicationScanFields,
} from "@utils/applicationScanWorkspaceState";

const props = defineProps<{
  applications: DecodedVibeControlApplication[];
  selectedApplicationId: string;
  isStartingScan: boolean;
}>();

const emit = defineEmits<{
  selectApplication: [applicationId: string];
  startScan: [fields: ApplicationScanFields];
  openJobLog: [];
}>();

const draft = reactive<ApplicationScanFields>(emptyApplicationScanFields());
const includePatternsText = ref("");
const excludePatternsText = ref("");
const progressModalOpen = ref(false);
const lastOpenedSessionId = ref("");

const selectedApplication = computed<DecodedVibeControlApplication | null>(
  () =>
    props.applications.find(
      (application) => application.id === props.selectedApplicationId
    ) ??
    props.applications[0] ??
    null
);

const lastScan = computed<VibeControlApplicationScanRun | null>(
  () => selectedApplication.value?.lastScan ?? null
);

const statusLabels: Record<RequestStatus, string> = {
  pending: "待機中",
  processing: "実行中",
  completed: "完了",
  error: "失敗",
};

const statusColors = {
  pending: "warning",
  processing: "info",
  completed: "success",
  error: "error",
} as const;

const statusBadge = computed(() => {
  const status = lastScan.value?.status ?? "pending";
  return {
    label: statusLabels[status],
    color: statusColors[status],
  };
});

const canStart = computed(
  () => Boolean(selectedApplication.value) && draft.startUrl.trim().length > 0
);

watch(
  selectedApplication,
  (application) => {
    draft.startUrl =
      application?.startUrl || application?.lastScan?.startUrl || "";
    draft.fileSpaceId =
      application?.fileSpaceId || application?.lastScan?.fileSpaceId || "";
    draft.maxPages = application?.lastScan?.maxPages ?? 12;
    draft.captureScreenshots = application?.lastScan?.captureScreenshots ?? true;
    draft.loginUrl = "";
    draft.username = "";
    draft.password = "";
    draft.usernameSelector = "";
    draft.passwordSelector = "";
    draft.submitSelector = "";
    draft.includePatterns = [];
    draft.excludePatterns = [];
    includePatternsText.value = "";
    excludePatternsText.value = "";
  },
  { immediate: true }
);

watch(
  () => lastScan.value?.sessionId,
  (sessionId) => {
    if (!sessionId || sessionId === lastOpenedSessionId.value) return;
    lastOpenedSessionId.value = sessionId;
    progressModalOpen.value = true;
  }
);

watch(
  () => lastScan.value?.status,
  (status) => {
    if (status === "pending" || status === "processing") {
      progressModalOpen.value = true;
    }
  }
);

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function emitStart(): void {
  emit("startScan", {
    ...draft,
    includePatterns: linesToList(includePatternsText.value),
    excludePatterns: linesToList(excludePatternsText.value),
  });
}
</script>
