<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- 設定済み: 状態 → 主 CTA → 補助操作 -->
    <div
      v-if="isConfigured && !showEditor"
      class="flex flex-1 flex-col gap-3"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {{ config?.rootFolderName || "Drive フォルダ" }}
          </p>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <EnBadge
              color="success"
              variant="soft"
              size="xs"
              leading-icon="i-heroicons-check-circle"
            >
              Drive 連携済み
            </EnBadge>
            <span
              v-if="config?.lastSyncedAt && config?.lastSyncStatus !== 'error'"
              class="text-[11px] text-gray-500"
            >
              最終同期 {{ relativeTime(config.lastSyncedAt) }}
            </span>
          </div>
        </div>
        <EnButton
          variant="ghost"
          color="neutral"
          size="xs"
          leading-icon="i-heroicons-cog-6-tooth"
          custom-class="shrink-0"
          @click="enterEditor"
        >
          設定
        </EnButton>
      </div>

      <EnAlert
        v-if="config?.lastSyncStatus === 'error'"
        color="error"
        title="取り込みエラー"
        :description="truncateSyncError(config.lastSyncError ?? '同期に失敗しました')"
      >
        <template #actions>
          <EnButton
            variant="outline"
            color="neutral"
            size="xs"
            @click="driveStore.openImportProgressModal()"
          >
            詳細を見る
          </EnButton>
        </template>
      </EnAlert>

      <div
        class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-700 ring-1 ring-gray-900/[0.04] dark:bg-gray-800/60 dark:text-gray-300 dark:ring-white/10"
        role="status"
      >
        <UIcon
          :name="statusIcon"
          class="h-4 w-4 shrink-0"
          :class="[
            statusIconSpin ? 'animate-spin text-purple-600' : '',
            statusIconTone,
          ]"
        />
        <span class="min-w-0 flex-1 leading-snug">{{ statusMessage }}</span>
      </div>

      <div class="flex justify-end">
        <EnButton
          variant="hero"
          color="primary"
          size="sm"
          :disabled="!canStartImport && !isSyncInProgress"
          :loading="isStartingImport"
          leading-icon="i-heroicons-arrow-down-tray"
          :custom-class="
            isSyncInProgress && !isStartingImport
              ? 'shrink-0 [&_svg]:animate-spin'
              : 'shrink-0'
          "
          @click="onImportClick"
        >
          {{
            batchImportProgressLabel || isSyncInProgress
              ? "取り込み中… 進捗を見る"
              : "取り込み"
          }}
        </EnButton>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
        <EnButton
          variant="soft"
          color="neutral"
          size="sm"
          leading-icon="i-heroicons-magnifying-glass"
          :disabled="isPendingScanInProgress"
          @click="onRescanClick"
        >
          再検索
        </EnButton>
        <EnButton
          v-if="config?.rootFolderId"
          variant="soft"
          color="neutral"
          size="sm"
          leading-icon="i-heroicons-folder-open"
          @click="openDriveFolder"
        >
          Drive で開く
        </EnButton>
      </div>

      <details class="group/sync-help text-[11px] text-gray-500">
        <summary
          class="cursor-pointer list-none font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 [&::-webkit-details-marker]:hidden"
        >
          <span class="inline-flex items-center gap-1">
            <UIcon
              name="i-heroicons-information-circle"
              class="h-3.5 w-3.5"
            />
            同期の仕組み
            <UIcon
              name="i-heroicons-chevron-down"
              class="h-3 w-3 transition-transform group-open/sync-help:rotate-180"
            />
          </span>
        </summary>
        <p class="mt-2 leading-relaxed text-gray-500 dark:text-gray-400">
          「取り込み」で Drive の新規・更新を素材プールへ反映します（10件ずつ・最大5並列）。
          Drive から消えたファイルは App からも削除します（App → Drive への反映はしません）。
        </p>
        <button
          v-if="effectiveFileSpaceId"
          type="button"
          class="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-gray-400 hover:text-purple-700 dark:hover:text-purple-400"
          :title="effectiveFileSpaceId"
          @click="copyFileSpaceId"
        >
          <UIcon
            :name="
              copiedFileSpaceId
                ? 'i-heroicons-check'
                : 'i-heroicons-clipboard-document'
            "
            class="h-3 w-3"
          />
          FileSpace ID をコピー
        </button>
      </details>
    </div>

    <!-- 未設定 or 編集モード -->
    <div
      v-else
      class="space-y-4 rounded-xl bg-purple-50/60 p-3 ring-1 ring-purple-200/80 dark:bg-purple-950/20 dark:ring-purple-800/40"
    >
      <p class="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
        Google アカウントでDriveを認証し、取り込み対象のフォルダを1つ指定します。共有フォルダに資料を置くと、ここから一括で AI に教えられます。
      </p>

      <div class="rounded-xl bg-white p-3 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
        <div class="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
          STEP 1 · Google OAuth 認証
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 items-center gap-2">
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-gray-200"
                aria-hidden="true"
              >
                <UIcon name="logos:google-icon" class="h-4 w-4" />
              </span>
              <div class="min-w-0">
                <p class="truncate text-xs font-semibold text-gray-900 dark:text-white">
                  {{ workspaceConnection.connected ? workspaceConnection.email || "Google Workspace" : "未接続" }}
                </p>
                <p class="text-[10px] text-gray-500">
                  {{ workspaceConnection.connected ? "このアカウントのDrive権限で同期します" : "Driveフォルダを読むために接続してください" }}
                </p>
              </div>
            </div>
          </div>
          <EnBadge
            v-if="workspaceConnection.connected"
            color="success"
            variant="soft"
            size="xs"
          >
            接続済み
          </EnBadge>
          <EnButton
            v-else
            variant="hero"
            color="primary"
            size="xs"
            leading-icon="i-simple-icons-google"
            :loading="workspaceOAuthLoading"
            @click="connectGoogleWorkspace"
          >
            Googleで接続
          </EnButton>
          <EnButton
            v-if="workspaceConnection.connected"
            variant="outline"
            color="neutral"
            size="xs"
            :loading="workspaceOAuthLoading"
            @click="connectGoogleWorkspace"
          >
            再接続
          </EnButton>
        </div>
        <EnAlert
          v-if="!workspaceConnection.connected"
          class="mt-3"
          color="warning"
          title="Drive同期にはGoogle認証が必要です"
          description="接続後、あなたが閲覧できるGoogle Driveフォルダを取り込めます。"
        />
      </div>

      <div class="rounded-xl bg-white p-3 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
        <div class="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
          STEP 2 · フォルダ URL / ID
        </div>
        <UInput
          v-model="folderInput"
          size="md"
          class="w-full"
          placeholder="https://drive.google.com/drive/folders/..."
        />
        <p
          v-if="folderInputError"
          class="mt-1.5 text-[10px] text-rose-600"
        >
          {{ folderInputError }}
        </p>
        <p
          v-else-if="extractedFolderId"
          class="mt-1.5 font-mono text-[10px] text-purple-600"
        >
          フォルダ ID: {{ extractedFolderId }}
        </p>
      </div>

      <EnAlert
        v-if="testResult"
        :color="testResult.ok ? 'success' : 'error'"
        :title="testResult.ok ? '接続 OK' : '接続できませんでした'"
        :description="
          testResult.ok
            ? `フォルダ「${testResult.rootFolderName}」を確認しました`
            : testResult.error
        "
      />

      <div class="flex items-center justify-end gap-2">
        <EnButton
          v-if="showEditor"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="cancelEditor"
        >
          キャンセル
        </EnButton>
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          :disabled="!extractedFolderId || isTesting || workspaceOAuthLoading"
          :loading="isTesting"
          @click="onTestConnection"
        >
          動作確認
        </EnButton>
        <EnButton
          variant="hero"
          color="primary"
          size="sm"
          :leading-icon="isSaving ? 'i-heroicons-arrow-path' : 'i-heroicons-check'"
          :disabled="!workspaceConnection.connected || !extractedFolderId || !testResult?.ok || isSaving"
          @click="onSave"
        >
          {{ isConfigured ? "更新" : "連携を有効化" }}
        </EnButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { Timestamp } from "firebase/firestore";
