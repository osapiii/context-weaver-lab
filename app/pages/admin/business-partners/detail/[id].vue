<template>
  <div class="flex w-full min-w-0 flex-col gap-6">
    <AdminModePageNav
      :current-page-label="detailPageLabel"
      :trail="detailNavTrail"
    />

    <div v-if="isLoading" class="space-y-6">
      <USkeleton class="h-24 w-full rounded-3xl" />
      <USkeleton class="h-48 w-full rounded-3xl" />
    </div>

    <div
      v-else-if="!partner"
      class="rounded-3xl border border-slate-200 bg-white p-12 text-center"
    >
      <UIcon
        :name="actionIcons.error"
        class="mx-auto mb-3 h-12 w-12 text-red-400"
      />
      <p class="text-lg font-semibold text-gray-900">
        指定された取引先が見つかりません
      </p>
      <UButton class="mt-6" :icon="actionIcons.back" @click="navigateBack">
        一覧に戻る
      </UButton>
    </div>

    <div v-else class="space-y-6">
      <!-- ヘッダー -->
      <section
        class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div
          class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
        >
          <div class="flex items-start gap-4">
            <div
              class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <img
                v-if="brandImageUrl && !brandImageFailed"
                :src="brandImageUrl"
                :alt="`${displayName} ロゴ`"
                class="h-full w-full object-contain p-1"
                referrerpolicy="no-referrer"
                @error="brandImageFailed = true"
              />
              <UIcon
                v-else
                :name="typeIcon"
                class="h-9 w-9 text-purple-600"
              />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <EnBadge color="primary" variant="subtle" size="sm">
                  {{ typeLabel }}
                </EnBadge>
                <EnBadge
                  v-if="lookupSourceLabel"
                  color="info"
                  variant="soft"
                  size="sm"
                >
                  {{ lookupSourceLabel }}
                </EnBadge>
              </div>
              <h1 class="mt-2 text-2xl font-extrabold text-gray-900 md:text-3xl">
                {{ displayName }}
              </h1>
              <p
                v-if="displaySubtitle"
                class="mt-1 text-sm text-gray-600 line-clamp-2"
              >
                {{ displaySubtitle }}
              </p>
              <p class="mt-2 text-sm text-gray-500">
                コード:
                <span class="font-mono">{{ partner.code }}</span>
                <span
                  v-if="partner.corporateNumber"
                  class="ml-3 text-gray-400"
                >
                  法人番号:
                  <span class="font-mono">{{ partner.corporateNumber }}</span>
                </span>
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2">
            <EnButton
              variant="outline"
              color="error"
              size="sm"
              :leading-icon="actionIcons.delete"
              :loading="isDeleting"
              :disabled="isDeleting"
              @click="confirmDeletePartner"
            >
              削除
            </EnButton>
            <EnButton
              variant="soft"
              color="neutral"
              size="sm"
              :leading-icon="actionIcons.back"
              :disabled="isDeleting"
              @click="navigateBack"
            >
              一覧に戻る
            </EnButton>
          </div>
        </div>

        <div
          v-if="partner.businessSummary"
          class="mt-6 rounded-2xl bg-slate-50 p-5"
        >
          <div class="mb-2 text-xs font-semibold text-gray-500">事業概要</div>
          <p class="whitespace-pre-line text-sm text-gray-900">
            {{ partner.businessSummary }}
          </p>
        </div>
      </section>

      <!-- タブ: 会社情報 / 取引ログ / 公式サイト -->
      <section
        class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
      >
        <UTabs
          v-model="activeTab"
          value-key="value"
          :items="tabItems"
          color="primary"
          variant="link"
          :ui="{ list: 'border-b border-slate-200 mb-6' }"
        >
          <template #company>
            <dl class="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              <div
                v-for="row in infoRows"
                :key="row.label"
                class="flex flex-col gap-1"
              >
                <dt class="text-xs font-semibold text-gray-500">
                  {{ row.label }}
                </dt>
                <dd class="break-words text-sm text-gray-900">
                  <a
                    v-if="row.href"
                    :href="row.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 hover:underline"
                  >
                    {{ row.value }}
                  </a>
                  <template v-else>
                    {{
                      row.value && row.value.length > 0 ? row.value : "—"
                    }}
                  </template>
                </dd>
              </div>
            </dl>
          </template>

          <template #activity>
            <UTabs
              v-model="activityView"
              value-key="value"
              :items="activityTabItems"
              color="neutral"
              variant="pill"
              class="mb-6"
            >
              <template #timeline>
                <BusinessPartnerActivityTimeline
                  :purchase-records="businessPartnerStore.purchaseRecordList"
                />
              </template>
              <template #table>
                <div
                  v-if="
                    partner.type !== 'supplier' ||
                    businessPartnerStore.purchaseRecordList.length === 0
                  "
                  class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-gray-500"
                >
                  <template v-if="partner.type !== 'supplier'">
                    顧客の取引ログ（関連データ）は今後のフェーズで表示します。
                  </template>
                  <template v-else>
                    まだ取引実績が登録されていません。
                  </template>
                </div>
                <div v-else class="overflow-x-auto">
                  <UTable
                    :data="businessPartnerStore.purchaseRecordList"
                    :columns="purchaseRecordColumns"
                  />
                </div>
              </template>
            </UTabs>
          </template>

          <template #website>
            <BusinessPartnerWebsitePreview
              :website-url="partner.website"
              :partner-name="displayName"
            />
          </template>
        </UTabs>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { formatTimestamp } from "@utils/date";
