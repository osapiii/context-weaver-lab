<template>
  <div
    class="w-full overflow-hidden rounded-xl border border-green-200/80 bg-white shadow-sm ring-1 ring-green-100"
    data-testid="sheet-connection-picker"
  >
    <div
      class="border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50/80 px-3 py-2.5"
    >
      <p class="text-xs font-bold text-slate-900">スプレッドシートに接続</p>
      <p class="mt-0.5 text-[10px] leading-snug text-slate-600">
        上から順に進めてください（SA を編集者招待 → URL 確認 → タブ選択）
      </p>
    </div>

    <ol class="space-y-0 p-3">
      <!-- Step 1 -->
      <li
        class="relative flex gap-3 pb-5"
        data-testid="sheet-connection-step-sa"
      >
        <div class="flex flex-col items-center">
          <span
            class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white shadow-sm"
            aria-hidden="true"
          >1</span>
          <span
            class="mt-1 w-px flex-1 min-h-[1rem] bg-green-200"
            aria-hidden="true"
          />
        </div>
        <section class="min-w-0 flex-1 space-y-2.5 pb-1">
          <div>
            <p class="text-xs font-bold text-slate-900">
              サービスアカウントを編集者として招待
            </p>
            <p class="mt-1 text-[10px] leading-relaxed text-slate-600">
              スプレッドシート右上の「共有」→ 下のメールを貼り付け → 権限は
              <span class="font-semibold text-green-800">編集者</span>
              で保存。
            </p>
          </div>
          <div
            class="flex flex-col gap-2 rounded-lg border border-green-200/80 bg-green-50/50 p-2.5 sm:flex-row sm:items-center"
          >
            <code
              class="min-w-0 flex-1 break-all text-[11px] font-medium text-green-950"
              data-testid="sheet-sa-email"
            >{{ serviceAccountEmail }}</code>
            <EnButton
              variant="solid"
              color="success"
              size="sm"
              type="button"
              class="w-full shrink-0 sm:w-auto"
              :leading-icon="
                saCopied ? 'material-symbols:check' : 'material-symbols:content-copy'
              "
              data-testid="sheet-sa-copy-button"
              @click="copyServiceAccountEmail"
            >
              {{ saCopied ? "コピー済み" : "メールをコピー" }}
            </EnButton>
          </div>
        </section>
      </li>

      <!-- Step 2 -->
      <li
        class="relative flex gap-3 pb-5"
        data-testid="sheet-connection-step-url"
      >
        <div class="flex flex-col items-center">
          <span
            class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white shadow-sm"
            aria-hidden="true"
          >2</span>
          <span
            class="mt-1 w-px flex-1 min-h-[1rem] bg-green-200"
            aria-hidden="true"
          />
        </div>
        <section class="min-w-0 flex-1 space-y-2.5">
          <div>
            <p class="text-xs font-bold text-slate-900">スプレッドシート URL</p>
            <p class="mt-1 text-[10px] text-slate-600">
              ブラウザのアドレスバーから URL をコピーして貼り付けます。
            </p>
          </div>
          <UInput
            id="sheet-url-input"
            v-model="urlInput"
            type="url"
            class="w-full"
            :ui="{ root: 'w-full', base: 'w-full' }"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            :disabled="props.disabled || isVerifying"
            data-testid="sheet-url-input"
            @keydown.enter.prevent="onVerify"
          />
          <p v-if="lastError" class="text-[11px] text-rose-600">
            {{ lastError }}
          </p>
          <p
            v-else-if="verifiedSpreadsheetId"
            class="flex items-center gap-1 text-[11px] font-medium text-green-700"
          >
            <UIcon name="material-symbols:check-circle" class="h-3.5 w-3.5" />
            接続できました。次にタブを選んで確定してください。
          </p>
          <EnButton
            variant="outline"
            color="success"
            size="sm"
            type="button"
            class="w-full"
            :disabled="props.disabled || !urlInput.trim() || isVerifying"
            :loading="isVerifying"
            data-testid="sheet-verify-button"
            @click.stop.prevent="onVerify"
          >
            {{ isVerifying ? "接続を確認中…" : "接続を確認" }}
          </EnButton>
        </section>
      </li>

      <!-- Step 3 -->
      <li class="relative flex gap-3" data-testid="sheet-connection-step-tab">
        <div class="flex flex-col items-center">
          <span
            class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm"
            :class="
              verifiedSpreadsheetId
                ? 'bg-green-600 text-white'
                : 'bg-slate-200 text-slate-500'
            "
            aria-hidden="true"
          >3</span>
        </div>
        <section
          class="min-w-0 flex-1 space-y-2.5"
          :class="{ 'opacity-60': !verifiedSpreadsheetId }"
        >
          <div>
            <p class="text-xs font-bold text-slate-900">編集するシート（タブ）</p>
            <p class="mt-1 text-[10px] text-slate-600">
              AI が操作するタブを 1 つ選び、接続を確定します。
            </p>
          </div>
          <EnSelectMenu
            v-model="selectedTabTitle"
            :items="tabItems"
            placeholder="シートを選択"
            value-key="value"
            label-key="label"
            :disabled="props.disabled || !verifiedSpreadsheetId"
            data-testid="sheet-tab-select"
          />
          <EnButton
            variant="solid"
            color="success"
            size="sm"
            type="button"
            class="w-full"
            :disabled="props.disabled || !selectedTabTitle || !verifiedSpreadsheetId"
            data-testid="sheet-confirm-button"
            @click="onConfirm"
          >
            接続を確定
          </EnButton>
        </section>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EnButton from "@components/EnButton.vue";