import log from "@utils/logger";
import EnAlert from "@components/EnAlert.vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import {
  useGoogleDriveConfig,
  extractDriveFolderLink,
} from "@composables/useGoogleDriveConfig";
import { useGoogleDriveSyncStore } from "@stores/googleDriveSync";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import { useDefaultFileSpace } from "@composables/useDefaultFileSpace";
import { useGoogleDriveFolderSync } from "@composables/useGoogleDriveFolderSync";
import type { FirestoreDriveDoc } from "@utils/computeDrivePendingDiff";

const props = withDefaults(
  defineProps<{
    fileSpaceId?: string | null;
  }>(),
  {
    fileSpaceId: null,
  }
);

const driveStore = useGoogleDriveSyncStore();
const fileSpaceStore = useGeminiFileSpaceOperatorStore();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
const googleWorkspace = useGoogleWorkspaceOAuth();
const { config, isConfigured, serviceAccountEmail, refresh } =
  useGoogleDriveConfig();
const { fileSpaceId: defaultFileSpaceId } = useDefaultFileSpace();
const {
  isSyncInProgress,
  isPendingScanInProgress,
  batchImportProgressLabel,
  pendingScan,
  pendingNewFileCount,
  hasPendingImports,
} = useGoogleDriveFolderSync();
const toast = useToast();

