<template>
  <EnModal
    v-model:open="open"
    size="2xl"
    header-variant="brand"
    title="Drive 同期の進捗"
    subtitle="各同期リクエスト (RequestDoc = Workflow execution) の状態をリアルタイム表示します"
    :close-on-backdrop="!hasActivePipeline"
  >
    <div class="space-y-4">
      <EnAlert
        v-if="listError"
        color="error"
        title="履歴の取得に失敗しました"
        :description="listError"
      />

      <div
        v-else-if="isLoading && requests.length === 0"
        class="flex flex-col items-center justify-center py-12 text-gray-500"
      >
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-8 h-8 animate-spin text-purple-500 mb-3"
        />
        <p class="text-sm">同期リクエストを読み込み中…</p>
      </div>

      <div
        v-else-if="requests.length === 0"
        class="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-500"
      >
        まだ同期リクエストがありません。「今すぐ同期」で開始されます。
      </div>

      <ul v-else class="space-y-3 max-h-[min(60vh,520px)] overflow-y-auto pr-1">
        <li
          v-for="req in requests"
          :key="req.id"
          class="rounded-xl ring-1 px-4 py-3 transition-colors"
          :class="
            req.id === highlightedRequestId
              ? 'bg-purple-50/80 ring-purple-300'
              : 'bg-white ring-gray-200 dark:bg-gray-900/40 dark:ring-white/10'
          "
        >
          <div class="flex flex-wrap items-start gap-2 gap-y-1">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ requestTitle(req) }}
              </p>
              <p class="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                {{ req.id }}
              </p>
            </div>
            <EnBadge
              :color="statusOf(req).badgeColor"
              :variant="statusOf(req).badgeVariant"
              size="xs"
            >
              {{ statusOf(req).label }}
            </EnBadge>
          </div>

          <div class="mt-3">
            <div class="flex items-center justify-between text-[11px] text-gray-500 mb-1">
              <span>{{ stepLabel(req) }}</span>
              <span class="tabular-nums">{{ progressPercent(req) }}%</span>
            </div>
            <UProgress
              :model-value="progressPercent(req)"
              :max="100"
              size="sm"
              :color="req.status === 'error' ? 'error' : 'primary'"
            />
          </div>

          <div
            v-if="outputSummary(req)"
            class="mt-2 flex flex-wrap gap-2 text-[10px]"
          >
            <EnBadge
              variant="soft"
              color="success"
              size="xs"
              custom-class="tabular-nums"
            >
              {{ outputSummary(req) }}
            </EnBadge>
          </div>

          <p
            v-if="req.status === 'error' && req.errorMessage"
            class="mt-2 text-[11px] text-rose-600 leading-relaxed break-words"
          >
            {{ req.errorMessage }}
          </p>

          <a
            v-if="req.workflow?.consoleUrl"
            :href="req.workflow.consoleUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-2 inline-flex items-center gap-1 text-[10px] text-sky-700 hover:text-sky-900 underline"
          >
            <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3 w-3" />
            Workflow Console を開く
          </a>

          <p class="mt-2 text-[10px] text-gray-400">
            開始 {{ formatDocTime(req.createdAt) }}
            <span v-if="req.updatedAt"> · 更新 {{ formatDocTime(req.updatedAt) }}</span>
          </p>
        </li>
      </ul>

      <p class="text-[10px] text-gray-400 leading-relaxed">
        各 RequestDoc は GCP Workflows の 1 execution に対応します。詳細は
        Workflow Console から step 単位で確認できます。
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <EnButton variant="outline" color="neutral" @click="open = false">
          閉じる
        </EnButton>
      </div>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import type { Timestamp } from "firebase/firestore";
import EnModal from "@components/EnModal.vue";
import EnButton from "@components/EnButton.vue";
import EnBadge from "@components/EnBadge.vue";
import EnAlert from "@components/EnAlert.vue";
import { useGoogleDriveSyncRequestList } from "@composables/useGoogleDriveSyncRequestList";
import { useGoogleDriveSyncStore } from "@stores/googleDriveSync";
import type { DecodedGoogleDriveSyncRequest } from "@models/googleDriveSyncRequest";
import {
  formatDriveSyncOutputSummary,
  getDriveSyncProgressPercent,
  getDriveSyncStatusPresentation,
  getDriveSyncStepLabel,
} from "@utils/googleDriveSyncProgress";
import { isGoogleDriveSyncPipelineActive } from "@utils/googleDriveSyncTerminal";

const open = defineModel<boolean>("open", { default: false });

const driveStore = useGoogleDriveSyncStore();
const { requests, isLoading, error: listError, subscribe, unsubscribe } =
  useGoogleDriveSyncRequestList(20);

const highlightedRequestId = computed(
  () => driveStore.activeSyncRequestId
);

const hasActivePipeline = computed(() =>
  requests.value.some((r) => isGoogleDriveSyncPipelineActive(r))
);

watch(open, (isOpen) => {
  if (isOpen) {
    subscribe();
    return;
  }
  unsubscribe();
});

const requestTitle = (req: DecodedGoogleDriveSyncRequest): string => {
  const desc = req.input?.description?.trim();
  if (desc) return desc;
  return req.input?.operationType === "syncSingleFolder"
    ? "サブフォルダ同期"
    : "フォルダ一括同期";
};

const statusOf = (req: DecodedGoogleDriveSyncRequest) =>
  getDriveSyncStatusPresentation(req);

const stepLabel = (req: DecodedGoogleDriveSyncRequest) =>
  getDriveSyncStepLabel(req.progress?.currentStep ?? null);

const progressPercent = (req: DecodedGoogleDriveSyncRequest) =>
  getDriveSyncProgressPercent(req);

const outputSummary = (req: DecodedGoogleDriveSyncRequest): string | null => {
  const summary = formatDriveSyncOutputSummary(req);
  return summary === "変更なし" ? null : summary;
};

const formatDocTime = (ts: Timestamp | undefined): string => {
  if (!ts?.toMillis) return "—";
  const d = new Date(ts.toMillis());
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
</script>
