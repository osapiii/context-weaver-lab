<template>
  <EnModal
    v-model:open="modalOpen"
    title="取引先の一括登録 (CSV)"
    :subtitle="modalSubtitle"
    size="full"
    fullscreen
    header-variant="default"
    padding="none"
    :close-on-backdrop="!blockDismiss"
    :hide-close="isCommitting"
    :ui="{
      content:
        '!fixed !inset-0 !m-0 !max-w-none !w-screen !h-dvh !max-h-none flex flex-col p-0 rounded-none',
      overlay: 'bg-slate-900/50',
    }"
  >
    <div class="flex flex-1 flex-col min-h-0 overflow-hidden">
      <div class="flex-shrink-0 border-b border-slate-100">
        <div class="mx-auto w-full max-w-5xl px-6 pt-4 pb-2">
          <EnStepper v-model="activeStep" :items="stepperItems" size="sm" />
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto">
        <div class="mx-auto w-full max-w-5xl px-6 py-5 space-y-5">
          <!-- Step 0: CSV upload -->
          <template v-if="activeStep === 0">
            <EnAlert
              variant="assistant"
              title="CSV フォーマット"
              :description="csvFormatDescription"
            />

            <div class="flex flex-wrap items-center gap-3">
              <EnButton
                variant="outline"
                color="neutral"
                size="sm"
                leading-icon="i-heroicons-arrow-down-tray"
                @click="downloadTemplate"
              >
                テンプレート CSV
              </EnButton>
            </div>

            <UFormField
              label="CSV ファイル"
              help="UTF-8 推奨。1 行につき最大 2 件 (仕入・納品) の取引先が生成されます"
            >
              <UInput
                type="file"
                accept=".csv,text/csv"
                :disabled="isBusy"
                class="w-full"
                @change="onCsvSelected"
              />
            </UFormField>

            <ImportValidationPanel
              title="フォーマット検証"
              :messages="formatMessages"
            />

            <ul
              v-if="rowErrors.length > 0"
              class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1"
            >
              <li v-for="err in rowErrors" :key="err.rowIndex">
                {{ err.message }}
              </li>
            </ul>

            <div v-if="parsedRows.length > 0 && formatValid" class="space-y-2">
              <p class="text-xs font-medium text-slate-500">
                取り込み予定（{{ parsedRows.length }} 社）
              </p>
              <div
                class="overflow-auto rounded-lg border border-slate-200 bg-white"
              >
                <UTable
                  :data="parsedRows"
                  :columns="previewColumns"
                  :ui="{ td: { base: 'text-xs' }, th: { base: 'text-xs' } }"
                />
              </div>
            </div>
          </template>

          <!-- Step 1: Processing -->
          <template v-else-if="activeStep === 1">
            <EnAlert
              v-if="isResumingSession"
              variant="soft"
              color="info"
              title="前回の登録処理を再開しています"
              description="閉じる前に実行していた AI 登録の進捗を表示しています。完了すると自動で確認画面へ進みます。"
            />

            <EnAlert
              v-if="isProcessing"
              variant="soft"
              color="warning"
              title="登録処理を実行中です"
              description="このブラウザタブでは AI 登録が並行して続きます。モーダルを閉じても処理は止まりません。あとから「一括登録 (CSV)」を再度開くと、続きの進捗・確認画面を表示します。"
            />

            <EnAILoadingView
              v-if="isProcessing"
              variant="panel"
              :active="true"
              title="AI が取引先情報を登録しています"
              :messages="loadingMessages"
              :rotate="true"
            />

            <div class="space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="font-semibold text-slate-800">進行状況</span>
                <span class="text-slate-600">
                  {{ progressLabel }}
                </span>
              </div>
              <UProgress
                :value="progressPercent"
                :max="100"
                color="primary"
                size="md"
              />
            </div>

            <ul class="space-y-2">
              <li
                v-for="item in snapshotItems"
                :key="item.rowIndex"
                class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <span class="text-lg shrink-0" aria-hidden="true">{{
                  itemStatusIcon(item.status)
                }}</span>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-slate-900 truncate">
                    {{ item.companyName }}
                  </p>
                  <p class="text-xs text-slate-500 truncate">{{ item.url }}</p>
                  <p
                    v-if="item.status === 'processing'"
                    class="text-xs text-sky-600 mt-1"
                  >
                    AI が情報を取得中...
                  </p>
                  <p
                    v-else-if="item.status === 'completed'"
                    class="text-xs text-emerald-600 mt-1"
                  >
                    {{ item.partners.length }} 件のプレビューを生成しました
                  </p>
                  <p
                    v-else-if="item.status === 'failed'"
                    class="text-xs text-red-600 mt-1"
                  >
                    {{ item.errorMessage }}
                  </p>
                </div>
                <EnBadge
                  v-if="item.isSupplier"
                  variant="tag"
                  size="xs"
                >
                  仕入
                </EnBadge>
                <EnBadge
                  v-if="item.isCustomer"
                  variant="tag"
                  size="xs"
                >
                  納品
                </EnBadge>
              </li>
            </ul>
          </template>

          <!-- Step 2: Review & commit -->
          <template v-else>
            <EnAlert
              variant="soft"
              color="success"
              title="登録内容のプレビュー"
              description="内容を確認して「取引先に反映」を押してください。不要な行は個別画面で後から修正できます。"
            />

            <EnAlert
              v-if="failedItems.length > 0"
              variant="soft"
              color="warning"
              :title="`${failedItems.length} 行は AI 登録に失敗しました`"
              description="失敗した行はスキップされ、成功した行のみ反映できます。CSV を修正して最初からやり直す場合は「CSV に戻る」を押してください。"
            />

            <div
              v-if="previewRowGroups.length === 0"
              class="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500"
            >
              反映できる取引先がありません。CSV を見直して再度お試しください。
            </div>

            <div v-else class="space-y-3">
              <div
                class="flex flex-wrap items-center justify-between gap-2"
              >
                <p class="text-sm font-semibold text-slate-800">
                  反映予定: {{ previewPartners.length }} 件
                  <span class="font-normal text-slate-500">
                    (CSV {{ previewRowGroups.length }} 行)
                  </span>
                </p>
                <div class="flex items-center gap-2">
                  <EnButton
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    @click="expandAllPreviewRows"
                  >
                    すべて展開
                  </EnButton>
                  <EnButton
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    @click="collapseAllPreviewRows"
                  >
                    すべて折りたたむ
                  </EnButton>
                </div>
              </div>

              <div class="space-y-2">
                <div
                  v-for="group in previewRowGroups"
                  :key="group.rowIndex"
                  class="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    :aria-expanded="isPreviewRowExpanded(group.rowIndex)"
                    @click="togglePreviewRow(group.rowIndex)"
                  >
                    <UIcon
                      name="i-heroicons-chevron-down"
                      class="size-5 shrink-0 text-slate-400 transition-transform"
                      :class="{
                        'rotate-180': isPreviewRowExpanded(group.rowIndex),
                      }"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="font-semibold text-slate-900 truncate">
                        行 {{ group.rowIndex }}: {{ group.companyName }}
                      </p>
                      <p class="text-xs text-slate-500 truncate">
                        {{ group.url }}
                      </p>
                    </div>
                    <EnBadge variant="soft" color="neutral" size="xs">
                      {{ group.partners.length }} 件
                    </EnBadge>
                  </button>

                  <div
                    v-show="isPreviewRowExpanded(group.rowIndex)"
                    class="border-t border-slate-100 bg-slate-50/60 px-4 py-3 space-y-2"
                  >
                    <EnCard
                      v-for="partner in group.partners"
                      :key="partner.partnerId"
                      variant="flat"
                      padding="snug"
                    >
                      <div class="flex items-start gap-3">
                        <div
                          class="size-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white flex items-center justify-center"
                        >
                          <UIcon
                            :name="partnerTypeIcon(partner.type)"
                            class="size-6 text-slate-400"
                          />
                        </div>
                        <div class="min-w-0 flex-1">
                          <EnBadge
                            :color="
                              partner.type === 'supplier'
                                ? 'warning'
                                : 'info'
                            "
                            variant="soft"
                            size="xs"
                            class="mb-1"
                          >
                            {{ partnerTypeLabel(partner.type) }}
                          </EnBadge>
                          <p class="font-bold text-slate-900 truncate">
                            {{ partner.name }}
                          </p>
                          <p class="text-xs text-slate-500">
                            {{ partner.code }}
                          </p>
                          <p
                            v-if="partner.website"
                            class="text-xs text-sky-600 truncate mt-1"
                          >
                            {{ partner.website }}
                          </p>
                          <p
                            v-if="partner.address"
                            class="text-xs text-slate-500 mt-1 line-clamp-2"
                          >
                            {{ partner.address }}
                          </p>
                        </div>
                      </div>
                    </EnCard>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <template #footer>
      <div
        class="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-6"
      >
        <EnButton
          variant="ghost"
          :disabled="isCommitting || isStarting"
          @click="requestClose"
        >
          {{ cancelButtonLabel }}
        </EnButton>
        <div class="flex items-center gap-2">
          <EnButton
            v-if="activeStep === 2"
            variant="outline"
            color="neutral"
            :disabled="isCommitting"
            @click="goBackToCsvStep"
          >
            CSV に戻る
          </EnButton>
          <EnButton
            v-if="canGoBackOneStep"
            variant="outline"
            color="neutral"
            @click="activeStep -= 1"
          >
            戻る
          </EnButton>
          <EnButton
            v-if="activeStep === 0"
            variant="hero"
            color="primary"
            :disabled="!formatValid || isBusy"
            :loading="isStarting"
            @click="startImport"
          >
            登録を開始
          </EnButton>
          <EnButton
            v-if="activeStep === 2"
            variant="hero"
            color="primary"
            :disabled="previewPartners.length === 0 || isCommitting"
            :loading="isCommitting"
            @click="commitImport"
          >
            取引先に反映
          </EnButton>
        </div>
      </div>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { BusinessPartnerType } from "@models/businessPartner";