import EnSelectMenu from "@components/EnSelectMenu.vue";
import { resolveGoogleSheetServiceAccountEmail } from "@constants/googleSheet";
import { useAiStudioSheetConnection } from "@composables/useAiStudioSheetConnection";
import { useAiStudioStore } from "@stores/aiStudio";
import { buildSpreadsheetUrl } from "@utils/sheetWorkspaceState";
import log from "@utils/logger";

const props = defineProps<{
  disabled?: boolean;
}>();

const store = useAiStudioStore();
const toast = useToast();
const {
  isVerifying,
  lastError,
  verifiedSpreadsheetId,
  verifiedSpreadsheetUrl,
  sheetTabs,
  resetVerification,
  verifySpreadsheet,
} = useAiStudioSheetConnection();

const urlInput = ref(store.spreadsheetUrl ?? "");
const selectedTabTitle = ref<string | null>(store.targetSheetName);
const saCopied = ref(false);

const runtimeConfig = useRuntimeConfig();
const serviceAccountEmail = computed(() =>
  resolveGoogleSheetServiceAccountEmail(runtimeConfig.public as {
    gsheetServiceAccountEmail?: string;
  })
);

const tabItems = computed(() =>
  sheetTabs.value.map((tab) => ({
    value: tab.title,
    label: tab.title,
  }))
);

const copyServiceAccountEmail = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(serviceAccountEmail.value);
    saCopied.value = true;
    window.setTimeout(() => {
      saCopied.value = false;
    }, 2000);
  } catch {
    saCopied.value = false;
  }
};

watch(
  () => store.sheetModeSelected,
  (selected) => {
    if (!selected) {
      urlInput.value = store.spreadsheetUrl ?? "";
      selectedTabTitle.value = store.targetSheetName;
      saCopied.value = false;
      resetVerification();
    }
  }
);

watch(urlInput, (next, prev) => {
  if (next === prev) return;
  if (verifiedSpreadsheetId.value) {
    resetVerification();
    selectedTabTitle.value = null;
  }
});

const onVerify = async (): Promise<void> => {
  const raw = urlInput.value.trim();
  if (!raw || props.disabled || isVerifying.value) return;

  try {
    const result = await verifySpreadsheet({ spreadsheetUrl: raw });
    if (result.ok && result.sheetNames?.length) {
      const preferred =
        store.targetSheetName &&
        result.sheetNames.some((t) => t.title === store.targetSheetName)
          ? store.targetSheetName
          : result.sheetNames[0]!.title;
      selectedTabTitle.value = preferred;
      toast.add({
        title: "スプレッドシートに接続できました",
        description: `${result.sheetNames.length} 件のタブが見つかりました`,
        color: "success",
      });
      return;
    }
    toast.add({
      title: "接続できませんでした",
      description: result.error ?? lastError.value ?? "URL と SA 共有を確認してください",
      color: "error",
    });
  } catch (error) {
    log("ERROR", "[SheetConnectionPicker] onVerify failed", error);
    toast.add({
      title: "接続確認に失敗しました",
      description:
        error instanceof Error ? error.message : "しばらく待ってから再度お試しください",
      color: "error",
    });
  }
};

const onConfirm = (): void => {
  const spreadsheetId = verifiedSpreadsheetId.value;
  const title = selectedTabTitle.value?.trim();
  if (!spreadsheetId || !title) return;
  const tab = sheetTabs.value.find((t) => t.title === title);
  const spreadsheetUrl =
    verifiedSpreadsheetUrl.value ??
    buildSpreadsheetUrl({
      spreadsheetId,
      targetSheetGid: tab?.sheetId ?? null,
    });
  store.confirmSheetConnection({
    spreadsheetId,
    spreadsheetUrl,
    targetSheetName: title,
    targetSheetGid: tab?.sheetId ?? null,
  });
};
</script>