const effectiveFileSpaceId = computed(
  () =>
    props.fileSpaceId?.trim() ||
    config.value?.linkedFileSpaceId?.trim() ||
    defaultFileSpaceId.value?.trim() ||
    null
);

const showEditor = ref(false);
const folderInput = ref("");
const copiedFileSpaceId = ref(false);
const isTesting = ref(false);
const isSaving = ref(false);
const testResult = ref<{
  ok: boolean;
  rootFolderName?: string;
  error?: string;
} | null>(null);
const isStartingImport = ref(false);
const workspaceConnection = computed(() => googleWorkspace.connection.value);
const workspaceOAuthLoading = computed(() => googleWorkspace.isLoading.value);

const canStartImport = computed(
  () =>
    !isPendingScanInProgress.value &&
    !isSyncInProgress.value &&
    (hasPendingImports.value || pendingScan.value.updatedCount > 0)
);

const extractedFolderLink = computed(() => extractDriveFolderLink(folderInput.value));
const extractedFolderId = computed(() => extractedFolderLink.value?.folderId ?? null);
const extractedFolderResourceKey = computed(
  () => extractedFolderLink.value?.resourceKey ?? null
);
const folderInputError = computed(() => {
  if (!folderInput.value) return null;
  if (!extractedFolderId.value) {
    return "フォルダ ID が読み取れません。Drive の URL か ID を貼り付けてください";
  }
  return null;
});

const statusMessage = computed(() => {
  if (batchImportProgressLabel.value) {
    return `${batchImportProgressLabel.value}（10件ずつ・最大5並列）`;
  }
  if (isPendingScanInProgress.value) {
    return "未取り込みファイルを確認しています…";
  }
  if (pendingScan.value.phase === "error") {
    return pendingScan.value.errorMessage ?? "確認に失敗しました";
  }
  if (pendingScan.value.phase === "ready") {
    if (pendingNewFileCount.value > 0) {
      const updated =
        pendingScan.value.updatedCount > 0
          ? ` · 更新 ${pendingScan.value.updatedCount} 件`
          : "";
      return `新規 ${pendingNewFileCount.value} 件を取り込めます${updated}`;
    }
    if (pendingScan.value.updatedCount > 0) {
      return `新規なし · 更新 ${pendingScan.value.updatedCount} 件`;
    }
    return "新規ファイルはありません";
  }
  return "再検索で Drive の差分を確認できます";
});