import {
  BUSINESS_PARTNER_BULK_IMPORT_MAX_ROWS,
  type BusinessPartnerBulkImportItem,
  type BusinessPartnerBulkImportItemStatus,
  type BusinessPartnerBulkImportPartnerPreview,
} from "@models/businessPartnerBulkImportRequest";
import ImportValidationPanel from "@components/masterBulkImport/ImportValidationPanel.vue";
import {
  BUSINESS_PARTNER_BULK_CSV_HEADERS,
  parseBusinessPartnerBulkCsv,
  type BusinessPartnerBulkCsvRow,
  type FormatCheckMessage,
} from "@utils/parseBusinessPartnerBulkCsv";
import { useBusinessPartnerBulkImportSnapshot } from "@composables/useBusinessPartnerBulkImportSnapshot";
import { BUSINESS_PARTNER_LOOKUP_LOADING_MESSAGES } from "~/constants/aiLoadingMessages";

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
  (event: "imported"): void;
  (event: "close"): void;
}>();

const LEAVE_WHILE_PROCESSING_MESSAGE =
  "AI による取引先の登録はバックグラウンドで続行されます。モーダルを閉じても処理は止まりません。閉じますか？";

const LEAVE_WITH_PREVIEW_MESSAGE =
  "まだ取引先に反映していません。プレビューを破棄して閉じますか？";

