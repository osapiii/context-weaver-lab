<template>
  <EnModal
    v-if="variant === 'modal'"
    v-model:open="isOpen"
    title="Application Scan設定"
    subtitle="URLやログイン情報を確認してから再スキャンします"
    title-icon="material-symbols:radar"
    size="3xl"
    padding="lg"
    :close-on-backdrop="!isStartingScan"
  >
    <VibeControlApplicationScanSettingsFields
      v-model:include-patterns-text="includePatternsText"
      v-model:exclude-patterns-text="excludePatternsText"
      :applications="applications"
      :scan-profiles="scanProfiles"
      :selected-application-id="selectedApplicationId"
      :draft="draft"
      hide-application-select
      @patch-draft="patchDraft"
      @select-application="emit('selectApplication', $event)"
    />
    <label class="mt-4 flex items-center gap-2 text-sm text-slate-700">
      <input
        v-model="draft.captureScreenshots"
        type="checkbox"
        class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
      >
      Screenshot
    </label>

    <template #footer>
      <EnButton
        variant="ghost"
        color="neutral"
        size="sm"
        :disabled="isStartingScan"
        @click="isOpen = false"
      >
        キャンセル
      </EnButton>
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
    </template>
  </EnModal>

  <section
    v-else
    class="rounded-lg border border-slate-200 bg-white p-4"
  >
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

    <VibeControlApplicationScanSettingsFields
      v-model:include-patterns-text="includePatternsText"
      v-model:exclude-patterns-text="excludePatternsText"
      class="mt-4"
      :applications="applications"
      :scan-profiles="scanProfiles"
      :selected-application-id="selectedApplicationId"
      :draft="draft"
      @patch-draft="patchDraft"
      @select-application="emit('selectApplication', $event)"
    />

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
  DecodedVibeControlApplicationScanProfile,
  VibeControlScanAuthMode,
  VibeControlApplicationScanRun,
} from "@models/vibeControl";
import type { RequestStatus } from "@models/core/requestStatus";
import {
  applicationScanFieldsComplete,
  emptyApplicationScanFields,
  type ApplicationScanFields,
} from "@utils/applicationScanWorkspaceState";

const props = defineProps<{
  open?: boolean;
  variant?: "inline" | "modal";
  applications: DecodedVibeControlApplication[];
  scanProfiles?: DecodedVibeControlApplicationScanProfile[];
  selectedApplicationId: string;
  isStartingScan: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  selectApplication: [applicationId: string];
  startScan: [fields: ApplicationScanFields];
  openJobLog: [];
}>();

const isOpen = computed({
  get: () => props.open ?? false,
  set: (value) => emit("update:open", value),
});

const variant = computed(() => props.variant ?? "inline");

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

const activeScanProfiles = computed(() =>
  (props.scanProfiles ?? []).filter(
    (profile) => profile.applicationId === selectedApplication.value?.id
  )
);

const selectedScanProfile = computed(
  () =>
    activeScanProfiles.value.find((profile) => profile.id === draft.scanProfileId) ??
    activeScanProfiles.value[0] ??
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

const canStart = computed(() => {
  if (!selectedApplication.value) return false;
  if (applicationScanFieldsComplete(draft)) return true;
  return (
    draft.authMode === "assisted_session" &&
    draft.startUrl.trim().length > 0 &&
    Boolean(selectedScanProfile.value?.assistedSessionConfigured) &&
    draft.assistedStorageStateJson.trim().length === 0
  );
});

watch(
  selectedApplication,
  (application) => {
    const profile = selectedScanProfile.value;
    if (profile) {
      applyScanProfile(profile);
      return;
    }
    draft.startUrl =
      application?.startUrl || application?.lastScan?.startUrl || "";
    draft.scanProfileId = "";
    draft.scanProfileName = "Default";
    draft.fileSpaceId =
      application?.fileSpaceId || application?.lastScan?.fileSpaceId || "";
    draft.maxPages = application?.lastScan?.maxPages ?? 12;
    draft.captureScreenshots = application?.lastScan?.captureScreenshots ?? true;
    draft.exploreVariants = application?.lastScan?.exploreVariants ?? false;
    draft.maxVariantsPerScreen =
      application?.lastScan?.maxVariantsPerScreen ?? 5;
    draft.maxStepsPerScreen = application?.lastScan?.maxStepsPerScreen ?? 12;
    draft.allowChatSend = false;
    draft.authMode = "none";
    draft.loginUrl = "";
    draft.username = "";
    draft.password = "";
    draft.authenticatedUrl = "";
    draft.emailLinkEmail = "";
    draft.assistedStorageStateJson = "";
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
  () => props.scanProfiles,
  () => {
    const profile = selectedScanProfile.value;
    if (profile) applyScanProfile(profile);
  },
  { deep: true }
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

function patchDraft(patch: Partial<ApplicationScanFields>): void {
  Object.assign(draft, patch);
  if (patch.scanProfileId !== undefined) {
    const profile = activeScanProfiles.value.find(
      (item) => item.id === patch.scanProfileId
    );
    if (profile) applyScanProfile(profile);
  }
}

function applyScanProfile(profile: DecodedVibeControlApplicationScanProfile): void {
  const authMode = resolveScanProfileAuthMode(profile);
  draft.scanProfileId = profile.id;
  draft.scanProfileName = profile.name;
  draft.authMode = authMode;
  draft.startUrl = authMode === "email_link_manual" ? "" : profile.entryUrl;
  draft.loginUrl = profile.loginUrl ?? "";
  draft.username = profile.username ?? "";
  draft.password = "";
  draft.authenticatedUrl = "";
  draft.emailLinkEmail = "";
  draft.assistedStorageStateJson = "";
  draft.usernameSelector = profile.usernameSelector ?? "";
  draft.passwordSelector = profile.passwordSelector ?? "";
  draft.submitSelector = profile.submitSelector ?? "";
  draft.includePatterns = [...profile.includePatterns];
  draft.excludePatterns = [...profile.excludePatterns];
  draft.maxPages = profile.maxPages;
  draft.captureScreenshots = true;
  draft.exploreVariants = profile.defaultExploreVariants;
  draft.maxVariantsPerScreen = profile.maxVariantsPerScreen;
  draft.maxStepsPerScreen = profile.maxStepsPerScreen;
  draft.allowChatSend = false;
  includePatternsText.value = profile.includePatterns.join("\n");
  excludePatternsText.value = profile.excludePatterns.join("\n");
}

function resolveScanProfileAuthMode(
  profile: DecodedVibeControlApplicationScanProfile
): VibeControlScanAuthMode {
  if (profile.authMode !== "none") return profile.authMode;
  if (profile.loginUrl || profile.username || profile.passwordConfigured) {
    return "credentials";
  }
  if (profile.assistedSessionConfigured) {
    return "assisted_session";
  }
  return "none";
}

function emitStart(): void {
  emit("startScan", {
    ...draft,
    includePatterns: linesToList(includePatternsText.value),
    excludePatterns: linesToList(excludePatternsText.value),
  });
}
</script>