import { resolvePartnerBrandImageUrl } from "@utils/partnerBrandImage";
import BusinessPartnerActivityTimeline from "@components/businessPartner/BusinessPartnerActivityTimeline.vue";
import BusinessPartnerWebsitePreview from "@components/businessPartner/BusinessPartnerWebsitePreview.vue";
import EnBadge from "@components/EnBadge.vue";

definePageMeta({
  layout: "admin",
  middleware: ["admin-logged-in-check"],
  adminPageStack: false,
});

const route = useRoute();
const router = useRouter();
const organizationStore = useOrganizationStore();
const businessPartnerStore = useBusinessPartnerStore();
const toast = useToast();

const actionIcons = useActionIcons();
const businessIcons = useBusinessIcons();

const isLoading = ref(true);
const isDeleting = ref(false);
const brandImageFailed = ref(false);
const activeTab = ref("company");
const activityView = ref("timeline");

const partnerId = computed(() => route.params.id as string);
const partner = computed(() => businessPartnerStore.selectedPartner);

const brandImageUrl = computed(() =>
  resolvePartnerBrandImageUrl(partner.value)
);

watch(brandImageUrl, () => {
  brandImageFailed.value = false;
});

const displayName = computed(() => {
  if (!partner.value) return "";
  const primary =
    partner.value.tradeName?.trim() || partner.value.name?.trim() || "";
  const pipe = primary.indexOf("|");
  if (pipe > 0) {
    return primary.slice(0, pipe).trim();
  }
  return primary;
});

const displaySubtitle = computed(() => {
  const name = partner.value?.name?.trim() || "";
  if (!name.includes("|")) return undefined;
  const parts = name.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return undefined;
  return parts.slice(1).join(" | ");
});

const typeLabel = computed(() => {
  if (!partner.value) return "";
  return partner.value.type === "supplier" ? "仕入先" : "顧客";
});

const typeIcon = computed(() => {
  if (!partner.value) return businessIcons.client;
  return partner.value.type === "supplier"
    ? businessIcons.warehouse
    : businessIcons.shipping;
});

const tabItems = computed(() => {
  const items = [
    { label: "会社情報", value: "company", slot: "company" as const },
    { label: "取引ログ", value: "activity", slot: "activity" as const },
  ];
  if (partner.value?.website?.trim()) {
    items.push({
      label: "公式サイト",
      value: "website",
      slot: "website" as const,
    });
  }
  return items;
});

const activityTabItems = [
  { label: "タイムライン", value: "timeline", slot: "timeline" as const },
  { label: "表", value: "table", slot: "table" as const },
];

const detailNavTrail = computed(() => [
  {
    label: "取引先",
    icon: businessIcons.client,
    to: {
      name: "admin-business-partners-list",
      query: {
        o: organizationStore.loggedInOrganizationInfo.id,
        type: partner.value?.type ?? undefined,
      },
    },
  },
]);

const detailPageLabel = computed(() => {
  if (partner.value?.name) {
    return displayName.value || partner.value.name;
  }
  return "取引先詳細";
});

const formatCapital = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return raw;
  return `${n.toLocaleString("ja-JP")} 円`;
};

const composedAddress = computed(() => {
  if (!partner.value) return undefined;
  return [
    partner.value.prefecture,
    partner.value.city,
    partner.value.streetAddress,
  ]
    .filter((s) => s && s.trim().length > 0)
    .join("");
});