const BULK_IMPORT_SESSION_KEY =
  "enAistudio.businessPartnerBulkImport.activeRequestId";

const maxRows = BUSINESS_PARTNER_BULK_IMPORT_MAX_ROWS;
const businessIcons = useBusinessIcons();
const toast = useToast();
const actionIcons = useActionIcons();
const { parseCSVfile, downloadCSVWithHeaders } = useCSV();
const { createImportRequest, commitImportRequest } =
  useBusinessPartnerBulkImportRunner();

const activeStep = ref(0);
const formatMessages = ref<FormatCheckMessage[]>([]);
const rowErrors = ref<Array<{ rowIndex: number; message: string }>>([]);
const parsedRows = ref<BusinessPartnerBulkCsvRow[]>([]);
const requestId = ref<string | null>(null);
const isStarting = ref(false);
const isCommitting = ref(false);
const isResumingSession = ref(false);
const expandedPreviewRows = ref<Set<number>>(new Set());

const { request: importRequest } =
  useBusinessPartnerBulkImportSnapshot(requestId);

const modalOpen = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (value) {
      open.value = true;
      return;
    }
    if (!tryClose()) return;
    open.value = false;
    emit("close");
  },
});

const stepperItems = [
  { title: "CSV アップロード", value: 0 },
  { title: "AI 登録", value: 1 },
  { title: "確認・反映", value: 2 },
];

const loadingMessages = BUSINESS_PARTNER_LOOKUP_LOADING_MESSAGES;

const formatValid = computed(
  () =>
    formatMessages.value.length > 0 &&
    formatMessages.value.every((m) => m.ok) &&
    rowErrors.value.length === 0 &&
    parsedRows.value.length > 0
);