const statusIcon = computed(() => {
  if (isPendingScanInProgress.value || isSyncInProgress.value) {
    return "i-heroicons-arrow-path";
  }
  if (pendingScan.value.phase === "error") {
    return "i-heroicons-exclamation-triangle";
  }
  if (pendingNewFileCount.value > 0 || pendingScan.value.updatedCount > 0) {
    return "i-heroicons-document-arrow-down";
  }
  return "i-heroicons-check-circle";
});

const statusIconSpin = computed(
  () => isPendingScanInProgress.value || isSyncInProgress.value
);

const statusIconTone = computed(() => {
  if (pendingScan.value.phase === "error") return "text-rose-600";
  if (pendingNewFileCount.value > 0) return "text-purple-600";
  return "text-gray-500";
});

watch(folderInput, () => {
  testResult.value = null;
});

const copyFileSpaceId = async () => {
  const id = effectiveFileSpaceId.value;
  if (!id) return;
  try {
    await navigator.clipboard.writeText(id);
    copiedFileSpaceId.value = true;
    setTimeout(() => (copiedFileSpaceId.value = false), 2000);
  } catch (e) {
    log("ERROR", "copy FileSpace ID failed", e);
    toast.add({ title: "コピーに失敗しました", color: "error" });
  }
};

const connectGoogleWorkspace = async (): Promise<boolean> => {
  const ok = await googleWorkspace.connect();
  if (ok) {
    await googleWorkspace.refreshConnection();
  }
  return ok;
};

const enterEditor = () => {
  showEditor.value = true;
  const folderId = config.value?.rootFolderId ?? "";
  const resourceKey = config.value?.rootFolderResourceKey;
  folderInput.value =
    folderId && resourceKey
      ? `https://drive.google.com/drive/folders/${folderId}?resourcekey=${resourceKey}`
      : folderId;
  testResult.value = null;
};

const cancelEditor = () => {
  showEditor.value = false;
  folderInput.value = "";
  testResult.value = null;
};

const truncateSyncError = (msg: string, max = 72): string =>
  msg.length > max ? `${msg.slice(0, max)}…` : msg;

const openDriveFolder = () => {
  const id = config.value?.rootFolderId;
  if (!id) return;
  window.open(
    `https://drive.google.com/drive/folders/${id}`,
    "_blank",
    "noopener,noreferrer"
  );
};

const resolveSyncContext = () => {
  const organizationId = organizationStore.getLoggedInOrganizationId;
  const spaceId = spaceStore.selectedSpace?.id;
  const fileSpaceId = effectiveFileSpaceId.value;
  const rootFolderId = config.value?.rootFolderId;
  const rootFolderResourceKey = config.value?.rootFolderResourceKey ?? null;
  if (!organizationId || !spaceId || !fileSpaceId || !rootFolderId) return null;
  return { organizationId, spaceId, fileSpaceId, rootFolderId, rootFolderResourceKey };
};

const runPendingDriveScan = async (): Promise<boolean> => {
  const ctx = resolveSyncContext();
  if (!ctx) return false;

  try {
    await fileSpaceStore.fetchDocumentsFromFirestore(ctx.fileSpaceId);
  } catch {
    // Firestore 取得失敗時は既存 store 状態で差分算出を試す.
  }

  const existingDocs: FirestoreDriveDoc[] = fileSpaceStore.documents.map(
    (doc) => ({
      driveFileId: doc.driveFileId ?? null,
      driveModifiedTime: doc.driveModifiedTime ?? null,
      name: doc.name ?? null,
      agentSearchDocumentId: doc.agentSearchDocumentId ?? null,
      registration: doc.registration ?? null,
      filePath: doc.filePath ?? null,
    })
  );

  return driveStore.scanPendingDriveFiles({
    ...ctx,
    existingDocs,
  });
};