const infoRows = computed(() => {
  if (!partner.value) return [];
  const website = partner.value.website?.trim();
  const rows: Array<{ label: string; value?: string; href?: string }> = [
    { label: "法人番号", value: partner.value.corporateNumber },
    { label: "正式商号", value: partner.value.tradeName },
    { label: "フリガナ", value: partner.value.tradeNameKana },
    { label: "代表者", value: composeRepresentative.value },
    { label: "設立日", value: partner.value.foundedDate },
    { label: "資本金", value: formatCapital(partner.value.capitalStock) },
    { label: "業種", value: partner.value.industry },
    { label: "従業員数", value: partner.value.employeeCount },
    { label: "郵便番号", value: partner.value.postalCode },
    {
      label: "住所",
      value: partner.value.address || composedAddress.value,
    },
    { label: "担当者", value: partner.value.contactPerson },
    { label: "電話番号", value: partner.value.phoneNumber },
    { label: "メールアドレス", value: partner.value.email },
    {
      label: "ウェブサイト",
      value: website,
      href: website || undefined,
    },
    { label: "メモ", value: partner.value.note },
    {
      label: "作成日時",
      value: partner.value.createdAt
        ? formatTimestamp(partner.value.createdAt.toDate())
        : undefined,
    },
    {
      label: "更新日時",
      value: partner.value.updatedAt
        ? formatTimestamp(partner.value.updatedAt.toDate())
        : undefined,
    },
  ];
  return rows;
});

const composeRepresentative = computed(() => {
  if (!partner.value) return undefined;
  const title = partner.value.representativeTitle;
  const name = partner.value.representativeName;
  if (!title && !name) return undefined;
  return [title, name].filter(Boolean).join(" ");
});

const lookupSourceLabel = computed(() => {
  switch (partner.value?.lookupSource) {
    case "corporateNumber":
      return "法人番号 API から取得";
    case "url":
      return "公式サイトから取得";
    case "manual":
      return "手入力";
    default:
      return undefined;
  }
});

const purchaseRecordColumns = [
  { accessorKey: "purchaseDate", header: "仕入日" },
  { accessorKey: "materialCode", header: "品目コード" },
  { accessorKey: "materialName", header: "品目名" },
  { accessorKey: "quantity", header: "数量" },
  { accessorKey: "unit", header: "単位" },
  { accessorKey: "unitPrice", header: "単価" },
  { accessorKey: "totalAmount", header: "金額" },
  { accessorKey: "lotNumber", header: "ロット番号" },
];

const navigateBack = () => {
  router.push({
    name: "admin-business-partners-list",
    query: {
      o: organizationStore.loggedInOrganizationInfo.id,
      type: partner.value?.type ?? undefined,
    },
  });
};

const confirmDeletePartner = async () => {
  if (!partner.value || isDeleting.value) return;

  const name = displayName.value || partner.value.name;
  const purchaseCount = businessPartnerStore.purchaseRecordList.length;
  const typeNote =
    partner.value.type === "customer"
      ? "関連データなどで参照されている場合、該当データの取引先は未設定のまま残ります。"
      : "";

  const lines = [
    `「${name}」を削除します。`,
    purchaseCount > 0
      ? `紐づく取引実績 ${purchaseCount} 件も削除されます。`
      : null,
    typeNote || null,
    "この操作は取り消せません。よろしいですか？",
  ].filter(Boolean);

  if (!window.confirm(lines.join("\n"))) return;

  isDeleting.value = true;
  const succeeded = await businessPartnerStore.deletePartner({
    partnerId: partnerId.value,
  });
  isDeleting.value = false;

  if (!succeeded) return;

  toast.add({
    title: "取引先を削除しました",
    description: name,
    color: "success",
    icon: actionIcons.check,
  });
  navigateBack();
};

const loadPartner = async (id: string) => {
  isLoading.value = true;
  const succeeded = await businessPartnerStore.fetchPartnerById({
    partnerId: id,
  });
  if (
    succeeded &&
    businessPartnerStore.selectedPartner?.type === "supplier"
  ) {
    await businessPartnerStore.fetchPurchaseRecords({ partnerId: id });
  } else {
    businessPartnerStore.purchaseRecordList = [];
  }
  isLoading.value = false;
};

onMounted(() => {
  loadPartner(partnerId.value);
});

watch(partnerId, (newId) => {
  if (newId) {
    loadPartner(newId);
  }
});
</script>