const modalSubtitle = computed(() => {
  switch (activeStep.value) {
    case 0:
      return "CSV をアップロードしてフォーマットを検証します";
    case 1:
      return "並行して AI が各社の情報を取得しています";
    default:
      return "プレビューを確認して取引先マスタに反映します";
  }
});

const snapshotItems = computed(
  () => importRequest.value?.items ?? []
);

const isProcessing = computed(
  () => importRequest.value?.status === "processing"
);

const isBusy = computed(
  () => isStarting.value || isCommitting.value || isProcessing.value
);

const blockDismiss = computed(
  () => isCommitting.value || isStarting.value
);

const csvFormatDescription = computed(
  () =>
    `企業名 / URL / 仕入先かどうか? / 顧客かどうか? の4列です。1回あたり CSV は最大 ${maxRows} 行まで。1 行で仕入・納品の両方を true にすると取引先が 2 件生成されます。AI が URL からざっくり読み取り、細かい修正は登録後の個別画面で行えます。`
);

const cancelButtonLabel = computed(() => {
  if (activeStep.value === 1 && isProcessing.value) {
    return "バックグラウンドで閉じる";
  }
  return "キャンセル";
});

const canGoBackOneStep = computed(
  () => activeStep.value === 1 && !isProcessing.value
);

const failedItems = computed((): BusinessPartnerBulkImportItem[] =>
  (importRequest.value?.items ?? []).filter((i) => i.status === "failed")
);

type PreviewRowGroup = {
  rowIndex: number;
  companyName: string;
  url: string;
  partners: BusinessPartnerBulkImportPartnerPreview[];
};

const previewRowGroups = computed((): PreviewRowGroup[] =>
  (importRequest.value?.items ?? [])
    .filter((i) => i.status === "completed" && i.partners.length > 0)
    .map((i) => ({
      rowIndex: i.rowIndex,
      companyName: i.companyName,
      url: i.url,
      partners: i.partners,
    }))
);

const progressLabel = computed(() => {
  const req = importRequest.value;
  if (!req) return "準備中...";
  return `${req.completedCount + req.failedCount} / ${req.totalCount} 社完了`;
});

const progressPercent = computed(() => {
  const req = importRequest.value;
  if (!req || req.totalCount === 0) return 0;
  return Math.round(
    ((req.completedCount + req.failedCount) / req.totalCount) * 100
  );
});

const previewPartners = computed((): BusinessPartnerBulkImportPartnerPreview[] => {
  const items = importRequest.value?.items ?? [];
  return items
    .filter((i) => i.status === "completed")
    .flatMap((i) => i.partners);
});

const previewColumns = [
  { accessorKey: "rowIndex", header: "行" },
  { accessorKey: "companyName", header: "企業名" },
  { accessorKey: "url", header: "URL" },
  {
    id: "flags",
    header: "種別",
    cell: ({ row }: { row: { original: BusinessPartnerBulkCsvRow } }) => {
      const flags = [];
      if (row.original.isSupplier) flags.push("仕入");
      if (row.original.isCustomer) flags.push("納品");
      return flags.join("・") || "—";
    },
  },
];

const resetState = () => {
  activeStep.value = 0;
  formatMessages.value = [];
  rowErrors.value = [];
  parsedRows.value = [];
  requestId.value = null;
  isStarting.value = false;
  isCommitting.value = false;
  isResumingSession.value = false;
  expandedPreviewRows.value = new Set();
};

watch(open, (isOpen) => {
  if (!isOpen) {
    if (requestId.value && isProcessing.value) {
      sessionStorage.setItem(BULK_IMPORT_SESSION_KEY, requestId.value);
    } else if (!isProcessing.value) {
      sessionStorage.removeItem(BULK_IMPORT_SESSION_KEY);
    }
    resetState();
    return;
  }

  const resumedId = sessionStorage.getItem(BULK_IMPORT_SESSION_KEY);
  if (resumedId) {
    requestId.value = resumedId;
    activeStep.value = 1;
    isResumingSession.value = true;
  }
});

watch(
  () => importRequest.value?.status,
  (status) => {
    if (activeStep.value !== 1) return;
    if (status === "completed" || status === "error") {
      isResumingSession.value = false;
      activeStep.value = 2;
      initExpandedPreviewRows();
    }
  }
);

