<template>
  <div v-if="selectedApplication" class="relative">
    <button
      type="button"
      class="inline-flex h-9 max-w-[min(260px,100%)] items-center gap-2 rounded-full px-2.5 text-left text-xs font-semibold shadow-sm ring-1 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2"
      :class="chipClass"
      :title="chipTitle"
      @click="modalOpen = true"
    >
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/5"
        aria-hidden="true"
      >
        <UIcon :name="chipIcon" class="h-4 w-4" />
      </span>
      <span class="min-w-0 truncate leading-tight">
        <span class="block truncate">E2Eログイン</span>
        <span class="block truncate text-[10px] font-medium opacity-80">
          {{ chipSubLabel }}
        </span>
      </span>
    </button>

    <EnModal
      v-model:open="modalOpen"
      title="E2E認証セッション"
      subtitle="管理ブラウザでログインし、選択中アプリの認証状態をSecret Managerに保存します。"
      title-icon="material-symbols:verified-user-outline"
      size="lg"
    >
      <div class="space-y-4">
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm font-bold text-slate-950">
            {{ selectedApplication.name }}
          </p>
          <p class="mt-1 break-all text-xs leading-relaxed text-slate-600">
            {{ entryUrl || "Entry URL が未設定です" }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <EnButton
              variant="ai"
              size="xs"
              leading-icon="material-symbols:open-in-browser-outline"
              :disabled="!entryUrl"
              :loading="isLoading"
              @click="openManagedBrowser"
            >
              管理ブラウザでログイン
            </EnButton>
            <EnButton
              variant="outline"
              color="neutral"
              size="xs"
              leading-icon="material-symbols:open-in-new"
              :disabled="!entryUrl"
              @click="openEntryUrl"
            >
              通常ブラウザで開く
            </EnButton>
            <EnButton
              variant="ghost"
              color="neutral"
              size="xs"
              leading-icon="material-symbols:refresh"
              :loading="isLoading"
              @click="refresh"
            >
              状態を確認
            </EnButton>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-[11px] font-bold text-slate-400">保存状態</p>
            <p class="mt-1 text-sm font-bold text-slate-900">
              {{ currentStatus.configured ? "設定済み" : "未設定" }}
            </p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-[11px] font-bold text-slate-400">Cookie</p>
            <p class="mt-1 text-sm font-bold text-slate-900">
              {{ currentStatus.cookieCount ?? 0 }}
            </p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-[11px] font-bold text-slate-400">更新日時</p>
            <p class="mt-1 truncate text-sm font-bold text-slate-900">
              {{ formatUpdatedAt(currentStatus.updatedAt) }}
            </p>
          </div>
        </div>

        <label class="block">
          <span class="text-xs font-bold text-slate-600">
            storageState.json（予備の手動保存）
          </span>
          <textarea
            v-model="storageStateDraft"
            class="mt-2 min-h-56 w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed text-slate-800 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            spellcheck="false"
            placeholder='{"cookies":[],"origins":[]}'
          />
        </label>

        <EnAlert
          color="warning"
          title="ここに保存したセッションはログイン済みCookieを含みます"
          description="Secret Managerに保存し、画面には再表示しません。共有アカウントや本番権限の強いユーザーではなく、E2E専用ユーザーの利用を推奨します。"
        />
      </div>

      <template #footer>
        <EnButton
          v-if="currentStatus.configured"
          variant="soft"
          color="error"
          size="sm"
          leading-icon="material-symbols:delete-outline"
          :loading="isLoading"
          @click="deleteSession"
        >
          削除
        </EnButton>
        <EnButton
          variant="ghost"
          color="neutral"
          size="sm"
          @click="modalOpen = false"
        >
          閉じる
        </EnButton>
        <EnButton
          variant="ai"
          size="sm"
          leading-icon="material-symbols:lock-outline"
          :disabled="!canSave"
          :loading="isLoading"
          @click="saveSession"
        >
          Secret Managerに保存
        </EnButton>
      </template>
    </EnModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { DecodedVibeControlApplication } from "@models/vibeControl";

const props = defineProps<{
  selectedApplication: DecodedVibeControlApplication | null;
}>();

const organizationStore = useOrganizationStore();
const toast = useToast();
const {
  statusByApplicationId,
  loadingByApplicationId,
  refreshStatus,
  saveState,
  deleteState,
  createBrowserSession,
} = useE2EAuthSession();

const modalOpen = ref(false);
const storageStateDraft = ref("");

const organizationId = computed(
  () => organizationStore.loggedInOrganizationInfo?.id || ""
);
const applicationId = computed(() => props.selectedApplication?.id || "");
const entryUrl = computed(() => props.selectedApplication?.startUrl || "");
const currentStatus = computed(
  () => statusByApplicationId.value[applicationId.value] ?? { configured: false }
);
const isLoading = computed(
  () => Boolean(loadingByApplicationId.value[applicationId.value])
);
const canSave = computed(() => {
  if (!organizationId.value || !applicationId.value) return false;
  try {
    const parsed = JSON.parse(storageStateDraft.value);
    return (
      Boolean(parsed) &&
      typeof parsed === "object" &&
      (Array.isArray(parsed.cookies) || Array.isArray(parsed.origins))
    );
  } catch {
    return false;
  }
});

const chipClass = computed(() => {
  if (isLoading.value) {
    return "bg-slate-900 text-white ring-slate-500/40 focus-visible:ring-slate-300";
  }
  if (currentStatus.value.configured) {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200 focus-visible:ring-emerald-300";
  }
  return "bg-amber-50 text-amber-800 ring-amber-200 focus-visible:ring-amber-300";
});
const chipIcon = computed(() => {
  if (isLoading.value) return "material-symbols:progress-activity";
  if (currentStatus.value.configured) return "material-symbols:verified-user-outline";
  return "material-symbols:key-off-outline";
});
const chipSubLabel = computed(() => {
  if (isLoading.value) return "確認中";
  if (currentStatus.value.configured) return "設定済み";
  return "未設定";
});
const chipTitle = computed(() =>
  currentStatus.value.configured
    ? "E2E認証セッションはSecret Managerに保存されています"
    : "E2E認証セッションが未設定です"
);

const request = () => ({
  organizationId: organizationId.value,
  applicationId: applicationId.value,
});

const refresh = async (): Promise<void> => {
  if (!organizationId.value || !applicationId.value) return;
  try {
    await refreshStatus(request());
  } catch {
    // E2E login is optional. Missing backend/env configuration should not
    // interrupt the normal app experience.
  }
};

const saveSession = async (): Promise<void> => {
  if (!canSave.value) return;
  try {
    await saveState({ ...request(), storageStateJson: storageStateDraft.value });
    storageStateDraft.value = "";
    toast.add({
      title: "E2E認証セッションを保存しました",
      description: "Secret Managerに新しいstate.jsonを保存しました",
      color: "success",
    });
  } catch (error) {
    toast.add({
      title: "E2E認証セッションの保存に失敗しました",
      description: error instanceof Error ? error.message : String(error),
      color: "error",
    });
  }
};

const openManagedBrowser = async (): Promise<void> => {
  if (!organizationId.value || !applicationId.value || !entryUrl.value) return;
  try {
    const result = await createBrowserSession({
      ...request(),
      entryUrl: entryUrl.value,
    });
    window.open(result.url, "_blank", "noopener,noreferrer");
    toast.add({
      title: "管理ブラウザを開きました",
      description: "ログイン後、開いた画面で「ログイン状態を保存」を押してください",
      color: "success",
    });
  } catch (error) {
    toast.add({
      title: "管理ブラウザを起動できませんでした",
      description: error instanceof Error ? error.message : String(error),
      color: "error",
    });
  }
};

const deleteSession = async (): Promise<void> => {
  try {
    await deleteState(request());
    storageStateDraft.value = "";
    toast.add({
      title: "E2E認証セッションを削除しました",
      color: "success",
    });
  } catch (error) {
    toast.add({
      title: "E2E認証セッションの削除に失敗しました",
      description: error instanceof Error ? error.message : String(error),
      color: "error",
    });
  }
};

const openEntryUrl = (): void => {
  if (!entryUrl.value) return;
  window.open(entryUrl.value, "_blank", "noopener,noreferrer");
};

function formatUpdatedAt(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(refresh);
watch([organizationId, applicationId], refresh);
</script>