const triggerDriveImport = async (): Promise<boolean> => {
  const ctx = resolveSyncContext();
  if (!ctx) return false;
  driveStore.lastTerminalSyncNotice = null;
  const created = await driveStore.triggerImportFromDrive(ctx);
  if (created) {
    toast.add({
      title: "Drive 取り込みを開始しました",
      description:
        "バックグラウンドで実行中です。ヘッダーからいつでも進捗を確認できます",
      color: "info",
    });
  }
  return Boolean(created);
};

const onRescanClick = async () => {
  const ok = await runPendingDriveScan();
  if (!ok && pendingScan.value.phase === "error") {
    toast.add({
      title: "再検索に失敗しました",
      description: pendingScan.value.errorMessage ?? undefined,
      color: "error",
    });
  }
};

const onImportClick = async () => {
  const sessionRequestId = driveStore.activeImportSession.requestId;
  const activeReq = sessionRequestId
    ? driveStore.fetchWatchingRequest(sessionRequestId)
    : null;
  const stuckPendingKick =
    activeReq?.status === "pending" &&
    !activeReq.workflow?.executionId &&
    !driveStore.isCreatingRequest;

  if (isSyncInProgress.value && !stuckPendingKick) {
    driveStore.openImportProgressModal();
    return;
  }

  if (stuckPendingKick) {
    driveStore.resetImportSession();
    driveStore.activeSyncRequestId = null;
  }

  isStartingImport.value = true;
  try {
    const started = await triggerDriveImport();
    if (!started) {
      toast.add({
        title: "取り込みを開始できませんでした",
        description:
          "Drive 連携と素材プールの準備が完了してから再度お試しください",
        color: "warning",
      });
    }
  } finally {
    isStartingImport.value = false;
  }
};

const onTestConnection = async () => {
  if (!extractedFolderId.value) return;
  isTesting.value = true;
  testResult.value = null;
  try {
    let connection = await googleWorkspace.refreshConnection();
    if (!connection.connected) {
      const connected = await connectGoogleWorkspace();
      if (!connected) {
        testResult.value = {
          ok: false,
          error: "Google Workspace を接続してからDriveフォルダを確認してください",
        };
        return;
      }
      connection = await googleWorkspace.refreshConnection();
    }
    if (!connection.connected) return;
    const res = await googleWorkspace.testDriveFolder({
      folderId: extractedFolderId.value,
      resourceKey: extractedFolderResourceKey.value,
    });
    if (res?.ok) {
      testResult.value = {
        ok: true,
        rootFolderName: res.rootFolderName,
      };
    } else {
      testResult.value = {
        ok: false,
        error: res?.error || "接続に失敗しました",
      };
    }
  } catch (e: unknown) {
    log("ERROR", "test_connection failed", e);
    const msg = e instanceof Error ? e.message : String(e);
    testResult.value = {
      ok: false,
      error: msg || "接続に失敗しました (microservice 未デプロイ?)",
    };
  } finally {
    isTesting.value = false;
  }
};

const onSave = async () => {
  if (!extractedFolderId.value || !testResult.value?.ok) return;
  isSaving.value = true;
  try {
    await driveStore.upsertConfig({
      rootFolderId: extractedFolderId.value,
      rootFolderResourceKey: extractedFolderResourceKey.value,
      rootFolderName: testResult.value.rootFolderName || null,
      authMode: "oauth",
      serviceAccountEmail,
      linkedFileSpaceId: effectiveFileSpaceId.value,
    });
    toast.add({
      title: "Drive 連携を保存しました",
      description: "Web 取り込みが可能になりました",
      color: "success",
    });
    showEditor.value = false;
    await refresh();
    if (effectiveFileSpaceId.value) {
      void runPendingDriveScan();
    }
  } catch (e) {
    log("ERROR", "save drive config failed", e);
    toast.add({ title: "保存に失敗しました", color: "error" });
  } finally {
    isSaving.value = false;
  }
};

const relativeTime = (ts: Timestamp | null | undefined): string => {
  if (!ts) return "";
  const ms = ts.toMillis ? ts.toMillis() : 0;
  if (!ms) return "";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min} 分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 時間前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 日前`;
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

onMounted(() => {
  void googleWorkspace.refreshConnection();
});
</script>