watch(previewRowGroups, (groups) => {
  if (groups.length > 0 && expandedPreviewRows.value.size === 0) {
    initExpandedPreviewRows();
  }
});

const tryClose = (): boolean => {
  if (isCommitting.value || isStarting.value) return false;
  if (isProcessing.value) {
    return window.confirm(LEAVE_WHILE_PROCESSING_MESSAGE);
  }
  if (activeStep.value === 2 && previewPartners.value.length > 0) {
    return window.confirm(LEAVE_WITH_PREVIEW_MESSAGE);
  }
  return true;
};

const requestClose = () => {
  modalOpen.value = false;
};

const goBackToCsvStep = () => {
  if (
    previewPartners.value.length > 0 &&
    !window.confirm(
      "プレビューを破棄して CSV アップロード画面に戻ります。よろしいですか?"
    )
  ) {
    return;
  }
  activeStep.value = 0;
};

const initExpandedPreviewRows = () => {
  const groups = previewRowGroups.value;
  const initial = groups.slice(0, 3).map((g) => g.rowIndex);
  expandedPreviewRows.value = new Set(initial);
};

const isPreviewRowExpanded = (rowIndex: number): boolean =>
  expandedPreviewRows.value.has(rowIndex);

const togglePreviewRow = (rowIndex: number) => {
  const next = new Set(expandedPreviewRows.value);
  if (next.has(rowIndex)) next.delete(rowIndex);
  else next.add(rowIndex);
  expandedPreviewRows.value = next;
};

const expandAllPreviewRows = () => {
  expandedPreviewRows.value = new Set(
    previewRowGroups.value.map((g) => g.rowIndex)
  );
};

const collapseAllPreviewRows = () => {
  expandedPreviewRows.value = new Set();
};

const downloadTemplate = () => {
  downloadCSVWithHeaders({
    headers: [...BUSINESS_PARTNER_BULK_CSV_HEADERS],
    data: [
      {
        企業名: "株式会社サンプル",
        URL: "https://www.example.co.jp/",
        "仕入先かどうか?": "true",
        "顧客かどうか?": "false",
      },
    ],
    filename: "business-partners-template.csv",
  });
};

const onCsvSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const raw = (await parseCSVfile(file)) as Record<string, string>[];
    const result = parseBusinessPartnerBulkCsv(raw);
    formatMessages.value = result.formatMessages;
    rowErrors.value = result.ok ? [] : result.rowErrors;
    parsedRows.value = result.rows;
  } catch {
    formatMessages.value = [
      { ok: false, text: "CSV の読み込みに失敗しました" },
    ];
    rowErrors.value = [];
    parsedRows.value = [];
  } finally {
    input.value = "";
  }
};

const startImport = async () => {
  if (!formatValid.value) return;
  isStarting.value = true;
  try {
    const id = await createImportRequest(parsedRows.value);
    requestId.value = id;
    activeStep.value = 1;
  } catch {
    toast.add({
      title: "一括登録の開始に失敗しました",
      color: "error",
      icon: actionIcons.error,
    });
  } finally {
    isStarting.value = false;
  }
};

const commitImport = async () => {
  const req = importRequest.value;
  if (!req) return;
  isCommitting.value = true;
  try {
    const { succeeded, failed } = await commitImportRequest(req);
    toast.add({
      title: "取引先を反映しました",
      description: `成功 ${succeeded} 件${failed > 0 ? ` / 失敗 ${failed} 件` : ""}`,
      color: failed > 0 ? "warning" : "success",
      icon: actionIcons.check,
    });
    sessionStorage.removeItem(BULK_IMPORT_SESSION_KEY);
    open.value = false;
    emit("imported");
  } catch {
    toast.add({
      title: "反映に失敗しました",
      color: "error",
      icon: actionIcons.error,
    });
  } finally {
    isCommitting.value = false;
  }
};

const itemStatusIcon = (status: BusinessPartnerBulkImportItemStatus): string => {
  switch (status) {
    case "completed":
      return "✅";
    case "failed":
      return "❌";
    case "processing":
      return "⏳";
    default:
      return "○";
  }
};

const partnerTypeLabel = (type: BusinessPartnerType): string =>
  type === "supplier" ? "仕入先" : "顧客";

const partnerTypeIcon = (type: BusinessPartnerType): string =>
  type === "supplier"
    ? businessIcons.warehouse
    : businessIcons.shipping;
</script>
